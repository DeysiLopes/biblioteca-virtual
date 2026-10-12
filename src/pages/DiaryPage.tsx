import React, { useState } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import { Book } from '../core/models/book';
import { StatsSummary } from '../components/diary/StatsSummary';
import { WeeklyChart } from '../components/diary/WeeklyChart';
import { DiaryCard } from '../components/diary/DiaryCard';
import { BookModal } from '../components/book/BookModal';
import { FlipBook } from '../components/book/FlipBook';
import { ReviewNotebook } from '../components/review/ReviewNotebook';
import { FicharioModal } from '../components/quotes/FicharioModal';

export const DiaryPage: React.FC = () => {
  const { books, summary, saveBook } = useLibrary();

  const [modalBook, setModalBook] = useState<Book | null>(null);
  const [flipBook, setFlipBook] = useState<Book | null>(null);
  const [notebookBook, setNotebookBook] = useState<Book | null>(null);
  const [quotesBook, setQuotesBook] = useState<Book | null>(null);

  const handleRegisterToday = () => {
    const lendo = books.find((b) => b.status === 'Lendo');
    if (lendo) {
      setModalBook(lendo);
    } else if (books.length > 0) {
      setModalBook(books[0]);
    }
  };

  const handleOpenNotebookFromFlip = (bookId: string) => {
    const found = books.find((b) => b.id === bookId);
    if (found) {
      setFlipBook(null);
      setNotebookBook(found);
    }
  };

  const handleSaveReview = async (bookId: string, reviewText: string) => {
    const found = books.find((b) => b.id === bookId);
    if (found) {
      const updated: Book = {
        ...found,
        resenha: reviewText,
        updatedAt: Date.now(),
      };
      await saveBook(updated);
      // Fecha o caderno e retorna para o flipbook na contracapa com o X
      setNotebookBook(null);
      setFlipBook(updated);
    }
  };

  const handleCloseNotebook = () => {
    if (notebookBook) {
      const current = notebookBook;
      setNotebookBook(null);
      setFlipBook(current);
    } else {
      setNotebookBook(null);
    }
  };

  // Livros com atividade no diário ou em andamento
  const diaryBooks = books.filter(
    (b) =>
      b.status === 'Lendo' ||
      (b.paginasLidas && b.paginasLidas > 0) ||
      b.resenha ||
      (b.citacoes && b.citacoes.length > 0)
  );

  return (
    <div className="diary-page">
      <div style={{ marginBottom: 16 }}>
        <h2 className="serif" style={{ fontSize: 26, margin: 0, color: 'var(--ink)' }}>
          Diário de Leitura & Dashboard
        </h2>
        <p style={{ margin: '3px 0 0', color: 'var(--ink2)', fontSize: 13 }}>
          Acompanhe sua sequência, metas semanais e histórico por livro.
        </p>
      </div>

      <StatsSummary summary={summary} />

      <div style={{ margin: '20px 0' }}>
        {summary?.week && <WeeklyChart days={summary.week} />}
      </div>

      <div style={{ textAlign: 'center', margin: '20px 0' }}>
        <button
          className="big hbtn"
          onClick={handleRegisterToday}
          style={{
            background: 'var(--green)',
            color: '#0f1a12',
            border: 'none',
            fontSize: 16,
            fontWeight: 800,
            padding: '14px 28px',
            borderRadius: 12,
            margin: '0 auto',
          }}
        >
          ＋ Registrar leitura de hoje
        </button>
      </div>

      <div id="diaryList" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}>
        {diaryBooks.length > 0 ? (
          diaryBooks.map((b) => (
            <DiaryCard
              key={b.id}
              book={b}
              onOpenCover={(book) => setFlipBook(book)}
              onOpenModal={(book) => setModalBook(book)}
              onOpenQuotes={(book) => setQuotesBook(book)}
            />
          ))
        ) : (
          <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink2)' }}>
            Nenhuma leitura registrada ainda. Que tal começar hoje? 🙂
          </p>
        )}
      </div>

      {/* Modais compartilhados */}
      {modalBook && (
        <BookModal
          book={modalBook}
          allBooks={books}
          isOpen={true}
          onClose={() => setModalBook(null)}
          onSave={saveBook}
          onSelectBook={(id) => {
            const found = books.find((b) => b.id === id);
            if (found) setModalBook(found);
          }}
        />
      )}

      {flipBook && (
        <FlipBook
          book={flipBook}
          isOpen={true}
          initialFlipped={true}
          onClose={() => setFlipBook(null)}
          onOpenNotebook={handleOpenNotebookFromFlip}
        />
      )}

      {notebookBook && (
        <ReviewNotebook
          book={notebookBook}
          isOpen={true}
          onClose={handleCloseNotebook}
          onSave={handleSaveReview}
        />
      )}

      {quotesBook && (
        <FicharioModal
          book={quotesBook}
          isOpen={true}
          onClose={() => setQuotesBook(null)}
          onSaveBook={saveBook}
        />
      )}
    </div>
  );
};
