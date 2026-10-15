// V10.3 — HAK Smart Filter (lõi thuần dữ liệu): tìm không dấu, chọn một/nhiều, kỳ ⇄ khoảng ngày, đặt lại, chip, bộ lọc đã lưu theo màn hình,
// điều kiện không hỗ trợ không bị bỏ âm thầm, một chuỗi phạm vi duy nhất cho màn hình/Excel/PDF/in. Dữ liệu giả lập.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const SF = require("../../core/smart-filter.js");

const rows = [
  { id: 1, ten: "Nguyễn Văn Ánh", pb: "Sản xuất", ngay: "2026-09-03", tt: "Đang làm việc", tien: 100 },
  { id: 2, ten: "Đặng Thị Bình", pb: "Văn phòng", ngay: "2026-09-30", tt: "Đã nghỉ việc", tien: 200 },
  { id: 3, ten: "Lê Hoàng", pb: "", ngay: "2026-10-01", tt: "Đang làm việc", tien: 300 },
  { id: 4, ten: "Phạm Dũng", pb: "Sản xuất", ngay: "2026-08-31", tt: "Đang làm việc", tien: 400 }
];
const cfg = {
  screenId: "demo",
  fields: [
    { key: "pb", label: "Phòng ban", type: "multi", options: () => ["Sản xuất", "Văn phòng"], match: (r, v) => SF.inSet(v, r.pb) },
    { key: "tt", label: "Trạng thái", type: "enum", options: ["Đang làm việc", "Đã nghỉ việc"], match: (r, v) => r.tt === v },
    { key: "chiCo", label: "Chỉ có tiền > 150", type: "bool", match: (r) => r.tien > 150 },
    { key: "khongMatch", label: "Không có hàm match", type: "multi", options: () => ["x"] }
  ],
  matchQ: (r, q) => SF.hay([r.ten, r.pb]).indexOf(q) >= 0,
  matchDate: (r, tu, den) => (!tu || r.ngay >= tu) && (!den || r.ngay <= den)
};
const ids = (r) => r.rows.map((x) => x.id);

test("U-SF-01 tìm không phân biệt hoa/thường và dấu tiếng Việt (đ/Đ, thanh dấu)", () => {
  assert.equal(SF.fold("  Đặng THỊ Bình "), "dang thi binh");
  assert.deepEqual(ids(SF.filterRows(rows, cfg, { q: "dang" })), [2]);
  assert.deepEqual(ids(SF.filterRows(rows, cfg, { q: "ANH" })), [1]);
  assert.deepEqual(ids(SF.filterRows(rows, cfg, { q: "san xuat" })), [1, 4]);
  assert.deepEqual(ids(SF.filterRows(rows, cfg, { q: "" })), [1, 2, 3, 4]);
});
test("U-SF-02 chọn một / nhiều giá trị (HOẶC trong 1 tiêu chí, VÀ giữa các tiêu chí); '(Không có)' khớp giá trị rỗng", () => {
  assert.deepEqual(ids(SF.filterRows(rows, cfg, { sel: { pb: ["Sản xuất"] } })), [1, 4]);
  assert.deepEqual(ids(SF.filterRows(rows, cfg, { sel: { pb: ["Sản xuất", "Văn phòng"] } })), [1, 2, 4]);
  assert.deepEqual(ids(SF.filterRows(rows, cfg, { sel: { pb: [SF.NONE] } })), [3]);
  assert.deepEqual(ids(SF.filterRows(rows, cfg, { sel: { pb: ["san xuat", SF.NONE] } })), [1, 3, 4], "so khớp không dấu/hoa thường");
  assert.deepEqual(ids(SF.filterRows(rows, cfg, { sel: { pb: ["Sản xuất"] }, one: { tt: "Đang làm việc" }, flag: { chiCo: true } })), [4]);
});
test("U-SF-03 kỳ điều khiển khoảng ngày; sửa tay ngày → 'tùy chọn'; trùng đúng cả kỳ thì nhận lại kỳ", () => {
  let s = SF.setPeriod(SF.empty(), "2026-09");
  assert.deepEqual([s.ky, s.tu, s.den], ["2026-09", "2026-09-01", "2026-09-30"]);
  assert.deepEqual(ids(SF.filterRows(rows, cfg, s)), [1, 2], "gồm cả hai đầu (3/9 và 30/9)");
  s = SF.setDates(s, "2026-09-05", "2026-09-30"); assert.equal(s.ky, "", "sửa ngày → tùy chọn");
  s = SF.setDates(s, "2026-02-01", "2026-02-28"); assert.equal(s.ky, "2026-02");
  s = SF.setDates(s, "2028-02-01", "2028-02-29"); assert.equal(s.ky, "2028-02", "tháng 2 năm nhuận");
  assert.deepEqual(SF.periodBounds("2026-12"), ["2026-12-01", "2026-12-31"]);
  assert.equal(SF.periodBounds("2026-13"), null); assert.equal(SF.periodBounds("2026-00"), null); assert.equal(SF.periodBounds("2026-9"), null);
  s = SF.setPeriod(s, ""); assert.deepEqual([s.ky, s.tu, s.den], ["", "", ""]);
});
test("U-SF-04 từ ≤ đến: ngày ngược bị báo (không tự đổi chỗ); ngày dd/MM/yyyy thật mới được chấp nhận", () => {
  const s = SF.setDates(SF.empty(), "2026-09-30", "2026-09-01");
  assert.match(SF.dateProblem(s), /Từ ngày lớn hơn đến ngày/); assert.deepEqual([s.tu, s.den], ["2026-09-30", "2026-09-01"]);
  assert.deepEqual(ids(SF.filterRows(rows, cfg, s)), [], "khoảng ngược → không dòng nào khớp, không đoán ý");
  assert.equal(SF.dateProblem(SF.setDates(SF.empty(), "2026-09-01", "2026-09-30")), "");
  assert.equal(SF.parseVN("29/02/2028"), "2028-02-29"); assert.equal(SF.parseVN("29/02/2026"), null); assert.equal(SF.parseVN("31/04/2026"), null);
  assert.equal(SF.parseVN("1-2-2026"), "2026-02-01"); assert.equal(SF.parseVN(""), ""); assert.equal(SF.parseVN("abc"), null);
  assert.equal(SF.fmtVN("2026-09-03"), "03/09/2026"); assert.equal(SF.fmtVN("không phải ngày"), "");
});
test("U-SF-05 đặt lại: trạng thái rỗng, 0 điều kiện; chuẩn hóa bỏ khóa lạ / giá trị rỗng", () => {
  const s = { q: " Bình ", tu: "2026-09-01T00:00:00Z", sel: { pb: ["Sản xuất"], bo: [] }, one: { tt: "" }, flag: { chiCo: false, x: true } };
  const n = SF.normalize(s, cfg);
  assert.deepEqual(n, { q: "Bình", tu: "2026-09-01", den: "", ky: "", sel: { pb: ["Sản xuất"] }, one: {}, flag: {} });
  assert.equal(SF.activeCount(n), 3, "tìm + ngày + phòng ban");
  assert.equal(SF.isEmpty(SF.empty()), true); assert.equal(SF.activeCount(SF.empty()), 0); assert.equal(SF.isEmpty(n), false);
  assert.deepEqual(ids(SF.filterRows(rows, cfg, SF.empty())), [1, 2, 3, 4]);
});
test("U-SF-06 chip điều kiện & chuỗi phạm vi: một nguồn cho màn hình/Excel/PDF/in; gỡ từng chip", () => {
  let s = SF.setPeriod(SF.empty(), "2026-09"); s.q = "bình"; s = SF.setField(s, cfg.fields[0], ["Sản xuất", "Văn phòng"]); s = SF.setField(s, cfg.fields[1], "Đang làm việc");
  const c = SF.conditions(cfg, s).map((x) => x.text);
  assert.deepEqual(c, ["Tìm: bình", "Kỳ 09/2026", "Phòng phòng ban".replace("Phòng phòng ban", "Phòng ban: 2 mục"), "Trạng thái: Đang làm việc"]);
  assert.equal(SF.scopeText(cfg, s), c.join(" · "));
  const tuyChon = SF.setDates(s, "2026-09-05", "2026-09-20"); assert.ok(SF.conditions(cfg, tuyChon).some((x) => x.text === "Ngày: 05/09/2026 → 20/09/2026"));
  assert.equal(SF.scopeText(cfg, SF.empty()), "Tất cả (không lọc)"); assert.equal(SF.scopeText(cfg, SF.empty(), "kỳ 9/2026"), "kỳ 9/2026");
  let r = s; SF.conditions(cfg, s).forEach((x) => { r = SF.remove(r, x); }); assert.equal(SF.isEmpty(r), true, "gỡ hết chip = rỗng");
  assert.equal(SF.conditions(cfg, SF.setField(SF.empty(), cfg.fields[0], ["Sản xuất"]))[0].text, "Phòng ban: Sản xuất");
  assert.equal(SF.conditions(cfg, SF.setField(SF.empty(), cfg.fields[0], [SF.NONE]))[0].text, "Phòng ban: (không có)");
});
test("U-SF-07 điều kiện không hỗ trợ KHÔNG bị bỏ âm thầm: báo trong unsupported và hiện thành chip", () => {
  const noMatch = SF.filterRows(rows, cfg, { sel: { khongMatch: ["x"] } });
  assert.deepEqual(noMatch.unsupported, ["khongMatch"]); assert.equal(noMatch.kept, 4, "không lọc được thì giữ nguyên dòng — nhưng PHẢI báo");
  const noQ = SF.filterRows(rows, { fields: [] }, { q: "abc", tu: "2026-09-01" }); assert.deepEqual(noQ.unsupported, ["q", "date"]);
  const lạ = SF.conditions({ fields: [], labelOf: (k) => ({ maLuong: "Mã lương" })[k] || k }, { sel: { maLuong: ["TG1"] } });
  assert.equal(lạ.length, 1); assert.match(lạ[0].text, /không lọc được: Mã lương/);
  assert.equal(SF.remove({ sel: { maLuong: ["TG1"] } }, lạ[0]).sel.maLuong, undefined);
});
test("U-SF-08 lọc không làm đổi dữ liệu gốc và giữ thứ tự gốc; tổng tính từ đúng các dòng đã lọc (hiển thị = tổng)", () => {
  const snapshot = JSON.stringify(rows), st = { sel: { pb: ["Sản xuất"] } };
  const r = SF.filterRows(rows, cfg, st); assert.equal(JSON.stringify(rows), snapshot); assert.deepEqual(ids(r), [1, 4]);
  assert.equal(r.rows.reduce((a, x) => a + x.tien, 0), 500); assert.equal(r.kept, 2); assert.equal(r.total, 4);
  assert.notEqual(r.rows, rows, "trả bản sao, không trả chính mảng gốc");
  assert.deepEqual(SF.filterRows(null, cfg, st).rows, []);
});
test("U-SF-09 bộ lọc đã lưu: riêng từng màn hình, có phiên bản lược đồ, đọc lại đúng, xóa được", () => {
  const mem = {}, storage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  const P = SF.presets(storage), s1 = SF.setField(SF.empty(), cfg.fields[0], ["Sản xuất"]);
  assert.deepEqual(P.save("nhansu", "Chỉ sản xuất", s1, "2026-10-14T00:00:00Z"), { ok: true });
  assert.deepEqual(P.list("nhansu"), ["Chỉ sản xuất"]); assert.deepEqual(P.list("chamcong"), [], "màn hình khác không thấy");
  assert.equal(JSON.parse(mem["hak.sf.presets"]).schema, SF.SCHEMA);
  const P2 = SF.presets(storage); assert.deepEqual(P2.get("nhansu", "Chỉ sản xuất").state.sel.pb, ["Sản xuất"]);
  assert.equal(P.save("nhansu", "  ", s1).ok, false);
  assert.equal(P.remove("nhansu", "Chỉ sản xuất"), true); assert.deepEqual(P.list("nhansu"), []); assert.equal(P.remove("nhansu", "Chỉ sản xuất"), false);
  const bad = { getItem: () => "{hỏng", setItem: () => { throw new Error("đầy"); } };
  const PB = SF.presets(bad); assert.deepEqual(PB.list("x"), []); assert.equal(PB.isCorrupt(), true); assert.equal(PB.save("x", "a", s1).ok, false, "ghi lỗi → báo, không giả vờ đã lưu");
  mem["hak.sf.presets"] = JSON.stringify({ schema: 99, screens: { nhansu: { a: {} } } });
  assert.equal(SF.presets(storage).isCorrupt(), true, "lược đồ lạ: không đọc nhầm");
});
test("U-SF-10 mở bộ lọc đã lưu: điều kiện màn hình không có được BÁO (dropped), giá trị không còn trong danh sách cũng báo", () => {
  const preset = { state: { q: "a", sel: { pb: ["Sản xuất", "Đã xóa"], maLuong: ["TG1"] }, one: { tt: "Đang làm việc" }, flag: { khongCo: true } }, savedAt: "" };
  const r = SF.applyPreset(cfg, preset);
  assert.equal(r.ok, true); assert.deepEqual(r.state.sel, { pb: ["Sản xuất", "Đã xóa"] }); assert.equal(r.state.one.tt, "Đang làm việc");
  assert.deepEqual(r.dropped.sort(), ["khongCo", "maLuong", "pb=Đã xóa"].sort());
  assert.equal(SF.applyPreset(cfg, null).ok, false);
  const legacy = SF.applyPreset(Object.assign({ fromLegacy: (sp) => ({ sel: { pb: sp.phongBan } }) }, cfg), { legacy: { phongBan: ["Văn phòng"] } });
  assert.deepEqual(legacy.state.sel.pb, ["Văn phòng"]);
  assert.equal(SF.applyPreset(cfg, { legacy: { phongBan: ["x"] } }).ok, false, "bộ lọc cũ cần bộ chuyển đổi của màn hình");
});
test("U-SF-11 bộ lọc báo cáo V8 (hak.rf.presets) vẫn đọc được, không bị sao chép/xóa", () => {
  const mem = { "hak.rf.presets": JSON.stringify({ "Khối SX": { phongBan: ["Sản xuất"] } }) }, storage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  const P = SF.presets(storage);
  assert.deepEqual(P.legacyNames(), ["Khối SX"]); assert.deepEqual(P.legacyGet("Khối SX"), { legacy: { phongBan: ["Sản xuất"] } }); assert.equal(P.legacyGet("không có"), null);
  assert.deepEqual(P.list("rf:bangtinh"), []); P.save("rf:bangtinh", "Mới", SF.empty());
  assert.equal(mem["hak.rf.presets"], JSON.stringify({ "Khối SX": { phongBan: ["Sản xuất"] } }), "kho cũ giữ nguyên");
  assert.deepEqual(SF.presets({ getItem: () => "{{", setItem() {} }).legacyNames(), [], "kho cũ hỏng → rỗng, không ném lỗi");
});
test("U-SF-12 chuyển màn hình không rò rỉ: hai cấu hình dùng hai trạng thái độc lập (mô phỏng chuyển tab)", () => {
  const A = { s: SF.empty() }, B = { s: SF.empty() };
  A.s = SF.setField(A.s, cfg.fields[0], ["Sản xuất"]);
  assert.equal(SF.activeCount(A.s), 1); assert.equal(SF.activeCount(B.s), 0);
  const copy = SF.normalize(A.s); copy.sel.pb.push("Văn phòng"); assert.deepEqual(A.s.sel.pb, ["Sản xuất"], "normalize trả bản sao");
});
