# Biblioteca Virtual

App PWA da estante de livros: estante interativa com capas, diário de leitura, notas/resenhas e CSV — funciona offline como app no celular/tablet.

## Instalar como app (celular / tablet)

1. Abra **https://deysilopes.github.io/biblioteca-virtual/** no navegador.
2. **Android (Chrome):** no menu ⋮ → **"Adicionar à tela inicial"** (ou "Instalar app").
3. **iPhone/iPad (Safari):** botão **Compartilhar** → **"Adicionar à tela inicial"**.
4. Depois é só abrir pelos ícone na tela inicial — roda em tela cheia e offline.
5. Toque no 🔔 para ativar o **lembrete diário de leitura** (permite na hora).

## O que o app faz

- 📚 **Estante**: capas em prateleiras, filtros por status/gênero, clique = livro "voa" da estante.
- ⭐ **Nota / Comentários / Resenha**: editáveis no próprio app (ficam salvas no aparelho, por isso funciona offline).
- 📖 **Diário**: registre páginas lidas por dia + anotação; o app soma o progresso do livro, mostra páginas lidas hoje e sequência de dias.
- ⬇️ **Backup**: exporta seus dados para um arquivo JSON.
- ⇪ **CSV**: importa seus CSVs do Goodreads/MyReelReads direto no app (mesmo mapeamento de colunas e dedupe por título do script de importação do Notion).
- 🔔 **Lembrete**: avisa diariamente (20:00) para você registrar a leitura.

## Como os dados se conectam com o Notion

- O **catálogo** (títulos, autores, capas, gênero, status) vem de `books.json`, gerado a partir do banco **Leituras** do Notion por `gerar-books.js`.
- **Edições feitas no app** (nota, resenha, comentários, páginas lidas, status, diário) ficam **no aparelho** (IndexedDB) — são mantidas mesmo quando o catálogo é atualizado.
- Para sincronizar: jogue um `.csv` em `~/TBR/` no computador (vai pro Notion e republica o widget) ou rode `biblioteca-atualizar`.

## Publicar

```bash
cd ~/workspace/biblioteca-virtual
git push origin main
```

O workflow `.github/workflows/react-vite.yml` instala as dependências, executa os
testes, gera o `dist/` e publica no GitHub Pages depois de um push aprovado em
`main`. Pull requests apenas validam o app. Nas configurações do repositório,
GitHub Pages deve usar **GitHub Actions** como fonte de build/deploy.

## Arquivos

- `index.html` — entrada do Vite
- `src/` — app React, regras de negócio, storage e testes
- `public/` — ícones e fallback do GitHub Pages
- `vite.config.ts` — base `/biblioteca-virtual/` e PWA
- `.github/workflows/react-vite.yml` — CI/CD de teste, build e publicação
- `.agents/artifacts/mvp1-fonte-verdade/` — runtime vanilla legado do MVP 1