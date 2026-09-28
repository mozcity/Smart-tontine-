import { config } from './config.js';
import { createApp } from './app.js';
import { migrate } from './migrate.js';
import { runJobs } from './jobs.js';

await migrate();
createApp().listen(config.port, () => {
  console.log(`Smart Tontine API sur http://localhost:${config.port} — back-office : http://localhost:${config.port}/admin`);
});

const HOUR = 60 * 60 * 1000;
setInterval(() => { runJobs().catch((err) => console.error('Jobs en erreur', err)); }, HOUR);
