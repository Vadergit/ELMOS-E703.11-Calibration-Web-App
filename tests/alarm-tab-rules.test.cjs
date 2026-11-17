'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const A=require('../alarm-config.js'),C=require('../calibration.js');
const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
const base=()=>{
 const words=Array(64).fill(0);
 words[16]=(1<<9)|(1<<4)|(1<<5);
 words[17]=0x0004;words[18]=(2<<12)|(1<<5)|(1<<6);
 words[63]=C.crc16(words);return words;
};
const input=()=>({
 limit:32000,lowerPct:10,upperPct:90,hysteresis:3,
 alarmEnabled:true,errorEnabled:true,
 selectedStatusBits:[5,6,7],
 errorActions:[0,0,1,0,0,2],
 errorLowPct:-80,errorHighPct:80
});
test('normal alarm and EOC setup is allowed and can produce unchanged startup bits',()=>{
 const w=base(),result=A.checkDependencies(w,input());
 assert.equal(result.ok,true);
 const plan=A.prepare(w,input(),C.crc16);
 assert.equal(w[18]&0xF000,plan.after[18]&0xF000);
 assert.equal(plan.after[63],C.crc16(plan.after));
});
test('hysteresis larger than threshold gap prevents preview and NVM packing',()=>{
 const w=base(),sel={...input(),lowerPct:49,upperPct:51,hysteresis:11};
 assert.equal(A.checkDependencies(w,sel).ok,false);
 assert.match(A.checkDependencies(w,sel).errors.join(' '),/Hysterese zu gross/);
 assert.throws(()=>A.prepare(w,sel,C.crc16),/Hysterese zu gross/);
});
test('EOC->AODO with permanent One-Wire is blocked as pin conflict',()=>{
 const w=base();w[20]=3<<7;w[63]=C.crc16(w);
 assert.equal(A.checkDependencies(w,input()).ok,false);
 assert.match(A.checkDependencies(w,input()).errors.join(' '),/EOC auf AODO/);
});
test('external EOC temperature sensing cannot share EOC output',()=>{
 const w=base();w[29]=3;w[63]=C.crc16(w);
 assert.equal(A.checkDependencies(w,input()).ok,false);
 assert.match(A.checkDependencies(w,input()).errors.join(' '),/Temperatursensor/);
});
test('post-scaling means ALARM_LO and ALARM_HI contain coefficients',()=>{
 const w=base();w[16]|=1<<14;w[63]=C.crc16(w);
 assert.equal(A.checkDependencies(w,input()).ok,false);
 assert.throws(()=>A.prepare(w,input(),C.crc16),/Post-Scaling/);
});
test('misleading but non-destructive settings produce explicit warnings',()=>{
 const w=base(),sel={...input(),alarmEnabled:false,errorEnabled:false,
  selectedStatusBits:[5,6,12],errorActions:[2,0,0,0,0,0]};
 const check=A.checkDependencies(w,sel);
 assert.equal(check.ok,true);
 assert.match(check.warnings.join(' '),/Alarmberechnung.*ausgeschaltet/);
 assert.match(check.warnings.join(' '),/ERR_EN ist deaktiviert/);
 assert.match(check.warnings.join(' '),/LIMIT_EN deaktiviert/);
});
test('missing numeric inputs and out-of-range substitute values are blocked early',()=>{
 const w=base();
 assert.equal(A.checkDependencies(w,{...input(),lowerPct:''}).ok,false);
 assert.equal(A.checkDependencies(w,{...input(),errorLowPct:200}).ok,false);
 assert.equal(A.checkDependencies(w,{...input(),hysteresis:''}).ok,false);
});
test('alarm tab is independent and still routes verified plan into NVM programming',()=>{
 const html=read('index.html'),app=read('app.js'),editor=read('alarm-editor.js');
 assert.match(html,/data-step="9"[^>]*>.*Alarme &amp; Fehler/);
 assert.match(html,/data-panel="9" hidden>/);
 const panel=html.split('data-panel="9" hidden>')[1];
 assert.ok(panel.includes('id="alarmEditorSection"'));
 assert.ok(panel.includes('id="alarmRuleList"'));
 assert.ok(panel.includes('id="alarmReadEeprom"'));
 assert.ok(panel.includes('id="alarmGoNvm"'));
 assert.ok(!html.split('data-panel="7" hidden>')[1].split('data-panel="8" hidden>')[0].includes('id="alarmEditorSection"'));
 assert.ok(app.includes("if(n===8||n===9)return ''"));
 assert.ok(app.includes('ELMOS_ALARM_EDITOR.ready()))return'));
 assert.ok(app.includes('Math.min(10,Number(n))'));
 assert.ok(editor.includes('A.checkDependencies(st.nvmBackup,selection())'));
 assert.ok(editor.includes("btn.click()"));
});
