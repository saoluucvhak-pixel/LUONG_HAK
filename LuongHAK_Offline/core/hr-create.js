// ===== CORE / HR-CREATE (V10.1) — kiểm tra và dựng bản ghi khi THÊM NHÂN VIÊN MỚI (nhiều bảng, tất cả hoặc không gì) =====
// Hàm thuần: validate(input, db) → mảng lỗi (rỗng = hợp lệ); build(input, ids) → { bảng: [dòng] }. Không đụng DB, không ghi gì.
(function (root) {
  "use strict";
  var ISO = /^\d{4}-\d{2}-\d{2}$/;
  function s(v) { return v == null ? "" : String(v).trim(); }
  function validDate(x) { if (!ISO.test(x)) return false; var d = new Date(x + "T00:00:00Z"); return !isNaN(d) && d.toISOString().slice(0, 10) === x; }
  function norm(v) { return s(v).toLowerCase(); }
  /**
   * in: { b: nhân viên, c: cá nhân, hv: học vấn, hd: hợp đồng, l: chi tiết HĐ, tk: tài khoản, today: "YYYY-MM-DD" }
   * db: các bảng hiện có (nhanvien, canhan, hopdong)
   */
  function validate(i, db) {
    var e = [], b = i.b || {}, c = i.c || {}, hd = i.hd || {}, l = i.l || {}, tk = i.tk || {}, hv = i.hv || {};
    db = db || {};
    var ma = s(b["Mã NV"]);
    if (!ma) e.push("Mã NV: bắt buộc");
    else {
      if (/\s/.test(ma)) e.push("Mã NV: không được chứa khoảng trắng");
      if ((db.nhanvien || []).some(function (r) { return norm(r["Mã NV"]) === norm(ma); })) e.push("Mã NV '" + ma + "' đã tồn tại");
    }
    if (!s(b["Họ và tên"])) e.push("Họ và tên: bắt buộc");
    var groups = [["Thông tin cá nhân", c], ["Hợp đồng", hd], ["Chi tiết hợp đồng", l], ["Tài khoản", tk], ["Học vấn", hv], ["Nhân viên", b]];
    groups.forEach(function (g) { Object.keys(g[1]).forEach(function (k) { if (/^Ngày|Hiệu lực/.test(k) && s(g[1][k]) && !validDate(s(g[1][k]))) e.push(g[0] + " — " + k + ": ngày không hợp lệ (nhập dd/MM/yyyy)"); }); });
    var so = s(hd["Số HĐLĐ"]);
    if (!so) e.push("Số HĐLĐ: bắt buộc");
    else if ((db.hopdong || []).some(function (r) { return norm(r["Số HĐLĐ"]) === norm(so); })) e.push("Số HĐLĐ '" + so + "' đã tồn tại");
    var vao = s(hd["Ngày vào làm"]), het = s(hd["Ngày hết hạn"]);
    if (!vao) e.push("Ngày vào làm: bắt buộc");
    if (validDate(vao) && validDate(het) && het < vao) e.push("Ngày hết hạn không được trước Ngày vào làm");
    var sinh = s(c["Ngày sinh"]), cap = s(c["Ngày cấp"]), today = i.today || "";
    if (validDate(sinh) && today && sinh >= today) e.push("Ngày sinh phải trước hôm nay");
    if (validDate(sinh) && validDate(cap) && cap < sinh) e.push("Ngày cấp CCCD không được trước Ngày sinh");
    var cccd = s(c["Số CCCD"]);
    if (cccd) {
      if (!/^\d{12}$/.test(cccd)) e.push("Số CCCD phải đủ 12 chữ số (đang nhập '" + cccd + "')");
      else if ((db.canhan || []).some(function (r) { return s(r["Số CCCD"]) === cccd && norm(r["Mã NV"]) !== norm(ma); }) || (db.nhanvien || []).some(function (r) { return s(r["Số CCCD"]) === cccd && norm(r["Mã NV"]) !== norm(ma); })) e.push("Số CCCD " + cccd + " đã thuộc nhân viên khác");
    }
    var mst = s(c["Mã số thuế"]); if (mst && !/^(\d{10}|\d{13}|\d{10}-\d{3})$/.test(mst)) e.push("Mã số thuế phải gồm 10 hoặc 13 chữ số");
    var ck = /chuy[ểe]n kho[ảa]n/i.test(s(l["HTTT"]));
    if (ck && !s(tk["Số tài khoản"])) e.push("Hình thức thanh toán là Chuyển khoản nhưng chưa nhập Số tài khoản");
    if (s(tk["Số tài khoản"]) && !s(tk["Tên ngân hàng"])) e.push("Có Số tài khoản thì phải nhập Tên ngân hàng");
    if (s(tk["Số tài khoản"]) && !/^[0-9A-Za-z .\-]{6,30}$/.test(s(tk["Số tài khoản"]))) e.push("Số tài khoản không hợp lệ");
    return e;
  }
  /** Dựng các dòng sẽ ghi. ids = hàm sinh _id. Cá nhân chỉ tạo khi có ít nhất một trường ngoài Quốc tịch mặc định. */
  function build(i, ids) {
    var b = i.b, c = i.c || {}, hd = i.hd, l = i.l, tk = i.tk || {}, hv = i.hv || {}, m = b["Mã NV"], vao = hd["Ngày vào làm"], out = { nhanvien: [], canhan: [], hopdong: [], chitiethd: [], thanhtoan: [], hocvan: [] };
    out.nhanvien.push(Object.assign({ _id: ids(), "Ngày tạo hồ sơ": i.today || "", "Số CCCD": c["Số CCCD"] || "" }, b));
    if (Object.keys(c).some(function (k) { return c[k] && !(k === "Quốc tịch" && c[k] === "Việt Nam"); })) out.canhan.push(Object.assign({ _id: ids(), "Mã NV": m, "Hiệu lực từ": vao }, c));
    out.hopdong.push(Object.assign({ _id: ids(), "Mã NV": m }, hd));
    out.chitiethd.push(Object.assign({ _id: ids(), "Mã NV": m, "Số HĐLĐ": hd["Số HĐLĐ"], "Mã công tác": hd["Số HĐLĐ"] + "-PL01", "Loại phụ lục": "Hợp đồng gốc", "Hiệu lực từ": vao }, l));
    if (tk["Số tài khoản"]) out.thanhtoan.push(Object.assign({ _id: ids(), "Mã NV": m, "Hiệu lực từ": vao }, tk));
    if (Object.keys(hv).some(function (k) { return hv[k]; })) out.hocvan.push(Object.assign({ _id: ids(), "Mã NV": m }, hv));
    return out;
  }
  var api = { validate: validate, build: build, validDate: validDate };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else { root.HAKCore = root.HAKCore || {}; root.HAKCore.hrCreate = api; }
})(typeof window !== "undefined" ? window : this);
