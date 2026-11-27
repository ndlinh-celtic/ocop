# Mã QR của Giấy chứng nhận chứa Mã xác thực ngẫu nhiên lưu trong DB, không phải số hiệu kèm checksum HMAC

Đặc tả HD-12 (AC1) và L18 ghi "số hiệu kèm checksum HMAC chống dò tuần tự". Chúng tôi cấp cho mỗi Giấy chứng nhận một **Mã xác thực** ngẫu nhiên (khoảng 128 bit, lưu trong DB, unique), và mã QR là `https://<tên miền xác thực>/xac-thuc/<mã>`. Mục đích chống dò tuần tự vẫn đạt. Mã QR in lên giấy và bao bì thì không thu hồi được, nên ta tránh gắn chúng vào một khóa bí mật: với HMAC, lộ khóa thì phải chọn giữa để người ngoài dò được và vô hiệu hóa mọi QR đã in. Ngoài ra Số hiệu có dấu `/` nên phải mã hóa lại khi đưa vào URL. Số hiệu vẫn hiện trên Trang xác thực.

## Consequences

- Tên miền xác thực là cấu hình triển khai, không phải Cấu hình chung: đổi nó sau khi in làm hỏng mọi QR. Chưa có tên miền chính thức thì không chèn QR (chủ đầu tư, 24/10/2026).
- Mã xác thực không đổi khi sửa quyết định hay tải lại bản đã ký.
- Mã là 16 byte ngẫu nhiên, base32 chữ thường không đệm (26 ký tự): URL không phân biệt hoa thường, không có `+/=`.
- Giấy chứng nhận cấp trước tính năng này được sinh mã bằng migration; bản PDF đã ký giữ nguyên, nhưng in lại hay tải ảnh QR vẫn xác thực được.
