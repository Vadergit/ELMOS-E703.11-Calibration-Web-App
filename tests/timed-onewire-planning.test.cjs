'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
test('Direct SSP3 PLC read with 0x6C04 does not force a power cycle',async()=>{
 const start=app.indexOf(' async function probePlcAddresses('),end=app.indexOf(' async function detect(',start);
 const run=new Function('st','P','readReg','decodeSafeAFE','R_AFE','h','logging','renderStatus','demoEnabled','detect',app.slice(start,end)+';return probePlcAddresses;');
 const st={plcAddress:0x6c,port:{},adapterKind:'ssp3',firmware:'02.08.02.04',plcAddressProbes:[]};
 let detected=0;
 const result=await run(st,{plcProbeOrder:()=>[0x6c],plcAddressFromConfig:()=>0x6c,sign16:x=>x},async a=>a===6?0x6c04:1,()=>{},0x1c,x=>x.toString(16),()=>{},()=>{},false,async()=>{detected++;st.chip=true;})('connect',true);
 assert.equal(result,true);assert.equal(detected,1);assert.equal(st.plcAddressVerified,true);
});
test('Timed NVM conversion accepts verified permanent SSP3 direct access, not unverified or recovery sessions',()=>{
 const start=app.indexOf(' function timedOneWireReady('),end=app.indexOf(' function i2cNvmSupported(',start);
 const words=Array(64).fill(0);words[17]=0x6c04;
 const base={iface:'plc',adapterKind:'ssp3',mode:'usb',port:{},chip:true,plcAddressVerified:true,plcAddress:0x6c,regs:{6:words[17]},nvmBackup:words};
 const CAL={oneWireStartupStatus:()=>({ok:true}),aodoPinBlocked:w=>!!(w[17]&4)};
 const P={plcAddressFromConfig:()=>0x6c};
 const run=(changes={},backup=true,bridgeProof=false,input=words)=>new Function('st','CAL','P','hasCurrentNvmBackup','bridgeCombinedRecoveryReady',app.slice(start,end)+';return timedOneWireReady;')({...base,...changes},CAL,P,()=>backup,()=>bridgeProof)(input);
 assert.equal(run(),true);
 for(const changes of [{plcAddressVerified:false},{plcAddress:0x7c},{regs:{6:0x6c00}},{sensorLost:true},{closing:true},{chip:false}])assert.equal(run(changes),false);
 assert.equal(run({psscRamRecovery:true}),true);
 assert.equal(run({},false),false);assert.equal(run({},true,false,words.slice()),false);
 assert.equal(run({adapterKind:'bridge',sensorPowerEnabled:true}),false);
 assert.equal(run({adapterKind:'bridge',sensorPowerEnabled:true},true,true),true);
});
test('Staging and writing retain verified original NVM, explicit selection and final guards',()=>{
 assert.match(app,/const available=analogPinBlocked&&st\.iface==='plc'&&hasCurrentNvmBackup\(\)&&startup\.ok/);
 const preparation=app.slice(app.indexOf(' async function prepareNvmOperation(){'),app.indexOf(' async function nvmProgramOperation('));
 assert.doesNotMatch(preparation,/explicitOutputPlan\?\.timedOneWire&&\(!timedOneWireReady/);
 const writing=app.slice(app.indexOf(' async function nvmProgramOperation('));
 assert.match(writing,/timedOneWire&&\(alarmIntegrated\|\|!timedOneWireReady\(st\.nvmBackup\)/);
 assert.match(writing,/const actualRamInterface=await readReg\(0x06\)/);
 assert.match(writing,/actualRamInterface!==plannedRamInterface\|\|!timedOneWireReady\(st\.nvmBackup\)/);
 assert.match(writing,/CAL\.protectStartupCommunication\(initial,modified/);
 assert.match(writing,/CAL\.crc16\(initial\)!==initial\[63\]/);
});

test('Original 0x6C06 and PSSC RAM 0x6C04 yield NVM 0x6C02, not a copied RAM word',()=>{
 const C=require('../calibration.js');
 const w=Array(64).fill(0);
 w[16]=0x12d6;w[17]=0x6c06;w[18]=0x4000;w[19]=0x099f;w[22]=0x0880;w[28]=0x0c4e;w[63]=C.crc16(w);
 const state={iface:'plc',adapterKind:'ssp3',mode:'usb',port:{},chip:true,plcAddressVerified:true,plcAddress:0x6c,regs:{6:0x6c04},nvmBackup:w,psscRamRecovery:true};
 const start=app.indexOf(' function timedOneWireReady('),end=app.indexOf(' function i2cNvmSupported(',start);
 const ready=new Function('st','CAL','P','hasCurrentNvmBackup','bridgeCombinedRecoveryReady',app.slice(start,end)+';return timedOneWireReady;')(state,C,{plcAddressFromConfig:()=>0x6c},()=>true,()=>false);
 assert.equal(ready(w),true);
 const scaling=C.analogScaling(.5,4.5,5,32000);
 const after=C.prepareOutputConfig(w,{mode:'1',scaleEnabled:true,timedOneWire:true,gain:scaling.gain,offset:scaling.offset,clipping:{mode:'on',low:.25,high:4.75,vdd:5}},32000,{interfaceMode:'plc'});
 after[63]=C.crc16(after);
 assert.equal(after[17],0x6c02);assert.equal(after[18],0x4000);assert.equal(after[19],w[19]);assert.equal(C.analogOutputStatus(after,.5,4.5,5,32000).ok,true);
 assert.throws(()=>C.validateRecoveryCalibrationDiff(w,after,{allowAnalogScaling:true}));
 assert.doesNotThrow(()=>C.validateRecoveryCalibrationDiff(w,after,{allowAnalogScaling:true,allowTimedOneWire:true}));
 const bad=after.slice();bad[17]=0x6c00;
 assert.throws(()=>C.validateRecoveryCalibrationDiff(w,bad,{allowAnalogScaling:true,allowTimedOneWire:true}));
 state.regs[6]=0x6c00;assert.equal(ready(w),false);
});
