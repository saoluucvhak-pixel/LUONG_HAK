// Kiểm thử end-to-end trên ứng dụng Electron thật (bản đóng gói chạy từ mã nguồn).
// Chạy: ELECTRON_PATH=<đường dẫn electron> PLAYWRIGHT_MODULE=<đường dẫn playwright> node tests/e2e/run-e2e.js
// (Linux không màn hình: xvfb-run -a node tests/e2e/run-e2e.js)
/* global document, DataTransfer, ClipboardEvent */ // dùng trong các hàm w.evaluate(...) chạy bên trong cửa sổ app
// Dùng thư mục dữ liệu tạm (biến HAK_USER_DATA) — không đụng dữ liệu thật.
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const ELECTRON = process.env.ELECTRON_PATH || require("electron");
const APP = path.resolve(__dirname, "../..");
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "hak-e2e-"));
const DL = path.join(DATA, "downloads"); fs.mkdirSync(DL);
const results = [];
let dialogMode = "accept"; // "dismiss" = bấm Hủy ở hộp xác nhận
function ok(name, cond, extra) { results.push({ name, pass: !!cond, extra: extra || "" }); console.log((cond ? "PASS " : "FAIL ") + name + (extra ? " — " + extra : "")); }

const ADMIN = { u: "admin", n: "Quản trị E2E", p: "Admin2026e2e" };
const shotDir = process.env.E2E_SHOTS || "";
const shotOf = async (pg, name) => { if (shotDir) { fs.mkdirSync(shotDir, { recursive: true }); await pg.screenshot({ path: path.join(shotDir, name + ".png") }).catch(() => {}); } };
let dialogs = [], dismissConfirm = false; // dismissConfirm: bấm "Hủy" ở hộp xác nhận tiếp theo
// Đăng nhập (hoặc tạo Admin đầu tiên nếu dữ liệu chưa có tài khoản). Màn hình khôi phục (file hỏng) không cần đăng nhập.
async function auth(w, who) {
  who = who || ADMIN;
  const t = await w.locator("#top h2").innerText();
  if (/Thiết lập/.test(t)) {
    for (const [k, v] of [["u", who.u], ["n", who.n], ["p", who.p], ["p2", who.p]]) await w.fill("#main input[data-f=" + k + "]", v);
    await w.click("#main button.big"); await w.waitForSelector("[data-recovery]");
    const code = await w.locator("[data-recovery]").innerText();
    await w.click(".dlg footer button.pri"); await w.waitForSelector("#nav button[data-k=home]");
    return { setup: true, code };
  }
  if (/Đăng nhập/.test(t)) {
    await w.fill("#main input[data-f=u]", who.u); await w.fill("#main input[data-f=p]", who.p);
    await w.click("#main button.big"); await w.waitForSelector("#nav button[data-k=home], .dlg", { timeout: 8000 });
    return { login: true };
  }
  return {};
}
async function launch(dataDir, opt) {
  opt = opt || {};
  const app = await _electron.launch({ executablePath: ELECTRON, args: ["--no-sandbox", APP], env: Object.assign({}, process.env, { HAK_USER_DATA: dataDir || DATA, HAK_DOWNLOAD_DIR: DL, HAK_NO_SHELL: "1" }, opt.env || {}) });
  const w = await app.firstWindow(); const errs = [];
  w.on("pageerror", (e) => errs.push(e.message));
  w.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  w.on("dialog", (d) => { dialogs.push(d.message()); if (d.type() === "confirm" && (dismissConfirm || dialogMode === "dismiss")) { dismissConfirm = false; d.dismiss(); } else d.accept(d.type() === "prompt" ? "e2e" : undefined); });
  await w.waitForSelector("#main > *");
  const a = opt.noAuth ? {} : await auth(w, opt.who);
  return { app, w, errs, a };
}

(async () => {
  const t0 = Date.now();
  let { app, w, errs, a } = await launch();
  ok("Mở ứng dụng", true, (Date.now() - t0) + " ms");
  ok("Dữ liệu mới: bắt buộc tạo tài khoản Admin + cấp mã khôi phục", a.setup && /^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/.test(a.code), a.code);
  const recoveryCode = a.code;
  ok("Cầu nối lưu trữ (preload) hoạt động", await w.evaluate(() => !!window.hakStore && typeof window.hakStore.save === "function"));
  const ui = await w.evaluate(async () => { await document.fonts.ready; return { font: document.fonts.check('600 16px "Be Vietnam Pro"') && [...document.fonts].some((f) => f.family.replace(/"/g, "") === "Be Vietnam Pro" && f.status === "loaded"), icons: document.querySelectorAll("#nav svg.icn").length, emoji: [...document.querySelectorAll("#nav .ic")].filter((e) => e.textContent.trim()).length }; });
  ok("Giao diện: font Be Vietnam Pro đóng gói nạp được, menu dùng icon SVG", ui.font && ui.icons >= 14 && ui.emoji === 0, JSON.stringify(ui));
  await w.click("#nav button[data-k=backup]"); await w.click('button:has-text("Nạp danh mục chuẩn HAK")');
  // nhân viên + chấm công
  await w.click("#nav button[data-k=nhansu]"); await w.click('button:has-text("Thêm nhân viên")');
  const F = (l) => w.locator(".dlg .fld", { hasText: l }).first();
  await F("Họ và tên").locator("input").fill("E2E Nhân Viên");
  await F("Ngày vào làm").locator("input").fill("2025-01-01");
  await F("Phòng ban").locator("select").selectOption("01.01");
  await F("Mã lương").locator("label.chip", { hasText: "TG1" }).click();
  await F("Lương thỏa thuận").locator("input").fill("12.000.000");
  await F("Lương cơ bản").locator("input").fill("6.000.000");
  await F("Thuế TNCN").locator("select").selectOption("MT00");
  await F("Hình thức trả lương").locator("select").selectOption("Tiền mặt");
  const qtDefault = await F("Quốc tịch").locator("input").inputValue();
  await F("Trình độ học vấn").locator("input").fill("12/12");
  await F("Vị trí việc làm").locator("input").fill("Kế toán viên");
  { // V10.1: dữ liệu sai → KHÔNG lưu nửa chừng, báo rõ trường, form giữ nguyên dữ liệu đang nhập
    dialogs = []; await F("Số CCCD").locator("input").fill("123");
    await w.click('button:has-text("Lưu nhân viên")'); await w.waitForTimeout(500);
    const dBad = JSON.parse(fs.readFileSync(path.join(DATA, "data.json"), "utf8"));
    ok("V10.1: Thêm nhân viên với CCCD sai bị chặn, báo trường lỗi, KHÔNG ghi hồ sơ nào", dialogs.some((d) => /12 chữ số/.test(d)) && !(dBad.nhanvien || []).some((r) => r["Mã NV"] === "NV001") && !(dBad.hopdong || []).some((r) => r["Mã NV"] === "NV001"), dialogs.join(" | ").slice(0, 160));
    ok("V10.1: form vẫn mở và giữ nguyên dữ liệu đã nhập sau khi bị từ chối", (await w.locator(".dlg").count()) === 1 && (await F("Họ và tên").locator("input").inputValue()) === "E2E Nhân Viên");
    await F("Số CCCD").locator("input").fill("");
  }
  await w.click('button:has-text("Lưu nhân viên")');
  await w.waitForTimeout(700);
  { // α18: form Thêm nhân viên có đủ trường sổ lao động; sổ báo ai còn thiếu + mở đúng tab hồ sơ
    const d0 = JSON.parse(fs.readFileSync(path.join(DATA, "data.json"), "utf8"));
    const cn0 = (d0.canhan || []).find((r) => r["Mã NV"] === "NV001") || {}, hv0 = (d0.hocvan || []).find((r) => r["Mã NV"] === "NV001") || {};
    ok("Thêm nhân viên: có Quốc tịch (mặc định Việt Nam), Trình độ, Vị trí việc làm → lưu Trình độ học vấn; chỉ có quốc tịch mặc định thì chưa tạo Thông tin cá nhân", qtDefault === "Việt Nam" && !cn0["Mã NV"] && hv0["Trình độ học vấn"] === "12/12" && ((d0.chitiethd || []).find((r) => r["Mã NV"] === "NV001") || {})["Vị trí việc làm"] === "Kế toán viên", JSON.stringify({ qtDefault, cn: !!cn0["Mã NV"], hv: hv0["Trình độ học vấn"] }));
    await w.click("#nav button[data-k=baocao]"); await w.click('#main button:has-text("Sổ quản lý lao động")');
    const nThieu = +(await w.locator("[data-sld-thieu]").getAttribute("data-sld-thieu"));
    await w.click('[data-sld-thieu] button:has-text("Xem danh sách")');
    const thieuTxt = await w.locator("[data-sld-thieu] table").innerText();
    await w.locator("[data-sld-thieu] button.chipbtn", { hasText: "Thông tin cá nhân" }).first().click(); await w.waitForTimeout(200);
    const onTab = await w.locator(".subtabs button.on").first().innerText();
    ok("Sổ lao động: liệt kê người thiếu thông tin (CCCD, giới tính…), bấm mục → mở đúng tab hồ sơ", nThieu === 1 && /Số CCCD/.test(thieuTxt) && /Giới tính/.test(thieuTxt) && !/Trình độ học vấn/.test(thieuTxt) && !/Vị trí việc làm/.test(thieuTxt) && /Thông tin cá nhân/.test(onTab) && (await w.locator("#top h2").innerText()) === "Hồ sơ nhân viên", nThieu + " · " + thieuTxt.replace(/\s+/g, " ").slice(0, 160) + " · tab " + onTab);
  }
  await w.evaluate(() => { const s = JSON.parse(localStorage.getItem("luonghak_db_v1_ui") || "{}"); s.nam = 2026; s.thang = 9; localStorage.setItem("luonghak_db_v1_ui", JSON.stringify(s)); });
  await w.click("#nav button[data-k=chamcong]");
  await w.selectOption("#top select", "9"); await w.fill("#top input[type=number]", "2026"); await w.dispatchEvent("#top input[type=number]", "change");
  await w.click('button:has-text("Thêm dòng")');
  const row = w.locator("main tbody tr").last().locator("input");
  await row.nth(0).fill("NV001"); await row.nth(0).dispatchEvent("change");
  for (let d = 1; d <= 30; d++) if (new Date(2026, 8, d).getDay()) { await row.nth(1 + d).fill("1"); await row.nth(1 + d).dispatchEvent("change"); }
  // Ô ngày không hợp lệ: số âm bị từ chối + giữ nguyên; ngày 31/09 không cho nhập
  dialogs = [];
  await row.nth(1 + 6).fill("-1"); await row.nth(1 + 6).dispatchEvent("change"); await w.waitForTimeout(200);
  const v6 = await row.nth(1 + 6).inputValue(), dis31 = await row.nth(1 + 31).isDisabled();
  // Dán từ Excel: ô sai (-1) KHÔNG được ghi, ô đúng vẫn ghi (ngày 13 là Chủ nhật, đang trống)
  await row.nth(1 + 13).evaluate((el) => { const dt = new DataTransfer(); dt.setData("text/plain", "-1\t1"); el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); });
  await w.waitForTimeout(300);
  const row2 = w.locator("main tbody tr").last().locator("input"), v13 = await row2.nth(1 + 13).inputValue(), v14 = await row2.nth(1 + 14).inputValue();
  ok("Dán từ Excel: ô '-1' không được ghi, ô hợp lệ vẫn ghi", v13 === "" && v14 === "1", "13='" + v13 + "', 14='" + v14 + "'");
  ok("Chấm công: ô '-1' bị từ chối (giữ trống), cột 31 tháng 9 bị khóa", v6 === "" && dis31 && dialogs.some((d) => /không được âm/.test(d)), "ô 06='" + v6 + "', 31 khóa=" + dis31 + " | " + dialogs.join(" | "));
  // tính + chốt
  await w.click("#nav button[data-k=luong]");
  ok("V10: Tính lương có thanh 7 bước", (await w.locator("[data-steps7] li").count()) === 7);
  await w.click("button.big");
  const line = await w.locator("main tbody tr").first().innerText();
  ok("Tính lương: 12.000.000 − BH 630.000 = 11.370.000", /11\.370\.000/.test(line), line.replace(/\t/g, " | "));
  // V5: Bảng tính lương nội bộ + bộ lọc dùng chung + xuất PDF thật
  await w.click("#nav button[data-k=bangtinh]");
  const btHead = (await w.locator("table[data-bangtinh] thead").innerText()).replace(/\s+/g, " ");
  const btBody = (await w.locator("table[data-bangtinh]").innerText()).replace(/\s+/g, " ");
  ok("Bảng tính lương nội bộ: có Tổng thu nhập, KHÔNG có BH/Thuế/Thực lĩnh", /Tổng thu nhập/.test(btHead) && !/Thực lĩnh|BH trừ|Thuế|Tạm ứng/.test(btHead) && /12\.000\.000/.test(btBody), btHead);
  await w.locator("[data-rf-key=tuKhoa]").fill("zzzkhongco"); await w.locator("[data-rf-key=tuKhoa]").dispatchEvent("change");
  ok("Bộ lọc dùng chung: từ khóa không khớp → 'Không có dòng nào khớp bộ lọc'", (await w.locator("main").innerText()).includes("Không có dòng nào khớp bộ lọc"));
  await w.locator("[data-rf-key=tuKhoa]").fill(""); await w.locator("[data-rf-key=tuKhoa]").dispatchEvent("change");
  ok("Bộ lọc dùng chung: bỏ từ khóa → hiện lại dòng", /12\.000\.000/.test(await w.locator("table[data-bangtinh]").innerText()));
  { // V9.4: bộ lọc mới — một popover tại một thời điểm, Áp dụng/Hủy, Escape, chip, Đặt lại; không lỗi JS
    const errs0 = errs.length, keys = await w.locator("[data-rf] button.fbtn").evaluateAll((bs) => bs.map((b) => b.getAttribute("data-fkey")));
    const pops = () => w.locator("[data-fpop]").count();
    ok("Bộ lọc V9.4: thanh lọc là nút (không còn dropdown details), có ≥3 nhóm", keys.length >= 3 && (await w.locator("details.msel").count()) === 0, keys.join(","));
    await w.locator('[data-fkey="' + keys[0] + '"]').click(); const p1 = await pops();
    await w.locator('[data-fkey="' + keys[1] + '"]').click(); const p2 = await pops(), id2 = await w.locator("[data-fpop]").getAttribute("data-fpop");
    ok("Bộ lọc V9.4: mở nhóm khác thì nhóm trước tự đóng — luôn đúng 1 popover", p1 === 1 && p2 === 1 && id2 === keys[1], p1 + "," + p2 + "," + id2);
    await w.keyboard.press("Escape"); const p3 = await pops();
    await w.locator('[data-fkey="' + keys[1] + '"]').click(); await w.locator('[data-fkey="' + keys[1] + '"]').click(); const p4 = await pops();
    await w.locator('[data-fkey="' + keys[1] + '"]').click(); await w.mouse.click(5, 5); const p5 = await pops();
    ok("Bộ lọc V9.4: Escape / bấm lại nút / bấm ra ngoài đều đóng popover", p3 === 0 && p4 === 0 && p5 === 0, [p3, p4, p5].join(","));
    // popover nằm trong cửa sổ và không tràn
    await w.locator('[data-fkey="' + keys[0] + '"]').click();
    await shotOf(w, "01-bo-loc-popover");
    const box = await w.locator("[data-fpop]").boundingBox(), vp = w.viewportSize() || { width: 1280, height: 800 };
    ok("Bộ lọc V9.4: popover nằm trọn trong cửa sổ", box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width + 1 && box.y + box.height <= vp.height + 1, JSON.stringify(box));
    const rows = await w.locator("[data-fpop] .fpop-row").count();
    if (rows >= 2) {
      await w.locator("[data-fpop] .fpop-row input").first().check(); await w.locator("[data-fpop] button:has-text('Hủy')").click();
      const lblCancel = await w.locator('[data-fkey="' + keys[0] + '"]').innerText();
      await w.locator('[data-fkey="' + keys[0] + '"]').click(); await w.locator("[data-fpop] .fpop-row input").first().check(); await w.locator("[data-fpop] button:has-text('Áp dụng')").click(); await w.waitForTimeout(150);
      const lblApply = await w.locator('[data-fkey="' + keys[0] + '"]').innerText(), chips = await w.locator("[data-fchips] .fchip").count();
      ok("Bộ lọc V9.4: Hủy giữ nguyên ('Tất cả'); Áp dụng mới lọc → nhãn '(1)' và có chip điều kiện", /Tất cả/.test(lblCancel) && /\(1\)/.test(lblApply) && chips === 1, lblCancel + " | " + lblApply + " | chips=" + chips);
      await w.locator("[data-fchips] button:has-text('Xóa tất cả')").click(); await w.waitForTimeout(150);
      ok("Bộ lọc V9.4: Xóa tất cả → hết chip, mọi popover đóng, bảng đầy đủ", (await w.locator("[data-fchips] .fchip").count()) === 0 && (await pops()) === 0 && /12\.000\.000/.test(await w.locator("table[data-bangtinh]").innerText()));
    } else { await w.keyboard.press("Escape"); ok("Bộ lọc V9.4: (bỏ qua Áp dụng/Hủy: dữ liệu mẫu chỉ có 1 lựa chọn)", true); }
    // Áp dụng / Hủy / Chọn tất cả / Tìm không dấu trên CHÍNH thành phần của app với dữ liệu thử 3 lựa chọn (dữ liệu mẫu chỉ có 1)
    await w.evaluate(() => { window.__ap = undefined; const host = document.createElement("div"); host.id = "fp-host"; host.style.cssText = "position:fixed;left:20px;bottom:10px;z-index:5"; document.body.appendChild(host);
      host.appendChild(window.HAKUI.filter.button({ id: "t:thu", label: "Thử", options: ["Sản xuất", "Văn phòng", "Kho vận"], selected: [], onApply: (v) => { window.__ap = v; } })); });
    const fbtn = w.locator("#fp-host [data-fkey='t:thu']");
    await fbtn.click(); const upDir = await w.locator("[data-fpop]").getAttribute("data-dir");
    await w.locator("[data-fpop] .fpop-row", { hasText: "Sản xuất" }).locator("input").check();
    const apTick = await w.evaluate(() => window.__ap);
    await w.locator("[data-fpop] button:has-text('Hủy')").click();
    ok("Bộ lọc V9.4: tick checkbox KHÔNG áp dụng ngay; Hủy bỏ lựa chọn nháp; popover gần mép dưới mở lên trên", apTick === undefined && (await w.evaluate(() => window.__ap)) === undefined && upDir === "up", String(upDir));
    await fbtn.click(); await w.locator("[data-fpop] input.i").fill("van phong");
    const shown = await w.locator("[data-fpop] .fpop-row").allInnerTexts();
    await w.locator("[data-fpop] .fpop-row input").first().check(); await w.locator("[data-fpop] button:has-text('Áp dụng')").click();
    ok("Bộ lọc V9.4: tìm không dấu 'van phong' ra 'Văn phòng'; Áp dụng trả đúng giá trị đã chọn", shown.length === 1 && /Văn phòng/.test(shown[0]) && JSON.stringify(await w.evaluate(() => window.__ap)) === '["Văn phòng"]', shown.join(",") + " → " + JSON.stringify(await w.evaluate(() => window.__ap)));
    await fbtn.click(); await w.locator("[data-fpop] button:has-text('Chọn tất cả')").click(); await w.locator("[data-fpop] button:has-text('Áp dụng')").click();
    ok("Bộ lọc V9.4: chọn hết = không lọc (trả mảng rỗng)", JSON.stringify(await w.evaluate(() => window.__ap)) === "[]");
    await fbtn.click(); await w.mouse.click(600, 100);
    ok("Bộ lọc V9.4: bấm ra ngoài đóng popover", (await pops()) === 0);
    await w.evaluate(() => document.getElementById("fp-host").remove());
    ok("Bộ lọc V9.4: thao tác liên tiếp không sinh lỗi JavaScript", errs.length === errs0, errs.slice(errs0).join(" | "));
  }
  await w.locator("main button", { hasText: "Xuất PDF" }).click();
  let pdfName = null; for (let i = 0; i < 100 && !pdfName; i++) { await w.waitForTimeout(300); pdfName = fs.readdirSync(DL).filter((f) => /^BangTinhLuong_2026-09\.pdf$/.test(f))[0]; }
  const pdfBuf = pdfName ? fs.readFileSync(path.join(DL, pdfName)) : Buffer.alloc(0);
  const pdfTxt = pdfBuf.toString("latin1");
  ok("Xuất PDF: file thật (%PDF-), có ≥1 trang, kích thước hợp lý", pdfBuf.slice(0, 5).toString() === "%PDF-" && /\/Type\s*\/Page(?![s\w])/.test(pdfTxt) && pdfBuf.length > 2000, pdfName + " " + pdfBuf.length + "B");
  // V5 (nối rộng): Báo cáo lương dùng chung bộ lọc + PDF; Tính lương xuất PDF bảng lương / chuyển khoản
  {
    const waitPdf = async (re, before) => { let n = null; for (let i = 0; i < 100 && !n; i++) { await w.waitForTimeout(300); n = fs.readdirSync(DL).filter((f) => re.test(f) && !before.includes(f))[0]; } return n; };
    const isPdf = (n) => { const b = n ? fs.readFileSync(path.join(DL, n)) : Buffer.alloc(0); return b.slice(0, 5).toString() === "%PDF-" && /\/Type\s*\/Page(?![s\w])/.test(b.toString("latin1")) && b.length > 1500; };
    await w.click("#nav button[data-k=baocaoluong]");
    await w.locator("main .bar button", { hasText: "Phiếu chi lương" }).first().click();
    const pcAll = (await w.locator("main table").first().innerText()).replace(/\s+/g, " ");
    await w.locator("[data-rf-key=tuKhoa]").fill("zzzkhongco"); await w.locator("[data-rf-key=tuKhoa]").dispatchEvent("change");
    ok("Báo cáo lương (Phiếu chi): bộ lọc dùng chung — từ khóa không khớp → hết dòng; xóa lọc → hiện lại", /Không có dữ liệu/.test(await w.locator("main").innerText()) && /PC-L/.test(pcAll));
    await w.locator("main .bar button", { hasText: "Tổng hợp theo phòng ban" }).first().click();
    const hint = await w.locator("[data-rf-hint]").innerText();
    ok("Báo cáo không có cột Mã NV (theo phòng ban): báo rõ tiêu chí 'Từ khóa' không áp được, không âm thầm lọc mất dòng", /Không áp được/.test(hint) && /Từ khóa/.test(hint) && (await w.locator("main table tbody tr").count()) >= 1, hint);
    await w.locator("[data-rf-key=tuKhoa]").fill(""); await w.locator("[data-rf-key=tuKhoa]").dispatchEvent("change");
    let before = fs.readdirSync(DL);
    await w.locator("main .card .bar button", { hasText: "Xuất PDF" }).first().click();
    const p1 = await waitPdf(/^BaoCao_.*\.pdf$/, before);
    ok("Báo cáo lương: Xuất PDF ra file PDF thật", isPdf(p1), String(p1));
    await w.click("#nav button[data-k=luong]"); if (await w.locator("button.big").count()) await w.click("button.big");
    await w.locator("main select[aria-label='Loại PDF']").selectOption("bl");
    before = fs.readdirSync(DL);
    await w.locator("main .bar button", { hasText: "Xuất PDF…" }).click();
    const p2 = await waitPdf(/^BangLuong_.*\.pdf$/, before);
    ok("Tính lương: PDF 'Bảng lương' (theo bộ lọc) ra file PDF thật", isPdf(p2), String(p2));
    // Chấm công dùng bộ lọc chung (không còn ô tìm riêng)
    await w.click("#nav button[data-k=chamcong]");
    const nAll = await w.locator("main table tbody tr").count();
    await w.locator("[data-rf-key=tuKhoa]").fill("zzzkhongco"); await w.locator("[data-rf-key=tuKhoa]").dispatchEvent("change");
    const nNone = await w.locator("main table tbody tr").count(), hasOld = await w.locator("main input.search").count();
    await w.locator("[data-rf-key=tuKhoa]").fill(""); await w.locator("[data-rf-key=tuKhoa]").dispatchEvent("change");
    const nBack = await w.locator("main table tbody tr").count();
    ok("Chấm công: dùng thanh lọc chung (từ khóa, phòng ban), không còn ô tìm riêng; lọc không khớp → hết dòng, xóa lọc → hiện lại", nAll > 0 && nNone === 0 && nBack === nAll && hasOld === 0, [nAll, nNone, nBack, hasOld].join("/"));
  }
  await w.click("#nav button[data-k=luong]"); if (await w.locator("button.big").count()) await w.click("button.big");
  // Master Prompt V3 mục 16.3: "Xem chi tiết cách tính" — bấm 1 dòng bảng lương → phiếu lương, chuyển sang xem công thức
  await w.locator("main tbody tr").first().click(); await w.waitForSelector(".dlg");
  const slipHeader = await w.locator(".dlg header h3").innerText();
  await w.click('.dlg footer button:has-text("Xem cách tính")'); await w.waitForTimeout(150);
  const ctTxt = await w.locator(".dlg .bd").innerText();
  ok("Xem chi tiết cách tính (mục 16.3): hiện công chuẩn, công tính TG, BH, thuế, thực lĩnh với giá trị đã thế",
    /Công chuẩn/.test(ctTxt) && /Công tính TG/.test(ctTxt) && /Lương thời gian/.test(ctTxt) && /Thuế TNCN/.test(ctTxt) && /Thực lĩnh/.test(ctTxt) && /11\.370\.000/.test(ctTxt),
    ctTxt.replace(/\s+/g, " ").slice(0, 250));
  await w.click('.dlg footer button:has-text("Xem phiếu lương")'); await w.waitForTimeout(150);
  ok("Quay lại phiếu lương từ màn hình cách tính", (await w.locator(".dlg header h3").innerText()) === slipHeader);
  await w.click('.dlg footer button:has-text("Đóng")');
  // V10: màn hình Kiểm tra bảng lương
  await w.click("#nav button[data-k=ktbl]"); await w.waitForSelector("table.kt");
  const ktTxt = await w.locator("#main").innerText(), ktRows = await w.locator("table.kt tbody tr").count();
  ok("V10: Kiểm tra bảng lương — có bảng kiểm tra phân mức ERROR/WARNING/INFO, nút Kiểm tra lại, Xuất Excel", ktRows >= 20 && /Kiểm tra lại/.test(ktTxt) && /Xuất Excel/.test(ktTxt) && /INFO/.test(ktTxt), "rows=" + ktRows);
  await w.click('#main button:has-text("Thông tin (")');
  ok("V10: Kiểm tra bảng lương — lọc theo mức chỉ còn đúng mức đã chọn", (await w.locator('table.kt tbody tr:not([data-sev="INFO"])').count()) === 0);
  // Master Prompt mục VII: Danh mục → Công thức tiền lương — 7 tab, lọc theo Loại, thư viện biến, mẫu, chạy thử, lịch sử
  await w.click("#nav button[data-k=caidat]");
  const ctTabs = await w.locator(".bar.sub button").allInnerTexts();
  ok("Công thức tiền lương: đủ 7 tab (mục VII) + Trình thiết lập", ["Trình thiết lập công thức", "Tăng ca", "Phụ cấp", "Hỗ trợ", "Thư viện biến", "Mẫu công thức", "Kiểm tra công thức", "Lịch sử phiên bản"].every((t) => ctTabs.includes(t)), ctTabs.join(", "));
  const wzTxt = await w.locator("[data-ct-wizard]").innerText();
  ok("V10: Trình thiết lập công thức — có 4 bước, giải thích bằng số thật và kết quả", /Bước 1/.test(wzTxt) && /Bước 4/.test(wzTxt) && (await w.locator("[data-ct-wizard-explain]").innerText()).includes("Kết quả"));
  await w.fill('[data-ct-wizard] input[aria-label="Mã công thức"]', "WZ_E2E"); await w.dispatchEvent('[data-ct-wizard] input[aria-label="Mã công thức"]', "change");
  await w.click('[data-ct-wizard] button:has-text("Lưu thành Nháp")'); await w.waitForTimeout(300);
  await w.locator(".bar.sub button", { hasText: "Tăng ca" }).click();
  ok("V10.2: tab Tăng ca của Cài đặt chỉ trỏ sang Danh mục tăng ca (không còn lưới Excel) và vẫn liệt kê công thức chưa gắn mã cha (WZ_E2E)", (await w.locator("[data-ct-ot-pointer]").count()) === 1 && (await w.locator("[data-ct-ot-unlinked]").innerText()).includes("WZ_E2E") && (await w.locator("main tbody tr.catedit").count()) === 0);
  // V10.2: tạo mã tăng ca TC_E2E (cha) rồi tạo công thức con ngay trong Form Modal Master–Detail
  await w.click("#nav button[data-k=dm]"); await w.click('#main button:has-text("Tăng ca")');
  ok("V10.2: Danh mục tăng ca là danh sách Master (không phải bảng nhập Excel)", (await w.locator("[data-ot-master]").count()) === 1 && (await w.locator("[data-ot-table]").count()) === 1 && (await w.locator("main tr.catedit").count()) === 0);
  await w.click('[data-ot-master] button:has-text("Thêm mã tăng ca")'); await w.waitForSelector("[data-ot-modal]");
  const otFill = async (key, v) => { const el = w.locator('[data-ot-modal] [data-ot-f="' + key + '"]'); await el.fill(v); await el.dispatchEvent("change"); await el.dispatchEvent("input"); };
  await otFill("ma", "TC_E2E"); await otFill("ten", "Tăng ca kiểm thử E2E"); await otFill("heSo", "1.5"); await otFill("tu", "01/01/2020");
  await w.click("[data-ot-save-info]"); await w.waitForTimeout(300);
  ok("V10.2: lưu mã tăng ca mới trong modal → header hiện mã, chuyển sang chế độ chỉ xem", (await w.locator(".ot-dlg header h3").innerText()).includes("TC_E2E") && (await w.locator("[data-ot-edit-info]").count()) === 1);
  await w.click('[data-ot-tab="ct"]'); await w.click("[data-ot-new-ver]"); await w.waitForSelector("[data-ot-designer=edit]");
  ok("V10.2: trình thiết kế hiện thư viện biến lấy từ formula-variables (CONG_CHU_NHAT, HE_SO_TC…)", (await w.locator("[data-ot-vars]").innerText()).includes("CONG_CHU_NHAT") && (await w.locator("[data-ot-vars]").innerText()).includes("HE_SO_TC"));
  await w.click('[data-ot-mode="adv"]');
  await w.fill('[data-ot-designer] [data-ot-fd="tu"]', "01/01/2020"); await w.dispatchEvent('[data-ot-designer] [data-ot-fd="tu"]', "change");
  await w.fill("[data-ot-expr]", "CONG_TC * HE_SO_TC * 2");
  ok("V10.2: biểu thức hợp lệ được kiểm bằng cùng validator + có giải thích tiếng Việt", (await w.locator("[data-ot-syntax=ok]").count()) === 1 && (await w.locator("[data-ot-explain]").innerText()).includes("Công tăng ca"), await w.locator("[data-ot-explain]").innerText());
  await w.click("[data-ot-save-formula]"); await w.waitForTimeout(300);
  ok("V10.2: công thức con mới lưu ở trạng thái Nháp, hiện trong danh sách phiên bản của đúng mã cha", (await w.locator('tr[data-ot-ver="TC_E2E#1"]').innerText()).includes("Nháp"));
  await w.click('[data-ot-close]'); await w.waitForTimeout(200);
  await w.click("#nav button[data-k=caidat]");
  await w.locator(".bar.sub button", { hasText: "Phụ cấp" }).click();
  const pcEmpty = await w.locator("main .empty").count();
  ok("Lọc theo Loại: mã TC_E2E (OVERTIME) KHÔNG hiện ở tab Phụ cấp (ALLOWANCE)", pcEmpty > 0 && !(await w.locator("main").innerText()).includes("TC_E2E"));
  await w.locator(".bar.sub button", { hasText: "Thư viện biến" }).click();
  const varsTxt = await w.locator("main").innerText();
  ok("Tab Thư viện biến: liệt kê biến đã khai báo (CONG_TC, HE_SO_TC…)", varsTxt.includes("CONG_TC") && varsTxt.includes("HE_SO_TC") && varsTxt.includes("Công tăng ca"));
  await w.locator(".bar.sub button", { hasText: "Mẫu công thức" }).click();
  const mauTxt = await w.locator("main").innerText();
  ok("Tab Mẫu công thức: có công thức mẫu tham khảo (TC3-style)", mauTxt.includes("(CONG_TC + CONG_CHU_NHAT) * HE_SO_TC"));
  await w.locator(".bar.sub button", { hasText: "Kiểm tra công thức" }).click();
  await w.locator("main select").first().selectOption("OVERTIME");
  const ctSelMa = w.locator("main select").nth(1);
  const maOptVal = await ctSelMa.evaluate((el) => [...el.options].find((o) => o.text.includes("TC_E2E")).value);
  await ctSelMa.selectOption(maOptVal);
  const exprVal = await w.locator("main textarea").inputValue();
  ok("Kiểm tra công thức: chọn Mã công thức → nạp đúng biểu thức vừa lưu", exprVal === "CONG_TC * HE_SO_TC * 2", exprVal);
  await w.locator("main tr", { hasText: "CONG_TC" }).locator("input").fill("10");
  await w.locator("main tr", { hasText: "CONG_TC" }).locator("input").dispatchEvent("change");
  await w.locator("main tr", { hasText: "HE_SO_TC" }).locator("input").fill("2");
  await w.locator("main tr", { hasText: "HE_SO_TC" }).locator("input").dispatchEvent("change");
  const ctResult = await w.locator("main .kpis .kpi").first().innerText();
  ok("Kiểm tra công thức: CONG_TC=10, HE_SO_TC=2 → 10×2×2 = 40 (không ghi vào bảng lương thật)", /40/.test(ctResult), ctResult.replace(/\s+/g, " "));
  await w.locator(".bar.sub button", { hasText: "Lịch sử phiên bản" }).click();
  await w.locator("main select").first().selectOption("TC_E2E");
  const histTxt = await w.locator("main").innerText();
  ok("Lịch sử phiên bản: hiện đúng mã (chọn mặc định đã là mã duy nhất) + phiên bản Trạng thái Hiệu lực + biểu thức", histTxt.includes("TC_E2E") && histTxt.includes("Hiệu lực") && histTxt.includes("CONG_TC * HE_SO_TC * 2"), histTxt.replace(/\s+/g, " ").slice(0, 300));
  ok("Lịch sử phiên bản: V9.4 mọi lần Lưu danh mục đều ghi nhật ký (hiện dòng Thêm danh mục của TC_E2E)", histTxt.includes("Tạo Nháp TC_E2E") || histTxt.includes("Thêm danh mục") || histTxt.includes("Chưa có nhật ký khớp mã này"), histTxt.replace(/\s+/g, " ").slice(0, 300));
  // V5 GĐ2: duyệt & phiên bản — Ngừng bản hiệu lực, sao chép thành v2 (Nháp), gửi duyệt; Admin thấy đủ nút
  ok("Lịch sử phiên bản: hiện cột Người lập/Người duyệt và nút Ngừng + Sao chép cho bản Hiệu lực", histTxt.includes("Người lập") && histTxt.includes("Ngừng") && histTxt.includes("Sao chép bản mới"), histTxt.replace(/\s+/g, " ").slice(0, 200));
  const verBtn = (v, t) => w.locator('tr[data-ct-ver="TC_E2E#' + v + '"] button', { hasText: t });
  ok("Bản mới tạo ở lưới luôn là Nháp (không tự đặt Hiệu lực)", (await w.locator('tr[data-ct-ver="TC_E2E#1"]').innerText()).includes("Nháp"));
  await verBtn(1, "Gửi duyệt").click(); await verBtn(1, "Duyệt").first().click();
  await verBtn(1, "Kích hoạt").click(); // chưa nhập lý do → bị chặn, vẫn 'Đã duyệt'
  ok("Kích hoạt thiếu lý do bị chặn", (await w.locator('tr[data-ct-ver="TC_E2E#1"]').innerText()).includes("Đã duyệt"));
  await w.locator('input[data-ct-reason]').fill("e2e kích hoạt"); await verBtn(1, "Kích hoạt").click();
  ok("Nháp → Chờ duyệt → Đã duyệt → Hiệu lực: ghi người kích hoạt + lý do", /Hiệu lực/.test(await w.locator('tr[data-ct-ver="TC_E2E#1"]').innerText()) && (await w.locator('tr[data-ct-ver="TC_E2E#1"]').innerText()).includes("e2e kích hoạt"));
  await w.locator('input[data-ct-reason]').fill("e2e ngừng"); await verBtn(1, "Ngừng").click();
  const v1Txt = await w.locator('tr[data-ct-ver="TC_E2E#1"]').innerText();
  ok("Ngừng công thức: bản v1 chuyển 'Ngừng'", v1Txt.includes("Ngừng") && !v1Txt.includes("Kích hoạt"), v1Txt.replace(/\s+/g, " "));
  await w.locator('tr[data-ct-ver="TC_E2E#1"] button', { hasText: "Sao chép bản mới" }).click();
  const v2Txt = await w.locator('tr[data-ct-ver="TC_E2E#2"]').innerText();
  ok("Sao chép thành phiên bản mới: v2 ở trạng thái Nháp, cùng biểu thức", v2Txt.includes("Nháp") && v2Txt.includes("CONG_TC * HE_SO_TC * 2"), v2Txt.replace(/\s+/g, " "));
  await w.locator('tr[data-ct-ver="TC_E2E#2"] button', { hasText: "Gửi duyệt" }).click();
  ok("Gửi duyệt: v2 chuyển 'Chờ duyệt'", (await w.locator('tr[data-ct-ver="TC_E2E#2"]').innerText()).includes("Chờ duyệt"));
  // Master Prompt V3 mục XVII: Đối chiếu lương Power Query — nhập 1 Excel tham chiếu, so theo từng người/chỉ tiêu
  await w.click("#nav button[data-k=doichieu]");
  const dcWb = new (require(path.join(APP, "exceljs.min.js"))).Workbook(); const dcWs = dcWb.addWorksheet("BangLuongCu");
  dcWs.getRow(1).values = ["Mã NV", "Họ và tên", "Thực lĩnh", "Tiền tăng ca"];
  dcWs.getRow(2).values = ["NV001", "E2E Nhân Viên", 11370000 - 50000, 0]; // cố ý lệch 50.000đ so với app (11.370.000)
  const dcFile = path.join(DL, "..", "doichieu_thamkhao.xlsx");
  fs.writeFileSync(dcFile, new Uint8Array(await dcWb.xlsx.writeBuffer()));
  const [fcDC] = await Promise.all([w.waitForEvent("filechooser"), w.click('button:has-text("Chọn file Excel đối chiếu")')]);
  await fcDC.setFiles(dcFile); await w.waitForTimeout(400);
  const dcTxt = await w.locator("main").first().innerText();
  ok("Đối chiếu lương Power Query (mục XVII): nhận file, phát hiện 1 dòng chênh lệch Thực lĩnh (50.000đ), không báo lệch giả ở 'Tiền tăng ca' (cả 2 bên đều 0)",
    /1 dòng chênh lệch/.test(dcTxt) && /50\.000/.test(dcTxt) && /Thực lĩnh/.test(dcTxt), dcTxt.replace(/\s+/g, " ").slice(0, 400));
  await w.click("#nav button[data-k=luong]");
  await w.click('button:has-text("Chốt kỳ lương")'); await w.waitForSelector(".dlg");
  await w.locator(".dlg input").fill("Chốt bởi E2E"); await w.click(".dlg footer button.pri"); await w.waitForSelector(".locked");
  ok("Chốt kỳ lương (hộp nhập của app, không dùng window.prompt)", (await w.locator(".locked").first().innerText()).indexOf("đã chốt") >= 0);
  { const stt = await w.locator("[data-steps7] li").evaluateAll((els) => els.map((e) => e.getAttribute("data-step-state")));
    ok("V10.1: thanh 7 bước phản ánh trạng thái thật sau chốt (bước 1-5 xong, thanh toán đang làm)", stt.length === 7 && stt.slice(0, 5).every((x) => x === "xong") && stt[5] === "dang", stt.join(",")); }
  // mở chốt bắt buộc lý do → chốt lại = phiên bản 2
  await w.click('button:has-text("Mở chốt để sửa")'); await w.waitForSelector(".dlg");
  await w.click(".dlg footer button.pri");
  ok("Mở chốt không cho để trống lý do", await w.locator(".dlg").count() === 1);
  await w.locator(".dlg textarea").fill("Kiểm thử mở chốt"); await w.click(".dlg footer button.pri"); await w.waitForSelector("button.big");
  await w.click("button.big"); await w.click('button:has-text("Chốt kỳ lương")'); await w.waitForSelector(".dlg"); await w.click(".dlg footer button.pri"); await w.waitForSelector(".locked");
  ok("Chốt lại sau khi mở chốt", true);
  // xuất Excel trọn bộ
  await w.click('button:has-text("Xuất trọn bộ Excel")');
  let xf = null; for (let i = 0; i < 30 && !xf; i++) { await w.waitForTimeout(200); xf = fs.readdirSync(DL).filter((f) => /^KyLuong_2026-09\.xlsx$/.test(f))[0]; }
  if (xf) {
    const XLSX = require(path.join(APP, "xlsx.full.min.js")), wb = XLSX.read(fs.readFileSync(path.join(DL, xf)), { type: "buffer" });
    const bl = XLSX.utils.sheet_to_json(wb.Sheets.BangLuong);
    ok("Xuất Excel trọn bộ: đủ 4 sheet, số khớp bảng đã chốt", wb.SheetNames.join(",") === "BangLuong,BHXH,ThueTNCN,ChuyenKhoan" && bl[0]["Thực lĩnh"] === 11370000, wb.SheetNames.join(",") + " · thực lĩnh " + bl[0]["Thực lĩnh"]);
  } else ok("Xuất Excel trọn bộ kỳ đã chốt", false, "không thấy file");
  // α16: tải xong → thẻ báo [Mở file] [Mở thư mục] + tự mở thư mục chọn sẵn file (HAK_NO_SHELL: chỉ ghi lại thao tác, không mở Explorer thật)
  await w.waitForSelector("#dlcard");
  const card = await w.locator("#dlcard").innerText();
  const sh1 = await w.evaluate(() => window.hakFiles.info().lastShell);
  ok("Tải Excel xong: báo tên file + nơi lưu, tự mở thư mục chọn sẵn file", /Đã lưu file/.test(card) && card.includes("KyLuong_2026-09.xlsx") && card.includes(DL) && sh1 && sh1.kind === "show" && sh1.name === "KyLuong_2026-09.xlsx", card.replace(/\s+/g, " ") + " · " + JSON.stringify(sh1));
  await w.click('#dlcard button:has-text("Mở file")');
  const sh2 = await w.evaluate(() => window.hakFiles.info().lastShell);
  ok("Nút Mở file mở đúng file vừa tải", sh2 && sh2.kind === "open" && sh2.name === "KyLuong_2026-09.xlsx" && (await w.locator("#dlcard").count()) === 0, JSON.stringify(sh2));
  await w.click("#top button[data-files]"); await w.waitForSelector("#modal.drawer .flist li");
  const fl = await w.locator(".flist li").first().innerText();
  await w.locator(".flist li").first().locator("button", { hasText: "Mở" }).click();
  const sh3 = await w.evaluate(() => window.hakFiles.info().lastShell);
  const outside = await w.evaluate(() => [window.hakFiles.open("../data.json"), window.hakFiles.show("..\\data.json"), window.hakFiles.open("khongco.xlsx")]);
  ok("File đã tải: liệt kê file mới nhất, mở được; không mở file ngoài thư mục xuất", fl.includes("KyLuong_2026-09.xlsx") && sh3.kind === "open" && outside.every((x) => x === false), fl.replace(/\s+/g, " ") + " · " + JSON.stringify(outside));
  await w.click('.dlg footer button:has-text("Mở thư mục")');
  const sh4 = await w.evaluate(() => window.hakFiles.info().lastShell);
  ok("Nút Mở thư mục mở thư mục lưu", sh4.kind === "open" && sh4.name === path.basename(DL), JSON.stringify(sh4));
  await w.click('.dlg footer button:has-text("Đóng")');
  const n0 = fs.readdirSync(DL).length;
  await w.click('button:has-text("Xuất trọn bộ Excel")');
  let dup = null; for (let i = 0; i < 30 && !dup; i++) { await w.waitForTimeout(200); dup = fs.readdirSync(DL).filter((f) => f === "KyLuong_2026-09 (1).xlsx")[0]; }
  ok("Xuất lại cùng tên KHÔNG ghi đè file cũ (thêm (1))", !!dup && fs.readdirSync(DL).length === n0 + 1, fs.readdirSync(DL).join(", "));
  await w.waitForSelector("#dlcard"); await w.click("#dlcard .t button");
  // ---- V9.4: Thuế TNCN cha–con: nút 'Chi tiết' mở đúng biểu của phiên bản ----
  {
    await w.click("#nav button[data-k=dm]"); await w.click('#main button:has-text("Thuế TNCN")');
    const before = await w.locator("[data-tax-child]").count();
    const nChiTiet = await w.locator('#main table button:has-text("Chi tiết")').count();
    if (nChiTiet) {
      await w.locator('#main table button:has-text("Chi tiết")').first().click(); await w.waitForTimeout(300);
      const open1 = await w.locator(".dlg [data-tax-child]").count(), childTxt = await w.locator(".dlg").innerText();
      await shotOf(w, "04-thue-tncn-chi-tiet-cha-con");
      ok("V10: Thuế TNCN — 'Chi tiết' mở CỬA SỔ cha–con với bậc thuế của đúng mã/phiên bản (mã & hiệu lực tự gán), có Thêm/Lưới con", before === 0 && open1 === 1 && /tự gắn mã thuế/.test(childTxt) && (await w.locator('.dlg button:has-text("Thêm")').count()) >= 1, "before=" + before + " open=" + open1);
      await w.click('.dlg footer button:has-text("Đóng")'); await w.waitForTimeout(200);
      ok("V10: Thuế TNCN — đóng cửa sổ cha–con quay lại bảng cha", (await w.locator(".dlg").count()) === 0 && (await w.locator("[data-tax-child]").count()) === 0);
    } else ok("V9.4: Thuế TNCN — có nút 'Chi tiết' ở bảng phiên bản", false, "không thấy nút");
  }
  // ---- V9.4: BÁO CÁO LƯƠNG (kỳ 2026-09 đã chốt) ----
  {
    const navTxt = await w.locator("#nav").innerText();
    ok("V10: menu có nhóm 'THANH TOÁN LƯƠNG' + 'BÁO CÁO' và đủ 8 báo cáo", /THANH TOÁN LƯƠNG/.test(navTxt) && /BÁO CÁO/.test(navTxt) && ["Bảng tính lương", "Tổng hợp theo phòng ban", "Tổng hợp chi tiết nhân viên", "Bảng thanh toán lương", "Chi tiết thanh toán", "Bảng kê chuyển khoản", "Thanh toán tiền mặt", "Phiếu lương"].every((t) => navTxt.includes(t)), navTxt.replace(/\s+/g, " ").slice(0, 300));
    await w.click("#nav button[data-k=rp_tonghop]");
    const h2 = await w.locator("#top h2").innerText(), rt = await w.locator("[data-report-title]").innerText();
    ok("V9.4: tiêu đề báo cáo IN HOA trên màn hình", h2 === h2.toLocaleUpperCase("vi-VN") && rt === rt.toLocaleUpperCase("vi-VN") && /TỔNG HỢP LƯƠNG/.test(rt), h2 + " | " + rt);
    const thTxt = await w.locator("[data-pay-report] tbody").innerText();
    ok("V9.4: tổng hợp lương khớp thực lĩnh bảng đã chốt (11.370.000)", /11\.370\.000/.test(thTxt), thTxt.replace(/\s+/g, " ").slice(0, 200));
    await shotOf(w, "02-bao-cao-tong-hop-luong");
    await w.click("#nav button[data-k=rp_ctnv]");
    const ctTxt = await w.locator("[data-pay-report]").innerText(), ctTitle = await w.locator("[data-report-title]").innerText();
    ok("V10: Tổng hợp chi tiết nhân viên — IN HOA, đủ cột thành phần lương (Lương bù SL, Tiền tăng ca, Thuế TNCN…), dòng TỔNG CỘNG khớp thực lĩnh 11.370.000", ctTitle === ctTitle.toLocaleUpperCase("vi-VN") && /Lương bù SL/.test(ctTxt) && /Tiền tăng ca/.test(ctTxt) && /Thuế TNCN/.test(ctTxt) && /TỔNG CỘNG/.test(ctTxt) && /11\.370\.000/.test(ctTxt), ctTxt.replace(/\s+/g, " ").slice(0, 200));
    await w.click('button:has-text("Xuất Excel")'); await w.waitForTimeout(700);
    let ctf = null; for (let i = 0; i < 15 && !ctf; i++) { await w.waitForTimeout(200); ctf = fs.readdirSync(DL).filter((f) => /^ChiTietLuongNhanVien_2026-09\.xlsx$/.test(f))[0]; }
    ok("V10: Tổng hợp chi tiết nhân viên — xuất được Excel", !!ctf);
    await w.click("#nav button[data-k=rp_cttt]");
    const cttTxt = await w.locator("#main").innerText();
    ok("V10.1: Chi tiết thanh toán — một dòng/nhân viên, nhóm cột hai tầng, tiêu đề IN HOA", /BẢNG CHI TIẾT THANH TOÁN TIỀN LƯƠNG/.test(cttTxt) && /THU NHẬP/.test(cttTxt) && /KHẤU TRỪ/.test(cttTxt) && /Còn phải thanh toán/.test(cttTxt) && /Có thể lập đề nghị chi/.test(cttTxt));
    const cttRows = await w.locator("[data-pay-report=CHI_TIET_TT] tbody tr[data-ma]").count();
    ok("V10.1: Chi tiết thanh toán có dòng cho nhân viên (không phụ thuộc chứng từ)", cttRows > 0, String(cttRows));
    if (cttRows) { await w.locator("[data-pay-report=CHI_TIET_TT] tbody tr[data-ma]").first().click(); await w.waitForTimeout(200);
      const dt = await w.locator("#modal").innerText(); ok("V10.1: bấm dòng mở cửa sổ CHI TIẾT THANH TOÁN LƯƠNG — [HỌ TÊN]", /CHI TIẾT THANH TOÁN LƯƠNG — /.test(dt) && /Tổng thu nhập/.test(dt), dt.slice(0, 80)); await w.click("#modal button:has-text('Đóng')"); }
    { // V10.1: Excel Chi tiết thanh toán — hai tầng tiêu đề, A3 ngang nhiều trang, lặp Mã NV–Họ tên, Mã NV dạng text
      fs.readdirSync(DL).filter((f) => /^ChiTietThanhToan_/.test(f)).forEach((f) => fs.unlinkSync(path.join(DL, f)));
      dialogs = []; await w.click('button:has-text("Xuất Excel")'); await w.waitForTimeout(700);
      let cf = null; for (let i = 0; i < 15 && !cf; i++) { await w.waitForTimeout(200); cf = fs.readdirSync(DL).filter((f) => /^ChiTietThanhToan_2026-09\.xlsx$/.test(f))[0]; }
      if (!cf) ok("V10.1: xuất Excel Chi tiết thanh toán", false, "không có file; hộp thoại: " + dialogs.join(" | ").slice(0, 200));
      else {
        const EX = require(path.join(APP, "exceljs.min.js")), wbc = new EX.Workbook(); await wbc.xlsx.load(fs.readFileSync(path.join(DL, cf))); const wc = wbc.worksheets[0];
        let grp = 0; wc.eachRow((row, n) => { if (row.getCell(1).value === "NHÂN VIÊN") grp = n; });
        ok("V10.1: Excel Chi tiết thanh toán — tiêu đề 2 tầng, A3 ngang, ≥2 trang ngang, lặp cột Mã NV–Họ tên, đóng băng", grp > 0 && wc.pageSetup.paperSize === 8 && wc.pageSetup.fitToWidth >= 2 && wc.pageSetup.printTitlesColumn === "A:C" && wc.views[0].xSplit === 3, JSON.stringify({ grp, p: wc.pageSetup.paperSize, w: wc.pageSetup.fitToWidth, c: wc.pageSetup.printTitlesColumn, x: wc.views[0].xSplit }));
      }
    }
    await w.click("#nav button[data-k=rp_soct]");
    const soTxt = await w.locator("#main").innerText();
    ok("V10.1: Sổ chứng từ thanh toán là màn riêng", /SỔ CHỨNG TỪ THANH TOÁN LƯƠNG/.test(soTxt) && /Số chứng từ/.test(soTxt));
    await w.click("#nav button[data-k=rp_thanhtoan]");
    const tt0 = await w.locator("[data-pay-report]").innerText();
    ok("V9.4: bảng thanh toán có Thực lĩnh / Đã thanh toán / Còn phải thanh toán, trạng thái ban đầu 'Chưa thanh toán'", /Còn phải thanh toán/.test(tt0) && /Chưa thanh toán/.test(tt0), tt0.replace(/\s+/g, " ").slice(0, 240));
    await w.click("#nav button[data-k=rp_thanhtoan]");
    await shotOf(w, "03-bang-thanh-toan-luong");
    const nErr = await w.locator("[data-pay-errors]").count();
    dialogs = []; fs.readdirSync(DL).filter((f) => /^ThanhToanLuong_/.test(f)).forEach((f) => fs.unlinkSync(path.join(DL, f)));
    await w.click('button:has-text("Xuất Excel")'); await w.waitForTimeout(700);
    let kf = null; for (let i = 0; i < 15 && !kf; i++) { await w.waitForTimeout(200); kf = fs.readdirSync(DL).filter((f) => /^ThanhToanLuong_2026-09\.xlsx$/.test(f))[0]; }
    if (nErr) ok("V9.4: bảng thanh toán có lỗi nghiêm trọng → CHẶN xuất chính thức (không tạo file)", !kf && dialogs.some((d) => /Không xuất chính thức/.test(d)), dialogs.join(" | ").slice(0, 200));
    else {
      const ExcelJS = require(path.join(APP, "exceljs.min.js")), wbk = new ExcelJS.Workbook(); await wbk.xlsx.load(fs.readFileSync(path.join(DL, kf))); const wsk = wbk.worksheets[0];
      ok("V9.4: Excel thanh toán lương mở được, tiêu đề IN HOA, in A4 vừa chiều ngang, lặp tiêu đề, đóng băng", !!kf && wsk.getCell("A2").value === wsk.getCell("A2").value.toLocaleUpperCase("vi-VN") && wsk.pageSetup.fitToWidth === 1 && !!wsk.pageSetup.printTitlesRow && wsk.views[0].state === "frozen", String(wsk.getCell("A2").value));
    }
    await w.click("#nav button[data-k=rp_ck]");
    const ckRows = await w.locator("[data-pay-report] tbody tr").count(), ckErr = await w.locator("[data-pay-errors]").count();
    dialogs = []; await w.click('button:has-text("Xuất Excel")'); await w.waitForTimeout(500);
    ok("V9.4: kê chuyển khoản — thiếu dữ liệu tài khoản thì chặn; không có dòng thì báo; hợp lệ thì tạo file", ckErr ? dialogs.some((d) => /Không xuất chính thức/.test(d)) : (ckRows === 0 || fs.readdirSync(DL).some((f) => /^KeChuyenKhoan_2026-09\.xlsx$/.test(f))), "rows=" + ckRows + " err=" + ckErr + " " + dialogs.join(" | ").slice(0, 120));
    const ttAfter = await (async () => { await w.click("#nav button[data-k=rp_thanhtoan]"); return w.locator("[data-pay-report]").innerText(); })();
    ok("V9.4: xuất file KHÔNG làm đổi trạng thái thanh toán (vẫn 'Chưa thanh toán')", /Chưa thanh toán/.test(ttAfter) && !/Đã thanh toán\s*\n?\s*[1-9]/.test(ttAfter.replace(/Đã thanh toán\n/, "")));
    await w.click("#nav button[data-k=rp_tm]");
    ok("V9.4: có sổ chứng từ thanh toán lương trên màn hình tiền mặt", (await w.locator("[data-pay-ledger]").count()) === 1);
    for (const [nav, btnTxt, pre] of [["rp_ck", "Lập chứng từ chuyển khoản", "UNC-202609-001"], ["rp_tm", "Lập phiếu chi tiền mặt", "PC-202609-001"]]) {
      await w.click("#nav button[data-k=" + nav + "]");
      const hasRows = (await w.locator("[data-pay-report] tbody tr").count()) > 1, hasErr = (await w.locator("[data-pay-errors]").count()) > 0;
      if (!hasRows || hasErr) { ok("V9.4: " + nav + " — " + (hasErr ? "có lỗi nên không lập chứng từ" : "không có người thuộc hình thức này (bỏ qua lập chứng từ)"), true); continue; }
      await w.click('button:has-text("' + btnTxt + '")'); await w.waitForTimeout(500);
      const lg = await w.locator("[data-pay-ledger]").innerText();
      await shotOf(w, "05-so-chung-tu-thanh-toan");
      ok("V9.4: lập chứng từ → xuất hiện trong sổ với trạng thái 'Đã lập' (" + nav + ")", lg.includes(pre) && /Đã lập/.test(lg), lg.replace(/\s+/g, " ").slice(0, 200));
      await w.locator('[data-pay-ledger] button:has-text("Chi tiết")').first().click(); await w.waitForSelector("[data-voucher-detail]");
      const vd = await w.locator("[data-voucher-detail]").innerText();
      ok("V10.1: chứng từ (cha) mở cửa sổ chi tiết với các dòng nhân viên (con) (" + nav + ")", vd.includes(pre) && /Các dòng nhân viên/.test(vd) && /NV001/.test(vd), vd.replace(/\s+/g, " ").slice(0, 160));
      await w.click("#modal button:has-text('Đóng')");
      dialogs = []; await w.locator('[data-pay-ledger] button:has-text("Duyệt")').click(); await w.waitForTimeout(300);
      ok("V9.4: người lập không tự duyệt chứng từ (tách nhiệm vụ)", dialogs.some((d) => /khác người lập/.test(d)), dialogs.join(" | "));
      dialogs = []; await w.click('button:has-text("' + btnTxt + '")'); await w.waitForTimeout(300);
      ok("V9.4: không lập trùng chứng từ cho người đã có chứng từ chờ chi", dialogs.some((d) => /Không có khoản nào cần lập/.test(d)), dialogs.join(" | ").slice(0, 200));
      await w.locator('[data-pay-ledger] button:has-text("Hủy")').click(); await w.waitForSelector(".dlg"); await w.locator(".dlg input, .dlg textarea").first().fill("Hủy thử e2e"); await w.click(".dlg footer button.pri"); await w.waitForTimeout(400);
      ok("V9.4: hủy chứng từ có lý do → trả lại khoản phải thanh toán", /Đã hủy/.test(await w.locator("[data-pay-ledger]").innerText()));
    }
  }
  // α18: Phiếu lương trong menu — kỳ đã chốt, lọc / tìm, xuất Excel
  await w.click("#nav button[data-k=slips]"); await w.waitForSelector("[data-slips]");
  const slTxt = await w.locator("main").first().innerText(), nSl = +(await w.locator("[data-slips]").getAttribute("data-slips"));
  await w.fill('main input[type=search]', "khong-co-ai"); await w.dispatchEvent('main input[type=search]', "change"); await w.waitForTimeout(150);
  const nSl0 = +(await w.locator("[data-slips]").getAttribute("data-slips"));
  await w.fill('main input[type=search]', "e2e nhan"); await w.dispatchEvent('main input[type=search]', "change"); await w.waitForTimeout(150);
  const nSl1 = +(await w.locator("[data-slips]").getAttribute("data-slips"));
  {
    const waitPdf = async (re, bf) => { let n = null; for (let i = 0; i < 100 && !n; i++) { await w.waitForTimeout(300); n = fs.readdirSync(DL).filter((f) => re.test(f) && !bf.includes(f))[0]; } return n; };
    const isPdf = (n) => { const b = n ? fs.readFileSync(path.join(DL, n)) : Buffer.alloc(0); return b.slice(0, 5).toString() === "%PDF-" && /\/Type\s*\/Page(?![s\w])/.test(b.toString("latin1")) && b.length > 1500; };
    await w.fill('main input[type=search]', ""); await w.dispatchEvent('main input[type=search]', "change"); await w.waitForTimeout(150);
    let bf = fs.readdirSync(DL); await w.locator('main .bar button:has-text("PDF")').first().click();
    const ps = await waitPdf(/^PhieuLuong_.*\.pdf$/, bf);
    ok("Phiếu lương: nút PDF ra file PDF thật", isPdf(ps), String(ps));
    await w.click("#nav button[data-k=kyluong]"); bf = fs.readdirSync(DL);
    await w.locator('main tbody button:has-text("PDF")').first().click();
    const pk = await waitPdf(/^BangLuongDaChot_.*\.pdf$/, bf);
    ok("Kỳ lương đã chốt: nút PDF ra file PDF thật (bảng lương như lúc chốt)", isPdf(pk), String(pk));
    await w.click("#nav button[data-k=slips]"); await w.waitForSelector("[data-slips]");
  }
  await w.click('main button:has-text("Xuất Excel")');
  let pf = null; for (let i = 0; i < 30 && !pf; i++) { await w.waitForTimeout(200); pf = fs.readdirSync(DL).filter((f) => /^PhieuLuong_2026-09\.xlsx$/.test(f))[0]; }
  let pfOk = false;
  if (pf) { const XLSX = require(path.join(APP, "xlsx.full.min.js")), r0 = XLSX.utils.sheet_to_json(XLSX.read(fs.readFileSync(path.join(DL, pf)), { type: "buffer" }).Sheets["PhieuLuong_2026-09"])[0]; pfOk = r0 && r0["Thực lĩnh"] === 11370000 && r0["Mã NV"] === "NV001"; }
  if (pf) { const XL = require(path.join(APP, "xlsx.full.min.js")), sn = XL.read(fs.readFileSync(path.join(DL, pf)), { type: "buffer" }).SheetNames; ok("V10: Excel phiếu lương có sheet 'Phiếu lương' (bố cục in riêng) + sheet dữ liệu thô", sn[0] === "Phiếu lương" && sn.indexOf("PhieuLuong_2026-09") > 0, sn.join(",")); }
  ok("Phiếu lương (menu riêng): kỳ đã chốt, tìm không dấu, xuất Excel khớp bảng đã chốt", /PHIẾU LƯƠNG THÁNG 9\/2026/.test(slTxt) && /đã chốt/.test(slTxt) && nSl === 1 && nSl0 === 0 && nSl1 === 1 && pfOk, [nSl, nSl0, nSl1, pf, pfOk].join(" · "));
  await w.waitForSelector("#dlcard"); await w.click("#dlcard .t button");
  // α18: Báo cáo bảo hiểm
  await w.click("#nav button[data-k=baocaoluong]"); await w.click('#main button:has-text("Báo cáo bảo hiểm")'); await w.waitForTimeout(200);
  const bhTxt = await w.locator("main").first().innerText();
  ok("Báo cáo bảo hiểm: tổng hợp theo khoản, tăng/giảm, theo phòng ban, chi tiết; ghi rõ không thay mẫu chính thức", /Tổng hợp theo khoản/.test(bhTxt) && /BHXH/.test(bhTxt) && /KPCĐ/.test(bhTxt) && /Tăng \/ giảm/.test(bhTxt) && /Chi tiết từng người/.test(bhTxt) && /không thay mẫu chính thức/.test(bhTxt) && /đã chốt/.test(bhTxt), bhTxt.replace(/\s+/g, " ").slice(0, 200));
  // Hướng dẫn & Quy chế: 5 phần, quy chế sinh từ danh mục, tải Word
  await w.click("#nav button[data-k=huongdan]");
  const gTabs = await w.locator(".subtabs button").count();
  await w.click('.subtabs button:has-text("Quy chế")'); await w.waitForTimeout(200);
  const qc = await w.locator(".guide").innerText();
  await w.click('button:has-text("Tải file Word")');
  let qf = null; for (let i = 0; i < 30 && !qf; i++) { await w.waitForTimeout(200); qf = fs.readdirSync(DL).filter((f) => /^Du_thao_Quy_che_tra_luong_2026-09\.doc$/.test(f))[0]; }
  ok("Hướng dẫn & Quy chế: 5 phần, quy chế lấy từ danh mục đang dùng, tải được file Word", gTabs === 5 && /QUY CHẾ TRẢ LƯƠNG/.test(qc) && /TG1/.test(qc) && /BH01/.test(qc) && !!qf && /QUY CHẾ TRẢ LƯƠNG/.test(fs.readFileSync(path.join(DL, qf), "utf8")), gTabs + " phần · " + (qf || "không thấy file"));
  // Lỗi 1: dán NHIỀU dòng vào danh mục có hiệu lực trong kỳ đã chốt → phải ghi nhật ký HỒI TỐ + cảnh báo (trước đây im lặng)
  const auditOf = () => w.evaluate(() => window.hakStore.load()).then((t) => JSON.parse(t.text).auditlog || []);
  await w.waitForTimeout(700); const au0 = (await auditOf()).length;
  await w.click("#nav button[data-k=dm]"); await w.click('#main button:has-text("Mã lương")');
  fs.readdirSync(DL).filter((f) => /^Maluong/.test(f)).forEach((f) => fs.unlinkSync(path.join(DL, f)));
  await w.click('#main button:has-text("Xuất Excel")');
  let dmx = null; for (let i = 0; i < 20 && !dmx; i++) { await w.waitForTimeout(200); dmx = fs.readdirSync(DL).filter((f) => /^Maluong.*\.xlsx$/.test(f))[0]; }
  if (dmx) {
    const ExcelJS2 = require(path.join(APP, "exceljs.min.js")), wb2 = new ExcelJS2.Workbook(); await wb2.xlsx.load(fs.readFileSync(path.join(DL, dmx))); const ws2 = wb2.worksheets[0];
    ok("V10: Xuất Excel từ lưới danh mục dùng mẫu chuyên nghiệp (tiêu đề IN HOA, A4, lặp tiêu đề, đóng băng, chữ ký)", String(ws2.getCell("A2").value) === String(ws2.getCell("A2").value).toLocaleUpperCase("vi-VN") && ws2.pageSetup.fitToWidth === 1 && !!ws2.pageSetup.printTitlesRow, String(ws2.getCell("A2").value));
  } else ok("V10: Xuất Excel từ lưới danh mục tạo được file", false, "không thấy file Maluong*.xlsx: " + fs.readdirSync(DL).join(","));
  const dmCell = w.locator("#main tbody tr").first().locator("input").nth(4);
  await dmCell.evaluate((el) => { const dt = new DataTransfer(); dt.setData("text/plain", "Dán E2E 1\nDán E2E 2"); el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); });
  const pasteToast = await w.locator("#toast").textContent();
  await w.waitForTimeout(700);
  const auP = (await auditOf()).slice(au0).filter((a) => /HỒI TỐ/.test(a.chiTiet));
  ok("V9.4: danh mục ở chế độ chỉ xem — ô bị khóa, dán nhiều dòng KHÔNG ghi ngầm (không nhật ký, không thêm dòng)", (await dmCell.isDisabled()) && auP.length === 0 && !/Đã dán/.test(pasteToast || "") && (await auditOf()).length === au0, pasteToast + " · nhật ký hồi tố: " + auP.length);
  // Lỗi 2: sửa thông tin cơ bản của NV có trong bảng lương ĐÃ CHỐT → phải hỏi xác nhận TRƯỚC khi lưu; Hủy = không lưu, không ghi nhật ký
  const nvCCCD = () => w.evaluate(() => window.hakStore.load()).then((t) => JSON.parse(t.text).nhanvien[0]["Số CCCD"] || "");
  const cc0 = await nvCCCD(), au1 = (await auditOf()).length;
  await w.click("#nav button[data-k=nhansu]"); await w.locator("#main table tbody tr").first().click();
  await w.click('button:has-text("Sửa cơ bản")'); await w.waitForSelector(".dlg");
  await w.locator(".dlg .fld", { hasText: "Số CCCD" }).first().locator("input").fill("001099000111");
  dialogMode = "dismiss"; dialogs = [];
  await w.click('.dlg footer button:has-text("Lưu")'); await w.waitForTimeout(700);
  dialogMode = "accept";
  ok("Lỗi 2: sửa cơ bản NV thuộc kỳ đã chốt → hỏi xác nhận hồi tố; bấm Hủy thì KHÔNG lưu, KHÔNG ghi nhật ký",
    dialogs.some((m) => /ĐÃ CHỐT/.test(m)) && (await nvCCCD()) === cc0 && (await auditOf()).length === au1, dialogs.join(" | ") || "không có hộp xác nhận");
  if (await w.locator(".dlg").count()) await w.click('.dlg footer button:has-text("Hủy")');
  await w.click('button:has-text("Sửa cơ bản")'); await w.waitForSelector(".dlg");
  await w.locator(".dlg .fld", { hasText: "Số CCCD" }).first().locator("input").fill("001099000111");
  dialogs = []; await w.click('.dlg footer button:has-text("Lưu")'); await w.waitForTimeout(700);
  const auE = (await auditOf()).slice(au1);
  ok("Lỗi 2: đồng ý → lưu + nhật ký HỒI TỐ", (await nvCCCD()) === "001099000111" && auE.some((a) => /Sửa thông tin cơ bản/.test(a.thaoTac) && /HỒI TỐ/.test(a.chiTiet)), auE.map((a) => a.thaoTac).join(", "));
  // UI 2.0 (α15): sáng / tối, Ctrl+K, sửa hồ sơ "Thông tin mới" giữ bản cũ, tăng lương lập phụ lục mới, lịch sử, báo cáo biến động
  {
    const dbNow = () => w.evaluate(() => window.hakStore.load()).then((t) => JSON.parse(t.text));
    await w.click("#nav button[data-k=home]");
    await w.click('#top button[aria-label="Đổi giao diện sáng / tối"]');
    const th1 = await w.evaluate(() => document.documentElement.getAttribute("data-theme"));
    await w.click('#top button[aria-label="Đổi giao diện sáng / tối"]');
    const th2 = await w.evaluate(() => document.documentElement.getAttribute("data-theme"));
    ok("UI: nút sáng / tối đổi giao diện (tối → sáng)", th1 === "dark" && th2 === "light", th1 + " → " + th2);
    await w.keyboard.press("Control+k"); await w.waitForSelector(".cmdk input"); await w.fill(".cmdk input", "e2e nhan"); await w.press(".cmdk input", "Enter"); await w.waitForTimeout(300);
    ok("UI: Ctrl+K gõ không dấu tìm nhân viên → Enter mở hồ sơ", (await w.locator("#top h2").innerText()) === "Hồ sơ nhân viên" && /E2E Nhân Viên/.test(await w.locator("#main").innerText()));
    await w.click('.subtabs button:has-text("Nhân thân")'); await w.waitForSelector("[data-npt-master]");
    await w.click('[data-npt-master] button:has-text("Chi tiết người phụ thuộc")'); await w.waitForSelector("[data-npt-detail]");
    ok("V10: Nhân viên → Người phụ thuộc mở bằng cửa sổ cha–con (Mã NV tự gán)", (await w.locator("[data-npt-detail]").innerText()).includes("Cha: nhân viên"));
    await w.click('#modal footer button:has-text("Đóng")'); await w.waitForTimeout(200);
    // Thông tin cá nhân: thêm 1 bản, rồi sửa kiểu "Thông tin mới" → có 2 bản, bản cũ giữ nguyên
    await w.click('.subtabs button:has-text("Thông tin cá nhân")'); await w.click('#main button:has-text("Thêm")'); await w.waitForSelector("#modal.drawer .dlg");
    const D = (l) => w.locator(".dlg .fld", { hasText: l }).first();
    await D("Số CCCD").locator("input").fill("049095001234"); await D("Ngày sinh").locator("input").fill("1990-05-02");
    await D("Giới tính").locator("select").selectOption("Nam"); await D("Hiệu lực từ").locator("input").fill("2025-01-01");
    await D("Số điện thoại").locator("input").fill("0905000999");
    await w.click(".dlg footer button.pri"); await w.waitForTimeout(500);
    await w.locator("#main table tbody tr").first().click(); await w.waitForSelector("#modal.drawer .dlg");
    const modeNew = await w.locator('.dlg input[name=hrmode][value=new]').isChecked();
    await D("Số điện thoại").locator("input").fill("0905111222"); await D("Số điện thoại").locator("input").dispatchEvent("input");
    const diffTxt = await w.locator(".dlg .diff").innerText();
    await w.click(".dlg footer button.pri"); await w.waitForTimeout(600);
    const cn = (await dbNow()).canhan.filter((r) => r["Mã NV"] === "NV001").sort((a, b) => a["Hiệu lực từ"] < b["Hiệu lực từ"] ? -1 : 1);
    ok("UI: sửa Thông tin cá nhân mặc định 'Thông tin mới' → thêm bản mới từ hôm nay, bản cũ giữ làm lịch sử; khung xem trước nêu thay đổi",
      modeNew && /Sẽ lưu/.test(diffTxt) && /0905000999/.test(diffTxt) && /0905111222/.test(diffTxt) && cn.length === 2 && cn[0]["Số điện thoại"] === "0905000999" && cn[1]["Số điện thoại"] === "0905111222" && cn[1]["Số CCCD"] === "049095001234",
      cn.map((r) => r["Hiệu lực từ"] + ":" + r["Số điện thoại"]).join(" | ") + " · " + diffTxt.replace(/\n/g, " "));
    // Tăng lương: lập phụ lục mới (không sửa phụ lục cũ), có % thay đổi
    const nPL0 = (await dbNow()).chitiethd.length;
    await w.click('#main button:has-text("Tăng lương / biến động")'); await w.waitForSelector("#modal.drawer .dlg");
    await w.locator('.dlg label.chip', { hasText: "Tăng lương" }).click();
    await D("Hiệu lực từ").locator("input").fill("2026-11-01");
    await D("Lương thỏa thuận").locator("input").fill("13.200.000"); await D("Lương thỏa thuận").locator("input").dispatchEvent("input");
    const pctTxt = await w.locator(".dlg .ok").innerText();
    await w.click(".dlg footer button.pri"); await w.waitForTimeout(600);
    const pls = (await dbNow()).chitiethd.filter((r) => r["Mã NV"] === "NV001");
    const plNew = pls.filter((r) => r["Hiệu lực từ"] === "2026-11-01")[0];
    ok("UI: Tăng lương → lập phụ lục mới (+10%), phụ lục cũ giữ nguyên",
      (await dbNow()).chitiethd.length === nPL0 + 1 && plNew && plNew["Lương thỏa thuận"] === "13200000" && plNew["Loại biến động"] === "Tăng lương" && pls.some((r) => r["Lương thỏa thuận"] === "12000000") && /\+1\.200\.000 \(\+10%\)/.test(pctTxt),
      pctTxt + " · " + pls.map((r) => r["Hiệu lực từ"] + ":" + r["Lương thỏa thuận"]).join(" | "));
    await w.click('#main button:has-text("Lịch sử")'); await w.waitForSelector("#modal.drawer .tl");
    const ls = await w.locator(".dlg").innerText();
    ok("UI: Lịch sử nhân viên có quá trình lương + dòng thời gian thay đổi (trước → sau)", /Quá trình lương/.test(ls) && /Biến động: Tăng lương/.test(ls) && /0905000999/.test(ls), ls.slice(0, 200).replace(/\n/g, " "));
    await w.click('.dlg footer button:has-text("Đóng")');
    await w.click("#nav button[data-k=baocao]"); await w.click('#main button:has-text("Biến động nhân sự")');
    await w.locator('#main input[type=month]').nth(1).fill("2026-12"); await w.locator('#main input[type=month]').nth(1).dispatchEvent("change"); await w.waitForTimeout(300);
    const bd = await w.locator("#main").innerText();
    ok("UI: Báo cáo biến động nhân sự liệt kê tăng lương 12.000.000 → 13.200.000", /Tăng lương/.test(bd) && /13\.200\.000|13200000/.test(bd), bd.slice(0, 160).replace(/\n/g, " "));
  }
  await w.waitForTimeout(800);
  ok("Không có lỗi JavaScript (lần chạy 1)", errs.length === 0, errs.join(" | "));
  await app.close();

  // dữ liệu đã nằm trong file
  const file = path.join(DATA, "data.json"), saved = JSON.parse(fs.readFileSync(file, "utf8"));
  ok("α21: bản chốt ghi quy chế tính lương đã dùng (mặc định Quy chế lương HAK Group 2026, engine 1.8.0)", saved.kyluong[0].quyChe === "2026" && saved.kyluong[0].engineVersion === "1.8.0", saved.kyluong[0].quyChe + " / " + saved.kyluong[0].engineVersion);
  ok("data.json có nhân viên + kỳ đã chốt v2 + lịch sử v1", saved.nhanvien.length === 1 && saved.kyluong.length === 1 && saved.kyluong[0].checksum && saved.kyluong[0].version === 2 && saved.kyluong_lichsu.length === 1 && saved.kyluong_lichsu[0].moChot.lyDo === "Kiểm thử mở chốt");
  ok("Lương thỏa thuận lưu đúng 12000000", saved.chitiethd[0]["Lương thỏa thuận"] === "12000000", saved.chitiethd[0]["Lương thỏa thuận"]);
  const bks = fs.readdirSync(path.join(DATA, "backups"));
  ok("(B) Chốt kỳ → bản sao lưu 'sau-chot-2026-09' (2 lần chốt → 2 bản, giữ vĩnh viễn)", bks.filter((f) => /^sau-chot-2026-09_.*\.json$/.test(f)).length === 2, bks.filter((f) => /^sau-chot/.test(f)).join(", "));
  ok("Có bản sao lưu tự động (đầu ngày + trước mở chốt)", bks.some((f) => /^daily_/.test(f)) && bks.some((f) => /^truoc-mo-chot_/.test(f)), bks.join(", "));
  const crypto = require("crypto"), bj = bks.filter((f) => /\.json$/.test(f));
  ok("Mỗi bản sao lưu có file kiểm tra SHA-256 khớp nội dung", bj.length > 0 && bj.every((f) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, "backups", f + ".sha256"), "utf8")).sha256 === crypto.createHash("sha256").update(fs.readFileSync(path.join(DATA, "backups", f), "utf8")).digest("hex"); } catch (e) { return false; } }), bj.length + " bản");
  const au = saved.auditlog.filter((a) => /chốt/i.test(a.thaoTac));
  ok("Nhật ký + bản chốt ghi NGƯỜI THỰC HIỆN (tài khoản Windows)", au.length >= 3 && au.every((a) => a.nguoi && /@/.test(a.nguoi)) && /@/.test(saved.kyluong[0].nguoiChot) && /@/.test(saved.kyluong_lichsu[0].moChot.nguoi), au.map((a) => a.thaoTac + ":" + a.nguoi).join(" · "));

  // mở lại
  ({ app, w, errs } = await launch());
  await w.click("#nav button[data-k=kyluong]");
  const ky = await w.locator("main tbody tr").first().innerText();
  ok("Mở lại app: kỳ đã chốt còn nguyên, checksum Nguyên vẹn", /Tháng 9\/2026/.test(ky) && /Nguyên vẹn/.test(ky), ky.replace(/\t/g, " | "));
  await app.close();

  // ---- Phân quyền (Q-14 / Q-16) ----
  ({ app, w, errs } = await launch());
  await w.click("#nav button[data-k=backup]"); await w.click('button:has-text("Thêm người dùng")'); await w.waitForSelector(".dlg");
  const ins = w.locator(".dlg .fgrid input");
  await ins.nth(0).fill("ketoan1"); await ins.nth(1).fill("Kế toán Một"); await ins.nth(2).fill("Tam12345");
  await w.locator(".dlg .fgrid select").nth(0).selectOption("ketoanluong");
  await w.click(".dlg footer button.pri"); await w.waitForTimeout(300);
  await w.click('#top button:has-text("Đăng xuất")'); await w.waitForSelector("#main input[data-f=u]");
  // sai mật khẩu 5 lần → phải chờ
  for (let i = 0; i < 5; i++) { await w.fill("#main input[data-f=u]", "ketoan1"); await w.fill("#main input[data-f=p]", "sai" + i + "matkhau"); await w.click("#main button.big"); await w.waitForTimeout(450); }
  await w.fill("#main input[data-f=p]", "Tam12345"); await w.click("#main button.big"); await w.waitForTimeout(450);
  ok("Sai mật khẩu 5 lần → khóa tạm 30 giây (kể cả khi sau đó nhập đúng)", /chờ \d+ giây/.test(await w.locator("#main .warn").innerText()) && !(await w.locator("#nav button[data-k=home]").count()));
  await app.close();
  ({ app, w, errs } = await launch(null, { who: { u: "ketoan1", p: "Tam12345" } }));
  const forced = await w.locator(".dlg").count();
  const pw = w.locator(".dlg input[type=password]");
  await pw.nth(0).fill("Tam12345"); await pw.nth(1).fill("Moi12345kt"); await pw.nth(2).fill("Moi12345kt"); await w.click(".dlg footer button.pri"); await w.waitForTimeout(500);
  ok("Mật khẩu tạm do Admin cấp → bắt buộc đổi khi đăng nhập lần đầu", forced === 1 && !(await w.locator(".dlg").count()));
  const navK = await w.locator("#nav button[data-k]").evaluateAll((b) => b.map((x) => x.getAttribute("data-k")));
  ok("Kế toán lương: thấy Tính lương/Chấm công, KHÔNG thấy Công ty & Sao lưu", navK.includes("luong") && navK.includes("chamcong") && !navK.includes("backup"), navK.join(","));
  ok("V9.4: Kế toán lương thấy nhóm báo cáo lương (thanh toán, kê CK, tiền mặt) nhưng KHÔNG thấy Sao lưu", ["rp_tonghop", "rp_thanhtoan", "rp_ck", "rp_tm"].every((k) => navK.includes(k)) && !navK.includes("backup"), navK.join(","));
  {
    await w.click("#nav button[data-k=rp_tm]");
    const mainSv = await w.evaluate(() => window.hakStore.load()).then((t) => JSON.parse(t.text));
    ok("V9.4: Kế toán lương đọc được báo cáo; sổ thanh toán nằm ở bảng riêng (ttluong); chứng từ duy nhất là bản đã hủy thử, không có dòng nào “đã thanh toán” do xuất file", Array.isArray(mainSv.ttluong) && mainSv.ttluong.every((l) => l["Trạng thái"] === "Đã hủy"), JSON.stringify((mainSv.ttluong || []).map((l) => l["Trạng thái"])));
  }
  dialogs = [];
  await w.click("#nav button[data-k=kyluong]"); await w.locator('button:has-text("Mở chốt")').first().click(); await w.waitForTimeout(300);
  ok("Kế toán lương KHÔNG được mở chốt (kiểm tra ở nghiệp vụ)", dialogs.some((d) => /không có quyền mở chốt/i.test(d)) && !(await w.locator(".dlg").count()), dialogs.join(" | "));
  dialogs = [];
  await w.click("#nav button[data-k=dm]"); await w.click('#main button:has-text("Mã lương")');
  const cell = w.locator("#main tbody tr").first().locator("input").nth(4);
  const before = await cell.inputValue();
  ok("V9.4: click/gõ vào ô danh mục khi chưa bấm Sửa không đổi dữ liệu (ô khóa)", await cell.isDisabled());
  await w.locator("#main tbody tr").first().locator('button:has-text("Chi tiết")').click(); await w.waitForSelector("[data-cat-detail]");
  ok("V10: Danh mục có nút Chi tiết (xem toàn bộ trường, chỉ xem)", (await w.locator("[data-cat-detail] tr").count()) > 2);
  await w.click('#modal footer button:has-text("Đóng")'); await w.waitForTimeout(200);
  await w.locator("#main tbody tr").first().locator('button:has-text("Sửa")').click();
  await cell.fill("Sửa hồi tố E2E"); await cell.press("Tab"); await w.waitForTimeout(200);
  await shotOf(w, "06-danh-muc-dang-sua");
  ok("V9.4: đang sửa → hiện 'Có thay đổi chưa lưu', dữ liệu gốc chưa đổi", /chưa lưu/.test(await w.locator("#main tr.catedit").innerText()) && (await w.evaluate(() => window.hakStore.load()).then((t) => JSON.parse(t.text).dm_luong[0]["Tên mã lương"] || JSON.parse(t.text).dm_luong[0][Object.keys(JSON.parse(t.text).dm_luong[0])[4]])) !== "Sửa hồi tố E2E");
  await w.locator("#main tr.catedit").locator('button:has-text("Lưu")').click(); await w.waitForTimeout(300);
  await w.locator("#main tr.catedit").locator('button:has-text("Hủy")').click().catch(() => {}); await w.waitForTimeout(200);
  ok("Q-14: Kế toán lương sửa danh mục có hiệu lực trong kỳ đã chốt → bị chặn, chỉ Admin", dialogs.some((d) => /Chỉ Admin/.test(d)) && (await w.locator("#main tbody tr").first().locator("input").nth(4).inputValue()) === before, dialogs.join(" | ") + " || " + (await w.locator("#main .warn").allInnerTexts().catch(() => [])).join("|"));
  await w.click('#top button:has-text("Đăng xuất")'); await w.waitForSelector("#main input[data-f=u]");
  await auth(w, ADMIN); dialogs = [];
  await w.click("#nav button[data-k=dm]"); await w.click('#main button:has-text("Mã lương")');
  const cell2 = w.locator("#main tbody tr").first().locator("input").nth(4);
  await w.locator("#main tbody tr").first().locator('button:has-text("Sửa")').click();
  await cell2.fill("Sửa hồi tố E2E"); await cell2.press("Tab");
  await w.locator("#main tr.catedit").locator('button:has-text("Lưu")').click(); await w.waitForTimeout(700);
  ok("Admin sửa được dữ liệu hồi tố (có cảnh báo)", (await cell2.inputValue()) === "Sửa hồi tố E2E" && !dialogs.some((d) => /Chỉ Admin/.test(d)));
  // Q-15: phụ lục đã dùng tính lương kỳ đã chốt → không ai sửa được (kể cả Admin); thêm phụ lục mới thì được
  dialogs = [];
  await w.click("#nav button[data-k=nhansu]"); await w.locator("#main table tbody tr").first().click();
  await w.click('.subtabs button:has-text("Hợp đồng lao động")'); await w.waitForTimeout(300);
  await w.click('#main button:has-text("Chi tiết hợp đồng")'); await w.waitForSelector(".dlg [data-hd-detail]");
  const plCard = w.locator(".card", { has: w.locator('h3:has-text("Lương & phụ lục HĐ")') });
  const nPL = await plCard.locator("tbody tr").count();
  await plCard.locator("tbody tr", { hasText: "01/01/2025" }).first().click(); await w.waitForSelector(".dlg"); // phụ lục đã dùng cho kỳ chốt 9/2026 (phụ lục 11/2026 thêm ở bước UI nằm trên cùng)
  const lock15 = await w.locator(".dlg .locked").innerText().catch(() => "");
  await w.click(".dlg footer button.pri"); await w.waitForTimeout(300);
  const blocked15 = dialogs.some((d) => /Q-15/.test(d) && /PHỤ LỤC MỚI/.test(d)) && /Q-15/.test(lock15);
  if (await w.locator("#modal.drawer .dlg").count()) await w.click("#modal.drawer .dlg header button");
  await w.waitForSelector(".dlg [data-hd-detail]");
  await plCard.locator('button:has-text("Thêm")').click(); await w.waitForSelector("#modal.drawer .dlg");
  const q22Opts = await w.locator(".dlg .fld", { hasText: "Cách áp dụng trong tháng hiệu lực" }).locator("option").allInnerTexts();
  ok("Q-22: form phụ lục có lựa chọn 'Cách áp dụng trong tháng hiệu lực' (Cả tháng / Từ ngày hiệu lực)", q22Opts.includes("Cả tháng") && q22Opts.includes("Từ ngày hiệu lực"), q22Opts.join(", "));
  await w.click(".dlg footer button.pri"); await w.waitForTimeout(400);
  const nPL2 = await w.locator(".card", { has: w.locator('h3:has-text("Lương & phụ lục HĐ")') }).locator("tbody tr").count();
  ok("Q-15: Admin KHÔNG sửa được phụ lục đã dùng cho kỳ đã chốt; thêm phụ lục mới thì được", blocked15 && nPL2 === nPL + 1, dialogs.join(" | ").slice(0, 160) + " · phụ lục " + nPL + "→" + nPL2);
  ok("Không lỗi JavaScript khi phân quyền", errs.length === 0, errs.join(" | "));
  await app.close();
  const sv2 = JSON.parse(fs.readFileSync(path.join(DATA, "data.json"), "utf8"));
  const k1 = sv2.nguoidung.find((u) => u.tenDangNhap === "ketoan1"), hoito = sv2.auditlog.filter((x) => /HỒI TỐ/.test(x.chiTiet));
  ok("Mật khẩu lưu dạng băm PBKDF2 (không lưu mật khẩu rõ), có muối riêng", sv2.nguoidung.length === 2 && k1.hash.length === 64 && k1.salt.length === 32 && k1.iter >= 210000 && !JSON.stringify(sv2.nguoidung).includes("Moi12345kt") && k1.salt !== sv2.nguoidung[0].salt);
  ok("Nhật ký ghi tài khoản đăng nhập: đăng nhập, thêm người dùng, sửa HỒI TỐ bởi Admin", sv2.auditlog.some((x) => x.thaoTac === "Thêm người dùng" && /\[admin\]/.test(x.nguoi)) && sv2.auditlog.some((x) => x.thaoTac === "Đăng nhập" && /\[ketoan1\]/.test(x.nguoi)) && hoito.length >= 1 && hoito.every((x) => /\[admin\]/.test(x.nguoi)), hoito.map((x) => x.nguoi).join(","));

  // A3-01: đổi Số HĐLĐ của hợp đồng có hiệu lực trong kỳ đã chốt rồi bấm HỦY → phụ lục KHÔNG được đổi theo (trước đây bị đổi trước khi hỏi → mồ côi)
  {
    const d0 = JSON.parse(fs.readFileSync(path.join(DATA, "data.json"), "utf8")), ma = d0.nhanvien[0]["Mã NV"];
    d0.hopdong.push({ _id: "e2ehd2", "Mã NV": ma, "Số HĐLĐ": "E2E-HD2", "Ngày vào làm": "2026-09-20", "Hình thức HĐLĐ": "Xác định thời hạn" });
    d0.chitiethd.push({ _id: "e2epl2", "Mã NV": ma, "Số HĐLĐ": "E2E-HD2", "Hiệu lực từ": "2026-10-01", "Mã lương": "TG1", "Lương thỏa thuận": "13000000", "Mức đóng bảo hiểm": "BH01", "Thuế TNCN": "LT01", "HTTT": "Tiền mặt" });
    fs.writeFileSync(path.join(DATA, "data.json"), JSON.stringify(d0));
    ({ app, w, errs } = await launch());
    await w.click("#nav button[data-k=nhansu]"); await w.locator("#main table tbody tr").first().click();
    await w.click('.subtabs button:has-text("Hợp đồng lao động")'); await w.waitForTimeout(300);
    const hdCard = () => w.locator(".card", { has: w.locator('h3:has-text("Hợp đồng lao động")') });
    const plRows = async () => { await hdCard().locator("tbody tr", { hasText: "E2E-HD2" }).click(); await w.waitForTimeout(250); await w.click('#main button:has-text("Chi tiết hợp đồng")'); await w.waitForSelector(".dlg [data-hd-detail]"); const n = await w.locator(".card", { has: w.locator('h3:has-text("Lương & phụ lục HĐ")') }).locator("tbody tr").count(); await w.click('.dlg footer button:has-text("Đóng")'); await w.waitForTimeout(200); return n; };
    const n0 = await plRows();
    dialogs = []; dismissConfirm = true;
    await hdCard().locator("tbody tr", { hasText: "E2E-HD2" }).locator('button[title="Sửa"]').click(); await w.waitForSelector(".dlg");
    await w.locator(".dlg .fld", { hasText: "Số HĐLĐ" }).first().locator("input").fill("E2E-HD2-MOI");
    await w.click(".dlg footer button.pri"); await w.waitForTimeout(300);
    const asked = dialogs.some((d) => /kỳ lương ĐÃ CHỐT/.test(d)); dismissConfirm = false;
    if (await w.locator(".dlg").count()) await w.click(".dlg header button");
    await w.click("#nav button[data-k=home]"); await w.click("#nav button[data-k=nhansu]"); await w.locator("#main table tbody tr").first().click();
    await w.click('.subtabs button:has-text("Hợp đồng lao động")'); await w.waitForTimeout(300);
    const n1 = await plRows();
    ok("A3-01: đổi Số HĐLĐ hồi tố rồi bấm Hủy → phụ lục vẫn thuộc hợp đồng cũ (không mồ côi)", asked && n0 === 1 && n1 === 1, "hỏi xác nhận=" + asked + " · phụ lục HĐ2 trước/sau: " + n0 + "/" + n1);
    await app.close();
  }

  // PR5: bảng lớn chia trang (PERF-03) + ô tìm kiếm nhớ theo từng bảng khi chuyển màn hình
  {
    const d0 = JSON.parse(fs.readFileSync(path.join(DATA, "data.json"), "utf8")), ma = d0.nhanvien[0]["Mã NV"];
    for (let i = 1; i <= 260; i++) d0.sanluong.push({ _id: "sl" + i, "Phiếu cân": "E2E-PC" + String(i).padStart(3, "0"), "Ngày cân": "2026-11-" + String(1 + (i % 28)).padStart(2, "0"), "KL hàng (Tấn)": "1", "Mã NV": ma });
    fs.writeFileSync(path.join(DATA, "data.json"), JSON.stringify(d0));
    ({ app, w, errs } = await launch());
    await w.click("#nav button[data-k=sanluong]"); await w.waitForSelector("#top select");
    await w.selectOption("#top select", "11"); await w.fill("#top input[type=number]", "2026"); await w.dispatchEvent("#top input[type=number]", "change");
    await w.waitForSelector("main tbody tr");
    const n1 = await w.locator("main tbody tr").count(), p1 = await w.locator(".pager span").first().innerText();
    await w.locator('.pager button[title="Trang sau"]').first().click(); await w.waitForTimeout(150);
    const p2 = await w.locator(".pager span").first().innerText(), first2 = await w.locator("main tbody tr").first().locator("input").first().inputValue();
    await w.locator("input.search").fill("E2E-PC25"); await w.waitForTimeout(450);
    const nf = await w.locator("main tbody tr").count(), hint = await w.locator("main .bar .hint").innerText();
    await w.click("#nav button[data-k=home]"); await w.click("#nav button[data-k=sanluong]"); await w.waitForSelector("main tbody tr");
    const kept = await w.locator("input.search").inputValue(), nk = await w.locator("main tbody tr").count();
    ok("Bảng lớn chia trang: 260 dòng → trang 1 có 100 dòng, sang trang 2 đúng dòng 101; tìm kiếm lọc sau khi ngừng gõ",
      n1 === 100 && /Trang 1\/3/.test(p1) && /Trang 2\/3/.test(p2) && first2 === "E2E-PC101" && nf === 10 && /đang lọc/.test(hint), n1 + " dòng · " + p1 + " → " + p2 + " · dòng đầu trang 2 " + first2 + " · lọc còn " + nf);
    ok("Ô tìm kiếm nhớ theo từng bảng khi chuyển màn hình", kept === "E2E-PC25" && nk === 10, "'" + kept + "' · " + nk + " dòng");
    await w.locator("input.search").fill(""); await w.waitForTimeout(400);
    // Enter = xuống ô cùng cột dòng dưới (ô vừa gõ được ghi — giữ nguyên chữ "2,5", engine đọc 2,5 tấn); Ctrl+F = vào ô tìm kiếm
    const klCol = 3, r0 = w.locator("main tbody tr").nth(0).locator("input").nth(klCol);
    await r0.click(); await r0.fill("2,5"); await r0.press("Enter"); await w.waitForTimeout(150);
    const focusRow = await w.evaluate(() => { const a = document.activeElement, tr = a && a.closest("tr"); return tr ? Array.prototype.indexOf.call(tr.parentNode.children, tr) : -1; });
    await w.keyboard.press("Control+f"); const inSearch = await w.evaluate(() => document.activeElement && document.activeElement.classList.contains("search"));
    await w.waitForTimeout(600);
    const savedKL = JSON.parse(fs.readFileSync(path.join(DATA, "data.json"), "utf8")).sanluong.find((x) => x["Phiếu cân"] === "E2E-PC001");
    ok("Bàn phím: Enter xuống dòng dưới cùng cột (ô vừa gõ đã ghi), Ctrl+F vào ô tìm kiếm", focusRow === 1 && inSearch && savedKL && savedKL["KL hàng (Tấn)"] === "2,5", "dòng đang chọn=" + focusRow + " · ô tìm kiếm=" + inSearch + " · KL đã lưu=" + (savedKL && savedKL["KL hàng (Tấn)"]));
    ok("Không lỗi JavaScript khi chia trang", errs.length === 0, errs.join(" | "));
    await app.close();
  }

  // Q-24 (chủ sở hữu duyệt): Trưởng bộ phận không có quyền xem lương → không thấy lương cá nhân ở hồ sơ, danh sách, phụ lục, báo cáo
  {
    ({ app, w, errs } = await launch());
    await w.click("#nav button[data-k=nhansu]"); await w.waitForSelector("main thead th");
    const adminCols = await w.locator("main thead th").allInnerTexts();
    await w.click("#nav button[data-k=backup]"); await w.click('button:has-text("Thêm người dùng")'); await w.waitForSelector(".dlg");
    const ui = w.locator(".dlg .fgrid input");
    await ui.nth(0).fill("tbp1"); await ui.nth(1).fill("Trưởng BP"); await ui.nth(2).fill("Tam12345");
    await w.locator(".dlg .fgrid select").nth(0).selectOption("truongbophan");
    await w.click(".dlg footer button.pri"); await w.waitForTimeout(300);
    await app.close();
    { // hồ sơ khen thưởng có tiền thưởng (thuộc hợp đồng đang chọn E2E-HD2)
      const dk = JSON.parse(fs.readFileSync(path.join(DATA, "data.json"), "utf8"));
      dk.khenthuong = (dk.khenthuong || []).concat([{ _id: "kt1", "Mã NV": dk.nhanvien[0]["Mã NV"], "Số HĐLĐ": "E2E-HD2", "Ngày": "2026-10-02", "Hình thức khen thưởng": "Giấy khen E2E", "Giá trị tiền thưởng": "777000" }]);
      fs.writeFileSync(path.join(DATA, "data.json"), JSON.stringify(dk));
    }
    ({ app, w, errs } = await launch(null, { who: { u: "tbp1", p: "Tam12345" } }));
    const pw2 = w.locator(".dlg input[type=password]");
    await pw2.nth(0).fill("Tam12345"); await pw2.nth(1).fill("Moi12345tb"); await pw2.nth(2).fill("Moi12345tb"); await w.click(".dlg footer button.pri"); await w.waitForTimeout(500);
    await w.click("#nav button[data-k=nhansu]"); await w.waitForSelector("main thead th");
    const tbCols = await w.locator("main thead th").allInnerTexts();
    await w.locator("#main table tbody tr").first().click(); await w.waitForTimeout(300);
    const head = await w.locator("main").first().innerText();
    await w.click('.subtabs button:has-text("Hợp đồng lao động")'); await w.waitForTimeout(300);
    await w.click('#main button:has-text("Chi tiết hợp đồng")'); await w.waitForSelector(".dlg [data-hd-detail]");
    const plCardT = w.locator(".card", { has: w.locator('h3:has-text("Lương & phụ lục HĐ")') });
    const plText = await plCardT.innerText();
    await plCardT.locator("tbody tr").first().click(); await w.waitForSelector(".dlg");
    const formText = await w.locator(".dlg").innerText(), salaryInput = await w.locator(".dlg .fld", { hasText: "Lương thỏa thuận" }).count();
    await w.click("#modal.drawer .dlg header button"); await w.waitForSelector(".dlg [data-hd-detail]");
    await w.click('.dlg .subtabs button:has-text("Khen thưởng")'); await w.waitForTimeout(300);
    const ktText = await w.locator(".card", { has: w.locator('h3:has-text("Khen thưởng")') }).innerText();
    await w.click('.dlg footer button:has-text("Đóng")'); await w.waitForTimeout(200);
    ok("Q-24 bổ sung: Trưởng bộ phận thấy hồ sơ khen thưởng nhưng Giá trị tiền thưởng hiện 🔒 ẩn", /Giấy khen E2E/.test(ktText) && /🔒 ẩn/.test(ktText) && !/777[.]?000/.test(ktText), ktText.replace(/\s+/g, " ").slice(0, 160));
    await w.click("#nav button[data-k=baocao]"); await w.waitForTimeout(200);
    const sl = w.locator('.subtabs button:has-text("Sổ")'); if (await sl.count()) { await sl.first().click(); await w.waitForTimeout(300); }
    const rep = await w.locator("main").first().innerText();
    ok("Q-24: Admin vẫn thấy cột Lương thỏa thuận; Trưởng bộ phận KHÔNG thấy (danh sách, đầu hồ sơ, phụ lục, form, sổ lao động)",
      adminCols.includes("Lương thỏa thuận") && !tbCols.includes("Lương thỏa thuận") && !/1[23]\.?000\.?000/.test(head + plText + formText + rep) && /🔒 ẩn/.test(plText) && salaryInput === 0 && /ô lương được ẩn/.test(formText),
      "cột admin/tbp: " + adminCols.includes("Lương thỏa thuận") + "/" + tbCols.includes("Lương thỏa thuận") + " · phụ lục có '🔒 ẩn': " + /🔒 ẩn/.test(plText) + " · ô lương trong form: " + salaryInput + " · có số lương 12/13 triệu: " + /1[23]\.?000\.?000/.test(head + plText + formText + rep));
    ok("Không lỗi JavaScript với vai trò Trưởng bộ phận", errs.length === 0, errs.join(" | "));
    await app.close();
  }

  // (A) + (D): thư mục sao lưu thứ hai + nhắc sao lưu ra ngoài máy
  {
    const USB = fs.mkdtempSync(path.join(os.tmpdir(), "hak-usb-"));
    ({ app, w, errs } = await launch());
    await w.click("#nav button[data-k=home]"); await w.waitForTimeout(200);
    const homeBefore = await w.locator("main").first().innerText();
    await app.evaluate(({ dialog }, p) => { dialog.showOpenDialogSync = () => [p]; }, USB); // giả lập người dùng chọn thư mục trong hộp thoại Windows
    await w.click("#nav button[data-k=backup]"); await w.click('button:has-text("Chọn thư mục sao lưu thứ hai")'); await w.waitForTimeout(500);
    const card = await w.locator(".card", { has: w.locator('h3:has-text("Sao lưu ra ngoài máy")') }).innerText();
    const mir = fs.readdirSync(path.join(USB, "TinhLuongHAK-SaoLuu"));
    await w.click("#nav button[data-k=home]"); await w.waitForTimeout(200);
    const homeAfter = await w.locator("main").first().innerText();
    ok("(D) Trang chủ nhắc khi CHƯA có bản sao lưu ra ngoài máy", /Chưa có bản sao lưu nào ra ngoài máy/.test(homeBefore));
    ok("(A) Chọn thư mục thứ hai → chép ngay các bản sau chốt kỳ (+ file kiểm tra SHA-256); hết lời nhắc", card.includes(USB) && mir.filter((f) => /^sau-chot-2026-09_.*\.json$/.test(f)).length === 2 && mir.some((f) => /\.sha256$/.test(f)) && !/Chưa có bản sao lưu nào ra ngoài máy|ngày chưa sao lưu ra ngoài máy|Không chép được/.test(homeAfter) && /Đã sao lưu ra ngoài máy/.test(homeAfter), mir.join(", "));
    ok("Không lỗi JavaScript ở sao lưu ra ngoài máy", errs.length === 0, errs.join(" | "));
    await app.close();
  }

  // α19: phân bổ khối lượng NHƯ CÔNG CỤ — phiếu ghi Mã phòng ban + NV vắng chia đều cho tổ; bù lương theo ngày bậc thang (Đại Hiệp); biểu mẫu Excel
  {
    const f = path.join(DATA, "data.json"), d0 = JSON.parse(fs.readFileSync(f, "utf8"));
    const T = [["T1", "Trần Văn Long"], ["T2", "Lê Văn Định"], ["T3", "Phan Văn Hùng"], ["T4", "Ngô Minh"]];
    T.forEach(([ma, ten], i) => {
      d0.nhanvien.push({ _id: "pbn" + i, "Mã NV": ma, "Họ và tên": ten, "Trạng thái": "Đang làm việc" });
      d0.hopdong.push({ _id: "pbh" + i, "Mã NV": ma, "Số HĐLĐ": ma + "/HĐ", "Hình thức HĐLĐ": "Xác định thời hạn", "Ngày vào làm": "2025-01-01", "Ngày chấm dứt": ma === "T4" ? "2026-10-05" : "" });
      d0.chitiethd.push({ _id: "pbc" + i, "Mã NV": ma, "Số HĐLĐ": ma + "/HĐ", "Hiệu lực từ": "2025-01-01", "Loại phụ lục": "Hợp đồng gốc", "Phòng ban": "02.02", "Mã hình thức lương": "LSP", "Mã lương": "SP", "Lương thỏa thuận": "0", "HTTT": "Tiền mặt", "Thuế TNCN": "MT00" });
      d0.chamcong.push({ _id: "pbcc" + i, "Kỳ": "2026-10", "Mã NV": ma, "Hình thức công": "BT", "01": "1", "02": ma === "T3" ? "0,5" : "" });
    });
    fs.writeFileSync(f, JSON.stringify(d0)); // app đang đóng (khối trước đã đóng)
    ({ app, w, errs } = await launch());
    // Nhập file đúng MẪU CÔNG CỤ (dòng tiêu đề phía trên, cột "Ngày cân 1", "Mã phòng ban", "NV vắng")
    const ExcelJS = require(path.join(APP, "exceljs.min.js")), X = require(path.join(APP, "ui/pbkl-xlsx.js"));
    const twb = X.template(ExcelJS, "sanluong", { mau: "01/10/2026" }), tws = twb.worksheets[0];
    [[1, ["P1", "01/10/2026", "43A-1", "", "", 30, "02.02", "Long"]], [2, ["P2", "06/10/2026", "43A-2", "", "", 9, "02.02", ""]], [3, ["P3", "02/10/2026", "43A-3", "", "", 6, "02.02", "Hùng"]]]
    // P2 ngày 06/10: chấm công chỉ nhập đến ngày 02 (xem d0.chamcong ở trên) → cả tổ CHƯA CÓ chấm công
    // ngày 06 — minh họa đúng mục IX (PENDING_ATTENDANCE): không còn tự coi cả tổ có mặt để chia theo
    // NV vắng (R-73 cũ) nữa, 9 tấn của P2 giữ ở trạng thái chờ phân bổ.
      .forEach(([i, v]) => { tws.getRow(4 + i).values = v; });
    tws.getRow(8).values = ["P4", "01/10/2026", "43A-4", "", "", 5, "09.99", ""];
    const tfile = path.join(DL, "..", "phieu_can_mau_cong_cu.xlsx"); fs.writeFileSync(tfile, new Uint8Array(await twb.xlsx.writeBuffer()));
    await w.click("#nav button[data-k=sanluong]");
    await w.selectOption("#top select", "10"); await w.fill("#top input[type=number]", "2026"); await w.dispatchEvent("#top input[type=number]", "change"); await w.waitForTimeout(200);
    const [fc] = await Promise.all([w.waitForEvent("filechooser"), w.locator('#main button:has-text("Nhập Excel")').first().click()]);
    await fc.setFiles(tfile); await w.waitForSelector(".dlg footer button.pri");
    const pv = await w.locator(".dlg").innerText();
    await w.click(".dlg footer button.pri"); await w.waitForTimeout(500);
    const slNow = JSON.parse(fs.readFileSync(f, "utf8")).sanluong.filter((r) => /^P\d$/.test(r["Phiếu cân"]));
    ok("Nhập phiếu cân theo MẪU CÔNG CỤ (tiêu đề phía trên, Ngày cân 1, Mã phòng ban, NV vắng) — 4 phiếu, mã tổ lạ được cảnh báo", slNow.length === 4 && slNow.find((r) => r["Phiếu cân"] === "P1")["NV vắng"] === "Long" && slNow.find((r) => r["Phiếu cân"] === "P1")["Ngày cân"] === "2026-10-01" && /09\.99/.test(pv), slNow.length + " phiếu · " + pv.replace(/\s+/g, " ").slice(0, 160));
    // Bù theo ngày bậc thang (Đại Hiệp) → báo cáo phân bổ + file Excel mẫu công cụ
    await w.click("#nav button[data-k=luong]"); await w.selectOption('select[aria-label="Cách bù lương sản lượng"]', "daihiep");
    await w.click("#nav button[data-k=baocaoluong]"); await w.click('#main button:has-text("Phân bổ sản lượng")'); await w.waitForTimeout(300);
    const pbTxt = await w.locator("main").first().innerText();
    await w.click('#main button:has-text("mẫu công cụ phân bổ")');
    let xf2 = null; for (let i = 0; i < 40 && !xf2; i++) { await w.waitForTimeout(200); xf2 = fs.readdirSync(DL).filter((x) => /^Phan_bo_khoi_luong_2026-10\.xlsx$/.test(x))[0]; }
    let tan = {}, bu = {}, sheets = "", buNgay = {};
    if (xf2) {
      await w.waitForTimeout(300);
      const XLSX = require(path.join(APP, "xlsx.full.min.js")), wb2 = XLSX.read(fs.readFileSync(path.join(DL, xf2)), { type: "buffer" }); sheets = wb2.SheetNames.join("|");
      XLSX.utils.sheet_to_json(wb2.Sheets["Chi tiet cong nhan"], { header: 1 }).forEach((r) => { if (/^T\d$/.test(r[2])) tan[r[2]] = r[r.length - 1]; });
      XLSX.utils.sheet_to_json(wb2.Sheets["Tien luong va bu luong"], { header: 1 }).forEach((r) => { if (/^T\d$/.test(r[2])) bu[r[2]] = r[r.length - 2]; });
      XLSX.utils.sheet_to_json(wb2.Sheets["Bu luong theo ngay - DH"], { header: 1 }).forEach((r) => { if (/^Tổng bù cả tháng/.test(String(r[0] || ""))) { const ma = /\(([^)]+)\)/.exec(r[0])[1]; buNgay[ma] = r[r.length - 1]; } });
    }
    // R-73: ngày 02/10 chỉ T3 có công (0,5) mà phiếu P3 ghi vắng Hùng (T3) → T1, T2, T4 công 0 = nghỉ → P3 6 tấn chưa phân bổ.
    // Mục IX (ghi đè phần 3 của R-73, chủ sở hữu xác nhận lại 13/10/2026 — xem PV-16): ngày 06/10 cả tổ
    // CHƯA CÓ chấm công → P2 9 tấn cũng chưa phân bổ (PENDING_ATTENDANCE), KHÔNG còn chia theo NV vắng
    // nữa — T1 (chỉ có phần từ P2 trong thiết kế cũ) giờ còn 0; T2/T3 mất phần 3 tấn từ P2 (13→10).
    ok("Chia phiếu theo tổ như công cụ: trừ NV vắng, người đã nghỉ việc / công = 0 không nhận; ngày chưa chấm công → chờ phân bổ — T1 không có sản lượng (không ra dòng) · T2 10 · T3 10 · T4 10 tấn; P2 (chưa chấm công), P3 (không ai có công) và phiếu mã tổ lạ chưa phân bổ",
      !tan.T1 && tan.T2 === 10 && tan.T3 === 10 && tan.T4 === 10 && /09\.99/.test(pbTxt) && /chưa phân bổ/.test(pbTxt) && /PENDING_ATTENDANCE/.test(pbTxt), JSON.stringify(tan));
    ok("Bù lương theo ngày bậc thang (Đại Hiệp): T2, T3 ngày 01 (1 công BT, 10 tấn) bù 140.000; T1 không có sản lượng/công BT ngày có SL → không có dòng bù (0)",
      bu.T2 === 140000 && bu.T3 === 140000 && !bu.T1, JSON.stringify(bu));
    ok("Sheet 'Bu luong theo ngay - DH' (mục XVII): tổng bù cả tháng mỗi người khớp đúng cột 'Bù lương' ở sheet tổng hợp",
      buNgay.T2 === 140000 && buNgay.T3 === 140000, JSON.stringify(buNgay));
    ok("File Excel đủ sheet như công cụ", sheets === "Huong dan su dung|Tong hop phong ban|Phan bo theo phong ban|Chi tiet cong nhan|Doi soat phieu can|Tien luong va bu luong|Bu luong theo ngay - DH|Du lieu - Khoi luong", sheets);
    // File mẫu tải từ app = mẫu công cụ
    await w.click("#nav button[data-k=sanluong]"); await w.click('#main button:has-text("Tải file mẫu")');
    let mf = null; for (let i = 0; i < 30 && !mf; i++) { await w.waitForTimeout(200); mf = fs.readdirSync(DL).filter((x) => x === "mau_bang_khoi_luong.xlsx")[0]; }
    let mh = "";
    if (mf) { await w.waitForTimeout(300); const XLSX = require(path.join(APP, "xlsx.full.min.js")), wm = XLSX.read(fs.readFileSync(path.join(DL, mf)), { type: "buffer" }); mh = (XLSX.utils.sheet_to_json(wm.Sheets[wm.SheetNames[0]], { header: 1 })[3] || []).join("|"); }
    ok("Tải file mẫu Sản lượng = mẫu công cụ (Phiếu cân | Ngày cân 1 | Biển số 1 | Cân lần 1 | Cân lần 2 | KL hàng (Tấn) | Mã phòng ban | NV vắng)", mh === "Phiếu cân|Ngày cân 1|Biển số 1|Cân lần 1|Cân lần 2|KL hàng (Tấn)|Mã phòng ban|NV vắng", mh);
    await w.click("#nav button[data-k=luong]"); await w.selectOption('select[aria-label="Cách bù lương sản lượng"]', "to");
    ok("Không lỗi JavaScript ở phân bổ khối lượng (ExcelJS chạy được với CSP)", errs.length === 0, errs.join(" | "));
    await app.close();
  }

  // V10: Nghiệp vụ nhân sự độc lập — lập đề nghị → gửi duyệt → duyệt → ghi vào hồ sơ + đối chiếu chấm công
  {
    const SD = fs.mkdtempSync(path.join(os.tmpdir(), "hak-e2e-nvns-"));
    ({ app, w, errs } = await launch(SD));
    await app.close();
    const fb = path.join(SD, "data.json"), db2 = JSON.parse(fs.readFileSync(fb, "utf8"));
    db2.nhanvien.push({ _id: "hr1", "Mã NV": "HR1", "Họ và tên": "Nguyễn Văn Ân", "Trạng thái": "Đang làm việc" });
    db2.hopdong.push({ _id: "hr1hd", "Mã NV": "HR1", "Số HĐLĐ": "HR1/HĐ", "Hình thức HĐLĐ": "Xác định thời hạn", "Ngày vào làm": "2026-01-01" });
    db2.chitiethd.push({ _id: "hr1pl", "Mã NV": "HR1", "Số HĐLĐ": "HR1/HĐ", "Hiệu lực từ": "2026-01-01", "Mã lương": "TG1", "Lương thỏa thuận": "9000000", "HTTT": "Tiền mặt" });
    db2.chamcong.push({ "Kỳ": "2026-11", "Mã NV": "HR1", "Hình thức công": "BT", "03": "1" });
    fs.writeFileSync(fb, JSON.stringify(db2));
    ({ app, w, errs } = await launch(SD));
    await w.click("#nav button[data-k=nvns]"); await w.waitForSelector(".card");
    await w.click('#main button:has-text("Lập đề nghị")'); await w.waitForSelector("#modal.drawer .dlg");
    const fld = (k) => w.locator('.dlg .fld[data-k="' + k + '"]');
    await fld("Mã NV").locator("select").selectOption("HR1"); await fld("Loại nghiệp vụ").locator("select").selectOption("Nghỉ không lương");
    await fld("Từ ngày").locator("input").fill("2026-11-03"); await fld("Đến ngày").locator("input").fill("2026-11-04"); await fld("Số ngày").locator("input").fill("2");
    await fld("Lý do").locator("textarea").fill("Việc gia đình E2E");
    await w.click(".dlg footer button.pri"); await w.waitForTimeout(400);
    const r1 = await w.locator("table.nvns tbody tr").first().innerText();
    ok("V10: Nghiệp vụ nhân sự — lập đề nghị lưu ở trạng thái Nháp, chưa ghi vào hồ sơ", /Nháp/.test(r1) && /Nguyễn Văn Ân/.test(r1) && /03\/11\/2026/.test(r1), r1.replace(/\s+/g, " "));
    await w.click('table.nvns button:has-text("Gửi duyệt")'); await w.waitForTimeout(300);
    ok("V10: Nghiệp vụ nhân sự — gửi duyệt chuyển sang Chờ duyệt", /Chờ duyệt/.test(await w.locator("table.nvns tbody tr").first().innerText()));
    dialogs = [];
    await w.click('table.nvns button:has-text("Duyệt")'); await w.waitForTimeout(500);
    ok("V10: Nghiệp vụ nhân sự — khi duyệt cảnh báo ngày vẫn có công trong chấm công (đối chiếu)", dialogs.some((d) => /vẫn có công thường 1 ngày/.test(d)), dialogs.join(" | ").slice(0, 200));
    await w.waitForTimeout(500);
    const nv2 = await w.locator("table.nvns tbody tr").first().innerText();
    ok("V10: Nghiệp vụ nhân sự — Đã duyệt, ghi vào Nghỉ phép của hợp đồng, không còn nút sửa/duyệt", /Đã duyệt/.test(nv2) && /Nghỉ phép/.test(nv2) && !(await w.locator('table.nvns button:has-text("Duyệt")').count()));
    await w.fill('input[aria-label="Tìm nhân viên"]', "nguyen van an"); await w.press('input[aria-label="Tìm nhân viên"]', "Enter"); await w.waitForTimeout(300);
    ok("V10: Nghiệp vụ nhân sự — tìm theo tên không dấu", (await w.locator("table.nvns tbody tr").count()) === 1);
    await w.waitForTimeout(800); await app.close();
    const sv = JSON.parse(fs.readFileSync(fb, "utf8")), np = (sv.nghiphep || []).filter((x) => x["Mã NV"] === "HR1");
    ok("V10: Nghiệp vụ nhân sự — hồ sơ Nghỉ phép có đúng 1 dòng 'Nghỉ không hưởng lương' Đã duyệt gắn Số HĐLĐ, ghi nhật ký", np.length === 1 && np[0]["Loại nghỉ"] === "Nghỉ không hưởng lương" && np[0]["Trạng thái duyệt"] === "Đã duyệt" && np[0]["Số HĐLĐ"] === "HR1/HĐ" && sv.auditlog.some((a) => /Nghiệp vụ nhân sự/.test(a.chiTiet + a.thaoTac)), JSON.stringify(np));
    ok("Không lỗi JavaScript ở Nghiệp vụ nhân sự", errs.length === 0, errs.join(" | "));
  }

  // V10.1: 6 mẫu báo cáo riêng — nhân sự, sản lượng, bơm dăm, thưởng/trừ, tạm ứng, suất cơm (dữ liệu giả lập, kỳ 09/2026)
  {
    const SD = fs.mkdtempSync(path.join(os.tmpdir(), "hak-e2e-ops-"));
    ({ app, w, errs } = await launch(SD)); await app.close();
    const fb = path.join(SD, "data.json"), d3 = JSON.parse(fs.readFileSync(fb, "utf8"));
    d3.nhanvien.push({ _id: "o1", "Mã NV": "F1", "Họ và tên": "Trần Thị Bình", "Trạng thái": "Đang làm việc" }, { _id: "o2", "Mã NV": "F2", "Họ và tên": "Lê Văn Cường", "Trạng thái": "Đang làm việc" });
    d3.sanluong.push({ "Phiếu cân": "S1", "Ngày cân": "2026-09-02", "Biển số": "43C-1", "KL hàng (Tấn)": 3.13, "Mã NV": "F1" }, { "Phiếu cân": "S2", "Ngày cân": "2026-09-03", "Biển số": "43C-2", "KL hàng (Tấn)": 9.11, "Mã NV": "F2" }, { "Phiếu cân": "S3", "Ngày cân": "2026-09-15", "Biển số": "43C-3", "KL hàng (Tấn)": 28.5, "Mã NV": "F1" });
    d3.bandam.push({ "Phiếu cân": "B1", "Ngày cân": "2026-09-01", "KL hàng (Tấn)": 1, "Mã NV": "F1" }, { "Phiếu cân": "B2", "Ngày cân": "2026-09-01", "KL hàng (Tấn)": 1, "Mã NV": "F2" });
    d3.psluong.push({ "Ngày hạch toán": "2026-09-30", "Số chứng từ": "QĐ-1", "Mã NV": "F1", "Diễn giải": "Thưởng chuyên cần", "Thưởng": 500000, "Thu nhập khác": 0, "Trừ khác": 0 });
    d3.ungluong.push({ "Ngày hạch toán": "2026-09-15", "Số chứng từ": "PC-1", "Mã NV": "F1", "Diễn giải": "Tạm ứng kỳ 1", "Tạm ứng": 2000000 });
    d3.tiencom.push({ "Ngày": "2026-09-15", "Mã NV": "F1", "Số suất cơm": 1, "Ghi chú": "" });
    fs.writeFileSync(fb, JSON.stringify(d3));
    ({ app, w, errs } = await launch(SD));
    await w.click("#nav button[data-k=psluong]"); await w.selectOption("#top select", "9"); await w.fill("#top input[type=number]", "2026"); await w.dispatchEvent("#top input[type=number]", "change"); await w.waitForTimeout(300);
      const EX2 = require(path.join(APP, "exceljs.min.js"));
      const waitFile = async (re, before) => { let n = null; for (let i = 0; i < 40 && !n; i++) { await w.waitForTimeout(250); n = fs.readdirSync(DL).filter((f) => re.test(f) && !before.includes(f))[0]; } return n; };
      const spec = [["rp_ns", "DANH SÁCH NHÂN SỰ", "NHAN_SU", "Mã NV"], ["rp_sl", "BẢNG KÊ PHIẾU CÂN SẢN LƯỢNG", "SAN_LUONG", "Phiếu cân"], ["rp_bd", "BẢNG KÊ BƠM DĂM", "BOM_DAM", "Số xe"],
        ["rp_th", "BẢNG KÊ THƯỞNG VÀ CÁC KHOẢN THU NHẬP, KHẤU TRỪ KHÁC", "THUONG", "Thực nhận"], ["rp_tu", "BẢNG KÊ TẠM ỨNG LƯƠNG", "TAM_UNG", "Ký nhận"], ["rp_com", "BẢNG TỔNG HỢP SUẤT CƠM", "SUAT_COM", "Tổng suất"]];
      const info = [];
      for (const [nav, title, type, col] of spec) {
        await w.click("#nav button[data-k=" + nav + "]"); await w.waitForTimeout(150);
        const txt = await w.locator("#main").innerText(), nr = await w.locator("[data-ops-report=" + type + "] tbody tr").count();
        info.push(type + ":" + nr);
        ok("V10.1: mẫu báo cáo riêng " + type + " — tiêu đề IN HOA, cột đặc thù '" + col + "', có dòng dữ liệu + dòng tổng", txt.includes(title) && txt.includes(col) && nr >= 2, "dòng(kể cả tổng)=" + nr);
      }
      // Tạm ứng: lọc không khớp → rỗng; Excel đúng mẫu (chữ ký 4 bên, sheet tổng hợp theo NV, số liệu khớp dữ liệu nhập)
      await w.click("#nav button[data-k=rp_tu]");
      await w.locator("[data-ops-key=tuKhoa]").fill("khong-co-ai-ten-nay"); await w.locator("[data-ops-key=tuKhoa]").dispatchEvent("change"); await w.waitForTimeout(200);
      ok("V10.1: Bảng kê tạm ứng — bộ lọc từ khóa không khớp → báo không có dòng", /Không có dòng nào/.test(await w.locator("#main").innerText()));
      await w.locator("[data-ops-key=tuKhoa]").fill(""); await w.locator("[data-ops-key=tuKhoa]").dispatchEvent("change"); await w.waitForTimeout(200);
      let bf = fs.readdirSync(DL); await w.click('#main button:has-text("Xuất Excel")');
      const fTu = await waitFile(/^BangKeTamUng_2026-09\.xlsx$/, bf);
      if (!fTu) ok("V10.1: Excel Bảng kê tạm ứng", false, "không thấy file; hộp thoại: " + dialogs.join(" | ").slice(0, 160));
      else {
        const wb = new EX2.Workbook(); await wb.xlsx.load(fs.readFileSync(path.join(DL, fTu))); const ws = wb.worksheets[0]; const vals = []; ws.eachRow((r) => r.eachCell((c) => vals.push(String(c.value))));
        let hr = 0; ws.eachRow((r, i) => { if (!hr && r.getCell(1).value === "STT") hr = i; });
        ok("V10.1: Excel Bảng kê tạm ứng — IN HOA, 2 tầng tiêu đề, số tiền khớp dữ liệu nhập (2.000.000), có chữ ký Thủ quỹ, sheet tổng hợp theo NV",
          ws.getCell("A2").value === "BẢNG KÊ TẠM ỨNG LƯƠNG" && hr > 0 && ws.getCell(hr - 1, 1).value === "CHỨNG TỪ" && vals.includes("Thủ quỹ") && wb.worksheets.length === 2 && wb.worksheets[1].name === "TheoNhanVien" &&
          ws.getCell(hr + 1, 8).value === 2000000, JSON.stringify({ a2: ws.getCell("A2").value, hr, sheets: wb.worksheets.map((x) => x.name), tien: ws.getCell(hr + 1, 8).value }));
      }
      // Sản lượng: Excel đủ 3 sheet; phiếu chia tổ có cột người nhận từ kết quả chia tổ của app
      await w.click("#nav button[data-k=rp_sl]"); bf = fs.readdirSync(DL); await w.click('#main button:has-text("Xuất Excel")');
      const fSl = await waitFile(/^BangKeSanLuong_2026-09\.xlsx$/, bf);
      if (!fSl) ok("V10.1: Excel Bảng kê sản lượng", false, "không thấy file; hộp thoại: " + dialogs.join(" | ").slice(0, 160));
      else {
        const wb = new EX2.Workbook(); await wb.xlsx.load(fs.readFileSync(path.join(DL, fSl))); const ws = wb.worksheets[0]; let hr = 0; ws.eachRow((r, i) => { if (!hr && r.getCell(1).value === "STT") hr = i; });
        const kl = []; for (let i = hr + 1; i <= hr + 3; i++) kl.push(ws.getCell(i, 5).value);
        ok("V10.1: Excel Bảng kê sản lượng — 3 sheet (chi tiết, theo tổ, theo công nhân), KL khớp phiếu cân (3,13 / 9,11 / 28,5), tổng 40,74", wb.worksheets.length === 3 && kl.join(",") === "3.13,9.11,28.5" && Math.abs(ws.getCell(hr + 4, 5).value - 40.74) < 1e-9, JSON.stringify({ s: wb.worksheets.map((x) => x.name), kl, tong: ws.getCell(hr + 4, 5).value }));
      }
      // Suất cơm: ma trận 30 ngày, khổ A3, tổng suất = dữ liệu nhập
      await w.click("#nav button[data-k=rp_com]"); bf = fs.readdirSync(DL); await w.click('#main button:has-text("Xuất Excel")');
      const fCm = await waitFile(/^TongHopSuatCom_2026-09\.xlsx$/, bf);
      if (!fCm) ok("V10.1: Excel Tổng hợp suất cơm", false, "không thấy file");
      else {
        const wb = new EX2.Workbook(); await wb.xlsx.load(fs.readFileSync(path.join(DL, fCm))); const ws = wb.worksheets[0]; let hr = 0; ws.eachRow((r, i) => { if (!hr && r.getCell(1).value === "STT") hr = i; });
        ok("V10.1: Excel Tổng hợp suất cơm — ma trận 30 ngày (36 cột), A3 ngang, lặp cột nhận diện, ngày 15 = 1 suất, Tổng suất = 1", ws.getCell(hr, 5).value === "01" && ws.getCell(hr, 34).value === "30" && ws.getCell(hr + 1, 5 + 14).value === 1 && ws.getCell(hr + 1, 35).value === 1 && ws.pageSetup.paperSize === 8 && ws.pageSetup.printTitlesColumn === "A:C",
          JSON.stringify({ d1: ws.getCell(hr, 5).value, d30: ws.getCell(hr, 34).value, d15: ws.getCell(hr + 1, 19).value, tong: ws.getCell(hr + 1, 35).value, paper: ws.pageSetup.paperSize, tc: ws.pageSetup.printTitlesColumn }));
      }
      // PDF thật cho suất cơm (bảng rộng tách phần)
      bf = fs.readdirSync(DL); await w.click('#main button:has-text("Xuất PDF")');
      const pCm = await waitFile(/^TongHopSuatCom_2026-09\.pdf$/, bf);
      const pbuf = pCm ? fs.readFileSync(path.join(DL, pCm)) : Buffer.alloc(0);
      ok("V10.1: PDF Tổng hợp suất cơm là PDF thật, ≥1 trang", pbuf.slice(0, 5).toString() === "%PDF-" && /\/Type\s*\/Page(?![s\w])/.test(pbuf.toString("latin1")) && pbuf.length > 1500, pCm + " " + pbuf.length + "B");
      // Báo cáo nhân sự có sẵn: Excel/PDF theo mẫu chung (tiêu đề IN HOA, chữ ký)
      await w.click("#nav button[data-k=baocao]"); await w.click('#main button:has-text("Tình hình nhân sự")'); bf = fs.readdirSync(DL); await w.click('#main button:has-text("Xuất Excel")');
      const fHr = await waitFile(/^BaoCaoNhanSu_.*\.xlsx$/, bf);
      if (!fHr) ok("V10.1: Excel báo cáo nhân sự theo mẫu chung", false, "không thấy file");
      else { const wb = new EX2.Workbook(); await wb.xlsx.load(fs.readFileSync(path.join(DL, fHr))); const a2 = String(wb.worksheets[0].getCell("A2").value); const v = []; wb.worksheets[0].eachRow((r) => r.eachCell((c) => v.push(String(c.value))));
        ok("V10.1: báo cáo nhân sự có sẵn xuất Excel theo mẫu chung (tiêu đề IN HOA, có chữ ký Giám đốc)", a2 === a2.toLocaleUpperCase("vi-VN") && /TÌNH HÌNH NHÂN SỰ/.test(a2) && v.includes("Giám đốc"), a2); }
      // Vai trò Trưởng bộ phận không thấy báo cáo thưởng / tạm ứng (cần payroll.view) — kiểm ở mức menu của vai trò hiện tại (admin thấy đủ)
      ok("V10.1: admin thấy đủ 6 mục 'Báo cáo theo loại' trong menu", (await w.locator("#nav button[data-k^=rp_]").evaluateAll((els) => els.map((e) => e.getAttribute("data-k")))).filter((k) => ["rp_ns", "rp_sl", "rp_bd", "rp_th", "rp_tu", "rp_com"].includes(k)).length === 6, info.join(" "));
    ok("Không lỗi JavaScript ở 6 mẫu báo cáo riêng", errs.length === 0, errs.join(" | "));
    await w.waitForTimeout(500); await app.close();
  }

  // V10.1: tạo nhân viên → ĐÓNG – MỞ LẠI ứng dụng (thoát bình thường, bị tắt đột ngột, và khi bị từ chối) — dữ liệu phải còn nguyên, không nửa chừng
  {
    const SD = fs.mkdtempSync(path.join(os.tmpdir(), "hak-e2e-restart-"));
    ({ app, w, errs } = await launch(SD));
    await w.click("#nav button[data-k=backup]"); await w.click('button:has-text("Nạp danh mục chuẩn HAK")'); await w.waitForTimeout(300);
    const addNV = async (ten, cccd, stk) => {
      await w.click("#nav button[data-k=nhansu]"); await w.click('button:has-text("Thêm nhân viên")'); await w.waitForSelector(".dlg");
      const F = (l) => w.locator(".dlg .fld", { hasText: l }).first();
      await F("Họ và tên").locator("input").fill(ten); await F("Ngày vào làm").locator("input").fill("2026-01-05");
      await F("Phòng ban").locator("select").selectOption("01.01"); await F("Mã lương").locator("label.chip", { hasText: "TG1" }).click();
      await F("Lương thỏa thuận").locator("input").fill("9.000.000"); await F("Lương cơ bản").locator("input").fill("5.000.000");
      await F("Thuế TNCN").locator("select").selectOption("MT00"); await F("Hình thức trả lương").locator("select").selectOption("Chuyển khoản");
      await F("Số CCCD").locator("input").fill(cccd); await F("Số tài khoản").locator("input").fill(stk); await F("Tên ngân hàng").locator("input").fill("Vietcombank");
      await w.click('button:has-text("Lưu nhân viên")'); await w.waitForTimeout(800);
    };
    const T6 = ["nhanvien", "canhan", "hopdong", "chitiethd", "thanhtoan", "hocvan"];
    const read = () => JSON.parse(fs.readFileSync(path.join(SD, "data.json"), "utf8"));
    const full = (d, ma) => T6.filter((k) => k !== "hocvan").every((k) => (d[k] || []).some((r) => r["Mã NV"] === ma));
    // 1) thoát bình thường rồi mở lại
    await addNV("Khởi Động Một", "079123456789", "0011223344");
    await w.waitForTimeout(500); await app.close();
    const d1 = read();
    ({ app, w, errs } = await launch(SD));
    const noRecovery = (await w.locator("[data-recovery]").count()) === 0;
    await w.click("#nav button[data-k=nhansu]"); await w.waitForTimeout(300);
    const lst = await w.locator("#main").innerText();
    ok("V10.1: tạo nhân viên → đóng – mở lại app: nhân viên còn trong danh sách, đủ 5 bảng hồ sơ (nhân viên, cá nhân, hợp đồng, phụ lục, thanh toán), không vào màn hình khôi phục",
      noRecovery && /Khởi Động Một/.test(lst) && full(d1, "NV001") && d1.canhan.find((r) => r["Mã NV"] === "NV001")["Số CCCD"] === "079123456789" && d1.thanhtoan.find((r) => r["Mã NV"] === "NV001")["Số tài khoản"] === "0011223344" && d1.chitiethd.find((r) => r["Mã NV"] === "NV001")["Lương thỏa thuận"] === "9000000",
      JSON.stringify({ noRecovery, list: /Khởi Động Một/.test(lst), full: full(d1, "NV001") }));
    // 2) sau khi mở lại, tạo tiếp: mã tăng đúng, không trùng
    await addNV("Khởi Động Hai", "079987654321", "0099887766");
    // 3) bị tắt ĐỘT NGỘT ngay sau khi lưu xong (mô phỏng mất điện / treo máy)
    app.process().kill("SIGKILL"); await new Promise((r) => setTimeout(r, 800));
    const d2 = read();
    ok("V10.1: tắt đột ngột (SIGKILL) ngay sau khi lưu: file dữ liệu vẫn đọc được, NV002 có đủ bảng, NV001 không mất, không sót file tạm", full(d2, "NV002") && full(d2, "NV001") && d2.nhanvien.length === 2 && !fs.readdirSync(SD).some((f) => /\.tmp$|\.partial$/i.test(f)), JSON.stringify({ nv: d2.nhanvien.map((x) => x["Mã NV"]), files: fs.readdirSync(SD).join(",") }));
    ({ app, w, errs } = await launch(SD));
    ok("V10.1: mở lại sau khi bị tắt đột ngột: vào thẳng ứng dụng (không khôi phục), thấy cả 2 nhân viên", (await w.locator("[data-recovery]").count()) === 0 && await (async () => { await w.click("#nav button[data-k=nhansu]"); await w.waitForTimeout(300); const x = await w.locator("#main").innerText(); return /Khởi Động Một/.test(x) && /Khởi Động Hai/.test(x); })());
    // 4) tạo bị TỪ CHỐI (CCCD sai) rồi tắt đột ngột: không có dòng nào của NV003
    dialogs = [];
    await addNV("Bị Từ Chối", "123", "0000111122"); await w.waitForTimeout(300);
    const dRej = dialogs.some((d) => /12 chữ số/.test(d));
    app.process().kill("SIGKILL"); await new Promise((r) => setTimeout(r, 800));
    const d3 = read();
    ok("V10.1: tạo bị từ chối rồi tắt đột ngột: không ghi nửa chừng bảng nào cho người bị từ chối", dRej && !JSON.stringify(d3).includes("Bị Từ Chối") && d3.nhanvien.length === 2, JSON.stringify({ dRej, n: d3.nhanvien.length }));
    ({ app, w, errs } = await launch(SD));
    ok("V10.1: mở lại lần cuối vẫn bình thường, nhật ký ghi 2 lần tạo nhân viên", (await w.locator("[data-recovery]").count()) === 0 && (read().auditlog || []).filter((a) => /nhân viên/i.test(a.thaoTac || "") && /(Thêm|Tạo)/i.test(a.thaoTac || "")).length >= 2, (read().auditlog || []).map((a) => a.thaoTac).slice(-6).join(" | "));
    await app.close();
  }

  // V10: bộ lọc theo kỳ lương cho Thưởng / Tạm ứng / Suất cơm và Sản lượng (kỳ điều khiển từ–đến, không lọc tháng trùng)
  {
    const SD = fs.mkdtempSync(path.join(os.tmpdir(), "hak-e2e-flt-"));
    ({ app, w, errs } = await launch(SD)); await app.close();
    const fb = path.join(SD, "data.json"), db2 = JSON.parse(fs.readFileSync(fb, "utf8"));
    db2.nhanvien.push({ _id: "f1", "Mã NV": "F1", "Họ và tên": "Trần Thị Bình", "Trạng thái": "Đang làm việc" }, { _id: "f2", "Mã NV": "F2", "Họ và tên": "Lê Văn Cường", "Trạng thái": "Đang làm việc" });
    db2.psluong.push({ "Ngày hạch toán": "2026-10-05", "Số chứng từ": "T1", "Mã NV": "F1", "Diễn giải": "thưởng A", "Thưởng": "1000000" }, { "Ngày hạch toán": "2026-10-20", "Số chứng từ": "T2", "Mã NV": "F2", "Diễn giải": "thưởng B", "Thưởng": "500000" }, { "Ngày hạch toán": "2026-09-10", "Số chứng từ": "T3", "Mã NV": "F1", "Diễn giải": "thưởng C", "Thưởng": "200000" });
    db2.tiencom.push({ "Ngày": "2026-10-03", "Mã NV": "F1", "Số suất cơm": "20" }, { "Ngày": "2026-10-04", "Mã NV": "F2", "Số suất cơm": "10" });
    fs.writeFileSync(fb, JSON.stringify(db2));
    ({ app, w, errs } = await launch(SD));
    await w.click("#nav button[data-k=psluong]"); await w.selectOption("#top select", "10"); await w.fill("#top input[type=number]", "2026"); await w.dispatchEvent("#top input[type=number]", "change"); await w.waitForTimeout(300);
    const tot1 = await w.locator('[data-in-totals="psluong"]').innerText();
    ok("V10: Thưởng/Trừ — bộ lọc có Phòng ban, Nhân viên, Kỳ lương, Từ–Đến; tổng theo kỳ đang chọn = 1.500.000 (2 dòng, bỏ tháng 9)", (await w.locator('[data-in-filter="psluong"] input.dateinp').count()) === 2 && /2 dòng/.test(tot1) && /1\.500\.000/.test(tot1), tot1);
    await w.fill('input[placeholder*="Tìm"]', "tran thi binh"); await w.waitForTimeout(300);
    ok("V10: Thưởng/Trừ — tìm tên không dấu 'tran thi binh' chỉ còn phiếu của F1", (await w.locator("main tbody tr").count()) === 1);
    await w.fill('input[placeholder*="Tìm"]', "");
    await w.selectOption('[data-in-filter="psluong"] select[aria-label="Kỳ lương"]', "2026-09"); await w.waitForTimeout(300);
    const dtu = await w.locator('[data-in-filter="psluong"] input.dateinp').first().inputValue(), tot2 = await w.locator('[data-in-totals="psluong"]').innerText();
    ok("V10: chọn Kỳ lương 09/2026 tự điền Từ ngày–Đến ngày (hiển thị 01/09/2026) và tổng = 200.000", dtu === "01/09/2026" && /200\.000/.test(tot2) && /1 dòng/.test(tot2), dtu + " · " + tot2);
    await w.click("#nav button[data-k=tiencom]"); await w.waitForTimeout(300);
    const tc = await w.locator('[data-in-totals="tiencom"]').innerText();
    ok("V10: Suất cơm — cùng bộ lọc, tổng suất cơm kỳ 10/2026 = 30", /30/.test(tc), tc);
    await w.click("#nav button[data-k=sanluong]"); await w.waitForTimeout(300);
    ok("V10: Sản lượng — không còn ô lọc 'Tháng' trùng với Kỳ lương", (await w.locator('[data-pc-filter="sanluong"] input[type=month]').count()) === 0 && (await w.locator('[data-pc-filter="sanluong"] select[aria-label="Kỳ lương"]').count()) === 1);
    await w.click("#nav button[data-k=psluong]"); await w.waitForTimeout(200);
    const dIn = w.locator('[data-in-filter="psluong"] input.dateinp').first();
    await dIn.fill("31/04/2026"); await dIn.dispatchEvent("change"); await w.waitForTimeout(200);
    const badCls = await dIn.evaluate((e) => e.classList.contains("invalid"));
    await dIn.fill("29022028"); await dIn.dispatchEvent("change"); await w.waitForTimeout(400);
    const okVal = await w.locator('[data-in-filter="psluong"] input.dateinp').first().inputValue();
    ok("V10: ô ngày gõ tay — 31/04/2026 bị báo sai (viền đỏ), '29022028' tự chuẩn hóa thành 29/02/2028 (năm nhuận)", badCls && okVal === "29/02/2028", badCls + " · " + okVal);
    ok("Không lỗi JavaScript ở bộ lọc theo kỳ", errs.length === 0, errs.join(" | "));
    await app.close();
  }

  // Mục VIII: CompanyID → PolicyVersion → PayrollMethod — không dùng lựa chọn tự do trên Tính lương
  // để quyết định bù sản lượng CHÍNH THỨC; thiếu Quy chế bù sản lượng hợp lệ (Trạng thái = Hiệu lực)
  // → KHÔNG chốt được kỳ có sản lượng cần bù; có quy chế khác lựa chọn đang xem → tự chuyển đúng rồi chốt.
  {
    const SD = fs.mkdtempSync(path.join(os.tmpdir(), "hak-e2e-bu-"));
    ({ app, w, errs } = await launch(SD));
    await w.click("#nav button[data-k=backup]"); await w.click('button:has-text("Nạp danh mục chuẩn HAK")'); await w.waitForTimeout(200);
    await app.close();
    const fb = path.join(SD, "data.json"), db2 = JSON.parse(fs.readFileSync(fb, "utf8"));
    db2.nhanvien.push({ _id: "bu1", "Mã NV": "BU1", "Họ và tên": "E2E Bù SL", "Trạng thái": "Đang làm việc" });
    db2.hopdong.push({ _id: "bu1hd", "Mã NV": "BU1", "Số HĐLĐ": "BU1/HĐ", "Hình thức HĐLĐ": "Xác định thời hạn", "Ngày vào làm": "2026-01-01" });
    db2.chitiethd.push({ _id: "bu1pl", "Mã NV": "BU1", "Số HĐLĐ": "BU1/HĐ", "Hiệu lực từ": "2026-01-01", "Phòng ban": "02.01", "Mã hình thức lương": "LSP", "Mã lương": "SP", "Lương thỏa thuận": "0", "HTTT": "Tiền mặt", "Thuế TNCN": "MT00" });
    db2.chamcong.push({ "Kỳ": "2026-11", "Mã NV": "BU1", "Hình thức công": "BT", "01": "1" });
    db2.sanluong.push({ "Phiếu cân": "EBU1", "Ngày cân": "2026-11-01", "Mã NV": "BU1", "KL hàng (Tấn)": 1 });
    // Xóa bản "to"/Hiệu lực đã nạp sẵn (HAK) → mô phỏng công ty CHƯA khai báo phương pháp bù sản lượng
    db2.dm_quychebu = [];
    fs.writeFileSync(fb, JSON.stringify(db2));
    ({ app, w, errs } = await launch(SD));
    await w.click("#nav button[data-k=caidat]"); await w.click('#main button:has-text("Phương pháp bù sản lượng")');
    ok("Danh mục KHÔNG còn mục Quy chế bù sản lượng / Công thức tiền lương (đã chuyển sang Cài đặt); Cài đặt chỉ có đúng 2 phương pháp bù", (await w.locator('#main button:has-text("Xem cách tính")').count()) === 2);
    await w.click("#nav button[data-k=luong]");
    await w.selectOption("#top select", "11"); await w.fill("#top input[type=number]", "2026"); await w.dispatchEvent("#top input[type=number]", "change"); await w.waitForTimeout(200);
    const warnNoPolicy = await w.locator("main").first().innerText();
    ok("Tính lương: chưa có Quy chế bù sản lượng CHÍNH THỨC → cảnh báo ngay trên màn hình (lựa chọn hiện tại chỉ để xem thử)", /Chưa có Phương pháp bù sản lượng CHÍNH THỨC/.test(warnNoPolicy));
    await w.click("button.big"); await w.waitForTimeout(200);
    dialogs = []; await w.click('button:has-text("Chốt kỳ lương")'); await w.waitForTimeout(200);
    ok("Chốt kỳ có sản lượng cần bù mà CHƯA có Quy chế bù sản lượng hợp lệ → chặn cứng (mục VIII), không chốt được", dialogs.some((d) => /KHÔNG THỂ CHỐT/.test(d) && /Phương pháp bù sản lượng/.test(d)) && !(await w.locator(".locked").count()), dialogs.join(" | "));
    // Chọn phương pháp CHÍNH THỨC = "daihiep" (BÙ SẢN LƯỢNG THEO NGÀY), khác lựa chọn đang xem ("to" — mặc định màn hình Tính lương)
    await w.click("#nav button[data-k=caidat]"); await w.click('#main button:has-text("Phương pháp bù sản lượng")');
    await w.locator('.bu-method', { hasText: "BÙ SẢN LƯỢNG THEO NGÀY" }).locator('button:has-text("Áp dụng từ kỳ")').click();
    await w.waitForSelector(".dlg"); await w.locator(".dlg textarea, .dlg input").first().fill("E2E V10"); await w.click(".dlg footer button.pri"); await w.waitForTimeout(300);
    await w.click("#nav button[data-k=luong]");
    await w.selectOption("#top select", "11"); await w.fill("#top input[type=number]", "2026"); await w.dispatchEvent("#top input[type=number]", "change"); await w.waitForTimeout(200);
    await w.selectOption('select[aria-label="Cách bù lương sản lượng"]', "to");
    const warnMoPhong = await w.locator("main").first().innerText();
    ok("Tính lương: có phương pháp chính thức ('daihiep') khác lựa chọn đang xem ('to') → báo rõ đang XEM THỬ, không phải chính thức", /Phương pháp bù sản lượng CHÍNH THỨC kỳ 11\/2026: BÙ SẢN LƯỢNG THEO NGÀY/.test(warnMoPhong) && /đang XEM THỬ phương pháp khác/.test(warnMoPhong), warnMoPhong.replace(/\s+/g, " ").slice(0, 300));
    await w.click("button.big"); await w.waitForTimeout(200);
    await w.click('button:has-text("Chốt kỳ lương")'); await w.waitForSelector(".dlg");
    ok("Có Quy chế hợp lệ nhưng khác lựa chọn xem thử → app TỰ chuyển đúng phương pháp đã duyệt rồi mới chốt (không chốt theo lựa chọn tự do)", /Chốt Tháng 11\/2026|Chốt kỳ/.test(await w.locator(".dlg header h3").innerText()));
    await w.locator(".dlg input").fill("Chốt E2E mục VIII"); await w.click(".dlg footer button.pri"); await w.waitForSelector(".locked");
    ok("Chốt thành công sau khi có Quy chế bù sản lượng CHÍNH THỨC hợp lệ", (await w.locator(".locked").first().innerText()).indexOf("đã chốt") >= 0);
    ok("Không lỗi JavaScript ở Quy chế bù sản lượng (mục VIII)", errs.length === 0, errs.join(" | "));
    await app.close();
  }

  // α21: Quy chế tính lương — chọn ở Tính lương, lưu theo dữ liệu (hồ sơ công ty), ghi nhật ký; đổi lại cách cũ được để đối chiếu
  {
    ({ app, w, errs } = await launch());
    await w.click("#nav button[data-k=luong]");
    const q0 = await w.locator('select[aria-label="Quy chế tính lương"]').inputValue();
    // Chờ tới khi data.json đã ghi xong (máy CI chậm: chờ cố định 400 ms có lúc chưa kịp ghi lần 2)
    const qcOf = (d) => (((d && d.congty) || [])[0] || {})["Quy chế tính lương"];
    const qcLogs = (d) => ((d && d.auditlog) || []).filter((a) => a.thaoTac === "Đổi quy chế tính lương").length;
    const waitData = async (pred) => { let d = null; for (let i = 0; i < 50; i++) { await w.waitForTimeout(100); try { d = JSON.parse(fs.readFileSync(path.join(DATA, "data.json"), "utf8")); } catch (e) { continue; } if (pred(d)) break; } return d; };
    await w.selectOption('select[aria-label="Quy chế tính lương"]', "1.7");
    const d1 = await waitData((d) => qcOf(d) === "1.7" && qcLogs(d) >= 1);
    await w.selectOption('select[aria-label="Quy chế tính lương"]', "2026");
    const d2 = await waitData((d) => qcOf(d) === "2026" && qcLogs(d) >= 2);
    const logs = qcLogs(d2);
    ok("Quy chế tính lương: mặc định 2026; đổi sang cách cũ / quay lại được, lưu vào dữ liệu, ghi nhật ký", q0 === "2026" && qcOf(d1) === "1.7" && qcOf(d2) === "2026" && logs >= 2, q0 + " · " + qcOf(d1) + "→" + qcOf(d2) + " · " + logs + " dòng nhật ký");
    ok("Không lỗi JavaScript ở chọn quy chế", errs.length === 0, errs.join(" | "));
    await app.close();
  }

  // α20: Đọc ảnh / PDF chấm công bằng OCR (offline) — ảnh mẫu GIẢ LẬP tests/fixtures/ocr; chỉ ghi qua màn hình xem trước
  {
    const f = path.join(DATA, "data.json"), d0 = JSON.parse(fs.readFileSync(f, "utf8")), FX = path.join(APP, "tests/fixtures/ocr");
    d0.nhanvien.push({ _id: "ocn1", "Mã NV": "OC1", "Họ và tên": "Phạm Minh Khoa", "Trạng thái": "Đang làm việc" });
    fs.writeFileSync(f, JSON.stringify(d0));
    ({ app, w, errs } = await launch());
    await w.click("#nav button[data-k=ocr]");
    const [fc] = await Promise.all([w.waitForEvent("filechooser"), w.locator('#main button:has-text("Chọn ảnh / PDF")').click()]);
    await fc.setFiles([path.join(FX, "bang-cham-cong-mau.png"), path.join(FX, "bang-cham-cong-mau.pdf")]);
    let done = false;
    for (let i = 0; i < 300 && !done; i++) { await w.waitForTimeout(500); done = await w.evaluate(() => { const n = [...document.querySelectorAll(".subtabs button .n")].map((e) => e.textContent); return n.length === 2 && n.every((x) => /^\d+$/.test(x)); }); }
    const grid = () => w.evaluate(() => [...document.querySelectorAll(".ocrgrid tbody tr")].map((tr) => ({ nv: tr.querySelector("select").value, cls: tr.className, d27: tr.querySelector("input[data-day='27']").value, d3: tr.querySelector("input[data-day='3']").value, sum: tr.children[tr.children.length - 2].textContent, tot: tr.children[tr.children.length - 1].textContent })));
    const g1 = done ? await grid() : [];
    ok("OCR ảnh PNG: 3 dòng, tự ghép NV theo tên (NV001, OC1), người chưa có trong app để trống; đọc đúng 0,5 và cột Tổng công",
      g1.length === 3 && g1[0].nv === "NV001" && g1[1].nv === "OC1" && g1[2].nv === "" && /nomatch/.test(g1[2].cls) && g1[0].d27 === "0,5" && g1[0].sum === "28,5" && g1[0].tot === "28,5" && !g1.some((r) => /mismatch/.test(r.cls)), JSON.stringify(g1));
    // sửa tay 1 ô → tổng tính đổi, lệch tổng giấy → tô đỏ; sửa lại đúng thì hết đỏ
    const c3 = w.locator(".ocrgrid tbody tr").nth(1).locator("input[data-day='3']");
    await c3.fill("1"); await c3.dispatchEvent("change");
    const mm = await w.locator(".ocrgrid tbody tr").nth(1).getAttribute("class");
    await c3.fill(""); await c3.dispatchEvent("change");
    const mm2 = await w.locator(".ocrgrid tbody tr").nth(1).getAttribute("class");
    ok("Sửa ô trên lưới: lệch Tổng công trên giấy thì dòng tô đỏ, sửa lại thì hết", /mismatch/.test(mm) && !/mismatch/.test(mm2), mm + " → " + mm2);
    // V7: sửa ô 0,5 → 1 → 0,5 (ô có nét viết thật): tự ghi mẫu, giữ lịch sử, chỉ nhãn cuối còn hiệu lực
    const c27 = w.locator(".ocrgrid tbody tr").nth(0).locator("input[data-day='27']");
    await c27.fill("1"); await c27.dispatchEvent("change"); await c27.fill("0,5"); await c27.dispatchEvent("change"); await w.waitForTimeout(500);
    const lib1 = await w.evaluate(() => window.hakOcrLib.list({}).then((r) => ({ ok: r.ok, s: r.samples.map((x) => [x.label, x.status, x.source]), n: r.stats.edits })));
    ok("Tự học từ sửa ô: 0,5→1→0,5 tạo 2 mẫu (1 bị thay thế, 0,5 chờ duyệt), ghi đủ 2+ sự kiện sửa, không cần bấm lưu mẫu",
      lib1.ok && lib1.s.length === 2 && lib1.s.filter((x) => x[1] === "SUPERSEDED").length === 1 && lib1.s.some((x) => x[0] === "0.5" && x[1] === "PENDING_APPROVAL" && x[2] === "CORRECTED") && lib1.n >= 4, JSON.stringify(lib1));
    { // V9.4: người dùng THẤY mẫu đã ghi (màu ô + thanh trạng thái + nút mở thư viện); dán nhiều ô cũng đi qua đường ghi mẫu
      const learnAttr = await c27.getAttribute("data-learn"), barTxt = await w.locator("[data-ocr-learn-status]").innerText().catch(() => ""), hasBtn = await w.locator('[data-ocr-learn-status] button:has-text("Mở thư viện mẫu")').count();
      ok("OCR V9.4: ô vừa sửa hiện trạng thái 'đã ghi mẫu (chờ xác minh)', thanh trạng thái có số mẫu và nút mở thư viện", learnAttr === "saved" && /đã ghi/.test(barTxt) && /chờ xác minh/.test(barTxt) && hasBtn === 1, learnAttr + " | " + barTxt.replace(/\s+/g, " "));
      const orig4 = await w.evaluate(() => [[1, 1], [1, 2], [2, 1], [2, 2]].map(([r, d]) => document.querySelector(".ocrgrid tbody tr:nth-child(" + r + ") input[data-day='" + d + "']").value));
      const before2 = await w.evaluate(() => window.hakOcrLib.list({}).then((r) => r.stats.edits));
      await w.evaluate(() => { const i = document.querySelector(".ocrgrid tbody tr:nth-child(1) input[data-day='1']"); const dt = new DataTransfer(); dt.setData("text", "1\t0,5\n0,5\t1"); i.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); });
      await w.waitForTimeout(600);
      const after2 = await w.evaluate(() => window.hakOcrLib.list({}).then((r) => r.stats.edits)), pv2 = await w.evaluate(() => [1, 2].map((d) => document.querySelector(".ocrgrid tbody tr:nth-child(1) input[data-day='" + d + "']").value).concat([1, 2].map((d) => document.querySelector(".ocrgrid tbody tr:nth-child(2) input[data-day='" + d + "']").value)));
      await w.evaluate((o) => { [[1, 1], [1, 2], [2, 1], [2, 2]].forEach(([r, d], i) => { const x = document.querySelector(".ocrgrid tbody tr:nth-child(" + r + ") input[data-day='" + d + "']"); x.value = o[i]; x.dispatchEvent(new window.Event("change")); }); }, orig4); // trả lại ô như cũ để các bước sau không bị ảnh hưởng
      await w.waitForTimeout(300);
      ok("OCR V9.4: dán 2×2 ô từ Excel cập nhật đúng 4 ô và mỗi ô đổi giá trị đều ghi sự kiện sửa", pv2.join("|") === "1|0,5|0,5|1" && after2 > before2, JSON.stringify({ before2, after2, pv2 }));
    }
    await w.fill('input[aria-label="Kỳ của trang"]', "2026-11"); await w.dispatchEvent('input[aria-label="Kỳ của trang"]', "change");
    await w.locator(".subtabs button").nth(1).click(); await w.waitForTimeout(200);
    const g2 = await grid();
    ok("OCR file PDF (pdf.js nạp offline, CSP không eval): đọc ra cùng bảng", g2.length === 3 && g2[0].nv === "NV001" && g2[0].sum === "28,5", JSON.stringify(g2.map((r) => r.sum)));
    await w.fill('input[aria-label="Kỳ của trang"]', "2026-12"); await w.dispatchEvent('input[aria-label="Kỳ của trang"]', "change");
    const before = JSON.parse(fs.readFileSync(f, "utf8")).chamcong.length;
    dialogs = [];
    await w.click('#main button:has-text("Đưa vào Chấm công")'); await w.waitForSelector(".dlg footer button.pri");
    const pv = await w.locator(".dlg").innerText();
    await w.click(".dlg footer button.pri"); await w.waitForTimeout(900);
    const lib2 = await w.evaluate(() => window.hakOcrLib.list({}).then((r) => r.samples.map((x) => [x.label, x.status])));
    ok("Duyệt bảng (ghi vào Chấm công) → mẫu 0,5 thành VERIFIED, mẫu cũ vẫn là lịch sử (SUPERSEDED)", lib2.some((x) => x[0] === "0.5" && x[1] === "VERIFIED") && lib2.some((x) => x[1] === "SUPERSEDED"), JSON.stringify(lib2));
    const cc = JSON.parse(fs.readFileSync(f, "utf8")).chamcong, n11 = cc.filter((r) => r["Kỳ"] === "2026-11"), n12 = cc.filter((r) => r["Kỳ"] === "2026-12");
    const a11 = n11.find((r) => r["Mã NV"] === "NV001") || {}, k11 = n11.find((r) => r["Mã NV"] === "OC1") || {};
    ok("Ghi vào Chấm công qua màn hình xem trước: mỗi trang đúng kỳ đã chọn, người chưa chọn NV bị bỏ qua (có báo)",
      cc.length === before + 4 && n11.length === 2 && n12.length === 2 && a11["Hình thức công"] === "BT" && a11["27"] === "0,5" && a11["30"] === undefined && k11["03"] === undefined && k11["01"] === "1" && dialogs.some((m) => /chưa chọn nhân viên/.test(m)) && /Xem trước|xem trước|thêm/i.test(pv),
      JSON.stringify({ n11: n11.length, n12: n12.length, a27: a11["27"], dlg: dialogs.length }));
    await w.click('#main button:has-text("Xuất Excel")');
    let xf = null; for (let i = 0; i < 30 && !xf; i++) { await w.waitForTimeout(200); xf = fs.readdirSync(DL).filter((x) => /^OCR_ChamCong_.*\.xlsx$/.test(x))[0]; }
    let xs = "";
    if (xf) { await w.waitForTimeout(300); const XLSX = require(path.join(APP, "xlsx.full.min.js")), wb = XLSX.read(fs.readFileSync(path.join(DL, xf)), { type: "buffer" }); const r0 = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])[0] || {}; xs = wb.SheetNames.length + "|" + r0["Mã NV"] + "|" + r0["27"] + "|" + r0["Tổng tính"]; }
    ok("Xuất Excel kết quả OCR: mỗi trang 1 sheet, có Mã NV, ngày, tổng", xs === "2|NV001|0.5|28.5", xs);
    dialogs = []; await w.click('#main button:has-text("Kiểm tra OCR")');
    for (let i = 0; i < 40 && !dialogs.length; i++) await w.waitForTimeout(250);
    ok("Kiểm tra OCR trên máy: đọc thử được số", dialogs.some((m) => /OCR hoạt động/.test(m)), dialogs.join(" | "));
    // Dừng đọc: chọn thêm 3 trang, bấm Dừng khi trang đầu đang đọc → trang sau không đọc (■), trang đã đọc giữ nguyên; Đọc lại từng trang được
    {
      const [fc2] = await Promise.all([w.waitForEvent("filechooser"), w.locator('#main button:has-text("Chọn ảnh / PDF")').click()]);
      await fc2.setFiles([path.join(FX, "lich-lam-doc-mau.png"), path.join(FX, "bang-cham-cong-mau.png"), path.join(FX, "bang-cham-cong-mau-pdfjs.png")]);
      await w.waitForSelector('#main button:has-text("Dừng đọc")', { timeout: 20000 });
      await w.click('#main button:has-text("Dừng đọc")');
      let ended = false;
      for (let i = 0; i < 120 && !ended; i++) { await w.waitForTimeout(500); ended = (await w.locator('#main button:has-text("Dừng đọc"), #main button:has-text("Đang dừng")').count()) === 0; }
      const marks = await w.evaluate(() => [...document.querySelectorAll(".subtabs button .n")].map((e) => e.textContent));
      const kept = marks.slice(0, 2).every((x) => /^\d+$/.test(x)), stopped = marks.slice(2).filter((x) => x === "■").length;
      ok("Dừng đọc: dừng ngay, các trang chưa đọc đánh dấu ■, trang đã đọc trước đó giữ nguyên", ended && marks.length === 5 && kept && stopped >= 2 && !marks.includes("…"), JSON.stringify(marks));
      await w.locator(".subtabs button").nth(4).click(); await w.waitForTimeout(200);
      await w.click('#main .ocrpage button:has-text("Đọc lại")');
      let n4 = ""; for (let i = 0; i < 120 && !/^\d+$/.test(n4); i++) { await w.waitForTimeout(500); n4 = await w.locator(".subtabs button .n").nth(4).innerText(); }
      const s4 = n4 === "3" ? await w.evaluate(() => [...document.querySelectorAll(".ocrgrid tbody tr")].map((tr) => tr.children[tr.children.length - 2].textContent)) : [];
      ok("Trang đã dừng: bấm Đọc lại thì đọc được (3 dòng, đúng tổng)", n4 === "3" && s4.join("|") === "28,5|20|15", n4 + " " + s4.join("|"));
    }
    // α22: Cách đọc ô "Dấu x (x = 1 công) · giờ / 8" — bảng tay của tổ, 2 khối ngày, mỗi người 1 cột
    {
      await w.selectOption('select[aria-label="Cách đọc ô cho file mới"]', "mark");
      const [fc3] = await Promise.all([w.waitForEvent("filechooser"), w.locator('#main button:has-text("Chọn ảnh / PDF")').click()]);
      await fc3.setFiles([path.join(FX, "cham-cong-tay-x-mau.png")]);
      let n6 = ""; for (let i = 0; i < 240 && !/^\d+$/.test(n6); i++) { await w.waitForTimeout(500); n6 = await w.locator(".subtabs button .n").nth(5).innerText().catch(() => ""); }
      await w.locator(".subtabs button").nth(5).click(); await w.waitForTimeout(200);
      const pm = await w.locator('select[aria-label="Cách đọc ô của trang"]').inputValue();
      const g6 = await w.evaluate(() => [...document.querySelectorAll(".ocrgrid tbody tr")].map((tr) => [tr.querySelector("input.i").value, tr.querySelectorAll("select")[1].value, tr.querySelector("input[data-day='9']").value, tr.children[tr.children.length - 2].textContent]));
      ok("Cách đọc ô Dấu x: bảng tay 2 khối, mỗi người 1 cột → tên lấy từ tiêu đề cột, loại Công; xx = 2, ô '7h-15h' = 1; tổng 47 / 35 / 29", pm === "mark" && g6.map((r) => r.join(":")).join("|") === "Lê Văn An:Công:1:47|Trần Bình:Công:1:35|Ngô Cường:Công:2:29", pm + " " + JSON.stringify(g6));
    }
    // V7: PDF có lớp chữ → lấy chữ trực tiếp (không OCR ảnh), tốc độ tức thì, số chính xác; thêm PDF scan vẫn đi đường OCR
    {
      await w.click('#main button:has-text("Xóa danh sách")');
      const [fcT] = await Promise.all([w.waitForEvent("filechooser"), w.locator('#main button:has-text("Chọn ảnh / PDF")').click()]);
      await fcT.setFiles([path.join(FX, "bang-cham-cong-lop-chu.pdf")]);
      let gt = []; for (let i = 0; i < 120 && gt.length < 3; i++) { await w.waitForTimeout(500); gt = await w.evaluate(() => [...document.querySelectorAll(".ocrgrid tbody tr")].map((tr) => [tr.querySelector("input.i").value, tr.querySelector("input[data-day='4']").value, tr.children[tr.children.length - 2].textContent])); }
      const srcK = await w.locator('[data-src-kind="pdf-text"]').count();
      ok("PDF có lớp chữ: dựng bảng thẳng từ chữ trong PDF (hiện 'Nguồn: lớp chữ của PDF'), 3 người đúng số và tổng 8,5 / 10 / 5",
        srcK === 1 && gt.map((r) => r.join(":")).join("|") === "Nguyen Van An:0,5:8,5|Pham Minh Khoa:1:10|Le Thi Bich:0,5:5", srcK + " " + JSON.stringify(gt));
    }
    // GĐ4: bản gốc được lưu vào kho chứng từ (SHA-256, sidecar), siêu dữ liệu vào db.chungtu; PDF > 30 trang đọc tiếp, không bỏ trang
    {
      const vdir = path.join(DATA, "documents"), docs = fs.existsSync(vdir) ? fs.readdirSync(vdir).flatMap((d) => fs.readdirSync(path.join(vdir, d)).map((x) => path.join(d, x))) : [];
      const vr = await w.evaluate(async () => { const l = await window.hakDocs.list(), v = await window.hakDocs.verify(); return { n: l.docs.length, st: v.items.map((i) => i.status) }; });
      ok("Kho chứng từ: file gốc (PNG, PDF…) được lưu nguyên bản kèm sidecar, trùng nội dung chỉ lưu 1 lần, kiểm tra SHA-256 đều 'ok'", vr.n >= 2 && vr.st.every((x) => x === "ok") && docs.filter((x) => /\.json$/.test(x)).length === vr.n && docs.length === 2 * vr.n, JSON.stringify({ vr, docs }));
      const nBefore = vr.n, nPages = 35, objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [" + Array.from({ length: nPages }, (_, i) => (3 + i) + " 0 R").join(" ") + "] /Count " + nPages + " >>"];
      for (let i = 0; i < nPages; i++) objs.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>");
      let pdf = "%PDF-1.4\n"; const offs = []; objs.forEach((o, i) => { offs.push(pdf.length); pdf += (i + 1) + " 0 obj\n" + o + "\nendobj\n"; });
      const xr = pdf.length; pdf += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n" + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("") + "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xr + "\n%%EOF\n";
      const big = path.join(DATA, "pdf-35-trang.pdf"); fs.writeFileSync(big, pdf);
      await w.click('#main button:has-text("Xóa danh sách")');
      const [fc2] = await Promise.all([w.waitForEvent("filechooser"), w.locator('#main button:has-text("Chọn ảnh / PDF")').click()]);
      await fc2.setFiles([big]);
      let more = 0; for (let i = 0; i < 240 && !more; i++) { await w.waitForTimeout(500); more = await w.locator('#main button:has-text("Đọc tiếp")').count(); }
      const t1 = await w.locator(".subtabs button").count();
      ok("PDF 35 trang: lượt đầu 30 trang, hiện nút 'Đọc tiếp' (không âm thầm cắt)", more === 1 && t1 === 30, "tabs=" + t1 + " more=" + more);
      await w.locator('#main button:has-text("Đọc tiếp")').click();
      let t2 = 0; for (let i = 0; i < 240 && t2 !== 35; i++) { await w.waitForTimeout(500); t2 = await w.locator(".subtabs button").count(); }
      ok("Đọc tiếp: đủ 35 trang, hết nút 'Đọc tiếp'; PDF 35 trang cũng vào kho chứng từ (thêm đúng 1 file)", t2 === 35 && (await w.evaluate(async () => (await window.hakDocs.list()).docs.length)) === nBefore + 1, "tabs=" + t2);
    }
    ok("Không lỗi JavaScript ở Đọc ảnh chấm công", errs.length === 0, errs.join(" | "));
    await app.close();
  }

  // V7 GĐ7: đổi thư mục thư viện mẫu OCR sang ổ khác — chép + kiểm SHA-256, mẫu còn nguyên, nguồn không bị xóa
  {
    const NEWD = path.join(os.tmpdir(), "e2e-ocrlib-" + Date.now());
    ({ app, w, errs } = await launch(DATA, { env: { HAK_PICK_DIR: NEWD } }));
    const n0 = await w.evaluate(async () => (await window.hakOcrLib.list({})).samples.length);
    await w.click("#nav button[data-k=backup]"); await w.waitForSelector('[data-stg="ocrLib"]');
    await w.locator('[data-stg="ocrLib"] button:has-text("Chuyển")').click(); await w.waitForSelector('[data-stg-msg]', { timeout: 30000 });
    const msg = await w.locator("[data-stg-msg]").innerText();
    const set = JSON.parse(fs.readFileSync(path.join(DATA, "settings.json"), "utf8"));
    const n1 = await w.evaluate(async () => { const r = await window.hakOcrLib.list({}); const v = await window.hakOcrLib.verify(); return { n: r.samples.length, ok: v.report.ok }; });
    ok("Đổi thư mục thư viện mẫu OCR: chép + kiểm SHA-256, cấu hình ghi lại, mẫu còn nguyên và đọc được từ vị trí mới; thư mục cũ không bị xóa",
      /Đã chuyển/.test(msg) && set.ocrLibDir === NEWD && n0 > 0 && n1.n === n0 && n1.ok && fs.existsSync(path.join(NEWD, "library.jsonl")) && fs.existsSync(path.join(DATA, "ocr_library", "library.jsonl")), msg + " | " + JSON.stringify({ n0, n1, set: set.ocrLibDir }));
    ok("Không lỗi JavaScript ở cài đặt lưu trữ", errs.length === 0, errs.join(" | "));
    await app.close();
  }

  // α17: Lịch sao lưu — Admin đổi chu kỳ / số ngày giữ / khi đóng app; lưu vào settings.json của máy; đóng app → bản "khi-dong"
  {
    ({ app, w, errs } = await launch());
    await w.click("#nav button[data-k=backup]"); await w.waitForSelector("[data-schedule] select");
    const beforeSet = fs.readdirSync(path.join(DATA, "backups")).filter((f) => /^khi-dong_.*\.json$/.test(f)), before = beforeSet.length;
    await w.locator("[data-schedule] select").first().selectOption("1"); await w.waitForTimeout(200);
    await w.locator("[data-schedule] select").nth(1).selectOption("90"); await w.waitForTimeout(200);
    const sc = JSON.parse(fs.readFileSync(path.join(DATA, "settings.json"), "utf8")).backupSchedule;
    const cardS = await w.locator("[data-schedule]").innerText();
    ok("Lịch sao lưu: chọn mỗi 1 giờ + giữ bản đầu ngày 90 ngày → lưu cấu hình máy", sc && sc.everyHours === 1 && sc.keepDaily === 90 && sc.onClose === true && /Lịch sao lưu tự động/.test(cardS), JSON.stringify(sc));
    ok("Không lỗi JavaScript ở lịch sao lưu", errs.length === 0, errs.join(" | "));
    await app.close(); // dữ liệu đã đổi (nhật ký "Đổi lịch sao lưu") → khi đóng app có bản khi-dong
    const afterSet = fs.readdirSync(path.join(DATA, "backups")).filter((f) => /^khi-dong_.*\.json$/.test(f)), after = afterSet.length, moi = afterSet.filter((x) => beforeSet.indexOf(x) < 0);
    ok("Đóng app khi dữ liệu đã đổi → tự sao lưu 'khi-dong' (kèm file kiểm tra; giữ tối đa 10 bản)", moi.length === 1 && after <= 10 && fs.existsSync(path.join(DATA, "backups", moi[0] + ".sha256")), before + " → " + after);
  }

  // GĐ5: Full Backup (dữ liệu + chứng từ + manifest SHA-256) → gói hỏng bị từ chối → khôi phục đưa chứng từ trở lại
  {
    const FB = require(path.join(APP, "main/fullbackup.js"));
    ({ app, w, errs } = await launch());
    await w.click("#nav button[data-k=backup]"); await w.waitForSelector("[data-fullbackup]");
    await w.click('[data-fullbackup] button:has-text("Tạo Full Backup")');
    await w.waitForSelector("#modal [data-pw]"); await w.click('#modal button:has-text("Tạo Full Backup")'); // V10.1: bỏ trống mật khẩu = gói không mã hóa
    await w.waitForSelector('[data-fb-msg]:has-text("ĐẦY ĐỦ")', { timeout: 30000 });
    const zips = fs.readdirSync(DL).filter((f) => /^LuongHAK_FullBackup_.*\.zip$/.test(f)), good = path.join(DL, zips[0] || "none.zip");
    const rep = zips.length ? FB.inspect(good) : { ok: false, problems: ["không có gói"], docs: [] };
    ok("Full Backup: tạo được 1 gói .zip + file .sha256, qua kiểm tra (data.json + mọi chứng từ khớp SHA-256)", zips.length === 1 && fs.existsSync(good + ".sha256") && rep.ok && rep.docs.length >= 3 && rep.docs.every((d) => d.state === "new" || d.state === "same"), JSON.stringify({ zips, ok: rep.ok, p: rep.problems, n: rep.docs.length }));
    await app.close();
    const bad = path.join(DL, "LuongHAK_FullBackup_hong.zip"), bb = fs.readFileSync(good); bb[45] ^= 0xFF; fs.writeFileSync(bad, bb);
    const nDocsBefore = rep.docs.length, vdir = path.join(DATA, "documents");
    ({ app, w, errs } = await launch(null, { env: { HAK_FB_PICK: bad } }));
    await w.click("#nav button[data-k=backup]"); await w.waitForSelector("[data-fullbackup]");
    await w.click('[data-fullbackup] button:has-text("Khôi phục từ gói")');
    await w.waitForSelector('[data-fb-msg]:has-text("KHÔNG đạt")', { timeout: 15000 });
    ok("Gói Full Backup bị sửa 1 byte: bị TỪ CHỐI trước khi ghi gì (không đổi dữ liệu, kho chứng từ nguyên vẹn)", (await w.locator("[data-fb-msg]").innerText()).includes("chưa ghi gì") && (await w.evaluate(async () => (await window.hakDocs.list()).docs.length)) === nDocsBefore);
    await app.close();
    fs.rmSync(vdir, { recursive: true, force: true }); // giả lập sang máy mới: mất kho chứng từ
    ({ app, w, errs } = await launch(null, { env: { HAK_FB_PICK: good } }));
    await w.click("#nav button[data-k=backup]"); await w.waitForSelector("[data-fullbackup]");
    await w.click('[data-fullbackup] button:has-text("Khôi phục từ gói")');
    for (let i = 0; i < 60; i++) { await w.waitForTimeout(500); if ((await w.evaluate(async () => (await window.hakDocs.list()).docs.length)) >= nDocsBefore) break; }
    await w.waitForTimeout(500);
    const after = await w.evaluate(async () => { const l = await window.hakDocs.list(), v = await window.hakDocs.verify(); return { n: l.docs.length, st: v.items.map((i) => i.status) }; });
    ok("Khôi phục Full Backup trên kho trống: chứng từ trở lại đủ, đúng DocumentID, SHA-256 đều 'ok'", after.n === nDocsBefore && after.st.every((x) => x === "ok") && rep.docs.every((d) => fs.existsSync(path.join(vdir, d.id.slice(4, 10), d.id + ".json"))), JSON.stringify(after));
    ok("Không lỗi JavaScript ở Full Backup", errs.length === 0, errs.join(" | "));
    await app.close();
  }

  // V10.1: Full Backup MÃ HÓA bằng mật khẩu (AES-256-GCM) → mật khẩu yếu bị từ chối → sai mật khẩu bị từ chối trước khi ghi gì → đúng mật khẩu khôi phục đủ chứng từ
  {
    const PW = "Mat-khau-E2E-2026", vdir = path.join(DATA, "documents");
    ({ app, w, errs } = await launch());
    const nDocs0 = await w.evaluate(async () => (await window.hakDocs.list()).docs.length);
    await w.click("#nav button[data-k=backup]"); await w.waitForSelector("[data-fullbackup]");
    await w.click('[data-fullbackup] button:has-text("Tạo Full Backup")');
    await w.waitForSelector("#modal [data-pw]");
    await w.fill("#modal [data-pw]", "abc"); await w.fill("#modal [data-pw2]", "abc"); await w.click('#modal button:has-text("Tạo Full Backup")');
    ok("Mật khẩu yếu ('abc') bị từ chối ngay, hộp nhập vẫn mở, chưa tạo gói", (await w.locator("#modal [data-pw]").count()) === 1 && fs.readdirSync(DL).filter((f) => /\.hakenc$/.test(f)).length === 0);
    await w.fill("#modal [data-pw]", PW); await w.fill("#modal [data-pw2]", PW + "x"); await w.click('#modal button:has-text("Tạo Full Backup")');
    ok("Nhập lại mật khẩu không khớp bị từ chối", (await w.locator("#modal [data-pw]").count()) === 1 && fs.readdirSync(DL).filter((f) => /\.hakenc$/.test(f)).length === 0);
    await w.fill("#modal [data-pw]", PW); await w.fill("#modal [data-pw2]", PW); await w.click('#modal button:has-text("Tạo Full Backup")');
    await w.waitForSelector('[data-fb-msg]:has-text("ĐÃ MÃ HÓA")', { timeout: 60000 });
    const encs = fs.readdirSync(DL).filter((f) => /^LuongHAK_FullBackup_.*\.zip\.hakenc$/.test(f)), enc = path.join(DL, encs[0] || "none"), plains = fs.readdirSync(DL).filter((f) => /^LuongHAK_FullBackup_\d.*\.zip$/.test(f));
    const head = encs.length ? fs.readFileSync(enc).subarray(0, 8).toString() : "";
    ok("Gói mã hóa: có file .zip.hakenc + .sha256, đầu tệp HAKENC01, bản .zip rõ của lần này đã bị xóa (chỉ còn gói không mã hóa tạo trước đó)", encs.length === 1 && head === "HAKENC01" && fs.existsSync(enc + ".sha256") && plains.length === 1, JSON.stringify({ encs, plains, head }));
    const encBuf = encs.length ? fs.readFileSync(enc) : Buffer.alloc(0);
    ok("Gói mã hóa không chứa bản rõ (không có 'manifest.json'/'data.json'/chữ 'PK' đầu zip)", encBuf.indexOf("manifest.json") < 0 && encBuf.indexOf("data.json") < 0 && encBuf.subarray(0, 2).toString() !== "PK");
    ok("Không lỗi JavaScript khi tạo gói mã hóa", errs.length === 0, errs.join(" | "));
    await app.close();
    fs.rmSync(vdir, { recursive: true, force: true }); // giả lập máy mới: mất kho chứng từ
    ({ app, w, errs } = await launch(null, { env: { HAK_FB_PICK: enc } }));
    await w.click("#nav button[data-k=backup]"); await w.waitForSelector("[data-fullbackup]");
    await w.click('[data-fullbackup] button:has-text("Khôi phục từ gói")');
    await w.waitForSelector("#modal [data-pw]");
    await w.fill("#modal [data-pw]", PW + "SAI"); await w.click('#modal button:has-text("Mở gói")');
    await w.waitForSelector('#modal:has-text("Sai mật khẩu")', { timeout: 30000 });
    const mid = await w.evaluate(async () => (await window.hakDocs.list()).docs.length);
    ok("Sai mật khẩu: bị từ chối, hỏi lại, CHƯA ghi chứng từ nào", mid === 0, "docs=" + mid);
    const tmpLeft = () => { const d = path.join(DATA, "restore-tmp"); try { return fs.readdirSync(d).length; } catch (e) { return 0; } };
    ok("Sai mật khẩu: không để lại bản giải mã trong thư mục tạm", tmpLeft() === 0, "còn " + tmpLeft());
    await w.fill("#modal [data-pw]", PW); await w.click('#modal button:has-text("Mở gói")');
    for (let i = 0; i < 80; i++) { await w.waitForTimeout(500); if ((await w.evaluate(async () => (await window.hakDocs.list()).docs.length)) >= nDocs0) break; }
    await w.waitForTimeout(500);
    const after = await w.evaluate(async () => { const l = await window.hakDocs.list(), v = await window.hakDocs.verify(); return { n: l.docs.length, st: v.items.map((i) => i.status) }; });
    ok("Đúng mật khẩu: khôi phục từ gói mã hóa đưa chứng từ trở lại đủ, SHA-256 đều 'ok'", after.n === nDocs0 && nDocs0 >= 3 && after.st.every((x) => x === "ok"), JSON.stringify(after) + " / " + nDocs0);
    ok("Khôi phục xong: thư mục tạm không còn bản giải mã", tmpLeft() === 0, "còn " + tmpLeft());
    ok("Không lỗi JavaScript khi khôi phục gói mã hóa", errs.length === 0, errs.join(" | "));
    await app.close();
  }

  // GĐ6: lệnh nhạy cảm ở tiến trình chính bị chặn khi chưa đăng nhập; đăng nhập xong chạy được; đăng xuất lại bị chặn
  {
    ({ app, w, errs } = await launch(null, { noAuth: true }));
    const pre = await w.evaluate(async () => ({ l: await window.hakDocs.list(), f: await window.hakFull.create({}), p: await window.hakReport.pdf({ html: "<p>x</p>", name: "x" }), o: await window.hakOcr.batch([]).catch((e) => ({ ok: false, error: String(e.message || e) })) }));
    ok("Chưa đăng nhập: kho chứng từ, Full Backup, PDF, OCR đều bị tiến trình chính từ chối ('Chưa đăng nhập')", [pre.l, pre.f, pre.p].every((r) => r.ok === false && /Chưa đăng nhập/.test(r.error)) && /Chưa đăng nhập/.test(pre.o.error || ""), JSON.stringify(pre).slice(0, 300));
    await auth(w);
    const post = await w.evaluate(async () => ({ l: await window.hakDocs.list() }));
    ok("Đăng nhập Admin xong: lệnh kho chứng từ chạy được", post.l.ok === true, JSON.stringify(post).slice(0, 200));
    await app.close();
  }

  // V9: quyền do TIẾN TRÌNH CHÍNH quyết định — renderer không tự cấp được; đăng xuất ở main thì lệnh bị chặn lại
  {
    ({ app, w, errs } = await launch(null, { noAuth: true }));
    const forged = await w.evaluate(async () => {
      const api = Object.keys(window.hakStore || {});
      const a = window.hakStore.login("admin", "mat-khau-gia-mao1"), b = window.hakStore.login(["system.admin"], { perms: ["backup.restore"] });
      return { api, a, b, f: await window.hakFull.create({}), r: await window.hakFull.stage({}), d: await window.hakDocs.list() };
    });
    ok("V9: renderer KHÔNG có API gửi danh sách quyền (không còn session/setSession); đăng nhập giả mạo bị main từ chối; backup/restore/kho chứng từ vẫn bị chặn",
      !forged.api.includes("session") && forged.a.ok === false && forged.b.ok === false && [forged.f, forged.r, forged.d].every((r) => r.ok === false && /Chưa đăng nhập/.test(r.error || "")), JSON.stringify(forged).slice(0, 300));
    await auth(w);
    const st1 = await w.evaluate(() => window.hakStore.authState());
    await w.evaluate(() => window.hakStore.logout());
    const after = await w.evaluate(async () => ({ s: window.hakStore.authState(), l: await window.hakDocs.list() }));
    ok("V9: sau khi main đăng xuất phiên, lệnh nhạy cảm lại bị chặn", st1.ok === true && st1.role === "admin" && after.s.ok === false && after.l.ok === false, JSON.stringify({ st1: st1.ok, after }).slice(0, 250));
    await app.close();
  }

  // Quên mật khẩu Admin → mã khôi phục (mã sai bị từ chối; dùng xong cấp mã mới)
  ({ app, w, errs } = await launch(null, { noAuth: true }));
  await w.click('button:has-text("Quên mật khẩu Admin")');
  const fillRec = async (c) => { for (const [k, v] of [["c", c], ["u", "admin"], ["p", "MoiAdmin2026"], ["p2", "MoiAdmin2026"]]) await w.fill("#main input[data-f=" + k + "]", v); await w.click("#main button.big"); await w.waitForTimeout(500); };
  await fillRec("0000-0000-0000-0000");
  const wrong = /không đúng/.test(await w.locator("#main .warn").innerText());
  await fillRec(recoveryCode); await w.waitForSelector("[data-recovery]");
  const code2 = await w.locator("[data-recovery]").innerText(); await w.click(".dlg footer button.pri"); await w.waitForSelector("#nav button[data-k=home]");
  await app.close(); ADMIN.p = "MoiAdmin2026";
  ({ app, w, errs } = await launch());
  ok("Quên mật khẩu Admin: mã sai bị từ chối, mã đúng đặt lại được, cấp mã khôi phục mới", wrong && code2 !== recoveryCode && (await w.locator("#nav button[data-k=home]").count()) === 1);
  await app.close();

  // làm hỏng file dữ liệu → màn hình khôi phục, không ghi đè
  const nvTruocHong = JSON.parse(fs.readFileSync(file, "utf8")).nhanvien.length; // khôi phục phải ra đúng dữ liệu ngay trước khi hỏng
  fs.writeFileSync(file, "{hỏng");
  ({ app, w, errs } = await launch());
  const txt = await w.locator("main").innerText();
  ok("File hỏng → hiện màn hình khôi phục", /Không mở được file dữ liệu/.test(txt));
  ok("File hỏng KHÔNG bị app ghi đè", fs.readFileSync(file, "utf8") === "{hỏng");
  const hasBackup = await w.locator("text=Khôi phục bản này").count();
  if (hasBackup) {
    await w.locator("text=Khôi phục bản này").first().click(); await w.waitForTimeout(800);
    const after = JSON.parse(fs.readFileSync(file, "utf8"));
    ok("Khôi phục từ bản sao lưu tự động", after.nhanvien && after.nhanvien.length === nvTruocHong, "nhân viên: " + nvTruocHong + " → " + (after.nhanvien || []).length);
    ok("File hỏng được giữ lại (không xóa)", fs.readdirSync(DATA).some((f) => /^data\.corrupt_/.test(f)));
  } else ok("Có bản sao lưu để khôi phục", false);
  await app.close();

  // ---- Checklist trước khi chốt kỳ (Master Prompt mục XIV/XVIII) ----
  // Đặt ở CUỐI (sau mọi test dùng chung DATA): chốt thêm kỳ ở đây để không ảnh hưởng các test phía
  // trên vốn giả định chỉ kỳ 9/2026 đã chốt (VD A3-01 dùng phụ lục hiệu lực 10/2026 — chưa chốt).
  { // Thêm NV riêng (không đụng NV001 — đã có nhiều phụ lục chồng chéo từ các test trước) với Mã tăng ca sai để lộ 1 điểm "cảnh báo"
    const f = path.join(DATA, "data.json"), d0 = JSON.parse(fs.readFileSync(f, "utf8"));
    d0.nhanvien.push({ _id: "zchk1", "Mã NV": "ZCHK1", "Họ và tên": "E2E Checklist", "Trạng thái": "Đang làm việc" });
    d0.hopdong.push({ _id: "zchk1hd", "Mã NV": "ZCHK1", "Số HĐLĐ": "ZCHK1/HĐ01", "Hình thức HĐLĐ": "Xác định thời hạn", "Ngày vào làm": "2026-01-01" });
    d0.chitiethd.push({ _id: "zchk1pl", "Mã NV": "ZCHK1", "Số HĐLĐ": "ZCHK1/HĐ01", "Hiệu lực từ": "2026-01-01", "Mã lương": "TG1", "Lương thỏa thuận": "9000000", "Thuế TNCN": "MT00", "HTTT": "Tiền mặt" });
    // Kỳ 10/2026: đã có sẵn 11 tấn sản lượng chưa phân bổ hết (phiếu P3/P4 ở test "Chia phiếu theo tổ"
    // phía trên) → mục #9 (sai lệch khối lượng) ở mức "loi" = BLOCKER (mục XIV) — dùng chính kỳ này để
    // kiểm tra BLOCKER không có đường vượt qua, dù cũng có cảnh báo tăng ca của ZCHK1.
    d0.chamcong.push({ "Kỳ": "2026-10", "Mã NV": "ZCHK1", "Hình thức công": "BT", "01": "1XYZ" });
    // Kỳ 2027-01: kỳ sạch (không dùng ở test nào khác) → chỉ còn đúng 1 cảnh báo (tăng ca ZCHK1) để
    // kiểm tra đường WARNING vẫn chốt được sau khi xác nhận checklist.
    d0.chamcong.push({ "Kỳ": "2027-01", "Mã NV": "ZCHK1", "Hình thức công": "BT", "01": "1XYZ" });
    fs.writeFileSync(f, JSON.stringify(d0));
    ({ app, w, errs } = await launch());
    await w.click("#nav button[data-k=luong]");
    await w.selectOption("#top select", "10"); await w.fill("#top input[type=number]", "2026"); await w.dispatchEvent("#top input[type=number]", "change"); await w.waitForTimeout(200);
    await w.click("button.big"); await w.waitForTimeout(200);
    await w.click('button:has-text("Chốt kỳ lương")'); await w.waitForSelector(".dlg");
    const ckTxt = await w.locator(".dlg").innerText();
    ok("Checklist trước khi chốt: hiện đúng 20 điểm, báo mã tăng ca 'TC_KHONG_TON_TAI' chưa có trong danh mục + 1 lỗi (sản lượng chưa phân bổ hết)",
      /\d+ lỗi/.test(ckTxt) && /XYZ/.test(ckTxt), ckTxt.replace(/\s+/g, " ").slice(0, 300));
    ok("Còn LỖI (BLOCKER mục XIV) → KHÔNG có nút vượt qua, chỉ có nút đóng để sửa dữ liệu",
      (await w.locator('.dlg footer button:has-text("tiếp tục chốt")').count()) === 0 && (await w.locator('.dlg footer button:has-text("Vẫn chốt dù còn LỖI")').count()) === 0 && /KHÔNG thể vượt qua/.test(ckTxt));
    await w.click('.dlg footer button:has-text("Đóng")'); await w.waitForTimeout(150);
    ok("Đóng checklist khi còn BLOCKER → kỳ 10/2026 vẫn CHƯA chốt", !(await w.locator(".locked").count()));
    await app.close();

    // Kỳ 2027-01 (sạch, không có sản lượng chưa phân bổ) → chỉ còn cảnh báo tăng ca, chốt được sau khi xác nhận
    ({ app, w, errs } = await launch());
    await w.click("#nav button[data-k=luong]");
    await w.selectOption("#top select", "1"); await w.fill("#top input[type=number]", "2027"); await w.dispatchEvent("#top input[type=number]", "change"); await w.waitForTimeout(200);
    await w.click("button.big"); await w.waitForTimeout(200);
    await w.click('button:has-text("Chốt kỳ lương")'); await w.waitForSelector(".dlg");
    const ckTxt2 = await w.locator(".dlg").innerText();
    ok("Kỳ sạch (chỉ cảnh báo, không lỗi): hiện '0 lỗi' + đúng cảnh báo tăng ca; CÓ nút tiếp tục chốt",
      /0 lỗi/.test(ckTxt2) && /XYZ/.test(ckTxt2) && (await w.locator('.dlg footer button:has-text("Đã kiểm tra, tiếp tục chốt")').count()) === 1);
    await w.click('.dlg footer button:has-text("Đã kiểm tra, tiếp tục chốt")'); await w.waitForSelector(".dlg");
    ok("Sau khi xác nhận checklist, vào đúng hộp xác nhận chốt kỳ như cũ", /Chốt Tháng 1\/2027|Chốt kỳ/.test(await w.locator(".dlg header h3").innerText()));
    await w.locator(".dlg input").fill("Chốt E2E checklist"); await w.click(".dlg footer button.pri"); await w.waitForSelector(".locked");
    ok("Chốt được kỳ sạch (chỉ cảnh báo) sau khi xem checklist", (await w.locator(".locked").first().innerText()).indexOf("đã chốt") >= 0);
    await app.close();
  }

  // Cấu trúc dữ liệu nguy hiểm → chỉ xem/khôi phục, file KHÔNG bị đổi 1 byte (bản 1.4.0 thay bảng sai kiểu bằng bảng rỗng)
  for (const [label, bad] of [["bảng Nhân viên sai kiểu", { schemaVersion: 2, nhanvien: { NV001: { "Họ và tên": "A" } }, chamcong: [] }],
    ["file của phiên bản mới hơn (schemaVersion 3)", { schemaVersion: 3, nhanvien: [{ "Mã NV": "NV001" }], bangmoi: [{ x: 1 }] }]]) {
    const SD = fs.mkdtempSync(path.join(os.tmpdir(), "hak-e2e-sch-")), txt0 = JSON.stringify(bad);
    fs.writeFileSync(path.join(SD, "data.json"), txt0);
    ({ app, w, errs } = await launch(SD)); await w.waitForTimeout(500);
    const m = await w.locator("main").innerText();
    await app.close();
    ok("Cấu trúc nguy hiểm (" + label + ") → màn hình khôi phục, file giữ nguyên từng byte", /Không mở được file dữ liệu/.test(m) && /Cấu trúc dữ liệu không an toàn/.test(m) && fs.readFileSync(path.join(SD, "data.json"), "utf8") === txt0 && errs.length === 0, m.split("\n").slice(0, 3).join(" | ") + (errs.length ? " · LỖI JS: " + errs.join(" | ") : ""));
  }

  // Nâng cấp từ dữ liệu bản 1.3.0 (không schemaVersion, tiền dạng "500.000", kỳ chốt kiểu cũ)
  const OLD = fs.mkdtempSync(path.join(os.tmpdir(), "hak-e2e-old-"));
  const legacy = { nhanvien: [{ "Mã NV": "NV001", "Họ và tên": "Cũ", "Trạng thái": "Đang làm việc", "Số CCCD": "49090001234" }],
    psluong: [{ "Ngày hạch toán": "28/09/2026", "Mã NV": "NV001", "Thưởng": "500.000" }],
    kyluong: [{ ky: "2026-08", ngayChot: "2026-09-01T00:00:00.000Z", ghiChu: "", kq: { bangluong: [{ "Mã NV": "NV001", "Họ và tên": "Cũ", "Thực lĩnh": 1000000, "Tổng thu nhập": 1000000 }], bhxh: [], tncn: [], canhbao: [] } }] };
  fs.writeFileSync(path.join(OLD, "data.json"), JSON.stringify(legacy));
  ({ app, w, errs } = await launch(OLD));
  await w.waitForTimeout(600);
  await app.close();
  const up = JSON.parse(fs.readFileSync(path.join(OLD, "data.json"), "utf8"));
  const ob = fs.readdirSync(path.join(OLD, "backups"));
  const pre = ob.filter((f) => /^truoc-nang-cap_.*\.json$/.test(f))[0];
  ok("Nâng cấp 1.3→1.4: có bản sao lưu trước nâng cấp chứa nguyên trạng", !!pre && JSON.parse(fs.readFileSync(path.join(OLD, "backups", pre), "utf8")).psluong[0]["Thưởng"] === "500.000", ob.join(", "));
  ok("Nâng cấp: tiền '500.000' → 500000, ngày → ISO, CCCD bù số 0, schemaVersion 2", up.psluong[0]["Thưởng"] === "500000" && up.psluong[0]["Ngày hạch toán"] === "2026-09-28" && up.nhanvien[0]["Số CCCD"] === "049090001234" && up.schemaVersion === 2);
  ok("Nâng cấp: kỳ đã chốt kiểu cũ giữ nguyên", up.kyluong.length === 1 && up.kyluong[0].kq.bangluong[0]["Thực lĩnh"] === 1000000);
  ({ app, w, errs } = await launch(OLD)); await w.waitForTimeout(400);
  const ob2 = fs.readdirSync(path.join(OLD, "backups")).filter((f) => /^truoc-nang-cap_.*\.json$/.test(f));
  ok("Mở lần 2 không tạo thêm bản trước nâng cấp", ob2.length === 1);
  await w.click("#nav button[data-k=kyluong]");
  ok("Kỳ chốt kiểu cũ hiển thị 'Bản cũ'", /Bản cũ/.test(await w.locator("main").innerText()));
  ok("Không lỗi JavaScript khi mở dữ liệu cũ", errs.length === 0, errs.join(" | "));
  await app.close();

  const fail = results.filter((r) => !r.pass).length;
  fs.writeFileSync(path.join(__dirname, "last-e2e-result.json"), JSON.stringify({ at: new Date().toISOString(), electron: ELECTRON, results }, null, 2));
  console.log("\nE2E: " + (results.length - fail) + "/" + results.length + " đạt");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("E2E LỖI:", e); process.exit(2); });
