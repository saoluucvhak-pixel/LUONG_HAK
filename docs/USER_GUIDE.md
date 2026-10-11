# USER_GUIDE — Hướng dẫn sử dụng Nhân sự – Tiền lương HAK (bản offline cho Windows, v1.4.0)

Không cần internet, không cần Google Sheet. Cài bằng file `TinhLuongHAK-Setup-x.y.z.exe`.

> **Từ 2.0-alpha.3**, hướng dẫn đầy đủ nằm ngay trong app: menu **Hướng dẫn & Quy chế**, gồm 5 phần:
> - Bắt đầu nhanh;
> - Quy trình tính lương hằng tháng;
> - **Dự thảo Quy chế trả lương**: sinh từ danh mục đang dùng, in hoặc tải file Word được;
> - Hướng dẫn từng màn hình;
> - Câu hỏi thường gặp.

## Đăng nhập & người dùng (từ 2.0-alpha.2)

**Lần đầu mở app** (cài mới, hoặc nâng cấp từ bản cũ)
- App yêu cầu **tạo tài khoản Admin**: tên đăng nhập, họ tên, mật khẩu ≥ 8 ký tự có chữ và số.
- Sau đó app hiện **mã khôi phục** dạng `XXXX-XXXX-XXXX-XXXX`. Mã chỉ hiện 1 lần — **ghi lại và cất ở nơi an toàn**. Đây là cách duy nhất vào lại app khi quên mật khẩu Admin.

**Tạo tài khoản cho người khác** (chỉ Admin)
- Vào **Công ty & Sao lưu → Người dùng & phân quyền → Thêm người dùng**.
- Chọn **vai trò** (Nhân sự, Kế toán lương, Kế toán thanh toán, Trưởng bộ phận, Người phê duyệt, Người xem báo cáo) và đặt **mật khẩu tạm**. Người đó phải đổi mật khẩu ở lần đăng nhập đầu tiên.
- (2.0-alpha.9, Q-24) Người **không** có quyền *Xem bảng lương* và cũng không có quyền *Sửa hồ sơ* (mặc định là **Trưởng bộ phận**) sẽ không thấy lương thỏa thuận / lương cơ bản / giá trị tiền thưởng của nhân viên. Các ô này hiện `🔒 ẩn`.
- Bấm vào một dòng để sửa vai trò, khóa tài khoản hoặc đặt lại mật khẩu tạm.

**Người dùng chỉ thấy và làm được những việc vai trò cho phép.** Ví dụ:
- Nhân sự không xem được bảng lương.
- Kế toán lương chốt được kỳ nhưng **không mở chốt** được.
- **Chỉ Admin** được sửa dữ liệu có hiệu lực ngược vào kỳ đã chốt, khôi phục dữ liệu và quản trị người dùng.

**Bảo vệ tài khoản**
- Nhập sai mật khẩu 5 lần → chờ 30 giây.
- Không thao tác 30 phút → app tự đăng xuất.
- Góc trên bên phải có **Đổi mật khẩu** và **Đăng xuất**.

**Quên mật khẩu Admin**: ở màn hình đăng nhập, bấm **Quên mật khẩu Admin…**, nhập mã khôi phục và mật khẩu mới. App cấp mã khôi phục mới — ghi lại lần nữa.

## Bắt đầu
1. **Công ty & Sao lưu** → nhập Hồ sơ công ty → bấm **Nạp danh mục chuẩn HAK** (phòng ban, chức vụ, mã lương, phụ cấp, tăng ca, hỗ trợ, bảo hiểm, thuế TNCN, biểu thuế 5 bậc 2026, giảm trừ 15,5tr/6,2tr — lấy từ hệ thống QL_NHANSU).
2. **Nhân sự** → **＋ Thêm nhân viên**: 1 form gồm thông tin cơ bản, cá nhân, hợp đồng, lương/BH/thuế, tài khoản.
   Hoặc **📄 Tải file mẫu** (mỗi loại hồ sơ 1 sheet) → điền → **⬆ Nhập Excel**.

## Bảng lớn, tìm kiếm, phím tắt (từ 2.0-alpha.8)
- Bảng nhiều dòng được **chia trang**. Thanh trang ở trên (và dưới) bảng có các nút « ‹ › » và ô chọn 50 / 100 / 200 / 500 dòng mỗi trang.
- **Ô tìm kiếm nhớ riêng từng bảng**, kể cả khi chuyển màn hình hay mở lại app. Khi đang lọc, dòng đếm ghi "đang lọc …". Xóa chữ trong ô tìm kiếm để xem lại đủ dòng.
- **Phím tắt:**
  - **Enter**: xuống ô cùng cột ở dòng dưới;
  - **Shift+Enter**: lên dòng trên;
  - **Ctrl+F**: vào ô tìm kiếm;
  - **Ctrl+V**: dán nhiều dòng từ Excel. Dán tiếp sang trang sau nếu dài hơn 1 trang.

## Thưởng / Trừ, Tạm ứng — Số chứng từ (từ 2.0-alpha.10)
- Ghi **Số chứng từ** (số phiếu chi / số quyết định thưởng) cho mỗi dòng.
- Nhập lại file có cùng số chứng từ thì app **cập nhật**, không cộng thêm. Ví dụ: sửa số tiền trong file rồi nhập lại.
- Một phiếu chi cho nhiều người: mỗi người 1 dòng, cùng số chứng từ.
- Dòng chưa có số chứng từ vẫn dùng được, nhưng app sẽ nhắc. *Kiểm tra dữ liệu* báo các dòng có thể bị nhập trùng.

## Nhập Excel (v1.4)
- Sau khi chọn file, app hiện **màn hình xem trước**: số dòng *Thêm mới · Cập nhật · Trùng (bỏ qua) · Lỗi dữ liệu · Sai tham chiếu · Kỳ đã chốt*. Chỉ dòng Thêm mới / Cập nhật được ghi. Bấm **⬇ Tải danh sách lỗi** để sửa và nhập lại.
- Nhập lại cùng file **không tạo dòng trùng**: dòng cùng khóa (VD chấm công cùng Kỳ + Mã NV + Hình thức công) được cập nhật.
- **(2.0) Cách cập nhật dòng đã có** — nếu file có dòng trùng với dữ liệu đã có, màn hình xem trước báo số dòng trùng và cho bạn chọn:
  - **Chỉ bổ sung/sửa ô có dữ liệu** (mặc định, an toàn): ô để trống trong file **giữ nguyên** dữ liệu đang có. Ví dụ: tháng nhập 2 lần (ngày 1–15 rồi ngày 16–30) vẫn đủ cả tháng.
  - **Ghi đè cả dòng theo file**: ô trống trong file **xóa** dữ liệu đang có. App báo trước số ô sẽ bị xóa.
  - Cột *Lý do* ghi rõ từng thay đổi, ví dụ "sửa 1 ô (05: 1 → 0.5)", "thêm 15 ô", "giữ 15 ô".
- **(2.0) Chấm công nhiều dòng cùng nhân viên, cùng hình thức công trong 1 file**:
  - Các dòng **không trùng ngày** được **gộp** (phân loại *Gộp vào dòng khác*).
  - Cùng 1 ngày có công ở 2 dòng là **nhập trùng**: cùng số công thì app **tính 1 lần**; khác số công (VD 1 và 0,5) thì app báo **Xung đột (không ghi)**, vì không biết số nào đúng — sửa trong Excel rồi nhập lại.
- **(2.0)** Nếu dữ liệu đang có sẵn nhiều dòng chấm công cùng khóa, app chặn nhập và hướng dẫn: *Công ty & Sao lưu → Kiểm tra dữ liệu → **Gộp dòng chấm công trùng*** (tổng công không đổi; app sao lưu trước).
- Ngày nhập được dạng 2026-09-15 hoặc 15/09/2026; kỳ dạng 2026-09 hoặc 09/2026; tiền dạng 1500000 hoặc 1.500.000. CCCD/SĐT bị Excel làm mất số 0 đầu được tự bù.
- (2.0) App luôn tự sao lưu trước khi ghi. Nếu không lưu được xuống đĩa, **toàn bộ lần nhập được hủy**. File tối đa 20 MB.
3. Mở hồ sơ từng người để bổ sung: Nhân thân / người phụ thuộc, học vấn, quá trình công tác, sức khỏe…
   Trong tab **Hợp đồng lao động**: Lương & phụ lục HĐ, quyền lợi phép, nghỉ phép, nghỉ ốm, khám sức khỏe, khen thưởng, kỷ luật, tài liệu.
4. Hằng tháng: nhập **Chấm công**, **Sản lượng**, **Bơm dăm**, **Thưởng/Trừ**, **Tạm ứng** → **Tính lương** → xuất Excel (bảng lương, BHXH, thuế, danh sách chuyển khoản) / in phiếu lương.

## Tăng lương / đổi lương giữa tháng (từ 2.0-alpha.11)
Khi lập phụ lục có *Hiệu lực từ* giữa tháng, chọn ô **Cách áp dụng trong tháng hiệu lực**:
- **Cả tháng** (hoặc để trống): cả tháng tính theo mức mới.
- **Từ ngày hiệu lực**: công trước ngày hiệu lực tính theo lương cũ, công từ ngày hiệu lực tính theo lương mới. Ví dụ: 20 tr → 26 tr từ 16/09, mỗi nửa tháng 13 công → lương tháng 9 = 23.000.000.
  - Chỉ chia được khi phụ lục cũ và mới **cùng mã lương**.
  - Bảo hiểm tính theo phụ lục mới.
  - Màn hình Tính lương ghi rõ số công theo từng mức.

## Điều chuyển phòng ban giữa tháng (từ 2.0-alpha.12)
Lập **phụ lục mới** có *Hiệu lực từ* là ngày chuyển và *Phòng ban* mới. Báo cáo *Tổng hợp theo phòng ban* và *Bảng hạch toán* sẽ tự chia chi phí lương của người đó theo số công làm ở từng phòng. Số tiền lương của người lao động không đổi.

## Lương lấy từ hồ sơ như thế nào
- Chỉ tính cho nhân viên có **hợp đồng còn hiệu lực trong kỳ** (Ngày vào làm ≤ cuối tháng, chưa chấm dứt trước đầu tháng).
- Lấy dòng **Lương & phụ lục HĐ** mới nhất có "Hiệu lực từ" ≤ cuối tháng → tăng lương chỉ cần thêm 1 phụ lục mới.
- Số người phụ thuộc = số nhân thân có "Đăng ký phụ thuộc = Có" còn hiệu lực trong kỳ.
- Thuế: mã "Khấu trừ vãng lai" (VL01) = 10% tổng thu nhập; "Lũy tiến" (LT01) = biểu thuế lũy tiến; "Miễn thuế" (MT00).
- Cho nghỉ việc: nút **Cho nghỉ việc** trong hồ sơ → ghi ngày chấm dứt HĐ, từ tháng sau không tính lương.

## Chốt kỳ lương
- Tính lương xong, kiểm tra → bấm **🔒 Chốt kỳ lương** (ghi chú tùy chọn, VD "Đã duyệt GĐ").
- Kỳ đã chốt: lưu nguyên bảng lương, BHXH, thuế TNCN tại thời điểm chốt; mở lại bất cứ lúc nào ở **Kỳ lương đã chốt** hoặc chọn kỳ đó ở Tính lương. Sửa hồ sơ/danh mục về sau KHÔNG làm thay đổi số đã chốt.
- Chấm công, sản lượng, bơm dăm, thưởng/trừ, tạm ứng, suất cơm của kỳ đã chốt bị khóa (chỉ xem).
- **🔍 Đối chiếu với dữ liệu hiện tại**: tính lại bằng dữ liệu hôm nay và liệt kê người bị chênh so với bảng đã chốt.
- **🔓 Mở chốt**: bắt buộc nhập **lý do**. Bảng đã chốt **không bị xóa** mà chuyển vào *Lịch sử các lần mở chốt*; dữ liệu kỳ được mở khóa để sửa, tính lại và chốt thành **phiên bản mới** (v2, v3…). Nút **↔ So sánh** cho thấy ai bị thay đổi thực lĩnh giữa hai phiên bản.
- Cột **Toàn vẹn**: "Nguyên vẹn" = số đã chốt chưa bị sửa trong file dữ liệu; "BỊ SỬA" = cảnh báo cần kiểm tra.
- Khi bấm Chốt, app luôn **tính lại** từ dữ liệu mới nhất. Nếu khác bảng đang xem, app dừng để bạn kiểm tra lại. App chỉ báo chốt thành công khi đã ghi xuống đĩa.
- **(2.0) Sửa dữ liệu có hiệu lực vào kỳ đã chốt (hồi tố)** — ví dụ thêm phụ lục tăng lương từ 01/09 khi tháng 9 đã chốt, sửa danh mục phụ cấp có hiệu lực cũ, cho nghỉ việc lùi ngày:
  - App **hỏi xác nhận** và ghi nhật ký kèm nhãn *HỒI TỐ*.
  - Bảng lương đã chốt **không đổi**. Muốn áp dụng cho kỳ đó: *Mở chốt* → tính lại → chốt lại thành phiên bản mới, rồi bấm *So sánh* để xem chênh lệch.
- (2.0) Không đổi được **Mã NV** nếu nhân viên đã có trong bảng lương đã chốt (để số đã chốt luôn khớp hồ sơ).
- (2.0-α2) **Phụ lục hợp đồng** đã dùng để tính lương một kỳ đã chốt **không sửa / xóa được (kể cả Admin)**. Muốn tăng lương, đổi chức vụ hoặc phòng ban: vào *Hồ sơ nhân viên → Hợp đồng lao động → Lương & phụ lục HĐ → ＋ Thêm* để lập **phụ lục mới** có ngày hiệu lực mới. App tự chép nội dung phụ lục gần nhất để bạn chỉ sửa phần thay đổi.
- (2.0) Bản chốt ghi **người chốt**; lần mở chốt ghi **người mở, lý do, thời điểm**.

## Báo cáo lương (menu 📈 Báo cáo lương)
Theo kỳ (chọn ở ô Kỳ lương; kỳ đã chốt lấy số đã lưu, chưa chốt thì tính tạm):
- Tổng hợp theo phòng ban (thu nhập, BH NLĐ/công ty, thuế, tạm ứng, thực lĩnh)
- Tổng hợp công (BT, phép, lễ, tăng ca, Chủ nhật, ngày cơm, ngày có nhãn công tác)
- Phân bổ sản lượng / bơm dăm theo phòng ban, theo công nhân, phiếu cân chưa gán người
- Bảng hạch toán lương (Nợ 622/627/641/642 – Có 334, 338, 3335, 141, 1388, 1111/1121) — TK chi phí khai ở Danh mục → Phòng ban
- Phiếu chi lương / tạm ứng
- So sánh với kỳ trước (chênh lệch thực lĩnh từng người)
Cả năm (chỉ cộng các kỳ đã chốt): Lương 12 tháng · Thu nhập năm theo nhân viên (chọn chỉ tiêu) · Thuế TNCN cả năm (hỗ trợ quyết toán).
Mọi báo cáo xuất được Excel.

## Giao diện 2.0 (từ 2.0-alpha.15)
- **Sáng / tối:** nút mặt trăng / mặt trời ở góc phải trên hoặc cuối menu trái (nhớ theo máy).
- **Ctrl+K:** tìm nhanh màn hình, nhân viên (mã / tên, gõ không dấu), báo cáo — ↑ ↓ chọn, Enter mở.
- **Sửa hồ sơ:** mở ở ngăn bên phải, khung *Sẽ lưu N thay đổi* cho thấy cũ → mới trước khi bấm Lưu. Thông tin cá nhân / tài khoản: *Thông tin mới* (đổi CCCD, địa chỉ, tài khoản — bản cũ giữ làm lịch sử) hoặc *Sửa lỗi nhập sai*.
- **Tăng lương / biến động** (nút xanh trên hồ sơ): chọn loại, ngày hiệu lực, số quyết định, mức mới → app lập phụ lục mới, hiện % thay đổi. Không sửa phụ lục cũ.
- **Lịch sử** (trên hồ sơ): quá trình lương + mọi thay đổi (ai, lúc nào, cũ → mới).

## Báo cáo nhân sự
**Biến động nhân sự** (chọn từ tháng – đến tháng; bấm ô số để lọc theo loại) · HĐLĐ sắp hết hạn / quá hạn · Tình hình nhân sự · Nghỉ phép/ốm theo năm · Vi phạm chưa xử lý · Sinh nhật trong tháng · Sổ quản lý lao động · Lịch sử hồ sơ từng người. Tất cả xuất được Excel.

### Sổ quản lý lao động (từ 2.0-alpha.14 — NĐ 145/2020 Điều 3)
Chọn **năm** rồi mở *Sổ quản lý lao động*: mỗi người 1 dòng, đủ nội dung luật yêu cầu. Để sổ đầy đủ, nhập thêm trong Hồ sơ:
- *Học vấn*: Bậc trình độ kỹ năng nghề · *Phụ lục HĐ*: Vị trí việc làm · *Hợp đồng*: Ngày chấm dứt + **Lý do chấm dứt**;
- *Đơn nghỉ*: **Loại nghỉ** (để trống = nghỉ hằng năm, chỉ loại này trừ phép năm);
- *Nội quy*: Hình thức kỷ luật, Bồi thường thiệt hại;
- tab **🎓 Đào tạo** và **🚑 Tai nạn lao động / Bệnh nghề nghiệp**.

Làm thêm lấy từ chấm công (dòng Hình thức có TC), tính bằng **công**. Ô trống = chưa nhập dữ liệu. Xuất Excel để lưu / in sổ hằng năm.

## Dữ liệu & sao lưu
- Bản cài tự lưu vào `%APPDATA%\Tinh Luong HAK\data.json` (ghi an toàn, không hỏng file khi mất điện giữa chừng).
- Sao lưu tự động trong thư mục `backups`: **daily** = trạng thái đầu mỗi ngày (giữ 60 ngày, không bị ghi đè trong ngày) · **startup** = mỗi lần mở app (giữ 10) · **truoc-nang-cap** = nguyên trạng dữ liệu bản cũ trước khi nâng cấp · **truoc-…** = trước nhập Excel lớn, mở chốt, khôi phục, xóa toàn bộ, hoặc khi dữ liệu giảm hơn một nửa.
- **Công ty & Sao lưu → Các bản sao lưu tự động**: xem danh sách, bấm *Khôi phục* một bản. App tự sao lưu dữ liệu hiện tại trước khi khôi phục.
  - (2.0) Mỗi bản sao lưu có **mã kiểm tra SHA-256**. Nút **Kiểm tra tất cả bản sao lưu** cho biết bản nào nguyên vẹn hay bị hỏng; app **không cho khôi phục** bản bị hỏng.
  - (2.0) Trước khi khôi phục, app liệt kê các **kỳ lương đã chốt sẽ mất hoặc thay đổi** để bạn quyết định.
- Nếu file dữ liệu bị hỏng, app **không ghi đè** mà mở **màn hình khôi phục**: chọn một bản sao lưu hoặc file bạn đã cất. File hỏng được giữ lại với tên `data.corrupt_….json.bak`.
- **Công ty & Sao lưu → Kiểm tra dữ liệu**: liệt kê vấn đề có thể làm sai lương (trùng Mã NV/CCCD, chấm công trùng, ngày không đọc được, lương nghi bị lỗi lưu…). Sau khi nâng cấp lên 1.4.0 hãy mở mục này: phụ lục nào báo **"Lương … quá nhỏ"** là bị lỗi lưu số tiền của bản cũ, cần nhập lại.
- (2.0) Nếu file dữ liệu có cấu trúc lạ (ví dụ file của **phiên bản mới hơn**, hoặc một bảng bị hỏng kiểu), app mở **màn hình khôi phục** và **không ghi gì** vào file. Hãy cài đúng phiên bản hoặc khôi phục bản sao lưu.
- (2.0) **Nhật ký thao tác** (cuối trang Công ty & Sao lưu) ghi tài khoản đăng nhập + tài khoản Windows của người thực hiện; xem và xuất Excel được.
- Gỡ cài đặt app **không xóa** dữ liệu.
- Vẫn nên **Sao lưu ra file** định kỳ và cất sang USB/Drive. Đổi máy: cài app → **Khôi phục từ file**.
- Nâng cấp từ bản 1.0: dữ liệu cũ (bảng Nhân sự phẳng) tự chuyển sang hồ sơ mới, mỗi người có 1 hợp đồng "HD-<mã>" và 1 phụ lục lương.

## Sao lưu ra ngoài máy (từ 2.0-alpha.13)
- **Thư mục sao lưu thứ hai** (Admin): vào *Công ty & Sao lưu → Sao lưu ra ngoài máy → Chọn thư mục sao lưu thứ hai…*. Chọn USB / ổ cứng ngoài / ổ mạng / thư mục Google Drive đã đồng bộ trên máy.
  - Từ đó mọi bản sao lưu tự chép sang thư mục `TinhLuongHAK-SaoLuu` và được kiểm tra.
  - Nếu rút USB, app vẫn sao lưu trên máy và báo lỗi. Cắm lại rồi bấm *Chép sang thư mục thứ hai ngay*.
- **Sau mỗi lần chốt kỳ**, app tạo bản `sau-chot-<kỳ>` và **giữ vĩnh viễn**.
- Quá **7 ngày** chưa sao lưu ra ngoài máy, Trang chủ sẽ nhắc.
- **Quy trình tháng gợi ý:** chốt kỳ → kiểm tra thư mục thứ hai đã có bản `sau-chot` → mỗi quý thử *Khôi phục từ file* trên một máy khác.

## Lưu ý
Danh mục chuẩn chỉ là số liệu khởi đầu — kế toán kiểm tra lại đơn giá, tỷ lệ BH, biểu thuế theo quy định hiện hành.


## Khi gặp lỗi
Nếu một màn hình báo "Có lỗi khi hiển thị": dữ liệu không mất. Bấm *Về Trang chủ*. Nếu lỗi lặp lại, bấm *Sao lưu ra file* và gửi file kèm ảnh chụp màn hình cho người hỗ trợ.
