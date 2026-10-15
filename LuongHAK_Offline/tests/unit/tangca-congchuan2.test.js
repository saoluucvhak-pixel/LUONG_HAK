// "Công chuẩn 2" cho TC2: đối chiếu công thức M thật của HAK_DN (query QR_CHAMCONG2/QR_TH_CC, trích từ
// DataMashup của file LuongĐN09_27.10.2025.v3T.xlsx) — nhãn chấm công chứa "DQ" → Công chuẩn 2 = 40,
// dùng thay Công chuẩn thường khi tính phần tăng ca vượt chuẩn của TC2. Không có nhãn DQ → giữ đúng
// hành vi cũ (dùng Công chuẩn thường), không đổi số liệu các kỳ trước.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../engine.js");
const F = require("../fixtures/build.js");

function soCN(nam, thang) {
  let n = 0;
  const days = new Date(nam, thang, 0).getDate();
  for (let d = 1; d <= days; d++) if (new Date(nam, thang - 1, d).getDay() === 0) n++;
  return n;
}

function dbCo(coDQ) {
  const db = F.baseDb();
  db.nhansu = [F.staff({
    "Mã nhân viên": "NV1", "Họ và tên": "A", "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000",
    "Mã tăng ca": "TC2", "Mã BHXH": "", "Mã TNCN": "MT00"
  })];
  // 30 công BT (vượt Công chuẩn thường = 26 nhưng dưới Công chuẩn 2 = 40) để thấy rõ TC2 đổi hành vi
  const bt = { "Kỳ": "2026-09", "Mã NV": "NV1", "Hình thức công": "BT" };
  for (let d = 1; d <= 30; d++) bt[("0" + d).slice(-2)] = 1;
  if (coDQ) bt["05"] = "1DQ"; // 1 công, nhãn DQ
  const tc = F.ccRow("NV1", 2026, 9, "TC", 1, 3); // 3 công tăng ca ghi nhận
  db.chamcong = [bt, tc];
  return db;
}

test("U-TC2-01: không có nhãn DQ → TC2 dùng Công chuẩn thường như cũ", () => {
  const db = dbCo(false);
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  const r = kq.bangluong[0];
  const cChuan = 30 - soCN(2026, 9); // TG1: số ngày tháng - tất cả ngày CN = 26
  const donGiaTG = 9000000 / cChuan;
  const cCTL = 30 + 3; // Công tính lương = công hàng ngày(30, gồm cả ngày DQ nếu có) + công tăng ca(3) (TG1 không phải SP)
  const d2 = cCTL - 0 - 0 - 0 - 3 - 0 - cChuan; // cLe=cTC(trung chuyển)=cPhep=cDC=0 → d2 = 30-26 = 4 > 0, có vượt chuẩn
  const heSo = 0.5;
  const expect = Math.round(donGiaTG * ((d2 > 0 ? d2 * heSo : 0) + 3 * heSo));
  assert.equal(r["Tiền tăng ca"], expect);
});

test("U-TC2-02: có nhãn DQ → TC2 dùng Công chuẩn 2 = 40 thay Công chuẩn thường (công thức M thật)", () => {
  const db = dbCo(true);
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  const r = kq.bangluong[0];
  const donGiaTG = 9000000 / 40; // v10.4: người có nhãn DQ (công BT) → Công chuẩn = Công chuẩn 2 = 40 (cả đơn giá ngày)
  const cCTL = 30 + 3;
  const d2 = cCTL - 0 - 0 - 0 - 3 - 0 - 40; // dùng 40 thay cChuan → 33-3-40 = -10 ≤ 0, hết vượt chuẩn
  const heSo = 0.5;
  const expect = Math.round(donGiaTG * ((d2 > 0 ? d2 * heSo : 0) + 3 * heSo));
  assert.equal(r["Tiền tăng ca"], expect);
  // Và phải khác với trường hợp không có DQ (chứng minh Công chuẩn 2 thực sự có tác dụng)
  const kqKhongDQ = E.tinhBangLuong(dbCo(false), 2026, 9, false);
  assert.notEqual(r["Tiền tăng ca"], kqKhongDQ.bangluong[0]["Tiền tăng ca"]);
});

test("U-TC2-03: nhãn DQ không phải mã tăng ca TC2 (ví dụ TC4) → không áp dụng Công chuẩn 2 (TC4 không dùng mốc chuẩn)", () => {
  const db = dbCo(true);
  db.nhansu[0]["Mã tăng ca"] = "TC4";
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  const r = kq.bangluong[0];
  const donGiaTG = 9000000 / 40; // v10.4: người có nhãn DQ → Công chuẩn 2 = 40
  // TC4 = công tăng ca * hệ số, không liên quan Công chuẩn/Công chuẩn 2
  assert.equal(r["Tiền tăng ca"], Math.round(donGiaTG * 3 * 0.5));
});
