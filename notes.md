Tôi đã đọc SKILL.md của các skill liên quan và đối chiếu với trạng thái repo: tài liệu đã đầy đủ, kiến trúc đã chốt, chưa có dòng mã nào, và chưa có GLOSSARY.md, docs/adr/ hay docs/agents/.
  Lộ trình tôi đề xuất như sau.

  0. Cấu hình một lần: /setup-matt-pocock-skills

  Bước này chọn nơi lưu ticket (GitHub Issues hoặc file markdown trong .scratch/) và chỗ đặt GLOSSARY.md cùng các ADR. Các skill phía sau như /to-spec, /to-tickets và /wayfinder cần cấu hình
  này mới chạy được.

  1. Không cần /wayfinder cho toàn dự án

  /wayfinder dành cho dự án lớn mà chưa rõ phải đi thế nào, và kết quả của nó là các quyết định. Ở repo này phần lớn quyết định đã có: kiến trúc, 14 trạng thái hồ sơ, các luồng L01–L25 và thứ
  tự 6 bước xây dựng trong CLAUDE.md. Chạy wayfinder lúc này phần lớn chỉ là đi chốt lại những gì đã chốt.

  Phần còn chưa rõ nằm ở phía chủ đầu tư: tỷ lệ điểm 40/25/35, ngưỡng sao, quy chế hội đồng, cấp độ an toàn thông tin, tên miền in trên QR. Phần này nên dùng /to-questionnaire để soạn một bảng
  câu hỏi gửi họ, không cần grill bản thân.

  2. Mỗi bước trong "Thứ tự xây dựng" chạy một vòng main flow

  Bắt đầu từ bước 1 (Nền tảng: monorepo, identity + TOTP, audit, outbox + pg-boss, FileStore S3):

  1. /grill-with-docs để chốt các chi tiết tài liệu chưa nói, ví dụ ranh giới AuthPort, schema role_assignment, cách nối hash chuỗi trong audit. Trong lúc đó nó tạo GLOSSARY.md (hồ sơ, chủ
     thể, phiếu, phiên bản tiêu chí...) và các ADR.
  2. /to-spec rồi /to-tickets. Giữ cả ba bước 1, 2 và bước này trong cùng một cửa sổ context, đừng /clear hay /compact giữa chừng.
  3. Làm ticket theo một trong hai cách:
     - /implement từng ticket, /clear giữa các ticket.
     - /implement-spec để chạy song song cả spec trên một nhánh tích hợp.

     Cả hai cách đều đi qua /tdd và kết thúc bằng /code-review.
  4. /retro sau mỗi bước. Những lỗi máy móc thì biến thành check tự động, ví dụ lint chặn import Drizzle từ apps/web.

  3. Lúc nên rẽ sang /prototype

  Khi có câu hỏi không thể trả lời bằng tài liệu. Hai chỗ dễ gặp nhất:
  - Bảng chuyển trạng thái {from, to, action, guard, roles} có đủ cho cả 14 trạng thái không.
  - Logic sao chép dữ liệu Tổ tư vấn ở L12, với các trạng thái prefilled/edited/confirmed/locked.

  Mỗi chỗ nên làm một prototype logic nhỏ, chạy được, đặt ở nhánh prototype/<name>, rồi dùng /handoff để mang kết quả về luồng chính.

  ---

