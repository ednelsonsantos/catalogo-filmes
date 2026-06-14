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

## Fora do escopo

- Sincronização em nuvem
- Compartilhamento entre dispositivos
- Integração com serviços de streaming
- Scanner de código de barras
