# OCOP – Hệ thống đánh giá, phân hạng sản phẩm OCOP (bản một tỉnh)

Repo đang ở giai đoạn thiết kế: tài liệu yêu cầu, kiến trúc và prototype giao diện. Mã nguồn ứng dụng sẽ được thêm theo thứ tự trong `CLAUDE.md`.

## Cấu trúc

```
CLAUDE.md                         Bối cảnh, kiến trúc đã chọn, quy tắc nghiệp vụ, giả định mở
docs/
  tinh-nang-rut-gon.md            Danh sách tính năng (Markdown, sinh từ Excel)
  OCOP_luong_xu_ly_ban_rut_gon.md Luồng xử lý L01–L25, vòng đời hồ sơ
  OCOP_mo_ta_man_hinh_ban_rut_gon.md  Mô tả màn hình S01–S92
  kien-truc-va-cong-nghe.md       Kiến trúc và lựa chọn công nghệ
  yeu-cau/
    OCOP_tinh_nang_rut_gon.xlsx   Bảng tính năng gốc
    OCOP_dac_ta_yeu_cau_v1.0.xlsx Đặc tả yêu cầu (65 yêu cầu, in A3)
design/prototype/
  ocop-prototype.html             Prototype bấm được, mở thẳng bằng trình duyệt
  src/                            Mã nguồn prototype; npm install && npm run build
```

## Làm việc với Claude Code

```bash
git clone git@github.com:ndlinh-celtic/ocop.git
cd ocop
claude
```

Claude Code tự đọc `CLAUDE.md` khi khởi động. Gợi ý câu lệnh đầu tiên: "Dựng bước 1 (nền tảng) theo CLAUDE.md: monorepo pnpm + Turborepo, Docker Compose cho dev với Postgres và MinIO".

## Tài liệu trực tuyến

- Kiến trúc (bản gốc có thể sửa, bình luận): https://claude.ai/code/artifact/7a64c46e-00fa-430e-b860-0b4363949d32
- Prototype giao diện: https://claude.ai/artifact/771LgiiM9dA7TAvPv9xTeZ
