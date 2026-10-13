# CONTEXT.md — Minha Biblioteca

Documento de contexto do projeto **Minha Biblioteca** (PWA de estante + diário de leitura),
com histórico do que foi feito, arquitetura, decisões e estado atual.

Última atualização: 2026-10-13 (scan de reels com IA por link; ver seção 16).

---

## 1. Visão geral

- **O que é**: aplicativo web (PWA) para catalogar livros, marcar leituras e manter um
  diário/resenhas. Visual "noite aconchegante" (madeira, papel envelhecido, tons pastel).
- **Onde roda**: GitHub Pages (estático, sem backend).
- **Persistência**: IndexedDB no aparelho + sincronização opcional via GitHub (Contents API)
  num arquivo `data/sync.json` do próprio repositório.
- **Idioma**: interface e comunicação em pt-BR.

### URLs e repositório

- Repositório: `DeysiLopes/biblioteca-virtual` (branch `main`, app na raiz do repo).
- App publicado: https://biblioteca-virtual.pages.dev/ (Cloudflare Pages; o GitHub Pages `deysilopes.github.io/biblioteca-virtual/` foi desativado)
- Sync cru (sem cache, para leitura):
  `https://raw.githubusercontent.com/DeysiLopes/biblioteca-virtual/main/data/sync.json`
- Sync (escrita via API):
  `https://api.github.com/repos/DeysiLopes/biblioteca-virtual/contents/data/sync.json`

---

## 2. Stack e ambiente

- HTML/CSS/JS "vanilla", tudo em um único `index.html` (o app inteiro).
- PWA: `manifest.webmanifest` + `sw.js` (service worker).
- Sem frameworks, sem build step. Ícones gerados por `scripts/icons.cjs`.
- Node usado apenas para: geração de ícones, scripts locais e **testes headless**.
- Ambiente de desenvolvimento: Linux; Node v25.2.1; Chromium **152** em `/usr/bin/chromium`
  (headless funciona); **sem jsdom**.

---

## 3. Estrutura de arquivos

```
biblioteca-virtual/
├── index.html              # app completo (HTML + CSS + JS inline)
├── sw.js                   # service worker (VERSION = "bib-vN")
├── manifest.webmanifest    # bg/theme #17100f
├── books.json              # catálogo base inicial
├── data/
│   └── sync.json           # dados sincronizados (livros + registros + citações)
├── scripts/
│   ├── browser-test.cjs    # executor isolado de teste com Chromium headless
│   ├── icons.cjs           # geração de ícones do PWA
│   ├── test-citacoes.cjs   # testes do fichário de citações
│   ├── test-dashboard.cjs  # testes do dashboard
│   ├── test-estante.cjs    # testes da estante e prateleiras
│   ├── test-filtros.cjs    # testes dos filtros de busca/gênero
│   ├── test-leitura.cjs    # testes do modal e progresso
│   ├── test-resenha.cjs    # testes da resenha (caderno)
│   └── test-sync.cjs       # testes de sincronização de citações
├── identidade-visual/      # referências visuais (estrutura + 4 fotos de cores + citações)
├── todo.md                 # roadmap de funcionalidades e correções
├── todo-isbn.md            # estudo separado da integração por ISBN
└── README.md
```

Ferramentas de automação do usuário (fora do repo, em `~/.local/bin`):
`biblioteca-atualizar`, `tbr-importar-pasta`, `importar-livros`.

---

## 4. Modelo de dados

### Livro (`books`)

```js
{
  id,            // string (ex.: UUID do Notion ou slug)
  title, author,
  cover,         // URL da capa
  codigo_isbn,   // ISBN-10/13 normalizado (sem hífens); preenchido pela
                 // aba "✨ Capas & ISBN" em /books ou pela busca por ISBN
  status,        // ex.: "Lendo"
  nota,          // 0..5
  resenha,       // texto da resenha (editável no caderno)
  citacoes: [    // array de citações do livro
    { id, text, page, ts }
  ],
  comentarios,   // registros/notas do diário
  inicio,        // data de início (opcional)
  updatedAt      // timestamp (usado para ordenação/merge)
}
```

### Registro do diário (`diary` / entries)

- Registros de leitura com data, páginas, notas; associados a um `bookId`.
- Convertidos em cartões do diário (`renderDiary`), um por livro.

### Fichário de citações

- Cada livro pode ter várias citações `{id, text, page, ts}`.
- **Página é obrigatória** ao adicionar.
- Cores pastel para os cartões:

```js
CIT_PASTEL = ["#e8c9a0","#cbd8b4","#e6c3bf","#bccbdd","#dcc6e0","#e6dcae"]
```

---

## 5. Sincronização (GitHub)

- Fluxo: IndexedDB local + `pushSync`/`pullSync` contra `data/sync.json`.
- **Token fine-grained** do GitHub fica salvo **no IndexedDB** (meta `githubToken`) por
  aparelho. Nunca no repositório.
- Escrita: `PUT` na Contents API com `Authorization: Bearer <token>` (e o SHA atual do
  arquivo para evitar conflito).
- Leitura: sem token, via `raw.githubusercontent.com/.../data/sync.json?v=<ts>` (cache-bust).
- Conflitos: loop de tentativa (até **6x**) para corridas `409`/`422`.
- Assinatura de `pushSync(flush, force)`; handlers aguardam `await pushSync(false, true)`.
- `syncState.busy` controla reentrância; toast em pt-BR comunica o estado.

### Campos sincronizados

- `OVERRIDE` inclui `citacoes`.
- `pickOV` **pula arrays vazios** (não sobrescreve local com `[]`).
- `loadData` normaliza `b.citacoes = []` quando ausente.
- `mergeCatalog` / `buildSyncPayload` / `applyRemote` propagam `citacoes`.

### ⚠ Segurança

- Um **token fine-grained foi colado no chat** durante o desenvolvimento
  (`github_pat_11AC2457A0...`). **Recomendação pendente: revogar/rotacionar.**

---

## 6. PWA e cache (problema resolvido)

### Sintoma

Mudanças commitadas não apareciam no navegador.

### Causa raiz

- GitHub Pages envia `cache-control: max-age=600` em `index.html` e `sw.js`.
- O service worker antigo fazia `fetch(e.request)`, passando pelo cache HTTP e servindo a
  versão velha por até 10 minutos.

### Correções aplicadas (v17+)

- `sw.js`: busca `index.html` e `books.json` com `{ cache: "reload" }`.
- `sw.js`: trata mensagem `skipWaiting`.
- `registerSW`: registra com `{ updateViaCache: "none" }`, chama `reg.update()`, recarrega
  na `controllerchange` (só se já havia controller) e envia `skipWaiting`.
- Botão **"↻ Forçar atualização do app"** (`#swReset`) no formulário de sync: limpa
  service worker + caches e recarrega.
- **Bump de `VERSION`** (`bib-vN`) a cada deploy.

### Cache de capas externas (v24+)

- Capas de Open Library e Google Books são cacheadas com estratégia cache-first para
  funcionar offline. Respostas `ok` ou `opaque` são armazenadas no cache do SW.

### Integração Open Library (`src/core/business/open-library.ts`)

- `fetchBookByISBN(isbn)`: consulta `/isbn/{isbn}.json`; prefere `covers[0]` da edição
  (`b/id/{cover_i}-L.jpg`) — o endpoint `b/isbn/` devolve um GIF 1×1 transparente
  quando a edição não tem capa.
- `searchBookByTitleAuthor(title, author)`: busca `/search.json` e só aceita docs cujo
  título corresponde (normalizado, sem acentos) — prefere ISBN-13 978/979 e `cover_i`.
- **Automático**: cadastro manual busca metadados antes de salvar; importação
  CSV/JSON enriquece em segundo plano. Só campos vazios são preenchidos.
- Aba **"✨ Capas & ISBN"** em `/books`: varredura manual da estante, ~1 req/s
  (limite público da OL), com log por livro.
- `getBookCover(book)` (BookCard): usa `book.cover`, senão deriva de `codigo_isbn`;
  `hideTinyCover` esconde placeholders ≤4px para o gradiente aparecer.

### Notificações (v24+)

- Mensagem `notify`: exibe notificação imediata com título e corpo personalizáveis.
- Mensagem `schedule`: agenda notificação futura via `NotificationTrigger` (experimental,
  depende de suporte do navegador).
- Clique na notificação foca a janela existente ou abre uma nova.

---

## 7. Funcionalidades interativas (Diário)

Tudo em `index.html`, com overlays full-screen controlados por classe `.open`.

### 7.1 Overlays

Containers no HTML (por volta das linhas 452–455):

```html
<div id="fichario"></div>   <!-- citações -->
<div id="flipview"></div>   <!-- virar capa -> contracapa -->
<div id="caderno"></div>    <!-- resenha (caderno pautado) -->
<div id="leitura"></div>    <!-- página de livro com citação -->
```

Gestão: `Esc` fecha o overlay aberto; clique no fundo do overlay fecha.

### 7.2 Fichário de citações

- Funções: `openFichario`, `closeFichario`, `renderFichario`, `addCitacao`, `delCitacao`.
- Aberto a partir do modal do livro: botão `.cite-btn` (`data-act="fichario"`) →
  `closeBook(); setTimeout(() => openFichario(id), 560)`.
- Cartões `.ficard` (pastel), com botão de excluir; botão `.ficard.add` para adicionar.
- `.ficard` é `div`; o excluir é `button`.

### 7.3 Animação de virar o livro (capa → contracapa)

- Funções: `openFlip(bookId)`, `closeFlip()`.
- Estrutura: `.flip-book` > `.flip-inner` > `.flip-face.front` / `.flip-face.back`.
- CSS: `perspective` no `#leitura .book` (`1800px`) e transform 3D no `.flip-inner`.
- Ao abrir: após **260 ms** adiciona `.flipped` (gira automaticamente para a contracapa).
- Contracapa mostra `.blab` ("Contracapa"), `.rv` (a resenha ou mensagem vazia) e `.hint`.
- Clique no livro: se já `.flipped` → `closeFlip()` + `openCaderno(bookId)`; senão, gira.
- Clique no fundo do `#flipview` fecha.

> **Bug corrigido em `bib-v20`**: havia **`id="fbook"` duplicado** (o `<select>` do
> formulário do diário em `index.html:439` e o `<div>` do livro em `~1123`). O livro agora é
> referenciado pela **classe** `.flip-book`, eliminando a colisão.

### 7.4 Caderno (resenha)

- Funções: `openCaderno(bookId)`, `closeCaderno()`, `saveCaderno(bookId)`.
- Pauta imitando caderno:
  `repeating-linear-gradient` com espaçamento **34px**; `textarea` com `line-height: 34px`.
- Textarea `#cadTxt`; botões `#cadCancel` (fechar) e `#cadSave` (salvar).
- `saveCaderno`: `Object.assign({}, b, { resenha: txt, updatedAt: Date.now() })` →
  `await putOf("books", next)` → atualiza `BOOKS[i]` → re-render.

### 7.5 Página de leitura (citação)

- Funções: `openLeitura(bookId, citacao)`, `closeLeitura()`.
- Três `.leaf` com animação `leafTurn` (via `--delay`); `.pagina` com `focusIn`.
- Mostra a citação (`.quote`) e o número da página (`.pnum`, ex.: `pág. 42`).

### 7.6 Capa clicável no diário (`bib-v19`)

- **Causa do bug**: quando a `img` da capa falhava, `onerror="this.remove()"` deixava o
  `.coverbtn` **vazio** (0px, sem área de toque).
- **Solução**: wrapper `.cwrap` **sempre** com `.fbmini` (capa de reserva) atrás da `img`.
- CSS: `.coverbtn{background:none;...}`, `.nbook .cwrap{width:40px;height:58px}`,
  `.nbook .cwrap img, .nbook .cwrap .fbmini{position:absolute;inset:0;width/height:100%}`.
- `renderDiary` (~linhas 1251–1256): capa em `.coverbtn`/`.cwrap`.
- Handler (~1273–1281): `.nbook` click → `openBook`; `.coverbtn` click →
  `e.stopPropagation()` + `openFlip(btn.dataset.flip)`.

### 7.7 Modal único do livro (`bib-v12`)

- Um cartão por livro; um modal único com registros editáveis inline.
- Funções: `entryRowHTML`, `bindEntryRow`, `addEntryRow`, `saveEntryRow`.

### 7.8 Dashboard (`bib-v24`)

- `dashboardEntries` é compartilhado por Hoje, sequência, registros e gráfico semanal.
- Limita as contribuições ao progresso atual de cada livro; livro zerado não contribui.
- `readingEpoch` marca reinícios e é sincronizado no livro e nas novas sessões.

### 7.9 Filtros de busca e gênero (`bib-v25`)

- Campo de busca por título/autor na estante.
- Dropdown (`select`) de gêneros: "Todos os gêneros" + gêneros disponíveis sem
  duplicatas, em ordem alfabética, case-insensitive.
- Combina com filtro de status; filtra apenas a visualização, sem alterar dados.

### 7.10 Prateleiras de livros lidos (`bib-v25`)

- Livros com status "Lido" ficam em seção separada no final da Estante.
- Mudança de status move o livro entre as seções; capas clicáveis e modal preservados.
- Prateleiras vazias não são exibidas; filtros se aplicam também aos lidos.

### 7.11 Exclusão de citações e `deletedCitacoes` (`bib-v25`)

- `delCitacao` grava exclusão e registra o ID em `deletedCitacoes` para sincronização.
- `pickOV` foi ajustado para não descartar `citacoes: []` (array vazio).
- Merge entre aparelhos respeita exclusões explícitas.

---

## 8. Design / identidade visual

Variáveis CSS principais:

```
--paper:  #201812   /* fundo */
--ink:    #efdfc8    /* texto */
--accent: #e09a5b    /* madeira/laranja */
--green:  #4c9a6a
madeira:  #917157
```

- Manifest: `background_color` e `theme_color` = `#17100f`.
- Referências em `identidade-visual/` (`estrutura-biblioteca.jpg` + 4 fotos de cores).

---

## 9. Testes (headless Chromium)

Sem jsdom no ambiente → testes com Chromium headless via `--dump-dom`.

### 9.1 Executor centralizado (`browser-test.cjs`)

`scripts/browser-test.cjs` — levanta servidor estático, injeta script de teste em
`index.html`, executa no Chromium headless e extrai o resultado. Usa armazenamento em
memória e sincronização desativada para não alterar IndexedDB ou dados reais do GitHub.
Perfis temporários são removidos ao final.

### 9.2 Scripts de teste

Todos executados com `node scripts/test-<nome>.cjs`:

| Script               | O que testa |
|----------------------|-------------|
| `test-resenha.cjs`   | Fluxo capa → contracapa → caderno de resenha |
| `test-leitura.cjs`   | Modal do livro e progresso compartilhado |
| `test-citacoes.cjs`  | Fichário de citações: abas, editor, exclusão |
| `test-dashboard.cjs` | Dashboard: entradas, sequência, gráfico semanal |
| `test-estante.cjs`   | Estante e prateleiras de livros lidos |
| `test-filtros.cjs`   | Filtros de busca por título/autor e dropdown de gênero |
| `test-sync.cjs`      | Sincronização de citações e `deletedCitacoes` |

Testes validam viewport ampla e compacta, incluindo `prefers-reduced-motion`.

### 9.3 Execução legada (pré-v21)

O método original usava `/tmp/opencode/srv.js` + `/tmp/opencode/mktest.js` com
`__t.html` temporário. Substituído por `browser-test.cjs` a partir de `bib-v21`.

Notas preservadas:
- Usar `timeout -s KILL` (Chromium às vezes ignora SIGTERM).
- Redirecionar a saída do Chromium para arquivo (evita o shell travar no pipe).
- Método **CDP/`--remote-debugging` foi abandonado** (travava / timeout) → `--dump-dom`.

---

## 10. Histórico de deploys

| Versão    | Commit    | Descrição |
|-----------|-----------|-----------|
| bib-v8    | `864cf56` | Sync resiliente; toast pt-BR |
| bib-v9    | `b92a006` | Fix `syncState.busy`; `pushSync(flush, force)` |
| bib-v10   | `fb396fe` | Loop 6x p/ corrida 409/422 |
| bib-v11   | `052db0e` | Diário unificado |
| bib-v12   | `27cfbb6` | Um cartão por livro; modal único com registros inline |
| bib-v13   | `38eaab3` | `pointer-events:none` |
| bib-v14   | `96a9db8` | Capa ao lado / em cima |
| bib-v15   | `b2175c1` | Capa não encolhe |
| bib-v16   | `aff74f6` | Fichário, leitura, flip e caderno |
| bib-v17   | `60834bd` | SW `cache:"reload"` + auto-reload |
| bib-v18   | `60d7adf` | Botão "↻ Forçar atualização do app" (`#swReset`) |
| bib-v19   | `7f9f609` | Capa sempre clicável (`.cwrap` + `.fbmini` de reserva) |
| bib-v20   | `fce4030` | Fix `id="fbook"` duplicado (flip→caderno usa `.flip-book`) |
| bib-v21   | `b7038ec` | Conectar contracapa ao caderno de resenha; testes headless |
| bib-v24   | `d06f107` | Progresso unificado, fichário refinado, dashboard, notificações no SW, cache de capas externas |
| bib-v25   | `67b765b` | Filtros de busca/gênero (dropdown), prateleiras de lidos, correção de exclusão/sync de citações (`deletedCitacoes`). **Atual** |

> **Nota**: v22 e v23 não existem como commits separados; a numeração saltou direto
> de v21 para v24 no desenvolvimento.

Commits de sync (`data/sync.json`) são criados via API (ex.: `198d16f`) e intercalam a
história; ao dar push, sempre `git pull --rebase origin main` antes.

Commits de sync históricos (inofensivos): `bfb8533 "sync: limpar teste"`,
`de81bb45 "sync: teste"`, `fd38f7b1 "sync: seed"`, `6b670399`, `ea5bd796`.

---

## 11. Fluxo de deploy

1. Editar `index.html` / `sw.js`.
2. Validar JS inline:

```bash
cd /home/deysi/workspace/biblioteca-virtual
node -e 'const fs=require("fs");const h=fs.readFileSync("index.html","utf8");
const m=h.match(/<script>([\s\S]*?)<\/script>[^<]/);fs.writeFileSync("/tmp/opencode/check.js",m[1]);'
node --check /tmp/opencode/check.js && echo "JS OK"
```

3. Conferir ausência de caracteres problemáticos (U+2423, U+00A0).
4. Bump `VERSION` em `sw.js` (`bib-vN` → `bib-vN+1`).
5. Remover `__t.html` se existir.
6. `git add ... && git commit` (autor `DeysiLopes` / `deysilinconl@gmail.com`).
7. `git pull --rebase origin main` (pode puxar commits de sync).
8. `git push origin main`.
9. Verificar: raw imediato; Pages pode demorar ~10 min (cache `max-age=600`).

---

## 12. Comandos úteis

```bash
# validar JS
node --check /tmp/opencode/check.js

# ver versão do SW publicada
curl -s "https://biblioteca-virtual.pages.dev/sw.js?v=$(date +%s)" | grep VERSION

# limpar cache local (no navegador): botão #swReset ou Ctrl+Shift+R
```

---

## 13. Pendências / próximos passos

Roadmap completo em `todo.md`. Itens prioritários:

- [ ] **Revogar/rotacionar** o token fine-grained do GitHub que foi exposto no chat.
- [ ] Validar no aparelho o fluxo completo após `bib-v25`: filtros, prateleiras de lidos,
      exclusão de citações e sincronização entre dispositivos.
- [ ] Validação estética depende do usuário (o assistente não enxerga imagens).
- [ ] Exportação CSV da biblioteca (importação já existe).
- [ ] Revisão de `exportBackup` (pode incluir `githubToken` no `META`).
- [ ] Funcionalidades futuras: IA para Reels/TikTok, tags, séries, ISBN (ver `todo.md`).

---

## 14. Observações

- Feature "Notícias/Notion" não faz parte do fluxo atual (referências antigas:
  página `3f61815b-43b3-8030-b377-c4730558275d`, DB
  `3f61815b-43b3-818c-9486-c2a0f3a81179`, token em `~/.config/opencode/notion-token`).
- Todo o JS do app é inline em `index.html`; qualquer alteração exige bump do `sw.js` para
  que usuários recebam a nova versão.
- O `sw.js` atual está com `VERSION = "bib-v24"` mas o commit `67b765b` (v25) não bumped
  o SW; considerar alinhar na próxima alteração.

### Atualização da migração React (2026-10-12)

- Fluxo da resenha igual ao MVP 1: a capa abre centralizada no Diário, vira sozinha para
  a contracapa (~260ms) e fica interativa após o giro (~820ms, `ready`). Clique na capa ou
  no botão sobe o caderno, com a capa encaixada acima da folha (`cad-cover`/`coverDock`).
- Salvar ou fechar a folha retorna à **contracapa** (o `FlipBook` continua montado,
  `isOpen=false` enquanto o caderno está aberto, preservando `flipped`/`ready`).
  Só o "Fechar" da contracapa (X, clique fora ou Esc) retorna ao Diário.
- A capa 3D recebeu dimensões compatíveis (`width`/`height` com fallback para `vh`) para
  não expandir até ocupar a página em navegadores que não interpretam `dvh` dentro de `min()`.
- O fluxo possui teste de regressão em `src/test/diary-review.test.tsx`; a suíte atual passa
  com 24 testes.

---

## 15. MVP 2 — Migração React + Vite + TypeScript (WEB-000)

Em 2026-10-12, a aplicação foi migrada de SPA vanilla para **React 18 + Vite + TypeScript** com rotas em domínio único e persistência em **Google Drive**:

1. **Roteamento SPA Client-side (React Router)**:
   - `/` e `/estante`: Página inicial da aplicação, abrindo diretamente a Estante de Livros dividida em "Minha estante" e "Livros lidos", filtros combinados de status, gênero dinâmico e busca tolerante a acentos (`normalizeString`).
   - `/diario` (e `/dashboard`): Diário de leitura com o Dashboard integrado (métricas de Hoje, Sequência/streak, Total lido, Registros e gráfico semanal de 7 dias), botão de registro rápido de leitura e cartões de livros com atividade recente, virada de capa 3D e acesso a resenhas/fichário.
   - `/books`: Rota dedicada para adicionar livros via busca por ISBN (Open Library), entrada manual de campos e importação em lote (CSV/JSON com deduplicação e relatório de erros).
   - `/fichario`: Fichário completo de citações com argolas, abas laterais pastel em ciclo de cores, página obrigatória e preservação de IDs/timestamps na edição.
   - `/caderno/:livroId`: Acesso direto ao caderno pautado de resenha com efeito sonoro opcional de máquina de escrever (Web Audio API).

2. **Arquitetura de Estado em Três Camadas**:
   - **Memória**: Hooks reativos (`useLibrary`, `useAuth`, `useSound`) e gerenciador centralizado (`syncManager`).
   - **Armazenamento Local**: IndexedDB (`books`, `diary`, `meta`) via `src/core/storage/idb.ts` para funcionamento offline instantâneo.
   - **Nuvem / Servidor**: Google Drive REST API v3 via `fetch` direto no navegador (escopo `drive.file`), salvando `biblioteca-<userId>.json` na pasta "Minha Biblioteca".
   - **Sincronização entre Abas**: `BroadcastChannel` (`biblioteca-sync`) com fallback em `storage event`.

3. **Autenticação Google Identity Services (GIS)**:
   - Login por token do GIS (`src/core/auth/google-auth.ts`) sem refresh token e sem segredos no cliente. Suporte a modo mock local para desenvolvimento offline.

4. **Regras de Negócio Preservadas (100% de paridade)**:
   - `paginasLidas`: representa o total já lido (digitar 100 salva exatamente 100, sem somar).
   - `readingEpoch`: marca reinícios e zerações para isolar métricas antigas no dashboard. Livros com progresso zerado não pontuam no dashboard.
   - Citações: página obrigatória; edição preserva `id` e `ts`; exclusão marca em `deletedCitacoes` para evitar ressuscitação no sync.
   - Export: download direto do próprio arquivo `biblioteca-<userId>.json` do Drive (sem transformações).

5. **PWA e Service Worker**:
   - Gerados automaticamente pelo `@vite-plugin-pwa` no build com precache, suporte offline e estratégia de atualização rápida.
   - `public/404.html` para redirecionamento SPA no GitHub Pages.
   - Deploy configurado para a branch `gh-pages` (`npm run deploy`).

6. **Testes Automatizados**:
   - 22 testes unitários e de integração em **Vitest + React Testing Library** (`npm run test`) cobrindo progresso, regras de readingEpoch, streak do dashboard, fichário, parser CSV/JSON e componentes React.

---

## 16. MVP 2 — Evolução de 2026-10-13

### 16.1 Modal do livro (paridade com MVP 1)

- `BookModal` recuperou a capa animada do MVP 1: ao clicar num livro, a capa "voa" do
  card até o lado esquerdo do painel (desktop) ou acima da folha (mobile), e volta ao
  fechar. Estante, Diário e Dashboard passam o rect de origem.
- Campo "Sua nota" com 5 estrelas clicáveis persiste `book.nota` junto ao salvar.
- Cor das estrelas apagadas ajustada para dourado visível no tema escuro.

### 16.2 Citações (ex-Fichário)

- "Fichário" virou **Citações**: rota `/citacoes` (`/fichario` redireciona), menu
  "💬 Citações". `CitacoesModal` substituiu `FicharioModal`/`QuoteReader`.
- A página de leitura é a cara principal: citações **ordenadas por `page` ascendente**,
  navegação por setas ‹ › (também teclado) com contador "N de M".
- Animação em cascata do MVP 1: avançar vira a folha atual + 2 folhas em branco para a
  esquerda (`rotateY` na lombada, delays 140/280ms); voltar espelha. `backface-visibility`
  esconde a folha após 90°; `prefers-reduced-motion` desativa.
- Ferramentas discretas no canto inferior esquerdo: editar ✎, nova ＋, excluir 🗑 e
  **som 🔊** (`playPageTurn` no `useSound` — whoosh de papel via Web Audio, mesma
  configuração do som da máquina de escrever).
- Edição/criação usa a mesma cara do caderno de resenha (papel pautado, Courier, som).

### 16.3 Cache de capas no Google Drive

- Pasta `Minha Biblioteca/capas/` no Drive: um arquivo por capa, nome `<isbn>.jpg` ou
  `book-<id>.jpg`. `book.coverFileId` aponta o arquivo e sincroniza no JSON normal.
- IndexedDB **v2** ganhou a store `covers` (blob local — leitura offline e sem refazer
  download do Drive).
- Resolução (`src/core/storage/cover-cache.ts` + `useBookCoverUrl`): memória →
  IndexedDB → Drive → URL remota (Open Library). Em background, capa remota nova é
  baixada, salva local, enviada ao Drive e `coverFileId` gravado no livro — dedup de
  uploads, ignora GIF 1×1 da OL, nunca quebra a estante em caso de falha.
- `needsMetadata` trata `coverFileId` como capa já encontrada. `resetLocalData` limpa o
  cache. `useBookCoverUrl` é usado por BookCard, BookModal, FlipBook, DiaryCard e
  ReviewNotebook (chamado antes de retornos condicionais, tolera `book` nulo).

### 16.4 Estante: seções por status + fila de leitura

- Prateleiras numeradas viraram seções fixas: **Lendo agora → Quero ler → Lidos →
  Abandonados**. Botões de status rolam até a seção (`scroll-margin-top` pelo header
  sticky). Filtros: dropdowns de **Gênero** e **Autor** (valores presentes na biblioteca).
- `book.filaPosicao` ordena a fila "Quero ler" (menor = topo; `null` = fora da fila).
  Persiste no IndexedDB e no JSON do Drive como parte do `Book`.
- **Drag-and-drop**: arrastar para "Lendo agora" muda `status` para Lendo (via
  `applyBookProgressUpdate`); arrastar para "Quero ler" põe o livro no topo da fila.
  Livro completo não regredde de Lido. No mobile, o modal oferece
  "📌 Colocar no topo da fila" (`src/core/business/queue.ts`).

### 16.5 Scan de reels com IA (`/books`, aba principal)

- Aba "🎬 Scan de reel" é a **primeira e padrão** em `/books`; `ReelScanner` em
  `src/components/scan/`. Fluxo: link → revisão com checkboxes → dedupe por título
  normalizado ("já na biblioteca") → salva como `status: 'Quero ler'` → enriquece
  ISBN/capa em background por `enrichBooksInBackground`.
- **Por link (caminho principal)**: `resolveReelLink` busca a página via
  **`r.jina.ai`** (reader da Jina AI, CORS liberado, devolve legenda + capa em JSON).
  A legenda vai ao LLM como **texto** (`CAPTION_EXTRACTION_PROMPT` +
  `callLLMCaption`), com a capa do post (via `images.weserv.nl`, CORS aberto) como
  frame extra. Reels de bookstagram costumam listar os livros na legenda — verificado
  com link real (4 livros identificados).
- **Fallbacks**: sem legenda útil → `video_url`/`og:image` do HTML via proxies públicos
  (cors.lol → allorigins → codetabs — instáveis) → frames pelo pipeline de visão;
  upload de vídeo/prints continua como alternativa na mesma aba
  (`extractFramesFromVideo`/`Images`, `<video>`+canvas, ~8 frames, 768px JPEG).
- **Camada LLM** (`src/core/business/llm/`): `types`, `prompt`, `parse` (JSON/fenced/
  texto extra), `providers` (Gemini, OpenAI, Anthropic — adaptadores com formatos de
  imagem próprios), `frames` (extração `<video>`+canvas e blobs), `reel-link`
  (parse de URL, Jina, proxies), `extract` (orquestração + config).
- **Config**: provedor + API key na UI do scan; salvos só no IndexedDB `meta`
  (`llmProvider`/`llmApiKey` — **nunca** no `UserLibraryData`/Drive). `.env` como
  fallback dev: `VITE_LLM_PROVIDER`, `VITE_LLM_API_KEY`, `VITE_GEMINI_API_KEY` (legado).
- Suporte a YouTube shorts/vídeos (thumbnail `i.ytimg.com` direta, CORS `*`) e a links
  de Instagram `/reel/`, `/reels/`, `/p/`.

### 16.6 Pendente: proxy próprio para frames do vídeo

- Instagram não permite fetch direto (CORS) e a API oficial não entrega mídia de
  terceiros (`instagram_oembed` só dá HTML de embed; Graph API só a própria conta).
  Para ler os **frames do vídeo** (reels sem livros na legenda) falta um proxy
  confiável — os públicos falham e `corsproxy.org` devolve conteúdo adulterado
  (removido da cadeia).
- Próximo passo documentado em `todo.md`: **Cloudflare Worker** (~30 linhas, allowlist
  de hosts) configurável via `VITE_REEL_PROXY`/meta `reelProxy`, tentado antes dos
  proxies públicos em `fetchViaProxy`/`fetchImage`.
