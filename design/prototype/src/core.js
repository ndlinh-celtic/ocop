/* OCOP prototype core: dữ liệu mẫu, thành phần dùng chung, bộ định tuyến, khung ứng dụng.
   Màn hình đăng ký bằng OCOP.screen(id, def). Mọi hàm thành phần trả về chuỗi HTML. */
(function () {
  const O = (window.OCOP = { screens: {}, order: [] });

  /* ---------- tiện ích ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 0) => Number(n).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });
  const cls = (...a) => a.filter(Boolean).join(' ');
  O.esc = esc; O.fmt = fmt; O.cls = cls;

  /* Biểu tượng: dùng tên Lucide (kebab-case). Bộ SVG được nhúng sẵn trong ICONS khi build. */
  O.icon = function icon(name, extra = '') {
    const p = (window.ICONS || {})[name];
    return `<span class="ic ${extra}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p || ''}</svg></span>`;
  };
  const ic = O.icon;

  /* ---------- dữ liệu mẫu (hư cấu, theo phụ lục 6.1) ---------- */
  const D = (O.data = {});
  D.tinh = 'Tỉnh Mẫu';
  D.so = 'Sở Nông nghiệp và Môi trường Tỉnh Mẫu';
  D.xa = ['Xã An Phú', 'Xã Bình Thạnh', 'Phường Tân Hòa', 'Xã Long Điền', 'Xã Phú Hữu'];
  D.nhom = ['Thực phẩm', 'Đồ uống', 'Dược liệu và sản phẩm từ dược liệu', 'Thủ công mỹ nghệ', 'Cây cảnh và cảnh quan', 'Du lịch cộng đồng, du lịch sinh thái và điểm du lịch'];
  D.dot = { ten: 'Đợt đánh giá 2026', nam: 2026, hanXa: '30/04/2026', hanTinh: '30/06/2026', conLai: 5, cheDo: 'Dựa trên Tổ tư vấn', phienBan: 'Bộ tiêu chí 2026 (v2.1)', giaiDoan: 'Đang chấm' };
  D.parts = [
    { id: 'A', name: 'Phần A. Sản phẩm và sức mạnh cộng đồng', max: 40 },
    { id: 'B', name: 'Phần B. Khả năng tiếp thị', max: 25 },
    { id: 'C', name: 'Phần C. Chất lượng sản phẩm', max: 35 },
  ];
  // ttv: điểm đề xuất của Tổ tư vấn; tv: điểm thành viên (Lê Văn C) – khác ở 4 tiêu chí
  D.tieuchi = [
    { code: 'A1', part: 'A', name: 'Hình thức tổ chức sản xuất', max: 5, ttv: 4, ev: 2, can: 'Hợp tác xã có điều lệ, hoạt động ổn định trên 3 năm.' },
    { code: 'A2', part: 'A', name: 'Nguồn gốc nguyên liệu', max: 5, ttv: 5, ev: 3, can: 'Cá linh mua từ 12 hộ đánh bắt tại xã, có hợp đồng thu mua.' },
    { code: 'A3', part: 'A', name: 'Sử dụng lao động địa phương', max: 5, ttv: 4, ev: 1, can: '18/22 lao động thường xuyên là người địa phương.' },
    { code: 'A4', part: 'A', name: 'Liên kết sản xuất', max: 5, ttv: 4, ev: 2, can: 'Có liên kết với 2 HTX, chưa có hợp đồng bao tiêu dài hạn.' },
    { code: 'A5', part: 'A', name: 'Bảo vệ môi trường trong sản xuất', max: 5, ttv: 3, ev: 1, can: 'Có cam kết bảo vệ môi trường, chưa có hệ thống xử lý nước thải riêng.' },
    { code: 'A6', part: 'A', name: 'Năng lực tiếp thị và phát triển sản phẩm', max: 5, ttv: 4, ev: 1, can: 'Có kế hoạch tiếp thị năm 2026, tham gia 3 hội chợ.' },
    { code: 'A7', part: 'A', name: 'Câu chuyện sản phẩm', max: 5, ttv: 4, ev: 2, can: 'Câu chuyện gắn với mùa nước nổi, có ấn phẩm giới thiệu.' },
    { code: 'A8', part: 'A', name: 'Kế hoạch kinh doanh', max: 5, ttv: 4, ev: 1, can: 'Kế hoạch kinh doanh 3 năm, có dự toán doanh thu.' },
    { code: 'B1', part: 'B', name: 'Công bố chất lượng sản phẩm', max: 5, ttv: 4, ev: 2, can: 'Bản tự công bố số 12/2025/MBS, còn hiệu lực.' },
    { code: 'B2', part: 'B', name: 'Bao bì, nhãn mác', max: 5, ttv: 4, ev: 3, can: 'Nhãn đủ thông tin bắt buộc, bao bì hút chân không.' },
    { code: 'B3', part: 'B', name: 'Kênh phân phối', max: 5, ttv: 3, ev: 1, can: 'Bán qua 2 siêu thị địa phương và sàn thương mại điện tử.' },
    { code: 'B4', part: 'B', name: 'Quảng bá sản phẩm', max: 5, ttv: 4, ev: 2, can: 'Có trang giới thiệu, tham gia hội chợ OCOP khu vực.' },
    { code: 'B5', part: 'B', name: 'Truy xuất nguồn gốc', max: 5, ttv: 3, ev: 0, can: 'Có ghi chép nhập nguyên liệu, chưa có mã truy xuất điện tử.' },
    { code: 'C1', part: 'C', name: 'Tính đặc thù, cảm quan', max: 10, ttv: 8, ev: 2, can: 'Màu vàng óng, mùi đặc trưng, vị đậm vừa.' },
    { code: 'C2', part: 'C', name: 'Chỉ tiêu an toàn thực phẩm', max: 8, ttv: 6, ev: 2, can: 'Phiếu kiểm nghiệm số KN-0915 đạt các chỉ tiêu vi sinh.' },
    { code: 'C3', part: 'C', name: 'Tiêu chuẩn chất lượng áp dụng', max: 7, ttv: 6, ev: 1, can: 'Áp dụng tiêu chuẩn cơ sở TCCS 01:2025.' },
    { code: 'C4', part: 'C', name: 'Hệ thống quản lý chất lượng', max: 5, ttv: 4, ev: 1, can: 'Đang áp dụng 5S, chưa chứng nhận HACCP.' },
    { code: 'C5', part: 'C', name: 'Tiềm năng xuất khẩu', max: 5, ttv: 4, ev: 0, can: 'Đã có đơn hàng thử nghiệm sang Campuchia.' },
  ];
  D.tvEdits = { A5: { v: 2, ly: 'Biên bản kiểm tra thực tế cho thấy nước thải chưa qua xử lý.' }, B3: { v: 4, ly: 'Đã có hợp đồng phân phối với chuỗi Bách Hóa Xanh (minh chứng bổ sung).' }, C2: { v: 7, ly: 'Phiếu kiểm nghiệm đạt toàn bộ chỉ tiêu kim loại nặng.' }, C5: { v: 3, ly: 'Đơn hàng xuất khẩu chỉ ở mức thử nghiệm, chưa ổn định.' } };
  D.chuthe = [
    { ten: 'Cơ sở Mắm Bà Sáu', loai: 'Hộ sản xuất', xa: 'Xã An Phú', dd: 'Nguyễn Thị Sáu', sdt: '0918 ••• 247', mst: '0312•••891' },
    { ten: 'Công ty TNHH Trà Thảo Mộc', loai: 'Doanh nghiệp', xa: 'Phường Tân Hòa', dd: 'Trần Minh Khang', sdt: '0903 ••• 115', mst: '0315•••204' },
    { ten: 'HTX Nông sản Xanh An Phú', loai: 'Hợp tác xã', xa: 'Xã An Phú', dd: 'Lê Văn Hùng', sdt: '0939 ••• 562', mst: '0316•••778' },
    { ten: 'HTX Nón lá Bình Thạnh', loai: 'Hợp tác xã', xa: 'Xã Bình Thạnh', dd: 'Võ Thị Hoa', sdt: '0977 ••• 330', mst: '0317•••045' },
  ];
  // st: khóa trạng thái (xem O.STATUS)
  D.hoso = [
    { ma: 'HS-2026-0123', sp: 'Mắm cá linh khô', ct: 'Cơ sở Mắm Bà Sáu', xa: 'Xã An Phú', nhom: 'Thực phẩm', st: 'hdxemxet', diem: 78, sao: 4, cap: '12/10/2026', han: '25/10/2026', pt: 'Nguyễn Thanh Tâm', ttv: 'Hoàng Thị E', nhan: '02/04/2026' },
    { ma: 'HS-2026-0124', sp: 'Trà thảo mộc túi lọc', ct: 'Công ty TNHH Trà Thảo Mộc', xa: 'Phường Tân Hòa', nhom: 'Đồ uống', st: 'cobaocao', diem: 84, sao: 4, cap: '14/10/2026', han: '25/10/2026', pt: 'Phan Thu Hà', ttv: 'Vũ Văn F', nhan: '05/04/2026' },
    { ma: 'HS-2026-0125', sp: 'Nón lá làng nghề', ct: 'HTX Nón lá Bình Thạnh', xa: 'Xã Bình Thạnh', nhom: 'Thủ công mỹ nghệ', st: 'thamdinh', diem: null, sao: null, cap: '15/10/2026', han: '28/10/2026', pt: 'Nguyễn Thanh Tâm', ttv: 'Hoàng Thị E', nhan: '08/04/2026' },
    { ma: 'HS-2026-0126', sp: 'Gạo thơm An Phú', ct: 'HTX Nông sản Xanh An Phú', xa: 'Xã An Phú', nhom: 'Thực phẩm', st: 'dachot', diem: 92, sao: 5, cap: '10/10/2026', han: '20/10/2026', pt: 'Phan Thu Hà', ttv: 'Vũ Văn F', nhan: '01/04/2026' },
    { ma: 'HS-2026-0127', sp: 'Mật ong rừng tràm', ct: 'HTX Ong Mật Phú Hữu', xa: 'Xã Phú Hữu', nhom: 'Thực phẩm', st: 'congnhan4', diem: 81, sao: 4, cap: '30/09/2026', han: '15/10/2026', pt: 'Phan Thu Hà', ttv: 'Hoàng Thị E', nhan: '03/04/2026' },
    { ma: 'HS-2026-0128', sp: 'Tinh dầu sả chanh', ct: 'Cơ sở Tinh dầu Long Điền', xa: 'Xã Long Điền', nhom: 'Dược liệu và sản phẩm từ dược liệu', st: 'daxacnhan', diem: 69, sao: 3, cap: '11/10/2026', han: '25/10/2026', pt: 'Nguyễn Thanh Tâm', ttv: 'Vũ Văn F', nhan: '09/04/2026' },
    { ma: 'HS-2026-0129', sp: 'Bánh tráng phơi sương', ct: 'Hộ Trần Văn Lộc', xa: 'Xã Bình Thạnh', nhom: 'Thực phẩm', st: 'chuyentinh', diem: null, sao: null, cap: null, han: '30/10/2026', pt: 'Phan Thu Hà', ttv: null, nhan: '12/04/2026' },
    { ma: 'HS-2026-0130', sp: 'Mai vàng bonsai', ct: 'Vườn kiểng Tư Lành', xa: 'Phường Tân Hòa', nhom: 'Cây cảnh và cảnh quan', st: 'danop', diem: null, sao: null, cap: null, han: '30/04/2026', pt: 'Ngô Bảo Ngọc', ttv: null, nhan: '18/04/2026' },
    { ma: 'HS-2026-0131', sp: 'Homestay Vườn Sen', ct: 'Hộ Lý Thị Mai', xa: 'Xã Long Điền', nhom: 'Du lịch cộng đồng, du lịch sinh thái và điểm du lịch', st: 'bosung', diem: null, sao: null, cap: null, han: '20/10/2026', pt: 'Ngô Bảo Ngọc', ttv: null, nhan: '15/04/2026' },
    { ma: 'HS-2026-0132', sp: 'Khô cá lóc đồng', ct: 'Cơ sở Mắm Bà Sáu', xa: 'Xã An Phú', nhom: 'Thực phẩm', st: 'nhap', diem: null, sao: null, cap: null, han: '30/04/2026', pt: null, ttv: null, nhan: null },
    { ma: 'HS-2026-0133', sp: 'Mứt dừa non', ct: 'Cơ sở Mứt Út Hiền', xa: 'Phường Tân Hòa', nhom: 'Thực phẩm', st: 'chuadat', diem: 46, sao: 0, cap: '28/09/2026', han: '15/10/2026', pt: 'Phan Thu Hà', ttv: 'Vũ Văn F', nhan: '06/04/2026' },
    { ma: 'HS-2026-0134', sp: 'Nước mắm nhĩ cá cơm', ct: 'Công ty TNHH Hải Vị', xa: 'Xã Phú Hữu', nhom: 'Thực phẩm', st: 'de5sao', diem: 93, sao: 5, cap: '05/10/2026', han: '20/10/2026', pt: 'Phan Thu Hà', ttv: 'Hoàng Thị E', nhan: '02/04/2026' },
  ];
  O.hs = (ma) => D.hoso.find((h) => h.ma === ma) || D.hoso[0];
  D.hoidong = [
    { ten: 'Nguyễn Văn A', cv: 'Phó Giám đốc Sở NN&MT', dv: 'Sở NN&MT', vt: 'Chủ tịch', cm: 'Quản lý nông nghiệp', tfa: true },
    { ten: 'Trần Thị B', cv: 'Trưởng phòng Phát triển nông thôn', dv: 'Sở NN&MT', vt: 'Thư ký', cm: 'Kinh tế nông thôn', tfa: true },
    { ten: 'Lê Văn C', cv: 'Chuyên gia an toàn thực phẩm', dv: 'Sở Y tế', vt: 'Thành viên', cm: 'An toàn thực phẩm', tfa: true },
    { ten: 'Phạm Thị D', cv: 'Phó Giám đốc', dv: 'Sở Công Thương', vt: 'Thành viên', cm: 'Xúc tiến thương mại', tfa: true },
    { ten: 'Đặng Quốc G', cv: 'Giảng viên', dv: 'Trường Đại học Cần Thơ', vt: 'Thành viên', cm: 'Công nghệ thực phẩm', tfa: false },
  ];
  D.totuvan = [
    { ten: 'Hoàng Thị E', cv: 'Chuyên viên chính', dv: 'Chi cục PTNT', vt: 'Tổ trưởng', cm: 'Thẩm định OCOP', tfa: true },
    { ten: 'Vũ Văn F', cv: 'Chuyên viên', dv: 'Trung tâm Khuyến nông', vt: 'Thành viên', cm: 'Chế biến nông sản', tfa: true },
    { ten: 'Mai Thị K', cv: 'Chuyên viên', dv: 'Chi cục QLCL', vt: 'Thành viên', cm: 'Kiểm nghiệm', tfa: true },
  ];
  D.files = [
    { name: 'Giay-phep-kinh-doanh.pdf', size: '1,2 MB', type: 'pdf', crit: 'Hồ sơ pháp lý', by: 'Nguyễn Thị Sáu', at: '02/04/2026 09:12' },
    { name: 'Hop-dong-thu-mua-ca-linh.pdf', size: '820 KB', type: 'pdf', crit: 'A2: Nguồn gốc nguyên liệu', by: 'Nguyễn Thị Sáu', at: '02/04/2026 09:20' },
    { name: 'Anh-xuong-san-xuat.jpg', size: '2,4 MB', type: 'jpg', crit: 'A1: Hình thức tổ chức sản xuất', by: 'Nguyễn Thị Sáu', at: '02/04/2026 09:31' },
    { name: 'Phieu-kiem-nghiem-KN0915.pdf', size: '640 KB', type: 'pdf', crit: 'C2: Chỉ tiêu an toàn thực phẩm', by: 'Nguyễn Thị Sáu', at: '03/04/2026 14:05' },
    { name: 'Nhan-san-pham.png', size: '1,1 MB', type: 'png', crit: 'B2: Bao bì, nhãn mác', by: 'Nguyễn Thị Sáu', at: '03/04/2026 14:12' },
    { name: 'Ke-hoach-kinh-doanh-2026.docx', size: '310 KB', type: 'docx', crit: 'A8: Kế hoạch kinh doanh', by: 'Nguyễn Thị Sáu', at: '03/04/2026 15:40' },
  ];
  O.ROLES = {
    chuthe: { name: 'Chủ thể OCOP', user: 'Nguyễn Thị Sáu', unit: 'Cơ sở Mắm Bà Sáu', icon: 'store' },
    xa: { name: 'Cán bộ UBND xã', user: 'Ngô Bảo Ngọc', unit: 'UBND Xã An Phú', icon: 'landmark' },
    so: { name: 'Cán bộ Sở NN&MT', user: 'Phan Thu Hà', unit: 'Sở NN&MT', icon: 'building-2' },
    thuky: { name: 'Thư ký hội đồng', user: 'Trần Thị B', unit: 'Hội đồng cấp tỉnh', icon: 'gavel' },
    ttv: { name: 'Tổ tư vấn', user: 'Hoàng Thị E', unit: 'Tổ trưởng Tổ tư vấn', icon: 'clipboard-check' },
    thanhvien: { name: 'Thành viên hội đồng', user: 'Lê Văn C', unit: 'Sở Y tế', icon: 'user-check' },
    quantri: { name: 'Quản trị hệ thống', user: 'Đỗ Minh Quân', unit: 'Trung tâm CNTT', icon: 'shield' },
  };
  // Menu theo vai trò (mục 2). sub: các màn con hiển thị dưới mục.
  O.MENUS = {
    chuthe: [['s10', 'Trang chủ', 'house'], ['s12', 'Hồ sơ của tôi', 'folder-open', ['s13', 's14', 's15', 's16', 's17', 's18', 's19']], ['s11', 'Hồ sơ pháp lý', 'file-badge'], ['s04', 'Thông báo', 'bell'], ['s03', 'Tài khoản', 'circle-user']],
    xa: [['s20', 'Trang chủ', 'house'], ['s21', 'Hồ sơ tại xã', 'folder-open', ['s22', 's23', 's24', 's25']], ['s35', 'Thống kê', 'chart-column'], ['s04', 'Thông báo', 'bell'], ['s03', 'Tài khoản', 'circle-user']],
    so: [['s30', 'Trang chủ', 'house'], ['s31', 'Đợt đánh giá', 'calendar-range'], ['s32', 'Hồ sơ toàn tỉnh', 'folder-open', ['s33']], ['s34', 'Hồ sơ 5 sao', 'star'], ['s35', 'Thống kê', 'chart-column'], ['s04', 'Thông báo', 'bell'], ['s03', 'Tài khoản', 'circle-user']],
    thuky: [['s42', 'Trang chủ', 'house'], ['s40', 'Hội đồng', 'users'], ['s41', 'Phân công', 'git-fork'], ['s42', 'Tiến độ chấm', 'list-checks'], ['s43', 'Chốt điểm', 'lock'], ['s44', 'Văn bản', 'file-text'], ['s45', 'Chứng nhận', 'award'], ['s04', 'Thông báo', 'bell'], ['s03', 'Tài khoản', 'circle-user']],
    ttv: [['s50', 'Hàng đợi thẩm định', 'inbox', ['s51', 's52']], ['s53', 'Sao chép sang phiếu chấm', 'copy'], ['s04', 'Thông báo', 'bell'], ['s03', 'Tài khoản', 'circle-user']],
    thanhvien: [['s60', 'Hồ sơ được phân công', 'clipboard-list', ['s61']], ['s63', 'Điểm tổng hợp', 'table-2'], ['s04', 'Thông báo', 'bell'], ['s03', 'Tài khoản', 'circle-user']],
    quantri: [['s70', 'Tài khoản và vai trò', 'users-round'], ['s71', 'Bộ tiêu chí', 'list-tree', ['s72']], ['s73', 'Danh mục', 'library'], ['s74', 'Nhật ký', 'scroll-text'], ['s04', 'Thông báo', 'bell'], ['s03', 'Tài khoản', 'circle-user']],
  };
  // vai trò ở thanh dưới di động (tối đa 4)
  O.BOTTOM = {
    chuthe: ['s10', 's12', 's04', 's03'], xa: ['s20', 's21', 's35', 's04'], so: ['s30', 's32', 's34', 's04'], thuky: ['s42', 's41', 's43', 's04'],
    ttv: ['s50', 's53', 's04', 's03'], thanhvien: ['s60', 's63', 's04', 's03'], quantri: ['s70', 's71', 's74', 's04'],
  };

  /* ---------- trạng thái hồ sơ (3.2) ---------- */
  O.STATUS = {
    nhap: ['Nháp', 't-gray', 'pencil-line'],
    danop: ['Đã nộp, chờ xã', 't-blue', 'send'],
    bosung: ['Cần bổ sung', 't-orange', 'file-warning'],
    khongdatsb: ['Không đạt sơ bộ', 't-red', 'circle-x'],
    chuyentinh: ['Đã chuyển tỉnh', 't-blue', 'arrow-up-right'],
    thamdinh: ['Đang thẩm định', 't-purple', 'search-check'],
    cobaocao: ['Đã có báo cáo Tổ tư vấn', 't-purple', 'file-check-2'],
    hdxemxet: ['Hội đồng đang xem xét', 't-purple', 'users'],
    daxacnhan: ['Đã xác nhận phiếu', 't-purple', 'badge-check'],
    dachot: ['Đã chốt điểm', 't-green', 'lock'],
    congnhan3: ['Công nhận 3 sao', 't-green', 'star'],
    congnhan4: ['Công nhận 4 sao', 't-green', 'star'],
    chuadat: ['Chưa đạt', 't-red', 'circle-alert'],
    de5sao: ['Đã gửi đề nghị 5 sao', 't-amber', 'sparkles'],
    dadong: ['Đã đóng (xử lý ngoài hệ thống)', 't-gray', 'archive'],
    darut: ['Đã rút', 't-gray', 'undo-2'],
  };
  O.chip = (key) => { const s = O.STATUS[key] || [key, 't-gray', 'circle']; return `<span class="chip ${s[1]}">${ic(s[2])}${esc(s[0])}</span>`; };
  /* chip tự do: tone = gray|blue|orange|red|purple|green|amber|teal */
  O.tag = (text, tone = 'gray', iconName) => `<span class="chip ${iconName ? '' : 'plain'} t-${tone}">${iconName ? ic(iconName) : ''}${esc(text)}</span>`;
  O.stars = (n, max = 5, size = '') => `<span class="stars ${size}" aria-label="${n} sao">${Array.from({ length: max }, (_, i) => ic('star', i < n ? 'full' : 'off')).join('')}</span>`;

  /* ---------- thành phần ---------- */
  O.btn = (label, { kind = '', icon: i, size = '', go, attrs = '', id } = {}) =>
    `<button type="button" class="${cls('btn', kind, size)}" ${id ? `id="${id}"` : ''} ${go ? `data-go="${go}"` : ''} ${attrs}>${i ? ic(i) : ''}${label ? `<span>${label}</span>` : ''}</button>`;
  O.pageHead = ({ title, sub = '', chips = '', actions = '' }) =>
    `<div class="page-head"><div class="t"><div class="row s8">${chips}</div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${actions ? `<div class="acts">${actions}</div>` : ''}</div>`;
  O.card = (body, { title = '', sub = '', actions = '', cls: c = '', info = false, foot = '' } = {}) =>
    `<section class="${cls('card', c)}">${title ? `<div class="card-head"><div class="stack s8" style="gap:2px;flex:1;min-width:0"><h2>${title}${info ? ` <span class="info">${ic('info')}</span>` : ''}</h2>${sub ? `<p class="small muted">${sub}</p>` : ''}</div>${actions}</div>` : ''}${body}${foot ? `<div class="card-foot">${foot}</div>` : ''}</section>`;
  O.stat = ({ label, value, sub = '', icon: i = 'folder', tone = 'green', go }) =>
    `<${go ? `a href="#${go}" class="stat link"` : 'div class="stat"'} style="--t:var(--c-${tone})"><div class="top"><span class="ico">${ic(i)}</span><span>${label}</span></div><div class="v">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</${go ? 'a' : 'div'}>`;
  O.banner = ({ tone = 'blue', icon: i = 'info', title = '', text = '', actions = '' }) =>
    `<div class="banner" style="--t:var(--c-${tone})">${ic(i)}<div class="bt">${title ? `<b>${title}</b>` : ''}${text ? `<span>${text}</span>` : ''}</div>${actions ? `<div class="bact">${actions}</div>` : ''}</div>`;
  O.lockband = (text, sub = '') => `<div class="lockband">${ic('lock')}<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
  O.empty = ({ icon: i = 'inbox', title, text = '', action = '' }) => `<div class="empty"><div class="eart">${ic(i)}</div><h3>${title}</h3>${text ? `<p>${text}</p>` : ''}${action}</div>`;
  O.skeleton = (rows = 5) => `<div class="stack s12">${Array.from({ length: rows }, (_, i) => `<div class="row nowrap"><div class="skel" style="width:40px;height:40px;border-radius:50%"></div><div class="stack s8" style="flex:1"><div class="skel" style="width:${60 - i * 6}%"></div><div class="skel" style="width:${35 + i * 5}%;height:10px"></div></div></div>`).join('')}</div>`;
  O.loadError = (what = 'dữ liệu') => O.empty({ icon: 'cloud-off', title: `Không tải được ${what}`, text: 'Kết nối tới máy chủ bị gián đoạn. Kiểm tra mạng rồi thử lại.', action: O.btn('Thử lại', { kind: 'primary', icon: 'rotate-cw', attrs: 'data-toast="Đang tải lại…"' }) });
  O.noAccess = () => O.empty({ icon: 'shield-x', title: 'Bạn không có quyền xem nội dung này', text: 'Nội dung chỉ dành cho người được phân công. Liên hệ thư ký hội đồng nếu cần được cấp quyền.' });

  const AV = ['#1C8C4A', '#2C6BD6', '#DB741A', '#7656D6', '#13897F', '#C04F7A', '#8A6D1F'];
  O.avatar = (name, size = '') => { const p = String(name).trim().split(/\s+/); const ini = (p.length > 1 ? p[p.length - 2][0] + p[p.length - 1][0] : p[0].slice(0, 2)).toUpperCase(); let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return `<span class="avatar ${size}" style="--av:${AV[h % AV.length]}">${esc(ini)}</span>`; };
  O.person = (name, sub = '', tagHtml = '') => `<div class="person">${O.avatar(name)}<div class="pn"><b>${esc(name)} ${tagHtml}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div></div>`;
  O.progress = (v, max = 100, tone = '', size = '') => `<div class="progress ${size}" ${tone ? `style="--t:var(--c-${tone})"` : ''}><i style="width:${Math.max(0, Math.min(100, (v / max) * 100))}%"></i></div>`;
  O.segbar = (pct, n = 10, tone = '') => `<span class="segbar" ${tone ? `style="--t:var(--c-${tone})"` : ''}>${Array.from({ length: n }, (_, i) => `<i class="${i < Math.round((pct / 100) * n) ? 'on' : ''}"></i>`).join('')}</span>`;
  O.kv = (items, one = false) => `<div class="kv ${one ? 'one' : ''}">${items.map(([i, k, v]) => `<div>${i ? ic(i) : ''}<div><div class="k">${k}</div><div class="v">${v}</div></div></div>`).join('')}</div>`;
  O.dl = (items) => `<dl class="dl">${items.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;

  /* tabs: items [[id,label,count?]]; panels: object id->html. group tự động */
  let tabSeq = 0;
  O.tabs = (items, panels, { active, style = '' } = {}) => {
    const g = 'tg' + ++tabSeq; const a = active || items[0][0];
    return `<div data-tabgroup="${g}" class="stack" style="gap:16px"><div class="tabs ${style}" role="tablist">${items.map(([id, l, n]) => `<button type="button" role="tab" class="tab ${id === a ? 'on' : ''}" data-tab="${id}">${l}${n != null ? ` <span class="badge-n ${id === a ? '' : 'soft'}">${n}</span>` : ''}</button>`).join('')}</div>${items.map(([id]) => `<div class="tab-panel" data-panel="${id}" ${id === a ? '' : 'hidden'}>${panels[id] || ''}</div>`).join('')}</div>`;
  };
  O.fchips = (items, active = 0) => `<div class="fchips" data-chips>${items.map((it, i) => { const [l, n] = Array.isArray(it) ? it : [it]; return `<button type="button" class="fchip ${i === active ? 'on' : ''}">${l}${n != null ? `<span class="n">${n}</span>` : ''}</button>`; }).join('')}</div>`;
  O.seg = (items, active = 0, extra = '') => `<div class="seg ${extra}" data-seg>${items.map((l, i) => `<button type="button" class="${i === active ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  O.search = (ph = 'Tìm theo mã, tên sản phẩm, chủ thể', id = '') => `<div class="input-icon">${ic('search')}<input class="input" ${id ? `id="${id}"` : ''} placeholder="${ph}"></div>`;

  /* Bảng: cols [{k,l,cls,w}], rows mảng object; cell(row,col) trả html; card(row) cho di động */
  O.table = ({ cols, rows, cell, select = false, card, rowAttrs, matrix = false, foot = '', pager = true, total }) => {
    const head = `<tr>${select ? '<th class="c" style="width:44px"><input type="checkbox" data-selall aria-label="Chọn tất cả"></th>' : ''}${cols.map((c) => `<th class="${cls(c.cls, c.sort && 'sort')}" ${c.w ? `style="width:${c.w}"` : ''}>${c.l}${c.sort ? ic('arrow-up-down') : ''}</th>`).join('')}</tr>`;
    const body = rows.map((r, i) => `<tr ${rowAttrs ? rowAttrs(r, i) : ''}>${select ? `<td class="c"><input type="checkbox" data-sel aria-label="Chọn dòng"></td>` : ''}${cols.map((c) => `<td class="${c.cls || ''}">${cell(r, c, i)}</td>`).join('')}</tr>`).join('');
    const pg = pager ? `<div class="pager"><span>Hiển thị 1 đến ${rows.length} trong ${total || rows.length} hồ sơ</span><span class="spacer"></span><span class="pg">${ic('chevron-left')}</span><span class="pg on">1</span><span class="pg">2</span><span class="pg">3</span><span class="pg">${ic('chevron-right')}</span></div>` : '';
    return `<div class="tbl-wrap ${card ? 'cardable' : ''}"><table class="tbl ${matrix ? 'mat' : ''}"><thead>${head}</thead><tbody>${body}</tbody>${foot}</table></div>${card ? `<div class="tbl-cards">${rows.map((r, i) => card(r, i)).join('')}</div>` : ''}${pg}`;
  };
  O.prodCell = (h) => `<div class="prod"><span class="avatar sm" style="--av:var(--brand-soft);color:var(--brand)">${ic(nhomIcon(h.nhom))}</span><div><b>${esc(h.sp)}</b><small>${esc(h.ma)}</small></div></div>`;
  function nhomIcon(n) { return { 'Thực phẩm': 'wheat', 'Đồ uống': 'cup-soda', 'Dược liệu và sản phẩm từ dược liệu': 'leaf', 'Thủ công mỹ nghệ': 'scissors', 'Cây cảnh và cảnh quan': 'trees', }[n] || 'tent-tree'; }
  O.nhomIcon = nhomIcon;
  O.bulkbar = (n, actions) => `<div class="bulkbar" data-bulk hidden>${ic('square-check')}<b><span data-bulkn>${n}</span> hồ sơ đã chọn</b><span class="spacer"></span>${actions}</div>`;

  /* Dòng thời gian trạng thái (3.3). cur: chỉ số bước hiện tại */
  O.stepper = (cur = 3, dates = ['02/04/2026', '18/04/2026', '05/05/2026', '', ''], steps = ['Nộp', 'Xã', 'Tỉnh', 'Hội đồng', 'Kết quả']) =>
    `<div class="stepper">${steps.map((s, i) => { const st = i < cur ? 'done' : i === cur ? 'cur' : 'todo'; return `<div class="st ${st}" data-toast="Lịch sử bước ${s}: xem tab Lịch sử"><div class="dotc">${st === 'done' ? ic('check') : i + 1}</div><div class="stx"><b>${s}</b><small>${st === 'done' ? dates[i] : st === 'cur' ? 'Đang xử lý' : 'Chưa tới'}</small></div></div>`; }).join('')}</div>`;
  O.wizard = (steps, cur) => `<div class="wizard">${steps.map(([l, go], i) => `<div class="ws ${i < cur ? 'done' : i === cur ? 'cur' : ''}" ${go ? `data-go="${go}"` : ''}><span class="n">${i < cur ? ic('check') : i + 1}</span><span class="wl">${l}</span></div>`).join('')}</div>`;
  O.timeline = (evs) => `<div class="timeline">${evs.map(([i, tone, t, s]) => `<div class="ev" style="--t:var(--c-${tone})"><span class="eic">${ic(i)}</span><div class="eb"><b>${t}</b><small>${s}</small></div></div>`).join('')}</div>`;

  /* Ô nhập điểm (3.4) */
  O.scoreInput = ({ id, value = '', max = 5, cls: c = '', disabled = false, label = '' }) =>
    `<div class="score ${c}" data-score data-max="${max}"><button type="button" data-dec aria-label="Giảm" ${disabled ? 'disabled' : ''}>${ic('minus')}</button><input type="number" inputmode="numeric" min="0" max="${max}" step="1" id="${id}" value="${value}" aria-label="${esc(label || 'Điểm')}" ${disabled ? 'readonly' : ''}><span class="max">/ ${max}</span><button type="button" data-inc aria-label="Tăng" ${disabled ? 'disabled' : ''}>${ic('plus')}</button></div>`;
  O.otp = (id = 'otp', invalid = false) => `<div class="otp ${invalid ? 'invalid' : ''}" data-otp id="${id}">${Array.from({ length: 6 }, (_, i) => `<input inputmode="numeric" maxlength="1" aria-label="Số thứ ${i + 1}" id="${id}-${i}">`).join('')}</div>`;

  /* Tệp */
  const FT = { pdf: ['PDF', 'red'], jpg: ['JPG', 'teal'], png: ['PNG', 'teal'], docx: ['DOC', 'blue'], xlsx: ['XLS', 'green'], zip: ['ZIP', 'amber'] };
  O.file = (f, { remove = false, progress = null, extra = '' } = {}) => { const t = FT[f.type] || ['FILE', 'gray']; return `<div class="file" style="--t:var(--c-${t[1]})"><span class="fi">${t[0]}</span><div class="fn"><b>${esc(f.name)}</b><span>${f.size}${f.crit ? ' · ' + esc(f.crit) : ''}</span>${progress != null ? O.progress(progress, 100) : ''}</div>${extra}<button class="icon-btn" style="width:36px;height:36px" data-preview="${esc(f.name)}" aria-label="Xem">${ic('eye')}</button>${remove ? `<button class="icon-btn" style="width:36px;height:36px" data-toast="Đã gỡ tệp" aria-label="Xóa">${ic('trash-2')}</button>` : ''}</div>`; };
  O.fileChip = (name) => `<button type="button" class="file-chip" data-preview="${esc(name)}">${ic('paperclip')}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</span></button>`;
  O.drop = (text = 'Kéo thả tệp vào đây hoặc bấm để chọn', hint = 'PDF, JPG, PNG, DOCX. Tối đa 20 MB mỗi tệp', compact = false) =>
    `<label class="drop ${compact ? 'compact' : ''}">${ic('cloud-upload')}<div><b class="hide-m">${text}</b><b class="only-m">Chụp ảnh hoặc chọn tệp</b><div class="small">${hint}</div></div><input type="file" class="sr" multiple data-upload></label>`;

  /* Biểu đồ cột bo tròn (giống mẫu tham chiếu). items [{l, v, tip:[[k,v]]}] */
  O.bars = (items, { max, ticks = 4, height = 220, hl = -1 } = {}) => {
    const m = max || Math.ceil(Math.max(...items.map((x) => x.v)) / ticks) * ticks || 1;
    const ax = Array.from({ length: ticks + 1 }, (_, i) => Math.round(m - (m / ticks) * i));
    return `<div class="bars" style="height:${height}px"><div class="axis">${ax.map((a) => `<span>${a}</span>`).join('')}</div>${items.map((x, i) => `<div class="bar-col ${i === hl ? 'hl' : ''}"><div class="bar" style="height:calc(${(x.v / m) * 100}% - 26px)"></div><span class="bl">${x.l}</span>${x.tip ? `<div class="bar-tip">${x.tip.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>` : ''}</div>`).join('')}</div>`;
  };
  O.hbars = (items, max) => { const m = max || Math.max(...items.map((x) => x.v)); return `<div class="stack s12">${items.map((x) => `<div class="hbar"><span>${x.l}</span><div class="track">${x.parts ? x.parts.map(([v, c]) => `<i style="width:${(v / m) * 100}%;background:var(--c-${c})"></i>`).join('') : `<i style="width:${(x.v / m) * 100}%;${x.c ? `background:var(--c-${x.c})` : ''}"></i>`}</div><span class="v">${x.vl ?? x.v}</span></div>`).join('')}</div>`; };
  O.ring = (p, label, sub, tone = 'green') => `<div class="ring" style="--p:${p};--t:var(--c-${tone})"><div><div><b>${label}</b><br><span>${sub}</span></div></div></div>`;

  /* Khung hai bên (3.9) */
  O.split = (docHtml, formHtml, { docLabel = 'Tài liệu', formLabel = 'Phiếu chấm' } = {}) =>
    `<div class="stack" style="gap:12px"><div class="split-tabs">${O.seg([docLabel, formLabel], 1, 'split-switch')}</div><div class="split" data-split data-show="form"><div class="pane doc">${docHtml}</div><div class="pane form">${formHtml}</div></div></div>`;

  /* Điểm theo tiêu chí: tổng phần */
  O.sumParts = (getter) => { const r = { A: 0, B: 0, C: 0 }; D.tieuchi.forEach((t) => { r[t.part] += Number(getter(t)) || 0; }); r.T = r.A + r.B + r.C; return r; };
  O.rank = (t) => (t >= 90 ? 5 : t >= 70 ? 4 : t >= 50 ? 3 : 0);
  O.rankText = (t) => { const s = O.rank(t); return s ? `${s} sao` : 'Chưa đạt'; };
  O.qr = (seed = 7) => { let x = seed; const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280); const cells = []; for (let r = 0; r < 21; r++) for (let c = 0; c < 21; c++) { const f = (r < 7 && c < 7) || (r < 7 && c > 13) || (r > 13 && c < 7); const fin = f && ((r % 6 === 0 || c % 6 === 0 || (r > 13 && (r - 14) % 6 === 0) || (c > 13 && (c - 14) % 6 === 0)) || ((r % 7 >= 2 && r % 7 <= 4) && ((c % 7 >= 2 && c % 7 <= 4) || (c > 13 && (c - 14) >= 2 && (c - 14) <= 4)))); cells.push(`<i class="${f ? (fin ? 'b' : '') : rnd() > 0.52 ? 'b' : ''}"></i>`); } return `<div class="qr" aria-label="Mã QR">${cells.join('')}</div>`; };

  /* ---------- lớp phủ: hộp thoại, ngăn kéo, toast ---------- */
  const layer = () => document.getElementById('layer');
  O.closeAll = () => { layer().innerHTML = ''; };
  O.modal = ({ title, body, foot = '', icon: i = '', tone = 'green', wide = false, id = 'modal' }) => {
    layer().insertAdjacentHTML('beforeend', `<div class="overlay" data-ov id="${id}"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head">${i ? `<span class="mic" style="--t:var(--c-${tone})">${ic(i)}</span>` : ''}<h2>${title}</h2><button class="icon-btn" data-close aria-label="Đóng" style="width:38px;height:38px">${ic('x')}</button></div><div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div></div>`);
    const el = document.getElementById(id); bind(el); const f = el.querySelector('input,textarea,select'); if (f) setTimeout(() => f.focus(), 30); return el;
  };
  /* Hộp thoại xác nhận (3.8): kind normal|danger|otp. Luôn nêu: điều gì xảy ra, ai nhận thông báo, có hoàn tác được không. */
  O.confirm = ({ title, kind = 'normal', what = '', notify = '', undo = '', extra = '', confirmText = 'Xác nhận', typeWord = '', onConfirm, icon: i }) => {
    const tone = kind === 'danger' ? 'red' : kind === 'otp' ? 'blue' : 'green';
    const body = `<div class="conseq">${what ? `<div>${ic('circle-dot')}<span><b>Sẽ xảy ra:</b> ${what}</span></div>` : ''}${notify ? `<div>${ic('bell')}<span><b>Thông báo tới:</b> ${notify}</span></div>` : ''}${undo ? `<div>${ic('undo-2')}<span><b>Hoàn tác:</b> ${undo}</span></div>` : ''}</div>${extra}${typeWord ? `<div class="field"><label for="cf-type">Gõ <b>${typeWord}</b> để xác nhận</label><input class="input" id="cf-type" autocomplete="off" data-typeword="${typeWord}"></div>` : ''}${kind === 'otp' ? `<div class="field"><label>Mã OTP gửi tới ứng dụng xác thực</label>${O.otp('cf-otp')}<span class="hint">Mã hết hạn sau 04:59</span></div>` : ''}`;
    const el = O.modal({ title, body, icon: i || (kind === 'danger' ? 'triangle-alert' : kind === 'otp' ? 'shield-check' : 'circle-check'), tone, foot: `${O.btn('Hủy', { kind: 'ghost', attrs: 'data-close' })}${O.btn(confirmText, { kind: kind === 'danger' ? 'danger' : 'primary', attrs: `data-ok ${typeWord ? 'disabled' : ''}` })}` });
    const ok = el.querySelector('[data-ok]'); const tw = el.querySelector('[data-typeword]');
    if (tw) tw.addEventListener('input', () => { ok.disabled = tw.value.trim().toUpperCase() !== typeWord; });
    ok.addEventListener('click', () => { el.remove(); onConfirm && onConfirm(); });
    return el;
  };
  O.drawer = ({ title, body, foot = '', full = false, sub = '' }) => {
    layer().insertAdjacentHTML('beforeend', `<div class="drawer-ov" data-ov></div><aside class="drawer ${full ? 'full' : ''}" role="dialog" aria-label="${esc(title)}"><div class="drawer-head"><div style="flex:1;min-width:0"><h2>${title}</h2>${sub ? `<div class="small muted">${sub}</div>` : ''}</div><button class="icon-btn" data-close aria-label="Đóng" style="width:38px;height:38px">${ic('x')}</button></div><div class="drawer-body">${body}</div>${foot ? `<div class="drawer-foot">${foot}</div>` : ''}</aside>`);
    const el = layer().querySelector('.drawer:last-of-type'); bind(el); return el;
  };
  O.toast = (msg, err = false) => { const t = document.getElementById('toasts'); const n = document.createElement('div'); n.className = 'toast' + (err ? ' err' : ''); n.innerHTML = `${ic(err ? 'circle-alert' : 'circle-check')}<span>${msg}</span>`; t.appendChild(n); setTimeout(() => n.remove(), 2800); };
  O.pop = (anchor, html) => { closePop(); const app = document.getElementById('app'); const r = anchor.getBoundingClientRect(); const a = app.getBoundingClientRect(); const p = document.createElement('div'); p.className = 'pop'; p.innerHTML = html; app.appendChild(p); const w = p.offsetWidth; let left = Math.min(r.right - a.left - w, a.width - w - 8); p.style.left = Math.max(8, left) + 'px'; p.style.top = r.bottom - a.top + 8 + 'px'; bind(p); setTimeout(() => document.addEventListener('click', outside), 0); function outside(e) { if (!p.contains(e.target)) { closePop(); document.removeEventListener('click', outside); } } return p; };
  function closePop() { document.querySelectorAll('.pop').forEach((p) => p.remove()); }
  O.closePop = closePop;

  /* Xem trước tệp (S91) – hàm do màn S91 cung cấp (O.previewFile); mặc định đơn giản */
  O.previewFile = O.previewFile || ((name) => O.drawer({ title: name, body: `<p class="muted">Xem trước tệp</p>` }));

  /* ---------- hành vi chung (gắn sau mỗi lần vẽ) ---------- */
  function bind(root) {
    root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { const ov = b.closest('.overlay'); if (ov) ov.remove(); else { const d = b.closest('.drawer'); if (d) { d.previousElementSibling?.classList.contains('drawer-ov') && d.previousElementSibling.remove(); d.remove(); } } }));
    root.querySelectorAll('[data-ov]').forEach((ov) => ov.addEventListener('click', (e) => { if (e.target !== ov) return; if (ov.classList.contains('drawer-ov')) { ov.nextElementSibling?.remove(); ov.remove(); } else ov.remove(); }));
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); const p = b.dataset.params ? JSON.parse(b.dataset.params) : {}; O.closeAll(); O.go(b.dataset.go, p); }));
    root.querySelectorAll('[data-toast]').forEach((b) => b.addEventListener('click', () => O.toast(b.dataset.toast)));
    root.querySelectorAll('[data-preview]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); O.previewFile(b.dataset.preview); }));
    root.querySelectorAll('[data-tabgroup]').forEach((g) => { const tabs = g.querySelectorAll(':scope > .tabs > .tab'); tabs.forEach((t) => t.addEventListener('click', () => { tabs.forEach((x) => { x.classList.toggle('on', x === t); const b = x.querySelector('.badge-n'); if (b) b.classList.toggle('soft', x !== t); }); g.querySelectorAll(':scope > .tab-panel').forEach((p) => (p.hidden = p.dataset.panel !== t.dataset.tab)); })); });
    root.querySelectorAll('[data-chips]').forEach((g) => g.querySelectorAll('.fchip').forEach((c) => c.addEventListener('click', () => { g.querySelectorAll('.fchip').forEach((x) => x.classList.toggle('on', x === c)); })));
    root.querySelectorAll('[data-seg]').forEach((g) => g.querySelectorAll('button').forEach((c) => c.addEventListener('click', () => { g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === c)); })));
    root.querySelectorAll('.split-switch').forEach((g) => { const sp = g.closest('.stack').querySelector('[data-split]'); g.querySelectorAll('button').forEach((b, i) => b.addEventListener('click', () => (sp.dataset.show = i === 0 ? 'doc' : 'form'))); });
    root.querySelectorAll('[data-score]').forEach((s) => { const inp = s.querySelector('input'); const max = +s.dataset.max; const set = (v) => { v = Math.max(0, Math.min(max, v)); inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); }; s.querySelector('[data-dec]')?.addEventListener('click', () => !inp.readOnly && set((+inp.value || 0) - 1)); s.querySelector('[data-inc]')?.addEventListener('click', () => !inp.readOnly && set((+inp.value || 0) + 1)); inp.addEventListener('input', () => s.classList.toggle('invalid', inp.value !== '' && (+inp.value > max || +inp.value < 0))); inp.addEventListener('keydown', (e) => { if (e.key === 'ArrowUp') { e.preventDefault(); set((+inp.value || 0) + 1); } if (e.key === 'ArrowDown') { e.preventDefault(); set((+inp.value || 0) - 1); } }); });
    root.querySelectorAll('[data-otp]').forEach((o) => { const ins = [...o.querySelectorAll('input')]; ins.forEach((inp, i) => { inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(-1); if (inp.value && ins[i + 1]) ins[i + 1].focus(); o.classList.remove('invalid'); }); inp.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !inp.value && ins[i - 1]) ins[i - 1].focus(); }); inp.addEventListener('paste', (e) => { const t = (e.clipboardData.getData('text') || '').replace(/\D/g, ''); if (t.length > 1) { e.preventDefault(); ins.forEach((x, j) => (x.value = t[j] || '')); ins[Math.min(5, t.length)].focus(); } }); }); });
    root.querySelectorAll('[data-selall]').forEach((all) => { const tb = all.closest('table'); const card = all.closest('.card') || all.closest('.content-inner'); const upd = () => { const n = tb.querySelectorAll('[data-sel]:checked').length; tb.querySelectorAll('[data-sel]').forEach((c) => c.closest('tr').classList.toggle('sel', c.checked)); const bb = card && card.querySelector('[data-bulk]'); if (bb) { bb.hidden = n === 0; const sp = bb.querySelector('[data-bulkn]'); if (sp) sp.textContent = n; } }; all.addEventListener('change', () => { tb.querySelectorAll('[data-sel]').forEach((c) => (c.checked = all.checked)); upd(); }); tb.querySelectorAll('[data-sel]').forEach((c) => { c.addEventListener('change', upd); c.addEventListener('click', (e) => e.stopPropagation()); }); });
    root.querySelectorAll('.crit-head[data-toggle]').forEach((h) => h.addEventListener('click', (e) => { if (e.target.closest('button,input,a,.score')) return; h.parentElement.classList.toggle('closed'); }));
    root.querySelectorAll('[data-upload]').forEach((u) => u.addEventListener('change', () => O.toast(`Đã tải lên ${u.files.length} tệp`)));
    root.querySelectorAll('[data-pw]').forEach((b) => b.addEventListener('click', () => { const i = document.getElementById(b.dataset.pw); i.type = i.type === 'password' ? 'text' : 'password'; }));
  }
  O.bind = bind;

  /* ---------- đăng ký màn hình và định tuyến ---------- */
  /* def: { title, code (vd 'S61'), roles:['thanhvien'], layout:'app'|'bare', crumbs:[[label, goId?]...], variants:[[id,label]], render(ctx), mount(root, ctx) } */
  O.screen = (id, def) => { O.screens[id] = Object.assign({ id, layout: 'app', roles: [], crumbs: [] }, def); O.order.push(id); };
  const S = (O.state = { route: 'catalog', role: 'thanhvien', params: {}, variant: null, collapsed: false, phone: false, sideOpen: false, banner: true });
  try { const t = localStorage.getItem('ocop-theme'); if (t) document.documentElement.dataset.theme = t; S.collapsed = localStorage.getItem('ocop-collapsed') === '1'; } catch (e) {}

  O.go = (id, params = {}) => {
    if (!O.screens[id]) id = 'catalog';
    const scr = O.screens[id];
    if (scr.roles.length && !scr.roles.includes(S.role)) S.role = scr.roles[0];
    S.route = id; S.params = params; S.variant = params.variant || null; S.sideOpen = false;
    if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
    render();
    const c = document.querySelector('.content, .bare'); if (c) c.scrollTop = 0;
  };
  O.rerender = () => render();
  O.setVariant = (v) => { S.variant = v; render(); };

  function navItemsHtml() {
    const menu = O.MENUS[S.role] || [];
    const seen = new Set();
    return menu.map(([id, label, i, sub]) => {
      const key = id + label; if (seen.has(key)) return ''; seen.add(key);
      const active = (S.route === id && !(S.role === 'thuky' && id === 's42' && label === 'Trang chủ' && false)) || (sub && sub.includes(S.route));
      const unread = id === 's04' ? '<span class="badge-n">3</span>' : '';
      const subHtml = sub && active ? `<div class="nav-sub">${sub.map((s) => O.screens[s] ? `<a href="#${s}" class="${S.route === s ? 'active' : ''}">${esc(O.screens[s].navTitle || O.screens[s].title)}</a>` : '').join('')}</div>` : '';
      return `<a href="#${id}" class="nav-item ${active ? 'active' : ''}"><span class="nav-ico">${ic(i)}</span><span class="nav-text">${label}</span>${unread}</a>${subHtml}`;
    }).join('');
  }

  function shell(scr, inner) {
    const R = O.ROLES[S.role];
    const crumbs = [['OCOP ' + D.tinh, 'catalog'], ...(scr.crumbs || [])];
    const crumbHtml = crumbs.map(([l, g], i) => (i < crumbs.length - 1 ? `${g ? `<a href="#${g}">${esc(l)}</a>` : esc(l)}<span class="sep">${ic('chevron-right')}</span>` : '')).join('') + `<b>${esc(scr.title)}</b>`;
    const bottom = (O.BOTTOM[S.role] || []).map((id) => { const m = (O.MENUS[S.role] || []).find((x) => x[0] === id); if (!m) return ''; const act = S.route === id || (m[3] && m[3].includes(S.route)); return `<a href="#${id}" class="${act ? 'active' : ''}">${ic(m[2])}<span>${m[1].replace('Hồ sơ được phân công', 'Phân công').replace('Hàng đợi thẩm định', 'Hàng đợi').replace('Sao chép sang phiếu chấm', 'Sao chép').replace('Tài khoản và vai trò', 'Tài khoản')}</span></a>`; }).join('');
    return `
    <aside class="side" aria-label="Menu chính">
      <div class="side-head"><span class="logo-mark">${ic('sprout')}</span><span class="logo-text">OCOP ${D.tinh}<small>Đánh giá, phân hạng sản phẩm</small></span></div>
      <button class="side-toggle" data-act="collapse" aria-label="Thu gọn menu">${ic('chevron-left')}</button>
      <nav class="side-scroll">
        <div class="nav-label">${esc(R.name)}</div>
        ${navItemsHtml()}
        <div class="nav-label">Bản mẫu thiết kế</div>
        <a href="#catalog" class="nav-item ${S.route === 'catalog' ? 'active' : ''}"><span class="nav-ico">${ic('layout-grid')}</span><span class="nav-text">Danh mục màn hình</span></a>
        <a href="#s01" class="nav-item"><span class="nav-ico">${ic('log-in')}</span><span class="nav-text">Đăng nhập, đăng ký</span></a>
        <a href="#s80" class="nav-item"><span class="nav-ico">${ic('qr-code')}</span><span class="nav-text">Xác thực mã QR</span></a>
        <a href="#s92" class="nav-item"><span class="nav-ico">${ic('octagon-alert')}</span><span class="nav-text">Trang lỗi, bảo trì</span></a>
      </nav>
      <div class="side-foot"><div class="user-card">${O.avatar(R.user)}<div class="who"><b>${esc(R.user)}</b><span>${esc(R.unit)}</span></div>${ic('chevrons-up-down')}</div></div>
    </aside>
    <div class="side-scrim" data-act="side-close"></div>
    <div class="main">
      <div class="mtop"><button class="icon-btn" data-act="side-open" aria-label="Mở menu">${ic('menu')}</button><span class="logo-mark" style="width:32px;height:32px;border-radius:10px">${ic('sprout')}</span><span class="logo-text">OCOP ${D.tinh}</span><button class="icon-btn" data-act="search" aria-label="Tìm kiếm">${ic('search')}</button><button class="icon-btn" data-act="bell" aria-label="Thông báo">${ic('bell')}<span class="dot">3</span></button></div>
      <header class="topbar">
        <nav class="crumbs" aria-label="Vết điều hướng">${crumbHtml}<span class="code-tag">${scr.code || ''}</span></nav>
        <div class="top-actions">
          <button class="search-trigger" data-act="search">${ic('search')}<span>Tìm hồ sơ, sản phẩm…</span><kbd>Ctrl K</kbd></button>
          <button class="role-btn" data-act="role"><span class="role-dot">${ic(R.icon)}</span><span class="lbl">${esc(R.name)}</span>${ic('chevron-down')}</button>
          <button class="icon-btn" data-act="phone" aria-label="Xem khung di động" title="Xem khung di động">${ic(S.phone ? 'monitor' : 'smartphone')}</button>
          <button class="icon-btn" data-act="theme" aria-label="Đổi giao diện sáng tối">${ic('sun-moon')}</button>
          <button class="icon-btn" data-act="bell" aria-label="Thông báo">${ic('bell')}<span class="dot">3</span></button>
        </div>
      </header>
      ${S.banner ? `<div class="sys-banner">${ic('megaphone')}<span><b>${D.dot.ten}</b> đóng nhận hồ sơ sau ${D.dot.conLai} ngày (hạn ${D.dot.hanXa}).</span><button class="x" data-act="banner-x" aria-label="Ẩn">${ic('x')}</button></div>` : ''}
      <main class="content" id="content"><div class="content-inner">
        <div class="crumbs-m">${scr.crumbs && scr.crumbs.length ? `<a href="#${scr.crumbs[scr.crumbs.length - 1][1] || 'catalog'}" class="row s8">${ic('arrow-left')}${esc(scr.crumbs[scr.crumbs.length - 1][0])}</a>` : ''}<span class="spacer"></span><span class="code-tag">${scr.code || ''}</span></div>
        ${inner}
      </div></main>
      <nav class="bottom-nav" aria-label="Điều hướng nhanh">${bottom}</nav>
    </div>`;
  }

  function protoBar(scr) {
    if (!scr.variants || scr.variants.length < 2) return '';
    const cur = S.variant || scr.variants[0][0];
    return `<div class="proto-bar"><span class="pl">${ic('layers')}Trạng thái mẫu</span>${scr.variants.map(([id, l]) => `<button type="button" class="${id === cur ? 'on' : ''}" data-variant="${id}">${l}</button>`).join('')}</div>`;
  }

  function render() {
    const app = document.getElementById('app');
    const scr = O.screens[S.route] || O.screens.catalog;
    const ctx = { variant: S.variant || (scr.variants ? scr.variants[0][0] : 'default'), params: S.params, role: S.role, data: D };
    let inner = '';
    try { inner = scr.render(ctx); } catch (e) { console.error(e); inner = O.banner({ tone: 'red', icon: 'bug', title: 'Lỗi vẽ màn hình ' + (scr.code || scr.id), text: esc(e.message) }); }
    const pb = protoBar(scr);
    const mobile = S.phone || window.innerWidth < 760;
    app.className = cls('app', S.collapsed && !mobile && 'collapsed', mobile && 'is-mobile', S.phone && 'phone-frame', S.sideOpen && 'side-open');
    if (scr.layout === 'bare') {
      app.innerHTML = `<div class="bare" id="content" style="flex:1"><a href="#catalog" class="btn sm back-proto">${ic('layout-grid')}<span>Danh mục màn hình</span></a><div class="bare-inner">${pb ? `<div style="margin-top:36px">${pb}</div>` : '<div style="height:24px"></div>'}${inner}</div></div><div id="layer"></div><div class="toasts" id="toasts"></div>`;
    } else {
      app.innerHTML = shell(scr, pb + inner) + '<div id="layer"></div><div class="toasts" id="toasts"></div>';
    }
    document.title = 'OCOP Tỉnh Mẫu';
    bind(app);
    app.querySelectorAll('[data-variant]').forEach((b) => b.addEventListener('click', () => O.setVariant(b.dataset.variant)));
    app.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', (e) => act(b.dataset.act, b, e)));
    if (scr.mount) { try { scr.mount(app.querySelector('#content'), ctx); } catch (e) { console.error(e); } }
  }

  function act(a, el, e) {
    if (a === 'collapse') { S.collapsed = !S.collapsed; try { localStorage.setItem('ocop-collapsed', S.collapsed ? '1' : '0'); } catch (x) {} render(); }
    if (a === 'side-open') { S.sideOpen = true; document.getElementById('app').classList.add('side-open'); }
    if (a === 'side-close') { S.sideOpen = false; document.getElementById('app').classList.remove('side-open'); }
    if (a === 'phone') { S.phone = !S.phone; render(); }
    if (a === 'banner-x') { S.banner = false; render(); }
    if (a === 'theme') { const r = document.documentElement; const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; r.dataset.theme = dark ? 'light' : 'dark'; try { localStorage.setItem('ocop-theme', r.dataset.theme); } catch (x) {} }
    if (a === 'search') { (O.openSearch || (() => O.go('s90')))(); }
    if (a === 'bell') { e.stopPropagation(); (O.openBell || (() => O.go('s04')))(el); }
    if (a === 'role') {
      e.stopPropagation();
      O.pop(el, `<div class="pop-h">${ic('repeat')}Chuyển vai trò</div>${Object.entries(O.ROLES).map(([k, r]) => `<button class="opt ${k === S.role ? 'on' : ''}" data-role="${k}">${O.avatar(r.user, 'sm')}<span><b style="font-weight:600">${r.name}</b><br><span class="tiny muted">${r.user} · ${r.unit}</span></span>${k === S.role ? ic('check', 'ok') : ''}</button>`).join('')}<div class="pop-f"><span class="muted">Một người có thể giữ nhiều vai trò</span></div>`)
        .querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', () => { S.role = b.dataset.role; O.closePop(); O.go(O.MENUS[S.role][0][0]); O.toast('Đã chuyển sang vai trò ' + O.ROLES[S.role].name); }));
    }
  }

  window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id && id !== S.route) O.go(id); });
  window.addEventListener('resize', () => { const m = window.innerWidth < 760; const app = document.getElementById('app'); if (app && app.classList.contains('is-mobile') !== (m || S.phone)) render(); });
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); (O.openSearch || (() => O.go('s90')))(); } if (e.key === 'Escape') { const l = document.getElementById('layer'); if (l && l.lastElementChild) { const last = l.lastElementChild; if (last.classList.contains('drawer')) { last.previousElementSibling?.remove(); } last.remove(); } O.closePop(); } });

  O.start = () => { const id = location.hash.slice(1); O.go(O.screens[id] ? id : 'catalog'); };

  /* ---------- Danh mục màn hình (trang mở đầu của bản mẫu) ---------- */
  O.GROUPS = [
    ['Chung', ['s01', 's02', 's03', 's04', 's90', 's91', 's92']],
    ['Chủ thể OCOP', ['s10', 's11', 's12', 's13', 's14', 's15', 's16', 's17', 's18', 's19']],
    ['UBND xã/phường', ['s20', 's21', 's22', 's23', 's24', 's25']],
    ['Sở NN&MT', ['s30', 's31', 's32', 's33', 's34', 's35']],
    ['Hội đồng đánh giá cấp tỉnh', ['s40', 's41', 's42', 's43', 's44', 's45']],
    ['Tổ tư vấn', ['s50', 's51', 's52', 's53']],
    ['Thành viên hội đồng', ['s60', 's61', 's62', 's63']],
    ['Quản trị hệ thống', ['s70', 's71', 's72', 's73', 's74']],
    ['Công khai', ['s80']],
  ];
  O.screen('catalog', {
    title: 'Danh mục màn hình', code: 'S00', crumbs: [],
    render() {
      const journeys = [
        ['Chủ thể nộp hồ sơ và bổ sung', 'store', 's10', ['s10', 's13', 's14', 's15', 's16', 's17', 's18', 's19']],
        ['Tổ tư vấn thẩm định rồi sao chép', 'clipboard-check', 's50', ['s50', 's51', 's52', 's53']],
        ['Thành viên điều chỉnh và xác nhận phiếu', 'user-check', 's60', ['s60', 's61', 's62', 's63']],
      ];
      const total = O.GROUPS.reduce((a, g) => a + g[1].length, 0) + 1;
      return `
      <section class="hero">
        <div class="hero-main">
          <div class="row s8"><span class="hero-tag">Bản mẫu bấm được</span><span class="hero-tag">${total} màn hình</span><span class="hero-tag">7 vai trò</span></div>
          <h1 style="font-size:28px">Hệ thống đánh giá, phân hạng sản phẩm OCOP</h1>
          <p style="max-width:560px;color:rgba(255,255,255,.92)">Thiết kế giao diện theo bản mô tả rút gọn cho ${D.tinh}. Bấm vào một màn hình để mở, dùng nút vai trò ở đầu trang để xem menu của từng người dùng, và thanh "Trạng thái mẫu" để xem các trạng thái trống, lỗi, khóa.</p>
          <div class="hero-meta"><span class="row s8">${ic('smartphone')} Nút khung di động ở đầu trang</span><span class="row s8">${ic('sun-moon')} Giao diện sáng và tối</span></div>
        </div>
        <div class="hero-side">${journeys.map(([t, i, go]) => `<button class="hero-pill" data-go="${go}" style="cursor:pointer;text-align:left">${t}</button>`).join('')}</div>
      </section>
      <div class="grid g-3">${journeys.map(([t, i, go, ids]) => O.card(`<div class="stack s12"><div class="row s8" style="flex-wrap:wrap">${ids.map((x, k) => `<a href="#${x}" class="tag">${O.screens[x]?.code || x.toUpperCase()}</a>${k < ids.length - 1 ? `<span class="faint">${ic('arrow-right')}</span>` : ''}`).join('')}</div>${O.btn('Bắt đầu hành trình', { kind: 'soft', icon: 'play', go, size: 'sm' })}</div>`, { title: `<span class="nav-ico" style="background:var(--brand-soft);color:var(--brand);margin:0">${ic(i)}</span>${t}` })).join('')}</div>
      ${O.GROUPS.map(([g, ids]) => `<section class="stack s12"><div class="row"><h2>${g}</h2><span class="badge-n soft">${ids.length}</span></div><div class="cat-grid">${ids.map((id) => { const s = O.screens[id]; if (!s) return `<div class="cat-item" style="opacity:.5"><span class="cc">${id.toUpperCase()}</span><div><b>Chưa dựng</b></div></div>`; const R = s.roles[0] ? O.ROLES[s.roles[0]] : null; return `<a class="cat-item" href="#${id}"><span class="cc">${s.code}</span><div><b>${esc(s.title)}</b><span>${R ? esc(R.name) : 'Không cần đăng nhập'}${s.device ? ' · ' + s.device : ''}</span></div></a>`; }).join('')}</div></section>`).join('')}`;
    },
  });
})();
