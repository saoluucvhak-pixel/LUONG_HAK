# V10.1 — Nghiệm thu trên Windows (UAT)

**Trạng thái: `WINDOWS_UAT_PENDING` — CHƯA THỰC HIỆN.** Phiên làm việc chạy trên Linux; không có máy Windows để cài và thao tác. Không có kết quả nào dưới đây được coi là đạt. Bản dựng Windows (NSIS) do GitHub Actions tạo (`build-exe.yml`, job "Build bộ cài Windows" + tự kiểm OCR trong bản đóng gói); tệp `.exe` ở mục Artifacts của run.

## Danh mục cần người dùng chạy trên máy Windows (không cần Internet)

| # | Kịch bản | Kết quả mong đợi | Đạt? |
| ---: | --- | --- | --- |
| 1 | Cài mới từ `TinhLuongHAK-Setup*.exe` | Cài xong, mở được, thiết lập Admin, nhận mã khôi phục | ☐ |
| 2 | Đăng nhập / đăng xuất / sai mật khẩu 5 lần | Khóa tạm 30 giây | ☐ |
| 3 | Nạp danh mục chuẩn, thêm nhân viên (nhập thiếu CCCD 12 số → bị chặn; nhập đúng → lưu) | Không hồ sơ dở dang; đóng–mở app vẫn còn đủ hồ sơ | ☐ |
| 4 | Nhập chấm công/sản lượng, Tính lương, xem thanh 7 bước | Bước tô đúng trạng thái; lỗi chặn hiện "!" | ☐ |
| 5 | Chốt kỳ; thử chốt khi còn lỗi chặn | Chốt được khi sạch; bị chặn khi còn lỗi | ☐ |
| 6 | Chi tiết thanh toán: bấm một dòng; Sổ chứng từ; lập/duyệt (người khác)/ghi nhận chi | Đúng trạng thái; người lập không tự duyệt | ☐ |
| 7 | Xuất Excel: Chi tiết thanh toán, Thanh toán, Kê chuyển khoản, Phiếu lương | Mở được bằng Excel; Mã NV/CCCD/STK còn số 0 đầu; ngày dd/mm/yyyy; in A3 ≥2 trang ngang, lặp cột | ☐ |
| 8 | Xuất PDF bảng rộng | Tách phần cột, chữ đọc được | ☐ |
| 9 | OCR một bảng chấm công thật | Nhận dạng chạy offline, sửa tay, lưu mẫu | ☐ |
| 10 | Sao lưu tay, tự động, khi đóng; Khôi phục từ bản sao | SHA-256 khớp; dữ liệu đúng | ☐ |
| 11 | Nâng cấp từ bản cũ (đã có dữ liệu) | Có bản sao trước nâng cấp; dữ liệu giữ nguyên | ☐ |
| 12 | Gỡ cài đặt, chọn giữ dữ liệu; cài lại | Dữ liệu còn | ☐ |

## Ghi lại khi chạy
Phiên bản/hash bộ cài · Windows version · ai chạy · ngày · mỗi dòng đạt/không đạt + ảnh chụp nếu lỗi. Chỉ khi cả 12 dòng đạt mới được đổi trạng thái sang `WINDOWS_UAT_PASS`.
