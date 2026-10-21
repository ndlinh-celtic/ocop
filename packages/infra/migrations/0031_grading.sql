-- L09 HD-06 Giao chấm (spec #49 stories 30 to 33, 82; ticket #53).
--
-- Giao chấm puts a hồ sơ into Tổ tư vấn thẩm định or Thành viên xem xét, records when on the hồ sơ
-- (grading_started_at, cleared again by a Sở trả về), gives its Phân công effect and opens one Phiếu chấm
-- trống for each thành viên chấm. The Phiếu chấm table carries the columns the later steps fill (dòng chấm,
-- xác nhận, Vắng, Trả phiếu: tickets #54, #60, #61); its state triggers come with #54.

ALTER TABLE dossier.dossier ADD COLUMN grading_started_at timestamptz;

CREATE SCHEMA scoring;
GRANT USAGE ON SCHEMA scoring TO ocop_app, ocop_readonly;

CREATE TABLE scoring.score_sheet (
  id uuid PRIMARY KEY,
  dossier_id uuid NOT NULL REFERENCES dossier.dossier (id),
  -- The Phân công (kind member) the phiếu belongs to.
  assignment_id uuid NOT NULL REFERENCES council.assignment (id),
  -- 1 for the first phiếu of a Phân công, then one more per Trả phiếu.
  attempt integer NOT NULL CHECK (attempt >= 1),
  state text NOT NULL CHECK (state IN ('draft', 'confirmed', 'absent', 'superseded')),
  confirmed_at timestamptz,
  reauth_method text CHECK (reauth_method IN ('totp', 'password')),
  superseded_by uuid REFERENCES scoring.score_sheet (id),
  superseded_reason text,
  version integer NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT score_sheet_attempt_key UNIQUE (assignment_id, attempt)
);

-- At most one phiếu not yet superseded per Phân công.
CREATE UNIQUE INDEX score_sheet_current_key ON scoring.score_sheet (assignment_id) WHERE state <> 'superseded';
CREATE INDEX score_sheet_dossier_idx ON scoring.score_sheet (dossier_id);

GRANT SELECT, INSERT, UPDATE ON scoring.score_sheet TO ocop_app;
GRANT SELECT ON scoring.score_sheet TO ocop_readonly;
