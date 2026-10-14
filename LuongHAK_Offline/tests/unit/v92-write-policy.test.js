// V9.2 — tiến trình chính kiểm quyền GHI theo bảng + chặn chốt kỳ lỗi + nhận diện tệp bảng lương. Negative tests.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");
const { createPolicy, fileSig, permsFor } = require("../../main/write-policy.js");
const PG = require("../../main/payroll-gate.js");
const { baseDb, ccRow } = require("../fixtures/build.js");

function setup(extra) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wp-")), file = path.join(dir, "data.json");
  const db = baseDb();
  db.nguoidung = [{ tenDangNhap: "admin", vaiTro: "admin", hash: "h", salt: "s", iter: 1, khoa: false }, { tenDangNhap: "nl", vaiTro: "ketoanluong", hash: "h2", salt: "s2", iter: 1, khoa: false }, { tenDangNhap: "ns", vaiTro: "nhansu", hash: "h3", salt: "s3", iter: 1, khoa: false }];
  db.baomat = [{ khoiPhuc: "x" }]; db.auditlog = [{ luc: "t1", nguoi: "admin", thaoTac: "a" }]; db.kyluong = []; db.kyluong_lichsu = [];
  Object.assign(db, extra || {});
  fs.writeFileSync(file, JSON.stringify(db));
  const pol = createPolicy({ readText: () => fs.readFileSync(file, "utf8"), sigOf: fileSig(file), gate: PG });
  const save = (obj, who) => { const t = JSON.stringify(obj); const v = pol.check(t, who); if (v.ok) { fs.writeFileSync(file, t); pol.commit(); } return v; };
  return { db, save, file, pol };
}
const P = require("../../core/permissions.js");
const who = (user, role) => ({ user, perms: P.ROLES[role].perms.slice() });
const clone = (o) => JSON.parse(JSON.stringify(o));

test("U-WP-01 lần đầu (chưa có file / chưa có tài khoản) được thiết lập; có tài khoản mà chưa đăng nhập thì KHÔNG ghi được dữ liệu nghiệp vụ", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wp-")), file = path.join(dir, "data.json");
  const pol = createPolicy({ readText: () => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null), sigOf: fileSig(file) });
  assert.equal(pol.check(JSON.stringify({ nhanvien: [{ "Mã NV": "A" }], nguoidung: [] }), null).ok, true);
  const s = setup();
  const d = clone(s.db); d.chamcong = [{ "Mã NV": "A" }];
  const v = s.save(d, null); assert.equal(v.ok, false); assert.match(v.error, /chưa đăng nhập/);
});

test("U-WP-02 chưa đăng nhập chỉ được ghi dấu đăng nhập + nhật ký; đổi mật khẩu / tạo tài khoản / sửa baomat thì bị từ chối", () => {
  const s = setup();
  let d = clone(s.db); d.nguoidung[0].dangNhapLuc = "now"; d.auditlog.push({ luc: "t2", nguoi: "admin", thaoTac: "Đăng nhập" });
  assert.equal(s.save(d, null).ok, true);
  d = clone(d); d.nguoidung[0].hash = "forged"; assert.equal(s.save(d, null).ok, false, "đổi hash khi chưa đăng nhập");
  d = clone(d); d.nguoidung.push({ tenDangNhap: "evil", vaiTro: "admin", hash: "x", salt: "y", iter: 1 }); assert.equal(s.save(d, null).ok, false);
  d = clone(s.db); d.baomat = [{ khoiPhuc: "mine" }]; assert.equal(s.save(d, null).ok, false);
  // mẫu đặt lại Admin bằng mã khôi phục: đổi mật khẩu 1 Admin + đổi baomat cùng lúc
  d = clone(s.db); d.nguoidung[0].hash = "newhash"; d.baomat = [{ khoiPhuc: "new" }]; d.auditlog.push({ luc: "t3", thaoTac: "Khôi phục" });
  assert.equal(s.save(d, null).ok, true);
});

test("U-WP-03 vai trò quyết định bảng được ghi: Nhân sự không sửa danh mục thuế / chấm công; Kế toán lương không sửa người phụ thuộc", () => {
  const s = setup(); const cur = () => JSON.parse(fs.readFileSync(s.file, "utf8")); const ns = who("ns", "nhansu"), nl = who("nl", "ketoanluong");
  let d = clone(s.db); d.nhanthan = [{ "Mã NV": "A", "Họ tên nhân thân": "x" }]; assert.equal(s.save(d, ns).ok, true, "nhân sự sửa người phụ thuộc");
  d = clone(d); d.hdld_tailieu = [{ "Mã NV": "A" }]; assert.equal(s.save(d, ns).ok, true, "nhân sự đính kèm tài liệu HĐLĐ");
  d = clone(d); d.dm_tncn.push({ "Mã thuế TNCN": "ZZ" }); let v = s.save(d, ns); assert.equal(v.ok, false); assert.match(v.error, /dm_tncn/);
  d = cur(); d.chamcong = [{ "Mã NV": "A" }]; assert.equal(s.save(d, ns).ok, false, "nhân sự không có input.edit");
  d = cur(); d.dm_tncn.push({ "Mã thuế TNCN": "ZZ" }); assert.equal(s.save(d, nl).ok, true, "kế toán lương có dm.edit");
  d = cur(); d.dm_tncn.push({ "Mã thuế TNCN": "ZZ" }); d.nhanthan = [{ "Mã NV": "A" }]; assert.equal(s.save(d, nl).ok, false, "kế toán lương không có hr.edit");
  d = cur(); d.nguoidung[1].vaiTro = "admin"; assert.equal(s.save(d, nl).ok, false, "tự nâng quyền");
  d = cur(); d.congty = [{ "Tên công ty": "x" }]; assert.equal(s.save(d, ns).ok, false, "sửa công ty cần system.admin");
});

test("U-WP-04 người thường chỉ đổi được mật khẩu của chính mình", () => {
  const s = setup(); const nl = who("nl", "ketoanluong");
  let d = clone(s.db); d.nguoidung[1].hash = "mine"; d.nguoidung[1].phaiDoiMK = false; assert.equal(s.save(d, nl).ok, true);
  d = clone(d); d.nguoidung[2].hash = "other"; assert.equal(s.save(d, nl).ok, false, "đổi mật khẩu người khác");
  d = clone(s.db); d.nguoidung[1].khoa = true; assert.equal(s.save(d, nl).ok, false, "tự mở/khóa");
});

test("U-WP-05 nhật ký thao tác chỉ được thêm, không sửa/xóa", () => {
  const s = setup(); const ad = who("admin", "admin");
  let d = clone(s.db); d.auditlog.push({ luc: "t2" }); assert.equal(s.save(d, ad).ok, true);
  d = clone(d); d.auditlog[0].thaoTac = "đã sửa"; assert.equal(s.save(d, ad).ok, false, "sửa dòng cũ");
  d = clone(s.db); d.auditlog.push({ luc: "t2" }); assert.equal(s.save(d, ad).ok, true);
  d = clone(d); d.auditlog = d.auditlog.slice(1); assert.equal(s.save(d, ad).ok, false, "xóa dòng cũ");
});

test("U-WP-06 kỳ đã chốt bất biến; chốt cần payroll.close, mở chốt cần payroll.reopen", () => {
  const fake = { blockers: () => [] };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wp-")), file = path.join(dir, "data.json");
  const db = baseDb(); db.nguoidung = [{ tenDangNhap: "a", vaiTro: "admin", hash: "h", salt: "s" }]; db.kyluong = []; db.kyluong_lichsu = []; db.auditlog = [];
  fs.writeFileSync(file, JSON.stringify(db));
  const pol = createPolicy({ readText: () => fs.readFileSync(file, "utf8"), sigOf: fileSig(file), gate: fake });
  const save = (o, w) => { const t = JSON.stringify(o); const v = pol.check(t, w); if (v.ok) { fs.writeFileSync(file, t); pol.commit(); } return v; };
  const ng = who("ns", "nhansu"), kt = who("kt", "ketoanluong"), ad = who("a", "admin");
  let d = clone(db); d.kyluong = [{ ky: "2026-09", version: 1, kq: { bangluong: [] } }];
  assert.equal(save(d, ng).ok, false, "nhân sự không chốt được");
  assert.equal(save(d, kt).ok, true, "kế toán lương chốt được");
  d = clone(d); d.kyluong[0].kq.bangluong.push({ "Mã NV": "X" }); assert.equal(save(d, ad).ok, false, "sửa bản chốt (kể cả Admin)");
  d = clone(d); d.kyluong = []; d.kyluong_lichsu = [{ ky: "2026-09", moChot: {} }];
  assert.equal(save(d, kt).ok, false, "kế toán lương không có payroll.reopen");
  assert.equal(save(d, ad).ok, true, "Admin mở chốt");
});

test("U-WP-07 chốt kỳ có TAX_CONFIG_ERROR / CONG_CHUAN_ERROR bị main từ chối dù renderer báo sạch", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wp-")), file = path.join(dir, "data.json");
  const db = baseDb();
  db.nguoidung = [{ tenDangNhap: "a", vaiTro: "admin", hash: "h", salt: "s" }]; db.auditlog = [];
  db.nhanvien = [{ "Mã NV": "NV001", "Họ và tên": "A", "Trạng thái": "Đang làm việc" }];
  db.hopdong = [{ "Mã NV": "NV001", "Số HĐLĐ": "NV001/HĐ01", "Ngày vào làm": "2025-01-01", "Hình thức HĐLĐ": "Xác định thời hạn" }];
  const ct = { "Mã NV": "NV001", "Số HĐLĐ": "NV001/HĐ01", "Hiệu lực từ": "2025-01-01", "Phòng ban": "01.01", "Chức vụ": "8", "Mã lương": "CĐ", "Lương thỏa thuận": "9000000", "Mức đóng bảo hiểm": "BH00", "Thuế TNCN": "LT01", "HTTT": "Chuyển khoản" };
  db.chitiethd = [ct]; db.chamcong = [ccRow("NV001", 2026, 9)]; db.kyluong = []; db.kyluong_lichsu = [];
  fs.writeFileSync(file, JSON.stringify(db));
  const pol = createPolicy({ readText: () => fs.readFileSync(file, "utf8"), sigOf: fileSig(file), gate: PG });
  const ad = who("a", "admin"), snap = { ky: "2026-09", version: 1, quyChe: "2026", buTheoNgay: false, kq: { bangluong: [], canhbao: [] } };
  // sạch → được chốt
  let d = clone(db); d.kyluong = [snap];
  assert.equal(pol.check(JSON.stringify(d), ad).ok, true, JSON.stringify(pol.check(JSON.stringify(d), ad)));
  // mã thuế lạ → bị chặn
  d = clone(db); d.chitiethd[0]["Thuế TNCN"] = "KHONGCO"; d.kyluong = [snap];
  let v = pol.check(JSON.stringify(d), ad); assert.equal(v.ok, false); assert.match(v.error, /TAX_CONFIG_ERROR/);
  // công chuẩn sai → bị chặn
  d = clone(db); d.dm_luong.forEach((l) => { if (l["Mã lương"] === "CĐ") { l["Số ngày cơ sở"] = 30; l["Số ngày giảm trừ"] = 31; } }); d.kyluong = [snap];
  v = pol.check(JSON.stringify(d), ad); assert.equal(v.ok, false); assert.match(v.error, /CONG_CHUAN_ERROR/);
});

test("U-WP-08 nhận diện tệp bảng lương và kỳ trong tên tệp; quyền bảng", () => {
  assert.equal(PG.isPayrollFile("Bang_luong_2026-09.xlsx"), true);
  assert.equal(PG.isPayrollFile("Bảng lương T9.xlsx"), true);
  assert.equal(PG.isPayrollFile("ChamCong_2026-09.xlsx"), false);
  assert.equal(PG.isPayrollFile("Phan_bo_khoi_luong_2026-10.xlsx"), false); // phân bổ khối lượng ≠ bảng lương
  assert.equal(PG.isPayrollFile("BaoCao_San_luong_2026-10.xlsx"), false);
  assert.equal(PG.isPayrollFile("BangTinhLuongNoiBo_2026-10.xlsx"), true);
  assert.equal(PG.isPayrollFile("KyLuong_2026-10.xlsx"), true);
  assert.equal(PG.kyFromName("Bang_luong_2026-09.xlsx"), "2026-09");
  assert.equal(PG.kyFromName("PhieuLuong_09-2026.pdf"), "2026-09");
  assert.equal(PG.kyFromName("bangluong.xlsx"), null);
  assert.deepEqual(permsFor("dm_tncn"), ["dm.edit"]); assert.deepEqual(permsFor("nhanthan"), ["hr.edit"]); assert.deepEqual(permsFor("chamcong"), ["input.edit"]);
  assert.deepEqual(permsFor("hdld_tailieu"), ["hr.edit"]);
});

test("U-WP-09 khôi phục Full Backup: thay toàn bộ dữ liệu chỉ được khi main đang giữ khóa khôi phục VÀ người dùng là Admin; ngoài cửa sổ đó vẫn bị chặn", () => {
  const { db, pol } = setup({ kyluong: [{ ky: "2026-01", kq: { a: 1 } }] });
  const repl = clone(db); repl.kyluong = [{ ky: "2026-01", kq: { a: 2 } }]; repl.nhanvien = [{ "Mã NV": "ZZ" }]; // bản chốt đổi nội dung: bình thường bất biến
  const t = JSON.stringify(repl);
  assert.equal(pol.check(t, who("nl", "ketoanluong"), { restoring: true }).ok, false, "không phải Admin");
  assert.equal(pol.check(t, who("admin", "admin"), { restoring: false }).ok, false, "không trong cửa sổ khôi phục");
  assert.equal(pol.check(t, null, { restoring: true }).ok, false, "chưa đăng nhập");
  assert.equal(pol.check(t, who("admin", "admin"), { restoring: true }).ok, true);
});

test("U-WP-10 xóa dòng danh mục có mã đã dùng trong kỳ đã chốt bị main từ chối; sửa/ngừng hiệu lực và xóa mã chưa dùng thì được", () => {
  const snap = { ky: "2026-01", version: 1, kq: { bangluong: [{ "Mã NV": "A", "Mã lương": "TG1" }] } };
  const { db, save } = setup({ kyluong: [snap], dm_luong: [{ "Mã lương": "TG1", "Tên": "x" }, { "Mã lương": "CHUA_DUNG", "Tên": "y" }] });
  const admin = who("admin", "admin");
  const d1 = clone(db); d1.kyluong = [snap]; d1.dm_luong = [{ "Mã lương": "CHUA_DUNG", "Tên": "y" }];
  const r1 = save(d1, admin); assert.equal(r1.ok, false); assert.match(r1.error, /TG1.*Ngừng hiệu lực/);
  const d2 = clone(db); d2.dm_luong = [{ "Mã lương": "TG1", "Tên": "x", "Trạng thái": "Ngừng" }, { "Mã lương": "CHUA_DUNG", "Tên": "y" }];
  assert.equal(save(d2, admin).ok, true, "ngừng hiệu lực (sửa dòng) được phép");
  const d3 = clone(d2); d3.dm_luong = [d3.dm_luong[0]];
  assert.equal(save(d3, admin).ok, true, "xóa mã chưa dùng được phép");
  assert.equal(save(Object.assign(clone(d3), { dm_luong: [] }), who("nl", "ketoanluong")).ok, false, "xóa mã đã dùng (kể cả khi có quyền sửa danh mục) bị chặn");
});

test("U-WP-11 (V9.4) sổ thanh toán lương: cần quyền payment.record; dòng 'Đã thanh toán' bất biến ở tiến trình chính", () => {
  const paid = { "Số chứng từ": "UNC-202609-001", "Kỳ": "2026-09", "Mã NV": "A", "Số tiền": 100, "Trạng thái": "Đã thanh toán" };
  const wait = { "Số chứng từ": "UNC-202609-002", "Kỳ": "2026-09", "Mã NV": "B", "Số tiền": 50, "Trạng thái": "Đã lập" };
  const { db, save } = setup({ ttluong: [paid, wait] });
  assert.deepEqual(permsFor("ttluong"), ["payment.record"]);
  const kt = who("nl", "ketoanluong"), ns = who("ns", "nhansu");
  const d1 = clone(db); d1.ttluong[1]["Trạng thái"] = "Đã duyệt";
  assert.equal(save(d1, ns).ok, false, "nhân sự không có quyền");
  assert.equal(save(d1, kt).ok, true, "đổi trạng thái chưa thanh toán được");
  const d2 = clone(d1); d2.ttluong[0]["Số tiền"] = 999;
  const r = save(d2, who("admin", "admin")); assert.equal(r.ok, false); assert.match(r.error, /đã thanh toán/);
  const d3 = clone(d1); d3.ttluong = [d3.ttluong[1]];
  assert.equal(save(d3, who("admin", "admin")).ok, false, "xóa dòng đã thanh toán bị chặn");
  const d4 = clone(d1); d4.ttluong.push({ "Số chứng từ": "PC-202609-001", "Kỳ": "2026-09", "Mã NV": "C", "Số tiền": 10, "Trạng thái": "Đã lập" });
  assert.equal(save(d4, kt).ok, true, "thêm chứng từ mới được");
});

test("U-WP-12 (V9.4) tên file báo cáo lương mới đều được nhận là file bảng lương (bị chặn khi kỳ chưa chốt còn lỗi)", () => {
  for (const n of ["BangTinhLuong_2026-10.xlsx", "TongHopLuong_2026-10.xlsx", "ThanhToanLuong_2026-10.pdf", "KeChuyenKhoan_2026-10.xlsx", "ThanhToanTienMat_2026-10.xlsx", "PhieuLuong_2026-10.pdf"]) assert.equal(PG.isPayrollFile(n), true, n);
  assert.equal(PG.isPayrollFile("Phan_bo_khoi_luong_2026-10.xlsx"), false);
});
