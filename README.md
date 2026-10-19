# OCOP – Hệ thống đánh giá, phân hạng sản phẩm OCOP (bản một tỉnh)

Tài liệu yêu cầu, kiến trúc, prototype giao diện, và mã nguồn đang dựng theo thứ tự trong `CLAUDE.md` (bước 1: spec #1).

## Chạy local

Cần Node 22.12+, pnpm 10, Docker.

```bash
pnpm install
docker compose up -d --build        # stack giống prod: caddy, web x2, worker, clamd, postgres, S3 (RustFS), mailpit
open http://localhost:8080          # ứng dụng qua Caddy
open http://localhost:8025          # Mailpit: xem email gửi đi
docker compose -f compose.yaml -f compose.dev.yaml up   # dev: hot reload, một replica web
```

Kiểm tra: `pnpm lint`, `pnpm typecheck`, `pnpm test` (unit), `pnpm test:int` (Postgres và S3 thật qua Testcontainers, cần Docker).

E2E (Playwright, trên stack Compose sạch): `docker compose down -v && docker compose up -d --build`, rồi `pnpm --filter @ocop/e2e e2e`. Lần đầu: `pnpm --filter @ocop/e2e exec playwright install chromium`.

Dữ liệu mẫu: `docker compose run --rm worker pnpm --filter @ocop/infra seed:wards [tệp.csv]` (CSV `ma,ten`), `docker compose run --rm -it worker pnpm --filter @ocop/infra admin:create` (Quản trị đầu tiên).

Bộ test tương thích S3 với nhà cung cấp thật (ghi kết quả vào phụ lục A):

```bash
S3_COMPAT_ENDPOINT=https://... S3_COMPAT_ACCESS_KEY=... S3_COMPAT_SECRET_KEY=... \
S3_COMPAT_REGION=... S3_COMPAT_BUCKET=bucket-co-san \
pnpm --filter @ocop/infra exec vitest run --config vitest.int.config.ts test/files/s3-compat
```

## Cấu trúc

```
apps/web                          Next.js (App Router): UI, route handler
apps/worker                       Job nền (pg-boss)
packages/core                     Domain + use case, TypeScript thuần
packages/infra                    Adapter: Postgres, pg-boss, S3, SMTP; migration SQL trong migrations/
packages/ui                       Thành phần giao diện dùng chung
compose.yaml, infra/              Docker Compose, Dockerfile, Caddy, init Postgres
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
