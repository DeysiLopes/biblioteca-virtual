import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLibrary } from '../../hooks/useLibrary';
import { syncManager } from '../../core/storage/sync-manager';
import { showToast } from '../../core/business/share';

export const Header: React.FC = () => {
  const { isAuthenticated, user, login, logout, isMock } = useAuth();
  const { exportBackup } = useLibrary();

  const handleWipeLocal = async () => {
    const ok = window.confirm(
      'Apagar TODOS os livros, histórico e dados salvos NESTE aparelho?\n\n' +
        (isAuthenticated
          ? 'Como você está conectada, a biblioteca será baixada do Google Drive em seguida.'
          : 'Você NÃO está conectada ao Drive — os dados serão perdidos de vez.\n\nIsso não pode ser desfeito.')
    );
    if (!ok) return;
    try {
      await syncManager.resetLocalData();
      if (isAuthenticated) {
        await syncManager.pullFromDriveQuietly();
        showToast('Dados locais limpos — biblioteca baixada do Drive ✨');
      } else {
        showToast('Dados locais apagados.');
      }
    } catch (e) {
      console.error('Falha ao limpar dados locais:', e);
      showToast('Não foi possível limpar os dados.');
    }
  };

  const handleReminder = async () => {
    if (!('Notification' in window)) {
      alert('Seu navegador não suporta notificações.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      alert('Lembrete diário ativado para as 20:00!');
    } else {
      alert('Permissão para notificações não foi concedida.');
    }
  };

  return (
    <header>
      <img className="logo" src="icon-192.png" alt="Minha Biblioteca" />
      <h1>
        Minha Biblioteca <small>estante · diário · avisos · {__BUILD_STAMP__}</small>
      </h1>
      <div className="actions">
        <button
          className="hbtn ghost"
          onClick={exportBackup}
          title="Baixar backup JSON do Google Drive"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Backup</span>
        </button>

        <button className="hbtn ghost" onClick={handleReminder} title="Lembrete diário">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span>Lembrete</span>
        </button>

        <button
          className="hbtn ghost"
          onClick={handleWipeLocal}
          title="Apagar todos os dados locais deste aparelho"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span>Limpar</span>
        </button>

        {isAuthenticated ? (
          <button
            className="hbtn"
            onClick={logout}
            title={`Conectado como ${user?.name || user?.email} (clique para sair)`}
            style={{ borderColor: 'var(--green)' }}
          >
            {user?.picture ? (
              <img
                src={user.picture}
                alt=""
                style={{ width: 18, height: 18, borderRadius: '50%' }}
              />
            ) : (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--green)',
                  display: 'inline-block',
                }}
              />
            )}
            <span>{isMock ? 'Dev (Drive)' : user?.name?.split(' ')[0] || 'Conectado'}</span>
          </button>
        ) : (
          <button
            className="hbtn"
            onClick={login}
            title="Conectar com Google Drive"
            style={{ background: 'var(--accent)', color: '#17100f', border: 'none' }}
          >
            <span>Conectar Drive</span>
          </button>
        )}
      </div>
    </header>
  );
};
