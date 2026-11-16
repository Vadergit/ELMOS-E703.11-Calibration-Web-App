'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const CAL=require('../calibration.js');
const PLAN=require('../guided-plan.js');
const CONFIG=require('../config.js');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

const reference=[
 {pressure:0,temperature:25,adc_s:-9000,adc_t:-4000},
 {pressure:6,temperature:25,adc_s:9000,adc_t:-4000},
 {pressure:0,temperature:75,adc_s:-8800,adc_t:5000},
 {pressure:6,temperature:75,adc_s:9600,adc_t:5000}
];
const opts={pmin:0,pmax:6,orderS:1,orderT:1,outputLimit:25000};

test('TK0 guide uses three physical references without the high-temperature span point',()=>{
 const plan=PLAN.create({pCount:2,tCount:2,temperatures:[25,75],fitMode:'tk0',pmin:0,pmax:6,unit:'bar'});
 assert.equal(plan.total,3);
 assert.deepEqual(plan.points.map(({pressure,temperature})=>[pressure,temperature]),
  [[0,25],[6,25],[0,75]]);
 assert.deepEqual(plan.points.map(({slot,extraSlot})=>[slot,extraSlot]),
  [['lo',null],['hi',null],['extra1',1]]);
 assert.equal(plan.fitMode,'tk0');
});

test('Full TK0 + TKE guide demands four points including 6 bar at 75 C',()=>{
 const plan=PLAN.create({pCount:2,tCount:2,temperatures:[25,75],fitMode:'full',pmin:0,pmax:6,unit:'bar'});
 assert.equal(plan.total,4);
 assert.deepEqual(plan.points.map(({pressure,temperature})=>[pressure,temperature]),
  [[0,25],[6,25],[0,75],[6,75]]);
 assert.equal(plan.points.at(-1).slot,'hi');
});

test('TK0 fits zero-temperature coefficient, leaves interaction S*T zero',()=>{
 const result=CAL.fit(reference.slice(0,3),{...opts,fitMode:'tk0'});
 assert.equal(result.points,3);
 assert.equal(result.fitMode,'tk0');
 assert.equal(result.registers.coeffs[5],0); // S1*temperature term = TKE
 assert.ok(result.stats.maxDigits<10);
 assert.ok(Number.isFinite(result.stats.rmsDigits));
});

test('TKE fits S*T independently with fourth physical reference',()=>{
 const result=CAL.fit(reference,{...opts,fitMode:'full'});
 assert.equal(result.points,4);
 assert.notEqual(result.registers.coeffs[5],0);
 assert.ok(result.stats.maxDigits<10);
});

test('An incomplete four-point TKE calibration cannot calculate coefficients',()=>{
 assert.throws(()=>CAL.fit(reference.slice(0,3),{...opts,fitMode:'full'}),/4 unabhängige Messpunkte/);
 assert.throws(()=>CAL.fit(reference.slice(0,3),{...opts,fitMode:'tk0',orderT:0}),/linearen Druck/);
 assert.throws(()=>PLAN.create({pCount:3,tCount:2,temperatures:[25,75],fitMode:'tk0'}),/2 Drücke/);
});

test('Three-point calibration mode survives portable profile export and import',()=>{
 const fields={label:'TK0 Test',calibration:{
  sOrder:1,tOrder:1,fitMode:'tk0',dspLimit:25000,pointCount:3,samples:12,
  matrix:{p:2,temp:2,temperatures:[25,75],fitMode:'tk0'},
  reference:{min:0,max:6,unit:'bar',customUnit:''}
 }};
 const output=CONFIG.createSelective(fields,['measurement','dsp','reference']);
 assert.equal(output.measurement.pointCount,3);
 assert.equal(output.measurement.matrix.fitMode,'tk0');
 assert.equal(output.dsp.fitMode,'tk0');
 assert.throws(()=>CONFIG.createSelective({...fields,calibration:{...fields.calibration,fitMode:'full'}},['measurement','dsp','reference']),/stimmen nicht überein/);
});

test('TK0 mode reuses existing hardware write gates and is visible in both UIs',()=>{
 const app=read('app.js'),guided=read('guided.js'),html=read('index.html');
 assert.ok(app.includes("CAL.fit(st.calpoints,{pmin,pmax,orderS,orderT,fitMode,outputLimit})"));
 assert.ok(app.includes("const required=fitMode==='tk0'?3:(orderS+1)*(orderT+1)"));
 assert.ok(app.includes("st.calfit.fitMode||'full'"));
 assert.ok(app.includes("if(!calEndpointsReady())throw Error"));
 assert.ok(guided.includes("moveLabel('calFitMode','gwFitFields')"));
 assert.ok(guided.includes("point.extraSlot??point.index"));
 assert.ok(html.includes('id="calFitMode"'));
 assert.ok(html.includes('id="calFitMode"')&&guided.includes('data-gw-preset="tk0"'));
});

test('Real three-point TK0 data identify S4 overflow and propose a safe DSP limit',()=>{
 const measured=[
  {pressure:0,temperature:24,adc_s:-10188,adc_t:2112},
  {pressure:0,temperature:74,adc_s:-10574,adc_t:-6158},
  {pressure:6,temperature:24,adc_s:17667.5,adc_t:2155}
 ];
 const settings={pmin:0,pmax:6,orderS:1,orderT:1,fitMode:'tk0',outputLimit:32000};
 assert.throws(()=>CAL.fit(measured,settings),error=>
  error.code==='COEFFICIENT_OUT_OF_RANGE'&&error.coefficient.name==='S4'&&
  Math.abs(error.coefficient.value-1.0001626507916577)<1e-10);
 const copy=structuredClone(measured);
 const suggestion=CAL.suggestDspLimit(measured,settings);
 assert.equal(suggestion.outputLimit,31000);
 assert.ok(suggestion.maxCoefficient<=0.98);
 assert.deepEqual(measured,copy,'Proposals must not mutate captured measurement points');
 const result=CAL.fit(measured,{...settings,outputLimit:suggestion.outputLimit});
 assert.equal(result.outputLimit,31000);
 assert.equal(result.registers.coeffs[5],0,'TK0 must leave TKE zero');
 assert.ok(result.stats.maxDigits<10);
});

test('Only fixable DSP coefficient overflow offers a reduced target',()=>{
 assert.equal(CAL.suggestDspLimit(reference.slice(0,3),{...opts,fitMode:'tk0'}),null);
 assert.equal(CAL.suggestDspLimit(reference.slice(0,3),{...opts,fitMode:'tk0',outputLimit:1000}),null);
 const app=read('app.js'),html=read('index.html');
 assert.ok(app.includes("CAL.suggestDspLimit(st.calpoints,fitRequest)"));
 assert.ok(app.includes("calcCoefficients();"));
 assert.ok(html.includes('id="calDspProposalApply"'));
});

test('DSP verification accepts equal pressure at sufficiently different temperature, not repeated conditions',()=>{
 const confirmed=[{pressure:0,temperature:25},{pressure:6,temperature:25}];
 const check=(pressure,temperature,reference=confirmed)=>CAL.independentVerificationPoint(reference,{pressure,temperature},6);
 assert.equal(check(0,75),true,'Third TK0 point at 0 bar / 75 C is independent');
 assert.equal(check(0,35),true,'10 C difference satisfies the minimum');
 assert.equal(check(0,34.9),false,'Temperature separation below 10 C is not enough');
 assert.equal(check(0,25),false,'Same pressure and temperature are duplicates');
 assert.equal(check(0.5,25),false,'Pressure separation below 10% of span at same temperature is too small');
 assert.equal(check(3,25),true,'Distant pressure is independent');
 assert.equal(check(6,75,[...confirmed,{pressure:0,temperature:75}]),true,
  'Fourth TKE point is independent of three confirmed references');
 assert.throws(()=>CAL.independentVerificationPoint(confirmed,{pressure:0,temperature:75},0),/Ungültige/);
 const app=read('app.js');
 assert.ok(app.includes('CAL.independentVerificationPoint(st.calValidation.filter('));
 assert.ok(!app.includes('Prüfdruck muss mehr als 10 % der Messspanne von bestätigten Prüfpunkten entfernt sein'));
});
