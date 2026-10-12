import { describe, it, expect } from 'vitest';
import {
  saveQuoteToBook,
  deleteQuoteFromBook,
  validateQuoteInput,
} from '../core/business/quotes';
import { Book } from '../core/models/book';

describe('Regras de Negócio — Citações e Fichário', () => {
  const sampleBook: Book = {
    id: 'b1',
    title: 'Capitu',
    author: 'Machado de Assis',
    status: 'Lendo',
    citacoes: [],
    deletedCitacoes: [],
  };

  it('Validação exige texto e página maior que zero', () => {
    expect(validateQuoteInput({ text: '', page: 10 }).valid).toBe(false);
    expect(validateQuoteInput({ text: 'Trecho', page: 0 }).valid).toBe(false);
    expect(validateQuoteInput({ text: 'Trecho', page: 42 }).valid).toBe(true);
  });

  it('Criar citação adiciona ao livro com ID e timestamp novos', () => {
    const updated = saveQuoteToBook(sampleBook, { text: 'Olhos de ressaca', page: 123 });
    expect(updated.citacoes?.length).toBe(1);
    expect(updated.citacoes?.[0].text).toBe('Olhos de ressaca');
    expect(updated.citacoes?.[0].page).toBe(123);
    expect(updated.citacoes?.[0].id).toBeDefined();
    expect(updated.citacoes?.[0].ts).toBeDefined();
  });

  it('Editar citação PRESERVA o ID e o timestamp original de criação', () => {
    const bWithQuote = saveQuoteToBook(sampleBook, { text: 'Texto original', page: 10 });
    const originalQuote = bWithQuote.citacoes![0];

    const editedBook = saveQuoteToBook(
      bWithQuote,
      { text: 'Texto corrigido', page: 11 },
      originalQuote.id
    );

    const editedQuote = editedBook.citacoes![0];
    expect(editedQuote.id).toBe(originalQuote.id);
    expect(editedQuote.ts).toBe(originalQuote.ts);
    expect(editedQuote.text).toBe('Texto corrigido');
    expect(editedQuote.page).toBe(11);
    expect(editedQuote.updatedAt).toBeDefined();
  });

  it('Excluir citação registra o ID em deletedCitacoes para sincronização correta', () => {
    const bWithQuote = saveQuoteToBook(sampleBook, { text: 'Citação a apagar', page: 5 });
    const quoteId = bWithQuote.citacoes![0].id;

    const afterDelete = deleteQuoteFromBook(bWithQuote, quoteId);
    expect(afterDelete.citacoes?.length).toBe(0);
    expect(afterDelete.deletedCitacoes?.length).toBe(1);
    expect(afterDelete.deletedCitacoes?.[0].id).toBe(quoteId);
  });
});
