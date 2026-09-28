-- Smart Tontine — plateforme web : verrouillage du PIN, demandes de partenariat reçues du site public

-- Après 5 codes PIN erronés, le PIN est verrouillé 30 minutes (toute sortie d'argent est refusée).
ALTER TABLE users
  ADD COLUMN pin_failed_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN pin_locked_until    TIMESTAMPTZ;

-- Demandes reçues depuis le site public : « Devenir partenaire / SFD » et contact.
CREATE TABLE leads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         TEXT NOT NULL CHECK (kind IN ('partenaire', 'sfd', 'contact')),
  name         TEXT NOT NULL,
  organization TEXT,
  partner_type TEXT,
  phone        TEXT NOT NULL,
  email        TEXT,
  city         TEXT,
  members      INTEGER,
  message      TEXT,
  status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'won', 'lost')),
  handled_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX leads_status_idx ON leads (status, created_at DESC);
