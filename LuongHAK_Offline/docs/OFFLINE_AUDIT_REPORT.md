# OFFLINE_AUDIT_REPORT.md — LUONG_HAK Offline (giai đoạn 1 — P0)

Nhánh: `feature/offline-v2-hardening` (tạo từ `origin/claude/v2-ocr-ky-hieu`).
Phạm vi: chỉ `LuongHAK_Offline/`. Không đụng WebApp Google Apps Script.

## 0. Xác minh commit/nhánh (Bước 1)

- Yêu cầu nêu Head SHA `62d897e330ff66d4658b9de315ee8e4b96cb254f`. Commit này **có thật và nằm trên
  `claude/v2-ocr-ky-hieu`**, nhưng **không còn là head** — nhánh đã có thêm các commit sau đó
  (đến `fe3bdd7` tại thời điểm audit). Cả hai cùng version `2.0.0-alpha.22` (chưa bump).
- Đáng chú ý: trong các commit sau `62d897e` có 1 commit (`1e1431c`) sửa công thức KPCĐ rồi bị
  **hoàn tác ngay sau đó** (`fe3bdd7`) với lý do "đổi công thức chưa được duyệt". Đây là minh
  chứng thực tế cho nguyên tắc "không tự ý đổi công thức lương chưa phê duyệt" — áp dụng cho toàn
  bộ phần X (engine) của audit này: mọi phát hiện liên quan công thức lương/BH/thuế được báo cáo,
  **không tự sửa**, trừ khi đã có xác nhận của người có thẩm quyền.
- `docs/` chưa tồn tại trong repo trước lần audit này (không có `AUDIT_REPORT.md`,
  `ARCHITECTURE.md`, `BUSINESS_RULES.md`… cũ) — các tài liệu này cần được TẠO MỚI, không phải cập
  nhật tài liệu cũ.

## 1. Danh sách lỗi

| ID | Mức độ | File/Hàm | Nguyên nhân | Rủi ro nghiệp vụ | Giải pháp | Test | Trạng thái |
|---|---|---|---|---|---|---|---|
| P0-1 | P0 | `app.js:chotKy()` + `core/payroll-close.js:totals()` | Kiểm tra "dữ liệu đã đổi từ lần tính trước" chỉ so **tổng** thực lĩnh công ty + số NV (`CLS.totals`). Hai nhân viên đổi lương ngược dấu nhau (A +1tr, B −1tr) làm tổng & số NV y nguyên dù bảng lương thực tế đã khác người/khác số → app cho chốt thẳng, không cảnh báo. | Chốt sai bảng lương mà không ai biết — tiền trả cho từng người sai, dù tổng chi của công ty đúng. | Thêm `CLS.diffDetailed(kqA, kqB, fields)` so sánh TỪNG chỉ tiêu (phòng ban, chức vụ, công, các loại lương, BH, thuế, tạm ứng, thực lĩnh…) của TỪNG nhân viên theo khóa Mã NV; `chotKy()` dùng hàm này để chặn & hiện bảng chi tiết trước khi cho chốt lại. | `tests/unit/payroll-close.test.js` (mới, 4 test) — tái hiện đúng kịch bản "2 NV đổi ngược dấu" làm RED với `totals()`, GREEN với `diffDetailed()`. Full suite 216/216, E2E 95/95 (chạy 2 lần). | ✅ Đã sửa, đã push (`b48f787`) |
| P0-2 | P0 | `app.js:backupNow()` dùng tại 2 nơi: xóa 1 nhân viên (nút 🗑 hồ sơ NV) và "Xóa toàn bộ dữ liệu" (Công ty & Sao lưu) | `backupNow(tag)` có thể trả `null` khi sao lưu thất bại (đĩa đầy, mất quyền ghi — đã có `U-STO-16`/`U-STO-11`/`U-STO-12` xác nhận `storage.backup()`/`storage.save()` có thể lỗi; `main.js:29` bắt exception và trả `null` qua IPC), nhưng 2 nơi gọi **bỏ qua hoàn toàn giá trị trả về** và vẫn tiến hành xóa. "Xóa toàn bộ dữ liệu" còn tệ hơn: sau đó ghi nhật ký "đã sao lưu trước khi xóa" dù việc sao lưu có thể đã thất bại — nhật ký nói sai sự thật. | Xóa dữ liệu KHÔNG THỂ HOÀN TÁC (hồ sơ 1 người, hoặc gần như toàn bộ CSDL) mà không có bản sao lưu nào để khôi phục, trong khi app/nhật ký vẫn báo như đã an toàn. | Thêm `backupOrBlock(tag, label)`: gọi `backupNow()`, nếu thất bại (trả rỗng) → DỪNG hành động, báo lỗi rõ, không xóa gì. Áp dụng cho 2 nơi trên. | Xác minh qua test `storage-failures.test.js` đã có (U-STO-16 v.v. chứng minh `backup()` có thể thất bại) + đọc code `main.js:29` xác nhận lỗi luôn trả `null` qua IPC, không throw ra renderer. Full suite 216/216, E2E 95/95 (đường thường, không mô phỏng lỗi đĩa ở tầng E2E). | ✅ Đã sửa, đã push (`2d23c97`) |
| P1-1 | P1 | `app.js:backupNow()` tại 4 nơi còn lại: `"truoc-nhap-excel"` (962→trước nhập Excel), `"truoc-mo-chot"` (trước mở chốt kỳ), `"truoc-khoi-phuc"` (trước khôi phục từ bản sao lưu), `"truoc-gop-cham-cong"` (trước gộp chấm công) | Cùng mẫu lỗi P0-2 (bỏ qua giá trị trả về) nhưng mức độ thấp hơn vì hành động theo sau **không phải xóa không-hoàn-tác tức thì**: mở chốt vẫn giữ bản chốt cũ trong lịch sử (`CLS.reopen` không xóa gì); nhập Excel có bước xem trước; khôi phục đọc từ 1 bản sao lưu khác (không phụ thuộc bản mới tạo). Vẫn là lỗ hổng: nếu sao lưu an toàn thất bại đúng lúc đó, người dùng không được cảnh báo. | Giảm 1 lớp phòng vệ (defense-in-depth), chưa chắc gây mất dữ liệu ngay vì còn lớp khác, nhưng nên sửa nhất quán. | Áp dụng `backupOrBlock()` (đã có) hoặc tối thiểu cảnh báo (không cần chặn cứng) tùy từng hành động — cần xem từng nơi cụ thể, không gộp 1 commit để tránh rủi ro tái cấu trúc quá lớn (nguyên tắc II.15). | Chưa viết — để ở TODO giai đoạn 1 tiếp theo. | ⏳ Chưa sửa (ghi nhận, chưa làm) |
| P1-2 | P1 | `app.js` nút "💾 Tạo bản sao lưu ngay" (`backupNow("thu-cong")`) | Khi `backupNow` trả `null`, toast hiện "Chưa có dữ liệu để sao lưu" — đúng khi chưa có file dữ liệu, nhưng SAI khi thực ra là sao lưu thất bại (đĩa đầy...) — thông báo gây hiểu nhầm, người dùng tưởng "không có gì để lưu" chứ không biết là đang lỗi. | Người dùng chủ quan không kiểm tra đĩa/quyền ghi vì tin "chưa có dữ liệu" là bình thường. | Phân biệt rõ 2 trường hợp (không có file dữ liệu vs. ghi thất bại) ở tầng `main/storage.js:backup()` (hiện trả `null` cho cả 2 trường hợp) hoặc báo chung nhưng rõ hơn ("không sao lưu được — kiểm tra đĩa"). | Chưa viết. | ⏳ Chưa sửa (ghi nhận, chưa làm) |
| P0-3 | P0 (khả năng xảy ra THẤP qua UI hiện tại — xem cột cuối) | `app.js:chotKy()` | `core/integrity.js:check()` đã có sẵn mức "Critical" cho **Mã NV trùng** (đã có test `core.test.js:99` xác nhận), và `HR.staffForPayroll()` lặp trực tiếp qua `db.nhanvien` — 2 dòng cùng Mã NV mà đều có hợp đồng hiệu lực sẽ SINH RA 2 DÒNG LƯƠNG cùng mã, tức **trả lương 2 lần cho cùng 1 mã** nếu dữ liệu bị trùng. Nhưng `chotKy()` KHÔNG BAO GIỜ gọi `INT.check()` — lỗi Critical này không hề xuất hiện trong hộp thoại chốt, không có cách nào chặn được, chỉ hiện (nếu người dùng tự ý vào xem) ở trang chủ / màn "Kiểm tra dữ liệu". **Đã kiểm tra lại**: form "Thêm/Sửa nhân viên" (app.js:808, 837) đã chặn "Mã NV đã tồn tại", và nhập Excel qua `core/importer.js` xử lý trùng khóa thành "update" (gộp) hoặc báo lỗi rõ, không tạo dòng trùng mới — nên lỗi này khó xảy ra qua app hôm nay, chủ yếu là phòng hộ dữ liệu cũ/di trú hoặc sửa tay ngoài app (giống P0-4). | Chốt và trả lương trùng cho nhân viên bị lặp mã, mà hộp thoại chốt không hề nhắc tới — đúng kịch bản BLOCKER "Nhân viên trùng mã" ở mục IV.2 mà app hiện không chặn. | Thêm `INT.check(db).filter(level==="Critical")` ngay đầu `chotKy()`; có lỗi → `alert()` chặn cứng, KHÔNG có đường nào bỏ qua (không phải confirm có thể bấm "Đồng ý"), yêu cầu sửa dữ liệu trước. | Khối phát hiện (`INT.check` → Critical cho Mã NV trùng) đã có test `core.test.js:99`; phần nối vào `chotKy()` là code 6 dòng, rõ ràng đúng theo đọc code. Full suite 216/216 (không đổi, vì dữ liệu test không có Mã NV trùng), E2E 95/95 (không có lỗi Critical trong fixture → không gây false-positive). **Gap đã ghi nhận**: chưa có test E2E tái hiện trực tiếp "2 NV cùng mã → chốt bị chặn" — xem mục 2. | ✅ Đã sửa, đã push |
| P0-4 | P0 (khả năng xảy ra THẤP qua UI hiện tại — xem cột cuối) | `app.js:chotKy()` | Biến `badDay` (số ô chấm công không hợp lệ trong kỳ — số âm, chữ lạ, ngày ngoài tháng, dùng `VAL.dayCell().error`, đã kiểm tra chỉ bắt lỗi thật sự không đọc được, không phải cảnh báo nhẹ) được tính và hiển thị với icon "⛔" trong hộp thoại chốt, NHƯNG không hề được dùng để chặn — chỉ có `w` (cảnh báo `canhbao` của engine) mới bắt buộc 1 lần `confirm()`; nếu `w === 0` mà `badDay > 0`, người dùng bấm "🔒 Chốt kỳ lương" là chốt được ngay, không có bước xác nhận nào dù icon ngụ ý chặn. | Chốt với ô chấm công không đọc được (ví dụ số công âm) — đúng BLOCKER "Ô chấm công không hợp lệ" ở mục IV.2. **Đã kiểm tra lại cả 3 đường ghi vào `db.chamcong`**: nhập tay trên lưới (chặn "-1" ngay khi gõ — đã có test E2E dòng 94-103), nhập Excel, và OCR (cả hai đều đi qua CÙNG `core/importer.js` dùng `V.dayCell()`, dòng "invalid" bị loại khỏi bước ghi) — cả 3 đều đã lọc ô lỗi TRƯỚC khi vào `db.chamcong`. Vì vậy `badDay > 0` hiện chỉ có thể xảy ra với dữ liệu CŨ (từ bản trước khi có kiểm tra này) hoặc dữ liệu bị sửa trực tiếp ngoài app (file `data.json`) — không qua được bằng cách dùng app bình thường hôm nay. | Thêm `if (badDay) { alert(...); return; }` ngay sau khi tính `badDay`, trước khi mở hộp thoại chốt — chặn cứng cho đúng với icon "⛔" đã hiển thị từ trước (sửa cho nhất quán + phòng hộ dữ liệu cũ/sửa tay ngoài app), không qua được bằng bất kỳ xác nhận nào. | `VAL.dayCell()` đã có bộ test riêng (`tests/unit/daycell.test.js`). Full suite 216/216, E2E 95/95 (dữ liệu chấm công hợp lệ → không trigger false-positive). **Gap tương tự P0-3**: chưa có E2E trực tiếp — và vì khó tái hiện qua UI (xem cột Nguyên nhân), test trực tiếp sẽ cần tiêm dữ liệu lỗi vào `data.json` giữa các bước E2E (giống cách các test "Cấu trúc nguy hiểm" đã làm) thay vì qua lưới/Excel/OCR. | ✅ Đã sửa, đã push |

## 2. Điều kiện nghiệm thu CHƯA đạt (báo rõ theo mục XXII)

- **Windows thực tế**: môi trường hiện tại là Linux container (không có máy Windows). E2E ở trên
  chạy bằng Electron thật + Playwright qua `xvfb-run` (Linux, có màn hình giả) — xác nhận được
  logic ứng dụng, **không xác nhận được** hành vi riêng của Windows (installer, signtool, đường
  dẫn, quyền NTFS, Windows Defender…). Mục XVIII "Windows Tests" và mục XXI.8 "Bộ cài Windows"
  chưa thể nghiệm thu từ phiên làm việc này.
- **SQLite / mã hóa / quy trình phê duyệt / kiến trúc src/** (mục V, VI.2, XII, XIV, XI): chưa bắt
  đầu — đây là các khối việc độc lập, rủi ro cao (đổi lưu trữ, đổi luồng xác thực), cần phê duyệt
  phạm vi riêng trước khi làm theo đúng nguyên tắc II.15 ("không tái cấu trúc toàn bộ một lần").
- **Công thức lương/BH/thuế (mục X)**: chưa rà soát sâu trong lượt này ngoài phần KPCĐ đã làm ở
  phiên trước (và đã bị hoàn tác vì chưa được duyệt — xem mục 0). Mọi phát hiện công thức tiếp
  theo sẽ được báo cáo kèm bảng tác động từng nhân viên, **chờ xác nhận trước khi sửa** (theo yêu
  cầu của người dùng — không tự sửa như lần KPCĐ).
- **E2E trực tiếp cho P0-3/P0-4**: 2 BLOCKER mới (Mã NV trùng, ô chấm công không hợp lệ) mới được
  xác minh gián tiếp (khối phát hiện đã có test riêng + đọc code nối vào `chotKy()` + hồi quy
  95/95 không có false-positive). Chưa có test E2E tái hiện trực tiếp "dữ liệu lỗi → bấm Chốt bị
  từ chối" như đã làm cho P0-1. Cần bổ sung ở lượt tiếp theo.

## 3. Việc tiếp theo (đề xuất, chưa làm)

- **"Sản lượng phân bổ vượt sản lượng gốc / cộng trùng"** (mục IV.2, IX.3): `core/integrity.js`
  hiện chỉ cảnh báo Medium khi 1 phiếu cân bị chia nhiều dòng (không tính tổng có vượt KL gốc hay
  không); `core/production-alloc.js`/`core/allocation.js` chưa được audit trong lượt này — cần
  đọc kỹ để xác nhận có/không có kiểm tra `tổng phân bổ + chưa phân bổ = KL gốc` ở tầng nhập liệu.
- **"Thiếu mã lương/tham số thiết yếu"** (mục IV.2): `canhbao` (cảnh báo của engine) đã có một số
  trường hợp (ví dụ mã lương không có trong danh mục — xem `hr.js:314-316`) nhưng tất cả đều chỉ
  là cảnh báo mềm (`w`, có thể bấm "Đồng ý" bỏ qua) — cần rà lại xem trường hợp nào thực sự PHẢI
  chặn cứng như Mã NV trùng / ô chấm công, trường hợp nào hợp lý để giữ dạng xác nhận.
- Viết E2E trực tiếp cho P0-3/P0-4 (xem mục 2).
