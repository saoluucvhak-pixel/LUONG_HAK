// Kiểm thử công thức tính lương — kết quả kỳ vọng được TÍNH TAY theo quy tắc trong docs/PAYROLL_FORMULAS.md
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../engine.js");
const { baseDb, ccRow, staff } = require("../fixtures/build.js");

function run(staffList, extra, nam, thang, bu) {
  const db = Object.assign(baseDb(), extra || {});
  db.nhansu = staffList;
  return E.tinhBangLuong(db, nam || 2026, thang || 9, !!bu);
}
const row = (kq, ma) => kq.bangluong.find((r) => r["Mã NV"] === (ma || "NV"));

test("công chuẩn theo 'Cách tính' (tháng 9/2026: 30 ngày, 4 Chủ nhật)", () => {
  const db = baseDb(), L = {}; db.dm_luong.forEach((r) => { L[r["Mã lương"]] = r; });
  assert.equal(E.congChuan(L.TG1, 9, 2026, 20), 26);   // 30 − 4 CN
  assert.equal(E.congChuan(L.TG2, 9, 2026, 20), 30);   // "Số ngày của tháng"
  assert.equal(E.congChuan(L.TG3, 9, 2026, 20), 22);   // 26 − 4
  assert.equal(E.congChuan(L.TG4, 9, 2026, 20), 24);   // 26 − 2
  assert.equal(E.congChuan(L.CN1, 9, 2026, 20), 20);   // thực tế ngày công
  assert.equal(E.congChuan(L["CĐ"], 9, 2026, 20), 26);
});

test("lương thời gian TG1: đủ công và nửa công", () => {
  const s = [staff({ "Mã nhân viên": "A", "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000" }), staff({ "Mã nhân viên": "B", "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000" })];
  const kq = run(s, { chamcong: [ccRow("A", 2026, 9), ccRow("B", 2026, 9, "BT", 1, 13)] });
  assert.equal(row(kq, "A")["Lương thời gian"], 9000000);
  assert.equal(row(kq, "B")["Lương thời gian"], 4500000); // 9.000.000 / 26 × 13
  assert.equal(row(kq, "A")["Thực lĩnh"], 9000000);
});

test("lương công nhật CN1 = đơn giá × công, tăng ca CN1 = đơn giá × công tăng ca × hệ số mã tăng ca", () => {
  // Chủ sở hữu xác nhận (đối chiếu M thật QR_LUONGTG."Lương tăng ca"): CN1/CN2 = Lương thỏa thuận
  // (đơn giá/công) × "Công tính tăng ca" (đã qua hệ số của đúng mã tăng ca gán cho người đó).
  const kq = run([staff({ "Mã tiền lương 1": "CN1", "Lương thỏa thuận": "300000", "Mã tăng ca": "TC4" })], { chamcong: [ccRow("NV", 2026, 9, "BT", 1, 20), ccRow("NV", 2026, 9, "TC", 1, 2)] });
  const r = row(kq);
  assert.equal(r["Tổng công"], 22); // công tăng ca được cộng vào tổng công (như bản gốc)
  assert.equal(r["Lương thời gian"], 300000 * 22);
  assert.equal(r["Tiền tăng ca"], 300000 * 2 * 0.5); // TC4: công tăng ca × hệ số (50%)
});

test("đối chiếu đúng số liệu thật: Lê Đức Trương (HAK_DN T9/2025, RP_THLUONG) — CN1/TC4, 510.000đ", () => {
  // Dữ liệu thật: Lương thỏa thuận 240.000, Công tính tăng ca 2,125 (= 4,25 công thô × hệ số TC4 50%),
  // Lương tăng ca thật = 240.000 × 2,125 = 510.000đ.
  const kq = run([staff({ "Mã tiền lương 1": "CN1", "Lương thỏa thuận": "240000", "Mã tăng ca": "TC4" })], { chamcong: [ccRow("NV", 2026, 9, "TC", 4.25, 1)] });
  assert.equal(row(kq)["Tiền tăng ca"], 510000);
});

test("lương công nhật CN1 không có Mã tăng ca → Tiền tăng ca = 0 (không đoán hệ số = 1)", () => {
  const kq = run([staff({ "Mã tiền lương 1": "CN1", "Lương thỏa thuận": "300000" })], { chamcong: [ccRow("NV", 2026, 9, "BT", 1, 20), ccRow("NV", 2026, 9, "TC", 1, 2)] });
  assert.equal(row(kq)["Tiền tăng ca"], 0);
});

test("TC5 (ca làm thêm vị trí khác) cũng phải nhân hệ số tăng ca, không chỉ Tiền cố định/Công chuẩn × công TC", () => {
  // Đối chiếu M thật (QR_LUONGTG."Lương tăng ca"): TC5 = (Tiền cố định / Công chuẩn) × "Công tính tăng
  // ca" (đã qua hệ số TC5 trong DM_TANGCA) — hệ số công ty HAK_DN hiện là 100% nên trước đây không lộ
  // sai số; test này dùng hệ số 50% để chứng minh công thức đúng khi hệ số khác 100%.
  const db = baseDb();
  db.dm_tangca = db.dm_tangca.map((r) => r["Mã tăng ca"] === "TC5" ? Object.assign({}, r, { "Hệ số tăng ca": 0.5 }) : r);
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã tăng ca": "TC5" })];
  db.chamcong = [ccRow("NV", 2026, 9, "TC", 5, 1)]; // 1 ngày, 5 công tăng ca
  const r = row(E.tinhBangLuong(db, 2026, 9, false));
  const cChuan = 26; // TG1, 9/2026
  assert.equal(r["Tiền tăng ca"], Math.round(6000000 / cChuan * (5 * 0.5))); // 576.923, không phải 1.153.846 (nếu bỏ hệ số)
});

test("lương sản phẩm + bù theo tháng khi dưới ngưỡng", () => {
  const extra = { chamcong: [ccRow("NV", 2026, 9)], sanluong: [{ "Phiếu cân": "P1", "Ngày cân": "2026-09-05", "KL hàng (Tấn)": "30", "Mã NV": "NV" }] };
  const db = baseDb(); db.dm_luong.find((r) => r["Mã lương"] === "SP")["ĐK_Bù lương (công tối thiểu)"] = "5";
  db.dm_luong.find((r) => r["Mã lương"] === "SP")["Đơn giá bù lương"] = "300000";
  db.nhansu = [staff({ "Mã tiền lương 1": "SP", "Lương thỏa thuận": "200000" })];
  Object.assign(db, extra);
  const r = row(E.tinhBangLuong(db, 2026, 9, false));
  assert.equal(r["Lương sản lượng"], 180000);                 // 30 tấn × 6.000
  assert.equal(r["Lương bù SL"], 300000 * 26 - 180000);        // 30/26 < 5 → bù
  assert.equal(r["Lương thời gian"], 200000 * 26);
});

test("Master Prompt mục 7.15 (Đại Hiệp, bù theo ngày bậc thang): có sản lượng nhưng CHƯA chấm công BT ngày đó → cảnh báo, không âm thầm bù=0", () => {
  const db = baseDb();
  db.dm_luong.find((r) => r["Mã lương"] === "SP")["Đơn giá bù lương"] = "200000";
  db.nhansu = [staff({ "Mã tiền lương 1": "SP", "Lương thỏa thuận": "200000" })];
  db.chamcong = []; // KHÔNG có chấm công BT ngày 05 (ngày có sản lượng)
  db.sanluong = [{ "Phiếu cân": "P1", "Ngày cân": "2026-09-05", "KL hàng (Tấn)": "3", "Mã NV": "NV" }];
  const kq = E.tinhBangLuong(db, 2026, 9, "daihiep");
  assert.equal(row(kq)["Lương bù SL"], 0);
  assert.ok(kq.canhbao.some((w) => /có sản lượng nhưng CHƯA chấm công BT ngày 05/.test(w)), kq.canhbao.join(" | "));
});

test("chiTietBuNgayDaiHiep (Master Prompt mục XVII): chi tiết từng ngày cộng lại khớp đúng 'Lương bù SL' của tinhBangLuong", () => {
  const db = baseDb();
  db.nhansu = [staff({ "Mã tiền lương 1": "SP", "Lương thỏa thuận": "200000" })];
  db.chamcong = [
    Object.assign({ "Kỳ": "2026-09", "Mã NV": "NV", "Hình thức công": "BT" }, { "07": 1, "08": 0.5 }),
  ];
  db.sanluong = [
    { "Phiếu cân": "P1", "Ngày cân": "2026-09-07", "KL hàng (Tấn)": "10", "Mã NV": "NV" },
    { "Phiếu cân": "P2", "Ngày cân": "2026-09-08", "KL hàng (Tấn)": "1", "Mã NV": "NV" },
  ];
  const kq = E.tinhBangLuong(db, 2026, 9, "daihiep");
  const detail = E.chiTietBuNgayDaiHiep(db, 2026, 9);
  assert.equal(detail.length, 2);
  const d07 = detail.find((x) => x.ngay === "2026-09-07"), d08 = detail.find((x) => x.ngay === "2026-09-08");
  // SL_CHUAN_1_NGAY = 200.000 / 6.000 = 33,333333... — không hardcode
  assert.ok(Math.abs(d07.slChuan - 200000 / 6000) < 1e-9);
  assert.equal(d07.heSo, 1); assert.equal(d07.slThucTe, 10);
  assert.equal(d08.heSo, 0.5); assert.equal(d08.slThucTe, 1);
  const tongBu = Math.round(detail.reduce((a, x) => a + x.tienBu, 0));
  assert.equal(tongBu, row(kq)["Lương bù SL"]); // phải khớp đúng, không lệch do làm tròn khác bước
  assert.equal(tongBu, 234000);
});

test("Master Prompt mục 4.5: có sản lượng/bơm dăm nhưng đơn giá khoán = 0 → cảnh báo, không âm thầm ra 0đ", () => {
  const db = baseDb();
  db.dm_luong.find((r) => r["Mã lương"] === "SP")["Số tiền khoán"] = "0";
  db.nhansu = [staff({ "Mã tiền lương 1": "SP", "Lương thỏa thuận": "200000" })];
  db.chamcong = [ccRow("NV", 2026, 9)];
  db.sanluong = [{ "Phiếu cân": "P1", "Ngày cân": "2026-09-05", "KL hàng (Tấn)": "30", "Mã NV": "NV" }];
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  assert.equal(row(kq)["Lương sản lượng"], 0);
  assert.ok(kq.canhbao.some((w) => /có sản lượng.*chưa có 'Số tiền khoán'/.test(w)), kq.canhbao.join(" | "));
});

test("Master Prompt mục 4.5: có xe bơm dăm nhưng chưa có đơn giá bơm dăm → cảnh báo", () => {
  const db = baseDb();
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã tăng ca": undefined })];
  db.chamcong = [ccRow("NV", 2026, 9)];
  db.bandam = [{ "Phiếu cân": "PB1", "Ngày cân": "2026-09-05", "KL hàng (Tấn)": "2", "Mã NV": "NV" }];
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  assert.equal(row(kq)["Lương bơm dăm"], 0);
  assert.ok(kq.canhbao.some((w) => /có bơm dăm.*chưa có đơn giá/.test(w)), kq.canhbao.join(" | "));
});

test("Giai đoạn 5.3 (checklist chốt kỳ #5): Mã tăng ca gán cho nhân viên nhưng không có trong Danh mục tăng ca → cảnh báo, không âm thầm Tiền tăng ca = 0", () => {
  const kq = run([staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã tăng ca": "TC_LA" })], { chamcong: [ccRow("NV", 2026, 9, "TC", 1, 2)] });
  assert.equal(row(kq)["Tiền tăng ca"], 0);
  assert.ok(kq.canhbao.some((w) => /mã tăng ca 'TC_LA' chưa có trong Danh mục tăng ca/.test(w)), kq.canhbao.join(" | "));
});

test("Giai đoạn 5.3 (checklist chốt kỳ #15): nhãn công tác trên chấm công không có mã phụ cấp tương ứng → cảnh báo, không âm thầm bỏ qua", () => {
  const db = baseDb();
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000" })];
  db.chamcong = [ccRow("NV", 2026, 9, "BT", "1XYZ", 3)];
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  assert.equal(row(kq)["Phụ cấp công tác"], 0);
  assert.ok(kq.canhbao.some((w) => /nhãn công tác 'XYZ'.*chưa có mã phụ cấp tương ứng/.test(w)), kq.canhbao.join(" | "));
});

test("Master Prompt mục 8.1: mã tăng ca MỚI khai 'Loại công thức' = TC3 → dùng đúng công thức TC3, không cần sửa engine", () => {
  const db = baseDb();
  db.dm_tangca.push({ "Mã tăng ca": "TC7", "Nội dung tăng ca": "Mã mới, dùng lại công thức TC3", "Loại công thức": "TC3", "Hệ số tăng ca": 0.5, "Hiệu lực từ": "2020-01-01" });
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã tăng ca": "TC7" })];
  const bt = ccRow("NV", 2026, 9, "BT", 1, 20);
  bt["06"] = 1; // 06/09/2026 là Chủ nhật → 1 công Chủ nhật (BT, không phải TC)
  db.chamcong = [bt, ccRow("NV", 2026, 9, "TC", 1, 2)]; // 2 công tăng ca ghi nhận
  const r = row(E.tinhBangLuong(db, 2026, 9, false));
  const donGiaTG = 9000000 / 26; // TG1, 9/2026: 30 ngày - 4 CN = 26
  // TC3 = (Công tăng ca + Công chủ nhật) × hệ số = (2 + 1) × 0,5 = 1,5 — khác với mặc định (không map) = 2 × 0,5 = 1
  assert.equal(r["Tiền tăng ca"], Math.round(donGiaTG * 1.5));
});

test("Dynamic Payroll Formula Engine (mục III/IV): mã tăng ca MỚI có công thức tự khai trong db.dm_congthuc (KHÔNG dùng 'Loại công thức' redirect) → engine tự tính theo công thức đó, không cần sửa code", () => {
  const db = baseDb();
  db.dm_tangca.push({ "Mã tăng ca": "TC9", "Nội dung tăng ca": "Tăng ca đặc biệt, công thức tự khai", "Hệ số tăng ca": 0.75, "Hiệu lực từ": "2020-01-01" });
  db.dm_congthuc = [{ "Mã công thức": "TC9", "Loại": "OVERTIME", "Trạng thái": "Hiệu lực", "Hiệu lực từ": "2020-01-01", "Biểu thức": "(CONG_TC + CONG_CHU_NHAT) * HE_SO_TC" }]; // = TC3
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã tăng ca": "TC9" })];
  const bt = ccRow("NV", 2026, 9, "BT", 1, 20);
  bt["06"] = 1; // Chủ nhật
  db.chamcong = [bt, ccRow("NV", 2026, 9, "TC", 1, 2)];
  const r = row(E.tinhBangLuong(db, 2026, 9, false));
  const donGiaTG = 9000000 / 26;
  assert.equal(r["Tiền tăng ca"], Math.round(donGiaTG * (2 + 1) * 0.75));
});

test("Dynamic Payroll Formula Engine (V5 P0-01): công thức HIỆU LỰC lỗi khi tính (chia 0...) → FORMULA_ERROR, khoản = 0đ, KHÔNG dùng công thức mặc định (xem formula-error-block.test.js)", () => {
  const db = baseDb();
  db.dm_tangca.push({ "Mã tăng ca": "TC9", "Nội dung tăng ca": "Công thức lỗi", "Hệ số tăng ca": 1, "Hiệu lực từ": "2020-01-01" });
  db.dm_congthuc = [{ "Mã công thức": "TC9", "Loại": "OVERTIME", "Trạng thái": "Hiệu lực", "Hiệu lực từ": "2020-01-01", "Biểu thức": "CONG_TC / (CONG_CHU_NHAT - CONG_CHU_NHAT)" }]; // chia 0 vì không ai làm Chủ nhật
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã tăng ca": "TC9" })];
  db.chamcong = [ccRow("NV", 2026, 9, "BT", 1, 20), ccRow("NV", 2026, 9, "TC", 1, 2)];
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  assert.equal(row(kq)["Tiền tăng ca"], 0); // KHÔNG còn rơi về CONG_TC × HE_SO_TC
  assert.equal(kq.loiCongThuc.length, 1);
  assert.equal(kq.loiCongThuc[0].maLoi, "DIV_ZERO");
  assert.ok(kq.canhbao.some((w) => /FORMULA_ERROR.*mã tăng ca 'TC9'/.test(w)), kq.canhbao.join(" | "));
});

test("phụ cấp TN.02 theo tỷ lệ công: dưới ngưỡng (công chuẩn − 5) thì tính theo công", () => {
  const kq = run([staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã phụ cấp": "TN.02" })], { chamcong: [ccRow("NV", 2026, 9, "BT", 1, 18)] });
  assert.equal(row(kq)["Phụ cấp"], Math.round(200000 / 26 * 18)); // 138.462
  const kq2 = run([staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã phụ cấp": "TN.02" })], { chamcong: [ccRow("NV", 2026, 9, "BT", 1, 21)] });
  assert.equal(row(kq2)["Phụ cấp"], 200000);
});

test("PV-12: 'Lương thời gian' của SP — 'Loại công thức' để trống = ĐÚNG hành vi cũ (Công lễ + Công phép)", () => {
  const db = baseDb();
  db.nhansu = [staff({ "Mã tiền lương 1": "SP", "Lương thỏa thuận": "200000" })];
  db.chamcong = [ccRow("NV", 2026, 9, "BT", 1, 10), ccRow("NV", 2026, 9, "CL", 1, 2), ccRow("NV", 2026, 9, "PN", 1, 1), ccRow("NV", 2026, 9, "TC", 1, 3)];
  const r = row(E.tinhBangLuong(db, 2026, 9, false, { quyChe: "2026" }));
  assert.equal(r["Lương thời gian"], 200000 * (2 + 1)); // lễ(2) + phép(1) — không đổi, kể cả có công tăng ca
});

test("PV-12: 'Lương thời gian' của SP — mã CHỌN 'Loại công thức' = TG_LE_TANGCA → đúng công thức M thật HAK_DN (lễ + tăng ca)", () => {
  const db = baseDb();
  db.dm_luong.find((r) => r["Mã lương"] === "SP")["Loại công thức"] = "TG_LE_TANGCA";
  db.nhansu = [staff({ "Mã tiền lương 1": "SP", "Lương thỏa thuận": "200000" })];
  db.chamcong = [ccRow("NV", 2026, 9, "BT", 1, 10), ccRow("NV", 2026, 9, "CL", 1, 2), ccRow("NV", 2026, 9, "PN", 1, 1), ccRow("NV", 2026, 9, "TC", 1, 3)];
  const r = row(E.tinhBangLuong(db, 2026, 9, false, { quyChe: "2026" }));
  assert.equal(r["Lương thời gian"], 200000 * (2 + 3)); // lễ(2) + tăng ca(3), KHÔNG phải lễ+phép (600.000)
});

test("PV-10/PV-11: phụ cấp — 'Loại công thức' để trống = ĐÚNG hành vi cũ (không đổi số liệu TN.01/TN.02 mẫu HAK_DN)", () => {
  // Có công lễ + phép nhưng KHÔNG khai 'Loại công thức' → vẫn không trừ gì (hành vi cũ, đã được
  // Excel thật CNHAK 9/2026 xác nhận gián tiếp qua việc hoàn tác PV-10 — xem docs PV-10).
  const kq = run([staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã phụ cấp": "TN.02" })], {
    chamcong: [ccRow("NV", 2026, 9, "BT", 1, 10), ccRow("NV", 2026, 9, "CL", 1, 2), ccRow("NV", 2026, 9, "PN", 1, 1), ccRow("NV", 2026, 9, "TC", 1, 3)],
  });
  const r = row(kq);
  assert.equal(r["Tổng công"], 16);
  assert.equal(r["Phụ cấp"], Math.round(200000 / 26 * 16)); // 123.077 — không trừ gì, kể cả có lễ/phép/tăng ca
});

test("PV-10/PV-11: phụ cấp — mã CHỌN 'Loại công thức' = TYLE_TRU_LE_PHEP → đúng công thức M thật HAK_DN (trừ lễ+phép, ngưỡng so Tổng công thô)", () => {
  const db = baseDb();
  db.dm_phucap.push({ "Mã phụ cấp": "TN.06", "Tên phụ cấp": "test (M thật HAK_DN)", "Số tiền": "200000", "Tham chiếu": "5", "Loại công thức": "TYLE_TRU_LE_PHEP", "Hiệu lực từ": "2025-09-01" });
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã phụ cấp": "TN.06" })];
  db.chamcong = [ccRow("NV", 2026, 9, "BT", 1, 10), ccRow("NV", 2026, 9, "CL", 1, 2), ccRow("NV", 2026, 9, "PN", 1, 1), ccRow("NV", 2026, 9, "TC", 1, 3)];
  const r = row(E.tinhBangLuong(db, 2026, 9, false));
  assert.equal(r["Tổng công"], 16); // 16 < (26−5=21) → dưới ngưỡng cả theo Tổng công thô
  assert.equal(r["Phụ cấp"], Math.round(200000 / 26 * (16 - 2 - 1))); // trừ lễ(2)+phép(1) = 100.000, KHÔNG phải 123.077 (không trừ) hay trừ phép+tăng ca
});

test("PV-11: phụ cấp — 'Loại công thức' = CO_DINH ép tính cố định dù 'Cách tính' có mô tả tỷ lệ", () => {
  const db = baseDb();
  db.dm_phucap.push({ "Mã phụ cấp": "TN.07", "Tên phụ cấp": "test cố định ép buộc", "Số tiền": "500000", "Tham chiếu": "5", "Cách tính": "Tổng công >= ... tính theo công", "Loại công thức": "CO_DINH", "Hiệu lực từ": "2025-09-01" });
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã phụ cấp": "TN.07" })];
  db.chamcong = [ccRow("NV", 2026, 9, "BT", 1, 1)]; // rất ít công — nếu tính theo tỷ lệ sẽ ra số nhỏ
  const r = row(E.tinhBangLuong(db, 2026, 9, false));
  assert.equal(r["Phụ cấp"], 500000); // CO_DINH → luôn đủ, không chia theo công
});

test("PV-11: hỗ trợ — 'Loại công thức' để trống = đúng công thức cũ theo vị trí gán (HT.01 theo Ngày cơm, HT.02 thiếu chuẩn)", () => {
  // "Tiền cơm" (slot 'Mã hỗ trợ') nhân với "Ngày cơm" (chấm công hình thức CC), không phải Tổng công.
  const kq = run([staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã hỗ trợ": "HT.01", "Mã hỗ trợ 2": "HT.02" })], { chamcong: [ccRow("NV", 2026, 9, "BT", 1, 20), ccRow("NV", 2026, 9, "CC", 1, 20)] });
  const r = row(kq);
  assert.equal(r["Tiền cơm"], Math.round(20 * 20000)); // HT.01: theo Ngày cơm
  assert.equal(r["Lương hỗ trợ"], Math.round((26 - 20) * 150000)); // HT.02: thiếu 6 công (Tổng công, không tính CC) × 150.000
});

test("PV-11: hỗ trợ — mã CHỌN 'Loại công thức' = HT_THIEU_CHUAN dù gán ở vị trí 'Mã hỗ trợ' (không phải 'Mã hỗ trợ 2')", () => {
  const db = baseDb();
  db.dm_hotro.push({ "Mã hỗ trợ": "HT.03", "Tên hỗ trợ": "test thiếu chuẩn ở vị trí hỗ trợ 1", "Số tiền": "150000", "Loại công thức": "HT_THIEU_CHUAN", "Hiệu lực từ": "2025-09-01" });
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã hỗ trợ": "HT.03" })];
  db.chamcong = [ccRow("NV", 2026, 9, "BT", 1, 20)]; // thiếu 6 công so với chuẩn 26; KHÔNG có chấm công CC — nếu vẫn theo công thức "theo ngày" cũ sẽ ra 0
  const r = row(E.tinhBangLuong(db, 2026, 9, false));
  assert.equal(r["Tiền cơm"], Math.round((26 - 20) * 150000)); // "Tiền cơm" là cột hiển thị của slot "Mã hỗ trợ" — nhưng ra đúng công thức thiếu-chuẩn vì mã CHỌN HT_THIEU_CHUAN
});

test("Dynamic Payroll Formula Engine (mục V): mã phụ cấp MỚI có công thức tự khai trong db.dm_congthuc (Loại=ALLOWANCE) → engine tự tính theo công thức đó, không cần sửa code", () => {
  const db = baseDb();
  db.dm_phucap.push({ "Mã phụ cấp": "PC99", "Tên phụ cấp": "test công thức tự khai", "Số tiền": "300000", "Tham chiếu": "26", "Loại công thức": "PC_NGUONG_RIENG", "Hiệu lực từ": "2025-09-01" });
  // Công thức: đủ ngưỡng (NGUONG_PHU_CAP) thì hưởng đủ, không đủ thì chia theo công chuẩn — giống PC03 mục V.2
  db.dm_congthuc = [{ "Mã công thức": "PC_NGUONG_RIENG", "Loại": "ALLOWANCE", "Trạng thái": "Hiệu lực", "Hiệu lực từ": "2020-01-01", "Biểu thức": "IF(CONG_HUONG_PHU_CAP >= NGUONG_PHU_CAP, MUC_PHU_CAP, MUC_PHU_CAP * CONG_HUONG_PHU_CAP / CONG_CHUAN)" }];
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã phụ cấp": "PC99" })];
  db.chamcong = [ccRow("NV", 2026, 9, "BT", 1, 20)]; // Tổng công = 20 < NGUONG_PHU_CAP(26) → chia theo tỷ lệ
  const r = row(E.tinhBangLuong(db, 2026, 9, false));
  assert.equal(r["Phụ cấp"], Math.round(300000 * 20 / 26));
});

test("Dynamic Payroll Formula Engine (mục VI): mã hỗ trợ MỚI có công thức tự khai trong db.dm_congthuc (Loại=SUPPORT) → engine tự tính theo công thức đó, không cần sửa code", () => {
  const db = baseDb();
  db.dm_hotro.push({ "Mã hỗ trợ": "HT99", "Tên hỗ trợ": "test công thức tự khai", "Số tiền": "150000", "Loại công thức": "HT_GAP_DOI", "Hiệu lực từ": "2025-09-01" });
  db.dm_congthuc = [{ "Mã công thức": "HT_GAP_DOI", "Loại": "SUPPORT", "Trạng thái": "Hiệu lực", "Hiệu lực từ": "2020-01-01", "Biểu thức": "SO_NGAY_DUOC_HUONG * MUC_HO_TRO * 2" }];
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã hỗ trợ": "HT99" })];
  db.chamcong = [ccRow("NV", 2026, 9, "BT", 1, 20), ccRow("NV", 2026, 9, "CC", 1, 5)];
  const r = row(E.tinhBangLuong(db, 2026, 9, false));
  assert.equal(r["Tiền cơm"], Math.round(5 * 150000 * 2));
});

test("phụ cấp công tác theo nhãn chấm công 1QC", () => {
  const kq = run([staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000" })], { chamcong: [ccRow("NV", 2026, 9, "BT", "1QC", 7)] });
  assert.equal(row(kq)["Phụ cấp công tác"], 700000);
  assert.equal(row(kq)["Tổng công"], 7);
});

test("BHXH người lao động 10,5% lương đóng BH; truy thu khi dưới ngưỡng công", () => {
  const kq = run([staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Lương cơ bản": "5000000", "Mã BHXH": "BH01" })], { chamcong: [ccRow("NV", 2026, 9)] });
  assert.equal(row(kq)["BH trừ NLĐ"], 525000);
  const db = baseDb(); db.dm_luong.find((r) => r["Mã lương"] === "TG1")["Ngưỡng truy thu BH (công)"] = "14";
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Lương cơ bản": "5000000", "Mã BHXH": "BH01" })];
  db.chamcong = [ccRow("NV", 2026, 9, "BT", 1, 10)];
  const r2 = row(E.tinhBangLuong(db, 2026, 9, false));
  assert.equal(r2["BH trừ NLĐ"], 0);
  assert.equal(r2["Truy thu BH"], 1175000); // 5.000.000 × 23,5%
});

test("thuế TNCN lũy tiến biểu 5 bậc 2026: thu nhập tính thuế 40 triệu → 4,5 triệu", () => {
  const kq = run([staff({ "Lương thỏa thuận": "55500000", "Mã TNCN": "LT01" })], { chamcong: [ccRow("NV", 2026, 9)] });
  assert.equal(row(kq)["Thuế TNCN"], 4500000); // 10tr×5% + 20tr×10% + 10tr×20%
  assert.equal(row(kq)["Thực lĩnh"], 51000000);
});

test("thuế TNCN theo hiệu lực: 12/2025 dùng biểu 7 bậc + GT 11tr, 01/2026 dùng biểu 5 bậc + GT 15,5tr", () => {
  const s = [staff({ "Lương thỏa thuận": "20000000", "Mã TNCN": "LT01" })];
  assert.equal(row(run(s, { chamcong: [ccRow("NV", 2025, 12)] }, 2025, 12))["Thuế TNCN"], 650000); // 9tr: 5tr×5% + 4tr×10%
  assert.equal(row(run(s, { chamcong: [ccRow("NV", 2026, 1)] }, 2026, 1))["Thuế TNCN"], 225000);   // 4,5tr × 5%
});

test("người phụ thuộc giảm trừ 6,2 triệu/người", () => {
  const kq = run([staff({ "Lương thỏa thuận": "30000000", "Mã TNCN": "LT01", "Người phụ thuộc": 1 })], { chamcong: [ccRow("NV", 2026, 9)] });
  assert.equal(row(kq)["Thuế TNCN"], Math.round((30000000 - 15500000 - 6200000) * 0.05)); // 8,3tr → 415.000
});

test("khấu trừ vãng lai VL01 10% trên tổng thu nhập", () => {
  const kq = run([staff({ "Lương thỏa thuận": "6000000", "Mã TNCN": "VL01" })], { chamcong: [ccRow("NV", 2026, 9)] });
  assert.equal(row(kq)["Thuế TNCN"], 600000);
  assert.equal(row(kq)["Thực lĩnh"], 5400000);
});

test("thực lĩnh làm tròn 1.000đ; khoản trừ vượt thu nhập → 0 và CÓ cảnh báo", () => {
  const kq = run([staff({ "Lương thỏa thuận": "1000000" })], { chamcong: [ccRow("NV", 2026, 9)], ungluong: [{ "Ngày hạch toán": "2026-09-10", "Mã NV": "NV", "Tạm ứng": "2000000" }] });
  assert.equal(row(kq)["Thực lĩnh"], 0);
  assert.ok(kq.canhbao.some((w) => /vượt thu nhập/.test(w)));
  const kq2 = run([staff({ "Lương thỏa thuận": "1000499" })], { chamcong: [ccRow("NV", 2026, 9)] });
  assert.equal(row(kq2)["Thực lĩnh"], 1000000);
});

test("BUG-002: số tiền nhập kiểu VN '500.000' được hiểu là 500.000đ (không phải 500đ)", () => {
  const kq = run([staff({ "Lương thỏa thuận": "9.000.000" })], { chamcong: [ccRow("NV", 2026, 9)], psluong: [{ "Ngày hạch toán": "2026-09-28", "Mã NV": "NV", "Thưởng": "500.000" }] });
  assert.equal(row(kq)["Thưởng"], 500000);
  assert.equal(row(kq)["Lương thời gian"], 9000000);
  assert.equal(E.money("0.015"), 0.015);   // không làm hỏng số thập phân
  assert.equal(E.num("0.175"), 0.175);     // tỷ lệ vẫn đọc như cũ
});

test("cảnh báo khi thuế lũy tiến mà thiếu mức giảm trừ", () => {
  const kq = run([staff({ "Lương thỏa thuận": "20000000", "Mã TNCN": "LT01", "Mã GT_TNCN_BT": "KHONG_CO" })], { chamcong: [ccRow("NV", 2026, 9)] });
  assert.ok(kq.canhbao.some((w) => /giảm trừ bản thân/.test(w)));
});

// Mục VIII: CompanyID → PolicyVersion → PayrollMethod — quyCheBuChinhThuc() chọn đúng bản "Hiệu lực"
// cho kỳ đang chốt, bỏ qua Nháp/Đã duyệt/Ngừng và bản ngoài hiệu lực.
test("quyCheBuChinhThuc: không có danh mục → null (chưa có cấu hình hợp lệ)", () => {
  assert.equal(E.quyCheBuChinhThuc([], 2026, 9), null);
  assert.equal(E.quyCheBuChinhThuc(undefined, 2026, 9), null);
});
test("quyCheBuChinhThuc: chỉ có bản Nháp/Đã duyệt/Ngừng → không được dùng, vẫn null", () => {
  const list = [
    { "Cách bù": "to", "Trạng thái": "Nháp", "Hiệu lực từ": "2020-01-01" },
    { "Cách bù": "daihiep", "Trạng thái": "Đã duyệt", "Hiệu lực từ": "2020-01-01" },
    { "Cách bù": "true", "Trạng thái": "Ngừng", "Hiệu lực từ": "2020-01-01" }
  ];
  assert.equal(E.quyCheBuChinhThuc(list, 2026, 9), null);
});
test("quyCheBuChinhThuc: bản Hiệu lực đúng kỳ → trả về đúng bản đó", () => {
  const list = [{ "Cách bù": "to", "Trạng thái": "Hiệu lực", "Hiệu lực từ": "2020-01-01" }];
  assert.equal(E.quyCheBuChinhThuc(list, 2026, 9)["Cách bù"], "to");
});
test("quyCheBuChinhThuc: nhiều bản Hiệu lực khác 'Hiệu lực từ' → lấy bản MỚI NHẤT còn hiệu lực trong kỳ", () => {
  const list = [
    { "Cách bù": "to", "Trạng thái": "Hiệu lực", "Hiệu lực từ": "2020-01-01" },
    { "Cách bù": "daihiep", "Trạng thái": "Hiệu lực", "Hiệu lực từ": "2026-01-01" },
    { "Cách bù": "true", "Trạng thái": "Hiệu lực", "Hiệu lực từ": "2030-01-01" } // chưa tới kỳ 9/2026
  ];
  assert.equal(E.quyCheBuChinhThuc(list, 2026, 9)["Cách bù"], "daihiep");
});
test("quyCheBuChinhThuc: bản Hiệu lực đã hết hạn trước kỳ ('Hiệu lực đến') → bỏ qua", () => {
  const list = [
    { "Cách bù": "to", "Trạng thái": "Hiệu lực", "Hiệu lực từ": "2020-01-01", "Hiệu lực đến": "2025-12-31" },
    { "Cách bù": "daihiep", "Trạng thái": "Hiệu lực", "Hiệu lực từ": "2030-01-01" } // chưa tới kỳ
  ];
  assert.equal(E.quyCheBuChinhThuc(list, 2026, 9), null);
});
