'use strict';const test=require('node:test'),assert=require('node:assert/strict');const {formatExact}=require('../src/exact-format');
test('unbounded integer part with six decimals',()=>assert.equal(formatExact('123456789123456789123456789.123456',{digits:6}),'123.456.789.123.456.789.123.456.789,123456'));
test('BigInt and rounding',()=>{assert.equal(formatExact(123456789123456789123456789n,{mode:'integer',digits:0}),'123.456.789.123.456.789.123.456.789');assert.equal(formatExact('999.9999999',{digits:6}),'1.000,000000');});
test('reject exponent and precision over six',()=>{assert.throws(()=>formatExact('1e30'));assert.throws(()=>formatExact('10.2',{digits:7}));});
