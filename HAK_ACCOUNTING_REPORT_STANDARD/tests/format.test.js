'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), F=require('../src');
test('format vi-VN',()=>{assert.equal(F.formatNumber(1250000.75),'1.250.000,75');assert.equal(F.formatVND(1250000),'1.250.000');assert.equal(F.formatNumber(null),'');assert.equal(F.formatDateISO('2026-10-16'),'16/10/2026');assert.throws(()=>F.formatDateISO('2026-02-31'));});
test('schema and alignments',()=>{const c=F.validateColumns([{key:'date',type:'date'},{key:'amount',type:'money'},{key:'account',type:'code'}]);assert.deepEqual(c.map(x=>x.align),['center','right','left']);assert.throws(()=>F.validateColumns([{key:'x'},{key:'x'}]));});
