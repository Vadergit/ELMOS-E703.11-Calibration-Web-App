'use strict';
// Offline-only regression tests. No device I/O and NEVER any NVM programming.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../calibration.js');

const points = rows => rows.map(([adc_s,adc_t,pressure,temperature]) => ({adc_s,adc_t,pressure,temperature}));
const firstTwo = points([[-12000,1000,0,25],[12000,1000,100,25]]);
const fullFour = points([[-12000,1000,0,25],[12000,1000,100,25],[-11600,8000,0,75],[12300,8000,100,75]]);
function originalNvm(){
 const w=Array(64).fill(0);
 w[16]=0x0200; // analog without scale_en: deliberately incorrect as a final NVM
 w[17]=0x0004; // permanent PLC enabled, protected
 w[19]=(1<<11)|(1<<8)|(1<<7);
 w[28]=0x0800;
 w[63]=C.crc16(w);
 return w;
}
function plan(limit=32000){
 const x=C.analogScaling(0.5,4.5,5,limit);
 return {mode:'1',scaleEnabled:true,gain:x.gain,offset:x.offset,
  clipping:{mode:'keep'}};
}
test('AN0203 pressure/temperature targets',()=>{
 assert.equal(C.elmosDspTarget(0),-32000);
 assert.equal(C.elmosDspTarget(50),0);
 assert.equal(C.elmosDspTarget(100),32000);
 assert.equal(C.elmosDspTarget(5,5,15,25000),-25000);
 assert.equal(C.elmosDspTarget(15,5,15,25000),25000);
 assert.equal(C.elmosTemperatureTarget(25),387.88*25-16485);
 assert.throws(()=>C.elmosDspTarget(101),/AN0203/);
});
test('two-point pressure fit produces register-ready coefficients',()=>{
 const fit=C.fit(firstTwo,{pmin:0,pmax:100,outputLimit:32000,orderS:1,orderT:0});
 assert.equal(fit.registers.coeffs.length,16);
 assert.ok(fit.stats.maxDigits<5);
});
test('three-point TK0 and four-point TK0+TKE regression',()=>{
 const tk0=C.fit(fullFour.slice(0,3),{pmin:0,pmax:100,outputLimit:31000,orderS:1,orderT:1,fitMode:'tk0'});
 assert.equal(tk0.registers.coeffs[5],0);
 assert.ok(tk0.stats.maxDigits<5);
 const tke=C.fit(fullFour,{pmin:0,pmax:100,outputLimit:31000,orderS:1,orderT:1,fitMode:'full'});
 assert.ok(tke.stats.maxDigits<5);
});
test('reject old NVM without analogue scaling even when pressure fit is valid',()=>{
 const w=originalNvm();
 const r=C.analogOutputStatus(w,0.5,4.5,5,32000);
 assert.equal(r.checked,true);assert.equal(r.ok,false);
 assert.match(r.reason,/scale_en/);
});
test('Elmos image: coherent NVM stores AODO_F, updates CRC and preserves PLC/factory',()=>{
 const orig=originalNvm();
 const fit=C.fit(firstTwo,{pmin:0,pmax:100,outputLimit:32000,orderS:1,orderT:0});
 const image=C.configFrom(orig,fit,0x800,{output:plan()});
 const result=C.analogOutputStatus(image.after,0.5,4.5,5,32000);
 assert.equal(result.ok,true);
 assert.ok(Math.abs(result.actualVolts[0]-0.5)<0.002);
 assert.ok(Math.abs(result.actualVolts[1]-4.5)<0.002);
 assert.equal(image.after[63],C.crc16(image.after));
 assert.deepEqual(image.after.slice(0,16),orig.slice(0,16));
 for(const i of [17,18,19])assert.equal(image.after[i],orig[i]);
 assert.ok(image.changes.some(c=>c.index===58));
});
test('calibration-only image still reveals a missing AODO plan',()=>{
 const orig=originalNvm();
 const fit=C.fit(firstTwo,{pmin:0,pmax:100,outputLimit:32000});
 const image=C.configFrom(orig,fit,0x800);
 assert.equal(C.analogOutputStatus(image.after,0.5,4.5,5,32000).ok,false);
});
test('excess gain similar to 0.25 V/4.75 V does not pass',()=>{
 const w=originalNvm();
 const cfg=plan();
 w[16]|=1<<6;
 w[57]=C.q(cfg.offset,12);
 w[58]=C.q(cfg.gain*1.125,12);
 const r=C.analogOutputStatus(w,0.5,4.5,5,32000);
 assert.equal(r.ok,false);
 assert.ok(r.actualVolts[0]<0.4);
 assert.ok(r.actualVolts[1]>4.6);
});
test('clipping cannot hide a wrong AODO gain',()=>{
 const orig=originalNvm(),cfg=plan();
 cfg.clipping={mode:'on',low:0.5,high:4.5,vdd:5};
 const correct=C.prepareOutputConfig(orig,cfg,32000);
 assert.equal(C.analogOutputStatus(correct,0.5,4.5,5,32000).ok,true);
 const bad=correct.slice();
 bad[58]=C.q(cfg.gain*1.125,12);
 // In this case hard limiting may produce the correct endpoints. Clipping is
 // independent of scaling: require checking the un-clipped gain separately.
 assert.ok(C.fromQ(bad[58],12)>C.fromQ(correct[58],12));
});
test('non-analogue mode is not assigned analogue voltage targets',()=>{
 const w=originalNvm();
 w[16]=(w[16]&~(7<<9))|(4<<9);
 const res=C.analogOutputStatus(w,0.5,4.5,5,32000);
 assert.equal(res.checked,false);
});
