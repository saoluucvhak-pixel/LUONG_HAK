# Cài đặt hệ thống — định dạng số tiền và khối lượng

## Phạm vi
- Cho phép chọn **Số nguyên** (0 chữ số thập phân) hoặc **Số thập phân** (0–6 chữ số) riêng cho nhóm **Số tiền** và **Khối lượng**.
- Cho phép ghi đè theo từng cột bằng khóa định danh cột ổn định.
- Mặc định: số tiền = nguyên; khối lượng = 2 chữ số thập phân. Không tự động đổi các thiết lập đã lưu.
- Hiển thị phân cách nghìn bằng dấu chấm, phần thập phân bằng dấu phẩy, căn phải.
- Ngày luôn dd/MM/yyyy và căn giữa.

## Mẫu JSON
```json
{
  "schemaVersion": 1,
  "money": {"mode": "integer", "digits": 0},
  "quantity": {"mode": "decimal", "digits": 2},
  "columns": {
    "SO_TIEN_THANH_TOAN": {"mode": "integer", "digits": 0},
    "KL_BDMT": {"mode": "decimal", "digits": 6},
    "KL_MT": {"mode": "decimal", "digits": 3}
  }
}
```

## Thiết kế màn hình Cài đặt
- Nhóm 'Định dạng số liệu': hai hàng 'Số tiền' và 'Khối lượng', mỗi hàng có lựa chọn Số nguyên / Số thập phân.
- Khi chọn Số thập phân, hiện bộ chọn số chữ số 0,1,2,3,4,5,6. Chọn Số nguyên thì khóa bộ chọn và dùng 0.
- Bảng 'Ghi đè theo cột' hiển thị tên màn hình, tên cột, loại dữ liệu, chế độ, số chữ số, bản xem trước.
- Nút 'Xem trước', 'Lưu', 'Khôi phục mặc định'; yêu cầu quyền quản trị để sửa cấu hình toàn hệ thống.
- Cấu hình toàn hệ thống lưu tập trung với phiên bản và lịch sử thay đổi; cache được làm mới khi phiên bản đổi. Tránh mỗi máy tự lưu một cấu hình khác nhau.
- Cài đặt hiển thị không được làm thay đổi dữ liệu gốc hoặc công thức tính. Việc làm tròn nghiệp vụ phải có quy tắc riêng và được phê duyệt.

## Đồng bộ xuất báo cáo
- WebApp, offline, Excel, PDF, bản in phải cùng dùng cấu hình độ chính xác theo cột tại thời điểm kết xuất.
- XLSX giữ số thực và định dạng number format; PDF và in dùng định dạng hiển thị. Tổng cộng tính từ dữ liệu chính xác rồi định dạng.
- Nếu người dùng muốn tối đa N chữ số nhưng không hiển thị số 0 thừa, dùng minDecimals=0/maxDecimals=N; chế độ hiện tại mặc định hiển thị đúng N chữ số để căn hàng nhất quán.
- Cần thêm kiểm thử nhập liệu, báo cáo đa trang, số âm, 6 chữ số thập phân, và so sánh Excel/PDF.
