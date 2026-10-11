# CHANGELOG

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
