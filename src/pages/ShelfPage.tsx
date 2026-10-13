import React, { useState, useMemo, useLayoutEffect, useRef } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import { Book, BookStatus } from '../core/models/book';
import { BookCard, hashHue } from '../components/book/BookCard';
import { BookModal } from '../components/book/BookModal';
import { ShelfCat } from '../components/common/ShelfCat';

// MVP 1: cada prateleira comporta os livros que cabem na largura disponível
const bookSize = (b: Book) => 86 + (hashHue(b.title || '') % 54);
const bookRowWidth = (b: Book) => Math.max(40, Math.round((bookSize(b) * 2) / 3)) + 4;

function chunkShelfRows(list: Book[], containerWidth: number): Book[][] {
  const avail = Math.max(72, containerWidth - 120);
  const rows: Book[][] = [];
  let row: Book[] = [];
  let wsum = 0;
  for (const b of list) {
    const bw = bookRowWidth(b);
    if (row.length && wsum + bw > avail) {
      rows.push(row);
      row = [];
      wsum = 0;
    }
    row.push(b);
    wsum += bw;
  }
  if (row.length) rows.push(row);
  return rows;
}

// Ordem das prateleiras: o que está sendo lido primeiro, abandonados por último
const SHELF_SECTIONS: { status: BookStatus; title: string }[] = [
  { status: 'Lendo', title: 'Lendo agora' },
  { status: 'Quero ler', title: 'Quero ler' },
  { status: 'Lido', title: 'Lidos' },
  { status: 'Abandonado', title: 'Abandonados' },
];

export const ShelfPage: React.FC = () => {
  const { books, summary, saveBook } = useLibrary();

  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [selectedAuthor, setSelectedAuthor] = useState<string>('');
  const [focusStatus, setFocusStatus] = useState<string>('Todos');
  const [activeBook, setActiveBook] = useState<Book | null>(null);
  const [modalRect, setModalRect] = useState<DOMRect | null>(null);

  // Gêneros e autores únicos disponíveis para os dropdowns
  const genres = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.genero && b.genero.trim()) set.add(b.genero.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt'));
  }, [books]);

  const authors = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.author && b.author.trim()) set.add(b.author.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt'));
  }, [books]);

  // Filtragem real: só gênero e autor
  const filteredBooks = useMemo(
    () =>
      books.filter((b) => {
        if (selectedGenre && b.genero !== selectedGenre) return false;
        if (selectedAuthor && b.author !== selectedAuthor) return false;
        return true;
      }),
    [books, selectedGenre, selectedAuthor]
  );

  // Mede a largura real para quebrar os livros em várias prateleiras
  const shelvesRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<BookStatus, HTMLElement | null>>>({});
  const [shelfWidth, setShelfWidth] = useState(0);
  useLayoutEffect(() => {
    const el = shelvesRef.current;
    if (!el) return;
    const measure = () => setShelfWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sectionRows = useMemo(() => {
    const map = {} as Record<BookStatus, Book[][]>;
    for (const { status } of SHELF_SECTIONS) {
      const list = filteredBooks.filter((b) => b.status === status);
      map[status] = chunkShelfRows(list, shelfWidth || 1024);
    }
    return map;
  }, [filteredBooks, shelfWidth]);

  // Botões de status viram atalhos de rolagem até a prateleira correspondente
  const scrollToStatus = (st: string) => {
    setFocusStatus(st);
    if (st === 'Todos') {
      shelvesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    sectionRefs.current[st as BookStatus]?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const total = books.length;
  const lendo = books.filter((b) => b.status === 'Lendo').length;
  const lidos = books.filter((b) => b.status === 'Lido').length;
  const hoje = summary?.hoje || 0;

  return (
    <div className="shelf-page">
      {/* Filtros */}
      <div className="filters" id="filters">
        <div className="status-filters">
          {['Todos', 'Lendo', 'Quero ler', 'Lido', 'Abandonado'].map((st) => (
            <button
              key={st}
              className={`pill ${focusStatus === st ? 'on' : ''}`}
              onClick={() => scrollToStatus(st)}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="filter-field">
          <label htmlFor="genreSelect">Gênero:</label>
          <select
            id="genreSelect"
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
          >
            <option value="">Todos os gêneros</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="authorSelect">Autor:</label>
          <select
            id="authorSelect"
            value={selectedAuthor}
            onChange={(e) => setSelectedAuthor(e.target.value)}
          >
            <option value="">Todos os autores</option>
            {authors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Estatísticas rápidas da estante */}
      <div className="statsRow" id="statsShelf">
        <span>
          <b>{total}</b> na biblioteca
        </span>{' '}
        ·{' '}
        <span>
          <b>{lendo}</b> lendo
        </span>{' '}
        ·{' '}
        <span>
          <b>{lidos}</b> lidos
        </span>{' '}
        ·{' '}
        <span>
          Hoje <b>{hoje}</b> págs
        </span>
      </div>

      {/* Prateleiras por status — quebram por largura, como no MVP 1 */}
      <div id="shelves" ref={shelvesRef}>
        {SHELF_SECTIONS.map(({ status, title }, si) => {
          const rows = sectionRows[status];
          if (!rows || rows.length === 0) return null;
          const count = rows.reduce((acc, r) => acc + r.length, 0);
          return (
            <section
              className="shelf-section"
              key={status}
              ref={(el) => {
                sectionRefs.current[status] = el;
              }}
            >
              <h2>
                {title} <span>{count} {count === 1 ? 'livro' : 'livros'}</span>
              </h2>
              {rows.map((row, ri) => (
                <div className="shelf" key={`${status}-${ri}`}>
                  <div className="shelf-wood">
                    {si === 0 && ri === 0 && <ShelfCat />}
                    <div className="books">
                      {row.map((b, mi) => (
                        <BookCard
                          key={b.id}
                          book={b}
                          modeIndex={mi + ri * 3}
                          onClick={(e) => {
                            const rect = (e.currentTarget as HTMLElement)
                              .querySelector('.cover-wrap')
                              ?.getBoundingClientRect();
                            setModalRect(rect ?? null);
                            setActiveBook(b);
                          }}
                        />
                      ))}
                      <div className="deco">
                        <div className="dbookend" />
                        <div className="dstack" />
                      </div>
                    </div>
                  </div>
                  <div className="rail" />
                </div>
              ))}
            </section>
          );
        })}

        {filteredBooks.length === 0 && (
          <p id="empty" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink2)' }}>
            Nenhum livro encontrado para os filtros selecionados.
          </p>
        )}
      </div>

      {activeBook && (
        <BookModal
          book={activeBook}
          allBooks={books}
          isOpen={true}
          sourceRect={modalRect}
          onClose={() => setActiveBook(null)}
          onSave={saveBook}
          onSelectBook={(id) => {
            const found = books.find((b) => b.id === id);
            if (found) setActiveBook(found);
          }}
        />
      )}
    </div>
  );
};
