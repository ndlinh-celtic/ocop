# Chuỗi hash audit được niêm phong theo lô, không tính trong transaction

Audit phải phát hiện được sửa hoặc xóa, nhưng một chuỗi `prev_hash` tính ngay lúc INSERT buộc mọi transaction ghi phải xếp hàng sau một khóa toàn cục. Ta để use case ghi audit không có hash; worker cứ mỗi phút niêm phong các dòng tạo trước đó ít nhất 30 giây, gán **số thứ tự niêm phong** và hash nối tiếp, ghi một checkpoint mỗi lô. Thứ tự chuỗi là thứ tự niêm phong, không phải thứ tự ID (ID sinh ở nhiều tiến trình nên không trùng thứ tự commit). Một lệnh kiểm tra tính lại chuỗi hằng đêm, và hash cuối mỗi ngày được neo ra ngoài DB (bucket có Object Lock hoặc email cho kiểm toán) để người có quyền DB không viết lại được cả chuỗi.

## Consequences

Có một cửa sổ khoảng một phút mà dòng audit chưa được bảo vệ bằng hash; trong cửa sổ đó, user DB của ứng dụng vẫn chỉ có quyền INSERT trên `audit_log`.
