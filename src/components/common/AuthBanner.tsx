import React from 'react';
import { useAuth } from '../../hooks/useAuth';

export const AuthBanner: React.FC = () => {
  const { isAuthenticated, login } = useAuth();

  if (isAuthenticated) return null;

  return (
    <div
      style={{
        background: 'oklch(0.28 0.06 40 / 0.85)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: '10px 16px',
        margin: '12px 18px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: 13,
        color: 'var(--ink)',
      }}
    >
      <div>
        <strong>Modo Leitura Local:</strong> Conecte sua conta Google para sincronizar e salvar no seu Google Drive.
      </div>
      <button
        onClick={login}
        style={{
          background: 'var(--accent)',
          color: '#17100f',
          border: 'none',
          borderRadius: 8,
          padding: '6px 12px',
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Conectar Google
      </button>
    </div>
  );
};
