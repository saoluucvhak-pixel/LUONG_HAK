# Đối chiếu bảng lương Excel (Power Query) T9/2025 và T11/2025 với engine

Nguồn: 3 workbook lương HAK Đà Nẵng do chủ sở hữu cung cấp (61 nhân viên/kỳ). Dữ liệu cá nhân **không** nằm trong repo;
công cụ: `tools/recon/` (xuất JSON → chạy so từng nhân viên). Chạy ngày 13/10/2026, Linux, quy chế `2026`.

## Kết quả

| Kỳ | Khớp hoàn toàn (thu nhập + BH) | Phần lệch | Nguyên nhân đã chứng minh |
| --- | --- | --- | --- |
| T9/2025 | 48/61 | 12 SP (sản lượng), 1 truy thu BH | Quy tắc chia sản lượng theo công (R-73, V5 mục IX) khác Excel; truy thu BH (xem 3) |
| T11/2025 | 45/61 (49/61 khi tắt bù theo tổ) | 12 SP (sản lượng); 4 SP chỉ lệch do bù | Như trên; Excel T11 **không có** tiền bù sản lượng |

Chứng minh bằng thực nghiệm (không phải suy đoán):
1. **Mô phỏng đúng mã M của Excel** (`RP_CTPBSL`: tổ chia đều, loại người có tên cuối nằm trong "NV vắng" theo `Text.Contains`, theo ngày vào/nghỉ) cho **0/61** lệch so với cột sản lượng của Excel T9.
2. **Cô lập quy tắc công**: giả lập tổ đủ công mọi ngày thì phân bổ của app cho **0/16** lệch so với Excel ở cả T9 lẫn T11 (T9 còn 1,04 tấn mã tổ `KPB`, Excel cũng loại).
   ⇒ chênh lệch sản lượng 100% là do **quy tắc mới đã được chủ sở hữu duyệt** (ngày công = 0 thì không chia; cả tổ chưa có công BT thì phiếu ở trạng thái `PENDING_ATTENDANCE`): T9 có 71,96 tấn (phiếu 2/9, ngày lễ, tổ nghỉ nhưng trạm cân vẫn chạy) chờ xử lý.
3. Các khoản còn lại khớp từng đồng ở 45–48 người: lương thời gian, tăng ca (TC2/TC4), phụ cấp, tiền cơm, hỗ trợ (HT.02), BH NLĐ, KPCĐ NLĐ, tạm ứng.

## Điểm KHÁC giữa Excel và app cần chủ sở hữu quyết định (chưa sửa code)

1. **Thuế TNCN có trừ vào thực lĩnh không?** Excel T9: "Tiền lương còn nhận" = Tổng thu nhập − BH NLĐ − KPCĐ − tạm ứng − trừ khác, **không** trừ thuế (Thuế TNCN chỉ hiển thị). Ở T11 thuế của người có thuế (1 trường hợp) được kế toán nhập tay vào "Trừ khác". App hiện tự trừ thuế khỏi thực lĩnh → lệch thực lĩnh với những người có thuế.
2. **KPCĐ NLĐ có được trừ khi tính thuế không?** T9 Excel không trừ; T11 Excel có trừ. App trừ (theo T11). Chênh lệch thuế vài nghìn đồng/người. Về luật, đoàn phí không thuộc các khoản được trừ khi tính thu nhập chịu thuế — cần xác nhận với kế toán thuế.
3. **Truy thu BH khi chưa đủ công**: T9 Excel vừa trừ phần NLĐ (519.540 + KPCĐ 24.740) **vừa** truy thu phần doanh nghiệp (1.162.780). App khi dưới ngưỡng chỉ truy thu phần doanh nghiệp, **không** trừ phần NLĐ (chênh 544.280). Ngưỡng công thật chưa rõ (nằm giữa 18,5 và 19 công ở TG1; app cần khai "Ngưỡng truy thu BH (công)" ở mã lương).
4. **Công chuẩn của mã CĐ**: Excel T9 ghi 25, app tính 30; không ảnh hưởng tiền (lương cố định).

## Giới hạn
Chỉ đối chiếu 2 kỳ HAK Đà Nẵng ở quy chế 2025; chưa đối chiếu kỳ có TC1/TC3/TC5/TC6, DQ, đơn nghỉ phép, kỳ 2026 của CNHAK/HAKQN; chưa chạy trên Windows.
