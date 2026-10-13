// ===== ENGINE TÍNH LƯƠNG HAK (offline) — port từ Tinhluong.gs / Tinhcong.gs / Danhmuc.gs =====
(function (root) {
  "use strict";
  var FML = (typeof module !== "undefined" && module.exports) ? require("./core/payroll/formula-engine.js") : root.HAKCore.formula;

  function pct(v) {
    if (v === "" || v == null) return 0;
    if (typeof v === "number") return v;
    var s = String(v).trim();
    if (s.endsWith("%")) { var n = parseFloat(s.slice(0, -1).replace(",", ".")); return isNaN(n) ? 0 : n / 100; }
    var m = parseFloat(s.replace(",", ".")); return isNaN(m) ? 0 : m;
  }
  function num(v) {
    if (v === "" || v == null) return 0;
    if (typeof v === "number") return v;
    var s = String(v).trim().replace(/\s/g, "");
    if (!s) return 0;
    var dots = (s.match(/\./g) || []).length, commas = (s.match(/,/g) || []).length;
    if (dots && commas) { // "1.500.000,5" hoặc "1,500,000.5": dấu cuối cùng là dấu thập phân
      var dec = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
      s = dec === "." ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
    } else if (dots > 1) s = s.replace(/\./g, "");        // "1.500.000"
    else if (commas > 1) s = s.replace(/,/g, "");          // "1,500,000"
    else s = s.replace(",", ".");                          // "0,08" / "0.08" / "1500000"
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  // Số TIỀN: hiểu đúng cách nhập Việt Nam "500.000" / "1.500.000" (dấu chấm = hàng nghìn).
  // num() giữ nguyên hành vi cũ cho tỷ lệ, hệ số, số công, khối lượng ("0.175", "1.5", "28.5").
  function money(v) {
    if (v === "" || v == null) return 0;
    if (typeof v === "number") return isFinite(v) ? v : 0;
    var s = String(v).trim().replace(/\s|đ|VNĐ|VND/gi, ""), neg = /^-/.test(s); if (neg) s = s.slice(1);
    var n;
    if (/^[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(s)) n = parseFloat(s.replace(/\./g, "").replace(",", "."));
    else if (/^[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/.test(s)) n = parseFloat(s.replace(/,/g, ""));
    else n = num(s);
    n = isNaN(n) ? 0 : n;
    return neg ? -n : n;
  }
  function tachCong(v) { // "1QC" -> {soCong:1, nhan:"QC"}
    if (v === "" || v == null) return { soCong: 0, nhan: "" };
    if (typeof v === "number") return { soCong: v, nhan: "" };
    var s = String(v).trim();
    var m = s.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
    if (!m) return { soCong: 0, nhan: s };
    return { soCong: parseFloat(m[1].replace(",", ".")) || 0, nhan: m[2].trim() };
  }
  function ky(r, f) { // "YYYY-MM-DD" -> {y,m,d}
    var s = r[f]; if (!s) return null;
    var m = String(s).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  }
  function trongKy(r, f, nam, thang) { var k = ky(r, f); return k && k.y === nam && k.m === thang; }
  function kyChamCong(r) { // chấm công lưu "Kỳ" = "YYYY-MM"
    var m = String(r["Kỳ"] || "").match(/^(\d{4})-(\d{1,2})$/);
    return m ? { y: +m[1], m: +m[2] } : null;
  }

  // Lọc danh mục theo hiệu lực: lấy dòng mới nhất (Hiệu lực từ lớn nhất) còn hiệu lực trong tháng
  function hieuLuc(list, keyF, nam, thang) {
    var dauKy = nam * 10000 + thang * 100 + 1, cuoiKy = nam * 10000 + thang * 100 + 31;
    var dn = function (s) { var k = String(s || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); return k ? (+k[1]) * 10000 + (+k[2]) * 100 + (+k[3]) : null; };
    var map = {};
    (list || []).forEach(function (r) {
      var key = r[keyF]; if (key === "" || key == null) return;
      var tu = dn(r["Hiệu lực từ"]), den = dn(r["Hiệu lực đến"]);
      if (tu != null && tu > cuoiKy) return;
      if (den != null && den < dauKy) return;
      var cu = map[key];
      if (!cu || (tu || 0) >= (dn(cu["Hiệu lực từ"]) || 0)) map[key] = r;
    });
    return map;
  }

  /**
   * Quy chế bù sản lượng CHÍNH THỨC (mục VIII — "CompanyID → PolicyVersion → PayrollMethod"): chỉ
   * bản ghi "Trạng thái" = "Hiệu lực" và hiệu lực trong kỳ mới được dùng để QUYẾT ĐỊNH phương pháp
   * bù khi CHỐT — không dùng lựa chọn tự do trên màn hình Tính lương (xem app.js chotKy()). Nhiều
   * bản "Hiệu lực" cùng hiệu lực trong kỳ → lấy "Hiệu lực từ" lớn nhất (bản mới nhất).
   * @returns bản ghi (có "Cách bù") hoặc null nếu chưa có cấu hình hợp lệ cho kỳ này.
   */
  function quyCheBuChinhThuc(list, nam, thang) {
    var dauKy = nam * 10000 + thang * 100 + 1, cuoiKy = nam * 10000 + thang * 100 + 31;
    var dn = function (s) { var k = String(s || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); return k ? (+k[1]) * 10000 + (+k[2]) * 100 + (+k[3]) : null; };
    var best = null;
    (list || []).forEach(function (r) {
      if (String(r["Trạng thái"] || "") !== "Hiệu lực") return;
      var tu = dn(r["Hiệu lực từ"]), den = dn(r["Hiệu lực đến"]);
      if (tu != null && tu > cuoiKy) return;
      if (den != null && den < dauKy) return;
      if (!best || (tu || 0) >= (dn(best["Hiệu lực từ"]) || 0)) best = r;
    });
    return best;
  }

  function tinhThueLuyTien(tn, bieu) {
    if (!tn || tn <= 0) return 0;
    var thue = 0;
    bieu.forEach(function (b) {
      var min = money(b["Thu nhập từ"] != null && b["Thu nhập từ"] !== "" ? b["Thu nhập từ"] : b["Thu nhập tháng (Min)"]);
      var maxRaw = b["Thu nhập đến"] != null && b["Thu nhập đến"] !== "" ? b["Thu nhập đến"] : b["Thu nhập tháng (Max)"];
      var tyLe = pct(b["Tỷ lệ"] != null && b["Tỷ lệ"] !== "" ? b["Tỷ lệ"] : b["Tỷ lệ đóng thuế"]);
      if (tn <= min) return;
      var tran = (maxRaw === "" || maxRaw == null || money(maxRaw) === 0) ? tn : Math.min(tn, money(maxRaw));
      if (tran - min > 0) thue += (tran - min) * tyLe;
    });
    return Math.round(thue);
  }

  // ===== Tra & tính công thức cấu hình (Master V5 mục V.3 — KHÔNG rơi về công thức mặc định khi cấu hình hiệu lực bị lỗi) =====
  // Phân biệt:
  //  • Không có cấu hình hiệu lực cho mã (NONE) / chỉ có cho công ty khác → dùng công thức lịch sử (tương thích ngược) — riêng
  //    "chỉ có cho công ty khác" có kèm cảnh báo để không âm thầm bỏ qua.
  //  • Có cấu hình HIỆU LỰC nhưng sai (biểu thức rỗng/sai cú pháp/biến lạ/chia 0/xung đột phiên bản…) → FORMULA_ERROR: khoản này
  //    = 0đ, KHÔNG dùng công thức lịch sử, ghi vào kq.loiCongThuc → checklist chốt kỳ chặn (BLOCKER).
  //  • Bản "Nháp"/"Đã duyệt"/"Ngừng" không bao giờ được registry trả về → không áp dụng vào lương chính thức.
  var LOAI_KHOAN = { OVERTIME: "tăng ca", ALLOWANCE: "phụ cấp", SUPPORT: "hỗ trợ" };
  function baoLoiCongThuc(fmlCtx, info) {
    if (fmlCtx && typeof fmlCtx.error === "function") fmlCtx.error(info);
    else if (fmlCtx && typeof fmlCtx.warn === "function") fmlCtx.warn("FORMULA_ERROR — " + (info.maCongThuc || "") + ": " + info.message);
  }
  /** @returns null (không có cấu hình áp dụng — dùng công thức lịch sử) | { loi: true } (đã báo FORMULA_ERROR) | { rec } */
  function traCongThuc(fmlCtx, code, type) {
    var r = FML.resolveEx(fmlCtx.records, { code: code, type: type, companyId: fmlCtx.companyId, nam: fmlCtx.nam, thang: fmlCtx.thang });
    if (r.status === "CONFLICT") {
      baoLoiCongThuc(fmlCtx, { loai: type, maCongThuc: code, bieuThuc: "", maLoi: "CONFLICT", bien: "",
        message: "có " + r.conflict.length + " bản công thức cùng 'Hiệu lực' + cùng ngày hiệu lực từ cho mã này — không có quy tắc ưu tiên",
        huongXuLy: "Danh mục → Công thức tiền lương → Lịch sử phiên bản: chuyển các bản thừa sang 'Ngừng' hoặc đặt ngày hiệu lực khác nhau, rồi tính lại" });
      return { loi: true };
    }
    if (r.status === "OTHER_COMPANY") {
      fmlCtx._seen = fmlCtx._seen || {}; var kk = type + "|" + code;
      if (!fmlCtx._seen[kk] && typeof fmlCtx.warn === "function") {
        fmlCtx._seen[kk] = 1;
        fmlCtx.warn("Mã " + LOAI_KHOAN[type] + " '" + code + "': có công thức đang hiệu lực nhưng chỉ ghi cho công ty khác (" + r.otherCompany.join(", ") + ") — KHÔNG áp dụng cho công ty của file này, đang dùng công thức lịch sử. Nếu đó là công thức của công ty này, sửa cột 'Công ty' cho đúng tên công ty trong hồ sơ.");
      }
      return null;
    }
    if (r.rec && !String(r.rec["Biểu thức"] || "").trim()) {
      baoLoiCongThuc(fmlCtx, { loai: type, maCongThuc: code, bieuThuc: "", maLoi: "EMPTY_EXPRESSION", bien: "",
        message: "công thức đang hiệu lực nhưng 'Biểu thức' để trống",
        huongXuLy: "Nhập biểu thức cho bản công thức này hoặc chuyển sang 'Ngừng', rồi tính lại" });
      return { loi: true };
    }
    return r.rec ? { rec: r.rec } : null;
  }
  /** @returns { ok: true, v } | { ok: false } (đã báo FORMULA_ERROR) */
  function tinhCongThuc(fmlCtx, rec, type, vars) {
    try { return { ok: true, v: FML.evaluate(rec["Biểu thức"], vars) }; }
    catch (e) {
      var bien = (String(e && e.message || "").match(/"([A-Z0-9_]+)"/) || [])[1] || "";
      baoLoiCongThuc(fmlCtx, { loai: type, maCongThuc: String(rec["Mã công thức"] || ""), bieuThuc: String(rec["Biểu thức"] || ""),
        maLoi: (e && e.code) || "ERROR", bien: bien, message: (e && e.message) || String(e),
        huongXuLy: "Sửa biểu thức trong Danh mục → Công thức tiền lương (tab Kiểm tra công thức để chạy thử), rồi tính lại" });
      return { ok: false };
    }
  }

  // congChuan2: mốc chuẩn riêng cho TC2 khi chấm công có nhãn "DQ" (đối chiếu công thức M thật của HAK_DN,
  // query QR_CHAMCONG2/QR_TH_CC: nhãn chấm công chứa "DQ" → "Công chuẩn 2" = 40 cố định, dùng thay Công chuẩn
  // thường khi tính phần tăng ca vượt chuẩn của TC2). congChuan2 = 0/không có nhãn DQ → dùng cChuan như cũ.
  // loai: "Loại công thức" khai trong DM_TANGCA (mục 8.1 — mã mới dùng lại công thức có sẵn mà không cần
  // sửa engine, VD mã "TC7" khai "Loại công thức" = "TC1" để dùng công thức TC1). Để trống → dùng chính
  // tên mã (hành vi cũ, giữ đúng số liệu cho dữ liệu đã khai TC1-TC6 từ trước khi có cột này).
  //
  // Dynamic Payroll Formula Engine (Master Prompt mục III/IV): TRƯỚC khi dùng switch/case cứng dưới đây,
  // thử tra DM_PAYROLL_FORMULA (db.dm_congthuc, qua core/payroll/formula-registry.js) xem công ty có tự
  // cấu hình/ghi đè công thức cho đúng mã này trong kỳ đang tính không — có thì dùng NGAY, không đụng gì
  // đến switch/case. KHÔNG có override (trường hợp tuyệt đại đa số — mọi dữ liệu TC1-TC6 đã dùng từ trước)
  // → rơi xuống switch/case CŨ, giữ NGUYÊN 100% số liệu đã đối chiếu M thật + bộ regression (v130.test.js).
  // Nhờ vậy mã tăng ca MỚI (VD "TC7") chỉ cần thêm 1 dòng DM_PAYROLL_FORMULA là engine tự tính theo đúng
  // công thức khai báo — không cần sửa file này (tiêu chuẩn nghiệm thu mục XX.1).
  function heSoTangCa(ma, cCTL, cTC, cLe, cChuan, cCN, cTang, heSo, cPhep, cDC, congChuan2, loai, fmlCtx) {
    var key = loai || ma;
    if (fmlCtx && fmlCtx.records && fmlCtx.records.length) {
      var t = traCongThuc(fmlCtx, key, "OVERTIME");
      if (t && t.loi) return 0; // FORMULA_ERROR đã ghi — KHÔNG rơi xuống công thức lịch sử
      if (t && t.rec) {
        var ev = tinhCongThuc(fmlCtx, t.rec, "OVERTIME", {
          CONG_TINH_LUONG: cCTL, CONG_TRUNG_CHUYEN: cTC, CONG_LE: cLe, CONG_CHUAN: cChuan, CONG_CHU_NHAT: cCN,
          CONG_TC: cTang, HE_SO_TC: heSo, CONG_PHEP: cPhep, CONG_DI_CHUYEN: cDC, CONG_CHUAN_2: congChuan2
        });
        return ev.ok ? ev.v : 0;
      }
    }
    // Không có cấu hình công ty → công thức mặc định của hệ thống (dữ liệu trong formula-defaults.js, đã test tương đương switch cũ).
    var mac = FML.defaults.overtime(key);
    if (!mac) {
      // P2-01 (chủ sở hữu chọn phương án B): mã tăng ca không có công thức hiệu lực của công ty và không thuộc TC1–TC6
      // → FORMULA_ERROR (0đ + chặn chốt kỳ), KHÔNG tính ngầm theo CÔNG_TC × HỆ_SỐ. Gọi không kèm ngữ cảnh báo lỗi (test/cũ) thì giữ mặc định cũ.
      if (fmlCtx && typeof fmlCtx.error === "function") {
        baoLoiCongThuc(fmlCtx, { loai: "OVERTIME", maCongThuc: String(key || ""), bieuThuc: "", maLoi: "UNKNOWN_CODE", bien: "",
          message: "mã tăng ca chưa có công thức (không thuộc TC1–TC6 và chưa khai báo trong Công thức tiền lương)",
          huongXuLy: "Danh mục → Công thức tiền lương → Tăng ca: thêm công thức cho mã này (Nháp → Gửi duyệt → Hiệu lực) hoặc sửa mã tăng ca của nhân viên về TC1–TC6, rồi tính lại" });
        return 0;
      }
      mac = FML.defaults.OVERTIME_FALLBACK;
    }
    return FML.evaluate(mac.bieuThuc, {
      CONG_TINH_LUONG: cCTL, CONG_TRUNG_CHUYEN: cTC, CONG_LE: cLe, CONG_CHUAN: cChuan, CONG_CHU_NHAT: cCN,
      CONG_TC: cTang, HE_SO_TC: heSo, CONG_PHEP: cPhep, CONG_DI_CHUYEN: cDC, CONG_CHUAN_2: congChuan2
    });
  }

  /** Số ngày giảm trừ của mã lương: cột "Số ngày giảm trừ" (Excel HAK Group: "Ngày giảm trừ"), không có thì lấy số sau dấu "-" trong Cách tính */
  function ngayGiamTru(dmLuongInfo) {
    if (!dmLuongInfo) return 0;
    var v = dmLuongInfo["Số ngày giảm trừ"]; if (v === "" || v == null) v = dmLuongInfo["Ngày giảm trừ"]; // tên cột cũ của Excel CNHAK
    if (v !== "" && v != null && isFinite(+v)) return +v;
    var m = String(dmLuongInfo["Cách tính"] || "").match(/-\s*(\d+)\s*$/);
    return m ? parseInt(m[1], 10) : 0;
  }
  /**
   * Công chuẩn. qc2026 (quy chế HAK Group 2026, chủ sở hữu duyệt 11/10/2026): "… tất cả ngày CN" = số ngày − số Chủ nhật;
   * các cách khác = số ngày của tháng − Số ngày giảm trừ (TG3 30 − 4 = 26). Cách cũ (1.7): trừ Chủ nhật rồi trừ tiếp số sau dấu "-".
   */
  function congChuan(dmLuongInfo, thang, nam, congThucTe, qc2026) {
    var text = dmLuongInfo ? String(dmLuongInfo["Cách tính"] || "").toLowerCase() : "";
    var n = new Date(nam, thang, 0).getDate();
    if (/thực tế/.test(text)) { if (qc2026) { var kCN = n - ngayGiamTru(dmLuongInfo); return kCN > 0 ? kCN : 26; } return congThucTe > 0 ? congThucTe : 26; } // 2026 (C9): công nhật — công chuẩn = số ngày − Số ngày giảm trừ (tăng ca, phụ cấp, hỗ trợ); lương vẫn = đơn giá × công
    // ⚠ LỖI THẬT ĐÃ PHÁT HIỆN VÀ SỬA: return sớm ở đây (không điều kiện qc2026) khiến mã lương có "Cách tính" ĐÚNG Y NGUYÊN
    // "Số ngày của tháng" (không hậu tố "-N") không bao giờ chạy tới nhánh qc2026 bên dưới — "Số ngày giảm trừ" khai riêng ở
    // cột (không qua hậu tố "-N" trong text) bị bỏ qua hoàn toàn. Chỉ giữ return sớm này cho cách tính CŨ (1.7, !qc2026).
    if (!qc2026 && /^\s*số ngày của tháng\s*$/.test(text)) return n;
    var cn = 0; for (var d = 1; d <= n; d++) if (new Date(nam, thang - 1, d).getDay() === 0) cn++;
    if (qc2026 && !/ch[ủu] nh[ậa]t|ngày cn/.test(text)) { var k26 = n - ngayGiamTru(dmLuongInfo); return k26 > 0 ? k26 : 26; }
    var kq = n - cn, m = text.match(/-\s*(\d+)\s*$/);
    if (m) kq -= parseInt(m[1], 10);
    return kq > 0 ? kq : 26;
  }

  function tongHopChamCong(list, nam, thang) {
    var res = {};
    list.forEach(function (row) {
      var ma = row["Mã NV"]; if (!ma) return;
      var k = kyChamCong(row); if (!k || k.y !== nam || k.m !== thang) return;
      var r = res[ma] || (res[ma] = { tongCong: 0, congChuNhat: 0, congTangCa: 0, congLe: 0, congPhep: 0, congCom: 0, congDiChuyen: 0, congTrungChuyen: 0, nhanTheoNgay: {}, congChinhTheoNgay: {}, congBT: 0, congBTTheoNgay: {} });
      var ht = String(row["Hình thức công"] || "BT").trim().toUpperCase();
      var laCong = ht !== "CC", laTC = /TC/.test(ht), tong = 0;
      for (var d = 1; d <= 31; d++) {
        var ten = ("0" + d).slice(-2), t = tachCong(row[ten]);
        if (t.soCong === 0 && !t.nhan) continue;
        tong += t.soCong;
        if (t.nhan) r.nhanTheoNgay[ten] = t.nhan;
        if (!laTC && laCong) {
          var dt = new Date(nam, thang - 1, d);
          if (dt.getMonth() === thang - 1 && dt.getDay() === 0) r.congChuNhat += t.soCong;
          r.congChinhTheoNgay[ten] = (r.congChinhTheoNgay[ten] || 0) + t.soCong;
        }
        if (ht === "BT") { r.congBTTheoNgay[ten] = (r.congBTTheoNgay[ten] || 0) + t.soCong; r.congBT += t.soCong; } // α19: công BT riêng (cơ chế bù kiểu công cụ HAK)
      }
      if (laCong) r.tongCong += tong;
      if (laTC) r.congTangCa += tong;
      if (ht === "CL") r.congLe += tong;
      if (ht === "PN") r.congPhep += tong;
      if (ht === "CC") r.congCom += tong;
      if (ht === "DC") r.congDiChuyen += tong;
      if (ht === "TRCH") r.congTrungChuyen += tong;
    });
    return res;
  }

  function tongHopTan(list, nam, thang) {
    var tong = {}, ngay = {};
    list.forEach(function (r) {
      var k = ky(r, "Ngày cân"); if (!k || k.y !== nam || k.m !== thang) return;
      var ma = r["Mã NV"]; if (!ma) return;
      var kl = num(r["KL hàng (Tấn)"]);
      tong[ma] = (tong[ma] || 0) + kl;
      var ten = ("0" + k.d).slice(-2);
      (ngay[ma] || (ngay[ma] = {}))[ten] = ((ngay[ma] || {})[ten] || 0) + kl;
    });
    return { tong: tong, ngay: ngay };
  }

  // Bậc thang "SL tham chiếu" theo công BT của ngày (công cụ HAK / Power Query + DAX Đại Hiệp): hệ số × mức sàn
  function bacThang(cong, chuNhat) {
    if (cong < 0.5) return 0;
    if (cong < 1) return 0.5;
    if (!chuNhat || cong < 1.5) return 1;
    return 1.5;
  }

  function tongHopTheoMa(list, cotNgay, nam, thang, cols) {
    var map = {};
    list.forEach(function (r) {
      if (!trongKy(r, cotNgay, nam, thang)) return;
      var ma = r["Mã NV"]; if (!ma) return;
      var o = map[ma] || (map[ma] = {}); cols.forEach(function (c) { o[c] = (o[c] || 0); });
      cols.forEach(function (c) { o[c] += money(r[c]); });
    });
    return map;
  }

  function byKey(list, f) { var m = {}; (list || []).forEach(function (r) { m[r[f]] = r; }); return m; }

  /** Tính bảng lương 1 tháng. db = toàn bộ dữ liệu. */
  /**
   * opts.quyChe: "2026" = quy chế lương HAK Group (HAK, CNHAK, HAKQN — chủ sở hữu duyệt 11/10/2026, R-68; đối chiếu bảng lương CNHAK 9/2026 khớp 42/44,
   * 2 người lệch đúng phần thuế TNCN); bỏ trống = cách tính engine 1.7 (giữ nguyên số cũ).
   */
  function tinhBangLuong(db, nam, thang, buTheoNgay, opts) {
    nam = +nam; thang = +thang;
    var qc2026 = !!(opts && String(opts.quyChe) === "2026");
    ["nhansu","chamcong","sanluong","bandam","psluong","ungluong","tiencom","dm_luong","dm_phucap","dm_tangca","dm_hotro","dm_baohiem","dm_tncn","dm_bacthue","dm_giamtru","dm_phongban","dm_chucvu","dm_congthuc"].forEach(function (k) { if (!db[k]) db[k] = []; });
    // Dynamic Payroll Formula Engine (mục III/XII.3): nạp 1 LẦN cho cả kỳ (không phải từng nhân viên)
    // danh sách công thức do công ty cấu hình — rỗng ở hầu hết dữ liệu hiện có (chưa ai tạo công thức
    // mới), heSoTangCa() sẽ rơi xuống switch/case cũ, không có gì thay đổi so với trước.
    var tenCongTy = db.congty && db.congty[0] ? [db.congty[0]["Mã công ty"], db.congty[0]["Tên công ty"]].filter(function (x) { return x != null && String(x).trim() !== ""; }) : [];
    // Mô hình 1 công ty/1 file: danh tính công ty = hồ sơ db.congty (Mã công ty, Tên công ty) — registry so khớp cột "Công ty" của công thức với các giá trị này
    var fmlCtx = { records: db.dm_congthuc, nam: nam, thang: thang, companyId: tenCongTy, maNV: "",
      warn: function (msg) { out.canhbao.push(msg); },
      error: function (info) {
        var rec = { maNV: fmlCtx.maNV, loai: info.loai, maCongThuc: info.maCongThuc, bieuThuc: info.bieuThuc, maLoi: info.maLoi, bien: info.bien || "", message: info.message, huongXuLy: info.huongXuLy, soTienAnhHuong: null };
        out.loiCongThuc.push(rec);
        out.canhbao.push("FORMULA_ERROR — " + (rec.maNV ? rec.maNV + ": " : "") + "mã " + LOAI_KHOAN[rec.loai] + " '" + rec.maCongThuc + "' — " + rec.message + (rec.bieuThuc ? " (biểu thức: " + rec.bieuThuc + ")" : "") + " — khoản này tính = 0đ, KHÔNG dùng công thức mặc định. " + rec.huongXuLy);
      } };
    var dmLuong = hieuLuc(db.dm_luong, "Mã lương", nam, thang);
    var dmPC = hieuLuc(db.dm_phucap, "Mã phụ cấp", nam, thang);
    var dmTC = hieuLuc(db.dm_tangca, "Mã tăng ca", nam, thang);
    var dmHT = hieuLuc(db.dm_hotro, "Mã hỗ trợ", nam, thang);
    var dmBH = hieuLuc(db.dm_baohiem, "Mã bảo hiểm", nam, thang);
    var dmGT = hieuLuc(db.dm_giamtru, "Mã giảm trừ", nam, thang);
    var bacSrc = (db.dm_bacthue && db.dm_bacthue.length) ? db.dm_bacthue : db.dm_tncn.filter(function (r) { return r["Bậc"] !== "" && r["Bậc"] != null; });
    // PV-7c: biểu thuế lũy tiến có thể gắn riêng theo "Mã thuế TNCN" (như DM_BAC_TNCN thật — mỗi mã
    // thuế 1 biểu riêng); dòng không ghi mã thuế = áp dụng chung cho mọi mã (giữ đúng số liệu cũ,
    // trước khi danh mục có cột này). Chỉ khi CÓ ít nhất 1 dòng ghi rõ mã mới cần lọc theo từng người.
    var bacCoMa = bacSrc.some(function (r) { return r["Mã thuế TNCN"]; });
    var bieuCache = {};
    function bieuCho(maThue) {
      if (bieuCache[maThue]) return bieuCache[maThue];
      var src = bacCoMa ? bacSrc.filter(function (r) { return !r["Mã thuế TNCN"] || r["Mã thuế TNCN"] === maThue; }) : bacSrc;
      var bacMap = hieuLuc(src, "Bậc", nam, thang);
      var b = Object.keys(bacMap).map(function (k) { return bacMap[k]; })
        .sort(function (a, c) { return num(a["Thu nhập từ"] || a["Thu nhập tháng (Min)"]) - num(c["Thu nhập từ"] || c["Thu nhập tháng (Min)"]); });
      bieuCache[maThue] = b; return b;
    }
    var dmPTThue = hieuLuc(db.dm_tncn.filter(function (r) { return r["Mã thuế TNCN"]; }), "Mã thuế TNCN", nam, thang);
    var pb = byKey(db.dm_phongban, "Mã phòng ban"), cv = byKey(db.dm_chucvu, "Mã chức vụ");

    var cc = tongHopChamCong(db.chamcong, nam, thang);
    var sl = tongHopTan(db.sanluong, nam, thang);
    var bd = tongHopTan(db.bandam, nam, thang);
    var ps = tongHopTheoMa(db.psluong, "Ngày hạch toán", nam, thang, ["Thưởng", "Thu nhập khác", "Trừ khác"]);
    var ung = tongHopTheoMa(db.ungluong, "Ngày hạch toán", nam, thang, ["Tạm ứng"]);
    var comMap = {};
    (db.tiencom || []).forEach(function (r) { if (trongKy(r, "Ngày", nam, thang) && r["Mã NV"]) comMap[r["Mã NV"]] = (comMap[r["Mã NV"]] || 0) + num(r["Số suất cơm"]); });

    var out = { bangluong: [], bhxh: [], tncn: [], canhbao: [], loiCongThuc: [] };
    var dauKy = new Date(nam, thang - 1, 1);
    // Cách bù lương sản lượng: false = theo tháng (từng người) · true = theo ngày (liên tục) — 2 cách cũ, giữ nguyên;
    // α19 (chủ sở hữu duyệt "làm như công cụ"): "daihiep" = theo ngày bậc thang (công cụ HAK, mẫu Đại Hiệp) · "to" = theo bình quân tổ
    var cheDoBu = buTheoNgay === "daihiep" || buTheoNgay === "to" ? buTheoNgay : (buTheoNgay ? "ngay" : "thang");
    var soNgayThang = new Date(nam, thang, 0).getDate(), binhQuanTo = {};
    if (cheDoBu === "to") {
      // Tổng tiền sản lượng (tấn × đơn giá + xe bơm dăm × đơn giá) cả tổ / số ngày của tháng / số người của tổ (người hưởng lương sản phẩm)
      var toSum = {};
      (db.nhansu || []).forEach(function (ns) {
        var ma = ns["Mã nhân viên"]; if (!ma) return;
        var nghi = ns["Ngày nghỉ/thay đổi"]; if (nghi && new Date(nghi) < dauKy) return;
        var dmL0 = dmLuong[ns["Mã tiền lương 1"]] || dmLuong[ns["Mã tiền lương 2"]] || null;
        if (!(dmL0 && /SP/i.test(dmL0["Mã hình thức lương"] || ""))) return;
        var dm20 = dmLuong[ns["Mã tiền lương 2"]] || null, laSP20 = !!(dm20 && /SP/i.test(dm20["Mã hình thức lương"] || ""));
        var gBD = laSP20 ? money(dm20["Số tiền khoán"]) : money(dmL0["Đơn giá bơm dăm"]);
        var k = ns["Mã PB"] || "", o = toSum[k] || (toSum[k] = { tien: 0, n: 0 });
        o.tien += (sl.tong[ma] || 0) * money(dmL0["Số tiền khoán"]) + (qc2026 ? 0 : (bd.tong[ma] || 0) * gBD); o.n++; // 2026 (C4): tiền tổ chỉ tính sản lượng
      });
      Object.keys(toSum).forEach(function (k) { binhQuanTo[k] = toSum[k].n ? toSum[k].tien / soNgayThang / toSum[k].n : 0; });
    }

    (db.nhansu || []).forEach(function (ns) {
      var ma = ns["Mã nhân viên"]; if (!ma) return;
      fmlCtx.maNV = ma; // gắn mã NV vào FORMULA_ERROR (nếu có) của người này
      var nghi = ns["Ngày nghỉ/thay đổi"];
      if (nghi && new Date(nghi) < dauKy) return;
      var c = cc[ma] || { tongCong: 0, congChuNhat: 0, congTangCa: 0, congLe: 0, congPhep: 0, congCom: 0, congDiChuyen: 0, congTrungChuyen: 0, nhanTheoNgay: {}, congChinhTheoNgay: {}, congBT: 0, congBTTheoNgay: {} };
      var luongTT = money(ns["Lương thỏa thuận"]), luongTTMoi = luongTT, chiaPL = false;
      // Q-22 (R-56): phụ lục mới hiệu lực từ ngày tuNgay trong kỳ, chọn "Từ ngày hiệu lực" → lương thỏa thuận của kỳ =
      // bình quân theo công: (mức cũ × công chính trước ngày + mức mới × công chính từ ngày) / tổng công chính. Không có trường này = như cũ.
      var tuNgay = +ns["Áp dụng từ ngày"] || 0;
      if (tuNgay > 1 && ns["Lương thỏa thuận trước"] !== "" && ns["Lương thỏa thuận trước"] != null) {
        var lttCu = money(ns["Lương thỏa thuận trước"]), cTruoc = 0, cSau = 0;
        Object.keys(c.congChinhTheoNgay).forEach(function (k) { var v = c.congChinhTheoNgay[k] || 0; if (+k < tuNgay) cTruoc += v; else cSau += v; });
        if (cTruoc + cSau > 0) {
          luongTT = (lttCu * cTruoc + luongTTMoi * cSau) / (cTruoc + cSau); chiaPL = true;
          out.canhbao.push(ma + ": phụ lục mới từ ngày " + tuNgay + " (Q-22, tính từ ngày hiệu lực) — " + Math.round(cTruoc * 100) / 100 + " công theo mức cũ " + lttCu.toLocaleString("vi-VN") + ", " + Math.round(cSau * 100) / 100 + " công theo mức mới " + luongTTMoi.toLocaleString("vi-VN"));
        }
      }
      var maTL1 = ns["Mã tiền lương 1"] || "";
      var dmL = dmLuong[ns["Mã tiền lương 1"]] || dmLuong[ns["Mã tiền lương 2"]] || null;
      if (!dmL && maTL1) out.canhbao.push(ma + ": mã lương '" + maTL1 + "' chưa có trong Danh mục lương (hoặc hết hiệu lực)");
      var cChuan = congChuan(dmLuong[maTL1] || null, thang, nam, c.tongCong, qc2026);
      var laSL = !!(dmL && /SP/i.test(dmL["Mã hình thức lương"] || ""));

      // Lương thời gian
      var donGiaTG = cChuan > 0 ? luongTT / cChuan : 0;
      var congTinhTG = Math.min(c.tongCong, cChuan) || c.tongCong;
      // "Loại công thức" (DM_LUONG, như DM_TANGCA/DM_PHUCAP/DM_HOTRO): để trống = hành vi cũ (C3, lễ+phép).
      // M thật HAK_DN (Section1.m, "Công tính TG") cho SP = Công lễ + Công TĂNG CA, không phải lễ+phép —
      // nhưng chưa đối chiếu được bằng số liệu thật nào có công tăng ca/phép ≠ 0 (xem PV-12) — không ép
      // chung 1 công thức, để từng công ty tự chọn qua danh mục khi đã xác nhận đúng cho dữ liệu của mình.
      if (qc2026) {
        if (maTL1 === "SP") {
          var loaiTG = String(dmL ? dmL["Loại công thức"] : "").trim();
          congTinhTG = loaiTG === "TG_LE_TANGCA" ? (c.congLe || 0) + (c.congTangCa || 0) : (c.congLe || 0) + (c.congPhep || 0);
        } else congTinhTG = c.tongCong - (ns["Mã tăng ca"] === "TC5" ? c.congTangCa || 0 : 0); // C10: công TC5 (ca vị trí khác) đã trả riêng — không tính lại vào lương TG // 2026: C1 trả đủ công đi làm (không cắt ở công chuẩn)
      }
      var luongTG;
      if (maTL1 === "CĐ") luongTG = chiaPL ? Math.round(luongTT) : luongTT;
      else if (maTL1 === "CN1" || maTL1 === "CN2" || maTL1 === "SP") luongTG = Math.round(luongTT * congTinhTG);
      else luongTG = Math.round(donGiaTG * congTinhTG);
      var luongPhu = dmL ? money(dmL["Lương phụ"]) : 0;

      // Lương sản lượng + bù
      var tan = sl.tong[ma] || 0, donGiaSL = dmL ? money(dmL["Số tiền khoán"]) : 0;
      var luongSL = 0, luongBu = 0;
      if (laSL) {
        if (tan > 0 && donGiaSL <= 0) out.canhbao.push(ma + ": có sản lượng (" + Math.round(tan * 1000) / 1000 + " tấn) nhưng mã lương '" + maTL1 + "' chưa có 'Số tiền khoán' (đơn giá) trong Danh mục lương — lương sản lượng = 0đ, kiểm tra lại danh mục");
        luongSL = Math.round(tan * donGiaSL);
        var nguong = num(dmL["ĐK_Bù lương (công tối thiểu)"]), giaBu = money(dmL["Đơn giá bù lương"]);
        if (cheDoBu === "daihiep") {
          // Mỗi NGÀY có sản lượng: tiền ngày = MAX(tấn ngày × đơn giá, bậc thang(công BT ngày) × mức sàn); bù = tổng phần chênh. Không xét ngưỡng.
          if (giaBu > 0) {
            var snD = sl.ngay[ma] || {}, buF = 0, thieuBT = [];
            Object.keys(snD).forEach(function (t) {
              var tanN = snD[t] || 0; if (tanN <= 0) return;
              var payN = tanN * donGiaSL, chuNhatN = new Date(nam, thang - 1, +t).getDay() === 0;
              var congBTN = c.congBTTheoNgay[t] || 0;
              if (congBTN <= 0) thieuBT.push(t); // có sản lượng nhưng chưa chấm công BT ngày đó — không suy đoán, chỉ cảnh báo
              var th = bacThang(congBTN, chuNhatN) * giaBu;
              if (th > payN) buF += th - payN;
            });
            if (thieuBT.length) out.canhbao.push(ma + ": có sản lượng nhưng CHƯA chấm công BT ngày " + thieuBT.sort().join(", ") + "/" + thang + " — bù lương sản lượng (theo ngày bậc thang) các ngày này đang tính bằng 0, kiểm tra lại chấm công trước khi chốt kỳ");
            luongBu = Math.round(buF);
          }
        } else if (cheDoBu === "to") {
          // Bình quân tổ < mức sàn → người đủ ngưỡng công (công BT ≥ "Ngưỡng công bù theo tổ") được bù (mức sàn − bình quân tổ) × công BT
          var bq = binhQuanTo[ns["Mã PB"] || ""] || 0, ngTo = num(dmL["Ngưỡng công bù theo tổ"]);
          if (giaBu > 0 && c.congBT >= ngTo && c.congBT > 0 && bq < giaBu) luongBu = Math.round((giaBu - bq) * c.congBT);
        } else if (cheDoBu === "ngay") {
          if (nguong > 0 && giaBu > 0) {
            var cn = c.congChinhTheoNgay, sn = sl.ngay[ma] || {};
            for (var d = 1; d <= 31; d++) {
              var t = ("0" + d).slice(-2), cd = cn[t] || 0;
              if (cd <= 0) continue;
              var sd = sn[t] || 0;
              if (sd / cd < nguong) { var bu = Math.round(giaBu * cd) - Math.round(sd * donGiaSL); if (bu > 0) luongBu += bu; }
            }
          }
        } else if (nguong > 0 && c.tongCong > 0 && tan / c.tongCong < nguong) {
          luongBu = Math.max(0, Math.round(giaBu * c.tongCong) - luongSL);
        }
      }

      // Bơm dăm
      var xe = bd.tong[ma] || 0;
      var dm2 = dmLuong[ns["Mã tiền lương 2"]] || null;
      var laSP2 = !!(dm2 && /SP/i.test(dm2["Mã hình thức lương"] || ""));
      var giaBD = laSP2 ? money(dm2["Số tiền khoán"]) : (dmL ? money(dmL["Đơn giá bơm dăm"]) : 0);
      if (xe > 0 && giaBD <= 0) out.canhbao.push(ma + ": có bơm dăm (" + xe + " xe) nhưng chưa có đơn giá (" + (laSP2 ? "'Số tiền khoán' của mã tiền lương 2" : "'Đơn giá bơm dăm'") + ") trong Danh mục lương — lương bơm dăm = 0đ, kiểm tra lại danh mục");
      var luongBD = Math.round(xe * giaBD);

      // Tăng ca
      var dmT = dmTC[ns["Mã tăng ca"]] || null, tienTC = 0, congTCQuyDoi = 0;
      if (!dmT && ns["Mã tăng ca"]) out.canhbao.push(ma + ": mã tăng ca '" + ns["Mã tăng ca"] + "' chưa có trong Danh mục tăng ca (hoặc hết hiệu lực) — Tiền tăng ca = 0đ, kiểm tra lại danh mục");
      // Nhãn chấm công chứa "DQ" → Công chuẩn 2 = 40, dùng thay Công chuẩn khi tính TC2 (công thức M thật HAK_DN)
      var congChuan2 = Object.keys(c.nhanTheoNgay).some(function (k) { return /DQ/i.test(c.nhanTheoNgay[k]); }) ? 40 : 0;
      if (cChuan > 0) {
        if ((maTL1 === "CN1" || maTL1 === "CN2") && qc2026) { // 2026 (C5): công nhật tính tăng ca theo công thức của mã tăng ca, công chuẩn = số ngày − Số ngày giảm trừ
          if (dmT) { var ccCN = new Date(nam, thang, 0).getDate() - ngayGiamTru(dmLuong[maTL1]); congTCQuyDoi = heSoTangCa(ns["Mã tăng ca"], c.tongCong, c.congTrungChuyen, c.congLe, ccCN, c.congChuNhat, c.congTangCa, pct(dmT["Hệ số tăng ca"]), c.congPhep, c.congDiChuyen, congChuan2, dmT["Loại công thức"], fmlCtx); tienTC = Math.round(luongTT * congTCQuyDoi); }
        } else if (maTL1 === "CN1" || maTL1 === "CN2") { // chủ sở hữu xác nhận (sau khi đối chiếu M thật QR_LUONGTG."Lương tăng ca"): CN1/CN2 PHẢI nhân hệ số mã tăng ca như mọi loại lương khác, không phải trường hợp riêng — không phân biệt quy chế 2026
          if (dmT) { congTCQuyDoi = heSoTangCa(ns["Mã tăng ca"], c.tongCong, c.congTrungChuyen, c.congLe, cChuan, c.congChuNhat, c.congTangCa, pct(dmT["Hệ số tăng ca"]), c.congPhep, c.congDiChuyen, congChuan2, dmT["Loại công thức"], fmlCtx); tienTC = Math.round(luongTT * congTCQuyDoi); }
        }
        else if (dmT && (ns["Mã tăng ca"] === "TC5" || dmT["Loại công thức"] === "TC5")) { congTCQuyDoi = heSoTangCa(ns["Mã tăng ca"], c.tongCong, c.congTrungChuyen, c.congLe, cChuan, c.congChuNhat, c.congTangCa, pct(dmT["Hệ số tăng ca"]), c.congPhep, c.congDiChuyen, congChuan2, dmT["Loại công thức"], fmlCtx); tienTC = Math.round(money(dmT["Tiền tăng ca (nếu tính cố định)"]) / cChuan * congTCQuyDoi); } // đúng công thức M thật QR_LUONGTG — hệ số TC5 áp dụng như mọi mã khác (chủ sở hữu xác nhận, xem PV-9)
        else if (dmT) { congTCQuyDoi = heSoTangCa(ns["Mã tăng ca"], c.tongCong, c.congTrungChuyen, c.congLe, cChuan, c.congChuNhat, c.congTangCa, pct(dmT["Hệ số tăng ca"]), c.congPhep, c.congDiChuyen, congChuan2, dmT["Loại công thức"], fmlCtx); tienTC = Math.round(donGiaTG * congTCQuyDoi); }
      }

      // Phụ cấp — PV-10/PV-11: "Loại công thức" (danh mục, như DM_TANGCA) cho phép 1 mã CHỌN ĐÚNG công
      // thức tính thay vì để engine tự đoán qua nội dung "Cách tính" — để trống = hành vi CŨ, không đổi.
      var pc = dmPC[ns["Mã phụ cấp"]], tienPC = 0;
      if (pc) {
        var soPC = money(pc["Số tiền"]);
        var trongCT = !String(pc["Cách tính"] || "").trim();
        var loaiPC = String(pc["Loại công thức"] || "").trim();
        var coDinh = loaiPC ? loaiPC === "CO_DINH" : (/cố định/i.test(String(pc["Cách tính"] || "")) || (trongCT && !qc2026));
        if (coDinh) tienPC = soPC || Math.round(luongTT * pct(pc["Tỷ lệ"]));
        else if (cChuan > 0) {
          var du = cChuan - num(pc["Tham chiếu"]);
          var kieuPC = loaiPC || (trongCT ? "TYLE_TRU_PHEP_TANGCA" : "TYLE_KHONG_TRU"); // mặc định = đúng hành vi cũ (2026/C6 = trừ phép+tăng ca, đã đối chiếu CNHAK/HAKQN thật; "Cách tính" có mô tả = không trừ gì)
          var KIEU_PC_CO_SAN = { TYLE_TRU_LE_PHEP: 1, TYLE_TRU_PHEP_TANGCA: 1, TYLE_KHONG_TRU: 1 };
          var cPC, nguongPC, pcRec = null;
          // Dynamic Payroll Formula Engine (mục V): "Loại công thức" KHÔNG khớp 3 kiểu có sẵn ở trên →
          // tra db.dm_congthuc (Loại=ALLOWANCE) trước khi coi là TYLE_KHONG_TRU theo mặc định cũ.
          var pcLoi = false;
          if (!KIEU_PC_CO_SAN[kieuPC] && fmlCtx.records && fmlCtx.records.length) {
            var tp = traCongThuc(fmlCtx, kieuPC, "ALLOWANCE");
            if (tp && tp.loi) pcLoi = true; else if (tp) pcRec = tp.rec;
          }
          if (pcLoi) tienPC = 0; // FORMULA_ERROR đã ghi (kèm mã NV) — không dùng công thức mặc định
          else if (pcRec) {
            var ep = tinhCongThuc(fmlCtx, pcRec, "ALLOWANCE", {
              MUC_PHU_CAP: soPC, CONG_CHUAN: cChuan, CONG_HUONG_PHU_CAP: c.tongCong, NGUONG_PHU_CAP: num(pc["Tham chiếu"]),
              CONG_TINH_LUONG: c.tongCong, CONG_LE: c.congLe, CONG_PHEP: c.congPhep, CONG_TC: c.congTangCa
            });
            tienPC = ep.ok ? Math.round(ep.v) : 0;
          }
          else {
            if (kieuPC === "TYLE_TRU_LE_PHEP") { cPC = c.tongCong - (c.congLe || 0) - (c.congPhep || 0); nguongPC = c.tongCong; } // đối chiếu M thật HAK_DN (QR_CC_PHUCAP_TN) — chỉ áp dụng khi mã CHỌN đúng kiểu này
            else if (kieuPC === "TYLE_TRU_PHEP_TANGCA") { cPC = c.tongCong - (c.congPhep || 0) - (c.congTangCa || 0); nguongPC = cPC; }
            else { cPC = c.tongCong; nguongPC = cPC; } // TYLE_KHONG_TRU (hoặc "Loại công thức" lạ chưa có công thức cấu hình — giữ đúng hành vi cũ)
            tienPC = nguongPC >= du ? soPC : Math.round(soPC / cChuan * cPC);
          }
        }
      }
      // Hỗ trợ lương (Mã hỗ trợ 2) & tiền cơm (Mã hỗ trợ) — "Loại công thức" cho phép 1 mã dùng công
      // thức khác với vị trí (Mã hỗ trợ / Mã hỗ trợ 2) gán nó; để trống = đúng công thức cũ theo vị trí.
      var hoTro = function (dm, macDinh, ngay) {
        var loai = String(dm["Loại công thức"] || "").trim() || macDinh;
        if (loai === "HT_THIEU_CHUAN") return (cChuan > 0 && c.tongCong - cChuan <= 0) ? Math.round((cChuan - c.tongCong) * money(dm["Số tiền"])) : 0;
        if (loai !== "HT_THEO_NGAY" && fmlCtx.records && fmlCtx.records.length) {
          // Dynamic Payroll Formula Engine (mục VI): "Loại công thức" không phải HT_THIEU_CHUAN/HT_THEO_NGAY
          // → tra db.dm_congthuc (Loại=SUPPORT) trước khi coi là HT_THEO_NGAY theo mặc định cũ.
          var th = traCongThuc(fmlCtx, loai, "SUPPORT");
          if (th && th.loi) return 0; // FORMULA_ERROR đã ghi — không dùng công thức mặc định
          if (th && th.rec) {
            var eh = tinhCongThuc(fmlCtx, th.rec, "SUPPORT", { MUC_HO_TRO: money(dm["Số tiền"]), CONG_CHUAN: cChuan, CONG_THUC_TE: c.tongCong, SO_NGAY_COM: ngay, SO_NGAY_DUOC_HUONG: ngay });
            return eh.ok ? Math.round(eh.v) : 0;
          }
        }
        return Math.round(ngay * money(dm["Số tiền"])); // HT_THEO_NGAY (hoặc "Loại công thức" lạ chưa có công thức cấu hình — giữ đúng hành vi cũ)
      };
      var ht2 = dmHT[ns["Mã hỗ trợ 2"]], luongHT = ht2 ? hoTro(ht2, "HT_THIEU_CHUAN", 0) : 0;
      var ht1 = dmHT[ns["Mã hỗ trợ"]], ngayCom = (c.congCom || 0) + (comMap[ma] || 0);
      var tienCom = ht1 ? hoTro(ht1, "HT_THEO_NGAY", ngayCom) : 0;
      // Phụ cấp công tác theo nhãn chấm công
      var dem = {}, pcCT = 0;
      Object.keys(c.nhanTheoNgay).forEach(function (k) { var n = c.nhanTheoNgay[k]; if (n) dem[n] = (dem[n] || 0) + 1; });
      Object.keys(dem).forEach(function (n) { if (dmPC[n]) pcCT += dem[n] * money(dmPC[n]["Số tiền"]); else out.canhbao.push(ma + ": nhãn công tác '" + n + "' trên chấm công (" + dem[n] + " ngày) chưa có mã phụ cấp tương ứng trong Danh mục phụ cấp — phụ cấp công tác = 0đ cho nhãn này, kiểm tra lại danh mục"); });

      var p = ps[ma] || { "Thưởng": 0, "Thu nhập khác": 0, "Trừ khác": 0 }, u = ung[ma] || { "Tạm ứng": 0 };
      var tongTN = luongTG + luongPhu + luongSL + luongBu + luongBD + tienTC + tienPC + pcCT + luongHT + tienCom + p["Thưởng"] + p["Thu nhập khác"];

      // BHXH
      var bh = dmBH[ns["Mã BHXH"]], luongBH = money(ns["Lương cơ bản"]) || (qc2026 ? 0 : luongTTMoi), bhNLD = 0, kpcdNLD = 0, truyThu = 0; // BH theo phụ lục đang hiệu lực (không chia theo Q-22)
      if (bh && luongBH > 0 && luongBH < 1000) out.canhbao.push(ma + ": lương đóng BH = " + luongBH + "đ — quá nhỏ, kiểm tra lại 'Lương cơ bản' trong phụ lục hợp đồng");
      var khongLCB = !!(bh && qc2026 && !(luongBH > 0));
      if (khongLCB) { bh = null; out.canhbao.push(ma + ": có mã BHXH nhưng chưa có Lương cơ bản (mức đóng) — quy chế 2026 không tính BH / truy thu (như bảng lương Excel)"); } // 2026 (C8)
      if (bh) {
        var tlNLD = num(bh["NLD.BHXH"]) + num(bh["NLD.BHYT"]) + num(bh["NLD.BHTN"]); // KPCĐ NLĐ tách riêng (xem kpcdNLD) — không gộp vào Cộng BH NLĐ đóng, đúng như báo cáo RP_BHXH/RP_THLUONG thực tế của HAK_DN (T11/2025) và Quế Sơn (T9/2025): "Tổng KPCĐ" là cột riêng, không cộng vào "Tổng BH"
        var ng = dmL ? num(dmL["Ngưỡng truy thu BH (công)"]) : 0;
        var du2 = !ng || c.tongCong >= ng;
        var ctyDong = Math.round(luongBH * (num(bh["DN.BHXH"]) + num(bh["DN.BHYT"]) + num(bh["DN.BHTN"]) + num(bh["DN.KPCD"])));
        if (du2) { bhNLD = Math.round(luongBH * tlNLD); kpcdNLD = Math.round(luongBH * num(bh["NLD.KPCD"])); } else truyThu = ctyDong; // KPCĐ NLĐ áp dụng luôn, không chỉ qc2026 (dữ liệu thực tế HAK_DN T11/2025 và Quế Sơn T9/2025 đều đã trừ trước khi quy chế 2026 được duyệt 11/10/2026)
        var bhRow = {
          "Mã NV": ma, "Họ và tên": ns["Họ và tên"], "Phòng ban": (pb[ns["Mã PB"]] || {})["Tên phòng ban"] || ns["Mã PB"] || "",
          "Số sổ BHXH": ns["Số sổ BHXH"] || "", // PV-7a: báo cáo BHXH thật (RP_BHXH) có cột này
          "Lương đóng BHXH": luongBH,
          "CTY.BHXH": Math.round(luongBH * num(bh["DN.BHXH"])), "CTY.BHYT": Math.round(luongBH * num(bh["DN.BHYT"])),
          "CTY.BHTN": Math.round(luongBH * num(bh["DN.BHTN"])), "CTY.KPCĐ": Math.round(luongBH * num(bh["DN.KPCD"])),
          "Cộng BH công ty đóng": ctyDong,
          "NLĐ.BHXH": Math.round(luongBH * num(bh["NLD.BHXH"])), "NLĐ.BHYT": Math.round(luongBH * num(bh["NLD.BHYT"])),
          "NLĐ.BHTN": Math.round(luongBH * num(bh["NLD.BHTN"])), "Cộng BH NLĐ đóng": bhNLD, "NLĐ.KPCĐ": kpcdNLD, "Truy thu bảo hiểm": truyThu,
          "Ghi chú": du2 ? "Đủ ngưỡng" : "Chưa đủ ngưỡng (" + c.tongCong + "/" + ng + " công)"
        };
        out.bhxh.push(bhRow);
      } else if (ns["Mã BHXH"] && !khongLCB) out.canhbao.push(ma + ": mã BHXH '" + ns["Mã BHXH"] + "' chưa có trong Danh mục bảo hiểm");

      // TNCN
      var maT = ns["Mã TNCN"] || "", npt = num(ns["Người phụ thuộc"]);
      var gtBT = dmGT[ns["Mã GT_TNCN_BT"]], gtPT = dmGT[ns["Mã GT_TNCN_PT"]];
      var tienGTBT = gtBT ? money(gtBT["Số tiền"]) : 0, tongGTPT = npt * (gtPT ? money(gtPT["Số tiền"]) : 0);
      var chiuThue = 0, tinhThue = 0, thue = 0;
      // Phương thức thuế: mã cũ TNCN0/1/2, hoặc mã trong danh mục Thuế TNCN (Nội dung "Khấu trừ vãng lai" / "Lũy tiến")
      var pt = dmPTThue[maT], kieu, tyLeVL = 0.10;
      if (maT === "TNCN1") kieu = "VL";
      else if (maT === "TNCN2") kieu = "LT";
      else if (!maT || maT === "TNCN0") kieu = "MIEN";
      else if (pt) {
        var nd = String(pt["Nội dung"] || "");
        kieu = /vãng lai/i.test(nd) ? "VL" : (/l[ũu]y ti[ếe]n|luỹ tiến/i.test(nd) ? "LT" : "MIEN");
        if (kieu === "VL" && pct(pt["Mức thuế"]) > 0) tyLeVL = pct(pt["Mức thuế"]);
      } else { kieu = "LT"; out.canhbao.push(ma + ": mã thuế TNCN '" + maT + "' chưa có trong danh mục — tạm tính lũy tiến"); }
      if (kieu === "VL") { chiuThue = tongTN; tinhThue = tongTN; thue = Math.round(tongTN * tyLeVL); }
      else if (kieu === "MIEN") { chiuThue = tongTN - bhNLD - kpcdNLD; }
      else {
        if (!gtBT) out.canhbao.push(ma + ": thuế lũy tiến nhưng không tìm thấy mức giảm trừ bản thân hiệu lực trong kỳ (mã '" + (ns["Mã GT_TNCN_BT"] || "") + "') — thuế có thể bị tính cao");
        if (npt > 0 && !gtPT) out.canhbao.push(ma + ": có " + npt + " người phụ thuộc nhưng không tìm thấy mức giảm trừ người phụ thuộc hiệu lực trong kỳ");
        var bieu = bieuCho(maT); // PV-7c: biểu thuế lũy tiến tham chiếu theo đúng Mã thuế TNCN của người này (nếu danh mục có phân biệt)
        if (!bieu.length) out.canhbao.push(ma + ": không có biểu thuế lũy tiến hiệu lực trong kỳ (mã thuế '" + maT + "') — thuế = 0");
        chiuThue = tongTN - bhNLD - kpcdNLD - tienCom; tinhThue = Math.max(0, chiuThue - tienGTBT - tongGTPT); thue = tinhThueLuyTien(tinhThue, bieu);
      }
      if (thue > 0) out.tncn.push({
        "Mã NV": ma, "Họ và tên": ns["Họ và tên"], "Thu nhập chịu thuế": chiuThue,
        "Giảm trừ bản thân": kieu === "VL" ? 0 : tienGTBT, "Số người phụ thuộc": npt,
        "Giảm trừ người phụ thuộc": kieu === "VL" ? 0 : tongGTPT, "Thu nhập tính thuế": tinhThue, "Thuế TNCN phải nộp": thue
      });

      var truKhac = p["Trừ khác"], tamUng = u["Tạm ứng"];
      var cl = tongTN - bhNLD - kpcdNLD - truyThu - thue - truKhac - tamUng;
      var thucLinh = cl >= 0 ? Math.round(cl / 1000) * 1000 : 0;
      if (cl < 0) out.canhbao.push(ma + ": các khoản trừ (BH, thuế, tạm ứng, trừ khác) vượt thu nhập " + Math.round(-cl).toLocaleString("vi-VN") + "đ — thực lĩnh để 0, phần còn thiếu CHƯA được chuyển sang kỳ sau, cần xử lý thủ công");
      out.bangluong.push({
        "Mã NV": ma, "Họ và tên": ns["Họ và tên"],
        "Phòng ban": (pb[ns["Mã PB"]] || {})["Tên phòng ban"] || ns["Mã PB"] || "",
        "Chức vụ": (cv[ns["Mã CV"]] || {})["Tên chức vụ"] || ns["Mã CV"] || "",
        "Lương thỏa thuận": luongTTMoi, "Công chuẩn": cChuan, "Tổng công": c.tongCong, "Công CN": c.congChuNhat, "Công tăng ca": c.congTangCa,
        "Lương thời gian": luongTG, "Lương phụ": luongPhu, "Sản lượng (tấn)": Math.round(tan * 1000) / 1000, "Lương sản lượng": luongSL,
        "Lương bù SL": luongBu, "Số xe bơm dăm": xe, "Lương bơm dăm": luongBD, "Tiền tăng ca": tienTC,
        "Phụ cấp": tienPC, "Phụ cấp công tác": pcCT, "Lương hỗ trợ": luongHT, "Ngày cơm": ngayCom, "Tiền cơm": tienCom,
        "Thưởng": p["Thưởng"], "Thu nhập khác": p["Thu nhập khác"], "Tổng thu nhập": tongTN,
        "BH trừ NLĐ": bhNLD, "KPCĐ trừ NLĐ": kpcdNLD, "Truy thu BH": truyThu, "Thuế TNCN": thue, "Trừ khác": truKhac, "Tạm ứng": tamUng, "Thực lĩnh": thucLinh,
        // Master Prompt V3 mục 16.3 ("Xem chi tiết cách tính") — không tính lại, chỉ chụp lại biến trung
        // gian đã dùng để ra đúng các số tiền ở trên, để UI giải thích công thức + giá trị đã thế vào.
        "_ct": {
          maLuong: maTL1, hinhThucLuong: dmL ? (dmL["Mã hình thức lương"] || "") : "",
          congChuan: cChuan, congBT: c.congBT, congTinhTG: Math.round(congTinhTG * 1000) / 1000, donGiaTG: Math.round(donGiaTG),
          // mục VII (Kiểm tra công thức) — chụp thêm các công thô để dry-run test panel có đủ biến CONG_LE/CONG_PHEP/CONG_TRUNG_CHUYEN/CONG_CHU_NHAT/CONG_DI_CHUYEN/CONG_TC
          congLe: c.congLe || 0, congPhep: c.congPhep || 0, congTrungChuyen: c.congTrungChuyen || 0,
          congChuNhat: c.congChuNhat || 0, congDiChuyen: c.congDiChuyen || 0, congTangCa: c.congTangCa || 0,
          maTangCa: ns["Mã tăng ca"] || "", loaiCongThucTangCa: dmT ? (dmT["Loại công thức"] || ns["Mã tăng ca"] || "") : "",
          heSoTangCa: dmT ? pct(dmT["Hệ số tăng ca"]) : 0, congChuan2: congChuan2 || 0,
          congTangCaQuyDoi: Math.round(congTCQuyDoi * 1000) / 1000,
          laSanLuong: laSL, donGiaKhoan: donGiaSL, phuongPhapBu: laSL ? cheDoBu : "",
          mucBuDmLuong: laSL && dmL ? money(dmL["Đơn giá bù lương"]) : 0,
          binhQuanTo: laSL && cheDoBu === "to" ? Math.round(binhQuanTo[ns["Mã PB"] || ""] || 0) : null,
          maPhuCap: ns["Mã phụ cấp"] || "", loaiCongThucPhuCap: pc ? (loaiPC || (trongCT ? "TYLE_TRU_PHEP_TANGCA" : "TYLE_KHONG_TRU")) : "",
          maThueTNCN: maT, phuongPhapThue: kieu, thuNhapTinhThue: Math.round(tinhThue)
        }
      });
      // Q-19 (R-53): điều chuyển phòng ban trong kỳ → tỷ lệ chia chi phí theo công chính ở từng phòng (không đổi số tiền lương)
      if (ns["Phân bổ phòng ban"]) {
        var segs = String(ns["Phân bổ phòng ban"]).split(";").map(function (x) { var i = x.lastIndexOf("@"); return { pb: x.slice(0, i), tu: +x.slice(i + 1) || 1 }; });
        var congSeg = segs.map(function () { return 0; });
        Object.keys(c.congChinhTheoNgay).forEach(function (k) { var j = 0; segs.forEach(function (sg, i) { if (+k >= sg.tu) j = i; }); congSeg[j] += c.congChinhTheoNgay[k] || 0; });
        var tongSeg = congSeg.reduce(function (a, b) { return a + b; }, 0);
        out.bangluong[out.bangluong.length - 1]["Phân bổ PB"] = segs.map(function (sg, i) {
          return { "Mã PB": sg.pb, "Phòng ban": (pb[sg.pb] || {})["Tên phòng ban"] || sg.pb || "", "Công": Math.round(congSeg[i] * 1000) / 1000,
            "Tỷ lệ": tongSeg > 0 ? congSeg[i] / tongSeg : (i === segs.length - 1 ? 1 : 0) }; // không có công → toàn bộ vào phòng ban cuối kỳ
        });
        out.canhbao.push(ma + ": điều chuyển phòng ban trong kỳ (Q-19) — chi phí chia theo công: " + out.bangluong[out.bangluong.length - 1]["Phân bổ PB"].map(function (x) { return (x["Phòng ban"] || x["Mã PB"]) + " " + x["Công"] + " công (" + Math.round(x["Tỷ lệ"] * 1000) / 10 + "%)"; }).join(", "));
      }
    });
    return out;
  }

  /**
   * Chi tiết bù lương sản lượng Đại Hiệp theo ngày bậc thang (Master Prompt V3 mục XVII — đối chiếu
   * Excel). Dùng ĐÚNG dữ liệu đã truyền cho `tinhBangLuong` (db.nhansu = staffForPayroll đã resolve,
   * db.sanluong = sản lượng đã phân bổ theo NV) để tổng tiền bù mỗi người ở đây CỘNG KHỚP đúng cột
   * "Lương bù SL" của bảng lương chính thức — không tính lại bằng công thức khác, chỉ bóc chi tiết
   * từng ngày của CHÍNH công thức đó (bacThang(), xem tinhBangLuong, nhánh cheDoBu === "daihiep").
   * Trả về 1 dòng cho mỗi NGÀY có sản lượng của mỗi nhân viên hưởng lương sản phẩm có "Đơn giá bù
   * lương" > 0: { ma, hoTen, maPB, ngay, chuNhat, congBT, heSo, slChuan, slThamChieu, slThucTe, slBu, tienBu }.
   */
  function chiTietBuNgayDaiHiep(db, nam, thang) {
    nam = +nam; thang = +thang;
    var dmLuong = hieuLuc(db.dm_luong || [], "Mã lương", nam, thang);
    var cc = tongHopChamCong(db.chamcong || [], nam, thang);
    var sl = tongHopTan(db.sanluong || [], nam, thang);
    var out = [];
    (db.nhansu || []).forEach(function (ns) {
      var ma = ns["Mã nhân viên"]; if (!ma) return;
      var dmL = dmLuong[ns["Mã tiền lương 1"]] || dmLuong[ns["Mã tiền lương 2"]] || null;
      var laSL = !!(dmL && /SP/i.test(dmL["Mã hình thức lương"] || ""));
      if (!laSL) return;
      var donGiaSL = money(dmL["Số tiền khoán"]), giaBu = money(dmL["Đơn giá bù lương"]);
      if (donGiaSL <= 0 || giaBu <= 0) return;
      var slChuan = giaBu / donGiaSL; // SL_CHUAN_1_NGAY — luôn tính từ danh mục, không hardcode
      var c = cc[ma] || { congBTTheoNgay: {} }, snD = sl.ngay[ma] || {};
      Object.keys(snD).sort().forEach(function (t) {
        var tanN = snD[t] || 0; if (tanN <= 0) return;
        var chuNhatN = new Date(nam, thang - 1, +t).getDay() === 0;
        var congBTN = c.congBTTheoNgay[t] || 0, heSo = bacThang(congBTN, chuNhatN);
        var slThamChieu = slChuan * heSo, slBu = Math.max(0, slThamChieu - tanN);
        var tienBu = Math.max(0, heSo * giaBu - tanN * donGiaSL); // công thức tương đương — không làm tròn ở bước này
        out.push({
          ma: ma, hoTen: ns["Họ và tên"] || "", maPB: ns["Mã PB"] || "",
          ngay: nam + "-" + ("0" + thang).slice(-2) + "-" + t, chuNhat: chuNhatN,
          congBT: congBTN, heSo: heSo, slChuan: slChuan, slThamChieu: slThamChieu,
          slThucTe: tanN, slBu: slBu, tienBu: tienBu
        });
      });
    });
    return out;
  }

  var ENGINE_VERSION = "1.8.0"; // 1.8.0: quy chế lương HAK Group 2026 (opts.quyChe "2026", R-68 — C1…C10); không bật = số như 1.7.0 · 1.5.0: Q-22 áp dụng phụ lục từ ngày hiệu lực · 1.6.0: Q-19 "Phân bổ PB" khi điều chuyển (không dùng = số tiền giống 1.4.0) · 1.7.0: thêm cách bù "daihiep" / "to" (công cụ HAK; 2 cách cũ giữ nguyên số)
  var api = { ENGINE_VERSION: ENGINE_VERSION, money: money, tinhBangLuong: tinhBangLuong, tinhThueLuyTien: tinhThueLuyTien, congChuan: congChuan, ngayGiamTru: ngayGiamTru, tachCong: tachCong, tongHopChamCong: tongHopChamCong, hieuLuc: hieuLuc, num: num, pct: pct, bacThang: bacThang, chiTietBuNgayDaiHiep: chiTietBuNgayDaiHiep, quyCheBuChinhThuc: quyCheBuChinhThuc };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.LuongEngine = api;
})(typeof window !== "undefined" ? window : this);
