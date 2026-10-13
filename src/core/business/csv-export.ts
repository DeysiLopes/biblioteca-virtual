import { Book } from '../models/book';

/**
 * Exportação CSV da biblioteca.
 *
 * Decisões:
 * - Delimitador `;` — convenção do Excel pt-BR, evita brigar com vírgulas
 *   e decimais locais. O importador detecta o delimitador pelo cabeçalho.
 * - Todos os campos de texto vão entre aspas, com `"` dobrado — inclui
 *   quebras de linha reais em comentários e resenhas (o parser as lê).
 * - Neutralização de fórmulas: célula que começa com = + - @ recebe um
 *   apóstrofo na frente (anti CSV-injection em Excel/Sheets).
 * - ISBN sai como texto puro citado — zeros à esquerda preservados nos
 *   dados; o Excel pode reinterpretar, mas o round-trip do app é exato.
 * - Citações viram uma célula legível "p.42 — texto" separadas por " || ";
 *   restauração integral continua sendo o backup JSON.
 */

const DELIM = ';';

const HEADERS = [
  'titulo',
  'autor',
  'isbn',
  'status',
  'genero',
  'formato',
  'idioma',
  'tipo',
  'paginas',
  'paginas_lidas',
  'inicio',
  'fim',
  'nota',
  'comentarios',
  'resenha',
  'capa',
  'citacoes',
];

function cell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? '' : String(value);
  // Anti CSV-injection: desarma =, +, -, @ no início da célula
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function citacoesCell(book: Book): string {
  const list = book.citacoes ?? [];
  const tomb = new Set((book.deletedCitacoes ?? []).map((t) => t.id));
  return list
    .filter((c) => c?.id && !tomb.has(c.id))
    .map((c) => `p.${c.page} — ${c.text}`)
    .join(' || ');
}

export function booksToCSV(books: Book[]): string {
  const rows = [HEADERS.join(DELIM)];
  for (const b of books) {
    rows.push(
      [
        b.title,
        b.author,
        b.codigo_isbn,
        b.status,
        b.genero,
        b.formato,
        b.idioma,
        b.tipo,
        b.paginas,
        b.paginasLidas,
        b.inicio,
        b.fim,
        b.nota || '',
        b.comentarios,
        b.resenha,
        b.cover,
        citacoesCell(b),
      ]
        .map(cell)
        .join(DELIM)
    );
  }
  return rows.join('\r\n');
}

/** Dispara o download do CSV (UTF-8 com BOM — acentos ok no Excel). */
export function downloadBooksCSV(books: Book[], filename = 'minha-biblioteca.csv'): void {
  const csv = booksToCSV(books);
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
