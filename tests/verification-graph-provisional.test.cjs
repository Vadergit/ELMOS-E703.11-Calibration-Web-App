'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const graph=require('../verification-graph.js');

const plan={mode:'pressure',steps:[
 {index:0,pressure:0,temperature:null},
 {index:1,pressure:5,temperature:null},
 {index:2,pressure:10,temperature:null}
]};
const configuration={pressureSpan:10,calibrationMin:0,calibrationMax:10,
 pressureUnit:'bar',pressureTolerancePercent:0.2};
const verification=data=>({plan,verificationConfig:configuration,
 events:data==null?[]:[{kind:'measurement',data:{stepIndex:0,referencePressure:0,
  pressureUnit:'bar',pressureFullScaleSpan:10,pressureError:null,pass:null,
  sample:data}}]});

test('unverified digital sensor reading is plotted but not assessed',()=>{
 // Matches a real capture: 0 bar reference and -0.01719 % of a 0-10 bar range.
 const record=verification({sensorValue:-0.01719,sensorUnit:'%',
  sensorPressure:-0.001719,pressureUnit:'bar',pressureConfidence:'unverified'});
 const result=graph.summary(record);
 assert.equal(result.measured,1);
 assert.equal(result.passed,0);
 assert.equal(result.unknown,1);
 assert.equal(result.data[0].status,'unknown');
 assert.equal(result.data[0].valueSource,'unverified-percent');
 assert.ok(Math.abs(result.data[0].plotValue+0.01719)<1e-9);
 assert.equal(result.data[1].plotValue,null);
 assert.equal(result.data[2].status,'pending');
});

test('unverified physical-unit sensor reading is also displayed provisionally',()=>{
 const result=graph.summary(verification({sensorPressure:0.01,
  sensorUnit:'bar',pressureUnit:'bar',pressureConfidence:'unverified'}));
 assert.ok(Math.abs(result.data[0].previewPercent-0.1)<1e-9);
 assert.equal(result.data[0].status,'unknown');
});

test('incompatible measurement unit does not invent a pressure deviation',()=>{
 const result=graph.summary(verification({sensorPressure:3,sensorUnit:'psi',
  pressureUnit:'psi',pressureConfidence:'unverified'}));
 assert.equal(result.data[0].plotValue,null);
 assert.equal(result.data[0].status,'unknown');
});

test('confirmed deviation stays verified, without a provisional label',()=>{
 const record=verification({sensorValue:-0.01719,sensorUnit:'%',
  sensorPressure:-0.001719,pressureUnit:'bar',pressureConfidence:'confirmed'});
 record.events[0].data.pressureError=-0.001719;
 record.events[0].data.pass=true;
 const result=graph.summary(record);
 assert.equal(result.data[0].valueSource,'verified');
 assert.equal(result.data[0].previewPercent,null);
 assert.ok(Math.abs(result.data[0].plotValue+0.01719)<1e-9);
 assert.equal(result.passed,1);
});

test('legacy percent-only archive values retain provisional display',()=>{
 const result=graph.summary(verification({sensorPressure:-0.01719,
  pressureUnit:'%'}));
 assert.ok(Math.abs(result.data[0].plotValue+0.01719)<1e-9);
 assert.equal(result.data[0].status,'unknown');
});
