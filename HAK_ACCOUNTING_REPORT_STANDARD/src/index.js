'use strict';
const numberFormats = new Map();
function formatNumber(value, { maxDecimals = 2, minDecimals = 0 } = {}) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected finite number');
  if (!Number.isInteger(maxDecimals) || maxDecimals < 0 || maxDecimals > 20 || !Number.isInteger(minDecimals) || minDecimals < 0 || minDecimals > maxDecimals) throw new RangeError('Invalid precision');
  const key = minDecimals + ':' + maxDecimals;
  if (!numberFormats.has(key)) numberFormats.set(key, new Intl.NumberFormat('vi-VN', {useGrouping:true,minimumFractionDigits:minDecimals,maximumFractionDigits:maxDecimals}));
  return numberFormats.get(key).format(value);
}
function formatVND(value) { return formatNumber(value, {maxDecimals:0}); }
function formatDateISO(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value !== 'string') throw new TypeError('Expected ISO yyyy-MM-dd');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) throw new RangeError('Invalid date');
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y,mo-1,d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo-1 || dt.getUTCDate() !== d) throw new RangeError('Invalid calendar date');
  return m[3]+'/'+m[2]+'/'+m[1];
}
function alignFor(type) {
  if (['integer','decimal','money','percent'].includes(type)) return 'right';
  if (['date','datetime'].includes(type)) return 'center';
  return 'left';
}
function validateColumns(columns) {
  if (!Array.isArray(columns) || !columns.length) throw new TypeError('Non-empty columns required');
  const keys = new Set();
  return columns.map(c => {
    if (!c || typeof c.key !== 'string' || !c.key || keys.has(c.key)) throw new TypeError('Invalid/duplicate column key');
    keys.add(c.key);
    const type = c.type || 'text';
    if (!['text','code','integer','decimal','money','percent','date','datetime','boolean'].includes(type)) throw new TypeError('Invalid column type');
    const minWidth = c.minWidth ?? 70, maxWidth = c.maxWidth ?? 350;
    if (!(minWidth > 0 && maxWidth >= minWidth)) throw new RangeError('Invalid column widths');
    return {...c,type,align:c.align || alignFor(type),minWidth,maxWidth,wrap:c.wrap ?? type === 'text'};
  });
}
module.exports = {formatNumber,formatVND,formatDateISO,alignFor,validateColumns};
