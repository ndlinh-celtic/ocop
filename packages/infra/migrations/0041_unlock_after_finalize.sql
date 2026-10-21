-- L15 Mở khóa sau chốt (spec #49 stories 127 to 133, ticket #63, ADR 0008).
--
-- On the Hội đồng's văn bản yêu cầu, Quản trị Mở khóa a hồ sơ Đã chốt điểm: the hồ sơ goes back to Sẵn sàng chốt
-- and its kết quả chốt hiện hành is marked superseded by the request (0038 allows exactly that change, once). The
-- request keeps the văn bản (a PDF of purpose `unlock_request`), who asked, why, who unlocked and how they Xác thực
-- lại. It never changes: the app may only add one.

DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def FROM pg_constraint WHERE conname = 'file_purpose_check' AND conrelid = 'platform.file'::regclass;
  IF def NOT LIKE '%''unlock_request''%' THEN
    ALTER TABLE platform.file DROP CONSTRAINT file_purpose_check;
    EXECUTE 'ALTER TABLE platform.file ADD CONSTRAINT file_purpose_check ' || replace(def, ']', ', ''unlock_request''::text]');
  END IF;
END;
$$;

CREATE TABLE scoring.unlock_request (
  id uuid PRIMARY KEY,
  dossier_id uuid NOT NULL REFERENCES dossier.dossier (id),
  -- The kết quả chốt it superseded; one request per kết quả.
  result_id uuid NOT NULL UNIQUE REFERENCES scoring.aggregate_result (id),
  request_file_id uuid NOT NULL REFERENCES platform.file (id),
  requested_by text NOT NULL CHECK (btrim(requested_by) <> ''),
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  unlocked_by uuid NOT NULL REFERENCES identity.user_account (id),
  unlocked_at timestamptz NOT NULL,
  reauth_method text NOT NULL CHECK (reauth_method IN ('totp', 'password'))
);
CREATE INDEX unlock_request_dossier_idx ON scoring.unlock_request (dossier_id, unlocked_at);

ALTER TABLE scoring.aggregate_result
  ADD CONSTRAINT aggregate_result_superseded_by_unlock_fkey FOREIGN KEY (superseded_by_unlock) REFERENCES scoring.unlock_request (id);

CREATE FUNCTION scoring.refuse_unlock_request_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'a Mở khóa sau chốt request is immutable' USING ERRCODE = 'insufficient_privilege';
END;
$$;
CREATE TRIGGER unlock_request_immutable BEFORE UPDATE OR DELETE ON scoring.unlock_request
  FOR EACH ROW EXECUTE FUNCTION scoring.refuse_unlock_request_change();
CREATE TRIGGER unlock_request_no_truncate BEFORE TRUNCATE ON scoring.unlock_request
  FOR EACH STATEMENT EXECUTE FUNCTION scoring.refuse_unlock_request_change();

GRANT SELECT, INSERT ON scoring.unlock_request TO ocop_app;
GRANT SELECT ON scoring.unlock_request TO ocop_readonly;
