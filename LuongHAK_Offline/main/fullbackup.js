// Full Backup / Restore: 1 gói ZIP gồm dữ liệu lương (data.json) + toàn bộ chứng từ gốc + manifest (SHA-256 từng file).
// Tạo: ghi ra file .tmp → kiểm tra lại toàn bộ gói → mới đổi tên (không bao giờ để lại gói dở).
// Khôi phục: KHÔNG ghi gì lên máy cho tới khi gói qua kiểm tra (inspect); chứng từ chỉ được THÊM, không ghi đè.
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const Z = require("./zip");
const FORMAT = "HAK-FULLBACKUP", VERSION = 1;
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const stampOf = (d) => { const p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); };

/** @param o { dataText, vault, destDir, appVersion, user, now } → { ok, file, name, size, sha256, docs, warnings } | { ok:false, error } */
function create(o) {
  const now = o.now || (() => new Date());
  if (typeof o.dataText !== "string" || !o.dataText.trim()) return { ok: false, error: "Chưa có dữ liệu để sao lưu" };
  try { JSON.parse(o.dataText); } catch (e) { return { ok: false, error: "Dữ liệu hiện tại không đọc được (JSON lỗi) — không đóng gói" }; }
  fs.mkdirSync(o.destDir, { recursive: true });
  let name = "LuongHAK_FullBackup_" + stampOf(now()) + ".zip", n = 1;
  while (fs.existsSync(path.join(o.destDir, name))) name = "LuongHAK_FullBackup_" + stampOf(now()) + "_" + (++n) + ".zip";
  const dest = path.join(o.destDir, name), tmp = dest + ".tmp";
  const warnings = [], manifest = { format: FORMAT, version: VERSION, createdAt: now().toISOString(), appVersion: String(o.appVersion || ""), createdBy: String(o.user || ""), data: null, documents: [], warnings };
  let w;
  try {
    w = Z.createWriter(tmp, { now });
    const db = Buffer.from(o.dataText, "utf8"); w.addBuffer("data.json", db);
    manifest.data = { path: "data.json", size: db.length, sha256: sha(db) };
    const status = {}; (o.vault ? o.vault.verify() : []).forEach((x) => { status[x.id] = x.status; });
    (o.vault ? o.vault.list() : []).forEach((m) => {
      if (status[m.id] !== "ok") { warnings.push("Chứng từ " + m.id + " (" + m.name + ") " + (status[m.id] === "missing" ? "mất file" : "sai SHA-256") + " — KHÔNG đưa vào gói"); return; }
      const f = o.vault.filesOf(m.id), rel = "documents/" + m.id + (m.ext ? "." + m.ext : "");
      w.addFile(rel, f.file); w.addBuffer("documents/" + m.id + ".json", Buffer.from(JSON.stringify(m, null, 1), "utf8"));
      manifest.documents.push({ id: m.id, name: m.name, path: rel, size: m.size, sha256: m.sha256 });
    });
    w.addBuffer("manifest.json", Buffer.from(JSON.stringify(manifest, null, 1), "utf8"));
    w.finish();
  } catch (e) { if (w) w.abort(); try { fs.unlinkSync(tmp); } catch (x) { /* chưa tạo */ } return { ok: false, error: "Không tạo được gói: " + (e.message || e) }; }
  const chk = inspect(tmp);
  if (!chk.ok) { try { fs.unlinkSync(tmp); } catch (x) { /* bỏ qua */ } return { ok: false, error: "Gói vừa tạo không qua kiểm tra: " + chk.problems.join("; ") }; }
  fs.renameSync(tmp, dest);
  const whole = crypto.createHash("sha256"), fd = fs.openSync(dest, "r"), buf = Buffer.alloc(1 << 20); let k;
  try { while ((k = fs.readSync(fd, buf, 0, buf.length, null)) > 0) whole.update(buf.subarray(0, k)); } finally { fs.closeSync(fd); }
  const hex = whole.digest("hex"); fs.writeFileSync(dest + ".sha256", hex + "  " + name + "\n");
  return { ok: true, file: dest, name, size: fs.statSync(dest).size, sha256: hex, docs: manifest.documents.length, warnings };
}

/** Kiểm tra gói KHÔNG ghi gì lên đĩa. @param vault (tuỳ chọn) để phân loại chứng từ new/same/conflict.
 *  → { ok, manifest, problems[], dataText, docs: [{id,name,size,state}] } */
function inspect(file, vault) {
  const res = { ok: false, manifest: null, problems: [], dataText: null, docs: [] };
  let zip; try { zip = Z.openZip(file); } catch (e) { res.problems.push(e.message); return res; }
  try {
    const me = zip.byName["manifest.json"]; if (!me) { res.problems.push("Thiếu manifest.json — không phải gói Full Backup của app"); return res; }
    let m; try { m = JSON.parse(zip.readBuffer(me, 8 * 1048576).toString("utf8")); } catch (e) { res.problems.push("manifest.json hỏng: " + e.message); return res; }
    if (!m || m.format !== FORMAT) { res.problems.push("Không phải gói Full Backup của app (sai định dạng)"); return res; }
    if (m.version > VERSION) { res.problems.push("Gói do phiên bản MỚI HƠN tạo (v" + m.version + ") — hãy cập nhật app"); return res; }
    res.manifest = m;
    const de = zip.byName[(m.data || {}).path || ""];
    if (!de) res.problems.push("Thiếu data.json trong gói");
    else {
      try { const b = zip.readBuffer(de); if (sha(b) !== m.data.sha256 || b.length !== m.data.size) res.problems.push("data.json sai SHA-256 — gói bị hỏng hoặc bị sửa"); else { res.dataText = b.toString("utf8"); try { const o = JSON.parse(res.dataText); if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("không phải đối tượng"); } catch (e) { res.problems.push("data.json không phải dữ liệu hợp lệ: " + e.message); res.dataText = null; } } }
      catch (e) { res.problems.push("data.json: " + e.message); }
    }
    (m.documents || []).forEach((d) => {
      const e = zip.byName[d.path || ""], sc = zip.byName["documents/" + d.id + ".json"]; let state = "new";
      if (!e || !sc) { res.problems.push("Thiếu file chứng từ " + d.id); res.docs.push({ id: d.id, name: d.name, size: d.size, state: "bad" }); return; }
      try { if (zip.sha256Of(e) !== d.sha256) throw new Error("sai SHA-256"); } catch (x) { res.problems.push("Chứng từ " + d.id + " (" + d.name + "): " + x.message); res.docs.push({ id: d.id, name: d.name, size: d.size, state: "bad" }); return; }
      if (vault) { const cur = vault.find(d.id); if (cur) state = cur.sha256 === d.sha256 ? "same" : "conflict"; }
      res.docs.push({ id: d.id, name: d.name, size: d.size, state });
    });
    res.ok = res.problems.length === 0 && !!res.dataText;
    return res;
  } finally { zip.close(); }
}

/** Thêm chứng từ từ gói vào kho (đã qua inspect). Không ghi đè. → { added, same, conflict[], failed[] } */
function importDocuments(file, vault) {
  const zip = Z.openZip(file), out = { added: 0, same: 0, conflict: [], failed: [] };
  try {
    const m = JSON.parse(zip.readBuffer(zip.byName["manifest.json"], 8 * 1048576).toString("utf8"));
    (m.documents || []).forEach((d) => {
      try {
        const meta = JSON.parse(zip.readBuffer(zip.byName["documents/" + d.id + ".json"], 1048576).toString("utf8"));
        if (meta.id !== d.id || meta.sha256 !== d.sha256) throw new Error("siêu dữ liệu không khớp manifest");
        const r = vault.importDoc(meta, zip.readBuffer(zip.byName[d.path], 256 * 1048576));
        if (!r.ok) out.failed.push(d.id + ": " + r.error); else if (r.status === "added") out.added++; else if (r.status === "same") out.same++; else out.conflict.push(d.id);
      } catch (e) { out.failed.push(d.id + ": " + (e.message || e)); }
    });
  } finally { zip.close(); }
  return out;
}
module.exports = { create, inspect, importDocuments, FORMAT, VERSION };
