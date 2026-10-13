import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    /** beforeinstallprompt capturado pelo script inline do index.html */
    __bip?: BeforeInstallPromptEvent | null;
  }
}

function isStandalone(): boolean {
  return (
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function isIOSSafari(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(navigator.userAgent.includes('CriOS') || navigator.userAgent.includes('FxiOS'))
  );
}

/**
 * Captura o `beforeinstallprompt` para oferecer instalação dentro do app.
 * Chrome/Edge/Android disparam o evento quando o PWA é instalável;
 * iOS/Safari não dispara — aí o botão mostra instruções manuais.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    () => window.__bip ?? null
  );
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      window.__bip = e as BeforeInstallPromptEvent;
      setDeferred(e as BeforeInstallPromptEvent);
    };
    // o script inline já capturou o evento antes do React montar
    const onReady = () => setDeferred(window.__bip ?? null);
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('bip-ready', onReady);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('bip-ready', onReady);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferred) {
      // iOS: o único caminho é o menu de compartilhamento do Safari
      alert(
        'Para instalar no iPhone/iPad:\n\n' +
          '1. Toque no botão Compartilhar do Safari\n' +
          '2. Escolha "Adicionar à Tela de Início"\n' +
          '3. O app abre em tela cheia com o ícone do fantasminha 👻'
      );
      return;
    }
    await deferred.prompt();
    const choice = await deferred.userChoice.catch(() => null);
    if (choice?.outcome === 'accepted') setDeferred(null);
  };

  // mostra o botão quando o browser oferece o prompt, ou em iOS não instalado
  const canShow = !installed && (!!deferred || isIOSSafari());
  return { canShow, promptInstall };
}
