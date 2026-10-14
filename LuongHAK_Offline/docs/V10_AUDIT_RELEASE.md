# V10 — Tái thiết kế giao diện nghiệp vụ: bảng nghiệm thu

Nhánh: `feature/luong-hak-v10-business-ux-redesign` (từ V9.4). Không đụng `main`. PR ở trạng thái DRAFT, không tự merge.
Kiểm thử: unit 534/534, ESLint sạch, E2E giao diện thật 212/212, kiểm tra 87 màn hình × 3 độ phân giải (1366×768, 1600×900, 1920×1080): 0 tràn trang, 0 lỗi JS (`docs/V10_SCREEN_CHECK.json`).

| Hạng mục V10 | Trạng thái | Ghi chú |
|---|---|---|
| Menu nhóm nghiệp vụ mới | DONE | E2E + screen check |
| Công thức chuyển sang Cài đặt | DONE | Giữ Formula Engine/AST, duyệt, phiên bản |
| Trình thiết lập công thức (4 bước, giải thích bằng số) | DONE | Lưu Nháp qua REPO; E2E |
| Chỉ 2 phương pháp bù sản lượng + "Xem cách tính", bỏ dm_quychebu khỏi Danh mục | DONE | Mã cũ bị gắn cờ, chặn chốt kỳ đến khi chọn phương pháp mới |
| Master–Detail modal: DM_TNCN→biểu thuế, HĐLĐ→tài liệu | DONE | |
| Master–Detail modal: NV→người phụ thuộc | DONE | E2E |
| Master–Detail modal: hình thức lương, chứng từ thanh toán→dòng | NOT_APPLICABLE | Dữ liệu hiện phẳng (dm_luong, sổ thanh toán ttluong không có bảng cha–con); cần thiết kế lại mô hình dữ liệu trước |
| Danh mục CRUD mặc định chỉ xem, nút Thêm/Chi tiết/Sửa/Lưu/Hủy/Xóa-Ngừng/Lịch sử thống nhất | DONE | Một lưới chung cho mọi danh mục; E2E |
| Màn hình Kiểm tra bảng lương (ERROR/WARNING/INFO) | DONE | |
| Luồng Tính lương 7 bước | DONE | Thanh 7 bước trên màn Tính lương (bước xong/đang ở, bấm sang màn tương ứng); chưa có bước Duyệt riêng |
| Kỳ lương điều khiển từ ngày–đến ngày, bộ lọc thống nhất các màn nhập liệu | DONE | Tổng cộng + xem/Excel/PDF/in |
| Nghiệp vụ nhân sự độc lập (gửi/duyệt/từ chối/lịch sử) + báo cáo | DONE | Quyền mới `hr.approve` |
| Báo cáo lương: chi tiết NV, chi tiết thanh toán | DONE | Có lọc, Excel/PDF/in, tổng đối soát |
| Mẫu Excel chuyên nghiệp: báo cáo lương (V9.4/V10) + xuất từ lưới Danh mục/nhập liệu | DONE | Tiêu đề công ty, tên IN HOA, ngày lập, dòng tổng, chữ ký, A4, lặp tiêu đề; E2E |
| Phiếu lương Excel bố cục in riêng | DONE | Mỗi NV một phiếu (A4 dọc, chữ ký, 1 hoặc 2 phiếu/trang) + sheet dữ liệu thô để đối chiếu; unit + E2E |
| Các xuất Excel phụ còn lại (ngoài lưới/báo cáo lương/phiếu lương) | PARTIAL | Vẫn bảng dữ liệu trơn |
| Icon SVG thống nhất | DONE | Test U-UI-03 |
| Ngày dd/MM/yyyy, nhập tay ổn định; số 15.000.000, căn phải | DONE | |
| Bản dựng Windows (NSIS) | WINDOWS_UAT_PENDING | Chỉ build được qua GitHub Actions; chưa chạy thử trên Windows thật |
| Đối chiếu workbook Excel | BLOCKED_SOURCE_DATA | Chưa có dữ liệu nguồn |

Còn tồn từ trước: mã hóa đĩa, giao diện tiến trình/hủy backup–migration.
