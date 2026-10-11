// Đo thời gian vẽ lưới chấm công + gõ tìm kiếm trên Electron thật với dữ liệu lớn (PERF-03)
// Chạy: xvfb-run -a node tests/perf/ui-bench.js   (dùng thư mục dữ liệu tạm, không đụng dữ liệu thật)
/* global document, localStorage, performance, requestAnimationFrame */ // dùng trong w.evaluate(...) chạy bên trong cửa sổ app
"use strict";
const APP = process.argv[2] || require("path").resolve(__dirname, "../..");
const fs = require("fs"), os = require("os"), path = require("path");
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const F = require(path.join(APP, "tests/fixtures/build.js"));
(async () => {
  for (const n of [1000, 5000]) {
    const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "uib-"));
    const db = F.regressionDataset(n); db.schemaVersion = 2;
    fs.writeFileSync(path.join(DATA, "data.json"), JSON.stringify(db));
    const app = await _electron.launch({ executablePath: process.env.ELECTRON_PATH || require(path.join(APP, "node_modules/electron")), args: ["--no-sandbox", APP], env: Object.assign({}, process.env, { HAK_USER_DATA: DATA }) });
    const w = await app.firstWindow(); w.on("dialog", (d) => d.accept());
    await w.waitForSelector("#main > *");
    for (const [k, v] of [["u", "admin"], ["n", "A"], ["p", "Admin2026x"], ["p2", "Admin2026x"]]) await w.fill("#main input[data-f=" + k + "]", v);
    await w.click("#main button.big"); await w.waitForSelector("[data-recovery]"); await w.click(".dlg footer button.pri"); await w.waitForSelector("#nav button[data-k=home]");
    await w.evaluate(() => { const s = JSON.parse(localStorage.getItem("luonghak_db_v1_ui") || "{}"); s.nam = 2026; s.thang = 9; localStorage.setItem("luonghak_db_v1_ui", JSON.stringify(s)); });
    await w.selectOption("#top select", "9"); await w.fill("#top input[type=number]", "2026"); await w.dispatchEvent("#top input[type=number]", "change");
    let t = Date.now(); await w.click("#nav button[data-k=chamcong]"); await w.waitForSelector("main tbody tr"); await w.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));
    const tOpen = Date.now() - t;
    const rows = await w.locator("main tbody tr").count(), inputs = await w.locator("main tbody input").count();
    t = Date.now(); await w.locator("input.search").pressSequentially("NV00", { delay: 0 }); await w.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));
    const tType = Date.now() - t;
    // thời gian tới khi KẾT QUẢ LỌC hiện ra (bản mới có chờ 250 ms sau phím cuối)
    await w.waitForFunction(() => /đang lọc|NV00/.test(document.querySelector("main .bar .hint") ? document.querySelector("main .bar .hint").textContent : "") , null, { timeout: 120000 }).catch(() => {});
    const tFilter = Date.now() - t; const shown = await w.locator("main tbody tr").count();
    const mem = await w.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1);
    console.log(JSON.stringify({ n, rows, inputs, moLuoi_ms: tOpen, go4phim_ms: tType, denKhiLocXong_ms: tFilter, dongHien: shown, heapMB: mem }));
    await app.close(); fs.rmSync(DATA, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
