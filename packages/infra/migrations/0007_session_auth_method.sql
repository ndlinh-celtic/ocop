-- How a session last proved its user's identity, for the audit of sensitive actions (Xác thực lại).
ALTER TABLE identity.session
  ADD COLUMN auth_method text NOT NULL DEFAULT 'password' CHECK (auth_method IN ('password', 'password+totp', 'totp'));
ALTER TABLE identity.session ALTER COLUMN auth_method DROP DEFAULT;
