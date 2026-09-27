import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from './api';

export interface Me {
  id: string; phone: string; full_name: string | null; plan: 'free' | 'plus'; kyc_level: number;
  referral_code: string; points: number; has_pin: boolean; wallet_balance: number;
}

interface AuthState {
  ready: boolean;
  me: Me | null;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  const refresh = useCallback(async () => {
    try { setMe(await api<Me>('/auth/me')); } catch { setMe(null); }
  }, []);
  const signOut = useCallback(async () => { await tokenStore.set(null); setMe(null); }, []);
  const signIn = useCallback(async (token: string) => { await tokenStore.set(token); await refresh(); }, [refresh]);

  useEffect(() => {
    setUnauthorizedHandler(() => { void signOut(); });
    (async () => {
      if (await tokenStore.get()) await refresh();
      setReady(true);
    })();
  }, [refresh, signOut]);

  return <Ctx.Provider value={{ ready, me, signIn, signOut, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth hors AuthProvider');
  return v;
}
