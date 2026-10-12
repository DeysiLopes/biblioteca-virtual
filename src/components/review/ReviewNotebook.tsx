import React, { useState, useEffect } from 'react';
import { Book } from '../../core/models/book';
import { useSound } from '../../hooks/useSound';

interface ReviewNotebookProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  onSave: (bookId: string, reviewText: string) => Promise<void>;
}

export const ReviewNotebook: React.FC<ReviewNotebookProps> = ({
  book,
  isOpen,
  onClose,
  onSave,
}) => {
  const [reviewText, setReviewText] = useState(book?.resenha || '');
  const [saving, setSaving] = useState(false);
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

  if (!isOpen || !book) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(book.id, reviewText);
      onClose();
    } catch (err) {
      console.error('Erro ao salvar resenha:', err);
      alert('Erro ao salvar resenha.');
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
        <div className="caderno">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 id="cadTitle" className="serif" style={{ fontSize: 24, margin: 0, color: '#2b221a' }}>
              ✍️ Resenha — {book.title}
            </h3>
            <button
              className="hbtn ghost"
              onClick={onClose}
              style={{ color: '#2b221a', borderColor: '#2b221a' }}
            >
              ✕
            </button>
          </div>

          <div className="cad-writing">
            <textarea
              id="cadTxt"
              value={reviewText}
              placeholder="Escreva aqui suas reflexões, aprendizados e notas sobre a obra..."
              onChange={(e) => {
                setReviewText(e.target.value);
              }}
              onKeyDown={(e) => {
                playTypewriterKey(e.key === 'Enter');
              }}
              style={{
                width: '100%',
                height: 320,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: 15,
                lineHeight: '28px',
                color: '#1a1009',
                resize: 'none',
              }}
            />
          </div>

          <div className="row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
            <button
              id="cadSound"
              type="button"
              onClick={toggleSound}
              style={{
                background: soundEnabled ? 'var(--green)' : 'oklch(0 0 0 / 0.1)',
                color: soundEnabled ? '#fff' : '#2b221a',
                border: 'none',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🔊 Som de máquina: {soundEnabled ? 'Ligado' : 'Desligado'}
            </button>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                id="cadCancel"
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid #7a5b41',
                  color: '#2b221a',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                id="cadSave"
                type="button"
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
                {saving ? 'Gravando...' : 'Salvar no Caderno'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
