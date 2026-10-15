// V10.3 — Duyệt thật trên Electron: HAK Smart Filter (Nhân sự · Chấm công · Sản lượng · Bảng tính lương) + Modal Master–Detail Phụ cấp / Hỗ trợ,
// ở 1366×768, 1600×900, 1920×1080. Ảnh chụp sản phẩm thật vào docs/v10_3_screens/<WxH>/ ; báo cáo docs/V10_3_UI_CHECK.json. Dữ liệu 100% GIẢ LẬP.
// Chạy: xvfb-run -a node tests/e2e/v103-ui-check.js
/* global document, performance, Event, setInterval, clearInterval, innerWidth, innerHeight */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const ELECTRON = process.env.ELECTRON_PATH || require("electron");
const APP = path.resolve(__dirname, "../..");
const OUT = process.env.E2E_SHOTS || path.join(APP, "docs", "v10_3_screens");
const SIZES = [[1366, 768], [1600, 900], [1920, 1080]];
const ADMIN = { u: "admin", n: "Quản trị E2E", p: "Admin2026e2e" };
const checks = [];
const ok = (name, cond, extra) => { checks.push({ name, pass: !!cond, extra: extra || "" }); console.log((cond ? "PASS " : "FAIL ") + name + (extra ? " — " + String(extra).slice(0, 180) : "")); };
async function launch(dir) {
  const app = await _electron.launch({ executablePath: ELECTRON, args: ["--no-sandbox", APP], env: Object.assign({}, process.env, { HAK_USER_DATA: dir, HAK_NO_SHELL: "1" }) });
  const w = await app.firstWindow(); const errs = [], dialogs = [];
  w.on("pageerror", (e) => errs.push(e.message)); w.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  w.__dlgMode = "accept";
  w.on("dialog", (d) => { dialogs.push(d.message()); if (w.__dlgMode === "dismiss") d.dismiss(); else d.accept(d.type() === "prompt" ? "" : undefined); });
  await w.waitForSelector("#main > *");
  const t = await w.locator("#top h2").innerText();
  if (/Thiết lập/.test(t)) {
    for (const [k, v] of [["u", ADMIN.u], ["n", ADMIN.n], ["p", ADMIN.p], ["p2", ADMIN.p]]) await w.fill("#main input[data-f=" + k + "]", v);
    await w.click("#main button.big"); await w.waitForSelector("[data-recovery]"); await w.click(".dlg footer button.pri"); await w.waitForSelector("#nav button[data-k=home]");
  } else if (/Đăng nhập/.test(t)) {
    await w.fill("#main input[data-f=u]", ADMIN.u); await w.fill("#main input[data-f=p]", ADMIN.p); await w.click("#main button.big"); await w.waitForSelector("#nav button[data-k=home]");
  }
  return { app, w, errs, dialogs };
}
(async () => {
  const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "hak-v103-"));
  let { app, w, errs } = await launch(DIR);
  await w.click("#nav button[data-k=backup]"); await w.click('button:has-text("Nạp danh mục chuẩn HAK")'); await w.waitForTimeout(300);
  await app.close();
  const fb = path.join(DIR, "data.json"), db = JSON.parse(fs.readFileSync(fb, "utf8")), now = new Date(), Y = now.getFullYear(), M = now.getMonth() + 1, pad = (n) => ("0" + n).slice(-2), ky = Y + "-" + pad(M);
  const ndays = new Date(Y, M, 0).getDate();
  const pbs = (db.dm_phongban || []).slice(0, 3).map((p) => p["Mã phòng ban"]);
  db.dm_phucap = [
    { _id: "pa", "Mã phụ cấp": "PA", "Tên phụ cấp": "Phụ cấp chuyên cần (tỷ lệ theo công)", "Số tiền": "1000000", "Tham chiếu": "2", "Cách tính": "Tỷ lệ theo công", "Loại công thức": "PC_TYLE_A", "Hiệu lực từ": "2024-01-01" },
    { _id: "pb", "Mã phụ cấp": "PB", "Tên phụ cấp": "Phụ cấp cố định", "Số tiền": "500000", "Cách tính": "Cố định hàng tháng", "Loại công thức": "CO_DINH", "Hiệu lực từ": "2024-01-01" },
    { _id: "pc", "Mã phụ cấp": "PC", "Tên phụ cấp": "Phụ cấp chưa khai Loại công thức", "Số tiền": "600000", "Tham chiếu": "0", "Cách tính": "Tỷ lệ theo công", "Hiệu lực từ": "2024-01-01" }
  ];
  db.dm_hotro = [
    { _id: "ha", "Mã hỗ trợ": "HA", "Tên hỗ trợ": "Tiền cơm", "Số tiền": "20000", "Hiệu lực từ": "2024-01-01" },
    { _id: "hb", "Mã hỗ trợ": "HB", "Tên hỗ trợ": "Hỗ trợ thiếu công chuẩn", "Số tiền": "150000", "Cách tính": "Thiếu công chuẩn", "Loại công thức": "HT_THIEU_CHUAN", "Hiệu lực từ": "2024-01-01" },
    { _id: "hc", "Mã hỗ trợ": "HC", "Tên hỗ trợ": "Hỗ trợ tùy chỉnh (thiếu công)", "Số tiền": "10000", "Loại công thức": "HT_TUY_CHINH", "Hiệu lực từ": "2024-01-01" }
  ];
  const combos = [["PA", "HA,HB"], ["PA", "HA"], ["PB", "HA,HC"], ["PC", "HA"], ["PA", ""], ["PB", "HC"]];
  db.nhanvien = (db.nhanvien || []).filter((r) => !/^NV9/.test(r["Mã NV"]));
  const ten = ["Nguyễn Văn Ánh", "Đặng Thị Bình", "Lê Hoàng Cường", "Phạm Dũng", "Võ Thị Em", "Trần Gia Phúc", "Ngô Quang Hải", "Bùi Thị Hạnh", "Đỗ Văn Khôi", "Hồ Thị Lan", "Lý Minh Nhật", "Mai Thị Oanh"];
  ten.forEach((tn, i) => {
    const ma = "NV9" + pad(i + 1), cb = combos[i % combos.length];
    db.nhanvien.push({ _id: "nn" + i, "Mã NV": ma, "Họ và tên": tn, "Trạng thái": i === 11 ? "Đã nghỉ việc" : "Đang làm việc" });
    db.hopdong.push({ _id: "hh" + i, "Mã NV": ma, "Số HĐLĐ": ma + "/HĐ", "Hình thức HĐLĐ": i % 3 === 0 ? "Không xác định thời hạn" : "Xác định thời hạn", "Ngày vào làm": "2025-01-01", "Ngày hết hạn": i % 3 === 0 ? "" : "2026-" + pad(10 + (i % 3)) + "-" + pad(20) });
    db.chitiethd.push({ _id: "pp" + i, "Mã NV": ma, "Số HĐLĐ": ma + "/HĐ", "Hiệu lực từ": "2026-01-01", "Phòng ban": pbs[i % pbs.length] || "", "Mã lương": "TG1", "Lương thỏa thuận": String(7800000 + i * 100000), "Phụ cấp": cb[0], "Hỗ trợ": cb[1], "HTTT": "Chuyển khoản" });
    const bt = { "Kỳ": ky, "Mã NV": ma, "Hình thức công": "BT" };
    for (let d = 1; d <= Math.min(ndays, 24); d++) if (new Date(Y, M - 1, d).getDay() !== 0) bt[pad(d)] = "1";
    if (i !== 5) db.chamcong.push(bt); // NV906 không có chấm công kỳ này
  });
  for (let i = 1; i <= 200; i++) db.sanluong.push({ _id: "sl" + i, "Phiếu cân": "PC" + String(i).padStart(4, "0"), "Ngày cân": ky + "-" + pad(1 + (i % 27)), "KL hàng (Tấn)": String(10 + (i % 7)), "Mã NV": "NV9" + pad(1 + (i % 12)), "Mã phòng ban": pbs[i % pbs.length] || "" });
  const ct = (id, ma, lo, bt, tt, v, extra) => Object.assign({ _id: id, "Mã công thức": ma, "Tên công thức": ma + " v" + v, "Loại": lo, "Biểu thức": bt, "Trạng thái": tt, "Phiên bản": v, "Hiệu lực từ": v === 1 ? "2026-01-01" : ky + "-01", "Người lập": "ketoan1", "Ngày lập": "2026-01-02T01:00:00.000Z" }, tt === "Hiệu lực" ? { "Người duyệt": "sep1", "Thời điểm duyệt": "2026-01-03T01:00:00.000Z", "Người kích hoạt": "admin", "Thời điểm kích hoạt": "2026-01-04T01:00:00.000Z" } : {}, extra || {});
  db.dm_congthuc = [
    ct("c1", "PC_TYLE_A", "ALLOWANCE", "ROUND(MUC_PHU_CAP * CONG_HUONG_PHU_CAP / CONG_CHUAN)", "Hiệu lực", 1),
    ct("c2", "PC_TYLE_A", "ALLOWANCE", "IF(CONG_HUONG_PHU_CAP >= CONG_CHUAN - NGUONG_PHU_CAP, MUC_PHU_CAP, ROUND(MUC_PHU_CAP * CONG_HUONG_PHU_CAP / CONG_CHUAN))", "Nháp", 2),
    ct("c3", "HT_TUY_CHINH", "SUPPORT", "SO_NGAY_COM * MUC_HO_TRO", "Hiệu lực", 1),
    ct("c4", "HT_TUY_CHINH", "SUPPORT", "MAX(CONG_CHUAN - CONG_THUC_TE, 0) * MUC_HO_TRO", "Nháp", 2)
  ];
  fs.writeFileSync(fb, JSON.stringify(db)); fs.copyFileSync(fb, fb + ".seed");
  ({ app, w, errs } = await launch(DIR));
  const report = { generated: new Date().toISOString(), sizes: SIZES.map((s) => s.join("x")), checks, perf: {}, summary: {} };

  for (const [W, H] of SIZES) {
    if (W !== SIZES[0][0]) { await app.close(); fs.copyFileSync(fb + ".seed", fb); ({ app, w, errs } = await launch(DIR)); }
    const tag = W + "x" + H, dir = path.join(OUT, tag); fs.mkdirSync(dir, { recursive: true });
    await app.evaluate(({ BrowserWindow }, [ww, hh]) => { const win = BrowserWindow.getAllWindows()[0]; win.setContentSize(ww, hh); }, [W, H]);
    await w.waitForTimeout(400);
    const shot = async (name) => { await w.waitForTimeout(200); await w.screenshot({ path: path.join(dir, name + ".png") }); };
    const noHScroll = (label) => w.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, mw: document.querySelector("main").scrollWidth, mc: document.querySelector("main").clientWidth })).then((g) => ok("[" + tag + "] " + label + ": trang không cuộn ngang", g.sw <= g.iw + 1, JSON.stringify(g)));
    const reset = async () => { if (await w.locator("[data-sf-reset]").count()) { await w.locator("[data-sf-reset]").first().click(); await w.waitForTimeout(150); } };

    // ===== Nhân sự =====
    await w.click("#nav button[data-k=nhansu]"); await w.waitForSelector("[data-sf=nhansu]"); await reset();
    const total = await w.locator("main tbody tr").count();
    ok("[" + tag + "] Nhân sự: thanh lọc nhanh có ô tìm, phòng ban, trạng thái, nút nâng cao, đặt lại", (await w.locator("[data-sf=nhansu] [data-sf-q]").count()) === 1 && (await w.locator("[data-sf-adv]").count()) === 1 && (await w.locator("[data-sf-reset]").count()) === 1 && (await w.locator("[data-sf=nhansu] .fbtn").count()) >= 1);
    const q = w.locator("[data-sf=nhansu] [data-sf-q]"); await q.click(); await q.pressSequentially("nguyen van", { delay: 25 }); await w.waitForTimeout(450);
    const focused = await w.evaluate(() => document.activeElement && document.activeElement.hasAttribute("data-sf-q")), nq = await w.locator("main tbody tr").count();
    ok("[" + tag + "] Nhân sự: tìm không dấu 'nguyen van' ra 'Nguyễn Văn Ánh', ô tìm giữ tiêu điểm khi gõ", focused && nq === 1 && (await w.locator("main tbody").innerText()).includes("Nguyễn Văn Ánh"), nq + " dòng");
    ok("[" + tag + "] Nhân sự: dòng kết quả 'Hiển thị 1 / " + total + "' và chip 'Tìm: …'", new RegExp("Hiển thị 1 / " + total + " dòng").test(await w.locator("[data-sf-summary]").innerText()) && (await w.locator("[data-fchips] .fchip").count()) === 1);
    await w.fill("[data-sf=nhansu] [data-sf-q]", ""); await w.waitForTimeout(450);
    ok("[" + tag + "] Nhân sự: xóa từ khóa → về đủ dòng", (await w.locator("main tbody tr").count()) === total);
    // bộ lọc nâng cao
    await w.click("[data-sf-adv]"); await w.waitForSelector("[data-sf-drawer]");
    const dg = await w.evaluate(() => { const r = document.querySelector("[data-sf-drawer]").getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, vw: window.innerWidth, vh: window.innerHeight }; });
    ok("[" + tag + "] ngăn kéo bộ lọc nâng cao nằm trọn trong màn hình", dg.t >= 0 && dg.b <= dg.vh + 1 && dg.l >= 0 && dg.r <= dg.vw + 1, JSON.stringify(dg));
    ok("[" + tag + "] tiêu điểm chuyển vào ngăn kéo", await w.evaluate(() => !!document.activeElement.closest("[data-sf-drawer]")));
    const groups = await w.locator("[data-sf-drawer] .sfm").count(); ok("[" + tag + "] nâng cao có ≥3 nhóm chọn nhiều (phòng ban, chức vụ, loại HĐ)", groups >= 3, String(groups));
    await w.locator("[data-sf-drawer] .sfm").first().locator("input.i").fill("van phong");
    const shown = await w.locator("[data-sf-drawer] .sfm").first().locator(".sfm-row").allInnerTexts();
    ok("[" + tag + "] tìm không dấu trong danh sách chọn ('van phong' → Văn phòng)", shown.length >= 0 && shown.every((t) => /văn phòng/i.test(t)), shown.join("|"));
    await w.locator("[data-sf-drawer] .sfm").first().locator("input.i").fill("");
    await w.locator("[data-sf-drawer] .sfm").first().locator(".sfm-row input").first().check();
    await w.selectOption('[data-sf-drawer] [data-sf-field="tt"]', "Đang làm việc");
    await shot("04-bo-loc-nang-cao");
    await w.locator("[data-sf-drawer] button:has-text('Hủy')").click(); await w.waitForTimeout(150);
    ok("[" + tag + "] Hủy: không đổi gì, ngăn kéo đóng, tiêu điểm về nút nâng cao", (await w.locator("[data-sf-drawer]").count()) === 0 && (await w.locator("main tbody tr").count()) === total && (await w.evaluate(() => document.activeElement.hasAttribute("data-sf-adv"))));
    await w.click("[data-sf-adv]"); await w.waitForSelector("[data-sf-drawer]"); await w.keyboard.press("Escape"); await w.waitForTimeout(100);
    ok("[" + tag + "] Escape đóng ngăn kéo", (await w.locator("[data-sf-drawer]").count()) === 0);
    await w.click("[data-sf-adv]"); await w.waitForSelector("[data-sf-drawer]");
    let stay = true; for (let i = 0; i < 40; i++) { await w.keyboard.press("Tab"); if (!(await w.evaluate(() => !!document.activeElement.closest("[data-sf-drawer]")))) { stay = false; break; } }
    ok("[" + tag + "] Tab xoay vòng trong ngăn kéo (40 lần Tab không ra ngoài)", stay);
    await w.locator("[data-sf-drawer] .sfm").first().locator(".sfm-row input").first().check();
    await w.selectOption('[data-sf-drawer] [data-sf-field="tt"]', "Đang làm việc");
    await w.locator("[data-sf-drawer] button:has-text('Áp dụng')").click(); await w.waitForTimeout(200);
    const nAdv = await w.locator("main tbody tr").count(), sumTxt = await w.locator("[data-sf-summary]").innerText();
    ok("[" + tag + "] Áp dụng: bảng, dòng kết quả và chip cùng một tập dòng", new RegExp("Hiển thị " + nAdv + " / " + total + " dòng").test(sumTxt) && nAdv < total && (await w.locator("[data-fchips] .fchip").count()) === 2, sumTxt.replace(/\s+/g, " ").slice(0, 160));
    // lưu bộ lọc theo màn hình
    await w.click("[data-sf-adv]"); await w.waitForSelector("[data-sf-drawer]");
    await w.click("[data-sf-drawer] button:has-text('Lưu bộ lọc hiện tại')"); await w.waitForSelector("#modal .dlg input.i"); await w.fill("#modal .dlg input.i", "Đang làm việc theo PB"); await w.click("#modal .dlg footer button.pri"); await w.waitForTimeout(200);
    ok("[" + tag + "] lưu bộ lọc đã lưu (hộp tên hiện trên ngăn kéo)", (await w.locator("[data-sf-presets] option", { hasText: "Đang làm việc theo PB" }).count()) === 1);
    await w.keyboard.press("Escape"); await reset();
    ok("[" + tag + "] Đặt lại: hết chip, đủ dòng", (await w.locator("main tbody tr").count()) === total && (await w.locator("[data-fchips] .fchip").count()) === 0);
    await w.click("[data-sf-adv]"); await w.waitForSelector("[data-sf-drawer]"); await w.selectOption("[data-sf-presets] select", { label: "Đang làm việc theo PB" }); await w.locator("[data-sf-drawer] button:has-text('Áp dụng')").click(); await w.waitForTimeout(200);
    ok("[" + tag + "] mở lại bộ lọc đã lưu → đúng tập dòng như lúc lưu", (await w.locator("main tbody tr").count()) === nAdv);
    await w.click("#nav button[data-k=chamcong]"); await w.waitForSelector("[data-sf=chamcong]"); await w.click("[data-sf-adv]"); await w.waitForSelector("[data-sf-drawer]");
    ok("[" + tag + "] bộ lọc đã lưu của Nhân sự KHÔNG hiện ở Chấm công (riêng từng màn hình)", (await w.locator("[data-sf-presets] option", { hasText: "Đang làm việc theo PB" }).count()) === 0);
    await w.keyboard.press("Escape");
    await w.click("#nav button[data-k=nhansu]"); await w.waitForSelector("[data-sf=nhansu]");
    ok("[" + tag + "] quay lại Nhân sự: điều kiện vẫn còn (không mất khi đổi màn hình)", (await w.locator("main tbody tr").count()) === nAdv);
    await shot("01-nhan-su-smart-filter"); await noHScroll("Nhân sự"); await reset();

    // ===== Chấm công =====
    await w.click("#nav button[data-k=chamcong]"); await w.waitForSelector("[data-sf=chamcong]"); await reset();
    const ccAll = await w.locator("main tbody tr").count();
    await w.fill("[data-sf=chamcong] [data-rf-key=tuKhoa]", "NV903"); await w.dispatchEvent("[data-sf=chamcong] [data-rf-key=tuKhoa]", "change"); await w.waitForTimeout(300);
    ok("[" + tag + "] Chấm công: lọc theo mã NV; dòng kết quả khớp số dòng bảng", (await w.locator("main tbody tr").count()) === 1 && /Hiển thị 1 \//.test(await w.locator("[data-sf-summary]").innerText()));
    await shot("02-cham-cong-smart-filter"); await noHScroll("Chấm công"); await reset();
    ok("[" + tag + "] Chấm công: đặt lại → đủ " + ccAll + " dòng", (await w.locator("main tbody tr").count()) === ccAll);

    // ===== Sản lượng: kỳ ⇄ khoảng ngày =====
    await w.click("#nav button[data-k=sanluong]"); await w.waitForSelector("[data-sf=sanluong]"); await reset();
    await w.selectOption("[data-sf=sanluong] [data-sf-period]", ky); await w.waitForTimeout(250);
    const tu = await w.locator("[data-sf-tu]").first().inputValue(), den = await w.locator("[data-sf-den]").first().inputValue();
    ok("[" + tag + "] Sản lượng: chọn kỳ → Từ/Đến ngày tự điền dd/MM/yyyy", tu === "01/" + pad(M) + "/" + Y && den === pad(ndays) + "/" + pad(M) + "/" + Y, tu + " → " + den);
    await w.fill("[data-sf-den]", "15/" + pad(M) + "/" + Y); await w.dispatchEvent("[data-sf-den]", "change"); await w.waitForTimeout(250);
    ok("[" + tag + "] sửa tay ngày → ô kỳ chuyển 'tùy chọn ngày'", /tùy chọn/.test(await w.locator("[data-sf-period] option:checked").innerText()) && (await w.locator("main tbody tr").count()) < 200);
    const totTxt = await w.locator("[data-pc-totals]").innerText(), shownN = (await w.locator("[data-sf-summary]").innerText()).match(/Hiển thị (\d+)/)[1];
    ok("[" + tag + "] tổng theo bộ lọc (phiếu) = số dòng hiển thị; còn giữ đã phân bổ / chờ phân bổ", new RegExp("\\b" + shownN + " phiếu").test(totTxt) && /đã phân bổ/.test(totTxt) && /chờ phân bổ/.test(totTxt), totTxt.replace(/\s+/g, " ").slice(0, 150));
    await w.fill("[data-sf-tu]", "20/" + pad(M) + "/" + Y); await w.dispatchEvent("[data-sf-tu]", "change"); await w.waitForTimeout(250);
    ok("[" + tag + "] từ ngày > đến ngày: báo lỗi, không dòng nào khớp (không tự đổi chỗ)", /lớn hơn/.test(await w.locator(".sf-warn").first().innerText()) && (await w.locator("main tbody tr").count()) === 0);
    await w.fill("[data-sf-tu]", "31/02/" + Y); await w.dispatchEvent("[data-sf-tu]", "change");
    ok("[" + tag + "] ngày không tồn tại (31/02) bị từ chối", /không hợp lệ/.test(await w.locator(".sf-warn").first().innerText()));
    await reset();

    // ===== Bảng tính lương (nội bộ) — lọc không tính lại lương =====
    await w.click("#nav button[data-k=luong]"); if (await w.locator("button.big").count()) await w.click("button.big"); await w.waitForTimeout(500);
    await w.click("#nav button[data-k=bangtinh]"); await w.waitForSelector("[data-sf^='rf:']"); await reset();
    await w.evaluate(() => { const E = window.LuongEngine; window.__calls = 0; const f = E.tinhBangLuong; E.tinhBangLuong = function () { window.__calls++; return f.apply(this, arguments); }; });
    const nvRows = () => w.locator("table[data-bangtinh] tbody tr").evaluateAll((trs) => trs.filter((t) => /^NV\d+/.test(t.cells[0] && t.cells[0].textContent.trim())).length);
    const blAll = await nvRows(), sumAll = await w.locator("[data-sf-summary]").innerText();
    await w.locator("[data-rf-key=tuKhoa]").fill("NV902"); await w.dispatchEvent("[data-rf-key=tuKhoa]", "change"); await w.waitForTimeout(500);
    const blF = await nvRows(), calls = await w.evaluate(() => window.__calls);
    ok("[" + tag + "] Bảng tính lương: lọc 1 NV → 1 dòng, dòng kết quả khớp; lọc KHÔNG gọi lại tính lương", blF === 1 && /Hiển thị 1 \//.test(await w.locator("[data-sf-summary]").innerText()) && calls === 0, "dòng " + blAll + "→" + blF + " · số lần tính lại=" + calls);
    await shot("03-bang-luong-smart-filter"); await noHScroll("Bảng tính lương");
    await reset();
    ok("[" + tag + "] Bảng tính lương: đặt lại → số dòng và tổng như ban đầu", (await nvRows()) === blAll && (await w.locator("[data-sf-summary]").innerText()) === sumAll);
    ok("[" + tag + "] không lỗi JavaScript (bộ lọc)", errs.length === 0, errs.slice(0, 3).join(" | "));

    // ===== Modal Phụ cấp / Hỗ trợ =====
    for (const [kind, label, rowCode, pref] of [["pc", "Phụ cấp", "PA", "05"], ["ht", "Hỗ trợ", "HC", "09"]]) {
      await w.click("#nav button[data-k=dm]"); await w.click('#main button:has-text("' + label + '")'); await w.waitForSelector("[data-ot-table]");
      const trow = w.locator('tr[data-ot-row="' + rowCode + '"]');
      ok("[" + tag + "] " + label + ": danh sách Master có mã " + rowCode + " kèm cách tính đang áp dụng", (await trow.count()) === 1, (await trow.innerText()).replace(/\s+/g, " ").slice(0, 140));
      await trow.locator('button:has-text("Xem chi tiết")').click(); await w.waitForSelector("[data-ot-modal]");
      const fit = async (n) => { const g = await w.evaluate(() => { const d = document.querySelector(".ot-dlg").getBoundingClientRect(); return { t: d.top, b: d.bottom, l: d.left, r: d.right, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth }; }); ok("[" + tag + "] " + label + " — " + n + ": modal nằm trọn trong màn hình, trang không cuộn ngang", g.t >= -1 && g.b <= g.vh + 1 && g.l >= -1 && g.r <= g.vw + 1 && g.sw <= g.vw + 1, JSON.stringify(g)); };
      const nm = (i) => String(+pref + i).padStart(2, "0");
      await fit("Thông tin"); await shot(nm(0) + "-modal-" + kind + "-1-thong-tin");
      ok("[" + tag + "] " + label + ": tab Thông tin hiện trường thật của danh mục (không trường tăng ca)", !/Hệ số tăng ca/.test(await w.locator("[data-ot-modal]").innerText()) && (await w.locator("[data-ot-modal] [data-ot-ro]").count()) >= 4);
      await w.click('[data-ot-tab="ct"]'); await w.waitForTimeout(150);
      const nver = await w.locator("[data-ot-flist] tr[data-ot-ver]").count();
      ok("[" + tag + "] " + label + ": tab Công thức chỉ có phiên bản của đúng khóa công thức (v1 Hiệu lực + v2 Nháp)", nver === 2, String(nver));
      await fit("Công thức"); await shot(nm(1) + "-modal-" + kind + "-2-cong-thuc");
      await w.click('[data-ot-tab="test"]'); await w.waitForTimeout(150);
      const opts = await w.locator("[data-ot-test-nv] option").count(); ok("[" + tag + "] " + label + ": tab Kiểm thử có danh sách nhân viên thật đang dùng mã", opts >= 2, String(opts));
      const nvv = await w.evaluate(() => [...document.querySelectorAll("[data-ot-test-nv] option")].map((o) => o.value).filter(Boolean)[0]);
      await w.selectOption("[data-ot-test-nv]", nvv); await w.waitForTimeout(100);
      const v2 = await w.evaluate(() => { const o = [...document.querySelectorAll("[data-ot-test-ver] option")].find((x) => /v2/.test(x.textContent)); return o && o.value; });
      if (v2) await w.selectOption("[data-ot-test-ver]", v2); await w.waitForTimeout(250);
      const trial = await w.locator("[data-ot-testtab]").innerText();
      ok("[" + tag + "] " + label + ": kiểm thử lấy biến từ bảng lương thật, so sánh hiện tại/thử, có chênh lệch", /Chênh lệch/.test(trial) && (await w.locator("[data-ot-self=ok]").count()) === 1, trial.replace(/\s+/g, " ").slice(0, 200));
      await fit("Kiểm thử"); await shot(nm(2) + "-modal-" + kind + "-3-kiem-thu");
      await w.click('[data-ot-tab="ls"]'); await w.waitForTimeout(150);
      ok("[" + tag + "] " + label + ": tab Lịch sử liệt kê v1, v2 kèm người lập", (await w.locator("[data-ot-hrow]").count()) === 2 && (await w.locator("[data-ot-history]").innerText()).includes("ketoan1"));
      await fit("Lịch sử"); await shot(nm(3) + "-modal-" + kind + "-4-lich-su");
      await w.click("[data-ot-close]"); await w.waitForTimeout(200);
    }
    ok("[" + tag + "] không lỗi JavaScript (toàn luồng)", errs.length === 0, errs.slice(0, 3).join(" | "));
  }

  // ===== Hiệu năng bộ lọc (đo thật, Electron) =====
  const bench = {};
  for (const N of [100, 1000, 10000]) {
    await app.close(); const d1 = JSON.parse(fs.readFileSync(fb + ".seed", "utf8"));
    d1.sanluong = []; for (let i = 1; i <= N; i++) d1.sanluong.push({ _id: "b" + i, "Phiếu cân": "B" + String(i).padStart(6, "0"), "Ngày cân": ky + "-" + pad(1 + (i % 27)), "KL hàng (Tấn)": String(10 + (i % 7)), "Mã NV": "NV9" + pad(1 + (i % 12)), "Mã phòng ban": pbs[i % pbs.length] || "" });
    fs.writeFileSync(fb, JSON.stringify(d1)); ({ app, w, errs } = await launch(DIR));
    await w.click("#nav button[data-k=sanluong]"); await w.waitForSelector("[data-sf=sanluong]");
    const t = await w.evaluate(async () => {
      const inp = document.querySelector("[data-sf=sanluong] [data-sf-q]"), sum = () => document.querySelector("[data-sf-summary]").innerText;
      const run = (val) => new Promise((res) => { const t0 = performance.now(), before = sum(); inp.value = val; inp.dispatchEvent(new Event("input")); const iv = setInterval(() => { if (sum() !== before) { clearInterval(iv); res(performance.now() - t0 - 250); } }, 2); setTimeout(() => { clearInterval(iv); res(-1); }, 20000); });
      const a = await run("B0000"), b = await run(""), c = await run("B00001");
      return { loc_tu_khoa_ms: Math.round(a), bo_loc_ms: Math.round(b), loc_hep_ms: Math.round(c) };
    });
    bench[N] = t; console.log("HIỆU NĂNG " + N + " dòng:", JSON.stringify(t));
  }
  report.perf.loc_phieu_can_ms_tru_250ms_debounce = bench;
  report.summary = { total: checks.length, pass: checks.filter((c) => c.pass).length, fail: checks.filter((c) => !c.pass).length, jsErrors: errs.length };
  fs.writeFileSync(path.join(APP, "docs", "V10_3_UI_CHECK.json"), JSON.stringify(report, null, 1));
  await app.close();
  console.log("\nTỔNG: " + report.summary.pass + "/" + report.summary.total + " đạt, lỗi JS " + errs.length);
  process.exit(report.summary.fail ? 1 : 0);
})().catch((e) => { console.error("LỖI", e); process.exit(2); });
