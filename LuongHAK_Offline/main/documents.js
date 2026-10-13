// Kho chứng từ gốc: lưu NGUYÊN BẢN file (ảnh/PDF/Excel) vào userData/documents, định danh bằng DocumentID + SHA-256.
// Quy tắc: chỉ thêm, KHÔNG có thao tác xóa/ghi đè; trùng nội dung (cùng SHA-256) dùng lại DocumentID cũ; mỗi tệp có sidecar .json để khôi phục metadata.
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const MAX_BYTES = 200 * 1024 * 1024;
const EXT_OK = ["pdf", "png", "jpg", "jpeg", "bmp", "tif", "tiff", "webp", "xlsx", "xls", "csv"];

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
function cleanName(n) { return String(n || "chungtu").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 120) || "chungtu"; }
function extOf(n) { const m = /\.([A-Za-z0-9]{1,5})$/.exec(String(n || "")); return m ? m[1].toLowerCase() : ""; }

/** @param root thư mục documents  @param opts { now, rand } để kiểm thử */
function createVault(root, opts) {
  opts = opts || {};
  const now = opts.now || (() => new Date());
  const rand = opts.rand || (() => crypto.randomBytes(3).toString("hex").toUpperCase());
  const bySha = {}, byId = {}; // sha → meta (chống trùng) · id → meta (nạp từ sidecar)
  let loaded = false;
  const dirFor = (id) => path.join(root, id.slice(4, 10));            // DOC-YYYYMM-... → thư mục theo tháng
  const fileFor = (m) => path.join(dirFor(m.id), m.id + (m.ext ? "." + m.ext : ""));
  const sideFor = (m) => path.join(dirFor(m.id), m.id + ".json");

  function scan() {
    if (loaded) return; loaded = true;
    if (!fs.existsSync(root)) return;
    for (const sub of fs.readdirSync(root)) {
      const d = path.join(root, sub); let st; try { st = fs.statSync(d); } catch (e) { continue; }
      if (!st.isDirectory()) continue;
      for (const f of fs.readdirSync(d)) {
        if (!/^DOC-.*\.json$/.test(f)) continue;
        try { const m = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")); if (m && m.id && m.sha256) { byId[m.id] = m; if (!bySha[m.sha256]) bySha[m.sha256] = m; } } catch (e) { /* sidecar hỏng: verify() sẽ báo */ }
      }
    }
  }
  function newId() {
    const d = now(), p = (n) => String(n).padStart(2, "0");
    for (;;) { const id = "DOC-" + d.getFullYear() + p(d.getMonth() + 1) + "-" + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + "-" + rand(); if (!fs.existsSync(dirFor(id) + path.sep + id + ".json")) return id; }
  }

  /** Thêm chứng từ. buf: Buffer. Trả { ok, id, sha256, duplicate, name, size } hoặc { ok:false, error }. */
  function add(buf, info) {
    info = info || {};
    if (!Buffer.isBuffer(buf) || !buf.length) return { ok: false, error: "File rỗng" };
    if (buf.length > MAX_BYTES) return { ok: false, error: "File quá lớn (tối đa 200 MB)" };
    const name = cleanName(info.name), ext = extOf(name);
    if (!EXT_OK.includes(ext)) return { ok: false, error: "Loại file không được hỗ trợ: ." + (ext || "?") };
    scan();
    const h = sha256(buf), old = bySha[h];
    if (old) return { ok: true, id: old.id, sha256: h, duplicate: true, name: old.name, size: old.size };
    const id = newId(), meta = { id, sha256: h, name, ext, size: buf.length, addedAt: now().toISOString(), addedBy: String(info.user || "").slice(0, 60), note: String(info.note || "").slice(0, 300), pages: Number(info.pages) || 0 };
    fs.mkdirSync(dirFor(id), { recursive: true });
    fs.writeFileSync(fileFor(meta), buf, { flag: "wx" }); // wx: không ghi đè
    fs.writeFileSync(sideFor(meta), JSON.stringify(meta, null, 1), { flag: "wx" });
    bySha[h] = meta; byId[id] = meta;
    return { ok: true, id, sha256: h, duplicate: false, name, size: meta.size };
  }
  function find(id) { scan(); return byId[id] || null; }
  function list() { scan(); return Object.values(byId).sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1)); }
  function read(id) { const m = find(id); if (!m) return { ok: false, error: "Không có chứng từ " + id }; try { return { ok: true, meta: m, data: fs.readFileSync(fileFor(m)) }; } catch (e) { return { ok: false, error: "Không đọc được file chứng từ" }; } }
  function pathOf(id) { const m = find(id); return m ? fileFor(m) : null; }
  /** Kiểm tra toàn vẹn: file tồn tại, SHA-256 khớp sidecar. */
  function verify(ids) {
    scan(); const out = [];
    (ids ? ids.map(find).filter(Boolean) : list()).forEach((m) => {
      let st = "ok";
      try { const b = fs.readFileSync(fileFor(m)); if (b.length !== m.size || sha256(b) !== m.sha256) st = "mismatch"; } catch (e) { st = "missing"; }
      out.push({ id: m.id, name: m.name, status: st });
    });
    return out;
  }
  /** Nhập lại chứng từ từ gói Full Backup, GIỮ NGUYÊN DocumentID (dữ liệu lương tham chiếu theo ID). Không bao giờ ghi đè:
   *  cùng ID + cùng SHA-256 → "same"; cùng ID khác SHA-256 → "conflict" (giữ bản đang có, báo lại). */
  function importDoc(meta, buf) {
    if (!meta || !/^DOC-\d{6}-\d{8}-[A-Z0-9]{3,12}$/.test(String(meta.id || ""))) return { ok: false, error: "DocumentID không hợp lệ" };
    if (!Buffer.isBuffer(buf) || sha256(buf) !== meta.sha256 || buf.length !== meta.size) return { ok: false, error: "Nội dung không khớp SHA-256 trong gói" };
    scan(); const old = byId[meta.id];
    if (old) return { ok: true, id: meta.id, status: old.sha256 === meta.sha256 ? "same" : "conflict" };
    const m = { id: meta.id, sha256: meta.sha256, name: cleanName(meta.name), ext: extOf(meta.name) || String(meta.ext || "").toLowerCase(), size: buf.length, addedAt: String(meta.addedAt || now().toISOString()), addedBy: String(meta.addedBy || ""), note: String(meta.note || ""), pages: Number(meta.pages) || 0 };
    if (!EXT_OK.includes(m.ext)) return { ok: false, error: "Loại file không được hỗ trợ: ." + m.ext };
    fs.mkdirSync(dirFor(m.id), { recursive: true });
    fs.writeFileSync(fileFor(m), buf, { flag: "wx" }); fs.writeFileSync(sideFor(m), JSON.stringify(m, null, 1), { flag: "wx" });
    byId[m.id] = m; if (!bySha[m.sha256]) bySha[m.sha256] = m;
    return { ok: true, id: m.id, status: "added" };
  }
  /** Đường dẫn file gốc + sidecar (để đóng gói) */
  function filesOf(id) { const m = find(id); return m ? { meta: m, file: fileFor(m), side: sideFor(m) } : null; }
  return { importDoc, filesOf, add, list, find, read, pathOf, verify, root: () => root };
}
module.exports = { createVault, sha256, EXT_OK, MAX_BYTES };
