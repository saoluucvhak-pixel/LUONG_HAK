// Hướng dẫn & Dự thảo Quy chế: nội dung phải KHỚP công thức engine và danh mục đang dùng (không tự sáng tạo quy định)
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const G = require("../../ui/guide.js");
const E = require("../../engine.js");
const F = require("../fixtures/build.js");

test("U-GUIDE-01 mô tả công chuẩn trong quy chế = đúng số engine.congChuan tính (tháng 9/2026: 30 ngày, 4 Chủ nhật)", () => {
  const db = F.baseDb();
  for (const r of db.dm_luong) {
    const txt = G.congChuanText(r["Cách tính"]), eng = E.congChuan(r, 9, 2026, 0);
    if (/thực tế|sản lượng/.test(txt)) continue;
    let exp;
    if (/số ngày của tháng \(28–31\)/.test(txt)) exp = 30;
    else { const m = /số Chủ nhật − (\d+)/.exec(txt); exp = 30 - 4 - (m ? +m[1] : 0); }
    assert.equal(eng, exp, r["Mã lương"] + ": " + txt);
  }
});

test("U-GUIDE-02 quy chế lấy số liệu từ danh mục đang hiệu lực của kỳ (đổi danh mục → quy chế đổi theo)", () => {
  const db = F.baseDb();
  const html = G.section("rules", { db, E, nam: 2026, thang: 9, congTy: { "Tên công ty": "Công ty Thử" } });
  for (const s of ["CÔNG TY THỬ", "TG1", "TN.02", "TC1", "BH01", "17,5%", "8%", "LT01", "VL01", "GTBT", "Q-02", "Q-17", "Điều 96"]) assert.ok(html.includes(s), "thiếu " + s);
  // biểu thuế theo hiệu lực: 2026 khác 12/2025 (đổi biểu từ 01/2026)
  assert.notEqual(G.section("rules", { db, E, nam: 2025, thang: 12, congTy: {} }).match(/<td>\d<\/td>/g).length, html.match(/<td>\d<\/td>/g).length);
  // mức phụ cấp mới có hiệu lực từ 10/2026 → quy chế kỳ 10 hiện mức mới, kỳ 9 vẫn mức cũ
  db.dm_phucap.push({ "Mã phụ cấp": "TN.03", "Tên phụ cấp": "Phụ cấp trách nhiệm Quản lý", "Số tiền": 1500000, "Cách tính": "Cố định hàng tháng", "Hiệu lực từ": "2026-10-01" });
  assert.ok(G.section("rules", { db, E, nam: 2026, thang: 10, congTy: {} }).includes("1.500.000"));
  assert.ok(!G.section("rules", { db, E, nam: 2026, thang: 9, congTy: {} }).includes("1.500.000"));
});

test("U-GUIDE-03 mọi câu hỏi [Q-xx] nêu trong quy chế đều có trong BUSINESS_RULES; nội dung không có HTML lạ từ dữ liệu", () => {
  const db = F.baseDb(); db.dm_phucap.push({ "Mã phụ cấp": "<img src=x onerror=alert(1)>", "Tên phụ cấp": "<script>x</script>", "Số tiền": 1, "Hiệu lực từ": "2020-01-01" });
  const html = G.section("rules", { db, E, nam: 2026, thang: 9, congTy: { "Tên công ty": "<b>X</b>" } });
  assert.ok(!/<script>|<img src=x/.test(html), "phải escape dữ liệu người dùng");
  const br = fs.readFileSync(path.join(__dirname, "../../../docs/BUSINESS_RULES.md"), "utf8");
  for (const q of new Set(html.match(/Q-\d\d/g))) assert.ok(br.includes("| " + q + " |"), q + " chưa có trong BUSINESS_RULES.md");
  for (const k of G.TABS.map((t) => t[0])) assert.ok(G.section(k, { db, E, nam: 2026, thang: 9, congTy: {} }).length > 500, k);
  assert.match(G.regulationDoc({ db, E, nam: 2026, thang: 9, congTy: {} }), /^<html>.*<meta charset='utf-8'>/s);
});
