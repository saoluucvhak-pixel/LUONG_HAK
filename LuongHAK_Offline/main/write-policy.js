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
  if (t === "ttluong") return ["payment.record"];
  if (t === "kyluong") return ["payroll.close", "payroll.reopen"];
  if (t === "kyluong_lichsu") return ["payroll.reopen"];
  if (t === "nghiepvu_nhansu") return ["hr.edit", "hr.approve"];
  if (t === "nhansu") return ["hr.edit", "payroll.calc", "payroll.close"];
  return ["hr.edit"];
}
const h = (v) => crypto.createHash("sha1").update(JSON.stringify(v === undefined ? null : v)).digest("hex");
const canon = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
const kyKey = (k) => String(k && k.ky) + "|" + (k && k.version || 1);


// ---- V10.1: máy trạng thái nghiệp vụ nhân sự & chứng từ thanh toán — MAIN không tin trạng thái/người duyệt do renderer tự khai ----
const NV_OK_NEW = { "Nháp": 1, "Chờ duyệt": 1 };
const key1 = (r) => String(r && r["Mã phiếu"] || "");
// danh tính: "tên đăng nhập" hoặc "Họ tên [tên đăng nhập] (máy)" (định dạng currentUser() của giao diện)
const isMe = (v, me) => { const t = String(v == null ? "" : v).trim().toLowerCase(), m = String(me || "").trim().toLowerCase(); return !!m && (t === m || t.indexOf("[" + m + "]") >= 0); };
const strip = (r, ks) => { const o = Object.assign({}, r); ks.forEach((k) => delete o[k]); return o; };
const NV_STATE_FIELDS = ["Trạng thái", "Người duyệt", "Ngày duyệt", "Lý do từ chối", "Đã ghi vào hồ sơ"];
/** Đề nghị nghiệp vụ nhân sự: Nháp → Chờ duyệt → Đã duyệt | Từ chối. Trả "" nếu hợp lệ, ngược lại lý do từ chối. */
function checkNghiepVuNS(prevObj, next, who) {
  const has = (p) => (who && who.perms || []).indexOf(p) >= 0, me = who && who.user || "";
  const pr = Array.isArray(prevObj && prevObj.nghiepvu_nhansu) ? prevObj.nghiepvu_nhansu : [], nx = Array.isArray(next.nghiepvu_nhansu) ? next.nghiepvu_nhansu : [];
  const prBy = {}; pr.forEach((r) => { prBy[key1(r)] = r; });
  const nxBy = {}; for (const r of nx) { const k = key1(r); if (!k) return "đề nghị nhân sự thiếu Mã phiếu"; if (nxBy[k]) return "trùng Mã phiếu " + k; nxBy[k] = r; }
  for (const k of Object.keys(prBy)) { // xóa phiếu: chỉ phiếu Nháp
    if (!nxBy[k] && prBy[k]["Trạng thái"] !== "Nháp") return "không được xóa phiếu " + k + " đã gửi duyệt/đã duyệt";
  }
  for (const k of Object.keys(nxBy)) {
    const a = prBy[k], b = nxBy[k], to = b["Trạng thái"];
    if (!a) { // phiếu mới
      if (!has("hr.edit")) return "không có quyền lập đề nghị nhân sự";
      if (!NV_OK_NEW[to]) return "phiếu mới " + k + " chỉ được ở trạng thái Nháp/Chờ duyệt, không được tự đặt '" + to + "'";
      if (b["Người duyệt"] || b["Ngày duyệt"] || b["Đã ghi vào hồ sơ"]) return "phiếu mới " + k + " không được có thông tin duyệt";
      if (!me || !isMe(b["Người đề nghị"], me)) return "Người đề nghị của " + k + " phải là người đang đăng nhập";
      continue;
    }
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    const from = a["Trạng thái"];
    if (from === "Đã duyệt") return "phiếu " + k + " đã duyệt — không được sửa (cần nghiệp vụ điều chỉnh)";
    if (from === "Từ chối" && to !== "Nháp") return "phiếu " + k + " đã bị từ chối — chỉ được đưa về Nháp để sửa";
    const contentSame = JSON.stringify(strip(a, NV_STATE_FIELDS)) === JSON.stringify(strip(b, NV_STATE_FIELDS));
    if (to === "Đã duyệt" || to === "Từ chối") {
      if (from !== "Chờ duyệt") return "chỉ duyệt/từ chối được phiếu " + k + " đang 'Chờ duyệt'";
      if (!has("hr.approve")) return "không có quyền duyệt nghiệp vụ nhân sự";
      if (!contentSame) return "không được sửa nội dung phiếu " + k + " trong lúc duyệt";
      if (!isMe(b["Người duyệt"], me)) return "Người duyệt của " + k + " phải là người đang đăng nhập";
      if (isMe(a["Người đề nghị"], me) && !has("system.admin")) return "người đề nghị không được tự duyệt phiếu " + k;
      if (to === "Từ chối" && !String(b["Lý do từ chối"] || "").trim()) return "từ chối phiếu " + k + " phải ghi lý do";
      if (to === "Đã duyệt") { // ghi hồ sơ phải nằm CÙNG lần lưu (nguyên tử): nghỉ việc = chấm dứt HĐLĐ + nhân viên Đã nghỉ việc
        if (!String(b["Đã ghi vào hồ sơ"] || "").trim()) return "phiếu " + k + " duyệt nhưng chưa ghi vào hồ sơ";
        if (b["Loại nghiệp vụ"] === "Nghỉ việc") {
          const nv = (next.nhanvien || []).filter((x) => x["Mã NV"] === b["Mã NV"])[0];
          const hd = (next.hopdong || []).filter((x) => x["Mã NV"] === b["Mã NV"] && String(x["Ngày chấm dứt"] || "").slice(0, 10) === String(b["Từ ngày"] || "").slice(0, 10))[0];
          if (!nv || nv["Trạng thái"] !== "Đã nghỉ việc" || !hd) return "duyệt nghỉ việc " + k + " phải đồng thời chấm dứt hợp đồng và chuyển nhân viên sang 'Đã nghỉ việc' (ghi nguyên tử)";
        }
      }
      continue;
    }
    // các bước còn lại do người lập: Nháp ↔ Chờ duyệt, sửa nội dung khi Nháp
    if (from === "Chờ duyệt" && to === "Nháp") { if (!(has("hr.approve") || has("hr.edit"))) return "không có quyền trả phiếu về Nháp"; continue; }
    if (!has("hr.edit")) return "không có quyền sửa đề nghị nhân sự";
    if (to === "Chờ duyệt" && from !== "Nháp") return "chỉ gửi duyệt phiếu đang Nháp";
    if (b["Người duyệt"] !== a["Người duyệt"] || b["Ngày duyệt"] !== a["Ngày duyệt"] || b["Đã ghi vào hồ sơ"] !== a["Đã ghi vào hồ sơ"]) return "không được tự ghi thông tin duyệt vào phiếu " + k;
    if (from === "Chờ duyệt" && !contentSame) return "phiếu " + k + " đang chờ duyệt — không sửa nội dung";
  }
  return "";
}
const TT = { LAP: "Đã lập", DUYET: "Đã duyệt", TRA: "Đã thanh toán", HUY: "Đã hủy" };
const lineKey = (l) => String(l && l["Số chứng từ"] || "") + "|" + String(l && l["Mã NV"] || "");
const LINE_STATE = ["Trạng thái", "Ngày duyệt", "Người duyệt", "Ngày thanh toán", "Người ghi nhận", "Lý do hủy"];
/** Sổ chứng từ thanh toán: Đã lập → Đã duyệt → Đã thanh toán; Hủy trước khi thanh toán. */
function checkTtluong(prevObj, next, who) {
  const me = who && who.user || "";
  const pr = Array.isArray(prevObj && prevObj.ttluong) ? prevObj.ttluong : [], nx = Array.isArray(next.ttluong) ? next.ttluong : [];
  const prBy = {}; pr.forEach((l) => { prBy[lineKey(l)] = l; });
  const nxBy = {}; for (const l of nx) { const k = lineKey(l); if (nxBy[k]) return "chứng từ " + l["Số chứng từ"] + ": " + l["Mã NV"] + " xuất hiện 2 lần"; nxBy[k] = l; }
  for (const k of Object.keys(prBy)) if (!nxBy[k]) return "không được xóa dòng chứng từ đã lập (" + k + ") — hãy hủy có lý do";
  const kyBanks = {}; // kỳ → { maNV: thực lĩnh } từ bản chốt trong dữ liệu mới
  (Array.isArray(next.kyluong) ? next.kyluong : []).forEach((k) => { const m = {}; ((k.kq && k.kq.bangluong) || []).forEach((r) => { if (!(r["Mã NV"] in m)) m[r["Mã NV"]] = +r["Thực lĩnh"] || 0; }); kyBanks[k.ky] = m; });
  const soExisting = {}; pr.forEach((l) => { soExisting[l["Số chứng từ"]] = 1; });
  const newSo = {};
  for (const k of Object.keys(nxBy)) {
    const a = prBy[k], b = nxBy[k];
    if (!a) {
      if (b["Trạng thái"] !== TT.LAP) return "dòng chứng từ mới " + k + " chỉ được ở trạng thái '" + TT.LAP + "'";
      if (soExisting[b["Số chứng từ"]]) return "số chứng từ " + b["Số chứng từ"] + " đã tồn tại — không thêm người vào chứng từ cũ";
      if (!me || !isMe(b["Người lập"], me)) return "Người lập của chứng từ " + b["Số chứng từ"] + " phải là người đang đăng nhập";
      if (b["Ngày duyệt"] || b["Người duyệt"] || b["Ngày thanh toán"] || b["Người ghi nhận"]) return "chứng từ mới không được có thông tin duyệt/thanh toán";
      if (!(+b["Số tiền"] > 0)) return "số tiền chứng từ " + k + " phải dương";
      if (b["Hình thức"] !== "Chuyển khoản" && b["Hình thức"] !== "Tiền mặt") return "hình thức thanh toán của " + k + " không hợp lệ";
      if (!kyBanks[b["Kỳ"]]) return "kỳ " + b["Kỳ"] + " chưa chốt — không lập chứng từ chính thức";
      newSo[b["Số chứng từ"]] = 1;
      continue;
    }
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    const from = a["Trạng thái"], to = b["Trạng thái"];
    if (from === TT.TRA) return "chứng từ " + k + " đã thanh toán — không được sửa";
    if (from === TT.HUY) return "chứng từ " + k + " đã hủy — không được sửa";
    if (JSON.stringify(strip(a, LINE_STATE)) !== JSON.stringify(strip(b, LINE_STATE))) return "không được sửa số tiền/nội dung chứng từ " + k + " — hủy và lập lại";
    if (to === TT.DUYET) {
      if (from !== TT.LAP) return "chỉ duyệt chứng từ 'Đã lập' (" + k + ")";
      if (!isMe(b["Người duyệt"], me)) return "Người duyệt của " + k + " phải là người đang đăng nhập";
      if (isMe(a["Người lập"], me) && !(who.perms || []).includes("system.admin")) return "người duyệt phải khác người lập (" + k + ")";
    } else if (to === TT.TRA) {
      if (from !== TT.DUYET) return "phải duyệt chứng từ " + k + " trước khi ghi nhận thanh toán";
      if (!isMe(b["Người ghi nhận"], me)) return "Người ghi nhận của " + k + " phải là người đang đăng nhập";
    } else if (to === TT.HUY) {
      if (!String(b["Lý do hủy"] || "").trim()) return "hủy chứng từ " + k + " phải ghi lý do";
    } else return "chuyển trạng thái chứng từ " + k + " không hợp lệ (" + from + " → " + to + ")";
  }
  // không vượt nghĩa vụ phải trả: tổng dòng chưa hủy của (kỳ, NV) ≤ thực lĩnh của bản chốt
  const sum = {};
  nx.forEach((l) => { if (l["Trạng thái"] === TT.HUY) return; const kk = l["Kỳ"] + "|" + l["Mã NV"]; sum[kk] = (sum[kk] || 0) + (+l["Số tiền"] || 0); });
  for (const kk of Object.keys(sum)) {
    const p = kk.split("|"), tl = kyBanks[p[0]] && kyBanks[p[0]][p[1]];
    if (tl == null) return "chứng từ của " + p[1] + " kỳ " + p[0] + " không có trong bảng lương đã chốt";
    if (sum[kk] > tl + 0.5) return "tổng chứng từ của " + p[1] + " kỳ " + p[0] + " (" + sum[kk] + ") vượt thực lĩnh (" + tl + ")";
  }
  return "";
}

function createPolicy(opts) {
  const readText = opts.readText;           // () → string|null: nội dung file dữ liệu trên đĩa
  const sigOf = opts.sigOf || (() => "");   // () → "mtime:size" của file dữ liệu
  const gate = opts.gate || null;           // { blockers(db, ky, o) }
  let st = null, pending = null;

  /** Số dòng danh mục giảm đi → các dòng bị mất mà mã (cột bắt đầu bằng "Mã") còn xuất hiện trong bản chốt kỳ lương thì không được xóa. */
  function dmRemoval(t, next) {
    let prevObj = null; try { prevObj = JSON.parse(readText() || "null"); } catch (e) { prevObj = null; }
    if (!prevObj) return "";
    const pr = Array.isArray(prevObj[t]) ? prevObj[t] : [], nx = Array.isArray(next[t]) ? next[t] : [];
    if (nx.length >= pr.length) return "";
    const left = {}; nx.forEach((r) => { const k = h(r); left[k] = (left[k] || 0) + 1; });
    const removed = pr.filter((r) => { const k = h(r); if (left[k]) { left[k]--; return false; } return true; });
    const js = JSON.stringify(prevObj.kyluong || []);
    for (const r of removed) {
      for (const c of Object.keys(r)) {
        const v = r[c];
        if (/^Mã/.test(c) && typeof v === "string" && v.trim().length >= 2 && js.indexOf(JSON.stringify(v.trim())) >= 0) return "danh mục " + t + ": mã '" + v.trim() + "' đã dùng trong kỳ lương đã chốt — không được xóa, chỉ được Ngừng hiệu lực";
      }
    }
    return "";
  }
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
          // V10.1: hình dạng giống khôi phục là CHƯA ĐỦ — main phải đã xác minh mã khôi phục (opts.recovery do ipc-guard cấp, đúng tài khoản, còn hạn)
          const rc = opts && opts.recovery && opts.recovery.user ? String(opts.recovery.user).toLowerCase() : "";
          const recovery = !!rc && credChanged.length === 1 && changed.indexOf("baomat") >= 0 && credChanged[0].vaiTro === "admin" && credChanged[0].name === rc && !gone.length;
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
            if (gate.verifySnapshot) { let vs; try { vs = gate.verifySnapshot(JSON.parse(text), snap); } catch (e) { return deny("không xác minh được bản chốt kỳ " + snap.ky + ": " + (e && e.message || e)); } if (vs.length) return deny("bản chốt kỳ " + snap.ky + " không khớp tính lại tại tiến trình chính: " + vs.join("; ")); }
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
      if (/^dm_/.test(t)) { // xóa dòng danh mục có mã đang nằm trong bản chốt kỳ lương → từ chối (chỉ được Ngừng hiệu lực)
        const why = dmRemoval(t, next); if (why) return deny(why);
      }
      if (t === "ttluong") { // dòng chứng từ đã thanh toán là bất biến (chỉ được thêm chứng từ mới / chuyển trạng thái chưa thanh toán)
        let pv = null; try { pv = JSON.parse(readText() || "null"); } catch (e) { pv = null; }
        const pr = pv && Array.isArray(pv.ttluong) ? pv.ttluong : [], nxl = Array.isArray(next.ttluong) ? next.ttluong : [];
        const have = {}; nxl.forEach((r) => { const k = h(r); have[k] = (have[k] || 0) + 1; });
        const lost = pr.filter((r) => r && r["Trạng thái"] === "Đã thanh toán").filter((r) => { const k = h(r); if (have[k]) { have[k]--; return false; } return true; });
        if (lost.length) return deny("chứng từ đã thanh toán là bất biến (" + lost.length + " dòng bị sửa/xóa)");
      }
      if (t === "nghiepvu_nhansu" || t === "ttluong") {
        let pv0 = null; try { pv0 = JSON.parse(readText() || "null"); } catch (e) { pv0 = null; }
        const why = t === "ttluong" ? checkTtluong(pv0, next, who) : checkNghiepVuNS(pv0, next, who);
        if (why) return deny(why);
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
module.exports = { createPolicy, permsFor, fileSig, checkNghiepVuNS, checkTtluong };
