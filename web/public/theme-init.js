// Thème appliqué avant l'affichage : pas d'éclair blanc en mode sombre.
try {
  var t = localStorage.getItem('smarttontine_theme') || 'system';
  document.documentElement.dataset.theme = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
} catch (e) {}
