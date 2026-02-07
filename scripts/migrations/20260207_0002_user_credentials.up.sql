CREATE TABLE IF NOT EXISTS sca.user_credentials (
  user_id INT PRIMARY KEY REFERENCES sca.users(user_id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  password_algo TEXT NOT NULL DEFAULT 'bcrypt',
  password_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  session_version INT NOT NULL DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_credentials_active ON sca.user_credentials(is_active);
