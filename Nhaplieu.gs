// ================= NẠP DỮ LIỆU TỪ FILE TẢI LÊN =================
// Cho phép tải thẳng file Excel/CSV Bảng chấm công hoặc Phiếu cân sản lượng lên,
// thay vì phải gõ tay từng dòng vào Google Sheet. Chấp nhận .xlsx/.xls/.csv, tiêu
// đề cột linh hoạt (không cần đúng 100% tên cột, xem anhXaCotChamCong_/
// anhXaCotSanLuong_ bên dưới) — khớp gần đúng với cấu trúc sheet DL_Chamcong/
// DL_Sanluong/DL_Bandam thật của HAK Group nên thường tải thẳng lên là dùng được.
//
// ⚠️ ĐỌC FILE .xlsx/.xls CẦN BẬT "Drive API" (Advanced Google Services):
// Trong Apps Script Editor → Services (dấu +) → chọn "Drive API" → Add.
// Không cần bước này nếu chỉ tải file .csv.

/** Đọc 1 file (blob) thành mảng 2 chiều [ [tiêu đề...], [dòng 1...], ... ]. */
function docBangTuBlob_(blob, tenFile) {
  const ten = (tenFile || "").toLowerCase();
  if (ten.endsWith(".csv")) {
    return chuanHoaNgayTrongBangCSV_(Utilities.parseCsv(blob.getDataAsString("UTF-8")));
  }
  // .xlsx/.xls — chuyển tạm thành Google Sheet để đọc, sau đó xoá file tạm
  const resource = { name: "tmp_import_" + new Date().getTime(), mimeType: MimeType.GOOGLE_SHEETS };
  const file = Drive.Files.create(resource, blob);
  try {
    const ss = SpreadsheetApp.openById(file.id);
    const sh = ss.getSheets()[0];
    return sh.getDataRange().getValues();
  } finally {
    Drive.Files.remove(file.id);
  }
}

/**
 * ⚠ LỖI THẬT ĐÃ PHÁT HIỆN VÀ SỬA (kiểm chứng qua test tích hợp giả lập tải file
 * .csv thật, phát hiện MỌI dòng bị báo "Ngày ... không hợp lệ" dù dữ liệu đúng):
 * đọc file .xlsx qua `SpreadsheetApp` (nhánh dưới) tự động nhận diện ô ngày
 * thành Date object thật — nhưng đọc .csv qua `Utilities.parseCsv()` trả về
 * TOÀN BỘ giá trị dưới dạng CHUỖI TEXT thuần, kể cả cột ngày. Mọi hàm đối
 * chiếu (doiChieuNhapChamCong_/doiChieuNhapSanLuong_/doiChieuNhapUngLuong_/
 * doiChieuNhapPSLuong_) đều kiểm tra "... instanceof Date" để coi là hợp lệ —
 * khiến tải file .csv lên (kể cả đúng mẫu do CHÍNH webapp xuất ra qua nút
 * "Tải mẫu") LUÔN báo lỗi ở MỌI dòng, dù dữ liệu hoàn toàn đúng. Sửa: tự động
 * nhận diện và chuyển các ô dạng "dd/mm/yyyy" hoặc "yyyy-mm-dd" thành Date
 * object thật ngay sau khi đọc CSV, khớp đúng hành vi đọc .xlsx đã có sẵn.
 */
function chuanHoaNgayTrongBangCSV_(rows) {
  if (!rows || rows.length < 2) return rows;
  return [rows[0]].concat(rows.slice(1).map(function (row) {
    return row.map(chuanHoaOCSVThanhNgayNeuHopLe_);
  }));
}

function chuanHoaOCSVThanhNgayNeuHopLe_(v) {
  if (typeof v !== "string") return v;
  const s = v.trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // dd/MM/yyyy (mẫu CSV webapp xuất ra)
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (!isNaN(d.getTime())) return d;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); // yyyy-MM-dd (ISO)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!isNaN(d.getTime())) return d;
  }
  return v;
}

function chuanHoaTieuDe_(s) {
  return String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Ánh xạ tiêu đề cột của file Bảng chấm công người dùng tải lên → tên cột chuẩn. */
function anhXaCotChamCong_(hangTieuDe) {
  const dongNghia = {
    "tt": "TT",
    "ngày tính công": "Ngày tính công",
    "mã pb": "Mã PB",
    "mã cv": "Mã CV",
    "mã nv": "Mã NV",
    "họ và tên": "Họ và tên",
    "hình thức công": "Hình thức công", "hinh thức công": "Hình thức công"
  };
  return hangTieuDe.map(function (tieuDe) {
    const chuan = chuanHoaTieuDe_(tieuDe);
    if (dongNghia[chuan]) return dongNghia[chuan];
    // cột ngày 1..31 (chấp nhận "1", "01", " 5 "...)
    if (/^\d{1,2}$/.test(chuan)) {
      const soNgay = parseInt(chuan, 10);
      if (soNgay >= 1 && soNgay <= 31) return ("0" + soNgay).slice(-2);
    }
    return null; // cột không nhận diện được — bỏ qua, không nạp vào sheet
  });
}

/** Ánh xạ tiêu đề cột của file Phiếu cân sản lượng người dùng tải lên → tên cột chuẩn. */
function anhXaCotSanLuong_(hangTieuDe) {
  const dongNghia = {
    "phiếu cân": "Phiếu cân",
    "ngày cân": "Ngày cân", "ngày cân 1": "Ngày cân",
    "giờ cân": "Giờ cân", "giờ cân 1": "Giờ cân",
    "biển số": "Biển số", "biển số 1": "Biển số",
    "cân lần 1": "Cân lần 1",
    "cân lần 2": "Cân lần 2",
    "kl hàng (tấn)": "KL hàng (Tấn)", "khối lượng (tấn)": "KL hàng (Tấn)", "kl hàng": "KL hàng (Tấn)",
    "mã phòng ban": "Mã phòng ban",
    "mã nv": "Mã NV"
    // Cột "Ngày cân 2"/"Giờ cân 2"/"NV vắng" của file gốc HAK Group không dùng ở
    // đây (mô hình đơn giản hoá không tách lần cân đi/về) — sẽ tự bị bỏ qua.
  };
  return hangTieuDe.map(function (tieuDe) {
    return dongNghia[chuanHoaTieuDe_(tieuDe)] || null;
  });
}

/** Ánh xạ tiêu đề cột của file Ứng lương người dùng tải lên → tên cột chuẩn (khớp HEADER_UNGLUONG). */
function anhXaCotUngLuong_(hangTieuDe) {
  const dongNghia = {
    "ngày hạch toán": "Ngày hạch toán",
    "số phiếu chi": "Số phiếu chi",
    "mã nv": "Mã NV",
    "người nhận": "Người nhận",
    "diễn giải": "Diễn giải",
    "tài khoản": "Tài khoản",
    "tk đối ứng": "TK đối ứng",
    "tạm ứng": "Tạm ứng",
    "thanh toán tm": "Thanh toán TM"
  };
  return hangTieuDe.map(function (tieuDe) {
    return dongNghia[chuanHoaTieuDe_(tieuDe)] || null;
  });
}

/** Ánh xạ tiêu đề cột của file Phát sinh lương người dùng tải lên → tên cột chuẩn (khớp HEADER_PSLUONG). */
function anhXaCotPSLuong_(hangTieuDe) {
  const dongNghia = {
    "ngày hạch toán": "Ngày hạch toán",
    "mã nv": "Mã NV",
    "người nhận": "Người nhận",
    "diễn giải": "Diễn giải",
    "tài khoản": "Tài khoản",
    "tk đối ứng": "TK đối ứng",
    "thưởng": "Thưởng",
    "thu nhập khác": "Thu nhập khác",
    "trừ khác": "Trừ khác"
  };
  return hangTieuDe.map(function (tieuDe) {
    return dongNghia[chuanHoaTieuDe_(tieuDe)] || null;
  });
}

/**
 * Chuyển bảng thô (rows[0] = tiêu đề, rows[1..] = dữ liệu) thành danh sách object
 * theo tên cột CHUẨN, dùng hàm anhXaCot để map — bỏ qua cột lạ, bỏ qua dòng trống.
 */
function chuyenBangThanhDanhSachObject_(rows, anhXaCot) {
  if (!rows || rows.length < 2) return { list: [], cotBiBoQua: [] };
  const header = rows[0];
  const map = anhXaCot(header);
  const cotBiBoQua = [];
  header.forEach(function (tieuDe, i) { if (!map[i] && String(tieuDe).trim() !== "") cotBiBoQua.push(tieuDe); });

  const list = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every(function (v) { return v === "" || v === null || v === undefined; })) continue;
    const obj = {};
    for (let c = 0; c < header.length; c++) {
      if (map[c]) obj[map[c]] = row[c];
    }
    list.push(obj);
  }
  return { list: list, cotBiBoQua: cotBiBoQua };
}

/**
 * Đối chiếu 1 danh sách chấm công NHÁP với NL_NHANSU/DM_PHONGBAN — gắn thêm cột
 * "✔ Kiểm tra" = "OK" hoặc "Lỗi: <lý do>" vào từng dòng.
 * @return {{ list: Array<Object>, soLoi: number }}
 */
function doiChieuNhapChamCong_(list) {
  const nhanSuSet = {};
  docSheetThanhObject_(SHEET_NHANSU, HEADER_NHANSU).forEach(function (ns) { nhanSuSet[ns["Mã nhân viên"]] = true; });
  const phongBanSet = {};
  docSheetThanhObject_(SHEET_DM_PHONGBAN, HEADER_DM_PHONGBAN).forEach(function (pb) { phongBanSet[pb["Mã phòng ban"]] = true; });

  let soLoi = 0;
  const ketQua = list.map(function (row) {
    const loi = [];
    if (!row["Mã NV"]) loi.push("thiếu Mã NV");
    else if (!nhanSuSet[row["Mã NV"]]) loi.push("Mã NV \"" + row["Mã NV"] + "\" không có trong NL_NHANSU");
    if (row["Mã PB"] && !phongBanSet[row["Mã PB"]]) loi.push("Mã PB \"" + row["Mã PB"] + "\" không có trong DM_PHONGBAN");
    if (!(row["Ngày tính công"] instanceof Date)) loi.push("Ngày tính công không hợp lệ");
    if (loi.length) soLoi++;
    row["✔ Kiểm tra"] = loi.length ? ("Lỗi: " + loi.join("; ")) : "OK";
    return row;
  });
  return { list: ketQua, soLoi: soLoi };
}

/**
 * Đối chiếu 1 danh sách phiếu cân NHÁP với NL_NHANSU/DM_PHONGBAN — gắn thêm cột
 * "✔ Kiểm tra". Mã NV không bắt buộc phải có (phiếu chưa gán người vẫn hợp lệ,
 * chỉ cảnh báo ở bước Kiểm tra bảng lương sau này) nhưng NẾU CÓ thì phải đúng.
 */
function doiChieuNhapSanLuong_(list) {
  const nhanSuSet = {};
  docSheetThanhObject_(SHEET_NHANSU, HEADER_NHANSU).forEach(function (ns) { nhanSuSet[ns["Mã nhân viên"]] = true; });
  const phongBanSet = {};
  docSheetThanhObject_(SHEET_DM_PHONGBAN, HEADER_DM_PHONGBAN).forEach(function (pb) { phongBanSet[pb["Mã phòng ban"]] = true; });

  let soLoi = 0;
  const ketQua = list.map(function (row) {
    const loi = [];
    if (!(row["Ngày cân"] instanceof Date)) loi.push("Ngày cân không hợp lệ");
    if (!row["Mã phòng ban"]) loi.push("thiếu Mã phòng ban");
    else if (!phongBanSet[row["Mã phòng ban"]]) loi.push("Mã phòng ban \"" + row["Mã phòng ban"] + "\" không có trong DM_PHONGBAN");
    if (row["Mã NV"] && !nhanSuSet[row["Mã NV"]]) loi.push("Mã NV \"" + row["Mã NV"] + "\" không có trong NL_NHANSU");
    const kl = Number(row["KL hàng (Tấn)"]);
    if (!kl || kl <= 0) loi.push("KL hàng (Tấn) phải là số dương");
    if (loi.length) soLoi++;
    row["✔ Kiểm tra"] = loi.length ? ("Lỗi: " + loi.join("; ")) : "OK";
    return row;
  });
  return { list: ketQua, soLoi: soLoi };
}

/**
 * Đối chiếu 1 danh sách Ứng lương NHÁP với NL_NHANSU — gắn thêm cột "✔ Kiểm tra".
 */
function doiChieuNhapUngLuong_(list) {
  const nhanSuSet = {};
  docSheetThanhObject_(SHEET_NHANSU, HEADER_NHANSU).forEach(function (ns) { nhanSuSet[ns["Mã nhân viên"]] = true; });

  let soLoi = 0;
  const ketQua = list.map(function (row) {
    const loi = [];
    if (!row["Mã NV"]) loi.push("thiếu Mã NV");
    else if (!nhanSuSet[row["Mã NV"]]) loi.push("Mã NV \"" + row["Mã NV"] + "\" không có trong NL_NHANSU");
    if (!(row["Ngày hạch toán"] instanceof Date)) loi.push("Ngày hạch toán không hợp lệ");
    const tamUng = Number(row["Tạm ứng"]);
    if (row["Tạm ứng"] !== "" && row["Tạm ứng"] !== undefined && row["Tạm ứng"] !== null && (isNaN(tamUng) || tamUng < 0)) {
      loi.push("\"Tạm ứng\" phải là số không âm");
    }
    if (loi.length) soLoi++;
    row["✔ Kiểm tra"] = loi.length ? ("Lỗi: " + loi.join("; ")) : "OK";
    return row;
  });
  return { list: ketQua, soLoi: soLoi };
}

/**
 * Đối chiếu 1 danh sách Phát sinh lương NHÁP với NL_NHANSU — gắn thêm cột "✔ Kiểm tra".
 */
function doiChieuNhapPSLuong_(list) {
  const nhanSuSet = {};
  docSheetThanhObject_(SHEET_NHANSU, HEADER_NHANSU).forEach(function (ns) { nhanSuSet[ns["Mã nhân viên"]] = true; });

  let soLoi = 0;
  const ketQua = list.map(function (row) {
    const loi = [];
    if (!row["Mã NV"]) loi.push("thiếu Mã NV");
    else if (!nhanSuSet[row["Mã NV"]]) loi.push("Mã NV \"" + row["Mã NV"] + "\" không có trong NL_NHANSU");
    if (!(row["Ngày hạch toán"] instanceof Date)) loi.push("Ngày hạch toán không hợp lệ");
    if (loi.length) soLoi++;
    row["✔ Kiểm tra"] = loi.length ? ("Lỗi: " + loi.join("; ")) : "OK";
    return row;
  });
  return { list: ketQua, soLoi: soLoi };
}

/**
 * BƯỚC 1/3 — Đọc file, ĐỐI CHIẾU, rồi ghi vào BẢNG NHÁP (sheet NHAP_CHAMCONG) —
 * KHÔNG đụng gì tới NL_CHAMCONG (bảng chính) ở bước này. Luôn XOÁ SẠCH nháp cũ
 * trước khi ghi nháp mới (dọn dẹp nếu phiên trước bị huỷ đột ngột/bỏ dở mà chưa
 * kịp dọn) — đảm bảo nháp luôn phản ánh đúng lần tải gần nhất.
 * Người dùng có thể mở thẳng sheet NHAP_CHAMCONG trong Google Sheet để SỬA TAY
 * (thêm/sửa/xoá dòng) trước khi bấm "Đối chiếu lại" rồi "Xác nhận nạp".
 */
function xemTruocChamCongTuFile(base64, tenFile, mimeType) {
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType || "application/octet-stream", tenFile);
  const rows = docBangTuBlob_(blob, tenFile);
  const { list, cotBiBoQua } = chuyenBangThanhDanhSachObject_(rows, anhXaCotChamCong_);
  if (list.length === 0) {
    return { ok: false, loi: "Không đọc được dòng dữ liệu nào. Kiểm tra lại tiêu đề cột — cần có ít nhất: Ngày tính công, Mã NV, Họ và tên, Hình thức công, và các cột ngày 01..31." };
  }
  const header = headerNhapChamCong_();
  const { list: daDoiChieu, soLoi } = doiChieuNhapChamCong_(list);
  ghiDeSheet_(SHEET_NHAP_CHAMCONG, header, daDoiChieu); // ghi đè = tự dọn nháp cũ
  return { ok: true, list: daDoiChieu, soDong: daDoiChieu.length, soLoi: soLoi, cotBiBoQua: cotBiBoQua };
}

/**
 * BƯỚC 2/3 (tuỳ chọn) — Đọc LẠI dữ liệu HIỆN TẠI trong sheet NHAP_CHAMCONG (có
 * thể người dùng vừa sửa tay trực tiếp trong Google Sheet) rồi đối chiếu lại,
 * ghi lại cột "✔ Kiểm tra" cho đúng tình trạng mới nhất.
 */
function doiChieuLaiNhapChamCong() {
  const header = headerNhapChamCong_();
  const list = docSheetThanhObject_(SHEET_NHAP_CHAMCONG, header);
  if (list.length === 0) return { ok: false, loi: "Sheet nháp NHAP_CHAMCONG đang trống — chưa có gì để đối chiếu." };
  const { list: daDoiChieu, soLoi } = doiChieuNhapChamCong_(list);
  ghiDeSheet_(SHEET_NHAP_CHAMCONG, header, daDoiChieu);
  return { ok: true, list: daDoiChieu, soDong: daDoiChieu.length, soLoi: soLoi };
}

/**
 * BƯỚC 3/3 — XÁC NHẬN: đọc lại nháp lần cuối, đối chiếu lại (an toàn — phòng khi
 * người dùng sửa tay trong Sheet nhưng quên bấm "Đối chiếu lại"), CHẶN nếu còn
 * dòng lỗi, nếu sạch lỗi thì ghi vào NL_CHAMCONG (bảng chính) và XOÁ sheet nháp.
 */
function xacNhanNapChamCongTuNhap(cheDoGhi) {
  const headerNhap = headerNhapChamCong_();
  const list = docSheetThanhObject_(SHEET_NHAP_CHAMCONG, headerNhap);
  if (list.length === 0) return { ok: false, loi: "Sheet nháp NHAP_CHAMCONG đang trống — không có gì để nạp." };
  const { list: daDoiChieu, soLoi } = doiChieuNhapChamCong_(list);
  if (soLoi > 0) {
    ghiDeSheet_(SHEET_NHAP_CHAMCONG, headerNhap, daDoiChieu); // lưu lại tình trạng lỗi mới nhất để người dùng xem
    return { ok: false, loi: "Còn " + soLoi + " dòng LỖI trong bảng nháp — sửa hết lỗi (trực tiếp trong sheet NHAP_CHAMCONG hoặc tải lại file khác) rồi mới Xác nhận nạp được.", conLoi: true };
  }
  const headerChinh = headerChamCongDayDu_();
  if (cheDoGhi === "GHIDE") {
    ghiDeSheet_(SHEET_CHAMCONG, headerChinh, daDoiChieu);
  } else {
    appendVaoSheet_(SHEET_CHAMCONG, headerChinh, daDoiChieu);
  }
  xoaSheetNhap_(SHEET_NHAP_CHAMCONG);
  return { ok: true, soDong: daDoiChieu.length };
}

/** HỦY — xoá sạch sheet nháp chấm công, không ghi gì vào bảng chính. */
function huyNhapChamCong() {
  xoaSheetNhap_(SHEET_NHAP_CHAMCONG);
  return { ok: true };
}

/** Tương tự xemTruocChamCongTuFile() nhưng cho Phiếu cân sản lượng. */
function xemTruocSanLuongTuFile(base64, tenFile, mimeType) {
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType || "application/octet-stream", tenFile);
  const rows = docBangTuBlob_(blob, tenFile);
  const { list, cotBiBoQua } = chuyenBangThanhDanhSachObject_(rows, anhXaCotSanLuong_);
  if (list.length === 0) {
    return { ok: false, loi: "Không đọc được dòng dữ liệu nào. Kiểm tra lại tiêu đề cột — cần có ít nhất: Ngày cân, KL hàng (Tấn), Mã phòng ban." };
  }
  const { list: daDoiChieu, soLoi } = doiChieuNhapSanLuong_(list);
  ghiDeSheet_(SHEET_NHAP_SANLUONG, HEADER_NHAP_SANLUONG, daDoiChieu);
  const soChuaGanNguoi = daDoiChieu.filter(function (r) { return !r["Mã NV"]; }).length;
  return { ok: true, list: daDoiChieu, soDong: daDoiChieu.length, soLoi: soLoi, cotBiBoQua: cotBiBoQua, soChuaGanNguoi: soChuaGanNguoi };
}

/** Tương tự doiChieuLaiNhapChamCong() nhưng cho Phiếu cân sản lượng. */
function doiChieuLaiNhapSanLuong() {
  const list = docSheetThanhObject_(SHEET_NHAP_SANLUONG, HEADER_NHAP_SANLUONG);
  if (list.length === 0) return { ok: false, loi: "Sheet nháp NHAP_SANLUONG đang trống — chưa có gì để đối chiếu." };
  const { list: daDoiChieu, soLoi } = doiChieuNhapSanLuong_(list);
  ghiDeSheet_(SHEET_NHAP_SANLUONG, HEADER_NHAP_SANLUONG, daDoiChieu);
  const soChuaGanNguoi = daDoiChieu.filter(function (r) { return !r["Mã NV"]; }).length;
  return { ok: true, list: daDoiChieu, soDong: daDoiChieu.length, soLoi: soLoi, soChuaGanNguoi: soChuaGanNguoi };
}

/**
 * XÁC NHẬN nạp Phiếu cân sản lượng từ bảng nháp vào DL_SANLUONG/DL_BANDAM.
 * @param {string} loaiSanLuong "SANLUONG" (mặc định) hoặc "BANDAM" — chọn LẠI ở
 *   bước xác nhận (không cần nhớ từ bước xem trước) vì người dùng có thể đổi ý.
 */
function xacNhanNapSanLuongTuNhap(loaiSanLuong, cheDoGhi) {
  const list = docSheetThanhObject_(SHEET_NHAP_SANLUONG, HEADER_NHAP_SANLUONG);
  if (list.length === 0) return { ok: false, loi: "Sheet nháp NHAP_SANLUONG đang trống — không có gì để nạp." };
  const { list: daDoiChieu, soLoi } = doiChieuNhapSanLuong_(list);
  if (soLoi > 0) {
    ghiDeSheet_(SHEET_NHAP_SANLUONG, HEADER_NHAP_SANLUONG, daDoiChieu);
    return { ok: false, loi: "Còn " + soLoi + " dòng LỖI trong bảng nháp — sửa hết lỗi (trực tiếp trong sheet NHAP_SANLUONG hoặc tải lại file khác) rồi mới Xác nhận nạp được.", conLoi: true };
  }
  const tenSheet = (loaiSanLuong === "BANDAM") ? SHEET_BANDAM : SHEET_SANLUONG;
  if (cheDoGhi === "GHIDE") {
    ghiDeSheet_(tenSheet, HEADER_SANLUONG, daDoiChieu);
  } else {
    appendVaoSheet_(tenSheet, HEADER_SANLUONG, daDoiChieu);
  }
  xoaSheetNhap_(SHEET_NHAP_SANLUONG);
  return { ok: true, soDong: daDoiChieu.length, sheet: tenSheet };
}

/** HỦY — xoá sạch sheet nháp sản lượng, không ghi gì vào bảng chính. */
function huyNhapSanLuong() {
  xoaSheetNhap_(SHEET_NHAP_SANLUONG);
  return { ok: true };
}

// ================= NHẬP LIỆU ỨNG LƯƠNG (từ file, qua bảng nháp) =================
// ⚠ HOÀN THIỆN CHỨC NĂNG CÒN THIẾU ĐÃ PHÁT HIỆN: giao diện (index.html, tab "Ứng
// lương & Bơm dăm") và cầu nối (Webapp.gs: guiXemTruocUngLuong/
// guiDoiChieuLaiNhapUngLuong/guiXacNhanNapUngLuongTuNhap/guiHuyNhapUngLuong) đã
// gọi sẵn 4 hàm dưới đây — nhưng CHƯA TỪNG được lập trình ở bất kỳ file .gs nào,
// khiến bấm "Xem trước"/"Đối chiếu lại"/"Xác nhận nạp"/"Hủy" ở luồng tải file
// Ứng lương LUÔN báo "ReferenceError: ... is not defined" (server ném lỗi, bắt
// được qua try/catch ở Webapp.gs nên không "treo" nhưng tính năng hoàn toàn
// không hoạt động). Bổ sung ĐÚNG THEO MẪU đã có ở luồng Chấm công/Sản lượng
// phía trên (đọc file → đối chiếu → ghi NHAP_UNGLUONG → xác nhận nạp vào
// NL_UNGLUONG → xoá nháp).

/** Tương tự xemTruocChamCongTuFile() nhưng cho Ứng lương. */
function xemTruocUngLuongTuFile(base64, tenFile, mimeType) {
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType || "application/octet-stream", tenFile);
  const rows = docBangTuBlob_(blob, tenFile);
  const { list, cotBiBoQua } = chuyenBangThanhDanhSachObject_(rows, anhXaCotUngLuong_);
  if (list.length === 0) {
    return { ok: false, loi: "Không đọc được dòng dữ liệu nào. Kiểm tra lại tiêu đề cột — cần có ít nhất: Ngày hạch toán, Mã NV, Tạm ứng." };
  }
  const header = HEADER_NHAP_UNGLUONG;
  const { list: daDoiChieu, soLoi } = doiChieuNhapUngLuong_(list);
  ghiDeSheet_(SHEET_NHAP_UNGLUONG, header, daDoiChieu);
  return { ok: true, list: daDoiChieu, soDong: daDoiChieu.length, soLoi: soLoi, cotBiBoQua: cotBiBoQua };
}

/** Tương tự doiChieuLaiNhapChamCong() nhưng cho Ứng lương. */
function doiChieuLaiNhapUngLuong() {
  const header = HEADER_NHAP_UNGLUONG;
  const list = docSheetThanhObject_(SHEET_NHAP_UNGLUONG, header);
  if (list.length === 0) return { ok: false, loi: "Sheet nháp NHAP_UNGLUONG đang trống — chưa có gì để đối chiếu." };
  const { list: daDoiChieu, soLoi } = doiChieuNhapUngLuong_(list);
  ghiDeSheet_(SHEET_NHAP_UNGLUONG, header, daDoiChieu);
  return { ok: true, list: daDoiChieu, soDong: daDoiChieu.length, soLoi: soLoi };
}

/** XÁC NHẬN nạp Ứng lương từ bảng nháp vào NL_UNGLUONG. */
function xacNhanNapUngLuongTuNhap(cheDoGhi) {
  const headerNhap = HEADER_NHAP_UNGLUONG;
  const list = docSheetThanhObject_(SHEET_NHAP_UNGLUONG, headerNhap);
  if (list.length === 0) return { ok: false, loi: "Sheet nháp NHAP_UNGLUONG đang trống — không có gì để nạp." };
  const { list: daDoiChieu, soLoi } = doiChieuNhapUngLuong_(list);
  if (soLoi > 0) {
    ghiDeSheet_(SHEET_NHAP_UNGLUONG, headerNhap, daDoiChieu);
    return { ok: false, loi: "Còn " + soLoi + " dòng LỖI trong bảng nháp — sửa hết lỗi (trực tiếp trong sheet NHAP_UNGLUONG hoặc tải lại file khác) rồi mới Xác nhận nạp được.", conLoi: true };
  }
  if (cheDoGhi === "GHIDE") {
    ghiDeSheet_(SHEET_UNGLUONG, HEADER_UNGLUONG, daDoiChieu);
  } else {
    appendVaoSheet_(SHEET_UNGLUONG, HEADER_UNGLUONG, daDoiChieu);
  }
  xoaSheetNhap_(SHEET_NHAP_UNGLUONG);
  return { ok: true, soDong: daDoiChieu.length };
}

/** HỦY — xoá sạch sheet nháp Ứng lương, không ghi gì vào bảng chính. */
function huyNhapUngLuong() {
  xoaSheetNhap_(SHEET_NHAP_UNGLUONG);
  return { ok: true };
}

// ================= NHẬP LIỆU PHÁT SINH LƯƠNG (từ file, qua bảng nháp) =================
// ⚠ HOÀN THIỆN CHỨC NĂNG CÒN THIẾU — cùng tình trạng như khối Ứng lương ở trên
// (Webapp.gs/index.html đã gọi sẵn nhưng 4 hàm dưới đây chưa từng tồn tại).

/** Tương tự xemTruocChamCongTuFile() nhưng cho Phát sinh lương (thưởng/thu nhập khác/trừ khác). */
function xemTruocPSLuongTuFile(base64, tenFile, mimeType) {
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType || "application/octet-stream", tenFile);
  const rows = docBangTuBlob_(blob, tenFile);
  const { list, cotBiBoQua } = chuyenBangThanhDanhSachObject_(rows, anhXaCotPSLuong_);
  if (list.length === 0) {
    return { ok: false, loi: "Không đọc được dòng dữ liệu nào. Kiểm tra lại tiêu đề cột — cần có ít nhất: Ngày hạch toán, Mã NV." };
  }
  const header = HEADER_NHAP_PSLUONG;
  const { list: daDoiChieu, soLoi } = doiChieuNhapPSLuong_(list);
  ghiDeSheet_(SHEET_NHAP_PSLUONG, header, daDoiChieu);
  return { ok: true, list: daDoiChieu, soDong: daDoiChieu.length, soLoi: soLoi, cotBiBoQua: cotBiBoQua };
}

/** Tương tự doiChieuLaiNhapChamCong() nhưng cho Phát sinh lương. */
function doiChieuLaiNhapPSLuong() {
  const header = HEADER_NHAP_PSLUONG;
  const list = docSheetThanhObject_(SHEET_NHAP_PSLUONG, header);
  if (list.length === 0) return { ok: false, loi: "Sheet nháp NHAP_PSLUONG đang trống — chưa có gì để đối chiếu." };
  const { list: daDoiChieu, soLoi } = doiChieuNhapPSLuong_(list);
  ghiDeSheet_(SHEET_NHAP_PSLUONG, header, daDoiChieu);
  return { ok: true, list: daDoiChieu, soDong: daDoiChieu.length, soLoi: soLoi };
}

/** XÁC NHẬN nạp Phát sinh lương từ bảng nháp vào NL_PSLUONG. */
function xacNhanNapPSLuongTuNhap(cheDoGhi) {
  const headerNhap = HEADER_NHAP_PSLUONG;
  const list = docSheetThanhObject_(SHEET_NHAP_PSLUONG, headerNhap);
  if (list.length === 0) return { ok: false, loi: "Sheet nháp NHAP_PSLUONG đang trống — không có gì để nạp." };
  const { list: daDoiChieu, soLoi } = doiChieuNhapPSLuong_(list);
  if (soLoi > 0) {
    ghiDeSheet_(SHEET_NHAP_PSLUONG, headerNhap, daDoiChieu);
    return { ok: false, loi: "Còn " + soLoi + " dòng LỖI trong bảng nháp — sửa hết lỗi (trực tiếp trong sheet NHAP_PSLUONG hoặc tải lại file khác) rồi mới Xác nhận nạp được.", conLoi: true };
  }
  if (cheDoGhi === "GHIDE") {
    ghiDeSheet_(SHEET_PSLUONG, HEADER_PSLUONG, daDoiChieu);
  } else {
    appendVaoSheet_(SHEET_PSLUONG, HEADER_PSLUONG, daDoiChieu);
  }
  xoaSheetNhap_(SHEET_NHAP_PSLUONG);
  return { ok: true, soDong: daDoiChieu.length };
}

/** HỦY — xoá sạch sheet nháp Phát sinh lương, không ghi gì vào bảng chính. */
function huyNhapPSLuong() {
  xoaSheetNhap_(SHEET_NHAP_PSLUONG);
  return { ok: true };
}

/**
 * Xoá hẳn 1 sheet nháp nếu nó tồn tại (dùng khi Hủy hoặc sau khi Xác nhận nạp thành công).
 * ⚠ LỖI THẬT ĐÃ PHÁT HIỆN VÀ SỬA: gọi `moSheet_()` — hàm KHÔNG HỀ TỒN TẠI ở bất
 * kỳ file .gs nào trong dự án (hàm mở file đúng theo kiến trúc 5 file là
 * `moSheetChoBang_()`, xem LienKetFile.gs) — khiến MỌI lần "Xác nhận nạp"/"Hủy"
 * ở tab Nhập liệu (chấm công, sản lượng, bơm dăm) ném lỗi
 * "ReferenceError: moSheet_ is not defined" ngay bước dọn sheet nháp cuối
 * cùng, dù dữ liệu chính đã ghi thành công vào NL_CHAMCONG/DL_SANLUONG/
 * DL_BANDAM trước đó — người dùng thấy báo lỗi dù thao tác thực chất đã nạp
 * dữ liệu, và sheet nháp bị bỏ sót không xoá.
 */
function xoaSheetNhap_(tenSheet) {
  const ss = moSheetChoBang_(tenSheet);
  const sh = ss.getSheetByName(tenSheet);
  if (sh) ss.deleteSheet(sh);
}

/** Trả về URL mở thẳng tới 1 sheet cụ thể (kèm #gid=...) để người dùng bấm mở tab mới sửa tay. */
function guiUrlSheetNhap_(tenSheet) {
  const ss = moSheetChoBang_(tenSheet);
  const sh = ss.getSheetByName(tenSheet);
  if (!sh) return null;
  return ss.getUrl() + "#gid=" + sh.getSheetId();
}

// ================= NHẬP DỮ LIỆU BAN ĐẦU (nhiều sheet cùng lúc, chạy 1 LẦN) =================
// ⚠ HOÀN THIỆN CHỨC NĂNG CÒN THIẾU ĐÃ PHÁT HIỆN: tab "Hướng dẫn sử dụng" trên
// index.html gọi sẵn guiNhapDuLieuBanDau() → nhapDuLieuBanDauTuFile() nhưng hàm
// này CHƯA TỪNG được lập trình — bấm "Nhập dữ liệu ban đầu" luôn báo lỗi.
//
// Dùng khi mới bắt đầu triển khai webapp cho 1 đơn vị: thay vì gõ tay/tải riêng
// từng bảng, cho phép tải LÊN 1 LẦN 1 file Excel/Google Sheet CÓ NHIỀU SHEET
// (mỗi sheet đặt tên TRÙNG hoặc GẦN TRÙNG — không phân biệt hoa/thường, khoảng
// trắng, gạch dưới/gạch ngang — với 1 trong các tên sheet nội bộ SHEET_NHANSU,
// SHEET_CHAMCONG... xem danhSachSheetBanDau_()) — mỗi sheet nhận diện được sẽ
// được nạp thẳng vào đúng sheet nội bộ tương ứng (cột khớp tên chuẩn hoá với
// header nội bộ, cột lạ bị bỏ qua — không đoán/suy diễn dữ liệu). Sheet nào
// KHÔNG khớp tên nào sẽ liệt kê ở "boQua" để người dùng biết mà đổi tên/tự nhập
// tay riêng, KHÔNG âm thầm bỏ dữ liệu mà không báo.

/** Toàn bộ sheet nội bộ CÓ THỂ nạp qua "Nhập dữ liệu ban đầu", kèm header chuẩn. */
function danhSachSheetBanDau_() {
  return [
    { ten: SHEET_NHANSU, header: HEADER_NHANSU },
    { ten: SHEET_CHITIETNS, header: HEADER_CHITIETNS },
    { ten: SHEET_CHAMCONG, header: headerChamCongDayDu_() },
    { ten: SHEET_PSLUONG, header: HEADER_PSLUONG },
    { ten: SHEET_UNGLUONG, header: HEADER_UNGLUONG },
    { ten: SHEET_SANLUONG, header: HEADER_SANLUONG },
    { ten: SHEET_BANDAM, header: HEADER_BANDAM },
    { ten: SHEET_TIENCOM, header: HEADER_TIENCOM },
    { ten: SHEET_DM_PHONGBAN, header: HEADER_DM_PHONGBAN },
    { ten: SHEET_DM_CHIPHI, header: HEADER_DM_CHIPHI },
    { ten: SHEET_DM_CHUCVU, header: HEADER_DM_CHUCVU },
    { ten: SHEET_DM_LUONG, header: HEADER_DM_LUONG },
    { ten: SHEET_DM_PHUCAP, header: HEADER_DM_PHUCAP },
    { ten: SHEET_DM_TANGCA, header: HEADER_DM_TANGCA },
    { ten: SHEET_DM_HOTRO, header: HEADER_DM_HOTRO },
    { ten: SHEET_DM_BAOHIEM, header: HEADER_DM_BAOHIEM },
    { ten: SHEET_DM_TNCN, header: HEADER_DM_TNCN },
    { ten: SHEET_DM_GTTNCN, header: HEADER_DM_GTTNCN }
  ];
}

/** Chuẩn hoá tên sheet để so khớp gần đúng (bỏ hoa/thường, khoảng trắng, gạch dưới/gạch ngang). */
function chuanHoaTenSheet_(s) {
  return String(s || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/** Đọc TOÀN BỘ các sheet trong 1 file (blob) thành Map: tên sheet -> mảng 2 chiều. CSV chỉ có 1 "sheet" (tên rỗng). */
function docTatCaBangTuBlob_(blob, tenFile) {
  const ten = (tenFile || "").toLowerCase();
  if (ten.endsWith(".csv")) {
    const ketQua = {};
    ketQua[tenFile.replace(/\.csv$/i, "")] = Utilities.parseCsv(blob.getDataAsString("UTF-8"));
    return ketQua;
  }
  const resource = { name: "tmp_import_" + new Date().getTime(), mimeType: MimeType.GOOGLE_SHEETS };
  const file = Drive.Files.create(resource, blob);
  try {
    const ss = SpreadsheetApp.openById(file.id);
    const ketQua = {};
    ss.getSheets().forEach(function (sh) { ketQua[sh.getName()] = sh.getDataRange().getValues(); });
    return ketQua;
  } finally {
    Drive.Files.remove(file.id);
  }
}

/** Ánh xạ cột theo ĐÚNG TÊN CHUẨN của 1 header nội bộ cho trước (so khớp không phân biệt hoa/thường/khoảng trắng thừa). */
function anhXaCotTheoHeader_(header) {
  const theoTenChuan = {};
  header.forEach(function (h) { theoTenChuan[chuanHoaTieuDe_(h)] = h; });
  return function (hangTieuDe) {
    return hangTieuDe.map(function (tieuDe) { return theoTenChuan[chuanHoaTieuDe_(tieuDe)] || null; });
  };
}

/**
 * Nạp 1 lần TOÀN BỘ dữ liệu ban đầu từ 1 file Excel/Google Sheet nhiều sheet.
 * @param {string} cheDoGhi "GHIDE" (ghi đè hoàn toàn từng sheet nhận diện được) hoặc
 *   bất kỳ giá trị nào khác = "APPEND" (nối thêm vào cuối, giữ dữ liệu đã có).
 * @return {{ok: boolean, ketQua: Array<{sheet,nguon,soDong,ghiChu}>, boQua: string[]}}
 */
function nhapDuLieuBanDauTuFile(base64, tenFile, mimeType, cheDoGhi) {
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType || "application/octet-stream", tenFile);
  const cacBang = docTatCaBangTuBlob_(blob, tenFile);
  const tenSheetTrongFile = Object.keys(cacBang);
  if (tenSheetTrongFile.length === 0) {
    return { ok: false, loi: "Không đọc được sheet nào trong file." };
  }

  const daDung = {}; // tên sheet trong file đã được dùng cho 1 mục tiêu — không dùng lại cho mục tiêu khác
  const ketQua = [];

  danhSachSheetBanDau_().forEach(function (muc) {
    const tenChuanMuc = chuanHoaTenSheet_(muc.ten);
    const tenKhop = tenSheetTrongFile.find(function (t) { return !daDung[t] && chuanHoaTenSheet_(t) === tenChuanMuc; });
    if (!tenKhop) return; // không có sheet nào trong file khớp tên — bỏ qua, GIỮ NGUYÊN dữ liệu nội bộ đang có

    daDung[tenKhop] = true;
    const rows = cacBang[tenKhop];
    const { list, cotBiBoQua } = chuyenBangThanhDanhSachObject_(rows, anhXaCotTheoHeader_(muc.header));
    if (list.length === 0) {
      ketQua.push({ sheet: muc.ten, nguon: tenKhop, soDong: 0, ghiChu: "Không đọc được dòng dữ liệu nào (kiểm tra lại tiêu đề cột có khớp tên chuẩn không)." });
      return;
    }
    if (cheDoGhi === "GHIDE") {
      ghiDeSheet_(muc.ten, muc.header, list);
    } else {
      appendVaoSheet_(muc.ten, muc.header, list);
    }
    ketQua.push({
      sheet: muc.ten, nguon: tenKhop, soDong: list.length,
      ghiChu: cotBiBoQua.length ? ("Bỏ qua cột không nhận diện: " + cotBiBoQua.join(", ")) : ""
    });
  });

  const boQua = tenSheetTrongFile.filter(function (t) { return !daDung[t]; });
  return { ok: true, ketQua: ketQua, boQua: boQua };
}
