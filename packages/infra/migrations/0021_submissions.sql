-- L03 CT-09 Phiên bản nộp (spec #30, ticket #36).
--
-- Each nộp or nộp lại appends one Phiên bản nộp: its number within the hồ sơ and a JSONB snapshot of
-- the bản làm việc at that moment (thông tin sản phẩm, định danh of the Chủ thể, giấy tờ pháp lý, gắn
-- minh chứng – tiêu chí with giải trình, tự chấm by Mức điểm, and the generated Phiếu đăng ký and Báo
-- cáo tự đánh giá). Xã, tỉnh and hội đồng work on the newest one.
--
-- Three layers keep it unchanged: the core never updates it, ocop_app holds only SELECT and INSERT, and
-- the triggers below refuse UPDATE, DELETE and TRUNCATE for anyone, the owner included. ocop_app does
-- not own the tables, so it cannot disable the triggers.

CREATE TABLE dossier.submission (
  id uuid PRIMARY KEY,
  dossier_id uuid NOT NULL REFERENCES dossier.dossier (id),
  number integer NOT NULL CHECK (number >= 1),
  round_id uuid NOT NULL REFERENCES round.round (id),
  ward_id uuid NOT NULL REFERENCES org.ward (id),
  submitted_at timestamptz NOT NULL,
  submitted_by uuid NOT NULL REFERENCES identity.user_account (id),
  snapshot jsonb NOT NULL,
  UNIQUE (dossier_id, number)
);

-- Every file a Phiên bản nộp refers to, by id (never a copy of its bytes): minh chứng, giấy tờ pháp lý
-- and the generated documents. The foreign key is what keeps such a file from ever being deleted; the
-- Chủ thể can only take it out of the bản làm việc.
CREATE TABLE dossier.submission_file (
  submission_id uuid NOT NULL REFERENCES dossier.submission (id),
  file_id uuid NOT NULL REFERENCES platform.file (id),
  role text NOT NULL CHECK (role IN ('evidence', 'legal_document', 'registration_form', 'self_assessment_report')),
  PRIMARY KEY (submission_id, file_id, role)
);
CREATE INDEX submission_file_file_idx ON dossier.submission_file (file_id);

CREATE FUNCTION dossier.refuse_submission_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'a Phiên bản nộp is immutable' USING ERRCODE = 'insufficient_privilege';
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['submission', 'submission_file'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON dossier.%I FOR EACH ROW EXECUTE FUNCTION dossier.refuse_submission_change()', t || '_immutable', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON dossier.%I FOR EACH STATEMENT EXECUTE FUNCTION dossier.refuse_submission_change()', t || '_no_truncate', t);
  END LOOP;
END;
$$;

GRANT SELECT, INSERT ON dossier.submission, dossier.submission_file TO ocop_app;
GRANT SELECT ON dossier.submission, dossier.submission_file TO ocop_readonly;
