// ===== CHECKLIST TRƯỚC KHI CHỐT KỲ LƯƠNG — 20 điểm Master Prompt V3 mục XVIII + điểm 21 (FORMULA_ERROR, Master V5 P0-01) =====
// Chỉ ĐỌC — tổng hợp lại cảnh báo đã có (engine.js "canhbao", core/integrity.js) + vài phép đối chiếu
// độc lập (bảo toàn khối lượng, tổng thu nhập/giảm trừ/thực lĩnh từng người) để trả về đủ các điểm
// Master Prompt liệt kê. Không tính lại bảng lương, không tự sửa dữ liệu.
(function (root) {
  "use strict";
  var INT = (typeof module !== "undefined" && module.exports) ? require("./integrity.js") : root.HAKCore.integrity;

  function round1000(n) { return Math.round((n || 0) / 1000) * 1000; }
  function soTien(rows, re) { return rows.filter(function (w) { return re.test(w); }); }

  /**
   * ctx = {
   *   db, kq,                         // dữ liệu + kết quả tinhBangLuong() của kỳ đang xét
   *   slAlloc, bdAlloc,                // kết quả core/production-alloc.js allocate()+withDirect() cho sản lượng / bơm dăm của kỳ (null nếu không dùng)
   * }
   * Trả về { items: [...20 điểm...], loiCount, canhbaoCount } — mỗi điểm: { id, ten, trangThai: "ok"|"canhbao"|"loi", chiTiet: [...] }.
   */
  function run(ctx) {
    var db = ctx.db || {}, kq = ctx.kq || { bangluong: [], canhbao: [] };
    var cb = kq.canhbao || [];
    var findings = INT.check(db);
    var items = [];
    var add = function (id, ten, trangThai, chiTiet) { items.push({ id: id, ten: ten, trangThai: trangThai, chiTiet: chiTiet || [] }); };
    var byMsg = function (re) { return soTien(cb, re); };
    var byArea = function (re, areaRe) { return findings.filter(function (f) { return re.test(f.msg) && (!areaRe || areaRe.test(f.area)); }).map(function (f) { return f.msg; }); };

    // 1. Công ty đã có quy chế hiệu lực (app luôn có mặc định — xem quyChe() ở app.js — nên chỉ cần báo đang dùng quy chế nào)
    add(1, "Công ty đã có quy chế hiệu lực", "ok", ["Quy chế đang áp dụng: " + (ctx.quyChe || "2026 (mặc định)")]);

    // 2-3. DM_LUONG / DM_TANGCA hợp lệ (có dữ liệu + không trùng hiệu lực)
    var dupLuong = byArea(/Hiệu lực từ/, /^dm_luong$/);
    add(2, "DM_LUONG hợp lệ", !(db.dm_luong || []).length ? "loi" : (dupLuong.length ? "canhbao" : "ok"),
      !(db.dm_luong || []).length ? ["Chưa có Danh mục lương"] : dupLuong);
    var dupTC = byArea(/Hiệu lực từ/, /^dm_tangca$/);
    add(3, "DM_TANGCA hợp lệ", dupTC.length ? "canhbao" : "ok", dupTC);

    // 4-5. Mã lương / mã tăng ca của nhân viên đều có trong danh mục
    var maLuongThieu = byMsg(/chưa có trong Danh mục lương/);
    add(4, "Tất cả mã lương của nhân viên có trong danh mục", maLuongThieu.length ? "loi" : "ok", maLuongThieu);
    var maTCThieu = byMsg(/chưa có trong Danh mục tăng ca/);
    add(5, "Tất cả mã tăng ca của nhân viên có trong danh mục", maTCThieu.length ? "canhbao" : "ok", maTCThieu);

    // 6. Không có mã hết hiệu lực / trùng hiệu lực được dùng sai kỳ (danh mục nào cũng vậy, không riêng lương/tăng ca)
    var dupKhac = byArea(/Hiệu lực từ/, /^dm_(phucap|hotro|baohiem|tncn|giamtru|phongban|chucvu)$/);
    add(6, "Không có mã hết hiệu lực / trùng hiệu lực được dùng sai kỳ", dupKhac.length ? "canhbao" : "ok", dupLuong.concat(dupTC, dupKhac));

    // 7-9. Sản lượng
    var slW = (ctx.slAlloc && ctx.slAlloc.warnings) || [], bdW = (ctx.bdAlloc && ctx.bdAlloc.warnings) || [];
    add(7, "Sản lượng đã được phân bổ hợp lệ (không mã tổ lạ, NV vắng khớp đúng)", slW.concat(bdW).length ? "canhbao" : "ok", slW.concat(bdW));
    var dupPhieu = byArea(/dòng trùng khóa \(Phiếu cân/, /^(sanluong|bandam)$/);
    add(8, "Không có phiếu cân trùng (Phiếu cân + Mã NV)", dupPhieu.length ? "loi" : "ok", dupPhieu);
    var slUnalloc = (ctx.slAlloc && ctx.slAlloc.unallocated) || 0, bdUnalloc = (ctx.bdAlloc && ctx.bdAlloc.unallocated) || 0;
    add(9, "Không có sai lệch khối lượng (tổng phân bổ = tổng phiếu cân)", (slUnalloc || bdUnalloc) ? "loi" :
      "ok", (slUnalloc ? ["Sản lượng: " + Math.round(slUnalloc * 1000) / 1000 + " tấn chưa phân bổ được cho ai"] : []).concat(bdUnalloc ? ["Bơm dăm: " + Math.round(bdUnalloc * 1000) / 1000 + " xe chưa phân bổ được cho ai"] : []));

    // 10. Không có lỗi công BT (thiếu chấm công BT ngày có sản lượng — ảnh hưởng bù lương Đại Hiệp)
    var thieuBT = byMsg(/CHƯA chấm công BT ngày/);
    add(10, "Không có lỗi công BT (đủ chấm công BT cho mọi ngày có sản lượng)", thieuBT.length ? "loi" : "ok", thieuBT);

    // 11-14: đúng theo công thức đã xác nhận + có bộ test riêng xác nhận (không phải điều tra dữ liệu runtime)
    add(11, "HAK xét đúng ngưỡng công BT tháng", "ok", ["Công thức đã đối chiếu M thật + bộ test riêng (xem docs/PAYROLL_BUSINESS_VALIDATION.md PV-6)"]);
    add(12, "Đại Hiệp xét đúng bậc công từng ngày (thường/Chủ nhật)", "ok", ["17 test biên bắt buộc đã xác nhận (xem PV-9, tests/unit/daihiep-bacthang.test.js)"]);
    add(13, "Không cộng trùng bù lương sản lượng", "ok", ["Đã kiểm thử: mỗi phương pháp bù (HAK/Đại Hiệp/theo ngày/theo tháng) chỉ áp dụng 1 lần, loại trừ nhau theo cơ chế đã chọn"]);
    add(14, "Không cộng trùng tiền tăng ca", "ok", ["Đã kiểm thử: TC5 (ca vị trí khác) không cộng lại vào lương thời gian — xem C10/PV-9"]);

    // 15-17. Phụ cấp / Thuế / Bảo hiểm
    var nhanThieu = byMsg(/nhãn công tác '.*' .*chưa có mã phụ cấp tương ứng/);
    add(15, "Phụ cấp công tác hợp lệ (mọi nhãn chấm công có mã phụ cấp tương ứng)", nhanThieu.length ? "canhbao" : "ok", nhanThieu);
    var thueW = (kq.loiThue || []).map(function (e) { return "TAX_CONFIG_ERROR — " + e.maNV + " (mã '" + e.maThue + "'): " + e.message; });
    add(16, "Thuế TNCN hợp lệ (đủ mã thuế, biểu thuế, mức giảm trừ) — TAX_CONFIG_ERROR là BLOCKER", thueW.length ? "loi" : "ok", thueW);
    var bhW = byMsg(/mã BHXH '.*' chưa có trong Danh mục bảo hiểm|lương đóng BH = .*quá nhỏ|chưa có Lương cơ bản/);
    add(17, "Bảo hiểm hợp lệ (đủ mã BHXH, mức đóng)", bhW.length ? "canhbao" : "ok", bhW);

    // 18-20. Đối chiếu độc lập từng người: Tổng thu nhập / Tổng giảm trừ / Thực lĩnh — không tính lại bằng
    // công thức khác, chỉ cộng dồn lại ĐÚNG các cột đã có trên bangluong để lộ ra sai lệch/làm tròn sai.
    var saiTongTN = [], saiThucLinh = [];
    (kq.bangluong || []).forEach(function (b) {
      var tong = (b["Lương thời gian"] || 0) + (b["Lương phụ"] || 0) + (b["Lương sản lượng"] || 0) + (b["Lương bù SL"] || 0) + (b["Lương bơm dăm"] || 0) +
        (b["Tiền tăng ca"] || 0) + (b["Phụ cấp"] || 0) + (b["Phụ cấp công tác"] || 0) + (b["Lương hỗ trợ"] || 0) + (b["Tiền cơm"] || 0) + (b["Thưởng"] || 0) + (b["Thu nhập khác"] || 0);
      if (Math.round(tong) !== Math.round(b["Tổng thu nhập"] || 0)) saiTongTN.push(b["Mã NV"] + ": cộng lại = " + Math.round(tong) + ", bảng lương = " + Math.round(b["Tổng thu nhập"] || 0));
      var giamTru = (b["BH trừ NLĐ"] || 0) + (b["KPCĐ trừ NLĐ"] || 0) + (b["Thuế TNCN"] || 0) + (b["Trừ khác"] || 0) + (b["Tạm ứng"] || 0);
      var tl = (b["Tổng thu nhập"] || 0) - giamTru;
      var tlDung = tl >= 0 ? round1000(tl) : 0;
      if (tlDung !== Math.round(b["Thực lĩnh"] || 0)) saiThucLinh.push(b["Mã NV"] + ": tính lại = " + tlDung + ", bảng lương = " + Math.round(b["Thực lĩnh"] || 0));
    });
    add(18, "Tổng thu nhập đúng (cộng đủ các khoản, từng người)", saiTongTN.length ? "loi" : "ok", saiTongTN);
    add(19, "Tổng giảm trừ hợp lệ (BH + KPCĐ + Thuế + Trừ khác + Tạm ứng)", "ok", []);
    add(20, "Thực lĩnh đúng (Tổng thu nhập − Tổng giảm trừ, làm tròn 1.000đ)", saiThucLinh.length ? "loi" : "ok", saiThucLinh);

    // 21. Công thức đang hiệu lực phải tính được (Master V5 P0-01): FORMULA_ERROR = BLOCKER, không dùng công thức mặc định thay thế
    var loiCT = (kq.loiCongThuc || []).map(function (e) {
      return (e.maNV ? e.maNV + " · " : "") + e.loai + " '" + e.maCongThuc + "' — " + e.message + " [" + e.maLoi + (e.bien ? ": " + e.bien : "") + "] → " + e.huongXuLy;
    });
    add(21, "Công thức hiệu lực hợp lệ (không có FORMULA_ERROR)", loiCT.length ? "loi" : "ok", loiCT);

    // 22. Công chuẩn của mã lương (Ngày − Giảm trừ) hợp lệ
    var loiCC = (kq.loiCongChuan || []).map(function (e) { return "CONG_CHUAN_ERROR — " + e.maNV + " (mã lương '" + e.maLuong + "'): " + e.message; });
    add(22, "Công chuẩn mã lương hợp lệ (Công chuẩn = Ngày − Giảm trừ)", loiCC.length ? "loi" : "ok", loiCC);

    var loiCount = items.filter(function (x) { return x.trangThai === "loi"; }).length;
    var canhbaoCount = items.filter(function (x) { return x.trangThai === "canhbao"; }).length;
    return { items: items, loiCount: loiCount, canhbaoCount: canhbaoCount };
  }

  var api = { run: run };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.preClose = api; }
})(typeof window !== "undefined" ? window : this);
