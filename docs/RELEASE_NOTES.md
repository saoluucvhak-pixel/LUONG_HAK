# RELEASE_NOTES — 2.0.0-alpha.2 (đăng nhập & phân quyền)

# RELEASE_NOTES — 2.0.0-alpha.4 (kiểm tra ô chấm công)

**Ngày:** 10/10/2026 · bản thử nghiệm.

- Ô chấm công **số âm, chữ lạ, hoặc ngày không có trong tháng** (VD 31/09) không còn nhập được (Excel, gõ tay, dán).
- **Sau khi cài:** vào *Công ty & Sao lưu → Kiểm tra dữ liệu*. Nếu có dòng **High** "Ngày 31 không tồn tại…" hoặc "không đọc được", hãy mở *Chấm công* kỳ đó và xóa / sửa ô. Bảng lương **đã chốt không thay đổi**. Kỳ chưa chốt hiện **vẫn cộng** ô ngày không tồn tại cho tới khi có quyết định Q-21.
- Xem trước nhập Excel có thêm cột **Cảnh báo** (quá 3 công/ngày, nhãn công tác chưa có mã phụ cấp).
- Không đổi công thức lương, không đổi cấu trúc dữ liệu — quay lại alpha.3 được.

---

**Ngày:** 10/10/2026 · bản thử nghiệm.

**Khi cài:**
1. Lần đầu mở app sẽ yêu cầu **tạo Admin**. **Ghi lại mã khôi phục** app hiện ra.
2. Admin tạo tài khoản cho từng người ở *Công ty & Sao lưu → Người dùng & phân quyền*.

**Lưu ý quan trọng:**
- **Gỡ các bản cũ** (1.x, 2.0.0-alpha.1) khỏi mọi máy. Bản cũ không có đăng nhập nên mở được dữ liệu mà không cần mật khẩu (RISK-06).
- File dữ liệu **chưa mã hóa** (RISK-07): hãy giới hạn quyền truy cập máy và thư mục `%APPDATA%\Tinh Luong HAK`.

---

# RELEASE_NOTES — Nhân sự - Tiền lương HAK 2.0.0-alpha.1

**Ngày:** 10/10/2026 · **Loại:** bản thử nghiệm (alpha) của lộ trình 2.0 — giai đoạn ưu tiên 1, sửa lỗi dữ liệu. Nên cài thử trên 1 máy và giữ bản 1.4.0 dự phòng trước khi dùng cho cả công ty.

## Vì sao cần bản này
1. **Nhập Excel bổ sung có thể làm mất dữ liệu (1.4.0)**: ô để trống trong file xóa dữ liệu đang có. Ví dụ: nhập chấm công nửa cuối tháng làm mất nửa đầu; nhập danh sách nhân viên thiếu CCCD xóa CCCD đang có. Đã sửa: mặc định chỉ bổ sung.
2. **Chấm công tách dòng bị mất công, hoặc bị cộng đôi khi viết "bt" thường**. Đã sửa.
3. **Bản sao lưu tạo cùng giây ghi đè nhau; bản sao lưu bị hỏng vẫn khôi phục được**. Đã có tên duy nhất và mã kiểm tra.
4. **Mở file sai cấu trúc hoặc của bản mới hơn có thể mất cả bảng dữ liệu**. App chuyển sang chế độ chỉ xem, không ghi.
5. **Truy vết**: biết ai chốt, ai mở chốt, ai sửa dữ liệu hồi tố vào kỳ đã chốt.

## Sau khi cài
1. Vào **Công ty & Sao lưu → Người đang sử dụng máy này**, nhập tên.
2. **Kiểm tra dữ liệu** → nếu có dòng "nên gộp" của chấm công, bấm **Gộp dòng chấm công trùng**.
3. **Kiểm tra tất cả bản sao lưu**. Bản tạo trước 2.0 hiện "chưa có mã kiểm tra", vẫn dùng được.

## Giới hạn còn tồn tại
- Như 1.4.0: SheetJS 0.18.5 (chỉ nhập file từ nguồn tin cậy), chưa có đăng nhập/phân quyền, file dữ liệu chưa mã hóa, bộ cài chưa ký số.
- "Người thực hiện" là tên tự khai + tài khoản Windows, **chưa xác thực**.
- Lưu và sao lưu chậm hơn khoảng 2 lần (thêm bước bảo vệ). 5.000 NV: lưu ~170 ms, sao lưu ~250 ms.
- Câu hỏi nghiệp vụ mới Q-12…Q-16 (`BUSINESS_RULES.md`).

## Rollback
Cài lại 1.4.0 → khôi phục `backups/*.json` gần nhất. Cấu trúc dữ liệu không đổi (schemaVersion 2), bản 1.4.0 đọc được.

---

# RELEASE_NOTES — Nhân sự - Tiền lương HAK 1.4.0

**Ngày:** 10/10/2026 · **Loại:** bản sửa lỗi quan trọng (Phase 1) — **khuyến nghị cài cho mọi máy đang dùng 1.1–1.3.**

## Vì sao nên nâng cấp ngay
1. **Bản 1.2–1.3 cài trên Windows không chốt được kỳ lương** (nút Chốt không phản hồi), nút *Cho nghỉ việc* không chạy. Đã sửa.
2. **Số tiền có thể bị sai**: mở rồi lưu lại form phụ lục lương làm đơn giá như 300.000 thành 300; gõ "500.000" ở bảng Thưởng/Tạm ứng bị hiểu là 500đ. Đã sửa; dữ liệu dạng "500.000" tự chuẩn hóa. **Số đã bị lưu sai ở bản cũ không tự khôi phục được** — xem mục *Kiểm tra dữ liệu* để tìm và nhập lại.
3. **An toàn dữ liệu**: file dữ liệu hỏng không còn bị ghi đè trống; sao lưu đầu ngày không còn bị ghi đè; có màn hình khôi phục và danh sách bản sao lưu.
4. **Nhập Excel không còn tạo dòng trùng** (nhập lại chấm công trước đây làm lương gấp đôi).

## Có gì mới
- Trung tâm nhập Excel có xem trước và danh sách lỗi.
- Phiên bản kỳ lương: mở chốt bắt buộc lý do, giữ bản cũ, so sánh trước/sau, kiểm tra toàn vẹn.
- Quản lý sao lưu, Kiểm tra dữ liệu, nhật ký thao tác, thêm cảnh báo khi tính lương.
- Electron 43 (bản cũ 33 đã hết hỗ trợ bảo mật).

## Sau khi cài
1. Mở app — dữ liệu cũ tự nâng cấp (app tạo bản sao lưu `startup_…` trước).
2. Vào **Công ty & Sao lưu → Kiểm tra dữ liệu**, xử lý các mục *Critical/High*.
3. Tính lại các kỳ chưa chốt.

## Giới hạn còn tồn tại
- Thư viện đọc Excel SheetJS 0.18.5 có lỗ hổng đã biết khi mở **file Excel độc hại**: chỉ nhập file từ nguồn tin cậy (giới hạn 20 MB). Sẽ vá khi có bản 0.20.3.
- Chưa có đăng nhập/phân quyền; file dữ liệu **chưa mã hóa** — ai dùng được máy tính đều đọc được `%APPDATA%\Tinh Luong HAK`.
- Một số quy tắc lương cần kế toán xác nhận (phụ lục giữa tháng, trần BH, tiền cơm và thuế…) — xem `BUSINESS_RULES.md`.
- Bộ cài chưa ký số → Windows có thể cảnh báo "Windows protected your PC" (bấm *More info → Run anyway*).
- Bản Google Apps Script (thư mục gốc repo) đang mở web app cho mọi người có link — cần chủ sở hữu quyết định (GAS-01).

## Rollback
Khi mở 1.4.0 lần đầu, app tự tạo bản `truoc-nang-cap_….json` chứa **nguyên trạng dữ liệu của bản cũ** (trước mọi chuyển đổi). Muốn quay về 1.3.0: cài lại 1.3.0 → *Sao lưu → Khôi phục từ file* → chọn file `truoc-nang-cap_…` trong `%APPDATA%\Tinh Luong HAK\backups\` (lưu ý: dữ liệu nhập sau khi nâng cấp sẽ không có trong bản này).
