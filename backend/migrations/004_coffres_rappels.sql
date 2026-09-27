-- Coffres de groupe (associations, dahiras, familles…) et rappels automatiques
-- Inspiré des usages observés au Sénégal (Maman Tontine) : caisses d'associations suivies mois par mois.

ALTER TABLE cagnottes
  ADD COLUMN category TEXT NOT NULL DEFAULT 'autre'
    CHECK (category IN ('association', 'dahira', 'religieux', 'famille', 'gie', 'asc', 'projet', 'autre')),
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public'));

-- Un rappel n'est envoyé qu'une fois (clé = objet + destinataire + échéance + moment).
CREATE TABLE reminders_sent (
  key        TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
