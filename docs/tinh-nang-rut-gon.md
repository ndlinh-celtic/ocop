# Danh sách tính năng rút gọn (OCOP, một tỉnh)

> Sinh tự động từ `yeu-cau/OCOP_tinh_nang_rut_gon.xlsx`. File Excel là bản gốc; sửa ở Excel rồi sinh lại file này.

## Tóm tắt

Danh sách tính năng rút gọn: triển khai cho một tỉnh

Bản rút gọn từ danh sách 105 chức năng. Triển khai trên cloud trong nước (VNG/GreenNode, FPT, Viettel).


Số lượng tính năng theo đối tượng

| Đối tượng | Tổng | Giữ nguyên | Rút gọn | Đợt 1 | Đợt 2 | Kiểm tra |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Chủ thể OCOP | 11 | 9 | 2 | 10 | 1 |
| 2. UBND xã/phường | 7 | 7 | 0 | 7 | 0 |
| 3. Sở NN&MT | 4 | 2 | 2 | 3 | 1 |
| 4. Hội đồng đánh giá cấp tỉnh | 11 | 9 | 2 | 10 | 1 |
| 5. Tổ tư vấn | 8 | 8 | 0 | 8 | 0 |
| 6. Thành viên hội đồng | 8 | 8 | 0 | 8 | 0 |
| 7. Quản trị hệ thống | 9 | 7 | 2 | 9 | 0 |
| 8. Cổng công khai (xác thực QR) | 1 | 0 | 1 | 0 | 1 |
| 9. Dùng chung | 6 | 5 | 1 | 6 | 0 |
| Tổng cộng | 65 | 55 | 10 | 61 | 4 | OK |

Tính năng hoãn, làm ngoài hệ thống, gộp hoặc ngoài phạm vi

| Hoãn | 16 |
| --- | --- |
| Làm ngoài hệ thống | 10 |
| Gộp vào chức năng khác | 5 |
| Ngoài phạm vi (Bộ không dùng hệ thống) | 10 |
| Tổng số mã bị hoãn hoặc cắt | 41 |
| Mã gốc được giữ (không tính DC-09 một phần) | 64 |
| Tổng mã gốc (kiểm tra bằng 105) | 105 | OK |

Chú giải

| Giữ nguyên | Giữ đúng như danh sách 105 chức năng |
| --- | --- |
| Rút gọn | Giữ nhưng bớt phạm vi, xem cột Ghi chú |
| Đợt 1 | Luồng lõi, làm trước |
| Đợt 2 | QR và thống kê, có thể làm sau lõi (đề xuất) |

Cột Trạng thái ở sheet Tính năng rút gọn dùng menu thả xuống để theo dõi tiến độ; thêm dòng mới trong vùng A2:I300 thì bảng đếm tự cập nhật.


## Tính năng rút gọn

| Mã gốc | Đối tượng | Nhóm chức năng | Tính năng (bản rút gọn) | Mức giữ | Đợt triển khai | Luồng xử lý | Ghi chú | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CT-01 | 1. Chủ thể OCOP | Tài khoản & hồ sơ | Đăng ký tài khoản, đăng nhập an toàn | Giữ nguyên | Đợt 1 | L01 |  | Chưa làm |
| CT-02 | 1. Chủ thể OCOP | Tài khoản & hồ sơ | Quản lý hồ sơ pháp lý (GPKD, VSATTP, công bố chất lượng...) | Giữ nguyên | Đợt 1 | L01 |  | Chưa làm |
| CT-03 | 1. Chủ thể OCOP | Tài khoản & hồ sơ | Tạo/sửa hồ sơ sản phẩm theo 6 nhóm OCOP, lưu nháp rồi gửi | Giữ nguyên | Đợt 1 | L02 |  | Chưa làm |
| CT-05 | 1. Chủ thể OCOP | Minh chứng & tự đánh giá | Upload minh chứng gắn theo từng tiêu chí trong bộ 100 điểm | Giữ nguyên | Đợt 1 | L02 |  | Chưa làm |
| CT-06 | 1. Chủ thể OCOP | Minh chứng & tự đánh giá | Tự chấm điểm thử, ước lượng số sao | Giữ nguyên | Đợt 1 | L02 |  | Chưa làm |
| CT-09 | 1. Chủ thể OCOP | Nộp hồ sơ & theo dõi | Nộp hồ sơ về UBND xã | Giữ nguyên | Đợt 1 | L03 |  | Chưa làm |
| CT-10 | 1. Chủ thể OCOP | Nộp hồ sơ & theo dõi | Theo dõi trạng thái hồ sơ (đã tiếp nhận / yêu cầu bổ sung / đã chuyển tỉnh...) | Giữ nguyên | Đợt 1 | L03 |  | Chưa làm |
| CT-11 | 1. Chủ thể OCOP | Nộp hồ sơ & theo dõi | Xem yêu cầu bổ sung và nộp lại hồ sơ | Giữ nguyên | Đợt 1 | L04 |  | Chưa làm |
| CT-12 | 1. Chủ thể OCOP | Nộp hồ sơ & theo dõi | Nhắc hạn nộp các đợt qua email và trong ứng dụng | Rút gọn | Đợt 1 | L03 | Không có SMS, Zalo | Chưa làm |
| CT-13 | 1. Chủ thể OCOP | Nộp hồ sơ & theo dõi | Nhận thông báo kết quả, xem nhận xét của hội đồng | Giữ nguyên | Đợt 1 | L16 |  | Chưa làm |
| CT-15 | 1. Chủ thể OCOP | Sau công nhận | Tải giấy chứng nhận PDF có mã QR | Rút gọn | Đợt 2 | L16 | Không có màn hình quản lý QR riêng | Chưa làm |
| XA-01 | 2. UBND xã/phường | Tiếp nhận | Danh sách hồ sơ của chủ thể trên địa bàn, ghi nhận ngày nhận | Giữ nguyên | Đợt 1 | L05 |  | Chưa làm |
| XA-02 | 2. UBND xã/phường | Tiếp nhận | Kiểm tra tính đầy đủ tài liệu và tính hợp lệ của chủ thể | Giữ nguyên | Đợt 1 | L05 |  | Chưa làm |
| XA-03 | 2. UBND xã/phường | Tiếp nhận | Phân công cán bộ xử lý hồ sơ | Giữ nguyên | Đợt 1 | L05 |  | Chưa làm |
| XA-04 | 2. UBND xã/phường | Đánh giá sơ bộ | Checklist sơ bộ: nguồn gốc nguyên liệu, lao động địa phương, bản sắc văn hóa - trí tuệ bản địa | Giữ nguyên | Đợt 1 | L06 |  | Chưa làm |
| XA-05 | 2. UBND xã/phường | Đánh giá sơ bộ | Yêu cầu chủ thể bổ sung hồ sơ | Giữ nguyên | Đợt 1 | L04 |  | Chưa làm |
| XA-07 | 2. UBND xã/phường | Gửi lên tỉnh | Lập biên bản, văn bản đề xuất gửi tỉnh, đính kèm toàn bộ tài liệu | Giữ nguyên | Đợt 1 | L06 |  | Chưa làm |
| XA-08 | 2. UBND xã/phường | Gửi lên tỉnh | Chọn đợt gửi và theo dõi sau khi gửi | Giữ nguyên | Đợt 1 | L06 |  | Chưa làm |
| SO-01 | 3. Sở NN&MT | Quản lý đợt | Mở/đóng đợt đánh giá, thiết lập hạn nộp | Giữ nguyên | Đợt 1 | L07 |  | Chưa làm |
| SO-02 | 3. Sở NN&MT | Quản lý hồ sơ | Danh sách hồ sơ từ các xã trong toàn tỉnh, lọc theo đợt/trạng thái | Giữ nguyên | Đợt 1 | L08 |  | Chưa làm |
| SO-04 | 3. Sở NN&MT | Chuyển Bộ | Công cụ xuất gói hồ sơ 5 sao (từ 90 điểm) để gửi đánh giá ngoài hệ thống; đánh dấu trạng thái sau khi gửi | Rút gọn | Đợt 1 | L17 | Bộ NN&MT không dùng hệ thống: gửi và nhận kết quả bằng văn bản. Gói gồm hồ sơ, báo cáo của Tổ tư vấn và của Hội đồng, quyết định của Chủ tịch UBND tỉnh. Hệ thống không nhập kết quả của Bộ | Chưa làm |
| SO-06 | 3. Sở NN&MT | Báo cáo | Bảng thống kê theo đợt, nhóm sản phẩm, đơn vị; xuất Excel | Rút gọn | Đợt 2 | L22 | Gộp SO-07; bộ lọc cơ bản | Chưa làm |
| HD-01 | 4. Hội đồng đánh giá cấp tỉnh | Thành lập hội đồng | Thành lập hội đồng, quản lý thành viên, chủ tịch/thư ký hội đồng | Giữ nguyên | Đợt 1 | L09 |  | Chưa làm |
| HD-02 | 4. Hội đồng đánh giá cấp tỉnh | Thành lập hội đồng | Phân công hồ sơ cho thành viên/chuyên gia | Giữ nguyên | Đợt 1 | L09 |  | Chưa làm |
| HD-03 | 4. Hội đồng đánh giá cấp tỉnh | Thành lập hội đồng | Phân công Tổ tư vấn phụ trách từng hồ sơ / từng đợt | Giữ nguyên | Đợt 1 | L09 |  | Chưa làm |
| HD-04 | 4. Hội đồng đánh giá cấp tỉnh | Chấm điểm | Chấm điểm trực tuyến theo bộ tiêu chí, tự cộng điểm, tính điểm trung bình | Giữ nguyên | Đợt 1 | L15 |  | Chưa làm |
| HD-05 | 4. Hội đồng đánh giá cấp tỉnh | Chấm điểm | Gợi ý phân hạng tự động theo điểm | Giữ nguyên | Đợt 1 | L15 |  | Chưa làm |
| HD-06 | 4. Hội đồng đánh giá cấp tỉnh | Chấm điểm | Chọn chế độ chấm cho đợt: trực tiếp hoặc dựa trên Tổ tư vấn | Rút gọn | Đợt 1 | L09 | Bỏ chế độ kết hợp | Chưa làm |
| HD-08 | 4. Hội đồng đánh giá cấp tỉnh | Chấm điểm | Khóa điểm bất biến sau khi chốt | Giữ nguyên | Đợt 1 | L15 |  | Chưa làm |
| HD-09 | 4. Hội đồng đánh giá cấp tỉnh | Họp & quyết định | Họp hội đồng: bảng tổng hợp điểm, biên bản, quyết định công nhận (sinh từ mẫu Word) | Rút gọn | Đợt 1 | L15 | Gộp TM-11 (tài liệu họp) | Chưa làm |
| HD-10 | 4. Hội đồng đánh giá cấp tỉnh | Họp & quyết định | Gửi kết quả cho sản phẩm không đạt kèm nhận xét | Giữ nguyên | Đợt 1 | L16 |  | Chưa làm |
| HD-11 | 4. Hội đồng đánh giá cấp tỉnh | Giấy chứng nhận | Cấp giấy chứng nhận 3-4 sao, xuất PDF, số hiệu, ngày cấp | Giữ nguyên | Đợt 1 | L16 |  | Chưa làm |
| HD-12 | 4. Hội đồng đánh giá cấp tỉnh | Giấy chứng nhận | Gắn mã QR vào giấy chứng nhận | Giữ nguyên | Đợt 2 | L16 | Làm sau lõi | Chưa làm |
| TM-01 | 5. Tổ tư vấn | Thẩm định hồ sơ | Danh sách hồ sơ được giao thẩm định theo đợt, theo hạn xử lý | Giữ nguyên | Đợt 1 | L10 |  | Chưa làm |
| TM-02 | 5. Tổ tư vấn | Thẩm định hồ sơ | Rà soát hồ sơ và minh chứng theo từng tiêu chí, đánh dấu thiếu hoặc không hợp lệ | Giữ nguyên | Đợt 1 | L10 |  | Chưa làm |
| TM-05 | 5. Tổ tư vấn | Điểm đề xuất | Chấm điểm đề xuất từng tiêu chí kèm căn cứ và minh chứng viện dẫn | Giữ nguyên | Đợt 1 | L10 |  | Chưa làm |
| TM-06 | 5. Tổ tư vấn | Điểm đề xuất | Soạn nhận xét, báo cáo thẩm định, các điểm cần hội đồng lưu ý | Giữ nguyên | Đợt 1 | L10 |  | Chưa làm |
| TM-07 | 5. Tổ tư vấn | Điểm đề xuất | Chốt và phát hành báo cáo Tổ tư vấn (khóa phiên bản) trước khi chia sẻ cho thành viên | Giữ nguyên | Đợt 1 | L11 |  | Chưa làm |
| TM-08 | 5. Tổ tư vấn | Sao chép dữ liệu cho thành viên | Sao chép dữ liệu của Tổ tư vấn (điểm đề xuất, nhận xét, căn cứ) vào phiếu chấm của thành viên hội đồng, chọn toàn bộ hoặc theo từng tiêu chí | Giữ nguyên | Đợt 1 | L12 |  | Chưa làm |
| TM-09 | 5. Tổ tư vấn | Sao chép dữ liệu cho thành viên | Sao chép hàng loạt cho nhiều thành viên và nhiều hồ sơ cùng lúc | Giữ nguyên | Đợt 1 | L12 |  | Chưa làm |
| TM-12 | 5. Tổ tư vấn | Phân quyền | Quyền giới hạn: Tổ tư vấn không có quyền chốt điểm chính thức hay quyết định công nhận | Giữ nguyên | Đợt 1 | L11 | Chính sách phân quyền có test | Chưa làm |
| TV-01 | 6. Thành viên hội đồng | Phân công | Chỉ xem danh sách sản phẩm được phân công | Giữ nguyên | Đợt 1 | L13 |  | Chưa làm |
| TV-02 | 6. Thành viên hội đồng | Dựa trên Tổ tư vấn | Xem bản thẩm định / Tổ tư vấn của Tổ tư vấn cho từng hồ sơ | Giữ nguyên | Đợt 1 | L13 |  | Chưa làm |
| TV-03 | 6. Thành viên hội đồng | Dựa trên Tổ tư vấn | Nhận dữ liệu do Tổ tư vấn sao chép vào phiếu chấm (điểm đề xuất, nhận xét, căn cứ) | Giữ nguyên | Đợt 1 | L13 |  | Chưa làm |
| TV-04 | 6. Thành viên hội đồng | Dựa trên Tổ tư vấn | Điều chỉnh điểm và nhận xét đã sao chép; bắt buộc ghi lý do khi khác điểm của Tổ tư vấn | Giữ nguyên | Đợt 1 | L13 |  | Chưa làm |
| TV-05 | 6. Thành viên hội đồng | Dựa trên Tổ tư vấn | Xác nhận phiếu chấm cuối cùng (xác nhận trực tuyến, có thể kèm ký số) | Giữ nguyên | Đợt 1 | L13 |  | Chưa làm |
| TV-06 | 6. Thành viên hội đồng | Chấm điểm | Chế độ chấm trực tiếp: chấm độc lập từng tiêu chí, ẩn điểm của người khác đến khi chốt | Giữ nguyên | Đợt 1 | L14 |  | Chưa làm |
| TV-07 | 6. Thành viên hội đồng | Chấm điểm | Ghi nhận xét, upload bằng chứng kiểm tra | Giữ nguyên | Đợt 1 | L14 |  | Chưa làm |
| TV-08 | 6. Thành viên hội đồng | Chấm điểm | Xem điểm tổng hợp sau khi chốt để họp thống nhất | Giữ nguyên | Đợt 1 | L15 | Chỉ xem sau khi hội đồng chốt | Chưa làm |
| AD-01 | 7. Quản trị hệ thống | Người dùng & quyền | Phân quyền theo vai trò (RBAC), quản lý tài khoản các cấp | Giữ nguyên | Đợt 1 | L20 |  | Chưa làm |
| AD-02 | 7. Quản trị hệ thống | Người dùng & quyền | Cấu hình vai trò Tổ tư vấn, quyền sao chép dữ liệu và quy tắc không ghi đè | Giữ nguyên | Đợt 1 | L20 |  | Chưa làm |
| AD-03 | 7. Quản trị hệ thống | Tiêu chí & thang điểm | Cấu hình bộ tiêu chí và thang điểm linh hoạt, không hard-code | Giữ nguyên | Đợt 1 | L19 |  | Chưa làm |
| AD-04 | 7. Quản trị hệ thống | Tiêu chí & thang điểm | Phiên bản hóa bộ tiêu chí, lưu snapshot điểm theo phiên bản tại thời điểm chấm | Giữ nguyên | Đợt 1 | L19 |  | Chưa làm |
| AD-05 | 7. Quản trị hệ thống | Tiêu chí & thang điểm | Bộ tiêu chí riêng theo nhóm sản phẩm (ví dụ du lịch cộng đồng) | Giữ nguyên | Đợt 1 | L19 |  | Chưa làm |
| AD-06 | 7. Quản trị hệ thống | Danh mục | Quản lý danh mục: nhóm sản phẩm, xã/phường của tỉnh, đợt đánh giá | Rút gọn | Đợt 1 | L07 | Chỉ một tỉnh, không cần đơn vị hành chính hai cấp. Nhóm sản phẩm nằm trong Phiên bản tiêu chí (ADR 0006), không là danh mục quản trị | Chưa làm |
| AD-08 | 7. Quản trị hệ thống | Bảo mật & vận hành | Nhật ký hoạt động (audit log), sao lưu định kỳ | Giữ nguyên | Đợt 1 | L21 |  | Chưa làm |
| AD-09 | 7. Quản trị hệ thống | Bảo mật & vận hành | Audit riêng cho thao tác sao chép dữ liệu của Tổ tư vấn (ai, từ phiên bản nào, cho ai, lúc nào); lưu điểm gốc của Tổ tư vấn bên cạnh điểm thành viên xác nhận | Giữ nguyên | Đợt 1 | L21 |  | Chưa làm |
| DC-09 | 7. Quản trị hệ thống | Tích hợp & bảo mật | Xác thực hai lớp (TOTP) cho hội đồng và quản trị | Rút gọn | Đợt 1 | L20 | Bỏ phần VNeID/SSO | Chưa làm |
| CK-02 | 8. Cổng công khai (xác thực QR) | Tra cứu | Trang xác thực mã QR giấy chứng nhận | Rút gọn | Đợt 2 | L18 | Không có tra cứu danh sách; làm sau lõi | Chưa làm |
| DC-01 | 9. Dùng chung | Thông báo | Thông báo email và trong ứng dụng | Rút gọn | Đợt 1 | L23 | SMS tùy chọn qua adapter, làm sau | Chưa làm |
| DC-03 | 9. Dùng chung | Dữ liệu & tệp | Quản lý file đính kèm | Giữ nguyên | Đợt 1 | L24 |  | Chưa làm |
| DC-04 | 9. Dùng chung | Dữ liệu & tệp | Tìm kiếm và lọc hồ sơ, sản phẩm | Giữ nguyên | Đợt 1 | L24 |  | Chưa làm |
| DC-05 | 9. Dùng chung | Dữ liệu & tệp | Xuất báo cáo Excel / PDF | Giữ nguyên | Đợt 1 | L22 |  | Chưa làm |
| DC-07 | 9. Dùng chung | Giao diện | Giao diện responsive trên di động | Giữ nguyên | Đợt 1 | L25 |  | Chưa làm |
| DC-10 | 9. Dùng chung | Tích hợp & bảo mật | Tuân thủ bảo vệ dữ liệu cá nhân (NĐ 13/2023) và phân loại cấp độ an toàn thông tin | Giữ nguyên | Đợt 1 | L25 |  | Chưa làm |

## Hoãn hoặc cắt

| Mã gốc | Đối tượng gốc | Tính năng gốc | Hướng xử lý | Thay thế / ghi chú |
| --- | --- | --- | --- | --- |
| CT-04 | 1. Chủ thể OCOP (DN, HTX, hộ sản xuất) | Tạo câu chuyện sản phẩm (bản sắc, nguồn gốc, truyền thống) | Hoãn | Chủ thể mô tả bản sắc, nguồn gốc ngay trong trường văn bản của hồ sơ sản phẩm |
| CT-07 | 1. Chủ thể OCOP (DN, HTX, hộ sản xuất) | Hướng dẫn chi tiết từng tiêu chí và gợi ý nâng điểm | Hoãn | Hiển thị mô tả từng tiêu chí ngay trong form; chưa có gợi ý nâng điểm tự động |
| CT-08 | 1. Chủ thể OCOP (DN, HTX, hộ sản xuất) | Cảnh báo minh chứng sắp hết hạn (GPKD, giấy VSATTP, kết quả kiểm nghiệm) | Hoãn | Vẫn lưu ngày hiệu lực của giấy tờ để bổ sung cảnh báo sau |
| CT-14 | 1. Chủ thể OCOP (DN, HTX, hộ sản xuất) | Đăng ký đánh giá lại / nâng hạng (ví dụ 3 sao lên 4 sao) | Hoãn | Chủ thể tạo hồ sơ mới ở đợt kế tiếp |
| CT-16 | 1. Chủ thể OCOP (DN, HTX, hộ sản xuất) | Khiếu nại / phản hồi kết quả đánh giá | Làm ngoài hệ thống | Khiếu nại bằng văn bản; kết luận ghi vào tệp đính kèm của hồ sơ |
| CT-17 | 1. Chủ thể OCOP (DN, HTX, hộ sản xuất) | FAQ, video hướng dẫn, mẫu hồ sơ, ví dụ hồ sơ thành công | Làm ngoài hệ thống | Trang hướng dẫn tĩnh hoặc tài liệu PDF |
| XA-06 | 2. UBND xã/phường | Kiểm tra thực địa trên mobile: ảnh có geotag, chạy được khi mạng yếu | Làm ngoài hệ thống | Biên bản thực địa và ảnh đính kèm như tệp thường |
| XA-09 | 2. UBND xã/phường | Thống kê số hồ sơ đã xử lý, đạt/không đạt sơ bộ trong đợt | Gộp vào chức năng khác | Dùng bộ lọc danh sách và xuất Excel (DC-04, DC-05) |
| SO-03 | 3. Sở NN&MT (thường trực cấp tỉnh) | Mã tracking riêng cho từng hồ sơ | Gộp vào chức năng khác | Mã hồ sơ do hệ thống sinh sẵn dùng làm mã theo dõi |
| SO-05 | 3. Sở NN&MT (thường trực cấp tỉnh) | Thu hồi / gia hạn giấy chứng nhận khi không duy trì tiêu chuẩn | Hoãn | Chờ văn bản quy định điều kiện thu hồi; dữ liệu giấy chứng nhận có sẵn trường trạng thái |
| SO-07 | 3. Sở NN&MT (thường trực cấp tỉnh) | Thống kê phân bố theo địa phương, nhóm sản phẩm | Gộp vào chức năng khác | Gộp vào bảng thống kê SO-06 |
| HD-07 | 4. Hội đồng đánh giá cấp tỉnh | Đối chiếu điểm của Tổ tư vấn với điểm thành viên xác nhận, báo cáo chênh lệch | Hoãn | Dữ liệu đối chiếu (điểm gốc của Tổ tư vấn) vẫn được lưu để làm báo cáo sau |
| HD-13 | 4. Hội đồng đánh giá cấp tỉnh | Lưu trữ điện tử và theo dõi hạn hiệu lực giấy chứng nhận | Hoãn | Giấy chứng nhận đã lưu PDF; hạn hiệu lực bổ sung sau |
| HD-14 | 4. Hội đồng đánh giá cấp tỉnh | Báo cáo kết quả đợt chấm, phân tích xu hướng sản phẩm mạnh/yếu | Hoãn | Cần dữ liệu nhiều đợt |
| TM-03 | 5. Tổ tư vấn Hội đồng đánh giá | Yêu cầu xã/chủ thể bổ sung trong quá trình thẩm định | Làm ngoài hệ thống | Tổ tư vấn đề nghị Sở trả hồ sơ về xã; Sở thực hiện qua luồng bổ sung |
| TM-04 | 5. Tổ tư vấn Hội đồng đánh giá | Ghi nhận kiểm tra thực địa: biên bản, ảnh geotag | Làm ngoài hệ thống | Biên bản thực địa đính kèm vào báo cáo Tổ tư vấn như tệp thường |
| TM-10 | 5. Tổ tư vấn Hội đồng đánh giá | Phát hành lại báo cáo Tổ tư vấn: không ghi đè nội dung thành viên đã chỉnh, hiển thị chênh lệch để chọn giữ hoặc cập nhật | Hoãn | Vẫn cho tạo phiên bản mới và sao chép lại cho phiếu chưa chỉnh; chỉ bỏ màn hình so sánh chênh lệch |
| TM-11 | 5. Tổ tư vấn Hội đồng đánh giá | Chuẩn bị tài liệu họp: bảng điểm tổng hợp, dự thảo biên bản, dự thảo quyết định công nhận | Gộp vào chức năng khác | Gộp vào HD-09 (bảng tổng hợp, biên bản, quyết định) |
| TV-09 | 6. Thành viên hội đồng / chuyên gia | Khai báo xung đột lợi ích, tự loại khỏi hồ sơ liên quan | Làm ngoài hệ thống | Khai báo xung đột lợi ích bằng văn bản; thư ký hội đồng điều chỉnh phân công |
| BO-01 | 7. Bộ NN&MT (cấp trung ương) | Tiếp nhận hồ sơ đề xuất 5 sao từ các tỉnh theo đợt | Ngoài phạm vi (Bộ không dùng hệ thống) | Thay bằng SO-04: Sở xuất gói hồ sơ 5 sao |
| BO-02 | 7. Bộ NN&MT (cấp trung ương) | Kiểm tra tính đầy đủ hồ sơ tỉnh gửi lên | Ngoài phạm vi (Bộ không dùng hệ thống) | Bộ kiểm tra hồ sơ theo quy trình riêng |
| BO-03 | 7. Bộ NN&MT (cấp trung ương) | Tổ chức hội đồng quốc gia, chấm điểm độc lập | Ngoài phạm vi (Bộ không dùng hệ thống) | Hội đồng quốc gia chấm theo quy trình riêng |
| BO-04 | 7. Bộ NN&MT (cấp trung ương) | Áp dụng cơ chế Tổ tư vấn và sao chép dữ liệu cho hội đồng quốc gia | Ngoài phạm vi (Bộ không dùng hệ thống) | Không áp dụng |
| BO-05 | 7. Bộ NN&MT (cấp trung ương) | Công nhận 5 sao, cấp giấy chứng nhận cấp quốc gia | Ngoài phạm vi (Bộ không dùng hệ thống) | Kết quả của Bộ xử lý ngoài hệ thống; SO-04 chỉ đánh dấu trạng thái hồ sơ |
| BO-06 | 7. Bộ NN&MT (cấp trung ương) | Trả hồ sơ về tỉnh để công nhận 4 sao (nếu 70-89 điểm) | Ngoài phạm vi (Bộ không dùng hệ thống) | Khi Bộ trả về để tỉnh công nhận 4 sao, Sở dùng thao tác chuyển về công nhận cấp tỉnh trong SO-04 |
| BO-07 | 7. Bộ NN&MT (cấp trung ương) | CSDL OCOP toàn quốc | Ngoài phạm vi (Bộ không dùng hệ thống) | Có thể xuất dữ liệu của tỉnh ra Excel khi Bộ yêu cầu |
| BO-08 | 7. Bộ NN&MT (cấp trung ương) | Thống kê, báo cáo tổng hợp, báo cáo Thủ tướng | Ngoài phạm vi (Bộ không dùng hệ thống) | Báo cáo cấp tỉnh xuất từ SO-06 |
| BO-09 | 7. Bộ NN&MT (cấp trung ương) | Công bố công khai danh sách sản phẩm 5 sao | Ngoài phạm vi (Bộ không dùng hệ thống) | Công bố do Bộ thực hiện; tỉnh dùng trang xác thực QR |
| BO-10 | 7. Bộ NN&MT (cấp trung ương) | Hỗ trợ xúc tiến thương mại / tiếp thị quốc tế | Ngoài phạm vi (Bộ không dùng hệ thống) | Không thuộc hệ thống đánh giá |
| AD-07 | 8. Quản trị hệ thống | Quản lý FAQ, hướng dẫn, file mẫu | Làm ngoài hệ thống | Trang tĩnh hoặc tài liệu PDF |
| AD-10 | 8. Quản trị hệ thống | Mở khóa điểm có lý do và ghi audit | Hoãn | Khi hội đồng yêu cầu bằng văn bản, quản trị kỹ thuật mở khóa bằng thao tác riêng có ghi audit |
| AD-11 | 8. Quản trị hệ thống | Import dữ liệu sản phẩm OCOP đã công nhận, phát hiện trùng | Làm ngoài hệ thống | Script nhập một lần khi triển khai |
| AD-12 | 8. Quản trị hệ thống | Dashboard tổng quan toàn hệ thống | Gộp vào chức năng khác | Dùng bảng thống kê SO-06 |
| CK-01 | 9. Cổng tra cứu công khai | Tra cứu sản phẩm OCOP theo số sao, tỉnh, nhóm sản phẩm | Hoãn | Giai đoạn đầu chỉ có trang xác thực QR |
| CK-03 | 9. Cổng tra cứu công khai | Tin tức, văn bản hướng dẫn, lịch các đợt đánh giá | Làm ngoài hệ thống | Dùng website của Sở NN&MT |
| CK-04 | 9. Cổng tra cứu công khai | API mở cho đối tác (sàn TMĐT, siêu thị...) | Hoãn | Chưa có đối tác tích hợp |
| DC-02 | 10. Dùng chung / phi chức năng | Thông báo qua Zalo | Hoãn | Dùng email và thông báo trong ứng dụng |
| DC-06 | 10. Dùng chung / phi chức năng | Ký số văn bản | Làm ngoài hệ thống | Xuất PDF hoặc Word, ký số bằng công cụ sẵn có, tải bản đã ký lên như tệp đính kèm |
| DC-08 | 10. Dùng chung / phi chức năng | Dashboard thống kê thời gian thực | Hoãn | Dùng bảng thống kê SO-06 |
| DC-09 | 10. Dùng chung / phi chức năng | Định danh VNeID hoặc SSO địa phương, 2FA cho hội đồng | Hoãn | Phần VNeID/SSO hoãn; phần xác thực hai lớp được giữ ở bản rút gọn |
| DC-11 | 10. Dùng chung / phi chức năng | API tích hợp với hệ thống khác của chính quyền | Hoãn | Chưa có yêu cầu tích hợp |

## Triển khai cloud VN

| Thành phần | Đề xuất cho bản rút gọn | Ghi chú theo nhà cung cấp (VNG/GreenNode, FPT, Viettel) |
| --- | --- | --- |
| Máy chủ ứng dụng | 1 VM (hoặc 2 VM sau này) chạy Docker Compose: Caddy hoặc Nginx, web Next.js, worker. Ước lượng 2-4 vCPU, 8 GB RAM | Cả ba nhà cung cấp có máy chủ ảo. Không mở cổng trực tiếp ra internet ngoài 80/443 |
| Cân bằng tải và WAF | Tùy chọn ở giai đoạn đầu; nên có khi mở cổng xác thực QR công khai | Nguồn công khai cho thấy FPT Cloud có WAF và Load Balancing; GreenNode (VNG) có dịch vụ lọc lưu lượng HTTP/HTTPS. Cần xác nhận tên gói và giá |
| PostgreSQL | Ưu tiên dịch vụ quản lý có sao lưu tự động; nếu không có thì chạy Postgres trên VM riêng, sao lưu bằng pgBackRest hoặc pg_dump kèm lưu WAL ra object storage | GreenNode vDB có PostgreSQL Cluster (2 đến 10 node, failover tự động, tích hợp vBackup), có ở vùng HAN-01 theo cập nhật 2026. FPT và Viettel: chưa kiểm chứng được dịch vụ PostgreSQL quản lý, cần hỏi nhà cung cấp |
| Lưu trữ tệp | Object storage S3-compatible qua interface FileStore (adapter S3), thay cho volume trên đĩa | GreenNode vStorage hỗ trợ S3 API, pre-signed URL, CORS, versioning. FPT Object Storage tương thích S3. Viettel IDC công bố dịch vụ lưu trữ S3-compatible (thông tin 2022). Cần xác nhận chi tiết với từng nhà cung cấp |
| Điểm cần kiểm thử với S3 của nhà cung cấp | Endpoint kiểu path-style, pre-signed URL, multipart, CORS, versioning, checksum mặc định của AWS SDK v3 | GreenNode: CopyObject trả 501 khi bucket hoặc object bật SSE-S3 hoặc SSE-C. Nếu SDK gửi checksum mà nhà cung cấp không hỗ trợ thì đặt cấu hình chỉ tính checksum khi bắt buộc |
| Sao lưu và khôi phục | Sao lưu DB hằng đêm cộng lưu WAL; bật versioning cho bucket; bản sao thứ hai ở vùng hoặc nhà cung cấp khác; diễn tập khôi phục định kỳ | Object Lock (nếu nhà cung cấp hỗ trợ) giúp chống xóa nhầm hoặc mã độc |
| Mạng | Mạng riêng (VPC): DB và storage đi qua private endpoint khi có | GreenNode có Private Endpoint tới vStorage và các dịch vụ khác |
| Email | SMTP của cơ quan hoặc dịch vụ trong nước; cấu hình SPF, DKIM, DMARC | Quan trọng cho thông báo nhắc hạn và kết quả |
| Giám sát | Log JSON, giám sát uptime, cảnh báo dung lượng đĩa và DB; công cụ giám sát của nhà cung cấp nếu có | GreenNode có vMonitor; các nhà cung cấp khác cần xác nhận |
| Kubernetes | Chưa cần ở bản rút gọn | GreenNode có VKS nếu sau này cần |
| Tuân thủ | Xác nhận cấp độ an toàn thông tin của hệ thống và yêu cầu đối với nhà cung cấp; dữ liệu đặt tại trung tâm dữ liệu trong nước | Cần xác nhận với đơn vị chủ quản và pháp chế |

## Lưu ý và giả định

| Loại | Nội dung | Chi tiết |
| --- | --- | --- |
| Phạm vi | Bản rút gọn dành cho một tỉnh | Gồm 64 mã chức năng gốc cộng phần xác thực hai lớp của DC-09; 41 mã còn lại hoãn, làm ngoài hệ thống, gộp hoặc ngoài phạm vi (sheet Hoãn hoặc cắt). |
| Phạm vi | Bộ NN&MT không phải người dùng hệ thống | Hệ thống chỉ có công cụ xuất gói hồ sơ 5 sao (SO-04). Gửi đánh giá và nhận kết quả bằng văn bản ngoài hệ thống. Sở chỉ đánh dấu trạng thái: Đã gửi đề nghị 5 sao, rồi Chuyển về công nhận cấp tỉnh (khi Bộ trả về) hoặc Đóng hồ sơ (kết quả khác). |
| Giả định | Cột Đợt triển khai | Đợt 1 là luồng lõi. Đợt 2 gồm 4 mục có thể làm sau lõi: CT-15, SO-06, HD-12, CK-02 (QR và thống kê). Đây là đề xuất, có thể điều chỉnh. |
| Đã kiểm tra | Phân bổ điểm Phần A/B/C = 40/25/35 và ngưỡng từng hạng | Đã đối chiếu Phụ lục QĐ 26/2026/QĐ-TTg (26 bộ tiêu chí, ngưỡng 30/50/70/90, Sao tối thiểu); dữ liệu ở `docs/tieu-chi/`. |
| Cần kiểm tra | Mốc thời gian các đợt (xã, tỉnh) | Lưu trong cấu hình đợt, không viết cứng. |
| Cần kiểm tra | Vai trò và thẩm quyền của Tổ tư vấn | Xác nhận đơn vị đảm nhiệm và quy chế hội đồng (số thành viên chấm, trách nhiệm điểm xác nhận). |
| Rủi ro | Thành viên chấp nhận điểm của Tổ tư vấn mà không xem xét | Sao chép một chiều, bắt buộc xác nhận từng phiếu, bắt buộc ghi lý do khi điểm khác với điểm của Tổ tư vấn, lưu điểm gốc của Tổ tư vấn. |
| Cần kiểm tra | Dịch vụ cloud trong nước | Các thông tin về PostgreSQL quản lý, S3, WAF trên VNG (GreenNode), FPT, Viettel lấy từ nguồn công khai; cần xác nhận lại với nhà cung cấp trước khi chọn. |
| Cần kiểm tra | Báo cáo của Tổ tư vấn có bắt buộc trước khi Hội đồng họp không | Một số tỉnh quy định Hội đồng chỉ họp khi có báo cáo thẩm tra của Tổ tư vấn (ví dụ quy chế của Ninh Bình). Nếu bắt buộc thì chế độ chấm trực tiếp cần xem lại. |
| Pháp lý | NĐ 13/2023 và cấp độ an toàn thông tin | Xác nhận yêu cầu cụ thể với đơn vị chủ quản. |
