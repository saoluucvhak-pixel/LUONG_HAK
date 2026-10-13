"use strict";
// Bằng chứng tương đương: công thức mặc định dạng dữ liệu (formula-defaults.js) == switch/case TC1–TC6 cũ của engine.js.
const test = require("node:test");
const assert = require("node:assert");
const FML = require("../../core/payroll/formula-engine.js");

// BẢN SAO NGUYÊN VĂN switch cũ (oracle) — chỉ nằm trong test.
function legacy(key, cCTL, cTC, cLe, cChuan, cCN, cTang, heSo, cPhep, cDC, congChuan2) {
  switch (key) {
    case "TC1": { var d = cCTL - cLe - cTC - cPhep - cTang - cChuan; return (d > 0 ? d * heSo : 0) + cTang * heSo; }
    case "TC2": { var chuan2 = congChuan2 > 0 ? congChuan2 : cChuan; var d2 = cCTL - cLe - cTC - cPhep - cTang - cDC - chuan2; return (d2 > 0 ? d2 * heSo : 0) + cTang * heSo; }
    case "TC6": { var d6 = cCTL - cTC - cLe - cChuan; return d6 > 0 ? d6 : 0; }
    case "TC3": return (cTang + cCN) * heSo;
    default: return cTang * heSo;
  }
}
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const q = (max) => Math.round(rnd() * max * 2) / 2; // bội số 0,5 như chấm công thật

function viaDefault(key, a) {
  const m = FML.defaults.overtime(key) || FML.defaults.OVERTIME_FALLBACK;
  return FML.evaluate(m.bieuThuc, { CONG_TINH_LUONG: a[0], CONG_TRUNG_CHUYEN: a[1], CONG_LE: a[2], CONG_CHUAN: a[3], CONG_CHU_NHAT: a[4],
    CONG_TC: a[5], HE_SO_TC: a[6], CONG_PHEP: a[7], CONG_DI_CHUYEN: a[8], CONG_CHUAN_2: a[9] });
}

["TC1", "TC2", "TC3", "TC4", "TC5", "TC6", "TC_MOI_CHUA_KHAI_BAO"].forEach((key) => {
  test("Mặc định " + key + " == switch cũ trên 3000 bộ chấm công ngẫu nhiên (bằng nhau từng bit)", () => {
    for (let i = 0; i < 3000; i++) {
      const a = [q(40), q(5), q(4), 26, q(4), q(12), [0.5, 1, 1.5, 2][i % 4], q(4), q(3), i % 3 === 0 ? 40 : 0];
      assert.strictEqual(viaDefault(key, a), legacy.apply(null, [key].concat(a)), key + " " + JSON.stringify(a));
    }
  });
});

test("TC2: có và không có Công chuẩn 2 (DQ)", () => {
  const base = [60, 0, 0, 26, 0, 4, 0.5, 0, 0];
  assert.strictEqual(viaDefault("TC2", base.concat([40])), legacy.apply(null, ["TC2"].concat(base, [40])));
  assert.strictEqual(viaDefault("TC2", base.concat([0])), legacy.apply(null, ["TC2"].concat(base, [0])));
  assert.notStrictEqual(viaDefault("TC2", base.concat([40])), viaDefault("TC2", base.concat([0])));
});

test("TC3 tính công Chủ nhật; TC6 không nhân hệ số", () => {
  assert.strictEqual(viaDefault("TC3", [26, 0, 0, 26, 3, 2, 1.5, 0, 0, 0]), 7.5);
  assert.strictEqual(viaDefault("TC6", [30, 0, 1, 26, 0, 0, 9, 0, 0, 0]), 3);
});
