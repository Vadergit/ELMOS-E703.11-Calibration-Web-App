'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const A=require('../alarm-config.js'),C=require('../calibration.js');
const readFile=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
const words=()=>{
 const w=Array(64).fill(0);
 w[16]=(1<<9)|(1<<4); // ratiometric AODO, required fixed 1
 w[17]=4;w[18]=(2<<12)|(1<<5); // 200-ms startup, lower-alarm route
 w[19]=(1<<11)|(1<<8)|(1<<7);
 w[20]=0x0055; // GPIO pin mapping must be preserved
 w[61]=0xF000; // reserved ERR_MASK nibble must be preserved
 w[63]=C.crc16(w);
 return w;
};
const settings=()=>({limit:32000,lowerPct:10,upperPct:90,hysteresis:3,
 alarmEnabled:true,errorEnabled:true,selectedStatusBits:[3,5,6,7,8,9,12,13],
 errorActions:[0,1,2,3,1,2],errorLowPct:-90,errorHighPct:90});
test('two Alarm thresholds use Q0.13 signed register encoding correctly',()=>{
 const p=A.prepare(words(),settings(),C.crc16),back=A.read(p.after,32000);
 assert.ok(Math.abs(back.lowerPct-10)<0.01);
 assert.ok(Math.abs(back.upperPct-90)<0.01);
 assert.equal(back.hysteresis,3);
 assert.equal(back.alarmEnabled,true);
 assert.equal(back.errorEnabled,true);
 assert.equal(back.postScaling,false);
 assert.equal(p.after[63],C.crc16(p.after));
});
test('EOC mask accepts all 12 documented routable STATUS bits and never boot bits',()=>{
 assert.equal(A.statusBits.length,12);
 const w=words(),p=A.prepare(w,settings(),C.crc16);
 assert.equal(p.after[18]&0xF000,w[18]&0xF000);
 assert.equal((p.after[18]>>10)&3,3);
 assert.deepEqual(A.read(p.after,32000).selectedStatusBits.sort((a,b)=>a-b),
  settings().selectedStatusBits.sort((a,b)=>a-b));
 assert.equal(p.after[20],w[20]);
 assert.equal(p.after[17],w[17]);
 assert.equal(p.after[19],w[19]);
 assert.equal(C.protectStartupCommunication(w,p.after,{allowAlarmMask:true}),true);
 assert.throws(()=>C.protectStartupCommunication(w,p.after),/1-Wire-Startschutz/);
});
test('error actions map to ERR_MASK 2-bit fields; signed Q0.7 substitutes are bounded',()=>{
 const p=A.prepare(words(),settings(),C.crc16);
 assert.deepEqual(A.read(p.after).errorActions,settings().errorActions);
 assert.equal(p.after[61]&0xF000,0xF000);
 assert.ok(A.read(p.after).errorLowPct<0);
 assert.ok(A.read(p.after).errorHighPct>0);
 assert.throws(()=>A.prepare(words(),{...settings(),errorLowPct:-101},C.crc16),/Fehler-Ersatzwert/);
});
test('active post-scaling blocks alarm edits without overwriting coefficients',()=>{
 const w=words();w[16]|=1<<14;w[55]=0x4000;w[56]=0xE000;w[63]=C.crc16(w);
 assert.throws(()=>A.prepare(w,settings(),C.crc16),/Post-Scaling aktiv/);
});
test('invalid or stale EEPROM and illegal EOC selections fail before any writes',()=>{
 const w=words();const invalid=w.slice();invalid[55]=55;
 assert.throws(()=>A.prepare(invalid,settings(),C.crc16),/CRC16/);
 assert.throws(()=>A.prepare(w,{...settings(),selectedStatusBits:[10]},C.crc16),/Statusauswahl/);
 assert.throws(()=>A.prepare(w,{...settings(),selectedStatusBits:[3,3]},C.crc16),/Statusauswahl/);
 assert.throws(()=>A.prepare(w,{...settings(),lowerPct:90,upperPct:10},C.crc16),/obere Grenze/);
});
test('reject any unapproved changes to startup, AODO scaling, factory and reserved bits',()=>{
 const w=words(),p=A.prepare(w,settings(),C.crc16);
 for(const [i,mask] of [[18,1<<12],[16,1<<14],[20,1],[58,1],[61,1<<15],[0,1]]){
  const modified=p.after.slice();modified[i]^=mask;modified[63]=C.crc16(modified);
  assert.throws(()=>A.validateDiff(w,modified,C.crc16),/Alarmkonfiguration/);
 }
});
test('alarm UI is wired into original SSP3-only RAM and NVM gated flows',()=>{
 const html=readFile('index.html'),app=readFile('app.js'),editor=readFile('alarm-editor.js');
 for(const id of ['alarmEditorFields','alarmDspLimit','alarmLowerPct','alarmUpperPct',
  'alarmHysteresis','alarmEnable','alarmErrorEnable','alarmEocOptions',
  'alarmErrorOptions','alarmDspConfirm','alarmEditorPreview','alarmEditorRam'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(app.includes("st.ramWriteScope==='alarm'"));
 assert.ok(app.includes('ELMOS_ALARM_CONFIG.validateDiff(initial,modified,CAL.crc16)'));
 assert.ok(app.includes("st.alarmOnlyPlan.ramVerified"));
 assert.ok(app.includes("if(!$('nvmAutoBackup').checked)"));
 assert.ok(app.includes('allowAlarmMask:alarmOnly'));
 assert.ok(editor.includes('applyAlarmRam(p)'));
});
