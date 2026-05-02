# Roadmap — Meu Catálogo

Funcionalidades planejadas ordenadas por fase. Cada fase é independente e pode ser implementada separadamente.

---

## Fase 1 — Polimento da UI (fácil, alto impacto)

### 1.1 Total de resultados filtrados
Exibir "Exibindo 8 de 47 títulos" abaixo da toolbar quando houver filtro ativo.
- `CatalogPage.jsx`: adicionar linha entre toolbar e grid com contagem de `filtered.length` vs `filmes.length`

### 1.2 Limpar filtros com um clique
Botão "Limpar filtros" visível apenas quando há filtro ativo (formato ≠ all, categoria ≠ all ou busca não vazia).
- `CatalogPage.jsx`: botão que reseta `search`, `format` e `category` de uma vez

### 1.3 Atalho de teclado Ctrl+F
Focar no campo de busca do catálogo com `Ctrl+F`.
- `CatalogPage.jsx`: `useEffect` com listener de `keydown` + `ref` no input de busca

### 1.4 Feedback visual ao salvar configurações
Botão "Salvar configurações" muda para "Salvo ✓" por 2s após o clique.
- `SettingsPage.jsx`: estado `saved` com `setTimeout` para resetar

---

## Fase 2 — Catálogo mais informativo

### 2.1 Contagem por categoria no dropdown
Exibir `Filme (12)` em vez de só `Filme` no select de categorias.
- `CatalogPage.jsx`: calcular contagem de cada categoria a partir de `filmes` via `useMemo`

### 2.2 Painel de estatísticas
Expandir a stats-bar atual com: total por categoria, total por formato, % assistidos, último título adicionado.
- `CatalogPage.jsx`: expandir o bloco `.stats-bar` com mais métricas calculadas via `useMemo`

### 2.3 Pôster fallback com cor por título
Quando não há pôster nem capa, gerar um gradiente de cor único baseado no hash do título em vez do ícone genérico.
- `DiscCard.jsx` e `DiscDetailModal.jsx`: função `titleToColor(title)` → `hsl()` para fundo do placeholder

---

## Fase 3 — Interações rápidas

### 3.1 Toggle "assistido" direto no card
Clicar no ícone ✓ no card do catálogo para marcar/desmarcar assistido sem abrir o modal de edição.
- `DiscCard.jsx`: botão overlay no card com `onClick` que chama `window.api.update` diretamente
- `CatalogPage.jsx`: passar callback `onToggleWatched` para o card

### 3.2 Ordenar coleções na sidebar
Adicionar controle para ordenar coleções por A-Z, mais recente ou mais títulos.
- `Sidebar.jsx`: select ou toggle de ordenação local aplicado ao array `collections`

---

## Fase 4 — Exportação avançada

### 4.1 Exportar coleção específica
Quando uma coleção está selecionada na sidebar, os botões CSV/Excel/Site exportam apenas os títulos dessa coleção.
- `CatalogPage.jsx`: recebe `selectedCollection` (já recebe) e passa `filmeIds` para os handlers de export
- `electron/main.js`: handlers de export aceitam parâmetro opcional `filmeIds` para filtrar a query SQL

---

## Ordem de implementação sugerida

| Prioridade | Fase | Item | Esforço estimado |
|---|---|---|---|
| 1 | 1.1 | Total de resultados filtrados | 30 min |
| 2 | 1.2 | Limpar filtros | 30 min |
| 3 | 1.3 | Atalho Ctrl+F | 20 min |
| 4 | 1.4 | Feedback salvar configurações | 20 min |
| 5 | 2.1 | Contagem por categoria | 30 min |
| 6 | 2.3 | Pôster fallback com cor | 45 min |
| 7 | 3.1 | Toggle assistido no card | 1h |
| 8 | 2.2 | Painel de estatísticas | 1h |
| 9 | 3.2 | Ordenar coleções | 45 min |
| 10 | 4.1 | Exportar coleção específica | 1h |

**Total estimado: ~7 horas**

---

## Fora do escopo deste roadmap

- Sincronização em nuvem
- Compartilhamento entre dispositivos
- Integração com serviços de streaming
- Scanner de código de barras
