-- ADR 0002: the audit hash chain lives beside audit_log (which nobody may update), append-only too.
CREATE TABLE platform.audit_seal (
  seq bigint PRIMARY KEY CHECK (seq > 0),
  audit_id uuid NOT NULL UNIQUE,
  audit_occurred_at timestamptz NOT NULL,
  hash text NOT NULL CHECK (hash ~ '^[0-9a-f]{64}$'),
  sealed_at timestamptz NOT NULL
);

CREATE TABLE platform.audit_checkpoint (
  id uuid PRIMARY KEY,
  last_seq bigint NOT NULL REFERENCES platform.audit_seal (seq),
  last_hash text NOT NULL,
  sealed_count integer NOT NULL CHECK (sealed_count > 0),
  created_at timestamptz NOT NULL
);

CREATE TRIGGER audit_seal_no_update_delete BEFORE UPDATE OR DELETE ON platform.audit_seal
  FOR EACH ROW EXECUTE FUNCTION platform.audit_append_only();
CREATE TRIGGER audit_seal_no_truncate BEFORE TRUNCATE ON platform.audit_seal
  FOR EACH STATEMENT EXECUTE FUNCTION platform.audit_append_only();
CREATE TRIGGER audit_checkpoint_no_update_delete BEFORE UPDATE OR DELETE ON platform.audit_checkpoint
  FOR EACH ROW EXECUTE FUNCTION platform.audit_append_only();

GRANT SELECT, INSERT ON platform.audit_seal, platform.audit_checkpoint TO ocop_app;
GRANT SELECT ON platform.audit_log, platform.audit_seal, platform.audit_checkpoint TO ocop_readonly;
