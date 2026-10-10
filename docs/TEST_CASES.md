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

## Unit — giao diện (`tests/unit/icons.test.js`)
| ID | Nội dung |
|---|---|
| U-UI-01 | Emoji đầu nhãn → tên icon + phần chữ (kể cả emoji có biến thể ❤️) |
| U-UI-02 | Nhãn không có emoji / emoji chưa có icon → giữ nguyên |
| U-UI-03 | Mọi emoji dùng trong `app.js`/`hr.js` đều có icon tương ứng |

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

## Unit — 2.0 nhập chấm công (`tests/unit/importer-chamcong.test.js`)
| ID | Nội dung | Trên 1.4.0 |
|---|---|---|
| U-CC-01 | Nhập lại cùng file 3 lần → không thêm dòng, công không đổi | đạt |
| U-CC-02 | 2 dòng cùng NV + cùng hình thức trong 1 file (nửa tháng) → gộp, đủ 30 công | **thất bại** (15 công) |
| U-CC-03 | (Q-12) Trùng ngày cùng số công (1/1, "1qc"/"1QC") → tính 1 lần; khác số công (1/0,5) → xung đột cả 2 dòng | **thất bại** |
| U-CC-04 | Nhiều hình thức công (BT/TC/CC/CL) → không ghi đè nhau | đạt |
| U-CC-05 | Nhập bổ sung ngày 16–30 → giữ ngày 1–15 | **thất bại** (mất 15 công) |
| U-CC-06 | Nhập điều chỉnh 1 ô → cập nhật đúng ô, báo trước/sau | **thất bại** (không có diff) |
| U-CC-07 | Chế độ ghi đè cả dòng → xóa đúng 6 ô, có cảnh báo | **thất bại** |
| U-CC-08 | Kỳ đã chốt (ghi dạng 9/2026, 2026-9) → bị chặn | đạt |
| U-CC-09 | "bt" / để trống = BT → không cộng đôi | **thất bại** (60 công) |
| U-CC-10 | Dữ liệu có sẵn 2 dòng cùng khóa → chặn nhập (không thành 45 công); gộp → nhập được | **thất bại** |
| U-CC-11 | Công cụ gộp: ngày nhập trùng → tính 1 lần (21 → 20 công); nhóm khác số công / kỳ đã chốt giữ nguyên | đạt (mới) |
| U-CC-12 | Bảng khác: cùng khóa khác dữ liệu → xung đột; ô trống không xóa CCCD | **thất bại** |

## Unit — 2.0 kỳ chốt & cấu trúc (`tests/unit/guard-schema.test.js`)
| ID | Nội dung |
|---|---|
| U-GRD-01 | Dữ liệu phát sinh kỳ chốt → locked; chuyển dòng vào kỳ chốt → locked |
| U-GRD-02 | Phụ lục hồi tố: đúng các kỳ đã chốt còn hiệu lực (tới trước phụ lục kế tiếp); dời ngày hiệu lực vào kỳ chốt → retro; NV không có trong bảng chốt → none |
| U-GRD-03 | Danh mục có hiệu lực, nhân viên trong bảng chốt → retro; bảng không ảnh hưởng lương → none |
| U-GRD-04 | Tham chiếu Mã NV (chặn đổi mã); nhật ký trước/sau; người chốt |
| U-GRD-05 | (Q-15) Phụ lục đã dùng cho kỳ chốt → khóa; phụ lục chưa dùng → sửa được; mở chốt 1 kỳ → chỉ còn khóa bởi kỳ khác |
| U-CLS-03 | Checksum phát hiện sửa kết quả **và** dữ liệu đầu vào đã chốt; mở chốt ghi người + lý do + thời điểm |
| U-SCH-01 | Fatal: gốc không phải object, bảng không phải danh sách, schemaVersion mới hơn / sai kiểu |
| U-SCH-02 | Lỗi dữ liệu (10 loại) được báo đủ, **không sửa** dữ liệu; bảng lạ giữ nguyên |

## Unit — 2.0 sao lưu & lỗi đĩa (`tests/unit/storage-failures.test.js`)
| ID | Nội dung |
|---|---|
| U-STO-08 | 5 bản sao lưu cùng thời điểm → 5 tên khác nhau, đủ nội dung; mã ngẫu nhiên trùng → không đè (thử lại) |
| U-STO-09 | SHA-256: bản bị sửa (vẫn là JSON) → không cho khôi phục; bản cắt cụt → invalid; bản cũ chưa có mã → unverified |
| U-STO-10 | Ổ đĩa ghi hỏng mọi bản sau → bản tốt duy nhất (ngoài 10 bản giữ) vẫn được giữ |
| U-STO-11 | Đầy ổ (ENOSPC) khi lưu → thông báo rõ, file cũ nguyên, không sót file tạm |
| U-STO-12 | EACCES / EPERM / EROFS → thông báo đúng loại, file cũ nguyên |
| U-STO-13 | Mất điện giữa ghi và đổi tên → file cũ nguyên; file tạm sót được dọn khi mở |
| U-STO-14 | Đọc lại sau ghi không khớp → không báo thành công |
| U-STO-15 | Cất file hỏng 3 lần cùng thời điểm → 3 tên, không mất file hỏng nào |
| U-STO-16 | Sao lưu thất bại giữa chừng → không để lại bản dở dang |

## Unit — 2.0-α6 repository (`tests/unit/repository.test.js`)
| ID | Nội dung |
|---|---|
| U-REPO-01 | Bảng con hợp đồng = `hr.js HD_TABS`; quyền theo bảng |
| U-REPO-02 | (A3-01) Đổi Số HĐLĐ hồi tố: không phải Admin → chặn, dữ liệu giữ nguyên từng byte; Admin → `plan` không sửa gì (Hủy = không đổi), `apply` đổi cả bảng con + nhật ký HỒI TỐ |
| U-REPO-03 | Q-15: sửa / xóa phụ lục, đổi số / xóa hợp đồng đã dùng kỳ chốt → khóa kể cả Admin |
| U-REPO-04 | Kỳ đã chốt: thêm / sửa / xóa / chuyển dòng vào kỳ chốt → locked |
| U-REPO-05 | Quyền theo vai trò; ô ngày sai bị từ chối; ô CŨ sai không chặn sửa ô khác |
| U-REPO-06 | Trùng khóa; dòng không còn trong dữ liệu; kỳ bị chốt giữa `plan` và `apply` → không ghi |
| U-REPO-07 | Xóa hợp đồng chưa dùng → xóa kèm bảng con của chính hợp đồng đó; nhật ký trước/sau |
| U-REPO-08 | `app.js` không ghi thẳng vào bảng nghiệp vụ ngoài danh sách ngoại lệ |

## Unit — 2.0-α4 ô ngày chấm công (`tests/unit/daycell.test.js`)
| ID | Nội dung |
|---|---|
| U-CC-13 | `dayCell`: hợp lệ 1 / 0.5 / 1,5 / 1QC / QC; lỗi số âm (chuỗi và số), `1.5.2`, `#`, `1.`, `+1`, `1/2`; > 3 công → cảnh báo |
| U-CC-14 | Ngày không có trong tháng: 31/09, 29/02/2026 lỗi; 29/02/2028 (nhuận), 31/10 hợp lệ |
| U-CC-15 | Nhập Excel: ô âm / chữ lạ / 31/09 / 1.5.2 → *Lỗi dữ liệu*, không ghi; 7 công + nhãn lạ → ghi kèm cảnh báo |
| U-CC-16 | Dữ liệu cũ có ô sai → *Kiểm tra dữ liệu* báo High, không sửa dữ liệu; engine vẫn cộng 31/09 (Q-21) |
| U-CC-17 | Cùng ngày khác hình thức (BT + TC) → 2 dòng riêng; cùng hình thức khác số → xung đột (Q-12); chưa có "ca" (Q-18) |

## Integration — 2.0-α4 kịch bản tính lương (`tests/integration/payroll-scenarios.test.js`)
| ID | Nội dung (số tính tay — `AUDIT_V2.md` §5) |
|---|---|
| I-15 | Đủ tháng: BH 630.000, thuế 193.500, thực lĩnh 19.177.000 |
| I-16 | Vào làm 15/09: lương theo 14/26 công, thuế 0, BH vẫn trừ đủ [Q-23] |
| I-17 | Nghỉ việc 20/09: 17 công; tháng 10 không có lương |
| I-18 | Nhiều tạm ứng + thưởng + thu nhập khác + trừ khác cộng dồn; tạm ứng kỳ sau không trừ |
| I-19 | Khoản trừ vượt thu nhập → thực lĩnh 0 + cảnh báo số còn thiếu |
| I-20 | Phụ lục giữa tháng → cả tháng theo mức mới [Q-22] |

## Unit — 2.0-α3 hướng dẫn & quy chế (`tests/unit/guide.test.js`)
| ID | Nội dung |
|---|---|
| U-GUIDE-01 | Mô tả công chuẩn trong quy chế khớp đúng số `engine.congChuan` cho mọi mã lương chuẩn |
| U-GUIDE-02 | Quy chế lấy số liệu từ danh mục **có hiệu lực của kỳ** (biểu thuế 12/2025 ≠ 2026; phụ cấp mới từ 10/2026 chỉ hiện ở kỳ 10) |
| U-GUIDE-03 | Mọi [Q-xx] trong quy chế có trong BUSINESS_RULES; dữ liệu người dùng được escape (không chèn HTML/script); đủ 5 phần; file Word hợp lệ |

## Unit — 2.0-α2 phân quyền (`tests/unit/permissions.test.js`)
| ID | Nội dung |
|---|---|
| U-PERM-01 | Admin có mọi quyền; chỉ Admin có `retro.edit` / `backup.restore` / `system.admin` / `payroll.reopen` |
| U-PERM-02 | Ma trận vai trò: Nhân sự không xem lương; Kế toán lương chốt được; Trưởng bộ phận nhập công nhưng không xem lương… |
| U-PERM-03 | Chưa đăng nhập / tài khoản khóa / vai trò lạ → không quyền; `need()` báo lỗi rõ |
| U-PERM-04 | Quy tắc mật khẩu; tên đăng nhập không phân biệt hoa/thường |
| U-PERM-05 | Sai 5 lần → khóa 30 giây; hết hạn thì mở |
| U-PERM-06 | Không khóa / hạ quyền Admin hoạt động cuối cùng |
| U-PERM-07 | Mọi quyền dùng trong `app.js` có trong danh mục; các hàm nghiệp vụ chính đều gọi `need()` |
| U-PERM-08 | PBKDF2 ở tiến trình chính = WebCrypto (cùng kết quả), ≥ 210.000 vòng |

## Integration — 2.0 (`tests/integration/flows-v2.test.js`)
| ID | Luồng |
|---|---|
| I-09 | Chấm công 2 lần nhập (nửa đầu + bổ sung) + file tách dòng → lương đúng 30 công, nhập lại không đổi |
| I-10 | Hồi tố sau khi chốt: snapshot bất biến + toàn vẹn; mở chốt (người, lý do) → chốt lại v2 → chênh lệch đúng 26 × 50.000 |
| I-11 | Mọi đường nhập vào kỳ chốt bị chặn (chấm công, sản lượng, thưởng "500.000" ngày 30/09/2026, tạm ứng, chuyển kỳ) |
| I-12 | Lưu thất bại khi chốt (đầy ổ) → hoàn tác, kỳ chưa chốt, file trên đĩa không đổi |
| I-13 | Sao lưu → khôi phục: bản tốt qua kiểm tra cấu trúc, checksum kỳ chốt ok; bản bị sửa bị từ chối |
| I-14 | Dữ liệu 1.4.0 có chấm công trùng + "bt" + "2026-9" → chuẩn hóa + gộp → lương không đổi, cấu trúc sạch |

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

## Regression — 2.0-α5 chỉ mục Mã NV (`tests/regression/perf-index.test.js`, so với `baseline_2.0.0-alpha.4/hr.js`)
| ID | Nội dung |
|---|---|
| R-PERF-01 | `staffForPayroll` = bản alpha.4, 4 kỳ, 80 NV + biên (trùng ngày hiệu lực, Mã NV kiểu số, `__proto__`); bảng lương giống hệt |
| R-PERF-02 | `hienHanh` có/không chỉ mục = alpha.4 (mọi NV × 3 ngày); 5 báo cáo nhân sự giống hệt |
| R-PERF-03 | Dựng DS lương 5.000 NV < 200 ms |

## E2E (`tests/e2e/run-e2e.js`) — Electron thật, thư mục dữ liệu tạm
E-01 mở app · (2.0-α6) A3-01 đổi Số HĐLĐ hồi tố rồi Hủy → phụ lục không mồ côi · (2.0-α4) ô chấm công `-1` bị từ chối, cột 31/09 khóa, dán Ctrl+V không ghi ô sai · (2.0-α2) tạo Admin + mã khôi phục · sai mật khẩu 5 lần → khóa · mật khẩu tạm bắt buộc đổi · menu theo vai trò · Kế toán lương không mở chốt · Q-14 chặn sửa hồi tố (Admin được) · mật khẩu đã băm + muối · nhật ký theo tài khoản · quên mật khẩu Admin bằng mã khôi phục · E-02 preload · (2.0) SHA-256 mọi bản sao lưu · người thực hiện trong nhật ký/bản chốt/mở chốt · cấu trúc nguy hiểm ×2 (bảng sai kiểu, schemaVersion 3) → khôi phục, file nguyên từng byte · E-02b font Be Vietnam Pro nạp được dưới CSP + menu dùng icon SVG · E-03 tính lương (12tr − BH 630k = 11,37tr) · E-04 chốt bằng hộp nhập của app · E-05 mở chốt bắt buộc lý do · E-06 chốt lại · E-07 xuất Excel 4 sheet, số khớp · E-08 không lỗi JS · E-09 data.json có chốt v2 + lịch sử v1 · E-10 tiền lưu đúng · E-11 có sao lưu tự động · E-12 mở lại app dữ liệu còn, checksum nguyên vẹn · E-13 file hỏng → màn hình khôi phục · E-14 file hỏng không bị ghi đè · E-15 khôi phục từ sao lưu · E-16 file hỏng được giữ lại · E-17 nâng cấp 1.3→1.4 tạo `truoc-nang-cap` chứa nguyên trạng · E-18 chuẩn hóa tiền/ngày/CCCD + schemaVersion 2 · E-19 kỳ chốt kiểu cũ giữ nguyên · E-20 không tạo lại bản trước nâng cấp · E-21 kỳ chốt cũ hiển thị "Bản cũ" · E-22 không lỗi JS với dữ liệu cũ.

## Hiệu năng (`tests/perf/bench.js`) — baseline, chưa đặt ngưỡng
100 / 500 / 1.000 / 5.000 NV × 3 kỳ: dung lượng, ghi/đọc JSON, dựng danh sách lương, tính lương 1 kỳ, kiểm tra toàn vẹn, lập kế hoạch nhập lại chấm công, bộ nhớ.
