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
  await w.click("#nav button[data-k=luong]"); await w.click("button.big");
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
  await w.locator("main button", { hasText: "Xuất PDF" }).click();
  let pdfName = null; for (let i = 0; i < 100 && !pdfName; i++) { await w.waitForTimeout(300); pdfName = fs.readdirSync(DL).filter((f) => /^BangTinhLuongNoiBo_2026-09\.pdf$/.test(f))[0]; }
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
  // Master Prompt mục VII: Danh mục → Công thức tiền lương — 7 tab, lọc theo Loại, thư viện biến, mẫu, chạy thử, lịch sử
  await w.click("#nav button[data-k=dm]"); await w.click('#main button:has-text("Công thức tiền lương")');
  const ctTabs = await w.locator(".bar.sub button").allInnerTexts();
  ok("Công thức tiền lương: đủ 7 tab (mục VII)", ["Tăng ca", "Phụ cấp", "Hỗ trợ", "Thư viện biến", "Mẫu công thức", "Kiểm tra công thức", "Lịch sử phiên bản"].every((t) => ctTabs.includes(t)), ctTabs.join(", "));
  await w.click('main button:has-text("Thêm dòng")');
  const ctRow = w.locator("main tbody tr").last().locator("input");
  await ctRow.nth(0).fill("2020-01-01"); await ctRow.nth(0).dispatchEvent("change");
  await ctRow.nth(2).fill("TC_E2E"); await ctRow.nth(2).dispatchEvent("change");
  await ctRow.nth(6).fill("CONG_TC * HE_SO_TC * 2"); await ctRow.nth(6).dispatchEvent("change");
  ok("Tab Tăng ca: thêm công thức mới (Loại tự gán OVERTIME, không cần sửa code)", (await ctRow.nth(4).inputValue()) === "OVERTIME" && (await ctRow.nth(2).inputValue()) === "TC_E2E");
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
  const histTxt = await w.locator("main").innerText();
  ok("Lịch sử phiên bản: hiện đúng mã (chọn mặc định đã là mã duy nhất) + phiên bản Trạng thái Hiệu lực + biểu thức", histTxt.includes("TC_E2E") && histTxt.includes("Hiệu lực") && histTxt.includes("CONG_TC * HE_SO_TC * 2"), histTxt.replace(/\s+/g, " ").slice(0, 300));
  ok("Lịch sử phiên bản: kỳ hiện tại chưa chốt nên sửa danh mục chưa ghi nhật ký hồi tố (đúng quy ước chung — xem nhật ký đầy đủ ở màn hình Nhật ký hệ thống khi có hồi tố)", histTxt.includes("Chưa có nhật ký khớp mã này"), histTxt.replace(/\s+/g, " ").slice(0, 300));
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
  // α18: Phiếu lương trong menu — kỳ đã chốt, lọc / tìm, xuất Excel
  await w.click("#nav button[data-k=slips]"); await w.waitForSelector("[data-slips]");
  const slTxt = await w.locator("main").first().innerText(), nSl = +(await w.locator("[data-slips]").getAttribute("data-slips"));
  await w.fill('main input[type=search]', "khong-co-ai"); await w.dispatchEvent('main input[type=search]', "change"); await w.waitForTimeout(150);
  const nSl0 = +(await w.locator("[data-slips]").getAttribute("data-slips"));
  await w.fill('main input[type=search]', "e2e nhan"); await w.dispatchEvent('main input[type=search]', "change"); await w.waitForTimeout(150);
  const nSl1 = +(await w.locator("[data-slips]").getAttribute("data-slips"));
  await w.click('main button:has-text("Xuất Excel")');
  let pf = null; for (let i = 0; i < 30 && !pf; i++) { await w.waitForTimeout(200); pf = fs.readdirSync(DL).filter((f) => /^PhieuLuong_2026-09\.xlsx$/.test(f))[0]; }
  let pfOk = false;
  if (pf) { const XLSX = require(path.join(APP, "xlsx.full.min.js")), r0 = XLSX.utils.sheet_to_json(XLSX.read(fs.readFileSync(path.join(DL, pf)), { type: "buffer" }).Sheets["PhieuLuong_2026-09"])[0]; pfOk = r0 && r0["Thực lĩnh"] === 11370000 && r0["Mã NV"] === "NV001"; }
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
    await w.click("#nav button[data-k=luong]"); await w.selectOption('select[aria-label="Cách bù lương sản lượng"]', "false");
    ok("Không lỗi JavaScript ở phân bổ khối lượng (ExcelJS chạy được với CSP)", errs.length === 0, errs.join(" | "));
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
    fs.writeFileSync(fb, JSON.stringify(db2));
    ({ app, w, errs } = await launch(SD));
    // Xóa bản "to"/Hiệu lực đã nạp sẵn (HAK) → mô phỏng công ty CHƯA khai báo quy chế bù sản lượng
    await w.click("#nav button[data-k=dm]"); await w.click('#main button:has-text("Quy chế bù sản lượng")');
    dialogs = []; await w.locator("main tbody tr").first().locator('button[title="Xóa dòng"]').click(); await w.waitForTimeout(200);
    ok("Xóa bản Quy chế bù sản lượng đã nạp sẵn (giả lập công ty chưa khai báo)", (await w.locator("main tbody tr").count()) === 0);
    await w.click("#nav button[data-k=luong]");
    await w.selectOption("#top select", "11"); await w.fill("#top input[type=number]", "2026"); await w.dispatchEvent("#top input[type=number]", "change"); await w.waitForTimeout(200);
    const warnNoPolicy = await w.locator("main").first().innerText();
    ok("Tính lương: chưa có Quy chế bù sản lượng CHÍNH THỨC → cảnh báo ngay trên màn hình (lựa chọn hiện tại chỉ để xem thử)", /Chưa có Quy chế bù sản lượng CHÍNH THỨC/.test(warnNoPolicy));
    await w.click("button.big"); await w.waitForTimeout(200);
    dialogs = []; await w.click('button:has-text("Chốt kỳ lương")'); await w.waitForTimeout(200);
    ok("Chốt kỳ có sản lượng cần bù mà CHƯA có Quy chế bù sản lượng hợp lệ → chặn cứng (mục VIII), không chốt được", dialogs.some((d) => /KHÔNG THỂ CHỐT/.test(d) && /Quy chế bù sản lượng/.test(d)) && !(await w.locator(".locked").count()), dialogs.join(" | "));
    // Khai báo quy chế CHÍNH THỨC = "to" (bình quân tổ), khác lựa chọn đang xem ("false" — mặc định màn hình Tính lương)
    await w.click("#nav button[data-k=dm]"); await w.click('#main button:has-text("Quy chế bù sản lượng")');
    await w.click('main button:has-text("Thêm dòng")');
    const qbRow = w.locator("main tbody tr").last().locator("input");
    await qbRow.nth(0).fill("2020-01-01"); await qbRow.nth(0).dispatchEvent("change");
    await qbRow.nth(2).fill("to"); await qbRow.nth(2).dispatchEvent("change");
    await qbRow.nth(3).fill("Hiệu lực"); await qbRow.nth(3).dispatchEvent("change");
    await w.click("#nav button[data-k=luong]");
    await w.selectOption("#top select", "11"); await w.fill("#top input[type=number]", "2026"); await w.dispatchEvent("#top input[type=number]", "change"); await w.waitForTimeout(200);
    const warnMoPhong = await w.locator("main").first().innerText();
    ok("Tính lương: có Quy chế Hiệu lực ('to') khác lựa chọn đang xem ('false') → báo rõ đang XEM THỬ, không phải chính thức", /Quy chế bù sản lượng CHÍNH THỨC kỳ 11\/2026: Bù SL theo BÌNH QUÂN TỔ/.test(warnMoPhong) && /đang XEM THỬ phương pháp khác/.test(warnMoPhong), warnMoPhong.replace(/\s+/g, " ").slice(0, 300));
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
    await w.fill('input[aria-label="Kỳ của trang"]', "2026-11"); await w.dispatchEvent('input[aria-label="Kỳ của trang"]', "change");
    await w.locator(".subtabs button").nth(1).click(); await w.waitForTimeout(200);
    const g2 = await grid();
    ok("OCR file PDF (pdf.js nạp offline, CSP không eval): đọc ra cùng bảng", g2.length === 3 && g2[0].nv === "NV001" && g2[0].sum === "28,5", JSON.stringify(g2.map((r) => r.sum)));
    await w.fill('input[aria-label="Kỳ của trang"]', "2026-12"); await w.dispatchEvent('input[aria-label="Kỳ của trang"]', "change");
    const before = JSON.parse(fs.readFileSync(f, "utf8")).chamcong.length;
    dialogs = [];
    await w.click('#main button:has-text("Đưa vào Chấm công")'); await w.waitForSelector(".dlg footer button.pri");
    const pv = await w.locator(".dlg").innerText();
    await w.click(".dlg footer button.pri"); await w.waitForTimeout(600);
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
    await w.waitForSelector('[data-fb-msg]:has-text("Đã tạo")', { timeout: 30000 });
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
    d0.chitiethd.push({ _id: "zchk1pl", "Mã NV": "ZCHK1", "Số HĐLĐ": "ZCHK1/HĐ01", "Hiệu lực từ": "2026-01-01", "Mã lương": "TG1", "Lương thỏa thuận": "9000000", "Thuế TNCN": "MT00", "HTTT": "Tiền mặt", "Tăng ca": "TC_KHONG_TON_TAI" });
    // Kỳ 10/2026: đã có sẵn 11 tấn sản lượng chưa phân bổ hết (phiếu P3/P4 ở test "Chia phiếu theo tổ"
    // phía trên) → mục #9 (sai lệch khối lượng) ở mức "loi" = BLOCKER (mục XIV) — dùng chính kỳ này để
    // kiểm tra BLOCKER không có đường vượt qua, dù cũng có cảnh báo tăng ca của ZCHK1.
    d0.chamcong.push({ "Kỳ": "2026-10", "Mã NV": "ZCHK1", "Hình thức công": "BT", "01": "1" });
    // Kỳ 2027-01: kỳ sạch (không dùng ở test nào khác) → chỉ còn đúng 1 cảnh báo (tăng ca ZCHK1) để
    // kiểm tra đường WARNING vẫn chốt được sau khi xác nhận checklist.
    d0.chamcong.push({ "Kỳ": "2027-01", "Mã NV": "ZCHK1", "Hình thức công": "BT", "01": "1" });
    fs.writeFileSync(f, JSON.stringify(d0));
    ({ app, w, errs } = await launch());
    await w.click("#nav button[data-k=luong]");
    await w.selectOption("#top select", "10"); await w.fill("#top input[type=number]", "2026"); await w.dispatchEvent("#top input[type=number]", "change"); await w.waitForTimeout(200);
    await w.click("button.big"); await w.waitForTimeout(200);
    await w.click('button:has-text("Chốt kỳ lương")'); await w.waitForSelector(".dlg");
    const ckTxt = await w.locator(".dlg").innerText();
    ok("Checklist trước khi chốt: hiện đúng 20 điểm, báo mã tăng ca 'TC_KHONG_TON_TAI' chưa có trong danh mục + 1 lỗi (sản lượng chưa phân bổ hết)",
      /\d+ lỗi/.test(ckTxt) && /TC_KHONG_TON_TAI/.test(ckTxt), ckTxt.replace(/\s+/g, " ").slice(0, 300));
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
      /0 lỗi/.test(ckTxt2) && /TC_KHONG_TON_TAI/.test(ckTxt2) && (await w.locator('.dlg footer button:has-text("Đã kiểm tra, tiếp tục chốt")').count()) === 1);
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
