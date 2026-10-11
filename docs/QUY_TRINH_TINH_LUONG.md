# QUY TRÌNH TÍNH LƯƠNG HẰNG THÁNG — LUONG_HAK

> Bản đầy đủ, luôn cập nhật, nằm **trong app**: menu **Hướng dẫn & Quy chế → Quy trình tính lương**.
> **Dự thảo Quy chế trả lương** được app sinh từ danh mục đang dùng: menu **Hướng dẫn & Quy chế → Quy chế tính lương (dự thảo)**. Có nút **In** và **Tải file Word (.doc)** để công ty chỉnh sửa rồi ban hành.
> Thời hạn từng bước (ngày trong tháng) do công ty quy định trong Quy chế. Vai trò phụ trách lấy theo phân quyền mặc định (`BUSINESS_RULES.md` R-45).

| # | Bước | Vai trò | Việc chính |
|---|---|---|---|
| 1 | Cập nhật hồ sơ & biến động | Nhân sự | Nhân viên mới (hồ sơ + hợp đồng + phụ lục + tài khoản NH); tăng lương / đổi chức vụ = **thêm phụ lục mới**; nghỉ việc; người phụ thuộc |
| 2 | Nhập chấm công | Trưởng bộ phận / Kế toán lương | 1 dòng = 1 NV × 1 hình thức công; ô ngày `1`, `0.5`, `1QC`. Nhập Excel nhiều lần không trùng (chọn Bổ sung/Ghi đè; cùng ngày nhập trùng cùng số công chỉ tính 1 lần) |
| 3 | Sản lượng, bơm dăm, thưởng/trừ, tạm ứng, suất cơm | Kế toán lương | Phiếu cân chia nhiều người → nhiều dòng cùng số phiếu; tổng không vượt KL gốc |
| 4 | Kiểm tra dữ liệu | Kế toán lương (Admin: *Kiểm tra dữ liệu*) | Xử lý hết cảnh báo Critical/High |
| 5 | Tính lương & đối chiếu | Kế toán lương | Đọc khung cảnh báo; xem chi tiết từng người; so với kỳ trước, tổng hợp phòng ban |
| 6 | Duyệt | Người phê duyệt / Giám đốc | Xuất Excel / in để duyệt; sai → quay lại bước 1–3 |
| 7 | Chốt kỳ | Kế toán lương | 🔒 Chốt: lưu bảng lương + dữ liệu vào + người chốt; khóa dữ liệu kỳ |
| 8 | Chi trả & kê khai | Kế toán thanh toán | Xuất trọn bộ (Bảng lương, BHXH, Thuế, Chuyển khoản), phiếu chi, bảng hạch toán, phiếu lương |
| 9 | Sao lưu | Admin | *Sao lưu ra file*, cất USB/Drive |

**Điều chỉnh sau khi chốt**
1. **Admin** mở chốt, ghi lý do. Bản chốt cũ vẫn được giữ trong lịch sử.
2. Sửa dữ liệu. Nếu đổi lương thì **thêm phụ lục mới** (Q-15).
3. Tính lại và chốt lại thành phiên bản mới.
4. Bấm **So sánh** để xem chênh lệch, rồi truy lĩnh / truy thu theo Quy chế.
