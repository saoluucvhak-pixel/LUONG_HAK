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

test("I-16 vào làm giữa tháng 15/09 (14 công): lương 20tr × 14/26 = 10.769.231; thu nhập tính thuế < 0 → thuế 0; BH vẫn trừ đủ [chờ KT xác nhận — Q-23]", () => {
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

test("I-20 phụ lục tăng lương hiệu lực GIỮA THÁNG (16/09) → cả tháng 9 tính mức mới, không chia theo ngày [chờ KT xác nhận — Q-22]", () => {
  const db = one(); db.chamcong = [ccRow("NV001", 2026, 8), ccRow("NV001", 2026, 9)];
  db.chitiethd.push(Object.assign({}, db.chitiethd[0], { "Hiệu lực từ": "2026-09-16", "Lương thỏa thuận": "26000000" }));
  assert.equal(pay(db, 2026, 9).b["Lương thời gian"], 26000000);
  assert.equal(pay(db, 2026, 8).b["Lương thời gian"], 20000000);
});
