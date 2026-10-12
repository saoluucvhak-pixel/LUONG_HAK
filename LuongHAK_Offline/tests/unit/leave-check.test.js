// Q-27 phương án A (2.0-α17): đối chiếu đơn nghỉ phép / ốm với chấm công — chỉ cảnh báo, không đổi số tiền
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const HR = require("../../hr.js");

// Kỳ 09/2026: 01/09 là thứ Ba; Chủ nhật: 6, 13, 20, 27
function cc(ma, ht, days) { const r = { "Kỳ": "2026-09", "Mã NV": ma, "Hình thức công": ht }; Object.keys(days).forEach((d) => { r[String(d).padStart(2, "0")] = days[d]; }); return r; }
function full(except) { const o = {}; for (let d = 1; d <= 30; d++) if (new Date(2026, 8, d).getDay() && !(except || []).includes(d)) o[d] = "1"; return o; }
function db(extra) {
  return Object.assign({
    dm_luong: [{ "Mã lương": "TG1", "Cách tính": "Ngày công chuẩn" }],
    nhanvien: [{ "Mã NV": "NV001", "Họ và tên": "A" }, { "Mã NV": "NV002", "Họ và tên": "B" }],
    hopdong: [{ "Mã NV": "NV001", "Số HĐLĐ": "H1", "Ngày vào làm": "2024-01-01" }, { "Mã NV": "NV002", "Số HĐLĐ": "H2", "Ngày vào làm": "2024-01-01" }],
    chitiethd: [{ "Mã NV": "NV001", "Số HĐLĐ": "H1", "Hiệu lực từ": "2024-01-01", "Mã lương": "TG1", "Lương thỏa thuận": "9000000", "HTTT": "Tiền mặt" },
      { "Mã NV": "NV002", "Số HĐLĐ": "H2", "Hiệu lực từ": "2024-01-01", "Mã lương": "TG1", "Lương thỏa thuận": "9000000", "HTTT": "Tiền mặt" }],
    nghiphep: [], nghiom: [], chamcong: []
  }, extra);
}
const B = { dau: "2026-09-01", cuoi: "2026-09-30" };
const np = (o) => Object.assign({ "Mã NV": "NV001", "Số HĐLĐ": "H1", "Trạng thái duyệt": "Đã duyệt" }, o);

test("U-LV-01 đơn phép đã duyệt + chấm PN đúng ngày → không cảnh báo; Chủ nhật trong đơn không đòi PN", () => {
  const d = db({ nghiphep: [np({ "Từ ngày": "2026-09-04", "Đến ngày": "2026-09-07", "Số ngày nghỉ": 3 })], chamcong: [cc("NV001", "BT", full([4, 5, 7])), cc("NV001", "PN", { 4: "1", 5: "1", 7: "1" })] });
  assert.deepEqual(HR.leaveCheck(d, B, "NV001", "A"), []);
});

test("U-LV-02 đơn phép có lương đã duyệt: thiếu PN / vẫn chấm công thường → cảnh báo đúng ngày", () => {
  const d = db({ nghiphep: [np({ "Từ ngày": "2026-09-08", "Đến ngày": "2026-09-10", "Số ngày nghỉ": 3 })], chamcong: [cc("NV001", "BT", full([8, 9])), cc("NV001", "PN", { 8: "1" })] });
  const w = HR.leaveCheck(d, B, "NV001", "A");
  assert.equal(w.length, 2, w.join("\n"));
  assert.match(w[0], /^NV001 \(A\): \[Nghỉ phép\/ốm\] đơn phép có lương đã duyệt nhưng chưa chấm PN ngày 9\/09 — chỉ cảnh báo/);
  assert.match(w[1], /vẫn chấm công thường ngày 10\/09/);
});

test("U-LV-03 nghỉ không lương / nghỉ ốm đã duyệt mà vẫn có công → cảnh báo; đơn Từ chối bỏ qua; Chờ duyệt nhắc duyệt", () => {
  const d = db({
    nghiphep: [np({ "Loại nghỉ": "Nghỉ không hưởng lương", "Từ ngày": "2026-09-14", "Đến ngày": "2026-09-14" }), np({ "Từ ngày": "2026-09-21", "Đến ngày": "2026-09-22", "Trạng thái duyệt": "Từ chối" }), np({ "Từ ngày": "2026-09-29", "Đến ngày": "2026-09-30", "Trạng thái duyệt": "Chờ duyệt" })],
    nghiom: [{ "Mã NV": "NV001", "Số HĐLĐ": "H1", "Từ ngày": "2026-09-16", "Đến ngày": "2026-09-17", "Trạng thái duyệt": "Đã duyệt", "Có giấy chứng nhận BHXH": "Có" }],
    chamcong: [cc("NV001", "BT", full([17]))]
  });
  const w = HR.leaveCheck(d, B, "NV001", "A");
  assert.equal(w.length, 3, w.join("\n"));
  assert.match(w[0], /không hưởng lương đã duyệt nhưng vẫn có công ngày 14\/09/);
  assert.match(w[1], /nghỉ ốm đã duyệt \(BHXH chi trả\) nhưng vẫn có công ngày 16\/09/);
  assert.match(w[2], /1 đơn nghỉ trong kỳ còn 'Chờ duyệt'/);
});

test("U-LV-04 chấm PN không có đơn: chỉ cảnh báo khi người đó CÓ theo dõi đơn nghỉ; người chưa nhập đơn nào → không cảnh báo", () => {
  const d = db({ nghiphep: [np({ "Từ ngày": "2026-08-03", "Đến ngày": "2026-08-03" })], chamcong: [cc("NV001", "PN", { 11: "1" }), cc("NV002", "PN", { 11: "1" })] });
  const w1 = HR.leaveCheck(d, B, "NV001", "A");
  assert.equal(w1.length, 1); assert.match(w1[0], /chấm PN ngày 11\/09 nhưng không có đơn phép có lương đã duyệt/);
  assert.deepEqual(HR.leaveCheck(d, B, "NV002", "B"), []);
  assert.deepEqual(HR.leaveCheck(db({ chamcong: [cc("NV001", "PN", { 11: "1" })] }), B, "NV001", "A"), [], "không dùng đơn nghỉ → không cảnh báo");
});

test("U-LV-05 vào cảnh báo khi tính lương; dữ liệu chấm công / danh sách tính lương KHÔNG đổi", () => {
  const base = db({ chamcong: [cc("NV001", "BT", full([9]))] });
  const withLeave = db({ chamcong: [cc("NV001", "BT", full([9]))], nghiphep: [np({ "Từ ngày": "2026-09-09", "Đến ngày": "2026-09-09" })] });
  const a = HR.staffForPayroll(base, 2026, 9), b = HR.staffForPayroll(withLeave, 2026, 9);
  assert.deepEqual(b.list, a.list, "danh sách + thông tin tính lương giống hệt");
  assert.deepEqual(b.warn.filter((x) => !x.includes(HR.LEAVE_TAG)), a.warn);
  assert.equal(b.warn.filter((x) => x.includes(HR.LEAVE_TAG)).length, 1);
});

test("U-LV-07 (α22) đơn nghỉ không lương CHƯA BIẾT NGÀY VỀ (Đến ngày trống) = nghỉ tới hết kỳ: vẫn chấm công thường sau ngày bắt đầu → cảnh báo các ngày đó", () => {
  const d = db({ nghiphep: [np({ "Loại nghỉ": "Nghỉ không hưởng lương", "Từ ngày": "2026-09-25", "Đến ngày": "" })], chamcong: [cc("NV001", "BT", full())] });
  const w = HR.leaveCheck(d, B, "NV001", "A").join("\n");
  assert.match(w, /không hưởng lương đã duyệt nhưng vẫn có công ngày 25, 26, 28, 29, 30\/09/); // 27 là Chủ nhật
});
