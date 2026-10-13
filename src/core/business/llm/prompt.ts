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
