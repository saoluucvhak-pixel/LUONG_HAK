# RELEASE_NOTES — Nhân sự - Tiền lương HAK 1.4.0

**Ngày:** 10/10/2026 · **Loại:** bản sửa lỗi quan trọng (Phase 1) — **khuyến nghị cài cho mọi máy đang dùng 1.1–1.3.**

## Vì sao nên nâng cấp ngay
1. **Bản 1.2–1.3 cài trên Windows không chốt được kỳ lương** (nút Chốt không phản hồi), nút *Cho nghỉ việc* không chạy. Đã sửa.
2. **Số tiền có thể bị sai**: mở rồi lưu lại form phụ lục lương làm đơn giá như 300.000 thành 300; gõ "500.000" ở bảng Thưởng/Tạm ứng bị hiểu là 500đ. Đã sửa; dữ liệu dạng "500.000" tự chuẩn hóa. **Số đã bị lưu sai ở bản cũ không tự khôi phục được** — xem mục *Kiểm tra dữ liệu* để tìm và nhập lại.
3. **An toàn dữ liệu**: file dữ liệu hỏng không còn bị ghi đè trống; sao lưu đầu ngày không còn bị ghi đè; có màn hình khôi phục và danh sách bản sao lưu.
4. **Nhập Excel không còn tạo dòng trùng** (nhập lại chấm công trước đây làm lương gấp đôi).

## Có gì mới
- Trung tâm nhập Excel có xem trước và danh sách lỗi.
- Phiên bản kỳ lương: mở chốt bắt buộc lý do, giữ bản cũ, so sánh trước/sau, kiểm tra toàn vẹn.
- Quản lý sao lưu, Kiểm tra dữ liệu, nhật ký thao tác, thêm cảnh báo khi tính lương.
- Electron 43 (bản cũ 33 đã hết hỗ trợ bảo mật).

## Sau khi cài
1. Mở app — dữ liệu cũ tự nâng cấp (app tạo bản sao lưu `startup_…` trước).
2. Vào **Công ty & Sao lưu → Kiểm tra dữ liệu**, xử lý các mục *Critical/High*.
3. Tính lại các kỳ chưa chốt.

## Giới hạn còn tồn tại
- Thư viện đọc Excel SheetJS 0.18.5 có lỗ hổng đã biết khi mở **file Excel độc hại**: chỉ nhập file từ nguồn tin cậy (giới hạn 20 MB). Sẽ vá khi có bản 0.20.3.
- Chưa có đăng nhập/phân quyền; file dữ liệu **chưa mã hóa** — ai dùng được máy tính đều đọc được `%APPDATA%\Tinh Luong HAK`.
- Một số quy tắc lương cần kế toán xác nhận (phụ lục giữa tháng, trần BH, tiền cơm và thuế…) — xem `BUSINESS_RULES.md`.
- Bộ cài chưa ký số → Windows có thể cảnh báo "Windows protected your PC" (bấm *More info → Run anyway*).
- Bản Google Apps Script (thư mục gốc repo) đang mở web app cho mọi người có link — cần chủ sở hữu quyết định (GAS-01).

## Rollback
Khi mở 1.4.0 lần đầu, app tự tạo bản `truoc-nang-cap_….json` chứa **nguyên trạng dữ liệu của bản cũ** (trước mọi chuyển đổi). Muốn quay về 1.3.0: cài lại 1.3.0 → *Sao lưu → Khôi phục từ file* → chọn file `truoc-nang-cap_…` trong `%APPDATA%\Tinh Luong HAK\backups\` (lưu ý: dữ liệu nhập sau khi nâng cấp sẽ không có trong bản này).
