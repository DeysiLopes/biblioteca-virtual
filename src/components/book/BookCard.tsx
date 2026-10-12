import React from 'react';
import { Book } from '../../core/models/book';
import { normalizeString } from '../../core/business/csv-parser';

interface BookCardProps {
  book: Book;
  modeIndex?: number;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function hashHue(s: string): number {
  let h = 0;
  for (const c of String(s)) {
    h = (h * 31 + c.charCodeAt(0)) % 360;
  }
  return h;
}

export function getBookFallback(title: string) {
  const h = hashHue(title);
  const words = normalizeString(title).split(' ').filter(Boolean).slice(0, 2);
  const initials = words.map(w => w[0] || '').join('').toUpperCase() || (title && title[0] ? title[0].toUpperCase() : '?');
  return {
    g1: `oklch(${0.72 + (h % 40) / 100} 0.09 ${h})`,
    g2: `oklch(${0.5 + (h % 25) / 100} 0.12 ${(h + 45) % 360})`,
    initials,
  };
}

export const BookCard: React.FC<BookCardProps> = ({ book, modeIndex = 0, onClick }) => {
  const fb = getBookFallback(book.title);
  let h = 86 + (hashHue(book.title || '') % 54);
  const cls = ['', 'lean', '', '', 'leanl', 'short'][modeIndex % 6];
  if (modeIndex % 6 === 5) h = Math.round(h * 0.84);
  const w = Math.max(40, Math.round((h * 2) / 3));
  const tip = `${book.title || 'Sem título'}${book.author ? ' · ' + book.author : ''}`;

  return (
    <div
      className={`book-card ${cls}`}
      data-id={book.id}
      style={{ '--w': `${w}px`, '--h': `${h}px` } as React.CSSProperties}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(e as any);
        }
      }}
      aria-label={tip}
    >
      <div
        className="cover-wrap"
        style={{ '--g1': fb.g1, '--g2': fb.g2 } as React.CSSProperties}
        title={tip}
      >
        <div className="fallback">{fb.initials}</div>
        {book.cover ? (
          <img
            loading="lazy"
            src={book.cover}
            alt={book.title}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : null}
      </div>
    </div>
  );
};
