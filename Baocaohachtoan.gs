// ================= BÁO CÁO CHẤM CÔNG/PHÂN BỔ SL "CHỐT" + PHIẾU HẠCH TOÁN + LƯU TRỮ =================
// Khác với các báo cáo "live" (BaoCao.gs — tính lại mỗi lần xem, không lưu),
// các hàm ở đây GHI KẾT QUẢ THÀNH BẢN GHI THẬT vào File Xử lý (RP_CHAMCONG,
// RP_PHANBOSL, RP_HACHTOAN, RP_PHIEUCHI) — để sau này "Lưu trữ" (chuyển hẳn
// sang File Lưu trữ) giữ lại đúng số liệu đã chốt của kỳ đó, không đổi dù sau
// này chấm công/sản lượng gốc có bị sửa.

// ---------- Báo cáo chấm công (chốt) ----------

/** Tính + ghi báo cáo chấm công đã chốt của 1 kỳ vào RP_CHAMCONG. */
function chotBaoCaoChamCong(nam, thang) {
  const namSo = Number(nam);
  const nhanSuList = docSheetThanhObject_(SHEET_NHANSU, HEADER_NHANSU);
  const dmPhongBan = docDanhMucPhongBan_();
  const chamCongMap = tongHopChamCong_(namSo, thang);
  const ky = thang + "/" + namSo;

  const ketQua = [];
  nhanSuList.forEach(function (ns) {
    const maNV = ns["Mã nhân viên"];
    const c = chamCongMap[maNV];
    if (!c) return;
    ketQua.push({
      "Kỳ": ky, "Mã NV": maNV, "Họ và tên": ns["Họ và tên"],
      "Mã phòng ban": ns["Mã PB"], "Tên phòng ban": tenPhongBan_(ns["Mã PB"], dmPhongBan),
      "Tổng công": c.tongCong, "Công Chủ nhật": c.congChuNhat, "Công tăng ca": c.congTangCa,
      "Công lễ": c.congLe, "Công phép": c.congPhep, "Công cơm": c.congCom
    });
  });

  ghiDeSheet_(SHEET_BC_CHAMCONG, HEADER_BC_CHAMCONG, ketQua);
  return { ok: true, soDong: ketQua.length, ky: ky };
}

// ---------- Phân bổ sản lượng (chốt) ----------

/** Tính + ghi báo cáo phân bổ sản lượng đã chốt của 1 kỳ vào RP_PHANBOSL. */
function chotBaoCaoPhanBoSanLuong(nam, thang) {
  const ky = thang + "/" + Number(nam);
  const ketQua = [];
  ["SANLUONG", "BANDAM"].forEach(function (loai) {
    const bc = baoCaoPhanBoSanLuong(nam, thang, loai);
    bc.theoCongNhan.forEach(function (r) {
      ketQua.push({
        "Kỳ": ky, "Loại": loai === "BANDAM" ? "Bơm dăm" : "Sản lượng chính",
        "Mã NV": r["Mã NV"], "Họ và tên": r["Họ và tên"],
        "Mã phòng ban": r["Mã phòng ban"], "Tên phòng ban": r["Tên phòng ban"],
        "Tổng sản lượng (tấn)": r["Tổng sản lượng (tấn)"], "Số phiếu cân": r["Số phiếu cân"]
      });
    });
  });
  ghiDeSheet_(SHEET_BC_PHANBOSL, HEADER_BC_PHANBOSL, ketQua);
  return { ok: true, soDong: ketQua.length, ky: ky };
}

// ---------- Phiếu hạch toán loại 1: bảng hạch toán chi phí lương theo TK kế toán ----------
// ⚠ Đây là bản hạch toán Ở MỨC TỔNG HỢP (theo Thông tư 200) — các khoản BHXH/
// BHYT/BHTN/KPCĐ trừ NLĐ được gộp chung 1 dòng (RP_BHXH hiện không tách riêng
// từng loại) — nếu cần tách chi tiết theo từng tiểu khoản 3383/3384/3386/3382,
// kế toán tự tách thêm dựa theo tỷ lệ đã khai trong DM_BAOHIEM.
const TK_PHAI_TRA_NLD_ = "334";
const TK_BAOHIEM_PHAI_NOP_ = "338"; // gộp chung BHXH/BHYT/BHTN/KPCĐ
const TK_THUE_TNCN_ = "3335";
const TK_TAM_UNG_ = "141";
const TK_TIEN_MAT_ = "111/112";

function taoBangHachToan(nam, thang) {
  const ky = thang + "/" + Number(nam);
  const nhanSuList = docSheetThanhObject_(SHEET_NHANSU, HEADER_NHANSU);
  const nhanSuMap = {};
  nhanSuList.forEach(function (ns) { nhanSuMap[ns["Mã nhân viên"]] = ns; });
  const dmPhongBan = docDanhMucPhongBan_();

  const bangLuong = docSheetThanhObject_(SHEET_BANGLUONG, HEADER_BANGLUONG);
  const bhxh = docSheetThanhObject_(SHEET_BHXH, HEADER_BHXH);
  if (bangLuong.length === 0) {
    return { ok: false, loi: "Chưa có dữ liệu RP_BANGLUONG — chạy \"Tính lương\" cho kỳ " + ky + " trước." };
  }

  // Gộp chi phí lương (Nợ TK chi phí theo phòng ban / Có 334) theo từng TK chi phí
  const theoTKChiPhi = {}; // TK chi phí -> tổng thu nhập
  bangLuong.forEach(function (r) {
    const ns = nhanSuMap[r["Mã NV"]];
    const pb = ns ? dmPhongBan[ns["Mã PB"]] : null;
    const tk = (pb && pb["Tài khoản chi phí"]) ? pb["Tài khoản chi phí"] : "642 (chưa xác định phòng ban)";
    theoTKChiPhi[tk] = (theoTKChiPhi[tk] || 0) + (Number(r["Tổng thu nhập (trước trừ)"]) || 0);
  });

  // Gộp phần BHXH công ty đóng theo TK chi phí (dựa theo phòng ban của từng người trong RP_BHXH)
  const theoTKChiPhiBH = {};
  let tongBHCongTyDong = 0, tongBHNLDDong = 0, tongTruyThuBH = 0;
  bhxh.forEach(function (r) {
    const ns = nhanSuMap[r["Mã NV"]];
    const pb = ns ? dmPhongBan[ns["Mã PB"]] : null;
    const tk = (pb && pb["Tài khoản chi phí"]) ? pb["Tài khoản chi phí"] : "642 (chưa xác định phòng ban)";
    theoTKChiPhiBH[tk] = (theoTKChiPhiBH[tk] || 0) + (Number(r["Cộng BH công ty đóng"]) || 0);
    tongBHCongTyDong += Number(r["Cộng BH công ty đóng"]) || 0;
    tongBHNLDDong += Number(r["Cộng BH NLĐ đóng"]) || 0;
    tongTruyThuBH += Number(r["Truy thu bảo hiểm"]) || 0;
  });

  let tongThue = 0, tongTamUng = 0, tongThucLinh = 0;
  bangLuong.forEach(function (r) {
    tongThue += Number(r["Thuế TNCN"]) || 0;
    tongTamUng += Number(r["Tạm ứng"]) || 0;
    tongThucLinh += Number(r["Thực lĩnh"]) || 0;
  });

  const but = [];
  const themBut = function (no, tenNo, co, tenCo, dienGiai, soTien) {
    if (!soTien) return;
    but.push({ "Kỳ": ky, "Tài khoản Nợ": no, "Tên tài khoản Nợ": tenNo, "Tài khoản Có": co, "Tên tài khoản Có": tenCo, "Diễn giải": dienGiai, "Số tiền": Math.round(soTien) });
  };

  Object.keys(theoTKChiPhi).forEach(function (tk) {
    themBut(tk, "Chi phí lương", TK_PHAI_TRA_NLD_, "Phải trả người lao động", "Tính lương phải trả kỳ " + ky, theoTKChiPhi[tk]);
  });
  Object.keys(theoTKChiPhiBH).forEach(function (tk) {
    themBut(tk, "Chi phí lương", TK_BAOHIEM_PHAI_NOP_, "BHXH/BHYT/BHTN/KPCĐ phải nộp (phần DN đóng)", "Trích BH theo lương (DN đóng) kỳ " + ky, theoTKChiPhiBH[tk]);
  });
  themBut(TK_PHAI_TRA_NLD_, "Phải trả người lao động", TK_BAOHIEM_PHAI_NOP_, "BHXH/BHYT/BHTN/KPCĐ phải nộp (phần NLĐ đóng)", "Khấu trừ BH vào lương kỳ " + ky, tongBHNLDDong);
  themBut(TK_PHAI_TRA_NLD_, "Phải trả người lao động", TK_BAOHIEM_PHAI_NOP_, "BHXH/BHYT/BHTN/KPCĐ phải nộp (truy thu do thiếu công)", "Truy thu BH (chưa đủ ngưỡng công) kỳ " + ky, tongTruyThuBH);
  themBut(TK_PHAI_TRA_NLD_, "Phải trả người lao động", TK_THUE_TNCN_, "Thuế TNCN phải nộp", "Khấu trừ thuế TNCN kỳ " + ky, tongThue);
  themBut(TK_PHAI_TRA_NLD_, "Phải trả người lao động", TK_TAM_UNG_, "Tạm ứng", "Trừ tạm ứng đã chi kỳ " + ky, tongTamUng);
  themBut(TK_PHAI_TRA_NLD_, "Phải trả người lao động", TK_TIEN_MAT_, "Tiền mặt/Tiền gửi ngân hàng", "Chi trả lương thực lĩnh kỳ " + ky, tongThucLinh);

  ghiDeSheet_(SHEET_HACHTOAN, HEADER_HACHTOAN, but);
  return { ok: true, soDong: but.length, ky: ky };
}

// ---------- Phiếu hạch toán loại 2: phiếu chi lương/tạm ứng ----------

/**
 * Tạo phiếu chi (lương và/hoặc tạm ứng) cho 1 kỳ — ghi vào RP_PHIEUCHI.
 * @param {string} loaiChi "LUONG", "TAMUNG", hoặc "CA_HAI"
 */
function taoPhieuChi(nam, thang, loaiChi) {
  const ky = thang + "/" + Number(nam);
  const phieu = [];
  let soThuTu = 1;

  if (loaiChi === "LUONG" || loaiChi === "CA_HAI") {
    const bangLuong = docSheetThanhObject_(SHEET_BANGLUONG, HEADER_BANGLUONG);
    bangLuong.forEach(function (r) {
      const thucLinh = Number(r["Thực lĩnh"]) || 0;
      if (thucLinh <= 0) return;
      phieu.push({
        "Kỳ": ky, "Số phiếu": "PC-L" + ky.replace("/", "") + "-" + String(soThuTu++).padStart(3, "0"),
        "Ngày chi": new Date(), "Mã NV": r["Mã NV"], "Họ và tên": r["Họ và tên"],
        "Loại chi": "Lương", "Số tiền": thucLinh, "Hình thức TT": "", "Người nhận": r["Họ và tên"],
        "Ghi chú": "Chi lương kỳ " + ky
      });
    });
  }

  if (loaiChi === "TAMUNG" || loaiChi === "CA_HAI") {
    const namSo = Number(nam);
    const ungLuong = docSheetThanhObject_(SHEET_UNGLUONG, HEADER_UNGLUONG).filter(function (r) {
      const ngay = r["Ngày hạch toán"];
      return (ngay instanceof Date) && ngay.getFullYear() == namSo && (ngay.getMonth() + 1) == Number(thang);
    });
    ungLuong.forEach(function (r) {
      const soTien = Number(r["Tạm ứng"]) || 0;
      if (soTien <= 0) return;
      phieu.push({
        "Kỳ": ky, "Số phiếu": "PC-U" + ky.replace("/", "") + "-" + String(soThuTu++).padStart(3, "0"),
        "Ngày chi": r["Ngày hạch toán"], "Mã NV": r["Mã NV"], "Họ và tên": r["Người nhận"] || "",
        "Loại chi": "Tạm ứng", "Số tiền": soTien, "Hình thức TT": "", "Người nhận": r["Người nhận"] || "",
        "Ghi chú": r["Diễn giải"] || ("Tạm ứng kỳ " + ky)
      });
    });
  }

  appendVaoSheet_(SHEET_PHIEUCHI, HEADER_PHIEUCHI, phieu);
  return { ok: true, soDong: phieu.length, ky: ky };
}

// ---------- Lưu trữ (chốt kỳ): copy File Xử lý → File Lưu trữ rồi xoá sạch File Xử lý ----------

/** Danh sách sheet thuộc File Xử lý cần lưu trữ mỗi khi "chốt kỳ". */
function danhSachSheetXuLy_() {
  return [
    { ten: SHEET_BANGLUONG, header: HEADER_BANGLUONG },
    { ten: SHEET_BHXH, header: HEADER_BHXH },
    { ten: SHEET_TNCN, header: HEADER_TNCN },
    { ten: SHEET_BC_CHAMCONG, header: HEADER_BC_CHAMCONG },
    { ten: SHEET_BC_PHANBOSL, header: HEADER_BC_PHANBOSL },
    { ten: SHEET_HACHTOAN, header: HEADER_HACHTOAN },
    { ten: SHEET_PHIEUCHI, header: HEADER_PHIEUCHI },
    { ten: SHEET_KIEMTRA_LOG, header: HEADER_KIEMTRA_LOG }
  ];
}

/**
 * "Lưu trữ" (chốt kỳ) — copy TOÀN BỘ dữ liệu hiện có ở File Xử lý sang File Lưu
 * trữ (mỗi dòng được gắn thêm cột "Kỳ lưu trữ" ở đầu để tra cứu về sau, CỘNG
 * DỒN — không ghi đè dữ liệu các kỳ trước đã lưu), rồi XOÁ SẠCH File Xử lý
 * (giữ header) để bắt đầu kỳ mới. KHÔNG THỂ HOÀN TÁC — nên chỉ bấm khi đã chắc
 * chắn kỳ này xong xuôi (đã Tính lương, đã kiểm tra, đã in/tải các báo cáo cần).
 * @param {string} nam
 * @param {number} thang
 */
function luuTruKy(nam, thang) {
  const ky = thang + "/" + Number(nam);
  const ssLuuTru = moFileTheoLoai_(LOAI_FILE_LUUTRU);
  const ketQua = [];

  danhSachSheetXuLy_().forEach(function (muc) {
    const list = docSheetThanhObject_(muc.ten, muc.header);
    if (list.length > 0) {
      const headerLuuTru = ["Kỳ lưu trữ"].concat(muc.header);
      let shLuuTru = ssLuuTru.getSheetByName(muc.ten);
      if (!shLuuTru) {
        shLuuTru = ssLuuTru.insertSheet(muc.ten);
        shLuuTru.getRange(1, 1, 1, headerLuuTru.length).setValues([headerLuuTru]);
        shLuuTru.setFrozenRows(1);
      }
      const rows = list.map(function (obj) {
        return [ky].concat(muc.header.map(function (ten) { return obj[ten] !== undefined ? obj[ten] : ""; }));
      });
      shLuuTru.getRange(shLuuTru.getLastRow() + 1, 1, rows.length, headerLuuTru.length).setValues(rows);
    }

    // Xoá sạch dữ liệu (giữ header) ở File Xử lý để làm kỳ mới
    const shXuLy = layHoacTaoSheet_(muc.ten, muc.header);
    if (shXuLy.getMaxRows() > 1) {
      shXuLy.getRange(2, 1, shXuLy.getMaxRows() - 1, muc.header.length).clearContent();
    }
    ketQua.push({ sheet: muc.ten, soDong: list.length });
  });

  PropertiesService.getScriptProperties().deleteProperty("KY_GAN_NHAT");
  return { ok: true, ky: ky, ketQua: ketQua };
}
