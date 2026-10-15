// V10.3 (đợt chỉnh theo góp ý) — Báo cáo lương: Bảng tổng hợp lương (nhóm theo phòng ban), Phiếu lương 3 phần, Khấu trừ thuế TNCN, bảng tính lương giao diện tối, Từ–Đến mặc định theo kỳ. Dữ liệu GIẢ LẬP.
/* global document, getComputedStyle */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const ELECTRON = process.env.ELECTRON_PATH || require("electron");
const APP = path.resolve(__dirname, "../..");
const OUT = process.env.E2E_SHOTS || path.join(APP, "docs", "v10_3_screens", "reports");
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


  const shot = async (n) => { fs.mkdirSync(OUT, { recursive: true }); await w.screenshot({ path: path.join(OUT, n + ".png") }); };
  const lum = (c) => { const m = String(c).match(/\d+(\.\d+)?/g) || []; return m.length >= 3 ? (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) : -1; };
  await w.setViewportSize({ width: 1600, height: 900 }).catch(() => {});
  // --- Bảng tổng hợp lương
  await w.click("#nav button[data-k=rp_tonghop]"); await w.waitForSelector("[data-pay-report]");
  const heads = await w.locator("[data-pay-report] th").allInnerTexts();
  ok("Bảng tổng hợp lương: đủ cột theo mẫu (STT…Thực lĩnh kỳ này)", ["STT", "Mã NV", "Họ và tên", "Phòng ban", "Chức vụ", "Tổng thu nhập", "BH trừ NLĐ", "KPCĐ trừ NLĐ", "Truy thu BH", "Thuế TNCN", "Trừ khác", "Tạm ứng", "Thực lĩnh kỳ này"].every((x, i) => heads[i] === x), heads.join("|"));
  const flatRows = await w.locator("[data-pay-report] tbody tr").count(); await shot("01-tong-hop-luong-khong-nhom");
  await w.check("[data-th-nhom]"); await w.waitForTimeout(500);
  const grp = await w.locator("[data-pay-report] td.td-grp").allInnerTexts(), sums = await w.locator("[data-pay-report] tr.tr-sum").allInnerTexts();
  ok("Nhóm theo phòng ban: có dòng nhóm và dòng 'Cộng <phòng ban>' từng nhóm + tổng cộng", grp.length >= 2 && sums.filter((x) => /^\s*Cộng /m.test(x) || /\tCộng /.test(x) || /Cộng /.test(x)).length >= grp.length && /TỔNG CỘNG/.test(sums[sums.length - 1]), grp.join(" ; ") + " | " + sums.length);
  ok("Nhóm theo phòng ban: số dòng tăng thêm tiêu đề + cộng nhóm", (await w.locator("[data-pay-report] tbody tr").count()) === flatRows + 2 * grp.length, flatRows + " → " + (await w.locator("[data-pay-report] tbody tr").count()));
  await shot("02-tong-hop-luong-nhom-phong-ban");
  // --- bảng tính lương, giao diện tối
  await w.click("#nav button[data-k=bangtinh]"); await w.waitForSelector("[data-bangtinh]");
  const dark = await w.evaluate(() => document.documentElement.getAttribute("data-theme") === "dark");
  if (!dark) { await w.click('button:has-text("Giao diện")'); await w.waitForTimeout(300); }
  await w.click("#nav button[data-k=bangtinh]"); await w.waitForSelector("[data-bangtinh] td.td-grp");
  const gc = await w.evaluate(() => { const e = document.querySelector("[data-bangtinh] td.td-grp"), s = document.querySelector("[data-bangtinh] tr.tr-sum td"); const a = getComputedStyle(e), b = getComputedStyle(s); return { gbg: a.backgroundColor, gfg: a.color, sbg: b.backgroundColor, sfg: b.color, dark: document.documentElement.getAttribute("data-theme") }; });
  ok("Bảng tính lương (giao diện tối): tiêu đề nhóm và dòng cộng đọc được (nền tối, chữ sáng)", gc.dark === "dark" && lum(gc.gbg) < 90 && lum(gc.gfg) > 160 && lum(gc.sbg) < 90 && lum(gc.sfg) > 160, JSON.stringify(gc));
  await shot("03-bang-tinh-luong-toi");
  // --- Phiếu lương
  await w.click("#nav button[data-k=slips]"); await w.waitForSelector("[data-slips]");
  const slip = await w.locator("[data-slips] .slip").first().innerText();
  ok("Phiếu lương chia phần: I. THU NHẬP · II. KHẤU TRỪ · III. TẠM ỨNG · THỰC LĨNH", /I\. THU NHẬP/.test(slip) && /Tổng thu nhập/.test(slip) && /II\. KHẤU TRỪ/.test(slip) && /III\. TẠM ỨNG/.test(slip) && /THỰC LĨNH/.test(slip), slip.replace(/\s+/g, " ").slice(0, 220));
  await shot("04-phieu-luong-3-phan");
  // --- Khấu trừ thuế TNCN
  await w.click("#nav button[data-k=rp_tncn]"); await w.waitForSelector("[data-pay-report]");
  const th = await w.locator("[data-pay-report] th").allInnerTexts();
  ok("Báo cáo khấu trừ thuế TNCN: đủ cột theo mẫu", ["STT", "Mã số thuế", "Họ và tên", "Phòng ban", "Chức vụ", "Mã TNCN", "Tổng thu nhập", "Phụ cấp ăn ca (tiền cơm)", "Khấu trừ bảo hiểm", "Khấu trừ KPCĐ", "Khấu trừ người phụ thuộc", "Thuế TNCN khấu trừ"].every((x, i) => th[i] === x), th.join("|"));
  await shot("05-khau-tru-thue-tncn");
  // --- Nghiệp vụ nhân sự: Từ–Đến mặc định theo kỳ
  await w.click("#nav button[data-k=nvns]"); await w.waitForSelector('input[aria-label="Từ ngày"]');
  const tu = await w.inputValue('input[aria-label="Từ ngày"]'), den = await w.inputValue('input[aria-label="Đến ngày"]');
  ok("Nghiệp vụ nhân sự: Từ–Đến mặc định = ngày đầu và cuối kỳ đang chọn", tu === "01/" + pad(M) + "/" + Y && den === pad(ndays) + "/" + pad(M) + "/" + Y, tu + " → " + den);
  const sty = await w.evaluate(() => { const a = getComputedStyle(document.querySelector('input[aria-label="Từ ngày"]')), b = getComputedStyle(document.querySelector("#main select")); return { ar: a.borderRadius, br: b.borderRadius, ab: a.backgroundColor, bb: b.backgroundColor }; });
  ok("Ô ngày cùng kiểu với ô chọn khác (bo góc, nền)", sty.ar === sty.br && sty.ab === sty.bb, JSON.stringify(sty));
  await shot("06-nghiep-vu-nhan-su-tu-den");
  ok("không lỗi JavaScript", errs.length === 0, errs.slice(0, 3).join(" | "));
  await app.close();
  const bad = checks.filter((c) => !c.pass).length; console.log(bad ? "FAILED " + bad : "ALL PASS"); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
