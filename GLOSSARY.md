# OCOP – đánh giá, phân hạng sản phẩm (bản một tỉnh)

Ngôn ngữ chung của hệ thống số hóa vòng đời hồ sơ OCOP, từ chủ thể nộp đến cấp giấy chứng nhận.

## Danh tính và quyền

**Chủ thể**:
Tổ chức sản xuất (doanh nghiệp, hợp tác xã, hộ sản xuất) có mã số thuế hoặc số định danh, thuộc một xã/phường, đứng tên các hồ sơ sản phẩm.
_Avoid_: Tài khoản chủ thể, doanh nghiệp (khi nói chung)

**Người dùng**:
Một người có tài khoản đăng nhập vào hệ thống. Một Người dùng có thể giữ nhiều Phân vai.
_Avoid_: Tài khoản, user (khi nói về một tổ chức)

**Vai trò**:
Một trong tám nhóm quyền cố định: Chủ thể, Cán bộ xã, Cán bộ Sở, Chủ tịch hội đồng, Thư ký hội đồng, Thành viên hội đồng, Thành viên Tổ tư vấn, Quản trị.
_Avoid_: Nhóm quyền, quyền, Quản trị nghiệp vụ (là Vai trò Quản trị)

**Phạm vi**:
Đơn vị dữ liệu mà một Phân vai có hiệu lực trên đó: một Chủ thể, một xã/phường, tỉnh, một hội đồng, hoặc toàn hệ thống.
_Avoid_: Scope, đơn vị

**Phân vai**:
Việc gán một Vai trò trên một Phạm vi cho một Người dùng, có thời hạn hiệu lực.
_Avoid_: Gán quyền, role assignment

**Vai trò đang dùng**:
Phân vai mà Người dùng chọn cho phiên làm việc hiện tại; mọi kiểm tra quyền dựa trên nó.
_Avoid_: Vai trò hiện tại, chế độ

**Phân công**:
Việc hội đồng giao một hồ sơ cụ thể cho một thành viên hội đồng hoặc Tổ tư vấn. Khác với Phân vai: Phân công gắn với hồ sơ và có thể bị thay vì xung đột lợi ích.
_Avoid_: Gán hồ sơ, phân vai theo hồ sơ

**Xác thực lại**:
Bước Người dùng chứng minh lại danh tính ngay trước một thao tác nhạy cảm (xác nhận phiếu, chốt điểm), có hiệu lực 5 phút.
_Avoid_: Step-up, đăng nhập lại

## Tiêu chí và đợt đánh giá

**Đợt đánh giá**:
Một kỳ tiếp nhận và đánh giá hồ sơ do Sở mở, có ba mốc hạn và áp dụng đúng một Phiên bản tiêu chí. Gọi tắt "đợt" trong ngữ cảnh nghiệp vụ.
_Avoid_: Đợt 1/Đợt 2 (khi nói về giai đoạn phát hành phần mềm), kỳ, round

**Trạng thái đợt**:
Một trong bốn giai đoạn của Đợt đánh giá: Nháp, Đang nhận nộp, Đã đóng nộp, Đã kết thúc.
_Avoid_: Đợt mở/đóng (khi không rõ là đóng nộp hay kết thúc)

**Gia hạn đợt**:
Việc Sở lùi Hạn nộp xã hoặc Hạn gửi tỉnh, có lý do; gia hạn Hạn nộp xã của đợt Đã đóng nộp đưa đợt về Đang nhận nộp.
_Avoid_: Mở lại đợt, kéo dài đợt

**Hạn nộp xã**:
Mốc cuối để Chủ thể nộp hồ sơ về UBND xã/phường trong một Đợt đánh giá; qua mốc này đợt đóng nhận nộp.
_Avoid_: Hạn nộp của xã (mơ hồ), hạn đợt

**Hạn gửi tỉnh**:
Mốc cuối để UBND xã/phường đề xuất hồ sơ của đợt lên tỉnh.
_Avoid_: Hạn nộp của xã

**Hạn đánh giá tỉnh**:
Mốc dự kiến tỉnh hoàn thành đánh giá các hồ sơ của đợt; chỉ để nhắc việc.
_Avoid_: Hạn chốt

**Chế độ chấm**:
Cách hội đồng chấm hồ sơ trong một Đợt đánh giá: chấm trực tiếp, hoặc dựa trên Tổ tư vấn.
_Avoid_: Hình thức chấm, chế độ kết hợp (đã bỏ)

**Phiên bản tiêu chí**:
Toàn bộ danh mục phân loại sản phẩm, các Bộ tiêu chí và Ngưỡng hạng theo một văn bản căn cứ (ví dụ QĐ 26/2026/QĐ-TTg); bất biến sau khi phát hành.
_Avoid_: Bộ tiêu chí (khi nói về cả phiên bản), version

**Nhóm sản phẩm**:
Cấp phân loại cao nhất trong một Phiên bản tiêu chí (QĐ 26 có 6 nhóm: Thực phẩm, Đồ uống, Dược liệu…); số nhóm do văn bản căn cứ quyết định.
_Avoid_: Ngành hàng, 6 nhóm OCOP (như một hằng số)

**Phân nhóm**:
Cấp phân loại giữa Nhóm sản phẩm và Bộ tiêu chí, theo Phụ lục I của văn bản căn cứ.
_Avoid_: Nhóm con

**Bộ tiêu chí**:
Phiếu chấm điểm chính thức cho một loại sản phẩm trong một Phiên bản tiêu chí (QĐ 26 có 26 bộ); hồ sơ sản phẩm được chấm theo đúng một Bộ tiêu chí.
_Avoid_: Bộ sản phẩm, thang điểm, phiếu tiêu chí

**Phần**:
Khối điểm lớn nhất của Bộ tiêu chí: A (Sản phẩm và sức mạnh cộng đồng), B (Khả năng tiếp thị), C (Chất lượng sản phẩm).
_Avoid_: Nhóm A/B/C, section

**Mục**:
Khối điểm trong một Phần, gồm một hoặc nhiều Tiêu chí (ví dụ "1. Tổ chức sản xuất").
_Avoid_: Nhóm tiêu chí (khi nói về mục)

**Nhóm tiêu chí**:
Khối điểm tùy chọn giữa Mục và Tiêu chí (ví dụ "6.1 Ngoại hình").
_Avoid_: Tiểu mục

**Tiêu chí**:
Đơn vị chấm nhỏ nhất, có mã (ví dụ 1.5), yêu cầu, điểm tối đa và danh sách Mức điểm; người chấm chọn đúng một mức.
_Avoid_: Chỉ tiêu, câu hỏi

**Mức điểm**:
Một lựa chọn của Tiêu chí gồm mô tả, điểm và có thể có Sao tối thiểu; có thể mang nhãn nhánh (a/b) khi tiêu chí chia trường hợp. Mức "Không đáp ứng, 0 điểm" luôn có sẵn.
_Avoid_: Lựa chọn, đáp án, option

**Sao tối thiểu**:
Hạng sao mà một Mức điểm là yêu cầu tối thiểu phải đạt (dấu ***, ****, ***** trên phiếu).
_Avoid_: Điều kiện sao, dấu sao

**Hạng sao**:
Kết quả phân hạng từ 1 đến 5 sao; là hạng thấp hơn giữa hạng theo Ngưỡng hạng của điểm và hạng cao nhất mà mọi yêu cầu Sao tối thiểu đều đạt.
_Avoid_: Số sao (khi nói về kết quả), xếp loại

**Ngưỡng hạng**:
Điểm tối thiểu cho từng Hạng sao từ 2 đến 5 sao (QĐ 26: 30, 50, 70, 90), thuộc Phiên bản tiêu chí.
_Avoid_: Mốc sao, ngưỡng điểm (khi nói chung)

**Điều kiện loại**:
Một trường hợp "Hồ sơ bị loại khi…" của Bộ tiêu chí; người loại hồ sơ phải viện dẫn một điều kiện loại.
_Avoid_: Điều kiện loại trừ, tiêu chí loại

**Quy tắc tổng hợp**:
Cách tính điểm tổng hợp của hồ sơ từ các phiếu chấm và điều kiện hợp lệ của hội đồng (số thành viên tối thiểu, xử lý điểm lệch, ngưỡng cờ chênh lệch), thuộc Đợt đánh giá.
_Avoid_: Công thức điểm, quy chế (khi nói về cấu hình)

## Quan hệ

- Một **Chủ thể** có đúng một **Người dùng** đại diện ở giai đoạn phát hành 1, liên kết qua một **Phân vai** Chủ thể.
- "Đã xác thực" là trạng thái của **Chủ thể** (giấy tờ pháp lý hợp lệ); xác nhận email là việc của **Người dùng**.
- Chủ tịch UBND tỉnh không phải **Người dùng**; quyết định thành lập hội đồng được lưu dưới dạng tệp.
- Một **Phiên bản tiêu chí** phân loại **Nhóm sản phẩm** → **Phân nhóm** → **Bộ tiêu chí**; một **Bộ tiêu chí** gồm **Phần** → **Mục** → (**Nhóm tiêu chí**) → **Tiêu chí** → **Mức điểm**; một **Đợt đánh giá** áp dụng đúng một **Phiên bản tiêu chí**.
- Hồ sơ gắn cố định với một **Bộ tiêu chí** (và do đó một **Phiên bản tiêu chí**) từ lúc tạo; đổi Bộ tiêu chí là tạo hồ sơ mới.
- Hồ sơ mới dùng Phiên bản tiêu chí của đợt Đang nhận nộp, nếu không có thì dùng phiên bản phát hành mới nhất.
- Hồ sơ nháp khác Phiên bản tiêu chí của đợt đang mở thì không nộp được; Chủ thể có thể sao chép thông tin sản phẩm và tệp minh chứng sang hồ sơ mới, rồi gắn lại minh chứng theo tiêu chí. Điểm tự chấm không được sao chép.
- Hồ sơ thuộc một **Đợt đánh giá** từ lúc Chủ thể nộp, và chỉ nộp được vào đợt áp dụng đúng Phiên bản tiêu chí của hồ sơ; UBND xã/phường có thể chuyển hồ sơ sang đợt sau áp dụng cùng phiên bản, kèm lý do.
- Tại mỗi thời điểm có tối đa một **Đợt đánh giá** ở trạng thái Đang nhận nộp; Chủ thể nộp là vào đợt đó.
- Hạng dưới 3 sao là không đạt và không được cấp giấy chứng nhận; hạng vẫn được ghi trong kết quả.
- Sửa một **Phiên bản tiêu chí** đã phát hành (kể cả sửa lỗi bóc tách) là tạo phiên bản mới bằng cách sao chép rồi hiệu chỉnh, có thể cùng văn bản căn cứ; các phiên bản không có quan hệ kế thừa với nhau.
- Ngày hiệu lực của **Phiên bản tiêu chí** chỉ để ghi nhận; phiên bản được dùng là phiên bản mà **Đợt đánh giá** áp dụng.
- **Chế độ chấm** do Sở đặt khi tạo đợt; Thư ký hội đồng đổi được cho đến khi đợt có phiếu chấm đầu tiên.
