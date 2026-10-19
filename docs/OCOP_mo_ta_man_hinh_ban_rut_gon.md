# Mô tả màn hình: hệ thống đánh giá, phân hạng OCOP (bản rút gọn cho một tỉnh)

Tài liệu bàn giao cho bước thiết kế giao diện (Claude Design). Mô tả từng màn hình theo bộ tính năng rút gọn: 64 mã chức năng gốc cộng phần xác thực hai lớp (xem `OCOP_tinh_nang_rut_gon.xlsx`). Luồng nghiệp vụ chi tiết nằm ở `OCOP_luong_xu_ly_ban_rut_gon.md` (các mã L01 đến L25).

## Mục lục

1. Hướng dẫn cho người thiết kế
2. Vai trò, thiết bị và điều hướng
3. Hệ thống thành phần giao diện dùng chung
4. Danh mục màn hình
5. Mô tả chi tiết từng màn hình
6. Phụ lục: dữ liệu mẫu để dựng bản mẫu, thứ tự thiết kế đề xuất, điểm cần xác nhận

---

## 1. Hướng dẫn cho người thiết kế

**Sản phẩm là gì.** Website nội bộ và công khai giúp một tỉnh thực hiện đánh giá, phân hạng sản phẩm OCOP (từ 3 đến 5 sao) theo bộ tiêu chí 100 điểm. Chủ thể (doanh nghiệp, hợp tác xã, hộ sản xuất) nộp hồ sơ; UBND xã đánh giá sơ bộ; Sở Nông nghiệp và Môi trường tiếp nhận; hội đồng cấp tỉnh chấm điểm với sự hỗ trợ của Tổ tư vấn; hệ thống cấp giấy chứng nhận có mã QR. Hồ sơ từ 90 điểm: hệ thống chỉ có công cụ xuất gói hồ sơ 5 sao; Sở gửi đánh giá và nhận kết quả bằng văn bản ngoài hệ thống, Bộ NN&MT không dùng hệ thống.

**Điểm khác biệt cần thiết kế kỹ.** Thành viên hội đồng thường không tự chấm từ đầu mà dựa vào bản thẩm định của Tổ tư vấn. Vì vậy có luồng "sao chép dữ liệu của Tổ tư vấn vào phiếu chấm của thành viên", thành viên điều chỉnh (bắt buộc ghi lý do khi khác điểm của Tổ tư vấn) rồi xác nhận. Các màn S51, S53, S61 và S43 là trọng tâm.

**Nguyên tắc thiết kế**
- Tin cậy, rõ ràng, mang tính hành chính nhưng không nặng nề. Ưu tiên khả năng đọc hơn trang trí.
- Chủ thể thường là người dùng không rành công nghệ, hay dùng điện thoại: ưu tiên mobile-first, chữ lớn, một việc chính mỗi màn hình, hướng dẫn ngay tại chỗ.
- Cán bộ Sở, thư ký, Tổ tư vấn làm việc trên máy tính với nhiều dữ liệu: bảng dày, bộ lọc mạnh, hành động hàng loạt, phím tắt cơ bản.
- Trạng thái hồ sơ phải luôn nhìn thấy được: người dùng biết hồ sơ đang ở đâu, ai đang xử lý, việc tiếp theo là gì.
- Hành động không đảo ngược được (nộp, xác nhận phiếu, chốt điểm, cấp giấy chứng nhận) phải có bước xác nhận rõ ràng, nêu hậu quả.
- Quy tắc ẩn hiện theo vai trò là nghiệp vụ, không chỉ giao diện: điểm của thành viên khác bị ẩn, Tổ tư vấn không có nút chốt điểm.

**Gợi ý nhận diện (có thể thay đổi)**
- Màu chủ đạo xanh lá đậm (khoảng `#1F5C3A`), điểm nhấn vàng cho sao và nhấn mạnh (khoảng `#E0A526`), nền trắng và xám nhạt.
- Biểu tượng sao dùng cho hạng. Không dùng màu làm kênh thông tin duy nhất (luôn kèm chữ hoặc biểu tượng).
- Font hỗ trợ đầy đủ dấu tiếng Việt (ví dụ Inter hoặc Be Vietnam Pro). Cỡ chữ nội dung tối thiểu 16px trên di động.

**Ngôn ngữ và định dạng.** Toàn bộ tiếng Việt. Ngày theo dạng dd/mm/yyyy. Số, điểm theo định dạng vi-VN (dấu phẩy thập phân). Giọng văn lịch sự, ngắn gọn, xưng hô trung tính ("Bạn" hoặc không xưng). Tên nhóm sản phẩm lấy theo văn bản chính thức, bản nháp: Thực phẩm; Đồ uống; Dược liệu và sản phẩm từ dược liệu; Thủ công mỹ nghệ; Cây cảnh và cảnh quan; Du lịch cộng đồng, du lịch sinh thái và điểm du lịch.

**Truy cập (accessibility).** Hướng tới WCAG 2.1 mức AA: tương phản đủ, vùng chạm tối thiểu 44px, thao tác được bằng bàn phím trên các màn chấm điểm và bảng, nhãn rõ cho trường nhập, thông báo lỗi nêu cách sửa.

**Responsive (DC-07).** Mọi màn hình của chủ thể, cán bộ xã và thành viên hội đồng phải dùng được trên di động; các màn nặng dữ liệu (S43, S35, S74) tối ưu cho màn hình lớn nhưng vẫn đọc được trên máy tính bảng. Điểm ngắt gợi ý: di động dưới 640px, máy tính bảng 640 đến 1024px, máy tính trên 1024px.

**Dữ liệu cá nhân (DC-10).** Giao diện phải thể hiện được yêu cầu bảo vệ dữ liệu cá nhân: đồng ý chính sách dữ liệu khi đăng ký (S02), che bớt số định danh và số điện thoại ở nơi không cần hiển thị đầy đủ (ví dụ danh sách, nhật ký), trang công khai (S80) không hiển thị thông tin cá nhân, ghi nhận truy cập dữ liệu nhạy cảm vào nhật ký (S74). Nội dung chính sách do đơn vị chủ quản cung cấp.

**Trạng thái cần thiết kế cho mọi màn hình có dữ liệu:** đang tải (skeleton), danh sách trống (kèm lời gọi hành động), lỗi tải (nút thử lại), không đủ quyền, đã khóa (chỉ đọc). Màn hình nhập liệu cần: lưu nháp tự động, lỗi từng trường, lỗi cấp biểu mẫu.

**Phạm vi cần thiết kế.** Tất cả màn hình ở mục 4. Màn hình đánh dấu "Đợt 2" vẫn nên thiết kế để thống nhất ngôn ngữ giao diện, nhưng có thể làm sau. Các chức năng đã hoãn hoặc làm ngoài hệ thống (khiếu nại, ký số tích hợp, tra cứu công khai đầy đủ, màn hình của Bộ, thực địa trên mobile) không có màn hình.

---

## 2. Vai trò, thiết bị và điều hướng

| Vai trò | Người dùng điển hình | Thiết bị chính | Mục tiêu chính |
|---|---|---|---|
| Chủ thể | Chủ doanh nghiệp, giám đốc HTX, chủ hộ | Điện thoại, máy tính | Lập hồ sơ, nộp, bổ sung, nhận kết quả |
| Cán bộ xã, lãnh đạo xã | Cán bộ văn phòng, chủ tịch xã | Máy tính, điện thoại | Tiếp nhận, kiểm tra, đánh giá sơ bộ, gửi tỉnh |
| Cán bộ Sở | Chuyên viên Sở NN&MT | Máy tính | Quản lý đợt, tiếp nhận, theo dõi, xuất hồ sơ 5 sao, báo cáo |
| Thư ký hội đồng, chủ tịch hội đồng | Lãnh đạo Sở, thư ký | Máy tính | Lập hội đồng, phân công, chốt điểm, cấp giấy chứng nhận |
| Thành viên Tổ tư vấn, Tổ trưởng Tổ tư vấn | Chuyên viên thẩm định | Máy tính màn hình lớn | Thẩm định, chấm đề xuất, phát hành, sao chép |
| Thành viên hội đồng | Chuyên gia, lãnh đạo ban ngành | Máy tính, máy tính bảng | Xem xét, điều chỉnh, xác nhận phiếu |
| Quản trị hệ thống | Cán bộ CNTT | Máy tính | Tài khoản, tiêu chí, danh mục, nhật ký |
| Công chúng | Người mua, đối tác | Điện thoại | Xác thực mã QR |

**Điều hướng chính theo vai trò (menu trái trên máy tính, thanh dưới hoặc menu thu gọn trên di động)**

| Vai trò | Mục menu |
|---|---|
| Chủ thể | Trang chủ, Hồ sơ của tôi, Hồ sơ pháp lý, Thông báo, Tài khoản |
| Cán bộ xã | Trang chủ, Hồ sơ tại xã, Gửi lên tỉnh, Thông báo, Tài khoản |
| Cán bộ Sở | Trang chủ, Đợt đánh giá, Hồ sơ toàn tỉnh, Hồ sơ 5 sao, Thống kê, Thông báo, Tài khoản |
| Thư ký, chủ tịch hội đồng | Trang chủ, Hội đồng, Phân công, Tiến độ chấm, Chốt điểm, Văn bản và chứng nhận, Thông báo, Tài khoản |
| Thành viên Tổ tư vấn | Trang chủ, Hàng đợi thẩm định, Sao chép sang phiếu chấm, Thông báo, Tài khoản |
| Thành viên hội đồng | Trang chủ, Hồ sơ được phân công, Điểm tổng hợp, Thông báo, Tài khoản |
| Quản trị | Tài khoản và vai trò, Bộ tiêu chí, Danh mục, Nhật ký, Thông báo, Tài khoản |

Một người có thể có nhiều vai trò (ví dụ cán bộ Sở kiêm thư ký). Cần thiết kế bộ chuyển vai trò trên thanh đầu trang. Không cho một người vừa là thành viên Tổ tư vấn vừa là thành viên hội đồng chấm cùng một hồ sơ (kiểm soát bằng quyền, giao diện chỉ thông báo khi bị chặn).

---

## 3. Hệ thống thành phần giao diện dùng chung

### 3.1 Khung ứng dụng (S00)
- **Đầu trang:** logo và tên hệ thống, ô tìm kiếm toàn cục (S90, chỉ máy tính), chuyển vai trò, chuông thông báo kèm số chưa đọc, ảnh đại diện (menu Tài khoản, Đăng xuất).
- **Menu trái** thu gọn được trên máy tính; trên di động là menu trượt hoặc thanh dưới cho tối đa 4 mục chính.
- **Dải thông báo hệ thống** dưới đầu trang cho các tin quan trọng: "Đợt đánh giá 2026 đóng nhận hồ sơ sau 5 ngày", bảo trì.
- **Vết điều hướng (breadcrumb)** trên các màn chi tiết.

### 3.2 Chip trạng thái hồ sơ
Mỗi trạng thái có nhãn chữ, biểu tượng nhỏ và màu. Màu gợi ý (có thể điều chỉnh) giữ nhất quán toàn hệ thống.

| Trạng thái | Nhãn hiển thị | Nhóm màu gợi ý |
|---|---|---|
| Nháp | Nháp | Xám |
| Đã nộp xã | Đã nộp, chờ xã | Xanh dương |
| Yêu cầu bổ sung | Cần bổ sung | Cam |
| Không đạt sơ bộ | Không đạt sơ bộ | Đỏ nhạt |
| Đã chuyển tỉnh | Đã chuyển tỉnh | Xanh dương |
| Tổ tư vấn thẩm định | Đang thẩm định | Tím |
| Đã phát hành báo cáo Tổ tư vấn | Đã có báo cáo Tổ tư vấn | Tím |
| Thành viên xem xét | Hội đồng đang xem xét | Tím |
| Thành viên xác nhận | Đã xác nhận phiếu | Tím |
| Đã chốt điểm | Đã chốt điểm | Xanh lá |
| Công nhận 3 sao, 4 sao | Công nhận 3 sao hoặc 4 sao | Xanh lá |
| Không đạt | Chưa đạt | Đỏ |
| Đã gửi đề nghị 5 sao | Đã gửi đề nghị 5 sao | Vàng |
| Đã đóng, xử lý ngoài hệ thống | Đã đóng (xử lý ngoài hệ thống) | Xám |
| Đã rút | Đã rút | Xám |

### 3.3 Dòng thời gian trạng thái (stepper)
Thanh tiến trình ngang trên máy tính, dọc trên di động: Nộp → Xã → Tỉnh → Hội đồng → Kết quả. Bước hiện tại nổi bật, bước đã qua có dấu tích kèm ngày giờ, bước chưa tới mờ. Bấm vào bước để mở lịch sử chi tiết (ai, khi nào, lý do).

### 3.4 Ô nhập điểm
Ô số có biên: hiển thị "điểm / điểm tối đa" (ví dụ `7 / 10`), nút tăng giảm, bàn phím số trên di động, báo lỗi khi vượt khung hoặc để trống, hỗ trợ phím Tab và mũi tên khi nhập hàng loạt. Điểm tổng và điểm từng phần (A, B, C) cập nhật trực tiếp trong thanh cố định ở cuối màn hình.

### 3.5 Huy hiệu nguồn dữ liệu của phiếu chấm
Dùng ở S61. Ba trạng thái:
- "Từ Tổ tư vấn (phiên bản N)": nền xám nhạt, biểu tượng sao chép.
- "Đã chỉnh": nền cam nhạt, hiển thị cạnh ô điểm giá trị gốc của Tổ tư vấn (gạch ngang hoặc chữ mờ) để so sánh.
- "Nhập trực tiếp": không huy hiệu.

### 3.6 Bảng dữ liệu
Cột sắp xếp được, bộ lọc nhanh (chip) và bộ lọc nâng cao (ngăn kéo), tìm kiếm trong bảng, chọn nhiều dòng với thanh hành động hàng loạt xuất hiện khi chọn, phân trang, nút xuất Excel. Trên di động chuyển thành danh sách thẻ, mỗi thẻ có tên, chip trạng thái, hạn xử lý và một hành động chính.

### 3.7 Tải tệp minh chứng
Vùng kéo thả (máy tính) và nút chụp ảnh hoặc chọn tệp (di động). Hiển thị: tên tệp, dung lượng, tiến độ tải, biểu tượng loại tệp, nút xem và xóa (chỉ khi còn nháp). Báo lỗi định dạng hoặc dung lượng nêu rõ giới hạn. Trong màn minh chứng theo tiêu chí, mỗi tiêu chí có vùng tải riêng; một tệp có thể gắn nhiều tiêu chí.

### 3.8 Hộp thoại xác nhận
Ba kiểu: thường (xác nhận hành động), nguy hiểm (nút đỏ, nêu hậu quả, yêu cầu gõ chữ xác nhận khi cần, ví dụ chốt điểm), có OTP (xác nhận phiếu chấm). Luôn nêu: sẽ xảy ra gì, ai nhận thông báo, có hoàn tác được không.

### 3.9 Khung hai bên (split view)
Dùng ở S51, S61: bên trái là tài liệu tham chiếu (báo cáo Tổ tư vấn, minh chứng) với các tab; bên phải là biểu mẫu chấm. Hai bên cuộn độc lập. Trên di động chuyển thành hai tab "Tài liệu" và "Phiếu chấm" với thanh tổng điểm cố định.

### 3.10 Xem trước tệp (S91)
Ngăn trượt hoặc toàn màn hình: xem PDF và ảnh, phóng to, chuyển tệp trước sau, tải xuống. Hiển thị gắn với tiêu chí nào.

### 3.11 Thông báo
Toast cho thao tác nhanh, banner cho trạng thái trang, chuông kèm danh sách thả xuống cho thông báo hệ thống (S04). Nội dung thông báo không chứa điểm chi tiết.

---

## 4. Danh mục màn hình

| Mã | Tên màn hình | Vai trò | Thiết bị ưu tiên | Đợt | Luồng |
|---|---|---|---|---|---|
| S00 | Khung ứng dụng và điều hướng | Tất cả | Cả hai | 1 | Chung |
| S01 | Đăng nhập và nhập mã 2FA | Tất cả | Cả hai | 1 | L01, L20 |
| S02 | Đăng ký tài khoản chủ thể | Chủ thể | Di động | 1 | L01 |
| S03 | Tài khoản cá nhân và bảo mật | Tất cả | Cả hai | 1 | L20 |
| S04 | Thông báo | Tất cả | Cả hai | 1 | L23 |
| S10 | Trang chủ chủ thể | Chủ thể | Di động | 1 | L03 |
| S11 | Hồ sơ pháp lý của tổ chức | Chủ thể | Di động | 1 | L01 |
| S12 | Danh sách hồ sơ của tôi | Chủ thể | Di động | 1 | L02, L03 |
| S13 | Tạo và sửa hồ sơ sản phẩm | Chủ thể | Di động | 1 | L02 |
| S14 | Minh chứng theo tiêu chí | Chủ thể | Di động | 1 | L02 |
| S15 | Tự chấm điểm thử | Chủ thể | Di động | 1 | L02 |
| S16 | Xem lại và nộp hồ sơ | Chủ thể | Di động | 1 | L03 |
| S17 | Chi tiết hồ sơ và theo dõi trạng thái | Chủ thể | Di động | 1 | L03 |
| S18 | Yêu cầu bổ sung và nộp lại | Chủ thể | Di động | 1 | L04 |
| S19 | Kết quả và giấy chứng nhận | Chủ thể | Di động | 1 (QR: 2) | L16 |
| S20 | Trang chủ UBND xã | Cán bộ xã | Máy tính | 1 | L05 |
| S21 | Danh sách hồ sơ tại xã | Cán bộ xã | Máy tính | 1 | L05 |
| S22 | Chi tiết hồ sơ và kiểm tra tại xã | Cán bộ xã | Máy tính | 1 | L05, L06 |
| S23 | Checklist đánh giá sơ bộ | Cán bộ xã | Máy tính | 1 | L06 |
| S24 | Tạo yêu cầu bổ sung | Cán bộ xã, Sở | Máy tính | 1 | L04 |
| S25 | Lập biên bản và gửi lên tỉnh | Lãnh đạo xã | Máy tính | 1 | L06 |
| S30 | Trang chủ Sở NN&MT | Cán bộ Sở | Máy tính | 1 | L07, L08 |
| S31 | Quản lý đợt đánh giá | Cán bộ Sở | Máy tính | 1 | L07 |
| S32 | Danh sách hồ sơ toàn tỉnh | Cán bộ Sở | Máy tính | 1 | L08 |
| S33 | Chi tiết hồ sơ tại tỉnh | Cán bộ Sở | Máy tính | 1 | L08 |
| S34 | Hồ sơ 5 sao: xuất gói hồ sơ | Cán bộ Sở | Máy tính | 1 | L17 |
| S35 | Thống kê và xuất báo cáo | Cán bộ Sở, xã | Máy tính | 2 | L22 |
| S40 | Quản lý hội đồng | Thư ký hội đồng | Máy tính | 1 | L09 |
| S41 | Phân công hồ sơ và chọn chế độ chấm | Thư ký hội đồng | Máy tính | 1 | L09 |
| S42 | Tiến độ chấm của đợt | Thư ký hội đồng | Máy tính | 1 | L15 |
| S43 | Tổng hợp điểm và chốt | Thư ký, chủ tịch | Máy tính | 1 | L15 |
| S44 | Biên bản và quyết định | Thư ký hội đồng | Máy tính | 1 | L15 |
| S45 | Cấp giấy chứng nhận và gửi kết quả | Thư ký hội đồng | Máy tính | 1 | L16 |
| S50 | Hàng đợi thẩm định | Thành viên Tổ tư vấn | Máy tính | 1 | L10 |
| S51 | Thẩm định và chấm điểm đề xuất | Thành viên Tổ tư vấn | Máy tính | 1 | L10 |
| S52 | Soạn và phát hành báo cáo Tổ tư vấn | Tổ trưởng Tổ tư vấn | Máy tính | 1 | L11 |
| S53 | Sao chép sang phiếu chấm | Thành viên Tổ tư vấn | Máy tính | 1 | L12 |
| S60 | Hồ sơ được phân công | Thành viên | Cả hai | 1 | L13, L14 |
| S61 | Phiếu chấm | Thành viên | Máy tính, máy tính bảng | 1 | L13, L14 |
| S62 | Xác nhận phiếu chấm (OTP) | Thành viên | Cả hai | 1 | L13 |
| S63 | Điểm tổng hợp sau khi đủ phiếu | Thành viên | Cả hai | 1 | L15 |
| S70 | Tài khoản và vai trò | Quản trị | Máy tính | 1 | L20 |
| S71 | Danh sách phiên bản bộ tiêu chí | Quản trị | Máy tính | 1 | L19 |
| S72 | Trình soạn bộ tiêu chí | Quản trị | Máy tính | 1 | L19 |
| S73 | Danh mục và mẫu văn bản | Quản trị | Máy tính | 1 | L07, L09 |
| S74 | Nhật ký hoạt động | Quản trị | Máy tính | 1 | L21 |
| S80 | Trang xác thực mã QR | Công chúng | Di động | 2 | L18 |
| S90 | Tìm kiếm toàn cục | Tất cả nội bộ | Máy tính | 1 | L24 |
| S91 | Xem trước tệp | Tất cả nội bộ | Cả hai | 1 | L24 |
| S92 | Trang lỗi và bảo trì | Tất cả | Cả hai | 1 | Chung |

---

## 5. Mô tả chi tiết từng màn hình

Mỗi màn hình gồm: mục đích, bố cục, thành phần chính, trạng thái và quy tắc, điều hướng. Mã chức năng (CT-xx, XA-xx...) tham chiếu danh sách tính năng.

### 5.1 Nhóm chung

#### S01. Đăng nhập và nhập mã 2FA
**Chức năng:** CT-01, DC-09 (2FA) · **Luồng:** L01, L20
- **Mục đích:** đăng nhập an toàn; hội đồng và quản trị nhập thêm mã xác thực hai lớp.
- **Bố cục:** thẻ giữa màn hình, logo và tên hệ thống ở trên; bên phải hoặc dưới (di động) có dòng hỗ trợ ngắn.
- **Thành phần:** Email hoặc tên đăng nhập, Mật khẩu (nút hiện mật khẩu), "Quên mật khẩu?", nút Đăng nhập, liên kết "Đăng ký tài khoản chủ thể". Bước 2 (chỉ vai trò hội đồng và quản trị): nhập mã 6 số, ô tách từng số, tự chuyển ô, đếm thời gian hiệu lực.
- **Trạng thái:** sai mật khẩu (báo lỗi chung, không nêu trường nào sai), khóa tạm thời sau nhiều lần sai (hiện thời gian chờ), phiên hết hạn (thông báo và quay về trang cũ sau khi đăng nhập), mất mã 2FA (liên hệ quản trị).
- **Điều hướng:** thành công đưa về Trang chủ của vai trò; người nhiều vai trò chọn vai trò mặc định.

#### S02. Đăng ký tài khoản chủ thể
**Chức năng:** CT-01 · **Luồng:** L01
- **Mục đích:** chủ thể tự tạo tài khoản.
- **Bố cục:** biểu mẫu nhiều bước ngắn (3 bước): thông tin tổ chức, liên hệ, xác thực email.
- **Thành phần:** Loại tổ chức (Doanh nghiệp, Hợp tác xã, Hộ sản xuất), Tên tổ chức hoặc họ tên chủ hộ, Mã số thuế hoặc số định danh, Xã/phường (danh sách chọn có tìm kiếm), Người đại diện, Số điện thoại, Email, Mật khẩu (kèm thanh độ mạnh), Đồng ý điều khoản và chính sách dữ liệu cá nhân (liên kết).
- **Trạng thái:** trùng mã số thuế (gợi ý khôi phục tài khoản), email chưa xác thực (màn "Kiểm tra email" kèm nút gửi lại), thành công (chuyển sang S11 để bổ sung giấy tờ).
- **Ghi chú:** hộ sản xuất không rành công nghệ có thể được cán bộ xã tạo hộ; giao diện chỉ cần ghi chú "Liên hệ UBND xã để được hỗ trợ".

#### S03. Tài khoản cá nhân và bảo mật
**Chức năng:** AD-01, DC-09 · **Luồng:** L20
- **Mục đích:** xem thông tin, đổi mật khẩu, bật 2FA, xem phiên đăng nhập.
- **Bố cục:** hai cột (máy tính): thông tin cá nhân; bảo mật.
- **Thành phần:** Thông tin liên hệ có thể sửa, Đổi mật khẩu, Xác thực hai lớp (mã QR để quét bằng ứng dụng xác thực, ô nhập mã kiểm tra, danh sách mã dự phòng có nút tải), Phiên đăng nhập hiện tại (thiết bị, thời gian, nút đăng xuất khỏi thiết bị).
- **Trạng thái:** vai trò hội đồng và quản trị bắt buộc bật 2FA: hiển thị banner chặn mọi thao tác khác cho đến khi bật xong.

#### S04. Thông báo
**Chức năng:** DC-01 · **Luồng:** L23
- **Mục đích:** xem thông báo trong ứng dụng.
- **Bố cục:** menu thả xuống từ chuông (5 thông báo gần nhất) và trang đầy đủ có tab Tất cả, Chưa đọc.
- **Thành phần:** mỗi thông báo có biểu tượng loại sự kiện, tiêu đề ngắn, tên hồ sơ, thời gian, chấm chưa đọc; bấm mở đúng màn hình liên quan; "Đánh dấu đã đọc tất cả"; cấu hình nhận email (bật tắt theo loại).
- **Ví dụ nội dung:** "Hồ sơ Mắm cá linh khô cần bổ sung minh chứng, hạn 20/10/2026", "Có báo cáo Tổ tư vấn mới cho hồ sơ HS-0123".
- **Quy tắc:** không đưa điểm chi tiết vào thông báo.

#### S90. Tìm kiếm toàn cục
**Chức năng:** DC-04 · **Luồng:** L24
- **Mục đích:** tìm nhanh hồ sơ trong phạm vi quyền.
- **Bố cục:** ô tìm kiếm ở đầu trang mở bảng gợi ý (kiểu bảng lệnh), phím tắt gợi ý; trang kết quả có bộ lọc bên trái.
- **Thành phần:** gợi ý khi gõ (tên sản phẩm, mã hồ sơ, tên chủ thể), nhóm kết quả theo loại, bộ lọc đợt, xã/phường, nhóm sản phẩm, trạng thái, hạng, "Lưu bộ lọc này".
- **Trạng thái:** không có kết quả (gợi ý bỏ dấu hoặc bớt bộ lọc). Tìm kiếm không phân biệt dấu tiếng Việt.

#### S91. Xem trước tệp
**Chức năng:** DC-03 · **Luồng:** L24
- **Mục đích:** xem minh chứng không cần tải về.
- **Bố cục:** ngăn trượt từ phải hoặc toàn màn hình; trên di động toàn màn hình.
- **Thành phần:** tên tệp, loại, người tải, thời gian, tiêu chí đã gắn; xem PDF nhiều trang và ảnh; phóng to thu nhỏ; chuyển tệp trước sau; tải xuống; ngữ cảnh tiêu chí ("Tiêu chí A2: Nguồn gốc nguyên liệu").
- **Trạng thái:** tệp không xem trước được (hiện biểu tượng và nút tải), tệp đang quét hoặc xử lý, tệp không đủ quyền.

#### S92. Trang lỗi và bảo trì
- Ba biến thể: Không tìm thấy (404), Không có quyền (403, nêu cách xin quyền), Lỗi hệ thống (500, mã sự cố để báo), và Bảo trì (thời gian dự kiến). Mỗi trang có nút quay về Trang chủ.

### 5.2 Nhóm Chủ thể OCOP

#### S10. Trang chủ chủ thể
**Chức năng:** CT-10, CT-12 · **Luồng:** L03
- **Mục đích:** cho chủ thể biết ngay việc cần làm.
- **Bố cục (di động):** khối "Việc cần làm" ở trên, danh sách hồ sơ rút gọn ở giữa, thông tin đợt ở dưới.
- **Thành phần:** thẻ cảnh báo đợt hiện tại (tên đợt, số ngày còn lại tới hạn nộp), thẻ "Cần bổ sung" (nếu có) kèm hạn, danh sách hồ sơ (tên sản phẩm, chip trạng thái, bước hiện tại), nút nổi "Tạo hồ sơ sản phẩm", đường dẫn nhanh "Cập nhật giấy tờ pháp lý".
- **Trạng thái:** chưa có hồ sơ (minh họa và hướng dẫn 3 bước), chưa có đợt nào đang mở (thông báo ngày mở đợt kế tiếp nếu biết), tài khoản chưa đủ giấy tờ pháp lý (banner nhắc dẫn tới S11).

#### S11. Hồ sơ pháp lý của tổ chức
**Chức năng:** CT-02 · **Luồng:** L01
- **Mục đích:** quản lý giấy tờ pháp lý dùng chung cho các hồ sơ sản phẩm.
- **Bố cục:** danh sách thẻ giấy tờ, nút thêm ở đầu.
- **Thành phần:** loại giấy tờ (Giấy phép kinh doanh, Giấy chứng nhận VSATTP, Công bố chất lượng, Khác), số giấy, ngày cấp, ngày hết hạn, tệp đính kèm (xem trước), chip "Còn hạn" hoặc "Sắp hết hạn" hoặc "Hết hạn".
- **Trạng thái:** giấy tờ hết hạn có đường viền cảnh báo và nhắc cập nhật.
- **Ghi chú:** cảnh báo tự động qua thông báo thuộc giai đoạn sau; ở giai đoạn đầu chỉ hiển thị chip theo ngày.

#### S12. Danh sách hồ sơ của tôi
**Chức năng:** CT-03, CT-10 · **Luồng:** L02, L03
- **Mục đích:** xem tất cả hồ sơ sản phẩm qua các đợt.
- **Bố cục:** bảng (máy tính) hoặc thẻ (di động); lọc theo đợt, trạng thái.
- **Thành phần:** mã hồ sơ, tên sản phẩm, nhóm sản phẩm, đợt, chip trạng thái, ngày cập nhật, hạng và điểm (khi đã có kết quả), nút theo ngữ cảnh (Tiếp tục soạn, Xem, Bổ sung).
- **Trạng thái:** trống (nút "Tạo hồ sơ sản phẩm").

#### S13. Tạo và sửa hồ sơ sản phẩm
**Chức năng:** CT-03 · **Luồng:** L02
- **Mục đích:** nhập thông tin sản phẩm theo nhóm OCOP.
- **Bố cục:** thanh bước ở đầu (1 Thông tin chung, 2 Minh chứng theo tiêu chí, 3 Tự chấm điểm, 4 Xem lại và nộp); nội dung bước hiện tại; thanh cố định ở cuối có "Lưu nháp", "Quay lại", "Tiếp tục". Trạng thái lưu tự động hiển thị nhỏ ("Đã lưu 14:32").
- **Thành phần (bước 1):** Tên sản phẩm (bắt buộc), Nhóm sản phẩm (chọn 1 trong 6 nhóm, bắt buộc), Mô tả sản phẩm, Nguyên liệu và nguồn gốc, Quy trình sản xuất, Bao bì và nhãn mác, Công bố chất lượng (số, ngày), Địa điểm sản xuất, Ảnh sản phẩm (nhiều ảnh, chọn ảnh đại diện), Bản sắc văn hóa, nguồn gốc, câu chuyện sản phẩm (văn bản dài).
- **Trạng thái:** đổi nhóm sản phẩm sau khi đã có minh chứng: hộp thoại cảnh báo bộ tiêu chí thay đổi, nêu số minh chứng cần gắn lại. Phiên bản tiêu chí đổi trong lúc soạn: banner so sánh khác biệt. Lỗi từng trường hiện ngay dưới trường.
- **Điều hướng:** từ bước 4 nộp xong chuyển sang S17.

#### S14. Minh chứng theo tiêu chí
**Chức năng:** CT-05 · **Luồng:** L02
- **Mục đích:** tải minh chứng đúng từng tiêu chí trong bộ 100 điểm.
- **Bố cục:** danh sách tiêu chí nhóm theo Phần A, B, C (tiêu đề phần kèm điểm tối đa lấy từ cấu hình); mỗi tiêu chí là một thẻ gập mở. Thanh tiến độ đầu trang: "12 / 18 tiêu chí đã có minh chứng".
- **Thành phần mỗi tiêu chí:** mã và tên tiêu chí, mô tả cách đánh giá (gập mở), điểm tối đa, danh sách minh chứng yêu cầu, vùng tải tệp (mục 3.7), danh sách tệp đã gắn (xem, gỡ), ô "Giải trình" (văn bản), chip trạng thái ("Thiếu minh chứng", "Đã có").
- **Trạng thái:** tiêu chí chưa có minh chứng vẫn cho đi tiếp nhưng bị đánh dấu ở bước nộp.
- **Ghi chú thiết kế:** nội dung tiêu chí và điểm tối đa luôn lấy từ bộ tiêu chí đang áp dụng, không viết cứng trong giao diện.

#### S15. Tự chấm điểm thử
**Chức năng:** CT-06 · **Luồng:** L02
- **Mục đích:** chủ thể ước lượng số sao của mình.
- **Bố cục:** trái là danh sách tiêu chí kèm ô chấm; phải (hoặc trên cùng ở di động) là thẻ kết quả ước lượng cố định.
- **Thành phần:** mỗi tiêu chí có điểm tối đa, ô nhập điểm (mục 3.4), chip "chưa có minh chứng" nếu thiếu. Thẻ kết quả: tổng điểm lớn, điểm từng Phần A, B, C (thanh tiến độ), số sao ước lượng (biểu tượng sao), dòng ghi chú "Điểm tự chấm chỉ mang tính tham khảo, không phải kết quả chính thức".
- **Trạng thái:** chưa chấm hết (thẻ hiện "Ước lượng tạm thời"), dưới 50 điểm (thông báo "Chưa đạt ngưỡng 3 sao", gợi ý quay lại bổ sung minh chứng).

#### S16. Xem lại và nộp hồ sơ
**Chức năng:** CT-09 · **Luồng:** L03
- **Mục đích:** rà soát lần cuối rồi nộp.
- **Bố cục:** trái là tóm tắt hồ sơ (thông tin chung, số minh chứng theo Phần A, B, C); phải là thẻ "Kiểm tra trước khi nộp" và nút nộp.
- **Thành phần:** danh sách kiểm tra tự động (đủ trường bắt buộc, giấy tờ pháp lý còn hạn, mỗi tiêu chí có minh chứng) với mức lỗi chặn và cảnh báo; đếm ngược hạn nộp của đợt; ô xác nhận thông tin chính xác (nội dung theo yêu cầu của Sở); nút "Nộp hồ sơ" (vô hiệu khi còn lỗi chặn).
- **Hộp thoại xác nhận:** nêu "Sau khi nộp, hồ sơ được chốt phiên bản và gửi UBND xã. Muốn sửa phải chờ xã yêu cầu bổ sung".
- **Trạng thái:** đợt đã đóng (không nộp được, gợi ý chuyển sang đợt sau), nộp thành công (màn hình xác nhận kèm mã hồ sơ và bước tiếp theo).

#### S17. Chi tiết hồ sơ và theo dõi trạng thái
**Chức năng:** CT-10 · **Luồng:** L03
- **Mục đích:** theo dõi hồ sơ đã nộp.
- **Bố cục:** đầu trang có tên sản phẩm, mã hồ sơ, chip trạng thái, đợt; dòng thời gian trạng thái (mục 3.3); các tab: Tổng quan, Minh chứng, Lịch sử, Yêu cầu bổ sung (kèm số), Kết quả.
- **Thành phần:** khối "Bước tiếp theo" (ai đang xử lý, dự kiến), thông tin hồ sơ (chỉ đọc), minh chứng theo tiêu chí (chỉ đọc), lịch sử sự kiện (ai, khi nào, lý do), nút theo ngữ cảnh: Bổ sung (khi có yêu cầu), Rút hồ sơ (trước khi xã xử lý, có hộp thoại xác nhận và ghi lý do).
- **Trạng thái:** mỗi trạng thái hồ sơ có lời giải thích ngắn bằng ngôn ngữ thường ("Hồ sơ của bạn đang được hội đồng tỉnh xem xét").

#### S18. Yêu cầu bổ sung và nộp lại
**Chức năng:** CT-11 · **Luồng:** L04
- **Mục đích:** đáp ứng các yêu cầu bổ sung của xã hoặc Sở.
- **Bố cục:** đầu trang nêu người yêu cầu, ngày, hạn bổ sung (đếm ngược); danh sách các mục cần bổ sung; thanh cố định ở cuối có tiến độ ("2 / 4 mục đã trả lời") và nút "Nộp lại".
- **Thành phần mỗi mục:** nội dung yêu cầu, liên kết tới tiêu chí hoặc giấy tờ liên quan (bấm mở vùng chỉnh sửa tương ứng), ô trả lời, vùng tải tệp, chip trạng thái (Chưa trả lời, Đã trả lời).
- **Trạng thái:** quá hạn (banner đỏ, vẫn cho nộp nếu cán bộ chưa đóng hồ sơ), đã nộp lại (chỉ đọc, hiện phiên bản).
- **Quy tắc:** nút "Nộp lại" chỉ kích hoạt khi tất cả mục có trả lời.

#### S19. Kết quả và giấy chứng nhận
**Chức năng:** CT-13, CT-15 · **Luồng:** L16 · QR và tải chứng nhận thuộc Đợt 2
- **Mục đích:** chủ thể xem kết quả đánh giá và tải giấy chứng nhận.
- **Bố cục:** khối đầu trang nổi bật (hạng sao, tổng điểm); bên dưới điểm theo Phần A, B, C (thanh tiến độ có điểm tối đa); nhận xét của hội đồng; khối giấy chứng nhận.
- **Thành phần:** biểu tượng sao theo hạng, số hiệu và ngày cấp, nhận xét tổng hợp, danh sách "Tiêu chí cần cải thiện" (khi chưa đạt hoặc đạt thấp), nút "Tải giấy chứng nhận (PDF)", ảnh mã QR có thể tải, nút "Đăng ký lại ở đợt sau" (tạo hồ sơ mới, điền sẵn thông tin).
- **Biến thể:** 3 sao hoặc 4 sao (có thể có ghi chú "đủ điều kiện nâng hạng"), Chưa đạt (không có khối chứng nhận, nhấn mạnh tiêu chí cần cải thiện, giọng văn động viên), Đã gửi đề nghị 5 sao (chờ kết quả; kết quả được thông báo ngoài hệ thống), Đã đóng (xử lý ngoài hệ thống, không có khối chứng nhận).
- **Quy tắc:** chủ thể không thấy điểm từng thành viên, chỉ thấy điểm tổng hợp và nhận xét công khai.

### 5.3 Nhóm UBND xã/phường

#### S20. Trang chủ UBND xã
**Chức năng:** XA-01 · **Luồng:** L05
- **Mục đích:** nắm khối lượng công việc của xã trong đợt.
- **Bố cục:** hàng thẻ số liệu ở trên, danh sách việc gần hạn ở dưới.
- **Thành phần:** thẻ Chờ tiếp nhận, Đang xử lý, Đã gửi tỉnh, Cần bổ sung; thẻ đợt hiện tại (hạn gửi tỉnh, đếm ngược); danh sách "Hồ sơ cần xử lý trước hạn" (mã, tên sản phẩm, người phụ trách, hạn).
- **Trạng thái:** không có đợt mở (thông báo), cán bộ chưa được phân công hồ sơ nào.

#### S21. Danh sách hồ sơ tại xã
**Chức năng:** XA-01, XA-03, DC-04 · **Luồng:** L05
- **Mục đích:** tiếp nhận và phân công hồ sơ.
- **Bố cục:** bảng dữ liệu (mục 3.6) với chip bộ lọc nhanh ở trên: Chờ tiếp nhận, Đang xử lý, Cần bổ sung, Đã gửi tỉnh.
- **Thành phần:** cột mã hồ sơ, tên sản phẩm, chủ thể, nhóm sản phẩm, ngày nhận, người phụ trách, chip trạng thái, hạn; hành động hàng loạt "Phân công cho..." (chọn cán bộ); xuất Excel.
- **Trạng thái:** trống.

#### S22. Chi tiết hồ sơ và kiểm tra tại xã
**Chức năng:** XA-02, XA-05 · **Luồng:** L05, L06
- **Mục đích:** cán bộ xã kiểm tra tính hợp lệ và quyết định hướng xử lý.
- **Bố cục:** đầu trang có thông tin nhận dạng hồ sơ và chip trạng thái; các tab: Tổng quan, Minh chứng, Kiểm tra tài liệu, Đánh giá sơ bộ, Lịch sử; thanh hành động cố định ở cuối hoặc đầu.
- **Thành phần:** tab Tổng quan (thông tin chủ thể và sản phẩm); tab Minh chứng (nhóm theo tiêu chí, bấm mở S91); tab Kiểm tra tài liệu (danh mục tài liệu bắt buộc, đánh dấu Đủ hoặc Thiếu); tab Đánh giá sơ bộ (S23). Thanh hành động: "Yêu cầu bổ sung" (mở S24), "Loại hồ sơ" (hộp thoại bắt buộc nhập lý do), "Chuyển sang đánh giá sơ bộ" hoặc "Đề xuất chuyển tỉnh" (tùy bước).
- **Trạng thái:** hồ sơ không thuộc địa bàn (banner và hành động "Chuyển sang xã đúng"), hồ sơ đã chuyển tỉnh (chỉ đọc).

#### S23. Checklist đánh giá sơ bộ
**Chức năng:** XA-04 · **Luồng:** L06
- **Mục đích:** ghi nhận đánh giá sơ bộ của xã.
- **Bố cục:** nằm trong tab của S22; ba mục kiểm tra theo chiều dọc; khối kết luận ở cuối.
- **Thành phần mỗi mục:** (1) Nguồn gốc nguyên liệu, (2) Lao động địa phương, (3) Bản sắc văn hóa và trí tuệ bản địa. Mỗi mục có nút chọn Đạt, Không đạt, Cần xác minh, ô nhận xét, tệp đối chiếu (xem nhanh minh chứng liên quan). Khối kết luận: hệ thống đề xuất "Đủ điều kiện chuyển tỉnh" hoặc "Chưa đủ"; cán bộ xác nhận hoặc đổi kèm lý do.
- **Trạng thái:** còn mục chưa chọn thì chưa có kết luận; "Cần xác minh" bắt buộc có nhận xét.

#### S24. Tạo yêu cầu bổ sung
**Chức năng:** XA-05 · **Luồng:** L04
- **Mục đích:** nêu rõ cần chủ thể bổ sung gì.
- **Bố cục:** ngăn trượt hoặc hộp thoại lớn.
- **Thành phần:** danh sách mục yêu cầu (thêm nhiều mục); mỗi mục có nội dung, liên kết tới tiêu chí hoặc giấy tờ (danh sách chọn), ghi chú; hạn bổ sung (chọn ngày); nút Gửi yêu cầu. Xem trước thông báo mà chủ thể sẽ nhận.
- **Trạng thái:** chưa có mục nào thì không gửi được; gửi thành công hiện toast và đổi trạng thái hồ sơ.
- **Ghi chú:** dùng chung cho cán bộ Sở khi trả hồ sơ về xã theo đề nghị của Tổ tư vấn; khi đó hộp thoại ghi rõ "Trả về xã", chọn xã và ghi nhận xét.

#### S25. Lập biên bản và gửi lên tỉnh
**Chức năng:** XA-07, XA-08 · **Luồng:** L06
- **Mục đích:** gộp các hồ sơ đạt sơ bộ thành gói gửi tỉnh theo đợt.
- **Bố cục:** ba cột trên máy tính: danh sách hồ sơ đạt sơ bộ (có ô chọn); xem trước biên bản và văn bản đề xuất (sinh từ mẫu); cột thao tác cuối.
- **Thành phần:** chọn Đợt gửi (hiển thị hạn gửi và đếm ngược); bảng hồ sơ kèm ô chọn; khung xem trước tài liệu; nút "Tải bản nháp (Word, PDF)"; vùng "Tải lên bản đã ký" (sau khi ký số ngoài hệ thống); nút "Gửi lên tỉnh".
- **Hộp thoại xác nhận:** nêu số hồ sơ, đợt, thông báo sẽ gửi tới Sở và chủ thể.
- **Trạng thái:** quá hạn gửi của đợt (cảnh báo, gợi ý chuyển sang đợt kế tiếp), chưa tải lên bản đã ký (cho phép gửi nếu cơ quan chấp nhận, kèm cảnh báo; cần xác nhận quy trình).

### 5.4 Nhóm Sở NN&MT

#### S30. Trang chủ Sở NN&MT
**Chức năng:** SO-01, SO-02 · **Luồng:** L07, L08
- **Mục đích:** tổng quan đợt đánh giá của tỉnh.
- **Bố cục:** thẻ đợt hiện tại ở trên cùng (tên đợt, giai đoạn, các mốc hạn); hàng thẻ số liệu; biểu đồ phễu hồ sơ; danh sách việc cần xử lý.
- **Thành phần:** thẻ mốc thời gian (hạn nộp xã, hạn đánh giá tỉnh); thẻ số hồ sơ chờ tiếp nhận, đang thẩm định, đang chấm, đã chốt; việc cần xử lý (hồ sơ chờ tiếp nhận, hồ sơ từ 90 điểm chờ xuất gói 5 sao).
- **Trạng thái:** chưa có đợt nào (nút "Tạo đợt").

#### S31. Quản lý đợt đánh giá
**Chức năng:** SO-01, AD-06 · **Luồng:** L07
- **Mục đích:** tạo, mở, đóng, kết thúc đợt.
- **Bố cục:** danh sách đợt ở trái hoặc trên; chi tiết và biểu mẫu ở phải (ngăn trượt).
- **Thành phần biểu mẫu:** Tên đợt, Năm, Hạn nộp của xã, Hạn đánh giá của tỉnh, Chế độ chấm (Trực tiếp hoặc Dựa trên Tổ tư vấn), Phiên bản bộ tiêu chí áp dụng (danh sách chọn các phiên bản đã phát hành), Ghi chú. Dòng thời gian trạng thái của đợt: Soạn thảo, Đang mở, Đã đóng nhận hồ sơ, Đang chấm, Kết thúc. Nút theo trạng thái: Mở đợt, Gia hạn (ghi lý do), Kết thúc đợt.
- **Trạng thái:** kiểm tra hạn hợp lệ và không chồng lấn đợt khác (lỗi hiển thị cạnh trường); đợt đã mở: khóa trường phiên bản tiêu chí và chế độ chấm; xác nhận khi Mở đợt (nêu sẽ thông báo cho các xã và chủ thể).

#### S32. Danh sách hồ sơ toàn tỉnh
**Chức năng:** SO-02, DC-04 · **Luồng:** L08
- **Mục đích:** tiếp nhận và theo dõi hồ sơ từ các xã.
- **Bố cục:** bảng dữ liệu với chip lọc nhanh theo trạng thái; ngăn bộ lọc nâng cao.
- **Thành phần:** cột mã hồ sơ, sản phẩm, chủ thể, xã/phường, nhóm sản phẩm, đợt, trạng thái, bước đang xử lý, điểm (khi có), hạn; hành động hàng loạt: "Tiếp nhận", "Trả về xã" (mở S24), "Xuất Excel"; liên kết "Chờ tiếp nhận" lọc sẵn.
- **Trạng thái:** trống, lọc không có kết quả.

#### S33. Chi tiết hồ sơ tại tỉnh
**Chức năng:** SO-02 · **Luồng:** L08
- Giống S22 về cấu trúc tab (Tổng quan, Minh chứng, Biên bản sơ bộ của xã, Lịch sử) và có thêm tab "Thẩm định và chấm điểm" chỉ đọc cho Sở (hiển thị trạng thái, không hiển thị điểm từng thành viên).
- **Hành động:** Tiếp nhận, Trả về xã (ghi lý do), Phân công (mở S41).
- **Trạng thái:** hồ sơ đang trong chế độ chấm nào hiển thị rõ bằng chip.

#### S34. Hồ sơ 5 sao: xuất gói hồ sơ
**Chức năng:** SO-04 · **Luồng:** L17
- **Mục đích:** hỗ trợ Sở xuất gói hồ sơ đề nghị 5 sao và đánh dấu trạng thái. Việc gửi đánh giá và nhận kết quả làm bằng văn bản ngoài hệ thống; Bộ NN&MT không dùng hệ thống.
- **Bố cục:** một bảng "Đề xuất 5 sao" (hồ sơ từ ngưỡng 90 điểm, trạng thái Đã chốt hoặc Đã gửi đề nghị 5 sao); thanh hành động cho hàng được chọn; ngăn chi tiết bên phải hiển thị nội dung gói hồ sơ.
- **Thành phần:** nút "Xuất gói hồ sơ (ZIP hoặc PDF)" cho hàng được chọn (gói gồm hồ sơ sản phẩm, minh chứng, báo cáo đánh giá của Tổ tư vấn, báo cáo đánh giá của Hội đồng, quyết định phê duyệt kết quả của Chủ tịch UBND tỉnh, bảng điểm, bản nháp văn bản đề nghị của UBND tỉnh); danh sách kiểm tra "Nội dung trong gói"; hộp thoại "Đánh dấu đã gửi" (số công văn và ngày gửi tùy chọn); khi hồ sơ ở trạng thái Đã gửi đề nghị 5 sao hiện hai thao tác: "Chuyển về công nhận cấp tỉnh" (dẫn tới S45) và "Đóng hồ sơ" (ghi chú, tệp văn bản kết quả tùy chọn).
- **Trạng thái:** chưa có hồ sơ đủ điều kiện (trống); thiếu tài liệu bắt buộc trong gói (cảnh báo, vẫn cho xuất kèm danh sách thiếu).
- **Ghi chú:** nêu rõ trên giao diện rằng bước gửi hồ sơ và nhận kết quả thực hiện ngoài hệ thống. Sản phẩm mẫu và văn bản gốc nộp ngoài hệ thống.

#### S35. Thống kê và xuất báo cáo
**Chức năng:** SO-06, DC-05 · **Luồng:** L22 · Đợt 2
- **Mục đích:** theo dõi tiến độ và kết quả theo đợt, xuất báo cáo.
- **Bố cục:** thanh bộ lọc cố định ở trên (đợt, nhóm sản phẩm, đơn vị, hạng); hàng thẻ chỉ số; lưới biểu đồ; bảng chi tiết ở dưới; nút xuất Excel, PDF.
- **Thành phần:** chỉ số (tổng hồ sơ, tỷ lệ đạt, số hồ sơ 3 sao, 4 sao và số hồ sơ đề nghị 5 sao, thời gian xử lý trung bình); biểu đồ cột hồ sơ theo trạng thái; biểu đồ theo nhóm sản phẩm; biểu đồ theo xã/phường; phân bố điểm A, B, C; bảng chi tiết có thể sắp xếp.
- **Trạng thái:** chưa đủ dữ liệu (hiện khung trống kèm gợi ý đổi bộ lọc); cán bộ xã chỉ thấy phạm vi xã của mình.

### 5.5 Nhóm Hội đồng đánh giá cấp tỉnh

#### S40. Quản lý hội đồng
**Chức năng:** HD-01 · **Luồng:** L09
- **Mục đích:** lập và quản lý danh sách hội đồng.
- **Bố cục:** thẻ thông tin hội đồng ở trên; bảng thành viên ở dưới.
- **Thành phần:** thông tin Hội đồng và Tổ tư vấn (tên, đợt, quyết định thành lập Hội đồng và Tổ tư vấn: số, ngày, tệp tải lên), chủ tịch và thư ký (nhãn vai trò), bảng thành viên với hai tab Hội đồng và Tổ tư vấn (họ tên, chức vụ, đơn vị, chuyên môn, vai trò trong Hội đồng hoặc Tổ tư vấn, trạng thái tài khoản và 2FA); nút "Thêm thành viên" (chọn từ tài khoản có sẵn hoặc đề nghị quản trị tạo mới), "Đề nghị phê duyệt" (gửi Chủ tịch UBND tỉnh hoặc người được ủy quyền xác nhận bằng văn bản), nhãn "Chưa bật 2FA" cảnh báo.
- **Trạng thái:** số thành viên tối thiểu theo cấu hình (cảnh báo khi chưa đủ), đã phê duyệt (khóa danh sách, sửa phải ghi lý do).

#### S41. Phân công hồ sơ và chọn chế độ chấm
**Chức năng:** HD-02, HD-03, HD-06 · **Luồng:** L09
- **Mục đích:** gán Tổ tư vấn và thành viên cho từng hồ sơ; chọn chế độ chấm của đợt.
- **Bố cục:** thanh trên có chế độ chấm của đợt (công tắc phân đoạn: Chấm trực tiếp, Dựa trên Tổ tư vấn); ma trận hồ sơ × người chấm bên dưới; ngăn phải hiển thị chi tiết hồ sơ được chọn.
- **Thành phần:** mỗi hàng là một hồ sơ (mã, sản phẩm, nhóm); cột "Tổ tư vấn phụ trách" (chọn người); các cột thành viên (ô chọn hoặc nhãn "Phân công"); chip tải công việc của mỗi người; hành động hàng loạt "Phân công theo nhóm sản phẩm", "Phân công ngẫu nhiên cân bằng"; bộ kiểm tra số thành viên tối thiểu mỗi hồ sơ (viền cảnh báo).
- **Trạng thái:** đổi chế độ chấm sau khi đã có phiếu: bị khóa, hiển thị lý do; xung đột lợi ích: thư ký thay người, hệ thống ghi chú lý do vào hồ sơ.

#### S42. Tiến độ chấm của đợt
**Chức năng:** HD-04 · **Luồng:** L15
- **Mục đích:** thư ký theo dõi ai đã xác nhận phiếu.
- **Bố cục:** bảng hồ sơ × thành viên dạng ma trận trạng thái; thanh tổng hợp ở trên.
- **Thành phần:** ô hiển thị trạng thái phiếu (Chưa mở, Đang xem xét, Đã xác nhận) nhưng không hiển thị giá trị điểm; cột trạng thái hồ sơ (Đang chấm, Sẵn sàng chốt); thanh tiến độ tổng; cờ "Lệch điểm lớn" chỉ xuất hiện khi hồ sơ đủ phiếu; nút "Nhắc thành viên chưa xác nhận" (gửi thông báo).
- **Quy tắc:** trước khi đủ phiếu, thư ký không thấy điểm của thành viên (cần xác nhận quy chế).

#### S43. Tổng hợp điểm và chốt
**Chức năng:** HD-04, HD-05, HD-08 · **Luồng:** L15
- **Mục đích:** hội đồng họp, xem điểm tổng hợp, chốt điểm.
- **Bố cục:** hai vùng. Vùng chính là bảng so sánh: hàng là tiêu chí (nhóm theo Phần A, B, C); cột là từng thành viên, cột "Đề xuất Tổ tư vấn", cột "Tổng hợp". Vùng phải (hoặc dưới) là bảng điều khiển hạng.
- **Thành phần:** ô điểm thành viên (ô khác điểm của Tổ tư vấn có đánh dấu cam; ô lệch lớn giữa các thành viên có đánh dấu đỏ nhạt); hàng tổng theo phần và tổng chung; khối "Gợi ý hạng" (số sao, ngưỡng đang áp dụng, khoảng cách tới ngưỡng gần nhất); lý do điều chỉnh của thành viên hiện khi di chuột hoặc bấm vào ô; khung nhận xét tổng hợp của hội đồng; thanh chọn hồ sơ trước sau; nút "Chốt điểm".
- **Hộp thoại chốt (kiểu nguy hiểm):** nêu "Sau khi chốt, điểm bị khóa và không sửa được trên giao diện", hiển thị hạng gợi ý, yêu cầu gõ "CHỐT" hoặc xác thực lại.
- **Trạng thái:** chưa đủ phiếu (bảng hiện cảnh báo và nút chốt bị vô hiệu), đã chốt (băng khóa ở đầu màn hình, mọi ô chỉ đọc, hiển thị người chốt và thời gian).
- **Ghi chú:** việc mở khóa không có nút trên giao diện này; xử lý ngoài giao diện thông thường (xem luồng L15).

#### S44. Biên bản và quyết định
**Chức năng:** HD-09 · **Luồng:** L15
- **Mục đích:** sinh bảng tổng hợp, biên bản, quyết định từ mẫu và quản lý bản đã ký.
- **Bố cục:** danh sách tài liệu theo đợt ở trái; khung xem trước ở giữa; thao tác ở phải.
- **Thành phần:** loại tài liệu (Bảng tổng hợp điểm, Biên bản họp, Quyết định công nhận), mẫu áp dụng (xem S73), nút "Sinh từ mẫu", xem trước, "Tải Word", "Tải PDF", vùng "Tải lên bản đã ký", lịch sử phiên bản (khi chốt lại sau mở khóa), chip trạng thái (Nháp, Đã ký).
- **Trạng thái:** chưa chốt điểm thì chỉ sinh được bản nháp; có thông báo "Chưa chốt toàn bộ hồ sơ của đợt".

#### S45. Cấp giấy chứng nhận và gửi kết quả
**Chức năng:** HD-10, HD-11, HD-12 · **Luồng:** L16
- **Mục đích:** cấp giấy chứng nhận 3, 4 sao; gửi kết quả cho sản phẩm không đạt.
- **Bố cục:** ba tab: Chờ cấp chứng nhận, Đã cấp, Không đạt.
- **Thành phần tab Chờ cấp:** bảng hồ sơ (sản phẩm, hạng, số hiệu dự kiến); nút "Sinh giấy chứng nhận" (hàng loạt được); khung xem trước chứng nhận (mẫu PDF, có vị trí mã QR ở Đợt 2); nút "Tải lên bản đã ký"; nút "Công bố cho chủ thể" (gửi thông báo, cho phép tải).
- **Tab Không đạt:** bảng hồ sơ; khung soạn thư kết quả (điểm theo nhóm, nhận xét, tiêu chí cần cải thiện, được điền sẵn); nút "Gửi cho chủ thể".
- **Tab Đã cấp:** bảng giấy chứng nhận (số hiệu, ngày cấp, hạng, trạng thái hiệu lực), tải PDF.
- **Trạng thái:** số hiệu được cấp tự động theo bộ đếm; lỗi trùng số hiệu hiển thị rõ; hồ sơ được chuyển về công nhận cấp tỉnh từ S34 xuất hiện ở tab Chờ cấp kèm nhãn nguồn.

### 5.6 Nhóm Tổ tư vấn

#### S50. Hàng đợi thẩm định
**Chức năng:** TM-01 · **Luồng:** L10
- **Mục đích:** thành viên Tổ tư vấn thấy các hồ sơ được giao.
- **Bố cục:** bảng dữ liệu có sắp theo hạn; chip lọc Chưa bắt đầu, Đang thẩm định, Đã phát hành.
- **Thành phần:** mã, sản phẩm, nhóm sản phẩm, đợt, người phân công, hạn xử lý (đếm ngược), chip trạng thái báo cáo Tổ tư vấn (Chưa bắt đầu, Nháp, Đã phát hành phiên bản N); nút "Bắt đầu thẩm định" hoặc "Tiếp tục".
- **Trạng thái:** trống, nhiều hồ sơ quá hạn (đánh dấu đỏ).

#### S51. Thẩm định và chấm điểm đề xuất
**Chức năng:** TM-02, TM-05, TM-06 · **Luồng:** L10
- **Mục đích:** rà soát minh chứng và nhập điểm đề xuất kèm căn cứ.
- **Bố cục:** khung hai bên (mục 3.9). Trái: tab Thông tin hồ sơ, Minh chứng (nhóm theo tiêu chí, xem nhanh qua S91), Biên bản sơ bộ của xã. Phải: biểu mẫu chấm theo tiêu chí (nhóm theo Phần A, B, C). Thanh cố định ở cuối: tổng điểm theo phần và tổng chung, "Lưu nháp", "Chuyển sang soạn báo cáo Tổ tư vấn" (S52).
- **Thành phần mỗi tiêu chí (bên phải):** tên, điểm tối đa, ô điểm đề xuất (mục 3.4), ô "Căn cứ" (văn bản, bắt buộc khi có điểm), "Viện dẫn minh chứng" (chọn từ các tệp đã gắn tiêu chí, hiển thị chip tên tệp), cờ đánh dấu "Thiếu minh chứng", "Cần xác minh", "Lưu ý cho hội đồng".
- **Trạng thái:** thiếu căn cứ (báo lỗi khi chuyển bước), phát hiện thiếu hồ sơ nghiêm trọng (nút "Đề nghị Sở trả về xã": mở hộp thoại ghi lý do gửi Sở, không tự trả trực tiếp), tự lưu nháp mỗi vài giây.

#### S52. Soạn và phát hành báo cáo Tổ tư vấn
**Chức năng:** TM-06, TM-07, TM-12 · **Luồng:** L11
- **Mục đích:** hoàn thiện nhận xét tổng hợp và phát hành báo cáo Tổ tư vấn cho hội đồng.
- **Bố cục:** trái là bản xem trước báo cáo Tổ tư vấn (điểm theo tiêu chí, căn cứ, nhận xét tổng hợp); phải là khung soạn và thao tác.
- **Thành phần:** nhận xét tổng hợp (văn bản dài), danh sách "Điểm cần hội đồng lưu ý" (thêm nhiều dòng, gắn tiêu chí), bảng kiểm tra trước phát hành (đủ điểm và căn cứ mọi tiêu chí), nhãn phiên bản (Nháp, Phiên bản N đã phát hành), nút "Phát hành báo cáo Tổ tư vấn" (dành cho tổ trưởng hoặc người được giao), lịch sử phiên bản (so sánh nhanh giữa các phiên bản).
- **Hộp thoại phát hành:** nêu "Báo cáo Tổ tư vấn sẽ bị khóa thành phiên bản N, thành viên được phân công sẽ nhận thông báo".
- **Phân quyền hiển thị (TM-12):** không hiển thị bất kỳ nút nào cho phép chốt điểm hoặc quyết định công nhận; nếu thành viên đã xác nhận phiếu, nút sửa bị ẩn.
- **Trạng thái:** chỉnh sau khi phát hành tạo "Phiên bản N+1" (bắt buộc ghi lý do sửa).

#### S53. Sao chép sang phiếu chấm
**Chức năng:** TM-08, TM-09 · **Luồng:** L12
- **Mục đích:** đưa dữ liệu báo cáo Tổ tư vấn vào phiếu chấm của thành viên.
- **Bố cục:** trình hướng dẫn 3 bước: (1) Chọn hồ sơ và phiên bản, (2) Chọn phạm vi và người nhận, (3) Xem trước và xác nhận.
- **Bước 1:** bảng hồ sơ đã có báo cáo Tổ tư vấn phát hành (chọn nhiều), cột phiên bản, trạng thái sao chép (Chưa, Đã sao chép phiên bản N).
- **Bước 2:** phạm vi (Toàn bộ, hoặc Chọn tiêu chí bằng danh sách ô chọn nhóm theo Phần A, B, C); người nhận (Tất cả thành viên được phân công, hoặc chọn từng người).
- **Bước 3 (xem trước):** bảng hồ sơ × thành viên, mỗi ô nêu kết quả dự kiến: "Phiếu mới sẽ được điền sẵn", "Cập nhật phiếu chưa chỉnh", "Bỏ qua: thành viên đã chỉnh hoặc đã xác nhận" (màu cảnh báo, giải thích lý do); tóm tắt: bao nhiêu phiếu mới, cập nhật, bỏ qua; nút "Xác nhận sao chép".
- **Màn kết quả:** thông báo thành công, danh sách phiếu bị bỏ qua (để Tổ tư vấn biết và liên hệ), nút "Nhắc thành viên".
- **Trạng thái:** chế độ chấm của đợt là "trực tiếp" thì cả màn bị ẩn khỏi menu; thành viên bị loại do xung đột lợi ích hiển thị nhãn và bị bỏ qua.
- **Quy tắc:** sao chép là một chiều; hệ thống lưu giá trị gốc và ghi nhật ký (xem S74).

### 5.7 Nhóm Thành viên hội đồng

#### S60. Hồ sơ được phân công
**Chức năng:** TV-01 · **Luồng:** L13, L14
- **Mục đích:** thành viên thấy việc của mình.
- **Bố cục:** danh sách thẻ hoặc bảng; chip lọc Chưa xem xét, Đang xem xét, Đã xác nhận.
- **Thành phần:** mã, sản phẩm, nhóm sản phẩm, chip báo cáo Tổ tư vấn (Có báo cáo Tổ tư vấn N, Chưa có), chip trạng thái phiếu, hạn của đợt; nút "Mở phiếu chấm".
- **Quy tắc:** chỉ thấy các hồ sơ được phân công.
- **Trạng thái:** trống, nhiều hồ sơ chưa xem xét gần hạn (nhắc nhẹ trên đầu trang).

#### S61. Phiếu chấm
**Chức năng:** TV-02, TV-03, TV-04, TV-06, TV-07 · **Luồng:** L13, L14
- **Mục đích:** thành viên xem xét báo cáo Tổ tư vấn, điều chỉnh điểm nếu cần, hoặc chấm trực tiếp, rồi xác nhận.
- **Bố cục:** khung hai bên (mục 3.9). Trái: tab Báo cáo Tổ tư vấn (chỉ có ở chế độ dựa trên Tổ tư vấn), Minh chứng, Thông tin hồ sơ. Phải: phiếu chấm theo tiêu chí (nhóm theo Phần A, B, C). Thanh cố định ở cuối: tổng điểm theo phần và tổng chung, so sánh với tổng điểm đề xuất của Tổ tư vấn, "Lưu nháp", "Xác nhận phiếu".
- **Chế độ dựa trên Tổ tư vấn (mặc định):** mỗi tiêu chí hiển thị ô điểm đã điền sẵn kèm huy hiệu "Từ Tổ tư vấn (phiên bản N)" (mục 3.5); căn cứ của Tổ tư vấn hiển thị gập mở bên dưới ô điểm. Khi thành viên đổi điểm: huy hiệu chuyển thành "Đã chỉnh", hiển thị giá trị gốc của Tổ tư vấn cạnh ô, và xuất hiện ô "Lý do điều chỉnh" bắt buộc. Thành viên có nút "Khôi phục theo Tổ tư vấn" cho từng tiêu chí.
- **Chế độ chấm trực tiếp:** ô điểm trống, không có tab báo cáo Tổ tư vấn, không có huy hiệu; vẫn có ô nhận xét và vùng đính kèm bằng chứng kiểm tra.
- **Thành phần chung:** nhận xét từng tiêu chí (tùy chọn), nhận xét chung, tệp đính kèm bằng chứng kiểm tra, banner khi có báo cáo Tổ tư vấn phiên bản mới ("Có phiên bản mới của báo cáo Tổ tư vấn, phiếu của bạn không bị thay đổi").
- **Trạng thái:** điểm vượt khung hoặc thiếu lý do (viền đỏ tại ô, không cho xác nhận), đã xác nhận (băng khóa ở đầu màn hình, mọi ô chỉ đọc), không thấy điểm của thành viên khác ở bất kỳ vị trí nào trên màn hình này.
- **Ghi chú thiết kế:** đây là màn hình được dùng nhiều nhất và quan trọng nhất của thành viên; ưu tiên tốc độ rà soát (phím Tab giữa các ô điểm, phím tắt mở nhanh minh chứng).

#### S62. Xác nhận phiếu chấm (OTP)
**Chức năng:** TV-05 · **Luồng:** L13
- **Mục đích:** xác nhận phiếu với xác thực lại.
- **Bố cục:** hộp thoại giữa màn hình.
- **Thành phần:** tóm tắt nhanh ("Giữ nguyên 14 tiêu chí, điều chỉnh 4 tiêu chí", tổng điểm), danh sách các tiêu chí đã chỉnh kèm lý do (xem lại), ô nhập mã OTP 6 số, nút "Xác nhận phiếu".
- **Trạng thái:** mã sai (báo lỗi, giới hạn số lần thử), mã hết hạn.
- **Hậu quả được nêu rõ:** "Phiếu sẽ bị khóa. Muốn sửa phải có yêu cầu từ hội đồng."

#### S63. Điểm tổng hợp sau khi đủ phiếu
**Chức năng:** TV-08 · **Luồng:** L15
- **Mục đích:** thành viên xem điểm tổng hợp để họp thống nhất.
- **Bố cục:** tương tự bảng so sánh của S43 nhưng chỉ đọc, không có nút chốt.
- **Thành phần:** bảng điểm theo tiêu chí và theo thành viên, cột đề xuất của Tổ tư vấn, điểm tổng hợp, gợi ý hạng, ô lệch điểm đánh dấu.
- **Trạng thái:** chưa đủ phiếu (hiện thông báo "Điểm của các thành viên khác sẽ hiển thị khi hồ sơ đủ phiếu xác nhận", không hiển thị giá trị nào); đã chốt (băng khóa).
- **Quy tắc:** chỉ hiển thị khi hồ sơ ở trạng thái "Sẵn sàng chốt" hoặc "Đã chốt" (cần xác nhận quy chế).

### 5.8 Nhóm Quản trị hệ thống

#### S70. Tài khoản và vai trò
**Chức năng:** AD-01, AD-02, DC-09 · **Luồng:** L20
- **Mục đích:** tạo tài khoản cán bộ, gán vai trò và phạm vi.
- **Bố cục:** bảng tài khoản với bộ lọc; ngăn chi tiết bên phải.
- **Thành phần:** bảng (họ tên, đơn vị, vai trò, phạm vi, trạng thái, 2FA); ngăn chi tiết có: thông tin, danh sách vai trò (chủ thể, cán bộ xã, lãnh đạo xã, cán bộ Sở, thư ký, chủ tịch hội đồng, Tổ tư vấn, Tổ trưởng Tổ tư vấn, thành viên, quản trị) gán nhiều vai trò, phạm vi dữ liệu (xã/phường, tỉnh, đợt), cấu hình riêng cho vai trò Tổ tư vấn (quyền sao chép dữ liệu, quy tắc không ghi đè phiếu đã chỉnh hoặc đã xác nhận); nút Khóa tài khoản, Đặt lại mật khẩu, Đặt lại 2FA; lịch sử cấp quyền.
- **Trạng thái:** cảnh báo khi gán vai trò xung đột (một người vừa là thành viên Tổ tư vấn vừa là thành viên chấm cùng hồ sơ); tài khoản hội đồng và quản trị chưa bật 2FA được đánh dấu.

#### S71. Danh sách phiên bản bộ tiêu chí
**Chức năng:** AD-04 · **Luồng:** L19
- **Mục đích:** quản lý các phiên bản bộ tiêu chí.
- **Bố cục:** bảng phiên bản.
- **Thành phần:** tên phiên bản, văn bản căn cứ, ngày hiệu lực, trạng thái (Nháp, Đã phát hành), số đợt đang dùng, ngày phát hành; hành động: Mở, Tạo phiên bản mới từ bản này, Xóa (chỉ bản nháp chưa dùng).
- **Trạng thái:** phiên bản đã phát hành hiển thị biểu tượng khóa.

#### S72. Trình soạn bộ tiêu chí
**Chức năng:** AD-03, AD-04, AD-05 · **Luồng:** L19
- **Mục đích:** cấu hình cấu trúc, điểm và ngưỡng hạng của bộ tiêu chí.
- **Bố cục:** ba vùng. Trái: cây cấu trúc (Phiên bản → Nhóm sản phẩm → Phần A, B, C → Tiêu chí) có kéo thả sắp xếp. Giữa: biểu mẫu chỉnh phần tử đang chọn. Phải: bảng kiểm tra và ngưỡng hạng.
- **Thành phần (biểu mẫu tiêu chí):** mã, tên, mô tả cách đánh giá, điểm tối đa, minh chứng yêu cầu (danh sách), mức điểm gợi ý (tùy chọn). Biểu mẫu phần: tên, tổng điểm tối đa. Khối ngưỡng hạng: các ngưỡng cho 3, 4, 5 sao và quy tắc tính điểm tổng hợp (ví dụ trung bình). Khối kiểm tra: tổng điểm tối đa của từng nhóm sản phẩm (phải bằng tổng cấu hình), tiêu chí trùng mã, tiêu chí thiếu mô tả; mỗi lỗi bấm vào dẫn tới phần tử.
- **Hành động:** "Chạy thử" (mở xem trước phiếu chấm với dữ liệu mẫu), "Phát hành phiên bản" (hộp thoại nguy hiểm: nêu "Phiên bản phát hành là bất biến, muốn đổi phải tạo phiên bản mới").
- **Trạng thái:** phiên bản đã phát hành là chỉ đọc (băng thông báo kèm nút "Tạo phiên bản mới từ bản này"); thay đổi chưa lưu có cảnh báo khi rời màn hình.
- **Ghi chú thiết kế:** mỗi nhóm sản phẩm có thể có bộ tiêu chí riêng (ví dụ du lịch cộng đồng); cần cách chuyển nhóm sản phẩm nhanh và so sánh bộ tiêu chí giữa các nhóm.

#### S73. Danh mục và mẫu văn bản
**Chức năng:** AD-06 · **Luồng:** L07, L09
- **Mục đích:** quản lý danh mục dùng chung.
- **Bố cục:** các tab: Nhóm sản phẩm, Xã/phường, Mẫu văn bản.
- **Thành phần:** Nhóm sản phẩm (6 nhóm, sắp xếp, bật tắt); Xã/phường của tỉnh (mã, tên, ngày hiệu lực, tên cũ khi sáp nhập); Mẫu văn bản (loại: biên bản sơ bộ, văn bản đề xuất, bảng tổng hợp, biên bản họp, quyết định, giấy chứng nhận, thư kết quả; tải lên mẫu Word hoặc PDF, danh sách trường tự điền, xem trước, phiên bản mẫu).
- **Trạng thái:** mẫu đang được dùng bởi đợt đang mở: sửa tạo phiên bản mới, không ảnh hưởng tài liệu đã sinh.
- **Ghi chú:** phần quản lý mẫu văn bản là giả định của bản mô tả này để phục vụ việc sinh biên bản từ mẫu; cần xác nhận phạm vi.

#### S74. Nhật ký hoạt động
**Chức năng:** AD-08, AD-09 · **Luồng:** L21
- **Mục đích:** tra cứu mọi thao tác quan trọng để kiểm tra.
- **Bố cục:** thanh bộ lọc ở trên; bảng nhật ký; ngăn chi tiết bên phải.
- **Thành phần:** bộ lọc người dùng, hành động, loại đối tượng, hồ sơ, khoảng thời gian; chip lọc nhanh "Sao chép dữ liệu Tổ tư vấn", "Chốt điểm", "Mở khóa", "Thay đổi quyền"; bảng (thời gian, người dùng, hành động, đối tượng, địa chỉ IP); ngăn chi tiết hiển thị giá trị trước và sau theo dạng so sánh; với sao chép dữ liệu của Tổ tư vấn hiển thị phiên bản nguồn, người nhận, điểm gốc của Tổ tư vấn bên cạnh điểm thành viên xác nhận; nút xuất Excel.
- **Trạng thái:** nhật ký chỉ đọc, không có thao tác sửa hay xóa trên giao diện.

### 5.9 Nhóm Công khai

#### S80. Trang xác thực mã QR
**Chức năng:** CK-02 · **Luồng:** L18 · Đợt 2
- **Mục đích:** người dùng quét mã QR trên sản phẩm hoặc giấy chứng nhận để kiểm tra tính xác thực.
- **Bố cục:** một cột, mobile-first, không cần đăng nhập, không có menu phức tạp; logo hệ thống và tên tỉnh ở đầu.
- **Biến thể kết quả:**
  - **Hợp lệ:** dấu tích lớn màu xanh, "Giấy chứng nhận hợp lệ", hạng sao, tên sản phẩm, ảnh sản phẩm, tên chủ thể, xã/phường, số hiệu, ngày cấp, hiệu lực.
  - **Hết hiệu lực:** cảnh báo màu cam, nêu ngày hết hiệu lực.
  - **Không xác thực được:** màu đỏ, nêu "Mã không hợp lệ hoặc không có trong hệ thống", hướng dẫn liên hệ Sở.
- **Quy tắc:** không hiển thị điểm chi tiết hay thông tin cá nhân; có nút "Báo cáo nghi vấn" (tùy chọn, giai đoạn sau, không bắt buộc ở bản đầu).
- **Hiệu năng:** tải nhanh trên mạng di động chậm.

---

## 6. Phụ lục

### 6.1 Dữ liệu mẫu để dựng bản mẫu (dữ liệu hư cấu)

| Đối tượng | Giá trị |
|---|---|
| Tỉnh | Tỉnh Mẫu |
| Sở | Sở Nông nghiệp và Môi trường Tỉnh Mẫu |
| Xã/phường | Xã An Phú, Xã Bình Thạnh, Phường Tân Hòa |
| Chủ thể | HTX Nông sản Xanh An Phú; Cơ sở Mắm Bà Sáu; Công ty TNHH Trà Thảo Mộc |
| Sản phẩm | Mắm cá linh khô; Trà thảo mộc túi lọc; Nón lá làng nghề |
| Đợt | Đợt đánh giá 2026 (hạn nộp xã: 30/04/2026; hạn tỉnh: 30/06/2026) |
| Mã hồ sơ | HS-2026-0123, HS-2026-0124 |
| Điểm minh họa | A: 32/40; B: 18/25; C: 28/35; tổng 78 điểm; hạng 4 sao |
| Số hiệu chứng nhận | OCOP-TM-2026-0042 |
| Thành viên hội đồng | Ông Nguyễn Văn A (chủ tịch), Bà Trần Thị B (thư ký), Ông Lê Văn C, Bà Phạm Thị D |
| Thành viên Tổ tư vấn | Bà Hoàng Thị E (tổ trưởng), Ông Vũ Văn F |

Số điểm tối đa của từng phần (40, 25, 35) là số liệu tạm dùng để dựng bản mẫu và cần đối chiếu Phụ lục QĐ 26/2026/QĐ-TTg. Giao diện phải lấy từ cấu hình, không viết cứng.

### 6.2 Thứ tự thiết kế đề xuất

1. Hệ thống thành phần dùng chung (mục 3): chip trạng thái, dòng thời gian, ô nhập điểm, bảng dữ liệu, tải tệp, hộp thoại xác nhận, khung hai bên.
2. Khung ứng dụng và xác thực: S00, S01, S02, S03, S04, S92.
3. Luồng chủ thể trên di động: S10 đến S19.
4. Luồng cán bộ xã: S20 đến S25.
5. Luồng Tổ tư vấn và thành viên (trọng tâm khác biệt): S50, S51, S52, S53, S60, S61, S62, S63.
6. Luồng Sở và hội đồng: S30 đến S35, S40 đến S45.
7. Quản trị: S70 đến S74.
8. Tìm kiếm, xem trước tệp: S90, S91.
9. Công khai: S80 (Đợt 2).

### 6.3 Sản phẩm bàn giao mong đợi từ bước thiết kế

- Thành phần giao diện dùng chung có đủ trạng thái (mặc định, di chuột, tập trung, vô hiệu, lỗi).
- Mẫu màn hình cho từng màn ở mục 4, bản máy tính và bản di động (với các màn đánh dấu di động).
- Luồng bấm chuyển (prototype) cho ba hành trình: chủ thể nộp hồ sơ và bổ sung; Tổ tư vấn thẩm định rồi sao chép; thành viên điều chỉnh và xác nhận phiếu.
- Hướng dẫn nhận diện ngắn: màu, chữ, khoảng cách, biểu tượng, cách dùng hạng sao.
- Ghi chú các điểm đã giả định để nhóm nghiệp vụ xác nhận.

### 6.4 Điểm cần xác nhận ảnh hưởng đến giao diện

1. Phân bổ điểm Phần A, B, C và ngưỡng từng hạng (ảnh hưởng S14, S15, S43, S72).
2. Quy chế hội đồng: số thành viên chấm mỗi hồ sơ, thành viên có xem điểm của nhau trước khi chốt hay không (S42, S43, S63).
3. Vai trò và thẩm quyền của Tổ tư vấn (thành lập cùng Hội đồng theo QĐ 1489; báo cáo của Tổ tư vấn có bắt buộc trước khi Hội đồng họp hay không); tổ trưởng có phát hành riêng hay mọi cán bộ đều phát hành được (S50 đến S53).
4. Quy trình ký số văn bản: ký ngoài hệ thống rồi tải lên (S25, S44, S45) hay tích hợp sau này.
5. Có yêu cầu nội dung cam kết ở bước nộp hồ sơ không (S16).
6. Phạm vi quản lý mẫu văn bản trong hệ thống (S73).
7. Màn hình công khai có cần nút báo cáo nghi vấn hay không (S80).
