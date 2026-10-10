// Tầng repository (2.0 PR3): mọi kiểm tra chạy TRƯỚC khi sửa dữ liệu; bị chặn → dữ liệu giữ nguyên từng byte
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../../core/repository.js");
const HR = require("../../hr.js");
const E = require("../../engine.js");
const CLS = require("../../core/payroll-close.js");
const P = require("../../core/permissions.js");
const F = require("../fixtures/build.js");

// NV001: HĐ1 (phụ lục 2025, đã dùng cho kỳ 8, 9 đã chốt) + HĐ2 vào làm 20/09/2026, phụ lục từ 10/2026 (chưa dùng)
function closedDb() {
  const db = F.baseDb();
  ["quyenloiphep", "nghiphep", "nghiom", "khamsk", "khenthuong", "noiquy", "tailieu", "auditlog"].forEach((k) => { db[k] = []; });
  db.nhanvien.push({ "Mã NV": "NV001", "Họ và tên": "A", "Trạng thái": "Đang làm việc" });
  db.hopdong.push({ "Mã NV": "NV001", "Số HĐLĐ": "HD1", "Ngày vào làm": "2025-01-01" });
  db.chitiethd.push({ "Mã NV": "NV001", "Số HĐLĐ": "HD1", "Hiệu lực từ": "2025-01-01", "Mã lương": "CĐ", "Lương thỏa thuận": "10000000", "Mức đóng bảo hiểm": "BH00", "Thuế TNCN": "MT00" });
  db.chamcong.push(F.ccRow("NV001", 2026, 8), F.ccRow("NV001", 2026, 9));
  for (const [y, m] of [[2026, 8], [2026, 9]]) {
    const s = HR.staffForPayroll(db, y, m), kq = E.tinhBangLuong(Object.assign({}, db, { nhansu: s.list }), y, m, {});
    CLS.close(db, CLS.buildSnapshot(db, y + "-" + String(m).padStart(2, "0"), kq, s.list, { user: "kt" }));
  }
  db.hopdong.push({ "Mã NV": "NV001", "Số HĐLĐ": "HD2", "Ngày vào làm": "2026-09-20" });
  db.chitiethd.push({ "Mã NV": "NV001", "Số HĐLĐ": "HD2", "Hiệu lực từ": "2026-10-01", "Mã lương": "CĐ", "Lương thỏa thuận": "13000000" });
  db.nghiphep.push({ "Mã NV": "NV001", "Số HĐLĐ": "HD2", "Từ ngày": "2026-10-05", "Số ngày nghỉ": 1 });
  return db;
}
function repoFor(db, role) {
  const user = { tenDangNhap: role, vaiTro: role };
  let n = 0;
  return R.createRepo({ db: () => db, can: (p) => P.can(user, p), audit: (a, d) => db.auditlog.push({ thaoTac: a, chiTiet: d }), uid: () => "id" + (++n), hdChildren: HR.HD_TABS });
}

test("U-REPO-01 danh sách bảng con hợp đồng của repository = hr.js HD_TABS; quyền theo bảng", () => {
  assert.deepEqual(R.HD_CHILD_DEFAULT, HR.HD_TABS);
  assert.equal(R.permFor("chamcong"), "input.edit"); assert.equal(R.permFor("dm_luong"), "dm.edit"); assert.equal(R.permFor("chitiethd"), "hr.edit"); assert.equal(R.permFor("congty"), "system.admin");
});

test("U-REPO-02 (A3-01) đổi Số HĐLĐ hồi tố: người không có quyền bị chặn → hợp đồng VÀ phụ lục/bảng con giữ nguyên; Admin: cần xác nhận, ghi xong đổi theo cả bảng con", () => {
  const db = closedDb(), hd2 = db.hopdong[1], snap = JSON.stringify(db);
  const pNS = repoFor(db, "nhansu").plan("update", "hopdong", hd2, { "Số HĐLĐ": "HD2-MOI" }, { what: "sửa hợp đồng" });
  assert.equal(pNS.ok, false); assert.equal(pNS.code, "retro"); assert.match(pNS.msg, /Chỉ Admin/);
  assert.equal(JSON.stringify(db), snap, "plan bị chặn không được sửa dữ liệu");
  const ra = repoFor(db, "admin"), p = ra.plan("update", "hopdong", hd2, { "Số HĐLĐ": "HD2-MOI" }, { what: "sửa hợp đồng" });
  assert.equal(p.ok, true); assert.equal(p.retro, true); assert.match(p.confirmMsg, /ĐÃ CHỐT: 9\/2026/);
  assert.equal(JSON.stringify(db), snap, "plan được phép (chưa xác nhận) cũng không sửa gì — Hủy ở bước xác nhận = không đổi");
  const r = ra.apply(p);
  assert.equal(r.ok, true);
  assert.equal(db.chitiethd[1]["Số HĐLĐ"], "HD2-MOI"); assert.equal(db.nghiphep[0]["Số HĐLĐ"], "HD2-MOI");
  assert.equal(db.chitiethd[0]["Số HĐLĐ"], "HD1", "không đụng hợp đồng khác");
  assert.match(db.auditlog.at(-1).chiTiet, /Số HĐLĐ: HD2 → HD2-MOI.*HỒI TỐ kỳ đã chốt 9\/2026/);
});

test("U-REPO-03 Q-15: phụ lục / hợp đồng đã dùng tính lương kỳ đã chốt → khóa kể cả Admin (sửa, xóa, đổi Số HĐLĐ); phụ lục mới sửa được", () => {
  const db = closedDb(), ra = repoFor(db, "admin"), snap = JSON.stringify(db);
  assert.equal(ra.plan("update", "chitiethd", db.chitiethd[0], { "Lương thỏa thuận": "1" }).code, "frozen");
  assert.equal(ra.plan("remove", "chitiethd", db.chitiethd[0]).code, "frozen");
  assert.equal(ra.plan("update", "hopdong", db.hopdong[0], { "Số HĐLĐ": "X" }).code, "frozen");
  assert.equal(ra.plan("remove", "hopdong", db.hopdong[0]).code, "frozen");
  assert.equal(JSON.stringify(db), snap);
  assert.equal(ra.apply(ra.plan("update", "chitiethd", db.chitiethd[1], { "Lương thỏa thuận": "14000000" })).ok, true);
});

test("U-REPO-04 kỳ đã chốt: thêm / sửa / chuyển dòng vào kỳ chốt / xóa → locked (kể cả Admin); kỳ mở → ghi được, không ghi nhật ký khi chọn audit:false", () => {
  const db = closedDb(), ra = repoFor(db, "admin"), cc9 = db.chamcong[1], snap = JSON.stringify(db);
  assert.equal(ra.plan("update", "chamcong", cc9, { "01": 0.5 }).code, "locked");
  assert.equal(ra.plan("remove", "chamcong", cc9).code, "locked");
  assert.equal(ra.plan("insert", "chamcong", null, F.ccRow("NV001", 2026, 9, "TC")).code, "locked");
  const cc10 = F.ccRow("NV001", 2026, 10);
  const ins = ra.apply(ra.plan("insert", "chamcong", null, cc10), { audit: false });
  assert.equal(ins.ok, true);
  assert.equal(ra.plan("update", "chamcong", ins.row, { "Kỳ": "2026-09" }).code, "locked");
  assert.equal(db.auditlog.length, JSON.parse(snap).auditlog.length + 0);
});

test("U-REPO-05 quyền: Xem báo cáo không ghi được gì; Nhân sự không sửa chấm công; ô ngày sai bị từ chối nhưng ô CŨ sai không chặn sửa ô khác", () => {
  const db = closedDb(), rx = repoFor(db, "xembaocao"), rn = repoFor(db, "nhansu"), rk = repoFor(db, "ketoanluong");
  assert.equal(rx.plan("insert", "nhanthan", null, { "Mã NV": "NV001" }).code, "perm");
  assert.equal(rn.plan("insert", "chamcong", null, F.ccRow("NV001", 2026, 10)).code, "perm");
  assert.match(rk.plan("insert", "chamcong", null, Object.assign(F.ccRow("NV001", 2026, 11), { "31": 1 })).msg, /Ngày 31 không tồn tại/);
  const old = Object.assign(F.ccRow("NV001", 2026, 11), { "31": 1 }); db.chamcong.push(old); // dữ liệu cũ sai (tháng 11 có 30 ngày)
  assert.equal(rk.plan("update", "chamcong", old, { "02": 0.5 }).ok, true, "sửa ô khác không bị chặn bởi ô cũ sai");
  assert.equal(rk.plan("update", "chamcong", old, { "31": 2 }).code, "invalid");
});

test("U-REPO-06 trùng khóa (checkDup), dòng không còn trong dữ liệu (stale), dữ liệu đổi giữa plan và apply → không ghi", () => {
  const db = closedDb(), ra = repoFor(db, "admin");
  assert.equal(ra.plan("insert", "hopdong", null, { "Mã NV": "NV001", "Số HĐLĐ": "HD2", "Ngày vào làm": "2026-11-01" }, { checkDup: true }).code, "dup");
  assert.equal(ra.plan("update", "chitiethd", Object.assign({}, db.chitiethd[1]), { "Lương thỏa thuận": "1" }).code, "stale");
  // plan khi kỳ 10 còn mở → trong lúc hỏi xác nhận, kỳ 10 bị chốt → apply phải từ chối
  const p = ra.plan("insert", "chamcong", null, F.ccRow("NV001", 2026, 10));
  assert.equal(p.ok, true);
  db.kyluong.push({ ky: "2026-10", kq: { bangluong: [] } });
  const r = ra.apply(p); assert.equal(r.ok, false); assert.equal(r.code, "locked");
  assert.equal(db.chamcong.filter((x) => x["Kỳ"] === "2026-10").length, 0);
});

test("U-REPO-07 xóa hợp đồng chưa dùng → xóa kèm bảng con của chính hợp đồng đó; nhật ký có trước/sau", () => {
  const db = closedDb(), ra = repoFor(db, "admin");
  const r = ra.apply(ra.plan("remove", "hopdong", db.hopdong[1], null, { what: "xóa hợp đồng" }), { action: "Xóa hồ sơ" });
  assert.equal(r.ok, true);
  assert.deepEqual(db.hopdong.map((x) => x["Số HĐLĐ"]), ["HD1"]);
  assert.deepEqual(db.chitiethd.map((x) => x["Số HĐLĐ"]), ["HD1"]); assert.equal(db.nghiphep.length, 0);
  assert.equal(db.auditlog.at(-1).thaoTac, "Xóa hồ sơ"); assert.match(db.auditlog.at(-1).chiTiet, /Số HĐLĐ: HD2 → ∅/);
});

test("U-REPO-08 app.js không ghi thẳng vào bảng nghiệp vụ ngoài các ngoại lệ đã liệt kê (thêm màn hình mới phải đi qua repository)", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "../../app.js"), "utf8");
  const found = {};
  for (const m of src.matchAll(/db(\.[a-z_]+|\[[a-z]+\])\.(push|splice|pop)\(|db(\.[a-z_]+|\[[a-z]+\]) = [^=]/g)) { const k = m[0].replace(/ = .$/, " ="); found[k] = (found[k] || 0) + 1; }
  // Ngoại lệ có lý do (AUDIT_V2 §3, PR3): nhật ký; tài khoản/bảo mật (quản trị); hồ sơ công ty (system.admin);
  // trợ lý thêm nhân viên mới (chưa có kỳ chốt); xóa nhân viên (references + chỉ Admin nếu đã chốt); nạp danh mục mẫu (chỉ bảng trống);
  // tạo bảng thiếu khi mở dữ liệu; hoàn tác gộp chấm công khi lưu lỗi.
  const allowed = {
    "db.auditlog.push(": 1, "db.auditlog.splice(": 1, "db.auditlog.pop(": 3, "db.baomat =": 2, "db.nguoidung =": 1, "db.nguoidung.push(": 2, "db.congty =": 1,
    "db.nhanvien.push(": 1, "db.canhan.push(": 1, "db.hopdong.push(": 1, "db.chitiethd.push(": 1, "db.thanhtoan.push(": 1,
    "db[k] =": 3, "db.chamcong =": 1
  };
  assert.deepEqual(found, allowed);
  assert.doesNotMatch(src, /Object\.assign\(row, d\)|db\[key\]\[tgt\]\s*,\s*cand\)/, "sửa trực tiếp hồ sơ / dán phải qua REPO");
});
