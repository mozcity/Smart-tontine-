-- Abonnement Organisateur Pro (trésoriers de tontines, associations, GIE)
ALTER TABLE users
  ADD COLUMN pro_renews_at TIMESTAMPTZ,
  ADD COLUMN pro_auto_renew BOOLEAN NOT NULL DEFAULT false;
