-- L03 CT-12 Nhắc hạn (spec #30 stories 36 to 38, 55, 71, ticket #46).
--
-- platform.system_setting holds the cấu hình chung Quản trị edits in the app, one JSON value per key;
-- a key without a row means its default (in core). The first key is the mốc nhắc hạn.
--
-- dossier.reminder_sent is the ledger of reminders the job has sent: one row per (loại hạn, đối tượng,
-- ngữ cảnh, hạn, mốc). The job inserts with ON CONFLICT DO NOTHING and sends only when the row is new, so
-- each mốc goes out once per đối tượng however often the job runs. A Gia hạn đợt or a new hạn bổ sung is
-- a new hạn, so its mốc are reminded again. Append-only for the app.

CREATE TABLE platform.system_setting (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  updated_by uuid NOT NULL REFERENCES identity.user_account (id)
);

GRANT SELECT, INSERT, UPDATE ON platform.system_setting TO ocop_app;
GRANT SELECT ON platform.system_setting TO ocop_readonly;

CREATE TABLE dossier.reminder_sent (
  -- submission: Hạn nộp xã, to a Chủ thể (subject) about a đợt (context).
  -- supplement: hạn bổ sung, to a Chủ thể about a hồ sơ.
  -- forwarding: Hạn gửi tỉnh, to a xã about a đợt.
  kind text NOT NULL CHECK (kind IN ('submission', 'supplement', 'forwarding')),
  subject_id uuid NOT NULL,
  context_id uuid NOT NULL,
  deadline timestamptz NOT NULL,
  milestone_days integer NOT NULL CHECK (milestone_days >= 1),
  sent_at timestamptz NOT NULL,
  PRIMARY KEY (kind, subject_id, context_id, deadline, milestone_days)
);

GRANT SELECT, INSERT ON dossier.reminder_sent TO ocop_app;
GRANT SELECT ON dossier.reminder_sent TO ocop_readonly;
