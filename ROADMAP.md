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

## Fora do escopo deste roadmap

- Sincronização em nuvem
- Compartilhamento entre dispositivos
- Integração com serviços de streaming
- Scanner de código de barras
