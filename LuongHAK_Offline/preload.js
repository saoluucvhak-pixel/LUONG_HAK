const { contextBridge, ipcRenderer } = require("electron");
// Cầu nối tối thiểu giữa giao diện và tiến trình chính: chỉ các thao tác lưu trữ dữ liệu của app.
contextBridge.exposeInMainWorld("hakStore", {
  load: () => ipcRenderer.sendSync("store-load"),          // { ok, text } | { ok:false, error, backups }
  save: (text) => ipcRenderer.sendSync("store-save", text), // true | "lỗi"
  info: () => ipcRenderer.sendSync("store-info"),
  backup: (tag) => ipcRenderer.sendSync("store-backup", tag),
  hasDataFile: () => ipcRenderer.sendSync("store-has-data-file"),
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
  session: (perms) => ipcRenderer.sendSync("auth-session", perms), // báo quyền người đang đăng nhập cho tiến trình chính (lệnh nhạy cảm chỉ chạy khi có quyền)
  whoami: () => ipcRenderer.sendSync("app-user"),            // { user, host } — tài khoản Windows đang dùng
  authSalt: () => ipcRenderer.sendSync("auth-salt"),
  authHash: (pw, salt, iter) => ipcRenderer.sendSync("auth-hash", pw, salt, iter),
  authVerify: (pw, salt, iter, hash) => ipcRenderer.sendSync("auth-verify", pw, salt, iter, hash)
});
// OCR ảnh bảng chấm công / chấm cơm (α20): chỉ gửi ảnh ô đã cắt (xám) — chạy offline ở tiến trình chính
contextBridge.exposeInMainWorld("hakOcr", {
  batch: (items) => ipcRenderer.invoke("ocr-batch", items),       // [{ w, h, data: Uint8Array, mode: "digit"|"text"|"page" }] → [{ text, conf }]
  selfTest: () => ipcRenderer.invoke("ocr-selftest")
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

contextBridge.exposeInMainWorld("hakReport", {
  pdf: (payload) => ipcRenderer.invoke("report-pdf", payload) // { html, name, landscape, footer } → { ok, name, dir, size, pages } | { ok:false, error }
});

// Kho chứng từ gốc: chỉ thêm / đọc / kiểm tra theo DocumentID — không có hàm xóa
contextBridge.exposeInMainWorld("hakDocs", {
  add: (data, info) => ipcRenderer.invoke("doc-add", data, info),   // Uint8Array, { name, user, note, pages } → { ok, id, sha256, duplicate, size } | { ok:false, error }
  list: () => ipcRenderer.invoke("doc-list"),
  read: (id) => ipcRenderer.invoke("doc-read", id),                  // → { ok, meta, data }
  verify: (ids) => ipcRenderer.invoke("doc-verify", ids),            // → { ok, items: [{ id, name, status: ok|missing|mismatch }] }
  open: (id) => ipcRenderer.sendSync("doc-open", id)
});

// Full Backup / Restore: gói ZIP (dữ liệu + chứng từ + manifest SHA-256). Khôi phục: inspect (chỉ đọc) → app xác nhận → importDocs
contextBridge.exposeInMainWorld("hakFull", {
  create: (info) => ipcRenderer.invoke("fb-create", info),     // { user } → { ok, name, dir, size, sha256, docs, warnings, mirrored } | { ok:false, error }
  list: () => ipcRenderer.invoke("fb-list"),
  inspect: (name) => ipcRenderer.invoke("fb-inspect", name),   // name tùy chọn (trong thư mục xuất); bỏ trống = hộp thoại chọn file → { ok, problems, manifest, docs, text }
  importDocs: () => ipcRenderer.invoke("fb-import-docs")        // chỉ nhập chứng từ từ gói vừa inspect OK → { ok, added, same, conflict[], failed[] }
});
