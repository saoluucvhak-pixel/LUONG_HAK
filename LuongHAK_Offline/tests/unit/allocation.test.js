// Q-19 (chủ sở hữu duyệt 11/10/2026, R-53): làm ở phòng nào tính chi phí phòng đó — chia theo công; tổng các phòng = tổng bảng lương
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../../core/allocation.js");
const E = require("../../engine.js");
const HR = require("../../hr.js");
const { baseDb, ccRow, regressionDataset } = require("../fixtures/build.js");

// Tháng 9/2026: 13 công trước 16/09, 13 công từ 16/09
function moveDb(cach) {
  const db = baseDb();
  db.nhanvien = [{ "Mã NV": "NV001", "Họ và tên": "A", "Trạng thái": "Đang làm việc" }];
  db.hopdong = [{ "Mã NV": "NV001", "Số HĐLĐ": "H1", "Ngày vào làm": "2025-01-01" }];
  const pl = { "Mã NV": "NV001", "Số HĐLĐ": "H1", "Mã lương": "TG1", "Lương thỏa thuận": "20000000", "Lương cơ bản": "6000000", "Mức đóng bảo hiểm": "BH01", "Thuế TNCN": "MT00", "HTTT": "Tiền mặt" };
  db.chitiethd = [Object.assign({}, pl, { "Hiệu lực từ": "2025-01-01", "Phòng ban": "01.01" }), Object.assign({}, pl, { "Hiệu lực từ": "2026-09-16", "Phòng ban": "02.01", "Cách áp dụng trong tháng hiệu lực": cach || "" })];
  db.chamcong = [ccRow("NV001", 2026, 9)];
  return db;
}
const calc = (db, y, m) => { const s = HR.staffForPayroll(db, y || 2026, m || 9); return E.tinhBangLuong(Object.assign({}, db, { nhansu: s.list }), y || 2026, m || 9, false); };
const tk = (db) => (maPB, tenPB) => { const r = db.dm_phongban.find((x) => x["Mã phòng ban"] === maPB || (!maPB && x["Tên phòng ban"] === tenPB)); return (r && r["Tài khoản chi phí"]) || "642"; };

test("U-ALLOC-01 chia số tiền: tổng các phần đúng bằng số gốc (cả số lẻ, số âm), theo tỷ lệ", () => {
  const p3 = [{ share: 1 }, { share: 1 }, { share: 1 }];
  assert.deepEqual(A.split(1000001, p3).reduce((a, b) => a + b, 0), 1000001);
  assert.deepEqual(A.split(100, [{ share: 0.5 }, { share: 0.5 }]), [50, 50]);
  assert.equal(A.split(-301, p3).reduce((a, b) => a + b, 0), -301);
  assert.deepEqual(A.split(7, [{ share: 1 }]), [7]);
});

test("U-ALLOC-02 điều chuyển 01.01 → 02.01 từ 16/09 (13 + 13 công): mỗi phòng 50% thu nhập, BH, thực lĩnh; hạch toán TK 642 / 622 mỗi bên 10.000.000", () => {
  const db = moveDb(), kq = calc(db), row = kq.bangluong[0];
  assert.equal(row["Tổng thu nhập"], 20000000, "số tiền lương KHÔNG đổi (cả tháng theo phụ lục hiện hành)");
  assert.deepEqual(row["Phân bổ PB"].map((p) => [p["Mã PB"], p["Công"], p["Tỷ lệ"]]), [["01.01", 13, 0.5], ["02.01", 13, 0.5]]);
  assert.ok(kq.canhbao.some((w) => /NV001: điều chuyển phòng ban trong kỳ \(Q-19\).*13 công \(50%\).*13 công \(50%\)/.test(w)), kq.canhbao.join("\n"));
  const dep = A.byDepartment(kq).rows, by = Object.fromEntries(dep.map((r) => [r["Phòng ban"], r]));
  const ten1 = db.dm_phongban.find((x) => x["Mã phòng ban"] === "01.01")["Tên phòng ban"], ten2 = db.dm_phongban.find((x) => x["Mã phòng ban"] === "02.01")["Tên phòng ban"];
  assert.equal(by[ten1]["Tổng thu nhập"], 10000000); assert.equal(by[ten2]["Tổng thu nhập"], 10000000);
  assert.equal(by[ten1]["Tổng công"] + by[ten2]["Tổng công"], 26);
  assert.equal(by[ten1]["BH công ty đóng"] + by[ten2]["BH công ty đóng"], kq.bhxh[0]["Cộng BH công ty đóng"]);
  assert.equal(by[ten1]["Số người"], 1); assert.equal(by[ten2]["Số người"], 1);
  const cost = A.costByKey(kq, tk(db));
  assert.equal(cost.luong["642"], 10000000); assert.equal(cost.luong["622"], 10000000);
});

test("U-ALLOC-03 chỉ làm nửa đầu tháng ở phòng cũ → 100% phòng cũ; kết hợp Q-22 'Từ ngày hiệu lực' vẫn tổng đúng", () => {
  const db = moveDb(); for (let d = 16; d <= 30; d++) delete db.chamcong[0][String(d).padStart(2, "0")];
  const p = calc(db).bangluong[0]["Phân bổ PB"];
  assert.deepEqual(p.map((x) => x["Tỷ lệ"]), [1, 0]);
  const kq2 = calc(moveDb("Từ ngày hiệu lực")), dep = A.byDepartment(kq2).rows;
  assert.equal(dep.reduce((a, r) => a + r["Tổng thu nhập"], 0), kq2.bangluong[0]["Tổng thu nhập"]);
});

test("U-ALLOC-04 không điều chuyển → không có 'Phân bổ PB'; báo cáo theo phòng ban & hạch toán giữ y hệt cách cũ (80 NV × kỳ 9)", () => {
  const db = regressionDataset(80), kq = calc(db);
  assert.ok(kq.bangluong.every((r) => r["Phân bổ PB"] === undefined));
  // cách cũ: gom theo tên phòng ban của dòng lương
  const old = {}; kq.bangluong.forEach((x) => { const k = x["Phòng ban"] || A.NO_PB; old[k] = (old[k] || 0) + x["Tổng thu nhập"]; });
  const now = Object.fromEntries(A.byDepartment(kq).rows.map((r) => [r["Phòng ban"], r["Tổng thu nhập"]]));
  assert.deepEqual(now, old);
  const oldTK = {}; kq.bangluong.forEach((x) => { const k = tk(db)(x["Mã PB"], x["Phòng ban"]); oldTK[k] = (oldTK[k] || 0) + x["Tổng thu nhập"]; });
  assert.deepEqual(A.costByKey(kq, tk(db)).luong, oldTK);
});
