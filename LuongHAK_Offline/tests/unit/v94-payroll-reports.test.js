// V9.4 — báo cáo lương, sổ thanh toán, Excel chuyên nghiệp. Dữ liệu giả lập.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const X = require("../../exceljs.min.js");
const PL = require("../../core/payment-ledger.js");
const PR = require("../../core/reporting/payroll-reports.js");
const RX = require("../../ui/report-xlsx.js");

const rows = () => [
  { "Mã NV": "00123", "Họ và tên": "Nguyễn Văn Á", "Phòng ban": "Sản xuất", "HTTT": "Chuyển khoản", "Số tài khoản": "0012345678901", "Ngân hàng": "VCB", "Tổng thu nhập": 10000000, "BH trừ NLĐ": 1000000, "KPCĐ trừ NLĐ": 0, "Truy thu BH": 0, "Thuế TNCN": 0, "Trừ khác": 0, "Tạm ứng": 1000000, "Thực lĩnh": 8000000 },
  { "Mã NV": "00124", "Họ và tên": "Trần Thị Bình", "Phòng ban": "Sản xuất", "HTTT": "Tiền mặt", "Số tài khoản": "", "Ngân hàng": "", "Tổng thu nhập": 6000000, "BH trừ NLĐ": 0, "KPCĐ trừ NLĐ": 0, "Truy thu BH": 0, "Thuế TNCN": 0, "Trừ khác": 0, "Tạm ứng": 0, "Thực lĩnh": 6000000 },
  { "Mã NV": "00125", "Họ và tên": "Lê Văn C", "Phòng ban": "Văn phòng", "HTTT": "Chuyển khoản", "Số tài khoản": "", "Ngân hàng": "ACB", "Tổng thu nhập": 5000000, "BH trừ NLĐ": 0, "KPCĐ trừ NLĐ": 0, "Truy thu BH": 0, "Thuế TNCN": 0, "Trừ khác": 0, "Tạm ứng": 0, "Thực lĩnh": 5000000 }
];
const opt = (x) => Object.assign({ nam: 2026, thang: 9, tenCongTy: "CÔNG TY TEST", lines: [], ngay: "2026-10-01", nguoiLap: "ketoan" }, x || {});

test("U-PAY94-01 tiêu đề IN HOA, số tiền kê CK/TM lấy từ thực lĩnh (không phải tổng thu nhập)", () => {
  const ck = PR.build("CHUYEN_KHOAN", { bangluong: rows(), chot: true, blockers: [] }, opt());
  assert.equal(ck.title, ck.title.toLocaleUpperCase("vi-VN"));
  assert.match(ck.title, /BẢNG KÊ CHUYỂN KHOẢN/);
  assert.equal(ck.rows.length, 2);
  assert.equal(ck.rows[0]["Số tiền"], 8000000); // không phải 10.000.000
  const tm = PR.build("TIEN_MAT", { bangluong: rows(), chot: true, blockers: [] }, opt());
  assert.equal(tm.rows.length, 1); assert.equal(tm.tong["Số tiền"], 6000000);
});

test("U-PAY94-02 kê chuyển khoản: thiếu số tài khoản/ngân hàng là LỖI chặn xuất chính thức", () => {
  const ck = PR.build("CHUYEN_KHOAN", { bangluong: rows(), chot: true, blockers: [] }, opt());
  assert.ok(ck.loi.some((m) => /thiếu số tài khoản/.test(m)));
  assert.equal(ck.choXuatChinhThuc, false);
});

test("U-PAY94-03 kỳ chưa chốt: không xuất chính thức; lỗi chặn của bảng lương được đưa vào loi", () => {
  const ok = rows().slice(0, 2);
  const a = PR.build("THANH_TOAN", { bangluong: ok, chot: false, blockers: [] }, opt());
  assert.equal(a.choXuatChinhThuc, false);
  const b = PR.build("THANH_TOAN", { bangluong: ok, chot: true, blockers: [{ code: "TAX_CONFIG_ERROR", ten: "Cấu hình thuế", count: 1, items: ["x"] }] }, opt());
  assert.ok(b.loi[0].startsWith("TAX_CONFIG_ERROR"));
  const c = PR.build("THANH_TOAN", { bangluong: ok, chot: true, blockers: [] }, opt());
  assert.equal(c.choXuatChinhThuc, true);
});

test("U-PAY94-04 tổng hợp theo phòng ban khớp tổng bảng lương", () => {
  const t = PR.build("TONG_HOP", { bangluong: rows(), chot: true, blockers: [] }, opt());
  assert.equal(t.rows.length, 2);
  assert.equal(t.tong["Thực lĩnh"], 19000000); assert.equal(t.tong["Tổng thu nhập"], 21000000); assert.equal(t.tong["Số người"], 3);
});

test("U-PAY94-05 sổ thanh toán: lập → duyệt (khác người lập) → thanh toán; chống lập trùng; không vượt thực lĩnh", () => {
  const r = rows(); r[2]["Số tài khoản"] = "999888777";
  const base = { ky: "2026-09", rows: r, lines: [], nguoi: "kt1", ngay: "2026-10-01", chot: true, blockers: [] };
  assert.equal(PL.lapChungTu(Object.assign({}, base, { ht: PL.HT.CK, chot: false })).ok, false);
  const a = PL.lapChungTu(Object.assign({}, base, { ht: PL.HT.CK }));
  assert.ok(a.ok); assert.equal(a.dong.length, 2); assert.equal(a.tong, 13000000); assert.match(a.so, /^UNC-202609-001$/);
  let lines = a.dong;
  const dup = PL.lapChungTu(Object.assign({}, base, { ht: PL.HT.CK, lines }));
  assert.equal(dup.ok, false, "không lập trùng khi đã có chứng từ chờ chi");
  assert.equal(PL.chuyen(lines, a.so, PL.TT.DUYET, { nguoi: "kt1", ngay: "d" }).ok, false, "người lập không tự duyệt");
  const d = PL.chuyen(lines, a.so, PL.TT.DUYET, { nguoi: "ql", ngay: "2026-10-02" }); assert.ok(d.ok);
  lines = lines.map((l) => Object.assign({}, l, d.patch));
  assert.equal(PL.chuyen(lines, a.so, PL.TT.TRA, { nguoi: "tt", ngay: "2026-10-03" }).ok, true);
  const tra = PL.chuyen(lines, a.so, PL.TT.TRA, { nguoi: "tt", ngay: "2026-10-03" });
  lines = lines.map((l) => Object.assign({}, l, tra.patch));
  const os = PL.outstanding(r, lines, "2026-09");
  assert.equal(os[0].trangThai, "Đã thanh toán"); assert.equal(os[0].conPhaiTra, 0); assert.equal(os[1].trangThai, "Chưa thanh toán");
  assert.equal(PL.chuyen(lines, a.so, PL.TT.HUY, { nguoi: "x", lyDo: "sai" }).ok, false, "chứng từ đã thanh toán bị khóa");
  const ck2 = PR.build("CHUYEN_KHOAN", { bangluong: r, chot: true, blockers: [] }, opt({ lines }));
  assert.equal(ck2.rows.length, 0, "đã thanh toán đủ thì không còn trong bảng kê");
  assert.deepEqual(PL.kiemTra(lines, { "2026-09": r }), []);
});

test("U-PAY94-06 hủy chứng từ cần lý do; trạng thái không sinh từ việc xuất file", () => {
  const r = rows(); r[2]["Số tài khoản"] = "999888777";
  const a = PL.lapChungTu({ ky: "2026-09", rows: r, lines: [], nguoi: "kt1", ngay: "d", chot: true, blockers: [], ht: PL.HT.CK });
  assert.equal(PL.chuyen(a.dong, a.so, PL.TT.HUY, {}).ok, false);
  const h = PL.chuyen(a.dong, a.so, PL.TT.HUY, { lyDo: "lập nhầm" }); assert.ok(h.ok);
  const lines = a.dong.map((l) => Object.assign({}, l, h.patch));
  assert.equal(PL.outstanding(r, lines, "2026-09")[0].deNghiChi, 8000000, "chứng từ hủy trả lại khoản phải thanh toán");
  PR.build("CHUYEN_KHOAN", { bangluong: r, chot: true, blockers: [] }, opt({ lines: a.dong })); // xem/xuất báo cáo không đổi sổ
  assert.equal(a.dong[0]["Trạng thái"], PL.TT.LAP);
});

test("U-XLSX94-01 Excel: tiêu đề IN HOA, Mã NV/STK là chữ giữ số 0 đầu, in A4 vừa chiều ngang, lặp tiêu đề, đóng băng, AutoFilter, mở lại được", async () => {
  const r = rows(); r[2]["Số tài khoản"] = "0999888777";
  const vm = PR.build("CHUYEN_KHOAN", { bangluong: r, chot: true, blockers: [] }, opt());
  const vm2 = Object.assign({}, vm, { rows: vm.rows, tong: vm.tong });
  const buf = await RX.build(X, vm2, { chuKy: ["Người lập", "Kế toán trưởng", "Giám đốc"] }).xlsx.writeBuffer();
  const wb = new X.Workbook(); await wb.xlsx.load(buf);
  assert.equal(wb.worksheets.length, 1);
  const ws = wb.worksheets[0];
  assert.equal(ws.getCell("A2").value, vm.title); assert.equal(vm.title, vm.title.toLocaleUpperCase("vi-VN"));
  assert.equal(ws.getCell("A1").value, "CÔNG TY TEST");
  const hr = 7;
  assert.equal(ws.getCell(hr, 2).value, "Mã NV");
  assert.equal(ws.getCell(hr + 1, 2).value, "00123"); assert.equal(typeof ws.getCell(hr + 1, 2).value, "string");
  assert.equal(ws.getCell(hr + 1, 4).value, "0012345678901");
  assert.equal(ws.getCell(hr + 1, 6).value, 8000000); assert.equal(ws.getCell(hr + 1, 6).numFmt, "#,##0;[Red]-#,##0");
  assert.equal(ws.pageSetup.fitToWidth, 1); assert.equal(ws.pageSetup.paperSize, 9); assert.equal(ws.pageSetup.orientation, "landscape");
  assert.equal(ws.pageSetup.printTitlesRow, hr + ":" + hr);
  assert.equal(ws.views[0].state, "frozen"); assert.equal(ws.views[0].ySplit, hr);
  assert.ok(ws.autoFilter);
  let tong = null; ws.eachRow((row) => { if (row.getCell(1).value === "TỔNG CỘNG") tong = row; });
  assert.ok(tong); assert.equal(tong.getCell(6).value, 13000000);
});

test("U-PAY10-01 Tổng hợp chi tiết nhân viên: mỗi người một dòng, tổng thực lĩnh khớp Tổng hợp theo phòng ban; kỳ chưa chốt vẫn xem được", () => {
  const th = PR.build("TONG_HOP", { bangluong: rows(), chot: false, blockers: [] }, opt());
  const ct = PR.build("CHI_TIET_NV", { bangluong: rows(), chot: false, blockers: [] }, opt());
  assert.equal(ct.rows.length, 3); assert.match(ct.title, /CHI TIẾT LƯƠNG TOÀN BỘ NHÂN VIÊN/);
  assert.equal(ct.tong["Thực lĩnh"], th.tong["Thực lĩnh"]);
  assert.equal(ct.tong["Tổng thu nhập"], th.tong["Tổng thu nhập"]);
  assert.ok(PR.KHONG_CAN_CHOT.CHI_TIET_NV && !PR.KHONG_CAN_CHOT.CHI_TIET_TT);
});

test("U-PAY10-02 Chi tiết thanh toán: liệt kê dòng chứng từ của kỳ, bỏ dòng đã hủy, tổng = tổng số tiền các dòng còn hiệu lực", () => {
  const lines = [
    { "Số chứng từ": "UNC-202609-001", "Kỳ": "2026-09", "Hình thức": "Chuyển khoản", "Mã NV": "00123", "Họ và tên": "Nguyễn Văn Á", "Số tiền": 8000000, "Trạng thái": "Đã thanh toán", "Ngày lập": "2026-10-01" },
    { "Số chứng từ": "PC-202609-001", "Kỳ": "2026-09", "Hình thức": "Tiền mặt", "Mã NV": "00124", "Họ và tên": "Trần Thị Bình", "Số tiền": 100, "Trạng thái": "Đã hủy" },
    { "Số chứng từ": "PC-202608-001", "Kỳ": "2026-08", "Hình thức": "Tiền mặt", "Mã NV": "00124", "Họ và tên": "Trần Thị Bình", "Số tiền": 5, "Trạng thái": "Đã thanh toán" }
  ];
  const vm = PR.build("CHI_TIET_TT", { bangluong: rows(), chot: true, blockers: [] }, opt({ lines }));
  assert.equal(vm.rows.length, 1); assert.equal(vm.tong["Số tiền"], 8000000);
  assert.ok(vm.canhbao.some((m) => /đã hủy/.test(m)));
});
