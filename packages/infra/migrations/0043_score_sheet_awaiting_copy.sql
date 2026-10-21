-- L09 HD-03, L12 (spec #49 "phiếu này chờ lần sao chép tiếp theo"; code review of step 4): in chấm dựa trên
-- Tổ tư vấn, a thành viên chấm added or replaced once the hồ sơ is in Thành viên xem xét or Sẵn sàng chốt gets a
-- Phiếu chấm trống that waits for the next sao chép. The domain refuses lưu and xác nhận while awaiting_copy is
-- set; the sao chép that writes into the phiếu clears it. Existing phiếu never waited.

ALTER TABLE scoring.score_sheet ADD COLUMN awaiting_copy boolean NOT NULL DEFAULT false;
