-- L07 kết thúc đợt (review of #29): a round Đã kết thúc is final. The domain already refuses every change to
-- it; this trigger makes the database refuse it too, for UPDATE and DELETE, whoever runs the statement.
-- The app user does not own round.round, so it cannot disable the trigger.

CREATE FUNCTION round.refuse_ended_round_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'round % has ended and is final (% refused)', OLD.id, TG_OP USING ERRCODE = 'insufficient_privilege';
END $$;

CREATE TRIGGER round_ended_final BEFORE UPDATE OR DELETE ON round.round
  FOR EACH ROW WHEN (OLD.status = 'ended') EXECUTE FUNCTION round.refuse_ended_round_change();
