// ===== ENGINE TÍNH LƯƠNG HAK (offline) — port từ Tinhluong.gs / Tinhcong.gs / Danhmuc.gs =====
(function (root) {
  "use strict";

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

  function heSoTangCa(ma, cCTL, cTC, cLe, cChuan, cCN, cTang, heSo, cPhep, cDC) {
    switch (ma) {
      case "TC1": { var d = cCTL - cLe - cTC - cPhep - cTang - cChuan; return (d > 0 ? d * heSo : 0) + cTang * heSo; }
      case "TC2": { var d2 = cCTL - cLe - cTC - cPhep - cTang - cDC - cChuan; return (d2 > 0 ? d2 * heSo : 0) + cTang * heSo; }
      case "TC6": { var d6 = cCTL - cTC - cLe - cChuan; return d6 > 0 ? d6 : 0; }
      case "TC3": return (cTang + cCN) * heSo;
      default: return cTang * heSo;
    }
  }

  function congChuan(dmLuongInfo, thang, nam, congThucTe) {
    var text = dmLuongInfo ? String(dmLuongInfo["Cách tính"] || "").toLowerCase() : "";
    if (/thực tế/.test(text)) return congThucTe > 0 ? congThucTe : 26;
    var n = new Date(nam, thang, 0).getDate();
    if (/^\s*số ngày của tháng\s*$/.test(text)) return n;
    var cn = 0; for (var d = 1; d <= n; d++) if (new Date(nam, thang - 1, d).getDay() === 0) cn++;
    var kq = n - cn, m = text.match(/-\s*(\d+)\s*$/);
    if (m) kq -= parseInt(m[1], 10);
    return kq > 0 ? kq : 26;
  }

  function tongHopChamCong(list, nam, thang) {
    var res = {};
    list.forEach(function (row) {
      var ma = row["Mã NV"]; if (!ma) return;
      var k = kyChamCong(row); if (!k || k.y !== nam || k.m !== thang) return;
      var r = res[ma] || (res[ma] = { tongCong: 0, congChuNhat: 0, congTangCa: 0, congLe: 0, congPhep: 0, congCom: 0, congDiChuyen: 0, congTrungChuyen: 0, nhanTheoNgay: {}, congChinhTheoNgay: {} });
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
  function tinhBangLuong(db, nam, thang, buTheoNgay) {
    nam = +nam; thang = +thang;
    ["nhansu","chamcong","sanluong","bandam","psluong","ungluong","tiencom","dm_luong","dm_phucap","dm_tangca","dm_hotro","dm_baohiem","dm_tncn","dm_bacthue","dm_giamtru","dm_phongban","dm_chucvu"].forEach(function (k) { if (!db[k]) db[k] = []; });
    var dmLuong = hieuLuc(db.dm_luong, "Mã lương", nam, thang);
    var dmPC = hieuLuc(db.dm_phucap, "Mã phụ cấp", nam, thang);
    var dmTC = hieuLuc(db.dm_tangca, "Mã tăng ca", nam, thang);
    var dmHT = hieuLuc(db.dm_hotro, "Mã hỗ trợ", nam, thang);
    var dmBH = hieuLuc(db.dm_baohiem, "Mã bảo hiểm", nam, thang);
    var dmGT = hieuLuc(db.dm_giamtru, "Mã giảm trừ", nam, thang);
    var bacSrc = (db.dm_bacthue && db.dm_bacthue.length) ? db.dm_bacthue : db.dm_tncn.filter(function (r) { return r["Bậc"] !== "" && r["Bậc"] != null; });
    var bacMap = hieuLuc(bacSrc, "Bậc", nam, thang);
    var bieu = Object.keys(bacMap).map(function (k) { return bacMap[k]; })
      .sort(function (a, b) { return num(a["Thu nhập từ"] || a["Thu nhập tháng (Min)"]) - num(b["Thu nhập từ"] || b["Thu nhập tháng (Min)"]); });
    var dmPTThue = hieuLuc(db.dm_tncn.filter(function (r) { return r["Mã thuế TNCN"]; }), "Mã thuế TNCN", nam, thang);
    var pb = byKey(db.dm_phongban, "Mã phòng ban"), cv = byKey(db.dm_chucvu, "Mã chức vụ");

    var cc = tongHopChamCong(db.chamcong, nam, thang);
    var sl = tongHopTan(db.sanluong, nam, thang);
    var bd = tongHopTan(db.bandam, nam, thang);
    var ps = tongHopTheoMa(db.psluong, "Ngày hạch toán", nam, thang, ["Thưởng", "Thu nhập khác", "Trừ khác"]);
    var ung = tongHopTheoMa(db.ungluong, "Ngày hạch toán", nam, thang, ["Tạm ứng"]);
    var comMap = {};
    (db.tiencom || []).forEach(function (r) { if (trongKy(r, "Ngày", nam, thang) && r["Mã NV"]) comMap[r["Mã NV"]] = (comMap[r["Mã NV"]] || 0) + num(r["Số suất cơm"]); });

    var out = { bangluong: [], bhxh: [], tncn: [], canhbao: [] };
    var dauKy = new Date(nam, thang - 1, 1);

    (db.nhansu || []).forEach(function (ns) {
      var ma = ns["Mã nhân viên"]; if (!ma) return;
      var nghi = ns["Ngày nghỉ/thay đổi"];
      if (nghi && new Date(nghi) < dauKy) return;
      var c = cc[ma] || { tongCong: 0, congChuNhat: 0, congTangCa: 0, congLe: 0, congPhep: 0, congCom: 0, congDiChuyen: 0, congTrungChuyen: 0, nhanTheoNgay: {}, congChinhTheoNgay: {} };
      var luongTT = money(ns["Lương thỏa thuận"]);
      var maTL1 = ns["Mã tiền lương 1"] || "";
      var dmL = dmLuong[ns["Mã tiền lương 1"]] || dmLuong[ns["Mã tiền lương 2"]] || null;
      if (!dmL && maTL1) out.canhbao.push(ma + ": mã lương '" + maTL1 + "' chưa có trong Danh mục lương (hoặc hết hiệu lực)");
      var cChuan = congChuan(dmLuong[maTL1] || null, thang, nam, c.tongCong);
      var laSL = !!(dmL && /SP/i.test(dmL["Mã hình thức lương"] || ""));

      // Lương thời gian
      var donGiaTG = cChuan > 0 ? luongTT / cChuan : 0;
      var congTinhTG = Math.min(c.tongCong, cChuan) || c.tongCong;
      var luongTG;
      if (maTL1 === "CĐ") luongTG = luongTT;
      else if (maTL1 === "CN1" || maTL1 === "CN2" || maTL1 === "SP") luongTG = Math.round(luongTT * congTinhTG);
      else luongTG = Math.round(donGiaTG * congTinhTG);
      var luongPhu = dmL ? money(dmL["Lương phụ"]) : 0;

      // Lương sản lượng + bù
      var tan = sl.tong[ma] || 0, donGiaSL = dmL ? money(dmL["Số tiền khoán"]) : 0;
      var luongSL = 0, luongBu = 0;
      if (laSL) {
        luongSL = Math.round(tan * donGiaSL);
        var nguong = num(dmL["ĐK_Bù lương (công tối thiểu)"]), giaBu = money(dmL["Đơn giá bù lương"]);
        if (buTheoNgay) {
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
      var luongBD = Math.round(xe * giaBD);

      // Tăng ca
      var dmT = dmTC[ns["Mã tăng ca"]] || null, tienTC = 0;
      if (cChuan > 0) {
        if (maTL1 === "CN1" || maTL1 === "CN2") tienTC = Math.round(luongTT * c.congTangCa);
        else if (ns["Mã tăng ca"] === "TC5" && dmT) tienTC = Math.round(money(dmT["Tiền tăng ca (nếu tính cố định)"]) / cChuan * c.congTangCa);
        else if (dmT) tienTC = Math.round(donGiaTG * heSoTangCa(ns["Mã tăng ca"], c.tongCong, c.congTrungChuyen, c.congLe, cChuan, c.congChuNhat, c.congTangCa, pct(dmT["Hệ số tăng ca"]), c.congPhep, c.congDiChuyen));
      }

      // Phụ cấp
      var pc = dmPC[ns["Mã phụ cấp"]], tienPC = 0;
      if (pc) {
        var soPC = money(pc["Số tiền"]);
        var coDinh = /cố định/i.test(String(pc["Cách tính"] || "")) || !pc["Cách tính"];
        if (coDinh) tienPC = soPC || Math.round(luongTT * pct(pc["Tỷ lệ"]));
        else if (cChuan > 0) { var du = cChuan - num(pc["Tham chiếu"]); tienPC = c.tongCong >= du ? soPC : Math.round(soPC / cChuan * c.tongCong); }
      }
      // Hỗ trợ lương (Mã hỗ trợ 2) & tiền cơm (Mã hỗ trợ)
      var ht2 = dmHT[ns["Mã hỗ trợ 2"]], luongHT = 0;
      if (ht2 && cChuan > 0 && c.tongCong - cChuan <= 0) luongHT = Math.round((cChuan - c.tongCong) * money(ht2["Số tiền"]));
      var ht1 = dmHT[ns["Mã hỗ trợ"]], ngayCom = (c.congCom || 0) + (comMap[ma] || 0);
      var tienCom = ht1 ? Math.round(ngayCom * money(ht1["Số tiền"])) : 0;
      // Phụ cấp công tác theo nhãn chấm công
      var dem = {}, pcCT = 0;
      Object.keys(c.nhanTheoNgay).forEach(function (k) { var n = c.nhanTheoNgay[k]; if (n) dem[n] = (dem[n] || 0) + 1; });
      Object.keys(dem).forEach(function (n) { if (dmPC[n]) pcCT += dem[n] * money(dmPC[n]["Số tiền"]); });

      var p = ps[ma] || { "Thưởng": 0, "Thu nhập khác": 0, "Trừ khác": 0 }, u = ung[ma] || { "Tạm ứng": 0 };
      var tongTN = luongTG + luongPhu + luongSL + luongBu + luongBD + tienTC + tienPC + pcCT + luongHT + tienCom + p["Thưởng"] + p["Thu nhập khác"];

      // BHXH
      var bh = dmBH[ns["Mã BHXH"]], luongBH = money(ns["Lương cơ bản"]) || luongTT, bhNLD = 0, truyThu = 0;
      if (bh && luongBH > 0 && luongBH < 1000) out.canhbao.push(ma + ": lương đóng BH = " + luongBH + "đ — quá nhỏ, kiểm tra lại 'Lương cơ bản' trong phụ lục hợp đồng");
      if (bh) {
        var tlNLD = num(bh["NLD.BHXH"]) + num(bh["NLD.BHYT"]) + num(bh["NLD.BHTN"]);
        var ng = dmL ? num(dmL["Ngưỡng truy thu BH (công)"]) : 0;
        var du2 = !ng || c.tongCong >= ng;
        var ctyDong = Math.round(luongBH * (num(bh["DN.BHXH"]) + num(bh["DN.BHYT"]) + num(bh["DN.BHTN"]) + num(bh["DN.KPCD"])));
        if (du2) bhNLD = Math.round(luongBH * tlNLD); else truyThu = ctyDong;
        out.bhxh.push({
          "Mã NV": ma, "Họ và tên": ns["Họ và tên"], "Phòng ban": (pb[ns["Mã PB"]] || {})["Tên phòng ban"] || ns["Mã PB"] || "",
          "Lương đóng BHXH": luongBH,
          "CTY.BHXH": Math.round(luongBH * num(bh["DN.BHXH"])), "CTY.BHYT": Math.round(luongBH * num(bh["DN.BHYT"])),
          "CTY.BHTN": Math.round(luongBH * num(bh["DN.BHTN"])), "CTY.KPCĐ": Math.round(luongBH * num(bh["DN.KPCD"])),
          "Cộng BH công ty đóng": ctyDong,
          "NLĐ.BHXH": Math.round(luongBH * num(bh["NLD.BHXH"])), "NLĐ.BHYT": Math.round(luongBH * num(bh["NLD.BHYT"])),
          "NLĐ.BHTN": Math.round(luongBH * num(bh["NLD.BHTN"])), "Cộng BH NLĐ đóng": bhNLD, "Truy thu bảo hiểm": truyThu,
          "Ghi chú": du2 ? "Đủ ngưỡng" : "Chưa đủ ngưỡng (" + c.tongCong + "/" + ng + " công)"
        });
      } else if (ns["Mã BHXH"]) out.canhbao.push(ma + ": mã BHXH '" + ns["Mã BHXH"] + "' chưa có trong Danh mục bảo hiểm");

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
      else if (kieu === "MIEN") { chiuThue = tongTN - bhNLD; }
      else {
        if (!gtBT) out.canhbao.push(ma + ": thuế lũy tiến nhưng không tìm thấy mức giảm trừ bản thân hiệu lực trong kỳ (mã '" + (ns["Mã GT_TNCN_BT"] || "") + "') — thuế có thể bị tính cao");
        if (npt > 0 && !gtPT) out.canhbao.push(ma + ": có " + npt + " người phụ thuộc nhưng không tìm thấy mức giảm trừ người phụ thuộc hiệu lực trong kỳ");
        if (!bieu.length) out.canhbao.push(ma + ": không có biểu thuế lũy tiến hiệu lực trong kỳ — thuế = 0");
        chiuThue = tongTN - bhNLD - tienCom; tinhThue = Math.max(0, chiuThue - tienGTBT - tongGTPT); thue = tinhThueLuyTien(tinhThue, bieu);
      }
      if (thue > 0) out.tncn.push({
        "Mã NV": ma, "Họ và tên": ns["Họ và tên"], "Thu nhập chịu thuế": chiuThue,
        "Giảm trừ bản thân": kieu === "VL" ? 0 : tienGTBT, "Số người phụ thuộc": npt,
        "Giảm trừ người phụ thuộc": kieu === "VL" ? 0 : tongGTPT, "Thu nhập tính thuế": tinhThue, "Thuế TNCN phải nộp": thue
      });

      var truKhac = p["Trừ khác"], tamUng = u["Tạm ứng"];
      var cl = tongTN - bhNLD - truyThu - thue - truKhac - tamUng;
      var thucLinh = cl >= 0 ? Math.round(cl / 1000) * 1000 : 0;
      if (cl < 0) out.canhbao.push(ma + ": các khoản trừ (BH, thuế, tạm ứng, trừ khác) vượt thu nhập " + Math.round(-cl).toLocaleString("vi-VN") + "đ — thực lĩnh để 0, phần còn thiếu CHƯA được chuyển sang kỳ sau, cần xử lý thủ công");
      out.bangluong.push({
        "Mã NV": ma, "Họ và tên": ns["Họ và tên"],
        "Phòng ban": (pb[ns["Mã PB"]] || {})["Tên phòng ban"] || ns["Mã PB"] || "",
        "Chức vụ": (cv[ns["Mã CV"]] || {})["Tên chức vụ"] || ns["Mã CV"] || "",
        "Lương thỏa thuận": luongTT, "Công chuẩn": cChuan, "Tổng công": c.tongCong, "Công CN": c.congChuNhat, "Công tăng ca": c.congTangCa,
        "Lương thời gian": luongTG, "Lương phụ": luongPhu, "Sản lượng (tấn)": Math.round(tan * 1000) / 1000, "Lương sản lượng": luongSL,
        "Lương bù SL": luongBu, "Số xe bơm dăm": xe, "Lương bơm dăm": luongBD, "Tiền tăng ca": tienTC,
        "Phụ cấp": tienPC, "Phụ cấp công tác": pcCT, "Lương hỗ trợ": luongHT, "Ngày cơm": ngayCom, "Tiền cơm": tienCom,
        "Thưởng": p["Thưởng"], "Thu nhập khác": p["Thu nhập khác"], "Tổng thu nhập": tongTN,
        "BH trừ NLĐ": bhNLD, "Truy thu BH": truyThu, "Thuế TNCN": thue, "Trừ khác": truKhac, "Tạm ứng": tamUng, "Thực lĩnh": thucLinh
      });
    });
    return out;
  }

  var ENGINE_VERSION = "1.4.0";
  var api = { ENGINE_VERSION: ENGINE_VERSION, money: money, tinhBangLuong: tinhBangLuong, tinhThueLuyTien: tinhThueLuyTien, congChuan: congChuan, tachCong: tachCong, tongHopChamCong: tongHopChamCong, num: num, pct: pct };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.LuongEngine = api;
})(typeof window !== "undefined" ? window : this);
