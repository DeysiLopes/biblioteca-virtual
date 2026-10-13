import { describe, it, expect } from 'vitest';
import { booksToCSV } from '../core/business/csv-export';
import { importBooksContent, parseCSVText, detectDelimiter } from '../core/business/csv-parser';
import { Book } from '../core/models/book';

const book = (over: Partial<Book>): Book => ({
  id: 'x',
  title: 'Livro',
  author: 'Autor',
  status: 'Lido',
  ...over,
});

describe('booksToCSV', () => {
  it('exporta cabeçalho estável e todos os campos principais', () => {
    const csv = booksToCSV([
      book({
        title: 'Dom Casmurro',
        author: 'Machado de Assis',
        codigo_isbn: '9788503010',
        paginas: 256,
        paginasLidas: 256,
        inicio: '2024-01-01',
        fim: '2024-02-01',
        nota: 5,
        genero: 'Romance',
      }),
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('titulo;autor;isbn;status');
    expect(lines[1]).toContain('"Dom Casmurro"');
    expect(lines[1]).toContain('"9788503010"');
    expect(lines[1]).toContain('"Lido"');
  });

  it('escapa aspas e preserva quebras de linha dentro de campos citados', () => {
    const csv = booksToCSV([
      book({ resenha: 'linha 1\nlinha 2 com "aspas"' }),
    ]);
    const delim = detectDelimiter(csv.split('\r\n')[0]);
    const rows = parseCSVText(csv, delim);
    expect(rows).toHaveLength(2); // a quebra de linha dentro da célula não vira linha nova
    expect(rows[1]).toContain('linha 1\nlinha 2 com "aspas"');
  });

  it('neutraliza fórmulas (CSV injection) em campos de texto', () => {
    const csv = booksToCSV([book({ title: '=SUM(1,2)', comentarios: '+cmd' })]);
    expect(csv).toContain("'=SUM(1,2)");
    expect(csv).toContain("'+cmd");
  });

  it('citações saem como texto legível e ignoram tombstones', () => {
    const csv = booksToCSV([
      book({
        citacoes: [
          { id: 'a', text: 'viva', page: 42, ts: 1 },
          { id: 'b', text: 'apagada', page: 9, ts: 2 },
        ],
        deletedCitacoes: [{ id: 'b', ts: 3 }],
      }),
    ]);
    expect(csv).toContain('p.42 — viva');
    expect(csv).not.toContain('apagada');
  });
});

describe('CSV export → import round-trip', () => {
  it('reimporta o CSV gerado sem perder os campos centrais', () => {
    const original = book({
      title: 'Memórias Póstumas',
      author: 'Machado de Assis',
      codigo_isbn: '9780195',
      status: 'Lendo',
      genero: 'Romance',
      paginas: 368,
      paginasLidas: 120,
      nota: 4,
      resenha: 'ótimo\nlivro',
      comentarios: 'relendo',
    });
    const csv = booksToCSV([original]);
    const { added, errors } = importBooksContent(csv, []);
    expect(errors).toHaveLength(0);
    expect(added).toHaveLength(1);
    const imp = added[0];
    expect(imp.title).toBe('Memórias Póstumas');
    expect(imp.author).toBe('Machado de Assis');
    expect(imp.codigo_isbn).toBe('9780195');
    expect(imp.status).toBe('Lendo');
    expect(imp.genero).toBe('Romance');
    expect(imp.paginas).toBe(368);
    expect(imp.paginasLidas).toBe(120);
    expect(imp.nota).toBe(4);
    expect(imp.resenha).toBe('ótimo\nlivro');
    expect(imp.comentarios).toBe('relendo');
  });

  it('não duplica livros já existentes na biblioteca', () => {
    const csv = booksToCSV([book({ title: 'Já Tenho' })]);
    const { added, skippedCount } = importBooksContent(csv, [book({ title: 'Já Tenho' })]);
    expect(added).toHaveLength(0);
    expect(skippedCount).toBe(1);
  });
});
