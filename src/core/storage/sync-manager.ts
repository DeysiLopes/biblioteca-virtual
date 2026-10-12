import { Book } from '../models/book';
import { DiaryEntry } from '../models/diary';
import { UserLibraryData } from '../models/user-data';
import {
  getAllBooks,
  getAllDiary,
  getMetaValue,
  setMetaValue,
  putBook,
  putBooksBatch,
  putDiaryBatch,
  persistBookAndDiaryAtomic,
  deleteBook as idbDeleteBook,
} from './idb';
import { authService } from '../auth/google-auth';
import { driveService } from './drive';
import { syncChannel } from '../broadcast/channel';
import { migrateLegacySyncData } from './migration';

let syncTimer: any = null;

export class LibrarySyncManager {
  private inMemoryBooks: Book[] = [];
  private inMemoryDiary: DiaryEntry[] = [];
  private isLoaded: boolean = false;
  private isSyncing: boolean = false;

  public async initialize(): Promise<{ books: Book[]; diary: DiaryEntry[] }> {
    // 1. Carrega do IndexedDB
    let localBooks = await getAllBooks();
    let localDiary = await getAllDiary();

    // Se estiver totalmente vazio, tenta carregar semente de books.json / data/sync.json
    if (localBooks.length === 0) {
      try {
        const [booksRes, syncRes] = await Promise.allSettled([
          fetch('./books.json'),
          fetch('./data/sync.json'),
        ]);

        // Caminho ausente devolve o index.html (SPA fallback / 404 do Pages): só aceita JSON
        const tryJson = async (res: PromiseSettledResult<Response>) => {
          if (res.status !== 'fulfilled' || !res.value.ok) return null;
          if (!res.value.headers.get('content-type')?.includes('application/json')) return null;
          try {
            return await res.value.json();
          } catch {
            return null;
          }
        };

        const catalog: Book[] = ((await tryJson(booksRes)) as Book[] | null) ?? [];
        const legacySync = await tryJson(syncRes);

        if (legacySync) {
          const migrated = migrateLegacySyncData(legacySync, catalog);
          localBooks = migrated.books;
          localDiary = migrated.diary;
        } else if (catalog.length > 0) {
          localBooks = catalog;
        }

        if (localBooks.length > 0) {
          await putBooksBatch(localBooks);
        }
        if (localDiary.length > 0) {
          await putDiaryBatch(localDiary);
        }
      } catch (err) {
        console.warn('Erro ao carregar dados iniciais locais:', err);
      }
    }

    this.inMemoryBooks = localBooks;
    this.inMemoryDiary = localDiary;
    this.isLoaded = true;

    // 2. Se autenticado, sincroniza com Google Drive em background
    this.pullFromDriveQuietly();

    return { books: this.inMemoryBooks, diary: this.inMemoryDiary };
  }

  public getBooks(): Book[] {
    return [...this.inMemoryBooks];
  }

  public getDiary(): DiaryEntry[] {
    return [...this.inMemoryDiary];
  }

  public async pullFromDriveQuietly(): Promise<void> {
    const auth = authService.getAuthState();
    if (!auth.isAuthenticated || !auth.user) return;

    try {
      this.isSyncing = true;
      const driveData = await driveService.downloadLibrary(auth.user.id);
      if (driveData) {
        // Merge baseado no updatedAt de cada livro
        const mergedBooksMap = new Map<string, Book>();
        this.inMemoryBooks.forEach(b => mergedBooksMap.set(b.id, b));

        driveData.books.forEach(dbBook => {
          const local = mergedBooksMap.get(dbBook.id);
          if (!local || (dbBook.updatedAt || 0) >= (local.updatedAt || 0)) {
            mergedBooksMap.set(dbBook.id, dbBook);
          }
        });

        // Diário por união de IDs
        const diaryMap = new Map<string, DiaryEntry>();
        this.inMemoryDiary.forEach(d => diaryMap.set(d.id, d));
        driveData.diary.forEach(d => {
          const local = diaryMap.get(d.id);
          if (!local || (d.ts || 0) >= (local.ts || 0)) {
            diaryMap.set(d.id, d);
          }
        });

        this.inMemoryBooks = Array.from(mergedBooksMap.values());
        this.inMemoryDiary = Array.from(diaryMap.values()).sort(
          (a, b) => (b.date === a.date ? String(b.id).localeCompare(String(a.id)) : b.date < a.date ? -1 : 1)
        );

        await putBooksBatch(this.inMemoryBooks);
        await putDiaryBatch(this.inMemoryDiary);
        await setMetaValue('lastSyncAt', Date.now());

        syncChannel.broadcast({ type: 'LIBRARY_UPDATED', timestamp: Date.now() });
      } else {
        // Primeiro login do usuário: sobe o conteúdo local inicial para o Drive
        await this.schedulePushToDrive(true);
      }
    } catch (err) {
      console.warn('Erro ao sincronizar com Google Drive:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  public async saveBook(book: Book, diaryEntry?: DiaryEntry): Promise<void> {
    // 1. Atualiza memória
    const bIndex = this.inMemoryBooks.findIndex(b => b.id === book.id);
    if (bIndex >= 0) {
      this.inMemoryBooks[bIndex] = book;
    } else {
      this.inMemoryBooks.push(book);
    }

    if (diaryEntry) {
      this.inMemoryDiary.unshift(diaryEntry);
    }

    // 2. Persiste atômico no IndexedDB
    await persistBookAndDiaryAtomic(book, diaryEntry);

    // 3. Notifica abas
    syncChannel.broadcast({ type: 'LIBRARY_UPDATED', timestamp: Date.now() });

    // 4. Agenda envio ao Drive (debounce de 800ms)
    this.schedulePushToDrive();
  }

  public async saveBatch(books: Book[], diary: DiaryEntry[] = []): Promise<void> {
    const booksMap = new Map<string, Book>(this.inMemoryBooks.map(b => [b.id, b]));
    books.forEach(b => booksMap.set(b.id, b));
    this.inMemoryBooks = Array.from(booksMap.values());

    const diaryMap = new Map<string, DiaryEntry>(this.inMemoryDiary.map(d => [d.id, d]));
    diary.forEach(d => diaryMap.set(d.id, d));
    this.inMemoryDiary = Array.from(diaryMap.values());

    await putBooksBatch(this.inMemoryBooks);
    if (diary.length > 0) {
      await putDiaryBatch(this.inMemoryDiary);
    }

    syncChannel.broadcast({ type: 'LIBRARY_UPDATED', timestamp: Date.now() });
    this.schedulePushToDrive();
  }

  public async removeBook(id: string): Promise<void> {
    this.inMemoryBooks = this.inMemoryBooks.filter(b => b.id !== id);
    await idbDeleteBook(id);
    syncChannel.broadcast({ type: 'LIBRARY_UPDATED', timestamp: Date.now() });
    this.schedulePushToDrive();
  }

  public schedulePushToDrive(immediate: boolean = false): void {
    const auth = authService.getAuthState();
    if (!auth.isAuthenticated || !auth.user) return;

    if (syncTimer) clearTimeout(syncTimer);

    const run = async () => {
      try {
        const payload: UserLibraryData = {
          version: 1,
          updatedAt: Date.now(),
          books: this.inMemoryBooks,
          diary: this.inMemoryDiary,
          meta: {
            lastSyncAt: Date.now(),
          },
        };
        await driveService.uploadLibrary(auth.user!.id, payload);
      } catch (err) {
        console.error('Falha ao subir biblioteca para o Drive:', err);
      }
    };

    if (immediate) {
      run();
    } else {
      syncTimer = setTimeout(run, 800);
    }
  }

  /**
   * Baixa o arquivo biblioteca-<userId>.json diretamente para o usuário (FR-16 / AC-11).
   */
  public exportDriveBackup(): void {
    const auth = authService.getAuthState();
    const userId = auth.user ? auth.user.id : 'offline';
    const payload: UserLibraryData = {
      version: 1,
      updatedAt: Date.now(),
      books: this.inMemoryBooks,
      diary: this.inMemoryDiary,
      meta: {
        lastSyncAt: Date.now(),
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `biblioteca-${userId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const syncManager = new LibrarySyncManager();
