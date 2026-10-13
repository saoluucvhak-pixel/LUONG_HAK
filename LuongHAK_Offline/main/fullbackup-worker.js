// Chạy fullbackup.create() trong worker_thread (V9): giao diện / tiến trình chính không bị treo khi đóng gói gói lớn.
// Hủy: cờ dùng chung (SharedArrayBuffer) — create() kiểm cờ giữa các bước và dọn file tạm khi CANCELLED.
"use strict";
/* global setImmediate, __filename */
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const path = require("path");

function runDirect(o, shouldCancel, onProgress) {
  const { createVault } = require("./documents"), { createStore } = require("./ocr-library"), fb = require("./fullbackup");
  try {
    const vault = o.docsDir ? createVault(o.docsDir) : null;
    const ocrLib = o.ocrDir ? createStore(o.ocrDir, { spoolDir: o.spoolDir }) : null;
    return fb.create({ dataText: o.dataText, vault, ocrLib, destDir: o.destDir, appVersion: o.appVersion, user: o.user, allowPartial: o.allowPartial, restoreConfig: o.restoreConfig, shouldCancel, onProgress });
  } catch (e) { return { ok: false, status: "FAILED", error: String((e && e.message) || e) }; }
}
if (!isMainThread && workerData && workerData.__fbWorker) {
  const flag = new Int32Array(workerData.flag);
  const r = runDirect(workerData, () => Atomics.load(flag, 0) === 1, (m) => parentPort.postMessage({ type: "progress", msg: typeof m === "string" ? { text: m } : m }));
  parentPort.postMessage({ type: "done", result: r });
}

/** @returns { promise, cancel() } — promise giải quyết bằng kết quả của create(); lỗi worker → FAILED (không bao giờ reject).
 *  Nếu KHÔNG khởi động được worker (VD môi trường đóng gói không nạp được script) → tự chạy trực tiếp trong tiến trình hiện tại (không mất chức năng). */
function run(opts, onProgress) {
  const flag = new SharedArrayBuffer(4), view = new Int32Array(flag);
  let settled = false, online = false, direct = false;
  const promise = new Promise((resolve) => {
    const fin = (r) => { if (settled) return; settled = true; resolve(r); };
    const fallback = () => { if (direct || settled) return; direct = true; setImmediate(() => fin(runDirect(opts, () => Atomics.load(view, 0) === 1, (m) => { try { if (onProgress) onProgress(typeof m === "string" ? { text: m } : m); } catch (e) { /* bỏ qua */ } }))); };
    let w;
    try { w = new Worker(__filename, { workerData: Object.assign({ __fbWorker: true, flag }, opts) }); } catch (e) { fallback(); return; }
    w.on("online", () => { online = true; });
    w.on("message", (m) => { if (m.type === "progress") { try { if (onProgress) onProgress(m.msg); } catch (e) { /* tiến độ không làm hỏng sao lưu */ } } else if (m.type === "done") fin(m.result); });
    w.on("error", (e) => { if (!online) fallback(); else fin({ ok: false, status: "FAILED", error: "Tiến trình sao lưu gặp lỗi: " + String((e && e.message) || e) }); });
    w.on("exit", (code) => { if (!online) fallback(); else fin({ ok: false, status: "FAILED", error: "Tiến trình sao lưu dừng đột ngột (mã " + code + ")" }); });
  });
  return { promise, cancel: () => Atomics.store(view, 0, 1) };
}
module.exports = { run, runDirect, path };
