// Bảo vệ IPC ở tiến trình chính (GĐ6): (1) chỉ nhận lệnh từ trang giao diện của chính app (file://…/index.html), không từ trang/khung lạ;
// (2) lệnh nhạy cảm (chứng từ, Full Backup, PDF, OCR) chỉ chạy khi đã đăng nhập và vai trò có quyền tương ứng.
// Danh sách quyền do giao diện báo sau đăng nhập — chống dùng nhầm / gọi trước đăng nhập / trang lạ; KHÔNG chống được mã độc đã chạy
// trong chính cửa sổ app (giới hạn đã ghi trong docs/AUDIT_V5.md). Dữ liệu vẫn chưa mã hóa trên đĩa.
"use strict";
const path = require("path"), url = require("url");
const KNOWN = ["hr.view", "hr.edit", "input.view", "input.edit", "dm.edit", "formula.approve", "payroll.view", "payroll.calc", "payroll.close", "payroll.reopen", "report.view", "import", "export", "retro.edit", "ocr.library", "backup.restore", "system.admin"];

function createGuard(appDir) {
  const indexPath = path.resolve(appDir, "index.html");
  let perms = [];
  function senderUrl(e) { try { return (e && e.senderFrame && e.senderFrame.url) || (e && e.sender && e.sender.getURL && e.sender.getURL()) || ""; } catch (x) { return ""; } }
  /** Chỉ chấp nhận đúng trang index.html của app (bỏ qua #hash/?query). */
  function trustedUrl(u) {
    if (typeof u !== "string" || !/^file:/i.test(u)) return false;
    try { return path.resolve(url.fileURLToPath(u.split("#")[0].split("?")[0])) === indexPath; } catch (x) { return false; }
  }
  const trusted = (e) => trustedUrl(senderUrl(e));
  /** Giao diện báo quyền của người đang đăng nhập (mảng rỗng khi đăng xuất). */
  function setSession(e, list) {
    if (!trusted(e)) return { ok: false, error: "Nguồn lệnh không hợp lệ" };
    perms = Array.isArray(list) ? list.filter((p) => typeof p === "string" && KNOWN.indexOf(p) >= 0) : [];
    return { ok: true, n: perms.length };
  }
  /** → "" nếu được phép, ngược lại thông báo lỗi tiếng Việt. */
  function deny(e, perm) {
    if (!trusted(e)) return "Nguồn lệnh không hợp lệ";
    if (!perms.length) return "Chưa đăng nhập";
    if (perm && perms.indexOf(perm) < 0) return "Bạn không có quyền thực hiện thao tác này";
    return "";
  }
  return { trustedUrl, trusted, setSession, deny, perms: () => perms.slice() };
}
module.exports = { createGuard, KNOWN };
