// R-70 (Q-29, chủ sở hữu 12/10/2026): "có trừ thuế TNCN, trong phần mềm khi chọn mã TNCN sẽ có miễn thuế nếu muốn kg trừ".
// Cùng 1 thu nhập: mã lũy tiến / vãng lai → có trừ thuế hằng tháng; mã miễn / không tính thuế → thuế = 0. Dữ liệu giả lập.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../engine.js");
const { baseDb, staff } = require("../fixtures/build.js");

function thue(ma, extraDm, quyChe) {
  const db = baseDb();
  if (extraDm) db.dm_tncn = db.dm_tncn.concat(extraDm);
  db.nhansu = [staff({ "Mã tiền lương 1": "CĐ", "Lương thỏa thuận": "40000000", "Mã TNCN": ma })];
  db.chamcong = [];
  const kq = E.tinhBangLuong(db, 2026, 9, false, quyChe ? { quyChe } : undefined), r = kq.bangluong[0];
  return { thue: r["Thuế TNCN"], tn: r["Tổng thu nhập"], canhbao: kq.canhbao, loiThue: kq.loiThue };
}

test("U-TAX-01 (R-70) mã lũy tiến / vãng lai → trừ thuế hằng tháng; mã miễn / không tính thuế → 0 (cả quy chế 2026 và cách cũ)", () => {
  [undefined, "2026"].forEach((qc) => {
    const lt = thue("LT01", null, qc), lt2 = thue("TNCN2", null, qc), vl = thue("VL01", null, qc);
    assert.ok(lt.thue > 0, "lũy tiến phải có thuế: " + lt.thue);
    assert.equal(lt2.thue, lt.thue, "mã cũ TNCN2 = lũy tiến");
    assert.equal(vl.thue, Math.round(vl.tn * 0.10), "vãng lai 10% trên tổng thu nhập");
    assert.equal(thue("MT00", null, qc).thue, 0, "mã Miễn thuế");
    assert.equal(thue("TNCN0", null, qc).thue, 0, "mã cũ TNCN0 = không tính thuế");
    // mã riêng của đơn vị (như danh mục CNHAK / HAKQN): Nội dung "Không tính thuế" → không trừ
    assert.equal(thue("KT01", [{ "Mã thuế TNCN": "KT01", "Nội dung": "Không tính thuế", "Mức thuế": 0, "Hiệu lực từ": "2025-09-01" }], qc).thue, 0);
  });
});

test("U-TAX-02 (V9.2) mã thuế không có trong DM_TNCN → TAX_CONFIG_ERROR, KHÔNG tự chọn mã khác, KHÔNG che bằng 0 im lặng", () => {
  const r = thue("XYZ");
  assert.ok(r.canhbao.some((w) => /^TAX_CONFIG_ERROR — .*mã thuế TNCN 'XYZ' không có hiệu lực/.test(w)), r.canhbao.join(" | "));
  assert.equal(r.loiThue.length, 1);
  assert.equal(r.loiThue[0].loai, "MA_THUE");
});
