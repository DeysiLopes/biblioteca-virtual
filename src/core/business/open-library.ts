export interface OpenLibraryResult {
  title: string;
  author: string;
  paginas?: number;
  cover?: string;
}

/**
 * Consulta metadados de um livro por ISBN na Open Library.
 */
export async function fetchBookByISBN(isbn: string): Promise<OpenLibraryResult | null> {
  const cleanIsbn = isbn.replace(/[^0-9X]/gi, '').trim();
  if (!cleanIsbn) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const res = await fetch(`https://openlibrary.org/isbn/${cleanIsbn}.json`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

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
    const cover = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`;

    return {
      title,
      author,
      paginas: isNaN(paginas as any) ? undefined : paginas,
      cover,
    };
  } catch (err) {
    console.warn('Erro ao consultar Open Library para ISBN:', cleanIsbn, err);
    return null;
  }
}
