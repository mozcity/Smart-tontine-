-- Smart Tontine — tontine rotative en ligne + microfinance (avance sur tontine, microcrédit)

ALTER TABLE accounts DROP CONSTRAINT accounts_kind_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_kind_check
  CHECK (kind IN ('wallet', 'ecaisse', 'cagnotte', 'projet', 'challenge', 'tontine', 'system'));

INSERT INTO accounts (kind, code) VALUES
  ('system', 'SYS_CREDIT'),         -- ligne de crédit du SFD partenaire (négatif = encours prêté)
  ('system', 'SYS_CREDIT_INCOME');  -- part des intérêts revenant au SFD partenaire

-- ───────────── Tontine rotative ─────────────
-- Chaque tour, tous les membres cotisent le même montant ; un membre (selon l'ordre) reçoit le pot.
-- Une caution (garantie) est bloquée à l'adhésion : elle couvre la cotisation d'un membre défaillant.
CREATE TABLE tontines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES accounts(id),
  organizer_id        UUID NOT NULL REFERENCES users(id),
  name                TEXT NOT NULL,
  description         TEXT,
  contribution_amount BIGINT NOT NULL CHECK (contribution_amount >= 500),
  frequency           TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  max_members         SMALLINT NOT NULL CHECK (max_members BETWEEN 2 AND 50),
  order_mode          TEXT NOT NULL DEFAULT 'random' CHECK (order_mode IN ('random', 'fixed')),
  guarantee_amount    BIGINT NOT NULL CHECK (guarantee_amount >= 0),
  status              TEXT NOT NULL DEFAULT 'recruiting' CHECK (status IN ('recruiting', 'active', 'completed', 'cancelled')),
  start_date          DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tontine_members (
  tontine_id       UUID NOT NULL REFERENCES tontines(id),
  user_id          UUID NOT NULL REFERENCES users(id),
  position         SMALLINT,
  guarantee_status TEXT NOT NULL DEFAULT 'held' CHECK (guarantee_status IN ('held', 'used', 'returned')),
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'defaulter')),
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tontine_id, user_id),
  UNIQUE (tontine_id, position)
);

CREATE TABLE tontine_rounds (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tontine_id     UUID NOT NULL REFERENCES tontines(id),
  number         SMALLINT NOT NULL,
  beneficiary_id UUID NOT NULL REFERENCES users(id),
  due_date       DATE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid_out')),
  payout_amount  BIGINT,
  payout_tx_id   UUID REFERENCES transactions(id),
  paid_out_at    TIMESTAMPTZ,
  UNIQUE (tontine_id, number)
);

CREATE TABLE tontine_contributions (
  round_id UUID NOT NULL REFERENCES tontine_rounds(id),
  user_id  UUID NOT NULL REFERENCES users(id),
  amount   BIGINT NOT NULL CHECK (amount > 0),
  penalty  BIGINT NOT NULL DEFAULT 0 CHECK (penalty >= 0),
  source   TEXT NOT NULL CHECK (source IN ('wallet', 'guarantee')),
  late     BOOLEAN NOT NULL DEFAULT false,
  tx_id    UUID REFERENCES transactions(id),
  paid_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (round_id, user_id)
);

-- ───────────── Microfinance ─────────────
-- Les prêts sont financés par le SFD partenaire (compte SYS_CREDIT) ; Smart Tontine fait le scoring,
-- verse, recouvre et perçoit une part des intérêts.
CREATE TABLE loans (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id),
  product            TEXT NOT NULL CHECK (product IN ('avance_tontine', 'microcredit')),
  purpose            TEXT,
  principal          BIGINT NOT NULL CHECK (principal > 0),
  interest           BIGINT NOT NULL CHECK (interest >= 0),
  apr                NUMERIC(6, 4) NOT NULL,
  score_at_grant     SMALLINT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'repaid', 'defaulted')),
  tontine_round_id   UUID REFERENCES tontine_rounds(id),
  disbursement_tx_id UUID REFERENCES transactions(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at          TIMESTAMPTZ
);
CREATE INDEX loans_user_idx ON loans (user_id, status);
CREATE UNIQUE INDEX one_advance_per_round ON loans (tontine_round_id) WHERE product = 'avance_tontine' AND status = 'active';

CREATE TABLE loan_installments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id     UUID NOT NULL REFERENCES loans(id),
  number      SMALLINT NOT NULL,
  due_date    DATE NOT NULL,
  principal   BIGINT NOT NULL CHECK (principal >= 0),
  interest    BIGINT NOT NULL CHECK (interest >= 0),
  penalty     BIGINT NOT NULL DEFAULT 0 CHECK (penalty >= 0),
  paid_at     TIMESTAMPTZ,
  tx_id       UUID REFERENCES transactions(id),
  UNIQUE (loan_id, number)
);
CREATE INDEX loan_installments_due_idx ON loan_installments (due_date) WHERE paid_at IS NULL;

INSERT INTO news_tutos (title, summary) VALUES
  ('Rejoindre une tontine en ligne', 'Cotise chaque semaine ou chaque mois et reçois le pot à ton tour, sans risque de fuite de la caisse.'),
  ('Comment fonctionne ton score Smart Tontine', 'Chaque cotisation payée à l''heure augmente ton score et débloque des crédits.');
