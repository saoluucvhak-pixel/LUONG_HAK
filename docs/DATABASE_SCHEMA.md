# DATABASE_SCHEMA — Cấu trúc dữ liệu

## 1. Hiện trạng (v1.4.0): 1 file JSON, `schemaVersion = 2`

File `%APPDATA%\Tinh Luong HAK\data.json` là một object; mỗi khóa là một "bảng" (mảng bản ghi). Tên cột tiếng Việt.

| Nhóm | Khóa JSON | Khóa nghiệp vụ (chống trùng khi nhập) | Ghi chú |
|---|---|---|---|
| Hệ thống | `schemaVersion` | — | 2 từ v1.4.0 |
| | `congty` | — | 1 dòng |
| | `auditlog` | — | `{luc, nguoi, thaoTac, chiTiet}` (`nguoi` từ 2.0-P1). Giữ 20.000 dòng gần nhất; trước khi cắt bớt, app sao lưu `nhat-ky-truoc-cat_*` |
| Tài khoản (2.0-α2) | `nguoidung` | `tenDangNhap` (không phân biệt hoa/thường) | `{id, tenDangNhap, hoTen, vaiTro, khoa, salt, iter, hash, phaiDoiMK, taoLuc, dangNhapLuc, doiMKLuc}` — **không** lưu mật khẩu rõ. Không nhập/xuất Excel |
| | `baomat` | — | 1 dòng `{khoiPhuc: {salt, iter, hash}, taoLuc}` — mã khôi phục Admin (đã băm) |
| Chốt kỳ | `kyluong` | `ky` (duy nhất) | snapshot: `{ky, version, ngayChot, nguoiChot, ghiChu, engineVersion, buTheoNgay, kq, totals, checksum, input:{staff, data, danhmuc}, inputChecksum}`. `inputChecksum` có từ 2.0-P1; bản chốt cũ không có trường này vẫn hợp lệ |
| | `kyluong_lichsu` | `ky + version` | bản chốt đã mở chốt + `moChot:{luc, lyDo, nguoi}` — không bao giờ xóa |
| Danh mục | `dm_luong` | Mã lương + Hiệu lực từ | có Hiệu lực từ/đến |
| | `dm_phucap`, `dm_tangca`, `dm_hotro`, `dm_baohiem`, `dm_tncn`, `dm_giamtru` | Mã + Hiệu lực từ | |
| | `dm_bacthue` | Bậc + Hiệu lực từ | biểu thuế lũy tiến theo hiệu lực |
| | `dm_phongban`, `dm_chucvu`, `dm_cc` | Mã | |
| Nhân sự | `nhanvien` | Mã NV | bảng gốc |
| | `canhan`, `thanhtoan` | Mã NV + Hiệu lực từ | lịch sử theo hiệu lực |
| | `nhanthan` | Mã NV + Họ tên nhân thân | người phụ thuộc có Hiệu lực từ/đến |
| | `hopdong` | Mã NV + Số HĐLĐ | |
| | `chitiethd` | Mã NV + Số HĐLĐ + Hiệu lực từ | **nguồn dữ liệu tính lương** |
| | `congtac`, `hocvan`, `suckhoe`, `lienhe`, `nghenghiep`, `khamsk`, `quyenloiphep`, `nghiphep`, `nghiom`, `noiquy`, `khenthuong`, `tailieu` | xem `core/importer.js` KEYS | |
| Phát sinh | `chamcong` | Kỳ + Mã NV + Hình thức công — chuẩn hóa: kỳ `YYYY-MM`, hình thức viết hoa, để trống = BT | 31 cột ngày `01`…`31`. Engine cộng **mọi** dòng. Từ 2.0-P1, nhập Excel giữ đúng 1 dòng / khóa (gộp theo ngày, xung đột nếu trùng ngày) |
| | `sanluong`, `bandam` | Phiếu cân + Mã NV | |
| | `tiencom` | Ngày + Mã NV | |
| | `psluong`, `ungluong` | (không có — chặn dòng trùng y hệt) | ⚠ Phase 4: thêm Số chứng từ làm khóa |

Quy ước giá trị (chuẩn hóa bởi `core/validate.js`): ngày `YYYY-MM-DD`, kỳ `YYYY-MM`, tiền là chuỗi số thuần (`"1500000"`), mã định danh là chuỗi (giữ số 0 đầu).

### Kiểm tra cấu trúc khi mở (`core/schema.js`, từ 2.0-P1)
- **fatal** → chế độ chỉ xem / khôi phục, không ghi. Gồm:
  - gốc không phải object;
  - `schemaVersion` sai kiểu, hoặc > 2 (file của bản mới hơn);
  - bảng đã biết nhưng không phải danh sách.
- **error** (liệt kê ở *Kiểm tra dữ liệu*):
  - dòng không phải bản ghi;
  - Mã NV thiếu, không phải chữ, hoặc thừa khoảng trắng;
  - ngày / tiền / kỳ không đọc được;
  - Mã NV không có trong Nhân sự;
  - phụ lục không thuộc hợp đồng;
  - kỳ chốt trùng, thiếu bảng lương, hoặc checksum lệch;
  - lịch sử chốt thiếu thông tin mở chốt.
- **info**: bảng không nhận diện được → giữ nguyên.

### Thư mục sao lưu (`backups/`, từ 2.0-P1)
- Tên file: `<loại>_<YYYYMMDD-HHmmss-SSS>_<6 ký tự hex>.json`. Riêng bản đầu ngày: `daily_<YYYY-MM-DD>.json`.
- Kèm `<tên>.sha256` = `{sha256, size, created, tag, schemaVersion}`.
- Bản tạo trước 2.0 không có `.sha256` → trạng thái "chưa có mã kiểm tra", vẫn khôi phục được.
- File dữ liệu hỏng được cất thành `data.corrupt_<thời điểm>_<mã>.json.bak`.

## 2. Đích: SQLite (Phase 2) — thiết kế

Quy ước chung cho bảng nghiệp vụ:
`id TEXT PRIMARY KEY` (ULID ổn định) · `created_at`, `updated_at`, `deleted_at` (xóa mềm) · `version INTEGER` (khóa lạc quan + đồng bộ) · `status`.
Bảng có lịch sử hiệu lực: `effective_from DATE NOT NULL`, `effective_to DATE NULL`, ràng buộc không chồng lấn cùng khóa (kiểm tra ở tầng repository + trigger).
Tiền lưu `INTEGER` (đồng); tỷ lệ `REAL`; ngày `TEXT` ISO.

```sql
-- Tổ chức
CREATE TABLE organizations (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, tax_code TEXT, address TEXT, legal_rep TEXT, created_at TEXT, updated_at TEXT, version INTEGER DEFAULT 1);
CREATE TABLE branches (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), code TEXT NOT NULL, name TEXT NOT NULL, UNIQUE(organization_id, code));
CREATE TABLE departments (id TEXT PRIMARY KEY, branch_id TEXT NOT NULL REFERENCES branches(id), parent_id TEXT REFERENCES departments(id),
  code TEXT NOT NULL, name TEXT NOT NULL, level TEXT CHECK(level IN ('KHOI','PHONG','BO_PHAN','TO')), cost_center TEXT, expense_account TEXT,
  manager_employee_id TEXT, headcount_plan INTEGER, effective_from TEXT NOT NULL, effective_to TEXT, UNIQUE(branch_id, code, effective_from));
CREATE TABLE positions (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, effective_from TEXT, effective_to TEXT);

-- Nhân sự
CREATE TABLE employees (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), employee_code TEXT NOT NULL,
  full_name TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('DANG_LAM','TAM_HOAN','NGHI_VIEC')), created_at TEXT, updated_at TEXT, deleted_at TEXT, version INTEGER DEFAULT 1,
  UNIQUE(organization_id, employee_code));
CREATE TABLE employee_profiles (id TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id), national_id TEXT, id_issue_date TEXT, id_issue_place TEXT,
  birth_date TEXT, gender TEXT, nationality TEXT, ethnicity TEXT, marital_status TEXT, permanent_address TEXT, current_address TEXT, phone TEXT, email TEXT,
  tax_code TEXT, social_insurance_no TEXT, effective_from TEXT NOT NULL, effective_to TEXT, UNIQUE(employee_id, effective_from));
CREATE UNIQUE INDEX ux_profile_national_id ON employee_profiles(national_id) WHERE national_id IS NOT NULL AND effective_to IS NULL;
CREATE TABLE dependents (id TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id), full_name TEXT NOT NULL, relation TEXT, birth_date TEXT, national_id TEXT, tax_code TEXT,
  is_tax_dependent INTEGER NOT NULL DEFAULT 0, effective_from TEXT NOT NULL, effective_to TEXT);
CREATE TABLE employment_contracts (id TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id), contract_no TEXT NOT NULL, contract_type TEXT NOT NULL,
  start_date TEXT NOT NULL, end_date TEXT, terminated_date TEXT, UNIQUE(employee_id, contract_no));
CREATE TABLE contract_amendments (id TEXT PRIMARY KEY, contract_id TEXT NOT NULL REFERENCES employment_contracts(id), amendment_no TEXT, kind TEXT CHECK(kind IN ('GOC','SUA_DOI')),
  department_id TEXT REFERENCES departments(id), position_id TEXT REFERENCES positions(id), salary_policy_codes TEXT NOT NULL, base_salary INTEGER, agreed_salary INTEGER NOT NULL,
  payment_method TEXT CHECK(payment_method IN ('CK','TM')), insurance_policy_id TEXT, tax_policy_id TEXT, allowance_codes TEXT, support_codes TEXT, overtime_code TEXT,
  effective_from TEXT NOT NULL, effective_to TEXT, UNIQUE(contract_id, effective_from));
CREATE TABLE employee_assignments (id TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id), department_id TEXT, position_id TEXT, change_type TEXT, decision_no TEXT, effective_from TEXT NOT NULL, effective_to TEXT);

-- Chính sách (mọi chính sách có hiệu lực + nguồn pháp lý + phiên bản)
CREATE TABLE salary_policies (id TEXT PRIMARY KEY, code TEXT NOT NULL, kind TEXT CHECK(kind IN ('LTG','LSP')), name TEXT, piece_rate INTEGER, standard_days_rule TEXT,
  min_output_per_day REAL, compensation_rate INTEGER, insurance_min_days REAL, legal_basis TEXT, effective_from TEXT NOT NULL, effective_to TEXT, UNIQUE(code, effective_from));
CREATE TABLE salary_grades (id TEXT PRIMARY KEY, policy_id TEXT REFERENCES salary_policies(id), grade TEXT, amount INTEGER, effective_from TEXT NOT NULL, effective_to TEXT);
CREATE TABLE allowances (id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT, amount INTEGER, rate REAL, threshold_days REAL, rule TEXT, effective_from TEXT NOT NULL, effective_to TEXT, UNIQUE(code, effective_from));
CREATE TABLE insurance_policies (id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT, er_si REAL, er_hi REAL, er_ui REAL, er_union REAL, ee_si REAL, ee_hi REAL, ee_ui REAL, ee_union REAL,
  salary_cap INTEGER, legal_basis TEXT, effective_from TEXT NOT NULL, effective_to TEXT, UNIQUE(code, effective_from));
CREATE TABLE tax_policies (id TEXT PRIMARY KEY, code TEXT NOT NULL, method TEXT CHECK(method IN ('LUY_TIEN','VANG_LAI','MIEN')), flat_rate REAL, threshold_per_payment INTEGER,
  legal_basis TEXT, effective_from TEXT NOT NULL, effective_to TEXT, UNIQUE(code, effective_from));
CREATE TABLE tax_brackets (id TEXT PRIMARY KEY, bracket INTEGER NOT NULL, income_from INTEGER NOT NULL, income_to INTEGER, rate REAL NOT NULL, effective_from TEXT NOT NULL, effective_to TEXT, UNIQUE(bracket, effective_from));
CREATE TABLE tax_deductions (id TEXT PRIMARY KEY, kind TEXT CHECK(kind IN ('BAN_THAN','PHU_THUOC')), amount INTEGER NOT NULL, legal_basis TEXT, effective_from TEXT NOT NULL, effective_to TEXT, UNIQUE(kind, effective_from));

-- Chấm công, sản lượng
CREATE TABLE shifts (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT, start_time TEXT, end_time TEXT, work_units REAL);
CREATE TABLE attendance (id TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id), work_date TEXT NOT NULL, attendance_type TEXT NOT NULL, units REAL NOT NULL, label TEXT,
  shift_id TEXT, approved INTEGER DEFAULT 0, period TEXT NOT NULL, UNIQUE(employee_id, work_date, attendance_type, shift_id));
CREATE INDEX ix_attendance_period ON attendance(period, employee_id);
CREATE TABLE leave_requests (id TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id), kind TEXT CHECK(kind IN ('PHEP','OM','KHAC')), from_ts TEXT NOT NULL, to_ts TEXT NOT NULL, days REAL NOT NULL,
  has_si_certificate INTEGER, certificate_no TEXT, approval_status TEXT, approver_id TEXT);
CREATE TABLE production_tickets (id TEXT PRIMARY KEY, ticket_no TEXT UNIQUE NOT NULL, kind TEXT CHECK(kind IN ('SAN_LUONG','BOM_DAM','BOC_XEP','TRUNG_CHUYEN','KHOAN')), ticket_date TEXT NOT NULL,
  vehicle_no TEXT, gross_quantity REAL NOT NULL, unit TEXT, team_department_id TEXT, period TEXT NOT NULL);
CREATE TABLE production_allocations (id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES production_tickets(id), employee_id TEXT NOT NULL REFERENCES employees(id),
  method TEXT CHECK(method IN ('TY_LE','KHOI_LUONG','SO_CONG','HE_SO','TO','KHOAN')), share REAL, allocated_quantity REAL NOT NULL, payable_quantity REAL NOT NULL, UNIQUE(ticket_id, employee_id));
-- Ràng buộc nghiệp vụ: SUM(allocated_quantity) theo ticket ≤ gross_quantity (kiểm tra trước khi tính lương)

-- Lương
CREATE TABLE salary_adjustments (id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, period TEXT NOT NULL, kind TEXT CHECK(kind IN ('THUONG','THU_NHAP_KHAC','TRU_KHAC')), amount INTEGER NOT NULL, voucher_no TEXT, note TEXT, UNIQUE(voucher_no, employee_id, kind));
CREATE TABLE advances (id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, request_no TEXT UNIQUE NOT NULL, amount INTEGER NOT NULL, status TEXT CHECK(status IN ('DE_NGHI','DA_DUYET','DA_CHI','DA_KHAU_TRU','HUY')),
  paid_at TEXT, deduct_period TEXT, deducted_in_result_id TEXT);  -- 1 tạm ứng chỉ khấu trừ đúng 1 lần
CREATE TABLE payroll_periods (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, period TEXT NOT NULL, status TEXT CHECK(status IN ('NHAP','DA_TINH','CHO_DUYET','DA_CHOT','DA_THANH_TOAN')), UNIQUE(organization_id, period));
CREATE TABLE payroll_versions (id TEXT PRIMARY KEY, period_id TEXT NOT NULL REFERENCES payroll_periods(id), version INTEGER NOT NULL, closed_at TEXT, closed_by TEXT, note TEXT,
  reopened_at TEXT, reopen_reason TEXT, engine_version TEXT, rules_snapshot TEXT, input_snapshot TEXT, checksum TEXT, UNIQUE(period_id, version));
CREATE TABLE payroll_results (id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES payroll_versions(id), employee_id TEXT NOT NULL, gross INTEGER, ee_insurance INTEGER, pit INTEGER, advances INTEGER, other_deductions INTEGER, net INTEGER, UNIQUE(version_id, employee_id));
CREATE TABLE payroll_result_details (id TEXT PRIMARY KEY, result_id TEXT NOT NULL REFERENCES payroll_results(id), component_code TEXT NOT NULL, formula TEXT, inputs TEXT, amount INTEGER NOT NULL, step INTEGER);
CREATE TABLE payment_batches (id TEXT PRIMARY KEY, version_id TEXT NOT NULL, batch_no TEXT UNIQUE NOT NULL, method TEXT CHECK(method IN ('CK','TM')), status TEXT, idempotency_key TEXT UNIQUE NOT NULL, created_at TEXT);
CREATE TABLE payment_details (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES payment_batches(id), result_id TEXT NOT NULL REFERENCES payroll_results(id), amount INTEGER NOT NULL, status TEXT, bank_ref TEXT, UNIQUE(batch_id, result_id));

-- Kiểm soát
CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, full_name TEXT, password_hash TEXT NOT NULL, status TEXT);
CREATE TABLE roles (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT);
CREATE TABLE permissions (id TEXT PRIMARY KEY, role_id TEXT NOT NULL REFERENCES roles(id), resource TEXT NOT NULL, action TEXT NOT NULL, scope TEXT, UNIQUE(role_id, resource, action, scope));
CREATE TABLE approval_requests (id TEXT PRIMARY KEY, resource TEXT NOT NULL, resource_id TEXT NOT NULL, step INTEGER, approver_id TEXT, status TEXT, comment TEXT, decided_at TEXT);
CREATE TABLE audit_logs (id TEXT PRIMARY KEY, at TEXT NOT NULL, user_id TEXT, action TEXT NOT NULL, resource TEXT, resource_id TEXT, before_json TEXT, after_json TEXT, reason TEXT);
CREATE INDEX ix_audit_resource ON audit_logs(resource, resource_id, at);
CREATE TABLE system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);           -- gồm schema_version
CREATE TABLE custom_fields (id TEXT PRIMARY KEY, resource TEXT NOT NULL, code TEXT NOT NULL, label TEXT, type TEXT CHECK(type IN ('TEXT','NUMBER','DATE','SELECT','MULTI','BOOL','FORMULA','REF')), options TEXT, UNIQUE(resource, code));
CREATE TABLE custom_field_values (field_id TEXT NOT NULL REFERENCES custom_fields(id), record_id TEXT NOT NULL, value TEXT, PRIMARY KEY(field_id, record_id));
```

Ánh xạ JSON → SQLite: xem `MIGRATION_PLAN.md` §3.
