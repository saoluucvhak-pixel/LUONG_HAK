'use strict';
const {validatePrecision}=require('./precision-settings');
const CATEGORIES=['money','quantity','moisture','dryness'];
const DEFAULTS={money:{mode:'integer',digits:0},quantity:{mode:'decimal',digits:2},moisture:{mode:'decimal',digits:2},dryness:{mode:'decimal',digits:2}};
function normalize(input={}){const groups={};for(const key of CATEGORIES)groups[key]=validatePrecision(input.groups?.[key]||DEFAULTS[key]);const columns={};for(const [key,entry] of Object.entries(input.columns||{})){if(!key||['__proto__','constructor','prototype'].includes(key)||!CATEGORIES.includes(entry.category))throw Error('Invalid column override');columns[key]={category:entry.category,...validatePrecision(entry)};}return {schemaVersion:2,groups,columns};}
function resolve(settings,category,key){if(!CATEGORIES.includes(category))throw Error('Invalid category');const s=normalize(settings);const col=key&&s.columns[key];if(col&&col.category!==category)throw Error('Column category mismatch');return col||s.groups[category];}
function format(value,settings,category,key){if(value==null||value==='')return '';if(typeof value!=='number'||!Number.isFinite(value))throw TypeError('Finite number required');if((category==='moisture'||category==='dryness')&&(value<0||value>100))throw RangeError('Percent out of range');const {digits}=resolve(settings,category,key);const n=new Intl.NumberFormat('vi-VN',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);return n+(category==='moisture'||category==='dryness'?' %':'');}
module.exports={CATEGORIES,normalize,resolve,format};
