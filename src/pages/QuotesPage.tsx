import React, { useState } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import { Book } from '../core/models/book';
import { FicharioModal } from '../components/quotes/FicharioModal';

export const QuotesPage: React.FC = () => {
  const { books, saveBook } = useLibrary();
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  // Derivado da lista — o fichário enxerga novas fichas sem reabrir
  const selectedBook = selectedBookId
    ? books.find((b) => b.id === selectedBookId) ?? null
    : null;

  // Livros que possuem citações ou todos os livros para adicionar
  const booksWithQuotes = books.filter((b) => b.citacoes && b.citacoes.length > 0);

  return (
    <div className="quotes-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 className="serif" style={{ fontSize: 28, margin: 0, color: 'var(--ink)' }}>
            📑 Fichário de Citações
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--ink2)', fontSize: 14 }}>
            Explore e anote passagens memoráveis de cada livro.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label htmlFor="bookSelect" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ink2)', marginBottom: 6 }}>
          Selecione um livro para abrir no fichário:
        </label>
        <select
          id="bookSelect"
          onChange={(e) => setSelectedBookId(e.target.value)}
          value=""
          style={{
            width: '100%',
            maxWidth: 400,
            padding: '10px 14px',
            borderRadius: 8,
            background: 'var(--paper2)',
            color: 'var(--ink)',
            border: '1px solid var(--line)',
          }}
        >
          <option value="" disabled>
            Escolha um livro...
          </option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title} ({b.citacoes?.length || 0} citações)
            </option>
          ))}
        </select>
      </div>

      {booksWithQuotes.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {booksWithQuotes.map((b) => (
            <div
              key={b.id}
              onClick={() => setSelectedBookId(b.id)}
              style={{
                background: 'var(--paper2)',
                borderRadius: 12,
                padding: 16,
                border: '1px solid var(--line)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 className="serif" style={{ fontSize: 20, margin: 0, color: 'var(--ink)' }}>
                  {b.title}
                </h3>
                {b.author && (
                  <p style={{ margin: '2px 0 8px', fontSize: 13, color: 'var(--ink2)' }}>
                    {b.author}
                  </p>
                )}
                <p style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, margin: 0 }}>
                  {b.citacoes?.length} citação(ões) gravada(s)
                </p>
              </div>
              <button
                type="button"
                style={{
                  marginTop: 14,
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: 'oklch(1 0 0 / 0.08)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  alignSelf: 'flex-start',
                }}
              >
                Abrir fichário →
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--ink2)', fontStyle: 'italic', textAlign: 'center', padding: '40px 0' }}>
          Nenhuma citação cadastrada ainda. Selecione um livro acima para adicionar a primeira ficha!
        </p>
      )}

      {selectedBook && (
        <FicharioModal
          book={selectedBook}
          isOpen={true}
          onClose={() => setSelectedBookId(null)}
          onSaveBook={saveBook}
        />
      )}
    </div>
  );
};
