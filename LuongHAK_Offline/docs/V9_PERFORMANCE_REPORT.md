# V9 — Báo cáo hiệu suất (số đo thật, cùng máy)

Máy đo: container Linux 2 vCPU, 8 GB RAM, Node (Electron 43 không dùng cho bench số liệu); mỗi bảng chạy 1 lần (không lấy trung bình nhiều lần → dao động ±10–20 %). Dữ liệu tổng hợp từ `tests/fixtures/build.js`.
**Không đo được:** CPU %, I/O đĩa, độ trễ giao diện trong Electron thật, bất kỳ chỉ số nào trên Windows. RAM chỉ có “heap Node” ở bench tính lương.

## 1. Cải thiện có đo trước/sau
| Hạng mục | Quy mô | Trước | Sau | Ghi chú |
| --- | --- | ---: | ---: | --- |
| Sổ lao động (`reports().soLaoDong`) — tổng công tăng ca mỗi NV | 5.000 NV, 27.602 dòng công | **1.933 ms** (cả cột “Báo cáo NS” 2.173 ms) | **72 ms** (cột 92–99 ms) | O(NV × dòng công) → gom 1 lần theo Mã NV; test hồi quy 466/466 |
| Bộ nhớ đệm AST công thức | 40.000 lượt tính (5.000 NV) | 335,5 ms *(lần đo này)* / 205,6 ms *(V8)* | 39 ms / 15,7 ms | kết quả giống hệt (`hit 39999 / miss 1`); hai lần đo khác nhau do máy bận khác nhau |
| Nhập lại chấm công 1 kỳ (re-import) | 9.184 dòng | “~9,2 s” trong audit V5 | **~0,4 s** (406–431 ms) | audit V5 đọc nhầm số dòng 9184 thành 9,2 s — không phải tối ưu mới |

## 2. Số đo hiện tại (chưa có “trước” để so — là mốc cơ sở)
**Tính lương / dữ liệu** (`tests/perf/bench.js`)
| NV | Dòng công | Dữ liệu (MB) | Tính lương 1 kỳ (ms) | Kiểm tra toàn vẹn (ms) | Báo cáo NS (ms) | Heap (MB) |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 557 | 0,19 | 10 | 22 | 8 | 8 |
| 500 | 2.781 | 0,9 | 21 | 42 | 24 | 16 |
| 1.000 | 5.549 | 1,81 | 32 | 80 | 30 | 22 |
| 5.000 | 27.602 | 9,11 | 149 | 414 | 92 | 68 |
(Yêu cầu V9 còn có 2.000 NV — chưa đo riêng; ngoại suy không được dùng.)

**Nhập chấm công** (`attendance-import-bench.js`)
| Dòng | plan (ms) | apply (ms) | plan lần 2, đã có dữ liệu (ms) |
| ---: | ---: | ---: | ---: |
| 5.000 | 205 | 33 | 217 |
| 10.000 | 324 | 62 | 376 |
| 30.000 | 1.092 | 189 | 1.195 |

**Thư viện mẫu OCR** (`ocr-library-bench.js`)
| Mẫu | Nạp bộ nhớ (ms) | Dựng chỉ mục (ms) | Tra cứu / ô (ms) |
| ---: | ---: | ---: | ---: |
| 1.000 | 38 | 2,7 | 0,63 |
| 10.000 | 397 | 19,6 | 2,13 |
| 50.000 | 1.690 | 75,8 | 7,5 |
Ghi 500 lần sửa: 896 ms (1,8 ms/lần); duyệt 16 ms; nạp lại 24 ms.
Độ chính xác trên **chữ số tổng hợp** (không phải chữ viết tay thật): Tesseract 76,7 % → có thư viện 95,3 %, tự nhận sai 0/105. Không dùng làm con số về scan thật.

**Kho chứng từ + Full Backup** (`vault-bench.js`)
| Chứng từ | Gói (MB) | Thêm (ms) | Tạo gói + tự kiểm (ms) | Kiểm tra gói (ms) | Nhập vào kho trống (ms) | Verify kho (ms) |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 19,6 | 55 | 301 | 94 | 116 | 28 |
| 500 | 98 | 250 | 1.360 | 493 | 561 | 116 |
| 2.000 | 391,8 | 1.337 | 5.600 | 1.813 | 2.166 | 454 |
Tạo gói 392 MB chạy **trên luồng chính** ~5,6 s → giao diện đứng trong thời gian đó (giới hạn đã biết).

## 3. Chưa đo (ghi rõ để không bị hiểu nhầm là đã đạt)
OCR PDF 10/35/100/200 trang; xuất Excel/PDF 100–2.000 NV; Restore gói lớn; 10.000 chứng từ; 2.000 NV tính lương; mọi chỉ số RAM/CPU/I/O/độ trễ UI trong Electron.
