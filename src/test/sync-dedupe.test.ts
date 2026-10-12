import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncManager } from '../core/storage/sync-manager';
import { driveService } from '../core/storage/drive';
import {
  putBooksBatch,
  putDiaryBatch,
  getAllBooks,
  getAllDiary,
  getMetaValue,
  clearStore,
} from '../core/storage/idb';
import { Book } from '../core/models/book';

vi.mock('../core/auth/google-auth', () => ({
  authService: {
    getAuthState: vi.fn(() => ({
      isAuthenticated: true,
      user: { id: 'user-1', name: 'Teste' },
    })),
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock('../core/storage/drive', () => ({
  driveService: {
    downloadLibrary: vi.fn(),
    uploadLibrary: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockDownload = vi.mocked(driveService.downloadLibrary);

const local = (over: Partial<Book>): Book => ({
  id: 'local-x',
  title: 'Livro',
  author: 'Autor',
  status: 'Lendo',
  updatedAt: 100,
  ...over,
});

beforeEach(async () => {
  vi.clearAllMocks();
  await Promise.all([clearStore('books'), clearStore('diary'), clearStore('meta')]);
});

describe('Sync — deduplicação local × Drive', () => {
  it('mesmo livro com IDs diferentes (título+autor) vira um só — fica o ID do Drive e o diário é remapeado', async () => {
    await putBooksBatch([
      local({ id: 'local-1', title: 'Dom Casmurro', author: 'Machado de Assis', resenha: 'ótimo', paginasLidas: 256 }),
    ]);
    await putDiaryBatch([{ id: 'd1', bookId: 'local-1', date: '2024-01-01', pages: 10, ts: 1 }]);
    await syncManager.initialize();

    mockDownload.mockResolvedValue({
      books: [
        { id: 'remote-9', title: 'dom casmurro', author: 'machado de assis', status: 'Lido', codigo_isbn: '9788500', updatedAt: 200 },
      ],
      diary: [],
    } as any);

    await syncManager.pullFromDriveQuietly();

    const books = syncManager.getBooks();
    expect(books).toHaveLength(1);
    expect(books[0].id).toBe('remote-9');
    // campo que o remoto não tem herda do local
    expect(books[0].resenha).toBe('ótimo');
    expect(books[0].paginasLidas).toBe(256);

    // diário local aponta para o ID canônico do Drive
    expect(syncManager.getDiary()[0].bookId).toBe('remote-9');

    // o registro local antigo sai do IndexedDB (não ressurge no próximo load)
    expect((await getAllBooks()).map((b) => b.id)).toEqual(['remote-9']);
  });

  it('deduplica por ISBN mesmo com títulos diferentes', async () => {
    await putBooksBatch([
      local({ id: 'l-isbn', title: 'Game of Love', codigo_isbn: '9781234567', updatedAt: 1 }),
    ]);
    await syncManager.initialize();

    mockDownload.mockResolvedValue({
      books: [
        { id: 'r-isbn', title: 'A Game of Love and Betrayal', codigo_isbn: '9781234567', status: 'Lido', updatedAt: 2 },
      ],
      diary: [],
    } as any);

    await syncManager.pullFromDriveQuietly();
    const books = syncManager.getBooks();
    expect(books).toHaveLength(1);
    expect(books[0].id).toBe('r-isbn');
  });

  it('local mais novo vence nos campos, mas o ID canônico do Drive é mantido', async () => {
    await putBooksBatch([
      local({ id: 'l-novo', title: 'Memórias Póstumas', author: 'Machado', paginasLidas: 300, updatedAt: 999 }),
    ]);
    await syncManager.initialize();

    mockDownload.mockResolvedValue({
      books: [
        { id: 'r-velho', title: 'Memórias Póstumas', author: 'Machado', paginasLidas: 10, cover: 'http://x/c.jpg', updatedAt: 100 },
      ],
      diary: [],
    } as any);

    await syncManager.pullFromDriveQuietly();
    const books = syncManager.getBooks();
    expect(books).toHaveLength(1);
    expect(books[0].id).toBe('r-velho');
    expect(books[0].paginasLidas).toBe(300); // local mais novo vence
    expect(books[0].cover).toBe('http://x/c.jpg'); // campo só do remoto herda
  });

  it('livros distintos dos dois lados permanecem', async () => {
    await putBooksBatch([
      local({ id: 'l1', title: 'Livro A', author: 'X' }),
      local({ id: 'l2', title: 'Livro B', author: 'Y' }),
    ]);
    await syncManager.initialize();

    mockDownload.mockResolvedValue({
      books: [
        { id: 'r1', title: 'Livro A', author: 'X', updatedAt: 500 }, // duplicata do l1
        { id: 'r2', title: 'Livro C', author: 'Z', updatedAt: 500 },
      ],
      diary: [],
    } as any);

    await syncManager.pullFromDriveQuietly();
    const titles = syncManager.getBooks().map((b) => b.title).sort();
    expect(titles).toEqual(['Livro A', 'Livro B', 'Livro C']);
  });
});

describe('Sync — limpar dados locais', () => {
  it('resetLocalData apaga livros, diário e marca localWiped (semente não volta)', async () => {
    await putBooksBatch([local({ id: 'x1' })]);
    await putDiaryBatch([{ id: 'd1', bookId: 'x1', date: '2024-01-01', pages: 5, ts: 1 }]);
    await syncManager.initialize();
    expect(syncManager.getBooks().length).toBeGreaterThan(0);

    await syncManager.resetLocalData();

    expect(syncManager.getBooks()).toHaveLength(0);
    expect(syncManager.getDiary()).toHaveLength(0);
    expect(await getAllBooks()).toHaveLength(0);
    expect(await getAllDiary()).toHaveLength(0);
    expect(await getMetaValue('localWiped')).toBe(true);
  });
});
