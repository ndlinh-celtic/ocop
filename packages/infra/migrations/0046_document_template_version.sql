-- Mẫu văn bản có phiên bản (spec #79 stories 70 to 79; ticket #82).
--
-- The Quản trị uploads a Word template (purpose `document_template`) as phiên bản n of one loại văn bản, numbered
-- 1, 2, … per loại. At most one phiên bản per loại is `active`, the mẫu đang dùng; none means the mẫu mặc định shipped
-- with the app. A phiên bản is never changed or removed: only `active` moves. `kind` is not CHECKed: the loại grow
-- with the văn bản of later tickets, and the core refuses an unknown one. Văn bản stored from a template (Giấy chứng
-- nhận, Thư kết quả...) reference the phiên bản they used through their own `template_version_id`.

-- Appends the purpose to whatever list the earlier migrations left (the DO-block trick of 0033).
DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def FROM pg_constraint WHERE conname = 'file_purpose_check' AND conrelid = 'platform.file'::regclass;
  IF def NOT LIKE '%''document_template''%' THEN
    ALTER TABLE platform.file DROP CONSTRAINT file_purpose_check;
    EXECUTE 'ALTER TABLE platform.file ADD CONSTRAINT file_purpose_check ' || replace(def, ']', ', ''document_template''::text]');
  END IF;
END;
$$;

CREATE TABLE platform.document_template_version (
  id uuid PRIMARY KEY,
  kind text NOT NULL,
  n integer NOT NULL CHECK (n >= 1),
  file_id uuid NOT NULL UNIQUE REFERENCES platform.file (id),
  uploaded_by uuid NOT NULL REFERENCES identity.user_account (id),
  uploaded_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT false,
  UNIQUE (kind, n)
);

CREATE UNIQUE INDEX document_template_version_one_active ON platform.document_template_version (kind) WHERE active;

CREATE FUNCTION platform.guard_document_template_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.id = OLD.id AND NEW.kind = OLD.kind AND NEW.n = OLD.n AND NEW.file_id = OLD.file_id
     AND NEW.uploaded_by = OLD.uploaded_by AND NEW.uploaded_at = OLD.uploaded_at THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'a phiên bản mẫu is immutable; only which one is active may change' USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER document_template_version_guard BEFORE UPDATE OR DELETE ON platform.document_template_version
  FOR EACH ROW EXECUTE FUNCTION platform.guard_document_template_version();
CREATE TRIGGER document_template_version_no_truncate BEFORE TRUNCATE ON platform.document_template_version
  FOR EACH STATEMENT EXECUTE FUNCTION platform.guard_document_template_version();

GRANT SELECT, INSERT ON platform.document_template_version TO ocop_app;
GRANT UPDATE (active) ON platform.document_template_version TO ocop_app;
GRANT SELECT ON platform.document_template_version TO ocop_readonly;
