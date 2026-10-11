# BUSINESS_RULES — Quy tắc nghiệp vụ

## 1. Quy tắc đã áp dụng

### Dữ liệu & nhập liệu
- R-01 Ngày lưu `YYYY-MM-DD`; kỳ `YYYY-MM`; tiền là số đồng (hiểu đúng "1.500.000", "500.000", "1,500,000").
- R-02 Mã định danh (CCCD, SĐT, số TK, MST, Mã NV, Số HĐLĐ, Phiếu cân) luôn là chữ; CCCD 12 số, SĐT 10 số (bù số 0 bị Excel làm mất).
- R-03 Khóa nghiệp vụ chống trùng (nhập Excel và form): xem `DATABASE_SCHEMA.md` §1.
  - Nhập trùng khóa → **cập nhật**; trùng y hệt → bỏ qua.
  - Khóa được chuẩn hóa: kỳ `YYYY-MM`; *Hình thức công* viết hoa, để trống = BT.
- R-03a (2.0) Chấm công 1 dòng = 1 *Kỳ + Mã NV + Hình thức công*:
  - Trong 1 file có nhiều dòng cùng khóa → **gộp theo ngày**.
  - (Q-12, chủ sở hữu xác nhận 10/10/2026) Cùng 1 ngày + cùng hình thức ở 2 dòng = **nhập trùng**:
    - cùng số công → **tính 1 lần**;
    - khác số công (VD 1 / 0,5) → **xung đột**, không ghi, người dùng tự sửa.
  - Dữ liệu đang có nhiều dòng cùng khóa → nhập bị chặn cho tới khi gộp. Công cụ gộp: ngày nhập trùng cùng số công → tính 1 lần; nhóm có ngày khác số công hoặc thuộc kỳ đã chốt → giữ nguyên.
- R-03b (2.0) Cập nhật khi nhập Excel:
  - Mặc định **bổ sung**: ô trống trong file **không xóa** dữ liệu đang có.
  - **Ghi đè cả dòng** phải chọn rõ; app báo trước số ô sẽ bị xóa.
- R-03c (2.0) Cùng khóa trong 1 file nhưng khác dữ liệu (các bảng khác) → xung đột cả 2 dòng, không ghi.
- R-03d (2.0-beta.1) Ô ngày chấm công hợp lệ: trống, số công ≥ 0 (`1`, `0.5`, `1,5`), số công + nhãn (`1QC`), hoặc chỉ nhãn (`QC`). Nhãn bắt đầu bằng chữ cái.
  - **Từ chối** (nhập Excel = Lỗi dữ liệu; lưới / dán = không ghi ô): số âm, ký tự lạ (`1.5.2`, `#`, `1/2`), ngày không có trong tháng của kỳ (VD 31/09, 29/02 năm thường). Lưới khóa các cột ngày không tồn tại.
  - **Cảnh báo, vẫn ghi**: số công > 3/ngày (dòng tăng ca có thể nhập giờ — Q-18); nhãn chưa có mã phụ cấp trùng tên (không được tính phụ cấp công tác).
  - Dữ liệu cũ đã có ô sai: *Kiểm tra dữ liệu* báo High, hộp chốt kỳ báo số ô sai. App **không tự xóa / sửa**; cách tính lương với ô sai giữ như cũ (chờ Q-21).
- R-04 Dữ liệu phát sinh (chấm công, tạm ứng, thưởng…) phải có Mã NV có trong Nhân sự.
- R-05 Nhập Excel bắt buộc qua bước **xem trước**.
  - (2.0) Luôn tự sao lưu trước khi ghi.
  - Lưu xuống đĩa thất bại → **hoàn tác toàn bộ** lần nhập.

### Hồ sơ & hợp đồng
- R-10 Lương tính theo **phụ lục mới nhất có hiệu lực ≤ cuối tháng** của hợp đồng còn hiệu lực trong tháng.
- R-11 Hợp đồng có Ngày chấm dứt < đầu tháng → không tính lương tháng đó.
- R-12 Nhân viên "Đã nghỉ việc" mà hợp đồng chưa chấm dứt → vẫn tính và **cảnh báo**.
- R-13 Người phụ thuộc = nhân thân "Đăng ký phụ thuộc = Có" còn hiệu lực trong kỳ.

### Chốt kỳ
- R-20 Chốt luôn tính lại từ dữ liệu mới nhất; nếu khác bảng đang xem → dừng để kiểm tra.
- R-21 Chốt chỉ thành công khi dữ liệu **đã ghi xuống đĩa**; thất bại → hoàn tác.
- R-22 Kỳ đã chốt: khóa chấm công, sản lượng, bơm dăm, thưởng/trừ, tạm ứng, suất cơm của kỳ (ô nhập, dán, nhập Excel, đổi ngày sang kỳ đã chốt).
- R-23 Snapshot chốt gồm kết quả + dữ liệu đầu vào + danh mục + phiên bản engine + checksum; không bị thay đổi bởi sửa hồ sơ/danh mục về sau.
- R-24 Mở chốt bắt buộc **lý do**; bản cũ chuyển vào lịch sử (không xóa); chốt lại = phiên bản mới; có báo cáo trước/sau.
- R-25 Mọi thao tác chốt, mở chốt, nhập Excel, khôi phục, xóa toàn bộ, nghỉ việc, nạp danh mục được ghi nhật ký.
  - (2.0) Ghi thêm: sửa/xóa hồ sơ và danh mục kèm **trước → sau**, đổi Mã NV, gộp chấm công, đổi người sử dụng.
  - Mỗi dòng nhật ký có **người thực hiện**: tên khai trên máy + tài khoản Windows.
- R-26 (2.0) Phân loại thay đổi theo kỳ đã chốt:
  - (1) **Dữ liệu kỳ đã chốt**: chấm công, sản lượng, bơm dăm, thưởng/trừ, tạm ứng, suất cơm thuộc kỳ chốt → **chặn** mọi đường sửa (ô nhập, dán, xóa dòng, nhập Excel, chuyển kỳ).
  - (2) **Dữ liệu hồi tố**: phụ lục, hợp đồng, nhân thân, tài khoản, danh mục có hiệu lực chồng lên kỳ chốt, cho nghỉ việc lùi ngày → **cho lưu sau khi cảnh báo**, ghi nhật ký kèm nhãn HỒI TỐ.
  - (3) **Không ảnh hưởng**: học vấn, sức khỏe…, hoặc nhân viên không có trong bảng lương đã chốt.
  - (4) **Điều chỉnh bằng phiên bản mới**: muốn áp dụng (2) cho kỳ đã chốt → mở chốt (lý do, người, thời điểm) → tính lại → chốt lại vN+1, có báo cáo chênh lệch.
- R-27 (2.0) Không đổi được Mã NV khi mã đã có trong bảng lương đã chốt. Đổi mã không bao giờ sửa `kyluong`, `kyluong_lichsu`, `auditlog`.
- R-28 (2.0) Checksum bản chốt bao cả **kết quả** và **dữ liệu đầu vào**.

### Sao lưu
- R-30 Sao lưu đầu ngày (60 ngày), khi mở app (10 bản), trước thao tác lớn (20 bản/loại), khi dữ liệu giảm > 50%.
- R-31 Không bao giờ ghi đè file dữ liệu bằng dữ liệu không hợp lệ; không sao lưu file hỏng; file hỏng được cất giữ, không xóa.
- R-32 (2.0) Bản sao lưu:
  - Tên duy nhất, không bao giờ ghi đè nhau.
  - Có mã SHA-256; bản không khớp **không được khôi phục**.
  - Dọn bản cũ không bao giờ xóa bản sao lưu tốt mới nhất.
- R-33 (2.0) Dữ liệu có cấu trúc nguy hiểm → chỉ xem / khôi phục, **không ghi**. Gồm: bảng không phải danh sách, phiên bản cấu trúc mới hơn, lỗi khi chuyển đổi.
- R-34 (2.0) Lỗi dữ liệu dòng chỉ được **báo cáo**, không tự xóa. Bảng không nhận diện được giữ nguyên.
- R-35 (2.0) Khôi phục phải liệt kê các kỳ đã chốt sẽ mất hoặc đổi. File hỏng chỉ được cất **sau khi** người dùng xác nhận khôi phục.

### Đăng nhập & phân quyền (2.0-alpha.2 — Q-14, Q-16 do chủ sở hữu xác nhận 10/10/2026)
- R-40 Phải **đăng nhập** mới thấy và dùng dữ liệu.
  - Dữ liệu chưa có tài khoản (cài mới hoặc nâng cấp từ bản cũ) → bắt buộc tạo **Admin** đầu tiên, kèm **mã khôi phục** (hiện 1 lần).
- R-41 Mật khẩu ≥ 8 ký tự, có chữ và số.
  - Lưu dạng băm PBKDF2-SHA256, 210.000 vòng, muối riêng cho từng tài khoản.
  - Sai 5 lần liên tiếp → chờ 30 giây.
  - Không thao tác 30 phút → tự đăng xuất.
- R-42 Admin tạo tài khoản cho người khác với **mật khẩu tạm**; người dùng **bắt buộc đổi** khi đăng nhập lần đầu. Không được khóa hoặc hạ quyền **Admin đang hoạt động cuối cùng**.
- R-43 Quên mật khẩu Admin → dùng mã khôi phục để đặt lại. Mỗi lần dùng, app cấp **mã mới**; Admin cũng có thể chủ động cấp lại mã.
- R-44 Quyền được kiểm tra ở **tầng nghiệp vụ** (mọi thao tác ghi, xuất, nhập, tính, chốt, khôi phục), không chỉ ẩn nút. Mở thẳng một màn hình không có quyền → app quay về Trang chủ.
- R-45 Vai trò mặc định:

| Vai trò | Quyền |
|---|---|
| **Quản trị (Admin)** | Tất cả. Là vai trò **duy nhất** được: sửa dữ liệu hồi tố vào kỳ đã chốt (Q-14), mở chốt, khôi phục dữ liệu / sao lưu ra file, quản trị người dùng và công ty, xóa toàn bộ dữ liệu |
| Nhân sự | Xem/sửa hồ sơ nhân sự (gồm hợp đồng, phụ lục), xem chấm công, báo cáo nhân sự, nhập/xuất Excel. **Không xem bảng lương** |
| Kế toán lương | Xem hồ sơ; nhập/sửa chấm công, sản lượng, thưởng, tạm ứng; sửa danh mục; tính lương, **chốt** kỳ; xem bảng lương và báo cáo; nhập/xuất Excel. **Không mở chốt** |
| Kế toán thanh toán | Xem bảng lương / kỳ đã chốt, xuất Excel (danh sách chuyển khoản, phiếu chi) |
| Trưởng bộ phận | Xem hồ sơ; nhập/sửa chấm công, sản lượng; báo cáo nhân sự. Không xem bảng lương *(chưa giới hạn theo phòng ban — TODO)* |
| Người phê duyệt | Xem hồ sơ, chấm công, bảng lương, báo cáo; xuất Excel *(quy trình phê duyệt chưa có — giai đoạn sau)* |
| Người xem báo cáo | Xem báo cáo nhân sự và báo cáo/bảng lương |

- R-46 Nhật ký ghi **tài khoản đăng nhập** (họ tên + tên đăng nhập + tài khoản Windows) cho mọi thao tác, gồm đăng nhập / đăng xuất / tự khóa, thêm/sửa người dùng, khôi phục quyền Admin.
- R-47 Xóa nhân viên đã có trong bảng lương đã chốt → chỉ Admin; có sao lưu trước và ghi nhật ký.
- R-48 *Xóa toàn bộ dữ liệu* giữ lại tài khoản, mã khôi phục và nhật ký.
- R-49 (Q-15) Phụ lục HĐ **đã dùng để tính lương một kỳ đã chốt** bị khóa với **mọi người, kể cả Admin**:
  - Không sửa, không xóa phụ lục đó. Không đổi Số HĐLĐ hoặc xóa hợp đồng chứa nó. Nhập Excel không cập nhật được nó.
  - Muốn thay đổi lương, chức vụ, phòng ban: **thêm phụ lục mới** có ngày hiệu lực mới.
  - Phụ lục mới có hiệu lực lùi vào kỳ đã chốt (hồi tố) → chỉ Admin (R-26, Q-14).
  - Mở chốt một kỳ thì phụ lục chỉ còn bị khóa bởi các kỳ khác còn chốt.
- R-50 (Q-13) Nhập Excel có dòng trùng với dữ liệu đã có → màn hình xem trước báo số dòng trùng, người dùng chọn **Bổ sung** (mặc định) hoặc **Ghi đè**.

## 2. Câu hỏi mở — cần chủ sở hữu / kế toán xác nhận
Phase 1 **giữ nguyên** hành vi hiện tại cho đến khi có xác nhận.

| ID | Câu hỏi | Hiện tại |
|---|---|---|
| Q-01 | Phụ lục lương có hiệu lực **giữa tháng** (VD 15/09): tính cả tháng theo mức mới hay chia theo ngày công trước/sau? | Cả tháng theo mức mới |
| Q-02 | "Tổng công" có **gồm công tăng ca** không? (ảnh hưởng ngưỡng BH, phụ cấp theo công, hỗ trợ cơ giới) | Có (giữ như bản Google gốc) |
| Q-03 | Tiền cơm: loại trừ **toàn bộ** khỏi thu nhập chịu thuế hay chỉ đến mức quy định? | Toàn bộ |
| Q-04 | Không đủ ngưỡng công đóng BH: truy thu **toàn bộ phần công ty đóng** từ NLĐ có đúng quy chế? | Có |
| Q-05 | Khoản trừ vượt thu nhập (thực lĩnh âm): chuyển sang kỳ sau, thu hồi tiền mặt hay xóa? | Để 0 + cảnh báo |
| Q-06 | Có áp **mức trần** lương đóng BHXH/BHTN không? | Không |
| Q-07 | Không khai Lương cơ bản thì đóng BH theo Lương thỏa thuận — với CN1/CN2/SP (LTT là đơn giá/công) có đúng? | Có — app cảnh báo nếu lương đóng BH < 1.000đ |
| Q-08 | Một phiếu cân nhiều người: chia theo tỷ lệ / khối lượng / số công / hệ số / tổ? | Người dùng tự nhập phần KL từng người |
| Q-09 | Ngày công tác có nhãn (QC…) trên dòng CL/PN có được phụ cấp công tác? | Có (mọi dòng có nhãn) |
| Q-10 | Khấu trừ vãng lai 10%: áp dụng mọi khoản hay chỉ khi mỗi lần chi đạt ngưỡng theo quy định hiện hành? | Mọi khoản |
| Q-11 | Bản Google Apps Script (GAS-01): đổi quyền truy cập web app sang chỉ người trong tổ chức / danh sách email? | Đang mở cho mọi người có link |
| Q-12 | Chấm công: 2 dòng cùng NV + cùng hình thức + **cùng ngày** (VD 0,5 + 0,5): là 2 buổi hợp lệ (cộng) hay nhập trùng (lấy 1)? | ✅ **Đã trả lời (10/10/2026): nhập trùng.** Cùng số công → tính 1 lần; khác số công → chặn để người dùng sửa |
| Q-13 | Nhập Excel cập nhật dòng đã có: mặc định **bổ sung** (ô trống giữ dữ liệu) có phù hợp quy trình? Có cần quyền riêng cho chế độ *ghi đè*? | ✅ **Đã trả lời (10/10/2026): cho người dùng lựa chọn khi trùng — Bổ sung hoặc Ghi đè.** Màn hình xem trước báo số dòng trùng và hiện 2 lựa chọn; mặc định Bổ sung; ai có quyền nhập Excel đều chọn được |
| Q-14 | Thay đổi **hồi tố** chạm kỳ đã chốt: chỉ cảnh báo (hiện tại) hay **chặn** và bắt buộc mở chốt? Ai được phép? | ✅ **Đã trả lời: chỉ Admin được phép** — triển khai cùng đăng nhập/phân quyền (PR riêng) |
| Q-15 | Khi đã chốt, có cấm **sửa trực tiếp phụ lục cũ** và bắt buộc lập phụ lục mới không? | ✅ **Đã trả lời: cấm sửa, phải thêm phụ lục mới.** Phụ lục đã dùng tính lương kỳ đã chốt → không ai sửa/xóa được (kể cả Admin), không đổi được Số HĐLĐ, nhập Excel không cập nhật được — R-49 |
| Q-16 | Định dạng "người thực hiện" cho tới khi có đăng nhập: tên tự khai + tài khoản Windows có đủ cho kiểm toán nội bộ? | ✅ **Đã trả lời: cần đăng nhập + phân quyền** — triển khai PR riêng |
| Q-17 | Tiền lương **làm thêm giờ**: hệ số tăng ca đang khai báo (VD 0,5) và việc công tăng ca được tính trong *Tổng công* có bảo đảm mức tối thiểu của Bộ luật Lao động 2019 Điều 98 (≥ 150% ngày thường, 200% ngày nghỉ hằng tuần, 300% lễ/Tết) không? | Giữ nguyên công thức bảng lương gốc — cần kế toán/pháp chế đối chiếu trước khi ban hành Quy chế |
| Q-18 | Chấm công **theo ca**: 1 nhân viên có thể làm **2 ca trong cùng 1 ngày** (VD ca ngày + ca đêm cùng hình thức BT) không? Nếu có, cần thêm cột *Ca* vào khóa chấm công (Kỳ + Mã NV + Hình thức + Ca). Dòng tăng ca (TC) nhập **công** hay **giờ**? | Chưa có khái niệm ca: cùng ngày + cùng hình thức = nhập trùng (Q-12); TC tính như công |
| Q-19 | 1 nhân viên làm cho **2 phòng ban trong cùng tháng** (điều chuyển giữa tháng): chi phí lương chia theo công từng phòng hay ghi toàn bộ cho phòng ở phụ lục cuối? | Lấy phòng ban của phụ lục hiệu lực trong kỳ |
| Q-20 | Tạm ứng / thưởng **không có Số chứng từ**: 2 dòng cùng NV, cùng ngày, cùng số tiền là 2 lần chi hợp lệ hay nhập trùng? Có bắt buộc cột *Số chứng từ* để chống trùng không? | Coi là 2 dòng (cộng) nếu nhập từ form; nhập Excel trùng y hệt bị bỏ qua |
| Q-21 | Ô chấm công **sai đã có sẵn** trong dữ liệu (ngày 31 của tháng 30 ngày, số âm kiểu số): bảng lương có nên **bỏ qua** các ô này không? (Hiện engine vẫn cộng ngày không tồn tại.) | Giữ cách tính cũ, chỉ cảnh báo High |
| Q-22 | Phụ lục tăng lương có hiệu lực **giữa tháng** (VD 16/09): tính cả tháng theo mức mới (hiện tại), mức cũ, hay **chia theo số công trước/sau** ngày hiệu lực? | Cả tháng theo phụ lục mới nhất có hiệu lực trong kỳ |
| Q-23 | BHXH khi **vào làm / nghỉ giữa tháng** hoặc ít công: danh mục mặc định chưa đặt *Ngưỡng truy thu BH (công)* nên 2 công vẫn trừ đủ BH. Kế toán xác nhận ngưỡng áp dụng (theo quy định: không làm việc và không hưởng lương từ 14 ngày làm việc trở lên trong tháng thì không đóng) cho từng mã lương. | Theo danh mục; mặc định không có ngưỡng |
