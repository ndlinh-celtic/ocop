-- L17 SO-04 Đề xuất 5 sao (spec #79 stories 46, 53 to 55, 58 to 60, 67; ticket #87; ADR 0009).
--
-- A hồ sơ 5 sao Công bố stays Đã chốt điểm until the Cán bộ Sở đánh dấu đã gửi: the số công văn and ngày gửi of the
-- tỉnh's đề nghị go to `results.five_star_dispatch` and the hồ sơ becomes Đã gửi đề nghị 5 sao. On the Bộ's answer:
-- - Chuyển về công nhận cấp tỉnh sets `awaiting_supplementary_decision` on the hồ sơ with the Bộ's văn bản
--   (`ministry_return_file_id`); the hồ sơ waits, still Đã gửi đề nghị 5 sao, for a Quyết định công nhận bổ sung (#88).
-- - Đóng hồ sơ records `results.five_star_closure`: Bộ công nhận 5 sao (số, ngày quyết định of the Bộ, tệp) or kết quả
--   khác (tệp); the hồ sơ becomes Đã đóng, xử lý ngoài hệ thống.
-- Both tables are append-only. The Bộ's văn bản are PDFs of the new purpose `ministry_document`.

DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def FROM pg_constraint WHERE conname = 'file_purpose_check' AND conrelid = 'platform.file'::regclass;
  IF def NOT LIKE '%''ministry_document''%' THEN
    ALTER TABLE platform.file DROP CONSTRAINT file_purpose_check;
    EXECUTE 'ALTER TABLE platform.file ADD CONSTRAINT file_purpose_check ' || replace(def, ']', ', ''ministry_document''::text]');
  END IF;
END;
$$;

ALTER TABLE dossier.dossier
  ADD COLUMN awaiting_supplementary_decision boolean NOT NULL DEFAULT false,
  ADD COLUMN ministry_return_file_id uuid REFERENCES platform.file (id),
  ADD CONSTRAINT dossier_awaiting_supplementary_has_file CHECK (NOT awaiting_supplementary_decision OR ministry_return_file_id IS NOT NULL);

CREATE TABLE results.five_star_dispatch (
  dossier_id uuid PRIMARY KEY REFERENCES dossier.dossier (id),
  dispatch_number text NOT NULL CHECK (char_length(btrim(dispatch_number)) BETWEEN 1 AND 100),
  sent_on date NOT NULL,
  recorded_by uuid NOT NULL REFERENCES identity.user_account (id),
  recorded_at timestamptz NOT NULL
);

CREATE TABLE results.five_star_closure (
  dossier_id uuid PRIMARY KEY REFERENCES dossier.dossier (id),
  outcome text NOT NULL CHECK (outcome IN ('ministry_recognized_5_star', 'other')),
  decision_number text CHECK (char_length(btrim(decision_number)) BETWEEN 1 AND 100),
  decided_on date,
  file_id uuid NOT NULL UNIQUE REFERENCES platform.file (id),
  closed_by uuid NOT NULL REFERENCES identity.user_account (id),
  closed_at timestamptz NOT NULL,
  CHECK (outcome <> 'ministry_recognized_5_star' OR (decision_number IS NOT NULL AND decided_on IS NOT NULL))
);

CREATE FUNCTION results.refuse_five_star_record_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'what the Sở recorded on a hồ sơ đề nghị 5 sao never changes' USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER five_star_dispatch_immutable BEFORE UPDATE OR DELETE ON results.five_star_dispatch
  FOR EACH ROW EXECUTE FUNCTION results.refuse_five_star_record_change();
CREATE TRIGGER five_star_dispatch_no_truncate BEFORE TRUNCATE ON results.five_star_dispatch
  FOR EACH STATEMENT EXECUTE FUNCTION results.refuse_five_star_record_change();
CREATE TRIGGER five_star_closure_immutable BEFORE UPDATE OR DELETE ON results.five_star_closure
  FOR EACH ROW EXECUTE FUNCTION results.refuse_five_star_record_change();
CREATE TRIGGER five_star_closure_no_truncate BEFORE TRUNCATE ON results.five_star_closure
  FOR EACH STATEMENT EXECUTE FUNCTION results.refuse_five_star_record_change();

GRANT SELECT, INSERT ON results.five_star_dispatch, results.five_star_closure TO ocop_app;
GRANT SELECT ON results.five_star_dispatch, results.five_star_closure TO ocop_readonly;
