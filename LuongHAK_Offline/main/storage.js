// ===== MAIN / STORAGE — lưu trữ file dữ liệu + sao lưu (chạy ở tiến trình chính Electron) =====
// Tách riêng khỏi main.js để kiểm thử bằng Node (không cần Electron).
// Bảo đảm (2.0 §4.4):
//  - Ghi an toàn: file tạm → fsync → rename (mất điện giữa chừng không làm hỏng file đang có); ghi xong đọc lại so SHA-256.
//  - Mỗi bản sao lưu có TÊN DUY NHẤT (thời điểm tới mili-giây + mã ngẫu nhiên, tạo với cờ loại trừ) → không bao giờ ghi đè nhau.
//  - Mỗi bản sao lưu có file kiểm tra <tên>.sha256 → phát hiện bản sao lưu bị hỏng/sửa trước khi khôi phục.
//  - Dọn bớt bản cũ theo loại nhưng KHÔNG BAO GIỜ xóa bản sao lưu tốt (đã kiểm tra) mới nhất.
//  - Lỗi đĩa (đầy, không có quyền, ghi thất bại) → trả lỗi rõ ràng, file đang có giữ nguyên, không để lại file tạm.
//  - (2.0-α13) Bản "sau-chot-<kỳ>" (tạo khi chốt kỳ) KHÔNG BAO GIỜ bị dọn.
//  - (2.0-α13) Thư mục sao lưu THỨ HAI (USB / NAS / thư mục Drive đồng bộ): mỗi bản sao lưu được chép sang, đọc lại kiểm SHA-256;
//    thư mục không truy cập được → sao lưu trên máy vẫn bình thường, lỗi được ghi lại để app nhắc người dùng.
"use strict";
const realFs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Buffer } = require("buffer");

const KEEP = { daily: 60, startup: 10, default: 20 };
const MIRROR_SUB = "TinhLuongHAK-SaoLuu"; // thư mục con tạo trong thư mục người dùng chọn
const isPermanent = (tag) => /^sau-chot/.test(tag); // bản sau chốt kỳ: giữ vĩnh viễn

function pad(n, w) { return String(n).padStart(w || 2, "0"); }
function stamp(d) { d = d || new Date(); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + "-" + pad(d.getMilliseconds(), 3); }
function today(d) { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function safeTag(t) { return String(t || "manual").replace(/[^a-z0-9-]/gi, "").slice(0, 30) || "manual"; }
function sha256(text) { return crypto.createHash("sha256").update(text, "utf8").digest("hex"); }
function isValidDataText(text) {
  try { const o = JSON.parse(text); return !!o && typeof o === "object" && !Array.isArray(o); } catch (e) { return false; }
}
function errText(e) {
  const code = e && e.code;
  if (code === "ENOSPC") return "Ổ đĩa đã đầy — không ghi được (dữ liệu đang có giữ nguyên). Hãy giải phóng dung lượng.";
  if (code === "EACCES" || code === "EPERM") return "Không có quyền ghi vào thư mục dữ liệu (" + (e.path || "") + ").";
  if (code === "EROFS") return "Ổ đĩa chỉ đọc — không ghi được.";
  return String((e && e.message) || e);
}

function createStorage(dir, opts) {
  opts = opts || {};
  const fs = opts.fs || realFs;
  const now = opts.now || (() => new Date());
  const rand = opts.rand || (() => crypto.randomBytes(3).toString("hex"));
  const dataFile = path.join(dir, "data.json");
  const backupDir = path.join(dir, "backups");
  const ensure = () => { fs.mkdirSync(dir, { recursive: true }); fs.mkdirSync(backupDir, { recursive: true }); };
  const exists = (f) => { try { fs.statSync(f); return true; } catch (e) { return false; } };
  const settingsFile = path.join(dir, "settings.json"); // cấu hình RIÊNG của máy này (không nằm trong data.json)
  function readSettings() { try { const o = JSON.parse(fs.readFileSync(settingsFile, "utf8")); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } }
  function writeSettings(o) { ensure(); writeAtomic(settingsFile, JSON.stringify(o, null, 1), false); }

  function fsyncDir(d) { let fd; try { fd = fs.openSync(d, "r"); fs.fsyncSync(fd); } catch (e) { /* Windows không mở được thư mục — bỏ qua */ } finally { if (fd !== undefined) try { fs.closeSync(fd); } catch (e) { /* bỏ qua */ } } }
  /** Ghi nguyên tử: file tạm (tên riêng) → fsync → rename. exclusive=true: không bao giờ đè file đích đã có. */
  function writeAtomic(file, text, exclusive) {
    const tmp = file + "." + rand() + ".tmp";
    let fd = null;
    try {
      fd = fs.openSync(tmp, "wx");
      if (Buffer.isBuffer(text)) { let off = 0; while (off < text.length) off += fs.writeSync(fd, text, off, text.length - off); }
      else fs.writeSync(fd, text, 0, "utf8");
      fs.fsyncSync(fd); fs.closeSync(fd); fd = null;
      if (exclusive && exists(file)) { const e = new Error("Tên file đã tồn tại: " + path.basename(file)); e.code = "EEXIST"; throw e; }
      fs.renameSync(tmp, file);
      fsyncDir(path.dirname(file));
    } catch (e) {
      if (fd !== null) try { fs.closeSync(fd); } catch (x) { /* bỏ qua */ }
      try { fs.unlinkSync(tmp); } catch (x) { /* bỏ qua */ }
      throw e;
    }
  }
  function readSidecar(name) {
    try { return JSON.parse(fs.readFileSync(path.join(backupDir, name + ".sha256"), "utf8")); } catch (e) { return null; }
  }
  /** Trạng thái 1 bản sao lưu: ok (khớp SHA-256) · mismatch (bị hỏng/sửa) · unverified (bản cũ chưa có file kiểm tra) · invalid (không đọc được). */
  function verifyBackup(name) {
    let text;
    try { text = fs.readFileSync(path.join(backupDir, name), "utf8"); } catch (e) { return { status: "invalid", error: errText(e) }; }
    if (!isValidDataText(text)) return { status: "invalid", error: "Không phải dữ liệu JSON hợp lệ" };
    const sc = readSidecar(name);
    if (!sc || !sc.sha256) return { status: "unverified", text };
    return sc.sha256 === sha256(text) ? { status: "ok", text } : { status: "mismatch", error: "Nội dung không khớp mã kiểm tra SHA-256 (bản sao lưu bị hỏng hoặc bị sửa)" };
  }
  // Thời điểm tạo lấy từ TÊN file (không tin mtime — sao chép file làm đổi mtime)
  function createdOf(name, st) {
    let m = name.match(/_(\d{8})-(\d{6})(?:-(\d{3}))?/);
    if (m) return m[1].slice(0, 4) + "-" + m[1].slice(4, 6) + "-" + m[1].slice(6) + "T" + m[2].slice(0, 2) + ":" + m[2].slice(2, 4) + ":" + m[2].slice(4) + "." + (m[3] || "000");
    m = name.match(/_(\d{4}-\d{2}-\d{2})\.json$/);
    if (m) return m[1] + "T00:00:00.000";
    return st.mtime.toISOString();
  }
  function list(opt) {
    if (!exists(backupDir)) return [];
    return fs.readdirSync(backupDir).filter((f) => /\.json$/.test(f)).map((f) => {
      const st = fs.statSync(path.join(backupDir, f));
      const m = f.match(/^([a-z0-9-]+?)_/i);
      const o = { name: f, tag: m ? m[1] : "", size: st.size, mtime: st.mtime.toISOString(), created: createdOf(f, st) };
      if (opt && opt.verify) o.status = verifyBackup(f).status;
      return o;
    }).sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : (a.name < b.name ? 1 : -1)));
  }
  function removeBackup(name) {
    try { fs.unlinkSync(path.join(backupDir, name)); } catch (e) { /* bỏ qua */ }
    try { fs.unlinkSync(path.join(backupDir, name + ".sha256")); } catch (e) { /* bỏ qua */ }
  }
  function prune(tag) {
    if (isPermanent(tag)) return;
    const keep = KEEP[tag] || KEEP.default;
    const all = list();
    const victims = all.filter((f) => f.tag === tag).slice(keep);
    if (!victims.length) return;
    // Bản sao lưu tốt (đã kiểm tra) mới nhất của toàn bộ thư mục: không bao giờ bị xóa
    let lastGood = null;
    for (let i = 0; i < all.length && !lastGood; i++) if (verifyBackup(all[i].name).status === "ok") lastGood = all[i];
    victims.forEach((f) => { if (!lastGood || f.name !== lastGood.name) removeBackup(f.name); });
  }
  /** Ghi 1 bản sao lưu với tên duy nhất + file kiểm tra SHA-256. */
  function writeBackup(tag, text, fixedName) {
    ensure();
    let file = fixedName, tries = 0;
    for (;;) {
      if (!fixedName) file = tag + "_" + stamp(now()) + "_" + rand() + ".json";
      try { writeAtomic(path.join(backupDir, file), text, true); break; }
      catch (e) { if (e.code === "EEXIST" && !fixedName && ++tries < 5) continue; throw e; }
    }
    let sv = null; try { sv = JSON.parse(text).schemaVersion || null; } catch (e) { /* đã kiểm tra hợp lệ ở trên */ }
    writeAtomic(path.join(backupDir, file + ".sha256"), JSON.stringify({ sha256: sha256(text), size: Buffer.byteLength(text, "utf8"), created: now().toISOString(), tag: tag, schemaVersion: sv }), false);
    return file;
  }
  /** Sao lưu file dữ liệu HIỆN TẠI (trạng thái trước thay đổi). Chỉ sao lưu khi file hiện tại hợp lệ. Trả tên file hoặc null. */
  function backup(tag, name) {
    if (!exists(dataFile)) return null;
    const text = fs.readFileSync(dataFile, "utf8");
    if (!isValidDataText(text)) return null; // không sao lưu file hỏng đè lên bản tốt
    tag = safeTag(tag);
    const file = writeBackup(tag, text, name);
    prune(tag);
    mirrorOne(file, tag);
    return file;
  }

  // ---------- Thư mục sao lưu thứ hai ----------
  function mirrorRoot() { const st = readSettings(); return st.mirrorDir ? path.join(st.mirrorDir, MIRROR_SUB) : null; }
  function noteMirror(ok, msg) {
    const st = readSettings();
    if (ok) { st.lastMirrorOk = now().toISOString(); st.lastMirrorError = ""; st.lastExternal = st.lastMirrorOk; }
    else st.lastMirrorError = now().toISOString() + " · " + msg;
    try { writeSettings(st); } catch (e) { /* không ghi được cấu hình: không ảnh hưởng dữ liệu */ }
  }
  /** Chép 1 bản sao lưu (+ file kiểm tra) sang thư mục thứ hai, đọc lại so SHA-256. Không bao giờ ném lỗi ra ngoài. */
  function mirrorOne(file, tag) {
    const st = readSettings(); if (!st.mirrorDir) return { ok: false, skipped: true };
    try {
      if (!exists(st.mirrorDir)) throw new Error("Không truy cập được thư mục " + st.mirrorDir + " (USB chưa cắm / ổ mạng mất kết nối?)");
      const root = path.join(st.mirrorDir, MIRROR_SUB); fs.mkdirSync(root, { recursive: true });
      const text = fs.readFileSync(path.join(backupDir, file), "utf8"), sc = fs.readFileSync(path.join(backupDir, file + ".sha256"), "utf8");
      if (!exists(path.join(root, file))) writeAtomic(path.join(root, file), text, true);
      writeAtomic(path.join(root, file + ".sha256"), sc, false);
      const want = JSON.parse(sc).sha256;
      if (sha256(fs.readFileSync(path.join(root, file), "utf8")) !== want) throw new Error("Bản chép sang thư mục thứ hai không khớp mã kiểm tra — kiểm tra lại USB / ổ đĩa");
      pruneMirror(root, tag || "");
      noteMirror(true);
      return { ok: true };
    } catch (e) { noteMirror(false, errText(e)); return { ok: false, error: errText(e) }; }
  }
  function pruneMirror(root, tag) {
    if (!tag || isPermanent(tag)) return;
    const keep = KEEP[tag] || KEEP.default;
    const mine = fs.readdirSync(root).filter((f) => /\.json$/.test(f) && f.indexOf(tag + "_") === 0).sort().reverse(); // tên chứa thời điểm → mới nhất trước
    mine.slice(keep).forEach((f) => { try { fs.unlinkSync(path.join(root, f)); } catch (e) { /* bỏ qua */ } try { fs.unlinkSync(path.join(root, f + ".sha256")); } catch (e) { /* bỏ qua */ } });
  }
  /** Đặt / bỏ thư mục thứ hai. Đặt xong chép ngay bản mới nhất + mọi bản sau chốt kỳ còn thiếu. */
  function setMirror(dirPath) {
    const st = readSettings();
    if (!dirPath) { delete st.mirrorDir; st.lastMirrorError = ""; writeSettings(st); return { ok: true }; }
    if (!exists(dirPath)) return { ok: false, error: "Thư mục không tồn tại" };
    if (path.resolve(dirPath).indexOf(path.resolve(dir)) === 0) return { ok: false, error: "Hãy chọn thư mục ở ổ khác / USB / Drive — không chọn bên trong thư mục dữ liệu của app" };
    st.mirrorDir = dirPath; writeSettings(st);
    return syncMirror();
  }
  function syncMirror() {
    if (!mirrorRoot()) return { ok: false, error: "Chưa chọn thư mục sao lưu thứ hai" };
    const all = list(), pick = all.filter((b) => isPermanent(b.tag));
    if (all[0] && pick.indexOf(all[0]) < 0) pick.unshift(all[0]);
    let n = 0, err = "";
    pick.forEach((b) => { const r = mirrorOne(b.name, b.tag); if (r.ok) n++; else err = r.error; });
    if (!pick.length) { const f = backup("manual"); if (f) n++; }
    return err ? { ok: false, error: err, copied: n } : { ok: true, copied: n };
  }
  /** Ghi nhận người dùng đã "Sao lưu ra file" (tải file về để cất USB / Drive). */
  function noteExternal() { const st = readSettings(); st.lastExternal = now().toISOString(); try { writeSettings(st); } catch (e) { /* bỏ qua */ } }
  function backupStatus() {
    const st = readSettings(), last = st.lastExternal ? new Date(st.lastExternal) : null;
    return { mirrorDir: st.mirrorDir || "", lastMirrorOk: st.lastMirrorOk || "", lastMirrorError: st.lastMirrorError || "", lastExternal: st.lastExternal || "",
      daysSinceExternal: last ? Math.floor((now() - last) / 864e5) : null, permanent: list().filter((b) => isPermanent(b.tag)).length };
  }
  function cleanupTmp() {
    [dir, backupDir].forEach((d) => {
      if (!exists(d)) return;
      fs.readdirSync(d).filter((f) => /\.tmp$/.test(f)).forEach((f) => { try { fs.unlinkSync(path.join(d, f)); } catch (e) { /* bỏ qua */ } });
    });
  }
  function load() {
    try { cleanupTmp(); } catch (e) { /* file tạm sót lại do mất điện — không ảnh hưởng dữ liệu */ }
    if (!exists(dataFile)) return { ok: true, text: null };
    let text;
    try { text = fs.readFileSync(dataFile, "utf8"); } catch (e) { return { ok: false, error: "Không đọc được file dữ liệu: " + errText(e), backups: list() }; }
    if (!text.trim()) return { ok: false, error: "File dữ liệu rỗng", backups: list() };
    if (!isValidDataText(text)) return { ok: false, error: "File dữ liệu bị hỏng (không phải JSON hợp lệ)", backups: list() };
    return { ok: true, text: text };
  }
  /** Ghi dữ liệu. Trả true hoặc chuỗi lỗi. File đang có KHÔNG bị ảnh hưởng nếu ghi thất bại. */
  function save(text) {
    try {
      if (typeof text !== "string" || !isValidDataText(text)) return "Dữ liệu cần lưu không hợp lệ — đã hủy ghi để bảo vệ file hiện tại";
      ensure();
      const buf = Buffer.from(text, "utf8"); // mã hóa 1 lần: dùng cho cỡ file, ghi, và so sánh khi đọc lại
      if (exists(dataFile)) {
        // Bản sao lưu ĐẦU NGÀY: giữ trạng thái trước mọi thay đổi trong ngày, không bị ghi đè trong ngày
        const daily = "daily_" + today(now()) + ".json";
        if (!exists(path.join(backupDir, daily))) backup("daily", daily);
        // Dữ liệu giảm đột ngột > 50% (xóa nhầm hàng loạt) → sao lưu bản trước đó
        const oldSize = fs.statSync(dataFile).size;
        if (oldSize > 2048 && buf.length < oldSize * 0.5) backup("truoc-giam-du-lieu");
      }
      writeAtomic(dataFile, buf, false);
      // Đọc lại để chắc chắn đĩa đã ghi đúng: so sánh TỪNG BYTE với dữ liệu vừa ghi (chặt như so SHA-256, nhanh hơn ~5 lần — PERF-02)
      if (!Buffer.from(fs.readFileSync(dataFile)).equals(buf)) return "Ghi file xong nhưng đọc lại không khớp — hãy kiểm tra ổ đĩa và sao lưu ra file ngay";
      return true;
    } catch (e) { return errText(e); }
  }
  function validName(name) { return /^[a-z0-9_.-]+\.json$/i.test(String(name)) && String(name).indexOf("..") < 0; }
  function readBackup(name) {
    if (!validName(name)) return { ok: false, error: "Tên file không hợp lệ" };
    if (!exists(path.join(backupDir, name))) return { ok: false, error: "Không tìm thấy bản sao lưu" };
    const v = verifyBackup(name);
    if (v.status === "ok" || v.status === "unverified") return { ok: true, text: v.text, status: v.status };
    return { ok: false, error: "Bản sao lưu bị hỏng: " + v.error, status: v.status };
  }
  /** Kiểm tra toàn bộ bản sao lưu (có khôi phục được không). */
  function verifyAll() { return list().map((b) => { const v = verifyBackup(b.name); return Object.assign(b, { status: v.status, error: v.error || "" }); }); }
  /** Khi file chính hỏng: cất file hỏng sang tên riêng (không xóa, không đè file hỏng cất trước đó). */
  function quarantineCorrupt() {
    if (!exists(dataFile)) return null;
    ensure();
    let f;
    do { f = "data.corrupt_" + stamp(now()) + "_" + rand() + ".json.bak"; } while (exists(path.join(dir, f)));
    fs.renameSync(dataFile, path.join(dir, f));
    return f;
  }
  return { dataFile, backupDir, load, save, backup, list, readBackup, verifyBackup, verifyAll, quarantineCorrupt, info: () => ({ dataFile, backupDir }),
    setMirror, syncMirror, noteExternal, backupStatus };
}

module.exports = { createStorage, isValidDataText, sha256 };
