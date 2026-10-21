-- L04 CT-11, XA-05 Yêu cầu bổ sung và nộp lại (spec #30, ticket #39).
--
-- A Cán bộ xã asks for more on a hồ sơ Đã nộp xã: a list of nội dung, each optionally tied to a Tiêu
-- chí or a loại giấy tờ, with a hạn bổ sung (23:59:59 giờ Việt Nam of the chosen day). The Chủ thể answers
-- each nội dung and nộp lại, which closes the request; so does closing the hồ sơ for "Không bổ sung".
--
-- The hạn bổ sung of the open request is also kept on the hồ sơ, so that the transition guards (nộp lại
-- while it lasts, đóng once it has passed) read it from the row they lock. It is set exactly while the
-- hồ sơ is Yêu cầu bổ sung.

ALTER TABLE dossier.dossier ADD COLUMN supplement_deadline timestamptz;
ALTER TABLE dossier.dossier ADD CONSTRAINT supplement_deadline_while_requested
  CHECK ((state = 'supplement_requested') = (supplement_deadline IS NOT NULL));

CREATE TABLE dossier.supplement_request (
  id uuid PRIMARY KEY,
  dossier_id uuid NOT NULL REFERENCES dossier.dossier (id),
  requested_by uuid NOT NULL REFERENCES identity.user_account (id),
  requested_role text NOT NULL,
  requested_at timestamptz NOT NULL,
  deadline timestamptz NOT NULL,
  -- Set once, when the Chủ thể nộp lại ('resubmitted') or the hồ sơ is closed ('closed_unsupplemented').
  closed_at timestamptz,
  outcome text CHECK (outcome IN ('resubmitted', 'closed_unsupplemented')),
  CONSTRAINT closed_with_outcome CHECK ((closed_at IS NULL) = (outcome IS NULL))
);
-- At most one open request per hồ sơ.
CREATE UNIQUE INDEX supplement_request_one_open ON dossier.supplement_request (dossier_id) WHERE closed_at IS NULL;

CREATE TABLE dossier.supplement_item (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES dossier.supplement_request (id),
  position integer NOT NULL CHECK (position >= 1),
  content text NOT NULL CHECK (content <> ''),
  criterion_id uuid REFERENCES criteria.criterion (id),
  legal_document_type_code text REFERENCES entity.legal_document_type (code),
  response text NOT NULL DEFAULT '',
  responded_at timestamptz,
  responded_by uuid REFERENCES identity.user_account (id),
  UNIQUE (request_id, position),
  CONSTRAINT one_target CHECK (criterion_id IS NULL OR legal_document_type_code IS NULL)
);

-- What was asked, by whom and until when never changes; only the answers and the closing do, and a
-- closed request no longer changes at all.
CREATE FUNCTION dossier.guard_supplement_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.closed_at IS NOT NULL
     OR NEW.dossier_id IS DISTINCT FROM OLD.dossier_id
     OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
     OR NEW.requested_role IS DISTINCT FROM OLD.requested_role
     OR NEW.requested_at IS DISTINCT FROM OLD.requested_at
     OR NEW.deadline IS DISTINCT FROM OLD.deadline THEN
    RAISE EXCEPTION 'a yêu cầu bổ sung only changes by being closed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER supplement_request_guard BEFORE UPDATE ON dossier.supplement_request
  FOR EACH ROW EXECUTE FUNCTION dossier.guard_supplement_request();

CREATE FUNCTION dossier.guard_supplement_item() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.request_id IS DISTINCT FROM OLD.request_id
     OR NEW.position IS DISTINCT FROM OLD.position
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.criterion_id IS DISTINCT FROM OLD.criterion_id
     OR NEW.legal_document_type_code IS DISTINCT FROM OLD.legal_document_type_code
     OR EXISTS (SELECT 1 FROM dossier.supplement_request r WHERE r.id = OLD.request_id AND r.closed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'only the answer to an open yêu cầu bổ sung changes' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER supplement_item_guard BEFORE UPDATE ON dossier.supplement_item
  FOR EACH ROW EXECUTE FUNCTION dossier.guard_supplement_item();

GRANT SELECT, INSERT, UPDATE ON dossier.supplement_request, dossier.supplement_item TO ocop_app;
GRANT SELECT ON dossier.supplement_request, dossier.supplement_item TO ocop_readonly;
