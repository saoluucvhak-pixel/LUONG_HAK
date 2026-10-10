# TEST_CASES — Bộ kiểm thử

Chạy: `cd LuongHAK_Offline && npm test` (unit + integration + regression, Node ≥ 22, không cần cài thêm gói).
E2E: `ELECTRON_PATH=<electron> PLAYWRIGHT_MODULE=playwright xvfb-run -a npm run test:e2e`. Hiệu năng: `node tests/perf/bench.js`.

## Unit — công thức (`tests/unit/engine.test.js`, kỳ vọng tính tay theo `PAYROLL_FORMULAS.md`)
| ID | Nội dung |
|---|---|
| U-ENG-01 | Công chuẩn theo Cách tính (TG1 26, TG2 30, TG3 22, TG4 24, CN1 = thực tế, CĐ 26) — tháng 9/2026 |
| U-ENG-02 | Lương thời gian TG1 đủ công / nửa công |
| U-ENG-03 | CN1: đơn giá × công; tăng ca CN1 = đơn giá × công TC; tổng công gồm TC |
| U-ENG-04 | Lương sản phẩm + bù theo tháng dưới ngưỡng |
| U-ENG-05 | Phụ cấp TN.02 theo tỷ lệ công (dưới/đủ ngưỡng) |
| U-ENG-06 | Phụ cấp công tác theo nhãn chấm công 1QC |
| U-ENG-07 | BH NLĐ 10,5%; truy thu khi dưới ngưỡng công |
| U-ENG-08 | Thuế lũy tiến 5 bậc 2026 (TN tính thuế 40tr → 4,5tr) |
| U-ENG-09 | Biểu thuế & giảm trừ đổi theo hiệu lực (12/2025 vs 01/2026) |
| U-ENG-10 | Người phụ thuộc giảm trừ 6,2tr |
| U-ENG-11 | Khấu trừ vãng lai 10% |
| U-ENG-12 | Làm tròn 1.000đ; khoản trừ vượt thu nhập → 0 + cảnh báo |
| U-ENG-13 | BUG-002: tiền "500.000" / "9.000.000"; tỷ lệ "0.175" không bị ảnh hưởng |
| U-ENG-14 | Cảnh báo thiếu mức giảm trừ khi tính lũy tiến |

## Unit — lõi (`tests/unit/core.test.js`)
| ID | Nội dung |
|---|---|
| U-VAL-01 | parseMoney: VN, quốc tế, số thuần, có "đ", số âm, chuỗi lỗi |
| U-VAL-02 | normDate (dd/mm/yyyy, Date, serial Excel, ngày không tồn tại), normKy, normId (CCCD/SĐT), rowPeriod |
| U-IMP-01 | Nhập chấm công 2 lần → trùng; thay đổi giá trị → cập nhật; không nhân đôi dòng |
| U-IMP-02 | Phân loại: trùng trong file, sai tham chiếu, thiếu cột, sai ngày, kỳ đã chốt |
| U-IMP-03 | Chuẩn hóa tiền VN, CCCD mất số 0; nhân viên trùng mã → cập nhật |
| U-IMP-04 | Bảng không có khóa (tạm ứng): chặn trùng y hệt |
| U-INT-01 | normalizeDataset: sửa tiền/kỳ/ngày/CCCD, idempotent, không đụng snapshot đã chốt |
| U-INT-02 | integrity.check: trùng Mã NV, chấm công trùng khóa, lương nghi lỗi, ngày sai |
| U-CLS-01 | Snapshot có dữ liệu vào + checksum; không chốt 2 lần; mở chốt cần lý do, giữ lịch sử, phiên bản tăng; phát hiện snapshot bị sửa |
| U-CLS-02 | Rollback chốt/mở chốt khi lưu thất bại |

## Unit — lưu trữ (`tests/unit/storage.test.js`)
| ID | Nội dung |
|---|---|
| U-STO-01 | Lưu/đọc; chưa có file |
| U-STO-02 | Từ chối ghi dữ liệu không hợp lệ |
| U-STO-03 | File hỏng → báo lỗi + danh sách sao lưu, không ghi đè; cất file hỏng |
| U-STO-04 | Sao lưu đầu ngày giữ trạng thái trước thay đổi, không bị ghi đè trong ngày |
| U-STO-05 | Dữ liệu giảm > 50% → sao lưu bản trước |
| U-STO-06 | Không sao lưu file hỏng; chặn đường dẫn lạ khi đọc bản sao lưu |
| U-STO-07 | Giới hạn số bản sao lưu theo loại |

## Integration (`tests/integration/flows.test.js`)
| ID | Luồng |
|---|---|
| I-01 | Import Excel chấm công → tính lương; nhập lại không làm tăng lương (thực lĩnh 19.177.000) |
| I-02 | Hợp đồng → phụ lục tăng lương 01/09 → T8 lương cũ, T9 lương mới |
| I-03 | Người phụ thuộc theo hiệu lực |
| I-04 | Nghỉ việc: HĐ chấm dứt → không tính lương; trạng thái mâu thuẫn → cảnh báo |
| I-05 | Sản lượng → lương sản phẩm; phiếu cân nhiều người → cảnh báo đối chiếu |
| I-06 | Chốt → sửa dữ liệu → số đã chốt không đổi → mở chốt → chốt lại v2 → so sánh trước/sau |
| I-07 | Sao lưu → khôi phục khớp bản gốc |
| I-08 | Migration v1.0 → hiện tại, lương giữ nguyên |

## Regression (`tests/regression/v130.test.js`) — so với engine v1.3.0 (`baseline_v1.3.0/`)
| ID | Nội dung | Phân loại khác biệt |
|---|---|---|
| R-01 | 80 NV × 3 kỳ, mọi loại lương/tăng ca/phụ cấp/BH/thuế: bảng lương, BHXH, TNCN, danh sách nhân sự **trùng 100%**; cảnh báo cũ không mất | — |
| R-02 | Thưởng "500.000": v1.3.0 = 500đ, v1.4.0 = 500.000đ; người khác không đổi | **Sửa lỗi có chủ đích (BUG-002)** |

## E2E (`tests/e2e/run-e2e.js`) — Electron thật, thư mục dữ liệu tạm
E-01 mở app · E-02 preload · E-03 tính lương (12tr − BH 630k = 11,37tr) · E-04 chốt bằng hộp nhập của app · E-05 mở chốt bắt buộc lý do · E-06 chốt lại · E-07 xuất Excel 4 sheet, số khớp · E-08 không lỗi JS · E-09 data.json có chốt v2 + lịch sử v1 · E-10 tiền lưu đúng · E-11 có sao lưu tự động · E-12 mở lại app dữ liệu còn, checksum nguyên vẹn · E-13 file hỏng → màn hình khôi phục · E-14 file hỏng không bị ghi đè · E-15 khôi phục từ sao lưu · E-16 file hỏng được giữ lại · E-17 nâng cấp 1.3→1.4 tạo `truoc-nang-cap` chứa nguyên trạng · E-18 chuẩn hóa tiền/ngày/CCCD + schemaVersion 2 · E-19 kỳ chốt kiểu cũ giữ nguyên · E-20 không tạo lại bản trước nâng cấp · E-21 kỳ chốt cũ hiển thị "Bản cũ" · E-22 không lỗi JS với dữ liệu cũ.

## Hiệu năng (`tests/perf/bench.js`) — baseline, chưa đặt ngưỡng
100 / 500 / 1.000 / 5.000 NV × 3 kỳ: dung lượng, ghi/đọc JSON, dựng danh sách lương, tính lương 1 kỳ, kiểm tra toàn vẹn, lập kế hoạch nhập lại chấm công, bộ nhớ.
