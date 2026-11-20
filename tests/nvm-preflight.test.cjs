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
