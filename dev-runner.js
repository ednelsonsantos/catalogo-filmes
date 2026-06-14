/**
 * dev-runner.js
 * Inicia Vite e aguarda a linha "Local: http://localhost:PORT" para
 * obter a porta real antes de subir o Electron.
 */
const { spawn, execSync } = require('child_process')

const electronBin = (() => {
  try { return require('electron') } catch { return 'electron' }
})()

// Mata um processo e toda sua árvore de filhos no Windows
function killTree(pid) {
  if (!pid) return
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${pid} /f /t`, { stdio: 'ignore' })
    } else {
      process.kill(-pid, 'SIGKILL')
    }
  } catch {}
}

// PIDs coletados para cleanup
const pids = { vite: null, electron: null }

function shutdown(code) {
  killTree(pids.vite)
  killTree(pids.electron)
  process.exit(code || 0)
}

process.on('SIGINT',  () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
process.on('exit',    ()  => { killTree(pids.vite); killTree(pids.electron) })

async function main() {
  console.log('\n🚀 Iniciando Vite...')

  // shell: false + cmd /c no Windows para ter o PID do node real, não do cmd
  let viteProc
  if (process.platform === 'win32') {
    viteProc = spawn('cmd', ['/c', 'npx vite --no-strictPort'], {
      shell: false,
      stdio: ['inherit', 'pipe', 'pipe'],
    })
  } else {
    viteProc = spawn('npx', ['vite', '--no-strictPort'], {
      shell: false,
      stdio: ['inherit', 'pipe', 'pipe'],
    })
  }

  // No Windows com cmd /c, o filho imediato é o cmd — precisamos do neto (node/vite)
  // Aguarda um momento e busca o filho do cmd pelo PPID
  function resolveVitePid(cmdPid) {
    if (process.platform !== 'win32') {
      pids.vite = cmdPid
      return
    }
    // tenta algumas vezes até o node filho aparecer
    let attempts = 0
    const interval = setInterval(() => {
      try {
        const out = execSync(
          `wmic process where (ParentProcessId=${cmdPid}) get ProcessId /format:value`,
          { stdio: ['ignore', 'pipe', 'ignore'] }
        ).toString()
        const match = out.match(/ProcessId=(\d+)/)
        if (match) {
          pids.vite = parseInt(match[1])
          clearInterval(interval)
        }
      } catch {}
      if (++attempts > 20) { pids.vite = cmdPid; clearInterval(interval) }
    }, 100)
  }

  resolveVitePid(viteProc.pid)

  let outputBuf = ''
  let electronStarted = false

  function tryStartElectron(text) {
    if (electronStarted) return
    const clean = text.replace(/\x1B\[[0-9;]*[mGKHF]/g, '')
    outputBuf += clean
    const match = outputBuf.match(/Local:\s+(http:\/\/localhost:\d+)/)
    if (!match) return
    electronStarted = true
    const url = match[1]
    console.log(`\n⚡ Vite pronto em ${url} — iniciando Electron...`)

    const electronEnv = { ...process.env, VITE_DEV_URL: url }
    delete electronEnv.ELECTRON_RUN_AS_NODE
    const electronProc = spawn(electronBin, ['.'], { stdio: 'inherit', env: electronEnv })
    pids.electron = electronProc.pid

    electronProc.on('exit', (code) => {
      console.log('\n📦 Electron encerrado.')
      shutdown(code)
    })
  }

  viteProc.stdout.on('data', (d) => { const t = d.toString(); process.stdout.write(t); tryStartElectron(t) })
  viteProc.stderr.on('data', (d) => {
    const t = d.toString()
    if (!t.includes('CJS build of Vite')) process.stderr.write(t)
    tryStartElectron(t)
  })
  viteProc.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\n❌ Vite encerrou com código ${code}`)
      shutdown(code)
    }
  })
}

main().catch(err => { console.error(err); process.exit(1) })
