// Publica uma versão nova do Meu Catálogo nos releases do GitHub (de onde os apps instalados se atualizam).
//
//   npm run publicar -- patch     correção de bug        (1.11.0 → 1.11.1)
//   npm run publicar -- minor     melhoria/funcionalidade (1.11.0 → 1.12.0)
//   npm run publicar -- major     quebra compatibilidade  (1.11.0 → 2.0.0)
//   npm run publicar              usa a versão que já está no package.json
//   ... -- --simular              só confere (token, git, versão), sem testar, publicar nem commitar
//
// O token vem da variável GH_TOKEN; se o terminal foi aberto antes do `setx`, lê direto do usuário do Windows.
// O valor do token nunca é impresso.

const { spawnSync, execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const PKG = path.join(ROOT, 'package.json')
const args = process.argv.slice(2)
const SIMULAR = args.includes('--simular')
const bump = args.find(a => ['patch', 'minor', 'major'].includes(a))

const step = (n, msg) => console.log(`\n\x1b[36m[${n}]\x1b[0m ${msg}`)
const ok = (msg) => console.log(`    \x1b[32m✓\x1b[0m ${msg}`)
function fail(msg) {
  console.error(`\n\x1b[31m✗ ${msg}\x1b[0m\n`)
  process.exit(1)
}

function run(cmd, cmdArgs, extraEnv = {}) {
  const r = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit', shell: true, env: { ...process.env, ...extraEnv } })
  return r.status === 0
}
const git = (cmd) => execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8' }).trim()

function readToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN.trim()
  if (process.platform !== 'win32') return ''
  try {
    const out = execSync('reg query HKCU\\Environment /v GH_TOKEN', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return (out.match(/GH_TOKEN\s+REG_\w+\s+(\S+)/) || [])[1] || ''
  } catch { return '' }
}

const semver = (v) => String(v).replace(/^v/, '').split('.').map(Number)
const isNewer = (a, b) => {
  const [x, y] = [semver(a), semver(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]
  return false
}

async function gh(token, method, url, body) {
  const res = await fetch(`https://api.github.com${url}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'meu-catalogo-publicar' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

;(async () => {
  const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'))
  const { owner, repo } = pkg.build.publish.find(p => p.provider === 'github')
  console.log(`Publicar Meu Catálogo em github.com/${owner}/${repo}${SIMULAR ? '  (SIMULAÇÃO — nada será alterado)' : ''}`)

  step(1, 'Token do GitHub')
  const token = readToken()
  if (!token) fail('GH_TOKEN não encontrado. Crie um token (Contents: Read and write neste repositório) e rode: setx GH_TOKEN "github_pat_..."')
  const repoInfo = await gh(token, 'GET', `/repos/${owner}/${repo}`)
  if (repoInfo.status === 401) fail('O GitHub recusou o token (expirado ou revogado). Gere outro e rode o setx de novo.')
  if (repoInfo.status !== 200) fail(`Não consegui acessar o repositório com o token (HTTP ${repoInfo.status}).`)
  ok(`token aceito${process.env.GH_TOKEN ? '' : ' (lido do usuário do Windows)'}`)

  step(2, 'Código sem alterações pendentes')
  if (git('status --porcelain')) fail('Há alterações sem commit. Faça o commit (ou descarte) antes de publicar — o release precisa bater com o código do GitHub.')
  if (git('rev-parse --abbrev-ref HEAD') !== 'main') fail('Publique a partir do branch main.')
  ok('árvore limpa, branch main')

  step(3, 'Versão')
  const latest = await gh(token, 'GET', `/repos/${owner}/${repo}/releases/latest`)
  const published = latest.status === 200 ? latest.data.tag_name.replace(/^v/, '') : null
  let version = pkg.version
  if (bump) {
    const [ma, mi, pa] = semver(version)
    version = bump === 'major' ? `${ma + 1}.0.0` : bump === 'minor' ? `${ma}.${mi + 1}.0` : `${ma}.${mi}.${pa + 1}`
  }
  if (published && !isNewer(version, published)) {
    fail(`A versão ${version} não é maior que a publicada (${published}). Use: npm run publicar -- patch | minor | major`)
  }
  const existing = await gh(token, 'GET', `/repos/${owner}/${repo}/releases/tags/v${version}`)
  if (existing.status === 200) fail(`Já existe um release v${version} no GitHub.`)
  ok(`${pkg.version}${bump ? ` → ${version} (${bump})` : ''} · publicada hoje: ${published || 'nenhuma'}`)

  if (SIMULAR) {
    console.log('\nSimulação concluída: daria pra publicar. Faltaria rodar os testes, commitar, compilar e publicar.\n')
    return
  }

  const pkgBackup = fs.readFileSync(PKG, 'utf8')
  const lockPath = path.join(ROOT, 'package-lock.json')
  const lockBackup = fs.existsSync(lockPath) ? fs.readFileSync(lockPath, 'utf8') : null
  const restoreVersion = () => {
    fs.writeFileSync(PKG, pkgBackup)
    if (lockBackup != null) fs.writeFileSync(lockPath, lockBackup)
  }
  if (bump) {
    if (!run('npm', ['version', version, '--no-git-tag-version'])) { restoreVersion(); fail('Não consegui atualizar a versão.') }
  }

  step(4, 'Testes de interface (npm run test:ui)')
  if (!run('npm', ['run', 'test:ui'])) {
    restoreVersion()
    fail('Testes falharam — nada foi publicado e a versão voltou ao que era.')
  }
  ok('todos os testes passaram')

  step(5, 'Commit e push da versão')
  if (bump) {
    git('add package.json package-lock.json')
    execSync(`git commit -q -m "Versão ${version}"`, { cwd: ROOT, stdio: 'inherit' })
  }
  // o GitHub cria a tag do release no último commit enviado — precisa estar em dia antes de publicar
  if (!run('git', ['push'])) fail('Falha no git push. Resolva e rode o comando de novo (a versão já está commitada).')
  ok(`main enviado${bump ? `, com o commit "Versão ${version}"` : ''}`)

  step(6, 'Compilar e enviar o instalador ao GitHub')
  if (!run('npx', ['vite', 'build'])) fail('Falha no build do Vite.')
  if (!run('npx', ['electron-builder', '--publish', 'always'], { GH_TOKEN: token })) fail('Falha no electron-builder ao compilar/enviar.')
  ok('instalador, .blockmap e latest.yml enviados como rascunho')

  step(7, 'Publicar o release')
  const list = await gh(token, 'GET', `/repos/${owner}/${repo}/releases?per_page=20`)
  const draft = (list.data || []).find(r => r.tag_name === `v${version}`)
  if (!draft) fail(`Não achei o rascunho v${version} no GitHub. Publique manualmente em github.com/${owner}/${repo}/releases`)
  const names = draft.assets.map(a => a.name)
  const missing = ['latest.yml', `${pkg.name}-setup-${version}.exe`].filter(n => !names.includes(n))
  if (missing.length) fail(`O rascunho está sem: ${missing.join(', ')}. Confira em github.com/${owner}/${repo}/releases antes de publicar.`)
  if (draft.draft) {
    const pub = await gh(token, 'PATCH', `/repos/${owner}/${repo}/releases/${draft.id}`, { draft: false })
    if (pub.status !== 200) fail(`O GitHub recusou publicar o rascunho (HTTP ${pub.status}). Publique manualmente.`)
  }
  ok(`v${version} publicado: https://github.com/${owner}/${repo}/releases/tag/v${version}`)

  step(8, 'Limpar dist-electron (fica só o instalador novo)')
  const dist = path.join(ROOT, 'dist-electron')
  const keep = `${pkg.build.productName} Setup ${version}.exe`
  for (const entry of fs.readdirSync(dist)) {
    if (entry !== keep) fs.rmSync(path.join(dist, entry), { recursive: true, force: true })
  }
  ok(`dist-electron/${keep}`)

  console.log(`\n\x1b[32mPronto! Os apps instalados vão encontrar a versão ${version} ao abrir (ou em Configurações → Verificar atualizações).\x1b[0m\n`)
})().catch(e => fail(e.message))
