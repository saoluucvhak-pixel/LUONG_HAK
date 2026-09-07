# Test tự động cho webapp LUONG_HAK

Dự án là Google Apps Script (không chạy trực tiếp bằng `npm`/`node` như 1 app
Node bình thường), nên các test ở đây nạp **nguyên văn** nội dung từng file
`.gs`, thay lớp đọc/ghi Google Sheet (`docSheetThanhObject_`/`ghiDeSheet_`/...)
và các API Google Apps Script (`SpreadsheetApp`/`Utilities`/`Session`/
`PropertiesService`) bằng bản giả lập trong bộ nhớ, rồi chạy **thật** các hàm
tính lương/kiểm tra/nhập liệu — không phải bản chép tay công thức ra so sánh.

## Chạy test

Cần Node.js (không cần cài thêm package nào — chỉ dùng module lõi của Node).

```bash
node tests/run-all.js          # chạy tất cả
node tests/test-pure-logic.js  # chạy riêng 1 file
node tests/test-tinh-luong.js
node tests/test-nhap-lieu.js
```

Mỗi file test **PHẢI** chạy trong 1 process Node riêng (bản thân
`run-all.js` đã làm việc này) — vì mỗi test nạp code `.gs` vào `global` của
process đang chạy bằng indirect eval, chạy chung 1 process sẽ đụng độ tên hàm
giữa các file (ví dụ mỗi file tự định nghĩa `docSheetThanhObject_` giả lập
khác nhau).

## Có gì trong từng file

- **`_lib.js`** — thư viện dùng chung: nạp file `.gs` + stub GAS APIs, bộ đếm
  pass/fail.
- **`test-pure-logic.js`** — test các hàm tính toán thuần không đụng
  `SpreadsheetApp` (tách số công khỏi nhãn, đổi hệ số tăng ca dạng "50%",
  Công chuẩn theo từng mã lương, thuế TNCN luỹ tiến, chuẩn hoá mã, ngày hiệu
  lực...).
- **`test-tinh-luong.js`** — chạy thật `tinhBangLuong()` với 3 kịch bản đầy
  đủ (lương thời gian cơ bản; lương sản lượng + bơm dăm + bù sản lượng + truy
  thu bảo hiểm; tăng ca TC1 + phụ cấp theo tỷ lệ công + thuế TNCN1) — đối
  chiếu từng số trên `RP_BANGLUONG`/`RP_BHXH`/`RP_THUETNCN` với số tính tay
  theo đúng công thức đã tài liệu hoá trong code.
- **`test-nhap-lieu.js`** — chạy thật luồng tải file `.csv` lên qua bảng nháp
  (Ứng lương, Phát sinh lương, Chấm công) → đối chiếu lỗi → xác nhận nạp, và
  hàm kiểm tra dữ liệu ngoài kỳ.

## Vì sao có bộ test này

Trước khi có bộ test, hệ thống có nhiều lỗi chỉ phát hiện được qua đọc code
thủ công (hàm gọi tới nhưng chưa từng định nghĩa, sai công thức "Công chuẩn"
cho 1 số mã lương, cột ngày đọc từ file `.csv` không được nhận diện đúng...).
Bộ test này giúp các thay đổi sau này không lặp lại các lỗi tương tự — **hãy
chạy `node tests/run-all.js` sau mỗi lần sửa `Tinhluong.gs`/`Tinhcong.gs`/
`Danhmuc.gs`/`Nhaplieu.gs`/`Kiemtra.gs`.**

Giới hạn: đây KHÔNG phải test toàn diện (chưa phủ hết mọi nhánh — ví dụ TC2/
TC5/TC6, phương án "Bù sản lượng theo ngày", đồng bộ 2 nguồn ngoài trong
`Dongbongoai.gs`...). Khi sửa các phần chưa có test, nên bổ sung thêm 1 kịch
bản mới vào `test-tinh-luong.js` hoặc file mới cùng khuôn mẫu.
