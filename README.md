# Meu Catálogo

Aplicativo desktop para catalogar sua coleção pessoal de filmes, séries, documentários e outros conteúdos em DVD, Blu-ray, 4K UHD e mais. Desenvolvido com Electron + React.

---

## Funcionalidades

- **Tela de carregamento** com logo animado ao iniciar o aplicativo
- **Adicionar títulos** por foto da capa (OCR local), busca por título ou preenchimento manual
- **OCR local** via Tesseract.js — lê o texto da capa sem internet e sem conta
- **Busca automática** em OMDb e TMDB simultaneamente — retorna título em PT-BR, sinopse, elenco, nota IMDb, pôster e categoria
- **Categorias automáticas** — Filme, Série, Mini-série, Documentário, Animação, etc. preenchidas direto da API
- **Coleções** — agrupe títulos em coleções personalizadas com filtro na sidebar
- **Múltiplos formatos** por título — DVD, Blu-ray, 4K UHD, VHS, Digital
- **Marcar como assistido** com ou sem data
- **Catálogo** com visualização em grade ou lista, filtros por formato, categoria e busca por texto
- **Exportar** coleção para CSV, Excel ou JSON para publicar em site
- **Banco de dados local** SQLite — seus dados ficam no computador, sem nuvem
- **Ícone personalizado** — logo do app no instalador, atalhos e barra de tarefas

---

## Segurança

O app foi desenvolvido com práticas de segurança para aplicações Electron:

- **API keys nunca cruzam o IPC** — as chaves OMDb e TMDB ficam exclusivamente no processo principal (`main.js`); o renderer nunca as recebe nem as envia
- **Path traversal bloqueado** — leitura e gravação de capas validadas para ficarem estritamente dentro de `userData/covers/`
- **Content Security Policy** — aplicada em produção para bloquear scripts e recursos não autorizados
- **Allowlist de URLs externas** — `shell.openExternal` só aceita origens explicitamente permitidas, validadas por `URL.origin` (previne subdomain spoofing)
- **Navegação bloqueada** — `will-navigate` e `setWindowOpenHandler` impedem que o renderer navegue para URLs externas
- **`contextIsolation: true` + `nodeIntegration: false`** — isolamento completo entre renderer e Node.js
- **Validação de entrada** — todos os handlers IPC validam tipo, range e tamanho dos parâmetros recebidos

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Interface | React 18 + Vite 5 |
| Desktop | Electron 32 |
| Banco de dados | better-sqlite3 (SQLite local) |
| OCR | Tesseract.js 5 (local, sem internet) |
| Metadados | OMDb API + TMDB API |
| Exportação | xlsx |
| Testes | Jest (local) |

---

## APIs utilizadas

O aplicativo funciona sem APIs — você pode preencher títulos manualmente. As chaves desbloqueiam a busca automática de metadados.

### OMDb API
Fornece: sinopse (inglês), elenco, nota IMDb, pôster, duração, país, idioma, tipo (filme/série).

**Como obter (gratuito, 1.000 buscas/dia):**
1. Acesse [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx)
2. Escolha o plano **Free**
3. Preencha seu e-mail e clique em *Submit*
4. Confirme o e-mail recebido — a chave vem na mensagem
5. Cole a chave em **Configurações → OMDb API** e clique em Salvar

### TMDB API
Fornece: título em português, sinopse traduzida, elenco, pôster de alta qualidade, tipo detalhado da obra (Miniseries, Documentary, Animation, Talk Show…).

**Como obter (gratuito, sem limite diário):**
1. Crie uma conta em [themoviedb.org](https://www.themoviedb.org)
2. Acesse **Configurações → API** no seu perfil
3. Solicite uma chave de API (tipo *Developer*)
4. Copie a **API Key (v3 auth)**
5. Cole a chave em **Configurações → TMDB API** e clique em Salvar

> Quando ambas as chaves estão configuradas, a busca roda as duas APIs em paralelo e combina os resultados — título PT-BR do TMDB com nota IMDb do OMDb.

---

## Instalação para desenvolvimento

### Pré-requisitos
- Node.js 18+
- npm

### Passos

```bash
# Clonar o repositório
git clone https://github.com/ednelsonsantos/catalogo-filmes.git
cd catalogo-filmes

# Instalar dependências (já faz o rebuild do módulo nativo)
npm install

# Iniciar em modo desenvolvimento
npm run dev
```

> O `postinstall` executa `electron-rebuild` automaticamente para compilar o `better-sqlite3` contra a versão correta do Electron.

### Build para distribuição

```bash
npm run build
```

O instalador Windows (`.exe`) é gerado na pasta `dist-electron/`.

---

## Estrutura do projeto

```
catalogo-filmes/
├── electron/
│   ├── main.js          # Processo principal: banco de dados, IPC, APIs, segurança
│   └── preload.js       # Bridge segura entre Electron e React (contextBridge)
├── src/
│   ├── pages/
│   │   ├── AddDiscPage.jsx    # Adicionar / editar título (OCR, busca, formulário)
│   │   ├── CatalogPage.jsx    # Catálogo com filtros e exportação
│   │   └── SettingsPage.jsx   # Configuração das chaves de API
│   └── components/
│       ├── Sidebar.jsx         # Navegação lateral com coleções
│       ├── DiscCard.jsx        # Card do título (grade e lista)
│       └── DiscDetailModal.jsx # Modal de detalhes
├── colecao.html           # Página standalone para publicar no site
├── dev-runner.js          # Script de desenvolvimento com detecção automática de porta
└── package.json
```

---

## Licença

GPL-3.0-or-later — © Ednelson Santos
