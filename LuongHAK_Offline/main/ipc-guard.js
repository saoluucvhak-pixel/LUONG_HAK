// Bảo vệ IPC ở tiến trình chính (GĐ6): (1) chỉ nhận lệnh từ trang giao diện của chính app (file://…/index.html), không từ trang/khung lạ;
// (2) lệnh nhạy cảm (chứng từ, Full Backup, PDF, OCR) chỉ chạy khi đã đăng nhập và vai trò có quyền tương ứng.
// Danh sách quyền do giao diện báo sau đăng nhập — chống dùng nhầm / gọi trước đăng nhập / trang lạ; KHÔNG chống được mã độc đã chạy
// trong chính cửa sổ app (giới hạn đã ghi trong docs/AUDIT_V5.md). Dữ liệu vẫn chưa mã hóa trên đĩa.
"use strict";
const path = require("path"), url = require("url");
const KNOWN = ["hr.view", "hr.edit", "hr.approve", "input.view", "input.edit", "dm.edit", "formula.approve", "payroll.view", "payment.record", "payroll.calc", "payroll.close", "payroll.reopen", "report.view", "import", "export", "retro.edit", "ocr.library", "backup.restore", "system.admin"];

/**
 * V9: TIẾN TRÌNH CHÍNH là nguồn xác định quyền cuối cùng.
 * - Phiên chỉ được tạo bằng login(tên, mật khẩu): main tự đọc tài khoản đã lưu trên đĩa, tự băm/so mật khẩu, tự tra vai trò → quyền.
 * - Renderer KHÔNG còn gửi được danh sách quyền (đã bỏ setSession(list)); chỉ nhận lại quyền để ẩn/hiện giao diện.
 * - Mỗi lần kiểm tra: tra lại tài khoản (khóa / đổi vai trò / xóa → thu hồi ngay), phiên hết hạn nếu không thao tác quá idleMs.
 * opts: { readUsers():[{tenDangNhap,vaiTro,khoa,salt,iter,hash}], rolePerms(vaiTro):string[], verify(pw,user):boolean, now(), idleMs, maxFails, lockMs }
 */
function createGuard(appDir, opts) {
  opts = opts || {};
  const indexPath = path.resolve(appDir, "index.html");
  const now = opts.now || Date.now, idleMs = opts.idleMs || 30 * 60 * 1000, maxFails = opts.maxFails || 5, lockMs = opts.lockMs || 30000;
  const sessions = new Map(), fails = new Map(); // wcId → phiên ; tên → { n, until }
  function senderUrl(e) { try { return (e && e.senderFrame && e.senderFrame.url) || (e && e.sender && e.sender.getURL && e.sender.getURL()) || ""; } catch (x) { return ""; } }
  /** Chỉ chấp nhận đúng trang index.html của app (bỏ qua #hash/?query), và đúng khung CHÍNH (không phải iframe). */
  function trustedUrl(u) {
    if (typeof u !== "string" || !/^file:/i.test(u)) return false;
    try { return path.resolve(url.fileURLToPath(u.split("#")[0].split("?")[0])) === indexPath; } catch (x) { return false; }
  }
  function mainFrame(e) { try { return !(e && e.sender && e.sender.mainFrame && e.senderFrame && e.senderFrame !== e.sender.mainFrame); } catch (x) { return false; } }
  const trusted = (e) => mainFrame(e) && trustedUrl(senderUrl(e));
  const wcId = (e) => { try { return e && e.sender && e.sender.id != null ? e.sender.id : 0; } catch (x) { return 0; } };
  const norm = (s) => String(s == null ? "" : s).trim().toLowerCase();
  function liveUser(name) { const list = (opts.readUsers && opts.readUsers()) || []; return list.filter((u) => norm(u.tenDangNhap) === norm(name))[0] || null; }
  /** Đăng nhập tại tiến trình chính. → { ok, perms, user } | { ok:false, error } */
  function login(e, name, pw) {
    if (!trusted(e)) return { ok: false, error: "Nguồn lệnh không hợp lệ" };
    if (typeof name !== "string" || typeof pw !== "string" || !name || name.length > 64 || pw.length > 256) return { ok: false, error: "Thông tin đăng nhập không hợp lệ" };
    const k = norm(name), f = fails.get(k);
    if (f && f.n >= maxFails && f.until > now()) return { ok: false, error: "Sai quá " + maxFails + " lần — chờ " + Math.ceil((f.until - now()) / 1000) + " giây" };
    const u = liveUser(name);
    const ok = !!(u && opts.verify && opts.verify(pw, u));
    if (!ok) { const g = fails.get(k) || { n: 0, until: 0 }; g.n++; if (g.n >= maxFails) g.until = now() + lockMs; fails.set(k, g); return { ok: false, error: "Sai tên đăng nhập hoặc mật khẩu" }; }
    if (u.khoa) return { ok: false, error: "Tài khoản đã bị khóa" };
    fails.delete(k);
    const perms = ((opts.rolePerms && opts.rolePerms(u.vaiTro)) || []).filter((p) => KNOWN.indexOf(p) >= 0);
    sessions.set(wcId(e), { user: u.tenDangNhap, role: u.vaiTro, at: now(), last: now(), sid: require("crypto").randomBytes(12).toString("hex") });
    return { ok: true, perms: perms.slice(), user: u.tenDangNhap, role: u.vaiTro };
  }
  function logout(e) { if (!trusted(e)) return { ok: false }; sessions.delete(wcId(e)); return { ok: true }; }
  /** Phiên còn hiệu lực + quyền HIỆN TẠI (tra lại tài khoản). null nếu không có/hết hạn/bị thu hồi. */
  function current(e) {
    const s = sessions.get(wcId(e)); if (!s) return null;
    if (now() - s.last > idleMs) { sessions.delete(wcId(e)); return null; }
    const u = liveUser(s.user);
    if (!u || u.khoa || u.vaiTro !== s.role) { sessions.delete(wcId(e)); return null; }
    return { user: s.user, role: s.role, perms: ((opts.rolePerms && opts.rolePerms(u.vaiTro)) || []).filter((p) => KNOWN.indexOf(p) >= 0), touch() { s.last = now(); } };
  }
  /** → "" nếu được phép, ngược lại thông báo lỗi tiếng Việt. */
  function deny(e, perm) {
    if (!trusted(e)) return "Nguồn lệnh không hợp lệ";
    const c = current(e);
    if (!c || !c.perms.length) return "Chưa đăng nhập hoặc phiên đã hết hạn";
    if (perm && c.perms.indexOf(perm) < 0) return "Bạn không có quyền thực hiện thao tác này";
    c.touch(); return "";
  }
  const userOf = (e) => { const c = current(e); return c ? c.user : ""; };
  return { trustedUrl, trusted, login, logout, current, deny, userOf, perms: (e) => { const c = current(e); return c ? c.perms.slice() : []; } };
}
module.exports = { createGuard, KNOWN };
