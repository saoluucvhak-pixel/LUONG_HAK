# V10.1 — Kiểm tra OCR

**Trạng thái trung thực:** OCR chạy offline đúng và đạt 100% trên ảnh mẫu **giả lập**; **chưa** được kiểm trên chữ viết tay / ảnh chụp bảng chấm công thật.

## Đã làm
- `tests/e2e/ocr-eval.js` (chạy trong CI, bước sau E2E): mở app Electron thật, đọc từng ảnh/PDF mẫu qua màn "Đọc ảnh chấm công", so **từng ô** với đáp án sinh từ `tests/fixtures/ocr/make_fixtures.py`. Kết quả máy đọc được: `V10_1_OCR_CHECK.json`.
- Kết quả cục bộ (Linux, tesseract.js đóng gói sẵn, không gọi mạng):

| Ca | Ô đúng | Thời gian |
| --- | --- | --- |
| Bảng in — ảnh PNG | 90/90 | ~3 s |
| Bảng in — PDF scan | 90/90 | ~3,5 s |
| Bảng in — trang PDF do pdf.js vẽ | 90/90 | ~3 s |
| Bảng tay dấu x (2 khối ngày, mỗi người 1 cột) | 90/90 | ~7 s |

  Ngưỡng đạt: 99% (bảng in), 97% (dấu x). Tự kiểm "Kiểm tra OCR" trong app: đọc được "12". 0 lỗi JavaScript.
- Giữ nguyên bộ test OCR sẵn có: `npm test` (timesheet-ocr, ocr-learning, name-memory, ocr-state) và các kiểm tra E2E (PNG, PDF, PDF có lớp chữ, dừng/đọc lại, sửa ô → ghi mẫu, xuất Excel kết quả OCR, PDF > 30 trang, bắt buộc đăng nhập mới dùng OCR).
- CI Windows build có bước tự kiểm OCR trong bản đóng gói.

## Chưa làm / giới hạn
- Toàn bộ ảnh mẫu là **ảnh tổng hợp** (chữ in, nét x vẽ bằng máy). Độ chính xác trên chữ tay thật, ảnh chụp nghiêng/mờ/bóng, giấy nhàu **chưa đo được** — cần bạn đưa vài ảnh bảng chấm công thật (đã che CCCD/tên nếu cần) để đo; ngoài repo, không commit.
- Ca lịch làm dọc và lịch theo ca chưa đưa vào bộ đo từng ô (đã có kiểm tra tổng ở E2E).
- Mọi kết quả OCR vẫn phải qua màn xem trước và người dùng xác nhận trước khi ghi vào chấm công — đây là điểm kiểm soát, không thay bằng độ chính xác của máy.

## Khởi động lại sau khi tạo nhân viên
Xem `V10_1_TEST_RESULTS.md` (mục Ghi chú trung thực): E2E đã chạy ca đóng – mở thật.
