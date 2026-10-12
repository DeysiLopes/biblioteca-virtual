import React, { useState } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import { StatsSummary } from '../components/diary/StatsSummary';
import { WeeklyChart } from '../components/diary/WeeklyChart';
import { BookModal } from '../components/book/BookModal';
import { Book } from '../core/models/book';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { books, summary, saveBook } = useLibrary();
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [modalRect, setModalRect] = useState<DOMRect | null>(null);

  const currentlyReading = books.filter((b) => b.status === 'Lendo');

  const handleOpenQuickRegister = () => {
    if (currentlyReading.length > 0) {
      setSelectedBook(currentlyReading[0]);
    } else if (books.length > 0) {
      setSelectedBook(books[0]);
    }
  };

  return (
    <div className="dashboard-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="serif" style={{ fontSize: 28, margin: 0, color: 'var(--ink)' }}>
          Visão Geral & Estatísticas
        </h2>
        <button
          className="hbtn"
          onClick={handleOpenQuickRegister}
          style={{ background: 'var(--green)', color: '#0f1a12', border: 'none', fontWeight: 700 }}
        >
          ＋ Registrar leitura de hoje
        </button>
      </div>

      <StatsSummary summary={summary} />

      <div style={{ marginTop: 24 }}>
        <h3 className="serif" style={{ fontSize: 20, margin: '0 0 12px', color: 'var(--ink2)' }}>
          Leituras dos últimos 7 dias
        </h3>
        {summary?.week && <WeeklyChart days={summary.week} />}
      </div>

      <div style={{ marginTop: 32 }}>
        <h3 className="serif" style={{ fontSize: 22, margin: '0 0 14px', color: 'var(--ink)' }}>
          📖 Livros em leitura ({currentlyReading.length})
        </h3>
        {currentlyReading.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {currentlyReading.map((b) => (
              <div
                key={b.id}
                onClick={(e) => {
                  setModalRect(e.currentTarget.getBoundingClientRect());
                  setSelectedBook(b);
                }}
                style={{
                  background: 'var(--paper2)',
                  borderRadius: 12,
                  padding: 14,
                  border: '1px solid var(--line)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <h4 className="serif" style={{ fontSize: 18, margin: 0, color: 'var(--ink)' }}>
                    {b.title}
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--ink2)' }}>
                    {b.paginasLidas || 0} de {b.paginas || '?'} págs
                  </p>
                </div>
                <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>
                  Avançar →
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--ink2)', fontStyle: 'italic' }}>
            Nenhum livro marcado como "Lendo" no momento.{' '}
            <Link to="/estante" style={{ color: 'var(--accent)', fontWeight: 700 }}>
              Ver estante
            </Link>
          </p>
        )}
      </div>

      {selectedBook && (
        <BookModal
          book={selectedBook}
          allBooks={books}
          isOpen={true}
          sourceRect={modalRect}
          onClose={() => setSelectedBook(null)}
          onSave={saveBook}
          onSelectBook={(id) => {
            const found = books.find((b) => b.id === id);
            if (found) setSelectedBook(found);
          }}
        />
      )}
    </div>
  );
};
