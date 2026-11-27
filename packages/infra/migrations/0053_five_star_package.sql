-- L17 SO-04 Gói đề nghị 5 sao (spec #79 stories 47 to 52, 61; ticket #89).
--
-- The Cán bộ Sở picks hồ sơ of the "Đề xuất 5 sao" list and exports a ZIP. Each export is one row: who asked, the hồ sơ
-- in order, and how the job ended. `pending` → `ready` (the object `storage_key` under `exports/`, its size and hạn tải)
-- or → `failed` (with the reason); nothing else ever changes. The bucket's lifecycle rule deletes `exports/` objects
-- after 7 days, which `expires_at` mirrors. Exporting never touches a hồ sơ.

CREATE TABLE results.five_star_package (
  id uuid PRIMARY KEY,
  requested_by uuid NOT NULL REFERENCES identity.user_account (id),
  requested_at timestamptz NOT NULL,
  dossier_ids uuid[] NOT NULL CHECK (cardinality(dossier_ids) BETWEEN 1 AND 50),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'ready', 'failed')),
  storage_key text,
  size bigint,
  expires_at timestamptz,
  completed_at timestamptz,
  failure text,
  CHECK (state <> 'ready' OR (storage_key IS NOT NULL AND size IS NOT NULL AND expires_at IS NOT NULL AND completed_at IS NOT NULL)),
  CHECK (state <> 'failed' OR (failure IS NOT NULL AND completed_at IS NOT NULL))
);

CREATE INDEX five_star_package_requested_at ON results.five_star_package (requested_at DESC);

-- A package is finished once: only a pending row may change, only to ready or failed, and never what was asked.
CREATE FUNCTION results.guard_five_star_package() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.state <> 'pending' OR NEW.state = 'pending'
     OR NEW.id <> OLD.id OR NEW.requested_by <> OLD.requested_by OR NEW.requested_at <> OLD.requested_at
     OR NEW.dossier_ids <> OLD.dossier_ids THEN
    RAISE EXCEPTION 'a five-star package only moves once from pending to ready or failed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER five_star_package_guard BEFORE UPDATE OR DELETE ON results.five_star_package
  FOR EACH ROW EXECUTE FUNCTION results.guard_five_star_package();
CREATE TRIGGER five_star_package_no_truncate BEFORE TRUNCATE ON results.five_star_package
  FOR EACH STATEMENT EXECUTE FUNCTION results.refuse_five_star_record_change();

GRANT SELECT, INSERT, UPDATE ON results.five_star_package TO ocop_app;
GRANT SELECT ON results.five_star_package TO ocop_readonly;
