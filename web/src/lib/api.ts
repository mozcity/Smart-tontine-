// Client de l'API Smart Tontine. En production, le site est servi sur le même domaine que l'API ;
// VITE_API_URL permet de l'héberger ailleurs (CDN) en pointant vers l'API.
export const API_URL: string = import.meta.env.VITE_API_URL ?? '';
const KEY = 'smarttontine_token';

export const tokenStore = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (t: string | null) => { try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch { /* navigation privée */ } },
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

let onUnauthorized: (() => void) | undefined;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', 'Connexion impossible. Vérifie ta connexion internet.');
  }
  if (res.status === 401 && token) onUnauthorized?.();
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'error', data?.message ?? 'Une erreur est survenue');
  return data as T;
}

/** Télécharge un export (CSV) protégé par la session. */
export async function download(path: string, filename: string) {
  const token = tokenStore.get();
  const res = await fetch(API_URL + path, { headers: token ? { authorization: `Bearer ${token}` } : {} });
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
