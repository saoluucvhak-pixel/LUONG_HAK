// Bộ icon giao diện: emoji đầu nhãn → icon SVG (chỉ hiển thị, không đổi dữ liệu)
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const I = require("../../ui/icons.js");

test("U-UI-01 tách emoji đầu nhãn thành tên icon + phần chữ", () => {
  assert.deepStrictEqual(I.split("🔒 Chốt kỳ lương"), { icon: "lock", rest: "Chốt kỳ lương" });
  assert.deepStrictEqual(I.split("⬇ Xuất Excel"), { icon: "down", rest: "Xuất Excel" });
  assert.deepStrictEqual(I.split("❤️ Sức khỏe"), { icon: "heart", rest: "Sức khỏe" });
  assert.deepStrictEqual(I.split("＋ Thêm dòng"), { icon: "plus", rest: "Thêm dòng" });
  assert.deepStrictEqual(I.split("🏠"), { icon: "home", rest: "" });
});

test("U-UI-02 nhãn không có emoji / emoji chưa có icon thì giữ nguyên", () => {
  assert.strictEqual(I.split("Chốt kỳ lương"), null);
  assert.strictEqual(I.split("1.000.000"), null);
  assert.strictEqual(I.split("🦄 Không có"), null);
  assert.strictEqual(I.split(""), null);
});

test("U-UI-03 mọi emoji dùng trên giao diện (menu, nút, thẻ hồ sơ) đều có icon", () => {
  const fs = require("fs"), path = require("path");
  const src = ["app.js", "hr.js"].map((f) => fs.readFileSync(path.join(__dirname, "../..", f), "utf8")).join("\n");
  const missing = new Set();
  for (const m of src.matchAll(/["']((?:\p{Extended_Pictographic}|[⬇⬆▶↔✎✔⚠＋])️?)\s/gu)) if (!I.split(m[1] + " x")) missing.add(m[1]);
  for (const m of src.matchAll(/icon: "([^"]+)"/g)) if (!I.split(m[1] + " x")) missing.add(m[1]);
  assert.deepStrictEqual([...missing], []);
  for (const k of Object.keys(I.MAP)) assert.ok(I.names.includes(I.MAP[k]), "thiếu hình cho " + k);
});
