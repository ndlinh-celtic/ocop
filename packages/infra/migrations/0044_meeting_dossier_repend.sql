-- L15 Mở khóa sau chốt (spec #49, ADR 0008; code review of step 4): a hồ sơ chốt in a Phiên họp still open and then
-- unlocked may be added to that Phiên họp again, to chốt there as kết quả n + 1. Its meeting_dossier row goes back to
-- pending (result_id null) only while the kết quả it names is superseded; the kết quả itself keeps its meeting_id.
-- Every other change of a row chốt stays refused.
CREATE OR REPLACE FUNCTION scoring.guard_meeting_dossier() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.result_id IS NULL AND NEW.result_id IS NOT NULL
     AND NEW.meeting_id = OLD.meeting_id AND NEW.dossier_id = OLD.dossier_id AND NEW.added_by = OLD.added_by AND NEW.added_at = OLD.added_at THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.result_id IS NOT NULL AND NEW.result_id IS NULL
     AND NEW.meeting_id = OLD.meeting_id AND NEW.dossier_id = OLD.dossier_id AND NEW.added_by = OLD.added_by AND NEW.added_at = OLD.added_at
     AND EXISTS (SELECT 1 FROM scoring.aggregate_result r WHERE r.id = OLD.result_id AND r.superseded_at IS NOT NULL) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' AND OLD.result_id IS NULL THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'a hồ sơ chốt in a Phiên họp is fixed there' USING ERRCODE = 'insufficient_privilege';
END;
$$;
