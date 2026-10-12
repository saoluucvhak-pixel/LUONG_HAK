# BUG_FIX_REPORT — Phase 1

Mỗi mục: lỗi (xem `AUDIT_REPORT.md`) → thay đổi → file → test → rollback.
Rollback chung: cài lại bộ cài 1.3.0 **và** dùng *Khôi phục từ file* của 1.3.0 để nạp `backups\truoc-nang-cap_*.json` (app 1.4.0 tạo 1 lần khi chuyển đổi dữ liệu cũ — chứa nguyên trạng trước khi chuyển đổi) — cách an toàn nhất. Về cấu trúc, dữ liệu 1.4.0 chỉ **thêm** khóa (`kyluong_lichsu`, `auditlog`, `schemaVersion`, các trường mới trong snapshot) và giữ nguyên cấu trúc `kq`, nên 1.3.0 *dự kiến* đọc được; điều này **chưa được kiểm thử** — ưu tiên khôi phục bản `startup_*`.

| Lỗi | Thay đổi | File | Test |
|---|---|---|---|
| BUG-001 form làm hỏng tiền | Parser tiền VN `parseMoney/normMoney`; form tiền dùng parser mới; kiểm tra số tiền không hợp lệ khi lưu; `integrity.check` cảnh báo dữ liệu đã hỏng | `core/validate.js` (mới), `app.js` `fieldInputs`, `hrForm`; `core/integrity.js` | U-VAL-01, E-10, UI |
| BUG-002 "500.000" = 500 | `engine.money()` cho mọi trường tiền; ô nhập chuẩn hóa khi gõ/dán; `normalizeDataset` sửa dữ liệu đã lưu | `engine.js`, `app.js` `grid`, `core/integrity.js` | U-ENG-13, R-02, U-INT-01 |
| BUG-003 `prompt()` không chạy trong Electron | Hộp nhập `askText()` của app cho chốt kỳ, mở chốt, cho nghỉ việc | `app.js` | E-04, E-05 |
| BUG-004 file hỏng bị ghi đè trống | `storage.load` trả lỗi; chế độ khôi phục chặn ghi; cất file hỏng | `main/storage.js` (mới), `main.js`, `preload.js`, `app.js` `recoveryScreen` | U-STO-03, E-13..16 |
| BUG-005 sao lưu bị ghi đè | Sao lưu đầu ngày / khi mở app / trước thao tác lớn / khi dữ liệu giảm >50%; ghi file nguyên tử + fsync | `main/storage.js` | U-STO-04..07 |
| BUG-006 nhập trùng | Importer theo khóa nghiệp vụ, xem trước, báo cáo lỗi tải về được | `core/importer.js` (mới), `app.js` Trung tâm nhập Excel | U-IMP-01..04, I-01 |
| BUG-007 nhập vào kỳ đã chốt | Importer phân loại `locked`; ô nhập/dán chặn chuyển sang kỳ đã chốt | `core/importer.js`, `app.js` `grid` | U-IMP-02 |
| BUG-008 chốt bảng cũ | Tính lại khi chốt, dừng nếu khác bảng đang xem | `app.js` `chotKy` | UI |
| BUG-009 chốt chưa lưu | `saveNow()` trả kết quả; rollback | `app.js`, `core/payroll-close.js` | U-CLS-02 |
| BUG-010 mở chốt xóa dữ liệu | Lịch sử chốt, phiên bản, lý do, so sánh trước/sau, checksum | `core/payroll-close.js` (mới), `app.js` `moChot`, `tabKyLuong` | U-CLS-01, I-06, E-05/06/09 |
| BUG-011 CCCD mất số 0 | Cột định danh là chữ + bù số 0 | `core/validate.js` | U-VAL-02, U-IMP-03 |
| BUG-012 ngày/kỳ sai bị bỏ qua | Chuẩn hóa ngày/kỳ; cảnh báo dòng bị bỏ qua | `core/validate.js`, `core/integrity.js` | U-VAL-02, U-INT-02 |
| BUG-013 trắng màn hình | Error boundary trong `render()` | `app.js` | review |
| BUG-014 khôi phục nhầm | Kiểm tra cấu trúc + so sánh + sao lưu trước khôi phục | `app.js` `restoreFromText` | E-15 |
| BUG-015/016/017 thiếu cảnh báo | Cảnh báo thực lĩnh âm, thiếu giảm trừ/biểu thuế, lương đóng BH quá nhỏ, nghỉ việc chưa chấm dứt HĐ, chuyển khoản thiếu số TK | `engine.js`, `hr.js` | U-ENG-12/14, I-04 |
| BUG-019 2 cửa sổ | `requestSingleInstanceLock` | `main.js` | — |
| BUG-020 trùng khóa trong form | Chặn bản ghi trùng khóa nghiệp vụ | `app.js` `hrForm` | — |
| SEC-01 Electron EOL | Electron 33.2.0 → 43.7.9; electron-builder 25.1.8 → 26.15.3 | `package.json`, `package-lock.json` | E-01..16 trên 43.7.9 |
| SEC-02 cứng hóa Electron | `sandbox`, chặn window.open/điều hướng, CSP | `main.js`, `index.html` | UI (không vi phạm CSP) |
| SEC-03 SheetJS 0.18.5 | Giảm thiểu: giới hạn file 20 MB (chưa nâng được — mạng chặn cdn.sheetjs.com) | `app.js` `readWorkbook` | — |
| CI-01/02 | Workflow: cú pháp, lint, test, audit, E2E → build; lockfile + `npm ci` | `.github/workflows/build-exe.yml`, `package-lock.json`, `eslint.config.js` | CI |
| LOW-01/03/05/06 | Xóa mã chết; nhật ký thao tác; lint; tài liệu vào `docs/` | `app.js`, `hr.js`, `docs/` | lint |
