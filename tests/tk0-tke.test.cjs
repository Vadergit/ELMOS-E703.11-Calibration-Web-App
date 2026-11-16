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
