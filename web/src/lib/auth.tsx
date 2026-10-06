import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, logout, refreshSession, setUnauthorizedHandler, tokenStore } from './api';

export interface Me {
  id: string; phone: string; full_name: string | null; email: string | null; role: 'customer' | 'support' | 'admin';
  kyc_level: number; plan: string; referral_code: string; points: number; has_pin: boolean; is_pro: boolean;
  pro_renews_at: string | null; wallet_balance: number;
}

interface AuthCtx {
  me: Me | null; ready: boolean;
  signIn: (token: string) => Promise<void>; signOut: () => void; refresh: () => Promise<void>;
}
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const signOut = useCallback(() => { void logout(); setMe(null); }, []);
  const refresh = useCallback(async () => {
    // Au chargement, la session se rétablit grâce au cookie de renouvellement (aucun jeton n'est stocké en clair).
    if (!tokenStore.get() && !(await refreshSession())) { setMe(null); return; }
    try { setMe(await api<Me>('/auth/me')); } catch { setMe(null); }
  }, []);
  const signIn = useCallback(async (token: string) => { tokenStore.set(token); await refresh(); }, [refresh]);
  useEffect(() => { setUnauthorizedHandler(() => { tokenStore.set(null); setMe(null); }); void refresh().finally(() => setReady(true)); }, [refresh]);
  return <Ctx.Provider value={{ me, ready, signIn, signOut, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('AuthProvider manquant');
  return c;
}
