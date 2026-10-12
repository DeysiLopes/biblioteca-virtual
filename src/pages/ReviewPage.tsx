import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLibrary } from '../hooks/useLibrary';
import { ReviewNotebook } from '../components/review/ReviewNotebook';
import { Book } from '../core/models/book';

export const ReviewPage: React.FC = () => {
  const { livroId } = useParams<{ livroId: string }>();
  const navigate = useNavigate();
  const { books, saveBook } = useLibrary();

  const book = books.find((b) => b.id === livroId);

  const handleSaveReview = async (id: string, reviewText: string, spoilers: boolean) => {
    if (!book) return;
    const updated: Book = {
      ...book,
      resenha: reviewText,
      resenhaSpoilers: spoilers,
      updatedAt: Date.now(),
    };
    await saveBook(updated);
  };

  if (!book) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <h2 className="serif" style={{ fontSize: 24, color: 'var(--ink)' }}>
          Livro não encontrado
        </h2>
        <p style={{ color: 'var(--ink2)', margin: '10px 0 20px' }}>
          Não foi possível encontrar um livro com o identificador "{livroId}".
        </p>
        <button
          className="hbtn"
          onClick={() => navigate('/estante')}
          style={{ margin: '0 auto', background: 'var(--accent)', color: '#17100f', fontWeight: 700 }}
        >
          Voltar para a Estante
        </button>
      </div>
    );
  }

  return (
    <ReviewNotebook
      book={book}
      isOpen={true}
      onClose={() => navigate(-1)}
      onSave={handleSaveReview}
    />
  );
};
