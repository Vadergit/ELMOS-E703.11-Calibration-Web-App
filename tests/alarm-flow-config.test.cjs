'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const CAL=require('../calibration.js'),A=require('../alarm-config.js'),CFG=require('../config.js');
const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
const original=()=>{
 const w=Array(64).fill(0);
 w[16]=(1<<9)|(1<<6)|(1<<4); // analogue mode, scale enabled
 w[17]=4;w[18]=(2<<12);
 w[19]=(1<<11)|(1<<8)|(1<<7);
 w[28]=0x800;
 const output=CAL.analogScaling(.5,4.5,5,32000);
 w[57]=CAL.q(output.offset,12);w[58]=CAL.q(output.gain,12);
 w[63]=CAL.crc16(w);return w;
};
const settings=()=>({limit:32000,lowerPct:10,upperPct:90,hysteresis:0,
 alarmEnabled:true,errorEnabled:false,selectedStatusBits:[5,6],errorActions:[0,0,0,0,0,0],
 errorLowPct:-80,errorHighPct:80});
test('Config v2 alarm skip is default and old five-group config stays valid',()=>{
 const minimal=CFG.createSelective({label:'Labor',calibration:{},alarm:{mode:'skip'}},['alarm'],CAL);
 assert.deepEqual(minimal.include,['alarm']);assert.deepEqual(minimal.alarm,{mode:'skip'});
 assert.deepEqual(CFG.validate(JSON.parse(JSON.stringify(minimal)),CAL).alarm,{mode:'skip'});
 const old=CFG.createSelective({label:'Alt',calibration:{sOrder:1,tOrder:0,dspLimit:32000},alarm:{mode:'skip'}},['dsp'],CAL);
 assert.deepEqual(CFG.validate(old,CAL).include,['dsp']);
 assert.ok(!Object.hasOwn(old,'alarm'));
});
test('Portable Config contains only selected alarm data and no chip-specific NVM',()=>{
 const selected=CFG.createSelective({label:'Serie',calibration:{},alarm:{mode:'edit',settings:settings()}},['alarm'],CAL);
 const result=CFG.validate(JSON.parse(JSON.stringify(selected)),CAL);
 assert.equal(result.alarm.settings.lowerPct,10);
 assert.equal(result.alarm.settings.upperPct,90);
 assert.equal(result.alarm.settings.selectedStatusBits.length,2);
 assert.ok(!JSON.stringify(result).includes('uid'));
 assert.ok(!JSON.stringify(result).includes('nvmBackup'));
 assert.throws(()=>CFG.validate({...selected,alarm:{mode:'edit',settings:{...settings(),lowerPct:80,upperPct:20}}},CAL));
 assert.throws(()=>CFG.validate({...selected,alarm:{mode:'edit',settings:{...settings(),hysteresis:15}}},CAL));
});
test('Calibration and alarm settings can form one CRC-valid image with protected boot fields',()=>{
 const before=original();
 const pts=[{adc_s:-12000,adc_t:1000,pressure:0,temperature:25},
  {adc_s:12000,adc_t:1000,pressure:100,temperature:25}];
 const fit=CAL.fit(pts,{pmin:0,pmax:100,outputLimit:32000,orderS:1,orderT:0});
 const cal=CAL.configFrom(before,fit,0x800);
 const merged=A.prepare(cal.after,settings(),CAL.crc16);
 A.validateDiff(cal.after,merged.after,CAL.crc16);
 assert.equal(CAL.crc16(merged.after),merged.after[63]);
 assert.equal(merged.after[17],before[17]);
 assert.equal(merged.after[18]&0xF000,before[18]&0xF000);
 assert.deepEqual(merged.after.slice(30,55),cal.after.slice(30,55));
 assert.equal(CAL.protectStartupCommunication(before,merged.after,{allowAlarmMask:true}),true);
});
test('Classic and guided show optional alarms between output and NVM, with skip',()=>{
 const html=read('index.html'),guided=read('guided.js'),app=read('app.js');
 const nav=html.slice(html.indexOf('class="stepBtn" data-step="5"'),html.indexOf('class="stepBtn viewer-nav" data-step="7"'));
 assert.match(nav,/data-step="5"[\s\S]*data-step="9"[\s\S]*data-step="6"/);
 assert.match(html,/id="outputSkipAlarms"/);
 assert.match(html,/id="alarmSkipNvm"/);
 assert.ok(guided.includes("['Alarme','Alarme & Fehler (optional)'"));
 assert.ok(guided.includes('id="gwPage8"'));
 assert.ok(guided.includes('id="gwOutputSkipAlarm"'));
 assert.ok(guided.includes('goto(9)'));
 assert.ok(guided.includes('stage=loggingActive?11:0'));
 assert.ok(app.includes("ELMOS_ALARM_EDITOR.skipForCalibration();step(6);"));
});
test('Combined NVM preflight and no-recalibration alarm-only path stay guarded',()=>{
 const app=read('app.js'),editor=read('alarm-editor.js');
 assert.ok(app.includes('alarmIntegrated:true'));
 assert.ok(app.includes('ELMOS_ALARM_EDITOR.pendingForCalibration()'));
 assert.ok(app.includes('const alarmIntegrated=!restoring&&!alarmOnly&&!outputOnly'));
 assert.ok(app.includes('ELMOS_ALARM_CONFIG.validateDiff(image.after,normalized.after,CAL.crc16)'));
 assert.ok(app.includes('CAL.protectStartupCommunication(image.before,normalized.after,{allowSvdd:true,allowAlarmMask:true})'));
 assert.ok(app.includes('outputOnly||[22,57,58,59,60].some'));
 assert.ok(editor.includes('duringCalibration'));
 assert.ok(editor.includes('skipForCalibration'));
 assert.ok(editor.includes('profileFromUi'));
 assert.ok(editor.includes('profilePending'));
});
test('Config group has independent alarm import with no automatic NVM write',()=>{
 const app=read('app.js'),html=read('index.html');
 assert.ok(html.includes('id="configIncludeAlarm"'));
 assert.ok(app.includes("alarm:'configIncludeAlarm'"));
 assert.ok(app.includes("if(has('alarm'))ELMOS_ALARM_EDITOR.applyProfile(values.alarm);"));
 assert.ok(!app.includes("if(has('alarm'))await nvmProgram"));
});
