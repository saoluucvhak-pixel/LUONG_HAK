// V9.4 — đo dựng báo cáo thanh toán / tổng hợp, sổ chứng từ, Excel (ExcelJS) với dữ liệu GIẢ LẬP. Chạy: node tests/perf/v94-bench.js
"use strict";
const path = require("path");
const X = require(path.join(__dirname, "../../exceljs.min.js"));
const PL = require("../../core/payment-ledger.js"), PR = require("../../core/reporting/payroll-reports.js"), RX = require("../../ui/report-xlsx.js");
const mk = (i) => ({ "Mã NV": "N" + String(i).padStart(5, "0"), "Họ và tên": "NV " + i, "Phòng ban": "PB" + (i % 20), "HTTT": i % 5 ? "Chuyển khoản" : "Tiền mặt", "Số tài khoản": "0123" + (100000 + i), "Ngân hàng": "NH", "Tổng thu nhập": 9e6, "BH trừ NLĐ": 1e6, "KPCĐ trừ NLĐ": 0, "Truy thu BH": 0, "Thuế TNCN": 0, "Trừ khác": 0, "Tạm ứng": 0, "Thực lĩnh": 8e6 + (i % 50) * 1000 });
const t = (f) => { const a = process.hrtime.bigint(); const r = f(); return [Number(process.hrtime.bigint() - a) / 1e6, r]; };
(async () => {
  console.log("| NV | Tổng hợp | Kê CK | Lập chứng từ CK | Kiểm tra sổ | Dựng Excel + ghi buffer |\n| ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const n of [500, 2000, 5000]) {
    const rows = Array.from({ length: n }, (_, i) => mk(i)), src = { bangluong: rows, chot: true, blockers: [] }, o = { nam: 2026, thang: 9, tenCongTy: "T", lines: [] };
    const [a] = t(() => PR.build("TONG_HOP", src, o)), [b, vm] = t(() => PR.build("CHUYEN_KHOAN", src, o));
    const [c, lap] = t(() => PL.lapChungTu({ ky: "2026-09", ht: PL.HT.CK, rows, lines: [], nguoi: "x", ngay: "d", chot: true, blockers: [] }));
    const [d] = t(() => PL.kiemTra(lap.dong, { "2026-09": rows }));
    const e0 = process.hrtime.bigint(); const buf = await RX.build(X, vm, {}).xlsx.writeBuffer(); const e = Number(process.hrtime.bigint() - e0) / 1e6;
    console.log("| " + n + " | " + a.toFixed(1) + " ms | " + b.toFixed(1) + " ms | " + c.toFixed(1) + " ms | " + d.toFixed(1) + " ms | " + e.toFixed(0) + " ms (" + Math.round(buf.byteLength / 1024) + " KB) |");
  }
})();
