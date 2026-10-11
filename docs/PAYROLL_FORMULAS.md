# PAYROLL_FORMULAS — Công thức tính lương (engine v1.4.0)

> Công thức **đúng như mã nguồn** `LuongHAK_Offline/engine.js` (chuyển từ `Tinhluong.gs`/`Tinhcong.gs` của bản Google, đã đối chiếu dữ liệu thật HAK_DN T10/2025 theo chú thích trong mã gốc).
> Phase 1 **không thay đổi công thức**; kiểm thử hồi quy xác nhận kết quả trùng v1.3.0 (trừ BUG-002 — đọc số tiền "500.000"). Các điểm cần nghiệp vụ xác nhận đánh dấu **[Q-xx]** — xem `BUSINESS_RULES.md`.

## 1. Đầu vào của một nhân viên trong kỳ
Lấy từ hồ sơ (`hr.js staffForPayroll`): hợp đồng còn hiệu lực trong kỳ → dòng *Lương & phụ lục HĐ* mới nhất có `Hiệu lực từ ≤ cuối tháng` **[Q-01]** → mã lương 1/2, lương thỏa thuận (LTT), lương cơ bản (LCB), mã tăng ca, phụ cấp, hỗ trợ, mã BH, phương thức thuế; số người phụ thuộc (NPT) = nhân thân "Đăng ký phụ thuộc = Có" còn hiệu lực trong kỳ.
Danh mục dùng dòng còn hiệu lực trong tháng (`Hiệu lực từ ≤ cuối tháng`, `Hiệu lực đến ≥ đầu tháng`, lấy dòng có Hiệu lực từ mới nhất).

## 2. Tổng hợp công (bảng chấm công, 1 dòng = 1 NV × 1 hình thức công)
- Ô ngày: số công + nhãn tùy chọn (`1`, `0.5`, `1QC`).
- **Tổng công** = tổng mọi dòng **trừ CC** (gồm cả dòng tăng ca TC*) **[Q-02]**.
- Công tăng ca = dòng có chữ `TC`; Công lễ = CL; Phép = PN; Di chuyển = DC; Trung chuyển = TRCH; Ngày cơm = CC (+ Suất cơm).
- Công Chủ nhật = công các ngày Chủ nhật ở dòng không phải TC/CC.

## 3. Công chuẩn (theo "Cách tính" của mã lương 1)
| Cách tính | Công chuẩn |
|---|---|
| chứa "thực tế" | = Tổng công (nếu 0 → 26) |
| "Số ngày của tháng" | số ngày trong tháng |
| khác (gồm "… - tất cả ngày CN", "Cố định", trống) | số ngày − số Chủ nhật |
| kết thúc "- N" | (số ngày − số CN) − N |

## 4. Các khoản thu nhập
| Khoản | Công thức |
|---|---|
| Đơn giá TG | LTT / Công chuẩn |
| Công tính TG | min(Tổng công, Công chuẩn) |
| **Lương thời gian** | CĐ: LTT · CN1/CN2/SP: LTT × Công tính TG · còn lại: ROUND(Đơn giá TG × Công tính TG) |
| Lương phụ | "Lương phụ" của mã lương |
| **Lương sản lượng** (mã có "SP" trong Mã hình thức lương) | ROUND(Tấn × Số tiền khoán) |
| Bù SL theo tháng | nếu Tấn/Tổng công < ĐK_Bù: max(0, ROUND(Đơn giá bù × Tổng công) − Lương SL) |
| Bù SL theo ngày | Σ ngày có công: nếu tấn ngày/công ngày < ĐK_Bù: max(0, ROUND(Đơn giá bù × công ngày) − ROUND(tấn ngày × Số tiền khoán)) |
| (α19) Bù SL theo ngày — bậc thang (công cụ HAK / Đại Hiệp) | Σ ngày CÓ sản lượng: max(0, bậc(công BT ngày) × Đơn giá bù − tấn ngày × Số tiền khoán); bậc ngày thường: <0,5→0 · 0,5–<1→0,5 · ≥1→1; Chủ nhật thêm ≥1,5→1,5. Chỉ công BT; không xét ngưỡng; không áp dụng bơm dăm. Làm tròn tổng tháng |
| (α19) Bù SL theo bình quân tổ (công cụ HAK) | BQ tổ = Σ(tấn × Số tiền khoán + xe × đơn giá BD) của người lương SP cùng Mã PB ÷ số ngày của tháng ÷ số người đó. Nếu BQ < Đơn giá bù và công BT ≥ "Ngưỡng công bù theo tổ": ROUND((Đơn giá bù − BQ) × công BT) |
| (α19) Chia phiếu theo tổ | Phiếu ghi Mã phòng ban (không Mã NV): KL ÷ số người của tổ có mặt ngày cân (hợp đồng hiệu lực, phụ lục ngày đó thuộc tổ, không có trong NV vắng — so từ cuối họ tên hoặc Mã NV). Không ai nhận → "chưa phân bổ" + cảnh báo |
| Lương bơm dăm | ROUND(Số xe × đơn giá) — đơn giá = Số tiền khoán của mã lương 2 (nếu là SP) hoặc "Đơn giá bơm dăm" |
| **Tăng ca** (khi Công chuẩn > 0) | CN1/CN2: ROUND(LTT × Công TC) · TC5: ROUND(Tiền cố định / Công chuẩn × Công TC) · khác: ROUND(Đơn giá TG × Công tính TC) |
| Công tính TC | TC1: max(0, CTL − Lễ − TrCh − Phép − TC − Chuẩn)×HS + TC×HS · TC2: như TC1 nhưng trừ thêm DC · TC3: (TC + CN)×HS · TC4/khác: TC×HS · TC6: max(0, CTL − TrCh − Lễ − Chuẩn) (không hệ số) |
| **Phụ cấp** | "Cách tính" trống hoặc chứa "cố định": Số tiền (hoặc LTT × Tỷ lệ) · ngược lại: Tổng công ≥ Chuẩn − Tham chiếu ? Số tiền : ROUND(Số tiền / Chuẩn × Tổng công) |
| Phụ cấp công tác | Σ theo nhãn chấm công: số ngày có nhãn X × Số tiền của mã phụ cấp X |
| Lương hỗ trợ (Hỗ trợ slot 2) | nếu Tổng công ≤ Chuẩn: ROUND((Chuẩn − Tổng công) × Số tiền) |
| Tiền cơm (Hỗ trợ slot 1) | ROUND(Ngày cơm × Số tiền) |
| Thưởng, Thu nhập khác | tổng mục Thưởng/Trừ có Ngày hạch toán trong kỳ |
| **Tổng thu nhập** | tổng các dòng trên |

Phân slot hỗ trợ (`hr.js`): mã có "công chuẩn/cơ giới/thiếu" (không chứa "cơm") → slot 2; còn lại slot 1.

### 4a. Phụ lục hiệu lực giữa tháng (engine 1.5.0, Q-22 / R-56)
Áp dụng khi **cả 3** điều kiện đúng:
- phụ lục đang hiệu lực có *Cách áp dụng trong tháng hiệu lực* = **Từ ngày hiệu lực**;
- *Hiệu lực từ* nằm sau ngày 1 của kỳ;
- phụ lục liền trước (cùng hợp đồng) có **cùng mã lương 1**.

Khi đó:
- `Lương thỏa thuận kỳ = (LTT cũ × công chính trước ngày hiệu lực + LTT mới × công chính từ ngày hiệu lực) / tổng công chính`. Công chính là công các dòng không phải tăng ca, không phải cơm.
- Mọi công thức dùng Lương thỏa thuận (lương thời gian, công nhật, cố định, đơn giá tăng ca, phụ cấp theo tỷ lệ) dùng số bình quân này.
- **BH** vẫn theo phụ lục đang hiệu lực (Lương cơ bản, hoặc LTT mới nếu không có).
- Cột *Lương thỏa thuận* trên bảng lương hiện mức mới. Cảnh báo ghi số công theo từng mức.
- Ví dụ (U-PL-01): TG1, 20 tr → 26 tr từ 16/09/2026, mỗi nửa tháng 13 công → 10.000.000 + 13.000.000 = **23.000.000**.
- Khác mã lương thì không chia: cả tháng theo phụ lục mới, kèm cảnh báo.
- Không chọn, hoặc chọn *Cả tháng*: như engine 1.4.0.

### 4b. Chia chi phí theo phòng ban khi điều chuyển (engine 1.6.0, Q-19 / R-53)
- Phụ lục trong kỳ (cùng hợp đồng) đổi *Phòng ban* → `staffForPayroll` ghi các đoạn `Mã PB@từ ngày`.
- Engine đếm **công chính** ở từng đoạn, rồi ghi `Phân bổ PB = [{Mã PB, Phòng ban, Công, Tỷ lệ}]` vào dòng lương.
- **Không đổi** số tiền lương.
- Báo cáo *Tổng hợp theo phòng ban* và *Bảng hạch toán* chia từng khoản theo `Tỷ lệ`. Số lẻ được làm tròn theo phần dư lớn nhất, nên tổng các phòng luôn bằng tổng bảng lương.
- Ví dụ (U-ALLOC-02): 20 tr, 13 công ở 01.01 (TK 642) và 13 công ở 02.01 (TK 622) → mỗi TK 10.000.000.

## 5. Bảo hiểm
- Lương đóng BH = LCB, nếu trống = LTT **[Q-07]**. Không áp mức trần **[Q-06]**.
- Đủ ngưỡng (không khai "Ngưỡng truy thu BH" hoặc Tổng công ≥ ngưỡng): BH NLĐ = ROUND(Lương đóng × (NLĐ.BHXH + BHYT + BHTN)).
- Dưới ngưỡng: BH NLĐ = 0, **Truy thu** = phần công ty đóng = ROUND(Lương đóng × (DN.BHXH+BHYT+BHTN+KPCĐ)) **[Q-04]**.

## 6. Thuế TNCN
| Phương thức | Thu nhập chịu thuế | Thuế |
|---|---|---|
| Vãng lai (VL01, TNCN1) | Tổng thu nhập | Tổng thu nhập × Mức thuế (mặc định 10%) **[Q-10]** |
| Lũy tiến (LT01, TNCN2, mã lạ) | Tổng TN − BH NLĐ − Tiền cơm **[Q-03]** | Lũy tiến từng phần trên max(0, chịu thuế − GT bản thân − NPT × GT phụ thuộc) |
| Miễn (MT00, TNCN0, trống) | Tổng TN − BH NLĐ | 0 |

Biểu thuế và mức giảm trừ lấy theo hiệu lực của kỳ (12/2025: 7 bậc, GT 11tr/4,4tr; từ 01/2026: 5 bậc, GT 15,5tr/6,2tr — **số liệu khởi tạo, kế toán phải đối chiếu văn bản pháp luật hiện hành**).

## 7. Thực lĩnh
`CL = Tổng TN − BH NLĐ − Truy thu − Thuế − Trừ khác − Tạm ứng`
`Thực lĩnh = CL ≥ 0 ? ROUND(CL / 1000) × 1000 : 0` — CL < 0 có cảnh báo (v1.4) **[Q-05]**.

## 8. Ví dụ kiểm chứng (đã thành test tự động)
| Tình huống | Kết quả | Test |
|---|---|---|
| TG1, LTT 9tr, đủ 26/26 công | LTG 9.000.000 | `engine.test` |
| TG1, 13/26 công | 4.500.000 | `engine.test` |
| CN1 300.000 × 20 công + 2 công TC | LTG 6.600.000 (22 công), TC 600.000 | `engine.test` |
| SP 30 tấn × 6.000, ĐK 5 tấn/công, bù 300.000 | SL 180.000, bù 7.620.000 | `engine.test` |
| (α19) 0,7 công BT, 20 tấn · 1 công BT, 20 tấn · 1 công không SL (bậc thang, 6.000đ, sàn 200.000) | 0 · 80.000 · 0 (= công cụ) | `production-alloc.test` U-PA-05 |
| (α19) Tổ 3 người 900 tấn, tháng 30 ngày, sàn 200.000, ngưỡng 15: công BT 20 / 10 / 16 | bù 2.800.000 / 0 / 2.240.000 | U-PA-06 |
| BH01, LCB 5tr | 525.000; dưới ngưỡng 14 công: truy thu 1.175.000 | `engine.test` |
| Lũy tiến 2026, TN tính thuế 40tr | 4.500.000 | `engine.test` |
| 12/2025 TN 20tr → 650.000; 01/2026 → 225.000 | đổi biểu theo hiệu lực | `engine.test` |
| HĐ TG1 20tr, LCB 6tr, LT01 | thực lĩnh 19.177.000 | `integration/flows` |
