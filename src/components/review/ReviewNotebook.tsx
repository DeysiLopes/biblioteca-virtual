import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Book } from '../../core/models/book';
import { getBookFallback, getBookCover, hideTinyCover } from '../book/BookCard';
import { useSound } from '../../hooks/useSound';

export interface CoverOrigin {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ReviewNotebookProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  onSave: (bookId: string, reviewText: string) => Promise<void>;
  coverOrigin?: CoverOrigin | null;
}

export const ReviewNotebook: React.FC<ReviewNotebookProps> = ({
  book,
  isOpen,
  onClose,
  onSave,
  coverOrigin,
}) => {
  const [reviewText, setReviewText] = useState(book?.resenha || '');
  const [saving, setSaving] = useState(false);
  const [docked, setDocked] = useState(false);
  const coverRef = useRef<HTMLDivElement>(null);
  const writingRef = useRef<HTMLDivElement>(null);
  const { soundEnabled, toggleSound, playTypewriterKey } = useSound();

  useEffect(() => {
    if (book) {
      setReviewText(book.resenha || '');
    }
  }, [book]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // MVP 1: a capa "sobe" do centro da tela e encaixa acima da folha do caderno
  useLayoutEffect(() => {
    if (!coverOrigin || !coverRef.current) return;
    const el = coverRef.current;
    const target = el.getBoundingClientRect();
    el.style.setProperty('--cover-x', `${coverOrigin.left - target.left}px`);
    el.style.setProperty('--cover-y', `${coverOrigin.top - target.top}px`);
    el.style.setProperty(
      '--cover-scale',
      String(target.width ? coverOrigin.width / target.width : 1)
    );
    const schedule: (cb: () => void) => number =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb) => window.setTimeout(cb, 16);
    const cancel: (h: number) => void =
      typeof cancelAnimationFrame === 'function'
        ? cancelAnimationFrame
        : (h) => window.clearTimeout(h);
    const handle = schedule(() => setDocked(true));
    return () => cancel(handle);
  }, [coverOrigin]);

  if (!isOpen || !book) return null;

  const fb = getBookFallback(book.title);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(book.id, reviewText);
      onClose();
    } catch (err) {
      console.error('Erro ao salvar resenha:', err);
      alert('Não foi possível salvar. Sua resenha continua no caderno.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      id="caderno"
      className="open"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cad-stage">
        {/* Capa encaixada acima da folha (vem do flip 3D) */}
        {coverOrigin && (
          <div
            ref={coverRef}
            className={`flip-book cad-cover docking flipped${docked ? ' docked' : ''}`}
            aria-hidden="true"
          >
            <div className="flip-inner">
              <div
                className="flip-face front"
                style={{ '--g1': fb.g1, '--g2': fb.g2 } as React.CSSProperties}
              >
                <div className="fallback">{fb.initials}</div>
                {getBookCover(book) ? <img src={getBookCover(book)} alt="" onLoad={hideTinyCover} onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} /> : null}
              </div>
              <div className="flip-face back" />
            </div>
          </div>
        )}

        <div className="caderno">
          <h3 id="cadTitle" className="serif" style={{ fontSize: 24, margin: 0, color: '#3a2c1d' }}>
            ✍️ Resenha — {book.title}
          </h3>
          <div className="hint" id="cadHint" style={{ fontSize: 11.5, fontWeight: 600, color: '#8a7758', marginBottom: 14, paddingLeft: 24 }}>
            Sua página de caderno, uma tecla de cada vez.
          </div>

          <div className="cad-writing" ref={writingRef}>
            <textarea
              id="cadTxt"
              value={reviewText}
              aria-labelledby="cadTitle"
              aria-describedby="cadHint"
              placeholder="O que você achou deste livro?"
              onChange={(e) => {
                setReviewText(e.target.value);
                const writing = writingRef.current;
                if (writing) {
                  writing.classList.remove('typing');
                  void writing.offsetWidth;
                  writing.classList.add('typing');
                }
              }}
              onKeyDown={(e) => {
                playTypewriterKey(e.key === 'Enter');
              }}
            />
          </div>

          <div className="row" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <button
              id="cadSound"
              type="button"
              aria-pressed={soundEnabled}
              onClick={toggleSound}
              style={{
                marginRight: 'auto',
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
            <button
              id="cadCancel"
              type="button"
              className="mbtn ghost2"
              onClick={onClose}
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
              Fechar
            </button>
            <button
              id="cadSave"
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
    </div>
  );
};
