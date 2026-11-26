'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
test('Permanent PLC requests controlled direct power startup before calibration',()=>{
 const start=app.indexOf(' async function probePlcAddresses(');
 const end=app.indexOf(' async function detect(',start);
 const run=new Function('st','P','readReg','decodeSafeAFE','R_AFE','h','logging','renderStatus','demoEnabled',app.slice(start,end)+';return probePlcAddresses;');
 const st={plcAddress:0x6c,port:{},adapterKind:'ssp3',firmware:'02.08.02.04'};
 return run(st,{plcProbeOrder:()=>[0x6c],plcAddressFromConfig:()=>0x6c},async a=>a===6?0x6c04:1,()=>{},0x1c,x=>x.toString(16),()=>{},()=>{},false)('connect',true).then(result=>{
  assert.equal(result,false);assert.equal(st.ssp3DirectPowerStart,true);
 });
});
test('Read-only planning no longer depends on the power proof, actual programming still does',()=>{
 assert.match(app,/const available=analogPinBlocked&&st\.iface==='plc'&&hasCurrentNvmBackup\(\)&&startup\.ok/);
 assert.match(app,/const directFirst=st\.ssp3DirectPowerStart===true/);
 assert.match(app,/if\(!directFirst&&await tryPsscRamStartup\(\)\)return true/);
 const preparation=app.slice(app.indexOf(' async function prepareNvmOperation(){'),app.indexOf(' async function nvmProgramOperation('));
 assert.doesNotMatch(preparation,/explicitOutputPlan\?\.timedOneWire&&\(!timedOneWireReady/);
 const writing=app.slice(app.indexOf(' async function nvmProgramOperation('));
 assert.match(writing,/timedOneWire&&\(alarmIntegrated\|\|!timedOneWireReady\(st\.nvmBackup\)/);
 assert.match(writing,/timedOneWire&&\(!timedOneWireReady\(st\.nvmBackup\)\|\|await readReg\(0x06\)!==initial\[17\]\)/);
});
