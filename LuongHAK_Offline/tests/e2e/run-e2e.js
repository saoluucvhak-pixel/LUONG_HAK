// Kiểm thử end-to-end trên ứng dụng Electron thật (bản đóng gói chạy từ mã nguồn).
// Chạy: ELECTRON_PATH=<đường dẫn electron> PLAYWRIGHT_MODULE=<đường dẫn playwright> node tests/e2e/run-e2e.js
// (Linux không màn hình: xvfb-run -a node tests/e2e/run-e2e.js)
/* global document */ // dùng trong các hàm w.evaluate(...) chạy bên trong cửa sổ app
// Dùng thư mục dữ liệu tạm (biến HAK_USER_DATA) — không đụng dữ liệu thật.
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const ELECTRON = process.env.ELECTRON_PATH || require("electron");
const APP = path.resolve(__dirname, "../..");
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "hak-e2e-"));
const DL = path.join(DATA, "downloads"); fs.mkdirSync(DL);
const results = [];
function ok(name, cond, extra) { results.push({ name, pass: !!cond, extra: extra || "" }); console.log((cond ? "PASS " : "FAIL ") + name + (extra ? " — " + extra : "")); }

async function launch(dataDir) {
  const app = await _electron.launch({ executablePath: ELECTRON, args: ["--no-sandbox", APP], env: Object.assign({}, process.env, { HAK_USER_DATA: dataDir || DATA, HAK_DOWNLOAD_DIR: DL }) });
  const w = await app.firstWindow(); const errs = [];
  w.on("pageerror", (e) => errs.push(e.message));
  w.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  w.on("dialog", (d) => d.accept(d.type() === "prompt" ? "e2e" : undefined));
  await w.waitForSelector("#main > *");
  return { app, w, errs };
}

(async () => {
  const t0 = Date.now();
  let { app, w, errs } = await launch();
  ok("Mở ứng dụng", true, (Date.now() - t0) + " ms");
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
  await w.waitForTimeout(800);
  ok("Không có lỗi JavaScript (lần chạy 1)", errs.length === 0, errs.join(" | "));
  await app.close();

  // dữ liệu đã nằm trong file
  const file = path.join(DATA, "data.json"), saved = JSON.parse(fs.readFileSync(file, "utf8"));
  ok("data.json có nhân viên + kỳ đã chốt v2 + lịch sử v1", saved.nhanvien.length === 1 && saved.kyluong.length === 1 && saved.kyluong[0].checksum && saved.kyluong[0].version === 2 && saved.kyluong_lichsu.length === 1 && saved.kyluong_lichsu[0].moChot.lyDo === "Kiểm thử mở chốt");
  ok("Lương thỏa thuận lưu đúng 12000000", saved.chitiethd[0]["Lương thỏa thuận"] === "12000000", saved.chitiethd[0]["Lương thỏa thuận"]);
  const bks = fs.readdirSync(path.join(DATA, "backups"));
  ok("Có bản sao lưu tự động (đầu ngày + trước mở chốt)", bks.some((f) => /^daily_/.test(f)) && bks.some((f) => /^truoc-mo-chot_/.test(f)), bks.join(", "));

  // mở lại
  ({ app, w, errs } = await launch());
  await w.click("#nav button[data-k=kyluong]");
  const ky = await w.locator("main tbody tr").first().innerText();
  ok("Mở lại app: kỳ đã chốt còn nguyên, checksum Nguyên vẹn", /Tháng 9\/2026/.test(ky) && /Nguyên vẹn/.test(ky), ky.replace(/\t/g, " | "));
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
  const pre = ob.filter((f) => /^truoc-nang-cap_/.test(f))[0];
  ok("Nâng cấp 1.3→1.4: có bản sao lưu trước nâng cấp chứa nguyên trạng", !!pre && JSON.parse(fs.readFileSync(path.join(OLD, "backups", pre), "utf8")).psluong[0]["Thưởng"] === "500.000", ob.join(", "));
  ok("Nâng cấp: tiền '500.000' → 500000, ngày → ISO, CCCD bù số 0, schemaVersion 2", up.psluong[0]["Thưởng"] === "500000" && up.psluong[0]["Ngày hạch toán"] === "2026-09-28" && up.nhanvien[0]["Số CCCD"] === "049090001234" && up.schemaVersion === 2);
  ok("Nâng cấp: kỳ đã chốt kiểu cũ giữ nguyên", up.kyluong.length === 1 && up.kyluong[0].kq.bangluong[0]["Thực lĩnh"] === 1000000);
  ({ app, w, errs } = await launch(OLD)); await w.waitForTimeout(400);
  const ob2 = fs.readdirSync(path.join(OLD, "backups")).filter((f) => /^truoc-nang-cap_/.test(f));
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
