-- L14 TV-01, TV-05, TV-06, TV-07 Phiếu chấm và xác nhận (spec #49 stories 83, 86 to 91; ticket #54).
--
-- A dòng chấm per Tiêu chí of a Phiếu chấm: the Mức điểm picked (of the hồ sơ's Bộ tiêu chí), a nhận xét and
-- bằng chứng kiểm tra files. The columns of the sao chép from Tổ tư vấn (source, advisory_*, adjust_reason,
-- edited) are filled by L12. Then the triggers of the khóa ba lớp (CLAUDE.md, ADR 0008): a phiếu no longer
-- draft is immutable, except that a confirmed one may become superseded (Trả phiếu, Mở khóa), and the dòng
-- of a phiếu no longer draft cannot be written at all.

CREATE TABLE scoring.score_sheet_line (
  score_sheet_id uuid NOT NULL REFERENCES scoring.score_sheet (id),
  criterion_id uuid NOT NULL REFERENCES criteria.criterion (id),
  -- Null until the thành viên picks one; the use case checks it is a Mức điểm of this Tiêu chí.
  score_level_id uuid REFERENCES criteria.score_level (id),
  comment text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'member' CHECK (source IN ('member', 'advisory')),
  -- The Báo cáo Tổ tư vấn version the dòng was copied from (L12; no FK until that table exists).
  advisory_version_id uuid,
  advisory_level_original uuid REFERENCES criteria.score_level (id),
  adjust_reason text,
  -- Whether the thành viên has touched the dòng: a later sao chép leaves it as it is (L12).
  edited boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (score_sheet_id, criterion_id)
);

-- Bằng chứng kiểm tra of a dòng, through the files flow (quét virus).
CREATE TABLE scoring.score_sheet_line_file (
  score_sheet_id uuid NOT NULL,
  criterion_id uuid NOT NULL,
  file_id uuid NOT NULL REFERENCES platform.file (id),
  PRIMARY KEY (score_sheet_id, criterion_id, file_id),
  FOREIGN KEY (score_sheet_id, criterion_id) REFERENCES scoring.score_sheet_line (score_sheet_id, criterion_id)
);

-- A Phiếu chấm is never deleted. Its identity never changes. Draft moves on freely; once confirmed, absent or
-- superseded it is immutable, except the one move confirmed → superseded that changes only state,
-- superseded_by and superseded_reason.
CREATE FUNCTION scoring.guard_score_sheet() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'a Phiếu chấm is immutable: it is never deleted' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (NEW.id, NEW.dossier_id, NEW.assignment_id, NEW.attempt, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.dossier_id, OLD.assignment_id, OLD.attempt, OLD.created_at) THEN
    RAISE EXCEPTION 'a Phiếu chấm is immutable: its identity is fixed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.state = 'draft' THEN
    RETURN NEW;
  END IF;
  IF OLD.state = 'confirmed' AND NEW.state = 'superseded'
     AND (NEW.confirmed_at, NEW.reauth_method, NEW.version, NEW.updated_at)
         IS NOT DISTINCT FROM (OLD.confirmed_at, OLD.reauth_method, OLD.version, OLD.updated_at) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'a Phiếu chấm in state % is immutable', OLD.state USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER score_sheet_guard BEFORE UPDATE OR DELETE ON scoring.score_sheet
  FOR EACH ROW EXECUTE FUNCTION scoring.guard_score_sheet();
CREATE TRIGGER score_sheet_no_truncate BEFORE TRUNCATE ON scoring.score_sheet
  FOR EACH STATEMENT EXECUTE FUNCTION scoring.guard_score_sheet();

-- The dòng (and their files) of a Phiếu chấm no longer draft cannot be inserted, changed or deleted.
CREATE FUNCTION scoring.guard_score_sheet_line() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'TRUNCATE' OR EXISTS (
    SELECT 1 FROM scoring.score_sheet s
     WHERE s.state <> 'draft'
       AND s.id IN (CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.score_sheet_id END,
                    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.score_sheet_id END)
  ) THEN
    RAISE EXCEPTION 'the dòng of a Phiếu chấm no longer draft are immutable' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['score_sheet_line', 'score_sheet_line_file'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON scoring.%I FOR EACH ROW EXECUTE FUNCTION scoring.guard_score_sheet_line()', t || '_guard', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON scoring.%I FOR EACH STATEMENT EXECUTE FUNCTION scoring.guard_score_sheet_line()', t || '_no_truncate', t);
  END LOOP;
END;
$$;

-- Bằng chứng kiểm tra uploaded by a thành viên chấm (the list of 0028 plus grading_evidence).
ALTER TABLE platform.file DROP CONSTRAINT file_purpose_check;
ALTER TABLE platform.file ADD CONSTRAINT file_purpose_check
  CHECK (purpose IN ('test_upload', 'legal_document', 'evidence', 'generated_document', 'signed_ward_report', 'council_decision', 'grading_evidence'));

GRANT SELECT, INSERT, UPDATE ON scoring.score_sheet_line TO ocop_app;
GRANT SELECT, INSERT, DELETE ON scoring.score_sheet_line_file TO ocop_app;
GRANT SELECT ON scoring.score_sheet_line, scoring.score_sheet_line_file TO ocop_readonly;
