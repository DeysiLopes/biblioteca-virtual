import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <h2 className="serif" style={{ fontSize: 36, color: 'var(--ink)' }}>
        Página não encontrada
      </h2>
      <p style={{ color: 'var(--ink2)', margin: '14px 0 24px', fontSize: 16 }}>
        O endereço que você tentou acessar não existe na biblioteca.
      </p>
      <Link
        to="/"
        className="hbtn"
        style={{
          display: 'inline-flex',
          background: 'var(--accent)',
          color: '#17100f',
          fontWeight: 700,
          padding: '10px 20px',
        }}
      >
        Voltar ao Início
      </Link>
    </div>
  );
};
