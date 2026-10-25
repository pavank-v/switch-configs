import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, setUnauthenticatedHandler, tokenStore } from '@/lib/api';

export interface Account {
  id: number;
  login: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  imageUrl: string | null;
  activated: boolean;
  langKey: string;
  authorities: string[];
}

export interface RegisterPayload {
  login: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

interface AuthContextValue {
  account: Account | null;
  /** True until the initial session probe settles, so routes don't flash the login screen. */
  initialising: boolean;
  login: (username: string, password: string, rememberMe: boolean) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  setAccount: (account: Account) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [initialising, setInitialising] = useState(true);

  const fetchAccount = useCallback(async () => {
    const { data } = await api.get<Account>('/api/account');
    setAccount(data);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setAccount(null);
  }, []);

  // Drop the session when the server rejects our token mid-flight.
  useEffect(() => {
    setUnauthenticatedHandler(() => setAccount(null));
  }, []);

  // Probe for an existing session on first mount.
  useEffect(() => {
    let cancelled = false;

    if (!tokenStore.get()) {
      setInitialising(false);
      return;
    }

    fetchAccount()
      .catch(() => {
        tokenStore.clear();
        if (!cancelled) {
          setAccount(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setInitialising(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchAccount]);

  const login = useCallback(
    async (username: string, password: string, rememberMe: boolean) => {
      const { data } = await api.post<{ id_token: string }>('/api/authenticate', {
        username,
        password,
        rememberMe,
      });
      // Read the body rather than the Authorization response header: the body is always
      // readable, whereas the header depends on CORS `exposed-headers` when the client
      // is not served through the dev proxy.
      tokenStore.set(data.id_token, rememberMe);
      await fetchAccount();
    },
    [fetchAccount],
  );

  const register = useCallback(async (payload: RegisterPayload) => {
    await api.post('/api/register', { ...payload, langKey: 'en' });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ account, initialising, login, register, logout, refresh: fetchAccount, setAccount }),
    [account, initialising, login, register, logout, fetchAccount],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}

export function displayName(account: Account): string {
  const full = [account.firstName, account.lastName].filter(Boolean).join(' ').trim();
  return full || account.login;
}

export function initials(account: Account): string {
  const first = account.firstName?.trim()?.[0];
  const last = account.lastName?.trim()?.[0];
  if (first && last) {
    return (first + last).toUpperCase();
  }
  return account.login.slice(0, 2).toUpperCase();
}
