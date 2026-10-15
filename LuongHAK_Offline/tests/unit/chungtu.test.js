// Q-20 (chủ sở hữu duyệt 11/10/2026): Số chứng từ cho thưởng / trừ / tạm ứng — chống cộng trùng khi nhập lại
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const IMP = require("../../core/importer.js");
const INT = require("../../core/integrity.js");
const R = require("../../core/repository.js");
const E = require("../../engine.js");
const HR = require("../../hr.js");
const F = require("../fixtures/build.js");

const UCOLS = ["Ngày hạch toán", "Số chứng từ", "Mã NV", "Diễn giải", "Tạm ứng"];
const PCOLS = ["Ngày hạch toán", "Số chứng từ", "Mã NV", "Diễn giải", "Thưởng", "Thu nhập khác", "Trừ khác"];
function mkDb() {
  const db = F.baseDb(); db.auditlog = [];
  db.nhanvien.push({ "Mã NV": "NV001", "Họ và tên": "A", "Trạng thái": "Đang làm việc" }, { "Mã NV": "NV002", "Họ và tên": "B", "Trạng thái": "Đang làm việc" });
  return db;
}
const imp = (db, t, cols, rows) => { const p = IMP.plan(db, t, cols, rows); IMP.apply(db, p); return p; };
const tamUng = (db, ma) => db.ungluong.filter((u) => u["Mã NV"] === ma && /^2026-09/.test(u["Ngày hạch toán"])).reduce((a, u) => a + E.money(u["Tạm ứng"]), 0);

test("U-CT-01 nhập lại file tạm ứng ĐÃ SỬA số tiền (cùng Số chứng từ) → cập nhật, KHÔNG cộng thành 2 khoản", () => {
  const db = mkDb();
  imp(db, "ungluong", UCOLS, [{ "Ngày hạch toán": "2026-09-05", "Số chứng từ": "PC-01", "Mã NV": "NV001", "Tạm ứng": "1000000" }, { "Ngày hạch toán": "2026-09-05", "Số chứng từ": "PC-01", "Mã NV": "NV002", "Tạm ứng": "500000" }]);
  const p2 = imp(db, "ungluong", UCOLS, [{ "Ngày hạch toán": "2026-09-05", "Số chứng từ": "PC-01", "Mã NV": "NV001", "Tạm ứng": "1200000" }]);
  assert.equal(p2.summary.update, 1); assert.equal(p2.summary.add, 0);
  assert.equal(tamUng(db, "NV001"), 1200000); assert.equal(tamUng(db, "NV002"), 500000, "1 phiếu chi cho nhiều người: mỗi người 1 dòng");
  const p3 = imp(db, "ungluong", UCOLS, [{ "Ngày hạch toán": "2026-09-05", "Số chứng từ": "PC-01", "Mã NV": "NV001", "Tạm ứng": "1200000" }]);
  assert.equal(p3.summary.duplicate, 1); assert.equal(db.ungluong.length, 2);
  // bảng lương dùng đúng số đã sửa
  db.hopdong.push({ "Mã NV": "NV001", "Số HĐLĐ": "H1", "Ngày vào làm": "2025-01-01" });
  db.chitiethd.push({ "Mã NV": "NV001", "Số HĐLĐ": "H1", "Hiệu lực từ": "2025-01-01", "Mã lương": "CĐ", "Lương thỏa thuận": "10000000", "Mức đóng bảo hiểm": "BH00", "Thuế TNCN": "MT00" });
  const sp = HR.staffForPayroll(db, 2026, 9), kq = E.tinhBangLuong(Object.assign({}, db, { nhansu: sp.list }), 2026, 9, false);
  assert.equal(kq.bangluong.find((b) => b["Mã NV"] === "NV001")["Tạm ứng"], 1200000);
});

test("U-CT-02 không có Số chứng từ → như cũ (dòng giống hệt bỏ qua) + cảnh báo nên ghi số chứng từ; trùng số chứng từ trong 1 file → xung đột", () => {
  const db = mkDb();
  const p = IMP.plan(db, "psluong", PCOLS, [{ "Ngày hạch toán": "2026-09-28", "Mã NV": "NV001", "Thưởng": "500000" }]);
  assert.equal(p.items[0].action, "add"); assert.match(p.items[0].warn, /Chưa có Số chứng từ/);
  IMP.apply(db, p);
  assert.equal(IMP.plan(db, "psluong", PCOLS, [{ "Ngày hạch toán": "2026-09-28", "Mã NV": "NV001", "Thưởng": "500000" }]).summary.duplicate, 1);
  const pc = IMP.plan(db, "psluong", PCOLS, [{ "Ngày hạch toán": "2026-09-28", "Số chứng từ": "QĐ-9", "Mã NV": "NV002", "Thưởng": "1" }, { "Ngày hạch toán": "2026-09-28", "Số chứng từ": "QĐ-9", "Mã NV": "NV002", "Thưởng": "2" }]);
  assert.deepEqual(pc.items.map((i) => i.action), ["conflict", "conflict"]);
  assert.equal(IMP.keyOf("psluong", { "Mã NV": "NV001" }), null);
});

test("U-CT-03 Kiểm tra dữ liệu: cùng Số chứng từ + NV nhiều dòng → Medium (chỉ cảnh báo, không chặn chốt kỳ: 1 UNC theo bảng kê); giống hệt không có số → Medium; không tự xóa", () => {
  const db = mkDb();
  db.ungluong.push({ "Ngày hạch toán": "2026-09-05", "Số chứng từ": "PC-7", "Mã NV": "NV001", "Tạm ứng": "1000000" }, { "Ngày hạch toán": "2026-09-06", "Số chứng từ": "PC-7", "Mã NV": "NV001", "Tạm ứng": "1000000" });
  db.psluong.push({ "Ngày hạch toán": "2026-09-28", "Mã NV": "NV002", "Thưởng": "300000" }, { "Ngày hạch toán": "2026-09-28", "Mã NV": "NV002", "Thưởng": "300000" });
  const snap = JSON.stringify(db), w = INT.check(db);
  assert.equal(JSON.stringify(db), snap);
  assert.ok(w.some((x) => x.level === "Medium" && x.area === "ungluong" && /PC-7 · NV001/.test(x.msg)), JSON.stringify(w));
  assert.ok(w.some((x) => x.level === "Medium" && x.area === "psluong" && /chưa có Số chứng từ/.test(x.msg)));
});

test("U-CT-04 lưới (repository checkDup): thêm dòng trùng Số chứng từ + NV bị chặn; chưa có số chứng từ thì không chặn", () => {
  const db = mkDb(); db.ungluong.push({ "Ngày hạch toán": "2026-09-05", "Số chứng từ": "PC-1", "Mã NV": "NV001", "Tạm ứng": "1" });
  const repo = R.createRepo({ db: () => db, can: () => true, audit: () => {}, uid: () => "x" });
  assert.equal(repo.plan("insert", "ungluong", null, { "Ngày hạch toán": "2026-09-09", "Số chứng từ": "PC-1", "Mã NV": "NV001", "Tạm ứng": "2" }, { checkDup: true }).code, "dup");
  assert.equal(repo.plan("insert", "ungluong", null, { "Ngày hạch toán": "2026-09-09", "Số chứng từ": "PC-1", "Mã NV": "NV002", "Tạm ứng": "2" }, { checkDup: true }).ok, true);
  assert.equal(repo.plan("insert", "ungluong", null, { "Ngày hạch toán": "2026-09-09", "Mã NV": "NV001", "Tạm ứng": "2" }, { checkDup: true }).ok, true);
});
