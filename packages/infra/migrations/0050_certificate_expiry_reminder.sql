-- L16 nhắc Giấy chứng nhận sắp hết hiệu lực (spec #79 stories 32, 33, 35, ticket #86).
--
-- The reminder ledger gains a fourth loại: certificate_expiry, to the Chủ thể (subject) and the Cán bộ Sở about a
-- Giấy chứng nhận (context). Its deadline is the start (giờ Việt Nam) of the ngày hết hiệu lực and its one mốc the
-- number of days from the reminder day to that date; a giấy whose ngày hết hiệu lực is recomputed (the ngày ký of its
-- quyết định corrected) has a new deadline, so it is reminded on the new date.

ALTER TABLE dossier.reminder_sent DROP CONSTRAINT reminder_sent_kind_check;
ALTER TABLE dossier.reminder_sent
  ADD CONSTRAINT reminder_sent_kind_check CHECK (kind IN ('submission', 'supplement', 'forwarding', 'certificate_expiry'));
