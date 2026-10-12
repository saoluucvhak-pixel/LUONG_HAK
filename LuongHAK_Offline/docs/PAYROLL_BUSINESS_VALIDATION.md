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
người phụ thuộc theo tên). Chưa tìm thấy trường cụ thể nào bị thiếu — nếu bạn thấy thiếu trường nào
cụ thể, nói rõ tên trường giúp tôi kiểm tra tiếp.

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

## PV-5 (CHƯA kết luận được — thiếu dữ liệu danh mục): "Lương hỗ trợ" của Bùi Văn Hậu

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
