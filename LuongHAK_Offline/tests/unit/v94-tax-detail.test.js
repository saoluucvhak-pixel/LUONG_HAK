// V9.4 — ba chỉ tiêu thuế tách riêng, TAX_CONFIG_CONFLICT / thiếu bậc, biên bậc, đổi mã giữa kỳ, NPT, kỳ chốt. Dữ liệu giả lập.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../engine.js");
const G = require("../../core/payroll-gate.js");
const { baseDb, staff } = require("../fixtures/build.js");

const bac = (ma, b, tu, den, tl, x) => Object.assign({ "Mã thuế TNCN": ma, "Bậc": b, "Thu nhập từ": tu, "Thu nhập đến": den, "Tỷ lệ": tl, "Hiệu lực từ": "2026-01-01" }, x || {});
function run(con, nv, thang, mod) {
  const db = baseDb();
  db.dm_tncn = db.dm_tncn.concat([{ "Mã thuế TNCN": "TX", "Nội dung": "Lũy tiến", "Phương pháp": "LUY_TIEN", "Hiệu lực từ": "2026-01-01" }]);
  db.dm_bacthue = con; // thay hẳn biểu chung
  db.nhansu = [staff(Object.assign({ "Mã tiền lương 1": "CĐ", "Lương thỏa thuận": "40000000", "Mã TNCN": "TX" }, nv || {}))];
  db.chamcong = []; if (mod) mod(db);
  const kq = E.tinhBangLuong(db, 2026, thang || 9, false, { quyChe: "2026" });
  return { kq, r: kq.bangluong[0], db };
}
const ok3 = [bac("TX", 1, 0, 10000000, 0.05), bac("TX", 2, 10000000, 30000000, 0.10), bac("TX", 3, 30000000, 0, 0.20)];

test("U-TAX94-01 ba chỉ tiêu tách riêng và nhất quán: chịu thuế − giảm trừ = tính thuế", () => {
  const { r, kq } = run(ok3);
  const c = r._ct;
  assert.equal(kq.loiThue.length, 0);
  assert.ok(c.thuNhapChiuThue >= c.thuNhapTinhThue);
  assert.equal(c.thuNhapTinhThue, Math.max(0, c.thuNhapChiuThue - c.giamTruBanThan - c.giamTruPhuThuoc));
  assert.equal(r["Thuế TNCN"], E.thuThuTNCN(baseDbWith(ok3), "TX", 2026, 9, c.thuNhapTinhThue).thue);
});
function baseDbWith(con) { const db = baseDb(); db.dm_tncn = db.dm_tncn.concat([{ "Mã thuế TNCN": "TX", "Phương pháp": "LUY_TIEN", "Hiệu lực từ": "2026-01-01" }]); db.dm_bacthue = con; return db; }

test("U-TAX94-02 bậc chồng nhau → TAX_CONFIG_CONFLICT, chặn chốt, không tính thuế âm thầm", () => {
  const { kq } = run([bac("TX", 1, 0, 15000000, 0.05), bac("TX", 2, 10000000, 30000000, 0.10), bac("TX", 3, 30000000, 0, 0.2)]);
  assert.ok(kq.loiThue.some((e) => e.loai === "CONFLICT" && /TAX_CONFIG_CONFLICT/.test(e.message)));
  const b = G.blockers(kq).map((x) => x.code);
  assert.ok(b.includes("TAX_CONFIG_CONFLICT"));
});

test("U-TAX94-03 hở khoảng giữa các bậc → TAX_CONFIG_ERROR (không có bậc phù hợp)", () => {
  const { kq } = run([bac("TX", 1, 0, 10000000, 0.05), bac("TX", 2, 12000000, 30000000, 0.10), bac("TX", 3, 30000000, 0, 0.2)]);
  assert.ok(kq.loiThue.some((e) => /hở khoảng/.test(e.message)));
  assert.ok(G.blockers(kq).some((x) => x.code === "TAX_CONFIG_ERROR"));
});

test("U-TAX94-04 tỷ lệ ngoài 0–100% bị chặn", () => {
  const { kq } = run([bac("TX", 1, 0, 0, 1.5)]);
  assert.ok(kq.loiThue.length > 0);
});

test("U-TAX94-05 thuế bằng 0 khi thu nhập tính thuế ≤ 0 và biên bậc đúng (đúng 10.000.000 vẫn bậc 1)", () => {
  const db = baseDbWith(ok3);
  assert.equal(E.thuThuTNCN(db, "TX", 2026, 9, 0).thue, 0);
  assert.equal(E.thuThuTNCN(db, "TX", 2026, 9, 10000000).thue, 500000);
  assert.equal(E.thuThuTNCN(db, "TX", 2026, 9, 10000001).thue, 500000 + 0); // 1đ vào bậc 2 = 0,1đ → làm tròn 0
  assert.equal(E.thuThuTNCN(db, "TX", 2026, 9, 30000000).thue, 500000 + 2000000);
  assert.equal(E.thuThuTNCN(db, "TX", 2026, 9, 40000000).thue, 500000 + 2000000 + 2000000);
});

test("U-TAX94-06 đổi người phụ thuộc làm đổi giảm trừ & thu nhập tính thuế, thuế không tăng khi thêm NPT", () => {
  const a = run(ok3, { "Người phụ thuộc": 0 }).r, b = run(ok3, { "Người phụ thuộc": 2 }).r;
  assert.ok(b._ct.giamTruPhuThuoc > a._ct.giamTruPhuThuoc);
  assert.ok(b._ct.thuNhapTinhThue <= a._ct.thuNhapTinhThue);
  assert.ok(b["Thuế TNCN"] <= a["Thuế TNCN"]);
});

test("U-TAX94-07 đổi biểu giữa hai kỳ: kỳ trước giữ biểu cũ, kỳ sau dùng biểu mới theo Hiệu lực từ", () => {
  const con = ok3.concat([bac("TX", 1, 0, 10000000, 0.50, { "Hiệu lực từ": "2026-09-01" })]);
  const t8 = run(con, null, 8).r["Thuế TNCN"], t9 = run(con, null, 9).r["Thuế TNCN"];
  assert.ok(t9 > t8, "bậc 1 tăng lên 50% từ tháng 9");
});

test("U-TAX94-08 mã thuế thiếu → TAX_CONFIG_ERROR, không tự chọn mã khác", () => {
  const { kq } = run(ok3, { "Mã TNCN": "" });
  assert.ok(G.blockers(kq).some((x) => x.code === "TAX_CONFIG_ERROR"));
});
