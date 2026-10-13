"use strict";
const test = require("node:test"), assert = require("node:assert");
const RF = require("../../core/reporting/report-filter.js");
test("U-RF-M1: lọc nhiều khối/tổ, không dấu", () => {
  RF.setContext({ khoiOf: pb => (pb === "Kế toán" ? "VP" : "SX"), formsOf: () => [] });
  const rows = [{ "Mã NV": "A", "Phòng ban": "Kế toán" }, { "Mã NV": "B", "Phòng ban": "Sản xuất" }, { "Mã NV": "C", "Phòng ban": "Kho" }];
  const spec = RF.normalize({ khoi: ["VP"] });
  assert.ok(!RF.isEmpty(spec));
  const r = RF.apply(rows, spec);
  assert.deepStrictEqual(r.rows.map(x => x["Mã NV"]), ["A"]);
  const r2 = RF.apply(rows, RF.normalize({ khoi: ["VP", "SX"] }));
  assert.strictEqual(r2.rows.length, 3);
  assert.strictEqual(RF.fold("Kế Toán"), RF.fold("ke toan"));
});
