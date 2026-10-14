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

const L = (so, ma, tien, tt, extra) => Object.assign({ "Số chứng từ": so, "Kỳ": "2026-09", "Hình thức": "Chuyển khoản", "Mã NV": ma, "Họ và tên": "x", "Số tiền": tien, "Trạng thái": tt }, extra || {});

test("U-PAY101-01 Chi tiết thanh toán: MỘT dòng mỗi nhân viên trong phạm vi, kể cả khi chưa có chứng từ nào", () => {
  const vm = PR.build("CHI_TIET_TT", { bangluong: rows(), chot: true, blockers: [] }, opt({ lines: [] }));
  assert.equal(vm.rows.length, 3);
  vm.rows.forEach((r) => { assert.equal(r["Đã thanh toán"], 0); assert.equal(r["Đang chờ chi"], 0); assert.equal(r["Còn phải thanh toán"], r["Thực lĩnh"]); });
  assert.deepEqual(vm.groups.map((g) => g.label), ["NHÂN VIÊN", "CÔNG & SẢN LƯỢNG", "THU NHẬP", "KHẤU TRỪ", "THANH TOÁN"]);
  assert.equal(vm.groups[vm.groups.length - 1].to, vm.cols.length - 1);
});

test("U-PAY101-02 Chi tiết thanh toán: trả một phần / chờ chi / hủy được tính đúng, tổng khớp bảng lương", () => {
  const r0 = rows(), tl = (m) => r0.filter((x) => x["Mã NV"] === m)[0]["Thực lĩnh"];
  const lines = [L("UNC-1", "00123", 3000000, "Đã thanh toán"), L("UNC-2", "00123", 1000000, "Đã lập"), L("UNC-3", "00124", 500, "Đã hủy")];
  const vm = PR.build("CHI_TIET_TT", { bangluong: r0, chot: true, blockers: [] }, opt({ lines }));
  const a = vm.rows.filter((x) => x["Mã NV"] === "00123")[0], b = vm.rows.filter((x) => x["Mã NV"] === "00124")[0];
  assert.equal(a["Đã thanh toán"], 3000000); assert.equal(a["Đang chờ chi"], 1000000);
  assert.equal(a["Còn phải thanh toán"], tl("00123") - 3000000); assert.equal(a["Có thể lập đề nghị chi"], tl("00123") - 4000000);
  assert.equal(b["Đã thanh toán"], 0); assert.equal(b["Còn phải thanh toán"], tl("00124"));
  assert.equal(vm.tong["Thực lĩnh"], r0.reduce((x, y) => x + y["Thực lĩnh"], 0));
});

test("U-PAY101-03 Chi tiết thanh toán: trả vượt thực lĩnh KHÔNG bị che bằng 0 — hiện số âm, ghi chú và lỗi chặn xuất", () => {
  const r0 = rows(), t = r0[0]["Thực lĩnh"];
  const vm = PR.build("CHI_TIET_TT", { bangluong: r0, chot: true, blockers: [] }, opt({ lines: [L("UNC-9", "00123", t + 1000, "Đã thanh toán")] }));
  const a = vm.rows.filter((x) => x["Mã NV"] === "00123")[0];
  assert.equal(a["Còn phải thanh toán"], -1000); assert.equal(a["Có thể lập đề nghị chi"], 0);
  assert.match(a["Ghi chú"], /TRẢ VƯỢT/); assert.ok(vm.loi.some((m) => /vượt thực lĩnh/.test(m))); assert.equal(vm.choXuatChinhThuc, false);
});

test("U-PAY101-04 Sổ chứng từ thanh toán tách riêng: liệt kê dòng chứng từ của kỳ (kể cả đã hủy, kèm lý do), không thuộc bảng nhân viên", () => {
  const lines = [L("UNC-1", "00123", 8000000, "Đã thanh toán"), L("PC-1", "00124", 100, "Đã hủy", { "Lý do hủy": "sai số" }), Object.assign(L("PC-0", "00124", 5, "Đã thanh toán"), { "Kỳ": "2026-08" })];
  const vm = PR.build("SO_CHUNG_TU", { bangluong: rows(), chot: true, blockers: [] }, opt({ lines }));
  assert.equal(vm.rows.length, 2); assert.match(vm.title, /SỔ CHỨNG TỪ THANH TOÁN/);
  assert.equal(vm.rows.filter((x) => x["Trạng thái"] === "Đã hủy")[0]["Lý do hủy"], "sai số");
});

// ---------- V10.1 Phase 5: Excel chuyên nghiệp — an toàn, định dạng, in bảng rộng ----------
const mkVm = (cols, rows, extra) => Object.assign({ title: "BÁO CÁO TEST", congTy: "CTY", kyText: "THÁNG 09/2026", phamVi: "Toàn bộ", trangThai: "Kỳ đã chốt", cols: cols.map(([l, k]) => ({ key: l, label: l, kind: k })), rows, tong: {}, soDong: rows.length }, extra || {});
const loadWs = async (vm) => { const wb = RX.build(X, vm, {}); const b = await wb.xlsx.writeBuffer(); const w2 = new X.Workbook(); await w2.xlsx.load(b); return w2.worksheets[0]; };

test("U-V101-XLS-01 chuỗi bắt đầu bằng = + - @ không thành công thức; Mã NV/CCCD/STK giữ dạng text và số 0 đầu", async () => {
  const vm = mkVm([["STT", "qty"], ["Mã NV", "text"], ["Số CCCD", "text"], ["Ghi chú", "text"]], [
    { STT: 1, "Mã NV": "00123", "Số CCCD": "012345678901", "Ghi chú": "=HYPERLINK(\"http://x\",\"a\")" }, { STT: 2, "Mã NV": "00124", "Số CCCD": "", "Ghi chú": "@SUM(1)" }, { STT: 3, "Mã NV": "00125", "Số CCCD": "", "Ghi chú": "+1+1" }]);
  const ws = await loadWs(vm);
  for (let r = 1; r <= ws.rowCount; r++) ws.getRow(r).eachCell((c) => { assert.ok(!(c.value && typeof c.value === "object" && c.value.formula), "ô " + c.address + " là công thức"); });
  let hit = 0; ws.eachRow((row) => row.eachCell((c) => { if (c.value === "00123") { hit++; assert.equal(c.numFmt, "@"); } if (c.value === "012345678901") hit++; if (typeof c.value === "string" && /^'[=@+]/.test(c.value)) hit++; }));
  assert.equal(hit, 5);
});
test("U-V101-XLS-02 ngày ISO ở cột 'Ngày…' thành ngày thật hiển thị dd/mm/yyyy, không lệch múi giờ; số thập phân hiện 2 chữ số, số nguyên không", async () => {
  const vm = mkVm([["STT", "qty"], ["Ngày lập", "text"], ["Sản lượng (tấn)", "qty"], ["Công", "qty"]], [{ STT: 1, "Ngày lập": "2026-09-30", "Sản lượng (tấn)": 12.5, "Công": 26 }, { STT: 2, "Ngày lập": "2026-02-01", "Sản lượng (tấn)": 3, "Công": 24 }]);
  const ws = await loadWs(vm), found = {};
  ws.eachRow((row) => row.eachCell((c) => { if (c.value instanceof Date) { found[c.numFmt] = (found[c.numFmt] || 0) + 1; assert.ok([30, 1].includes(c.value.getUTCDate())); } if (c.value === 12.5) found.dec = c.numFmt; if (c.value === 26) found.int = c.numFmt; }));
  assert.equal(found["dd/mm/yyyy"], 2); assert.equal(found.dec, "#,##0.00"); assert.equal(found.int, "#,##0");
});
test("U-V101-XLS-03 bảng > 20 cột: A3 ngang, KHÔNG ép 1 trang (≥2 trang ngang), lặp cột Mã NV–Họ tên, đóng băng đến Họ tên; bảng hẹp thì không đóng băng cột", async () => {
  const cols = [["Mã NV", "text"], ["Họ và tên", "text"]]; for (let i = 0; i < 26; i++) cols.push(["Khoản " + i, "money"]);
  const row = {}; cols.forEach(([l, k]) => { row[l] = k === "money" ? 1000 : "x"; });
  const ws = await loadWs(mkVm(cols, [row]));
  assert.equal(ws.pageSetup.paperSize, 8); assert.equal(ws.pageSetup.orientation, "landscape"); assert.ok(ws.pageSetup.fitToWidth >= 2, "fitToWidth=" + ws.pageSetup.fitToWidth);
  assert.equal(ws.pageSetup.printTitlesColumn, "A:B"); assert.equal(ws.views[0].xSplit, 2);
  const narrow = await loadWs(mkVm([["STT", "qty"], ["Họ và tên", "text"], ["Số tiền", "money"]], [{ STT: 1, "Họ và tên": "A", "Số tiền": 5 }]));
  assert.equal(narrow.views[0].xSplit || 0, 0); assert.equal(narrow.pageSetup.fitToWidth, 1);
});
test("U-V101-XLS-04 tiêu đề hai tầng: hàng nhóm gộp đúng khoảng cột, in lặp cả hai hàng tiêu đề, AutoFilter nằm trên hàng tiêu đề cột", async () => {
  const vm = mkVm([["Mã NV", "text"], ["Họ và tên", "text"], ["Lương", "money"], ["Thưởng", "money"]], [{ "Mã NV": "1", "Họ và tên": "A", "Lương": 5, "Thưởng": 1 }],
    { groups: [{ label: "NHÂN VIÊN", from: 0, to: 1 }, { label: "THU NHẬP", from: 2, to: 3 }] });
  const ws = await loadWs(vm); let gr = 0; ws.eachRow((row, n) => { if (row.getCell(1).value === "NHÂN VIÊN") gr = n; });
  assert.ok(gr > 0); assert.equal(ws.getCell(gr, 3).value, "THU NHẬP"); assert.match(ws.pageSetup.printTitlesRow, new RegExp("^" + gr + ":" + (gr + 1) + "$"));
  const af = ws.autoFilter && (typeof ws.autoFilter === "string" ? ws.autoFilter : (ws.autoFilter.from ? ws.autoFilter.from.row : "")); assert.ok(af, "thiếu AutoFilter"); assert.match(String(af), new RegExp(typeof af === "string" ? "[A-Z]+" + (gr + 1) + ":" : "^" + (gr + 1) + "$"));
});

test("U-V101-PDF-01 PDF bảng rộng (>16 cột) tách thành các phần cột, mỗi phần lặp Mã NV–Họ tên và tiêu đề nhóm, không thu chữ về cỡ nhỏ nhất; chuỗi nguy hiểm được escape", () => {
  const RH = require("../../core/reporting/report-html.js");
  const cols = ["STT", "Mã NV", "Họ và tên"]; for (let i = 0; i < 26; i++) cols.push("K" + i);
  const row = { STT: 1, "Mã NV": "00123", "Họ và tên": "<script>x</script>" }; cols.slice(3).forEach((c) => { row[c] = 1000; });
  const groups = [{ label: "NHÂN VIÊN", from: 0, to: 2 }, { label: "THU NHẬP", from: 3, to: 28 }];
  const html = RH.sheets({ title: "T", sheets: [{ name: "T", cols, rows: [row], groups }] }, {});
  const tables = html.match(/<table/g).length; assert.equal(tables, Math.ceil(26 / 11));
  assert.equal((html.match(/<td class="t">00123<\/td>/g) || []).length, tables, "mỗi phần lặp Mã NV");
  assert.ok(!html.includes("<script>x"), "phải escape"); assert.match(html, /THU NHẬP/); assert.match(html, /Phần 1\/3/);
  assert.doesNotMatch(html, /font-size:6\.5pt/);
});
