# THIẾT KẾ HỆ THỐNG — Tính Lương HAK (bản offline cho Windows)

> Phiên bản: **2.0.0-alpha.21** (quy chế lương HAK Group 2026 — engine 1.8.0, R-68; alpha.20 đọc ảnh / PDF chấm công bằng OCR; alpha.19 phân bổ khối lượng; nội dung khác như alpha.18), ngày 11/10/2026, nhánh `claude/v2-quy-che-luong-2026`.
> File này tổng hợp các tài liệu chi tiết sau, mỗi chủ đề xem thêm ở file tương ứng:
> - Kiến trúc: `ARCHITECTURE.md`
> - Cấu trúc dữ liệu: `DATABASE_SCHEMA.md`
> - Công thức lương: `PAYROLL_FORMULAS.md`
> - Quy tắc nghiệp vụ: `BUSINESS_RULES.md`
> - Kiểm thử: `TEST_CASES.md`, `TEST_RESULTS.md`
> - Hướng dẫn sử dụng: `USER_GUIDE.md`
> - Lịch sử thay đổi: `CHANGELOG.md`

---

## 1. Mục tiêu và nguyên tắc

| Nguyên tắc | Cách làm |
|---|---|
| Chạy **offline** trên 1 máy Windows | Electron + 1 file dữ liệu JSON trên máy, không cần máy chủ hay Internet. |
| **Đúng trước, nhanh sau** | Công thức lương nằm riêng trong `engine.js`. Mỗi bản phát hành chạy lại bộ hồi quy và phải trùng 100% với v1.3.0 và 2.0.0-alpha.4. |
| **Không mất dữ liệu** | Ghi file nguyên tử, đọc lại so từng byte. Mỗi bản sao lưu có mã SHA-256. Không bao giờ ghi đè dữ liệu tốt bằng dữ liệu hỏng. Gỡ app không xóa dữ liệu. |
| **Kỳ đã chốt bất biến** | Lưu ảnh chụp (snapshot) bảng lương kèm checksum. Thay đổi hồ sơ hay danh mục sau khi chốt chỉ được cảnh báo "hồi tố", không làm đổi số đã chốt. |
| **Phân biệt công thức và dữ liệu** | Công thức nằm ở danh mục, có ngày "Hiệu lực từ". Dữ liệu nằm ở hồ sơ và chấm công. Chưa có dữ liệu ≠ công thức không tồn tại. |
| **Bảo mật tối thiểu quyền** | Cửa sổ giao diện chạy `contextIsolation` + `sandbox`, không có Node. Giao diện chỉ gọi tiến trình chính qua danh sách IPC cố định. Đặt CSP `script-src 'self'`. Không `eval` công thức của người dùng. |
| **Kiểm toán được** | Nhật ký ghi ai làm gì, lúc nào, giá trị cũ → mới. Mọi lần chốt, mở chốt, khôi phục, xuất file, in phiếu đều có lý do hoặc dấu vết. |

## 2. Kiến trúc tổng thể

```
┌──────────────────────────── TIẾN TRÌNH GIAO DIỆN (renderer, sandbox) ────────────────────────────┐
│ index.html · style.css · app.js (màn hình, điều hướng, form, báo cáo)                             │
│ ui/icons.js (icon SVG) · ui/guide.js (hướng dẫn, quy chế) · ui/fonts (Be Vietnam Pro)             │
│        │ gọi                                                                                     │
│ ┌──────▼────── NGHIỆP VỤ (JS thuần, test bằng Node) ─────────────────────────────────────────┐    │
│ │ hr.js            hồ sơ nhân sự, hợp đồng/phụ lục theo hiệu lực, staffForPayroll, báo cáo NS  │    │
│ │ engine.js        CÔNG THỨC lương: công, sản lượng, tăng ca, phụ cấp, BHXH, thuế TNCN        │    │
│ │ core/validate    chuẩn hóa tiền, ngày, kỳ, ô công                                           │    │
│ │ core/importer    nhập Excel: lập kế hoạch → xem trước → áp dụng (thêm/cập nhật/gộp/xung đột) │    │
│ │ core/repository  mọi thao tác ghi hồ sơ: plan/apply, khóa kỳ chốt, hồi tố                   │    │
│ │ core/period-guard  ảnh hưởng của 1 thay đổi tới kỳ đã chốt (locked/retro)                   │    │
│ │ core/payroll-close chốt / mở chốt / phiên bản / checksum / so sánh                          │    │
│ │ core/integrity · core/schema   kiểm tra toàn vẹn và cấu trúc khi mở dữ liệu                 │    │
│ │ core/permissions  vai trò, quyền, mật khẩu PBKDF2, chống dò mật khẩu                        │    │
│ │ core/allocation   chia chi phí lương theo phòng ban khi điều chuyển                         │    │
│ │ core/bh-report    báo cáo bảo hiểm (chỉ cộng số engine đã tính)                             │    │
│ │ core/production-alloc  chia phiếu cân theo tổ + NV vắng (như công cụ phân bổ khối lượng, α19)│    │
│ └─────────────────────────────────────────────────────────────────────────────────────────────┘    │
│        │ window.hakStore / window.hakFiles (preload.js — contextBridge, sendSync)                │
└────────┼─────────────────────────────────────────────────────────────────────────────────────────┘
┌────────▼──────────────────────── TIẾN TRÌNH CHÍNH (main.js, Node) ───────────────────────────────┐
│ main/storage.js   data.json · sao lưu + SHA-256 · thư mục thứ hai · lịch sao lưu · settings.json  │
│ main/exports.js   thư mục file xuất · tên không trùng · chỉ mở file đúng loại trong thư mục xuất │
│ PBKDF2 (crypto) · hộp thoại chọn thư mục · shell (mở file / thư mục) · khóa 1 cửa sổ             │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Các module dùng dạng **UMD**: trong trình duyệt gắn vào `window.HAKCore.*`, `window.HRM`, `window.LuongEngine`; trong Node dùng `module.exports`. Nhờ vậy cùng một mã chạy được trong app và trong bộ test.

## 3. Cấu trúc thư mục mã nguồn

```
LuongHAK_Offline/
├─ main.js            tiến trình chính: cửa sổ, IPC, tải file, lịch sao lưu, OCR, đóng app
├─ preload.js         cầu nối an toàn: hakStore (dữ liệu, sao lưu, đăng nhập), hakFiles (file xuất), hakOcr (đọc ảnh ô)
├─ index.html         khung trang + CSP + thứ tự nạp script
├─ style.css          giao diện 2.0: biến màu, sáng / tối, in ấn
├─ app.js             toàn bộ màn hình
├─ hr.js              mô hình hồ sơ nhân sự (HR.*), báo cáo nhân sự, cảnh báo khi tính lương
├─ engine.js          công thức lương (KHÔNG sửa nếu chưa được chủ sở hữu duyệt)
├─ xlsx.full.min.js   SheetJS: đọc / ghi Excel
├─ exceljs.min.js     ExcelJS 4.4.0 (MIT): biểu mẫu Excel có định dạng như công cụ phân bổ khối lượng (α19)
├─ core/              nghiệp vụ dùng chung (mục 2); α20: table-grid.js (tìm ô theo đường kẻ), timesheet-parse.js (dựng bảng chấm công), timesheet-ocr.js (điều phối OCR)
├─ main/              storage.js, exports.js, ocr-service.js (Tesseract offline) — chạy ở tiến trình chính
├─ vendor/pdfjs/      pdf.js 3.11.174 (Apache-2.0) — đọc PDF quét, nạp khi cần
├─ ocr/lang/          dữ liệu ngôn ngữ Tesseract vie + eng (tessdata_best_int)
├─ ui/                icons.js, guide.js, pbkl-xlsx.js (biểu mẫu phân bổ khối lượng), fonts/, icon.png
├─ build/             icon.ico / icon.png cho bộ cài
├─ tests/             unit · integration · regression · perf · e2e · fixtures (dữ liệu giả)
└─ package.json       electron 43, electron-builder (NSIS), script test
docs/                 tài liệu thiết kế (mục 0)
.github/workflows/build-exe.yml   CI: kiểm tra → E2E → build bộ cài Windows
*.gs, appsscript.json             bản Google Apps Script cũ (tham khảo, không dùng trong app offline)
```

## 4. Dữ liệu

### 4.1 Nơi lưu

| File | Nội dung | Ghi chú |
|---|---|---|
| `%APPDATA%\Tinh Luong HAK\data.json` | Toàn bộ dữ liệu nghiệp vụ (`schemaVersion: 2`) | Ghi nguyên tử: file tạm → fsync → đổi tên → đọc lại so từng byte. |
| `…\backups\<loại>_<thời điểm>_<mã>.json` + `.sha256` | Các bản sao lưu | Tên luôn khác nhau, không ghi đè nhau. Xem 4.3. |
| `…\settings.json` | Cấu hình **của máy**: thư mục thứ hai, lịch sao lưu, thư mục file xuất, tự mở thư mục | Không nằm trong `data.json`, nên khôi phục dữ liệu không làm đổi cấu hình máy. |
| `Tài liệu\Tinh Luong HAK\File xuat\` | Excel, báo cáo, phiếu lương, Word, sao lưu ra file | Trùng tên thì thêm "(1)", "(2)"; không ghi đè. |

### 4.2 Các bảng chính (chi tiết cột: `DATABASE_SCHEMA.md`)

| Nhóm | Bảng |
|---|---|
| Danh mục (công thức) | `dm_luong`, `dm_phucap`, `dm_tangca`, `dm_hotro`, `dm_baohiem`, `dm_tncn`, `dm_bacthue`, `dm_giamtru`, `dm_phongban`, `dm_chucvu`, `dm_cc` — mỗi dòng có **Hiệu lực từ** |
| Hồ sơ cấp nhân viên | `nhanvien`, `canhan`*, `hocvan`, `nhanthan`, `thanhtoan`*, `suckhoe`, `lienhe`, `nghenghiep`, `congtac`, `hopdong`, `daotao`, `tainanld` |
| Hồ sơ cấp hợp đồng | `chitiethd` (lương & phụ lục, theo hiệu lực), `quyenloiphep`, `nghiphep`, `nghiom`, `khamsk`, `khenthuong`, `noiquy`, `tailieu` |
| Nhập hằng tháng | `chamcong` (1 dòng = 1 NV × 1 hình thức công × kỳ; cột 01–31), `sanluong`, `bandam`, `psluong` (thưởng / trừ), `ungluong` (tạm ứng), `tiencom` |
| Kỳ lương | `kyluong`: snapshot đã chốt (bảng lương, BHXH, TNCN, checksum, phiên bản, lịch sử mở chốt) |
| Hệ thống | `nguoidung`, `baomat`, `congty`, `auditlog` |

\* `canhan` và `thanhtoan` lưu nhiều phiên bản theo *Hiệu lực từ* ("Thông tin mới" giữ bản cũ làm lịch sử).

### 4.3 Sao lưu

| Loại | Khi nào | Giữ |
|---|---|---|
| `startup` | mỗi lần mở app | 10 bản |
| `daily` | lần lưu đầu tiên trong ngày (trạng thái đầu ngày) | 30–365 ngày (Lịch sao lưu, mặc định 60) |
| `dinh-ky` | mỗi N giờ khi app mở, **chỉ khi dữ liệu đã đổi** | 48 bản |
| `khi-dong` | khi đóng app, nếu dữ liệu đã đổi | 10 bản |
| `truoc-…` | trước thao tác lớn (nhập Excel, khôi phục, nâng cấp, giảm dữ liệu > 50 %…) | 20 bản |
| `sau-chot-<kỳ>` | ngay khi chốt kỳ | **vĩnh viễn** |

Ngoài ra:
- **Thư mục thứ hai** (USB / NAS / Drive): mọi bản sao lưu được tự chép sang và đọc lại để kiểm SHA-256.
- Quá 7 ngày chưa có bản sao lưu ra ngoài máy, Trang chủ nhắc.
- Khi dọn bớt bản cũ, app **không bao giờ xóa bản sao lưu tốt mới nhất**.

## 5. Luồng nghiệp vụ chính

```
Danh mục (công thức, có hiệu lực) ─┐
Hồ sơ NV + Hợp đồng + Phụ lục ─────┼─► hr.staffForPayroll(kỳ) ─► engine.tinhBangLuong(kỳ) ─► Bảng lương / BHXH / TNCN
Chấm công · Sản lượng · Thưởng ────┘        │ cảnh báo hồ sơ                │ cảnh báo dữ liệu
                                            ▼                               ▼
                               (nghỉ phép/ốm lệch chấm công, có công sau ngày chấm dứt, thiếu tài khoản…)
                                                                            │
                                                     Chốt kỳ (payroll-close) ─► snapshot + checksum + bản sau-chot
                                                                            │
                         Báo cáo lương · Báo cáo bảo hiểm · Phiếu lương · Hạch toán · Xuất Excel (đọc snapshot)
```

1. **Lấy lương theo hiệu lực:** lấy phụ lục có *Hiệu lực từ* gần nhất ≤ cuối kỳ. Phụ lục có hiệu lực giữa tháng tính "Cả tháng" hoặc "Từ ngày hiệu lực" (Q-22).
2. **Tăng lương / biến động:** lập **phụ lục mới**, không sửa phụ lục cũ. Báo cáo Biến động tự nhận biết các loại: tăng mới, nghỉ việc, tăng / giảm lương, điều chuyển, đổi chức vụ, mức đóng BH.
3. **Nghỉ việc:** ghi Ngày chấm dứt và lý do. Từ tháng sau người đó không còn được tính lương. Tháng nghỉ việc tính BH theo R-57 (Q-26, phương án A).
4. **Nhập Excel:** lập kế hoạch → xem trước (thêm / cập nhật / gộp / trùng / xung đột / lỗi / kỳ đã chốt) → người dùng duyệt → áp dụng. App sao lưu `truoc-nhap-excel` trước khi áp dụng.
7. **Quy chế tính lương (α21, R-68):** `engine.tinhBangLuong(db, năm, tháng, cáchBù, { quyChe })` — `"2026"` (mặc định, lưu ở `congty[0]["Quy chế tính lương"]`) áp dụng 10 quy tắc C1…C10 (PAYROLL_FORMULAS 3a); không truyền = cách tính 1.7 (test hồi quy). Bản chốt ghi `quyChe`; đối chiếu bản chốt dùng đúng quy chế lúc chốt.
6. **Đọc ảnh / PDF chấm công (α20, R-67):** ảnh / trang PDF → xám → phóng ~2400 điểm → đoán chiều (OCR cả trang ở 4 hướng, đếm từ nằm ngang đọc chắc) → nhị phân hóa thích ứng → bám đường kẻ (chịu nghiêng nhẹ) → ô = vùng nền giữa các đường kẻ → xóa đường kẻ → cắt từng ô có mực → OCR theo lô (ô hẹp đọc số, ô rộng đọc chữ, ô không chắc đọc lại dạng khối) → nét "1" viết tay nhận theo hình → dựng bảng kiểu A (người × ngày) hoặc B (ngày × Công / Cơm) → so tổng trên giấy → **bảng xem trước** sửa được → ghi qua màn hình xem trước nhập liệu (mục 4).
5. **Sửa dữ liệu thuộc kỳ đã chốt:** bị chặn hoặc cảnh báo "hồi tố" (period-guard). Muốn sửa phải *mở chốt* có lý do, và mở chốt sẽ tạo phiên bản mới.

## 6. Phân quyền

| Vai trò | Quyền chính |
|---|---|
| Quản trị (Admin) | Tất cả quyền. Hệ thống luôn giữ ít nhất 1 Admin còn hoạt động. |
| Nhân sự | Xem / sửa hồ sơ, báo cáo nhân sự, nhập / xuất Excel |
| Kế toán lương | Hồ sơ (xem), nhập liệu, danh mục, tính / chốt lương, báo cáo, nhập / xuất |
| Kế toán thanh toán | Xem bảng lương, xuất, xem hồ sơ |
| Trưởng bộ phận | Xem hồ sơ (**số tiền lương bị ẩn**), nhập chấm công, báo cáo |
| Người phê duyệt | Xem hồ sơ, nhập liệu, bảng lương, báo cáo, xuất |
| Người xem báo cáo | Báo cáo, xem bảng lương |

- Mật khẩu băm PBKDF2-SHA256 với 210.000 vòng, tính ở tiến trình chính.
- Đăng nhập sai 5 lần thì khóa tạm. Không thao tác 30 phút thì tự khóa.
- Admin có mã khôi phục khi quên mật khẩu.
- Quyền được kiểm tra **ở chỗ thực hiện thao tác**, không chỉ ẩn nút.
- Tên tài khoản Windows chỉ được ghi vào nhật ký, **không** dùng để xác thực.

## 7. Kênh IPC (giao diện ↔ tiến trình chính)

| Nhóm | Kênh |
|---|---|
| Dữ liệu | `store-load`, `store-save`, `store-info`, `store-quarantine`, `open-data-folder` |
| Sao lưu | `store-backup`, `store-list`, `store-verify`, `store-read`, `backup-status`, `backup-note-external`, `backup-mirror-choose / clear / sync`, `backup-schedule-get / set` |
| File xuất | `files-info`, `files-open`, `files-show`, `files-open-dir`, `files-choose-dir`, `files-reset-dir`, `files-open-after`; sự kiện `download-done` |
| Đăng nhập | `auth-salt`, `auth-hash`, `auth-verify`, `app-user` |
| OCR (α20) | `ocr-batch` (ảnh xám từng ô đã cắt, ≤ 5000 ô / lô, chế độ digit / text / block / page), `ocr-selftest` |

- Giao diện **chỉ gửi tên file** để mở. Đường dẫn do tiến trình chính ghép trong thư mục xuất.
- Chỉ mở các loại file app tự xuất: xlsx, xls, csv, pdf, doc, docx, json, txt.
- Thư mục (sao lưu thứ hai, file xuất) chỉ chọn bằng hộp thoại Windows của tiến trình chính.
- OCR: giao diện chỉ gửi **mảng điểm ảnh xám** của từng ô (không gửi đường dẫn file); tiến trình chính kiểm tra kích thước từng ô, ô sai trả kết quả rỗng đúng vị trí. Ảnh không gửi ra mạng, không ghi xuống đĩa.

## 8. Báo cáo

| Báo cáo | Nguồn | Ghi chú |
|---|---|---|
| Tổng hợp theo phòng ban, Bảng hạch toán (TT200) | Bảng lương kỳ (snapshot nếu đã chốt) | Người điều chuyển trong kỳ được chia chi phí theo công ở từng phòng (core/allocation). |
| **Báo cáo bảo hiểm** (α18) | `kq.bhxh` của kỳ | Theo khoản, tăng / giảm so với kỳ trước, theo phòng ban, chi tiết. Báo cáo nội bộ, không thay mẫu D02-LT / C12-TS. |
| **Phiếu lương** (α18) | Bảng lương kỳ | Lọc theo phòng ban, tìm theo tên; in từng trang hoặc in gọn; xuất Excel. |
| Phiếu chi, so sánh kỳ, lương 12 tháng, thu nhập năm, thuế TNCN năm | Các kỳ đã chốt | Báo cáo cả năm chỉ cộng các kỳ đã chốt. |
| Sổ quản lý lao động | Hồ sơ | Theo NĐ 145/2020 Điều 3. Liệt kê người thiếu thông tin bắt buộc (α18). |
| Biến động NS, HĐ sắp hết hạn, tình hình NS, nghỉ phép / ốm, vi phạm, sinh nhật, lịch sử | Hồ sơ | Người không có quyền xem lương sẽ thấy các ô số tiền bị che 🔒. |

## 9. Đóng gói và phát hành

- **CI** (`.github/workflows/build-exe.yml`), chạy cho mỗi PR, gồm 3 job:
  1. **check** (Ubuntu): kiểm tra cú pháp, `eslint`, `npm test`, `npm audit`;
  2. **e2e** (Ubuntu + xvfb, Playwright điều khiển Electron);
  3. **build** (windows-latest): `npm run dist` tạo artifact `TinhLuongHAK-Setup`.
- **Bộ cài NSIS:**
  - có icon riêng;
  - shortcut "Tính Lương HAK" ngoài Desktop và trong Start Menu → HAK;
  - cho chọn thư mục cài; app tự chạy sau khi cài;
  - `deleteAppDataOnUninstall: false`.
  - α20: `node_modules/**` và `ocr/**` để ngoài asar (`asarUnpack`) vì luồng phụ của Tesseract không đọc được file trong asar; đường dẫn worker / core / dữ liệu ngôn ngữ ghép rõ ràng (main/ocr-service.js `unpacked()`). **Chưa kiểm trên Windows thật.**
  - `productName` cố ý giữ "Tinh Luong HAK" để thư mục dữ liệu `%APPDATA%` không đổi qua các bản.
- **Phát triển:** mỗi tính năng là 1 nhánh và 1 PR, các PR xếp chồng nối tiếp nhau. Không sửa trực tiếp `main`, không tự merge. Mỗi PR ghi phương án rollback (revert commit; dữ liệu cũ vẫn đọc được).

## 10. Kiểm thử (alpha.18)

| Nhóm | Số lượng | Nội dung |
|---|---|---|
| Unit + integration + regression + perf (`npm test`) | **162** | Công thức (hồi quy trùng 100 % v1.3.0 và alpha.4), nhập Excel, khóa kỳ, phân quyền, lưu trữ (lỗi đĩa, mất điện, sao lưu, thư mục thứ hai, lịch sao lưu), file xuất, nghỉ phép, biến động, sổ lao động, bảo hiểm |
| E2E Electron (`xvfb-run -a npm run test:e2e`) | **76** | Thao tác thật trên app: thiết lập, nhập liệu, tính lương, chốt / mở chốt, xuất Excel, phân quyền, khôi phục file hỏng, nâng cấp dữ liệu, sao lưu, file đã tải, phiếu lương, báo cáo bảo hiểm |
| Lint | 0 lỗi / 0 cảnh báo | `npx eslint@9.39.5 . --max-warnings 0` |

**Chưa làm:** chưa kiểm thử trên máy Windows thật. CI mới chỉ build bộ cài trên windows-latest. Các phần cần kiểm trên máy thật: cài đặt và shortcut, mở Explorer / Excel thật, in ra máy in, sao lưu định kỳ khi app chạy nhiều giờ.

## 11. Chạy mã nguồn

```bash
cd LuongHAK_Offline
npm ci                         # cài thư viện (Node 22)
npm start                      # chạy app
npm test                       # test nghiệp vụ
xvfb-run -a npm run test:e2e   # E2E (Linux; trên Windows: npm run test:e2e)
npm run dist                   # tạo bộ cài Windows (chạy trên Windows)
```

Biến môi trường chỉ dùng cho kiểm thử:
- `HAK_USER_DATA`: thư mục dữ liệu riêng;
- `HAK_DOWNLOAD_DIR`: thư mục file xuất cố định;
- `HAK_NO_SHELL=1`: không mở Explorer thật;
- `HAK_SCHEDULE_TICK_MS`: chu kỳ kiểm tra lịch sao lưu.

## 12. Việc còn chờ chủ sở hữu quyết định

- Mẫu sổ 01/PLI và cột làm thêm tính theo **giờ hay công**.
- Tiền lương làm việc vào ban đêm.
- Mã NV đang dùng số CCCD: có đổi sang NV001… không.
- Giá trị mặc định giới tính / hôn nhân trong dữ liệu nguồn; ngày giảm trừ của TG3 / TG4 / CN2.
- Kiểm thử trên máy Windows thật.
