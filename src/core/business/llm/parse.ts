import { ScannedBook } from './types';

/**
 * Extrai o array JSON de livros da resposta do LLM, tolerando cercas de
 * markdown, texto antes/depois e itens malformados. Devolve só títulos
 * plausíveis — nunca inventa o que o modelo não mandou.
 */
export function parseScannedBooks(raw: string): ScannedBook[] {
  if (!raw) return [];

  // Tira cercas ```json ... ``` e pega o primeiro [...] balanceado possível
  const fenced = raw.replace(/```(?:json)?/gi, '');
  const start = fenced.indexOf('[');
  const end = fenced.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(fenced.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  const books: ScannedBook[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const title = String((item as any).title ?? '').trim();
    if (title.length < 2) continue;
    const author = String((item as any).author ?? '').trim();
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    books.push({
      title,
      author: author || undefined,
      uncertain: Boolean((item as any).uncertain),
    });
  }
  return books;
}
