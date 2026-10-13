import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  dayKey,
  getAllQuotes,
  getQuoteOfTheDay,
  maybeNotifyQuoteOfDay,
  setQuoteReminder,
} from '../core/business/quote-of-day';
import { clearStore, getMetaValue } from '../core/storage/idb';
import { Book } from '../core/models/book';

const book = (id: string, citacoes: any[] = [], deletedCitacoes: any[] = []): Book => ({
  id,
  title: `Livro ${id}`,
  author: `Autor ${id}`,
  status: 'Lido',
  citacoes,
  deletedCitacoes,
});

const q = (id: string, ts = 100) => ({ id, text: `frase ${id}`, page: 10, ts });

beforeEach(async () => {
  vi.restoreAllMocks();
  await clearStore('meta');
});

describe('getAllQuotes', () => {
  it('junta citações de todos os livros e ignora tombstones', () => {
    const books = [
      book('a', [q('a1'), q('a2')], [{ id: 'a2', ts: 200 }]),
      book('b', [q('b1')]),
      book('c'),
    ];
    const ids = getAllQuotes(books).map((x) => x.quote.id);
    expect(ids).toEqual(['a1', 'b1']); // a2 tombstoned, livro c sem citações
  });
});

describe('getQuoteOfTheDay', () => {
  const books = [book('a', [q('a1'), q('a2')]), book('b', [q('b1')])];

  it('é determinística: a mesma data devolve a mesma citação', () => {
    const d = new Date(2026, 9, 13);
    expect(getQuoteOfTheDay(books, d)?.quote.id).toBe(
      getQuoteOfTheDay(books, d)?.quote.id
    );
  });

  it('carrega o livro junto para a atribuição', () => {
    const qod = getQuoteOfTheDay(books, new Date());
    expect(qod?.book.title).toMatch(/^Livro /);
  });

  it('devolve null sem citações salvas', () => {
    expect(getQuoteOfTheDay([book('x')])).toBeNull();
    expect(getQuoteOfTheDay([])).toBeNull();
  });

  it('nunca escolhe citação excluída', () => {
    const only = [book('x', [q('gone')], [{ id: 'gone', ts: 999 }])];
    expect(getQuoteOfTheDay(only)).toBeNull();
  });
});

describe('maybeNotifyQuoteOfDay', () => {
  const books = [book('a', [q('a1')])];

  it('notifica uma vez por dia quando lembrete está ativo', async () => {
    await setQuoteReminder(true);
    const spy = vi.fn();
    vi.stubGlobal('Notification', {
      permission: 'granted',
      // ctor spy
      ...(function () {}) as any,
    });
    (window as any).Notification = vi.fn(function (this: any) { spy(); }) as any;
    (window as any).Notification.permission = 'granted';
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });

    await maybeNotifyQuoteOfDay(books);
    expect(spy).toHaveBeenCalledTimes(1);

    await maybeNotifyQuoteOfDay(books); // mesmo dia — não repete
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await getMetaValue('quoteNotifDate')).toBe(dayKey());
  });

  it('não notifica sem lembrete ativo ou sem permissão', async () => {
    const ctor = vi.fn();
    (window as any).Notification = ctor as any;
    (window as any).Notification.permission = 'granted';
    await maybeNotifyQuoteOfDay(books); // reminder off
    expect(ctor).not.toHaveBeenCalled();

    await setQuoteReminder(true);
    (window as any).Notification.permission = 'denied';
    await maybeNotifyQuoteOfDay(books);
    expect(ctor).not.toHaveBeenCalled();
  });
});
