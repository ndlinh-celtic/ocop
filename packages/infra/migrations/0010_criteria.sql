-- L19 AD-03..05 Phiên bản tiêu chí (spec #16, ADR 0006). One version holds its whole tree:
--   Ngưỡng hạng; Nhóm sản phẩm → Phân nhóm → Bộ tiêu chí;
--   Bộ tiêu chí → Phần → Mục → (Nhóm tiêu chí) → Tiêu chí → Mức điểm, plus Điều kiện loại.
-- Every row carries version_id (and below a Bộ tiêu chí, set_id). Composite foreign keys keep those
-- copies consistent with the parent, so a trigger can decide from the row alone whether its version
-- is published (#19), and a deep copy (#21) or a delete cascades without walking the tree.
-- `position` orders siblings; `points`/`total_points` are the values declared by the legal text,
-- which validation (#19) compares with the computed sums.

CREATE SCHEMA criteria;
GRANT USAGE ON SCHEMA criteria TO ocop_app, ocop_readonly;

CREATE TABLE criteria.version (
  id uuid PRIMARY KEY,
  legal_basis text NOT NULL CHECK (length(legal_basis) > 0),
  issued_on date NOT NULL,
  -- Ghi nhận only: the version a dossier uses is the one its Đợt đánh giá applies (GLOSSARY.md).
  effective_on date NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'published')),
  created_at timestamptz NOT NULL,
  created_by uuid REFERENCES identity.user_account (id),
  published_at timestamptz,
  published_by uuid REFERENCES identity.user_account (id),
  -- Lookup only, never inheritance; no foreign key, so deleting the source draft leaves it dangling.
  copied_from uuid,
  CONSTRAINT published_fields CHECK ((status = 'published') = (published_at IS NOT NULL AND published_by IS NOT NULL))
);
CREATE INDEX version_status_idx ON criteria.version (status, created_at DESC);

CREATE TABLE criteria.rank_threshold (
  version_id uuid NOT NULL REFERENCES criteria.version (id) ON DELETE CASCADE,
  stars smallint NOT NULL CHECK (stars BETWEEN 2 AND 5),
  min_score numeric(7, 2) NOT NULL CHECK (min_score >= 0),
  PRIMARY KEY (version_id, stars)
);

CREATE TABLE criteria.product_group (
  id uuid PRIMARY KEY,
  version_id uuid NOT NULL REFERENCES criteria.version (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) > 0),
  position integer NOT NULL CHECK (position >= 0),
  UNIQUE (id, version_id)
);
CREATE INDEX product_group_version_idx ON criteria.product_group (version_id);

CREATE TABLE criteria.product_subgroup (
  id uuid PRIMARY KEY,
  version_id uuid NOT NULL,
  product_group_id uuid NOT NULL,
  name text NOT NULL CHECK (length(name) > 0),
  position integer NOT NULL CHECK (position >= 0),
  UNIQUE (id, version_id),
  FOREIGN KEY (product_group_id, version_id) REFERENCES criteria.product_group (id, version_id) ON DELETE CASCADE
);
CREATE INDEX product_subgroup_version_idx ON criteria.product_subgroup (version_id);

CREATE TABLE criteria.criteria_set (
  id uuid PRIMARY KEY,
  version_id uuid NOT NULL,
  subgroup_id uuid NOT NULL,
  -- The number printed on the sheet ("1".."26" in QĐ 26).
  code text NOT NULL CHECK (length(code) > 0),
  name text NOT NULL CHECK (length(name) > 0),
  total_points numeric(7, 2) NOT NULL CHECK (total_points >= 0),
  -- Source text kept for review against the scan: the "Hồ sơ bị loại khi…" header as printed,
  -- the footer note, and the extraction notes ("Cần rà soát").
  header_note text NOT NULL DEFAULT '',
  footer_note text NOT NULL DEFAULT '',
  extraction_note text NOT NULL DEFAULT '',
  source_pages integer[] NOT NULL DEFAULT '{}',
  position integer NOT NULL CHECK (position >= 0),
  UNIQUE (id, version_id),
  FOREIGN KEY (subgroup_id, version_id) REFERENCES criteria.product_subgroup (id, version_id) ON DELETE CASCADE
);
CREATE INDEX criteria_set_version_idx ON criteria.criteria_set (version_id);

CREATE TABLE criteria.exclusion_condition (
  id uuid PRIMARY KEY,
  version_id uuid NOT NULL,
  set_id uuid NOT NULL,
  description text NOT NULL CHECK (length(description) > 0),
  position integer NOT NULL CHECK (position >= 0),
  FOREIGN KEY (set_id, version_id) REFERENCES criteria.criteria_set (id, version_id) ON DELETE CASCADE
);
CREATE INDEX exclusion_condition_set_idx ON criteria.exclusion_condition (set_id);

CREATE TABLE criteria.part (
  id uuid PRIMARY KEY,
  version_id uuid NOT NULL,
  set_id uuid NOT NULL,
  code text NOT NULL CHECK (length(code) > 0),
  name text NOT NULL CHECK (length(name) > 0),
  points numeric(7, 2) NOT NULL CHECK (points >= 0),
  position integer NOT NULL CHECK (position >= 0),
  UNIQUE (id, set_id),
  FOREIGN KEY (set_id, version_id) REFERENCES criteria.criteria_set (id, version_id) ON DELETE CASCADE
);
CREATE INDEX part_set_idx ON criteria.part (set_id);

CREATE TABLE criteria.section (
  id uuid PRIMARY KEY,
  version_id uuid NOT NULL,
  set_id uuid NOT NULL,
  part_id uuid NOT NULL,
  code text NOT NULL CHECK (length(code) > 0),
  name text NOT NULL CHECK (length(name) > 0),
  points numeric(7, 2) NOT NULL CHECK (points >= 0),
  position integer NOT NULL CHECK (position >= 0),
  UNIQUE (id, set_id),
  FOREIGN KEY (set_id, version_id) REFERENCES criteria.criteria_set (id, version_id) ON DELETE CASCADE,
  FOREIGN KEY (part_id, set_id) REFERENCES criteria.part (id, set_id) ON DELETE CASCADE
);
CREATE INDEX section_set_idx ON criteria.section (set_id);

-- Nhóm tiêu chí and Tiêu chí placed directly in a Mục share one `position` sequence per Mục.
CREATE TABLE criteria.criterion_group (
  id uuid PRIMARY KEY,
  version_id uuid NOT NULL,
  set_id uuid NOT NULL,
  section_id uuid NOT NULL,
  code text NOT NULL CHECK (length(code) > 0),
  name text NOT NULL CHECK (length(name) > 0),
  points numeric(7, 2) NOT NULL CHECK (points >= 0),
  position integer NOT NULL CHECK (position >= 0),
  UNIQUE (id, set_id),
  FOREIGN KEY (set_id, version_id) REFERENCES criteria.criteria_set (id, version_id) ON DELETE CASCADE,
  FOREIGN KEY (section_id, set_id) REFERENCES criteria.section (id, set_id) ON DELETE CASCADE
);
CREATE INDEX criterion_group_set_idx ON criteria.criterion_group (set_id);

-- `code` is unique within a Bộ tiêu chí, but checked by validation (#19), not here, so a draft can
-- pass through intermediate states while it is edited. Score sheets will reference score_level by FK.
CREATE TABLE criteria.criterion (
  id uuid PRIMARY KEY,
  version_id uuid NOT NULL,
  set_id uuid NOT NULL,
  section_id uuid NOT NULL,
  group_id uuid,
  code text NOT NULL CHECK (length(code) > 0),
  name text NOT NULL CHECK (length(name) > 0),
  requirement text NOT NULL DEFAULT '',
  max_points numeric(7, 2) NOT NULL CHECK (max_points >= 0),
  note text NOT NULL DEFAULT '',
  extraction_note text NOT NULL DEFAULT '',
  position integer NOT NULL CHECK (position >= 0),
  UNIQUE (id, set_id),
  FOREIGN KEY (set_id, version_id) REFERENCES criteria.criteria_set (id, version_id) ON DELETE CASCADE,
  FOREIGN KEY (section_id, set_id) REFERENCES criteria.section (id, set_id) ON DELETE CASCADE,
  FOREIGN KEY (group_id, set_id) REFERENCES criteria.criterion_group (id, set_id) ON DELETE CASCADE
);
CREATE INDEX criterion_set_idx ON criteria.criterion (set_id);

CREATE TABLE criteria.score_level (
  id uuid PRIMARY KEY,
  version_id uuid NOT NULL,
  set_id uuid NOT NULL,
  criterion_id uuid NOT NULL,
  description text NOT NULL CHECK (length(description) > 0),
  points numeric(7, 2) NOT NULL CHECK (points >= 0),
  -- Sao tối thiểu (***, ****, *****); NULL when the level carries no requirement.
  min_star smallint CHECK (min_star BETWEEN 3 AND 5),
  -- Nhãn nhánh (a/b) when the Tiêu chí splits into cases; the grader picks within one branch.
  branch text CHECK (branch IS NULL OR length(branch) > 0),
  -- The "Không đáp ứng, 0 điểm" level the system adds when the text has no 0-point level.
  system_added boolean NOT NULL DEFAULT false,
  position integer NOT NULL CHECK (position >= 0),
  CONSTRAINT system_added_is_zero CHECK (NOT system_added OR points = 0),
  FOREIGN KEY (set_id, version_id) REFERENCES criteria.criteria_set (id, version_id) ON DELETE CASCADE,
  FOREIGN KEY (criterion_id, set_id) REFERENCES criteria.criterion (id, set_id) ON DELETE CASCADE
);
CREATE INDEX score_level_set_idx ON criteria.score_level (set_id);

-- DELETE is for drafts only (deleting a draft, removing nodes); #19 adds the triggers that refuse
-- any change to a published version, which the app role cannot disable because it does not own the tables.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  criteria.version, criteria.rank_threshold, criteria.product_group, criteria.product_subgroup,
  criteria.criteria_set, criteria.exclusion_condition, criteria.part, criteria.section,
  criteria.criterion_group, criteria.criterion, criteria.score_level
TO ocop_app;
GRANT SELECT ON ALL TABLES IN SCHEMA criteria TO ocop_readonly;
