export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: GoogleUser | null;
  accessToken: string | null;
  expiresAt: number | null;
  isMock: boolean;
}

type AuthListener = (state: AuthState) => void;

class GoogleAuthService {
  private state: AuthState = {
    isAuthenticated: false,
    user: null,
    accessToken: null,
    expiresAt: null,
    isMock: false,
  };

  private listeners: Set<AuthListener> = new Set();
  private tokenClient: any = null;

  constructor() {
    this.initFromStorage();
  }

  private initFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const savedUser = sessionStorage.getItem('bib_user');
      const savedToken = sessionStorage.getItem('bib_token');
      const savedExp = sessionStorage.getItem('bib_exp');
      if (savedUser && savedToken && savedExp) {
        const expiresAt = parseInt(savedExp, 10);
        if (Date.now() < expiresAt) {
          this.state = {
            isAuthenticated: true,
            user: JSON.parse(savedUser),
            accessToken: savedToken,
            expiresAt,
            isMock: sessionStorage.getItem('bib_mock') === 'true',
          };
        }
      }
    } catch {
      // ignora sessionStorage indisponível
    }
  }

  public getAuthState(): AuthState {
    return { ...this.state };
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    listener(this.getAuthState());
    return () => this.listeners.delete(listener);
  }

  private updateState(newState: Partial<AuthState>) {
    this.state = { ...this.state, ...newState };
    if (typeof window !== 'undefined') {
      try {
        if (this.state.isAuthenticated && this.state.user) {
          sessionStorage.setItem('bib_user', JSON.stringify(this.state.user));
          if (this.state.accessToken) sessionStorage.setItem('bib_token', this.state.accessToken);
          if (this.state.expiresAt) sessionStorage.setItem('bib_exp', String(this.state.expiresAt));
          sessionStorage.setItem('bib_mock', String(this.state.isMock));
        } else {
          sessionStorage.removeItem('bib_user');
          sessionStorage.removeItem('bib_token');
          sessionStorage.removeItem('bib_exp');
          sessionStorage.removeItem('bib_mock');
        }
      } catch {
        // storage quota
      }
    }
    this.listeners.forEach((l) => l(this.getAuthState()));
  }

  public async login(): Promise<boolean> {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    // Se não tiver clientId configurado ainda, entra no modo mock local transparente
    if (!clientId) {
      console.info('VITE_GOOGLE_CLIENT_ID não configurado. Entrando em modo Mock Auth.');
      this.updateState({
        isAuthenticated: true,
        user: {
          id: 'user_local_dev',
          email: 'leitor@biblioteca.local',
          name: 'Leitor Local',
        },
        accessToken: 'mock_token_dev',
        expiresAt: Date.now() + 3600 * 1000 * 24, // 24h
        isMock: true,
      });
      return true;
    }

    return new Promise((resolve) => {
      const google = (window as any).google;
      if (!google || !google.accounts || !google.accounts.oauth2) {
        console.error('Google Identity Services script não carregado.');
        resolve(false);
        return;
      }

      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile https://www.googleapis.com/auth/drive.file',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            console.error('Erro na autenticação Google:', tokenResponse.error);
            resolve(false);
            return;
          }

          const accessToken = tokenResponse.access_token;
          const expiresIn = parseInt(tokenResponse.expires_in, 10) || 3600;
          const expiresAt = Date.now() + expiresIn * 1000;

          // Obter dados básicos do perfil via userinfo
          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (userRes.ok) {
              const userData = await userRes.json();
              this.updateState({
                isAuthenticated: true,
                user: {
                  id: userData.sub,
                  email: userData.email,
                  name: userData.name || userData.email,
                  picture: userData.picture,
                },
                accessToken,
                expiresAt,
                isMock: false,
              });
              resolve(true);
              return;
            }
          } catch (err) {
            console.warn('Erro ao obter perfil do usuário:', err);
          }

          this.updateState({
            isAuthenticated: true,
            user: { id: 'unknown_sub', email: 'usuario@google.com', name: 'Usuário' },
            accessToken,
            expiresAt,
            isMock: false,
          });
          resolve(true);
        },
      });

      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  public logout(): void {
    const token = this.state.accessToken;
    if (token && !this.state.isMock && (window as any).google?.accounts?.oauth2?.revoke) {
      try {
        (window as any).google.accounts.oauth2.revoke(token, () => {});
      } catch {
        // revoke error
      }
    }
    this.updateState({
      isAuthenticated: false,
      user: null,
      accessToken: null,
      expiresAt: null,
      isMock: false,
    });
  }

  public isTokenExpired(): boolean {
    if (!this.state.expiresAt) return true;
    return Date.now() > this.state.expiresAt - 60000; // 1 min buffer
  }
}

export const authService = new GoogleAuthService();
