'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8'),app=read('app.js'),guide=read('guided.js'),expert=read('expert.js');
const src=app.slice(app.indexOf(' async function waitForNewCalibrationIdle'),app.indexOf(' async function prepareNewCalibration('));
const wait=new Function(src+';return waitForNewCalibrationIdle')();
test('waits for optional reading and does not start early',async()=>{let ticks=0;await wait({blocker:()=>ticks<3?{label:'NVM-Lesung',wait:true}:null,connected:()=>true,pause:async()=>{ticks++}});assert.equal(ticks,3)});
test('never waits past a programming lock, never clears busy flags',async()=>{let ticks=0;await assert.rejects(wait({blocker:()=>({label:'NVM-Programmierung',wait:false}),connected:()=>true,pause:async()=>{ticks++}}),/NVM-Programmierung/);assert.equal(ticks,0)});
test('cancellation, timeout and UID change stop queued start',async()=>{const opts={blocker:()=>({label:'Lesung',wait:true}),connected:()=>true,pause:async()=>{}};await assert.rejects(wait({...opts,cancelled:()=>true}),/abgebrochen/);await assert.rejects(wait({...opts,timeout:0}),/nicht beendet/);await assert.rejects(wait({...opts,connected:()=>false}),/Verbindung/);});
test('series import postpones analog calculation, regular output path retains confirmation',()=>{assert.ok(app.includes('deferAnalogScaling:affectsCalibration'));assert.ok(expert.includes('if(isAnalog(mode)&&!deferAnalogScaling)calculateAnalogScaling()'));assert.ok(expert.includes('if(isAnalog(values.mode))'));assert.ok(guide.includes('s.calibrationOutputConfirmed'));assert.ok(guide.includes('gwStartRetry'));assert.ok(guide.includes('startWaitCancelled=true'));});
