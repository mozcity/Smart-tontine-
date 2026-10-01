-- Smart Tontine — vérification d'identité (KYC) et double authentification du back-office

-- Dossiers KYC : niveau 1 = pièce d'identité + selfie ; niveau 2 = + justificatif de domicile ou de revenus.
-- Les images sont conservées 10 ans (LBC/FT). En production : stockage objet chiffré, la base ne garde que la référence.
CREATE TABLE kyc_submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  level             SMALLINT NOT NULL CHECK (level IN (1, 2)),
  id_type           TEXT NOT NULL CHECK (id_type IN ('cnib', 'passeport', 'carte_consulaire', 'permis', 'carte_electeur', 'autre')),
  id_number         TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  birth_date        DATE,
  id_front          TEXT NOT NULL,
  id_back           TEXT,
  selfie            TEXT NOT NULL,
  proof_of_address  TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason            TEXT,
  reviewed_by       UUID REFERENCES users(id),
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Un seul dossier en attente par membre.
CREATE UNIQUE INDEX kyc_one_pending ON kyc_submissions (user_id) WHERE status = 'pending';
CREATE INDEX kyc_status_idx ON kyc_submissions (status, created_at);

-- Double authentification (TOTP, RFC 6238) des comptes support et admin.
ALTER TABLE users
  ADD COLUMN totp_secret          TEXT,
  ADD COLUMN totp_enabled_at      TIMESTAMPTZ,
  ADD COLUMN totp_last_step       BIGINT,
  ADD COLUMN mfa_failed_attempts  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN mfa_locked_until     TIMESTAMPTZ;
