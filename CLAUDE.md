# Meu Catálogo — instruções do projeto

## Versionamento

Sempre que corrigir um bug ou implementar uma melhoria/funcionalidade nova, **atualize o campo `"version"` em `package.json` antes de gerar o executável**, seguindo semver:

- **Correção de bug** (comportamento já esperado, só não funcionava certo) → incrementa o **PATCH** (1.1.0 → 1.1.1)
- **Melhoria ou funcionalidade nova** → incrementa o **MINOR** (1.1.0 → 1.2.0), zerando o patch
- **Mudança que quebra compatibilidade** (ex: migração de banco que exige recriar dados, remoção de funcionalidade) → incrementa o **MAJOR** (1.x.x → 2.0.0), zerando minor e patch

Várias correções/melhorias pequenas feitas na mesma sessão antes de gerar o executável podem ser agrupadas num único bump (não precisa gerar um `.exe` por commit).

O nome do instalador gerado pelo `electron-builder` (`Meu Catálogo Setup <version>.exe`) vem direto desse campo. Sem atualizar, o build sempre sobrescreve o mesmo arquivo com o mesmo nome, mesmo que o conteúdo tenha mudado bastante — dificulta saber qual instalador é qual depois.

## Publicação (atualização automática)

Os apps instalados se atualizam pelos releases do GitHub (`electron-updater`, config `publish` no `package.json`). `npm run build` só compila (`--publish never`); `npm run release` compila e envia um release rascunho, e precisa de `GH_TOKEN` (peça ao usuário, nunca grave em arquivo). Publicar no GitHub é visível para outros — confirme com o usuário antes. O `latest.yml` e o `.blockmap` só precisam existir até o envio; a limpeza do `dist-electron` (deixar só o `.exe` novo) vem depois da publicação.

## Testes antes de compilar

Antes de gerar o instalador, rode `npm run test:ui` (testes de interface em `e2e/`, Playwright + Electron) e só compile com tudo passando. Ao corrigir um bug de interface, acrescente um teste em `e2e/` que reproduza o problema. Os testes usam uma pasta de dados temporária — nunca o catálogo real.
