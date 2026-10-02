-- Smart Tontine — durcissement issu du test d'intrusion interne (Lot 4).
-- Révocation des sessions : tout jeton émis avant cette date est refusé (« déconnecter tous mes appareils »).
ALTER TABLE users ADD COLUMN sessions_revoked_at TIMESTAMPTZ;
