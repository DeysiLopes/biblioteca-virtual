import { Book, BookStatus } from '../models/book';

export function normalizeString(str?: string | null): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function slugify(str: string): string {
  return normalizeString(str)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function detectDelimiter(headerLine: string): string {
  const tabs = headerLine.split('\t').length;
  const semicolons = headerLine.split(';').length;
  const commas = headerLine.split(',').length;

  if (tabs > semicolons && tabs > commas) return '\t';
  if (semicolons > commas) return ';';
  return ',';
}

export function parseCSVText(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  const lines = text.trim().split(/\r?\n/);

  for (const line of lines) {
    const row: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    row.push(cur);
    if (row.some(c => c.trim() !== '')) {
      rows.push(row.map(c => c.trim()));
    }
  }

  return rows;
}

function parseNumber(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  const clean = String(val).trim().replace(/\.(?=\d{3})/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? null : Math.floor(num);
}

function normalizeDate(val: any): string | null {
  const s = String(val || '').trim();
  if (!s) return null;

  // DD/MM/YYYY or DD-MM-YYYY
  const m1 = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m1) {
    const d = +m1[1];
    const m = +m1[2];
    const y = m1[3].length === 2 ? 2000 + +m1[3] : +m1[3];
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // YYYY-MM-DD
  const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m2) {
    return `${m2[1]}-${String(+m2[2]).padStart(2, '0')}-${String(+m2[3]).padStart(2, '0')}`;
  }

  return null;
}

function normalizeStatus(val: any): BookStatus {
  const n = normalizeString(String(val || ''));
  if (!n) return 'Quero ler';
  if (n.includes('abandon') || n.includes('dnf')) return 'Abandonado';
  if (n.includes('lend') || n.includes('reading') || n.includes('andamento')) return 'Lendo';
  if (n.includes('lid') || n.includes('read') || n.includes('finish') || n.includes('conclu')) return 'Lido';
  return 'Quero ler';
}

function normalizeRating(val: any): number {
  const n = parseNumber(val);
  if (n === null || n <= 0) return 0;
  return n > 5 ? Math.round(n / 2) : n;
}

export interface ImportBatchResult {
  added: Book[];
  skippedCount: number;
  errors: string[];
}

/**
 * Importa livros a partir de conteúdo CSV ou JSON.
 */
export function importBooksContent(
  content: string,
  existingBooks: Book[]
): ImportBatchResult {
  const trimmed = content.trim();
  if (!trimmed) {
    return { added: [], skippedCount: 0, errors: ['O arquivo fornecido está vazio.'] };
  }

  // Tentativa 1: Parse como JSON
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const rawBooks: any[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.books)
        ? parsed.books
        : [];

      if (!rawBooks.length) {
        return { added: [], skippedCount: 0, errors: ['Nenhum livro encontrado no JSON.'] };
      }

      return processRawBooks(rawBooks, existingBooks);
    } catch {
      // Se falhou JSON, continua para tentar CSV
    }
  }

  // Tentativa 2: Parse como CSV
  const headerLine = trimmed.split(/\r?\n/)[0] || '';
  const delim = detectDelimiter(headerLine);
  const rows = parseCSVText(trimmed, delim);

  if (rows.length < 2) {
    return { added: [], skippedCount: 0, errors: ['CSV sem dados suficientes (cabeçalho + linhas).'] };
  }

  const header = rows[0].map(h => normalizeString(h));
  const f: Record<string, number> = {};
  header.forEach((h, i) => { f[h] = i; });

  const pick = (row: string[], keys: string[]): string | undefined => {
    for (const k of keys) {
      if (f[k] !== undefined && row[f[k]] !== undefined) {
        return row[f[k]];
      }
    }
    return undefined;
  };

  const rawBooks: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const title = pick(row, ['titulo', 'title', 'nome', 'name', 'book', 'livro', 'book title', 'titulo do livro']) || row[0];
    const author = pick(row, ['autor', 'author', 'autora', 'writer', 'author name', 'autor (a)']) || row[1] || '';
    const paginas = pick(row, ['paginas', 'pages', 'pagina', 'pags', 'no of pages', 'number of pages', 'page count']);
    const nota = pick(row, ['nota', 'rating', 'my rating', 'score', 'estrelas', 'stars', 'avaliacao']);
    const status = pick(row, ['status', 'estado', 'situacao', 'state']);
    const genero = pick(row, ['genero', 'genre', 'categorias', 'category', 'shelf', 'bookshelves', 'categories']);
    const formato = pick(row, ['formato', 'format', 'binding']);
    const idioma = pick(row, ['idioma', 'language', 'lang']);
    const tipo = pick(row, ['tipo', 'type']);
    const inicio = pick(row, ['inicio', 'data inicio', 'date start', 'start']);
    const fim = pick(row, ['fim', 'data fim', 'date finish', 'finish', 'date read']);
    const comentarios = pick(row, ['comentarios', 'comentarios', 'comments', 'notes', 'my notes', 'notas']);
    const resenha = pick(row, ['resenha', 'review', 'my review', 'rating text']);

    rawBooks.push({
      title,
      author,
      paginas,
      nota,
      status,
      genero,
      formato,
      idioma,
      tipo,
      inicio,
      fim,
      comentarios,
      resenha,
    });
  }

  return processRawBooks(rawBooks, existingBooks);
}

function processRawBooks(rawBooks: any[], existingBooks: Book[]): ImportBatchResult {
  const existingTitles = new Set(existingBooks.map(b => normalizeString(b.title)));
  const added: Book[] = [];
  let skippedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < rawBooks.length; i++) {
    const r = rawBooks[i];
    const title = String(r.title || '').trim();
    if (!title) {
      errors.push(`Linha/item ${i + 1}: título ausente ou inválido.`);
      continue;
    }

    const titleKey = normalizeString(title);
    if (existingTitles.has(titleKey) || added.some(a => normalizeString(a.title) === titleKey)) {
      skippedCount++;
      continue;
    }

    const author = String(r.author || '').trim();
    const paginas = parseNumber(r.paginas);
    const paginasLidas = parseNumber(r.paginasLidas) || 0;
    const nota = normalizeRating(r.nota);
    const status = normalizeStatus(r.status);
    const inicio = normalizeDate(r.inicio);
    const fim = normalizeDate(r.fim);

    const newBook: Book = {
      id: r.id && typeof r.id === 'string' ? r.id : `imp:${slugify(title)}:${slugify(author).slice(0, 20)}`,
      title,
      author,
      paginas,
      paginasLidas,
      status,
      nota,
      genero: r.genero ? String(r.genero).trim() : null,
      formato: r.formato ? String(r.formato).trim() : null,
      idioma: r.idioma ? String(r.idioma).trim() : null,
      tipo: r.tipo ? String(r.tipo).trim() : null,
      inicio,
      fim,
      comentarios: r.comentarios ? String(r.comentarios).trim() : '',
      resenha: r.resenha ? String(r.resenha).trim() : '',
      cover: r.cover || '',
      citacoes: Array.isArray(r.citacoes) ? r.citacoes : [],
      deletedCitacoes: Array.isArray(r.deletedCitacoes) ? r.deletedCitacoes : [],
      readingEpoch: r.readingEpoch || (paginasLidas > 0 ? Date.now() : 0),
      updatedAt: Date.now(),
    };

    added.push(newBook);
    existingTitles.add(titleKey);
  }

  return { added, skippedCount, errors };
}
