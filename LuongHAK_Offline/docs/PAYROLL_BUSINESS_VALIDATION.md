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

---

## PV-2 (đã kiểm tra, KHÔNG phải lỗi): Truy thu bảo hiểm (R-57/R-60)

Không tìm được trường hợp nhân viên nào bị kích hoạt "Truy thu bảo hiểm" (chưa đủ ngưỡng công) trong
2 bộ dữ liệu thật đang có (`RP_BHXH` của HAK_DN T11/2025 không có cột này; `RP_THBL` có cột nhưng toàn
giá trị 0 ở các dòng đã xem) — **chưa đủ dữ liệu thật để đối chiếu công thức này**, không phải đã
xác nhận đúng. Để ở mục cần kiểm tra thêm khi có dữ liệu phù hợp (ví dụ nhân viên nghỉ không lương
giữa tháng, hoặc công < ngưỡng).

## PV-3 (đã kiểm tra lại từ phiên trước, để tham chiếu): KPCĐ phần NLĐ

Đã phát hiện ở phiên trước (tách KPCĐ NLĐ khỏi "Cộng BH NLĐ đóng" — xác nhận đúng bằng dữ liệu thật
`RP_BHXH`), đã sửa và PUSH, nhưng **sau đó bị hoàn tác** (commit `fe3bdd7`) với lý do "đổi công thức
chưa được duyệt". Bài học áp dụng cho toàn tài liệu này: dù có bằng chứng Excel rõ ràng, vẫn phải chờ
phê duyệt trước khi đổi code đang chạy thật, vì có thể ảnh hưởng ngược đến các kỳ đã chốt bằng công
thức cũ hoặc có quy định nội bộ chưa thể hiện trong dữ liệu mẫu.

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

## Việc tiếp theo (đề xuất)

- **PV-1 (TNCN0)**: chờ người dùng kiểm tra Danh mục Thuế TNCN thật — mã "TNCN0" có định nghĩa
  trong đó không, nội dung gì. Không sửa code cho đến khi có câu trả lời này.
- **PV-2 (truy thu BH)**: chưa có dữ liệu thật nào kích hoạt được trường hợp này trong 2 bộ dữ liệu
  đang có (đã kiểm tra lại, không có ai vào làm/nghỉ giữa tháng ở cả HAK_DN T11/2025 và Đại Hiệp
  T8/2026) — cần dữ liệu tháng khác có trường hợp này mới đối chiếu được.
- **PV-5 (Lương hỗ trợ 4.000.000đ của Bùi Văn Hậu)**: cần Danh mục Lương (`dm_luong`) thật của
  HAK_DN để biết mã "TG1" có cấu hình "Lương phụ" khớp con số này không.
- Đã kiểm tra thêm (PV-4): lương thời gian (kể cả biến thể qc2026 "trả đủ công"), tiền cơm, cơ chế
  phụ cấp công tác theo nhãn chấm công — đều khớp dữ liệu thật, không phải lỗi.
- Tăng ca (mã TC5), lương sản lượng + bù sản lượng (2 chế độ "to"/"daihiep"), KPCĐ: đã kiểm tra kỹ ở
  các lượt trước trong phiên này (xem lịch sử hội thoại) — khớp dữ liệu thật.
