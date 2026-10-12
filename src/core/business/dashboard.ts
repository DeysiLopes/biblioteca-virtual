import { Book } from '../models/book';
import { DiaryEntry } from '../models/diary';
import { getTodayDateString } from './progress';

export interface DayStat {
  date: string;       // YYYY-MM-DD
  pages: number;
  label: string;      // S, T, Q, Q, S, S, D
  isToday: boolean;
  barHeight: number;  // px height relative to max (max ~76px)
}

export interface DashboardSummary {
  hoje: number;
  streak: number;
  totalLido: number;
  totalRegistros: number;
  entries: DiaryEntry[];
  week: DayStat[];
}

export function getBookPagesRead(b: Book): number {
  return Math.max(0, b.paginasLidas || 0);
}

/**
 * Filtra e ajusta as entradas do diário conforme o progresso atual do livro e o readingEpoch.
 * Regras:
 * - O livro com 0 páginas lidas não contribui com nenhuma página.
 * - Limita as entradas ao saldo real do livro (budget).
 * - Desconsidera entradas de epochs anteriores à reinicialização do livro.
 */
export function getDashboardEntries(books: Book[], diary: DiaryEntry[]): DiaryEntry[] {
  const budgets = new Map<string, { pages: number; epoch: number }>(
    books.map(b => [b.id, { pages: getBookPagesRead(b), epoch: +(b.readingEpoch || 0) }])
  );

  return diary
    .slice()
    .sort((a, b) => (+b.ts || 0) - (+a.ts || 0) || String(b.id).localeCompare(String(a.id)))
    .flatMap(d => {
      const budget = budgets.get(d.bookId);
      if (!budget || budget.pages <= 0 || budget.epoch !== (+(d.readingEpoch ?? 0))) {
        return [];
      }
      const pages = Math.min(budget.pages, Math.max(0, +d.pages || 0));
      if (!pages) return [];
      budget.pages -= pages;
      return [{ ...d, pages }];
    });
}

/**
 * Calcula a sequência de dias consecutivos de leitura (streak).
 * Se hoje ainda não teve leitura, verifica se ontem teve para não zerar a sequência precocemente.
 */
export function calculateStreak(entries: DiaryEntry[]): number {
  let count = 0;
  const dates = new Set(entries.map(d => d.date));
  const today = getTodayDateString();
  const cursor = new Date();

  if (dates.has(today)) {
    while (dates.has(cursor.toISOString().slice(0, 10))) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
  } else {
    cursor.setDate(cursor.getDate() - 1);
    if (dates.has(cursor.toISOString().slice(0, 10))) {
      while (dates.has(cursor.toISOString().slice(0, 10))) {
        count++;
        cursor.setDate(cursor.getDate() - 1);
      }
    }
  }

  return count;
}

/**
 * Calcula os dados do gráfico dos últimos 7 dias.
 */
export function calculateWeeklyChart(entries: DiaryEntry[]): DayStat[] {
  const byDate: Record<string, number> = {};
  entries.forEach(d => {
    byDate[d.date] = (byDate[d.date] || 0) + (+d.pages || 0);
  });

  const maxPages = Math.max(1, ...Object.values(byDate));
  const days: DayStat[] = [];
  const today = getTodayDateString();

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const pages = byDate[iso] || 0;
    const barHeight = Math.max(4, Math.round((pages / maxPages) * 76));
    const label = d
      .toLocaleDateString('pt-BR', { weekday: 'short' })
      .replace('.', '')
      .slice(0, 1)
      .toUpperCase();

    days.push({
      date: iso,
      pages,
      label,
      isToday: iso === today,
      barHeight,
    });
  }

  return days;
}

/**
 * Monta o resumo completo do Dashboard.
 */
export function computeDashboardSummary(books: Book[], diary: DiaryEntry[]): DashboardSummary {
  const entries = getDashboardEntries(books, diary);
  const today = getTodayDateString();
  const hoje = entries
    .filter(d => d.date === today)
    .reduce((acc, d) => acc + (+d.pages || 0), 0);
  const streak = calculateStreak(entries);
  const totalLido = books.reduce((acc, b) => acc + getBookPagesRead(b), 0);

  return {
    hoje,
    streak,
    totalLido,
    totalRegistros: entries.length,
    entries,
    week: calculateWeeklyChart(entries),
  };
}
