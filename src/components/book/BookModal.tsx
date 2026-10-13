import React, { useState, useEffect, useRef } from 'react';
import { Book, BookStatus } from '../../core/models/book';
import { calculatePercentage, applyBookProgressUpdate } from '../../core/business/progress';
import { getBookFallback, hideTinyCover } from './BookCard';
import { useBookCoverUrl } from '../../hooks/useBookCoverUrl';
import { topQueuePosition } from '../../core/business/queue';
import { shareBook, showToast } from '../../core/business/share';

interface BookModalProps {
  book: Book;
  allBooks: Book[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedBook: Book, newDiaryEntry?: any) => Promise<void>;
  onSelectBook: (bookId: string) => void;
  sourceRect?: DOMRect | null;
}

interface RectBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Posição final da capa "voadora" (mesma matemática do MVP 1):
// desktop → ao lado esquerdo do painel; mobile → acima da folha inferior.
function computeFlyTarget(rect: DOMRect | null | undefined): RectBox {
  const iw = window.innerWidth;
  const ih = window.innerHeight;
  const isMobile = iw < 760;
  const ar = rect && rect.height > 0 ? Math.min(0.78, Math.max(0.5, rect.width / rect.height)) : 0.66;
  let tw: number, th: number, left: number, top: number;
  if (isMobile) {
    const sheetH = Math.min(ih, Math.max(Math.round(ih * 0.62), 380));
    const sheetTop = ih - sheetH;
    const availH = Math.max(110, sheetTop - 20);
    th = Math.min(availH, 430);
    tw = th * ar;
    const maxW = iw - 32;
    if (tw > maxW) {
      tw = maxW;
      th = tw / ar;
    }
    left = (iw - tw) / 2;
    top = Math.max(8, (sheetTop - th) / 2);
  } else {
    const panelW = Math.min(560, iw);
    const availW = Math.max(120, iw - panelW - 48);
    th = Math.min(Math.round(ih * 0.82), 640, ih - 40);
    tw = th * ar;
    if (tw > availW) {
      tw = availW;
      th = tw / ar;
    }
    left = Math.max(18, (iw - panelW - tw) / 2);
    top = (ih - th) / 2;
  }
  return { left, top, width: tw, height: th };
}

const toRectBox = (r: DOMRect | null | undefined, fallback: RectBox): RectBox =>
  r && r.width > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : fallback;

export const BookModal: React.FC<BookModalProps> = ({
  book,
  allBooks,
  isOpen,
  onClose,
  onSave,
  onSelectBook,
  sourceRect,
}) => {
  const [paginasLidas, setPaginasLidas] = useState<number>(book.paginasLidas || 0);
  const [totalPaginas, setTotalPaginas] = useState<number>(book.paginas || 0);
  const [status, setStatus] = useState<BookStatus>(book.status || 'Quero ler');
  const [tipo, setTipo] = useState<string>(book.tipo || '');
  const [inicio, setInicio] = useState<string>(book.inicio || '');
  const [fim, setFim] = useState<string>(book.fim || '');
  const [comentarios, setComentarios] = useState<string>(book.comentarios || '');
  const [nota, setNota] = useState<number>(book.nota || 0);
  const [queueTop, setQueueTop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [landed, setLanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (book) {
      setPaginasLidas(book.paginasLidas || 0);
      setTotalPaginas(book.paginas || 0);
      setStatus(book.status || 'Quero ler');
      setTipo(book.tipo || '');
      setInicio(book.inicio || '');
      setFim(book.fim || '');
      setComentarios(book.comentarios || '');
      setNota(book.nota || 0);
      setQueueTop(false);
    }
  }, [book]);

  // Trava o scroll da página e faz a capa "pousar" após o primeiro paint
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setLanded(true)));
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = '';
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const handleClose = () => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = setTimeout(onClose, sourceRect ? 540 : 200);
  };
  const handleCloseRef = useRef(handleClose);
  handleCloseRef.current = handleClose;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen || !book) return null;

  const target = computeFlyTarget(sourceRect);
  const flyPos = closing
    ? toRectBox(sourceRect, target)
    : landed
      ? target
      : toRectBox(sourceRect, target);

  const perc = calculatePercentage(paginasLidas, totalPaginas);
  const fb = getBookFallback(book.title);
  const coverUrl = useBookCoverUrl(book);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { updatedBook, newDiaryEntry } = applyBookProgressUpdate(
        book,
        paginasLidas,
        totalPaginas || null,
        status,
        tipo || null,
        inicio || null,
        fim || null,
        comentarios
      );
      updatedBook.nota = nota;
      // Fila "Quero ler": marcado como próximo vai pro topo; fora do status, sai da fila
      if (status === 'Quero ler') {
        updatedBook.filaPosicao = queueTop
          ? topQueuePosition(allBooks.filter((b) => b.id !== book.id))
          : book.filaPosicao ?? null;
      } else {
        updatedBook.filaPosicao = null;
      }
      await onSave(updatedBook, newDiaryEntry);
      handleClose();
    } catch (err) {
      console.error('Erro ao salvar livro:', err);
      alert('Erro ao salvar o livro.');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    const result = await shareBook(book);
    if (result === 'copied') showToast('Resumo do livro copiado! Cole onde quiser ✨');
    else if (result === 'failed') showToast('Não foi possível compartilhar agora.');
  };

  return (
    <div
      id="modal"
      className="open"
      role="dialog"
      aria-modal="true"
      aria-labelledby="panelTitle"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Capa que "voa" da estante até o lado do painel (MVP 1) */}
      <div
        className="fly-cover"
        aria-hidden="true"
        style={{
          left: flyPos.left,
          top: flyPos.top,
          width: flyPos.width,
          height: flyPos.height,
          transition: landed || closing ? undefined : 'none',
        }}
      >
        {coverUrl && (
          <img src={coverUrl} alt={book.title} onLoad={hideTinyCover} onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
        )}
        <div
          className="fallback"
          style={{
            ['--g1' as string]: fb.g1,
            ['--g2' as string]: fb.g2,
            ...(coverUrl ? { zIndex: -1 } : {}),
          }}
        >
          {fb.initials}
        </div>
      </div>

      <div className="panel" id="panel" style={closing ? { opacity: 0, transition: 'none' } : undefined}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h2 id="panelTitle" className="serif" style={{ fontSize: 26, margin: 0, color: 'var(--ink)' }}>
              {book.title}
            </h2>
            {book.author && (
              <p style={{ margin: '4px 0 0', color: 'var(--ink2)', fontSize: 14 }}>
                {book.author}
              </p>
            )}
          </div>
          <button
            className="hbtn ghost"
            onClick={handleClose}
            aria-label="Fechar modal"
            style={{ padding: '6px 10px', fontSize: 16 }}
          >
            ✕
          </button>
        </div>

        {/* Trocar de livro */}
        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="bId">Trocar de livro:</label>
          <select
            id="bId"
            value={book.id}
            onChange={(e) => onSelectBook(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: 'var(--paper2)', color: 'var(--ink)', border: '1px solid var(--line)' }}
          >
            {allBooks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} {b.author ? `— ${b.author}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Status e Tipo */}
        <div className="row2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div className="field">
            <label htmlFor="bStatus">Status:</label>
            <select
              id="bStatus"
              value={status}
              onChange={(e) => setStatus(e.target.value as BookStatus)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: 'var(--paper2)', color: 'var(--ink)', border: '1px solid var(--line)' }}
            >
              <option value="Quero ler">Quero ler</option>
              <option value="Lendo">Lendo</option>
              <option value="Lido">Lido</option>
              <option value="Abandonado">Abandonado</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="bTipo">Tipo:</label>
            <select
              id="bTipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: 'var(--paper2)', color: 'var(--ink)', border: '1px solid var(--line)' }}
            >
              <option value="">(nenhum)</option>
              <option value="Lazer">Lazer</option>
              <option value="Estudo">Estudo</option>
            </select>
          </div>
        </div>

        {/* Na fila "Quero ler" dá para marcá-lo como o próximo a subir
            (equivale a arrastar para o início da prateleira, útil no toque) */}
        {status === 'Quero ler' && (
          <button
            type="button"
            className={`pill ${queueTop ? 'on' : ''}`}
            style={{ marginTop: 10 }}
            onClick={() => setQueueTop((v) => !v)}
          >
            📌 {queueTop ? 'Será o próximo da fila' : 'Colocar no topo da fila'}
          </button>
        )}

        {/* Progresso Dinâmico */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink2)', marginBottom: 4 }}>
            <span>Progresso da leitura</span>
            <strong style={{ color: 'var(--accent)' }}>{perc}%</strong>
          </div>
          <div
            className="pp"
            role="progressbar"
            aria-valuenow={perc}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ width: '100%', height: 10, borderRadius: 5, background: 'oklch(0 0 0 / 0.4)', overflow: 'hidden' }}
          >
            <div
              style={{
                width: `${perc}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--green), var(--accent))',
                transition: 'width 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </div>
        </div>

        {/* Inputs de Páginas Lidas e Total */}
        <div className="row2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
          <div className="field">
            <label htmlFor="bPagesLidas">Páginas lidas (total atual):</label>
            <input
              id="bPagesLidas"
              type="number"
              min={0}
              value={paginasLidas}
              onChange={(e) => setPaginasLidas(Math.max(0, parseInt(e.target.value, 10) || 0))}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: 'var(--paper2)', color: 'var(--ink)', border: '1px solid var(--line)' }}
            />
          </div>

          <div className="field">
            <label htmlFor="bTotal">Total de páginas:</label>
            <input
              id="bTotal"
              type="number"
              min={0}
              value={totalPaginas}
              onChange={(e) => setTotalPaginas(Math.max(0, parseInt(e.target.value, 10) || 0))}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: 'var(--paper2)', color: 'var(--ink)', border: '1px solid var(--line)' }}
            />
          </div>
        </div>

        {/* Datas Início e Fim */}
        <div className="row2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div className="field">
            <label htmlFor="bInicio">Data de início:</label>
            <input
              id="bInicio"
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: 'var(--paper2)', color: 'var(--ink)', border: '1px solid var(--line)' }}
            />
          </div>

          <div className="field">
            <label htmlFor="bFim">Data de término:</label>
            <input
              id="bFim"
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: 'var(--paper2)', color: 'var(--ink)', border: '1px solid var(--line)' }}
            />
          </div>
        </div>

        {/* Nota em estrelas */}
        <div className="field" style={{ marginTop: 12 }}>
          <label>Sua nota:</label>
          <div className="stars" role="radiogroup" aria-label="Nota de 0 a 5 estrelas">
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                role="radio"
                aria-checked={nota === i}
                className={i <= nota ? 'on' : ''}
                onClick={() => setNota(i === nota ? 0 : i)}
              >
                ★
              </span>
            ))}
          </div>
        </div>

        {/* Comentários */}
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="bComent">Anotações / Comentários:</label>
          <textarea
            id="bComent"
            rows={3}
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: 'var(--paper2)', color: 'var(--ink)', border: '1px solid var(--line)', resize: 'vertical' }}
          />
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button
            className="mbtn"
            onClick={handleShare}
            title="Compartilhar dados, resenha e citações deste livro"
            style={{ marginRight: 'auto', padding: '8px 14px', borderRadius: 8, background: 'var(--paper2)', color: 'var(--accent)', border: '1px solid var(--line)', fontWeight: 700, cursor: 'pointer' }}
          >
            📤 Compartilhar
          </button>
          <button
            className="mbtn"
            onClick={handleClose}
            style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--paper2)', color: 'var(--ink)', border: '1px solid var(--line)', cursor: 'pointer' }}
          >
            Fechar
          </button>
          <button
            className="mbtn primary"
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 20px', borderRadius: 8, background: 'var(--green)', color: '#0f1a12', border: 'none', fontWeight: 700, cursor: 'pointer' }}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};
