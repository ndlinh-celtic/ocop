# Xác thực tự viết trong module identity, không dùng Better Auth

Kiến trúc ban đầu chọn Better Auth sau `AuthPort`. Khi đối chiếu spec bước 1, Better Auth chỉ gánh phần băm mật khẩu, TOTP và cookie; các yêu cầu còn lại phải viết qua hook: khóa tạm theo tài khoản (rate limit của nó theo IP), hết phiên khác nhau theo Vai trò và tuổi thọ tối đa, liên kết kích hoạt 72 giờ tách khỏi đặt lại mật khẩu. Quan trọng nhất, nó tự quản transaction nên audit và outbox của đăng nhập không ghi cùng transaction được. Ta tự viết đăng nhập, phiên, TOTP, kích hoạt và đặt lại mật khẩu thành use case của `identity`: mật khẩu argon2id (`@node-rs/argon2`), TOTP RFC 6238 (`otplib`), token phiên ngẫu nhiên chỉ lưu hash trong DB. Hai thư viện mật mã nằm sau cổng `PasswordHasher` và `TotpService`.

## Consequences

Đội tự chịu trách nhiệm phần dễ sai của xác thực: so sánh hằng thời gian, sinh token đủ entropy, chống dò email qua thông báo lỗi, khóa tạm. Các điểm này phải có test ở seam use case và nằm trong phạm vi kiểm thử xâm nhập trước khi mở cổng cho chủ thể. VNeID/SSO sau này vẫn cắm được như một phương thức đăng nhập mới tạo cùng loại phiên.
