// Duyệt & phiên bản công thức (V5 GĐ2): quy trình, quyền ở tầng ghi, khóa nội dung, kỳ đã chốt.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const RP = require("../../core/repository.js");
const PERM = require("../../core/permissions.js");
const FA = require("../../core/payroll/formula-approval.js");
const E = require("../../engine.js");
const { baseDb, ccRow, staff } = require("../fixtures/build.js");

function setup(vaiTro, tenDangNhap, db) {
  db = db || baseDb(); db.dm_congthuc = db.dm_congthuc || []; db.auditlog = db.auditlog || [];
  const me = { vaiTro: vaiTro, tenDangNhap: tenDangNhap };
  let n = 0, t = 0;
  const repo = RP.createRepo({ db: () => db, can: (p) => PERM.can(me, p), audit: (a, d) => db.auditlog.push({ a, d }), uid: () => "id" + (++n),
    user: () => me.tenDangNhap, now: () => "2026-10-13T10:00:0" + (t++ % 10) + "Z" });
  const run = (op, target, values) => { const p = repo.plan(op, "dm_congthuc", target, values, {}); return p.ok ? repo.apply(p) : p; };
  return { db, me, repo, run, as(vt, name) { me.vaiTro = vt; me.tenDangNhap = name; } };
}
const NEW = { "Mã công thức": "TC7", "Loại": "OVERTIME", "Biểu thức": "CONG_TC * HE_SO_TC", "Hiệu lực từ": "2026-10-01" };

test("kế toán lương tạo công thức: ép Nháp, ghi người lập và phiên bản 1; không tự đặt 'Hiệu lực'", () => {
  const s = setup("ketoanluong", "ketoan1");
  assert.equal(s.run("insert", null, Object.assign({ "Trạng thái": "Hiệu lực" }, NEW)).code, "formula-state");
  const r = s.run("insert", null, Object.assign({ "Trạng thái": "Nháp" }, NEW));
  assert.ok(r.ok); assert.equal(r.row["Người lập"], "ketoan1"); assert.equal(r.row["Phiên bản"], 1);
});
test("quy trình đầy đủ + người duyệt khác người lập; kế toán không duyệt được", () => {
  const s = setup("ketoanluong", "ketoan1");
  const row = s.run("insert", null, NEW).row;
  assert.ok(s.run("update", row, { "Trạng thái": "Chờ duyệt" }).ok);
  assert.equal(s.run("update", row, { "Trạng thái": "Đã duyệt" }).code, "perm");          // thiếu quyền formula.approve
  s.as("pheduyet", "ketoan1");                                                              // cùng người lập
  assert.equal(s.run("update", row, { "Trạng thái": "Đã duyệt" }).code, "formula-maker");
  s.as("pheduyet", "sep1");
  assert.ok(s.run("update", row, { "Trạng thái": "Đã duyệt" }).ok); assert.equal(row["Người duyệt"], "sep1");
  assert.equal(s.run("update", row, { "Trạng thái": "Nháp" }).ok, true);                    // trả về nháp
});
test("không nhảy cóc Nháp → Hiệu lực; kích hoạt ghi người + thời điểm", () => {
  const s = setup("admin", "admin1");
  const row = s.run("insert", null, NEW).row;
  assert.equal(s.run("update", row, { "Trạng thái": "Hiệu lực" }).code, "formula-flow");
  s.run("update", row, { "Trạng thái": "Chờ duyệt" }); s.run("update", row, { "Trạng thái": "Đã duyệt" });
  const r = s.run("update", row, { "Trạng thái": "Hiệu lực" }); assert.ok(r.ok);
  assert.equal(row["Người kích hoạt"], "admin1"); assert.ok(row["Thời điểm kích hoạt"]);
});
test("khóa nội dung: chỉ Nháp được sửa biểu thức; bản đã gửi duyệt/hiệu lực phải sao chép", () => {
  const s = setup("admin", "admin1");
  const row = s.run("insert", null, NEW).row;
  assert.ok(s.run("update", row, { "Biểu thức": "CONG_TC * 2" }).ok);
  s.run("update", row, { "Trạng thái": "Chờ duyệt" });
  assert.equal(s.run("update", row, { "Biểu thức": "CONG_TC * 3" }).code, "formula-frozen");
  s.run("update", row, { "Trạng thái": "Đã duyệt" }); s.run("update", row, { "Trạng thái": "Hiệu lực" });
  assert.equal(s.run("update", row, { "Biểu thức": "CONG_TC * 3" }).code, "formula-frozen");
  assert.equal(s.run("update", row, { "Trạng thái": "Ngừng", "Biểu thức": "x" }).code, "formula-frozen");
  assert.equal(s.run("update", row, { "Người duyệt": "giả mạo" }).code, "formula-stamp");
  assert.ok(s.run("update", row, { "Mô tả": "ghi chú" }).ok);                               // mô tả luôn sửa được
  const cp = FA.copyAsDraft(row, { db: s.db }); assert.equal(cp["Trạng thái"], "Nháp"); assert.equal(cp["Phiên bản"], 2); assert.equal(cp["Người duyệt"], "");
  assert.ok(s.run("insert", null, cp).ok);
});
test("biểu thức sai không được gửi duyệt; trùng bản Hiệu lực cùng mã/ngày bị chặn khi kích hoạt; không xóa bản đã gửi duyệt", () => {
  const s = setup("admin", "a");
  const bad = s.run("insert", null, Object.assign({}, NEW, { "Biểu thức": "CONG_TC_KHONG_CO * 2" })).row;
  assert.equal(s.run("update", bad, { "Trạng thái": "Chờ duyệt" }).code, "formula-expr");
  const a = s.run("insert", null, NEW).row; ["Chờ duyệt", "Đã duyệt", "Hiệu lực"].forEach((t) => s.run("update", a, { "Trạng thái": t }));
  const b = s.run("insert", null, NEW).row; ["Chờ duyệt", "Đã duyệt"].forEach((t) => s.run("update", b, { "Trạng thái": t }));
  assert.equal(s.run("update", b, { "Trạng thái": "Hiệu lực" }).code, "formula-conflict");
  assert.equal(s.run("remove", b).code, "formula-keep");
  assert.ok(s.run("remove", bad).ok);
});
test("kỳ đã chốt: nháp/duyệt không bị coi là hồi tố; kích hoạt bản có hiệu lực từ kỳ đã chốt chỉ Admin (retro.edit)", () => {
  const db = baseDb(); db.kyluong = [{ ky: "2026-09", kq: { bangluong: [] } }];
  const s = setup("ketoanluong", "k", db);
  const row = s.run("insert", null, Object.assign({}, NEW, { "Hiệu lực từ": "2026-09-01" })).row;
  assert.ok(row, "soạn nháp trong kỳ đã chốt không bị chặn");
  assert.ok(s.run("update", row, { "Trạng thái": "Chờ duyệt" }).ok);
  s.as("pheduyet", "sep"); assert.ok(s.run("update", row, { "Trạng thái": "Đã duyệt" }).ok);
  assert.equal(s.run("update", row, { "Trạng thái": "Hiệu lực" }).code, "retro");           // người duyệt thường không có retro.edit
  s.as("admin", "admin1"); assert.ok(s.run("update", row, { "Trạng thái": "Hiệu lực" }).ok);
});
test("công thức Hiệu lực áp dụng vào bảng lương; bản Ngừng thì mã lạ báo lỗi (P2-01)", () => {
  const db = baseDb();
  db.dm_tangca.push({ "Mã tăng ca": "TC7", "Nội dung tăng ca": "x", "Hệ số tăng ca": 2, "Hiệu lực từ": "2020-01-01" });
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã tăng ca": "TC7" })];
  db.chamcong = [ccRow("NV", 2026, 9, "BT", 1, 20), ccRow("NV", 2026, 9, "TC", 1, 2)];
  const s = setup("admin", "a", db);
  const row = s.run("insert", null, Object.assign({}, NEW, { "Biểu thức": "CONG_TC * HE_SO_TC + 1", "Hiệu lực từ": "2026-01-01" })).row;
  const tc = () => E.tinhBangLuong(db, 2026, 9, false).bangluong[0]["Tiền tăng ca"];
  assert.equal(tc(), 0);                                      // nháp: chưa áp dụng, TC7 không thuộc TC1–TC6 → FORMULA_ERROR, 0đ
  ["Chờ duyệt", "Đã duyệt", "Hiệu lực"].forEach((t) => s.run("update", row, { "Trạng thái": t }));
  assert.equal(tc(), Math.round(9000000 / 26 * 5));
  s.run("update", row, { "Trạng thái": "Ngừng" }); assert.equal(tc(), 0);
  assert.ok(E.tinhBangLuong(db, 2026, 9, false).loiCongThuc.some((e) => e.maLoi === "UNKNOWN_CODE"));
});
