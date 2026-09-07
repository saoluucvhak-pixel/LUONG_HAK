// Test TÍCH HỢP: chạy THẬT hàm tinhBangLuong() (bộ máy tính lương trung tâm)
// với 3 kịch bản thực tế (lương thời gian cơ bản, lương sản lượng + bơm dăm +
// bù sản lượng + truy thu bảo hiểm, tăng ca TC1 + phụ cấp tỷ lệ + TNCN1) —
// chỉ thay lớp đọc/ghi Google Sheet bằng kho dữ liệu giả lập trong bộ nhớ.
// Chạy: node tests/test-tinh-luong.js
'use strict';
const assert = require('assert');
const { napCodeGs, taoBoTest, ganStubGAS } = require('./_lib');

const PROPS = ganStubGAS();
const FAKE_DB = {};
const GHI_DE_LOG = {};
global.FAKE_DB = FAKE_DB;
global.GHI_DE_LOG = GHI_DE_LOG;

napCodeGs(
  ['Code.gs', 'Danhmuc.gs', 'Tinhcong.gs', 'Tinhluong.gs'],
  `
  function docSheetThanhObject_(tenSheet, header) { return FAKE_DB[tenSheet] || []; }
  function ghiDeSheet_(tenSheet, header, danhSach) { GHI_DE_LOG[tenSheet] = danhSach; }
  `
);

const { test, tongKet } = taoBoTest('TINH LUONG (3 kich ban)');

function resetDB() {
  Object.keys(FAKE_DB).forEach((k) => delete FAKE_DB[k]);
  Object.keys(GHI_DE_LOG).forEach((k) => delete GHI_DE_LOG[k]);
  [SHEET_SANLUONG, SHEET_BANDAM, SHEET_PSLUONG, SHEET_UNGLUONG, SHEET_TIENCOM,
    SHEET_DM_PHUCAP, SHEET_DM_TANGCA, SHEET_DM_HOTRO, SHEET_DM_TNCN, SHEET_DM_GTTNCN]
    .forEach((s) => { FAKE_DB[s] = []; });
}

console.log('===== Kịch bản 1: Lương thời gian (TG1) cơ bản =====');
resetDB();
FAKE_DB[SHEET_NHANSU] = [{
  'Mã nhân viên': 'NV001', 'Họ và tên': 'Nguyễn Văn A', 'Mã PB': 'PB01', 'Mã CV': 'CV01',
  'Ngày vào làm': new Date(2024, 0, 1), 'Lương cơ bản': 7800000, 'Lương thỏa thuận': 7800000,
  'Mã tiền lương 1': 'TG1', 'Mã BHXH': 'BH01', 'Mã TNCN': 'TNCN2'
}];
FAKE_DB[SHEET_CHITIETNS] = [{ 'Mã nhân viên': 'NV001', 'Mã GT_TNCN_BT': 'GTBT.01', 'Người phụ thuộc': 0 }];
(function () {
  const row = { 'Mã NV': 'NV001', 'Ngày tính công': new Date(2026, 7, 1), 'Hình thức công': 'BT' };
  for (let d = 1; d <= 31; d++) row[('0' + d).slice(-2)] = (d <= 26) ? 1 : 0;
  FAKE_DB[SHEET_CHAMCONG] = [row];
})();
FAKE_DB[SHEET_DM_LUONG] = [{ 'Mã lương': 'TG1', 'Mã hình thức lương': 'LTG', 'Cách tính': 'Số ngày của tháng - tất cả ngày CN' }];
FAKE_DB[SHEET_DM_BAOHIEM] = [{ 'Mã bảo hiểm': 'BH01', 'DN.BHXH': 0.175, 'DN.BHYT': 0.03, 'DN.BHTN': 0.01, 'DN.KPCD': 0.02, 'NLD.BHXH': 0.08, 'NLD.BHYT': 0.015, 'NLD.BHTN': 0.01, 'NLD.KPCD': 0 }];
FAKE_DB[SHEET_DM_PHONGBAN] = [{ 'Mã phòng ban': 'PB01', 'Tên phòng ban': 'Văn phòng' }];
FAKE_DB[SHEET_DM_CHUCVU] = [{ 'Mã chức vụ': 'CV01', 'Tên chức vụ': 'Nhân viên' }];
FAKE_DB[SHEET_DM_TNCN] = [
  { 'Bậc': 1, 'Thu nhập tháng (Min)': 0, 'Thu nhập tháng (Max)': 5000000, 'Tỷ lệ đóng thuế': 0.05 },
  { 'Bậc': 2, 'Thu nhập tháng (Min)': 5000000, 'Thu nhập tháng (Max)': 10000000, 'Tỷ lệ đóng thuế': 0.10 }
];
FAKE_DB[SHEET_DM_GTTNCN] = [{ 'Mã giảm trừ': 'GTBT.01', 'Số tiền': 11000000 }];

{
  const tomTat = tinhBangLuong('2026', 8, 'THANG');
  const r = GHI_DE_LOG[SHEET_BANGLUONG][0];
  const bh = GHI_DE_LOG[SHEET_BHXH][0];
  test('Tinh dung 1 nguoi', () => assert.strictEqual(tomTat.soNguoi, 1));
  test('Cong chuan TG1 thang 8/2026 = 26', () => assert.strictEqual(r['Công chuẩn'], 26));
  test('Luong thoi gian = 7.800.000', () => assert.strictEqual(r['Lương thời gian'], 7800000));
  test('BHXH tru NLD = 819.000 (10.5% x 7.8tr)', () => assert.strictEqual(bh['Cộng BH NLĐ đóng'], 819000));
  test('Khong truy thu BH (khong khai nguong)', () => assert.strictEqual(bh['Truy thu bảo hiểm'], 0));
  test('Duoi muc giam tru -> khong co dong RP_THUETNCN', () => assert.strictEqual(GHI_DE_LOG[SHEET_TNCN].length, 0));
  test('Thuc linh = 7.800.000 - 819.000 = 6.981.000', () => assert.strictEqual(r['Thực lĩnh'], 6981000));
  test('KY_GAN_NHAT ghi dung', () => assert.strictEqual(PROPS['KY_GAN_NHAT'], '8/2026'));
}

console.log('===== Kịch bản 2: Lương sản lượng (SP) + bơm dăm + bù SL + truy thu BH =====');
resetDB();
FAKE_DB[SHEET_NHANSU] = [{
  'Mã nhân viên': 'NV002', 'Họ và tên': 'Trần Thị B', 'Mã PB': 'PB02', 'Mã CV': 'CV02',
  'Lương cơ bản': 5000000, 'Lương thỏa thuận': 250000, 'Mã tiền lương 1': 'SP', 'Mã tiền lương 2': 'BD',
  'Mã BHXH': 'BH01', 'Mã TNCN': 'TNCN0'
}];
FAKE_DB[SHEET_CHITIETNS] = [{ 'Mã nhân viên': 'NV002', 'Người phụ thuộc': 0 }];
(function () {
  const row = { 'Mã NV': 'NV002', 'Ngày tính công': new Date(2026, 7, 1), 'Hình thức công': 'BT' };
  for (let d = 1; d <= 31; d++) row[('0' + d).slice(-2)] = (d <= 10) ? 1 : 0;
  FAKE_DB[SHEET_CHAMCONG] = [row];
})();
FAKE_DB[SHEET_SANLUONG] = [{ 'Ngày cân': new Date(2026, 7, 5), 'KL hàng (Tấn)': 50, 'Mã phòng ban': 'PB02', 'Mã NV': 'NV002' }];
FAKE_DB[SHEET_BANDAM] = [{ 'Ngày cân': new Date(2026, 7, 5), 'KL hàng (Tấn)': 3, 'Mã phòng ban': 'PB02', 'Mã NV': 'NV002' }];
FAKE_DB[SHEET_DM_LUONG] = [
  { 'Mã lương': 'SP', 'Mã hình thức lương': 'LSP', 'Số tiền khoán': 6000, 'Ngưỡng truy thu BH (công)': 15, 'ĐK_Bù lương (công tối thiểu)': 15, 'Đơn giá bù lương': 200000, 'Cách tính': 'Nhân với sản lượng, bù nếu dưới ngưỡng công tối thiểu' },
  { 'Mã lương': 'BD', 'Mã hình thức lương': 'LSP', 'Số tiền khoán': 10000, 'Cách tính': 'Nhân với số xe' }
];
FAKE_DB[SHEET_DM_BAOHIEM] = [{ 'Mã bảo hiểm': 'BH01', 'DN.BHXH': 0.175, 'DN.BHYT': 0.03, 'DN.BHTN': 0.01, 'DN.KPCD': 0.02, 'NLD.BHXH': 0.08, 'NLD.BHYT': 0.015, 'NLD.BHTN': 0.01, 'NLD.KPCD': 0 }];
FAKE_DB[SHEET_DM_PHONGBAN] = [{ 'Mã phòng ban': 'PB02', 'Tên phòng ban': 'Sản xuất' }];
FAKE_DB[SHEET_DM_CHUCVU] = [{ 'Mã chức vụ': 'CV02', 'Tên chức vụ': 'Công nhân' }];

{
  tinhBangLuong('2026', 8, 'THANG');
  const r = GHI_DE_LOG[SHEET_BANGLUONG][0];
  const bh = GHI_DE_LOG[SHEET_BHXH][0];
  test('Luong san luong = 50 tan x 6000 = 300.000', () => assert.strictEqual(r['Lương sản lượng'], 300000));
  test('Luong thoi gian (dg/cong x cong tinh LTG = 250k x 10) = 2.500.000', () => assert.strictEqual(r['Lương thời gian'], 2500000));
  test('Bu san luong (duoi nguong 15 tan/cong) = 200k*10 - 300k = 1.700.000', () => assert.strictEqual(r['Lương bù SL (nếu dưới ngưỡng)'], 1700000));
  test('Luong bom dam = 3 xe x 10.000 = 30.000', () => assert.strictEqual(r['Lương bơm dăm'], 30000));
  test('Tong thu nhap = 4.530.000', () => assert.strictEqual(r['Tổng thu nhập (trước trừ)'], 4530000));
  test('BHXH tru NLD = 0 (chua du nguong -> khong tru truc tiep)', () => assert.strictEqual(r['BHXH/BHYT/BHTN trừ NLĐ'], 0));
  test('Truy thu bao hiem = round(5tr x 23.5%) = 1.175.000', () => assert.strictEqual(r['Truy thu bảo hiểm'], 1175000));
  test('Ghi chu nguong cong dung', () => assert.ok(bh['Ghi chú ngưỡng công'].startsWith('Chưa đủ ngưỡng')));
  test('TNCN0 -> mien thue', () => assert.strictEqual(GHI_DE_LOG[SHEET_TNCN].length, 0));
  test('Thuc linh = 4.530.000 - 1.175.000 = 3.355.000', () => assert.strictEqual(r['Thực lĩnh'], 3355000));
}

console.log('===== Kịch bản 3: Tăng ca TC1 + Phụ cấp tỷ lệ công + Thuế TNCN1 =====');
resetDB();
FAKE_DB[SHEET_NHANSU] = [{
  'Mã nhân viên': 'NV003', 'Họ và tên': 'Lê Văn C', 'Mã PB': 'PB01', 'Mã CV': 'CV01',
  'Lương cơ bản': 7020000, 'Lương thỏa thuận': 7020000, 'Mã tiền lương 1': 'TG1',
  'Mã tăng ca': 'TC1', 'Mã phụ cấp': 'TN.02', 'Mã TNCN': 'TNCN1'
}];
FAKE_DB[SHEET_CHITIETNS] = [{ 'Mã nhân viên': 'NV003', 'Người phụ thuộc': 0 }];
(function () {
  const rowBT = { 'Mã NV': 'NV003', 'Ngày tính công': new Date(2026, 7, 1), 'Hình thức công': 'BT' };
  const rowTC = { 'Mã NV': 'NV003', 'Ngày tính công': new Date(2026, 7, 1), 'Hình thức công': 'TC' };
  for (let d = 1; d <= 31; d++) { const ten = ('0' + d).slice(-2); rowBT[ten] = (d <= 28) ? 1 : 0; rowTC[ten] = (d <= 3) ? 1 : 0; }
  FAKE_DB[SHEET_CHAMCONG] = [rowBT, rowTC];
})();
FAKE_DB[SHEET_DM_LUONG] = [{ 'Mã lương': 'TG1', 'Mã hình thức lương': 'LTG', 'Cách tính': 'Số ngày của tháng - tất cả ngày CN' }];
FAKE_DB[SHEET_DM_TANGCA] = [{ 'Mã tăng ca': 'TC1', 'Hệ số tăng ca': '50%' }];
FAKE_DB[SHEET_DM_PHUCAP] = [{ 'Mã phụ cấp': 'TN.02', 'Số tiền': 200000, 'Tham chiếu': 5, 'Cách tính': 'Tổng công >= (công chuẩn-5) tính đủ 200k, nhỏ hơn = 200k/công chuẩn×tổng công' }];
FAKE_DB[SHEET_DM_PHONGBAN] = [{ 'Mã phòng ban': 'PB01', 'Tên phòng ban': 'Văn phòng' }];
FAKE_DB[SHEET_DM_CHUCVU] = [{ 'Mã chức vụ': 'CV01', 'Tên chức vụ': 'Nhân viên' }];

{
  tinhBangLuong('2026', 8, 'THANG');
  const r = GHI_DE_LOG[SHEET_BANGLUONG][0];
  // Tính tay theo đúng công thức tài liệu để đối chiếu:
  const congChuan = 26, tongCong = 31, congTangCa = 3, heSo = 0.5;
  const du = tongCong - congTangCa - congChuan; // TC1: cCTL - cLe - cTrungChuyen - cPhep - cTang - cChuan
  const congTinhTangCa = (du > 0 ? du * heSo : 0) + congTangCa * heSo;
  const donGiaLTG = 7020000 / congChuan;
  const tienTangCaKyVong = Math.round(donGiaLTG * congTinhTangCa);
  const luongThoiGianKyVong = Math.round(donGiaLTG * Math.min(tongCong, congChuan));
  const tongThuNhapKyVong = luongThoiGianKyVong + tienTangCaKyVong + 200000;
  const thueTNCNKyVong = Math.round(tongThuNhapKyVong * 0.10);
  const thucLinhKyVong = Math.round((tongThuNhapKyVong - thueTNCNKyVong) / 1000) * 1000;

  test('Luong thoi gian = ' + luongThoiGianKyVong, () => assert.strictEqual(r['Lương thời gian'], luongThoiGianKyVong));
  test('Tien tang ca (TC1) = ' + tienTangCaKyVong, () => assert.strictEqual(r['Tiền tăng ca'], tienTangCaKyVong));
  test('Phu cap TN.02 (du nguong 21 cong, co 31) = 200.000', () => assert.strictEqual(r['Phụ cấp'], 200000));
  test('Tong thu nhap = ' + tongThuNhapKyVong, () => assert.strictEqual(r['Tổng thu nhập (trước trừ)'], tongThuNhapKyVong));
  test('Thue TNCN1 = 10% tren TONG THU NHAP GOP = ' + thueTNCNKyVong, () => assert.strictEqual(r['Thuế TNCN'], thueTNCNKyVong));
  test('Giam tru ban than/NPT = 0 khi TNCN1', () => {
    const dongTNCN = GHI_DE_LOG[SHEET_TNCN][0];
    assert.strictEqual(dongTNCN['Giảm trừ bản thân'], 0);
    assert.strictEqual(dongTNCN['Giảm trừ người phụ thuộc'], 0);
  });
  test('Thuc linh = ' + thucLinhKyVong, () => assert.strictEqual(r['Thực lĩnh'], thucLinhKyVong));
}

const kq = tongKet();
if (require.main === module) process.exit(kq.failed > 0 ? 1 : 0);
module.exports = kq;
