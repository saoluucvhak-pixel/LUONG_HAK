# V10.1 — Checklist phát hành và mức nghiệm thu

## Trạng thái nghiệm thu (theo mức)

| Mức | Trạng thái | Căn cứ |
| --- | --- | --- |
| `CODE_DONE` | **Đạt cho phạm vi đã làm** (Phase 1–5) | `V10_1_AUDIT.md` |
| `TEST_DONE` | **Đạt cục bộ** | 579 unit/integration/regression, E2E 249/249, 0 lint, 0 lỗi JS ở 108 lượt duyệt màn hình |
| `CI_PASS` | **Đạt trên commit `4a0a8cf`** (run 38508166604: cú pháp/lint/unit+integration+regression/audit, E2E Electron, build Windows đều `success`). Các commit sau đó chỉ sửa tài liệu — xem run mới nhất của PR #31 | Actions → PR #31 |
| `WINDOWS_BUILD_PASS` | **Đạt trên `4a0a8cf`** — bộ cài NSIS dựng được và OCR tự kiểm trong bản đóng gói đạt; artifact `TinhLuongHAK-Setup` (~120 MB, lưu 14 ngày mặc định). Dựng được ≠ đã chạy thử trên Windows thật | Artifacts của run 38508166604 |
| `WINDOWS_UAT_PASS` | **Chưa thực hiện** | `V10_1_WINDOWS_UAT.md` |
| `BUSINESS_RECONCILED` | **Một phần** (HAK ĐN 2 kỳ 2025, A=0, B/C/E chờ quyết định); các công ty/kỳ khác `BLOCKED_SOURCE_DATA` | `V10_1_PAYROLL_RECONCILIATION.md` |
| `RELEASE_READY` | **KHÔNG** | còn các điều kiện bên dưới |

## Điều kiện chưa đạt (chặn `RELEASE_READY`)

- [ ] CI xanh trên HEAD cuối cùng của PR (đã xanh ở `4a0a8cf`; kiểm lại sau commit tài liệu).
- [ ] Windows UAT 12 kịch bản.
- [ ] Quyết định quản lý cho nhóm B/C/E trong đối chiếu; workbook các công ty/kỳ còn lại.
- [ ] Quyền **đọc** theo vai trò tại Main (DESIGN_GAP).
- [ ] Mã hóa dữ liệu trên đĩa (hoặc chấp nhận rủi ro bằng văn bản cho máy tin cậy).
- [x] Mẫu riêng (màn hình, Excel, PDF) cho báo cáo nhân sự/sản lượng/bơm dăm/thưởng–trừ/tạm ứng/suất cơm — xem `V10_1_REPORTING_SAMPLES.md`.
- [ ] Thử in thật 6 mẫu trên máy in và mở bằng Microsoft Excel (cần `WINDOWS_UAT`); các báo cáo lương khác (bảo hiểm, hạch toán, so sánh kỳ…) vẫn dùng bộ xuất chung.
- [ ] Vai trò "chỉ xem phiếu lương cá nhân".
- [ ] Visual regression có ảnh chuẩn; đo "độ trễ tương tác" và thời gian lọc.

## Đã đạt theo tiêu chí Phần XX (tóm tắt)
Lỗi P0 đã sửa có test ✔ · Tạo nhân viên lưu đủ dữ liệu và không nửa chừng ✔ · Main bảo vệ **ghi** ✔ (đọc ✘) · Khôi phục Admin xác thực ✔ · Duyệt nhân sự nguyên tử ✔ · Không vượt gate xuất ✔ · Không bỏ qua lỗi phân bổ sản lượng ✔ · Chi tiết thanh toán đủ NV, đủ cột ✔ · Thanh 7 bước thật ✔ · Chỉ hai phương pháp bù ở bản chốt ✔ · Công thức không đổi ✔ · Master–detail chứng từ ✔ · Ngày dd/MM/yyyy ở tạo nhân viên và xuất ✔ · Excel/PDF bảng rộng ✔ · Benchmark ✔ · Tài liệu + PR ✔.

## Quy tắc
Không tự merge. Không sửa `main`. PR ở trạng thái DRAFT. Nhánh chồng trên PR #30 (`feature/luong-hak-v10-business-ux-redesign`).
- [x] OCR đo từng ô trên ảnh mẫu giả lập (`V10_1_OCR_CHECK.md`); [ ] đo trên vài ảnh bảng chấm công thật do bạn cung cấp.
- [x] Đóng – mở lại app sau khi tạo nhân viên (kể cả tắt đột ngột) bằng E2E.
