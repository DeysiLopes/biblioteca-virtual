import React, { useState, useEffect, useRef } from 'react';
import { Book } from '../../core/models/book';
import { getBookFallback, getBookCover, hideTinyCover } from './BookCard';

interface FlipBookProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  onOpenNotebook: (book: Book) => void;
}

export const FlipBook: React.FC<FlipBookProps> = ({
  book,
  isOpen,
  onClose,
  onOpenNotebook,
}) => {
  const [flipped, setFlipped] = useState(false);
  const [ready, setReady] = useState(false);
  const [revealSpoilers, setRevealSpoilers] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Blindagem: CSS velho, falha de carregamento ou extensão de navegador não pode
  // deixar a capa cobrir a tela — a geometria crítica é reforçada com !important
  useEffect(() => {
    if (!isOpen) return;
    const fv = overlayRef.current;
    if (!fv) return;
    const imp = (el: HTMLElement, p: string, v: string) =>
      el.style.setProperty(p, v, 'important');
    imp(fv, 'position', 'fixed');
    imp(fv, 'inset', '0');
    imp(fv, 'z-index', '88');
    imp(fv, 'display', 'flex');
    imp(fv, 'align-items', 'center');
    imp(fv, 'justify-content', 'center');
    const bookEl = fv.querySelector<HTMLElement>('.flip-book');
    if (bookEl) {
      imp(bookEl, 'width', 'min(70vw,300px)');
      imp(bookEl, 'height', 'min(72vh,450px)');
      imp(bookEl, 'max-width', '300px');
      imp(bookEl, 'max-height', '450px');
      imp(bookEl, 'flex-shrink', '0');
    }
    const innerEl = fv.querySelector<HTMLElement>('.flip-inner');
    if (innerEl) {
      imp(innerEl, 'position', 'relative');
      imp(innerEl, 'width', '100%');
      imp(innerEl, 'height', '100%');
      imp(innerEl, 'transform-style', 'preserve-3d');
    }
    fv.querySelectorAll<HTMLElement>('.flip-face').forEach((f) => {
      imp(f, 'position', 'absolute');
      imp(f, 'inset', '0');
      imp(f, 'backface-visibility', 'hidden');
    });
    // Se nem o !important resolveu (ex.: extensão agressiva), fecha p/ não travar
    const t = setTimeout(() => {
      const w = bookEl?.getBoundingClientRect().width ?? 0;
      if (w > 420) {
        console.error(
          '[bib] contracapa irrecuperável — fechando overlay para não travar a tela.',
          { width: w, sheets: document.styleSheets.length }
        );
        onClose();
      }
    }, 400);
    return () => clearTimeout(t);
  }, [isOpen, onClose]);

  // MVP 1: a capa aparece de frente e vira sozinha após 260ms para a contracapa
  useEffect(() => {
    if (!isOpen || flipped) return;
    const timer = setTimeout(() => setFlipped(true), 260);
    return () => clearTimeout(timer);
  }, [isOpen, flipped]);

  // A contracapa só fica interativa ("ready") quando o giro termina
  useEffect(() => {
    if (!isOpen || !flipped || ready) return;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => setReady(true), reduced ? 0 : 820);
    return () => clearTimeout(timer);
  }, [isOpen, flipped, ready]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !book) return null;

  const fb = getBookFallback(book.title);

  // Clique na capa: vira para a contracapa; na contracapa pronta: abre o caderno
  const handleBookActivate = () => {
    if (ready) {
      onOpenNotebook(book);
    } else {
      setFlipped(true);
    }
  };

  const resenha = (book.resenha || '').trim();

  return (
    <div
      id="flipview"
      ref={overlayRef}
      className="open"
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 88,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        className="xclose"
        onClick={onClose}
        aria-label="Fechar contracapa e voltar ao diário"
        title="Fechar (Esc)"
        style={{
          position: 'absolute',
          top: 20,
          right: 24,
          background: 'oklch(0 0 0 / 0.55)',
          color: '#efdfc8',
          border: '1px solid var(--line)',
          borderRadius: '50%',
          width: 40,
          height: 40,
          fontSize: 18,
          cursor: 'pointer',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px oklch(0 0 0 / 0.6)',
          transition: 'transform 0.2s ease',
        }}
      >
        ✕
      </button>

      <div
        className={`flip-book ${flipped ? 'flipped' : ''}`}
        tabIndex={0}
        role="button"
        aria-label="Capa do livro em 3D. Pressione Enter ou clique para virar."
        style={{
          width: 'min(70vw,300px)',
          height: 'min(72vh,450px)',
          maxWidth: 300,
          maxHeight: 450,
          flexShrink: 0,
        }}
        onClick={handleBookActivate}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleBookActivate();
          }
        }}
      >
        <div
          className="flip-inner"
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            transformStyle: 'preserve-3d',
            transition: 'transform .8s cubic-bezier(.5,.05,.3,1)',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Face frontal: Capa */}
          <div
            className="flip-face front"
            style={
              {
                '--g1': fb.g1,
                '--g2': fb.g2,
                position: 'absolute',
                inset: 0,
                backfaceVisibility: 'hidden',
                background: `linear-gradient(150deg, ${fb.g1}, ${fb.g2})`,
              } as React.CSSProperties
            }
          >
            <div className="fallback">{fb.initials}</div>
            {getBookCover(book) ? (
              <img
                src={getBookCover(book)}
                alt={book.title}
                onLoad={hideTinyCover}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : null}
          </div>

          {/* Face traseira: Contracapa / Resenha */}
          <div
            className="flip-face back"
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span className="blab">Contracapa</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                aria-label="Fechar contracapa"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--ink2)',
                  fontSize: 18,
                  cursor: 'pointer',
                  padding: '2px 6px',
                }}
              >
                ✕
              </button>
            </div>
            <h3 className="serif" style={{ fontSize: 20, margin: '8px 0 4px', color: 'var(--ink)' }}>
              {book.title}
            </h3>
            {book.author && (
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ink2)' }}>
                {book.author}
              </p>
            )}

            {resenha && (
              <span
                className="spoiler-tag"
                style={{
                  display: 'inline-block',
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: '.04em',
                  padding: '3px 9px',
                  borderRadius: 999,
                  marginBottom: 6,
                  background: book.resenhaSpoilers ? 'oklch(0.68 0.16 45 / .2)' : 'oklch(0.6 0.12 150 / .18)',
                  color: book.resenhaSpoilers ? '#f4b860' : '#8fd4a8',
                  border: `1px solid ${book.resenhaSpoilers ? 'oklch(0.68 0.16 45 / .45)' : 'oklch(0.6 0.12 150 / .35)'}`,
                }}
              >
                {book.resenhaSpoilers ? '⚠️ contém spoilers' : '✓ sem spoilers'}
              </span>
            )}
            <div
              className={`rv ${resenha ? '' : 'empty'}`}
              style={
                book.resenhaSpoilers && resenha && !revealSpoilers
                  ? { filter: 'blur(5px)', userSelect: 'none' }
                  : undefined
              }
            >
              {resenha || 'Sem resenha ainda — toque para escrever no caderno.'}
            </div>
            {book.resenhaSpoilers && resenha && !revealSpoilers ? (
              <button
                type="button"
                className="hint"
                onClick={(e) => {
                  e.stopPropagation();
                  setRevealSpoilers(true);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                spoilers — tocar para revelar 👁
              </button>
            ) : (
              <div className="hint">toque para escrever no caderno ✍️</div>
            )}

            <button
              className="edit-review mbtn primary"
              disabled={!ready}
              onClick={(e) => {
                e.stopPropagation();
                if (ready) onOpenNotebook(book);
              }}
              style={{
                marginTop: 10,
                padding: '8px 14px',
                borderRadius: 8,
                background: 'var(--accent)',
                color: '#17100f',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              ✍️ {resenha ? 'Editar resenha' : 'Escrever resenha'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
