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
const inside = (a, b) => { const r = path.relative(path.resolve(a), path.resolve(b)); return r === "" || (!!r && !r.startsWith("..") && !path.isAbsolute(r)); };
/** Kiểm tra thư mục đích hợp lệ: tuyệt đối, tạo/ghi được, không nằm trong hoặc chứa thư mục lưu trữ khác. */
function validate(kind, dir, cur) {
  if (!KINDS.includes(kind)) return "loại thư mục không hợp lệ";
  if (!dir || typeof dir !== "string" || !path.isAbsolute(dir)) return "cần đường dẫn đầy đủ";
  for (const k of KINDS) { if (k === kind || !cur[k]) continue; if (inside(cur[k], dir) || inside(dir, cur[k])) return "trùng hoặc lồng với thư mục " + LABEL[k] + " (" + cur[k] + ")"; }
  try { fs.mkdirSync(dir, { recursive: true }); const t = path.join(dir, ".hak-write-test-" + process.pid); fs.writeFileSync(t, "ok"); fs.unlinkSync(t); } catch (e) { return "không ghi được vào thư mục: " + (e.message || e); }
  return "";
}
/** Chép toàn bộ cây thư mục src → dst, kiểm SHA-256 từng file. Không ghi đè file khác nội dung; không xóa gì ở nguồn. → { ok, files, bytes, problems[] } */
function copyVerified(src, dst, filter) {
  const res = { ok: true, files: 0, bytes: 0, problems: [] };
  if (!fs.existsSync(src)) return res;
  let list; try { list = walk(src, "", []); } catch (e) { return { ok: false, files: 0, bytes: 0, problems: ["không đọc được nguồn: " + e.message] }; }
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
/** Đổi thư mục `kind` sang `dir`: kiểm tra → chép+kiểm → ghi cấu hình. onApplied(newPaths) để tiến trình chính tạo lại kho. */
function move(o) { // { kind, dir, userData, settings, exportsDir, writeSettings, onApplied }
  const cur = resolve(o.userData, o.settings, o.exportsDir), bad = validate(o.kind, o.dir, cur);
  if (bad) return { ok: false, error: bad };
  const src = cur[o.kind];
  const filter = o.kind === "backup" ? (rel) => /^LuongHAK_FullBackup_.*\.zip(\.sha256)?$/i.test(rel) : null;
  const r = o.kind === "mirror" ? { ok: true, files: 0, bytes: 0, problems: [] } : copyVerified(src, o.dir, o.kind === "backup" ? (rel) => filter(rel) : null);
  if (!r.ok) return { ok: false, error: "Chép dữ liệu không thành công — giữ nguyên thư mục cũ: " + r.problems.slice(0, 5).join("; "), problems: r.problems };
  const st = Object.assign({}, o.settings || {}); st[KEY[o.kind]] = o.dir;
  try { o.writeSettings(st); } catch (e) { return { ok: false, error: "Không ghi được cấu hình: " + (e.message || e) }; }
  const next = resolve(o.userData, st, o.exportsDir); if (o.onApplied) o.onApplied(next);
  return { ok: true, kind: o.kind, from: src, to: o.dir, files: r.files, bytes: r.bytes, note: "Dữ liệu cũ vẫn còn nguyên ở " + src + " (app không tự xóa) — có thể xóa tay sau khi kiểm tra." };
}
module.exports = { KINDS, KEY, LABEL, resolve, defaults, validate, copyVerified, move, walk, sha };
