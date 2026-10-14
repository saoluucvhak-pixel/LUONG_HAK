// V10 — duyệt từng màn hình ở 3 độ phân giải: mở thật trên Electron, chụp ảnh, kiểm tra không tràn ngang trang, không lỗi JS.
// Chạy: xvfb-run -a node tests/e2e/v10-screens.js   (ảnh ra thư mục E2E_SHOTS hoặc ./v10-screens-out; báo cáo JSON: docs/V10_SCREEN_CHECK.json)
/* global document */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const ELECTRON = process.env.ELECTRON_PATH || require("electron");
const APP = path.resolve(__dirname, "../..");
const OUT = process.env.E2E_SHOTS || path.join(__dirname, "v10-screens-out");
const SIZES = [[1366, 768], [1600, 900], [1920, 1080]];
const ADMIN = { u: "admin", n: "Quản trị E2E", p: "Admin2026e2e" };

async function launch(dir) {
  const app = await _electron.launch({ executablePath: ELECTRON, args: ["--no-sandbox", APP], env: Object.assign({}, process.env, { HAK_USER_DATA: dir, HAK_NO_SHELL: "1" }) });
  const w = await app.firstWindow(); const errs = [];
  w.on("pageerror", (e) => errs.push(e.message)); w.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  w.on("dialog", (d) => d.accept(d.type() === "prompt" ? "" : undefined));
  await w.waitForSelector("#main > *");
  const t = await w.locator("#top h2").innerText();
  if (/Thiết lập/.test(t)) {
    for (const [k, v] of [["u", ADMIN.u], ["n", ADMIN.n], ["p", ADMIN.p], ["p2", ADMIN.p]]) await w.fill("#main input[data-f=" + k + "]", v);
    await w.click("#main button.big"); await w.waitForSelector("[data-recovery]"); await w.click(".dlg footer button.pri"); await w.waitForSelector("#nav button[data-k=home]");
  } else if (/Đăng nhập/.test(t)) {
    await w.fill("#main input[data-f=u]", ADMIN.u); await w.fill("#main input[data-f=p]", ADMIN.p); await w.click("#main button.big"); await w.waitForSelector("#nav button[data-k=home]");
  }
  return { app, w, errs };
}
(async () => {
  const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "hak-v10-screens-"));
  let { app, w, errs } = await launch(DIR);
  await w.click("#nav button[data-k=backup]"); await w.click('button:has-text("Nạp danh mục chuẩn HAK")'); await w.waitForTimeout(300);
  await app.close();
  const fb = path.join(DIR, "data.json"), db = JSON.parse(fs.readFileSync(fb, "utf8")), now = new Date(), ky = now.getFullYear() + "-" + ("0" + (now.getMonth() + 1)).slice(-2);
  for (let i = 1; i <= 25; i++) {
    const ma = "NV" + ("00" + i).slice(-3);
    db.nhanvien.push({ _id: "n" + i, "Mã NV": ma, "Họ và tên": "Nhân viên mẫu " + i, "Trạng thái": "Đang làm việc" });
    db.hopdong.push({ _id: "h" + i, "Mã NV": ma, "Số HĐLĐ": ma + "/HĐ", "Hình thức HĐLĐ": "Xác định thời hạn", "Ngày vào làm": "2026-01-01" });
    db.chitiethd.push({ _id: "p" + i, "Mã NV": ma, "Số HĐLĐ": ma + "/HĐ", "Hiệu lực từ": "2026-01-01", "Mã lương": "TG1", "Lương thỏa thuận": String(8000000 + i * 100000), "HTTT": i % 2 ? "Chuyển khoản" : "Tiền mặt", "Mức đóng bảo hiểm": "BH01", "Thuế TNCN": "LT01" });
    db.chamcong.push({ "Kỳ": ky, "Mã NV": ma, "Hình thức công": "BT", "01": "1", "02": "1", "03": "1" });
    db.psluong.push({ "Ngày hạch toán": ky + "-05", "Số chứng từ": "T" + i, "Mã NV": ma, "Diễn giải": "Thưởng mẫu", "Thưởng": "500000" });
  }
  fs.writeFileSync(fb, JSON.stringify(db));
  ({ app, w, errs } = await launch(DIR));
  const keys = await w.evaluate(() => [...document.querySelectorAll("#nav button[data-k]")].map((b) => b.getAttribute("data-k")));
  const report = { generated: new Date().toISOString(), screens: keys.length, sizes: SIZES.map((s) => s.join("x")), results: [] };
  for (const [W, H] of SIZES) {
    await app.evaluate(({ BrowserWindow }, [ww, hh]) => { const win = BrowserWindow.getAllWindows()[0]; win.setContentSize(ww, hh); }, [W, H]);
    await w.waitForTimeout(400);
    const dir = path.join(OUT, W + "x" + H); fs.mkdirSync(dir, { recursive: true });
    for (const k of keys) {
      await w.click("#nav button[data-k=" + k + "]").catch(() => {}); await w.waitForTimeout(250);
      const m = await w.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, mainOver: (() => { const e = document.querySelector("#main"); return e ? e.scrollWidth - e.clientWidth : 0; })(), title: (document.querySelector("#top h2") || {}).textContent || "" }));
      await w.screenshot({ path: path.join(dir, k + ".png") }).catch(() => {});
      report.results.push({ size: W + "x" + H, screen: k, title: m.title, pageOverflowX: m.sw > m.iw + 2, mainOverflowPx: Math.max(0, m.mainOver), jsErrors: errs.length });
    }
  }
  await app.close();
  const bad = report.results.filter((r) => r.pageOverflowX);
  report.summary = { total: report.results.length, pageOverflowX: bad.length, jsErrors: errs.length, errors: errs.slice(0, 5) };
  fs.writeFileSync(path.join(APP, "docs", "V10_SCREEN_CHECK.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report.summary), "→ ảnh:", OUT);
  process.exit(bad.length || errs.length ? 1 : 0);
})().catch((e) => { console.error("LỖI", e); process.exit(2); });
