'use strict';
const {formatNumber}=require('./index');
const TYPES=['money','quantity'];
function validatePrecision(setting) {
  if (!setting || typeof setting !== 'object') throw new TypeError('Precision setting required');
  if (!['integer','decimal'].includes(setting.mode)) throw new RangeError('mode must be integer or decimal');
  const digits=setting.mode==='integer'?0:setting.digits;
  if (!Number.isInteger(digits)||digits<0||digits>6) throw new RangeError('digits must be 0..6');
  return {mode:setting.mode,digits};
}
function normalizeSettings(input={}) {
  const defaults={money:{mode:'integer',digits:0},quantity:{mode:'decimal',digits:2}};
  const out={};
  for(const t of TYPES)out[t]=validatePrecision(input[t]||defaults[t]);
  const columns={};
  for(const [key,setting] of Object.entries(input.columns||{})) {
    if(!key||key==='__proto__'||key==='constructor'||key==='prototype')throw new TypeError('Invalid column key');
    columns[key]=validatePrecision(setting);
  }
  return {schemaVersion:1,money:out.money,quantity:out.quantity,columns};
}
function resolvePrecision(settings,type,columnKey) {
  if(!TYPES.includes(type))throw new RangeError('type must be money or quantity');
  const s=normalizeSettings(settings);
  return columnKey && Object.prototype.hasOwnProperty.call(s.columns,columnKey)?s.columns[columnKey]:s[type];
}
function formatConfigured(value,settings,type,columnKey) {
  const {digits}=resolvePrecision(settings,type,columnKey);
  return formatNumber(value,{minDecimals:digits,maxDecimals:digits});
}
module.exports={validatePrecision,normalizeSettings,resolvePrecision,formatConfigured};
