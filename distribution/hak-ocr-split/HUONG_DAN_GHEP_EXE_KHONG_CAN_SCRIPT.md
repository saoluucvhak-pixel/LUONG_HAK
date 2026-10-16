# Hướng dẫn ghép bộ cài HAK Smart OCR AI — KHÔNG CẦN TẢI FILE CMD/PS1

**Dùng Windows có sẵn, không tắt Safe Browsing và không chạy script tải từ Internet.**

## Nguồn phát hành

Bản chia 4 phần đã được kiểm chứng trên Windows CI:

https://github.com/saoluucvhak-pixel/LUONG_HAK/actions/runs/38846476548

Chỉ cần tải 4 mục sau từ mục Artifacts (đăng nhập GitHub nếu được yêu cầu):

- `HAK-OCR-Setup-Part-001.zip`
- `HAK-OCR-Setup-Part-002.zip`
- `HAK-OCR-Setup-Part-003.zip`
- `HAK-OCR-Setup-Part-004.zip`

**Không cần tải `HAK-OCR-00-GHEP-FILE.zip`.** Nếu trình duyệt chặn một file do cảnh báo bảo mật, đừng tắt bảo vệ hay cố vượt qua cảnh báo.

## Các bước thực hiện

1. Tạo thư mục `D:\HAK_OCR_INSTALL`.
2. Mở từng ZIP Part-001, 002, 003, 004; giải nén file `*.partNNN` bên trong ra chung thư mục `D:\HAK_OCR_INSTALL`. Không đổi tên. Sau khi giải nén phải nhìn thấy đủ:
   - `HAKSmartOCRAI-Setup-1.2.0-alpha.exe.part001`
   - `HAKSmartOCRAI-Setup-1.2.0-alpha.exe.part002`
   - `HAKSmartOCRAI-Setup-1.2.0-alpha.exe.part003`
   - `HAKSmartOCRAI-Setup-1.2.0-alpha.exe.part004`
3. Mở thư mục `D:\HAK_OCR_INSTALL` trong File Explorer. Bấm thanh địa chỉ, nhập `cmd` rồi Enter. Command Prompt sẽ mở ngay tại thư mục đó.
4. Sao chép **nguyên một dòng** sau vào CMD rồi Enter:

```cmd
copy /b "HAKSmartOCRAI-Setup-1.2.0-alpha.exe.part001"+"HAKSmartOCRAI-Setup-1.2.0-alpha.exe.part002"+"HAKSmartOCRAI-Setup-1.2.0-alpha.exe.part003"+"HAKSmartOCRAI-Setup-1.2.0-alpha.exe.part004" "HAKSmartOCRAI-Setup-1.2.0-alpha.exe"
```

5. Chưa chạy file EXE ngay. Tại cửa sổ CMD đó, dán lệnh:

```cmd
certutil -hashfile "HAKSmartOCRAI-Setup-1.2.0-alpha.exe" SHA256
```

SHA-256 đúng của bộ cài gốc (149.289.674 byte) phải là:

```
e3b9c68907e56d047d9f28c1d1125ee4a04eeda7c3cbbe59d22b208be5ad9e7d
```

**Chỉ chạy EXE nếu checksum trùng hoàn toàn**; nếu không trùng, xóa file EXE đã ghép, kiểm tra/tải lại phần lỗi. Có thể quét bằng Windows Security trước khi cài.

## Giải thích

- 4 file Part là 4 đoạn nhị phân của **cùng một file EXE** nên ghép theo thứ tự bằng Windows `copy /b`.
- File `HAK-OCR-00-GHEP-FILE.zip` chứa .cmd/.ps1 và có thể bị trình duyệt đánh dấu; không cần file đó theo hướng dẫn này.
- Xác minh SHA-256 đảm bảo tệp ghép ra đúng bit so với file build trên GitHub; không tự nó chứng minh chương trình an toàn hay phù hợp đưa vào sử dụng thực tế.
- Bản cài là **1.2.0 Alpha**, đã qua smoke-test trên runner Windows nhưng vẫn cần thử trên máy sử dụng thực tế.
