-- Smart Tontine — journal des SMS (OTP, rappels) et accusés de réception des opérateurs.
-- Le texte des OTP n'est jamais conservé : le code est masqué avant écriture.
CREATE TABLE sms_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('otp', 'reminder', 'notification')),
  body          TEXT NOT NULL,
  segments      SMALLINT NOT NULL,
  encoding      TEXT NOT NULL CHECK (encoding IN ('gsm7', 'ucs2')),
  provider      TEXT,
  provider_ref  TEXT,
  status        TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'undelivered', 'failed')),
  error         TEXT,
  attempts      JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at  TIMESTAMPTZ
);
CREATE INDEX sms_log_ref_idx ON sms_log (provider, provider_ref);
CREATE INDEX sms_log_created_idx ON sms_log (created_at DESC);
