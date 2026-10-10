# ARCHITECTURE — Kiến trúc LUONG_HAK Enterprise

## 1. Kiến trúc đích (theo đề xuất của chủ sở hữu)

```
┌───────────────────────────────────────────────────────────────┐
│ GIAO DIỆN QUẢN TRỊ   Dashboard · Nhân sự · Chấm công · Lương · Báo cáo │  ← renderer (không truy cập file/DB trực tiếp)
└───────────────────────────────┬───────────────────────────────┘
          ┌─────────────────────┼─────────────────────┐
   ┌──────▼──────┐       ┌──────▼──────┐       ┌──────▼──────┐
   │    HRM      │       │   PAYROLL   │       │   REPORTS   │      ← modules nghiệp vụ (application + domain)
   │ NS & hợp đồng│      │ Lương & thuế│       │ Báo cáo & KT│
   └──────┬──────┘       └──────┬──────┘       └──────┬──────┘
          └─────────────────────┼─────────────────────┘
┌───────────────────────────────▼───────────────────────────────┐
│ CORE ENGINE   Công thức · Quy tắc · Phê duyệt · Phân quyền · Kiểm tra │  ← thuần JS, không UI, test 100%
└───────────────────────────────┬───────────────────────────────┘
┌───────────────────────────────▼───────────────────────────────┐
│ DATABASE & INTEGRATIONS   SQLite offline · Backup · Excel · API · Google Sheets │ ← tiến trình chính Electron (IPC)
└───────────────────────────────────────────────────────────────┘
```

Nguyên tắc:
1. **Một chiều phụ thuộc**: Giao diện → Module → Core → Data. Tầng dưới không biết tầng trên.
2. **Giao diện không chứa nghiệp vụ**: chỉ gọi hàm của module, hiển thị kết quả, thu thập nhập liệu.
3. **Core thuần**: không DOM, không file, không thời gian hệ thống ngầm định (truyền `now` vào) → kiểm thử được bằng Node.
4. **Dữ liệu chỉ đi qua tầng Data ở tiến trình chính** (IPC whitelisted). Renderer chạy `sandbox`, không Node.
5. **Kiểm tra quyền ở tầng nghiệp vụ/Data**, không chỉ ẩn nút.
6. **Snapshot bất biến**: kỳ đã chốt không bị sửa bởi bất kỳ thay đổi danh mục/hồ sơ nào.

## 2. Ánh xạ vào cấu trúc thư mục

| Tầng | Thư mục đích (Phase 2+) | Hiện trạng sau Phase 1 (v1.4.0) |
|---|---|---|
| Giao diện quản trị | `src/renderer/{layouts,pages,components,dashboards}` | `app.js` (1 file, đã bọc chống trắng màn hình), `index.html`, `style.css` |
| HRM | `src/modules/{organization,employees,contracts,leave,assignments}` | `hr.js` (mô hình hồ sơ, lấy dữ liệu lương theo phụ lục, báo cáo nhân sự) |
| PAYROLL | `src/modules/{attendance,production,payroll,insurance,personal-income-tax,advances,payments}` | `engine.js` (công thức), `core/payroll-close.js` (chốt/mở chốt/phiên bản) |
| REPORTS | `src/modules/{reports,accounting}` | trong `app.js` (`bc*`) |
| Core engine | `src/core/{calculation-engine,rule-engine,validation,permissions,events,settings}` | `core/validate.js`, `core/integrity.js`, `core/importer.js`, `core/payroll-close.js`, `core/period-guard.js` (2.0), `core/schema.js` (2.0) |
| Database & integrations | `src/main/{electron,ipc,security,storage}`, `src/database/{schema,migrations,repositories,backup}`, `src/integrations/{excel,csv,google-sheets,api}` | `main.js`, `preload.js`, `main/storage.js` (file JSON + sao lưu), SheetJS |
| Tests | `tests/{unit,integration,regression,e2e,perf}` | ✅ đã có đủ 5 nhóm |

## 3. Hợp đồng giao tiếp giữa các module (đã áp dụng ở Phase 1)

| Module | Hàm | Vào | Ra |
|---|---|---|---|
| `core/validate` | `parseMoney(v)` / `normCell(col, v)` / `rowPeriod(table, row)` | giá trị thô | số / `{value, error}` / `"YYYY-MM"` |
| `core/importer` | `plan(db, table, cols, rows, {lockedPeriods, defaultKy})` | dữ liệu Excel thô | `{items:[{action, row, reason, line}], summary}` — không ghi gì |
| | `apply(db, plan, makeId, isHr)` | kế hoạch đã duyệt | số dòng ghi |
| `core/integrity` | `normalizeDataset(db)` · `check(db)` | dữ liệu | thay đổi / danh sách vấn đề `{level, area, msg}` |
| `core/payroll-close` | `buildSnapshot` · `close` · `reopen(db, ky, lyDo)` · `verify` · `diff` | kết quả lương | snapshot có checksum, phiên bản, lịch sử |
| `hr.js` | `staffForPayroll(db, nam, thang)` | hồ sơ + hợp đồng | `{list, warn}` — đầu vào engine |
| `engine.js` | `tinhBangLuong(db, nam, thang, buTheoNgay)` | dữ liệu kỳ | `{bangluong, bhxh, tncn, canhbao}` |
| `main/storage` (IPC) | `load` · `save(text)` · `backup(tag)` · `list` · `readBackup` · `verifyAll` · `quarantineCorrupt` | — | `true` hoặc lỗi dễ hiểu; tên sao lưu duy nhất + SHA-256; không bao giờ ghi đè dữ liệu tốt bằng dữ liệu hỏng |
| `core/importer` (2.0) | `plan(..., {mode: "merge"\|"replace"})` | | thêm các action `merged` và `conflict`; `item.diff = {set, change, clear, keep}` |
| `core/period-guard` (2.0) | `impact(db, table, row)` · `impactChange(db, table, before, after)` · `references(db, maNV)` · `changedFields(a, b)` | 1 thay đổi | `{kind: "locked"\|"retro"\|"none", periods}` |
| `core/schema` (2.0) | `validate(db, {tables, hrTables})` | dữ liệu đã parse | `{ok, fatal, errors, info, stats}` — không sửa dữ liệu |
| `preload` (2.0) | `hakStore.whoami()` · `hakStore.verifyBackups()` | — | `{user, host}` · trạng thái bản sao lưu |
| `core/permissions` (2.0-α2) | `can(user, quyền)` · `need(user, quyền)` · `ROLES` · `PERMS` · `validatePassword` · `wouldRemoveLastAdmin` · chống dò mật khẩu | tài khoản đang đăng nhập | đúng/sai · ném lỗi `EPERM_APP` |
| `preload` + `main.js` (2.0-α2) | `authSalt()` · `authHash(pw, salt, iter)` · `authVerify(pw, salt, iter, hash)` | mật khẩu | PBKDF2-SHA256 tính ở tiến trình chính, so sánh `timingSafeEqual`. Bản chạy trình duyệt dùng WebCrypto (U-PERM-08 chứng minh 2 cách cho cùng kết quả) |

| `core/validate` (2.0-α4) | `dayCell(day, v, ky)` · `daysInKy(ky)` | 1 ô chấm công | `{error, warn, soCong, nhan}` — 1 quy tắc cho nhập Excel, lưới, dán, kiểm tra dữ liệu, repository |
| `hr.js` (2.0-α5) | `buildIndex(db)` · `hienHanh(db, ma, asOf, ix)` | dữ liệu | chỉ mục `Map` theo Mã NV, dựng mỗi lượt (không cache giữa các lần gọi) |
| **`core/repository`** (2.0-α6) | `createRepo({db, can, audit, uid, tableName, hdChildren})` → `plan(op, table, target, values, {what, checkDup})` · `apply(plan, {audit, action})` | 1 thao tác thêm / sửa / xóa | `plan`: `{ok, code, msg, retro, impact, confirmMsg}` — **không sửa gì**; `apply`: kiểm tra lại rồi mới ghi + nhật ký trước/sau. Thứ tự kiểm tra: quyền → ô ngày → trùng khóa → Q-15 → kỳ chốt / hồi tố. Đổi Số HĐLĐ / xóa HĐ kéo theo bảng con **sau** khi mọi kiểm tra đã qua |

### 3.1 Tầng repository (2.0-α6)
```
UI (app.js) ──plan()──▶ core/repository ──▶ validate · importer.keyOf · period-guard   (chỉ đọc)
   │  ◀── {ok:false, msg} → báo lý do, không đổi gì
   │  ◀── {ok:true, retro, confirmMsg} → (tuỳ màn hình) hỏi xác nhận; Hủy = không đổi gì
   └──apply()──▶ kiểm tra lại → sửa db → nhật ký (audit) ──▶ app.save() → main/storage
```
- Đã đi qua repository: lưới nhập liệu (thêm / sửa ô / dán / xóa), form hồ sơ nhân sự (thêm / sửa), xóa hồ sơ phụ.
- Ngoại lệ còn ghi thẳng (có lý do, khóa bằng test U-REPO-08): nhật ký; tài khoản và mã khôi phục; hồ sơ công ty; trợ lý thêm nhân viên mới; xóa nhân viên; nạp danh mục mẫu vào bảng trống; tạo bảng thiếu khi mở dữ liệu; hoàn tác gộp chấm công. Nhập Excel dùng `importer.plan/apply` với kiểm tra quyền và kỳ chốt riêng; gộp chấm công dùng `integrity.mergeChamCong`.
- Bước tiếp theo (PR4): repository là chỗ duy nhất cần đổi khi chuyển sang SQLite cho các thao tác này.

## 4. Luồng tính & chốt lương (Phase 1)

```
Nhập liệu ─► chuẩn hóa (validate) ─► importer.plan (xem trước) ─► apply ─► lưu (storage: atomic + backup)
                                                                          │
Tính lương: hr.staffForPayroll ─► engine.tinhBangLuong ─► cảnh báo ─► người dùng kiểm tra
Chốt:      tính lại (không tin kết quả đang hiển thị) ─► buildSnapshot(kết quả + dữ liệu vào + danh mục + checksum)
           ─► close ─► saveNow() thành công? ─ không ─► rollbackClose + báo lỗi
Mở chốt:   lý do bắt buộc ─► backup "truoc-mo-chot" ─► reopen (bản cũ sang lịch sử) ─► chốt lại = phiên bản mới
```

## 5. Rule engine (Phase 4 — thiết kế)

- Thành phần lương khai báo dữ liệu: `{ma, ten, loai: THU_NHAP|KHAU_TRU, congThuc, dieuKien, doiTuong, thuTu, hieuLucTu, hieuLucDen, lamTron, trangThai}`.
- Biểu thức: **bộ phân tích riêng** (tokenizer + Pratt parser → AST). Chỉ cho phép: số, biến khai báo trước, `+ - * / ( )`, so sánh, `AND OR NOT`, hàm trong danh sách trắng (`MIN, MAX, ROUND, IF, ABS`). **Không `eval`, không `Function`.**
- Đánh giá theo đồ thị phụ thuộc (sắp xếp tô-pô theo `thuTu` + biến tham chiếu), phát hiện vòng lặp.
- Mỗi kết quả lưu vết từng bước `{bien, congThuc, giaTriVao, ketQua}` để giải thích dòng lương.
- Công thức hiện có trong `engine.js` trở thành **bộ quy tắc mặc định phiên bản 1**, phải cho kết quả **trùng 100%** với kiểm thử hồi quy trước khi thay thế.

## 6. Bảo mật — mô hình và giới hạn của ứng dụng offline

- Electron 43 (còn hỗ trợ), `contextIsolation`, `sandbox`, `nodeIntegration:false`, CSP `connect-src 'none'`, chặn cửa sổ mới/điều hướng ngoài, preload chỉ mở 8 hàm lưu trữ.
- **Giới hạn**: người có quyền truy cập máy Windows và thư mục `%APPDATA%\Tinh Luong HAK` **đọc được toàn bộ dữ liệu** (file JSON không mã hóa). Đăng nhập trong app (Phase 6) chỉ ngăn thao tác qua giao diện, **không** ngăn đọc file.
- Phase 6: mã hóa file dữ liệu (AES-256-GCM, khóa dẫn xuất từ mật khẩu bằng scrypt; Windows DPAPI qua `safeStorage` để nhớ khóa trên máy) + đăng nhập vai trò. Đánh đổi: quên mật khẩu = mất dữ liệu → bắt buộc có bản sao lưu mã hóa bằng khóa khôi phục.

## 7. Sẵn sàng đồng bộ (Phase 6 — thiết kế)

- Mọi bản ghi có `_id` ổn định (đã có ở hồ sơ nhân sự; Phase 2 mở rộng cho dữ liệu phát sinh), `version` tăng dần, `updatedAt`, `deletedAt` (xóa mềm).
- Đồng bộ tăng dần theo `updatedAt > lastSync`; xung đột: cùng `_id` khác `version` → giữ cả hai, người dùng quyết định; dữ liệu kỳ đã chốt chỉ đồng bộ một chiều (máy chốt → trung tâm).
