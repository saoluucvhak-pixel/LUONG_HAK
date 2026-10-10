const { contextBridge, ipcRenderer } = require("electron");
// Cầu nối tối thiểu giữa giao diện và tiến trình chính: chỉ các thao tác lưu trữ dữ liệu của app.
contextBridge.exposeInMainWorld("hakStore", {
  load: () => ipcRenderer.sendSync("store-load"),          // { ok, text } | { ok:false, error, backups }
  save: (text) => ipcRenderer.sendSync("store-save", text), // true | "lỗi"
  info: () => ipcRenderer.sendSync("store-info"),
  backup: (tag) => ipcRenderer.sendSync("store-backup", tag),
  listBackups: () => ipcRenderer.sendSync("store-list"),
  readBackup: (name) => ipcRenderer.sendSync("store-read", name),
  quarantine: () => ipcRenderer.sendSync("store-quarantine"),
  openFolder: () => ipcRenderer.send("open-data-folder")
});
