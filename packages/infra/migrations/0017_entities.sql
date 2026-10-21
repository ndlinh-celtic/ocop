-- L01 CT-01 Chủ thể (spec #30, ticket #31): the organisation that self-registers and owns hồ sơ.
-- Its Người dùng đại diện reaches it through a Phân vai entity_owner whose scope_id is entity.id.
--
-- Mã số thuế / số định danh: unique after normalisation (no blanks, upper case). A doanh nghiệp or hợp
-- tác xã keeps its mã số thuế in clear (public business data). A hộ sản xuất registers with the chủ hộ's
-- số định danh cá nhân (CCCD), personal data under NĐ 13/2023: it is stored sealed (SecretBox) with its
-- last four digits for masked display. Uniqueness for every kind rides on identifier_fingerprint, a keyed
-- hash of the normalised identifier, so the CCCD never needs to be readable to be checked.

CREATE SCHEMA entity;
GRANT USAGE ON SCHEMA entity TO ocop_app, ocop_readonly;

CREATE TABLE entity.entity (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('enterprise', 'cooperative', 'household')),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  identifier_fingerprint text NOT NULL,
  tax_code text,
  personal_id_sealed text,
  personal_id_last4 text CHECK (personal_id_last4 ~ '^[0-9]{4}$'),
  address text NOT NULL CHECK (length(btrim(address)) > 0),
  representative_name text NOT NULL CHECK (length(btrim(representative_name)) > 0),
  phone text NOT NULL CHECK (length(btrim(phone)) > 0),
  -- Xã/phường đăng ký; a hồ sơ copies it when submitted and keeps its own from then on.
  ward_id uuid NOT NULL REFERENCES org.ward (id),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT identifier_by_kind CHECK (
    CASE kind
      WHEN 'household' THEN tax_code IS NULL AND personal_id_sealed IS NOT NULL AND personal_id_last4 IS NOT NULL
      ELSE tax_code IS NOT NULL AND personal_id_sealed IS NULL AND personal_id_last4 IS NULL
    END
  )
);
CREATE UNIQUE INDEX entity_identifier_unique ON entity.entity (identifier_fingerprint);
CREATE INDEX entity_ward_idx ON entity.entity (ward_id);

GRANT SELECT, INSERT, UPDATE ON entity.entity TO ocop_app;
GRANT SELECT ON entity.entity TO ocop_readonly;

-- Attempts at public endpoints (registration), counted per bucket and hashed client address inside a
-- sliding window. Rows are only ever added; a later job may prune old ones as the migrator.
CREATE TABLE platform.rate_limit_hit (
  bucket text NOT NULL,
  subject_hash text NOT NULL,
  occurred_at timestamptz NOT NULL
);
CREATE INDEX rate_limit_hit_idx ON platform.rate_limit_hit (bucket, subject_hash, occurred_at);

GRANT SELECT, INSERT ON platform.rate_limit_hit TO ocop_app;
