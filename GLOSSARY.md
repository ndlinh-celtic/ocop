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
_Avoid_: Nhóm quyền, quyền, Quản trị nghiệp vụ (là Vai trò Quản trị), Lãnh đạo xã và văn thư (không phải Vai trò; đều là Cán bộ xã)

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
Việc Sở lùi Hạn nộp xã, Hạn gửi tỉnh hoặc Hạn đánh giá tỉnh, có lý do. Hạn nộp xã chỉ gia hạn được khi đợt còn Đang nhận nộp; Hạn gửi tỉnh và Hạn đánh giá tỉnh gia hạn được khi đợt Đang nhận nộp hoặc Đã đóng nộp.
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

**Mốc nhắc hạn**:
Số ngày trước một hạn (Hạn nộp xã, hạn bổ sung, Hạn gửi tỉnh) mà hệ thống nhắc người liên quan; cấu hình chung toàn hệ thống do Quản trị đặt (mặc định 30, 14, 7, 1). Mỗi mốc chỉ nhắc một lần cho mỗi đối tượng.
_Avoid_: Lịch nhắc, mốc hạn (là chính các hạn)

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
Một trường hợp "Hồ sơ bị loại khi…" của Bộ tiêu chí; hội đồng hoặc Tổ tư vấn loại hồ sơ phải viện dẫn một điều kiện loại.
_Avoid_: Điều kiện loại trừ, tiêu chí loại

**Quy tắc tổng hợp**:
Cách tính điểm tổng hợp của hồ sơ từ các phiếu chấm và điều kiện hợp lệ của hội đồng (số thành viên tối thiểu, xử lý điểm lệch, ngưỡng cờ chênh lệch), thuộc Đợt đánh giá.
_Avoid_: Công thức điểm, quy chế (khi nói về cấu hình)

## Hồ sơ ở cấp xã

**Hồ sơ**:
Một lần Chủ thể đề nghị đánh giá một sản phẩm theo đúng một Bộ tiêu chí; đi qua vòng đời trạng thái và thuộc một Đợt đánh giá từ lúc nộp. Không có thực thể Sản phẩm riêng: thông tin sản phẩm nằm trong hồ sơ.
_Avoid_: Sản phẩm (khi nói về đơn vị được xử lý), hồ sơ sản phẩm OCOP (dài), dossier

**Lý do loại sơ bộ**:
Lý do UBND xã/phường đưa hồ sơ về Không đạt sơ bộ, chọn từ danh sách cố định (không đúng đối tượng, không đúng địa bàn, không bổ sung, chưa đạt Checklist sơ bộ, khác) kèm diễn giải; thay cho việc viện dẫn một Điều kiện loại.
_Avoid_: Điều kiện loại (khi xã loại)

**Phiên bản nộp**:
Bản chụp bất biến của hồ sơ tại một lần nộp hoặc nộp lại: thông tin sản phẩm, tệp minh chứng gắn theo tiêu chí, giải trình, điểm tự chấm, cùng Phiếu đăng ký và Báo cáo tự đánh giá sinh ra lúc nộp. Xã, tỉnh và hội đồng làm việc trên Phiên bản nộp mới nhất.
_Avoid_: Bản nộp, revision, phiên bản hồ sơ (mơ hồ với Phiên bản tiêu chí)

**Tiếp nhận**:
Việc UBND xã/phường ghi nhận đã nhận một hồ sơ Đã nộp xã và chỉ định Cán bộ phụ trách. Không phải một trạng thái hồ sơ; hồ sơ Đã nộp xã chưa tiếp nhận là hồ sơ "Chờ tiếp nhận".
_Avoid_: Nhận hồ sơ, duyệt

**Cán bộ phụ trách**:
Cán bộ xã chịu trách nhiệm xử lý một hồ sơ, nhận việc và thông báo về hồ sơ đó; đổi được, có lịch sử. Không giới hạn ai thấy hồ sơ: mọi Cán bộ xã của xã đều xem và xử lý được.
_Avoid_: Phân công (dành cho hội đồng), người xử lý

**Đã rút**:
Trạng thái cuối khi Chủ thể rút hồ sơ đã nộp mà xã chưa Tiếp nhận, kèm lý do.
_Avoid_: Hủy hồ sơ

**Nhập hộ**:
Việc Cán bộ xã tạo, sửa hoặc nộp hồ sơ thay mặt một Chủ thể thuộc xã mình; được ghi nhận là thao tác của cán bộ thay mặt Chủ thể, không phải đăng nhập bằng tài khoản Chủ thể.
_Avoid_: Đăng nhập thay, giả danh

**Chuyển xã**:
Việc Cán bộ xã chuyển một hồ sơ không thuộc địa bàn sang xã/phường đúng, kèm lý do. Chỉ đổi xã của hồ sơ, không đổi xã đăng ký của Chủ thể.
_Avoid_: Chuyển địa bàn (khi nói về Chủ thể)

**Checklist sơ bộ**:
Danh sách mục mà Cán bộ xã đánh giá trước khi đề xuất hồ sơ lên tỉnh (mặc định: tính pháp lý; tính hợp lệ của Phiếu đăng ký và Báo cáo tự đánh giá; nguồn gốc nguyên liệu địa phương và quy mô sản xuất; lao động địa phương; bản sắc văn hóa và trí tuệ bản địa), thuộc Đợt đánh giá; mỗi mục có kết quả đạt, không đạt hoặc cần xác minh.
_Avoid_: Tiêu chí sơ bộ (dễ lẫn với Tiêu chí)

**Phiếu đăng ký**:
Văn bản Chủ thể đăng ký đánh giá, phân hạng một sản phẩm (Mẫu 01, cần đối chiếu văn bản căn cứ); hệ thống sinh từ dữ liệu hồ sơ lúc nộp, không cần chữ ký tay.
_Avoid_: Đơn đăng ký, phiếu đề nghị

**Báo cáo tự đánh giá**:
Báo cáo Chủ thể tự đánh giá sản phẩm theo Bộ tiêu chí (Mẫu 02, cần đối chiếu văn bản căn cứ); hệ thống sinh từ điểm tự chấm và giải trình lúc nộp.
_Avoid_: Phiếu tự chấm, điểm tự chấm (khi nói về văn bản)

**Báo cáo đánh giá cấp xã**:
Báo cáo của UBND xã/phường về một hồ sơ, xác nhận các nội dung thuộc thẩm quyền địa bàn (Mẫu 03 hoặc mẫu của tỉnh); sinh từ mẫu, ký số ngoài hệ thống rồi tải lên; bắt buộc trước khi gửi tỉnh. Mỗi hồ sơ một báo cáo.
_Avoid_: Biên bản sơ bộ, biên bản đánh giá sơ bộ, văn bản đề xuất (theo lô, làm ngoài hệ thống)

## Cấp tỉnh và chấm điểm

**Hội đồng**:
Hội đồng đánh giá, phân hạng cấp tỉnh do Chủ tịch UBND tỉnh quyết định thành lập, gồm Chủ tịch, Thư ký, các Thành viên hội đồng và Tổ tư vấn; mỗi Đợt đánh giá được gán đúng một Hội đồng, một Hội đồng có thể phục vụ nhiều đợt.
_Avoid_: Hội đồng của đợt (khi nói về thực thể), council

**Tổ tư vấn**:
Nhóm Thành viên Tổ tư vấn thuộc một Hội đồng, thành lập cùng quyết định; thẩm định hồ sơ và đề xuất điểm, không chấm điểm chính thức.
_Avoid_: Tổ thẩm định, Tổ giúp việc, Tổ thường trực

**Tổ trưởng**:
Thành viên Tổ tư vấn được Hội đồng chỉ định là người duy nhất phát hành Báo cáo Tổ tư vấn; là chức danh trong Hội đồng, không phải Vai trò.
_Avoid_: Trưởng nhóm, Vai trò Tổ trưởng

**Tiếp nhận tại tỉnh**:
Việc Cán bộ Sở ghi nhận đã nhận một hồ sơ Đã chuyển tỉnh để đưa vào phân công; không phải một trạng thái, mỗi lượt gửi tỉnh có một lần.
_Avoid_: Sở duyệt, Tiếp nhận (khi nói về xã)

**Giao chấm**:
Việc Thư ký hội đồng chốt các Phân công của một hồ sơ đã Tiếp nhận tại tỉnh và đưa hồ sơ vào chấm theo Chế độ chấm của đợt.
_Avoid_: Phân công (khi nói về việc bắt đầu chấm), mở chấm

**Báo cáo Tổ tư vấn**:
Báo cáo thẩm định chung của Tổ tư vấn cho một hồ sơ: đánh giá minh chứng và Mức điểm đề xuất theo từng Tiêu chí, kèm căn cứ và nhận xét; mỗi lần phát hành là một phiên bản bất biến.
_Avoid_: Báo cáo thẩm tra, báo cáo thẩm định (khi lẫn với Báo cáo đánh giá cấp xã), phiếu Tổ tư vấn

**Điểm đề xuất**:
Mức điểm Tổ tư vấn đề xuất cho một Tiêu chí trong Báo cáo Tổ tư vấn; không phải điểm chính thức.
_Avoid_: Điểm Tổ tư vấn (khi nói như điểm chính thức)

**Phiếu chấm**:
Bản chấm chính thức của một Thành viên hội đồng cho một hồ sơ: một Mức điểm cho mỗi Tiêu chí, kèm nhận xét; có thể được điền sẵn từ Báo cáo Tổ tư vấn.
_Avoid_: Phiếu điểm, bảng điểm, phiếu đánh giá

**Sẵn sàng chốt**:
Tình trạng của hồ sơ khi số Phiếu chấm đã xác nhận đạt số người chấm tối thiểu của Quy tắc tổng hợp; tương ứng trạng thái Thành viên xác nhận.
_Avoid_: Đủ phiếu (mơ hồ giữa tối thiểu và tất cả)

**Vắng**:
Phiếu chấm chưa được xác nhận khi hội đồng chốt điểm; không tính vào điểm tổng hợp và được ghi vào biên bản.
_Avoid_: Bỏ phiếu trắng, phiếu hủy

**Trả phiếu**:
Việc Chủ tịch hoặc Thư ký hội đồng, trước khi chốt điểm, yêu cầu một thành viên chấm lại một Phiếu chấm đã xác nhận, có lý do; phiếu cũ giữ nguyên và bị thay bằng lần chấm mới.
_Avoid_: Mở khóa phiếu, sửa phiếu đã xác nhận

**Cờ chênh lệch**:
Dấu hiệu trên hồ sơ khi tổng điểm cao nhất và thấp nhất giữa các Phiếu chấm đã xác nhận lệch quá ngưỡng của Quy tắc tổng hợp; chỉ để hội đồng thảo luận, không chặn chốt.
_Avoid_: Điểm lệch (khi nói về cờ)

**Phiên họp**:
Một cuộc họp của Hội đồng trong một Đợt đánh giá, xét nhiều hồ sơ Sẵn sàng chốt; bảng tổng hợp điểm, biên bản và dự thảo quyết định công nhận lập theo Phiên họp, còn chốt điểm làm theo từng hồ sơ.
_Avoid_: Cuộc họp (khi nói chung), kỳ họp

**Mở khóa sau chốt**:
Việc Quản trị mở lại điểm đã chốt của một hồ sơ theo văn bản yêu cầu của Hội đồng, có lý do; xử lý sự cố, không phải nghiệp vụ thường.
_Avoid_: Sửa điểm, hủy chốt

## Quan hệ

- Một **Chủ thể** có đúng một **Người dùng** đại diện ở giai đoạn phát hành 1, liên kết qua một **Phân vai** Chủ thể.
- "Đã xác thực" là trạng thái của **Chủ thể**: có đủ các loại giấy tờ pháp lý bắt buộc còn hạn, không phải đã được cơ quan công nhận; tính hợp lệ thật sự do Cán bộ xã kiểm tra khi Tiếp nhận từng hồ sơ. Xác nhận email là việc của **Người dùng**.
- Chủ tịch UBND tỉnh không phải **Người dùng**; quyết định thành lập hội đồng được lưu dưới dạng tệp.
- Một **Phiên bản tiêu chí** phân loại **Nhóm sản phẩm** → **Phân nhóm** → **Bộ tiêu chí**; một **Bộ tiêu chí** gồm **Phần** → **Mục** → (**Nhóm tiêu chí**) → **Tiêu chí** → **Mức điểm**; một **Đợt đánh giá** áp dụng đúng một **Phiên bản tiêu chí**.
- Hồ sơ gắn cố định với một **Bộ tiêu chí** (và do đó một **Phiên bản tiêu chí**) từ lúc tạo; đổi Bộ tiêu chí là tạo hồ sơ mới.
- Hồ sơ mới dùng Phiên bản tiêu chí của đợt Đang nhận nộp, nếu không có thì dùng phiên bản phát hành mới nhất.
- Hồ sơ nháp khác Phiên bản tiêu chí của đợt đang mở thì không nộp được; Chủ thể có thể sao chép thông tin sản phẩm và tệp minh chứng sang hồ sơ mới, rồi gắn lại minh chứng theo tiêu chí. Điểm tự chấm không được sao chép.
- Hồ sơ thuộc một **Đợt đánh giá** từ lúc Chủ thể nộp, và chỉ nộp được vào đợt áp dụng đúng Phiên bản tiêu chí của hồ sơ; UBND xã/phường có thể chuyển hồ sơ sang đợt sau áp dụng cùng phiên bản, kèm lý do.
- Tại mỗi thời điểm có tối đa một **Đợt đánh giá** ở trạng thái Đang nhận nộp; Chủ thể nộp là vào đợt đó.
- Đợt ở trạng thái Đã đóng nộp không bao giờ trở lại Đang nhận nộp; **Gia hạn đợt** không mở lại đợt.
- Hạng dưới 3 sao là không đạt và không được cấp giấy chứng nhận; hạng vẫn được ghi trong kết quả.
- Sửa một **Phiên bản tiêu chí** đã phát hành (kể cả sửa lỗi bóc tách) là tạo phiên bản mới bằng cách sao chép rồi hiệu chỉnh, có thể cùng văn bản căn cứ; các phiên bản không có quan hệ kế thừa với nhau.
- Ngày hiệu lực của **Phiên bản tiêu chí** chỉ để ghi nhận; phiên bản được dùng là phiên bản mà **Đợt đánh giá** áp dụng.
- Hồ sơ mang xã/phường của **Chủ thể** tại lúc nộp; mọi quyền cấp xã dựa trên xã của hồ sơ, chỉ đổi qua **Chuyển xã**.
- Hồ sơ quá hạn bổ sung được đóng ở Không đạt sơ bộ với lý do "Không bổ sung".
- Cán bộ Sở thấy chi tiết hồ sơ từ khi hồ sơ Đã chuyển tỉnh (kể cả sau khi trả về xã); với hồ sơ chưa lên tỉnh chỉ thấy số liệu tổng hợp.
- Hồ sơ đã đánh giá sơ bộ xong nhưng quá Hạn gửi tỉnh ở lại Đã nộp xã ("Chờ đợt sau") đến khi Cán bộ xã chuyển sang một đợt cùng Phiên bản tiêu chí.
- Chỉ nộp được khi **Chủ thể** Đã xác thực, giấy tờ bắt buộc còn hạn, đủ thông tin sản phẩm bắt buộc và mọi tiêu chí đều có Mức điểm tự chấm (mức 0 điểm vẫn hợp lệ); tiêu chí thiếu minh chứng không chặn nộp. Giấy tờ hết hạn sau khi nộp chỉ gắn cờ, không đổi trạng thái hồ sơ.
- Hạn nộp xã chỉ chặn lần nộp đầu; nộp lại sau Yêu cầu bổ sung chỉ phụ thuộc hạn bổ sung, hồ sơ vẫn thuộc đợt cũ.
- Hồ sơ Sở trả về xã, sau khi Chủ thể nộp lại, quay về Đã nộp xã để xã gửi tỉnh lại; Tiếp nhận và **Cán bộ phụ trách** được giữ.
- **Chủ thể** thấy yêu cầu bổ sung, lý do loại và **Báo cáo đánh giá cấp xã** đã ký của hồ sơ mình, không thấy nhận xét từng mục **Checklist sơ bộ**.
- Xã loại hồ sơ bằng một **Điều kiện loại** của Bộ tiêu chí hoặc một **Lý do loại sơ bộ**.
- Hồ sơ làm lại từ hồ sơ cũ chỉ mang liên kết "sao chép từ"; không có quan hệ kế thừa nào khác giữa các hồ sơ.
- **Phiên bản nộp** chụp cả thông tin định danh của **Chủ thể**; xã và tỉnh làm việc theo bản chụp, kèm cờ khi thông tin hiện tại đã khác.
- **Chủ thể** tự đổi xã đăng ký; hồ sơ đã nộp không đổi xã. Cán bộ xã thấy Chủ thể đăng ký ở xã mình hoặc có hồ sơ đang thuộc xã mình, nhưng chỉ **Nhập hộ** cho Chủ thể đăng ký ở xã mình. Cán bộ Sở thấy Chủ thể có ít nhất một hồ sơ đã lên tỉnh.
- Mã số thuế hoặc số định danh của **Chủ thể** là duy nhất; trùng thì Chủ thể khôi phục qua Cán bộ xã, hệ thống không tiết lộ tài khoản cũ.
- **Chế độ chấm** do Sở đặt khi tạo đợt; Thư ký hội đồng đổi được cho đến khi đợt có phiếu chấm đầu tiên.
- Thành viên của **Hội đồng** và **Tổ tư vấn** là các **Phân vai** còn hiệu lực trên Phạm vi Hội đồng đó; không có danh sách thành viên nào khác. Cán bộ Sở ghi nhận Hội đồng (kèm quyết định thành lập và **Tổ trưởng**), Quản trị cấp Phân vai.
- **Phân công** chỉ có hiệu lực từ khi **Giao chấm**; Giao chấm cần **Tiếp nhận tại tỉnh**, đủ số người chấm tối thiểu, và ở chế độ dựa trên Tổ tư vấn có ít nhất một Thành viên Tổ tư vấn. Sau Giao chấm, Thư ký vẫn thay được một thành viên (có lý do) đến khi người đó xác nhận Phiếu chấm.
- Một Người dùng có thể vừa là Thành viên Tổ tư vấn vừa là Thành viên hội đồng của cùng Hội đồng, nhưng không được Phân công cả hai vai trên cùng một hồ sơ.
- Mỗi hồ sơ có một **Báo cáo Tổ tư vấn** chung; mọi Thành viên Tổ tư vấn được Phân công cùng soạn nháp, chỉ **Tổ trưởng** phát hành. Sửa sau phát hành là phát hành phiên bản tiếp theo, có lý do.
- Tổ tư vấn và Thành viên hội đồng đều chọn **Mức điểm**, không nhập điểm số tự do.
- Tổ tư vấn đề nghị Sở trả hồ sơ về xã khi đang thẩm định; hồ sơ lên tỉnh lại giữ Phân công và nháp Báo cáo Tổ tư vấn, nhưng phải Tiếp nhận tại tỉnh và Giao chấm lại. Từ Thành viên xem xét trở đi hồ sơ không trả về xã được.
- Phiếu chấm còn chưa xác nhận khi chốt điểm là **Vắng**.
- Thành viên hội đồng thấy Phiếu chấm của người khác và điểm tổng hợp chỉ khi đã xác nhận phiếu của mình và hồ sơ Sẵn sàng chốt; Chủ tịch và Thư ký trước đó chỉ thấy tiến độ. Tổ tư vấn thấy điểm tổng hợp sau khi chốt. Chủ thể, xã và Sở không bao giờ thấy Phiếu chấm của từng thành viên.
- **Hạng sao** tính từ điểm tổng hợp, hội đồng không sửa tay; muốn đổi hạng thì **Trả phiếu** để chấm lại trước khi chốt.
- Sao chép lại từ một phiên bản Báo cáo Tổ tư vấn mới cập nhật từng Tiêu chí mà thành viên chưa sửa; Tiêu chí đã sửa được giữ và báo lại, Phiếu chấm đã xác nhận được giữ toàn bộ.
- Chủ tịch hoặc Thư ký chốt điểm từng hồ sơ Sẵn sàng chốt, có **Xác thực lại**; Phiếu chấm chưa xác nhận lúc đó là **Vắng**.
- **Mở khóa sau chốt** đưa hồ sơ về Thành viên xác nhận và giữ kết quả cũ là bị thay thế; Quản trị không sửa điểm. Chỉ mở khóa được trước khi hồ sơ có kết quả công nhận hoặc không đạt.
- Mỗi **Đợt đánh giá** được Cán bộ Sở gán một **Hội đồng** trước khi Tiếp nhận tại tỉnh; đổi được đến lần Giao chấm đầu tiên của đợt.
- Chủ tịch và Thư ký thấy hồ sơ của các đợt gán cho Hội đồng mình từ khi Tiếp nhận tại tỉnh; Thành viên hội đồng và Thành viên Tổ tư vấn chỉ thấy hồ sơ mình có **Phân công** đã Giao chấm và chưa bị thay.
- Ở chế độ dựa trên Tổ tư vấn, thành viên chỉ chấm được sau lần sao chép đầu tiên từ **Báo cáo Tổ tư vấn** đã phát hành; Tổ tư vấn phát hành phiên bản mới được đến khi chốt điểm.
