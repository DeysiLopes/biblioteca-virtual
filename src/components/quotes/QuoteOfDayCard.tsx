import React, { useMemo } from 'react';
import { Book } from '../../core/models/book';
import { getQuoteOfTheDay } from '../../core/business/quote-of-day';

interface QuoteOfDayCardProps {
  books: Book[];
  onOpenBook?: (book: Book, rect: DOMRect | null) => void;
}

/**
 * Cartão "Citação do dia" — a frase é derivada das citações salvas,
 * determinística por data (a mesma em todos os aparelhos no mesmo dia)
 * e 100% local/offline.
 */
export const QuoteOfDayCard: React.FC<QuoteOfDayCardProps> = ({
  books,
  onOpenBook,
}) => {
  const qod = useMemo(() => getQuoteOfTheDay(books), [books]);
  if (!qod) return null;

  const { quote, book } = qod;
  return (
    <section
      className="quote-of-day"
      aria-label="Citação do dia"
      role={onOpenBook ? 'button' : undefined}
      tabIndex={onOpenBook ? 0 : undefined}
      onClick={(e) => onOpenBook?.(book, e.currentTarget.getBoundingClientRect())}
      onKeyDown={(e) =>
        e.key === 'Enter' &&
        onOpenBook?.(book, e.currentTarget.getBoundingClientRect())
      }
    >
      <span className="qod-star">✨</span>
      <blockquote className="qod-text">“{quote.text}”</blockquote>
      <p className="qod-cite">
        — {book.title}
        {book.author ? `, ${book.author}` : ''}
        {quote.page ? ` · p. ${quote.page}` : ''}
      </p>
    </section>
  );
};
