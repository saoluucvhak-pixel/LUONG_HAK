// ===== MODULE NHÂN SỰ (offline) — chuyển mô hình từ repo QL_NHANSU =====
// Hồ sơ nhân viên gồm các bảng con gắn theo "Mã NV"; các bảng thuộc hợp đồng gắn thêm "Số HĐLĐ".
// Lương của kỳ được lấy từ CHI TIẾT HỢP ĐỒNG / PHỤ LỤC đang hiệu lực trong kỳ (giống QL_NHANSU).
(function (root) {
  "use strict";

  // t: text | date | dt (ngày giờ) | num | money | pct | sel | ref | multi | yesno | area
  // Loại biến động nhân sự ghi trên phụ lục (2.0-α15) — chỉ để theo dõi / báo cáo, KHÔNG dùng trong công thức lương
  var BIEN_DONG = ["Tăng lương", "Giảm lương", "Điều chuyển phòng ban", "Bổ nhiệm / đổi chức vụ", "Điều chỉnh mức đóng BH", "Khác"];
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
      { k: "Trình độ học vấn", req: 1 }, { k: "Chuyên môn" }, { k: "Bậc trình độ kỹ năng nghề", hint: "Sổ quản lý lao động (NĐ 145/2020 Đ3): VD Bậc 3/7, Thợ bậc 4…" }, { k: "Bằng cấp" }, { k: "Ngày cấp bằng", t: "date" }, { k: "Số hồ sơ" }, { k: "File hồ sơ (đường dẫn)" }] },
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
      { k: "Ngày chấm dứt", t: "date", hint: "Ngày nghỉ việc thực tế — từ tháng sau sẽ không tính lương" },
      { k: "Lý do chấm dứt", t: "sel", o: ["Hết hạn hợp đồng", "Đã hoàn thành công việc theo hợp đồng", "Hai bên thỏa thuận chấm dứt", "Người lao động đơn phương chấm dứt", "Người sử dụng lao động đơn phương chấm dứt",
        "Kỷ luật sa thải", "Cho thôi việc do thay đổi cơ cấu, công nghệ / lý do kinh tế", "Nghỉ hưu", "Thử việc không đạt", "Người lao động chết / mất năng lực hành vi dân sự", "Lý do khác"], hint: "Sổ quản lý lao động: thời điểm chấm dứt HĐLĐ và lý do" },
      { k: "Ghi chú", t: "area" }],
      cols: ["Số HĐLĐ", "Hình thức HĐLĐ", "Ngày vào làm", "Ngày hết hạn", "Ngày chấm dứt"] },
    // ---- Bảng thuộc hợp đồng ----
    chitiethd: { ten: "Lương & phụ lục HĐ", icon: "📑", lv: "hd", f: [
      { k: "Mã công tác", hint: "Số hiệu phụ lục, VD: HD001-PL01" }, { k: "Loại phụ lục", t: "sel", o: ["Hợp đồng gốc", "Phụ lục sửa đổi"], req: 1 },
      { k: "Loại biến động", t: "sel", o: BIEN_DONG, hint: "Để trống: báo cáo biến động tự nhận biết khi so với phụ lục trước" }, { k: "Số quyết định" },
      { k: "Hiệu lực từ", t: "date", req: 1, hint: "Lương từ tháng này trở đi lấy theo dòng này" },
      { k: "Cách áp dụng trong tháng hiệu lực", t: "sel", o: ["Cả tháng", "Từ ngày hiệu lực"], hint: "Q-22: hiệu lực giữa tháng — 'Cả tháng' = cả tháng theo mức mới; 'Từ ngày hiệu lực' = công trước ngày hiệu lực tính mức cũ, từ ngày hiệu lực tính mức mới. Để trống = Cả tháng" },
      { k: "Phòng ban", t: "ref", ref: "dm_phongban", req: 1 }, { k: "Chức vụ", t: "ref", ref: "dm_chucvu" },
      { k: "Vị trí việc làm", hint: "Sổ quản lý lao động: VD Kế toán tổng hợp, Thợ vận hành máy dăm, Lái xe xúc…" },
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
      { k: "Loại nghỉ", t: "sel", o: ["Nghỉ hằng năm", "Nghỉ việc riêng có hưởng lương", "Nghỉ không hưởng lương"], hint: "Để trống = Nghỉ hằng năm (trừ vào phép năm)" },
      { k: "Từ ngày", t: "date", req: 1 }, { k: "Đến ngày", t: "date", req: 1 }, { k: "Số ngày nghỉ", t: "num", req: 1 },
      { k: "Trạng thái duyệt", t: "sel", o: ["Chờ duyệt", "Đã duyệt", "Từ chối"], req: 1 }, { k: "Người duyệt" }, { k: "Ghi chú", t: "area" }] },
    nghiom: { ten: "Nghỉ ốm", icon: "🤒", lv: "hd", f: [
      { k: "Từ ngày", t: "date", req: 1 }, { k: "Đến ngày", t: "date", req: 1 }, { k: "Số ngày nghỉ", t: "num", req: 1 },
      { k: "Có giấy chứng nhận BHXH", t: "yesno" }, { k: "Số giấy chứng nhận" },
      { k: "Trạng thái duyệt", t: "sel", o: ["Chờ duyệt", "Đã duyệt", "Từ chối"], req: 1 }, { k: "Ghi chú", t: "area" }] },
    noiquy: { ten: "Nội quy / Kỷ luật", icon: "⚠️", lv: "hd", f: [
      { k: "Ngày", t: "date", req: 1 }, { k: "Nội dung vi phạm", t: "area", req: 1 },
      { k: "Tình trạng xử lý", t: "sel", o: ["Chưa xử lý", "Đang xử lý", "Đã xử lý"], req: 1 },
      { k: "Hình thức kỷ luật", t: "sel", o: ["Khiển trách", "Kéo dài thời hạn nâng lương không quá 06 tháng", "Cách chức", "Sa thải"], hint: "Để trống nếu chưa / không kỷ luật" },
      { k: "Bồi thường thiệt hại (trách nhiệm vật chất)", t: "money" }, { k: "Nội dung xử lý", t: "area" }] },
    khenthuong: { ten: "Khen thưởng", icon: "🏆", lv: "hd", f: [
      { k: "Ngày", t: "date", req: 1 }, { k: "Hình thức khen thưởng", req: 1 }, { k: "Lý do", t: "area" }, { k: "Giá trị tiền thưởng", t: "money" }, { k: "Ghi chú", t: "area" }],
      desc: "Chỉ để lưu hồ sơ. Muốn cộng tiền vào lương tháng, nhập thêm ở mục Thưởng / Trừ." },
    // ---- Bổ sung theo nội dung sổ quản lý lao động (NĐ 145/2020/NĐ-CP Điều 3 khoản 2) ----
    daotao: { ten: "Đào tạo / nâng cao trình độ", icon: "🎓", lv: "nv", f: [
      { k: "Từ ngày", t: "date", req: 1 }, { k: "Đến ngày", t: "date" },
      { k: "Hình thức", t: "sel", o: ["Đào tạo", "Bồi dưỡng", "Nâng cao trình độ kỹ năng nghề", "Đào tạo lại", "Khác"], req: 1 },
      { k: "Nội dung", req: 1 }, { k: "Đơn vị đào tạo" }, { k: "Chứng chỉ / văn bằng" }, { k: "Ghi chú", t: "area" }],
      cols: ["Từ ngày", "Đến ngày", "Hình thức", "Nội dung", "Chứng chỉ / văn bằng"] },
    tainanld: { ten: "Tai nạn lao động / Bệnh nghề nghiệp", icon: "🚑", lv: "nv", f: [
      { k: "Ngày", t: "date", req: 1 }, { k: "Loại", t: "sel", o: ["Tai nạn lao động", "Bệnh nghề nghiệp"], req: 1 },
      { k: "Nội dung", t: "area", req: 1 }, { k: "Mức suy giảm khả năng lao động (%)", t: "num" }, { k: "Chế độ đã giải quyết", t: "area" }, { k: "Ghi chú", t: "area" }],
      cols: ["Ngày", "Loại", "Nội dung", "Mức suy giảm khả năng lao động (%)", "Chế độ đã giải quyết"] },
    tailieu: { ten: "Tài liệu", icon: "📎", lv: "hd", f: [
      { k: "Loại tài liệu", t: "sel", o: ["CCCD", "Giấy khám sức khỏe", "Bằng cấp", "Hợp đồng", "Khác"], req: 1 }, { k: "Tên tài liệu", req: 1 },
      { k: "Đường dẫn file", hint: "VD: D:\\HoSo\\NV001\\cccd.pdf (file lưu trên máy, app chỉ ghi đường dẫn)" }, { k: "Ngày tài liệu", t: "date" }, { k: "Ghi chú", t: "area" }] }
  };
  var NV_TABS = ["canhan", "hopdong", "nhanthan", "thanhtoan", "congtac", "hocvan", "daotao", "suckhoe", "tainanld", "lienhe", "nghenghiep"];
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
  // Chỉ mục theo Mã NV (PERF-01): dựng 1 lần cho mỗi lượt tính → O(N) thay vì quét cả bảng cho từng nhân viên.
  // Giữ đúng THỨ TỰ dòng như bảng gốc để latestBy() chọn cùng 1 dòng khi trùng ngày (kết quả giống hệt bản quét).
  function buildIndex(db) {
    var by = {}, cache = {}; // Map: so khớp đúng kiểu như ===, an toàn với mã lạ (VD "__proto__")
    return {
      rows: function (k, ma) {
        var m = by[k];
        if (!m) { m = by[k] = new Map(); (db[k] || []).forEach(function (r) { var key = r["Mã NV"], a = m.get(key); if (a) a.push(r); else m.set(key, [r]); }); }
        return m.get(ma) || [];
      },
      ref: function (ref, code) {
        var c = REFS[ref], m = cache[ref];
        if (!m) { m = cache[ref] = new Map(); (db[ref] || []).forEach(function (r) { m.set(r[c[0]], r); }); } // dòng sau ghi đè dòng trước = như bản quét
        return m.has(code) ? m.get(code) : null;
      }
    };
  }
  function rowsOf(db, k, ma, ix) { return ix ? ix.rows(k, ma) : (db[k] || []).filter(function (r) { return r["Mã NV"] === ma; }); }
  function latestBy(rows, field, onOrBefore) {
    var best = null;
    rows.forEach(function (r) { var v = d10(r[field]); if (onOrBefore && v && v > onOrBefore) return; if (!best || v >= d10(best[field])) best = r; });
    return best;
  }
  function refName(db, ref, code, ix) {
    var c = REFS[ref]; if (!c || !code) return code || "";
    var hit = null;
    if (ix) hit = ix.ref(ref, code); else (db[ref] || []).forEach(function (r) { if (r[c[0]] === code) hit = r; });
    return hit ? (hit[c[1]] || code) : code;
  }

  // Hợp đồng có hiệu lực trong khoảng [dau, cuoi]
  function activeHD(db, ma, dau, cuoi, ix) {
    var list = rowsOf(db, "hopdong", ma, ix).filter(function (h) {
      var vao = d10(h["Ngày vào làm"]), cd = d10(h["Ngày chấm dứt"]);
      return (!vao || vao <= cuoi) && (!cd || cd >= dau);
    });
    return latestBy(list, "Ngày vào làm");
  }
  function chiTietHD(db, ma, soHD, asOf, ix) {
    return latestBy(rowsOf(db, "chitiethd", ma, ix).filter(function (r) { return r["Số HĐLĐ"] === soHD; }), "Hiệu lực từ", asOf);
  }
  function soNguoiPhuThuoc(db, ma, dau, cuoi, ix) {
    return rowsOf(db, "nhanthan", ma, ix).filter(function (r) {
      if (r["Đăng ký phụ thuộc"] !== "Có") return false;
      var tu = d10(r["Hiệu lực từ"]), den = d10(r["Hiệu lực đến"]);
      return (!tu || tu <= cuoi) && (!den || den >= dau);
    }).length;
  }
  /** Thông tin hiện hành của 1 nhân viên tại ngày asOf (mặc định hôm nay). */
  /** @param ix chỉ mục từ buildIndex(db) (không bắt buộc) — dùng khi gọi cho nhiều nhân viên liên tiếp */
  function hienHanh(db, ma, asOf, ix) {
    asOf = asOf || today();
    var hd = activeHD(db, ma, asOf, asOf, ix) || latestBy(rowsOf(db, "hopdong", ma, ix), "Ngày vào làm");
    var ct = hd ? chiTietHD(db, ma, hd["Số HĐLĐ"], asOf, ix) || chiTietHD(db, ma, hd["Số HĐLĐ"], null, ix) : null;
    var cn = latestBy(rowsOf(db, "canhan", ma, ix), "Hiệu lực từ", asOf) || latestBy(rowsOf(db, "canhan", ma, ix), "Hiệu lực từ");
    var tk = latestBy(rowsOf(db, "thanhtoan", ma, ix), "Hiệu lực từ", asOf) || latestBy(rowsOf(db, "thanhtoan", ma, ix), "Hiệu lực từ");
    var mv = latestBy(rowsOf(db, "congtac", ma, ix), "Từ ngày", asOf);
    var pb = ct ? ct["Phòng ban"] : (mv ? mv["Phòng ban"] : "");
    var cv = ct && ct["Chức vụ"] ? ct["Chức vụ"] : (mv ? mv["Chức vụ"] : "");
    return { hd: hd, ct: ct, cn: cn, tk: tk, pb: pb, cv: cv, tenPB: refName(db, "dm_phongban", pb, ix), tenCV: refName(db, "dm_chucvu", cv, ix) };
  }

  /** Dựng danh sách nhân sự tính lương của kỳ (dạng cột mà engine.js dùng) từ hồ sơ + hợp đồng. */
  function staffForPayroll(db, nam, thang) {
    var b = kyBounds(nam, thang), out = [], warn = [], ix = buildIndex(db);
    var gtCodes = (db.dm_giamtru || []).map(function (r) { return r["Mã giảm trừ"]; });
    var gtBT = gtCodes.filter(function (c) { return /^GTBT|^BT$/i.test(c); })[0] || "";
    var gtPT = gtCodes.filter(function (c) { return /^GTNPT|^PT$/i.test(c); })[0] || "";
    var hotroInfo = {}; (db.dm_hotro || []).forEach(function (r) { hotroInfo[r["Mã hỗ trợ"]] = r; });
    (db.nhanvien || []).forEach(function (nv) {
      var ma = nv["Mã NV"]; if (!ma) return;
      var hd = activeHD(db, ma, b.dau, b.cuoi, ix);
      if (!hd) { if (nv["Trạng thái"] !== "Đã nghỉ việc") warn.push(ma + " (" + (nv["Họ và tên"] || "") + "): chưa có hợp đồng hiệu lực trong kỳ — không tính lương"); return; }
      var ct = chiTietHD(db, ma, hd["Số HĐLĐ"], b.cuoi, ix);
      if (!ct) { warn.push(ma + " (" + (nv["Họ và tên"] || "") + "): hợp đồng " + hd["Số HĐLĐ"] + " chưa có dòng 'Lương & phụ lục HĐ' hiệu lực — không tính lương"); return; }
      var ml = split(ct["Mã lương"]), ht = split(ct["Hỗ trợ"]), tc = split(ct["Tăng ca"]);
      // Q-22 (R-56): phụ lục hiệu lực GIỮA tháng + chọn "Từ ngày hiệu lực" → công trước ngày đó tính theo lương thỏa thuận của phụ lục trước (cùng hợp đồng, cùng mã lương)
      var tuNgay = "", lttTruoc = "", hl = d10(ct["Hiệu lực từ"]);
      if (ct["Cách áp dụng trong tháng hiệu lực"] === "Từ ngày hiệu lực" && hl > b.dau && hl <= b.cuoi) {
        var truocDo = rowsOf(db, "chitiethd", ma, ix).filter(function (r) { return r["Số HĐLĐ"] === hd["Số HĐLĐ"] && d10(r["Hiệu lực từ"]) && d10(r["Hiệu lực từ"]) < hl; });
        var prev = latestBy(truocDo, "Hiệu lực từ");
        if (prev && (split(prev["Mã lương"])[0] || "") === (ml[0] || "")) { tuNgay = String(+hl.slice(8, 10)); lttTruoc = prev["Lương thỏa thuận"] || ""; }
        else if (prev) warn.push(ma + " (" + (nv["Họ và tên"] || "") + "): phụ lục từ " + hl + " chọn 'Từ ngày hiệu lực' nhưng mã lương khác phụ lục trước (" + (split(prev["Mã lương"])[0] || "trống") + " → " + (ml[0] || "trống") + ") — không chia được, tính CẢ THÁNG theo phụ lục mới");
      }
      var ht1 = "", ht2 = "";
      ht.forEach(function (c) {
        var inf = hotroInfo[c] || {}, txt = String((inf["Cách tính"] || "") + " " + (inf["Tên hỗ trợ"] || ""));
        if (/công chuẩn|cơ giới|thiếu/i.test(txt) && !/cơm/i.test(txt)) { if (!ht2) ht2 = c; } else if (!ht1) ht1 = c; else if (!ht2) ht2 = c;
      });
      if (ml.length > 2) warn.push(ma + ": có " + ml.length + " mã lương, app chỉ dùng 2 mã đầu (" + ml.slice(0, 2).join(", ") + ")");
      if (tc.length > 1) warn.push(ma + ": có nhiều mã tăng ca, app dùng mã đầu " + tc[0]);
      var tk = latestBy(rowsOf(db, "thanhtoan", ma, ix), "Hiệu lực từ", b.cuoi);
      // Có công SAU ngày chấm dứt hợp đồng trong kỳ → chỉ cảnh báo (app vẫn tính đúng công đã nhập, không tự xóa / trừ)
      var cdt = d10(hd["Ngày chấm dứt"]);
      if (cdt && cdt >= b.dau && cdt < b.cuoi) {
        var sauCd = [];
        rowsOf(db, "chamcong", ma, ix).forEach(function (r) {
          if (String(r["Kỳ"] || "").slice(0, 7) !== b.dau.slice(0, 7)) return;
          for (var dd = +cdt.slice(8, 10) + 1; dd <= 31; dd++) { var cv = r[("0" + dd).slice(-2)]; if (cv !== "" && cv != null && sauCd.indexOf(dd) < 0) sauCd.push(dd); }
        });
        if (sauCd.length) warn.push(ma + " (" + (nv["Họ và tên"] || "") + "): có công sau ngày chấm dứt hợp đồng " + cdt.slice(8, 10) + "/" + cdt.slice(5, 7) + " (ngày " + sauCd.sort(function (x, y) { return x - y; }).join(", ") + ") — kiểm tra lại chấm công; app VẪN tính các công này");
      }
      if (nv["Trạng thái"] === "Đã nghỉ việc" && !hd["Ngày chấm dứt"]) warn.push(ma + " (" + (nv["Họ và tên"] || "") + "): trạng thái 'Đã nghỉ việc' nhưng hợp đồng " + hd["Số HĐLĐ"] + " chưa có Ngày chấm dứt — vẫn đang được tính lương");
      if (ct["HTTT"] === "Chuyển khoản" && !(tk && tk["Số tài khoản"])) warn.push(ma + " (" + (nv["Họ và tên"] || "") + "): trả lương chuyển khoản nhưng chưa có số tài khoản");
      var cn = latestBy(rowsOf(db, "canhan", ma, ix), "Hiệu lực từ", b.cuoi);
      out.push({
        "Mã nhân viên": ma, "Họ và tên": nv["Họ và tên"], "Mã PB": ct["Phòng ban"] || "", "Mã CV": ct["Chức vụ"] || "",
        "Ngày vào làm": hd["Ngày vào làm"] || "", "Ngày nghỉ/thay đổi": hd["Ngày chấm dứt"] || "",
        "Lương cơ bản": ct["Lương cơ bản"] || "", "Lương thỏa thuận": ct["Lương thỏa thuận"] || "",
        "Mã tiền lương 1": ml[0] || "", "Mã tiền lương 2": ml[1] || "", "Mã tăng ca": tc[0] || "",
        "Mã phụ cấp": ct["Phụ cấp"] || "", "Mã hỗ trợ": ht1, "Mã hỗ trợ 2": ht2,
        "Mã BHXH": ct["Mức đóng bảo hiểm"] || "", "Mã TNCN": ct["Thuế TNCN"] || "",
        "Mã GT_TNCN_BT": gtBT, "Mã GT_TNCN_PT": gtPT, "Người phụ thuộc": soNguoiPhuThuoc(db, ma, b.dau, b.cuoi, ix),
        "Số CCCD": (cn && cn["Số CCCD"]) || nv["Số CCCD"] || "", "Số tài khoản": tk ? tk["Số tài khoản"] : "", "Tên Ngân hàng": tk ? tk["Tên ngân hàng"] : "",
        "HTTT": ct["HTTT"] || "", "Số HĐLĐ": hd["Số HĐLĐ"]
      });
      // Q-19 (R-53): phụ lục trong kỳ đổi Phòng ban → ghi các đoạn "Mã PB@từ ngày" để chia chi phí theo công (chỉ thêm khi có đổi phòng ban)
      var plHD = rowsOf(db, "chitiethd", ma, ix).filter(function (r) { return r["Số HĐLĐ"] === hd["Số HĐLĐ"] && d10(r["Hiệu lực từ"]); });
      var dau0 = latestBy(plHD, "Hiệu lực từ", b.dau), seg = [];
      plHD.filter(function (r) { var v = d10(r["Hiệu lực từ"]); return v > b.dau && v <= b.cuoi; })
        .sort(function (x, y) { return d10(x["Hiệu lực từ"]) < d10(y["Hiệu lực từ"]) ? -1 : 1; })
        .forEach(function (r) { seg.push({ pb: r["Phòng ban"] || "", tu: +d10(r["Hiệu lực từ"]).slice(8, 10) }); });
      if (dau0) seg.unshift({ pb: dau0["Phòng ban"] || "", tu: 1 });
      var segPB = seg.filter(function (x, i) { return i === 0 || x.pb !== seg[i - 1].pb; });
      if (segPB.length > 1) out[out.length - 1]["Phân bổ phòng ban"] = segPB.map(function (x) { return x.pb + "@" + x.tu; }).join(";");
      if (tuNgay) { out[out.length - 1]["Áp dụng từ ngày"] = tuNgay; out[out.length - 1]["Lương thỏa thuận trước"] = lttTruoc; } // chỉ thêm khi thật sự chia (dòng khác giữ y hệt bản trước)
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
  // Q-24 (chủ sở hữu duyệt 11/10/2026): tiền lương / thưởng cá nhân — ẩn với người không có quyền Xem bảng lương và không có quyền Sửa hồ sơ
  //   chitiethd: Lương cơ bản, Lương thỏa thuận · khenthuong: Giá trị tiền thưởng (chủ sở hữu duyệt bổ sung 11/10/2026)
  var PAY_TABLES = ["chitiethd", "khenthuong"], PAY_FIELDS = {};
  PAY_TABLES.forEach(function (t) { PAY_FIELDS[t] = {}; HR[t].f.forEach(function (f) { if (f.t === "money") PAY_FIELDS[t][f.k] = 1; }); });
  var PAY_HIDDEN = "🔒 ẩn";
  function isPayField(table, col) { return !!(PAY_FIELDS[table] && PAY_FIELDS[table][col]); }
  /** Nghỉ phép tính vào phép năm: "Nghỉ hằng năm" hoặc để trống (dữ liệu trước 2.0-α14). */
  function laNghiNam(r) { return !r["Loại nghỉ"] || r["Loại nghỉ"] === "Nghỉ hằng năm"; }
  function addDays(isoS, n) { var d = new Date(isoS + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); }
  /** @param opts { hidePay: true } — che cột lương cá nhân (Q-24) */
  function reports(db, opts) {
    var hidePay = !!(opts && opts.hidePay);
    var t = today(), nvs = db.nhanvien || [];
    var name = {}; nvs.forEach(function (n) { name[n["Mã NV"]] = n["Họ và tên"]; });
    return {
      hethan: function (soNgay) {
        var ix = buildIndex(db);
        var den = addDays(t, soNgay), rows = [];
        nvs.forEach(function (n) {
          if (n["Trạng thái"] === "Đã nghỉ việc") return;
          var hh = hienHanh(db, n["Mã NV"], null, ix), hd = hh.hd;
          if (!hd || !hd["Ngày hết hạn"] || hd["Ngày chấm dứt"]) return;
          var hh2 = d10(hd["Ngày hết hạn"]); if (hh2 > den) return;
          var con = Math.round((new Date(hh2) - new Date(t)) / 864e5);
          rows.push({ "Mã NV": n["Mã NV"], "Họ và tên": n["Họ và tên"], "Phòng ban": hh.tenPB, "Số HĐLĐ": hd["Số HĐLĐ"], "Hình thức HĐLĐ": hd["Hình thức HĐLĐ"], "Ngày hết hạn": hh2, "Còn (ngày)": con, "Tình trạng": con < 0 ? "ĐÃ QUÁ HẠN" : "Sắp hết hạn" });
        });
        return rows.sort(function (a, b) { return a["Còn (ngày)"] - b["Còn (ngày)"]; });
      },
      tinhhinh: function () {
        var ix = buildIndex(db);
        var by = function (fn) { var m = {}; nvs.forEach(function (n) { var k = fn(n) || "(chưa có)"; m[k] = (m[k] || 0) + 1; }); return Object.keys(m).sort().map(function (k) { return { "Nhóm": k, "Số người": m[k] }; }); };
        var dang = nvs.filter(function (n) { return n["Trạng thái"] !== "Đã nghỉ việc"; });
        var by2 = function (fn) { var m = {}; dang.forEach(function (n) { var k = fn(n) || "(chưa có)"; m[k] = (m[k] || 0) + 1; }); return Object.keys(m).sort().map(function (k) { return { "Nhóm": k, "Số người": m[k] }; }); };
        return {
          trangthai: by(function (n) { return n["Trạng thái"]; }),
          phongban: by2(function (n) { return hienHanh(db, n["Mã NV"], null, ix).tenPB; }),
          gioitinh: by2(function (n) { var c = hienHanh(db, n["Mã NV"], null, ix).cn; return c && c["Giới tính"]; }),
          loaihd: by2(function (n) { var h = hienHanh(db, n["Mã NV"], null, ix).hd; return h && h["Hình thức HĐLĐ"]; })
        };
      },
      nghi: function (nam) {
        var ix = buildIndex(db);
        var y = String(nam), rows = [];
        nvs.forEach(function (n) {
          var ma = n["Mã NV"];
          var ql = rowsOf(db, "quyenloiphep", ma, ix).filter(function (r) { return String(r["Năm áp dụng"]) === y; });
          var cap = ql.reduce(function (a, r) { return a + (+r["Số ngày được cấp"] || 0) + (+r["Số ngày cộng dồn năm trước"] || 0); }, 0);
          var lay = function (k, loai) { return rowsOf(db, k, ma, ix).filter(function (r) { return d10(r["Từ ngày"]).slice(0, 4) === y && r["Trạng thái duyệt"] === "Đã duyệt" && (!loai || loai(r)); }).reduce(function (a, r) { return a + (+r["Số ngày nghỉ"] || 0); }, 0); };
          var p = lay("nghiphep", laNghiNam), vr = lay("nghiphep", function (r) { return r["Loại nghỉ"] === "Nghỉ việc riêng có hưởng lương"; });
          var kl = lay("nghiphep", function (r) { return r["Loại nghỉ"] === "Nghỉ không hưởng lương"; }), o = lay("nghiom");
          if (!cap && !p && !vr && !kl && !o) return;
          // Chỉ "Nghỉ hằng năm" (hoặc để trống — dữ liệu cũ) trừ vào phép năm
          rows.push({ "Mã NV": ma, "Họ và tên": n["Họ và tên"], "Phép được cấp": cap, "Đã nghỉ phép": p, "Phép còn lại": cap - p, "Nghỉ việc riêng có lương": vr, "Nghỉ không hưởng lương": kl, "Nghỉ ốm": o });
        });
        return rows;
      },
      vipham: function () {
        return (db.noiquy || []).filter(function (r) { return r["Tình trạng xử lý"] !== "Đã xử lý"; }).map(function (r) {
          return { "Mã NV": r["Mã NV"], "Họ và tên": name[r["Mã NV"]] || "", "Ngày": r["Ngày"], "Nội dung vi phạm": r["Nội dung vi phạm"], "Tình trạng xử lý": r["Tình trạng xử lý"] };
        });
      },
      sinhnhat: function (thang) {
        var ix = buildIndex(db);
        var rows = [];
        nvs.forEach(function (n) {
          if (n["Trạng thái"] === "Đã nghỉ việc") return;
          var c = hienHanh(db, n["Mã NV"], null, ix).cn, ns = c && d10(c["Ngày sinh"]);
          if (ns && +ns.slice(5, 7) === +thang) rows.push({ "Mã NV": n["Mã NV"], "Họ và tên": n["Họ và tên"], "Ngày sinh": ns, "Phòng ban": hienHanh(db, n["Mã NV"], null, ix).tenPB });
        });
        return rows.sort(function (a, b) { return a["Ngày sinh"].slice(8) < b["Ngày sinh"].slice(8) ? -1 : 1; });
      },
      /** Sổ quản lý lao động — đủ nội dung khoản 2 Điều 3 Nghị định 145/2020/NĐ-CP; số liệu "trong năm" theo năm nam (mặc định năm nay). */
      /**
       * Biến động nhân sự trong khoảng kỳ [tuKy, denKy] ("YYYY-MM"): tăng mới, nghỉ việc, tăng / giảm lương, điều chuyển, đổi chức vụ, mức đóng BH.
       * Tự nhận biết bằng cách so mỗi phụ lục với phụ lục liền trước của cùng nhân viên (dữ liệu cũ không cần nhập lại "Loại biến động").
       */
      biendong: function (tuKy, denKy) {
        var ix = buildIndex(db), a = String(tuKy || t.slice(0, 7)), b = String(denKy || a), out = [];
        var inR = function (v) { var k = d10(v).slice(0, 7); return k && k >= a && k <= b; };
        var mny = function (v) { return +String(v == null ? "" : v).replace(/[^\d-]/g, "") || 0; };
        var pay = function (v) { return hidePay ? PAY_HIDDEN : (v ? mny(v) : ""); };
        var pct = function (x, y) { return x ? Math.round((y - x) / x * 1000) / 10 : null; };
        var push = function (ngay, n, loai, truoc, sau, cl, ct, pb) { out.push({ "Hiệu lực": d10(ngay), "Mã NV": n["Mã NV"], "Họ và tên": n["Họ và tên"] || "", "Phòng ban": pb || "", "Loại biến động": loai, "Trước": truoc, "Sau": sau, "Chênh lệch": cl, "Chứng từ": ct || "" }); };
        nvs.forEach(function (n) {
          var ma = n["Mã NV"], hds = rowsOf(db, "hopdong", ma, ix).slice().sort(function (x, y) { return d10(x["Ngày vào làm"]) < d10(y["Ngày vào làm"]) ? -1 : 1; });
          var pbOf = function (r) { return r ? refName(db, "dm_phongban", r["Phòng ban"], ix) : ""; }, cvOf = function (r) { return r ? refName(db, "dm_chucvu", r["Chức vụ"], ix) : ""; };
          hds.forEach(function (hd, i) {
            // phụ lục có hiệu lực tại 1 ngày (lúc vào làm / lúc nghỉ); chưa có thì lấy phụ lục sớm nhất của hợp đồng
            var ctAt = function (ngay) { return chiTietHD(db, ma, hd["Số HĐLĐ"], d10(ngay) || "9999-12-31", ix) || rowsOf(db, "chitiethd", ma, ix).filter(function (r) { return r["Số HĐLĐ"] === hd["Số HĐLĐ"]; }).sort(function (x, y) { return d10(x["Hiệu lực từ"]) < d10(y["Hiệu lực từ"]) ? -1 : 1; })[0]; };
            if (i === 0 && inR(hd["Ngày vào làm"])) { var cv = ctAt(hd["Ngày vào làm"]); push(hd["Ngày vào làm"], n, "Tăng mới", "", pay(cv && cv["Lương thỏa thuận"]), "", hd["Số HĐLĐ"], pbOf(cv)); }
            // Nghỉ việc: hợp đồng chấm dứt mà không có hợp đồng nào bắt đầu sau đó
            if (hd["Ngày chấm dứt"] && inR(hd["Ngày chấm dứt"]) && !hds.some(function (x) { return x !== hd && d10(x["Ngày vào làm"]) >= d10(hd["Ngày chấm dứt"]); }))
              push(hd["Ngày chấm dứt"], n, "Nghỉ việc", "Đang làm", hd["Lý do chấm dứt"] || "Nghỉ việc", "", hd["Số HĐLĐ"], pbOf(ctAt(hd["Ngày chấm dứt"])));
          });
          var pls = rowsOf(db, "chitiethd", ma, ix).filter(function (r) { return d10(r["Hiệu lực từ"]); }).sort(function (x, y) { return d10(x["Hiệu lực từ"]) < d10(y["Hiệu lực từ"]) ? -1 : 1; });
          pls.forEach(function (r, k) {
            if (!k || !inR(r["Hiệu lực từ"])) return;
            var p = pls[k - 1], ct = [r["Mã công tác"], r["Số quyết định"]].filter(Boolean).join(" · "), found = 0;
            var l0 = mny(p["Lương thỏa thuận"]), l1 = mny(r["Lương thỏa thuận"]);
            if (l1 !== l0) { found++; var pc = pct(l0, l1); push(r["Hiệu lực từ"], n, l1 > l0 ? "Tăng lương" : "Giảm lương", pay(l0), pay(l1), hidePay ? PAY_HIDDEN : (l1 - l0 > 0 ? "+" : "") + (l1 - l0).toLocaleString("vi-VN") + (pc == null ? "" : " (" + (pc > 0 ? "+" : "") + String(pc).replace(".", ",") + "%)"), ct, pbOf(r)); }
            if (String(p["Phòng ban"] || "") !== String(r["Phòng ban"] || "")) { found++; push(r["Hiệu lực từ"], n, "Điều chuyển phòng ban", pbOf(p), pbOf(r), "", ct, pbOf(r)); }
            if (String(p["Chức vụ"] || "") !== String(r["Chức vụ"] || "")) { found++; push(r["Hiệu lực từ"], n, "Bổ nhiệm / đổi chức vụ", cvOf(p), cvOf(r), "", ct, pbOf(r)); }
            var b0 = mny(p["Lương cơ bản"]), b1 = mny(r["Lương cơ bản"]);
            if (b1 !== b0 || String(p["Mức đóng bảo hiểm"] || "") !== String(r["Mức đóng bảo hiểm"] || "")) { found++; push(r["Hiệu lực từ"], n, "Điều chỉnh mức đóng BH", hidePay ? PAY_HIDDEN : [p["Mức đóng bảo hiểm"], b0 ? b0.toLocaleString("vi-VN") : ""].filter(Boolean).join(" · "), hidePay ? PAY_HIDDEN : [r["Mức đóng bảo hiểm"], b1 ? b1.toLocaleString("vi-VN") : ""].filter(Boolean).join(" · "), hidePay || !(b1 - b0) ? "" : (b1 - b0 > 0 ? "+" : "") + (b1 - b0).toLocaleString("vi-VN"), ct, pbOf(r)); }
            if (!found && r["Loại biến động"]) push(r["Hiệu lực từ"], n, r["Loại biến động"], "", "", "", ct, pbOf(r));
          });
        });
        return out.sort(function (x, y) { return x["Hiệu lực"] < y["Hiệu lực"] ? -1 : x["Hiệu lực"] > y["Hiệu lực"] ? 1 : String(x["Mã NV"]).localeCompare(String(y["Mã NV"])); });
      },
      /** Quá trình lương 1 người: các phụ lục theo thời gian + mức thay đổi so với phụ lục trước. */
      quaTrinhLuong: function (ma) {
        var pls = (db.chitiethd || []).filter(function (r) { return r["Mã NV"] === ma && d10(r["Hiệu lực từ"]); }).sort(function (x, y) { return d10(x["Hiệu lực từ"]) < d10(y["Hiệu lực từ"]) ? -1 : 1; });
        var prev = null;
        return pls.map(function (r) { var v = +String(r["Lương thỏa thuận"] || "").replace(/[^\d-]/g, "") || 0, o = { "Hiệu lực từ": d10(r["Hiệu lực từ"]), "Phụ lục": r["Mã công tác"] || "", "Loại": r["Loại biến động"] || r["Loại phụ lục"] || "", "Lương thỏa thuận": hidePay ? PAY_HIDDEN : v, "Thay đổi (%)": prev && !hidePay ? Math.round((v - prev) / prev * 1000) / 10 : "" }; prev = v || prev; return o; });
      },
      soLaoDong: function (nam) {
        var ix = buildIndex(db), y = String(nam || t.slice(0, 4)), inY = function (v) { return d10(v).slice(0, 4) === y; };
        var congOf = function (v) { var m = String(v == null ? "" : v).trim().match(/^(\d+(?:[.,]\d+)?)/); return m ? parseFloat(m[1].replace(",", ".")) : 0; };
        var ngay = function (ma, k, loc) { return rowsOf(db, k, ma, ix).filter(function (r) { return inY(r["Từ ngày"]) && r["Trạng thái duyệt"] === "Đã duyệt" && (!loc || loc(r)); }).reduce(function (a, r) { return a + (+r["Số ngày nghỉ"] || 0); }, 0); };
        return nvs.map(function (n, i) {
          var ma = n["Mã NV"], hh = hienHanh(db, ma, null, ix), c = hh.cn || {}, hd = hh.hd || {}, ct = hh.ct || {};
          var hv = latestBy(rowsOf(db, "hocvan", ma, ix), "Ngày cấp bằng") || {};
          var hds = rowsOf(db, "hopdong", ma, ix), batDau = hds.map(function (x) { return d10(x["Ngày vào làm"]); }).filter(Boolean).sort()[0] || "";
          // Nâng bậc / nâng lương trong năm: phụ lục có hiệu lực trong năm đổi Lương thỏa thuận so với phụ lục liền trước
          var pls = rowsOf(db, "chitiethd", ma, ix).filter(function (r) { return d10(r["Hiệu lực từ"]); }).sort(function (a, b) { return d10(a["Hiệu lực từ"]) < d10(b["Hiệu lực từ"]) ? -1 : 1; });
          var nang = [];
          pls.forEach(function (r, k) { if (k && inY(r["Hiệu lực từ"]) && String(r["Lương thỏa thuận"] || "") !== String(pls[k - 1]["Lương thỏa thuận"] || "")) nang.push(d10(r["Hiệu lực từ"]) + (hidePay ? "" : ": " + (pls[k - 1]["Lương thỏa thuận"] || "?") + " → " + (r["Lương thỏa thuận"] || "?"))); });
          var tc = (db.chamcong || []).filter(function (r) { return r && r["Mã NV"] === ma && /TC/i.test(String(r["Hình thức công"] || "")) && String(r["Kỳ"] || "").slice(0, 4) === y; })
            .reduce(function (a, r) { for (var d = 1; d <= 31; d++) a += congOf(r[("0" + d).slice(-2)]); return a; }, 0);
          var dt = rowsOf(db, "daotao", ma, ix).filter(function (r) { return inY(r["Từ ngày"]); }).map(function (r) { return [r["Hình thức"], r["Nội dung"]].filter(Boolean).join(": "); });
          var kl = rowsOf(db, "noiquy", ma, ix).filter(function (r) { return inY(r["Ngày"]) && (r["Hình thức kỷ luật"] || r["Bồi thường thiệt hại (trách nhiệm vật chất)"]); })
            .map(function (r) { return d10(r["Ngày"]) + " " + [r["Hình thức kỷ luật"], r["Bồi thường thiệt hại (trách nhiệm vật chất)"] ? "bồi thường " + r["Bồi thường thiệt hại (trách nhiệm vật chất)"] : ""].filter(Boolean).join(", "); });
          var tn = rowsOf(db, "tainanld", ma, ix).filter(function (r) { return inY(r["Ngày"]); }).map(function (r) { return d10(r["Ngày"]) + " " + (r["Loại"] || "") + (r["Mức suy giảm khả năng lao động (%)"] ? " (" + r["Mức suy giảm khả năng lao động (%)"] + "%)" : ""); });
          return { "STT": i + 1, "Mã NV": ma, "Họ và tên": n["Họ và tên"], "Giới tính": c["Giới tính"] || "", "Ngày sinh": c["Ngày sinh"] || "", "Quốc tịch": c["Quốc tịch"] || "",
            "Thường trú": c["Thường trú"] || "", "Chỗ ở hiện tại": c["Địa chỉ hiện tại"] || "",
            "Số CCCD": c["Số CCCD"] || n["Số CCCD"] || "", "Ngày cấp": c["Ngày cấp"] || "", "Nơi cấp": c["Nơi cấp"] || "", "Số điện thoại": c["Số điện thoại"] || "",
            "Trình độ": hv["Trình độ học vấn"] || "", "Chuyên môn": hv["Chuyên môn"] || "", "Bậc trình độ kỹ năng nghề": hv["Bậc trình độ kỹ năng nghề"] || "",
            "Phòng ban": hh.tenPB, "Chức vụ": hh.tenCV, "Vị trí việc làm": ct["Vị trí việc làm"] || "",
            "Số HĐLĐ": hd["Số HĐLĐ"] || "", "Loại HĐLĐ": hd["Hình thức HĐLĐ"] || "", "Bắt đầu làm việc": batDau, "Ngày vào làm": hd["Ngày vào làm"] || "", "Ngày hết hạn": hd["Ngày hết hạn"] || "",
            "Số sổ BHXH": c["Số sổ BHXH"] || "", "Mức đóng BHXH": ct["Mức đóng bảo hiểm"] || "",
            "Lương cơ bản": hidePay ? PAY_HIDDEN : +ct["Lương cơ bản"] || "", "Lương thỏa thuận": hidePay ? PAY_HIDDEN : +ct["Lương thỏa thuận"] || "",
            ["Nâng bậc, nâng lương " + y]: hidePay && nang.length ? PAY_HIDDEN + " (" + nang.join("; ") + ")" : nang.join("; "),
            ["Nghỉ hằng năm " + y + " (ngày)"]: ngay(ma, "nghiphep", laNghiNam), ["Nghỉ việc riêng có lương " + y]: ngay(ma, "nghiphep", function (r) { return r["Loại nghỉ"] === "Nghỉ việc riêng có hưởng lương"; }),
            ["Nghỉ không hưởng lương " + y]: ngay(ma, "nghiphep", function (r) { return r["Loại nghỉ"] === "Nghỉ không hưởng lương"; }), ["Nghỉ ốm " + y]: ngay(ma, "nghiom"),
            ["Làm thêm " + y + " (công TC)"]: Math.round(tc * 100) / 100,
            ["Nâng cao trình độ, kỹ năng nghề " + y]: dt.join("; "), ["Kỷ luật, trách nhiệm vật chất " + y]: kl.join("; "), ["Tai nạn LĐ, bệnh nghề nghiệp " + y]: tn.join("; "),
            "Ngày chấm dứt": hd["Ngày chấm dứt"] || "", "Lý do chấm dứt": hd["Lý do chấm dứt"] || "", "Trạng thái": n["Trạng thái"] };
        });
      },
      lichsu: function (ma) {
        var ev = [];
        Object.keys(HR).forEach(function (k) {
          if (k === "nhanvien") return;
          rowsOf(db, k, ma).forEach(function (r) {
            var d = d10(r["Hiệu lực từ"] || r["Ngày vào làm"] || r["Từ ngày"] || r["Ngày"] || r["Ngày khám"] || r["Ngày cấp bằng"] || r["Ngày tài liệu"] || "");
            var tom = HR[k].cols.map(function (c) { return r[c] ? c + ": " + (hidePay && isPayField(k, c) ? PAY_HIDDEN : r[c]) : ""; }).filter(Boolean).join(" · ");
            ev.push({ "Ngày": d, "Loại hồ sơ": HR[k].ten, "Nội dung": tom });
          });
        });
        return ev.sort(function (a, b) { return a["Ngày"] < b["Ngày"] ? 1 : -1; });
      }
    };
  }

  var api = { HR: HR, BIEN_DONG: BIEN_DONG, NV_TABS: NV_TABS, HD_TABS: HD_TABS, REFS: REFS, refName: refName, hienHanh: hienHanh, buildIndex: buildIndex, isPayField: isPayField, PAY_HIDDEN: PAY_HIDDEN, staffForPayroll: staffForPayroll,
    seedDanhMuc: seedDanhMuc, migrate: migrate, reports: reports, uid: uid, today: today, split: split, activeHD: activeHD };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.HRM = api;
})(typeof window !== "undefined" ? window : this);
