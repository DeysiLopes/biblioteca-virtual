import { describe, it, expect } from 'vitest';
import {
  detectDelimiter,
  parseCSVText,
  importBooksContent,
  normalizeString,
} from '../core/business/csv-parser';
import { Book } from '../core/models/book';

describe('Importação e Parsing — CSV e JSON', () => {
  it('Detecta delimitador corretamente', () => {
    expect(detectDelimiter('Título,Autor,Páginas')).toBe(',');
    expect(detectDelimiter('Título;Autor;Páginas')).toBe(';');
    expect(detectDelimiter('Título\tAutor\tPáginas')).toBe('\t');
  });

  it('Faz parse de CSV com aspas e vírgulas internas escapadas', () => {
    const csv = 'Título,Autor\n"Livro, com vírgula",Autor Teste\n"Livro com ""aspas""",Autor 2';
    const rows = parseCSVText(csv, ',');
    expect(rows.length).toBe(3);
    expect(rows[1][0]).toBe('Livro, com vírgula');
    expect(rows[2][0]).toBe('Livro com "aspas"');
  });

  it('Importa livros de CSV e deduplica títulos existentes', () => {
    const existing: Book[] = [
      {
        id: '1',
        title: 'Dom Casmurro',
        author: 'Machado de Assis',
        status: 'Lido',
      },
    ];

    const csvContent = `Título,Autor,Páginas,Status\nDom Casmurro,Machado de Assis,200,Lido\nMemórias Póstumas,Machado de Assis,180,Lendo`;

    const { added, skippedCount } = importBooksContent(csvContent, existing);
    expect(added.length).toBe(1);
    expect(added[0].title).toBe('Memórias Póstumas');
    expect(added[0].status).toBe('Lendo');
    expect(skippedCount).toBe(1); // 'Dom Casmurro' já existia
  });

  it('Importa livros a partir de JSON', () => {
    const jsonContent = JSON.stringify([
      { title: 'Grande Sertão: Veredas', author: 'Guimarães Rosa', paginas: 600 },
    ]);

    const { added } = importBooksContent(jsonContent, []);
    expect(added.length).toBe(1);
    expect(added[0].title).toBe('Grande Sertão: Veredas');
    expect(added[0].author).toBe('Guimarães Rosa');
    expect(added[0].paginas).toBe(600);
  });

  it('Normaliza strings ignorando maiúsculas e acentos', () => {
    expect(normalizeString('Ação e Reação')).toBe('acao e reacao');
    expect(normalizeString('  Ficção Científica  ')).toBe('ficcao cientifica');
  });
});
