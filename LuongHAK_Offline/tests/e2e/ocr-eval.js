// V10.1 — Đo độ chính xác OCR THEO TỪNG Ô trên ảnh/PDF mẫu GIẢ LẬP (tests/fixtures/ocr) so với đáp án sinh từ make_fixtures.py.
// Chạy: xvfb-run -a node tests/e2e/ocr-eval.js   → docs/V10_1_OCR_CHECK.json. Thoát mã 1 nếu dưới ngưỡng.
// Đây là ảnh tổng hợp (chữ in / nét x vẽ bằng máy), KHÔNG đại diện cho chữ viết tay thật trên giấy chấm công thật — xem docs/V10_1_OCR_CHECK.md.
/* global document */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const ELECTRON = process.env.ELECTRON_PATH || require("electron");
const APP = path.resolve(__dirname, "../..");
const FX = path.join(APP, "tests/fixtures/ocr");
const ADMIN = { u: "admin", n: "Quản trị OCR", p: "Admin2026ocr" };
const THRESH = { printed: 0.99, marks: 0.97 };

// Đáp án (khớp make_fixtures.py)
const PEOPLE = [["E2E Nhân Viên", Array(26).fill(1).concat([0.5, 1, 1, 0])], ["Phạm Minh Khoa", Array.from({ length: 30 }, (_, i) => [1, 1, 0][i % 3])], ["Đỗ Thu Hằng", Array.from({ length: 30 }, (_, i) => (i < 15 ? 1 : 0))]];
const MARKS = { "Lê Văn An": [2, 3, 2, 2, 3, 3, 0, 1, 1, 3, 2, 3, 1, 0, 0, 2, 1, 1, 0, 3, 0, 0, 3, 2, 2, 3, 1, 0, 3, 0], "Trần Bình": [3, 0, 0, 0, 1, 1, 0, 3, 1, 2, 1, 2, 3, 0, 1, 3, 1, 1, 2, 0, 0, 0, 2, 1, 2, 3, 0, 0, 1, 1], "Ngô Cường": [1, 3, 1, 0, 0, 3, 0, 0, 2, 0, 1, 2, 0, 0, 0, 0, 1, 1, 0, 2, 0, 2, 2, 2, 0, 3, 1, 0, 1, 1] };
const fmt = (v) => (v === 0 ? "" : String(v).replace(".", ","));
const norm = (s) => String(s == null ? "" : s).trim().replace(/\./g, ",").replace(/^0$/, "");

async function launch(dir) {
  const app = await _electron.launch({ executablePath: ELECTRON, args: ["--no-sandbox", APP], env: Object.assign({}, process.env, { HAK_USER_DATA: dir, HAK_NO_SHELL: "1" }) });
  const w = await app.firstWindow(); const errs = [];
  w.on("pageerror", (e) => errs.push(e.message)); w.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  w.on("dialog", (d) => d.accept(d.type() === "prompt" ? "" : undefined));
  await w.waitForSelector("#main > *");
  const t = await w.locator("#top h2").innerText();
  if (/Thiết lập/.test(t)) { for (const [k, v] of [["u", ADMIN.u], ["n", ADMIN.n], ["p", ADMIN.p], ["p2", ADMIN.p]]) await w.fill("#main input[data-f=" + k + "]", v); await w.click("#main button.big"); await w.waitForSelector("[data-recovery]"); await w.click(".dlg footer button.pri"); await w.waitForSelector("#nav button[data-k=home]"); }
  else if (/Đăng nhập/.test(t)) { await w.fill("#main input[data-f=u]", ADMIN.u); await w.fill("#main input[data-f=p]", ADMIN.p); await w.click("#main button.big"); await w.waitForSelector("#nav button[data-k=home]"); }
  return { app, w, errs };
}
async function readFile(w, files, mode, tab) {
  await w.click('#main button:has-text("Xóa danh sách")').catch(() => {});
  if (mode) await w.selectOption('select[aria-label="Cách đọc ô cho file mới"]', mode);
  const [fc] = await Promise.all([w.waitForEvent("filechooser"), w.locator('#main button:has-text("Chọn ảnh / PDF")').click()]);
  const t0 = Date.now(); await fc.setFiles(files.map((f) => path.join(FX, f)));
  let ok = false; for (let i = 0; i < 480 && !ok; i++) { await w.waitForTimeout(500); ok = await w.evaluate((n) => { const e = [...document.querySelectorAll(".subtabs button .n")][n]; return !!e && /^\d+$/.test(e.textContent); }, tab || 0); }
  await w.locator(".subtabs button").nth(tab || 0).click(); await w.waitForTimeout(300);
  const rows = await w.evaluate(() => [...document.querySelectorAll(".ocrgrid tbody tr")].map((tr) => ({ ten: tr.querySelector("input.i") ? tr.querySelector("input.i").value : "", cells: Array.from({ length: 31 }, (_, d) => { const x = tr.querySelector("input[data-day='" + (d + 1) + "']"); return x ? x.value : ""; }), tot: tr.children[tr.children.length - 2].textContent })));
  return { ok, rows, ms: Date.now() - t0 };
}
function score(rows, truth) { // truth: [[ten, [30 giá trị]]]
  let cells = 0, good = 0, bad = []; const perRow = [];
  truth.forEach(([ten, vals], r) => {
    const got = rows[r]; let g = 0;
    vals.forEach((v, d) => { cells++; const a = norm(got && got.cells[d]), b = norm(fmt(v)); if (a === b) { good++; g++; } else bad.push(ten + " ngày " + (d + 1) + ": đọc '" + (got ? got.cells[d] : "?") + "' ≠ '" + fmt(v) + "'"); });
    perRow.push({ ten, doc: got ? got.ten : null, ok: g, of: vals.length });
  });
  return { cells, good, acc: cells ? good / cells : 0, perRow, bad: bad.slice(0, 12) };
}
(async () => {
  const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "hak-ocr-eval-"));
  let { app, w, errs } = await launch(DIR); await app.close();
  const fb = path.join(DIR, "data.json"), db = JSON.parse(fs.readFileSync(fb, "utf8"));
  [["E2E Nhân Viên"], ["Phạm Minh Khoa"], ["Đỗ Thu Hằng"], ["Lê Văn An"], ["Trần Bình"], ["Ngô Cường"]].forEach(([n], i) => db.nhanvien.push({ _id: "o" + i, "Mã NV": "OC" + (i + 1), "Họ và tên": n, "Trạng thái": "Đang làm việc" }));
  fs.writeFileSync(fb, JSON.stringify(db));
  ({ app, w, errs } = await launch(DIR));
  await w.click("#nav button[data-k=ocr]");
  const selfTest = await new Promise((res) => { const msgs = []; w.once("dialog", () => {}); w.on("dialog", (d) => msgs.push(d.message())); w.click('#main button:has-text("Kiểm tra OCR")').then(async () => { for (let i = 0; i < 60 && !msgs.length; i++) await w.waitForTimeout(250); res(msgs[0] || ""); }); });
  const report = { generated: new Date().toISOString(), note: "Ảnh mẫu GIẢ LẬP (chữ in / nét x vẽ bằng máy). Không phải chữ viết tay thật.", selfTest, cases: [] };
  const run = async (name, files, mode, truth, thr, tab) => {
    const r = await readFile(w, files, mode, tab); const s = score(r.rows, truth);
    report.cases.push({ name, files, mode: mode || "mặc định", doc: r.ok, rows: r.rows.length, ms: r.ms, cells: s.cells, dung: s.good, doChinhXac: Math.round(s.acc * 10000) / 100, nguong: thr * 100, dat: r.ok && r.rows.length === truth.length && s.acc >= thr, theoDong: s.perRow, saiMau: s.bad });
    console.log((report.cases[report.cases.length - 1].dat ? "PASS " : "FAIL ") + name + " — " + s.good + "/" + s.cells + " ô (" + (s.acc * 100).toFixed(2) + "%) · " + r.rows.length + " dòng · " + r.ms + " ms" + (s.bad.length ? "\n    " + s.bad.slice(0, 4).join("\n    ") : ""));
  };
  await run("Bảng in — ảnh PNG", ["bang-cham-cong-mau.png"], null, PEOPLE, THRESH.printed);
  await run("Bảng in — PDF scan", ["bang-cham-cong-mau.pdf"], null, PEOPLE, THRESH.printed);
  await run("Bảng in — trang PDF do pdf.js vẽ", ["bang-cham-cong-mau-pdfjs.png"], null, PEOPLE, THRESH.printed);
  await run("Bảng tay dấu x (2 khối ngày, mỗi người 1 cột)", ["cham-cong-tay-x-mau.png"], "mark", Object.keys(MARKS).map((k) => [k, MARKS[k].map((v, i) => (k === "Trần Bình" && i === 8 ? 1 : v))]), THRESH.marks);
  await app.close();
  report.errorsJS = errs.slice(0, 5);
  report.tongKet = { cases: report.cases.length, dat: report.cases.filter((c) => c.dat).length, jsErrors: errs.length };
  fs.writeFileSync(path.join(APP, "docs", "V10_1_OCR_CHECK.json"), JSON.stringify(report, null, 1));
  console.log("\nOCR: " + report.tongKet.dat + "/" + report.tongKet.cases + " ca đạt ngưỡng · selfTest: " + selfTest + " · lỗi JS: " + errs.length);
  process.exit(report.tongKet.dat === report.tongKet.cases && !errs.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
