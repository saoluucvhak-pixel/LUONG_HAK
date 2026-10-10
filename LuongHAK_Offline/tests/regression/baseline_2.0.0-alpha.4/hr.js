// ===== MODULE NHÂN SỰ (offline) — chuyển mô hình từ repo QL_NHANSU =====
// Hồ sơ nhân viên gồm các bảng con gắn theo "Mã NV"; các bảng thuộc hợp đồng gắn thêm "Số HĐLĐ".
// Lương của kỳ được lấy từ CHI TIẾT HỢP ĐỒNG / PHỤ LỤC đang hiệu lực trong kỳ (giống QL_NHANSU).
(function (root) {
  "use strict";

  // t: text | date | dt (ngày giờ) | num | money | pct | sel | ref | multi | yesno | area
  var HR = {
    nhanvien: { ten: "Nhân viên", icon: "👤", f: [
      { k: "Mã NV", req: 1 }, { k: "Họ và tên", req: 1 }, { k: "Số CCCD" }, { k: "Ngày tạo hồ sơ", t: "date" },
      { k: "Trạng thái", t: "sel", o: ["Đang làm việc", "Tạm hoãn HĐLĐ", "Đã nghỉ việc"], req: 1 }] },
    canhan: { ten: "Thông tin cá nhân", icon: "🪪", lv: "nv", f: [
      { k: "Số CCCD", req: 1 }, { k: "Ngày cấp", t: "date" }, { k: "Nơi cấp" }, { k: "Ngày sinh", t: "date", req: 1 },
      { k: "Giới tính", t: "sel", o: ["Nam", "Nữ", "Khác"], req: 1 }, { k: "Quốc tịch" }, { k: "Dân tộc" },
      { k: "Tình trạng hôn nhân", t: "sel", o: ["Độc thân", "Đã kết hôn", "Ly hôn", "Khác"] },
      { k: "Thường trú" }, { k: "Địa chỉ hiện tại" }, { k: "Số điện thoại" }, { k: "Email" }, { k: "Mã số thuế" }, { k: "Số sổ BHXH" },
      { k: "Hiệu lực từ", t: "date", req: 1 }],
      cols: ["Số CCCD", "Ngày sinh", "Giới tính", "Số điện thoại", "Hiệu lực từ"], desc: "Khi đổi CCCD/địa chỉ… thêm dòng mới với 'Hiệu lực từ' mới, dòng cũ giữ làm lịch sử." },
    hocvan: { ten: "Trình độ học vấn", icon: "🎓", lv: "nv", f: [
      { k: "Trình độ học vấn", req: 1 }, { k: "Chuyên môn" }, { k: "Bằng cấp" }, { k: "Ngày cấp bằng", t: "date" }, { k: "Số hồ sơ" }, { k: "File hồ sơ (đường dẫn)" }] },
    nhanthan: { ten: "Nhân thân / Người phụ thuộc", icon: "👪", lv: "nv", f: [
      { k: "Họ tên nhân thân", req: 1 }, { k: "Quan hệ", t: "sel", o: ["Vợ/Chồng", "Con", "Cha", "Mẹ", "Khác"], req: 1 },
      { k: "Ngày sinh", t: "date" }, { k: "Số CCCD nhân thân" }, { k: "Mã số thuế" },
      { k: "Đăng ký phụ thuộc", t: "yesno", req: 1 }, { k: "Hiệu lực từ", t: "date", req: 1 }, { k: "Hiệu lực đến", t: "date" }],
      cols: ["Họ tên nhân thân", "Quan hệ", "Đăng ký phụ thuộc", "Hiệu lực từ", "Hiệu lực đến"],
      desc: "Người có 'Đăng ký phụ thuộc = Có' và còn hiệu lực trong kỳ sẽ được tính giảm trừ gia cảnh khi tính thuế TNCN." },
    thanhtoan: { ten: "Tài khoản nhận lương", icon: "🏦", lv: "nv", f: [
      { k: "Số tài khoản", req: 1 }, { k: "Tên ngân hàng", req: 1 }, { k: "Chi nhánh" }, { k: "Hiệu lực từ", t: "date", req: 1 }] },
    suckhoe: { ten: "Sức khỏe", icon: "❤️", lv: "nv", f: [{ k: "Tình trạng", req: 1 }, { k: "Tiền sử bệnh", t: "area" }, { k: "Hiệu lực từ", t: "date" }] },
    lienhe: { ten: "Liên hệ khẩn cấp", icon: "📞", lv: "nv", f: [
      { k: "Người liên hệ", req: 1 }, { k: "Quan hệ" }, { k: "Số điện thoại", req: 1 }, { k: "Địa chỉ liên hệ" }, { k: "Email" }, { k: "Ghi chú", t: "area" }] },
    nghenghiep: { ten: "Nghề nghiệp trước đây", icon: "💼", lv: "nv", f: [
      { k: "Từ ngày", t: "date" }, { k: "Đến ngày", t: "date" }, { k: "Tên công ty", req: 1 }, { k: "Vị trí đảm nhiệm" }, { k: "Chuyên môn" }, { k: "Lý do nghỉ" }] },
    congtac: { ten: "Quá trình công tác", icon: "🔀", lv: "nv", f: [
      { k: "Từ ngày", t: "date", req: 1 }, { k: "Đến ngày", t: "date" }, { k: "Phòng ban", t: "ref", ref: "dm_phongban", req: 1 }, { k: "Chức vụ", t: "ref", ref: "dm_chucvu", req: 1 },
      { k: "Loại biến động", t: "sel", o: ["Tuyển mới", "Bổ nhiệm", "Điều chuyển", "Điều động", "Thăng chức", "Giáng chức"], req: 1 }, { k: "Số quyết định" }, { k: "Ghi chú", t: "area" }] },
    hopdong: { ten: "Hợp đồng lao động", icon: "📄", lv: "nv", f: [
      { k: "Số HĐLĐ", req: 1 }, { k: "Hình thức HĐLĐ", t: "sel", o: ["Thử việc", "Xác định thời hạn", "Không xác định thời hạn", "Thời vụ"], req: 1 },
      { k: "Ngày vào làm", t: "date", req: 1 }, { k: "Ngày hết hạn", t: "date", hint: "Để trống nếu không xác định thời hạn" },
      { k: "Ngày chấm dứt", t: "date", hint: "Ngày nghỉ việc thực tế — từ tháng sau sẽ không tính lương" }, { k: "Ghi chú", t: "area" }],
      cols: ["Số HĐLĐ", "Hình thức HĐLĐ", "Ngày vào làm", "Ngày hết hạn", "Ngày chấm dứt"] },
    // ---- Bảng thuộc hợp đồng ----
    chitiethd: { ten: "Lương & phụ lục HĐ", icon: "📑", lv: "hd", f: [
      { k: "Mã công tác", hint: "Số hiệu phụ lục, VD: HD001-PL01" }, { k: "Loại phụ lục", t: "sel", o: ["Hợp đồng gốc", "Phụ lục sửa đổi"], req: 1 },
      { k: "Hiệu lực từ", t: "date", req: 1, hint: "Lương từ tháng này trở đi lấy theo dòng này" },
      { k: "Phòng ban", t: "ref", ref: "dm_phongban", req: 1 }, { k: "Chức vụ", t: "ref", ref: "dm_chucvu" },
      { k: "Mã hình thức lương", t: "sel", o: ["LTG", "LSP"], req: 1, hint: "LTG = thời gian, LSP = sản phẩm" },
      { k: "Mã lương", t: "multi", ref: "dm_luong", req: 1, hint: "Chọn 1–2 mã. Mã thứ 2 dùng cho bơm dăm (BD) nếu có" },
      { k: "Lương cơ bản", t: "money", hint: "Mức đóng BHXH" }, { k: "Lương thỏa thuận", t: "money", req: 1, hint: "Lương tháng; với mã CN1/CN2/SP là đơn giá 1 công" },
      { k: "HTTT", t: "sel", o: ["Chuyển khoản", "Tiền mặt"], req: 1, label: "Hình thức trả lương" },
      { k: "Mức đóng bảo hiểm", t: "ref", ref: "dm_baohiem", req: 1 }, { k: "Thuế TNCN", t: "ref", ref: "dm_tncn", req: 1 },
      { k: "Phụ cấp", t: "ref", ref: "dm_phucap" }, { k: "Hỗ trợ", t: "multi", ref: "dm_hotro" }, { k: "Tăng ca", t: "ref", ref: "dm_tangca" },
      { k: "Ghi chú", t: "area" }],
      cols: ["Loại phụ lục", "Hiệu lực từ", "Phòng ban", "Chức vụ", "Mã lương", "Lương thỏa thuận", "Mức đóng bảo hiểm", "Thuế TNCN"],
      desc: "Mỗi lần tăng lương / đổi vị trí: thêm 1 dòng 'Phụ lục sửa đổi' với 'Hiệu lực từ' mới. Khi tính lương, app tự lấy dòng mới nhất có hiệu lực trong kỳ." },
    khamsk: { ten: "Khám sức khỏe", icon: "🩺", lv: "hd", f: [
      { k: "Số giấy khám" }, { k: "Hình thức khám", t: "sel", o: ["Tại công ty", "Cá nhân chủ động"] }, { k: "Ngày khám", t: "date", req: 1 }, { k: "Kết quả", req: 1 }] },
    quyenloiphep: { ten: "Quyền lợi phép", icon: "🏖️", lv: "hd", f: [
      { k: "Năm áp dụng", t: "num", req: 1 }, { k: "Số ngày được cấp", t: "num", req: 1 }, { k: "Số ngày cộng dồn năm trước", t: "num" }, { k: "Ghi chú", t: "area" }] },
    nghiphep: { ten: "Nghỉ phép", icon: "🌴", lv: "hd", f: [
      { k: "Từ ngày", t: "date", req: 1 }, { k: "Đến ngày", t: "date", req: 1 }, { k: "Số ngày nghỉ", t: "num", req: 1 },
      { k: "Trạng thái duyệt", t: "sel", o: ["Chờ duyệt", "Đã duyệt", "Từ chối"], req: 1 }, { k: "Người duyệt" }, { k: "Ghi chú", t: "area" }] },
    nghiom: { ten: "Nghỉ ốm", icon: "🤒", lv: "hd", f: [
      { k: "Từ ngày", t: "date", req: 1 }, { k: "Đến ngày", t: "date", req: 1 }, { k: "Số ngày nghỉ", t: "num", req: 1 },
      { k: "Có giấy chứng nhận BHXH", t: "yesno" }, { k: "Số giấy chứng nhận" },
      { k: "Trạng thái duyệt", t: "sel", o: ["Chờ duyệt", "Đã duyệt", "Từ chối"], req: 1 }, { k: "Ghi chú", t: "area" }] },
    noiquy: { ten: "Nội quy / Kỷ luật", icon: "⚠️", lv: "hd", f: [
      { k: "Ngày", t: "date", req: 1 }, { k: "Nội dung vi phạm", t: "area", req: 1 },
      { k: "Tình trạng xử lý", t: "sel", o: ["Chưa xử lý", "Đang xử lý", "Đã xử lý"], req: 1 }, { k: "Nội dung xử lý", t: "area" }] },
    khenthuong: { ten: "Khen thưởng", icon: "🏆", lv: "hd", f: [
      { k: "Ngày", t: "date", req: 1 }, { k: "Hình thức khen thưởng", req: 1 }, { k: "Lý do", t: "area" }, { k: "Giá trị tiền thưởng", t: "money" }, { k: "Ghi chú", t: "area" }],
      desc: "Chỉ để lưu hồ sơ. Muốn cộng tiền vào lương tháng, nhập thêm ở mục Thưởng / Trừ." },
    tailieu: { ten: "Tài liệu", icon: "📎", lv: "hd", f: [
      { k: "Loại tài liệu", t: "sel", o: ["CCCD", "Giấy khám sức khỏe", "Bằng cấp", "Hợp đồng", "Khác"], req: 1 }, { k: "Tên tài liệu", req: 1 },
      { k: "Đường dẫn file", hint: "VD: D:\\HoSo\\NV001\\cccd.pdf (file lưu trên máy, app chỉ ghi đường dẫn)" }, { k: "Ngày tài liệu", t: "date" }, { k: "Ghi chú", t: "area" }] }
  };
  var NV_TABS = ["canhan", "hopdong", "nhanthan", "thanhtoan", "congtac", "hocvan", "suckhoe", "lienhe", "nghenghiep"];
  var HD_TABS = ["chitiethd", "quyenloiphep", "nghiphep", "nghiom", "khamsk", "khenthuong", "noiquy", "tailieu"];
  Object.keys(HR).forEach(function (k) {
    var c = HR[k];
    c.key = k; c.hr = true;
    c.cols = c.cols || c.f.slice(0, 5).map(function (x) { return x.k; });
    // cột lưu trữ / xuất nhập Excel
    c.store = (k === "nhanvien" ? [] : (c.lv === "hd" ? ["Mã NV", "Số HĐLĐ"] : ["Mã NV"])).concat(c.f.map(function (x) { return x.k; }));
  });

  // Tham chiếu danh mục: [cột mã, cột tên]
  var REFS = {
    dm_phongban: ["Mã phòng ban", "Tên phòng ban"], dm_chucvu: ["Mã chức vụ", "Tên chức vụ"], dm_luong: ["Mã lương", "Hình thức lương"],
    dm_baohiem: ["Mã bảo hiểm", "Nội dung"], dm_tncn: ["Mã thuế TNCN", "Nội dung"], dm_phucap: ["Mã phụ cấp", "Tên phụ cấp"],
    dm_hotro: ["Mã hỗ trợ", "Tên hỗ trợ"], dm_tangca: ["Mã tăng ca", "Nội dung tăng ca"]
  };

  // ---------- tiện ích ngày ----------
  function iso(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function today() { return iso(new Date()); }
  function d10(s) { return String(s || "").slice(0, 10); }
  function kyBounds(nam, thang) { return { dau: iso(new Date(nam, thang - 1, 1)), cuoi: iso(new Date(nam, thang, 0)) }; }
  function split(v) { return String(v || "").split(/[,;]/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function rowsOf(db, k, ma) { return (db[k] || []).filter(function (r) { return r["Mã NV"] === ma; }); }
  function latestBy(rows, field, onOrBefore) {
    var best = null;
    rows.forEach(function (r) { var v = d10(r[field]); if (onOrBefore && v && v > onOrBefore) return; if (!best || v >= d10(best[field])) best = r; });
    return best;
  }
  function refName(db, ref, code) {
    var c = REFS[ref]; if (!c || !code) return code || "";
    var hit = null; (db[ref] || []).forEach(function (r) { if (r[c[0]] === code) hit = r; });
    return hit ? (hit[c[1]] || code) : code;
  }

  // Hợp đồng có hiệu lực trong khoảng [dau, cuoi]
  function activeHD(db, ma, dau, cuoi) {
    var list = rowsOf(db, "hopdong", ma).filter(function (h) {
      var vao = d10(h["Ngày vào làm"]), cd = d10(h["Ngày chấm dứt"]);
      return (!vao || vao <= cuoi) && (!cd || cd >= dau);
    });
    return latestBy(list, "Ngày vào làm");
  }
  function chiTietHD(db, ma, soHD, asOf) {
    return latestBy((db.chitiethd || []).filter(function (r) { return r["Mã NV"] === ma && r["Số HĐLĐ"] === soHD; }), "Hiệu lực từ", asOf);
  }
  function soNguoiPhuThuoc(db, ma, dau, cuoi) {
    return rowsOf(db, "nhanthan", ma).filter(function (r) {
      if (r["Đăng ký phụ thuộc"] !== "Có") return false;
      var tu = d10(r["Hiệu lực từ"]), den = d10(r["Hiệu lực đến"]);
      return (!tu || tu <= cuoi) && (!den || den >= dau);
    }).length;
  }
  /** Thông tin hiện hành của 1 nhân viên tại ngày asOf (mặc định hôm nay). */
  function hienHanh(db, ma, asOf) {
    asOf = asOf || today();
    var hd = activeHD(db, ma, asOf, asOf) || latestBy(rowsOf(db, "hopdong", ma), "Ngày vào làm");
    var ct = hd ? chiTietHD(db, ma, hd["Số HĐLĐ"], asOf) || chiTietHD(db, ma, hd["Số HĐLĐ"]) : null;
    var cn = latestBy(rowsOf(db, "canhan", ma), "Hiệu lực từ", asOf) || latestBy(rowsOf(db, "canhan", ma), "Hiệu lực từ");
    var tk = latestBy(rowsOf(db, "thanhtoan", ma), "Hiệu lực từ", asOf) || latestBy(rowsOf(db, "thanhtoan", ma), "Hiệu lực từ");
    var mv = latestBy(rowsOf(db, "congtac", ma), "Từ ngày", asOf);
    var pb = ct ? ct["Phòng ban"] : (mv ? mv["Phòng ban"] : "");
    var cv = ct && ct["Chức vụ"] ? ct["Chức vụ"] : (mv ? mv["Chức vụ"] : "");
    return { hd: hd, ct: ct, cn: cn, tk: tk, pb: pb, cv: cv, tenPB: refName(db, "dm_phongban", pb), tenCV: refName(db, "dm_chucvu", cv) };
  }

  /** Dựng danh sách nhân sự tính lương của kỳ (dạng cột mà engine.js dùng) từ hồ sơ + hợp đồng. */
  function staffForPayroll(db, nam, thang) {
    var b = kyBounds(nam, thang), out = [], warn = [];
    var gtCodes = (db.dm_giamtru || []).map(function (r) { return r["Mã giảm trừ"]; });
    var gtBT = gtCodes.filter(function (c) { return /^GTBT|^BT$/i.test(c); })[0] || "";
    var gtPT = gtCodes.filter(function (c) { return /^GTNPT|^PT$/i.test(c); })[0] || "";
    var hotroInfo = {}; (db.dm_hotro || []).forEach(function (r) { hotroInfo[r["Mã hỗ trợ"]] = r; });
    (db.nhanvien || []).forEach(function (nv) {
      var ma = nv["Mã NV"]; if (!ma) return;
      var hd = activeHD(db, ma, b.dau, b.cuoi);
      if (!hd) { if (nv["Trạng thái"] !== "Đã nghỉ việc") warn.push(ma + " (" + (nv["Họ và tên"] || "") + "): chưa có hợp đồng hiệu lực trong kỳ — không tính lương"); return; }
      var ct = chiTietHD(db, ma, hd["Số HĐLĐ"], b.cuoi);
      if (!ct) { warn.push(ma + " (" + (nv["Họ và tên"] || "") + "): hợp đồng " + hd["Số HĐLĐ"] + " chưa có dòng 'Lương & phụ lục HĐ' hiệu lực — không tính lương"); return; }
      var ml = split(ct["Mã lương"]), ht = split(ct["Hỗ trợ"]), tc = split(ct["Tăng ca"]);
      var ht1 = "", ht2 = "";
      ht.forEach(function (c) {
        var inf = hotroInfo[c] || {}, txt = String((inf["Cách tính"] || "") + " " + (inf["Tên hỗ trợ"] || ""));
        if (/công chuẩn|cơ giới|thiếu/i.test(txt) && !/cơm/i.test(txt)) { if (!ht2) ht2 = c; } else if (!ht1) ht1 = c; else if (!ht2) ht2 = c;
      });
      if (ml.length > 2) warn.push(ma + ": có " + ml.length + " mã lương, app chỉ dùng 2 mã đầu (" + ml.slice(0, 2).join(", ") + ")");
      if (tc.length > 1) warn.push(ma + ": có nhiều mã tăng ca, app dùng mã đầu " + tc[0]);
      var tk = latestBy(rowsOf(db, "thanhtoan", ma), "Hiệu lực từ", b.cuoi);
      if (nv["Trạng thái"] === "Đã nghỉ việc" && !hd["Ngày chấm dứt"]) warn.push(ma + " (" + (nv["Họ và tên"] || "") + "): trạng thái 'Đã nghỉ việc' nhưng hợp đồng " + hd["Số HĐLĐ"] + " chưa có Ngày chấm dứt — vẫn đang được tính lương");
      if (ct["HTTT"] === "Chuyển khoản" && !(tk && tk["Số tài khoản"])) warn.push(ma + " (" + (nv["Họ và tên"] || "") + "): trả lương chuyển khoản nhưng chưa có số tài khoản");
      var cn = latestBy(rowsOf(db, "canhan", ma), "Hiệu lực từ", b.cuoi);
      out.push({
        "Mã nhân viên": ma, "Họ và tên": nv["Họ và tên"], "Mã PB": ct["Phòng ban"] || "", "Mã CV": ct["Chức vụ"] || "",
        "Ngày vào làm": hd["Ngày vào làm"] || "", "Ngày nghỉ/thay đổi": hd["Ngày chấm dứt"] || "",
        "Lương cơ bản": ct["Lương cơ bản"] || "", "Lương thỏa thuận": ct["Lương thỏa thuận"] || "",
        "Mã tiền lương 1": ml[0] || "", "Mã tiền lương 2": ml[1] || "", "Mã tăng ca": tc[0] || "",
        "Mã phụ cấp": ct["Phụ cấp"] || "", "Mã hỗ trợ": ht1, "Mã hỗ trợ 2": ht2,
        "Mã BHXH": ct["Mức đóng bảo hiểm"] || "", "Mã TNCN": ct["Thuế TNCN"] || "",
        "Mã GT_TNCN_BT": gtBT, "Mã GT_TNCN_PT": gtPT, "Người phụ thuộc": soNguoiPhuThuoc(db, ma, b.dau, b.cuoi),
        "Số CCCD": (cn && cn["Số CCCD"]) || nv["Số CCCD"] || "", "Số tài khoản": tk ? tk["Số tài khoản"] : "", "Tên Ngân hàng": tk ? tk["Tên ngân hàng"] : "",
        "HTTT": ct["HTTT"] || "", "Số HĐLĐ": hd["Số HĐLĐ"]
      });
    });
    return { list: out, warn: warn };
  }

  // ---------- Danh mục chuẩn HAK (lấy từ QL_NHANSU seedRealDanhMuc) ----------
  function seedDanhMuc() {
    var N = "2025-09-01";
    var r = function (cols, rows) { return rows.map(function (v) { var o = {}; cols.forEach(function (c, i) { if (v[i] !== undefined && v[i] !== null) o[c] = v[i]; }); return o; }); };
    return {
      dm_chucvu: r(["Mã chức vụ", "Tên chức vụ", "Hiệu lực từ"], [["1", "Giám đốc", N], ["2", "Phó giám đốc", N], ["3", "Quản đốc PX", N], ["4", "Trưởng bộ phận", N], ["5", "Tổ trưởng", N], ["6", "Nhân viên bậc 1", N], ["7", "Nhân viên bậc 2", N], ["8", "Công nhân bậc 1", N], ["9", "Công nhân bậc 2", N]]),
      dm_phongban: r(["Mã khối", "Tên khối", "Mã phòng ban", "Tên phòng ban", "Hiệu lực từ"], [
        ["01", "Văn phòng", "01.01", "Văn phòng", N], ["01", "Văn phòng", "01.02", "Trạm cân", N], ["01", "Văn phòng", "01.03", "Quản đốc", N], ["01", "Văn phòng", "01.04", "Tạp vụ", N],
        ["01", "Văn phòng", "01.05", "Bảo vệ", N], ["01", "Văn phòng", "01.06", "Kinh doanh", N], ["01", "Văn phòng", "01.07", "KCS", N], ["01", "Văn phòng", "01.08", "Cơ khí", N],
        ["01", "Văn phòng", "01.09", "Cơ giới", N], ["01", "Văn phòng", "01.10", "Thủ kho", N], ["01", "Văn phòng", "01.11", "Ben hàng", N],
        ["02", "Sản xuất", "02.01", "Tổ 1 - Công nhân sản xuất", N], ["02", "Sản xuất", "02.02", "Tổ 2 - Công nhân sản xuất", N],
        ["02", "Sản xuất", "02.03", "Tổ 1 - Công nhân công nhật", N], ["02", "Sản xuất", "02.04", "Tổ 2 - Công nhân công nhật", N]]),
      dm_luong: r(["Mã lương", "Mã hình thức lương", "Hình thức lương", "Số tiền khoán", "Cách tính", "Hiệu lực từ"], [
        ["CĐ", "LTG", "Lương cố định", 0, "Cố định", N], ["TG1", "LTG", "Lương thời gian 1", 0, "Số ngày của tháng - tất cả ngày CN", N],
        ["TG2", "LTG", "Lương thời gian 2", 0, "Số ngày của tháng", N], ["TG3", "LTG", "Lương thời gian 3", 0, "Số ngày của tháng - 4", N],
        ["TG4", "LTG", "Lương thời gian 4", 0, "Số ngày của tháng - 2", N], ["CN1", "LTG", "Lương công nhật", 0, "Thực tế ngày công", N],
        ["CN2", "LTG", "Lương công nhật 2", 0, "Thực tế ngày công", N], ["SP", "LSP", "Lương sản phẩm", 6000, "Nhân với sản lượng", N],
        ["BD", "LSP", "Lương ban dăm", 10000, "Nhân với sản lượng", N]]),
      dm_phucap: r(["Mã phụ cấp", "Tên phụ cấp", "Số tiền", "Tỷ lệ", "Tham chiếu", "Cách tính", "Hiệu lực từ"], [
        ["TN.01", "Phụ cấp trách nhiệm BP Cơ khí", 300000, 0, 0, "Tổng công >= công chuẩn tính đủ 300k, nhỏ hơn =300k/công chuẩn*tổng công", N],
        ["TN.02", "Phụ cấp trách nhiệm BP SX", 200000, 0, 5, "Tổng công >= (công chuẩn-5) tính đủ 200k , nhỏ hơn =200k/công chuẩn*tổng công", N],
        ["TN.03", "Phụ cấp trách nhiệm Quản lý", 1000000, 0, 0, "Cố định hàng tháng", N], ["TN.04", "Phụ cấp trách nhiệm BP Kinh doanh", 570000, 0, 0, "Cố định hàng tháng", N],
        ["QC", "Phụ cấp công tác HAKQN", 100000, 0, 0, "", N], ["QS", "Phụ cấp công tác CNHAK", 120000, 0, 0, "", N], ["ĐH", "Phụ cấp công tác ĐH", 30000, 0, 0, "", N],
        ["ĐN", "Phụ cấp công tác Đà Nẵng", 120000, 0, 0, "", N], ["DQ", "Phụ cấp công tác DQ", 500000, 0, 0, "Phụ cấp công tác", N], ["SX", "Phụ cấp sửa xe", 200000, 0, 0, "Phụ cấp sửa xe", N]]),
      dm_tangca: r(["Mã tăng ca", "Nội dung tăng ca", "Hệ số tăng ca", "Tiền tăng ca (nếu tính cố định)", "Cách tính", "Hiệu lực từ"], [
        ["TC1", "Tăng ca tính theo tháng loại 1", 0.5, 0, "(Công tính lương- Công lễ- công trung chuyển-ngày phép-công tăng ca-công chuẩn)*hệ số tăng ca+công tăng ca*hệ số tăng ca", N],
        ["TC2", "Tăng ca tính theo tháng loại 2", 0.5, 0, "(Công tính lương- Công lễ- công trung chuyển-ngày phép-công tăng ca-công di chuyển-công chuẩn)*hệ số tăng ca+công tăng ca*hệ số tăng ca", N],
        ["TC3", "Tăng ca tính theo công và chủ nhật", 0.5, 0, "(Công tăng ca +Công chủ nhật)*hệ số tăng ca", N],
        ["TC4", "Tăng ca tính theo công", 0.5, 0, "Công tăng ca*hệ số tăng ca", N], ["TC5", "Ca làm thêm vị trí khác", 1, 6000000, "Lương làm ca khác", N]]),
      dm_hotro: r(["Mã hỗ trợ", "Tên hỗ trợ", "Số tiền", "Cách tính", "Hiệu lực từ"], [
        ["HT.01", "Tiền cơm", 20000, "Số tiền * Số ngày công", N], ["HT.02", "Hỗ trợ lương cơ giới", 150000, "Nếu công thực tế <công chuẩn = (công chuẩn - công thực tế) *150.000", N]]),
      dm_cc: r(["Mã CC", "Nội dung", "Hình thức công", "Diễn giải", "Hiệu lực từ"], [
        ["CTL", "Công tính lương", "BT", "Công hàng ngày", N], ["CTL", "Công tính lương", "PN", "Công ngày phép", N], ["CTL", "Công tính lương", "CL", "Công ngày lễ", N],
        ["CTL", "Công tính lương", "TRCH", "Công trung chuyển hàng", N], ["CTL", "Công tính lương", "DC", "Công di chuyển", N], ["CTTC", "Công tính tăng ca", "TC", "Công tăng ca", N],
        ["CTHT", "Công tính hỗ trợ", "CC", "Ngày tính tiền cơm", N], ["CTPC", "Công tính phụ cấp", "CT", "Công công tác", N]]),
      dm_baohiem: r(["Mã bảo hiểm", "Nội dung", "DN.BHXH", "DN.BHYT", "DN.BHTN", "DN.KPCD", "NLD.BHXH", "NLD.BHYT", "NLD.BHTN", "NLD.KPCD", "Hiệu lực từ"], [
        ["BH01", "Đóng đầy đủ BHXH/BHYT/BHTN/KPCĐ", 0.175, 0.03, 0.01, 0.02, 0.08, 0.015, 0.01, 0, "2020-01-01"],
        ["BH00", "Không tham gia BHXH (thử việc/thời vụ ngắn)", 0, 0, 0, 0, 0, 0, 0, 0, "2020-01-01"]]),
      dm_tncn: r(["Mã thuế TNCN", "Nội dung", "Mức thuế", "Ghi chú", "Hiệu lực từ"], [
        ["VL01", "Khấu trừ vãng lai", 0.10, "Khấu trừ 10% cho cá nhân không ký HĐLĐ hoặc HĐLĐ dưới 3 tháng (trừ khi có cam kết 08/CK-TNCN).", "2020-01-01"],
        ["LT01", "Lũy tiến", "", "Áp dụng cho HĐLĐ từ 3 tháng trở lên — xem Biểu thuế lũy tiến.", "2020-01-01"],
        ["MT00", "Miễn thuế", "", "Không khấu trừ thuế (VD: đã cam kết 08/CK-TNCN).", "2020-01-01"]]),
      dm_bacthue: r(["Bậc", "Thu nhập từ", "Thu nhập đến", "Tỷ lệ", "Hiệu lực từ", "Hiệu lực đến"], [
        [1, 0, 5000000, 0.05, "2009-01-01", "2025-12-31"], [2, 5000000, 10000000, 0.10, "2009-01-01", "2025-12-31"], [3, 10000000, 18000000, 0.15, "2009-01-01", "2025-12-31"],
        [4, 18000000, 32000000, 0.20, "2009-01-01", "2025-12-31"], [5, 32000000, 52000000, 0.25, "2009-01-01", "2025-12-31"], [6, 52000000, 80000000, 0.30, "2009-01-01", "2025-12-31"],
        [7, 80000000, 0, 0.35, "2009-01-01", "2025-12-31"],
        [1, 0, 10000000, 0.05, "2026-01-01"], [2, 10000000, 30000000, 0.10, "2026-01-01"], [3, 30000000, 60000000, 0.20, "2026-01-01"],
        [4, 60000000, 100000000, 0.30, "2026-01-01"], [5, 100000000, 0, 0.35, "2026-01-01"]]),
      dm_giamtru: r(["Mã giảm trừ", "Số người", "Số tiền", "Hiệu lực từ", "Hiệu lực đến"], [
        ["GTBT.01", 1, 11000000, "2020-07-01", "2025-12-31"], ["GTNPT.01", 1, 4400000, "2020-07-01", "2025-12-31"],
        ["GTBT.01", 1, 15500000, "2026-01-01"], ["GTNPT.01", 1, 6200000, "2026-01-01"]])
    };
  }

  var _seed = seedDanhMuc;
  seedDanhMuc = function () {
    var d = _seed();
    d.dm_phongban.forEach(function (p) { p["Tài khoản chi phí"] = p["Mã khối"] === "02" ? "622" : (/Kinh doanh/i.test(p["Tên phòng ban"]) ? "641" : "642"); });
    return d;
  };

  // ---------- Chuyển dữ liệu bản cũ ----------
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function migrate(db) {
    var msg = [];
    // 1) Biểu thuế cũ (dm_tncn dạng bậc) -> dm_bacthue
    if ((db.dm_tncn || []).some(function (r) { return r["Bậc"] !== undefined && r["Bậc"] !== ""; })) {
      if (!db.dm_bacthue || !db.dm_bacthue.length) {
        db.dm_bacthue = db.dm_tncn.filter(function (r) { return r["Bậc"] !== undefined && r["Bậc"] !== ""; }).map(function (r) {
          return { "Bậc": r["Bậc"], "Thu nhập từ": r["Thu nhập tháng (Min)"], "Thu nhập đến": r["Thu nhập tháng (Max)"], "Tỷ lệ": r["Tỷ lệ đóng thuế"], "Hiệu lực từ": r["Hiệu lực từ"], "Hiệu lực đến": r["Hiệu lực đến"] };
        });
      }
      db.dm_tncn = db.dm_tncn.filter(function (r) { return r["Mã thuế TNCN"]; });
      msg.push("Biểu thuế TNCN cũ đã chuyển sang mục 'Biểu thuế lũy tiến'");
    }
    // 2) Bảng Nhân sự phẳng của bản 1.0 -> hồ sơ + hợp đồng + phụ lục
    if (db.nhansu && db.nhansu.length) {
      db.nhanvien = db.nhanvien || [];
      ["canhan", "hopdong", "chitiethd", "thanhtoan", "nhanthan"].forEach(function (k) { db[k] = db[k] || []; });
      var have = {}; db.nhanvien.forEach(function (r) { have[r["Mã NV"]] = 1; });
      var hinhThuc = {}; (db.dm_luong || []).forEach(function (r) { hinhThuc[r["Mã lương"]] = /SP/i.test(r["Mã hình thức lương"] || "") ? "LSP" : "LTG"; });
      var n = 0;
      db.nhansu.forEach(function (o) {
        var ma = o["Mã nhân viên"]; if (!ma || have[ma]) return;
        var vao = d10(o["Ngày vào làm"]) || "2020-01-01", so = "HD-" + ma;
        db.nhanvien.push({ _id: uid(), "Mã NV": ma, "Họ và tên": o["Họ và tên"] || "", "Số CCCD": o["Số CCCD"] || "", "Ngày tạo hồ sơ": vao, "Trạng thái": o["Ngày nghỉ/thay đổi"] ? "Đã nghỉ việc" : "Đang làm việc" });
        if (o["Số CCCD"]) db.canhan.push({ _id: uid(), "Mã NV": ma, "Số CCCD": o["Số CCCD"], "Hiệu lực từ": vao });
        db.hopdong.push({ _id: uid(), "Mã NV": ma, "Số HĐLĐ": so, "Hình thức HĐLĐ": "Không xác định thời hạn", "Ngày vào làm": vao, "Ngày chấm dứt": d10(o["Ngày nghỉ/thay đổi"]), "Ghi chú": "Tạo tự động khi nâng cấp app" });
        db.chitiethd.push({ _id: uid(), "Mã NV": ma, "Số HĐLĐ": so, "Mã công tác": so + "-PL01", "Loại phụ lục": "Hợp đồng gốc", "Hiệu lực từ": vao,
          "Phòng ban": o["Mã PB"] || "", "Chức vụ": o["Mã CV"] || "", "Mã hình thức lương": hinhThuc[o["Mã tiền lương 1"]] || "LTG",
          "Mã lương": [o["Mã tiền lương 1"], o["Mã tiền lương 2"]].filter(Boolean).join(", "), "Lương cơ bản": o["Lương cơ bản"] || "", "Lương thỏa thuận": o["Lương thỏa thuận"] || "",
          "HTTT": o["Số tài khoản"] ? "Chuyển khoản" : "Tiền mặt", "Mức đóng bảo hiểm": o["Mã BHXH"] || "", "Thuế TNCN": o["Mã TNCN"] || "",
          "Phụ cấp": o["Mã phụ cấp"] || "", "Hỗ trợ": [o["Mã hỗ trợ"], o["Mã hỗ trợ 2"]].filter(Boolean).join(", "), "Tăng ca": o["Mã tăng ca"] || "" });
        if (o["Số tài khoản"]) db.thanhtoan.push({ _id: uid(), "Mã NV": ma, "Số tài khoản": o["Số tài khoản"], "Tên ngân hàng": o["Tên Ngân hàng"] || "", "Hiệu lực từ": vao });
        for (var i = 1; i <= (+o["Người phụ thuộc"] || 0); i++) db.nhanthan.push({ _id: uid(), "Mã NV": ma, "Họ tên nhân thân": "(Chưa khai tên) NPT " + i, "Quan hệ": "Khác", "Đăng ký phụ thuộc": "Có", "Hiệu lực từ": "2020-01-01" });
        n++;
      });
      db.nhansu_cu = db.nhansu; delete db.nhansu;
      if (n) msg.push(n + " nhân viên từ bản cũ đã được chuyển sang hồ sơ nhân sự mới (kèm hợp đồng + phụ lục lương)");
    }
    return msg;
  }

  // ---------- Báo cáo nhân sự ----------
  function addDays(isoS, n) { var d = new Date(isoS + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); }
  function reports(db) {
    var t = today(), nvs = db.nhanvien || [];
    var name = {}; nvs.forEach(function (n) { name[n["Mã NV"]] = n["Họ và tên"]; });
    return {
      hethan: function (soNgay) {
        var den = addDays(t, soNgay), rows = [];
        nvs.forEach(function (n) {
          if (n["Trạng thái"] === "Đã nghỉ việc") return;
          var hh = hienHanh(db, n["Mã NV"]), hd = hh.hd;
          if (!hd || !hd["Ngày hết hạn"] || hd["Ngày chấm dứt"]) return;
          var hh2 = d10(hd["Ngày hết hạn"]); if (hh2 > den) return;
          var con = Math.round((new Date(hh2) - new Date(t)) / 864e5);
          rows.push({ "Mã NV": n["Mã NV"], "Họ và tên": n["Họ và tên"], "Phòng ban": hh.tenPB, "Số HĐLĐ": hd["Số HĐLĐ"], "Hình thức HĐLĐ": hd["Hình thức HĐLĐ"], "Ngày hết hạn": hh2, "Còn (ngày)": con, "Tình trạng": con < 0 ? "ĐÃ QUÁ HẠN" : "Sắp hết hạn" });
        });
        return rows.sort(function (a, b) { return a["Còn (ngày)"] - b["Còn (ngày)"]; });
      },
      tinhhinh: function () {
        var by = function (fn) { var m = {}; nvs.forEach(function (n) { var k = fn(n) || "(chưa có)"; m[k] = (m[k] || 0) + 1; }); return Object.keys(m).sort().map(function (k) { return { "Nhóm": k, "Số người": m[k] }; }); };
        var dang = nvs.filter(function (n) { return n["Trạng thái"] !== "Đã nghỉ việc"; });
        var by2 = function (fn) { var m = {}; dang.forEach(function (n) { var k = fn(n) || "(chưa có)"; m[k] = (m[k] || 0) + 1; }); return Object.keys(m).sort().map(function (k) { return { "Nhóm": k, "Số người": m[k] }; }); };
        return {
          trangthai: by(function (n) { return n["Trạng thái"]; }),
          phongban: by2(function (n) { return hienHanh(db, n["Mã NV"]).tenPB; }),
          gioitinh: by2(function (n) { var c = hienHanh(db, n["Mã NV"]).cn; return c && c["Giới tính"]; }),
          loaihd: by2(function (n) { var h = hienHanh(db, n["Mã NV"]).hd; return h && h["Hình thức HĐLĐ"]; })
        };
      },
      nghi: function (nam) {
        var y = String(nam), rows = [];
        nvs.forEach(function (n) {
          var ma = n["Mã NV"];
          var ql = rowsOf(db, "quyenloiphep", ma).filter(function (r) { return String(r["Năm áp dụng"]) === y; });
          var cap = ql.reduce(function (a, r) { return a + (+r["Số ngày được cấp"] || 0) + (+r["Số ngày cộng dồn năm trước"] || 0); }, 0);
          var sum = function (k) { return rowsOf(db, k, ma).filter(function (r) { return d10(r["Từ ngày"]).slice(0, 4) === y && r["Trạng thái duyệt"] === "Đã duyệt"; }).reduce(function (a, r) { return a + (+r["Số ngày nghỉ"] || 0); }, 0); };
          var p = sum("nghiphep"), o = sum("nghiom");
          if (!cap && !p && !o) return;
          rows.push({ "Mã NV": ma, "Họ và tên": n["Họ và tên"], "Phép được cấp": cap, "Đã nghỉ phép": p, "Phép còn lại": cap - p, "Nghỉ ốm": o });
        });
        return rows;
      },
      vipham: function () {
        return (db.noiquy || []).filter(function (r) { return r["Tình trạng xử lý"] !== "Đã xử lý"; }).map(function (r) {
          return { "Mã NV": r["Mã NV"], "Họ và tên": name[r["Mã NV"]] || "", "Ngày": r["Ngày"], "Nội dung vi phạm": r["Nội dung vi phạm"], "Tình trạng xử lý": r["Tình trạng xử lý"] };
        });
      },
      sinhnhat: function (thang) {
        var rows = [];
        nvs.forEach(function (n) {
          if (n["Trạng thái"] === "Đã nghỉ việc") return;
          var c = hienHanh(db, n["Mã NV"]).cn, ns = c && d10(c["Ngày sinh"]);
          if (ns && +ns.slice(5, 7) === +thang) rows.push({ "Mã NV": n["Mã NV"], "Họ và tên": n["Họ và tên"], "Ngày sinh": ns, "Phòng ban": hienHanh(db, n["Mã NV"]).tenPB });
        });
        return rows.sort(function (a, b) { return a["Ngày sinh"].slice(8) < b["Ngày sinh"].slice(8) ? -1 : 1; });
      },
      soLaoDong: function () {
        return nvs.map(function (n, i) {
          var hh = hienHanh(db, n["Mã NV"]), c = hh.cn || {}, hd = hh.hd || {}, ct = hh.ct || {};
          return { "STT": i + 1, "Mã NV": n["Mã NV"], "Họ và tên": n["Họ và tên"], "Giới tính": c["Giới tính"] || "", "Ngày sinh": c["Ngày sinh"] || "",
            "Số CCCD": c["Số CCCD"] || n["Số CCCD"] || "", "Ngày cấp": c["Ngày cấp"] || "", "Nơi cấp": c["Nơi cấp"] || "", "Quốc tịch": c["Quốc tịch"] || "",
            "Thường trú": c["Thường trú"] || "", "Chỗ ở hiện tại": c["Địa chỉ hiện tại"] || "", "Số điện thoại": c["Số điện thoại"] || "",
            "Trình độ": (latestBy(rowsOf(db, "hocvan", n["Mã NV"]), "Ngày cấp bằng") || {})["Trình độ học vấn"] || "",
            "Phòng ban": hh.tenPB, "Chức vụ": hh.tenCV, "Số HĐLĐ": hd["Số HĐLĐ"] || "", "Loại HĐLĐ": hd["Hình thức HĐLĐ"] || "",
            "Ngày vào làm": hd["Ngày vào làm"] || "", "Ngày hết hạn": hd["Ngày hết hạn"] || "", "Ngày chấm dứt": hd["Ngày chấm dứt"] || "",
            "Lương cơ bản": +ct["Lương cơ bản"] || "", "Lương thỏa thuận": +ct["Lương thỏa thuận"] || "", "Số sổ BHXH": c["Số sổ BHXH"] || "", "Trạng thái": n["Trạng thái"] };
        });
      },
      lichsu: function (ma) {
        var ev = [];
        Object.keys(HR).forEach(function (k) {
          if (k === "nhanvien") return;
          rowsOf(db, k, ma).forEach(function (r) {
            var d = d10(r["Hiệu lực từ"] || r["Ngày vào làm"] || r["Từ ngày"] || r["Ngày"] || r["Ngày khám"] || r["Ngày cấp bằng"] || r["Ngày tài liệu"] || "");
            var tom = HR[k].cols.map(function (c) { return r[c] ? c + ": " + r[c] : ""; }).filter(Boolean).join(" · ");
            ev.push({ "Ngày": d, "Loại hồ sơ": HR[k].ten, "Nội dung": tom });
          });
        });
        return ev.sort(function (a, b) { return a["Ngày"] < b["Ngày"] ? 1 : -1; });
      }
    };
  }

  var api = { HR: HR, NV_TABS: NV_TABS, HD_TABS: HD_TABS, REFS: REFS, refName: refName, hienHanh: hienHanh, staffForPayroll: staffForPayroll,
    seedDanhMuc: seedDanhMuc, migrate: migrate, reports: reports, uid: uid, today: today, split: split, activeHD: activeHD };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.HRM = api;
})(typeof window !== "undefined" ? window : this);
