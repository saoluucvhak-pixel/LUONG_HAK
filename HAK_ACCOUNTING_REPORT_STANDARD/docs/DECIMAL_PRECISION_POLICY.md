# Quy tắc phần nguyên và phần thập phân

- **Phần nguyên không có giới hạn chữ số do quy tắc định dạng đặt ra**; phần thập phân hiển thị tối đa **6 chữ số**.
- Mặc định: money 0, quantity 2, moisture 2, dryness 2 chữ số thập phân. Có thể chọn số nguyên hoặc 0–6 chữ số thập phân theo nhóm/cột.
- Ví dụ: 123456789123456789123456789.123456 -> 123.456.789.123.456.789.123.456.789,123456.
- Với giá trị lớn hơn giới hạn chính xác của JavaScript Number, truyền **chuỗi decimal không có dấu phân cách** hoặc BigInt. Không chuyển qua Number/parseFloat/Intl trước khi định dạng.
- `src/exact-format.js` cung cấp định dạng chính xác phần nguyên từ chuỗi/BigInt, dùng làm tròn half-up chỉ để hiển thị. Phép tính nghiệp vụ dùng decimal arithmetic và quy tắc làm tròn riêng.
- Không thể gọi là vô hạn tuyệt đối: dung lượng bộ nhớ, giới hạn kiểu dữ liệu của DB/Excel/PDF và độ rộng trang in vẫn hữu hạn. Nếu giá trị quá dài, báo cáo phải mở rộng cột, xuống dòng hoặc xuất phụ lục; không cắt số im lặng.
- Độ ẩm/độ khô là tỷ lệ phần trăm trong khoảng 0–100 theo quy ước dữ liệu hiện tại; giới hạn miền giá trị không phải giới hạn số chữ số phần nguyên của thư viện.
- Cần tích hợp `formatExact` vào toàn bộ adapter và xác nhận kiểm thử CI trước khi phát hành.
