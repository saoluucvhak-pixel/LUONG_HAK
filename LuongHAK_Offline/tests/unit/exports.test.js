// Thư mục file xuất (2.0-α16): lưu không ghi đè, chỉ mở file trong thư mục xuất, nhớ cấu hình theo máy
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");
const { createExports } = require("../../main/exports.js");

function setup(extra) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hak-exp-"));
  let settings = {};
  const ex = createExports(Object.assign({ readSettings: () => JSON.parse(JSON.stringify(settings)), writeSettings: (o) => { settings = JSON.parse(JSON.stringify(o)); }, defaultDir: path.join(root, "File xuat") }, extra || {}));
  return { root, ex, settings: () => settings };
}

test("U-EX-01 trùng tên KHÔNG ghi đè: thêm (1), (2); tạo thư mục mặc định khi chưa có", () => {
  const { root, ex } = setup();
  const a = ex.target("BangLuong_2026-09.xlsx"); assert.equal(a, path.join(root, "File xuat", "BangLuong_2026-09.xlsx")); fs.writeFileSync(a, "1");
  const b = ex.target("BangLuong_2026-09.xlsx"); assert.equal(path.basename(b), "BangLuong_2026-09 (1).xlsx"); fs.writeFileSync(b, "2");
  assert.equal(path.basename(ex.target("BangLuong_2026-09.xlsx")), "BangLuong_2026-09 (2).xlsx");
  assert.equal(fs.readFileSync(a, "utf8"), "1", "file cũ còn nguyên");
});

test("U-EX-02 tên file từ trang tải không thể thoát khỏi thư mục xuất", () => {
  const { root, ex } = setup();
  for (const bad of ["../../x.xlsx", "..\\..\\x.xlsx", "C:\\Windows\\x.xlsx", "/etc/x.xlsx"]) assert.equal(path.dirname(ex.target(bad)), path.join(root, "File xuat"), bad);
  assert.equal(ex.cleanName('a<b>:c"?.xlsx'), "a_b__c__.xlsx");
  assert.equal(ex.cleanName(""), "file"); assert.equal(ex.cleanName(".."), "file");
});

test("U-EX-03 mở file: chỉ TÊN file có thật trong thư mục xuất, đúng loại app xuất ra (không mở .exe, không thư mục con, không ..)", () => {
  const { root, ex } = setup();
  const d = path.join(root, "File xuat"); fs.mkdirSync(path.join(d, "sub"), { recursive: true });
  fs.writeFileSync(path.join(d, "BC.xlsx"), "x"); fs.writeFileSync(path.join(d, "virus.exe"), "x"); fs.writeFileSync(path.join(d, "sub", "a.xlsx"), "x"); fs.writeFileSync(path.join(root, "ngoai.xlsx"), "x");
  assert.equal(ex.resolve("BC.xlsx"), path.join(d, "BC.xlsx"));
  for (const bad of ["virus.exe", "sub/a.xlsx", "sub\\a.xlsx", "../ngoai.xlsx", "..", ".", "", null, 5, "khongco.xlsx", "sub"]) assert.equal(ex.resolve(bad), null, String(bad));
  assert.deepEqual(ex.list().map((f) => f.name), ["BC.xlsx"], "danh sách bỏ .exe và thư mục con");
});

test("U-EX-04 danh sách mới nhất trước; đổi thư mục / tự mở thư mục nhớ trong cấu hình máy", () => {
  const { root, ex, settings } = setup();
  const d = path.join(root, "File xuat"); fs.mkdirSync(d, { recursive: true });
  ["cu.xlsx", "giua.csv", "moi.doc"].forEach((n, i) => { const f = path.join(d, n); fs.writeFileSync(f, "x".repeat(i + 1)); fs.utimesSync(f, 1e9 + i * 100, 1e9 + i * 100); });
  assert.deepEqual(ex.list().map((f) => f.name), ["moi.doc", "giua.csv", "cu.xlsx"]); assert.equal(ex.list(1).length, 1);
  assert.equal(ex.openAfter(), true, "mặc định: tải xong mở thư mục");
  ex.setOpenAfter(false); assert.equal(ex.openAfter(), false); assert.equal(settings().openAfterDownload, false);
  assert.equal(ex.setDir(path.join(root, "khongco")).ok, false, "thư mục không tồn tại");
  const other = path.join(root, "USB"); fs.mkdirSync(other);
  assert.equal(ex.setDir(other).ok, true); assert.equal(ex.dir(), other); assert.equal(settings().exportDir, other);
  fs.rmdirSync(other); assert.equal(ex.dir(), d, "thư mục đã chọn bị rút / xóa → về mặc định, không lỗi");
  ex.setDir(null); assert.equal(settings().exportDir, undefined); assert.equal(ex.dir(), d);
});

test("U-EX-05 kiểm thử tự động: HAK_DOWNLOAD_DIR cố định thư mục", () => {
  const { root, ex } = setup({ fixedDir: "/tmp/hak-fixed" });
  assert.equal(ex.dir(), "/tmp/hak-fixed"); assert.ok(root);
});
