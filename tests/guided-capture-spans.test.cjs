'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {captureSpans,summarizeSpans}=require('../guided-plan.js');
const row=(pressure,temperature,adc_s,adc_t)=>({record:{pressure,temperature,adc_s,adc_t}});
test('full pressure spans and independent temperature spans',()=>{
 const rows=[row(0,25,-10000,1000),row(5,25,0,1100),row(10,25,10000,1200),row(0,75,-9000,1500),row(10,75,12000,2200)];
 const s=captureSpans(rows);
 assert.deepEqual(s.filter(x=>x.kind==='pressure').map(x=>x.span),[20000,21000]);
 assert.deepEqual(s.filter(x=>x.kind==='temperature').map(x=>x.span),[500,1000]);
 assert.equal(s[0].fromIndex,0);assert.equal(s[0].toIndex,2);
});
test('TK0 missing corner never creates a fictitious span',()=>{
 const s=captureSpans([row(0,25,100,200),row(10,25,-19900,300),row(0,75,200,8200)]);
 assert.equal(s.length,2);assert.equal(s[0].span,20000);assert.equal(s[0].delta,-20000);assert.equal(s[1].span,8000);
});
test('no comparisons across different pressure and temperature or missing values',()=>{
 assert.deepEqual(captureSpans([row(0,25,1,2),row(10,75,3,4),{record:null},row(0,75,null,null)]),[]);
});
test('actual captured references decide comparability',()=>{
 const s=captureSpans([row(0,25,10,100),row(10,25.2,810,120),row(0,75,100,8100)]);
 assert.equal(s[0].span,800);assert.equal(s[1].span,8000);
});
test('minimum, maximum and spread of comparable pressure and temperature spans',()=>{
 const spans=captureSpans([row(0,25,-10000,1000),row(10,25,10000,1200),row(0,75,-9000,1500),row(10,75,12000,2200)]);
 const totals=summarizeSpans(spans);
 assert.deepEqual(totals,[{kind:'pressure',from:0,to:10,count:2,min:20000,max:21000,delta:1000},{kind:'temperature',from:25,to:75,count:2,min:500,max:1000,delta:500}]);
 assert.equal(spans[0].rawMin,-10000);assert.equal(spans[0].rawMax,10000);
});
test('partial ranges do not distort the min-max summary',()=>{
 const spans=captureSpans([row(0,25,0,100),row(10,25,20000,200),row(0,75,0,600),row(5,75,10000,800)]);
 assert.deepEqual(summarizeSpans(spans),[]);
});
test('equal hubs produce a zero difference',()=>{
 const totals=summarizeSpans(captureSpans([row(0,25,0,100),row(10,25,1000,100),row(0,75,0,600),row(10,75,1000,600)]));
 assert.deepEqual(totals.map(x=>x.delta),[0,0]);
});
