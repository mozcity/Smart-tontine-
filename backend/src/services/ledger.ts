import type pg from 'pg';
import { badRequest, conflict } from '../lib/errors.js';
import { reference as makeReference } from '../lib/crypto.js';
import { one, type Db } from '../db.js';

export interface Leg { accountId: string; amount: number }

export interface PostInput {
  type: string;
  amount: number;
  fee?: number;
  initiatorId?: string | null;
  description?: string;
  meta?: Record<string, unknown>;
  legs: Leg[];
  reference?: string;
  provider?: string;
}

/**
 * Enregistre une transaction en partie double. La somme des jambes doit être nulle :
 * aucun franc n'est créé ni détruit. Les comptes sont verrouillés dans un ordre fixe
 * pour éviter les interblocages, et la contrainte CHECK sur accounts.balance garantit
 * qu'aucun compte client ne passe en négatif.
 */
export async function post(client: pg.PoolClient, input: PostInput) {
  const legs = input.legs.filter((l) => l.amount !== 0);
  if (legs.reduce((s, l) => s + l.amount, 0) !== 0) throw new Error('Écriture déséquilibrée');
  if (legs.some((l) => !Number.isSafeInteger(l.amount))) throw new Error('Montant non entier');

  const ids = [...new Set(legs.map((l) => l.accountId))].sort();
  const { rows: locked } = await client.query(
    'SELECT id, kind, balance FROM accounts WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE',
    [ids],
  );
  if (locked.length !== ids.length) throw new Error('Compte inconnu dans l\'écriture');

  const delta = new Map<string, number>();
  for (const l of legs) delta.set(l.accountId, (delta.get(l.accountId) ?? 0) + l.amount);
  for (const acc of locked) {
    if (acc.kind !== 'system' && acc.balance + (delta.get(acc.id) ?? 0) < 0) {
      throw conflict('insufficient_funds', 'Solde insuffisant');
    }
  }

  const tx = await one(
    client,
    `INSERT INTO transactions (reference, type, status, amount, fee, initiator_id, provider, description, meta, completed_at)
     VALUES ($1, $2, 'completed', $3, $4, $5, $6, $7, $8, now()) RETURNING *`,
    [
      input.reference ?? makeReference(input.type.slice(0, 3).toUpperCase()),
      input.type, input.amount, input.fee ?? 0, input.initiatorId ?? null,
      input.provider ?? null, input.description ?? null, input.meta ?? {},
    ],
  );
  await applyLegs(client, tx.id, legs);
  return tx;
}

/** Applique les jambes d'une transaction déjà créée (ex. dépôt en attente confirmé par webhook). */
export async function applyLegs(client: pg.PoolClient, txId: string, legs: Leg[]) {
  const sorted = [...legs].sort((a, b) => a.accountId.localeCompare(b.accountId));
  for (const l of sorted) {
    await client.query('UPDATE accounts SET balance = balance + $2 WHERE id = $1', [l.accountId, l.amount]);
    await client.query('INSERT INTO ledger_entries (tx_id, account_id, amount) VALUES ($1, $2, $3)', [txId, l.accountId, l.amount]);
  }
}

const systemCache = new Map<string, string>();
export async function systemAccount(db: Db, code: 'SYS_FLOAT' | 'SYS_FEES' | 'SYS_REWARDS' | 'SYS_CREDIT' | 'SYS_CREDIT_INCOME'): Promise<string> {
  const cached = systemCache.get(code);
  if (cached) return cached;
  const row = await one(db, 'SELECT id FROM accounts WHERE code = $1', [code]);
  systemCache.set(code, row.id);
  return row.id;
}

export async function walletOf(db: Db, userId: string): Promise<{ id: string; balance: number }> {
  const row = await one(db, "SELECT id, balance FROM accounts WHERE owner_id = $1 AND kind = 'wallet'", [userId]);
  if (!row) throw badRequest('no_wallet', 'Portefeuille introuvable');
  return row;
}

export async function createAccount(db: Db, ownerId: string | null, kind: string): Promise<string> {
  const row = await one(db, 'INSERT INTO accounts (owner_id, kind) VALUES ($1, $2) RETURNING id', [ownerId, kind]);
  return row.id;
}

export async function balanceOf(db: Db, accountId: string): Promise<number> {
  const row = await one(db, 'SELECT balance FROM accounts WHERE id = $1', [accountId]);
  return row?.balance ?? 0;
}

export function assertAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw badRequest('invalid_amount', 'Montant invalide');
}
