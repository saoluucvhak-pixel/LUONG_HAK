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
| P1-1 | P1 | `app.js:backupNow()` tại 4 nơi còn lại: `"truoc-nhap-excel"`, `"truoc-mo-chot"`, `"truoc-khoi-phuc"`, `"truoc-gop-cham-cong"` | Cùng mẫu lỗi P0-2 (bỏ qua giá trị trả về). 3/4 nơi có "before" + hoàn tác riêng khi `saveNow()` thất bại (nhập Excel, mở chốt, gộp chấm công) nên an toàn dù sao lưu phòng hộ này lỗi hay không; riêng "khôi phục" KHÔNG có đường hoàn tác khác (ghi đè `db` rồi `saveNow()` thành công thì dữ liệu cũ chỉ còn trong chính bản sao lưu này) VÀ hộp thoại của nó hứa trước "App sẽ tự sao lưu" — mức nghiêm trọng khác hẳn 3 nơi kia. | 3 nơi: giảm 1 lớp phòng vệ, không mất dữ liệu ngay. "Khôi phục": có thể mất dữ liệu hiện tại vĩnh viễn nếu sao lưu phòng hộ thất bại mà không ai biết — lời hứa trong hộp thoại bị phá vỡ âm thầm. | 3 nơi (nhập Excel, mở chốt, gộp chấm công): chỉ CẢNH BÁO trong toast/alert kết quả nếu sao lưu lỗi, không chặn (dùng `!!backupNow(tag)` + nối cảnh báo vào thông báo cuối). "Khôi phục": dùng `backupOrBlock()` — CHẶN CỨNG nếu không tạo được, đúng với lời đã hứa. | `node --check`/eslint sạch cho 4 vị trí sửa. Full suite 216/216. E2E 95/95, bao gồm đúng luồng "Khôi phục từ bản sao lưu tự động" (không false-positive với sao lưu hợp lệ). | ✅ Đã sửa, đã push |
| P1-2 | P1 | `app.js` nút "💾 Tạo bản sao lưu ngay" (`backupNow("thu-cong")`) | Khi `backupNow` trả `null`, toast hiện "Chưa có dữ liệu để sao lưu" — đúng khi chưa có file dữ liệu, nhưng SAI khi thực ra là sao lưu thất bại (đĩa đầy...) — thông báo gây hiểu nhầm, người dùng tưởng "không có gì để lưu" chứ không biết là đang lỗi. | Người dùng chủ quan không kiểm tra đĩa/quyền ghi vì tin "chưa có dữ liệu" là bình thường. | Thêm `storage.hasDataFile()` (`main/storage.js`, IPC `store-has-data-file` qua `main.js`/`preload.js`) — nút dùng để phân biệt rõ 2 trường hợp, báo đúng ("⚠ KHÔNG tạo được bản sao lưu — kiểm tra dung lượng đĩa/quyền ghi" khi thực sự lỗi). | `node --check`/eslint sạch cho 4 file sửa (app.js, main.js, preload.js, main/storage.js). Full suite 216/216, E2E 95/95. | ✅ Đã sửa, đã push |
| P0-3 | P0 (khả năng xảy ra THẤP qua UI hiện tại — xem cột cuối) | `app.js:chotKy()` | `core/integrity.js:check()` đã có sẵn mức "Critical" cho **Mã NV trùng** (đã có test `core.test.js:99` xác nhận), và `HR.staffForPayroll()` lặp trực tiếp qua `db.nhanvien` — 2 dòng cùng Mã NV mà đều có hợp đồng hiệu lực sẽ SINH RA 2 DÒNG LƯƠNG cùng mã, tức **trả lương 2 lần cho cùng 1 mã** nếu dữ liệu bị trùng. Nhưng `chotKy()` KHÔNG BAO GIỜ gọi `INT.check()` — lỗi Critical này không hề xuất hiện trong hộp thoại chốt, không có cách nào chặn được, chỉ hiện (nếu người dùng tự ý vào xem) ở trang chủ / màn "Kiểm tra dữ liệu". **Đã kiểm tra lại**: form "Thêm/Sửa nhân viên" (app.js:808, 837) đã chặn "Mã NV đã tồn tại", và nhập Excel qua `core/importer.js` xử lý trùng khóa thành "update" (gộp) hoặc báo lỗi rõ, không tạo dòng trùng mới — nên lỗi này khó xảy ra qua app hôm nay, chủ yếu là phòng hộ dữ liệu cũ/di trú hoặc sửa tay ngoài app (giống P0-4). | Chốt và trả lương trùng cho nhân viên bị lặp mã, mà hộp thoại chốt không hề nhắc tới — đúng kịch bản BLOCKER "Nhân viên trùng mã" ở mục IV.2 mà app hiện không chặn. | Thêm `INT.check(db).filter(level==="Critical")` ngay đầu `chotKy()`; có lỗi → `alert()` chặn cứng, KHÔNG có đường nào bỏ qua (không phải confirm có thể bấm "Đồng ý"), yêu cầu sửa dữ liệu trước. | Khối phát hiện (`INT.check` → Critical cho Mã NV trùng) đã có test `core.test.js:99`; phần nối vào `chotKy()` là code 6 dòng, rõ ràng đúng theo đọc code. Full suite 216/216 (không đổi, vì dữ liệu test không có Mã NV trùng), E2E 95/95 (không có lỗi Critical trong fixture → không gây false-positive). **Gap đã ghi nhận**: chưa có test E2E tái hiện trực tiếp "2 NV cùng mã → chốt bị chặn" — xem mục 2. | ✅ Đã sửa, đã push |
| P0-5 | P0 | `app.js:chotKy()` | `core/integrity.js:check()` đã phát hiện đúng "sản lượng/thưởng/tạm ứng bị cộng trùng" từ trước (mức "High": phiếu cân sanluong/bandam trùng khóa Phiếu cân+Mã NV → "CỘNG 2 LẦN"; psluong/ungluong cùng Số chứng từ nhiều dòng → "CỘNG NHIỀU LẦN") nhưng chỉ ở mức High, không được `chotKy()` chặn (chỉ chặn Critical sau khi sửa P0-3/P0-4) — tiền bị tính sai trực tiếp mà vẫn chốt được qua 1 lần "Đồng ý". **Đã audit `core/production-alloc.js`** (phân bổ sản lượng theo tổ): thuật toán `share = kl / present.length` tự bảo toàn khối lượng bằng thiết kế (tổng share luôn khớp đúng `kl` của từng phiếu, phần không chia được tách riêng vào `unallocated`, không có đường nào làm "tổng phân bổ vượt KL gốc") — không phải lỗi; rủi ro thật là cộng trùng khóa dữ liệu (đã có integrity.js phát hiện, chỉ thiếu bước chặn cứng. | Chốt với sản lượng/thưởng/tạm ứng bị double-count — đúng BLOCKER "sản lượng bị cộng trùng" mục IV.2, ảnh hưởng tiền trực tiếp như Mã NV trùng. | Mở rộng điều kiện chặn cứng đã có ở P0-3 trong `chotKy()`: ngoài `level === "Critical"`, chặn luôn khi `msg` khớp `/CỘNG (2 LẦN|NHIỀU LẦN)/` (các dòng High mà integrity.js tự ghi rõ là cộng trùng tiền). | Khối phát hiện có từ trước; phần nối thêm là 1 dòng regex filter. Full suite 216/216, E2E 95/95 (bao gồm luồng chia phiếu cân theo tổ — không false-positive). | ✅ Đã sửa, đã push |
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

## 1b. Phát hiện kiến trúc quan trọng (mục XIV.1) — CHƯA SỬA, cần phê duyệt phạm vi riêng

**Phân quyền (`need()` trong app.js) chỉ tồn tại ở tầng renderer (không đáng tin cậy), không được
main process (tầng đáng tin cậy của Electron) kiểm tra lại.** Đã đọc toàn bộ `main.js`: mọi IPC
handler (`store-save`, `store-backup`, `store-quarantine`, `store-read`, v.v. — xem `main.js:26-80`)
thực hiện NGAY hành động được yêu cầu, không kiểm tra ai đang gọi hay họ có quyền gì — toàn bộ việc
"ai được làm gì" (`need("payroll.close")`, `need("hr.edit")`, `need("system.admin")`…) chỉ là code
JS chạy trong CHÍNH renderer đang gọi IPC đó. `contextIsolation: true` + `nodeIntegration: false` +
`sandbox: true` (`main.js:86`) đã chặn renderer truy cập Node/fs trực tiếp — nhưng không chặn được
việc gọi thẳng `window.hakStore.save(...)` / `.backup(...)` / `.quarantine()` nếu có bất kỳ cách nào
chạy được JS tùy ý trong renderer (ví dụ 1 lỗ hổng khác như XSS từ nội dung file nhập/OCR được hiển
thị không an toàn — **chưa tìm thấy lỗ hổng cụ thể nào trong lượt audit này**, đây là phát hiện về
THIẾU LỚP PHÒNG VỆ ở tầng kiến trúc, không phải 1 lỗi khai thác được ngay).

Đúng với cảnh báo của mục XIV.1: "Không được coi việc ẩn nút trong UI là kiểm soát quyền đầy đủ" và
"Không cung cấp IPC cho phép renderer không được xác thực tùy ý đọc, ghi hoặc khôi phục toàn bộ dữ
liệu". Sửa đúng cách cần: main process tự giữ trạng thái đăng nhập/quyền (không tin dữ liệu renderer
gửi lên) và kiểm tra trước khi thực hiện mỗi IPC ghi/khôi phục — đây là thay đổi kiến trúc đáng kể
(ảnh hưởng toàn bộ luồng đăng nhập hiện tại), **không làm trong lượt này**, cần phê duyệt phạm vi
riêng (mục V/XIV của yêu cầu) trước khi bắt đầu, theo đúng nguyên tắc II.15.

## 1c. "Thiếu mã lương/tham số thiết yếu" (mục IV.2) — đã rà, 1 trường hợp sửa

Rà toàn bộ `out.canhbao.push(...)` trong `engine.js` liên quan "chưa có trong danh mục":

| Trường hợp | Hậu quả nếu bỏ qua | Quyết định |
|---|---|---|
| **Mã BHXH không có trong Danh mục bảo hiểm** (`engine.js:379`) | TOÀN BỘ khối BHXH (NLĐ + công ty) bị bỏ qua hoàn toàn cho người đó — thiếu nghĩa vụ đóng BHXH thật | **P0-6: đã nâng thành chặn cứng** (xem bảng lỗi), đã push |
| Mã lương không có trong Danh mục lương (`engine.js:261`) | Đã đọc kỹ `congChuan()`: vẫn có fallback hợp lý (số ngày − Chủ nhật, không về 0/garbage) — lương tính ra có thể sai CÁCH nhưng không phải 0 hay vô nghĩa | Giữ cảnh báo mềm — không đủ căn cứ nâng thành chặn cứng |
| Mã thuế TNCN không có trong danh mục (`engine.js:395`) | Có fallback AN TOÀN (tạm tính lũy tiến — thiên về đóng thuế dư chứ không thiếu) | Giữ cảnh báo mềm — fallback đã bảo vệ đúng hướng |
| Có mã BHXH nhưng chưa có Lương cơ bản, quy chế 2026 (`engine.js:358`) | Đã xác nhận trước đó khớp đúng báo cáo Excel thật (không phải lỗi, là chủ ý) | Giữ nguyên |
| Các khoản trừ vượt thu nhập → thực lĩnh = 0 (`engine.js:413`) | Đã tự xử lý an toàn (không âm), chỉ cần người dùng xử lý tay phần còn thiếu | Giữ cảnh báo mềm |

| ID | Mức độ | File/Hàm | Nguyên nhân | Rủi ro nghiệp vụ | Giải pháp | Test | Trạng thái |
|---|---|---|---|---|---|---|---|
| P0-6 | P0 | `app.js:chotKy()` | Mã BHXH của nhân viên không khớp Danh mục bảo hiểm → `bh=null` → bỏ qua HOÀN TOÀN khối BHXH (CTY+NLĐ) cho người đó trong `engine.js`. `chotKy()` chỉ coi đây là cảnh báo mềm (`w`, 1 confirm có thể bỏ qua). | Thiếu nghĩa vụ đóng BHXH thật cho 1 người — rủi ro truy thu/phạt BHXH, giống P0-3/4/5. | Thêm bước chặn cứng lọc `fresh.canhbao` theo mẫu "chưa có trong Danh mục bảo hiểm" trong `chotKy()`. | Full suite 216/216, E2E 95/95 (chạy 3 lần — 2 lần gặp đúng flake OCR đã biết từ P0-1, không liên quan; xác nhận bằng cách chạy lại bản gốc). | ✅ Đã sửa, đã push (`835e085`) |

## 2b. `core/allocation.js` — đã audit, không phát hiện lỗi

Đọc toàn bộ file (chia chi phí lương theo phòng ban cho báo cáo kế toán, dùng thuật toán
"largest remainder" để chia số tiền theo tỷ lệ, luôn bảo đảm tổng các phần = đúng số gốc). Đã có 4
test (`tests/unit/allocation.test.js`) kiểm tra đúng bất biến này + các tình huống điều chuyển phòng
ban giữa kỳ (Q-19/R-53). Không phát hiện lỗi.

## 3. Việc tiếp theo (đề xuất, chưa làm)

- Viết E2E trực tiếp cho P0-3/P0-4/P0-5/P0-6 (tiêm dữ liệu lỗi thẳng vào `data.json` giữa các bước,
  giống cách các test "Cấu trúc nguy hiểm" đã làm — xem mục 2).
- Phần còn lại của mục IV (quy trình phê duyệt lương — mục V), VI-X (HRM, chấm công, OCR, sản
  lượng, engine công thức khác), XI-XX (kiến trúc, SQLite, hiệu suất, bảo mật/mã hóa, UI, sao
  lưu/phục hồi, kiểm thử/CI mở rộng, Windows) — chưa bắt đầu, cần phê duyệt phạm vi riêng theo
  nguyên tắc II.15.
