-- L16 HD-11 Quyết định công nhận (spec #79 stories 9 to 16, 19 to 21; ticket #83; ADR 0009).
--
-- The Cán bộ Sở records the Quyết định công nhận the Chủ tịch UBND tỉnh signed outside the system: its số, ngày ký and
-- the signed PDF (purpose `recognition_decision`). A decision of `kind` 'meeting' is the one of a Phiên họp (at most one
-- per Phiên họp); 'supplementary' is the Quyết định công nhận bổ sung of ADR 0009 (no Phiên họp, a later ticket).
-- Each hồ sơ it names sits in one mục: three_star, four_star, or five_star_proposal ("đạt điểm đề nghị Trung ương đánh
-- giá, phân hạng 5 sao", which approves the kết quả and recognizes nothing). Nothing here is ever removed (story 19, no
-- hủy ghi nhận): the rows of a decision are append-only, and only its số and ngày ký may later be corrected (story 17,
-- a later ticket grants that UPDATE).

DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def FROM pg_constraint WHERE conname = 'file_purpose_check' AND conrelid = 'platform.file'::regclass;
  IF def NOT LIKE '%''recognition_decision''%' THEN
    ALTER TABLE platform.file DROP CONSTRAINT file_purpose_check;
    EXECUTE 'ALTER TABLE platform.file ADD CONSTRAINT file_purpose_check ' || replace(def, ']', ', ''recognition_decision''::text]');
  END IF;
END;
$$;

CREATE SCHEMA results;
GRANT USAGE ON SCHEMA results TO ocop_app, ocop_readonly;

CREATE TABLE results.recognition_decision (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('meeting', 'supplementary')),
  meeting_id uuid REFERENCES scoring.meeting (id),
  number text NOT NULL CHECK (char_length(btrim(number)) BETWEEN 1 AND 100),
  signed_on date NOT NULL,
  file_id uuid NOT NULL UNIQUE REFERENCES platform.file (id),
  recorded_by uuid NOT NULL REFERENCES identity.user_account (id),
  recorded_at timestamptz NOT NULL,
  CHECK ((kind = 'meeting') = (meeting_id IS NOT NULL))
);

-- Story 12: one Quyết định công nhận per Phiên họp.
CREATE UNIQUE INDEX recognition_decision_one_per_meeting ON results.recognition_decision (meeting_id) WHERE kind = 'meeting';

CREATE TABLE results.recognition_decision_dossier (
  decision_id uuid NOT NULL REFERENCES results.recognition_decision (id),
  dossier_id uuid NOT NULL REFERENCES dossier.dossier (id),
  section text NOT NULL CHECK (section IN ('three_star', 'four_star', 'five_star_proposal')),
  PRIMARY KEY (decision_id, dossier_id)
);

CREATE INDEX recognition_decision_dossier_by_dossier ON results.recognition_decision_dossier (dossier_id);

-- A decision keeps what it was recorded with; only its số and ngày ký may be corrected (story 17).
CREATE FUNCTION results.guard_recognition_decision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.id = OLD.id AND NEW.kind = OLD.kind AND NEW.meeting_id IS NOT DISTINCT FROM OLD.meeting_id
     AND NEW.file_id = OLD.file_id AND NEW.recorded_by = OLD.recorded_by AND NEW.recorded_at = OLD.recorded_at THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'a Quyết định công nhận is never removed; only its số and ngày ký may be corrected' USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER recognition_decision_guard BEFORE UPDATE OR DELETE ON results.recognition_decision
  FOR EACH ROW EXECUTE FUNCTION results.guard_recognition_decision();
CREATE TRIGGER recognition_decision_no_truncate BEFORE TRUNCATE ON results.recognition_decision
  FOR EACH STATEMENT EXECUTE FUNCTION results.guard_recognition_decision();

CREATE FUNCTION results.refuse_recognition_decision_dossier_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'the hồ sơ of a Quyết định công nhận never change' USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER recognition_decision_dossier_immutable BEFORE UPDATE OR DELETE ON results.recognition_decision_dossier
  FOR EACH ROW EXECUTE FUNCTION results.refuse_recognition_decision_dossier_change();
CREATE TRIGGER recognition_decision_dossier_no_truncate BEFORE TRUNCATE ON results.recognition_decision_dossier
  FOR EACH STATEMENT EXECUTE FUNCTION results.refuse_recognition_decision_dossier_change();

GRANT SELECT, INSERT ON results.recognition_decision, results.recognition_decision_dossier TO ocop_app;
GRANT SELECT ON results.recognition_decision, results.recognition_decision_dossier TO ocop_readonly;
