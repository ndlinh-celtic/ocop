-- L17 SO-04 Gói đề nghị 5 sao (#89): the ZIP of a package is deleted by a worker job once past `expires_at`, not by a
-- bucket lifecycle rule (domestic S3 may not run one). The job records it in `removed_at`. A ready package may now
-- change once more: `removed_at` from null to a time, nothing else. Every other change stays refused.

ALTER TABLE results.five_star_package
  ADD COLUMN removed_at timestamptz,
  ADD CHECK (removed_at IS NULL OR state = 'ready');

-- The job's scan: ready packages not yet removed, by hạn tải.
CREATE INDEX five_star_package_to_remove ON results.five_star_package (expires_at) WHERE state = 'ready' AND removed_at IS NULL;

CREATE OR REPLACE FUNCTION results.guard_five_star_package() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.state = 'ready' AND NEW.state = 'ready' AND OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL
     AND NEW.id = OLD.id AND NEW.requested_by = OLD.requested_by AND NEW.requested_at = OLD.requested_at
     AND NEW.dossier_ids = OLD.dossier_ids AND NEW.storage_key = OLD.storage_key AND NEW.size = OLD.size
     AND NEW.expires_at = OLD.expires_at AND NEW.completed_at = OLD.completed_at AND NEW.failure IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP <> 'UPDATE' OR OLD.state <> 'pending' OR NEW.state = 'pending' OR NEW.removed_at IS NOT NULL
     OR NEW.id <> OLD.id OR NEW.requested_by <> OLD.requested_by OR NEW.requested_at <> OLD.requested_at
     OR NEW.dossier_ids <> OLD.dossier_ids THEN
    RAISE EXCEPTION 'a five-star package only moves once from pending to ready or failed, then once to removed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
