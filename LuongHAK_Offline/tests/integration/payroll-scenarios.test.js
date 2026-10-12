// Kịch bản tính lương (AUDIT_V2 §B4) — test MÔ TẢ HÀNH VI HIỆN TẠI (characterization) với số kỳ vọng TÍNH TAY.
// Không đổi công thức. Kịch bản đánh dấu [chờ KT xác nhận] = số đúng theo công thức đang chạy nhưng quy tắc cần Kế toán/chủ sở hữu xác nhận.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../engine.js");
const HR = require("../../hr.js");
const { baseDb, ccRow } = require("../fixtures/build.js");

function pay(db, y, m) {
  const sp = HR.staffForPayroll(db, y, m);
  const kq = E.tinhBangLuong(Object.assign({}, db, { nhansu: sp.list }), y, m, false);
  return { b: kq.bangluong[0], warn: sp.warn.concat(kq.canhbao) };
}
// TG1, lương thỏa thuận 20.000.000, lương đóng BH 6.000.000 (BH01 = 10,5% NLĐ), thuế lũy tiến LT01, không người phụ thuộc
function one() {
  const db = baseDb();
  db.nhanvien = [{ "Mã NV": "NV001", "Họ và tên": "A", "Trạng thái": "Đang làm việc" }];
  db.hopdong = [{ "Mã NV": "NV001", "Số HĐLĐ": "H1", "Ngày vào làm": "2025-01-01" }];
  db.chitiethd = [{ "Mã NV": "NV001", "Số HĐLĐ": "H1", "Hiệu lực từ": "2025-01-01", "Mã lương": "TG1", "Lương thỏa thuận": "20000000", "Lương cơ bản": "6000000", "Mức đóng bảo hiểm": "BH01", "Thuế TNCN": "LT01", "HTTT": "Tiền mặt" }];
  return db;
}
const keep = (r, from, to) => { for (let d = 1; d <= 31; d++) if (d < from || d > to) delete r[String(d).padStart(2, "0")]; return r; };

test("I-15 đủ tháng 9/2026 (26 công chuẩn): BH 630.000; thuế (20tr − 0,63tr − 15,5tr) × 5% = 193.500; thực lĩnh 19.176.500 → làm tròn 19.177.000", () => {
  const db = one(); db.chamcong = [ccRow("NV001", 2026, 9)];
  const { b } = pay(db, 2026, 9);
  assert.equal(b["Công chuẩn"], 26); assert.equal(b["Tổng công"], 26);
  assert.equal(b["BH trừ NLĐ"], 630000); assert.equal(b["Thuế TNCN"], 193500); assert.equal(b["Thực lĩnh"], 19177000);
});

test("I-16 vào làm giữa tháng 15/09 (14 công): lương 20tr × 14/26 = 10.769.231; thuế 0; BH trừ đủ vì danh mục CHƯA KHAI ngưỡng (dữ liệu trống, công thức vẫn có — R-57, xem I-21)", () => {
  const db = one(); db.hopdong[0]["Ngày vào làm"] = "2026-09-15"; db.chitiethd[0]["Hiệu lực từ"] = "2026-09-15";
  db.chamcong = [keep(ccRow("NV001", 2026, 9), 15, 30)];
  const { b } = pay(db, 2026, 9);
  assert.equal(b["Tổng công"], 14); assert.equal(b["Lương thời gian"], 10769231);
  assert.ok(!b["Thuế TNCN"]); assert.equal(b["BH trừ NLĐ"], 630000); assert.equal(b["Thực lĩnh"], 10139000);
  assert.equal(pay(db, 2026, 8).b, undefined, "tháng 8 chưa vào làm → không có lương");
});

test("I-17 nghỉ việc 20/09: tháng 9 tính 17 công đã làm; tháng 10 không còn trong bảng lương", () => {
  const db = one(); db.hopdong[0]["Ngày chấm dứt"] = "2026-09-20"; db.chamcong = [keep(ccRow("NV001", 2026, 9), 1, 20)];
  const { b } = pay(db, 2026, 9);
  assert.equal(b["Tổng công"], 17); assert.equal(b["Lương thời gian"], 13076923); assert.equal(b["Thực lĩnh"], 12447000);
  const oct = pay(db, 2026, 10); assert.equal(oct.b, undefined); assert.ok(oct.warn.some((w) => /chưa có hợp đồng hiệu lực/.test(w)));
});

test("I-18 nhiều tạm ứng + nhiều dòng thưởng/thu nhập khác/trừ khác trong kỳ → cộng dồn; tạm ứng kỳ sau không bị trừ", () => {
  const db = one(); db.chamcong = [ccRow("NV001", 2026, 9)];
  db.ungluong = [{ "Ngày hạch toán": "2026-09-05", "Mã NV": "NV001", "Tạm ứng": "1000000" }, { "Ngày hạch toán": "2026-09-20", "Mã NV": "NV001", "Tạm ứng": "1.000.000" }, { "Ngày hạch toán": "2026-10-01", "Mã NV": "NV001", "Tạm ứng": "9000000" }];
  db.psluong = [{ "Ngày hạch toán": "2026-09-28", "Mã NV": "NV001", "Thưởng": "500000" }, { "Ngày hạch toán": "2026-09-29", "Mã NV": "NV001", "Thưởng": "500000", "Thu nhập khác": "200000", "Trừ khác": "100000" }];
  const { b } = pay(db, 2026, 9);
  assert.equal(b["Tạm ứng"], 2000000); assert.equal(b["Thưởng"], 1000000); assert.equal(b["Thu nhập khác"], 200000); assert.equal(b["Trừ khác"], 100000);
  assert.equal(b["Tổng thu nhập"], 21200000);
  assert.equal(b["Thuế TNCN"], 253500); // (21,2tr − 0,63tr − 15,5tr) × 5%
  assert.equal(b["Thực lĩnh"], 18217000); // 21.200.000 − 630.000 − 253.500 − 100.000 − 2.000.000 = 18.216.500 → 18.217.000
});

test("I-19 khoản trừ vượt thu nhập (2 công, tạm ứng 15tr) → thực lĩnh 0 + cảnh báo nêu số còn thiếu, KHÔNG tự chuyển kỳ sau", () => {
  const db = one(); db.chamcong = [ccRow("NV001", 2026, 9, "BT", 1, 2)];
  db.ungluong = [{ "Ngày hạch toán": "2026-09-05", "Mã NV": "NV001", "Tạm ứng": "15000000" }];
  const { b, warn } = pay(db, 2026, 9);
  assert.ok(!b["Thực lĩnh"]);
  assert.ok(warn.some((w) => /vượt thu nhập 14\.091\.538đ.*CHƯA được chuyển sang kỳ sau/.test(w)), warn.join("\n"));
});

test("I-20 phụ lục tăng lương hiệu lực GIỮA THÁNG (16/09), KHÔNG chọn cách áp dụng → cả tháng 9 tính mức mới (mặc định; chọn 'Từ ngày hiệu lực' xem U-PL-01, Q-22)", () => {
  const db = one(); db.chamcong = [ccRow("NV001", 2026, 8), ccRow("NV001", 2026, 9)];
  db.chitiethd.push(Object.assign({}, db.chitiethd[0], { "Hiệu lực từ": "2026-09-16", "Lương thỏa thuận": "26000000" }));
  assert.equal(pay(db, 2026, 9).b["Lương thời gian"], 26000000);
  assert.equal(pay(db, 2026, 8).b["Lương thời gian"], 20000000);
});

test("I-21 (R-57) cùng dữ liệu I-16, chỉ KHAI ngưỡng 15 công cho TG1 trong danh mục → công thức có sẵn tự áp dụng: không trừ BH NLĐ, truy thu phần công ty 6tr × 23,5% = 1.410.000", () => {
  const db = one(); db.hopdong[0]["Ngày vào làm"] = "2026-09-15"; db.chitiethd[0]["Hiệu lực từ"] = "2026-09-15";
  db.chamcong = [keep(ccRow("NV001", 2026, 9), 15, 30)];
  db.dm_luong.find((l) => l["Mã lương"] === "TG1")["Ngưỡng truy thu BH (công)"] = "15"; // chỉ thay DỮ LIỆU danh mục, không đổi code
  const { b } = pay(db, 2026, 9);
  assert.equal(b["Tổng công"], 14);
  assert.equal(b["BH trừ NLĐ"], 0); assert.equal(b["Truy thu BH"], 1410000); // (17,5% + 3% + 1% + 2%) × 6.000.000
  assert.equal(b["Thực lĩnh"], 9359000); // 10.769.231 − 1.410.000 = 9.359.231 → làm tròn 1.000
  // đủ ngưỡng (khai 14) → đóng bình thường
  db.dm_luong.find((l) => l["Mã lương"] === "TG1")["Ngưỡng truy thu BH (công)"] = "14";
  assert.equal(pay(db, 2026, 9).b["BH trừ NLĐ"], 630000);
});

test("I-22 (Q-26 = phương án A, chủ sở hữu chọn 11/10/2026) nghỉ việc 02/09 dưới ngưỡng 14 công → GIỮ quy tắc Q-04: không trừ BH NLĐ, truy thu phần công ty; 0 công → thực lĩnh 0 + cảnh báo số còn thiếu, không tự chuyển kỳ sau", () => {
  const db = one(); db.hopdong[0]["Ngày chấm dứt"] = "2026-09-02";
  db.dm_luong.find((l) => l["Mã lương"] === "TG1")["Ngưỡng truy thu BH (công)"] = "14";
  // 2 công (01, 02/09): lương 20tr × 2/26 = 1.538.462; truy thu 6tr × 23,5% = 1.410.000 → 128.462 → 128.000
  db.chamcong = [keep(ccRow("NV001", 2026, 9), 1, 2)];
  let { b } = pay(db, 2026, 9);
  assert.equal(b["Tổng công"], 2); assert.equal(b["Lương thời gian"], 1538462);
  assert.equal(b["BH trừ NLĐ"], 0); assert.equal(b["Truy thu BH"], 1410000); assert.equal(b["Thực lĩnh"], 128000);
  // 0 công (nghỉ đầu tháng, không đi làm ngày nào): vẫn có dòng lương + BH vì hợp đồng còn hiệu lực trong kỳ
  db.chamcong = [];
  const r = pay(db, 2026, 9); b = r.b;
  assert.equal(b["Tổng công"], 0); assert.equal(b["Truy thu BH"], 1410000); assert.ok(!b["Thực lĩnh"]);
  assert.ok(r.warn.some((w) => /vượt thu nhập 1\.410\.000đ.*CHƯA được chuyển sang kỳ sau/.test(w)), r.warn.join("\n"));
  // tháng sau không còn trong bảng lương
  assert.equal(pay(db, 2026, 10).b, undefined);
});

test("I-23 có công SAU ngày chấm dứt hợp đồng (nghỉ 20/09, vẫn chấm 21, 22/09) → cảnh báo nêu ngày; số tiền KHÔNG đổi (vẫn tính công đã nhập)", () => {
  const db = one(); db.hopdong[0]["Ngày chấm dứt"] = "2026-09-20"; db.chamcong = [keep(ccRow("NV001", 2026, 9), 1, 22)];
  const { b, warn } = pay(db, 2026, 9);
  assert.ok(warn.some((w) => /có công sau ngày chấm dứt hợp đồng 20\/09 \(ngày 21, 22\).*VẪN tính/.test(w)), warn.join("\n"));
  assert.equal(b["Tổng công"], 19); // 1–22/09 trừ 2 Chủ nhật (06, 13, 20 → 3 CN: 06, 13, 20) = 19
  // không có công sau ngày chấm dứt → không cảnh báo (I-17)
  db.chamcong = [keep(ccRow("NV001", 2026, 9), 1, 20)];
  assert.ok(!pay(db, 2026, 9).warn.some((w) => /sau ngày chấm dứt/.test(w)));
  // ô ghi số 0 sau ngày chấm dứt (Excel CNHAK ghi 0 thay vì để trống) = không công → không cảnh báo
  const z = keep(ccRow("NV001", 2026, 9), 1, 20); for (let d = 21; d <= 30; d++) z[String(d)] = d % 2 ? 0 : "0";
  db.chamcong = [z];
  assert.ok(!pay(db, 2026, 9).warn.some((w) => /sau ngày chấm dứt/.test(w)), "ô 0 không phải công");
});
