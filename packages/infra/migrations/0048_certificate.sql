-- L16 HD-11 Giấy chứng nhận (spec #79 stories 17, 18, 22 to 31, 34, 35; ticket #84; ADR 0009).
--
-- Each hồ sơ a Quyết định công nhận recognizes gets exactly one Giấy chứng nhận, numbered in the transaction that
-- records the quyết định from results.cert_counter (one row per year, INSERT … ON CONFLICT DO UPDATE … RETURNING, no
-- sequence: a rolled-back recording gives its numbers back). Its số hiệu, hồ sơ, quyết định and Hạng công nhận never
-- change; ngày cấp and ngày hết hiệu lực follow a correction of the ngày ký (story 17), the bản nháp is filled in by the
-- outbox consumer and regenerated while Chờ ký, and the state only moves Chờ ký → Đã ký. Every signed PDF uploaded is
-- kept (certificate_signed_file, append-only); from the second one a lý do is required.
--
-- Story 17 also lets the Cán bộ Sở correct the số and ngày ký of a recorded quyết định: 0047's trigger already allows
-- exactly those two columns, this grants the UPDATE.

DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def FROM pg_constraint WHERE conname = 'file_purpose_check' AND conrelid = 'platform.file'::regclass;
  IF def NOT LIKE '%''signed_certificate''%' THEN
    ALTER TABLE platform.file DROP CONSTRAINT file_purpose_check;
    EXECUTE 'ALTER TABLE platform.file ADD CONSTRAINT file_purpose_check ' || replace(def, ']', ', ''signed_certificate''::text]');
  END IF;
END;
$$;

GRANT UPDATE (number, signed_on) ON results.recognition_decision TO ocop_app;

CREATE TABLE results.cert_counter (
  year integer PRIMARY KEY CHECK (year BETWEEN 2000 AND 9999),
  last_seq integer NOT NULL CHECK (last_seq >= 1)
);

CREATE TABLE results.certificate (
  id uuid PRIMARY KEY,
  dossier_id uuid NOT NULL UNIQUE REFERENCES dossier.dossier (id),
  decision_id uuid NOT NULL REFERENCES results.recognition_decision (id),
  year integer NOT NULL,
  seq integer NOT NULL CHECK (seq >= 1),
  code text NOT NULL UNIQUE,
  recognized_star smallint NOT NULL CHECK (recognized_star IN (3, 4)),
  issued_on date NOT NULL,
  expires_on date NOT NULL CHECK (expires_on > issued_on),
  state text NOT NULL CHECK (state IN ('awaiting_signature', 'signed')),
  draft_file_id uuid REFERENCES platform.file (id),
  template_version_id uuid REFERENCES platform.document_template_version (id),
  issued_at timestamptz NOT NULL,
  UNIQUE (year, seq),
  -- The số thứ tự belongs to the year of the ngày cấp (story 18).
  CHECK (year = extract(year FROM issued_on))
);

CREATE INDEX certificate_by_decision ON results.certificate (decision_id);

CREATE FUNCTION results.guard_certificate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.id = OLD.id AND NEW.dossier_id = OLD.dossier_id AND NEW.decision_id = OLD.decision_id
     AND NEW.year = OLD.year AND NEW.seq = OLD.seq AND NEW.code = OLD.code AND NEW.recognized_star = OLD.recognized_star
     AND NEW.issued_at = OLD.issued_at
     AND NOT (OLD.state = 'signed' AND NEW.state <> 'signed') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'a Giấy chứng nhận is never removed; its số hiệu, hồ sơ, quyết định and Hạng công nhận never change, and Đã ký stays Đã ký'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER certificate_guard BEFORE UPDATE OR DELETE ON results.certificate
  FOR EACH ROW EXECUTE FUNCTION results.guard_certificate();
CREATE TRIGGER certificate_no_truncate BEFORE TRUNCATE ON results.certificate
  FOR EACH STATEMENT EXECUTE FUNCTION results.guard_certificate();

CREATE TABLE results.certificate_signed_file (
  certificate_id uuid NOT NULL REFERENCES results.certificate (id),
  n integer NOT NULL CHECK (n >= 1),
  file_id uuid NOT NULL UNIQUE REFERENCES platform.file (id),
  reason text CHECK (reason IS NULL OR char_length(btrim(reason)) BETWEEN 1 AND 1000),
  uploaded_by uuid NOT NULL REFERENCES identity.user_account (id),
  uploaded_at timestamptz NOT NULL,
  PRIMARY KEY (certificate_id, n),
  -- Story 29: a re-upload says why.
  CHECK (n = 1 OR reason IS NOT NULL)
);

CREATE FUNCTION results.refuse_certificate_signed_file_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'an uploaded signed Giấy chứng nhận is kept as it was' USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER certificate_signed_file_immutable BEFORE UPDATE OR DELETE ON results.certificate_signed_file
  FOR EACH ROW EXECUTE FUNCTION results.refuse_certificate_signed_file_change();
CREATE TRIGGER certificate_signed_file_no_truncate BEFORE TRUNCATE ON results.certificate_signed_file
  FOR EACH STATEMENT EXECUTE FUNCTION results.refuse_certificate_signed_file_change();

GRANT SELECT, INSERT, UPDATE ON results.cert_counter TO ocop_app;
GRANT SELECT, INSERT ON results.certificate, results.certificate_signed_file TO ocop_app;
GRANT UPDATE (issued_on, expires_on, state, draft_file_id, template_version_id) ON results.certificate TO ocop_app;
GRANT SELECT ON results.cert_counter, results.certificate, results.certificate_signed_file TO ocop_readonly;
