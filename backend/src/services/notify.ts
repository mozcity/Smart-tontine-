import type { Db } from '../db.js';

/** Notification in-app (et, en production, push Expo / FCM). */
export async function notify(db: Db, userId: string, title: string, body: string) {
  await db.query('INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)', [userId, title, body]);
}

/** Événement analytique : alimente le CRM, la segmentation et l'entonnoir marketing. */
export async function track(db: Db, userId: string | null, name: string, props: Record<string, unknown> = {}) {
  await db.query('INSERT INTO user_events (user_id, name, props) VALUES ($1, $2, $3)', [userId, name, props]);
}
