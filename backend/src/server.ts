import { config } from './config.js';
import { createApp } from './app.js';
import { migrate } from './migrate.js';
import { runJobs } from './jobs.js';

await migrate();
createApp().listen(config.port, () => {
  console.log(`Smart Tontine API sur http://localhost:${config.port} — back-office : http://localhost:${config.port}/admin`);
});

// Tâches planifiées (tours échus, prélèvements, rappels, licences…). Avec plusieurs instances de l'API,
// une seule doit les exécuter : RUN_JOBS=false sur les autres (voir docs/10).
if (process.env.RUN_JOBS !== 'false') {
  const HOUR = 60 * 60 * 1000;
  setInterval(() => { runJobs().catch((err) => console.error('Jobs en erreur', err)); }, HOUR);
}
