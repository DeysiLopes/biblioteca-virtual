import { describe, it, expect } from 'vitest';
import { getDashboardEntries, calculateStreak } from '../core/business/dashboard';
import { Book } from '../core/models/book';
import { DiaryEntry } from '../core/models/diary';

describe('Regras de Negócio — Dashboard e Diário', () => {
  it('dashboardEntries limita a contribuição ao progresso atual do livro', () => {
    const book: Book = {
      id: 'b1',
      title: 'O Hobbit',
      author: 'J.R.R. Tolkien',
      status: 'Lendo',
      paginas: 300,
      paginasLidas: 30, // Progresso atual é 30
      readingEpoch: 100,
    };

    // Sessões antigas somam 50 páginas
    const diary: DiaryEntry[] = [
      { id: 'd1', bookId: 'b1', date: '2026-10-12', pages: 20, ts: 200, readingEpoch: 100 },
      { id: 'd2', bookId: 'b1', date: '2026-10-11', pages: 30, ts: 150, readingEpoch: 100 },
    ];

    const entries = getDashboardEntries([book], diary);
    const totalContributed = entries.reduce((s, e) => s + e.pages, 0);

    // Deve limitar exatamente a 30 páginas!
    expect(totalContributed).toBe(30);
  });

  it('Livro com 0 páginas lidas NÃO contribui com nenhuma página para o dashboard', () => {
    const book: Book = {
      id: 'b1',
      title: 'Livro Zerado',
      author: 'Autor',
      status: 'Quero ler',
      paginas: 300,
      paginasLidas: 0, // Zerado!
      readingEpoch: 200,
    };

    const diary: DiaryEntry[] = [
      { id: 'd1', bookId: 'b1', date: '2026-10-12', pages: 20, ts: 100, readingEpoch: 200 },
    ];

    const entries = getDashboardEntries([book], diary);
    expect(entries.length).toBe(0);
  });

  it('Sessões com readingEpoch diferente do livro atual são descartadas', () => {
    const book: Book = {
      id: 'b1',
      title: 'Livro Reiniciado',
      author: 'Autor',
      status: 'Lendo',
      paginas: 300,
      paginasLidas: 10,
      readingEpoch: 500, // Novo epoch
    };

    const diary: DiaryEntry[] = [
      { id: 'd1', bookId: 'b1', date: '2026-10-10', pages: 100, ts: 100, readingEpoch: 200 }, // Epoch antigo!
    ];

    const entries = getDashboardEntries([book], diary);
    expect(entries.length).toBe(0);
  });

  it('Calcula sequência de leitura (streak) consecutiva', () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);

    const entries: DiaryEntry[] = [
      { id: '1', bookId: 'b', date: today, pages: 10, ts: 2 },
      { id: '2', bookId: 'b', date: yesterday, pages: 15, ts: 1 },
    ];

    expect(calculateStreak(entries)).toBe(2);
  });
});
