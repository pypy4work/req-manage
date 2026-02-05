-- Seed leave balances with default full entitlements
-- Adjust totals to your policy before running in production.

INSERT INTO sca.leave_balances (user_id, request_type_id, total_entitlement, remaining, unit)
SELECT
  u.user_id,
  rt.id,
  CASE
    WHEN rt.unit = 'hours' THEN 16
    WHEN rt.unit = 'days' THEN 30
    ELSE 0
  END AS total_entitlement,
  CASE
    WHEN rt.unit = 'hours' THEN 16
    WHEN rt.unit = 'days' THEN 30
    ELSE 0
  END AS remaining,
  rt.unit
FROM sca.users u
JOIN sca.request_types rt ON rt.unit IN ('hours','days')
ON CONFLICT (user_id, request_type_id) DO NOTHING;
