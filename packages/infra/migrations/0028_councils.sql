-- L09 HD-01 Hội đồng (spec #49, ticket #50).
--
-- Cán bộ Sở records a Hội đồng: tên, số and ngày of its quyết định thành lập, the uploaded quyết định, and
-- its Tổ trưởng (a Thành viên Tổ tư vấn of the Hội đồng, checked by the domain when chosen and again when a
-- Báo cáo Tổ tư vấn is issued). There is no member table: the members are the Phân vai still in force on
-- Phạm vi (council, id). A Đợt đánh giá points at the one Hội đồng responsible for it; the domain allows a
-- change until the round's first Giao chấm.

CREATE SCHEMA council;
GRANT USAGE ON SCHEMA council TO ocop_app, ocop_readonly;

CREATE TABLE council.council (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (btrim(name) <> ''),
  decision_number text NOT NULL CHECK (btrim(decision_number) <> ''),
  decision_date date NOT NULL,
  decision_file_id uuid NOT NULL REFERENCES platform.file (id),
  -- Tổ trưởng: a title within the Hội đồng, not a Vai trò (GLOSSARY.md).
  leader_user_id uuid REFERENCES identity.user_account (id),
  created_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES identity.user_account (id),
  updated_at timestamptz NOT NULL
);
CREATE INDEX council_list_idx ON council.council (created_at DESC);

GRANT SELECT, INSERT, UPDATE ON council.council TO ocop_app;
GRANT SELECT ON council.council TO ocop_readonly;

ALTER TABLE round.round ADD COLUMN council_id uuid REFERENCES council.council (id);
CREATE INDEX round_council_idx ON round.round (council_id);

-- Hội đồng members are looked up by Phạm vi: (role, scope_type, scope_id).
CREATE INDEX role_assignment_scope_idx ON identity.role_assignment (scope_type, scope_id, role);

ALTER TABLE platform.file DROP CONSTRAINT file_purpose_check;
ALTER TABLE platform.file ADD CONSTRAINT file_purpose_check
  CHECK (purpose IN ('test_upload', 'legal_document', 'evidence', 'generated_document', 'signed_ward_report', 'council_decision'));
