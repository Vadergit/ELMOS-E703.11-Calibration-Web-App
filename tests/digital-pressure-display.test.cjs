'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const start=source.indexOf('function standardPressureReference(');
const end=source.indexOf(' function calibrationDisplayProfile',start);
assert.ok(start>=0&&end>start);
const {standardPressureReference,digitalPercent}=new Function(source.slice(start,end)+'\nreturn {standardPressureReference,digitalPercent};')();
const image=limit=>{const w=Array(64).fill(0);w[16]=0x12D6;w[58]=Math.round(26214.4/limit*4096);return w};
for(const limit of [25000,30000,32000]){
 test('Round-trip 10–90% VDD with DSP ±'+limit,()=>{
  const p=standardPressureReference(image(limit));
  assert.ok(p&&Math.abs(p.limit-limit)<6);
  for(const [raw,pct] of [[-limit,0],[-limit/2,25],[0,50],[limit/2,75],[limit,100]])
   assert.ok(Math.abs(digitalPercent(raw,null,p).value-pct)<0.01);
 });
 test('Reject unsupported AODO configuration '+limit,()=>{
  const w=image(limit);w[16]&=~64;assert.equal(standardPressureReference(w),null);
  w[16]|=64|16384;assert.equal(standardPressureReference(w),null);
  w[16]&=~16384;w[57]=1;assert.equal(standardPressureReference(w),null);
 });
}
test('Unknown reference does not produce percent; known profile takes precedence; do not clip',()=>{
 assert.equal(digitalPercent(0,null,null),null);
 assert.equal(digitalPercent(0,{limit:25000,kind:'profile'},standardPressureReference(image(32000))).source,'profile');
 assert.ok(digitalPercent(32000,{limit:25000,kind:'profile'},null).value>100);
 assert.equal(digitalPercent(NaN,{limit:25000,kind:'profile'},null),null);
});
