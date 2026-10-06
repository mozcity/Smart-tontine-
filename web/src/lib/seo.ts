import { useEffect } from 'react';

// Référencement des pages publiques (audit du 05/10/2026) : titre, description, URL canonique et Open Graph
// mis à jour à chaque page de l'application monopage. Les valeurs par défaut sont dans index.html.
export const SITE_URL = 'https://smarttontine.app';

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.content = content;
}

export function usePageMeta(title: string, description?: string, opts: { path?: string; noindex?: boolean } = {}) {
  useEffect(() => {
    const full = title.includes('Smart Tontine') ? title : `${title} · Smart Tontine`;
    document.title = full;
    setMeta('property', 'og:title', full);
    setMeta('name', 'twitter:title', full);
    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
      setMeta('name', 'twitter:description', description);
    }
    const url = SITE_URL + (opts.path ?? window.location.pathname);
    setMeta('property', 'og:url', url);
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = url;
    setMeta('name', 'robots', opts.noindex ? 'noindex' : 'index, follow');
  }, [title, description, opts.path, opts.noindex]);
}
