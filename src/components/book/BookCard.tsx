import React, { useState } from 'react';
import { Book } from '../../core/models/book';
import { useBookCoverUrl } from '../../hooks/useBookCoverUrl';
import { normalizeString } from '../../core/business/csv-parser';

interface BookCardProps {
  book: Book;
  modeIndex?: number;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
}

export function hashHue(s: string): number {
  let h = 0;
  for (const c of String(s)) {
    h = (h * 31 + c.charCodeAt(0)) % 360;
  }
  return h;
}

// Lombadas de couro inspiradas nas referências visuais (vinho, ameixa,
// floresta, conhaque) — determinística pelo título do livro
const SPINE_PALETTES: [string, string][] = [
  ['#7c3143', '#4e1a27'], // vinho
  ['#4d3a6b', '#2e2046'], // ameixa
  ['#2f4d3d', '#1b3127'], // verde floresta
  ['#2e4160', '#1c2a44'], // azul noite
  ['#704e29', '#483017'], // conhaque
  ['#5f2f52', '#3c1d33'], // berinjela
  ['#234e52', '#153336'], // petróleo
  ['#7f3f30', '#54271c'], // ferrugem
];

export function getBookFallback(title: string) {
  const h = hashHue(title);
  const words = normalizeString(title).split(' ').filter(Boolean).slice(0, 2);
  const initials = words.map(w => w[0] || '').join('').toUpperCase() || (title && title[0] ? title[0].toUpperCase() : '?');
  const [g1, g2] = SPINE_PALETTES[h % SPINE_PALETTES.length];
  return { g1, g2, initials };
}

export function getBookCover(book: Book): string {
  if (book.cover) return book.cover;
  if (book.codigo_isbn) {
    return `https://covers.openlibrary.org/b/isbn/${book.codigo_isbn}-L.jpg`;
  }
  return '';
}

// A Open Library devolve um GIF 1x1 quando não há capa — esconde
// imagens minúsculas para o fallback colorido aparecer no lugar
export function hideTinyCover(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.naturalWidth > 0 && img.naturalWidth <= 4) {
    img.style.display = 'none';
  }
}

export const BookCard: React.FC<BookCardProps> = ({ book, modeIndex = 0, onClick, draggable, onDragStart, onDragEnd }) => {
  const coverUrl = useBookCoverUrl(book);
  const fb = getBookFallback(book.title);
  const [dragging, setDragging] = useState(false);
  let h = 86 + (hashHue(book.title || '') % 54);
  const cls = ['', 'lean', '', '', 'leanl', 'short'][modeIndex % 6];
  if (modeIndex % 6 === 5) h = Math.round(h * 0.84);
  const w = Math.max(40, Math.round((h * 2) / 3));
  const tip = `${book.title || 'Sem título'}${book.author ? ' · ' + book.author : ''}`;

  return (
    <div
      className={`book-card ${cls}${dragging ? ' dragging' : ''}`}
      draggable={draggable}
      onDragStart={(e) => {
        setDragging(true);
        onDragStart?.(e);
      }}
      onDragEnd={(e) => {
        setDragging(false);
        onDragEnd?.(e);
      }}
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
        {coverUrl ? (
          <img
            loading="lazy"
            src={coverUrl}
            alt={book.title}
            onLoad={hideTinyCover}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : null}
      </div>
    </div>
  );
};
