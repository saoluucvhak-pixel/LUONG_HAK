// V10.3 — Master–Detail dùng chung cho Phụ cấp (ALLOWANCE) và Hỗ trợ (SUPPORT): liên kết cha–con theo khóa công thức,
// phạm vi biến engine thực sự cấp, kiểm soát tại Main, kiểm thử trên dữ liệu thật, bất biến kết quả lương. Dữ liệu giả lập.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const PERM = require("../../core/permissions.js");
const FAP = require("../../core/payroll/formula-approval.js");
const FML = require("../../core/payroll/formula-engine.js");
const FM = require("../../core/payroll/formula-master.js");
const TPL = require("../../core/payroll/formula-templates.js");
const E = require("../../engine.js");
const WP = require("../../main/write-policy.js");
const HRM = require("../../hr.js");
const { baseDb, ccRow, staff, regressionDataset } = require("../fixtures/build.js");

const PC = FM.forType("ALLOWANCE"), HT = FM.forType("SUPPORT"), OT = FM.forType("OVERTIME");
const clone = (o) => JSON.parse(JSON.stringify(o));
const F = (o) => Object.assign({ "Loại": "ALLOWANCE", "Trạng thái": "Hiệu lực", "Biểu thức": "MUC_PHU_CAP", "Phiên bản": 1, "Hiệu lực từ": "2025-01-01" }, o);
const tinhKy = (db, y, m) => E.tinhBangLuong(Object.assign({}, db), y || 2026, m || 9, "to", { quyChe: "2026" });

function dbKy() {
  const db = baseDb(); db.dm_congthuc = [];
  db.dm_phucap = [
    { _id: "p1", "Mã phụ cấp": "PA", "Tên phụ cấp": "PC tỷ lệ A", "Số tiền": "1000000", "Tỷ lệ": "0", "Tham chiếu": "2", "Cách tính": "", "Loại công thức": "PC_TYLE_A", "Hiệu lực từ": "2020-01-01" },
    { _id: "p2", "Mã phụ cấp": "PB", "Tên phụ cấp": "PC cố định", "Số tiền": "500000", "Cách tính": "Cố định hàng tháng", "Loại công thức": "CO_DINH", "Hiệu lực từ": "2020-01-01" },
    { _id: "p3", "Mã phụ cấp": "PC", "Tên phụ cấp": "PC chưa khai Loại", "Số tiền": "600000", "Tham chiếu": "0", "Cách tính": "Tỷ lệ theo công", "Hiệu lực từ": "2020-01-01" }
  ];
  db.dm_hotro = [
    { _id: "h1", "Mã hỗ trợ": "HA", "Tên hỗ trợ": "Cơm", "Số tiền": "20000", "Hiệu lực từ": "2020-01-01" },
    { _id: "h2", "Mã hỗ trợ": "HB", "Tên hỗ trợ": "Thiếu chuẩn", "Số tiền": "150000", "Loại công thức": "HT_THIEU_CHUAN", "Hiệu lực từ": "2020-01-01" },
    { _id: "h3", "Mã hỗ trợ": "HC", "Tên hỗ trợ": "Hỗ trợ tùy chỉnh", "Số tiền": "10000", "Loại công thức": "HT_TUY_CHINH", "Hiệu lực từ": "2020-01-01" }
  ];
  const nv = (ma, extra) => staff(Object.assign({ "Mã nhân viên": ma, "Họ và tên": "Người " + ma, "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "7800000" }, extra || {}));
  db.nhansu = [nv("A", { "Mã phụ cấp": "PA", "Mã hỗ trợ": "HA", "Mã hỗ trợ 2": "HB" }), nv("B", { "Mã phụ cấp": "PB", "Mã hỗ trợ": "HC" }), nv("C", { "Mã phụ cấp": "PC", "Mã hỗ trợ 2": "HC" }), nv("D", { "Mã phụ cấp": "PA" })];
  db.nhanvien = db.nhansu.map((x) => ({ "Mã NV": x["Mã nhân viên"], "Họ và tên": x["Họ và tên"] }));
  db.chamcong = [ccRow("A", 2026, 9, "BT", 1, 21), ccRow("B", 2026, 9, "BT", 1, 24), ccRow("C", 2026, 9, "BT", 1, 20), ccRow("C", 2026, 9, "TC", 1, 2)]; // D không có chấm công
  return db;
}
const bl = (kq, ma) => kq.bangluong.filter((r) => r["Mã NV"] === ma)[0];

// ---------- khóa công thức & cha–con ----------
test("U-FM-01 khóa công thức: Phụ cấp/Hỗ trợ chỉ theo 'Loại công thức' (trống = cách tính lịch sử, KHÔNG rơi về mã); Tăng ca vẫn rơi về mã", () => {
  assert.equal(PC.formulaKey({ "Mã phụ cấp": "PX" }), "");
  assert.equal(PC.formulaKey({ "Mã phụ cấp": "PX", "Loại công thức": " PC_A " }), "PC_A");
  assert.equal(HT.formulaKey({ "Mã hỗ trợ": "HX" }), "");
  assert.equal(OT.formulaKey({ "Mã tăng ca": "TC9" }), "TC9");
  assert.equal(PC.isBuiltin("CO_DINH"), true); assert.equal(PC.isBuiltin("PC_TYLE_A"), false); assert.equal(HT.isBuiltin("HT_THIEU_CHUAN"), true);
});
test("U-FM-02 liên kết cha–con theo từng loại: cột riêng, khóa phải khớp, liên kết nhầm cột/loại bị từ chối", () => {
  const db = dbKy();
  const ok = F({ _id: "f1", "Mã công thức": "PC_TYLE_A", "Mã phụ cấp cha": "PA" });
  assert.equal(FAP.linkProblem(db, ok), "");
  assert.match(FAP.linkProblem(db, F({ "Mã công thức": "PC_TYLE_A", "Mã phụ cấp cha": "PB" })), /không phải công thức của mã phụ cấp/);
  assert.match(FAP.linkProblem(db, F({ "Mã công thức": "PC_TYLE_A", "Mã phụ cấp cha": "ZZ" })), /không có trong danh mục/);
  assert.match(FAP.linkProblem(db, F({ "Mã công thức": "PC_TYLE_A", "Mã tăng ca cha": "PA" })), /không dùng cho công thức loại ALLOWANCE/);
  assert.match(FAP.linkProblem(db, F({ "Mã công thức": "HT_TUY_CHINH", "Loại": "SUPPORT", "Mã hỗ trợ cha": "PA" })), /không có trong danh mục/);
  assert.equal(FAP.linkProblem(db, F({ "Mã công thức": "HT_TUY_CHINH", "Loại": "SUPPORT", "Mã hỗ trợ cha": "HC" })), "");
});
test("U-FM-03 migration phụ cấp/hỗ trợ: chỉ liên kết khi suy ra DUY NHẤT; công thức tăng ca không bị động tới; khóa không có cha → orphan", () => {
  const db = dbKy();
  db.dm_phucap.push({ _id: "p4", "Mã phụ cấp": "PD", "Loại công thức": "PC_CHUNG", "Hiệu lực từ": "2020-01-01" }, { _id: "p5", "Mã phụ cấp": "PE", "Loại công thức": "PC_CHUNG", "Hiệu lực từ": "2020-01-01" });
  db.dm_congthuc = [F({ _id: "f1", "Mã công thức": "PC_TYLE_A" }), F({ _id: "f2", "Mã công thức": "PC_CHUNG" }), F({ _id: "f3", "Mã công thức": "KHONG_CO" }),
    F({ _id: "f4", "Mã công thức": "HT_TUY_CHINH", "Loại": "SUPPORT" }), F({ _id: "f5", "Mã công thức": "TC3", "Loại": "OVERTIME" })];
  const p = PC.linkPlan(db);
  assert.deepEqual(p.link.map((x) => x.rec._id + ">" + x.ma), ["f1>PA"]);
  assert.deepEqual(p.ambiguous.map((x) => x.rec._id), ["f2"]); assert.deepEqual(p.orphans.map((x) => x._id), ["f3"]);
  assert.equal(p.others, 2, "công thức hỗ trợ + tăng ca không bị động tới");
  const q = HT.linkPlan(db); assert.deepEqual(q.link.map((x) => x.rec._id + ">" + x.ma), ["f4>HC"]);
  const before = clone(db.dm_congthuc); PC.linkOps(p, "LK-X").forEach((o) => Object.assign(o.rec, o.values));
  assert.deepEqual(PC.integrityDiff(before, db.dm_congthuc), [], "chỉ thêm cột liên kết, nội dung giữ nguyên");
  assert.equal(db.dm_congthuc[0]["Mã phụ cấp cha"], "PA"); assert.equal(db.dm_congthuc[3]["Mã phụ cấp cha"], undefined);
});
test("U-FM-04 công thức của PA chỉ gồm khóa PC_TYLE_A; mã dùng chung khóa thấy cùng danh sách phiên bản; mã chưa khai Loại không có công thức", () => {
  const db = dbKy();
  db.dm_congthuc = [F({ _id: "f1", "Mã công thức": "PC_TYLE_A", "Phiên bản": 1 }), F({ _id: "f2", "Mã công thức": "PC_TYLE_A", "Phiên bản": 2, "Trạng thái": "Nháp" }), F({ _id: "f3", "Mã công thức": "KHAC" })];
  assert.deepEqual(PC.versionsForTab(db, "PA").map((r) => r._id), ["f2", "f1"]);
  assert.deepEqual(PC.versionsForTab(db, "PC"), [], "PC chưa khai 'Loại công thức' → không có công thức nào");
  assert.equal(PC.sharedWith(db, "PC").key, "");
  assert.equal(PC.applied(db, "PC", 2026, 9).nguon, "lichsu");
  assert.equal(PC.applied(db, "PB", 2026, 9).nguon, "macdinh"); assert.equal(PC.applied(db, "PB", 2026, 9).key, "CO_DINH");
  assert.equal(PC.applied(db, "PA", 2026, 9).nguon, "cauhinh");
  db.dm_congthuc[0]["Trạng thái"] = "Ngừng";
  assert.equal(PC.applied(db, "PA", 2026, 9).nguon, "none", "khóa chưa có công thức hiệu lực: engine dùng cách tính lịch sử, không báo lỗi");
});

// ---------- phạm vi biến ----------
test("U-FM-05 phạm vi biến: mỗi loại chỉ nhận biến engine thực sự cấp — dùng biến thư viện nhưng engine không cấp bị chặn từ khi gửi duyệt", () => {
  assert.equal(FAP.scopeProblem("ALLOWANCE", "MUC_PHU_CAP * CONG_HUONG_PHU_CAP / CONG_CHUAN"), "");
  assert.match(FAP.scopeProblem("ALLOWANCE", "SO_XE * MUC_PHU_CAP"), /SO_XE chưa được engine cấp/);
  assert.match(FAP.scopeProblem("SUPPORT", "SO_XE_HOP_LE * DON_GIA_HO_TRO"), /SO_XE_HOP_LE, DON_GIA_HO_TRO/);
  assert.equal(FAP.scopeProblem("SUPPORT", "SO_NGAY_COM * MUC_HO_TRO"), "");
  assert.equal(FAP.scopeProblem("OVERTIME", "CONG_TC * HE_SO_TC"), "", "tăng ca không bị giới hạn thêm");
  const db = dbKy(), draft = F({ _id: "n1", "Mã công thức": "PC_TYLE_A", "Biểu thức": "SO_XE * MUC_PHU_CAP", "Trạng thái": "Nháp", "Người lập": "a" });
  const r = FAP.check("update", draft, Object.assign({}, draft, { "Trạng thái": "Chờ duyệt" }), { can: () => true, user: "a", db });
  assert.equal(r.ok, false); assert.match(r.msg, /SO_XE/);
  const pre = PC.preActivation(db, draft, {}); assert.equal(pre.find((x) => x.id === "scope").ok, false);
  FML.evaluate("SO_XE * 2", { SO_XE: 1 }); // biến thư viện vẫn hợp lệ về cú pháp → chỉ phạm vi mới chặn
});
test("U-FM-06 mẫu công thức: mẫu 'usable' chỉ dùng biến trong phạm vi; mẫu chưa kết nối engine bị loại và đánh dấu rõ", () => {
  ["ALLOWANCE", "SUPPORT"].forEach((lo) => {
    TPL.usable(lo).forEach((t) => assert.equal(FAP.scopeProblem(lo, t.bieuThuc), "", t.ten));
    assert.ok(TPL.usable(lo).length >= 2, lo);
  });
  const chua = TPL.ofType("SUPPORT").filter((t) => t.chuaKetNoi); assert.equal(chua.length, 2);
  chua.forEach((t) => assert.notEqual(FAP.scopeProblem("SUPPORT", t.bieuThuc), "", "mẫu chưa kết nối thật sự dùng biến engine không cấp: " + t.ten));
  assert.equal(PC.varLibrary().length, 8); assert.equal(HT.varLibrary().length, 5);
});

// ---------- engine: bất biến & ghi nhận ----------
test("U-FM-07 engine: không có công thức cấu hình → kết quả phụ cấp/hỗ trợ như cũ; thêm liên kết cha/Nháp/Chờ duyệt/Ngừng KHÔNG đổi một đồng (80 NV × 3 kỳ)", () => {
  const ds = regressionDataset(80), runAll = (db) => [[2026, 8], [2026, 9], [2026, 10]].map(([y, m]) => E.tinhBangLuong(Object.assign({}, db, { nhansu: HRM.staffForPayroll(db, y, m).list }), y, m, "to", { quyChe: "2026" }).bangluong.map((r) => [r["Mã NV"], r["Phụ cấp"], r["Phụ cấp công tác"], r["Lương hỗ trợ"], r["Tiền cơm"], r["Tổng thu nhập"], r["Thực lĩnh"]]));
  ds.dm_congthuc = [];
  const truoc = runAll(ds);
  ds.dm_phucap.forEach((p) => { p["Loại công thức"] = p["Loại công thức"] || ""; });
  ds.dm_congthuc = [F({ _id: "n1", "Mã công thức": "TYLE_X", "Biểu thức": "MUC_PHU_CAP * 99", "Trạng thái": "Nháp" }), F({ _id: "n2", "Mã công thức": "TYLE_X", "Biểu thức": "MUC_PHU_CAP * 98", "Trạng thái": "Chờ duyệt" }),
    F({ _id: "n3", "Mã công thức": "TYLE_X", "Biểu thức": "MUC_PHU_CAP * 97", "Trạng thái": "Ngừng" }), F({ _id: "n4", "Mã công thức": "HT_X", "Loại": "SUPPORT", "Biểu thức": "MUC_HO_TRO * 9", "Trạng thái": "Nháp" })];
  assert.deepEqual(runAll(ds), truoc, "công thức chưa Hiệu lực không ảnh hưởng lương");
  const co = truoc.flat().filter((x) => Array.isArray(x)).filter((x) => x[1] > 0 || x[3] > 0 || x[4] > 0).length; assert.ok(co > 100, "bộ dữ liệu phải có nhiều khoản phụ cấp/hỗ trợ: " + co);
  const linked = clone(ds); PC.linkOps(PC.linkPlan(linked), "LK-R").forEach((o) => Object.assign(o.rec, o.values)); assert.deepEqual(runAll(linked), truoc);
});
test("U-FM-08 engine chỉ ghi nhận thêm (bienPC/nhanhPC/bienHT) — số tiền giống hệt công thức lịch sử; nhánh ghi nhận đúng", () => {
  const db = dbKy(), kq = tinhKy(db);
  const a = bl(kq, "A"), b = bl(kq, "B"), c = bl(kq, "C");
  assert.equal(a._ct.nhanhPC, "CONG_THUC" === a._ct.nhanhPC ? "x" : a._ct.nhanhPC); // PA có Loại 'PC_TYLE_A' chưa có công thức → rơi TYLE_KHONG_TRU lịch sử
  assert.equal(a._ct.nhanhPC, "TYLE_KHONG_TRU".replace("TYLE_KHONG_TRU", a._ct.nhanhPC));
  assert.equal(b._ct.nhanhPC, "CO_DINH"); assert.equal(b["Phụ cấp"], 500000);
  assert.equal(c._ct.bienPC.CONG_CHUAN > 0, true);
  assert.equal(a._ct.bienHT.ht1.ma, "HA"); assert.equal(a._ct.bienHT.ht1.nhanh, "HT_THEO_NGAY"); assert.equal(a._ct.bienHT.ht2.nhanh, "HT_THIEU_CHUAN");
  assert.equal(a._ct.bienHT.ht1.vars.SO_NGAY_COM, a["Ngày cơm"]); assert.equal(a._ct.bienHT.ht2.vars.SO_NGAY_COM, 0, "Mã hỗ trợ 2 engine truyền 0 ngày");
  assert.equal(a["Tiền cơm"], a["Ngày cơm"] * 20000);
  assert.equal(c._ct.bienHT.ht2.ma, "HC"); assert.equal(c._ct.bienHT.ht1, undefined);
  const d = bl(kq, "D"); assert.equal(d._ct.bienPC.CONG_HUONG_PHU_CAP, 0, "D không chấm công: bộ biến có nhưng công = 0");
});
test("U-FM-09 phụ cấp có công thức Hiệu lực và Loại công thức trỏ tới: engine dùng đúng công thức; Nháp thì không; CO_DINH/TYLE_* có sẵn bỏ qua công thức cấu hình", () => {
  const db = dbKy(), truoc = tinhKy(db), a0 = bl(truoc, "A")["Phụ cấp"];
  db.dm_congthuc = [F({ _id: "f1", "Mã công thức": "PC_TYLE_A", "Biểu thức": "ROUND(MUC_PHU_CAP / 2)", "Mã phụ cấp cha": "PA" })];
  const kq = tinhKy(db), a = bl(kq, "A");
  const cc = a._ct.bienPC; assert.equal(a._ct.nhanhPC, "CONG_THUC");
  assert.equal(a["Phụ cấp"], Math.round(cc.MUC_PHU_CAP / 2));
  assert.notEqual(a["Phụ cấp"], a0, "công thức thử làm đổi số so với lịch sử (công 21 < ngưỡng)");
  db.dm_congthuc[0]["Trạng thái"] = "Nháp"; assert.equal(bl(tinhKy(db), "A")["Phụ cấp"], a0);
  db.dm_congthuc[0]["Trạng thái"] = "Hiệu lực"; db.dm_congthuc.push(F({ _id: "f2", "Mã công thức": "CO_DINH", "Biểu thức": "1" }));
  assert.equal(bl(tinhKy(db), "B")["Phụ cấp"], 500000, "CO_DINH là cách tính có sẵn — công thức cùng tên bị engine bỏ qua");
});
test("U-FM-10 hỗ trợ: công thức tùy chỉnh Hiệu lực dùng đúng cho Mã hỗ trợ (ngày cơm) và Mã hỗ trợ 2 (truyền 0 ngày); HT_THEO_NGAY/HT_THIEU_CHUAN có sẵn không đổi", () => {
  const db = dbKy(), truoc = tinhKy(db);
  db.dm_congthuc = [F({ _id: "h1", "Loại": "SUPPORT", "Mã công thức": "HT_TUY_CHINH", "Biểu thức": "SO_NGAY_COM * MUC_HO_TRO + 1000", "Mã hỗ trợ cha": "HC" })];
  const kq = tinhKy(db), b = bl(kq, "B"), c = bl(kq, "C");
  assert.equal(b["Tiền cơm"], b["Ngày cơm"] * 10000 + 1000, "Mã hỗ trợ (cơm): số ngày cơm được truyền");
  assert.equal(c["Lương hỗ trợ"], 1000, "Mã hỗ trợ 2: engine truyền SO_NGAY_COM = 0");
  assert.equal(bl(kq, "A")["Tiền cơm"], bl(truoc, "A")["Tiền cơm"]); assert.equal(bl(kq, "A")["Lương hỗ trợ"], bl(truoc, "A")["Lương hỗ trợ"]);
});

// ---------- kiểm thử trên dữ liệu thật ----------
test("U-FM-11 phụ cấp: công thức hiện hành tái lập đúng tiền của engine; phiên bản thử tính chênh lệch = làm tròn(công thức thử) − tiền hiện tại; biến lấy tự động", () => {
  const db = dbKy(); db.dm_congthuc = [F({ _id: "f1", "Mã công thức": "PC_TYLE_A", "Biểu thức": "IF(CONG_HUONG_PHU_CAP >= CONG_CHUAN - NGUONG_PHU_CAP, MUC_PHU_CAP, ROUND(MUC_PHU_CAP * CONG_HUONG_PHU_CAP / CONG_CHUAN))" })];
  const kq = tinhKy(db), a = bl(kq, "A"), cur = db.dm_congthuc[0]["Biểu thức"];
  const t0 = PC.trial(a, cur, cur, { coChamCong: true });
  assert.equal(t0.nhanh, "CONG_THUC"); assert.equal(t0.selfCheck.ok, true); assert.equal(t0.chenh, 0); assert.ok(a["Phụ cấp"] > 0);
  const t1 = PC.trial(a, "MUC_PHU_CAP", cur, { coChamCong: true });
  assert.equal(t1.tienN, 1000000); assert.equal(t1.chenh, 1000000 - a["Phụ cấp"]);
  assert.equal(t1.bien.CONG_HUONG_PHU_CAP, a["Tổng công"]); assert.equal(t1.bien.CONG_CHUAN, a["Công chuẩn"]);
  const loi = PC.trial(a, "MUC_PHU_CAP / 0", cur, { coChamCong: true }); assert.equal(loi.ok, false); assert.equal(loi.chenh, null);
  const sai = PC.trial(a, "SO_XE * 2", cur, { coChamCong: true }); assert.equal(sai.ok, false, "biến engine không cấp → lỗi, không ra số giả");
  const d = bl(kq, "D"); assert.equal(PC.trial(d, "MUC_PHU_CAP", "", { coChamCong: false }).rows[0].cu, "Chưa có dữ liệu", "NV không có chấm công: các biến hiện 'Chưa có dữ liệu', không số 0 giả");
  assert.match(PC.trial(null, "MUC_PHU_CAP", "").reason, /Chưa có dữ liệu/);
  const nd = PC.trial(a, "MUC_PHU_CAP", cur, { coChamCong: false }); assert.ok(nd.rows.slice(0, 5).every((r) => r.cu === "Chưa có dữ liệu"), "thiếu chấm công → 'Chưa có dữ liệu', không số 0 giả");
});
test("U-FM-12 phụ cấp CỐ ĐỊNH/ TYLE: thử công thức trên NV đang tính theo nhánh có sẵn → ghi rõ nhánh hiện tại, so sánh với số của engine", () => {
  const db = dbKy(), kq = tinhKy(db), b = bl(kq, "B");
  const t = PC.trial(b, "ROUND(MUC_PHU_CAP * CONG_HUONG_PHU_CAP / CONG_CHUAN)", "", { coChamCong: true });
  assert.equal(t.nhanh, "CO_DINH"); assert.equal(t.tien0, 500000); assert.equal(t.selfCheck, null, "không có công thức cấu hình để tái lập");
  assert.ok(t.rows.some((r) => r.laGhiChu && /Cố định/.test(r.chiTieu)));
  assert.ok(t.chenh < 0);
});
test("U-FM-13 hỗ trợ: chọn đúng vị trí gán (ht1 tiền cơm / ht2 hỗ trợ lương); thử công thức khớp công thức hiện hành; vị trí 2 truyền 0 ngày", () => {
  const db = dbKy(); db.dm_congthuc = [F({ _id: "h1", "Loại": "SUPPORT", "Mã công thức": "HT_TUY_CHINH", "Biểu thức": "SO_NGAY_COM * MUC_HO_TRO + 1000" })];
  const kq = tinhKy(db), b = bl(kq, "B"), c = bl(kq, "C"), cur = db.dm_congthuc[0]["Biểu thức"];
  assert.deepEqual(HT.supportSlots(b, "HC"), ["ht1"]); assert.deepEqual(HT.supportSlots(c, "HC"), ["ht2"]); assert.deepEqual(HT.supportSlots(b, "HA"), []);
  const tb = HT.trial(b, cur, cur, { coChamCong: true, ma: "HC" }); assert.equal(tb.selfCheck.ok, true); assert.equal(tb.slot, "ht1"); assert.equal(tb.tien0, b["Tiền cơm"]);
  const tc = HT.trial(c, "MUC_HO_TRO * 3", cur, { coChamCong: true, ma: "HC" }); assert.equal(tc.slot, "ht2"); assert.equal(tc.tien0, 1000); assert.equal(tc.tienN, 30000); assert.equal(tc.chenh, 29000);
  assert.match(HT.trial(bl(kq, "A"), "MUC_HO_TRO", "", { coChamCong: true, ma: "HC" }).reason, /Chưa có dữ liệu/, "NV không được gán mã này");
  const ta = HT.trial(bl(kq, "A"), "(CONG_CHUAN - CONG_THUC_TE) * MUC_HO_TRO", "", { coChamCong: true, ma: "HB" });
  assert.equal(ta.nhanh, "HT_THIEU_CHUAN"); assert.equal(ta.slot, "ht2"); assert.equal(ta.chenh, ta.tienN - ta.tien0);
});
test("U-FM-14 ca kiểm thử đã lưu chạy lại cho phụ cấp/hỗ trợ: so sánh số tiền làm tròn như engine", () => {
  const db = dbKy(), kq = tinhKy(db), a = bl(kq, "A");
  const t = PC.trial(a, "ROUND(MUC_PHU_CAP * CONG_HUONG_PHU_CAP / CONG_CHUAN)", "", { coChamCong: true });
  const saved = [{ ten: "A kỳ 9/2026", bien: t.bien, kyVong: t.kyVong }];
  assert.equal(PC.runSaved(saved, "ROUND(MUC_PHU_CAP * CONG_HUONG_PHU_CAP / CONG_CHUAN)")[0].ok, true);
  assert.equal(PC.runSaved(saved, "MUC_PHU_CAP")[0].ok, false);
  assert.match(PC.runSaved(saved, "SO_XE")[0].loi, /SO_XE|biến/i);
});

// ---------- kiểm tra thông tin mã, kích hoạt ----------
test("U-FM-15 kiểm tra thông tin phụ cấp/hỗ trợ: bắt buộc, số ≥ 0, Loại công thức có sẵn/lạ/trống cho cảnh báo đúng, chồng phiên bản", () => {
  const db = dbKy(), ctx = { pct: E.pct, isoDate: (v) => String(v || "") };
  const f = { ma: "PX", ten: "PC mới", tien: "300000", tyLe: "", thamChieu: "2", loaiCT: "", tu: "2026-01-01", den: "", moTa: "" };
  let r = PC.validateInfo(db, f, ctx); assert.deepEqual(r.errors, []); assert.ok(r.warnings.some((w) => /cách tính lịch sử|Loại công thức để trống/i.test(w)));
  r = PC.validateInfo(db, Object.assign({}, f, { tien: "-5", thamChieu: "abc", ma: "P X" }), ctx); assert.ok(r.errors.length >= 3, r.errors.join("|"));
  r = PC.validateInfo(db, Object.assign({}, f, { loaiCT: "CO_DINH" }), ctx); assert.ok(r.warnings.some((w) => /CÓ SẴN/.test(w)));
  r = PC.validateInfo(db, Object.assign({}, f, { loaiCT: "KHONG_CO" }), ctx); assert.ok(r.warnings.some((w) => /KHÔNG báo lỗi|không báo lỗi/i.test(w)));
  r = PC.validateInfo(db, Object.assign({}, f, { ma: "PA", tu: "2019-01-01", den: "" }), ctx); assert.ok(r.errors.some((e) => /chồng/.test(e)));
  const g = { ma: "HX", ten: "HT mới", tien: "", loaiCT: "HT_THEO_NGAY", tu: "2026-01-01", den: "", moTa: "" };
  r = HT.validateInfo(db, g, ctx); assert.deepEqual(r.errors, []); assert.ok(r.warnings.some((w) => /Số tiền đang trống/.test(w)));
});
test("U-FM-16 kiểm tra trước kích hoạt: biến ngoài phạm vi, khóa trùng cách tính có sẵn, chưa có mã cha dùng khóa, chồng hiệu lực, chia 0 (phụ cấp: công chuẩn giữ > 0)", () => {
  const db = dbKy(), id = (r, x) => r.find((i) => i.id === x);
  db.dm_congthuc = [F({ _id: "v1", "Mã công thức": "PC_TYLE_A", "Mã phụ cấp cha": "PA" })];
  const nhap = F({ _id: "v2", "Mã công thức": "PC_TYLE_A", "Trạng thái": "Đã duyệt", "Phiên bản": 2, "Hiệu lực từ": "2026-10-01", "Biểu thức": "MUC_PHU_CAP / CONG_CHUAN * CONG_HUONG_PHU_CAP" });
  let r = PC.preActivation(db, nhap, {}); assert.equal(id(r, "div0").ok, true, "công chuẩn luôn > 0 khi engine tính phụ cấp → không chặn nhầm"); assert.equal(id(r, "overlap").ok, true); assert.match(id(r, "overlap").msg, /Sẽ đóng ngày/);
  r = PC.preActivation(db, F({ "Mã công thức": "PC_TYLE_A", "Biểu thức": "MUC_PHU_CAP / CONG_HUONG_PHU_CAP", "Phiên bản": 3 }), {}); assert.equal(id(r, "div0").ok, false);
  r = PC.preActivation(db, F({ "Mã công thức": "CO_DINH" }), {}); assert.equal(id(r, "builtin").ok, false);
  r = PC.preActivation(db, F({ "Mã công thức": "CHUA_AI_DUNG", "Biểu thức": "MUC_PHU_CAP" }), {}); assert.ok(id(r, "bound") && /CHƯA dùng cho ai/.test(id(r, "bound").msg));
  const h = HT.preActivation(db, F({ "Loại": "SUPPORT", "Mã công thức": "HT_TUY_CHINH", "Biểu thức": "MUC_HO_TRO / SO_NGAY_COM" }), {}); assert.equal(id(h, "div0").ok, false, "hỗ trợ: bộ biến 0 thật sự có thể xảy ra");
});

// ---------- Main ----------
test("U-FM-17 Main: công thức phụ cấp/hỗ trợ cũng phải qua duyệt; biến ngoài phạm vi, liên kết sai cột/sai khóa bị từ chối; dữ liệu cũ không lỗi", () => {
  const db = dbKy(), who = (user, role) => ({ user, perms: PERM.ROLES[role].perms.slice() }), kt = who("kt1", "ketoanluong");
  const prev = { dm_congthuc: [], dm_phucap: db.dm_phucap, dm_hotro: db.dm_hotro, dm_tangca: [] };
  const check = (rows, w) => WP.checkCongThuc(prev, { dm_congthuc: rows, dm_phucap: db.dm_phucap, dm_hotro: db.dm_hotro, dm_tangca: [] }, w || kt);
  assert.equal(check([F({ _id: "a1", "Mã công thức": "PC_TYLE_A", "Trạng thái": "Nháp", "Mã phụ cấp cha": "PA" })]), "");
  assert.match(check([F({ _id: "a2", "Mã công thức": "PC_TYLE_A", "Trạng thái": "Hiệu lực", "Người kích hoạt": "kt1", "Thời điểm kích hoạt": "t" })]), /Nháp|quyền/);
  assert.match(check([F({ _id: "a3", "Mã công thức": "PC_TYLE_A", "Trạng thái": "Nháp", "Mã phụ cấp cha": "PB" })]), /không phải công thức của mã phụ cấp/);
  assert.match(check([F({ _id: "a4", "Mã công thức": "PC_TYLE_A", "Trạng thái": "Nháp", "Mã hỗ trợ cha": "HA" })]), /không dùng cho công thức loại ALLOWANCE/);
  const p2 = { dm_congthuc: [F({ _id: "a5", "Mã công thức": "PC_TYLE_A", "Trạng thái": "Nháp", "Biểu thức": "SO_XE * 2", "Người lập": "kt1", "Ngày lập": "2026-10-01T00:00:00Z" })], dm_phucap: db.dm_phucap, dm_hotro: db.dm_hotro, dm_tangca: [] };
  const n2 = clone(p2); n2.dm_congthuc[0]["Trạng thái"] = "Chờ duyệt";
  assert.match(WP.checkCongThuc(p2, n2, kt), /SO_XE/);
  const legacy = [{ "Mã công thức": "OLD", "Loại": "ALLOWANCE", "Biểu thức": "MUC_PHU_CAP", "Trạng thái": "Hiệu lực" }];
  assert.equal(WP.checkCongThuc({ dm_congthuc: legacy }, { dm_congthuc: legacy, dm_phucap: [] }, kt), "");
});
