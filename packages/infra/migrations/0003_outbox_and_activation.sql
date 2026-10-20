-- ADR 0001 outbox, consumer idempotency, email delivery log (L23); one-time links (activation, reset).

CREATE TABLE platform.outbox (
  id uuid PRIMARY KEY,
  type text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  dispatched_at timestamptz
);
CREATE INDEX outbox_pending_idx ON platform.outbox (id) WHERE dispatched_at IS NULL;

CREATE TABLE platform.processed_event (
  event_id uuid NOT NULL REFERENCES platform.outbox (id),
  consumer text NOT NULL,
  processed_at timestamptz NOT NULL,
  PRIMARY KEY (event_id, consumer)
);

CREATE TABLE platform.email_delivery (
  id uuid PRIMARY KEY,
  event_id uuid REFERENCES platform.outbox (id),
  consumer text NOT NULL,
  recipient citext NOT NULL,
  template text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed')),
  error text,
  attempted_at timestamptz NOT NULL
);
CREATE INDEX email_delivery_recipient_idx ON platform.email_delivery (recipient, attempted_at);

CREATE TABLE identity.one_time_token (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES identity.user_account (id),
  purpose text NOT NULL CHECK (purpose IN ('activation', 'password_reset')),
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  invalidated_at timestamptz
);
CREATE INDEX one_time_token_open_idx ON identity.one_time_token (user_id, purpose) WHERE used_at IS NULL AND invalidated_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON platform.outbox, identity.one_time_token TO ocop_app;
GRANT SELECT, INSERT ON platform.processed_event, platform.email_delivery TO ocop_app;
