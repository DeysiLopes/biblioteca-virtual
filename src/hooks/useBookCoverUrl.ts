import { useEffect, useState } from 'react';
import { Book } from '../core/models/book';
import { cachedCoverUrl, coverFileName, ensureCoverCached, remoteCoverUrl, resolveCoverUrl } from '../core/storage/cover-cache';

/**
 * Capa do livro para renderizar: começa com a URL remota imediata (ou o
 * object URL já em cache) e troca pelo blob do IndexedDB/Drive quando ele
 * resolve. Em segundo plano, garante a capa salva em Minha Biblioteca/capas
 * — é o que faz a próxima busca de metadados não refazer o que já achamos.
 */
export function useBookCoverUrl(book: Book | null | undefined): string {
  const name = book ? coverFileName(book) : '';
  const [url, setUrl] = useState(() =>
    book ? cachedCoverUrl(name) ?? remoteCoverUrl(book) : ''
  );

  useEffect(() => {
    if (!book) return;
    let live = true;
    resolveCoverUrl(book)
      .then((u) => {
        if (live && u) setUrl(u);
      })
      .catch(() => {});
    void ensureCoverCached(book);
    return () => {
      live = false;
    };
  }, [book?.id, book?.cover, book?.coverFileId, book?.codigo_isbn]);

  return url;
}
