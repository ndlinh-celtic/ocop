-- L16 HD-10, CT-13 Thư kết quả không đạt (spec #79 stories 36 to 45, 66; ticket #85).
--
-- The Cán bộ Sở issues the letter of a hồ sơ dưới 3 sao Đã chốt điểm: the Tiêu chí dưới mức it lists (mã, tên, điểm trung
-- bình, điểm tối đa, lý do min_star | low_ratio; none for one the Sở added), the lời khuyên, and the PDF generated from
-- the Mẫu văn bản (template_version_id, null for the mẫu mặc định). A thư đính chính is the next n with its lý do; the
-- letters already issued never change.

CREATE TABLE results.result_letter (
  id uuid PRIMARY KEY,
  dossier_id uuid NOT NULL REFERENCES dossier.dossier (id),
  n integer NOT NULL CHECK (n >= 1),
  criteria jsonb NOT NULL CHECK (jsonb_typeof(criteria) = 'array'),
  advice text NOT NULL CHECK (char_length(advice) <= 4000),
  reason text CHECK (char_length(reason) <= 1000),
  file_id uuid NOT NULL UNIQUE REFERENCES platform.file (id),
  template_version_id uuid REFERENCES platform.document_template_version (id),
  issued_by uuid NOT NULL REFERENCES identity.user_account (id),
  issued_at timestamptz NOT NULL,
  UNIQUE (dossier_id, n),
  -- Story 43: a thư đính chính says why; the first letter has no lý do.
  CHECK ((n = 1 AND reason IS NULL) OR (n > 1 AND reason IS NOT NULL AND btrim(reason) <> ''))
);

CREATE FUNCTION results.refuse_result_letter_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'a Thư kết quả không đạt never changes; issue a thư đính chính instead' USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER result_letter_immutable BEFORE UPDATE OR DELETE ON results.result_letter
  FOR EACH ROW EXECUTE FUNCTION results.refuse_result_letter_change();
CREATE TRIGGER result_letter_no_truncate BEFORE TRUNCATE ON results.result_letter
  FOR EACH STATEMENT EXECUTE FUNCTION results.refuse_result_letter_change();

GRANT SELECT, INSERT ON results.result_letter TO ocop_app;
GRANT SELECT ON results.result_letter TO ocop_readonly;
