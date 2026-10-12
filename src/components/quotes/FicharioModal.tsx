import React, { useState, useEffect } from 'react';
import { Book, Citacao } from '../../core/models/book';
import {
  CIT_PASTEL,
  getQuoteColor,
  saveQuoteToBook,
  deleteQuoteFromBook,
} from '../../core/business/quotes';
import { QuoteReader } from './QuoteReader';

interface FicharioModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  onSaveBook: (updatedBook: Book) => Promise<void>;
}

export const FicharioModal: React.FC<FicharioModalProps> = ({
  book,
  isOpen,
  onClose,
  onSaveBook,
}) => {
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editText, setEditText] = useState<string>('');
  const [editPage, setEditPage] = useState<number | ''>('');
  const [readerQuote, setReaderQuote] = useState<Citacao | null>(null);
  const [saving, setSaving] = useState(false);

  const quotes = Array.isArray(book?.citacoes) ? book.citacoes : [];

  useEffect(() => {
    if (quotes.length > 0) {
      // Só auto-seleciona fora do modo edição — durante "+ Nova ficha"
      // selectedQuoteId fica null de propósito para criar em vez de editar
      if (!isEditing && (!selectedQuoteId || !quotes.some(q => q.id === selectedQuoteId))) {
        setSelectedQuoteId(quotes[0].id);
      }
    } else {
      setSelectedQuoteId(null);
      setIsEditing(true); // Se não tem nenhuma citação, abre formulário direto
      setEditText('');
      setEditPage('');
    }
  }, [book, selectedQuoteId, quotes, isEditing]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !readerQuote) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, readerQuote]);

  if (!isOpen || !book) return null;

  const activeIndex = quotes.findIndex(q => q.id === selectedQuoteId);
  const activeQuote = activeIndex >= 0 ? quotes[activeIndex] : null;
  const paperColor = activeIndex >= 0 ? getQuoteColor(activeIndex) : CIT_PASTEL[0];

  const handleStartAdd = () => {
    setIsEditing(true);
    setSelectedQuoteId(null);
    setEditText('');
    setEditPage('');
  };

  const handleStartEdit = () => {
    if (!activeQuote) return;
    setIsEditing(true);
    setEditText(activeQuote.text);
    setEditPage(activeQuote.page);
  };

  const handleCancelEdit = () => {
    if (quotes.length > 0) {
      setIsEditing(false);
      setSelectedQuoteId(activeQuote ? activeQuote.id : quotes[0].id);
    } else {
      onClose();
    }
  };

  const handleSaveQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editText.trim()) {
      alert('O texto da citação não pode ficar em branco.');
      return;
    }
    const pageNum = typeof editPage === 'number' ? editPage : parseInt(editPage, 10);
    if (!pageNum || isNaN(pageNum) || pageNum <= 0) {
      alert('O número da página é obrigatório e deve ser maior que zero.');
      return;
    }

    setSaving(true);
    try {
      const updatedBook = saveQuoteToBook(
        book,
        { text: editText, page: pageNum },
        selectedQuoteId || undefined
      );
      await onSaveBook(updatedBook);
      // Seleciona a ficha recém-criada (última da lista) ou a editada
      const savedId =
        selectedQuoteId ||
        updatedBook.citacoes?.[updatedBook.citacoes.length - 1]?.id ||
        null;
      setSelectedQuoteId(savedId);
      setIsEditing(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar citação.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuote = async () => {
    if (!activeQuote) return;
    const ok = window.confirm(`Deseja realmente excluir a citação da página ${activeQuote.page}?`);
    if (!ok) return;

    setSaving(true);
    try {
      const updatedBook = deleteQuoteFromBook(book, activeQuote.id);
      await onSaveBook(updatedBook);
      setSelectedQuoteId(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir citação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        id="fichario"
        className="open"
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="fic-shell">
          <div className="fic-paper" style={{ background: paperColor }}>
            {/* Argolas metálicas à esquerda */}
            <div className="fic-rings">
              <span /><span /><span /><span /><span /><span />
            </div>

            {/* Cabeçalho */}
            <div className="fic-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#6d5a49' }}>
                  Fichário de Citações
                </span>
                <h3 className="serif" style={{ fontSize: 22, margin: 0, color: '#2b221a' }}>
                  {book.title}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {!isEditing && (
                  <button
                    className="hbtn"
                    onClick={handleStartAdd}
                    style={{ background: '#2b221a', color: '#efdfc8', borderColor: '#2b221a' }}
                  >
                    ＋ Nova ficha
                  </button>
                )}
                <button
                  className="hbtn ghost"
                  onClick={onClose}
                  style={{ color: '#2b221a', borderColor: '#6d5a49' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Corpo */}
            <div className="fic-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: 14 }}>
              {isEditing ? (
                <form onSubmit={handleSaveQuote} style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#4a3b2c', marginBottom: 4 }}>
                      Texto da citação:
                    </label>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      placeholder="“Digite o trecho do livro aqui...”"
                      required
                      style={{
                        width: '100%',
                        height: '100%',
                        minHeight: 180,
                        background: 'oklch(1 0 0 / 0.5)',
                        border: '1.5px dashed #8d735a',
                        borderRadius: 8,
                        padding: 12,
                        fontFamily: '"Courier New", monospace',
                        fontSize: 15,
                        lineHeight: 1.6,
                        color: '#1a1009',
                        resize: 'none',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: 13, fontWeight: 700, color: '#4a3b2c' }}>
                        Página (obrigatória):
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={editPage}
                        onChange={(e) => setEditPage(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                        placeholder="Ex: 42"
                        required
                        style={{
                          width: 80,
                          padding: '6px 8px',
                          borderRadius: 6,
                          border: '1.5px solid #8d735a',
                          background: '#fff',
                          fontWeight: 700,
                          color: '#2b221a',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      {quotes.length > 0 && (
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 6,
                            background: 'transparent',
                            border: '1px solid #6d5a49',
                            color: '#2b221a',
                            cursor: 'pointer',
                          }}
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={saving}
                        style={{
                          padding: '6px 16px',
                          borderRadius: 6,
                          background: '#2b221a',
                          color: '#efdfc8',
                          border: 'none',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {saving ? 'Gravando...' : 'Salvar Ficha'}
                      </button>
                    </div>
                  </div>
                </form>
              ) : activeQuote ? (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                  <div style={{ margin: 'auto 0', padding: '16px 20px', textAlign: 'center' }}>
                    <p
                      className="serif"
                      style={{
                        fontSize: 22,
                        fontStyle: 'italic',
                        lineHeight: 1.6,
                        color: '#2b221a',
                        margin: 0,
                      }}
                    >
                      “{activeQuote.text}”
                    </p>
                    <p style={{ marginTop: 16, fontWeight: 700, fontSize: 14, color: '#6d5a49' }}>
                      página {activeQuote.page}
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #a48c77', paddingTop: 10 }}>
                    <button
                      onClick={handleDeleteQuote}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#8b2d2d',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      🗑 Excluir
                    </button>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setReaderQuote(activeQuote)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          background: 'oklch(1 0 0 / 0.5)',
                          border: '1px solid #7d6550',
                          color: '#2b221a',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        📖 Ler página
                      </button>
                      <button
                        onClick={handleStartEdit}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 6,
                          background: '#2b221a',
                          color: '#efdfc8',
                          border: 'none',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        ✎ Editar
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ margin: 'auto', textAlign: 'center' }}>
                  <p style={{ color: '#6d5a49', fontStyle: 'italic' }}>
                    Nenhuma citação registrada para este livro.
                  </p>
                  <button
                    onClick={handleStartAdd}
                    style={{
                      marginTop: 8,
                      padding: '8px 16px',
                      borderRadius: 8,
                      background: '#2b221a',
                      color: '#efdfc8',
                      border: 'none',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ＋ Adicionar primeira citação
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Abas laterais pastel à direita */}
          {quotes.length > 0 && (
            <div className="fic-tabs" role="tablist">
              {quotes.map((q, idx) => {
                const isSelected = q.id === selectedQuoteId;
                const tabColor = getQuoteColor(idx);
                return (
                  <button
                    key={q.id}
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => {
                      setIsEditing(false);
                      setSelectedQuoteId(q.id);
                    }}
                    className={`fic-tab ${isSelected ? 'active' : ''}`}
                    style={{
                      background: tabColor,
                      color: '#2b221a',
                      borderLeft: isSelected ? 'none' : '1px solid #8d735a',
                      fontWeight: isSelected ? 800 : 600,
                    }}
                  >
                    p.{q.page}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {readerQuote && (
        <QuoteReader
          quote={readerQuote}
          bookTitle={book.title}
          isOpen={true}
          onClose={() => setReaderQuote(null)}
        />
      )}
    </>
  );
};
