// V10.1 — mã hóa gói sao lưu bằng mật khẩu (main/backup-crypt.js). Dữ liệu giả lập.
"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto");
const BC = require("../../main/backup-crypt.js");
const FAST = { scrypt: { N: 1 << 14, r: 8, p: 1 } };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "hak-bc-"));
const PW = "Mat-khau-Manh-2026";

async function mk(size) { const d = tmp(), s = path.join(d, "a.zip"); fs.writeFileSync(s, crypto.randomBytes(size)); return { d, s, e: path.join(d, "a.zip.hakenc"), o: path.join(d, "out.zip") }; }

test("U-BCR-01 mã hóa → giải mã khứ hồi đúng từng byte (rỗng, nhỏ, đúng 1 khối, nhiều khối)", async () => {
  for (const n of [0, 1, 1000, 1 << 20, (1 << 20) + 1, 3 * (1 << 20) + 17]) {
    const x = await mk(n), a = await BC.encryptFile(x.s, x.e, PW, FAST);
    assert.equal(a.ok, true, a.error);
    const b = await BC.decryptFile(x.e, x.o, PW);
    assert.equal(b.ok, true, b.error); assert.equal(b.size, n);
    assert.ok(fs.readFileSync(x.s).equals(fs.readFileSync(x.o)), "nội dung sau giải mã phải y hệt, n=" + n);
    assert.equal(fs.readdirSync(x.d).filter((f) => /\.tmp$/.test(f)).length, 0, "không để lại file tạm");
  }
});
test("U-BCR-02 sai mật khẩu → AUTH, không tạo file giải mã; tệp mã hóa không chứa bản rõ", async () => {
  const x = await mk(5000); await BC.encryptFile(x.s, x.e, PW, FAST);
  const r = await BC.decryptFile(x.e, x.o, PW + "x");
  assert.equal(r.ok, false); assert.equal(r.code, "AUTH"); assert.equal(fs.existsSync(x.o), false); assert.equal(fs.existsSync(x.o + ".tmp"), false);
  const plain = fs.readFileSync(x.s); assert.equal(fs.readFileSync(x.e).indexOf(plain.subarray(0, 64)), -1);
});
test("U-BCR-03 sửa 1 byte / cắt cụt / thêm đuôi → bị phát hiện, không ghi ra file", async () => {
  const x = await mk(2 * (1 << 20) + 5); await BC.encryptFile(x.s, x.e, PW, FAST);
  const good = fs.readFileSync(x.e);
  const flip = Buffer.from(good); flip[flip.length - 100] ^= 1; fs.writeFileSync(x.e, flip);
  let r = await BC.decryptFile(x.e, x.o, PW); assert.equal(r.ok, false); assert.ok(["TAMPER", "AUTH"].includes(r.code));
  fs.writeFileSync(x.e, good.subarray(0, good.length - (1 << 20) - 20)); // mất khối cuối
  r = await BC.decryptFile(x.e, x.o, PW); assert.equal(r.ok, false);
  fs.writeFileSync(x.e, Buffer.concat([good, Buffer.from([1, 2, 3])]));
  r = await BC.decryptFile(x.e, x.o, PW); assert.equal(r.ok, false);
  assert.equal(fs.existsSync(x.o), false);
});
test("U-BCR-04 đảo thứ tự khối bị phát hiện (AAD gồm số thứ tự)", async () => {
  const x = await mk(2 * (1 << 20) + 5); await BC.encryptFile(x.s, x.e, PW, FAST);
  const g = fs.readFileSync(x.e), hl = g.readUInt32BE(8), off = 12 + hl, one = 4 + (1 << 20) + 16;
  const sw = Buffer.concat([g.subarray(0, off), g.subarray(off + one, off + 2 * one), g.subarray(off, off + one), g.subarray(off + 2 * one)]);
  fs.writeFileSync(x.e, sw); const r = await BC.decryptFile(x.e, x.o, PW); assert.equal(r.ok, false);
});
test("U-BCR-05 mật khẩu yếu bị từ chối; tệp không phải định dạng → FORMAT; hai lần mã hóa cùng tệp ra bản khác nhau (salt/nonce ngẫu nhiên)", async () => {
  const x = await mk(100);
  for (const p of ["", "ngan", "aaaaaaaaaaaa", "chicochuthuong"]) { const r = await BC.encryptFile(x.s, x.e, p, FAST); assert.equal(r.ok, false); assert.equal(fs.existsSync(x.e), false); }
  assert.equal((await BC.decryptFile(x.s, x.o, PW)).code, "FORMAT");
  await BC.encryptFile(x.s, x.e, PW, FAST); const e2 = x.e + "2"; await BC.encryptFile(x.s, e2, PW, FAST);
  assert.ok(!fs.readFileSync(x.e).equals(fs.readFileSync(e2)));
  assert.equal(BC.isEnc("a.zip.hakenc"), true); assert.equal(BC.isEnc("a.zip"), false);
});
test("U-BCR-06 hủy giữa chừng không để lại file dở", async () => {
  const x = await mk(3 * (1 << 20)); let n = 0;
  const r = await BC.encryptFile(x.s, x.e, PW, Object.assign({ shouldCancel: () => ++n > 1 }, FAST));
  assert.equal(r.ok, false); assert.equal(fs.existsSync(x.e), false); assert.equal(fs.existsSync(x.e + ".tmp"), false);
});
