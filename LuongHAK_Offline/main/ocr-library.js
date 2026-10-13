// ===== MAIN / OCR-LIBRARY — lưu bền thư viện mẫu OCR (V7): ảnh mẫu + nhật ký bản ghi thêm-vào-cuối =====
// <root>/library.jsonl      mỗi dòng 1 bản ghi JSON (sample | edit | status | relabel | refs); chỉ THÊM, không sửa/xóa dòng cũ
// <root>/images/<xx>/<sha256>.png   ảnh ô xám (đặt tên theo SHA-256 của chính file → trùng byte chỉ lưu 1 lần)
// Thứ tự ghi: ảnh trước (tmp → rename), rồi dòng nhật ký (fsync). Dòng cuối bị cắt dở khi mất điện bị bỏ qua khi nạp (đếm trong `corrupt`).
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const LY = require("../core/ocr-learning/layout.js"), L = require("../core/ocr-learning/library.js"), F = require("../core/ocr-learning/features.js");
const { encodeGrayPNG } = require("./ocr-service");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

function createStore(root, opts) {
  opts = opts || {};
  const logFile = path.join(root, "library.jsonl"), imgDir = path.join(root, "images");
  const lib = L.createLibrary(Object.assign({}, opts.libOpts || {}));
  let corrupt = 0, loaded = false;
  const imgPath = (h) => path.join(imgDir, h.slice(0, 2), h + ".png");

  function load() {
    if (loaded) return { corrupt };
    loaded = true; if (!fs.existsSync(logFile)) return { corrupt };
    const text = fs.readFileSync(logFile, "utf8");
    text.split("\n").forEach((line) => {
      if (!line.trim()) return;
      let r; try { r = JSON.parse(line); } catch (e) { corrupt++; return; }
      lib.apply(r);
    });
    return { corrupt };
  }
  function toLine(rec) {
    if (rec.t !== "sample") return JSON.stringify(rec);
    const o = Object.assign({}, rec); delete o.rawPng; delete o.vec; o.feat = F.toB64(rec.vec); o.png = "images/" + rec.pngSha.slice(0, 2) + "/" + rec.pngSha + ".png";
    return JSON.stringify(o);
  }
  function writeImage(h, buf) {
    const f = imgPath(h); if (fs.existsSync(f)) return;
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const tmp = f + ".tmp" + process.pid; fs.writeFileSync(tmp, buf, { flag: "w" }); fs.renameSync(tmp, f);
  }
  /** Ghi bền các bản ghi (ảnh trước, nhật ký sau). Ném lỗi nếu thất bại — người gọi KHÔNG được báo "đã học". */
  function persist(records) {
    if (!records.length) return;
    fs.mkdirSync(root, { recursive: true });
    records.forEach((r) => { if (r.t === "sample" && r.rawPng) writeImage(r.pngSha, Buffer.from(r.rawPng)); });
    const fd = fs.openSync(logFile, "a");
    try { fs.writeSync(fd, records.map(toLine).join("\n") + "\n"); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  }
  function commitAll(fn) { // fn tạo bản ghi (chưa áp) → ghi bền → áp vào bộ nhớ
    load(); const res = lib.defer(fn); persist(res.records || []); lib.commit(res.records || []); return res;
  }
  /** p từ giao diện: { ...trường định danh ô..., raw: Uint8Array xám w×h (ảnh hiển thị), clean: Uint8Array xám w×h (ảnh tính đặc trưng), w, h, cellType, ... } */
  function mkSampleInput(p) {
    const out = Object.assign({}, p); delete out.raw; delete out.clean;
    if (p.raw && p.clean && p.w > 0 && p.h > 0 && p.raw.length === p.w * p.h && p.clean.length === p.w * p.h) {
      const png = encodeGrayPNG(p.raw instanceof Uint8Array ? p.raw : Uint8Array.from(p.raw), p.w, p.h);
      const ft = F.extract(p.clean instanceof Uint8Array ? p.clean : Uint8Array.from(p.clean), p.w, p.h, { cell: p.cellSize });
      if (!ft.blank || p.allowBlank) { out.rawPng = png; out.pngSha = sha(png); out.vec = ft.vec; }
    }
    return out;
  }
  function record(p) { return commitAll(() => lib.recordCorrection(mkSampleInput(p))); }
  function confirm(p) { return commitAll(() => lib.recordConfirmed(mkSampleInput(p))); }
  function approve(q) { return commitAll(() => lib.approve(q)); }
  function setStatus(id, st, user, reason) { return commitAll(() => lib.setStatus(id, st, user, reason)); }
  function relabel(id, label, kind, user, reason) { return commitAll(() => lib.relabel(id, label, kind, user, reason)); }
  function undoCell(key, user) { return commitAll(() => lib.undoCell(key, user)); }
  function lookup(items, ctx) {
    load(); const counts = {};
    const out = items.map((it) => {
      if (!it || !it.w || !it.clean || it.clean.length !== it.w * it.h) return { status: "UNRECOGNIZED", label: "", score: 0, top: [], reason: "ảnh không hợp lệ" };
      const ft = F.extract(it.clean instanceof Uint8Array ? it.clean : Uint8Array.from(it.clean), it.w, it.h, { cell: it.cellSize });
      if (ft.blank) return { status: "UNRECOGNIZED", label: "", score: 0, top: [], reason: "ô trống" };
      const r = lib.lookup(ft.vec, it.cellType || "digit", { ocrText: it.ocrText, ocrConf: it.ocrConf });
      if (r.status === "AUTO_ACCEPT" || r.status === "SUGGESTED") r.top.slice(0, 1).forEach((t) => { counts[t.id] = (counts[t.id] || 0) + 1; });
      return r;
    });
    if (Object.keys(counts).length) { try { persist(lib.noteRefs(counts)); } catch (e) { /* đếm tham chiếu là phụ — không chặn nhận dạng */ } }
    return out;
  }
  function readImage(h) { if (!/^[0-9a-f]{64}$/.test(h)) return null; try { return fs.readFileSync(imgPath(h)); } catch (e) { return null; } }
  /** Kiểm tra toàn vẹn: mọi mẫu có ảnh, SHA-256 ảnh khớp tên, dòng nhật ký không hỏng. */
  function verify() {
    load(); const bad = []; let n = 0;
    lib.list().forEach((s) => { n++; const b = readImage(s.pngSha); if (!b) bad.push({ id: s.id, error: "thiếu ảnh" }); else if (sha(b) !== s.pngSha) bad.push({ id: s.id, error: "ảnh sai SHA-256" }); });
    return { ok: bad.length === 0 && corrupt === 0, samples: n, corruptLines: corrupt, bad };
  }
  /** Danh sách file thuộc thư viện (để đóng gói Full Backup). */
  function files() {
    const out = []; if (fs.existsSync(logFile)) out.push({ rel: "library.jsonl", abs: logFile }); if (fs.existsSync(layFile)) out.push({ rel: "layouts.jsonl", abs: layFile });
    if (fs.existsSync(imgDir)) fs.readdirSync(imgDir).forEach((d) => fs.readdirSync(path.join(imgDir, d)).forEach((f) => { if (/^[0-9a-f]{64}\.png$/.test(f)) out.push({ rel: "images/" + d + "/" + f, abs: path.join(imgDir, d, f) }); }));
    return out;
  }
  // ----- thư viện bố cục: layouts.jsonl (thêm vào cuối) -----
  const layFile = path.join(root, "layouts.jsonl"); let lays = null;
  function layLoad() {
    if (lays) return lays; lays = {};
    if (fs.existsSync(layFile)) fs.readFileSync(layFile, "utf8").split("\n").forEach((ln) => { if (!ln.trim()) return; let r; try { r = JSON.parse(ln); } catch (e) { corrupt++; return; }
      if (r.t === "layout") lays[r.id] = Object.assign({ uses: 0, lastUsed: "" }, r); else if (r.t === "layoutUse" && lays[r.id]) { lays[r.id].uses++; lays[r.id].lastUsed = r.at; } });
    return lays;
  }
  function layAppend(r) { fs.mkdirSync(root, { recursive: true }); const fd = fs.openSync(layFile, "a"); try { fs.writeSync(fd, JSON.stringify(r) + "\n"); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
  function layouts() { return Object.keys(layLoad()).map((k) => { const l = lays[k]; return { id: l.id, name: l.name, cols: l.sig.nCols, rows: l.sig.nRows, uses: l.uses, lastUsed: l.lastUsed, createdAt: l.at, by: l.by, sig: l.sig }; }); }
  function layoutMatch(sig, th) { return LY.match(sig, layouts(), th); }
  function layoutSave(sig, name, user) {
    if (!sig || !sig.nCols) throw new Error("chữ ký bố cục không hợp lệ");
    const m = layoutMatch(sig); const at = new Date().toISOString();
    if (m.status === "MATCH") { layAppend({ t: "layoutUse", id: m.id, at }); layLoad(); lays[m.id].uses++; lays[m.id].lastUsed = at; return { id: m.id, created: false }; }
    const id = "LAY-" + at.replace(/\D/g, "").slice(0, 14) + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();
    const rec = { t: "layout", id, name: String(name || "Bố cục " + (Object.keys(layLoad()).length + 1)).slice(0, 80), sig, at, by: user || "" };
    layAppend(rec); lays[id] = Object.assign({ uses: 1, lastUsed: at }, rec); layAppend({ t: "layoutUse", id, at }); return { id, created: true };
  }
  function addLayoutRecord(r) { layLoad(); if (lays[r.id]) return; layAppend(r); lays[r.id] = Object.assign({ uses: 0, lastUsed: "" }, r); }
  /** Đặt ảnh mẫu (đã kiểm SHA-256 khớp tên) */
  function putImage(h, buf) { if (sha(buf) !== h) throw new Error("ảnh sai SHA-256"); writeImage(h, buf); }
  /** Nạp bản ghi từ gói sao lưu (dạng dòng nhật ký: sample có `feat` base64 thay vec). Ghi bền rồi mới áp. */
  function restoreRecords(recs) {
    load();
    const norm = recs.map((r) => { if (r.t !== "sample") return r; const o = Object.assign({}, r); if (o.feat) { o.vec = F.fromB64(o.feat); delete o.feat; } return o; });
    const lines = recs.map((r) => JSON.stringify(r)); if (!lines.length) return;
    fs.mkdirSync(root, { recursive: true });
    const fd = fs.openSync(logFile, "a"); try { fs.writeSync(fd, lines.join("\n") + "\n"); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    norm.forEach((r) => lib.apply(r));
  }
  return { lib, root, addLayoutRecord, layouts, layoutMatch, layoutSave, putImage, restoreRecords, load, record, confirm, approve, setStatus, relabel, undoCell, lookup, readImage, verify, files, persist, corrupt: () => corrupt };
}
module.exports = { createStore };
