'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('../calibration.js');
const w=()=>{const a=Array(64).fill(0);a[16]=0x1216;a[17]=4;a[18]=2<<12;a[19]=(1<<11)|(1<<8)|(1<<7);a[21]=1;a[22]=0x0880;a[24]=0x48d3;a[25]=0x2a9e;a[26]=0x0412;a[28]=0x0800;a[63]=C.crc16(a);return a};
const ram=a=>Object.fromEntries(C.PROFILE_REGS.map(([addr,i])=>[addr,a[i]]));
const fit=orderT=>({orderT,outputLimit:30000,registers:{so:1,sf:2,coeffs:Array(16).fill(0),to:0,tf:4096,tcoeffs:orderT?Array(4).fill(0):null}});
const cat=[[0x48d3,0x2a9e,0x0412],[0x5a94,0x0c5f,0x04be]];
for(const state of ['new','pressure','temperature'])for(const orderT of [0,1,2])for(const recovery of [false,true])test(state+' / T'+orderT+' / recovery '+recovery,()=>{
 const a=w();if(state==='new')a[16]&=~15;
 if(state==='temperature'){a[16]|=4;a[36]=42}
 const active=ram(a),plan=C.planCalibrationProfile(a,active,{orderT,recovery,allowOperatingChanges:true,filterCatalog:cat});
 const result=C.configFrom(a,fit(orderT),a[28],{activatePressureCorrection:(a[16]&3)===0,operatingProfile:plan});
 assert.equal(result.after[16]&3,2);assert.equal(result.after[16]&12,orderT>0?4:a[16]&12);
 assert.equal(plan.replaceTemperature,state==='temperature'&&orderT===0);
 assert.deepEqual(result.after.slice(0,16),a.slice(0,16));
 assert.deepEqual(result.after.slice(17,24),a.slice(17,24));
 assert.equal(result.after[63],C.crc16(result.after));
 if(recovery)C.validateRecoveryCalibrationDiff(a,result.after,{allowPressureCorrection:true,operatingProfile:plan});
});
test('changed filter and continuous period require explicit permission',()=>{
 const a=w();a[21]=0;const active=ram(a);active[14]=1;active[20]=cat[1][0];active[22]=cat[1][1];active[24]=cat[1][2];
 assert.throws(()=>C.planCalibrationProfile(a,active,{filterCatalog:cat}),/Programmer/);
 const p=C.planCalibrationProfile(a,active,{allowOperatingChanges:true,filterCatalog:cat});
 const b=C.configFrom(a,fit(0),a[28],{operatingProfile:p}).after;
 assert.deepEqual([b[21],b[24],b[25],b[26]],[1,...cat[1]]);
 assert.throws(()=>C.protectStartupCommunication(a,b));
 assert.doesNotThrow(()=>C.protectStartupCommunication(a,b,{operatingProfile:p}));
 const bad=b.slice();bad[17]^=4;assert.throws(()=>C.protectStartupCommunication(a,bad,{operatingProfile:p}));
 active[20]^=1;assert.throws(()=>C.planCalibrationProfile(a,active,{allowOperatingChanges:true,filterCatalog:cat}),/dokumentiertes Profil/);
});
test('existing single measurement mode preserved on supported I2C programmer',()=>{
 const a=w();a[21]=2;
 assert.throws(()=>C.planCalibrationProfile(a,ram(a)),/Einzelmessungsprofil/);
 const p=C.planCalibrationProfile(a,ram(a),{allowSingleMeasurement:true});
 assert.equal(p.values[0],2);assert.equal(p.changed.length,0);
});
test('temporary temperature mode restored rather than silently persisted after pressure-only fit',()=>{
 const a=w();a[16]&=~12;const active=ram(a);active[4]|=4;
 const p=C.planCalibrationProfile(a,active,{allowOperatingChanges:true});
 assert.equal(p.temperatureRamChange,true);assert.equal(p.temperatureTarget,0);assert.equal(p.temperatureEnable,false);
 assert.equal(C.configFrom(a,fit(0),a[28],{operatingProfile:p}).after[16]&12,0);
});
test('checkpoint rejects different chip, any NVM word, AFE, filter or references',()=>{
 const words=w(),r=ram(words),uid='002000123456',gains={pga1:1},reference={pmin:'0',pmax:'6'};
 const draft={version:1,uid,words,ram:r,gains,reference,points:[{kind:'lo',adc_s:-10000,adc_t:3000,pressure:0,temperature:25}]};
 const current={uid,words,ram:r,gains,reference};assert.equal(C.checkpointMatches(draft,current),true);
 for(const changed of [{uid:'other'},{words:words.map((v,k)=>k===35?v^1:v)},{ram:{...r,20:r[20]^1}},{gains:{pga1:2}},{reference:{...reference,pmax:'4'}}])assert.equal(C.checkpointMatches(draft,{...current,...changed}),false);
});
test('unsafe starting states fail before calibration',()=>{
 const a=w();for(const [addr,value] of [[14,0],[4,0x1215],[30,3],[26,4]])assert.throws(()=>C.planCalibrationProfile(a,{...ram(a),[addr]:value},{allowOperatingChanges:true,filterCatalog:cat}));
});

const preflightApp=require('node:fs').readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
function simulatePreflight({cookie=false,cold=false}={}){
 const words=w();
 if(cookie){words[17]=0;words[19]&=~(1<<7);words[63]=C.crc16(words);}
 const active=ram(words),fields={pmin:'0',pmax:'6',calUnit:'bar',calUnitOther:'',calPointCount:'3',calTempSource:'internal',calTOrder:'0',calSOrder:'1',calFitMode:'pressure',calLoTemp:'25',calHiTemp:'25',calExtra1Pressure:'0',calExtra1Temp:'75',expertOutputMode:'1'};
 const st={iface:'plc',adapterKind:'ssp3',port:{},chip:true,uid:{hex:'002000123456'},sessionIndex:1,nvmBackup:words,regs:{6:words[17]},calpoints:[]};
 const $=id=>({value:fields[id]??'',checked:true});
 const section=(a,b)=>preflightApp.slice(preflightApp.indexOf(a),preflightApp.indexOf(b,preflightApp.indexOf(a)));
 const code=section('function capturedReferenceMatches(','function calEndpointsReady(')+
  section('function retainedCalibrationReferencesMatch(','const checkpointKey=')+
  section('function activePreflight(','function confirmedOperatingProfile(')+
  section('async function calibrationPreflight(','async function restoreCalibrationCheckpoint(')+'\nreturn calibrationPreflight;';
 const run=new Function('st','CAL','$','demoEnabled','nvmTransportSupported','hasCurrentNvmBackup','psscRecoveryProven','refreshPsscRecoveryProofReadOnly','bridgeColdStartVerified','stopLive','startLive','readCalibrationUid','readCalibrationProfile','filterProfiles','storedCalibrationCheckpoint','show','renderStatus','pressureUnit','window','h',code)(
  st,C,$,false,()=>true,()=>true,()=>cold,async()=>{},()=>false,()=>{},()=>{},async()=>st.uid.hex,async()=>({...active}),cat.map(p=>['test',p]),()=>null,()=>{},()=>{},()=>fields.calUnit,{confirm:()=>true},v=>v.toString(16));
 return {run,st,active,fields};
}
test('preflight keeps valid points when only an uncaptured or removed reference is corrected',async()=>{
 const {run,st,fields,active}=simulatePreflight();
 await run();
 st.calpoints=[{kind:'lo',pressure:0,temperature:25,unit:'bar'},{kind:'hi',pressure:6,temperature:25,unit:'bar'}];
 fields.calExtra1Temp='80';
 await run();
 assert.equal(st.calpoints.length,2);
 assert.equal(st.calibrationPreflight.reference.calExtra1Temp,'80');
 fields.calHiTemp='26';
 await assert.rejects(run(),/Messprofil oder Abgleichplan/);
 st.calpoints.pop();
 await run();
 assert.equal(st.calpoints.length,1);
 fields.calTOrder='1';
 await assert.rejects(run(),/Messprofil oder Abgleichplan/);
 fields.calTOrder='0';fields.pmax='7';
 await assert.rejects(run(),/Messprofil oder Abgleichplan/);
 fields.pmax='6';active[20]=cat[1][0];active[22]=cat[1][1];active[24]=cat[1][2];
 await assert.rejects(run(),/Messprofil oder Abgleichplan/);
});
test('preflight catches missing cookie cold-start proof before the first measurement',async()=>{
 const blocked=simulatePreflight({cookie:true});
 await assert.rejects(blocked.run(),/Kaltstart.*fehlt/);
 assert.equal(blocked.st.calibrationPreflight,undefined);
 const ready=simulatePreflight({cookie:true,cold:true});
 assert.ok(await ready.run());
});

function firstCalibrationImage(){
 const a=w();a[16]=0x1214;a[17]=0x6C06;a[18]=0x4000;a[19]=0x099F;a[21]=0;
 a[24]=0x48A0;a[25]=0x2E56;a[26]=0x04B4;a[27]=0x0C80;a[28]=0;a[29]=0x1154;a[30]=1;
 a[32]=0x1000;a[51]=0x0F4D;a[52]=0xBC8E;a[53]=0xFC54;
 a[15]=C.crc8(a)<<8;a[63]=C.crc16(a);return a;
}
test('first calibration from diagnostic log profile: AFE and period survive final NVM construction',()=>{
 const a=firstCalibrationImage(),active=ram(a);active[28]=0x0C02;active[14]=1;
 const p=C.planCalibrationProfile(a,active,{recovery:true,allowOperatingChanges:true});
 assert.equal(p.afeMandatoryRepair,true);
 for(const orderT of [0,1,2]){
  const plan=C.planCalibrationProfile(a,active,{orderT,recovery:true,allowOperatingChanges:true});
  const result=C.configFrom(a,fit(orderT),active[28],{activatePressureCorrection:true,operatingProfile:plan});
  assert.equal(result.after[28],0x0C02);assert.equal(result.after[21],1);assert.equal(result.after[16]&3,2);
  assert.equal(result.after[63],C.crc16(result.after));
  assert.deepEqual(result.after.slice(0,16),a.slice(0,16));
  assert.deepEqual(result.after.slice(17,20),a.slice(17,20));
  assert.doesNotThrow(()=>C.validateRecoveryCalibrationDiff(a,result.after,{allowPressureCorrection:true,operatingProfile:plan}));
  assert.throws(()=>C.protectStartupCommunication(a,result.after,{allowPressureCorrection:true}));
 }
 assert.throws(()=>C.planCalibrationProfile(a,active,{allowOperatingChanges:true}),/Messprofil/);
 assert.throws(()=>C.configFrom(a,fit(0),0x0402,{operatingProfile:p}),/Erstinitialisierung/);
});
test('AFE mandatory repair cannot authorize a previously calibrated or corrupt profile',()=>{
 for(const [i,mask] of [[16,2],[21,1],[35,1],[52,1],[58,1],[28,0x1000]]){
  const a=firstCalibrationImage();a[i]^=mask;a[63]=C.crc16(a);
  assert.equal(C.uncalibratedAfeBlank(a),false);
  const target=a.slice();target[28]|=0x0800;target[63]=C.crc16(target);
  assert.throws(()=>C.protectStartupCommunication(a,target,{operatingProfile:{afeMandatoryRepair:true}}),/Pflichtbit/);
 }
 const bad=firstCalibrationImage();bad[63]^=1;assert.equal(C.uncalibratedAfeBlank(bad),false);
 const good=firstCalibrationImage();good[28]=0x0C02;good[63]=C.crc16(good);
 const target=good.slice();target[28]&=~0x0800;
 assert.throws(()=>C.protectStartupCommunication(good,target,{operatingProfile:{afeMandatoryRepair:true}}),/Pflichtbit/);
});

test('first calibration cannot build an incomplete NVM image without confirmed AFE profile',()=>{
 const a=firstCalibrationImage();
 assert.throws(()=>C.configFrom(a,fit(0),0x0800),/AFE-Erstinitialisierung/);
});
