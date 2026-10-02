import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// En développement, les appels à l'API sont relayés vers http://localhost:4000 (même origine côté navigateur).
const API = process.env.API_URL ?? 'http://localhost:4000';
const apiPrefixes = ['/auth', '/wallet', '/tontines', '/credit', '/partners', '/goods', '/cagnottes', '/me', '/public', '/pricing', '/health'];

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(apiPrefixes.map((p) => [p, { target: API, changeOrigin: true,
      // Ne pas relayer la navigation du navigateur (routes de l'application web) vers l'API.
      bypass: (req: { headers: Record<string, string | string[] | undefined> }) => (String(req.headers.accept ?? '').includes('text/html') ? '/index.html' : undefined) }])),
  },
  // « hidden » : cartes générées pour le suivi d'erreurs, mais jamais référencées par les fichiers servis.
  build: { sourcemap: 'hidden', chunkSizeWarningLimit: 400 },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
});
