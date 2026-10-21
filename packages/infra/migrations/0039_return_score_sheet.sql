-- L15 HD-05 Trả phiếu (spec #49 stories 102 to 106, ADR 0008; ticket #61).
--
-- Trả phiếu supersedes the returned phiếu and opens the next lần chấm in one transaction. The partial unique
-- score_sheet_current_key allows one phiếu not superseded per Phân công, so the old one is superseded before the
-- new one is inserted, while its superseded_by already names the new one: the foreign key is checked at commit.
ALTER TABLE scoring.score_sheet ALTER CONSTRAINT score_sheet_superseded_by_fkey DEFERRABLE INITIALLY DEFERRED;

-- A phiếu Vắng is returned too, after a Mở khóa sau chốt, so that the thành viên grades for the first time
-- (spec #49 "Trả phiếu và Mở khóa sau chốt"): absent → superseded becomes the second allowed move of a phiếu no
-- longer draft, with the same rule that nothing but state, superseded_by and superseded_reason changes.
CREATE OR REPLACE FUNCTION scoring.guard_score_sheet() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'a Phiếu chấm is immutable: it is never deleted' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (NEW.id, NEW.dossier_id, NEW.assignment_id, NEW.attempt, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.dossier_id, OLD.assignment_id, OLD.attempt, OLD.created_at) THEN
    RAISE EXCEPTION 'a Phiếu chấm is immutable: its identity is fixed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.state = 'draft' THEN
    RETURN NEW;
  END IF;
  IF OLD.state IN ('confirmed', 'absent') AND NEW.state = 'superseded'
     AND (NEW.confirmed_at, NEW.reauth_method, NEW.version, NEW.updated_at)
         IS NOT DISTINCT FROM (OLD.confirmed_at, OLD.reauth_method, OLD.version, OLD.updated_at) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'a Phiếu chấm in state % is immutable', OLD.state USING ERRCODE = 'insufficient_privilege';
END;
$$;
