import { describe, it, expect } from 'vitest';
import { sortQueue, topQueuePosition } from '../core/business/queue';
import { applyBookProgressUpdate } from '../core/business/progress';
import { Book } from '../core/models/book';

const book = (over: Partial<Book>): Book => ({
  id: 'b',
  title: 'Livro',
  author: 'Autor',
  status: 'Quero ler',
  ...over,
});

describe('sortQueue — ordem da fila "Quero ler"', () => {
  it('livro com filaPosicao menor vem primeiro; sem posição vai para o fim', () => {
    const sorted = sortQueue([
      book({ id: 'sem-pos' }),
      book({ id: 'topo', filaPosicao: -2 }),
      book({ id: 'meio', filaPosicao: 1 }),
    ]);
    expect(sorted.map((b) => b.id)).toEqual(['topo', 'meio', 'sem-pos']);
  });

  it('mantém a ordem original entre livros sem posição', () => {
    const sorted = sortQueue([
      book({ id: 'a' }),
      book({ id: 'b' }),
      book({ id: 'c' }),
    ]);
    expect(sorted.map((b) => b.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('topQueuePosition', () => {
  it('fila vazia começa em -1', () => {
    expect(topQueuePosition([])).toBe(-1);
  });

  it('fica abaixo do menor valor existente', () => {
    expect(
      topQueuePosition([
        book({ filaPosicao: 3 }),
        book({ filaPosicao: -4 }),
      ])
    ).toBe(-5);
  });

  it('ignora livros de outros status', () => {
    expect(
      topQueuePosition([
        book({ status: 'Lendo', filaPosicao: -10 }),
        book({ filaPosicao: 2 }),
      ])
    ).toBe(1);
  });
});

describe('Drop — semântica de transição preservada', () => {
  it('livro completo arrastado para "Lendo" permanece "Lido" (drop vira no-op)', () => {
    const lido = book({
      status: 'Lido',
      paginas: 300,
      paginasLidas: 300,
    });
    const { updatedBook } = applyBookProgressUpdate(lido, 300, undefined, 'Lendo');
    expect(updatedBook.status).toBe('Lido');
  });

  it('quero ler → lendo mantém o progresso e não cria diário', () => {
    const quero = book({ paginas: 200, paginasLidas: 30 });
    const { updatedBook, newDiaryEntry } = applyBookProgressUpdate(
      quero,
      30,
      undefined,
      'Lendo'
    );
    expect(updatedBook.status).toBe('Lendo');
    expect(updatedBook.paginasLidas).toBe(30);
    expect(newDiaryEntry).toBeUndefined();
  });
});
