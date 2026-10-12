import React, { useState, useMemo, useLayoutEffect, useRef } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import { Book } from '../core/models/book';
import { BookCard, hashHue } from '../components/book/BookCard';
import { BookModal } from '../components/book/BookModal';
import { ShelfCat } from '../components/common/ShelfCat';
import { normalizeString } from '../core/business/csv-parser';

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

export const ShelfPage: React.FC = () => {
  const { books, summary, saveBook } = useLibrary();

  const [selectedStatus, setSelectedStatus] = useState<string>('Todos');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeBook, setActiveBook] = useState<Book | null>(null);

  // Gêneros únicos disponíveis
  const genres = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.genero && b.genero.trim()) set.add(b.genero.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt'));
  }, [books]);

  // Filtragem dos livros
  const filteredBooks = useMemo(() => {
    const q = normalizeString(searchQuery);
    return books.filter((b) => {
      if (selectedStatus !== 'Todos' && b.status !== selectedStatus) return false;
      if (selectedGenre && b.genero !== selectedGenre) return false;
      if (q) {
        const titleMatch = normalizeString(b.title).includes(q);
        const authorMatch = normalizeString(b.author).includes(q);
        if (!titleMatch && !authorMatch) return false;
      }
      return true;
    });
  }, [books, selectedStatus, selectedGenre, searchQuery]);

  const activeGroupBooks = filteredBooks.filter((b) => b.status !== 'Lido');
  const readGroupBooks = filteredBooks.filter((b) => b.status === 'Lido');

  // Mede a largura real para quebrar os livros em várias prateleiras
  const shelvesRef = useRef<HTMLDivElement>(null);
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

  const activeRows = useMemo(
    () => chunkShelfRows(activeGroupBooks, shelfWidth || 1024),
    [activeGroupBooks, shelfWidth]
  );
  const readRows = useMemo(
    () => chunkShelfRows(readGroupBooks, shelfWidth || 1024),
    [readGroupBooks, shelfWidth]
  );

  const total = books.length;
  const lendo = books.filter((b) => b.status === 'Lendo').length;
  const lidos = books.filter((b) => b.status === 'Lido').length;
  const hoje = summary?.hoje || 0;

  return (
    <div className="shelf-page">
      {/* Filtros */}
      <div className="filters" id="filters">
        <div className="status-filters">
          {['Todos', 'Quero ler', 'Lendo', 'Lido', 'Abandonado'].map((st) => (
            <button
              key={st}
              className={`pill ${selectedStatus === st ? 'on' : ''}`}
              onClick={() => setSelectedStatus(st)}
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

        <div className="filter-field filter-search">
          <label htmlFor="filterSearch">Buscar título ou autor:</label>
          <input
            id="filterSearch"
            type="search"
            placeholder="Ex: Machado de Assis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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

      {/* Prateleiras — quebram por largura, como no MVP 1 */}
      <div id="shelves" ref={shelvesRef}>
        {(
          [
            { title: 'Minha estante', rows: activeRows, count: activeGroupBooks.length, read: false },
            { title: 'Livros lidos', rows: readRows, count: readGroupBooks.length, read: true },
          ] as const
        ).map(
          (group, gi) =>
            group.rows.length > 0 && (
              <section className="shelf-section" key={group.title}>
                <h2>
                  {group.title} <span>{group.count} livros</span>
                </h2>
                {group.rows.map((row, ri) => (
                  <div className="shelf" key={`${group.title}-${ri}`}>
                    <div className="shelf-head">
                      {group.read ? 'Prateleira de lidos' : 'Prateleira'} {ri + 1}
                      <i>{row.length} livros</i>
                    </div>
                    <div className="shelf-wood">
                      {gi === 0 && ri === 0 && <ShelfCat />}
                      <div className="books">
                        {row.map((b, mi) => (
                          <BookCard
                            key={b.id}
                            book={b}
                            modeIndex={mi + ri * 3}
                            onClick={() => setActiveBook(b)}
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
            )
        )}

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
