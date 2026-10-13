import { Book } from '../models/book';
import { authService } from '../auth/google-auth';
import { driveService } from './drive';
import { getCoverBlob, putCoverBlob } from './idb';
import { syncManager } from './sync-manager';
import { normalizeIsbn } from '../business/open-library';

// A OL devolve um GIF 1x1 (~40 bytes) quando não há capa — só vale
// guardar arquivo de verdade no Drive
const MIN_COVER_BYTES = 2000;

/**
 * Nome estável do arquivo da capa em Minha Biblioteca/capas:
 * <isbn>.jpg quando há ISBN, senão book-<id>.jpg
 */
export function coverFileName(book: Book): string {
  const isbn = normalizeIsbn(book.codigo_isbn || '');
  return isbn ? `${isbn}.jpg` : `book-${book.id}.jpg`;
}

/** URL remota imediata (Open Library) — a que renderiza sem auth. */
export function remoteCoverUrl(book: Book): string {
  if (book.cover) return book.cover;
  const isbn = normalizeIsbn(book.codigo_isbn || '');
  return isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : '';
}

// Object URLs reutilizadas entre os componentes na sessão
const urlCache = new Map<string, string>();

/** Object URL já resolvido nesta sessão (primeira pintura síncrona). */
export function cachedCoverUrl(name: string): string | undefined {
  return urlCache.get(name);
}

function cacheUrl(name: string, blob: Blob): string {
  const hit = urlCache.get(name);
  if (hit) return hit;
  const url = URL.createObjectURL(blob);
  urlCache.set(name, url);
  return url;
}

const inflightResolve = new Map<string, Promise<string>>();

/**
 * Resolve a capa para exibição: cache em memória → blob no IndexedDB →
 * blob no Drive (quando logado) → URL remota da Open Library.
 * A ordem garante capa offline e em aparelhos novos mesmo sem `cover`.
 */
export function resolveCoverUrl(book: Book): Promise<string> {
  const name = coverFileName(book);
  const running = inflightResolve.get(name);
  if (running) return running;

  const task = (async (): Promise<string> => {
    const cached = urlCache.get(name);
    if (cached) return cached;

    try {
      const local = await getCoverBlob(name);
      if (local) return cacheUrl(name, local);
    } catch {
      // IndexedDB indisponível — segue para as outras fontes
    }

    const auth = authService.getAuthState();
    if (auth.isAuthenticated) {
      try {
        const fileId = book.coverFileId ?? (await driveService.findCoverByName(name));
        if (fileId) {
          const blob = await driveService.downloadCover(fileId);
          if (blob) {
            await putCoverBlob(name, blob).catch(() => {});
            if (!book.coverFileId) void saveCoverFileId(book.id, fileId);
            return cacheUrl(name, blob);
          }
        }
      } catch {
        // Drive falhou — cai para a URL remota
      }
    }

    return remoteCoverUrl(book);
  })().finally(() => inflightResolve.delete(name));

  inflightResolve.set(name, task);
  return task;
}

/** Grava o coverFileId na versão mais recente do livro (sem snapshot velho). */
export async function saveCoverFileId(bookId: string, fileId: string): Promise<void> {
  const latest = syncManager.getBooks().find((b) => b.id === bookId);
  if (!latest || latest.coverFileId === fileId) return;
  await syncManager.saveBook({ ...latest, coverFileId: fileId });
}

const inflightUpload = new Map<string, Promise<void>>();

/**
 * Garante que a capa do livro está salva em Minha Biblioteca/capas e no
 * IndexedDB. Chamado em segundo plano quando o livro aparece na tela ou
 * depois do enriquecimento — só busca/sobe o que ainda não foi achado.
 */
export function ensureCoverCached(book: Book): Promise<void> {
  const remote = remoteCoverUrl(book);
  if (!remote || book.coverFileId) return Promise.resolve();

  const auth = authService.getAuthState();
  if (!auth.isAuthenticated) return Promise.resolve();

  const name = coverFileName(book);
  const running = inflightUpload.get(name);
  if (running) return running;

  const task = (async () => {
    // Outro aparelho pode já ter subido — então só apontamos o ID
    const existingId = await driveService.findCoverByName(name);
    if (existingId) {
      await saveCoverFileId(book.id, existingId);
      return;
    }

    const res = await fetch(remote);
    const blob = res.ok ? await res.blob() : null;
    if (!blob || !blob.type.startsWith('image/') || blob.size < MIN_COVER_BYTES) return;

    await putCoverBlob(name, blob).catch(() => {});
    cacheUrl(name, blob);

    const fileId = await driveService.uploadCover(name, blob);
    if (fileId) await saveCoverFileId(book.id, fileId);
  })()
    .catch(() => {
      // Capa é best-effort: rede/Drive fora não quebra a estante
    })
    .finally(() => inflightUpload.delete(name));

  inflightUpload.set(name, task);
  return task;
}
