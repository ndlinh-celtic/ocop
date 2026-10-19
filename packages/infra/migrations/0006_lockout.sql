-- L20: temporary lockout after repeated failed password or TOTP attempts.
ALTER TABLE identity.user_account
  ADD COLUMN failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  ADD COLUMN failed_window_start timestamptz,
  ADD COLUMN locked_until timestamptz;
