/**
 * dev-runner.js
 * Detecta porta livre a partir de 5173 e inicia Vite + Electron.
 */
const { spawn } = require('child_process')
const net = require('net')
const path = require('path')

// Usa o binário Electron instalado localmente para evitar problemas com npx no Windows
const electronBin = (() => {
  try { return require('electron') } catch { return 'electron' }
})()

function portaLivre(inicio = 5173) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(portaLivre(inicio + 1)))
    server.once('listening', () => {
      const porta = server.address().port
      server.close(() => resolve(porta))
    })
    server.listen(inicio)
  })
}

async function main() {
  const porta = await portaLivre(5173)
  const url = `http://localhost:${porta}`
  console.log(`\n🚀 Iniciando Vite na porta ${porta}...`)

  const vite = spawn(
    'npx', ['vite', '--port', String(porta), '--no-strictPort'],
    { shell: true, stdio: ['inherit', 'pipe', 'pipe'] }
  )

  let viteReady = false
  let electronProc = null

  function tryStartElectron(text) {
    if (viteReady) return
    if (text.includes('Local:') || text.includes('ready in') || text.includes('localhost:')) {
      viteReady = true
      console.log(`\n⚡ Vite pronto em ${url} — iniciando Electron...`)
      const electronEnv = { ...process.env, VITE_DEV_URL: url }
      delete electronEnv.ELECTRON_RUN_AS_NODE  // garante modo app, não modo Node.js puro
      electronProc = spawn(electronBin, ['.'], {
        stdio: 'inherit',
        env: electronEnv,
      })
      electronProc.on('exit', (code) => {
        console.log('\n📦 Electron encerrado. Parando Vite...')
        vite.kill()
        process.exit(code || 0)
      })
    }
  }

  vite.stdout.on('data', (data) => { const t = data.toString(); process.stdout.write(t); tryStartElectron(t) })
  vite.stderr.on('data', (data) => {
    const t = data.toString()
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
