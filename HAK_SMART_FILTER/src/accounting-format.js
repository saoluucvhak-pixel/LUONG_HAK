'use strict';
// HAK vi-VN presentation helpers. Never use formatted strings as calculation inputs.
const numberFormatCache = new Map();
function formatter(maxDecimals, minDecimals = 0) {
  if (!Number.isInteger(maxDecimals) || maxDecimals < 0 || maxDecimals > 20 || !Number.isInteger(minDecimals) || minDecimals < 0 || minDecimals > maxDecimals) throw new RangeError('Invalid precision');
  const key = maxDecimals + ':' + minDecimals;
  if (!numberFormatCache.has(key)) numberFormatCache.set(key, new Intl.NumberFormat('vi-VN', { useGrouping: true, minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals }));
  return numberFormatCache.get(key);
}
function formatNumber(value, options = {}) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected finite numeric value');
  return formatter(options.maxDecimals ?? 2, options.minDecimals ?? 0).format(value);
}
function formatVND(value) { return formatNumber(value, { maxDecimals: 0, minDecimals: 0 }); }
function formatISODate(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value !== 'string') throw new TypeError('Expected ISO yyyy-MM-dd date string');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) throw new RangeError('Invalid ISO date');
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) throw new RangeError('Invalid calendar date');
  return m[3] + '/' + m[2] + '/' + m[1];
}
function alignment(type) {
  if (['integer', 'decimal', 'money', 'percent'].includes(type)) return 'right';
  if (['date', 'datetime'].includes(type)) return 'center';
  return 'left';
}
const api = { formatNumber, formatVND, formatISODate, alignment };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
