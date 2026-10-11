const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const os = require("os");
const { createStorage } = require("./main/storage");
const { createExports } = require("./main/exports");

// Dữ liệu: %APPDATA%\Tinh Luong HAK\data.json — sao lưu trong thư mục backups (xem main/storage.js).
// Gỡ cài đặt KHÔNG xóa thư mục này (electron-builder: deleteAppDataOnUninstall mặc định false).
let storage = null, exportsDir = null;
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
  ipcMain.on("store-load", (e) => { e.returnValue = storage.load(); });
  ipcMain.on("store-save", (e, text) => { e.returnValue = storage.save(text); });
  ipcMain.on("store-info", (e) => { e.returnValue = storage.info(); });
  ipcMain.on("store-backup", (e, tag) => { try { e.returnValue = storage.backup(tag); } catch (err) { e.returnValue = null; } });
  ipcMain.on("store-list", (e) => { try { e.returnValue = storage.list(); } catch (err) { e.returnValue = []; } });
  ipcMain.on("store-verify", (e) => { try { e.returnValue = storage.verifyAll(); } catch (err) { e.returnValue = []; } });
  ipcMain.on("store-read", (e, name) => { try { e.returnValue = storage.readBackup(name); } catch (err) { e.returnValue = { ok: false, error: String(err.message || err) }; } });
  ipcMain.on("store-quarantine", (e) => { try { e.returnValue = storage.quarantineCorrupt(); } catch (err) { e.returnValue = null; } });
  ipcMain.on("open-data-folder", () => { shell.openPath(path.dirname(storage.dataFile)); });
  // File xuất (2.0-α16): giao diện chỉ gửi TÊN file — đường dẫn ghép trong thư mục xuất (main/exports.js)
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
  storage = createStorage(app.getPath("userData"));
  exportsDir = createExports({ readSettings: storage.readSettings, writeSettings: storage.writeSettings, defaultDir: path.join(app.getPath("documents"), "Tinh Luong HAK", "File xuat"), fixedDir: process.env.HAK_DOWNLOAD_DIR || "" });
  try { storage.backup("startup"); } catch (e) { /* lần đầu chưa có dữ liệu */ }
  registerIpc();
  createWindow();
});
app.on("window-all-closed", () => app.quit());
