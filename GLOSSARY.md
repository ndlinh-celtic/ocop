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
_Avoid_: Nhóm quyền, quyền

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

## Quan hệ

- Một **Chủ thể** có đúng một **Người dùng** đại diện ở Đợt 1, liên kết qua một **Phân vai** Chủ thể.
- "Đã xác thực" là trạng thái của **Chủ thể** (giấy tờ pháp lý hợp lệ); xác nhận email là việc của **Người dùng**.
- Chủ tịch UBND tỉnh không phải **Người dùng**; quyết định thành lập hội đồng được lưu dưới dạng tệp.
