# AUDIT V2 — LUONG_HAK 2.0 (đợt PR1: rà soát + sửa lỗi còn lại)

- **Phạm vi:** nhánh `claude/v2-audit2-fixes`, tạo từ `claude/v2-guide` @ `8a9a2a2` (2.0.0-alpha.3). Đã kiểm tra HEAD các nhánh liên quan: `main`, `claude/dazzling-cray-idw87u`, `claude/v2-phase1-data-fixes`, `claude/v2-auth-rbac`, `claude/v2-guide`. Mỗi nhánh nối tiếp nhánh trước; `claude/v2-guide` là HEAD mới nhất.
- **Ngày:** 10/10/2026.
- **Nguyên tắc:**
  - Mọi lỗi có bằng chứng tái hiện (script hoặc test FAIL trên bản cũ).
  - Không đổi công thức tính lương.
  - Không tự xóa hay sửa dữ liệu người dùng.
  - Quy tắc nghiệp vụ chưa rõ được nêu thành câu hỏi Q-xx (xem `BUSINESS_RULES.md` §2).
- **Kiểm thử Windows:** chưa chạy trên máy Windows thật. CI chỉ **build** bộ cài trên `windows-latest`, chưa kiểm thử cài đặt hay chạy thực tế.

## 1. Kiến trúc hiện tại

```
┌──────────────────────── Renderer (Chromium, sandbox, contextIsolation, CSP) ────────────────────────┐
│ UI   app.js (1.785 dòng: màn hình, lưới nhập, form, nhập Excel, chốt kỳ)                            │
│      ui/icons.js · ui/guide.js · style.css · ui/fonts                                              │
│        │ gọi trực tiếp                                                                             │
│ Modules nghiệp vụ (core/*, UMD, test được trong Node)                                               │
│      validate (chuẩn hóa ô, ô ngày chấm công) · importer (plan/apply) · integrity (kiểm tra, gộp)    │
│      period-guard (kỳ chốt, hồi tố, Q-15) · payroll-close (snapshot, checksum) · schema · permissions│
│        │                                                                                           │
│ Engine  engine.js (công thức lương, ENGINE_VERSION 1.4.0 — KHÔNG đổi) · hr.js (hồ sơ → staffForPayroll)│
│        │                                                                                           │
│ Repository  ✗ CHƯA CÓ — app.js đọc/ghi thẳng object `db` trong bộ nhớ (PR3)                        │
└────────┼────────────────────────────────────────────────────────────────────────────────────────────┘
         │ window.hakStore (preload.js, ipcRenderer.sendSync — chỉ các lệnh liệt kê)
┌────────▼──────────── Main process (Node) ───────────────────────────────────────────────────────────┐
│ main.js (IPC, băm mật khẩu PBKDF2) → main/storage.js                                                │
│   DB      data.json (JSON, schemaVersion 2) — ghi nguyên tử tmp → fsync → rename → fsync thư mục    │
│           + đọc lại kiểm SHA-256                                                                    │
│   Backup  backups/*.json + .sha256 (tên duy nhất, không ghi đè, không xóa bản tốt cuối cùng)         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Nhận xét kiến trúc** (đưa vào PR3/PR4, không sửa ở PR1):
- **K-01:** không có lớp repository. 13 nhóm thao tác ghi nằm rải trong `app.js` (§3). Việc kiểm tra quyền và kỳ chốt được gọi lặp ở từng chỗ. Hiện tất cả đều có kiểm tra (§3), nhưng thêm màn hình mới dễ quên kiểm tra.
- **K-02:** mỗi lần lưu ghi lại toàn bộ file JSON: 169 ms ở 5.000 NV (RISK-01). Mục tiêu là SQLite `node:sqlite` (PR4; đã xác minh chạy được trên Electron 43 / Node 24.21).
- **K-03:** `staffForPayroll` / `hienHanh` quét toàn bộ bảng cho mỗi nhân viên, độ phức tạp O(N²) → ✅ đã sửa ở PR2 (alpha.5, chỉ mục Mã NV — `PERFORMANCE_REPORT.md`).

## 2. Danh sách vấn đề

Mức độ: Critical / High / Medium / Low.

| ID | Mức | File | Nguyên nhân | Tái hiện | Ảnh hưởng | Sửa | Test | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| A2-01 | High | `core/importer.js`, `app.js` (lưới, dán) | Ô ngày không được kiểm tra. `"-1"` được đọc thành 0 công + nhãn `"-1"`; số âm kiểu số (-1) bị **trừ** vào tổng công | Repro `v2.js`: import ô `-1`, `-0.5` → `invalid: 0`, không báo lỗi. E2E (code cũ): ô 06 nhận `-1` | Bảng chấm công sai mà không biết; số âm làm giảm lương | `VAL.dayCell()`: từ chối số âm. Nhập Excel → *Lỗi dữ liệu*; lưới → hộp báo lỗi, giữ giá trị cũ | U-CC-13, U-CC-15, E2E "ô '-1' bị từ chối" | ✅ Đã sửa |
| A2-02 | High | như trên | Regex `^(\d+…)(.*)$` lấy phần đầu là số, phần còn lại thành nhãn | `"1.5.2"` → 1,5 công + nhãn `.2`; `"abc"` vào như nhãn | Đọc sai số công, nhãn rác | Ô phải khớp đúng dạng `số[nhãn]` hoặc `nhãn`; nhãn bắt đầu bằng chữ | U-CC-13, U-CC-15 | ✅ Đã sửa |
| A2-03 | High | `core/importer.js`, `engine.js` (vòng `d = 1..31`) | Không đối chiếu số ngày của tháng | Repro: ngày 31/09 → `add: 1`, tổng công 1 | Công của ngày không tồn tại được **trả lương** | Nhập Excel / lưới / dán từ chối; lưới khóa cột ngày không tồn tại. Dữ liệu cũ: *Kiểm tra dữ liệu* báo High, hộp chốt kỳ báo số ô sai. **Engine giữ nguyên** (chờ Q-21) | U-CC-14, U-CC-15, U-CC-16, E2E "cột 31 tháng 9 bị khóa" | ✅ Chặn nhập mới · ⏳ dữ liệu cũ chờ Q-21 |
| A2-04 | Medium | `core/importer.js` | Số công > 3/ngày chỉ được cảnh báo **sau khi** đã ghi (trong *Kiểm tra dữ liệu*) | Repro: ô `7` nhập êm | Dễ bỏ sót lỗi gõ (7 thay cho 1) | Màn xem trước nhập Excel hiện cột *Cảnh báo* + tổng số dòng có cảnh báo; lưới báo ngay khi gõ. Không chặn (dòng TC có thể nhập giờ — Q-18) | U-CC-13, U-CC-15 | ✅ Đã sửa |
| A2-05 | Medium | `engine.js` §phụ cấp công tác | Nhãn không trùng mã phụ cấp bị bỏ qua, không báo gì | `1XYZ` → không có phụ cấp, không cảnh báo | Người nhập tưởng đã được tính phụ cấp công tác | Cảnh báo khi xem trước nhập Excel (không đổi công thức) | U-CC-15 | ✅ Đã sửa |
| A2-06 | High | `app.js` (dán Ctrl+V) | Ô lỗi được **đếm** nhưng vẫn ghi `cand[col] = nc.value` | E2E trên code cũ: dán `-1⇥1` vào ngày 13 → ô 13 = `-1` | Dữ liệu sai vào hệ thống dù có thông báo "ô sai định dạng" | Ô lỗi không được ghi; thông báo ghi rõ "KHÔNG dán" | E2E "Dán từ Excel" | ✅ Đã sửa |
| A2-07 | Low | `app.js` (lưới) | Lưới chấm công luôn hiện 31 cột ngày | Tháng 9 vẫn gõ được ngày 31 | Dẫn tới A2-03 | Khóa ô ngày không tồn tại khi ô trống; ô cũ có dữ liệu vẫn sửa được để xóa | E2E | ✅ Đã sửa |
| A2-08 | Medium | `engine.js` / `hr.js` (hiệu lực phụ lục) | Lấy phụ lục mới nhất có hiệu lực trong kỳ cho **cả tháng** | I-20: phụ lục 16/09 lên 26 tr → cả tháng 9 = 26 tr | Có thể trả dư hoặc thiếu nửa tháng | **Không sửa** (công thức) — hỏi Q-22 | I-20 (mô tả hành vi hiện tại) | ⏳ Chờ Q-22 |
| A2-09 | Medium | danh mục `dm_luong` mặc định | Chưa đặt *Ngưỡng truy thu BH (công)* | I-16 / I-19: 2 công vẫn trừ đủ BH 630.000 | Có thể thu BH sai khi vào làm / nghỉ giữa tháng | **Không sửa** (chính sách BH) — hỏi Q-23 | I-16, I-19 | ⏳ Chờ Q-23 |
| A2-10 | Low | `app.js` `nghiViec` | Đổi *Trạng thái* nhân viên không qua guard. Ngày chấm dứt HĐ (thứ quyết định tính lương) **có** qua guard | Đọc code | Không đổi bảng lương (trạng thái chỉ để cảnh báo) | Ghi nhận; gom vào repository ở PR3 | — | ⏳ PR3 |
| A2-11 | Low | `app.js` xóa nhân viên | Theo thiết kế, xóa hồ sơ không xóa chấm công / sản lượng | Đọc code + thông báo xác nhận | Còn dòng mồ côi; *Kiểm tra dữ liệu* báo "Mã NV không có trong Nhân sự" | Giữ nguyên (không xóa dữ liệu không nhận diện) | U-SCH-02 | Ghi nhận |
| SEC-03 | Medium | `xlsx.full.min.js` (SheetJS 0.18.5) | Bản npm cuối cùng có CVE-2023-30533 và CVE-2024-22363 khi đọc file độc hại | — | Đọc file Excel độc hại có thể treo app | Giữ giới hạn 20 MB + sandbox/CSP; thay bằng 0.20.3 khi mạng cho phép `cdn.sheetjs.com` (kiểm lại 10/10/2026: **403**). Xem §4 | — | ⏳ Chờ mạng |
| RISK-01 | Medium | `main/storage.js` | Mỗi lần lưu ghi lại toàn bộ JSON | 5.000 NV: lưu 169 ms, sao lưu ~250 ms | Chậm khi dữ liệu lớn | PR2 (chỉ mục) + PR4 (SQLite) | Benchmark PR2 | ⏳ PR2/PR4 |

**Bằng chứng tái hiện:**
- Script tái hiện chạy trên alpha.3; kết quả được dán nguyên văn ở `BUG_FIX_REPORT.md` (mục alpha.4).
- Test mới **FAIL** trên code cũ:
  - `tests/unit/daycell.test.js`: 4/5 FAIL. U-CC-17 chỉ ghi nhận hành vi hiện tại nên PASS trên cả hai bản.
  - E2E: 2/2 kiểm tra mới FAIL khi chạy với `app.js` cũ.

## 3. Rà soát đường ghi dữ liệu (`app.js`)

| # | Thao tác | Kiểm tra quyền | Kỳ đã chốt / hồi tố | Sao lưu / hoàn tác |
|---|---|---|---|---|
| 1 | Lưới: thêm dòng | `need(input.edit / dm.edit)` | Nút ẩn khi kỳ đã chốt | — |
| 2 | Lưới: sửa ô | `need` | Chặn dòng thuộc / chuyển vào kỳ chốt; danh mục hồi tố chỉ Admin + nhật ký trước/sau; **ô ngày: `dayCell`** (mới) | — |
| 3 | Lưới: dán Ctrl+V | `need` | Bỏ dòng thuộc kỳ chốt; danh mục khi đã có kỳ chốt chỉ Admin; **ô lỗi không ghi** (mới) | — |
| 4 | Lưới: xóa dòng | `need` | Chặn kỳ chốt; hồi tố chỉ Admin + nhật ký | — |
| 5 | Form hồ sơ (`hrForm`) | `need(hr.edit)` **trước** mọi thay đổi | Q-15 khóa phụ lục đã dùng; guard hồi tố; cascade Số HĐLĐ | — |
| 6 | Xóa dòng hồ sơ phụ (`subTable`) | `need` | Q-15; guard | — |
| 7 | Thêm nhân viên (wizard) | `need(hr.edit)` | NV mới, chưa có kỳ chốt | — |
| 8 | Sửa cơ bản / đổi Mã NV | `need(hr.edit)` | Chặn đổi mã đã có trong kỳ chốt (`references`) | — |
| 9 | Cho nghỉ việc | `need(hr.edit)` | Guard ngày chấm dứt HĐ (A2-10: trạng thái NV không qua guard) | — |
| 10 | Xóa nhân viên | `need(hr.edit)` | Có trong kỳ chốt → chỉ Admin | Sao lưu trước |
| 11 | Nhập Excel (1 bảng / cả file) | `need(import)` + quyền theo từng bảng | locked / retro / Q-15; xem trước bắt buộc; **ô ngày** (mới) | Sao lưu trước; lưu lỗi → hoàn tác |
| 12 | Gộp chấm công trùng | `need(input.edit)` | Bỏ qua nhóm thuộc kỳ chốt | Sao lưu trước; lưu lỗi → hoàn tác |
| 13 | Chốt / mở chốt / khôi phục / nạp mẫu / công ty / tài khoản | `need(payroll.close / payroll.reopen / backup.restore / system.admin)` | Chốt: tính lại trước khi chốt, **báo số ô chấm công sai** (mới); khôi phục: so sánh kỳ chốt trước/sau | Sao lưu trước; lưu lỗi → hoàn tác |

U-PERM-07 kiểm tra tự động rằng các hàm ghi chính có gọi `need(`.

## 4. Đánh giá thư viện Excel

| Phương án | Ưu | Nhược | Đánh giá |
|---|---|---|---|
| **SheetJS 0.20.3** (cdn.sheetjs.com) | Thay tại chỗ, cùng API → không đổi code nhập/xuất; vá cả 2 CVE; đọc `.xls`, `.csv` | SheetJS không còn phát hành trên npm; cần tải từ CDN của họ | **Khuyến nghị** — cần mở mạng cho `cdn.sheetjs.com` |
| ExcelJS 4.4.0 (npm) | Có trên npm, đang được duy trì | Không đọc `.xls` cũ; API khác hoàn toàn → viết lại đọc/ghi (rủi ro hồi quy nhập liệu); bundle trình duyệt lớn | Chỉ dùng nếu không thể lấy SheetJS |
| Giữ 0.18.5 | Không đổi gì | Còn 2 CVE (đã giảm thiểu: giới hạn 20 MB, renderer không có Node, CSP, sandbox) | Tạm chấp nhận |

**Cần chủ sở hữu:** cho phép tên miền `cdn.sheetjs.com` trong cài đặt mạng của môi trường. Sau khi được phép, cập nhật bằng 1 commit riêng và chạy lại toàn bộ test nhập/xuất.

## 5. Kịch bản tính lương

`tests/integration/payroll-scenarios.test.js` là các test **mô tả hành vi hiện tại**. Số kỳ vọng được tính tay, khớp engine; Kế toán cần xác nhận quy tắc ở các kịch bản có đánh dấu.

| Test | Kịch bản | Số tính tay | Ghi chú |
|---|---|---|---|
| I-15 | Đủ tháng 9/2026, TG1 20 tr, lương đóng BH 6 tr | BH 630.000; thuế (20 − 0,63 − 15,5) tr × 5% = 193.500; thực lĩnh 19.176.500 → 19.177.000 | |
| I-16 | Vào làm 15/09 (14 công) | 20 tr × 14/26 = 10.769.231; thuế 0 | BH vẫn trừ đủ — **Q-23** |
| I-17 | Nghỉ việc 20/09 (17 công) | 13.076.923; thực lĩnh 12.447.000; tháng 10 không có lương | |
| I-18 | 2 tạm ứng + 2 dòng thưởng / thu nhập khác / trừ khác | Thu nhập 21,2 tr; thuế 253.500; thực lĩnh 18.217.000; tạm ứng tháng 10 không trừ vào tháng 9 | |
| I-19 | Khoản trừ vượt thu nhập | Thực lĩnh 0; cảnh báo nêu số còn thiếu 14.091.538 đ, **không** chuyển sang kỳ sau | |
| I-20 | Phụ lục tăng lương hiệu lực 16/09 | Cả tháng 9 = 26 tr | **Q-22** |

Đã có test từ trước (không lặp lại ở đây):
- thuế theo hiệu lực (12/2025 so với 01/2026);
- người phụ thuộc;
- vãng lai 10%;
- truy thu BH dưới ngưỡng;
- hồi tố sau chốt (I-10);
- chốt / mở chốt có phiên bản.

## 6. Câu hỏi mới cho chủ sở hữu

Q-18 ca làm việc · Q-19 hai phòng ban trong tháng · Q-20 tạm ứng / thưởng trùng khi không có số chứng từ · Q-21 ô chấm công sai đã có sẵn · Q-22 phụ lục giữa tháng · Q-23 ngưỡng BH. Chi tiết: `BUSINESS_RULES.md` §2.

## 7. Rollback

- Thay đổi PR1 **không đổi cấu trúc dữ liệu** (vẫn schemaVersion 2) và không đổi engine. Quay về alpha.3 chỉ cần cài lại bản cũ; dữ liệu mở bình thường.
- Dữ liệu đã nhập bằng bản mới luôn hợp lệ với bản cũ, vì bản mới chỉ *chặt hơn* khi nhập.
