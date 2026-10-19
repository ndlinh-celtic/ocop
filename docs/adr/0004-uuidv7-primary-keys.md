# Khóa chính UUIDv7 sinh ở ứng dụng

Mọi khóa chính là UUIDv7 (RFC 9562) lưu kiểu `uuid` gốc của Postgres, sinh ở ứng dụng qua cổng `IdGen` vì PG 16/17 chưa có `uuidv7()`. Chọn UUIDv7 thay ULID vì vừa với kiểu `uuid` (16 byte) mà vẫn sắp được theo thời gian. Mã người dùng nhìn thấy (mã hồ sơ, số hiệu giấy chứng nhận) là trường riêng, không lộ ID kỹ thuật.
