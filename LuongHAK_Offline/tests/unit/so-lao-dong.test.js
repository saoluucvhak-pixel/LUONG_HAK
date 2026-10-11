// Sổ quản lý lao động theo khoản 2 Điều 3 Nghị định 145/2020/NĐ-CP (2.0-α14)
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const HR = require("../../hr.js");
const F = require("../fixtures/build.js");

function db1() {
  const db = F.baseDb();
  ["hocvan", "canhan", "nghiphep", "nghiom", "quyenloiphep", "daotao", "noiquy", "tainanld", "congtac"].forEach((k) => { db[k] = db[k] || []; });
  db.nhanvien.push({ "Mã NV": "NV001", "Họ và tên": "Nguyễn Văn A", "Trạng thái": "Đã nghỉ việc" });
  db.canhan.push({ "Mã NV": "NV001", "Giới tính": "Nam", "Ngày sinh": "1990-05-01", "Quốc tịch": "Việt Nam", "Thường trú": "Quế Sơn", "Số CCCD": "049090000001", "Số sổ BHXH": "4900000001", "Hiệu lực từ": "2024-01-01" });
  db.hocvan.push({ "Mã NV": "NV001", "Trình độ học vấn": "Trung cấp", "Chuyên môn": "Cơ khí", "Bậc trình độ kỹ năng nghề": "Bậc 3/7", "Ngày cấp bằng": "2012-06-01" });
  db.hopdong.push({ "Mã NV": "NV001", "Số HĐLĐ": "H1", "Hình thức HĐLĐ": "Thử việc", "Ngày vào làm": "2024-03-01", "Ngày chấm dứt": "2024-04-30" },
    { "Mã NV": "NV001", "Số HĐLĐ": "H2", "Hình thức HĐLĐ": "Xác định thời hạn", "Ngày vào làm": "2024-05-01", "Ngày chấm dứt": "2026-09-30", "Lý do chấm dứt": "Người lao động đơn phương chấm dứt" });
  const pl = { "Mã NV": "NV001", "Số HĐLĐ": "H2", "Phòng ban": "02.01", "Vị trí việc làm": "Thợ vận hành máy dăm", "Mã lương": "TG1", "Lương cơ bản": "6000000", "Mức đóng bảo hiểm": "BH01" };
  db.chitiethd.push(Object.assign({}, pl, { "Hiệu lực từ": "2024-05-01", "Lương thỏa thuận": "9000000" }), Object.assign({}, pl, { "Hiệu lực từ": "2026-07-01", "Lương thỏa thuận": "10000000" }));
  db.nghiphep.push({ "Mã NV": "NV001", "Số HĐLĐ": "H2", "Từ ngày": "2026-02-02", "Số ngày nghỉ": 3, "Trạng thái duyệt": "Đã duyệt" },
    { "Mã NV": "NV001", "Số HĐLĐ": "H2", "Loại nghỉ": "Nghỉ việc riêng có hưởng lương", "Từ ngày": "2026-03-02", "Số ngày nghỉ": 1, "Trạng thái duyệt": "Đã duyệt" },
    { "Mã NV": "NV001", "Số HĐLĐ": "H2", "Loại nghỉ": "Nghỉ không hưởng lương", "Từ ngày": "2026-04-02", "Số ngày nghỉ": 2, "Trạng thái duyệt": "Đã duyệt" },
    { "Mã NV": "NV001", "Số HĐLĐ": "H2", "Loại nghỉ": "Nghỉ hằng năm", "Từ ngày": "2026-05-04", "Số ngày nghỉ": 5, "Trạng thái duyệt": "Chờ duyệt" });
  db.nghiom.push({ "Mã NV": "NV001", "Số HĐLĐ": "H2", "Từ ngày": "2026-06-01", "Số ngày nghỉ": 2, "Trạng thái duyệt": "Đã duyệt" });
  db.quyenloiphep.push({ "Mã NV": "NV001", "Số HĐLĐ": "H2", "Năm áp dụng": 2026, "Số ngày được cấp": 12 });
  db.chamcong.push(F.ccRow("NV001", 2026, 8, "TC", 0.5, 4), F.ccRow("NV001", 2026, 9, "TC1", "1", 3), F.ccRow("NV001", 2025, 9, "TC", 1, 9));
  db.daotao.push({ "Mã NV": "NV001", "Từ ngày": "2026-08-10", "Hình thức": "Nâng cao trình độ kỹ năng nghề", "Nội dung": "Vận hành máy băm dăm" });
  db.noiquy.push({ "Mã NV": "NV001", "Số HĐLĐ": "H2", "Ngày": "2026-07-15", "Nội dung vi phạm": "Đi trễ", "Tình trạng xử lý": "Đã xử lý", "Hình thức kỷ luật": "Khiển trách", "Bồi thường thiệt hại (trách nhiệm vật chất)": "500000" });
  db.tainanld.push({ "Mã NV": "NV001", "Ngày": "2026-08-20", "Loại": "Tai nạn lao động", "Nội dung": "Kẹt tay", "Mức suy giảm khả năng lao động (%)": 5 });
  return db;
}

test("U-SLD-01 sổ có đủ 15 nhóm nội dung của khoản 2 Điều 3 NĐ 145/2020", () => {
  const r = HR.reports(db1()).soLaoDong(2026)[0];
  const need = ["Họ và tên", "Giới tính", "Ngày sinh", "Quốc tịch", "Thường trú", "Số CCCD", "Trình độ", "Bậc trình độ kỹ năng nghề", "Vị trí việc làm", "Loại HĐLĐ", "Bắt đầu làm việc",
    "Số sổ BHXH", "Lương thỏa thuận", "Nâng bậc, nâng lương 2026", "Nghỉ hằng năm 2026 (ngày)", "Nghỉ việc riêng có lương 2026", "Nghỉ không hưởng lương 2026", "Làm thêm 2026 (công TC)",
    "Nâng cao trình độ, kỹ năng nghề 2026", "Kỷ luật, trách nhiệm vật chất 2026", "Tai nạn LĐ, bệnh nghề nghiệp 2026", "Ngày chấm dứt", "Lý do chấm dứt"];
  for (const k of need) assert.ok(k in r, "thiếu cột " + k);
});

test("U-SLD-02 số liệu trong năm 2026 đúng (chỉ đơn Đã duyệt, đúng loại nghỉ, công TC của năm, sự kiện trong năm)", () => {
  const r = HR.reports(db1()).soLaoDong(2026)[0];
  assert.equal(r["Bậc trình độ kỹ năng nghề"], "Bậc 3/7"); assert.equal(r["Vị trí việc làm"], "Thợ vận hành máy dăm");
  assert.equal(r["Bắt đầu làm việc"], "2024-03-01", "thời điểm bắt đầu làm việc = hợp đồng đầu tiên (kể cả thử việc)");
  assert.equal(r["Nâng bậc, nâng lương 2026"], "2026-07-01: 9000000 → 10000000");
  assert.equal(r["Nghỉ hằng năm 2026 (ngày)"], 3, "đơn 'Chờ duyệt' không tính; để trống loại = nghỉ hằng năm");
  assert.equal(r["Nghỉ việc riêng có lương 2026"], 1); assert.equal(r["Nghỉ không hưởng lương 2026"], 2); assert.equal(r["Nghỉ ốm 2026"], 2);
  assert.equal(r["Làm thêm 2026 (công TC)"], 0.5 * 4 + 1 * 3, "chỉ dòng TC/TC1… của năm 2026");
  assert.match(r["Nâng cao trình độ, kỹ năng nghề 2026"], /Vận hành máy băm dăm/);
  assert.match(r["Kỷ luật, trách nhiệm vật chất 2026"], /Khiển trách, bồi thường 500000/);
  assert.match(r["Tai nạn LĐ, bệnh nghề nghiệp 2026"], /2026-08-20 Tai nạn lao động \(5%\)/);
  assert.equal(r["Lý do chấm dứt"], "Người lao động đơn phương chấm dứt");
  const r25 = HR.reports(db1()).soLaoDong(2025)[0];
  assert.equal(r25["Làm thêm 2025 (công TC)"], 9); assert.equal(r25["Nghỉ hằng năm 2025 (ngày)"], 0); assert.equal(r25["Nâng bậc, nâng lương 2025"], "");
});

test("U-SLD-03 bảo mật lương (Q-24): hidePay che lương và mức nâng lương nhưng vẫn ghi CÓ nâng lương ngày nào", () => {
  const r = HR.reports(db1(), { hidePay: true }).soLaoDong(2026)[0];
  assert.equal(r["Lương thỏa thuận"], HR.PAY_HIDDEN);
  assert.equal(r["Nâng bậc, nâng lương 2026"], HR.PAY_HIDDEN + " (2026-07-01)");
});

test("U-SLD-04 báo cáo nghỉ phép: chỉ 'Nghỉ hằng năm' (hoặc để trống) trừ vào phép năm; việc riêng / không lương tách cột", () => {
  const r = HR.reports(db1()).nghi(2026)[0];
  assert.equal(r["Phép được cấp"], 12); assert.equal(r["Đã nghỉ phép"], 3); assert.equal(r["Phép còn lại"], 9);
  assert.equal(r["Nghỉ việc riêng có lương"], 1); assert.equal(r["Nghỉ không hưởng lương"], 2);
});
