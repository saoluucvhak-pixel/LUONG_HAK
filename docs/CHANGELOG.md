# CHANGELOG

## [2.0.0-alpha.23] — pre-release V9 (chưa phải bản ổn định; chưa nghiệm thu thực địa trên Windows)
### Chức năng mới
- **Phân quyền do tiến trình chính quyết định**: đăng nhập được kiểm tra tại main (đọc tài khoản trên đĩa, tự băm/so mật khẩu, tự tra vai trò → quyền); giao diện không còn gửi được danh sách quyền. Thu hồi quyền (khóa/đổi vai trò/xóa tài khoản) có hiệu lực ngay; phiên tự hết hạn sau 30 phút không thao tác; chặn khung (iframe) và trang lạ.
- **OCR học từ sửa tên nhân viên**: nhớ “chuỗi tên trên giấy ↔ Mã NV” đã được xác nhận; chỉ chọn sẵn khi đã xác nhận trên ≥ 2 chứng từ, không bao giờ tự chọn khi trùng họ tên hoặc xung đột.
- **Cặp chữ số dễ nhầm** (1/7, 3/8, 0/6, 5/6, X/-) không còn được tự chấp nhận, luôn chuyển sang “gợi ý”.
- **Lưới chấm công** có thêm lọc: hình thức công, dòng có ô lỗi, nguồn OCR (có/không/đã sửa tay sau nhập).
- **Bộ lọc dùng chung** chọn nhiều giá trị (khối, phòng ban, tổ, mã lương, thanh toán, hình thức công, nhân viên), tìm không dấu, lưu bộ lọc.
- **Cache công thức** (AST): 40.000 lượt tính ở 5.000 NV từ 205,6 ms còn 15,7 ms, kết quả không đổi.
### Lỗi đã sửa / chặn
- Bảng lương có **FORMULA_ERROR** không còn xuất được như bản chính thức (Excel/PDF).
- **Khôi phục** kiểm cả nội dung (SHA-256 từng bảng + tổng snapshot kỳ đã chốt), không chỉ số dòng.
- Chống bấm 2 lần: chốt kỳ, nhập Excel; khôi phục không chạy song song.
- Tên người thực hiện ghi vào thư viện OCR / chứng từ / Full Backup lấy từ phiên đã xác thực ở main.
### Thay đổi dữ liệu
- Thêm bảng `ocr_ten` (bộ nhớ tên OCR) và dùng `chungtu_lienket`; không đổi công thức lương, không đổi kỳ đã chốt. Bản sao lưu cũ vẫn nhập được.
### Giới hạn / lỗi đã biết
- Chưa chạy trên máy Windows thật, chưa thử scan viết tay thật; Full Backup còn chạy trên luồng chính (không có nút hủy).
- Nghiệp vụ lương trong giao diện (chốt/mở kỳ, sửa danh mục) vẫn kiểm quyền ở renderer; dữ liệu trên đĩa chưa mã hóa.
- 4 điểm lệch với Excel cần quyết định của quản lý (thuế TNCN có khấu trừ vào thu nhập còn lại, KPCĐ khi tính thuế, truy thu BH, công chuẩn mã CĐ) — xem `LuongHAK_Offline/docs/V9_PAYROLL_RECONCILIATION.md`.
### Nâng cấp / quay lại
- Trước khi cập nhật: **Full Backup** (Công ty & Sao lưu → Full Backup). Cài đè bản mới, dữ liệu ở `%APPDATA%\Tinh Luong HAK` không bị xóa.
- Quay lại bản cũ: cài lại bản trước, dùng Full Backup/Sao lưu tự động trong `backups\` để khôi phục.

## [2.0.0-alpha.22] — 12/10/2026 — OCR: bảng chấm công tay (dấu x, ghi giờ, số ca)
- **Chủ sở hữu duyệt quy ước đọc** (R-69): *"x: 1 công, xx: 2 công, xxx: 3 công, ghi giờ = giờ/8"* và lịch ca *"1 ca = 1 công; "1+2" = 2 công"*.
- Đọc ảnh chấm công → chọn **Cách đọc ô**:
  - **Số công**: như cũ;
  - **Dấu x · giờ / 8**: đếm số dấu x trong ô; ô ghi "7h-15h" thì lấy số giờ / 8, qua đêm được;
  - **Số ca**: "1" / "2" / "3" = 1 công, "1+2" = 2 công, X = nghỉ.
- Chọn cho file mới, hoặc đổi riêng từng trang thì app đọc lại trang đó.
- Bảng dọc mỗi người 1 cột (bảng tay của tổ):
  - tên người lấy từ tiêu đề cột, loại *Chấm công BT*;
  - cột Ngày, Thứ, Ghi chú, Ký tên… bỏ qua;
  - tiêu đề viết tay không đọc được nhưng cột có ≥ 5 ô có số (khi đọc dấu x / số ca) → mặc định *Chấm công BT*, chọn nhân viên bằng tay.
- Bảng **2 khối ngày** đặt cạnh nhau (1–15 | 16–31) ghép đủ tháng theo tên cột, cộng dòng TC của các khối. Ô ngày chia 2 dòng (Ngày / Đêm) thì cộng lại.
- Ô đếm dấu lưng chừng (cụm dính rộng 1,5 dấu, không thấy dấu) tô **vàng**. Ô xem ảnh gốc ghi cách tính ("2 dấu", "giờ 8", "X = nghỉ").
- Sửa:
  - nhãn "TC" ở ô hẹp không còn bị tính thành ngày 31;
  - tiêu đề cột là tên người bị đọc thành số ("6") → đọc lại dạng chữ;
  - kỳ nhận cả "THÁANG 09/2026" (OCR thừa chữ) và "… 10/2026".
- **Chữ viết tay thật vẫn đọc chưa tốt** (ảnh thật của người dùng, chỉ kiểm trên máy kiểm thử): bảng dấu x rõ nét đọc đúng phần lớn, ô ghi giờ viết tay, ô có ghi chú và lịch ca viết tay còn nhiều ô "?" — **luôn soát lại trước khi ghi**.
- **Q-29 đã trả lời** (R-70): thuế TNCN **trừ hằng tháng**; ai không trừ thì chọn mã thuế TNCN *Miễn / Không tính thuế* (TNCN0 / MT00). App vốn đã tính như vậy; thêm test U-TAX-01/02.
- **Chia sản lượng theo chấm công** (R-73, chủ sở hữu duyệt 12/10/2026):
  - Công > 0 ngày cân → chia đều (0,3 hay 1 như nhau). Công = 0 / trống → không chia + cảnh báo "coi như nghỉ nguyên ngày".
  - Vẫn trừ NV vắng trên phiếu và người có đơn nghỉ. Ngày cả tổ chưa nhập chấm công → chia theo NV vắng + cảnh báo.
  - Đối chiếu dữ liệu thật: Đại Hiệp 8/2026 không đổi. CNHAK 9/2026, HAKQN 7/2026, HAK ĐN 11/2025 có người nhận phiếu ngày công trống → số đổi so với Excel cũ (tối đa −341.953đ / người).
- **Người nghỉ không lương / nghỉ phép / nghỉ ốm** (R-72, chủ sở hữu duyệt 12/10/2026):
  - Đơn nghỉ **đã duyệt** tự loại người đó khỏi tổ khi chia sản lượng / bơm dăm các ngày nghỉ, không cần ghi NV vắng. Tính lương ghi rõ "… Nghỉ không hưởng lương (đơn đã duyệt) — không chia N ngày cân".
  - Đơn nghỉ được để trống **Đến ngày** = chưa biết ngày về.
  - Đơn nghỉ phủ kỳ đã chốt được bảo vệ như phụ lục (hồi tố). Bản chốt lưu kèm đơn nghỉ.
- Sửa cảnh báo khi tính lương (chủ sở hữu báo 12/10/2026, CNHAK 9/2026):
  - **NV vắng không khớp ai trong tổ**: cảnh báo ghi đúng tên trên phiếu ("Đức", trước ghi "duc"), và **gộp 1 dòng cho mỗi tổ + tên**: số phiếu, khoảng ngày, vài số phiếu. Trước đó mỗi phiếu 1 dòng, CNHAK 9/2026 có 33 dòng giống nhau. Chi tiết từng phiếu vẫn ở bảng đối soát. Thường là người đã nghỉ việc / chuyển tổ mà phiếu vẫn ghi vắng; phiếu vẫn chia đúng cho người có mặt.
  - **"Có công sau ngày chấm dứt hợp đồng"**: ô chấm công ghi **0** không còn bị tính là có công (Excel CNHAK ghi 0 thay vì để trống).
  - Số tiền không đổi (đối chiếu lại CNHAK 9/2026: tổng thực lĩnh như cũ).
- **Q-31 đã trả lời** (R-71): lương sản lượng làm tròn **1 lần trên tổng tháng**, thống nhất mọi đơn vị (Excel Đại Hiệp cũ làm tròn theo ngày — lệch ≤ 2đ/người, chấp nhận).
- **Không đổi công thức lương.** Test 211 (+6 U-OCR, +2 I-OCR, +2 U-TAX, +1 U-QC, +4 U-PA, +1 U-LV, +1 U-GRD), E2E 95/95 (+1).

## [2.0.0-alpha.21] — 11/10/2026 — Quy chế lương HAK Group 2026 (engine 1.8.0)
- **Chủ sở hữu duyệt: HAK, CNHAK, HAKQN cùng một quy chế lương** (R-68). Engine 1.8.0 thêm *Quy chế lương HAK Group 2026* — **mặc định** cho kỳ chưa chốt: (C1) lương thời gian trả đủ công đi làm, (C2) công chuẩn = số ngày − *Số ngày giảm trừ* (TG3 = 26 thay vì 22), (C3) công nhân sản phẩm chỉ hưởng lương thời gian cho công lễ / phép, (C4) bù bình quân tổ chỉ tính tiền sản lượng, (C5) công nhật tính tăng ca theo công thức mã tăng ca (× 50%), (C6) phụ cấp không ghi cách tính thì chia theo công, (C7) trừ KPCĐ 0,5% phần người lao động, (C8) chưa có Lương cơ bản thì không tính BH / truy thu, (C9) công nhật: công chuẩn = số ngày − Số ngày giảm trừ, (C10) công tăng ca mã TC5 (ca vị trí khác) không cộng vào lương thời gian.
- Kiểm bằng bảng lương thật (chỉ trên máy kiểm thử, không đưa vào repo): **HAK ĐN 11/2025 61/61**, **Đại Hiệp 8/2026 38/45** (7 người lệch 2đ làm tròn), **CNHAK 9/2026 42/44**, **HAKQN 7/2026 31/50** người khớp từng đồng; người còn lại lệch đúng phần thuế TNCN (Excel CNHAK / HAKQN không trừ, Đại Hiệp có trừ — app trừ, chờ xác nhận Q-29).
- Phân bổ khối lượng: NV vắng so **có dấu** trước — "Tưởng" vắng không còn kéo theo "Tường" cùng tổ (lỗi làm 1 công nhân HAKQN mất ~10 triệu sản lượng 7/2026); gõ không dấu vẫn nhận.
- **Tính lương → Quy chế tính lương**: chọn *Quy chế 2026* hoặc *Cách tính cũ (1.7)* để đối chiếu; lưu theo dữ liệu, cần quyền *Sửa danh mục*, ghi nhật ký. Bản chốt ghi quy chế đã dùng; kỳ đã chốt **không đổi số**; "Đối chiếu với dữ liệu hiện tại" dùng đúng quy chế lúc chốt.
- Danh mục mã lương thêm cột **Số ngày giảm trừ** (TG3 4, TG4 2, CN2 4); nhập Excel nhận cả tên cột "Ngày giảm trừ". Báo cáo bảo hiểm có cột NLĐ.KPCĐ.
- Sửa: "Lưu hồ sơ công ty" không còn xóa các trường ngoài form.
- Test: 194 (+11 U-QC, +1 U-PA; hồi quy v1.3.0 / alpha.4 vẫn trùng 100% ở cách tính cũ), E2E 94/94 (+3).

## [2.0.0-alpha.20] — 11/10/2026 — Đọc ảnh / PDF bảng chấm công, chấm cơm (OCR offline)
- Menu **Nhập liệu hàng tháng → 📷 Đọc ảnh chấm công**: chọn **ảnh chụp (JPG, PNG) hoặc PDF quét** (nhiều file, PDF tối đa 30 trang). App tự xoay ảnh về đúng chiều, tìm các ô theo đường kẻ, đọc chữ / số từng ô bằng **Tesseract chạy offline trên máy** (không gửi ảnh ra mạng, không lưu ảnh), dựng **bảng xem như Excel** sửa được ngay trong app.
- Đọc được 2 kiểu bảng: **dòng = người, cột = ngày 1…31** (có Tổng công / Tổng cơm, dòng Công / Tăng ca) và **dòng = ngày, cột = Công / Cơm** ("Lịch làm …", dòng TC). Tự nhận kỳ trong tiêu đề ("Tháng 09/2026"), tự gợi ý nhân viên theo tên (bỏ "anh / chú / cô"; không chắc thì để người dùng chọn).
- Đọc **nhiều ảnh / nhiều PDF** một lần (mỗi trang 1 thẻ, mỗi trang chọn kỳ riêng). Nút **■ Dừng đọc**: dừng sau lô ô đang đọc, trang đã đọc giữ nguyên, trang chưa đọc đánh dấu ■ — bấm *Đọc lại* để đọc riêng trang đó.
- Ô nghi ngờ tô **vàng** (OCR không chắc, nhận theo nét "1" viết tay, giá trị > 3), ô không đọc được có **?**, dòng **lệch tổng trên giấy** tô đỏ; bấm ô xem ảnh gốc của ô đó. Xoay trái / phải, đọc lại từng trang.
- **⬇ Xuất Excel** (mỗi trang 1 sheet) và **✔ Đưa vào Chấm công / Suất cơm…** — ghi **qua màn hình xem trước như nhập Excel** (kiểm tra kỳ đã chốt, chọn bổ sung / thay thế, ghi nhật ký). Dòng chưa chọn nhân viên / còn ô "?" bị bỏ qua và được báo.
- Kèm thư viện offline: tesseract.js 5.1.1 (Apache-2.0), dữ liệu ngôn ngữ vie + eng (tessdata_best_int), pdf.js 3.11.174 (Apache-2.0, chạy với `isEvalSupported: false` + CSP không eval).
- Giới hạn: chữ in / bảng quét đọc tốt; **chữ viết tay và ảnh chụp nhỏ, nghiêng đọc kém** — luôn phải xem lại. Giấy tăng ca, xác nhận vân tay, sổ xe… (không phải bảng kẻ ô theo ngày) không đọc tự động.
- **Không đổi công thức lương.** Test: 182 (+8 U-OCR, +4 I-OCR chạy Tesseract thật trên ảnh mẫu giả lập), E2E 91/91 (+9). CI: bước tự kiểm OCR trong bản đóng gói Windows.

## [2.0.0-alpha.19] — 11/10/2026 — Phân bổ khối lượng như công cụ HAK (engine 1.7.0)
- **Chia phiếu cân theo tổ** như công cụ "Phân bổ khối lượng tính lương": phiếu ghi **Mã phòng ban** + **NV vắng** → chia đều cho người của tổ có mặt ngày cân (đã vào làm, chưa nghỉ việc, đúng tổ theo phụ lục ngày đó), trừ người vắng (tên cuối hoặc Mã NV). Phiếu ghi Mã NV vẫn giao trực tiếp. Phiếu không chia được → "chưa phân bổ" + cảnh báo. Áp dụng cho Sản lượng và Bơm dăm.
- **2 cách bù lương của công cụ** (chọn ở Tính lương): **theo ngày — bậc thang (Đại Hiệp)** và **theo bình quân tổ**. Đối chiếu từng trường hợp với công thức của công cụ: trùng 100%. 2 cách bù cũ giữ nguyên số. Danh mục Mã lương thêm cột *Ngưỡng công bù theo tổ*; danh mục chuẩn: SP mức sàn 200.000đ/công, ngưỡng 15 công (như công cụ).
- **Biểu mẫu như công cụ** (ExcelJS 4.4.0): *Tải file mẫu* ở Sản lượng / Bơm dăm = đúng mẫu công cụ; *Nhập Excel* đọc được file mẫu công cụ (dòng tiêu đề phía trên, "Ngày cân 1", "Biển số 1", "Số xe", "Mã phòng ban", "NV vắng"). **Báo cáo lương → Phân bổ sản lượng → Xuất Excel (mẫu công cụ phân bổ)**: Hướng dẫn, Tổng hợp phòng ban, Phân bổ theo ngày, Chi tiết công nhân, Đối soát phiếu cân, BD…, Tiền lương và bù lương, Dữ liệu gốc — tiêu đề, màu, khối chữ ký như công cụ.
- Kỳ đã chốt giữ nguyên số (lưu cả cách bù đã dùng). Test: 170 (+8 U-PA), E2E 82/82 (+6).

## [2.0.0-alpha.18] — 11/10/2026 — Sổ lao động đủ thông tin + Báo cáo bảo hiểm + Phiếu lương
- **Thêm nhân viên** có đủ trường của sổ quản lý lao động: Quốc tịch (điền sẵn "Việt Nam", sửa được), Dân tộc, Mã số thuế, Số sổ BHXH, mục **Trình độ** (trình độ học vấn / chuyên môn, bậc kỹ năng nghề, bằng cấp). Vị trí việc làm vẫn ở phần Lương.
- **Sổ quản lý lao động** báo **ai còn thiếu thông tin bắt buộc** (giới tính, ngày sinh, quốc tịch, CCCD, nơi cư trú, trình độ, HĐLĐ, lý do chấm dứt, vị trí việc làm, mức đóng BH, số sổ BHXH) — bấm mục để mở đúng tab hồ sơ bổ sung. Mục "nếu có" (bậc nghề, nâng lương, đào tạo, kỷ luật, tai nạn) không coi là thiếu.
- **Báo cáo lương → 🛡 Báo cáo bảo hiểm** theo kỳ: tổng hợp theo khoản (BHXH, BHYT, BHTN, KPCĐ — công ty / NLĐ), tăng / giảm / điều chỉnh mức đóng so với kỳ trước, theo phòng ban, chi tiết từng người; xuất Excel 4 sheet. Chỉ cộng số engine đã tính (không tính lại); báo cáo nội bộ, **không thay mẫu chính thức** D02-LT / C12-TS.
- **🧾 Phiếu lương** thành mục riêng trong menu: kỳ đã chốt lấy đúng bảng đã chốt (chưa chốt → báo tính tạm), lọc phòng ban, tìm mã / tên (không dấu), in mỗi phiếu 1 trang hoặc **in gọn** nhiều phiếu / trang, **xuất Excel** phiếu lương. Nhật ký ghi lần in / xuất.
- **Không đổi công thức lương.** Test: 162 (+3 U-BHR, +1 U-SLD-05), E2E 76/76 (+4).

## [2.0.0-alpha.17] — 11/10/2026 — Lịch sao lưu + đối chiếu nghỉ phép / ốm
- **Lịch sao lưu tự động** (Công ty & Sao lưu, Admin đổi): sao lưu **định kỳ** khi app đang mở (tắt / 1 / 2 / 4 / 8 giờ, mặc định 2 giờ), **sao lưu khi đóng app** (mặc định bật), **số ngày giữ bản đầu ngày** (30 / 60 / 90 / 180 / 365, mặc định 60). Chỉ sao lưu khi dữ liệu đã đổi so với bản gần nhất (không tạo bản trùng); có thư mục thứ hai thì tự chép sang. Cấu hình theo máy (`settings.json`). Bản định kỳ giữ 48, bản khi đóng app giữ 10; bản sau chốt kỳ vẫn giữ vĩnh viễn.
- **Q-27 = phương án A — đối chiếu đơn nghỉ với chấm công** (R-64): khi tính lương, khung *Hồ sơ cần bổ sung* báo đơn phép có lương đã duyệt mà chưa chấm PN / vẫn chấm công thường, đơn nghỉ không lương / nghỉ ốm đã duyệt mà vẫn có công, chấm PN không có đơn, đơn còn *Chờ duyệt*. **Chỉ cảnh báo — lương vẫn tính theo chấm công, không đổi công thức.**
- Test: 158 (+5 U-SCH, +5 U-LV), E2E 72/72 (+3).

## [2.0.0-alpha.16] — 11/10/2026 — Shortcut chuyên nghiệp + File đã tải
- **Bộ cài**: icon riêng của app (HAK · LƯƠNG), shortcut **"Tính Lương HAK"** ngoài Desktop và trong Start Menu (thư mục *HAK*), cho chọn thư mục cài, tự chạy app sau khi cài, tên trong *Apps & features* là "Tính Lương HAK <phiên bản>". Gỡ cài đặt **vẫn không xóa dữ liệu**. Tên sản phẩm nội bộ giữ nguyên nên thư mục dữ liệu `%APPDATA%\Tinh Luong HAK` không đổi.
- **Tải file (Excel, báo cáo, phiếu lương, file Word, sao lưu ra file)**: lưu thẳng vào thư mục **Tài liệu\Tinh Luong HAK\File xuat** (không hỏi nơi lưu, **không ghi đè** — trùng tên thêm "(1)", "(2)"). Tải xong app **mở thư mục, chọn sẵn file** và hiện thẻ báo có nút **Mở file** / **Mở thư mục**.
- Nút **📂 File đã tải** (thanh trên, Ctrl+K): danh sách file mới nhất, mở file / mở thư mục từng file, **Đổi thư mục lưu…** (hộp chọn thư mục của Windows), *Dùng thư mục mặc định*, bật / tắt *Tự mở thư mục sau mỗi lần tải*. Cấu hình theo máy (`settings.json`).
- An toàn: giao diện chỉ gửi **tên file**; app chỉ mở file nằm trong thư mục lưu và đúng loại app xuất ra (xlsx, xls, csv, pdf, doc, docx, json, txt) — không mở .exe / file ngoài thư mục.
- Thanh trên cùng gọn hơn trên laptop 1366px (Tìm kiếm và Đổi mật khẩu thành nút icon).
- **Không đổi công thức lương / dữ liệu.** Test: 148 (+5 U-EX), E2E 69/69 (+5).

## [2.0.0-alpha.15] — 11/10/2026 — Giao diện 2.0 + tăng lương / biến động nhân sự
- **Giao diện mới** cùng bộ màu với app *Quản lý xuất hàng* (xanh ngọc #0e7c86, menu xanh than, nền #f3f6fa) — chủ sở hữu duyệt bản mẫu. **Chế độ sáng / tối** (nhớ theo máy).
- Thanh trên cùng: **Tìm kiếm Ctrl+K** (màn hình, nhân viên, báo cáo; gõ không dấu), kỳ lương, vai trò, đăng xuất, nút sáng / tối. Menu nhóm lại.
- **Tổng quan** mới: banner kỳ lương, các bước, ô Mở nhanh, *Cần xử lý trước khi chốt*, *An toàn dữ liệu* (giữ đủ lời nhắc sao lưu).
- **Chấm công** tô màu ô theo số công / loại dòng (PN, CL, TC, có nhãn, không đọc được số) — chỉ hiển thị.
- **Hồ sơ**: sửa trong ngăn kéo bên phải có khung **"Sẽ lưu N thay đổi"** (cũ → mới, ô đã đổi viền vàng). Thông tin cá nhân / tài khoản: chọn **Thông tin mới** (thêm bản mới, giữ bản cũ) hoặc **Sửa lỗi nhập sai**. Bản ghi bị khóa (Q-15, kỳ chốt) báo ngay khi mở.
- **Tăng lương / biến động**: lập phụ lục mới từ phụ lục hiện tại, chọn loại biến động, % thay đổi, ghi chú điều chỉnh mức đóng BH. Phụ lục có thêm *Loại biến động*, *Số quyết định* (không bắt buộc, không dùng trong công thức).
- **Lịch sử nhân viên**: quá trình lương + dòng thời gian thay đổi từ nhật ký (lọc theo phần; che số tiền khi không có quyền xem lương).
- **Báo cáo Biến động nhân sự** theo khoảng tháng: tăng mới, nghỉ việc (lý do), tăng / giảm lương (+%), điều chuyển, đổi chức vụ, mức đóng BH — tự nhận biết, dữ liệu cũ không phải nhập lại.
- **Cảnh báo có công sau ngày chấm dứt hợp đồng** khi tính lương (chỉ cảnh báo, số tiền không đổi).
- **Không đổi công thức lương** — hồi quy v1.3.0 / alpha.4 trùng 100%. Test: 143 (+3 U-BD, +1 I-23), E2E 64/64 (+6).

## [Chưa phát hành] — Q-26
- Chủ sở hữu chọn **phương án A** cho BH tháng nghỉ việc: giữ nguyên quy tắc R-57 (quy chế R-60). **Không đổi công thức**; thêm test I-22 khóa hành vi.

## [2.0.0-alpha.14] — 11/10/2026 — Sổ quản lý lao động theo NĐ 145/2020 Điều 3
- **Sổ quản lý lao động** (Báo cáo nhân sự) chọn **năm**, có đủ nội dung khoản 2 Điều 3 Nghị định 145/2020/NĐ-CP. Các cột cũ giữ nguyên, thêm: quốc tịch, chuyên môn, bậc kỹ năng nghề, vị trí việc làm, ngày bắt đầu làm việc, mức đóng BHXH, nâng bậc / nâng lương trong năm, nghỉ hằng năm / việc riêng có lương / không lương / ốm, làm thêm (công TC), đào tạo, kỷ luật & trách nhiệm vật chất, tai nạn LĐ / bệnh nghề nghiệp, ngày + lý do chấm dứt HĐ.
- Hồ sơ thêm: *Bậc trình độ kỹ năng nghề* (Học vấn), *Vị trí việc làm* (Phụ lục HĐ), *Lý do chấm dứt* (Hợp đồng), *Loại nghỉ* (Đơn nghỉ — trống = nghỉ hằng năm), *Hình thức kỷ luật* + *Bồi thường thiệt hại* (Nội quy).
- 2 tab hồ sơ mới: **🎓 Đào tạo / nâng cao trình độ**, **🚑 Tai nạn lao động / Bệnh nghề nghiệp** (nhập tay, nhập Excel).
- Báo cáo nghỉ phép: chỉ nghỉ hằng năm trừ phép; tách 2 cột việc riêng có lương / không lương.
- **Không đổi công thức lương** — hồi quy v1.3.0 và alpha.4 trùng 100%.
- Test: 137 (+4 U-SLD), E2E 55/55.

## [2.0.0-alpha.13] — 11/10/2026 — Sao lưu ra ngoài máy (A + B + D)
- **(A) Thư mục sao lưu thứ hai**: Admin chọn USB / ổ mạng / thư mục Google Drive đồng bộ bằng hộp chọn thư mục của Windows. Mọi bản sao lưu tự chép sang và **đọc lại kiểm SHA-256**. USB rút ra / ổ mạng mất kết nối → sao lưu trên máy vẫn bình thường, app báo lỗi và có nút *Chép sang thư mục thứ hai ngay*.
- **(B) Bản sao lưu sau chốt kỳ** `sau-chot-<kỳ>`: tạo ngay khi chốt, **giữ vĩnh viễn** (không bị dọn), tự chép sang thư mục thứ hai.
- **(D) Nhắc nhở**: chưa từng / quá 7 ngày chưa sao lưu ra ngoài máy → Trang chủ cảnh báo (người có quyền sao lưu / Admin).
- Cấu hình thư mục là của **từng máy** (`settings.json`), không nằm trong `data.json`.
- Test: 133 (+4 U-MIR), E2E 55/55 (+4).

## [2.0.0-alpha.12] — 11/10/2026 — Q-19: chia chi phí lương theo phòng ban khi điều chuyển (engine 1.6.0)
- Nhân viên đổi phòng ban trong tháng (phụ lục mới đổi *Phòng ban*) → báo cáo **Tổng hợp theo phòng ban** và **Bảng hạch toán** chia chi phí theo **số công làm ở từng phòng**:
  - thu nhập, BH NLĐ, BH công ty, thuế, tạm ứng, thực lĩnh;
  - mỗi phòng vào đúng TK chi phí (622 / 641 / 642…).
- Tổng các phòng luôn bằng tổng bảng lương. **Số tiền lương từng người không đổi.**
- Màn hình Tính lương có dòng thông báo người được chia và tỷ lệ.
- Kỳ chốt trước bản này giữ báo cáo cũ. Người không điều chuyển: báo cáo y hệt trước (U-ALLOC-04).
- Q-04 / Q-23 / Q-25 (chủ sở hữu xác nhận): giữ công thức BH dưới ngưỡng; ngưỡng khai ở Danh mục Mã lương (R-57) — gỡ đánh dấu "cần quyết định" trong quy chế.
- I-21: chứng minh công thức truy thu BH tự áp dụng ngay khi khai ngưỡng trong danh mục (danh mục mẫu trống là thiếu dữ liệu, không phải thiếu công thức).
- `core/allocation.js` (mới). Test: 129 (+4 U-ALLOC, +1 I-21), E2E 51/51.

## [2.0.0-alpha.11] — 11/10/2026 — Q-22: chọn cách áp dụng phụ lục giữa tháng (engine 1.5.0)
- Phụ lục có thêm ô **Cách áp dụng trong tháng hiệu lực**:
  - *Cả tháng* (mặc định, để trống = như cũ);
  - *Từ ngày hiệu lực*: công trước ngày hiệu lực tính theo lương thỏa thuận cũ, công từ ngày hiệu lực tính theo mức mới (cùng mã lương).
  - BH theo phụ lục đang hiệu lực. Khác mã lương thì không chia và có cảnh báo.
- Ví dụ: 20 tr → 26 tr từ 16/09 → lương tháng 9 = 23.000.000 (trước đây 26.000.000).
- Quy chế trong app, hướng dẫn và `PAYROLL_FORMULAS.md` §4a đã cập nhật; Q-01 = Q-22 đã trả lời.
- **Không đổi** kết quả của mọi phụ lục không chọn *Từ ngày hiệu lực*: hồi quy v1.3.0 và alpha.4 trùng 100%.
- Test: 124 (+5 U-PL), E2E 51/51 (+1).

## [2.0.0-alpha.10] — 11/10/2026 — Q-20 Số chứng từ; ghi nhận câu trả lời Q-18, Q-19, Q-21, Q-22, Q-23
- **(Q-20) Số chứng từ** cho *Thưởng / Trừ* và *Tạm ứng*. Cột mới, không bắt buộc.
  - Nhập lại file có cùng *Số chứng từ + Mã NV* thì **cập nhật**, không cộng thêm. Bản cũ: nhập lại file tạm ứng đã sửa số tiền thì thành 2 khoản.
  - Lưới chặn dòng trùng số chứng từ.
  - *Kiểm tra dữ liệu* báo **High** khi một số chứng từ có nhiều dòng cho cùng NV, **Medium** khi có dòng giống hệt nhau mà chưa có số chứng từ.
  - Nhập Excel nhắc ghi số chứng từ.
- Ghi nhận câu trả lời của chủ sở hữu:
  - R-52 (Q-18): nhiều ca / ngày phân biệt bằng mã chấm công;
  - R-55 (Q-21): giữ nguyên cách tính ô sai cũ, chỉ cảnh báo.
- Đang triển khai: R-53 (Q-19) chia chi phí theo phòng ban; R-56 (Q-22) chọn cách áp dụng phụ lục giữa tháng.
- Q-23: đã kiểm tra danh mục và công thức → câu hỏi tiếp **Q-25**.
- Test: 119 (+4 U-CT), E2E 50/50.

## [2.0.0-alpha.9] — 11/10/2026 — Q-24 bảo mật lương cá nhân
- (Q-24, chủ sở hữu duyệt) **Ẩn Lương thỏa thuận / Lương cơ bản** với người không có quyền *Xem bảng lương* và không có quyền *Sửa hồ sơ*. Với vai trò mặc định, chỉ **Trưởng bộ phận** bị ẩn. Áp dụng ở:
  - danh sách Nhân sự (bỏ cột);
  - đầu hồ sơ;
  - bảng *Lương & phụ lục HĐ* (hiện `🔒 ẩn`);
  - form phụ lục (không hiện ô lương);
  - báo cáo *Sổ lao động* và *Lịch sử*;
  - **Giá trị tiền thưởng** trong hồ sơ *Khen thưởng* (chủ sở hữu duyệt bổ sung).
- Quy tắc R-51. Không đổi dữ liệu, công thức hay quyền khác.
- Test: 115 (+2 U-PAY), E2E 50/50 (+3).

## [2.0.0-alpha.8] — 11/10/2026 — PR5 giao diện: bảng lớn, tìm kiếm, bàn phím
- **PERF-03 (High)**: lưới nhập liệu vẽ toàn bộ dòng của kỳ. Ở 1.000 NV, mở *Chấm công* mất 5,6–6,9 giây, gõ 4 ký tự tìm kiếm mất 19 giây; ở 5.000 NV app treo. Nay:
  - **chia trang** (50/100/200/500 dòng, mặc định 100) → mở lưới 0,3 giây, kết quả lọc 0,4–0,55 giây;
  - tìm kiếm chỉ chạy khi ngừng gõ;
  - áp dụng cả cho danh sách *Nhân sự*.
- **Ô tìm kiếm nhớ riêng từng bảng**: khi chuyển màn hình hoặc mở lại app vẫn giữ; số dòng hiện "đang lọc …" để không bị nhầm là mất dữ liệu.
- **Bàn phím**: Enter = xuống ô cùng cột dòng dưới, Shift+Enter = lên; Ctrl+F = vào ô tìm kiếm.
- `tests/perf/ui-bench.js`: đo giao diện trên Electron thật.
- Câu hỏi mới **Q-24** (Trưởng bộ phận đang xem được lương thỏa thuận).
- Test: 113 unit/integration/regression, E2E 47/47 (+4).

## [2.0.0-alpha.7] — 11/10/2026 — PR4 lưu dữ liệu nhanh hơn (PERF-02)
- Lưu dữ liệu: bước đọc lại để xác nhận đĩa ghi đúng nay **so sánh từng byte** thay vì giải mã UTF-8 + 2 lần SHA-256. Mức kiểm tra chặt như cũ.
- 5.000 NV: lưu **243 → 110 ms**; 1.000 NV: 50 → 24 ms. Mọi kiểm tra an toàn khác giữ nguyên.
- Chưa chuyển sang SQLite: đo cho thấy phần lớn thời gian còn lại nằm ở giao diện. Điều kiện chuyển đổi được cập nhật trong `MIGRATION_PLAN.md` §2; chi tiết ở `PERFORMANCE_REPORT.md` §6.
- Test: 113 (+1 U-STO-17), E2E 43/43.

## [2.0.0-alpha.6] — 10/10/2026 — PR3 tầng repository
### Sửa lỗi
- **A3-01 (High)**: sửa *Số HĐLĐ* của hợp đồng có hiệu lực trong kỳ đã chốt, rồi bị chặn (không phải Admin) hoặc bấm **Hủy** ở hộp xác nhận → phụ lục lương, nghỉ phép… của hợp đồng **đã bị đổi sang số mới** trong khi hợp đồng giữ số cũ → phụ lục "mồ côi", không được tính lương. Nguyên nhân: đổi bảng con **trước** khi kiểm tra hồi tố. Nay chỉ đổi sau khi mọi kiểm tra đã qua và người dùng đồng ý.
### Thay đổi
- `core/repository.js`: 1 cửa ghi dữ liệu (`plan` → xác nhận → `apply`) cho lưới nhập liệu, form hồ sơ, xóa hồ sơ. Không đổi quy tắc nghiệp vụ, không đổi công thức.
- Nhật ký thêm: dán dữ liệu danh mục hồi tố (Admin) nay được ghi nhật ký như sửa từng ô.
- Test: 112 (+8 U-REPO), E2E 43/43 (+1 A3-01).

## [2.0.0-alpha.5] — 10/10/2026 — PR2 hiệu năng (PERF-01)
- Chỉ mục Mã NV (`HR.buildIndex`) cho dựng danh sách lương, danh sách Nhân sự, báo cáo nhân sự. Ở 5.000 NV:
  - dựng danh sách lương **1.175 → 22 ms**;
  - danh sách Nhân sự **550 → 12 ms**;
  - báo cáo nhân sự **1.952 → 54 ms**.
- Kết quả **giống hệt** bản alpha.4 (test so sánh với bản lưu nguyên `baseline_2.0.0-alpha.4/hr.js`). Không đổi engine, không đổi dữ liệu.
- `tests/perf/bench.js` đo thêm danh sách Nhân sự, báo cáo; `HR_IMPL=` để so bản cũ. `docs/PERFORMANCE_REPORT.md`.
- Test: 104 (+3 R-PERF), E2E 42/42.

## [2.0.0-alpha.4] — 10/10/2026 — Audit V2: kiểm tra ô ngày chấm công, kịch bản tính lương
### Sửa lỗi (chi tiết, bằng chứng: `AUDIT_V2.md` §2)
- **A2-01/02 (High)**: ô chấm công số âm (`-1`), chữ lạ (`1.5.2`, `#`) trước đây được nhập không báo lỗi → nay **từ chối** khi nhập Excel, gõ trên lưới và dán Ctrl+V.
- **A2-03 (High)**: ngày không có trong tháng (31/09, 29/02 năm thường) được nhập và **được trả lương** → nay chặn nhập; lưới khóa cột ngày không tồn tại; dữ liệu cũ được *Kiểm tra dữ liệu* báo **High** và hộp chốt kỳ báo số ô sai. Cách tính với dữ liệu cũ giữ nguyên chờ **Q-21**.
- **A2-06 (High)**: dán Ctrl+V ô sai định dạng vẫn ghi vào dữ liệu → nay không ghi ô sai.
- **A2-04/05 (Medium)**: xem trước nhập Excel có cột **Cảnh báo** (quá 3 công/ngày, nhãn chưa có mã phụ cấp).
### Thêm
- `VAL.dayCell()`, `VAL.daysInKy()` (`core/validate.js`) — 1 quy tắc dùng chung cho nhập Excel, lưới, dán, kiểm tra dữ liệu, chốt kỳ (R-03d).
- Test kịch bản tính lương I-15…I-20 (vào/nghỉ giữa tháng, nhiều tạm ứng/thưởng, trừ vượt thu nhập, phụ lục giữa tháng) — số tính tay, **không đổi công thức**.
- `docs/AUDIT_V2.md`: kiến trúc, danh sách vấn đề, rà soát 13 đường ghi dữ liệu, đánh giá thư viện Excel.
- Câu hỏi mới **Q-18…Q-23** (ca làm việc, 2 phòng ban, chứng từ tạm ứng, ô sai cũ, phụ lục giữa tháng, ngưỡng BH).
- Test: 101 unit/integration/regression (+5 U-CC, +6 I), E2E 42/42 (+2).

## [2.0.0-alpha.3] — 10/10/2026 — Hướng dẫn trong app, Quy trình tính lương, Dự thảo Quy chế trả lương
- Menu mới **Hướng dẫn & Quy chế** (`ui/guide.js`) gồm:
  - Bắt đầu nhanh;
  - **Quy trình tính lương hằng tháng**: 9 bước, ghi vai trò phụ trách, kèm cách điều chỉnh sau chốt;
  - **Dự thảo Quy chế trả lương**;
  - Hướng dẫn từng màn hình;
  - Câu hỏi thường gặp.
- **Dự thảo Quy chế trả lương**:
  - Gồm 7 chương: căn cứ, nguyên tắc, hình thức lương, chấm công, phụ cấp/hỗ trợ/tăng ca, BH/KPCĐ, thuế TNCN, khấu trừ/thực lĩnh/kỳ hạn trả, chốt và điều chỉnh, hiệu lực.
  - Bảng số liệu sinh **trực tiếp từ danh mục có hiệu lực của kỳ đang chọn**; cách tính mô tả **đúng công thức engine** (có test đối chiếu).
  - Đánh dấu rõ các điểm **[cần quyết định]** (Q-01…Q-10, Q-17).
  - **In** được (định dạng văn bản, ẩn menu) và **tải file Word (.doc)** để chỉnh sửa rồi ban hành.
- Câu hỏi mới **Q-17**: đối chiếu hệ số tăng ca với mức tối thiểu ở Điều 98 Bộ luật Lao động 2019.
- `docs/QUY_TRINH_TINH_LUONG.md`. Lint bao phủ thêm thư mục `ui/`.
- Test: 90 unit/integration/regression (+3 U-GUIDE), E2E 40/40 (+1).

## [2.0.0-alpha.2] — 10/10/2026 — Đăng nhập & phân quyền (Q-14, Q-16) · quy tắc chấm công Q-12
### Thêm mới
- **Đăng nhập** bắt buộc.
  - Lần đầu: tạo Admin + **mã khôi phục**.
  - Mật khẩu băm PBKDF2-SHA256 (210.000 vòng, muối riêng).
  - Sai 5 lần → chờ 30 giây; 30 phút không thao tác → tự đăng xuất.
  - Đổi mật khẩu; mật khẩu tạm bắt buộc đổi; quên mật khẩu Admin → dùng mã khôi phục (cấp mã mới).
- **7 vai trò** theo Master Prompt 2.0 §9. Quyền kiểm tra ở **tầng nghiệp vụ** (`core/permissions.js`).
  - **Chỉ Admin** sửa dữ liệu hồi tố, mở chốt, khôi phục dữ liệu, quản trị người dùng.
  - Nhân sự không xem bảng lương.
  - Kế toán lương chốt nhưng không mở chốt.
- Màn hình **Người dùng & phân quyền** (Admin): thêm, sửa vai trò, khóa, đặt lại mật khẩu, cấp lại mã khôi phục. Không thể khóa hoặc hạ quyền Admin cuối cùng.
- Nhật ký ghi tài khoản đăng nhập. Thêm thao tác đăng nhập, đăng xuất, quản trị người dùng.
### Thay đổi
- **Q-15**: phụ lục HĐ đã dùng tính lương kỳ đã chốt → không ai sửa/xóa được (kể cả Admin); không đổi được Số HĐLĐ hoặc xóa hợp đồng chứa nó; nhập Excel không cập nhật được → phải **thêm phụ lục mới**.
- **Q-13**: nhập Excel có dòng trùng → màn hình xem trước báo số dòng trùng và cho chọn **Bổ sung** / **Ghi đè** (nút chọn rõ ràng thay cho ô thả xuống).
- Sửa: đổi Số HĐLĐ từng kéo theo phụ lục **trước khi** kiểm tra quyền — nay kiểm tra quyền và khóa trước mọi thay đổi.
- Q-12: chấm công cùng ngày + cùng hình thức = **nhập trùng** → cùng số công tính 1 lần, khác số công báo xung đột (nhập Excel + công cụ gộp).
- Bỏ ô "Người đang sử dụng máy này" (thay bằng đăng nhập).
### Sửa lỗi
- Xóa nhân viên: cần quyền, có sao lưu và nhật ký; nhân viên đã có trong bảng lương đã chốt → chỉ Admin xóa được. (BUG-040)
- *Xóa toàn bộ dữ liệu* giữ lại tài khoản và nhật ký. (BUG-041)
### Kiểm thử
- 87 unit/integration/regression (+8 phân quyền, +1 Q-15).
- 39 E2E (+12): Q-15 (Admin không sửa được phụ lục đã chốt, thêm phụ lục mới được), tạo Admin, khóa khi sai mật khẩu, bắt buộc đổi mật khẩu tạm, menu theo vai trò, chặn mở chốt, chặn sửa hồi tố (Admin được), mật khẩu đã băm, nhật ký theo tài khoản, mã khôi phục.

## [2.0.0-alpha.1] — 10/10/2026 — 2.0 giai đoạn ưu tiên 1: sửa lỗi dữ liệu, chốt kỳ, sao lưu
Chi tiết: `AUDIT_REPORT.md` §6, `BUG_FIX_REPORT.md` (phần 2.0). **Công thức tính lương không đổi**: hồi quy so với v1.3.0 vẫn trùng 100%.

### Sửa lỗi — mất dữ liệu
- Nhập Excel bổ sung không còn **xóa ô đang có** khi ô trong file để trống. Ví dụ: file ngày 16–30 không còn xóa ngày 1–15; file Nhân viên thiếu CCCD không còn xóa CCCD. (BUG-022)
- Bảng dữ liệu sai cấu trúc không còn bị thay bằng bảng rỗng. File của phiên bản mới hơn không còn bị ghi đè. Dữ liệu trình duyệt bị hỏng không còn bị ghi đè. (BUG-026/027/028)
- Màn hình khôi phục chỉ cất file hỏng **sau khi** bạn xác nhận khôi phục. (BUG-029)
- Bản sao lưu không còn ghi đè nhau khi tạo trong cùng 1 giây. Có **mã kiểm tra SHA-256**; bản sao lưu bị hỏng hoặc bị sửa **không được khôi phục**. Ghi an toàn có đọc lại để xác minh. Thông báo rõ khi đầy ổ đĩa hoặc không có quyền ghi. Không bao giờ xóa bản sao lưu tốt cuối cùng. (BUG-030…033)

### Sửa lỗi — sai lương
- Chấm công tách nhiều dòng cùng người, cùng hình thức trong 1 file → **gộp theo ngày**, không mất công. Trùng ngày → báo xung đột, không đoán. (BUG-021)
- Nhập lại khi dữ liệu đang có dòng trùng khóa → chặn, có nút **Gộp dòng chấm công trùng**. "bt" / "BT" / để trống và "2026-9" / "2026-09" được nhận là cùng bản ghi → hết cộng đôi. (BUG-023/024)

### Kiểm soát kỳ đã chốt & truy vết
- Phân loại mọi thay đổi theo 3 nhóm:
  - **dữ liệu kỳ đã chốt**: chặn;
  - **hồi tố**: cảnh báo + nhật ký trước/sau, nhãn HỒI TỐ;
  - **không ảnh hưởng**.
  
  Áp dụng cho: form hồ sơ, xóa hồ sơ, danh mục, cho nghỉ việc, nhập Excel. (BUG-035)
- Không đổi được Mã NV đã có trong bảng lương đã chốt. Đổi Mã NV không bao giờ sửa dữ liệu của kỳ đã chốt. (BUG-034)
- Ghi **người thực hiện** (tên khai trên máy + tài khoản Windows) vào nhật ký, người chốt và người mở chốt. Thêm màn hình **Nhật ký thao tác** (xuất được Excel). (BUG-036)
- Checksum bản chốt bao cả dữ liệu đầu vào. (BUG-037)
- Khôi phục: báo các kỳ đã chốt sẽ mất hoặc đổi; kiểm tra cấu trúc trước khi thay thế.
- Nhập Excel luôn sao lưu trước khi ghi; lưu thất bại thì hoàn tác toàn bộ. (BUG-038)

### Thêm mới
- Chế độ cập nhật khi nhập Excel: **Bổ sung** (mặc định) hoặc **Ghi đè cả dòng** (báo trước số ô bị xóa). Hiển thị chi tiết từng ô trước → sau.
- *Kiểm tra dữ liệu* thêm phần kiểm tra cấu trúc:
  - phiên bản, bảng, kiểu ngày / tiền / kỳ;
  - Mã NV, quan hệ hợp đồng ↔ phụ lục;
  - toàn vẹn kỳ chốt và lịch sử chốt.
- Nút **Kiểm tra tất cả bản sao lưu**.
- Module mới: `core/period-guard.js`, `core/schema.js`.

### Kỹ thuật
- Phiên bản 2.0.0-alpha.1 (bản thử nghiệm của lộ trình 2.0). `schemaVersion` vẫn là 2, chỉ thêm trường.
- Test: 78 unit/integration/regression (thêm 34), 27 kịch bản E2E (thêm 4).
- Khảo sát: `node:sqlite` có sẵn trong Electron 43 → SQLite ở giai đoạn 2 không cần module native.

## [1.4.0] — 10/10/2026 — Phase 1: kiểm toán & sửa lỗi nghiêm trọng
### Sửa lỗi
- **Số tiền**: form phụ lục lương không còn làm hỏng số tiền khi mở rồi lưu (300.000 → 300); gõ "500.000" ở mọi bảng được hiểu là 500.000đ; dữ liệu cũ dạng "500.000" tự chuẩn hóa. (BUG-001, BUG-002)
- **Chốt kỳ / Mở chốt / Cho nghỉ việc chạy được trong bản cài .exe** (trước đây dùng `prompt()` không được Electron hỗ trợ). (BUG-003)
- File dữ liệu hỏng không còn bị ghi đè bằng dữ liệu trống — app mở màn hình khôi phục. (BUG-004)
- Bản sao lưu trong ngày không còn bị ghi đè liên tục. (BUG-005)
- Nhập Excel không còn tạo dòng trùng (nhập lại chấm công không làm lương tăng gấp đôi). (BUG-006)
- Không thể nhập/dán/chuyển dữ liệu vào kỳ đã chốt. (BUG-007)
- Chốt luôn dùng số tính lại mới nhất; chỉ báo thành công khi đã ghi xuống đĩa. (BUG-008, BUG-009)
- CCCD/SĐT không còn mất số 0 đầu khi nhập Excel; ngày dd/mm/yyyy và kỳ "2026-9" được nhận đúng. (BUG-011, BUG-012)
- Lỗi hiển thị không còn làm trắng màn hình. (BUG-013)
### Thêm mới
- **Trung tâm nhập Excel**: xem trước, phân loại Thêm mới / Cập nhật / Trùng / Lỗi dữ liệu / Sai tham chiếu / Kỳ đã chốt, tải danh sách lỗi.
- **Phiên bản kỳ lương**: mở chốt bắt buộc lý do, giữ bản cũ trong lịch sử, chốt lại = phiên bản mới, so sánh trước/sau, kiểm tra toàn vẹn (checksum); snapshot lưu cả dữ liệu đầu vào và danh mục.
- **Quản lý sao lưu**: danh sách bản sao lưu tự động, khôi phục từng bản; sao lưu khi mở app, đầu ngày, **trước nâng cấp**, trước nhập Excel / mở chốt / khôi phục / xóa toàn bộ.
- **Kiểm tra dữ liệu**: trùng Mã NV/CCCD, chấm công trùng, ngày sai bị bỏ qua, lương nghi bị lỗi lưu, phiếu cân chia nhiều người…
- Cảnh báo khi tính lương: thực lĩnh âm, thiếu giảm trừ/biểu thuế, lương đóng BH quá nhỏ, NV nghỉ việc chưa chấm dứt HĐ, chuyển khoản thiếu số TK.
- Nhật ký thao tác (`auditlog`).
### Giao diện
- Giao diện mới **"Xanh ngọc & Champagne"**: giữ màu xanh HAK, menu nền xanh đậm, điểm nhấn vàng champagne, thẻ bo tròn có bóng mềm, số liệu thẳng cột.
- Icon nét mảnh đơn sắc (SVG) thay cho emoji ở menu, nút, tab, tiêu đề (`ui/icons.js`; nhãn trong mã nguồn giữ nguyên, chỉ đổi khi hiển thị).
- Font **Be Vietnam Pro** (SIL OFL 1.1) đóng gói sẵn trong app (`ui/fonts/`), chạy offline, hiển thị giống nhau trên mọi máy.
- Sửa: cột Mã NV ở bảng chấm công bị cắt; ngày trong các thẻ hồ sơ nhân viên hiện `dd/mm/yyyy`.
### Kỹ thuật
- Electron 33.2.0 (hết hỗ trợ) → **43.7.9**; electron-builder 26.15.3; `package-lock.json`.
- Cứng hóa bảo mật: sandbox, CSP, chặn cửa sổ/điều hướng ngoài, chỉ 1 cửa sổ app.
- Module mới: `core/validate.js`, `core/importer.js`, `core/integrity.js`, `core/payroll-close.js`, `main/storage.js`.
- Kiểm thử: 44 test unit/integration/regression, 23 kịch bản E2E Electron (gồm nâng cấp từ dữ liệu 1.3.0), benchmark hiệu năng; CI chạy lint + test + audit + E2E trước khi build.
- Tài liệu dự án trong `docs/`.

## [1.3.0] — 10/10/2026
- Báo cáo lương: theo phòng ban, tổng hợp công, phân bổ sản lượng, hạch toán, phiếu chi, so sánh kỳ, 12 tháng, thu nhập & thuế TNCN cả năm.
## [1.2.0] — 10/10/2026
- Chốt kỳ lương, khóa dữ liệu kỳ, xem lại, đối chiếu, mở chốt.
## [1.1.0] — 10/10/2026
- Hồ sơ nhân sự theo QL_NHANSU (hợp đồng, phụ lục, nhân thân…), báo cáo nhân sự, lương theo phụ lục hiệu lực, lưu ra file + sao lưu hằng ngày.
## [1.0.x] — 08/10/2026
- App tính lương offline (port từ Google Apps Script), bộ cài Windows, nhập/xuất Excel, file mẫu.
