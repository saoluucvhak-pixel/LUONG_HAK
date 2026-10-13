# V9 — Đối chiếu chính xác tiền lương với Excel (T9/2025, T11/2025)

Nguồn: 3 workbook lương HAK Đà Nẵng do chủ sở hữu cung cấp (61 NV/kỳ), chạy bằng `tools/recon/recon-t9-2025.js`, `recon-t11-2025.js` (xuất bảng chi tiết bằng `RECON_OUT=file.json`) và phân loại bằng `tools/recon/classify.js`.
Bảng chi tiết từng NV × khoản (Kỳ | Mã NV | Khoản | Excel | App | Chênh | Nguyên nhân | Hướng xử lý) chứa dữ liệu cá nhân nên **không** nằm trong repo; file CSV được gửi riêng cho chủ sở hữu.
Chạy lại: `RECON_OUT=/tmp/r9.json node tools/recon/recon-t9-2025.js 2026 to sep.json`, tương tự T11, rồi `node tools/recon/classify.js out.csv r9.json r11.json`.

## Kết quả (quy chế 2026, bù theo tổ)

| Kỳ | NV | NV có ít nhất một khoản lệch | Số dòng lệch theo loại |
| --- | ---: | ---: | --- |
| 09/2025 | 61 | 16 | B: sản lượng 12×2 (tấn + lương SL) · E: thuế/truy thu/công chuẩn · C: 1 · hệ quả: theo khoản đầu nguồn |
| 11/2025 | 61 | 18 | B: lương SL 16 · E: thuế 2 · hệ quả theo khoản đầu nguồn |
| Tổng | | | A (lỗi thuật toán chưa giải thích): **0** · B: 52 · C: 1 · E: 9 · hệ quả: 41 |

## Phân loại

- **A — Lỗi thuật toán:** không còn dòng chênh nào *chưa giải thích*; công cụ gán `A?` cho bất kỳ chênh lệch nào không rơi vào B–E (hiện 0). Không có thay đổi công thức nào trong V9 phần này.
- **B — Khác biệt quy chế đã duyệt:** 12 SP/kỳ: app chia sản lượng theo công BT (R-73) — phiếu của tổ chưa có công BT ở trạng thái chờ (`PENDING_ATTENDANCE`), Excel chia đều theo "NV vắng" bằng `Text.Contains`. T11: Excel không có tiền bù sản lượng, app bù theo tổ. Đã chứng minh khi giả lập đủ công thì phân bổ lệch 0/16 (xem `DOI_CHIEU_EXCEL_2025.md`). **Giữ quy chế, không tự khớp.**
- **C — Dữ liệu nguồn:** 1 NV (T9) chênh thuế TNCN nhỏ (~3,2 nghìn đồng): nghi hồ sơ người phụ thuộc (đăng ký/hiệu lực) và/hoặc KPCĐ. Cần đối chiếu hồ sơ NPT của NV; không đổi công thức.
- **D — Pháp lý theo kỳ:** chưa kết luận. Dữ liệu 2025 đối chiếu bằng quy chế 2026 cấu hình trong app; việc áp quy định thuế/BH có hiệu lực tại thời điểm phát sinh vẫn phải do người có thẩm quyền xác nhận.
- **E — Cần quyết định của quản lý:** (1) Excel **không khấu trừ** thuế TNCN vào "Thu nhập còn lại" (ví dụ NV lương 30 triệu) trong khi app trừ; (2) KPCĐ có được trừ khi tính thu nhập chịu thuế (T9 Excel không, T11 có); (3) truy thu BH khi chưa đủ công: Excel vừa trừ NLĐ vừa truy thu phần doanh nghiệp; (4) công chuẩn của mã CĐ (25 so với 30, không ảnh hưởng tiền).

## Không được tuyên bố
- Không có nghĩa là "khớp 100%": 48/61 (T9) và 45/61 (T11) khớp hoàn toàn các khoản thu nhập + BH; phần còn lại là B/C/E ở trên.
- Chỉ HAK Đà Nẵng, 2 kỳ; chưa đối chiếu TC1/TC3/TC5/TC6, DQ, đơn nghỉ phép, kỳ 2026 của CNHAK/HAKQN/Đại Hiệp (cần workbook nguồn).
