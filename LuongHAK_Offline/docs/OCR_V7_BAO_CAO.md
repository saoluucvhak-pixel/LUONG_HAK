# OCR V7 — Báo cáo nghiệm thu: Thư viện mẫu tự học & Kho chứng từ

Nhánh: `feature/ocr-smart-learning-document-archive` (tách từ `feature/luong-hak-offline-completion-v5`). Không sửa `main`, không đụng công thức lương, không dùng đám mây, không huấn luyện mô hình AI — chỉ lưu ảnh ô + nhãn người dùng đã sửa/duyệt và tra cứu bằng độ giống đặc trưng ảnh.

> **Trung thực về giới hạn**: chưa build / chạy trên Windows; chưa có chữ viết tay thật của công ty. Mọi số "độ chính xác" bên dưới đo trên **chữ số tổng hợp** (`tests/fixtures/synth-digits.js`) — chỉ chứng minh cơ chế chạy đúng, **không** phải độ chính xác thực địa. Tốc độ / dung lượng / quy mô là số đo thật trên máy chạy kiểm thử.

## 1. Đã làm, theo giai đoạn

| GĐ | Nội dung | Nơi |
|---|---|---|
| 1 Kiểm toán | 13 câu hỏi hiện trạng, rủi ro | `docs/AUDIT_V7_OCR.md` |
| 2 Kho chứng từ | Lưu NGUYÊN BẢN trước OCR (SHA-256, không có API xóa/sửa, trùng nội dung chỉ lưu 1 lần); tên chuẩn `{Company}_{YYYYMM}_{Loại}_{BộPhận}_{DocumentID}_{Hash8}.{ext}` ghi trong sidecar (`storedName`); liên kết chứng từ ↔ trang ↔ ô ↔ NV ↔ OCRRunID ↔ SampleID | `main/documents.js`, `core/ocr-learning/service.js` |
| 3 Tự học | Mỗi ô người dùng THỰC SỰ sửa tự ghi mẫu (không có nút "lưu mẫu"); trạng thái `PENDING_APPROVAL → VERIFIED` khi ghi bảng vào Chấm công, `SUPERSEDED / REJECTED / CONFLICT`; 1→7→1 giữ đủ lịch sử, chỉ nhãn cuối hiệu lực; ký hiệu X (giá trị chưa rõ) = nhãn `UNKNOWN` không tự học; `CORRECTED` vs `CONFIRMED` (CONFIRMED mặc định TẮT, bật ở tab Thống kê); hoàn tác ô; thử lại khi ghi lỗi; ảnh byte-trùng / gần-trùng không phình thư viện | `core/ocr-learning/library.js`, `main/ocr-library.js` |
| 4 Nhận dạng | Đặc trưng ảnh 275 chiều (mật độ mực + HOG), chỉ mục thô → so khớp đầy đủ, Top-K có bình chọn, AUTO_ACCEPT / SUGGESTED / UNRECOGNIZED, hạ mức khi cặp dễ nhầm hoặc mâu thuẫn Tesseract; lịch sử nhầm lẫn (OCR đọc A, sửa thành B) | `core/ocr-learning/features.js`, `library.js` |
| 5 Bố cục | Chữ ký bố cục chuẩn hóa theo khung bảng; bố cục lệch → không tự nhận ô bằng thư viện và KHÔNG học từ trang đó (trừ khi người dùng bấm lưu bố cục mới); không bao giờ đọc ô bằng toạ độ cũ | `core/ocr-learning/layout.js` |
| 6 OCR + nghiệp vụ + UI | Lớp chữ PDF dùng trước OCR; luật nghiệp vụ (kỳ, ngày trong tháng, mã NV, trùng, ô không phải số, lệch tổng; ô giờ/số ca không bị giới hạn công BT); màn hình **Thư viện mẫu OCR** 8 tab (Số, Ký hiệu, Chữ viết tay, Bố cục, Chờ xác nhận, Dễ nhầm, Lịch sử sửa, Thống kê) | `pdf-text.js`, `rules.js`, `app.js` |
| 7 Lưu trữ & sao lưu | 4 thư mục cấu hình được (chứng từ, thư viện mẫu, sao lưu chính, sao lưu dự phòng); đổi = chép + kiểm SHA-256, KHÔNG xóa nguồn; Full Backup gồm thư viện mẫu + bố cục + manifest/checksum, khôi phục không phải học lại | `main/storage-paths.js`, `main/fullbackup.js` |
| 8 Tối ưu / nghiệm thu | Chỉ mục min-heap, benchmark thật, báo cáo này | `tests/perf/ocr-library-bench.js` |

Phân quyền: ghi mẫu / duyệt bảng = `input.edit`; xem / tra cứu = `input.view`; duyệt-từ chối-đổi nhãn mẫu và bật CONFIRMED = quyền mới `ocr.library` (Admin, Kế toán lương); đổi thư mục lưu trữ = `backup.restore`. Mọi kênh IPC `ocrlib-*`, `paths-*` đi qua `guarded` ở tiến trình chính. **Không có thao tác xóa mẫu** và không có API sửa chứng từ gốc. Thư viện chỉ ảnh hưởng đọc OCR mới; kỳ lương đã chốt không bị đụng (nhập vẫn qua kiểm kỳ chốt của importer).

## 2. Kiểm thử (chạy thật)
- `npm test`: 404/404 đạt; ESLint 0 lỗi; e2e: 153/153 đạt (Linux). Trong đó có 24 test mới ở `tests/unit/ocr-learning.test.js` (đặc trưng, 1→7→1, duyệt/UNKNOWN/CONFLICT, ghi lỗi không đổi trạng thái, dòng nhật ký cắt dở, tra cứu không AUTO sai, Full Backup + khôi phục + sửa 1 byte bị từ chối, bố cục, lớp chữ PDF, luật nghiệp vụ, kịch bản 0,5→0,6 / trống→1 / xóa / X / gần-trùng), `tests/unit/storage-paths.test.js` (6), tên chuẩn chứng từ.
- e2e (Playwright + Electron, Linux): thêm 4 kịch bản — tự học khi sửa ô 0,5→1→0,5; duyệt bảng → VERIFIED; PDF có lớp chữ dựng bảng không OCR; đổi thư mục thư viện mẫu sang ổ khác.

## 3. Benchmark thật (`node tests/perf/ocr-library-bench.js`, kết quả ở `tests/perf/last-ocr-library-bench.json`)
Tra cứu 1 ô theo quy mô thư viện (máy kiểm thử, 1 luồng): 100 mẫu ≈ 0,1 ms · 1.000 ≈ 0,4 ms · 10.000 ≈ 1,9 ms · **50.000 ≈ 7 ms** (nạp 50.000 mẫu vào bộ nhớ ≈ 1,7 s). Ghi bền 500 lần sửa (PNG + nhật ký fsync) ≈ 1,2–1,5 ms/lần; nạp lại 500 mẫu từ đĩa ≈ 20 ms; kiểm toàn vẹn ≈ 8 ms; 500 mẫu ≈ 2,2 MB.
Độ chính xác (tổng hợp, ngưỡng AUTO 0,93, thư viện 200 mẫu, tập test tách riêng): Tesseract một mình 76,7% → Tesseract + thư viện ≈ 95–97%, AUTO_ACCEPT sai = 0. Ngưỡng được quét trên tập hiệu chỉnh riêng nhưng **không hạ dưới sàn 0,93** vì dữ liệu tổng hợp quá dễ tách (100% ở mọi ngưỡng) — cần hiệu chỉnh lại khi có chữ thật.

## 4. Chưa làm / làm một phần (nói thẳng)
1. **Chưa build và thử trên Windows** (`npm run dist` cần máy Windows; xem mục 5).
2. **Chưa đo trên chữ viết tay thật** → độ chính xác thực địa chưa biết; ngưỡng cần hiệu chỉnh lại sau vài trăm mẫu thật.
3. Liên kết ô ↔ **AttendanceRecordID**: chưa lưu (có DocumentID, trang, vùng ô, NV, kỳ, OCRRunID, SampleID).
4. Tab "Chữ viết tay" (tên người, chữ) mới là khung — thư viện hiện học **chữ số / ký hiệu** ở mức ô, chưa học chữ.
5. PDF scan 100 trang: đọc theo lô 30 trang + nút "Đọc tiếp" (e2e đã kiểm 35 trang, không bỏ trang, lỗi từng trang được báo riêng); chưa chạy 100 trang scan thật. Chưa có pool nhiều tiến trình riêng — dùng worker Tesseract sẵn có.
6. Lịch sử nhầm lẫn được **tính từ mẫu** (không có file riêng); "snapshot kết quả OCR đã duyệt" nằm trong dữ liệu Chấm công + nhật ký hệ thống, chưa có snapshot riêng trong Full Backup.
7. Đã chạy ESLint (0 lỗi). Build Windows vẫn chưa làm được trong môi trường Linux.

## 5. Build Windows & kiểm tay (người có máy Windows)
```
cd LuongHAK_Offline && npm ci && npm test && npm run dist
```
Kiểm tay tối thiểu: (1) mở ảnh bảng công → sửa 3 ô → tab "Thư viện mẫu OCR / Chờ xác nhận" thấy 3 mẫu; (2) "Đưa vào Chấm công" → mẫu thành "Đã xác nhận"; (3) Công ty & Sao lưu → "Lưu trữ" đổi thư mục thư viện sang ổ D: → báo "đã kiểm SHA-256"; (4) tạo Full Backup, khôi phục trên máy khác → thư viện mẫu đủ; (5) mở PDF xuất từ Excel → thấy "Nguồn: lớp chữ của PDF".
