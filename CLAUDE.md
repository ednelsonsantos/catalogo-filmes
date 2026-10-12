# Meu Catálogo — instruções do projeto

## Versionamento

Sempre que corrigir um bug ou implementar uma melhoria/funcionalidade nova, **atualize o campo `"version"` em `package.json` antes de gerar o executável**, seguindo semver:

- **Correção de bug** (comportamento já esperado, só não funcionava certo) → incrementa o **PATCH** (1.1.0 → 1.1.1)
- **Melhoria ou funcionalidade nova** → incrementa o **MINOR** (1.1.0 → 1.2.0), zerando o patch
- **Mudança que quebra compatibilidade** (ex: migração de banco que exige recriar dados, remoção de funcionalidade) → incrementa o **MAJOR** (1.x.x → 2.0.0), zerando minor e patch

Várias correções/melhorias pequenas feitas na mesma sessão antes de gerar o executável podem ser agrupadas num único bump (não precisa gerar um `.exe` por commit).

O nome do instalador gerado pelo `electron-builder` (`Meu Catálogo Setup <version>.exe`) vem direto desse campo. Sem atualizar, o build sempre sobrescreve o mesmo arquivo com o mesmo nome, mesmo que o conteúdo tenha mudado bastante — dificulta saber qual instalador é qual depois.
