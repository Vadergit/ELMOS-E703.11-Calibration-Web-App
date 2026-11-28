'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');const app=read('app.js'),guide=read('guided.js');const src=app.slice(app.indexOf(' function newCalibrationPowerPath'),app.indexOf(' let newCalibrationBusy'));const F=new Function(src+'return {path:newCalibrationPowerPath,proof:newCalibrationRestartProven}')();let count=0;const eq=(a,b)=>{assert.equal(a,b);count++};
for(const [a,i,p,c,e] of [['ssp3','plc',false,true,'ssp3-power'],['ssp3','plc',false,false,'manual'],['ssp3','i2c',false,true,'manual'],['bridge','plc',true,false,'bridge-power'],['bridge','i2c',true,false,'bridge-power'],['bridge','plc',false,false,'manual']])eq(F.path({adapter:a,iface:i,powerEnabled:p,ssp3Confirmed:c}),e);
const port={},session=3,uid='123',base={port,session,uid},valid={port,session,powerRestored:true,readVerified:true,verifiedUid:uid};for(const [p,o,e] of [['ssp3-power',{trials:[valid]},true],['ssp3-power',{powerResult:valid},true],['ssp3-power',{trials:[{...valid,session:2}]},false],['ssp3-power',{trials:[{...valid,verifiedUid:'other'}]},false],['ssp3-power',{trials:[{...valid,powerRestored:false}]},false],['ssp3-power',{trials:[{...valid,readVerified:false}]},false],['ssp3-power',{},false],['bridge-power',{bridgeProof:base},true],['bridge-power',{bridgeProof:{...base,session:2}},false],['bridge-power',{bridgeProof:{...base,uid:'other'}},false],['bridge-power',{},false],['manual',{manualConfirmed:true},true],['manual',{manualConfirmed:false},false]])eq(F.proof(p,{...base,...o}),e);
assert.match(guide,/if\(task==='calibration'\)\{\s*msg\([^;]+;\s*try\{await window.ELMOS_GUIDED_API.prepareNewCalibration\(\);/);assert.match(app,/if\(newCalibrationStart==='ssp3-power'\)\{\s*await startSsp3WithBoundedRetry\(\)/);assert.match(app,/st.nvmBackup=null;st.nvmBackupVerified=false;st.nvmBackupProof=null;\s*if\(!await nvmScan\(\{expertRead:true\}\)/);console.log(count+' restart decision checks + 3 source checks passed');


const calibration=require('../calibration.js');
const regList=[0x6C,0x6E,0x70,0x72,...Array.from({length:16},(_,i)=>0x74+2*i),0x94,0x96,0x98,0x9A];
const baseline=new Function('CAL','CAL_REGS',src+'return newCalibrationBaselineMatches')(calibration,regList);
const words=Array(64).fill(0),ram=Object.fromEntries(calibration.PROFILE_REGS.map(([a,i])=>[a,words[i]])),dsp=Object.fromEntries(regList.map((a,i)=>[a,words[31+i]]));
assert.equal(baseline(words,ram,dsp),true);
assert.equal(baseline(words,{...ram,0x1E:1},dsp),false);
assert.equal(baseline(words,{...ram,0x1C:0x0810},dsp),false);
assert.equal(baseline(words,ram,{...dsp,0x74:1}),false);
assert.equal(baseline(words,ram,{}),false);
assert.equal(baseline(words,{...ram,4:2,14:1},dsp),false);
assert.equal(baseline(words,{...ram,4:2,14:1},dsp,{recovery:true}),true);
assert.match(app,/newCalibrationFailedRestart\?\.port===port&&newCalibrationFailedRestart\.uid===priorUid&&path==='ssp3-power'\)\{\s*path='manual'/);
assert.match(app,/baseline&&sameSession\(\)&&await readCalibrationUid\(\)===priorUid/);
console.log('9 clean-baseline and repeated restart checks passed');
