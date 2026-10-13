// ===== MAIN / STORAGE-PATHS — 4 thư mục lưu trữ cấu hình được (V7 GĐ7) =====
// docs = chứng từ gốc · ocrLib = thư viện mẫu OCR · backup = nơi ghi Full Backup chính · mirror = sao lưu dự phòng (đã có từ trước: settings.mirrorDir)
// Chuyển dữ liệu: CHÉP → kiểm SHA-256 từng file ở đích → mới đổi cấu hình. KHÔNG BAO GIỜ xóa nguồn; lỗi bất kỳ → giữ nguyên cấu hình cũ.
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const KINDS = ["docs", "ocrLib", "backup", "mirror"], KEY = { docs: "docsDir", ocrLib: "ocrLibDir", backup: "backupDir", mirror: "mirrorDir" };
const LABEL = { docs: "Chứng từ gốc", ocrLib: "Thư viện mẫu OCR", backup: "Sao lưu chính (Full Backup)", mirror: "Sao lưu dự phòng" };
function defaults(userData, exportsDir) { return { docs: path.join(userData, "documents"), ocrLib: path.join(userData, "ocr_library"), backup: exportsDir || path.join(userData, "exports"), mirror: "" }; }
function resolve(userData, settings, exportsDir) { const d = defaults(userData, exportsDir), s = settings || {}; const o = {}; KINDS.forEach((k) => { o[k] = s[KEY[k]] ? String(s[KEY[k]]) : d[k]; }); return o; }
const sha = (f) => { const h = crypto.createHash("sha256"), fd = fs.openSync(f, "r"), b = Buffer.alloc(1 << 20); let n; try { while ((n = fs.readSync(fd, b, 0, b.length, null)) > 0) h.update(b.subarray(0, n)); } finally { fs.closeSync(fd); } return h.digest("hex"); };
function walk(dir, base, out) { fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => { const p = path.join(dir, e.name), rel = base ? base + "/" + e.name : e.name; if (e.isDirectory()) walk(p, rel, out); else if (e.isFile() && !/\.tmp\d*$/.test(e.name)) out.push({ rel, abs: p }); }); return out; }
/** realpath của phần đã tồn tại + phần còn lại chưa tạo — so sánh thư mục lồng nhau theo ĐƯỜNG DẪN THẬT (symlink / junction Windows / ổ ánh xạ không qua mặt được) */
function realOf(p) {
  let cur = path.resolve(p), rest = [];
  for (let i = 0; i < 64; i++) { try { return path.join(fs.realpathSync(cur), ...rest.reverse()); } catch (e) { const up = path.dirname(cur); if (up === cur) break; rest.push(path.basename(cur)); cur = up; } }
  return path.resolve(p);
}
const cmpKey = (p) => (process.platform === "win32" ? p.toLowerCase() : p);
const inside = (a, b) => { const r = path.relative(cmpKey(realOf(a)), cmpKey(realOf(b))); return r === "" || (!!r && !r.startsWith("..") && !path.isAbsolute(r)); };
const isLink = (p) => { try { return fs.lstatSync(p).isSymbolicLink(); } catch (e) { return false; } };
/** Kiểm tra thư mục đích hợp lệ: tuyệt đối, tạo/ghi được, không nằm trong hoặc chứa thư mục lưu trữ khác. */
function validate(kind, dir, cur, extra) {
  if (!KINDS.includes(kind)) return "loại thư mục không hợp lệ";
  if (!dir || typeof dir !== "string" || !path.isAbsolute(dir)) return "cần đường dẫn đầy đủ";
  for (const k of KINDS) { if (k === kind || !cur[k]) continue; if (inside(cur[k], dir) || inside(dir, cur[k])) return "trùng hoặc lồng với thư mục " + LABEL[k] + " (" + cur[k] + ")"; }
  if (isLink(dir)) return "thư mục đích là liên kết (symlink/junction) — hãy chọn thư mục thật";
  if (extra && extra.export && kind !== "backup" && (inside(extra.export, dir) || inside(dir, extra.export))) return "trùng hoặc lồng với thư mục xuất file (" + extra.export + ")";
  try { fs.mkdirSync(dir, { recursive: true }); const t = path.join(dir, ".hak-write-test-" + process.pid); fs.writeFileSync(t, "ok"); fs.unlinkSync(t); } catch (e) { return "không ghi được vào thư mục: " + (e.message || e); }
  return "";
}
/** Chép toàn bộ cây thư mục src → dst, kiểm SHA-256 từng file. Không ghi đè file khác nội dung; không xóa gì ở nguồn. → { ok, files, bytes, problems[] } */
function copyVerified(src, dst, filter, opts) {
  opts = opts || {};
  // Nguồn không tồn tại: nếu chưa từng dùng → kho khởi tạo rỗng (hợp lệ); nếu ĐÃ TỪNG dùng → mất dữ liệu, KHÔNG được coi là thành công
  const res = { ok: true, files: 0, bytes: 0, problems: [], state: "COPIED" };
  if (!fs.existsSync(src)) {
    if (opts.previouslyUsed) return { ok: false, files: 0, bytes: 0, state: "SOURCE_MISSING", problems: ["thư mục nguồn " + src + " đã từng dùng nhưng nay không còn — có thể bị xóa/đổi tên/ổ đĩa ngắt kết nối; khôi phục từ Full Backup hoặc gắn lại ổ đĩa rồi thử lại"] };
    return Object.assign(res, { state: "EMPTY_INITIAL_STORAGE" });
  }
  let list; try { list = walk(src, "", []); } catch (e) { return { ok: false, files: 0, bytes: 0, state: "SOURCE_UNREADABLE", problems: ["không đọc được nguồn: " + e.message] }; }
  if (filter) list = list.filter((f) => filter(f.rel));
  for (const f of list) {
    const to = path.join(dst, ...f.rel.split("/"));
    try {
      const h = sha(f.abs);
      if (fs.existsSync(to)) { if (sha(to) === h) { res.files++; continue; } res.problems.push(f.rel + ": đích đã có file KHÁC nội dung — không ghi đè"); continue; }
      fs.mkdirSync(path.dirname(to), { recursive: true }); const tmp = to + ".tmp" + process.pid; fs.copyFileSync(f.abs, tmp); fs.renameSync(tmp, to);
      if (sha(to) !== h) { res.problems.push(f.rel + ": sai SHA-256 sau khi chép"); try { fs.unlinkSync(to); } catch (e) { /* file vừa tạo */ } continue; }
      res.files++; res.bytes += fs.statSync(to).size;
    } catch (e) { res.problems.push(f.rel + ": " + (e.message || e)); }
  }
  res.ok = res.problems.length === 0; return res;
}
const sizeOfTree = (dir) => { let files = 0, bytes = 0; try { walk(dir, "", []).forEach((f) => { files++; try { bytes += fs.statSync(f.abs).size; } catch (e) { /* bỏ qua */ } }); } catch (e) { /* chưa có */ } return { files, bytes }; };
function freeBytes(dir, statfs) { let d = path.resolve(dir); for (let i = 0; i < 64 && !fs.existsSync(d); i++) d = path.dirname(d); try { const f = (statfs || fs.statfsSync)(d); return Number(f.bavail) * Number(f.bsize); } catch (e) { return null; } }
/** Thông tin 1 thư mục lưu trữ cho giao diện: tồn tại / số file / dung lượng / còn trống. */
function info(dir, statfs) { const ex = !!dir && fs.existsSync(dir), t = ex ? sizeOfTree(dir) : { files: 0, bytes: 0 }; return { exists: ex, files: t.files, bytes: t.bytes, free: dir ? freeBytes(dir, statfs) : null }; }
/** Đã từng dùng thư mục này? (đã đặt đường dẫn tùy chỉnh, hoặc lần khởi động trước thấy có dữ liệu) */
const wasUsed = (settings, kind) => !!((settings || {})[KEY[kind]] || ((settings || {}).storeUsed || {})[kind]);
/** Ghi nhớ kho nào đã có dữ liệu (gọi khi khởi động) để sau này phân biệt "kho trống ban đầu" với "kho đã mất". */
function markUsed(userData, settings, exportsDir, writeSettings) {
  const cur = resolve(userData, settings, exportsDir), used = Object.assign({}, (settings || {}).storeUsed || {}); let ch = false;
  ["docs", "ocrLib"].forEach((k) => { if (!used[k] && fs.existsSync(cur[k]) && sizeOfTree(cur[k]).files > 0) { used[k] = true; ch = true; } });
  if (ch) writeSettings(Object.assign({}, settings || {}, { storeUsed: used }));
  return ch;
}
/** Đổi thư mục `kind` sang `dir` — quy trình an toàn:
 *  1 kiểm tra đích (đường dẫn thật, không lồng/liên kết, ghi được) → 2 phân loại nguồn (COPIED / EMPTY_INITIAL_STORAGE / SOURCE_MISSING) → 3 đủ dung lượng
 *  → 4 chép từng file + kiểm SHA-256 → 5 mở thử kho ở đích (verifyStore) → 6 ghi cấu hình → 7 tạo lại kho (onApplied); lỗi ở 6-7 → khôi phục cấu hình cũ + kho cũ.
 *  Không bao giờ xóa nguồn. */
function move(o) { // { kind, dir, userData, settings, exportsDir, writeSettings, onApplied, verifyStore, statfs }
  const cur = resolve(o.userData, o.settings, o.exportsDir), bad = validate(o.kind, o.dir, cur, { export: o.exportsDir });
  if (bad) return { ok: false, error: bad, state: "INVALID_TARGET" };
  const src = cur[o.kind];
  if (src && (inside(src, o.dir) || inside(o.dir, src))) return { ok: false, error: inside(src, o.dir) && inside(o.dir, src) ? "Thư mục mới trùng thư mục hiện tại" : "Thư mục mới nằm trong / chứa thư mục hiện tại (" + src + ") — chép sẽ tự lồng vào chính nó", state: "INVALID_TARGET" };
  const filter = o.kind === "backup" ? (rel) => /^LuongHAK_FullBackup_.*\.zip(\.sha256)?$/i.test(rel) : null;
  if (o.kind !== "mirror" && fs.existsSync(src)) { const need = sizeOfTree(src).bytes, free = freeBytes(o.dir, o.statfs); if (free != null && free < need * 1.05 + 16 * 1048576) return { ok: false, error: "Không đủ dung lượng ở thư mục mới: cần ~" + Math.ceil(need / 1048576) + " MB, còn " + Math.floor(free / 1048576) + " MB", state: "NO_SPACE" }; }
  const r = o.kind === "mirror" ? { ok: true, files: 0, bytes: 0, problems: [], state: "COPIED" } : copyVerified(src, o.dir, filter, { previouslyUsed: wasUsed(o.settings, o.kind) });
  if (!r.ok) return { ok: false, state: r.state, error: (r.state === "SOURCE_MISSING" ? "Không có dữ liệu nguồn để chuyển — " : "Chép dữ liệu không thành công — giữ nguyên thư mục cũ: ") + r.problems.slice(0, 5).join("; "), problems: r.problems };
  if (o.verifyStore) { const vp = o.verifyStore(o.kind, o.dir); if (vp) { return { ok: false, state: "TARGET_VERIFY_FAILED", error: "Kho ở thư mục mới không qua kiểm tra — giữ nguyên thư mục cũ: " + vp }; } }
  const old = Object.assign({}, o.settings || {}), st = Object.assign({}, old); st[KEY[o.kind]] = o.dir;
  if (r.files > 0 && (o.kind === "docs" || o.kind === "ocrLib")) st.storeUsed = Object.assign({}, old.storeUsed || {}, { [o.kind]: true });
  try { o.writeSettings(st); } catch (e) { return { ok: false, state: "CONFIG_WRITE_FAILED", error: "Không ghi được cấu hình: " + (e.message || e) }; }
  const next = resolve(o.userData, st, o.exportsDir);
  try { if (o.onApplied) o.onApplied(next); }
  catch (e) { // không khởi tạo được kho mới → trả cấu hình + kho cũ
    let back = ""; try { o.writeSettings(old); if (o.onApplied) o.onApplied(resolve(o.userData, old, o.exportsDir)); } catch (e2) { back = " (và hoàn tác cấu hình cũng lỗi: " + (e2.message || e2) + ")"; }
    return { ok: false, state: "APPLY_FAILED", error: "Không khởi tạo được kho ở thư mục mới — đã trả về thư mục cũ: " + (e.message || e) + back };
  }
  return { ok: true, kind: o.kind, state: r.state, from: src, to: o.dir, files: r.files, bytes: r.bytes, note: r.state === "EMPTY_INITIAL_STORAGE" ? "Thư mục cũ chưa có dữ liệu (kho mới khởi tạo) — chỉ đổi vị trí." : "Dữ liệu cũ vẫn còn nguyên ở " + src + " (app không tự xóa) — có thể xóa tay sau khi đã kiểm tra thư mục mới." };
}
module.exports = { KINDS, KEY, LABEL, resolve, defaults, validate, copyVerified, move, walk, sha, info, markUsed, wasUsed, realOf, inside };
