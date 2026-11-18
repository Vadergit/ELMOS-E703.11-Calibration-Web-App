'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../elmos-settings.js'),A=require('../elmos-alarm-view.js');
const blank=()=>Array(64).fill(0);
test('all 40 documented continuous filter profiles are matched exactly',()=>{
 assert.equal(S.filterProfiles.length,40);
 assert.match(S.filter([0x7BA4,0x1497,0x01BA]),/Butterworth · 20 Hz · 2 kS\/s · 15 Bit/);
 assert.match(S.filter([0x7BE4,0x1497,0x01B9]),/Bessel · 15 Hz · 2 kS\/s · 15 Bit/);
 assert.match(S.filter([0x7BA4,0x1497,0x01BB]),/Individuelle Filterkonfiguration/);
});
test('EOC OR logic maps documented STATUS bits exactly',()=>{
 assert.equal(S.eocMask((1<<5)|(1<<6)),'Druck unter Alarmgrenze ODER Druck über Alarmgrenze');
 assert.equal(S.eocMask(0),'Keine Statussignale ausgewählt');
 assert.equal(S.eocPin(3<<7),'AODO-Pin');
 assert.match(S.eocMask(1<<10),/Analogausgang unten begrenzt/);
 assert.match(S.eocMask(1<<11),/Analogausgang oben begrenzt/);
});
test('alarm words are not confused with DSP post-scaling',()=>{
 const words=blank();words[16]=1<<5;
 words[55]=((-8192>>2)<<2)&0xFFFC;words[56]=((8192>>2)<<2)&0xFFFC;
 let a=S.alarmValues(words);
 assert.equal(a.type,'alarm');assert.equal(a.enable,true);
 assert.equal(a.lowerDigits,-8192);assert.equal(a.upperDigits,8192);
 words[16]=(1<<14)|(1<<5);words[55]=0x4000;words[56]=0xC000;
 a=S.alarmValues(words);
 assert.equal(a.type,'postscale');assert.equal(a.mode,'Feinkorrektur');
 assert.equal(a.offset,0.5);assert.equal(a.gain,-0.5);
});
test('error response text explains the six two-bit actions without hexadecimal',()=>{
 const w=(3<<(2*5))|(2<<(2*2));
 assert.match(S.errorMask(w),/Brückenversorgung fehlerhaft → Hochohmig/);
 assert.match(S.errorMask(w),/DSP-Sättigung → Oberer Fehlerwert/);
 assert.equal(S.errorMask(0),'Keine Fehlerreaktion eingerichtet');
 assert.match(S.errorValues(0x8000),/oberer Ersatzwert -100 %/);
});
test('alarm diagnostic depends on CRC-confirmed caller data and status is optional',()=>{
 const w=blank();
 w[18]=(1<<5)|(1<<6);w[16]=1<<5;
 let summary=A.summary(w);
 assert.match(summary.status,/noch nicht gelesen/);
 summary=A.summary(w,1<<6);
 assert.match(summary.status,/Druck über Alarmgrenze/);
 assert.equal(A.summary([0x1234],0),null);
});
test('permanent 1-Wire + EOC routing to AODO reports a conflict, never silently changes boot',()=>{
 const w=blank();w[17]=1<<2;w[20]=3<<7;
 assert.match(A.summary(w).conflicts.join(' '),/One-Wire überlagert/);
});

test('sparse RAM maps decode alarms and output limit with strict field guards',()=>{
 const ram={16:(1<<5)|(1<<7),55:0xE000,56:0x2000,59:0,60:0};
 assert.match(S.alarmText(ram,'lower'),/Aktiv/);
 assert.match(S.alarmText(ram,'upper'),/Aktiv/);
 assert.match(S.limitText(ram),/Unten 0 % des DSP-Vollausschlags/);
 assert.match(S.alarmText({...ram,16:0},'lower'),/Nicht aktiv/);
 assert.equal(S.limitText({...ram,16:0}),'Ausgangsbegrenzung deaktiviert');
 assert.match(S.alarmText({...ram,16:(1<<14)|(1<<5)},'lower'),/DSP-Nachskalierung Offset/);
 assert.match(S.alarmText({...ram,16:(1<<14)|(1<<5)},'upper'),/DSP-Nachskalierung Faktor/);
 assert.equal(S.alarmText({16:ram[16],55:ram[55]},'upper'),'Nicht gelesen');
 assert.equal(S.limitText({16:ram[16],59:ram[59]}),'Nicht gelesen');
 assert.equal(S.alarmText({16:ram[16],55:65536,56:ram[56]},'lower'),'Nicht gelesen');
 assert.equal(S.limitText({16:ram[16],59:-1,60:0}),'Nicht gelesen');
 const truncated=Array(63).fill(0);
 truncated[16]=ram[16];truncated[55]=ram[55];truncated[56]=ram[56];
 assert.equal(S.alarmValues(truncated),null);
 assert.equal(S.limitText(truncated),'Nicht gelesen');
});
