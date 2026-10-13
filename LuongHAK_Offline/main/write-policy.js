// ===== MAIN / WRITE-POLICY — kiểm quyền GHI theo từng bảng tại tiến trình chính (V9.2 mục XII) =====
// Renderer vẫn gửi cả file dữ liệu (store-save), nhưng main so với bản đang lưu, tìm bảng nào thay đổi, và chỉ cho ghi khi phiên đăng nhập CỦA MAIN
// có quyền tương ứng. Chốt kỳ / mở chốt có thêm kiểm tra riêng; kỳ chốt không được chứa lỗi chặn (tính lại ở main).
// Giới hạn đã biết (ghi trong docs): tài khoản/mã khôi phục lúc CHƯA đăng nhập (đặt lại Admin) vẫn do renderer kiểm mã; file dữ liệu chưa mã hóa trên đĩa.
"use strict";
const crypto = require("crypto"), fs = require("fs");
const MONTHLY = { chamcong: 1, sanluong: 1, bandam: 1, psluong: 1, ungluong: 1, tiencom: 1 };
const PRE_LOGIN_OK = { nguoidung: 1, baomat: 1, auditlog: 1 }; // chưa đăng nhập chỉ được động tới 3 bảng này (đăng nhập / khôi phục / nhật ký)
const SELF_PW_FIELDS = ["salt", "hash", "iter", "phaiDoiMK", "doiMKLuc"];
const AUDIT_TRIM_FLOOR = 15000; // app.js AUDIT_MAX = 20000: chỉ chấp nhận nhật ký ngắn đi khi bản cũ đã rất dài (cắt đầu có sao lưu)

/** Quyền (một trong các quyền) cần để GHI bảng t. Bảng chưa biết → cần ít nhất một quyền sửa dữ liệu. */
function permsFor(t) {
  if (/^dm_/.test(t)) return t === "dm_congthuc" ? ["dm.edit", "formula.approve"] : ["dm.edit"];
  if (MONTHLY[t] || t === "ocr_ten") return ["input.edit"];
  if (t === "congty" || t === "baomat" || t === "nguoidung") return ["system.admin"];
  if (t === "chungtu" || t === "chungtu_lienket") return ["input.edit", "hr.edit"];
  if (t === "kyluong") return ["payroll.close", "payroll.reopen"];
  if (t === "kyluong_lichsu") return ["payroll.reopen"];
  if (t === "nhansu") return ["hr.edit", "payroll.calc", "payroll.close"];
  return ["hr.edit"];
}
const h = (v) => crypto.createHash("sha1").update(JSON.stringify(v === undefined ? null : v)).digest("hex");
const canon = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
const kyKey = (k) => String(k && k.ky) + "|" + (k && k.version || 1);

function createPolicy(opts) {
  const readText = opts.readText;           // () → string|null: nội dung file dữ liệu trên đĩa
  const sigOf = opts.sigOf || (() => "");   // () → "mtime:size" của file dữ liệu
  const gate = opts.gate || null;           // { blockers(db, ky, o) }
  let st = null, pending = null;

  function snapshot(obj) {
    const tables = {}; Object.keys(obj).forEach((k) => { tables[k] = h(obj[k]); });
    const ky = {}; (Array.isArray(obj.kyluong) ? obj.kyluong : []).forEach((k) => { ky[kyKey(k)] = h(k); });
    const aud = Array.isArray(obj.auditlog) ? obj.auditlog : [];
    return { tables, ky, audLen: aud.length, audAll: h(aud), users: (Array.isArray(obj.nguoidung) ? obj.nguoidung : []).map((u) => ({ name: String(u.tenDangNhap || "").toLowerCase(), h: h(u), vaiTro: u.vaiTro, khoa: !!u.khoa, fields: canon(Object.assign({}, u, SELF_PW_FIELDS.reduce((o, f) => (o[f] = null, o), {}), { dangNhapLuc: null })), cred: JSON.stringify(SELF_PW_FIELDS.map((f) => u[f])) })), hasUsers: Array.isArray(obj.nguoidung) && obj.nguoidung.length > 0 };
  }
  function ensurePrev() {
    const sig = sigOf();
    if (st && st.sig === sig) return st;
    const t = readText(); st = null;
    if (t) { try { st = Object.assign({ sig }, snapshot(JSON.parse(t))); } catch (e) { st = null; } }
    return st;
  }
  /**
   * @param text nội dung dữ liệu mới (chuỗi JSON)
   * @param who  { user, perms:[...] } | null (chưa đăng nhập)
   * @param opts { restoring } — true khi tiến trình chính đang giữ khóa khôi phục Full Backup
   * @returns { ok:true } | { ok:false, error }
   */
  function check(text, who, opts) {
    pending = null;
    let next; try { next = JSON.parse(text); } catch (e) { return { ok: false, error: "Dữ liệu cần lưu không hợp lệ" }; }
    if (!next || typeof next !== "object" || Array.isArray(next)) return { ok: false, error: "Dữ liệu cần lưu không hợp lệ" };
    const prev = ensurePrev(), nx = snapshot(next);
    pending = nx;
    if (!prev || !prev.hasUsers) return { ok: true, firstRun: true }; // chưa có dữ liệu / chưa có tài khoản: thiết lập ban đầu
    const changed = Object.keys(nx.tables).filter((k) => prev.tables[k] !== nx.tables[k]).concat(Object.keys(prev.tables).filter((k) => !(k in nx.tables)));
    if (!changed.length) return { ok: true };
    const perms = who && who.perms || [];
    const has = (p) => perms.indexOf(p) >= 0;
    // Khôi phục Full Backup đang chạy (main giữ khóa restore sau bước COMMIT tài sản): thay toàn bộ dữ liệu — chỉ Admin có quyền khôi phục + quản trị
    if (opts && opts.restoring && who && has("backup.restore") && has("system.admin")) return { ok: true, restoring: true };
    const deny = (m) => ({ ok: false, error: "Tiến trình chính từ chối ghi: " + m });
    for (const t of changed) {
      if (!who) {
        if (!PRE_LOGIN_OK[t]) return deny("chưa đăng nhập (bảng " + t + ")");
        if (t === "nguoidung" || t === "baomat") {
          // Chưa đăng nhập chỉ được: (a) ghi dấu thời điểm đăng nhập, (b) đặt lại Admin bằng mã khôi phục (đổi mật khẩu 1 Admin + đổi mã khôi phục cùng lúc)
          const gone = prev.users.filter((p) => !nx.users.some((u) => u.name === p.name));
          const diff = nx.users.filter((u) => { const p = prev.users.filter((x) => x.name === u.name)[0]; return !p || p.h !== u.h; });
          const credChanged = diff.filter((u) => { const p = prev.users.filter((x) => x.name === u.name)[0]; return !p || p.cred !== u.cred || p.fields !== u.fields; });
          const recovery = credChanged.length === 1 && changed.indexOf("baomat") >= 0 && credChanged[0].vaiTro === "admin" && !gone.length;
          if (gone.length || (credChanged.length && !recovery) || (t === "baomat" && !recovery)) return deny("chưa đăng nhập — không được sửa tài khoản");
        }
        continue;
      }
      if (t === "auditlog") {
        const aud = Array.isArray(next.auditlog) ? next.auditlog : [];
        const keep = aud.length >= prev.audLen ? h(aud.slice(0, prev.audLen)) === prev.audAll : prev.audLen > AUDIT_TRIM_FLOOR;
        if (!keep) return deny("nhật ký thao tác chỉ được thêm, không được sửa/xóa");
        continue;
      }
      if (t === "kyluong") {
        const nextKy = {}; (Array.isArray(next.kyluong) ? next.kyluong : []).forEach((k) => { nextKy[kyKey(k)] = h(k); });
        const added = Object.keys(nextKy).filter((k) => !(k in prev.ky)), removed = Object.keys(prev.ky).filter((k) => !(k in nextKy));
        const modified = Object.keys(nextKy).filter((k) => k in prev.ky && prev.ky[k] !== nextKy[k]);
        if (modified.length) return deny("bản chốt kỳ " + modified.join(", ") + " là bất biến, không được sửa");
        if (added.length && !has("payroll.close")) return deny("không có quyền chốt kỳ lương");
        if (removed.length && !has("payroll.reopen")) return deny("không có quyền mở chốt kỳ lương");
        if (added.length && gate) {
          for (const key of added) {
            const snap = (next.kyluong || []).filter((k) => kyKey(k) === key)[0] || {};
            let bl; try { bl = gate.blockers(JSON.parse(text), snap.ky, { quyChe: snap.quyChe || "2026", bu: snap.buTheoNgay }); } catch (e) { return deny("không kiểm tra lại được kỳ " + snap.ky + ": " + (e && e.message || e)); }
            if (bl.length) return deny("kỳ " + snap.ky + " còn lỗi chặn chốt: " + bl.map((b) => b.code + " ×" + b.count).join(", "));
          }
        }
        continue;
      }
      if (t === "nguoidung") {
        if (has("system.admin")) continue;
        // người thường chỉ được đổi mật khẩu CỦA CHÍNH MÌNH
        const me = String(who.user || "").toLowerCase(), diff = nx.users.filter((u) => { const p = prev.users.filter((x) => x.name === u.name)[0]; return !p || p.h !== u.h; });
        const gone = prev.users.filter((p) => !nx.users.some((u) => u.name === p.name));
        const ok = !gone.length && diff.length === 1 && diff[0].name === me && prev.users.some((p) => p.name === me && p.fields === diff[0].fields && p.vaiTro === diff[0].vaiTro && p.khoa === diff[0].khoa);
        if (!ok) return deny("chỉ Quản trị mới được sửa tài khoản người dùng");
        continue;
      }
      const need = permsFor(t);
      if (!need.some(has)) return deny("vai trò hiện tại không có quyền sửa bảng '" + t + "' (cần " + need.join(" hoặc ") + ")");
    }
    return { ok: true };
  }
  /** Gọi sau khi storage.save thành công */
  function commit() { if (pending) { st = Object.assign({ sig: sigOf() }, pending); } pending = null; }
  function reset() { st = null; pending = null; }
  return { check, commit, reset, permsFor };
}
function fileSig(file) { return () => { try { const s = fs.statSync(file); return s.mtimeMs + ":" + s.size; } catch (e) { return ""; } }; }
module.exports = { createPolicy, permsFor, fileSig };
