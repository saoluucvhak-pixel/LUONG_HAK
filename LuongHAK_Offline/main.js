const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const os = require("os");
const { createStorage } = require("./main/storage");
const { createExports } = require("./main/exports");
const { createOcrService, sanitizeOcrItems } = require("./main/ocr-service");
const pdfSvc = require("./main/pdf");
const { createVault } = require("./main/documents");
const fullBackup = require("./main/fullbackup");
const { createGuard } = require("./main/ipc-guard");
const { createPolicy, fileSig } = require("./main/write-policy");
const payGate = require("./main/payroll-gate");
const cryptoNode = require("crypto"), fsNode = require("fs");
const PERMCORE = require("./core/permissions.js");
const kdfNode = (pw, salt, iter) => cryptoNode.pbkdf2Sync(String(pw), Buffer.from(String(salt), "hex"), Math.min(Math.max(+iter || 210000, 100000), 2000000), 32, "sha256");
// Danh sách tài khoản ĐỌC TỪ ĐĨA tại tiến trình chính (cache theo mtime+size) — renderer không quyết định quyền
let usersCache = { sig: "", list: [] };
function readUsersFromDisk() {
  try {
    if (!storage) return [];
    const st = fsNode.statSync(storage.dataFile), sig = st.mtimeMs + ":" + st.size;
    if (sig === usersCache.sig) return usersCache.list;
    const ld = storage.load(); if (!ld || !ld.ok || !ld.text) return [];
    const d = JSON.parse(ld.text), list = Array.isArray(d.nguoidung) ? d.nguoidung : [];
    usersCache = { sig, list: list.map((u) => ({ tenDangNhap: u.tenDangNhap, vaiTro: u.vaiTro, khoa: !!u.khoa, salt: u.salt, iter: u.iter, hash: u.hash })) };
    return usersCache.list;
  } catch (e) { return usersCache.list; }
}
function readRecoveryFromDisk() {
  try {
    if (!storage) return null;
    const ld = storage.load(); if (!ld || !ld.ok || !ld.text) return null;
    const rec = (JSON.parse(ld.text).baomat || [])[0], k = rec && rec.khoiPhuc;
    return k && k.hash ? { salt: k.salt, iter: k.iter, hash: k.hash } : null;
  } catch (e) { return null; }
}
const guard = createGuard(__dirname, {
  readUsers: readUsersFromDisk, readRecovery: readRecoveryFromDisk,
  rolePerms: (role) => (PERMCORE.ROLES[role] ? PERMCORE.ROLES[role].perms.slice() : []),
  verify: (pw, u) => { try { const a = kdfNode(pw, u.salt, u.iter), b = Buffer.from(String(u.hash), "hex"); return b.length === a.length && cryptoNode.timingSafeEqual(a, b); } catch (e) { return false; } }
});

// Dữ liệu: %APPDATA%\Tinh Luong HAK\data.json — sao lưu trong thư mục backups (xem main/storage.js).
// Gỡ cài đặt KHÔNG xóa thư mục này (electron-builder: deleteAppDataOnUninstall mặc định false).
let fbJob = null; // Full Backup đang chạy (worker)
let storage = null, exportsDir = null, ocr = null, vault = null, ocrLib = null, restorer = null;
const ocrSvc = () => ocr || (ocr = createOcrService({ appDir: __dirname })); // nạp Tesseract khi dùng lần đầu
const NO_SHELL = !!process.env.HAK_NO_SHELL; // kiểm thử tự động: không mở Explorer thật, chỉ ghi lại thao tác
let lastShell = null;
function shellDo(kind, f) { lastShell = { kind, name: path.basename(f) }; if (NO_SHELL) return; if (kind === "show") shell.showItemInFolder(f); else shell.openPath(f); }

// Kiểm thử tự động có thể chỉ định thư mục dữ liệu riêng (không đụng dữ liệu thật)
if (process.env.HAK_USER_DATA) app.setPath("userData", process.env.HAK_USER_DATA);

// Windows: gom cửa sổ / thông báo / ghim thanh tác vụ đúng với shortcut của bộ cài (cùng appId)
if (process.platform === "win32") app.setAppUserModelId("vn.hak.luong");

// Chỉ cho chạy 1 cửa sổ app: 2 bản cùng ghi 1 file dữ liệu sẽ ghi đè lẫn nhau.
if (!app.requestSingleInstanceLock()) { app.quit(); }

function registerIpc() {
  // Mọi lệnh đồng bộ (ipcMain.on) chỉ nhận từ đúng trang index.html của app; nguồn lạ nhận null/false, không chạm dữ liệu
  const _on = ipcMain.on.bind(ipcMain);
  ipcMain.on = (ch, fn) => _on(ch, (e, ...a) => { if (!guard.trusted(e)) { e.returnValue = null; return; } return fn(e, ...a); });
  // Mọi lệnh bất đồng bộ (ipcMain.handle) cũng phải đúng nguồn (lớp dưới guarded: thêm đăng nhập + quyền)
  const _handle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (ch, fn) => _handle(ch, (e, ...a) => (guard.trusted(e) ? fn(e, ...a) : { ok: false, error: "Nguồn lệnh không hợp lệ" }));
  // Lệnh nhạy cảm: kiểm nguồn + đăng nhập + quyền trước khi chạy
  const wl = (fn) => async (e, ...a) => (fbJob ? { ok: false, error: "Đang sao lưu Full Backup — chờ sao lưu xong (hoặc bấm Hủy) rồi thử lại" } : restorer && restorer.busy() ? { ok: false, error: "Đang khôi phục dữ liệu — vui lòng chờ khôi phục kết thúc rồi thử lại" } : fn(e, ...a)); // khóa ghi trong lúc COMMIT khôi phục
  const guardedW = (perm, fn) => guarded(perm, wl(fn)); // lệnh GHI: bị chặn trong lúc COMMIT khôi phục
  const guarded = (perm, fn) => async (e, ...a) => { const d = guard.deny(e, perm); return d ? { ok: false, error: d, problems: [d] } : fn(e, ...a); };
  // V9: phiên do TIẾN TRÌNH CHÍNH tạo sau khi tự kiểm mật khẩu với tài khoản trên đĩa; renderer không gửi được danh sách quyền
  ipcMain.on("auth-login", (e, name, pw) => { e.returnValue = guard.login(e, name, pw); });
  ipcMain.on("auth-logout", (e) => { e.returnValue = guard.logout(e); });
  // V10.1: main tự xác minh mã khôi phục Admin, cấp phiên khôi phục ngắn hạn (1 tài khoản, 1 lần ghi) — policy chỉ chấp nhận đặt lại Admin khi có phiên này
  ipcMain.on("auth-recover", (e, code, name) => { try { e.returnValue = guard.recover(e, code, name); } catch (err) { e.returnValue = { ok: false, error: "Lỗi xác minh mã khôi phục" }; } });
  ipcMain.on("auth-state", (e) => { const c = guard.trusted(e) ? guard.current(e) : null; e.returnValue = c ? { ok: true, user: c.user, role: c.role, perms: c.perms } : { ok: false }; });
  ipcMain.on("store-load", (e) => { e.returnValue = storage.load(); });
  // V9.2: main so với bản đang lưu, tìm bảng thay đổi và kiểm quyền THEO PHIÊN ĐĂNG NHẬP CỦA MAIN (không tin renderer); chốt kỳ được tính lại để chặn lỗi
  let wpol = null;
  const policy = () => wpol || (wpol = createPolicy({ readText: () => { const l = storage.load(); return l && l.ok ? l.text : null; }, sigOf: fileSig(storage.dataFile), gate: payGate }));
  ipcMain.on("store-save", (e, text) => {
    try {
      const c = guard.current(e), who = c ? { user: c.user, perms: c.perms } : null;
      const rcv = guard.recoveryFor(e);
      const v = policy().check(text, who, { restoring: !!(restorer && restorer.busy()), recovery: rcv });
      if (!v.ok) { if (process.env.HAK_DEBUG_POLICY) require("fs").appendFileSync(process.env.HAK_DEBUG_POLICY, v.error + "\n"); e.returnValue = v.error; return; }
      const r = storage.save(text);
      if (r === true) { policy().commit(); if (rcv && !who) guard.recoveryDone(e); }
      if (c && c.touch) c.touch();
      e.returnValue = r;
    } catch (err) { e.returnValue = "Lỗi kiểm tra quyền ghi: " + String(err && err.message || err); }
  });
  ipcMain.on("store-info", (e) => { e.returnValue = storage.info(); });
  ipcMain.on("store-backup", (e, tag) => { try { e.returnValue = storage.backup(tag); } catch (err) { e.returnValue = null; } });
  ipcMain.on("store-has-data-file", (e) => { try { e.returnValue = storage.hasDataFile(); } catch (err) { e.returnValue = false; } });
  ipcMain.on("store-list", (e) => { try { e.returnValue = storage.list(); } catch (err) { e.returnValue = []; } });
  ipcMain.on("store-verify", (e) => { try { e.returnValue = storage.verifyAll(); } catch (err) { e.returnValue = []; } });
  ipcMain.on("store-read", (e, name) => { try { e.returnValue = storage.readBackup(name); } catch (err) { e.returnValue = { ok: false, error: String(err.message || err) }; } });
  ipcMain.on("store-quarantine", (e) => { try { e.returnValue = storage.quarantineCorrupt(); } catch (err) { e.returnValue = null; } });
  // Xuất PDF báo cáo: giao diện gửi HTML (đã escape) + TÊN file; đường dẫn lưu do tiến trình chính quyết (thư mục xuất, không ghi đè)
  ipcMain.handle("report-pdf", guarded("export", async (e, payload) => {
    try {
      const bad = pdfSvc.validate(payload); if (bad) return { ok: false, error: bad };
      // V10.1: PDF bảng lương cũng bị kiểm tra như file tải về (trước đây PDF không đi qua gate)
      const chk = payGate.checkExport(String(payload.name || ""), () => { const ld = storage.load(); if (!ld || !ld.ok || !ld.text) throw new Error("no data"); return JSON.parse(ld.text); });
      if (!chk.ok) return { ok: false, error: "⛔ " + chk.message, code: chk.code, blocked: chk.blocked };
      const buf = await pdfSvc.renderPdf({ BrowserWindow }, payload);
      let name = exportsDir.cleanName(payload.name || "BaoCao"); if (!/\.pdf$/i.test(name)) name = name.replace(/\.[^.]*$/, "") + ".pdf";
      const f = exportsDir.target(name); require("fs").writeFileSync(f, buf);
      const opened = exportsDir.openAfter(); if (opened) shellDo("show", f);
      return { ok: true, name: path.basename(f), dir: path.dirname(f), size: buf.length, pages: pdfSvc.countPages(buf), opened };
    } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
  }));
  // Thư viện mẫu OCR (V7): ghi tự động khi người dùng sửa ô; quản lý (duyệt/từ chối/đổi nhãn) cần quyền ocr.library. Không có thao tác xóa mẫu.
  const olWrap = (fn) => async (e, ...a) => { try { return Object.assign({ ok: true }, await fn(...a)); } catch (err) { return { ok: false, error: String(err && err.message || err) }; } };
  // V9: tên người thực hiện do MAIN lấy từ phiên đã xác thực — không tin `user` renderer gửi lên
  const olWrapU = (fn) => async (e, ...a) => { try { return Object.assign({ ok: true }, await fn(guard.userOf(e), ...a)); } catch (err) { return { ok: false, error: String(err && err.message || err) }; } };
  const olStrip = (s) => { const o = Object.assign({}, s); delete o.vec; delete o.coarse; return o; };
  ipcMain.handle("ocrlib-record", guardedW("input.edit", olWrapU((user, p) => { const r = ocrLib.recordSpooled(Object.assign({}, p || {}, { user })); return { sampleId: r.sampleId, note: r.note || "", duplicate: !!r.duplicate, missingSource: !!r.missingSource }; })));
  ipcMain.handle("ocrlib-spool-put", guardedW("input.edit", olWrapU((user, p) => ocrLib.spoolPut(Object.assign({}, p || {}, { user })))));
  ipcMain.handle("ocrlib-spool-list", guarded("input.edit", olWrap(() => ({ items: ocrLib.spoolList() }))));
  ipcMain.handle("ocrlib-spool-remove", guarded("input.edit", olWrap((txId) => ({ removed: ocrLib.spoolRemove(String(txId || "")) }))));
  ipcMain.handle("ocrlib-confirm", guardedW("input.edit", olWrapU((user, p) => { const r = ocrLib.confirm(Object.assign({}, p || {}, { user })); return { sampleId: r.sampleId }; })));
  ipcMain.handle("ocrlib-approve", guardedW("input.edit", olWrapU((user, q) => { const r = ocrLib.approve(Object.assign({}, q || {}, { user })); return { verified: r.verified, conflict: r.conflict, skippedMismatch: r.skippedMismatch, skippedNotAssigned: r.skippedNotAssigned, skippedUnknownKind: r.skippedUnknownKind, skippedLayout: r.skippedLayout }; })));
  ipcMain.handle("ocrlib-undo", guardedW("input.edit", olWrapU((user, key) => { ocrLib.undoCell(String(key || ""), user); return {}; })));
  ipcMain.handle("ocrlib-lookup", guarded("input.view", olWrap((items) => ({ results: ocrLib.lookup(Array.isArray(items) ? items : []).map((r) => ({ status: r.status, label: r.label, score: r.score, consensus: r.consensus, reason: r.reason, top: (r.top || []).slice(0, 5) })) }))));
  ipcMain.handle("ocrlib-list", guarded("input.view", olWrap((f) => { ocrLib.load(); return { samples: ocrLib.lib.list(f || {}).map((x) => Object.assign(olStrip(x), { uses: ocrLib.lib.refsOf(x.id) })), stats: ocrLib.lib.stats(), confusions: ocrLib.lib.confusions() }; })));
  ipcMain.handle("ocrlib-edits", guarded("input.view", olWrap(() => { ocrLib.load(); return { edits: ocrLib.lib.edits() }; })));
  ipcMain.handle("ocrlib-image", guarded("input.view", olWrap((sha) => { const b = ocrLib.readImage(String(sha || "")); return b ? { data: new Uint8Array(b) } : { ok: false, error: "không có ảnh" }; })));
  ipcMain.handle("ocrlib-set-status", guardedW("ocr.library", olWrapU((user, id, st, _u, reason) => { ocrLib.setStatus(String(id), String(st), user, reason); return {}; })));
  ipcMain.handle("ocrlib-relabel", guardedW("ocr.library", olWrapU((user, id, label, kind, _u, reason) => { ocrLib.relabel(String(id), label, kind, user, reason); return {}; })));
  ipcMain.handle("ocrlib-layouts", guarded("input.view", olWrap(() => ({ layouts: ocrLib.layouts().map((l) => { const o = Object.assign({}, l); delete o.sig; return o; }) }))));
  ipcMain.handle("ocrlib-layout-match", guarded("input.view", olWrap((sig) => ({ match: ocrLib.layoutMatch(sig) }))));
  ipcMain.handle("ocrlib-layout-save", guarded("input.edit", olWrapU((user, sig, name) => ocrLib.layoutSave(sig, name, user))));
  ipcMain.handle("ocrlib-verify", guarded("input.view", olWrap(() => ({ report: ocrLib.verify() }))));
  // Kho chứng từ gốc (GĐ4): chỉ THÊM / ĐỌC / KIỂM TRA — không có thao tác xóa. Giao diện chỉ dùng DocumentID, không truyền đường dẫn.
  const toBuf = (d) => d instanceof ArrayBuffer ? Buffer.from(d) : ArrayBuffer.isView(d) ? Buffer.from(d.buffer, d.byteOffset, d.byteLength) : null;
  // V9.2: tài liệu HĐLĐ (docType HDLD) là hồ sơ nhân sự → thêm cần hr.edit, xem/mở/liệt kê cần hr.view; chứng từ chấm công giữ input.edit / input.view
  const isHdld = (m) => !!(m && m.docType === "HDLD");
  ipcMain.handle("doc-add", guardedW(null, async (e, data, info) => {
    try {
      const hd = info && typeof info === "object" && String(info.docType || "").toUpperCase() === "HDLD", d = guard.deny(e, hd ? "hr.edit" : "input.edit");
      if (d) return { ok: false, error: d };
      const b = toBuf(data); if (!b) return { ok: false, error: "Dữ liệu chứng từ không hợp lệ" }; if (b.length > 300 * 1024 * 1024) return { ok: false, error: "Chứng từ quá lớn (tối đa 300 MB)" };
      return vault.add(b, Object.assign({}, info && typeof info === "object" ? info : {}, { user: guard.userOf(e) }));
    }
    catch (err) { return { ok: false, error: String(err && err.message || err) }; }
  }));
  ipcMain.handle("doc-list", guarded(null, async (e) => { try { const hv = !guard.deny(e, "hr.view"), iv = !guard.deny(e, "input.view"); if (!hv && !iv) return { ok: false, error: "Bạn không có quyền xem chứng từ" }; return { ok: true, docs: vault.list().filter((m) => (isHdld(m) ? hv : iv)) }; } catch (err) { return { ok: false, error: String(err.message || err) }; } }));
  ipcMain.handle("doc-read", guarded(null, async (e, id) => { try { const m = vault.find(String(id || "")), d = guard.deny(e, isHdld(m) ? "hr.view" : "input.view"); if (d) return { ok: false, error: d }; const r = vault.read(String(id || "")); return r.ok ? { ok: true, meta: r.meta, data: r.data } : r; } catch (err) { return { ok: false, error: String(err.message || err) }; } }));
  ipcMain.handle("doc-verify", guarded(null, async (e, ids) => { try { const hv = !guard.deny(e, "hr.view"), iv = !guard.deny(e, "input.view"); if (!hv && !iv) return { ok: false, error: "Bạn không có quyền xem chứng từ" }; const items = vault.verify(Array.isArray(ids) ? ids.map(String) : undefined); return { ok: true, items: items.filter((x) => (isHdld(vault.find(x.id)) ? hv : iv)) }; } catch (err) { return { ok: false, error: String(err.message || err) }; } }));
  ipcMain.on("doc-open", (e, id) => { const m = vault.find(String(id || "")); if (guard.deny(e, isHdld(m) ? "hr.view" : "input.view")) { e.returnValue = false; return; } const f = vault.pathOf(String(id || "")); if (f) shellDo("open", f); e.returnValue = !!f; });
  // Full Backup / Restore (GĐ5): gói ZIP = dữ liệu + chứng từ gốc + manifest SHA-256. Giao diện không truyền đường dẫn:
  // tạo vào thư mục xuất (và chép sang thư mục sao lưu thứ hai nếu có); đọc gói qua hộp thoại chọn file hoặc theo TÊN trong thư mục xuất.
  // Thư mục Full Backup chính: cấu hình `backupDir` (Cài đặt → Lưu trữ) hoặc thư mục xuất file
  const fbDir = () => { const d = storage.readSettings().backupDir; return d || exportsDir.dir(); };
  const fbList = () => { const d = storage.readSettings().backupDir; if (!d) return exportsDir.list(500); try { return require("fs").readdirSync(d).filter((n) => /^LuongHAK_FullBackup_.*\.zip(\.hakenc)?$/i.test(n)).map((n) => { const st = require("fs").statSync(path.join(d, n)); return { name: n, size: st.size, mtime: st.mtime.toISOString() }; }); } catch (e) { return []; } };
  const fbResolve = (name) => { const d = storage.readSettings().backupDir; if (!d) return exportsDir.resolve(name) || ""; const f = path.join(d, path.basename(name)); return require("fs").existsSync(f) ? f : ""; };
  // Cài đặt lưu trữ: 4 thư mục (chứng từ gốc, thư viện mẫu OCR, sao lưu chính, sao lưu dự phòng). Chuyển = chép + kiểm SHA-256, KHÔNG xóa nguồn.
  const SP = require("./main/storage-paths");
  const spCur = () => SP.resolve(app.getPath("userData"), storage.readSettings(), exportsDir.dir());
  ipcMain.handle("paths-get", guarded("backup.restore", async () => ({ ok: true, paths: spCur(), defaults: SP.defaults(app.getPath("userData"), exportsDir.dir()), labels: SP.LABEL, custom: Object.fromEntries(SP.KINDS.map((k) => [k, !!storage.readSettings()[SP.KEY[k]]])) })));
  ipcMain.handle("paths-pick", guarded("backup.restore", async (e, kind) => {
    if (process.env.HAK_PICK_DIR) return { ok: true, dir: process.env.HAK_PICK_DIR };
    const r = dialog.showOpenDialogSync(BrowserWindow.fromWebContents(e.sender), { title: "Chọn thư mục: " + (SP.LABEL[kind] || ""), properties: ["openDirectory", "createDirectory"] });
    return r && r[0] ? { ok: true, dir: r[0] } : { ok: false, cancelled: true };
  }));
  // Quản lý 5 thư mục: mở / dung lượng / kiểm tra toàn vẹn (chỉ đọc)
  const spKinds = SP.KINDS.concat(["export"]);
  ipcMain.handle("paths-info", guarded("backup.restore", async () => { const p = spCur(), out = {}; SP.KINDS.forEach((k) => { out[k] = p[k] ? SP.info(p[k]) : { exists: false, files: 0, bytes: 0, free: null }; }); out.export = SP.info(exportsDir.dir()); return { ok: true, info: out, exportDir: exportsDir.dir() }; }));
  ipcMain.handle("paths-open", guarded("backup.restore", async (e, kind) => { const k = String(kind); if (spKinds.indexOf(k) < 0) return { ok: false, error: "loại thư mục không hợp lệ" }; const d = k === "export" ? exportsDir.dir() : spCur()[k]; if (!d || !require("fs").existsSync(d)) return { ok: false, error: "Thư mục chưa tồn tại" }; if (process.env.HAK_NO_SHELL) return { ok: true, dir: d }; const er = await shell.openPath(d); return er ? { ok: false, error: er } : { ok: true, dir: d }; }));
  ipcMain.handle("paths-verify", guarded("backup.restore", async (e, kind) => {
    try {
      const k = String(kind), p = spCur();
      if (k === "docs") { const v = vault.verify(), bad = v.filter((x) => x.status !== "ok"); return { ok: true, good: bad.length === 0, total: v.length, bad: bad.slice(0, 20), text: v.length - bad.length + "/" + v.length + " chứng từ nguyên vẹn (SHA-256)" }; }
      if (k === "ocrLib") { const v = ocrLib.verify(); return { ok: true, good: v.ok, total: v.samples, bad: v.bad.slice(0, 20), text: (v.samples - v.bad.length) + "/" + v.samples + " mẫu có ảnh nguyên vẹn" + (v.corruptLines ? ", " + v.corruptLines + " dòng nhật ký hỏng" : "") }; }
      if (k === "backup" || k === "export") { const d = k === "export" ? exportsDir.dir() : p.backup, fs2 = require("fs"); const zips = fs2.existsSync(d) ? fs2.readdirSync(d).filter((n) => /^LuongHAK_(Full|Partial)Backup_.*\.zip$/i.test(n)) : []; return { ok: true, good: true, total: zips.length, text: zips.length + " gói sao lưu trong thư mục" }; }
      if (k === "mirror") { if (!p.mirror) return { ok: true, good: true, total: 0, text: "Chưa chọn thư mục sao lưu dự phòng" }; const bad = require("./main/storage-paths").validate("mirror", p.mirror, Object.assign({}, p, { mirror: "" })); return { ok: true, good: !bad, total: 0, text: bad ? "Không dùng được: " + bad : "Ghi được, không lồng thư mục khác" }; }
      return { ok: false, error: "loại thư mục không hợp lệ" };
    } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
  }));
  ipcMain.handle("paths-move", guardedW("backup.restore", async (e, kind, dir) => {
    try {
      return SP.move({ kind: String(kind), dir: String(dir || ""), userData: app.getPath("userData"), settings: storage.readSettings(), exportsDir: exportsDir.dir(), writeSettings: storage.writeSettings,
        verifyStore: (k, d) => { // mở thử kho ở thư mục MỚI trước khi đổi cấu hình
          if (k === "docs") { const bad = createVault(d).verify().filter((x) => x.status !== "ok"); return bad.length ? bad.length + " chứng từ lỗi/mất" : ""; }
          if (k === "ocrLib") { const v = require("./main/ocr-library").createStore(d, { spoolDir: path.join(require("os").tmpdir(), "hak-verify-spool") }).verify(); return v.ok ? "" : v.bad.length + " ảnh mẫu lỗi, " + v.corruptLines + " dòng nhật ký hỏng"; }
          return "";
        },
        onApplied: (n) => { if (kind === "docs") vault = createVault(n.docs); else if (kind === "ocrLib") ocrLib = require("./main/ocr-library").createStore(n.ocrLib, { spoolDir: path.join(app.getPath("userData"), "ocr-spool") }); } });
    } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
  }));
  // V9: Full Backup chạy trong worker_thread (không treo giao diện), có tiến độ + nút Hủy; trong lúc chạy các lệnh GHI chứng từ/thư viện OCR bị khóa → gói nhất quán
  ipcMain.handle("fb-create", guardedW("backup.restore", async (e, info) => {
    if (fbJob) return { ok: false, error: "Đang có một lần Full Backup khác chạy — chờ nó kết thúc hoặc bấm Hủy" };
    const bcrypt = require("./main/backup-crypt"), pwd = info && info.password ? String(info.password) : "";
    if (pwd) { const bad = bcrypt.checkPassword(pwd); if (bad) return { ok: false, error: bad }; }
    try {
      const ld = storage.load(); if (!ld.ok || !ld.text) return { ok: false, error: ld.error || "Chưa có file dữ liệu để sao lưu" };
      const sp = spCur(), sender = e.sender;
      fbJob = require("./main/fullbackup-worker").run({ dataText: ld.text, docsDir: sp.docs, ocrDir: sp.ocrLib, spoolDir: path.join(app.getPath("userData"), "ocr-spool"), destDir: fbDir(), appVersion: app.getVersion(), user: guard.userOf(e), allowPartial: !!(info && info.allowPartial === true),
        restoreConfig: { note: "đường dẫn thư mục là của máy gốc; khi khôi phục sang máy khác dùng thư mục mặc định hoặc chọn lại", customPaths: Object.keys(storage.readSettings()).filter((k) => /Dir$/.test(k)) } },
      (m) => { try { if (!sender.isDestroyed()) sender.send("fb-progress", m); } catch (x) { /* cửa sổ đã đóng */ } });
      const r = await fbJob.promise; fbJob = null;
      if (!r.file) return r; // FAILED / CANCELLED: không có gói
      if (pwd) { // V10.1: bọc mã hóa AES-256-GCM; chỉ xóa bản rõ SAU KHI bản mã hóa giải mã thử khớp SHA-256 bản rõ
        const fsx = require("fs"), fsp0 = fsx.promises, plain = r.file, encF = plain + ".hakenc", chk = encF + ".verify";
        try {
          const en = await bcrypt.encryptFile(plain, encF, pwd, { onProgress: (p) => { try { if (!sender.isDestroyed()) sender.send("fb-progress", "Mã hóa gói sao lưu… " + Math.round(p * 100) + "%"); } catch (x) { /* cửa sổ đã đóng */ } } });
          if (!en.ok) throw new Error(en.error);
          const de = await bcrypt.decryptFile(encF, chk, pwd); if (!de.ok) throw new Error("Giải mã thử thất bại: " + de.error);
          const h = (f) => require("crypto").createHash("sha256").update(fsx.readFileSync(f)).digest("hex");
          const same = h(chk) === r.sha256; try { await fsp0.unlink(chk); } catch (x) { /* đã xóa */ }
          if (!same) throw new Error("Bản giải mã thử không khớp SHA-256 bản gốc");
          await fsp0.writeFile(encF + ".sha256", en.sha256 + "  " + path.basename(encF) + "\n");
          await fsp0.unlink(plain); try { await fsp0.unlink(plain + ".sha256"); } catch (x) { /* không có */ }
          r.file = encF; r.name = path.basename(encF); r.size = en.size; r.sha256 = en.sha256; r.encrypted = true;
        } catch (err) {
          try { await fsp0.unlink(encF); } catch (x) { /* chưa tạo */ } try { await fsp0.unlink(chk); } catch (x) { /* chưa tạo */ } try { await fsp0.unlink(encF + ".sha256"); } catch (x) { /* chưa tạo */ }
          (r.warnings = r.warnings || []).push("KHÔNG mã hóa được (" + (err.message || err) + ") — gói giữ nguyên dạng KHÔNG mã hóa: " + path.basename(plain));
        }
      }
      let mirrored = "";
      try { const md = storage.readSettings().mirrorDir; if (md) { const t = path.join(md, "FullBackup"), fsp = require("fs").promises; await fsp.mkdir(t, { recursive: true }); await fsp.copyFile(r.file, path.join(t, r.name)); await fsp.copyFile(r.file + ".sha256", path.join(t, r.name + ".sha256")); mirrored = t; } } catch (err) { r.warnings.push("Không chép được sang thư mục sao lưu thứ hai: " + (err.message || err)); }
      return { ok: r.ok, status: r.status, partial: !!r.partial, missing: r.missing, name: r.name, dir: path.dirname(r.file), size: r.size, sha256: r.sha256, docs: r.docs, ocrSamples: r.ocrSamples, warnings: r.warnings, mirrored, encrypted: !!r.encrypted };
    } catch (err) { fbJob = null; return { ok: false, error: String(err && err.message || err) }; }
  }));
  ipcMain.handle("fb-cancel", guarded("backup.restore", async () => { if (!fbJob) return { ok: false, error: "Không có Full Backup đang chạy" }; fbJob.cancel(); return { ok: true }; }));
  ipcMain.handle("fb-list", guarded("backup.restore", async () => { try { return { ok: true, files: fbList().filter((f) => /^LuongHAK_FullBackup_.*\.zip(\.hakenc)?$/i.test(f.name)).map((f) => Object.assign({}, f, { encrypted: /\.hakenc$/i.test(f.name) })) }; } catch (err) { return { ok: false, error: String(err.message || err) }; } }));
  // Gói mã hóa (.hakenc): giải mã vào thư mục tạm riêng, chạy fn(đường dẫn zip), LUÔN xóa bản giải mã khi xong (kể cả lỗi)
  const withPlain = async (f, password, fn) => {
    const bcrypt = require("./main/backup-crypt");
    if (!bcrypt.isEnc(f)) return fn(f);
    if (!password) return { ok: false, needPassword: true, error: "Gói được mã hóa — nhập mật khẩu", problems: ["Gói được mã hóa — nhập mật khẩu"], phases: [] };
    const fsx = require("fs"), base = path.join(app.getPath("userData"), "restore-tmp"); fsx.mkdirSync(base, { recursive: true });
    const d = fsx.mkdtempSync(path.join(base, "d-"));
    try {
      const out = path.join(d, "plain.zip"), de = await bcrypt.decryptFile(f, out, String(password));
      if (!de.ok) { const m = de.code === "AUTH" ? "Sai mật khẩu hoặc gói đã bị sửa" : de.error; return { ok: false, wrongPassword: de.code === "AUTH", error: m, problems: [m], phases: [] }; }
      return await fn(out);
    } finally { try { fsx.rmSync(d, { recursive: true, force: true }); } catch (x) { /* dọn lần sau */ } }
  };
  ipcMain.handle("fb-inspect", guarded("backup.restore", async (e, name, password) => {
    try {
      let f = "";
      if (name) { f = fbResolve(String(name)); if (!/\.zip(\.hakenc)?$/i.test(f)) return { ok: false, problems: ["Không tìm thấy gói trong thư mục xuất"] }; }
      else if (process.env.HAK_FB_PICK) f = process.env.HAK_FB_PICK;
      else { const r = dialog.showOpenDialogSync(BrowserWindow.fromWebContents(e.sender), { title: "Chọn gói Full Backup (.zip / .hakenc)", filters: [{ name: "Gói sao lưu", extensions: ["zip", "hakenc"] }], properties: ["openFile"] }); if (!r || !r[0]) return { ok: false, cancelled: true }; f = r[0]; }
      return await withPlain(f, password, async (pf) => { const rep = fullBackup.inspect(pf, vault);
      return { ok: rep.ok, problems: rep.problems, label: path.basename(f), manifest: rep.manifest && { createdAt: rep.manifest.createdAt, createdBy: rep.manifest.createdBy, appVersion: rep.manifest.appVersion, warnings: rep.manifest.warnings }, docs: rep.docs, ocrSamples: rep.ocrSamples || 0, text: rep.ok ? rep.dataText : null, encrypted: pf !== f }; });
    } catch (err) { return { ok: false, problems: [String(err && err.message || err)] }; }
  }));
  // Khôi phục Full Backup theo giao dịch (V8): stage (PRECHECK→STAGING→VERIFY) → commit tài sản → [giao diện thay dữ liệu] → postcheck → finish | rollback
  ipcMain.handle("rs-stage", guarded("backup.restore", async (e, opt) => {
    try {
      opt = opt || {}; let f = "";
      if (opt.name) { f = fbResolve(String(opt.name)); if (!/\.zip(\.hakenc)?$/i.test(f)) return { ok: false, error: "Không tìm thấy gói trong thư mục xuất" }; }
      else if (process.env.HAK_FB_PICK) f = process.env.HAK_FB_PICK;
      else { const r = dialog.showOpenDialogSync(BrowserWindow.fromWebContents(e.sender), { title: "Chọn gói Full Backup (.zip / .hakenc)", filters: [{ name: "Gói sao lưu", extensions: ["zip", "hakenc"] }], properties: ["openFile"] }); if (!r || !r[0]) return { ok: false, cancelled: true }; f = r[0]; }
      return await withPlain(f, opt.password, async (pf) => { const r = restorer.stage(pf, { acceptPartial: opt.acceptPartial === true }); r.label = path.basename(f); return r; });
    } catch (err) { return { ok: false, error: String(err && err.message || err), phases: [] }; }
  }));
  ipcMain.handle("rs-commit", guarded("backup.restore", async (e, rid) => { try { return restorer.commitAssets(String(rid || "")); } catch (err) { return { ok: false, error: String(err && err.message || err) }; } }));
  ipcMain.handle("rs-postcheck", guarded("backup.restore", async (e, rid) => { try { return restorer.postcheck(String(rid || "")); } catch (err) { return { ok: false, checks: [{ name: "postcheck", ok: false, detail: String(err && err.message || err) }] }; } }));
  ipcMain.handle("rs-rollback", guarded("backup.restore", async (e, rid) => { try { return restorer.rollback(String(rid || "")); } catch (err) { return { ok: false, error: String(err && err.message || err) }; } }));
  ipcMain.handle("rs-finish", guarded("backup.restore", async (e, rid) => { try { return restorer.finish(String(rid || "")); } catch (err) { return { ok: false, error: String(err && err.message || err) }; } }));
  ipcMain.handle("rs-discard", guarded("backup.restore", async (e, rid) => { try { return restorer.discard(String(rid || "")); } catch (err) { return { ok: false, error: String(err && err.message || err) }; } }));
  ipcMain.on("open-data-folder", () => { shell.openPath(path.dirname(storage.dataFile)); });
  // File xuất (2.0-α16): giao diện chỉ gửi TÊN file — đường dẫn ghép trong thư mục xuất (main/exports.js)
  // OCR bảng chấm công (α20): giao diện gửi ẢNH Ô đã cắt (xám, nhỏ) — không gửi đường dẫn file; chạy offline
  ipcMain.handle("ocr-batch", guarded("input.edit", async (e, items) => {
    if (!Array.isArray(items) || items.length > 5000) throw new Error("Lô OCR không hợp lệ");
    return ocrSvc().batch(sanitizeOcrItems(items)); // ô sai kích thước → kết quả rỗng ĐÚNG VỊ TRÍ (không làm lệch thứ tự)
  }));
  ipcMain.handle("ocr-selftest", async () => { try { return await ocrSvc().selfTest(); } catch (err) { return { ok: false, error: String(err.message || err) }; } });
  // Lịch sao lưu (α17) — cấu hình của máy này (settings.json)
  ipcMain.on("backup-schedule-get", (e) => { try { e.returnValue = Object.assign({ ok: true }, storage.getSchedule()); } catch (err) { e.returnValue = { ok: false, error: String(err.message || err) }; } });
  ipcMain.on("backup-schedule-set", (e, o) => { try { e.returnValue = storage.setSchedule(o && typeof o === "object" ? { everyHours: o.everyHours, onClose: o.onClose, keepDaily: o.keepDaily } : {}); } catch (err) { e.returnValue = { ok: false, error: String(err.message || err) }; } });
  ipcMain.on("files-info", (e) => { try { e.returnValue = { ok: true, dir: exportsDir.dir(), openAfterDownload: exportsDir.openAfter(), files: exportsDir.list(100), lastShell }; } catch (err) { e.returnValue = { ok: false, error: String(err.message || err) }; } });
  ipcMain.on("files-open", (e, name) => { const f = exportsDir.resolve(name); if (f) shellDo("open", f); e.returnValue = !!f; });
  ipcMain.on("files-show", (e, name) => { const f = exportsDir.resolve(name); if (f) shellDo("show", f); e.returnValue = !!f; });
  ipcMain.on("files-open-dir", (e) => { try { const d = exportsDir.dir(); require("fs").mkdirSync(d, { recursive: true }); shellDo("open", d); e.returnValue = true; } catch (err) { e.returnValue = false; } });
  ipcMain.on("files-choose-dir", (e) => {
    try {
      const w = BrowserWindow.fromWebContents(e.sender);
      const r = dialog.showOpenDialogSync(w, { title: "Chọn thư mục lưu file Excel / báo cáo", defaultPath: exportsDir.dir(), properties: ["openDirectory", "createDirectory"] });
      e.returnValue = r && r[0] ? exportsDir.setDir(r[0]) : { ok: false, cancelled: true };
    } catch (err) { e.returnValue = { ok: false, error: String(err.message || err) }; }
  });
  ipcMain.on("files-reset-dir", (e) => { try { e.returnValue = exportsDir.setDir(null); } catch (err) { e.returnValue = { ok: false, error: String(err.message || err) }; } });
  ipcMain.on("files-open-after", (e, on) => { try { e.returnValue = exportsDir.setOpenAfter(on); } catch (err) { e.returnValue = { ok: false }; } });
  // Thư mục sao lưu thứ hai: người dùng CHỌN bằng hộp thoại của Windows ở tiến trình chính (giao diện không gửi đường dẫn tùy ý)
  ipcMain.on("backup-mirror-choose", (e) => {
    try {
      const w = BrowserWindow.fromWebContents(e.sender);
      const r = dialog.showOpenDialogSync(w, { title: "Chọn thư mục sao lưu thứ hai (USB / ổ mạng / thư mục Google Drive)", properties: ["openDirectory", "createDirectory"] });
      e.returnValue = r && r[0] ? storage.setMirror(r[0]) : { ok: false, cancelled: true };
    } catch (err) { e.returnValue = { ok: false, error: String(err.message || err) }; }
  });
  ipcMain.on("backup-mirror-clear", (e) => { try { e.returnValue = storage.setMirror(null); } catch (err) { e.returnValue = { ok: false, error: String(err.message || err) }; } });
  ipcMain.on("backup-mirror-sync", (e) => { try { e.returnValue = storage.syncMirror(); } catch (err) { e.returnValue = { ok: false, error: String(err.message || err) }; } });
  ipcMain.on("backup-status", (e) => { try { e.returnValue = storage.backupStatus(); } catch (err) { e.returnValue = null; } });
  ipcMain.on("backup-note-external", (e) => { try { storage.noteExternal(); e.returnValue = true; } catch (err) { e.returnValue = false; } });
  // Băm mật khẩu ở tiến trình chính (PBKDF2-SHA256) — giao diện không tự xử lý thuật toán; so sánh chống đo thời gian
  const crypto = require("crypto"), { Buffer } = require("buffer");
  const kdf = (pw, salt, iter) => crypto.pbkdf2Sync(String(pw), Buffer.from(String(salt), "hex"), Math.min(Math.max(+iter || 210000, 100000), 2000000), 32, "sha256");
  ipcMain.on("auth-salt", (e) => { e.returnValue = crypto.randomBytes(16).toString("hex"); });
  ipcMain.on("auth-hash", (e, pw, salt, iter) => { try { e.returnValue = kdf(pw, salt, iter).toString("hex"); } catch (err) { e.returnValue = null; } });
  ipcMain.on("auth-verify", (e, pw, salt, iter, hash) => {
    try { const a = kdf(pw, salt, iter), b = Buffer.from(String(hash), "hex"); e.returnValue = b.length === a.length && crypto.timingSafeEqual(a, b); } catch (err) { e.returnValue = false; }
  });
  // Người thực hiện mặc định cho nhật ký thao tác: tài khoản Windows + tên máy (chưa có đăng nhập riêng — Phase phân quyền)
  ipcMain.on("app-user", (e) => { let u = ""; try { u = os.userInfo().username; } catch (err) { u = process.env.USERNAME || process.env.USER || ""; } e.returnValue = { user: u, host: os.hostname() }; });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800, title: "Tính Lương HAK", icon: path.join(__dirname, "ui", "icon.png"), backgroundColor: "#f3f6fa",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, "preload.js") }
  });
  Menu.setApplicationMenu(null);
  // Bảo mật: không mở cửa sổ mới / không điều hướng ra ngoài app
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (ev, url) => { if (!url.startsWith("file://")) ev.preventDefault(); });
  // Tải file (xuất Excel, báo cáo, sao lưu ra file): lưu thẳng vào thư mục xuất, không ghi đè; xong → báo giao diện + (mặc định) mở thư mục chọn sẵn file
  win.webContents.session.on("will-download", (ev, item) => {
    // V9.2→V10.1: tệp có vẻ là bảng lương → main kiểm lại từ dữ liệu trên đĩa, FAIL-CLOSED (không xác định được kỳ / không đọc được dữ liệu / engine lỗi ⇒ hủy tải)
    {
      const nm = item.getFilename();
      const chk = payGate.checkExport(nm, () => { const ld = storage.load(); if (!ld || !ld.ok || !ld.text) throw new Error("no data"); return JSON.parse(ld.text); });
      if (!chk.ok) { item.cancel(); if (!win.isDestroyed()) win.webContents.send("download-done", { ok: false, name: nm, state: "blocked", blocked: chk.code + ": " + chk.message }); return; }
    }
    const f = exportsDir.target(item.getFilename());
    item.setSavePath(f);
    item.once("done", (e2, state) => {
      const ok = state === "completed";
      if (ok && exportsDir.openAfter()) shellDo("show", f);
      if (!win.isDestroyed()) win.webContents.send("download-done", { ok, name: path.basename(f), dir: path.dirname(f), state, opened: ok && exportsDir.openAfter() });
    });
  });
  win.loadFile(path.join(__dirname, "index.html"));
  win.maximize();
  return win;
}

app.on("second-instance", () => {
  const w = BrowserWindow.getAllWindows()[0];
  if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
});
app.whenReady().then(() => {
  // Kiểm tra OCR trong BẢN ĐÓNG GÓI (CI Windows): HAK_OCR_SELFTEST=<file kết quả> → đọc thử, ghi JSON, thoát. Không mở dữ liệu, không mở cửa sổ.
  if (process.env.HAK_OCR_SELFTEST) {
    const out = process.env.HAK_OCR_SELFTEST;
    ocrSvc().selfTest().then((r) => r, (e) => ({ ok: false, error: String(e && e.message || e) })).then((r) => {
      require("fs").writeFileSync(out, JSON.stringify(Object.assign({ packaged: app.isPackaged }, r)));
      return ocr.terminate().catch(() => {}).then(() => app.exit(r.ok && /12/.test(r.text) ? 0 : 1));
    });
    return;
  }
  storage = createStorage(app.getPath("userData"));
  const spaths = require("./main/storage-paths").resolve(app.getPath("userData"), storage.readSettings(), "");
  vault = createVault(spaths.docs);
  ocrLib = require("./main/ocr-library").createStore(spaths.ocrLib, { spoolDir: path.join(app.getPath("userData"), "ocr-spool") });
  restorer = require("./main/restore").createRestorer({ userData: app.getPath("userData"), getVault: () => vault, getOcrLib: () => ocrLib, readData: () => storage.load(), maxSchema: require("./core/schema.js").SUPPORTED_SCHEMA, appVersion: app.getVersion() });
  try { require("./main/storage-paths").markUsed(app.getPath("userData"), storage.readSettings(), "", storage.writeSettings); } catch (e) { /* không chặn khởi động */ }
  try { const rc = restorer.recover(); if (rc.note) { const st0 = storage.readSettings(); st0.lastRestoreNote = rc.note; storage.writeSettings(st0); } } catch (e) { /* không chặn khởi động */ }
  exportsDir = createExports({ readSettings: storage.readSettings, writeSettings: storage.writeSettings, defaultDir: path.join(app.getPath("documents"), "Tinh Luong HAK", "File xuat"), fixedDir: process.env.HAK_DOWNLOAD_DIR || "" });
  try { storage.backup("startup"); } catch (e) { /* lần đầu chưa có dữ liệu */ }
  registerIpc();
  createWindow();
  // Sao lưu định kỳ khi app đang mở (kiểm tra mỗi phút; chỉ sao lưu khi đến giờ VÀ dữ liệu đã đổi). HAK_SCHEDULE_TICK_MS: kiểm thử tự động
  require("timers").setInterval(() => { storage.tickSchedule(); }, Number(process.env.HAK_SCHEDULE_TICK_MS) || 60000).unref();
});
app.on("window-all-closed", () => app.quit());
// Lịch sao lưu (α17): cửa sổ đã đóng (giao diện đã lưu lần cuối ở beforeunload) → sao lưu "khi-dong" nếu dữ liệu đã đổi.
// will-quit chạy cả khi bấm ✕ lẫn khi app.quit() (tắt máy / cài bản mới).
app.on("will-quit", () => { if (storage) storage.backupOnClose(); if (ocr) ocr.terminate().catch(() => {}); });
