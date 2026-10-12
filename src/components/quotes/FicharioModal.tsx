import React, { useState, useEffect, useRef } from 'react';
import { Book, Citacao } from '../../core/models/book';
import {
  getQuoteColor,
  saveQuoteToBook,
  deleteQuoteFromBook,
} from '../../core/business/quotes';
import { QuoteReader } from './QuoteReader';
import { useSound } from '../../hooks/useSound';

interface FicharioModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  onSaveBook: (updatedBook: Book) => Promise<void>;
}

interface TurningPage {
  quote: Citacao;
  color: string;
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
  const [turning, setTurning] = useState<TurningPage | null>(null);
  const turnTimer = useRef<number>(0);
  const writeRef = useRef<HTMLTextAreaElement>(null);
  const { soundEnabled, toggleSound, playTypewriterKey } = useSound();

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

  useEffect(() => {
    return () => window.clearTimeout(turnTimer.current);
  }, []);

  if (!isOpen || !book) return null;

  const activeIndex = quotes.findIndex(q => q.id === selectedQuoteId);
  const activeQuote = activeIndex >= 0 ? quotes[activeIndex] : null;
  // Ficha nova já veste a cor pastel que a aba dela vai receber ao salvar
  const paperColor =
    activeIndex >= 0 ? getQuoteColor(activeIndex) : getQuoteColor(quotes.length);

  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // A ficha exibida vira sobre as argolas, revelando a próxima folha
  const triggerTurn = () => {
    if (!activeQuote || isEditing || reducedMotion) return;
    setTurning({ quote: activeQuote, color: paperColor });
    window.clearTimeout(turnTimer.current);
    turnTimer.current = window.setTimeout(() => setTurning(null), 800);
  };

  const handleSelectQuote = (q: Citacao) => {
    if (q.id === selectedQuoteId && !isEditing) return;
    triggerTurn();
    setIsEditing(false);
    setSelectedQuoteId(q.id);
  };

  const handleStartAdd = () => {
    triggerTurn();
    setIsEditing(true);
    setSelectedQuoteId(null);
    setEditText('');
    setEditPage('');
  };

  const handleStartEdit = () => {
    if (!activeQuote) return;
    triggerTurn();
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
      triggerTurn();
      const updatedBook = deleteQuoteFromBook(book, activeQuote.id);
      await onSaveBook(updatedBook);
      setSelectedQuoteId(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir citação.');
    } finally {
      setSaving(false);
    }
  };

  const handleTyping = (value: string) => {
    setEditText(value);
    const el = writeRef.current;
    if (el) {
      el.classList.remove('typing');
      void el.offsetWidth;
      el.classList.add('typing');
    }
  };

  return (
    <>
      <div
        id="fichario"
        className="open focused"
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
              <i /><i /><i /><i /><i /><i />
            </div>

            {/* Cabeçalho */}
            <div className="fic-head">
              <h2 className="serif">{book.title}</h2>
              <div className="fic-toolbar">
                {!isEditing && (
                  <button className="mbtn primary" onClick={handleStartAdd}>
                    ＋ Nova ficha
                  </button>
                )}
                <button className="mbtn ghost2" onClick={onClose} aria-label="Fechar fichário">
                  ✕
                </button>
              </div>
            </div>
            <div className="sub">Fichário de citações — folheie pelas abas coloridas</div>

            {/* Corpo — key remonta a folha para a animação de entrada */}
            <div className="fic-body" key={isEditing ? `edit-${selectedQuoteId ?? 'new'}` : (selectedQuoteId ?? 'empty')}>
              {isEditing ? (
                <form className="cform" onSubmit={handleSaveQuote}>
                  <textarea
                    ref={writeRef}
                    value={editText}
                    onChange={(e) => handleTyping(e.target.value)}
                    onKeyDown={(e) => playTypewriterKey(e.key === 'Enter')}
                    placeholder="“Digite o trecho do livro aqui...”"
                    required
                    aria-label="Texto da citação"
                  />
                  <div className="row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto auto' }}>
                    <label className="pgwrap">
                      Página (obrigatória)
                      <input
                        type="number"
                        min={1}
                        value={editPage}
                        onChange={(e) => setEditPage(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                        placeholder="Ex: 42"
                        required
                      />
                    </label>
                    <button
                      type="button"
                      className="mbtn ghost2"
                      aria-pressed={soundEnabled}
                      onClick={toggleSound}
                    >
                      Som: {soundEnabled ? 'ligado' : 'desligado'}
                    </button>
                    {quotes.length > 0 && (
                      <button type="button" className="mbtn ghost2" onClick={handleCancelEdit}>
                        Cancelar
                      </button>
                    )}
                    <button type="submit" className="mbtn primary" disabled={saving}>
                      {saving ? 'Gravando...' : 'Salvar Ficha'}
                    </button>
                  </div>
                </form>
              ) : activeQuote ? (
                <div className="fic-view">
                  <div className="fic-quote">
                    <span className="fic-quote-text">{activeQuote.text}</span>
                  </div>
                  <div className="fic-page-number">página {activeQuote.page}</div>
                  <div className="fic-actions">
                    <button className="mbtn ghost2" onClick={handleDeleteQuote}>
                      🗑 Excluir
                    </button>
                    <span style={{ flex: 1 }} />
                    <button className="mbtn ghost2" onClick={() => setReaderQuote(activeQuote)}>
                      📖 Ler página
                    </button>
                    <button className="mbtn primary" onClick={handleStartEdit}>
                      ✎ Editar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="fic-empty">
                  <p>Nenhuma citação registrada para este livro.</p>
                  <button className="mbtn primary" onClick={handleStartAdd}>
                    ＋ Adicionar primeira citação
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Folha virando sobre as argolas (mostra a ficha anterior) */}
          {turning && (
            <div
              className="fic-leaf"
              aria-hidden="true"
              onAnimationEnd={() => setTurning(null)}
            >
              <div className="fic-leaf-face front" style={{ background: turning.color }}>
                <div className="fic-leaf-quote">
                  “{turning.quote.text}”
                  <span className="fic-leaf-pg">página {turning.quote.page}</span>
                </div>
              </div>
              <div className="fic-leaf-face back" style={{ background: turning.color }} />
            </div>
          )}

          {/* Abas laterais pastel à direita */}
          {quotes.length > 0 && (
            <div className="fic-tabs" role="tablist">
              {quotes.map((q, idx) => {
                const isSelected = q.id === selectedQuoteId;
                return (
                  <button
                    key={q.id}
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => handleSelectQuote(q)}
                    className={`fic-tab ${isSelected ? 'active' : ''}`}
                    style={{
                      background: getQuoteColor(idx),
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
