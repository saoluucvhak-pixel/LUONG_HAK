"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const RF = require("../../core/reporting/report-filter.js");
const IPAY = require("../../core/reporting/internal-payroll.js");
const RH = require("../../core/reporting/report-html.js");
const E = require("../../engine.js");
const { baseDb, ccRow, staff } = require("../fixtures/build.js");

const rows = [
  { "Mã NV": "A1", "Họ và tên": "Nguyễn Thị Đào", "Phòng ban": "Văn phòng", HTTT: "TM,CK", _ct: { maLuong: "TG1" }, "Tổng thu nhập": 10, "Thực lĩnh": 9 },
  { "Mã NV": "B2", "Họ và tên": "Trần Văn Bình", "Phòng ban": "Sản xuất", HTTT: "CK", _ct: { maLuong: "SP, BD" }, "Tổng thu nhập": 20, "Thực lĩnh": 18 },
  { "Mã NV": "C3", "Họ và tên": "Lê Đức Cường", "Phòng ban": "Sản xuất", HTTT: "TM", _ct: { maLuong: "SP" }, "Tổng thu nhập": 0, "Thực lĩnh": 0 }
];
test("lọc rỗng = giữ nguyên; không đổi mảng gốc", () => {
  const r = RF.apply(rows, {}); assert.equal(r.kept, 3); assert.notEqual(r.rows, rows);
});
test("phòng ban, mã lương (nhiều mã trong 1 ô), HTTT, từ khóa không dấu, chỉ có thu nhập, thực lĩnh", () => {
  assert.deepEqual(RF.apply(rows, { phongBan: ["Sản xuất"] }).rows.map((r) => r["Mã NV"]), ["B2", "C3"]);
  assert.deepEqual(RF.apply(rows, { maLuong: "BD" }).rows.map((r) => r["Mã NV"]), ["B2"]);
  assert.deepEqual(RF.apply(rows, { httt: ["TM"] }).rows.map((r) => r["Mã NV"]), ["A1", "C3"]);
  assert.deepEqual(RF.apply(rows, { tuKhoa: "duc cuong" }).rows.map((r) => r["Mã NV"]), ["C3"]);
  assert.deepEqual(RF.apply(rows, { tuKhoa: "đức" }).rows.map((r) => r["Mã NV"]), ["C3"]);
  assert.deepEqual(RF.apply(rows, { tuKhoa: "DUC" }).rows.map((r) => r["Mã NV"]), ["C3"]);
  assert.deepEqual(RF.apply(rows, { chiCoThuNhap: true }).rows.map((r) => r["Mã NV"]), ["A1", "B2"]);
  assert.deepEqual(RF.apply(rows, { phongBan: ["Sản xuất"], thucLinhTu: 10 }).rows.map((r) => r["Mã NV"]), ["B2"]);
});
test("options chỉ gồm giá trị có thật; describe ghi rõ bộ lọc", () => {
  const o = RF.options(rows); assert.deepEqual(o.phongBan, ["Sản xuất", "Văn phòng"]); assert.deepEqual(o.maLuong, ["BD", "SP", "TG1"]);
  assert.deepEqual(RF.describe({ phongBan: ["Sản xuất"], chiCoThuNhap: true }), ["Phòng ban: Sản xuất", "Chỉ người có thu nhập"]);
  assert.ok(RF.isEmpty({ phongBan: [] }) && !RF.isEmpty({ tuKhoa: "x" }));
});

function kqThat() {
  const db = baseDb();
  db.nhansu = [staff({ "Mã nhân viên": "N1", "Họ và tên": "Một", "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã PB": "01.01", "Mã hỗ trợ": "HT.01", "Mã BHXH": "BH01", "Lương cơ bản": "5000000" }),
    staff({ "Mã nhân viên": "N2", "Họ và tên": "Hai", "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã PB": "01.06" })];
  db.chamcong = ["N1", "N2"].map((m) => ccRow(m, 2026, 9, "BT", 1, 20)).concat([ccRow("N1", 2026, 9, "CC", 1, 10)]);
  db.psluong = [{ "Ngày hạch toán": "2026-09-28", "Mã NV": "N1", "Thưởng": "500000", "Thu nhập khác": "0", "Trừ khác": "100000" }];
  return E.tinhBangLuong(db, 2026, 9, false);
}
test("Bảng tính nội bộ: chỉ khoản thu nhập, KHÔNG có khấu trừ/thực lĩnh; tổng khớp engine; thành phần cộng đúng", () => {
  const kq = kqThat(), vm = IPAY.build(kq, { nam: 2026, thang: 9 });
  const labels = vm.cols.map((c) => c.label);
  ["BH trừ NLĐ", "Thuế TNCN", "Tạm ứng", "Trừ khác", "Thực lĩnh"].forEach((x) => assert.ok(!labels.includes(x), x));
  assert.ok(labels.includes("Lương thời gian") && labels.includes("Thưởng") && labels.includes("Tiền cơm") && labels.includes("Tổng thu nhập"));
  assert.equal(vm.kiemTra.lech.length, 0);
  assert.equal(vm.tong["Tổng thu nhập"], kq.bangluong.reduce((s, r) => s + r["Tổng thu nhập"], 0));
  assert.equal(vm.groups.reduce((s, g) => s + g.rows.length, 0), 2);
  const rowsX = IPAY.toRows(vm); assert.equal(rowsX[rowsX.length - 1]["Họ và tên"], "TỔNG CỘNG");
});
test("lọc áp vào bảng nội bộ: tổng chỉ tính phần được lọc, view-model ghi lại bộ lọc", () => {
  const kq = kqThat(), pb1 = kq.bangluong.find((r) => r["Mã NV"] === "N1")["Phòng ban"];
  const vm = IPAY.build(kq, { nam: 2026, thang: 9, filter: { phongBan: [pb1] } });
  assert.equal(vm.soDong, 1); assert.equal(vm.soDongGoc, 2); assert.deepEqual(vm.loc, ["Phòng ban: " + pb1]);
  assert.equal(vm.tong["Tổng thu nhập"], kq.bangluong.find((r) => r["Mã NV"] === "N1")["Tổng thu nhập"]);
});
test("lệch thành phần ≠ tổng engine bị bắt (không che lỗi)", () => {
  const kq = kqThat(); kq.bangluong[0]["Tổng thu nhập"] += 12345;
  assert.equal(IPAY.build(kq, {}).kiemTra.lech.length, 1);
});
test("HTML in: escape dữ liệu, có CSP, không script, có dòng tổng và bộ lọc", () => {
  const kq = kqThat(); kq.bangluong[0]["Họ và tên"] = "<img src=x onerror=alert(1)>&\"";
  const html = RH.table(IPAY.build(kq, { nam: 2026, thang: 9, tenCongTy: "Cty <A>", filter: { chiCoThuNhap: true } }), { chuKy: ["Người lập"] });
  assert.ok(!/<img|<script/i.test(html)); assert.ok(html.includes("&lt;img")); assert.ok(html.includes("Content-Security-Policy"));
  assert.ok(html.includes("TỔNG CỘNG") && html.includes("Bộ lọc:") && html.includes("Cty &lt;A&gt;") && html.includes("Người lập"));
});

test("applyGeneric: chỉ áp tiêu chí mà bảng có cột; báo tiêu chí không áp; tách dòng tổng", () => {
  const RFm = require("../../core/reporting/report-filter.js");
  const rows = [{ "Mã NV": "A1", "Họ và tên": "Nguyễn Văn Á", "Số tiền": 10 }, { "Mã NV": "B2", "Họ và tên": "Lê Thị B", "Số tiền": 5 }, { "Mã NV": "TỔNG", "Họ và tên": "", "Số tiền": 15 }];
  const g = RFm.applyGeneric(rows, { tuKhoa: "nguyen", phongBan: ["X"], maLuong: ["CĐ"] });
  assert.deepEqual(g.rows.map((r) => r["Mã NV"]), ["A1"]); assert.equal(g.hadTotal, true);
  assert.deepEqual(g.applied, ["Từ khóa"]); assert.deepEqual(g.skipped.sort(), ["Mã lương", "Phòng ban"]);
  // bảng không có cột nào áp được → trả nguyên bản, không lọc mất dòng nào
  const pb = [{ "Phòng ban": "X", "Số tiền": 1 }, { "Phòng ban": "TỔNG", "Số tiền": 1 }];
  const g2 = RFm.applyGeneric(pb, { tuKhoa: "zzz" });
  assert.equal(g2.filtered, false); assert.equal(g2.rows.length, 2); assert.deepEqual(g2.skipped, ["Từ khóa"]);
  // 'Hình thức' (phiếu chi) được coi là HTTT
  const pc = [{ "Mã NV": "A", "Hình thức": "Chuyển khoản" }, { "Mã NV": "B", "Hình thức": "Tiền mặt" }];
  assert.deepEqual(RFm.applyGeneric(pc, { httt: ["Tiền mặt"] }).rows.map((r) => r["Mã NV"]), ["B"]);
  assert.equal(RFm.applyGeneric(rows, {}).filtered, false);
});

test("report-html sheets(): dựng HTML nhiều bảng, escape dữ liệu, không script, số căn phải, bỏ cột nội bộ '_…'", () => {
  const RH = require("../../core/reporting/report-html.js");
  const html = RH.sheets({ title: "Báo cáo <b>", ky: "Kỳ 9/2026", loc: ["Từ khóa: “a”"], sheets: [{ name: "S1", rows: [{ "Mã NV": "<script>x</script>", "Tiền": 1234567, _ct: {} }, { "Mã NV": "TỔNG", "Tiền": 1234567, _ct: {} }] }, { name: "S2", rows: [] }] }, { chuKy: ["Người lập"] });
  assert.ok(!/<script/i.test(html) && /&lt;script&gt;/.test(html) && /1\.234\.567/.test(html) && /class="m"/.test(html) && !/_ct/.test(html) && /class="tot"/.test(html) && /Người lập/.test(html));
  assert.ok(/Không có dòng nào khớp/.test(RH.sheets({ title: "T", sheets: [{ name: "x", rows: [] }] })));
});
