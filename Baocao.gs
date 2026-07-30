// ================= BÁO CÁO =================
// 4 báo cáo tổng hợp dùng cho tab "Báo cáo" trên webapp. Báo cáo Tiền lương/
// Bảo hiểm/Thuế TNCN đọc trực tiếp từ RP_BANGLUONG/RP_BHXH/RP_THUETNCN — tức là
// LUÔN ứng với LẦN CHẠY "Tính lương" GẦN NHẤT (các sheet này bị ghi đè mỗi lần
// tính), không phải dữ liệu của mọi kỳ cộng dồn. layKyGanNhat_() cho biết kỳ đó
// là tháng/năm nào để hiển thị trên báo cáo.

function layKyGanNhat_() {
  return PropertiesService.getScriptProperties().getProperty("KY_GAN_NHAT") || "(chưa tính lương lần nào — vào tab Bảng lương để tính trước)";
}

/** Báo cáo tiền lương: tổng hợp toàn công ty + theo phòng ban, từ RP_BANGLUONG. */
function baoCaoTienLuong() {
  const list = docSheetThanhObject_(SHEET_BANGLUONG, HEADER_BANGLUONG);
  const theoPhongBanMap = {};
  let tongThuNhap = 0, tongThucLinh = 0, tongBH = 0, tongThue = 0, tongTamUng = 0;

  list.forEach(function (r) {
    const pb = r["Phòng ban"] || "(chưa xác định)";
    if (!theoPhongBanMap[pb]) {
      theoPhongBanMap[pb] = { "Phòng ban": pb, "Số người": 0, "Tổng thu nhập": 0, "Tổng thực lĩnh": 0 };
    }
    theoPhongBanMap[pb]["Số người"]++;
    theoPhongBanMap[pb]["Tổng thu nhập"] += Number(r["Tổng thu nhập (trước trừ)"]) || 0;
    theoPhongBanMap[pb]["Tổng thực lĩnh"] += Number(r["Thực lĩnh"]) || 0;

    tongThuNhap += Number(r["Tổng thu nhập (trước trừ)"]) || 0;
    tongThucLinh += Number(r["Thực lĩnh"]) || 0;
    tongBH += Number(r["BHXH/BHYT/BHTN trừ NLĐ"]) || 0;
    tongThue += Number(r["Thuế TNCN"]) || 0;
    tongTamUng += Number(r["Tạm ứng"]) || 0;
  });

  return {
    ky: layKyGanNhat_(),
    tongHop: { soNguoi: list.length, tongThuNhap: tongThuNhap, tongThucLinh: tongThucLinh, tongBH: tongBH, tongThue: tongThue, tongTamUng: tongTamUng },
    theoPhongBan: Object.values(theoPhongBanMap),
    chiTiet: list
  };
}

/** Báo cáo nhân sự: tổng hợp theo phòng ban/chức vụ + trạng thái, từ NL_NHANSU. */
function baoCaoNhanSu(baoGomDaNghi) {
  const list = layDanhSachNhanSu(!!baoGomDaNghi);
  const theoPhongBanMap = {}, theoChucVuMap = {};
  let dangLam = 0, daNghi = 0;

  list.forEach(function (nv) {
    const pb = nv["Tên phòng ban"] || "(chưa xác định)";
    const cv = nv["Tên chức vụ"] || "(chưa xác định)";
    theoPhongBanMap[pb] = (theoPhongBanMap[pb] || 0) + 1;
    theoChucVuMap[cv] = (theoChucVuMap[cv] || 0) + 1;
    if (nv["Trạng thái"] === "Đang làm") dangLam++; else daNghi++;
  });

  return {
    tongHop: { tongSo: list.length, dangLam: dangLam, daNghi: daNghi },
    theoPhongBan: Object.keys(theoPhongBanMap).map(function (k) { return { "Phòng ban": k, "Số người": theoPhongBanMap[k] }; }),
    theoChucVu: Object.keys(theoChucVuMap).map(function (k) { return { "Chức vụ": k, "Số người": theoChucVuMap[k] }; }),
    chiTiet: list
  };
}

/** Báo cáo các khoản trích theo lương (BHXH/BHYT/BHTN/KPCĐ), từ RP_BHXH. */
function baoCaoBHXH() {
  const list = docSheetThanhObject_(SHEET_BHXH, HEADER_BHXH);
  let tongCty = 0, tongNLD = 0;
  list.forEach(function (r) {
    tongCty += Number(r["Cộng BH công ty đóng"]) || 0;
    tongNLD += Number(r["Cộng BH NLĐ đóng"]) || 0;
  });
  return {
    ky: layKyGanNhat_(),
    tongHop: { soNguoi: list.length, tongCty: tongCty, tongNLD: tongNLD, tongCong: tongCty + tongNLD },
    chiTiet: list
  };
}

/** Báo cáo thuế TNCN, từ RP_THUETNCN. */
function baoCaoTNCN() {
  const list = docSheetThanhObject_(SHEET_TNCN, HEADER_TNCN);
  let tongThue = 0, tongThuNhapTinhThue = 0;
  list.forEach(function (r) {
    tongThue += Number(r["Thuế TNCN phải nộp"]) || 0;
    tongThuNhapTinhThue += Number(r["Thu nhập tính thuế"]) || 0;
  });
  return {
    ky: layKyGanNhat_(),
    tongHop: { soNguoiNopThue: list.length, tongThuNhapTinhThue: tongThuNhapTinhThue, tongThue: tongThue },
    chiTiet: list
  };
}

/**
 * Bảng tính bù lương sản lượng — chi tiết công thức bù (không chỉ ra 1 con số
 * cuối như cột "Lương bù SL" trong RP_BANGLUONG) để kiểm tra/đối chiếu TRƯỚC
 * khi bấm "Tính lương". Chỉ áp dụng cho người có Mã hình thức lương chứa "SP".
 * Dùng LẠI đúng logic tính bù trong TinhLuong.gs (tongHopChamCong_,
 * tongHopSanLuong_, layCongChuan_...) để đảm bảo số khớp với bảng lương thật.
 * @param {string} nam
 * @param {number} thang
 * @param {string} phuongPhapBu "NGAY" hoặc "THANG" (mặc định) — xem TinhLuong.gs
 * @return {{ phuongPhap, tongHop, chiTietThang: Array, chiTietNgay: Array }}
 *   chiTietNgay CHỈ có dữ liệu khi phuongPhapBu = "NGAY".
 */
function baoCaoBuSanLuong(nam, thang, phuongPhapBu) {
  const namSo = Number(nam);
  const buTheoNgay = (phuongPhapBu === "NGAY");

  const nhanSuList = docSheetThanhObject_(SHEET_NHANSU, HEADER_NHANSU);
  const dmLuong = docDanhMucLuong_();
  const dmPhongBan = docDanhMucPhongBan_();

  const chamCongMap = tongHopChamCong_(namSo, thang);
  const sanLuongMap = tongHopSanLuong_(SHEET_SANLUONG, namSo, thang);
  const congTheoNgayMap = buTheoNgay ? layCongChinhTheoNgay_(namSo, thang) : null;
  const sanLuongTheoNgayMap = buTheoNgay ? tongHopSanLuongTheoNgay_(SHEET_SANLUONG, namSo, thang) : null;

  const chiTietThang = [];
  const chiTietNgay = [];

  nhanSuList.forEach(function (ns) {
    const maNV = ns["Mã nhân viên"];
    if (!maNV) return;
    const dmLuongInfo = dmLuong[ns["Mã tiền lương 1"]] || dmLuong[ns["Mã tiền lương 2"]] || null;
    const laSP = !!(dmLuongInfo && /SP/i.test(dmLuongInfo["Mã hình thức lương"] || ""));
    if (!laSP) return; // chỉ báo cáo cho người trả lương theo sản lượng

    const congInfo = chamCongMap[maNV] || { tongCong: 0 };
    const congChuan = layCongChuan_(ns, thang, namSo, dmLuong, congInfo.tongCong);
    const sanLuongTan = sanLuongMap[maNV] || 0;
    const donGiaSL = Number(dmLuongInfo["Số tiền khoán"]) || 0;
    const luongSanLuong = Math.round(sanLuongTan * donGiaSL);
    const nguongCong = Number(dmLuongInfo["ĐK_Bù lương (công tối thiểu)"]) || 0;
    const donGiaBu = Number(dmLuongInfo["Đơn giá bù lương"]) || 0;

    let luongBuSL = 0, slBinhQuan = 0, duoiNguong = false;

    if (buTheoNgay) {
      const congNgay = (congTheoNgayMap && congTheoNgayMap[maNV]) || {};
      const slNgay = (sanLuongTheoNgayMap && sanLuongTheoNgayMap[maNV]) || {};
      let coNgayDuoiNguong = false;
      for (let ngay = 1; ngay <= 31; ngay++) {
        const ten = ("0" + ngay).slice(-2);
        const congCuaNgay = congNgay[ten] || 0;
        if (congCuaNgay <= 0) continue;
        const slCuaNgay = slNgay[ten] || 0;
        const slBinhQuanNgay = congCuaNgay > 0 ? slCuaNgay / congCuaNgay : 0;
        const duoiNgNgay = nguongCong > 0 && slBinhQuanNgay < nguongCong;
        let buNgay = 0;
        if (duoiNgNgay) {
          buNgay = Math.max(0, Math.round(donGiaBu * congCuaNgay) - Math.round(slCuaNgay * donGiaSL));
          if (buNgay > 0) coNgayDuoiNguong = true;
        }
        luongBuSL += buNgay;
        chiTietNgay.push({
          "Mã NV": maNV, "Họ và tên": ns["Họ và tên"], "Ngày": ten + "/" + thang + "/" + namSo,
          "Sản lượng ngày (tấn)": slCuaNgay, "Công ngày": congCuaNgay,
          "SL bình quân/công": Math.round(slBinhQuanNgay * 100) / 100, "Ngưỡng (tấn/công)": nguongCong,
          "Dưới ngưỡng?": duoiNgNgay ? "Có" : "Không", "Lương bù ngày": buNgay
        });
      }
      slBinhQuan = congInfo.tongCong > 0 ? sanLuongTan / congInfo.tongCong : 0;
      duoiNguong = coNgayDuoiNguong;
    } else {
      slBinhQuan = congInfo.tongCong > 0 ? sanLuongTan / congInfo.tongCong : 0;
      duoiNguong = nguongCong > 0 && congInfo.tongCong > 0 && slBinhQuan < nguongCong;
      if (duoiNguong) {
        luongBuSL = Math.max(0, Math.round(donGiaBu * congInfo.tongCong) - luongSanLuong);
      }
    }

    chiTietThang.push({
      "Mã NV": maNV, "Họ và tên": ns["Họ và tên"], "Phòng ban": tenPhongBan_(ns["Mã PB"], dmPhongBan),
      "Sản lượng (tấn)": sanLuongTan, "Tổng công": congInfo.tongCong, "Công chuẩn": congChuan,
      "SL bình quân/công": Math.round(slBinhQuan * 100) / 100, "Ngưỡng (tấn/công)": nguongCong,
      "Dưới ngưỡng?": duoiNguong ? "Có" : "Không",
      "Đơn giá SL": donGiaSL, "Lương sản lượng": luongSanLuong,
      "Đơn giá bù": donGiaBu, "Lương bù": luongBuSL
    });
  });

  let tongLuongBu = 0, soNguoiDuocBu = 0;
  chiTietThang.forEach(function (r) {
    tongLuongBu += r["Lương bù"];
    if (r["Lương bù"] > 0) soNguoiDuocBu++;
  });

  return {
    phuongPhap: buTheoNgay ? "Theo ngày" : "Theo tháng",
    tongHop: { soNguoiSanLuong: chiTietThang.length, soNguoiDuocBu: soNguoiDuocBu, tongLuongBu: tongLuongBu },
    chiTietThang: chiTietThang,
    chiTietNgay: chiTietNgay
  };
}

/**
 * Báo cáo phân bổ sản lượng gỗ keo (hoặc bơm dăm) theo phòng ban và theo từng
 * công nhân trong 1 kỳ — dùng để ĐỐI CHIẾU TRƯỚC khi Tính lương, xem sản lượng
 * đã phân bổ hết cho ai chưa, tổ nào sản lượng cao/thấp, trước khi ra bảng lương
 * cuối cùng. Đọc trực tiếp từ DL_SANLUONG/DL_BANDAM (dữ liệu phiếu cân đã nạp
 * qua tab Nhập liệu hoặc Ứng lương & Bơm dăm), không phụ thuộc đã "Tính lương"
 * hay chưa.
 * @param {string} nam
 * @param {number} thang
 * @param {string} loai "SANLUONG" (mặc định, sản lượng gỗ keo) hoặc "BANDAM"
 */
function baoCaoPhanBoSanLuong(nam, thang, loai) {
  const namSo = Number(nam);
  const tenSheet = (loai === "BANDAM") ? SHEET_BANDAM : SHEET_SANLUONG;
  const list = docSheetThanhObject_(tenSheet, HEADER_SANLUONG).filter(function (r) {
    const ngay = r["Ngày cân"];
    return (ngay instanceof Date) && ngay.getFullYear() == namSo && (ngay.getMonth() + 1) == Number(thang);
  });

  const dmPhongBan = docDanhMucPhongBan_();
  const nhanSuMap = {};
  docSheetThanhObject_(SHEET_NHANSU, HEADER_NHANSU).forEach(function (ns) { nhanSuMap[ns["Mã nhân viên"]] = ns; });

  const theoPhongBanMap = {}, theoCongNhanMap = {};
  const chuaGanNguoi = [];
  let tongTan = 0, tongPhieu = 0;

  list.forEach(function (r) {
    const tan = Number(r["KL hàng (Tấn)"]) || 0;
    const maPB = r["Mã phòng ban"] || "(chưa xác định)";
    const tenPB = dmPhongBan[maPB] ? dmPhongBan[maPB]["Tên phòng ban"] : maPB;
    const maNV = r["Mã NV"];

    tongTan += tan;
    tongPhieu++;

    if (!theoPhongBanMap[maPB]) theoPhongBanMap[maPB] = { "Mã phòng ban": maPB, "Tên phòng ban": tenPB, "Tổng sản lượng (tấn)": 0, "Số phiếu cân": 0, "Số công nhân": 0, _nv: {} };
    theoPhongBanMap[maPB]["Tổng sản lượng (tấn)"] += tan;
    theoPhongBanMap[maPB]["Số phiếu cân"]++;

    if (!maNV) {
      chuaGanNguoi.push({ "Phiếu cân": r["Phiếu cân"], "Ngày cân": r["Ngày cân"], "Biển số": r["Biển số"], "KL hàng (Tấn)": tan, "Mã phòng ban": maPB, "Tên phòng ban": tenPB });
      return;
    }

    theoPhongBanMap[maPB]._nv[maNV] = true;

    if (!theoCongNhanMap[maNV]) {
      const ns = nhanSuMap[maNV];
      theoCongNhanMap[maNV] = {
        "Mã NV": maNV, "Họ và tên": ns ? ns["Họ và tên"] : "(không có trong NL_NHANSU)",
        "Mã phòng ban": maPB, "Tên phòng ban": tenPB,
        "Tổng sản lượng (tấn)": 0, "Số phiếu cân": 0
      };
    }
    theoCongNhanMap[maNV]["Tổng sản lượng (tấn)"] += tan;
    theoCongNhanMap[maNV]["Số phiếu cân"]++;
  });

  const theoPhongBan = Object.values(theoPhongBanMap).map(function (r) {
    return {
      "Mã phòng ban": r["Mã phòng ban"], "Tên phòng ban": r["Tên phòng ban"],
      "Tổng sản lượng (tấn)": r["Tổng sản lượng (tấn)"], "Số phiếu cân": r["Số phiếu cân"],
      "Số công nhân": Object.keys(r._nv).length
    };
  });
  theoPhongBan.sort(function (a, b) { return b["Tổng sản lượng (tấn)"] - a["Tổng sản lượng (tấn)"]; });

  const theoCongNhan = Object.values(theoCongNhanMap).map(function (r) {
    const tongPB = theoPhongBanMap[r["Mã phòng ban"]]["Tổng sản lượng (tấn)"];
    r["Tỷ trọng trong phòng ban (%)"] = tongPB > 0 ? Math.round((r["Tổng sản lượng (tấn)"] / tongPB) * 1000) / 10 : 0;
    return r;
  });
  theoCongNhan.sort(function (a, b) { return b["Tổng sản lượng (tấn)"] - a["Tổng sản lượng (tấn)"]; });

  return {
    tongHop: {
      tongTan: tongTan, tongPhieu: tongPhieu,
      soCongNhanCoPhanBo: Object.keys(theoCongNhanMap).length,
      soPhieuChuaGanNguoi: chuaGanNguoi.length
    },
    theoPhongBan: theoPhongBan,
    theoCongNhan: theoCongNhan,
    chuaGanNguoi: chuaGanNguoi
  };
}
