-- L04 Đề nghị trả về (spec #30 story 59, ticket #44).
--
-- A Cán bộ xã who finds a mistake in a hồ sơ already gửi tỉnh asks the Sở to trả về it, with a lý do. The
-- request does not change the hồ sơ's state: the Sở decides, and its trả về is the yêu cầu bổ sung of
-- 0024. Requests are append-only (no UPDATE or DELETE for the app); whether one is still pending is worked
-- out from the hồ sơ's state and timeline.

CREATE TABLE dossier.return_request (
  id uuid PRIMARY KEY,
  dossier_id uuid NOT NULL REFERENCES dossier.dossier (id),
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  requested_by uuid NOT NULL REFERENCES identity.user_account (id),
  requested_at timestamptz NOT NULL
);
CREATE INDEX return_request_dossier_idx ON dossier.return_request (dossier_id, requested_at);

-- Số hồ sơ chưa xong of a đợt (L07, rounds' RoundActivity port) counts by round and state.
CREATE INDEX dossier_round_state_idx ON dossier.dossier (round_id, state) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT ON dossier.return_request TO ocop_app;
GRANT SELECT ON dossier.return_request TO ocop_readonly;
