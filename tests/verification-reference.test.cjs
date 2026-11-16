'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const CORE=require('../archive-core.js');

function modules(){
 const context=vm.createContext({document:{documentElement:{lang:'de-CH'}},window:{}});
 for(const name of ['verification-graph.js','verification-report.js']){
  const code=fs.readFileSync(path.join(__dirname,'..',name),'utf8');
  vm.runInContext(code,context,{filename:name});
 }
 return context.window;
}
function example({entered=8,evaluated=entered,planned=10,mode='pressure',temperature=null}={}){
 return {
  type:'verification',id:'reference-regression-test',chipUID:'UNITTEST',status:'completed',
  startedAt:'2026-11-16T08:00:00Z',endedAt:'2026-11-16T08:01:00Z',
  plan:{mode,steps:[{index:0,pressure:planned,temperature}]},
  verificationConfig:{calibrationMin:0,calibrationMax:10,pressureSpan:10,pressureUnit:'bar',
   inputPressurePath:'100',pressureEntryMode:'percent',toleranceEnabled:true,
   correctionApplied:Math.abs(entered-evaluated)>1e-9},
  events:[{kind:'measurement',data:{stepIndex:0,attempt:1,referencePressureInput:entered,
   referencePressure:evaluated,referenceTemperature:temperature,pressureError:0,
   pressureFullScaleSpan:10,toleranceApplied:true,pass:true,
   sample:{sensorValue:evaluated,sensorPressure:evaluated,pressureUnit:'bar',sensorUnit:'bar'}}}]
 };
}
test('A dot-separated list is rejected, but decimal dots remain valid',()=>{
 assert.throws(()=>CORE.points('0, 20.50.70.100.0','Druckreihe'),/Druckreihe/);
 assert.deepEqual(CORE.points('0, 20.5, 70.1, 100','Druckreihe'),[0,20.5,70.1,100]);
});
test('PDF and graph use the entered 8-bar reference, keeping 10 bar as target',()=>{
 const {ELMOS_VERIFICATION_GRAPH:graph,ELMOS_VERIFICATION_REPORT:report}=modules();
 const record=example(),result=graph.summary(record);
 assert.equal(result.data[0].referencePressureInput,8);
 assert.equal(result.data[0].step.pressure,10);
 assert.equal(result.data[0].pressurePct,0);
 const html=report.makeReport(record);
 assert.match(html,/Referenz \(tatsächlich\)/);
 assert.match(html,/8 bar \(Soll 10 bar\)/);
 assert.doesNotMatch(html,/<td>10 bar<\/td>/);
});
test('PDF distinguishes entered calibrator reference from corrected sensor pressure',()=>{
 const {ELMOS_VERIFICATION_REPORT:report}=modules();
 const html=report.makeReport(example({entered:8,evaluated:9.01325}));
 assert.match(html,/8 bar \(Soll 10 bar\)/);
 assert.match(html,/Sensorbezug: 9.0133 bar/);
});
