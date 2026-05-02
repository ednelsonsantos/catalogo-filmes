/**
 * dev-runner.js
 * Inicia Vite e aguarda a linha "Local: http://localhost:PORT" para
 * obter a porta real antes de subir o Electron.
 */
const { spawn } = require('child_process')
const path = require('path')

const electronBin = (() => {
  try { return require('electron') } catch { return 'electron' }
})()

async function main() {
  console.log('\n🚀 Iniciando Vite...')

  const vite = spawn(
    'npx', ['vite', '--no-strictPort'],
    { shell: true, stdio: ['inherit', 'pipe', 'pipe'] }
  )

  let electronProc = null

  // Buffer de saída para capturar a linha Local: mesmo que chegue particionada
  let outputBuf = ''
  let electronStarted = false

  function tryStartElectron(text) {
    if (electronStarted) return
    // Strip ANSI escape codes before matching
    const clean = text.replace(/\x1B\[[0-9;]*[mGKHF]/g, '')
    outputBuf += clean
    const match = outputBuf.match(/Local:\s+(http:\/\/localhost:\d+)/)
    if (!match) return
    electronStarted = true
    const url = match[1]
    console.log(`\n⚡ Vite pronto em ${url} — iniciando Electron...`)

    const electronEnv = { ...process.env, VITE_DEV_URL: url }
    delete electronEnv.ELECTRON_RUN_AS_NODE
    electronProc = spawn(electronBin, ['.'], { stdio: 'inherit', env: electronEnv })
    electronProc.on('exit', (code) => {
      console.log('\n📦 Electron encerrado. Parando Vite...')
      vite.kill()
      process.exit(code || 0)
    })
  }

  vite.stdout.on('data', (d) => { const t = d.toString(); process.stdout.write(t); tryStartElectron(t) })
  vite.stderr.on('data', (d) => {
    const t = d.toString()
    if (!t.includes('CJS build of Vite')) process.stderr.write(t)
    tryStartElectron(t)
  })
  vite.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\n❌ Vite encerrou com código ${code}`)
      if (electronProc) electronProc.kill()
      process.exit(code)
    }
  })

  process.on('SIGINT',  () => { vite.kill(); if (electronProc) electronProc.kill(); process.exit(0) })
  process.on('SIGTERM', () => { vite.kill(); if (electronProc) electronProc.kill(); process.exit(0) })
}

main().catch(err => { console.error(err); process.exit(1) })
