-- L09 HD-02, HD-03 (spec #49 story 28; code review of step 4): one person is never both Thành viên Tổ tư vấn
-- and thành viên chấm of one hồ sơ, even after being replaced. The partial unique index of 0030 only covers
-- the current rows; this trigger refuses a Phân công of one kind for a Người dùng who has, or had, a Phân công
-- of the other kind on the same hồ sơ. Kind and who are fixed after insert (0030's guard), so INSERT is enough.
-- The advisory lock serialises two inserts for the same (hồ sơ, Người dùng).

CREATE FUNCTION council.refuse_two_roles() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.dossier_id::text || ':' || NEW.user_id::text, 0));
  IF EXISTS (
    SELECT 1 FROM council.assignment
    WHERE dossier_id = NEW.dossier_id AND user_id = NEW.user_id AND kind <> NEW.kind
  ) THEN
    RAISE EXCEPTION 'one person cannot be both Tổ tư vấn and thành viên chấm of one hồ sơ' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER assignment_one_role BEFORE INSERT ON council.assignment
  FOR EACH ROW EXECUTE FUNCTION council.refuse_two_roles();

GRANT EXECUTE ON FUNCTION council.refuse_two_roles() TO ocop_app;
