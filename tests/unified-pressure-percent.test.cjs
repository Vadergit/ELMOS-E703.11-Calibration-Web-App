'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const recon=require('../nvm-reconstruction.js');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const C=require('../test-logger-core.js'),R=require('../archive-readable-csv.js');
const slice=(a,b)=>app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a)));
const helpers=slice(' function standardPressureReference(',' function calibrationDisplayProfile(')+slice(' function measurementValue(',' function dspDisplayReading(');
const {standardPressureReference,digitalPercent,measurementValue}=new Function('ELMOS_NVM_RECON',helpers+'\nreturn {standardPressureReference,digitalPercent,measurementValue}')(recon);
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-10,a+' != '+b);
for(const source of ['ram','profile','standard'])test('Canonical pressure percent: '+source,()=>{
 for(const limit of [25000,30000,32000]){
  const words=Array(64).fill(0);words[16]=0x13D6;words[58]=Math.floor(26214/limit*4096);
  const standard=source==='standard'?standardPressureReference(words):null;
  const range=source==='standard'?null:{kind:source,min:0,max:6,unit:'bar',limit};
  const ref={source,limit,range,standard,physicalRange:range?{min:0,max:6,unit:'bar'}:null};
  for(const [raw,p] of [[-limit,0],[-limit/2,25],[0,50],[limit/2,75],[limit,100]]){
   const v=measurementValue(raw,ref);near(v.sensorPercent,p);near(digitalPercent(raw,range,standard).value,p);
   assert.equal(v.sensorUnit,'%');
   if(range)near(v.sensorPressure,p*6/100);else assert.equal(v.sensorPressure,null);
  }
  assert.equal(measurementValue(null,ref).sensorPercent,null);
 }
});
const simulate=new Function('ELMOS_NVM_RECON','ref','raws','changed',helpers+`
 const st={chip:true,port:{},testLogging:false,calTask:false,writing:false,nvmWorking:false,live:false,staged:{}};
 let calls=0,readIndex=0;
 const effectiveMeasurementReference=()=>changed&&calls++>0?{...ref,limit:9999}:ref;
 const stopLive=()=>{},startLive=()=>{},renderStatus=()=>{},sleep=async()=>{},archiveVoltages=()=>({});
 const homeNavigationAbortRequested=false,h=x=>x.toString(16),P={sign16:x=>x};
 const readReg=async addr=>{if(addr===0x30){const v=raws[readIndex++];if(v===null)throw Error('DSP read error');return v}return 123};
 `+slice(' async function archiveMeasure(',' window.ELMOS_ARCHIVE_BRIDGE=')+`return archiveMeasure(raws.length,{sampleSpacingMs:0});`).bind(null,recon);
const ref={source:'standard',limit:30000,range:null,standard:{limit:30000},physicalRange:null,uid:'0020011DBBE7',crc:0x29DA};
test('Real archive bridge: fractional median, raw readings, null on missing DSP',async()=>{
 const actual=await simulate(ref,[-29966,-29965],false);
 near(actual.sensorPercent,34.5/60000*100);near(actual.samples[0].sensorPercent,34/60000*100);
 const missing=await simulate(ref,[null,0],false);
 assert.equal(missing.samples[0].sensorPercent,null);assert.equal(missing.sensorPercent,50);
 await assert.rejects(simulate(ref,[0],true),/Referenz während/);
});
test('Logger aggregation and both readable CSV paths preserve canonical percentage',async()=>{
 const actual=await simulate(ref,[-29966,-29965],false);
 const group={index:1,samples:actual.samples,sensorSnapshot:actual,dspReference:ref,aggregation:'mean',aggregated:C.aggregate(actual.samples,'mean')};
 near(group.aggregated.channels.sensorPercent,actual.sensorPercent);
 const csv=R.csvReport({type:'testlog',events:[]},[group]);
 assert.ok(csv.includes('Sensor [%]')&&csv.includes('"0.0575"')&&csv.includes('"30000"'));
 const verification=R.csvReport({type:'verification',plan:{mode:'pressure',steps:[{pressure:0}]},verificationConfig:{pressureUnit:'bar',pressureSpan:6,calibrationMin:0,calibrationMax:6},events:[{kind:'measurement',data:{stepIndex:0,sample:actual}}]});
 assert.ok(verification.includes('Sensor [%]')&&verification.includes('"0.0575"'));
});
