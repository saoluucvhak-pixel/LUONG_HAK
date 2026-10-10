# TEST_RESULTS — Kết quả kiểm thử Phase 1 (v1.4.0)

Môi trường: Linux, Node v22.22.0, Intel Xeon 2.10GHz 4 CPU · Chromium (Playwright 1.56.1) · Electron 43.7.9 (xvfb) · ngày 10/10/2026.

## 1. Tổng hợp

| Nhóm | Kết quả |
|---|---|
| Cú pháp (`node --check` mọi file JS) | ✅ đạt |
| Lint (`eslint . --max-warnings 0`) | ✅ 0 lỗi, 0 cảnh báo |
| Unit (engine 14 · core 10 · storage 7 · giao diện 3) | ✅ 34/34 |
| Integration | ✅ 8/8 |
| Regression so với v1.3.0 | ✅ 2/2 — trùng 100% trên 80 NV × 3 kỳ (>200 phiếu lương); 1 khác biệt có chủ đích (BUG-002) |
| **Tổng `npm test`** | ✅ **44/44** |
| E2E trên Electron 43.7.9 | ✅ **23/23** (gồm nâng cấp từ dữ liệu 1.3.0, font + icon giao diện) |
| Giao diện trong trình duyệt (Playwright, CSP bật) | ✅ không lỗi JS, không vi phạm CSP |
| `npm audit --omit=dev` (phần chạy trong app) | ✅ 0 lỗ hổng |
| `npm audit` (gồm công cụ build) | ⚠ 8 *moderate* — chỉ trong công cụ build (xem AUDIT_REPORT SEC-05) |
| Bộ cài Windows (.exe) trên máy Windows thật | ⏳ **chưa kiểm thử** — CI build trên `windows-latest`; cần chủ sở hữu cài thử |

## 2. Hồi quy — phân loại khác biệt so với v1.3.0
| Khác biệt | Phân loại | Bằng chứng |
|---|---|---|
| Số tiền chuỗi kiểu VN ("500.000", "9.000.000") được hiểu đúng | Sửa lỗi có chủ đích (BUG-002) | R-02 |
| Thêm cảnh báo mới (thực lĩnh âm, thiếu giảm trừ, lương đóng BH quá nhỏ, NV nghỉ việc chưa chấm dứt HĐ, chuyển khoản thiếu số TK) | Bổ sung kiểm soát — không đổi số tiền | R-01 kiểm tra cảnh báo cũ không mất |
| Sai lệch không mong muốn | **Không có** | R-01 |

## 3. E2E (Electron 43.7.9) — `tests/e2e/run-e2e.js`
```
PASS Mở ứng dụng — 439 ms
PASS Cầu nối lưu trữ (preload) hoạt động
PASS Giao diện: font Be Vietnam Pro đóng gói nạp được, menu dùng icon SVG — {"font":true,"icons":14,"emoji":0}
PASS Tính lương: 12.000.000 − BH 630.000 = 11.370.000
PASS Chốt kỳ lương (hộp nhập của app, không dùng window.prompt)
PASS Mở chốt không cho để trống lý do
PASS Chốt lại sau khi mở chốt
PASS Xuất Excel trọn bộ: đủ 4 sheet, số khớp bảng đã chốt — BangLuong,BHXH,ThueTNCN,ChuyenKhoan · thực lĩnh 11370000
PASS Không có lỗi JavaScript
PASS data.json có nhân viên + kỳ đã chốt v2 + lịch sử v1
PASS Lương thỏa thuận lưu đúng 12000000 (nhập "12.000.000")
PASS Có bản sao lưu tự động (đầu ngày + trước mở chốt)
PASS Mở lại app: kỳ đã chốt còn nguyên, checksum Nguyên vẹn
PASS File hỏng → hiện màn hình khôi phục
PASS File hỏng KHÔNG bị app ghi đè
PASS Khôi phục từ bản sao lưu tự động
PASS File hỏng được giữ lại (không xóa)
PASS Nâng cấp 1.3→1.4: có bản sao lưu trước nâng cấp chứa nguyên trạng
PASS Nâng cấp: tiền '500.000' → 500000, ngày → ISO, CCCD bù số 0, schemaVersion 2
PASS Nâng cấp: kỳ đã chốt kiểu cũ giữ nguyên
PASS Mở lần 2 không tạo thêm bản trước nâng cấp
PASS Kỳ chốt kiểu cũ hiển thị 'Bản cũ'
PASS Không lỗi JavaScript khi mở dữ liệu cũ
E2E: 23/23 đạt
```

Xác nhận lỗi gốc BUG-003 trên Electron 33.2.0 (bản dùng trong 1.3.0): `window.prompt()` → *"prompt() is and will not be supported."*

## 4. Giao diện (trình duyệt)
- Đơn giá CN1 nhập "300.000" → mở lại form, bấm Lưu → vẫn 300.000 (BUG-001 không còn); 26 công × 300.000 + thưởng gõ "500.000" = **8.300.000** ✓
- Nhập cùng file chấm công 2 lần: lần 1 *1 thêm mới, 1 sai tham chiếu*; lần 2 *1 trùng (bỏ qua)*; bảng vẫn 1 dòng ✓
- Chốt → mở chốt (lý do) → chốt lại: v2 hiện hành, v1 trong lịch sử, toàn vẹn "Nguyên vẹn" ✓
- Kiểm tra dữ liệu: không phát hiện vấn đề với dữ liệu sạch ✓

## 5. Hiệu năng — baseline (chưa đặt ngưỡng; ngưỡng cần thống nhất trước khi tối ưu)
| Số NV | Dòng chấm công (3 kỳ) | Dữ liệu | Ghi JSON | Đọc JSON | Dựng DS lương | Tính lương 1 kỳ | Kiểm tra toàn vẹn | Nhập lại CC 1 kỳ | Heap |
|---|---|---|---|---|---|---|---|---|---|
| 100 | 557 | 0,19 MB | 2 ms | 1 ms | 3 ms | 5 ms | 5 ms | 5 ms (179 dòng) | 7 MB |
| 500 | 2.781 | 0,90 MB | 8 ms | 7 ms | 13 ms | 15 ms | 14 ms | 18 ms (927) | 14 MB |
| 1.000 | 5.549 | 1,81 MB | 18 ms | 11 ms | 38 ms | 25 ms | 28 ms | 36 ms (1.856) | 29 MB |
| 5.000 | 27.602 | 9,11 MB | 89 ms | 46 ms | **1.303 ms** | 112 ms | 115 ms | 177 ms (9.184) | 67 MB |

Nhận xét: "Dựng DS lương" tăng theo bình phương (PERF-01) — xử lý ở Phase 2. Với 5.000 NV, dữ liệu ~9 MB / 3 kỳ (~36 MB/năm), mỗi lần lưu ghi lại toàn bộ file → lý do chính chuyển SQLite.

## 6. Cách tự kiểm tra lại
1. `cd LuongHAK_Offline && npm test` → `# pass 44`.
2. CI GitHub Actions trên PR: job *check*, *e2e*, *build* đều xanh; tải artifact `TinhLuongHAK-Setup` và cài thử trên Windows.
3. Trên Windows: mở app → *Công ty & Sao lưu* → *Kiểm tra dữ liệu* (xem cảnh báo dữ liệu cũ, đặc biệt "Lương … quá nhỏ" do BUG-001).
