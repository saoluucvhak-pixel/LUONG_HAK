// Báo cáo biến động nhân sự (2.0-α15): tự nhận biết từ hợp đồng + phụ lục, không cần nhập lại "Loại biến động"
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const HR = require("../../hr.js");

function db() {
  return {
    dm_phongban: [{ "Mã phòng ban": "01.01", "Tên phòng ban": "Văn phòng" }, { "Mã phòng ban": "02.01", "Tên phòng ban": "Xưởng dăm" }],
    dm_chucvu: [{ "Mã chức vụ": "NV", "Tên chức vụ": "Nhân viên" }, { "Mã chức vụ": "TT", "Tên chức vụ": "Tổ trưởng" }],
    nhanvien: [{ "Mã NV": "NV001", "Họ và tên": "A" }, { "Mã NV": "NV002", "Họ và tên": "B" }, { "Mã NV": "NV003", "Họ và tên": "C" }],
    hopdong: [
      { "Mã NV": "NV001", "Số HĐLĐ": "H1", "Ngày vào làm": "2024-01-01" },
      { "Mã NV": "NV002", "Số HĐLĐ": "H2", "Ngày vào làm": "2026-07-15" },
      { "Mã NV": "NV003", "Số HĐLĐ": "H3", "Ngày vào làm": "2023-01-01", "Ngày chấm dứt": "2026-08-20", "Lý do chấm dứt": "Người lao động đơn phương chấm dứt" }
    ],
    chitiethd: [
      { "Mã NV": "NV001", "Số HĐLĐ": "H1", "Mã công tác": "H1-PL01", "Hiệu lực từ": "2024-01-01", "Phòng ban": "01.01", "Chức vụ": "NV", "Lương thỏa thuận": "14500000", "Lương cơ bản": "7000000", "Mức đóng bảo hiểm": "BH01" },
      { "Mã NV": "NV001", "Số HĐLĐ": "H1", "Mã công tác": "H1-PL02", "Số quyết định": "QĐ 98/2026", "Hiệu lực từ": "2026-09-01", "Phòng ban": "02.01", "Chức vụ": "TT", "Lương thỏa thuận": "15500000", "Lương cơ bản": "7500000", "Mức đóng bảo hiểm": "BH01" },
      { "Mã NV": "NV002", "Số HĐLĐ": "H2", "Mã công tác": "H2-PL01", "Hiệu lực từ": "2026-07-15", "Phòng ban": "02.01", "Lương thỏa thuận": "8000000" },
      { "Mã NV": "NV002", "Số HĐLĐ": "H2", "Mã công tác": "H2-PL02", "Hiệu lực từ": "2026-12-01", "Phòng ban": "02.01", "Lương thỏa thuận": "9000000" },
      { "Mã NV": "NV003", "Số HĐLĐ": "H3", "Mã công tác": "H3-PL01", "Hiệu lực từ": "2023-01-01", "Phòng ban": "02.01", "Lương thỏa thuận": "9000000" },
      { "Mã NV": "NV003", "Số HĐLĐ": "H3", "Mã công tác": "H3-PL02", "Loại biến động": "Khác", "Hiệu lực từ": "2026-08-01", "Phòng ban": "02.01", "Lương thỏa thuận": "9000000" }
    ]
  };
}

test("U-BD-01 07–09/2026: tăng mới, nghỉ việc (kèm lý do), tăng lương có %, điều chuyển, đổi chức vụ, mức đóng BH; ngoài khoảng thì không có", () => {
  const r = HR.reports(db()).biendong("2026-07", "2026-09");
  const by = (ma, loai) => r.filter((x) => x["Mã NV"] === ma && x["Loại biến động"] === loai);
  assert.equal(by("NV002", "Tăng mới").length, 1); assert.equal(by("NV002", "Tăng mới")[0]["Sau"], 8000000);
  const nghi = by("NV003", "Nghỉ việc")[0]; assert.equal(nghi["Hiệu lực"], "2026-08-20"); assert.equal(nghi["Sau"], "Người lao động đơn phương chấm dứt");
  const tang = by("NV001", "Tăng lương")[0];
  assert.equal(tang["Trước"], 14500000); assert.equal(tang["Sau"], 15500000); assert.equal(tang["Chênh lệch"], "+1.000.000 (+6,9%)"); assert.equal(tang["Chứng từ"], "H1-PL02 · QĐ 98/2026");
  assert.deepEqual([by("NV001", "Điều chuyển phòng ban")[0]["Trước"], by("NV001", "Điều chuyển phòng ban")[0]["Sau"]], ["Văn phòng", "Xưởng dăm"]);
  assert.deepEqual([by("NV001", "Bổ nhiệm / đổi chức vụ")[0]["Trước"], by("NV001", "Bổ nhiệm / đổi chức vụ")[0]["Sau"]], ["Nhân viên", "Tổ trưởng"]);
  assert.equal(by("NV001", "Điều chỉnh mức đóng BH")[0]["Chênh lệch"], "+500.000");
  assert.equal(by("NV003", "Khác").length, 1, "phụ lục không đổi gì nhưng có ghi 'Loại biến động' → vẫn hiện");
  assert.equal(r.filter((x) => x["Hiệu lực"] >= "2026-10").length, 0, "phụ lục 12/2026 ngoài khoảng");
  assert.deepEqual(r.map((x) => x["Hiệu lực"]), r.map((x) => x["Hiệu lực"]).slice().sort(), "sắp theo ngày hiệu lực");
});

test("U-BD-02 Q-24: không có quyền xem lương → che số tiền nhưng vẫn biết ai tăng / giảm lương", () => {
  const r = HR.reports(db(), { hidePay: true }).biendong("2026-07", "2026-09");
  const tang = r.filter((x) => x["Loại biến động"] === "Tăng lương")[0];
  assert.equal(tang["Mã NV"], "NV001"); assert.equal(tang["Trước"], HR.PAY_HIDDEN); assert.equal(tang["Sau"], HR.PAY_HIDDEN); assert.equal(tang["Chênh lệch"], HR.PAY_HIDDEN);
  assert.ok(!JSON.stringify(r).includes("15500000") && !JSON.stringify(r).includes("15.500.000"));
});

test("U-BD-03 quá trình lương 1 người theo thời gian, % so với lần trước", () => {
  const q = HR.reports(db()).quaTrinhLuong("NV001");
  assert.deepEqual(q.map((x) => x["Hiệu lực từ"]), ["2024-01-01", "2026-09-01"]);
  assert.equal(q[1]["Lương thỏa thuận"], 15500000); assert.equal(q[1]["Thay đổi (%)"], 6.9);
  assert.equal(HR.reports(db(), { hidePay: true }).quaTrinhLuong("NV001")[1]["Lương thỏa thuận"], HR.PAY_HIDDEN);
});
