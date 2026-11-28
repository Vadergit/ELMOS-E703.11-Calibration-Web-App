'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const start=source.indexOf('  fitAutomation:async'),end=source.indexOf('  navigate:n=>step(n),',start);
assert.ok(start>0&&end>start);
function setup({limit=25000,fitError=false,fitWarn=false,ramWarn=false,ramError=false,archiveFail=false,dialog=false,connected=true,wrongUid=false,navigation=true}={}){
 const st={chip:connected,port:connected?{}:null,uid:{hex:'ABC'},calTask:false,writing:false,nvmWorking:false,calStaged:false,calfit:null};
 const calls=[];let archivePromise=null;
 const $=id=>({open:id==='dspRiskDialog'&&dialog,classList:{contains:c=>c==='warn'&&(id==='calFitMsg'?fitWarn:id==='calRamStageMsg'?ramWarn:false)}});
 const fn=new Function('st','$','window','calcCoefficients','coefficientSettingsCurrent','applyCalRam','archiveFail',
  'let guidedFitArchiveWrite=null; const original=calcCoefficients;calcCoefficients=()=>{original();guidedFitArchiveWrite=Promise.resolve(!archiveFail)};return ({'+source.slice(start,end)+'}).fitAutomation');
 const run=fn(st,$,{ELMOS_GUIDED:{isFitPage:()=>navigation}},()=>{calls.push('calculate');if(!fitError)st.calfit={outputLimit:limit,stats:{maxDigits:2}}},()=>!!st.calfit,async()=>{calls.push('ram');st.calStaged=!ramError},archiveFail);
 return {calls,run:options=>run({calculate:true,expectedUid:wrongUid?'other':'ABC',...options})};
}
test('clean calculation writes checked RAM and permits transition',async()=>{const h=setup();assert.deepEqual(await h.run(),{state:'ready'});assert.deepEqual(h.calls,['calculate','ram'])});
test('high DSP limit pauses before RAM',async()=>{const h=setup({limit:32000});assert.equal((await h.run()).reason,'warning');assert.deepEqual(h.calls,['calculate'])});
test('explicit RAM action after warning proceeds, no NVM operation',async()=>{const h=setup({limit:32000});await h.run();assert.equal((await h.run({calculate:false,manual:true})).state,'ready');assert.deepEqual(h.calls,['calculate','ram'])});
test('invalid fit or archive failure never writes RAM',async()=>{for(const opts of [{fitError:true},{archiveFail:true},{fitWarn:true}]){const h=setup(opts);assert.equal((await h.run()).state,'stopped');assert.deepEqual(h.calls,['calculate'])}});
test('RAM error or saturation warning prevents automatic transition',async()=>{for(const opts of [{ramError:true},{ramWarn:true}]){const h=setup(opts);assert.equal((await h.run()).state,'stopped');assert.deepEqual(h.calls,['calculate','ram'])}});
test('connection, UID, modal and navigation guards',async()=>{for(const opts of [{connected:false},{wrongUid:true},{dialog:true},{navigation:false}]){const h=setup(opts);assert.equal((await h.run()).state,'stopped');assert.ok(!h.calls.includes('ram'))}});
