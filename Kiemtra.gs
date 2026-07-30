// ================= KIỂM TRA / KIỂM SOÁT BẢNG LƯƠNG =================
// Tái hiện đúng checklist 8 bước đã hệ thống hóa trong SKILL.md (mục "Bước 4").
// Gọi từ WebApp.gs khi người dùng bấm nút "Chạy kiểm tra" — chạy ĐỘC LẬP với
// tinhBangLuong() (không bắt buộc phải tính lương trước mới kiểm tra được các
// bước 1, 4, 6, 8 — riêng bước 3, 7 cần đã chạy tinhBangLuong() trong kỳ đó).

/**
 * @param {string} nam
 * @param {number} thang
 * @return {{ soLoi: number, soCanhBao: number }}
 */
function kiemTraBangLuong(nam, thang) {
  const namSo = Number(nam);
  const logs = [];
  const gio = new Date();

  const nhanSuList = docSheetThanhObject_(SHEET_NHANSU, HEADER_NHANSU);
  const nhanSuMap = {};
  nhanSuList.forEach(r => { nhanSuMap[r["Mã nhân viên"]] = r; });

  const dmLuong = docDanhMucLuong_(namSo, thang);
  const dmTangCa = docDanhMucTangCa_(namSo, thang);
  const dmPhuCap = docDanhMucPhuCap_(namSo, thang);
  const dmHoTro = docDanhMucHoTro_(namSo, thang);
  const dmBaoHiem = docDanhMucBaoHiem_(namSo, thang);
  const dmPhongBan = docDanhMucPhongBan_();
  const dmChucVu = docDanhMucChucVu_();

  const ghi = (mucDo, loai, maNV, hoTen, noiDung, gt1, gt2, chenhLech) => {
    logs.push({
      "Thời gian chạy": gio, "Mức độ": mucDo, "Loại kiểm tra": loai,
      "Mã NV": maNV || "", "Họ và tên": hoTen || "",
      "Nội dung phát hiện": noiDung, "Giá trị 1": gt1 !== undefined ? gt1 : "",
      "Giá trị 2": gt2 !== undefined ? gt2 : "", "Chênh lệch": chenhLech !== undefined ? chenhLech : ""
    });
  };

  // ----- 1) Mã NV trùng lặp trong NL_NHANSU -----
  const demMa = {};
  nhanSuList.forEach(r => { demMa[r["Mã nhân viên"]] = (demMa[r["Mã nhân viên"]] || 0) + 1; });
  Object.keys(demMa).forEach(ma => {
    if (demMa[ma] > 1) {
      ghi("Lỗi", "1. Trùng mã nhân viên", ma, "", "Mã nhân viên xuất hiện " + demMa[ma] + " lần trong NL_NHANSU");
    }
  });

  // ----- 2) Mã tham chiếu trong NL_NHANSU không tồn tại trong danh mục -----
  nhanSuList.forEach(ns => {
    const maNV = ns["Mã nhân viên"];
    if (ns["Mã tiền lương 1"] && !dmLuong[ns["Mã tiền lương 1"]]) {
      ghi("Lỗi", "2. Mã tham chiếu không hợp lệ", maNV, ns["Họ và tên"],
        "\"Mã tiền lương 1\" = " + ns["Mã tiền lương 1"] + " không có trong DM_LUONG");
    }
    if (ns["Mã tăng ca"] && !dmTangCa[ns["Mã tăng ca"]]) {
      ghi("Lỗi", "2. Mã tham chiếu không hợp lệ", maNV, ns["Họ và tên"],
        "\"Mã tăng ca\" = " + ns["Mã tăng ca"] + " không có trong DM_TANGCA");
    }
    if (ns["Mã phụ cấp"] && !dmPhuCap[ns["Mã phụ cấp"]]) {
      ghi("Cảnh báo", "2. Mã tham chiếu không hợp lệ", maNV, ns["Họ và tên"],
        "\"Mã phụ cấp\" = " + ns["Mã phụ cấp"] + " không có trong DM_PHUCAP");
    }
    if (ns["Mã hỗ trợ"] && !dmHoTro[ns["Mã hỗ trợ"]]) {
      ghi("Cảnh báo", "2. Mã tham chiếu không hợp lệ", maNV, ns["Họ và tên"],
        "\"Mã hỗ trợ\" = " + ns["Mã hỗ trợ"] + " không có trong DM_HOTRO");
    }
    if (ns["Mã hỗ trợ 2"] && !dmHoTro[ns["Mã hỗ trợ 2"]]) {
      ghi("Cảnh báo", "2. Mã tham chiếu không hợp lệ", maNV, ns["Họ và tên"],
        "\"Mã hỗ trợ 2\" = " + ns["Mã hỗ trợ 2"] + " không có trong DM_HOTRO");
    }
    if (ns["Mã BHXH"] && !dmBaoHiem[ns["Mã BHXH"]]) {
      ghi("Lỗi", "2. Mã tham chiếu không hợp lệ", maNV, ns["Họ và tên"],
        "\"Mã BHXH\" = " + ns["Mã BHXH"] + " không có trong DM_BAOHIEM — sẽ KHÔNG tính được BHXH cho người này");
    }
    if (ns["Mã PB"] && !dmPhongBan[ns["Mã PB"]]) {
      ghi("Cảnh báo", "2. Mã tham chiếu không hợp lệ", maNV, ns["Họ và tên"],
        "\"Mã PB\" = " + ns["Mã PB"] + " không có trong DM_PHONGBAN");
    }
    if (ns["Mã CV"] && !dmChucVu[ns["Mã CV"]]) {
      ghi("Cảnh báo", "2. Mã tham chiếu không hợp lệ", maNV, ns["Họ và tên"],
        "\"Mã CV\" = " + ns["Mã CV"] + " không có trong DM_CHUCVU");
    }
  });

  // ----- 3) Đối chiếu công: chấm công có Mã NV không tồn tại trong NL_NHANSU -----
  const chamCongHeader = headerChamCongDayDu_();
  const chamCongList = docSheetThanhObject_(SHEET_CHAMCONG, chamCongHeader);
  const maNVDaBaoLoi3 = {};
  chamCongList.forEach(r => {
    const maNV = r["Mã NV"];
    if (maNV && !nhanSuMap[maNV] && !maNVDaBaoLoi3[maNV]) {
      maNVDaBaoLoi3[maNV] = true;
      ghi("Lỗi", "3. Chấm công không khớp nhân sự", maNV, r["Họ và tên"],
        "Có dòng chấm công nhưng Mã NV không có trong NL_NHANSU — kiểm tra người vào/nghỉ giữa tháng hoặc gõ sai mã");
    }
  });

  // ----- 4) Công bất thường: vượt số ngày trong tháng, hoặc = 0 cả tháng -----
  const soNgayTrongThang = new Date(namSo, thang, 0).getDate();
  const chamCongMap = tongHopChamCong_(namSo, thang);
  Object.keys(chamCongMap).forEach(maNV => {
    const tong = chamCongMap[maNV].tongCong;
    const ns = nhanSuMap[maNV] || {};
    if (tong > soNgayTrongThang) {
      ghi("Cảnh báo", "4. Công bất thường", maNV, ns["Họ và tên"],
        "Tổng công (" + tong + ") vượt số ngày trong tháng (" + soNgayTrongThang + ") — kiểm tra có tính trùng dòng hoặc quy đổi tăng ca vào cùng cột không",
        tong, soNgayTrongThang, tong - soNgayTrongThang);
    }
  });

  // ----- 5) Tạm ứng: Mã NV không tồn tại trong NL_NHANSU, hoặc ngày hạch toán ngoài kỳ -----
  const ungLuongList = docSheetThanhObject_(SHEET_UNGLUONG, HEADER_UNGLUONG);
  ungLuongList.forEach(r => {
    const maNV = r["Mã NV"];
    const ngay = r["Ngày hạch toán"];
    if (!maNV) return;
    if (!nhanSuMap[maNV]) {
      ghi("Lỗi", "5. Tạm ứng không khớp nhân sự", maNV, r["Người nhận"],
        "Phiếu tạm ứng có Mã NV không có trong NL_NHANSU");
    }
    if (ngay instanceof Date && (ngay.getFullYear() != namSo || (ngay.getMonth() + 1) != thang)) {
      ghi("Cảnh báo", "5. Tạm ứng khác kỳ", maNV, r["Người nhận"],
        "Ngày hạch toán tạm ứng (" + Utilities.formatDate(ngay, Session.getScriptTimeZone(), "dd/MM/yyyy") +
        ") không thuộc kỳ đang kiểm tra (" + thang + "/" + namSo + ") — xác nhận có tính đúng kỳ trừ không");
    }
  });

  // ----- 6) Sản lượng: phiếu cân chưa gán Mã NV -----
  [SHEET_SANLUONG, SHEET_BANDAM].forEach(tenSheet => {
    const list = docSheetThanhObject_(tenSheet, HEADER_SANLUONG);
    let demChuaGan = 0;
    list.forEach(r => {
      const ngay = r["Ngày cân"];
      if (ngay instanceof Date && ngay.getFullYear() == namSo && (ngay.getMonth() + 1) == thang && !r["Mã NV"]) {
        demChuaGan++;
      }
    });
    if (demChuaGan > 0) {
      ghi("Cảnh báo", "6. Sản lượng chưa gán người", "", "",
        demChuaGan + " phiếu cân trong sheet " + tenSheet + " của kỳ " + thang + "/" + namSo +
        " chưa có Mã NV — lương sản lượng của những phiếu này sẽ KHÔNG được tính cho ai");
    }
  });

  // ----- 7) Nếu đã có bảng lương của kỳ này: kiểm tra tổng thực lĩnh khớp tổng thu - tổng trừ -----
  const bangLuongList = docSheetThanhObject_(SHEET_BANGLUONG, HEADER_BANGLUONG);
  if (bangLuongList.length > 0) {
    let tongThuNhap = 0, tongTru = 0, tongThucLinh = 0;
    bangLuongList.forEach(r => {
      tongThuNhap += Number(r["Tổng thu nhập (trước trừ)"]) || 0;
      tongTru += (Number(r["BHXH/BHYT/BHTN trừ NLĐ"]) || 0) + (Number(r["Thuế TNCN"]) || 0) +
        (Number(r["Trừ khác"]) || 0) + (Number(r["Tạm ứng"]) || 0);
      tongThucLinh += Number(r["Thực lĩnh"]) || 0;
    });
    const chenh = (tongThuNhap - tongTru) - tongThucLinh;
    if (Math.abs(chenh) > 1) {
      ghi("Lỗi", "7. Sai tổng bảng lương", "", "",
        "Tổng (Thu nhập − Các khoản trừ) không khớp Tổng Thực lĩnh trên RP_BANGLUONG",
        tongThuNhap - tongTru, tongThucLinh, chenh);
    }
  } else {
    ghi("Cảnh báo", "7. Chưa có bảng lương", "", "",
      "Chưa chạy tinhBangLuong() cho kỳ " + thang + "/" + namSo + " — bỏ qua bước kiểm tra tổng cuối");
  }

  // ----- 8) Người vào làm nhưng chưa có trong NL_CHITIET_NS (thiếu hồ sơ tính thuế) -----
  const chiTietNSList = docSheetThanhObject_(SHEET_CHITIETNS, HEADER_CHITIETNS);
  const chiTietNSSet = {};
  chiTietNSList.forEach(r => { chiTietNSSet[r["Mã nhân viên"]] = true; });
  nhanSuList.forEach(ns => {
    if (!chiTietNSSet[ns["Mã nhân viên"]]) {
      ghi("Cảnh báo", "8. Thiếu hồ sơ chi tiết", ns["Mã nhân viên"], ns["Họ và tên"],
        "Chưa có dòng tương ứng trong NL_CHITIET_NS — không tính được giảm trừ gia cảnh TNCN cho người này");
    }
  });

  // ----- 9) Mã TNCN chưa khai — mặc định MIỄN THUẾ, có thể là quên khai chứ không
  // phải cố ý miễn thuế -----
  nhanSuList.forEach(ns => {
    if (!ns["Mã TNCN"]) {
      ghi("Cảnh báo", "9. Chưa khai Mã TNCN", ns["Mã nhân viên"], ns["Họ và tên"],
        "Chưa khai \"Mã TNCN\" — hệ thống mặc định coi là MIỄN THUẾ (không tính thuế TNCN) cho người này. Nếu không đúng ý, khai rõ TNCN0 (miễn)/TNCN1 (cố định 10%)/TNCN2 (luỹ tiến).");
    }
  });

  // ----- 10) Người trả lương sản lượng nhưng DM_LUONG thiếu đơn giá bù —
  // cơ chế bù sản lượng sẽ ÂM THẦM không kích hoạt (không báo lỗi khi tính lương) -----
  const maSPDaBaoLoi10 = {};
  nhanSuList.forEach(ns => {
    const dmLuongInfo = dmLuong[ns["Mã tiền lương 1"]] || dmLuong[ns["Mã tiền lương 2"]];
    if (!dmLuongInfo || !/SP/i.test(dmLuongInfo["Mã hình thức lương"] || "")) return;
    const maLuong = dmLuongInfo["Mã lương"] || ns["Mã tiền lương 1"];
    if (maSPDaBaoLoi10[maLuong]) return; // chỉ báo 1 lần/mã lương, không lặp lại cho từng người
    const nguong = Number(dmLuongInfo["ĐK_Bù lương (công tối thiểu)"]) || 0;
    const donGiaBu = Number(dmLuongInfo["Đơn giá bù lương"]) || 0;
    if (nguong > 0 && donGiaBu <= 0) {
      maSPDaBaoLoi10[maLuong] = true;
      ghi("Cảnh báo", "10. Thiếu đơn giá bù sản lượng", "", "",
        "Mã lương \"" + maLuong + "\" có khai ngưỡng bù (" + nguong + ") nhưng \"Đơn giá bù lương\" = 0 trong DM_LUONG — cơ chế bù sản lượng sẽ KHÔNG kích hoạt cho ai dùng mã này dù sản lượng dưới ngưỡng. Sửa lại ở tab Danh mục nếu đây không phải chủ ý.");
    }
  });

  // ----- 11) Cảnh báo sớm: người CÓ THỂ bị TRUY THU bảo hiểm do chưa đủ ngưỡng
  // công (xem Mục 5 trong references/cong_thuc_that_pure_powerquery.md) — báo
  // TRƯỚC khi Tính lương để kịp kiểm tra lại chấm công, không để đến khi ra bảng
  // lương mới phát hiện thực lĩnh bị trừ nhiều hơn dự kiến -----
  nhanSuList.forEach(ns => {
    const maNV = ns["Mã nhân viên"];
    const dmLuongInfo = dmLuong[ns["Mã tiền lương 1"]] || dmLuong[ns["Mã tiền lương 2"]];
    const bhInfo = dmBaoHiem[ns["Mã BHXH"]];
    if (!dmLuongInfo || !bhInfo) return;
    const nguongBH = Number(dmLuongInfo["Ngưỡng truy thu BH (công)"]) || 0;
    if (nguongBH <= 0) return; // mã lương này không quy định ngưỡng — không có nguy cơ truy thu
    const c = chamCongMap[maNV];
    const tongCong = c ? c.tongCong : 0;
    if (tongCong < nguongBH) {
      const luongDongBH = Number(ns["Lương cơ bản"]) || Number(ns["Lương thỏa thuận"]) || 0;
      const tyLeDN = (Number(bhInfo["DN.BHXH"]) || 0) + (Number(bhInfo["DN.BHYT"]) || 0) + (Number(bhInfo["DN.BHTN"]) || 0) + (Number(bhInfo["DN.KPCD"]) || 0);
      const uocTinhTruyThu = Math.round(luongDongBH * tyLeDN);
      ghi("Cảnh báo", "11. Nguy cơ truy thu bảo hiểm", maNV, ns["Họ và tên"],
        "Công hiện tại (" + tongCong + ") CHƯA ĐỦ ngưỡng đóng BH (" + nguongBH + " công) — nếu không thay đổi, khi Tính lương sẽ bị TRUY THU khoảng " + uocTinhTruyThu.toLocaleString("vi-VN") + "đ (trừ thẳng vào thực lĩnh). Kiểm tra lại chấm công có sót dòng không trước khi tính lương chính thức.",
        tongCong, nguongBH, tongCong - nguongBH);
    }
  });

  // Ghi log — CỘNG DỒN (không xoá log cũ) để giữ lịch sử các lần kiểm tra trước
  appendVaoSheet_(SHEET_KIEMTRA_LOG, HEADER_KIEMTRA_LOG, logs);

  const soLoi = logs.filter(l => l["Mức độ"] === "Lỗi").length;
  const soCanhBao = logs.filter(l => l["Mức độ"] === "Cảnh báo").length;
  return { soLoi: soLoi, soCanhBao: soCanhBao, tongDong: logs.length };
}

/** Thêm dữ liệu vào CUỐI sheet (không xoá dữ liệu cũ) — dùng cho log lịch sử. */
function appendVaoSheet_(tenSheet, header, danhSachObject) {
  const sh = layHoacTaoSheet_(tenSheet, header);
  if (danhSachObject.length === 0) return;
  const rows = danhSachObject.map(obj => header.map(ten => (obj[ten] !== undefined ? obj[ten] : "")));
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, header.length).setValues(rows);
}
