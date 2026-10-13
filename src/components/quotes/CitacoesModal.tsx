import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Book, Citacao } from '../../core/models/book';
import { saveQuoteToBook, deleteQuoteFromBook } from '../../core/business/quotes';
import { useSound } from '../../hooks/useSound';

interface CitacoesModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  onSaveBook: (updatedBook: Book) => Promise<void>;
}

type Mode = 'read' | 'edit';
type TurnDir = 'fwd' | 'back';

// Página de leitura é a cara principal: a citação ocupa a folha,
// as setas folheiam na ordem das páginas do livro e as ferramentas
// ficam discretas no canto inferior esquerdo.
export const CitacoesModal: React.FC<CitacoesModalProps> = ({
  book,
  isOpen,
  onClose,
  onSaveBook,
}) => {
  const quotes = useMemo(
    () =>
      (Array.isArray(book?.citacoes) ? [...book.citacoes] : []).sort(
        (a, b) => (a.page || 0) - (b.page || 0)
      ),
    [book]
  );

  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>('read');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editPage, setEditPage] = useState<number | ''>('');
  const [dir, setDir] = useState<TurnDir>('fwd');
  const [outgoing, setOutgoing] = useState<Citacao | null>(null);
  const [turning, setTurning] = useState(false);
  const turnTimer = useRef<number>(0);
  const [saving, setSaving] = useState(false);
  const writingRef = useRef<HTMLDivElement>(null);
  const { soundEnabled, toggleSound, playTypewriterKey, playPageTurn } = useSound();

  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Livro trocou com o modal aberto ("trocar de livro" futuro ou sync)
  useEffect(() => {
    setIndex(0);
    setMode('read');
    setEditingId(null);
    setOutgoing(null);
    setTurning(false);
  }, [book.id]);

  useEffect(() => () => window.clearTimeout(turnTimer.current), []);

  const current = quotes.length ? quotes[Math.min(index, quotes.length - 1)] : null;

  // Cascata do MVP 1: a folha atual vira pra esquerda (avançar) ou
  // folhas retornam da esquerda cobrindo a página (voltar)
  const go = (delta: 1 | -1) => {
    const next = index + delta;
    if (next < 0 || next >= quotes.length || !current) return;
    const d: TurnDir = delta > 0 ? 'fwd' : 'back';
    setDir(d);
    window.clearTimeout(turnTimer.current);
    if (reducedMotion) {
      setIndex(next);
      return;
    }
    setOutgoing(current);
    setTurning(true);
    playPageTurn();
    setIndex(next);
    turnTimer.current = window.setTimeout(() => {
      setOutgoing(null);
      setTurning(false);
    }, 950);
  };

  const startEdit = (q: Citacao) => {
    setEditingId(q.id);
    setEditText(q.text);
    setEditPage(q.page);
    setMode('edit');
  };

  const startNew = () => {
    setEditingId(null);
    setEditText('');
    setEditPage('');
    setMode('edit');
  };

  const cancelEdit = () => {
    setMode('read');
    setEditingId(null);
  };

  const handleSave = async () => {
    const text = editText.trim();
    if (!text) {
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
      const updated = saveQuoteToBook(book, { text, page: pageNum }, editingId || undefined);
      await onSaveBook(updated);
      const sorted = [...(updated.citacoes || [])].sort((a, b) => (a.page || 0) - (b.page || 0));
      const savedId = editingId || updated.citacoes?.[updated.citacoes.length - 1]?.id;
      const pos = sorted.findIndex((q) => q.id === savedId);
      setIndex(pos >= 0 ? pos : 0);
      setOutgoing(null);
      setTurning(false);
      cancelEdit();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar citação.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!current) return;
    const ok = window.confirm(`Deseja realmente excluir a citação da página ${current.page}?`);
    if (!ok) return;

    setSaving(true);
    try {
      const updated = deleteQuoteFromBook(book, current.id);
      await onSaveBook(updated);
      const remaining = (updated.citacoes || []).length;
      setIndex((i) => Math.min(i, Math.max(0, remaining - 1)));
      setOutgoing(null);
      setTurning(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir citação.');
    } finally {
      setSaving(false);
    }
  };

  const handleTyping = (value: string) => {
    setEditText(value);
    const el = writingRef.current;
    if (el) {
      el.classList.remove('typing');
      void el.offsetWidth;
      el.classList.add('typing');
    }
  };

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const stateRef = useRef({ mode, count: quotes.length });
  stateRef.current = { mode, count: quotes.length };
  // Listener de teclado vive uma vez só — sempre chama o `go` da render atual
  const goLatest = useRef<(d: 1 | -1) => void>(() => {});
  goLatest.current = go;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      const s = stateRef.current;
      if (e.key === 'Escape') {
        if (s.mode === 'edit' && s.count > 0) setMode('read');
        else closeRef.current();
      } else if (s.mode === 'read') {
        if (e.key === 'ArrowRight') goLatest.current(1);
        if (e.key === 'ArrowLeft') goLatest.current(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen || !book) return null;

  const renderPage = (q: Citacao) => (
    <>
      <div className="page-mark">{book.title}</div>
      <div className="quote">
        <p className="quote-text serif">{q.text}</p>
      </div>
      <div className="pnum">pág. {q.page}</div>
    </>
  );

  return (
    <div
      id="citacoes"
      className="open"
      role="dialog"
      aria-modal="true"
      aria-label={`Citações de ${book.title}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (mode === 'edit' && quotes.length > 0) cancelEdit();
          else onClose();
        }
      }}
    >
      <button
        className="xclose"
        onClick={() => (mode === 'edit' && quotes.length > 0 ? cancelEdit() : onClose())}
        aria-label={mode === 'edit' ? 'Voltar para a leitura' : 'Fechar citações'}
      >
        ✕
      </button>

      {mode === 'edit' ? (
        /* Cara da edição idêntica ao caderno de resenha, som incluído */
        <div className="cad-stage">
          <div className="caderno">
            <h3 className="serif" id="citTitle" style={{ fontSize: 24, margin: 0, color: '#3a2c1d' }}>
              ✍️ {editingId ? 'Editar citação' : 'Nova citação'} — {book.title}
            </h3>
            <div
              className="hint"
              style={{ fontSize: 11.5, fontWeight: 600, color: '#8a7758', marginBottom: 14, paddingLeft: 24 }}
            >
              Anote o trecho que marcou você e a página onde ele mora.
            </div>

            <div className="cad-writing" ref={writingRef}>
              <textarea
                value={editText}
                aria-labelledby="citTitle"
                placeholder="Digite o trecho do livro aqui..."
                onChange={(e) => handleTyping(e.target.value)}
                onKeyDown={(e) => playTypewriterKey(e.key === 'Enter')}
              />
            </div>

            <div
              className="row"
              style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 14 }}
            >
              <button
                id="citSound"
                type="button"
                aria-pressed={soundEnabled}
                onClick={toggleSound}
                style={{
                  background: soundEnabled ? 'var(--green)' : '#e8dcc4',
                  color: soundEnabled ? '#fff' : '#725c3f',
                  border: '1px solid #c8b797',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Som: {soundEnabled ? 'ligado' : 'desligado'}
              </button>
              <label className="cit-pg">
                Página
                <input
                  type="number"
                  min={1}
                  value={editPage}
                  aria-label="Página da citação"
                  onChange={(e) =>
                    setEditPage(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                  }
                  placeholder="42"
                />
              </label>
              <span style={{ flex: 1 }} />
              {quotes.length > 0 && (
                <button
                  type="button"
                  className="mbtn ghost2"
                  onClick={cancelEdit}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: '#e8dcc4',
                    border: '1px solid #c8b797',
                    color: '#725c3f',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              )}
              <button
                type="button"
                className="mbtn primary"
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  background: '#2b221a',
                  color: '#efdfc8',
                  border: 'none',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {saving ? 'Gravando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={`cit-book${turning && dir === 'back' ? ' back' : ''}`}>
          {/* Avançar: a folha atual vira pra esquerda como página de livro */}
          {outgoing && turning && dir === 'fwd' && (
            <div className="pagina cit-out" aria-hidden="true">
              {renderPage(outgoing)}
            </div>
          )}
          {/* Voltar: a página antiga fica parada por baixo e é coberta pelas folhas que retornam */}
          {outgoing && turning && dir === 'back' && (
            <div className="pagina cit-still" aria-hidden="true">
              {renderPage(outgoing)}
            </div>
          )}

          {/* Página atual entrando */}
          <div className={`pagina cit-in cit-in-${dir}`} key={current?.id ?? 'empty'}>
            {current ? (
              <>
                {renderPage(current)}
                <div className="cit-tools">
                  <button onClick={() => startEdit(current)} aria-label="Editar citação" title="Editar">
                    ✎
                  </button>
                  <button onClick={startNew} aria-label="Nova citação" title="Nova citação">
                    ＋
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    aria-label="Excluir citação"
                    title="Excluir"
                  >
                    🗑
                  </button>
                  <button
                    onClick={toggleSound}
                    aria-pressed={soundEnabled}
                    aria-label={soundEnabled ? 'Desligar sons' : 'Ligar sons'}
                    title={soundEnabled ? 'Som ligado' : 'Som desligado'}
                  >
                    {soundEnabled ? '🔊' : '🔇'}
                  </button>
                </div>
                <div className="cit-count">
                  {index + 1} de {quotes.length}
                </div>
              </>
            ) : (
              <>
                <div className="page-mark">{book.title}</div>
                <div className="cit-empty">
                  <p className="serif">Este livro ainda não tem citações.</p>
                  <button className="mbtn primary" onClick={startNew}>
                    ＋ Escrever a primeira citação
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Cascata de folhas passando — como no MVP 1:
              avançar → 2 folhas em branco viram pra esquerda atrás da página;
              voltar → folhas em branco retornam da esquerda antes da página pousar */}
          {turning && dir === 'fwd' && (
            <>
              <i className="cit-leaf" style={{ '--delay': '0.14s' } as React.CSSProperties} />
              <i className="cit-leaf" style={{ '--delay': '0.28s' } as React.CSSProperties} />
            </>
          )}
          {turning && dir === 'back' && (
            <>
              <i className="cit-leaf" style={{ '--delay': '0s' } as React.CSSProperties} />
              <i className="cit-leaf" style={{ '--delay': '0.12s' } as React.CSSProperties} />
            </>
          )}

          {quotes.length > 1 && (
            <>
              <button
                className="cit-nav prev"
                onClick={() => go(-1)}
                disabled={index === 0}
                aria-label="Citação anterior"
              >
                ‹
              </button>
              <button
                className="cit-nav next"
                onClick={() => go(1)}
                disabled={index === quotes.length - 1}
                aria-label="Próxima citação"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
