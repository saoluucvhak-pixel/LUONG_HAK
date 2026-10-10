const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const path = require("path");
const { createStorage } = require("./main/storage");

// Dữ liệu: %APPDATA%\Tinh Luong HAK\data.json — sao lưu trong thư mục backups (xem main/storage.js).
// Gỡ cài đặt KHÔNG xóa thư mục này (electron-builder: deleteAppDataOnUninstall mặc định false).
let storage = null;

// Kiểm thử tự động có thể chỉ định thư mục dữ liệu riêng (không đụng dữ liệu thật)
if (process.env.HAK_USER_DATA) app.setPath("userData", process.env.HAK_USER_DATA);

// Chỉ cho chạy 1 cửa sổ app: 2 bản cùng ghi 1 file dữ liệu sẽ ghi đè lẫn nhau.
if (!app.requestSingleInstanceLock()) { app.quit(); }

function registerIpc() {
  ipcMain.on("store-load", (e) => { e.returnValue = storage.load(); });
  ipcMain.on("store-save", (e, text) => { e.returnValue = storage.save(text); });
  ipcMain.on("store-info", (e) => { e.returnValue = storage.info(); });
  ipcMain.on("store-backup", (e, tag) => { try { e.returnValue = storage.backup(tag); } catch (err) { e.returnValue = null; } });
  ipcMain.on("store-list", (e) => { try { e.returnValue = storage.list(); } catch (err) { e.returnValue = []; } });
  ipcMain.on("store-read", (e, name) => { try { e.returnValue = storage.readBackup(name); } catch (err) { e.returnValue = { ok: false, error: String(err.message || err) }; } });
  ipcMain.on("store-quarantine", (e) => { try { e.returnValue = storage.quarantineCorrupt(); } catch (err) { e.returnValue = null; } });
  ipcMain.on("open-data-folder", () => { shell.openPath(path.dirname(storage.dataFile)); });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800, title: "Nhân sự - Tiền lương HAK",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, "preload.js") }
  });
  Menu.setApplicationMenu(null);
  // Bảo mật: không mở cửa sổ mới / không điều hướng ra ngoài app
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (ev, url) => { if (!url.startsWith("file://")) ev.preventDefault(); });
  // Tải file (xuất Excel, sao lưu): mặc định Electron hỏi nơi lưu. Kiểm thử tự động có thể chỉ định thư mục.
  if (process.env.HAK_DOWNLOAD_DIR) win.webContents.session.on("will-download", (ev, item) => { item.setSavePath(path.join(process.env.HAK_DOWNLOAD_DIR, item.getFilename())); });
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
  try { storage.backup("startup"); } catch (e) { /* lần đầu chưa có dữ liệu */ }
  registerIpc();
  createWindow();
});
app.on("window-all-closed", () => app.quit());
