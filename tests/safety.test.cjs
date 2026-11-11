'use strict';
// Software regression tests. Run: node --test tests/safety.test.cjs
// A real E703.11 power-cycle/1-Wire test is still required.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const CAL=require('../calibration.js');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const safeNvm=()=>{
 const words=Array(64).fill(0);
 words[16]=1<<9;                         // AODO analog; valid 1-Wire mode
 words[17]=1<<2;                         // CFG_SPI_I2C.plc_en, permanent PLC
 words[18]=2<<12;                        // CFG_PADS0.startup_plc 200 ms
 words[19]=(1<<11)|(1<<8)|(1<<7);        // downstream, persistent R/W, upstream
 return words;
};
test('Communication/boot/factory words cannot be modified',()=>{
 for(const index of [0,1,15,17,18,19,20,21,23,27]){
  const before=safeNvm(),after=before.slice();after[index]=1;
  assert.throws(()=>CAL.protectStartupCommunication(before,after),/1-Wire-Startschutz/);
 }
});
test('Other CFG_EN bits cannot change',()=>{
 const before=safeNvm(),after=before.slice();after[16]=1;
 assert.throws(()=>CAL.protectStartupCommunication(before,after),/1-Wire-Startschutz/);
});
test('Only AODO settings may change inside boot area',()=>{
 const before=safeNvm(),after=before.slice();after[16]=(1<<9)|(1<<6);after[22]=16384;
 assert.equal(CAL.protectStartupCommunication(before,after),true);
});
test('AODO mode preparation preserves communication',()=>{
 const before=safeNvm(),after=CAL.prepareOutputConfig(before,{mode:'1',scaleEnabled:true,gain:0.7,offset:0,pwmPeriod:16384},30000);
 assert.notEqual(after[16],before[16]);
 for(let i=0;i<28;i++)if(i!==16&&i!==22)assert.equal(after[i],before[i]);
});
test('Seven steps and separate output section',()=>{
 const html=read('index.html');
 const panels=Array.from(html.matchAll(/<section[^>]*data-panel="([0-9]+)"/g),m=>Number(m[1]));
 const steps=Array.from(html.matchAll(/<button class="stepBtn[^"]*" data-step="([0-9]+)"/g),m=>Number(m[1]));
 assert.deepEqual(panels,[0,1,2,3,4,5,6]);
 assert.deepEqual(steps,[0,1,2,3,4,5,6]);
 assert.equal(html.split('id="expertOutputMode"').length-1,1);
 const output=html.split('data-panel="5" hidden>')[1].split('data-panel="6" hidden>')[0];
 assert.ok(output.includes('id="expertOutputMode"'));
 assert.ok(output.includes('id="outputNvmRead"'));
 assert.ok(output.includes('id="expertScaleGain"'));
});
test('NVM write path requires one-wire + preservation check',()=>{
 const src=read('app.js');
 assert.ok(src.includes("st.iface!=='plc')throw Error('1-Wire-Startschutz"));
 assert.ok(src.includes('CAL.protectStartupCommunication(initial,modified)'));
});

test('PSSC S0/S1 quantization stays inside analog range',()=>{
 const result=CAL.analogScaling(0.5,4.5,5,32000);
 assert.ok(result.gain>0);
 assert.ok(result.outputDigits[0]>=-26214);
 assert.ok(result.outputDigits[1]<=26214);
 assert.ok(Math.abs(result.actualVolts[0]-0.5)<0.005);
 assert.ok(Math.abs(result.actualVolts[1]-4.5)<0.005);
 const before=safeNvm();
 const after=CAL.prepareOutputConfig(before,{mode:'1',...result,pwmPeriod:16384},32000);
 for(let i=0;i<28;i++)if(i!==16&&i!==22)assert.equal(after[i],before[i]);
});
test('PSSC scaling rejects out-of-range voltages',()=>{
 for(const values of [[0,5,5,32000],[4.5,0.5,5,32000],[0.5,4.5,12,32000],[0.5,4.5,5,33000]]){
  assert.throws(()=>CAL.analogScaling(...values));
 }
});
test('PSSC UI separates supported and unsupported output modes',()=>{
 const html=read('index.html');
 for(const token of ['Digital Interface','AODO pin','Scaling','Limiting','Error Signaling','Error Values'])assert.ok(html.includes(token));
 assert.ok(html.includes('Analog Ratiometric 0..5 V'));
 assert.ok(html.includes('Analog Absolute 0..10 V · nicht E703.11'));
 assert.ok(html.includes('value="abs10" disabled'));
 assert.ok(html.includes('value="loop420" disabled'));
 assert.ok(html.includes('value="onewire"'));
 assert.ok(!html.includes('value="onewire" disabled'));
 assert.equal(html.split('id="expertScaleGain"').length-1,1);
 assert.equal(html.split('id="expertScaleOffset"').length-1,1);
});
test('Output edits invalidate the previously prepared NVM plan',()=>{
 const src=read('expert.js');
 assert.ok(src.includes('st.calImage=null;st.restorePlan=null;st.outputOnlyPlan=null;st.expertOutputPlan=null;'));
 assert.ok(src.includes('function calculateAnalogScaling()'));
 assert.ok(src.includes("const result=CAL.analogScaling("));
});

test('Scaling at 25k uses different gain than scaling at 32k',()=>{
 const a=CAL.analogScaling(0.5,4.5,5,25000),b=CAL.analogScaling(0.5,4.5,5,32000);
 assert.ok(a.gain>b.gain);
 assert.ok(Math.abs(a.gain-1.04834)<0.001);
 for(const candidate of [a,b]){
  assert.ok(Math.abs(candidate.actualVolts[0]-0.5)<0.005);
  assert.ok(Math.abs(candidate.actualVolts[1]-4.5)<0.005);
 }
});
test('Scaling UI shows automatically chosen DSP range and ADC distinction',()=>{
 const html=read('index.html'),expert=read('expert.js'),app=read('app.js');
 assert.ok(html.includes('id="psscScalingSource"'));
 assert.ok(expert.includes("st.calfit.outputLimit"));
 assert.ok(expert.includes("$('calDspLimit').dataset.userEdited"));
 assert.ok(expert.includes("$('dspDisplayLimit').value"));
 assert.ok(app.includes("$('calDspLimit').dataset.userEdited='1'"));
});

test('Datasheet 6.4.5.7: 1-Wire startup prerequisites are mandatory',()=>{
 const valid=safeNvm();
 assert.equal(CAL.oneWireStartupStatus(valid).ok,true);
 for(const change of [
  w=>{w[16]=0},                       // high-Z
  w=>{w[16]=6<<9},                    // ALARM
  w=>{w[17]=0;w[18]=3<<12},          // no PLC / no startup window
  w=>{w[19]&=~(1<<11)},              // downstream disabled
  w=>{w[19]&=~(1<<8)},               // write/read only via magic cookie
  w=>{w[19]&=~(1<<7)}                // no upstream
 ]){
  const broken=valid.slice();change(broken);
  assert.equal(CAL.oneWireStartupStatus(broken).ok,false);
  assert.throws(()=>CAL.protectStartupCommunication(broken,broken.slice()),/1-Wire-Startschutz/);
 }
});
test('Datasheet: do not allow AODO High-Z or ALARM programming',()=>{
 const before=safeNvm();
 for(const mode of ['0','6']){
  assert.throws(()=>CAL.prepareOutputConfig(before,{mode,scaleEnabled:false,gain:0,offset:0,pwmPeriod:16384},25000),/1-Wire-Startschutz/);
 }
});
test('5V standard target 0.5 to 4.5 V stays independent of chip readback',()=>{
 const html=read('index.html'),expert=read('expert.js');
 assert.match(html,/id="psscS0"[^>]*value="0.5"/);
 assert.match(html,/id="psscS1"[^>]*value="4.5"/);
 assert.ok(html.includes('id="psscCurrentOutputStatus"'));
 assert.ok(html.includes('id="psscDefaultScaling"'));
 const identify=expert.split('async function identify(){')[1].split('function save(words')[0];
 assert.ok(identify.includes('refreshOutputReadOnly()'));
 assert.ok(!identify.includes("$('psscS0').value="));
 assert.ok(!identify.includes("$('psscS1').value="));
});

test('One Wire only: permanently active PLC is selectable without NVM changes',()=>{
 const before=safeNvm();
 const info=CAL.oneWireOnlyStatus(before);
 assert.equal(info.ok,true);
 assert.equal(info.permanent,true);
 const after=CAL.prepareOutputConfig(before,{mode:'onewire',scaleEnabled:false,gain:0,offset:0,pwmPeriod:16384},25000);
 assert.deepEqual(after,before);
});
test('One Wire only: boot timing window cannot masquerade as permanent PLC',()=>{
 const before=safeNvm();before[17]&=~4;before[18]=2<<12;
 assert.equal(CAL.oneWireStartupStatus(before).ok,true);
 const oneWireOnly=CAL.oneWireOnlyStatus(before);
 assert.equal(oneWireOnly.ok,false);
 assert.throws(()=>CAL.prepareOutputConfig(before,{mode:'onewire',scaleEnabled:false},25000),/One Wire only nicht verfügbar/);
});
test('One Wire only: read-only status and protected mode selection in UI',()=>{
 const html=read('index.html'),src=read('expert.js');
 assert.ok(html.includes('id="psscOneWireOnlyStatus"'));
 assert.ok(html.includes('id="psscScalingSection"'));
 assert.ok(src.includes('CAL.oneWireOnlyStatus(st.nvmBackup)'));
 assert.ok(src.includes('st.expertOutputPlan={mode:\'onewire\'}'));
 assert.ok(src.includes("$('psscScalingSection').hidden=mode==='onewire'"));
});
