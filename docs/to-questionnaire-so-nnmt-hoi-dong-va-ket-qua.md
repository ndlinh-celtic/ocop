# Câu hỏi cho Sở NN&MT: quy chế chấm điểm, công nhận kết quả và vận hành phần mềm OCOP

**Mục đích:** chốt các quy tắc nghiệp vụ mà phần mềm đang tạm làm theo giả định, trước khi xây phần cấp giấy chứng nhận, quyết định công nhận và hồ sơ đề nghị 5 sao.

**Từ:** Nhóm phát triển phần mềm OCOP (ndlinh), **Gửi:** Cán bộ phụ trách OCOP, Sở Nông nghiệp và Môi trường, **Câu trả lời được dùng để:** cấu hình lại phần mềm theo đúng quy chế của tỉnh và viết đặc tả cho giai đoạn tiếp theo. Câu trả lời nào làm thay đổi cách phần mềm đang chạy, nhóm sẽ báo lại trước khi sửa.

## Bối cảnh

Phần mềm đã chạy được từ lúc chủ thể nộp hồ sơ, qua UBND xã, Sở tiếp nhận, Tổ tư vấn thẩm định, thành viên hội đồng chấm, đến lúc Chủ tịch hoặc Thư ký chốt điểm. Ở một số chỗ, tài liệu yêu cầu chưa nói rõ hoặc tự mâu thuẫn. Nhóm đã chọn một cách làm tạm, ghi ở mục "Hiện phần mềm đang làm" dưới từng câu hỏi. Sở chỉ cần xác nhận cách đó đúng, hoặc cho biết tỉnh làm khác thế nào. Giai đoạn tiếp theo là cấp giấy chứng nhận, thư kết quả không đạt, quyết định công nhận và xuất gói hồ sơ đề nghị 5 sao gửi Bộ.

## Cách trả lời

Hạn trả lời: **đã trả lời ngày 24/10/2026** (bản trả lời của chủ đầu tư; chỗ ghi *cần kiểm tra* là điểm phải đối chiếu văn bản gốc trước khi áp dụng; chỗ ghi *khác với phần mềm hiện tại* là nơi phần mềm phải sửa). Mất khoảng 45 phút. Các câu được xếp theo mức quan trọng, câu quan trọng nhất ở đầu mỗi phần. Viết câu trả lời ngay dưới dấu `>`. Trả lời một phần, hoặc ghi "chưa rõ, cần hỏi …", cũng có ích: chỗ nào không chắc thì ghi chú lại thay vì bỏ trống. Nếu câu trả lời nằm trong một văn bản có sẵn (quy chế, quyết định, mẫu biểu), chỉ cần ghi tên văn bản và gửi kèm.

## 1. Quy chế hội đồng và chấm điểm

### Mỗi hồ sơ cần tối thiểu bao nhiêu thành viên hội đồng chấm thì mới được chốt điểm?

_Hiện phần mềm đang làm: Sở đặt con số này riêng cho từng đợt đánh giá._

> Tối thiểu **3 thành viên** chấm mỗi hồ sơ. Giữ cách Sở đặt con số này theo từng đợt, vì đợt ít hồ sơ có thể dùng hội đồng gọn hơn. Quy chế hội đồng của tỉnh quy định hội đồng họp hợp lệ khi có mặt ít nhất 2/3 thành viên; con số 3 là ngưỡng dưới để phần mềm chặn chốt, không thay cho điều kiện họp hợp lệ (ghi vào biên bản, không cần phần mềm kiểm).

### Điểm tổng hợp của hồ sơ được tính từ điểm các thành viên như thế nào?

_Hiện phần mềm đang làm: lấy trung bình cộng điểm của mọi thành viên đã xác nhận phiếu. Nếu tỉnh loại điểm cao nhất, thấp nhất, hay loại điểm lệch, xin nêu rõ cách loại._

> **Trung bình cộng** điểm tổng của các thành viên đã xác nhận phiếu, lấy 2 chữ số thập phân, không loại điểm cao nhất hay thấp nhất. Cách này đúng hướng dẫn chấm điểm OCOP hiện hành và dễ giải thích cho chủ thể. Phiếu "Vắng" không tính vào mẫu số.

### Điểm của các thành viên chênh nhau bao nhiêu thì cần đưa ra hội đồng thảo luận?

_Hiện phần mềm đang làm: gắn cờ "chênh lệch" khi vượt một ngưỡng Sở cấu hình theo đợt. Xin cho biết ngưỡng thường dùng, và ngưỡng tính trên tổng điểm hay trên từng tiêu chí._

> Tính trên **tổng điểm**: khi điểm cao nhất và thấp nhất chênh **từ 10 điểm** trở lên thì gắn cờ. Cờ chỉ để hội đồng thảo luận trong phiên họp và ghi vào biên bản, **không chặn** chốt điểm. Giữ ngưỡng là cấu hình theo đợt, mặc định 10.

### Trước khi chốt điểm, thành viên hội đồng có được xem điểm của các thành viên khác không?

_Vì sao hỏi: tài liệu yêu cầu ghi hai ý trái nhau, một chỗ là "họp xem điểm của nhau rồi chốt", chỗ khác là "chỉ xem sau khi chốt". Hiện phần mềm đang làm: một thành viên chỉ thấy phiếu của người khác và điểm tổng hợp sau khi đã xác nhận phiếu của mình và mọi phiếu cần thiết đã đủ._

> Giữ như phần mềm đang làm: một thành viên chỉ thấy phiếu của người khác và điểm tổng hợp sau khi đã xác nhận phiếu của mình và hồ sơ đã đủ phiếu. Lý do: tránh người chấm sau nhìn điểm người trước, vẫn thảo luận được tại phiên họp vì lúc đó mọi phiếu đã xác nhận. Việc chốt vẫn do Chủ tịch hoặc Thư ký bấm sau khi họp.

### Thành viên chưa xác nhận phiếu của mình được thấy những gì?

_Hiện phần mềm đang làm: chỉ thấy phiếu của chính mình, không thấy điểm của người khác hay điểm tổng hợp._

> Chỉ thấy phiếu của chính mình, cộng thêm **Điểm đề xuất của Tổ tư vấn** trên từng tiêu chí (vì đó là căn cứ để điều chỉnh). Không thấy điểm người khác và điểm tổng hợp. Đúng như hiện tại.

### Trước khi chốt, Chủ tịch và Thư ký hội đồng được thấy điểm từng thành viên hay chỉ thấy tiến độ ai đã chấm xong?

_Hiện phần mềm đang làm: chỉ thấy tiến độ, cho đến khi hồ sơ đủ phiếu xác nhận._

> **Cho Chủ tịch và Thư ký thấy điểm của từng phiếu ngay khi phiếu đó được xác nhận**, không chờ đủ phiếu; phiếu còn nháp thì chỉ thấy tiến độ. Thư ký cần số liệu sớm để chuẩn bị bảng tổng hợp và nhắc người chưa chấm. Hai người này không chấm nên không có chuyện bị ảnh hưởng. *(Khác với phần mềm hiện tại: cần sửa.)*

### Khi so một tiêu chí có điều kiện "Sao tối thiểu", phần mềm nên lấy điểm nào của tiêu chí đó?

_Vì sao hỏi: một số tiêu chí đặt điều kiện "muốn đạt N sao thì tiêu chí này phải đạt mức X". Hiện phần mềm đang làm: lấy điểm trung bình các thành viên của tiêu chí đó, rồi so với mức X._

> Lấy **điểm trung bình các thành viên của tiêu chí đó** rồi so với mức tối thiểu, như hiện tại. Nếu không đạt thì hạ hạng sao, hệ thống ghi rõ tiêu chí nào kéo hạng xuống trong bảng tổng hợp để hội đồng và chủ thể cùng thấy.

### Báo cáo của Tổ tư vấn có bắt buộc phải có trước khi hội đồng họp chốt điểm không?

_Vì sao hỏi: nếu bắt buộc thì cách chấm trực tiếp (không qua Tổ tư vấn) có thể không còn dùng được. Hiện phần mềm cho Sở chọn một trong hai cách chấm cho từng đợt._

> **Không bắt buộc.** Tỉnh giữ cả hai cách chấm, chọn theo từng đợt. Khi đợt chọn cách có Tổ tư vấn thì phải có báo cáo đã phát hành trước khi thành viên chấm (phần mềm đã làm). Khi đợt chọn chấm trực tiếp thì hội đồng tự thẩm định, biên bản ghi rõ.

### Khi có thành viên vắng mặt, hội đồng cần thỏa điều kiện gì thì vẫn chốt điểm hợp lệ?

> Hồ sơ chốt hợp lệ khi số phiếu đã xác nhận **đạt số người chấm tối thiểu của đợt**. Thành viên vắng được Thư ký đánh "Vắng" và tên họ ghi vào biên bản với lý do. Không thêm điều kiện khác để tránh kẹt phiên họp.

### Tổ tư vấn được xem điểm tổng hợp của hội đồng từ lúc nào?

_Hiện phần mềm đang làm: chỉ sau khi chốt điểm._

> **Sau khi chốt điểm**, như hiện tại. Trước đó Tổ tư vấn chỉ cần biết hồ sơ đang ở bước nào.

## 2. Quyết định công nhận và hồ sơ đề nghị 5 sao

### Hồ sơ đạt 5 sao có nằm trong dự thảo quyết định công nhận cấp tỉnh không?

_Vì sao hỏi: theo tài liệu, quyết định của tỉnh chia hồ sơ thành 3 sao, 4 sao và đề nghị 5 sao, nhưng hồ sơ 5 sao là do Bộ công nhận. Hiện phần mềm đang làm: dự thảo quyết định của tỉnh liệt kê cả hồ sơ đề nghị 5 sao, thành một nhóm riêng._

> **Có, nhưng ở một mục riêng.** Quyết định của UBND tỉnh gồm: (1) công nhận 3 sao, (2) công nhận 4 sao, (3) danh sách sản phẩm **đạt điểm đề nghị Trung ương đánh giá, phân hạng 5 sao**. Mục (3) không phải công nhận, chỉ phê duyệt kết quả đánh giá của tỉnh, và chính văn bản này là một thành phần bắt buộc trong gói hồ sơ gửi Bộ. Giữ như phần mềm đang làm; chỉ cần tên mục trong mẫu Word ghi đúng chữ "đề nghị".

### Hồ sơ vào danh sách "đề nghị 5 sao" theo tiêu chí nào?

_Vì sao hỏi: tài liệu ghi "từ 90 điểm", nhưng một hồ sơ 92 điểm có thể chỉ được 4 sao vì không đạt mức tối thiểu của một tiêu chí. Hiện phần mềm đang làm: chỉ đưa vào hồ sơ có hạng sao là 5, tức đủ 90 điểm và đạt mọi điều kiện Sao tối thiểu._

> Theo **hạng sao** đã tính (đủ 90 điểm **và** đạt mọi điều kiện Sao tối thiểu), như phần mềm đang làm. Hồ sơ 92 điểm nhưng chỉ đạt 4 sao thì công nhận 4 sao, không đề nghị 5 sao.

### Xin Sở gửi mẫu giấy chứng nhận sản phẩm OCOP 3 sao, 4 sao mà tỉnh đang dùng.

_Vì sao hỏi: phần mềm sẽ in giấy chứng nhận từ mẫu này. Các mẫu văn bản họp hiện có trong phần mềm (biên bản, bảng tổng hợp điểm, dự thảo quyết định) đều là mẫu tạm._

> Tỉnh dùng mẫu giấy chứng nhận theo phụ lục của quyết định ban hành bộ tiêu chí (hiện là QĐ 26/2026/QĐ-TTg; đợt trước là QĐ 148/2023/QĐ-TTg). Sở sẽ gửi file Word của mẫu đã dùng đợt gần nhất. Yêu cầu: phần mềm cho Sở **tải mẫu Word lên và sửa được** trong phần quản trị, không phải nhờ lập trình mỗi khi đổi mẫu. *(Cần kiểm tra: mẫu kèm QĐ 26/2026 có khác QĐ 148 không.)*

### Xin Sở gửi mẫu quyết định công nhận kết quả, biên bản họp hội đồng và bảng tổng hợp điểm mà tỉnh đang dùng.

> Sở sẽ gửi kèm quyết định, biên bản và bảng tổng hợp điểm của đợt gần nhất. Tạm thời dùng mẫu phần mềm đề xuất; cùng yêu cầu như trên: mẫu là file Word tải lên được, có ô trống để Thư ký điền tay phần diễn giải.

### Số hiệu giấy chứng nhận được đánh theo quy tắc nào?

_Ví dụ: "số thứ tự/năm/OCOP-tên tỉnh viết tắt", đánh lại từ 1 mỗi năm hay đánh liên tục qua các năm._

> Dạng **số thứ tự/năm/GCN-OCOP**, ví dụ `012/2026/GCN-OCOP`, số thứ tự 3 chữ số, **đánh lại từ 1 mỗi năm**, không trùng trong năm. Phần đuôi là cấu hình. Số quyết định (…/QĐ-UBND) do Văn phòng UBND cấp ngoài phần mềm; Sở nhập tay khi tải bản ký lên.

### Giấy chứng nhận có hiệu lực bao lâu, tính từ ngày nào?

> **36 tháng** kể từ ngày ký quyết định công nhận (theo quy định hiện hành về đánh giá, phân hạng OCOP). Phần mềm tự tính ngày hết hiệu lực và nhắc Sở, chủ thể trước 6 tháng. *(Cần kiểm tra: QĐ 26/2026 có đổi thời hạn không.)*

### Ai ký giấy chứng nhận và quyết định công nhận, và ký ở đâu?

_Hiện phần mềm đang làm: văn bản được ký số ngoài phần mềm, rồi Sở tải bản đã ký lên thay cho bản nháp._

> **Chủ tịch UBND tỉnh** (hoặc Phó Chủ tịch được ủy quyền) ký quyết định công nhận và giấy chứng nhận. Ký số trên hệ thống quản lý văn bản của tỉnh, ngoài phần mềm. Sở tải bản PDF đã ký lên thay bản nháp, như hiện tại. Không tích hợp ký số đợt này.

### Thư báo kết quả "không đạt" gửi chủ thể cần có những nội dung gì?

_Hiện dự kiến gồm: điểm theo từng phần A, B, C, nhận xét của hội đồng và các tiêu chí cần cải thiện. Nếu tỉnh có mẫu thư thì xin gửi kèm._

> Gồm: điểm tổng hợp, điểm theo phần A, B, C, hạng (hoặc "không đạt"), nhận xét chung của hội đồng, các tiêu chí dưới mức và lời khuyên cải thiện, và câu hướng dẫn nộp lại ở đợt sau. Tỉnh **không có mẫu**, dùng mẫu phần mềm đề xuất. Thư do Sở phát hành trong phần mềm và gửi email, **không cần ký số**; bản có dấu nếu chủ thể yêu cầu thì Sở in và đóng dấu ngoài.

### Chủ thể được xem những gì về kết quả của mình?

_Hiện phần mềm đang làm: chủ thể chỉ thấy điểm tổng hợp, điểm theo phần A, B, C, hạng sao và nhận xét công khai, không bao giờ thấy điểm của từng thành viên._

> Như hiện tại: điểm tổng hợp, điểm theo phần A, B, C, hạng sao, nhận xét chung của hội đồng, lịch sử trạng thái. **Không bao giờ** thấy điểm hay tên từng thành viên, và không thấy báo cáo Tổ tư vấn.

### Gói hồ sơ đề nghị 5 sao gửi Bộ gồm những văn bản nào, và gửi theo kênh nào?

_Hiện dự kiến gồm: hồ sơ sản phẩm, minh chứng, báo cáo Tổ tư vấn, báo cáo của hội đồng, quyết định của Chủ tịch UBND tỉnh, bảng điểm và dự thảo văn bản đề nghị của UBND tỉnh. Sản phẩm mẫu và văn bản kiểm nghiệm bổ sung do tỉnh tự gửi ngoài phần mềm._

> Gồm đúng các thành phần dự kiến, xuất **một tệp ZIP có kèm mục lục PDF** liệt kê từng tệp. Gửi qua hệ thống quản lý văn bản điện tử liên thông của tỉnh (hoặc bưu điện với sản phẩm mẫu). Phần mềm chỉ cần ghi **số công văn và ngày gửi**, không cần tích hợp gì thêm.

### Khi Bộ trả hồ sơ 5 sao về, hoặc chấm khác điểm của tỉnh, tỉnh xử lý thế nào?

> Bộ không công nhận 5 sao hoặc trả về → Sở chọn **"Chuyển về công nhận cấp tỉnh"**, hồ sơ được công nhận **4 sao theo kết quả tỉnh** (điểm của tỉnh đã đủ 4 sao), đưa vào quyết định kế tiếp. Bộ có kết quả khác hẳn (không đạt cả 4 sao) thì **đóng hồ sơ**, đính kèm văn bản của Bộ, chủ thể nộp lại đợt sau. Không nhập điểm chi tiết của Bộ vào phần mềm.

### Sau khi Bộ có kết quả 5 sao, ai thông báo cho chủ thể, và có cần ghi kết quả đó vào phần mềm không?

> Sở thông báo. Khi Sở **đóng hồ sơ** với kết quả "Bộ công nhận 5 sao", phần mềm cho nhập **số, ngày quyết định của Bộ** và đính kèm file, rồi **tự gửi thông báo** cho chủ thể. Không cần quản lý thêm gì về giấy chứng nhận do Bộ cấp.

## 3. Trả hồ sơ và quyền xem trong lúc chấm

### Sở có được trả hồ sơ về xã sau khi Tổ tư vấn đã phát hành báo cáo nhưng thành viên chưa bắt đầu chấm không?

_Hiện phần mềm đang làm: Sở chỉ trả về được khi Tổ tư vấn đang thẩm định; sau khi báo cáo phát hành thì không trả về được nữa._

> **Cho phép trả về cho đến trước lúc sao chép dữ liệu Tổ tư vấn sang phiếu thành viên.** Lúc này chưa ai chấm, trả về không làm mất công ai; báo cáo Tổ tư vấn đã phát hành vẫn giữ (phiên bản bất biến), khi hồ sơ quay lại Tổ tư vấn phát hành phiên bản mới nếu cần. *(Khác với phần mềm hiện tại: cần sửa.)*

### Khi Sở trả hồ sơ về xã để bổ sung, các thành viên đã được phân công có còn được xem hồ sơ đó không?

_Hiện phần mềm đang làm: vẫn xem được, và phân công vẫn giữ nguyên khi hồ sơ quay lại. Thư ký có thể thay hoặc bổ sung thành viên trước khi giao chấm lại._

> Giữ như hiện tại: vẫn xem được, phân công giữ nguyên khi hồ sơ quay lại, Thư ký thay hoặc bổ sung được trước khi giao chấm lại. Đỡ phải phân công lại từ đầu.

### Thành viên hội đồng có được xem thông tin của chủ thể (tên, địa chỉ, người đại diện, giấy tờ pháp lý) khi chấm không?

_Hiện phần mềm đang làm: có, và mỗi lần xem được ghi lại trong nhật ký truy cập dữ liệu cá nhân theo Nghị định 13/2023._

> **Có.** Thành viên cần biết chủ thể là ai để thẩm định (tiêu chí về tổ chức sản xuất, liên kết, pháp lý). Giữ ghi nhật ký truy cập như hiện tại là đủ để đúng Nghị định 13/2023. Không hiện số CMND/CCCD của người đại diện cho thành viên, chỉ Sở và xã thấy.

## 4. Thông tin in trên văn bản

### Tên đầy đủ của tỉnh, UBND tỉnh và Sở in trên văn bản là gì?

_Vì sao hỏi: hiện tên tỉnh trong dự thảo quyết định còn để trống._

> Để trong **cấu hình "Thông tin cơ quan"** ở phần quản trị: tên tỉnh, UBND tỉnh, Sở, địa chỉ, chức danh và tên người ký. Sở điền khi cài đặt, không ghi cứng trong phần mềm, vì có thể đổi tên sau sáp nhập hoặc thay lãnh đạo. Sở sẽ gửi tên chính thức cùng đợt gửi mẫu văn bản.

### Trang bìa tài liệu đặc tả yêu cầu cần ghi tên ai ở các ô "UBND tỉnh", "Đơn vị soạn thảo" và "Người duyệt"?

> UBND tỉnh: tên tỉnh theo cấu hình trên. Đơn vị soạn thảo: **Sở Nông nghiệp và Môi trường (Chi cục Phát triển nông thôn)** phối hợp đơn vị phát triển. Người duyệt: **Lãnh đạo Sở phụ trách Chương trình OCOP**. Tên cụ thể Sở sẽ cung cấp.

### Mã hồ sơ dạng "HS-2026-0001" (năm, rồi số thứ tự đánh lại mỗi năm) có phù hợp không?

_Mã này hiện trên mọi màn hình và văn bản. Nếu tỉnh đã có cách đánh mã riêng, xin cho biết._

> **Phù hợp.** Đơn giản, đọc được qua điện thoại. Không cần thêm mã tỉnh vì phần mềm chỉ dùng cho một tỉnh.

## 5. Vận hành và pháp lý

### Tên miền chính thức của phần mềm là gì?

_Vì sao hỏi: tên miền sẽ được in vào mã QR trên giấy chứng nhận, nên in rồi thì không đổi được._

> Tên miền con của cổng thông tin tỉnh, dạng **`ocop.<tên-tỉnh>.gov.vn`**. Sở sẽ đăng ký với Trung tâm Công nghệ thông tin của tỉnh và báo lại **trước đợt cấp giấy chứng nhận đầu tiên**. Trong lúc chờ, phần mềm chạy tên miền tạm nhưng **không in QR**.

### Hệ thống cần đạt cấp độ an toàn thông tin nào (cấp 2 hay cấp 3)?

> **Cấp độ 2.** Hệ thống phục vụ hoạt động nội bộ của ngành, không phải dịch vụ công trực tuyến diện rộng, dữ liệu cá nhân ở mức cơ bản. Sở sẽ lập hồ sơ đề xuất cấp độ trình phê duyệt theo Nghị định 85/2016/NĐ-CP. *(Cần kiểm tra với Sở Khoa học và Công nghệ, đơn vị thẩm định cấp độ.)*

### Hồ sơ, minh chứng và nhật ký hệ thống phải lưu trữ trong bao lâu?

> Hồ sơ, minh chứng, kết quả chấm và văn bản đã ký: lưu **suốt thời gian hệ thống hoạt động, tối thiểu 10 năm** sau khi giấy chứng nhận hết hiệu lực, không xóa. Nhật ký hệ thống và nhật ký truy cập: **tối thiểu 2 năm** theo yêu cầu an toàn thông tin cấp 2, tỉnh mong giữ 5 năm nếu chi phí chấp nhận được. *(Cần kiểm tra quy định lưu trữ hồ sơ chuyên ngành.)*

### Email thông báo sẽ gửi qua máy chủ thư của cơ quan, hay qua một dịch vụ thư trong nước do nhóm chọn?

> Ưu tiên **máy chủ thư của tỉnh** (địa chỉ `@<tên-tỉnh>.gov.vn`) để chủ thể tin là thư cơ quan; Sở sẽ xin một tài khoản gửi tự động. Nếu tỉnh không cấp được trong vòng một tháng thì dùng dịch vụ thư trong nước, gửi từ tên miền `ocop.<tên-tỉnh>.gov.vn`.

### Tỉnh đã chọn, hoặc ưu tiên, nhà cung cấp cloud nào (VNG/GreenNode, FPT, Viettel hay đơn vị khác)?

> **Chưa chọn.** Tỉnh không có ràng buộc nhà cung cấp; ưu tiên đơn vị có trung tâm dữ liệu trong nước, có dịch vụ PostgreSQL quản lý và hỗ trợ bằng tiếng Việt. Nhóm phát triển đề xuất 2 phương án kèm chi phí năm; Sở chọn theo thủ tục mua sắm.

### Có yêu cầu nào về hạ tầng hay hợp đồng với nhà cung cấp cloud mà nhóm cần biết trước không?

_Ví dụ: phải đặt tại trung tâm dữ liệu của tỉnh, phải có chứng nhận cụ thể, hay phải qua thủ tục thẩm định._

> Dữ liệu và bản sao lưu **nằm trong lãnh thổ Việt Nam**; nhà cung cấp có chứng nhận an toàn thông tin (ISO 27001 hoặc tương đương); hợp đồng có cam kết thời gian hoạt động và sao lưu hằng ngày; cho phép xuất toàn bộ dữ liệu khi chuyển nhà cung cấp. Không bắt buộc đặt tại trung tâm dữ liệu của tỉnh. Kết nối với trục liên thông của tỉnh (LGSP) **không yêu cầu** ở giai đoạn này.

## Còn gì khác không?

Còn điều gì về quy chế, mẫu biểu hay cách tỉnh đang làm mà nhóm chưa hỏi nhưng nên biết không?

> Ba điểm: (1) danh mục xã/phường phải cập nhật được theo quyết định sắp xếp đơn vị hành chính, hồ sơ cũ giữ tên xã lúc nộp; (2) chủ thể hết hạn 36 tháng muốn **đánh giá lại** thì nộp hồ sơ mới nhưng phần mềm nên cho **sao chép hồ sơ cũ** để không nhập lại; (3) sau này có thể cần kết xuất danh sách sản phẩm đạt sao để đăng cổng thông tin tỉnh, định dạng Excel là đủ.
