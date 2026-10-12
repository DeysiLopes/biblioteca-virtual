# FEATURE.md — Inventário de funcionalidades e animações do MVP 1 (PWA vanilla)

Fonte da verdade de **quais features e efeitos visuais do MVP 1 devem ser preservados** na migração para o MVP 2 (React + Vite + TS / SPA + PWA). Qualquer corte nesta lista precisa ser decidido explicitamente na clarificação/história.

## Arquivos analisados

| Arquivo | Papel |
| --- | --- |
| `index.html` | App inteiro (HTML + CSS + JS inline, ~1800 linhas). Estante, diário, fichário, caderno, capa 3D, página de citação, sync GitHub, backup, PWA, notificações. |
| `sw.js` | Service Worker: precache, estratégias de cache por tipo de recurso, skipWaiting/auto-update, notificações e agendamento. |
| `manifest.webmanifest` | Metadados PWA (nome, ícones 192/512 + maskable, cores, standalone). |
| `gerar-books.js` | Seed: gera `books.json` a partir de um banco **Notion** (token local). **Legado dos dados do dono — removido ao migrar.** |
| `books.json` | Catálogo seed (~80 livros pessoais). **Removido ao migrar** (08-limpeza-git-tree); Drive passa a ser a fonte. |
| `scripts/browser-test.cjs` | Executor de navegador headless (Chromium, perfil em memória, sincronização desativada). |
| `scripts/test-{estante,filtros,leitura,citacoes,dashboard,resenha,sync}.cjs` | Verificações por área (ver seção Testes). |
| `scripts/icons.cjs` | Geração local dos ícones do app. |

## Funcionalidades por área

### A1. Estante
- Abas **Estante / Diário** com persistência da última aba na sessão.
- **Filtros**: por status (Todos/Quero ler/Lendo/Lido/Abandonado), por gênero (select gerado dos livros, ignorando acentos/caixa) e **busca** por título/autor (normalização NFD, tolerante a acentos).
- **Stats da estante**: total na biblioteca, quantidade lendo, quantidade lidos, páginas de hoje.
- **Prateleiras**: `books` agrupados em `Minha estante` e `Livros lidos`, empacotados por largura disponível em linhas (estilo "estante real"), com título/contagem por prateleira.
- **Cards de livro** ("spines") com altura derivada do hash do título; capa com `loading="lazy"` e fallback; **iniciais em gradiente** (2 cores por hash) quando não há capa.
- Clique no card abre o livro (A6) animando a capa até o painel.

### A2. Catálogo / dados
- `loadCatalog`: busca `books.json` (rede primeiro, cache em `localStorage` como fallback) e **mescla com o local** — livro local não catalogado é preservado; campos locais de `OVERRIDE` vencem o catálogo.
- Normalização `norm()` (lowercase + strip acentos + colapso de espaços) usada em buscas, gêneros e dedupe de CSV.
- IDs: `crypto.randomUUID` com fallback; livros importados viram `imp:<slug-title>:<autor>`.

### A3. Estante de leitura — modal geral do livro
Modal **único compartilhado por Estante e Diário** (`openBook`/`renderPanel`, sem formulário separado do Diário).
- Campos: **livro** (select troca de livro), **status**, **tipo** (Estudo/Lazer), **progresso** (total já lido + total do livro), **início/fim**, **comentários gerais**.
- **Páginas lidas = total já lido** (informa o total, não soma; digitar 100 salva 100). `books.paginasLidas` é a única fonte do progresso; `saveBook` grava o valor e `persistReading` usa transação IndexedDB (`books`+`diary`).
- Preview dinâmico do percentual enquanto digita; barra de progresso com `role="progressbar"` e ARIA completa.
- Ao aumentar páginas: transição de status (Quero ler→Lendo→Lido), preenche `inicio`/`fim`. Ao reduzir e não mais ser "Lido": volta para Lendo.
- **`readingEpoch`**: marca reinícios (0→>0 ou >0→0) e é sincronizado no livro/nas sessões, para registros antigos não voltarem ao dashboard.
- Aumentos geram registro histórico da diferença no diário; o histórico **nunca recalcula** o progresso.
- Fechar por Esc, clique no fundo ou botão; focar retorna ao card de origem.

### A4. Diário
- Botão `＋ Registrar leitura de hoje` (abre o modal geral no livro atual "Lendo" ou o primeiro).
- **Stats**: Hoje / Sequência (streak, ignora hoje se ainda não há registro) / Total lido / Registros.
- **Gráfico semanal**: 7 barras (hoje destacada), altura proporcional, com valor por cima.
- **Lista agrupada por livro**, ordenada por atividade recente; mostra status, nota em estrelas, data do último registro (relativa "hoje"), progresso, comentários, resenha e botão **Fichário de citações (n)**.
- **`dashboardEntries`**: compartilhado por Hoje/sequência/registros/gráfico; limita contribuições ao progresso atual de cada livro; livro zerado não contribui; respeita `readingEpoch`.
- Capa do livro no diário abre a **capa 3D** (A7); clique no cartão abre o modal de edição; migração automática de ids numéricos do diário.
- **Capa sempre clicável no diário** mesmo se a imagem falhar: wrapper fixo (`.cwrap`) com fallback visual (`.fbmini`) mantém área de toque e abertura da capa 3D.

### A5. Fichário de citações
- Folha central em **coreografia de fichário** (argolas à esquerda, abas arredondadas à direita, folha pastel), 1 citação = 1 **aba lateral** (rolável), cores pastel em ciclo.
- **Modos**: leitura da citação (texto + número da página) e escrita/edição (`ficharioState` guarda aba e modo; **página obrigatória**).
- **Editar preserva o id e o timestamp de criação** (não duplica nem reordena abas); salvar ajusta `updatedAt`; cancelar não salva; **excluir exige confirmação**.
- Foco e acessibilidade: trap de Tab, setas/Home/End movem abas, `role=tabs`+`aria-selected`, a aba selecionada recebe foco.
- Botões: Nova citação, Editar, **Ler página** (abre A8), Excluir.

### A6. Capa 3D (flip card)
- `#flipview`: a **capa do livro gira em 3D** (perspectiva, `rotateY`) e revela a **contracapa com a resenha**; gira sozinha após 260ms; botão `Escrever/Editar resenha` habilita após a virada.
- Ativável pelo `coverbtn` do diário; teclado (Enter/Espaço) gira; Esc fecha; `flipEvents` cancela listeners ao fechar.

### A7. Caderno (escrever/editar resenha)
- Folha de caderno com **linhas pautadas**, margem e textarea monoespaçada; título e dica; botões Som de teclado / Fechar / Salvar.
- **Animação de "docking" da capa**: a capa 3D em miniatura re-dobra até o topo do caderno com `coverDock` e vira de volta (`rotateY(360deg)`).
- **Som de teclado opcional** (WebAudio procedural — clique "Som: ligado"); feedback tátil de digitação (`typeStrike`).
- Salvar = apenas o texto da resenha (`books.resenha`); toasts de feedback; foco retorna ao elemento de origem.

### A8. Página de leitura da citação
- `#leitura`: livro aberto com **folhas virando** (`leafTurn`, 3 folhas com delay escalonado), página centralizada mostrando a **citação completa** (rolável sem cortar o início) e a numeração `pág. N`.
- Cabeçalho com o título do livro; fechar por X, Esc ou clique fora; foco no botão de fechar.

### A9. Sincronização (GitHub — **legado, descontinuado no MVP 2**)
- Token **fine-grained** armazenado em IndexedDB (`META.githubToken`), botões Sincronizar agora / Salvar token / Fechar, e **indicador de status** (`syncDot`/`syncStat`: on/err/busy, "sincronizado HH:mm").
- Escrita/leitura de `data/sync.json` via **GitHub Contents API** com base64; leitura pública por `raw.githubusercontent.com` mesmo sem token.
- **Merge por `updatedAt`** (livros; mais novo vence), **citações** tratadas com `deletedCitacoes`/limpeza de lista vazia, **diário** por união de id com `ts` maior.
- Pull automático: inicialização, `visibilitychange`, `focus`, `online`. Push: debounce 800ms ao editar; flush com `keepalive` no `pagehide`/`beforeunload`; **retry em 409/422**; erros traduzidos em pt-BR e exibidos em toast.
- **"Forçar atualização do app"**: limpa registros de SW e caches e recarrega.
- `bib-syncerr` guarda o último erro.

### A10. Backup / importação
- **Export**: baixa `biblioteca-backup-<data>.json` (books + diary + meta) via Blob; toast de confirmação.
- **Import CSV** (e .txt): detecta delimitador (`\t`/`;`/`,`), parser com aspas duplas escapadas, **mapeamento flexível de cabeçalhos** (pt/en: título, autor, páginas, nota 0–5 ou 0–10, status, gênero, formato, idioma, tipo, datas, comentários, resenha, ISBN), normalização de datas/status/nota, **dedupe por título**, gera capas via **Open Library** para até 20 livros novos.
- Import JSON do próprio backup (MVP 2: import também JSON; hoje apenas CSV). *(Deixar explícito: no MVP 1 o JSON de export é backup; o MVP 2 trata o JSON do Drive como banco.)*

### A11. PWA / app instalável
- **Service Worker** (`sw.js`): precache (shell + manifest + ícones + `books.json`); navegação **rede primeiro com fallback offline** ao shell; `books.json` rede primeiro/cache; recursos same-origin cache-first com atualização silenciosa; **capas externas** (Open Library/Google Books) cache-first p/ funcionar offline.
- **Auto-update**: `updateViaCache:"none"`, `skipWaiting` ao instalar nova versão e reload do cliente controlado (`controllerchange`).
- **Manifest**: `standalone`, `id/start_url/scope "./"`, cores `#17100f`, `lang pt-BR`, ícones 192/512 + maskable; **instalação** via `beforeinstallprompt` (botão 📱 Instalar), `appinstalled`, escondido em modo standalone.
- **Notificações**: lembrete diário (20:00) — pede permissão, agenda com `setTimeout`, dispara `Notification` + SW, e usa **`NotificationTrigger` (`showTrigger`)** quando disponível (agendamento real); `notificationclick` foca a janela.
- Tela de carregamento "abrindo a biblioteca…" com spinner.

### A12. Identidade visual / responsividade / acessibilidade
- Tema "noite aconchegante": CSS variables `--paper #201812`, `--ink #efdfc8`, `--wood #917157`, `--accent #e09a5b`, `--green #4c9a6a`, easing `--ease cubic-bezier(.22,1,.36,1)`; fontes Cormorant Garamond (títulos) + Nunito (texto); `theme-color #17100f`.
- **Responsivo**: modal vira "sheet" em telas < 760px; ajustes em `max-height:560px`; barras e grid adaptáveis.
- **`prefers-reduced-motion: reduce`**: desliga todas as animações/transições das telas 3D.
- Acessibilidade: `role="dialog"`/`aria-modal`, `aria-labelledby`, `aria-pressed`, `escaped reviewText` (anti-XSS), foco retornado ao fechar, gerenciamento de Esc em cascata (leitura → caderno → capa → fichário → modal), trap de Tab.
- Linguagem **pt-BR** nas mensagens de status/erro/toasts.

## Animações e transições (inventário CSS)

Todas usam `--ease` salvo indicação. **Regra: preservar na migração** (equivalente funcional + visual), ou decisão explícita de corte.

| Seletor / ref | Efeito | Mecânica |
| --- | --- | --- |
| `.fly-cover` (modal) | Capa cresce da sua posição até o painel (e volta ao fechar). | `transition: left/top/width/height .55s var(--ease)` + RAF duplo; painel fade `.35s ease .25s`. |
| `.flip-inner` (capa 3D) | Virada 3D da capa → contracapa. | `transform-style:preserve-3d`; `rotateY(180deg)` + volta; `transition transform .8s cubic-bezier(.5,.05,.3,1)`; perspectiva. |
| `leafTurn` + `.leaf` | Folhas do livro de leitura viram (3 camadas, delays 0/.12/.24s). | `@keyframes leafTurn` (rotateY 0→-172deg, opacidade), backface oculta. |
| `focusIn` + `.pagina` | Página de citação ganha foco suave. | `@keyframes focusIn` (opacity + scale .9→1) `.7s .5s var(--ease)`. |
| `leituraIn` | Abertura de `#leitura` e `#flipview`. | fade `.3s ease`. |
| `ficPageIn` | Troca de aba/página no fichário. | slide X `translateX(10px)→0`, `.3s var(--ease)`. |
| `.fic-shell` | Fichário "assenta" e endireita. | `translateY(14px) rotate(-2deg) scale(.94)`→base `.55s var(--ease)`. |
| `.fic-paper` | Cor da folha troca com a aba. | `transition background .3s ease`. |
| `notebookRise` + `.caderno` | Caderno sobe/desfoca ao abrir. | `@keyframes notebookRise` (Y 90px + rotateX + scale .82 + blur→0) `.85s .15s var(--ease)`. |
| `coverDock` + `.cad-cover.docked` | Capa re-dobra do centro para o topo do caderno. | `@keyframes coverDock` (`--cover-x/y/scale`); `.flip-inner` gira 360° `.85s .1s var(--ease)`. |
| `typeStrike` + `.cad-writing.typing` | "vibrinha" da linha ao digitar. | `.13s ease-out`. |
| `reviewFocus` + `#caderno.open` | Fundo do caderno foca (blur). | `.45s ease` (background + backdrop-filter). |
| `.book-card` cover | Card responde ao hover. | `transition transform .3s var(--ease), filter .3s`; alturas variáveis por hash. |
| `.pp .bar>div` | Barra de progresso atualiza com easing. | `transition width .3s var(--ease)`. |
| `.week .wcol .bar` | Barras do gráfico semanal crescem. | `transition height .4s var(--ease)`. |
| `.syncstat.load .s`, `.spin` | Spinner de carregamento/sincronização. | `@keyframes spin`. |
| Pills, botões, `.stars span`, `.fic-tab`, toast, `.fic-body` | Micro-interações/hovers. | transitions curtas `.15–.35s`. |
| `@media (prefers-reduced-motion: reduce)` | **Desliga todas** as animações acima. | `animation:none` / `transition:none` nos alvos 3D. |

## Testes automatizados (suíte legada — alvo da migração p/ Vitest+RTL)

| Script | Cobre |
| --- | --- |
| `scripts/browser-test.cjs` | Runner headless Chromium: perfis em memória, sync desativada, viewport ampla + compacta + reduced-motion, sem tocar em IndexedDB/dados reais. |
| `scripts/test-estante.cjs` | Estante, prateleiras, stats. |
| `scripts/test-filtros.cjs` | Filtros status/gênero/busca. |
| `scripts/test-leitura.cjs` | Modal geral + progresso compartilhado (100 = 100, sem somar). |
| `scripts/test-citacoes.cjs` | Fichário: abas, edição preserva id/ts, cancelar não salva, excluir confirma. |
| `scripts/test-dashboard.cjs` | Hoje/sequência/registros/gráfico, limitação ao progresso atual, `readingEpoch`. |
| `scripts/test-resenha.cjs` | Sintaxe do JS inline + capa 3D + caderno (som desligado por padrão nos testes). |
| `scripts/test-sync.cjs` | Merge/conflitos do sync GitHub (área descontinuada no MVP 2). |
| `scripts/icons.cjs` | Gera ícones do manifest. |

## Decisões de migração (o que muda no MVP 2)

1. **Sync GitHub → Google Drive** (banco do usuário). `data/sync.json` deixa de ser gravado (A9 vira legado).
2. **`books.json`/Notion seed → modelo por usuário no Drive**. Livros do dono migram 1x; novos usuários começam vazios.
3. **Import continua** (CSV + JSON) e **export = baixar o próprio JSON do Drive**. A rota `/books` passa a ter adição por ISBN (Open Library), manual e import (A10 ampliado).
4. **Regras da estante/"reading flow" são preservadas**: páginas = total, sem soma; transações IndexedDB; `readingEpoch`; fichário com página obrigatória e preservação de id/ts; dashboard limitado ao progresso atual.
5. **Animações e identidade visual da tabela acima**: preservar (equivalente em React/estilo), respeitando `prefers-reduced-motion`.
6. **Testes**: migrar a suíte para Vitest + RTL (A11/A5/A4…), mantendo cobertura equivalente.
7. PWA gerada por `@vite-plugin-pwa` (manifest + SW + versionamento). Notificações/lembrete: manter comportamento (schedule + `showTrigger` quando disponível).