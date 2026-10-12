// Đối chiếu lương Power Query (Master Prompt V3 mục XVII) — core/reconcile.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const RC = require("../../core/reconcile.js");

test("parseSheet: tự nhận dòng tiêu đề (bỏ qua dòng tiêu đề báo cáo phía trên), khớp alias không phân biệt hoa/thường/dấu", () => {
  const arr = [
    ["BẢNG TỔNG HỢP TIỀN LƯƠNG 11/2025"],
    ["THAM SỐ"],
    [],
    ["Tên khối", "Họ và tên", " Công chuẩn", "Công tính LTG", "Lương Tăng Ca", "Thu nhập còn lại"],
    ["01.Văn phòng", "Nguyễn Văn A", 26, 24, 500000, 11000000],
  ];
  const r = RC.parseSheet(arr);
  assert.equal(r.headerRow, 3);
  assert.deepEqual(r.matched.sort(), ["Công chuẩn", "Công tính TG", "Thực lĩnh", "Tiền tăng ca"].sort());
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].hoTen, "Nguyễn Văn A");
  assert.equal(r.rows[0].values.congChuan, 26);
  assert.equal(r.rows[0].values.congTinhTG, 24);
  assert.equal(r.rows[0].values.tienTangCa, 500000);
  assert.equal(r.rows[0].values.thucLinh, 11000000);
});

test("parseSheet: không có dòng tiêu đề hợp lệ → báo lỗi rõ, không đoán bừa", () => {
  const r = RC.parseSheet([["a", "b"], [1, 2]]);
  assert.equal(r.headerRow, -1);
  assert.ok(r.error);
  assert.equal(r.rows.length, 0);
});

test("parseSheet: cột không nhận ra được liệt kê đầy đủ (không âm thầm bỏ qua)", () => {
  const arr = [["Mã NV", "Họ và tên", "Cột lạ không rõ nghĩa"], ["NV001", "A", 123]];
  const r = RC.parseSheet(arr);
  assert.deepEqual(r.unmatched, ["cot la khong ro nghia"]);
});

test("compare: khớp theo Mã NV, tính đúng chênh lệch và phân loại 'Khác làm tròn' khi lệch rất nhỏ", () => {
  const appRows = [{ "Mã NV": "NV001", "Họ và tên": "A", "Thực lĩnh": 11000001 }];
  const refRows = [{ ma: "NV001", hoTen: "A", values: { thucLinh: 11000000 } }];
  const { rows } = RC.compare(appRows, refRows);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]["Chênh lệch"], 1);
  assert.equal(rows[0]["Loại lệch"], "Khác làm tròn");
});

test("compare: lệch tiền > 1đ → phân loại theo đúng nhóm chỉ tiêu (không phải 'Khác làm tròn')", () => {
  const appRows = [{ "Mã NV": "NV001", "Họ và tên": "A", "Tiền tăng ca": 600000 }];
  const refRows = [{ ma: "NV001", hoTen: "A", values: { tienTangCa: 500000 } }];
  const { rows } = RC.compare(appRows, refRows);
  assert.equal(rows[0]["Chênh lệch"], 100000);
  assert.equal(rows[0]["Loại lệch"], "Khác công thức tăng ca");
});

test("compare: không có Mã NV trong file → khớp theo Họ và tên (fold, không phân biệt dấu/hoa thường) khi DUY NHẤT 1 người trùng tên", () => {
  const appRows = [{ "Mã NV": "NV001", "Họ và tên": "Nguyễn Văn Á", "Thực lĩnh": 5000000 }];
  const refRows = [{ ma: "", hoTen: "nguyen van a", values: { thucLinh: 5000000 } }];
  const { rows, khongKhop } = RC.compare(appRows, refRows);
  assert.equal(khongKhop.length, 0);
  assert.equal(rows[0]["Mã NV"], "NV001");
  assert.equal(rows[0]["Chênh lệch"], 0);
  assert.equal(rows[0]["Loại lệch"], "");
});

test("compare: trùng tên nhiều người trong app → KHÔNG tự đoán, báo 'không khớp được'", () => {
  const appRows = [
    { "Mã NV": "NV001", "Họ và tên": "Nguyễn Văn A", "Thực lĩnh": 5000000 },
    { "Mã NV": "NV002", "Họ và tên": "Nguyễn Văn A", "Thực lĩnh": 6000000 },
  ];
  const refRows = [{ ma: "", hoTen: "Nguyễn Văn A", values: { thucLinh: 5000000 } }];
  const { rows, khongKhop } = RC.compare(appRows, refRows);
  assert.equal(rows.length, 0);
  assert.equal(khongKhop.length, 1);
  assert.equal(khongKhop[0].hoTen, "Nguyễn Văn A");
});

test("compare: người trong Excel không có trong app (Mã NV lạ, không trùng tên) → 'không khớp được'", () => {
  const appRows = [{ "Mã NV": "NV001", "Họ và tên": "A", "Thực lĩnh": 5000000 }];
  const refRows = [{ ma: "NV999", hoTen: "Người lạ", values: { thucLinh: 1000000 } }];
  const { rows, khongKhop } = RC.compare(appRows, refRows);
  assert.equal(rows.length, 0);
  assert.equal(khongKhop.length, 1);
  assert.equal(khongKhop[0].ma, "NV999");
});

test("compare: chỉ tiêu Excel để trống (null) thì bỏ qua, không báo lệch giả 0 − App", () => {
  const appRows = [{ "Mã NV": "NV001", "Họ và tên": "A", "Thực lĩnh": 5000000, "Tiền tăng ca": 200000 }];
  const refRows = [{ ma: "NV001", hoTen: "A", values: { thucLinh: 5000000, tienTangCa: null } }];
  const { rows } = RC.compare(appRows, refRows);
  assert.equal(rows.length, 1); // chỉ có "Thực lĩnh", không có dòng "Tiền tăng ca" giả
  assert.equal(rows[0]["Chỉ tiêu"], "Thực lĩnh");
});

test("compare (tăng ca chi tiết — CHI_TIEU_TANGCA): đối chiếu hệ số, công chuẩn 2, công TC quy đổi", () => {
  const appRows = [{
    "Mã NV": "NV001", "Họ và tên": "A", "Công tăng ca": 5, "Tiền tăng ca": 750000,
    "_ct": { maTangCa: "TC2", heSoTangCa: 0.5, congChuan2: 40, congTangCaQuyDoi: 15 },
  }];
  const refRows = [{ ma: "NV001", hoTen: "A", values: { heSoTangCa: 0.5, congChuan2: 40, congTC: 5, congTCQuyDoi: 10, tienTangCa: 750000 } }];
  const { rows } = RC.compare(appRows, refRows, RC.CHI_TIEU_TANGCA);
  const lech = rows.find((r) => r["Chỉ tiêu"] === "Công TC quy đổi");
  assert.equal(lech["Chênh lệch"], 5);
  assert.equal(lech["Loại lệch"], "Khác công thức tăng ca");
  assert.ok(rows.every((r) => r["Chỉ tiêu"] !== "Mã tăng ca")); // "soSanh:false" — không tạo dòng so sánh cho Mã tăng ca
});

test("classify: ngưỡng làm tròn khác nhau cho tiền (≤1đ) và công/tấn (≤0,01)", () => {
  assert.equal(RC.classify("Thực lĩnh", true, 1), "Khác làm tròn");
  assert.notEqual(RC.classify("Thực lĩnh", true, 2), "Khác làm tròn");
  assert.equal(RC.classify("Công BT", false, 0.01), "Khác làm tròn");
  assert.notEqual(RC.classify("Công BT", false, 0.02), "Khác làm tròn");
});
