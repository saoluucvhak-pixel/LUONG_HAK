// ===== UI / GUIDE — Hướng dẫn sử dụng trong app, Quy trình tính lương, Dự thảo Quy chế tính lương =====
// Nội dung Quy chế được SINH TỪ DANH MỤC ĐANG DÙNG (mã lương, phụ cấp, tăng ca, BH, thuế…) và mô tả ĐÚNG công thức của engine.js
// (docs/PAYROLL_FORMULAS.md) — không tự đặt ra quy định mới. Điểm cần công ty quyết định được liệt kê riêng ([Q-xx]).
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HAKGuide = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function n(v) { var x = parseFloat(String(v == null ? "" : v).replace(/,/g, ".")); return isNaN(x) ? 0 : x; }
  function money(v) { var x = Math.round(n(v)); return x.toLocaleString("vi-VN"); }
  function pct(v) { var x = n(v); if (x > 1) x = x / 100; return (Math.round(x * 10000) / 100).toLocaleString("vi-VN") + "%"; }
  function dmy(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? m[3] + "/" + m[2] + "/" + m[1] : (s || ""); }
  function table(cols, rows) {
    if (!rows.length) return "<p class='g-empty'><i>(Danh mục chưa có dữ liệu — vào Danh mục để khai báo.)</i></p>";
    return "<table class='g-tb'><thead><tr>" + cols.map(function (c) { return "<th>" + esc(c[0]) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (r) { return "<tr>" + cols.map(function (c) { return "<td>" + (c[2] ? c[1](r) : esc(c[1](r))) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>";
  }
  /** Dòng danh mục còn hiệu lực ở kỳ (năm, tháng) — cùng quy tắc với engine.js hieuLuc. */
  function active(E, list, key, nam, thang) { var m = E.hieuLuc(list || [], key, nam, thang); return Object.keys(m).sort().map(function (k) { return m[k]; }); }

  /** Giải thích "Cách tính" của mã lương → công chuẩn (đúng engine.congChuan). */
  function congChuanText(cachTinh) {
    var s = String(cachTinh || "").toLowerCase();
    if (/thực tế/.test(s)) return "Công chuẩn = số công thực tế đi làm trong tháng";
    if (/nhân với sản lượng/.test(s)) return "Tính theo sản lượng (tấn) × đơn giá khoán";
    if (/^số ngày của tháng\s*$/.test(s)) return "Công chuẩn = số ngày của tháng (28–31)";
    var m = /-\s*(\d+)\s*$/.exec(s);
    if (m) return "Công chuẩn = số ngày của tháng − số Chủ nhật − " + m[1];
    return "Công chuẩn = số ngày của tháng − số ngày Chủ nhật";
  }
  function luongText(r) {
    var ma = String(r["Mã lương"] || ""), ht = String(r["Mã hình thức lương"] || "");
    if (/SP/i.test(ht)) return "Lương sản phẩm = Sản lượng (tấn) × " + money(r["Số tiền khoán"]) + " đ/tấn" + (n(r["ĐK_Bù lương (công tối thiểu)"]) ? "; bù lương khi bình quân < " + r["ĐK_Bù lương (công tối thiểu)"] + " tấn/công, đơn giá bù " + money(r["Đơn giá bù lương"]) + " đ/công" : "");
    if (/^CĐ/i.test(ma) || /cố định/i.test(r["Cách tính"])) return "Lương cố định hằng tháng = Lương thỏa thuận (không phụ thuộc số công)";
    if (/^CN/i.test(ma) || /thực tế/i.test(r["Cách tính"])) return "Lương công nhật = Đơn giá ngày (Lương thỏa thuận) × số công thực tế";
    return "Lương thời gian = Lương thỏa thuận ÷ Công chuẩn × Công thực tế (tối đa bằng công chuẩn). " + congChuanText(r["Cách tính"]);
  }
  function phuCapText(r) {
    var ct = String(r["Cách tính"] || "");
    if (!ct.trim() || /cố định/i.test(ct)) return n(r["Tỷ lệ"]) ? "Cố định = Lương thỏa thuận × " + pct(r["Tỷ lệ"]) : "Cố định " + money(r["Số tiền"]) + " đ/tháng";
    var ref = n(r["Tham chiếu"]);
    return "Đủ " + (ref ? "(công chuẩn − " + ref + ")" : "công chuẩn") + " → hưởng đủ " + money(r["Số tiền"]) + " đ; thiếu công → " + money(r["Số tiền"]) + " ÷ công chuẩn × công thực tế";
  }
  function tangCaText(r) {
    var ma = String(r["Mã tăng ca"] || ""), hs = r["Hệ số tăng ca"];
    if (/TC5/i.test(ma)) return "Tiền cố định " + money(r["Tiền tăng ca (nếu tính cố định)"]) + " ÷ công chuẩn × công tăng ca";
    if (/TC6/i.test(ma)) return "Công vượt công chuẩn (không nhân hệ số) × đơn giá ngày";
    if (/TC3/i.test(ma)) return "(Công tăng ca + công Chủ nhật) × hệ số " + hs + " × đơn giá ngày";
    if (/TC1/i.test(ma)) return "[(Công tính lương − lễ − trung chuyển − phép − tăng ca − công chuẩn) + công tăng ca] × hệ số " + hs + " × đơn giá ngày";
    if (/TC2/i.test(ma)) return "Như TC1 nhưng trừ thêm công di chuyển; × hệ số " + hs + " × đơn giá ngày";
    return "Công tăng ca × hệ số " + hs + " × đơn giá ngày (lương công nhật: đơn giá × công tăng ca)";
  }

  // ===================== 1. Bắt đầu nhanh =====================
  function quickStart() {
    return "<h2>Bắt đầu nhanh — dùng lần đầu</h2>" +
      "<ol class='g-steps'>" +
      "<li><b>Tạo tài khoản Admin</b> (màn hình đầu tiên). Ghi lại <b>mã khôi phục</b> và cất ở nơi an toàn — đây là cách duy nhất vào lại app khi quên mật khẩu Admin.</li>" +
      "<li><b>Công ty & Sao lưu → Hồ sơ công ty</b>: nhập tên công ty, mã số thuế, địa chỉ (hiện trên phiếu lương).</li>" +
      "<li><b>Nạp danh mục chuẩn HAK</b> (cùng màn hình), rồi vào <b>Danh mục</b> kiểm tra từng bảng: Mã lương, Phụ cấp, Tăng ca, Hỗ trợ, Bảo hiểm, Thuế TNCN, Biểu thuế, Giảm trừ, Phòng ban, Chức vụ, Hình thức công. <b>Kế toán phải đối chiếu tỷ lệ BH, biểu thuế, giảm trừ với quy định hiện hành.</b></li>" +
      "<li><b>Người dùng & phân quyền</b>: Admin tạo tài khoản cho từng người, chọn vai trò, đặt mật khẩu tạm.</li>" +
      "<li><b>Nhân sự</b>: thêm nhân viên (hoặc <i>Tải file mẫu → điền → Nhập Excel</i>). Mỗi người cần: <b>hợp đồng lao động</b> + ít nhất 1 dòng <b>Lương & phụ lục HĐ</b> (mã lương, lương thỏa thuận, lương đóng BH, mã BH, phương thức thuế, phụ cấp, tăng ca), <b>tài khoản ngân hàng</b> nếu trả chuyển khoản, <b>người phụ thuộc</b> nếu có.</li>" +
      "<li>Từ tháng đầu tiên: làm theo <b>Quy trình tính lương hằng tháng</b> (tab bên cạnh).</li>" +
      "</ol>" +
      "<div class='g-note'><b>Mẹo nhập liệu:</b> mọi bảng đều có <i>📄 Tải file mẫu</i> (đúng tên cột) và <i>⬆ Nhập Excel</i> có <b>xem trước</b>; hoặc copy nhiều dòng từ Excel rồi <b>Ctrl+V</b> vào một ô. Ngày gõ 15/09/2026 hoặc 2026-09-15; tiền gõ 1.500.000 hoặc 1500000.</div>";
  }

  // ===================== 2. Quy trình tính lương hằng tháng =====================
  function process() {
    var step = function (no, title, who, body) { return "<div class='g-step'><div class='g-no'>" + no + "</div><div><h3>" + title + " <span class='g-who'>" + who + "</span></h3>" + body + "</div></div>"; };
    return "<h2>Quy trình tính lương hằng tháng</h2>" +
      "<p>Thời hạn từng bước (ngày trong tháng) do công ty quy định — ghi vào Quy chế, mục <i>Kỳ hạn trả lương</i>. Cột in nghiêng là vai trò phụ trách theo phân quyền mặc định.</p>" +
      step(1, "Cập nhật hồ sơ & biến động nhân sự", "Nhân sự", "<ul><li>Nhân viên mới: hồ sơ + hợp đồng + phụ lục lương + tài khoản ngân hàng.</li><li>Tăng lương / đổi chức vụ / đổi phòng ban: <b>thêm phụ lục mới</b> có ngày hiệu lực (không sửa phụ lục cũ đã dùng cho kỳ đã chốt).</li><li>Nghỉ việc: <i>Hồ sơ → Cho nghỉ việc</i> (ghi Ngày chấm dứt vào hợp đồng).</li><li>Người phụ thuộc mới / hết hiệu lực: tab <i>Nhân thân</i>.</li></ul>") +
      step(2, "Nhập chấm công", "Trưởng bộ phận / Kế toán lương", "<ul><li>Chọn <b>Kỳ lương</b> ở góc phải trên cùng, vào <b>Chấm công</b>. Mỗi dòng = 1 nhân viên × 1 hình thức công (BT thường, CL lễ, PN phép, TC tăng ca, CC tính cơm…).</li><li>Ô ngày: <code>1</code>, <code>0.5</code>, hoặc <code>1QC</code> (1 công + nhãn công tác QC để tính phụ cấp công tác).</li><li>Nhập Excel nhiều lần không bị trùng: dòng trùng → chọn <b>Bổ sung</b> hoặc <b>Ghi đè</b>; cùng ngày nhập 2 lần cùng số công chỉ tính 1 lần.</li></ul>") +
      step(3, "Nhập sản lượng, bơm dăm, thưởng/trừ, tạm ứng, suất cơm", "Kế toán lương", "<ul><li><b>Sản lượng</b>: mỗi phiếu cân gán cho người được tính; 1 phiếu chia nhiều người thì nhập nhiều dòng cùng số phiếu, tổng KL các dòng không vượt KL gốc.</li><li><b>Thưởng / Trừ</b>, <b>Tạm ứng</b>: theo Ngày hạch toán trong kỳ.</li></ul>") +
      step(4, "Kiểm tra dữ liệu trước khi tính", "Kế toán lương", "<ul><li><b>Công ty & Sao lưu → Kiểm tra dữ liệu</b> (Admin) hoặc xem cảnh báo trên màn hình Tính lương: trùng Mã NV/CCCD, chấm công trùng, ngày sai, thiếu hợp đồng/phụ lục, chuyển khoản thiếu số TK, phiếu cân chia nhiều người…</li><li>Xử lý hết mục <b>Critical/High</b>.</li></ul>") +
      step(5, "Tính lương & đối chiếu", "Kế toán lương", "<ul><li><b>Tính lương → ▶ Tính lương tháng …</b>. Đọc khung <b>Cần kiểm tra dữ liệu</b>.</li><li>Bấm vào 1 dòng để xem <b>chi tiết cách tính</b> và phiếu lương của người đó.</li><li>Đối chiếu: tổng công với bảng chấm công gốc, sản lượng với phiếu cân, <b>Báo cáo lương → Tổng hợp theo phòng ban / So sánh với kỳ trước</b> để phát hiện biến động bất thường.</li></ul>") +
      step(6, "Duyệt", "Người phê duyệt / Giám đốc", "<ul><li>Xuất Excel bảng lương (<i>Xuất Excel…</i>) hoặc in để duyệt theo quy trình của công ty.</li><li>Sai sót → quay lại bước 1–3 sửa dữ liệu, tính lại.</li></ul>") +
      step(7, "Chốt kỳ lương", "Kế toán lương", "<ul><li><b>🔒 Chốt kỳ lương</b>: app tính lại lần cuối, lưu bảng lương + dữ liệu đầu vào + danh mục, ghi người chốt. Dữ liệu phát sinh của kỳ bị <b>khóa</b>.</li><li>App chỉ báo chốt thành công khi đã ghi xuống đĩa.</li></ul>") +
      step(8, "Chi trả & kê khai", "Kế toán thanh toán", "<ul><li><b>Kỳ lương đã chốt → ⬇ Xuất trọn bộ Excel</b>: Bảng lương, BHXH, Thuế TNCN, Danh sách chuyển khoản.</li><li><b>Báo cáo lương → Phiếu chi lương / tạm ứng</b>, <b>Bảng hạch toán</b> cho kế toán tổng hợp.</li><li>In phiếu lương gửi người lao động (<i>In phiếu lương</i>).</li></ul>") +
      step(9, "Sao lưu", "Admin", "<ul><li>App tự sao lưu hằng ngày và trước mọi thao tác lớn; cuối mỗi kỳ vẫn nên <b>Sao lưu ra file</b> và cất sang USB/Drive.</li></ul>") +
      "<h3>Điều chỉnh sau khi đã chốt</h3><ol><li>Chỉ <b>Admin</b> được <b>Mở chốt</b> (bắt buộc ghi lý do). Bản chốt cũ được giữ trong lịch sử.</li><li>Sửa dữ liệu kỳ đó; thay đổi lương thì <b>thêm phụ lục mới</b> (phụ lục cũ đã dùng cho kỳ chốt không sửa được).</li><li>Tính lại → chốt lại thành <b>phiên bản mới</b> → <b>↔ So sánh</b> để xem ai chênh lệch, số tiền bao nhiêu → truy lĩnh/truy thu theo quy chế.</li></ol>";
  }

  // ===================== 3. Dự thảo Quy chế tính lương =====================
  function regulation(ctx) {
    var db = ctx.db, E = ctx.E, nam = ctx.nam, thang = ctx.thang, ct = ctx.congTy || {}, ten = ct["Tên công ty"] || "[TÊN CÔNG TY]";
    var L = active(E, db.dm_luong, "Mã lương", nam, thang), PC = active(E, db.dm_phucap, "Mã phụ cấp", nam, thang), TC = active(E, db.dm_tangca, "Mã tăng ca", nam, thang);
    var HT = active(E, db.dm_hotro, "Mã hỗ trợ", nam, thang), BH = active(E, db.dm_baohiem, "Mã bảo hiểm", nam, thang), TN = active(E, db.dm_tncn, "Mã thuế TNCN", nam, thang);
    var BT = active(E, db.dm_bacthue, "Bậc", nam, thang).sort(function (a, b) { return n(a["Thu nhập từ"]) - n(b["Thu nhập từ"]); }), GT = active(E, db.dm_giamtru, "Mã giảm trừ", nam, thang);
    var CC = (db.dm_cc || []).filter(function (r) { return r["Hình thức công"]; });
    // Nhãn công tác đang dùng trong chấm công (VD "1QC" → QC)
    var lab = {}; (db.chamcong || []).forEach(function (r) { for (var d = 1; d <= 31; d++) { var m0 = /^\s*\d+(?:[.,]\d+)?\s*([A-Za-zĐđ][\wĐđ.]*)\s*$/.exec(String(r[("0" + d).slice(-2)] == null ? "" : r[("0" + d).slice(-2)])); if (m0) lab[m0[1].toUpperCase()] = 1; } });
    var labels = Object.keys(lab).sort();
    var ky = thang + "/" + nam, dieu = 0, D = function (t) { dieu++; return "<h4>Điều " + dieu + ". " + t + "</h4>"; };
    var h = "";
    h += "<div class='g-doc-head'><div><b>" + esc(ten.toUpperCase()) + "</b><br>Số: …/" + nam + "/QC-" + esc((ct["Mã số thuế"] || "").slice(-4) || "…") + "</div><div><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><u>Độc lập – Tự do – Hạnh phúc</u><br><i>……, ngày … tháng … năm " + nam + "</i></div></div>";
    h += "<h1>QUY CHẾ TRẢ LƯƠNG, PHỤ CẤP VÀ CÁC KHOẢN THU NHẬP</h1><p class='g-center'><i>(Ban hành kèm theo Quyết định số …/" + nam + "/QĐ ngày …/…/" + nam + " của Giám đốc " + esc(ten) + ")</i></p>";
    h += "<div class='g-warn'><b>DỰ THẢO do phần mềm lập</b> từ danh mục đang áp dụng cho kỳ <b>" + ky + "</b> và đúng công thức phần mềm đang tính. Trước khi ban hành, công ty phải: (1) rà soát với quy định pháp luật hiện hành; (2) lấy ý kiến tổ chức đại diện người lao động tại cơ sở (nếu có); (3) quyết định các điểm ghi <b>[cần quyết định]</b>; (4) công bố công khai tại nơi làm việc.</div>";

    h += "<h3>Chương I. QUY ĐỊNH CHUNG</h3>";
    h += D("Căn cứ") + "<ul><li>Bộ luật Lao động năm 2019 (các điều về tiền lương: Điều 90 – 104) và các văn bản hướng dẫn hiện hành (Nghị định 145/2020/NĐ-CP…).</li><li>Nghị định quy định mức lương tối thiểu vùng đang có hiệu lực.</li><li>Luật Bảo hiểm xã hội, Luật Bảo hiểm y tế, Luật Việc làm (bảo hiểm thất nghiệp), Luật Công đoàn và văn bản hướng dẫn.</li><li>Luật Thuế thu nhập cá nhân và các văn bản sửa đổi, hướng dẫn có hiệu lực tại kỳ trả lương.</li><li>Điều lệ, Nội quy lao động, Thỏa ước lao động tập thể (nếu có) của " + esc(ten) + ".</li></ul><p class='g-small'><i>Ghi chú: phần mềm không thay thế việc đối chiếu văn bản pháp luật; số hiệu văn bản cần kế toán/pháp chế cập nhật khi ban hành.</i></p>";
    h += D("Phạm vi và đối tượng áp dụng") + "<p>Áp dụng cho người lao động làm việc theo hợp đồng lao động tại " + esc(ten) + ". Người làm việc theo hợp đồng dịch vụ/khoán việc: áp dụng khấu trừ thuế vãng lai theo mục Thuế thu nhập cá nhân của Quy chế này.</p>";
    h += D("Nguyên tắc trả lương") + "<ul><li>Trả lương theo vị trí công việc, hình thức lương và kết quả thực hiện công việc thỏa thuận trong <b>hợp đồng lao động và phụ lục hợp đồng</b>; không thấp hơn mức lương tối thiểu vùng đối với công việc giản đơn, thời giờ làm việc bình thường.</li><li>Mức lương của từng người áp dụng theo <b>phụ lục hợp đồng có hiệu lực mới nhất tính đến cuối kỳ lương</b>. Điều chỉnh lương, chức vụ, phòng ban được lập bằng <b>phụ lục mới</b>; không sửa phụ lục đã dùng cho kỳ lương đã chốt.</li><li>Công khai, minh bạch: người lao động được nhận phiếu lương ghi rõ từng khoản.</li></ul>";

    h += "<h3>Chương II. HÌNH THỨC TRẢ LƯƠNG VÀ CÁCH TÍNH</h3>";
    h += D("Các hình thức trả lương đang áp dụng") + table([["Mã", function (r) { return r["Mã lương"]; }], ["Hình thức", function (r) { return r["Hình thức lương"]; }], ["Cách tính", function (r) { return luongText(r); }], ["Lương phụ", function (r) { return n(r["Lương phụ"]) ? money(r["Lương phụ"]) : ""; }], ["Hiệu lực từ", function (r) { return dmy(r["Hiệu lực từ"]); }]], L);
    h += "<p>Đơn giá ngày (lương thời gian) = Lương thỏa thuận ÷ Công chuẩn. Công tính lương thời gian không vượt quá công chuẩn; phần vượt được xét theo mục Làm thêm giờ của Quy chế này. Lương bơm dăm = số xe × đơn giá bơm dăm của mã lương.</p>";
    h += D("Thời gian làm việc và chấm công") + "<p>Công được chấm hằng ngày theo các hình thức sau (mỗi người mỗi hình thức 1 dòng/tháng; cùng ngày, cùng hình thức nhập trùng chỉ tính 1 lần):</p>" + table([["Hình thức", function (r) { return r["Hình thức công"]; }], ["Nội dung", function (r) { return r["Diễn giải"] || r["Nội dung"]; }], ["Nhóm", function (r) { return r["Nội dung"]; }]], CC) +
      "<p><b>Tổng công</b> tính lương = tổng công mọi hình thức trừ công tính cơm (CC). <b>[cần quyết định — Q-02]</b> Hiện tổng công <b>gồm cả công tăng ca</b> (theo cách tính của bảng lương gốc); công ty xác nhận có giữ quy ước này không.</p>";

    h += "<h3>Chương III. PHỤ CẤP, HỖ TRỢ, LÀM THÊM GIỜ</h3>";
    h += D("Phụ cấp") + table([["Mã", function (r) { return r["Mã phụ cấp"]; }], ["Tên", function (r) { return r["Tên phụ cấp"]; }], ["Mức / cách hưởng", function (r) { return phuCapText(r); }]], PC) +
      "<p>Bảng trên mô tả phụ cấp khi được <b>gán trong phụ lục hợp đồng</b> (hưởng theo tháng). Ngoài ra, <b>phụ cấp công tác theo ngày</b>: ngày công có nhãn (VD <code>1QC</code>) được hưởng <b>mức (Số tiền) của mã phụ cấp trùng tên nhãn × số ngày có nhãn</b>" +
      (labels.length ? " — các nhãn đang dùng trong chấm công: " + labels.map(function (x) { var r = PC.filter(function (p) { return p["Mã phụ cấp"] === x; })[0]; return "<b>" + esc(x) + "</b>" + (r ? " " + money(r["Số tiền"]) + " đ/ngày" : " (chưa có mã phụ cấp — không được tính)"); }).join(", ") : "") +
      ". <b>[cần quyết định — Q-09]</b> Hiện áp dụng cho mọi dòng chấm công có nhãn (kể cả lễ/phép).</p>";
    h += D("Hỗ trợ") + table([["Mã", function (r) { return r["Mã hỗ trợ"]; }], ["Tên", function (r) { return r["Tên hỗ trợ"]; }], ["Mức", function (r) { return money(r["Số tiền"]) + " đ"; }], ["Cách tính", function (r) { return r["Cách tính"]; }]], HT);
    h += D("Làm thêm giờ (tăng ca)") + table([["Mã", function (r) { return r["Mã tăng ca"]; }], ["Nội dung", function (r) { return r["Nội dung tăng ca"]; }], ["Cách tính", function (r) { return tangCaText(r); }]], TC) +
      "<p><b>[cần quyết định — Q-17]</b> Bộ luật Lao động quy định tiền lương làm thêm giờ <b>ít nhất 150%</b> (ngày thường), <b>200%</b> (ngày nghỉ hằng tuần), <b>300%</b> (ngày lễ, Tết, ngày nghỉ có hưởng lương) so với lương giờ/ngày bình thường. Công ty cần đối chiếu hệ số tăng ca đang khai báo (và việc công tăng ca đã được tính trong Tổng công) với mức tối thiểu này trước khi ban hành.</p>";
    h += D("Thưởng và thu nhập khác") + "<p>Thưởng, thu nhập khác được ghi theo từng quyết định/chứng từ, tính vào kỳ lương có Ngày hạch toán thuộc kỳ. Mức và điều kiện thưởng theo Quy chế thưởng riêng của công ty.</p>";

    h += "<h3>Chương IV. BẢO HIỂM, KINH PHÍ CÔNG ĐOÀN, THUẾ TNCN</h3>";
    h += D("Bảo hiểm xã hội, y tế, thất nghiệp, kinh phí công đoàn") + table([["Mã", function (r) { return r["Mã bảo hiểm"]; }], ["Nội dung", function (r) { return r["Nội dung"]; }],
      ["Công ty đóng", function (r) { return "BHXH " + pct(r["DN.BHXH"]) + " · BHYT " + pct(r["DN.BHYT"]) + " · BHTN " + pct(r["DN.BHTN"]) + " · KPCĐ " + pct(r["DN.KPCD"]); }],
      ["Người lao động đóng", function (r) { return "BHXH " + pct(r["NLD.BHXH"]) + " · BHYT " + pct(r["NLD.BHYT"]) + " · BHTN " + pct(r["NLD.BHTN"]); }]], BH) +
      "<ul><li>Tiền lương đóng bảo hiểm = <b>Lương cơ bản</b> ghi trong phụ lục; nếu không ghi thì lấy Lương thỏa thuận. <b>[cần quyết định — Q-07]</b> Với lương công nhật/sản phẩm (lương thỏa thuận là đơn giá), phải ghi Lương cơ bản để đóng BH đúng.</li>" +
      "<li><b>[cần quyết định — Q-06]</b> Chưa áp dụng mức trần tiền lương đóng BHXH/BHTN.</li>" +
      "<li>Tháng có số công dưới <i>Ngưỡng truy thu BH</i> của mã lương: người lao động không bị trừ phần BH thường mà bị <b>truy thu phần công ty đóng</b>. <b>[cần quyết định — Q-04]</b></li></ul>";
    h += D("Thuế thu nhập cá nhân") + table([["Mã", function (r) { return r["Mã thuế TNCN"]; }], ["Phương thức", function (r) { return r["Nội dung"]; }], ["Mức", function (r) { return n(r["Mức thuế"]) ? pct(r["Mức thuế"]) : ""; }], ["Ghi chú", function (r) { return r["Ghi chú"]; }]], TN) +
      "<p><b>Biểu thuế lũy tiến từng phần</b> áp dụng kỳ " + ky + ":</p>" + table([["Bậc", function (r) { return r["Bậc"]; }], ["Thu nhập tính thuế/tháng", function (r) { return "từ " + money(r["Thu nhập từ"]) + (n(r["Thu nhập đến"]) ? " đến " + money(r["Thu nhập đến"]) : " trở lên"); }], ["Thuế suất", function (r) { return pct(r["Tỷ lệ"]); }]], BT) +
      "<p><b>Giảm trừ gia cảnh</b>:</p>" + table([["Mã", function (r) { return r["Mã giảm trừ"]; }], ["Đối tượng", function (r) { return /NPT/i.test(r["Mã giảm trừ"]) ? "Mỗi người phụ thuộc" : "Bản thân người nộp thuế"; }], ["Mức/tháng", function (r) { return money(r["Số tiền"]) + " đ"; }]], GT) +
      "<ul><li>Lũy tiến: thu nhập chịu thuế = Tổng thu nhập − BH người lao động đóng − tiền cơm; thu nhập tính thuế = thu nhập chịu thuế − giảm trừ bản thân − số người phụ thuộc × giảm trừ người phụ thuộc. <b>[cần quyết định — Q-03]</b> Hiện loại trừ <b>toàn bộ</b> tiền cơm.</li>" +
      "<li>Người phụ thuộc: chỉ tính người đã đăng ký và còn hiệu lực trong kỳ.</li>" +
      "<li>Khấu trừ vãng lai: Tổng thu nhập × mức khấu trừ. <b>[cần quyết định — Q-10]</b> Hiện áp dụng cho mọi khoản chi, chưa xét ngưỡng.</li>" +
      "<li class='g-small'><i>Biểu thuế và mức giảm trừ trên là số liệu khai báo trong phần mềm; kế toán chịu trách nhiệm đối chiếu với văn bản pháp luật có hiệu lực tại kỳ trả lương.</i></li></ul>";

    h += "<h3>Chương V. KHẤU TRỪ, TẠM ỨNG, THỰC LĨNH, KỲ HẠN TRẢ LƯƠNG</h3>";
    h += D("Khấu trừ và tạm ứng") + "<p>Các khoản khấu trừ vào lương gồm: bảo hiểm phần người lao động, truy thu bảo hiểm (nếu có), thuế TNCN, tạm ứng trong kỳ, các khoản trừ khác có chứng từ. Việc khấu trừ để bồi thường thiệt hại thực hiện theo Bộ luật Lao động (người lao động được biết lý do; mức khấu trừ hằng tháng không vượt mức luật định).</p>";
    h += D("Thực lĩnh và làm tròn") + "<p>Thực lĩnh = Tổng thu nhập − BH người lao động − Truy thu BH − Thuế TNCN − Trừ khác − Tạm ứng, <b>làm tròn đến 1.000 đồng</b>. Nếu tổng khoản trừ lớn hơn thu nhập, thực lĩnh bằng 0 và phần chênh lệch được xử lý theo <b>[cần quyết định — Q-05]</b> (chuyển kỳ sau / thu hồi / miễn).</p>";
    h += D("Hình thức và kỳ hạn trả lương") + "<ul><li>Trả bằng chuyển khoản vào tài khoản người lao động đăng ký, hoặc tiền mặt theo thỏa thuận (ghi trong phụ lục: <i>HTTT</i>). Phí mở tài khoản và chuyển tiền lương do công ty chịu (Điều 96 Bộ luật Lao động 2019).</li><li>Kỳ trả lương: hằng tháng, chậm nhất ngày <b>[…] </b> của tháng kế tiếp <b>[cần quyết định]</b>. Tạm ứng trong tháng: ngày <b>[…]</b>, mức tối đa <b>[…]</b>.</li><li>Người lao động được nhận <b>phiếu lương</b> ghi rõ từng khoản; thắc mắc phản hồi trong <b>[…]</b> ngày kể từ ngày nhận.</li></ul>";

    h += "<h3>Chương VI. CHỐT LƯƠNG, ĐIỀU CHỈNH VÀ LƯU TRỮ</h3>";
    h += D("Chốt kỳ lương") + "<p>Bảng lương sau khi được duyệt được <b>chốt</b> trên phần mềm; dữ liệu chấm công, sản lượng, thưởng/trừ, tạm ứng của kỳ bị khóa. Bản chốt lưu kèm dữ liệu đầu vào, danh mục, người chốt, thời điểm và mã kiểm tra toàn vẹn.</p>";
    h += D("Điều chỉnh sau khi chốt") + "<ul><li>Chỉ <b>Quản trị (Admin)</b> được mở chốt, bắt buộc ghi lý do; bản chốt cũ được lưu trong lịch sử, không bị xóa.</li><li>Dữ liệu có hiệu lực hồi tố vào kỳ đã chốt chỉ Admin được nhập; phụ lục hợp đồng đã dùng cho kỳ đã chốt <b>không được sửa</b>, mọi thay đổi lập bằng phụ lục mới.</li><li>Sau khi chốt lại, chênh lệch được truy lĩnh / truy thu ở kỳ <b>[…]</b> <b>[cần quyết định]</b> và thông báo cho người lao động.</li></ul>";
    h += D("Bảo mật và lưu trữ") + "<p>Thông tin tiền lương là thông tin bảo mật; chỉ người được phân quyền mới xem. Dữ liệu được sao lưu tự động hằng ngày; bảng lương đã chốt và nhật ký thao tác được lưu trữ theo thời hạn lưu trữ chứng từ kế toán.</p>";

    h += "<h3>Chương VII. ĐIỀU KHOẢN THI HÀNH</h3>";
    h += D("Hiệu lực") + "<p>Quy chế có hiệu lực từ ngày …/…/" + nam + ". Các đơn vị, phòng ban và người lao động có trách nhiệm thực hiện. Quy chế được xem xét sửa đổi khi pháp luật hoặc điều kiện sản xuất kinh doanh thay đổi.</p>";
    h += "<div class='g-sign'><div><b>ĐẠI DIỆN TỔ CHỨC ĐẠI DIỆN NLĐ</b><br><i>(nếu có)</i></div><div><b>GIÁM ĐỐC</b><br><i>(ký, ghi rõ họ tên, đóng dấu)</i><br><br><br>" + esc(ct["Người đại diện pháp luật"] || "") + "</div></div>";
    h += "<div class='g-warn g-noprint'><b>Các điểm cần công ty quyết định trước khi ban hành</b> (phần mềm đang áp dụng như mô tả, không tự đổi công thức): Q-01 phụ lục giữa tháng · Q-02 tổng công gồm tăng ca · Q-03 tiền cơm và thuế · Q-04 truy thu BH · Q-05 khoản trừ vượt thu nhập · Q-06 trần BH · Q-07 lương đóng BH với công nhật · Q-08 chia sản lượng nhiều người · Q-09 phụ cấp công tác · Q-10 khấu trừ vãng lai · Q-17 mức tăng ca tối thiểu theo luật. Chi tiết: <code>docs/BUSINESS_RULES.md</code>.</div>";
    return h;
  }

  // ===================== 4. Hướng dẫn từng màn hình =====================
  function screens() {
    var S = [
      ["Trang chủ", "Các bước bắt đầu (tick xanh khi đã làm) và nút tải file mẫu Excel trọn bộ."],
      ["Tính lương", "Chọn kỳ ở góc phải trên → <b>▶ Tính lương</b>. Khung vàng liệt kê dữ liệu cần kiểm tra. Bấm 1 dòng để xem chi tiết cách tính và phiếu lương. <i>Xem đủ cột</i> hiện mọi khoản. <i>Xuất Excel…</i> chọn Bảng lương / BHXH / Thuế / Chuyển khoản. <b>🔒 Chốt kỳ lương</b> khi đã duyệt."],
      ["Kỳ lương đã chốt", "Danh sách kỳ đã chốt: phiên bản, thời điểm, người chốt, tổng tiền, <b>Toàn vẹn</b> (Nguyên vẹn = số đã chốt chưa bị sửa). <i>Xem</i> mở bảng đã chốt; <i>Excel</i> xuất trọn bộ; <i>Mở chốt</i> (Admin); <i>↔ So sánh</i> giữa các phiên bản; <i>Đối chiếu với dữ liệu hiện tại</i>."],
      ["Báo cáo lương", "Tổng hợp theo phòng ban, tổng hợp công, phân bổ sản lượng, bảng hạch toán (TK chi phí theo phòng ban), phiếu chi lương/tạm ứng, so sánh với kỳ trước, lương 12 tháng, thu nhập năm theo NV, thuế TNCN cả năm. Kỳ chưa chốt hiện cảnh báo <i>số liệu tạm</i>."],
      ["Chấm công", "1 dòng = 1 NV × 1 hình thức công. Ô ngày: 1, 0.5, 1QC (nhãn công tác). Cột đỏ nhạt = Chủ nhật. Dán nhiều dòng từ Excel bằng Ctrl+V. Kỳ đã chốt chỉ xem."],
      ["Sản lượng / Bơm dăm", "Mỗi dòng = 1 phiếu cân của 1 người (Phiếu cân, Ngày cân, Biển số, KL tấn). Bơm dăm: cột KL là <b>số xe</b>. 1 phiếu chia nhiều người → nhiều dòng cùng số phiếu (app cảnh báo để đối chiếu tổng)."],
      ["Thưởng / Trừ · Tạm ứng · Suất cơm", "Ghi theo ngày hạch toán; tự vào kỳ lương có ngày đó."],
      ["Nhân sự", "Danh sách nhân viên, tìm kiếm, lọc trạng thái, <i>＋ Thêm nhân viên</i> (1 form gồm hồ sơ + hợp đồng + lương + tài khoản), nhập Excel nhiều sheet, Sổ quản lý lao động. Bấm 1 người để mở <b>Hồ sơ</b>."],
      ["Hồ sơ nhân viên", "Các tab: Thông tin cá nhân, Hợp đồng lao động (chọn hợp đồng → Lương & phụ lục HĐ, phép, nghỉ ốm, khám SK, khen thưởng/kỷ luật, tài liệu), Nhân thân/người phụ thuộc, Tài khoản nhận lương, Quá trình công tác… <i>Cho nghỉ việc</i>, <i>Lịch sử</i>. Phụ lục đã dùng cho kỳ đã chốt có khóa — thay đổi bằng <i>＋ Thêm</i> phụ lục mới."],
      ["Báo cáo nhân sự", "Hợp đồng sắp hết hạn, tình hình nhân sự, nghỉ phép/ốm, vi phạm, sinh nhật trong tháng, sổ quản lý lao động, lịch sử nhân sự — đều xuất Excel được."],
      ["Danh mục", "Mã lương, phụ cấp, tăng ca, hỗ trợ, bảo hiểm, thuế TNCN, biểu thuế, giảm trừ, phòng ban (kèm TK chi phí), chức vụ, hình thức công. Thay đổi chính sách: <b>thêm dòng mới có Hiệu lực từ</b> thay vì sửa dòng cũ, để kỳ cũ vẫn tính đúng. Sửa dòng có hiệu lực vào kỳ đã chốt: chỉ Admin."],
      ["Công ty & Sao lưu (Admin)", "Hồ sơ công ty · Người dùng & phân quyền · Sao lưu ra file / Khôi phục · Nạp danh mục chuẩn · Nhập Excel tổng · Các bản sao lưu tự động (kiểm tra SHA-256, khôi phục) · Kiểm tra dữ liệu (kèm nút gộp chấm công trùng) · Nhật ký thao tác."],
      ["Nhập Excel", "Luôn qua <b>xem trước</b>: Thêm mới / Cập nhật / Gộp / Trùng / Xung đột / Lỗi / Sai tham chiếu / Kỳ đã chốt. Có dòng trùng → chọn <b>Bổ sung</b> (ô trống giữ số cũ) hoặc <b>Ghi đè</b>. Tải chi tiết để sửa file. App sao lưu trước khi ghi; lưu lỗi thì hủy cả lần nhập."]
    ];
    return "<h2>Hướng dẫn từng màn hình</h2>" + S.map(function (x) { return "<div class='g-scr'><h3>" + x[0] + "</h3><p>" + x[1] + "</p></div>"; }).join("");
  }

  // ===================== 5. Câu hỏi thường gặp =====================
  function faq() {
    var Q = [
      ["Nhân viên không có trong bảng lương?", "Kiểm tra: có hợp đồng còn hiệu lực trong kỳ (Ngày vào làm ≤ cuối tháng, chưa chấm dứt trước đầu tháng) và có ít nhất 1 dòng <i>Lương & phụ lục HĐ</i> hiệu lực ≤ cuối tháng. Khung cảnh báo trên màn hình Tính lương ghi rõ lý do."],
      ["Lương tháng này vẫn theo mức cũ dù đã tăng lương?", "Phụ lục mới phải có <i>Hiệu lực từ</i> ≤ ngày cuối tháng đó. Phụ lục giữa tháng hiện được áp dụng cho cả tháng [Q-01]."],
      ["Nhập lại file chấm công có bị nhân đôi công không?", "Không. Dòng cùng Kỳ + Mã NV + Hình thức công được cập nhật (Bổ sung / Ghi đè); cùng ngày nhập trùng cùng số công chỉ tính 1 lần."],
      ["Muốn sửa chấm công của tháng đã chốt?", "Nhờ Admin <i>Mở chốt</i> (ghi lý do) → sửa → tính lại → chốt lại (phiên bản mới) → <i>So sánh</i> để biết chênh lệch."],
      ["Không sửa được phụ lục lương?", "Phụ lục đã dùng cho kỳ lương đã chốt bị khóa (quy chế). Bấm <i>＋ Thêm</i> để lập phụ lục mới — app tự chép nội dung phụ lục gần nhất."],
      ["Quên mật khẩu?", "Người dùng thường: nhờ Admin đặt lại mật khẩu tạm. Admin: ở màn hình đăng nhập bấm <i>Quên mật khẩu Admin…</i> và nhập mã khôi phục."],
      ["Báo \"Không mở được file dữ liệu\"?", "App không ghi đè file. Chọn một bản sao lưu trong danh sách để khôi phục (bản có dấu ✓ Nguyên vẹn), hoặc khôi phục từ file bạn đã cất. File lỗi được giữ lại với tên data.corrupt_…"],
      ["Đổi máy tính?", "Máy cũ: <i>Sao lưu ra file</i>. Máy mới: cài app → đăng nhập/khởi tạo → <i>Khôi phục từ file</i>."]
    ];
    return "<h2>Câu hỏi thường gặp</h2>" + Q.map(function (x) { return "<div class='g-scr'><h3>" + x[0] + "</h3><p>" + x[1] + "</p></div>"; }).join("");
  }

  var TABS = [["start", "Bắt đầu nhanh"], ["process", "Quy trình tính lương"], ["rules", "Quy chế tính lương (dự thảo)"], ["screens", "Hướng dẫn từng màn hình"], ["faq", "Câu hỏi thường gặp"]];
  /** Nội dung HTML của 1 phần. ctx: { db, E, nam, thang, congTy } */
  function section(key, ctx) {
    if (key === "process") return process();
    if (key === "rules") return regulation(ctx);
    if (key === "screens") return screens();
    if (key === "faq") return faq();
    return quickStart();
  }
  /** File Word (.doc dạng HTML — Word mở và sửa được) của Dự thảo Quy chế. */
  function regulationDoc(ctx) {
    var css = "body{font-family:'Times New Roman',serif;font-size:13pt;line-height:1.4}h1{text-align:center;font-size:15pt}h3{font-size:13pt;margin-top:14pt}h4{font-size:13pt;margin:8pt 0 4pt}" +
      "table{border-collapse:collapse;width:100%;margin:4pt 0 8pt}td,th{border:1px solid #444;padding:3pt 5pt;font-size:11pt;vertical-align:top}th{background:#eee}.g-doc-head{display:flex;justify-content:space-between;text-align:center}.g-center{text-align:center}.g-warn{border:1px solid #b08d4c;background:#fff8ec;padding:6pt}.g-sign{display:flex;justify-content:space-between;text-align:center;margin-top:24pt}.g-small{font-size:11pt}";
    return "<html><head><meta charset='utf-8'><title>Quy che tra luong</title><style>" + css + "</style></head><body>" + regulation(ctx) + "</body></html>";
  }
  return { TABS: TABS, section: section, regulationDoc: regulationDoc, luongText: luongText, phuCapText: phuCapText, tangCaText: tangCaText, congChuanText: congChuanText };
});
