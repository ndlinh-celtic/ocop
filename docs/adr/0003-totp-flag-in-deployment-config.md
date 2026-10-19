# Cờ bắt buộc TOTP nằm ở cấu hình triển khai, xác thực lại dùng mật khẩu khi tắt

Một số đơn vị không muốn bắt buộc TOTP, nên việc bắt buộc TOTP cho các vai trò ngoài Chủ thể và Cán bộ xã có một cờ bật/tắt. Cờ nằm ở cấu hình triển khai (biến môi trường), không có công tắc trong màn hình quản trị, vì một tài khoản quản trị bị chiếm sẽ tắt 2FA đầu tiên; giá trị cờ được ghi audit lúc khởi động. Khi cờ tắt, xác thực lại trước khi xác nhận phiếu và chốt điểm là nhập lại mật khẩu trong vòng 5 phút, và audit ghi phương thức (`totp` hoặc `password`). Người dùng vẫn tự bật TOTP được khi cờ tắt.
