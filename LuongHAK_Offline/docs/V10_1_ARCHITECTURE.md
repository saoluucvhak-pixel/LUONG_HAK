# V10.1 — Kiến trúc (phần thay đổi)

## Luồng quyền và ghi dữ liệu

```
Renderer (app.js)                       Main (main.js)
  db trong bộ nhớ ──txn(tables,fn)──►  store-save ─► write-policy.check(text, who, {restoring, recovery})
  saveNow() một lần (nguyên tử)            ├─ theo bảng: quyền (permsFor)
  main từ chối ⇒ hoàn tác snapshot         ├─ kyluong: bất biến, payroll-gate.blockers + verifySnapshot (tính lại)
                                           ├─ nghiepvu_nhansu: máy trạng thái duyệt + bất biến (Nghỉ việc)
                                           └─ ttluong: ĐÃ LẬP→ĐÃ DUYỆT→ĐÃ THANH TOÁN, dòng đã trả bất biến
                                         ─► storage.save (+ sao lưu, SHA-256)
  Xuất file / PDF ─────────────────────► will-download / report-pdf ─► payroll-gate.checkExport (fail-closed)
```

- `txn()` (app.js): chụp bảng liên quan + nhật ký, chạy hàm, lưu **một lần**; hàm lỗi hoặc main từ chối ⇒ khôi phục snapshot. Dùng cho: thêm nhân viên (6 bảng), duyệt nhân sự, lập/chuyển chứng từ.
- Phiên và danh tính do **main** giữ (`auth-login`, phiên khôi phục `auth-recover`); renderer không tự khẳng định vai trò.

## Module mới / đổi (logic thuần trong `core/`, có test)

| Module | Vai trò |
| --- | --- |
| `core/payroll-steps.js` | 7 bước theo trạng thái thật |
| `core/hr-create.js` | kiểm tra + dựng hồ sơ nhân viên mới |
| `core/reporting/payroll-reports.js` | view-model: THANH_TOAN, CHI_TIET_TT (1 dòng/NV), SO_CHUNG_TU, CK, TM, TONG_HOP, CHI_TIET_NV; `groups` (tiêu đề 2 tầng) |
| `core/payment-ledger.js` | công nợ thanh toán: `outstanding` (`conPhaiTraRaw`, `vuotChi`, `deNghiChi`), `lapChungTu`, `chuyen` |
| `main/payroll-gate.js` | `computeKy` (cùng engine), `blockers`, `checkExport`, `verifySnapshot` |
| `ui/report-xlsx.js`, `core/reporting/report-html.js` | Excel/PDF: tiêu đề 2 tầng, A3, chia cột, chống công thức |

## Nguồn tính lương duy nhất

`engine.tinhBangLuong` là nguồn duy nhất. Renderer (`tinhLuong`) và main (`computeKy`) cùng gọi nó với cùng nhập; bản chốt là snapshot đã tính, main so lại từng NV trước khi cho ghi. Báo cáo/phiếu lương/chi tiết thanh toán đọc từ cùng bảng lương (hoặc bản chốt), không tính lại riêng.

## Ranh giới đã biết

Đọc dữ liệu chưa được main lọc theo vai trò (DESIGN_GAP, xem `V10_1_SECURITY_REVIEW.md`). `app.js` ~4.800 dòng — đánh giá tách trong `V10_1_PERFORMANCE.md` §5.
