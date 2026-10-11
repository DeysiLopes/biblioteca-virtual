# CONTEXT.md — Minha Biblioteca

Documento de contexto do projeto **Minha Biblioteca** (PWA de estante + diário de leitura),
com histórico do que foi feito, arquitetura, decisões e estado atual.

Última atualização: 2026-10-11 (após deploy `bib-v20`).

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
- App publicado: https://deysilopes.github.io/biblioteca-virtual/
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
│   └── icons.cjs           # geração de ícones do PWA
├── identidade-visual/      # referências visuais (estrutura + 4 fotos de cores)
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

### 9.1 Servidor de teste

`/tmp/opencode/srv.js` — servidor estático Node em `127.0.0.1:8124`.

```bash
node /tmp/opencode/srv.js & S=$!; sleep 1.2; ... ; kill $S
```

> `python3 -m http.server` **não funciona** neste ambiente (curl retorna `000`).

### 9.2 Gerador de teste

`/tmp/opencode/mktest.js` — copia `index.html` → `__t.html` (na raiz do projeto) e injeta
um `<script>` que, após o `load`, espera, semeia um livro de teste, dispara o fluxo e grava
o resultado num `<div id="testout">TESTOUT {json}</div>`.

> **`__t.html` é temporário: remover SEMPRE antes de commit.**

### 9.3 Execução

```bash
node /tmp/opencode/mktest.js
node /tmp/opencode/srv.js >/tmp/opencode/srv.log 2>&1 & S=$!
sleep 1.2
timeout -s KILL 40 chromium --headless=new --no-sandbox --disable-gpu \
  --virtual-time-budget=12000 --dump-dom \
  "http://127.0.0.1:8124/__t.html" >/tmp/opencode/dom.html 2>/dev/null
kill $S
grep -o 'TESTOUT [^<]*' /tmp/opencode/dom.html | tail -1
rm -f /home/deysi/workspace/biblioteca-virtual/__t.html
```

Notas:
- Usar `timeout -s KILL` (Chromium às vezes ignora SIGTERM).
- Redirecionar a saída do Chromium para arquivo (evita o shell travar no pipe).
- Método **CDP/`--remote-debugging` foi abandonado** (travava / timeout) → `--dump-dom`.

### 9.4 Resultado do teste final (bib-v20)

Clicando na capa real do diário:

```json
{"err":[],"coverFound":true,"flipOpen":true,"flipped":true,"cadernoOpen":true,
 "cadVal":"Esta e minha resenha de teste."}
```

Ou seja: capa → gira para contracapa → clique abre o caderno com a resenha carregada. ✅

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
| bib-v20   | `fce4030` | Fix `id="fbook"` duplicado (flip→caderno usa `.flip-book`). **Atual** |

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
curl -s "https://deysilopes.github.io/biblioteca-virtual/sw.js?v=$(date +%s)" | grep VERSION

# limpar cache local (no navegador): botão #swReset ou Ctrl+Shift+R
```

---

## 13. Pendências / próximos passos

- [ ] Pedir ao usuário para testar o fluxo capa → contracapa → caderno e confirmar.
- [ ] **Revogar/rotacionar** o token fine-grained do GitHub que foi exposto no chat.
- [ ] Se ainda houver problema no aparelho: garantir hard refresh / `#swReset`
      (`bib-v20` pode levar ~10 min para propagar no Pages/CDN).
- [ ] Validação estética depende do usuário (o assistente não enxerga imagens).

---

## 14. Observações

- Feature "Notícias/Notion" não faz parte do fluxo atual (referências antigas:
  página `3f61815b-43b3-8030-b377-c4730558275d`, DB
  `3f61815b-43b3-818c-9486-c2a0f3a81179`, token em `~/.config/opencode/notion-token`).
- Todo o JS do app é inline em `index.html`; qualquer alteração exige bump do `sw.js` para
  que usuários recebam a nova versão.
