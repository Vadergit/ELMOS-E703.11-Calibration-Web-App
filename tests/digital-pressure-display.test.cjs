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

const restoreStart=source.indexOf('async function restoreCalibrationDisplayProfile(');
const restoreEnd=source.indexOf(' function carryCalibrationDisplayProfile',restoreStart);
assert.ok(restoreStart>=0&&restoreEnd>restoreStart);
const simulate=new Function('words','options',source.slice(start,end)+`
 const uid='0020011DBBE7',port={},st={port,sessionIndex:1,uid:{hex:uid},chip:true,calpoints:[]};
 let sensorDisplayRange=null,standardDisplayRange=null,reads=0;
 const local=options.local||null;
 const storedDisplayProfile=()=>local,storedStandardReference=()=>null,autoStandardEnabled=()=>options.enabled!==false,demoEnabled=false;
 const ramGrant=async()=>{},ramLock=async()=>{},nvmReadWord=async a=>{reads++;return words[a/2]};
 const readReg=async a=>{
  if(a===options.mismatch)return 0xFFFF;
  if(a===0x46)return options.crcError?0x40:0;
  if(a===0x04)return words[16];if(a===0xA0)return words[57];if(a===0xA2)return words[58];
  if(a>=0x6C&&a<=0x9A)return words[31+(a-0x6C)/2];if(a===0x38)return 0x20;if(a===0x50)return 0xBBE7;if(a===0x52)return 0x11D;
  throw Error('Unknown register '+a);
 };
 const h=(v,n)=>v.toString(16).toUpperCase().padStart(n*2,'0'),logging=()=>{},renderDSPLive=()=>{},refreshUnitLabels=()=>{},expert={refreshOutputPreview(){}},lsSet=()=>{},displayProfileKey=()=>'', $=()=>({value:''});
 `+source.slice(restoreStart,restoreEnd)+`
 return (async()=>{const ok=await restoreCalibrationDisplayProfile(options.full?words:null);
 return {ok,standard:standardDisplayRange,profile:sensorDisplayRange,reads,percent:digitalPercent(-29966,sensorDisplayRange?.range,standardDisplayRange?.reference)};})();
 `);
const oldSensor=()=>Object.assign(Array(64).fill(0),{0:0xBBE7,1:0x11D,16:0x13D6,34:0x4F1E,35:3,39:0x89A1,57:0,58:0xDFB,63:0x29DA});
test('Older confirmed chip automatically shows approximate pressure without local profile',async()=>{
 const r=await simulate(oldSensor(),{});
 assert.ok(r.ok&&r.standard.automatic);
 assert.ok(Math.abs(r.percent.value-0.058612)<0.00001);
 const full=await simulate(oldSensor(),{full:true});
 assert.ok(full.ok);assert.equal(full.reads,0);
});
test('Legacy automatic inference respects opt-out, CRC, live register mismatches and missing fit',async()=>{
 for(const options of [{enabled:false},{crcError:true},{mismatch:0xA2},{mismatch:0x74}])assert.equal((await simulate(oldSensor(),options)).ok,false);
 const no=oldSensor();no[34]=0;assert.equal((await simulate(no,{})).ok,false);
 const off=oldSensor();off[16]&=~64;assert.equal((await simulate(off,{})).ok,false);
});
test('Matching saved profile wins over automatic legacy assumption',async()=>{
 const w=oldSensor(),local={crc:w[63],nvmWords:w,min:0,max:6,unit:'bar',selected:'bar',limit:30000};
 const r=await simulate(w,{local});
 assert.ok(r.ok&&r.profile);assert.equal(r.percent.source,'profile');
});
