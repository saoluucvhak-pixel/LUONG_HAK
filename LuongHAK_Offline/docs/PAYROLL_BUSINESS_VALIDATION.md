# PAYROLL_BUSINESS_VALIDATION.md — Rà soát công thức lương/BH/thuế (mục X)

**Nguyên tắc áp dụng cho toàn bộ tài liệu này**: KHÔNG tự sửa công thức. Mọi phát hiện ở đây chỉ là
báo cáo + bằng chứng tái hiện được, chờ xác nhận của chủ sở hữu/kế toán trước khi đổi code — đúng
bài học từ việc sửa KPCĐ ở phiên trước (đã bị hoàn tác vì "đổi công thức chưa được duyệt").

Dữ liệu tham chiếu: Excel PowerQuery thật của HAK_DN (T11/2025) và Đại Hiệp (T8/2026), do người dùng
cung cấp trong phiên làm việc. Mã nguồn tham chiếu: `engine.js` trên nhánh `claude/v2-ocr-ky-hieu`
(đã merge `feature/offline-v2-hardening`).

---

## PV-1 (nghi vấn CAO — P0 nếu đúng): Mã "TNCN0" bị hiểu là "Miễn thuế", nhưng dữ liệu thật cho thấy
đây là mã PHỔ BIẾN NHẤT và vẫn được tính thuế lũy tiến thật khi vượt ngưỡng giảm trừ

### Công thức hiện tại (`engine.js` dòng ~386-395)

```js
// Phương thức thuế: mã cũ TNCN0/1/2, hoặc mã trong danh mục Thuế TNCN (...)
if (maT === "TNCN1") kieu = "VL";             // vãng lai 10%
else if (maT === "TNCN2") kieu = "LT";        // lũy tiến
else if (!maT || maT === "TNCN0") kieu = "MIEN"; // miễn thuế — KHÔNG BAO GIỜ tính thue
```
Nhánh `"MIEN"` không bao giờ gán lại `thue` (giữ nguyên `thue = 0` khai báo ở trên) — nghĩa là
**mọi nhân viên có "Mã TNCN" = "TNCN0" (hoặc để trống) luôn có Thuế TNCN = 0, bất kể thu nhập bao
nhiêu.**

### Dữ liệu thật mâu thuẫn với công thức này

- **HAK_DN, T11/2025**: **61/61 nhân viên** (100%) trong `NL_NHANSU` có "Mã TNCN" = `TNCN0`. Báo cáo
  thật `RP_THUETNCN` vẫn tính và thu thuế TNCN lũy tiến bình thường cho người có thu nhập vượt mức
  giảm trừ (ví dụ 2 trường hợp dưới đây), trong khi người thu nhập thấp hơn thì đúng là thuế = 0 —
  **không phải vì mã "TNCN0" miễn thuế, mà vì thu nhập tính thuế của họ ≤ 0 sau giảm trừ** (cách
  tính lũy tiến bình thường, bậc 1 bắt đầu từ thu nhập > 0).
- **Đại Hiệp, T8/2026**: 54/55 nhân viên dùng `TNCN0`.

### Bằng chứng tái hiện (chạy `engine.js` thật với dữ liệu nhân viên thật)

**Nhân viên: Võ Văn Phụng (HAK_DN, mã lương "CĐ" — cố định, không phụ cấp/tăng ca/sản lượng, nên dễ
tái hiện chính xác nhất)**

| Chỉ tiêu | Dữ liệu vào | Nguồn |
|---|---|---|
| Lương thỏa thuận | 30.000.000 | `NL_NHANSU` |
| Lương cơ bản (đóng BH) | 8.000.000 | `NL_NHANSU` |
| Mã BHXH | BH_KPCD.03 (NLĐ 10,5%, không KPCĐ) | suy từ `RP_BHXH`: 840.000 / 8.000.000 = 10,5% |
| Mã GT_TNCN_BT / GT_TNCN_PT / Người phụ thuộc | GTBT.01 / GTNPT.01 / 1 | `NL_CHITIET_NS` |
| Mã TNCN | **TNCN0** | `NL_NHANSU` |

| Chỉ tiêu | Báo cáo thật (`RP_THUETNCN`) | `engine.js` hiện tại (script tái hiện) | Khớp? |
|---|---|---|---|
| Tổng thu nhập | 30.000.000 | 30.000.000 | ✅ |
| BH trừ NLĐ | 840.000 | 840.000 | ✅ |
| Thu nhập chịu thuế (sau giảm trừ BT+NPT) | 13.760.000 | — | — |
| **Thuế TNCN** | **1.314.000** (bậc 3: 13.760.000×15% − 750.000) | **0** | ❌ |
| Thực lĩnh đúng phải là | 30.000.000 − 840.000 − 1.314.000 = **27.846.000** | app hiện tính ra **29.160.000** | ❌ thừa 1.314.000 |

**Nhân viên: Bùi Văn Hậu (HAK_DN)** — kiểm tra chéo bằng số, không cần chạy lại script:
Thu nhập chịu thuế thật = 1.695.720 (bậc 1, 5%, không trừ) → Thuế = 1.695.720 × 5% = **84.786đ**,
khớp đúng báo cáo thật. Nếu dùng engine hiện tại (TNCN0 → MIEN): thuế = 0, thiếu 84.786đ.

Lệnh chạy để tái hiện (không sửa code, chỉ đọc `engine.js`/`hr.js` hiện có):
```
node repro.js   # dùng E.tinhBangLuong() thật với đúng dữ liệu Võ Văn Phụng ở trên
```
Kết quả thực tế khi chạy: `Thuế TNCN (engine): 0` — xác nhận đúng như dự đoán.

### Tác động nghiệp vụ

Nếu app Offline được dùng để tính thuế TNCN thật (khai 05/KK-TNCN, trừ lương), **mọi nhân viên có
"Mã TNCN" = "TNCN0" và thu nhập tính thuế > 0 sẽ bị tính THIẾU thuế TNCN phải khấu trừ** — rủi ro
truy thu + phạt chậm nộp cho công ty, và thực lĩnh trả cho nhân viên bị tính THỪA đúng bằng phần
thuế thiếu đó. Với HAK_DN riêng tháng 11/2025, ít nhất 2 nhân viên bị ảnh hưởng trực tiếp với tổng
~1.398.786đ thuế bị thiếu (chưa kể các đơn vị/kỳ khác — đây chỉ là 1 tháng của 1 đơn vị).

### Nghi vấn liên quan (CHƯA chắc — cần hỏi thêm, không đưa vào kết luận chính)

Mã `TNCN1` (hiện gán `kieu = "VL"`, vãng lai 10%) ở Đại Hiệp: nhân viên **Lê Thanh Phú Thủy** (vào
làm từ 2024-10-01, hợp đồng dài hạn — không phải lao động ngắn hạn/vãng lai theo đúng mô tả trong
danh mục của app: *"Khấu trừ 10% cho cá nhân không ký HĐLĐ hoặc HĐLĐ dưới 3 tháng"*) có "Mã TNCN" =
`TNCN1`, nhưng thuế thật tính ra (338.462đ trên thu nhập chịu thuế 5.884.615đ) khớp đúng công thức
**lũy tiến bậc 2** (5.884.615×10%−250.000=338.461,5), KHÔNG khớp công thức vãng lai 10% (sẽ ra
588.462đ). Đây có thể là: (a) dữ liệu công ty tự gán sai mã cho người này (lỗi nhập liệu của công
ty, không phải lỗi app), hoặc (b) "Mã TNCN" không thực sự quyết định cách tính thuế trong công cụ
PowerQuery/DAX thật của HAK — cần hỏi trực tiếp người quản lý dữ liệu lương để biết chắc, **KHÔNG
có đủ dữ liệu để kết luận đây là lỗi app**.

### Câu hỏi cần chủ sở hữu/kế toán xác nhận trước khi sửa bất cứ gì

1. "Mã TNCN" = `TNCN0` trong thực tế vận hành của HAK có đúng nghĩa "miễn thuế hoàn toàn" không, hay
   nghĩa thật là "dùng cách tính mặc định/lũy tiến thông thường" (không có hàm ý miễn)?
2. Nếu đúng là nghĩa (2), có nên đổi `kieu = "MIEN"` thành `kieu = "LT"` cho trường hợp `TNCN0`
   không — và có ảnh hưởng gì đến các mã "TNCN0" ở đơn vị/kỳ khác đã dùng để chốt lương trước đây
   không (nếu có, cần đối chiếu lại các kỳ đã chốt bằng công thức cũ)?
3. "Mã TNCN" = `TNCN1`/`TNCN2` có thực sự đang được công ty dùng để phân biệt vãng lai/lũy tiến
   không, hay đây cũng chỉ là mã lịch sử không còn ý nghĩa thực tế?

**Chưa sửa code cho đến khi có câu trả lời.**

### CẬP NHẬT (cùng ngày, trong lúc trao đổi với người dùng): phát hiện xung đột với quyết định Q-29

Một phiên Claude khác, CÙNG NGÀY (commit `306fe6d`, 02:56 UTC — vài giờ trước phiên này), đã hỏi
chủ sở hữu CHÍNH CÂU HỎI NÀY (ghi nhận là Q-29/R-70) và nhận câu trả lời: *"có trừ thuế TNCN, trong
phần mềm khi chọn mã TNCN sẽ có miễn thuế nếu muốn kg trừ"* — tức là **giữ nguyên code hiện tại**
(TNCN0 = miễn), và đã thêm test khóa hành vi (`tests/unit/thue-tncn-ma.test.js`, dòng 25).

Khi hỏi lại trực tiếp trong phiên này, người dùng xác nhận Ý ĐỒ THIẾT KẾ của code là: **"nếu mã
TNCN là gì thì sẽ chọn thuế TNCN theo mức đó, nếu mã TNCN mà có mức thuế 0% thì áp dụng 0%"** — tức
là hệ thống phải TRA DANH MỤC theo mã, không phải ép cứng theo tên mã. Điều này cho thấy dòng code
`else if (!maT || maT === "TNCN0") kieu = "MIEN";` có thể vẫn SAI theo đúng ý đồ của chính nó (ép
cứng "TNCN0" = miễn ngay trong code, không tra Danh mục Thuế TNCN của công ty) — NHƯNG chỉ xác nhận
được chắc chắn khi biết Danh mục Thuế TNCN thật của công ty có định nghĩa mã "TNCN0" với nội dung gì
(Miễn / Lũy tiến / khác).

**Trạng thái: TẠM DỪNG — chờ người dùng kiểm tra Danh mục Thuế TNCN thật (trong app hoặc hỏi kế
toán) xem mã "TNCN0" được định nghĩa thế nào, trước khi quyết định sửa hay giữ nguyên. KHÔNG sửa
code trong lúc chờ**, vì có 2 tín hiệu "chủ sở hữu" trong cùng 1 ngày đang mâu thuẫn nhau — sửa vội
sẽ lặp lại đúng bài học KPCĐ.

### CẬP NHẬT 2: người dùng gửi thêm file có Danh mục Thuế TNCN thật — CỦNG CỐ Q-29, nhưng vẫn còn 1 điểm chưa giải thích được

File `LuongT11_NL_DN_02.12.25_V1_S_Final.xlsx` (bản đầy đủ hơn) có 3 sheet danh mục không có trong
bản trước: `DM_TNCN`, `DM_GT_TNCN`, `DM_BAC_TNCN`. Nội dung `DM_TNCN`:

| Mã thuế TNCN | Nội dung khấu trừ | Tỷ lệ đóng thuế |
|---|---|---|
| TNCN1 | Khấu trừ 10% (cố định) | 0.10 |
| **TNCN0** | **Không tính thuế** | **0** |

→ **Xác nhận rõ ràng, bằng chính danh mục thật: mã "TNCN0" = không tính thuế (0%), đúng như Q-29 và
đúng như code hiện tại (`kieu = "MIEN"`).** "TNCN2" không có dòng riêng trong `DM_TNCN` — dùng trực
tiếp bảng bậc lũy tiến `DM_BAC_TNCN` (7 bậc, khớp 100% với `dm_bacthue` mặc định của `hr.js`: bậc 3
10-18tr @15%, v.v.). Cấu trúc này khớp CHÍNH XÁC với thiết kế `TNCN1→VL, TNCN2→LT, TNCN0→MIEN` đã có
trong `engine.js`. **Không cần sửa code theo hướng PV-1 ban đầu nữa.**

**ĐÃ GIẢI THÍCH ĐƯỢC điểm bất thường Phụng/Hậu** (file thứ 3 người dùng gửi: `Luong_N09_27.10.2025.v3T.xlsx`
— cùng đơn vị HAK_DN, nhưng kỳ **T9/2025**, sớm hơn 2 tháng): `NL_NHANSU` của kỳ T9/2025 cho thấy
**Võ Văn Phụng và Bùi Văn Hậu có "Mã TNCN" = `TNCN2`** (lũy tiến), KHÔNG phải `TNCN0`! Báo cáo
`RP_THLUONG` của CHÍNH kỳ T9/2025 này cũng tính thuế lũy tiến cho cả 2 người, khớp đúng số
1.314.000đ (Phụng) — giống hệt số tôi thấy ở báo cáo T11/2025. Vậy mã TNCN của 2 người này đã được
đổi từ `TNCN2` (lũy tiến, áp dụng T9/2025) sang `TNCN0` (miễn, theo `NL_NHANSU` tôi đọc từ kỳ
T11/2025) — nhưng **báo cáo T11/2025 vẫn hiện đúng số thuế của kỳ TRƯỚC** (khả năng cao: số liệu
PowerQuery T11/2025 chưa refresh lại sau khi đổi mã, hoặc 2 file T11/2025 tôi có bị lệch thời điểm
xuất so với lúc đổi mã). **Đây là vấn đề đồng bộ dữ liệu trong chính file Excel thật của công ty ở
thời điểm đó, không phải lỗi của `engine.js`.**

**Kết luận PV-1: Đóng hẳn — giữ nguyên code hiện tại (TNCN0 = MIEN), đúng theo Q-29, Danh mục Thuế
TNCN thật, và giờ đã giải thích được điểm bất thường cuối cùng.**

**Về việc "app offline thiếu thông tin chi tiết nhân sự như file Excel"**: đã kiểm tra lại
`hr.js`/`app.js` — app offline ĐÃ CÓ đầy đủ các trường tương ứng `NL_CHITIET_NS`: Số CCCD, Ngày cấp,
Nơi cấp, Ngày sinh, Giới tính, Số điện thoại, Thường trú, Địa chỉ hiện tại (bảng `canhan`); Số tài
khoản, Tên ngân hàng (bảng `thanhtoan`); Mã GT_TNCN_BT/PT và Người phụ thuộc (tính từ danh sách
nhân thân đã khai trong bảng `nhanthan`, không lưu dạng số đếm thô — chặt hơn vì theo dõi được từng
người phụ thuộc theo tên). ~~Chưa tìm thấy trường cụ thể nào bị thiếu~~ — **kết luận này SAI, xem
PV-7: bạn chỉ đúng 3 trường "Mã GT_TNCN_BT, Mã GT_TNCN_PT, Số sổ BHXH", đã tìm ra lỗi thật.**

---

## PV-7 (ĐÃ SỬA — chủ sở hữu duyệt "làm hết 7a,7b,7c"): Mã GT_TNCN_BT / Mã GT_TNCN_PT / Số sổ BHXH / biểu thuế lũy tiến

Bạn nêu đúng 3 trường này có vấn đề thật. Chi tiết từng trường:

### 7a. "Số sổ BHXH" — THIẾU thật trên báo cáo BHXH (lỗi hoàn thiện dữ liệu, không phải lỗi công thức)

- **File/hàm:** `hr.js` hàm `staffForPayroll()` (dòng ~349-358, object `out.push({...})`) và
  `engine.js` object `bhRow` (dòng ~365-374, trong `tinhBangLuong`).
- **Hiện trạng đã xác nhận:**
  - `canhan.f` (hr.js dòng 18) CÓ khai báo field "Số sổ BHXH", form "Thêm nhân viên" (app.js dòng
    783) CÓ cho nhập, `core/validate.js` CÓ bắt buộc nhập khi có đóng BHXH (hr.js dòng 612 `need(...)`),
    và trường này CÓ xuất hiện ở báo cáo "Sổ lao động" (hr.js dòng 641).
  - NHƯNG `staffForPayroll()` — hàm build ra bảng `nhansu` nạp cho `engine.js` — **không copy
    "Số sổ BHXH" từ `cn` (bản ghi canhan) vào object nó trả về**, trong khi NGAY DÒNG KẾ BÊN nó vẫn
    copy "Số CCCD" từ cùng `cn` (dòng 357: `"Số CCCD": (cn && cn["Số CCCD"]) || ...`).
  - Vì vậy `ns["Số sổ BHXH"]` trong `engine.js` luôn `undefined`, và `bhRow` (báo cáo "Bảng BHXH" —
    cả xuất Excel sheet "BHXH" lẫn hiển thị trên màn hình) **không có cột "Số sổ BHXH"** — trong khi
    `RP_BHXH` thật của công ty (file Quế Sơn T9/2025 và HAK_DN) đều có cột này.
- **Rủi ro:** không ảnh hưởng số tiền (BHXH/thuế vẫn tính đúng) — chỉ là thiếu 1 cột tra cứu/đối
  chiếu trên báo cáo BHXH khi nộp cơ quan bảo hiểm.
- **Đề xuất sửa (an toàn, KHÔNG đổi công thức/số tiền nào):**
  1. `hr.js` dòng 357: thêm `"Số sổ BHXH": (cn && cn["Số sổ BHXH"]) || "",` vào object trả về của
     `staffForPayroll()`.
  2. `engine.js` dòng ~366: thêm `"Số sổ BHXH": ns["Số sổ BHXH"] || "",` vào `bhRow` (ngay sau
     "Mã NV"/"Họ và tên" để khớp thứ tự cột như `RP_BHXH` thật).
  3. Cột "BHXH" xuất Excel tự động lấy theo `Object.keys(bhxh[0])` (app.js hàm `excelSheets`, dòng
     1225) nên không cần sửa thêm gì ở app.js.
  4. Thêm test: 1 unit test cho `bhRow` có "Số sổ BHXH" đúng theo `canhan`.

### 7b. "Mã GT_TNCN_BT" / "Mã GT_TNCN_PT" — tính đúng số tiền hiện tại, NHƯNG cơ chế chọn mã là lỗ hổng thiết kế (chưa phải lỗi công thức tiền)

- **File/hàm:** `hr.js` hàm `staffForPayroll()` dòng 307-309 (chọn mã) + dòng 356 (gán). `engine.js`
  dòng 379-404 (dùng mã để tra `dm_giamtru` — phần này tính tiền ĐÚNG, không đổi).
- **Hiện trạng đã xác nhận:**
  - `hr.js` dòng 307-309 tính `gtBT`/`gtPT` **MỘT LẦN DUY NHẤT cho TOÀN BỘ nhân viên, TOÀN BỘ kỳ**,
    bằng cách lấy mã ĐẦU TIÊN trong `dm_giamtru` khớp regex `/^GTBT|^BT$/i` (và tương tự cho PT) —
    rồi gán y nguyên cho mọi nhân viên ở dòng 356. Đây không phải tra cứu theo từng người — là 1 giá
    trị đoán chung áp cho tất cả.
  - Trong khi đó **đã có sẵn hạ tầng cho 1 field nhập/chọn riêng theo người**: `app.js` dòng 417
    (`datalistFor`) khai báo datalist autocomplete cho đúng 2 cột tên "Mã GT_TNCN_BT"/"Mã GT_TNCN_PT"
    (nguồn `dm_giamtru`) — nhưng **không có bảng/form nào trong app thực sự khai báo field tên này**
    để người dùng nhập (đối chiếu `hr.js` dòng 48-61, field list đầy đủ của "chitiethd" — bảng
    "Lương & phụ lục HĐ", nơi lẽ ra field này nên nằm cạnh "Mức đóng bảo hiểm"/"Thuế TNCN" — không có
    "Mã GT_TNCN_BT"/"PT"). Đây là phần việc làm dở/bỏ sót: có "móc" autocomplete nhưng thiếu field
    thật để dùng nó.
  - Vì vậy hiện tại người dùng **không thể xem hoặc đổi riêng mã giảm trừ cho từng nhân viên** —
    khác với `NL_CHITIET_NS` thật, nơi "Mã GT_TNCN_BT"/"Mã GT_TNCN_PT" là 2 cột riêng theo từng dòng
    nhân viên.
  - Số tiền tính ra hiện tại ĐÚNG với dữ liệu thật đã đối chiếu (GTBT.01/GTNPT.01, xem bảng đối chiếu
    PV-1 dòng 47) vì trong thực tế công ty hiện chỉ dùng 1 mã GTBT và 1 mã GTNPT cho tất cả — nhưng
    cơ chế "lấy mã đầu tiên khớp regex trong danh mục" là rất mong manh: nếu sau này `dm_giamtru` có
    thêm 1 mã GTBT/GTNPT khác (ví dụ mức giảm trừ mới theo luật sửa đổi, đặt tên khác thay vì thêm
    dòng hiệu lực mới cùng mã cũ), app sẽ ÂM THẦM chọn sai mã cho TẤT CẢ nhân viên mà không cảnh báo.
- **Rủi ro:** hiện tại số tiền đúng; rủi ro là TIỀM ẨN (sai âm thầm, toàn bộ nhân viên, không cảnh
  báo) khi danh mục giảm trừ thay đổi theo cách khác với giả định hiện tại của code.
- **Đề xuất sửa (cần bạn duyệt trước khi làm — có đổi logic chọn mã, dù không đổi số tiền với dữ liệu
  hiện tại):**
  1. Thêm 2 field thật "Mã GT_TNCN_BT" / "Mã GT_TNCN_PT" (type `ref`, ref `dm_giamtru`) vào field
     list của `chitiethd` (hr.js dòng 59, cạnh "Mức đóng bảo hiểm"/"Thuế TNCN") — cho phép nhập/sửa
     riêng theo từng phụ lục lương như hợp đồng thật.
  2. Sửa `hr.js` dòng 307-309 + 356: nếu phụ lục hiệu lực (`ct`) có nhập "Mã GT_TNCN_BT"/"PT" thì
     dùng đúng giá trị đó; nếu để trống (phụ lục cũ, dữ liệu đã nhập trước khi có field này) thì GIỮ
     hành vi auto-detect hiện tại làm mặc định (regex-match đầu tiên) — đảm bảo dữ liệu/kỳ lương đã
     chốt trước đây không đổi số liệu.
  3. Thêm cảnh báo trong `engine.js` nếu tìm thấy ≥2 mã khớp regex trong `dm_giamtru` cùng lúc (dấu
     hiệu cơ chế auto-detect không còn đáng tin — nhắc người dùng chọn rõ theo từng phụ lục).

### 7c. Biểu thuế lũy tiến (`dm_bacthue`) không phân biệt theo "Mã thuế TNCN" — cùng lỗ hổng thiết kế như 7b

- **File/hàm:** `engine.js` hàm `tinhBangLuong()` (phần dựng `bieu` từ `dm_bacthue`, trước đây dòng
  198-201). `app.js` `DM.dm_bacthue.cols`.
- **Hiện trạng đã xác nhận:** `DM_BAC_TNCN` thật (file `3d229610-...xlsx`) có cột "Mã thuế TNCN" gắn
  theo từng dòng bậc thuế (7 bậc đều ghi "TNCN2") — chuẩn 7 bậc lũy tiến hiện hành của luật thuế TNCN
  VN (5/10/15/20/25/30/35%, mốc 5-10-18-32-52-80 triệu), khớp đúng dữ liệu thật đã kiểm (Võ Văn Phụng,
  Nguyễn Đức Quế, Trương Minh Tây — xem phần đối chiếu công thức dưới). Nhưng field list của app
  (`app.js` dòng 24, `dm_bacthue.cols`) KHÔNG có cột này — `engine.js` lấy TOÀN BỘ `dm_bacthue` làm 1
  biểu DUY NHẤT dùng chung cho MỌI mã thuế lũy tiến, y hệt kiểu lỗ hổng của GT_TNCN_BT/PT ở 7b: đúng
  khi công ty chỉ có 1 mã lũy tiến (hiện tại là vậy — "LT01"/TNCN2), nhưng không có cách biểu diễn
  "mỗi mã thuế lũy tiến 1 biểu riêng" nếu công ty cần (ví dụ 1 đơn vị trong hệ thống áp dụng mức khác).
- **Đã kiểm lại luôn công thức thu nhập chịu thuế TNCN bằng dữ liệu thật** (RP_THUETNCN, không chỉ
  suy luận): `Thu nhập chịu thuế = Thu nhập tính thuế(gộp) − Tiền cơm − KPCĐ − Bảo hiểm(NLĐ) − GT bản
  thân − GT NPT` — khớp đúng từng đồng với 3 nhân viên khác nhau (Phụng: 30.000.000−0−0−840.000−
  11.000.000−4.400.000=13.760.000 ✓; Quế và Tây: ra số âm → thuế đúng = 0 ✓). Không có khoản "Lương
  hỗ trợ" nào bị trừ riêng → **đóng PV-5 theo hướng công thức hiện tại ĐÚNG** (xem PV-5 ở trên).
- **Đề xuất sửa (đã làm, không đổi số liệu hiện tại):** thêm cột "Mã thuế TNCN" (tùy chọn) vào
  `dm_bacthue`; để trống = áp dụng chung cho mọi mã lũy tiến (hành vi hiện tại, giữ đúng số liệu cũ);
  chỉ khi CÓ ≥1 dòng ghi mã mới lọc biểu theo đúng mã của từng người.

**Trạng thái PV-7: ĐÃ SỬA cả 7a/7b/7c** theo yêu cầu "làm hết 7a,7b,7c để tính luôn công thức tính
thu nhập chịu thuế TNCN và tham chiếu mức đóng thuế TNCN" — commit `10f2ddc` trên `claude/v2-ocr-ky-hieu`
(cả 3 phần đều backward-compatible: để trống field mới = giữ đúng hành vi/số liệu cũ). Có 7 unit test
mới (`tests/unit/pv7-fields.test.js`) + toàn bộ 220 unit/integration/regression test + 95 E2E test đều
pass. Phát hiện thêm trong lúc sửa 7b: `hr.js`'s `REFS` thiếu `dm_giamtru` khiến field `ref` mới làm
vỡ hẳn form "Thêm nhân viên" (ném lỗi JS) — bắt được qua E2E, đã sửa cùng lúc.

---

## PV-2 (đã kiểm tra, KHÔNG phải lỗi): Truy thu bảo hiểm (R-57/R-60)

Không tìm được trường hợp nhân viên nào bị kích hoạt "Truy thu bảo hiểm" (chưa đủ ngưỡng công) trong
2 bộ dữ liệu thật đang có (`RP_BHXH` của HAK_DN T11/2025 không có cột này; `RP_THBL` có cột nhưng toàn
giá trị 0 ở các dòng đã xem) — **chưa đủ dữ liệu thật để đối chiếu công thức này**, không phải đã
xác nhận đúng. Để ở mục cần kiểm tra thêm khi có dữ liệu phù hợp (ví dụ nhân viên nghỉ không lương
giữa tháng, hoặc công < ngưỡng).

## PV-3 (bằng chứng CỦNG CỐ THÊM — đơn vị thứ 3, tháng khác): KPCĐ phần NLĐ

Đã phát hiện ở phiên trước (tách KPCĐ NLĐ khỏi "Cộng BH NLĐ đóng" — xác nhận đúng bằng dữ liệu thật
`RP_BHXH` của HAK_DN T11/2025), đã sửa và PUSH, nhưng **sau đó bị hoàn tác** (commit `fe3bdd7`) với
lý do "đổi công thức chưa được duyệt". Bài học: dù có bằng chứng Excel rõ ràng, vẫn phải chờ phê
duyệt trước khi đổi code đang chạy thật.

**Bằng chứng mới, đơn vị KHÁC, tháng KHÁC** — `Luong09QS_Ngan_221025_V3.xlsx` (Quế Sơn/CNHAK,
T9/2025): cả `RP_BHXH` và `RP_THLUONG` của đơn vị này ĐỀU có cột **"NLĐ.KPCĐ" tách riêng** khỏi
"Cộng BH NLĐ". Ví dụ Trần Thị Thu Vân (`RP_BHXH`): NLĐ.BHXH 330.416 + NLĐ.BHYT 61.953 + NLĐ.BHTN
41.302 = **445.830 = "Cộng BH NLĐ"** (khớp đúng, KHÔNG gồm KPCĐ); "NLĐ.KPCĐ" = 20.651 nằm RIÊNG,
cộng vào "Tổng KPCĐ" (= DN.KPCĐ + NLĐ.KPCĐ) chứ không cộng vào "Tổng BH" (= Cộng BH DN + Cộng BH
NLĐ). Cùng mẫu mã BHXH (`BH_KPCD.01` → NLĐ.KPCĐ > 0; `BH_KPCD.03` → NLĐ.KPCĐ = 0) y hệt HAK_DN.

→ **Đây là lần thứ 2, ở đơn vị khác, tháng khác (T9/2025, cũng TRƯỚC ngày quy chế 2026 được duyệt
11/10/2026), cho cùng 1 kết luận: KPCĐ phần NLĐ luôn được công ty tách thành khoản trừ RIÊNG, không
gộp vào "BH trừ NLĐ"/"Cộng BH NLĐ đóng".** Việc này nhất quán ở ít nhất 2 đơn vị qua 2 tháng khác
nhau, cả 2 đều TRƯỚC thời điểm "quy chế 2026" — nên nhiều khả năng đây là lỗi hiện có từ lâu, KHÔNG
phải một chính sách mới chỉ áp dụng từ 2026 cần gate theo `qc2026`. Việc hoàn tác trước đây ("áp
dụng cả cách tính cũ 1.7" là lý do bị phản đối) có thể đã hiểu nhầm đây là thay đổi chính sách, trong
khi thực chất là sửa một lỗi tính sai đã tồn tại từ trước.

**ĐÃ ĐƯỢC NGƯỜI DÙNG XÁC NHẬN ("ok bạn") — đã sửa lại lần 2 (commit `121b831` trên
`claude/v2-ocr-ky-hieu`).** Lần này rút kinh nghiệm từ lý do hoàn tác lần 1 ("làm thiếu KPCĐ ở
phiếu lương/bút toán"): ngoài sửa `engine.js`, đã cập nhật đầy đủ `app.js` — cột Excel bảng lương
(COLS_FULL/COMPACT), dòng phiếu lương (SLIP_LINES), bút toán hạch toán (Nợ 334/Có 3382 — tránh lệch
sổ), KPI màn Tính lương, báo cáo 12 tháng và báo cáo thuế năm. Webapp GAS (main) đã có fix này từ
trước (commit `d220554`, KHÔNG bị hoàn tác, không cần làm lại).

---

## PV-4 (đã kiểm tra, KHÔNG phải lỗi): Lương thời gian + Tiền cơm — khớp đúng dữ liệu thật

**Lương thời gian (Bùi Văn Hậu, HAK_DN, mã lương TG1)**: Lương thỏa thuận 8.500.000, Công chuẩn 25,
Công tính LTG **30** (> công chuẩn!), Lương thời gian = 340.000 × 30 = 10.200.000 — khớp đúng
báo cáo thật. Điều đáng chú ý: "Công tính LTG" KHÔNG bị cắt ở công chuẩn (30 > 25) — đúng với công
thức `qc2026` (C1 "trả đủ công đi làm, không cắt ở công chuẩn") trong `engine.js`, KHÔNG khớp công
thức cũ 1.7 (`Math.min(tongCong, cChuan)` sẽ cho ra 25, sai). Dữ liệu T11/2025 này cho thấy HAK đã
áp dụng cách tính "2026" trong thực tế từ trước khi quy chế được chính thức duyệt (11/10/2026) —
không phải lỗi, chỉ cần nhớ chọn đúng "Quy chế 2026" khi tính lại các kỳ cũ bằng app.

**Tiền cơm**: "Mã hỗ trợ" = HT.01 (code cơm), `tienCom = ngayCom × Số tiền`. Cơm ca thật = 460.000 —
cơ chế khớp đúng (ht1 dùng cho tiền cơm theo đúng thiết kế `hr.js`).

**Phụ cấp công tác (Lê Thanh Phú Thủy)**: Phụ cấp CT thật = 60.000. Tra chấm công gốc (`DL_Chamcong`)
thấy nhãn "ĐH" ở đúng 2 ngày (28, 29) — khớp CƠ CHẾ "đếm ngày có nhãn × đơn giá nhãn" của `engine.js`
(60.000 / 2 ngày = 30.000đ/ngày cho nhãn "ĐH", hợp lý). Không có Danh mục Phụ cấp thật để xác nhận
đúng đơn giá 30.000đ, nhưng cơ chế (đếm nhãn, không phải đếm công) đã khớp.

## PV-5 (ĐÃ ĐÓNG — xem PV-7c: KHÔNG phải lỗi, công thức hiện tại ĐÚNG): "Lương hỗ trợ" của Bùi Văn Hậu

**Cập nhật (PV-7c)**: quan sát "chênh lệch = Lương hỗ trợ + Cơm ca" ở dưới là MỘT SỰ TRÙNG HỢP —
đã kiểm tra lại bằng đúng cột breakdown thuế thật (`RP_THUETNCN`, file `3d229610-...xlsx`, có 2
nhân viên "Nguyễn Đức Quế"/"Trương Minh Tây" với Lương hỗ trợ = 300.000đ): cột "Thu nhập chịu thuế"
trong file thật CHỈ trừ đúng 5 khoản — Tiền cơm, KPCĐ, Bảo hiểm (NLĐ), GT bản thân, GT NPT — khớp
đúng từng đồng với `chiuThue = tongTN - bhNLD - kpcdNLD - tienCom` rồi trừ tiếp GTBT/GTNPT của
`engine.js` hiện tại. KHÔNG có dòng trừ "Lương hỗ trợ" nào trong breakdown thật. Vậy công thức thu
nhập chịu thuế hiện tại **ĐÚNG — không sửa gì**. Đóng PV-5 theo hướng ngược lại giả thuyết cũ.

### Lịch sử (giữ để tham khảo)

Báo cáo thật (`RP_THBL`) cho Bùi Văn Hậu có **"Lương hỗ trợ" = 4.000.000đ**, nhưng hồ sơ của anh
(`NL_NHANSU`) có "Mã hỗ trợ 2" = TRỐNG. Theo `engine.js`, cột "Lương hỗ trợ" (`luongHT`) CHỈ được
tính khi có "Mã hỗ trợ 2" (bù thiếu công so với công chuẩn) — nếu trống, `luongHT` phải = 0, mâu
thuẫn với con số thật 4.000.000đ.

Có thể giải thích theo nhiều hướng khác nhau mà tôi KHÔNG đủ dữ liệu để phân biệt:
- Khoản 4.000.000đ này thực ra tương ứng với trường **"Lương phụ"** của `engine.js` (phụ cấp cố
  định gắn theo MÃ LƯƠNG "TG1" trong Danh mục Lương, không liên quan "Mã hỗ trợ") — chỉ là khác tên
  cột giữa 2 hệ thống, không phải lỗi tính toán.
- Hoặc công cụ PowerQuery thật của HAK có thêm 1 nguồn "hỗ trợ" khác mà `engine.js` offline chưa có.

**Cần**: Danh mục Lương (`dm_luong`) thật của HAK_DN — xem mã "TG1" có cấu hình "Lương phụ" =
4.000.000đ không. Không có file này trong bộ dữ liệu đã cung cấp (chỉ có dữ liệu phát sinh hàng
tháng, không có danh mục cấu hình). **Chưa kết luận được đây là lỗi hay không — cần thêm dữ liệu.**

**Quan sát thêm (cũng chưa kết luận)**: Đối chiếu "Thu nhập tính thuế" thật (17.640.000, `RP_THUETNCN`)
với tổng các khoản thu nhập thật trong `RP_THBL` (Lương thời gian 10.200.000 + Lương Tăng Ca
7.440.000 + Lương hỗ trợ 4.000.000 + Cơm ca 460.000 = 22.100.000), chênh lệch đúng bằng
**Lương hỗ trợ + Cơm ca** (4.460.000). Tức là trong hệ thống thật, "Lương hỗ trợ" (không chỉ
"Tiền cơm") dường như ĐƯỢC LOẠI khỏi thu nhập chịu thuế. Nhưng `engine.js` hiện tại
(`chiuThue = tongTN - bhNLD - tienCom`) CHỈ loại trừ `tienCom`, KHÔNG loại `luongHT` — nếu đúng
vậy thì đây là lỗi thứ 2 (tính thuế cao hơn thực tế cho người có "Lương hỗ trợ"). Nhưng vì chưa rõ
nguồn gốc số 4.000.000đ (xem đoạn trên), **chưa thể kết luận chắc — phụ thuộc vào câu trả lời cho
câu hỏi "Lương hỗ trợ từ đâu ra" ở trên.**

---

## PV-6 (giải thích công thức, đã đối chiếu dữ liệu thật — KHÔNG phải lỗi): Phân bổ sản lượng & Bù lương sản lượng

Đây là 2 cơ chế TÁCH BIỆT nhau: (A) **phân bổ sản lượng** — chia 1 phiếu cân (ghi theo TỔ, chưa biết
đích danh ai) cho từng người trong tổ; (B) **bù lương sản lượng** — nếu tiền sản lượng tính ra thấp
hơn một "mức sàn" quy định, bù thêm phần chênh lệch. Cả 2 đã được đối chiếu với dữ liệu PowerQuery
thật (HAK_DN T11/2025 — chế độ "bình quân tổ"; Đại Hiệp T8/2026 — chế độ "theo ngày bậc thang") và
khớp đúng.

### (A) Phân bổ sản lượng theo tổ — `core/production-alloc.js`

Một phiếu cân thường chỉ ghi "cân cho tổ nào" (Mã phòng ban), không ghi rõ cân cho cá nhân nào —
vì nhiều người cùng làm ra 1 mẻ hàng. Quy tắc chia (đã chủ sở hữu duyệt — α19 "làm như công cụ"):

1. Lấy danh sách người CỦA TỔ ĐÓ đang có mặt làm việc **đúng ngày cân** (đã vào làm, chưa nghỉ việc).
2. Loại người có tên trong ô "NV vắng" của phiếu (so khớp theo TỪ CUỐI họ tên, có dấu trước — "Tường"
   ≠ "Tưởng" — không ai khớp mới so bỏ dấu; app còn nhận trực tiếp Mã NV).
3. Loại người đang nghỉ phép/nghỉ ốm có đơn đã duyệt ngày đó.
4. Chia ĐỀU khối lượng (hoặc số xe) của phiếu cho những người CÒN LẠI: `phần mỗi người = KL phiếu / số người còn lại`.
5. Nếu tổ không còn ai (mã tổ sai, hoặc tất cả đều vắng/nghỉ) → phiếu đó giữ trạng thái **"chưa phân bổ"** (có cảnh báo), KHÔNG bỏ sót âm thầm — khối lượng này được tính riêng vào "unallocated", cộng với tổng đã chia phải luôn bằng đúng khối lượng gốc của phiếu (bảo toàn theo đúng công thức, không có đường nào làm tổng phân bổ vượt hoặc thiếu so với phiếu gốc).

Phiếu đã ghi đích danh Mã NV (cân trực tiếp cho 1 người, không qua chia tổ) thì giữ nguyên, không chia.

### (B) Bù lương sản lượng — `engine.js` (trong `tinhBangLuong`)

Có 3-4 cách bù khác nhau, công ty chọn 1 cách cho mỗi đơn vị (lưu trong cấu hình kỳ lương):

**Cách "bình quân tổ" (`cheDoBu === "to"`, HAK_DN đang dùng):**
```
bình_quân_tổ = Tổng tiền sản lượng cả tổ trong tháng / số ngày trong tháng / số người trong tổ
nếu bình_quân_tổ < "Đơn giá bù lương" (mức sàn) VÀ người đó đủ "Ngưỡng công bù theo tổ":
    bù = (mức sàn − bình_quân_tổ) × số công BT của người đó
```
**Đối chiếu thật** (tổ "Tổ 1 - Công nhân sản xuất", HAK_DN T11/2025, 8 người): Tổng lương sản lượng
cả tổ = 35.160.360đ, 30 ngày, 8 người → bình quân = 35.160.360 / 30 / 8 = **146.501,5đ**, khớp đúng
cột "Đơn giá SL BQ" = 146.502đ trong báo cáo thật (chênh 0,5đ do làm tròn hiển thị). Tháng này
không ai bị bù (bình quân > mức sàn cấu hình riêng của đơn vị) — khớp đúng cột "Lương bù SL" = 0
cho cả tổ trong báo cáo thật.

**Cách "theo ngày bậc thang" (`cheDoBu === "daihiep"`, Đại Hiệp đang dùng):**
```
mỗi ngày có sản lượng:
    tiền_ngày_thật = tấn ngày đó × đơn giá sản lượng
    hệ_số = 0.5 nếu công BT ngày đó < 1 công
          = 1   nếu 1 ≤ công BT < 1.5 (ngày thường)
          = 1.5 nếu công BT ≥ 1.5 VÀ là Chủ nhật
    mức_sàn_ngày = hệ_số × "Đơn giá bù lương" (mức sàn 1 công/ngày thường)
    nếu mức_sàn_ngày > tiền_ngày_thật: bù += (mức_sàn_ngày − tiền_ngày_thật)
tổng bù cả tháng = tổng các ngày có bù
```
**Đối chiếu thật** (nhân viên mã `049077008794`, Đại Hiệp T8/2026, đơn giá sản lượng 6.000đ/tấn,
mức sàn 1 công = 200.000đ — suy ra từ chính báo cáo: ngày công BT=1 → "SL Tham chiếu" = 33,333 tấn
× 6.000 = 200.000đ): lấy đúng dữ liệu chấm công thật của người này — ngày công BT=0,5 (Chủ nhật
9/8) → mức sàn = 0,5×200.000=100.000đ, khớp đúng "SL Tham chiếu"=16,667 tấn (=100.000/6.000) trong
báo cáo; ngày công BT=1,5 (Chủ nhật 2/8, 16/8, 30/8) → mức sàn=1,5×200.000=300.000đ, khớp đúng
"SL Tham chiếu"=50 tấn. Tính lại TOÀN BỘ 31 ngày của tháng theo công thức trên: tổng bù =
**10,657 tấn × 6.000 = 63.942đ**, khớp CHÍNH XÁC với "Lương bù SL" = 63.942đ trong báo cáo thật.

**Kết luận PV-6: Cả 2 cơ chế đã đối chiếu CHÍNH XÁC đến từng đồng với dữ liệu PowerQuery thật ở cả 2
đơn vị dùng 2 chế độ khác nhau — không phát hiện lỗi.** (Lưu ý: cột "Đơn giá bù lương SL" trong báo
cáo Excel thật của HAK thực ra là SỐ TẤN được bù trong tháng, không phải một đơn giá tiền — tên cột
dễ gây hiểu nhầm, nhưng không ảnh hưởng vì chỉ là tên hiển thị trong file Excel của công ty, không
phải trường dữ liệu app offline dùng.)

---

## Việc tiếp theo (đề xuất)

- **PV-1 (TNCN0)**: ĐÃ ĐÓNG — giữ nguyên code, xem CẬP NHẬT 2. Điểm bất thường Phụng/Hậu còn để
  tham khảo (nếu người dùng xác nhận được hồ sơ thật của 2 người này thì ghi lại cho đủ, không bắt
  buộc), không chặn việc đóng PV-1.
- **PV-2 (truy thu BH)**: chưa có dữ liệu thật nào kích hoạt được trường hợp này trong 2 bộ dữ liệu
  đang có (đã kiểm tra lại, không có ai vào làm/nghỉ giữa tháng ở cả HAK_DN T11/2025 và Đại Hiệp
  T8/2026) — cần dữ liệu tháng khác có trường hợp này mới đối chiếu được.
- **PV-5 (Lương hỗ trợ 4.000.000đ của Bùi Văn Hậu)**: cần Danh mục Lương (`dm_luong`) thật của
  HAK_DN để biết mã "TG1" có cấu hình "Lương phụ" khớp con số này không.
- Đã kiểm tra thêm (PV-4): lương thời gian (kể cả biến thể qc2026 "trả đủ công"), tiền cơm, cơ chế
  phụ cấp công tác theo nhãn chấm công — đều khớp dữ liệu thật, không phải lỗi.
- Đã kiểm tra thêm (PV-6): phân bổ sản lượng theo tổ + bù lương sản lượng (2 chế độ "to"/"daihiep")
  — khớp chính xác dữ liệu thật đến từng đồng.
- Tăng ca (mã TC5), KPCĐ (webapp + offline): đã kiểm tra kỹ ở các lượt trước trong phiên này (xem
  lịch sử hội thoại) — khớp dữ liệu thật.

---

## PV-8 (ĐÃ SỬA): Tăng ca TC2 thiếu "Công chuẩn 2" khi chấm công có nhãn "DQ"

Phát hiện khi đối chiếu trực tiếp **mã Power Query M gốc** (không chỉ dữ liệu output) — lần đầu
trích xuất thành công toàn bộ M code từ `DataMashup` nhúng trong file `.xlsx` thật
(`LuongĐN09_27.10.2025.v3T.xlsx`, giải nén `customXml/item1.xml` → base64 → zip nội bộ →
`Formulas/Section1.m`, 1806 dòng, 48 query).

- **Công thức M thật** (`QR_CHAMCONG2` → `QR_TH_CC`): nếu nhãn chấm công (ô ngày dạng "1DQ"...)
  chứa chữ "DQ" (không phân biệt hoa/thường) → `Công chuẩn 2 = 40` (cố định); khi tính phần tăng ca
  vượt chuẩn của mã **TC2**, dùng "Công chuẩn 2" này thay cho "Công chuẩn" thường nếu > 0.
- **`engine.js` trước đây**: không có khái niệm "Công chuẩn 2" ở đâu cả — TC2 luôn trừ theo Công
  chuẩn thường, không phân biệt có nhãn "DQ" hay không.
- **Dữ liệu thật đã kiểm**: rà toàn bộ 8 file Excel thật đang có (HAK_DN T9 & T11/2025, Quế Sơn
  T9/2025, Đại Hiệp T8/2026) — **không có dòng chấm công nào chứa nhãn "DQ"** ở bất kỳ đơn vị/kỳ
  nào. Tức là quy chế này có thật trong công thức (đứng, không phụ thuộc có dữ liệu hay không — chủ
  sở hữu xác nhận), nhưng chưa có bằng chứng số liệu thật nào đã từng kích hoạt nó.
- **Đã sửa** (commit `518a5d1` trên `claude/v2-ocr-ky-hieu`): `heSoTangCa()` nhận thêm tham số
  `congChuan2` (tùy chọn); `engine.js` tự nhận nhãn "DQ" từ `c.nhanTheoNgay` (cơ chế nhãn chấm công
  dùng chung với phụ cấp công tác, đã có sẵn) → `congChuan2 = 40` nếu có, else 0 (giữ đúng hành vi
  cũ). 3 unit test mới đối chiếu đúng công thức M thật; toàn bộ 223 test + 95 E2E pass.

---

## PV-9 (ĐÃ SỬA): Tăng ca CN1/CN2 tính gấp đôi — không nhân hệ số mã tăng ca

Phát hiện khi đối chiếu `QR_LUONGTG."Lương tăng ca"` trong M thật với `engine.js`:

- **Công thức M thật**: `if SalaryCode ∈ {CN1,CN2}: Lương tăng ca = Lương thỏa thuận (đơn giá/công) ×
  "Công tính tăng ca"` — "Công tính tăng ca" ĐÃ qua hệ số của đúng mã tăng ca người đó (TC1-TC6).
- **`engine.js` trước đây** (nhánh không phải quy chế 2026): `tienTC = luongTT × c.congTangCa` — dùng
  CÔNG TĂNG CA THÔ, bỏ qua hoàn toàn "Hệ số tăng ca" trong DM_TANGCA.
- **Đối chiếu số liệu thật**: Lê Đức Trương (HAK_DN T9/2025, `RP_THLUONG`) — CN1, mã TC4 (hệ số 50%
  trong DM_TANGCA thật), Lương thỏa thuận 240.000đ, Công tính tăng ca thật = 2,125 (= 4,25 công thô ×
  50%) → **Lương tăng ca thật = 240.000 × 2,125 = 510.000đ**, khớp đúng `RP_THLUONG`. Code cũ sẽ tính
  240.000 × 4,25 = 1.020.000đ — **gấp đôi số thật**.
- **Phát hiện phụ**: test `U-QC-05 (C5)` (đã có từ trước) ghi rõ "cách cũ: không nhân hệ số" như một
  hành vi CÓ CHỦ Ý, chỉ "quy chế 2026" mới nhân hệ số — nhưng DM_TANGCA/M thật tôi trích là của kỳ
  T9/2025 (TRƯỚC quy chế 2026, duyệt 11/10/2026), và đã nhân hệ số từ lúc đó. Vậy việc không nhân hệ
  số ở "cách cũ" là NHẬN ĐỊNH SAI của một phiên trước (không có M thật để đối chiếu lúc đó), không
  phải 1 quyết định nghiệp vụ hợp lệ — đã sửa lại nhận định này trong test.
- **Đã sửa** (commit `0f0a690` trên `claude/v2-ocr-ky-hieu`, theo yêu cầu "sửa theo PowerQuery"): bỏ
  điều kiện qc2026 cho việc nhân hệ số ở nhánh CN1/CN2 — dùng `heSoTangCa()` như nhánh chung. Không có
  Mã tăng ca → Tiền tăng ca = 0 (nhất quán, không đoán hệ số = 1). 3 test mới (trong đó có 1 test đối
  chiếu đúng số liệu thật Lê Đức Trương, 510.000đ); `v130.test.js` loại các cột cộng dồn (Tiền tăng
  ca, Tổng thu nhập, Thuế TNCN, Thực lĩnh) khỏi so sánh CHỈ cho đúng người bị ảnh hưởng (xác định bằng
  "Tiền tăng ca" đổi khác giữa 2 bản), không loại hàng loạt. Toàn bộ 225 test + 95 E2E pass.

**Cập nhật PV-9**: sau khi đẩy lên, 1 session Claude khác (Opus 5.5) đã HOÀN TÁC commit này (`77dd2fb`),
dẫn `docs/PAYROLL_FORMULAS.md` (mục C5, ở repo root — tài liệu công thức gốc) nói "nhân hệ số" là quy
tắc MỚI của Quy chế 2026 đã duyệt, "cách cũ" (1.7) = không nhân hệ số mới là gốc đúng (đối chiếu
T10/2025). Đây là bằng chứng thật khác tháng (T9 vs T10/2025) mâu thuẫn với PV-9. Đã hỏi lại chủ sở
hữu đúng câu hỏi QUY CHẾ (không phải "tin file nào"): "tiền tăng ca công nhật CN1/CN2 có nhân hệ số
mã tăng ca giống mọi loại lương khác không?" — **chủ sở hữu xác nhận CÓ, không phân biệt quy chế
2026 hay cách cũ.** Đã áp lại đúng sửa này (commit `742f972`), lần này có chạy `eslint --max-warnings 0`
trước khi đẩy (bản bị hoàn tác trước đó để sót hàm `stripKeys` không dùng, làm lint đỏ — lỗi thật của
tôi, đã sửa). **`docs/PAYROLL_FORMULAS.md` (mục C5, repo root) hiện vẫn ghi sai** — cần một phiên có
phạm vi đụng tới file đó (ngoài `LuongHAK_Offline/`) sửa lại cho khớp xác nhận mới này; phiên này
không tự sửa vì đó là tài liệu dùng chung ở gốc repo, ngoài phạm vi `LuongHAK_Offline/` được giao.

**PV-9 hoàn tất**: đã sửa thêm TC5 (commit `a25019d` trên `claude/v2-ocr-ky-hieu`) theo đúng quy chế
chủ sở hữu vừa xác nhận — TC5 cũng phải nhân "Hệ số tăng ca", trước đây bỏ qua (không lộ sai số vì
hệ số TC5 của HAK_DN hiện là 100%, nhưng sai cấu trúc). Vậy toàn bộ các mã tăng ca (TC1-TC5, CN1/CN2)
đến đây đều đã nhân đúng hệ số theo 1 quy chế thống nhất.

**Danh sách lỗi tăng ca đã báo cáo trong phiên này — tình trạng cuối**:
- Lỗi CN1/CN2 không nhân hệ số (gấp đôi khi hệ số ≠ 100%): **ĐÃ SỬA** (742f972, sau khi bị hoàn tác 1
  lần và chủ sở hữu xác nhận lại quy chế).
- Lỗi TC2 thiếu "Công chuẩn 2" khi có nhãn "DQ": **ĐÃ SỬA** (518a5d1).
- Lỗi TC5 không nhân hệ số: **ĐÃ SỬA** (a25019d).
- Không còn lỗi tăng ca nào khác đã báo cáo mà chưa sửa trong phiên này.

---

## Giai đoạn 2 (Master Prompt V3, mục IV + VIII.8.1): chuẩn hóa danh mục

Chủ sở hữu đã quyết định kiến trúc: **mỗi công ty/đơn vị HAK Group tiếp tục dùng 1 bản cài + 1 file
dữ liệu riêng** (không gộp thành 1 app quản nhiều công ty) — nên KHÔNG thêm trường CompanyID vào danh
mục. Phần việc Giai đoạn 2 còn lại, đã làm:

- **Mục 4.5 ("Trùng quy chế")**: thêm kiểm tra trong `core/integrity.js` — báo **High** khi 1 danh
  mục (dm_luong, dm_phucap, dm_tangca, dm_hotro, dm_baohiem, dm_tncn, dm_giamtru, dm_phongban,
  dm_chucvu, dm_bacthue) có ≥2 dòng cùng mã + CÙNG "Hiệu lực từ" — trước đây `hieuLuc()` (engine.js)
  im lặng chọn 1 dòng theo thứ tự mảng khi gặp trường hợp này. Không ảnh hưởng trường hợp bình thường
  (nhiều dòng cùng mã nhưng Hiệu lực từ khác nhau — tăng lương/đổi mức theo thời gian). Commit
  `a582d32`.
- **Mục 4.5 (đơn giá = 0)**: thêm cảnh báo khi có sản lượng/bơm dăm thật nhưng Danh mục lương thiếu
  "Số tiền khoán"/"Đơn giá bơm dăm" (trước đây âm thầm ra lương = 0đ). Commit `c743141`.
- **Mục 8.1 (DM_TANGCA — "loại công thức", không hardcode theo tên mã)**: thêm cột tùy chọn "Loại
  công thức" vào DM_TANGCA; để trống = dùng đúng tên Mã tăng ca như cũ (không đổi số liệu cũ); có giá
  trị = cho phép 1 mã tăng ca MỚI dùng lại công thức TC1/TC2/TC3/TC4/TC5/TC6 có sẵn mà không cần sửa
  `engine.js`. Commit `f3efcce`.
- **"Mức bù lương SL" / "Đơn giá khoán" không hardcode trong engine**: đã đúng từ trước (đọc từ
  `dm_luong`: "Đơn giá bù lương", "Số tiền khoán", "Ngưỡng công bù theo tổ" — xem PV-6), không cần sửa.
- **Mapping dữ liệu cũ**: schema hiện tại đã tương thích tên cột với yêu cầu mục IV, không cần đổi tên.

Tất cả đều backward-compatible (để trống trường mới = giữ đúng hành vi/số liệu cũ), có test riêng,
đã qua `eslint --max-warnings 0` + `node --check` + 231 test + 95 E2E.

---

## Giai đoạn 3 (Master Prompt V3, mục V-VII): sản lượng & bù lương

- **Phân bổ sản lượng theo tổ** (mục V): đối chiếu `RP_CTPBSL` trích từ M thật của HAK_DN — khớp đúng
  100% với `core/production-alloc.js` (điều kiện đủ công tác, cách so NV vắng, chia đều). App còn có
  thêm 2 cải tiến owner đã duyệt vượt công thức M gốc (tự loại người nghỉ phép dù chưa ghi NV vắng;
  coi công=0 là nghỉ nguyên ngày) — không phải lỗi.
- **Bù lương HAK** (mục VI): đã đối chiếu M thật từ lượt trước — khớp đúng (`QR_DONGIASANLUONG`).
- **Bù lương Đại Hiệp — theo ngày bậc thang** (mục VII): trích được mã M thật riêng của Đại Hiệp
  (`dfc97336-DAIHIEP...xlsx`), nhưng workbook này KHÔNG chứa công thức bậc thang trong Power Query
  (chỉ có bước chuẩn bị dữ liệu) — công thức bậc thang nằm trong 1 "công cụ" riêng ngoài file này.
  Theo yêu cầu "làm theo prompt": đối chiếu lại `engine.js` với đúng công thức VIẾT TRONG Master
  Prompt V3 (mục 7.3-7.10) — xác nhận **công thức hiện tại ĐÃ ĐÚNG, dùng chính "công thức kiểm tra
  chéo" mà mục 7.10 của prompt tự đưa ra** (`TIEN_BU_NGAY = MAX(0, MUC_BU × H − SL_thực_tế_ngày ×
  Đơn_giá)`), tương đương toán học với đường đi dài hơn (SL_CHUAN_1_NGAY → SL_THAM_CHIEU → SL_BU →
  TIỀN_BÙ) mà không cần làm tròn ở bước trung gian nào — đúng tinh thần mục 7.16 ("Ưu tiên kiểm tra
  tương đương... không làm tròn SL tham chiếu giữa các bước nếu gây sai lệch tiền").
  - **1 gap tìm thấy và đã sửa** (mục 7.15, "có sản lượng nhưng thiếu BT → phải CẢNH BÁO"): trước đây
    engine.js tính đúng bù=0 cho ngày này (không suy đoán BT=1 — đúng) nhưng KHÔNG báo gì, admin
    không biết là do thiếu chấm công. Đã thêm cảnh báo. Không đổi số tiền. Commit `df47473` trên
    `claude/v2-ocr-ky-hieu`, 1 test mới, 232 test + 95 E2E pass.

**Kết luận Giai đoạn 3**: không còn gap nào khác đã biết; công thức tiền đã đúng theo cả 2 cách đối
chiếu (M thật cho HAK/phân bổ; chữ prompt cho Đại Hiệp) — chỉ thiếu 1 cảnh báo nghiệp vụ, đã bổ sung.

### Giai đoạn 3 — bổ sung: kiểm thử biên bắt buộc cho bù lương Đại Hiệp

Chủ sở hữu ban hành văn bản riêng "QUY TẮC BẮT BUỘC — BÙ LƯƠNG SẢN LƯỢNG ĐẠI HIỆP THEO BẬC THANG" —
nêu đúng công thức đã xác nhận ở trên nhưng đòi hỏi thêm **bộ kiểm thử biên tường minh** (không chỉ
đối chiếu công thức bằng mắt) trước khi coi là xong. Đã bổ sung
`tests/unit/daihiep-bacthang.test.js` (17 test, commit `280b971` trên `claude/v2-ocr-ky-hieu`) —
mỗi test đối chiếu `engine.js` (`cheDoBu === "daihiep"`) với 1 công thức tham chiếu viết ĐỘC LẬP
ngay trong file test (không gọi lại `bacThang()` của engine), để test không tự xác nhận chính nó.
Bao quát đủ danh mục "Kiểm thử bắt buộc" của văn bản:

- Điểm biên hệ số: 0,49/0,5 · 0,99/1 · 1,49/1,5 (Chủ nhật) — đúng bậc, không suy luận tuyến tính.
- BT = 2 ngày thường → hệ số vẫn chỉ 1 (không vượt tối đa); BT = 2 Chủ nhật → hệ số vẫn chỉ 1,5.
- SL thực tế thấp hơn / bằng / cao hơn SL tham chiếu → bù > 0 / = 0 / = 0 (không bù âm).
- 1 ngày nhiều phiếu cân → phải cộng sản lượng trong ngày TRƯỚC khi so bậc thang (không tính bù
  riêng từng phiếu rồi cộng — test dựng 2 phiếu 10 tấn/phiếu cùng ngày để lộ sai nếu tính sai).
- Đơn giá khoán + Mức bù lương SL đổi giữa 2 kỳ hiệu lực trong DM_LUONG → mỗi kỳ phải dùng đúng giá
  hiệu lực của kỳ đó (đối chiếu `hieuLuc()`).
- SL_CHUAN_1_NGAY = Mức bù / Đơn giá khoán phải tính từ DM_LUONG, không hardcode
  33,333333/16,666667/49,9999999 — test đổi hẳn sang bộ số khác (150.000/5.000 = 30 tấn/ngày).
- Không xét ngưỡng công BT tháng đối với Đại Hiệp (khác 2 cách bù "theo tháng"/"theo ngày" cũ) — test
  đặt ngưỡng tháng rất cao, xác nhận không chặn bù theo ngày.
- Sai số làm tròn: chỉ làm tròn tiền 1 lần ở tổng tháng, không làm tròn từng ngày rồi cộng — test
  dựng 2 ngày mà phần bù mỗi ngày rơi đúng ở biên `,5` để 2 cách tính cho ra kết quả KHÁC NHAU, xác
  nhận engine theo đúng cách "cộng rồi làm tròn 1 lần".
- 2 công thức tương đương (SL bù × đơn giá ⟷ MAX(0, mức bù × hệ số − SL thực tế × đơn giá)) phải
  khớp nhau ở mọi điểm biên.

**Kết quả: toàn bộ 17 test PASS ngay với code hiện tại — không phải sửa `bacThang()` hay nhánh
`daihiep`**, xác nhận công thức đã đúng theo đúng quy tắc chủ sở hữu, không chỉ đối chiếu lý thuyết
mà có bằng chứng kiểm thử tường minh. Đã chạy lại toàn bộ 249 test unit/integration/regression +
`eslint --max-warnings 0` + `node --check` trên các file lõi — không có hồi quy.

---

## PV-10 (HOÀN TÁC — chờ xác nhận lại, KHÔNG được coi là đã sửa): Phụ cấp TN.01/TN.02

Phát hiện khi tra lại Giai đoạn 4 (phụ cấp) trong chính M thật đã trích sẵn từ trước (`Section1.m`,
HAK_DN) — truy ra đúng 2 query từng bị bỏ sót (`QR_CC_PHUCAP_TN`, `QR_PHUCAP_TN`), không cần thêm dữ
liệu thật mới:

- **Công thức M thật**: `Công tính phụ cấp = Công tính lương − Công lễ − Ngày phép`; `Hệ số phụ cấp
  tháng (TN.01/TN.02) = nếu Công tính lương ≥ (Công chuẩn − Tham chiếu) thì 1, ngược lại = Công tính
  phụ cấp / Công chuẩn`. Điều kiện ngưỡng luôn so bằng **Công tính lương THÔ** (≈ Tổng công hiện tại,
  chưa trừ gì) — không phải giá trị đã trừ.
- **`engine.js` trước đây** (nhánh phụ cấp không "cố định", không "Cách tính" trống — đúng dạng
  TN.01/TN.02 trong danh mục mẫu HAK_DN, "Cách tính" có mô tả chữ): hoàn toàn KHÔNG trừ gì
  (`cPC = Tổng công thô`) cho cả điều kiện ngưỡng và tỷ lệ — sai khác với M thật khi nhân viên có công
  lễ/phép trong kỳ.
- **Nhánh "Cách tính" TRỐNG** (C6, quy chế 2026, đã đối chiếu thật CNHAK 9/2026 42/44 và HAKQN 7/2026
  31/50): phần TRỪ dùng "phép + tăng ca" — khác M thật ("lễ + phép") nhưng **không đụng tới** vì đã có
  bằng chứng đối chiếu thật riêng cho đúng trường hợp này (công ty/kỳ khác, "Cách tính" trống không
  phải "Cách tính" có mô tả) — chỉ sửa phần SO NGƯỠNG của nhánh này (đang lỡ dùng giá trị đã trừ thay
  vì Công tính lương thô), vì đây là phần công thức M xác nhận dùng chung, không riêng theo "Cách
  tính". Lưu ý: cách so ngưỡng cũ của nhánh C6 chưa từng được chứng minh đúng/sai riêng bởi đối chiếu
  thật (42/44 và 31/50 không chắc có ai rơi đúng vào biên bị ảnh hưởng) — rủi ro đã nêu rõ với chủ sở
  hữu trước khi sửa.
- Đã hỏi lại chủ sở hữu đúng câu hỏi CÔNG THỨC/QUY CHẾ (không phải "tin số liệu nào") trước khi sửa —
  **chủ sở hữu xác nhận "Sửa theo PowerQuery"**.
- **Đã sửa** (commit `da9f0cd` trên `claude/v2-ocr-ky-hieu`): nhánh "Cách tính" có mô tả → trừ CÔNG
  LỄ + NGÀY PHÉP; điều kiện ngưỡng (cả 2 nhánh) → so bằng Tổng công thô. 2 test mới phân biệt rõ với
  công thức cũ bằng số liệu cụ thể. `tests/regression/v130.test.js`: mở rộng cơ chế loại trừ khác
  biệt có chủ đích (đã dùng cho PV-9/tăng ca) sang cột "Phụ cấp" — chỉ loại cho đúng người bị ảnh
  hưởng (xác định bằng "Phụ cấp" đổi khác giữa 2 bản), không loại hàng loạt. 251 test + 95 E2E pass
  (1 lần "Dừng đọc" OCR timeout — flake môi trường đã biết từ trước, re-run lại 95/95).

**CẬP NHẬT PV-10 — HOÀN TÁC**: ngay sau khi đẩy lên, 1 session Claude khác (Opus 5.5, session
`01RpNGnTAPSjPps7yMAFCAWf`) đã HOÀN TÁC commit `da9f0cd` bằng commit `5fc3881`, dẫn bằng chứng Excel
THẬT CNHAK 9/2026 (`RP_THBL`): 1 nhân viên có "Tiền PCTN" (phụ cấp trách nhiệm) thật = 98.077đ — engine
TRƯỚC `da9f0cd` ra đúng 98.077đ (khớp), SAU `da9f0cd` ra 100.000đ (lệch mới, do thay đổi của chính PV-10
gây ra). Đây là bằng chứng thật, khác nguồn (Excel đã chốt CNHAK) với M thật HAK_DN mà PV-10 dựa vào —
đúng kiểu mâu thuẫn như PV-9 (CN1/CN2) từng gặp.

**Phân tích lại (chưa hỏi chủ sở hữu, chỉ suy luận từ số liệu đã có — CHƯA đủ để tự sửa lại)**: số tiền
sau sửa (100.000đ) không khớp với giả thuyết "chỉ đổi phần TRỪ của nhánh 'Cách tính có mô tả'" (trừ
thêm lễ+phép chỉ có thể làm số tiền GIẢM, không thể tăng 98.077→100.000). Khả năng cao hơn: nhân viên
này rơi vào nhánh **"Cách tính" TRỐNG (C6)**, với "Số tiền" phụ cấp = 100.000đ (danh mục riêng của
CNHAK, khác 200.000/300.000 của TN.01/TN.02 mẫu HAK_DN) — và chính **phần sửa điều kiện NGƯỠNG** (so
bằng Tổng công thô thay vì giá trị đã trừ phép/tăng ca) đã làm người này bị coi là "ĐỦ NGƯỠNG" (ra
nguyên 100.000đ) trong khi Excel thật CNHAK vẫn tính theo TỶ LỆ (98.077đ, dưới ngưỡng) — tức là cách so
ngưỡng CŨ (dùng giá trị đã trừ phép/tăng ca) mới là cách đã được chứng minh đúng cho nhánh C6, không
phải cách theo M thật HAK_DN như PV-10 giả định. Phần đổi "Cách tính có mô tả" (trừ lễ+phép) CHƯA có
bằng chứng thật nào phủ nhận riêng nó — nhưng cũng chưa có bằng chứng thật nào XÁC NHẬN riêng nó (số
liệu CNHAK ở trên nhiều khả năng không đi qua nhánh này).

**Trạng thái: PV-10 coi như CHƯA xong** — không tự sửa lại / đẩy lại công thức này trong phiên này. Cần
hỏi lại chủ sở hữu (đúng kiểu câu hỏi CÔNG THỨC/QUY CHẾ như PV-9 từng làm): (1) nhánh "Cách tính" TRỐNG
(C6, quy chế 2026) — ngưỡng có nên tiếp tục so bằng giá trị đã trừ phép/tăng ca (cách cũ, vừa được
Excel CNHAK xác nhận đúng) hay so bằng Tổng công thô (theo M thật HAK_DN)? (2) nhánh "Cách tính" có mô
tả (TN.01/TN.02 kiểu HAK_DN) — phần trừ nên là lễ+phép (M thật HAK_DN) hay giữ nguyên không trừ gì
(cách cũ)? 2 câu có thể có 2 câu trả lời khác nhau (2 công ty, 2 kiểu "Cách tính" khác nhau).

---

## Giai đoạn 3 — bổ sung: sheet chi tiết bù lương Đại Hiệp theo ngày (Master Prompt V3 mục XVII)

Chủ sở hữu xác nhận CÓ cần thêm sheet/cột chi tiết theo ngày (công BT, hệ số bậc thang, SL
chuẩn/tham chiếu/thực tế/bù) vào file Excel "Phân bổ khối lượng tính lương" — và KHÔNG đổi tên cột
"Đơn giá bù lương" của DM_LUONG (giữ nguyên, không theo tên "Mức bù lương SL" của mục 4.2 prompt).

Đã làm (commit `56cb5be` trên `claude/v2-ocr-ky-hieu`):

- **`engine.js`**: hoist `bacThang()` ra module scope (trước đây khai báo bên trong `tinhBangLuong`,
  không dùng lại được); thêm `chiTietBuNgayDaiHiep(db, nam, thang)` — tái tạo ĐÚNG công thức bù theo
  ngày bậc thang của `tinhBangLuong` (nhánh `cheDoBu === "daihiep"`) thành 1 dòng/ngày có sản lượng
  (công BT, hệ số, SL chuẩn/ngày, SL tham chiếu, SL thực tế, SL bù, tiền bù) — không tính lại bằng
  công thức khác, chỉ bóc chi tiết từng ngày của cùng 1 công thức, nên tổng mỗi người CỘNG KHỚP đúng
  cột "Lương bù SL" của bảng lương chính thức (có test xác nhận bằng số, không chỉ bằng mắt).
- **`ui/pbkl-xlsx.js`**: thêm sheet "Bu luong theo ngay - DH", nhóm theo phòng ban → nhân viên → ngày,
  có dòng "Tổng bù cả tháng" mỗi người + dòng tổng toàn file; thêm ghi chú giải thích công thức +
  hướng dẫn đối chiếu vào sheet "Huong dan su dung".
- **`app.js`** (`exportPBKL`): gọi `chiTietBuNgayDaiHiep` với ĐÚNG dữ liệu đã dùng để tính bảng lương
  của kỳ (`HRM.staffForPayroll` + `HRM.sanLuongKy` đã phân bổ) — chỉ xuất sheet này khi cơ chế bù =
  "daihiep" và có ít nhất 1 dòng.
- Sửa 1 lỗi tự phát hiện khi viết test: dòng "Tổng bù cả tháng (Mã NV)" lúc đầu đặt nhãn ở cột bị
  MERGE (ExcelJS tự xóa giá trị các cell bị merge trừ cell đầu) → nhãn biến mất trên file thật dù số
  tiền vẫn đúng; đã chuyển nhãn sang cột đầu (giống cách các sheet khác trong file đã làm).
- 1 test unit mới (`engine.test.js`, đối chiếu tổng chi tiết = "Lương bù SL") + cập nhật test E2E
  (danh sách sheet, đối chiếu tổng bù theo ngày của T2/T3 = 140.000đ khớp sheet tổng hợp). 250 test
  unit/integration/regression + 96 E2E pass.

---

## PV-11 (ĐÃ LÀM — hướng giải quyết PV-10): "Loại công thức" cho DM_PHUCAP / DM_HOTRO

Thay vì chọn 1 trong 2 công thức phụ cấp (M thật HAK_DN hay cách cũ đã đối chiếu CNHAK thật) để áp
dụng CHUNG — việc không thể quyết được chỉ bằng suy luận do có bằng chứng thật mâu thuẫn ở PV-10 —
chủ sở hữu chỉ đạo: **thêm khả năng CHỌN công thức theo mã trong chính danh mục**, đúng mẫu đã làm
cho DM_TANGCA ("Loại công thức", Giai đoạn 2/PV-8) và đúng tinh thần Master Prompt V3 mục IV ("không
viết cứng công thức theo mã nguồn, quản lý qua danh mục").

Đã làm (commit `38f6772` trên `claude/v2-ocr-ky-hieu`):

- **DM_PHUCAP** — cột mới "Loại công thức": để trống = ĐÚNG hành vi hiện tại (sau khi PV-10 bị hoàn
  tác, không đổi số liệu bất kỳ mã nào đang dùng, kể cả TN.01/TN.02 mẫu HAK_DN và mã của CNHAK/HAKQN).
  4 giá trị có thể khai: `CO_DINH` (ép cố định) · `TYLE_KHONG_TRU` (tỷ lệ, không trừ gì — mặc định khi
  "Cách tính" có mô tả) · `TYLE_TRU_PHEP_TANGCA` (tỷ lệ, trừ phép+tăng ca, ngưỡng so giá trị đã trừ —
  mặc định khi "Cách tính" trống + quy chế 2026, ĐÃ đối chiếu CNHAK/HAKQN thật, KHÔNG đổi) ·
  `TYLE_TRU_LE_PHEP` (tỷ lệ, trừ lễ+phép, ngưỡng so Tổng công thô — đúng M thật HAK_DN, CHỈ áp dụng
  khi 1 mã cụ thể được khai rõ, không tự động theo "Cách tính").
- **DM_HOTRO** — cột mới "Loại công thức": để trống = đúng công thức cũ theo VỊ TRÍ gán ("Mã hỗ trợ"
  = theo Ngày cơm, "Mã hỗ trợ 2" = bù thiếu công chuẩn). 2 giá trị: `HT_THEO_NGAY` / `HT_THIEU_CHUAN`
  — cho phép 1 mã hỗ trợ MỚI dùng công thức khác với vị trí gán mặc định, không cần sửa engine.
- 5 test mới xác nhận: để trống không đổi số liệu hiện có; mỗi "Loại công thức" mới cho đúng kết quả
  khi được khai rõ. 255 test (gồm `v130.test.js` — 0 lệch với baseline v1.3.0) + 96 E2E pass.

**Vẫn còn mở**: chưa có mã phụ cấp thật nào được khai "Loại công thức" = `TYLE_TRU_LE_PHEP` — khi có
đủ dữ liệu thật xác nhận 1 mã/công ty cụ thể cần công thức M thật HAK_DN (lễ+phép), chỉ cần khai cột
này cho đúng mã đó trong danh mục của công ty đó, không cần sửa `engine.js` nữa.

---

## Giai đoạn 4 (Master Prompt V3, mục IX-XV): các nghiệp vụ lương

Bắt đầu rà soát theo đúng danh mục mục IV: Lương thời gian, Tăng ca theo mã (đã xong Giai đoạn 1), Công
công tác, Phụ cấp (đã xong PV-10/11), Hỗ trợ (đã xong PV-11), Thuế, Bảo hiểm, Thực lĩnh.

### PV-12 (ĐÃ LÀM — mẫu catalog-driven như PV-11): "Lương thời gian" của mã SP

Đối chiếu mục X.3 với M thật HAK_DN (`Section1.m`, cột "Công tính TG") — phát hiện:

- **M thật**: `nếu Mã tiền lương 1 = "SP" thì Công tính TG = Công lễ + Công TĂNG CA`.
- **`engine.js` + `docs/PAYROLL_FORMULAS.md` ("C3") hiện tại**: `Công lễ + Công PHÉP` — khác M thật,
  không có bằng chứng đối chiếu nào được ghi lại cho "C3" (khác C5 là đã đối chiếu rõ).
- **Đã thử đối chiếu bằng số liệu thật** (như cách làm với CN1/CN2) — tra cả 3 bộ dữ liệu HAK_DN đang
  có (T9/2025 `QR_TH_CC`, T11/2025 `RP_THCHAMCONG`/`RP_THBL`): toàn bộ 16 nhân viên SP trong các kỳ đó
  đều có Công lễ = Công phép = Công tăng ca = 0 (hoặc giá trị trùng nhau) — **không có dữ liệu nào
  phân biệt được 2 công thức**. Không tự sửa khi chỉ có 1 nguồn M thật mà không đối chiếu được số
  liệu — rút kinh nghiệm từ PV-10 (sửa 1 lần, bị hoàn tác vì thiếu đối chiếu).
- Đã hỏi lại chủ sở hữu; **chỉ đạo: thêm "Loại công thức" vào DM_LUONG** (đúng mẫu PV-8/PV-11, không
  ép 1 công thức chung). Commit `3ad6387` trên `claude/v2-ocr-ky-hieu`: để trống = hành vi cũ (lễ+phép,
  không đổi số liệu công ty nào đang dùng); `TG_LE_TANGCA` = đúng M thật HAK_DN (lễ+tăng ca). 2 test
  mới. 257 test (gồm `v130.test.js` — 0 lệch baseline) + 96 E2E pass.

### Các mục khác đã rà soát nhanh (chưa phát hiện gap cần sửa)

- **13 Thuế TNCN** (mã TNCN1-4): engine đã catalog-driven — mã TNCN1/TNCN2 giữ tên cũ (tương thích),
  mọi mã khác (TNCN3/TNCN4...) dò qua `DM_TNCN`."Nội dung" (chứa "vãng lai"/"lũy tiến") + "Mức thuế",
  không hardcode theo tên mã. Đạt yêu cầu mục XIII, không cần sửa.
- **14.1 Ngưỡng truy thu BH**: đã cấu hình theo danh mục (`dm_luong`."Ngưỡng truy thu BH (công)"), theo
  đúng mã lương + kỳ hiệu lực — không hardcode 15/20 công theo nhóm. Đạt yêu cầu mục XIV, không cần sửa.
- **IX. Hình thức công "CT" (công công tác)**: Master Prompt liệt kê "CT" là 1 loại "Hình thức công"
  riêng (như BT/PN/CL/DC/TRCH/CC), nhưng `tongHopChamCong()` hiện tại CHƯA có nhánh riêng cho "CT" —
  dòng chấm công "Hình thức công"="CT" sẽ bị tính lẫn vào "Tổng công" như công BT thường (không có
  cảnh báo). Engine ĐANG xử lý "công công tác" bằng cơ chế khác (nhãn trong ô, ví dụ "1QC"/"2ĐN"/"DQ"
  gắn trên 1 dòng BT — mục `nhanTheoNgay`/`pcCT`) — cơ chế này ĐÃ khớp đúng M thật (`QR_PHUCAP_CT`,
  xem PV-6 trước đó). Chưa thấy công ty nào thực tế dùng "Hình thức công"="CT" làm 1 dòng riêng (mọi
  dữ liệu thật đã xem đều dùng kiểu nhãn-trên-dòng-BT) — **để ngỏ, chưa sửa vì chưa có nhu cầu/dữ liệu
  thật nào cần đến dòng "CT" riêng; nêu ra để chủ sở hữu biết nếu sau này có công ty dùng kiểu này.**
