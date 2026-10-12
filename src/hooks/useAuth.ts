import { useState, useEffect } from 'react';
import { authService, AuthState } from '../core/auth/google-auth';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(authService.getAuthState());

  useEffect(() => {
    const unsubscribe = authService.subscribe((state) => {
      setAuthState(state);
    });
    return unsubscribe;
  }, []);

  return {
    ...authState,
    login: () => authService.login(),
    logout: () => authService.logout(),
  };
}
