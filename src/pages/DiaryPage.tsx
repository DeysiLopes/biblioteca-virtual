import React, { useState, useEffect } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import { Book } from '../core/models/book';
import { StatsSummary } from '../components/diary/StatsSummary';
import { WeeklyChart } from '../components/diary/WeeklyChart';
import { DiaryCard } from '../components/diary/DiaryCard';
import { BookModal } from '../components/book/BookModal';
import { FlipBook } from '../components/book/FlipBook';
import { ReviewNotebook, CoverOrigin } from '../components/review/ReviewNotebook';
import { FicharioModal } from '../components/quotes/FicharioModal';

export const DiaryPage: React.FC = () => {
  const { books, summary, saveBook } = useLibrary();

  // Guardamos só os IDs — os modais derivam o livro da lista atual,
  // então enxergam edições e mudanças do sync sem precisar reabrir
  const [modalBookId, setModalBookId] = useState<string | null>(null);
  const [flipBookId, setFlipBookId] = useState<string | null>(null);
  const [notebookBook, setNotebookBook] = useState<Book | null>(null);
  const [coverOrigin, setCoverOrigin] = useState<CoverOrigin | null>(null);
  const [quotesBookId, setQuotesBookId] = useState<string | null>(null);

  const modalBook = modalBookId ? books.find((b) => b.id === modalBookId) ?? null : null;
  const flipBook = flipBookId ? books.find((b) => b.id === flipBookId) ?? null : null;
  const quotesBook = quotesBookId ? books.find((b) => b.id === quotesBookId) ?? null : null;

  // Trava o scroll da página enquanto qualquer overlay estiver aberto (como no MVP 1)
  useEffect(() => {
    const anyOpen = Boolean(modalBookId || flipBookId || quotesBookId);
    document.body.style.overflow = anyOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [modalBookId, flipBookId, quotesBookId]);

  const handleRegisterToday = () => {
    const lendo = books.find((b) => b.status === 'Lendo');
    if (lendo) {
      setModalBookId(lendo.id);
    } else if (books.length > 0) {
      setModalBookId(books[0].id);
    }
  };

  // Abre a folha do caderno sobre a contracapa: a capa sobe e encaixa acima da folha
  const handleOpenNotebookFromFlip = (book: Book) => {
    const rect = document
      .querySelector('#flipview .flip-book')
      ?.getBoundingClientRect();
    setCoverOrigin(
      rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null
    );
    setNotebookBook(book);
  };

  // Salva a resenha e retorna à contracapa (estado anterior), como no MVP 1
  const handleSaveReview = async (bookId: string, reviewText: string, spoilers: boolean) => {
    const base = books.find((b) => b.id === bookId) ?? notebookBook;
    if (base) {
      const updated: Book = {
        ...base,
        resenha: reviewText,
        resenhaSpoilers: spoilers,
        updatedAt: Date.now(),
      };
      await saveBook(updated);
    }
    setNotebookBook(null);
    setCoverOrigin(null);
  };

  // Fechar a folha retorna à contracapa; só o "Fechar" da contracapa volta ao diário
  const handleCloseNotebook = () => {
    setNotebookBook(null);
    setCoverOrigin(null);
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
              onOpenCover={(book) => setFlipBookId(book.id)}
              onOpenModal={(book) => setModalBookId(book.id)}
              onOpenQuotes={(book) => setQuotesBookId(book.id)}
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
          onClose={() => setModalBookId(null)}
          onSave={saveBook}
          onSelectBook={(id) => setModalBookId(id)}
        />
      )}

      {flipBook && (
        <FlipBook
          key={flipBook.id}
          book={flipBook}
          isOpen={!notebookBook}
          onClose={() => setFlipBookId(null)}
          onOpenNotebook={handleOpenNotebookFromFlip}
        />
      )}

      {notebookBook && (
        <ReviewNotebook
          book={notebookBook}
          isOpen={true}
          coverOrigin={coverOrigin}
          onClose={handleCloseNotebook}
          onSave={handleSaveReview}
        />
      )}

      {quotesBook && (
        <FicharioModal
          book={quotesBook}
          isOpen={true}
          onClose={() => setQuotesBookId(null)}
          onSaveBook={saveBook}
        />
      )}
    </div>
  );
};
