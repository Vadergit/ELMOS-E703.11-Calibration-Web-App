'use strict';
// Offline-only regression tests. No device I/O and NEVER any NVM programming.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../calibration.js');

const points = rows => rows.map(([adc_s,adc_t,pressure,temperature]) => ({adc_s,adc_t,pressure,temperature}));
const firstTwo = points([[-12000,1000,0,25],[12000,1000,100,25]]);
const fullFour = points([[-12000,1000,0,25],[12000,1000,100,25],[-11600,8000,0,75],[12300,8000,100,75]]);
function originalNvm(){
 const w=Array(64).fill(0);
 w[16]=0x0200; // analog without scale_en: deliberately incorrect as a final NVM
 w[18]=2<<12; // 200 ms PLC at startup, followed by analog output
 w[19]=(1<<11)|(1<<8)|(1<<7);
 w[28]=0x0800;
 w[63]=C.crc16(w);
 return w;
}
function plan(limit=32000){
 const x=C.analogScaling(0.5,4.5,5,limit);
 return {mode:'1',scaleEnabled:true,gain:x.gain,offset:x.offset,
  clipping:{mode:'keep'}};
}
test('AN0203 pressure/temperature targets',()=>{
 assert.equal(C.elmosDspTarget(0),-32000);
 assert.equal(C.elmosDspTarget(50),0);
 assert.equal(C.elmosDspTarget(100),32000);
 assert.equal(C.elmosDspTarget(5,5,15,25000),-25000);
 assert.equal(C.elmosDspTarget(15,5,15,25000),25000);
 assert.equal(C.elmosTemperatureTarget(25),387.88*25-16485);
 assert.throws(()=>C.elmosDspTarget(101),/AN0203/);
});
test('two-point pressure fit produces register-ready coefficients',()=>{
 const fit=C.fit(firstTwo,{pmin:0,pmax:100,outputLimit:32000,orderS:1,orderT:0});
 assert.equal(fit.registers.coeffs.length,16);
 assert.ok(fit.stats.maxDigits<5);
});
test('three-point TK0 and four-point TK0+TKE regression',()=>{
 const tk0=C.fit(fullFour.slice(0,3),{pmin:0,pmax:100,outputLimit:31000,orderS:1,orderT:1,fitMode:'tk0'});
 assert.equal(tk0.registers.coeffs[5],0);
 assert.ok(tk0.stats.maxDigits<5);
 const tke=C.fit(fullFour,{pmin:0,pmax:100,outputLimit:31000,orderS:1,orderT:1,fitMode:'full'});
 assert.ok(tke.stats.maxDigits<5);
});
test('reject old NVM without analogue scaling even when pressure fit is valid',()=>{
 const w=originalNvm();
 const r=C.analogOutputStatus(w,0.5,4.5,5,32000);
 assert.equal(r.checked,true);assert.equal(r.ok,false);
 assert.match(r.reason,/scale_en/);
});
test('Elmos image: coherent NVM stores AODO_F, updates CRC and preserves PLC/factory',()=>{
 const orig=originalNvm();
 const fit=C.fit(firstTwo,{pmin:0,pmax:100,outputLimit:32000,orderS:1,orderT:0});
 const image=C.configFrom(orig,fit,0x800,{output:plan()});
 const result=C.analogOutputStatus(image.after,0.5,4.5,5,32000);
 assert.equal(result.ok,true);
 assert.ok(Math.abs(result.actualVolts[0]-0.5)<0.002);
 assert.ok(Math.abs(result.actualVolts[1]-4.5)<0.002);
 assert.equal(image.after[63],C.crc16(image.after));
 assert.deepEqual(image.after.slice(0,16),orig.slice(0,16));
 for(const i of [17,18,19])assert.equal(image.after[i],orig[i]);
 assert.ok(image.changes.some(c=>c.index===58));
});
test('Permanent One-Wire blocks analog output until an explicit timed conversion',()=>{
 const orig=originalNvm(),output=plan(30000);
 orig[16]=0x12D6;orig[17]=0x6C06;orig[18]=0x4000;orig[19]=0x099F;orig[22]=0x0880;
 orig[58]=0x0DFB;orig[59]=0x8CD0;orig[60]=0x7330;orig[63]=C.crc16(orig);
 const blocked=C.analogOutputStatus(orig,.5,4.5,5,30000);
 assert.deepEqual([blocked.checked,blocked.ok,blocked.reason],[true,false,C.AODO_PLC_CONFLICT]);
 assert.throws(()=>C.prepareOutputConfig(orig,output,30000),/belegt AODO/);
 assert.deepEqual(C.prepareOutputConfig(orig,{mode:'onewire'}),orig);
 const fit=C.fit(firstTwo,{pmin:0,pmax:100,outputLimit:30000});
 const conversion={...output,timedOneWire:true};
 const image=C.configFrom(orig,fit,0x0800,{output:conversion,interfaceMode:'plc'});
 const changed=C.prepareOutputConfig(orig,conversion,30000,{interfaceMode:'plc'});
 assert.deepEqual(changed.map((word,index)=>word===orig[index]?null:index).filter(Number.isInteger),[17]);
 assert.equal(image.after[17],0x6C02);
 assert.equal(image.after[18],0x4000);
 assert.equal(image.after[63],C.crc16(image.after));
 assert.equal(C.oneWireStartupStatus(image.after).windowLabel,'4 ms');
 const withLongWindow=orig.slice();
 withLongWindow[18]|=0x2000;
 const shortened=C.prepareOutputConfig(withLongWindow,conversion,30000,{interfaceMode:'plc'});
 assert.equal(shortened[18],0x4000);
 assert.equal(C.analogOutputStatus(image.after,.5,4.5,5,30000).ok,true);
 assert.throws(()=>C.prepareOutputConfig(orig,conversion,30000,{interfaceMode:'i2c'}),/Startschutz/);
 assert.throws(()=>C.protectStartupCommunication(orig,changed),/Startschutz/);
 for(const index of [17,18,19]){
  const bad=changed.slice();bad[index]^=1;
  assert.throws(()=>C.protectStartupCommunication(orig,bad,{allowTimedOneWire:true}),/Startschutz/);
 }
});

test('One-Wire cold-start verification accepts only documented RAM overrides',()=>{
 const w=originalNvm();
 w[17]=0x6C00;w[18]=0xC000;w[19]=0x081F;
 assert.equal(C.oneWireBootRegisterMatches(w,0x6C04,6,{startupAccess:true}),true);
 assert.equal(C.oneWireBootRegisterMatches(w,0x099F,10,{startupAccess:true}),true);
 assert.equal(C.oneWireBootRegisterMatches(w,0x099F,10),false);
 assert.equal(C.oneWireBootRegisterMatches(w,0x199F,10,{startupAccess:true}),false);
 w[17]=0x6C02;
 assert.equal(C.oneWireBootRegisterMatches(w,0x6C04,6,{startupAccess:true}),false);
 assert.equal(C.oneWireBootRegisterMatches(w,0x6C04,6,{startupAccess:true,psscRecovery:true}),true);
 assert.equal(C.oneWireBootRegisterMatches(w,0x7C04,6,{startupAccess:true,psscRecovery:true}),false);
});
test('calibration-only image still reveals a missing AODO plan',()=>{
 const orig=originalNvm();
 const fit=C.fit(firstTwo,{pmin:0,pmax:100,outputLimit:32000});
 const image=C.configFrom(orig,fit,0x800);
 assert.equal(C.analogOutputStatus(image.after,0.5,4.5,5,32000).ok,false);
});
test('excess gain similar to 0.25 V/4.75 V does not pass',()=>{
 const w=originalNvm();
 const cfg=plan();
 w[16]|=1<<6;
 w[57]=C.q(cfg.offset,12);
 w[58]=C.q(cfg.gain*1.125,12);
 const r=C.analogOutputStatus(w,0.5,4.5,5,32000);
 assert.equal(r.ok,false);
 assert.ok(r.actualVolts[0]<0.4);
 assert.ok(r.actualVolts[1]>4.6);
});
test('clipping cannot hide a wrong AODO gain',()=>{
 const orig=originalNvm(),cfg=plan();
 cfg.clipping={mode:'on',low:0.5,high:4.5,vdd:5};
 const correct=C.prepareOutputConfig(orig,cfg,32000);
 assert.equal(C.analogOutputStatus(correct,0.5,4.5,5,32000).ok,true);
 const bad=correct.slice();
 bad[58]=C.q(cfg.gain*1.125,12);
 assert.equal(C.analogOutputStatus(bad,0.5,4.5,5,32000).ok,false,
  'A bad AODO gain must never pass due to clipping');
});
test('non-analogue mode is not assigned analogue voltage targets',()=>{
 const w=originalNvm();
 w[16]=(w[16]&~(7<<9))|(4<<9);
 const res=C.analogOutputStatus(w,0.5,4.5,5,32000);
 assert.equal(res.checked,false);
});

test('outside-10–90%-VDD clipping uses Q0.13 limits without altering calibrated S0/S1',()=>{
 const orig=originalNvm(),cfg=plan();
 cfg.clipping={mode:'on',low:0.3,high:4.8,vdd:5};
 const words=C.prepareOutputConfig(orig,cfg,32000);
 assert.equal(!!(words[16]&(1<<7)),true);
 const lo=(words[59]<<16)>>18,hi=(words[60]<<16)>>18;
 assert.ok(lo < -6554 && hi > 6553);
 const actual=C.analogOutputStatus(words,0.5,4.5,5,32000);
 assert.equal(actual.ok,true);
 assert.ok(Math.abs(actual.actualVolts[0]-.5)<.025);
 assert.ok(Math.abs(actual.actualVolts[1]-4.5)<.025);
 assert.deepEqual(words.slice(0,16),orig.slice(0,16));
 for(const i of [17,18,19])assert.equal(words[i],orig[i]);
});
test('clipping bounds are ordered, inside VDD and representable as signed Q0.13',()=>{
 const orig=originalNvm(),cfg=plan();
 const make=(low,high,vdd=5)=>C.prepareOutputConfig(orig,{
  ...cfg,clipping:{mode:'on',low,high,vdd}
 },32000);
 for(const range of [[-.1,4.8],[.3,5.1],[4.8,.3],[.3,.3]])
  assert.throws(()=>make(...range),/Clipping/);
 assert.throws(()=>make(.3,5),/Q0.13/);
 assert.ok(make(0,4.99)[16]&(1<<7));
 assert.throws(()=>make(.3,4.8,2.6),/Clipping/);
});

function recoveryNvm(){
 // 1-Wire is available through a finite startup window and PSSC Magic Cookie,
 // but normal permanent PLC/upstream access is not enabled in the original NVM.
 const words=originalNvm();
 words[17]=0;
 words[18]=0;
 words[19]=1<<11; // downstream only
 words[22]=0x0880; // existing AODO mode/config must NOT change on recovery
 words[63]=C.crc16(words);
 return words;
}
test('Magic Cookie recovery: 3-point TK0 and explicit 0.5-4.5 V AODO can share a protected NVM image',()=>{
 const before=recoveryNvm();
 assert.equal(C.oneWireStartupStatus(before).ok,true);
 assert.equal(C.oneWireStartupStatus(before).requiresCookie,true);
 const fit=C.fit(fullFour.slice(0,3),{pmin:0,pmax:100,outputLimit:32000,orderS:1,orderT:1,fitMode:'tk0'});
 const image=C.configFrom(before,fit,0x800,{output:plan()});
 const diff=C.validateRecoveryCalibrationDiff(before,image.after,{allowAnalogScaling:true});
 assert.equal(diff.outputChanged,true);
 assert.ok(image.changes.some(c=>c.index===58),'AODO gain must be part of the NVM diff');
 assert.ok(image.changes.some(c=>c.index>=35&&c.index<=54),'DSP coefficients must be part of the same image');
 assert.equal(image.after[22],before[22]);
 assert.equal(image.after[17],before[17]);
 assert.equal(image.after[18],before[18]);
 assert.equal(image.after[19],before[19]);
 assert.equal(image.after[63],C.crc16(image.after));
 assert.equal(C.analogOutputStatus(image.after,.5,4.5,5,32000).ok,true);
 assert.throws(()=>C.validateRecoveryCalibrationDiff(before,image.after),/AODO nur mit NVM-Freigabe/);
});
test('Magic Cookie recovery: ordinary calibration-only image stays permitted',()=>{
 const before=recoveryNvm();
 const fit=C.fit(fullFour.slice(0,3),{pmin:0,pmax:100,outputLimit:32000,orderS:1,orderT:1,fitMode:'tk0'});
 const image=C.configFrom(before,fit,0x800);
 assert.equal(C.validateRecoveryCalibrationDiff(before,image.after).outputChanged,false);
 assert.equal(C.analogOutputStatus(image.after,.5,4.5,5,32000).ok,false);
});
test('Magic Cookie recovery: never change AODO mode, CFG_AODO or communication bits',()=>{
 const before=recoveryNvm();
 const fit=C.fit(firstTwo,{pmin:0,pmax:100,outputLimit:32000,orderS:1,orderT:0});
 const image=C.configFrom(before,fit,0x800,{output:plan()});
 const copy=()=>image.after.slice();
 const mode=copy();mode[16]^=1<<9;
 assert.throws(()=>C.validateRecoveryCalibrationDiff(before,mode,{allowAnalogScaling:true}),/AODO-Modus/);
 const cfg=copy();cfg[22]^=1;
 assert.throws(()=>C.validateRecoveryCalibrationDiff(before,cfg,{allowAnalogScaling:true}),/CFG_AODO|nur Kalibrierdaten/);
 const boot=copy();boot[17]^=4;
 assert.throws(()=>C.validateRecoveryCalibrationDiff(before,boot,{allowAnalogScaling:true}),/nur Kalibrierdaten/);
 const factory=copy();factory[0]^=1;
 assert.throws(()=>C.validateRecoveryCalibrationDiff(before,factory,{allowAnalogScaling:true}),/nur Kalibrierdaten/);
 const malformed=copy().slice(0,63);
 assert.throws(()=>C.validateRecoveryCalibrationDiff(before,malformed,{allowAnalogScaling:true}),/64-Wort/);
});
test('Magic Cookie recovery: analog target is still checked, clipping cannot disguise wrong gain',()=>{
 const before=recoveryNvm(),fit=C.fit(firstTwo,{pmin:0,pmax:100,outputLimit:32000});
 const image=C.configFrom(before,fit,0x800,{output:plan()});
 const wrong=image.after.slice();
 wrong[58]=C.q(plan().gain*1.125,12);
 wrong[63]=C.crc16(wrong);
 assert.equal(C.validateRecoveryCalibrationDiff(before,wrong,{allowAnalogScaling:true}).outputChanged,true);
 assert.equal(C.analogOutputStatus(wrong,.5,4.5,5,32000).ok,false);
});
test('NVM workflow requires explicitly staged AODO and validates SSP3 authorization after RAM recovery',()=>{
 const fs=require('node:fs');
 const src=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
 assert.match(src,/const explicitOutputPlan=st\.expertOutputPlan/);
 assert.match(src,/const autoStageAnalog=!recovery/);
 assert.match(src,/st\.adapterKind!=='ssp3'\|\|\(!psscRecoveryProven\(\)&&!liveCalibration\)/);
 assert.match(src,/image\.recoveryCombined=recoveryCombined/);
 assert.match(src,/CAL\.validateRecoveryCalibrationDiff\(initial,modified/);
 assert.match(src,/!!st\.calImage\?\.recoveryCombined/);
 assert.match(src,/Original-NVM-Backup|automatisches Original-NVM-Backup/);
});

test('Live NVM recheck is a read-only same-session operation without power cycle',()=>{
 const fs=require('node:fs');
 const path=require('node:path');
 const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const guided=fs.readFileSync(path.join(__dirname,'../guided.js'),'utf8');
 const compact=fs.readFileSync(path.join(__dirname,'../compact.js'),'utf8');
 const start=app.indexOf('async function recheckNvmWithoutRestart(){');
 const end=app.indexOf('async function nvmProgram(){',start);
 assert.ok(start>0&&end>start,'recheck must have its own isolated handler');
 const routine=app.slice(start,end);
 assert.match(routine,/await nvmScan\(\{preview:true\}\)/,'re-reads full protected NVM via existing read-only method');
 assert.match(routine,/await prepareNvmOperation\(\)/,'re-creates the original NVM safety plan');
 assert.match(routine,/await verifyRam\('Vor NVM-Lesung'\)/);
 assert.match(routine,/await verifyRam\('Nach NVM-Lesung'\)/);
 assert.match(routine,/st\.port!==currentPort\|\|st\.sessionIndex!==currentSession\|\|st\.uid\?\.hex!==currentUid/);
 assert.match(routine,/st\.calImage=null/,'failed check must invalidate old NVM plan');
 assert.doesNotMatch(routine,/await exchange\(['\"]PWR_|await testSsp3PowerStartup\(|reinitializeSensor\(|erasePoints\(|await maintWrite\(|applyCalRam\(/);
 assert.doesNotMatch(routine,/st\.calpoints\s*=|st\.calfit\s*=|st\.points\s*=/);
 assert.match(app,/\$\('nvmRecheck'\)\.addEventListener\('click',recheckNvmWithoutRestart\)/);
 for(const id of ['nvmRecheck','nvmRecheckMsg','nvmRecheckHint','nvmRecheckActions'])
  assert.ok(html.includes('id="'+id+'"'),id+' must be present');
 assert.ok(guided.includes("'nvmRecheckActions','nvmRecheckHint','nvmRecheckMsg'"));
 assert.ok(compact.includes("'nvmRecheckActions','nvmRecheckHint'"));
 assert.ok(compact.includes("moveId('nvmRecheckMsg','cpNvmStatus')"));
});

test('fit distinguishes missing ADC samples from numeric zero and the signed minimum',()=>{
 const options={pmin:0,pmax:100,outputLimit:16000};
 for(const missing of [null,undefined,'']){
  assert.throws(()=>C.fit(points([[missing,1000,0,25],[24000,1000,100,25]]),options),/Ungültiger Messpunkt/);
 }
 const result=C.fit(points([[-32768,1000,0,25],[0,1000,100,25]]),options);
 assert.equal(result.stats.rangeDigits,32768);
});

test('a smaller pressure span can fit a reduced DSP target within Q3.12',()=>{
 const result=C.fit(points([[-3000,1000,0,25],[3000,1000,100,25]]),{
  pmin:0,pmax:100,outputLimit:16000
 });
 assert.equal(result.registers.sf,32767);
 assert.ok(result.stats.maxDigits<1);
});

test('I²C NVM accepts strapped and fixed startup modes and protects communication words', () => {
 const words=originalNvm();
 words[17]=0x7C03;
 words[18]=1<<14; // NCS/SA0 overrides the stored interface selection.
 words[19]=0; // One-Wire unavailable.
 assert.equal(C.i2cBootRegisterMatches(words,0x7C01),true);
 assert.equal(C.i2cBootRegisterMatches(words,0x7C02),false);
 assert.equal(C.i2cBootRegisterMatches(words,0x6C01),false);
 assert.throws(()=>C.protectStartupCommunication(words,words),/1-Wire/);
 const after=words.slice();
 after[33]=0x1234;
 assert.equal(C.protectStartupCommunication(words,after,{interfaceMode:'i2c'}),true);
 after[17]=0x6C03;
 assert.throws(()=>C.protectStartupCommunication(words,after,{interfaceMode:'i2c'}),/verändert/);
 words[18]=3<<14;
 words[17]=0x6C02;
 assert.equal(C.i2cBootRegisterMatches(words,0x6C02),true);
 assert.equal(C.i2cBootRegisterMatches(words,0x6C01),false);
 words[18]=2<<14;
 assert.equal(C.i2cBootRegisterMatches(words,0x6C02),false);
});


test('Bridge inversion persists in the calibrated NVM and preserves unrelated bits',()=>{
 const P=require('../app.js'), CFG=require('../config.js');
 const orig=originalNvm();orig[28]=0xE800;orig[63]=C.crc16(orig);
 const normal=P.encAFE(orig[28],{pga1:0,pga2:0,offset:0,bridgeInvert:0});
 const inverted=P.encAFE(normal,{pga1:0,pga2:0,offset:0,bridgeInvert:1});
 assert.equal(normal^inverted,0x1000);
 assert.equal(inverted&0xE800,orig[28]&0xE800);
 assert.equal(P.decAFE(inverted).bridgeInvert,1);
 assert.equal(P.encAFE(inverted,{pga1:0,pga2:0,offset:1})&0x1000,0x1000);
 assert.throws(()=>P.encAFE(inverted,{pga1:0,pga2:0,offset:1,bridgeInvert:2}));
 for(const word of [normal,inverted]){
  const samples=word&0x1000?firstTwo.map(p=>({...p,adc_s:-p.adc_s})):firstTwo;
  const fit=C.fit(samples,{pmin:0,pmax:100,outputLimit:32000,orderS:1,orderT:0});
  assert.ok(fit.stats.maxDigits<5);
  const result=C.configFrom(orig,fit,word,{output:plan()});
  assert.equal(result.after[28],word);
  assert.equal(result.after[63],C.crc16(result.after));
  const profile=CFG.createSelective({label:'AFE',afe:P.decAFE(word)},['afe'],C);
  assert.equal(CFG.validate(JSON.parse(JSON.stringify(profile)),C).afe.bridgeInvert,(word>>12)&1);
  assert.throws(()=>CFG.validate({...profile,afe:{...profile.afe,bridgeInvert:2}},C));
 }
 const old=CFG.createSelective({label:'Alt',afe:{pga1:0,pga2:0,offset:0}},['afe'],C);
 assert.equal(old.afe.bridgeInvert,undefined);
});


test('Bridge polarity has a two-column shared AFE control and reflects only confirmed RAM',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
 const html=read('index.html'),app=read('app.js'),guide=read('guided.js');
 const control=html.match(/<div class="afe-polarity-control"[^>]*>[\s\S]*?<\/div>/)?.[0];
 assert.ok(control);assert.match(control,/id="bridgePolarityNormal"/);assert.match(control,/id="bridgePolarityInverted"/);
 assert.doesNotMatch(control,/afe-stepper|bridgePolarityToggle/);
 assert.match(html,/\.afe-polarity-control\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(guide,/move\(stepper,'gwAFEPanel'\)/);
 const source=app.split(' function renderAFEStepperState(){')[1].split(' function stepAFE(')[0];
 const render=new Function('st','$','function renderAFEStepperState(){'+source+'renderAFEStepperState();');
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{setAttribute(k,v){this[k]=v}});return elements.get(id)};
 const state={chip:true,port:{},afe:0x1800,staged:{pga1:0,pga2:0,offset:0,bridgeInvert:0}};
 render(state,get);assert.equal(get('bridgePolarityInverted')['aria-pressed'],'true');
 assert.equal(get('bridgePolarityNormal')['aria-pressed'],'false');assert.equal(get('bridgePolarityInverted').disabled,false);
 state.writing=true;render(state,get);assert.equal(get('bridgePolarityInverted').disabled,true);
 state.writing=false;state.afe=0x0800;render(state,get);assert.equal(get('bridgePolarityNormal')['aria-pressed'],'true');
 state.chip=false;render(state,get);assert.equal(get('bridgePolarityNormal')['aria-pressed'],'false');assert.equal(get('bridgePolarityInverted').disabled,true);
});


test('live temperature: internal nominal curve, per-UID single-point reference and factory preference',()=>{
 const app=require('node:fs').readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
 const start=app.indexOf(' function temperatureStorageKey('),end=app.indexOf(' const GAINS1=',start);
 assert.ok(start>=0&&end>start);
 const h=new Function('const demoEnabled=false;'+app.slice(start,end)+';return {nominalInternalCelsius,internalReference,validInternalReference,estimateInternalTemperature,temperatureStorageKey}')();
 const uid='0020018B39FA',other='0020018B39FB',afe2=0x1154;
 const p={temperatureUid:uid,temperatureSource:'internal',temperatureAfe2:afe2,temperature:25,adc_t:4483};
 const ref=h.internalReference([p],uid,afe2);
 assert.ok(ref);
 assert.equal(h.estimateInternalTemperature(4483,ref,false).value,25);
 assert.equal(h.estimateInternalTemperature(4483,ref,false).mode,'reference');
 assert.ok(h.estimateInternalTemperature(4000,ref,false).value>25);
 assert.ok(h.estimateInternalTemperature(5000,ref,false).value<25);
 assert.equal(h.estimateInternalTemperature(4483,null,false).mode,'nominal');
 const factory={0x6C:0,0x6E:0x1000,0x94:0x0F4D,0x96:0xBC8E,0x98:0xFC54,0x9A:0};
 assert.ok(Math.abs(h.nominalInternalCelsius(4483)-C.factoryInternalTemperatureCelsius(4483,factory))<1e-8);
 const closeRef={...ref,temperature:h.nominalInternalCelsius(4483)+1};
 assert.equal(h.estimateInternalTemperature(4483,closeRef,true).mode,'factory');
 assert.equal(h.estimateInternalTemperature(4483,ref,true).mode,'reference');
 assert.equal(h.estimateInternalTemperature(-32768,ref,false).value,null);
 assert.equal(h.estimateInternalTemperature(32767,ref,false).value,null);
 assert.equal(h.estimateInternalTemperature(null,ref,false).value,null);
 assert.equal(h.internalReference([p],other,afe2),null);
 assert.equal(h.internalReference([p],uid,afe2|2),null);
 assert.equal(h.internalReference([p,{...p,temperature:75}],uid,afe2),null);
 assert.equal(h.validInternalReference(ref,other,afe2),false);
 assert.equal(h.validInternalReference(ref,uid,afe2+4),false);
 assert.notEqual(h.temperatureStorageKey('profile',uid),h.temperatureStorageKey('profile',other));
 assert.match(app,/writeTemperatureRecord\('profile',id,temperatureRecord\)/);
 assert.match(app,/writeTemperatureRecord\('reference',id,reference\)/);
});
