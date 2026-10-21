-- L10 TM-03 Đề nghị trả về của Tổ tư vấn (spec #49 stories 51 to 53, ticket #57).
--
-- While it thẩm định a hồ sơ, a Thành viên Tổ tư vấn Phân công on it asks the Sở to trả về the hồ sơ to the
-- xã, with a lý do. Like the xã's đề nghị of 0027, the request does not change the hồ sơ's state: the Sở
-- decides, and its trả về is the yêu cầu bổ sung of 0024. It is internal to the Sở and the Tổ tư vấn, so it
-- has a table of its own that the xã and the Chủ thể never read. Append-only for the app; whether one is
-- still pending is worked out from the hồ sơ's state and its grading_started_at.

CREATE TABLE dossier.advisory_return_request (
  id uuid PRIMARY KEY,
  dossier_id uuid NOT NULL REFERENCES dossier.dossier (id),
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  requested_by uuid NOT NULL REFERENCES identity.user_account (id),
  requested_at timestamptz NOT NULL
);
CREATE INDEX advisory_return_request_dossier_idx ON dossier.advisory_return_request (dossier_id, requested_at);

GRANT SELECT, INSERT ON dossier.advisory_return_request TO ocop_app;
GRANT SELECT ON dossier.advisory_return_request TO ocop_readonly;
