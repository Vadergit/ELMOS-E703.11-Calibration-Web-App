'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../calibration.js');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const from=app.indexOf(' async function startRamMeasurementOperation()'),to=app.indexOf(' // Confirm the PLC address',from);
const code=app.slice(from,to)+'\nreturn startRamMeasurementOperation;';
function simulate({newChip=false,corrupt=false,invalidAfe=false,wrongCoeff=false,uidChanges=false,failWrite=false,noFresh=false,transient=false,changedProfile=false,nonblank=false}={}){
 const words=Array(64).fill(0);
 words[0]=0x44BC;words[1]=0x00FC;words[16]=newChip?0x1214:0x1216;words[17]=4;words[18]=2<<12;words[19]=(1<<11)|(1<<8)|(1<<7);
 words[21]=newChip?0:1;words[22]=0x0880;words[24]=0x48d3;words[25]=0x2a9e;words[26]=0x0412;words[28]=invalidAfe?0:newChip?0x0800:0x1891;
 if(!newChip)for(let i=31;i<=54;i++)words[i]=i+10;
 else{words[17]=0x6C06;words[18]=0x4000;words[19]=0x099F;words[24]=0x48A0;words[25]=0x2E56;words[26]=0x04B4;words[27]=0x0C80;words[29]=0x1154;words[30]=1;words[32]=0x1000;words[51]=0x0F4D;words[52]=0xBC8E;words[53]=0xFC54;}
 if(nonblank)words[36]=42;
 words[15]=C.crc8(words)<<8;words[63]=C.crc16(words);if(corrupt)words[63]^=1;
 const regs=Object.fromEntries(C.PROFILE_REGS.map(([addr,i])=>[addr,words[i]]));regs[0x1c]=0;regs[14]=0;
 for(let i=31;i<=54;i++)regs[0x6C+(i-31)*2]=words[i];
 if(wrongCoeff)regs[0x74]^=1;
 if(changedProfile)regs[0x1A]^=1;
 const uid='002000FC44BC',port={},st={port,plcAddress:0x6c,plcAddressVerified:true,plcHostFormat:'legacy',sessionIndex:1,readOnlySensor:uid,chip:false,adapterKind:'ssp3',iface:'plc',calpoints:[]};
 let selected=0,uidReads=0,failed=false,clock=0;const writes=[],messages=[];
 const deps={st,CAL:C,P:{plcWrite:(addr,value)=>[addr,value],plcHostCommand:x=>x},R_AFE:0x1c,h:(n,b=1)=>n.toString(16).toUpperCase().padStart(b*2,'0'),
  readCalibrationUid:async()=>{uidReads++;if(transient&&uidReads===1)throw Error('PLC nothing received');return uidChanges&&uidReads>1?'002000000001':uid},
  exchange:async([addr,value])=>{if(addr===0x4e){assert.equal(value&0xff80,0x4c00);selected=(value&0x7f)/2;return}
   writes.push([addr,value]);if(addr===0x22){assert.equal(value,0x8b93);return}
   if(failWrite&&addr===0x1c&&!failed){failed=true;throw Error('write failed')}regs[addr]=value},
  readReg:async addr=>addr===0x48?words[selected]:addr===0x36?(noFresh?0:2):addr===0x2a?100:regs[addr],
  nvmWaitIdle:async()=>{},decodeSafeAFE:v=>{if(!(v&0x800))throw Error('AFE Pflichtbit fehlt');return {}},readCalibrationProfile:async()=>Object.fromEntries(C.PROFILE_REGS.map(([addr])=>[addr,regs[addr]])),
  filterProfiles:[['default',[0x48d3,0x2a9e,0x0412]]],sleep:async ms=>{clock+=ms},Date:{now:()=>clock},
  stopLive:()=>{},startLive:()=>{},renderStatus:()=>{},logging:()=>{},show:(...args)=>messages.push(args),
  detect:async opts=>{assert.equal(opts.requireUid,true);st.chip=true;st.uid={hex:uid}}};
 const run=new Function(...Object.keys(deps),code)(...Object.values(deps));
 return {run,st,regs,words,writes,messages};
}
test('calibrated sensor restores own AFE, preserves DSP and NVM',async()=>{
 const x=simulate();assert.equal(await x.run(),true,x.messages.at(-1)?.[1]);assert.equal(x.st.chip,true);assert.equal(x.regs[0x1c],0x1891);assert.equal(x.regs[4],0x1216);
 assert.deepEqual(x.writes,[[0x1c,0x1891],[0x0e,1],[0x22,0x8b93]]);assert.equal(C.crc16(x.words),x.words[63]);
});
test('new sensor starts continuous RAM measurement without enabling uncalibrated DSP',async()=>{
 const x=simulate({newChip:true,transient:true});assert.equal(await x.run(),true,x.messages.at(-1)?.[1]);assert.equal(x.regs[4]&3,0);
 assert.equal(x.regs[0x1c],0x0800);assert.equal(x.words[21],0);assert.equal(x.st.readOnlySensor,null);
});
for(const option of ['corrupt','invalidAfe','wrongCoeff','uidChanges','changedProfile'])test('unsafe recovery blocked before RAM writes: '+option,async()=>{
 const x=simulate({[option]:true});assert.equal(await x.run(),false);assert.equal(x.st.chip,false);assert.deepEqual(x.writes,[]);
});
test('failed RAM write and missing fresh measurement restore original RAM',async()=>{
 for(const option of ['failWrite','noFresh']){const x=simulate({[option]:true});assert.equal(await x.run(),false);assert.equal(x.regs[0x1c],0);assert.equal(x.regs[14],0);assert.equal(x.st.chip,false);}
});
test('no initialisation during an active calibration',async()=>{
 const x=simulate();x.st.calpoints=[{}];assert.equal(await x.run(),false);assert.deepEqual(x.writes,[]);
});
test('automatic recovery runs from both connection paths without a stored UID',()=>{
 assert.match(app,/if\(st\.readOnlySensor&&!st\.ramRecoveryAttempted\)await startRamMeasurementOperation\(\)/);
 assert.match(app,/if\(st\.readOnlySensor\)\{\s*if\(!st\.ramRecoveryAttempted\)\{showReadOnlySensor\(\);await startRamMeasurementOperation\(\);\}/);
 assert.match(app,/if\(ready&&st\.readOnlySensor\)\{[\s\S]*?if\(await startRamMeasurementOperation\(\)\)break;\s*if\(!st\.ramRecoveryRetryable\|\|delay==='10'\)return true;/);
 assert.doesNotMatch(app,/st\.readOnlySensor(?:&&st\.readOnlySensor)?===lsGet\('ssp3-auto-ram-uid'\)/);
});

// Reconstructed register fixture: Jürg's log shows blank pressure/RAM,
// factory example temperature coefficients, USER=1 and AFE=0 both in CM/RAM.
// Factory-specific words and CRCs in this fixture are synthetic.
test('pressure-blank log profile repairs only AFE bit 11 and starts measurement',async()=>{
 const x=simulate({newChip:true,invalidAfe:true,transient:true});
 assert.equal(C.uncalibratedAfeBlank(x.words),true);
 assert.equal(await x.run(),true,x.messages.at(-1)?.[1]);
 assert.deepEqual(x.writes,[[0x1c,0x0800],[0x0e,1],[0x22,0x8b93]]);
 assert.equal(x.words[28],0);assert.equal(x.regs[0x1c],0x0800);
 assert.equal(x.words[21],0);assert.equal(x.regs[4],0x1214);
 assert.equal(x.regs[0x96],0xBC8E);assert.equal(x.st.coldStartAfeRestored,true);
});
test('nonzero pressure coefficient forbids automatic AFE default, even with pressure disabled',async()=>{
 const x=simulate({newChip:true,invalidAfe:true,nonblank:true});
 assert.equal(C.uncalibratedAfeBlank(x.words),false);
 assert.equal(await x.run(),false);assert.deepEqual(x.writes,[]);
});
test('blank AFE recovery fails safely when no fresh ADC conversion arrives',async()=>{
 const x=simulate({newChip:true,invalidAfe:true,noFresh:true});
 assert.equal(await x.run(),false);assert.equal(x.regs[0x1c],0);
 assert.equal(x.regs[14],0);assert.equal(x.st.ramRecoveryRetryable,false);
});
