# Roadmap — Meu Catálogo

Todas as fases do roadmap inicial foram implementadas. O histórico está preservado abaixo com o status de cada item.

---

## Fase 1 — Polimento da UI ✓ concluída

### 1.1 Total de resultados filtrados ✓
"Exibindo 8 de 47 títulos" abaixo da toolbar quando há filtro ativo.

### 1.2 Limpar filtros com um clique ✓
Botão "✕ Limpar filtros" visível apenas quando há filtro ativo; reseta busca, formato e categoria de uma vez.

### 1.3 Atalho de teclado Ctrl+F ✓
Foca no campo de busca do catálogo.

### 1.4 Feedback visual ao salvar configurações ✓
Botão muda para "✓ Salvo" por 2 s após o clique.

---

## Fase 2 — Catálogo mais informativo ✓ concluída

### 2.1 Contagem por categoria no dropdown ✓
Dropdown exibe `Filme (12)`, `Série (3)`, etc. Categorias sem títulos aparecem sem número.

### 2.2 Painel de estatísticas ✓
Stats bar com total, Blu-ray, 4K UHD (condicional), DVD, assistidos com %, e último título adicionado.

### 2.3 Pôster fallback com cor por título ✓
Títulos sem pôster nem capa mostram fundo colorido único derivado do hash do título, com iniciais em destaque.

---

## Fase 3 — Interações rápidas ✓ concluída

### 3.1 Toggle "assistido" direto no card ✓
Botão ✓ no card marca/desmarca assistido sem abrir o modal de edição.
- No modo grade: aparece ao hover, fica visível e verde quando assistido
- No modo lista: sempre visível
- Atualiza estado local imediatamente sem recarregar toda a coleção

### 3.2 Ordenar coleções na sidebar ✓
Select discreto ao lado do botão "+" quando há mais de uma coleção. Opções: A–Z, Mais títulos, Mais recente.

---

## Fase 4 — Exportação avançada ✓ concluída

### 4.1 Exportar coleção específica ✓
Com uma coleção ativa na sidebar, os botões CSV / Excel / Site exportam apenas os títulos dela.
- Indicador `↳ Nome da Coleção` aparece ao lado dos botões quando o escopo está restrito
- Query usa `IN (?, ?, ...)` parametrizado com validação de IDs no processo principal
- Sem coleção selecionada o comportamento é idêntico ao anterior (exporta tudo)

---

## Resultado

| # | Fase | Item | Status |
|---|---|---|---|
| 1 | 1.1 | Total de resultados filtrados | ✓ |
| 2 | 1.2 | Limpar filtros | ✓ |
| 3 | 1.3 | Atalho Ctrl+F | ✓ |
| 4 | 1.4 | Feedback salvar configurações | ✓ |
| 5 | 2.1 | Contagem por categoria | ✓ |
| 6 | 2.2 | Painel de estatísticas | ✓ |
| 7 | 2.3 | Pôster fallback com cor | ✓ |
| 8 | 3.1 | Toggle assistido no card | ✓ |
| 9 | 3.2 | Ordenar coleções | ✓ |
| 10 | 4.1 | Exportar coleção específica | ✓ |

---

---

## Fase 5 — MyAnimeList ✓ concluída

### 5.1 OAuth2 PKCE com MAL ✓
Autenticação via servidor local `http://localhost:7813` — MAL não aceita custom schemes. Fluxo PKCE com `plain` challenge, sem Client Secret.

### 5.2 Carregar lista de animes ✓
Busca paralela por status (watching, completed, on_hold, dropped, plan_to_watch), exibição progressiva com pôsteres baixados em lotes de 10.

### 5.3 Editar e sincronizar com o MAL ✓
Modal com status, nota (0–10) e episódios vistos. PATCH via `fetch` nativo com campo correto `num_watched_episodes`.

### 5.4 Persistência em disco ✓
Cache em `userData/mal-cache.json` carregado ao iniciar o app. Pôsteres salvos em `userData/mal-posters/` como `data:` URI para funcionar no executável empacotado (contorna CSP).

### 5.5 Busca e adição de animes ✓
Aba "Adicionar Anime" dentro da página de adicionar título, com busca na API MAL e modal de status/nota/episódios. Detecção de duplicatas com badge "Já na lista" e card de aviso com status atual.

### 5.6 Visualização em lista ✓
Toolbar com toggle grade/lista e select de ordenação (A→Z, score MAL, minha nota, ano, episódios). Linha de lista com thumbnail, título alternativo, episódios, score MAL e badge de status colorido.

### 5.7 Exportar JSON de animes ✓
Exporta a lista filtrada para JSON — campo `ongoing: true` para séries sem total de episódios (ex: One Piece).

---

## Fase 6 — Correções e polimento ✓ concluída

### 6.1 Botão Cancelar em "Adicionar" ✓
Resetava o estado mas não existia na aba Anime. Corrigido: `handleCancel` limpa todo o estado local e navega para o catálogo; aba Anime recebe o botão via prop `onCancel`.

### 6.2 Terminal VSCode travado após fechar app em dev ✓
`http.createServer` do OAuth ficava com `listen` ativo quando o fluxo não era concluído. Corrigido com `app.on('before-quit')` no Electron. Causa raiz no `dev-runner.js`: `proc.kill()` envia SIGTERM que no Windows é ignorado. Solução: `cmd /c npx vite` + `shell: false` para obter PID real via `wmic`, e `taskkill /pid /f /t` para matar a árvore de processos.

---

## Resultado completo

| # | Fase | Item | Status |
|---|---|---|---|
| 1 | 1.1 | Total de resultados filtrados | ✓ |
| 2 | 1.2 | Limpar filtros | ✓ |
| 3 | 1.3 | Atalho Ctrl+F | ✓ |
| 4 | 1.4 | Feedback salvar configurações | ✓ |
| 5 | 2.1 | Contagem por categoria | ✓ |
| 6 | 2.2 | Painel de estatísticas | ✓ |
| 7 | 2.3 | Pôster fallback com cor | ✓ |
| 8 | 3.1 | Toggle assistido no card | ✓ |
| 9 | 3.2 | Ordenar coleções | ✓ |
| 10 | 4.1 | Exportar coleção específica | ✓ |
| 11 | 5.1 | OAuth2 PKCE MAL | ✓ |
| 12 | 5.2 | Carregar lista de animes | ✓ |
| 13 | 5.3 | Editar e sincronizar com MAL | ✓ |
| 14 | 5.4 | Persistência em disco (cache + pôsteres) | ✓ |
| 15 | 5.5 | Busca e adição com detecção de duplicatas | ✓ |
| 16 | 5.6 | Visualização em lista com ordenação | ✓ |
| 17 | 5.7 | Exportar JSON de animes | ✓ |
| 18 | 6.1 | Botão Cancelar funcional | ✓ |
| 19 | 6.2 | Terminal não trava após fechar em dev | ✓ |

---

## Fase 7 — Status "Assistindo" e coleções no formulário ✓ concluída

### 7.1 Formatos ("Tenho em") sem marcação forçada ✓
Nenhuma caixa (DVD, Blu-ray, 4K UHD, VHS, Digital) vem marcada por padrão ao buscar ou criar um título — antes "DVD" vinha marcado automaticamente. Corrigido também o bug que impedia desmarcar a última opção selecionada (o campo `format` era reposto com o valor clicado em vez de ficar vazio).

### 7.2 Categoria obrigatória e nova opção "Streaming" ✓
Salvar sem categoria selecionada mostra aviso e bloqueia o salvamento. Adicionada a categoria **Streaming** à lista.

### 7.3 Status "Assistindo" para séries e animes ✓
Novo checkbox "▶ Assistindo" ao lado de "✓ Assistido", visível para as categorias Série, Mini-série, Anime e Animação. Campo `watching` persistido no banco (migração automática). Badge exibido nos cards (grade/lista) e no modal de detalhes.

### 7.4 Contador e exclusividade mútua entre "Assistindo" e "Assistido" ✓
Novo filtro "▶ Assistindo" e contador próprio na barra de estatísticas do catálogo. Marcar algo como assistido (pelo card ou pelo formulário) desliga automaticamente o "assistindo", e vice-versa — o item nunca é contado nos dois ao mesmo tempo.

### 7.5 Criar coleção direto no formulário ✓
Botão "+ Nova" na seção "Coleções" do formulário de adicionar/editar — cria e nomeia uma coleção sem precisar ir até a sidebar. Lista sempre em ordem alfabética (já ordenada pela consulta no banco).

### 7.6 Correções pós-revisão ✓
Revisão item a item encontrou duas lacunas da Fase 7 que não tinham sido pegas:
- `CatalogPage.jsx` tinha sua própria lista de categorias (separada da do formulário) e não incluía "Streaming" — dava pra salvar um título nessa categoria, mas não pra filtrar por ela no catálogo.
- O aviso de duplicata (ao buscar um título já existente na coleção) mostrava "· Assistido" mas nunca "· Assistindo", mesmo quando era o caso.

---

## Resultado — Fase 7

| # | Item | Status |
|---|---|---|
| 1 | 7.1 | Formatos sem marcação forçada + fix de desmarcar tudo | ✓ |
| 2 | 7.2 | Categoria obrigatória + "Streaming" | ✓ |
| 3 | 7.3 | Status "Assistindo" para séries/animes | ✓ |
| 4 | 7.4 | Contador + exclusividade mútua assistindo/assistido | ✓ |
| 5 | 7.5 | Criar coleção no formulário | ✓ |
| 6 | 7.6 | Correções pós-revisão (categoria no filtro + aviso de duplicata) | ✓ |

---

## Fase 8 — Acompanhamento de episódios ✓ concluída

Antes o app só sabia se uma série estava "Assistida" ou "Assistindo" como um todo — não sabia em qual episódio você estava, nem quantos faltavam, nem quando saía o próximo. Agora usa os dados que a TMDB e o MAL já fornecem.

### 8.1 Banco de dados ✓
- Nova tabela `episodios_assistidos` — guarda só o que foi marcado, não a lista inteira (que vem da TMDB sob demanda)
- Novas colunas em `filmes` (cache leve, evita bater na API toda hora): `episodes_aired`, `next_episode_air_date`, `last_episode_check`. `episodes_watched_count` é calculado on-the-fly por subquery em `db:getAll`, não fica cacheado (evita ficar desatualizado)

### 8.2 Electron / IPC ✓
- `tmdb:tvSeasonDetails` — `GET /tv/{id}/season/{season_number}`, retorna episódios (número, nome, data de exibição)
- `episodes:getWatched` / `episodes:setWatched` / `episodes:setWatchedBulk` — lê/grava o progresso local por episódio (bulk usado pelo "marcar até aqui")
- `episodes:refresh` — busca `next_episode_to_air` / `last_episode_to_air` / `seasons` na TMDB, calcula quantos episódios já foram ao ar e atualiza os contadores cacheados em `filmes`

### 8.3 Interface (séries/TMDB) ✓
- Nova seção "Episódios" no modal de detalhes (`EpisodesPanel.jsx`, usado por `DiscDetailModal.jsx`), visível quando o título tem `tmdb_id` e categoria Série/Mini-série/Anime/Animação
  - Acordeão por temporada, checkbox por episódio; episódios com data futura ficam bloqueados (ainda não foi ao ar)
  - Botão "até aqui" por episódio (marca tudo da temporada até ele)
  - "Próximo episódio: ..." e "faltam N" no topo
- Badge no card do catálogo (grade e lista): "X/Y eps" + 🆕 quando a data do próximo episódio já passou e o contador ainda não foi atualizado
- Botão manual "↻ Atualizar episódios" (chama `episodes:refresh` sob demanda — consultar a TMDB pra cada série a cada abertura do app seria caro e exigiria internet sempre)

### 8.4 Animes (MAL) ✓ — ajustado para incluir acompanhamento, sem precisar de API nova
Diferente das séries via TMDB, o MAL já sincroniza um contador único de "episódios assistidos" com a conta do usuário — duplicar isso com checkboxes locais criaria dois sistemas divergentes. Em vez disso:
- Campo `broadcast` (dia da semana + horário) passou a ser pedido na busca e na lista do MAL, exibido como "📅 Toda quarta, 23:00" para animes em exibição (`node.status === 'currently_airing'`)
- "Faltam N episódios" calculado a partir de `num_episodes − num_episodes_watched`, já carregado — badge no card (grade e lista) e no modal de edição, ao lado do contador de episódios assistidos

### 8.5 Sincronização entre "Assistido" e os episódios ✓
Bug encontrado: marcar o checkbox simples "Assistido" (campo `watched_at`, usado por qualquer categoria) não tinha nenhuma ligação com a contagem fina de episódios — dava pra ter um título marcado como assistido e o badge mostrando "0/8 eps".
- `episodes:refresh` ganhou a opção `markAllWatched` — quando ativada, além de recalcular `episodes_aired`, marca todos os episódios já lançados (todas as temporadas anteriores inteiras + a temporada atual até o último episódio) como vistos na tabela `episodios_assistidos`
- Ao marcar "Assistido" pela primeira vez (seja no formulário de adicionar/editar, seja pelo toggle rápido ✓ no card) numa série/anime com `tmdb_id`, o app chama automaticamente essa sincronização
- Botão manual "✓ Marcar tudo assistido" no painel de episódios, pra quem quer sincronizar sem depender do checkbox "Assistido" (ex: título antigo já marcado como assistido antes da Fase 8 existir)
- Desmarcar "Assistido" **não** reseta os episódios já marcados — evita perda de progresso por engano

### 8.6 Correção: sincronização não disparava ao editar um item já assistido ✓
A detecção de "acabou de marcar Assistido" comparava com o estado de quando a tela de edição abriu (`editFilme.watched_at`). Se o título já estava marcado antes de abrir a edição, desmarcar e marcar de novo dentro da mesma sessão não contava como "mudança" e a sincronização não disparava — só funcionava clicando no botão manual.
- Agora o próprio clique no checkbox "Assistido" (e a escolha de uma data no campo "Assistido em") marcam um sinalizador local (`watchedJustChecked`), usado no save em vez do snapshot antigo
- Ao desmarcar "Assistido", a data anterior é guardada em memória durante a sessão de edição — marcar de novo restaura a mesma data em vez de trocar por um "assistido" genérico sem data

### 8.7 Correção: painel de episódios não encontrava temporadas ✓
Bug: `tmdb_id` é salvo como texto no banco, mas a validação de ID em `tmdb:tvDetails`/`tmdb:tvSeasonDetails` exige número (`Number.isInteger`). Toda busca de temporadas feita a partir de um título já salvo (`EpisodesPanel.jsx`) falhava silenciosamente e caía no "Nenhuma temporada encontrada" — mesmo com a chave TMDB configurada e o título correto. Corrigido convertendo o ID pra número antes de chamar esses dois endpoints.
- Aproveitado o mesmo fetch pra mostrar "📺 Episódio atual" (último exibido) e "📅 Próximo" com temporada, número e data — igual a página da própria TMDB mostra

---

## Resultado — Fase 8

| # | Item | Status |
|---|---|---|
| 1 | 8.1 | Tabela `episodios_assistidos` + colunas de cache em `filmes` | ✓ |
| 2 | 8.2 | Endpoints `tmdb:tvSeasonDetails` + `episodes:*` | ✓ |
| 3 | 8.3 | Aba "Episódios" no modal + badge no card + botão de atualizar | ✓ |
| 4 | 8.4 | Broadcast + "faltam N" para animes (MAL) | ✓ |
| 5 | 8.5 | Sincronização "Assistido" ↔ episódios + botão "Marcar tudo assistido" | ✓ |
| 6 | 8.6 | Fix: sincronização não disparava ao reeditar item já assistido | ✓ |
| 7 | 8.7 | Fix: ID de TMDB como string travava busca de temporadas + episódio atual/próximo | ✓ |

---

## Fase 9 — Confirmação ao remover título ✓ concluída

### 9.1 Modal de confirmação em vez do `confirm()` nativo ✓
O botão "Remover" (no card e no modal de detalhes) usava `window.confirm()`, um alerta genérico do navegador, fora do estilo do app. Criado `ConfirmModal.jsx`, um modal próprio (mesma linguagem visual do app) com título, mensagem citando o nome do título e botões "Cancelar"/"Remover" — usado pelos dois pontos de remoção (card e modal de detalhes) através do mesmo `handleDelete` em `CatalogPage.jsx`.

---

## Fase 10 — Episódios na tela de editar + atualização em massa ✓ concluída

### 10.1 Painel de episódios também na tela de editar ✓
O painel "Episódios" só existia no modal de detalhes (`DiscDetailModal.jsx`) — não aparecia na tela de adicionar/editar (`AddDiscPage.jsx`), que é a mesma tela usada tanto pra criar um título novo quanto pra editar um existente. Adicionado o `EpisodesPanel` também ali, visível quando `isEditing` (precisa existir no banco pra ter onde salvar o progresso) e o título tem `tmdb_id` numa categoria seriada.
- Em um título **novo** (ainda sem salvar), o painel não aparece — não tem como guardar episódios de algo que não existe no banco ainda. Fica disponível depois de salvar, reabrindo pra editar.
- Atualizações feitas pelo painel dentro da tela de editar atualizam só os campos de episódio no formulário local, sem sobrescrever o resto dos campos que você possa estar editando ao mesmo tempo.

### 10.2 Atualização em massa pra todo o catálogo ✓
Como a Fase 8 foi adicionada depois que vários títulos já estavam cadastrados, nenhum deles tinha `episodes_aired` calculado — o badge de progresso só aparecia depois de abrir cada um individualmente e clicar em "Atualizar episódios". Criado um botão **"↻ Atualizar episódios (N)"** na barra de exportação do catálogo, que varre todas as séries/animes com `tmdb_id` e roda a atualização (sem marcar nada como assistido) em sequência, com contador de progresso "Atualizando 3/12…" e aviso de quantos tiveram sucesso/falha ao final.

### 10.3 Detecção de ID da TMDB inválido/removido ✓
Investigando o caso do Smallville: o `tmdb_id` salvo (1154663) retornava 404 na TMDB — provavelmente um ID antigo que foi mesclado/removido numa limpeza de duplicatas deles (o ID correto da série principal é 4604, "Smallville: As Aventuras do Superboy" em PT-BR). O app tratava essa resposta de erro como "sem temporadas", sem avisar que o vínculo estava quebrado — corrigido:
- `fetchTmdbTvSummary` (usado por `episodes:refresh`) agora detecta `success === false` da TMDB e lança um erro explicativo em vez de silenciosamente calcular 0 episódios
- O painel de episódios mostra um aviso específico "⚠ O ID da TMDB salvo para este título não existe mais" em vez do genérico "Nenhuma temporada encontrada"
- A atualização em massa agora relata **pelo nome** quais títulos têm ID inválido, em vez de só contar quantos falharam
- Corrigido manualmente o registro do Smallville no banco com o ID certo (4604)

### 10.4 Correção: marcar episódio não atualizava o badge do card em tempo real ✓
Marcar um episódio (ou usar "até aqui") sempre gravava certo no banco na hora — mas o contador "X/Y eps" do card só se atualizava depois de um recarregamento completo (ex: salvar o formulário de edição). Isso dava a impressão de que marcar direto no modal de detalhes "não salvava nada", quando na verdade salvava — só a tela não sabia disso ainda.
- `toggleEpisode` e `markUpTo` agora notificam o componente pai (`onUpdated`) com a nova contagem assim que marcam um episódio, sem precisar de um refresh completo — o badge no card atualiza no mesmo instante, direto do modal de detalhes ou da tela de editar

### 10.5 Seletor de progresso ao adicionar + episódios já populados em títulos novos ✓
O painel completo de episódios exige um `id` no banco (a tabela `episodios_assistidos` referencia `filme_id`) — por isso nunca apareceu ao *adicionar* (o item só existe depois de salvar). Resolvido com um mecanismo mais leve:
- Backend: `fetchTmdbTvSummary` separado em duas partes — contagem real de episódios no ar (`episodesAired`, sempre fiel à TMDB) e `pairsUpTo(seasons, temporada, episódio)`, que gera a lista de episódios a marcar até qualquer ponto escolhido (não só até o último lançado)
- Novo endpoint `episodes:markProgress` — marca tudo até a temporada/episódio informados
- Ao marcar **"▶ Assistindo"** durante a adição de uma série/anime com TMDB, aparece um seletor **"Estou em: Temporada [x] Ep [y]"**; ao salvar, marca tudo até ali de uma vez
- Qualquer série/anime novo com TMDB, mesmo sem marcar Assistindo/Assistido, já sai do salvamento com `episodes_aired` calculado — o badge "X/Y eps" aparece direto no card sem precisar abrir e clicar em "Atualizar episódios" manualmente
- Esse seletor só aparece ao **adicionar** (`!isEditing`) — ao editar, o painel completo de episódios (com checkbox por episódio) já cobre esse caso com mais precisão

---

## Backlog de ideias (não detalhadas ainda)

- **⚠ Risco encontrado na revisão (não é bug ativo hoje):** a categoria "Animação" é tratada como "série" pra fins de episódios (`SERIES_CATEGORIES`), mas também é usada pra filmes de animação avulsos (ex: "Demon Slayer: Mugen Train - O Filme" no catálogo atual). Hoje não quebra nada porque esse filme específico não tem `tmdb_id` salvo — mas se algum dia um filme de animação for adicionado com `tmdb_id` de **filme** (não de série), o painel de episódios tentaria buscar `/tv/{id}` com um ID que pertence ao namespace de filmes da TMDB, podendo trazer dados de uma série completamente diferente (sem erro, já que o ID "existe", só que pra outra coisa). Precisa de um campo extra (`tmdb_media_type: 'movie'|'tv'`) pra diferenciar com segurança — adiado por exigir migração de schema.
- **Onde assistir** — badge com os serviços de streaming (Netflix, Prime Video...) via `/tv|movie/{id}/watch/providers` da TMDB. *Nota: isso é só exibir informação, diferente de "integração com serviços de streaming" citado abaixo em Fora do escopo, que seria reprodução/sincronização real.*
- **Backup completo** — exportar/importar `catalogo.db` + capas num `.zip` (hoje só dá pra exportar CSV/Excel/JSON, que perdem capas e não voltam pro app)
- **Nota pessoal** separada da nota IMDb, igual já existe pra anime via MAL
- **Detecção de nova temporada** em séries já marcadas "Assistido"
- **Notificação nativa do Windows** quando um episódio novo sai
- **Tags livres** além da categoria fixa, com filtro por tag

---

## Fora do escopo

- Sincronização em nuvem
- Compartilhamento entre dispositivos
- Integração com serviços de streaming (reprodução/sincronização de progresso direto na plataforma)
- Scanner de código de barras
