import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, logout, refreshSession, setUnauthorizedHandler, tokenStore, type SessionTokens } from './api';

export interface Me {
  id: string; phone: string; full_name: string | null; plan: 'free' | 'plus'; kyc_level: number;
  referral_code: string; points: number; has_pin: boolean; wallet_balance: number; is_pro: boolean; pro_renews_at: string | null;
}

interface AuthState {
  ready: boolean;
  me: Me | null;
  signIn: (session: SessionTokens) => Promise<void>;
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
  const signOut = useCallback(async () => { await logout(); setMe(null); }, []);
  const signIn = useCallback(async (session: SessionTokens) => { await tokenStore.save(session); await refresh(); }, [refresh]);

  useEffect(() => {
    setUnauthorizedHandler(() => { void tokenStore.clear(); setMe(null); });
    (async () => {
      // Au démarrage, la session se rétablit avec le jeton de renouvellement du trousseau.
      if (await refreshSession()) await refresh();
      setReady(true);
    })();
  }, [refresh]);

  return <Ctx.Provider value={{ ready, me, signIn, signOut, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth hors AuthProvider');
  return v;
}
