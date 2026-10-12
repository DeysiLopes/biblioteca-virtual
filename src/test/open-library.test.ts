import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  OpenLibraryRateLimitError,
  normalizeIsbn,
  normalizeTitle,
  searchBookByTitleAuthor,
  fetchBookByISBN,
  needsMetadata,
  applyMetadata,
  findMetadataForBook,
} from '../core/business/open-library';
import { Book } from '../core/models/book';

const jsonResponse = (data: any, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(data) } as Response);

describe('Open Library — helpers', () => {
  it('normalizeIsbn limpa hífens, espaços e prefixo', () => {
    expect(normalizeIsbn('ISBN 978-85-359-0277-8')).toBe('9788535902778');
    expect(normalizeIsbn('0-8044-2957-x')).toBe('080442957X');
  });

  it('normalizeTitle ignora acentos, pontuação e caixa', () => {
    expect(normalizeTitle('Dom Casmurro!')).toBe('dom casmurro');
    expect(normalizeTitle('A Hora da Estrela — Ed. especial')).toBe('a hora da estrela ed especial');
  });
});

describe('Open Library — busca por título/autor', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('escolhe o doc com ISBN 978 e capa, e monta URL por cover_i', async () => {
    (fetch as any).mockResolvedValueOnce(
      jsonResponse({
        docs: [
          { title: 'Dom Casmurro', isbn: ['0000000001'], cover_i: null },
          { title: 'Dom Casmurro', isbn: ['9788535902778', '8535902774'], cover_i: 12345 },
        ],
      })
    );

    const r = await searchBookByTitleAuthor('Dom Casmurro', 'Machado de Assis');
    expect(r?.isbn).toBe('9788535902778');
    expect(r?.cover).toBe('https://covers.openlibrary.org/b/id/12345-L.jpg');
  });

  it('rejeita resultado cujo título não corresponde', async () => {
    (fetch as any).mockResolvedValueOnce(
      jsonResponse({
        docs: [{ title: 'Outro Livro Completamente Diferente', isbn: ['9780000000002'] }],
      })
    );

    const r = await searchBookByTitleAuthor('Dom Casmurro', 'Machado de Assis');
    expect(r).toBeNull();
  });

  it('aceita título do livro como prefixo de edição maior', async () => {
    (fetch as any).mockResolvedValueOnce(
      jsonResponse({
        docs: [{ title: 'Dom Casmurro: edição comentada', isbn: ['9788503012345'], cover_i: 7 }],
      })
    );

    const r = await searchBookByTitleAuthor('Dom Casmurro');
    expect(r?.isbn).toBe('9788503012345');
  });

  it('aceita o título no meio de uma edição ("Coleção X — Título")', async () => {
    (fetch as any).mockResolvedValueOnce(
      jsonResponse({
        docs: [{ title: 'Coleção Saraiva: Dom Casmurro e outros contos', isbn: ['9788503000111'] }],
      })
    );
    const r = await searchBookByTitleAuthor('Dom Casmurro');
    expect(r?.isbn).toBe('9788503000111');
  });

  it('retenta sem autor quando título+autor não encontra nada', async () => {
    (fetch as any)
      .mockResolvedValueOnce(jsonResponse({ docs: [] })) // title+author: nada
      .mockResolvedValueOnce(
        jsonResponse({ docs: [{ title: 'Dom Casmurro', isbn: ['9788535902778'], cover_i: 5 }] })
      );
    const r = await searchBookByTitleAuthor('Dom Casmurro', 'Nome Diferente Do Catalogo');
    expect(r?.isbn).toBe('9788535902778');
    expect((fetch as any).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('cai na busca livre q= quando as estruturadas falham', async () => {
    (fetch as any)
      .mockResolvedValueOnce(jsonResponse({ docs: [] }))
      .mockResolvedValueOnce(jsonResponse({ docs: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ docs: [{ title: 'Dom Casmurro', isbn: ['9788503099887'], cover_i: 9 }] })
      );
    const r = await searchBookByTitleAuthor('Dom Casmurro', 'Machado de Assis');
    expect(r?.isbn).toBe('9788503099887');
    expect((fetch as any).mock.calls[2][0]).toContain('q=');
  });

  it('retorna null em falha de rede', async () => {
    (fetch as any).mockRejectedValueOnce(new Error('offline'));
    expect(await searchBookByTitleAuthor('Qualquer')).toBeNull();
  });

  it('propaga erro de limite (429) em vez de fingir "sem resultado"', async () => {
    (fetch as any).mockResolvedValueOnce({ ok: false, status: 429 });
    await expect(searchBookByTitleAuthor('Qualquer')).rejects.toBeInstanceOf(
      OpenLibraryRateLimitError
    );
  });
});

describe('Open Library — busca por ISBN', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('usa cover_i da edição para a URL da capa quando disponível', async () => {
    (fetch as any)
      .mockResolvedValueOnce(
        jsonResponse({
          title: 'Capitu',
          authors: [],
          covers: [999],
          number_of_pages: 200,
        })
      );

    const r = await fetchBookByISBN('9788535902778');
    expect(r?.cover).toBe('https://covers.openlibrary.org/b/id/999-L.jpg');
    expect(r?.isbn).toBe('9788535902778');
    expect(r?.paginas).toBe(200);
  });

  it('cai para URL por ISBN quando a edição não tem cover_i', async () => {
    (fetch as any).mockResolvedValueOnce(
      jsonResponse({ title: 'Sem capa', authors: [] })
    );

    const r = await fetchBookByISBN('9780000000002');
    expect(r?.cover).toBe('https://covers.openlibrary.org/b/isbn/9780000000002-L.jpg');
  });
});

describe('Enriquecimento automático (needsMetadata/applyMetadata)', () => {
  const baseBook: Book = {
    id: 'b1',
    title: 'Dom Casmurro',
    author: 'Machado de Assis',
    status: 'Quero ler',
  };

  it('needsMetadata: precisa quando falta ISBN, capa, autor ou páginas', () => {
    expect(needsMetadata(baseBook)).toBe(true);
    const completo = { ...baseBook, codigo_isbn: '9781', cover: 'x.jpg', paginas: 300 };
    expect(needsMetadata(completo)).toBe(false);
    expect(needsMetadata({ ...completo, codigo_isbn: null })).toBe(true);
    expect(needsMetadata({ ...completo, cover: '' })).toBe(true);
    expect(needsMetadata({ ...completo, author: '' })).toBe(true);
    expect(needsMetadata({ ...completo, paginas: null })).toBe(true);
  });

  it('applyMetadata: preenche só campos vazios e devolve null sem mudança', () => {
    const meta = {
      isbn: '9788535902778',
      cover: 'https://x/c.jpg',
      paginas: 256,
      genero: 'Fiction',
      idioma: 'Português',
      formato: 'Brochura',
    };
    const updated = applyMetadata(baseBook, meta);
    expect(updated?.codigo_isbn).toBe('9788535902778');
    expect(updated?.cover).toBe('https://x/c.jpg');
    expect(updated?.paginas).toBe(256);
    expect(updated?.genero).toBe('Fiction');
    expect(updated?.idioma).toBe('Português');
    expect(updated?.formato).toBe('Brochura');

    // não sobrescreve o que já existe
    const withIsbn = applyMetadata({ ...baseBook, codigo_isbn: '1111111111' }, meta);
    expect(withIsbn?.codigo_isbn).toBe('1111111111');
    const withGenero = applyMetadata({ ...baseBook, genero: 'Romance' }, meta);
    expect(withGenero?.genero).toBe('Romance');

    expect(applyMetadata(baseBook, null)).toBeNull();
    expect(applyMetadata(baseBook, {})).toBeNull();
  });

  it('applyMetadata: preenche autor vazio a partir da busca', () => {
    const semAutor = { ...baseBook, author: '' };
    const updated = applyMetadata(semAutor, { author: 'Machado de Assis' });
    expect(updated?.author).toBe('Machado de Assis');
  });

  it('findMetadataForBook: com ISBN e sem capa consulta a edição por ISBN', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      jsonResponse({ title: 'X', authors: [], covers: [55] })
    ));
    const meta = await findMetadataForBook({ ...baseBook, codigo_isbn: '9788535902778' });
    expect(meta?.cover).toContain('/b/id/55-');
    expect((fetch as any).mock.calls[0][0]).toContain('/isbn/9788535902778.json');
    vi.unstubAllGlobals();
  });

  it('findMetadataForBook: com ISBN E capa ainda consulta edição p/ páginas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      jsonResponse({ title: 'X', authors: [], covers: [55], number_of_pages: 320 })
    ));
    const comIsbnECapa = {
      ...baseBook,
      codigo_isbn: '9788535902778',
      cover: 'https://covers.openlibrary.org/b/id/55-L.jpg',
      paginas: null,
    };
    const meta = await findMetadataForBook(comIsbnECapa);
    expect(meta?.paginas).toBe(320);
    expect((fetch as any).mock.calls[0][0]).toContain('/isbn/');
    vi.unstubAllGlobals();
  });
});
