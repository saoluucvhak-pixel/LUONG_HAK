// V9.2 — người phụ thuộc mở rộng (CCCD/MST/ngày cấp/kỳ giảm trừ) + kiểm tra cấu hình biểu thuế cha–con. Dữ liệu giả lập.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const DEP = require("../../core/dependents.js");
const TC = require("../../core/tax-config.js");
const INT = require("../../core/integrity.js");
const E = require("../../engine.js");
const HR = require("../../hr.js");
const { baseDb } = require("../fixtures/build.js");

const npt = (o) => Object.assign({ "Mã NV": "NV001", "Họ tên nhân thân": "Con A", "Quan hệ": "Con", "Đăng ký phụ thuộc": "Có", "Hiệu lực từ": "2026-01-01" }, o);

test("U-NPT-01 chỉ tính giảm trừ trong khoảng tháng hợp lệ; Chờ đăng ký / Ngừng giảm trừ không tính; bỏ trống tháng → theo Hiệu lực", () => {
  const r = npt({ "Giảm trừ từ tháng": "2026-03", "Giảm trừ đến tháng": "2026-08" });
  assert.equal(DEP.dangGiamTru(r, "2026-02"), false);
  assert.equal(DEP.dangGiamTru(r, "2026-03"), true);
  assert.equal(DEP.dangGiamTru(r, "2026-08"), true);
  assert.equal(DEP.dangGiamTru(r, "2026-09"), false);
  assert.equal(DEP.dangGiamTru(npt({ "Trạng thái đăng ký": "Chờ đăng ký" }), "2026-05"), false);
  assert.equal(DEP.dangGiamTru(npt({ "Trạng thái đăng ký": "Ngừng giảm trừ" }), "2026-05"), false);
  assert.equal(DEP.dangGiamTru(npt({ "Đăng ký phụ thuộc": "Không" }), "2026-05"), false);
  assert.equal(DEP.dangGiamTru(npt(), "2025-12"), false, "theo Hiệu lực từ 2026-01");
  assert.equal(DEP.dangGiamTru(npt({ "Hiệu lực đến": "2026-04-15" }), "2026-04"), true);
  assert.equal(DEP.dangGiamTru(npt({ "Hiệu lực đến": "2026-04-15" }), "2026-05"), false);
});

test("U-NPT-02 không đếm trùng cùng 1 người (cùng CCCD / MST / họ tên+ngày sinh)", () => {
  const rows = [npt({ "Số CCCD nhân thân": "012345678901" }), npt({ "Số CCCD nhân thân": "012345678901", "Họ tên nhân thân": "Con A (ghi lại)" }),
    npt({ "Họ tên nhân thân": "Con B", "Mã số thuế": "0312345678" }), npt({ "Họ tên nhân thân": "Con B2", "Mã số thuế": "0312345678" }), npt({ "Họ tên nhân thân": "Vợ", "Ngày sinh": "1990-01-01" })];
  assert.equal(DEP.danhSach(rows, "2026-09").length, 3);
});

test("U-NPT-03 kiểm tra dữ liệu: CCCD/MST/ngày cấp/giới tính/tháng — số 0 đầu được giữ, trống được phép", () => {
  assert.deepEqual(DEP.checkRow(npt({ "Số CCCD nhân thân": "001201012345", "Ngày cấp CCCD": "2021-05-10", "Ngày sinh": "2018-02-01", "Giới tính": "Nữ", "Mã số thuế": "0312345678" }), "2026-10-13")
    .filter((x) => x.level !== "Low"), []);
  const bad = DEP.checkRow(npt({ "Số CCCD nhân thân": "12345", "Mã số thuế": "99", "Ngày cấp CCCD": "2010-01-01", "Ngày sinh": "2018-02-01", "Giảm trừ từ tháng": "2026-05", "Giảm trừ đến tháng": "2026-02", "Giới tính": "?" }), "2026-10-13");
  ["CCCD/CMND", "Mã số thuế", "Ngày cấp CCCD trước ngày sinh", "kết thúc giảm trừ", "Giới tính"].forEach((k) => assert.ok(bad.some((x) => x.msg.includes(k)), k));
  assert.equal(DEP.checkRow(npt(), "2026-10-13").filter((x) => x.level !== "Low").length, 0, "CCCD, MST để trống là hợp lệ");
});

test("U-NPT-04 phát hiện đăng ký trùng/chồng kỳ giảm trừ và 1 người được 2 nhân viên cùng giảm trừ", () => {
  const db = { nhanthan: [npt({ "Số CCCD nhân thân": "012345678901" }), npt({ "Số CCCD nhân thân": "012345678901", "Hiệu lực từ": "2026-06-01" }),
    npt({ "Mã NV": "NV002", "Số CCCD nhân thân": "012345678901" })] };
  const m = DEP.check(db, "2026-10-13").filter((x) => x.level === "High").map((x) => x.msg).join("\n");
  assert.match(m, /Đăng ký trùng\/chồng kỳ giảm trừ/); assert.match(m, /2 nhân viên cùng giảm trừ/);
  // hai kỳ nối tiếp không chồng
  const ok = { nhanthan: [npt({ "Số CCCD nhân thân": "012345678901", "Giảm trừ đến tháng": "2026-05" }), npt({ "Mã NV": "NV002", "Số CCCD nhân thân": "012345678901", "Giảm trừ từ tháng": "2026-06" })] };
  assert.equal(DEP.check(ok, "2026-10-13").filter((x) => x.level === "High").length, 0);
});

test("U-NPT-05 giảm trừ người phụ thuộc vào thuế đúng số người theo THÁNG; kết quả truy ngược tên người được tính", () => {
  const db = baseDb();
  db.nhanvien = [{ "Mã NV": "NV001", "Họ và tên": "A", "Trạng thái": "Đang làm việc" }];
  db.hopdong = [{ "Mã NV": "NV001", "Số HĐLĐ": "NV001/HĐ01", "Ngày vào làm": "2025-01-01", "Hình thức HĐLĐ": "Xác định thời hạn" }];
  db.chitiethd = [{ "Mã NV": "NV001", "Số HĐLĐ": "NV001/HĐ01", "Hiệu lực từ": "2025-01-01", "Phòng ban": "01.01", "Chức vụ": "8", "Mã lương": "CĐ", "Lương thỏa thuận": "40000000", "Mức đóng bảo hiểm": "BH00", "Thuế TNCN": "LT01", "HTTT": "Chuyển khoản" }];
  db.nhanthan = [npt({ "Giảm trừ từ tháng": "2026-03", "Giảm trừ đến tháng": "2026-08" }), npt({ "Họ tên nhân thân": "Vợ", "Quan hệ": "Vợ/Chồng", "Hiệu lực từ": "2025-01-01" })];
  const tinh = (th) => { const sp = HR.staffForPayroll(db, 2026, th); const kq = E.tinhBangLuong(Object.assign({}, db, { nhansu: sp.list }), 2026, th, false, { quyChe: "2026" }); return { sp, kq }; };
  const t9 = tinh(9), t5 = tinh(5);
  assert.equal(t9.sp.list[0]["Người phụ thuộc"], 1, "tháng 9: Con A đã hết giảm trừ, còn Vợ");
  assert.equal(t5.sp.list[0]["Người phụ thuộc"], 2);
  assert.ok(t9.kq.bangluong[0]["Thuế TNCN"] > t5.kq.bangluong[0]["Thuế TNCN"], "ít người phụ thuộc hơn → thuế cao hơn");
  assert.deepEqual(HR.dsNguoiPhuThuoc(db, "NV001", "2026-05-01", "2026-05-31").map((x) => x["Họ tên nhân thân"]), ["Con A", "Vợ"], "truy ngược được tên người phụ thuộc đã tính");
});

test("U-TCFG-01 kiểm tra cấu hình biểu thuế: chồng/hở/thiếu mã cha/trừ nhanh sai phương pháp/mã lũy tiến thiếu biểu", () => {
  const db = { dm_tncn: [{ "Mã thuế TNCN": "A", "Nội dung": "Lũy tiến", "Phương pháp": "LUY_TIEN", "Hiệu lực từ": "2026-01-01" }, { "Mã thuế TNCN": "B", "Nội dung": "Lũy tiến", "Phương pháp": "LUY_TIEN", "Hiệu lực từ": "2026-01-01" }],
    dm_bacthue: [
      { "Mã thuế TNCN": "A", "Bậc": 1, "Thu nhập từ": 0, "Thu nhập đến": 5000000, "Tỷ lệ": 0.05, "Hiệu lực từ": "2026-01-01" },
      { "Mã thuế TNCN": "A", "Bậc": 2, "Thu nhập từ": 4000000, "Thu nhập đến": 10000000, "Tỷ lệ": 0.1, "Trừ nhanh": 100, "Hiệu lực từ": "2026-01-01" },
      { "Mã thuế TNCN": "A", "Bậc": 3, "Thu nhập từ": 12000000, "Thu nhập đến": 0, "Tỷ lệ": 0.2, "Hiệu lực từ": "2026-01-01" },
      { "Mã thuế TNCN": "ZZ", "Bậc": 1, "Thu nhập từ": 0, "Thu nhập đến": 0, "Tỷ lệ": 0.2, "Hiệu lực từ": "2026-01-01" }] };
  const m = TC.check(db).map((x) => x.msg).join("\n");
  assert.match(m, /bậc 1 và 2 CHỒNG/); assert.match(m, /HỞ khoảng thu nhập giữa bậc 2 và 3/);
  assert.match(m, /không có ở bảng cha DM_TNCN/); assert.match(m, /LUY_TIEN \(từng phần\) không dùng trừ nhanh/);
});

test("U-TCFG-02 danh mục chuẩn HAK (seed) không có lỗi cấu hình thuế; integrity.check gộp cả NPT + thuế", () => {
  const db = baseDb();
  assert.deepEqual(TC.check(db).filter((x) => x.level === "High"), []);
  db.nhanthan = [npt({ "Số CCCD nhân thân": "abc" })];
  assert.ok(INT.check(db).some((x) => x.area === "nhanthan" && /CCCD/.test(x.msg)));
});
