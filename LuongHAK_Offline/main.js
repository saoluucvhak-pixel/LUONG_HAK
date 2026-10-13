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
const guard = createGuard(__dirname);

// Dữ liệu: %APPDATA%\Tinh Luong HAK\data.json — sao lưu trong thư mục backups (xem main/storage.js).
// Gỡ cài đặt KHÔNG xóa thư mục này (electron-builder: deleteAppDataOnUninstall mặc định false).
let storage = null, exportsDir = null, ocr = null, vault = null;
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
  // Lệnh nhạy cảm: kiểm nguồn + đăng nhập + quyền trước khi chạy
  const guarded = (perm, fn) => async (e, ...a) => { const d = guard.deny(e, perm); return d ? { ok: false, error: d, problems: [d] } : fn(e, ...a); };
  ipcMain.on("auth-session", (e, perms) => { e.returnValue = guard.setSession(e, perms); }); // quyền của người đang đăng nhập (GĐ6)
  ipcMain.on("store-load", (e) => { e.returnValue = storage.load(); });
  ipcMain.on("store-save", (e, text) => { e.returnValue = storage.save(text); });
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
      const buf = await pdfSvc.renderPdf({ BrowserWindow }, payload);
      let name = exportsDir.cleanName(payload.name || "BaoCao"); if (!/\.pdf$/i.test(name)) name = name.replace(/\.[^.]*$/, "") + ".pdf";
      const f = exportsDir.target(name); require("fs").writeFileSync(f, buf);
      const opened = exportsDir.openAfter(); if (opened) shellDo("show", f);
      return { ok: true, name: path.basename(f), dir: path.dirname(f), size: buf.length, pages: pdfSvc.countPages(buf), opened };
    } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
  }));
  // Kho chứng từ gốc (GĐ4): chỉ THÊM / ĐỌC / KIỂM TRA — không có thao tác xóa. Giao diện chỉ dùng DocumentID, không truyền đường dẫn.
  const toBuf = (d) => d instanceof ArrayBuffer ? Buffer.from(d) : ArrayBuffer.isView(d) ? Buffer.from(d.buffer, d.byteOffset, d.byteLength) : null;
  ipcMain.handle("doc-add", guarded("input.edit", async (e, data, info) => {
    try { const b = toBuf(data); if (!b) return { ok: false, error: "Dữ liệu chứng từ không hợp lệ" }; return vault.add(b, info && typeof info === "object" ? { name: info.name, user: info.user, note: info.note, pages: info.pages } : {}); }
    catch (err) { return { ok: false, error: String(err && err.message || err) }; }
  }));
  ipcMain.handle("doc-list", guarded("input.view", async () => { try { return { ok: true, docs: vault.list() }; } catch (err) { return { ok: false, error: String(err.message || err) }; } }));
  ipcMain.handle("doc-read", guarded("input.view", async (e, id) => { try { const r = vault.read(String(id || "")); return r.ok ? { ok: true, meta: r.meta, data: r.data } : r; } catch (err) { return { ok: false, error: String(err.message || err) }; } }));
  ipcMain.handle("doc-verify", guarded("input.view", async (e, ids) => { try { return { ok: true, items: vault.verify(Array.isArray(ids) ? ids.map(String) : undefined) }; } catch (err) { return { ok: false, error: String(err.message || err) }; } }));
  ipcMain.on("doc-open", (e, id) => { if (guard.deny(e, "input.view")) { e.returnValue = false; return; } const f = vault.pathOf(String(id || "")); if (f) shellDo("open", f); e.returnValue = !!f; });
  // Full Backup / Restore (GĐ5): gói ZIP = dữ liệu + chứng từ gốc + manifest SHA-256. Giao diện không truyền đường dẫn:
  // tạo vào thư mục xuất (và chép sang thư mục sao lưu thứ hai nếu có); đọc gói qua hộp thoại chọn file hoặc theo TÊN trong thư mục xuất.
  let lastInspect = null; // chỉ nhập chứng từ từ đúng gói vừa kiểm tra xong
  ipcMain.handle("fb-create", guarded("backup.restore", async (e, info) => {
    try {
      const ld = storage.load(); if (!ld.ok || !ld.text) return { ok: false, error: ld.error || "Chưa có file dữ liệu để sao lưu" };
      const r = fullBackup.create({ dataText: ld.text, vault, destDir: exportsDir.dir(), appVersion: app.getVersion(), user: info && info.user });
      if (!r.ok) return r;
      let mirrored = "";
      try { const md = storage.readSettings().mirrorDir; if (md) { const t = path.join(md, "FullBackup"); require("fs").mkdirSync(t, { recursive: true }); require("fs").copyFileSync(r.file, path.join(t, r.name)); require("fs").copyFileSync(r.file + ".sha256", path.join(t, r.name + ".sha256")); mirrored = t; } } catch (err) { r.warnings.push("Không chép được sang thư mục sao lưu thứ hai: " + (err.message || err)); }
      return { ok: true, name: r.name, dir: path.dirname(r.file), size: r.size, sha256: r.sha256, docs: r.docs, warnings: r.warnings, mirrored };
    } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
  }));
  ipcMain.handle("fb-list", guarded("backup.restore", async () => { try { return { ok: true, files: exportsDir.list(500).filter((f) => /^LuongHAK_FullBackup_.*\.zip$/i.test(f.name)) }; } catch (err) { return { ok: false, error: String(err.message || err) }; } }));
  ipcMain.handle("fb-inspect", guarded("backup.restore", async (e, name) => {
    try {
      let f = "";
      if (name) { f = exportsDir.resolve(String(name)) || ""; if (!/\.zip$/i.test(f)) return { ok: false, problems: ["Không tìm thấy gói trong thư mục xuất"] }; }
      else if (process.env.HAK_FB_PICK) f = process.env.HAK_FB_PICK;
      else { const r = dialog.showOpenDialogSync(BrowserWindow.fromWebContents(e.sender), { title: "Chọn gói Full Backup (.zip)", filters: [{ name: "Gói sao lưu", extensions: ["zip"] }], properties: ["openFile"] }); if (!r || !r[0]) return { ok: false, cancelled: true }; f = r[0]; }
      const rep = fullBackup.inspect(f, vault); lastInspect = rep.ok ? f : null;
      return { ok: rep.ok, problems: rep.problems, label: path.basename(f), manifest: rep.manifest && { createdAt: rep.manifest.createdAt, createdBy: rep.manifest.createdBy, appVersion: rep.manifest.appVersion, warnings: rep.manifest.warnings }, docs: rep.docs, text: rep.ok ? rep.dataText : null };
    } catch (err) { return { ok: false, problems: [String(err && err.message || err)] }; }
  }));
  ipcMain.handle("fb-import-docs", guarded("backup.restore", async () => {
    try { if (!lastInspect) return { ok: false, error: "Chưa kiểm tra gói nào" }; const r = fullBackup.importDocuments(lastInspect, vault); return Object.assign({ ok: true }, r); }
    catch (err) { return { ok: false, error: String(err && err.message || err) }; }
  }));
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
  vault = createVault(path.join(app.getPath("userData"), "documents"));
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
