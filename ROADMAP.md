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

### 10.6 Correção: badge "0/N eps" em séries antigas já "Assistindo" (v1.1.1) ✓
Séries marcadas "Assistindo" antes da Fase 8 existir não têm nenhum episódio marcado individualmente — o contador correto mostra "0 vistos" porque o app genuinamente não sabe até onde você chegou. Pra corrigir isso rápido sem precisar abrir temporada por temporada no painel completo:
- O seletor "Estou em: Temporada X, Ep Y" (criado em 10.5 só pra adicionar) passou a aparecer **também ao editar** um título com "Assistindo" marcado
- Ao editar, mudar o seletor mostra o aviso "marca tudo até aqui ao salvar" e aplica a marcação em lote (`episodes:markProgress`) ao clicar em "Salvar alterações"

### 10.7 Correção: badge "0/N eps" em títulos já "Assistido" (v1.1.2) ✓
Diagnosticado com dados reais do banco: itens em "Assistindo" sincronizavam certo (confirmado — "A Escuta", "Smallville", "Dr. House" já tinham episódios marcados corretamente via o seletor da 10.6). O problema era só em **"Assistido"**: o botão de atualização em massa (10.2) sempre chamava `markAllWatched: false`, então populava `episodes_aired` em todo o catálogo mas nunca marcava nada como visto — mesmo em títulos que já estavam "Assistido" há tempos (ex: "Oz", com 56 episódios aferidos e 0 vistos). Títulos marcados/remarcados como "Assistido" **depois** do fix da 8.5 ficaram corretos (ex: "Ted Lasso" 44/44); os de antes ficaram travados em zero até alguém abrir um por um.
- `handleBulkRefreshEpisodes` agora passa `markAllWatched: !!f.watched_at` — ao rodar a atualização em massa, qualquer título já "Assistido" é automaticamente sincronizado como 100% visto, de uma vez, sem precisar abrir item por item

### 10.8 Causa raiz real do "0" solto no modal de detalhes (v1.1.3) ✓
O usuário mandou print: um "0" aparecia sozinho, sem estilo, entre os badges (categoria/ano/formato) e a linha "✓ Assistido em ...". Não tinha nada a ver com contagem de episódios — era um bug clássico de JSX: `watching` é salvo como `INTEGER` no SQLite (0 ou 1), não booleano. Em `{filme.watching && <div>...</div>}`, quando `watching` é `0`, o React não trata como "falso e não renderiza nada" — `0` é um valor renderizável em React, então ele literalmente imprime o caractere "0" na tela.
- Corrigido em todo lugar que usava `filme.watching &&` (ou `liveFilme.watching &&`) direto num JSX: `DiscDetailModal.jsx`, `DiscCard.jsx` (grade e lista) e o seletor de progresso em `AddDiscPage.jsx` — todos trocados para `!!filme.watching &&`, forçando conversão pra booleano real antes da checagem
- Revisão nos demais campos numéricos (notas do MAL, score) confirmou que já tratavam o zero corretamente (`score > 0 ? valor : null`) — o bug era específico do campo `watching`

---

## Fase 11 — Separação dos filtros de formato e status (v1.2.0) ✓ concluída

### 11.1 Dois eixos independentes no lugar de um grupo único ✓
Os filtros rápidos do catálogo (DVD, Blu-ray, 4K UHD, Assistidos, Assistindo) viviam todos no mesmo grupo de seleção única — misturava **formato** (o que você possui) com **status** (o que já assistiu), dois eixos sem relação entre si. Na prática isso impedia combinar os dois (ex: não dava pra ver só os Blu-rays já assistidos — selecionar um desmarcava o outro).
- Estado `format` (formato) e novo estado `watchStatus` (status) agora são independentes — a lista é filtrada pelos dois juntos (E lógico), não um ou outro
- Dois grupos de botões separados na toolbar, cada um com seu "Todos" próprio
- Adicionados **VHS** e **Digital** à barra de filtro de formato — existiam como opção ao cadastrar mas não tinham botão de filtro rápido
- Blu-ray e 4K UHD continuam como filtros separados (decisão deliberada: para quem coleciona, costumam ser mídias físicas distintas, compradas à parte)

---

## Fase 12 — Continuar assistindo, lançamentos e qualidade de dados (v1.3.0) ✓ concluída

### 12.1 Endpoint `episodes:getNextUp` — próximo episódio não visto ✓
Hoje a tabela `episodios_assistidos` sabe *quais* episódios foram marcados, mas nada calcula qual é o **próximo**. Precisamos disso tanto pro painel "Continuar assistindo" (12.2) quanto pra pré-preencher o seletor de progresso (12.4).

**Backend** (`electron/main.js`):
```js
ipcMain.handle('episodes:getNextUp', async (_, { filmeId, tmdbId }) => {
  if (!isPositiveInt(filmeId)) throw new Error('Invalid filme ID')
  if (!tmdbId) throw new Error('Sem TMDB ID')
  const { seasons, last } = await fetchTmdbTvSummary(tmdbId)
  if (!last) return null // nada foi ao ar ainda
  const watchedRows = db.prepare('SELECT season_number, episode_number FROM episodios_assistidos WHERE filme_id = ?').all(filmeId)
  const watchedBySeason = {}
  for (const r of watchedRows) {
    watchedBySeason[r.season_number] = Math.max(watchedBySeason[r.season_number] || 0, r.episode_number)
  }
  for (const s of seasons) {
    const aired = s.season_number < last.season_number ? (s.episode_count || 0)
      : s.season_number === last.season_number ? last.episode_number : 0
    if (aired === 0) continue
    const watched = watchedBySeason[s.season_number] || 0
    if (watched < aired) return { season: s.season_number, episode: watched + 1, seasonName: s.name }
  }
  return 'caught_up' // viu tudo que já foi ao ar
})
```
Assume visualização sequencial (o próximo não visto é sempre "o último marcado + 1" dentro da temporada) — coerente com o resto do app, que já assume isso no "até aqui".

### 12.2 Painel "Continuar assistindo" + "Lançamentos da semana" ✓
Nova página `ContinuePage.jsx`, acessível por um item novo na sidebar.

**Seção "Continue assistindo":**
- Pra cada `filme` com `watching=1` e `tmdb_id`: chama `episodes:getNextUp`, mostra pôster + título + "Próximo: T{season}E{episode}" + botão "✓ Marcar assistido" (chama `episodes:setWatched` pra esse episódio específico e atualiza a lista)
- Pra cada anime do MAL com `list_status.status === 'watching'`: mostra "Episódio {num_episodes_watched + 1}" (sem chamada extra à API — é só aritmética dos dados já carregados) + botão que incrementa `num_episodes_watched` via `malUpdateAnime`
- Item "em dia" (`getNextUp` retornou `'caught_up'`) não aparece nessa seção

**Seção "📅 Lançamentos da semana":**
- Filtra `filmes` com `watching=1` e `next_episode_air_date` dentro dos próximos 7 dias (campo já existe, populado pelo `episodes:refresh`)
- Pra animes com `status === 'currently_airing'` e `broadcast`, calcula a próxima data a partir do dia da semana (`broadcast.day_of_the_week`) — não precisa de API nova, é cálculo local de data
- Lista ordenada cronologicamente, com pôster + título + data/dia

**Sidebar/navegação:**
- Novo item "▶ Continuando" em `Sidebar.jsx`, entre "Minha Coleção" e "Animes"
- `App.jsx`: o `page` inicial passa a ser `'continue'` automaticamente quando existe pelo menos 1 item elegível (série "Assistindo" ou anime "watching") após o carregamento inicial; senão continua caindo em `'catalog'` como hoje — evita tela vazia pra quem não tem nada em andamento

### 12.3 Relatório de vínculos TMDB quebrados ✓
A atualização em massa (10.2/10.3) já relata IDs inválidos por nome num toast — mas só aparece quando você roda a atualização, e some depois de alguns segundos. Em vez de criar um endpoint novo (a checagem já existe, via o mesmo `episodes:refresh`), a melhoria é só de **interface**:
- Trocar o `showToast` de erro no fim de `handleBulkRefreshEpisodes` (`CatalogPage.jsx`) por um modal de relatório (reaproveita o padrão visual do `ConfirmModal`) listando os títulos com problema, cada um com um botão "Editar" que já abre a tela de edição direto — fica persistente até o usuário fechar, em vez de piscar e sumir

### 12.4 Seletor de progresso pré-preenchido ✓
O seletor "Estou em: Temporada X, Ep Y" (10.5/10.6, em `AddDiscPage.jsx`) sempre começa em T1E1. Ao editar um título que já tem episódios marcados, deveria sugerir o próximo.
- Reaproveita o endpoint novo `episodes:getNextUp` (12.1): ao entrar em modo de edição com `filme.watching` true, chama o endpoint e usa o resultado (se não for `'caught_up'`) pra inicializar `currentSeason`/`currentEpisode`, em vez do padrão fixo 1/1

### 12.5 Aviso de ambiguidade na busca ✓
Pra evitar recorrência do caso do Smallville (ID errado escolhido na busca): em `AddDiscPage.jsx`, ao renderizar os resultados da busca TMDB/OMDb, comparar títulos normalizados (minúsculo, sem acento) entre os resultados — quando 2+ títulos muito parecidos aparecerem, mostrar um aviso "⚠ vários resultados parecidos — confira o ano antes de escolher" acima da lista. Heurística simples, só no cliente, sem chamada nova à API.

### Resultado — Fase 12

| # | Item | Status |
|---|---|---|
| 1 | 12.1 | Endpoint `episodes:getNextUp` | ✓ |
| 2 | 12.2 | Painel "Continuando" (continue assistindo + lançamentos da semana) + nav na sidebar | ✓ |
| 3 | 12.3 | Modal de relatório de vínculos TMDB quebrados | ✓ |
| 4 | 12.4 | Seletor de progresso pré-preenchido com o próximo episódio real | ✓ |
| 5 | 12.5 | Aviso de ambiguidade nos resultados de busca | ✓ |

---

## Fase 13 — Qualidade de dados e proteção (em andamento)

### 13.1 Campo `tmdb_media_type` — distingue filme de série (v1.3.1) ✓
Risco encontrado na revisão da Fase 10: a categoria "Animação" é usada tanto pra séries animadas quanto pra filmes de animação avulsos, mas o acompanhamento de episódios assumia que qualquer item com `tmdb_id` numa categoria seriada era uma série. Se um filme de animação fosse adicionado com `tmdb_id` de **filme** (namespace separado do de série na TMDB), o painel de episódios buscaria `/tv/{id}` com um ID de outra coisa — sem erro, já que o ID "existe", só que pra um título errado.
- Nova coluna `tmdb_media_type` (`'movie'` | `'tv'` | `''`) em `filmes`
- `tmdbToFilme` (busca de filme) seta `'movie'`; `tmdbToFilmeTv` (busca de série) seta `'tv'`; busca via OMDb (sem TMDB) deixa `''`
- **Migração com backfill**: itens já cadastrados com categoria seriada + `tmdb_id` (que só podem ter chegado lá usando a trilha de série) recebem `tmdb_media_type = 'tv'` automaticamente — testado e confirmado: as 11 séries existentes no catálogo preservaram o acompanhamento de episódios sem precisar reeditar nada
- Todo ponto que decide "isso tem episódios" (painel de detalhes, seletor de progresso, atualização em massa, painel "Continuando", sincronização ao marcar Assistido) agora exige `tmdb_media_type === 'tv'`, além da categoria

### 13.2 Backup e restauração completos (v1.4.0) ✓
Tudo no app vive só localmente — sem isso, um disco com defeito leva a coleção toda junto. Novo card "Backup" em Configurações:
- **Fazer backup**: empacota `catalogo.db`, `covers/`, `mal-posters/`, `mal-cache.json` e `settings.json` (inclui as chaves de API) num único `.zip`, escolhido via diálogo nativo "Salvar como"
- Antes de empacotar, força um `PRAGMA wal_checkpoint(TRUNCATE)` — o SQLite roda em modo WAL por padrão, então escritas recentes podem estar só no `.db-wal` e não no `.db` principal ainda; sem o checkpoint o backup podia sair incompleto
- **Restaurar backup**: diálogo nativo "Abrir arquivo", valida que o zip tem um `catalogo.db` dentro, fecha a conexão do banco, extrai tudo por cima do `userData` (sobrescrevendo) reabre o banco e recarrega a janela, pra carregar os dados restaurados do zero
  - *Correção v1.8.1*: a versão original usava `app.relaunch()` + `app.exit()`. No modo dev o `dev-runner.js` interpreta a saída do Electron como fim da sessão e derruba o Vite junto, então o Electron relançado abria uma tela escura travada. Agora tudo acontece no mesmo processo: apaga `-wal`/`-shm` antigos, extrai, zera as chaves em memória, chama `createDatabase()` de novo e dá `webContents.reload()`. Funciona igual em dev e no executável
- Confirmação obrigatória antes de restaurar (reaproveita o `ConfirmModal`), já que substitui tudo sem volta
- Dependência nova: `adm-zip` (JS puro, sem compilação nativa)
- Testado sem precisar da UI: mecânica de zip/extração validada à parte (133 entradas, checksum SHA-256 do `catalogo.db` idêntico antes/depois do round-trip) — só o fluxo com os diálogos nativos de arquivo fica pendente de confirmação manual, já que não dá pra automatizar clique em diálogo do SO

### 13.3 Notificação nativa + detecção de nova temporada (v1.5.0) ✓
- **Notificação do Windows**: ao abrir o app, verifica séries "Assistindo" com episódio saindo hoje e animes do MAL com `broadcast` batendo com o dia da semana atual — dispara uma notificação nativa via `Notification` do navegador (funciona direto no Electron, sem precisar de nenhum código no processo principal)
- **Nova temporada em série "Assistido"**: mesma checagem na abertura do app notifica quando uma série marcada como totalmente assistida tem `episodes_aired` maior que o que está registrado como visto — sinal de que saiu conteúdo novo depois que foi marcada
- Badge "📺 Nova temporada" no card (grade e lista), complementando a notificação pra quem não vê ela a tempo
- **Correção necessária na Fase 10.7**: a atualização em massa marcava *toda vez* um título "Assistido" como 100% visto — isso escondia silenciosamente qualquer temporada nova (já virava "visto" antes mesmo de detectar). Agora só marca tudo automaticamente no catch-up único de título legado (nunca teve nenhum episódio registrado) — depois disso, atualizações futuras só atualizam a contagem `episodes_aired`, sem forçar o "visto" de novo
- Mapa `WEEKDAY_INDEX` extraído pra `constants.js`, compartilhado entre `ContinuePage.jsx` e `App.jsx`
- Testado: dados reais do catálogo não geram falso positivo (nenhuma das 8 séries "Assistido" hoje tem gap entre aferido e visto) — confirma que a correção da 10.7 preservou o estado correto sem reintroduzir o bug original (Oz continua 56/56)

### 13.4 Nota pessoal (v1.6.0) ✓
Separada da nota do IMDb, igual já existia pros animes via MAL.
- Nova coluna `my_rating` (0–10, `NULL` se não avaliado) em `filmes`
- Campo "Minha nota" no formulário, ao lado de "Nota IMDb"
- Exibida no modal de detalhes junto com a nota do IMDb
- Nova opção de ordenação "Minha nota" no catálogo
- Testado: coluna criada e migração confirmada no banco real

### 13.5 Tags livres (v1.7.0) ✓
Classificação livre, complementar à categoria fixa — pra agrupar por critérios que não cabem numa categoria ("natal", "maratona", "ver com a família"...).
- Tabelas novas `tags` (`id`, `name` UNIQUE, `created_at`) e `filme_tag` (associação N:N, `PRIMARY KEY (filme_id, tag_id)`) — espelha exatamente o padrão já usado por `colecoes`/`filme_colecao`
- IPC: `tags:getAll` (com contagem de uso via `LEFT JOIN`), `tags:insert` (trim, limite de 50 caracteres, UNIQUE tratado com fallback — se já existe com esse nome `COLLATE NOCASE`, retorna a existente em vez de duplicar), `tags:delete`, `tags:getFilmeIds`, `tags:getByFilme`, `tags:setForFilme` (delete-then-reinsert)
- Formulário de adicionar/editar título: novo bloco "Tags" ao lado de "Coleções", em chips (`flex-wrap`), com criação inline "+ Nova"
- Catálogo: novo filtro dropdown por tag (com contagem), combinável com os filtros já existentes (formato, status, categoria, busca)
- Testado: tabelas `tags`/`filme_tag` confirmadas no banco real; build (`vite build` + `node --check`) e modo dev sem erros

### 13.6 Onde assistir (v1.8.0) ✓
Badge de streaming no modal de detalhes, só exibindo informação (sem reprodução/sincronização).
- Novo IPC `tmdb:watchProviders({ id, mediaType })` — chama `/movie|tv/{id}/watch/providers` da TMDB, filtra pela região `BR` e retorna só o modo `flatrate` (assinatura; ignora aluguel/compra, que não é o que interessa pra "o que já tenho pra assistir")
- Busca é por item (`tmdb_id` + `tmdb_media_type`), disparada ao abrir o modal de detalhes — não entra no catálogo em grade pra não multiplicar chamadas à API por título visível
- Exibe os logos dos serviços (Netflix, Globoplay, Prime Video...) direto da CDN de imagens da TMDB; nada aparece se não houver nenhum serviço de assinatura disponível na região
- Testado: chamada direta à API confirmada com dados reais do catálogo (ex: "Origem" → Globoplay; "Oz" → nenhum, sem erro); build e modo dev sem erros

### 13.7 Correções do teste manual (v1.8.2) ✓
Achados do roteiro de testes feito pelo usuário antes de compilar:
- **Tags duplicadas por maiúscula/minúscula** ("Romance"/"romance"): o `UNIQUE` do SQLite diferencia caixa, então o fallback `COLLATE NOCASE` nunca disparava. Agora o `tags:insert` procura sem diferenciar caixa antes de inserir, há um índice único `name COLLATE NOCASE`, e uma migração junta as duplicatas existentes (fica a mais antiga, associações migradas)
- **"Onde assistir" vazio em títulos antigos**: 30 filmes buscados pela TMDB antes da v1.3.1 estavam com `tmdb_media_type = ''`. Backfill pra `'movie'` (categoria não seriada + `imdb_id` preenchido, que a busca de série nunca preenche). Os 6 adicionados só via OMDb (sem `tmdb_id`) são resolvidos sob demanda via `/find/{imdb_id}` ao abrir o detalhe, e o vínculo é salvo. O IPC `tmdb:watchProviders` passou a receber o ID do título
- **Progresso não voltava atrás**: um "✓ Visto" errado (ex: Smallville com T3E14 marcado solto) puxava o "próximo" pra frente, e nem o seletor nem o "até aqui" removiam a marcação. O seletor virou "Próximo a assistir" (igual ao que já vinha pré-preenchido) e ao salvar marca tudo antes e **desmarca o que vier depois**. O `episodes:getNextUp` agora parte do episódio mais avançado visto, então lacunas em temporadas antigas não mandam mais de volta pro T1E1
- **Ordenação "Minha nota"**: maior primeiro, empate em ordem alfabética, sem nota no fim (antes "sem nota" e nota 0 empatavam)
- **Notificações do Windows**: faltava `app.setAppUserModelId` (precisa bater com o `appId` do instalador). No modo dev o Windows pode continuar sem exibir, já que não existe atalho instalado com esse ID

### 13.8 "Até aqui" = assisti tudo até este episódio (v1.8.3) ✓
- O botão "até aqui" do painel de episódios só marcava dentro da temporada aberta: não preenchia temporadas anteriores nem desfazia marcações à frente. Agora usa o mesmo `episodes:markProgress` do seletor (com `episode + 1` como "próximo a assistir"): marca temporadas anteriores inteiras, marca até o episódio clicado e desmarca o que vier depois, avisando quantos foram desmarcados
- O seletor "Próximo a assistir" no formulário de edição só era preenchido ao abrir; agora acompanha qualquer mudança feita no painel (contador `episodesVersion` disparado pelo `onUpdated`) e zera o `progressTouched`, pra salvar o formulário não reaplicar um valor antigo
- Clique individual passou a avisar o formulário só depois de gravar no banco (antes o seletor podia ler o estado anterior)
- Testado no app rodando (Electron com `--remote-debugging-port`, cliques reais na interface via CDP): "até aqui" em T2E13 do Smallville → seletor em T2E14, banco com T1 completa (21) + T2 E1–E13 e T3 desmarcada; marcar/desmarcar T2E14 → seletor T2E15/T2E14; aba Continuando mostrando "Próximo: T2E14"

### 13.9 Remover tag (v1.9.0) ✓
- ✕ em cada chip de tag no formulário (com `stopPropagation`, pra não alternar a seleção) abre o `ConfirmModal` dizendo de quantos títulos a tag sai; confirmar chama o `tags:delete` já existente (remove associações e a tag), tira a tag da seleção atual e atualiza a lista/contagens
- Testado na interface via CDP: criar tag → ✕ → Cancelar (nada muda) → ✕ → Remover tag (some da tela e do banco, demais tags intactas)

---

## Fase 14 — Infraestrutura e evolução (em andamento)

Ordem combinada: 14.1 testes de interface → 14.2 atualização automática → 14.3 dividir `AddDiscPage.jsx` → 14.4 `safe.directory` do git → depois estatísticas, "Onde assistir" no card/filtro, importação de lista e notificações com o app aberto.

### 14.1 Testes automatizados de interface ✓
- **Playwright** (`@playwright/test` 1.48, só o suporte a Electron — nenhum navegador baixado) em `e2e/`, rodando com `npm run test:ui`
- Cada teste abre o app real (`_electron.launch`) contra um Vite na porta 5199, com uma **pasta de dados descartável**: `main.js` aceita `CATALOGO_USER_DATA` (só fora do app empacotado) e chama `app.setPath('userData', ...)` antes de qualquer acesso. A chave da TMDB é copiada da configuração local (ou `TMDB_API_KEY`); sem chave, os testes que dependem da TMDB são pulados
- Diálogos nativos de arquivo (backup/restauração) são substituídos por respostas fixas no processo principal via `electronApp.evaluate(({ dialog }) => ...)`
- Arquivos em CommonJS: o carregador ESM do Playwright 1.48 trava em silêncio no Node 24
- 11 testes cobrindo o roteiro manual: pasta isolada, ordenação "Minha nota", "0" solto (validado reintroduzindo o bug de propósito — o teste falha), tags (criar sem duplicar por caixa, filtrar, limpar filtros, remover com cancelar/confirmar), "até aqui" e seletor "Próximo a assistir" (incluindo clique errado à frente e a aba Continuando), vínculo TMDB por IMDb ao abrir o detalhe, painel de episódios só em séries, backup + restauração sem tela escura, cancelamento do diálogo de restauração
- Regra registrada no `CLAUDE.md`: rodar `npm run test:ui` antes de compilar e acrescentar um teste a cada bug de interface corrigido
- A suíte Jest antiga (`tests/`, segurança) continua fora do repositório, como antes

### 14.2 Atualização automática (v1.10.0) ✓
- `electron-updater` 6.3.9 com provider `github` (`ednelsonsantos/catalogo-filmes`, repositório público — sem token pra baixar). O `electron-builder` gera o `app-update.yml` dentro do app e o `latest.yml` junto do instalador
- Fluxo: 5 s depois de abrir, procura versão nova → baixa em segundo plano → aviso "Versão X baixada" com **Reiniciar e atualizar** (`quitAndInstall`) ou **Depois** (instala sozinho ao fechar, `autoInstallOnAppQuit`)
- Card "Atualizações" em Configurações: versão instalada (`app.getVersion()`), status (procurando / atualizado / baixando % / pronta / erro) e botão "Verificar atualizações"
- Erros traduzidos e resumidos (o erro bruto traz stack e cabeçalhos HTTP): "nenhuma versão publicada no GitHub ainda", "sem conexão com o servidor de atualizações"
- Desligado fora do app instalado. Pra testar: `CATALOGO_UPDATE_FEED` (só fora do empacotado) aponta pra um servidor local `generic`; o app grava um `dev-app-update.yml` na pasta de dados (o download exige a config em disco, não só a URL) e **nunca instala ao fechar** nesse modo
- `npm run build` agora é `--publish never`; `npm run release` publica (precisa de `GH_TOKEN`)
- Testes (`e2e/atualizacao.spec.js`, servidor HTTP local com um "instalador" de bytes aleatórios): versão nova baixa sozinha e mostra o aviso; já atualizado; servidor fora do ar; desligado em dev. Os testes também pegaram dois problemas reais: o aviso cobria o botão "Configurações" da sidebar (movido pra direita dela) e o erro mostrava o stack trace inteiro
- Conferido no app empacotado: `electron-updater` dentro do `app.asar`, consulta ao GitHub funcionando ("nenhuma versão publicada" enquanto não houver release)

### Correção: "Preencher manualmente" não salvava (entra na v1.10.0)
- Achado pelos testes novos de adicionar título (`e2e/adicionar.spec.js`), escritos pra proteger a divisão do `AddDiscPage.jsx`: salvar um título preenchido à mão (sem passar pela busca) sempre dava "Erro ao salvar." — o objeto vazio do formulário não tinha `imdb_id` e o `better-sqlite3` recusa parâmetro nomeado ausente (`Missing named parameter "imdb_id"`). Só funcionava quando a busca preenchia o campo
- Corrigido nos dois lados: `imdb_id` no objeto vazio do formulário e valores padrão pra todos os campos opcionais no `db:insert` (o `db:update` continua exigindo todos, pra nunca apagar um campo em silêncio)
- Testes novos: preencher manualmente (validações de título/categoria, formatos, nota, coleção criada na hora), "Assistido"/"Assistindo" na edição, aba de anime sem MAL, busca de série na TMDB com progresso informado ao adicionar, aviso de título já na coleção

### 14.3 Divisão do `AddDiscPage.jsx` ✓
Refatoração sem mudança de comportamento: de **1.411 para 540 linhas**. A página ficou com o estado do formulário, a busca, o OCR e o salvar; o resto saiu para:
- `src/utils/titleMappers.js` (conversores OMDb/TMDB → título, `normalizeTitle`, `TMDB_IMG`) e `src/utils/ocr.js` (Tesseract + `fileToBase64`)
- `src/components/add/`: `CoverPicker` (capa + arrastar + status do OCR, com o estado de "arrastando" dentro dele), `TitleSearchPanel` (busca, resultados, aviso de ambiguidade e de duplicata), `FormFields`, `ProgressSelector`, `CollectionsPicker` e `TagsPicker` (cada um com seu próprio estado de "criando"/"removendo"), `AnimeSearchSection` e `AnimeAddModal` (com as constantes do MAL, que só eles usam)
- Os blocos foram recortados por intervalo exato de linhas com um script (sem redigitar código) e a suíte de 20 testes de interface passou igual antes e depois — incluindo os 5 testes de adicionar título escritos justamente pra proteger esta mudança

### 14.5 Tela de Estatísticas (v1.11.0) ✓
- Nova aba "Estatísticas" na sidebar. Cálculo em funções puras (`src/utils/stats.js`) sobre os dados que o app já carrega; só os episódios por mês vêm de um IPC novo (`stats:episodesByMonth`, agrupado no SQLite)
- Cartões: títulos, assistidos (%), **horas assistidas** (filme assistido = duração; série = episódios vistos × duração do episódio, lida de "45 min/ep"), episódios vistos, nota pessoal média. Títulos sem duração cadastrada são contados à parte e avisados; animes não entram nas horas (a lista do MAL não traz a duração)
- Gráficos de barra em CSS puro (sem biblioteca nova): gêneros, categorias, formatos, décadas, minhas notas, séries em andamento (vistos/lançados), animes por status
- **Decisão pelos dados reais**: quase todos os títulos assistidos estão sem data (`watched_at = 'watched'`) e os 305 episódios foram marcados em lote no mesmo mês — um gráfico "por mês" como destaque mostraria uma barra só. A atividade dos 12 meses ficou como seção secundária, avisando quantos títulos estão sem data e que marcações em lote contam no mês em que foram feitas
- Testes: dados conhecidos (horas = 120 + 90 + 6 × 45 = 480 min → 8 h, título sem duração avisado, média 7, empates de formato em ordem alfabética, décadas, notas, 12 colunas de atividade, títulos sem data) e coleção vazia sem quebrar. Conferido visualmente com o catálogo real (só leitura)

### 14.6 "Onde assistir" no card e como filtro (v1.11.0) ✓
- **Cache no banco**: colunas `providers` (JSON `[{id,name,logo}]`, `NULL` = nunca verificado) e `providers_checked_at` (UTC). Validade de 7 dias
- `tmdb:watchProviders` devolve o cache em dia ou busca e grava; `providers:refreshStale` atualiza em sequência só os títulos vencidos que têm vínculo (TMDB ou IMDb). O app chama ao abrir, em segundo plano, e recarrega a lista se algo mudou
- Variantes "with Ads" (ex: "Netflix Standard with Ads") são descartadas — só repetiam o serviço principal
- Editar o título trocando o `tmdb_id` zera o cache no próprio `UPDATE` (`CASE` comparando o valor antigo com o novo), pra não mostrar serviços de outro título
- Card: até 3 logos + "+N" (nome de todos no tooltip), na grade ao lado do ano e na lista junto dos formatos. Detalhe mostra o cache na hora e atualiza
- Filtro "Onde assistir" no catálogo (só aparece quando há algo verificado): todos / em algum streaming / em nenhum (verificado e vazio — o que nunca foi verificado não entra) / cada serviço com contagem
- **Correção de layout achada no print**: com os selects de tags e streaming, a barra de filtros ficava mais larga que a janela (391px de rolagem horizontal a 1280px; a lista "deslizava" ao trocar a visualização). `.toolbar-right` agora quebra linha. Teste comprova: falha sem a correção, passa com ela
- Testes: cache gravado direto no banco de teste pelo processo principal (sem depender do que está em cada streaming hoje): logos e "+N", tooltip, opções do filtro com contagem, filtrar por serviço/algum/nenhum, limpar filtros, visão em lista, cache preservado em outras edições e descartado ao trocar o vínculo; com a TMDB: verificação em segundo plano ao abrir grava o cache

### 14.7 Importar lista (v1.11.0) ✓
- Botão "⤓ Importar" no catálogo abre um modal: escolher arquivo → prévia → importar com progresso (dá pra parar) → resumo
- `import:readFile` (processo principal): diálogo nativo + `xlsx` (já era dependência) lê CSV UTF-8 ou Excel, até 5.000 linhas. Leitura **crua** (`raw: true`): sem isso o `xlsx` transformava "2024-03-02" em data e devolvia "3/2/24", e a data de assistido se perdia — pego pelo teste
- `src/utils/importList.js` (funções puras) reconhece o formato pelos cabeçalhos: **Letterboxd** (`Letterboxd URI`; estrelas 0,5–5 → nota 0–10; `Watched Date`/`Date` → assistido em; `watchlist.csv` tem as mesmas colunas, então o nome do arquivo decide que entra como não assistido), **IMDb** (`Const`; `Your Rating` = assistido; "TV Series" → série), **exportação do próprio app** e **planilha genérica** (Título/Title/Name + Ano, Nota, Formato, Assistido com "sim"/data). Datas ISO, dd/mm/aaaa ou número de série do Excel (arredondado pro dia — a biblioteca grava 01/07 como 30/06 23:59 por causa do fuso)
- Duplicatas contra a coleção **inteira** (não só a coleção selecionada na sidebar): mesmo IMDb ou mesmo título sem acento/caixa + ano. São mostradas e puladas
- Opção "Completar com dados da TMDB": pelo código do IMDb (`tmdb:findByImdb`, novo) ou busca título + ano (filme e depois série, ou o contrário se a lista diz que é série). Série assistida já sai com os episódios lançados marcados, igual ao botão "Assistido". Formato padrão opcional pra quem não tiver
- **Correção na exportação CSV**: só a sinopse tinha aspas escapadas — um título com aspas gerava CSV malformado. Agora todos os campos
- Testes (arquivos de exemplo + diálogo simulado): Letterboxd ratings (estrelas, data, duplicata pulada, vírgula no título), watchlist, Excel genérico (colunas em português, formato padrão, data em célula de data), ida e volta com o CSV do próprio app (nada duplicado, aspas escapadas), arquivo irreconhecível; com a TMDB: IMDb ratings achando filme e série pelo código, pôster, e episódios da série marcados

### 14.4 `safe.directory` do git ✓
A pasta do projeto pertence a outro usuário do Windows (SID diferente, provavelmente de uma instalação anterior), e o git recusava rodar ("dubious ownership"). Registrada com `git config --global --add safe.directory "E:/Projetos aplicativos/catalogo-filmes"` — o git volta a funcionar sem o `-c safe.directory=...` em cada comando

---

## Backlog de ideias (não detalhadas ainda)

- ~~**⚠ Risco:** categoria "Animação" tratada como série pra fins de episódios, mesmo quando é um filme avulso~~ — **corrigido na v1.3.1**, ver Fase 13.1
- ~~**Onde assistir**~~ — badge com os serviços de streaming (Netflix, Prime Video...) via `/tv|movie/{id}/watch/providers` da TMDB — **feito na v1.8.0**, ver Fase 13.6
- ~~**Backup completo**~~ — **feito na v1.4.0**, ver Fase 13.2
- ~~**Nota pessoal**~~ — **feita na v1.6.0**, ver Fase 13.4
- ~~**Detecção de nova temporada**~~ / ~~**Notificação nativa do Windows**~~ — **feitas na v1.5.0**, ver Fase 13.3
- ~~**Tags livres**~~ além da categoria fixa, com filtro por tag — **feita na v1.7.0**, ver Fase 13.5

---

## Fora do escopo

- Sincronização em nuvem
- Compartilhamento entre dispositivos
- Integração com serviços de streaming (reprodução/sincronização de progresso direto na plataforma)
- Scanner de código de barras
