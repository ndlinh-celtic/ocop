-- identity: Người dùng, Phân vai, phiên (spec #1, ADR 0005). platform.audit_log (L21, AD-08).

CREATE TABLE identity.user_account (
  id uuid PRIMARY KEY,
  email citext NOT NULL UNIQUE,
  full_name text NOT NULL CHECK (length(full_name) > 0),
  password_hash text,
  status text NOT NULL CHECK (status IN ('pending_activation', 'active')),
  created_at timestamptz NOT NULL
);

CREATE TABLE identity.role_assignment (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES identity.user_account (id),
  role text NOT NULL,
  scope_type text NOT NULL,
  scope_id uuid,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz,
  granted_by uuid REFERENCES identity.user_account (id),
  created_at timestamptz NOT NULL,
  -- Each Vai trò takes exactly one kind of Phạm vi (GLOSSARY.md); mirrors SCOPE_OF_ROLE in core.
  CONSTRAINT role_scope_matches CHECK (scope_type = CASE role
    WHEN 'entity_owner' THEN 'entity'
    WHEN 'ward_officer' THEN 'ward'
    WHEN 'province_officer' THEN 'province'
    WHEN 'council_chair' THEN 'council'
    WHEN 'council_secretary' THEN 'council'
    WHEN 'council_member' THEN 'council'
    WHEN 'advisory_member' THEN 'council'
    WHEN 'admin' THEN 'system'
  END),
  CONSTRAINT scope_id_presence CHECK ((scope_type IN ('system', 'province')) = (scope_id IS NULL)),
  CONSTRAINT valid_range CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE INDEX role_assignment_user_idx ON identity.role_assignment (user_id);
CREATE INDEX role_assignment_role_idx ON identity.role_assignment (role) WHERE valid_to IS NULL;

CREATE TABLE identity.session (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES identity.user_account (id),
  token_hash text NOT NULL UNIQUE,
  active_assignment_id uuid REFERENCES identity.role_assignment (id),
  created_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  authenticated_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX session_user_idx ON identity.session (user_id) WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON identity.user_account, identity.role_assignment, identity.session TO ocop_app;
GRANT SELECT ON identity.user_account, identity.role_assignment TO ocop_readonly;

-- Append-only audit log, one partition per month. No foreign keys: audit outlives what it describes.
CREATE TABLE platform.audit_log (
  id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  actor_user_id uuid,
  actor_role text,
  action text NOT NULL,
  target_type text,
  target_id text,
  before jsonb,
  after jsonb,
  metadata jsonb NOT NULL DEFAULT '{}',
  request_id text,
  ip text,
  PRIMARY KEY (occurred_at, id)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE platform.audit_log_default PARTITION OF platform.audit_log DEFAULT;

DO $$
DECLARE
  m date := date '2026-01-01';
BEGIN
  WHILE m < date '2032-01-01' LOOP
    EXECUTE format(
      'CREATE TABLE platform.%I PARTITION OF platform.audit_log FOR VALUES FROM (%L) TO (%L)',
      'audit_log_' || to_char(m, 'YYYY_MM'), m, (m + interval '1 month')::date
    );
    m := (m + interval '1 month')::date;
  END LOOP;
END $$;

CREATE INDEX audit_log_actor_idx ON platform.audit_log (actor_user_id, occurred_at);
CREATE INDEX audit_log_target_idx ON platform.audit_log (target_type, target_id);
CREATE INDEX audit_log_action_idx ON platform.audit_log (action, occurred_at);

-- Second of the three locks: even the owner cannot rewrite history through the table.
CREATE FUNCTION platform.audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only (% refused)', TG_OP USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER audit_log_no_update_delete BEFORE UPDATE OR DELETE ON platform.audit_log
  FOR EACH ROW EXECUTE FUNCTION platform.audit_append_only();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON platform.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION platform.audit_append_only();

GRANT SELECT, INSERT ON platform.audit_log TO ocop_app;
