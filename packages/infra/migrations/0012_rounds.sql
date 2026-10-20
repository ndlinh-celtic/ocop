-- L07 SO-01 Đợt đánh giá (spec #16, ticket #24). Trạng thái đợt:
--   draft → open_for_submission → submission_closed → ended
-- (submission_closed → open_for_submission again when Hạn nộp xã is extended, #26).
-- Deadlines are timestamptz in UTC; the app turns a calendar date into 23:59:59 Asia/Ho_Chi_Minh.
-- Quy tắc tổng hợp is typed columns (method, minimum graders, deviation flag in points), not JSON,
-- so a CHECK keeps it valid; #27 changes them while the round has no phiếu chấm.

CREATE SCHEMA round;
GRANT USAGE ON SCHEMA round TO ocop_app, ocop_readonly;

CREATE TABLE round.round (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  year smallint NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  status text NOT NULL CHECK (status IN ('draft', 'open_for_submission', 'submission_closed', 'ended')),
  -- The one Phiên bản tiêu chí the round applies; only a published one (trigger below), fixed once opened.
  criteria_version_id uuid NOT NULL REFERENCES criteria.version (id),
  submission_deadline timestamptz NOT NULL, -- Hạn nộp xã
  forwarding_deadline timestamptz NOT NULL, -- Hạn gửi tỉnh
  evaluation_deadline timestamptz NOT NULL, -- Hạn đánh giá tỉnh (reminder only)
  grading_mode text NOT NULL CHECK (grading_mode IN ('direct', 'advisory_based')),
  aggregation_method text NOT NULL CHECK (aggregation_method IN ('mean')),
  min_graders smallint NOT NULL CHECK (min_graders BETWEEN 1 AND 50),
  deviation_flag_points numeric(7, 2) NOT NULL CHECK (deviation_flag_points >= 0),
  created_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES identity.user_account (id),
  updated_at timestamptz NOT NULL,
  opened_at timestamptz,
  opened_by uuid REFERENCES identity.user_account (id),
  -- When submission last closed (auto-close job, #25); kept when an extension reopens the round (#26).
  submission_closed_at timestamptz,
  ended_at timestamptz,
  ended_by uuid REFERENCES identity.user_account (id),
  CONSTRAINT deadlines_ordered CHECK (submission_deadline <= forwarding_deadline AND forwarding_deadline <= evaluation_deadline),
  CONSTRAINT opened_fields CHECK ((status = 'draft') = (opened_at IS NULL)),
  CONSTRAINT ended_fields CHECK ((status = 'ended') = (ended_at IS NOT NULL))
);

-- At most one round Đang nhận nộp at any time; the domain checks first to give a clear error.
CREATE UNIQUE INDEX round_one_open ON round.round ((true)) WHERE status = 'open_for_submission';
-- The auto-close job (#25) looks up open rounds past Hạn nộp xã.
CREATE INDEX round_open_deadline_idx ON round.round (submission_deadline) WHERE status = 'open_for_submission';
CREATE INDEX round_list_idx ON round.round (year DESC, created_at DESC);
CREATE INDEX round_criteria_version_idx ON round.round (criteria_version_id);

-- Second layer behind the domain: a round points at a published Phiên bản tiêu chí, keeps it once
-- opened, and only a draft round may be deleted.
CREATE FUNCTION round.guard_round() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'round % is not a draft and cannot be deleted', OLD.id USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status <> 'draft' AND NEW.criteria_version_id IS DISTINCT FROM OLD.criteria_version_id THEN
    RAISE EXCEPTION 'round % is opened; its criteria version is fixed', OLD.id USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (TG_OP = 'INSERT' OR NEW.criteria_version_id IS DISTINCT FROM OLD.criteria_version_id)
     AND NOT EXISTS (SELECT 1 FROM criteria.version v WHERE v.id = NEW.criteria_version_id AND v.status = 'published') THEN
    RAISE EXCEPTION 'criteria version % is not published', NEW.criteria_version_id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER round_guard BEFORE INSERT OR UPDATE OR DELETE ON round.round FOR EACH ROW EXECUTE FUNCTION round.guard_round();

GRANT SELECT, INSERT, UPDATE, DELETE ON round.round TO ocop_app;
GRANT SELECT ON round.round TO ocop_readonly;
