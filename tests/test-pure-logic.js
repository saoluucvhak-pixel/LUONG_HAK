// Test các hàm tính toán THUẦN (không đụng SpreadsheetApp) — trích nguyên văn
// từ Tinhcong.gs/Tinhluong.gs/Danhmuc.gs/Dongbongoai.gs. Chạy: node tests/test-pure-logic.js
'use strict';
const assert = require('assert');
const { napCodeGs, taoBoTest, ganStubGAS } = require('./_lib');

ganStubGAS();
napCodeGs(['Tinhcong.gs', 'Tinhluong.gs', 'Danhmuc.gs', 'Dongbongoai.gs']);
// Các hàm/hằng số dưới đây giờ là identifier TOÀN CỤC (global) sau napCodeGs().

const { test, tongKet } = taoBoTest('PURE LOGIC');

console.log('--- tachSoCongVaNhan_ ---');
test('so thuan 1 -> {1,""}', () => assert.deepStrictEqual(tachSoCongVaNhan_(1), { soCong: 1, nhan: '' }));
test('"1QC" -> {1,"QC"} (Number("1QC")=NaN neu khong xu ly rieng)', () => assert.deepStrictEqual(tachSoCongVaNhan_('1QC'), { soCong: 1, nhan: 'QC' }));
test('"0.5CL" -> {0.5,"CL"}', () => assert.deepStrictEqual(tachSoCongVaNhan_('0.5CL'), { soCong: 0.5, nhan: 'CL' }));
test('o rong -> {0,""}', () => assert.deepStrictEqual(tachSoCongVaNhan_(''), { soCong: 0, nhan: '' }));
test('"1,5" (dau phay thap phan) -> soCong 1.5', () => assert.strictEqual(tachSoCongVaNhan_('1,5').soCong, 1.5));

console.log('--- soTuChuoiPhanTram_ ---');
test('so thuan 0.5 -> 0.5', () => assert.strictEqual(soTuChuoiPhanTram_(0.5), 0.5));
test('"50%" -> 0.5 (Number("50%")=NaN neu khong xu ly rieng)', () => assert.strictEqual(soTuChuoiPhanTram_('50%'), 0.5));
test('rong -> 0', () => assert.strictEqual(soTuChuoiPhanTram_(''), 0));

console.log('--- layCongChuan_ (Cong chuan phai luon tru Chu nhat truoc, roi moi tru "- N") ---');
{
  const dmLuong = {
    TG1: { 'Cách tính': 'Số ngày của tháng - tất cả ngày CN' },
    TG2: { 'Cách tính': 'Số ngày của tháng ' },
    TG3: { 'Cách tính': 'Số ngày của tháng - 4' },
    TG4: { 'Cách tính': 'Số ngày của tháng - 2' },
    CN1: { 'Cách tính': 'Thực tế ngày công' }
  };
  // Thang 8/2026: 31 ngay, 5 Chu nhat
  test('TG1 thang 8/2026 = 26 (31-5CN)', () => assert.strictEqual(layCongChuan_({ 'Mã tiền lương 1': 'TG1' }, 8, 2026, dmLuong, 0), 26));
  test('TG2 thang 8/2026 = 31 (khong tru CN)', () => assert.strictEqual(layCongChuan_({ 'Mã tiền lương 1': 'TG2' }, 8, 2026, dmLuong, 0), 31));
  test('TG3 thang 8/2026 = 22 (26-4)', () => assert.strictEqual(layCongChuan_({ 'Mã tiền lương 1': 'TG3' }, 8, 2026, dmLuong, 0), 22));
  test('TG4 thang 8/2026 = 24 (26-2)', () => assert.strictEqual(layCongChuan_({ 'Mã tiền lương 1': 'TG4' }, 8, 2026, dmLuong, 0), 24));
  test('CN1 (thuc te ngay cong) = congThucTe truyen vao', () => assert.strictEqual(layCongChuan_({ 'Mã tiền lương 1': 'CN1' }, 8, 2026, dmLuong, 25), 25));
}

console.log('--- tinhHeSoTangCa_ ---');
test('TC3 = (congTangCa+congChuNhat)*heSo', () => assert.strictEqual(tinhHeSoTangCa_('TC3', 0, 0, 0, 0, 2, 3, 1.5, 0, 0), (3 + 2) * 1.5));
test('TC4 = congTangCa*heSo', () => assert.strictEqual(tinhHeSoTangCa_('TC4', 0, 0, 0, 0, 0, 4, 2, 0, 0), 8));
test('TC6 khong nhan he so', () => assert.strictEqual(tinhHeSoTangCa_('TC6', 30, 0, 0, 26, 0, 0, 1.5, 0, 0), 4));

console.log('--- tinhThueTNCNLuyTien_ (bieu luy tien tung phan) ---');
{
  const bieu = [
    { 'Thu nhập tháng (Min)': 0, 'Thu nhập tháng (Max)': 5000000, 'Tỷ lệ đóng thuế': 0.05 },
    { 'Thu nhập tháng (Min)': 5000000, 'Thu nhập tháng (Max)': 10000000, 'Tỷ lệ đóng thuế': 0.10 },
    { 'Thu nhập tháng (Min)': 10000000, 'Thu nhập tháng (Max)': 18000000, 'Tỷ lệ đóng thuế': 0.15 }
  ];
  test('thu nhap 0 -> thue 0', () => assert.strictEqual(tinhThueTNCNLuyTien_(0, bieu), 0));
  test('thu nhap 5tr (dung bac 1) -> thue 250k', () => assert.strictEqual(tinhThueTNCNLuyTien_(5000000, bieu), 250000));
  test('thu nhap 12tr -> luy tien 3 bac = 1.050.000', () => assert.strictEqual(tinhThueTNCNLuyTien_(12000000, bieu), 1050000));
}

console.log('--- dinhDangMa_ (chong Excel tu chuyen ma thanh so) ---');
test('so nguyen 9 -> "9"', () => assert.strictEqual(dinhDangMa_(9), '9'));
test('so 1.1 -> "1.10" (khong mat so 0 cuoi)', () => assert.strictEqual(dinhDangMa_(1.1), '1.10'));
test('chuoi "PB01" giu nguyen', () => assert.strictEqual(dinhDangMa_('PB01'), 'PB01'));

console.log('--- ngayNgoaiThanhDate_ / conHieuLuc_ (Date nam <=1900 = chua co gia tri) ---');
test('Date nam 1899 (serial 0) -> null', () => assert.strictEqual(ngayNgoaiThanhDate_(new Date(1899, 11, 30)), null));
test('Date that -> giu nguyen', () => { const d = new Date(2026, 5, 1); assert.strictEqual(ngayNgoaiThanhDate_(d), d); });
test('0 -> null', () => assert.strictEqual(ngayNgoaiThanhDate_(0), null));
test('Hieu luc den = nam 1899 -> con hieu luc', () => {
  const row = { tu: new Date(2020, 0, 1), den: new Date(1899, 11, 30) };
  assert.strictEqual(conHieuLuc_(row, new Date(2026, 5, 1), 'tu', 'den'), true);
});
test('Hieu luc den = qua khu that -> het hieu luc', () => {
  const row = { tu: new Date(2020, 0, 1), den: new Date(2025, 0, 1) };
  assert.strictEqual(conHieuLuc_(row, new Date(2026, 5, 1), 'tu', 'den'), false);
});

const kq = tongKet();
if (require.main === module) process.exit(kq.failed > 0 ? 1 : 0);
module.exports = kq;
