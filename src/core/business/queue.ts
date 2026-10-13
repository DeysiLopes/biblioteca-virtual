import { Book } from '../models/book';

/**
 * Ordem da fila "Quero ler": livros com filaPosicao primeiro (menor = topo),
 * os sem posição ficam depois, na ordem original (sort estável).
 */
export function sortQueue(books: Book[]): Book[] {
  const pos = (b: Book) =>
    typeof b.filaPosicao === 'number' ? b.filaPosicao : Number.MAX_SAFE_INTEGER;
  return [...books].sort((a, b) => pos(a) - pos(b));
}

/** Posição que coloca o livro no topo da fila (abaixo do menor atual). */
export function topQueuePosition(books: Book[]): number {
  const pos = books
    .filter((b) => b.status === 'Quero ler' && typeof b.filaPosicao === 'number')
    .map((b) => b.filaPosicao as number);
  return (pos.length ? Math.min(...pos) : 0) - 1;
}
