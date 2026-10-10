# AUDIT_REPORT — Kiểm toán mã nguồn LUONG_HAK

- **Phiên bản kiểm toán:** 1.3.0 · commit `78a612cc7d874c77916f143d00508e6e6bbddd90`
- **Ngày:** 10/10/2026 · **Nhánh sửa lỗi:** `claude/dazzling-cray-idw87u` (không sửa `main`)
- **Phạm vi:** toàn bộ `LuongHAK_Offline/` (app.js 1.216 dòng, engine.js, hr.js, main.js, preload.js, index.html, style.css, package.json), 13 file Google Apps Script `.gs`, `appsscript.json`, workflow GitHub Actions.
- **Phương pháp:** đọc toàn bộ mã · tái hiện lỗi bằng script Node/Playwright · xác nhận trên Electron thật (33.2.0 và 43.7.9) · so sánh hồi quy với engine v1.3.0.

Mức độ: **Critical** = mất/sai dữ liệu tiền lương hoặc chức năng cốt lõi không chạy · **High** = có thể sai tiền/dữ liệu trong tình huống thường gặp · **Medium** = rủi ro trong tình huống ít gặp hoặc thiếu kiểm soát · **Low** = bảo trì/hiển thị.

Vị trí dòng ghi theo commit `78a612c`. Trạng thái: ✅ đã sửa ở Phase 1 · ⚠ giảm thiểu, còn tồn tại · ⏳ để Phase sau · ❓ cần chủ sở hữu quyết định.

---

## 1. Tổng hợp

| Mức | Số lỗi | Đã sửa | Còn mở |
|---|---|---|---|
| Critical | 6 | 5 | 1 (GAS-01, cần chủ sở hữu quyết định) |
| High | 12 | 10 | 2 (SEC-03 giảm thiểu; ARCH-01 kế hoạch Phase 2) |
| Medium | 13 | 8 | 5 |
| Low | 6 | 4 | 2 |

---

## 2. Danh sách lỗi

### 2.1 Critical

| ID | File · hàm · vị trí | Nguyên nhân | Hậu quả | Phương án sửa | Test xác nhận | TT |
|---|---|---|---|---|---|---|
| **BUG-001** | `app.js` · `fieldInputs` · dòng 394–395 | Ô tiền định dạng hiển thị `fmt()` → "300.000", khi lưu lại parse bằng `E.num()` (dấu chấm = thập phân) → 300 | **Mở form phụ lục lương rồi bấm Lưu (không sửa gì) làm hỏng số tiền**: đơn giá 300.000 → 300; mọi số tiền < 1.000.000 có 1 dấu chấm bị chia 1.000. Ảnh hưởng: Lương thỏa thuận CN1/CN2/SP, Lương cơ bản, Giá trị khen thưởng (bản 1.1–1.3) | Thêm `core/validate.parseMoney/normMoney` hiểu định dạng VN; form dùng parser mới; dữ liệu đã hỏng **không khôi phục được tự động** → `integrity.check` cảnh báo mọi phụ lục có Lương < 1.000 | `core.test` parseMoney; E2E "Lương thỏa thuận lưu đúng"; UI test 300.000 giữ nguyên sau mở+lưu | ✅ |
| **BUG-002** | `engine.js` · `num` dòng 12; mọi ô tiền trong bảng nhập (Thưởng, Tạm ứng, Số tiền danh mục…) · `app.js` dòng 298 | Ô nhập lưu nguyên chuỗi người dùng gõ; engine đọc "500.000" = 500 | **Gõ tiền kiểu Việt Nam "500.000" bị tính thành 500đ** (thưởng, tạm ứng, trừ khác, đơn giá, phụ cấp…) | Engine dùng `money()` cho các trường tiền; ô nhập chuẩn hóa ngay khi gõ (`normCell`); nâng cấp dữ liệu đã lưu (`normalizeDataset`: "500.000" → "500000") | `engine.test` BUG-002; `regression` "khác biệt có chủ đích"; `core.test` normalizeDataset | ✅ |
| **BUG-003** | `app.js` · `chotKy` dòng 735 · `nghiViec` dòng 533 | Dùng `window.prompt()` — **Electron không hỗ trợ** (xác nhận trên Electron 33.2.0: *"prompt() is and will not be supported"*) | Trong **bộ cài .exe 1.2–1.3, nút "Chốt kỳ lương" không làm gì**; từ 1.1 nút "Cho nghỉ việc" không chạy. Chỉ bản chạy trình duyệt hoạt động | Thay bằng hộp nhập của app `askText()` | E2E "Chốt kỳ lương (hộp nhập của app…)", "Mở chốt không cho để trống lý do" | ✅ |
| **BUG-004** | `app.js` · khởi tạo `db` dòng 41 | `JSON.parse` lỗi → bị nuốt, rơi về `{}` rồi lần lưu kế tiếp **ghi đè file dữ liệu hỏng bằng dữ liệu trống** | Một lần file bị lỗi (mất điện, ổ đĩa) → **mất toàn bộ dữ liệu**, kể cả bản sao lưu trong ngày (xem BUG-005) | `main/storage.load` trả lỗi có cấu trúc; app vào **chế độ khôi phục, chặn ghi**, liệt kê bản sao lưu; file hỏng được cất sang `data.corrupt_*.json.bak` (không xóa) | `storage.test` "file hỏng…"; E2E "File hỏng → màn hình khôi phục", "KHÔNG bị ghi đè", "Khôi phục từ bản sao lưu" | ✅ |
| **BUG-005** | `main.js` · `store-save` dòng 23 | Mỗi lần lưu (mỗi 0,4 giây khi gõ) copy file hiện tại **đè** lên `backups/data_<ngày>.json` | Bản sao lưu trong ngày luôn bằng trạng thái mới nhất → **xóa nhầm/nhập sai buổi chiều thì không còn bản sáng để khôi phục**; dữ liệu trống (BUG-004) cũng bị chép đè vào bản sao lưu | Sao lưu **đầu ngày** (trạng thái trước mọi thay đổi trong ngày, không ghi đè); thêm sao lưu khi mở app (10 bản), trước nhập Excel/mở chốt/khôi phục/xóa; tự sao lưu khi dữ liệu giảm >50%; không bao giờ sao lưu file hỏng | `storage.test` "sao lưu đầu ngày…", "giảm >50%", "không sao lưu file hỏng" | ✅ |
| **GAS-01** | `appsscript.json` · `webapp.access` = `ANYONE_ANONYMOUS`, `executeAs` = `USER_DEPLOYING`; `Webapp.gs` không kiểm tra người dùng; `setXFrameOptionsMode(ALLOWALL)` | Web app chạy dưới quyền người triển khai, cho phép **bất kỳ ai có link, không cần đăng nhập** | Ai có URL có thể xem/sửa/xóa bảng lương, nhân sự trên Google Sheets qua các hàm `gui*` (tính lương, sửa danh mục, xóa giao dịch…); có thể bị nhúng vào trang khác | Đổi `access` → `DOMAIN` (Google Workspace) hoặc `ANYONE` kèm danh sách email được phép kiểm tra trong từng hàm `gui*`; bỏ `ALLOWALL` | ❓ — **cần chủ sở hữu xác nhận** vì thay đổi cách người dùng hiện tại truy cập bản Google | ❓ |

### 2.2 High

| ID | File · hàm · vị trí | Nguyên nhân | Hậu quả | Phương án sửa | Test | TT |
|---|---|---|---|---|---|---|
| **BUG-006** | `app.js` · `loadRows` dòng 152–171, `importFile`, `importAllFile` | Nhập Excel luôn `push` thêm dòng | **Nhập lại cùng file chấm công → công bị cộng 2 lần → lương gấp đôi**; tương tự sản lượng, tạm ứng, hồ sơ | `core/importer`: khóa nghiệp vụ theo bảng (VD chấm công = Kỳ + Mã NV + Hình thức công) → **cập nhật thay vì thêm trùng**; chặn trùng y hệt; xem trước trước khi ghi | `core.test` "nhập chấm công 2 lần…", integration "nhập lại cùng file KHÔNG làm tăng lương" | ✅ |
| **BUG-007** | `app.js` · `importAllFile`, Trang chủ & Sao lưu | Khóa kỳ đã chốt chỉ ẩn nút ở từng bảng; nhập "file Excel tổng" bỏ qua khóa | Có thể ghi dữ liệu vào **kỳ đã chốt** | Importer phân loại `locked`; ô nhập/dán chặn đổi ngày/kỳ sang kỳ đã chốt | `core.test` (locked); UI test | ✅ |
| **BUG-008** | `app.js` · `chotKy` dòng 732–743 | Chốt `st.kq` đang hiển thị — có thể là kết quả cũ trước khi người dùng sửa chấm công ở tab khác | **Chốt sai số** (bảng lương cũ) | Luôn tính lại khi chốt; nếu khác bảng đang xem thì dừng và yêu cầu kiểm tra lại | Code review + UI test | ✅ |
| **BUG-009** | `app.js` · `chotKy` | `saveNow()` không trả kết quả; chốt luôn báo thành công | Chốt "thành công" nhưng **chưa ghi xuống đĩa** (đĩa đầy, quyền ghi) → mất khi đóng app | `saveNow()` trả true/false; thất bại → hoàn tác chốt (`rollbackClose`) và báo lỗi | `core.test` rollback | ✅ |
| **BUG-010** | `app.js` · `moChot` dòng 744–748 | Mở chốt **xóa** bản chốt | Mất vết kỳ lương đã trả, không đối chiếu được trước/sau điều chỉnh | Mở chốt bắt buộc lý do, chuyển bản cũ sang `kyluong_lichsu` (giữ nguyên), chốt lại = phiên bản mới; màn hình so sánh trước/sau | `core.test` chốt/mở chốt; integration; E2E | ✅ |
| **BUG-011** | `app.js` · `cellText` dòng 148 | Excel lưu CCCD/SĐT dạng số → mất số 0 đầu (049… → 49…) | Sai CCCD/SĐT trong hồ sơ, báo cáo, đối chiếu | Cột định danh luôn là chữ; bù số 0 khi CCCD 11 số / SĐT 9 số; chuẩn hóa dữ liệu đã lưu | `core.test` normId, normalizeDataset | ✅ |
| **BUG-012** | `engine.js` · `kyChamCong`, `ky` | Chỉ nhận đúng `YYYY-MM-DD`/`YYYY-MM`; ngày "15/09/2026", kỳ "09/2026" bị **bỏ qua im lặng**. Kỳ "2026-9" được engine tính nhưng **không hiện** trên bảng chấm công | Thiếu công/tạm ứng/thưởng khi tính lương mà không có cảnh báo | Chuẩn hóa ngày/kỳ khi nhập, khi gõ và khi nâng cấp dữ liệu; `integrity.check` báo dòng ngày sai "bị BỎ QUA khi tính lương" | `core.test` normDate/normKy/integrity | ✅ |
| **BUG-013** | `app.js` · `render` dòng 1183 | Không có xử lý lỗi | Một lỗi dữ liệu → **trắng toàn màn hình** | Bọc `render()`: hiện thẻ lỗi + nút về Trang chủ + Sao lưu ra file | Code review | ✅ |
| **BUG-014** | `app.js` · khôi phục dòng 1139 | Nhận mọi JSON, ghi đè không sao lưu | Chọn nhầm file → mất toàn bộ dữ liệu | Kiểm tra cấu trúc, hiển thị so sánh số liệu hiện tại/file, tự sao lưu trước khi khôi phục | E2E khôi phục; code review | ✅ |
| **SEC-01** | `package.json` · `electron 33.2.0` | Electron 33 **hết hỗ trợ bảo mật từ 04/2025** (bản 33 cuối: 33.4.11) | Không nhận bản vá Chromium | Nâng lên **Electron 43.7.9** (dòng còn hỗ trợ); kiểm thử E2E trên 43.7.9 | E2E 16/16 trên 43.7.9 | ✅ |
| **SEC-03** | `xlsx.full.min.js` (SheetJS **0.18.5**) | Bản npm cuối cùng của SheetJS; có lỗ hổng đã công bố khi **đọc file độc hại**: prototype pollution (CVE-2023-30533, vá ở 0.19.3) và ReDoS (CVE-2024-22363, vá ở 0.20.2) | File Excel độc hại có thể làm treo app hoặc thay đổi hành vi trong cửa sổ app | Giảm thiểu: giới hạn file 20 MB; renderer không có Node, có CSP. **Cần thay bằng 0.20.3** từ `cdn.sheetjs.com` (mạng phiên làm việc này chặn tên miền này) | — | ⚠ |
| **ARCH-01** | `app.js` 1.216 dòng | Giao diện, điều phối nghiệp vụ, báo cáo, nhập liệu nằm chung 1 IIFE; trạng thái toàn cục `db`, `st` | Khó kiểm thử, dễ phát sinh lỗi khi mở rộng | Phase 1 đã tách `core/` (validate, importer, integrity, payroll-close) và `main/storage.js` có test; Phase 2 tách tiếp theo `docs/ARCHITECTURE.md` | — | ⏳ |

### 2.3 Medium

| ID | Vị trí | Vấn đề | Phương án | TT |
|---|---|---|---|---|
| BUG-015 | `engine.js` dòng 305 | Thực lĩnh âm bị đặt = 0 **im lặng**, khoản thiếu (tạm ứng lớn hơn lương) không được ghi nhận | Thêm cảnh báo rõ số tiền thiếu; ❓ quy tắc chuyển khoản thiếu sang kỳ sau cần nghiệp vụ xác nhận (Q-05) | ✅ cảnh báo · ❓ quy tắc |
| BUG-016 | `engine.js` TNCN lũy tiến | Thiếu mã giảm trừ / biểu thuế hiệu lực → giảm trừ = 0, thuế bị tính cao, không cảnh báo | Thêm cảnh báo | ✅ |
| BUG-017 | `hr.js` `staffForPayroll` | NV "Đã nghỉ việc" nhưng HĐ chưa có ngày chấm dứt vẫn được tính lương; chuyển khoản thiếu số TK không cảnh báo | Thêm cảnh báo khi tính lương + kiểm tra dữ liệu | ✅ |
| BUG-018 | `engine.js` `tongHopTan` dòng 127 | Một phiếu cân nhập nhiều dòng (chia nhiều người) — không kiểm tra tổng ≤ KL gốc | Cảnh báo đối chiếu; ⏳ mô hình Sản lượng gốc / phân bổ / tính lương ở Phase 4 | ⚠ |
| BUG-019 | `main.js` | Có thể mở 2 cửa sổ app cùng ghi 1 file → ghi đè lẫn nhau | `requestSingleInstanceLock` | ✅ |
| BUG-020 | `app.js` `hrForm` | Thêm bản ghi trùng khóa (VD 2 phụ lục cùng ngày hiệu lực, 2 nhân thân cùng tên) | Chặn trùng theo khóa nghiệp vụ | ✅ |
| SEC-02 | `main.js`, `index.html` | Không chặn mở cửa sổ/điều hướng ngoài; không có CSP; `sandbox` không khai báo | `setWindowOpenHandler deny`, chặn `will-navigate`, `sandbox:true`, CSP chặt (`connect-src 'none'`) | ✅ |
| SEC-04 | Toàn app | Không có đăng nhập/phân quyền; dữ liệu nhạy cảm (CCCD, tài khoản, lương) lưu **không mã hóa** trong `%APPDATA%` | Phase 6: xác thực + mã hóa file (xem ARCHITECTURE §Bảo mật — giới hạn của app offline) | ⏳ |
| SEC-05 | Build | 8 lỗ hổng *moderate* trong **công cụ build** (sprintf-js qua `electron-builder → @electron/get → global-agent`); runtime: **0** | Không chạy `npm audit fix --force` (đề xuất hạ electron-builder — breaking). Theo dõi, nâng khi có bản vá | ⚠ |
| CI-01 | `.github/workflows/build-exe.yml` | Chỉ build, không test | Thêm job cú pháp, lint, test, audit, E2E trước build | ✅ |
| CI-02 | `package.json` | Không có `package-lock.json` → build không tái lập | Thêm lockfile, CI dùng `npm ci` | ✅ |
| BUS-01 | `engine.js` | Phụ lục có hiệu lực giữa tháng áp dụng cho **cả tháng**, không chia tỷ lệ | ❓ Q-01 | ❓ |
| PERF-01 | `hr.js` `staffForPayroll`, `hienHanh`, `rowsOf` | Mỗi nhân viên lọc lại toàn bộ bảng hồ sơ → O(n²): 5.000 NV mất ~1,3 giây (đo thực tế, `tests/perf/bench.js`); danh sách nhân sự gọi `hienHanh` cho từng dòng | Phase 2: lập chỉ mục theo Mã NV một lần mỗi lượt tính / SQLite có index | ⏳ |

### 2.4 Low

| ID | Vấn đề | TT |
|---|---|---|
| LOW-01 | Mã chết: `importCsv`, `xls`, `cellText`, `pad2`, biến `YN`, `back` | ✅ xóa |
| LOW-02 | `slipEl` lấy tháng/năm từ trạng thái giao diện thay vì kỳ của kết quả | ⏳ |
| LOW-03 | Không có nhật ký thao tác | ✅ `auditlog` (chốt, mở chốt, nhập Excel, khôi phục, xóa, nghỉ việc, nạp danh mục) |
| LOW-04 | Dữ liệu cũ còn trong localStorage sau khi chuyển sang file | ⏳ |
| LOW-05 | Lint: không có cấu hình | ✅ `eslint.config.js`, 0 lỗi/0 cảnh báo |
| LOW-06 | `HUONG_DAN.md` lẫn trong thư mục app | ✅ chuyển nội dung vào `docs/USER_GUIDE.md` |

---

## 3. Kiểm tra kiến trúc (tóm tắt)

| Hạng mục | Hiện trạng v1.3.0 | Đánh giá |
|---|---|---|
| Tách lớp | engine.js (thuần tính toán, test được) và hr.js (nghiệp vụ nhân sự) tách khỏi giao diện; còn lại dồn trong app.js | Trung bình |
| Hàm quá dài | `tabLuong`/`renderKq` ~90 dòng, `grid` ~80 dòng, `tinhBangLuong` ~170 dòng | Cần tách ở Phase 2 |
| Trạng thái toàn cục | `db`, `st` dùng chung toàn app.js | Rủi ro khi mở rộng |
| Phụ thuộc vòng | Không có (engine ← hr ← app) | Tốt |
| Trùng lặp | Đọc ngày/kỳ lặp lại ở engine, app, báo cáo | Đã gom vào `core/validate` |
| Công thức | Hard-code trong engine.js; tham số trong danh mục | Phase 4: rule engine |
| Lưu trữ | 1 file JSON, ghi toàn bộ mỗi lần lưu | Phù hợp ≤ vài nghìn NV; SQLite ở Phase 2 (`MIGRATION_PLAN.md`) |
| Bản Google Apps Script (.gs) | Sản phẩm riêng, chung nguồn công thức với engine offline | Ngoài phạm vi sửa Phase 1, trừ GAS-01 |

## 4. Rủi ro mất dữ liệu (đã xử lý ở Phase 1)

1. File dữ liệu hỏng → bị ghi đè trống (BUG-004) ✅
2. Bản sao lưu bị ghi đè trong ngày (BUG-005) ✅
3. Mở form làm hỏng số tiền (BUG-001) ✅ — dữ liệu đã hỏng ở bản cũ được **cảnh báo** để nhập lại
4. Khôi phục nhầm file (BUG-014) ✅
5. Mở chốt xóa bản chốt (BUG-010) ✅
6. Hai cửa sổ ghi đè nhau (BUG-019) ✅
7. Gỡ cài đặt: `deleteAppDataOnUninstall: false` (đã khai báo tường minh) ✅

## 5. Câu hỏi nghiệp vụ cần xác nhận

Xem `docs/BUSINESS_RULES.md` mục "Câu hỏi mở" (Q-01 … Q-10). Phase 1 **không thay đổi bất kỳ công thức tiền lương nào**; mọi khác biệt so với v1.3.0 đã được kiểm thử hồi quy phân loại (`docs/TEST_RESULTS.md`).

---

## 6. Kiểm toán lại cho 2.0 — giai đoạn ưu tiên 1 (HEAD `6a4e954`, 10/10/2026)

Phạm vi đọc lại: `app.js`, `engine.js`, `hr.js`, `core/*`, `main/storage.js`, `main.js`, `preload.js`, `index.html`, `style.css`, test, tài liệu, workflow CI.
Mỗi phát hiện được phân loại:

- **Tái hiện**: có script hoặc test chứng minh trên mã 1.4.0.
- **Mã nguồn**: xác nhận bằng đọc luồng mã, nay có test E2E hoặc unit chặn lại.
- **Rủi ro**: có căn cứ nhưng chưa xảy ra.
- **Quy tắc chưa rõ**: cần chủ sở hữu hoặc kế toán xác nhận.
- **Kiến trúc**: hạn chế về cấu trúc, xử lý ở giai đoạn sau.

### 6.1 Lỗi đã xác nhận và đã sửa
| ID | Mức | Loại | Vấn đề | Bằng chứng trên 1.4.0 |
|---|---|---|---|---|
| BUG-021 | High | Tái hiện | 1 file có 2 dòng chấm công cùng *Kỳ + Mã NV + Hình thức* (tách nửa tháng) → dòng sau bị coi là "trùng", **mất 15 công** | R1: 30 → 15 công; U-CC-02 thất bại trên 1.4.0 |
| BUG-022 | **Critical** | Tái hiện | Nhập bổ sung: ô **trống** trong file **xóa** dữ liệu đang có. Ví dụ file ngày 16–30 xóa ngày 1–15; file Nhân viên thiếu CCCD xóa CCCD. Nguyên nhân: SheetJS đọc `defval:""` và cập nhật bằng `Object.assign` | R2: 30 → 15 công; U-CC-05, U-CC-12 |
| BUG-023 | High | Tái hiện | Dữ liệu đang có 2 dòng cùng khóa → nhập lại chỉ cập nhật 1 dòng → **45 công** thay vì 30 | R3; U-CC-10 |
| BUG-024 | High | Tái hiện | Khóa không chuẩn hóa: "bt" khác "BT" → nhập lại **cộng đôi** (60 công) | R5; U-CC-09 |
| BUG-025 | Medium | Tái hiện | Bảng khác: 2 dòng cùng khóa nhưng khác dữ liệu trong 1 file → dòng sau bị bỏ im lặng (gắn "trùng") | U-CC-12 |
| BUG-026 | **Critical** | Mã nguồn | `ensureTables()` thay bảng **sai kiểu** (không phải danh sách) bằng bảng rỗng → lần lưu kế tiếp **mất cả bảng** | E2E "Cấu trúc nguy hiểm…" |
| BUG-027 | High | Mã nguồn | Mở file của **phiên bản mới hơn** (schemaVersion > 2): app vẫn chuẩn hóa và ghi đè theo cấu trúc cũ | E2E schemaVersion 3; U-SCH-01 |
| BUG-028 | High | Mã nguồn | Bản chạy trình duyệt: dữ liệu trong localStorage hỏng → coi là rỗng → bị ghi đè | review `app.js` (load) |
| BUG-029 | High | Mã nguồn | Màn hình khôi phục **cất file hỏng trước khi người dùng xác nhận**. Bấm Hủy thì lần mở sau app bắt đầu với dữ liệu trống (file hỏng vẫn được giữ) | review `recoveryScreen` |
| BUG-030 | High | Tái hiện | 2 bản sao lưu trong **cùng 1 giây** trùng tên → bản sau **ghi đè** bản trước | S1; U-STO-08 |
| BUG-031 | High | Tái hiện | Không có mã kiểm tra: bản sao lưu bị sửa hoặc hỏng (vẫn là JSON hợp lệ) vẫn được khôi phục | S2; U-STO-09 |
| BUG-032 | Medium | Tái hiện | Cất file hỏng 2 lần cùng giây → file hỏng trước bị đè | S3; U-STO-15 |
| BUG-033 | Medium | Mã nguồn | Bản sao lưu ghi không nguyên tử, không fsync. `save` không đọc lại để xác minh. File tạm sót lại khi mất điện. Lỗi đĩa không có thông báo dễ hiểu | U-STO-11..14, 16 (mô phỏng lỗi; bản cũ không cho mô phỏng nên không đối chiếu được) |
| BUG-034 | High | Mã nguồn | **Đổi Mã NV** đổi theo cả dữ liệu phát sinh của **kỳ đã chốt**; không chặn khi mã đã có trong bảng lương đã chốt | U-GRD-04, review `editBaseNV` |
| BUG-035 | High | Mã nguồn | Thay đổi **hồi tố** (phụ lục, hợp đồng, nhân thân, danh mục có hiệu lực, cho nghỉ việc lùi ngày) không có cảnh báo, không ghi nhật ký. Khôi phục bản sao lưu không báo **mất hoặc đổi kỳ đã chốt** | U-GRD-01..03, I-10 |
| BUG-036 | Medium | Mã nguồn | Không ghi **người thực hiện** (`nguoiChot` luôn rỗng). Nhật ký bị cắt ở 5.000 dòng mà không lưu lại | E2E "NGƯỜI THỰC HIỆN" |
| BUG-037 | Medium | Mã nguồn | Checksum của snapshot chỉ bao kết quả. Sửa **dữ liệu đầu vào đã chốt** không bị phát hiện | U-CLS-03 |
| BUG-038 | Medium | Mã nguồn | Nhập Excel lưu thất bại: dữ liệu nhập vẫn nằm trong bộ nhớ (chỉ hiện thông báo). Chỉ sao lưu trước nhập khi từ 20 dòng trở lên | review `importPreview` |
| BUG-039 | Low | Mã nguồn | "Kiểm tra dữ liệu" báo "cộng 2 lần" cho chấm công tách dòng **không trùng ngày** (thực tế tính đúng) | U-CC-10/11 |

### 6.2 Rủi ro có căn cứ — chưa xử lý ở giai đoạn này
| ID | Rủi ro | Hướng xử lý |
|---|---|---|
| RISK-01 | Lưu và sao lưu chậm hơn khoảng 2 lần (fsync, SHA-256, đọc lại). 5.000 NV: lưu ~170 ms, sao lưu ~250 ms. Ghi đồng bộ qua IPC nên có thể khựng giao diện | Giai đoạn 2: SQLite (`node:sqlite` có sẵn trong Electron 43 / Node 24.21, đã kiểm tra), ghi theo bản ghi |
| RISK-02 | Nhật ký và checksum FNV nằm trong cùng file dữ liệu. Phát hiện được sửa nhầm, **không chống** được người cố ý sửa file | Giai đoạn 6: ký số bản chốt, nhật ký tách file chỉ ghi thêm |
| RISK-03 | "Người thực hiện" là tài khoản Windows hoặc tên tự khai, **chưa xác thực** | Giai đoạn 6: đăng nhập và phân quyền (Q-16) |
| RISK-04 | Sửa trực tiếp một phụ lục cũ vẫn được phép (có cảnh báo + nhật ký trước/sau) thay vì bắt buộc lập phụ lục mới | Chờ Q-15 |
| SEC-03 | SheetJS 0.18.5 (đã giới hạn 20 MB) | Chờ mạng cho phép `cdn.sheetjs.com` |

### 6.3 Hạn chế kiến trúc (giai đoạn 2)
- `app.js` khoảng 1.500 dòng, trộn giao diện, nghiệp vụ và lưu trữ. Các phần đã tách được: `core/validate`, `importer`, `integrity`, `payroll-close`, `period-guard`, `schema`.
- Toàn bộ dữ liệu là 1 file JSON, mỗi lần lưu ghi lại cả file.
- Chưa có tầng phân quyền ở nghiệp vụ.

### 6.4 Danh sách ưu tiên đã thực hiện
1. Mất dữ liệu: BUG-022, 026, 027, 028, 029, 030, 031, 032, 033.
2. Sai lương: BUG-021, 023, 024.
3. Kiểm soát kỳ chốt và truy vết: BUG-034, 035, 036, 037, 038.
4. Thông điệp: BUG-025, 039.
