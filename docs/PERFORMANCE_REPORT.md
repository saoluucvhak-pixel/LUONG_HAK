# PERFORMANCE_REPORT — LUONG_HAK 2.0 (PR2 hiệu năng, 2.0.0-alpha.5)

- **Máy đo:** container Linux 4 vCPU, Node 22.22. Bản app thật chạy Electron 43 / Node 24.21.
- **Dữ liệu:** `regressionDataset(N)` (tests/fixtures) gồm N nhân viên, mỗi người 1 hợp đồng, 1–2 phụ lục, 0–3 nhân thân; chấm công / sản lượng / thưởng / tạm ứng của 3 kỳ.
- **Cách đo:** `node tests/perf/bench.js`. Số ms là 1 lần chạy, dao động ±20%.
- **So với bản cũ:** `HR_IMPL=tests/regression/baseline_2.0.0-alpha.4/hr.js node tests/perf/bench.js`.
- **Windows thật:** chưa đo.

## 1. Nguyên nhân (PERF-01)

`hr.js`: `staffForPayroll` và `hienHanh` gọi `rowsOf(db, bảng, ma)`. Hàm này **quét toàn bảng** (hợp đồng, phụ lục, nhân thân, tài khoản, cá nhân…) cho **từng** nhân viên, nên độ phức tạp là O(N × số dòng) ≈ O(N²).

Ở 5.000 NV, dựng danh sách lương mất ~1,2 giây. Danh sách Nhân sự (gõ ô tìm kiếm là vẽ lại) mất ~0,55 giây. Báo cáo nhân sự mất ~2 giây.

## 2. Thay đổi

- **`buildIndex(db)`:** dựng chỉ mục `Map` theo Mã NV **1 lần cho mỗi lượt tính**, chỉ cho các bảng được dùng tới. Danh mục tham chiếu (phòng ban, chức vụ) cũng được đánh chỉ mục.
  - Giữ **đúng thứ tự dòng** của bảng gốc, nên `latestBy()` vẫn chọn cùng một dòng khi trùng ngày hiệu lực.
  - Dùng `Map` nên so khớp **đúng kiểu** như `===`: Mã NV kiểu số `123` ≠ `"123"`. Mã lạ như `__proto__` cũng an toàn.
- Nơi dùng chỉ mục:
  - `staffForPayroll`;
  - các báo cáo nhân sự trong `reports()`;
  - danh sách *Nhân sự* (`app.js`).
- `hienHanh(db, ma, asOf, ix)`: tham số `ix` không bắt buộc. Nếu không truyền, hàm chạy như cũ.
- **Không có bộ nhớ đệm giữa các lần gọi**: chỉ mục dựng mới mỗi lượt, nên không bao giờ dùng dữ liệu cũ. Không bỏ kiểm tra nào. Engine tính lương **không đổi**.

## 3. Kết quả (ms)

| Số NV | Dòng chấm công (3 kỳ) | Dữ liệu (MB) | Dựng DS lương: cũ → **mới** | DS Nhân sự: cũ → **mới** | Báo cáo NS: cũ → **mới** | Tính lương 1 kỳ (engine, không đổi) |
|---|---|---|---|---|---|---|
| 100 | 557 | 0,19 | 2 → **2** | 1 → **1** | 4 → **3** | 7–9 |
| 500 | 2.781 | 0,9 | 8 → **3** | 5 → **1** | 20 → **6** | 14–16 |
| 1.000 | 5.549 | 1,8 | 41 → **5** | 23 → **3** | 69 → **9** | 23–24 |
| 5.000 | 27.602 | 9,1 | 1.175 → **22** | 550 → **12** | 1.952 → **54** | 90–131 |

**Mục tiêu PR2:** dựng danh sách lương < 200 ms ở 5.000 NV. **Đạt (22 ms).** R-PERF-03 chạy trong `npm test` để giữ ngưỡng này.

Các thao tác khác ở 5.000 NV (chưa tối ưu trong PR này):

| Thao tác | ms | Ghi chú |
|---|---|---|
| Kiểm tra toàn vẹn | ~360 | Tuyến tính; chỉ chạy khi mở màn *Kiểm tra dữ liệu* |
| Nhập lại chấm công 1 kỳ (9.184 dòng, lập kế hoạch) | ~330 | Tuyến tính |
| **Lưu dữ liệu** (ghi nguyên tử + SHA-256 đọc lại) | ~250 | RISK-01: ghi lại cả file JSON 9 MB mỗi lần lưu → PR4 (SQLite) |
| Sao lưu | ~210 | |
| Đọc file khi mở app | ~77 | |

## 4. Bảo đảm kết quả không đổi

| Test | Kiểm tra |
|---|---|
| `tests/regression/perf-index.test.js` R-PERF-01 | `staffForPayroll` mới = bản alpha.4 (lưu nguyên ở `baseline_2.0.0-alpha.4/hr.js`) cho 4 kỳ, 80 NV + trường hợp biên (trùng ngày hiệu lực, Mã NV kiểu số, `__proto__`); **bảng lương giống hệt** |
| R-PERF-02 | `hienHanh` có / không chỉ mục = bản alpha.4 cho mọi NV ở 3 ngày; 5 báo cáo nhân sự giống hệt |
| R-PERF-03 | 5.000 NV < 200 ms |
| Kiểm tra lại chính test (mutation) | Cố ý đổi chỉ mục sang khóa chuỗi → R-PERF-01 và R-PERF-02 **thất bại**, tức là test bắt được sai khác |
| Hồi quy v1.3.0 + toàn bộ test | 104/104; E2E 42/42 |

## 5. Rollback

Chỉ đổi `hr.js` (thêm chỉ mục) và 1 dòng `app.js`. Không đổi dữ liệu, không đổi engine. Quay lại alpha.4 bằng cách cài lại bản cũ.

## 6. Việc tiếp theo

- **PR4 (SQLite):** ghi theo dòng thay vì ghi lại cả file (lưu ~250 ms → mục tiêu < 50 ms).
- **Cần chủ sở hữu duyệt ngưỡng:** thời gian lưu chấp nhận được và cỡ dữ liệu thực tế (số NV, số năm lưu).
