import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BookCard } from '../components/book/BookCard';
import { BookModal } from '../components/book/BookModal';
import { StatsSummary } from '../components/diary/StatsSummary';
import { WeeklyChart } from '../components/diary/WeeklyChart';
import { Book } from '../core/models/book';

describe('Componentes React da Biblioteca', () => {
  const sampleBook: Book = {
    id: 'b1',
    title: 'Ensaio sobre a Cegueira',
    author: 'José Saramago',
    status: 'Lendo',
    paginas: 310,
    paginasLidas: 100,
  };

  it('BookCard renderiza título e iniciais na capa fallback', () => {
    render(<BookCard book={sampleBook} />);
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Ensaio sobre a Cegueira · José Saramago'
    );
    expect(screen.getByText('ES')).toBeInTheDocument();
  });

  it('BookModal renderiza campos, percentual e permite editar', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();
    const handleSelect = vi.fn();

    render(
      <BookModal
        book={sampleBook}
        allBooks={[sampleBook]}
        isOpen={true}
        onClose={handleClose}
        onSave={handleSave}
        onSelectBook={handleSelect}
      />
    );

    expect(screen.getByText('Ensaio sobre a Cegueira')).toBeInTheDocument();
    expect(screen.getByText('32%')).toBeInTheDocument(); // 100 / 310 = 32%

    const inputLidas = screen.getByLabelText(/Páginas lidas/i) as HTMLInputElement;
    expect(inputLidas.value).toBe('100');

    // Altera para 150 e clica em salvar
    await React.act(async () => {
      fireEvent.change(inputLidas, { target: { value: '150' } });
      fireEvent.click(screen.getByRole('button', { name: /Salvar/i }));
    });

    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('BookModal renderiza 5 estrelas e persiste a nota ao salvar', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);

    render(
      <BookModal
        book={sampleBook}
        allBooks={[sampleBook]}
        isOpen={true}
        onClose={vi.fn()}
        onSave={handleSave}
        onSelectBook={vi.fn()}
      />
    );

    const stars = screen.getAllByRole('radio');
    expect(stars).toHaveLength(5);

    fireEvent.click(stars[3]); // 4ª estrela
    expect(stars[0]).toHaveClass('on');
    expect(stars[3]).toHaveClass('on');
    expect(stars[4]).not.toHaveClass('on');

    await React.act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Salvar/i }));
    });

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b1', nota: 4 }),
      undefined
    );
  });

  it('BookModal mostra capa do livro e fallback com iniciais', () => {
    const comCapa: Book = { ...sampleBook, cover: 'https://example.com/capa.jpg' };
    const { container, unmount } = render(
      <BookModal
        book={comCapa}
        allBooks={[comCapa]}
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onSelectBook={vi.fn()}
      />
    );
    const img = container.querySelector('.fly-cover img') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe('https://example.com/capa.jpg');
    unmount();

    const { container: sem } = render(
      <BookModal
        book={sampleBook}
        allBooks={[sampleBook]}
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onSelectBook={vi.fn()}
      />
    );
    expect(sem.querySelector('.fly-cover img')).not.toBeInTheDocument();
    expect(sem.querySelector('.fly-cover .fallback')).toHaveTextContent('ES');
  });

  it('StatsSummary exibe 4 métricas corretamente', () => {
    const summary = {
      hoje: 42,
      streak: 5,
      totalLido: 1200,
      totalRegistros: 28,
      entries: [],
      week: [],
    };

    render(<StatsSummary summary={summary} />);
    expect(screen.getByText('42 pág')).toBeInTheDocument();
    expect(screen.getByText('5 dias')).toBeInTheDocument();
    expect(screen.getByText('1200 pág')).toBeInTheDocument();
    expect(screen.getByText('28')).toBeInTheDocument();
  });

  it('WeeklyChart renderiza barras dos 7 dias com dia atual', () => {
    const week = [
      { date: '2026-10-06', pages: 10, label: 'T', isToday: false, barHeight: 20 },
      { date: '2026-10-07', pages: 15, label: 'Q', isToday: false, barHeight: 30 },
      { date: '2026-10-08', pages: 0, label: 'Q', isToday: false, barHeight: 4 },
      { date: '2026-10-09', pages: 25, label: 'S', isToday: false, barHeight: 50 },
      { date: '2026-10-10', pages: 30, label: 'S', isToday: false, barHeight: 60 },
      { date: '2026-10-11', pages: 12, label: 'D', isToday: false, barHeight: 24 },
      { date: '2026-10-12', pages: 42, label: 'S', isToday: true, barHeight: 76 },
    ];

    const { container } = render(<WeeklyChart days={week} />);
    expect(container.querySelectorAll('.wcol').length).toBe(7);
    expect(container.querySelector('.wcol.today')).toBeInTheDocument();
  });
});
