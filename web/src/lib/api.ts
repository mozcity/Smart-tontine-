// Client de l'API Smart Tontine. En production, le site est servi sur le même domaine que l'API ;
// VITE_API_URL permet de l'héberger ailleurs (CDN) en pointant vers l'API.
export const API_URL: string = import.meta.env.VITE_API_URL ?? '';
// Sessions (audit du 05/10/2026) : le jeton d'accès (30 min) reste en mémoire, jamais dans localStorage.
// Le jeton de renouvellement est un cookie HttpOnly posé par l'API : le JavaScript ne peut pas le lire.
let accessToken: string | null = null;
try { localStorage.removeItem('smarttontine_token'); } catch { /* ancien stockage, à effacer */ }

export const tokenStore = {
  get: () => accessToken,
  set: (t: string | null) => { accessToken = t; if (t) hint.set(true); },
};

const sessionHeaders = { 'content-type': 'application/json', 'x-client': 'web' };
let refreshing: Promise<boolean> | null = null;

/** Demande un nouveau jeton d'accès grâce au cookie de renouvellement. Une seule demande à la fois. */
// Simple indicateur (aucun secret) : évite d'appeler /auth/refresh — et d'obtenir un 401 — pour un visiteur anonyme.
const HINT = 'smarttontine_session';
const hint = { get: () => { try { return localStorage.getItem(HINT) === '1'; } catch { return true; } },
  set: (on: boolean) => { try { if (on) localStorage.setItem(HINT, '1'); else localStorage.removeItem(HINT); } catch { /* */ } } };

export function refreshSession(): Promise<boolean> {
  if (!hint.get()) return Promise.resolve(false);
  refreshing ??= (async () => {
    try {
      const res = await fetch(API_URL + '/auth/refresh', { method: 'POST', headers: sessionHeaders, credentials: 'include', body: '{}' });
      if (!res.ok) { accessToken = null; if (res.status === 401) hint.set(false); return false; }
      accessToken = ((await res.json()) as { token: string }).token;
      return true;
    } catch { return false; } finally { setTimeout(() => { refreshing = null; }, 0); }
  })();
  return refreshing;
}

export async function logout() {
  accessToken = null;
  hint.set(false);
  await fetch(API_URL + '/auth/logout', { method: 'POST', headers: sessionHeaders, credentials: 'include', body: '{}' }).catch(() => undefined);
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

let onUnauthorized: (() => void) | undefined;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}, retried = false): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: { ...sessionHeaders, ...(token ? { authorization: `Bearer ${token}` } : {}) },
      credentials: 'include',
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', 'Connexion impossible. Vérifie ta connexion internet.');
  }
  // Jeton d'accès expiré : on le renouvelle une fois, puis on rejoue la requête.
  if (res.status === 401 && token && !retried && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api<T>(path, opts, true);
  }
  if (res.status === 401 && token) onUnauthorized?.();
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? 'Une erreur est survenue');
  return data as T;
}

/** Télécharge un export (CSV) protégé par la session. */
export async function download(path: string, filename: string) {
  if (!tokenStore.get()) await refreshSession();
  let res = await fetch(API_URL + path, { headers: { authorization: `Bearer ${tokenStore.get()}` } });
  if (res.status === 401 && await refreshSession()) res = await fetch(API_URL + path, { headers: { authorization: `Bearer ${tokenStore.get()}` } });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? 'Export impossible');
  }
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
