# BUSINESS_RULES — Quy tắc nghiệp vụ

## 1. Quy tắc đã áp dụng

### Dữ liệu & nhập liệu
- R-01 Ngày lưu `YYYY-MM-DD`; kỳ `YYYY-MM`; tiền là số đồng (hiểu đúng "1.500.000", "500.000", "1,500,000").
- R-02 Mã định danh (CCCD, SĐT, số TK, MST, Mã NV, Số HĐLĐ, Phiếu cân) luôn là chữ; CCCD 12 số, SĐT 10 số (bù số 0 bị Excel làm mất).
- R-03 Khóa nghiệp vụ chống trùng (nhập Excel và form): xem `DATABASE_SCHEMA.md` §1. Nhập trùng khóa → **cập nhật**; trùng y hệt → bỏ qua.
- R-04 Dữ liệu phát sinh (chấm công, tạm ứng, thưởng…) phải có Mã NV có trong Nhân sự.
- R-05 Nhập Excel bắt buộc qua bước **xem trước**; tự sao lưu trước khi ghi ≥ 20 dòng.

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

### Sao lưu
- R-30 Sao lưu đầu ngày (60 ngày), khi mở app (10 bản), trước thao tác lớn (20 bản/loại), khi dữ liệu giảm > 50%.
- R-31 Không bao giờ ghi đè file dữ liệu bằng dữ liệu không hợp lệ; không sao lưu file hỏng; file hỏng được cất giữ, không xóa.

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
