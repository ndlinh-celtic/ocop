-- L06 XA-07 Báo cáo đánh giá cấp xã and gửi tỉnh (spec #30 stories 64 to 67, ticket #42).
--
-- The Cán bộ xã generates the report as Word (never stored), has it signed outside the system and uploads
-- the signed PDF as a file of purpose `signed_ward_report`. Each upload is a row here, tied to the Phiên
-- bản nộp it reports on; the newest row is the signed report of the hồ sơ. Gửi tỉnh needs one for the
-- newest Phiên bản nộp. Rows are append-only (no UPDATE or DELETE for the app), which also keeps the
-- referenced files from ever losing their reference.

ALTER TABLE platform.file DROP CONSTRAINT file_purpose_check;
ALTER TABLE platform.file ADD CONSTRAINT file_purpose_check
  CHECK (purpose IN ('test_upload', 'legal_document', 'evidence', 'generated_document', 'signed_ward_report'));

CREATE TABLE dossier.ward_report (
  id uuid PRIMARY KEY,
  dossier_id uuid NOT NULL REFERENCES dossier.dossier (id),
  submission_number integer NOT NULL CHECK (submission_number >= 1),
  file_id uuid NOT NULL UNIQUE REFERENCES platform.file (id),
  uploaded_by uuid NOT NULL REFERENCES identity.user_account (id),
  uploaded_at timestamptz NOT NULL,
  FOREIGN KEY (dossier_id, submission_number) REFERENCES dossier.submission (dossier_id, number)
);
CREATE INDEX ward_report_dossier_idx ON dossier.ward_report (dossier_id, uploaded_at DESC);

GRANT SELECT, INSERT ON dossier.ward_report TO ocop_app;
GRANT SELECT ON dossier.ward_report TO ocop_readonly;
