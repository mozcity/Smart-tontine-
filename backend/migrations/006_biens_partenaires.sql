-- Smart Tontine — tontines de biens matériels et espaces partenaires (marque blanche)

ALTER TABLE accounts DROP CONSTRAINT accounts_kind_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_kind_check
  CHECK (kind IN ('wallet', 'ecaisse', 'cagnotte', 'projet', 'challenge', 'tontine', 'partner', 'plan_bien', 'system'));

-- Séquestre : l'argent d'un bien attend la confirmation de réception avant d'aller au fournisseur.
INSERT INTO accounts (kind, code) VALUES ('system', 'SYS_ESCROW');

-- ───────────── Partenaires ─────────────
-- Association, commerçant, entreprise, tontinier professionnel ou SFD qui organise ses propres
-- tontines et coffres sur Smart Tontine, sous son nom et avec son logo.
CREATE TABLE partners (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES accounts(id),
  name                TEXT NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('association', 'commercant', 'entreprise', 'tontinier', 'sfd', 'autre')),
  description         TEXT,
  logo                TEXT,            -- URL https ou image data:… (≤ 300 Ko)
  primary_color       TEXT NOT NULL DEFAULT '#2F2C8F' CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  phone               TEXT,
  city                TEXT,
  management_fee_rate NUMERIC(5, 4) NOT NULL DEFAULT 0 CHECK (management_fee_rate BETWEEN 0 AND 0.03),
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  created_by          UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE partner_staff (
  partner_id UUID NOT NULL REFERENCES partners(id),
  user_id    UUID NOT NULL REFERENCES users(id),
  role       TEXT NOT NULL CHECK (role IN ('owner', 'manager')),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (partner_id, user_id)
);

CREATE TABLE partner_invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id     UUID NOT NULL REFERENCES partners(id),
  month          CHAR(7) NOT NULL,
  active_members INTEGER NOT NULL,
  amount         BIGINT NOT NULL CHECK (amount >= 0),
  status         TEXT NOT NULL CHECK (status IN ('paid', 'due')),
  tx_id          UUID REFERENCES transactions(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (partner_id, month)
);

ALTER TABLE tontines
  ADD COLUMN partner_id UUID REFERENCES partners(id),
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'argent' CHECK (kind IN ('argent', 'bien')),
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  ADD COLUMN good_id UUID,
  ADD COLUMN good_label TEXT,
  ADD COLUMN good_price BIGINT;

ALTER TABLE cagnottes ADD COLUMN partner_id UUID REFERENCES partners(id);

-- ───────────── Catalogue de biens (proposés par des partenaires commerçants) ─────────────
CREATE TABLE goods (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  UUID NOT NULL REFERENCES partners(id),
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL CHECK (category IN ('moto', 'electromenager', 'telephone', 'mobilier', 'cuisine', 'textile', 'alimentaire', 'materiel_pro', 'autre')),
  price       BIGINT NOT NULL CHECK (price >= 1000),
  image       TEXT,
  stock       INTEGER CHECK (stock >= 0),
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE tontines ADD CONSTRAINT tontines_good_fk FOREIGN KEY (good_id) REFERENCES goods(id);

-- Plan d'achat individuel : j'épargne à mon rythme pour un bien.
CREATE TABLE goods_plans (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id),
  account_id         UUID NOT NULL REFERENCES accounts(id),
  good_id            UUID REFERENCES goods(id),
  label              TEXT NOT NULL,
  target_amount      BIGINT NOT NULL CHECK (target_amount >= 1000),
  frequency          TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'free')),
  installment_amount BIGINT,
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at          TIMESTAMPTZ
);

-- Commande d'un bien : payée au séquestre, versée au fournisseur à la confirmation de réception.
CREATE TABLE goods_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  good_id         UUID NOT NULL REFERENCES goods(id),
  partner_id      UUID NOT NULL REFERENCES partners(id),
  beneficiary_id  UUID NOT NULL REFERENCES users(id),
  source          TEXT NOT NULL CHECK (source IN ('tontine', 'plan')),
  source_id       UUID NOT NULL,
  amount          BIGINT NOT NULL CHECK (amount > 0),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'shipped', 'delivered', 'cancelled')),
  delivery_note   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  shipped_at      TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ
);
CREATE INDEX goods_orders_partner_idx ON goods_orders (partner_id, status);

INSERT INTO news_tutos (title, summary) VALUES
  ('Tontine de biens', 'Cotisez ensemble pour une moto, un frigo ou du matériel : chacun reçoit le bien à son tour.'),
  ('Devenir partenaire', 'Association, commerçant, entreprise : organisez vos tontines sous votre nom et votre logo.');
