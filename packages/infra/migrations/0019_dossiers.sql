-- L02 CT-03 Hồ sơ and its lifecycle (spec #30, ticket #34; ADR 0007).
--
-- A hồ sơ is one request to evaluate one product against exactly one Bộ tiêu chí, fixed from creation.
-- Its state is one of the 15 codes of ADR 0007 and only ever changes through the core's transition(),
-- which bumps `version` (optimistic lock) and appends a dossier_event in the same transaction.
--
-- Xã (ward_id) and đợt (round_id) are set on submission; first_forwarded_at records the first time it
-- reached Đã chuyển tỉnh, so the province's Phạm vi needs no scan of the events. A Nháp never submitted
-- may be deleted: it is marked deleted_at and disappears from every read, while its events stay.

CREATE SCHEMA dossier;
GRANT USAGE ON SCHEMA dossier TO ocop_app, ocop_readonly;

CREATE TABLE dossier.dossier (
  id uuid PRIMARY KEY,
  entity_id uuid NOT NULL REFERENCES entity.entity (id),
  criteria_set_id uuid NOT NULL REFERENCES criteria.criteria_set (id),
  criteria_version_id uuid NOT NULL REFERENCES criteria.version (id),
  state text NOT NULL CHECK (state IN (
    'draft', 'submitted_to_ward', 'supplement_requested', 'rejected_preliminary', 'withdrawn',
    'forwarded_to_province', 'advisory_review', 'advisory_report_issued', 'member_review', 'member_confirmed',
    'score_finalized', 'recognized', 'not_passed', 'five_star_proposed', 'closed_offline'
  )),
  ward_id uuid REFERENCES org.ward (id),
  round_id uuid REFERENCES round.round (id),
  -- Thông tin sản phẩm, free text kept while the hồ sơ is being written; required fields are checked on submission.
  product_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  ingredients text NOT NULL DEFAULT '',
  process text NOT NULL DEFAULT '',
  packaging text NOT NULL DEFAULT '',
  quality_declaration text NOT NULL DEFAULT '',
  received_at timestamptz,
  received_by uuid REFERENCES identity.user_account (id),
  handler_user_id uuid REFERENCES identity.user_account (id),
  first_forwarded_at timestamptz,
  copied_from uuid REFERENCES dossier.dossier (id),
  deleted_at timestamptz,
  version integer NOT NULL CHECK (version >= 1),
  created_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES identity.user_account (id),
  updated_at timestamptz NOT NULL,
  CONSTRAINT deleted_only_as_draft CHECK (deleted_at IS NULL OR state = 'draft')
);
CREATE INDEX dossier_entity_idx ON dossier.dossier (entity_id) WHERE deleted_at IS NULL;
CREATE INDEX dossier_ward_idx ON dossier.dossier (ward_id, state) WHERE deleted_at IS NULL;
CREATE INDEX dossier_round_idx ON dossier.dossier (round_id) WHERE deleted_at IS NULL;

-- The Chủ thể, Bộ tiêu chí and origin of a hồ sơ never change, and a deleted one stays deleted.
CREATE FUNCTION dossier.guard_dossier() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.entity_id IS DISTINCT FROM OLD.entity_id
     OR NEW.criteria_set_id IS DISTINCT FROM OLD.criteria_set_id
     OR NEW.criteria_version_id IS DISTINCT FROM OLD.criteria_version_id
     OR NEW.copied_from IS DISTINCT FROM OLD.copied_from
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'the Chủ thể, Bộ tiêu chí and origin of a dossier are fixed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'a deleted dossier cannot change' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'every change of a dossier bumps its version by one' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER dossier_guard BEFORE UPDATE ON dossier.dossier
  FOR EACH ROW EXECUTE FUNCTION dossier.guard_dossier();

GRANT SELECT, INSERT, UPDATE ON dossier.dossier TO ocop_app;
GRANT SELECT ON dossier.dossier TO ocop_readonly;

-- Sự kiện hồ sơ: one row per transition (from, to, action, who, when, why), the timeline of the hồ sơ.
-- Same-state events (Tiếp nhận, Cán bộ phụ trách, Chuyển xã…) have from_state = to_state; creation has
-- no from_state. Append-only.
CREATE TABLE dossier.dossier_event (
  id uuid PRIMARY KEY,
  dossier_id uuid NOT NULL REFERENCES dossier.dossier (id),
  action text NOT NULL,
  from_state text,
  to_state text NOT NULL,
  actor_user_id uuid REFERENCES identity.user_account (id),
  actor_role text,
  occurred_at timestamptz NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX dossier_event_dossier_idx ON dossier.dossier_event (dossier_id, occurred_at);

GRANT SELECT, INSERT ON dossier.dossier_event TO ocop_app;
GRANT SELECT ON dossier.dossier_event TO ocop_readonly;

-- Kho minh chứng of the working copy: files of the hồ sơ, not yet tied to any Tiêu chí. A file may sit
-- in several hồ sơ (Sao chép sang hồ sơ mới references the same file, never copies its bytes).
ALTER TABLE platform.file DROP CONSTRAINT file_purpose_check;
ALTER TABLE platform.file ADD CONSTRAINT file_purpose_check CHECK (purpose IN ('test_upload', 'legal_document', 'evidence'));

CREATE TABLE dossier.evidence_file (
  dossier_id uuid NOT NULL REFERENCES dossier.dossier (id),
  file_id uuid NOT NULL REFERENCES platform.file (id),
  added_by uuid NOT NULL REFERENCES identity.user_account (id),
  added_at timestamptz NOT NULL,
  PRIMARY KEY (dossier_id, file_id)
);

GRANT SELECT, INSERT, DELETE ON dossier.evidence_file TO ocop_app;
GRANT SELECT ON dossier.evidence_file TO ocop_readonly;
