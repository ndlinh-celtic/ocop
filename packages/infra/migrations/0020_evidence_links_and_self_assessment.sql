-- L02 CT-05, CT-06 Minh chứng theo tiêu chí and tự chấm thử (spec #30, ticket #35).
--
-- Both belong to the working copy of a hồ sơ (bản làm việc) and change only through the core's
-- transition(), which allows it in Nháp (and, from #39, Yêu cầu bổ sung). Submission (#36) snapshots
-- them into the Phiên bản nộp; nothing here is immutable by itself.

-- Gắn minh chứng – tiêu chí: many to many. A file is tied to Tiêu chí only while it sits in the kho of
-- the hồ sơ, so removing it from the kho takes its ties with it.
CREATE TABLE dossier.evidence_link (
  dossier_id uuid NOT NULL,
  file_id uuid NOT NULL,
  criterion_id uuid NOT NULL REFERENCES criteria.criterion (id),
  PRIMARY KEY (dossier_id, file_id, criterion_id),
  FOREIGN KEY (dossier_id, file_id) REFERENCES dossier.evidence_file (dossier_id, file_id) ON DELETE CASCADE
);
CREATE INDEX evidence_link_criterion_idx ON dossier.evidence_link (dossier_id, criterion_id);

GRANT SELECT, INSERT, DELETE ON dossier.evidence_link TO ocop_app;
GRANT SELECT ON dossier.evidence_link TO ocop_readonly;

-- One row per Tiêu chí the Chủ thể has touched: the Mức điểm it picked when tự chấm thử (null until it
-- picks one) and its giải trình. The Mức điểm belongs to the published Phiên bản tiêu chí of the hồ sơ,
-- which the triggers of 0011 keep from changing; the pair (level, criterion) must match.
CREATE UNIQUE INDEX score_level_criterion_key ON criteria.score_level (id, criterion_id);

CREATE TABLE dossier.criterion_entry (
  dossier_id uuid NOT NULL REFERENCES dossier.dossier (id),
  criterion_id uuid NOT NULL REFERENCES criteria.criterion (id),
  score_level_id uuid,
  explanation text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (dossier_id, criterion_id),
  FOREIGN KEY (score_level_id, criterion_id) REFERENCES criteria.score_level (id, criterion_id)
);

GRANT SELECT, INSERT, UPDATE ON dossier.criterion_entry TO ocop_app;
GRANT SELECT ON dossier.criterion_entry TO ocop_readonly;
