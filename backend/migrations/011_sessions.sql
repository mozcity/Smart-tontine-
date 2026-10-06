-- Smart Tontine — sessions courtes (audit du 05/10/2026) : jeton d'accès de 30 min + jeton de renouvellement.
-- Le jeton de renouvellement n'est jamais stocké en clair (empreinte SHA-256). Chaque renouvellement le remplace
-- (rotation) ; la réutilisation d'un jeton déjà remplacé révoque toute la « famille » (vol présumé).
CREATE TABLE refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family       UUID NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,
  client       TEXT NOT NULL CHECK (client IN ('web', 'app')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  replaced_by  UUID REFERENCES refresh_tokens(id)
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id) WHERE revoked_at IS NULL;
