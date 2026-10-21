-- L01 CT-02 hồ sơ pháp lý of a Chủ thể (spec #30, ticket #32).
--
-- Loại giấy tờ pháp lý is configuration, not code: which ones a Chủ thể must hold depends on its Loại tổ
-- chức (required_for), and the list is an assumption still to be confirmed by the chủ đầu tư. The seed
-- below is the default; changing it is a data change, never a code change.
--
-- Đã xác thực is computed when asked (every required type has a current giấy tờ, scanned clean, valid
-- today) and never stored, so it cannot drift when a giấy tờ expires.
--
-- A giấy tờ is never edited or deleted: replacing one adds a new row and stamps the old one with
-- replaced_by / replaced_at, once. The trigger refuses everything else, so history stays whole.

CREATE TABLE entity.legal_document_type (
  code text PRIMARY KEY CHECK (code ~ '^[a-z_]+$'),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  required_for text[] NOT NULL DEFAULT '{}'
    CHECK (required_for <@ ARRAY['enterprise', 'cooperative', 'household']::text[]),
  sort_order integer NOT NULL
);

GRANT SELECT ON entity.legal_document_type TO ocop_app, ocop_readonly;

INSERT INTO entity.legal_document_type (code, name, required_for, sort_order) VALUES
  ('business_registration', 'Giấy chứng nhận đăng ký doanh nghiệp, hợp tác xã hoặc hộ kinh doanh', ARRAY['enterprise', 'cooperative', 'household'], 1),
  ('food_safety', 'Giấy chứng nhận cơ sở đủ điều kiện an toàn thực phẩm hoặc bản cam kết', '{}', 2),
  ('quality_declaration', 'Bản tự công bố hoặc công bố chất lượng sản phẩm', '{}', 3),
  ('environment', 'Hồ sơ về bảo vệ môi trường', '{}', 4),
  ('other', 'Giấy tờ khác', '{}', 5);

ALTER TABLE platform.file DROP CONSTRAINT file_purpose_check;
ALTER TABLE platform.file ADD CONSTRAINT file_purpose_check CHECK (purpose IN ('test_upload', 'legal_document'));

CREATE TABLE entity.legal_document (
  id uuid PRIMARY KEY,
  entity_id uuid NOT NULL REFERENCES entity.entity (id),
  type_code text NOT NULL REFERENCES entity.legal_document_type (code),
  document_number text,
  -- Ngày cấp and the last day it is valid (VN calendar days); no valid_until means it does not expire.
  issued_on date NOT NULL,
  valid_until date,
  file_id uuid NOT NULL UNIQUE REFERENCES platform.file (id),
  added_by uuid NOT NULL REFERENCES identity.user_account (id),
  added_at timestamptz NOT NULL,
  replaced_by uuid REFERENCES entity.legal_document (id),
  replaced_at timestamptz,
  CONSTRAINT valid_after_issue CHECK (valid_until IS NULL OR valid_until >= issued_on),
  CONSTRAINT replaced_together CHECK ((replaced_by IS NULL) = (replaced_at IS NULL))
);
CREATE INDEX legal_document_entity_idx ON entity.legal_document (entity_id, type_code);

CREATE FUNCTION entity.guard_legal_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'legal documents are kept as history and cannot be deleted' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.replaced_by IS NOT NULL
     OR NEW.replaced_by IS NULL
     OR (to_jsonb(NEW) - 'replaced_by' - 'replaced_at') IS DISTINCT FROM (to_jsonb(OLD) - 'replaced_by' - 'replaced_at') THEN
    RAISE EXCEPTION 'a legal document is immutable; it can only be marked replaced, once' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER legal_document_immutable BEFORE UPDATE OR DELETE ON entity.legal_document
  FOR EACH ROW EXECUTE FUNCTION entity.guard_legal_document();

GRANT SELECT, INSERT, UPDATE ON entity.legal_document TO ocop_app;
GRANT SELECT ON entity.legal_document TO ocop_readonly;
