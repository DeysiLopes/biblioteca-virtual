import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CitacoesModal } from '../components/quotes/CitacoesModal';
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

const bookSorted: Book = {
  ...bookWithQuote,
  citacoes: [
    { id: 'q2', text: 'Citação da página oitenta', page: 80, ts: 2000 },
    { id: 'q1', text: 'Citação da página dez', page: 10, ts: 1000 },
    { id: 'q3', text: 'Citação da página quarenta e dois', page: 42, ts: 3000 },
  ],
};

describe('Citações — nova citação não sobrescreve a existente', () => {
  it('"Nova citação" cria citação nova em vez de reescrever a primeira', async () => {
    const onSaveBook = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <CitacoesModal book={bookWithQuote} isOpen={true} onClose={onClose} onSaveBook={onSaveBook} />
    );

    // A citação existente aparece na página de leitura
    await screen.findByText(/Olhos de ressaca/);

    fireEvent.click(screen.getByRole('button', { name: /Nova citação/i }));
    fireEvent.change(screen.getByPlaceholderText(/Digite o trecho/i), {
      target: { value: 'Segunda citação' },
    });
    fireEvent.change(screen.getByLabelText(/Página da citação/i), {
      target: { value: '77' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Salvar$/i }));

    await waitFor(() => expect(onSaveBook).toHaveBeenCalledTimes(1));
    const saved = onSaveBook.mock.calls[0][0] as Book;

    // Duas citações: a original intacta + a nova criada
    expect(saved.citacoes).toHaveLength(2);
    expect(saved.citacoes?.[0]).toMatchObject({ id: 'q1', text: 'Olhos de ressaca', page: 123 });
    expect(saved.citacoes?.[1]).toMatchObject({ text: 'Segunda citação', page: 77 });
    expect(saved.citacoes?.[1].id).not.toBe('q1');
  });

  it('editar uma citação existente continua preservando id e ts', async () => {
    const onSaveBook = vi.fn().mockResolvedValue(undefined);

    render(
      <CitacoesModal book={bookWithQuote} isOpen={true} onClose={vi.fn()} onSaveBook={onSaveBook} />
    );

    await screen.findByText(/Olhos de ressaca/);
    fireEvent.click(screen.getByRole('button', { name: /Editar citação/i }));
    fireEvent.change(screen.getByPlaceholderText(/Digite o trecho/i), {
      target: { value: 'Texto corrigido' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Salvar$/i }));

    await waitFor(() => expect(onSaveBook).toHaveBeenCalledTimes(1));
    const saved = onSaveBook.mock.calls[0][0] as Book;

    expect(saved.citacoes).toHaveLength(1);
    expect(saved.citacoes?.[0]).toMatchObject({ id: 'q1', text: 'Texto corrigido', page: 123, ts: 1000 });
  });
});

describe('Citações — navegação ordenada por página', () => {
  it('exibe as citações em ordem crescente de página e navega com as setas', async () => {
    render(
      <CitacoesModal book={bookSorted} isOpen={true} onClose={vi.fn()} onSaveBook={vi.fn()} />
    );

    // A primeira exibida é a de menor página (10), não a primeira do array
    expect(await screen.findByText(/Citação da página dez/)).toBeInTheDocument();
    expect(screen.getByText('pág. 10')).toBeInTheDocument();
    expect(screen.getByText('1 de 3')).toBeInTheDocument();

    // Voltar está desabilitada na primeira; avançar leva à pág. 42
    expect(screen.getByRole('button', { name: 'Citação anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima citação' }));
    expect(await screen.findByText(/Citação da página quarenta e dois/)).toBeInTheDocument();
    expect(screen.getByText('2 de 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Próxima citação' }));
    expect(await screen.findByText(/Citação da página oitenta/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próxima citação' })).toBeDisabled();

    // Voltar mostra a página deslizando para a direita (direção inversa)
    fireEvent.click(screen.getByRole('button', { name: 'Citação anterior' }));
    expect(await screen.findByText(/Citação da página quarenta e dois/)).toBeInTheDocument();
    expect(screen.getByText('2 de 3')).toBeInTheDocument();
  });
});
