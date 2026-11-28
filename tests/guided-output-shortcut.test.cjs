'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const g=read('guided.js'),e=read('expert.js'),css=read('guided.css');
function harness(overrides={},task='calibration'){
 const state=()=>({chip:true,calVerified:true,connectionBusy:false,outputScalingRequired:false,calibrationOutputConfirmed:true,...overrides});
 const fields={gwUseAlarms:{checked:true},gwAlarmConfigArea:{hidden:false}};let skipped=0,dest=null,warning='';
 const code=g.slice(g.indexOf(' function continueFromOutput('),g.indexOf(' async function next(seriesSettings'));
 const run=new Function('mode','stage','connectionOpen','nextSensorPending','fixedFitBusy','state','task','$','window','goto','msg',code+';return continueFromOutput;')(true,7,false,null,false,state,task,id=>fields[id],{ELMOS_GUIDED_API:{skipAlarms:()=>skipped++}},n=>dest=n,m=>warning=m);
 return {run,result:()=>({dest,skipped,warning,checked:fields.gwUseAlarms.checked})};
}
test('normal continuation and optional skip use identical output validation',()=>{for(const skip of [false,true]){const h=harness();assert.equal(h.run(skip),true);assert.equal(h.result().dest,skip?9:8);assert.equal(h.result().skipped,skip?1:0);}});
for(const flags of [{chip:false},{connectionBusy:true},{calVerified:false},{outputScalingRequired:true},{calibrationOutputConfirmed:false}])test('both paths block '+JSON.stringify(flags),()=>{for(const skip of [false,true]){const h=harness(flags);assert.equal(h.run(skip),false);assert.equal(h.result().dest,null);assert.equal(h.result().skipped,0);}});
test('standalone output does not gain alarm-skip action',()=>{const h=harness({},'output');assert.equal(h.run(true),false);assert.equal(h.result().dest,null);});
test('simple analogue hides only redundant scaling action and uses existing calculation',()=>{assert.match(g,/const simpleAnalog=calibration&&!\$\('expertMode'\).checked&&\['1','2','3'\]/);assert.match(e,/!manualScaling\|\|guidedAnalog/);assert.match(css,/#gwPage7\.gw-output-auto-analog #expertOutputPreset/);assert.doesNotMatch(css,/#gwPage7\.gw-output-calibration #gwOutputSkipAlarm/);});
