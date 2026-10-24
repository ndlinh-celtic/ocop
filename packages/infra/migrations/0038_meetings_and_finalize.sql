-- L15 HD-08, TV-08 Phiên họp and chốt điểm (spec #49 stories 107 to 109, 116 to 126, 135; ticket #60).
--
-- A Phiên họp of a Hội đồng in a đợt lists hồ sơ Sẵn sàng chốt. A hồ sơ waits in one Phiên họp at a time: its
-- row there is pending until chốt fills `result_id`, and a Phiên họp closes only once no row of it is pending,
-- so "one pending row per hồ sơ" is "one open Phiên họp per hồ sơ". Chốt writes the kết quả chốt
-- (`aggregate_result`), numbered from 1 per hồ sơ, which nobody may change or delete: Mở khóa sau chốt only
-- marks it superseded, once (ADR 0008).

CREATE TABLE scoring.meeting (
  id uuid PRIMARY KEY,
  council_id uuid NOT NULL REFERENCES council.council (id),
  round_id uuid NOT NULL REFERENCES round.round (id),
  title text NOT NULL,
  held_on date NOT NULL,
  location text NOT NULL,
  state text NOT NULL CHECK (state IN ('open', 'closed')),
  created_by uuid NOT NULL REFERENCES identity.user_account (id),
  created_at timestamptz NOT NULL,
  closed_by uuid REFERENCES identity.user_account (id),
  closed_at timestamptz,
  CONSTRAINT meeting_closed_fields CHECK ((state = 'closed') = (closed_at IS NOT NULL) AND (closed_at IS NULL) = (closed_by IS NULL))
);
CREATE INDEX meeting_council_round_idx ON scoring.meeting (council_id, round_id);

CREATE TABLE scoring.aggregate_result (
  id uuid PRIMARY KEY,
  dossier_id uuid NOT NULL REFERENCES dossier.dossier (id),
  n integer NOT NULL CHECK (n >= 1),
  meeting_id uuid NOT NULL REFERENCES scoring.meeting (id),
  criteria_version_id uuid NOT NULL REFERENCES criteria.version (id),
  total numeric NOT NULL,
  star smallint NOT NULL CHECK (star BETWEEN 1 AND 5),
  parts jsonb NOT NULL,
  averages jsonb NOT NULL,
  unmet jsonb NOT NULL,
  deviation numeric NOT NULL,
  flagged boolean NOT NULL,
  counted_sheet_ids uuid[] NOT NULL,
  absent_sheet_ids uuid[] NOT NULL,
  snapshot jsonb NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  finalized_by uuid NOT NULL REFERENCES identity.user_account (id),
  finalized_at timestamptz NOT NULL,
  reauth_method text NOT NULL CHECK (reauth_method IN ('totp', 'password')),
  superseded_at timestamptz,
  -- The Mở khóa sau chốt request that superseded it (its table arrives with that ticket).
  superseded_by_unlock uuid,
  CONSTRAINT aggregate_result_key UNIQUE (dossier_id, n),
  CONSTRAINT aggregate_result_superseded_fields CHECK (superseded_by_unlock IS NULL OR superseded_at IS NOT NULL)
);
-- "Kết quả hiện hành" is the one not superseded.
CREATE UNIQUE INDEX aggregate_result_current_key ON scoring.aggregate_result (dossier_id) WHERE superseded_at IS NULL;

CREATE TABLE scoring.meeting_dossier (
  meeting_id uuid NOT NULL REFERENCES scoring.meeting (id),
  dossier_id uuid NOT NULL REFERENCES dossier.dossier (id),
  added_by uuid NOT NULL REFERENCES identity.user_account (id),
  added_at timestamptz NOT NULL,
  -- Set by chốt; until then the hồ sơ is pending in this Phiên họp and may be gỡ (deleted).
  result_id uuid REFERENCES scoring.aggregate_result (id),
  PRIMARY KEY (meeting_id, dossier_id)
);
CREATE UNIQUE INDEX meeting_dossier_pending_key ON scoring.meeting_dossier (dossier_id) WHERE result_id IS NULL;

-- A kết quả chốt is fixed; the only change is setting superseded_at (and superseded_by_unlock) from null, once.
CREATE FUNCTION scoring.guard_aggregate_result() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.superseded_at IS NULL AND NEW.superseded_at IS NOT NULL
     AND to_jsonb(NEW) - 'superseded_at' - 'superseded_by_unlock' = to_jsonb(OLD) - 'superseded_at' - 'superseded_by_unlock' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'a kết quả chốt is immutable; Mở khóa sau chốt only marks it superseded' USING ERRCODE = 'insufficient_privilege';
END;
$$;
CREATE TRIGGER aggregate_result_immutable BEFORE UPDATE OR DELETE ON scoring.aggregate_result
  FOR EACH ROW EXECUTE FUNCTION scoring.guard_aggregate_result();
CREATE TRIGGER aggregate_result_no_truncate BEFORE TRUNCATE ON scoring.aggregate_result
  FOR EACH STATEMENT EXECUTE FUNCTION scoring.guard_aggregate_result();

-- A hồ sơ chốt in a Phiên họp stays in it: its row is neither changed nor removed.
CREATE FUNCTION scoring.guard_meeting_dossier() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.result_id IS NULL AND NEW.result_id IS NOT NULL
     AND NEW.meeting_id = OLD.meeting_id AND NEW.dossier_id = OLD.dossier_id AND NEW.added_by = OLD.added_by AND NEW.added_at = OLD.added_at THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' AND OLD.result_id IS NULL THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'a hồ sơ chốt in a Phiên họp is fixed there' USING ERRCODE = 'insufficient_privilege';
END;
$$;
CREATE TRIGGER meeting_dossier_guard BEFORE UPDATE OR DELETE ON scoring.meeting_dossier
  FOR EACH ROW EXECUTE FUNCTION scoring.guard_meeting_dossier();

GRANT SELECT, INSERT, UPDATE ON scoring.meeting TO ocop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON scoring.meeting_dossier TO ocop_app;
GRANT SELECT, INSERT ON scoring.aggregate_result TO ocop_app;
GRANT UPDATE (superseded_at, superseded_by_unlock) ON scoring.aggregate_result TO ocop_app;
GRANT SELECT ON scoring.meeting, scoring.meeting_dossier, scoring.aggregate_result TO ocop_readonly;
