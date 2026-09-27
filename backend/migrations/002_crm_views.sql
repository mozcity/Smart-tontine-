-- Vue « client 360 » : alimente le CRM, la segmentation et les campagnes marketing.
CREATE VIEW customer_overview AS
WITH money AS (
  SELECT owner_id,
         COALESCE(sum(balance) FILTER (WHERE kind = 'wallet'), 0)::bigint AS wallet,
         COALESCE(sum(balance) FILTER (WHERE kind IN ('ecaisse', 'projet', 'challenge')), 0)::bigint AS savings
  FROM accounts WHERE owner_id IS NOT NULL GROUP BY owner_id
), deposits AS (
  SELECT initiator_id, count(*)::int AS deposits_count, COALESCE(sum(amount), 0)::bigint AS deposits_total,
         min(completed_at) AS first_deposit_at, max(completed_at) AS last_deposit_at
  FROM transactions WHERE type = 'deposit' AND status = 'completed' GROUP BY initiator_id
), revenue AS (
  SELECT initiator_id, COALESCE(sum(fee), 0)::bigint + COALESCE(sum(amount) FILTER (WHERE type = 'subscription'), 0)::bigint AS revenue
  FROM transactions WHERE status IN ('completed') GROUP BY initiator_id
)
SELECT u.id, u.phone, u.full_name, u.email, u.role, u.status, u.kyc_level, u.plan, u.points,
       u.acquisition_channel, u.referred_by, u.created_at, u.last_active_at,
       COALESCE(m.wallet, 0) AS wallet, COALESCE(m.savings, 0) AS savings,
       COALESCE(m.wallet, 0) + COALESCE(m.savings, 0) AS net_worth,
       COALESCE(d.deposits_count, 0) AS deposits_count, COALESCE(d.deposits_total, 0) AS deposits_total,
       d.first_deposit_at, d.last_deposit_at, COALESCE(r.revenue, 0) AS revenue,
       (SELECT count(*)::int FROM users f WHERE f.referred_by = u.id) AS referrals,
       CASE
         WHEN COALESCE(m.wallet, 0) + COALESCE(m.savings, 0) >= 500000 THEN 'vip'
         WHEN COALESCE(d.deposits_count, 0) = 0 AND u.created_at > now() - interval '14 days' THEN 'nouveau'
         WHEN COALESCE(d.deposits_count, 0) = 0 THEN 'sans_depot'
         WHEN u.last_active_at < now() - interval '30 days' THEN 'dormant'
         WHEN COALESCE(m.savings, 0) > 0 THEN 'epargnant'
         ELSE 'actif'
       END AS segment
FROM users u
LEFT JOIN money m ON m.owner_id = u.id
LEFT JOIN deposits d ON d.initiator_id = u.id
LEFT JOIN revenue r ON r.initiator_id = u.id
WHERE u.role = 'customer';
