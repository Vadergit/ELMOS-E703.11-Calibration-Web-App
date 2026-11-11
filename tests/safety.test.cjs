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
test('Seven calibration steps plus an independent EEPROM viewer',()=>{
 const html=read('index.html');
 const panels=Array.from(html.matchAll(/<section[^>]*data-panel="([0-9]+)"/g),m=>Number(m[1]));
 const steps=Array.from(html.matchAll(/<button class="stepBtn[^"]*" data-step="([0-9]+)"/g),m=>Number(m[1]));
 assert.deepEqual(panels,[0,1,2,3,4,5,6,7]);
 assert.deepEqual(steps,[0,1,2,3,4,5,6,7]);
 assert.equal(html.split('id="expertOutputMode"').length-1,1);
 const output=html.split('data-panel="5" hidden>')[1].split('data-panel="6" hidden>')[0];
 assert.ok(output.includes('id="expertOutputMode"'));
 assert.ok(output.includes('id="outputNvmRead"'));
 assert.ok(output.includes('id="expertScaleGain"'));
 const viewer=html.split('data-panel="7" hidden>')[1].split('</section>')[0];
 assert.ok(viewer.includes('id="eepromRead"'));
 assert.ok(viewer.includes('id="eepromRows"'));
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

test('Expert mode shows contextual settings and no modal',()=>{
 const html=read('index.html'),src=read('expert.js');
 for(const id of ['expertToolsDetails','expertNvmDump','expertRegistersRead','expertMode','expertPanel']){
  assert.equal(html.split('id="'+id+'"').length-1,1);
 }
 assert.ok(!html.includes('id="expertWorkspace"'));
 assert.ok(!html.includes('id="expertWorkspaceOpen"'));
 assert.ok(!src.includes('showExpertWorkspace('));
 assert.ok(src.includes("document.querySelectorAll('[data-expert-area]')"));
 assert.ok(html.includes('aria-labelledby="digitalTitle" data-expert-area hidden'));
 assert.ok(html.includes('aria-labelledby="limitingTitle" data-expert-area hidden'));
 assert.ok(html.includes('data-expert-area hidden><summary>Erweitert · AODO_F'));
 assert.ok(src.includes("classList.toggle('is-expert',enabled)"));
 const scripts=Array.from(html.matchAll(/<script src="([^"]+)"/g),m=>m[1]);
 assert.deepEqual(scripts,['calibration.js?v=0.6.7','eeprom-help.js?v=0.6.7','expert.js?v=0.6.7','config.js?v=0.6.7','guided-plan.js?v=0.6.7','demo.js?v=0.6.7','app.js?v=0.6.7','compact.js?v=0.6.7','guided.js?v=0.6.7']);
});

test('Failed E703.11 probe reconnects SSP3 at most once, without NVM writes',()=>{
 const src=read('app.js');
 const connect=src.split('async function connect(port,retryChipOnce=true){')[1]?.split('async function disconnect()')[0];
 assert.ok(connect);
 assert.ok(connect.includes('await firmware();'));
 assert.ok(connect.includes('await selectChipInterface();'));
 assert.ok(connect.includes('await detect();'));
 assert.ok(connect.includes("if(retryChipOnce&&st.adapterKind==='ssp3'){"));
 assert.ok(connect.includes('if(!await disconnect())return;'));
 assert.ok(connect.includes('await sleep(200);'));
 assert.ok(connect.includes('await connect(port,false);'));
 assert.ok(connect.includes('Keine weiteren Versuche.'));
 assert.ok(!connect.includes('writeReg('));
 assert.ok(!connect.includes('nvmWrite('));
});

test('EEPROM viewer reads only via the established CRC-tested NVM path',()=>{
 const html=read('index.html'),app=read('app.js'),expert=read('expert.js');
 assert.ok(html.includes('id="eepromSearch"'));
 assert.ok(html.includes('id="eepromExport"'));
 assert.ok(app.includes("if(n===7)return ''"));
 assert.ok(app.includes('expert.refreshEEPROMViewer()'));
 assert.ok(expert.includes('async function readNvm()'));
 assert.ok(expert.includes('await nvmScan({expertRead:true})'));
 assert.ok(expert.includes('for(let i=0;i<64;i++)'));
 assert.ok(!expert.includes('eepromWrite'));
});

const EEPROM_HELP=require('../eeprom-help.js');
test('Every EEPROM word has a safe description and distinct word/byte address',()=>{
 const words=Array.from({length:64},(_,i)=>EEPROM_HELP.describe(i,0));
 assert.equal(words.length,64);
 for(let i=0;i<64;i++){
  const w=words[i];
  assert.equal(w.index,i);
  assert.equal(parseInt(w.wordHex.slice(2),16),i);
  assert.equal(parseInt(w.byteHex.slice(2),16),i*2);
  assert.ok(w.name&&w.short&&w.description);
  assert.ok(w.protection);
 }
 assert.equal(words[35].name,'S0');
 assert.equal(words[50].name,'S15');
 assert.equal(words[51].name,'T0');
 assert.equal(words[58].name,'AODO_F');
 assert.equal(words[58].ramHex,'0xA2');
 assert.equal(words[58].byteHex,'0x74');
 assert.equal(words[35].ramHex,'0x74');
 assert.equal(words[35].byteHex,'0x46');
 assert.equal(words[23].ramHex,null);
});
test('EEPROM fixed-point conversion, signed values, search and documented bit decoding',()=>{
 assert.equal(EEPROM_HELP.describe(58,0x1000).interpreted,'1.0000000');
 assert.equal(EEPROM_HELP.describe(57,0xF000).interpreted,'-1.0000000');
 assert.equal(EEPROM_HELP.describe(35,0x4000).interpreted,'0.5000000');
 assert.equal(EEPROM_HELP.describe(55,0xFFFF).interpreted,null);
 assert.equal(EEPROM_HELP.describe(17,4).fields[0].meaning,'1-Wire dauerhaft aktiviert');
 assert.equal(EEPROM_HELP.describe(18,2<<12).fields[0].meaning,'200 ms');
 assert.equal(EEPROM_HELP.describe(28,0x0800).fields.length,4);
 assert.ok(EEPROM_HELP.describe(28,0x0800).search.includes('offset'));
 assert.ok(EEPROM_HELP.describe(35,0).search.includes('druckkalibrierung'));
 assert.throws(()=>EEPROM_HELP.describe(64,0));
 assert.throws(()=>EEPROM_HELP.describe(2,-1));
});
test('EEPROM explanations remain read-only, chip verified and contextual',()=>{
 const html=read('index.html'),expert=read('expert.js'),helper=read('eeprom-help.js');
 assert.ok(html.includes('id="eepromTableScroll"'));
 assert.ok(html.includes('<th>Funktion</th><th>Schutz</th>'));
 assert.ok(html.includes('colspan="6"'));
 assert.ok(expert.includes('ELMOS_EEPROM_HELP.describe(i,value)'));
 assert.ok(expert.includes('st.uid.ser0===st.nvmBackup[0]'));
 assert.ok(expert.includes('st.uid.ser1===st.nvmBackup[1]'));
 assert.ok(expert.includes('word.search.includes(filter)'));
 assert.ok(expert.includes("expertDetails=$('expertMode').checked"));
 assert.ok(expert.includes('expandedEEPROM.clear()'));
 assert.ok(!helper.includes('writeReg('));
 assert.ok(!helper.includes('maintWrite('));
 assert.ok(!helper.includes('nvmWrite('));
});


test('Compact one-pager is opt-in and leaves normal seven-step interface intact',()=>{
 const html=read('index.html'),src=read('compact.js');
 assert.ok(html.includes('id="compactMode" type="checkbox"'));
 assert.ok(html.includes('id="compactWorkspace" hidden'));
 assert.ok(html.includes('html.compact-mode .content{display:none!important}'));
 assert.ok(html.includes('.cp-board{'));
 assert.ok(html.includes('.cp-output{grid-column:span 2}'));
 assert.ok(src.includes("storage().getItem(STORAGE_KEY)==='1'"));
 assert.ok(src.includes("checkbox.addEventListener('change',()=>set(checkbox.checked))"));
 assert.ok(src.includes("document.documentElement.classList.add('compact-mode')"));
 assert.ok(src.includes("document.documentElement.classList.remove('compact-mode')"));
 assert.ok(src.includes('placeholder.parentNode.replaceChild(node,placeholder)'));
 assert.ok(!src.includes('cloneNode('));
 assert.ok(!src.includes('innerHTML=original'));
 assert.ok(!html.includes('id="compactMode" type="checkbox" checked'));
});
test('Compact workspace covers all calibration steps with existing original controls',()=>{
 const src=read('compact.js');
 for(const id of [
  'choose','auto','disconnect','iface','baud','pga1Down','offsetUp','pga2Down',
  'configFile','configApply','calPointCount','calSampleCount','pmin','pmax',
  'calSOrder','calTOrder','calDspLimit','calCalculate','calApplyRam',
  'calVerifyCount','calVerifyPressure','calVerifyTolerance','calVerifyTemperature','calVerifyRam',
  'expertOutputMode','expertScaleEnable','psscVdd','psscS0','psscS1','expertOutputStage',
  'nvmPrepare','nvmAutoBackup','nvmConfirmId','nvmProgram'
 ]){
  // AFE buttons remain inside the moved stepper; all others are moved by their IDs.
  if(['pga1Down','offsetUp','pga2Down'].includes(id))
   assert.ok(src.includes("moveSelector('.afe-step-panel','cpAfeSteps')"));
  else if(id==='calVerifyRam'||id==='expertOutputMode'||id==='nvmProgram')
   assert.ok(src.includes("'"+id+"'"));
  else assert.ok(src.includes("'"+id+"'")||src.includes(''+id));
 }
 assert.ok(src.includes("'calExtra'+i+'Row'"));
 assert.ok(src.includes("pointSelection='lo'"));
 assert.ok(src.includes('cpPointSelect'));
 assert.ok(src.includes("actions(['nvmProgram'],'cpNvmProgram')"));
});
test('Compact mode does not alter NVM safety or bypass original handlers',()=>{
 const compact=read('compact.js'),app=read('app.js');
 assert.ok(compact.includes('node.parentNode.replaceChild(placeholder,node)'));
 assert.ok(!compact.includes('nvmScan('));
 assert.ok(!compact.includes('nvmProgram('));
 assert.ok(!compact.includes('maintWrite('));
 assert.ok(!compact.includes('writeReg('));
 assert.ok(!compact.includes("removeAttribute('disabled')"));
 assert.ok(app.includes("else if(!recognizedUid||st.uid.ser0!==st.nvmBackup[0]"));
 assert.ok(app.includes("const approvalGranted=nvmReason===''"));
 assert.ok(app.includes("$('nvmProgram').disabled=!approvalGranted"));
});

const CFG=require('../config.js');
const example=()=>CFG.create({
 label:'Druck 0-10 bar',afe:{pga1:1,pga2:3,offset:-2},
 calibration:{sOrder:1,tOrder:0,dspLimit:25000,pointCount:2,samples:12,
  reference:{min:0,max:10,unit:'bar',customUnit:''}},
 output:{mode:'1',scaleEnabled:true,vdd:5,s0:0.5,s1:4.5,gain:0,offset:0,pwmPeriod:16384}
},CAL);
test('Config roundtrip contains only sensor-independent target values',()=>{
 const profile=example(),round=CFG.validate(JSON.parse(JSON.stringify(profile)),CAL);
 assert.equal(round.afe.pga1,1);
 assert.equal(round.afe.offset,-2);
 assert.equal(round.calibration.dspLimit,25000);
 assert.equal(round.output.mode,'1');
 assert.ok(round.output.gain>1);
 const txt=JSON.stringify(round);
 for(const term of ['nvmBackup','words','uid','SER0','SER1','coeffs','calfit','CRC16','boot'])assert.ok(!txt.includes('"'+term+'"'));
});
test('Config importer rejects NVM backups, foreign keys and unsafe modes',()=>{
 const p=example();
 assert.throws(()=>CFG.validate({format:'E70311-CM64-v2',uid:'000011112222',words:Array(64).fill(0)},CAL));
 assert.throws(()=>CFG.validate({...p,uid:'000011112222'},CAL),/unerlaubtes Feld/);
 assert.throws(()=>CFG.validate({...p,output:{...p.output,mode:'6'}},CAL),/nicht unterstützt/);
 assert.throws(()=>CFG.validate({...p,afe:{...p.afe,pga1:10}},CAL),/ungültiger Wert/);
 assert.throws(()=>CFG.validate({...p,output:{...p.output,s0:0.0,s1:4.5}},CAL));
});
test('Profile only stages AFE, never automatically writes hardware or EEPROM',()=>{
 const app=read('app.js');
 assert.ok(app.includes('st.profilePendingAFE={...selectedConfig.afe}'));
 assert.ok(app.includes("$('configAfeApplyRam').addEventListener('click',async()=>"));
 assert.ok(app.includes('await commitGain({...target})'));
 assert.ok(app.includes('invalidateCalculation('));
 assert.ok(app.includes("if(st.writing||st.nvmWorking||st.calTask||st.afeWriteActive)"));
 const html=read('index.html');
 for(const id of ['configSave','configFile','configApply','configLabel','configPreview','configAfeApplyRam'])
  assert.equal(html.split('id="'+id+'"').length-1,1);
});

test('EEPROM Viewer refuses to display a backup from another chip',()=>{
 const expert=read('expert.js');
 assert.ok(expert.includes('st.uid.ser0===st.nvmBackup[0]'));
 assert.ok(expert.includes('st.uid.ser1===st.nvmBackup[1]'));
 assert.ok(expert.includes("st.mode==='usb'&&st.port&&st.chip"));
});

const GUIDED_PLAN=require('../guided-plan.js');
test('Guided matrix: 2 pressures without temperature correction',()=>{
 const p=GUIDED_PLAN.create({pCount:2,tCount:1,temperatures:[25],pmin:0,pmax:10});
 assert.equal(p.total,2);assert.equal(p.orderS,1);assert.equal(p.orderT,0);
 assert.deepEqual(p.points.map(p=>p.slot),['lo','hi']);
 assert.deepEqual(p.pressureValues,[0,10]);
});
test('Guided matrix: 2 pressure x 3 temperature full independent grid',()=>{
 const p=GUIDED_PLAN.create({pCount:2,tCount:3,temperatures:[-10,25,65],pmin:0,pmax:10});
 assert.equal(p.total,6);assert.equal(p.orderS,1);assert.equal(p.orderT,2);
 assert.deepEqual(p.points.map(p=>p.pressure),[0,10,0,10,0,10]);
 assert.deepEqual(p.points.map(p=>p.temperature),[-10,-10,25,25,65,65]);
 assert.deepEqual(p.points.map(p=>p.slot),['lo','extra1','extra2','extra3','extra4','hi']);
});
test('Guided matrix: 3 pressure x 2 temperature, and supported 10-point maximum',()=>{
 const p=GUIDED_PLAN.create({pCount:3,tCount:2,temperatures:[10,60],pmin:-1,pmax:5});
 assert.equal(p.total,6);assert.equal(p.orderS,2);assert.equal(p.orderT,1);
 assert.deepEqual(p.pressureValues,[-1,2,5]);
 const max=GUIDED_PLAN.create({pCount:5,tCount:2,temperatures:[10,60]});
 assert.equal(max.total,10);assert.equal(max.orderS,3);assert.equal(max.orderT,1);
});
test('Guided planner rejects >10, nonascending temperatures, invalid pressure and overfit',()=>{
 assert.throws(()=>GUIDED_PLAN.create({pCount:4,tCount:3,temperatures:[0,25,65]}),/höchstens 10/);
 assert.throws(()=>GUIDED_PLAN.create({pCount:2,tCount:3,temperatures:[25,15,60]}),/aufsteigend/);
 assert.throws(()=>GUIDED_PLAN.create({pCount:2,tCount:1,temperatures:[25],pmin:10,pmax:0}),/grösser/);
 assert.throws(()=>GUIDED_PLAN.create({pCount:3,tCount:1,temperatures:[25],orderS:3}),/Druckpolynom/);
 assert.throws(()=>GUIDED_PLAN.create({pCount:2,tCount:1,temperatures:[25],orderT:1}),/Temperaturpolynom/);
 assert.throws(()=>GUIDED_PLAN.create({pCount:2,tCount:2,temperatures:[10,60],samples:101}),/Samples/);
});
test('Guided view is optional and contains only one set of hardware inputs',()=>{
 const html=read('index.html'),ui=read('guided.js');
 assert.ok(html.includes('id="guidedWorkspace" hidden'));
 assert.ok(html.includes('id="workflowMode"'));
 assert.ok(html.includes('id="guidedLaunch"'));
 assert.ok(html.includes('id="guidedLaunchTop"'));
 assert.ok(html.includes('guided.css?v=0.6.7'));
 for(const id of ['nvmProgram','nvmPrepare','calApplyRam','calVerifyRam','expertOutputStage','configApply','configFile']){
  assert.equal(html.split('id="'+id+'"').length-1,1);
 }
 assert.ok(ui.includes('node.parentNode.replaceChild(marker,node)'));
 assert.ok(ui.includes('marker.parentNode.replaceChild(x.node,x.marker)'));
 assert.ok(ui.includes("moveId('nvmProgram','gwNvmWrite')"));
 assert.ok(ui.includes("moveId('calApplyRam','gwFitActions')")===false || ui.includes("'calApplyRam'"));
 assert.ok(!ui.includes('nvmProgram('));
 assert.ok(!ui.includes('maintWrite('));
 assert.ok(!ui.includes('writeReg('));
 assert.ok(ui.includes('ELMOS_GUIDED_PLAN.create('));
});
test('Guided app uses read-only status, and the original NVM protections remain',()=>{
 const app=read('app.js');
 assert.ok(app.includes('window.ELMOS_GUIDED_API=Object.freeze('));
 assert.ok(app.includes('calVerified:verificationComplete()'));
 assert.ok(app.includes("window.ELMOS_GUIDED?.onConnected?.()"));
 assert.ok(app.includes("const approvalGranted=nvmReason===''"));
 assert.ok(app.includes("$('nvmProgram').disabled=!approvalGranted"));
 assert.ok(app.includes('CAL.protectStartupCommunication(initial,modified)'));
});
test('USB bridge fails closed until a truly compatible PLC firmware is available',()=>{
 const app=read('app.js'),fw=read('firmware/usb_bridge_cdc/usb_bridge_cdc.ino');
 assert.ok(app.includes("exchange('BRIDGE_INFO',1600)"));
 assert.ok(app.includes("'PLC_READ','PLC_WRITE','NVM'"));
 assert.ok(app.includes("if(!bridgeReady)return;"));
 assert.ok(fw.includes('CAPS=CDC_ONLY'));
 assert.ok(fw.includes('PLC_NOT_IMPLEMENTED'));
 assert.ok(!fw.includes('pinMode('));
 assert.ok(!/^[ \t]*digitalWrite\s*\(/m.test(fw));
 assert.ok(!fw.includes('CAPS=PLC_READ,PLC_WRITE,NVM'));
});

test('Guided complex pressure/temperature grids remain inside existing calibration engine limits',()=>{
 const p33=GUIDED_PLAN.create({pCount:3,tCount:3,temperatures:[-10,25,65],pmin:0,pmax:16});
 const p42=GUIDED_PLAN.create({pCount:4,tCount:2,temperatures:[5,60],pmin:0,pmax:12});
 assert.equal(p33.total,9);assert.equal(p33.orderS,2);assert.equal(p33.orderT,2);
 assert.equal(p42.total,8);assert.equal(p42.orderS,3);assert.equal(p42.orderT,1);
 assert.equal(p33.points.at(-1).slot,'hi');
 assert.equal(p42.points.filter(p=>p.slot.startsWith('extra')).length,6);
});
test('Guided and compact modes restore the original controls before switching',()=>{
 const guided=read('guided.js'),compact=read('compact.js');
 assert.ok(guided.includes('isOpen:()=>mode'));
 assert.ok(compact.includes('window.ELMOS_GUIDED?.isOpen?.()'));
 assert.ok(compact.includes('window.ELMOS_GUIDED.close()'));
 assert.ok(guided.includes("ELMOS_COMPACT.set(false)"));
 assert.ok(guided.includes("const subscriptions=[]"));
 assert.ok(guided.includes("el.removeEventListener(type,handler)"));
});
test('ESP32-C3 bridge verifies capabilities and establishes PLC access before detection',()=>{
 const app=read('app.js'),fw=read('firmware/esp32c3_supermini/esp32c3_supermini.ino');
 assert.ok(app.indexOf('if(!bridgeReady)return;')<app.indexOf("await exchange('PLC_BAUD '"));
 assert.ok(app.includes("st.sensorPowerEnabled?'PLC START':'PLC ACCESS'"));
 assert.ok(fw.includes('CAPS=PLC_UID,PLC_READ,PLC_WRITE,NVM'));
 assert.ok(fw.includes('CONFIG_IDF_TARGET_ESP32C3'));
 assert.ok(fw.includes('ARDUINO_USB_CDC_ON_BOOT'));
 assert.ok(fw.includes('GPIO18/19'));
 assert.ok(fw.includes('PLC_WRITE_DENIED'));
});

test('Mathematical fit works with representative synthetic pressure-temperature grids',()=>{
 for(const [pCount,tCount,temperatures] of [[2,1,[25]],[2,3,[-10,25,65]],[3,2,[10,60]],[3,3,[-10,25,65]],[5,2,[10,60]]]){
  const p=GUIDED_PLAN.create({pCount,tCount,temperatures,pmin:0,pmax:10,outputLimit:25000});
  const points=p.points.map((v,i)=>({
   pressure:v.pressure,temperature:v.temperature,
   adc_s:Math.round(((v.pressure/10)-.5)*9000*(6/3.5)*(2.86/2)+(v.temperature-25)*11+(i%2?2:-2)),
   adc_t:Math.round((v.temperature-25)*180)
  }));
  const fit=CAL.fit(points,{pmin:0,pmax:10,orderS:p.orderS,orderT:p.orderT,outputLimit:25000});
  assert.ok(fit.stats.maxDigits<100);
  assert.ok(Number.isFinite(fit.stats.rmsDigits));
 }
});
test('Board shortlist, flash guide and pure-USB safety instructions are included',()=>{
 const boards=read('docs/ESP_BOARD_OPTIONS.md'),guide=read('docs/USB_BRIDGE_GUIDE.md');
 for(const name of ['ESP32-C3 SuperMini','XIAO ESP32C3','ESP32-S3 DevKitC-1','Nano ESP32','ESP32-C6'])
  assert.ok(boards.includes(name),name);
 for(const term of ['ESP32C3 Dev Module','USB CDC On Boot','BRIDGE_INFO','CDC_ONLY','GPIO18','GPIO19','esp32c3_supermini.ino'])
  assert.ok(boards.includes(term),term);
 assert.ok(guide.includes('ESP_BOARD_OPTIONS.md'));
});



test('Guided AFE uses the original ADC chart and live buttons, never a second hardware connection',()=>{
 const html=read('index.html'),guide=read('guided.js'),app=read('app.js'),css=read('guided.css');
 assert.equal(html.split('id="chart"').length-1,1);
 assert.ok(guide.includes("moveId('chart','gwAfeChartHost')"));
 assert.ok(guide.includes("for(const id of ['readNow','live','srcLabel'])moveId(id,'gwAfeLiveActions')"));
 assert.ok(guide.includes("moveId('adcMsg','gwAfeMessage')"));
 assert.ok(guide.includes("$('gwFinishChartHost').appendChild($('chart'))"));
 assert.ok(guide.includes("$('gwAfeChartHost').appendChild($('chart'))"));
 assert.ok(guide.includes("function updateAfeTelemetry()"));
 assert.ok(app.includes("redraw:()=>draw()"));
 assert.ok(css.includes("#guidedWorkspace .gw-afe-chart #chart"));
 assert.ok(css.includes("#guidedWorkspace .gw-finish-chart #chart"));
 assert.ok(!guide.includes('readReg('));
 assert.ok(!guide.includes('writeReg('));
});
test('Guided AFE range tracker uses original samples and ignores older or changed-gain readings',()=>{
 const app=read('app.js');
 const segment=app.split(' function guidedAfeStats(since){')[1].split('\n }\n window.ELMOS_GUIDED_API')[0];
 assert.ok(segment&&segment.includes('st.history.filter('));
 const func='function guidedAfeStats(since){'+segment+'\n }';
 const when=Date.parse('2026-11-11T18:00:00Z');
 const gains={pga1:1,pga2:3,offset:0};
 const rows=[
  {time:'2026-11-11T17:59:59Z',source:'usb',adc_s:30000,gains},
  {time:'2026-11-11T18:00:01Z',source:'usb',adc_s:-12000,gains},
  {time:'2026-11-11T18:00:02Z',source:'usb',adc_s:8000,gains},
  {time:'2026-11-11T18:00:03Z',source:'usb',adc_s:27000,gains:{pga1:2,pga2:3,offset:0}}
 ];
 const calculate=new Function('st','since','return ('+func+')(since)');
 const result=calculate({mode:'usb',history:rows,staged:gains},when);
 assert.equal(result.count,2);
 assert.equal(result.min,-12000);
 assert.equal(result.max,8000);
 assert.equal(result.hub,20000);
 assert.equal(result.limitExceeded,false);
 const warning=calculate({mode:'usb',history:[...rows,{time:'2026-11-11T18:00:05Z',source:'usb',adc_s:25500,gains}],staged:gains},when);
 assert.equal(warning.limitExceeded,true);
 const empty=calculate({mode:'usb',history:rows,staged:gains},Date.parse('2026-11-11T18:01:00Z'));
 assert.equal(empty.count,0);
});
test('Guided finish distinguishes measured DSP from requested output-voltage settings',()=>{
 const guide=read('guided.js'),app=read('app.js'),css=read('guided.css');
 for(const id of ['gwFinishSignalValue','gwFinishSignalUnit','gwFinishDsp','gwFinishAdc','gwFinishTemp','gwFinishTime','gwFinishBar','gwFinishStatus','gwFinishConfig'])
  assert.equal(guide.split('id="'+id+'"').length-1,1);
 assert.ok(guide.includes('function updateFinishTelemetry()'));
 assert.ok(guide.includes("range.kind==='display'"));
 assert.ok(guide.includes('t.dspRaw===null'));
 assert.ok(guide.includes('Diese Spannungen wurden nicht am Pin gemessen.'));
 assert.ok(guide.includes('Kaltstart und Ausgangsmessung stehen noch aus.'));
 assert.ok(app.includes('telemetry:()=>guidedTelemetry()'));
 assert.ok(app.includes("const adc=online&&st.adc&&nowMs-st.adc.time<5000"));
 assert.ok(app.includes("const dsp=online&&st.dsp&&nowMs-st.dsp.time<5000&&!st.dspError"));
 assert.ok(css.includes("#guidedWorkspace .gw-finish-number strong"));
});
test('Guided setup keeps reference and output fields aligned while restoring the classic UI',()=>{
 const guide=read('guided.js'),css=read('guided.css');
 assert.ok(guide.includes('id="gwS0Holder"'));
 assert.ok(guide.includes('id="gwS1Holder"'));
 assert.ok(guide.includes("moveLabel('psscS0','gwS0Holder')"));
 assert.ok(guide.includes("moveLabel('psscS1','gwS1Holder')"));
 assert.ok(guide.includes("moveLabel('calDspLimit','gwDspFields')"));
 assert.ok(guide.indexOf('id="gwS0Holder"')>guide.indexOf('id="gwPage7"'));
 assert.ok(guide.includes('node.parentNode.replaceChild(marker,node)'));
 assert.ok(guide.includes('marker.parentNode.replaceChild(x.node,x.marker)'));
 assert.ok(css.includes('#guidedWorkspace .gw-setup-grid'));
 assert.ok(read('interface.css').includes('#guidedWorkspace .gw-output-voltage-fields'));
});

test('Demo uses an isolated adapter and does not request a physical USB port',()=>{
 const app=read('app.js'),html=read('index.html'),demo=read('demo.js');
 assert.ok(html.includes('id="demoMode"'));
 assert.ok(html.includes('id="demoNotice"'));
 assert.ok(app.includes('if(demoEnabled&&port!==demoPort)throw Error'));
 assert.ok(app.includes('if(!st.closing&&demoPort&&st.port===demoPort)return demoPort.exchange(text)'));
 assert.ok(app.includes("sessionStorage.setItem('demo-'+k,v)"));
 assert.ok(!demo.includes('navigator.serial'));
});
