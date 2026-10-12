import React, { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DiaryPage } from '../pages/DiaryPage';
import { useLibrary } from '../hooks/useLibrary';
import { Book } from '../core/models/book';

vi.mock('../hooks/useLibrary', () => ({
  useLibrary: vi.fn(),
}));

const mockedUseLibrary = vi.mocked(useLibrary);

const book: Book = {
  id: 'book-1',
  title: 'Livro de teste',
  author: 'Autora',
  status: 'Lendo',
  paginas: 200,
  paginasLidas: 20,
  resenha: '',
};

function setup(saveBook = vi.fn().mockResolvedValue(undefined)) {
  mockedUseLibrary.mockReturnValue({
    books: [book],
    diary: [],
    loading: false,
    summary: { hoje: 0, streak: 0, totalLido: 20, totalRegistros: 1, entries: [], week: [] },
    saveBook,
    saveBatch: vi.fn(),
    removeBook: vi.fn(),
    exportBackup: vi.fn(),
    refreshData: vi.fn(),
  } as ReturnType<typeof useLibrary>);
  return { saveBook };
}

async function openNotebook() {
  await act(async () => {
    fireEvent.click(screen.getByTitle('Virar o livro em 3D'));
  });
  const flipview = document.querySelector('#flipview');
  expect(flipview).toBeInTheDocument();
  const editButton = await screen.findByRole('button', { name: /Escrever resenha/i });
  await waitFor(() => expect(editButton).toBeEnabled(), { timeout: 2000 });
  await act(async () => {
    fireEvent.click(editButton);
  });
  return screen.findByRole('textbox');
}

describe('Diário — fluxo de resenha (MVP 1)', () => {
  it('volta à contracapa após salvar e só volta ao diário ao fechar', async () => {
    const { saveBook } = setup();
    render(<DiaryPage />);

    const textArea = await openNotebook();
    // A capa encaixa acima da folha do caderno, como no MVP 1
    expect(document.querySelector('.cad-cover')).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(textArea, { target: { value: 'Uma resenha.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    });

    await waitFor(() => {
      expect(saveBook).toHaveBeenCalledWith(expect.objectContaining({ resenha: 'Uma resenha.' }));
      expect(document.querySelector('#caderno')).not.toBeInTheDocument();
      // Volta para a contracapa, não para o diário
      expect(document.querySelector('#flipview')).toBeInTheDocument();
    });
    expect(document.querySelector('#flipview .rv')).toHaveTextContent('Uma resenha.');

    // Só o "Fechar" da contracapa volta ao diário
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Fechar contracapa e voltar ao diário'));
    });
    await waitFor(() => {
      expect(document.querySelector('#flipview')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Livro de teste')).toBeInTheDocument();
  });

  it('a capa do cartão contém o fallback absoluto (regressão: capa gigante)', async () => {
    setup();
    render(<DiaryPage />);

    const wrap = document.querySelector<HTMLElement>('.nbook .cover-wrap');
    const fallback = document.querySelector<HTMLElement>('.nbook .fallback');
    expect(wrap).toBeInTheDocument();
    expect(fallback).toBeInTheDocument();
    // O .fallback global é position:absolute;inset:0 — sem um ancestral
    // posicionado ele escapa e cobre a viewport inteira (capa gigante)
    expect(wrap!.style.position).toBe('relative');
    expect(wrap!.style.overflow).toBe('hidden');
    expect(fallback!.closest('.cover-wrap')).toBe(wrap);
  });

  it('fechar a folha sem salvar também retorna à contracapa', async () => {
    setup();
    render(<DiaryPage />);

    await openNotebook();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    });

    await waitFor(() => {
      expect(document.querySelector('#caderno')).not.toBeInTheDocument();
      expect(document.querySelector('#flipview')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Escrever resenha/i })).toBeInTheDocument();
  });
});
