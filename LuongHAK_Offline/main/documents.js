// Kho chứng từ gốc: lưu NGUYÊN BẢN file (ảnh/PDF/Excel) vào userData/documents, định danh bằng DocumentID + SHA-256.
// Quy tắc: chỉ thêm, KHÔNG có thao tác xóa/ghi đè; trùng nội dung (cùng SHA-256) dùng lại DocumentID cũ; mỗi tệp có sidecar .json để khôi phục metadata.
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const MAX_BYTES = 200 * 1024 * 1024;
const EXT_OK = ["pdf", "png", "jpg", "jpeg", "bmp", "tif", "tiff", "webp", "xlsx", "xls", "csv"];
// V9.2: tài liệu HĐLĐ (docType HDLD) — chỉ PDF/JPG/PNG, kiểm tra NỘI DUNG thật (không tin đuôi file), giới hạn dung lượng, không chứa mã chủ động trong PDF
const HDLD_EXT = ["pdf", "png", "jpg", "jpeg"], HDLD_MAX = 25 * 1024 * 1024;
function sniffHdld(buf, ext) {
  const n = buf.length, tail = (k) => buf.subarray(Math.max(0, n - k));
  if (ext === "pdf") {
    if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return "Nội dung không phải PDF (không có chữ ký %PDF-)";
    if (tail(2048).toString("latin1").indexOf("%%EOF") < 0) return "File PDF bị cắt/hỏng (thiếu %%EOF ở cuối file)";
    const head = buf.toString("latin1");
    if (/\/Launch\b/.test(head)) return "PDF chứa lệnh chạy chương trình (/Launch) — không được đính kèm";
    if (/\/(JavaScript|JS)\b/.test(head)) return "PDF chứa mã JavaScript — không được đính kèm";
    return "";
  }
  if (ext === "png") {
    if (!(n > 20 && buf[0] === 0x89 && buf.subarray(1, 4).toString("latin1") === "PNG" && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a)) return "Nội dung không phải ảnh PNG";
    return tail(16).toString("latin1").indexOf("IEND") < 0 ? "Ảnh PNG bị cắt/hỏng (thiếu IEND)" : "";
  }
  if (!(n > 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) return "Nội dung không phải ảnh JPEG";
  const t = tail(64); for (let i = t.length - 2; i >= 0; i--) if (t[i] === 0xff && t[i + 1] === 0xd9) return "";
  return "Ảnh JPEG bị cắt/hỏng (thiếu dấu kết thúc FFD9)";
}

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
        try { const m = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")); if (m && m.id && m.sha256) { byId[m.id] = m; const bk = m.sha256 + (m.docType === "HDLD" ? "|HDLD" : ""); if (!bySha[bk]) bySha[bk] = m; } } catch (e) { /* sidecar hỏng: verify() sẽ báo */ }
      }
    }
  }
  function newId() {
    const d = now(), p = (n) => String(n).padStart(2, "0");
    for (;;) { const id = "DOC-" + d.getFullYear() + p(d.getMonth() + 1) + "-" + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + "-" + rand(); if (!fs.existsSync(dirFor(id) + path.sep + id + ".json")) return id; }
  }

  /** Thêm chứng từ. buf: Buffer. Trả { ok, id, sha256, duplicate, name, size } hoặc { ok:false, error }. */
  /** Tên chuẩn của chứng từ: {CompanyID}_{YYYYMM}_{DocumentType}_{DepartmentCode}_{DocumentID}_{HashPrefix}.{ext} — dùng khi xuất / hiển thị; file lưu trong kho vẫn theo DocumentID. */
  const tok = (x, d) => String(x || d).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "D").replace(/[^A-Za-z0-9-]+/g, "").slice(0, 20) || d;
  function storedNameOf(m, info) {
    const ym = /^(\d{4})-(\d{2})$/.test(String(info && info.ky || "")) ? info.ky.replace("-", "") : m.addedAt.slice(0, 7).replace("-", "");
    return [tok(info && info.company, "HAK"), ym, tok(info && info.docType, "BANGCONG"), tok(info && info.dept, "ALL"), m.id, m.sha256.slice(0, 8)].join("_") + "." + m.ext;
  }
  function add(buf, info) {
    info = info || {};
    if (!Buffer.isBuffer(buf) || !buf.length) return { ok: false, error: "File rỗng" };
    if (buf.length > MAX_BYTES) return { ok: false, error: "File quá lớn (tối đa 200 MB)" };
    const name = cleanName(info.name), ext = extOf(name);
    if (!EXT_OK.includes(ext)) return { ok: false, error: "Loại file không được hỗ trợ: ." + (ext || "?") };
    const hdld = tok(info.docType, "BANGCONG") === "HDLD";
    if (hdld) {
      if (!HDLD_EXT.includes(ext)) return { ok: false, error: "Tài liệu HĐLĐ chỉ nhận PDF, JPG, PNG (đang là ." + ext + ")" };
      if (buf.length > HDLD_MAX) return { ok: false, error: "Tài liệu HĐLĐ tối đa " + (HDLD_MAX / 1048576) + " MB mỗi file" };
      const bad = sniffHdld(buf, ext === "jpeg" ? "jpg" : ext); if (bad) return { ok: false, error: bad };
    }
    scan();
    const h = sha256(buf), old = bySha[h + (hdld ? "|HDLD" : "")];
    if (old) return { ok: true, id: old.id, sha256: h, duplicate: true, name: old.name, size: old.size };
    const sameName = Object.values(byId).filter((m) => m.name === name && m.sha256 !== h).map((m) => m.id); // cùng tên khác nội dung: vẫn lưu bản mới, báo để người dùng biết
    const id = newId(), meta = { id, sha256: h, name, ext, size: buf.length, addedAt: now().toISOString(), addedBy: String(info.user || "").slice(0, 60), note: String(info.note || "").slice(0, 300), pages: Number(info.pages) || 0 };
    meta.storedName = storedNameOf(meta, info); meta.docType = tok(info.docType, "BANGCONG"); meta.dept = tok(info.dept, "ALL"); meta.company = tok(info.company, "HAK"); meta.ky = /^\d{4}-\d{2}$/.test(String(info.ky || "")) ? info.ky : "";
    fs.mkdirSync(dirFor(id), { recursive: true });
    fs.writeFileSync(fileFor(meta), buf, { flag: "wx" }); // wx: không ghi đè
    fs.writeFileSync(sideFor(meta), JSON.stringify(meta, null, 1), { flag: "wx" });
    bySha[h + (hdld ? "|HDLD" : "")] = meta; byId[id] = meta;
    return { ok: true, id, sha256: h, duplicate: false, name, size: meta.size, sameNameDifferent: sameName };
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
    const m = { id: meta.id, sha256: meta.sha256, name: cleanName(meta.name), ext: extOf(meta.name) || String(meta.ext || "").toLowerCase(), size: buf.length, addedAt: String(meta.addedAt || now().toISOString()), restoreId: String(meta.restoreId || ""), addedBy: String(meta.addedBy || ""), note: String(meta.note || ""), pages: Number(meta.pages) || 0 };
    if (meta.docType) m.docType = tok(meta.docType, "BANGCONG"); // V9.2: giữ loại chứng từ (HDLD) để phân quyền đọc sau khi khôi phục
    ["dept", "company", "ky", "storedName"].forEach((k) => { if (meta[k]) m[k] = String(meta[k]).slice(0, 120); });
    if (!EXT_OK.includes(m.ext)) return { ok: false, error: "Loại file không được hỗ trợ: ." + m.ext };
    fs.mkdirSync(dirFor(m.id), { recursive: true });
    fs.writeFileSync(fileFor(m), buf, { flag: "wx" }); fs.writeFileSync(sideFor(m), JSON.stringify(m, null, 1), { flag: "wx" });
    byId[m.id] = m; { const bk = m.sha256 + (m.docType === "HDLD" ? "|HDLD" : ""); if (!bySha[bk]) bySha[bk] = m; }
    return { ok: true, id: m.id, status: "added" };
  }
  /** Đường dẫn file gốc + sidecar (để đóng gói) */
  function filesOf(id) { const m = find(id); return m ? { meta: m, file: fileFor(m), side: sideFor(m) } : null; }
  /** Hoàn tác một lần khôi phục: CHỈ xóa chứng từ do chính lần khôi phục đó thêm (restoreId khớp và có trong danh sách) — không bao giờ động tới chứng từ có sẵn. */
  function rollbackRestore(restoreId, ids) {
    scan(); const out = { removed: [], kept: [] };
    (ids || []).forEach((id) => { const m = byId[id]; if (!m || !restoreId || m.restoreId !== restoreId) { out.kept.push(id); return; }
      try { fs.unlinkSync(fileFor(m)); } catch (e) { /* đã mất */ } try { fs.unlinkSync(sideFor(m)); } catch (e) { /* đã mất */ }
      delete byId[id]; { const bk = m.sha256 + (m.docType === "HDLD" ? "|HDLD" : ""); if (bySha[bk] && bySha[bk].id === id) delete bySha[bk]; } out.removed.push(id); });
    return out;
  }
  return { importDoc, rollbackRestore, filesOf, add, list, find, read, pathOf, verify, root: () => root };
}
module.exports = { createVault, sha256, EXT_OK, MAX_BYTES, HDLD_MAX, sniffHdld };
