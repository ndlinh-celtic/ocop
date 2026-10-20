-- TOTP (DC-09) and the session stage between the password step and the TOTP step.
ALTER TABLE identity.user_account
  ADD COLUMN totp_secret_enc text,
  ADD COLUMN totp_enabled_at timestamptz,
  ADD COLUMN totp_last_step bigint,
  ADD COLUMN totp_pending_secret_enc text,
  ADD CONSTRAINT totp_enabled_has_secret CHECK ((totp_enabled_at IS NULL) = (totp_secret_enc IS NULL));

ALTER TABLE identity.session
  ADD COLUMN stage text NOT NULL DEFAULT 'full' CHECK (stage IN ('totp_pending', 'totp_enrollment', 'full'));
ALTER TABLE identity.session ALTER COLUMN stage DROP DEFAULT;

-- The read-only role never sees secrets.
REVOKE SELECT ON identity.user_account FROM ocop_readonly;
GRANT SELECT (id, email, full_name, status, created_at, totp_enabled_at) ON identity.user_account TO ocop_readonly;
