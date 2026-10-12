import React, { useState, useEffect } from 'react';
import { Book } from '../../core/models/book';
import { getBookFallback } from './BookCard';

interface FlipBookProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  onOpenNotebook: (bookId: string) => void;
  initialFlipped?: boolean;
}

export const FlipBook: React.FC<FlipBookProps> = ({
  book,
  isOpen,
  onClose,
  onOpenNotebook,
  initialFlipped = false,
}) => {
  const [flipped, setFlipped] = useState(initialFlipped);

  useEffect(() => {
    if (isOpen) {
      if (initialFlipped) {
        setFlipped(true);
      } else {
        const timer = setTimeout(() => setFlipped(true), 260);
        return () => clearTimeout(timer);
      }
    } else {
      setFlipped(false);
    }
  }, [isOpen, initialFlipped]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !book) return null;

  const fb = getBookFallback(book.title);

  return (
    <div
      id="flipview"
      className="open"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        className="xclose"
        onClick={onClose}
        aria-label="Fechar contracapa e voltar ao diário"
        title="Fechar (Esc)"
        style={{
          position: 'absolute',
          top: 20,
          right: 24,
          background: 'oklch(0 0 0 / 0.55)',
          color: '#efdfc8',
          border: '1px solid var(--line)',
          borderRadius: '50%',
          width: 40,
          height: 40,
          fontSize: 18,
          cursor: 'pointer',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px oklch(0 0 0 / 0.6)',
          transition: 'transform 0.2s ease',
        }}
      >
        ✕
      </button>

      <div
        className={`flip-book ${flipped ? 'flipped' : ''}`}
        tabIndex={0}
        role="button"
        aria-label="Capa do livro em 3D. Pressione Enter ou clique para virar."
        onClick={() => setFlipped(!flipped)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setFlipped(!flipped);
          }
        }}
      >
        <div className="flip-inner">
          {/* Face frontal: Capa */}
          <div
            className="flip-face front"
            style={{ '--g1': fb.g1, '--g2': fb.g2 } as React.CSSProperties}
          >
            <div className="fallback">{fb.initials}</div>
            {book.cover ? (
              <img
                src={book.cover}
                alt={book.title}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : null}
          </div>

          {/* Face traseira: Contracapa / Resenha */}
          <div className="flip-face back">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span className="blab">Contracapa</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                aria-label="Fechar contracapa"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--ink2)',
                  fontSize: 18,
                  cursor: 'pointer',
                  padding: '2px 6px',
                }}
              >
                ✕
              </button>
            </div>
            <h3 className="serif" style={{ fontSize: 20, margin: '8px 0 4px', color: 'var(--ink)' }}>
              {book.title}
            </h3>
            {book.author && (
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ink2)' }}>
                {book.author}
              </p>
            )}

            <div
              className="rv"
              style={{
                flex: 1,
                overflowY: 'auto',
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--ink)',
                padding: '6px 0',
              }}
            >
              {book.resenha ? (
                book.resenha
              ) : (
                <p className="hint" style={{ color: 'var(--ink2)', fontStyle: 'italic' }}>
                  Nenhuma resenha registrada ainda. Clique abaixo para escrever no caderno!
                </p>
              )}
            </div>

            <button
              className="edit-review"
              onClick={(e) => {
                e.stopPropagation();
                onOpenNotebook(book.id);
              }}
              style={{
                marginTop: 10,
                padding: '8px 14px',
                borderRadius: 8,
                background: 'var(--accent)',
                color: '#17100f',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ✍️ {book.resenha ? 'Editar resenha' : 'Escrever resenha'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
