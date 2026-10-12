// Kiểm thử hồi quy: so sánh kết quả engine hiện tại với engine v1.3.0 (commit 78a612c, lưu nguyên trong baseline_v1.3.0/)
// Mọi khác biệt phải được phân loại; khác biệt chưa giải thích → test FAIL.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../engine.js"), HR = require("../../hr.js");
const E0 = require("./baseline_v1.3.0/engine.js"), HR0 = require("./baseline_v1.3.0/hr.js");
const { regressionDataset } = require("../fixtures/build.js");

function runBoth(db, nam, thang) {
  const sp0 = HR0.staffForPayroll(db, nam, thang), sp = HR.staffForPayroll(db, nam, thang);
  const a = E0.tinhBangLuong(Object.assign({}, db, { nhansu: sp0.list }), nam, thang, false);
  const b = E.tinhBangLuong(Object.assign({}, db, { nhansu: sp.list }), nam, thang, false);
  return { a, b, sp0, sp };
}

function stripKpcd(rows, key) { return rows.map((r) => { const o = Object.assign({}, r); delete o[key]; return o; }); }

test("bộ dữ liệu chuẩn (80 NV × 3 kỳ, số liệu dạng số thuần): kết quả tiền lương TRÙNG KHỚP 100% với v1.3.0", () => {
  const db = regressionDataset(80);
  let people = 0;
  [[2026, 8], [2026, 9], [2026, 10]].forEach(([y, m]) => {
    const { a, b, sp0, sp } = runBoth(JSON.parse(JSON.stringify(db)), y, m);
    // Khác biệt CÓ CHỦ ĐÍCH: cột mới "Số sổ BHXH" (PV-7a, truyền từ canhan sang nhansu để báo cáo BHXH
    // không thiếu cột này) — dữ liệu mẫu không có canhan."Số sổ BHXH" nên luôn rỗng, không đổi số liệu
    sp.list.forEach((r) => assert.equal(r["Số sổ BHXH"], "", "Số sổ BHXH " + m + "/" + y));
    assert.deepEqual(stripKpcd(sp.list, "Số sổ BHXH"), sp0.list, "danh sách nhân sự tính lương " + m + "/" + y);
    // Khác biệt CÓ CHỦ ĐÍCH: cột mới "KPCĐ trừ NLĐ" / "NLĐ.KPCĐ" (tách riêng khỏi "BH trừ NLĐ", sửa lỗi
    // KPCĐ NLĐ) — dữ liệu mẫu (BH00/BH01) có NLD.KPCD = 0 nên không đổi số tiền, v1.3.0 chưa có cột này
    b.bangluong.forEach((r) => assert.equal(r["KPCĐ trừ NLĐ"], 0, "KPCĐ trừ NLĐ " + m + "/" + y));
    b.bhxh.forEach((r) => assert.equal(r["NLĐ.KPCĐ"], 0, "NLĐ.KPCĐ " + m + "/" + y));
    // Khác biệt CÓ CHỦ ĐÍCH: CN1/CN2 tăng ca giờ nhân đúng hệ số của mã tăng ca (chủ sở hữu xác nhận,
    // đối chiếu M thật QR_LUONGTG."Lương tăng ca") — v1.3.0 nhân thẳng công tăng ca thô (lỗi, trả gấp
    // 1/hệ số cho người có hệ số ≠ 100%). Công thức chính xác có test riêng (tests/unit/engine.test.js) —
    // ở đây loại "Tiền tăng ca" và các cột cộng dồn từ nó (Tổng thu nhập, Thuế TNCN, Thực lĩnh) khỏi so
    // sánh hàng loạt cho ĐÚNG những người bị ảnh hưởng (Mã NV có "Tiền tăng ca" đổi khác).
    const tcKeys = ["Tiền tăng ca", "Tổng thu nhập", "Thuế TNCN", "Thực lĩnh"];
    const nvTcKhacNhau = {};
    b.bangluong.forEach((rb) => {
      const ra = a.bangluong.find((r) => r["Mã NV"] === rb["Mã NV"]);
      if (ra && ra["Tiền tăng ca"] !== rb["Tiền tăng ca"]) nvTcKhacNhau[rb["Mã NV"]] = true;
    });
    const stripTC = (rows) => rows.map((r) => { if (!nvTcKhacNhau[r["Mã NV"]]) return r; const o = Object.assign({}, r); tcKeys.forEach((k) => delete o[k]); return o; });
    // Cột mới "_ct" (Master Prompt mục 16.3, PV-13) — chỉ chứa biến trung gian để UI giải thích công
    // thức, không phải số tiền; v1.3.0 không có cột này — strip trước khi so.
    assert.deepEqual(stripTC(stripKpcd(stripKpcd(b.bangluong, "KPCĐ trừ NLĐ"), "_ct")), stripTC(a.bangluong), "bảng lương " + m + "/" + y);
    // "Số sổ BHXH" (PV-7a) cũng mới, luôn rỗng với dữ liệu mẫu — strip trước khi so với baseline
    b.bhxh.forEach((r) => assert.equal(r["Số sổ BHXH"], "", "Số sổ BHXH (BHXH) " + m + "/" + y));
    assert.deepEqual(stripKpcd(stripKpcd(b.bhxh, "NLĐ.KPCĐ"), "Số sổ BHXH"), a.bhxh, "BHXH " + m + "/" + y);
    // Thuế TNCN của người bị ảnh hưởng bởi lỗi tăng ca CN1/CN2 (xem trên) cũng đổi theo — loại khỏi so sánh
    const tncnKhongBiAnhHuong = (rows) => rows.filter((r) => !nvTcKhacNhau[r["Mã NV"]]);
    assert.deepEqual(tncnKhongBiAnhHuong(b.tncn), tncnKhongBiAnhHuong(a.tncn), "TNCN " + m + "/" + y);
    // Cảnh báo: bản mới chỉ được THÊM cảnh báo (có chủ đích), không được mất cảnh báo cũ
    a.canhbao.forEach((w) => assert.ok(b.canhbao.indexOf(w) >= 0, "mất cảnh báo: " + w));
    people += b.bangluong.length;
  });
  assert.ok(people > 200, "bộ dữ liệu đủ lớn: " + people);
});

test("khác biệt CÓ CHỦ ĐÍCH: số tiền nhập dạng VN '500.000' (BUG-002)", () => {
  const db = regressionDataset(10);
  db.psluong = [{ "Ngày hạch toán": "2026-09-28", "Mã NV": "NV001", "Thưởng": "500.000", "Thu nhập khác": "0", "Trừ khác": "0" }];
  const { a, b } = runBoth(db, 2026, 9);
  const ra = a.bangluong.find((r) => r["Mã NV"] === "NV001"), rb = b.bangluong.find((r) => r["Mã NV"] === "NV001");
  assert.equal(ra["Thưởng"], 500, "v1.3.0 hiểu sai thành 500đ");
  assert.equal(rb["Thưởng"], 500000, "bản sửa hiểu đúng 500.000đ");
  // Ngoài NV001, mọi người khác không đổi (ngoại trừ cột mới "KPCĐ trừ NLĐ" = 0, và 3 cột tăng ca CN1/CN2
  // đã sửa đúng hệ số — xem test trên)
  a.bangluong.filter((r) => r["Mã NV"] !== "NV001").forEach((r) => {
    const rb = Object.assign({}, b.bangluong.find((x) => x["Mã NV"] === r["Mã NV"]));
    delete rb["KPCĐ trừ NLĐ"]; delete rb["_ct"];
    ["Tiền tăng ca", "Tổng thu nhập", "Thuế TNCN", "Thực lĩnh"].forEach((k) => { delete rb[k]; delete r[k]; });
    assert.deepEqual(rb, r);
  });
});
