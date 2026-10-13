import { describe, it, expect } from 'vitest';
import { parseCaptionBooks } from '../core/business/llm/caption-parse';

describe('parseCaptionBooks', () => {
  it('extrai lista numerada com emoji keycap — formato real do bookstagram', () => {
    const caption = `4 thrillers pra ler escondido 📚✨

📖 Os livros desta lista:
1️⃣ A Última Casa da Rua Needless — Catriona Ward
2️⃣ Tudo em Família — John Marrs
3️⃣ As Sombras de Outubro — Søren Sveistrup
4️⃣ O Homem de Palha — Pablo Zorzi

#bookstagram #thriller #leitura`;
    const books = parseCaptionBooks(caption);
    expect(books).toHaveLength(4);
    expect(books[0]).toEqual({
      title: 'A Última Casa da Rua Needless',
      author: 'Catriona Ward',
    });
    expect(books[3].title).toBe('O Homem de Palha');
  });

  it('aceita formatos "1. Título - Autor" e "• Título — Autor"', () => {
    const caption = `minhas leituras:
1. Duna - Frank Herbert
2) Neuromancer - William Gibson
• A Mão Esquerda da Escuridão — Ursula K. Le Guin`;
    const books = parseCaptionBooks(caption);
    expect(books.map((b) => b.title)).toEqual([
      'Duna',
      'Neuromancer',
      'A Mão Esquerda da Escuridão',
    ]);
    expect(books[2].author).toBe('Ursula K. Le Guin');
  });

  it('aceita "Título by Author" e pipe', () => {
    const books = parseCaptionBooks(
      'Project Hail Mary by Andy Weir\nKlara and the Sun | Kazuo Ishiguro'
    );
    expect(books).toHaveLength(2);
    expect(books[0]).toEqual({ title: 'Project Hail Mary', author: 'Andy Weir' });
    expect(books[1].title).toBe('Klara and the Sun');
  });

  it('não inventa livro de legenda sem lista', () => {
    expect(
      parseCaptionBooks('my fave unique fantasy books atm 😘 #bookstagram #fantasy')
    ).toEqual([]);
    expect(
      parseCaptionBooks('adorei esse vídeo! comenta aí qual vc já leu')
    ).toEqual([]);
  });

  it('pula linhas de hashtags, links e cabeçalhos', () => {
    const caption = `Lista da semana:
#livros #books
https://instagram.com/exemplo
1️⃣ Livro Teste — Autor Teste`;
    const books = parseCaptionBooks(caption);
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe('Livro Teste');
  });

  it('ignora o título da página devolvido pelo Jina ("X on Instagram: …")', () => {
    // o Jina junta título+descrição na legenda — a primeira linha é
    // "@perfil on Instagram: \"…\"" e não deve virar livro
    const caption = `LEITOR OCULTO| IG LITERÁRIO on Instagram: " 4 THRILLERS QUE VÃO VIRAR TUDO DE CABEÇA PARA BAIXO — PARTE 3
100 likes
📖 Os livros:
1️⃣ A Última Casa da Rua Needless — Catriona Ward
2️⃣ Tudo em Família — John Marrs`;
    const books = parseCaptionBooks(caption);
    expect(books).toHaveLength(2);
    expect(books.every((b) => !b.title.includes('Instagram'))).toBe(true);
  });

  it('deduplica títulos repetidos na legenda', () => {
    const caption = `1️⃣ O Mesmo — Autor A
2️⃣ O MESMO — Autor B
3️⃣ Outro — Autor C`;
    const books = parseCaptionBooks(caption);
    expect(books).toHaveLength(2);
  });
});
