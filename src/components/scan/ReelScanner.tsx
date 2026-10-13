import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Book } from '../../core/models/book';
import { normalizeTitle } from '../../core/business/open-library';
import {
  extractFramesFromImages,
  extractFramesFromVideo,
} from '../../core/business/llm/frames';
import {
  extractBooksFromFrames,
  extractBooksFromLink,
  loadLLMConfig,
  saveLLMConfig,
  LLMConfig,
} from '../../core/business/llm/extract';
import {
  ExtractedFrame,
  LLMProvider,
  LLM_PROVIDERS,
  ScannedBook,
} from '../../core/business/llm/types';

interface Candidate extends ScannedBook {
  checked: boolean;
  duplicate: boolean;
}

interface ReelScannerProps {
  books: Book[];
  /** Recebe os livros confirmados para cadastro + enriquecimento. */
  onAdd: (candidates: ScannedBook[]) => Promise<void>;
}

type Phase =
  | 'idle'
  | 'frames'
  | 'scanning'
  | 'review'
  | 'adding'
  | 'done';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  background: 'var(--paper)',
  color: 'var(--ink)',
  border: '1px solid var(--line)',
};

const accentBtn: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 8,
  background: 'var(--accent)',
  color: '#17100f',
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
};

export const ReelScanner: React.FC<ReelScannerProps> = ({ books, onAdd }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [config, setConfig] = useState<LLMConfig>({ provider: 'gemini', apiKey: '' });
  const [showKey, setShowKey] = useState(false);
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [linkUrl, setLinkUrl] = useState('');
  const [fetchingLink, setFetchingLink] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadLLMConfig().then(setConfig).catch(() => {});
  }, []);

  const providerInfo = LLM_PROVIDERS.find((p) => p.id === config.provider)!;

  const isDuplicate = useCallback(
    (title: string) => {
      const key = normalizeTitle(title);
      return books.some((b) => normalizeTitle(b.title) === key);
    },
    [books]
  );

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = linkUrl.trim();
    if (!url || fetchingLink) return;
    setError(null);
    setNote(null);
    setFetchingLink(true);
    setPhase('scanning');
    try {
      await saveLLMConfig(config);
      const result = await extractBooksFromLink(config, url, setNote);
      setFrames(result.frames);
      setNote(result.note ?? null);
      if (!result.books.length) {
        setError('A IA não identificou nenhum livro nesse link. Tenta outro reel ou envia prints.');
        setPhase('idle');
        return;
      }
      setCandidates(
        result.books.map((b) => ({
          ...b,
          duplicate: isDuplicate(b.title),
          checked: !isDuplicate(b.title),
        }))
      );
      setPhase('review');
    } catch (err: any) {
      setError(err?.message || 'Falha ao buscar o link.');
      setPhase('idle');
    } finally {
      setFetchingLink(false);
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    setError(null);
    setNote(null);
    const list = Array.from(files);
    if (!list.length) return;
    setPhase('frames');
    try {
      const videos = list.filter((f) => f.type.startsWith('video/'));
      const images = list.filter((f) => f.type.startsWith('image/'));
      const extracted = [
        ...(videos.length ? await extractFramesFromVideo(videos[0]) : []),
        ...(images.length ? await extractFramesFromImages(images.slice(0, 6)) : []),
      ];
      if (!extracted.length) {
        setError('Não consegui extrair frames — manda um vídeo ou imagens do reel.');
        setPhase('idle');
        return;
      }
      setFrames(extracted);
      setPhase('idle');
    } catch (e: any) {
      setError(e?.message || 'Falha ao ler o arquivo.');
      setPhase('idle');
    }
  };

  const handleScan = async () => {
    if (!frames.length) return;
    setError(null);
    setPhase('scanning');
    try {
      await saveLLMConfig(config);
      const found = await extractBooksFromFrames(config, frames);
      if (!found.length) {
        setError('A IA não identificou nenhum livro nesses frames. Tenta outro trecho ou imagens mais nítidas.');
        setPhase('idle');
        return;
      }
      setCandidates(
        found.map((b) => ({
          ...b,
          duplicate: isDuplicate(b.title),
          checked: !isDuplicate(b.title),
        }))
      );
      setPhase('review');
    } catch (e: any) {
      setError(e?.message || 'Falha ao consultar o LLM.');
      setPhase('idle');
    }
  };

  const handleAdd = async () => {
    const chosen = candidates.filter((c) => c.checked && !c.duplicate);
    if (!chosen.length) return;
    setPhase('adding');
    try {
      await onAdd(chosen);
      setAddedCount(chosen.length);
      setPhase('done');
      setFrames([]);
      setCandidates([]);
    } catch {
      setError('Falha ao salvar os livros.');
      setPhase('review');
    }
  };

  const reset = () => {
    setPhase('idle');
    setFrames([]);
    setCandidates([]);
    setError(null);
    setNote(null);
    setAddedCount(0);
  };

  const checkedCount = candidates.filter((c) => c.checked && !c.duplicate).length;

  return (
    <div
      style={{
        background: 'var(--paper2)',
        padding: 20,
        borderRadius: 12,
        border: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <p style={{ margin: 0, color: 'var(--ink2)', fontSize: 14 }}>
        Cole o link de um reel/short de indicações e a IA identifica os livros
        para você revisar antes de entrarem na estante.
      </p>

      {/* Configuração do LLM */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,200px) 1fr', gap: 10 }}>
        <div>
          <label htmlFor="llmProvider" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
            LLM:
          </label>
          <select
            id="llmProvider"
            value={config.provider}
            onChange={(e) =>
              setConfig((c) => ({ ...c, provider: e.target.value as LLMProvider }))
            }
            style={inputStyle}
          >
            {LLM_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="llmKey" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
            API key{' '}
            <a
              href={providerInfo.keyUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--accent)', fontSize: 11 }}
            >
              (pegar a sua ↗)
            </a>
            :
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="llmKey"
              type={showKey ? 'text' : 'password'}
              placeholder={providerInfo.keyHint}
              value={config.apiKey}
              onChange={(e) => setConfig((c) => ({ ...c, apiKey: e.target.value }))}
              style={inputStyle}
              autoComplete="off"
            />
            <button
              type="button"
              className="pill"
              onClick={() => setShowKey((v) => !v)}
              title={showKey ? 'Esconder chave' : 'Mostrar chave'}
            >
              {showKey ? '🙈' : '👁'}
            </button>
          </div>
        </div>
      </div>
      <p style={{ margin: '-6px 0 0', fontSize: 11, color: 'var(--ink2)' }}>
        A chave fica só neste aparelho — nunca vai pro Drive nem pro JSON de sync.
      </p>

      {/* Entrada principal: link do reel */}
      <form onSubmit={handleLink} style={{ display: 'flex', gap: 8 }}>
        <input
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="https://www.instagram.com/reel/..."
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          type="submit"
          style={accentBtn}
          disabled={fetchingLink || !linkUrl.trim()}
        >
          {fetchingLink ? '⏳ Analisando...' : '🎬 Escanear reel'}
        </button>
      </form>
      <p style={{ margin: '-8px 0 0', fontSize: 11, color: 'var(--ink2)' }}>
        Instagram reel/post e YouTube short. O link precisa ser público.
      </p>

      {/* Alternativa: upload de vídeo ou prints */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInput.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && fileInput.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        style={{
          border: '1px dashed var(--line)',
          borderRadius: 10,
          padding: '12px 14px',
          textAlign: 'center',
          color: 'var(--ink2)',
          fontSize: 13,
          cursor: 'pointer',
          background: 'oklch(0 0 0 / .12)',
        }}
      >
        {phase === 'frames'
          ? '⏳ Extraindo frames do vídeo...'
          : frames.length
            ? `🎞️ ${frames.length} frame(s) prontos — clique para trocar`
            : 'ou envie o vídeo/prints direto (o link falhou? usa isso)'}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="video/*,image/*"
        multiple
        hidden
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {note && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--accent)' }}>⚠️ {note}</p>
      )}

      {/* Prévia dos frames */}
      {frames.length > 0 && phase !== 'done' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {frames.map((f, i) => (
            <img
              key={i}
              src={f.dataUrl}
              alt={f.timeSec != null ? `${f.timeSec.toFixed(1)}s` : `frame ${i + 1}`}
              title={f.timeSec != null ? `${f.timeSec.toFixed(1)}s` : undefined}
              style={{
                width: 54,
                height: 96,
                objectFit: 'cover',
                borderRadius: 6,
                border: '1px solid var(--line)',
              }}
            />
          ))}
        </div>
      )}

      {frames.length > 0 && (phase === 'idle' || phase === 'frames' || phase === 'scanning') && (
        <div>
          <button
            type="button"
            style={accentBtn}
            onClick={handleScan}
            disabled={phase === 'scanning' || !config.apiKey.trim()}
            title={!config.apiKey.trim() ? 'Configure a API key primeiro' : undefined}
          >
            {phase === 'scanning' ? '⏳ A IA está olhando os frames...' : '🔍 Identificar livros'}
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            background: 'oklch(0.24 0.04 40 / 0.8)',
            border: '1px solid var(--accent)',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* Revisão dos candidatos */}
      {(phase === 'review' || phase === 'adding') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <strong style={{ fontSize: 14 }}>
            {candidates.length} livro(s) identificado(s) — revise antes de adicionar:
          </strong>
          {candidates.map((c, i) => (
            <label
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                background: 'oklch(0 0 0 / .2)',
                opacity: c.duplicate ? 0.55 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={c.checked && !c.duplicate}
                disabled={c.duplicate}
                onChange={(e) =>
                  setCandidates((prev) =>
                    prev.map((p, j) => (j === i ? { ...p, checked: e.target.checked } : p))
                  )
                }
              />
              <span style={{ flex: 1 }}>
                {c.title}
                {c.author ? ` — ${c.author}` : ''}
                {c.uncertain && <em style={{ color: 'var(--ink2)' }}> (incerto)</em>}
              </span>
              {c.duplicate && (
                <span style={{ fontSize: 11, color: 'var(--accent)' }}>já na biblioteca</span>
              )}
            </label>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              style={accentBtn}
              onClick={handleAdd}
              disabled={!checkedCount || phase === 'adding'}
            >
              {phase === 'adding'
                ? '⏳ Adicionando...'
                : `➕ Adicionar ${checkedCount} livro(s) à estante`}
            </button>
            <button type="button" className="pill" onClick={reset}>
              Descartar
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>✨ {addedCount} livro(s) adicionado(s)! Capas e ISBNs são buscados em segundo plano.</span>
          <button type="button" className="pill" onClick={reset}>
            Escanear outro
          </button>
        </div>
      )}
    </div>
  );
};
