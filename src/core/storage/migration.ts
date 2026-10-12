import { Book } from '../models/book';
import { DiaryEntry } from '../models/diary';
import { UserLibraryData } from '../models/user-data';

interface LegacySyncPayload {
  v?: number;
  books?: Record<string, Partial<Book>>;
  diary?: DiaryEntry[];
}

/**
 * Realiza a migração do legado data/sync.json para o modelo UserLibraryData do usuário.
 */
export function migrateLegacySyncData(
  legacy: LegacySyncPayload,
  catalogBooks: Book[] = []
): UserLibraryData {
  const booksMap = new Map<string, Book>();

  // 1. Carrega o catálogo base (se fornecido)
  catalogBooks.forEach(b => {
    booksMap.set(b.id, { ...b });
  });

  // 2. Aplica os overrides do sync.json
  if (legacy.books) {
    for (const [id, ov] of Object.entries(legacy.books)) {
      const existing = booksMap.get(id);
      if (existing) {
        booksMap.set(id, {
          ...existing,
          ...ov,
          updatedAt: ov.updatedAt || Date.now(),
        });
      } else if ((ov as any).title) {
        // Livro criado pelo usuário
        booksMap.set(id, {
          id,
          title: (ov as any).title || 'Sem título',
          author: (ov as any).author || '',
          status: ov.status || 'Quero ler',
          paginas: ov.paginas || null,
          paginasLidas: ov.paginasLidas || 0,
          ...ov,
          updatedAt: ov.updatedAt || Date.now(),
        } as Book);
      }
    }
  }

  // 3. Normaliza o diário
  const diary: DiaryEntry[] = Array.isArray(legacy.diary)
    ? legacy.diary.map(d => ({
        ...d,
        id: String(d.id),
      }))
    : [];

  return {
    version: 1,
    updatedAt: Date.now(),
    books: Array.from(booksMap.values()),
    diary,
    meta: {
      migratedFromSyncJson: true,
      lastSyncAt: Date.now(),
      reminder: { time: '20:00' },
    },
  };
}
