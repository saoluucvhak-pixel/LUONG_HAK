// OCR bảng chấm công / chấm cơm (2.0-α20): đọc số trong ô, dựng bảng từ ô, tìm ô theo đường kẻ, ghép tên NV.
// Dữ liệu giả lập hoàn toàn (không dùng ảnh / tên thật).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const zlib = require("zlib");
const G = require("../../core/table-grid.js");
const TP = require("../../core/timesheet-parse.js");
const { sanitizeOcrItems, encodeGrayPNG } = require("../../main/ocr-service.js");

// Lưới ô giả: rows × cols, ô (r,c) có chữ text(r,c)
function grid(rows, widths, text, rowH) {
  rowH = rowH || 40; const cells = []; let y = 0;
  for (let r = 0; r < rows; r++) {
    let x = 0;
    for (let c = 0; c < widths.length; c++) {
      const t = text(r, c), n = G.parseCellNumber(t);
      cells.push({ x0: x, y0: y, x1: x + widths[c], y1: y + rowH, cx: x + widths[c] / 2, cy: y + rowH / 2, text: t, conf: 90, num: n == null ? null : /[A-Za-zÀ-ỹ]{2,}/.test(t) ? null : n });
      x += widths[c] + 2;
    }
    y += rowH + 2;
  }
  return cells;
}

test("U-OCR-01 đọc số trong ô: sửa lỗi OCR hay gặp, ½, ô trống / không đọc được", () => {
  const P = G.parseCellNumber;
  assert.strictEqual(P("1"), 1); assert.strictEqual(P("l"), 1); assert.strictEqual(P("|"), 1); assert.strictEqual(P("Ỉ"), 1);
  assert.strictEqual(P("0,5"), 0.5); assert.strictEqual(P(".5"), 0.5); assert.strictEqual(P("1/2"), 0.5);
  assert.strictEqual(P("O"), 0); assert.strictEqual(P("S"), 5); assert.strictEqual(P("28."), 28);
  assert.strictEqual(P(""), null); assert.strictEqual(P("  "), null);
  assert.ok(Number.isNaN(P("?#")));
});

test("U-OCR-02 kỳ trong tiêu đề, loại dòng, ghép tên NV (bỏ 'anh / chú / cô')", () => {
  assert.strictEqual(TP.periodFromText("BẢNG CHẤM CÔNG THÁNG 09/2026"), "2026-09");
  assert.strictEqual(TP.periodFromText("Tháng 3 năm 2026"), "2026-03");
  assert.strictEqual(TP.periodFromText("Tháng 13/2026"), "");
  assert.strictEqual(TP.kindOf("Tăng ca"), "Tăng ca"); assert.strictEqual(TP.kindOf("Cơm"), "Cơm"); assert.strictEqual(TP.kindOf("CÔNG"), "Công");
  const list = [{ ma: "NV001", ten: "Phạm Minh Khoa" }, { ma: "NV002", ten: "Đỗ Thu Hằng" }, { ma: "NV003", ten: "Lê Văn Khoa" }];
  const m1 = TP.matchName("chú Phạm Minh Khoa", list);
  assert.strictEqual(m1[0].ma, "NV001"); assert.ok(m1[0].score >= 1);
  const m2 = TP.matchName("Khoa", list); // chỉ khớp tên → điểm thấp, 2 người cùng tên
  assert.ok(m2.length === 2 && m2[0].score < 0.6);
  assert.deepStrictEqual(TP.matchName("", list), []);
});

test("U-OCR-03 kiểu A (người × ngày): dựng giá trị theo ngày, so với cột Tổng công, bỏ dòng cộng 0 0 0", () => {
  const days = 30, widths = [200].concat(Array(days).fill(30)).concat([60]);
  const vals = { 1: [1, 1, 0.5].concat(Array(27).fill("")), 2: Array(30).fill("1") };
  const cells = grid(4, widths, (r, c) => {
    if (r === 0) return c === 0 ? "Họ và tên" : c <= days ? String(c) : "Tổng công";
    if (r === 3) return c === 0 ? "" : c <= days ? "0" : "32"; // dòng cộng cột
    if (c === 0) return r === 1 ? "Phạm Minh Khoa" : "Đỗ Thu Hằng";
    if (c <= days) return String(vals[r][c - 1]);
    return r === 1 ? "2.5" : "29"; // NV 2 ghi tổng sai → phải báo lệch
  });
  const T = TP.parse(cells);
  assert.strictEqual(T.layout, "A"); assert.strictEqual(T.days.length, 30);
  assert.strictEqual(T.lines.length, 2);
  const [a, b] = T.lines;
  assert.strictEqual(a.name, "Phạm Minh Khoa"); assert.strictEqual(a.values[3], 0.5); assert.strictEqual(a.values[4], null);
  assert.strictEqual(a.sum, 2.5); assert.ok(a.check.length === 1 && a.check[0].ok);
  assert.strictEqual(b.sum, 30); assert.ok(b.check.length === 1 && !b.check[0].ok, "lệch tổng phải được báo");
});

test("U-OCR-04 kiểu B (lịch làm dọc): cột Công / Cơm, dòng TC (kể cả nhãn TC bị đọc thành số) là tổng", () => {
  const days = 30, com = Array(days).fill("1"); com[9] = ""; com[20] = "";
  const cells = grid(days + 2, [80, 90, 90], (r, c) => {
    if (r === 0) return ["Ngày", "Công", "Cơm"][c];
    if (r === days + 1) return ["1", "30", "28"][c]; // nhãn "TC" OCR đọc nhầm thành "1"
    return c === 0 ? String(r) : c === 1 ? "1" : com[r - 1];
  }, 30);
  const T = TP.parse(cells);
  assert.strictEqual(T.layout, "B"); assert.strictEqual(T.days.length, 30);
  const cong = T.lines.find((l) => l.kind === "Công"), cm = T.lines.find((l) => l.kind === "Cơm");
  assert.strictEqual(cong.sum, 30); assert.strictEqual(cm.sum, 28); assert.strictEqual(cm.values[10], null);
  assert.deepStrictEqual(cong.totals, { TC: 30 }); assert.ok(cm.check[0].ok && cong.check[0].ok);
});

test("U-OCR-05 không có bảng / không có hàng ngày → cảnh báo, không đoán bừa", () => {
  assert.deepStrictEqual(TP.parse([]).lines, []);
  const T = TP.parse(grid(3, [100, 100, 100], () => "abc"));
  assert.strictEqual(T.layout, null); assert.ok(T.warnings.length);
});

test("U-OCR-06 tìm ô theo đường kẻ trên ảnh vẽ sẵn (kể cả nghiêng nhẹ)", () => {
  const w = 620, h = 260, g = new Uint8Array(w * h).fill(255);
  const slope = 0.01; // nghiêng ~0,6°
  for (let i = 0; i <= 5; i++) { const y = 20 + i * 44; for (let x = 20; x <= 600; x++) { const yy = Math.round(y + (x - 20) * slope); for (let t = 0; t < 2; t++) g[(yy + t) * w + x] = 0; } }
  for (let j = 0; j <= 8; j++) { const x = 20 + j * 72.5 | 0; for (let y = 20; y <= 246; y++) { const xx = Math.round(x - (y - 20) * slope); for (let t = 0; t < 2; t++) g[y * w + xx + t] = 0; } }
  const b = G.binarize(g, w, h), f = G.findCells(b, w, h);
  assert.strictEqual(f.cells.length, 5 * 8, "5 hàng × 8 cột");
  assert.ok(f.box && f.box.x0 <= 22 && f.box.x1 >= 598);
});

test("U-OCR-07 nét '1' viết tay: nét đứng mảnh = 1, vòng tròn thì không", () => {
  const w = 40, h = 50;
  const one = new Uint8Array(w * h); for (let y = 8; y < 44; y++) for (let x = 19; x < 23; x++) one[y * w + x] = 1;
  assert.ok(G.looksLikeOne(G.inkComponents(one, w, { x0: 0, y0: 0, x1: w, y1: h }), h));
  const zero = new Uint8Array(w * h); for (let a = 0; a < 360; a++) { const x = Math.round(20 + 12 * Math.cos(a * Math.PI / 180)), y = Math.round(25 + 16 * Math.sin(a * Math.PI / 180)); zero[y * w + x] = 1; zero[y * w + x + 1] = 1; }
  assert.ok(!G.looksLikeOne(G.inkComponents(zero, w, { x0: 0, y0: 0, x1: w, y1: h }), h));
});

test("U-OCR-08 cầu nối OCR: lô sai giữ đúng vị trí (không lệch kết quả), PNG xám hợp lệ", () => {
  const ok = { w: 2, h: 2, data: new Uint8Array(4), mode: "digit" };
  const out = sanitizeOcrItems([ok, { w: 3, h: 3, data: new Uint8Array(4) }, null, { w: 2, h: 2, data: new Uint8Array(4), mode: "rm -rf" }]);
  assert.strictEqual(out.length, 4);
  assert.strictEqual(out[0].mode, "digit"); assert.strictEqual(out[1].w, 0); assert.strictEqual(out[2].w, 0); assert.strictEqual(out[3].mode, "text");
  const png = encodeGrayPNG(new Uint8Array([0, 255, 128, 64]), 2, 2);
  assert.deepStrictEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const idat = png.indexOf("IDAT"), len = png.readUInt32BE(idat - 4), raw = zlib.inflateSync(png.subarray(idat + 4, idat + 4 + len));
  assert.deepStrictEqual([...raw], [0, 0, 255, 0, 128, 64]);
});
