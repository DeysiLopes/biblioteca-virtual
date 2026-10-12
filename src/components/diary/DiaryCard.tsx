import React from 'react';
import { Book } from '../../core/models/book';
import { getBookFallback, getBookCover, hideTinyCover } from '../book/BookCard';
import { calculatePercentage } from '../../core/business/progress';

interface DiaryCardProps {
  book: Book;
  onOpenCover: (book: Book) => void;
  onOpenModal: (book: Book, rect?: DOMRect | null) => void;
  onOpenQuotes: (book: Book) => void;
}

export const DiaryCard: React.FC<DiaryCardProps> = ({
  book,
  onOpenCover,
  onOpenModal,
  onOpenQuotes,
}) => {
  const fb = getBookFallback(book.title);
  const perc = calculatePercentage(book.paginasLidas, book.paginas);
  const quotesCount = Array.isArray(book.citacoes) ? book.citacoes.length : 0;

  const renderStars = (nota: number = 0) => {
    return [1, 2, 3, 4, 5].map((i) => (
      <span key={i} style={{ color: i <= nota ? 'var(--accent)' : 'oklch(1 0 0 / 0.15)', fontSize: 16 }}>
        ★
      </span>
    ));
  };

  return (
    <article
      className="nbook"
      style={{
        display: 'flex',
        gap: 14,
        background: 'var(--paper2)',
        borderRadius: 14,
        padding: 14,
        border: '1px solid var(--line)',
        alignItems: 'flex-start',
      }}
    >
      {/* Capa com botão 3D flip */}
      <button
        type="button"
        className="coverbtn"
        onClick={() => onOpenCover(book)}
        title="Virar o livro em 3D"
        style={{
          position: 'relative',
          display: 'block',
          width: 68,
          height: 98,
          flexShrink: 0,
          border: 'none',
          padding: 0,
          background: 'none',
          cursor: 'pointer',
          borderRadius: 6,
          overflow: 'hidden',
          boxShadow: '0 4px 12px -4px oklch(0 0 0 / 0.6)',
        }}
      >
        <div
          className="cover-wrap"
          style={
            {
              '--g1': fb.g1,
              '--g2': fb.g2,
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              borderRadius: 'inherit',
            } as React.CSSProperties
          }
        >
          <div className="fallback" style={{ fontSize: 20 }}>
            {fb.initials}
          </div>
          {getBookCover(book) ? (
            <img
              src={getBookCover(book)}
              alt={book.title}
              onLoad={hideTinyCover}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: 'inherit',
              }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : null}
        </div>
      </button>

      {/* Conteúdo do cartão */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          onClick={(e) => {
            const cover = (e.currentTarget as HTMLElement)
              .closest('.nbook')
              ?.querySelector('.coverbtn')
              ?.getBoundingClientRect();
            onOpenModal(book, cover ?? e.currentTarget.getBoundingClientRect());
          }}
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onOpenModal(book);
          }}
        >
          <h3 className="serif" style={{ fontSize: 20, margin: 0, color: 'var(--ink)' }}>
            {book.title}
          </h3>
          {book.author && (
            <p style={{ margin: '2px 0 6px', fontSize: 13, color: 'var(--ink2)' }}>
              {book.author}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
            <div className="stars">{renderStars(book.nota || 0)}</div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 999,
                background: 'oklch(1 0 0 / 0.08)',
                color: 'var(--ink2)',
              }}
            >
              {book.status}
            </span>
          </div>

          <div style={{ margin: '8px 0 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink2)', marginBottom: 2 }}>
              <span>
                {book.paginasLidas || 0} {book.paginas ? `/ ${book.paginas}` : 'págs'}
              </span>
              <span>{perc}%</span>
            </div>
            <div
              className="pp"
              style={{
                width: '100%',
                height: 6,
                background: 'oklch(0 0 0 / 0.4)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${perc}%`,
                  height: '100%',
                  background: 'var(--accent)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        </div>

        {/* Botão para abrir o fichário de citações */}
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            className="cite-btn"
            onClick={() => onOpenQuotes(book)}
            style={{
              background: 'transparent',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>📑 Fichário de citações ({quotesCount})</span>
          </button>
        </div>
      </div>
    </article>
  );
};
