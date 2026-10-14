# V10.1 — Kết quả kiểm thử

Chạy trên HEAD của nhánh `feature/luong-hak-v10-1-hardening-payroll-release` (xem hash ở PR). Kết quả CI thật nằm ở tab Checks của PR; bảng dưới tách **chạy cục bộ** và **CI**.

## Cục bộ (Linux sandbox, Node 22)

| Hạng mục | Lệnh | Kết quả |
| --- | --- | --- |
| Cú pháp | `node --check` mọi `.js` trong app/core/main/ui | 0 lỗi |
| ESLint | `npx eslint@9.39.5 . --max-warnings 0` | 0 cảnh báo |
| Unit + Integration + Regression | `npm test` | 579 đạt / 0 hỏng (gồm U-MAIN-01..03 đối chiếu bản vá `main`, U-BCR-01..06 mã hóa sao lưu) |
| E2E Electron | `xvfb-run -a node tests/e2e/run-e2e.js` | 249/249 đạt (thêm kịch bản Full Backup mã hóa: mật khẩu yếu, nhập lại lệch, sai mật khẩu, đúng mật khẩu) |
| Duyệt màn hình 3 độ phân giải | `tests/e2e/v10-screens.js` (1366×768, 1600×900, 1920×1080 × 36 màn) | 108 lượt, 0 tràn ngang, 0 lỗi JS (`V10_SCREEN_CHECK.json`) |
| Phụ thuộc chạy trong app | `npm audit --omit=dev --audit-level=low` | 0 lỗ hổng |
| Hiệu năng | `tests/perf/*` | `V10_1_PERFORMANCE.md` |
| Đối chiếu workbook nguồn | `tools/recon/*` | Giống hệt V9, A=0 — `V10_1_PAYROLL_RECONCILIATION.md` |

Test mới của V10.1: `v101-ops-reports` (12: sáu mẫu báo cáo riêng, Excel nhiều sheet, PDF, an toàn), `v101-security` (khôi phục Admin, gate, chứng từ), `v101-steps` (4), `v101-hr-create` (5), `v94-payroll-reports` (+9: CHI_TIET_TT 4, Excel 4, PDF 1), `v92-write-policy` (+U-V101-CLOSE-01, U-WP-07 dùng bản chốt thật). Không xóa/làm yếu assertion nào để cho xanh; hai test cũ bị đổi vì hành vi được **siết chặt có chủ đích** (U-WP-07 bản chốt phải là kết quả engine; U-REPO-08 thêm một ngoại lệ `txn` có ghi lý do), cùng test "Chi tiết thanh toán" cũ thay bằng test theo mô hình mới.

## Ghi chú trung thực
- Một lần E2E ở Phase 3 hỏng do cờ chống bấm đúp tôi tự thêm; đã gỡ cờ (không sửa test).
- Log E2E có 2 dòng cũ "chưa đăng nhập (bảng dm_congthuc)" do migration trước đăng nhập — có từ trước V10.1, chưa sửa.
- `tests/perf/ui-bench.js`: đo mở lưới/gõ phím được; phần "chờ kết quả lọc" chưa đo đúng (selector cũ).
- Không có kiểm thử hồi quy hình ảnh so ảnh chuẩn (visual regression baseline): hiện chỉ kiểm tràn ngang + lỗi JS + chụp ảnh để xem tay.
- OCR: đã đo độ chính xác theo từng ô trên ảnh/PDF mẫu **giả lập** (`tests/e2e/ocr-eval.js`, 4/4 ca đạt, 360/360 ô) — xem `V10_1_OCR_CHECK.md`. Chữ tay / ảnh chụp thật **chưa** đo.
- Khởi động lại sau khi tạo nhân viên: E2E chạy ca đóng – mở thật (thoát bình thường; tắt đột ngột SIGKILL ngay sau khi lưu; tạo bị từ chối rồi tắt đột ngột) — đủ các bảng hồ sơ còn nguyên, không dòng nửa chừng, không sót file tạm, mở lại không vào màn khôi phục. Chưa thử cắt điện thật / đĩa đầy.

## CI (GitHub Actions — `build-exe.yml`)
Workflow chạy khi mở PR: Cú pháp · Lint · Unit/Integration/Regression · audit → E2E Electron (xvfb) → Build bộ cài Windows + tự kiểm OCR trong bản đóng gói. **Kết quả trên commit `4a0a8cf` (PR #31, run 38508166604): cả 3 job — kiểm tra tĩnh+unit/integration/regression+audit, E2E Electron, build Windows — đều `success`.** Commit sau đó chỉ đổi tài liệu; kiểm tra lại run mới nhất trước khi coi là HEAD cuối.
