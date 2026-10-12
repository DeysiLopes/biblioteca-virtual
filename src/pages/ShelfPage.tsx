import React, { useState, useMemo } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import { Book, BookStatus } from '../core/models/book';
import { BookCard } from '../components/book/BookCard';
import { BookModal } from '../components/book/BookModal';
import { normalizeString } from '../core/business/csv-parser';

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

      {/* Prateleiras */}
      <div id="shelves">
        {activeGroupBooks.length > 0 && (
          <section className="shelf-section">
            <h2>
              Minha estante <span>{activeGroupBooks.length} livros</span>
            </h2>
            <div className="shelf">
              <div className="shelf-head">
                Prateleira <i>{activeGroupBooks.length} livros</i>
              </div>
              <div className="shelf-wood">
                <div className="books">
                  {activeGroupBooks.map((b, idx) => (
                    <BookCard
                      key={b.id}
                      book={b}
                      modeIndex={idx}
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
          </section>
        )}

        {readGroupBooks.length > 0 && (
          <section className="shelf-section">
            <h2>
              Livros lidos <span>{readGroupBooks.length} livros</span>
            </h2>
            <div className="shelf">
              <div className="shelf-head">
                Prateleira de lidos <i>{readGroupBooks.length} livros</i>
              </div>
              <div className="shelf-wood">
                <div className="books">
                  {readGroupBooks.map((b, idx) => (
                    <BookCard
                      key={b.id}
                      book={b}
                      modeIndex={idx}
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
          </section>
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
