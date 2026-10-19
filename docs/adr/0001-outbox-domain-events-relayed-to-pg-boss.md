# Outbox chứa domain event, relay sang pg-boss

Một sự kiện nghiệp vụ (hồ sơ đã nộp, báo cáo Tổ tư vấn đã phát hành...) thường kéo theo hai đến ba phản ứng: email, thông báo trong ứng dụng, lập lịch nhắc hạn. Use case chỉ ghi domain event vào bảng `outbox` trong cùng transaction nghiệp vụ; một relay trong worker đọc outbox và tạo job pg-boss cho từng consumer. Ta không ghi job pg-boss trực tiếp từ use case, dù cách đó ít thành phần hơn, vì khi đó use case phải biết mọi phản ứng của sự kiện và thêm một consumer là phải sửa use case.
