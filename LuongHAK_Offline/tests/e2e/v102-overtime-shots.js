// V10.2 — Duyệt thật trên Electron: Danh mục tăng ca Master–Detail + Form Modal, ở 1366×768 và 1920×1080.
// Chụp ảnh sản phẩm thật (không phải hình minh họa), kiểm tra modal không tràn màn hình, không lỗi JS, cảnh báo chưa lưu, lọc/tìm kiếm,
// kiểm thử công thức trên dữ liệu chấm công thật (công Chủ nhật tự động), quy trình Gửi duyệt → Duyệt → Kích hoạt (đóng ngày bản cũ), liên kết dữ liệu cũ.
// Dữ liệu 100% GIẢ LẬP. Chạy: xvfb-run -a node tests/e2e/v102-overtime-shots.js   (ảnh: docs/v10_2_screens/<WxH>/ ; báo cáo: docs/V10_2_UI_CHECK.json)
/* global document, performance, Event */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const ELECTRON = process.env.ELECTRON_PATH || require("electron");
const APP = path.resolve(__dirname, "../..");
const OUT = process.env.E2E_SHOTS || path.join(APP, "docs", "v10_2_screens");
const SIZES = [[1366, 768], [1920, 1080]];
const ADMIN = { u: "admin", n: "Quản trị E2E", p: "Admin2026e2e" };
const checks = [];
const ok = (name, cond, extra) => { checks.push({ name, pass: !!cond, extra: extra || "" }); console.log((cond ? "PASS " : "FAIL ") + name + (extra ? " — " + String(extra).slice(0, 160) : "")); };

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
  const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "hak-v102-"));
  let { app, w, errs, dialogs } = await launch(DIR);
  await w.click("#nav button[data-k=backup]"); await w.click('button:has-text("Nạp danh mục chuẩn HAK")'); await w.waitForTimeout(300);
  await app.close();
  const fb = path.join(DIR, "data.json"), db = JSON.parse(fs.readFileSync(fb, "utf8")), now = new Date(), Y = now.getFullYear(), M = now.getMonth() + 1, ky = Y + "-" + ("0" + M).slice(-2);
  const ndays = new Date(Y, M, 0).getDate(), pad = (n) => ("0" + n).slice(-2);
  const sundays = []; for (let d = 1; d <= ndays; d++) if (new Date(Y, M - 1, d).getDay() === 0) sundays.push(d);
  // mã tăng ca bổ sung (cha) để danh sách có nhiều trạng thái
  db.dm_tangca.push({ _id: "tx1", "Mã tăng ca": "TC7", "Nội dung tăng ca": "Tăng ca 7 (dùng chung công thức TC1)", "Hệ số tăng ca": "2", "Loại công thức": "TC1", "Hiệu lực từ": "2024-01-01" },
    { _id: "tx2", "Mã tăng ca": "TC_CU", "Nội dung tăng ca": "Tăng ca cũ đã ngừng", "Hệ số tăng ca": "1.5", "Hiệu lực từ": "2022-01-01", "Hiệu lực đến": "2023-12-31" });
  const dongTC = (id, ma, code, tc, lg) => ({ _id: id, "Mã NV": ma, "Số HĐLĐ": ma + "/HĐ", "Hiệu lực từ": "2026-01-01", "Mã lương": code, "Lương thỏa thuận": String(lg), "Tăng ca": tc, "HTTT": "Chuyển khoản" });
  const list = [["NV001", "Nguyễn Văn An", "TG1", "TC3", 8200000], ["NV002", "Trần Thị Bình", "TG1", "TC5", 7800000], ["NV003", "Lê Văn Cường", "TG1", "TC3", 9000000], ["NV004", "Phạm Thị Dung", "TG1", "TC1", 8500000]];
  list.forEach(([ma, ten, code, tc, lg], i) => {
    db.nhanvien.push({ _id: "n" + i, "Mã NV": ma, "Họ và tên": ten, "Trạng thái": "Đang làm việc" });
    db.hopdong.push({ _id: "h" + i, "Mã NV": ma, "Số HĐLĐ": ma + "/HĐ", "Hình thức HĐLĐ": "Xác định thời hạn", "Ngày vào làm": "2026-01-01" });
    db.chitiethd.push(dongTC("p" + i, ma, code, tc, lg));
    const bt = { "Kỳ": ky, "Mã NV": ma, "Hình thức công": "BT" }, tcr = { "Kỳ": ky, "Mã NV": ma, "Hình thức công": "TC" };
    for (let d = 1; d <= Math.min(ndays, 25); d++) { if (new Date(Y, M - 1, d).getDay() !== 0) bt[pad(d)] = "1"; }
    if (ma === "NV001" || ma === "NV003") sundays.slice(0, 2).forEach((d) => { bt[pad(d)] = "1"; }); // chỉ 2 Chủ nhật có công — không phải mọi Chủ nhật
    [1, 2, 3].forEach((d) => { tcr[pad(d)] = "1"; });
    db.chamcong.push(bt, tcr);
  });
  // NV003: có mã tăng ca nhưng không có chấm công kỳ này
  db.chamcong = db.chamcong.filter((r) => r["Mã NV"] !== "NV003");
  db.dm_congthuc = [
    { _id: "f1", "Mã công thức": "TC3", "Tên công thức": "Tăng ca 3 — theo quy chế 2026", "Loại": "OVERTIME", "Biểu thức": "(CONG_TC + CONG_CHU_NHAT) * HE_SO_TC", "Trạng thái": "Hiệu lực", "Phiên bản": 1, "Hiệu lực từ": "2026-01-01", "Người lập": "ketoan1", "Ngày lập": "2026-01-02T01:00:00.000Z", "Người duyệt": "sep1", "Thời điểm duyệt": "2026-01-03T01:00:00.000Z", "Người kích hoạt": "admin", "Thời điểm kích hoạt": "2026-01-04T01:00:00.000Z" },
    { _id: "f2", "Mã công thức": "TC3", "Tên công thức": "Tăng ca 3 — không tính Chủ nhật (đề xuất)", "Loại": "OVERTIME", "Biểu thức": "CONG_TC * HE_SO_TC", "Trạng thái": "Nháp", "Phiên bản": 2, "Hiệu lực từ": ky + "-01", "Người lập": "ketoan1", "Ngày lập": "2026-10-10T01:00:00.000Z" },
    { _id: "f3", "Mã công thức": "ZZ_CU", "Tên công thức": "Công thức tăng ca cũ chưa có mã cha", "Loại": "OVERTIME", "Biểu thức": "CONG_TC * HE_SO_TC", "Trạng thái": "Ngừng", "Phiên bản": 1, "Hiệu lực từ": "2020-01-01" }
  ];
  db.dm_congthuc.forEach((r) => { if (r["Hiệu lực từ"].length === 7) r["Hiệu lực từ"] += "-01"; });
  fs.writeFileSync(fb, JSON.stringify(db));
  fs.copyFileSync(fb, fb + ".seed");
  ({ app, w, errs, dialogs } = await launch(DIR));
  const report = { generated: new Date().toISOString(), sizes: SIZES.map((s) => s.join("x")), checks, perf: {}, summary: {} };

  for (const [W, H] of SIZES) {
    if (W !== SIZES[0][0]) { await app.close(); fs.copyFileSync(fb + ".seed", fb); ({ app, w, errs, dialogs } = await launch(DIR)); }
    const tag = W + "x" + H, dir = path.join(OUT, tag); fs.mkdirSync(dir, { recursive: true });
    await app.evaluate(({ BrowserWindow }, [ww, hh]) => { const win = BrowserWindow.getAllWindows()[0]; win.setContentSize(ww, hh); }, [W, H]);
    await w.waitForTimeout(400);
    const shot = async (name) => { await w.waitForTimeout(150); await w.screenshot({ path: path.join(dir, name + ".png") }); };
    const geo = () => w.evaluate(() => { const d = document.querySelector(".ot-dlg"); if (!d) return null; const r = d.getBoundingClientRect(), b = d.querySelector(".ot-body"); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, vw: window.innerWidth, vh: window.innerHeight, bodyOverX: b ? b.scrollWidth - b.clientWidth : 0, pageOverX: document.documentElement.scrollWidth - window.innerWidth }; });
    const fits = async (label) => { const g = await geo(); ok("[" + tag + "] " + label + ": modal nằm trọn trong màn hình, không tràn ngang", g && g.top >= -1 && g.bottom <= g.vh + 1 && g.left >= -1 && g.right <= g.vw + 1 && g.bodyOverX <= 2 && g.pageOverX <= 2, JSON.stringify(g)); };
    const openTab = async (t) => { await w.click('[data-ot-tab="' + t + '"]'); await w.waitForTimeout(150); };

    // --- danh sách ---
    await w.click("#nav button[data-k=dm]"); await w.click('#main button:has-text("Tăng ca")'); await w.waitForSelector("[data-ot-table]");
    const nRows = await w.locator("[data-ot-row]").count();
    const tc3 = await w.locator('tr[data-ot-row="TC3"]').innerText(), tc7 = await w.locator('tr[data-ot-row="TC7"]').innerText();
    ok("[" + tag + "] danh sách Master: đủ mã tăng ca, TC3 có công thức cấu hình, TC7 dùng chung công thức TC1", nRows >= 7 && /v\d/.test(tc3) && /dùng chung công thức TC1/.test(tc7), nRows + " | " + tc3.replace(/\s+/g, " ").slice(0, 120));
    await shot("01-danh-sach-tang-ca");
    await w.fill("[data-ot-q]", "TC3"); await w.waitForTimeout(100);
    ok("[" + tag + "] tìm kiếm lọc ngay trong danh sách", (await w.locator("[data-ot-row]").count()) === 1);
    await w.fill("[data-ot-q]", ""); await w.selectOption("[data-ot-ftrang]", "Hết hiệu lực"); await w.waitForTimeout(100);
    ok("[" + tag + "] lọc 'Hết hiệu lực' còn mã đã ngừng", (await w.locator('tr[data-ot-row="TC_CU"]').count()) === 1 && (await w.locator('tr[data-ot-row="TC3"]').count()) === 0);
    await w.selectOption("[data-ot-ftrang]", ""); await w.waitForTimeout(100);

    // --- modal: thông tin (xem) ---
    const t0 = Date.now(); await w.click('tr[data-ot-row="TC3"] button:has-text("Xem chi tiết")'); await w.waitForSelector("[data-ot-modal]"); report.perf["mo_modal_ms_" + tag] = Date.now() - t0;
    ok("[" + tag + "] modal chế độ XEM: trường chỉ đọc, không có ô nhập", (await w.locator("[data-ot-modal] [data-ot-ro]").count()) >= 6 && (await w.locator("[data-ot-modal] [data-ot-f]").count()) === 0);
    await fits("tab Thông tin (xem)"); await shot("02-modal-thong-tin-xem");
    await w.click("[data-ot-edit-info]"); await w.fill('[data-ot-f="heSo"]', "-3"); await w.dispatchEvent('[data-ot-f="heSo"]', "input");
    ok("[" + tag + "] sửa thông tin: hệ số sai hiện lỗi ngay", (await w.locator(".ot-err").count()) >= 1);
    await fits("tab Thông tin (sửa, có lỗi)"); await shot("03-modal-thong-tin-sua-loi");
    w.__dlgMode = "dismiss"; dialogs.length = 0; await w.click("[data-ot-close]");
    ok("[" + tag + "] đóng khi chưa lưu: cảnh báo, chọn Hủy thì modal vẫn mở", dialogs.some((m) => /CHƯA LƯU/.test(m)) && (await w.locator("[data-ot-modal]").count()) === 1);
    w.__dlgMode = "accept";
    await w.click("[data-ot-save-info]"); await w.waitForTimeout(150);
    ok("[" + tag + "] Lưu khi còn lỗi: vẫn ở chế độ sửa, không ghi", (await w.locator("[data-ot-save-info]").count()) === 1);
    await w.click('footer button:has-text("Hủy")'); await w.waitForTimeout(150);
    ok("[" + tag + "] Hủy sửa: về chế độ xem", (await w.locator("[data-ot-edit-info]").count()) === 1);

    // --- tab công thức ---
    await openTab("ct"); await fits("tab Công thức tính");
    ok("[" + tag + "] danh sách con chỉ có phiên bản của TC3", (await w.locator("[data-ot-flist] tr[data-ot-ver]").count()) === 2 && (await w.locator('tr[data-ot-ver="ZZ_CU#1"]').count()) === 0);
    await shot("04-cong-thuc-danh-sach");
    await w.click('tr[data-ot-ver="TC3#1"] button:has-text("Xem công thức")'); await w.waitForSelector("[data-ot-designer=view]");
    ok("[" + tag + "] xem công thức: biểu thức kỹ thuật, giải thích tiếng Việt, thư viện biến", (await w.locator("[data-ot-tech]").innerText()).includes("CONG_CHU_NHAT") && (await w.locator("[data-ot-explain]").innerText()).length > 10 && (await w.locator("[data-ot-vars] tr").count()) >= 6);
    await fits("trình thiết kế (xem)"); await shot("05-thiet-ke-xem");
    await w.click('button:has-text("Về danh sách phiên bản")');
    await w.click('tr[data-ot-ver="TC3#2"] button:has-text("Sửa nháp")'); await w.waitForSelector("[data-ot-designer=edit]");
    ok("[" + tag + "] bản Nháp: công thức gốc đang áp dụng hiện để đối chiếu", (await w.locator(".ot-origin").innerText()).includes("CONG_CHU_NHAT"));
    await w.click('button:has-text("Xóa hết")');
    const tplVal = await w.evaluate(() => { const o = [...document.querySelectorAll("[data-ot-tpl] option")].find((x) => x.value !== "" && !/^\[Tham/.test(x.textContent)); return o.value; });
    await w.selectOption("[data-ot-tpl]", tplVal); await w.waitForTimeout(150);
    const chips = await w.locator(".ot-chip").count();
    ok("[" + tag + "] thiết kế trực quan: chọn mẫu → chip, cú pháp OK", chips > 2 && (await w.locator("[data-ot-syntax=ok]").count()) === 1, String(chips));
    await fits("trình thiết kế (trực quan)"); await shot("06-thiet-ke-truc-quan");
    await w.click('[data-ot-mode="adv"]'); await w.waitForSelector("[data-ot-expr]");
    const tg0 = await w.evaluate(() => { const ta = document.querySelector("[data-ot-expr]"); const t = performance.now(); ta.value = "CONG_TC * HE_SO_TC"; ta.dispatchEvent(new Event("input")); return performance.now() - t; });
    report.perf["go_ky_tu_ms_" + tag] = Math.round(tg0 * 10) / 10;
    ok("[" + tag + "] gõ biểu thức chỉ cập nhật phân tích, dưới 50ms", tg0 < 50, String(tg0));
    await w.fill("[data-ot-expr]", "CONG_TC * HE_SO_TCC");
    ok("[" + tag + "] biến ngoài thư viện bị báo ngay", (await w.locator("[data-ot-syntax=bad]").count()) === 1);
    await w.fill("[data-ot-expr]", "CONG_TC * HE_SO_TC"); await shot("07-thiet-ke-nang-cao");
    await w.click("[data-ot-save-formula]"); await w.waitForTimeout(300);
    ok("[" + tag + "] lưu nháp sửa: vẫn v2 Nháp, không tạo bản thừa", (await w.locator("[data-ot-flist] tr[data-ot-ver]").count()) === 2 && (await w.locator('tr[data-ot-ver="TC3#2"]').innerText()).includes("Nháp"));

    // --- tab kiểm thử thực tế ---
    await openTab("test"); await fits("tab Kiểm thử (trống)");
    await w.selectOption("[data-ot-test-nv]", "NV001"); await w.waitForTimeout(100);
    const v2id = await w.evaluate(() => [...document.querySelectorAll("[data-ot-test-ver] option")].find((o) => /v2/.test(o.textContent)).value);
    await w.selectOption("[data-ot-test-ver]", v2id); await w.waitForTimeout(200);
    const bang = await w.locator("[data-ot-trial]").innerText();
    ok("[" + tag + "] kiểm thử NV001: công Chủ nhật tự lấy từ chấm công, so sánh cũ/mới, có dòng chênh lệch", /Công Chủ nhật/.test(bang) && (await w.locator('[data-ot-trow="Chênh lệch"]').count()) === 1, bang.replace(/\s+/g, " ").slice(0, 260));
    ok("[" + tag + "] công thức hiện hành tái lập đúng tiền tăng ca engine", (await w.locator("[data-ot-self=ok]").count()) === 1);
    await fits("tab Kiểm thử (so sánh)"); await shot("08-kiem-thu-thuc-te");
    await w.fill("[data-ot-case-name]", "NV001 — bỏ công Chủ nhật"); await w.click('button:has-text("Lưu thành ca kiểm thử")'); await w.waitForTimeout(300);
    ok("[" + tag + "] lưu ca kiểm thử và chạy lại đạt", /\d+\/\d+ ca đạt/.test(await w.locator("[data-ot-saved]").innerText()));
    const nv3 = await w.locator('[data-ot-test-nv] option[value="NV003"]').count();
    if (nv3) { await w.selectOption("[data-ot-test-nv]", "NV003"); await w.waitForTimeout(200); ok("[" + tag + "] NV003 không chấm công → 'Chưa có dữ liệu'", /Chưa có dữ liệu/.test(await w.locator("[data-ot-testtab]").innerText())); }
    else ok("[" + tag + "] NV003 không có dữ liệu kỳ này → không nằm trong danh sách chọn (không hiện số 0 giả)", true);
    await w.selectOption("[data-ot-test-nv]", "NV002").catch(() => {}); await w.waitForTimeout(100);

    // --- tab lịch sử ---
    await openTab("ls"); await fits("tab Lịch sử phiên bản");
    ok("[" + tag + "] lịch sử: v1, v2 kèm người lập/duyệt", (await w.locator("[data-ot-history]").innerText()).includes("ketoan1") && (await w.locator("[data-ot-hrow]").count()) === 2);
    await shot("09-lich-su-phien-ban");

    // --- duyệt & kích hoạt (một lần) ---
    if (W === SIZES[0][0]) {
      await openTab("ct");
      await w.click('tr[data-ot-ver="TC3#2"] button[data-ot-to="Chờ duyệt"]'); await w.waitForTimeout(500);
      if (!(await w.locator('tr[data-ot-ver="TC3#2"] button[data-ot-to="Đã duyệt"]').count())) console.log("DEBUG hàng:", (await w.locator('tr[data-ot-ver="TC3#2"]').innerText()).replace(/\s+/g, " "), "| dialogs:", dialogs.slice(-3).join(" // "), "| disk:", JSON.stringify(JSON.parse(fs.readFileSync(fb, "utf8")).dm_congthuc.filter((r) => r._id === "f2").map((r) => [r["Trạng thái"], r["Người lập"], r["Phiên bản"]])), "| errs:", errs.slice(-3).join("//"), "| toast:", await w.evaluate(() => (document.querySelector("#toast")||{}).textContent));
      await w.click('tr[data-ot-ver="TC3#2"] button[data-ot-to="Đã duyệt"]'); await w.waitForTimeout(300);
      await w.click('tr[data-ot-ver="TC3#2"] button[data-ot-to="Hiệu lực"]'); await w.waitForSelector("[data-ot-act]");
      const ptxt = await w.locator("[data-ot-act]").innerText();
      ok("[" + tag + "] kích hoạt: kiểm tra trước nêu cú pháp, chia 0, chồng hiệu lực", /Cú pháp|cú pháp/.test(ptxt) && /chồng|đóng ngày/i.test(ptxt), ptxt.replace(/\s+/g, " ").slice(0, 400));
      await fits("khung kích hoạt"); await shot("10-kich-hoat-kiem-tra-truoc");
      await w.click("[data-ot-act-ok]"); await w.waitForTimeout(200);
      ok("[" + tag + "] kích hoạt thiếu lý do bị chặn", (await w.locator('tr[data-ot-ver="TC3#2"]').innerText()).includes("Đã duyệt"));
      await w.fill("[data-ot-reason]", "Áp dụng quy chế mới từ kỳ này"); await w.click("[data-ot-act-ok]"); await w.waitForTimeout(400);
      const v2 = await w.locator('tr[data-ot-ver="TC3#2"]').innerText();
      const dsk = JSON.parse(fs.readFileSync(fb, "utf8"));
      const r1 = dsk.dm_congthuc.find((r) => r._id === "f1"), r2 = dsk.dm_congthuc.find((r) => r._id === "f2");
      ok("[" + tag + "] v2 Hiệu lực; v1 được đóng ngày trước ngày hiệu lực v2 (đã ghi xuống đĩa)", v2.includes("Hiệu lực") && !!r1["Hiệu lực đến"] && r2["Trạng thái"] === "Hiệu lực" && r1["Hiệu lực đến"] < r2["Hiệu lực từ"], JSON.stringify({ den1: r1["Hiệu lực đến"], tu2: r2["Hiệu lực từ"] }));
      ok("[" + tag + "] v1 lịch sử còn nguyên biểu thức", r1["Biểu thức"] === "(CONG_TC + CONG_CHU_NHAT) * HE_SO_TC");
    }
    await w.click('[data-ot-close]'); await w.waitForTimeout(250);

    // --- liên kết dữ liệu cũ ---
    await w.click('[data-ot-master] button:has-text("Liên kết công thức cũ")'); await w.waitForSelector("[data-ot-linkdlg]");
    const lk = await w.locator("[data-ot-link]").innerText();
    ok("[" + tag + "] hộp liên kết: nêu công thức không có mã cha (ZZ_CU)", lk.includes("ZZ_CU"), lk.replace(/\s+/g, " ").slice(0, 200));
    await shot("11-lien-ket-du-lieu-cu");
    await w.click("[data-ot-linkdlg] footer button:has-text('Đóng')"); await w.waitForTimeout(200);
    ok("[" + tag + "] không lỗi JavaScript trong luồng", errs.length === 0, errs.slice(0, 3).join(" | "));
  }
  // áp dụng liên kết thật một lần và kiểm tra toàn vẹn trên đĩa
  await w.click('[data-ot-master] button:has-text("Liên kết công thức cũ")'); await w.waitForSelector("[data-ot-linkdlg]");
  const beforeDisk = JSON.parse(fs.readFileSync(fb, "utf8")).dm_congthuc;
  const btn = w.locator("[data-ot-linkdlg] footer button.pri"); if (await btn.count()) { await btn.click(); await w.waitForTimeout(400); }
  const afterDisk = JSON.parse(fs.readFileSync(fb, "utf8")).dm_congthuc;
  const diffKeys = []; beforeDisk.forEach((b) => { const a = afterDisk.find((x) => x._id === b._id); Object.keys(b).forEach((k) => { if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) diffKeys.push(b["Mã công thức"] + ":" + k); }); });
  ok("liên kết dữ liệu cũ thật: mọi trường gốc giữ nguyên, TC3 được gắn cha, ZZ_CU không bị gắn", diffKeys.length === 0 && afterDisk.filter((r) => r["Mã tăng ca cha"] === "TC3").length === 2 && !afterDisk.find((r) => r._id === "f3")["Mã tăng ca cha"], diffKeys.join(","));
  report.summary = { total: checks.length, pass: checks.filter((c) => c.pass).length, fail: checks.filter((c) => !c.pass).length, jsErrors: errs.length };
  fs.writeFileSync(path.join(APP, "docs", "V10_2_UI_CHECK.json"), JSON.stringify(report, null, 1));
  await app.close();
  console.log("\nTỔNG: " + report.summary.pass + "/" + report.summary.total + " đạt, lỗi JS " + errs.length);
  process.exit(report.summary.fail ? 1 : 0);
})().catch((e) => { console.error("LỖI", e); process.exit(2); });
