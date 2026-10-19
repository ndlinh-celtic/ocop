-- DC-03 files. Bytes live in object storage; the status here alone decides whether a download URL is issued.
CREATE TABLE platform.file (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES identity.user_account (id),
  purpose text NOT NULL CHECK (purpose IN ('test_upload')),
  storage_key text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 255),
  declared_type text NOT NULL,
  size bigint NOT NULL CHECK (size > 0),
  multipart_upload_id text,
  status text NOT NULL CHECK (status IN ('awaiting_upload', 'scanning', 'clean', 'blocked')),
  detected_type text,
  sha256 text CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  block_reason text,
  created_at timestamptz NOT NULL,
  uploaded_at timestamptz,
  scanned_at timestamptz
);
CREATE INDEX file_owner_idx ON platform.file (owner_user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON platform.file TO ocop_app;
