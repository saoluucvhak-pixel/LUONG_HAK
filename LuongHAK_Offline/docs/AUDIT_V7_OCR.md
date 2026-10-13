# AUDIT V7 — OCR hiện trạng & thiết kế Thư viện mẫu tự học

Nhánh `feature/ocr-smart-learning-document-archive` (từ HEAD nhánh V5). Chỉ đo/đọc code, không có dữ liệu viết tay thật.

## 1. Hiện trạng trước V7 (13 câu hỏi của Master Prompt)

| # | Câu hỏi | Hiện trạng |
|---|---|---|
| 1 | OCR dùng engine nào | Tesseract.js 5.1.1 chạy offline trong tiến trình chính (`main/ocr-service.js`, worker digit/text/block/page/ca) + tiền xử lý tự viết (`core/table-grid.js`, `core/timesheet-ocr.js`) |
| 2 | Nhận diện bảng | Có: tìm đường kẻ, dựng ô, xóa đường kẻ, ghép dòng/cột (`timesheet-parse.js`) |
| 3 | Ảnh ô có được lưu không | KHÔNG (trước V7) — chỉ giữ trong bộ nhớ trang đang đọc |
| 4 | Lịch sử sửa ô | KHÔNG (trước V7) |
| 5 | Chứng từ gốc | Có từ GĐ4 V5 (`main/documents.js`, DocumentID, SHA-256, không có API xóa) |
| 6 | Thư viện mẫu | KHÔNG (trước V7) |
| 7 | PDF | Dựng trang bằng pdf.js theo lô; CHƯA lấy lớp chữ (text layer) |
| 8 | Chống đọc trùng | Chỉ theo SHA-256 chứng từ; chưa có OCRRunID |
| 9 | Full Backup | Có (chứng từ + dữ liệu), CHƯA có thư viện mẫu OCR |
| 10 | Chọn thư mục lưu | Một phần (thư mục xuất); chưa có 4 thư mục riêng |
| 11 | Phân quyền | IPC guard theo quyền; chưa có quyền riêng cho thư viện mẫu |
| 12 | Test | npm test 379 / e2e 145 xanh (nhánh V5) |
| 13 | Rủi ro | Học sai nhãn làm hỏng kết quả sau → phải duyệt, giữ lịch sử, hoàn tác |

## 2. Thiết kế đã làm (V7)

- `core/ocr-learning/features.js`: vector 275 chiều/ô (mật độ mực 12×12, HOG 4×4×8, tỷ lệ khung) — KHÔNG chỉ SHA-256.
- `core/ocr-learning/library.js`: thư viện append-only (sample/edit/status/relabel/refs); trạng thái PENDING_APPROVAL → VERIFIED / SUPERSEDED / REJECTED / CONFLICT; phân biệt nguồn CORRECTED vs CONFIRMED (CONFIRMED mặc định tắt); nhãn `UNKNOWN` (ký hiệu X hiển thị nhưng giá trị nghiệp vụ chưa rõ) không tự học; tra cứu Top-K + đồng thuận, ngưỡng AUTO_ACCEPT / SUGGESTED / UNRECOGNIZED, hạ mức khi cặp dễ nhầm hoặc mâu thuẫn Tesseract.
- `main/ocr-library.js`: lưu bền `library.jsonl` (fsync) + ảnh ô `images/<xx>/<sha256>.png`; ghi lỗi không làm đổi trạng thái bộ nhớ; dòng cuối cắt dở bị bỏ qua; `verify()` kiểm ảnh.
- IPC `ocrlib-*` có `guarded`: ghi mẫu/duyệt = `input.edit`, xem/tra cứu = `input.view`, đổi trạng thái/nhãn = quyền mới `ocr.library` (admin, kế toán lương).
- `core/ocr-learning/service.js` (OCRCorrectionLearningService, renderer): sửa ô → tự ghi mẫu, lỗi thì xếp hàng thử lại; duyệt khi ghi bảng vào Chấm công.

## 3. Giới hạn trung thực
- Chưa có chữ viết tay thật: mọi số liệu độ chính xác từ ảnh TỔNG HỢP (`tests/fixtures/synth-digits.js`) chỉ chứng minh cơ chế, không phải độ chính xác thực tế.
- Chưa build/test trên Windows (chỉ Linux + Electron/Playwright).
