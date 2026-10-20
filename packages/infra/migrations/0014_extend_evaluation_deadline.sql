-- L07 Gia hạn đợt: Hạn đánh giá tỉnh can be extended too (review of #29). Without it Hạn gửi tỉnh could
-- never move past Hạn đánh giá tỉnh, since the three deadlines stay in order. Same rules as the others:
-- a reason, never shorten, one history row; only Hạn nộp xã reopens submission (reopen_by_submission).

ALTER TABLE round.deadline_extension DROP CONSTRAINT deadline_extension_deadline_check;
ALTER TABLE round.deadline_extension
  ADD CONSTRAINT deadline_extension_deadline_check CHECK (deadline IN ('submission', 'forwarding', 'evaluation'));
