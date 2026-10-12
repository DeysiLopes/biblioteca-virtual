# Minha Biblioteca

PWA de estante + diário de leitura — **React 18 + Vite + TypeScript**, sincronização opcional via **Google Drive** e funcionamento **offline** completo.

**Site:** https://deysilopes.github.io/biblioteca-virtual/

☕ **Gostou? [Me pague um café](https://buymeacoffee.com/deysilopes)** — toda graninha ajuda a manter o projeto vivo.

## Instalar como app (celular / tablet)

1. Abra https://deysilopes.github.io/biblioteca-virtual/ no navegador.
2. **Android (Chrome):** menu ⋮ → **"Adicionar à tela inicial"** / "Instalar app".
3. **iPhone/iPad (Safari):** botão **Compartilhar** → **"Adicionar à tela inicial"**.
4. O app abre em tela cheia com o ícone do fantasminha e funciona offline.
5. Toque em **Lembrete** no topo para ativar o aviso diário de leitura (20:00).

## O que o app faz

- **Estante**: livros em prateleiras com capas reais ou lombadas de couro estilizadas, gato preto animado na prateleira (ele tenta derrubar o último livro quando você rola a página), fundo mágico com lua crescente, estrelas e poeira encantada.
- **Filtros e busca**: por status (Todos / Quero ler / Lendo / Lido / Abandonado), gênero (dropdown) e título/autor. Livros lidos ficam nas prateleiras do fim.
- **Modal do livro**: progresso, status, gênero, formato, idioma, datas, nota, comentários e ISBN num só lugar. **Páginas lidas é o total** — digitar 100 salva 100, sem somar.
- **Resenha**: fluxo capa → contracapa (flip 3D) → folha de caderno pautado com som opcional de escrita. Resenha marcada **"com spoilers"** fica borrada até tocar para revelar.
- **Fichário de citações** (`/fichario`): abas pastel, página obrigatória, leitura centralizada; exclusões propagam corretamente entre aparelhos.
- **Compartilhar**: botão no modal do livro gera um texto com progresso, resenha e citações — abre a folha de compartilhamento no celular ou copia no desktop.
- **Adicionar** (`/books`): três formas — **ISBN (Open Library)**, **manual** e **import em lote (CSV/JSON)**. A varredura "✨ Capas & ISBN" completa capa, ISBN, autor e páginas dos livros já cadastrados, com tolerância a rate limit da API.
- **Diário** (`/diario`): registros por dia, páginas lidas hoje e sequência; o histórico nunca recalcula o progresso do livro.
- **Backup**: baixa o próprio arquivo JSON do Drive.

## Sincronização e dados

- **Google Drive = fonte da verdade**: `biblioteca-<userId>.json` na pasta "Minha Biblioteca", via Drive REST API v3 + Google Identity Services (escopo `drive.file`).
- **IndexedDB local**: funciona 100% offline; memória/IndexedDB/Drive são estados separados e as abas se sincronizam por BroadcastChannel.
- **Primeiro login** em cada aparelho pergunta: **mesclar** dados locais com o Drive ou **limpar e baixar** só a nuvem. A resposta é lembrada por usuário/aparelho.
- **Merge sem duplicar**: livros casam por ISBN e título+autor normalizados; `updatedAt` decide campo a campo; sessões do diário são remapeadas para o ID canônico.
- **Limpar** (botão no topo): apaga os dados locais — estando conectada, baixa do Drive na sequência.
- Sem login? O app funciona em **modo leitura local** — nada é perdido.

## Desenvolver

```bash
npm install
npm run dev        # Vite dev server (localhost:5173/biblioteca-virtual/)
npm test           # Vitest + React Testing Library + fake-indexeddb
npm run build      # tsc + build + service worker (vite-plugin-pwa)
npm run preview    # serve o dist/ localmente
```

## Publicar

```bash
git push origin main
```

O workflow `.github/workflows/react-vite.yml` roda testes, builda o `dist/` e publica no GitHub Pages (fonte do Pages = **GitHub Actions**). O build usa o secret `VITE_GOOGLE_CLIENT_ID` para habilitar o login Google no site publicado.

## Estrutura

- `src/pages/` — Estante, Diário, Adicionar, Fichário, Resenha
- `src/components/` — modal do livro, flipbook, caderno de resenha, gato da estante, fundo mágico, header, fichário
- `src/core/` — `models/` (Book, diário, UserLibraryData), `business/` (progresso, citações, CSV, Open Library, share), `storage/` (IndexedDB, Drive, sync-manager), `auth/` (GIS), `broadcast/` (abas)
- `src/hooks/` — `useLibrary`, `useAuth`, `useSound`
- `src/test/` — suíte Vitest/RTL
- `public/` — ícones PWA, favicon e `404.html` (redirect SPA no GitHub Pages)
- `identidade-visual/` — referências visuais (somente local)
- `vite.config.ts` — base `/biblioteca-virtual/`, manifest e workbox do PWA
- `AGENTS.md` / `CONTEXT.md` — orientações e histórico de decisões

## Apoie o projeto ☕

Se a biblioteca te ajudou a organizar suas leituras, considere apoiar:

**[buymeacoffee.com/deysilopes](https://buymeacoffee.com/deysilopes)**

## Privacidade

Nenhum dado de leitura é versionado: `data/`, `books.json` e fotos pessoais são locais e cobertos pelo `.gitignore`. O histórico do repositório foi purgado de dados pessoais.
