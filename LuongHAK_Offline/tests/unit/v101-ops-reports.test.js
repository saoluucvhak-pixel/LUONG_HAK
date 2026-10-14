// V10.1 — mẫu báo cáo riêng: nhân sự, sản lượng, bơm dăm, thưởng/trừ, tạm ứng, suất cơm. Dữ liệu giả lập, không dùng dữ liệu thật.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const X = require("../../exceljs.min.js");
const E = require("../../engine.js");
const HR = require("../../hr.js");
const FX = require("../fixtures/build.js");
const OPS = require("../../core/reporting/ops-reports.js");
const RX = require("../../ui/report-xlsx.js");
const RH = require("../../core/reporting/report-html.js");

const PB1 = "01.01", PB2 = "02.01";
function mkDb() {
  const db = FX.baseDb();
  [["NV001", "Nguyễn Văn A", PB1], ["NV002", "Trần Thị B", PB1], ["NV003", "Lê Văn C", PB2], ["NV004", "Phạm Văn D", PB2]].forEach(([ma, ten, pb], i) => {
    db.nhanvien.push({ "Mã NV": ma, "Họ và tên": ten, "Trạng thái": ma === "NV004" ? "Đã nghỉ việc" : "Đang làm việc" });
    db.hopdong.push({ "Mã NV": ma, "Số HĐLĐ": ma + "/HĐ01", "Ngày vào làm": "2025-0" + (i + 1) + "-01", "Hình thức HĐLĐ": "Xác định thời hạn", "Ngày hết hạn": ma === "NV002" ? "2026-01-31" : "2027-12-31", "Ngày chấm dứt": ma === "NV004" ? "2026-08-15" : "" });
    db.chitiethd.push({ "Mã NV": ma, "Số HĐLĐ": ma + "/HĐ01", "Hiệu lực từ": "2025-01-01", "Phòng ban": pb, "Chức vụ": "8", "Vị trí việc làm": "Công nhân", "Lương thỏa thuận": "9999999" });
    db.canhan.push({ "Mã NV": ma, "Hiệu lực từ": "2025-01-01", "Giới tính": i % 2 ? "Nữ" : "Nam", "Ngày sinh": "1990-0" + (i + 1) + "-15", "Số CCCD": "079000000" + i });
  });
  return db;
}
const tenPB = (db, ma) => (db.dm_phongban.find((p) => p["Mã phòng ban"] === ma) || {})["Tên phòng ban"];
const base = (db, extra) => Object.assign({ nam: 2026, thang: 9, tenCongTy: "CÔNG TY TEST", ngay: "01/10/2026", nguoiLap: "ketoan", hr: HR, num: E.num, money: E.money, homNay: "2026-10-14" }, extra || {});

test("U-OPS-01 NHÂN SỰ: mẫu riêng, không lộ CCCD/lương, mặc định bỏ người đã nghỉ, cảnh báo HĐ quá hạn", () => {
  const db = mkDb(), vm = OPS.build("NHAN_SU", db, base(db));
  assert.equal(vm.title, "DANH SÁCH NHÂN SỰ");
  assert.equal(vm.rows.length, 3); assert.equal(vm.soDongGoc, 4);
  assert.deepEqual(vm.rows.map((r) => r["Mã NV"]), ["NV001", "NV002", "NV003"]);
  const labels = vm.cols.map((c) => c.label).join("|");
  assert.ok(!/CCCD|tài khoản|Lương|thuế/i.test(labels), labels);
  assert.equal(vm.rows[0]["Phòng ban"], tenPB(db, PB1));
  assert.equal(vm.rows[0]["Ngày vào làm"], "2025-01-01");
  assert.ok(vm.canhbao.some((m) => /NV002/.test(m) && /quá hạn/.test(m)), vm.canhbao.join("|"));
  assert.equal(vm.tongNhan, "TỔNG CỘNG: 3 người");
  assert.deepEqual(vm.thongKe, { dang: 3, nghi: 1 });
  // trạng thái "nghỉ" và "tất cả"
  assert.equal(OPS.build("NHAN_SU", db, base(db, { trangThaiNV: "nghi" })).rows.length, 1);
  assert.equal(OPS.build("NHAN_SU", db, base(db, { trangThaiNV: "tatca" })).rows.length, 4);
  // lọc phòng ban + từ khóa
  assert.equal(OPS.build("NHAN_SU", db, base(db, { phongBan: tenPB(db, PB2) })).rows.length, 1);
  assert.deepEqual(OPS.build("NHAN_SU", db, base(db, { tuKhoa: "tran thi" })).rows.map((r) => r["Mã NV"]), ["NV002"]);
  // nhóm cột phủ đủ cột, liền nhau
  assert.equal(vm.groups[vm.groups.length - 1].to, vm.cols.length - 1);
});

test("U-OPS-02 SẢN LƯỢNG: bảng kê phiếu cân + tổng hợp theo tổ/công nhân; phiếu chưa gán và trùng số phiếu bị cảnh báo; Mã NV lạ / KL âm chặn xuất", () => {
  const db = mkDb();
  db.sanluong.push(
    { "Phiếu cân": "P1", "Ngày cân": "2026-09-02", "Biển số": "43C-1", "KL hàng (Tấn)": "28,345", "Mã NV": "NV001" },
    { "Phiếu cân": "P2", "Ngày cân": "2026-09-03", "Biển số": "43C-2", "KL hàng (Tấn)": "30", "Mã phòng ban": PB1 },
    { "Phiếu cân": "P3", "Ngày cân": "2026-09-04", "KL hàng (Tấn)": "10" },
    { "Phiếu cân": "P1", "Ngày cân": "2026-09-05", "KL hàng (Tấn)": "5", "Mã NV": "NV003" },
    { "Phiếu cân": "PX", "Ngày cân": "2026-08-30", "KL hàng (Tấn)": "99", "Mã NV": "NV001" });
  const vm = OPS.build("SAN_LUONG", db, base(db));
  assert.equal(vm.title, "BẢNG KÊ PHIẾU CÂN SẢN LƯỢNG");
  assert.equal(vm.rows.length, 4, "phiếu tháng 8 không thuộc kỳ");
  assert.equal(vm.tong["KL hàng (Tấn)"], 73.345);
  assert.equal(vm.rows[0]["Cách giao"], "Giao trực tiếp"); assert.equal(vm.rows[0]["Người nhận"], "Nguyễn Văn A");
  assert.equal(vm.rows[1]["Cách giao"], "Chia theo tổ");
  assert.equal(vm.rows[2]["Cách giao"], "Chưa gán");
  assert.ok(vm.canhbao.some((m) => /P3.*chưa gán/.test(m)));
  assert.ok(vm.canhbao.some((m) => /'P1'.*nhiều lần/.test(m)));
  assert.equal(vm.loi.length, 0);
  assert.deepEqual(vm.extras.map((e) => e.name), ["TheoTo", "TheoCongNhan"]);
  assert.equal(vm.extras[1].rows.length, 2); // NV001 + NV003 (chỉ phiếu giao trực tiếp khi chưa có phân bổ tổ)
  // lỗi chặn
  db.sanluong.push({ "Phiếu cân": "P9", "Ngày cân": "2026-09-06", "KL hàng (Tấn)": "-3", "Mã NV": "NV999" });
  const bad = OPS.build("SAN_LUONG", db, base(db));
  assert.ok(bad.loi.some((m) => /khối lượng âm/.test(m)) && bad.loi.some((m) => /NV999.*không có trong hồ sơ/.test(m)), bad.loi.join("|"));
});

test("U-OPS-03 SẢN LƯỢNG: kết quả chia tổ của app (alloc) được đưa vào cột Người nhận / Mỗi người và sheet theo công nhân", () => {
  const db = mkDb();
  db.sanluong.push({ "Phiếu cân": "P2", "Ngày cân": "2026-09-03", "Biển số": "43C-2", "KL hàng (Tấn)": "30", "Mã phòng ban": PB1 });
  const alloc = { audit: [{ phieu: "P2", ngay: "2026-09-03", maPB: PB1, kl: 30, soNguoi: 2, share: 15, names: ["Nguyễn Văn A", "Trần Thị B"], note: "" }],
    byEmp: { NV001: { ma: "NV001", hoTen: "Nguyễn Văn A", maPB: PB1, total: 15, byDay: { 3: 15 } }, NV002: { ma: "NV002", hoTen: "Trần Thị B", maPB: PB1, total: 15, byDay: { 3: 15 } } }, warnings: ["Tổ X: tên vắng không khớp"] };
  const vm = OPS.build("SAN_LUONG", db, base(db, { alloc }));
  assert.equal(vm.rows[0]["Số người nhận"], 2); assert.equal(vm.rows[0]["Mỗi người"], 15); assert.equal(vm.rows[0]["Người nhận"], "Nguyễn Văn A, Trần Thị B");
  assert.deepEqual(vm.extras[1].rows.map((r) => r["KL hàng (Tấn)"]), [15, 15]);
  assert.equal(vm.extras[1].tong["KL hàng (Tấn)"], 30);
  assert.ok(vm.canhbao.includes("Tổ X: tên vắng không khớp"));
});

test("U-OPS-04 BƠM DĂM: đơn vị là số xe, tiêu đề riêng, không lẫn với sản lượng", () => {
  const db = mkDb();
  db.bandam.push({ "Phiếu cân": "B1", "Ngày cân": "2026-09-10", "KL hàng (Tấn)": "1", "Mã NV": "NV003" }, { "Phiếu cân": "B2", "Ngày cân": "2026-09-11", "KL hàng (Tấn)": "2", "Mã NV": "NV003" });
  db.sanluong.push({ "Phiếu cân": "S1", "Ngày cân": "2026-09-10", "KL hàng (Tấn)": "50", "Mã NV": "NV001" });
  const vm = OPS.build("BOM_DAM", db, base(db));
  assert.equal(vm.title, "BẢNG KÊ BƠM DĂM"); assert.ok(vm.cols.some((c) => c.label === "Số xe")); assert.ok(!vm.cols.some((c) => c.label === "KL hàng (Tấn)"));
  assert.equal(vm.tong["Số xe"], 3); assert.equal(vm.rows.length, 2);
});

test("U-OPS-05 THƯỞNG / TRỪ: thực nhận = thưởng + thu nhập khác − trừ; tổng hợp theo NV; số âm / Mã NV lạ chặn xuất; lệch bảng lương cảnh báo", () => {
  const db = mkDb();
  db.psluong.push(
    { "Ngày hạch toán": "2026-09-30", "Số chứng từ": "QĐ-1", "Mã NV": "NV001", "Diễn giải": "Chuyên cần", "Thưởng": 500000, "Thu nhập khác": 100000, "Trừ khác": 50000 },
    { "Ngày hạch toán": "2026-09-15", "Số chứng từ": "QĐ-2", "Mã NV": "NV001", "Diễn giải": "Lễ", "Thưởng": "200.000", "Thu nhập khác": 0, "Trừ khác": 0 },
    { "Ngày hạch toán": "2026-10-01", "Số chứng từ": "QĐ-3", "Mã NV": "NV001", "Thưởng": 999 });
  const bl = [{ "Mã NV": "NV001", "Thưởng": 700000, "Thu nhập khác": 100000, "Trừ khác": 40000 }];
  const vm = OPS.build("THUONG", db, base(db, { bangluong: bl }));
  assert.equal(vm.rows.length, 2); assert.deepEqual(vm.rows.map((r) => r["Số chứng từ"]), ["QĐ-2", "QĐ-1"]); // theo ngày
  assert.deepEqual([vm.tong["Thưởng"], vm.tong["Thu nhập khác"], vm.tong["Trừ khác"], vm.tong["Thực nhận"]], [700000, 100000, 50000, 750000]);
  assert.equal(vm.rows[1]["Thực nhận"], 550000);
  assert.equal(vm.extras[0].rows.length, 1); assert.equal(vm.extras[0].rows[0]["Số chứng từ"], 2); assert.equal(vm.extras[0].tong["Thực nhận"], 750000);
  assert.ok(vm.canhbao.some((m) => /Trừ khác.*50\.000.*40\.000/.test(m)), vm.canhbao.join("|"));
  db.psluong.push({ "Ngày hạch toán": "2026-09-20", "Số chứng từ": "QĐ-5", "Mã NV": "NV001", "Thưởng": "năm trăm" });
  assert.ok(OPS.build("THUONG", db, base(db)).loi.some((m) => /QĐ-5.*không phải số/.test(m)), "chữ trong ô tiền phải báo lỗi, không âm thầm coi là 0");
  db.psluong.pop();
  db.psluong.push({ "Ngày hạch toán": "2026-09-20", "Số chứng từ": "QĐ-4", "Mã NV": "NV777", "Thưởng": -5 });
  const bad = OPS.build("THUONG", db, base(db));
  assert.ok(bad.loi.some((m) => /âm/.test(m)) && bad.loi.some((m) => /NV777/.test(m)));
});

test("U-OPS-06 TẠM ỨNG: có cột ký nhận, tổng hợp theo NV, đối chiếu với bảng lương; tạm ứng vượt thu nhập / lệch bảng lương cảnh báo", () => {
  const db = mkDb();
  db.ungluong.push({ "Ngày hạch toán": "2026-09-05", "Số chứng từ": "PC-1", "Mã NV": "NV001", "Diễn giải": "Kỳ 1", "Tạm ứng": 2000000 }, { "Ngày hạch toán": "2026-09-20", "Số chứng từ": "PC-2", "Mã NV": "NV001", "Diễn giải": "Kỳ 2", "Tạm ứng": 1000000 },
    { "Ngày hạch toán": "2026-09-21", "Số chứng từ": "PC-3", "Mã NV": "NV003", "Tạm ứng": 800000 });
  const bl = [{ "Mã NV": "NV001", "Tổng thu nhập": 2500000, "Thực lĩnh": 0, "Tạm ứng": 3000000 }, { "Mã NV": "NV003", "Tổng thu nhập": 9000000, "Thực lĩnh": 8000000, "Tạm ứng": 500000 }];
  const vm = OPS.build("TAM_UNG", db, base(db, { bangluong: bl }));
  assert.equal(vm.title, "BẢNG KÊ TẠM ỨNG LƯƠNG"); assert.ok(vm.cols.some((c) => c.label === "Ký nhận")); assert.equal(vm.chuKy.length, 4);
  assert.equal(vm.tong["Tạm ứng"], 3800000);
  const ex = vm.extras[0]; assert.equal(ex.rows[0]["Số lần ứng"], 2); assert.equal(ex.rows[0]["Tổng tạm ứng"], 3000000); assert.equal(ex.rows[0]["Thực lĩnh (bảng lương)"], 0);
  assert.ok(vm.canhbao.some((m) => /NV001.*vượt tổng thu nhập/.test(m)));
  assert.ok(vm.canhbao.some((m) => /NV003.*≠ bảng lương/.test(m)));
  assert.ok(!vm.canhbao.some((m) => /NV001.*≠ bảng lương/.test(m)));
  // đang lọc → không so với bảng lương (tổng chưa đủ)
  assert.ok(!OPS.build("TAM_UNG", db, base(db, { bangluong: bl, tuKhoa: "NV003" })).canhbao.some((m) => /≠ bảng lương/.test(m)));
});

test("U-OPS-07 SUẤT CƠM: ma trận nhân viên × ngày của đúng tháng, cộng các dòng cùng ngày, tổng khớp engine, cảnh báo vượt ngưỡng", () => {
  const db = mkDb();
  db.tiencom.push({ "Ngày": "2026-09-01", "Mã NV": "NV001", "Số suất cơm": 1 }, { "Ngày": "2026-09-01", "Mã NV": "NV001", "Số suất cơm": 1, "Ghi chú": "ăn thêm" }, { "Ngày": "2026-09-30", "Mã NV": "NV001", "Số suất cơm": 1 },
    { "Ngày": "2026-09-15", "Mã NV": "NV003", "Số suất cơm": 5 }, { "Ngày": "2026-10-01", "Mã NV": "NV003", "Số suất cơm": 1 });
  const vm = OPS.build("SUAT_COM", db, base(db));
  assert.equal(vm.cols.length, 4 + 30 + 2, "tháng 9 có 30 ngày");
  assert.equal(vm.rows.length, 2);
  const a = vm.rows.find((r) => r["Mã NV"] === "NV001");
  assert.equal(a["01"], 2); assert.equal(a["30"], 1); assert.equal(a["02"], ""); assert.equal(a["Tổng suất"], 3); assert.equal(a["Ghi chú"], "ăn thêm");
  // cùng tổng với engine.tinhBangLuong dùng (tiencom → Số suất cơm theo kỳ)
  const eng = {}; db.tiencom.filter((r) => /^2026-09/.test(r["Ngày"])).forEach((r) => { eng[r["Mã NV"]] = (eng[r["Mã NV"]] || 0) + E.num(r["Số suất cơm"]); });
  vm.rows.forEach((r) => assert.equal(r["Tổng suất"], eng[r["Mã NV"]]));
  assert.equal(vm.tong["Tổng suất"], 8); assert.equal(vm.tong["15"], 5);
  assert.ok(vm.canhbao.some((m) => /NV003 ngày 15.*vượt ngưỡng 3/.test(m)));
  assert.ok(!OPS.build("SUAT_COM", db, base(db, { nguongSuatNgay: 10 })).canhbao.some((m) => /vượt ngưỡng/.test(m)));
  assert.equal(OPS.build("SUAT_COM", db, base(db, { thang: 2 })).cols.length, 4 + 28 + 2, "tháng 2/2026 có 28 ngày");
  assert.equal(vm.groups.reduce((a2, g) => a2 + (g.to - g.from + 1), 0), vm.cols.length);
});

test("U-OPS-08 Excel: mỗi loại ra file đúng mẫu — tiêu đề IN HOA, nhóm cột, chữ ký riêng, nhiều sheet, KL 3 số lẻ, ngày thật dd/mm/yyyy, Mã NV là chữ", async () => {
  const db = mkDb();
  db.sanluong.push({ "Phiếu cân": "P1", "Ngày cân": "2026-09-02", "KL hàng (Tấn)": "28,345", "Mã NV": "NV001" });
  const vm = OPS.build("SAN_LUONG", db, base(db));
  const wb = RX.buildMany(X, OPS.sheetVms(vm), {});
  assert.equal(wb.worksheets.length, 3); assert.deepEqual(wb.worksheets.slice(1).map((w) => w.name), ["TheoTo", "TheoCongNhan"]); assert.ok(wb.worksheets[0].name.length <= 31);
  const ws = wb.worksheets[0];
  assert.equal(ws.getCell("A2").value, vm.title); assert.equal(ws.getCell("A1").value, "CÔNG TY TEST");
  // hàng nhóm cột + hàng tiêu đề
  let hr = 0; ws.eachRow((row, i) => { if (!hr && row.getCell(1).value === "STT") hr = i; });
  assert.ok(hr > 0 && String(ws.getCell(hr - 1, 1).value) === "PHIẾU CÂN");
  const colKL = vm.cols.findIndex((c) => c.label === "KL hàng (Tấn)") + 1;
  assert.equal(ws.getCell(hr + 1, colKL).value, 28.345); assert.equal(ws.getCell(hr + 1, colKL).numFmt, "#,##0.000");
  assert.ok(ws.getCell(hr + 1, 2).value instanceof Date); assert.equal(ws.getCell(hr + 1, 2).numFmt, "dd/mm/yyyy");
  assert.equal(ws.getCell(hr + 1, vm.cols.findIndex((c) => c.label === "Mã NV") + 1).numFmt, "@");
  assert.equal(ws.getCell(hr + 2, 1).value, "TỔNG CỘNG");
  const sig = []; ws.eachRow((row) => row.eachCell((c) => { if (["Người lập", "Nhân viên cân", "Trưởng bộ phận", "Giám đốc"].includes(c.value) && !sig.includes(c.value)) sig.push(c.value); }));
  assert.deepEqual(sig, ["Người lập", "Nhân viên cân", "Trưởng bộ phận", "Giám đốc"]);
  // round-trip ghi/đọc file
  const buf = await wb.xlsx.writeBuffer(); const wb2 = new X.Workbook(); await wb2.xlsx.load(buf); assert.equal(wb2.worksheets.length, 3);
});

test("U-OPS-09 Excel nhân sự + suất cơm: tổng nhân sự là chữ, ma trận 36 cột in khổ rộng và lặp cột nhận diện", () => {
  const db = mkDb(); db.tiencom.push({ "Ngày": "2026-09-01", "Mã NV": "NV001", "Số suất cơm": 1 });
  const ns = OPS.build("NHAN_SU", db, base(db)), wsN = RX.buildMany(X, OPS.sheetVms(ns), {}).worksheets[0];
  let tot = null; wsN.eachRow((row) => { if (/^TỔNG CỘNG: /.test(String(row.getCell(1).value))) tot = row.getCell(1).value; });
  assert.equal(tot, "TỔNG CỘNG: 3 người");
  const cm = OPS.build("SUAT_COM", db, base(db)), ws = RX.buildMany(X, OPS.sheetVms(cm), {}).worksheets[0];
  assert.equal(ws.pageSetup.paperSize, 8); assert.ok(ws.pageSetup.fitToWidth >= 2); assert.equal(ws.pageSetup.printTitlesColumn, "A:C");
});

test("U-OPS-10 PDF: bảng rộng tách phần và lặp cột nhận diện; chữ ký riêng; chuỗi nguy hiểm bị escape", () => {
  const db = mkDb();
  db.tiencom.push({ "Ngày": "2026-09-01", "Mã NV": "NV001", "Số suất cơm": 1, "Ghi chú": "<script>alert(1)</script>" });
  const vm = OPS.build("SUAT_COM", db, base(db)), html = RH.sheets({ title: vm.title, ky: vm.kyText, congTy: vm.congTy, sheets: OPS.toSheets(vm) }, { chuKy: vm.chuKy });
  assert.ok(!/<script>alert/.test(html)); assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Phần 1\/\d/); assert.match(html, /Người chấm cơm/);
  assert.ok((html.match(/<th[^>]*>Họ và tên<\/th>/g) || []).length >= 3, "cột Họ và tên lặp ở mỗi phần");
  const tong = OPS.toRows(vm); assert.equal(tong[tong.length - 1]["STT"], "TỔNG CỘNG");
});

test("U-OPS-11 báo cáo nhân sự có sẵn (hết hạn HĐ, biến động…) đi qua mẫu chung: STT, tổng, chữ ký, tên IN HOA", () => {
  const rows = [{ "Mã NV": "NV001", "Họ và tên": "A", "Còn (ngày)": 5 }, { "Mã NV": "NV002", "Họ và tên": "B", "Còn (ngày)": 9 }, { "Mã NV": "TỔNG", "Họ và tên": "", "Còn (ngày)": 14 }];
  const vm = OPS.fromRows("HĐLĐ sắp hết hạn", rows, { tenCongTy: "CT", kyText: "x" });
  assert.equal(vm.title, "HĐLĐ SẮP HẾT HẠN"); assert.equal(vm.rows.length, 2); assert.equal(vm.cols[0].label, "STT"); assert.equal(vm.tong["Còn (ngày)"], 14);
  assert.equal(vm.rows[1].STT, 2); assert.equal(vm.cols.find((c) => c.label === "Mã NV").kind, "text");
  assert.equal(RX.build(X, vm, { chuKy: vm.chuKy }).worksheets[0].getCell("A2").value, "HĐLĐ SẮP HẾT HẠN");
  assert.equal(OPS.fromRows("rỗng", [], {}).soDong, 0);
});

test("U-OPS-12 an toàn: ô bắt đầu bằng = + - @ trong diễn giải được vô hiệu hóa công thức; build không sửa db đầu vào", () => {
  const db = mkDb();
  db.ungluong.push({ "Ngày hạch toán": "2026-09-05", "Số chứng từ": "PC-1", "Mã NV": "NV001", "Diễn giải": "=HYPERLINK(\"http://x\")", "Tạm ứng": 1000 });
  const snap = JSON.stringify(db), vm = OPS.build("TAM_UNG", db, base(db));
  assert.equal(JSON.stringify(db), snap, "không đổi dữ liệu gốc");
  const ws = RX.buildMany(X, OPS.sheetVms(vm), {}).worksheets[0]; let found = null; ws.eachRow((row) => row.eachCell((c) => { if (/HYPERLINK/.test(String(c.value))) found = String(c.value); }));
  assert.equal(found[0], "'");
  assert.throws(() => OPS.build("KHONG_CO", db, base(db)), /không hợp lệ/);
  assert.throws(() => OPS.build("SUAT_COM", db, { hr: HR }), /Thiếu kỳ/);
});
