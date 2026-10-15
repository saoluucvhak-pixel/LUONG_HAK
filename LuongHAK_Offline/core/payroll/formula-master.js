// ===== V10.2/V10.3 — QUẢN LÝ CÔNG THỨC THEO MASTER–DETAIL DÙNG CHUNG: TĂNG CA · PHỤ CẤP · HỖ TRỢ (logic thuần: không DOM, không ghi dữ liệu) =====
// Cha  = DM_TANGCA / DM_PHUCAP / DM_HOTRO (khóa ổn định = mã; nhiều dòng cùng mã là các phiên bản hiệu lực của chính mã đó).
// Con  = DM_CONGTHUC theo "Loại" (OVERTIME / ALLOWANCE / SUPPORT), nối với cha qua cột liên kết riêng của loại (formula-approval.PARENT).
// ENGINE KHÔNG đổi cách tra: engine tra công thức theo "Mã công thức" = KHÓA CÔNG THỨC của dòng cha:
//   • Tăng ca : "Loại công thức" || Mã tăng ca (có công thức mặc định TC1–TC6 trong formula-defaults.js)
//   • Phụ cấp : "Loại công thức" (chỉ khi KHÁC CO_DINH/TYLE_*; và chỉ khi công chuẩn > 0). Để trống = cách tính lịch sử.
//   • Hỗ trợ  : "Loại công thức" (chỉ khi KHÁC HT_THIEU_CHUAN/HT_THEO_NGAY). Để trống = HT_THIEU_CHUAN (Mã hỗ trợ 2) / HT_THEO_NGAY (Mã hỗ trợ).
// Cột liên kết cha là liên kết hiển thị/kiểm soát, được kiểm khớp với khóa công thức (formula-approval.linkProblem) — không đổi cách engine tính.
(function (root) {
  "use strict";
  var isNode = typeof module !== "undefined" && module.exports;
  var FML = isNode ? require("./formula-engine.js") : root.HAKCore.formula;
  var FAP = isNode ? require("./formula-approval.js") : root.HAKCore.formulaApproval;
  var V = isNode ? require("../validate.js") : root.HAKCore.validate;

  var STAMP_LINK = "Liên kết lúc", TEST_TABLE = "dm_congthuc_kiemthu";

  function t(v) { return String(v == null ? "" : v).trim(); }
  /** Hiển thị số theo kiểu Việt Nam: chấm phân cách hàng nghìn, phẩy thập phân; rỗng/không phải số → "—". Chỉ để HIỂN THỊ, không đổi dữ liệu. */
  function vn(v, blankZero) {
    var x = String(v == null ? "" : v).trim(); if (x === "") return "—";
    var n = +x.replace(/\s/g, "").replace(/,/g, "."); if (!isFinite(n)) return x;
    if (blankZero && n === 0) return "—";
    var neg = n < 0, p = String(Math.abs(Math.round(n * 10000) / 10000)).split("."), ip = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (neg ? "-" : "") + ip + (p[1] ? "," + p[1] : "");
  }
  function require_dn(s) { var k = String(s || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); return k ? (+k[1]) * 10000 + (+k[2]) * 100 + (+k[3]) : null; }

  // ---------- Cấu hình từng loại ----------
  var OT_VARS = ["CONG_TINH_LUONG", "CONG_CHUAN", "CONG_CHUAN_2", "CONG_TC", "CONG_CHU_NHAT", "CONG_LE", "CONG_PHEP", "CONG_TRUNG_CHUYEN", "CONG_DI_CHUYEN", "HE_SO_TC"];
  var KINDS = {
    OVERTIME: {
      type: "OVERTIME", table: "dm_tangca", code: "Mã tăng ca", name: "Tên (nội dung) tăng ca", nameCol: "Nội dung tăng ca", noun: "mã tăng ca", title: "Danh mục tăng ca", short: "Tăng ca",
      link: "Mã tăng ca cha", builtin: null, vars: OT_VARS, moneyResult: false,
      fields: [
        { key: "heSo", col: "Hệ số tăng ca", label: "Hệ số tăng ca", type: "pct", note: "Đọc từ danh mục — hệ thống không tự đặt hệ số mặc định" },
        { key: "tien", col: "Tiền tăng ca (nếu tính cố định)", label: "Tiền tăng ca cố định (nếu có)", type: "money" }
      ],
      listCols: [{ label: "Hệ số", get: function (b) { return b["Hệ số tăng ca"] == null || b["Hệ số tăng ca"] === "" ? "(trống)" : vn(b["Hệ số tăng ca"]); }, num: true }],
      sample: { CONG_TINH_LUONG: 28, CONG_CHUAN: 26, CONG_CHUAN_2: 40, CONG_TC: 2, CONG_CHU_NHAT: 3, CONG_LE: 1, CONG_PHEP: 1, CONG_TRUNG_CHUYEN: 1, CONG_DI_CHUYEN: 1, HE_SO_TC: 1.5 },
      zeroKeep: {}
    },
    ALLOWANCE: {
      type: "ALLOWANCE", table: "dm_phucap", code: "Mã phụ cấp", name: "Tên phụ cấp", nameCol: "Tên phụ cấp", noun: "mã phụ cấp", title: "Danh mục phụ cấp", short: "Phụ cấp",
      link: "Mã phụ cấp cha", vars: FAP.SCOPE.ALLOWANCE, moneyResult: true,
      builtin: {
        CO_DINH: "Cố định — trả đủ số tiền (hoặc tỷ lệ × lương thỏa thuận) hằng tháng, không tính theo công",
        TYLE_TRU_LE_PHEP: "Theo tỷ lệ công, trừ công lễ + phép khi dưới ngưỡng (đối chiếu M thật HAK_DN)",
        TYLE_TRU_PHEP_TANGCA: "Theo tỷ lệ công, trừ công phép + tăng ca khi dưới ngưỡng (quy chế 2026/C6)",
        TYLE_KHONG_TRU: "Theo tỷ lệ công, không trừ gì khi dưới ngưỡng"
      },
      fallbackLabel: "Cách tính lịch sử của engine (theo nội dung 'Cách tính': cố định / tỷ lệ theo công)",
      fields: [
        { key: "tien", col: "Số tiền", label: "Số tiền phụ cấp", type: "money" },
        { key: "tyLe", col: "Tỷ lệ", label: "Tỷ lệ (× lương thỏa thuận, chỉ khi cố định không có số tiền)", type: "pct" },
        { key: "thamChieu", col: "Tham chiếu", label: "Tham chiếu / ngưỡng công", type: "num", note: "Ngưỡng: đủ (công chuẩn − tham chiếu) công thì hưởng đủ, chưa đủ thì chia theo tỷ lệ công" }
      ],
      listCols: [
        { label: "Số tiền (đ)", get: function (b) { return vn(b["Số tiền"]); }, num: true },
        { label: "Tỷ lệ", tip: "Hệ số nhân với lương thỏa thuận — chỉ dùng khi phụ cấp là CỐ ĐỊNH và không nhập số tiền. “—” = không dùng.", get: function (b) { return vn(b["Tỷ lệ"], true); }, num: true },
        { label: "Ngưỡng công", tip: "Số công được phép thiếu so với công chuẩn mà vẫn hưởng ĐỦ phụ cấp. Thiếu nhiều hơn thì chia theo tỷ lệ công. “—” = không có ngưỡng.", get: function (b) { var x = vn(b["Tham chiếu"], true); return x === "—" ? x : x + " công"; }, num: true }
      ],
      sample: { MUC_PHU_CAP: 1000000, CONG_CHUAN: 26, CONG_HUONG_PHU_CAP: 24, NGUONG_PHU_CAP: 2, CONG_TINH_LUONG: 24, CONG_LE: 1, CONG_PHEP: 1, CONG_TC: 2 },
      zeroKeep: { CONG_CHUAN: 26 } // engine chỉ tính theo công thức khi công chuẩn > 0
    },
    SUPPORT: {
      type: "SUPPORT", table: "dm_hotro", code: "Mã hỗ trợ", name: "Tên hỗ trợ", nameCol: "Tên hỗ trợ", noun: "mã hỗ trợ", title: "Danh mục hỗ trợ", short: "Hỗ trợ",
      link: "Mã hỗ trợ cha", vars: FAP.SCOPE.SUPPORT, moneyResult: true,
      builtin: {
        HT_THEO_NGAY: "Theo ngày — số ngày (tiền cơm) × số tiền",
        HT_THIEU_CHUAN: "Bù thiếu công chuẩn — (công chuẩn − công thực tế) × số tiền, chỉ khi công thực tế ≤ công chuẩn"
      },
      fallbackLabel: "HT_THEO_NGAY (Mã hỗ trợ — tiền cơm) hoặc HT_THIEU_CHUAN (Mã hỗ trợ 2 — hỗ trợ lương) theo vị trí gán",
      fields: [{ key: "tien", col: "Số tiền", label: "Số tiền hỗ trợ", type: "money" }],
      listCols: [{ label: "Số tiền (đ)", get: function (b) { return vn(b["Số tiền"]); }, num: true }],
      sample: { MUC_HO_TRO: 20000, CONG_CHUAN: 26, CONG_THUC_TE: 24, SO_NGAY_COM: 22, SO_NGAY_DUOC_HUONG: 22 },
      zeroKeep: {}
    }
  };

  function make(type) {
    var K = KINDS[type]; if (!K) throw new Error("Loại công thức không hỗ trợ: " + type);
    var LINK = K.link, TYPE = type, CODE = K.code;

    /** Khóa công thức mà ENGINE dùng cho 1 dòng cha. */
    function formulaKey(row) { return FAP.keyOfParent(type, row); }
    function isBuiltin(key) { return !!(K.builtin && Object.prototype.hasOwnProperty.call(K.builtin, key)); }

    function parentCodes(db) {
      var seen = {}, out = [];
      (db[K.table] || []).forEach(function (r) { var c = t(r[CODE]); if (c && !seen[c]) { seen[c] = 1; out.push(c); } });
      return out;
    }
    function parentRows(db, ma) {
      return (db[K.table] || []).filter(function (r) { return t(r[CODE]) === ma; })
        .sort(function (a, b) { return String(b["Hiệu lực từ"] || "") < String(a["Hiệu lực từ"] || "") ? -1 : 1; });
    }
    function effectiveRow(rows, nam, thang) {
      var dau = nam * 10000 + thang * 100 + 1, cuoi = nam * 10000 + thang * 100 + 31, best = null;
      (rows || []).forEach(function (r) {
        var tu = require_dn(r["Hiệu lực từ"]), den = require_dn(r["Hiệu lực đến"]);
        if (tu != null && tu > cuoi) return;
        if (den != null && den < dau) return;
        if (!best || (tu || 0) >= (require_dn(best["Hiệu lực từ"]) || 0)) best = r;
      });
      return best;
    }
    function ownersByKey(db) {
      var map = {};
      parentCodes(db).forEach(function (ma) {
        var ks = {}; parentRows(db, ma).forEach(function (r) { var k = formulaKey(r); if (k) ks[k] = 1; });
        Object.keys(ks).forEach(function (k) { (map[k] = map[k] || []).push(ma); });
      });
      return map;
    }

    /**
     * Cha của 1 công thức loại này. status: ok | orphan | ambiguous | invalid | othertype
     * "derived" chỉ khi suy ra DUY NHẤT: đúng 1 mã dùng khóa, hoặc nhiều mã dùng chung nhưng đúng 1 mã mang tên trùng khóa.
     */
    function parentOf(db, rec, owners) {
      if (t(rec["Loại"]) !== TYPE) return { ma: "", via: "", status: "othertype", candidates: [] };
      var exp = t(rec[LINK]);
      if (exp) {
        var pr = FAP.linkProblem(db, rec);
        return { ma: exp, via: "explicit", status: pr ? "invalid" : "ok", candidates: [exp], problem: pr };
      }
      owners = owners || ownersByKey(db);
      var key = t(rec["Mã công thức"]), c = owners[key] || [];
      if (c.length === 1) return { ma: c[0], via: "derived", status: "ok", candidates: c };
      if (c.length > 1) {
        if (c.indexOf(key) >= 0) return { ma: key, via: "derived", status: "ok", candidates: c };
        return { ma: "", via: "", status: "ambiguous", candidates: c };
      }
      return { ma: "", via: "", status: "orphan", candidates: [] };
    }
    function formulasOf(db, ma) {
      var owners = ownersByKey(db);
      return (db.dm_congthuc || []).filter(function (r) { var p = parentOf(db, r, owners); return p.ma === ma && p.status === "ok"; })
        .sort(function (a, b) { return (+b["Phiên bản"] || 1) - (+a["Phiên bản"] || 1) || (String(b["Hiệu lực từ"] || "") < String(a["Hiệu lực từ"] || "") ? -1 : 1); });
    }
    /** Mọi phiên bản của KHÓA công thức mà mã này đang dùng (đúng như engine tra) — dùng cho tab Công thức/Lịch sử. */
    function versionsForTab(db, ma) {
      var key = sharedWith(db, ma).key, own = formulasOf(db, ma);
      if (!key) return own;
      var keyRecs = (db.dm_congthuc || []).filter(function (r) { return t(r["Loại"]) === TYPE && t(r["Mã công thức"]) === key; });
      var seen = {}; var out = [];
      keyRecs.concat(own).forEach(function (r) { var id = r._id || r; if (!seen[id]) { seen[id] = 1; out.push(r); } });
      return out.sort(function (a, b) { return (+b["Phiên bản"] || 1) - (+a["Phiên bản"] || 1) || (String(b["Hiệu lực từ"] || "") < String(a["Hiệu lực từ"] || "") ? -1 : 1); });
    }
    function sharedWith(db, ma) {
      var rows = parentRows(db, ma), o = ownersByKey(db), out = { key: "", ownerMa: "", others: [] };
      var key = rows.length ? formulaKey(rows[0]) : (K.builtin === null || K.type === "OVERTIME" ? ma : ""); out.key = key;
      var c = key ? (o[key] || []) : [];
      out.others = c.filter(function (x) { return x !== ma; });
      if (type === "OVERTIME") {
        out.ownerMa = key !== ma && c.indexOf(key) >= 0 ? key : (key !== ma && c.length ? c[0] : "");
        out.dungChungCongThucCuaMaKhac = key !== ma;
      } else {
        out.ownerMa = c.indexOf(key) >= 0 && key !== ma ? key : (out.others.length ? out.others[0] : "");
        out.dungChungCongThucCuaMaKhac = !!key && out.others.length > 0;
      }
      return out;
    }

    /** Công thức đang áp dụng cho 1 mã trong kỳ (đúng đường tra của engine). nguon: cauhinh | macdinh | lichsu | none | loi */
    function applied(db, ma, nam, thang) {
      var rows = parentRows(db, ma), eff = effectiveRow(rows, nam, thang), key = eff ? formulaKey(eff) : (type === "OVERTIME" ? ma : "");
      var tenCty = db.congty && db.congty[0] ? [db.congty[0]["Mã công ty"], db.congty[0]["Tên công ty"]].filter(function (x) { return t(x) !== ""; }) : [];
      if (type !== "OVERTIME") {
        if (!key) return { rec: null, nguon: "lichsu", bieuThuc: "", key: "", ten: K.fallbackLabel };
        if (isBuiltin(key)) return { rec: null, nguon: "macdinh", bieuThuc: "", key: key, ten: K.builtin[key] };
      }
      var r = FML.resolveEx(db.dm_congthuc || [], { code: key, type: TYPE, companyId: tenCty, nam: nam, thang: thang });
      if (r.status === "OK" && r.rec) return { rec: r.rec, nguon: "cauhinh", bieuThuc: r.rec["Biểu thức"] || "", key: key };
      if (r.status === "CONFLICT") return { rec: null, nguon: "loi", bieuThuc: "", key: key, ghiChu: "Xung đột nhiều bản Hiệu lực" };
      if (type === "OVERTIME") {
        var d = FML.defaults.overtime(key);
        if (d) return { rec: null, nguon: "macdinh", bieuThuc: d.bieuThuc, key: key, ten: d.ten };
        return { rec: null, nguon: "none", bieuThuc: "", key: key };
      }
      return { rec: null, nguon: "none", bieuThuc: "", key: key, ten: "Chưa có công thức cấu hình hiệu lực cho khóa '" + key + "' — engine dùng " + K.fallbackLabel };
    }

    function summary(db, ma, nam, thang) {
      var rows = parentRows(db, ma), eff = effectiveRow(rows, nam, thang), latest = rows[0] || {};
      var base = eff || latest, ap = applied(db, ma, nam, thang), fs = versionsForTab(db, ma);
      var trangThai = eff ? "Đang hiệu lực" : (rows.some(function (r) { var tu = require_dn(r["Hiệu lực từ"]); return tu != null && tu > nam * 10000 + thang * 100 + 31; }) ? "Chưa hiệu lực" : "Hết hiệu lực");
      var sh = sharedWith(db, ma);
      var apDung = ap.nguon === "cauhinh" ? "v" + (ap.rec["Phiên bản"] || 1) + " · " + (ap.rec["Mã công thức"] || "")
        : ap.nguon === "macdinh" ? (type === "OVERTIME" ? "Mặc định hệ thống (" + ap.key + ")" : "Có sẵn của engine (" + ap.key + ")")
        : ap.nguon === "loi" ? "⚠ Xung đột phiên bản" : ap.nguon === "lichsu" ? "Cách tính lịch sử (chưa khai báo Loại công thức)" : "⚠ Chưa có công thức cho '" + ap.key + "' — dùng cách tính lịch sử";
      return {
        ma: ma, ten: base[K.nameCol] || "", base: base, loaiCongThuc: t(base["Loại công thức"]), khoaCongThuc: ap.key, trangThai: trangThai, tu: base["Hiệu lực từ"] || "", den: base["Hiệu lực đến"] || "",
        apDung: apDung, nguonApDung: ap.nguon, soPhienBan: fs.length, soDong: rows.length, dungChung: sh.dungChungCongThucCuaMaKhac ? sh : null, row: base,
        // tương thích V10.2 (tăng ca)
        heSo: base["Hệ số tăng ca"], tienCoDinh: base["Tiền tăng ca (nếu tính cố định)"]
      };
    }

    // ---------- Liên kết dữ liệu cũ (migration) ----------
    function linkPlan(db) {
      var out = { link: [], already: [], ambiguous: [], orphans: [], invalid: [], others: 0 }, owners = ownersByKey(db);
      (db.dm_congthuc || []).forEach(function (r) {
        var p = parentOf(db, r, owners);
        if (p.status === "othertype") { out.others++; return; }
        if (p.via === "explicit") { if (p.status === "ok") out.already.push(r); else out.invalid.push({ rec: r, problem: p.problem }); return; }
        if (p.status === "ok") out.link.push({ rec: r, ma: p.ma });
        else if (p.status === "ambiguous") out.ambiguous.push({ rec: r, candidates: p.candidates });
        else out.orphans.push(r);
      });
      return out;
    }
    function linkOps(plan, batchId) {
      return plan.link.map(function (x) { var v = {}; v[LINK] = x.ma; v[STAMP_LINK] = batchId; return { rec: x.rec, values: v, ma: x.ma }; });
    }
    function rollbackOps(db, batchId) {
      return (db.dm_congthuc || []).filter(function (r) { return t(r[STAMP_LINK]) === batchId && t(r[LINK]); })
        .map(function (r) { var v = {}; v[LINK] = ""; v[STAMP_LINK] = ""; return { rec: r, values: v }; });
    }
    function batches(db) {
      var m = {}; (db.dm_congthuc || []).forEach(function (r) { var b = t(r[STAMP_LINK]); if (b && t(r[LINK])) m[b] = (m[b] || 0) + 1; });
      return Object.keys(m).sort().map(function (b) { return { id: b, soDong: m[b] }; });
    }
    function integrityDiff(beforeRows, afterRows) {
      var bad = [];
      if (beforeRows.length !== afterRows.length) bad.push("Số dòng đổi " + beforeRows.length + " → " + afterRows.length);
      var byId = {}; afterRows.forEach(function (r) { byId[r._id] = r; });
      beforeRows.forEach(function (b) {
        var a = byId[b._id]; if (!a) { bad.push("Mất dòng " + (b["Mã công thức"] || b._id)); return; }
        var keys = Object.keys(b).concat(Object.keys(a)).filter(function (k, i, arr) { return arr.indexOf(k) === i && FAP.LINKS.indexOf(k) < 0 && k !== STAMP_LINK; });
        keys.forEach(function (k) { if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) bad.push((b["Mã công thức"] || b._id) + ": đổi '" + k + "'"); });
      });
      return bad;
    }

    // ---------- Kiểm tra thông tin mã (tab 1) ----------
    /** f: { ma, ten, tu, den, loaiCT, moTa, + các trường K.fields (key) }  ctx: { editing, pct, isoDate } */
    function validateInfo(db, f, ctx) {
      ctx = ctx || {}; var e = [], w = [], ma = t(f.ma), N = K.noun.charAt(0).toUpperCase() + K.noun.slice(1);
      if (!ma) e.push("Chưa nhập " + N);
      else if (!/^[A-Za-z0-9_.\-]+$/.test(ma)) e.push(N + " chỉ gồm chữ không dấu, số, _ . - (không khoảng trắng)");
      if (!t(f.ten)) e.push("Chưa nhập " + K.name);
      var tu = ctx.isoDate ? ctx.isoDate(f.tu) : t(f.tu), den = ctx.isoDate ? ctx.isoDate(f.den) : t(f.den);
      if (!t(f.tu)) e.push("Chưa nhập Hiệu lực từ"); else if (!tu) e.push("Hiệu lực từ không đúng định dạng ngày (dd/MM/yyyy)");
      if (t(f.den) && !den) e.push("Hiệu lực đến không đúng định dạng ngày (dd/MM/yyyy)");
      if (tu && den && den < tu) e.push("Hiệu lực đến phải sau hoặc bằng Hiệu lực từ");
      var num = function (v) { return +String(v).replace(/[.,\s]/g, ""); };
      if (type === "OVERTIME") {
        if (t(f.heSo) === "") w.push("Hệ số tăng ca đang trống — biến HE_SO_TC sẽ bằng 0 khi tính (hệ thống KHÔNG tự đặt hệ số mặc định)");
        else if (ctx.pct) { var p = ctx.pct(f.heSo); if (!isFinite(p) || p < 0) e.push("Hệ số tăng ca không hợp lệ (nhập số ≥ 0, ví dụ 1.5 hoặc 150%)"); }
        if (t(f.tien) !== "" && !(isFinite(num(f.tien)) && num(f.tien) >= 0)) e.push("Tiền tăng ca cố định phải là số ≥ 0");
      } else {
        K.fields.forEach(function (fd) {
          var v = t(f[fd.key]); if (v === "") return;
          if (fd.type === "pct") { var q = ctx.pct ? ctx.pct(v) : +v; if (!isFinite(q) || q < 0) e.push(fd.label.split(" (")[0] + " không hợp lệ (số ≥ 0, ví dụ 0.1 hoặc 10%)"); }
          else if (!(isFinite(num(v)) && num(v) >= 0)) e.push(fd.label.split(" (")[0] + " phải là số ≥ 0");
        });
        if (t(f.tien) === "") w.push("Số tiền đang trống — engine coi là 0đ" + (type === "ALLOWANCE" ? " (phụ cấp cố định có thể rơi sang 'Tỷ lệ × lương thỏa thuận')" : ""));
      }
      var lk = t(f.loaiCT);
      if (type === "OVERTIME") {
        if (lk && lk !== ma) {
          var known = !!FML.defaults.overtime(lk) || (db.dm_congthuc || []).some(function (r) { return t(r["Mã công thức"]) === lk && t(r["Loại"]) === TYPE; });
          if (!known) w.push("Loại công thức '" + lk + "' chưa có công thức (không thuộc TC1–TC6 và chưa khai báo trong Công thức tiền lương) → khi tính lương sẽ báo FORMULA_ERROR");
        }
      } else if (!lk) {
        w.push("Loại công thức để trống → engine dùng " + K.fallbackLabel + ". Muốn dùng công thức tùy chỉnh: nhập tên công thức (khóa) ở đây rồi tạo công thức cùng tên ở tab Công thức.");
      } else if (isBuiltin(lk)) {
        w.push("'" + lk + "' là cách tính CÓ SẴN của engine — không dùng công thức cấu hình.");
      } else {
        if (!/^[A-Za-z0-9_.\-]+$/.test(lk)) e.push("Loại công thức (khóa) chỉ gồm chữ không dấu, số, _ . -");
        else if (!(db.dm_congthuc || []).some(function (r) { return t(r["Mã công thức"]) === lk && t(r["Loại"]) === TYPE; })) w.push("Chưa có công thức '" + lk + "' (loại " + TYPE + ") — engine sẽ KHÔNG báo lỗi mà dùng " + K.fallbackLabel + ". Hãy tạo & kích hoạt công thức cùng tên.");
      }
      if (ma && tu) {
        parentRows(db, ma).forEach(function (r) {
          if (ctx.editing && r === ctx.editing) return;
          if (FAP.rangesOverlap({ "Hiệu lực từ": r["Hiệu lực từ"], "Hiệu lực đến": r["Hiệu lực đến"] }, { "Hiệu lực từ": tu, "Hiệu lực đến": den })) e.push("Khoảng hiệu lực chồng lên một phiên bản khác của " + K.noun + " này (" + (r["Hiệu lực từ"] || "…") + " → " + (r["Hiệu lực đến"] || "không giới hạn") + ")");
        });
      }
      return { errors: e, warnings: w };
    }
    function usedBy(b, ma) {
      var c = b._ct || {};
      if (type === "OVERTIME") return t(c.maTangCa) === ma;
      if (type === "ALLOWANCE") return t(c.maPhuCap) === ma;
      return t(c.maHoTro) === ma || t(c.maHoTro2) === ma;
    }
    function usage(db, ma, kqNow) {
      var closed = [];
      (db.kyluong || []).forEach(function (k) {
        var n = ((k.kq && k.kq.bangluong) || []).filter(function (b) { return usedBy(b, ma); }).length;
        if (n) closed.push({ ky: k.ky, soNV: n });
      });
      var now = kqNow ? (kqNow.bangluong || []).filter(function (b) { return usedBy(b, ma); }).length : null;
      return { closed: closed.sort(function (a, b) { return a.ky < b.ky ? 1 : -1; }), dangDung: now };
    }

    /**
     * Xóa mã (bảng cha) CHƯA ÁP DỤNG: không nhân viên / hồ sơ nào đang gán mã, chưa từng vào bảng lương kỳ đã chốt,
     * và các công thức con (nếu có) đều chưa áp dụng (Nháp / Chờ duyệt / Đã duyệt) và không dùng chung với mã khác.
     * Công thức con chưa áp dụng được xóa cùng mã. Không xóa gì ở đây — chỉ trả kế hoạch cho UI/repository.
     * @returns { ok, reason, rows (dòng cha), kids (công thức con xóa cùng), used [{bang,n}] }
     */
    function deleteCheck(db, ma) {
      var rows = parentRows(db, ma), out = { ok: false, reason: "", rows: rows, kids: [], used: [] };
      if (!rows.length) { out.reason = "Không tìm thấy " + K.noun + " “" + ma + "”."; return out; }
      var skip = { auditlog: 1, nguoidung: 1, baomat: 1, kyluong: 1, kyluong_lichsu: 1 };
      Object.keys(db).forEach(function (tb) {
        if (skip[tb] || /^dm_/.test(tb) || !Array.isArray(db[tb])) return;
        var n = 0;
        db[tb].forEach(function (r) { for (var k in r) { var v = r[k]; if (typeof v === "string" && v.split(/[,;]+/).some(function (x) { return x.trim() === ma; })) { n++; break; } } });
        if (n) out.used.push({ bang: tb, n: n });
      });
      if (out.used.length) { out.reason = K.noun.charAt(0).toUpperCase() + K.noun.slice(1) + " “" + ma + "” đang được gán ở: " + out.used.map(function (u) { return u.bang + " (" + u.n + ")"; }).join(", ") + ". Gỡ khỏi các hồ sơ đó trước, hoặc dùng “Ngừng sử dụng”."; return out; }
      var us = usage(db, ma, null);
      if (us.closed.length) { out.reason = "Mã “" + ma + "” đã được dùng tính lương kỳ đã chốt (" + us.closed.slice(0, 4).map(function (x) { return x.ky; }).join(", ") + ") — không xóa để giữ khả năng xem lại; dùng “Ngừng sử dụng”."; return out; }
      var kids = formulasOf(db, ma), owners = ownersByKey(db);
      for (var i = 0; i < kids.length; i++) {
        var st = t(kids[i]["Trạng thái"]);
        if (st === "Hiệu lực" || st === "Ngừng") { out.reason = "Công thức " + t(kids[i]["Mã công thức"]) + " v" + (kids[i]["Phiên bản"] || 1) + " đang ở trạng thái “" + st + "” (đã/đang áp dụng) — không xóa để giữ lịch sử; dùng “Ngừng sử dụng”."; return out; }
        var ow = owners[t(kids[i]["Mã công thức"])] || [];
        if (ow.some(function (o) { return o !== ma; })) { out.reason = "Công thức " + t(kids[i]["Mã công thức"]) + " đang dùng chung với mã " + ow.filter(function (o) { return o !== ma; }).join(", ") + " — không xóa."; return out; }
      }
      out.kids = kids; out.ok = true; return out;
    }

    // ---------- Kiểm tra trước khi kích hoạt ----------
    function zeroSet() { var z = {}; Object.keys(K.sample).forEach(function (k) { z[k] = (K.zeroKeep && K.zeroKeep[k] != null) ? K.zeroKeep[k] : 0; }); return z; }
    function preActivation(db, rec, ctx) {
      ctx = ctx || {}; var out = [], expr = t(rec["Biểu thức"]);
      var v = expr ? FML.validate(expr) : { ok: false, errors: [{ message: "Biểu thức để trống" }] };
      out.push({ id: "syntax", ok: v.ok, level: "error", msg: v.ok ? "Cú pháp và biến hợp lệ" : "Biểu thức không hợp lệ: " + v.errors.map(function (x) { return x.message; }).join("; ") });
      if (v.ok && FAP.SCOPE[type]) {
        var sp = FAP.scopeProblem(type, expr);
        out.push({ id: "scope", ok: !sp, level: "error", msg: sp ? sp + " — dùng biến này engine sẽ báo FORMULA_ERROR khi tính lương" : "Chỉ dùng biến mà engine thực sự cấp cho " + K.short.toLowerCase() });
      }
      if (v.ok) {
        var dz = null, bad = null;
        [K.sample, zeroSet()].forEach(function (vars) {
          try { var r = FML.evaluate(expr, vars); if (!isFinite(r)) bad = "kết quả không xác định (NaN/vô hạn)"; } catch (ex) { if (ex.code === "DIV_ZERO") dz = ex.message; else bad = ex.message; }
        });
        out.push({ id: "div0", ok: !dz, level: "error", msg: dz ? "Có nhánh chia cho 0 khi biến bằng 0: " + dz + " — dùng IF để chặn" : "Không chia cho 0 (đã thử bộ biến mẫu và bộ biến bằng 0" + (type === "ALLOWANCE" ? ", công chuẩn giữ > 0 vì engine chỉ tính phụ cấp khi công chuẩn > 0" : "") + ")" });
        out.push({ id: "finite", ok: !bad, level: "error", msg: bad ? "Phát sinh " + bad : "Kết quả luôn xác định" });
      }
      var key = t(rec["Mã công thức"]);
      if (type !== "OVERTIME" && isBuiltin(key)) out.push({ id: "builtin", ok: false, level: "error", msg: "Khóa '" + key + "' là cách tính CÓ SẴN của engine — engine không bao giờ tra công thức cấu hình cho khóa này. Dùng tên khóa khác." });
      var cty = t(rec["Công ty"]);
      var keys = (ctx.companyKeys || []).map(function (x) { return t(x).toLowerCase(); });
      var okC = !cty || keys.indexOf(cty.toLowerCase()) >= 0;
      out.push({ id: "company", ok: okC, level: "error", msg: okC ? (cty ? "Công ty của công thức khớp file dữ liệu" : "Áp dụng mọi công ty (để trống)") : "Công thức ghi cho công ty khác ('" + cty + "') — sẽ không được áp dụng cho file dữ liệu này" });
      var lp = FAP.linkProblem(db, rec);
      if (lp) out.push({ id: "link", ok: false, level: "error", msg: lp });
      else if (t(rec[LINK]) === "") out.push({ id: "link", ok: true, level: "warn", msg: "Chưa gán " + K.noun + " cha cho công thức này (dùng nút Liên kết công thức cũ hoặc sửa nháp)" });
      var owners = ownersByKey(db);
      if (type !== "OVERTIME" && !(owners[key] || []).length) out.push({ id: "bound", ok: true, level: "warn", msg: "Chưa có " + K.noun + " nào khai báo Loại công thức = '" + key + "' — công thức Hiệu lực nhưng engine CHƯA dùng cho ai cho đến khi gán Loại công thức này ở danh mục" });
      var cf = FAP.conflictWith(db, rec);
      var plan = FAP.activationPlan(db, rec);
      if (cf.length) out.push({ id: "conflict", ok: false, level: "error", msg: "Trùng ngày hiệu lực với bản Hiệu lực v" + (cf[0]["Phiên bản"] || 1) });
      else if (plan.blocked.length) out.push({ id: "overlap", ok: false, level: "error", msg: "Chồng hiệu lực với bản Hiệu lực v" + (plan.blocked[0]["Phiên bản"] || 1) + " bắt đầu cùng/sau ngày " + (rec["Hiệu lực từ"] || "…") + " — ngừng bản đó hoặc đổi ngày" });
      else if (plan.close.length) out.push({ id: "overlap", ok: true, level: "warn", msg: "Sẽ đóng ngày bản v" + (plan.close[0].row["Phiên bản"] || 1) + " đang hiệu lực: Hiệu lực đến = " + plan.close[0].den });
      else out.push({ id: "overlap", ok: true, level: "info", msg: "Không chồng khoảng hiệu lực với bản nào" });
      if (!t(rec["Hiệu lực từ"])) out.push({ id: "tu", ok: false, level: "error", msg: "Chưa có Hiệu lực từ" });
      var tuKy = t(rec["Hiệu lực từ"]).slice(0, 7), denKy = t(rec["Hiệu lực đến"]).slice(0, 7);
      var hit = (ctx.closedPeriods || []).filter(function (k) { return tuKy && k >= tuKy && (!denKy || k <= denKy); });
      out.push({ id: "closed", ok: true, level: hit.length ? "warn" : "info", msg: hit.length ? "Khoảng hiệu lực chạm kỳ đã chốt " + hit.join(", ") + " — bản chốt KHÔNG đổi; chỉ áp dụng nếu mở chốt và tính lại (cần quyền hồi tố)" : "Không chạm kỳ đã chốt nào" });
      out.push({ id: "compare", ok: !!ctx.hasCurrent, level: ctx.hasCurrent ? "info" : "warn", msg: ctx.hasCurrent ? "Có cách tính hiện hành để so sánh (tab Kiểm thử thực tế)" : "Chưa có công thức hiện hành để so sánh" });
      return out;
    }

    // ---------- Kiểm thử trên dữ liệu thật ----------
    function coChamCong(db, maNV, ky) {
      return (db.chamcong || []).some(function (r) { return t(r["Mã NV"]) === maNV && V.rowPeriod("chamcong", r) === ky; });
    }
    function employeesOf(kq, ma, key) {
      return ((kq && kq.bangluong) || []).filter(function (b) { return usedBy(b, ma); });
    }
    function f3(x) { return x == null ? "" : Math.round(x * 1000) / 1000; }
    function evalTry(expr, vars) {
      var v = FML.validate(t(expr)); if (!v.ok) return { err: v.errors.map(function (x) { return x.message; }).join("; ") };
      var sp = FAP.scopeProblem(type, expr); if (sp) return { err: sp };
      try { return { v: FML.evaluate(expr, vars) }; } catch (ex) { return { err: ex.message }; }
    }
    /** Hỗ trợ: vị trí (ht1 = Mã hỗ trợ/tiền cơm, ht2 = Mã hỗ trợ 2) mà mã này đang được gán cho NV. */
    function supportSlots(b, ma) {
      var c = b._ct || {}, bh = c.bienHT || {}, out = [];
      ["ht1", "ht2"].forEach(function (s) { if (bh[s] && t(bh[s].ma) === ma) out.push(s); });
      return out;
    }
    /**
     * So sánh kết quả hiện tại (kết quả thật của engine) với biểu thức thử, trên cùng bộ biến thật của 1 NV.
     * @param b dòng bảng lương · expr biểu thức thử · curExpr biểu thức cấu hình hiện hành (để tái lập/kiểm khớp engine, rỗng nếu không có)
     * @param o { coChamCong: bool, slot: "ht1"|"ht2" (hỗ trợ), ma }
     */
    function trial(b, expr, curExpr, o) {
      o = o || {}; var c = (b && b._ct) || {};
      var nd = function (x) { return o.coChamCong === false ? "Chưa có dữ liệu" : x; };
      if (type === "OVERTIME") return trialOT(b, c, expr, curExpr, nd);
      if (type === "ALLOWANCE") return trialPC(b, c, expr, curExpr, nd);
      return trialHT(b, c, expr, curExpr, nd, o);
    }
    function trialOT(b, c, expr, curExpr, nd) {
      var vars = c.bienTC;
      var res = { ok: false, reason: "", rows: [], nhanh: c.nhanhTienTC || "", coSo: c.coSoTienTC || 0, selfCheck: null };
      if (!b) { res.reason = "Chưa có dữ liệu: nhân viên không có trong bảng lương kỳ này"; return res; }
      if (!vars) { res.reason = "Chưa có dữ liệu: nhân viên không được tính tăng ca trong kỳ (thiếu mã tăng ca, hết hiệu lực hoặc công chuẩn = 0)"; return res; }
      var cq0 = c.congTangCaQuyDoi, tien0 = b["Tiền tăng ca"], cqN = null, tienN = null, err = "";
      var ev = evalTry(expr, vars); if (ev.err) err = ev.err; else { cqN = ev.v; tienN = Math.round(res.coSo * cqN); }
      if (curExpr) {
        try { var rc = FML.evaluate(curExpr, vars); res.selfCheck = { ok: Math.round(res.coSo * rc) === tien0, tai: Math.round(res.coSo * rc), that: tien0 }; } catch (ex) { res.selfCheck = { ok: false, loi: ex.message }; }
      }
      res.rows = [
        { chiTieu: "Công chuẩn (theo quy chế)", cu: nd(vars.CONG_CHUAN), moi: nd(vars.CONG_CHUAN) },
        { chiTieu: "Công tăng ca", cu: nd(vars.CONG_TC), moi: nd(vars.CONG_TC) },
        { chiTieu: "Công Chủ nhật (từ chấm công)", cu: nd(vars.CONG_CHU_NHAT), moi: nd(vars.CONG_CHU_NHAT) },
        { chiTieu: "Hệ số (theo danh mục)", cu: vars.HE_SO_TC, moi: vars.HE_SO_TC },
        { chiTieu: "Công quy đổi", cu: f3(cq0), moi: err ? "⚠ " + err : f3(cqN), laKq: true },
        { chiTieu: "Đơn giá / 1 công quy đổi (theo engine" + (res.nhanh ? ", nhánh " + res.nhanh : "") + ")", cu: Math.round(res.coSo), moi: Math.round(res.coSo) },
        { chiTieu: "Tiền tăng ca", cu: tien0, moi: err ? "⚠" : tienN, laKq: true },
        { chiTieu: "Chênh lệch", cu: "", moi: err ? "" : tienN - tien0, laChenh: true }
      ];
      res.ok = !err; res.reason = err; res.cq0 = cq0; res.cqN = cqN; res.tien0 = tien0; res.tienN = tienN; res.chenh = err ? null : tienN - tien0; res.bien = vars; res.kyVong = cqN;
      return res;
    }
    var NHANH_PC = { CO_DINH: "Cố định (không tính theo công)", TYLE_TRU_LE_PHEP: "Tỷ lệ — trừ lễ + phép", TYLE_TRU_PHEP_TANGCA: "Tỷ lệ — trừ phép + tăng ca", TYLE_KHONG_TRU: "Tỷ lệ — không trừ gì", CONG_THUC: "Công thức cấu hình đang hiệu lực", CONG_CHUAN_0: "Công chuẩn = 0 → không tính" };
    function trialPC(b, c, expr, curExpr, nd) {
      var vars = c.bienPC, res = { ok: false, reason: "", rows: [], nhanh: c.nhanhPC || "", selfCheck: null };
      if (!b) { res.reason = "Chưa có dữ liệu: nhân viên không có trong bảng lương kỳ này"; return res; }
      if (!vars) { res.reason = "Chưa có dữ liệu: nhân viên không có phụ cấp trong kỳ hoặc công chuẩn = 0 (engine không tính phụ cấp theo công khi công chuẩn = 0)"; return res; }
      var tien0 = b["Phụ cấp"], tienN = null, err = "", ev = evalTry(expr, vars);
      if (ev.err) err = ev.err; else tienN = Math.round(ev.v);
      if (curExpr && res.nhanh === "CONG_THUC") {
        try { var rc = Math.round(FML.evaluate(curExpr, vars)); res.selfCheck = { ok: rc === tien0, tai: rc, that: tien0 }; } catch (ex) { res.selfCheck = { ok: false, loi: ex.message }; }
      }
      res.rows = [
        { chiTieu: "Công chuẩn", cu: nd(vars.CONG_CHUAN), moi: nd(vars.CONG_CHUAN) },
        { chiTieu: "Công hưởng phụ cấp (= tổng công)", cu: nd(vars.CONG_HUONG_PHU_CAP), moi: nd(vars.CONG_HUONG_PHU_CAP) },
        { chiTieu: "Công lễ", cu: nd(vars.CONG_LE), moi: nd(vars.CONG_LE) },
        { chiTieu: "Công phép", cu: nd(vars.CONG_PHEP), moi: nd(vars.CONG_PHEP) },
        { chiTieu: "Công tăng ca", cu: nd(vars.CONG_TC), moi: nd(vars.CONG_TC) },
        { chiTieu: "Ngưỡng phụ cấp (Tham chiếu)", cu: vars.NGUONG_PHU_CAP, moi: vars.NGUONG_PHU_CAP },
        { chiTieu: "Mức phụ cấp (Số tiền)", cu: vars.MUC_PHU_CAP, moi: vars.MUC_PHU_CAP },
        { chiTieu: "Cách tính hiện tại: " + (NHANH_PC[res.nhanh] || res.nhanh), cu: "", moi: "" , laGhiChu: true },
        { chiTieu: "Tiền phụ cấp", cu: tien0, moi: err ? "⚠" : tienN, laKq: true },
        { chiTieu: "Chênh lệch", cu: "", moi: err ? "" : tienN - tien0, laChenh: true }
      ];
      res.ok = !err; res.reason = err; res.tien0 = tien0; res.tienN = tienN; res.chenh = err ? null : tienN - tien0; res.bien = vars; res.kyVong = tienN;
      return res;
    }
    var NHANH_HT = { HT_THEO_NGAY: "Theo ngày (ngày × số tiền)", HT_THIEU_CHUAN: "Bù thiếu công chuẩn", CONG_THUC: "Công thức cấu hình đang hiệu lực" };
    function trialHT(b, c, expr, curExpr, nd, o) {
      var res = { ok: false, reason: "", rows: [], nhanh: "", selfCheck: null };
      if (!b) { res.reason = "Chưa có dữ liệu: nhân viên không có trong bảng lương kỳ này"; return res; }
      var slots = supportSlots(b, o.ma || ""), slot = o.slot && slots.indexOf(o.slot) >= 0 ? o.slot : slots[0];
      if (!slot) { res.reason = "Chưa có dữ liệu: nhân viên không được gán mã hỗ trợ này (Mã hỗ trợ / Mã hỗ trợ 2) trong kỳ"; return res; }
      var g = c.bienHT[slot], vars = g.vars; res.nhanh = g.nhanh; res.slot = slot; res.slots = slots;
      var tien0 = slot === "ht1" ? b["Tiền cơm"] : b["Lương hỗ trợ"], tienN = null, err = "", ev = evalTry(expr, vars);
      if (ev.err) err = ev.err; else tienN = Math.round(ev.v);
      if (curExpr && g.nhanh === "CONG_THUC") {
        try { var rc = Math.round(FML.evaluate(curExpr, vars)); res.selfCheck = { ok: rc === tien0, tai: rc, that: tien0 }; } catch (ex) { res.selfCheck = { ok: false, loi: ex.message }; }
      }
      var thieu = nd(Math.max(0, f3(vars.CONG_CHUAN - vars.CONG_THUC_TE)));
      res.rows = [
        { chiTieu: "Công chuẩn", cu: nd(vars.CONG_CHUAN), moi: nd(vars.CONG_CHUAN) },
        { chiTieu: "Công thực tế (tổng công)", cu: nd(vars.CONG_THUC_TE), moi: nd(vars.CONG_THUC_TE) },
        { chiTieu: "Công thiếu so với chuẩn", cu: thieu, moi: thieu },
        { chiTieu: slot === "ht1" ? "Số ngày cơm (chấm công + tiền cơm bổ sung)" : "Số ngày (Mã hỗ trợ 2 — engine truyền 0)", cu: nd(vars.SO_NGAY_COM), moi: nd(vars.SO_NGAY_COM) },
        { chiTieu: "Mức hỗ trợ (Số tiền)", cu: vars.MUC_HO_TRO, moi: vars.MUC_HO_TRO },
        { chiTieu: "Vị trí gán: " + (slot === "ht1" ? "Mã hỗ trợ (tiền cơm)" : "Mã hỗ trợ 2 (hỗ trợ lương)") + " · cách tính hiện tại: " + (NHANH_HT[g.nhanh] || g.nhanh), cu: "", moi: "", laGhiChu: true },
        { chiTieu: slot === "ht1" ? "Tiền cơm / hỗ trợ" : "Lương hỗ trợ", cu: tien0, moi: err ? "⚠" : tienN, laKq: true },
        { chiTieu: "Chênh lệch", cu: "", moi: err ? "" : tienN - tien0, laChenh: true }
      ];
      res.ok = !err; res.reason = err; res.tien0 = tien0; res.tienN = tienN; res.chenh = err ? null : tienN - tien0; res.bien = vars; res.kyVong = tienN;
      return res;
    }
    /** Chạy các ca kiểm thử đã lưu (mỗi ca: { ten, bien, kyVong }) với biểu thức expr. */
    function runSaved(tests, expr) {
      return (tests || []).map(function (c) {
        var r = { ten: c.ten || "", kyVong: c.kyVong, ok: false, ketQua: null, loi: "" };
        try {
          var sp = FAP.scopeProblem(type, expr); if (sp) throw new Error(sp);
          var v = FML.evaluate(expr, c.bien || {});
          r.ketQua = K.moneyResult ? Math.round(v) : Math.round(v * 1e6) / 1e6;
          r.ok = Math.abs(r.ketQua - +c.kyVong) < 1e-6;
        } catch (ex) { r.loi = ex.message; }
        return r;
      });
    }

    // ---------- Diễn giải / thiết kế ----------
    var FN_VI = { MAX: "lớn nhất của", MIN: "nhỏ nhất của", IF: "nếu", ROUND: "làm tròn", ABS: "giá trị tuyệt đối của", FLOOR: "làm tròn xuống", CEIL: "làm tròn lên", SUM: "tổng của", COUNT: "số lượng của" };
    function explain(expr) {
      var P = isNode ? require("./formula-parser.js") : root.HAKCore.formulaParser, toks;
      try { toks = P.tokenize(expr); } catch (e) { return { ok: false, text: "", vars: [], msg: e.message }; }
      var used = [], seen = {}, parts = [];
      toks.forEach(function (k, i) {
        if (k.t === "EOF") return;
        if (k.t === "NUM") parts.push(String(k.v));
        else if (k.t === "IDENT") {
          var nx = toks[i + 1];
          if (nx && nx.t === "(") parts.push(FN_VI[k.v] || k.v);
          else { var vv = FML.variables.get(k.v); parts.push(vv ? "[" + vv.label + "]" : k.v); if (vv && !seen[k.v]) { seen[k.v] = 1; used.push(vv); } }
        } else if (k.t === "*") parts.push("×"); else if (k.t === "/") parts.push("÷"); else if (k.t === "AND") parts.push("và"); else if (k.t === "OR") parts.push("hoặc"); else if (k.t === "NOT") parts.push("không");
        else if (k.t === ">=") parts.push("≥"); else if (k.t === "<=") parts.push("≤"); else if (k.t === "!=") parts.push("≠");
        else parts.push(k.v);
      });
      return { ok: true, text: parts.join(" ").replace(/\( /g, "(").replace(/ \)/g, ")").replace(/ ,/g, ","), vars: used };
    }
    function chips(expr) {
      var P = isNode ? require("./formula-parser.js") : root.HAKCore.formulaParser, toks;
      try { toks = P.tokenize(expr); } catch (e) { return null; }
      return toks.filter(function (k) { return k.t !== "EOF"; }).map(function (k) { return String(k.v); });
    }
    function joinTokens(arr) {
      var s = ""; arr.forEach(function (k, i) {
        var prev = arr[i - 1];
        if (k === ")" || k === ",") s += k; else if (prev === "(" || !s) s += k; else if (k === "(" && prev && /^[A-Z_][A-Z0-9_]*$/.test(prev) && (prev === "IF" || FML.functions.isKnown(prev))) s += k; else s += " " + k;
      });
      return s.trim();
    }
    /** Thư viện biến của loại này — CHỈ các biến engine thực sự cấp (lấy nội dung từ formula-variables.js). */
    function varLibrary() { return K.vars.map(function (n) { return FML.variables.get(n); }).filter(Boolean); }
    function compareTemplateToDefault(tpl, code, samples) {
      if (type !== "OVERTIME") return { comparable: false };
      var d = FML.defaults.overtime(code); if (!d) return { comparable: false };
      var bad = 0, n = samples || 500, seed = 12345;
      var rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      for (var i = 0; i < n; i++) {
        var vv = { CONG_TINH_LUONG: Math.round(rnd() * 400) / 10, CONG_LE: Math.round(rnd() * 3), CONG_TRUNG_CHUYEN: Math.round(rnd() * 3), CONG_PHEP: Math.round(rnd() * 3), CONG_TC: Math.round(rnd() * 100) / 10, CONG_CHUAN: 26, CONG_CHU_NHAT: Math.round(rnd() * 5), CONG_DI_CHUYEN: Math.round(rnd() * 3), CONG_CHUAN_2: rnd() < 0.3 ? 40 : 0, HE_SO_TC: 0.5 + Math.round(rnd() * 20) / 10 };
        if (Math.abs(FML.evaluate(d.bieuThuc, vv) - FML.evaluate(tpl.bieuThuc, vv)) > 1e-9) bad++;
      }
      return { comparable: true, equivalent: bad === 0, soCaKhac: bad, tongCa: n };
    }

    return {
      TYPE: TYPE, KIND: K, LINK: LINK, STAMP_LINK: STAMP_LINK, TEST_TABLE: TEST_TABLE, OT_VARS: OT_VARS,
      formulaKey: formulaKey, isBuiltin: isBuiltin, parentCodes: parentCodes, parentRows: parentRows, effectiveRow: effectiveRow, ownersByKey: ownersByKey,
      parentOf: parentOf, formulasOf: formulasOf, versionsForTab: versionsForTab, sharedWith: sharedWith, applied: applied, summary: summary,
      linkPlan: linkPlan, linkOps: linkOps, rollbackOps: rollbackOps, batches: batches, integrityDiff: integrityDiff,
      validateInfo: validateInfo, usage: usage, deleteCheck: deleteCheck, preActivation: preActivation,
      coChamCong: coChamCong, employeesOf: employeesOf, supportSlots: supportSlots, trial: trial, runSaved: runSaved,
      explain: explain, chips: chips, joinTokens: joinTokens, varLibrary: varLibrary, compareTemplateToDefault: compareTemplateToDefault
    };
  }

  var cache = {};
  var api = { vn: vn, KINDS: KINDS, TYPES: ["OVERTIME", "ALLOWANCE", "SUPPORT"], forType: function (type) { return cache[type] || (cache[type] = make(type)); }, make: make };
  if (isNode) module.exports = api; else { root.HAKCore = root.HAKCore || {}; root.HAKCore.formulaMaster = api; }
})(typeof window !== "undefined" ? window : this);
