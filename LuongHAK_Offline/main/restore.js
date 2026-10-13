// ===== MAIN / RESTORE — khôi phục Full Backup theo giao dịch (V8) =====
// PRECHECK → STAGING → VERIFY → COMMIT(tài sản: chứng từ + thư viện OCR, có nhật ký hoàn tác) → [giao diện thay dữ liệu lương] → POSTCHECK → FINISH | ROLLBACK
// • Không ghi gì vào kho chứng từ / thư viện OCR / dữ liệu đang chạy cho tới khi TOÀN BỘ gói đã giải nén ra thư mục tạm và kiểm tra xong.
// • Giải nén chỉ vào thư mục tạm do app tạo, tên mục lấy từ manifest và qua danh sách trắng; kiểm lại realpath (chống '..', liên kết, junction).
// • COMMIT chạy dưới khóa ghi (busy()): các thao tác ghi khác bị từ chối. Nhật ký restore-journal.json cho phép hoàn tác/khởi động lại an toàn.
// • Không giả định đổi tên giữa hai ổ đĩa là nguyên tử: chép + kiểm SHA-256 từng file, hoàn tác theo nhật ký.
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const FB = require("./fullbackup"), Z = require("./zip");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const SAFE_MARGIN = 16 * 1048576;
const OK_PATH = /^(data\.json|manifest\.json|documents\/DOC-\d{6}-\d{8}-[A-Z0-9]{3,12}(\.[A-Za-z0-9]{1,5}|\.json)|ocr_library\/(library\.jsonl|layouts\.jsonl|images\/[0-9a-f]{2}\/[0-9a-f]{64}\.png))$/;

function shaFile(f) { const h = crypto.createHash("sha256"), fd = fs.openSync(f, "r"), b = Buffer.alloc(1 << 20); let n; try { while ((n = fs.readSync(fd, b, 0, b.length, null)) > 0) h.update(b.subarray(0, n)); } finally { fs.closeSync(fd); } return h.digest("hex"); }
function writeJson(file, obj) { const tmp = file + ".tmp"; const fd = fs.openSync(tmp, "w"); try { fs.writeSync(fd, JSON.stringify(obj, null, 1)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } fs.renameSync(tmp, file); }
function rmrf(d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* bỏ qua */ } }
function freeBytes(dir, statfs) { try { const f = (statfs || fs.statfsSync)(dir); return Number(f.bavail) * Number(f.bsize); } catch (e) { return null; } }
function writable(dir) { try { fs.mkdirSync(dir, { recursive: true }); const p = path.join(dir, ".hak-write-test-" + process.pid); fs.writeFileSync(p, "x"); fs.unlinkSync(p); return ""; } catch (e) { return String(e.message || e); } }

/** o: { userData, getVault(), getOcrLib(), readData() → {ok,text}, maxSchema, appVersion, statfs, now } */
function createRestorer(o) {
  const stagingRoot = path.join(o.userData, "restore-staging"), journalFile = path.join(o.userData, "restore-journal.json");
  const staged = {}; let lock = { busy: false, rid: "" };
  const readJournal = () => { try { return JSON.parse(fs.readFileSync(journalFile, "utf8")); } catch (e) { return null; } };
  const setJournal = (j) => writeJson(journalFile, j);
  const newRid = () => "RS-" + (o.now ? o.now() : new Date()).toISOString().replace(/[-:TZ.]/g, "").slice(0, 14) + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();

  /** PRECHECK + STAGING + VERIFY. Không đụng tới dữ liệu đang chạy. */
  function stage(pkg, opts) {
    opts = opts || {};
    const phases = [], rid = newRid(); let zip = null, stageDir = "";
    const ph = (name, ok, detail) => { phases.push({ name, ok, detail: detail || "" }); return ok; };
    const fail = (name, detail, extra) => { ph(name, false, detail); if (stageDir) rmrf(stageDir); return Object.assign({ ok: false, rid, phase: name, error: detail, phases }, extra || {}); };
    if (lock.busy) return fail("PRECHECK", "Đang có một lần khôi phục khác chưa kết thúc");
    const vault = o.getVault(), lib = o.getOcrLib();
    // ---- PRECHECK ----
    let rep;
    try { if (!pkg || !fs.existsSync(pkg)) return fail("PRECHECK", "Không thấy file gói"); rep = FB.inspect(pkg, vault); } catch (e) { return fail("PRECHECK", "Không đọc được gói: " + (e.message || e)); }
    if (!rep.ok) return fail("PRECHECK", "Gói không đạt kiểm tra (manifest/SHA-256/cấu trúc): " + rep.problems.join("; "), { problems: rep.problems });
    const m = rep.manifest;
    let dataObj; try { dataObj = JSON.parse(rep.dataText); } catch (e) { return fail("PRECHECK", "data.json không đọc được"); }
    if (o.maxSchema != null && Number(dataObj.schemaVersion) > o.maxSchema) return fail("PRECHECK", "Dữ liệu trong gói thuộc phiên bản schema MỚI HƠN (" + dataObj.schemaVersion + " > " + o.maxSchema + ") — hãy cập nhật app");
    if (rep.partial && !opts.acceptPartial) return fail("PRECHECK", "Đây là gói SAO LƯU MỘT PHẦN (thiếu: " + (m.missing || []).map((x) => x.kind + " " + x.id).join(", ") + ") — không phải Full Backup", { needsPartialAck: true, missing: m.missing });
    const conflicts = rep.docs.filter((d) => d.state === "conflict").map((d) => d.id);
    let need = Buffer.byteLength(rep.dataText); (m.documents || []).forEach((d) => { need += Number(d.size) || 0; }); ((m.ocrLibrary && m.ocrLibrary.files) || []).forEach((f) => { need += Number(f.size) || 0; });
    const free = freeBytes(o.userData, o.statfs); if (free != null && free < need * 1.15 + SAFE_MARGIN) return fail("PRECHECK", "Không đủ dung lượng ở thư mục tạm: cần ~" + Math.ceil(need * 1.15 / 1048576) + " MB, còn " + Math.floor(free / 1048576) + " MB");
    const wv = writable(vault.root()); if (wv) return fail("PRECHECK", "Kho chứng từ không ghi được: " + wv);
    const wl = writable(lib.root); if (wl) return fail("PRECHECK", "Thư mục thư viện OCR không ghi được: " + wl);
    ph("PRECHECK", true, "Manifest, SHA-256, schema, dung lượng, quyền ghi: ĐẠT" + (conflicts.length ? " · " + conflicts.length + " chứng từ trùng mã khác nội dung (giữ bản đang có)" : ""));
    // ---- STAGING ----
    try {
      if (fs.existsSync(stagingRoot) && fs.lstatSync(stagingRoot).isSymbolicLink()) return fail("STAGING", "Thư mục tạm là liên kết — từ chối");
      fs.mkdirSync(stagingRoot, { recursive: true }); stageDir = path.join(stagingRoot, rid); fs.mkdirSync(stageDir);
      const realRoot = fs.realpathSync(stagingRoot); if (!fs.realpathSync(stageDir).startsWith(realRoot + path.sep)) return fail("STAGING", "Thư mục tạm nằm ngoài vùng cho phép");
      zip = Z.openZip(pkg);
      const want = [{ p: "manifest.json", sha: null }, { p: m.data.path, sha: m.data.sha256 }];
      (m.documents || []).forEach((d) => { want.push({ p: d.path, sha: d.sha256 }); want.push({ p: "documents/" + d.id + ".json", sha: null }); });
      ((m.ocrLibrary && m.ocrLibrary.files) || []).forEach((f) => want.push({ p: f.path, sha: f.sha256 }));
      for (const w of want) {
        if (!OK_PATH.test(w.p)) return fail("STAGING", "Tên mục không nằm trong danh sách cho phép: " + w.p);
        const e = zip.byName[w.p]; if (!e) return fail("STAGING", "Thiếu mục " + w.p);
        const dest = path.join(stageDir, ...w.p.split("/")); if (!path.resolve(dest).startsWith(path.resolve(stageDir) + path.sep)) return fail("STAGING", "Đường dẫn thoát khỏi thư mục tạm: " + w.p);
        fs.mkdirSync(path.dirname(dest), { recursive: true }); zip.extractTo(e, dest);
        if (w.sha && shaFile(dest) !== w.sha) return fail("STAGING", "Sau giải nén, " + w.p + " sai SHA-256");
      }
    } catch (e) { return fail("STAGING", "Giải nén thất bại: " + (e.message || e)); } finally { if (zip) zip.close(); }
    ph("STAGING", true, "Đã giải nén " + (m.documents || []).length + " chứng từ + " + (((m.ocrLibrary || {}).files) || []).length + " file thư viện OCR ra thư mục tạm, SHA-256 từng file khớp");
    // ---- VERIFY ----
    const warnings = [], counts = m.counts || {};
    Object.keys(counts).forEach((k) => { if (!Array.isArray(dataObj[k]) || dataObj[k].length !== counts[k]) warnings.push("Bảng " + k + ": manifest " + counts[k] + " dòng, data.json " + (Array.isArray(dataObj[k]) ? dataObj[k].length : "không có")); });
    if (warnings.length) return fail("VERIFY", "Số dòng dữ liệu không khớp manifest: " + warnings.join("; "));
    const have = new Set((m.documents || []).map((d) => d.id)), dangling = (Array.isArray(dataObj.chungtu) ? dataObj.chungtu : []).filter((c) => c && c.id && !have.has(c.id)).map((c) => c.id)
      .concat((Array.isArray(dataObj.hdld_tailieu) ? dataObj.hdld_tailieu : []).filter((c) => c && c.DocumentID && c["Trạng thái"] !== "Đã gỡ liên kết" && !have.has(c.DocumentID)).map((c) => c.DocumentID)); // V9.2: tài liệu HĐLĐ đang liên kết phải có file trong gói
    if (dangling.length && !rep.partial) return fail("VERIFY", dangling.length + " liên kết chứng từ trong dữ liệu không có file trong gói: " + dangling.slice(0, 5).join(", "));
    let ocrInfo = null;
    if (m.ocrLibrary) {
      try {
        const tmpStore = require("./ocr-library").createStore(path.join(stageDir, "ocr_library"), { spoolDir: path.join(stageDir, "spool") }), v = tmpStore.verify();
        if (!v.ok) return fail("VERIFY", "Thư viện OCR trong gói hỏng: " + v.bad.length + " ảnh lỗi, " + v.corruptLines + " dòng nhật ký hỏng");
        if (tmpStore.lib.size() !== m.ocrLibrary.samples) return fail("VERIFY", "Số mẫu OCR không khớp manifest (" + tmpStore.lib.size() + " ≠ " + m.ocrLibrary.samples + ")");
        if (m.ocrLibrary.edits != null && tmpStore.lib.edits().length !== m.ocrLibrary.edits) return fail("VERIFY", "Số lần sửa OCR không khớp manifest");
        ocrInfo = { samples: tmpStore.lib.size(), edits: tmpStore.lib.edits().length };
      } catch (e) { return fail("VERIFY", "Không nạp được thư viện OCR trong gói: " + (e.message || e)); }
    }
    const emp = new Set((Array.isArray(dataObj.nhanvien) ? dataObj.nhanvien : []).map((r) => r && r["Mã NV"])), orphan = (Array.isArray(dataObj.chamcong) ? dataObj.chamcong : []).filter((r) => r && r["Mã NV"] && !emp.has(r["Mã NV"])).length;
    if (orphan) warnings.push(orphan + " dòng chấm công có Mã NV không có trong danh sách nhân viên");
    const closed = Array.isArray(dataObj.kyluong) ? dataObj.kyluong.length : 0;
    ph("VERIFY", true, "Số dòng khớp manifest, liên kết chứng từ đủ" + (ocrInfo ? ", thư viện OCR " + ocrInfo.samples + " mẫu / " + ocrInfo.edits + " lần sửa nguyên vẹn" : "") + ", " + closed + " bản ghi kỳ lương");
    staged[rid] = { dir: stageDir, manifest: m, dataSha: sha(Buffer.from(rep.dataText, "utf8")), pkg };
    setJournal({ rid, state: "STAGED", at: new Date().toISOString(), dataSha: staged[rid].dataSha });
    return { ok: true, rid, phases, warnings, conflicts, partial: !!rep.partial, missing: m.missing || [], docs: rep.docs, ocr: ocrInfo, closedPeriods: closed, counts, manifest: { createdAt: m.createdAt, createdBy: m.createdBy, appVersion: m.appVersion, status: m.status || "SUCCESS" }, text: rep.dataText };
  }

  function releaseStage(rid) { const s = staged[rid]; if (s) rmrf(s.dir); delete staged[rid]; }
  /** COMMIT tài sản (chứng từ + thư viện OCR). Lỗi bất kỳ → tự hoàn tác. Khóa ghi giữ cho tới finish()/rollback(). */
  function commitAssets(rid) {
    const s = staged[rid]; if (!s) return { ok: false, error: "Không có phiên khôi phục " + rid + " (hãy kiểm tra gói lại)" };
    if (lock.busy) return { ok: false, error: "Đang có một lần khôi phục khác" };
    const vault = o.getVault(), lib = o.getOcrLib(); lock = { busy: true, rid };
    const before = new Set(vault.list().map((d) => d.id));
    const j = { rid, state: "COMMITTING", at: new Date().toISOString(), dataSha: s.dataSha, candidateDocIds: (s.manifest.documents || []).map((d) => d.id).filter((id) => !before.has(id)), ocrPos: null, newImages: [] };
    try {
      lib.load(); j.ocrPos = lib.pos();
      j.newImages = ((s.manifest.ocrLibrary && s.manifest.ocrLibrary.files) || []).filter((f) => /\.png$/.test(f.path)).map((f) => path.basename(f.path, ".png")).filter((h) => !lib.readImage(h));
      setJournal(j);
      const rd = FB.dirReader(s.dir), d = FB.importDocumentsFrom(rd, vault, { restoreId: rid });
      if (d.failed.length) throw new Error("Không nhập được chứng từ: " + d.failed.slice(0, 3).join("; "));
      const oc = s.manifest.ocrLibrary ? FB.importOcrLibraryFrom(rd, lib) : null;
      j.state = "ASSETS_DONE"; setJournal(j);
      return { ok: true, rid, docs: { added: d.added, same: d.same, conflict: d.conflict }, ocr: oc && { addedSamples: oc.addedSamples, addedEdits: oc.addedEdits, images: oc.images, addedLayouts: oc.addedLayouts } };
    } catch (e) {
      const rb = rollback(rid, j); return { ok: false, rolledBack: rb.ok, error: "Lỗi khi ghi chứng từ/thư viện OCR: " + (e.message || e) + (rb.ok ? " — đã hoàn tác, dữ liệu như cũ" : " — HOÀN TÁC LỖI: " + rb.error) };
    }
  }
  /** Hoàn tác tài sản đã ghi theo nhật ký (chỉ đụng tới đúng thứ lần khôi phục này đã thêm). */
  function rollback(rid, journal) {
    const j = journal || readJournal(); if (!j || j.rid !== rid) return { ok: false, error: "Không có nhật ký khôi phục " + rid };
    try {
      const vault = o.getVault(), lib = o.getOcrLib();
      const dr = vault.rollbackRestore(rid, j.candidateDocIds || []);
      if (j.ocrPos) lib.rollbackTo(j.ocrPos, j.newImages || []);
      j.state = "ROLLED_BACK"; j.rolledBackAt = new Date().toISOString(); setJournal(j);
      releaseStage(rid); if (lock.rid === rid) lock = { busy: false, rid: "" };
      return { ok: true, removedDocs: dr.removed.length };
    } catch (e) { return { ok: false, error: String(e.message || e) }; }
  }
  /** POSTCHECK: mở thử các thành phần của dữ liệu SAU KHI giao diện đã thay dữ liệu lương. */
  function postcheck(rid) {
    const s = staged[rid]; if (!s) return { ok: false, checks: [{ name: "phiên", ok: false, detail: "Không có phiên khôi phục" }] };
    const checks = [], add = (name, ok, detail) => checks.push({ name, ok, detail: detail || "" });
    let live = null;
    try { const ld = o.readData(); if (ld && ld.ok && ld.text) live = JSON.parse(ld.text); } catch (e) { /* ghi bên dưới */ }
    add("đọc lại dữ liệu từ đĩa", !!live, live ? "" : "không đọc được file dữ liệu sau khi ghi");
    if (live) {
      const src = JSON.parse(fs.readFileSync(path.join(s.dir, "data.json"), "utf8")), m = s.manifest;
      if (m.digest) { try { const DD = require("./data-digest"), bad = DD.compare(m.digest, DD.digest(live)); add("nội dung dữ liệu lương (SHA-256 từng bảng + tổng snapshot kỳ chốt)", !bad.length, bad.slice(0, 6).join("; ")); } catch (e) { add("nội dung dữ liệu lương", false, String(e.message || e)); } }
      Object.keys(m.counts || {}).forEach((k) => { if (k === "nhanvien" || k === "chamcong" || k === "kyluong") add("bảng " + k, Array.isArray(live[k]) && live[k].length === m.counts[k], "mong đợi " + m.counts[k] + " dòng"); });
      if ((src.nhanvien || []).length) add("mở hồ sơ nhân viên", (live.nhanvien || []).some((r) => r && r["Mã NV"] === src.nhanvien[0]["Mã NV"]), src.nhanvien[0]["Mã NV"]);
      if ((src.chamcong || []).length) add("mở bảng chấm công", (live.chamcong || []).some((r) => r && r["Mã NV"] === src.chamcong[0]["Mã NV"] && r["Kỳ"] === src.chamcong[0]["Kỳ"]), "kỳ " + src.chamcong[0]["Kỳ"]);
      if ((src.kyluong || []).length) add("mở kỳ lương đã chốt", (live.kyluong || []).length === src.kyluong.length, src.kyluong.length + " bản ghi");
    }
    const m = s.manifest;
    if ((m.documents || []).length) { const d0 = m.documents[0], r = o.getVault().read(d0.id); add("mở chứng từ gốc", !!(r.ok && sha(r.data) === d0.sha256), d0.id); }
    if (m.ocrLibrary && m.ocrLibrary.samples) { const lib = o.getOcrLib(); lib.load(); const sm = lib.lib.list()[0]; add("mở mẫu OCR", !!(sm && lib.readImage(sm.pngSha)), sm ? sm.id : ""); add("mở lịch sử sửa OCR", lib.lib.edits().length >= (m.ocrLibrary.edits || 0), String(lib.lib.edits().length)); }
    return { ok: checks.every((c) => c.ok), checks };
  }
  function finish(rid) { const j = readJournal(); if (j && j.rid === rid) { j.state = "DONE"; j.doneAt = new Date().toISOString(); setJournal(j); } releaseStage(rid); if (lock.rid === rid) lock = { busy: false, rid: "" }; return { ok: true }; }
  /** Khi khởi động: dọn thư mục tạm; phiên dở dang → hoàn tác tài sản (nếu dữ liệu lương CHƯA được thay) hoặc giữ nguyên (đã thay: roll-forward). */
  function recover() {
    const j = readJournal(); let note = "";
    if (j && (j.state === "COMMITTING" || j.state === "ASSETS_DONE")) {
      let swapped = false; try { const ld = o.readData(); swapped = !!(ld && ld.text && sha(Buffer.from(ld.text, "utf8")) === j.dataSha); } catch (e) { /* coi như chưa */ }
      if (swapped && j.state === "ASSETS_DONE") { j.state = "DONE"; setJournal(j); note = "Lần khôi phục " + j.rid + " bị gián đoạn sau khi đã ghi dữ liệu — giữ nguyên kết quả (roll-forward)."; }
      else { const rb = rollback(j.rid, j); note = rb.ok ? "Lần khôi phục " + j.rid + " bị gián đoạn — đã hoàn tác chứng từ/thư viện OCR về trạng thái trước khi khôi phục." : "Lần khôi phục " + j.rid + " bị gián đoạn và hoàn tác lỗi: " + rb.error; }
    }
    try { if (fs.existsSync(stagingRoot)) fs.readdirSync(stagingRoot).forEach((n) => { if (!staged[n]) rmrf(path.join(stagingRoot, n)); }); } catch (e) { /* bỏ qua */ }
    return { note };
  }
  return { stage, commitAssets, rollback: (rid) => rollback(rid), postcheck, finish, recover, discard: (rid) => { releaseStage(rid); return { ok: true }; }, busy: () => lock.busy, journalFile };
}
module.exports = { createRestorer };
