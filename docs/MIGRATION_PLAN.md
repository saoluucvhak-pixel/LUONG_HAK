# MIGRATION_PLAN — Kế hoạch chuyển đổi dữ liệu

## 1. Các lần chuyển đổi đã có (tự động khi mở app)

| Từ → đến | Hàm | Nội dung | An toàn |
|---|---|---|---|
| 1.0 → 1.1 | `HRM.migrate` | Bảng Nhân sự phẳng → nhân viên + hợp đồng `HD-<mã>` + phụ lục lương + tài khoản + người phụ thuộc; bảng cũ giữ ở `nhansu_cu` | test `integration/flows` "Migration v1.0" |
| 1.1 → 1.1 | `HRM.migrate` | Biểu thuế dạng bậc trong `dm_tncn` → `dm_bacthue` | |
| ≤1.3 → **1.4 (schemaVersion 2)** | `INT.normalizeDataset` | Tiền "500.000" → "500000"; kỳ "2026-9"/"09/2026" → "2026-09"; ngày dd/mm/yyyy → ISO; CCCD 11 số / SĐT 9 số → bù 0; thêm `kyluong_lichsu`, `auditlog`. **Không đụng snapshot kỳ đã chốt** | test `core.test` normalizeDataset (idempotent), regression |

Mỗi lần mở app: `main.js` tạo `startup_*.json` (giữ 10). Khi dữ liệu có `schemaVersion` cũ, app tạo thêm `truoc-nang-cap_*.json` **trước** khi chuyển đổi (giữ 20, chỉ tạo khi nâng schema). Nếu chuyển đổi gây lỗi, khôi phục bản này tại *Công ty & Sao lưu → Các bản sao lưu*.

| 1.4.0 → **2.0-P1** (vẫn schemaVersion 2) | không cần chuyển đổi | Chỉ **thêm** trường: `auditlog[].nguoi`, `kyluong[].inputChecksum`, file `backups/*.sha256`. Trước khi chuyển đổi, `core/schema.validate` chặn file có cấu trúc nguy hiểm (chế độ chỉ xem). Dòng chấm công trùng khóa sẵn có **không tự gộp**; người dùng bấm *Gộp dòng chấm công trùng* sau khi xem *Kiểm tra dữ liệu* (tổng công không đổi) | I-14, U-SCH-01/02, E2E cấu trúc nguy hiểm |

### Giới hạn đã biết
Số tiền đã bị **hỏng bởi BUG-001** (bản 1.1–1.3, VD đơn giá 300.000 bị lưu thành "300") **không thể tự khôi phục** vì không còn thông tin gốc. `integrity.check` liệt kê mọi phụ lục có *Lương thỏa thuận / Lương cơ bản < 1.000đ* để người dùng nhập lại; cũng có thể đối chiếu với bản sao lưu cũ hơn hoặc kỳ đã chốt (snapshot giữ số đúng tại thời điểm chốt).

## 2. JSON → SQLite (Phase 2) — kế hoạch

> **Kết quả khảo sát (10/10/2026):** Electron 43.7.9 chạy Node 24.21.0, có sẵn `node:sqlite` (`DatabaseSync`) — đã chạy thử tạo bảng, ghi, đọc. Nhờ vậy **không cần module native** như better-sqlite3 (vốn phải build lại cho từng phiên bản Electron trên Windows) → bộ cài vẫn thuần JS. `node:sqlite` còn gắn nhãn *experimental* ở Node 24 → bọc sau tầng repository để có thể thay thế.

**Điều kiện bắt đầu:** bộ kiểm thử hồi quy xanh; có tầng repository (`src/database/repositories`) để giao diện/module không còn đọc `db.<bảng>` trực tiếp.

| Bước | Nội dung | Kiểm tra | Rollback |
|---|---|---|---|
| 1 | Thêm `better-sqlite3` (native, build cho Electron 43) vào tiến trình chính; renderer gọi qua IPC | E2E mở/đóng app | gỡ dependency |
| 2 | Tạo schema (DATABASE_SCHEMA §2) + bảng `system_settings.schema_version` + migrations đánh số `001_init.sql`… chạy trong transaction | unit test migration trên DB tạm | xóa file `.sqlite` |
| 3 | Sao lưu bắt buộc `truoc-sqlite_*.json`; đọc `data.json` → ghi SQLite trong **1 transaction**; sinh ULID cho dòng chưa có `_id`; tiền → INTEGER; kỳ chấm công 31 cột → dòng `attendance` theo ngày | Đếm số dòng từng bảng khớp; checksum kỳ đã chốt khớp | giữ nguyên `data.json`, không xóa |
| 4 | **Chạy song song**: engine tính lương từ JSON và từ SQLite cho mọi kỳ có dữ liệu; so sánh từng nhân viên | khác biệt = 0 (hoặc đã phân loại) | quay lại JSON (cờ `storage=json`) |
| 5 | Chuyển nguồn chính sang SQLite; `data.json` đổi tên `data.pre-sqlite.json` (giữ ≥ 2 phiên bản) | E2E đầy đủ + hồi quy | cờ cấu hình về JSON + khôi phục `data.pre-sqlite.json` |
| 6 | Sao lưu SQLite: `VACUUM INTO` (nhất quán khi đang mở), kiểm tra `PRAGMA integrity_check` khi mở app và trước khi sao lưu | test sao lưu/khôi phục | — |

## 3. Ánh xạ bảng

| JSON | SQLite |
|---|---|
| `congty` | organizations |
| `dm_phongban` | departments (+ `expense_account` = Tài khoản chi phí) |
| `dm_chucvu` | positions |
| `dm_luong` | salary_policies |
| `dm_phucap`, `dm_hotro`, `dm_tangca` | allowances (phân loại theo `kind`) |
| `dm_baohiem` | insurance_policies |
| `dm_tncn`, `dm_bacthue`, `dm_giamtru` | tax_policies, tax_brackets, tax_deductions |
| `nhanvien` / `canhan` / `nhanthan` / `thanhtoan` | employees / employee_profiles / dependents / (bank_accounts trong profile hoặc bảng riêng) |
| `hopdong` / `chitiethd` / `congtac` | employment_contracts / contract_amendments / employee_assignments |
| `chamcong` (31 cột) | attendance (1 dòng/ngày/loại công) |
| `nghiphep`, `nghiom` | leave_requests |
| `sanluong`, `bandam` | production_tickets + production_allocations |
| `psluong` / `ungluong` | salary_adjustments / advances |
| `kyluong`, `kyluong_lichsu` | payroll_periods + payroll_versions + payroll_results (+ snapshot JSON trong `input_snapshot`) |
| `auditlog` | audit_logs |
