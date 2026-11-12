'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const P=require('../app.js');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('Elmos PLC slave address is decoded from both RAM configuration registers',()=>{
 assert.equal(P.plcAddressFromConfig(0x6C06,0x099F),0x6C);
 assert.equal(P.plcAddressFromConfig(0x7C05,0x099F),0x7C);
 assert.equal(P.plcAddressFromConfig(0x7C05,0x199F),0xFC);
 assert.deepEqual(P.plcProbeOrder(0x6C),[0x6C,0x7C]);
 assert.deepEqual(P.plcProbeOrder(0x7C),[0x7C,0x6C]);
});
test('Legacy 0x6C and configured 0x7C produce correct CRC protected PLC frames',()=>{
 assert.equal(P.plcRead(0x1C),'PLC 026D1C0C.');
 assert.equal(P.plcRead(0x1C,1,0x7C),'PLC 027D1C0A.');
 assert.equal(P.plcWrite(0xAC,0x2B42),'PLC 026CAC0F2B4299');
 assert.equal(P.plcWrite(0x0E,0x5CFD),'PLC 026C0E095CFDCA');
 assert.equal(P.plcWrite(0xAC,0x2B42,0x7C),'PLC 027CAC092B42E4');
 assert.equal(P.plcWrite(0x0E,0x5CFD,0x7C),'PLC 027C0E0F5CFDB7');
 assert.throws(()=>P.plcRead(0x1C,1,0x7D),/Ungültige PLC-Slave-Adresse/);
 assert.throws(()=>P.plcWrite(0xAC,0x2B42,0x7D),/Ungültige PLC-Slave-Adresse/);
});
test('The Web-app probes before DUT power cycling and uses confirmed address for every PLC operation',()=>{
 const app=read('app.js'),html=read('index.html');
 const scan=app.split('async function probePlcAddresses(stage,verifyPsscStartup=false){')[1]?.split('async function detect(){')[0];
 assert.ok(scan);
 assert.ok(scan.includes('await readReg(R_AFE,1350)'));
 assert.ok(scan.includes('decodeSafeAFE(afe)'));
 assert.ok(scan.includes('await readReg(0x2A,1350)'));
 assert.ok(scan.includes('P.plcAddressFromConfig(cfg,pads)'));
 assert.ok(scan.includes('configured!==candidate'));
 assert.ok(scan.includes('st.plcAddressVerified=true'));
 assert.ok(app.includes("probePlcAddresses('Erstverbindung ohne Power-Cycle',true)"));
 assert.ok(app.includes("probePlcAddresses('Neuinitialisierung ohne Power-Cycle',true)"));
 assert.ok(app.includes("probePlcAddresses('Nach SSP3 PLC P/T')"));
 assert.ok(app.includes('P.plcRead(addr,1,st.plcAddress)'));
 assert.ok(app.includes('P.crc4([st.plcAddress|1,addr,0],20)'));
 assert.ok(app.includes('P.plcWrite(addr,word,st.plcAddress)'));
 assert.ok(html.includes('id="plcAddressRow"'));
 assert.ok(html.includes('id="plcAddressLabel"'));
 assert.ok(app.includes('plcAddressProbes:st.plcAddressProbes'));
 const writes=[...app.matchAll(/P\.plcWrite\(([^)\n]+)\)/g)].map(m=>m[1]);
 assert.ok(writes.length>=8);
 assert.ok(writes.every(args=>args.includes('st.plcAddress')));
});
test('Address detection does not remove protected boot/NVM write restrictions',()=>{
 const app=read('app.js');
 assert.ok(app.includes('CAL.protectStartupCommunication(initial,modified)'));
 assert.ok(app.includes("if(configured!==candidate)throw Error"));
 assert.ok(app.includes("if(!/\\bPLC nothing received\\b/i.test(record.error)"));
 assert.ok(app.includes('st.plcAddressVerified=false;st.mode='));
 assert.ok(!app.includes('P.plcWrite(0x06,'));
});

test('PSSC recovery permits calibration only after a verified restart of the same chip',()=>{
 const app=read('app.js');
 const guard=app.slice(app.indexOf(' function psscRecoveryProven()'),app.indexOf(' function renderFlowState()'));
 const state={psscRamRecovery:true,regs:{6:0x6C04},plcAddressVerified:true,plcAddress:0x6C,
  uid:{hex:'0020011DBBE7'},startupTrials:[]};
 const block=require('node:vm').runInNewContext(guard+'; psscNvmBlock',{st:state});
 const initial=Array(64).fill(0);
 initial[17]=0x7C05;
 const plan=initial.slice();
 plan[35]=123;
 plan[63]=456;
 assert.match(block(initial,plan),/Neustart/);
 const trial={stage:'PSSC-RAM-Start',powerRestored:true,readVerified:true,verifiedUid:'0020011DBBE7'};
 state.startupTrials.push(trial);
 assert.equal(block(initial,plan),'');
 for(const protectedWord of [16,17,18,19,22,27,57,58]){
  const changed=plan.slice();
  changed[protectedWord]^=1;
  assert.match(block(initial,changed),/nur Kalibrierdaten/);
 }
 assert.match(block(initial,plan,true),/nur Kalibrierdaten/);
 state.psscRamRecovery=false;
 trial.verifiedUid='00200109F7DB';
 assert.match(block(initial,plan),/Neustart/);
});
