// Chạy TOÀN BỘ file test-*.js trong thư mục này, MỖI FILE 1 SUBPROCESS RIÊNG
// (bắt buộc — mỗi test nạp code .gs vào `global` của chính process đó qua
// indirect eval, chạy chung 1 process sẽ đụng độ tên hàm/biến giữa các file).
// Dùng: node tests/run-all.js  (exit code khác 0 nếu có bất kỳ test nào fail)
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const danhSachFile = fs.readdirSync(__dirname)
  .filter((f) => f.startsWith('test-') && f.endsWith('.js'))
  .sort();

let tongFail = 0;
danhSachFile.forEach((f) => {
  console.log('\n########## ' + f + ' ##########');
  try {
    execFileSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit' });
  } catch (e) {
    tongFail++;
  }
});

console.log('\n===================================');
if (tongFail === 0) {
  console.log('TẤT CẢ ' + danhSachFile.length + ' FILE TEST ĐỀU PASS.');
} else {
  console.log(tongFail + '/' + danhSachFile.length + ' FILE TEST CÓ LỖI — xem chi tiết ở trên.');
}
process.exit(tongFail === 0 ? 0 : 1);
