# V10.3 — HAK Smart Filter + Danh mục Phụ cấp / Hỗ trợ Master–Detail

Trạng thái: **bản nháp chờ nghiệm thu** (PR draft, chưa merge, không đụng `main`). Ưu tiên giữ nguyên: *tính lương đúng và bảo toàn dữ liệu* → giao diện → đóng gói.
Nhánh `feature/luong-hak-v10-3-smart-filter-allowance-support`, dựng trên nhánh V10.2 (PR #32).

## A. HAK Smart Filter
### Kiến trúc (3 tầng)
| Tầng | Thành phần | Ghi chú |
|---|---|---|
| 1. Thanh lọc nhanh | `FilterToolbar` | Ô tìm không dấu · kỳ ⇄ Từ–Đến ngày (dd/MM/yyyy) · 1–2 nhóm chọn nhiều thường dùng · nút “Bộ lọc nâng cao (n)” · Đặt lại. Cao 36px, bo góc 8px, khoảng cách 4/8/12/16/24. |
| 2. Bộ lọc nâng cao | `FilterDrawer` + `FilterMultiSelect` + `FilterDateRange` + `FilterPresetManager` | Ngăn kéo bên phải; bản nháp riêng, **Áp dụng / Hủy / Đặt lại**; Esc đóng, Tab xoay vòng trong ngăn, tiêu điểm trả về nút mở. Chọn nhiều có tìm không dấu, chọn tất cả/bỏ chọn. |
| 3. Dòng kết quả | `FilterSummary` + `FilterChips` | “Hiển thị x / y dòng”, tổng của màn hình, chuỗi *Phạm vi*, chip từng điều kiện (bấm × để gỡ), Xóa tất cả. |

Mã: `core/smart-filter.js` (thuần dữ liệu, có test), `ui/smart-filter.js` (giao diện), tái dùng `ui/filter-popover.js` cho các nút chọn nhiều ở thanh nhanh.
Cấu hình mỗi màn hình: `screenId, fields, quickFields, advancedFields, dataSource, state{get,set}, onApply, onReset, summary` (+ `periods, scopeFallback, labelOf, legacyPresets, qCommit`).

### Quy tắc đã chốt
- **Một nguồn sự thật cho hiển thị = tổng = Excel = PDF = in**: lưới nhập liệu dùng đúng một hàm `scan()` (trước đây bảng, tổng và Excel mỗi nơi lọc một kiểu; Excel của Chấm công còn **bỏ qua** bộ lọc). Nhân sự dùng `nsRows()`. Chuỗi phạm vi dùng chung `SF.scopeText`.
- **Kỳ điều khiển ngày**: chọn kỳ → điền ngày; sửa ngày → “tùy chọn”; khoảng ngày trùng đúng cả kỳ thì nhận lại kỳ; từ > đến bị báo, không tự đổi chỗ; 31/02 bị từ chối. Đóng ngăn kéo/Hủy **không** đổi kỳ lương toàn ứng dụng.
- **Không bỏ điều kiện âm thầm**: điều kiện màn hình không lọc được hiện thành chip “Điều kiện màn hình này không lọc được: …” và nằm trong `unsupported`; nạp bộ lọc đã lưu báo `dropped` (điều kiện/giá trị không còn).
- **Lọc không tính lại lương**: kiểm tra bằng bộ đếm `LuongEngine.tinhBangLuong` = 0 lần gọi khi lọc Bảng tính lương.
- **Bộ lọc đã lưu**: riêng từng màn hình (`hak.sf.presets`, `schema: 1`); kho lỗi/khác phiên bản bị báo `isCorrupt`, không đọc nhầm; bộ lọc báo cáo cũ (`hak.rf.presets`) vẫn **đọc được** (chỉ đọc, không sao chép/xóa).
- Trạng thái dùng lại đối tượng cũ (`st.plf`, `st.inf`, `st.rf`+`st.ccf`, `st.qs`, mới `st.nsf`, `st.catf`) — không tạo kho dữ liệu thứ hai.

### Màn hình đã áp dụng
| Màn hình | Nhanh | Nâng cao thêm | Ghi chú |
|---|---|---|---|
| Nhân sự (gồm điều kiện hợp đồng) | tìm · trạng thái · phòng ban | chức vụ · loại HĐ · hạn HĐ (quá hạn/30/60/90 ngày/không có) | Excel/PDF/In “đang lọc” mới. **Không có màn “Hợp đồng” độc lập** trong ứng dụng; điều kiện hợp đồng nằm ở danh sách Nhân sự. |
| Chấm công | tìm · phòng ban · hình thức công | khối · tổ · nhân viên · cảnh báo · nguồn OCR | dùng chung `st.rf` với Tính lương/Báo cáo |
| Sản lượng · Bơm dăm | tìm · kỳ/ngày · phòng ban | — | giữ nguyên tổng, đã phân bổ / chờ phân bổ, phiếu trùng |
| Thưởng-Trừ · Tạm ứng · Suất cơm | tìm · kỳ/ngày · phòng ban | nhân viên | giữ tổng theo cột |
| Bảng lương nội bộ · Tính lương · Báo cáo (cùng `reportFilterBar`) | tìm · khối · phòng ban | tổ · mã lương · thanh toán · hình thức công · nhân viên · chỉ người có thu nhập | dòng kết quả có Tổng thu nhập/Thực lĩnh lấy từ số đã tính |
| Danh mục (lưới chung) | tìm · trạng thái · hiệu lực (khi bảng có cột) | — | hiệu lực: đang / chưa / đã hết tại ngày hôm nay |

Thay đổi hành vi có chủ ý: thanh nhanh chỉ giữ 2–4 điều kiện (các nhóm còn lại vào ngăn nâng cao); Cài đặt → Công thức → tab Phụ cấp chỉ còn con trỏ sang Danh mục (công thức nay quản lý trong hồ sơ từng mã). Ba bước E2E cũ được chỉnh theo hai thay đổi này (kiểm tra tương đương, xem `tests/e2e/run-e2e.js`).

## B–C. Phụ cấp / Hỗ trợ Master–Detail (nền tảng dùng chung với Tăng ca)
Cấu hình theo loại, không có ba trình thiết kế riêng: `core/payroll/formula-master.js` (`KINDS`: bảng cha, loại công thức, cột liên kết, phạm vi biến, bộ chuyển trạng thái), UI `ui/formula-master.js`.
- **Khóa công thức**: Phụ cấp/Hỗ trợ chỉ theo “Loại công thức” (trống = **cách tính lịch sử**, không rơi về mã); Tăng ca vẫn “Loại công thức ‖ Mã”. Mã dùng cách tính có sẵn (CO_DINH, TYLE_*, HT_THEO_NGAY, HT_THIEU_CHUAN) **bị engine bỏ qua công thức cấu hình cùng tên** — hộp kiểm tra trước kích hoạt nói rõ.
- **Cột liên kết** riêng: `Mã phụ cấp cha`, `Mã hỗ trợ cha` (+ `Liên kết lúc`, hoàn tác theo đợt); chỉ liên kết khi suy ra duy nhất; liên kết sai bảng/sai loại/sai khóa bị chặn cả ở giao diện lẫn tiến trình chính (`write-policy`).
- **Phạm vi biến = đúng biến engine cấp**: Phụ cấp `MUC_PHU_CAP, CONG_CHUAN, CONG_HUONG_PHU_CAP, NGUONG_PHU_CAP, CONG_TINH_LUONG, CONG_LE, CONG_PHEP, CONG_TC`; Hỗ trợ `MUC_HO_TRO, CONG_CHUAN, CONG_THUC_TE, SO_NGAY_COM, SO_NGAY_DUOC_HUONG`. Dùng biến ngoài phạm vi (vd `SO_XE`) bị chặn từ lúc gửi duyệt và trong chạy thử (không ra số giả). Mẫu công thức đánh dấu “chưa kết nối engine” bị loại khỏi danh sách dùng được.
- **Hỗ trợ**: Mã hỗ trợ (tiền cơm: truyền số ngày cơm) và Mã hỗ trợ 2 (truyền 0 ngày) được kiểm thử đúng vị trí gán; **không đổi** cách phân loại tiền cơm / thiếu công chuẩn, không cộng trùng.
- Engine chỉ **ghi nhận thêm** biến (`bienPC, nhanhPC, bienHT, maHoTro, maHoTro2` trong `_ct`) — không đổi kết quả.
- Công thức sai đang Hiệu lực: giữ cơ chế báo lỗi/chặn sẵn của engine; không có công thức cấu hình → cách tính lịch sử như cũ.

## Kết quả kiểm thử (14/10/2026)
| Bộ | Kết quả |
|---|---|
| Unit `npm test` | 631/631 đạt (gồm U-FM-01..17 Phụ cấp/Hỗ trợ và U-SF-01..12 Smart Filter) |
| E2E tổng `run-e2e.js` | 253/253 PASS (như bản nền V10.2) |
| ESLint 9 `--max-warnings 0` | sạch |
| Hồi quy lương trước/sau (`tools/v103/regression.js`, 300 NV × 3 kỳ) | **874 dòng lương × 20 cột = 17.480 ô, 0 chênh lệch** (Phụ cấp 294.783.356 · Hỗ trợ 127.650.000 · Tiền cơm 61.600.000 · Thực lĩnh 12.612.860.000, trước = sau) |
| E2E giao diện V10.3 (`tests/e2e/v103-ui-check.js`) | 153/153 đạt; 3 độ phân giải 1366×768 · 1600×900 · 1920×1080; không cuộn ngang; ngăn kéo/modal nằm trọn màn hình; 0 lỗi JS |
| Lõi lọc (Node, `tools/v103/bench-filter.js`, trung vị 21 lần) | 100 dòng ≤ 0,2 ms · 1.000 dòng 0,9–1,5 ms · 10.000 dòng 7,9–14,1 ms (máy 2 vCPU Xeon 2,3 GHz) |
| Lọc trên giao diện Electron (Sản lượng, đã trừ 250 ms chờ gõ) | 100 dòng 18–55 ms · 1.000 dòng 35–81 ms · 10.000 dòng 47–83 ms (2 lần đo) (đo từ lúc nhập đến lúc dòng kết quả đổi) |

Ghi chú kỹ thuật: lần đầu dùng CSS `body:has(.sfd) #modal` làm chậm cả ứng dụng đến mức một bước E2E OCR (đọc/dừng) lỗi; đã đổi sang lớp `sfd-open` bật/tắt bằng JS, E2E về 253/253.

## Giới hạn đã biết (nói thẳng)
- Màn hình báo cáo/Tính lương/Bảng lương vẫn **vẽ lại cả trang** khi áp dụng bộ lọc (dùng bảng lương đã tính sẵn, không tính lại — đã đo bằng bộ đếm). Lưới nhập liệu và Nhân sự chỉ vẽ lại bảng + chip.
- Excel/PDF trên giao diện không được tự động so từng ô với màn hình trong E2E (hộp lưu tệp của hệ điều hành); sự thống nhất được bảo đảm bằng cấu trúc (một hàm quét) và test lõi, chưa có test đọc tệp xuất ra.
- Số đo hiệu năng lấy trên máy 2 vCPU của môi trường phát triển; **chưa đo trên máy Windows của người dùng**.
- Chưa UAT trên Windows; chưa duyệt đối chiếu B/C/E, chính sách KPCĐ và đọc OCR bản scan thật (các việc mở từ trước, không thuộc V10.3).
- Cột “Hạn hợp đồng” dựa trên `Ngày hết hạn` của hợp đồng hiện hành; hợp đồng chưa nhập ngày hết hạn nằm trong nhóm “Không có ngày hết hạn”.

## Ảnh Electron thật
`docs/v10_3_screens/<1366x768|1600x900|1920x1080>/` — 12 ảnh mỗi độ phân giải: Nhân sự, Chấm công, Bảng lương (Smart Filter), Bộ lọc nâng cao, Modal Phụ cấp ×4 tab, Modal Hỗ trợ ×4 tab. Báo cáo kiểm: `docs/V10_3_UI_CHECK.json`; hồi quy lương: `docs/V10_3_PAYROLL_REGRESSION.json`; đo lọc: `docs/V10_3_FILTER_BENCH.json`.
