# CLAUDE.md

Bối cảnh cho Claude Code khi làm việc trong repo này. Đọc file này trước, rồi mở tài liệu trong `docs/` khi cần chi tiết.

## Dự án

Phần mềm **đánh giá, phân hạng sản phẩm OCOP** (Mỗi xã một sản phẩm), **bản rút gọn cho một tỉnh**. Hệ thống số hóa vòng đời hồ sơ từ chủ thể nộp, UBND xã/phường tiếp nhận và đánh giá sơ bộ, Sở NN&MT tiếp nhận, hội đồng cấp tỉnh và Tổ tư vấn chấm điểm, đến cấp giấy chứng nhận và xuất gói hồ sơ 5 sao.

- Phạm vi: 65 tính năng cho 9 nhóm đối tượng (64 mã gốc giữ lại + phần 2FA của DC-09); 61 ở **Đợt 1** (luồng lõi), 4 ở **Đợt 2** (CT-15, SO-06, HD-12, CK-02: QR và thống kê). 41 mã gốc bị hoãn hoặc cắt.
- Bộ NN&MT **không** dùng hệ thống: chỉ có công cụ xuất gói hồ sơ 5 sao (SO-04), Sở đánh dấu trạng thái thủ công.
- Quy mô nhỏ: 1 tỉnh, khoảng 150 xã/phường, vài trăm đến 1.000 hồ sơ/năm, dưới 3.000 tài khoản. Độ khó nằm ở **tính đúng của quy tắc nghiệp vụ, phân quyền và tính bất biến**, không nằm ở tải.
- Triển khai trên cloud trong nước (VNG/GreenNode, FPT, Viettel). Dữ liệu và log không ra ngoài lãnh thổ; không dùng SaaS nước ngoài (Sentry cloud, SendGrid...).
- Ngôn ngữ người dùng: tiếng Việt. Tài liệu và trao đổi bằng tiếng Việt; mã nguồn, tên biến, commit message bằng tiếng Anh.

## Tài liệu (nguồn sự thật)

| File | Nội dung |
| --- | --- |
| `docs/tinh-nang-rut-gon.md` | Danh sách 65 tính năng (mã CT/XA/SO/HD/TV/TM/AD/CK/DC), đợt, luồng; sheet hoãn/cắt; ghi chú cloud. Sinh từ `docs/yeu-cau/OCOP_tinh_nang_rut_gon.xlsx` |
| `docs/OCOP_luong_xu_ly_ban_rut_gon.md` | Luồng xử lý L01 đến L25, **vòng đời 15 trạng thái hồ sơ** (mục 1.2), phụ lục cloud và điểm cần xác nhận |
| `docs/OCOP_mo_ta_man_hinh_ban_rut_gon.md` | Mô tả ~50 màn hình (S01 đến S92), vai trò, điều hướng, thành phần UI dùng chung |
| `docs/tieu-chi/` | Bộ tiêu chí QĐ 26/2026/QĐ-TTg bóc tách từ bản scan: `ocop_tieu_chi_qd26_2026.json` (dữ liệu seed) và bản Excel có sheet "Cần rà soát" |
| `docs/kien-truc-va-cong-nghe.md` | Kiến trúc và lựa chọn công nghệ (đã chốt hướng, xem dưới) |
| `docs/yeu-cau/OCOP_dac_ta_yeu_cau_v1.0.xlsx` | Đặc tả yêu cầu: 65 sheet yêu cầu, mỗi sheet có mô tả, tiêu chí chấp nhận, input/output từng bước, sơ đồ luồng, ảnh màn hình; 3 phụ lục. File lớn (12 MB, nhiều ảnh), dùng `openpyxl` đọc từng sheet khi cần |
| `design/prototype/ocop-prototype.html` | Prototype bấm được của 50 màn hình, 7 vai trò. Mở trực tiếp bằng trình duyệt |
| `design/prototype/src/` | Mã nguồn prototype (vanilla JS + CSS) tách theo nhóm vai trò; `npm install && npm run build` để gộp lại HTML |

Khi tài liệu mâu thuẫn nhau: luồng xử lý > mô tả màn hình > prototype. Mã chức năng (CT-01, HD-06...) và mã luồng (L01...) là khóa để đối chiếu giữa các tài liệu; dùng chúng trong tên test, comment và PR.

## Kiến trúc đã chọn

**Modular monolith TypeScript**, Next.js full-stack + tầng domain độc lập (không tách NestJS; đổi được sau nếu cần API công khai).

- Monorepo **pnpm workspaces + Turborepo**: `apps/web` (Next.js App Router), `apps/worker` (Node, pg-boss), `packages/core` (domain + use case), `packages/infra` (Drizzle repo, adapter S3/SMTP/PDF/queue), `packages/ui` (shadcn/ui).
- Phân lớp: UI/route handler chỉ xác thực, parse Zod, gọi use case. Use case `(actor, input) => result` mở transaction, kiểm policy, gọi domain, ghi audit + outbox **trong cùng transaction**. Domain là TS thuần, không import framework. Lint chặn import Drizzle từ `apps/web`.
- **PostgreSQL 16/17** là nguồn sự thật duy nhất, kể cả hàng đợi job (**pg-boss**); extension `unaccent`, `pg_trgm`, `citext`. Không Redis ở bản này.
- **Drizzle ORM** + drizzle-kit migration (file SQL được review), SQL thô khi cần `FOR UPDATE`, trigger.
- Tệp: **S3-compatible** (`@aws-sdk/client-s3` v3), upload thẳng bằng pre-signed URL, bucket `quarantine/` → quét **ClamAV** → `evidence/`.
- Văn bản: **docxtemplater** (Word) + **Gotenberg** (DOCX/HTML → PDF); ExcelJS, archiver (ZIP stream lên S3), `qrcode`.
- Auth: **tự viết trong `identity`** (ADR 0005): mật khẩu argon2id (`@node-rs/argon2`), TOTP (`otplib`), token phiên lưu hash trong DB, khóa tạm theo tài khoản; đăng nhập là use case có audit + outbox cùng transaction. Phân quyền: `can(actor, action, resource)` trong domain, dựa trên vai trò + phạm vi (`role_assignment(user, role, scope_type, scope_id)`) + trạng thái hồ sơ.
- UI: Tailwind + shadcn/ui (Radix), TanStack Table, React Hook Form + Zod. Responsive, không app native.
- Email: Nodemailer qua SMTP trong nước, mẫu React Email. Thông báo trong app: bảng `notification` + polling/SSE.
- Hạ tầng: **Docker Compose trên 1 VM** (4 vCPU / 8 GB): `caddy`, `web` x2, `worker`, `gotenberg`, `clamd`, `migrate`. PostgreSQL và S3 dùng dịch vụ quản lý của nhà cung cấp. Giám sát (Loki, Prometheus, Grafana, GlitchTip, Uptime Kuma) trên VM riêng.
- Test: **Vitest** (domain), **Testcontainers + Postgres thật** (use case, trigger), **Playwright** (E2E theo vai trò).

## Quy tắc nghiệp vụ cốt lõi (không được làm sai)

- **State machine hồ sơ**: bảng chuyển trạng thái dạng dữ liệu `{from, to, action, guard, roles}` theo đúng 15 trạng thái ở luồng xử lý mục 1.2 (14 gốc + Đã rút, ADR 0007). Mọi chuyển trạng thái đi qua một hàm `transition()`: optimistic lock (`version`), ghi `dossier_event`, ghi outbox, trong một transaction.
- **Bộ tiêu chí có phiên bản** (L19, ADR 0006): `criteria_version` draft → published (bất biến sau publish) chứa cây Nhóm sản phẩm → Phân nhóm → Bộ tiêu chí; mỗi bộ gồm Phần A/B/C → Mục → Nhóm tiêu chí (tùy chọn) → Tiêu chí → Mức điểm (điểm, Sao tối thiểu, nhãn nhánh). Phiếu chấm gắn FK tới Mức điểm của phiên bản đã publish. Trigger chặn UPDATE/DELETE trên phiên bản đã publish. Hồ sơ gắn cố định với một Bộ tiêu chí từ lúc tạo.
- **Hạng sao** = min(hạng theo Ngưỡng hạng của điểm, hạng cao nhất mà mọi Sao tối thiểu đều đạt); luôn lưu 1 đến 5 sao, dưới 3 sao là không đạt.
- **Sao chép dữ liệu Tổ tư vấn** sang phiếu thành viên (L12): xét **theo từng tiêu chí** trên phiếu `draft`: dòng chưa bị thành viên sửa thì cập nhật, dòng đã sửa (`edited = true`) thì giữ và báo lại; phiếu `confirmed`/`absent` (Vắng) thì bỏ qua toàn bộ, phiếu `superseded` không còn là phiếu hiện hành. Lưu trên dòng `source`, `advisory_version_id`, `advisory_level_original`, `adjust_reason`. Điều chỉnh khác Mức điểm gốc mà thiếu lý do thì từ chối (TV-04). Phiếu trống mở cho thành viên bổ sung/thay thế sau lần sao chép đầu (`awaiting_copy`) chờ lần sao chép tiếp theo mới lưu, xác nhận được.
- **Khóa ba lớp**: domain từ chối + trigger DB chặn UPDATE khi phiếu không còn `draft` (`confirmed`/`absent` chỉ được chuyển sang `superseded` khi Trả phiếu hoặc thay thành viên Vắng, ADR 0008) + user DB của app không có quyền tắt trigger. Phiếu "đã khóa" là phiếu được tính trong kết quả chốt hiện hành (`aggregate_result` chưa superseded); Mở khóa sau chốt chỉ đánh dấu kết quả đó superseded, không mở lại phiếu. Báo cáo Tổ tư vấn đã phát hành thì bất biến; sửa = tạo version N+1 có lý do.
- **Xác thực lại (step-up)** bằng TOTP trong 5 phút trước khi xác nhận phiếu và chốt điểm; nếu cấu hình triển khai tắt bắt buộc TOTP thì dùng mật khẩu, audit ghi phương thức (ADR 0003).
- Khi chốt (HD-08): lưu `aggregate_result` kèm snapshot JSONB toàn bộ phiếu và hash SHA-256.
- Số hiệu giấy chứng nhận: bảng `cert_counter` + `UPDATE ... RETURNING` trong transaction, unique `(year, number)`; không dùng sequence.
- Audit: `audit_log` append-only, partition theo tháng, có `prev_hash`; user app chỉ INSERT. Ghi cả truy cập dữ liệu cá nhân (NĐ 13/2023).
- Ma trận phân quyền phải có test: Tổ tư vấn không chốt điểm, không quyết định công nhận; thành viên chỉ thấy hồ sơ được phân công; một người không vừa là Tổ tư vấn vừa chấm cùng hồ sơ; chủ thể không thấy điểm từng thành viên.
- Thời gian lưu `timestamptz` UTC, hiển thị giờ Việt Nam (Asia/Ho_Chi_Minh). Tìm kiếm tiếng Việt không dấu qua `unaccent` + `pg_trgm`.

## Thứ tự xây dựng

Bước 1 đến 4 đã xong: nền tảng, tiêu chí và đợt, chủ thể và xã (L01–L06), cấp tỉnh và chấm điểm (L07–L15).

5. Kết quả: L16, L17, xuất Excel/PDF (DC-05). Viết test ma trận phân quyền và test trigger trước khi làm UI.
6. Đợt 2: QR, trang xác thực công khai, thống kê SO-06.

## Chạy kiểm tra

- Trong lúc TDD chỉ chạy file test đang làm, ví dụ `pnpm --filter @ocop/infra exec vitest run --config vitest.int.config.ts test/scoring/finalize.int.test.ts`. Cả bộ `pnpm test:int` chạy một lần trước khi báo xong.
- Diff đổi audit, outbox, `version` hay trạng thái hồ sơ, hoặc đổi màn hình: chạy `pnpm e2e` trước khi push (cần Docker, cổng 8080 trống).
- Điều phối nhiều implementer: tối đa 3 chạy cùng lúc.

## Giả định đang mở (cần chủ đầu tư xác nhận)

Giữ chúng ở dạng cấu hình (trong `criteria_version` / `round_config`), không hard-code.

- Bộ tiêu chí QĐ 26/2026/QĐ-TTg (26 bộ, A/B/C = 40/25/35, Ngưỡng hạng 30/50/70/90) đã bóc tách ở `docs/tieu-chi/` từ bản scan; các chỗ cần soát nằm ở sheet "Cần rà soát". 18 tiêu chí mẫu trong prototype chỉ là minh họa.
- Điểm tổng hợp = trung bình cộng các thành viên; Sao tối thiểu so bằng điểm trung bình của tiêu chí.
- Mức "Không đáp ứng, 0 điểm" tự thêm cho tiêu chí mà phiếu QĐ 26 không có mức 0.
- Quyền xem điểm (L13–L15, TV-06, TV-08; luồng xử lý tự mâu thuẫn giữa "họp xem điểm của nhau rồi chốt" và "chỉ xem sau khi chốt"): thành viên thấy phiếu người khác và điểm tổng hợp chỉ khi đã xác nhận phiếu của mình và hồ sơ Sẵn sàng chốt; Chủ tịch, Thư ký thấy điểm từng phiếu ngay khi phiếu được xác nhận, điểm tổng hợp và Cờ chênh lệch từ Sẵn sàng chốt (chủ đầu tư đã trả lời trong `docs/to-questionnaire-so-nnmt-hoi-dong-va-ket-qua.md`, #68); Tổ tư vấn thấy điểm tổng hợp sau khi chốt; Chủ thể, xã, Sở không bao giờ thấy phiếu từng thành viên. Cần đối chiếu quy chế hội đồng.
- Quy chế hội đồng: số thành viên chấm, quy tắc tổng hợp (trung bình, loại điểm lệch, ngưỡng cờ chênh lệch).
- Cấp độ an toàn thông tin của hệ thống (dự kiến cấp 2 hoặc 3) và yêu cầu với nhà cung cấp cloud.
- Thời hạn lưu audit, hồ sơ, minh chứng.
- SMTP của cơ quan hay dịch vụ riêng; tên miền chính thức (in vào QR, không đổi được sau khi in).
- Nhà cung cấp cloud: GreenNode có PostgreSQL quản lý (vDB cluster); FPT và Viettel chưa kiểm chứng. S3 trong nước có thể lệch chuẩn AWS (checksum SDK v3, path-style, CopyObject + SSE): chạy bộ test tương thích S3 ngay từ bước 1, đặt `requestChecksumCalculation: WHEN_REQUIRED`.
- Đặc tả Excel: trang bìa đang là trang in đầu của sheet "Chỉ mục"; các ô "UBND tỉnh", "Đơn vị soạn thảo", "Người duyệt" còn trống. Mô tả input/output từng bước là diễn giải, cần rà lại trước khi dùng làm tài liệu chính thức.

## Prototype giao diện

- Màu chủ đạo xanh lá tươi (phong cách nông nghiệp), vàng lúa cho hạng sao; font Be Vietnam Pro; icon Lucide. Bố cục: sidebar tối thu gọn được, breadcrumb, thẻ bo tròn, panel bên. Có dark mode và khung di động 400px.
- Dùng prototype làm tham chiếu bố cục, trạng thái màn hình (trống, đang tải, lỗi, đã khóa, chưa đủ phiếu) và hành trình; khi dựng ứng dụng thật, chuyển sang Tailwind + shadcn/ui, giữ token màu từ `design/prototype/src/styles.css`.

## Agent skills

### Issue tracker

Issues và spec nằm trên GitHub Issues của `ndlinh-celtic/ocop` (dùng `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Năm nhãn mặc định: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` ở gốc repo. See `docs/agents/domain.md`.
