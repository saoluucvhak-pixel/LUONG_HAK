# V9.2 — Báo cáo nghiệm thu nội bộ (trung thực)

Nhánh: `feature/luong-hak-offline-v9-2-business-completion` (từ nhánh V9). Phiên bản: `2.0.0-alpha.24`. **Không phải bản ổn định; chưa chạy trên Windows thật; chưa thử với scan thật.**

## 1. Trạng thái từng hạng mục
| Hạng mục | Trạng thái | Bằng chứng | Còn thiếu / giới hạn |
| --- | --- | --- | --- |
| Thuế TNCN cha–con, tra theo mã/kỳ/phiên bản | **Xong (code + test)** | `v92-tax-congchuan`, `thue-tncn-ma` | Cột “Điều kiện áp dụng / Loại đối tượng” ở bậc thuế chỉ để mô tả, engine không đánh giá |
| `TAX_CONFIG_ERROR` chặn chốt/xuất | **Xong** (renderer + main) | `payroll-gate`, `v92-write-policy` | — |
| Người phụ thuộc (trường, trùng, chồng kỳ, đúng tháng) | **Xong** | `v92-dependents-taxcfg` | Chưa kiểm tra tính hợp lệ của MST bằng thuật toán |
| BH truy thu | Giữ nguyên công thức, không công tắc mới | test hiện có | — |
| Công chuẩn theo DM_LUONG | **Xong** | `U-CC-01..03` | Dữ liệu cũ không có cột → dùng đường cũ (legacy) |
| Đính kèm HĐLĐ (PDF/ảnh) | **Xong (code + unit/integration)** | `v92-hdld-docs`, `restore`/`data-digest` | Giao diện xem trước PDF/ảnh chưa được e2e kiểm tra bằng Electron thật; kiểm PDF chủ động là heuristic |
| Bộ lọc chấm công | **Xong (unit)** | `v92-list-filter` | Lọc theo **công ty** chưa có (xem CompanyID) |
| Bộ lọc sản lượng/bơm dăm + tổng + xuất | **Xong (unit)**; xuất PDF dùng đường PDF sẵn có | `v92-list-filter`, bench | Chưa có e2e cho thanh lọc mới |
| CompanyID | **Một phần**: migration có kiểm tra + nút Admin | `v92-company-id` | Chưa gắn CompanyID vào mọi bảng khi tạo dòng mới; chưa lọc theo công ty ở báo cáo; nhiều công ty → BLOCKED |
| Bảo mật main (ghi theo bảng, chặn chốt, chặn tải) | **Xong, có negative test** | `v92-write-policy` U-WP-01..09 | Mã khôi phục mật khẩu vẫn kiểm ở renderer (main chỉ ràng buộc một phần) |
| Mã hóa dữ liệu trên đĩa | **KHÔNG làm** | — | Dữ liệu `data.json` vẫn là văn bản thường. Cần: khóa từ `safeStorage`/mật khẩu + migration có hoàn tác; làm vội dễ mất dữ liệu nên để giai đoạn riêng |
| Khôi phục/chuyển thư mục có tiến độ + hủy | **Một phần**: staging + nhật ký + rollback (V8) và hủy trước COMMIT; **chưa có thanh tiến độ** cho chuyển thư mục | test V8 | Cần thêm tiến độ và nút hủy giữa chừng khi chép |
| Chặn chốt/xuất theo 8 loại lỗi | **Xong** ở main + renderer | `payroll-gate` | Mã tăng ca lạ nay là **blocker** (trước là cảnh báo) |
| Hiệu năng | Có số đo | mục 2 | Chỉ đo bằng Node, không đo trong Electron/Windows |
| Đối chiếu workbook nguồn | **`BLOCKED_SOURCE_DATA`** | `docs/V9_PAYROLL_RECONCILIATION.md` | Không có file Excel nguồn trong môi trường này; không dùng dữ liệu giả làm bằng chứng |
| Build Windows | **Một phần**: `electron-builder --win dir` tạo được `dist/win-unpacked/Tinh Luong HAK.exe` trên Linux | log build | Chưa tạo/ký bộ cài NSIS, **chưa chạy thử trên Windows thật** |

## 2. Hiệu năng (`node tests/perf/v92-bench.js`, 1 lần đo, ±20%)
| NV | Dòng NPT | Dựng DS lương gồm NPT | Tính lương 1 kỳ | Kiểm tra cấu hình thuế | Kiểm tra NPT |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 500 | 1.000 | 8,6 ms | 38 ms | 1 ms | 3,2 ms |
| 2.000 | 4.000 | 30,5 ms | 77 ms | 0,3 ms | 13 ms |
| 5.000 | 10.000 | 46,5 ms | 157 ms | 0,2 ms | 10,7 ms |

| Số dòng | Lọc phiếu cân | Tính lại tổng | Lọc chấm công |
| ---: | ---: | ---: | ---: |
| 10.000 | 14,9 ms | 2,8 ms | 8,2 ms |
| 30.000 | 38,9 ms | 7,3 ms | 12 ms |
| 100.000 | 119 ms | 21,8 ms | 60 ms |

Chú ý: biểu thuế trong fixture chỉ có vài bậc nên “kiểm tra cấu hình thuế” gần như bằng 0; số này không đại diện cho cấu hình thật nhiều phiên bản.

## 3. Lỗi tìm thấy khi chạy e2e và đã sửa trong V9.2
1. Tên file “Phan_bo_khoi_luong” bị coi là bảng lương (chứa “luong”) nên báo cáo phân bổ khối lượng bị hủy tải — đây chính là công cụ để sửa lỗi chặn chốt kỳ. Đã sửa nhận diện + test.
2. Khôi phục Full Backup bị main từ chối (thay toàn bộ dữ liệu vi phạm quy tắc bất biến/nhật ký chỉ thêm). Đã cho Admin thay dữ liệu **chỉ trong** cửa sổ main giữ khóa khôi phục + test phủ định.
3. E2E checklist dùng mã tăng ca lạ làm “cảnh báo”; theo V9.2 đó là blocker. Đổi sang nhãn công tác lạ.

## 4. Việc còn lại
Mã hóa dữ liệu trên đĩa; tiến độ chuyển thư mục; e2e cho thanh lọc và đính kèm HĐLĐ; lọc theo công ty; đối chiếu workbook thật; bộ cài NSIS + chạy thử trên Windows thật.

## 5. Kết quả kiểm tra cuối
`npm test`: 508 pass / 0 fail · ESLint `--max-warnings 0`: sạch · e2e (Electron + xvfb): 155/155 đạt.
