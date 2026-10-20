-- L03 (spec #30, ticket #37): the Phiếu đăng ký and Báo cáo tự đánh giá generated on each nộp are files
-- of their own, written by the server and stored `clean` at once. dossier.submission_file ties them to
-- their Phiên bản nộp (roles registration_form and self_assessment_report), which keeps them from ever
-- being deleted; each nộp writes new files, so an earlier one never changes.
ALTER TABLE platform.file DROP CONSTRAINT file_purpose_check;
ALTER TABLE platform.file ADD CONSTRAINT file_purpose_check CHECK (purpose IN ('test_upload', 'legal_document', 'evidence', 'generated_document'));
