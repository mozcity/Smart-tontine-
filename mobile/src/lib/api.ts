import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Adresse de l'API : EXPO_PUBLIC_API_URL (fixée par profil dans eas.json), sinon extra.apiUrl de app.json.
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL
  ?? (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? 'http://localhost:4000';
const KEY = 'smarttontine_token';

// Le jeton de session est stocké dans le trousseau sécurisé (Keychain / Keystore).
export const tokenStore = {
  async get() {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
    return SecureStore.getItemAsync(KEY);
  },
  async set(token: string | null) {
    if (Platform.OS === 'web') {
      if (token) globalThis.localStorage?.setItem(KEY, token); else globalThis.localStorage?.removeItem(KEY);
      return;
    }
    if (token) await SecureStore.setItemAsync(KEY, token); else await SecureStore.deleteItemAsync(KEY);
  },
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

let onUnauthorized: (() => void) | undefined;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await tokenStore.get();
  const res = await fetch(API_URL + path, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401 && token) onUnauthorized?.();
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? 'Une erreur est survenue');
  return data as T;
}
