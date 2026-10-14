# V10.1 — Đối chiếu tiền lương với workbook nguồn

**Trạng thái: `PARTIAL` — KHÔNG phải `BUSINESS_RECONCILED`.**

## Nguồn dữ liệu
Ba workbook do chủ sở hữu cung cấp trong phiên làm việc (HAK Đà Nẵng, 61 NV/kỳ): `LuongĐN09_27_10_2025_v3T.xlsx` (T9/2025), `LuongT11_NL_DN_02_12_25_V1_S_Final.xlsx` và `DL_LUONG_11_2025_02_12_2025.xlsx` (T11/2025, gồm nhân sự, chấm công, sản lượng). Chứa dữ liệu cá nhân ⇒ **không** nằm trong repo; chi tiết từng NV × khoản chỉ ở bản chạy cục bộ.

## Cách chạy (cùng công cụ V9, engine không đổi)
`python3 tools/recon/export_xlsx.py <xlsx> <json>` → `node tools/recon/recon-t9-2025.js 2026 to sep.json`, `recon-t11-2025.js 2026 to nov_all.json` (JSON T11 gộp 2 file), rồi `node tools/recon/classify.js out.csv r9.json r11.json`. Quy chế 2026, bù theo tổ.

## Kết quả trên HEAD V10.1

| | T9/2025 | T11/2025 |
| --- | ---: | ---: |
| Số NV | 61 | 61 |
| NV có ít nhất một khoản lệch | 16 | 18 |

Phân loại dòng lệch: **A (lỗi thuật toán chưa giải thích) = 0**; B (khác biệt quy chế đã duyệt, chủ yếu sản lượng/lương sản lượng) = 52; C (dữ liệu nguồn) = 1; E (cần quản lý quyết định: thuế TNCN khấu trừ trong "thu nhập còn lại", KPCĐ…) = 9; hệ quả theo khoản đầu nguồn = 41.

**Giống hệt kết quả V9** (`V9_PAYROLL_RECONCILIATION.md`) — vì `engine.js`/`hr.js` không đổi trong V10.1, đây là kiểm chứng không-hồi-quy chứ không phải xác nhận mới về nghiệp vụ. T9: phân bổ sản lượng khi giả lập đủ công lệch 0/16, còn 1,04 tấn phiếu mã tổ "KPB" không có tổ ⇒ chưa phân bổ (đúng: gate SAN_LUONG_CHUA_PHAN_BO chặn chốt kỳ nếu gặp). T11: lệch 0, chưa phân bổ 0.

## Chưa làm được / không được tuyên bố
- Chưa "khớp 100%": B/C/E còn chờ quyết định của quản lý (xem V9).
- Chỉ HAK Đà Nẵng, 2 kỳ 2025. Chưa có workbook kỳ 2026, CNHAK, HAKQN, Đại Hiệp ⇒ **`BLOCKED_SOURCE_DATA`** cho các công ty/kỳ đó.
- Đối chiếu "Bảng chi tiết thanh toán": số liệu cột Thu nhập/Khấu trừ/Thực lĩnh lấy từ cùng bảng lương engine nên khớp bảng lương; tính đúng của chính các khoản được kiểm ở trên và ở test engine, không phải ở báo cáo.
- Kịch bản kiểm thử nhân viên thôi việc giữa kỳ, trả một phần, trả vượt, chứng từ hủy: có unit test với dữ liệu giả lập (`U-PAY101-*`), không phải dữ liệu thật.
