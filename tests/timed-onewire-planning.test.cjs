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
 const CAL={oneWireStartupStatus:()=>({ok:true}),aodoPinBlocked:w=>!!(w[17]&4),timedPlcRamMatches:require('../calibration.js').timedPlcRamMatches};
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

 test('ESP32 normal cold-start permits only the documented temporary PLC RAM difference',()=>{
 const start=app.indexOf(' function timedOneWireReady('),end=app.indexOf(' function i2cNvmSupported(',start);
 const words=Array(64).fill(0);words[17]=0x6c06;
 const base={iface:'plc',adapterKind:'bridge',mode:'usb',port:{},chip:true,plcAddressVerified:true,plcAddress:0x6c,regs:{6:0x6c04},nvmBackup:words,sensorPowerEnabled:true};
 const run=(changes={},backup=true,proof=true)=>new Function('st','CAL','P','hasCurrentNvmBackup','bridgeCombinedRecoveryReady',app.slice(start,end)+';return timedOneWireReady;')({...base,...changes},{oneWireStartupStatus:()=>({ok:true}),aodoPinBlocked:()=>true,timedPlcRamMatches:require('../calibration.js').timedPlcRamMatches},{plcAddressFromConfig:()=>0x6c},()=>backup,()=>proof)(words);
 assert.equal(run(),true);
 assert.equal(run({regs:{6:0x6c06}}),true);
 for(const changes of [{regs:{6:0x6c00}},{regs:{6:0x7c04}},{psscRamRecovery:true},{coldStartAfeRestored:true},{sensorPowerEnabled:false},{plcAddressVerified:false},{plcAddress:0x7c}])assert.equal(run(changes),false);
 assert.equal(run({},false),false);assert.equal(run({},true,false),false);
});

test('v0.7.182 field trace: startup_com=1 yields 0x6C05 in RAM without copying it into NVM',()=>{
 const C=require('../calibration.js');
 const w=Array(64).fill(0);w[16]=0x12d6;w[17]=0x6c06;w[18]=0x4000;w[19]=0x099f;w[22]=0x0880;w[28]=0x0c4e;w[63]=C.crc16(w);
 assert.equal(C.timedPlcRamMatches(w,0x6c05),true);
 for(const bad of [0x6c00,0x6c01,0x6c02,0x6c03,0x6c07,0x7c05,0x6d05])assert.equal(C.timedPlcRamMatches(w,bad),false);
 const other=w.slice();other[18]=0;assert.equal(C.timedPlcRamMatches(other,0x6c05),false);
 const state={iface:'plc',adapterKind:'bridge',mode:'usb',port:{},chip:true,plcAddressVerified:true,plcAddress:0x6c,regs:{6:0x6c05},nvmBackup:w,sensorPowerEnabled:true};
 const start=app.indexOf(' function timedOneWireReady('),end=app.indexOf(' function i2cNvmSupported(',start);
 const ready=new Function('st','CAL','P','hasCurrentNvmBackup','bridgeCombinedRecoveryReady',app.slice(start,end)+';return timedOneWireReady;')(state,C,{plcAddressFromConfig:()=>0x6c},()=>true,()=>true);
 assert.equal(ready(w),true);
 const scaling=C.analogScaling(.5,4.5,5,30000);
 const after=C.prepareOutputConfig(w,{mode:'1',scaleEnabled:true,timedOneWire:true,gain:scaling.gain,offset:scaling.offset,clipping:{mode:'on',low:.25,high:4.75,vdd:5}},30000,{interfaceMode:'plc'});
 assert.equal(after[17],0x6c02);assert.equal(after[18],0x4000);assert.equal(after[19],w[19]);
 assert.equal(C.oneWireBootRegisterMatches(after,0x6c05,6,{startupAccess:true}),true);
 assert.equal(C.oneWireBootRegisterMatches(after,0x6c05,6,{startupAccess:false}),false);
 assert.equal(C.oneWireBootRegisterMatches(after,0x7c05,6,{startupAccess:true}),false);
});

 test('v0.7.201 SSP3 field trace: AFE recovery and startup_com=1 allow only documented RAM mode',()=>{
 const C=require('../calibration.js'), P=require('../app.js');
 const w=Array(64).fill(0);w[16]=0x1214;w[17]=0x6c06;w[18]=0x4000;w[19]=0x099f;w[22]=0x0880;w[63]=C.crc16(w);
 const start=app.indexOf(' function timedOneWireReady('),end=app.indexOf(' function i2cNvmSupported(',start);
 const base={iface:'plc',adapterKind:'ssp3',mode:'usb',port:{},chip:true,plcAddressVerified:true,plcAddress:0x6c,regs:{6:0x6c05},nvmBackup:w,coldStartAfeRestored:true};
 const run=(changes={},words=w,backup=true)=>new Function('st','CAL','P','hasCurrentNvmBackup','bridgeCombinedRecoveryReady',app.slice(start,end)+';return timedOneWireReady;')({...base,nvmBackup:words,...changes},C,P,()=>backup,()=>false)(words);
 assert.equal(run(),true);
 for(const ram of [0x6c04,0x6c06])assert.equal(run({regs:{6:ram}}),true);
 for(const ram of [0x6c00,0x6c01,0x6c02,0x6c03,0x6c07,0x7c05,0x6d05])assert.equal(run({regs:{6:ram}}),false);
 const other=w.slice();other[18]=0;assert.equal(run({},other),false);
 for(const changes of [{plcAddressVerified:false},{plcAddress:0x7c},{sensorLost:true},{closing:true},{chip:false},{iface:'i2c'}])assert.equal(run(changes),false);
 assert.equal(run({},w,false),false);
 const scaling=C.analogScaling(.5,4.5,5,30000);
 const after=C.prepareOutputConfig(w,{mode:'1',scaleEnabled:true,timedOneWire:true,gain:scaling.gain,offset:scaling.offset,clipping:{mode:'on',low:.25,high:4.75,vdd:5}},30000,{interfaceMode:'plc'});
 assert.equal(after[17],0x6c02);assert.equal(after[18],w[18]);assert.equal(after[19],w[19]);assert.equal(w[17],0x6c06);
 });
