const { contextBridge, ipcRenderer } = require("electron");
// Cầu nối tối thiểu giữa giao diện và tiến trình chính: chỉ các thao tác lưu trữ dữ liệu của app.
contextBridge.exposeInMainWorld("hakStore", {
  load: () => ipcRenderer.sendSync("store-load"),          // { ok, text } | { ok:false, error, backups }
  save: (text) => ipcRenderer.sendSync("store-save", text), // true | "lỗi"
  info: () => ipcRenderer.sendSync("store-info"),
  backup: (tag) => ipcRenderer.sendSync("store-backup", tag),
  listBackups: () => ipcRenderer.sendSync("store-list"),
  verifyBackups: () => ipcRenderer.sendSync("store-verify"),  // [{ name, tag, created, status: ok|unverified|mismatch|invalid }]
  readBackup: (name) => ipcRenderer.sendSync("store-read", name),
  quarantine: () => ipcRenderer.sendSync("store-quarantine"),
  openFolder: () => ipcRenderer.send("open-data-folder"),
  mirrorChoose: () => ipcRenderer.sendSync("backup-mirror-choose"), // { ok, copied?, error?, cancelled? }
  mirrorClear: () => ipcRenderer.sendSync("backup-mirror-clear"),
  mirrorSync: () => ipcRenderer.sendSync("backup-mirror-sync"),
  backupStatus: () => ipcRenderer.sendSync("backup-status"),       // { mirrorDir, lastMirrorOk, lastMirrorError, lastExternal, daysSinceExternal, permanent }
  scheduleGet: () => ipcRenderer.sendSync("backup-schedule-get"),     // { ok, everyHours, onClose, keepDaily, lastAuto }
  scheduleSet: (o) => ipcRenderer.sendSync("backup-schedule-set", o),  // { everyHours?, onClose?, keepDaily? }
  noteExternal: () => ipcRenderer.sendSync("backup-note-external"),
  whoami: () => ipcRenderer.sendSync("app-user"),            // { user, host } — tài khoản Windows đang dùng
  authSalt: () => ipcRenderer.sendSync("auth-salt"),
  authHash: (pw, salt, iter) => ipcRenderer.sendSync("auth-hash", pw, salt, iter),
  authVerify: (pw, salt, iter, hash) => ipcRenderer.sendSync("auth-verify", pw, salt, iter, hash)
});
// File xuất (Excel, báo cáo): chỉ thao tác theo TÊN file trong thư mục xuất — không truyền đường dẫn
contextBridge.exposeInMainWorld("hakFiles", {
  info: () => ipcRenderer.sendSync("files-info"),                 // { ok, dir, openAfterDownload, files: [{ name, size, mtime }] }
  open: (name) => ipcRenderer.sendSync("files-open", name),       // mở file bằng Excel / ứng dụng mặc định
  show: (name) => ipcRenderer.sendSync("files-show", name),       // mở thư mục, chọn sẵn file
  openDir: () => ipcRenderer.sendSync("files-open-dir"),
  chooseDir: () => ipcRenderer.sendSync("files-choose-dir"),      // { ok, dir } | { cancelled }
  resetDir: () => ipcRenderer.sendSync("files-reset-dir"),
  setOpenAfter: (on) => ipcRenderer.sendSync("files-open-after", !!on),
  onDone: (cb) => { ipcRenderer.on("download-done", (e, info) => { try { cb(info); } catch (err) { /* lỗi giao diện không làm hỏng tải file */ } }); }
});
