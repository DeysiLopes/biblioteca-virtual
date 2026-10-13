/**
 * Prompt enviado junto dos frames do reel. Pedimos JSON estrito para o
 * parser sobreviver a qualquer texto extra que o modelo inventar.
 */
export const BOOK_EXTRACTION_PROMPT = `You are looking at frames extracted from a book-recommendation short video (reel/short/tiktok) or screenshots.

Identify every DISTINCT book shown or clearly mentioned in these images. Book covers are the main signal — read the title and author on the cover/spine when visible.

Rules:
- Return ONLY a JSON array, no markdown, no commentary.
- Each item: {"title": "...", "author": "..."}.
- If the author is not identifiable, omit "author" (never guess an author).
- If a frame shows the same book from different angles, include it once.
- If no book is identifiable at all, return [].
- Titles may be in Portuguese or English — keep the language as printed on the cover.`;

/**
 * Prompt para quando o post/reel tem legenda legível — comum em reels de
 * indicação literária, que listam "Título — Autor" na própria legenda.
 */
export const CAPTION_EXTRACTION_PROMPT = `You are given the title/caption of an Instagram or YouTube post that recommends books.

Identify every DISTINCT book mentioned in the caption. Books are often listed like "1️⃣ Title — Author", "Title, by Author" or just "Title".

Rules:
- Return ONLY a JSON array, no markdown, no commentary.
- Each item: {"title": "...", "author": "..."}.
- Authors may follow the title after "—", "-", ",", "de" or "by". Omit "author" when absent (never guess).
- Ignore hashtags, questions to followers, CTAs ("salva o post", "comenta aqui") and profile names — they are NOT books.
- If an image is attached (the post cover), also include books visible only on the cover.
- If no book is identifiable, return [].`;
