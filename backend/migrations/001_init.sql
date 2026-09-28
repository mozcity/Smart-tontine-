-- Smart Tontine — schéma initial
-- Tous les montants sont en FCFA (XOF), stockés en entiers (BIGINT) : le FCFA n'a pas de décimales.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ───────────── Clients & authentification ─────────────
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           TEXT NOT NULL UNIQUE,
  full_name       TEXT,
  email           TEXT,
  role            TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'support', 'admin')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  kyc_level       SMALLINT NOT NULL DEFAULT 0 CHECK (kyc_level BETWEEN 0 AND 2),
  plan            TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'plus')),
  plan_renews_at  TIMESTAMPTZ,
  pin_hash        TEXT,
  referral_code   TEXT NOT NULL UNIQUE,
  referred_by     UUID REFERENCES users(id),
  acquisition_channel TEXT,
  points          INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE otp_codes (
  id          BIGSERIAL PRIMARY KEY,
  phone       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  attempts    SMALLINT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX otp_codes_phone_idx ON otp_codes (phone, created_at DESC);

-- ───────────── Grand livre (comptabilité en partie double) ─────────────
-- Chaque « poche » d'argent est un compte : portefeuille, e-caisse, cagnotte, projet, challenge.
-- Les comptes système (float opérateurs, frais, récompenses) peuvent être négatifs.
CREATE TABLE accounts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID REFERENCES users(id),
  kind       TEXT NOT NULL CHECK (kind IN ('wallet', 'ecaisse', 'cagnotte', 'projet', 'challenge', 'system')),
  code       TEXT UNIQUE,
  balance    BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT non_negative_customer_balance CHECK (kind = 'system' OR balance >= 0)
);
CREATE UNIQUE INDEX one_wallet_per_user ON accounts (owner_id) WHERE kind = 'wallet';

CREATE TABLE transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference    TEXT NOT NULL UNIQUE,
  type         TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  amount       BIGINT NOT NULL CHECK (amount > 0),
  fee          BIGINT NOT NULL DEFAULT 0 CHECK (fee >= 0),
  initiator_id UUID REFERENCES users(id),
  provider     TEXT,
  provider_ref TEXT,
  description  TEXT,
  meta         JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX transactions_initiator_idx ON transactions (initiator_id, created_at DESC);

CREATE TABLE ledger_entries (
  id         BIGSERIAL PRIMARY KEY,
  tx_id      UUID NOT NULL REFERENCES transactions(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  amount     BIGINT NOT NULL CHECK (amount <> 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ledger_entries_account_idx ON ledger_entries (account_id, id DESC);

INSERT INTO accounts (kind, code) VALUES
  ('system', 'SYS_FLOAT'),     -- argent détenu chez les opérateurs / banque partenaire
  ('system', 'SYS_FEES'),      -- revenus de frais
  ('system', 'SYS_REWARDS');   -- budget marketing (bonus parrainage, récompenses challenges)

-- ───────────── E-caisse (épargne bloquée) ─────────────
CREATE TABLE ecaisses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  account_id    UUID NOT NULL REFERENCES accounts(id),
  name          TEXT NOT NULL,
  target_amount BIGINT,
  unlock_at     TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'released', 'broken')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ
);

-- ───────────── Cagnotte+ (épargne collective, double validation) ─────────────
CREATE TABLE cagnottes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES accounts(id),
  name                TEXT NOT NULL,
  description         TEXT,
  target_amount       BIGINT,
  contribution_amount BIGINT,
  frequency           TEXT CHECK (frequency IN ('daily', 'weekly', 'monthly', 'free')),
  required_approvals  SMALLINT NOT NULL DEFAULT 2 CHECK (required_approvals >= 1),
  created_by          UUID NOT NULL REFERENCES users(id),
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cagnotte_members (
  cagnotte_id UUID NOT NULL REFERENCES cagnottes(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cagnotte_id, user_id)
);

CREATE TABLE cagnotte_withdrawals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cagnotte_id    UUID NOT NULL REFERENCES cagnottes(id),
  requested_by   UUID NOT NULL REFERENCES users(id),
  beneficiary_id UUID NOT NULL REFERENCES users(id),
  amount         BIGINT NOT NULL CHECK (amount > 0),
  reason         TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'rejected')),
  tx_id          UUID REFERENCES transactions(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cagnotte_approvals (
  withdrawal_id UUID NOT NULL REFERENCES cagnotte_withdrawals(id),
  user_id       UUID NOT NULL REFERENCES users(id),
  decision      TEXT NOT NULL CHECK (decision IN ('approve', 'reject')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (withdrawal_id, user_id)
);

-- ───────────── Budget ─────────────
CREATE TABLE budget_plans (
  user_id  UUID NOT NULL REFERENCES users(id),
  month    CHAR(7) NOT NULL,             -- AAAA-MM
  category TEXT NOT NULL,
  planned  BIGINT NOT NULL CHECK (planned >= 0),
  PRIMARY KEY (user_id, month, category)
);

CREATE TABLE budget_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  kind        TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  category    TEXT NOT NULL,
  amount      BIGINT NOT NULL CHECK (amount > 0),
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX budget_entries_user_idx ON budget_entries (user_id, occurred_on);

-- ───────────── Projets ─────────────
CREATE TABLE projets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  account_id    UUID NOT NULL REFERENCES accounts(id),
  name          TEXT NOT NULL,
  category      TEXT,
  target_amount BIGINT NOT NULL CHECK (target_amount > 0),
  deadline      DATE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projet_steps (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id UUID NOT NULL REFERENCES projets(id),
  position  SMALLINT NOT NULL,
  title     TEXT NOT NULL,
  amount    BIGINT,
  done_at   TIMESTAMPTZ
);

-- ───────────── Challenges ─────────────
CREATE TABLE challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  duration_days   INTEGER NOT NULL,
  target_amount   BIGINT NOT NULL,
  reward_points   INTEGER NOT NULL DEFAULT 0,
  reward_fcfa     BIGINT NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE challenge_participations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  account_id   UUID NOT NULL REFERENCES accounts(id),
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at      TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX one_active_participation ON challenge_participations (challenge_id, user_id) WHERE status = 'active';

INSERT INTO challenges (code, title, description, duration_days, target_amount, reward_points, reward_fcfa) VALUES
  ('52_SEMAINES', 'Défi 52 semaines', 'Épargne 500 F la 1re semaine, 1 000 F la 2e… jusqu''à 26 000 F la 52e.', 364, 689000, 500, 2000),
  ('30_JOURS_1000', '1 000 F par jour pendant 30 jours', 'Mets 1 000 F de côté chaque jour pendant un mois.', 30, 30000, 100, 300),
  ('ZERO_DEPENSE_WEEKEND', 'Week-end zéro dépense', 'Épargne ce que tu aurais dépensé ce week-end.', 3, 5000, 30, 0),
  ('RENTREE_SCOLAIRE', 'Objectif rentrée scolaire', 'Prépare la rentrée en 90 jours.', 90, 150000, 200, 1000);

-- ───────────── Contrats (engagements financiers entre personnes) ─────────────
CREATE TABLE contrats (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id             UUID NOT NULL REFERENCES users(id),
  counterparty_id        UUID NOT NULL REFERENCES users(id),
  creditor_id            UUID NOT NULL REFERENCES users(id),
  debtor_id              UUID NOT NULL REFERENCES users(id),
  title                  TEXT NOT NULL,
  kind                   TEXT NOT NULL CHECK (kind IN ('pret', 'engagement', 'tontine')),
  principal              BIGINT NOT NULL CHECK (principal > 0),
  status                 TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  signed_creator_at      TIMESTAMPTZ,
  signed_counterparty_at TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (creator_id <> counterparty_id)
);

CREATE TABLE contrat_echeances (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrat_id UUID NOT NULL REFERENCES contrats(id),
  due_on     DATE NOT NULL,
  amount     BIGINT NOT NULL CHECK (amount > 0),
  paid_at    TIMESTAMPTZ,
  tx_id      UUID REFERENCES transactions(id)
);

-- ───────────── CRM, support, marketing ─────────────
CREATE TABLE crm_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  author_id  UUID NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE support_tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  channel     TEXT NOT NULL DEFAULT 'app' CHECK (channel IN ('app', 'whatsapp', 'phone', 'email', 'agent')),
  priority    TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'closed')),
  assigned_to UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ticket_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  UUID NOT NULL REFERENCES support_tickets(id),
  author_id  UUID NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_events (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES users(id),
  name       TEXT NOT NULL,
  props      JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX user_events_name_idx ON user_events (name, created_at);

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  segment      TEXT NOT NULL,
  channel      TEXT NOT NULL CHECK (channel IN ('push', 'sms', 'whatsapp', 'email')),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  sent_count   INTEGER NOT NULL DEFAULT 0,
  created_by   UUID NOT NULL REFERENCES users(id),
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE news_tutos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  summary    TEXT NOT NULL,
  video_url  TEXT,
  published  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO news_tutos (title, summary) VALUES
  ('Créer son budget', 'Accède à nos vidéos tutoriels pour créer un budget.'),
  ('Lancer une Cagnotte+', 'Organise ta tontine moderne avec double validation.'),
  ('Bloquer son argent avec l''E-caisse', 'Résiste à la tentation et épargne sans y penser.');
