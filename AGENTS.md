# Orientações do projeto

- Leia `CONTEXT.md` para arquitetura, sincronização e histórico. Interface e comunicação em pt-BR.
- O aplicativo usa HTML/CSS/JavaScript vanilla inline em `index.html`, sem build ou dependências de testes.
- Incremente `VERSION` em `sw.js` quando modificar o aplicativo, para atualizar o cache do PWA.
- Verificação da resenha: `node scripts/test-resenha.cjs`. Requer Node e `chromium` no PATH. Valida a sintaxe do JS inline e testa a interface com Chromium headless em viewport ampla e compacta, incluindo movimento reduzido. Usa armazenamento em memória e sincronização desativada para não alterar IndexedDB ou dados reais do GitHub. Perfis temporários são removidos ao final.
- Verificações complementares: `node --check sw.js` e `git diff --check`.
