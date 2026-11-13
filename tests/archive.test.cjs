'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../archive-core.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('any free pressure and temperature ramps including repeated return points and cycles',()=>{
 const plan=C.makePlan({mode:'combined',pressure:'0, 3, 7, 10, 7, 3, 0',temperature:'10, 40, 90, 40, 10',cycles:2});
 assert.equal(plan.steps.length,70);
 assert.equal(plan.steps[0].pressureDirection,'up');
 assert.equal(plan.steps[4].pressureDirection,'down');
 assert.equal(plan.steps[0].temperatureDirection,'up');
 assert.equal(plan.steps[28].temperatureDirection,'down');
 assert.equal(plan.steps.at(-1).cycle,2);
 assert.deepEqual(plan.pressure,[0,3,7,10,7,3,0]);
});
test('one two and six temperature points are accepted',()=>{
 for(const values of ['10','10, 40','10, 20, 40, 60, 80, 90']){
  const plan=C.makePlan({mode:'temperature',temperature:values,fixedPressure:5,cycles:1});
  assert.equal(plan.steps.length,C.points(values,'T').length);
 }
});
test('invalid plan or excessive amplification of steps is rejected',()=>{
 assert.throws(()=>C.makePlan({mode:'combined',pressure:'0, X',temperature:'10',cycles:1}),/Zahlen/);
 assert.throws(()=>C.makePlan({mode:'pressure',pressure:'0 10',fixedTemperature:25,cycles:0}),/Zyklen/);
 assert.throws(()=>C.makePlan({mode:'pressure',pressure:'0 10',fixedTemperature:25,cycles:31}),/Zyklen/);
});
test('hysteresis never pairs measurements from distinct cycles',()=>{
 const plan=C.makePlan({mode:'pressure',pressure:'0, 5, 10, 5, 0',fixedTemperature:25,cycles:2});
 const r={plan,events:[
  {kind:'measurement',stepIndex:1,pass:true,sample:{dspS:1000}},
  {kind:'measurement',stepIndex:8,pass:true,sample:{dspS:1300}}
 ]};
 assert.equal(C.hysteresis(r).pairs.length,0);
 r.events.push({kind:'measurement',stepIndex:3,pass:true,sample:{dspS:990}});
 assert.equal(C.hysteresis(r).pairs.length,1);
 assert.equal(C.hysteresis(r).pairs[0].cycle,1);
});

test('archive schema rejects foreign JSON without throwing',()=>{
 const valid={format:C.FORMAT,schemaVersion:C.VERSION,id:'a-long-record-id',type:'calibration',startedAt:'2026-11-13T12:00:00Z',events:[]};
 assert.ok(C.valid(valid));
 assert.equal(C.valid({hello:'world'}),false);
 assert.equal(C.valid({...valid,schemaVersion:99}),false);
 assert.equal(C.valid({...valid,events:null}),false);
 assert.match(C.filename({...valid,chipUID:'0011FF'}),/^ELMOS_20261113_120000_0011FF_/);
});
test('previous failed verification is never erased by a successful retry',()=>{
 const plan=C.makePlan({mode:'pressure',pressure:'0 5 10 5 0',fixedTemperature:25,cycles:1});
 const r={plan,status:'completed',events:[
  {kind:'measurement',stepIndex:1,pass:false,sample:{dspS:1000}},
  {kind:'measurement',stepIndex:1,pass:true,sample:{dspS:1050}},
  {kind:'measurement',stepIndex:3,pass:true,sample:{dspS:1030}}
 ]};
 assert.equal(C.lastAttempt(r,1).sample.dspS,1050);
 assert.equal(C.outcomes(r).failed,1);
 assert.equal(C.outcomes(r).repeated,1);
 const h=C.hysteresis(r);
 assert.equal(h.pairs.length,1);
 assert.equal(h.pairs[0].axis,'pressure');
 assert.equal(h.pairs[0].delta,-20);
 assert.equal(h.pairs[0].unit,'DSP_S Digits');
});
test('confirmed physical-unit temperature hysteresis remains distinct from raw data',()=>{
 const plan=C.makePlan({mode:'temperature',temperature:'10, 40, 90, 40, 10',fixedPressure:3,cycles:1});
 const r={plan,events:[
  {kind:'measurement',stepIndex:1,pass:true,sample:{dspT:20000,sensorTempC:40.2,temperatureConfidence:'confirmed'}},
  {kind:'measurement',stepIndex:3,pass:true,sample:{dspT:20100,sensorTempC:40.8,temperatureConfidence:'confirmed'}}
 ]};
 const h=C.hysteresis(r);
 assert.equal(h.pairs.length,1);
 assert.equal(h.pairs[0].unit,'°C');
 assert.ok(Math.abs(h.pairs[0].delta-0.6)<1e-9);
});
test('NVM and initial state provenance and safety are not silently changed',()=>{
 const app=read('app.js'),archive=read('archive.js'),html=read('index.html');
 assert.match(app,/nvm_before/);
 assert.match(app,/nvm_after/);
 assert.match(app,/ramGrant/);
 assert.match(app,/CAL\.protectStartupCommunication\(initial,modified/);
 assert.match(app,/initial:archiveCaptureConfig/);
 assert.match(app,/readOptional\(0x2E\)/);
 assert.match(app,/externalVdd:\{measuredV/);
 assert.match(app,/measuredSource/);
 assert.match(app,/source:'CFG_AFE0 Bits 1:0/);
 assert.match(app,/rawSamples:values/);
 assert.match(archive,/showDirectoryPicker/);
 assert.match(archive,/requestPermission/);
 assert.match(archive,/createWritable/);
 assert.match(archive,/sensorTempC/);
 assert.match(archive,/pressureScaleConfirmed/i);
 assert.match(html,/archive-core\.js\?v=0\.7\.3/);
 assert.match(html,/archive\.js\?v=0\.7\.7/);
});
