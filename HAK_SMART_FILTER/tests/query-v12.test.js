'use strict';const test=require('node:test'),assert=require('node:assert/strict');const {queryRows}=require('../src/query-v12');
const rows=[{id:1,name:'Nguyễn Văn A',amount:100,allow:true},{id:2,name:'Trần B',amount:200,allow:false},{id:3,name:'Nguyen C',amount:300,allow:true}];
test('AND OR accent insensitive and permission',()=>{const q={logic:'AND',conditions:[{field:'name',op:'contains',value:'nguyen'},{logic:'OR',conditions:[{field:'amount',op:'gte',value:300},{field:'amount',op:'eq',value:100}]}]};const r=queryRows(rows,q,{fields:['name','amount'],canRead:r=>r.allow});assert.deepEqual(r.rows.map(x=>x.id),[1,3]);assert.equal(r.totalAuthorized,2);});
test('fail closed unsupported',()=>assert.throws(()=>queryRows(rows,{field:'secret',op:'eq',value:1},{fields:['name']})));
test('pagination',()=>{const r=queryRows(rows,{field:'amount',op:'gte',value:0},{fields:['amount'],page:2,pageSize:1});assert.deepEqual(r.rows.map(x=>x.id),[2]);assert.equal(r.totalMatched,3);});
