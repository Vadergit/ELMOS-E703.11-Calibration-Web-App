'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const start=source.indexOf('function standardPressureReference(');
const end=source.indexOf(' function calibrationDisplayProfile',start);
assert.ok(start>=0&&end>start);
const {standardPressureReference,digitalPercent,chooseDisplayReference}=new Function(source.slice(start,end)+'\nreturn {standardPressureReference,digitalPercent,chooseDisplayReference};')();
const image=limit=>{const w=Array(64).fill(0);w[16]=0x12D6;w[58]=Math.round(26214.4/limit*4096);return w};
for(const limit of [25000,30000,32000]){
 test('Round-trip 10–90% VDD with DSP ±'+limit,()=>{
  const p=standardPressureReference(image(limit));
  assert.ok(p);assert.equal(p.limit,limit);
  for(const [raw,pct] of [[-limit,0],[-limit/2,25],[0,50],[limit/2,75],[limit,100]])
   assert.equal(digitalPercent(raw,null,p).value,pct);
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
 let sensorDisplayRange=null,standardDisplayRange=null,displayReferenceDiagnostic=null,reads=0;
 const window={ELMOS_ARCHIVE:{findDisplayCalibration:async()=>options.archive||null}},validDisplayProfile=(p,uid)=>p.uid===uid;
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
 return {ok,standard:standardDisplayRange,profile:sensorDisplayRange,diagnostic:displayReferenceDiagnostic,reads,percent:digitalPercent(-29966,sensorDisplayRange?.range,standardDisplayRange?.reference)};})();
 `);
const oldSensor=()=>Object.assign(Array(64).fill(0),{0:0xBBE7,1:0x11D,16:0x13D6,34:0x4F1E,35:3,39:0x89A1,57:0,58:0xDFB,63:0x29DA});
test('Older confirmed chip automatically shows approximate pressure without local profile',async()=>{
 const r=await simulate(oldSensor(),{});
 assert.ok(r.ok&&r.standard.automatic);
 assert.equal(r.standard.reference.limit,30000);
 assert.ok(Math.abs(r.percent.value-0.056666666666666666)<1e-10);
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

test('Every representable 100-digit standard target survives actual calibration gain quantization',()=>{
 const CAL=require('../calibration.js');
 for(let limit=3300;limit<=32000;limit+=100){
  const gain=CAL.analogScaling(0.5,4.5,5,limit).gain;
  const w=image(limit);w[58]=Math.round(gain*4096);
  const ref=standardPressureReference(w);
  assert.ok(ref,'Missing reference for '+limit);
  assert.equal(ref.limit,limit);
  assert.equal(digitalPercent(-limit,null,ref).value,0);
  assert.equal(digitalPercent(limit,null,ref).value,100);
 }
});
test('Rounded reference stays approximate; existing precise profile is not rounded',()=>{
 const ref=standardPressureReference(image(30000));
 assert.equal(ref.limit,30000);
 assert.notEqual(ref.inferredLimit,ref.limit);
 assert.equal(digitalPercent(30123,{limit:30123,kind:'profile'},ref).value,100);
 assert.equal(standardPressureReference(image(32100)),null);
});

test('Compare profile and AODO endpoints; use AODO for >100 digits discrepancy',async()=>{
 const w=oldSensor(),local={crc:w[63],nvmWords:w,min:0,max:100,unit:'%',selected:'%',limit:25000};
 const r=await simulate(w,{local});
 assert.ok(r.ok&&r.standard&&!r.profile);assert.equal(r.standard.reference.limit,30000);
 assert.equal(r.diagnostic.delta,5000);assert.equal(r.percent.source,'standard');
 assert.equal(chooseDisplayReference({limit:29900},{limit:30000}).useStandard,false);
 assert.equal(chooseDisplayReference({limit:29899},{limit:30000}).useStandard,true);
});
test('Matching archive file is preferred and checked against live AODO',async()=>{
 const w=oldSensor(),archive={uid:'0020011DBBE7',crc:w[63],nvmWords:w,min:0,max:100,unit:'%',selected:'%',limit:30000,sourceFile:'ELMOS_Abgleich_Komplett_test.json'};
 const r=await simulate(w,{archive});
 assert.ok(r.ok&&r.profile);assert.equal(r.diagnostic.profileSource,archive.sourceFile);assert.equal(r.diagnostic.comparison.limit,30000);
 const bad=await simulate(w,{archive:{...archive,limit:25000}});
 assert.ok(bad.ok&&bad.standard&&!bad.profile);assert.equal(bad.diagnostic.delta,5000);
});
test('Stale CRC rejects local profile and uses current AODO',async()=>{
 const w=oldSensor(),local={crc:0x1234,nvmWords:w,min:0,max:100,unit:'%',selected:'%',limit:25000};
 const r=await simulate(w,{local});assert.ok(r.ok&&r.standard&&!r.profile);
 assert.equal(r.diagnostic.profileSource,'Veraltetes Browserprofil');
});
