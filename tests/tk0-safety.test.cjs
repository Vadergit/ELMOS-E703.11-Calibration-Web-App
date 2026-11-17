'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {test}=require('node:test');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../calibration.js'),'utf8');
const context=vm.createContext({});
vm.runInContext(source+'\n;globalThis.calibrationForTest=ELMOS_CAL;',context);
const CAL=context.calibrationForTest;
const points=[
 {pressure:0,temperature:25,adc_s:-1579,adc_t:3126.5},
 {pressure:100,temperature:25,adc_s:-14261.5,adc_t:3121},
 {pressure:0,temperature:75,adc_s:-1764.5,adc_t:-7575.5}
];
const base={pmin:0,pmax:100,orderS:1,fitMode:'tk0',outputLimit:32000};
test('TK0 cannot silently become a pressure-only fit',()=>{
 assert.throws(()=>CAL.fit(points,{...base,orderT:0}),/Temperaturordnung 1/);
});
test('TK0 uses all three reference points and calculates temperature coefficients',()=>{
 const fit=CAL.fit(points,{...base,orderT:1});
 assert.equal(fit.points,3);
 assert.equal(fit.recordedPoints,3);
 assert.equal(fit.ignoredTemperaturePoints,0);
 assert.equal(fit.pressureOnly,false);
 assert.ok(Array.isArray(fit.registers.tcoeffs));
 assert.equal(fit.registers.coeffs[1],551);
});
test('unsafe earlier TK0 fit cannot generate an NVM image',()=>{
 const good=CAL.fit(points,{...base,orderT:1});
 assert.throws(()=>CAL.configFrom([], {...good,orderT:0,pressureOnly:true},0),/NVM gesperrt/);
});
test('ordinary two-point pressure calibration remains permitted',()=>{
 const fit=CAL.fit(points.slice(0,2),{...base,fitMode:'full',orderT:0});
 assert.equal(fit.points,2);
 assert.equal(fit.pressureOnly,true);
});
