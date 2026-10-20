-- L07 Gia hạn đợt (spec #16, ticket #26): Cán bộ Sở moves Hạn nộp xã or Hạn gửi tỉnh later, with a reason.
-- Each extension is one row of history: which deadline, old and new value, reason, who, when, and
-- whether it brought a Đã đóng nộp round back to Đang nhận nộp. The history is append-only: the app
-- user may only INSERT and SELECT. A round with history is never a draft, so it is never deleted.

CREATE TABLE round.deadline_extension (
  id uuid PRIMARY KEY,
  round_id uuid NOT NULL REFERENCES round.round (id),
  -- submission = Hạn nộp xã, forwarding = Hạn gửi tỉnh. Hạn đánh giá tỉnh is a reminder and not extended.
  deadline text NOT NULL CHECK (deadline IN ('submission', 'forwarding')),
  previous_deadline timestamptz NOT NULL,
  new_deadline timestamptz NOT NULL,
  reason text NOT NULL CONSTRAINT reason_required CHECK (length(btrim(reason)) > 0),
  extended_by uuid NOT NULL REFERENCES identity.user_account (id),
  extended_at timestamptz NOT NULL,
  reopened boolean NOT NULL,
  -- Never shorten: an extension always moves the deadline later.
  CONSTRAINT extends_later CHECK (new_deadline > previous_deadline),
  -- Only an extension of Hạn nộp xã can reopen submission.
  CONSTRAINT reopen_by_submission CHECK (NOT reopened OR deadline = 'submission')
);

CREATE INDEX deadline_extension_round_idx ON round.deadline_extension (round_id, extended_at DESC);

GRANT SELECT, INSERT ON round.deadline_extension TO ocop_app;
GRANT SELECT ON round.deadline_extension TO ocop_readonly;
