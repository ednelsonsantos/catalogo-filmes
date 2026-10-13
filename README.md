# Meu Catálogo

Aplicativo desktop para catalogar sua coleção pessoal de filmes, séries, documentários e outros conteúdos em DVD, Blu-ray, 4K UHD e mais. Desenvolvido com Electron + React.

---

## Funcionalidades

- **Tela de carregamento** com logo animado ao iniciar o aplicativo
- **Adicionar títulos** por foto da capa (OCR local), busca por título ou preenchimento manual
- **OCR local** via Tesseract.js — lê o texto da capa sem internet e sem conta
- **Busca automática** em OMDb e TMDB simultaneamente — retorna título em PT-BR, sinopse, elenco, nota IMDb, pôster e categoria
- **Categorias automáticas** — Filme, Série, Mini-série, Documentário, Animação, etc. preenchidas direto da API
- **Coleções** — agrupe títulos em coleções personalizadas com filtro na sidebar; ordenação por A–Z, mais títulos ou mais recente; crie uma nova coleção direto no formulário de adicionar/editar, sem precisar ir até a sidebar
- **Tags livres** — marcação adicional à categoria, sem lista fixa (ex: "natal", "maratona"); crie direto no formulário (sem duplicar por maiúscula/minúscula), remova pelo ✕ no chip, com filtro por tag no catálogo
- **Múltiplos formatos** por título — DVD, Blu-ray, 4K UHD, VHS, Digital; nenhum vem marcado por padrão, você escolhe o que tem
- **Categoria obrigatória** — Filme, Série, Mini-série, Documentário, Animação, Anime, Show/Stand-up, Musical, Esporte, Streaming, Outro; o app avisa se tentar salvar sem selecionar uma
- **Nota pessoal** (0–10), separada da nota do IMDb — exibida no modal de detalhes e disponível como opção de ordenação no catálogo
- **Marcar como assistido** com ou sem data, diretamente no card sem abrir o modal
- **Status "Assistindo"** para Série, Mini-série, Anime e Animação — contador próprio nas estatísticas; marcar como assistido encerra automaticamente o "assistindo" (e vice-versa), sem contar nos dois ao mesmo tempo
- **Acompanhamento de episódios** — para séries/animes buscados pela TMDB (categoria Série, Mini-série, Anime ou Animação): marque episódios individualmente por temporada, use "até aqui" pra marcar várias de uma vez, veja quantos faltam, o episódio atual/próximo com data, e um badge "🆕" no card quando sai um episódio novo. Marcar "Assistido" sincroniza automaticamente todos os episódios já lançados; ao adicionar um título novo já marcando "Assistindo", um seletor deixa escolher em qual temporada/episódio você está. Um botão no catálogo atualiza os contadores de todas as séries/animes de uma vez. Nos animes do MAL, mostra o dia/horário de exibição semanal e quantos episódios faltam (sem duplicar o controle que já é sincronizado com a conta do MAL)
- **Confirmação ao remover** — modal próprio (não o alerta genérico do navegador) pede confirmação antes de remover qualquer título, citando o nome pra evitar remoção acidental
- **Painel "Continuando"** — aba que reúne tudo que está "Assistindo" (séries e animes) com o próximo episódio sugerido e um botão "✓ Visto" pra marcar sem abrir mais nada; inclui "📅 Lançamentos da semana" com a data dos próximos episódios de tudo que você acompanha. O app abre direto nessa tela quando há algo em andamento
- **Notificação nativa + nova temporada** — avisa episódios que saem hoje e quando uma série marcada "Assistido" ganhou episódios novos (notificação + badge no card). Confere ao abrir, a cada 30 minutos e ao voltar pra janela, sem repetir o mesmo aviso; os episódios das séries acompanhadas são atualizados sozinhos uma vez por dia
- **Segundo plano** — opção de continuar rodando na bandeja ao fechar a janela (pra seguir avisando) e de iniciar com o Windows já minimizado; clicar num aviso traz a janela de volta
- **Aviso de vínculo quebrado com a TMDB** — se o ID salvo de um título não existir mais (a TMDB ocasionalmente mescla/remove entradas duplicadas), o app avisa quais títulos precisam ser re-adicionados em vez de mostrar silenciosamente "0 episódios"
- **Aviso de ambiguidade na busca** — quando a busca retorna títulos muito parecidos, um aviso lembra de conferir o ano/pôster antes de escolher
- **Onde assistir** — logos dos serviços de streaming por assinatura (Netflix, Globoplay, Prime Video...) disponíveis no Brasil, no card (grade e lista) e no modal de detalhes, via TMDB; filtro no catálogo por serviço, "em algum streaming" ou "em nenhum". Fica guardado no banco e é atualizado em segundo plano uma vez por semana
- **Catálogo** com visualização em grade ou lista, busca por texto (Ctrl+F) e filtros combináveis: **formato** (DVD/Blu-ray/4K UHD/VHS/Digital — o que você possui), **status** (Assistidos/Assistindo), **categoria** e **tag** — dá pra combinar, ex: só os Blu-rays já assistidos com a tag "maratona"
- **Pôster fallback** — títulos sem imagem exibem fundo colorido único com iniciais, gerado a partir do título
- **Estatísticas** — barra com totais por formato, % assistidos e último título adicionado; dropdown de categorias com contagem
- **Tela de Estatísticas** — totais, horas assistidas (filmes + episódios de séries), episódios vistos, nota média, gêneros mais frequentes, categorias, formatos, décadas, distribuição das suas notas, séries em andamento com progresso, resumo dos animes do MAL e atividade dos últimos 12 meses
- **Exportar** coleção para CSV, Excel ou JSON — exporta tudo ou apenas a coleção selecionada na sidebar
- **Importar lista** — botão "Importar" no catálogo aceita a exportação do **Letterboxd** (watched, diary, ratings, watchlist), do **IMDb** (ratings, watchlist), o CSV/Excel exportado pelo próprio app ou qualquer planilha com coluna de título. Mostra uma prévia (o que é novo e o que já está na coleção), converte estrelas do Letterboxd em nota 0–10, usa a data de quando assistiu e, opcionalmente, completa cada título com os dados da TMDB (pelo código do IMDb quando existe)
- **Banco de dados local** SQLite — seus dados ficam no computador, sem nuvem
- **Backup e restauração** — um clique em Configurações empacota banco de dados, capas, pôsteres de anime, cache e chaves de API num único `.zip`; restaurar substitui tudo e recarrega o app com os dados do backup
- **Ícone personalizado** — logo do app no instalador, atalhos e barra de tarefas
- **Atualização automática** — ao abrir, o app procura uma versão nova nos releases do GitHub, baixa em segundo plano e oferece "Reiniciar e atualizar" (ou instala sozinho ao fechar); em Configurações dá pra ver a versão instalada e verificar na hora
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

#### Testes de interface (Playwright + Electron)

Ficam em `e2e/` e abrem o app de verdade, clicando na interface como um usuário: catálogo, ordenação, tags, episódios ("até aqui" / "Próximo a assistir"), detalhes ("Onde assistir"), backup e restauração (os diálogos nativos de arquivo são simulados no processo principal).

```bash
npm run test:ui
```

- Cada teste roda com uma **pasta de dados temporária** (`CATALOGO_USER_DATA`, só aceita fora do app empacotado), apagada no fim — o catálogo real nunca é tocado
- Os testes de episódios e detalhes usam a API da TMDB: a chave vem da variável `TMDB_API_KEY` ou da configuração local do app; sem chave, eles são pulados
- Rode antes de gerar um instalador

### Build para distribuição

```bash
npm run build
```

O instalador Windows (`.exe`) é gerado na pasta `dist-electron/`.

### Publicar uma versão (atualização automática)

Os apps instalados se atualizam a partir dos **releases do GitHub** deste repositório. Uma vez só, salve um token do GitHub (fine-grained, só este repositório, permissão **Contents: Read and write**) no seu usuário do Windows:

```powershell
setx GH_TOKEN 'github_pat_...'
```

Depois, cada publicação é um comando:

```bash
npm run publicar -- patch     # correção de bug        (1.11.0 → 1.11.1)
npm run publicar -- minor     # melhoria/funcionalidade (1.11.0 → 1.12.0)
npm run publicar -- major     # quebra compatibilidade  (1.11.0 → 2.0.0)
npm run publicar -- minor --simular   # só confere, sem publicar nada
```

O comando (`scripts/publicar.js`): lê o `GH_TOKEN` (do terminal ou, se o terminal foi aberto antes do `setx`, direto do usuário do Windows — o valor nunca é impresso) → exige o código sem alterações pendentes → sobe a versão e confere que é maior que a publicada → roda `npm run test:ui` (se falhar, desfaz a versão e para) → commit "Versão X" + push → compila e envia instalador, `.blockmap` e `latest.yml` → publica o release → limpa `dist-electron` deixando só o instalador novo.

---

## Estrutura do projeto

```
catalogo-filmes/
├── electron/
│   ├── main.js          # Processo principal: banco de dados, IPC, APIs, segurança
│   └── preload.js       # Bridge segura entre Electron e React (contextBridge)
├── src/
│   ├── pages/
│   │   ├── AddDiscPage.jsx    # Adicionar / editar título: estado, busca, OCR e salvar (monta os componentes de components/add)
│   │   ├── AnimePage.jsx      # Lista de animes MAL com grade/lista, edição e exportação
│   │   ├── CatalogPage.jsx    # Catálogo com filtros, estatísticas e exportação
│   │   ├── ContinuePage.jsx   # Painel "Continuando" — continue assistindo + lançamentos da semana
│   │   └── SettingsPage.jsx   # Configuração das chaves de API e MAL Client ID
│   └── components/
│       ├── Sidebar.jsx         # Navegação lateral com coleções, ordenação e badge animes
│       ├── DiscCard.jsx        # Card do título (grade e lista) com toggle assistido
│       ├── DiscDetailModal.jsx # Modal de detalhes
│       ├── EpisodesPanel.jsx   # Acompanhamento de episódios por temporada (TMDB)
│       ├── ConfirmModal.jsx    # Modal de confirmação genérico (ex: remover título)
│       └── add/                # Partes do formulário de adicionar/editar
│           ├── CoverPicker.jsx        # Capa (clique/arraste) + status do OCR
│           ├── TitleSearchPanel.jsx   # Busca OMDb/TMDB, resultados, avisos de duplicata/ambiguidade
│           ├── FormFields.jsx         # Campos do título (nome, ano, notas, elenco...)
│           ├── ProgressSelector.jsx   # "Próximo a assistir" (temporada/episódio)
│           ├── CollectionsPicker.jsx  # Coleções com criação na hora
│           ├── TagsPicker.jsx         # Tags com criação e remoção
│           ├── AnimeSearchSection.jsx # Aba "Adicionar Anime" (busca no MAL)
│           └── AnimeAddModal.jsx      # Status/nota/episódios ao adicionar anime no MAL
│   └── utils/
│       ├── titleMappers.js     # Converte respostas OMDb/TMDB no formato do app
│       └── ocr.js              # OCR local da capa (Tesseract) e leitura de arquivo
├── e2e/                   # Testes de interface (Playwright) — npm run test:ui
├── colecao.html           # Página standalone para publicar no site
├── dev-runner.js          # Script de desenvolvimento com detecção automática de porta
└── package.json
```

---

## Licença

GPL-3.0-or-later — © Ednelson Santos
