-- L16 CT-13, HD-10 Nhận xét chung and Công bố kết quả (spec #79 stories 1 to 8, ticket #80).
--
-- The Chủ tịch or Thư ký writes the Nhận xét chung of a hồ sơ Đã chốt điểm (at most 4.000 ký tự), kept on the hồ sơ
-- beside who last changed it and when, outside the snapshot chốt (so its hash does not change). Công bố kết quả
-- (`result_published_at`) is set by a later ticket when a Quyết định công nhận naming the hồ sơ is recorded or its first
-- Thư kết quả không đạt is issued: once set it never changes, and the Nhận xét chung no longer does either.

ALTER TABLE dossier.dossier
  ADD COLUMN result_published_at timestamptz,
  ADD COLUMN general_comment text CHECK (char_length(general_comment) <= 4000),
  ADD COLUMN general_comment_updated_at timestamptz,
  ADD COLUMN general_comment_updated_by uuid REFERENCES identity.user_account (id);

CREATE FUNCTION dossier.guard_result_published() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.result_published_at IS NOT NULL AND NEW.result_published_at IS DISTINCT FROM OLD.result_published_at THEN
    RAISE EXCEPTION 'the Công bố kết quả of a dossier is fixed once published' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.result_published_at IS NOT NULL
     AND (NEW.general_comment IS DISTINCT FROM OLD.general_comment
          OR NEW.general_comment_updated_at IS DISTINCT FROM OLD.general_comment_updated_at
          OR NEW.general_comment_updated_by IS DISTINCT FROM OLD.general_comment_updated_by) THEN
    RAISE EXCEPTION 'the Nhận xét chung of a dossier whose result is published is fixed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER dossier_guard_result_published BEFORE UPDATE ON dossier.dossier
  FOR EACH ROW EXECUTE FUNCTION dossier.guard_result_published();
