"use strict";
const test = require("node:test"), assert = require("node:assert");
const path = require("path");
const ExcelJS = require(path.join(__dirname, "../../exceljs.min.js"));
const SX = require("../../ui/slip-xlsx.js");

const vm = (n) => ({ congTy: "CÔNG TY TEST", kyText: "tháng 9/2026", trangThai: "Bảng lương đã chốt", rawCols: ["Mã NV", "Thực lĩnh"],
  rawRows: Array.from({ length: n }, (_, i) => ({ "Mã NV": "00" + i, "Thực lĩnh": 1000000 + i })),
  slips: Array.from({ length: n }, (_, i) => ({ maNV: "00" + i, hoTen: "NV " + i, phongBan: "PB", tongCong: 26, congChuan: 26,
    lines: [{ label: "Lương thời gian", value: 15000000 }, { label: "TỔNG THU NHẬP", value: 15000000, tot: true }, { label: "THỰC LĨNH", value: 14000000, tot: true }] })) });

test("U-V10-SLIP-01: mỗi phiếu một khối, tiêu đề IN HOA, số tiền là số, Mã NV giữ chữ", async () => {
  const wb = SX.build(ExcelJS, vm(3), { perPage: 1 });
  const buf = await wb.xlsx.writeBuffer(); const w2 = new ExcelJS.Workbook(); await w2.xlsx.load(buf);
  const ws = w2.worksheets[0];
  let titles = 0, money = 0;
  ws.eachRow((row) => { const v = String(row.getCell(1).value || ""); if (/^PHIẾU LƯƠNG THÁNG 9\/2026$/.test(v)) titles++; if (row.getCell(2).value === "THỰC LĨNH") { money++; assert.strictEqual(row.getCell(3).value, 14000000); } });
  assert.strictEqual(titles, 3); assert.strictEqual(money, 3);
  assert.strictEqual(w2.worksheets[1].getCell("A2").value, "000");
});
test("U-V10-SLIP-02: in gọn 2 phiếu/trang có ngắt trang, 1 phiếu/trang ngắt sau mỗi phiếu", async () => {
  const n = (per) => { const ws = SX.build(ExcelJS, vm(4), { perPage: per }).worksheets[0]; let b = 0; ws.eachRow({ includeEmpty: true }, (row) => { if (row.getCell(1).value === null && row.break) b++; }); return ws.rowBreaks ? ws.rowBreaks.length : b; };
  assert.strictEqual(n(1), 3); assert.strictEqual(n(2), 1);
});
