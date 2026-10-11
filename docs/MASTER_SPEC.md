# MASTER_SPEC — LUONG_HAK Enterprise HRM & Payroll

## 1. Mục tiêu
Hệ thống quản trị nhân sự & tiền lương **chạy offline hoàn toàn trên Windows**, dùng được trong doanh nghiệp thực tế (ưu tiên doanh nghiệp sản xuất/dăm gỗ của HAK Group), tùy biến theo đơn vị, mở rộng lâu dài, sẵn sàng đồng bộ online về sau.

Thứ tự ưu tiên: **1. Tính đúng · 2. Bảo toàn dữ liệu · 3. Kiểm soát nghiệp vụ · 4. Hiệu suất · 5. Dễ dùng · 6. Mở rộng · 7. Thẩm mỹ.**

## 2. Phạm vi chức năng (đích)
| Nhóm | Chức năng | Trạng thái v1.4.0 |
|---|---|---|
| Tổ chức | Nhiều cấp, định biên, trung tâm chi phí, TK hạch toán, lịch sử | Phòng ban/khối + TK chi phí (1 cấp) |
| Hồ sơ nhân sự | Vòng đời, hồ sơ cá nhân, nhân thân, hợp đồng, phụ lục, điều chuyển, khen thưởng/kỷ luật, khám SK, tài liệu | Có (theo QL_NHANSU) |
| Chấm công | Nhiều hình thức, ca, lịch, ngày lễ, quy tắc, import có kiểm tra, khóa | Bảng công tháng + import có kiểm tra + khóa kỳ |
| Sản lượng | Phiếu cân, phân bổ nhiều người, đối chiếu tổng | Phiếu cân theo người + cảnh báo đối chiếu |
| Tính lương | Rule engine cấu hình, giải thích từng dòng | Engine cố định (đối chiếu dữ liệu thật) |
| BH & thuế | Chính sách có hiệu lực, căn cứ pháp lý, quyết toán năm | Có hiệu lực theo kỳ; báo cáo thuế năm |
| Chốt & điều chỉnh | Snapshot, phiên bản, phê duyệt, điều chỉnh có vết | Snapshot + phiên bản + lịch sử + checksum (chưa có phê duyệt) |
| Tạm ứng & thanh toán | Đề nghị/duyệt/khấu trừ 1 lần, thanh toán nhiều đợt, chống lặp | Tạm ứng theo kỳ; DS chuyển khoản; phiếu chi |
| Báo cáo | Dashboard, 18 báo cáo, tùy chỉnh | 16 báo cáo lương + nhân sự, xuất Excel |
| Phân quyền & bảo mật | Vai trò, phạm vi, mã hóa | 2.0-α2: đăng nhập, 7 vai trò, kiểm tra quyền ở nghiệp vụ, chỉ Admin sửa hồi tố; chưa có phạm vi theo phòng ban, chưa mã hóa |
| Dữ liệu | SQLite, migration, backup manager | JSON + migration + backup manager |

## 3. Ràng buộc
- Không mất dữ liệu/chức năng hiện có; mọi thay đổi có test hồi quy.
- Không tự sáng tạo công thức tiền lương: quy tắc chưa rõ → câu hỏi (`BUSINESS_RULES.md` §2).
- Không dùng `eval` cho công thức người dùng.
- Không sửa nhánh `main` trực tiếp; mọi thay đổi qua Pull Request, CI xanh.

## 4. Tiêu chí nghiệm thu (XXVI) — tình trạng sau Phase 1
| Tiêu chí | Tình trạng |
|---|---|
| Không còn lỗi Critical chưa xử lý | ⚠ còn GAS-01 (bản Google, chờ chủ sở hữu quyết định); bản offline: 0 |
| Lỗi High ảnh hưởng dữ liệu/tiền lương đã xử lý | ✅ (SEC-03 đã giảm thiểu, chờ vá thư viện) |
| Kiểm thử nghiệp vụ bắt buộc đạt | ✅ 87/87 + E2E 39/39 (2.0.0-alpha.2) |
| Công thức đã đối chiếu | ✅ hồi quy 100% với v1.3.0; ⏳ chờ xác nhận Q-01…Q-10 |
| Không có dữ liệu trùng ngoài quy tắc | ✅ importer + form chặn trùng; *Kiểm tra dữ liệu* phát hiện trùng cũ |
| Dữ liệu chốt lương truy vết được | ✅ snapshot đầu vào + phiên bản + lý do + checksum + nhật ký |
| Backup & restore được kiểm thử | ✅ unit + integration + E2E |
| Migration bảo toàn dữ liệu | ✅ test migration v1.0 và chuẩn hóa 1.4 |
| Báo cáo khớp dữ liệu nguồn | ⏳ báo cáo hiện kiểm thử thủ công; Phase 2 tách module + test |
| EXE cài & chạy trên Windows | ⏳ chờ cài thử |
| Tài liệu sử dụng & bàn giao | ✅ `docs/` |
| Giới hạn công bố rõ ràng | ✅ `RELEASE_NOTES.md`, `ARCHITECTURE.md` §6 |
