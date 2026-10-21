-- L10 TM-02, TM-05, TM-06 and L11 TM-07, TM-12 Báo cáo Tổ tư vấn (spec #49 stories 42 to 50, 56 to 64; ticket #56).
--
-- One shared nháp per hồ sơ, with one line per Tiêu chí (Điểm đề xuất as a Mức điểm of the hồ sơ's Bộ tiêu
-- chí, căn cứ, viện dẫn minh chứng, đánh giá minh chứng), saved with an optimistic `version`; and the phiên
-- bản the Tổ trưởng issues from it, numbered from 1, a snapshot that nobody may change or delete. Tệp đính kèm
-- thực địa are files of the new purpose `advisory_attachment`.

-- Adds `advisory_attachment` to whatever purposes the check lists by now, so this file does not depend on the
-- order other step-4 migrations add theirs in.
DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def FROM pg_constraint WHERE conname = 'file_purpose_check' AND conrelid = 'platform.file'::regclass;
  IF def NOT LIKE '%''advisory_attachment''%' THEN
    ALTER TABLE platform.file DROP CONSTRAINT file_purpose_check;
    EXECUTE 'ALTER TABLE platform.file ADD CONSTRAINT file_purpose_check ' || replace(def, ']', ', ''advisory_attachment''::text]');
  END IF;
END;
$$;

CREATE TABLE scoring.advisory_report_draft (
  dossier_id uuid PRIMARY KEY REFERENCES dossier.dossier (id),
  version integer NOT NULL CHECK (version >= 1),
  summary text NOT NULL,
  notes text NOT NULL,
  attachment_file_ids uuid[] NOT NULL,
  updated_at timestamptz NOT NULL,
  updated_by uuid NOT NULL REFERENCES identity.user_account (id)
);

CREATE TABLE scoring.advisory_report_line (
  dossier_id uuid NOT NULL REFERENCES scoring.advisory_report_draft (dossier_id),
  criterion_id uuid NOT NULL REFERENCES criteria.criterion (id),
  -- Điểm đề xuất; null until chosen.
  level_id uuid REFERENCES criteria.score_level (id),
  basis text NOT NULL,
  evidence_file_ids uuid[] NOT NULL,
  evidence_assessment text CHECK (evidence_assessment IN ('sufficient', 'missing', 'invalid', 'needs_verification')),
  PRIMARY KEY (dossier_id, criterion_id)
);

CREATE TABLE scoring.advisory_report_version (
  id uuid PRIMARY KEY,
  dossier_id uuid NOT NULL REFERENCES dossier.dossier (id),
  number integer NOT NULL CHECK (number >= 1),
  snapshot jsonb NOT NULL,
  issued_by uuid NOT NULL REFERENCES identity.user_account (id),
  issued_at timestamptz NOT NULL,
  -- Why phiên bản N+1 was issued; phiên bản 1 has none.
  reason text,
  CONSTRAINT advisory_report_version_key UNIQUE (dossier_id, number),
  CONSTRAINT advisory_report_version_reason CHECK ((number = 1) = (reason IS NULL))
);

-- An issued phiên bản is fixed: sửa is phiên bản N+1 (story 60). Even the owner cannot change one.
CREATE FUNCTION scoring.refuse_advisory_version_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'an issued Báo cáo Tổ tư vấn is immutable; issue a new phiên bản instead' USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER advisory_report_version_immutable BEFORE UPDATE OR DELETE ON scoring.advisory_report_version
  FOR EACH ROW EXECUTE FUNCTION scoring.refuse_advisory_version_change();
CREATE TRIGGER advisory_report_version_no_truncate BEFORE TRUNCATE ON scoring.advisory_report_version
  FOR EACH STATEMENT EXECUTE FUNCTION scoring.refuse_advisory_version_change();

GRANT SELECT, INSERT, UPDATE ON scoring.advisory_report_draft TO ocop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON scoring.advisory_report_line TO ocop_app;
GRANT SELECT, INSERT ON scoring.advisory_report_version TO ocop_app;
GRANT SELECT ON scoring.advisory_report_draft, scoring.advisory_report_line, scoring.advisory_report_version TO ocop_readonly;
