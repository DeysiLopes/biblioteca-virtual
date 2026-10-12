import { Book } from '../models/book';

export interface OpenLibraryResult {
  title: string;
  author: string;
  paginas?: number;
  cover?: string;
  isbn?: string;
  genero?: string;
  idioma?: string;
  formato?: string;
}

export interface OpenLibrarySearchResult {
  isbn?: string;
  cover?: string;
  paginas?: number;
  title?: string;
  author?: string;
  genero?: string;
  idioma?: string;
  formato?: string;
}

const LANG_MAP: Record<string, string> = {
  por: 'Português', eng: 'Inglês', spa: 'Espanhol', fre: 'Francês',
  fra: 'Francês', ita: 'Italiano', ger: 'Alemão', deu: 'Alemão',
  lat: 'Latim', jpn: 'Japonês', rus: 'Russo', chi: 'Chinês',
  zho: 'Chinês', dut: 'Holandês', nld: 'Holandês', mul: 'Vários',
};

const FORMAT_MAP: Record<string, string> = {
  paperback: 'Brochura', 'mass market paperback': 'Brochura',
  hardcover: 'Capa dura', 'capa dura': 'Capa dura',
  ebook: 'E-book', 'electronic resource': 'E-book',
  audiobook: 'Audiolivro', 'audio cd': 'Audiolivro',
};

function mapLanguage(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const c = code.replace('/languages/', '').toLowerCase();
  return LANG_MAP[c] || undefined;
}

function mapFormat(fmt: string | undefined): string | undefined {
  if (!fmt) return undefined;
  const f = fmt.toLowerCase().trim();
  return FORMAT_MAP[f] || fmt;
}

/** Livro precisa de enriquecimento quando falta metadado básico. */
export function needsMetadata(book: Book): boolean {
  return !book.codigo_isbn || !book.cover || !book.author || !book.paginas;
}

/**
 * Aplica metadados encontrados apenas em campos vazios do livro.
 * Devolve o livro atualizado ou null quando nada muda.
 */
export function applyMetadata(
  book: Book,
  meta: OpenLibrarySearchResult | null
): Book | null {
  if (!meta) return null;
  const updates: Partial<Book> = {};
  if (!book.codigo_isbn && meta.isbn) updates.codigo_isbn = meta.isbn;
  if (!book.cover && meta.cover) updates.cover = meta.cover;
  if (!book.paginas && meta.paginas) updates.paginas = meta.paginas;
  if (!book.author?.trim() && meta.author) updates.author = meta.author;
  if (!book.genero?.trim() && meta.genero) updates.genero = meta.genero;
  if (!book.idioma?.trim() && meta.idioma) updates.idioma = meta.idioma;
  if (!book.formato?.trim() && meta.formato) updates.formato = meta.formato;
  if (!Object.keys(updates).length) return null;
  return { ...book, ...updates, updatedAt: Date.now() };
}

/** Erro lançado quando a Open Library limita as requisições (HTTP 429). */
export class OpenLibraryRateLimitError extends Error {
  constructor() {
    super('Limite de requisições da Open Library atingido (429)');
    this.name = 'OpenLibraryRateLimitError';
  }
}

/**
 * Busca metadados do livro: por ISBN quando já existe um (edição exata,
 * com autor e páginas mais precisos), senão por título + autor.
 * Falhas viram null — nunca quebra; limite 429 é propagado.
 */
export async function findMetadataForBook(
  book: Book
): Promise<OpenLibrarySearchResult | null> {
  if (book.codigo_isbn) {
    const byIsbn = await fetchBookByISBN(book.codigo_isbn);
    if (byIsbn) return byIsbn;
  }
  if (!book.codigo_isbn || !book.cover || !book.author || !book.paginas) {
    return searchBookByTitleAuthor(book.title, book.author);
  }
  return null;
}

export function normalizeIsbn(isbn: string): string {
  return String(isbn || '').replace(/[^0-9X]/gi, '').toUpperCase();
}

export function normalizeTitle(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickBestIsbn(isbns: string[] | undefined): string | undefined {
  if (!Array.isArray(isbns) || isbns.length === 0) return undefined;
  const clean = isbns.map(normalizeIsbn).filter((i) => i.length === 10 || i.length === 13);
  if (!clean.length) return undefined;
  return (
    clean.find((i) => i.length === 13 && (i.startsWith('978') || i.startsWith('979'))) ||
    clean.find((i) => i.length === 13) ||
    clean[0]
  );
}

function titlesMatch(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (short.length < 8) return false;
  // aceita prefixo ("Dom Casmurro: edição") e título no meio/fim
  // ("Coleção Saraiva — Dom Casmurro"), sempre com fronteira de palavra
  return (
    long.startsWith(short) ||
    long.endsWith(' ' + short) ||
    long.includes(' ' + short + ' ')
  );
}

const GENERIC_AUTHORS = new Set([
  'varios', 'varios autores', 'desconhecido', 'autor desconhecido',
  'unknown', 'anonymous', 'anonimo',
]);

async function fetchSearchDocs(q: URLSearchParams): Promise<any[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  const res = await fetch(`https://openlibrary.org/search.json?${q.toString()}`, {
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  if (res.status === 429) throw new OpenLibraryRateLimitError();
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.docs) ? data.docs : [];
}

/**
 * Consulta metadados de um livro por ISBN na Open Library.
 */
export async function fetchBookByISBN(isbn: string): Promise<OpenLibraryResult | null> {
  const cleanIsbn = normalizeIsbn(isbn);
  if (!cleanIsbn) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const res = await fetch(`https://openlibrary.org/isbn/${cleanIsbn}.json`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 429) throw new OpenLibraryRateLimitError();
    if (!res.ok) return null;
    const data = await res.json();

    const title = data.title || '';
    let author = '';

    if (Array.isArray(data.authors) && data.authors.length > 0) {
      const authorKey = data.authors[0].key;
      if (authorKey) {
        try {
          const authRes = await fetch(`https://openlibrary.org${authorKey}.json`);
          if (authRes.ok) {
            const authData = await authRes.json();
            author = authData.name || '';
          }
        } catch {
          // ignora falha ao obter o nome detalhado do autor
        }
      }
    }

    const paginas = data.number_of_pages || data.pagination ? parseInt(data.number_of_pages || data.pagination, 10) : undefined;
    // cover_i é garantido quando a edição tem capa; o endpoint por ISBN pode 404
    const coverId = Array.isArray(data.covers) && data.covers.length > 0 ? data.covers[0] : null;
    const cover = coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
      : `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`;

    const langKey = Array.isArray(data.languages) ? data.languages[0]?.key : undefined;
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];

    return {
      title,
      author,
      paginas: isNaN(paginas as any) ? undefined : paginas,
      cover,
      isbn: cleanIsbn,
      genero: typeof subjects[0] === 'string' ? subjects[0] : undefined,
      idioma: mapLanguage(langKey),
      formato: mapFormat(data.physical_format),
    };
  } catch (err) {
    if (err instanceof OpenLibraryRateLimitError) throw err;
    console.warn('Erro ao consultar Open Library para ISBN:', cleanIsbn, err);
    return null;
  }
}

/**
 * Busca um livro por título/autor na Open Library e devolve o melhor
 * candidato com ISBN e capa. Só aceita títulos compatíveis — preferimos
 * não preencher a preencher errado.
 */
export async function searchBookByTitleAuthor(
  title: string,
  author?: string
): Promise<OpenLibrarySearchResult | null> {
  if (!title?.trim()) return null;

  const fields = 'key,title,author_name,isbn,cover_i,number_of_pages_median,language,subject';
  const realAuthor =
    author?.trim() && !GENERIC_AUTHORS.has(normalizeTitle(author))
      ? author.trim()
      : '';

  // 1) título+autor → 2) só título → 3) busca livre q= (full-text)
  const attempts: URLSearchParams[] = [];
  if (realAuthor) {
    const p = new URLSearchParams({ title: title.trim(), author: realAuthor });
    p.set('limit', '8'); p.set('fields', fields);
    attempts.push(p);
  }
  const p2 = new URLSearchParams({ title: title.trim() });
  p2.set('limit', '8'); p2.set('fields', fields);
  attempts.push(p2);
  const p3 = new URLSearchParams({
    q: realAuthor ? `${title.trim()} ${realAuthor}` : title.trim(),
  });
  p3.set('limit', '8'); p3.set('fields', fields);
  attempts.push(p3);

  try {
    for (const params of attempts) {
      const docs = await fetchSearchDocs(params);
      const matching = docs.filter((d: any) => titlesMatch(d.title || '', title));
      if (!matching.length) continue;

      // Prefere candidatos que tenham ISBN e capa ao mesmo tempo
      matching.sort((a: any, b: any) => {
        const score = (d: any) =>
          (pickBestIsbn(d.isbn) ? 2 : 0) + (d.cover_i ? 1 : 0);
        return score(b) - score(a);
      });
      const best = matching[0];

      return {
        isbn: pickBestIsbn(best.isbn),
        cover: best.cover_i
          ? `https://covers.openlibrary.org/b/id/${best.cover_i}-L.jpg`
          : undefined,
        paginas:
          typeof best.number_of_pages_median === 'number'
            ? best.number_of_pages_median
            : undefined,
        title: best.title,
        author: Array.isArray(best.author_name) ? best.author_name[0] : undefined,
        genero: Array.isArray(best.subject) && typeof best.subject[0] === 'string'
          ? best.subject[0]
          : undefined,
        idioma: Array.isArray(best.language) ? mapLanguage(best.language[0]) : undefined,
      };
    }
    return null;
  } catch (err) {
    if (err instanceof OpenLibraryRateLimitError) throw err;
    console.warn('Erro ao buscar livro por título na Open Library:', title, err);
    return null;
  }
}
