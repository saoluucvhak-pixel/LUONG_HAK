# V10.1 — Audit và danh sách thay đổi

Nhánh `feature/luong-hak-v10-1-hardening-payroll-release`, tách từ HEAD `ed9184d` của PR #30 (V10). Mọi lỗi dưới đây đã có commit, test tự động và kết quả chạy trên HEAD này (xem `V10_1_TEST_RESULTS.md`). **Công thức tính lương (`engine.js`, `hr.js`) không bị sửa** — `git diff ed9184d..HEAD -- engine.js hr.js` rỗng.

Mức: P0 = sai tiền/mất dữ liệu/lọt quyền; P1 = sai nghiệp vụ nhìn thấy được; P2 = hoàn thiện.

| # | Mức | Lỗi / thiếu sót | Nguyên nhân | Giải pháp | File chính | Test | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | P0 | Khôi phục Admin do renderer tự khẳng định | Main không biết mã khôi phục có được xác minh | Main cấp phiên khôi phục một lần, có hạn, gắn đúng tài khoản Admin; mã khôi phục xoay vòng | `main/ipc-guard.js`, `main.js`, `preload.js`, `main/write-policy.js` | U-V101-REC-01..03, `v92-write-policy` (U-WP-02/11) | c8a85ed |
| 2 | P0 | Duyệt nhân sự (Nghỉ việc…) ghi nhiều bước, có thể dở dang | Renderer lưu từng bảng, lưu trễ 400 ms gộp trạng thái | `txn()` — một lần lưu nguyên tử, hoàn tác khi main từ chối; main kiểm bất biến máy trạng thái | `app.js`, `main/write-policy.js` | `v101-security`, E2E "Nghỉ không lương" | c8a85ed |
| 3 | P0 | Chứng từ thanh toán đi sai trạng thái / tự duyệt | Chỉ kiểm ở giao diện | Máy trạng thái ĐÃ LẬP→ĐÃ DUYỆT→ĐÃ THANH TOÁN kiểm tại main, tách người lập–người duyệt, dòng đã thanh toán bất biến | `main/write-policy.js`, `core/payment-ledger.js` | U-V101-PAY-01, `v94-*` | c8a85ed |
| 4 | P0 | Xuất bảng lương/PDF lọt qua khi lỗi chặn hoặc không đọc được dữ liệu | Gate "fail-open", PDF không qua gate | `checkExport` fail-closed (kỳ không rõ, dữ liệu không đọc được, engine lỗi, thanh toán chưa chốt ⇒ chặn) cho cả tải file và PDF | `main/payroll-gate.js`, `main.js` | U-V101-GATE-*, `v92-write-policy` | c8a85ed |
| 5 | P0 | Lỗi phân bổ sản lượng bị bỏ qua | `try/catch` nuốt lỗi | Lỗi phân bổ ⇒ blocker `PRODUCTION_ALLOCATION_ERROR`; bảng sai cấu trúc ⇒ `PAYROLL_RECALCULATION_FAILED` | `main/payroll-gate.js` | U-V101-GATE-02 | c8a85ed |
| 6 | P0 | Hình thức thanh toán lạ bị mặc định Tiền mặt; số chứng từ có thể trùng; trả vượt bị che bằng `MAX(0)` | `hinhThucCua` rộng, `nextNo` đếm theo số dòng | Giá trị lạ ⇒ "", `nextNo` tránh va chạm, `conPhaiTraRaw` và `vuotChi` | `core/payment-ledger.js` | `v101-security`, U-PAY101-03 | c8a85ed |
| 7 | P0 | Renderer gửi bản chốt tùy ý | Main chỉ kiểm blocker, không tính lại số | `verifySnapshot`: checksum, so từng NV (thu nhập/thực lĩnh), phương pháp bù chính thức | `main/payroll-gate.js`, `main/write-policy.js` | U-V101-CLOSE-01 | cff0b7f |
| 8 | P1 | "Chi tiết thanh toán" chỉ liệt kê dòng chứng từ | Dựng từ chứng từ thay vì từ bảng lương | Một dòng mỗi NV (46 cột, nhóm cột), đã trả/chờ chi/còn phải trả/có thể lập đề nghị, trả vượt hiện số âm + lỗi; cửa sổ chi tiết; **Sổ chứng từ** là màn riêng | `core/reporting/payroll-reports.js`, `app.js` | U-PAY101-01..04, E2E V10.1 | 31f5df5 |
| 9 | P1 | Thanh 7 bước chỉ trang trí | Không tính từ dữ liệu | `core/payroll-steps.js`: xong/đang/bị chặn/chưa; thanh toán chỉ xong khi mọi người trả đủ | `core/payroll-steps.js`, `app.js` | U-V101-STEP-01..04, E2E | cff0b7f |
| 10 | P1 | Kết quả xem thử phương pháp bù dễ bị dùng nhầm | Không gắn nhãn | Banner "KẾT QUẢ XEM THỬ"; chốt luôn dùng phương pháp "Hiệu lực" | `app.js` | E2E, `quy-che-*` | cff0b7f |
| 11 | P1 | Thêm nhân viên ghi 6 bảng rời rạc, thiếu kiểm tra | Không có giao dịch, không kiểm ngày/CCCD/trùng | `core/hr-create.js` kiểm trọn bộ trước khi ghi; một `txn`; form giữ nguyên khi lỗi | `core/hr-create.js`, `app.js` | `v101-hr-create` (5), E2E CCCD sai | b1ceda6 |
| 12 | P2 | Chứng từ (cha) → dòng NV (con) chưa có cửa sổ | — | `payVoucherModal` | `app.js` | E2E | a65b6fa |
| 13 | P1 | Excel: công thức chèn từ chuỗi, ngày dạng chuỗi, bảng rộng ép 1 trang | — | `safeText`, ngày thật `dd/mm/yyyy`, A3 nhiều trang ngang + lặp cột, tiêu đề 2 tầng; PDF tách phần cột | `ui/report-xlsx.js`, `core/reporting/report-html.js` | U-V101-XLS-01..04, U-V101-PDF-01, E2E | 75c9540, fb45bd9 |
| 14 | P2 | `U-REPO-08` fail trên HEAD Phase 1 | `txn` rollback thêm `db[k] =` | Cập nhật allowlist có lý do (không nới điều kiện khác) | `tests/unit/repository.test.js` | U-REPO-08 | 31f5df5 |

## Chưa xử lý / ghi nhận (không che giấu)

- **DESIGN_GAP (đọc dữ liệu):** toàn bộ DB được nạp vào renderer lúc khởi động. Main chặn **ghi** trái phép nhưng **chưa lọc đọc** theo vai trò. Giải quyết đúng cần đổi kiến trúc nạp dữ liệu theo quyền (hạng mục riêng).
- Gate xuất file nhận diện theo **tên file**; tệp đổi tên không chứa từ khóa lương/kỳ có thể lọt (đã ghi trong `V10_1_SECURITY_REVIEW.md`).
- Chưa có vai trò "chỉ xem phiếu lương của chính mình".
- Mã hóa dữ liệu **đang chạy** trên đĩa chưa làm (đánh giá trong `V10_1_PERFORMANCE.md` §6). Đã làm **mã hóa gói sao lưu bằng mật khẩu** (AES-256-GCM + scrypt, `main/backup-crypt.js`, `U-BCR-01..06`, E2E 249/249); DPAPI/mã hóa `data.json` vẫn là hạng mục riêng.
- Đối chiếu `main` (bản vá KPCĐ 12/10): xem `V10_1_MAIN_PARITY.md` — đã có sẵn trong Electron, thêm test khóa số liệu `U-MAIN-01..03`.
- Hình thức lương → cấu hình/mã lương: `dm_luong` là danh mục phẳng, không có quan hệ cha–con thật ⇒ không tạo Modal giả.
- Kiểm tra OCR theo prompt IV: đã chạy bổ sung sau Phase 6 — `V10_1_OCR_CHECK.md` (4/4 ca, 100% ô trên ảnh giả lập; chưa đo chữ tay thật).
- Ghi chú từ log E2E có sẵn từ trước: main ghi "chưa đăng nhập (bảng dm_congthuc)" 2 lần do migration trước đăng nhập — vô hại, chưa sửa.
