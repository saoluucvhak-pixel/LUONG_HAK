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
  const app = await _electron.launch({ executablePath: ELECTRON, args: ["--no-sandbox", APP], env: Object.assign({}, process.env, { HAK_USER_DATA: dataDir || DATA, HAK_DOWNLOAD_DIR: DL }) });
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
  await w.click('button:has-text("Lưu nhân viên")');
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
  await w.click("#nav button[data-k=luong]"); await w.click("button.big");
  const line = await w.locator("main tbody tr").first().innerText();
  ok("Tính lương: 12.000.000 − BH 630.000 = 11.370.000", /11\.370\.000/.test(line), line.replace(/\t/g, " | "));
  await w.click('button:has-text("Chốt kỳ lương")'); await w.waitForSelector(".dlg");
  await w.locator(".dlg input").fill("Chốt bởi E2E"); await w.click(".dlg footer button.pri"); await w.waitForSelector(".locked");
  ok("Chốt kỳ lương (hộp nhập của app, không dùng window.prompt)", (await w.locator(".locked").first().innerText()).indexOf("đã chốt") >= 0);
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
  const dmCell = w.locator("#main tbody tr").first().locator("input").nth(4);
  await dmCell.evaluate((el) => { const dt = new DataTransfer(); dt.setData("text/plain", "Dán E2E 1\nDán E2E 2"); el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); });
  const pasteToast = await w.locator("#toast").textContent();
  await w.waitForTimeout(700);
  const auP = (await auditOf()).slice(au0).filter((a) => /HỒI TỐ/.test(a.chiTiet));
  ok("Lỗi 1: dán nhiều dòng vào danh mục chồng kỳ đã chốt → ghi nhật ký HỒI TỐ từng dòng + cảnh báo", auP.length === 2 && /2 dòng hồi tố kỳ đã chốt/.test(pasteToast), pasteToast + " · nhật ký hồi tố: " + auP.length);
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
  dialogs = [];
  await w.click("#nav button[data-k=kyluong]"); await w.locator('button:has-text("Mở chốt")').first().click(); await w.waitForTimeout(300);
  ok("Kế toán lương KHÔNG được mở chốt (kiểm tra ở nghiệp vụ)", dialogs.some((d) => /không có quyền mở chốt/i.test(d)) && !(await w.locator(".dlg").count()), dialogs.join(" | "));
  dialogs = [];
  await w.click("#nav button[data-k=dm]"); await w.click('#main button:has-text("Mã lương")');
  const cell = w.locator("#main tbody tr").first().locator("input").nth(4);
  const before = await cell.inputValue();
  await cell.fill("Sửa hồi tố E2E"); await cell.press("Tab"); await w.waitForTimeout(300);
  ok("Q-14: Kế toán lương sửa danh mục có hiệu lực trong kỳ đã chốt → bị chặn, chỉ Admin", dialogs.some((d) => /Chỉ Admin/.test(d)) && (await cell.inputValue()) === before, dialogs.join(" | "));
  await w.click('#top button:has-text("Đăng xuất")'); await w.waitForSelector("#main input[data-f=u]");
  await auth(w, ADMIN); dialogs = [];
  await w.click("#nav button[data-k=dm]"); await w.click('#main button:has-text("Mã lương")');
  const cell2 = w.locator("#main tbody tr").first().locator("input").nth(4);
  await cell2.fill("Sửa hồi tố E2E"); await cell2.press("Tab"); await w.waitForTimeout(700);
  ok("Admin sửa được dữ liệu hồi tố (có cảnh báo)", (await cell2.inputValue()) === "Sửa hồi tố E2E" && !dialogs.some((d) => /Chỉ Admin/.test(d)));
  // Q-15: phụ lục đã dùng tính lương kỳ đã chốt → không ai sửa được (kể cả Admin); thêm phụ lục mới thì được
  dialogs = [];
  await w.click("#nav button[data-k=nhansu]"); await w.locator("#main table tbody tr").first().click();
  await w.click('.subtabs button:has-text("Hợp đồng lao động")'); await w.waitForTimeout(300);
  const plCard = w.locator(".card", { has: w.locator('h3:has-text("Lương & phụ lục HĐ")') });
  const nPL = await plCard.locator("tbody tr").count();
  await plCard.locator("tbody tr", { hasText: "01/01/2025" }).first().click(); await w.waitForSelector(".dlg"); // phụ lục đã dùng cho kỳ chốt 9/2026 (phụ lục 11/2026 thêm ở bước UI nằm trên cùng)
  const lock15 = await w.locator(".dlg .locked").innerText().catch(() => "");
  await w.click(".dlg footer button.pri"); await w.waitForTimeout(300);
  const blocked15 = dialogs.some((d) => /Q-15/.test(d) && /PHỤ LỤC MỚI/.test(d)) && /Q-15/.test(lock15);
  if (await w.locator(".dlg").count()) await w.click(".dlg header button");
  await plCard.locator('button:has-text("Thêm")').click(); await w.waitForSelector(".dlg");
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
    const plRows = async () => { await hdCard().locator("tbody tr", { hasText: "E2E-HD2" }).click(); await w.waitForTimeout(250); return w.locator(".card", { has: w.locator('h3:has-text("Lương & phụ lục HĐ")') }).locator("tbody tr").count(); };
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
    const plCardT = w.locator(".card", { has: w.locator('h3:has-text("Lương & phụ lục HĐ")') });
    const plText = await plCardT.innerText();
    await plCardT.locator("tbody tr").first().click(); await w.waitForSelector(".dlg");
    const formText = await w.locator(".dlg").innerText(), salaryInput = await w.locator(".dlg .fld", { hasText: "Lương thỏa thuận" }).count();
    await w.click(".dlg header button");
    await w.click('.subtabs button:has-text("Khen thưởng")'); await w.waitForTimeout(300);
    const ktText = await w.locator(".card", { has: w.locator('h3:has-text("Khen thưởng")') }).innerText();
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
  fs.writeFileSync(file, "{hỏng");
  ({ app, w, errs } = await launch());
  const txt = await w.locator("main").innerText();
  ok("File hỏng → hiện màn hình khôi phục", /Không mở được file dữ liệu/.test(txt));
  ok("File hỏng KHÔNG bị app ghi đè", fs.readFileSync(file, "utf8") === "{hỏng");
  const hasBackup = await w.locator("text=Khôi phục bản này").count();
  if (hasBackup) {
    await w.locator("text=Khôi phục bản này").first().click(); await w.waitForTimeout(800);
    const after = JSON.parse(fs.readFileSync(file, "utf8"));
    ok("Khôi phục từ bản sao lưu tự động", after.nhanvien && after.nhanvien.length === 1, "nhân viên: " + (after.nhanvien || []).length);
    ok("File hỏng được giữ lại (không xóa)", fs.readdirSync(DATA).some((f) => /^data\.corrupt_/.test(f)));
  } else ok("Có bản sao lưu để khôi phục", false);
  await app.close();

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
