ALTER TABLE sca.user_credentials
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_user_credentials_force_password
  ON sca.user_credentials(must_change_password);
