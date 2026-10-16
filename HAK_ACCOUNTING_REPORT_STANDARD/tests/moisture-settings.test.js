'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../src/moisture-settings');
test('moisture and dryness precision independently configurable',()=>{
 const s=M.normalizeMoistureSettings({moisture:{mode:'decimal',digits:6},dryness:{mode:'decimal',digits:3}});
 assert.equal(M.formatPercent(48.123456,s,'moisture'),'48,123456 %');
 assert.equal(M.formatPercent(51.876544,s,'dryness'),'51,877 %');
});
test('integer and per-column precision',()=>{
 const s=M.normalizeMoistureSettings({moisture:{mode:'integer',digits:0},columns:{DRY_LAB:{mode:'decimal',digits:4}}});
 assert.equal(M.formatPercent(40.12,s,'moisture'),'40 %');
 assert.equal(M.formatPercent(59.123456,s,'dryness','DRY_LAB'),'59,1235 %');
});
test('dryness complement and range checks',()=>{
 assert.equal(M.drynessFromMoisture(42.5),57.5);
 assert.throws(()=>M.formatPercent(101,{},'moisture'));
 assert.throws(()=>M.normalizeMoistureSettings({dryness:{mode:'decimal',digits:7}}));
});
