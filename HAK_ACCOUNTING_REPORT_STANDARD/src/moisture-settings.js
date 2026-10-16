'use strict';
const {formatNumber}=require('./index');
const {validatePrecision}=require('./precision-settings');
const DEFAULTS=Object.freeze({moisture:{mode:'decimal',digits:2},dryness:{mode:'decimal',digits:2}});
function normalizeMoistureSettings(input={}) {
 const out={schemaVersion:1,moisture:validatePrecision(input.moisture||DEFAULTS.moisture),dryness:validatePrecision(input.dryness||DEFAULTS.dryness),columns:{}};
 for(const [key,setting] of Object.entries(input.columns||{})){
  if(!key||['__proto__','constructor','prototype'].includes(key))throw new TypeError('Invalid column key');
  out.columns[key]=validatePrecision(setting);
 }
 return out;
}
function formatPercent(value,settings={},type='moisture',columnKey){
 if(!['moisture','dryness'].includes(type))throw new RangeError('Unknown percent type');
 if(value===null||value===undefined||value==='')return '';
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>100)throw new RangeError('Percentage must be in 0..100');
 const s=normalizeMoistureSettings(settings);
 const p=columnKey&&Object.prototype.hasOwnProperty.call(s.columns,columnKey)?s.columns[columnKey]:s[type];
 return formatNumber(value,{minDecimals:p.digits,maxDecimals:p.digits})+' %';
}
function drynessFromMoisture(moisture){
 if(typeof moisture!=='number'||!Number.isFinite(moisture)||moisture<0||moisture>100)throw new RangeError('Moisture must be in 0..100');
 return 100-moisture;
}
module.exports={normalizeMoistureSettings,formatPercent,drynessFromMoisture};
