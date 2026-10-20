-- L07 Gia hạn đợt (review of #29, decision of the investor): once a round is Đã đóng nộp, Hạn nộp xã can no
-- longer be extended and the round never goes back to Đang nhận nộp. No extension reopens a round any more,
-- so the reopened flag carries no information. Dropping the column also drops reopen_by_submission, the
-- CHECK that referenced it. Safe: the history table has not reached production (step 2 is unreleased).

ALTER TABLE round.deadline_extension DROP COLUMN reopened;

-- And the database refuses the move back too, whoever runs the statement (the app user does not own
-- round.round, so it cannot disable the trigger).
CREATE FUNCTION round.refuse_reopen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'round % is Đã đóng nộp and never reopens', OLD.id USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER round_never_reopens BEFORE UPDATE ON round.round
  FOR EACH ROW WHEN (OLD.status = 'submission_closed' AND NEW.status = 'open_for_submission')
  EXECUTE FUNCTION round.refuse_reopen();
