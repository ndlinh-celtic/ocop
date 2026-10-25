# Coding standards

Quy tắc reviewer áp dụng trên diff, ngoài các quy tắc nghiệp vụ ở `CLAUDE.md`. Mỗi quy tắc ở đây cần phán đoán; quy tắc cơ học thì đã thành lint, test hoặc trigger. Mỗi quy tắc ghi lỗi đã lọt qua review mà nó sinh ra để chặn.

## Bản ghi hiện hành và thao tác thay thế

Kết quả chốt, Phân công, Phiếu chấm và phiên bản Báo cáo Tổ tư vấn đều có thể bị **thay thế** (`superseded`, hết hiệu lực) bởi Mở khóa, Trả phiếu, thay thành viên hoặc Sở trả về.

- Đọc bản ghi hiện hành qua hàm hoặc truy vấn repo đã có (ví dụ `isMemberInForce`, truy vấn kết quả có `superseded_at IS NULL`), không viết lại điều kiện tại chỗ.
- Khi diff thêm hoặc đổi một thao tác thay thế, reviewer liệt kê **mọi nơi đọc** bản ghi bị thay (repo, use case, văn bản họp, trang, thông báo) và kiểm từng nơi: bản ghi đã bị thay thì không còn hiện là hiện hành, và hồ sơ vẫn đi tiếp được (thêm lại vào Phiên họp, sửa lại Phân công).

Lỗi đã lọt: PR #65 lỗi 2, 3 (kết quả đã Mở khóa vẫn "Đã chốt"), lỗi 6 (Phân công giữ qua Sở trả về nhưng Thư ký không sửa được), "Phân công đang hiệu lực" viết lại 6 lần.

## Hạng sao

Hạng sao được tính ở một nơi (`packages/core/src/criteria/star-rank.ts`) rồi lưu lại. Mọi quyết định theo hạng (ghi chú đề nghị xét 5 sao, danh sách trong dự thảo quyết định, thống kê) đọc Hạng sao đã lưu, không so điểm với Ngưỡng hạng, vì Sao tối thiểu có thể kéo hạng xuống.

Lỗi đã lọt: PR #65 lỗi 4 (hồ sơ 92 điểm, 4 sao vẫn được ghi đề nghị xét 5 sao).

## Version hồ sơ

`version` của hồ sơ là khóa lạc quan mà Chốt điểm, Phát hành, Giao chấm và Phân công giữ. Chỉ `transition()` tăng nó.

- Thao tác chỉ ghi một thứ có `version` riêng (nháp Phiếu chấm, nháp Báo cáo Tổ tư vấn) là dòng `checkOnly` trong `transitions.ts`; use case gọi `assertTransitionAllowed` và tự ghi audit, không ghi outbox.
- Với mỗi dòng mới có `from === to`, reviewer hỏi: thao tác này có đổi gì trên chính hồ sơ không? Không thì là `checkOnly`.

Lỗi đã lọt: PR #65 lỗi 1 (lưu nháp Phiếu chấm chặn Chốt điểm), rồi cùng lỗi ở nháp Báo cáo Tổ tư vấn.

## Truy cập dữ liệu cá nhân

Một use case đọc ghi `personal_data.viewed` (NĐ 13/2023, trong cùng transaction đọc) khi nó cho người dùng thấy dữ liệu cá nhân của **người khác**: thông tin tài khoản, danh sách thành viên Hội đồng, hồ sơ và giấy tờ của chủ thể (trừ chính chủ thể đó), điểm từng phiếu kèm họ tên thành viên chấm. `metadata.view` đặt tên kiểu xem; chỉ ghi khi dữ liệu đó thực sự hiện (một kiểu xem chưa có phiếu nào đã xác nhận thì không ghi).

- Đang ghi: `identity/staff.ts` (danh sách, chi tiết tài khoản), `councils/read.ts` (thành viên Hội đồng), `entities/read.ts`, `entities/profile.ts` (chủ thể), `scoring/read.ts` kiểu xem `confirmed_sheets`. Kiểu xem `full` còn thiếu: #73.
- Khi diff thêm một kiểu xem hay mở rộng người được xem, reviewer hỏi: người đọc có thấy dữ liệu cá nhân của người khác không? Có thì phải có dòng audit và test đọc lại nó.
- Ticket yêu cầu audit "như chỗ khác" thì reviewer kiểm chỗ khác đó có thật trong danh sách trên.

Lỗi đã lọt: #68 viết "ghi audit như các lần xem điểm khác" trong khi chưa kiểu xem điểm nào ghi; kiểu xem `full` lộ họ tên kèm điểm mà không có audit.

## Server action

Server action parse input bằng `safeParse` và trả lỗi về form; lỗi parse không được ném ra khỏi action.

Lỗi đã lọt: PR #65 lỗi 10 (`unlockAction`).

## Test

Test lấy `version` và các giá trị sinh ra từ kết quả trả về hoặc đọc lại, không tự suy ra (`dossierVersion + 1`, đếm audit bằng outbox). Một test tự suy ra tác dụng phụ sẽ khóa chặt hành vi cũ, và đỏ khi tác dụng phụ đó được sửa đúng.

Lỗi đã lọt: fixture ma trận phân quyền Báo cáo Tổ tư vấn và assertion audit/outbox của E2E L08–L15, cả hai đỏ sau khi sửa lỗi 1.
