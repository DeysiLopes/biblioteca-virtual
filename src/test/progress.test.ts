import { describe, it, expect } from 'vitest';
import { applyBookProgressUpdate, calculatePercentage } from '../core/business/progress';
import { Book } from '../core/models/book';

describe('Regras de Negócio — Progresso e Leitura', () => {
  const sampleBook: Book = {
    id: 'b1',
    title: 'Dom Casmurro',
    author: 'Machado de Assis',
    status: 'Quero ler',
    paginas: 200,
    paginasLidas: 0,
    readingEpoch: 0,
    updatedAt: 1000,
  };

  it('Páginas lidas informa o total já lido: digitar 100 salva exatamente 100, sem somar', () => {
    // 1º registro: leu 50 páginas
    const { updatedBook: b1 } = applyBookProgressUpdate(sampleBook, 50);
    expect(b1.paginasLidas).toBe(50);
    expect(b1.status).toBe('Lendo');

    // 2º registro: usuário digita 100. Deve salvar 100, NUNCA somar (100 + 50 = 150)
    const { updatedBook: b2, newDiaryEntry } = applyBookProgressUpdate(b1, 100);
    expect(b2.paginasLidas).toBe(100);
    expect(newDiaryEntry?.pages).toBe(50); // a diferença gravada no diário é 50
  });

  it('Ao atingir ou ultrapassar o total de páginas, status transita automaticamente para Lido', () => {
    const { updatedBook } = applyBookProgressUpdate(sampleBook, 200);
    expect(updatedBook.status).toBe('Lido');
    expect(updatedBook.fim).toBeDefined();
  });

  it('Ao reduzir páginas lidas abaixo do total em um livro Lido, status volta para Lendo e limpa data de fim', () => {
    const finishedBook: Book = {
      ...sampleBook,
      status: 'Lido',
      paginasLidas: 200,
      fim: '2026-10-10',
    };

    const { updatedBook } = applyBookProgressUpdate(finishedBook, 180);
    expect(updatedBook.status).toBe('Lendo');
    expect(updatedBook.fim).toBeNull();
  });

  it('readingEpoch marca reinícios quando páginas lidas voltam a zero', () => {
    const readingBook: Book = {
      ...sampleBook,
      paginasLidas: 50,
      readingEpoch: 1000,
    };

    const { updatedBook } = applyBookProgressUpdate(readingBook, 0);
    expect(updatedBook.paginasLidas).toBe(0);
    expect(updatedBook.readingEpoch).toBeGreaterThan(1000);
  });

  it('Calcula corretamente o percentual', () => {
    expect(calculatePercentage(50, 200)).toBe(25);
    expect(calculatePercentage(200, 200)).toBe(100);
    expect(calculatePercentage(0, 200)).toBe(0);
    expect(calculatePercentage(10, null)).toBe(0);
  });
});
