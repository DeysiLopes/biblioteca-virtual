import React, { useEffect, useState } from 'react';
import { syncManager } from '../../core/storage/sync-manager';

interface PromptRequest {
  localCount: number;
  resolve: (choice: 'wipe' | 'merge') => void;
}

/**
 * No primeiro sync após o login, se já existirem livros locais, pergunta:
 * limpar tudo e usar só o Drive, ou mesclar local + Drive sem duplicar.
 */
export const SyncPrompt: React.FC = () => {
  const [request, setRequest] = useState<PromptRequest | null>(null);

  useEffect(() => {
    syncManager.setFirstSyncPrompt(
      (localCount) =>
        new Promise<'wipe' | 'merge'>((resolve) => {
          setRequest({ localCount, resolve });
        })
    );
    return () => syncManager.setFirstSyncPrompt(null);
  }, []);

  if (!request) return null;

  const choose = (choice: 'wipe' | 'merge') => {
    request.resolve(choice);
    setRequest(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="syncPromptTitle"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 95,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'oklch(0.18 0.03 320 / .55)',
        backdropFilter: 'blur(5px)',
      }}
    >
      <div
        style={{
          background: 'var(--paper2)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          padding: '22px 20px',
          maxWidth: 420,
          width: '100%',
          boxShadow: 'var(--shadow)',
        }}
      >
        <h2 id="syncPromptTitle" className="serif" style={{ fontSize: 22, margin: '0 0 8px', color: 'var(--ink)' }}>
          ☁️ Conta conectada!
        </h2>
        <p style={{ margin: '0 0 6px', fontSize: 13.5, color: 'var(--ink2)', lineHeight: 1.5 }}>
          Encontramos <strong style={{ color: 'var(--ink)' }}>{request.localCount} livros</strong> salvos
          neste aparelho. Como quer sincronizar com o Google Drive?
        </p>

        <button
          onClick={() => choose('merge')}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            marginTop: 14,
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid var(--green)',
            background: 'oklch(0.6 0.12 150 / .15)',
            color: 'var(--ink)',
            cursor: 'pointer',
          }}
        >
          <strong style={{ display: 'block', fontSize: 14 }}>🔀 Mesclar com o Drive</strong>
          <span style={{ fontSize: 12, color: 'var(--ink2)' }}>
            Mantém os livros daqui e une com os do Drive sem duplicar.
          </span>
        </button>

        <button
          onClick={() => choose('wipe')}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            marginTop: 10,
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid oklch(0.65 0.14 30 / .5)',
            background: 'oklch(0.55 0.14 25 / .12)',
            color: 'var(--ink)',
            cursor: 'pointer',
          }}
        >
          <strong style={{ display: 'block', fontSize: 14 }}>🧹 Limpar e baixar do Drive</strong>
          <span style={{ fontSize: 12, color: 'var(--ink2)' }}>
            Apaga os dados locais deste aparelho e usa só o que está no Drive.
          </span>
        </button>
      </div>
    </div>
  );
};
