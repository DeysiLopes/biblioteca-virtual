import { Book, BookStatus } from '../models/book';
import { DiaryEntry } from '../models/diary';

export function calculatePercentage(read?: number | null, total?: number | null): number {
  if (!total || total <= 0 || !read || read <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((read / total) * 100)));
}

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface SaveBookResult {
  updatedBook: Book;
  newDiaryEntry?: DiaryEntry;
}

/**
 * Atualiza o progresso do livro seguindo as regras inegociáveis de negócio:
 * 1. Páginas lidas informa o total já lido (digitar 100 salva 100, sem somar).
 * 2. Transições automáticas de status conforme páginas lidas e total.
 * 3. Cria registro no diário para a diferença (se houve avanço). O histórico nunca recalcula o livro.
 * 4. readingEpoch marca reinícios para isolar métricas antigas no dashboard.
 */
export function applyBookProgressUpdate(
  currentBook: Book,
  newPagesRead: number,
  newTotalPages?: number | null,
  customStatus?: BookStatus,
  customTipo?: string | null,
  customInicio?: string | null,
  customFim?: string | null,
  customComentarios?: string
): SaveBookResult {
  const previousPagesRead = currentBook.paginasLidas || 0;
  const totalPages = newTotalPages !== undefined ? newTotalPages : currentBook.paginas;
  const now = Date.now();
  const today = getTodayDateString();

  let readingEpoch = currentBook.readingEpoch || 0;
  let status: BookStatus = customStatus || currentBook.status;
  let inicio = customInicio !== undefined ? customInicio : currentBook.inicio;
  let fim = customFim !== undefined ? customFim : currentBook.fim;

  // Gerenciamento de readingEpoch (reinício de leitura)
  if (previousPagesRead > 0 && newPagesRead === 0) {
    // Zerou o livro -> novo epoch
    readingEpoch = now;
  } else if (previousPagesRead === 0 && newPagesRead > 0 && (!readingEpoch || readingEpoch === 0)) {
    // Iniciou pela primeira vez
    readingEpoch = now;
  }

  // Transições de status automáticas
  if (totalPages && totalPages > 0) {
    if (newPagesRead >= totalPages) {
      status = 'Lido';
      if (!fim) fim = today;
      if (!inicio) inicio = today;
    } else if (newPagesRead > 0) {
      if (status === 'Quero ler' || status === 'Lido') {
        status = 'Lendo';
      }
      if (status === 'Lendo' && fim) {
        fim = null; // desmarca fim se voltou a ler
      }
      if (!inicio) inicio = today;
    }
  } else if (newPagesRead > 0) {
    if (status === 'Quero ler') status = 'Lendo';
    if (!inicio) inicio = today;
  }

  const updatedBook: Book = {
    ...currentBook,
    paginasLidas: newPagesRead,
    paginas: totalPages,
    status,
    tipo: customTipo !== undefined ? customTipo : currentBook.tipo,
    inicio,
    fim,
    comentarios: customComentarios !== undefined ? customComentarios : currentBook.comentarios,
    readingEpoch,
    updatedAt: now,
  };

  let newDiaryEntry: DiaryEntry | undefined = undefined;
  if (newPagesRead > previousPagesRead) {
    const delta = newPagesRead - previousPagesRead;
    newDiaryEntry = {
      id: crypto.randomUUID(),
      bookId: currentBook.id,
      date: today,
      pages: delta,
      ts: now,
      readingEpoch,
    };
  }

  return { updatedBook, newDiaryEntry };
}
