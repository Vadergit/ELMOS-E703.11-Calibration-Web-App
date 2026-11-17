'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const recon=require('../nvm-reconstruction.js');
const image=()=>{
 const w=Array(64).fill(0);
 w[16]=0x1251; // temperature correction + analog AODO + scaler + sensor
 w[27]=0x0000; // bridge 2.4 V
 w[28]=0x0800; // pga1 3.5, pga2 2.0, offset 0
 w[31]=0;w[32]=0x1000;w[33]=0;w[34]=0x1000;
 w[39]=0x7000; // linear pressure slope 0.875
 w[52]=0x7000; // linear absolute temp slope 0.875
 w[58]=0x0D1F; // analog slope about 0.82
 return w;
};
test('NVM requires exactly 64 valid unsigned words',()=>{
 assert.equal(recon.validWords(image()),true);
 assert.equal(recon.calculate([]).ok,false);
 const words=image();words[12]=-1;
 assert.equal(recon.validWords(words),false);
});
test('Numerical inversion produces two physically consistent ADC and bridge endpoints',()=>{
 const r=recon.calculate(image(),{pmin:0,pmax:6,ta:25,tb:75,vdd:5,limit:24000});
 assert.equal(r.ok,true);
 assert.equal(r.rows.length,2);
 assert.ok(r.rows.every(row=>Number.isFinite(row.zero)&&Number.isFinite(row.span)));
 assert.ok(Math.abs(r.rows[0].span-r.rows[1].span)<1e-7);
 assert.ok(Math.abs(r.rows[0].zero-r.rows[1].zero)<1e-7);
 assert.ok(Math.abs(r.tk0)<1e-10);
 assert.ok(Math.abs(r.tkr)<1e-10);
});
test('Temperature cross coefficients induce nonzero TK0 and TKR',()=>{
 const w=image();w[36]=0x0400;w[40]=0x0600;
 const r=recon.calculate(w,{pmin:0,pmax:6,ta:25,tb:75,vdd:5,limit:24000});
 assert.ok(Math.abs(r.tk0)>1e-6);
 assert.ok(Math.abs(r.tk0Bar)>1e-6);
 assert.ok(Math.abs(r.tkr)>1e-6);
 assert.ok(r.analog.low.volts<r.analog.high.volts);
});
test('Ill-posed NVM or settings never silently invent physical measurements',()=>{
 const zero=image();zero[34]=0;
 const result=recon.calculate(zero,{limit:24000});
 assert.equal(result.ok,true);
 assert.equal(result.rows[0].zero,null);
 assert.ok(result.warnings.some(x=>x.includes('S_F ist null')));
 assert.equal(recon.calculate(image(),{pmin:6,pmax:0}).ok,false);
 const badTemp=image();badTemp[51]=0;badTemp[52]=0;badTemp[53]=0;badTemp[54]=0;
 const t=recon.calculate(badTemp,{limit:24000});
 assert.equal(t.rows[0].zero,null);
 assert.ok(t.warnings.some(x=>x.includes('Temperatur')));
});
test('NVM calculator is wired to verified Viewer state and has no sensor writer',()=>{
 const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
 const html=read('index.html'),expert=read('expert.js'),src=read('nvm-reconstruction.js');
 assert.match(html,/id="nvmReconstruction"/);
 assert.match(html,/nvm-reconstruction\.js/);
 assert.match(expert,/ELMOS_NVM_RECON\.render\(\$\('nvmReconstruction'\),valid\?st\.nvmBackup:null\)/);
 assert.match(expert,/st\.nvmBackupVerified/);
 assert.doesNotMatch(src,/\b(?:writeReg|nvmWriteWord|ramGrant|ramWrite|exchange|serial\.requestPort)\s*\(/);
});


test('Auto temperature model detects factory scaling and allows explicit override',()=>{
 const w=image();
 w[51]=0x0F4D;w[52]=0xBC8E;w[53]=0xFC54;w[54]=0;
 const a=recon.calculate(w,{limit:24000});
 assert.equal(a.settings.temperatureModel,'factory');
 assert.ok(a.rows.every(r=>Number.isFinite(r.tempNorm)));
 assert.ok(a.warnings.some(s=>s.includes('Werk-Temperaturprofil')));
 const b=recon.calculate(w,{limit:24000,tempModel:'an0203'});
 assert.equal(b.settings.temperatureModel,'an0203');
 assert.notEqual(a.rows[0].tempNorm,b.rows[0].tempNorm);
});


test('Imported 64-word file overrides live EEPROM until removed',()=>{
 const live=image(),file=image();file[34]=0;
 assert.equal(recon.chooseSource(live,file).kind,'file');
 assert.equal(recon.chooseSource(live,file).words[34],0);
 assert.equal(recon.chooseSource(live,null).kind,'eeprom');
 assert.equal(recon.chooseSource(null,file).kind,'file');
 assert.equal(recon.chooseSource(null,null).kind,'none');
 assert.equal(recon.chooseSource(live,[1,2]).kind,'eeprom');
});
test('Zero calibration coefficients are highlighted rather than presented as successful results',()=>{
 const blank=image();blank[34]=0;blank.fill(0,35,55);
 const result=recon.calculate(blank);
 assert.equal(result.ok,true);
 assert.equal(result.rows[0].zero,null);
 assert.ok(result.warnings.some(x=>x.includes('Werks-Standardwert')));
 assert.ok(result.warnings.some(x=>x.includes('S0–S15')));
 const file=fs.readFileSync(path.join(__dirname,'..','nvm-reconstruction.js'),'utf8');
 assert.match(file,/Rückrechnung nicht vollständig möglich/);
 assert.match(file,/IMPORTIERTE DATEI/);
 assert.match(file,/Registerdiagnose/);
});
