import { Book } from '../models/book';

/**
 * Monta o texto de compartilhamento de um livro: dados básicos, resenha
 * (no fim, atrás de aviso, quando marcada com spoilers) e citações.
 */
export function buildShareText(book: Book): string {
  const lines: string[] = [];
  lines.push(`📚 ${book.title}${book.author ? ` — ${book.author}` : ''}`);

  const meta: string[] = [];
  if (book.status) meta.push(book.status);
  if (book.paginas) meta.push(`${book.paginasLidas || 0}/${book.paginas} páginas`);
  if (book.genero) meta.push(book.genero);
  if (book.codigo_isbn) meta.push(`ISBN ${book.codigo_isbn}`);
  if (meta.length) lines.push(meta.join(' · '));

  const resenha = (book.resenha || '').trim();
  const cits = (book.citacoes || []).filter((c) => c.text?.trim());

  // Resenha sem spoiler vai em destaque; com spoiler vai para o fim,
  // depois do aviso — quem recebe decide se continua lendo ou não
  if (resenha && !book.resenhaSpoilers) {
    lines.push('', '📝 Resenha:', resenha);
  }

  if (cits.length) {
    lines.push('', '💬 Citações favoritas:');
    for (const c of cits) {
      lines.push(`“${c.text.trim()}” — p.${c.page}`);
    }
  }

  if (resenha && book.resenhaSpoilers) {
    lines.push(
      '',
      '⚠️ A RESENHA ABAIXO CONTÉM SPOILERS — pare aqui se ainda não leu o livro ⚠️',
      '',
      resenha
    );
  }

  lines.push('', '— compartilhado do Minha Biblioteca ✨');
  return lines.join('\n');
}

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Compartilha via Web Share API (celular/tablet); na falta dela, copia
 * o texto para a área de transferência.
 */
export async function shareBook(book: Book): Promise<ShareResult> {
  const text = buildShareText(book);
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: book.title, text });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** Mostra um aviso flutuante usando o estilo #toast existente. */
export function showToast(msg: string): void {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  const elRef = el;
  window.setTimeout(() => elRef.classList.remove('show'), 2600);
}
