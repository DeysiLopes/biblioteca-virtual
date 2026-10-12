import React, { useEffect } from 'react';
import { Citacao } from '../../core/models/book';

interface QuoteReaderProps {
  quote: Citacao;
  bookTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export const QuoteReader: React.FC<QuoteReaderProps> = ({
  quote,
  bookTitle,
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !quote) return null;

  return (
    <div
      id="leitura"
      className="open"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        id="leiClose"
        className="xclose"
        onClick={onClose}
        aria-label="Fechar leitura"
        style={{
          position: 'absolute',
          top: 20,
          right: 24,
          background: 'oklch(0 0 0 / 0.5)',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: 38,
          height: 38,
          fontSize: 18,
          cursor: 'pointer',
          zIndex: 100,
        }}
      >
        ✕
      </button>

      <div className="book">
        {/* 3 folhas virando com animação em cascata leafTurn */}
        <div className="leaf" style={{ '--delay': '0s' } as React.CSSProperties} />
        <div className="leaf" style={{ '--delay': '0.12s' } as React.CSSProperties} />
        <div className="leaf" style={{ '--delay': '0.24s' } as React.CSSProperties} />

        <div className="pagina">
          <div className="page-mark" style={{ textAlign: 'center', marginBottom: 20 }}>
            <span
              style={{
                fontFamily: '"Nunito", sans-serif',
                fontSize: 12,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                color: 'oklch(0.4 0.05 40)',
                fontWeight: 700,
              }}
            >
              {bookTitle}
            </span>
          </div>

          <div className="quote" style={{ margin: 'auto 0', padding: '10px 0' }}>
            <p
              className="quote-text serif"
              style={{
                fontSize: 24,
                lineHeight: 1.6,
                color: '#211812',
                fontStyle: 'italic',
                textAlign: 'center',
                margin: 0,
              }}
            >
              “{quote.text}”
            </p>
          </div>

          <div className="pnum" style={{ textAlign: 'right', marginTop: 'auto', paddingTop: 16 }}>
            <span
              style={{
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: 18,
                color: 'oklch(0.4 0.05 40)',
                fontWeight: 600,
              }}
            >
              pág. {quote.page}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
