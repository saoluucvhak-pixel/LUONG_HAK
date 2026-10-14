// V10.2 — Quản lý công thức tăng ca Master–Detail: liên kết cha–con, migration, chồng hiệu lực, kiểm tra tại Main,
// công thức mặc định TC1–TC6 bất biến, kiểm thử trên dữ liệu thật. Dữ liệu giả lập (tests/fixtures).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const RP = require("../../core/repository.js");
const PERM = require("../../core/permissions.js");
const FAP = require("../../core/payroll/formula-approval.js");
const FML = require("../../core/payroll/formula-engine.js");
const OM = require("../../core/payroll/overtime-master.js");
const TPL = require("../../core/payroll/formula-templates.js");
const E = require("../../engine.js");
const WP = require("../../main/write-policy.js");
const HRM = require("../../hr.js");
const { baseDb, ccRow, staff, regressionDataset } = require("../fixtures/build.js");

const clone = (o) => JSON.parse(JSON.stringify(o));
function repoFor(db, vaiTro, name) {
  const me = { vaiTro, tenDangNhap: name || "u1" }; let n = 0, t = 0;
  const repo = RP.createRepo({ db: () => db, can: (p) => PERM.can(me, p), audit: () => {}, uid: () => "id" + (++n), user: () => me.tenDangNhap, now: () => "2026-10-14T10:00:0" + (t++ % 10) + "Z" });
  return { me, repo, run(op, tbl, target, vals) { const p = repo.plan(op, tbl, target, vals, {}); return p.ok ? repo.apply(p) : p; } };
}
function dbOT() {
  const db = baseDb(); db.dm_congthuc = []; db.auditlog = [];
  db.dm_tangca = [
    { _id: "t1", "Mã tăng ca": "TC1", "Nội dung tăng ca": "Tăng ca 1", "Hệ số tăng ca": "1.5", "Hiệu lực từ": "2020-01-01" },
    { _id: "t7", "Mã tăng ca": "TC7", "Nội dung tăng ca": "Tăng ca 7", "Hệ số tăng ca": "2", "Loại công thức": "TC1", "Hiệu lực từ": "2020-01-01" },
    { _id: "t9", "Mã tăng ca": "TC9", "Nội dung tăng ca": "Tăng ca 9", "Hệ số tăng ca": "3", "Hiệu lực từ": "2020-01-01" },
    { _id: "t9b", "Mã tăng ca": "TC9", "Nội dung tăng ca": "Tăng ca 9 (2026)", "Hệ số tăng ca": "3.5", "Hiệu lực từ": "2026-01-01" }
  ];
  return db;
}
const F = (o) => Object.assign({ "Loại": "OVERTIME", "Trạng thái": "Hiệu lực", "Biểu thức": "CONG_TC * HE_SO_TC", "Phiên bản": 1, "Hiệu lực từ": "2025-01-01" }, o);

// ---------- 1. cha – con ----------
test("U-OT-01 cùng Mã tăng ca nhiều dòng = phiên bản của MỘT cha (không phải cha trùng); mã dùng chung công thức không bị gán nhầm", () => {
  const db = dbOT();
  assert.deepEqual(OM.parentCodes(db), ["TC1", "TC7", "TC9"]);
  assert.equal(OM.parentRows(db, "TC9").length, 2);
  db.dm_congthuc = [F({ _id: "c1", "Mã công thức": "TC1" }), F({ _id: "c9", "Mã công thức": "TC9" })];
  assert.equal(OM.parentOf(db, db.dm_congthuc[0]).ma, "TC1", "TC1 và TC7 cùng dùng khóa TC1; TC1 là mã mang đúng tên khóa → cha");
  assert.equal(OM.formulasOf(db, "TC1").length, 1);
  assert.equal(OM.formulasOf(db, "TC7").length, 0, "TC7 chỉ dùng chung, không sở hữu công thức nào");
  assert.equal(OM.sharedWith(db, "TC7").ownerMa, "TC1");
  assert.equal(OM.formulasOf(db, "TC9").length, 1);
});
test("U-OT-02 không liên kết nhầm: công thức loại khác không đụng tới; khóa không có cha → orphan; nhiều mã dùng chung không có chủ → ambiguous", () => {
  const db = dbOT();
  db.dm_tangca.push({ _id: "ta", "Mã tăng ca": "A1", "Loại công thức": "X", "Hiệu lực từ": "2020-01-01" }, { _id: "tb", "Mã tăng ca": "B1", "Loại công thức": "X", "Hiệu lực từ": "2020-01-01" });
  db.dm_congthuc = [F({ _id: "c1", "Mã công thức": "TC1" }), F({ _id: "cx", "Mã công thức": "X" }), F({ _id: "cz", "Mã công thức": "ZZ" }), F({ _id: "cp", "Mã công thức": "TC1", "Loại": "ALLOWANCE" })];
  const p = OM.linkPlan(db);
  assert.deepEqual(p.link.map((x) => x.rec._id + ">" + x.ma), ["c1>TC1"]);
  assert.deepEqual(p.ambiguous.map((x) => x.rec._id), ["cx"]); assert.deepEqual(p.ambiguous[0].candidates.sort(), ["A1", "B1"]);
  assert.deepEqual(p.orphans.map((x) => x._id), ["cz"]);
  assert.equal(p.others, 1, "công thức phụ cấp/hỗ trợ không bị động tới");
});
test("U-OT-03 migration: chỉ thêm 2 cột liên kết, nội dung/trạng thái/phiên bản/hiệu lực/lịch sử giữ nguyên; hoàn tác theo đợt về đúng bản gốc", () => {
  const db = dbOT();
  db.dm_congthuc = [F({ _id: "c1", "Mã công thức": "TC1", "Người lập": "a", "Người duyệt": "b", "Thời điểm duyệt": "2025-01-02T00:00:00Z" }), F({ _id: "c9", "Mã công thức": "TC9", "Trạng thái": "Nháp", "Phiên bản": 3 })];
  const before = clone(db.dm_congthuc);
  const adm = repoFor(db, "admin", "admin");
  const ops = OM.linkOps(OM.linkPlan(db), "LK-T1");
  ops.forEach((o) => assert.ok(adm.run("update", "dm_congthuc", o.rec, o.values).ok));
  assert.deepEqual(OM.integrityDiff(before, db.dm_congthuc), []);
  assert.equal(db.dm_congthuc[0]["Mã tăng ca cha"], "TC1"); assert.equal(db.dm_congthuc[1]["Mã tăng ca cha"], "TC9");
  assert.deepEqual(OM.batches(db), [{ id: "LK-T1", soDong: 2 }]);
  OM.rollbackOps(db, "LK-T1").forEach((o) => assert.ok(adm.run("update", "dm_congthuc", o.rec, o.values).ok));
  // hoàn tác để lại hai cột rỗng — so với bản gốc không còn khác biệt nội dung
  assert.deepEqual(OM.integrityDiff(before, db.dm_congthuc), []);
  assert.equal(OM.linkPlan(db).link.length, 2, "sau hoàn tác lại ở trạng thái chưa liên kết");
});
test("U-OT-04 gán liên kết cho công thức đang Hiệu lực chồng kỳ đã chốt KHÔNG bị coi là hồi tố (không đổi cách tính), người có dm.edit làm được", () => {
  const db = dbOT(); db.dm_congthuc = [F({ _id: "c1", "Mã công thức": "TC1", "Hiệu lực từ": "2026-01-01" })];
  db.kyluong = [{ ky: "2026-09", version: 1, kq: { bangluong: [] } }];
  const kt = repoFor(db, "ketoanluong", "kt1");
  const r = kt.run("update", "dm_congthuc", db.dm_congthuc[0], { "Mã tăng ca cha": "TC1", "Liên kết lúc": "LK-X" });
  assert.ok(r.ok, r.msg);
  const r2 = kt.run("update", "dm_congthuc", db.dm_congthuc[0], { "Biểu thức": "CONG_TC" });
  assert.equal(r2.code, "formula-frozen", "đổi biểu thức bản Hiệu lực vẫn bị khóa");
});
test("U-OT-05 quy tắc liên kết: đã gán thì người thường không đổi; Nháp phải khớp khóa công thức; cha không tồn tại bị chặn", () => {
  const db = dbOT(); db.dm_congthuc = [F({ _id: "c1", "Mã công thức": "TC1", "Mã tăng ca cha": "TC1" }), F({ _id: "d1", "Mã công thức": "TC9", "Trạng thái": "Nháp" })];
  const kt = repoFor(db, "ketoanluong", "kt1");
  assert.equal(kt.run("update", "dm_congthuc", db.dm_congthuc[0], { "Mã tăng ca cha": "TC9" }).code, "formula-link");
  assert.equal(kt.run("update", "dm_congthuc", db.dm_congthuc[1], { "Mã tăng ca cha": "TC1" }).code, "formula-link", "TC1 dùng khóa TC1, không phải khóa TC9");
  assert.equal(kt.run("update", "dm_congthuc", db.dm_congthuc[1], { "Mã tăng ca cha": "KHONGCO" }).code, "formula-link");
  assert.ok(kt.run("update", "dm_congthuc", db.dm_congthuc[1], { "Mã tăng ca cha": "TC9" }).ok);
  const adm = repoFor(db, "admin", "admin");
  assert.ok(adm.run("update", "dm_congthuc", db.dm_congthuc[0], { "Mã tăng ca cha": "", "Liên kết lúc": "" }).ok, "Admin xóa/hoàn tác liên kết được");
});

// ---------- 2. chồng khoảng hiệu lực ----------
test("U-OT-06 kích hoạt bản mới chồng bản cũ không có Hiệu lực đến bị chặn; kế hoạch đóng ngày bản cũ = ngày trước ngày hiệu lực của bản mới", () => {
  const db = dbOT();
  const cu = F({ _id: "c1", "Mã công thức": "TC9", "Hiệu lực từ": "2025-01-01", "Mã tăng ca cha": "TC9" });
  const moi = F({ _id: "c2", "Mã công thức": "TC9", "Trạng thái": "Đã duyệt", "Phiên bản": 2, "Hiệu lực từ": "2026-11-01", "Mã tăng ca cha": "TC9" });
  db.dm_congthuc = [cu, moi];
  const adm = repoFor(db, "admin", "admin");
  assert.equal(adm.run("update", "dm_congthuc", moi, { "Trạng thái": "Hiệu lực" }).code, "formula-overlap");
  const pl = FAP.activationPlan(db, moi);
  assert.equal(pl.close.length, 1); assert.equal(pl.close[0].den, "2026-10-31"); assert.equal(pl.blocked.length, 0);
  assert.ok(adm.run("update", "dm_congthuc", cu, { "Hiệu lực đến": pl.close[0].den }).ok);
  assert.ok(adm.run("update", "dm_congthuc", moi, { "Trạng thái": "Hiệu lực" }).ok);
  assert.equal(FAP.overlapWith(db, moi).length, 0);
  // kỳ trước ngày chuyển vẫn dùng bản cũ, từ ngày chuyển dùng bản mới
  assert.equal(FML.resolveEx(db.dm_congthuc, { code: "TC9", type: "OVERTIME", nam: 2026, thang: 10 }).rec._id, "c1");
  assert.equal(FML.resolveEx(db.dm_congthuc, { code: "TC9", type: "OVERTIME", nam: 2026, thang: 11 }).rec._id, "c2");
});
test("U-OT-07 bản mới bắt đầu TRƯỚC hoặc cùng ngày bản đang hiệu lực: không tự đóng được (blocked) và không kích hoạt được", () => {
  const db = dbOT();
  const cu = F({ _id: "c1", "Mã công thức": "TC9", "Hiệu lực từ": "2026-06-01" });
  const moi = F({ _id: "c2", "Mã công thức": "TC9", "Trạng thái": "Đã duyệt", "Phiên bản": 2, "Hiệu lực từ": "2026-03-01", "Hiệu lực đến": "" });
  db.dm_congthuc = [cu, moi];
  assert.equal(FAP.activationPlan(db, moi).blocked.length, 1);
  assert.equal(repoFor(db, "admin", "admin").run("update", "dm_congthuc", moi, { "Trạng thái": "Hiệu lực" }).code, "formula-overlap");
});
test("U-OT-08 hai khoảng không giao nhau (bản cũ có Hiệu lực đến) kích hoạt được; khác công ty không tính chồng", () => {
  const db = dbOT();
  db.dm_congthuc = [F({ _id: "c1", "Mã công thức": "TC9", "Hiệu lực từ": "2025-01-01", "Hiệu lực đến": "2026-10-31" }), F({ _id: "c3", "Mã công thức": "TC9", "Công ty": "CTY KHAC", "Hiệu lực từ": "2025-01-01" }),
    F({ _id: "c2", "Mã công thức": "TC9", "Trạng thái": "Đã duyệt", "Phiên bản": 2, "Hiệu lực từ": "2026-11-01" })];
  assert.ok(repoFor(db, "admin", "admin").run("update", "dm_congthuc", db.dm_congthuc[2], { "Trạng thái": "Hiệu lực" }).ok);
});

// ---------- 3. công thức mặc định TC1–TC6 bất biến + mẫu ----------
test("U-OT-09 TC1–TC6 trong formula-defaults.js giữ NGUYÊN biểu thức (khóa chuỗi); mẫu TC1–TC3 tương đương; mẫu 'TC6' của wizard KHÔNG tương đương và được gắn nhãn tham khảo", () => {
  const D = FML.defaults.OVERTIME;
  assert.equal(D.TC1.bieuThuc, "MAX(0, CONG_TINH_LUONG - CONG_LE - CONG_TRUNG_CHUYEN - CONG_PHEP - CONG_TC - CONG_CHUAN) * HE_SO_TC + CONG_TC * HE_SO_TC");
  assert.equal(D.TC2.bieuThuc, "MAX(0, CONG_TINH_LUONG - CONG_LE - CONG_TRUNG_CHUYEN - CONG_PHEP - CONG_TC - CONG_DI_CHUYEN - IF(CONG_CHUAN_2 > 0, CONG_CHUAN_2, CONG_CHUAN)) * HE_SO_TC + CONG_TC * HE_SO_TC");
  assert.equal(D.TC3.bieuThuc, "(CONG_TC + CONG_CHU_NHAT) * HE_SO_TC");
  assert.equal(D.TC4.bieuThuc, "CONG_TC * HE_SO_TC"); assert.equal(D.TC5.bieuThuc, "CONG_TC * HE_SO_TC");
  assert.equal(D.TC6.bieuThuc, "MAX(0, CONG_TINH_LUONG - CONG_TRUNG_CHUYEN - CONG_LE - CONG_CHUAN)");
  TPL.TEMPLATES.filter((x) => x.tuongDuong).forEach((x) => assert.equal(OM.compareTemplateToDefault(x, x.tuongDuong, 400).equivalent, true, x.ten));
  const tc6 = TPL.TEMPLATES.filter((x) => x.thamKhao === "TC6")[0];
  assert.ok(tc6 && /THAM KHẢO/.test(tc6.ten), "mẫu phải ghi rõ là tham khảo");
  const cmp = OM.compareTemplateToDefault(tc6, "TC6", 400);
  assert.equal(cmp.equivalent, false, "mẫu wizard trừ CONG_TC và không trừ CONG_TRUNG_CHUYEN nên khác TC6 thật");
  assert.ok(cmp.soCaKhac > 0);
});
test("U-OT-10 engine: không có cấu hình thì TC1–TC6 tính như cũ; thêm liên kết cha KHÔNG đổi một đồng nào (so sánh 80 NV × 3 kỳ trước/sau)", () => {
  const ds = regressionDataset(80), runAll = (db) => [[2026, 8], [2026, 9], [2026, 10]].map(([y, m]) => E.tinhBangLuong(Object.assign({}, db, { nhansu: HRM.staffForPayroll(db, y, m).list }), y, m, "to", { quyChe: "2026" }).bangluong.map((r) => [r["Mã NV"], r["Tiền tăng ca"], r["Thực lĩnh"]]));
  ds.dm_congthuc = [F({ _id: "k1", "Mã công thức": "TC4", "Biểu thức": "CONG_TC * HE_SO_TC" }), F({ _id: "k2", "Mã công thức": "TC3", "Biểu thức": "(CONG_TC + CONG_CHU_NHAT) * HE_SO_TC" })];
  const truoc = runAll(ds), daLienKet = clone(ds);
  OM.linkOps(OM.linkPlan(daLienKet), "LK-R").forEach((o) => Object.assign(o.rec, o.values));
  assert.ok(daLienKet.dm_congthuc.every((r) => r["Mã tăng ca cha"] === undefined || r["Mã tăng ca cha"]));
  assert.deepEqual(runAll(daLienKet), truoc);
  const co = truoc.flat().filter((x) => x[1] > 0).length; assert.ok(co > 20, "bộ dữ liệu phải có nhiều khoản tăng ca để phép so sánh có ý nghĩa: " + co);
});

// ---------- 4. kiểm tra tại Main ----------
function mainSetup() {
  const prev = { dm_congthuc: [F({ _id: "c1", "Mã công thức": "TC9", "Trạng thái": "Nháp", "Người lập": "kt1", "Ngày lập": "2026-10-01T00:00:00Z", "Hiệu lực từ": "2026-11-01", "Mã tăng ca cha": "TC9" })], dm_tangca: dbOT().dm_tangca };
  const who = (user, role) => ({ user, perms: PERM.ROLES[role].perms.slice() });
  return { prev, who, check: (next, w) => WP.checkCongThuc(prev, Object.assign({ dm_tangca: prev.dm_tangca }, next), w) };
}
test("U-OT-11 Main: kế toán (chỉ dm.edit) tự đặt 'Hiệu lực'/'Đã duyệt' qua dữ liệu gửi thẳng bị từ chối; Nháp → Chờ duyệt được", () => {
  const m = mainSetup(), up = (p) => ({ dm_congthuc: [Object.assign({}, m.prev.dm_congthuc[0], p)] });
  assert.match(m.check(up({ "Trạng thái": "Hiệu lực", "Người kích hoạt": "kt1", "Thời điểm kích hoạt": "t" }), m.who("kt1", "ketoanluong")), /Không chuyển trực tiếp|quyền/);
  assert.match(m.check(up({ "Trạng thái": "Chờ duyệt" }).dm_congthuc && up({ "Trạng thái": "Đã duyệt", "Người duyệt": "kt1", "Thời điểm duyệt": "t" }), m.who("kt1", "ketoanluong")), /Không chuyển trực tiếp|quyền|khác người lập/);
  assert.equal(m.check(up({ "Trạng thái": "Chờ duyệt" }), m.who("kt1", "ketoanluong")), "");
});
test("U-OT-12 Main: duyệt hợp lệ phải do người khác người lập, đóng dấu đúng người đang đăng nhập; giả mạo người duyệt/sửa dấu thời gian bị từ chối", () => {
  const m = mainSetup(); m.prev.dm_congthuc[0]["Trạng thái"] = "Chờ duyệt";
  const up = (p) => ({ dm_congthuc: [Object.assign({}, m.prev.dm_congthuc[0], p)] });
  assert.equal(m.check(up({ "Trạng thái": "Đã duyệt", "Người duyệt": "sep1", "Thời điểm duyệt": "2026-10-14T01:00:00Z" }), m.who("sep1", "pheduyet")), "");
  assert.match(m.check(up({ "Trạng thái": "Đã duyệt", "Người duyệt": "nguoi_khac", "Thời điểm duyệt": "t" }), m.who("sep1", "pheduyet")), /phải là người đang đăng nhập/);
  assert.match(m.check(up({ "Trạng thái": "Đã duyệt", "Người duyệt": "kt1", "Thời điểm duyệt": "t" }), m.who("kt1", "pheduyet")), /khác người lập/);
  assert.match(m.check(up({ "Trạng thái": "Đã duyệt", "Người duyệt": "sep1" }), m.who("sep1", "pheduyet")), /thiếu Thời điểm duyệt/);
  assert.match(m.check(up({ "Trạng thái": "Đã duyệt", "Người duyệt": "sep1", "Thời điểm duyệt": "t", "Người lập": "ai_do" }), m.who("sep1", "pheduyet")), /không được sửa trực tiếp 'Người lập'/);
});
test("U-OT-13 Main: sửa nội dung bản đã duyệt/hiệu lực, xóa bản đã gửi duyệt, kích hoạt chồng hiệu lực đều bị từ chối; bảng không đổi thì không kiểm", () => {
  const m = mainSetup(), who = m.who("admin", "admin");
  m.prev.dm_congthuc[0]["Trạng thái"] = "Hiệu lực";
  assert.match(m.check({ dm_congthuc: [Object.assign({}, m.prev.dm_congthuc[0], { "Biểu thức": "CONG_TC * 99" })] }, who), /không được sửa nội dung/);
  assert.match(m.check({ dm_congthuc: [] }, who), /Không xóa/);
  m.prev.dm_congthuc.push(F({ _id: "c2", "Mã công thức": "TC9", "Trạng thái": "Đã duyệt", "Phiên bản": 2, "Hiệu lực từ": "2026-12-01", "Người lập": "kt1", "Người duyệt": "x", "Thời điểm duyệt": "t" }));
  const after = m.prev.dm_congthuc.map((r) => (r._id === "c2" ? Object.assign({}, r, { "Trạng thái": "Hiệu lực", "Người kích hoạt": "admin", "Thời điểm kích hoạt": "t" }) : r));
  assert.match(m.check({ dm_congthuc: after }, who), /chồng/);
  assert.equal(m.check({ dm_congthuc: m.prev.dm_congthuc }, who), "");
});
test("U-OT-14 Main: tạo mới 'Hiệu lực' trực tiếp (không qua duyệt) bị từ chối với kế toán; liên kết sai khóa bị từ chối; dữ liệu cũ chưa có _id không làm lỗi", () => {
  const m = mainSetup(), kt = m.who("kt1", "ketoanluong");
  const nr = F({ _id: "n1", "Mã công thức": "TC9", "Trạng thái": "Hiệu lực", "Hiệu lực từ": "2030-01-01", "Người kích hoạt": "kt1", "Thời điểm kích hoạt": "t" });
  assert.match(m.check({ dm_congthuc: m.prev.dm_congthuc.concat([nr]) }, kt), /Nháp|quyền/);
  const bad = F({ _id: "n2", "Mã công thức": "TC9", "Trạng thái": "Nháp", "Mã tăng ca cha": "TC1" });
  assert.match(m.check({ dm_congthuc: m.prev.dm_congthuc.concat([bad]) }, kt), /không phải công thức của mã tăng ca/);
  const legacy = [{ "Mã công thức": "OLD", "Loại": "OVERTIME", "Biểu thức": "CONG_TC", "Trạng thái": "Hiệu lực" }];
  assert.equal(WP.checkCongThuc({ dm_congthuc: legacy }, { dm_congthuc: legacy, dm_tangca: [] }, kt), "");
});

// ---------- 5. dữ liệu thật: biến tự động, Chủ nhật, nhánh TC5/CN, so sánh ----------
function dbKy() {
  const db = baseDb(); db.dm_congthuc = [];
  db.dm_tangca = [{ "Mã tăng ca": "TC3", "Hệ số tăng ca": "1.5", "Hiệu lực từ": "2020-01-01" }, { "Mã tăng ca": "TC5", "Hệ số tăng ca": "2", "Tiền tăng ca (nếu tính cố định)": "260000", "Hiệu lực từ": "2020-01-01" },
    { "Mã tăng ca": "TC4", "Hệ số tăng ca": "2", "Hiệu lực từ": "2020-01-01" }];
  const nv = (ma, luong, tc, extra) => staff(Object.assign({ "Mã nhân viên": ma, "Họ và tên": "Người " + ma, "Mã tiền lương 1": luong, "Mã tăng ca": tc, "Lương thỏa thuận": "7800000" }, extra || {}));
  db.nhansu = [nv("A", "TG1", "TC3"), nv("B", "TG1", "TC5"), nv("C", "CN1", "TC4", { "Lương thỏa thuận": "300000" }), nv("D", "TG1", "TC3")];
  db.nhanvien = db.nhansu.map((x) => ({ "Mã NV": x["Mã nhân viên"], "Họ và tên": x["Họ và tên"] }));
  const ky = [2026, 9]; // 09/2026: 6/9 là Chủ nhật? tính bằng ccRow
  const sun = (ma) => { const r = { "Kỳ": "2026-09", "Mã NV": ma, "Hình thức công": "BT" }; for (let d = 1; d <= 30; d++) { const dw = new Date(2026, 8, d).getDay(); if (dw === 0 && (d === 6 || d === 13)) r[String(d).padStart(2, "0")] = 1; else if (dw !== 0 && d <= 24) r[String(d).padStart(2, "0")] = 1; } return r; };
  db.chamcong = [sun("A"), ccRow("A", 2026, 9, "TC", 1, 3), ccRow("B", 2026, 9, "BT", 1, 24), ccRow("B", 2026, 9, "TC", 1, 4), ccRow("C", 2026, 9, "BT", 1, 20), ccRow("C", 2026, 9, "TC", 1, 3)]; // D: không có chấm công
  return { db, ky };
}
const tinhKy = (db) => E.tinhBangLuong(Object.assign({}, db), 2026, 9, "to", { quyChe: "2026" });
test("U-OT-15 công Chủ nhật lấy tự động từ chấm công: chỉ đúng ngày Chủ nhật có công (2 ngày), không mặc định mỗi Chủ nhật 1 công", () => {
  const { db } = dbKy(), kq = tinhKy(db), a = kq.bangluong.filter((r) => r["Mã NV"] === "A")[0];
  assert.equal(a._ct.bienTC.CONG_CHU_NHAT, 2);
  const b = kq.bangluong.filter((r) => r["Mã NV"] === "B")[0];
  assert.equal(b._ct.bienTC.CONG_CHU_NHAT, 0, "B không chấm Chủ nhật → 0, không phải 4");
});
test("U-OT-16 so sánh trên dữ liệu thật: công thức hiện hành TÁI LẬP đúng tiền tăng ca của engine cho TC3, TC5 (cơ sở tiền cố định), CN1 (nhánh CN)", () => {
  const { db } = dbKy(), kq = tinhKy(db);
  [["A", "THUONG", "(CONG_TC + CONG_CHU_NHAT) * HE_SO_TC"], ["B", "TC5", "CONG_TC * HE_SO_TC"], ["C", "CN_2026", "CONG_TC * HE_SO_TC"]].forEach(([ma, nhanh, expr]) => {
    const b = kq.bangluong.filter((r) => r["Mã NV"] === ma)[0], t = OM.trial(b, expr, expr, { coChamCong: true });
    assert.equal(t.nhanh, nhanh, ma); assert.equal(t.selfCheck.ok, true, ma + " " + JSON.stringify(t.selfCheck)); assert.equal(t.chenh, 0, ma);
    assert.ok(b["Tiền tăng ca"] > 0, ma);
  });
  const b = kq.bangluong.filter((r) => r["Mã NV"] === "B")[0];
  assert.equal(OM.trial(b, "CONG_TC", "CONG_TC * HE_SO_TC").coSo, 260000 / b["Công chuẩn"], "TC5: cơ sở = Tiền tăng ca cố định ÷ công chuẩn");
});
test("U-OT-17 phiên bản thử: chênh lệch = Math.round(cơ sở × công quy đổi mới) − tiền hiện tại; biểu thức lỗi không sinh số; thiếu dữ liệu hiển thị 'Chưa có dữ liệu'", () => {
  const { db } = dbKy(), kq = tinhKy(db), a = kq.bangluong.filter((r) => r["Mã NV"] === "A")[0];
  const t = OM.trial(a, "CONG_TC * HE_SO_TC", "(CONG_TC + CONG_CHU_NHAT) * HE_SO_TC", { coChamCong: true });
  assert.equal(t.chenh, Math.round(t.coSo * a._ct.bienTC.CONG_TC * a._ct.bienTC.HE_SO_TC) - a["Tiền tăng ca"]);
  assert.ok(t.chenh < 0, "bỏ công Chủ nhật → tiền giảm");
  const loi = OM.trial(a, "CONG_TC / 0", "CONG_TC", { coChamCong: true }); assert.equal(loi.ok, false); assert.match(loi.reason, /0|Chia/i); assert.equal(loi.chenh, null);
  const d = kq.bangluong.filter((r) => r["Mã NV"] === "D")[0]; // D có mã tăng ca nhưng không có chấm công
  assert.equal(OM.coChamCong(db, "D", "2026-09"), false);
  const td = OM.trial(d, "CONG_TC", "CONG_TC", { coChamCong: false });
  if (td.rows.length) assert.ok(td.rows.slice(0, 3).every((r) => r.cu === "Chưa có dữ liệu" && r.moi === "Chưa có dữ liệu"), "không hiện số 0 giả");
  else assert.match(td.reason, /Chưa có dữ liệu/);
  assert.match(OM.trial(null, "CONG_TC", "").reason, /Chưa có dữ liệu/);
});
test("U-OT-18 ca kiểm thử đã lưu chạy lại được với phiên bản mới (hồi quy); bộ biến lấy nguyên từ engine", () => {
  const { db } = dbKy(), kq = tinhKy(db), a = kq.bangluong.filter((r) => r["Mã NV"] === "A")[0], v = a._ct.bienTC;
  const caNhu = [{ ten: "A 09/2026", bien: v, kyVong: (v.CONG_TC + v.CONG_CHU_NHAT) * v.HE_SO_TC }];
  assert.equal(OM.runSaved(caNhu, "(CONG_TC + CONG_CHU_NHAT) * HE_SO_TC")[0].ok, true);
  assert.equal(OM.runSaved(caNhu, "CONG_TC * HE_SO_TC")[0].ok, false);
  assert.match(OM.runSaved(caNhu, "CONG_TC / 0")[0].loi, /0|Chia/i);
});

// ---------- 6. kiểm tra thông tin & trước kích hoạt ----------
test("U-OT-19 kiểm tra thông tin mã tăng ca: bắt lỗi bắt buộc/định dạng/chồng phiên bản; hệ số trống chỉ cảnh báo (không tự đặt 150%)", () => {
  const db = dbOT(), ctx = { pct: E.pct, isoDate: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "") };
  const ok = OM.validateInfo(db, { ma: "TC20", ten: "X", heSo: "", tien: "", loaiCT: "", tu: "2026-01-01", den: "" }, ctx);
  assert.deepEqual(ok.errors, []); assert.ok(ok.warnings.some((w) => /KHÔNG tự đặt hệ số mặc định/.test(w)));
  assert.ok(OM.validateInfo(db, { ma: "TC 20", ten: "", heSo: "-1", tien: "abc", tu: "", den: "" }, ctx).errors.length >= 4);
  const chong = OM.validateInfo(db, { ma: "TC9", ten: "X", heSo: "1", tu: "2026-03-01", den: "" }, ctx);
  assert.ok(chong.errors.some((e) => /chồng/.test(e)));
  assert.ok(OM.validateInfo(db, { ma: "TC1", ten: "X", heSo: "1", tu: "2019-01-01", den: "2019-12-31" }, ctx).errors.length === 0, "khoảng không giao nhau thì hợp lệ");
});
test("U-OT-20 kiểm tra trước kích hoạt: biểu thức chia 0 bị chặn; công ty khác bị chặn; chồng hiệu lực bị chặn; kỳ đã chốt chỉ cảnh báo", () => {
  const db = dbOT(); db.dm_congthuc = [];
  const rec = F({ "Mã công thức": "TC9", "Trạng thái": "Đã duyệt", "Biểu thức": "CONG_TC / CONG_LE", "Hiệu lực từ": "2026-05-01" });
  const items = OM.preActivation(db, rec, { companyKeys: ["HAK"], closedPeriods: ["2026-06"], hasCurrent: true });
  const by = (id) => items.filter((x) => x.id === id)[0];
  assert.equal(by("div0").ok, false); assert.equal(by("syntax").ok, true);
  assert.equal(by("closed").level, "warn"); assert.equal(by("closed").ok, true);
  assert.equal(OM.preActivation(db, Object.assign({}, rec, { "Công ty": "CTY LẠ", "Biểu thức": "CONG_TC" }), { companyKeys: ["HAK"] }).filter((x) => x.id === "company")[0].ok, false);
  assert.equal(OM.preActivation(db, Object.assign({}, rec, { "Biểu thức": "KHONG_CO_BIEN" }), {})[0].ok, false);
  db.dm_congthuc = [F({ _id: "o", "Mã công thức": "TC9", "Hiệu lực từ": "2026-07-01" })];
  assert.equal(OM.preActivation(db, Object.assign({}, rec, { "Biểu thức": "CONG_TC", "Hiệu lực từ": "2026-05-01" }), {}).filter((x) => x.id === "overlap")[0].ok, false);
});
test("U-OT-21 diễn giải/chip: thay mã biến bằng tên tiếng Việt, chip ↔ biểu thức quay vòng đúng; thư viện biến lấy từ formula-variables", () => {
  const e = "IF(CONG_TC > 0, CONG_TC * HE_SO_TC, 0)";
  assert.equal(OM.joinTokens(OM.chips(e)), e);
  const ex = OM.explain(e); assert.ok(ex.ok); assert.match(ex.text, /\[Công tăng ca\]/); assert.match(ex.text, /×/); assert.equal(ex.vars.length, 2);
  assert.equal(OM.chips("CONG_TC $ 2"), null);
  assert.deepEqual(OM.varLibrary().map((v) => v.name), OM.OT_VARS);
  OM.varLibrary().forEach((v) => assert.equal(FML.variables.get(v.name), v, "cùng đối tượng với formula-variables.js, không phải bản sao"));
});
test("U-OT-22 bản chốt kỳ không đổi: kích hoạt công thức mới / liên kết không làm đổi snapshot kỳ đã chốt", () => {
  const { db } = dbKy(); const kq = tinhKy(db);
  db.kyluong = [{ ky: "2026-09", version: 1, kq: clone(kq) }];
  const h0 = JSON.stringify(db.kyluong);
  db.dm_congthuc = [F({ _id: "c", "Mã công thức": "TC3", "Biểu thức": "CONG_TC * 99", "Hiệu lực từ": "2026-09-01" })];
  OM.linkOps(OM.linkPlan(db), "LK-S").forEach((o) => Object.assign(o.rec, o.values));
  assert.equal(JSON.stringify(db.kyluong), h0);
});

test("U-OT-23 chuẩn hóa dữ liệu khi mở app KHÔNG cắt dấu thời gian (Ngày lập của công thức) — nếu cắt, bản ghi dấu vết bị đổi mỗi lần khởi động", () => {
  const INT = require("../../core/integrity.js");
  const db = { dm_congthuc: [{ _id: "a", "Ngày lập": "2026-10-14T06:22:36.000Z", "Hiệu lực từ": "14/10/2026" }] };
  INT.normalizeDataset(db);
  assert.equal(db.dm_congthuc[0]["Ngày lập"], "2026-10-14T06:22:36.000Z");
  assert.equal(db.dm_congthuc[0]["Hiệu lực từ"], "2026-10-14", "ngày thường vẫn được chuẩn hóa");
});
