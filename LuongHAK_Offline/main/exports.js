// Thư mục FILE XUẤT (Excel, báo cáo, phiếu lương, sao lưu ra file) — 2.0-α16.
// - Mặc định: Tài liệu\Tinh Luong HAK\File xuat (đổi được, nhớ theo máy trong settings.json — không nằm trong data.json).
// - Tải về KHÔNG hỏi nơi lưu, KHÔNG ghi đè: trùng tên thì thêm " (1)", " (2)"…
// - Giao diện chỉ gửi TÊN file; mọi đường dẫn do tiến trình chính ghép trong thư mục xuất (không mở đường dẫn tùy ý).
"use strict";
const realFs = require("fs");
const path = require("path");
// Chỉ MỞ các loại file do app xuất ra — thư mục do người dùng chọn có thể chứa .exe/.bat, không được chạy chúng từ app
const OPENABLE = [".xlsx", ".xls", ".csv", ".pdf", ".doc", ".docx", ".json", ".txt"];
const openable = (n) => OPENABLE.indexOf(path.extname(String(n)).toLowerCase()) >= 0;

function createExports(opts) {
  const fs = opts.fs || realFs;
  const getSettings = opts.readSettings, putSettings = opts.writeSettings;
  const fixedDir = opts.fixedDir || ""; // kiểm thử tự động: thư mục cố định (HAK_DOWNLOAD_DIR)
  const exists = (f) => { try { fs.statSync(f); return true; } catch (e) { return false; } };

  function dir() {
    if (fixedDir) return fixedDir;
    const d = getSettings().exportDir;
    return d && exists(d) ? d : opts.defaultDir;
  }
  function openAfter() { return getSettings().openAfterDownload !== false; } // mặc định: tải xong mở thư mục, chọn sẵn file
  function setOpenAfter(on) { const s = getSettings(); s.openAfterDownload = !!on; putSettings(s); return { ok: true, openAfterDownload: !!on }; }
  function setDir(p) {
    if (!p) { const s = getSettings(); delete s.exportDir; putSettings(s); return { ok: true, dir: dir() }; }
    if (!exists(p)) return { ok: false, error: "Thư mục không tồn tại" };
    const s = getSettings(); s.exportDir = path.resolve(p); putSettings(s); return { ok: true, dir: s.exportDir };
  }
  /** Tên file an toàn (bỏ ký tự Windows không cho, không cho thư mục con / "..") */
  function cleanName(name) {
    let n = path.basename(String(name || "").replace(/\\/g, "/")).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/^\.+/, "").trim();
    if (!n) n = "file";
    return n.slice(0, 180);
  }
  /** Đường dẫn lưu mới, không trùng file đã có */
  function target(name) {
    const d = dir(); fs.mkdirSync(d, { recursive: true });
    const n = cleanName(name), ext = path.extname(n), stem = n.slice(0, n.length - ext.length);
    let f = path.join(d, n), i = 1;
    while (exists(f)) f = path.join(d, stem + " (" + (i++) + ")" + ext);
    return f;
  }
  /** Tên file từ giao diện → đường dẫn thật trong thư mục xuất (null nếu không hợp lệ / không còn) */
  function resolve(name) {
    if (typeof name !== "string" || !name || name !== path.basename(name) || name === "." || name === "..") return null;
    const d = path.resolve(dir()), f = path.resolve(d, name);
    if (path.dirname(f) !== d || !openable(f) || !exists(f)) return null;
    return f;
  }
  /** File (loại app xuất ra) trong thư mục xuất, mới nhất trước */
  function list(limit) {
    const d = dir(); let names = [];
    try { names = fs.readdirSync(d); } catch (e) { return []; }
    return names.filter(openable).map((n) => { try { const st = fs.statSync(path.join(d, n)); return st.isFile() ? { name: n, size: st.size, mtime: st.mtime.toISOString() } : null; } catch (e) { return null; } })
      .filter(Boolean).sort((a, b) => (a.mtime < b.mtime ? 1 : a.mtime > b.mtime ? -1 : 0)).slice(0, limit || 100);
  }
  return { dir, setDir, openAfter, setOpenAfter, cleanName, target, resolve, list };
}

module.exports = { createExports, OPENABLE };
