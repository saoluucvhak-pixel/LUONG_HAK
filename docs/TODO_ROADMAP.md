# TODO_ROADMAP — Lộ trình & tiến độ

> File này là "bộ nhớ" của dự án: phiên làm việc sau đọc file này để tiếp tục mà không mất ngữ cảnh.

## Trạng thái hiện tại (10/10/2026)
- Nhánh: `claude/dazzling-cray-idw87u` · phiên bản **1.4.0** · Phase 1 **hoàn thành phần mã + test**, chờ: CI xanh trên PR, **cài thử bộ cài trên Windows thật**, chủ sở hữu trả lời câu hỏi Q-01…Q-11 (`BUSINESS_RULES.md`).
- Kiến trúc đích: theo sơ đồ của chủ sở hữu (Giao diện → HRM/PAYROLL/REPORTS → Core Engine → Database & Integrations) — `ARCHITECTURE.md`.

## Việc đang chờ người khác
| Việc | Ai | Ghi chú |
|---|---|---|
| Quyết định GAS-01 (web app Google mở cho mọi người có link) | Chủ sở hữu | Đề xuất: `access: DOMAIN` hoặc danh sách email |
| Cho phép tên miền `cdn.sheetjs.com` trong mạng môi trường làm việc, hoặc tự tải `xlsx.full.min.js` 0.20.3 | Chủ sở hữu | Để vá SEC-03 |
| Cài thử bộ cài 1.4.0 trên Windows; chạy *Kiểm tra dữ liệu* với dữ liệu thật | Chủ sở hữu/kế toán | Báo lại cảnh báo "Lương … quá nhỏ" (BUG-001) để nhập lại |
| Xác nhận quy tắc Q-01…Q-10 | Kế toán tiền lương | Không đổi công thức trước khi có xác nhận |
| Thống nhất ngưỡng hiệu năng (thời gian tính lương, mở app) | Chủ sở hữu | Baseline ở `TEST_RESULTS.md` §5 |

## Phase 1 — Audit & sửa lỗi nghiêm trọng ✅ (mã) / ⏳ (nghiệm thu Windows)
- [x] Kiểm toán toàn bộ repo → `AUDIT_REPORT.md`
- [x] Sửa lỗi lưu dữ liệu, sao lưu, file hỏng (BUG-004/005, storage)
- [x] Sửa lỗi nhập trùng / nhập vào kỳ đã chốt (BUG-006/007)
- [x] Sửa lỗi tiền (BUG-001/002), CCCD, ngày/kỳ (BUG-011/012)
- [x] Sửa chốt kỳ (BUG-003/008/009/010) + phiên bản + lịch sử
- [x] Test nền tảng: unit, integration, regression vs 1.3.0, E2E Electron, benchmark
- [x] CI: cú pháp, lint, test, audit, E2E, build
- [x] Nâng Electron 43.7.9, cứng hóa bảo mật
- [ ] Vá SheetJS 0.20.3 (chờ mạng) — SEC-03
- [ ] Nghiệm thu bộ cài trên Windows

## 2.0 — Giai đoạn ưu tiên 1: sửa lỗi dữ liệu, chốt kỳ, sao lưu ✅ (mã + test) — nhánh `claude/v2-phase1-data-fixes`
- [x] Kiểm toán lại từ HEAD `6a4e954` → `AUDIT_REPORT.md` §6 (BUG-021…039, RISK-01…04)
- [x] Chấm công / nhập Excel: chuẩn hóa khóa, gộp theo ngày, xung đột, chế độ bổ sung/ghi đè, gộp dữ liệu trùng sẵn có, hoàn tác khi lưu lỗi
- [x] Kỳ đã chốt: phân loại locked/retro/none, cảnh báo hồi tố + nhật ký trước/sau, chặn đổi Mã NV, người thực hiện, checksum dữ liệu đầu vào, khôi phục báo kỳ chốt mất/đổi
- [x] Sao lưu: tên duy nhất, SHA-256, ghi an toàn + đọc lại, không xóa bản tốt cuối cùng, mô phỏng lỗi đĩa
- [x] Kiểm tra cấu trúc dữ liệu (`core/schema.js`), chặn ghi khi cấu trúc nguy hiểm
- [x] Test: 78 unit/integration/regression, 27 E2E
- [ ] Chủ sở hữu trả lời Q-12…Q-16
- [ ] Nghiệm thu trên Windows thật

## 2.0-alpha.2 — Đăng nhập & phân quyền ✅ (nhánh `claude/v2-auth-rbac`)
- [x] Đăng nhập, Admin đầu tiên + mã khôi phục, 7 vai trò, kiểm tra quyền ở nghiệp vụ, chỉ Admin sửa hồi tố (Q-14), quản trị người dùng, nhật ký theo tài khoản (Q-16)
- [ ] Giới hạn **Trưởng bộ phận** theo phòng ban của mình (cần danh sách phòng ban ↔ người phụ trách)
- [ ] Quy trình **phê duyệt** bảng lương trước khi chốt (vai trò Người phê duyệt đã có, chưa có luồng)
- [ ] Mã hóa file dữ liệu (RISK-07); chặn bản cũ mở dữ liệu có tài khoản (RISK-06)
- [ ] Chủ sở hữu duyệt ma trận quyền mặc định (`BUSINESS_RULES.md` R-45)

## 2.0 tối ưu toàn diện — PR1 Audit V2 ✅ (mã + test) — nhánh `claude/v2-audit2-fixes` (2.0.0-alpha.4)
- [x] `AUDIT_V2.md`: kiến trúc, danh sách vấn đề A2-01…A2-11, rà soát 13 đường ghi, đánh giá thư viện Excel
- [x] Kiểm tra ô ngày chấm công (âm, chữ lạ, ngày không tồn tại, > 3 công) ở nhập Excel, lưới, dán, kiểm tra dữ liệu, chốt kỳ
- [x] Test kịch bản tính lương I-15…I-20 (chờ Kế toán xác nhận Q-22, Q-23)
- [ ] Chờ chủ sở hữu: Q-18…Q-23; mở mạng `cdn.sheetjs.com` (SEC-03)
- [x] **PR2 hiệu năng** (nhánh `claude/v2-perf`, alpha.5): chỉ mục Mã NV, 5.000 NV dựng DS lương 22 ms — `PERFORMANCE_REPORT.md`
- [x] **PR3 repository** (nhánh `claude/v2-repository`, alpha.6): `core/repository.js`, sửa A3-01; ngoại lệ còn lại khóa bằng U-REPO-08
- Tiếp theo: PR4 SQLite (lưu ~250 ms ở 5.000 NV) → PR5 UI/HRM

## Phase 2 — Chuẩn hóa kiến trúc (bước tiếp theo)
0. (Đã khảo sát) SQLite qua `node:sqlite` có sẵn trong Electron 43 / Node 24.21 — không cần module native.
1. Tách `app.js` theo `ARCHITECTURE.md` §2: `src/renderer/pages/*` (mỗi trang 1 file), `src/modules/payroll/reports.js` (chuyển `bc*` ra khỏi UI, có test), `src/modules/hrm/*` (từ `hr.js`).
2. Tầng repository: mọi truy cập `db.<bảng>` qua `repo.list/get/insert/update/remove` (kiểm tra khóa, khóa kỳ, nhật ký trước/sau tại 1 chỗ). Viết test cho repository trước khi chuyển.
3. ~~PERF-01~~ ✅ alpha.5 (22 ms / 5.000 NV).
4. SQLite theo `MIGRATION_PLAN.md` §2 (chạy song song JSON/SQLite, so sánh kết quả = 0 khác biệt).
5. Bundler (esbuild) để dùng module ES trong renderer; giữ build không cần mạng khi chạy.

## Phase 3 — HRM chuyên nghiệp
Cơ cấu tổ chức nhiều cấp (tập đoàn → công ty → chi nhánh → khối → phòng → bộ phận → tổ), định biên, trung tâm chi phí; lịch sử thay đổi trước/sau + lý do + người sửa cho mọi trường quan trọng; quyết định tiếp nhận/điều chuyển/bổ nhiệm/lương/nghỉ việc; đào tạo, chứng chỉ; trung tâm cảnh báo (hết thử việc, khám sức khỏe, phép vượt số dư, thiếu thông tin trả lương, trùng CCCD).

## Phase 4 — Payroll linh hoạt
Rule engine an toàn (parser riêng, không eval) với bộ quy tắc mặc định = engine hiện tại (hồi quy 100%); giải thích từng dòng lương; ca/lịch làm việc/ngày lễ; mô hình sản lượng gốc → phân bổ → tính lương (6 phương thức chia); chính sách BH/thuế có nguồn pháp lý + phiên bản; tạm ứng có trạng thái (không trừ trùng); thanh toán nhiều đợt có mã giao dịch chống lặp; quyết toán thuế năm (đã khấu trừ / tính lại / điều chỉnh).

## Phase 5 — Báo cáo & giao diện
Dashboard; 18 báo cáo (lọc, nhóm, sắp xếp, drill-down, Excel, PDF, lưu mẫu, tùy chỉnh cột); kiểm tra đối ứng hạch toán; chế độ sáng/tối; bảng lớn virtual scrolling; nhập liệu bàn phím.

## Phase 6 — Mở rộng & phát hành
Đăng nhập + phân quyền theo vai trò/phạm vi (kiểm tra ở tầng nghiệp vụ); mã hóa file dữ liệu; sao lưu mã hóa; chuẩn bị đồng bộ (ID ổn định, version, updatedAt, xóa mềm); ký số bộ cài (tránh cảnh báo SmartScreen); hướng dẫn sử dụng đầy đủ; nghiệm thu.
