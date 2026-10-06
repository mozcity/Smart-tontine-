import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Adresse de l'API : EXPO_PUBLIC_API_URL (fixée par profil dans eas.json), sinon extra.apiUrl de app.json.
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL
  ?? (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? 'http://localhost:4000';
// Sessions (audit du 05/10/2026) : jeton d'accès de 30 min en mémoire ; jeton de renouvellement dans le
// trousseau sécurisé (Keychain / Keystore), remplacé à chaque renouvellement.
const REFRESH_KEY = 'smarttontine_refresh';
let accessToken: string | null = null;

const secure = {
  async get(key: string) {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string | null) {
    if (Platform.OS === 'web') {
      if (value) globalThis.localStorage?.setItem(key, value); else globalThis.localStorage?.removeItem(key);
      return;
    }
    if (value) await SecureStore.setItemAsync(key, value); else await SecureStore.deleteItemAsync(key);
  },
};

export interface SessionTokens { token: string; refreshToken?: string }

export const tokenStore = {
  get: async () => accessToken,
  /** Enregistre une session rendue par l'API (connexion, renouvellement, « déconnecter les autres appareils »). */
  async save(s: SessionTokens) {
    accessToken = s.token;
    if (s.refreshToken) await secure.set(REFRESH_KEY, s.refreshToken);
  },
  async clear() {
    accessToken = null;
    await secure.set(REFRESH_KEY, null);
    await secure.set('smarttontine_token', null); // ancien stockage (avant les sessions courtes)
  },
  hasRefresh: async () => !!(await secure.get(REFRESH_KEY)),
};

let refreshing: Promise<boolean> | null = null;
/** Nouveau jeton d'accès à partir du jeton de renouvellement. Une seule demande à la fois. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const refreshToken = await secure.get(REFRESH_KEY);
      if (!refreshToken) return false;
      const res = await fetch(API_URL + '/auth/refresh', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) { if (res.status === 401) await tokenStore.clear(); return false; }
      await tokenStore.save(await res.json());
      return true;
    } catch { return false; } finally { setTimeout(() => { refreshing = null; }, 0); }
  })();
  return refreshing;
}

export async function logout() {
  const refreshToken = await secure.get(REFRESH_KEY);
  await tokenStore.clear();
  if (refreshToken) {
    await fetch(API_URL + '/auth/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken }) }).catch(() => undefined);
  }
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

let onUnauthorized: (() => void) | undefined;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}, retried = false): Promise<T> {
  const token = await tokenStore.get();
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: opts.method ?? (opts.body ? 'POST' : 'GET'),
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    // Pas de réseau, serveur injoignable ou adresse introuvable : jamais le message technique brut d'Android ou d'iOS.
    throw new ApiError(0, 'network', 'Connexion au service impossible. Vérifie ta connexion internet puis réessaie.');
  }
  // Jeton d'accès expiré : renouvelé une fois, puis la requête est rejouée.
  if (res.status === 401 && token && !retried && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api<T>(path, opts, true);
  }
  if (res.status === 401 && token) onUnauthorized?.();
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? 'Une erreur est survenue');
  return data as T;
}
