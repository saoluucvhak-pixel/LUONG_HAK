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

---

# BUG_FIX_REPORT — 2.0 giai đoạn ưu tiên 1 (nhánh `claude/v2-phase1-data-fixes`)

**Rollback:** cài lại bộ cài 1.4.0, sau đó khôi phục `backups/*.json` gần nhất (bỏ qua file `.sha256`).

Giai đoạn này **không đổi cấu trúc** (`schemaVersion` vẫn là 2), chỉ **thêm trường**:
- `auditlog[].nguoi`
- `kyluong[].inputChecksum`
- file `backups/*.sha256`

Vì vậy bản 1.4.0 đọc được dữ liệu này. Công thức lương **không đổi**: hồi quy so với v1.3.0 vẫn trùng 100%.

### Phần nhập Excel và chấm công — BUG-021…025, 038
| | |
|---|---|
| **Vấn đề** | Mất công khi file tách dòng; ô trống xóa dữ liệu; cộng đôi do khóa không chuẩn hóa; dữ liệu trùng khóa sẵn có bị cập nhật lệch; xung đột bị bỏ im lặng; nhập lỗi lưu vẫn giữ trong bộ nhớ |
| **File** | `core/importer.js`, `core/validate.js` (chuẩn hóa *Hình thức công*), `core/integrity.js` (`mergeChamCong`, thông điệp mới), `engine.js` (xuất `tongHopChamCong` để kiểm thử, không đổi logic), `app.js` (`importPreview`, `planWorkbook`, nút gộp) |
| **Giải pháp** | Xem 5 điểm bên dưới bảng |
| **Kết quả** | R1 → 30 công · R2 → 30 · R3 → chặn (giữ 30) · R5 → 30; giao diện xem trước kiểm tra trong trình duyệt |
| **Test** | U-CC-01…12 (8/12 thất bại trên 1.4.0, 12/12 đạt), I-09, I-11, I-14 |
| **Rủi ro còn lại** | Q-12: 2 dòng cùng ngày cùng hình thức có thể là 2 buổi hợp lệ. Hiện bị chặn để người dùng quyết định |

Giải pháp gồm:
1. **Chuẩn hóa khóa**: kỳ về `YYYY-MM`, hình thức công viết hoa, để trống thì là BT.
2. **Nhiều dòng cùng khóa trong 1 file**: gộp theo từng ngày. Nếu cùng một ngày có dữ liệu ở cả 2 dòng thì **xung đột** và không ghi dòng nào.
3. **Dữ liệu đang có nhiều dòng cùng khóa**: chặn và hướng dẫn dùng nút *Gộp dòng chấm công trùng*. Nút này chỉ gộp các dòng không trùng ngày và không thuộc kỳ đã chốt; tổng công không đổi.
4. **Chế độ cập nhật**:
   - **Bổ sung** (mặc định): ô trống giữ nguyên dữ liệu.
   - **Ghi đè cả dòng**: báo trước số ô sẽ bị xóa.
   - Lý do hiển thị chi tiết từng ô thêm / sửa (trước → sau) / xóa / giữ.
5. **Sao lưu và hoàn tác**: luôn sao lưu trước khi nhập. Lưu thất bại thì hoàn tác toàn bộ lần nhập.

### Phần kỳ đã chốt — BUG-034, 035, 036, 037
| | |
|---|---|
| **Vấn đề** | Đổi Mã NV làm lệch dữ liệu kỳ chốt; thay đổi hồi tố không cảnh báo, không có vết; không biết ai chốt hay mở chốt; checksum không bao dữ liệu đầu vào |
| **File** | `core/period-guard.js` (mới), `core/payroll-close.js` (`inputChecksum`, `verify`), `app.js` (`guardChange`, `auditChange`, `hrForm`, `subTable`, `editBaseNV`, `nghiViec`, `grid`, `restoreFromText`, `cardNguoiDung`, `cardAudit`), `main.js` + `preload.js` (`whoami`) |
| **Giải pháp** | Xem 5 điểm bên dưới bảng |
| **Kết quả** | Snapshot đã chốt bất biến (I-10). Mọi đường ghi vào kỳ đã chốt bị chặn (I-11). E2E xác nhận có người thực hiện |
| **Test** | U-GRD-01…04, U-CLS-03, I-10, I-11, E2E "NGƯỜI THỰC HIỆN" |
| **Rủi ro còn lại** | RISK-02, RISK-03, RISK-04 |

Giải pháp gồm:
1. **Phân loại mọi thay đổi** thành 3 loại:
   - `locked` (dữ liệu phát sinh của kỳ đã chốt): **chặn**.
   - `retro` (dữ liệu có hiệu lực chồng lên kỳ đã chốt): **cảnh báo**, ghi nhật ký kèm trước/sau và nhãn *HỒI TỐ*. Hiệu lực của phụ lục tính tới trước phụ lục kế tiếp.
   - `none`: không ảnh hưởng.
2. **Đổi Mã NV**: chặn nếu mã đã có trong bảng lương đã chốt. Không bao giờ đổi trong `kyluong` / `kyluong_lichsu` / `auditlog`.
3. **Khôi phục**: liệt kê các kỳ đã chốt sẽ **mất** hoặc **đổi**, kiểm tra cấu trúc trước khi thay thế, chỉ cất file hỏng **sau khi** người dùng xác nhận.
4. **Người thực hiện**: tên khai trên máy cộng tài khoản Windows, ghi ở nhật ký, `nguoiChot` và `moChot.nguoi`. Có màn hình Nhật ký thao tác (xuất được Excel). Khi nhật ký vượt 20.000 dòng: sao lưu rồi mới cắt bớt.
5. **Checksum**: thêm `inputChecksum` cho dữ liệu đầu vào đã chốt.

### Phần sao lưu — BUG-030…033
| | |
|---|---|
| **Vấn đề** | Ghi đè bản sao lưu cùng giây; không phát hiện bản sao lưu hỏng; mất file hỏng; ghi không an toàn |
| **File** | `main/storage.js` (viết lại, giữ nguyên API), `main.js` (`store-verify`), `preload.js` (`verifyBackups`), `app.js` (`cardBackups`) |
| **Giải pháp** | Xem 4 điểm bên dưới bảng |
| **Kết quả** | S1–S3 đã sửa |
| **Test** | U-STO-01…07 (giữ nguyên) + U-STO-08…16; I-12, I-13; E2E SHA-256 |
| **Rủi ro còn lại** | RISK-01 (hiệu năng) |

Giải pháp gồm:
1. **Tên duy nhất**: thời điểm tới mili-giây + mã ngẫu nhiên, tạo bằng cờ loại trừ (`wx`), trùng thì thử lại.
2. **Ghi an toàn**:
   - file tạm riêng → fsync → rename → fsync thư mục;
   - đọc lại và so SHA-256 sau khi lưu;
   - dọn file tạm khi mở app;
   - thông báo lỗi dễ hiểu cho ENOSPC / EACCES / EPERM / EROFS.
3. **Kiểm tra bản sao lưu**:
   - mỗi bản có file `<tên>.sha256`;
   - `readBackup` từ chối bản không khớp;
   - nút *Kiểm tra tất cả bản sao lưu* hiện 4 trạng thái: nguyên vẹn / chưa có mã / hỏng / không đọc được.
4. **Dọn bản cũ**: sắp xếp theo thời điểm trong tên file, **không bao giờ xóa bản tốt mới nhất**. Cất file hỏng bằng tên duy nhất.

### Phần kiểm tra cấu trúc — BUG-026…029
| | |
|---|---|
| **Vấn đề** | Bảng sai kiểu bị thay bằng bảng rỗng; file của bản mới hơn bị ghi đè; dữ liệu trình duyệt hỏng bị ghi đè; cất file hỏng trước khi xác nhận |
| **File** | `core/schema.js` (mới), `app.js` (nạp dữ liệu, `ensureTables`, `recoveryScreen`, `restoreFromText`, `cardIntegrity`) |
| **Giải pháp** | Xem 4 điểm bên dưới bảng |
| **Kết quả** | E2E: file giữ nguyên **từng byte** với 2 kịch bản nguy hiểm |
| **Test** | U-SCH-01, U-SCH-02, I-13, I-14, E2E ×2 |
| **Rủi ro còn lại** | Chưa kiểm tra kiểu theo từng cột cho mọi bảng HR (ngoài ngày / tiền / kỳ / Mã NV) |

Giải pháp gồm:
1. **Kiểm tra trước khi chuyển đổi hay chuẩn hóa**, gồm:
   - phiên bản cấu trúc;
   - bảng phải là danh sách;
   - dòng phải là bản ghi;
   - Mã NV (thiếu / sai kiểu / thừa khoảng trắng);
   - ngày, tiền, kỳ;
   - tham chiếu Mã NV;
   - phụ lục ↔ hợp đồng;
   - kỳ chốt trùng hoặc bị sửa (checksum);
   - lịch sử chốt.
2. **Lỗi nghiêm trọng** (fatal) → chế độ chỉ xem / khôi phục, **không ghi** file.
3. **Lỗi dòng** → liệt kê ở *Kiểm tra dữ liệu*, **không tự xóa**. Bảng lạ được giữ nguyên.
4. `ensureTables` chỉ tạo bảng còn thiếu, không bao giờ thay thế bảng đã có.
