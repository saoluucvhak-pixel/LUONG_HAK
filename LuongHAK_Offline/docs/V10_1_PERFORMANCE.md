# V10.1 — Hiệu năng (đo thật, dữ liệu giả lập)

Mọi số dưới đây đo trên môi trường CI/sandbox (Node 22, Linux, không GPU), dữ liệu **giả lập** từ `tests/fixtures/build.js` (`regressionDataset`). Không có dữ liệu thật của khách hàng. Đây là **baseline**, chưa phải cam kết hiệu năng trên máy Windows của người dùng (xem `V10_1_WINDOWS_UAT.md`). Không công bố % tối ưu vì chưa có baseline trước/sau cho từng thay đổi.

## 1. Lõi dữ liệu (`node tests/perf/bench.js`)

| Số NV | Chấm công (3 kỳ) | Dữ liệu | Ghi JSON | Đọc JSON | Dựng DS lương | Tính lương 1 kỳ | Kiểm tra toàn vẹn |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 557 | 0,19 MB | 2 ms | 2 ms | 2 ms | 23 ms | 179 ms |
| 500 | 2.781 | 0,90 MB | 8 ms | 5 ms | 6 ms | 45 ms | 927 ms |
| 1.000 | 5.549 | 1,81 MB | 17 ms | 9 ms | 9 ms | 94 ms | 1.856 ms |
| 5.000 | 27.602 | 9,11 MB | 79 ms | 88 ms | 37 ms | 332 ms | 9.184 ms |

(Cột "Kiểm tra toàn vẹn" là `core/integrity.js`; tăng gần tuyến tính, 5.000 NV ≈ 9 s — chạy khi chốt kỳ / theo yêu cầu, không chạy mỗi lần vẽ màn hình. Thanh 7 bước cache theo `dbRev` nên chỉ chạy lại khi dữ liệu đổi.)

## 2. Tiến trình chính, báo cáo, xuất file (`node tests/perf/v101-bench.js`, kết quả ghi `V10_1_PERF_RESULT.json`)

| Số NV | Tính lại kỳ + phân bổ SL (main) | Gate chốt | Xác minh bản chốt | `CHI_TIET_TT` (46 cột) | Excel | Excel KB | HTML PDF | HTML KB |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 500 | 83 ms | 40 ms | 29 ms | 3 ms | 359 ms | 96 | 17 ms | 639 |
| 2.000 | 173 ms | 136 ms | 140 ms | 6 ms | 902 ms | 354 | 71 ms | 2.554 |
| 5.000 | 580 ms | 656 ms | 632 ms | 21 ms | 3.034 ms | 871 | 167 ms | 6.396 |

Chốt kỳ: main tính lại **2 lần** (gate chặn + xác minh bản chốt) — với 5.000 NV khoảng 1,3 s, chấp nhận được cho thao tác hiếm. Đã kiểm tra `verifySnapshot` cho kết quả rỗng (khớp) trên bản chốt hợp lệ.

## 3. Giao diện thật (Electron, `tests/perf/ui-bench.js`)

| Số NV | Mở lưới chấm công | Gõ 4 phím vào ô tìm | Heap JS | Dòng hiển thị |
| ---: | ---: | ---: | ---: | ---: |
| 1.000 | 549 ms | 175 ms | 20 MB | 100 (phân trang) |
| 5.000 | 943 ms | 124 ms | 32 MB | 100 |

**Chưa đo được:** thời gian tới khi kết quả lọc hiện ra (script chờ một phần tử gợi ý cũ không còn tồn tại nên hết hạn 120 s — số đó **không phải** hiệu năng thật). Đã sửa selector ô tìm kiếm; phần chờ kết quả lọc cần cập nhật ở lượt sau. Không đo "độ trễ tương tác" khác (bấm sang tab, mở modal) — ghi là việc còn lại.

## 4. Thiết kế tránh tính lại

- Đổi bộ lọc báo cáo **không** gọi lại Payroll Engine: `kqKy(nam, thang)` cache theo `dbRev`; bộ lọc chỉ chạy `reportFilter.apply` trên bảng đã tính.
- Nút "Tính lương" có cờ chống chạy chồng (`st.dangTinh`).
- Thanh 7 bước cache theo `(kỳ, dbRev, đã tính, đã chốt, số chứng từ)`.
- Lưới chấm công phân trang 100 dòng; không có virtual scrolling (chưa cần ở 5.000 NV: heap 32 MB).

## 5. Đánh giá tách `app.js` (4.800 dòng, một IIFE)

Kết luận: **chưa tách hàng loạt trong release này**, vì rủi ro hồi quy lớn hơn lợi ích khi E2E 219 kiểm tra đang bám vào hành vi hiện tại. Đã làm theo hướng "kéo logic thuần ra `core/` có test" thay vì tách file hình thức:

| Logic | Vị trí | Test |
| --- | --- | --- |
| Trạng thái 7 bước | `core/payroll-steps.js` | `v101-steps.test.js` |
| Kiểm tra/dựng hồ sơ nhân viên mới | `core/hr-create.js` | `v101-hr-create.test.js` |
| View-model báo cáo thanh toán/chi tiết/sổ chứng từ | `core/reporting/payroll-reports.js` | `v94-payroll-reports.test.js` |
| Sổ thanh toán (state machine, công nợ) | `core/payment-ledger.js` | `v94-*.test.js`, `v101-security.test.js` |
| Cổng chặn chốt/xuất, xác minh bản chốt | `main/payroll-gate.js` | `v92-write-policy.test.js` |

Ứng viên tách tiếp theo (theo thứ tự lợi ích/rủi ro): (1) `txn` + data access → `ui/data-access.js`; (2) bộ lọc báo cáo (`rf*`) đã nằm ở `ui/filter-popover.js` + `core/report-filter.js`; (3) wizard thêm nhân viên và form HR; (4) tab Thanh toán (`pay*`). Mỗi bước phải giữ E2E xanh và không đổi hành vi.

## 6. Sao lưu và mã hóa dữ liệu — hiện trạng (đánh giá, chưa triển khai mã hóa)

**Đã có** (kiểm chứng bằng test/E2E hiện có): sao lưu tự động theo lịch và khi đóng, bản sao trước nâng cấp/sau chốt kỳ/trước mở chốt giữ vĩnh viễn, file `.sha256` cho từng bản sao, kiểm tra trước khi khôi phục (`status: ok|mismatch|invalid`), thư mục sao lưu thứ hai, Full Backup gồm kho chứng từ và thư viện OCR (`main/fullbackup.js`, `vault-bench`).

**Chưa có:** mã hóa dữ liệu lương lưu trên đĩa (`data.json` là JSON thường). Mật khẩu người dùng đã băm PBKDF2 (210.000 vòng) nhưng dữ liệu nghiệp vụ (lương, CCCD, STK) ở dạng rõ.

**Đề xuất thiết kế (chưa làm, cần nghiệm thu riêng):** mã hóa AES-256-GCM với khóa dữ liệu ngẫu nhiên (DEK) được bọc bằng (a) `safeStorage` của Electron (DPAPI trên Windows) và (b) khóa dẫn xuất từ mã khôi phục Admin để mở được khi đổi máy; di chuyển bằng sao lưu trước + ghi file mới + xác minh đọc lại + giữ bản cũ đến khi người dùng xác nhận; không ghi khóa/mật khẩu vào log; không dùng khóa cố định trong mã nguồn. **Rủi ro chính:** mất khóa = mất dữ liệu, nên phải kèm quy trình khôi phục đã kiểm thử. Lý do hoãn: đổi định dạng lưu trữ là thay đổi P0 chạm mọi đường đọc/ghi (`storage.js`, sao lưu, kiểm tra SHA, khôi phục) và không thể kiểm chứng DPAPI trên Windows ngay tại môi trường CI Linux.

**LAN đa máy:** không triển khai. Kiến trúc hiện tại là một tiến trình ghi một file; ghi đồng thời từ nhiều máy cần cơ chế giao dịch và khóa riêng — là hạng mục thiết kế/nghiệm thu riêng.
