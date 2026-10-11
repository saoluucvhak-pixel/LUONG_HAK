// Kiểm soát kỳ đã chốt (2.0 §4.3) + kiểm tra cấu trúc dữ liệu (2.0 §4.5)
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const GRD = require("../../core/period-guard.js");
const SCH = require("../../core/schema.js");
const CLS = require("../../core/payroll-close.js");
const HR = require("../../hr.js");
const E = require("../../engine.js");
const F = require("../fixtures/build.js");

function closedDb() {
  const db = F.baseDb();
  db.nhanvien.push({ "Mã NV": "NV001", "Họ và tên": "A", "Trạng thái": "Đang làm việc" }, { "Mã NV": "NV002", "Họ và tên": "B", "Trạng thái": "Đang làm việc" });
  db.hopdong.push({ "Mã NV": "NV001", "Số HĐLĐ": "HD1", "Ngày vào làm": "2025-01-01" });
  db.chitiethd.push({ "Mã NV": "NV001", "Số HĐLĐ": "HD1", "Hiệu lực từ": "2025-01-01", "Mã lương": "CĐ", "Lương thỏa thuận": "10000000", "Mức đóng bảo hiểm": "BH00", "Thuế TNCN": "MT00" },
    { "Mã NV": "NV001", "Số HĐLĐ": "HD1", "Hiệu lực từ": "2026-10-01", "Mã lương": "CĐ", "Lương thỏa thuận": "12000000", "Mức đóng bảo hiểm": "BH00", "Thuế TNCN": "MT00" });
  db.chamcong.push(F.ccRow("NV001", 2026, 8, "BT", 1), F.ccRow("NV001", 2026, 9, "BT", 1));
  for (const [y, m] of [[2026, 8], [2026, 9]]) {
    const staff = HR.staffForPayroll(db, y, m), kq = E.tinhBangLuong(Object.assign({}, db, { nhansu: staff.list }), y, m, {});
    CLS.close(db, CLS.buildSnapshot(db, y + "-" + String(m).padStart(2, "0"), kq, staff.list, { user: "kt@may1" }));
  }
  return db;
}

test("U-GRD-01 dữ liệu phát sinh thuộc kỳ đã chốt → locked; kỳ chưa chốt → none", () => {
  const db = closedDb();
  assert.deepEqual(GRD.impact(db, "chamcong", db.chamcong[1]), { kind: "locked", periods: ["2026-09"] });
  assert.equal(GRD.impact(db, "chamcong", F.ccRow("NV001", 2026, 10)).kind, "none");
  // chuyển dòng kỳ 10 sang kỳ 9 đã chốt cũng là locked
  assert.equal(GRD.impactChange(db, "chamcong", F.ccRow("NV001", 2026, 10), F.ccRow("NV001", 2026, 9)).kind, "locked");
});

test("U-GRD-02 phụ lục HĐ hồi tố: chỉ các kỳ đã chốt mà phụ lục còn hiệu lực (tới trước phụ lục kế tiếp)", () => {
  const db = closedDb(), pl1 = db.chitiethd[0], pl2 = db.chitiethd[1];
  assert.deepEqual(GRD.impact(db, "chitiethd", pl1), { kind: "retro", periods: ["2026-08", "2026-09"] });
  assert.equal(GRD.impact(db, "chitiethd", pl2).kind, "none"); // hiệu lực 10/2026, chưa chốt
  // dời ngày hiệu lực phụ lục mới về 15/09/2026 → chạm kỳ 9 đã chốt
  assert.deepEqual(GRD.impactChange(db, "chitiethd", pl2, Object.assign({}, pl2, { "Hiệu lực từ": "2026-09-15" })).periods, ["2026-09"]);
  // NV không có trong bảng lương đã chốt → không ảnh hưởng
  assert.equal(GRD.impact(db, "nhanthan", { "Mã NV": "NV002", "Hiệu lực từ": "2020-01-01" }).kind, "none");
});

test("U-GRD-03 danh mục có hiệu lực + nhân viên đã có trong bảng lương đã chốt → hồi tố", () => {
  const db = closedDb();
  assert.equal(GRD.impact(db, "dm_phucap", { "Mã phụ cấp": "X", "Hiệu lực từ": "2026-01-01" }).kind, "retro");
  assert.equal(GRD.impact(db, "dm_phucap", { "Mã phụ cấp": "X", "Hiệu lực từ": "2026-10-01" }).kind, "none");
  assert.deepEqual(GRD.impact(db, "nhanvien", db.nhanvien[0]).periods, ["2026-08", "2026-09"]);
  assert.equal(GRD.impact(db, "hocvan", { "Mã NV": "NV001" }).kind, "none"); // không ảnh hưởng tiền lương
});

test("U-GRD-04 tham chiếu Mã NV (chặn đổi mã đã chốt) + nhật ký trước/sau", () => {
  const db = closedDb(), refs = GRD.references(db, "NV001");
  assert.equal(refs.kyluong, 2); assert.equal(refs.chamcong, 2); assert.equal(refs.chitiethd, 2);
  assert.deepEqual(GRD.changedFields({ a: "1", b: "x", _id: 1 }, { a: "2", b: "x", c: "3", _id: 2 }), ["a: 1 → 2", "c: ∅ → 3"]);
  assert.equal(db.kyluong[0].nguoiChot, "kt@may1");
});

test("U-GRD-05 (Q-15) phụ lục đã dùng tính lương kỳ đã chốt → khóa (kể cả Admin); phụ lục mới / chưa dùng → sửa được", () => {
  const db = closedDb(), pl1 = db.chitiethd[0], pl2 = db.chitiethd[1];
  assert.deepEqual(GRD.frozenAppendix(db, pl1), ["2026-08", "2026-09"]);
  assert.deepEqual(GRD.frozenAppendix(db, pl2), []); // hiệu lực 10/2026, chưa chốt
  assert.deepEqual(GRD.frozenOfContract(db, "NV001", "HD1"), ["2026-08", "2026-09"]);
  assert.deepEqual(GRD.frozenOfContract(db, "NV002", "X"), []);
  // mở chốt kỳ 9 → phụ lục chỉ còn khóa bởi kỳ 8
  CLS.reopen(db, "2026-09", "điều chỉnh", { user: "admin" });
  assert.deepEqual(GRD.frozenAppendix(db, pl1), ["2026-08"]);
});

test("U-CLS-03 checksum phát hiện sửa cả số liệu đã chốt LẪN dữ liệu đầu vào đã chốt", () => {
  const db = closedDb(), k = db.kyluong[0];
  assert.equal(CLS.verify(k), "ok");
  const orig = k.input.data.chamcong[0]["01"];
  k.input.data.chamcong[0]["01"] = 3; assert.equal(CLS.verify(k), "modified");
  k.input.data.chamcong[0]["01"] = orig; assert.equal(CLS.verify(k), "ok");
  k.kq.bangluong[0]["Thực lĩnh"] += 1000; assert.equal(CLS.verify(k), "modified");
  const h = CLS.reopen(db, db.kyluong[1].ky, "Sửa công", { user: "kt@may2" });
  assert.equal(h.moChot.nguoi, "kt@may2"); assert.ok(h.moChot.luc); assert.equal(h.moChot.lyDo, "Sửa công");
});

test("U-SCH-01 lỗi cấu trúc nguy hiểm → fatal (không mở để tránh mất dữ liệu)", () => {
  const T = { tables: ["nhanvien", "chamcong", "chitiethd", "hopdong"] };
  assert.equal(SCH.validate([], T).ok, false);
  assert.equal(SCH.validate(null, T).ok, false);
  assert.match(SCH.validate({ nhanvien: { NV001: {} } }, T).fatal[0], /phải là danh sách/);
  assert.match(SCH.validate({ schemaVersion: 3, nhanvien: [] }, T).fatal[0], /MỚI HƠN/);
  assert.match(SCH.validate({ schemaVersion: "2" }, T).fatal[0], /schemaVersion/);
  assert.equal(SCH.validate({ schemaVersion: 2, nhanvien: [] }, T).ok, true);
});

test("U-SCH-02 lỗi dữ liệu → báo cáo đủ loại, KHÔNG sửa/xóa gì; bảng lạ giữ nguyên", () => {
  const db = closedDb();
  db.nhanvien.push({ "Họ và tên": "Không mã" }, { "Mã NV": 123, "Họ và tên": "Mã số" }, { "Mã NV": "NV009 ", "Họ và tên": "Thừa cách" });
  db.chamcong.push({ "Kỳ": "2026-13", "Mã NV": "NV404", "Hình thức công": "BT", "01": 1 }, "rác");
  db.psluong.push({ "Ngày hạch toán": "31/02/2026", "Mã NV": "NV001", "Thưởng": "abc" });
  db.chitiethd.push({ "Mã NV": "NV001", "Số HĐLĐ": "KHONG-CO", "Hiệu lực từ": "2026-01-01" });
  db.bang_tu_ban_moi = { x: 1 };
  db.kyluong[0].kq.bangluong[0]["Thực lĩnh"] = 1;
  const snapshot = JSON.stringify(db);
  const r = SCH.validate(db, { tables: Object.keys(db).filter((k) => k !== "bang_tu_ban_moi" && k !== "schemaVersion"), hrTables: ["chitiethd", "hopdong", "nhanthan"] });
  assert.equal(JSON.stringify(db), snapshot, "validate không được sửa dữ liệu");
  assert.equal(r.ok, true); // lỗi dữ liệu không phải fatal
  const txt = r.errors.map((e) => e.table + ": " + e.msg).join("\n");
  for (const re of [/thiếu Mã NV/, /Mã NV 123 lưu dạng number/, /khoảng trắng thừa/, /không phải bản ghi hợp lệ/, /kỳ sai/, /NV404/, /ngày sai/, /tiền không đọc được/, /không thuộc hợp đồng/, /checksum KHÔNG khớp/])
    assert.match(txt, re);
  assert.ok(r.info.some((m) => /bang_tu_ban_moi/.test(m)));
});
