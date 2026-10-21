-- L15 HD-09 biên bản đã ký of a Phiên họp (spec #49 story 115; ticket #62).
--
-- The Thư ký uploads the biên bản họp đã ký số as a PDF (purpose `meeting_minutes`), once or again after a chốt lại;
-- each upload is numbered 1, 2, … per Phiên họp and kept as is. Step 4 does not require one before chốt.

-- Appends the purpose to whatever list the earlier migrations left (the DO-block trick of 0033).
DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO def FROM pg_constraint WHERE conname = 'file_purpose_check' AND conrelid = 'platform.file'::regclass;
  IF def NOT LIKE '%''meeting_minutes''%' THEN
    ALTER TABLE platform.file DROP CONSTRAINT file_purpose_check;
    EXECUTE 'ALTER TABLE platform.file ADD CONSTRAINT file_purpose_check ' || replace(def, ']', ', ''meeting_minutes''::text]');
  END IF;
END;
$$;

CREATE TABLE scoring.meeting_minutes (
  id uuid PRIMARY KEY,
  meeting_id uuid NOT NULL REFERENCES scoring.meeting (id),
  number integer NOT NULL CHECK (number >= 1),
  file_id uuid NOT NULL UNIQUE REFERENCES platform.file (id),
  uploaded_by uuid NOT NULL REFERENCES identity.user_account (id),
  uploaded_at timestamptz NOT NULL,
  UNIQUE (meeting_id, number)
);

CREATE FUNCTION scoring.refuse_meeting_minutes_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'a biên bản đã ký is immutable; upload a new one instead' USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER meeting_minutes_immutable BEFORE UPDATE OR DELETE ON scoring.meeting_minutes
  FOR EACH ROW EXECUTE FUNCTION scoring.refuse_meeting_minutes_change();
CREATE TRIGGER meeting_minutes_no_truncate BEFORE TRUNCATE ON scoring.meeting_minutes
  FOR EACH STATEMENT EXECUTE FUNCTION scoring.refuse_meeting_minutes_change();

GRANT SELECT, INSERT ON scoring.meeting_minutes TO ocop_app;
GRANT SELECT ON scoring.meeting_minutes TO ocop_readonly;
