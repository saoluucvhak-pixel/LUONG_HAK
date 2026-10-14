# V10.1 — Mẫu báo cáo

Mẫu trong `docs/v10_1_samples/` sinh từ **dữ liệu giả lập** (`regressionDataset(24)`, công ty "CÔNG TY MẪU") — không chứa dữ liệu thật. Sinh lại bằng đoạn mã trong lịch sử commit hoặc từ app (kỳ đã chốt).

| Tệp | Nội dung |
| --- | --- |
| `ChiTietThanhToan_MAU.xlsx` | Bảng chi tiết thanh toán tiền lương: 23 NV × 46 cột; nhóm NHÂN VIÊN / CÔNG & SẢN LƯỢNG / THU NHẬP / KHẤU TRỪ / THANH TOÁN (tiêu đề 2 tầng), A3 ngang, ≥2 trang ngang, lặp cột Mã NV–Họ tên, đóng băng đến Họ tên, AutoFilter, dòng tổng, chữ ký, số trang. Có 2 chứng từ mẫu (1 trả đủ, 1 trả một nửa) |
| `SoChungTu_MAU.xlsx` | Sổ chứng từ thanh toán (15 cột): số chứng từ, hình thức, NV, số tiền, trạng thái, người lập/duyệt/ghi nhận, lý do hủy |
| `ThanhToan_MAU.xlsx` | Bảng thanh toán lương (11 cột) — **23 lỗi** vì dữ liệu giả lập chưa khai hình thức/số tài khoản: đây là hành vi đúng (báo cáo chính thức bị chặn khi còn lỗi); mẫu chỉ để xem bố cục |
| `man-hinh-chi-tiet-thanh-toan-1366x768.png`, `…-1920x1080.png` | Màn hình Chi tiết thanh toán (kỳ chưa chốt, dữ liệu mẫu) |

## Tiêu chuẩn đã kiểm bằng test
Tên công ty, tên báo cáo IN HOA, kỳ, phạm vi, đơn vị, ngày lập, nhóm cột, tổng cộng, chữ ký, số trang (`report-xlsx` + `U-V101-XLS-*`); Mã NV/CCCD/MST/STK dạng text; ngày thật `dd/mm/yyyy`; số thập phân 2 chữ số khi cột có phần lẻ; chống công thức; bảng >20 cột không ép 1 trang; PDF bảng >16 cột tách phần cột lặp Mã NV–Họ tên.

## Sáu mẫu báo cáo riêng (V10.1, bổ sung sau Phase 6)
Module `core/reporting/ops-reports.js` dựng view-model thuần cho màn hình, Excel (`ui/report-xlsx.js` → `buildMany`, mỗi bảng một sheet) và PDF (`report-html.js`). Màn hình: nhóm **Báo cáo theo loại** ở menu bên trái (mỗi màn có lọc phòng ban + tìm kiếm; Excel/PDF xuất đúng theo bộ lọc).

| Tệp mẫu | Báo cáo | Đặc thù |
| --- | --- | --- |
| `DanhSachNhanSu_MAU.xlsx` | DANH SÁCH NHÂN SỰ | Nhóm cột NHÂN VIÊN / CÔNG VIỆC / HỢP ĐỒNG LAO ĐỘNG / TÌNH TRẠNG; lọc đang làm / đã nghỉ / tất cả; cảnh báo HĐ quá hạn, chưa gán phòng ban; sheet đếm theo phòng ban; tổng "TỔNG CỘNG: n người" |
| `BangKeSanLuong_MAU.xlsx` | BẢNG KÊ PHIẾU CÂN SẢN LƯỢNG | Từng phiếu: giao trực tiếp / chia theo tổ / chưa gán; người nhận + mỗi người từ kết quả chia tổ của app; KL 3 số lẻ; 3 sheet (chi tiết, theo tổ, theo công nhân); cảnh báo phiếu chưa gán, trùng số phiếu |
| `BangKeBomDam_MAU.xlsx` | BẢNG KÊ BƠM DĂM | Cùng cấu trúc nhưng đơn vị là **Số xe**, không lẫn với tấn |
| `BangKeThuong_MAU.xlsx` | BẢNG KÊ THƯỞNG VÀ CÁC KHOẢN THU NHẬP, KHẤU TRỪ KHÁC | Thực nhận = Thưởng + Thu nhập khác − Trừ khác; sheet tổng hợp theo nhân viên; số âm / chữ trong ô tiền / Mã NV lạ chặn xuất; lệch bảng lương cảnh báo |
| `BangKeTamUng_MAU.xlsx` | BẢNG KÊ TẠM ỨNG LƯƠNG | Cột **Ký nhận**, 4 chữ ký (có Thủ quỹ); sheet tổng hợp theo NV kèm thu nhập/thực lĩnh bảng lương; cảnh báo tạm ứng vượt thu nhập / lệch bảng lương |
| `TongHopSuatCom_MAU.xlsx` | BẢNG TỔNG HỢP SUẤT CƠM | Ma trận nhân viên × ngày đúng số ngày của tháng (28–31), tổng suất theo người và theo ngày, ngưỡng cảnh báo suất/ngày tham khảo (3), in A3 ngang, lặp STT–Mã NV–Họ tên ở mọi trang |

Cách đọc số khớp engine: tiền đọc bằng `engine.money` ("500.000" = 500000), khối lượng/suất bằng `engine.num`; chữ trong ô số bị báo lỗi, không âm thầm coi là 0. Lọc kỳ theo đúng quy tắc `YYYY-MM-DD` của engine.
Báo cáo nhân sự có sẵn (hết hạn HĐ, biến động, tình hình, nghỉ phép, vi phạm, sinh nhật, sổ lao động, lịch sử) cũng xuất Excel/PDF theo mẫu chung (tiêu đề công ty / TÊN IN HOA / chữ ký / A4 ngang) thay vì bảng trần.

Mẫu trên sinh từ dữ liệu giả lập (công ty "CÔNG TY MẪU"); đã mở lại bằng LibreOffice để xem bố cục (tạm ứng 2 trang, suất cơm A3 3 trang), **chưa** mở bằng Microsoft Excel / in thử trên máy in thật.

## Chưa làm / chưa kiểm
- Mẫu in riêng cho **sáu loại** nhân sự / sản lượng / bơm dăm / thưởng–trừ / tạm ứng / suất cơm đã có (xem mục dưới). Các báo cáo lương khác (bảo hiểm, hạch toán, so sánh kỳ, 12 tháng, thuế năm) vẫn dùng bộ xuất chung `exportSheetsPdf`/`saveXlsx`.
- Mẫu nhân sự **không** có CCCD, mã số thuế, số tài khoản, lương — chủ ý, vì danh sách này hay được in và chuyển tay.
- Báo cáo thưởng / tạm ứng đối chiếu với bảng lương kỳ đó chỉ khi không đang lọc; sai lệch hiện thành cảnh báo, không tự sửa.
- Chưa mở tệp mẫu bằng Microsoft Excel/in thử trên máy in thật (cần `WINDOWS_UAT`). Kiểm tra mới dừng ở đọc lại bằng ExcelJS.
- PDF chưa chụp mẫu trong tài liệu này; có E2E PDF sẵn từ V9.4.
- Màn hình: cột đầu chưa "dính" khi cuộn ngang 46 cột (Excel có đóng băng).
- Phiếu lương `ui/slip-xlsx.js` (V10): mỗi NV một phiếu A4; kiểm tra phạm vi quyền xem: xem mục giới hạn trong `V10_1_SECURITY_REVIEW.md`.
