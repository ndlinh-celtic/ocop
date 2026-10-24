-- L08 SO-02 Tiếp nhận tại tỉnh and SO-03 mã hồ sơ (spec #49 stories 13 to 19, ticket #51).
--
-- Tiếp nhận tại tỉnh is an event of a hồ sơ Đã chuyển tỉnh, not a state. province_received_at/by hold the
-- Tiếp nhận of the current lượt gửi tỉnh and go back to null on every Sở trả về; first_province_received_at
-- holds the first one ever and never changes once set (the Hội đồng sees the hồ sơ from then on).
--
-- Mã hồ sơ: the tracking code people see, HS-<năm>-<số>, given when the hồ sơ is created (ADR 0004: never
-- the technical id). The số runs per year (giờ Việt Nam) from a counter row taken with UPDATE ... RETURNING
-- inside the creating transaction, like the cert_counter planned for giấy chứng nhận, not a sequence.

ALTER TABLE dossier.dossier
  ADD COLUMN code text,
  ADD COLUMN province_received_at timestamptz,
  ADD COLUMN province_received_by uuid REFERENCES identity.user_account (id),
  ADD COLUMN first_province_received_at timestamptz,
  ADD CONSTRAINT province_received_together CHECK ((province_received_at IS NULL) = (province_received_by IS NULL)),
  ADD CONSTRAINT province_received_after_first CHECK (province_received_at IS NULL OR first_province_received_at IS NOT NULL);

CREATE TABLE dossier.code_counter (
  year integer PRIMARY KEY CHECK (year BETWEEN 2000 AND 9999),
  last_number integer NOT NULL CHECK (last_number >= 1)
);

-- Existing hồ sơ, deleted Nháp included, get their mã in creation order within their year. This is a
-- one-off fill of a new column, not a change of the hồ sơ, so dossier_guard (version bump, deleted rows)
-- is off for it.
ALTER TABLE dossier.dossier DISABLE TRIGGER dossier_guard;
WITH numbered AS (
  SELECT id,
         extract(year FROM created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS year,
         row_number() OVER (PARTITION BY extract(year FROM created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') ORDER BY created_at, id) AS n
  FROM dossier.dossier
)
UPDATE dossier.dossier d
   SET code = 'HS-' || numbered.year || '-' || lpad(numbered.n::text, greatest(4, length(numbered.n::text)), '0')
  FROM numbered
 WHERE numbered.id = d.id;
ALTER TABLE dossier.dossier ENABLE TRIGGER dossier_guard;

INSERT INTO dossier.code_counter (year, last_number)
SELECT extract(year FROM created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::int, count(*)
  FROM dossier.dossier
 GROUP BY 1;

ALTER TABLE dossier.dossier ALTER COLUMN code SET NOT NULL;
ALTER TABLE dossier.dossier ADD CONSTRAINT dossier_code_key UNIQUE (code);

-- Chờ tiếp nhận: Đã chuyển tỉnh and not yet Tiếp nhận tại tỉnh in this lượt.
CREATE INDEX dossier_awaiting_province_idx ON dossier.dossier (state) WHERE deleted_at IS NULL AND province_received_at IS NULL;

-- The mã never changes, and neither does the first Tiếp nhận tại tỉnh once it is set.
CREATE FUNCTION dossier.guard_tracking() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'the mã of a dossier is fixed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.first_province_received_at IS NOT NULL AND NEW.first_province_received_at IS DISTINCT FROM OLD.first_province_received_at THEN
    RAISE EXCEPTION 'the first Tiếp nhận tại tỉnh of a dossier is fixed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER dossier_guard_tracking BEFORE UPDATE ON dossier.dossier
  FOR EACH ROW EXECUTE FUNCTION dossier.guard_tracking();

GRANT SELECT, INSERT, UPDATE ON dossier.code_counter TO ocop_app;
GRANT SELECT ON dossier.code_counter TO ocop_readonly;
