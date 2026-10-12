# Orientações do projeto

- Leia `CONTEXT.md` para arquitetura, sincronização e histórico. Interface e comunicação em pt-BR.
- O aplicativo usa HTML/CSS/JavaScript vanilla inline em `index.html`, sem build ou dependências de testes.
- Incremente `VERSION` em `sw.js` quando modificar o aplicativo, para atualizar o cache do PWA.
- Verificação da resenha: `node scripts/test-resenha.cjs`. Requer Node e `chromium` no PATH. Valida a sintaxe do JS inline e testa a interface com Chromium headless em viewport ampla e compacta, incluindo movimento reduzido. Usa armazenamento em memória e sincronização desativada para não alterar IndexedDB ou dados reais do GitHub. Perfis temporários são removidos ao final.
- Verificação do modal e progresso compartilhado: `node scripts/test-leitura.cjs`, usando o mesmo executor isolado de navegador em `scripts/browser-test.cjs`.
- O modal geral é único para Estante e Diário. `Páginas lidas` informa o total já lido: digitar 100 salva exatamente 100, sem somar ao valor anterior. `books.paginasLidas` é a única fonte do progresso; `saveBook` grava o valor e `persistReading` usa uma transação do IndexedDB. Aumentos podem gerar registros históricos da diferença, mas o histórico nunca recalcula o progresso.
- Não há formulário separado do Diário (`dform`) nem lista editável de sessões no cartão. Registrar leitura, clicar no cartão do Diário ou na Estante abre `openBook`/`renderPanel`; o campo vem preenchido com o total salvo.
- Registros antigos, inclusive testes, são preservados sem acrescentar páginas automaticamente ao carregar ou sincronizar. A correção de um total errado deve ser feita explicitamente no modal; não editar `data/sync.json` diretamente.
- Verificação do fichário: `node scripts/test-citacoes.cjs`. Cada citação é uma aba lateral; `ficharioState` guarda a aba e o modo de edição. O editor usa o mesmo fichário centralizado, com página obrigatória. Editar preserva o ID e o timestamp de criação para não duplicar nem reordenar abas; cancelar não salva e excluir exige confirmação.
- Referência do fichário: `identidade-visual/citacoes-design.jpg`, com folhas pastel, argolas à esquerda e abas arredondadas à direita.
- Verificação do dashboard: `node scripts/test-dashboard.cjs`. `dashboardEntries` é compartilhado por Hoje, sequência, registros e gráfico semanal; limita as contribuições ao progresso atual de cada livro. Livro zerado não contribui. `readingEpoch` marca reinícios e é sincronizado no livro e nas novas sessões, para registros antigos não voltarem ao dashboard após recomeçar. O histórico bruto é preservado.
- As citações ficam centralizadas na folha do fichário e no modo Ler página; trechos longos usam rolagem sem cortar o início.
- Verificações complementares: `node --check sw.js` e `git diff --check`.
