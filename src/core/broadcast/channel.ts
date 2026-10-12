export type SyncBroadcastMessage =
  | { type: 'LIBRARY_UPDATED'; timestamp: number }
  | { type: 'AUTH_STATE_CHANGED'; timestamp: number };

type Listener = (msg: SyncBroadcastMessage) => void;

class LibraryBroadcastChannel {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<Listener> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('biblioteca-sync');
        this.channel.onmessage = (event) => {
          this.notify(event.data);
        };
      } catch (err) {
        console.warn('BroadcastChannel não suportado, usando storage fallback:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === 'bib-sync-event' && event.newValue) {
          try {
            const data = JSON.parse(event.newValue);
            this.notify(data);
          } catch {
            // ignora erro no parse do fallback
          }
        }
      });
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public broadcast(msg: SyncBroadcastMessage): void {
    if (this.channel) {
      this.channel.postMessage(msg);
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('bib-sync-event', JSON.stringify(msg));
      } catch {
        // quota ou private mode
      }
    }
  }

  private notify(msg: SyncBroadcastMessage): void {
    this.listeners.forEach((listener) => {
      try {
        listener(msg);
      } catch (err) {
        console.error('Erro no broadcast listener:', err);
      }
    });
  }
}

export const syncChannel = new LibraryBroadcastChannel();
