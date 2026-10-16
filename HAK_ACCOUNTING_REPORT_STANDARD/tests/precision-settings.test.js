'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../src/precision-settings');
test('defaults and per-column override',()=>{
 const s=P.normalizeSettings({money:{mode:'decimal',digits:6},columns:{'KL_BDMT':{mode:'decimal',digits:4},'SO_TIEN':{mode:'integer',digits:0}}});
 assert.equal(P.formatConfigured(1234.123456,s,'money'),'1.234,123456');
 assert.equal(P.formatConfigured(1234.123456,s,'quantity','KL_BDMT'),'1.234,1235');
 assert.equal(P.formatConfigured(1234.123456,s,'money','SO_TIEN'),'1.234');
});
test('reject more than six decimals',()=>{assert.throws(()=>P.validatePrecision({mode:'decimal',digits:7}));assert.throws(()=>P.validatePrecision({mode:'decimal',digits:-1}));});
test('do not change source values',()=>{const n=1234.123456;P.formatConfigured(n,{},'quantity');assert.equal(n,1234.123456);});
