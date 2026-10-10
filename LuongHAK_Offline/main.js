const { app, BrowserWindow, Menu, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");

// Dữ liệu lưu thành file JSON trong thư mục dữ liệu của app (%APPDATA%\Tinh Luong HAK),
// mỗi ngày tự giữ 1 bản sao lưu trong thư mục backups (giữ 60 bản gần nhất).
const dataDir = app.getPath("userData");
const dataFile = path.join(dataDir, "data.json");
const backupDir = path.join(dataDir, "backups");

function today() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

ipcMain.on("store-load", (e) => {
  try { e.returnValue = fs.existsSync(dataFile) ? fs.readFileSync(dataFile, "utf8") : null; } catch (err) { e.returnValue = null; }
});
ipcMain.on("store-save", (e, str) => {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(dataFile + ".tmp", str, "utf8");
    fs.renameSync(dataFile + ".tmp", dataFile);
    fs.mkdirSync(backupDir, { recursive: true });
    const b = path.join(backupDir, "data_" + today() + ".json");
    fs.copyFileSync(dataFile, b);
    const all = fs.readdirSync(backupDir).filter((f) => /^data_.*\.json$/.test(f)).sort();
    all.slice(0, Math.max(0, all.length - 60)).forEach((f) => fs.unlinkSync(path.join(backupDir, f)));
    e.returnValue = true;
  } catch (err) { e.returnValue = String(err && err.message || err); }
});
ipcMain.on("store-info", (e) => { e.returnValue = { dataFile, backupDir }; });
ipcMain.on("open-data-folder", () => { fs.mkdirSync(dataDir, { recursive: true }); shell.openPath(dataDir); });

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800, title: "Tính lương HAK",
    webPreferences: { contextIsolation: true, preload: path.join(__dirname, "preload.js") }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, "index.html"));
  win.maximize();
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
