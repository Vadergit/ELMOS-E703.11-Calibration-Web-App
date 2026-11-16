'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const CORE=require('../archive-core.js');

function modules(){
 const context=vm.createContext({document:{documentElement:{lang:'de-CH'}},window:{ELMOS_ARCHIVE_CORE:CORE}});
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

function ungradedFinished(){
 const record=example();
 record.status='incomplete';
 record.verificationConfig.toleranceEnabled=false;
 record.events[0].data.pass=null;
 record.events[0].data.toleranceApplied=false;
 record.events.push({kind:'finished',data:{status:'incomplete'}});
 return record;
}
test('Completed capture without optional tolerance is not an incomplete verification',()=>{
 const record=ungradedFinished();
 assert.equal(CORE.verificationCompletion(record),'completed');
 assert.equal(CORE.displayStatus(record),'completed');
 assert.equal(record.status,'incomplete'); // do not rewrite old JSON archive
 const html=modules().ELMOS_VERIFICATION_REPORT.makeReport(record);
 assert.match(html,/<b>Abgeschlossen<\/b>/);
 assert.match(html,/ursprüngliche Archivdatei bleibt unverändert/);
});
test('Tolerance enabled with unconfirmed result remains incomplete',()=>{
 const record=ungradedFinished();
 record.verificationConfig.toleranceEnabled=true;
 record.events[0].data.toleranceApplied=true;
 assert.equal(CORE.verificationCompletion(record),'incomplete');
 assert.equal(CORE.displayStatus(record),'incomplete');
});
test('Missing last point remains incomplete even if tolerance disabled',()=>{
 const record=ungradedFinished();
 record.plan.steps.push({index:1,pressure:0,temperature:null});
 assert.equal(CORE.verificationCompletion(record),'incomplete');
 assert.equal(CORE.displayStatus(record),'incomplete');
});
test('Failed measured tolerance or a still-open empty record keep their true status',()=>{
 const bad=ungradedFinished();
 bad.verificationConfig.toleranceEnabled=true;
 bad.events[0].data.pass=false;
 bad.events[0].data.toleranceApplied=true;
 assert.equal(CORE.verificationCompletion(bad),'failed');
 assert.equal(CORE.displayStatus(bad),'incomplete'); // correction only for completed records
 const open={...ungradedFinished(),status:'running',endedAt:null};
 assert.equal(CORE.displayStatus(open),'incomplete'); // legacy running records never appear as Open
});

test('Empty calibration starts and snapshots do not count as measured data',()=>{
 const empty={type:'calibration',status:'running',endedAt:null,events:[
  {kind:'started',data:{type:'calibration'}},
  {kind:'initial_snapshot',data:{ramWords:30,nvmWords:64}},
  {kind:'transport',data:{line:'PLC read'}},
  {kind:'error',data:{stage:'initial_snapshot',message:'No chip response'}}
 ]};
 assert.equal(CORE.hasMeaningfulData(empty),false);
 const partial=structuredClone(empty);
 partial.events.push({kind:'calibration_point',data:{point:{adc_s:120,rawSamples:[119,120]}}});
 assert.equal(CORE.hasMeaningfulData(partial),true);
 assert.equal(CORE.displayStatus(partial),'incomplete');
 assert.equal(CORE.displayStatus(empty),'incomplete'); // unseen empty records are filtered
});
test('Meaningful partial archives and hardware changes survive; empty verification does not',()=>{
 const calibration={type:'calibration',status:'running',events:[
  {kind:'started',data:{}},
  {kind:'afe_ram_changed',data:{before:10,after:11}}
 ]};
 const aborted={type:'calibration',status:'incomplete',events:[
  {kind:'error',data:{rawSamples:[1,2,3]}}
 ]};
 const failed={type:'calibration',status:'running',events:[
  {kind:'error',data:{message:'no sensor reply'}}
 ]};
 const verification={type:'verification',status:'running',plan:{steps:[{index:0}]},
  events:[{kind:'started',data:{}},{kind:'point_skipped',data:{stepIndex:0}}]};
 const measured={...verification,events:[...verification.events,
  {kind:'measurement',data:{stepIndex:0,sample:{sensorValue:1}}}]};
 assert.equal(CORE.hasMeaningfulData(calibration),true);
 assert.equal(CORE.hasMeaningfulData(aborted),true);
 assert.equal(CORE.hasMeaningfulData(failed),false);
 assert.equal(CORE.hasMeaningfulData(verification),false);
 assert.equal(CORE.hasMeaningfulData(measured),true);
 assert.equal(CORE.displayStatus(measured),'incomplete');
});
test('Crash-interrupted testlog references are not silently hidden',()=>{
 const interrupted={type:'testlog',status:'running',telemetry:{groups:0},
  telemetryFiles:['samples.part-0001.samples.jsonl'],events:[{kind:'started',data:{}}]};
 assert.equal(CORE.hasMeaningfulData(interrupted),true);
 assert.equal(CORE.displayStatus(interrupted),'incomplete');
});
test('Archive UI prevents empty files and hides existing empty archive records',()=>{
 const archive=fs.readFileSync(path.join(__dirname,'..','archive.js'),'utf8');
 assert.match(archive,/if\(\['calibration','verification'\]\.includes\(S\.record\.type\)&&!C\.hasMeaningfulData\(S\.record\)\)return;/);
 assert.match(archive,/if\(!C\.hasMeaningfulData\(parsed\)\)\{hiddenEmpty\+\+;continue\}/);
 assert.doesNotMatch(archive,/<option value="running">/);
});
