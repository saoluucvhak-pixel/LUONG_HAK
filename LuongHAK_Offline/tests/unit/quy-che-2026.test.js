// Quy chế lương HAK Group 2026 (R-68, chủ sở hữu duyệt 11/10/2026: HAK, CNHAK, HAKQN như nhau) — engine 1.8.0, opts.quyChe = "2026".
// Kỳ vọng TÍNH TAY; tháng 9/2026 có 30 ngày, 4 Chủ nhật (6, 13, 20, 27). Không bật quy chế = số như engine 1.7 (test cũ giữ nguyên).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../engine.js");
const HR = require("../../hr.js");
const CLS = require("../../core/payroll-close.js");
const { baseDb, ccRow, staff } = require("../fixtures/build.js");

const Q = { quyChe: "2026" };
function run(staffList, extra, opts, bu) {
  const db = Object.assign(baseDb(), extra || {});
  db.nhansu = staffList;
  return E.tinhBangLuong(db, 2026, 9, bu === undefined ? false : bu, opts);
}
const row = (kq, ma) => kq.bangluong.find((r) => r["Mã NV"] === (ma || "NV"));
/** Dòng chấm công: ngày → giá trị (VD { 1: 1, 2: 1 }) */
function cc(ma, ht, days) { const r = { "Kỳ": "2026-09", "Mã NV": ma, "Hình thức công": ht }; Object.keys(days).forEach((d) => { r[String(d).padStart(2, "0")] = days[d]; }); return r; }
const allDays = (v) => { const o = {}; for (let d = 1; d <= 30; d++) o[d] = v; return o; };

test("U-QC-01 (C2) công chuẩn = số ngày − Số ngày giảm trừ; 'tất cả ngày CN' = trừ Chủ nhật; cách cũ không đổi", () => {
  const L = {}; baseDb().dm_luong.forEach((r) => { L[r["Mã lương"]] = r; });
  assert.equal(E.congChuan(L.TG1, 9, 2026, 20, true), 26);
  assert.equal(E.congChuan(L.TG2, 9, 2026, 20, true), 30);
  assert.equal(E.congChuan(L.TG3, 9, 2026, 20, true), 26); // 30 − 4 (cách cũ: 22)
  assert.equal(E.congChuan(L.TG4, 9, 2026, 20, true), 28); // 30 − 2 (cách cũ: 24)
  assert.equal(E.congChuan(L.CN1, 9, 2026, 20, true), 30); // (C9) công nhật: số ngày − Số ngày giảm trừ (CN1 không có → 30)
  assert.equal(E.congChuan(L.CN2, 9, 2026, 20, true), 26); // CN2: 30 − 4
  assert.equal(E.congChuan(L.CN1, 9, 2026, 20), 20); // cách cũ: thực tế ngày công
  assert.equal(E.congChuan(L.TG3, 9, 2026, 20), 22);
  assert.equal(E.ngayGiamTru(L.CN2), 4);
  assert.equal(E.ngayGiamTru({ "Cách tính": "Số ngày của tháng - 3" }), 3); // không có cột → số sau dấu "-"
  assert.equal(E.ngayGiamTru({ "Ngày giảm trừ": 5, "Cách tính": "" }), 5); // tên cột cũ trong Excel
});

test("U-QC-02 (C1) lương thời gian trả đủ công đi làm, không cắt ở công chuẩn", () => {
  const s = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000" })], ex = { chamcong: [cc("NV", "BT", allDays(1))] };
  assert.equal(row(run(s, ex, Q))["Lương thời gian"], Math.round(9000000 / 26 * 30)); // 10.384.615
  assert.equal(row(run(s, ex))["Lương thời gian"], 9000000); // cách cũ: tối đa công chuẩn
});

test("U-QC-03 (C3) công nhân sản phẩm: lương thời gian chỉ cho công lễ + phép", () => {
  const d = allDays(1); delete d[2]; [6, 13, 20, 27].forEach((x) => delete d[x]); // 25 công BT
  const s = [staff({ "Mã tiền lương 1": "SP", "Lương thỏa thuận": "200000" })];
  const ex = { chamcong: [cc("NV", "BT", d), cc("NV", "CL", { 2: 1 }), cc("NV", "PN", { 3: 1 })] };
  delete ex.chamcong[0]["03"];
  assert.equal(row(run(s, ex, Q))["Lương thời gian"], 400000); // (1 lễ + 1 phép) × 200.000
  assert.equal(row(run(s, ex))["Lương thời gian"], 200000 * 26); // cách cũ
});

test("U-QC-04 (C4) bù bình quân tổ: tiền của tổ chỉ tính sản lượng (không cộng bơm dăm)", () => {
  const s = ["A", "B"].map((m) => staff({ "Mã nhân viên": m, "Mã PB": "02.01", "Mã tiền lương 1": "SP", "Mã tiền lương 2": "BD" }));
  const ex = { chamcong: [ccRow("A", 2026, 9, "BT", 1, 20), ccRow("B", 2026, 9, "BT", 1, 20)],
    sanluong: [{ "Ngày cân": "2026-09-05", "KL hàng (Tấn)": "30", "Mã NV": "A" }, { "Ngày cân": "2026-09-05", "KL hàng (Tấn)": "30", "Mã NV": "B" }],
    bandam: [{ "Ngày cân": "2026-09-05", "KL hàng (Tấn)": "10", "Mã NV": "A" }] };
  // tổ: 60 tấn × 6.000 = 360.000 / 30 ngày / 2 người = 6.000 → bù (200.000 − 6.000) × 20 công BT
  assert.equal(row(run(s, ex, Q, "to"), "A")["Lương bù SL"], 194000 * 20);
  assert.equal(row(run(s, ex, Q, "to"), "A")["Lương bơm dăm"], 100000); // bơm dăm vẫn trả riêng
  assert.equal(row(run(s, ex, undefined, "to"), "A")["Lương bù SL"], Math.round((200000 - 460000 / 30 / 2) * 20)); // cách cũ cộng cả bơm dăm
});

test("U-QC-05 (C5) công nhật tính tăng ca theo công thức mã tăng ca (nhân hệ số)", () => {
  const s = [staff({ "Mã tiền lương 1": "CN2", "Lương thỏa thuận": "300000", "Mã tăng ca": "TC4" })];
  const ex = { chamcong: [ccRow("NV", 2026, 9, "BT", 1, 20), ccRow("NV", 2026, 9, "TC", 1, 2)] };
  assert.equal(row(run(s, ex, Q))["Tiền tăng ca"], 300000); // 2 công TC × 50% × 300.000
  assert.equal(row(run(s, ex))["Tiền tăng ca"], 600000); // cách cũ: không nhân hệ số
  // TC1: công vượt công chuẩn (30 − 4 = 26) cũng tính 50%: 29 công (27 BT + 2 TC) → (29 − 2 − 26) × 0,5 + 2 × 0,5 = 1,5 công
  const s1 = [staff({ "Mã tiền lương 1": "CN2", "Lương thỏa thuận": "300000", "Mã tăng ca": "TC1" })];
  const d = allDays(1); [6, 13, 20].forEach((x) => delete d[x]); // 27 công BT
  assert.equal(row(run(s1, { chamcong: [cc("NV", "BT", d), ccRow("NV", 2026, 9, "TC", 1, 2)] }, Q))["Tiền tăng ca"], 450000);
});

test("U-QC-06 (C6) phụ cấp có Cách tính trống: chia theo công (không tính phép, tăng ca)", () => {
  const dm_phucap = baseDb().dm_phucap.concat([{ "Mã phụ cấp": "TN.06", "Tên phụ cấp": "Phụ cấp BP Tạp vụ", "Số tiền": 200000, "Cách tính": "", "Hiệu lực từ": "2025-09-01" }]);
  const s = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "6500000", "Mã phụ cấp": "TN.06" })];
  const ex = { dm_phucap, chamcong: [ccRow("NV", 2026, 9, "BT", 1, 23), cc("NV", "PN", { 29: 1 }), cc("NV", "CL", { 30: 1 })] };
  assert.equal(row(run(s, ex, Q))["Phụ cấp"], Math.round(200000 / 26 * 24)); // 184.615 (như bảng lương CNHAK 9/2026)
  assert.equal(row(run(s, ex))["Phụ cấp"], 200000); // cách cũ: trống = cố định
  const full = { dm_phucap, chamcong: [ccRow("NV", 2026, 9, "BT", 1, 26)] };
  assert.equal(row(run(s, full, Q))["Phụ cấp"], 200000); // đủ công chuẩn → đủ tiền
});

test("U-QC-07 (C7) BH: NLĐ đóng cả KPCĐ; thu nhập chịu thuế trừ phần này; báo cáo BH có cột NLĐ.KPCĐ", () => {
  const dm_baohiem = baseDb().dm_baohiem.concat([{ "Mã bảo hiểm": "BH_KPCD.01", "DN.BHXH": 0.175, "DN.BHYT": 0.03, "DN.BHTN": 0.01, "DN.KPCD": 0.02, "NLD.BHXH": 0.08, "NLD.BHYT": 0.015, "NLD.BHTN": 0.01, "NLD.KPCD": 0.005, "Hiệu lực từ": "2025-09-01" }]);
  const s = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "10000000", "Lương cơ bản": "4554000", "Mã BHXH": "BH_KPCD.01" })];
  const ex = { dm_baohiem, chamcong: [ccRow("NV", 2026, 9)] };
  const k = run(s, ex, Q), r = row(k), b = k.bhxh[0];
  assert.equal(r["BH trừ NLĐ"], 478170 + 22770); // 4.554.000 × 10,5% + 0,5% KPCĐ
  assert.equal(b["NLĐ.KPCĐ"], 22770); assert.equal(b["Cộng BH NLĐ đóng"], 500940);
  assert.equal(r["Thực lĩnh"], Math.round((10000000 - 500940) / 1000) * 1000);
  const k0 = run(s, ex), b0 = k0.bhxh[0];
  assert.equal(row(k0)["BH trừ NLĐ"], 478170); assert.ok(!("NLĐ.KPCĐ" in b0), "cách cũ giữ đúng cột như 1.7");
});

test("U-QC-08 danh mục chuẩn có Số ngày giảm trừ (TG3 4, TG4 2, CN2 4); bản chốt ghi quy chế đã dùng", () => {
  const L = {}; HR.seedDanhMuc().dm_luong.forEach((r) => { L[r["Mã lương"]] = r; });
  assert.equal(L.TG3["Số ngày giảm trừ"], 4); assert.equal(L.TG4["Số ngày giảm trừ"], 2); assert.equal(L.CN2["Số ngày giảm trừ"], 4);
  assert.equal(L.TG1["Số ngày giảm trừ"], undefined);
  const db = baseDb(); db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000" })]; db.chamcong = [ccRow("NV", 2026, 9)];
  const kq = E.tinhBangLuong(db, 2026, 9, false, Q);
  const snap = CLS.buildSnapshot(db, "2026-09", kq, db.nhansu, { quyChe: "2026", engineVersion: E.ENGINE_VERSION });
  assert.equal(snap.quyChe, "2026"); assert.equal(snap.engineVersion, "1.8.0");
  assert.equal(CLS.buildSnapshot(db, "2026-09", kq, db.nhansu, {}).quyChe, "");
});

test("U-QC-09 (C8) có mã BHXH nhưng Lương cơ bản trống: không tính BH / truy thu (cách cũ lấy lương thỏa thuận)", () => {
  const dm_baohiem = baseDb().dm_baohiem.concat([{ "Mã bảo hiểm": "BH_KPCD.01", "DN.BHXH": 0.175, "DN.BHYT": 0.03, "DN.BHTN": 0.01, "DN.KPCD": 0.02, "NLD.BHXH": 0.08, "NLD.BHYT": 0.015, "NLD.BHTN": 0.01, "NLD.KPCD": 0.005, "Hiệu lực từ": "2025-09-01" }]);
  const s = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "8000000", "Lương cơ bản": "", "Mã BHXH": "BH_KPCD.01" })];
  const ex = { dm_baohiem, chamcong: [ccRow("NV", 2026, 9)] };
  const k = run(s, ex, Q);
  assert.equal(row(k)["BH trừ NLĐ"], 0); assert.equal(row(k)["Truy thu BH"], 0); assert.equal(k.bhxh.length, 0);
  assert.ok(k.canhbao.some((w) => /chưa có Lương cơ bản/.test(w)));
  assert.equal(row(run(s, ex))["BH trừ NLĐ"], Math.round(8000000 * 0.105)); // cách cũ
});

test("U-QC-10 (C9) công nhật CN2: phụ cấp chia theo công chuẩn 26 (30 − 4) → đủ công thì đủ tiền", () => {
  const dm_phucap = baseDb().dm_phucap.concat([{ "Mã phụ cấp": "TN.08", "Tên phụ cấp": "Phụ cấp BP Thủ kho", "Số tiền": 300000, "Cách tính": "", "Hiệu lực từ": "2026-05-01" }]);
  const s = [staff({ "Mã tiền lương 1": "CN2", "Lương thỏa thuận": "250000", "Mã phụ cấp": "TN.08" })];
  assert.equal(row(run(s, { dm_phucap, chamcong: [ccRow("NV", 2026, 9, "BT", 1, 26)] }, Q))["Phụ cấp"], 300000);
  assert.equal(row(run(s, { dm_phucap, chamcong: [ccRow("NV", 2026, 9, "BT", 1, 13)] }, Q))["Phụ cấp"], Math.round(300000 / 26 * 13));
  assert.equal(row(run(s, { dm_phucap, chamcong: [ccRow("NV", 2026, 9, "BT", 1, 26)] }, Q))["Lương thời gian"], 250000 * 26); // lương vẫn = đơn giá × công
});

test("U-QC-11 (C10) mã tăng ca TC5: công tăng ca trả theo đơn giá ca khác, KHÔNG cộng vào công lương thời gian", () => {
  const s = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "8500000", "Mã tăng ca": "TC5" })];
  const ex = { chamcong: [ccRow("NV", 2026, 9, "BT", 1, 26), ccRow("NV", 2026, 9, "TC", 1, 10)] };
  const r = row(run(s, ex, Q));
  assert.equal(r["Lương thời gian"], 8500000); // 26 công BT (không cộng 10 công TC5)
  assert.equal(r["Tiền tăng ca"], Math.round(6000000 / 26 * 10)); // TC5: 6.000.000 / công chuẩn × công TC
  const r4 = row(run([staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "8500000", "Mã tăng ca": "TC4" })], ex, Q));
  assert.equal(r4["Lương thời gian"], Math.round(8500000 / 26 * 36)); // mã khác: công TC vẫn tính vào lương TG (C1) + 50% tăng ca
});
