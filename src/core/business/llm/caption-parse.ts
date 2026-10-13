import { ScannedBook } from './types';
import { normalizeTitle } from '../open-library';

/**
 * Parser local de legendas de reels literários — o formato clássico do
 * bookstagram é uma lista "Título — Autor" numerada ou com emoji:
 *
 *   📖 Os livros desta lista:
 *   1️⃣ A Última Casa da Rua Needless — Catriona Ward
 *   2️⃣ Tudo em Família — John Marrs
 *
 * Conservador de propósito: só extrai linhas com separador explícito
 * entre título e autor. Linha sem separador não vira livro — melhor cair
 * no scan com IA do que inventar candidato. Quando resolve, o LLM nem é
 * chamado (zero custo de API).
 */

// Separador título→autor: travessão/hífen com espaços, pipe, ou " by "
const SEP = /\s+(?:—|–|-|\||by)\s+/;

// Prefixo de item de lista: "1.", "2)", "3 -", "4️⃣", emoji, "•", "*", "—"
const BULLET =
  /^(?:\d+\s*(?:[.)\]:-]|️⃣)?\s*|[\p{Extended_Pictographic}\u{FE0F}\u{20E3}•▪*–—-]+\s*)+/u;

// Linhas que claramente não são livros: hashtags, links, cabeçalhos
const SKIP_LINE = /^(?:#|https?:|@)|:$|(?:lista|livros|books)\s*:?\s*$/i;

function cleanTitle(s: string): string {
  return s
    .replace(/[📖📚✨💫]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanAuthor(s: string): string {
  return s
    .replace(/\s*#.*$/, '')          // hashtags coladas no fim
    .replace(/\s*https?:\S*.*$/, '') // link colado
    .replace(/[📖📚]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseCaptionBooks(caption: string): ScannedBook[] {
  const seen = new Set<string>();
  const books: ScannedBook[] = [];

  for (const raw of caption.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || SKIP_LINE.test(line)) continue;

    line = line.replace(BULLET, '').trim();
    if (!line || line.length < 5 || SKIP_LINE.test(line)) continue;

    const sep = line.match(SEP);
    if (!sep || sep.index === undefined) continue;

    const title = cleanTitle(line.slice(0, sep.index));
    const author = cleanAuthor(line.slice(sep.index + sep[0].length));

    // sanity: título e autor plausíveis, sem URL nem fragmento de hashtag
    if (title.length < 2 || author.length < 2) continue;
    if (title.length > 120 || author.length > 80) continue;
    if (/\d{3,}|@/.test(title)) continue;

    const key = normalizeTitle(title);
    if (seen.has(key)) continue;
    seen.add(key);
    books.push({ title, author });
  }

  return books;
}
