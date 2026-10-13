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
  clearStore,
} from './idb';
import { authService } from '../auth/google-auth';
import { driveService } from './drive';
import { syncChannel } from '../broadcast/channel';
import { migrateLegacySyncData } from './migration';
import { showToast } from '../business/share';

let syncTimer: any = null;

/**
 * Mescla local → remoto: o remoto (mais novo) vence, mas campos que ele
 * simplesmente não tem (registro parcial/legado) herdam do local.
 * Campo presente e vazio no remoto é respeitado — pode ser intencional.
 */
function mergeBookFields(local: Book, remote: Book): Book {
  const merged = { ...remote };
  (Object.keys(local) as (keyof Book)[]).forEach((k) => {
    if (merged[k] === undefined && local[k] !== undefined) {
      (merged as any)[k] = local[k];
    }
  });
  return merged;
}

const normKey = (s?: string | null) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();


/**
 * Identidades estáveis do livro para deduplicar o merge: ISBN (quando
 * existir) E título+autor normalizados — ambos indexados, porque um lado
 * pode ter ISBN e o outro não. O mesmo livro pode ter IDs diferentes em
 * cada aparelho (importações geram IDs novos).
 */
function bookKeys(b: Book): string[] {
  const keys: string[] = [];
  const isbn = normKey(b.codigo_isbn).replace(/[^0-9x]/g, '');
  if (isbn) keys.push(`isbn:${isbn}`);
  const t = normKey(b.title);
  if (t) keys.push(`ta:${t}|${normKey(b.author)}`);
  return keys;
}

export class LibrarySyncManager {
  private inMemoryBooks: Book[] = [];
  private inMemoryDiary: DiaryEntry[] = [];
  private isLoaded: boolean = false;
  private isSyncing: boolean = false;

  public async initialize(): Promise<{ books: Book[]; diary: DiaryEntry[] }> {
    // 1. Carrega do IndexedDB
    let localBooks = await getAllBooks();
    let localDiary = await getAllDiary();

    // Purga registros-fantasma sem título (legados de versões antigas que
    // liam o sync.json — lá os livros só têm estado de leitura)
    const ghosts = localBooks.filter((b) => !b.title?.trim());
    if (ghosts.length) {
      localBooks = localBooks.filter((b) => b.title?.trim());
      await Promise.all(ghosts.map((g) => idbDeleteBook(g.id)));
    }

    // Se estiver totalmente vazio, tenta carregar semente de books.json / data/sync.json
    // (pulada quando o usuário limpou os dados locais de propósito).
    // Os arquivos legados só existem em dev — em produção são gitignored e
    // cada visitante novo receberia 404s de graça no console.
    const wiped = await getMetaValue<boolean>('localWiped');
    if (localBooks.length === 0 && !wiped && import.meta.env.DEV) {
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

    // 2. Sincroniza com o Drive agora (se autenticado) e toda vez que o
    // usuário fizer login nesta sessão — sem precisar clicar em nada
    this.bindAuthSync();

    return { books: this.inMemoryBooks, diary: this.inMemoryDiary };
  }

  private authSyncBound = false;
  private lastSyncedUserId: string | null = null;

  private bindAuthSync(): void {
    if (this.authSyncBound) return;
    this.authSyncBound = true;

    authService.subscribe((state) => {
      const uid = state.isAuthenticated ? state.user?.id ?? null : null;
      if (uid && uid !== this.lastSyncedUserId) {
        this.lastSyncedUserId = uid;
        void this.syncAfterLogin();
      }
      if (!uid) this.lastSyncedUserId = null;
    });
  }

  /** Registrado pela interface: decide se limpa o local antes do 1º sync. */
  private firstSyncPrompt: ((localCount: number) => Promise<'wipe' | 'merge'>) | null = null;
  public setFirstSyncPrompt(fn: typeof this.firstSyncPrompt): void {
    this.firstSyncPrompt = fn;
  }

  /**
   * Ao logar com livros locais, pergunta se a pessoa quer limpar tudo e
   * baixar só o Drive ou mesclar (sem duplicar). Sem livros locais, ou
   * sem interface registrada, vai direto para o merge.
   */
  private async syncAfterLogin(): Promise<void> {
    const uid = authService.getAuthState().user?.id ?? 'anon';
    const askedKey = `bib_sync_asked_${uid}`;
    const alreadyAsked = (() => {
      try {
        return localStorage.getItem(askedKey) === '1';
      } catch {
        return false;
      }
    })();

    // A pergunta só aparece uma vez por usuário por aparelho — depois disso
    // todo login vai direto para o merge (deduplicado)
    if (this.inMemoryBooks.length > 0 && this.firstSyncPrompt && !alreadyAsked) {
      try {
        const choice = await this.firstSyncPrompt(this.inMemoryBooks.length);
        try {
          localStorage.setItem(askedKey, '1');
        } catch {}
        if (choice === 'wipe') {
          await this.resetLocalData();
        }
      } catch (e) {
        console.warn('Prompt de sincronização falhou — mesclando:', e);
      }
    }
    await this.pullFromDriveQuietly({ notify: true });
  }

  /**
   * Apaga todos os dados locais (livros, diário, meta). Não toca na sessão
   * (sessionStorage) — se a pessoa estiver logada, pode baixar do Drive em
   * seguida. A flag 'localWiped' impede que a semente legada volte.
   */
  public async resetLocalData(): Promise<void> {
    this.inMemoryBooks = [];
    this.inMemoryDiary = [];
    await Promise.all([
      clearStore('books'),
      clearStore('diary'),
      clearStore('meta'),
      clearStore('covers'),
    ]);
    await setMetaValue('localWiped', true);
    syncChannel.broadcast({ type: 'LIBRARY_UPDATED', timestamp: Date.now() });
  }

  public getBooks(): Book[] {
    return [...this.inMemoryBooks];
  }

  public getDiary(): DiaryEntry[] {
    return [...this.inMemoryDiary];
  }

  public async pullFromDriveQuietly(opts: { notify?: boolean } = {}): Promise<void> {
    const auth = authService.getAuthState();
    if (!auth.isAuthenticated || !auth.user) return;

    try {
      this.isSyncing = true;
      const driveData = await driveService.downloadLibrary(auth.user.id);
      if (driveData) {
        // Merge baseado no updatedAt de cada livro — ignora registros
        // fantasma sem título vindos de arquivos legados
        const mergedBooksMap = new Map<string, Book>();
        this.inMemoryBooks.forEach(b => mergedBooksMap.set(b.id, b));

        // Índice por identidade (ISBN ou título+autor): o mesmo livro pode
        // existir local e no Drive com IDs diferentes — sem isso duplica
        const keyToLocalId = new Map<string, string>();
        this.inMemoryBooks.forEach((b) => {
          bookKeys(b).forEach((k) => {
            if (!keyToLocalId.has(k)) keyToLocalId.set(k, b.id);
          });
        });
        const diaryIdRemap = new Map<string, string>();
        const droppedLocalIds: string[] = [];

        // books pode vir como array ou como dicionário {id: livro} (legado)
        const driveBooks: Book[] = Array.isArray(driveData.books)
          ? driveData.books
          : Object.entries((driveData as any).books || {}).map(
              ([id, b]) => ({ id, ...(b as object) }) as Book
            );

        driveBooks.forEach(dbBook => {
          if (!dbBook?.id || !dbBook.title?.trim()) return;
          let local = mergedBooksMap.get(dbBook.id);
          if (!local) {
            const altId = bookKeys(dbBook)
              .map((k) => keyToLocalId.get(k))
              .find((id) => id && id !== dbBook.id);
            if (altId && altId !== dbBook.id) {
              local = mergedBooksMap.get(altId);
              if (local) {
                // O ID do Drive é canônico entre os aparelhos: o registro
                // local sai e o diário que apontava para ele é remapeado
                mergedBooksMap.delete(altId);
                droppedLocalIds.push(altId);
                diaryIdRemap.set(altId, dbBook.id);
              }
            }
          }
          if (!local) {
            mergedBooksMap.set(dbBook.id, dbBook);
          } else if ((dbBook.updatedAt || 0) >= (local.updatedAt || 0)) {
            mergedBooksMap.set(dbBook.id, mergeBookFields(local, dbBook));
          } else {
            // Local mais novo vence, mas fica com o ID do Drive
            mergedBooksMap.set(dbBook.id, { ...mergeBookFields(dbBook, local), id: dbBook.id });
          }
        });

        // Diário por união de IDs (+ remapeamento dos livros deduplicados)
        // Aceita array ou dicionário {id: entry}; ausente vira [] em vez de
        // quebrar o merge inteiro
        const driveDiary: DiaryEntry[] = Array.isArray(driveData.diary)
          ? driveData.diary
          : Object.entries((driveData as any).diary || {}).map(
              ([id, d]) => ({ id, ...(d as object) }) as DiaryEntry
            );

        const diaryMap = new Map<string, DiaryEntry>();
        this.inMemoryDiary.forEach(d => diaryMap.set(d.id, d));
        driveDiary.forEach(d => {
          const local = diaryMap.get(d.id);
          if (!local || (d.ts || 0) >= (local.ts || 0)) {
            diaryMap.set(d.id, d);
          }
        });

        this.inMemoryBooks = Array.from(mergedBooksMap.values());
        this.inMemoryDiary = Array.from(diaryMap.values())
          .map((d) =>
            diaryIdRemap.has(d.bookId)
              ? { ...d, bookId: diaryIdRemap.get(d.bookId)! }
              : d
          )
          .sort(
            (a, b) => (b.date === a.date ? String(b.id).localeCompare(String(a.id)) : b.date < a.date ? -1 : 1)
          );

        await putBooksBatch(this.inMemoryBooks);
        await putDiaryBatch(this.inMemoryDiary);
        await Promise.all(droppedLocalIds.map((id) => idbDeleteBook(id)));
        await setMetaValue('lastSyncAt', Date.now());

        syncChannel.broadcast({ type: 'LIBRARY_UPDATED', timestamp: Date.now() });
      } else {
        // Arquivo ainda não existe no Drive: sobe o conteúdo local inicial.
        // Só quando há algo a compartilhar — nunca sobrescreve remoto com
        // biblioteca vazia (ex.: logo após uma limpeza local)
        if (this.inMemoryBooks.length > 0 || this.inMemoryDiary.length > 0) {
          await this.schedulePushToDrive(true);
        }
      }
    } catch (err) {
      console.warn('Erro ao sincronizar com Google Drive:', err);
      if (opts.notify) {
        showToast('Não consegui baixar a biblioteca do Drive — verifica a conexão ou conecta de novo.');
      }
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
          books: this.inMemoryBooks.filter((b) => b.title?.trim()),
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
