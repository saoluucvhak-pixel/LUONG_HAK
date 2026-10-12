# CHANGELOG

## [1.4.0] — 10/10/2026 — Phase 1: kiểm toán & sửa lỗi nghiêm trọng
### Sửa lỗi
- **Số tiền**: form phụ lục lương không còn làm hỏng số tiền khi mở rồi lưu (300.000 → 300); gõ "500.000" ở mọi bảng được hiểu là 500.000đ; dữ liệu cũ dạng "500.000" tự chuẩn hóa. (BUG-001, BUG-002)
- **Chốt kỳ / Mở chốt / Cho nghỉ việc chạy được trong bản cài .exe** (trước đây dùng `prompt()` không được Electron hỗ trợ). (BUG-003)
- File dữ liệu hỏng không còn bị ghi đè bằng dữ liệu trống — app mở màn hình khôi phục. (BUG-004)
- Bản sao lưu trong ngày không còn bị ghi đè liên tục. (BUG-005)
- Nhập Excel không còn tạo dòng trùng (nhập lại chấm công không làm lương tăng gấp đôi). (BUG-006)
- Không thể nhập/dán/chuyển dữ liệu vào kỳ đã chốt. (BUG-007)
- Chốt luôn dùng số tính lại mới nhất; chỉ báo thành công khi đã ghi xuống đĩa. (BUG-008, BUG-009)
- CCCD/SĐT không còn mất số 0 đầu khi nhập Excel; ngày dd/mm/yyyy và kỳ "2026-9" được nhận đúng. (BUG-011, BUG-012)
- Lỗi hiển thị không còn làm trắng màn hình. (BUG-013)
### Thêm mới
- **Trung tâm nhập Excel**: xem trước, phân loại Thêm mới / Cập nhật / Trùng / Lỗi dữ liệu / Sai tham chiếu / Kỳ đã chốt, tải danh sách lỗi.
- **Phiên bản kỳ lương**: mở chốt bắt buộc lý do, giữ bản cũ trong lịch sử, chốt lại = phiên bản mới, so sánh trước/sau, kiểm tra toàn vẹn (checksum); snapshot lưu cả dữ liệu đầu vào và danh mục.
- **Quản lý sao lưu**: danh sách bản sao lưu tự động, khôi phục từng bản; sao lưu khi mở app, đầu ngày, **trước nâng cấp**, trước nhập Excel / mở chốt / khôi phục / xóa toàn bộ.
- **Kiểm tra dữ liệu**: trùng Mã NV/CCCD, chấm công trùng, ngày sai bị bỏ qua, lương nghi bị lỗi lưu, phiếu cân chia nhiều người…
- Cảnh báo khi tính lương: thực lĩnh âm, thiếu giảm trừ/biểu thuế, lương đóng BH quá nhỏ, NV nghỉ việc chưa chấm dứt HĐ, chuyển khoản thiếu số TK.
- Nhật ký thao tác (`auditlog`).
### Giao diện
- Giao diện mới **"Xanh ngọc & Champagne"**: giữ màu xanh HAK, menu nền xanh đậm, điểm nhấn vàng champagne, thẻ bo tròn có bóng mềm, số liệu thẳng cột.
- Icon nét mảnh đơn sắc (SVG) thay cho emoji ở menu, nút, tab, tiêu đề (`ui/icons.js`; nhãn trong mã nguồn giữ nguyên, chỉ đổi khi hiển thị).
- Font **Be Vietnam Pro** (SIL OFL 1.1) đóng gói sẵn trong app (`ui/fonts/`), chạy offline, hiển thị giống nhau trên mọi máy.
- Sửa: cột Mã NV ở bảng chấm công bị cắt; ngày trong các thẻ hồ sơ nhân viên hiện `dd/mm/yyyy`.
### Kỹ thuật
- Electron 33.2.0 (hết hỗ trợ) → **43.7.9**; electron-builder 26.15.3; `package-lock.json`.
- Cứng hóa bảo mật: sandbox, CSP, chặn cửa sổ/điều hướng ngoài, chỉ 1 cửa sổ app.
- Module mới: `core/validate.js`, `core/importer.js`, `core/integrity.js`, `core/payroll-close.js`, `main/storage.js`.
- Kiểm thử: 44 test unit/integration/regression, 23 kịch bản E2E Electron (gồm nâng cấp từ dữ liệu 1.3.0), benchmark hiệu năng; CI chạy lint + test + audit + E2E trước khi build.
- Tài liệu dự án trong `docs/`.

## [1.3.0] — 10/10/2026
- Báo cáo lương: theo phòng ban, tổng hợp công, phân bổ sản lượng, hạch toán, phiếu chi, so sánh kỳ, 12 tháng, thu nhập & thuế TNCN cả năm.
## [1.2.0] — 10/10/2026
- Chốt kỳ lương, khóa dữ liệu kỳ, xem lại, đối chiếu, mở chốt.
## [1.1.0] — 10/10/2026
- Hồ sơ nhân sự theo QL_NHANSU (hợp đồng, phụ lục, nhân thân…), báo cáo nhân sự, lương theo phụ lục hiệu lực, lưu ra file + sao lưu hằng ngày.
## [1.0.x] — 08/10/2026
- App tính lương offline (port từ Google Apps Script), bộ cài Windows, nhập/xuất Excel, file mẫu.
