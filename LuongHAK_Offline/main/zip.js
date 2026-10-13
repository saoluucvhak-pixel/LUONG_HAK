// ZIP tối giản, không phụ thuộc thư viện ngoài (app chạy offline, giữ gói cài nhỏ): ghi tuần tự (stream) + đọc thư mục trung tâm.
// Hỗ trợ method 0 (store) và 8 (deflate), tên UTF-8, KHÔNG hỗ trợ ZIP64 (mỗi file < 4 GB, tổng < 4 GB — đủ cho dữ liệu lương + chứng từ).
"use strict";
const fs = require("fs"), zlib = require("zlib"), crypto = require("crypto");
const CHUNK = 1 << 20, LIM = 0xFFFFFFFF;
const TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf, crc) { let c = (crc === undefined ? 0 : crc) ^ 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function dosTime(d) { return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF }; }
/** Tên mục hợp lệ: tương đối, dùng "/", không "..", không ký tự điều khiển. */
function safeName(n) { return typeof n === "string" && n.length > 0 && n.length < 400 && !/^[\\/]/.test(n) && !/[\\\u0000-\u001f]/.test(n) && !/(^|\/)\.\.(\/|$)/.test(n) && !/^[A-Za-z]:/.test(n); }

function createWriter(file, opts) {
  opts = opts || {};
  const fd = fs.openSync(file, "wx"), entries = []; let off = 0, closed = false;
  const stamp = dosTime(opts.now ? opts.now() : new Date());
  const w = (buf) => { let p = 0; while (p < buf.length) p += fs.writeSync(fd, buf, p, buf.length - p); off += buf.length; };
  function header(name, method, crc, csize, size) {
    const nb = Buffer.from(name, "utf8"), h = Buffer.alloc(30 + nb.length);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(method, 8); h.writeUInt16LE(stamp.time, 10); h.writeUInt16LE(stamp.date, 12);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(csize, 18); h.writeUInt32LE(size, 22); h.writeUInt16LE(nb.length, 26); h.writeUInt16LE(0, 28); nb.copy(h, 30); return h;
  }
  function check(name, size) { if (!safeName(name)) throw new Error("Tên mục không hợp lệ: " + name); if (entries.some((e) => e.name === name)) throw new Error("Trùng tên mục: " + name); if (size >= LIM || off >= LIM) throw new Error("Gói vượt giới hạn 4 GB"); if (entries.length >= 65535) throw new Error("Quá nhiều mục"); }
  return {
    addBuffer(name, buf, o) {
      check(name, buf.length); const deflate = !(o && o.store), data = deflate ? zlib.deflateRawSync(buf, { level: 6 }) : buf, method = deflate ? 8 : 0, crc = crc32(buf);
      entries.push({ name, method, crc, csize: data.length, size: buf.length, offset: off }); w(header(name, method, crc, data.length, buf.length)); w(data);
    },
    /** File lớn (chứng từ): 2 lượt đọc từng khối, không nạp cả file vào bộ nhớ; lưu nguyên (store) vì ảnh/PDF đã nén sẵn. */
    addFile(name, src) {
      const st = fs.statSync(src); check(name, st.size); const rf = fs.openSync(src, "r"), buf = Buffer.alloc(CHUNK);
      try {
        let crc = 0, n, tot = 0; while ((n = fs.readSync(rf, buf, 0, CHUNK, null)) > 0) { crc = crc32(buf.subarray(0, n), crc); tot += n; }
        if (tot !== st.size) throw new Error("File đổi kích thước khi đang đóng gói: " + name);
        entries.push({ name, method: 0, crc, csize: tot, size: tot, offset: off }); w(header(name, 0, crc, tot, tot));
        fs.closeSync(rf); const rf2 = fs.openSync(src, "r"); let got = 0;
        try { while ((n = fs.readSync(rf2, buf, 0, CHUNK, null)) > 0) { w(buf.subarray(0, n)); got += n; } } finally { fs.closeSync(rf2); }
        if (got !== tot) throw new Error("File đổi nội dung khi đang đóng gói: " + name);
        return { crc, size: tot };
      } finally { try { fs.closeSync(rf); } catch (e) { /* đã đóng */ } }
    },
    finish() {
      if (closed) return; const start = off;
      entries.forEach((e) => {
        const nb = Buffer.from(e.name, "utf8"), c = Buffer.alloc(46 + nb.length);
        c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(e.method, 10); c.writeUInt16LE(stamp.time, 12); c.writeUInt16LE(stamp.date, 14);
        c.writeUInt32LE(e.crc, 16); c.writeUInt32LE(e.csize, 20); c.writeUInt32LE(e.size, 24); c.writeUInt16LE(nb.length, 28); c.writeUInt32LE(e.offset, 42); nb.copy(c, 46); w(c);
      });
      const e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(entries.length, 8); e.writeUInt16LE(entries.length, 10); e.writeUInt32LE(off - start, 12); e.writeUInt32LE(start, 16); w(e);
      fs.fsyncSync(fd); fs.closeSync(fd); closed = true;
    },
    abort() { if (!closed) { try { fs.closeSync(fd); } catch (e) { /* bỏ qua */ } closed = true; } }
  };
}

/** Đọc thư mục trung tâm. Ném lỗi nếu không phải ZIP hợp lệ / tên mục nguy hiểm. */
/** limits: { maxEntries, maxTotalBytes, maxRatio } — chống ZIP bomb (tỉ lệ nén phi lý, tổng dung lượng giải nén quá lớn, quá nhiều mục). */
function openZip(file, limits) {
  limits = Object.assign({ maxEntries: 200000, maxTotalBytes: 64 * 1024 * 1024 * 1024, maxRatio: 1000 }, limits || {});
  const fd = fs.openSync(file, "r"), size = fs.fstatSync(fd).size;
  const fail = (m) => { fs.closeSync(fd); throw new Error(m); };
  if (size < 22) fail("File quá nhỏ, không phải gói ZIP");
  const tailLen = Math.min(size, 65557), tail = Buffer.alloc(tailLen); fs.readSync(fd, tail, 0, tailLen, size - tailLen);
  let p = -1; for (let i = tailLen - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50) { p = i; break; }
  if (p < 0) fail("Không phải gói ZIP (thiếu bản ghi kết thúc)");
  const count = tail.readUInt16LE(p + 10), cdSize = tail.readUInt32LE(p + 12), cdOff = tail.readUInt32LE(p + 16);
  if (count === 0xFFFF || cdOff === LIM || cdOff + cdSize > size) fail("Gói ZIP không hợp lệ hoặc dùng ZIP64 (không hỗ trợ)");
  const cd = Buffer.alloc(cdSize); fs.readSync(fd, cd, 0, cdSize, cdOff);
  if (count > limits.maxEntries) fail("Gói ZIP có quá nhiều mục (" + count + ")");
  const entries = [], byName = {}; let q = 0, totalU = 0;
  for (let i = 0; i < count; i++) {
    if (q + 46 > cd.length || cd.readUInt32LE(q) !== 0x02014b50) fail("Thư mục trung tâm ZIP bị hỏng");
    const flags = cd.readUInt16LE(q + 8), method = cd.readUInt16LE(q + 10), crc = cd.readUInt32LE(q + 16), csize = cd.readUInt32LE(q + 20), usize = cd.readUInt32LE(q + 24);
    const nl = cd.readUInt16LE(q + 28), xl = cd.readUInt16LE(q + 30), cl = cd.readUInt16LE(q + 32), offset = cd.readUInt32LE(q + 42), name = cd.toString("utf8", q + 46, q + 46 + nl);
    if (flags & 1) fail("Gói ZIP có mã hóa — không hỗ trợ");
    if (!safeName(name)) fail("Gói ZIP chứa tên mục không an toàn: " + name);
    if (byName[name]) fail("Gói ZIP trùng tên mục: " + name);
    if (method !== 0 && method !== 8) fail("Gói ZIP dùng kiểu nén không hỗ trợ: " + name);
    if (offset + 30 + csize > size) fail("Mục vượt ngoài file ZIP: " + name);
    totalU += usize; if (totalU > limits.maxTotalBytes) fail("Tổng dung lượng giải nén của gói quá lớn — nghi ZIP bomb");
    if (usize > 1048576 && csize > 0 && usize / csize > limits.maxRatio) fail("Tỉ lệ nén bất thường ở mục " + name + " — nghi ZIP bomb");
    if (usize > 1048576 && csize === 0) fail("Kích thước mục không hợp lệ: " + name);
    const e = { name, method, crc, csize, size: usize, offset }; entries.push(e); byName[name] = e; q += 46 + nl + xl + cl;
  }
  function dataStart(e) { const h = Buffer.alloc(30); fs.readSync(fd, h, 0, 30, e.offset); if (h.readUInt32LE(0) !== 0x04034b50) throw new Error("Header cục bộ hỏng: " + e.name); return e.offset + 30 + h.readUInt16LE(26) + h.readUInt16LE(28); }
  /** Giải nén ra Buffer (mục nhỏ: manifest, data.json, sidecar) và kiểm CRC. */
  function readBuffer(e, maxSize) {
    if (e.size > (maxSize || 1024 * 1024 * 1024)) throw new Error("Mục quá lớn để đọc vào bộ nhớ: " + e.name);
    const raw = Buffer.alloc(e.csize); fs.readSync(fd, raw, 0, e.csize, dataStart(e));
    const out = e.method === 8 ? zlib.inflateRawSync(raw, { maxOutputLength: e.size + 1 }) : raw;
    if (out.length !== e.size || crc32(out) !== e.crc) throw new Error("CRC/kích thước không khớp: " + e.name);
    return out;
  }
  /** Duyệt từng khối nội dung (chỉ method 0) — dùng tính SHA-256 / chép ra file mà không nạp cả file. */
  function eachChunk(e, cb) {
    if (e.method !== 0) return cb(readBuffer(e));
    const buf = Buffer.alloc(CHUNK), start = dataStart(e); let pos = 0;
    while (pos < e.csize) { const n = fs.readSync(fd, buf, 0, Math.min(CHUNK, e.csize - pos), start + pos); if (n <= 0) throw new Error("Đọc thiếu dữ liệu: " + e.name); cb(buf.subarray(0, n)); pos += n; }
  }
  function sha256Of(e) { const h = crypto.createHash("sha256"); let c = 0, n = 0; eachChunk(e, (b) => { h.update(b); c = crc32(b, c); n += b.length; }); if (c !== e.crc || n !== e.size) throw new Error("CRC/kích thước không khớp: " + e.name); return h.digest("hex"); }
  function extractTo(e, dest) { const wfd = fs.openSync(dest, "wx"); try { eachChunk(e, (b) => { let p = 0; while (p < b.length) p += fs.writeSync(wfd, b, p, b.length - p); }); fs.fsyncSync(wfd); } finally { fs.closeSync(wfd); } }
  return { entries, byName, readBuffer, sha256Of, extractTo, close: () => fs.closeSync(fd) };
}
module.exports = { createWriter, openZip, crc32, safeName };
