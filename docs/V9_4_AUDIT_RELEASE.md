# V9.4 — Báo cáo nghiệm thu nội bộ (trung thực)

Nhánh: `feature/luong-hak-offline-v9-4-ux-payroll-reporting` (từ HEAD nhánh V9.2; không có nhánh V9.3). Phiên bản: `2.0.0-alpha.25`.
**Không phải bản ổn định. Chưa chạy trên Windows thật (`WINDOWS_UAT_PENDING`). Chưa thử với bản scan chấm công thật. Không dùng dữ liệu lương thật nào trong repo.**
Tiêu chí “xong” = có code + có test chạy thật (unit hoặc e2e điều khiển giao diện Electron) — không tính “module có tồn tại” hay CI xanh.

## 1. Trạng thái từng hạng mục
| Mục | Trạng thái | Bằng chứng | Còn thiếu / giới hạn |
| --- | --- | --- | --- |
| II. OCR tự ghi mẫu sửa, hiện trạng thái | **Xong (code + e2e)** | `v94-ocr-state`; e2e “OCR V9.4” (trạng thái trên ô, dán 2×2 → 4 sự kiện, bền sau mở lại app) | Chưa kiểm với **bản scan thật**; chưa đo tỉ lệ học |
| III. Bộ lọc: popover duy nhất, Áp dụng/Hủy, chip, định vị | **Xong (e2e)** | e2e “Bộ lọc V9.4” (1 popover, Escape/bấm ngoài, trong cửa sổ, Áp dụng/Hủy/Chọn tất cả/tìm không dấu bằng thành phần thật) | Chưa chạy 20 bước như phiếu yêu cầu (đã chạy ~12 bước); chưa kiểm responsive dưới 900 px; “không tính lại engine khi đổi bộ lọc” = có bộ nhớ theo phiên bản dữ liệu (`kqKy`), chưa có đo thời gian trong Electron |
| IV. Báo cáo lương: Tổng hợp, Thanh toán, Kê CK, Tiền mặt | **Xong (unit + e2e)** | `v94-payroll-reports`, e2e “V9.4: …” | Bảng kê CK chưa chạy e2e với dữ liệu có người chuyển khoản (dữ liệu e2e chỉ có 1 NV trả tiền mặt) — logic có unit test |
| IV. Phiếu lương, Tổng hợp phòng ban/công, Phân bổ sản lượng, Lương 12 tháng, Thu nhập năm, Thuế năm | **Giữ như V9.2** (chỉ đổi vị trí menu + tiêu đề màn hình IN HOA) | e2e V9.2 còn đạt | **Chưa thiết kế lại** Excel/PDF của các báo cáo này |
| IV. Sổ thanh toán (lập → duyệt → chi, chống trùng, khóa) | **Xong** | `U-PAY94-05/06`, `U-WP-11`, e2e (lập, tự duyệt bị chặn, lập trùng bị chặn, hủy có lý do) | Chưa có giao diện **chi một phần** theo từng người (mô hình hỗ trợ cộng dồn nhiều chứng từ); chưa e2e đường duyệt bởi người thứ hai + ghi nhận đã chi (chỉ unit) |
| V. Excel chuyên nghiệp | **Một phần** | `U-XLSX94-01` + e2e mở file ExcelJS: tiêu đề IN HOA, A4/A3, vừa ngang, lặp tiêu đề, đóng băng, AutoFilter, MãNV/STK là chữ | Áp dụng cho 4 báo cáo mới + Bảng tính lương. **Xuất trọn bộ, Phiếu lương, báo cáo khác vẫn dùng SheetJS (không định dạng)** |
| VI. Tiêu đề IN HOA | **Một phần** | e2e (màn hình), unit (Excel), `report-html` (PDF) | Chưa rà mọi tiêu đề nhỏ trong báo cáo khác |
| VII. Danh mục chỉ xem → Sửa → Lưu/Hủy, xóa/ngừng | **Xong cho lưới danh mục** (`grid()`); main chặn xóa mã đã dùng trong kỳ chốt | e2e (ô khóa, “chưa lưu”, Lưu/Hủy, Q-14), `U-WP-10` | Màn hình nhập liệu hằng tháng giữ sửa trực tiếp (có chủ đích); biểu mẫu hồ sơ nhân sự không thuộc phạm vi |
| VIII. Thuế TNCN cha–con, nút Chi tiết | **Xong (e2e)** | e2e mở/đóng panel con; `U-TAX94-*` | Phiên bản/duyệt/lịch sử giữ từ V9.2 |
| IX. Kiểm toán tính thuế | **Một phần (đủ phần lõi)** | `U-TAX94-01..08`; `TAX_CONFIG_CONFLICT` (bậc chồng) và `TAX_CONFIG_ERROR` (hở/ tỷ lệ sai/ thiếu mã) chặn chốt ở renderer **và main**; nút XEM CHI TIẾT TÍNH THUẾ | Giảm trừ “một lần”/ngoại lệ, đổi mã thuế giữa hai kỳ chưa có test riêng; nút chỉ xem được trong hộp chi tiết lương từng người (chưa e2e) |
| X–XII. Bảo mật main, CompanyID, mã hóa, backup tiến độ | Kế thừa V9.2 | `v92-write-policy` (+U-WP-11/12) | **Mã hóa dữ liệu trên đĩa: KHÔNG làm.** Backup/chuyển thư mục: chưa có thanh tiến độ |
| XIII. E2E giao diện | Xem mục 3 | `npm run test:e2e` | Phân quyền: chỉ tài khoản Kế toán lương + Admin; **chưa có e2e cho tài khoản hoàn toàn không quyền** (có negative test ở main) |
| Đối chiếu workbook nguồn | **`BLOCKED_SOURCE_DATA`** | — | Không có file Excel nguồn |
| Bản cài Windows | **`WINDOWS_UAT_PENDING`** | workflow `build-windows.yml` | Chưa ký, chưa chạy thử |

## 2. Hiệu năng (dữ liệu giả lập, đo bằng Node, ±20%)
`node tests/perf/v94-bench.js`
| NV | Tổng hợp | Kê CK | Lập chứng từ | Kiểm tra sổ | Dựng Excel |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 500 | 3 ms | 2 ms | 3 ms | 4 ms | ~190 ms |
| 2.000 | 6 ms | 9 ms | 4 ms | 6 ms | ~300 ms |
| 5.000 | 8 ms | 13 ms | 6 ms | 11 ms | ~400 ms (181 KB) |
Lần đo đầu “Kiểm tra sổ” 5.000 NV mất 265 ms (O(n²)); đã sửa bằng chỉ mục → 11 ms. `v92-bench` không đổi so với V9.2 (tính lương 5.000 NV ~340 ms). Chưa đo trong Electron/Windows.

## 3. Kiểm thử
- `npm test`: 529 đạt, 0 lỗi. ESLint `--max-warnings 0` sạch.
- `npm run test:e2e` (Electron + Playwright, xvfb): kết quả lần chạy cuối ghi ở PR. Lỗi tìm được và sửa trong lúc làm V9.4: xem mục 4.

## 4. Lỗi tìm thấy khi chạy e2e và đã sửa
1. Lưu danh mục có hiệu lực trong kỳ đã chốt bởi tài khoản không phải Admin: chỉ ghi lỗi vào dòng, không báo → nay hiện thông báo “Chỉ Admin…”.
2. Biểu thuế một bậc “không giới hạn” trộn với các bậc dùng chung bị coi là xung đột → các test cũ phải dùng `thayBieu` (biểu riêng thay hẳn biểu chung). **Hành vi cũ “bậc riêng ghi đè từng bậc của biểu chung” không còn được phép khi tạo xung đột.**
3. Biểu tượng 💳 chưa có trong bộ icon SVG → đổi sang 💼 (test icon của V9.2 bắt được).
4. Đường dẫn e2e: tải file của báo cáo mới làm lệch bài test “mở file vừa tải” → đặt khối test sau phần file đã tải.
5. `isPayrollFile` không nhận “KeChuyenKhoan_*”: file kê CK của kỳ chưa chốt có blocker lẽ ra bị chặn tải → đã thêm mẫu.

## 5. Giới hạn đã biết / rủi ro
- Số liệu mẫu và ảnh chụp trong `docs/v94-samples/` là **dữ liệu giả lập** để xem bố cục, không phải dữ liệu lương thật.
- Ảnh “trước” (V9.2) không được chụp; chỉ có ảnh “sau”.
- Sổ thanh toán lưu trong `data.json` chưa mã hóa như phần còn lại.
- Người lập không được tự duyệt, kể cả Admin (cố ý). Công ty chỉ có 1 người phải tạo thêm tài khoản thứ hai.
- Quyền mới `payment.record` được cấp cho Admin, Kế toán lương, Kế toán thanh toán. Tài khoản cũ không bị đổi vai trò.

## 6. Cần chủ sở hữu quyết định / cung cấp
1. File Excel nguồn để đối chiếu (BLOCKED_SOURCE_DATA).
2. Bản scan chấm công thật để đo OCR.
3. Máy Windows để chạy UAT; ký bộ cài.
4. Chính sách có cho Admin duyệt chứng từ do chính mình lập hay không (hiện: không).
