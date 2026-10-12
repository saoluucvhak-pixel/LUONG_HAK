// Phân bổ khối lượng như công cụ HAK (2.0-α19): chia phiếu theo tổ + NV vắng; 2 cơ chế bù lương của công cụ; đọc file mẫu công cụ
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const PA = require("../../core/production-alloc.js");
const HR = require("../../hr.js");
const E = require("../../engine.js");
const IMP = require("../../core/importer.js");
const { baseDb, staff } = require("../fixtures/build.js");

const TO = { "02.02": [{ ma: "A", hoTen: "Trần Văn Long" }, { ma: "B", hoTen: "Lê Định" }, { ma: "C", hoTen: "Phan Văn Hùng" }, { ma: "D", hoTen: "Đỗ Long" }] };
const mem = (d, pb) => TO[pb] || null;

test("U-PA-01 chia ĐỀU cho người có mặt; NV vắng so theo từ cuối, không dấu (như công cụ); nhận cả Mã NV", () => {
  const r = PA.allocate([{ phieu: 1, ngay: "2026-06-01", kl: 9, maPB: "02.02", vang: "dinh, C" }], mem);
  assert.deepEqual(r.shares.map((x) => [x.ma, x.kl]), [["A", 4.5], ["D", 4.5]]);
  assert.equal(r.audit[0].soNguoi, 2); assert.equal(r.total, 9); assert.equal(r.unallocated, 0);
});

test("U-PA-02 trùng tên cuối → cả 2 bị coi vắng + cảnh báo; tên vắng không khớp ai → cảnh báo", () => {
  const r = PA.allocate([{ phieu: 2, ngay: "2026-06-01", kl: 6, maPB: "02.02", vang: "Long; Tuấn" }], mem);
  assert.deepEqual(r.shares.map((x) => x.ma), ["B", "C"]);
  assert.match(r.warnings.join("\n"), /"Long" khớp 2 người/); assert.match(r.warnings.join("\n"), /"Tuấn" không khớp ai/);
});

test("U-PA-03 mã tổ lạ / không còn ai có mặt → chưa phân bổ, có cảnh báo, không bỏ sót", () => {
  const r = PA.allocate([{ phieu: 3, ngay: "2026-06-01", kl: 5, maPB: "09.99" }, { phieu: 4, ngay: "2026-06-01", kl: 7, maPB: "02.02", vang: "Long Định Hùng" }], mem);
  assert.equal(r.shares.length, 0); assert.equal(r.unallocated, 12); assert.equal(r.warnings.filter((w) => /chưa phân bổ/.test(w)).length, 2);
  assert.equal(r.byDept["09.99"].unallocated, 5); assert.equal(r.byDept["02.02"].unallocated, 7);
});

function hrDb() {
  const db = baseDb();
  const P = [["T1", "Trần Văn Long", "2025-01-01", ""], ["T2", "Lê Văn Định", "2025-01-01", ""], ["T3", "Phan Văn Hùng", "2026-10-03", ""], ["T4", "Ngô Minh", "2025-01-01", "2026-10-05"]];
  P.forEach(([ma, ten, vao, cd]) => {
    db.nhanvien.push({ "Mã NV": ma, "Họ và tên": ten });
    db.hopdong.push({ "Mã NV": ma, "Số HĐLĐ": ma + "/H", "Ngày vào làm": vao, "Ngày chấm dứt": cd });
    db.chitiethd.push({ "Mã NV": ma, "Số HĐLĐ": ma + "/H", "Hiệu lực từ": vao, "Phòng ban": "02.02", "Mã lương": "SP" });
  });
  // T2 điều chuyển sang tổ 02.01 từ 06/10
  db.chitiethd.push({ "Mã NV": "T2", "Số HĐLĐ": "T2/H", "Hiệu lực từ": "2026-10-06", "Phòng ban": "02.01", "Mã lương": "SP" });
  return db;
}

test("U-PA-04 tổ theo NGÀY CÂN từ hồ sơ: chưa vào làm / đã nghỉ việc / đã điều chuyển thì không nhận; phiếu ghi Mã NV giữ nguyên", () => {
  const db = hrDb();
  db.sanluong = [
    { "Phiếu cân": "P1", "Ngày cân": "2026-10-01", "KL hàng (Tấn)": "30", "Mã phòng ban": "02.02", "NV vắng": "" },   // T1 T2 T4 (T3 chưa vào)
    { "Phiếu cân": "P2", "Ngày cân": "2026-10-07", "KL hàng (Tấn)": "10", "Mã phòng ban": "02.02", "NV vắng": "" },   // T1 T3 (T4 nghỉ, T2 đã chuyển tổ)
    { "Phiếu cân": "P3", "Ngày cân": "2026-10-08", "KL hàng (Tấn)": "4", "Mã NV": "T4" },                              // giao trực tiếp
    { "Phiếu cân": "P4", "Ngày cân": "2026-09-30", "KL hàng (Tấn)": "99", "Mã phòng ban": "02.02" },                 // kỳ khác
    { "Phiếu cân": "P5", "Ngày cân": "2026-10-09", "KL hàng (Tấn)": "3" }                                             // chưa gán
  ];
  const k = HR.sanLuongKy(db, 2026, 10, "sanluong"), by = {};
  k.rows.forEach((r) => { by[r["Mã NV"]] = (by[r["Mã NV"]] || 0) + Number(r["KL hàng (Tấn)"]); });
  assert.deepEqual(by, { T4: 14, T1: 15, T2: 10, T3: 5 });
  assert.equal(k.chuaGan.length, 1); assert.equal(k.direct.length, 1);
  assert.equal(db.sanluong.length, 5, "không sửa dữ liệu gốc");
});

// ---- Bù lương: so với CÔNG THỨC CỦA CÔNG CỤ (viết lại từ code công cụ: computeLuong / slThamChieuTan) ----
const GIA = 6000; // mức sàn 200.000đ/công lấy từ danh mục chuẩn (SP)
function step(c, sun) { if (!sun) return c < 0.5 ? 0 : c < 1 ? 16.666667 : 33.333333; return c < 0.5 ? 0 : c < 1 ? 16.666667 : c < 1.5 ? 33.333333 : 49.9999999; }
function congCu(days) { let bu = 0; days.forEach((d) => { if (d.tan > 0) { const pay = d.tan * GIA, th = step(d.bt, d.sun) * GIA; bu += Math.max(pay, th) - pay; } }); return Math.round(bu); }
function app(days, mode) {
  const db = baseDb(); db.nhansu = [staff({ "Mã tiền lương 1": "SP", "Mã PB": "02.02" })];
  const rows = {}; db.sanluong = [];
  days.forEach((d) => { const ht = d.ht || "BT"; const r = rows[ht] || (rows[ht] = { "Kỳ": "2026-09", "Mã NV": "NV", "Hình thức công": ht }); r[String(d.day).padStart(2, "0")] = String(d.bt);
    if (d.tan) db.sanluong.push({ "Phiếu cân": "P" + d.day, "Ngày cân": "2026-09-" + String(d.day).padStart(2, "0"), "KL hàng (Tấn)": String(d.tan), "Mã NV": "NV" }); });
  db.chamcong = Object.values(rows);
  return E.tinhBangLuong(db, 2026, 9, mode).bangluong[0]["Lương bù SL"];
}
test("U-PA-05 bù theo ngày bậc thang (Đại Hiệp) = đúng số của công cụ ở mọi trường hợp (lẻ công, Chủ nhật, ngày không SL, ngày PN)", () => {
  const cases = [
    [{ day: 1, bt: 1, tan: 20 }], [{ day: 1, bt: 0.7, tan: 20 }], [{ day: 1, bt: 0.5, tan: 5 }], [{ day: 1, bt: 0.3, tan: 5 }],
    [{ day: 1, bt: 1, tan: 0 }], [{ day: 2, bt: 1, tan: 0, ht: "PN" }], [{ day: 1, bt: 1, tan: 40 }],
    [{ day: 6, bt: 1.5, tan: 40, sun: true }], [{ day: 6, bt: 1.2, tan: 10, sun: true }], [{ day: 6, bt: 2, tan: 10, sun: true }], [{ day: 1, bt: 1.5, tan: 10 }],
    [{ day: 1, bt: 1, tan: 10 }, { day: 2, bt: 0.5, tan: 1 }, { day: 6, bt: 1.5, tan: 5, sun: true }, { day: 7, bt: 1, tan: 0 }]
  ];
  cases.forEach((c) => assert.equal(app(c, "daihiep"), congCu(c), JSON.stringify(c)));
});

test("U-PA-06 bù theo bình quân tổ như công cụ: (mức sàn − tiền SL tổ / số ngày tháng / số người) × công BT, chỉ người đủ ngưỡng công", () => {
  const db = baseDb();
  const mk = (ma, cong) => { const r = { "Kỳ": "2026-09", "Mã NV": ma, "Hình thức công": "BT" }; for (let d = 1; d <= cong; d++) r[String(d).padStart(2, "0")] = "1"; return r; };
  db.nhansu = [staff({ "Mã nhân viên": "A", "Mã tiền lương 1": "SP", "Mã PB": "02.02" }), staff({ "Mã nhân viên": "B", "Mã tiền lương 1": "SP", "Mã PB": "02.02" }), staff({ "Mã nhân viên": "C", "Mã tiền lương 1": "SP", "Mã PB": "02.02" }), staff({ "Mã nhân viên": "X", "Mã tiền lương 1": "SP", "Mã PB": "02.01" })];
  db.chamcong = [mk("A", 20), mk("B", 10), mk("C", 16), mk("X", 20)];
  db.sanluong = [{ "Phiếu cân": "1", "Ngày cân": "2026-09-01", "KL hàng (Tấn)": "600", "Mã NV": "A" }, { "Phiếu cân": "2", "Ngày cân": "2026-09-01", "KL hàng (Tấn)": "300", "Mã NV": "B" }, { "Phiếu cân": "3", "Ngày cân": "2026-09-01", "KL hàng (Tấn)": "2000", "Mã NV": "X" }];
  const bl = E.tinhBangLuong(db, 2026, 9, "to").bangluong, bu = Object.fromEntries(bl.map((r) => [r["Mã NV"], r["Lương bù SL"]]));
  const bq = (900 * 6000) / 30 / 3; // 60.000 đ/người/ngày
  assert.equal(bu.A, Math.round((200000 - bq) * 20)); assert.equal(bu.B, 0, "10 công < ngưỡng 15"); assert.equal(bu.C, Math.round((200000 - bq) * 16));
  assert.equal(bu.X, 0, "tổ 02.01: 2000 t × 6000 / 30 / 1 = 400.000 ≥ mức sàn");
});

test("U-PA-07 2 cách bù cũ (theo tháng / theo ngày liên tục) KHÔNG đổi số", () => {
  const c = [{ day: 1, bt: 0.7, tan: 20 }, { day: 2, bt: 1, tan: 0 }];
  // danh mục chuẩn chưa đặt 'ĐK_Bù lương' → 2 cách cũ không bù (như trước α19)
  assert.equal(app(c, false), 0); assert.equal(app(c, true), 0);
});

test("U-PA-08 đọc file theo mẫu công cụ: bỏ dòng tiêu đề, nhận 'Ngày cân 1', 'Biển số 1', 'Mã phòng ban', 'NV vắng'; bơm dăm nhận 'Số xe'", () => {
  const cols = ["Phiếu cân", "Ngày cân", "Biển số", "KL hàng (Tấn)", "Mã NV", "Mã phòng ban", "NV vắng", "Cân lần 1", "Cân lần 2"];
  const aoa = [["CÔNG TY — MẪU BẢNG KHỐI LƯỢNG"], ["Kỳ báo cáo: Tháng 6"], [], ["Phiếu cân", "Ngày cân 1", "Biển số 1", "Cân lần 1", "Cân lần 2", "KL hàng (Tấn)", "Mã phòng ban", "NV vắng"], [4979, "01/06/2026", "43A", 7540, 4410, 3.13, "02.02", "Kiểu, Long"], ["", "", "", "", "", "", "", ""]];
  const r = IMP.rowsFromAoa(aoa, "sanluong", cols);
  assert.equal(r.headerRow, 4); assert.equal(r.rows.length, 1);
  assert.deepEqual(r.rows[0], { "Phiếu cân": 4979, "Ngày cân": "01/06/2026", "Biển số": "43A", "Cân lần 1": 7540, "Cân lần 2": 4410, "KL hàng (Tấn)": 3.13, "Mã phòng ban": "02.02", "NV vắng": "Kiểu, Long" });
  const b = IMP.rowsFromAoa([["Phiếu", "Ngày", "Biển số", "Cân lần 1", "Cân lần 2", "Số xe", "Mã phòng ban", "NV vắng"], [201, "01/06/2026", "43A", "", "", 1, "02.02", ""]], "bandam", cols);
  assert.equal(b.rows[0]["KL hàng (Tấn)"], 1); assert.equal(b.rows[0]["Phiếu cân"], 201); assert.equal(b.rows[0]["Ngày cân"], "01/06/2026");
  const p = IMP.plan(baseDb(), "sanluong", cols, r.rows.concat([{ "Phiếu cân": 9, "Ngày cân": "2026-06-02", "KL hàng (Tấn)": 1, "Mã phòng ban": "77.77" }]), {});
  assert.equal(p.items[0].action, "add"); assert.equal(p.items[0].row["Ngày cân"], "2026-06-01"); assert.equal(p.items[0].line, 5, "báo đúng dòng Excel");
  assert.match(p.items[1].warn, /77\.77 chưa có trong Danh mục phòng ban/);
});

test("U-PA-09 NV vắng so CÓ DẤU trước: 'Tưởng' vắng không kéo theo 'Tường'; gõ không dấu vẫn nhận (trùng thì cảnh báo)", () => {
  const mem = [{ ma: "A", hoTen: "Lê Văn Tường" }, { ma: "B", hoTen: "Trần Tưởng" }, { ma: "C", hoTen: "Ngô Đào" }];
  const r1 = PA.allocate([{ phieu: "1", ngay: "2026-07-01", kl: 30, maPB: "02.02", vang: "Tưởng" }], () => mem);
  const got = {}; r1.shares.forEach((x) => { got[x.ma] = x.kl; });
  assert.deepStrictEqual(got, { A: 15, C: 15 });
  const r2 = PA.allocate([{ phieu: "2", ngay: "2026-07-01", kl: 30, maPB: "02.02", vang: "tuong" }], () => mem); // không dấu → cả 2 vắng + cảnh báo
  assert.deepStrictEqual(r2.shares.map((x) => x.ma), ["C"]);
  assert.ok(r2.warnings.some((w) => /khớp 2 người/.test(w)));
});

test("U-PA-10 tên vắng không khớp ai (người đã nghỉ việc / chuyển tổ) → 1 cảnh báo gộp cho cả tổ, ghi đúng tên CÓ DẤU, số phiếu, khoảng ngày; phiếu vẫn chia cho người có mặt", () => {
  const rows = ["2026-09-03", "2026-09-04", "2026-09-05"].map((d, i) => ({ phieu: 12806 + i, ngay: d, kl: 8, maPB: "02.02", vang: "Đức" }));
  const r = PA.allocate(rows, mem);
  const w = r.warnings.filter((x) => /Đức/.test(x));
  assert.equal(w.length, 1, r.warnings.join("\n"));
  assert.match(w[0], /Tổ 02\.02: NV vắng "Đức" không khớp ai đang làm trong tổ — 3 phiếu \(ngày 03\/09 → 05\/09; phiếu 12806, 12807, 12808\)/);
  assert.ok(!/"duc"/.test(r.warnings.join("\n")), "không in dạng bỏ dấu");
  assert.equal(r.shares.filter((x) => x.phieu === 12806).length, 4); // vẫn chia đủ 4 người có mặt
  assert.match(r.audit[0].note, /"Đức" không khớp/); // chi tiết từng phiếu vẫn còn ở bảng đối soát
});

// Chủ sở hữu 12/10/2026: "ông Đức xin nghỉ không lương … phải có giải pháp với người nghỉ không lương" — duyệt: mọi loại nghỉ đã duyệt
test("U-PA-11 người có đơn nghỉ ĐÃ DUYỆT (không lương, chưa biết ngày về) → tự loại khỏi tổ ngày nghỉ; phiếu ghi vắng người đó không cảnh báo; đơn chờ duyệt / từ chối không loại", () => {
  const db = hrDb();
  db.nhanvien.push({ "Mã NV": "D", "Họ và tên": "Trần Văn Đức" });
  db.hopdong.push({ "Mã NV": "D", "Số HĐLĐ": "D/H", "Ngày vào làm": "2025-01-01", "Ngày chấm dứt": "" });
  db.chitiethd.push({ "Mã NV": "D", "Số HĐLĐ": "D/H", "Hiệu lực từ": "2025-01-01", "Phòng ban": "02.02", "Mã lương": "SP" });
  db.nghiphep = [{ "Mã NV": "D", "Số HĐLĐ": "D/H", "Loại nghỉ": "Nghỉ không hưởng lương", "Từ ngày": "2026-10-03", "Đến ngày": "", "Trạng thái duyệt": "Đã duyệt" },
    { "Mã NV": "T1", "Số HĐLĐ": "T1/H", "Loại nghỉ": "Nghỉ hằng năm", "Từ ngày": "2026-10-04", "Đến ngày": "2026-10-04", "Trạng thái duyệt": "Chờ duyệt" }];
  db.nghiom = [{ "Mã NV": "T1", "Số HĐLĐ": "T1/H", "Từ ngày": "2026-10-09", "Đến ngày": "2026-10-09", "Trạng thái duyệt": "Đã duyệt" }];
  db.sanluong = [
    { "Phiếu cân": "P1", "Ngày cân": "2026-10-02", "KL hàng (Tấn)": "30", "Mã phòng ban": "02.02", "NV vắng": "" },     // T1 T2 T4 D (D chưa nghỉ)
    { "Phiếu cân": "P2", "Ngày cân": "2026-10-03", "KL hàng (Tấn)": "30", "Mã phòng ban": "02.02", "NV vắng": "" },     // T1 T2 T3 T4 — D nghỉ, phiếu không ghi vắng
    { "Phiếu cân": "P3", "Ngày cân": "2026-10-04", "KL hàng (Tấn)": "40", "Mã phòng ban": "02.02", "NV vắng": "Đức" },  // T1 T2 T3 T4 — đơn T1 chờ duyệt: vẫn chia
    { "Phiếu cân": "P4", "Ngày cân": "2026-10-20", "KL hàng (Tấn)": "10", "Mã phòng ban": "02.02", "NV vắng": "" },     // T1 T3 — D nghỉ (chưa biết ngày về)
    { "Phiếu cân": "P5", "Ngày cân": "2026-10-09", "KL hàng (Tấn)": "8", "Mã phòng ban": "02.02", "NV vắng": "" }      // T3 — T1 nghỉ ốm đã duyệt
  ];
  const k = HR.sanLuongKy(db, 2026, 10, "sanluong"), by = {};
  k.rows.forEach((r) => { by[r["Mã NV"]] = (by[r["Mã NV"]] || 0) + Number(r["KL hàng (Tấn)"]); });
  assert.equal(by.D, 7.5, "chỉ nhận phiếu trước ngày nghỉ (30 / 4)");
  assert.equal(by.T1, 7.5 + 7.5 + 10 + 5, "T1: P1 + P2 + P3 (đơn chờ duyệt không loại) + P4; P5 nghỉ ốm");
  assert.equal(by.T3, 7.5 + 10 + 5 + 8);
  assert.ok(!k.alloc.warnings.some((w) => /Đức/.test(w)), k.alloc.warnings.join("\n"));
  assert.match(k.alloc.audit.find((a) => a.phieu === "P3").note, /"Đức" đang nghỉ \(Nghỉ không hưởng lương, đơn đã duyệt\)/);
  const d = k.alloc.nghi.find((x) => x.ma === "D");
  assert.deepEqual([d.loai, d.ngay], ["Nghỉ không hưởng lương", ["2026-10-03", "2026-10-04", "2026-10-09", "2026-10-20"]]);
  assert.deepEqual(HR.nghiNgay(db, "D", "2026-12-31"), { loai: "Nghỉ không hưởng lương", tu: "2026-10-03", den: "" });
  assert.equal(HR.nghiNgay(db, "D", "2026-10-02"), null);
});

// Chủ sở hữu 12/10/2026: "1. công > 0 thì chia sản lượng (không quan tâm 0,5 hay 0,3) … chia theo danh sách nghỉ; 2. công = 0 thì cảnh báo, coi như nghỉ nguyên ngày, không được chia"
test("U-PA-12 (R-73) chia theo chấm công: công > 0 (kể cả 0,3) → chia ĐỀU; công 0 / trống → không chia + báo; vẫn trừ NV vắng trên phiếu; ngày cả tổ chưa có chấm công → chia theo NV vắng + cảnh báo", () => {
  const db = hrDb(); // tổ 02.02 ngày 01/10: T1 Long, T2 Định, T4 Minh (T3 chưa vào làm)
  const cc = (ma, ht, days) => { const r = { "Kỳ": "2026-10", "Mã NV": ma, "Hình thức công": ht }; Object.keys(days).forEach((d) => { r[String(d).padStart(2, "0")] = days[d]; }); return r; };
  db.chamcong = [cc("T1", "BT", { 1: "0,3", 2: "1" }), cc("T2", "BT", { 1: "1", 2: "0" }), cc("T4", "PN", { 1: "1" }), cc("T4", "BT", { 2: "1" })];
  db.sanluong = [
    { "Phiếu cân": "P1", "Ngày cân": "2026-10-01", "KL hàng (Tấn)": "30", "Mã phòng ban": "02.02", "NV vắng": "" },     // T1 (0,3) + T2; T4 chỉ có PN = nghỉ
    { "Phiếu cân": "P2", "Ngày cân": "2026-10-02", "KL hàng (Tấn)": "20", "Mã phòng ban": "02.02", "NV vắng": "Minh" }, // T1; T2 công 0; T4 có công nhưng phiếu ghi vắng
    { "Phiếu cân": "P3", "Ngày cân": "2026-10-03", "KL hàng (Tấn)": "9", "Mã phòng ban": "02.02", "NV vắng": "" }       // cả tổ chưa có chấm công ngày 03 → chia theo NV vắng (T1 T2 T3 T4)
  ];
  const k = HR.sanLuongKy(db, 2026, 10, "sanluong"), by = {};
  k.rows.forEach((r) => { by[r["Mã NV"]] = (by[r["Mã NV"]] || 0) + Number(r["KL hàng (Tấn)"]); });
  assert.deepEqual(by, { T1: 15 + 20 + 2.25, T2: 15 + 2.25, T3: 2.25, T4: 2.25 }); // P3 ngày 03: T3 vào làm → 4 người
  const kc = k.alloc.nghi.filter((x) => x.khongCong).map((x) => [x.ma, x.ngay]);
  assert.deepEqual(kc, [["T4", ["2026-10-01"]], ["T2", ["2026-10-02"]]]);
  assert.match(k.alloc.warnings.join("\n"), /Tổ 02\.02: chưa có chấm công 1 ngày có phiếu \(03\/10\)/);
  assert.ok(!/không khớp ai/.test(k.alloc.warnings.join("\n")), "NV vắng Minh vẫn khớp");
});

test("U-PA-13 phiếu ghi vắng \"Tưởng\" mà Tưởng không có công (đã loại) → KHÔNG bắt nhầm sang \"Tường\" (so có dấu trên cả người đã loại)", () => {
  const TO2 = { "02.02": Object.assign([{ ma: "A", hoTen: "Nguyễn Văn Tường" }, { ma: "C", hoTen: "Lê Hùng" }], { nghi: [{ ma: "B", hoTen: "Trần Tưởng", loai: "Không có công (chấm công = 0 / trống)", khongCong: true }] }) };
  const r = PA.allocate([{ phieu: 1, ngay: "2026-07-01", kl: 10, maPB: "02.02", vang: "Tưởng" }], (d, pb) => TO2[pb] || null);
  assert.deepEqual(r.shares.map((x) => [x.ma, x.kl]), [["A", 5], ["C", 5]]);
  assert.deepEqual(r.warnings, []); assert.deepEqual(r.nghi, []); // đã ghi vắng → không báo thêm
});
