import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FicharioModal } from '../components/quotes/FicharioModal';
import { Book } from '../core/models/book';

const bookWithQuote: Book = {
  id: 'b1',
  title: 'Capitu',
  author: 'Machado de Assis',
  status: 'Lendo',
  citacoes: [
    { id: 'q1', text: 'Olhos de ressaca', page: 123, ts: 1000, updatedAt: 1000 },
  ],
  deletedCitacoes: [],
};

describe('Fichário — nova ficha não sobrescreve a existente', () => {
  it('"Nova ficha" cria citação nova em vez de reescrever a primeira', async () => {
    const onSaveBook = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <FicharioModal book={bookWithQuote} isOpen={true} onClose={onClose} onSaveBook={onSaveBook} />
    );

    // A ficha existente aparece selecionada
    await screen.findByText(/Olhos de ressaca/);

    fireEvent.click(screen.getByRole('button', { name: /Nova ficha/i }));
    fireEvent.change(screen.getByPlaceholderText(/Digite o trecho/i), {
      target: { value: 'Segunda citação' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Ex: 42/i), {
      target: { value: '77' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Ficha/i }));

    await waitFor(() => expect(onSaveBook).toHaveBeenCalledTimes(1));
    const saved = onSaveBook.mock.calls[0][0] as Book;

    // Duas fichas: a original intacta + a nova criada
    expect(saved.citacoes).toHaveLength(2);
    expect(saved.citacoes?.[0]).toMatchObject({ id: 'q1', text: 'Olhos de ressaca', page: 123 });
    expect(saved.citacoes?.[1]).toMatchObject({ text: 'Segunda citação', page: 77 });
    expect(saved.citacoes?.[1].id).not.toBe('q1');
  });

  it('editar uma ficha existente continua preservando id e ts', async () => {
    const onSaveBook = vi.fn().mockResolvedValue(undefined);

    render(
      <FicharioModal book={bookWithQuote} isOpen={true} onClose={vi.fn()} onSaveBook={onSaveBook} />
    );

    await screen.findByText(/Olhos de ressaca/);
    fireEvent.click(screen.getByRole('button', { name: /✎ Editar/i }));
    fireEvent.change(screen.getByPlaceholderText(/Digite o trecho/i), {
      target: { value: 'Texto corrigido' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Salvar Ficha/i }));

    await waitFor(() => expect(onSaveBook).toHaveBeenCalledTimes(1));
    const saved = onSaveBook.mock.calls[0][0] as Book;

    expect(saved.citacoes).toHaveLength(1);
    expect(saved.citacoes?.[0]).toMatchObject({ id: 'q1', text: 'Texto corrigido', page: 123, ts: 1000 });
  });
});
