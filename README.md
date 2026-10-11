# Biblioteca Virtual

Widget interativo de estante de livros (estilo estante 3D) que lê o banco **Leituras** do Notion e renderiza as capas para navegação.

## Como atualizar

Depois de adicionar/editar livros no Notion, rode:

```bash
biblioteca-atualizar
```

Ou simplesmente jogue um `.csv` na pasta `~/TBR` — a importação automática já republica o widget.

## Arquivos

- `index.html` — o widget (estante de capas + modal de detalhes)
- `books.json` — dados gerados a partir do Notion
- `gerar-books.js` — puxa o banco Leituras do Notion e gera `books.json`