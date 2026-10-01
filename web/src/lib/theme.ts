// Thème clair / sombre : suit le système par défaut, mémorisé si l'utilisateur choisit.
export type ThemeChoice = 'light' | 'dark' | 'system';
const KEY = 'smarttontine_theme';

export function getThemeChoice(): ThemeChoice {
  try { return (localStorage.getItem(KEY) as ThemeChoice) ?? 'system'; } catch { return 'system'; }
}

export function applyTheme(choice: ThemeChoice = getThemeChoice()) {
  const dark = choice === 'dark' || (choice === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0D0E1A' : '#2F2C8F');
}

export function setThemeChoice(choice: ThemeChoice) {
  try { localStorage.setItem(KEY, choice); } catch { /* navigation privée */ }
  applyTheme(choice);
}

export function watchSystemTheme() {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (getThemeChoice() === 'system') applyTheme('system'); });
}
