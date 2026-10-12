// ===== MAIN / STORAGE — lưu trữ file dữ liệu + sao lưu (chạy ở tiến trình chính Electron) =====
// Tách riêng khỏi main.js để kiểm thử bằng Node (không cần Electron).
"use strict";
const fs = require("fs");
const path = require("path");

const KEEP = { daily: 60, startup: 10, default: 20 };

function pad(n) { return String(n).padStart(2, "0"); }
function stamp(d) { d = d || new Date(); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()); }
function today(d) { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function safeTag(t) { return String(t || "manual").replace(/[^a-z0-9-]/gi, "").slice(0, 30) || "manual"; }
function isValidDataText(text) {
  try { const o = JSON.parse(text); return !!o && typeof o === "object" && !Array.isArray(o); } catch (e) { return false; }
}
function writeAtomic(file, text) {
  const tmp = file + ".tmp";
  const fd = fs.openSync(tmp, "w");
  try { fs.writeSync(fd, text, 0, "utf8"); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
}

function createStorage(dir, opts) {
  opts = opts || {};
  const now = opts.now || (() => new Date());
  const dataFile = path.join(dir, "data.json");
  const backupDir = path.join(dir, "backups");
  const ensure = () => { fs.mkdirSync(dir, { recursive: true }); fs.mkdirSync(backupDir, { recursive: true }); };

  function list() {
    if (!fs.existsSync(backupDir)) return [];
    return fs.readdirSync(backupDir).filter((f) => /\.json$/.test(f)).map((f) => {
      const st = fs.statSync(path.join(backupDir, f));
      const m = f.match(/^([a-z0-9-]+?)_/i);
      return { name: f, tag: m ? m[1] : "", size: st.size, mtime: st.mtime.toISOString() };
    }).sort((a, b) => (a.mtime < b.mtime ? 1 : a.mtime > b.mtime ? -1 : (a.name < b.name ? 1 : -1)));
  }
  function prune(tag) {
    const keep = KEEP[tag] || KEEP.default;
    const files = list().filter((f) => f.tag === tag);
    files.slice(keep).forEach((f) => { try { fs.unlinkSync(path.join(backupDir, f.name)); } catch (e) { /* bỏ qua */ } });
  }
  /** Sao lưu file dữ liệu HIỆN TẠI (trạng thái trước thay đổi). Chỉ sao lưu khi file hiện tại hợp lệ. */
  function backup(tag, name) {
    ensure();
    if (!fs.existsSync(dataFile)) return null;
    const text = fs.readFileSync(dataFile, "utf8");
    if (!isValidDataText(text)) return null; // không sao lưu file hỏng đè lên bản tốt
    tag = safeTag(tag);
    const file = name || (tag + "_" + stamp(now()) + ".json");
    fs.writeFileSync(path.join(backupDir, file), text, "utf8");
    prune(tag);
    return file;
  }
  function load() {
    if (!fs.existsSync(dataFile)) return { ok: true, text: null };
    let text;
    try { text = fs.readFileSync(dataFile, "utf8"); } catch (e) { return { ok: false, error: "Không đọc được file dữ liệu: " + e.message, backups: list() }; }
    if (!text.trim()) return { ok: false, error: "File dữ liệu rỗng", backups: list() };
    if (!isValidDataText(text)) return { ok: false, error: "File dữ liệu bị hỏng (không phải JSON hợp lệ)", backups: list() };
    return { ok: true, text: text };
  }
  /** Ghi dữ liệu. Trả true hoặc chuỗi lỗi. */
  function save(text) {
    try {
      if (typeof text !== "string" || !isValidDataText(text)) return "Dữ liệu cần lưu không hợp lệ — đã hủy ghi để bảo vệ file hiện tại";
      ensure();
      if (fs.existsSync(dataFile)) {
        // Bản sao lưu ĐẦU NGÀY: giữ trạng thái trước mọi thay đổi trong ngày, không bị ghi đè trong ngày
        const daily = "daily_" + today(now()) + ".json";
        if (!fs.existsSync(path.join(backupDir, daily))) backup("daily", daily);
        // Dữ liệu giảm đột ngột > 50% (xóa nhầm hàng loạt) → sao lưu bản trước đó
        const oldSize = fs.statSync(dataFile).size;
        if (oldSize > 2048 && text.length < oldSize * 0.5) backup("truoc-giam-du-lieu");
      }
      writeAtomic(dataFile, text);
      return true;
    } catch (e) { return String((e && e.message) || e); }
  }
  function readBackup(name) {
    if (!/^[a-z0-9_.-]+\.json$/i.test(String(name)) || String(name).indexOf("..") >= 0) return { ok: false, error: "Tên file không hợp lệ" };
    const f = path.join(backupDir, name);
    if (!fs.existsSync(f)) return { ok: false, error: "Không tìm thấy bản sao lưu" };
    const text = fs.readFileSync(f, "utf8");
    if (!isValidDataText(text)) return { ok: false, error: "Bản sao lưu bị hỏng" };
    return { ok: true, text: text };
  }
  /** Khi file chính hỏng: cất file hỏng sang chỗ khác (không xóa) để có thể khôi phục từ bản sao lưu. */
  function quarantineCorrupt() {
    if (!fs.existsSync(dataFile)) return null;
    ensure();
    const f = "data.corrupt_" + stamp(now()) + ".json.bak";
    fs.renameSync(dataFile, path.join(dir, f));
    return f;
  }
  return { dataFile, backupDir, load, save, backup, list, readBackup, quarantineCorrupt, info: () => ({ dataFile, backupDir }) };
}

module.exports = { createStorage, isValidDataText };
