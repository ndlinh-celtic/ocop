-- L06 XA-04 Checklist sơ bộ (spec #30 stories 60 to 62, ticket #41).
--
-- The list of items belongs to the đợt: an ordered JSON array of {code, label}, filled with five defaults
-- when the round is created and editable only while the round is Nháp (domain check plus the trigger
-- below). The results belong to the hồ sơ: one row per item the Cán bộ xã assessed, keyed by the item's
-- code within the hồ sơ's đợt. Nhận xét are working notes of the xã and never reach the Chủ thể.

ALTER TABLE round.round ADD COLUMN checklist jsonb;
UPDATE round.round SET checklist = '[
  {"code": "legal", "label": "Tính pháp lý (giấy tờ kinh doanh, an toàn thực phẩm, môi trường)"},
  {"code": "registration_documents", "label": "Tính hợp lệ của Phiếu đăng ký và Báo cáo tự đánh giá"},
  {"code": "local_materials", "label": "Nguồn gốc nguyên liệu địa phương và quy mô sản xuất"},
  {"code": "local_labor", "label": "Lao động địa phương"},
  {"code": "cultural_identity", "label": "Bản sắc văn hóa và trí tuệ bản địa"}
]'::jsonb;
ALTER TABLE round.round
  ALTER COLUMN checklist SET NOT NULL,
  ADD CONSTRAINT checklist_is_list CHECK (jsonb_typeof(checklist) = 'array' AND jsonb_array_length(checklist) BETWEEN 1 AND 50);

-- Second layer behind the domain: once a round has left Nháp, its Checklist sơ bộ is fixed, so every
-- hồ sơ of the round is assessed against the same items.
CREATE FUNCTION round.guard_checklist() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'draft' AND NEW.checklist IS DISTINCT FROM OLD.checklist THEN
    RAISE EXCEPTION 'round % is opened; its preliminary checklist is fixed', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER round_guard_checklist BEFORE UPDATE OF checklist ON round.round FOR EACH ROW EXECUTE FUNCTION round.guard_checklist();

CREATE TABLE dossier.checklist_result (
  dossier_id uuid NOT NULL REFERENCES dossier.dossier (id),
  item_code text NOT NULL CHECK (length(item_code) BETWEEN 1 AND 64),
  result text NOT NULL CHECK (result IN ('pass', 'fail', 'needs_verification')),
  comment text NOT NULL DEFAULT '',
  assessed_at timestamptz NOT NULL,
  assessed_by uuid NOT NULL REFERENCES identity.user_account (id),
  PRIMARY KEY (dossier_id, item_code),
  -- "Cần xác minh" says what is to be verified.
  CONSTRAINT verification_explained CHECK (result <> 'needs_verification' OR length(btrim(comment)) > 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON dossier.checklist_result TO ocop_app;
GRANT SELECT ON dossier.checklist_result TO ocop_readonly;
