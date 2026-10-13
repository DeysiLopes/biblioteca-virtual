# Orientações do projeto — Minha Biblioteca

## Base atual e escopo

- Interface, comunicação e documentação do projeto em pt-BR.
- A aplicação atual é o MVP 2: React 18, TypeScript, Vite e React Router. O código do app está em `src/`; `index.html` é a entrada do Vite, não a antiga aplicação com JS inline.
- Leia a seção de migração React/MVP 2 e as atualizações recentes de `CONTEXT.md`. As seções do MVP vanilla são histórico; em caso de divergência, confira o código e a configuração atuais antes de agir.
- Consulte `todo.md` para pendências e `todo-isbn.md` para o estudo da integração por ISBN. A busca básica por ISBN já existe em `/books`; não confundir essa implementação com a conclusão do estudo ou de todos os critérios do roadmap.
- Preserve alterações locais da pessoa usuária. Não restaure a SPA vanilla nem implemente mudanças nos arquivos legados como se fossem o runtime atual.

## Organização do código

- `src/main.tsx`: inicialização React, `BrowserRouter` com `import.meta.env.BASE_URL` e registro do PWA em produção.
- `src/App.tsx`: composição e rotas. `/` e `/estante` abrem a Estante; `/diario` é o Diário; `/dashboard` redireciona para `/diario`; `/books` é o cadastro/importação (aba "🎬 Scan de reel" é a principal); `/citacoes` contém as citações (`/fichario` redireciona); `/caderno/:livroId` abre a resenha.
- `src/pages/` e `src/components/`: páginas, componentes e interação visual. Siga as convenções dos componentes existentes antes de criar novos.
- `src/hooks/useLibrary.ts`, `useAuth.ts`, `useSound.ts` e `useBookCoverUrl.ts`: integração da interface com biblioteca, autenticação, áudio e resolução de capas.
- `src/core/models/`: tipos de livros, entradas do diário e `UserLibraryData`. `Book` inclui `coverFileId` (capa no Drive) e `filaPosicao` (fila "Quero ler").
- `src/core/business/`: regras de progresso, dashboard, citações, fila (`queue.ts`), parser CSV/JSON e consulta Open Library. Mantenha essas regras testáveis, sem duplicá-las nos componentes.
- `src/core/business/llm/`: scan de reels — `types`, `prompt`, `parse`, `providers` (Gemini/OpenAI/Anthropic), `frames` (extração `<video>`+canvas), `reel-link` (Jina + proxies) e `extract` (orquestração/config). Sem chamadas diretas a LLM fora dessa camada.
- `src/core/storage/`: IndexedDB (v2: `books`, `diary`, `meta`, `covers`), Google Drive, `cover-cache.ts`, migração dos dados antigos e `LibrarySyncManager`/`syncManager`.
- `src/core/auth/google-auth.ts`: Google Identity Services (GIS).
- `src/core/broadcast/channel.ts`: comunicação entre abas.
- `src/styles/global.css`: identidade visual e animações. Referências visuais em `identidade-visual/`, incluindo `citacoes-design.jpg`.
- `src/test/`: testes Vitest/React Testing Library. Configuração em `vitest.config.ts`; `setup.ts` usa jest-dom, fake-indexeddb e mock de BroadcastChannel.

## Estado, persistência e sincronização

- A biblioteca usa memória, IndexedDB (`books`, `diary`, `meta`, `covers`) e Google Drive. Alterações da interface devem passar por `useLibrary`/`syncManager`, não por cópias independentes de estado ou gravações paralelas improvisadas.
- Preserve a gravação atômica de livro e entrada do diário em `persistBookAndDiaryAtomic`, quando houver registro de leitura.
- A nuvem atual é Google Drive REST API v3: arquivo `biblioteca-<userId>.json` na pasta "Minha Biblioteca", com dados no formato `UserLibraryData`. Capas ficam em `Minha Biblioteca/capas/` (`<isbn>.jpg` ou `book-<id>.jpg`), referenciadas por `book.coverFileId` e cacheadas na store `covers` — ver `cover-cache.ts`. O sync por GitHub Contents API é legado, não o mecanismo a estender na nova arquitetura.
- `migration.ts` e o carregamento inicial podem aproveitar `books.json`/`data/sync.json` antigos quando disponíveis. Esses arquivos não são a fonte principal de persistência nem devem ser limpos como tentativa de corrigir sincronização.
- O gerenciador agenda envio ao Drive e publica eventos `LIBRARY_UPDATED`. Entre abas, use o canal `biblioteca-sync` e o fallback de evento `storage`; preserve inscrições e limpeza dos listeners.
- Ao alterar sync, teste pull, push, concorrência, campos vazios e exclusões entre clientes. A presença de `deletedCitacoes` no modelo não comprova, sozinha, que todas as corridas de merge estão cobertas.
- O backup atual é JSON, pelo fluxo `exportDriveBackup`, com nome `biblioteca-<userId>.json` ou identificação offline. Não tratá-lo como exportação CSV nem presumir que ele consulta a nuvem no momento do download.
- GIS usa access token e escopo `drive.file`, sem segredo OAuth ou refresh token no cliente. `VITE_GOOGLE_CLIENT_ID` identifica a aplicação; quando não configurado, o código oferece modo mock, com dados de Drive simulados em armazenamento local.
- Nunca incluir access tokens, chaves secretas ou segredos OAuth em código, logs, testes, backups ou commits. O client ID público não é um segredo; não serialize `AuthState` dentro de `UserLibraryData`.
- A API key do LLM do scan (`meta` `llmProvider`/`llmApiKey`) é **local-only**: nunca vai para `UserLibraryData`, Drive, backups ou logs. Fallbacks dev: `VITE_LLM_PROVIDER`/`VITE_LLM_API_KEY`/`VITE_GEMINI_API_KEY` no `.env` (gitignored).
- Não usar dados pessoais reais em código, logs, fixtures de testes ou commits. Backups solicitados pela pessoa usuária podem conter os próprios dados da biblioteca, mas não tokens de autenticação. Respeite o `.gitignore`, que exclui dados pessoais, `.env` locais, `node_modules/`, `dist/` e `bugs/`.
- Testes devem usar mocks e dados isolados. Não autenticar, criar arquivos, sobrescrever biblioteca real no Drive nem enviar dados de teste à nuvem sem autorização explícita. Testes mock não substituem validação real de login e sync entre aparelhos.

## Regras de negócio e interface a preservar

- `paginasLidas` é o total já lido: digitar 100 salva 100, sem somar. Reutilize `applyBookProgressUpdate` em `src/core/business/progress.ts`; o histórico não recalcula o progresso do livro.
- Avanços podem gerar uma entrada do diário pela diferença. `readingEpoch` identifica início/reinício/zeramento e deve ser preservado nos livros e nas entradas relacionadas.
- O dashboard usa `computeDashboardSummary`/`getDashboardEntries`, limita as contribuições ao progresso atual e ignora epochs anteriores. Livro com zero páginas não pontua; reset de um livro não apaga a atividade dos demais.
- Os livros com status "Lido" ficam nas prateleiras do final da Estante, mas continuam acessíveis. Filtros e busca alteram a visualização, não os dados dos livros.
- Citações exigem texto e página maior que zero. Use as regras de `quotes.ts`; editar preserva `id` e `ts`, e excluir mantém o ID em `deletedCitacoes`. Não reintroduzir citações apagadas ao sincronizar ou migrar dados.
- O modal de Citações (`CitacoesModal`) ordena por `page` ascendente; a navegação usa a cascata de folhas do MVP 1 com som (`playPageTurn`); edição reusa a cara do caderno de resenha.
- A fila "Quero ler" é ordenada por `book.filaPosicao` (`queue.ts`): arrastar para "Lendo" muda status; arrastar para "Quero ler" põe no topo; sair da fila grava `null`. Livro completo não regredde de "Lido".
- Livros vindos do scan de reels entram como `status: 'Quero ler'` e passam por `saveBatch` + `enrichBooksInBackground` — não gravar direto no IndexedDB nem duplicar a regra de dedupe fora da camada `llm/`+UI.
- Preserve o modal compartilhado das informações de leitura, a página de leitura das citações e o caderno pautado de resenha com som opcional.
- No Diário, o fluxo da resenha segue o MVP 1: capa → contracapa (flip automático ~260ms, interativa após o giro) → folha do caderno com a capa encaixada acima (`cad-cover`). Salvar ou fechar a folha retorna à contracapa; só o Fechar da contracapa (X, clique fora ou Esc) volta ao Diário. A capa deve manter dimensões compatíveis em telas pequenas; não remover fallbacks de tamanho sem validar o comportamento.

## Verificação

Use os scripts reais de `package.json`:

- `npm run dev`: servidor Vite de desenvolvimento.
- `npm test`: suíte completa (`vitest run`).
- `npm test -- src/test/diary-review.test.tsx`: regressão do fluxo Diário → capa 3D → caderno → retorno ao Diário.
- `npm run build`: verificação TypeScript (`tsc`) e build Vite/PWA.
- `npm run preview`: conferir o build gerado localmente, inclusive rotas e comportamento do PWA quando aplicável.
- `git diff --check`: verificar problemas de whitespace.

Para mudanças no app, execute os testes relevantes, a suíte completa e o build. Confira interações e telas pequenas quando houver mudanças visuais. Para alterações apenas de documentação, revise os caminhos/comandos e o diff; não é necessário executar deploy.

Os scripts `scripts/test-*.cjs` com Chromium e extração de JS inline pertencem ao MVP vanilla. Não usá-los como prova de que o runtime React atual foi validado, nem depender dos antigos arquivos em `/tmp/opencode`.

## PWA e publicação

- `vite-plugin-pwa` em `vite.config.ts` gera o service worker e o precache no build, com `registerType: 'autoUpdate'`. Não criar/editar um `sw.js` manual nem incrementar o antigo `VERSION = "bib-vN"`.
- O app é publicado no **Cloudflare Pages** (`biblioteca-virtual.pages.dev`, na raiz) — o GitHub Pages foi aposentado. A `base` do Vite vem de `VITE_BASE_PATH` (padrão `/`; só mude para um deploy em subpasta); `VITE_SITE_URL` alimenta `og:url`/`og:image` via token `%SITE_URL%` no `index.html`. O basename do router segue `import.meta.env.BASE_URL` automaticamente. `public/_redirects` é o fallback SPA do Pages — preserve; `public/404.html` é herança do GitHub Pages e está inerte.
- Build do Cloudflare Pages: comando `npm run build`, saída `dist`, env vars `VITE_BASE_PATH=/`, `VITE_SITE_URL=https://biblioteca-virtual.pages.dev`, `VITE_GOOGLE_CLIENT_ID` e `VITE_REEL_PROXY`. O workflow `.github/workflows/react-vite.yml` virou só CI (testes + build de validação) — o deploy é do Pages.
- Não editar arquivos gerados em `dist/`; faça mudanças nas fontes e gere outro build. Os ícones e o redirecionamento estáticos ficam em `public/`.
- O deploy é automático pelo Cloudflare Pages em push na `main`; a Action só valida (testes + build). Não existe publicação local — o antigo script `deploy` (gh-pages) foi removido de propósito, pois usava o `.env` local e poderia vazar chaves no bundle. Só executar commit/push quando solicitado; validar o build antes.
