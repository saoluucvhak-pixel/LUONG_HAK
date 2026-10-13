// V9.2 — DM_TNCN (cha) + DM_TNCN_BIEUTHUE (con), TAX_CONFIG_ERROR, khấu trừ vào thực lĩnh đúng 1 lần, công chuẩn = Ngày − Giảm trừ.
// Dữ liệu giả lập (không phải dữ liệu thật của công ty).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../engine.js");
const G = require("../../core/payroll-gate.js");
const { baseDb, staff } = require("../fixtures/build.js");

function run(opts) {
  const db = baseDb();
  if (opts.cha) db.dm_tncn = db.dm_tncn.concat(opts.cha);
  if (opts.con) db.dm_bacthue = (opts.thayBieu ? [] : db.dm_bacthue).concat(opts.con);
  if (opts.luong) db.dm_luong = db.dm_luong.concat(opts.luong);
  db.nhansu = [staff(Object.assign({ "Mã tiền lương 1": "CĐ", "Lương thỏa thuận": "40000000", "Mã TNCN": "LT01" }, opts.nv || {}))];
  db.chamcong = [];
  const kq = E.tinhBangLuong(db, opts.nam || 2026, opts.thang || 9, false, { quyChe: "2026" });
  return { kq, r: kq.bangluong[0], db };
}
const bac = (ma, b, tu, den, tl, extra) => Object.assign({ "Mã thuế TNCN": ma, "Bậc": b, "Thu nhập từ": tu, "Thu nhập đến": den, "Tỷ lệ": tl, "Hiệu lực từ": "2026-01-01" }, extra || {});

test("U-TAXP-01 mã thuế riêng có biểu thuế riêng (bảng con tra theo Mã thuế TNCN), mã khác không bị ảnh hưởng", () => {
  const cha = [{ "Mã thuế TNCN": "LT50", "Nội dung": "Lũy tiến biểu riêng", "Phương pháp": "LUY_TIEN", "Hiệu lực từ": "2026-01-01" }];
  const con = [bac("LT50", 1, 0, 0, 0.50)]; // 1 bậc 50% cho mọi thu nhập
  const chung = run({ nv: { "Mã TNCN": "LT01" } });
  const rieng = run({ cha, con, nv: { "Mã TNCN": "LT50" } });
  assert.ok(rieng.r["Thuế TNCN"] > chung.r["Thuế TNCN"], "biểu 50% phải thuế cao hơn biểu chung");
  assert.equal(rieng.r["_ct"].phuongPhapThue, "LT");
  assert.equal(rieng.r["_ct"].nguonThue.ma, "LT50");
  assert.equal(rieng.kq.loiThue.length, 0);
});

test("U-TAXP-02 phiên bản theo kỳ: dùng bản có Hiệu lực từ lớn nhất ≤ kỳ; bản Nháp bị bỏ qua", () => {
  const cha = [{ "Mã thuế TNCN": "LT60", "Nội dung": "Lũy tiến", "Phương pháp": "LUY_TIEN", "Hiệu lực từ": "2026-01-01" }];
  const con = [bac("LT60", 1, 0, 0, 0.10), bac("LT60", 1, 0, 0, 0.90, { "Hiệu lực từ": "2026-09-01", "Trạng thái": "Nháp" })];
  const a = run({ cha, con, nv: { "Mã TNCN": "LT60" } });
  const b = run({ cha, con: [bac("LT60", 1, 0, 0, 0.10)], nv: { "Mã TNCN": "LT60" } });
  assert.equal(a.r["Thuế TNCN"], b.r["Thuế TNCN"], "bản Nháp 90% không được áp dụng");
  const c = run({ cha, con: [bac("LT60", 1, 0, 0, 0.10), bac("LT60", 1, 0, 0, 0.20, { "Hiệu lực từ": "2026-09-01" })], nv: { "Mã TNCN": "LT60" }, thang: 9 });
  const d = run({ cha, con: [bac("LT60", 1, 0, 0, 0.10), bac("LT60", 1, 0, 0, 0.20, { "Hiệu lực từ": "2026-09-01" })], nv: { "Mã TNCN": "LT60" }, thang: 8 });
  assert.ok(c.r["Thuế TNCN"] > d.r["Thuế TNCN"], "tháng 9 dùng 20%, tháng 8 dùng 10%");
});

test("U-TAXP-03 phương pháp trừ nhanh: kết quả khớp lũy tiến từng phần khi trừ nhanh khai đúng", () => {
  const cha = [{ "Mã thuế TNCN": "TN01", "Nội dung": "Lũy tiến trừ nhanh", "Phương pháp": "LUY_TIEN_TRU_NHANH", "Hiệu lực từ": "2026-01-01" }];
  const con = [bac("TN01", 1, 0, 5000000, 0.05, { "Trừ nhanh": 0 }), bac("TN01", 2, 5000000, 10000000, 0.10, { "Trừ nhanh": 250000 }), bac("TN01", 3, 10000000, 0, 0.15, { "Trừ nhanh": 750000 })];
  assert.equal(E.tinhThueTruNhanh(8000000, con), 550000);               // 8tr×10% − 250k
  assert.equal(E.tinhThueLuyTien(8000000, con), 550000);                // 5tr×5% + 3tr×10%
  assert.equal(E.tinhThueTruNhanh(12000000, con), 1050000);             // 12tr×15% − 750k
  assert.equal(E.tinhThueLuyTien(12000000, con), 1050000);              // 250k + 500k + 2tr×15%=300k
  assert.equal(E.tinhThueTruNhanh(0, con), 0, "thu nhập tính thuế = 0 → thuế 0");
  const x = run({ cha, con, thayBieu: true, nv: { "Mã TNCN": "TN01" } });
  assert.equal(x.kq.loiThue.length, 0);
  assert.equal(x.r["_ct"].phuongPhapThue, "LT_TN");
});

test("U-TAXP-04 mã thuế rỗng / không có / đã Ngừng / Phương pháp sai → TAX_CONFIG_ERROR (không tự chọn mã khác)", () => {
  const trong = run({ nv: { "Mã TNCN": "" } });
  assert.equal(trong.kq.loiThue[0].loai, "MA_THUE");
  const khong = run({ nv: { "Mã TNCN": "KHONGCO" } });
  assert.match(khong.kq.loiThue[0].message, /không có hiệu lực/);
  const ngung = run({ cha: [{ "Mã thuế TNCN": "NG01", "Nội dung": "Lũy tiến", "Hiệu lực từ": "2026-01-01", "Trạng thái": "Ngừng" }], nv: { "Mã TNCN": "NG01" } });
  assert.match(ngung.kq.loiThue[0].message, /ngừng hiệu lực/);
  const sai = run({ cha: [{ "Mã thuế TNCN": "SAI1", "Nội dung": "x", "Phương pháp": "ABC", "Hiệu lực từ": "2026-01-01" }], nv: { "Mã TNCN": "SAI1" } });
  assert.match(sai.kq.loiThue[0].message, /Phương pháp không hợp lệ/);
  [trong, khong, ngung, sai].forEach((x) => { assert.equal(x.r["Thuế TNCN"], 0); assert.ok(x.kq.canhbao.some((w) => /^TAX_CONFIG_ERROR/.test(w))); });
});

test("U-TAXP-05 mã lũy tiến nhưng thiếu biểu thuế hiệu lực → TAX_CONFIG_ERROR BIEU_THUE; thiếu giảm trừ → GIAM_TRU", () => {
  const cha = [{ "Mã thuế TNCN": "LT70", "Nội dung": "Lũy tiến", "Phương pháp": "LUY_TIEN", "Hiệu lực từ": "2026-01-01" }];
  const x = run({ cha, con: [bac("LT70", 1, 0, 0, 0.1, { "Hiệu lực từ": "2027-01-01" })], thayBieu: true, nv: { "Mã TNCN": "LT70" } });
  assert.ok(x.kq.loiThue.some((e) => e.loai === "BIEU_THUE"));
  const y = run({ nv: { "Mã TNCN": "LT01", "Mã GT_TNCN_BT": "KHONGCO" } });
  assert.ok(y.kq.loiThue.some((e) => e.loai === "GIAM_TRU"));
});

test("U-TAXP-06 thuế khấu trừ vào thực lĩnh đúng 1 lần = kết quả công thức (không có công tắc 'có/không trừ')", () => {
  const x = run({ nv: { "Mã TNCN": "LT01", "Lương thỏa thuận": 40000000 } });
  const b = x.r;
  const cl = b["Tổng thu nhập"] - b["BH trừ NLĐ"] - b["KPCĐ trừ NLĐ"] - b["Truy thu BH"] - b["Thuế TNCN"] - b["Trừ khác"] - b["Tạm ứng"];
  assert.ok(b["Thuế TNCN"] > 0);
  assert.equal(b["Thực lĩnh"], Math.round(cl / 1000) * 1000);
  assert.equal(x.kq.tncn.length, 1);
  assert.equal(x.kq.tncn[0]["Thuế TNCN phải nộp"], b["Thuế TNCN"]);
  const mien = run({ nv: { "Mã TNCN": "MT00" } });
  assert.equal(mien.r["Thuế TNCN"], 0, "công thức ra 0 → khấu trừ 0");
});

test("U-TAXP-07 thuThuTNCN (thử tính thuế) dùng cùng đường tính với bảng lương", () => {
  const db = baseDb();
  const t = E.thuThuTNCN(db, "LT01", 2026, 9, 8000000);
  assert.equal(t.ok, true); assert.equal(t.thue, E.tinhThueLuyTien(8000000, [{ "Thu nhập từ": 0, "Thu nhập đến": 10000000, "Tỷ lệ": 0.05 }]));
  assert.equal(E.thuThuTNCN(db, "KHONGCO", 2026, 9, 1e7).ok, false);
  assert.equal(E.thuThuTNCN(db, "VL01", 2026, 9, 1e7).thue, 1000000);
  assert.equal(E.thuThuTNCN(db, "MT00", 2026, 9, 1e7).thue, 0);
});

test("U-CC-01 công chuẩn = Ngày − Giảm trừ từ mã lương (30−5=25; 30−0=30), không hard-code 25/30, không suy từ tháng", () => {
  const mk = (ma, ngay, gt) => ({ "Mã lương": ma, "Mã hình thức lương": "LTG", "Hình thức lương": ma, "Cách tính": "Cố định", "Số tiền khoán": 0, "Số ngày cơ sở": ngay, "Số ngày giảm trừ": gt, "Hiệu lực từ": "2026-01-01" });
  assert.equal(E.congChuan(mk("A", 30, 5), 9, 2026, 0, true), 25);
  assert.equal(E.congChuan(mk("B", 30, 0), 9, 2026, 0, true), 30);
  assert.equal(E.congChuan(mk("C", 28, 4), 2, 2026, 0, true), 24, "không suy từ số ngày của tháng khi mã đã khai Ngày");
  assert.equal(E.congChuan(mk("A", 30, 5), 2, 2026, 0, false), 25, "cả quy chế cũ: mã đã khai Ngày thì dùng Ngày − Giảm trừ");
  // mã chưa khai Số ngày cơ sở: giữ NGUYÊN cách tính cũ (không đổi số liệu hiện có)
  const cu = { "Mã lương": "TG3", "Cách tính": "Số ngày của tháng", "Số ngày giảm trừ": 4 };
  assert.equal(E.congChuan(cu, 9, 2026, 0, true), 26);
});

test("U-CC-02 công chuẩn bất thường (Ngày ≤ 0, Giảm trừ ≥ Ngày, không phải số) → CONG_CHUAN_ERROR, chặn chốt", () => {
  [[0, 0], [30, 30], [30, 31], ["abc", 1], [30, "x"], [30, -1]].forEach(([ngay, gt]) => {
    const x = run({ luong: [{ "Mã lương": "ZZ", "Mã hình thức lương": "LTG", "Hình thức lương": "ZZ", "Cách tính": "Cố định", "Số tiền khoán": 0, "Số ngày cơ sở": ngay, "Số ngày giảm trừ": gt, "Hiệu lực từ": "2026-01-01" }], nv: { "Mã tiền lương 1": "ZZ", "Mã TNCN": "MT00" } });
    assert.equal(x.kq.loiCongChuan.length, 1, JSON.stringify([ngay, gt]));
    assert.ok(G.blockers(x.kq).some((b) => b.code === "CONG_CHUAN_ERROR"));
  });
});

test("U-CC-03 mã lương khác nhau / kỳ khác nhau: lương theo công chuẩn thay đổi đúng, lương cố định không đổi", () => {
  const ma = (code, ngay, gt, cach) => ({ "Mã lương": code, "Mã hình thức lương": "LTG", "Hình thức lương": code, "Cách tính": cach || "Thực tế ngày công", "Số tiền khoán": 0, "Số ngày cơ sở": ngay, "Số ngày giảm trừ": gt, "Hiệu lực từ": "2026-01-01" });
  const a = run({ luong: [ma("X25", 30, 5)], nv: { "Mã tiền lương 1": "X25", "Mã TNCN": "MT00", "Lương thỏa thuận": 5000000 } });
  const b = run({ luong: [ma("X30", 30, 0)], nv: { "Mã tiền lương 1": "X30", "Mã TNCN": "MT00", "Lương thỏa thuận": 5000000 } });
  assert.equal(a.r["Công chuẩn"], 25); assert.equal(b.r["Công chuẩn"], 30);
  assert.equal(a.kq.loiCongChuan.length + b.kq.loiCongChuan.length, 0);
  const t10 = run({ luong: [ma("X25", 30, 5)], nv: { "Mã tiền lương 1": "X25", "Mã TNCN": "MT00" }, thang: 10 });
  assert.equal(t10.r["Công chuẩn"], 25, "đổi kỳ không đổi công chuẩn đã khai trong mã lương");
});

test("U-GATE-01 payroll-gate: gom FORMULA_ERROR, TAX_CONFIG_ERROR, CONG_CHUAN_ERROR, mã tăng ca thiếu; sạch → rỗng", () => {
  assert.deepEqual(G.blockers({ canhbao: [] }), []);
  const bl = G.blockers({ loiCongThuc: [{ maNV: "A", loai: "OT", maCongThuc: "X", message: "m" }], loiThue: [{ maNV: "A", maThue: "Q", message: "q" }], loiCongChuan: [{ maNV: "A", maLuong: "Z", message: "z" }], canhbao: ["A: mã tăng ca 'K' chưa có trong Danh mục tăng ca"] });
  assert.deepEqual(bl.map((b) => b.code).sort(), ["CONG_CHUAN_ERROR", "FORMULA_ERROR", "MA_TANG_CA_THIEU", "TAX_CONFIG_ERROR"]);
});
