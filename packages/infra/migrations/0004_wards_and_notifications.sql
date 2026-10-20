-- AD-06 danh mục xã/phường (seeded from CSV in step 1) and DC-01 in-app notifications.

CREATE TABLE org.ward (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code ~ '^[0-9]{5}$'),
  name text NOT NULL CHECK (length(name) > 0)
);

CREATE TABLE platform.notification (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES identity.user_account (id),
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  link text,
  created_at timestamptz NOT NULL,
  read_at timestamptz
);
CREATE INDEX notification_user_idx ON platform.notification (user_id, created_at DESC);
CREATE INDEX notification_unread_idx ON platform.notification (user_id) WHERE read_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON org.ward, platform.notification TO ocop_app;
GRANT SELECT ON org.ward TO ocop_readonly;
