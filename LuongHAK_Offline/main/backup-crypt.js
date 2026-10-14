// Mã hóa gói sao lưu bằng mật khẩu (V10.1, tùy chọn): AES-256-GCM theo khối 1 MiB + khóa dẫn xuất scrypt.
// Chỉ bọc NGOÀI file .zip Full Backup — định dạng dữ liệu đang chạy và manifest bên trong KHÔNG đổi.
// An toàn: mỗi khối có thẻ xác thực + AAD gồm tiêu đề, số thứ tự khối, cờ khối cuối ⇒ phát hiện sửa/đảo/cắt cụt.
// Không lưu mật khẩu/khóa ở đâu cả; mất mật khẩu = không giải mã được (không có cửa hậu).
"use strict";
const fs = require("fs"), fsp = fs.promises, crypto = require("crypto");
const MAGIC = Buffer.from("HAKENC01"), CHUNK = 1 << 20, TAG = 16, MIN_PW = 10;
const SCRYPT = { N: 1 << 15, r: 8, p: 1 }; // ~32 MiB RAM, vài trăm ms — đủ chậm cho dò mật khẩu
const isEnc = (name) => /\.hakenc$/i.test(String(name || ""));

/** Kiểm tra độ mạnh tối thiểu. → "" nếu đạt, ngược lại thông báo tiếng Việt. */
function checkPassword(pw) {
  pw = String(pw == null ? "" : pw);
  if (pw.length < MIN_PW) return "Mật khẩu tối thiểu " + MIN_PW + " ký tự";
  if (/^(.)\1+$/.test(pw)) return "Mật khẩu không được lặp một ký tự";
  if ([/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length < 2) return "Mật khẩu cần kết hợp ít nhất 2 loại: chữ thường, chữ hoa, số, ký tự đặc biệt";
  return "";
}
function deriveKey(pw, salt, p) {
  return new Promise((res, rej) => crypto.scrypt(Buffer.from(String(pw), "utf8"), salt, 32, { N: p.N, r: p.r, p: p.p, maxmem: 256 * p.N * p.r }, (e, k) => e ? rej(e) : res(k)));
}
const nonceOf = (base, i) => { const n = Buffer.alloc(12); base.copy(n, 0, 0, 8); n.writeUInt32BE(i >>> 0, 8); return n; };
const aadOf = (hdr, i, last) => { const b = Buffer.alloc(5); b.writeUInt32BE(i >>> 0, 0); b[4] = last ? 1 : 0; return Buffer.concat([hdr, b]); };

/** Mã hóa src → dest (ghi qua dest.tmp rồi đổi tên). @returns {ok, size, sha256} hoặc {ok:false,error} */
async function encryptFile(src, dest, password, opt) {
  opt = opt || {};
  const bad = checkPassword(password); if (bad) return { ok: false, error: bad };
  const tmp = dest + ".tmp"; let fin, fout;
  try {
    const st = await fsp.stat(src), salt = crypto.randomBytes(16), nb = crypto.randomBytes(8);
    const params = Object.assign({}, SCRYPT, opt.scrypt || {});
    const key = await deriveKey(password, salt, params);
    const hdr = Buffer.from(JSON.stringify({ v: 1, alg: "AES-256-GCM", kdf: "scrypt", N: params.N, r: params.r, p: params.p, salt: salt.toString("hex"), nonce: nb.toString("hex"), chunk: CHUNK, plain: st.size }), "utf8");
    fin = await fsp.open(src, "r"); fout = await fsp.open(tmp, "w");
    const head = Buffer.alloc(MAGIC.length + 4); MAGIC.copy(head); head.writeUInt32BE(hdr.length, MAGIC.length);
    await fout.write(head); await fout.write(hdr);
    const sha = crypto.createHash("sha256"); sha.update(head); sha.update(hdr);
    const buf = Buffer.alloc(CHUNK); let pos = 0, i = 0, size = head.length + hdr.length;
    for (;;) {
      if (opt.shouldCancel && opt.shouldCancel()) throw new Error("Đã hủy");
      let got = 0; while (got < CHUNK) { const r = await fin.read(buf, got, CHUNK - got, pos + got); if (!r.bytesRead) break; got += r.bytesRead; }
      const last = pos + got >= st.size;
      const c = crypto.createCipheriv("aes-256-gcm", key, nonceOf(nb, i)); c.setAAD(aadOf(hdr, i, last));
      const ct = Buffer.concat([c.update(buf.subarray(0, got)), c.final()]), tag = c.getAuthTag();
      const lenb = Buffer.alloc(4); lenb.writeUInt32BE(ct.length, 0);
      await fout.write(lenb); await fout.write(ct); await fout.write(tag);
      sha.update(lenb); sha.update(ct); sha.update(tag); size += 4 + ct.length + TAG;
      pos += got; i++; if (opt.onProgress) opt.onProgress(Math.min(1, st.size ? pos / st.size : 1));
      if (last) break;
    }
    await fout.sync(); await fout.close(); fout = null; await fin.close(); fin = null;
    await fsp.rename(tmp, dest);
    return { ok: true, size, sha256: sha.digest("hex") };
  } catch (e) {
    try { if (fin) await fin.close(); } catch (x) { /* đã đóng */ } try { if (fout) await fout.close(); } catch (x) { /* đã đóng */ }
    try { await fsp.unlink(tmp); } catch (x) { /* chưa tạo */ }
    return { ok: false, error: String(e && e.message || e) };
  }
}

/** Giải mã src → dest (qua dest.tmp). Sai mật khẩu / tệp bị sửa / cắt cụt → {ok:false, code}. Không để lại file dở. */
async function decryptFile(src, dest, password, opt) {
  opt = opt || {}; const tmp = dest + ".tmp"; let fin, fout;
  const fail = (code, error) => ({ ok: false, code, error });
  try {
    fin = await fsp.open(src, "r"); const st = await fin.stat();
    const head = Buffer.alloc(MAGIC.length + 4); const hr = await fin.read(head, 0, head.length, 0);
    if (hr.bytesRead < head.length || !head.subarray(0, MAGIC.length).equals(MAGIC)) { await fin.close(); return fail("FORMAT", "Không phải tệp sao lưu mã hóa của app"); }
    const hl = head.readUInt32BE(MAGIC.length); if (hl < 2 || hl > 4096) { await fin.close(); return fail("FORMAT", "Tiêu đề tệp mã hóa không hợp lệ"); }
    const hdr = Buffer.alloc(hl); const h2 = await fin.read(hdr, 0, hl, head.length);
    let meta; try { if (h2.bytesRead !== hl) throw new Error("cut"); meta = JSON.parse(hdr.toString("utf8")); } catch (e) { await fin.close(); return fail("FORMAT", "Tiêu đề tệp mã hóa hỏng"); }
    if (meta.v !== 1 || meta.alg !== "AES-256-GCM" || meta.kdf !== "scrypt" || meta.chunk !== CHUNK || !(meta.N >= 1 << 14 && meta.N <= 1 << 20) || meta.r !== 8 || meta.p !== 1) { await fin.close(); return fail("FORMAT", "Phiên bản/thông số mã hóa không được hỗ trợ"); }
    const key = await deriveKey(password, Buffer.from(meta.salt, "hex"), meta), nb = Buffer.from(meta.nonce, "hex");
    fout = await fsp.open(tmp, "w"); let pos = head.length + hl, i = 0, total = 0;
    for (;;) {
      if (opt.shouldCancel && opt.shouldCancel()) throw new Error("Đã hủy");
      const lenb = Buffer.alloc(4), r1 = await fin.read(lenb, 0, 4, pos);
      if (r1.bytesRead < 4) throw Object.assign(new Error("Tệp bị cắt cụt"), { code: "TRUNC" });
      const n = lenb.readUInt32BE(0); if (n > CHUNK) throw Object.assign(new Error("Khối dữ liệu không hợp lệ"), { code: "FORMAT" });
      const ct = Buffer.alloc(n), tag = Buffer.alloc(TAG), r2 = await fin.read(ct, 0, n, pos + 4), r3 = await fin.read(tag, 0, TAG, pos + 4 + n);
      if (r2.bytesRead < n || r3.bytesRead < TAG) throw Object.assign(new Error("Tệp bị cắt cụt"), { code: "TRUNC" });
      pos += 4 + n + TAG; const last = pos >= st.size;
      const d = crypto.createDecipheriv("aes-256-gcm", key, nonceOf(nb, i)); d.setAAD(aadOf(hdr, i, last)); d.setAuthTag(tag);
      let pt; try { pt = Buffer.concat([d.update(ct), d.final()]); } catch (e) { throw Object.assign(new Error(i === 0 ? "Sai mật khẩu hoặc tệp đã bị sửa" : "Tệp đã bị sửa hoặc cắt cụt (khối " + (i + 1) + ")"), { code: i === 0 ? "AUTH" : "TAMPER" }); }
      await fout.write(pt); total += pt.length; i++;
      if (opt.onProgress) opt.onProgress(Math.min(1, pos / st.size));
      if (last) break;
    }
    if (meta.plain != null && total !== meta.plain) throw Object.assign(new Error("Kích thước sau giải mã không khớp"), { code: "TAMPER" });
    await fout.sync(); await fout.close(); fout = null; await fin.close(); fin = null;
    await fsp.rename(tmp, dest);
    return { ok: true, size: total };
  } catch (e) {
    try { if (fin) await fin.close(); } catch (x) { /* đã đóng */ } try { if (fout) await fout.close(); } catch (x) { /* đã đóng */ }
    try { await fsp.unlink(tmp); } catch (x) { /* chưa tạo */ }
    return fail(e.code || "ERR", String(e && e.message || e));
  }
}
module.exports = { encryptFile, decryptFile, checkPassword, isEnc, MIN_PW };
