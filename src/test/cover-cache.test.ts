import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Book } from '../core/models/book';

const saved: Book[] = [];
let authed = true;

vi.mock('../core/auth/google-auth', () => ({
  authService: {
    getAuthState: vi.fn(() => ({
      isAuthenticated: authed,
      isMock: authed,
      accessToken: authed ? 'mock-token' : undefined,
      user: authed ? { id: 'u1', name: 'Teste' } : undefined,
    })),
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock('../core/storage/sync-manager', () => ({
  syncManager: {
    getBooks: vi.fn(() => saved),
    saveBook: vi.fn(async (b: Book) => {
      const i = saved.findIndex((x) => x.id === b.id);
      if (i >= 0) saved[i] = b;
      else saved.push(b);
    }),
  },
}));

import {
  coverFileName,
  ensureCoverCached,
  resolveCoverUrl,
} from '../core/storage/cover-cache';
import { needsMetadata } from '../core/business/open-library';
import { getCoverBlob, clearStore } from '../core/storage/idb';
import { syncManager } from '../core/storage/sync-manager';

const book = (over: Partial<Book>): Book => ({
  id: 'b1',
  title: 'Livro',
  author: 'Autor',
  status: 'Lendo',
  ...over,
});

// jsdom não implementa createObjectURL — um identificador único basta
let urlSeq = 0;
(URL as any).createObjectURL = vi.fn(() => `blob:mock-${++urlSeq}`);

const bigImage = () =>
  new Response(new Uint8Array(3000), {
    status: 200,
    headers: { 'content-type': 'image/jpeg' },
  });

beforeEach(async () => {
  vi.clearAllMocks();
  authed = true;
  saved.length = 0;
  await clearStore('covers');
});

describe('coverFileName', () => {
  it('usa o ISBN quando existe', () => {
    expect(coverFileName(book({ codigo_isbn: '978-85-01-12345-6' }))).toBe(
      '9788501123456.jpg'
    );
  });

  it('cai para o id do livro sem ISBN', () => {
    expect(coverFileName(book({ id: 'abc-123' }))).toBe('book-abc-123.jpg');
  });
});

describe('needsMetadata', () => {
  it('livro com capa só no Drive (coverFileId) não precisa buscar capa de novo', () => {
    expect(
      needsMetadata(
        book({
          codigo_isbn: '9781234567890',
          coverFileId: 'drv-1',
          paginas: 200,
        })
      )
    ).toBe(false);
  });

  it('sem cover nem coverFileId segue precisando', () => {
    expect(
      needsMetadata(book({ codigo_isbn: '9781234567890', paginas: 200 }))
    ).toBe(true);
  });
});

describe('ensureCoverCached', () => {
  it('baixa a capa remota, guarda no IndexedDB/Drive e grava coverFileId no livro', async () => {
    const fetchMock = vi.fn(async () => bigImage());
    vi.stubGlobal('fetch', fetchMock);

    const b = book({
      codigo_isbn: '9780000000001',
      cover: 'https://covers.openlibrary.org/b/id/1-L.jpg',
    });
    saved.push(b);

    await ensureCoverCached(b);

    expect(fetchMock).toHaveBeenCalledWith(b.cover);
    expect(await getCoverBlob('9780000000001.jpg')).not.toBeNull();
    expect(syncManager.saveBook).toHaveBeenCalled();
    expect(saved[0].coverFileId).toBe('mock-cover-9780000000001.jpg');
  });

  it('não refaz nada quando o livro já tem coverFileId', async () => {
    const fetchMock = vi.fn(async () => bigImage());
    vi.stubGlobal('fetch', fetchMock);

    const b = book({
      codigo_isbn: '9780000000002',
      cover: 'https://x/c.jpg',
      coverFileId: 'drv-ja-tem',
    });
    await ensureCoverCached(b);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(syncManager.saveBook).not.toHaveBeenCalled();
  });

  it('deslogado não sobe nada — só a URL remota renderiza', async () => {
    authed = false;
    const fetchMock = vi.fn(async () => bigImage());
    vi.stubGlobal('fetch', fetchMock);

    await ensureCoverCached(
      book({ codigo_isbn: '9780000000003', cover: 'https://x/c.jpg' })
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getCoverBlob('9780000000003.jpg')).toBeNull();
  });

  it('capa que outro aparelho já subiu não reenvia — só aponta o ID', async () => {
    const b = book({
      codigo_isbn: '9780000000004',
      cover: 'https://x/c.jpg',
    });
    saved.push(b);

    const fetchMock = vi.fn(async () => bigImage());
    vi.stubGlobal('fetch', fetchMock);
    const { driveService } = await import('../core/storage/drive');

    // Simula upload vindo de outro aparelho
    await driveService.uploadCover('9780000000004.jpg', new Blob([new Uint8Array(3000)]));

    const uploadSpy = vi.spyOn(driveService, 'uploadCover');
    await ensureCoverCached(b);

    expect(fetchMock).not.toHaveBeenCalled(); // nem baixou a remota
    expect(uploadSpy).not.toHaveBeenCalled();
    expect(saved[0].coverFileId).toBe('mock-cover-9780000000004.jpg');
  });
});

describe('resolveCoverUrl', () => {
  it('livro com coverFileId baixa do Drive, guarda no IndexedDB e devolve object URL', async () => {
    const { driveService } = await import('../core/storage/drive');
    const blob = new Blob([new Uint8Array(3000)], { type: 'image/jpeg' });
    const fileId = await driveService.uploadCover('9780000000005.jpg', blob);

    const url = await resolveCoverUrl(
      book({ codigo_isbn: '9780000000005', coverFileId: fileId! })
    );

    expect(url).toMatch(/^blob:mock-/);
    expect(await getCoverBlob('9780000000005.jpg')).not.toBeNull();
  });

  it('sem nada cacheado devolve a URL remota pra renderizar direto', async () => {
    const url = await resolveCoverUrl(
      book({ codigo_isbn: '9780000000006', cover: 'https://x/capa.jpg' })
    );
    expect(url).toBe('https://x/capa.jpg');
  });

  it('deslogado com coverFileId cai para a URL remota', async () => {
    authed = false;
    const url = await resolveCoverUrl(
      book({
        codigo_isbn: '9780000000007',
        coverFileId: 'drv-1',
        cover: 'https://x/offline.jpg',
      })
    );
    expect(url).toBe('https://x/offline.jpg');
  });
});
