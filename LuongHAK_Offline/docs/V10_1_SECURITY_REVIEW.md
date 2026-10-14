# V10.1 — Rà soát bảo mật (kiểm soát tại Main Process)

Phạm vi: ứng dụng Electron offline, nhiều tài khoản trên cùng một máy/tệp dữ liệu. Mô hình mối đe dọa: người dùng có tài khoản vai trò thấp cố nâng quyền, hoặc renderer bị lạm dụng (DevTools, bản vá renderer) để ghi/xuất vượt quyền.

## Đã kiểm soát tại Main (có test)

| Kiểm soát | Cơ chế | Test |
| --- | --- | --- |
| Quyền ghi theo bảng | `permsFor(table)` trong `write-policy.check` so với quyền của phiên do main giữ | `v92-write-policy` |
| Đặt lại Admin | Chỉ khi có phiên khôi phục do main cấp (mã đúng, tài khoản Admin, một lần, có hạn, khóa tạm sau 5 lần sai); đổi đúng 1 thông tin xác thực của chính tài khoản đó | U-V101-REC-01..03 |
| Duyệt nhân sự | Máy trạng thái Nháp→Chờ duyệt→Đã duyệt→Hiệu lực; người đề nghị không tự duyệt (trừ Admin), người duyệt là người đang đăng nhập; "Nghỉ việc" phải khớp thay đổi hợp đồng/nhân viên trong cùng lần lưu | `v101-security`, E2E |
| Chứng từ thanh toán | ĐÃ LẬP→ĐÃ DUYỆT→ĐÃ THANH TOÁN (hoặc ĐÃ HỦY có lý do); dòng đã thanh toán bất biến; người lập không tự duyệt | U-V101-PAY-01, E2E |
| Chốt kỳ | Bản chốt bất biến; main tính lại blocker + từng NV + phương pháp bù chính thức + checksum | U-WP-07, U-V101-CLOSE-01 |
| Xuất bảng lương / PDF | `checkExport` fail-closed (kỳ không rõ, dữ liệu không đọc được, engine lỗi, thanh toán chưa chốt, còn blocker ⇒ chặn) | U-V101-GATE-01/02 |
| Công thức Excel | Chuỗi dữ liệu bắt đầu `= + - @` thêm tiền tố `'`; PDF/HTML escape | U-V101-XLS-01, U-V101-PDF-01 |
| Nhật ký | Chỉ thêm, không sửa/xóa | `v92-write-policy` |
| CSP/HTML in | PDF dựng từ HTML không script, `default-src 'none'` | `report-html` |

Xuất file không phải thanh toán và không phải duyệt: trạng thái chứng từ chỉ đổi qua hành động lập/duyệt/ghi nhận.

## DESIGN_GAP — quyền ĐỌC

`store.load()` nạp **toàn bộ** DB vào bộ nhớ renderer trước khi đăng nhập. Vì vậy một người có thể mở DevTools/đọc tệp `data.json` và thấy dữ liệu ngoài vai trò (lương, CCCD, STK) dù giao diện ẩn. Main hiện **chỉ chặn ghi**, chưa lọc đọc. Đây **không** được tuyên bố là đã giải quyết.

Hướng xử lý (cần thiết kế và nghiệm thu riêng): nạp theo phiên sau đăng nhập, main trả bảng đã lọc theo vai trò; trường nhạy cảm mã hóa theo cột; kết hợp mã hóa tệp trên đĩa (`V10_1_PERFORMANCE.md` §6). Đến lúc đó, nên triển khai chỉ cho máy tin cậy và đặt quyền hệ điều hành cho thư mục dữ liệu.

## Giới hạn đã biết

1. Gate xuất file nhận diện theo tên file + kỳ trong tên; tệp đổi tên không chứa từ khóa lương/kỳ có thể lọt. Giảm thiểu: chặn khi "có vẻ" bảng lương mà không xác định kỳ. Hướng đúng: phiếu cấp phép xuất do main phát hành (chưa làm).
2. Chưa có vai trò "chỉ xem phiếu lương của chính mình"; mọi vai trò có `payroll.view` xem được toàn bộ bảng lương.
3. Dữ liệu `data.json` và sao lưu chưa mã hóa.
4. Tài khoản quản trị có thể thao tác mọi thứ (kể cả mở chốt) — có nhật ký nhưng không có đồng ký.
5. `npm audit --omit=dev`: 0 lỗ hổng tại thời điểm chạy (xem `V10_1_TEST_RESULTS.md`).
