# V10.1 — Đối chiếu `main` với nhánh V10.1 (bản vá KPCĐ 12/10/2026)

Ngày đối chiếu: 14/10/2026. Nguồn: `origin/main` (commit `d220554`, 12/10/2026 — "Sửa lỗi thiếu khấu trừ KPCĐ phần người lao động").

## Kết luận
- `main` chỉ chứa bản **Google Apps Script** (`Tinhluong.gs`, `Code.gs`…); **không chứa** `LuongHAK_Offline`. Hai nhánh không có tổ tiên chung nên không merge được; việc đối chiếu làm theo **quy tắc nghiệp vụ**, không theo diff dòng.
- Bản vá KPCĐ và bản vá công chuẩn TG3/TG4 của `main` **đã có sẵn** trong Electron (`engine.js`); không phải port thêm và **không đổi công thức tính lương**.

| Bản vá trên `main` | Quy tắc | Vị trí trong Electron | Test khóa số liệu |
|---|---|---|---|
| `d220554` KPCĐ NLĐ (0,5% lương đóng BH, `DM_BAOHIEM."NLD.KPCD"`) | Trừ riêng, **không gộp** vào "Cộng BH NLĐ đóng"; trừ vào thu nhập chịu thuế và Thực lĩnh đúng 1 lần; chỉ trừ khi đủ ngưỡng công; thêm cột "NLĐ.KPCĐ" (RP_BHXH) và "KPCĐ trừ NLĐ" (bảng lương) | `engine.js` ~640–702 (`kpcdNLD`), `core/bh-report.js`, `core/reporting/payroll-reports.js` | `U-QC-07`, `U-TAXP-06`, **`U-MAIN-01/02`** (5.450.000 → 27.250; BH 572.250) |
| `25332f6` Công chuẩn TG3/TG4 | Cách cũ: luôn trừ Chủ nhật rồi trừ thêm N (tháng 31 ngày, 4 CN: TG3 = 23, không phải 27) | `engine.js` `congChuan` | **`U-MAIN-03`**, `engine.test.js`, `quy-che-2026.test.js` |

## Khác biệt có chủ đích (không phải thiếu sót)
- Electron có thêm chế độ **quy chế 2026** (công chuẩn = số ngày − giảm trừ khai trong mã lương) và **thuế cấu hình theo mã** (`DM_TNCN`, `TAX_CONFIG_ERROR`); `main` (Apps Script) chưa có.
- Nhánh MIEN (mã thuế miễn) trừ KPCĐ nhưng không trừ "Tiền cơm"; nhánh LOI/lũy tiến trừ cả hai — đúng quy tắc của `main`.

## Lưu ý nghiệp vụ còn mở (cần kế toán xác nhận, không tự đổi)
- Prompt phần 6.4: **không mặc định** KPCĐ do NLĐ chịu hoặc đồng nhất với đoàn phí công đoàn. Quy tắc hiện tại (trừ khi `DM_BAOHIEM."NLD.KPCD" > 0`) là **cấu hình theo danh mục**, mặc định mã `BH01` có `NLD.KPCD = 0`. Việc mã nào có tỷ lệ > 0 là quyết định chính sách của doanh nghiệp và phải đối chiếu với chính sách/quy định hiện hành trước khi cấu hình.
- Trạng thái: CODE_DONE/TEST_DONE cho đối chiếu quy tắc; **BUSINESS_RECONCILED** vẫn chờ kế toán đối chiếu bảng lương thật.
