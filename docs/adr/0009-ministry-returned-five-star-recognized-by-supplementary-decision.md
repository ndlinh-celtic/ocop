# Hồ sơ 5 sao Bộ trả về được công nhận 4 sao bằng Quyết định công nhận bổ sung, không thêm trạng thái; Hạng công nhận tách khỏi Hạng sao

Theo chủ đầu tư (24/10/2026), khi Bộ không công nhận 5 sao hoặc trả hồ sơ về, tỉnh công nhận 4 sao theo kết quả của tỉnh trong "quyết định kế tiếp". Quyết định công nhận lại gắn với Phiên họp đã chốt hồ sơ, mà Phiên họp đó đã có quyết định rồi. Chúng tôi thêm **Quyết định công nhận bổ sung**: không gắn Phiên họp, Sở chọn các hồ sơ Đã gửi đề nghị 5 sao đã được chuyển về công nhận cấp tỉnh. Hồ sơ chờ quyết định này vẫn ở Đã gửi đề nghị 5 sao kèm một cờ, không thêm trạng thái thứ 16, vì đây là bước chờ văn bản ngoài hệ thống chứ không phải hồ sơ rời luồng (cùng nguyên tắc ADR 0007). Giấy chứng nhận ghi **Hạng công nhận** (4) khác Hạng sao tính từ điểm (5); kết quả chốt, snapshot và hash không đổi, nên không phải Mở khóa sau chốt hay sửa điểm.

## Considered Options

- Thêm trạng thái "Chờ công nhận cấp tỉnh": rõ trên danh sách nhưng lệch sơ đồ nguồn và phải sửa bảng chuyển trạng thái, bộ lọc, thống kê.
- Đưa hồ sơ vào quyết định của một Phiên họp sau: buộc hồ sơ vào một Phiên họp nó không được xét.
- Ghi đè Hạng sao thành 4: phá tính bất biến của kết quả chốt.

## Consequences

- Danh sách sản phẩm đạt sao, giấy chứng nhận và trang xác thực QR (Đợt 2) đọc Hạng công nhận, không đọc Hạng sao.
- Bộ lọc "chờ quyết định bổ sung" dựa trên cờ, không dựa trên trạng thái.
