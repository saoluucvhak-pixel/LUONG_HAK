// V10.3 — Nhóm "Báo cáo lương": Bảng tổng hợp lương (mỗi NV một dòng, nhóm theo phòng ban) · Báo cáo khấu trừ thuế TNCN. Dữ liệu GIẢ LẬP.
"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const PR = require("../../core/reporting/payroll-reports.js");
const RH = require("../../core/reporting/report-html.js");
const RX = require("../../ui/report-xlsx.js");
const X = require("../../exceljs.min.js");

const rows = () => [
  { "Mã NV": "N1", "Họ và tên": "An", "Phòng ban": "KCS", "Chức vụ": "Công nhân", "Tổng thu nhập": 10000000, "BH trừ NLĐ": 800000, "KPCĐ trừ NLĐ": 100000, "Truy thu BH": 0, "Thuế TNCN": 200000, "Trừ khác": 0, "Tạm ứng": 1000000, "Thực lĩnh": 7900000, "Tiền cơm": 600000, _ct: { maThueTNCN: "LT", giamTruPhuThuoc: 4400000 } },
  { "Mã NV": "N2", "Họ và tên": "Bình", "Phòng ban": "Cơ giới", "Chức vụ": "Lái xe", "Tổng thu nhập": 20000000, "BH trừ NLĐ": 1000000, "KPCĐ trừ NLĐ": 200000, "Truy thu BH": 0, "Thuế TNCN": 0, "Trừ khác": 500000, "Tạm ứng": 0, "Thực lĩnh": 18300000, "Tiền cơm": 0, _ct: { maThueTNCN: "LT", giamTruPhuThuoc: 0 } },
  { "Mã NV": "N3", "Họ và tên": "Chi", "Phòng ban": "KCS", "Chức vụ": "Tổ trưởng", "Tổng thu nhập": 5000000, "BH trừ NLĐ": 0, "KPCĐ trừ NLĐ": 0, "Truy thu BH": 0, "Thuế TNCN": 50000, "Trừ khác": 0, "Tạm ứng": 0, "Thực lĩnh": 4950000, "Tiền cơm": 300000, _ct: { maThueTNCN: "VL", giamTruPhuThuoc: 0 } }
];
const src = () => ({ bangluong: rows(), chot: true, blockers: [] });
const opt = (o) => Object.assign({ nam: 2026, thang: 9, tenCongTy: "CÔNG TY GIẢ LẬP", ngay: "01/10/2026", nguoiLap: "kt" }, o || {});

test("U-RP103-01 Bảng tổng hợp lương: mỗi NV một dòng, đúng cột theo yêu cầu", () => {
  const v = PR.build("TONG_HOP_NV", src(), opt());
  assert.equal(v.title, "BẢNG TỔNG HỢP LƯƠNG"); assert.equal(v.rows.length, 3);
  assert.deepEqual(v.cols.map((c) => c.label), ["STT", "Mã NV", "Họ và tên", "Phòng ban", "Chức vụ", "Tổng thu nhập", "BH trừ NLĐ", "KPCĐ trừ NLĐ", "Truy thu BH", "Thuế TNCN", "Trừ khác", "Tạm ứng", "Thực lĩnh kỳ này"]);
  assert.equal(v.tong["Thực lĩnh"], 31150000); assert.equal(v.nhom, null);
});

test("U-RP103-02 Nhóm theo phòng ban: cộng từng phòng, tổng cộng = tổng khi không nhóm, STT liên tục", () => {
  const flat = PR.build("TONG_HOP_NV", src(), opt()), g = PR.build("TONG_HOP_NV", src(), opt({ nhomPB: true }));
  assert.deepEqual(g.nhom.map((x) => x.ten), ["Cơ giới", "KCS"]);
  assert.deepEqual(g.rows.map((r) => r.STT), [1, 2, 3]);
  assert.deepEqual(g.tong, flat.tong);
  for (const k of Object.keys(g.tong)) assert.equal(g.nhom.reduce((a, x) => a + x.tong[k], 0), g.tong[k], k);
  assert.equal(g.nhom[1].tong["Tổng thu nhập"], 15000000);
});

test("U-RP103-03 Excel dạng nhóm: dòng tiêu đề nhóm, dòng Cộng từng phòng, tổng cộng đúng", async () => {
  const g = PR.build("TONG_HOP_NV", src(), opt({ nhomPB: true }));
  const buf = await RX.build(X, g, {}).xlsx.writeBuffer(), wb = new X.Workbook(); await wb.xlsx.load(buf);
  const lines = []; wb.worksheets[0].eachRow((r) => lines.push(r.values.slice(1).map((c) => (c == null ? "" : String(c))).join("|")));
  assert.ok(lines.some((l) => /^Cơ giới \(1 người\)/.test(l)) && lines.some((l) => /^KCS \(2 người\)/.test(l)));
  assert.ok(lines.some((l) => /Cộng KCS/.test(l) && /15000000/.test(l)));
  assert.ok(lines.some((l) => /^TỔNG CỘNG/.test(l) && /35000000/.test(l)));
});

test("U-RP103-04 In PDF dạng nhóm: có dòng nhóm, 'Cộng <phòng>' ở cột Họ và tên, tổng cộng", () => {
  const g = PR.build("TONG_HOP_NV", src(), opt({ nhomPB: true }));
  const html = RH.table(Object.assign({}, g, { groups: g.nhom }), { chuKy: ["Người lập"] });
  assert.match(html, /KCS \(2 người\)/); assert.match(html, /Cộng KCS/); assert.match(html, /TỔNG CỘNG \(3 người\)/);
});

test("U-RP103-05 Báo cáo khấu trừ thuế TNCN: cột theo yêu cầu, lấy MST hồ sơ, cảnh báo thiếu MST khi có thuế", () => {
  const v = PR.build("THUE_TNCN", src(), opt({ nhanVien: { N1: { "Mã số thuế": "0312345678" } } }));
  assert.equal(v.title, "BÁO CÁO KHẤU TRỪ THUẾ THU NHẬP CÁ NHÂN");
  assert.deepEqual(v.cols.map((c) => c.label), ["STT", "Mã số thuế", "Họ và tên", "Phòng ban", "Chức vụ", "Mã TNCN", "Tổng thu nhập", "Phụ cấp ăn ca (tiền cơm)", "Khấu trừ bảo hiểm", "Khấu trừ KPCĐ", "Khấu trừ người phụ thuộc", "Thuế TNCN khấu trừ"]);
  assert.equal(v.rows[0]["Mã số thuế"], "0312345678"); assert.equal(v.rows[0]["Mã TNCN"], "LT"); assert.equal(v.rows[0]["Giảm trừ phụ thuộc"], 4400000);
  assert.equal(v.tong["Thuế TNCN"], 250000); assert.equal(v.tong["Tiền cơm"], 900000);
  assert.ok(v.canhbao.some((c) => /chưa có mã số thuế/.test(c) && /N3/.test(c)), "N3 có thuế nhưng thiếu MST");
  assert.ok(PR.KHONG_CAN_CHOT.THUE_TNCN && PR.KHONG_CAN_CHOT.TONG_HOP_NV);
});

test("U-RP103-06 Tổng hợp theo phòng ban cũ vẫn dùng được (đổi tên rõ nghĩa), khớp bảng tổng hợp NV", () => {
  const a = PR.build("TONG_HOP", src(), opt()), b = PR.build("TONG_HOP_NV", src(), opt());
  assert.match(a.title, /THEO PHÒNG BAN/); assert.equal(a.tong["Thực lĩnh"], b.tong["Thực lĩnh"]);
});
