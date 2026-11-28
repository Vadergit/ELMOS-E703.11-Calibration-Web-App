const assert=require('node:assert/strict');
const t=require('../temperature-afe.js');
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
near(t.equivalent(10000,5000),10000/3);
near(t.rpga(7).i2u,1222.2222222222222);
const s=t.signal({resistanceOhm:2/.000348,svdd:2,code:7});
near(s.mux,.4253333333333333);assert.equal(s.adc,-14724);
const i=t.estimate({adc:s.adc,svdd:2,afe0:0x0d72,afe2:0x114a});
near(i.resistanceOhm,2/.000348,1);
assert.throws(()=>t.estimate({adc:0,svdd:2,afe0:0x0d72,afe2:0x1140}));
const r=t.linearRange({bridgeOhm:10000,parallelOhm:5000,bridgeTcr:150,parallelTcr:2000,reference:25,minTemp:-40,maxTemp:125});
near(r.nominalOhm,10000/3);near(r.effectiveTcr,1383.3333333333333);
assert.ok(r.minOhm<r.nominalOhm&&r.maxOhm>r.nominalOhm);
const opp=t.linearRange({bridgeOhm:10000,parallelOhm:10000,bridgeTcr:10000,parallelTcr:-10000,reference:0,minTemp:-20,maxTemp:20});
near(opp.maxOhm,5000);near(opp.minOhm,4800);
assert.throws(()=>t.linearRange({bridgeOhm:1000,bridgeTcr:-100000,reference:0,minTemp:0,maxTemp:20}));
const p=t.plan({...r,svddCode:2});
assert.ok(p.best&&p.best.valid);
assert.ok(p.best.muxMin>=.425&&p.best.muxMax<=1);
assert.equal(t.plan({minOhm:10,maxOhm:100000,svddCode:2}).best,null);
assert.deepEqual(t.merge({afe0:0x0d82,afe2:0x1140,cfgEn:0x13d6,code:7,svddCode:2}),{afe0:0x0d72,afe2:0x114a,cfgEn:0x13da});
console.log('temperature AFE: reference calculations, limits, register masks and edge cases passed');

const dll=require('./fixtures/temperature-afe-dll.json');
assert.equal(dll.i2u.length,16);
for(const x of dll.i2u)near(t.rpga(x.code).i2u,x.i2u);
assert.ok(dll.selections.some(x=>x.tpga1!==2||x.tpga2!==1));
console.log('All 16 RPGA I/U constants match the native DLL output');

const CAL=require('../calibration.js');
for(const sample of dll.calSimulation){
 assert.equal(sample.rc,0);
 for(let i=0;i<sample.t.length;i++)near(t.correctedBridgeTemperature(sample.t[i],sample.tc[i],sample.g01,sample.g2off)*32767/32768,sample.dspT[i],1e-6);
}
const sample=dll.calVerify,fac=dll.calWords;
const pts=sample.adc_t.map((adc_t,i)=>({adc_t,adc_tc:sample.adc_tc[i],adc_s:sample.adc_s[i],pressure:(sample.targetS[i]+32000)/640,temperature:(sample.targetT[i]+16485)/387.88,temperatureSource:'bridge'}));
const solution=t.fitBridgeOffline(pts,{pmin:0,pmax:100,orderS:1,orderT:1,outputLimit:32000},fac,CAL.fit);
assert.equal(solution.offlineOnly,true);
assert.ok(solution.stats.maxDigits<10);
assert.ok(solution.stats.maxTemperatureDigits<200);
assert.throws(()=>t.fitBridgeOffline(pts,{pmin:0,pmax:100,orderS:1,orderT:1}, {...fac,afe2:0x114e}, CAL.fit));
assert.throws(()=>t.fitBridgeOffline([{...pts[0],adc_tc:null}],{},fac,CAL.fit));
console.log('63 native DLL simulation samples match the shunt correction model; offline synthetic bridge fit passed');

const ptc=require('../ptc-profile.js');
assert.equal(ptc.defaults.parallelOhm,7000);
near(ptc.range().nominalOhm,70000/17);
assert.throws(()=>ptc.range({parallelOhm:null}));
near(ptc.range({parallelOhm:5000}).nominalOhm,10000/3);
// Synthetic test values, not a product specification.
const nominal=ptc.range({parallelOhm:10000,bridgeTolerance:0,parallelTolerance:0,ptcTcrTolerance:0});
near(nominal.nominalOhm,5000);
near(nominal.effectiveCold,1060);
near(nominal.effectiveHot,1090);
const wide=ptc.range({parallelOhm:10000,parallelTolerance:40});
assert.ok(wide.minOhm<nominal.minOhm&&wide.maxOhm>nominal.maxOhm);
const anchored=ptc.range({bridgeTolerance:0,ptcTcrTolerance:0},{ohm:5000,temp:25,uncertainty:0});
near(anchored.nominalPtcOhm,10000);
near(anchored.minOhm,nominal.minOhm);
near(anchored.maxOhm,nominal.maxOhm);
const hotR=t.equivalent(10000*(1+180e-6*25),10000*(1+2000e-6*25));
near(ptc.range({bridgeTolerance:0,ptcTcrTolerance:0},{ohm:hotR,temp:50,uncertainty:0}).nominalPtcOhm,10000);
assert.throws(()=>ptc.range({}, {ohm:11000,temp:25,uncertainty:0}));
assert.throws(()=>ptc.range({ptcTcr:-1}));
assert.throws(()=>ptc.range({minTemp:125,maxTemp:-40}));
assert.ok(ptc.plan({parallelOhm:5000}).selection.candidates.length===16);
assert.equal(ptc.checkPoint({adc:-14724,adcTC:0,adcS:1000,svdd:2,afe0:0x0d72,afe2:0x114a}).valid,true);
assert.equal(ptc.checkPoint({adc:-14724,adcTC:32767,adcS:1000,svdd:2,afe0:0x0d72,afe2:0x114a}).valid,false);
console.log('PTC 560 profile, piecewise TCR, uncertainty, measured anchor and ADC checks passed');
