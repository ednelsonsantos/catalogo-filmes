# Meu Catálogo

Aplicativo desktop para catalogar sua coleção pessoal de filmes, séries, documentários e outros conteúdos em DVD, Blu-ray, 4K UHD e mais. Desenvolvido com Electron + React.

---

## Funcionalidades

- **Tela de carregamento** com logo animado ao iniciar o aplicativo
- **Adicionar títulos** por foto da capa (OCR local), busca por título ou preenchimento manual
- **OCR local** via Tesseract.js — lê o texto da capa sem internet e sem conta
- **Busca automática** em OMDb e TMDB simultaneamente — retorna título em PT-BR, sinopse, elenco, nota IMDb, pôster e categoria
- **Categorias automáticas** — Filme, Série, Mini-série, Documentário, Animação, etc. preenchidas direto da API
- **Coleções** — agrupe títulos em coleções personalizadas com filtro na sidebar; ordenação por A–Z, mais títulos ou mais recente
- **Múltiplos formatos** por título — DVD, Blu-ray, 4K UHD, VHS, Digital
- **Marcar como assistido** com ou sem data, diretamente no card sem abrir o modal
- **Catálogo** com visualização em grade ou lista, filtros por formato, categoria e busca por texto (Ctrl+F)
- **Pôster fallback** — títulos sem imagem exibem fundo colorido único com iniciais, gerado a partir do título
- **Estatísticas** — barra com totais por formato, % assistidos e último título adicionado; dropdown de categorias com contagem
- **Exportar** coleção para CSV, Excel ou JSON — exporta tudo ou apenas a coleção selecionada na sidebar
- **Banco de dados local** SQLite — seus dados ficam no computador, sem nuvem
- **Ícone personalizado** — logo do app no instalador, atalhos e barra de tarefas
- **MyAnimeList integrado** — conecte sua conta MAL via OAuth2 PKCE, carregue sua lista de animes, edite status/nota/episódios e sincronize de volta ao site
- **Lista de animes persistente** — cache em disco, carregada automaticamente ao abrir o app sem precisar recarregar do MAL
- **Pôsteres de animes offline** — baixados para disco na primeira carga e exibidos sem depender de URLs externas (funciona no executável empacotado)
- **Busca e adição de animes** — pesquise na API do MAL e adicione diretamente à sua lista com status, nota e episódios
- **Detecção de duplicatas** — ao buscar filmes ou animes já presentes na coleção, exibe badge "Já na coleção / Já na lista" com informações do item existente
- **Visualização em lista para animes** — alterne entre grade e lista com ordenação por título, score MAL, minha nota, ano ou episódios
- **Exportar animes para JSON** — exporta a lista filtrada para uso no site pessoal

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
- **SQL parametrizado** — queries de exportação filtradas por ID usam placeholders `?` para prevenir injeção

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Interface | React 18 + Vite 5 |
| Desktop | Electron 32 |
| Banco de dados | better-sqlite3 (SQLite local) |
| OCR | Tesseract.js 5 (local, sem internet) |
| Metadados | OMDb API + TMDB API |
| Animes | MyAnimeList API v2 (OAuth2 PKCE) |
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

### MyAnimeList API

Permite carregar, editar e sincronizar sua lista de animes diretamente do MAL. Requer apenas um Client ID (sem Client Secret).

**Como configurar:**
1. Acesse [myanimelist.net/apiconfig](https://myanimelist.net/apiconfig) e clique em **Create ID**
2. Escolha o tipo **other** e preencha `http://localhost:7813` como **App Redirect URL**
3. Copie o **Client ID** gerado
4. Cole em **Configurações → MyAnimeList Client ID** e clique em Salvar
5. Na página Animes, clique em **Conectar ao MAL** e autorize no navegador

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

### Testes

A suite de testes (Jest) cobre validações de segurança do processo principal e não é incluída no repositório. Para rodar localmente:

```bash
npm test
```

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
│   │   ├── AddDiscPage.jsx    # Adicionar / editar título e animes (OCR, busca, formulário)
│   │   ├── AnimePage.jsx      # Lista de animes MAL com grade/lista, edição e exportação
│   │   ├── CatalogPage.jsx    # Catálogo com filtros, estatísticas e exportação
│   │   └── SettingsPage.jsx   # Configuração das chaves de API e MAL Client ID
│   └── components/
│       ├── Sidebar.jsx         # Navegação lateral com coleções, ordenação e badge animes
│       ├── DiscCard.jsx        # Card do título (grade e lista) com toggle assistido
│       └── DiscDetailModal.jsx # Modal de detalhes
├── colecao.html           # Página standalone para publicar no site
├── dev-runner.js          # Script de desenvolvimento com detecção automática de porta
└── package.json
```

---

## Licença

GPL-3.0-or-later — © Ednelson Santos
