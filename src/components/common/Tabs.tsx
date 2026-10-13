import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

export const Tabs: React.FC = () => {
  const location = useLocation();

  const isShelfActive = location.pathname === '/' || location.pathname === '/estante';
  const isDiaryActive = location.pathname === '/diario' || location.pathname === '/dashboard';

  return (
    <nav className="tabs" aria-label="Navegação principal">
      <NavLink
        to="/estante"
        className={isShelfActive ? 'active' : ''}
      >
        <span>📚 Estante</span>
      </NavLink>

      <NavLink
        to="/diario"
        className={isDiaryActive ? 'active' : ''}
      >
        <span>📖 Diário</span>
      </NavLink>

      <NavLink
        to="/books"
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        <span>＋ Adicionar</span>
      </NavLink>

      <NavLink
        to="/citacoes"
        className={({ isActive }) => (isActive ? 'active' : '')}
      >
        <span>💬 Citações</span>
      </NavLink>
    </nav>
  );
};
