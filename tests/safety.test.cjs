'use strict';
// Software regression tests. Run: node --test tests/safety.test.cjs
// A real E703.11 power-cycle/1-Wire test is still required.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const CAL=require('../calibration.js');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

// Extract the named top-level function rather than relying on its old signature
// or accidentally including unrelated handlers below it.
const routine=(src,name)=>{
 const match=new RegExp('^ (?:async )?function '+name+'\\(','m').exec(src);
 assert.ok(match,'function exists: '+name);
 const start=match.index,end=src.indexOf('\n }',start);
 assert.ok(end>start,'function boundary: '+name);
 return src.slice(start,end+3);
};

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
test('Calibration persists only confirmed SVDD bits, with CRC and protection intact',()=>{
 const before=safeNvm();
 before[CAL.SVDD_INDEX]=0x0C80;
 const solution={registers:{so:0,sf:0,coeffs:Array(16).fill(0)}};
 const plan=CAL.configFrom(before,solution,0,{bridgeSupply:2});
 assert.equal(plan.after[CAL.SVDD_INDEX],0x0C82);
 assert.deepEqual(plan.changes.map(change=>change.address),[0x36,0x7E]);
 assert.equal(plan.after[63],CAL.crc16(plan.after));
 assert.throws(()=>CAL.protectStartupCommunication(before,plan.after),/Startschutz/);
 for(const bad of [0x0C83,0x0C86]){
  const changed=plan.after.slice();
  changed[CAL.SVDD_INDEX]=bad;
  assert.throws(()=>CAL.protectStartupCommunication(before,changed,{allowSvdd:true}),/SVDD/);
 }
 assert.equal(CAL.configFrom(before,solution,0).after[CAL.SVDD_INDEX],0x0C80);
 assert.throws(()=>CAL.configFrom(before,solution,0,{bridgeSupply:3}),/SVDD/);
});
test('AODO mode preparation preserves communication',()=>{
 const before=safeNvm();before[17]&=~4;
 const after=CAL.prepareOutputConfig(before,{mode:'1',scaleEnabled:true,gain:0.7,offset:0,pwmPeriod:16384},30000);
 assert.notEqual(after[16],before[16]);
 for(let i=0;i<28;i++)if(i!==16&&i!==22)assert.equal(after[i],before[i]);
});
test('Seven calibration steps plus independent EEPROM viewer and test logger',()=>{
 const html=read('index.html');
 const panels=Array.from(html.matchAll(/<section[^>]*data-panel="([0-9]+)"/g),m=>Number(m[1]));
 const steps=Array.from(html.matchAll(/<button class="stepBtn[^"]*" data-step="([0-9]+)"/g),m=>Number(m[1]));
 assert.deepEqual(panels,[0,1,2,3,4,5,6,7,10,8,9]);
 assert.deepEqual(steps,[0,1,2,3,4,5,9,6,7,8]);
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
 const transport=routine(src,'nvmTransportSupported');
 const supported=new Function('st','i2cNvmSupported',transport+';return nvmTransportSupported();');
 assert.equal(supported({iface:'plc'},()=>false),true);
 assert.equal(supported({iface:'i2c'},()=>false),false);
 assert.equal(supported({iface:'i2c'},()=>true),true);
 assert.equal(supported({iface:'spi'},()=>false),false);
 const program=routine(src,'nvmProgramOperation');
 assert.match(program,/if\(!nvmTransportSupported\(\)\)throw Error/);
 assert.match(program,/CAL\.protectStartupCommunication\(initial,modified,\{allowSvdd,allowAlarmMask:.*operatingProfile,interfaceMode:st\.iface,allowTimedOneWire:timedOneWire\}\)/);
 assert.ok(program.indexOf('CAL.protectStartupCommunication(initial,modified')<program.indexOf('for(const x of [0x98BD'));
});

test('PSSC S0/S1 quantization stays inside analog range',()=>{
 const result=CAL.analogScaling(0.5,4.5,5,32000);
 assert.ok(result.gain>0);
 assert.ok(result.outputDigits[0]>=-26214);
 assert.ok(result.outputDigits[1]<=26214);
 assert.ok(Math.abs(result.actualVolts[0]-0.5)<0.005);
 assert.ok(Math.abs(result.actualVolts[1]-4.5)<0.005);
 const before=safeNvm();before[17]&=~4;
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
 for(const token of ['Digital Interface','AODO pin','Scaling','Limiting','Error Signaling','alarmErrorLowPct','alarmErrorHighPct'])assert.ok(html.includes(token));
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
 assert.ok(expert.includes("return getActiveDSPRange()?.limit;"));
 assert.ok(app.includes("await restoreCalibrationDisplayProfile();"));
 assert.ok(app.includes("$('calDspLimit').dataset.userEdited='1'"));
});

test('Datasheet 6.4.5.7: 1-Wire startup prerequisites are mandatory',()=>{
 const valid=safeNvm();
 assert.equal(CAL.oneWireStartupStatus(valid).ok,true);
 for(const change of [
  w=>{w[16]=0},                       // high-Z
  w=>{w[16]=6<<9},                    // ALARM
  w=>{w[17]=0;w[18]=3<<12},          // no PLC / no startup window
  w=>{w[19]&=~(1<<11)}               // downstream disabled
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
 const names=scripts.map(url=>url.split('?')[0]);
 for(const name of ['calibration.js','eeprom-help.js','expert.js','config.js','guided-plan.js','demo.js','archive-core.js','archive.js','app.js','compact.js','test-logger.js','guided.js'])assert.equal(names.filter(n=>n===name).length,1,name);
 for(const [before,after] of [['calibration.js','app.js'],['expert.js','app.js'],['app.js','guided.js'],['alarm-config.js','alarm-editor.js'],['alarm-editor.js','app.js']])assert.ok(names.indexOf(before)<names.indexOf(after),before+' before '+after);
});

test('Failed E703.11 probe keeps SSP3 open for explicit, bounded startup test',()=>{
 const src=read('app.js');
 const connect=src.split('async function connect(port){')[1]?.split('async function disconnect()')[0];
 assert.ok(connect);
 assert.ok(connect.includes('await firmware();'));
 assert.ok(connect.includes('await selectChipInterface();'));
 assert.ok(connect.includes('await detect();'));
 assert.ok(connect.includes('Der automatische SSP3-Power-Start ist für One Wire standardmässig aktiv'));
 assert.ok(!connect.includes('await connect(port,false)'));
 assert.ok(!connect.includes('if(!await disconnect())'));
 assert.ok(!connect.includes('writeReg('));
 assert.ok(!connect.includes('nvmWrite('));
});

test('EEPROM viewer reads only via the established CRC-tested NVM path',()=>{
 const html=read('index.html'),app=read('app.js'),expert=read('expert.js');
 assert.ok(html.includes('id="eepromSearch"'));
 assert.ok(html.includes('id="eepromExport"'));
 assert.match(routine(app,'workflowGate'),/if\(n===7\|\|n===10\)return ''/);
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
 const fields=EEPROM_HELP.describe(28,0x0800).fields;
 assert.equal(fields.length,7);
 assert.equal(fields[0].meaning,'Normal');
 assert.equal(EEPROM_HELP.describe(28,0x1800).fields[0].meaning,'SIP/SIN vertauscht');
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
  'nvmPrepare','nvmAutoBackup','nvmUidHint','nvmProgram'
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
test('Selective config includes only requested groups and AFE imports auto-apply to verified RAM',()=>{
 const app=read('app.js'),html=read('index.html'),guide=read('guided.js');
 for(const id of ['configSave','configFile','configApply','configLabel','configPreview','configIncludeAfe','configIncludeReference','configIncludeMeasurement','configIncludeDsp','configIncludeOutput'])
  assert.equal(html.split('id="'+id+'"').length-1,1);
 assert.ok(!html.includes('id="configAfeApplyRam"'));
 assert.ok(app.includes('ELMOS_CONFIG.createSelective('));
 assert.ok(app.includes('const p=st.staged;'));
 assert.ok(app.includes("if(target&&(!st.port||!st.chip||st.mode!=='usb'))"));
 assert.ok(app.includes('const ok=await commitGain(gains)'));
 assert.ok(app.includes("if(!ok||!st.chip||!['pga1','pga2','offset'].every"));
 assert.ok(app.includes("throw Error('AFE-RAM-Übernahme nicht bestätigt."));
 assert.ok(app.includes("if(has('output'))expert.applyOutputProfile(values.output)"));
 assert.ok(app.includes("document.dispatchEvent(new CustomEvent('elmos-config-applied'"));
 assert.ok(guide.includes("subscribe(document,'elmos-config-applied',syncImportedConfig)"));
 assert.ok(guide.includes("moveId('configGroups','gwConfigGroups')"));
 assert.ok(guide.includes("moveId('configImportEffect','gwConfigEffect')"));
 const compact=read('compact.js');
 assert.ok(compact.includes("moveId('configGroups','cpCfgGroups')"));
 assert.ok(compact.includes("moveId('configImportEffect','cpCfgEffect')"));
 assert.ok(!guide.includes("subscribe($('configApply'),'click',syncImportedConfig)"));
 assert.ok(!app.includes("$('configAfeApplyRam').addEventListener"));
 assert.ok(app.includes('invalidateCalculation('));
 assert.ok(app.includes("if(st.writing||st.nvmWorking||st.calTask||st.afeWriteActive)"));
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
test('NVM write always releases maintenance flags and resumes live ADC/DSP unless manually paused',()=>{
 const app=read('app.js');
 const nvm=app.split(' async function nvmProgram(){')[1].split(' async function postBootCheck(')[0];
 assert.ok(nvm.includes("st.nvmWorking=true;st.calTask=true;st.writing=true;st.ramWriteScope='nvm';stopLive()"));
 assert.ok(nvm.includes("if(st.liveReadPromise)await st.liveReadPromise.catch(()=>{});"));
 assert.ok(nvm.includes("if(st.calTask){"));
 assert.ok(nvm.includes("await ramLock()"));
 assert.ok(nvm.includes("}finally{\n    st.ramWriteScope=null;st.nvmWorking=false;st.calTask=false;st.writing=false;"));
 assert.ok(nvm.includes("if(!st.manualLivePause&&st.port&&st.chip&&!st.closing){\n     startLive();"));
 assert.ok(nvm.lastIndexOf("st.nvmWorking=false;st.calTask=false;st.writing=false")<nvm.lastIndexOf("startLive();"));
 assert.ok(nvm.includes("Live-Messung nach NVM-Vorgang automatisch wieder gestartet"));
 // Sensor NVM write protection, UID checks and CRC must stay intact.
 assert.ok(nvm.includes("if(!nvmTransportSupported())throw Error"));
 assert.ok(nvm.includes("st.uid.ser0!==st.nvmBackup[0]"));
 assert.ok(nvm.includes("CAL.crc16(after)!==after[63]"));
});
test('Single-temperature guide names points P1, P2 without artificial T1 prefix',()=>{
 const p=GUIDED_PLAN.create({pCount:2,tCount:1,temperatures:[25],pmin:0,pmax:100,unit:'%'});
 assert.deepEqual(p.points.map(x=>x.label),['P1','P2']);
 assert.deepEqual(p.points.map(x=>x.title),['Druck 1','Druck 2']);
 const p3=GUIDED_PLAN.create({pCount:3,tCount:1,temperatures:[25]});
 assert.deepEqual(p3.points.map(x=>x.label),['P1','P2','P3']);
 const p23=GUIDED_PLAN.create({pCount:2,tCount:3,temperatures:[0,25,60]});
 assert.deepEqual(p23.points.map(x=>x.label),
  ['T1 / P1','T1 / P2','T2 / P1','T2 / P2','T3 / P1','T3 / P2']);
 const ui=read('guided.js');
 assert.ok(ui.includes("name=point.label+' · '+point.pressure+' '+p.unit"));
 assert.ok(!ui.includes("name='T'+(point.temperatureIndex+1)"));
});
test('Guided plan defaults independent DSP verification to one point',()=>{
 const ui=read('guided.js'),html=read('index.html');
 assert.ok(ui.includes("fieldValue('calVerifyCount',1)"));
 assert.ok(!ui.includes("p.tCount>1?Math.min(3,p.tCount):2"));
 assert.ok(html.includes('id="calVerifyCount" min="1" max="10" step="1" value="1"'));
 assert.ok(html.includes('Anzahl Prüfpunkte (Standard: 1)'));
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
 assert.ok(html.includes('id="guidedHomeTop"'));
 assert.ok(html.includes('id="guidedLaunch"'));
 assert.ok(html.includes('id="guidedLaunchTop"'));
 assert.match(html,/guided\.css\?v=0\.7\.\d+/);
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
 assert.match(routine(app,'nvmProgramOperation'),/CAL\.protectStartupCommunication\(initial,modified,\{allowSvdd,allowAlarmMask:.*operatingProfile,interfaceMode:st\.iface,allowTimedOneWire:timedOneWire\}\)/);
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
 const conn=routine(app,'connectOperation'),bridge=routine(app,'connectBridgeChip'),hello=routine(app,'bridgeHello');
 assert.ok(conn.indexOf('if(!bridgeReady)return;')>conn.indexOf('await bridgeHello()'));
 assert.ok(conn.indexOf('if(!bridgeReady)return;')<conn.indexOf('await connectBridgeChip()'));
 assert.match(hello,/caps\.includes\('PLC_GPIO4_IO'\).*caps\.includes\('POWER_GPIO_10'\)/);
 assert.match(bridge,/await exchange\('PLC_BAUD '\+rate\)/);
 assert.ok(bridge.indexOf('await bridgeAccess({power,recover})')<bridge.lastIndexOf('await detect('));
 for(const token of ['CAPS=PLC_UID,PLC_READ,PLC_WRITE,NVM','CONFIG_IDF_TARGET_ESP32C3','ARDUINO_USB_CDC_ON_BOOT','GPIO18/19','PLC_WRITE_DENIED'])assert.ok(fw.includes(token),token);
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
 for(const name of ['ESP32-C3 SuperMini','Arduino Pro Micro','ELMOS SSP3','GPIO4','GPIO10','D7','3,3-V-GPIOs sind nicht 5-V-tolerant','esp32c3_supermini.ino','pro_micro.ino'])assert.ok(boards.includes(name),name);
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
 const func=routine(app,'guidedAfeStats');
 assert.ok(func.includes('st.history.filter('));
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
 assert.ok(guide.includes("scaled?t.sensorValue:t.dspRaw"));
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

test('Saving config now always exports all five groups regardless of import checkboxes',()=>{
 const app=read('app.js'),html=read('index.html');
 assert.ok(app.includes('const profile=configFromUi(ELMOS_CONFIG.GROUPS,'));
 assert.ok(!app.includes('const profile=configFromUi(configSelectedGroups());'));
 assert.ok(html.includes('Gesamte Config speichern (.json)'));
 assert.ok(html.includes('id="configGroups" hidden'));
 assert.ok(html.includes('id="configGroupsLegend"'));
 assert.ok(html.includes('.config-group-select label[hidden]'));
 assert.ok(!html.includes('Was soll in der Config-Datei gespeichert werden?'));
});
test('Import checkbox selection controls which groups are applied and gates AFE writes',()=>{
 const app=read('app.js'),html=read('index.html');
 assert.ok(app.includes('function resetConfigImportSelection(profile,editing=false){'));
 assert.ok(app.includes('const available=new Set(profile?configIncluded(profile):[]);'));
 assert.ok(app.includes('checkbox.checked=profile?present:editing'));
 assert.ok(app.includes('checkbox.disabled=!present&&!editing'));
 assert.ok(app.includes("selectedConfig=null;resetConfigImportSelection(null);"));
 assert.ok(app.includes('resetConfigImportSelection(profile);'));
 assert.ok(app.includes('included=configSelectedGroups()'));
 assert.ok(app.includes('if(!included.length)throw Error('));
 assert.ok(app.includes('if(included.some(group=>!values.include.includes(group)))'));
 assert.ok(app.includes("const target=has('afe')?{...values.afe}:null;"));
 assert.ok(app.includes("if(target&&(!st.port||!st.chip||st.mode!=='usb'))"));
 assert.ok(app.includes('if(target){'));
 assert.ok(app.includes('const ok=await commitGain(gains);'));
 assert.ok(app.includes("if(has('output'))expert.applyOutputProfile(values.output);"));
 assert.ok(app.includes("document.dispatchEvent(new CustomEvent('elmos-config-applied'"));
 for(const id of ['configIncludeAfe','configIncludeReference','configIncludeMeasurement','configIncludeDsp','configIncludeOutput'])
  assert.equal(html.split('id="'+id+'"').length-1,1);
 assert.ok(app.includes('button.disabled=!selectedConfig||!configSelectedGroups().length;'));
});
test('Config filenames include truthful pressure/temperature/range/output prefixes and user label',()=>{
 const data={label:'Prüfgerät Grün',afe:{pga1:1,pga2:2,offset:0},
  calibration:{sOrder:1,tOrder:2,dspLimit:25000,pointCount:6,samples:12,
   reference:{min:0,max:10,unit:'bar',customUnit:''}},
  output:{mode:'1',scaleEnabled:true,vdd:5,s0:0.5,s1:4.5,gain:0,offset:0,pwmPeriod:16384}};
 const p=CFG.createSelective(data,CFG.GROUPS,CAL);
 assert.equal(CFG.fileName(p,{pCount:2,tCount:3}),
  '2P_Druck_3T_Temp_0-10bar_0p5-4p5V_ELMOS_E70311_Pruefgeraet_Gruen.json');
 const noPlan=CFG.fileName(p);
 assert.ok(noPlan.startsWith('6Messpunkte_0-10bar_'));
 assert.ok(!noPlan.startsWith('6P_Druck'));
 assert.equal(CFG.fileName(p,{pCount:5,tCount:1}),noPlan);
 assert.ok(!CFG.fileName(p).includes('/'));
 assert.ok(!CFG.fileName(p).includes(' '));
 const p2=CFG.createSelective({...data,calibration:{...data.calibration,
  tOrder:0,pointCount:2}},CFG.GROUPS,CAL);
 assert.ok(CFG.fileName(p2).startsWith('2P_Druck_'));
 const onlyAFE=CFG.createSelective(data,['afe'],CAL);
 assert.ok(CFG.fileName(onlyAFE).startsWith('ELMOS_E70311_'));
 assert.ok(!CFG.fileName(onlyAFE).includes('0-10bar'));
});
test('Filename pressure-temperature matrix comes only from genuinely applied guide settings',()=>{
 const app=read('app.js'),guide=read('guided.js');
 assert.ok(app.includes('ELMOS_CONFIG.fileName(profile,window.ELMOS_GUIDED?.appliedPlanForConfig?.())'));
 assert.ok(guide.includes('function appliedPlanForConfig(){'));
 assert.ok(guide.includes('signature!==JSON.stringify(plan)'));
 assert.ok(guide.includes("Number($('calPointCount').value)!==plan.total"));
 assert.ok(guide.includes("Number($('calSOrder').value)!==plan.orderS"));
 assert.ok(guide.includes("Number($('calTOrder').value)!==plan.orderT"));
});
test('V2 selective config roundtrip preserves only requested sections',()=>{
 const input={label:'Gains',afe:{pga1:2,pga2:6,offset:4},
  calibration:{sOrder:1,tOrder:0,dspLimit:25000,pointCount:2,samples:12,
   reference:{min:0,max:10,unit:'bar',customUnit:''}},
  output:{mode:'1',scaleEnabled:true,vdd:5,s0:0.5,s1:4.5,gain:0,offset:0,pwmPeriod:16384}};
 const afe=CFG.createSelective(input,['afe'],CAL);
 assert.equal(afe.version,2);
 assert.deepEqual(afe.include,['afe']);
 assert.deepEqual(afe.afe,input.afe);
 assert.equal(afe.output,undefined);
 assert.equal(afe.measurement,undefined);
 assert.equal(afe.reference,undefined);
 assert.equal(afe.dsp,undefined);
 assert.deepEqual(CFG.validate(JSON.parse(JSON.stringify(afe)),CAL),afe);
 const dsp=CFG.createSelective(input,['dsp','measurement'],CAL);
 assert.equal(dsp.afe,undefined);
 assert.equal(dsp.measurement.samples,12);
 assert.equal(dsp.dsp.dspLimit,25000);
 const all=CFG.createSelective(input,CFG.GROUPS,CAL);
 assert.deepEqual(all.include,CFG.GROUPS);
 assert.equal(all.output.mode,'1');
 assert.ok(all.output.gain>0);
 const txt=JSON.stringify(all);
 for(const key of ['uid','words','nvmBackup','boot','SER0','calfit','coeffs'])
  assert.ok(!txt.includes('"'+key+'"'));
});
test('V2 importer rejects extra groups, undeclared fields and unsafe partial values',()=>{
 const input={label:'Gains',afe:{pga1:1,pga2:3,offset:0},
  calibration:{sOrder:1,tOrder:0,dspLimit:25000,pointCount:2,samples:12,
   reference:{min:0,max:10,unit:'bar',customUnit:''}},
  output:{mode:'1',scaleEnabled:true,vdd:5,s0:0.5,s1:4.5,gain:0,offset:0,pwmPeriod:16384}};
 const p=CFG.createSelective(input,['afe'],CAL);
 assert.throws(()=>CFG.createSelective(input,[],CAL),/Mindestens eine/);
 assert.throws(()=>CFG.validate({...p,include:['afe','afe']},CAL),/gültige Einstellungsgruppe/);
 assert.throws(()=>CFG.validate({...p,include:['afe','factory']},CAL),/gültige Einstellungsgruppe/);
 assert.throws(()=>CFG.validate({...p,uid:'12345678'},CAL),/unerlaubtes Feld/);
 assert.throws(()=>CFG.validate({...p,measurement:{pointCount:2,samples:4}},CAL),/Gruppenauswahl/);
 assert.throws(()=>CFG.validate({...p,afe:{...p.afe,pga1:100}},CAL),/ungültiger Wert/);
 const mix=CFG.createSelective(input,['measurement','dsp'],CAL);
 assert.throws(()=>CFG.validate({...mix,measurement:{pointCount:2,samples:12},dsp:{...mix.dsp,sOrder:3}},CAL),/Polynomordnung fehlen/);
});
test('AFE RAM commit returns explicit success or failure without NVM bypass',()=>{
 const app=read('app.js');
 const region=app.split(' async function commitGain(target){')[1].split(' async function sample(){')[0];
 assert.ok(region.includes('return false'));
 assert.ok(region.includes('return true'));
 assert.ok(region.includes('await bootSnapshot()'));
 assert.ok(region.includes('const actual=await readReg(R_AFE)'));
 assert.ok(region.includes("if(actual!==next)throw Error('AFE-Rücklesefehler"));
 assert.ok(region.includes('st.afeWriteActive=true'));
 assert.ok(region.includes('st.afeWriteActive=false'));
 assert.ok(!region.includes('nvmProgram('));
 assert.ok(!region.includes('nvmScan('));
});

test('Read-only AFE1 diagnostics captures three reads, other AFE registers and raw CRC byte',()=>{
 const src=read('app.js'),html=read('index.html');
 const diag=routine(src,'runChipDiagnosticsOperation');
 assert.ok(diag.includes("[[R_AFE,'CFG_AFE1'],[R_AFE,'CFG_AFE1'],[R_AFE,'CFG_AFE1']"));
 for(const name of ['CFG_AFE0','CFG_AFE2','ADC_S'])assert.ok(diag.includes("'"+name+"'"));
 assert.ok(diag.includes('p.value=await readReg(addr)'));
 assert.ok(diag.includes('p.frame={...st.lastPlcReply}'));
 assert.ok(!diag.includes('maintWrite('));
 assert.ok(!diag.includes('nvmProgram('));
 assert.ok(!diag.includes('nvmWrite('));
 assert.ok(!diag.includes('commitGain('));
 assert.ok(diag.includes('st.writing||st.nvmWorking||st.calTask||st.afeWriteActive'));
 for(const id of ['chipDiagDetails','chipDiagRead','chipDiagExport','chipDiagResult'])
  assert.equal(html.split('id="'+id+'"').length-1,1);
});
test('Malformed and unexpected AFE1 values keep write gates while raw reply is retained',()=>{
 const src=read('app.js');
 const reader=src.split(' async function readReg(addr,timeoutMs=2500){')[1].split(' function decodeSafeAFE(w){')[0];
 const safe=src.split(' function decodeSafeAFE(w){')[1].split(' function formatChipDiag(d){')[0];
 assert.ok(reader.includes('const bytes=P.readData(reply,3);'));
 assert.ok(reader.includes('crc8Rx:bytes[2]'));
 assert.ok(reader.includes("crc8IndependentCheck:crc8Valid?'valid':'invalid'"));
 assert.ok(reader.includes('rawReply:reply.slice(0,1000)'));
 assert.ok(reader.includes("status:'malformed'"));
 assert.ok(safe.includes('if(!(w&0x0800))throw Error('));
 assert.ok(safe.includes('P.goodG(g)'));
 assert.ok(src.includes("if(!(old&0x800))throw Error('Pflichtbit 11 fehlt. Schreiben gesperrt.')"));
 assert.ok(!safe.includes('st.chip=true'));
 assert.ok(src.includes('Chipdiagnose als JSON')===false); // label is in HTML only
});
test('Startfenster-Test is bounded, read-only, cancellable and does not re-open the serial port',()=>{
 const src=read('app.js'),html=read('index.html');
 const startup=src.split('async function recoverOneWireStartup(){')[1]?.split('async function connect(port){')[0];
 assert.ok(startup);
 assert.ok(startup.includes('maxDurationMs=12000,maxAttempts=75'));
 assert.ok(startup.includes('readReg(R_AFE,240)'));
 assert.ok(startup.includes('decodeSafeAFE(word)'));
 assert.ok(startup.includes('st.startupAbort'));
 assert.ok(startup.includes('await detect()'));
 assert.ok(!startup.includes('writeReg('));
 assert.ok(!startup.includes('nvmWrite('));
 assert.ok(!startup.includes('port.open('));
 assert.ok(!startup.includes('port.close('));
 assert.ok(html.includes('id="plcStartupProbe"'));
 assert.ok(html.includes('id="plcStartupStop"'));
 assert.ok(html.includes('id="plcStartupLogExport"'));
 assert.ok(src.includes("download('E70311_SSP3_Web_Log_'"));
 assert.ok(src.includes("source:'Web-App (NICHT PSSC Originalsoftware)'"));
 assert.ok(src.includes("st.startupAbort=true;\n  st.closing=true;"));
});
test('Chip diagnostics export is available for failed chip detection without unlocking access',()=>{
 const src=read('app.js'),html=read('index.html');
 assert.ok(src.includes("$('chipDiagRead').addEventListener('click'"));
 assert.ok(src.includes("$('chipDiagExport').addEventListener('click'"));
 assert.ok(src.includes("'ELMOS_E70311_Chipdiagnose_'+Date.now()+'.json'"));
 assert.ok(src.includes('usbLog:st.log.slice(-120)'));
 assert.ok(src.includes('chipDiagnostic:st.chipDiag'));
 assert.ok(html.includes('CRC8-Byte wird mitprotokolliert'));
 assert.ok(html.includes('kein ungeprüftes «CRC gültig»'));
});

test('Three-byte SSP3 PLC response is parsed losslessly including zero bit11',()=>{
 const P=require('../app.js');
 assert.deepEqual(P.readData('# SSP3\n08 00 5A\n:\n',3),[0x08,0x00,0x5A]);
 assert.deepEqual(P.readData('00 00 00\r\n:\r\n',3),[0,0,0]);
 assert.throws(()=>P.readData('00 00\r\n:\r\n',3),/Ungültige oder mehrdeutige/);
 assert.throws(()=>P.readData('08 00 FF\n08 00 AA\n:\n',3),/mehrdeutige/);
 assert.equal((0x0800&0x0800)!==0,true);
 assert.equal((0x0000&0x0800)!==0,false);
});
test('Elmos CRC8 polynomial test vector and existing reserved-bit write lock remain unchanged',()=>{
 const P=require('../app.js');
 assert.equal(P.crc8PLC([0x6A,0x0A,0x67,0x89]),0x5F);
 assert.throws(()=>P.encAFE(0x0000,{pga1:0,pga2:0,offset:0}),/Pflichtbit 11 fehlt/);
 const valid=P.encAFE(0x0800,{pga1:2,pga2:3,offset:1});
 assert.equal(valid&0x0800,0x0800);
});

test('PLC Magic Cookie encoder uses datasheet CRC write example',()=>{
 const P=require('../app.js');
 assert.equal(P.plcRead(0x6A),'PLC 026D6A0A.');
 assert.equal(P.plcWrite(0x6A,0x6789),'PLC 026C6A0A67895F');
 assert.equal(P.plcWrite(0xAC,0x2B42),'PLC 026CAC0F2B4299');
 assert.equal(P.plcWrite(0x0E,0x5CFD),'PLC 026C0E095CFDCA');
});
test('Explicit Magic Cookie test performs exactly two documented PLC writes then reads',()=>{
 const app=read('app.js'),html=read('index.html'),code=routine(app,'testPlcMagicCookie');
 assert.ok(code.includes("if(!$('plcMagicConfirm').checked)"));
 assert.ok(code.includes("st.adapterKind!=='ssp3'||st.iface!=='plc'"));
 assert.ok(code.includes('P.plcHostCommand(P.plcWrite(0xAC,0x2B42,st.plcAddress),st.plcHostFormat),P.plcHostCommand(P.plcWrite(0x0E,0x5CFD,st.plcAddress),st.plcHostFormat)'));
 assert.ok(code.includes('await exchange(commands[i],2000)'));
 assert.ok(code.indexOf('await exchange(commands[i],2000)')<code.indexOf("await probePlcAddresses('Manueller Magic-Cookie-Test')"));
 assert.ok(code.includes('st.magicResult.readVerified=true'));
 for(const forbidden of ['nvmProgram(', 'nvmWrite(', 'maintWrite(', 'port.close(', 'port.open('])assert.ok(!code.includes(forbidden));
 for(const id of ['plcMagicRun','plcMagicConfirm'])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(app.includes('magicCookie:st.magicResult'));
});

test('AN0204 SSP3 power test is opt-in, ordered, recoverable and never programs NVM',()=>{
 const app=read('app.js'),html=read('index.html');
 const code=routine(app,'testSsp3PowerStartup');
 assert.ok(code);
 assert.ok(code.includes("if(!$('plcPowerConfirm').checked)"));
 assert.ok(code.includes("const help=await readSsp3PowerHelp()"));
 assert.ok(code.includes("if(!help.pwrOffListed)"));
 assert.ok(!code.includes("await send('Power_OFF 03E8'"));
 assert.ok(code.indexOf("if(!help.pwrOffListed)")<code.indexOf("await send('PWR_OFF 03E8'"));
 assert.ok(code.includes("st.adapterKind!=='ssp3'||st.iface!=='plc'"));
 const commands=["PWR_OFF 03E8","PLC P"];
 for(const cmd of commands)assert.ok(code.includes("await send('"+cmd+"'"));
 assert.ok(code.indexOf("await send('PWR_OFF 03E8'")<code.indexOf("await send('PLC P'"));
 assert.ok(code.indexOf("await send('PLC P'")<code.indexOf("await exchangeSsp3StartupBurst(burstMode)"));
 assert.ok(code.includes("await exchangeSsp3StartupBurst(burstMode)"));
 assert.ok(!code.includes("await send('PWR_ON 0C80 00C8 0'"));
 assert.ok(!code.includes("await send('PLC T'"));
 assert.ok(code.includes("await send('PWR_ON 0 0 0',4000)"));
 assert.ok(code.includes('await probePlcAddresses('));
 for(const bad of ['nvmWrite(', 'nvmProgram(', 'maintWrite(', 'port.open(', 'port.close('])assert.ok(!code.includes(bad));
 for(const id of ['plcPowerConfirm','plcPowerRun','plcPowerState'])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(app.includes('powerCycle:st.powerCycleResult'));
});


test('SSP3 help ? is read-only, exported and prevents unlisted power-off alias',()=>{
 const src=read('app.js'),html=read('index.html');
 const help=routine(src,'readSsp3PowerHelp');
 assert.ok(help);
 assert.ok(help.includes("exchange('?',5500)"));
 assert.ok(help.includes("PWR_OFF(?:[^A-Z0-9_]|$)"));
 assert.ok(help.includes("st.powerHelp={at:new Date().toISOString()"));
 assert.ok(!help.includes("PWR_OFF 03E8"));
 assert.ok(!help.includes('PWR_ON '));
 assert.ok(html.includes('id="plcPowerHelpRead" disabled'));
 assert.ok(html.includes('id="plcPowerHelpOutput"'));
 assert.ok(src.includes('powerHelp:st.powerHelp,plcHostFormat:st.plcHostFormat,'));
 assert.ok(src.includes('liveDiagnostic:{active:st.live,attempts:st.liveReadAttempts'));
 assert.ok(src.includes('powerHelp:st.powerHelp'));
});

test('New SSP3 firmware PLC separate slave-id formatting leaves chip bytes unchanged',()=>{
 const P=require('../app.js');
 assert.equal(P.plcHostCommand(P.plcRead(0x1C),'legacy'),'PLC 026D1C0C.');
 assert.equal(P.plcHostCommand(P.plcRead(0x1C),'separate'),'PLC 02 6D1C0C.');
 assert.equal(P.plcHostCommand(P.plcWrite(0xAC,0x2B42),'separate'),'PLC 02 6CAC0F2B4299');
 assert.equal(P.plcHostCommand(P.plcWrite(0x0E,0x5CFD),'separate'),'PLC 02 6C0E095CFDCA');
 assert.throws(()=>P.plcHostCommand('PLC P','separate'));
});
test('PLC host format can only be manually selected and applies to post-power register check',()=>{
 const src=read('app.js'),html=read('index.html');
 assert.ok(html.includes('id="plcHostFormat"'));
 assert.ok(html.includes('<option value="legacy">'));
 assert.ok(html.includes('<option value="separate" disabled>'));
 assert.ok(src.includes("st.plcHostFormat=$('plcHostFormat').value;"));
 assert.ok(src.includes("P.plcHostCommand(P.plcRead(addr,1,st.plcAddress),st.plcHostFormat)"));
 assert.ok(src.includes("P.plcHostCommand(P.plcWrite(addr,word,st.plcAddress),st.plcHostFormat)"));
 const power=routine(src,'testSsp3PowerStartup');
 assert.ok(power?.includes("plcHostFormat:st.plcHostFormat,steps:[],readVerified:false,powerRestored:false"));
 assert.ok(power?.includes("await exchangeSsp3StartupBurst(burstMode)"));
 assert.ok(power?.includes('await probePlcAddresses('));
 assert.ok(!power.includes("plcHostFormat='separate'"));
});

test('Cookie-only analog startup remains enabled 4/10/200ms in NVM',()=>{
 for(const window of [0,1,2]){
  const b=safeNvm();b[17]&=~4;b[18]=(b[18]&~0x3000)|(window<<12);b[19]&=~((1<<8)|(1<<7));
  const status=CAL.oneWireStartupStatus(b);
  assert.equal(status.ok,true);
  assert.equal(status.requiresCookie,true);
  assert.equal(status.startupWindow,window);
  const a=b.slice();a[35]=1234;a[63]=CAL.crc16(a);
  assert.equal(CAL.protectStartupCommunication(b,a),true);
  for(const index of [17,18,19])assert.equal(a[index],b[index]);
 }
});
test('Disabled or altered PLC window cannot be programmed as safe',()=>{
 const b=safeNvm();b[17]&=~4;b[19]&=~((1<<8)|(1<<7));
 const off=b.slice();off[18]=(off[18]&~0x3000)|0x3000;
 assert.equal(CAL.oneWireStartupStatus(off).ok,false);
 for(const index of [17,18,19]){
  const a=b.slice();a[index]^=index===18?0x3000:1;
  assert.throws(()=>CAL.protectStartupCommunication(b,a),/1-Wire-Startschutz/);
 }
 assert.equal(CAL.oneWireOnlyStatus(b).ok,false);
});
test('Cookie-only NVM requires startup proof outside verified live SSP3 calibration',()=>{
 const app=read('app.js'),html=read('index.html');
 assert.ok(app.includes('st.powerCycleResult.verifiedUid=st.uid?.hex||null;'));
 assert.ok(app.includes('st.powerCycleResult=null;st.magicResult=null;'));
 assert.ok(app.includes('startup.requiresCookie&&!psscRecoveryProven()&&!bridgeColdStartVerified()&&!liveSsp3Calibration'));
 assert.ok(app.includes('proof.verifiedUid===uid'));
 assert.ok(app.includes('const cookieVerified=psscRecoveryProven()||bridgeColdStartVerified();'));
 assert.ok(app.includes('CAL.protectStartupCommunication(initial,modified,{allowSvdd,allowAlarmMask:'));
 assert.ok(html.includes('id="plcStartupTools"'));
});
test('Troubleshooting tools hidden by default; recoverable in expert mode',()=>{
 const app=read('app.js'),html=read('index.html');
 assert.ok(app.includes("startupTools.hidden=demoEnabled||st.adapterKind!=='ssp3'||st.iface!=='plc'||!$('expertMode').checked"));
 assert.ok(app.includes("$('expertMode').addEventListener('change',renderStatus)"));
 for(const id of ['chipDiagDetails','usbAdvancedDetails','wiringStartDetails'])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(html.includes('id="plcStartupTools"'));
});




test('SSP3 02.08.02.04 uses hardware-proven legacy PLC host frame; split format rejected',()=>{
 const app=read('app.js'),html=read('index.html');
 const fw=app.split('async function firmware(){')[1]?.split('const ifcfg=')[0];
 assert.ok(fw.includes("match.slice(1,5).join(' ').toUpperCase()==='02 08 02 04'"));
 assert.ok(fw.includes("st.plcHostFormat='legacy'"));
 assert.ok(fw.includes("$('plcHostFormat').value='legacy'"));
 assert.ok(!fw.includes("st.plcHostFormat='separate'"));
 assert.ok(html.includes('<option value="separate" disabled>'));
 assert.match(html,/<script src="app\.js\?v=0\.7\.\d+/);
 assert.match(html,/guided\.css\?v=0\.7\.\d+/);
 const p=routine(app,'testSsp3PowerStartup');
 assert.ok(p.includes("if(st.firmware==='02.08.02.04')"));
 assert.ok(p.includes("st.plcHostFormat='legacy'"));
 assert.ok(p.includes('await probePlcAddresses('));
});
test('SSP3+PLC always power-starts before register reads without user checkbox',()=>{
 const app=read('app.js'),html=read('index.html');
 const connect=app.split('async function connect(port){')[1]?.split('async function disconnect()')[0];
 assert.ok(connect.includes("if(!demoEnabled&&st.adapterKind==='ssp3'&&st.iface==='plc')"));
 assert.ok(connect.includes('await startSsp3WithBoundedRetry();'));
 assert.ok(connect.includes("$('plcPowerConfirm').checked=true;"));
 assert.match(connect,/if\(!await probePlcAddresses\('Erstverbindung ohne Power-Cycle',true\)\)\s*await startSsp3WithBoundedRetry\(\)/);
 assert.ok(!connect.includes("ssp3AutoStart"));
 assert.ok(!html.includes('id="ssp3AutoStart"'));
 assert.ok(!app.includes("elmos-ssp3-auto-start-v1"));
 assert.ok(!connect.includes("plcMagicOnConnect"));
 assert.ok(!connect.includes("plcPowerOnConnect"));
 // Remains conditional: I2C/SPI/bridge must not power-cycle.
 assert.ok(connect.includes("st.adapterKind==='ssp3'&&st.iface==='plc'"));
 assert.ok(app.includes('powerCycle:st.powerCycleResult'));
 assert.match(routine(app,'nvmProgramOperation'),/CAL\.protectStartupCommunication\(initial,modified,\{allowSvdd,allowAlarmMask:.*operatingProfile,interfaceMode:st\.iface,allowTimedOneWire:timedOneWire\}\)/);
});

test('SSP3 prompt counter correctly counts independent command acknowledgements',()=>{
 const P=require('../app.js');
 assert.equal(P.ssp3PromptCount('#PWR_ON 0c80 00c8 0000\r:\r'),1);
 assert.equal(P.ssp3PromptCount('#PWR_ON 0c80 00c8 0000\r:\r#PLC T\r:\r'),2);
 assert.equal(P.ssp3PromptCount('#PWR_ON 0c80 00c8 0000\r:\r#PLC T\r'),1);
 assert.equal(P.ssp3PromptCount('#PLC 026D1C0C.\r!PLC nothing received\r:\r'),1);
 // Reproduction of the actual SSP3 response reported after v0.6.22.
 assert.equal(P.ssp3PromptCount('#PWR_ON 0c80 00c8 0000\r:#PLC T\r:'),2);
 assert.equal(P.ssp3PromptCount('#PWR_ON 0c80 00c8 0000 :#PLC T :'),2);
 assert.equal(P.ssp3PromptCount('#PWR_ON 0c80 00c8 0000\r:\r#PLC T\r:'),2);
 assert.equal(P.ssp3PromptCount('#PWR_ON 0c80 00c8 0000\r:#PLC T'),1);
 assert.equal(P.ssp3PromptCount('!ERROR: unknown command'),0);
 assert.equal(P.ssp3PromptCount('#PWR_ON 0c80 00c8 0000\r:\r'),1);
});
test('Short-window power-on and PLC transmit are distinct serial writes without waiting for response',()=>{
 const app=read('app.js');
 const code=routine(app,'exchangeSsp3StartupBurst');
 assert.ok(code);
 assert.ok(code.includes("const commands=[pssc?'PWR_ON FFFF 0 0':'PWR_ON 0C80 00C8 0','PLC T']"));
 assert.ok(code.includes("if(mode==='combined')"));
 assert.ok(code.includes("commands.join('\\r')+'\\r'"));
 assert.ok(code.includes("writer.write(new TextEncoder().encode(commands[0]+'\\r'))"));
 assert.ok(code.includes("writer.write(new TextEncoder().encode(commands[1]+'\\r'))"));
 assert.ok(code.indexOf("commands[0]+'\\r'")<code.indexOf("commands[1]+'\\r'"));
 assert.ok(code.includes("prompts:2"));
 assert.ok(code.includes("P.ssp3PromptCount(response)<2"));
 assert.ok(code.includes("P.ssp3StartupAcks(response)"));
 assert.ok(code.includes("if(!acks.power||!acks.plc)"));
 assert.ok(!code.includes('await exchange('));
 assert.ok(!code.includes('nvm'));
 const power=routine(app,'testSsp3PowerStartup');
 assert.ok(power.indexOf("await send('PLC P'")<power.indexOf('await exchangeSsp3StartupBurst(burstMode)'));
 assert.ok(power.includes("powerOnAcknowledged=true"));
 assert.ok(power.includes("await send('PWR_ON 0 0 0',4000)"));
 assert.ok(power.includes('await probePlcAddresses('));
});

test('Partial SSP3 startup response retained for diagnosing one-command firmware parser',()=>{
 const app=read('app.js');
 const code=routine(app,'exchangeSsp3StartupBurst');
 assert.ok(code.includes('st.powerCycleResult.burstPartialReply=partial'));
 assert.ok(code.includes('st.powerCycleResult.burstPromptCount=received'));
 assert.ok(code.includes('st.powerCycleResult.burstSendDurationMs=sendDuration'));
 assert.ok(code.includes('st.powerCycleResult.burstSecondQueued=secondQueued'));
 assert.ok(code.includes("future.catch(()=>{})"));
 assert.ok(code.includes("if(st.responseWait===ticket)"));
 assert.ok(code.includes("if(mode==='combined')"));
});

test('SSP3 PWR_ON and PLC T echoes recognised when concatenated without CR',()=>{
 const P=require('../app.js');
 for(const raw of [
  '#PWR_ON 0c80 00c8 0000\r:#PLC T\r:',
  '#PWR_ON 0c80 00c8 0000 :#PLC T :',
  '#PWR_ON 0c80 00c8 0000\r:\r#PLC T\r:\r'
 ]){
  const result=P.ssp3StartupAcks(raw);
  assert.equal(result.power,true);
  assert.equal(result.plc,true);
  assert.equal(P.ssp3PromptCount(raw),2);
 }
 assert.equal(P.ssp3StartupAcks('#PWR_ON 0c80 00c8 0000\r:').plc,false);
 assert.equal(P.ssp3StartupAcks('#PLC T\r:').power,false);
});

test('SSP3 auto startup retries documented Magic Cookie once only for missing PLC RX',()=>{
 const app=read('app.js'),startup=routine(app,'testSsp3PowerStartup');
 assert.ok(startup.includes("if(!await probePlcAddresses('Nach SSP3 PLC P/T'))"));
 assert.ok(startup.includes('if(!missingReply&&!zeroAFE)throw firstReadError;'));
 assert.ok(startup.includes("firstReadError?.code==='AFE_ZERO_READBACK'"));
 assert.ok(startup.includes('for(const address of P.plcProbeOrder(st.plcAddress))'));
 assert.ok(startup.includes("P.plcHostCommand(P.plcWrite(0xAC,0x2B42,st.plcAddress),st.plcHostFormat)"));
 assert.ok(startup.includes("P.plcHostCommand(P.plcWrite(0x0E,0x5CFD,st.plcAddress),st.plcHostFormat)"));
 assert.ok(startup.includes("const reply=await exchange(frame,2000)"));
 assert.ok(startup.includes("await probePlcAddresses('Nach Magic Cookie '+trial.address)"));
 for(const proof of ['st.magicResult.readVerified=true;','st.magicResult.verifiedUid=st.uid?.hex||null;','st.powerCycleResult.magicCookieUsed=true;','st.powerCycleResult.readVerified=true;','st.powerCycleResult.verifiedUid=st.uid?.hex||null;'])assert.ok(startup.includes(proof),proof);
 assert.ok(startup.includes("if(st.closing||st.port!==port)"));
 assert.ok(startup.indexOf('await exchangeSsp3StartupBurst(burstMode)')<startup.indexOf("st.powerCycleResult.stage='magic-cookie-fallback'"));
 for(const forbidden of ['nvmWrite(', 'nvmProgram(', 'maintWrite(', 'port.open(', 'port.close('])assert.ok(!startup.includes(forbidden));
});

test('Magic-Cookie auto startup retains protected NVM and does not touch other interfaces',()=>{
 const app=read('app.js'),cal=read('calibration.js');
 const connect=app.split('async function connect(port){')[1]?.split('async function disconnect()')[0];
 assert.ok(connect.includes("st.adapterKind==='ssp3'&&st.iface==='plc'"));
 assert.ok(connect.includes("await startSsp3WithBoundedRetry()"));
 assert.ok(!connect.includes('P.plcWrite(0xAC'));
 assert.ok(cal.includes('for(const index of [17,...(allowAlarmMask?[]:[18]),19])'));
 assert.match(routine(app,'nvmProgramOperation'),/CAL\.protectStartupCommunication\(initial,modified,\{allowSvdd,allowAlarmMask:.*operatingProfile,interfaceMode:st\.iface,allowTimedOneWire:timedOneWire\}\)/);
 assert.ok(app.includes('proof.verifiedUid===uid'));
});

test('Live read prioritises ADC_S and tolerates missing temperature while strict path remains strict',()=>{
 const app=read('app.js');
 const liveRead=app.split('async function readADC({allowPartial=false}={}){')[1]?.split('function startLive(){')[0];
 assert.ok(liveRead);
 assert.ok(liveRead.indexOf("readReg(0x2A)")<liveRead.indexOf("readReg(0x28)"));
 assert.ok(liveRead.indexOf("readReg(0x2A)")<liveRead.indexOf("readReg(0x26)"));
 assert.ok(liveRead.includes('if(allowPartial)'));
 assert.ok(liveRead.includes('temperatureError'));
 assert.ok(liveRead.includes('return value;'));
 assert.ok(liveRead.includes('updateADC({s,t,tc},\'usb\')'));
 assert.ok(liveRead.includes("t=P.sign16(await readReg(0x28));"));
 assert.ok(liveRead.includes("tc=P.sign16(await readReg(0x26));"));
 // The capture function still reads all three registers without partial mode.
 const capture=app.split('async function measureCalibrationSamples(label){')[1]?.split('function renderCalibrationPlan(){')[0];
 for(const [key,address] of [['s','0x2A'],['t','0x28'],['tc','0x26']])assert.ok(capture.includes('value.'+key+'=P.sign16(await readReg('+address+'))'));
 assert.ok(capture.includes('e.rawSamples=values.slice();throw e'));
});
test('Chip detect publishes first ADC_S even if secondary registers fail',()=>{
 const app=read('app.js');
 const detect=routine(app,'detect');
 assert.ok(detect);
 assert.ok(detect.indexOf("const rawS=await readReg(0x2A)")<detect.indexOf('updateADC({s,t:null,tc:null},\'usb\')'));
 assert.ok(detect.includes('await readADC({allowPartial:true})'));
 assert.ok(detect.includes("if(!st.powerCycleRunning&&!st.ramMeasurementStarting&&!st.manualLivePause)startLive();"));
 assert.ok(detect.includes('await expert.onDetect();'));
 assert.ok(!detect.includes('nvmProgram('));
});
test('Live acquisition resumes after protected SSP3 power-cookie sequence and retries transient PLC failures',()=>{
 const app=read('app.js');
 const power=routine(app,'testSsp3PowerStartup');
 assert.ok(power.includes('st.powerCycleRunning=false;renderStatus();'));
 assert.ok(power.includes('if(st.port===port&&!st.closing&&st.chip&&Number.isFinite(st.adc?.s)&&!st.manualLivePause)'));
 assert.ok(power.includes('startLive();'));
 const loop=app.split('function startLive(){')[1]?.split('function stopLive(){')[0];
 assert.ok(loop.includes('readLiveSample()'));
 assert.ok(loop.includes('st.powerCycleRunning||st.closing'));
 assert.ok(loop.includes('st.consecutiveErrors?2000:'));
 assert.ok(!loop.includes('st.consecutiveErrors>=10'));
 assert.ok(!loop.includes('nvmWrite('));
});

test('Live pipeline publishes ADC_S before one staggered secondary register read',()=>{
 const app=read('app.js');
 const live=app.split('async function readLiveSample(){')[1]?.split('function startLive(){')[0];
 assert.ok(live);
 assert.ok(live.indexOf('readReg(0x2A,1600)')<live.indexOf('updateADC({s,t:previous?.t??null,tc:previous?.tc??null}'));
 assert.ok(live.indexOf('updateADC({s,t:previous?.t??null,tc:previous?.tc??null}')<live.indexOf('readReg(0x28,1100)'));
 assert.ok(live.indexOf('updateADC({s,t:previous?.t??null,tc:previous?.tc??null}')<live.indexOf('readReg(0x26,1100)'));
 assert.ok(live.indexOf('updateADC({s,t:previous?.t??null,tc:previous?.tc??null}')<live.indexOf('readReg(0x30,1100)'));
 assert.ok(live.includes('liveSecondaryIndex++%5'));
 assert.ok(live.includes('if(channel===0)'));
 assert.ok(live.includes('}else if(channel===1)'));
 assert.ok(live.includes('}else if(channel===2)'));
 assert.ok(live.includes('catch(e)'));
 for(const forbidden of ['nvmWrite(', 'nvmProgram(', 'lowLevelWrite(', 'port.close(', 'PWR_OFF', 'PLC P', 'PLC T'])assert.ok(!live.includes(forbidden));
});
test('Live loop does not stop silently after 10 missing ADC samples',()=>{
 const app=read('app.js');
 const loop=app.split('function startLive(){')[1]?.split('function stopLive(){')[0];
 assert.ok(loop);
 assert.ok(loop.includes('const p=readLiveSample();'));
 assert.ok(loop.includes("st.timeout=setTimeout(loop,interval)"));
 assert.ok(loop.includes('st.consecutiveErrors?2000:'));
 assert.ok(loop.includes('if(st.live&&st.port&&!st.closing)'));
 assert.ok(!loop.includes('stopLive()'));
 assert.ok(!loop.includes('st.consecutiveErrors>=10'));
 assert.ok(loop.includes('markSensorUnavailable(st.liveLastError)'));
 assert.ok(loop.includes("st.consecutiveErrors>=2||e.code==='RAM_PROFILE_LOST'"));
 assert.ok(loop.includes("show('adcMsg','Kommunikation zum Sensor wird überprüft."));
});

test('Runtime live sampler publishes four fresh ADC_S readings despite secondary timeouts',async()=>{
 const app=read('app.js');
 const body=app.split('async function readLiveSample(){')[1]?.split('function startLive(){')[0];
 assert.ok(body);
 const st={port:{},chip:true,adc:null,dsp:null,dspError:null,lastSecondaryError:0};
 const samples=[],log=[],regCalls=[],values=[101,105,112,118];
 const readReg=async(address)=>{
  regCalls.push(address);
  if(address===0x2A)return values.shift();
  throw Error('Simulierter optionaler SSP3-Timeout');
 };
 const protocol={sign16:n=>n};
 const updateADC=(data)=>{st.adc={...data,time:Date.now()};samples.push(data.s)};
 const updateDSP=()=>{throw Error('Nicht erwartet')};
 const reader=new Function('st','P','readReg','updateADC','updateDSP','renderStatus','renderDSPLive','logging','fmt','show',
  'let liveSecondaryIndex=0; async function readLiveSample(){'+body+';return readLiveSample');
 const fn=reader(st,protocol,readReg,updateADC,updateDSP,()=>{},()=>{},v=>log.push(v),String,()=>{});
 for(let i=0;i<4;i++)assert.equal(await fn(),[101,105,112,118][i]);
 assert.deepEqual(samples,[101,105,112,118]);
 assert.deepEqual(regCalls,[0x2A,0x28,0x2A,0x26,0x2A,0x30,0x2A,0x2E]);
 assert.equal(st.adc.s,118);
 assert.ok(log.some(x=>x.includes('ADC_S wird weiterhin aktualisiert')));
});

test('After successful PLC startup read the volatile PLC enable bit without writing NVM',()=>{
 const app=read('app.js');
 const startup=routine(app,'testSsp3PowerStartup');
 assert.ok(startup.includes("const cfg=await readReg(0x06,1800)"));
 assert.ok(startup.includes('st.powerCycleResult.plcEnabledInRam=!!(cfg&0x0004)'));
 assert.ok(startup.includes('st.powerCycleResult.plcEnabledInRam=null'));
 assert.ok(startup.includes('st.powerCycleResult.plcConfigReadError=String(e.message||e)'));
 assert.ok(startup.includes("plc_en ist im RAM 0"));
 assert.ok(startup.indexOf('st.powerCycleResult.readVerified=true;')<startup.indexOf("const cfg=await readReg(0x06,1800)"));
 assert.ok(startup.includes("show('connMsg',statusText,plcRamState===false?'warn':'success')"));
 for(const forbidden of ['nvmProgram(', 'nvmWrite(', 'maintWrite(', 'writeReg(0x06', 'port.close('])
  assert.ok(!startup.includes(forbidden));
});

test('After SSP3 detection read-only live polling starts even if full NVM boot proof pending',()=>{
 const app=read('app.js');
 const power=routine(app,'testSsp3PowerStartup');
 assert.ok(power.includes("st.chip&&Number.isFinite(st.adc?.s)&&!st.manualLivePause"));
 assert.ok(power.includes("startLive();"));
 assert.ok(!power.includes("if(st.powerCycleResult?.readVerified&&st.port===port"));
 assert.ok(power.includes("st.powerCycleResult.readVerified=true;"));
 assert.match(routine(app,'nvmProgramOperation'),/CAL\.protectStartupCommunication\(initial,modified,\{allowSvdd,allowAlarmMask:.*operatingProfile,interfaceMode:st\.iface,allowTimedOneWire:timedOneWire\}\)/);
});
test('Live ADC attempts and successes visible and exported without new chip writes',()=>{
 const app=read('app.js'),html=read('index.html');
 const f=app.split('function startLive(){')[1]?.split('function stopLive(){')[0];
 assert.ok(f.includes('st.liveReadAttempts++'));
 assert.ok(f.includes('st.liveReadSuccesses++'));
 assert.ok(f.includes('st.liveLastError=String(e.message||e)'));
 assert.ok(f.includes('renderLiveOverview()'));
 assert.ok(html.includes('id="liveDiagnostic"'));
 assert.ok(app.includes('liveDiagnostic:{active:st.live,attempts:st.liveReadAttempts'));
 assert.ok(app.includes('plcEnabledInRam:st.powerCycleResult?.plcEnabledInRam??null'));
 assert.ok(!f.includes('nvmWrite('));
});

test('E703.11 CFG_PERIOD maps to documented conversion modes',()=>{
 const P=require('../app.js');
 for(const [raw,mode] of [[0,'disabled'],[1,'continuous'],[2,'single'],[3,'periodic'],[65535,'periodic'],[null,'unknown']])
  assert.equal(P.periodMode(raw),mode);
});
test('SSP3 startup reads CFG_PERIOD and STATUS without changing communication config',()=>{
 const app=read('app.js');
 const power=routine(app,'testSsp3PowerStartup');
 assert.ok(power.includes('st.measurementPeriod=await readReg(0x0E,1800)'));
 assert.ok(power.includes('st.measurementStatus=await readReg(0x36,1800)'));
 // The *existing* documented Magic Cookie deliberately uses address 0x0E
 // with data 0x5CFD; never reject that sequence as a CFG_PERIOD rewrite.
 assert.ok(power.includes('P.plcWrite(0x0E,0x5CFD,st.plcAddress)'));
 // The new write is RAM-only and permitted solely to undo the cookie-induced period.
 assert.ok(power.includes("st.powerCycleResult.magicCookieUsed===true&&st.measurementPeriod===0x5CFD"));
 assert.ok(power.includes('P.plcWrite(0x0E,0x0001,st.plcAddress)'));
 assert.ok(!power.includes('P.plcWrite(0x06'));
});
test('Single mode triggers documented CMD.start with fresh ADC flag confirmation',()=>{
 const app=read('app.js'),live=routine(app,'readLiveSample'),trigger=routine(app,'triggerSingleMeasurement');
 assert.match(trigger,/if\(st\.measurementPeriod!==2\)return/);
 assert.match(trigger,/P\.plcWrite\(0x22,0x8B93,st\.plcAddress\)/);
 assert.match(trigger,/i2cWriteCommand\(0x22,0x8B93\)/);
 assert.match(trigger,/const flags=await readReg\(0x36,1600\)/);
 assert.match(trigger,/if\(flags&0x0002\)\{fresh=true;break\}/);
 assert.ok(live.indexOf('await triggerSingleMeasurement()')<live.indexOf('readReg(0x2A,1600)'));
 for(const forbidden of ['P.plcWrite(0x0E','P.plcWrite(0x06','nvmWrite(','nvmProgram(','PWR_OFF'])assert.ok(!(live+trigger).includes(forbidden));
});

test('Period mode, single-shot starts and actual ADC changes exported for diagnosis',()=>{
 const app=read('app.js');
 assert.ok(app.includes("CFG_PERIOD '+(st.measurementPeriod==null"));
 assert.ok(app.includes('startCommandsSent:st.measurementStarts,adcChanges:st.measurementFreshCount'));
 assert.ok(app.includes('st.measurementFreshCount++'));
});

test('Cookie-only SSP3 live setup repairs CFG_PERIOD only in RAM with readback',()=>{
 const app=read('app.js');
 const power=routine(app,'testSsp3PowerStartup');
 assert.ok(power.includes("st.powerCycleResult.magicCookieUsed===true&&st.measurementPeriod===0x5CFD"));
 assert.ok(power.includes('P.plcHostCommand(P.plcWrite(0x0E,0x0001,st.plcAddress),st.plcHostFormat)'));
 assert.ok(power.includes('const check=await readReg(0x0E,1800)'));
 assert.ok(power.includes('if(check!==0x0001)throw Error('));
 assert.ok(power.includes('P.plcHostCommand(P.plcWrite(0x22,0x8B93,st.plcAddress),st.plcHostFormat)'));
 assert.ok(power.includes('st.powerCycleResult.livePeriodAdjustedInRam=true'));
 assert.ok(power.includes('st.powerCycleResult.livePeriodAdjustmentError=st.measurementError'));
 const block=power.split('// Magic Cookie writes its second frame to 0x0E')[1]?.split("st.powerCycleResult.stage='verified'")[0];
 for(const bad of ['nvmScan(', 'nvmProgram(', 'nvmWrite(', 'maintWrite(', 'P.plcWrite(0x06', 'P.plcWrite(0x08', 'P.plcWrite(0x0A'])assert.ok(!block.includes(bad));
});
test('Manual pause respected, RAM-only live correction exported and NVM gates unchanged',()=>{
 const app=read('app.js'),cal=read('calibration.js');
 assert.ok(app.includes('st.manualLivePause=true;stopLive()'));
 assert.ok(app.includes('st.manualLivePause=false;startLive()'));
 assert.ok(app.includes("st.powerCycleResult?.livePeriodAdjustedInRam?' (RAM-Live-Modus)'"));
 assert.ok(app.includes('cookiePeriodAdjusted:st.powerCycleResult?.livePeriodAdjustedInRam??false'));
 assert.ok(cal.includes('for(const index of [17,...(allowAlarmMask?[]:[18]),19])'));
});

test('analog clipping rounds voltage limits inward and preserves One Wire settings',()=>{
 const before=safeNvm();before[17]&=~4;
 before[59]=3;before[60]=3;
 const settings={mode:'1',scaleEnabled:true,gain:0.7,offset:0};
 const clipping={mode:'on',low:0.5,high:4.5,vdd:5};
 const after=CAL.prepareOutputConfig(before,{...settings,clipping},32000);
 assert.equal(after[16]&0x80,0x80);
 assert.equal(after[59],0x999c);
 assert.equal(after[60],0x6664);
 assert.deepEqual(after.slice(17,20),before.slice(17,20));
 assert.equal(CAL.prepareOutputConfig(after,{...settings,clipping:{mode:'off'}})[16]&0x80,0);
 assert.equal(CAL.prepareOutputConfig(after,settings)[16]&0x80,0x80);
 // Clipping thresholds and guaranteed analog linearity range are distinct.
 const extended=CAL.prepareOutputConfig(before,{...settings,clipping:{...clipping,high:4.6}});
 assert.ok(extended[60]>after[60]);
 assert.throws(()=>CAL.prepareOutputConfig(before,{...settings,clipping:{...clipping,high:5.1}}),/Clipping/);
 assert.throws(()=>CAL.prepareOutputConfig(before,{...settings,gain:1.0,clipping}),/10–90/);
 before[16]|=0x100;
 before[61]=1;
 assert.throws(()=>CAL.prepareOutputConfig(before,{...settings,clipping}),/Fehlerreaktionen/);
});

test('ESP32-C3 output-only NVM is capability-gated and scope-limited',()=>{
 const app=read('app.js'),fw=read('firmware/esp32c3_supermini/esp32c3_supermini.ino');
 const proMicro=read('firmware/pro_micro/pro_micro.ino');
 assert.ok(fw.includes('BRIDGE_AODO_OUTPUT_NVM_TEST'));
 assert.ok(fw.includes('strcmp(command, "NVM ARM OUTPUT") == 0'));
 assert.ok(fw.includes('if (!coldStartMatches() || probe(activeSlave))'));
 assert.ok(fw.includes('readOriginalOutputCfgEn(cfg)'));
 assert.ok(fw.includes('~uint16_t(0x00C0)'));
 assert.ok(fw.includes('index == 57 || index == 58 || index == 59 || index == 60 || index == 63'));
 assert.ok(fw.includes('outputDataPending = false;'));
 assert.ok(fw.includes('disarmNvm();'));
 assert.ok(app.includes("st.bridgeOutputNvm=st.bridgeUserNvm||(isEsp32C3&&caps.includes('BRIDGE_AODO_OUTPUT_NVM_TEST'))"));
 assert.ok(app.includes("outputOnly?'NVM ARM OUTPUT':'NVM ARM CALIBRATION'"));
 assert.ok(app.includes("if(st.adapterKind==='bridge'&&!st.bridgeOutputNvm)"));
 assert.ok(app.includes('const outputWords=new Set([16,57,58,59,60,63]);'));
 assert.match(routine(app,'nvmProgramOperation'),/CAL\.protectStartupCommunication\(initial,modified,\{allowSvdd,allowAlarmMask:.*operatingProfile,interfaceMode:st\.iface,allowTimedOneWire:timedOneWire\}\)/);
 assert.ok(app.includes('if(finalRecoveryBlock)throw Error(finalRecoveryBlock)'));
 assert.ok(app.includes('if(after.some((x,i)=>x!==modified[i]))'));
 assert.ok(!proMicro.includes('BRIDGE_AODO_OUTPUT_NVM_TEST'));
});

test('Clipping activation enters real VDD defaults but never overwrites edited limits',()=>{
 const expert=read('expert.js');
 const begin=expert.indexOf('  function renderOutputMode(){');
 const end=expert.indexOf("  $('expertOutputMode').addEventListener",begin);
 assert.ok(begin>0&&end>begin);
 const ids=['expertOutputMode','outputClippingFields','outputClipLow','outputClipHigh','outputClippingMode',
  'psscVdd','expertPwmPeriodField','psscAnalogFields','psscScalingSection','expertOutputPreset','outputModeHint'];
 const fields=Object.fromEntries(ids.map(id=>[id,{value:'',valueAsNumber:5,hidden:false,disabled:false,textContent:''}]));
 fields.expertOutputMode.value='1';fields.outputClippingMode.value='keep';
 const render=new Function('$','isAnalog','refreshOutputReadOnly','renderOutputPreview',
  expert.slice(begin,end)+'return renderOutputMode;')(
   id=>fields[id],mode=>['1','2','3'].includes(String(mode)),()=>{},()=>{});
 render();
 assert.equal(fields.outputClipLow.value,'');
 assert.equal(fields.outputClipLow.disabled,true);
 fields.outputClippingMode.value='on';render();
 assert.equal(fields.outputClipLow.value,'0.5');
 assert.equal(fields.outputClipHigh.value,'4.5');
 assert.equal(fields.outputClipLow.disabled,false);
 fields.outputClipLow.value='0.6';render();
 assert.equal(fields.outputClipLow.value,'0.6');
 fields.outputClippingMode.value='keep';render();
 fields.outputClippingMode.value='on';render();
 assert.equal(fields.outputClipLow.value,'0.6');
 fields.outputClipLow.value='';fields.outputClipHigh.value='';fields.psscVdd.valueAsNumber=3.3;render();
 assert.equal(fields.outputClipLow.value,'0.33');
 assert.equal(fields.outputClipHigh.value,'2.97');
});

test('Output-only NVM action displays persistent stages and preserves verified plan during archive capture',()=>{
 const app=read('app.js'),html=read('index.html'),guided=read('guided.js'),compact=read('compact.js');
 assert.ok(html.includes('id="nvmWriteStatus"')&&html.includes('id="nvmWriteBar"'));
 assert.ok(app.includes("await archive.begin((outputOnly||alarmOnly)?'output':'calibration')"));
 assert.ok(app.includes('const verifiedAlready=hasCurrentNvmBackup();'));
 assert.ok(app.includes('const readOK=verifiedAlready||await nvmScan({expertRead:true});'));
 assert.ok(app.includes('st.calImage?.before!==initial||st.calImage?.after!==modified'));
 assert.ok(app.includes('if(st.nvmAttempting||st.nvmWorking||st.writing)return;'));
 assert.ok(app.includes('NVM-Rücklesung und Kontrolle: '));
 assert.ok(app.includes('NVM nicht erfolgreich gespeichert: '));
 assert.ok(guided.includes("moveId('nvmWriteStatus','gwNvmWrite')"));
 assert.ok(compact.includes("moveId('nvmWriteStatus','cpNvmProgram')"));
 const begin=app.indexOf(' function nvmWriteFeedback(');
 const end=app.indexOf(' async function nvmProgram()',begin);
 assert.ok(begin>0&&end>begin);
 const elements=Object.fromEntries(['nvmWriteStatus','nvmWriteStatusText','nvmWriteBar']
  .map(id=>[id,{hidden:true,dataset:{},textContent:'',removeAttribute(key){this[key]=undefined}}]));
 const update=new Function('$',app.slice(begin,end)+'return nvmWriteFeedback;')(id=>elements[id]);
 update('Schreibfortschritt','progress',2,4);
 assert.equal(elements.nvmWriteStatus.hidden,false);
 assert.equal(elements.nvmWriteBar.value,2);
 assert.equal(elements.nvmWriteStatus.dataset.state,'progress');
 update('Kein Archiv','error');
 assert.equal(elements.nvmWriteStatus.dataset.state,'error');
 assert.equal(elements.nvmWriteBar.hidden,true);
});


test('NVM Magic-Cookie proof: PSSC and genuine AN0204 SSP3 cold starts are equivalent',()=>{
 const src=read('app.js');
 const begin=src.indexOf(' function psscRecoveryProven(){');
 const end=src.indexOf(' function psscNvmBlock(',begin);
 assert.ok(begin>0&&end>begin,'cold-start proof helper must exist');
 const make=new Function('st',src.slice(begin,end)+'return psscRecoveryProven;');
 const port={},uid='0020018A487B';
 const power={port,session:7,stage:'verified',powerRestored:true,
  readVerified:true,verifiedUid:uid,plcAddress:'0x6C',plcEnabledInRam:true,
  steps:[{command:'PWR_OFF 03E8',ok:true},
         {command:'PWR_ON 0C80 00C8 0 -> PLC T',ok:true}]};
 const st={adapterKind:'ssp3',iface:'plc',port,chip:true,uid:{hex:uid},
  sessionIndex:7,plcAddressVerified:true,plcAddress:0x6C,
  startupTrials:[],powerCycleResult:power};
 assert.equal(make(st)(),true,'full AN0204 cold start must unlock proof');
 const pssc={stage:'PSSC-RAM-Start',port,session:7,
  powerRestored:true,readVerified:true,verifiedUid:uid};
 assert.equal(make({...st,powerCycleResult:null,startupTrials:[pssc]})(),true,
  'PSSC cold start remains supported');
 for(const [name,override] of Object.entries({
  noOff:{steps:power.steps.slice(1)},
  noOn:{steps:power.steps.slice(0,1)},
  wrongUid:{verifiedUid:'DEADBEEF'},
  staleSession:{session:6},
  stalePort:{port:{}},
  notRead:{readVerified:false},
  powerNotRestored:{powerRestored:false},
  wrongAddress:{plcAddress:'0x7C'},
  plcNotEnabled:{plcEnabledInRam:false},
  noRamConfirmation:{plcEnabledInRam:null},
  failedStartup:{stage:'failed'}
 })){
  assert.equal(make({...st,powerCycleResult:{...power,...override}})(),false,name);
 }
 assert.equal(make({...st,plcAddress:0x7C})(),false,'current address mismatch');
 assert.equal(make({...st,plcAddressVerified:false})(),false,'address not verified');
 assert.equal(make({...st,chip:false})(),false,'chip missing');
 assert.equal(make({...st,adapterKind:'bridge'})(),false,'bridge cannot borrow SSP3 proof');
 assert.equal(make({...st,sessionIndex:8})(),false,'connection session changed');
 assert.equal(make({...st,powerCycleResult:null,startupTrials:[{...pssc,verifiedUid:'OTHER'}]})(),false,
  'PSSC proof must match UID');
 assert.equal(make({...st,powerCycleResult:null,startupTrials:[{...pssc,port:{}}]})(),false,
  'PSSC proof must match USB port');
});


test('DSP saturation is visible before NVM and never bypasses DSP verification',()=>{
 const app=read('app.js'),html=read('index.html');
 assert.ok(app.includes('const tightHeadroom=solution.outputLimit>=31000'));
 assert.ok(app.includes('const status=await readReg(0x32)'));
 assert.ok(app.includes('if(status&0x0400)'));
 assert.ok(app.includes("saturationWarning='STATUS_SYNC.dsp_sat gesetzt"));
 assert.ok(app.includes('if(stat&0x0400)'));
 assert.ok(app.includes('Der Chip meldet interne Sättigung'));
 assert.ok(app.includes('NVM bleibt bis zu einer bestandenen neuen DSP-Prüfung gesperrt.'));
 assert.ok(app.includes('st.calVerified=false;st.calImage=null'));
 assert.ok(html.includes('calRamStageMsg')&&html.includes('calRamMsg'));
});

test('AODO preflight warns on outdated scaling after recalculating DSP',()=>{
 const app=read('app.js'),guide=read('guided.js'),html=read('index.html');
 const start=app.indexOf(' function outputScalingPreflight(){');
 const end=app.indexOf(' function renderFlowState(){',start);
 assert.ok(start>0&&end>start);
 const build=new Function('st','CAL','$','hasCurrentNvmBackup',
  app.slice(start,end)+'return outputScalingPreflight;');
 const values={expertOutputMode:'1',psscVdd:'5',psscS0:'0.5',psscS1:'4.5'};
 const fields=id=>({value:values[id]});
 const original=safeNvm();original[17]&=~4;
 // The initial NVM has no AODO scaling, while the new DSP fit is for 30k digits.
 const st={calfit:{outputLimit:30000},calStaged:true,nvmBackup:original,regs:{},
  expertOutputPlan:null};
 const needed=(state,field=fields,hasBackup=()=>true)=>
  build(state,CAL,field,hasBackup,()=>false,()=>false)().required;
 assert.equal(needed(st),true,'not-yet-programmed AODO must be detected');
 const scale=CAL.analogScaling(.5,4.5,5,30000);
 const plan={mode:'1',scaleEnabled:true,gain:scale.gain,offset:scale.offset,
  clipping:{mode:'keep'}};
 assert.equal(needed({...st,expertOutputPlan:plan}),false,
  'an explicitly verified valid AODO proposal resolves the warning');
 assert.equal(needed({...st,expertOutputPlan:{...plan,gain:plan.gain*1.15}}),true,
  'incorrect stale plan must not pass');
 assert.equal(needed({...st,calfit:null}),false);
 assert.equal(needed({...st,coldStartAfeRestored:true,nvmBackup:CAL.prepareOutputConfig(original,plan,30000)}),true);
 assert.equal(needed({...st,coldStartAfeRestored:true,expertOutputPlan:plan}),false);
 assert.equal(needed({...st,nvmBackup:CAL.prepareOutputConfig(original,plan,30000)}),false,
  'correct pre-existing AODO need not be modified');
 assert.equal(needed(st,id=>({value:id==='psscS0'?'4.8':values[id]})),true,
  'invalid voltage targets are safely reported');
 assert.equal(needed({...st,adapterKind:'bridge'},fields,()=>false),true,
  'an unread original NVM must not silently hide a missing AODO review');
 assert.equal(needed({...st,expertOutputPlan:plan},fields,()=>false),false,
  'a deliberately staged plan can continue to the final NVM hardware checks');
 assert.ok(app.includes('st.expertOutputPlan=null;st.outputOnlyPlan=null;'));
 assert.ok(app.includes('outputScalingRequired:outputScalingPreflight().required'));
 assert.ok(guide.includes("if(task==='calibration'&&s.outputScalingRequired)"));
 assert.ok(guide.includes("'outputScalingAdvisory'"));
 assert.ok(guide.includes("'nvmOutputAdvisory'"));
 for(const id of ['outputScalingAdvisory','nvmOutputAdvisory'])
  assert.ok(html.includes('id="'+id+'"'),id+' present for classic and guided views');
});


test('AN0204 proof: recover failed initial PLC-RAM read only after authenticated hardware cold start',async()=>{
 const app=read('app.js');
 const begin=app.indexOf(' function psscRecoveryProven(){');
 const end=app.indexOf(' function psscNvmBlock(',begin);
 assert.ok(begin>0&&end>begin,'startup proof functions must exist');
 const factory=new Function('st','readReg','P','h','logging','stopLive','startLive',
  app.slice(begin,end)+'return {valid:psscRecoveryProven,refresh:refreshPsscRecoveryProofReadOnly,evidence:psscRecoveryEvidence};');
 const port={},uid='0020018A487B';
 const proof={
  port,session:3,stage:'verified',powerRestored:true,readVerified:true,
  verifiedUid:uid,plcAddress:'0x6C',plcEnabledInRam:null,
  steps:[{ok:true,command:'PWR_OFF 03E8'},
         {ok:true,command:'PWR_ON 0C80 00C8 0 -> PLC T'}]
 };
 const base={
  adapterKind:'ssp3',iface:'plc',chip:true,port,sessionIndex:3,
  uid:{hex:uid},plcAddressVerified:true,plcAddress:0x6C,
  startupTrials:[],powerCycleResult:proof,closing:false,calTask:false,
  writing:false,nvmWorking:false,manualLivePause:false,live:true,liveReadPromise:null
 };
 async function evaluate(state,ram=0x6C04, address=0x6C){
  const calls=[],logs=[];
  const api=factory(state,async reg=>{calls.push(reg);return reg===0x06?ram:0x081F;},
   {plcAddressFromConfig:()=>address},v=>Number(v).toString(16),
   s=>logs.push(s),()=>{state.live=false},()=>{state.live=true});
  return {ok:await api.refresh(),calls,logs,valid:api.valid(),reason:api.evidence()};
 }
 const successful=await evaluate({...base,powerCycleResult:{...proof}});
 assert.equal(successful.ok,true,'original, verified power cycle can be completed by RAM readback');
 assert.deepEqual(successful.calls,[0x06,0x0A],'read-only CFG/RAM registers');
 assert.ok(successful.logs.some(l=>l.includes('Kein Power-Cycle und kein Schreibvorgang')));
 assert.equal(await evaluate({...base,powerCycleResult:{...proof,plcEnabledInRam:true}}).then(r=>r.calls.length),0);
 const noProof=await evaluate({...base,powerCycleResult:null});
 assert.equal(noProof.ok,false,'connected sensor alone is insufficient');
 assert.deepEqual(noProof.calls,[]);
 assert.match(noProof.reason,/Kein protokollierter SSP3-Power-Cycle/);
 for(const [name,change] of Object.entries({
  missingOff:{steps:proof.steps.slice(1)},missingOn:{steps:proof.steps.slice(0,1)},
  staleSession:{session:2},stalePort:{port:{}},wrongUid:{verifiedUid:'DEADBEEF'},
  notPowered:{powerRestored:false},readNotVerified:{readVerified:false},
  failedStart:{stage:'failed'},wrongAddress:{plcAddress:'0x7C'}
 })){
  const r=await evaluate({...base,powerCycleResult:{...proof,...change}});
  assert.equal(r.ok,false,name);
  assert.deepEqual(r.calls,[],name+' must not trigger a fake recovery read');
 }
 assert.equal((await evaluate({...base,powerCycleResult:{...proof}},0x6C00)).ok,false,
  'PLC enable bit must be read from actual RAM');
 assert.equal((await evaluate({...base,powerCycleResult:{...proof}},0x6C04,0x7C)).ok,false,
  'PLC address must agree with sensor configuration');
 const pssc={stage:'PSSC-RAM-Start',port,session:3,powerRestored:true,readVerified:true,verifiedUid:uid};
 const alternate=await evaluate({...base,powerCycleResult:null,startupTrials:[pssc]});
 assert.equal(alternate.ok,true,'previously supported valid PSSC start remains accepted');
 assert.deepEqual(alternate.calls,[]);
});


test('SSP3 prepares a combined calibration in the verified live session without changing startup settings',async()=>{
 const app=read('app.js');
 const start=app.indexOf(' function bridgeColdStartVerified(){');
 const end=app.indexOf(' // Read-only early warning:',start);
 const profileHelpers=app.slice(app.indexOf(' function activePreflight(){'),app.indexOf(' async function calibrationPreflight('));
 const build=new Function('st','CAL','P','$','verificationComplete',
  profileHelpers+app.slice(start,end)+'return {allowed:ssp3CalibrationWithoutRestart,block:psscNvmBlock};');
 const before=safeNvm();
 before[16]=0x1216;
 before[17]=0x6C00;
 before[19]&=~(1<<8);
 before[21]=1;
 before[22]=0x0880;
 before[28]=0x0800;
 before[63]=CAL.crc16(before);
 assert.equal(CAL.oneWireStartupStatus(before).requiresCookie,true);
 const after=before.slice();
 after[16]|=1<<6;
 after[33]=0xEC95;
 after[58]=0x0DFA;
 after[63]=CAL.crc16(after);
 const uid={hex:'0020018A487B',ser0:before[0],ser1:before[1]};
 const state={
  adapterKind:'ssp3',iface:'plc',mode:'usb',port:{},chip:true,uid,sessionIndex:7,
  plcAddress:0x6C,plcAddressVerified:true,regs:{0x06:0x6C04},calStaged:true,
  nvmBackup:before,nvmBackupVerified:true,nvmBackupProof:{session:7,uid:uid.hex,words:before},
  expertOutputPlan:{mode:'1',scaleEnabled:true},startupTrials:[],powerCycleResult:null
 };
 const api=(overrides={},backup=true,verified=true)=>build({...state,...overrides},CAL,
  require('../app.js'),()=>({checked:backup}),()=>verified);
 assert.equal(api().allowed(before,after,true),true);
 assert.equal(api().block(before,after,false,false,false,true),'');
 const calibrationFit={outputLimit:30000,registers:{so:0xEC95,sf:0x4C07,coeffs:Array(16).fill(0)}};
 const liveState={...state,calfit:calibrationFit,afe:0x0800,afe0:0,
  expertOutputPlan:{...state.expertOutputPlan,...CAL.analogScaling(0.5,4.5,5,30000),clipping:{mode:'keep'}}};
 const fields={
  nvmAutoBackup:{checked:true},expertOutputMode:{value:'1'},psscS0:{value:'0.5'},
  psscS1:{value:'4.5'},psscVdd:{value:'5'},nvmDiff:{},nvmProgress:{}
 };
 const prepareStart=app.indexOf(' async function prepareNvmOperation(){');
 const prepareEnd=app.indexOf(' function nvmWriteFeedback(',prepareStart);
 const messages=[];
 const ram=new Map([[0x00,13],[0x02,14],[0x04,16],[0x0E,21],[0x14,24],
  [0x16,25],[0x18,26],[0x1A,27],[0x1C,28],[0x1E,29]].map(([addr,index])=>[addr,before[index]]));
 const prepare=new Function('st','CAL','P','$','verificationComplete','coefficientSettingsCurrent',
  'requestedNvmUserId','readNvmBridgeSupply','ELMOS_ALARM_EDITOR','h','ca','renderFlowState',
  'verificationRequiredCount','stopLive','startLive','logging','readReg','demoEnabled','assertPreflightForFit',
  profileHelpers+app.slice(start,end)+app.slice(prepareStart,prepareEnd)+'return prepareNvmOperation;')(
  liveState,CAL,require('../app.js'),id=>fields[id],()=>true,()=>true,
  ()=>undefined,async()=>0,{pendingForCalibration:()=>false},v=>v.toString(16),
  (...args)=>messages.push(args),()=>{},()=>1,()=>{},()=>{},()=>{},async address=>ram.get(address),false,()=>{assert.ok(liveState.calibrationPreflight);return liveState.calibrationPreflight;});
 liveState.calibrationPreflight={uid:uid.hex,session:7,port:state.port,words:before,allowOperatingChanges:false};
 await prepare();
 assert.equal(messages.at(-1)?.[2],'warn',messages.at(-1)?.[1]);
 assert.equal(liveState.calImage.recoveryCombined,true);
 assert.equal(CAL.analogOutputStatus(liveState.calImage.after,0.5,4.5,5,30000).ok,true);
 assert.deepEqual(liveState.calImage.after.slice(17,28),before.slice(17,28));
 liveState.coldStartAfeRestored=true;
 await prepare();
 assert.equal(messages.at(-1)?.[2],'warn',messages.at(-1)?.[1]);
 assert.equal(liveState.calImage.recoveryCombined,true,'AFE recovery can prepare a matching profile');
  const savedEn=before[16];
  before[16]&=~3;before[63]=CAL.crc16(before);
  await prepare();
  assert.equal(messages.at(-1)?.[2],'warn',messages.at(-1)?.[1]);
  assert.equal(liveState.calImage.activatePressureCorrection,true);
  assert.equal(liveState.calImage.after[16]&3,2);
  assert.equal(CAL.crc16(liveState.calImage.after),liveState.calImage.after[63]);
  assert.deepEqual(liveState.calImage.after.slice(17,28),before.slice(17,28));
  ram.set(0x04,savedEn&~3);
  await prepare();
  assert.equal(liveState.calImage,null);
  assert.match(messages.at(-1)?.[1],/DSP-Druckkorrektur im RAM nicht aktiv/);
  ram.set(0x04,savedEn);before[16]=savedEn;before[63]=CAL.crc16(before);
 for(const [address,name] of [[0x04,'CFG_EN'],[0x0E,'CFG_PERIOD'],[0x18,'CFG_LP1'],[0x1C,'CFG_AFE1'],[0x1E,'CFG_AFE2']]){
  const saved=ram.get(address);
  ram.set(address,saved^1);
  await prepare();
  assert.equal(liveState.calImage,null);
  assert.match(messages.at(-1)?.[1],new RegExp(name+' im RAM'));
  ram.set(address,saved);
 }
 for(const operation of [[true,false,false],[false,true,false],[false,false,true]])
  assert.notEqual(api({coldStartAfeRestored:true}).block(before,after,...operation,true),'');
 for(const [index,mask] of [[0,1],[16,1<<9],[17,4],[18,1<<12],[19,1<<8],[22,1],[CAL.SVDD_INDEX,1]]){
  const changed=after.slice();
  changed[index]^=mask;
  changed[63]=CAL.crc16(changed);
  assert.equal(api().allowed(before,changed,true),false,'protected word '+index);
  assert.notEqual(api().block(before,changed,false,false,false,true),'');
 }
 for(const overrides of [
  {sessionIndex:8},{uid:{...uid,hex:'other'}},{plcAddress:0x7C},
  {plcAddressVerified:false},{adapterKind:'bridge'},
  {calStaged:false},{expertOutputPlan:null},{sensorLost:true},
 ]){
  assert.equal(api(overrides).allowed(before,after,true),false);
 }
 assert.equal(api({},false).allowed(before,after,true),false);
 assert.equal(api({},true,false).allowed(before,after,true),false);
 for(const operation of [[true,false,false],[false,true,false],[false,false,true]])
  assert.notEqual(api().block(before,after,...operation,true),'');
 assert.equal(api().allowed(before,after,false),false);
 const write=app.slice(app.indexOf(' async function nvmProgramOperation('));
 assert.ok(write.includes('const verifyWords=Array.from({length:64},(_,i)=>i)'));
 const fullRead=write.indexOf('const verifyWords=');
 const ramCheck=write.indexOf('of activeCalibrationRamWords()',fullRead);
 const enable=write.indexOf('for(const x of [0x98BD',fullRead);
 const profileCheck=write.indexOf('await verifyRecoveredCalibrationProfile(modified)',fullRead);
 assert.ok(fullRead<profileCheck&&profileCheck<ramCheck&&ramCheck<enable,'verify 64 words and active DSP before enabling writes');
});

test('ESP32-C3 combined DSP/AODO recovery requires generic user NVM and cold-start UID proof',()=>{
 const app=read('app.js');
 const start=app.indexOf(' function bridgeColdStartVerified(){');
 const end=app.indexOf(' function hasCurrentNvmBackup(){',start);
 assert.ok(start>0&&end>start);
 const build=new Function('st','CAL','$','hasCurrentNvmBackup',
  app.slice(start,end)+'return {ready:bridgeCombinedRecoveryReady,block:psscNvmBlock};');
 const port={},uid='0020018A487B';
 const base={adapterKind:'bridge',bridgeBoard:'ESP32-C3 SuperMini',
  bridgeGenericRam:true,bridgeUserNvm:true,bridgeOutputNvm:true,
  bridgeCalibrationNvm:true,bridgeReadOnly:false,iface:'plc',
  port,sessionIndex:42,uid:{hex:uid},bridgeColdStart:{port,session:42,uid},
  expertOutputPlan:{mode:'1',scaleEnabled:true},regs:{},psscRamRecovery:true};
 const before=Array(64).fill(0);
 before[16]=(1<<9)|(1<<6);before[17]=4;
 before[19]=(1<<11)|(1<<8)|(1<<7);before[63]=CAL.crc16(before);
 const after=before.slice();
 after[33]=0x0200;after[34]=0x4000;after[58]=0x10A3;
 after[63]=CAL.crc16(after);
 const testCase=(model,planned=after,backup=true)=>{
  const api=build(model,CAL,()=>({checked:true}),()=>backup);
  return api.block(before,planned,false,false,false,true);
 };
 assert.equal(testCase(base),'','valid generic ESP32 combined recovery');
 for(const [name,changes] of Object.entries({
  noGenericCapability:{bridgeGenericRam:false},
  noUserNvm:{bridgeUserNvm:false},
  noAodoCapability:{bridgeOutputNvm:false},
  noColdStart:{bridgeColdStart:null},
  staleSession:{sessionIndex:43},
  wrongUid:{uid:{hex:'DEADBEEF'}},
  wrongPort:{port:{}},
  wrongBoard:{bridgeBoard:'Arduino Pro Micro'},
  noAodoPlan:{expertOutputPlan:null},
  wrongInterface:{iface:'i2c'},
  readOnly:{bridgeReadOnly:true}
 })){
  assert.notEqual(testCase({...base,...changes}),'',name+' must block');
 }
 assert.notEqual(testCase(base,after,false),'','original NVM backup must be current');
 const tampered=after.slice();tampered[17]^=4;
 tampered[63]=CAL.crc16(tampered);
 assert.notEqual(testCase(base,tampered),'','communication boot register cannot change');
 const alteredMode=after.slice();alteredMode[16]^=0x0200;
 alteredMode[63]=CAL.crc16(alteredMode);
 assert.notEqual(testCase(base,alteredMode),'','AODO mode may not change during recovery');
 const firmware=read('firmware/esp32c3_supermini/esp32c3_supermini.ino');
 assert.ok(firmware.includes('BRIDGE_USER_NVM_V1'));
 assert.ok(firmware.includes('strcmp(command, "NVM ARM HOST") == 0'));
 assert.ok(firmware.includes('if (!coldStartMatches() || probe(activeSlave))'));
 assert.ok(app.includes("i2cNvmSupported()?'I2C ARM HOST':st.bridgeUserNvm?'NVM ARM HOST'"));
 assert.ok(app.includes('if(!bridgeCombinedRecoveryReady())'));
 assert.ok(app.includes('const finalRecoveryBlock=psscNvmBlock('));
});


test('DSP limit and saturation display a prominent, deduplicated accessible dialog',()=>{
 const app=read('app.js'),html=read('index.html'),guide=read('guided.js');
 for(const id of ['dspRiskDialog','dspRiskTitle','dspRiskDescription','dspRiskAdvice',
                   'dspRiskDismiss','dspRiskApplyLimit']){
  assert.equal(html.split('id="'+id+'"').length-1,1,'dialog element '+id);
 }
 assert.ok(html.includes('aria-labelledby="dspRiskTitle"'));
 assert.ok(html.includes('.dsp-risk-dialog::backdrop'));
 assert.ok(app.includes('function showDspRiskPopup({key,type,title,description,advice,suggestedLimit})'));
 assert.ok(app.includes("key:'high-dsp-limit:'+solution.outputLimit"));
 assert.ok(app.includes("key:'coefficient-overflow:'"));
 assert.ok(app.includes("key:'ram-saturation:'"));
 assert.ok(app.includes("key:'verification-saturation:'"));
 assert.ok(app.includes("if(stat&0x0400)"));
 assert.ok(app.includes('shownDspRiskWarnings.clear()'));
 assert.ok(app.includes("dispatchEvent(new Event('change',{bubbles:true}))"));
 assert.ok(app.includes('window.ELMOS_GUIDED.goToCoefficients?.()'));
 assert.ok(guide.includes("goToCoefficients:()=>{if(mode&&task==='calibration'&&!nextSensorPending)goto(5)}"));
 // Verify the popup only acts on local DOM. Showing it cannot alter NVM.
 const begin=app.indexOf(' const shownDspRiskWarnings=new Set();');
 const end=app.indexOf(' function calcCoefficients(){',begin);
 assert.ok(begin>=0&&end>begin);
 const ui={};
 for(const id of ['dspRiskDialog','dspRiskType','dspRiskTitle','dspRiskDescription',
                   'dspRiskAdvice','dspRiskApplyLimit','calDspLimit','operationProgressDialog'])
  ui[id]={textContent:'',dataset:{},hidden:false,open:false,isConnected:true};
 let opens=0;
 ui.dspRiskDialog.showModal=()=>{ui.dspRiskDialog.open=true;opens++};
 ui.calDspLimit.value='32000';
 const factory=new Function('$','window','fmt',
  app.slice(begin,end)+'return showDspRiskPopup;');
 const popup=factory(id=>ui[id],{setTimeout:fn=>fn()},n=>String(n));
 const first={key:'high-limit:32000',type:'DSP-Reserve',title:'Wenig Reserve',
  description:'Nur 767 Digits verbleiben',advice:'DSP-Wert reduzieren',suggestedLimit:30000};
 popup(first);
 assert.equal(opens,1,'high DSP fit opens a modal');
 assert.equal(ui.dspRiskTitle.textContent,'Wenig Reserve');
 assert.equal(ui.dspRiskApplyLimit.dataset.suggestedLimit,'30000');
 assert.equal(ui.dspRiskApplyLimit.hidden,false);
 popup(first);
 assert.equal(opens,1,'same risk never blinks at every repeated update');
 popup({...first,key:'saturation:32000',suggestedLimit:29000});
 assert.equal(ui.dspRiskApplyLimit.dataset.suggestedLimit,'29000','new risk replaces details');
 ui.dspRiskDialog.open=false;
 popup({...first,key:'info-only',suggestedLimit:32000});
 assert.equal(ui.dspRiskApplyLimit.hidden,true,'must not offer a non-reducing limit');
 assert.equal(opens,2,'a new actionable warning may appear once');
});


test('Sensorbrücken-Rechner loads CM64 and complete calibration JSON without discarding NVM on metadata failure',()=>{
 const RECON=require('../nvm-reconstruction.js');
 const words=Array(64).fill(0);
 Object.assign(words,{0:18555,1:394,2:479,3:56064,4:249,5:1793,6:9250,7:6673,
  9:3041,10:1026,11:54003,12:10496,13:4035,14:684,15:18176,16:5078,
  17:27648,18:49152,19:2079,20:15,21:1,22:2176,23:132,24:22947,
  25:12698,26:500,27:3458,28:6400,29:4436,58:4194,59:36044,
  60:29488,61:2688,62:32640,63:10518});
 const nvm={format:'E70311-CM64-v2',uid:'0020018A487B',version:32,words};
 const parsed=RECON.parseNvmImport(nvm,'ELMOS_NVM_20261118.json');
 assert.equal(parsed.words.length,64);
 assert.equal(parsed.uid,'0020018A487B');
 assert.equal(parsed.noPressureCalibration,true,'raw NVM contains no pressure calibration');
 assert.equal(parsed.full,false);
 assert.equal(RECON.calculate(parsed.words).ok,true,'complete EEPROM remains analysable');
 const complete={format:'E70311-CALIBRATION-COMPLETE-v1',type:'calibration',
  chipUID:'0020018A487B',verifiedNvm:true,nvm:{
   programmed:{words,uid:'0020018A487B',crc16:10518}}};
 const good=RECON.parseNvmImport(complete,'Komplettabgleich.json',()=>({name:'Confirmed references'}));
 assert.equal(good.full,true);
 assert.equal(good.profile.name,'Confirmed references');
 assert.equal(good.crc8Valid,true);
 assert.equal(good.crc16Valid,true);
 const damaged=words.slice();
 damaged[35]^=1;
 assert.throws(()=>RECON.parseNvmImport({...nvm,words:damaged}),/CRC16/);
 assert.throws(()=>RECON.parseNvmImport({...complete,nvm:{programmed:{
  ...complete.nvm.programmed,words:damaged}}}),/CRC16/);
 assert.equal(RECON.parseNvmImport(damaged).crc16Valid,false);
 const factoryDamaged=words.slice();
 factoryDamaged[2]^=1;
 factoryDamaged[63]=require('../calibration.js').crc16(factoryDamaged);
 assert.throws(()=>RECON.parseNvmImport({...nvm,words:factoryDamaged}),/CRC8/);
 const missingReferences=RECON.parseNvmImport(complete,'Komplettabgleich.json',()=>{
  throw Error('Reference metadata unavailable');
 });
 assert.equal(missingReferences.words.length,64,
  'invalid optional profile must never discard confirmed EEPROM');
 assert.match(missingReferences.profileWarning,/Reference metadata unavailable/);
 assert.throws(()=>RECON.parseNvmImport({...nvm,uid:'0020018A48FF'}),/Chip-UID/);
 assert.throws(()=>RECON.parseNvmImport({...nvm,words:words.slice(1)}),/64-Wort/);
 assert.throws(()=>RECON.parseNvmImport({...complete,verifiedNvm:false}),/bestätigten/);
 const src=read('nvm-reconstruction.js'),style=read('nvm-reconstruction.css');
 assert.ok(src.includes("upload.addEventListener('click',()=>file.click())"));
 assert.ok(src.includes("state.preferred='file'"));
 assert.ok(src.includes("file.value='';"));
 assert.ok(src.includes('state.fileNotice='));
 assert.ok(src.includes('state.fileError='));
 assert.ok(style.includes('.nvmrecon-import-feedback'));
});

test('I²C NVM requires an I²C cold-start proof for the same port, UID and session',()=>{
 const app=read('app.js');
 const start=app.indexOf(' function bridgeColdStartVerified(){');
 const end=app.indexOf(' function hasCurrentNvmBackup(){',start);
 const block=new Function('st','CAL','$','hasCurrentNvmBackup',
  app.slice(start,end)+'return psscNvmBlock;');
 const port={},uid='0020018A487B';
 const base={adapterKind:'bridge',bridgeUserNvm:true,bridgeCalibrationNvm:true,
  bridgeI2cNvm:true,iface:'i2c',port,sessionIndex:42,uid:{hex:uid},
  bridgeColdStart:{port,session:42,uid,iface:'i2c'},regs:{0x06:0x7C01}};
 const before=Array(64).fill(0);
 before[17]=0x7C03;before[18]=1<<14;
 const after=before.slice();after[33]=0x0200;
 const check=(state,backup=true,checked=true)=>block(state,CAL,()=>({checked}),()=>backup)(before,after);
 assert.equal(check(base),'');
 assert.match(check({...base,bridgeI2cNvm:false}),/unterstützte Verbindung/);
 assert.match(check({...base,bridgeColdStart:{...base.bridgeColdStart,iface:'plc'}}),/direkt per I²C starten/);
 assert.match(check({...base,sessionIndex:43}),/direkt per I²C starten/);
 assert.match(check({...base,uid:{hex:'0020018A487C'}}),/direkt per I²C starten/);
 assert.match(check({...base,regs:{0x06:0x6C01}}),/passt nicht zum Original-NVM/);
 assert.match(check(base,false),/64-Wort-EEPROM/);
 assert.match(check(base,true,false),/automatisch sichern/);
});

test('DSP display restores arbitrary endpoints only for the matching live calibration',async()=>{
 const app=read('app.js');
 const start=app.indexOf(' let sensorDisplayRange=null;'),end=app.indexOf(' function effectiveMeasurementReference(',start);
 const inputs=new Map(),$=id=>{if(!inputs.has(id))inputs.set(id,{value:''});return inputs.get(id)};
 const port={},uid='002000010002',words=Array(64).fill(0);words[0]=2;words[1]=1;
 for(let i=31;i<=54;i++)words[i]=0x1000+i;words[63]=CAL.crc16(words);
 const create=(limit,options={})=>{
  const st={port,sessionIndex:5,uid:{hex:uid},chip:true,calStaged:true,calfit:{outputLimit:limit,displayReference:{min:0,max:10,unit:'bar'}}};
  const profile={uid,crc:words[63],nvmWords:words,min:0,max:10,selected:'bar',limit};
  const deps={st,CAL,$,displayProfileKey:id=>id,standardDisplayKey:id=>'standard-'+id,
   autoStandardEnabled:()=>false,demoEnabled:false,standardPressureReference:()=>null,chooseDisplayReference:()=>({useStandard:false,reason:'keep'}),
   lsGet:id=>id===uid&&!options.archive?JSON.stringify(profile):null,lsSet:()=>{},ramGrant:async()=>{},
   nvmReadWord:async addr=>addr===0x7E?(options.crc??words[63]):words[addr/2],
   readReg:async addr=>addr===0x38?0x20:addr===0x50?2:addr===0x52?options.serial??1:addr===0x04?options.cfgEn??0:addr===0x46?options.status??0:addr===0x70&&options.changed?0:words[31+(addr-0x6C)/2],
   ramLock:async()=>{},h:(word,bytes)=>word.toString(16).toUpperCase().padStart(bytes*2,'0'),pressureUnit:()=>'bar',logging:()=>{},refreshUnitLabels:()=>{},renderDSPLive:()=>{},expert:{refreshOutputPreview(){}},
   window:{ELMOS_ARCHIVE:{findDisplayCalibration:async()=>options.archive==='matching'?profile:null}}};
  const api=new Function(...Object.keys(deps),app.slice(start,end)+'return {getActiveDSPRange,restoreCalibrationDisplayProfile};')(...Object.values(deps));
  return {api,st};
 };
 for(const limit of [23456,30000,31550]){
  for(const archive of [false,'matching']){
   const {api,st}=create(limit,{archive});
   assert.equal(api.getActiveDSPRange().limit,limit);
   st.calStaged=false;assert.equal(api.getActiveDSPRange(),null);
   assert.equal(await api.restoreCalibrationDisplayProfile(),true);
   assert.deepEqual(api.getActiveDSPRange(),{min:0,max:10,unit:'bar',limit,kind:'profile'});
   st.sessionIndex++;assert.equal(api.getActiveDSPRange(),null);
  }
 }
 for(const options of [{crc:0},{status:0x40},{changed:true},{serial:7},{cfgEn:0x4000},{archive:'conflict'},{archive:'matching',crc:0}]){
  const {api,st}=create(23500,options);st.calStaged=false;
  assert.equal(await api.restoreCalibrationDisplayProfile(),false);
  assert.equal(api.getActiveDSPRange(),null);assert.ok(!st.calTask);
 }
});

test('Unknown DSP scale displays exact chip digits without a manual setting or a guessed percentage',()=>{
 const app=read('app.js');
 const start=app.indexOf(' function dspDisplayReading(');
 const end=app.indexOf(' function renderStandardReferenceUi(',start);
 const reading=new Function(app.slice(start,end)+'return dspDisplayReading;')();
 assert.deepEqual(reading(null,null),{value:null,unit:''});
 assert.deepEqual(reading(-30014,null),{value:-30014,unit:'Digits'});
 assert.deepEqual(reading(23456,{min:0,max:6,unit:'bar',limit:23456}),{value:6,unit:'bar'});
 assert.doesNotMatch(read('index.html'),/dspDisplayOpen|dspDisplayLimit/);
 const expert=read('expert.js');
 assert.ok(expert.includes('return getActiveDSPRange()?.limit;'));
 assert.ok(!expert.includes('dspDisplayReading'));
});


test('Bridge polarity uses only CFG_AFE1 bit 12, preserves diagnostic bits and legacy profiles',()=>{
 const P=require('../app.js');
 const original=0xE800;
 const gains={pga1:2,pga2:3,offset:1};
 const normal=P.encAFE(original,{...gains,bridgeInvert:0});
 const inverted=P.encAFE(normal,{...gains,bridgeInvert:1});
 assert.equal(normal^inverted,0x1000);
 assert.equal(inverted&0xE800,0xE800);
 assert.equal(P.decAFE(inverted).bridgeInvert,1);
 assert.equal(P.decAFE(normal).bridgeInvert,0);
 assert.equal(P.encAFE(inverted,gains)&0x1000,0x1000);
 assert.throws(()=>P.encAFE(normal,{...gains,bridgeInvert:2}));
 const profile=CFG.createSelective({label:'Invertiert',afe:{...gains,bridgeInvert:1}},['afe'],CAL);
 assert.equal(CFG.validate(JSON.parse(JSON.stringify(profile)),CAL).afe.bridgeInvert,1);
 assert.throws(()=>CFG.validate({...profile,afe:{...profile.afe,bridgeInvert:2}},CAL));
 const legacy=CFG.createSelective({label:'Alt',afe:gains},['afe'],CAL);
 assert.equal(legacy.afe.bridgeInvert,undefined);
});

 test('Verified pressure opt-in only permits 00 to 10',()=>{
  const before=safeNvm();before[16]=0x1214;before[21]=1;before[63]=CAL.crc16(before);
  const fit={registers:{so:0,sf:0,coeffs:Array(16).fill(0)}};
  const after=CAL.configFrom(before,fit,0,{activatePressureCorrection:true}).after;
  assert.equal(after[16],0x1216);
  assert.equal(CAL.crc16(after),after[63]);
  assert.equal(CAL.validateRecoveryCalibrationDiff(before,after,{allowPressureCorrection:true}).outputChanged,false);
  assert.throws(()=>CAL.protectStartupCommunication(before,after),/Startschutz/);
  assert.throws(()=>CAL.validateRecoveryCalibrationDiff(before,after),/AODO/);
  for(const mask of [1,4,8,16,1<<9]){
   const wrong=after.slice();wrong[16]^=mask;
   assert.throws(()=>CAL.validateRecoveryCalibrationDiff(before,wrong,{allowPressureCorrection:true}));
  }
  const other=after.slice();other[21]=0;
  assert.throws(()=>CAL.validateRecoveryCalibrationDiff(before,other,{allowPressureCorrection:true}));
  assert.throws(()=>CAL.configFrom(after,fit,0,{activatePressureCorrection:true}));
 });
