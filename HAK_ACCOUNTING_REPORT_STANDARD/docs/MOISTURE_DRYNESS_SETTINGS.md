# Cài đặt hệ thống — Độ ẩm và độ khô

- Bổ sung 2 nhóm cấu hình độc lập: **Độ ẩm (%)** và **Độ khô (%)**.
- Mỗi nhóm chọn **Số nguyên** hoặc **Số thập phân** từ 0 đến 6 chữ số; mặc định 2 chữ số.
- Cho phép ghi đè theo cột/mẫu báo cáo; canh phải; hiển thị số theo vi-VN (ví dụ 42,123456 %).
- Dữ liệu nội bộ lưu tỷ lệ dạng 0..100 (percentage points), không phải 0..1; adapters bắt buộc khai báo đơn vị khi nhập dữ liệu để tránh nhầm 0,42 và 42%.
- Nếu độ khô được **định nghĩa là phần chất khô bổ sung đến 100%** trên cùng mẫu/cùng cơ sở đo, có thể tính: độ khô (%) = 100 - độ ẩm (%). Không tự động áp dụng công thức này cho chỉ số độ khô theo phương pháp đo/cơ sở khác.
- Độ ẩm, độ khô và MT/BDMT không được dùng độ chính xác hiển thị để tính toán quy đổi. Không giả định độ khô chuẩn hoặc hệ số chuẩn nếu không có cấu hình và nghiệp vụ rõ ràng.
- Giá trị hợp lệ 0..100%; null khác 0; cảnh báo số liệu ngoài phạm vi và dữ liệu đo không hợp lệ.
- Bảng hệ thống: `money`, `quantity`, `moisture`, `dryness`; cài đặt theo nhóm hoặc ghi đè theo từng cột; áp dụng nhất quán màn hình/Excel/PDF/in.
- Khi xuất Excel, lưu ô tỷ lệ dưới dạng số thực với format phù hợp; nếu lưu 42.5 thì dùng format số + ký hiệu % literal, **không dùng** format percent nhân 100 của Excel. Nếu lưu 0.425 thì dùng format percent chuẩn; không được trộn hai quy ước.
- Thay đổi độ chính xác là thay đổi hiển thị, không được thay đổi dữ liệu gốc, tỷ lệ đo hay kết quả tính kho.
