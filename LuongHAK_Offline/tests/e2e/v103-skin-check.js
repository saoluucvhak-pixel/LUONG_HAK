// V10.3 — kiểu giao diện "Sang trọng" / "Cổ điển", sáng / tối: chụp màn hình + kiểm nút đổi kiểu hoạt động.
/* global document */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const ELECTRON = process.env.ELECTRON_PATH || require("electron");
const APP = path.resolve(__dirname, "../..");
const OUT = process.env.E2E_SHOTS || path.join(APP, "docs", "v10_3_screens", "skin");
const ADMIN = { u: "admin", n: "Quản trị E2E", p: "Admin2026e2e" };
let fail = 0;
const ok = (name, cond) => { if (!cond) fail++; console.log((cond ? "PASS " : "FAIL ") + name); };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hak-skin-"));
  const app = await _electron.launch({ executablePath: ELECTRON, args: ["--no-sandbox", APP], env: Object.assign({}, process.env, { HAK_USER_DATA: dir, HAK_NO_SHELL: "1" }) });
  const w = await app.firstWindow(); const errs = [];
  w.on("pageerror", (e) => errs.push(e.message));
  w.on("dialog", (d) => d.accept(d.type() === "prompt" ? "" : undefined));
  await w.waitForSelector("#main > *");
  for (const [k, v] of [["u", ADMIN.u], ["n", ADMIN.n], ["p", ADMIN.p], ["p2", ADMIN.p]]) await w.fill("#main input[data-f=" + k + "]", v);
  await w.click("#main button.big"); await w.waitForSelector("[data-recovery]"); await w.click(".dlg footer button.pri"); await w.waitForSelector("#nav button[data-k=home]");
  await w.setViewportSize({ width: 1440, height: 860 });
  const skin = () => w.evaluate(() => document.documentElement.getAttribute("data-skin"));
  ok("mặc định là kiểu Sang trọng", (await skin()) === "luxe");
  await w.click("#nav button[data-k=nhansu]").catch(() => {}); await w.waitForTimeout(300);
  await w.screenshot({ path: path.join(OUT, "luxe-sang.png") });
  await w.click(".themebtn:has-text('Giao diện tối')"); await w.waitForTimeout(300);
  await w.screenshot({ path: path.join(OUT, "luxe-toi.png") });
  await w.click(".themebtn:has-text('Kiểu cổ điển')"); await w.waitForTimeout(300);
  ok("đổi sang Cổ điển", (await skin()) === "classic");
  await w.screenshot({ path: path.join(OUT, "classic-toi.png") });
  await w.click(".themebtn:has-text('Giao diện sáng')"); await w.click(".themebtn:has-text('Kiểu sang trọng')"); await w.waitForTimeout(200);
  ok("đổi lại Sang trọng", (await skin()) === "luxe");
  ok("không lỗi JS", errs.length === 0);
  await app.close(); process.exit(fail ? 1 : 0);
})();
