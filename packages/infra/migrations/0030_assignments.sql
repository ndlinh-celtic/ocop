-- L09 HD-02, HD-03 Phân công (spec #49 stories 24 to 29, 41, 79; ticket #52).
--
-- A Phân công puts one Người dùng on one hồ sơ, as thành viên chấm (`member`) or as Thành viên Tổ tư vấn
-- (`advisory`). The Thư ký writes them as nháp (effective_at null) and changes them freely; Giao chấm sets
-- effective_at once and it never changes, and only from then on does the Người dùng see the hồ sơ. A
-- Phân công in force is never deleted: a later change replaces it (replaced_at/by/reason), and a replaced
-- one is final. The partial unique index keeps one current row per (hồ sơ, Người dùng) whatever the kind,
-- so nobody is both Tổ tư vấn and thành viên chấm of one hồ sơ (CLAUDE.md, story 28).

CREATE TABLE council.assignment (
  id uuid PRIMARY KEY,
  dossier_id uuid NOT NULL REFERENCES dossier.dossier (id),
  user_id uuid NOT NULL REFERENCES identity.user_account (id),
  kind text NOT NULL CHECK (kind IN ('member', 'advisory')),
  created_by uuid NOT NULL REFERENCES identity.user_account (id),
  created_at timestamptz NOT NULL,
  effective_at timestamptz,
  replaced_at timestamptz,
  -- The Người dùng (a Thư ký) who replaced it.
  replaced_by uuid REFERENCES identity.user_account (id),
  replace_reason text,
  CONSTRAINT assignment_replaced_together CHECK ((replaced_at IS NULL) = (replaced_by IS NULL)),
  CONSTRAINT assignment_replaced_after_effect CHECK (replaced_at IS NULL OR effective_at IS NOT NULL)
);

CREATE UNIQUE INDEX assignment_current_key ON council.assignment (dossier_id, user_id) WHERE replaced_at IS NULL;
-- The DataScope `assigned`: the hồ sơ a Người dùng has a Phân công in force on.
CREATE INDEX assignment_in_force_idx ON council.assignment (user_id, kind) WHERE effective_at IS NOT NULL AND replaced_at IS NULL;

-- Who, on which hồ sơ, as what, and when it took effect are fixed; a replaced row is final; a row in force
-- (or replaced) is never deleted. Only a nháp may go away.
CREATE FUNCTION council.guard_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.effective_at IS NOT NULL THEN
      RAISE EXCEPTION 'a Phân công in force is fixed; replace it instead' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.replaced_at IS NOT NULL THEN
    RAISE EXCEPTION 'a replaced Phân công is fixed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.dossier_id IS DISTINCT FROM OLD.dossier_id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'who a Phân công names is fixed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.effective_at IS NOT NULL AND NEW.effective_at IS DISTINCT FROM OLD.effective_at THEN
    RAISE EXCEPTION 'the effective_at of a Phân công is fixed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER assignment_guard BEFORE UPDATE OR DELETE ON council.assignment
  FOR EACH ROW EXECUTE FUNCTION council.guard_assignment();

GRANT SELECT, INSERT, UPDATE, DELETE ON council.assignment TO ocop_app;
GRANT SELECT ON council.assignment TO ocop_readonly;
