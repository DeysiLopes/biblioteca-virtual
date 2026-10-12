import { Book, Citacao, DeletedCitacao } from '../models/book';

export const CIT_PASTEL = [
  '#f1bfd4',
  '#eee3ad',
  '#dfa887',
  '#becde5',
  '#cbd9b8',
  '#d9c5e6',
];

export function getQuoteColor(index: number): string {
  return CIT_PASTEL[index % CIT_PASTEL.length];
}

export interface QuoteInput {
  text: string;
  page: number;
}

export function validateQuoteInput(input: QuoteInput): { valid: boolean; error?: string } {
  if (!input.text || !input.text.trim()) {
    return { valid: false, error: 'O texto da citação não pode ficar vazio.' };
  }
  if (!input.page || isNaN(input.page) || input.page <= 0) {
    return { valid: false, error: 'A página da citação é obrigatória e deve ser maior que zero.' };
  }
  return { valid: true };
}

/**
 * Salva uma citação em um livro.
 * Se quoteId for fornecido, edita preservando id e ts original.
 * Se não for fornecido, cria uma nova com id e ts novos.
 */
export function saveQuoteToBook(
  book: Book,
  input: QuoteInput,
  quoteId?: string
): Book {
  const validation = validateQuoteInput(input);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const now = Date.now();
  const existingQuotes = Array.isArray(book.citacoes) ? [...book.citacoes] : [];

  if (quoteId) {
    // Edição: preserva id e ts
    const index = existingQuotes.findIndex(c => c.id === quoteId);
    if (index >= 0) {
      const orig = existingQuotes[index];
      existingQuotes[index] = {
        ...orig,
        text: input.text.trim(),
        page: Math.floor(input.page),
        updatedAt: now,
      };
    }
  } else {
    // Criação
    const newQuote: Citacao = {
      id: crypto.randomUUID(),
      text: input.text.trim(),
      page: Math.floor(input.page),
      ts: now,
      updatedAt: now,
    };
    existingQuotes.push(newQuote);
  }

  return {
    ...book,
    citacoes: existingQuotes,
    updatedAt: now,
  };
}

/**
 * Remove uma citação do livro, registrando em deletedCitacoes para conciliação no sync.
 */
export function deleteQuoteFromBook(book: Book, quoteId: string): Book {
  const now = Date.now();
  const existingQuotes = Array.isArray(book.citacoes) ? book.citacoes : [];
  const updatedQuotes = existingQuotes.filter(c => c.id !== quoteId);

  const deleted: DeletedCitacao[] = Array.isArray(book.deletedCitacoes)
    ? [...book.deletedCitacoes]
    : [];

  deleted.push({ id: quoteId, ts: now });

  return {
    ...book,
    citacoes: updatedQuotes,
    deletedCitacoes: deleted,
    updatedAt: now,
  };
}
