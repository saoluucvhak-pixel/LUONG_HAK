// ===== CORE / PERMISSIONS — tài khoản, vai trò, quyền (2.0, Q-14/Q-16 do chủ sở hữu xác nhận 10/10/2026) =====
// Quyền được kiểm tra ở TẦNG NGHIỆP VỤ (mọi hàm ghi dữ liệu trong app.js gọi need()), giao diện chỉ ẩn bớt cho gọn.
// Mật khẩu: PBKDF2-SHA256 (210.000 vòng, muối ngẫu nhiên 16 byte) — tính ở tiến trình chính (Electron) hoặc WebCrypto (trình duyệt).
// GIỚI HẠN (ghi rõ trong tài liệu): file dữ liệu chưa mã hóa — người có quyền ghi trực tiếp vào file trên máy vẫn sửa được;
// đăng nhập chống dùng nhầm / vượt quyền trong app, không thay thế phân quyền thư mục của Windows.
(function (root) {
  "use strict";

  var PERMS = {
    "hr.view": "Xem hồ sơ nhân sự", "hr.edit": "Thêm/sửa/xóa hồ sơ nhân sự, hợp đồng, phụ lục",
    "input.view": "Xem chấm công, sản lượng, thưởng, tạm ứng", "input.edit": "Nhập/sửa/xóa chấm công, sản lượng, thưởng, tạm ứng",
    "dm.edit": "Sửa danh mục (mã lương, phụ cấp, BH, thuế…)",
    "payroll.view": "Xem bảng lương, kỳ đã chốt, báo cáo lương (thông tin lương nhạy cảm)",
    "payroll.calc": "Tính lương", "payroll.close": "Chốt kỳ lương", "payroll.reopen": "Mở chốt kỳ lương",
    "report.view": "Xem báo cáo nhân sự", "import": "Nhập Excel", "export": "Xuất Excel / in",
    "retro.edit": "Sửa dữ liệu có hiệu lực hồi tố vào kỳ đã chốt",
    "backup.restore": "Khôi phục dữ liệu từ bản sao lưu / file", "system.admin": "Quản trị người dùng, công ty, xóa toàn bộ dữ liệu"
  };
  var ALLP = Object.keys(PERMS);
  // Vai trò mặc định theo Master Prompt 2.0 §9. Q-14: chỉ Admin được sửa hồi tố.
  var ROLES = {
    admin: { ten: "Quản trị (Admin)", perms: ALLP },
    nhansu: { ten: "Nhân sự", perms: ["hr.view", "hr.edit", "report.view", "import", "export", "input.view"] },
    ketoanluong: { ten: "Kế toán lương", perms: ["hr.view", "input.view", "input.edit", "dm.edit", "payroll.view", "payroll.calc", "payroll.close", "report.view", "import", "export"] },
    ketoanthanhtoan: { ten: "Kế toán thanh toán", perms: ["payroll.view", "export", "hr.view"] },
    truongbophan: { ten: "Trưởng bộ phận", perms: ["hr.view", "input.view", "input.edit", "report.view"] },
    pheduyet: { ten: "Người phê duyệt", perms: ["hr.view", "input.view", "payroll.view", "report.view", "export"] },
    xembaocao: { ten: "Người xem báo cáo", perms: ["report.view", "payroll.view"] }
  };
  function roleOf(u) { return u && ROLES[u.vaiTro] ? ROLES[u.vaiTro] : null; }
  /** Người dùng u có quyền p không. Tài khoản bị khóa → không có quyền nào. */
  function can(u, p) { var r = roleOf(u); return !!(r && !u.khoa && r.perms.indexOf(p) >= 0); }
  /** Ném lỗi nếu không có quyền — dùng trong mọi hàm ghi dữ liệu. */
  function need(u, p, what) {
    if (!can(u, p)) { var e = new Error("Bạn không có quyền " + (what || PERMS[p] || p).toLowerCase() + (u ? " (vai trò: " + (roleOf(u) ? roleOf(u).ten : "?") + ")" : " — chưa đăng nhập")); e.code = "EPERM_APP"; throw e; }
  }

  // ---------- Tài khoản ----------
  function normName(s) { return String(s || "").trim().toLowerCase(); }
  function validatePassword(pw) {
    pw = String(pw || "");
    if (pw.length < 8) return "Mật khẩu tối thiểu 8 ký tự";
    if (!/[0-9]/.test(pw) || !/[a-zA-Z]/.test(pw)) return "Mật khẩu cần có cả chữ và số";
    return null;
  }
  function findUser(db, name) { var n = normName(name); return (db.nguoidung || []).filter(function (u) { return normName(u.tenDangNhap) === n; })[0] || null; }
  function activeAdmins(db) { return (db.nguoidung || []).filter(function (u) { return u.vaiTro === "admin" && !u.khoa; }); }
  /** Kiểm tra trước khi đổi vai trò / khóa / xóa: không được làm mất Admin cuối cùng. */
  function wouldRemoveLastAdmin(db, user, next) {
    if (user.vaiTro !== "admin" || user.khoa) return false;
    var stillAdmin = next && next.vaiTro === "admin" && !next.khoa;
    return !stillAdmin && activeAdmins(db).length <= 1;
  }
  // Chống dò mật khẩu: sau 5 lần sai liên tiếp phải chờ 30 giây (tính trong phiên chạy app)
  var fails = {};
  function lockedFor(name, now) { var f = fails[normName(name)]; if (!f || f.n < 5) return 0; var left = f.until - (now || Date.now()); return left > 0 ? left : 0; }
  function noteFail(name, now) { var k = normName(name), f = fails[k] || (fails[k] = { n: 0, until: 0 }); f.n++; if (f.n >= 5) f.until = (now || Date.now()) + 30000; }
  function noteOk(name) { delete fails[normName(name)]; }
  function resetFails() { fails = {}; }

  var api = { PERMS: PERMS, ROLES: ROLES, ITER: 210000, can: can, need: need, roleOf: roleOf, validatePassword: validatePassword, findUser: findUser,
    activeAdmins: activeAdmins, wouldRemoveLastAdmin: wouldRemoveLastAdmin, lockedFor: lockedFor, noteFail: noteFail, noteOk: noteOk, resetFails: resetFails, normName: normName };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.perm = api; }
})(typeof window !== "undefined" ? window : this);
