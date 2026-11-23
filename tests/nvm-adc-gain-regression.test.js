'use strict';
// Run with: node --test tests/nvm-adc-gain-regression.test.js
// Synthetic data ONLY: no production sensor UID or private calibration data.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const contents=fs.readFileSync(path.join(__dirname,'../nvm-reconstruction.js'),'utf8');
const calc=vm.runInNewContext(contents+'\nELMOS_NVM_RECON',{}).calculate;
const close=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol,a+' differs from '+b+' by more than '+tol);
const words=()=>{
 const w=Array(64).fill(0);
 w[16]=0x1240; // analog output + scaling (the pressure fit itself is independent)
 w[24]=0x59A3;w[25]=0x319A;w[26]=0x01F4; // AADC=0.953854 Bessel 8kS/s
 w[27]=0x0C80; // SVDD 2.4 V
 w[28]=0x4C0E; // PGA1 8.5, PGA2 10, offset +3*50 mV/V, PGA2 inverted
 w[32]=4096; // temperature normalization; irrelevant to constant-T pressure fit
 w[33]=Math.round(1.977*4096);
 w[34]=Math.round(4.917*4096);
 w[39]=16384; // linear S4=0.5; no pressure/temperature interaction
 return w;
};
const opts={pmin:0,pmax:6,ta:25,tb:75,vdd:5,limit:30000,pressureUnit:'bar'};
test('ADC profile selected using all three NVM filter words',()=>{
 const result=calc(words(),opts);assert.equal(result.ok,true);
 assert.equal(result.settings.adcGain,0.953854);
 assert.equal(result.settings.adcGainSource,'datasheet');
});
test('Physical inverse reproduces Jürg-like bridge zero and span after polarity inversion',()=>{
 const r=calc(words(),opts);
 close(r.rows[0].endpoints[0].adcDigits,-25386,20);
 close(r.rows[0].endpoints[1].adcDigits,-983,20);
 close(r.rows[0].zero,-13.6,0.1);
 close(r.rows[0].span,-3.81,0.03);
});
test('Regression proves old 700mV-as-fullscale assumption was wrong',()=>{
 const old=calc(words(),{...opts,adcGain:1/0.7});
 close(old.rows[0].zero,-14.9887,0.03);
 close(old.rows[0].span,-2.5554,0.01);
 const fixed=calc(words(),opts);
 assert.ok(Math.abs(fixed.rows[0].span+3.81)<Math.abs(old.rows[0].span+3.81));
 assert.ok(Math.abs(fixed.rows[0].zero+13.6)<Math.abs(old.rows[0].zero+13.6));
});
test('Unlisted ADC configuration withholds nominal bridge mV/V but retains ADC digits',()=>{
 const w=words();w[24]=0xDEAD;
 const r=calc(w,opts);assert.equal(r.ok,true);assert.equal(r.settings.adcGain,null);
 assert.equal(r.hasPhysical,false);assert.equal(r.rows[0].zero,null);
 assert.ok(Number.isFinite(r.adcSpan));
 assert.ok(r.warnings.some(x=>x.includes('45 Elmos-Profilen')));
});
test('Explicit manual override only applies to this reconstruction input',()=>{
 const w=words();w[24]=0xDEAD;
 const r=calc(w,{...opts,adcGain:0.953854});
 assert.equal(r.settings.adcGainSource,'manual');
 close(r.rows[0].span,-3.81,0.03);
 assert.equal(calc(w,opts).rows[0].zero,null);
});
test('Reject invalid manual gain',()=>{
 for(const val of [0,-1,3,Number.NaN])assert.equal(calc(words(),{...opts,adcGain:val}).ok,false);
});
test('All 45 data-sheet triplets decode without duplicates',()=>{
 const m=contents.match(/const ADC_FILTER_PRESETS=(\[[^;]+\]);/);
 assert.ok(m,'ADC table in repository');
 const presets=JSON.parse(m[1]);assert.equal(presets.length,45);
 const used=new Set();
 for(const [adc,lp0,lp1,gain] of presets){
  const key=[adc,lp0,lp1].join(':');assert.ok(!used.has(key));used.add(key);
  const w=words();w[24]=adc;w[25]=lp0;w[26]=lp1;
  const r=calc(w,opts);
  assert.equal(r.settings.adcGain,gain);
  assert.ok(Number.isFinite(r.rows[0].zero));
 }
});
