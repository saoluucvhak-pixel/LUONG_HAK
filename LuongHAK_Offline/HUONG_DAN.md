# Tính lương HAK — bản chạy OFFLINE trên Windows

Không cần internet, không cần cài đặt, không cần Google Sheet.

## Cách dùng
1. Copy cả thư mục `LuongHAK_Offline` về máy Windows (ví dụ `C:\LuongHAK`).
2. Bấm đúp **`Chay_LuongHAK.bat`** (mở bằng Microsoft Edge/Chrome có sẵn trên Windows). Hoặc mở thẳng `index.html`.
3. Làm theo thứ tự: **Sao lưu → Nạp danh mục mẫu** (lần đầu) → **Danh mục** → **Nhân sự** → **Chấm công / Sản lượng / Thưởng-Trừ / Tạm ứng / Suất cơm** → **Tính lương**.
4. Có thể copy nhiều dòng từ Excel (đúng thứ tự cột) rồi `Ctrl+V` vào bảng; hoặc "Nhập file CSV" (dòng đầu là tên cột).
5. Xuất Excel (.xls) bảng lương, BHXH, thuế TNCN; in phiếu lương từng người.

## Công thức
Chuyển nguyên từ các file `.gs` của bản Google Apps Script (`Tinhluong.gs`, `Tinhcong.gs`, `Danhmuc.gs`): lương thời gian (CĐ/CN1/CN2/SP/TG), lương sản lượng + bù theo tháng/ngày, bơm dăm, tăng ca TC1–TC6 & CN1/CN2, phụ cấp, hỗ trợ, tiền cơm, phụ cấp theo nhãn chấm công (vd `1QC`), BHXH + truy thu, TNCN0/1/2, làm tròn thực lĩnh 1.000đ. Cách đặt mã giống bản cũ nên dữ liệu danh mục copy sang dùng được.

## Lưu ý quan trọng
- Dữ liệu lưu trong trình duyệt của máy đang dùng → **bấm "Sao lưu ra file" cuối mỗi kỳ**. Đổi thư mục/xóa dữ liệu duyệt web có thể mất dữ liệu nếu chưa sao lưu.
- Danh mục mẫu (tỷ lệ BH, biểu thuế, giảm trừ) chỉ là gợi ý — kế toán cần kiểm tra theo quy định hiện hành.
- Không đụng tới các file `.gs`/`index.html` ở thư mục ngoài: đó là bản Google cũ.
