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

## Fase 8 — Acompanhamento de episódios ⏳ planejada

Hoje o app só sabe se uma série está "Assistida" ou "Assistindo" como um todo — não sabe em qual episódio você está, nem quantos faltam, nem quando sai o próximo. A TMDB (já integrada) expõe tudo isso; falta usar.

### 8.1 Banco de dados
- Nova tabela `episodios_assistidos` — guarda só o que foi marcado, não a lista inteira (que vem da TMDB sob demanda):
  ```sql
  CREATE TABLE episodios_assistidos (
    filme_id INTEGER NOT NULL,
    season_number INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    watched_at TEXT,
    PRIMARY KEY (filme_id, season_number, episode_number)
  )
  ```
- Novas colunas em `filmes` (cache leve, evita bater na API toda hora): `episodes_aired`, `episodes_watched_count`, `next_episode_air_date`, `last_episode_check`

### 8.2 Electron / IPC
- `tmdb:tvSeasonDetails` — `GET /tv/{id}/season/{season_number}`, retorna episódios (número, nome, data de exibição)
- `episodes:setWatched` / `episodes:getWatched` — grava/lê o progresso local por episódio
- `episodes:refresh` — busca `next_episode_to_air` / `seasons` na TMDB, recalcula os contadores cacheados em `filmes` e atualiza

### 8.3 Interface
- Nova aba "Episódios" no modal de detalhes (`DiscDetailModal.jsx`), visível quando o título tem `tmdb_id` e categoria Série/Mini-série/Anime/Animação
  - Acordeão por temporada, checkbox por episódio; episódios com data futura ficam bloqueados (ainda não foi ao ar)
  - Botão "Marcar até aqui" (marca tudo da temporada até o episódio clicado)
  - "Próximo episódio: Ep 5 — 12/10/2026" no topo
- Badge no card do catálogo: barra "8/12 eps" + ícone 🆕 quando um episódio novo saiu e ainda não foi contabilizado
- Botão manual "Atualizar episódios" (chama `episodes:refresh` sob demanda, já que seria caro consultar a TMDB pra cada série a cada abertura do app)

### 8.4 Animes (MAL) — ajuste leve, sem API nova
- Exibir "faltam X episódios" usando dados que o MAL já devolve (`num_episodes − num_episodes_watched`), já carregados em `AnimePage.jsx`

### Ordem de implementação sugerida
1. **8.1 + 8.2** — schema e busca de temporadas/episódios na TMDB (sem marcar nada ainda, só listar)
2. **8.3 (parte 1)** — aba "Episódios" com checkboxes funcionando
3. **8.3 (parte 2)** — contadores cacheados + badge no card + botão de atualizar
4. **8.4** — exibir "faltam X" para animes (rápido, pode ser feito em paralelo)

---

## Backlog de ideias (não detalhadas ainda)

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
