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

## Phase 2 — Chuẩn hóa kiến trúc (bước tiếp theo)
1. Tách `app.js` theo `ARCHITECTURE.md` §2: `src/renderer/pages/*` (mỗi trang 1 file), `src/modules/payroll/reports.js` (chuyển `bc*` ra khỏi UI, có test), `src/modules/hrm/*` (từ `hr.js`).
2. Tầng repository: mọi truy cập `db.<bảng>` qua `repo.list/get/insert/update/remove` (kiểm tra khóa, khóa kỳ, nhật ký trước/sau tại 1 chỗ). Viết test cho repository trước khi chuyển.
3. PERF-01: chỉ mục theo Mã NV trong `staffForPayroll`/`hienHanh` (mục tiêu < 200 ms cho 5.000 NV, cần chủ sở hữu duyệt ngưỡng).
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
