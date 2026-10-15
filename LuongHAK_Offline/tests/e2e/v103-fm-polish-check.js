// V10.3 (đợt chỉnh theo góp ý) — kiểm trên Electron thật: dropdown Loại công thức, ô Kỳ xét, cột Tỷ lệ/Ngưỡng công, số tiền có dấu chấm nghìn. Dữ liệu GIẢ LẬP.
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const ELECTRON = process.env.ELECTRON_PATH || require("electron");
const APP = path.resolve(__dirname, "../..");
const OUT = process.env.E2E_SHOTS || path.join(APP, "docs", "v10_3_screens", "polish");
const ADMIN = { u: "admin", n: "Quản trị E2E", p: "Admin2026e2e" };
let fails = 0;
const ok = (n, c, x) => { if (!c) fails++; console.log((c ? "PASS " : "FAIL ") + n + (x ? " — " + String(x).slice(0, 200) : "")); };
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hak-polish-")); fs.mkdirSync(OUT, { recursive: true });
  const app = await _electron.launch({ executablePath: ELECTRON, args: ["--no-sandbox", APP], env: Object.assign({}, process.env, { HAK_USER_DATA: dir, HAK_NO_SHELL: "1" }) });
  const w = await app.firstWindow(); const errs = []; w.on("pageerror", (e) => errs.push(e.message)); w.on("dialog", (d) => d.accept());
  await w.setViewportSize({ width: 1600, height: 900 }).catch(() => {});
  await w.waitForSelector("#main > *");
  if (/Thiết lập/.test(await w.locator("#top h2").innerText())) {
    for (const [k, v] of [["u", ADMIN.u], ["n", ADMIN.n], ["p", ADMIN.p], ["p2", ADMIN.p]]) await w.fill("#main input[data-f=" + k + "]", v);
    await w.click("#main button.big"); await w.waitForSelector("[data-recovery]"); await w.click(".dlg footer button.pri"); await w.waitForSelector("#nav button[data-k=home]");
  }
  await w.click("#nav button[data-k=backup]"); await w.click('button:has-text("Nạp danh mục chuẩn HAK")'); await w.waitForTimeout(500);
  await w.click("#nav button[data-k=dm]");
  // --- Tăng ca
  await w.click('#main button:has-text("Tăng ca")'); await w.waitForSelector("[data-ot-table]");
  const ky = w.locator("[data-ot-ky]");
  ok("Kỳ xét là ô chọn dạng 'Kỳ MM/YYYY' (không còn ô tháng tiếng Anh)", (await ky.count()) === 1 && /^Kỳ \d\d\/\d{4}/.test(await ky.locator("option:checked").innerText()), await ky.locator("option:checked").innerText());
  await w.screenshot({ path: path.join(OUT, "01-tang-ca-danh-sach.png") });
  await w.click('#main button:has-text("Thêm mã tăng ca")'); await w.waitForSelector("[data-ot-modal]");
  const sel = w.locator('[data-ot-modal] select[data-ot-f="loaiCT"]');
  ok("Thêm mã tăng ca: 'Loại công thức' là dropdown", (await sel.count()) === 1);
  const opts = await sel.locator("option").allInnerTexts();
  ok("Dropdown có lựa chọn 'Theo mã' và TC1–TC6", /Theo mã/.test(opts[0]) && ["TC1", "TC2", "TC3", "TC4", "TC5", "TC6"].every((k) => opts.some((o) => o.startsWith(k + " "))), opts.join(" | "));
  await sel.selectOption({ index: 2 }); await w.screenshot({ path: path.join(OUT, "02-tang-ca-them-moi-dropdown.png") });
  await w.click('[data-ot-modal] button:has-text("Đóng"), .dlg footer button:has-text("Đóng"), .dlg footer button:has-text("Hủy")').catch(() => {}); await w.waitForTimeout(300);
  await w.click("#nav button[data-k=dm]"); await w.click('#main button:has-text("Phụ cấp")'); await w.waitForSelector("[data-ot-table]");
  const heads = await w.locator("[data-ot-table] th").allInnerTexts();
  ok("Phụ cấp: có cột 'Tỷ lệ' và 'Ngưỡng công' riêng, không còn 'Tỷ lệ · Ngưỡng'", heads.some((x) => /^Tỷ lệ/.test(x)) && heads.some((x) => /^Ngưỡng công/.test(x)) && !heads.some((x) => /Tỷ lệ · Ngưỡng/.test(x)), heads.join(" | "));
  const body = await w.locator("[data-ot-table] tbody, [data-ot-table]").first().innerText();
  ok("Số tiền có dấu chấm phân cách hàng nghìn (không còn số trần ≥ 4 chữ số)", !/(^|\s)\d{4,}(\s|$)/.test(body.split("\n").filter((l) => /\t/.test(l)).join(" ")) , body.slice(0, 160).replace(/\s+/g, " "));
  await w.screenshot({ path: path.join(OUT, "03-phu-cap-danh-sach.png") });
  // --- Ô nhập số tiền trong form
  await w.click('#main button:has-text("Thêm mã phụ cấp")'); await w.waitForSelector("[data-ot-modal]");
  const tien = w.locator('[data-ot-modal] input[data-ot-f="tien"]'); await tien.click(); await tien.pressSequentially("1234567");
  ok("Ô Số tiền: gõ 1234567 hiện 1.234.567", (await tien.inputValue()) === "1.234.567", await tien.inputValue());
  await tien.fill(""); await tien.pressSequentially("1500000,5");
  ok("Ô Số tiền: giữ phần thập phân bằng dấu phẩy", (await tien.inputValue()) === "1.500.000,5", await tien.inputValue());
  await tien.fill(""); await tien.pressSequentially("300000");
  await w.fill('[data-ot-modal] input[data-ot-f="ma"]', "ZZ1"); await w.fill('[data-ot-modal] input[data-ot-f="ten"]', "Phụ cấp thử định dạng"); await w.fill('[data-ot-modal] input[data-ot-f="tu"]', "01/01/2026");
  await w.screenshot({ path: path.join(OUT, "04-phu-cap-o-nhap-so-tien.png") });
  await w.click('[data-ot-modal] button:has-text("Lưu thông tin")'); await w.waitForTimeout(600);
  await w.click('[data-ot-modal] button:has-text("Đóng")').catch(() => {}); await w.waitForTimeout(300);
  const zrow = w.locator('tr[data-ot-row="ZZ1"]');
  ok("Lưu xong: danh sách hiện 300.000 (giá trị lưu là 300000)", (await zrow.count()) === 1 && /300\.000/.test(await zrow.innerText()), (await zrow.count()) ? (await zrow.innerText()).replace(/\s+/g, " ").slice(0, 100) : "không có dòng ZZ1");
  ok("không lỗi JavaScript", errs.length === 0, errs.join(" | "));
  await app.close(); console.log(fails ? "FAILED " + fails : "ALL PASS"); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
