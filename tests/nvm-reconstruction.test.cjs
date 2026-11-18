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
 assert.equal(r.tk0,null); // no temperature cross coefficients: physical TK not determinable
 assert.equal(r.tkr,null);
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
 assert.ok(Number.isFinite(t.rows[0].zero)); // temperature-independent pressure must still work
 assert.equal(t.tk0,null);
 assert.equal(t.rows[0].adcT,null);
 assert.ok(t.warnings.some(x=>x.includes('Temperatur')));
});
test('NVM calculator is wired to verified Viewer state and has no sensor writer',()=>{
 const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
 const html=read('index.html'),expert=read('expert.js'),src=read('nvm-reconstruction.js');
 assert.match(html,/id="nvmReconstruction"/);
 assert.match(html,/nvm-reconstruction\.js/);
 assert.match(expert,/ELMOS_NVM_RECON\.render\(\$\('nvmReconstruction'\),valid\?st\.nvmBackup:null,\{/);
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
 assert.match(file,/LOKALE DATEI · NICHT LIVE/);
 assert.match(file,/Registerdiagnose/);
});


test('Negative pressure slope and fixed DSP_T keep pressure inverse usable, but TK unknown',()=>{
 const w=Array(64).fill(0);
 // Anonymised synthetic pressure-only configuration; no factory or serial words.
 w[16]=0x13D6;w[27]=0;w[28]=0x1C53;
 w[31]=0xFF6B;w[32]=0x1000;w[33]=0x136A;w[34]=0x4C00;
 w[35]=0x0004;w[39]=0x81BC;w[51]=0xE9B0;
 // Output scale is enabled, but coefficient zero: AODO diagnostic expected.
 const r=recon.calculate(w,{pmin:0,pmax:6,ta:25,tb:75,vdd:5,limit:32000});
 assert.equal(r.ok,true);
 assert.equal(r.hasPhysical,true);
 assert.ok(r.rows.every(a=>Number.isFinite(a.zero)&&Number.isFinite(a.span)));
 assert.ok(r.rows.every(a=>a.endpoints.every(p=>Number.isFinite(p.adcDigits))));
 assert.equal(r.rows[0].zero,r.rows[1].zero);
 assert.equal(r.rows[0].span,r.rows[1].span);
 assert.equal(r.tk0,null);assert.equal(r.tk0Bar,null);assert.equal(r.tkr,null);
 assert.equal(r.rows[0].adcT,null);
 assert.ok(Number.isFinite(r.settings.fixedTemperatureC));
 assert.ok(r.warnings.some(s=>s.includes('AODO_F=0x0000')));
 assert.ok(r.warnings.every(s=>!s.includes('800 Lösungen')));
});


const q15=value=>Math.round(value*32768)&0xFFFF;
function complexSample(){
 const words=Array(64).fill(0);
 words[16]=0x125D; // temperature correction active, analogue, scaled
 words[27]=0;words[28]=0x0800;
 words[31]=0;words[32]=4096;words[33]=0;words[34]=4096;
 words[39]=q15(0.8);words[52]=q15(0.7);words[58]=4096;
 return words;
}
const advancedOpts={pmin:0,pmax:6,ta:25,tb:75,vdd:5,limit:24000};
test('3-point TK0 inverse obtains offset drift, zero TKE when no S*T term exists',()=>{
 const w=complexSample();w[36]=q15(0.025);
 const r=recon.calculate(w,advancedOpts);
 assert.ok(r.ok&&r.hasPhysical);
 assert.ok(Number.isFinite(r.tk0)&&Math.abs(r.tk0)>0.01);
 assert.ok(Math.abs(r.tkr)<1e-8);
 assert.ok(r.rows.every(a=>a.endpoints.every(x=>Number.isFinite(x.adcDigits))));
});
test('4-point TK0+TKE inverse reconstructs offset and sensitivity temperature drift',()=>{
 const w=complexSample();w[36]=q15(0.02);w[40]=q15(0.06);
 const r=recon.calculate(w,advancedOpts);
 assert.ok(r.ok&&r.hasPhysical);
 assert.ok(Math.abs(r.tk0)>1e-5);
 assert.ok(Math.abs(r.tkr)>1e-5);
 assert.ok(r.rows.every(row=>Number.isFinite(row.tempNorm)));
});
test('Higher-order pressure 3 and temperature 3 are solved numerically',()=>{
 const w=complexSample();w[36]=q15(0.02);w[40]=q15(0.06);
 w[43]=q15(0.03);w[44]=q15(0.004);w[47]=q15(0.007);
 w[53]=q15(0.012);w[54]=q15(0.003);
 const r=recon.calculate(w,advancedOpts);
 assert.ok(r.ok&&r.hasPhysical);
 assert.ok(Number.isFinite(r.tk0)&&Number.isFinite(r.tkr));
 assert.ok(r.rows.every(a=>a.endpoints.every(x=>Number.isFinite(x.sNorm))));
});
test('Non-monotonic curves with multiple mathematical inverses do not invent values',()=>{
 const w=complexSample();w[39]=0;w[43]=q15(0.85);
 const r=recon.calculate(w,advancedOpts);
 assert.ok(r.ok&&!r.hasPhysical);
 assert.equal(r.rows[0].zero,null);
 assert.ok(r.warnings.some(x=>x.includes('mehrdeutige Polynomumkehr')));
});
test('Manual ADC_T at each temperature allows advanced reconstruction if DSP_T is fixed',()=>{
 const w=complexSample();w[36]=q15(0.025);w[52]=0;w[51]=q15(-0.2);
 const missing=recon.calculate(w,advancedOpts);
 assert.equal(missing.hasPhysical,false);
 const manual=recon.calculate(w,{...advancedOpts,adcT1:-7000,adcT2:7000});
 assert.ok(manual.ok&&manual.hasPhysical);
 assert.ok(Number.isFinite(manual.tk0));
 assert.equal(manual.rows[0].adcT,-7000/32768);
 assert.equal(manual.rows[1].adcT,7000/32768);
 assert.equal(recon.calculate(w,{...advancedOpts,adcT1:'bad'}).ok,false);
});


test('Missing-data summary explains fixed temperature NVM without suggesting pressure fit is missing',()=>{
 const w=image();w[52]=0;w[51]=0xE9B0;
 const result=recon.calculate(w,{pmin:0,pmax:6,ta:25,tb:75,limit:24000});
 assert.equal(result.hasPhysical,true);
 const summary=recon.missingExplanations(result);
 const names=summary.map(v=>v.name);
 assert.deepEqual(names,['Temperatur-Rohwerte (ADC_T)','Temperaturgang (TK0 / TKR)','Ursprünglicher Druckbereich / Prüfpunkte']);
 assert.match(summary[0].reason,/gemessene ADC_T-Werte/);
 assert.match(summary[1].reason,/zwei Temperaturen/);
 assert.match(summary[2].reason,/Kalibrierprotokoll/);
});
test('Complex NVM with TK0 and TKE does not show missing values when calculable',()=>{
 const w=image();w[36]=0x0400;w[40]=0x0600;
 const result=recon.calculate(w,{pmin:0,pmax:6,ta:25,tb:75,limit:24000});
 assert.ok(result.hasPhysical&&Number.isFinite(result.tk0)&&Number.isFinite(result.tkr));
 const names=recon.missingExplanations(result).map(v=>v.name);
 assert.deepEqual(names,['Ursprünglicher Druckbereich / Prüfpunkte']);
});
test('Missing pressure fit is explained without claiming ADC_S could be calculated',()=>{
 const w=image();w[34]=0;
 const result=recon.calculate(w,{limit:24000});
 assert.ok(!result.hasPhysical);
 const names=recon.missingExplanations(result).map(v=>v.name);
 assert.ok(names.includes('Druck-Rohwerte (ADC_S)'));
 assert.ok(names.includes('Temperaturgang (TK0 / TKR)'));
 assert.equal(recon.missingExplanations({ok:false,error:'Invalid'}).length,0);
});
test('Optional measured ADC_T removes corresponding missing value from explanation',()=>{
 const w=image();w[51]=0xE9B0;w[52]=0;
 const result=recon.calculate(w,{limit:24000,adcT1:-5000,adcT2:5000});
 const names=recon.missingExplanations(result).map(v=>v.name);
 assert.equal(names.includes('Temperatur-Rohwerte (ADC_T)'),false);
 assert.equal(names.includes('Temperaturgang (TK0 / TKR)'),true);
});
test('Missing-data summary is always shown below explanation, not in a hidden diagnostics section',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const source=fs.readFileSync(path.join(__dirname,'..','nvm-reconstruction.js'),'utf8');
 const style=fs.readFileSync(path.join(__dirname,'..','nvm-reconstruction.css'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.match(source,/root\.append\(setup,status,result,explain,missing,dialog\)/);
 assert.match(source,/Nicht berechenbare Werte/);
 assert.match(source,/missing\.hidden=false/);
 assert.match(style,/#nvmReconstruction \.nvmrecon-missing/);
 assert.match(html,/nvm-reconstruction\.js\?v=0\.3\.3/);
});


test('I2C-calibrated E703.11: inverse S range follows raw ADC domain even when S_O is below -1',()=>{
 // Reproduces the user-reported linear pressure coefficients; factory UID
 // and the rest of the NVM are deliberately omitted from this test fixture.
 const w=Array(64).fill(0);
 w[16]=0x12D6;w[27]=0x0C80;w[28]=0x1C03;
 w[31]=0xFF6B;w[32]=0x1000;
 w[33]=0xDA10;w[34]=0x4800;
 w[35]=0x4BA1;w[39]=0x48E9;w[51]=0xE57C;
 const calc=recon.calculate(w,{pmin:0,pmax:6,ta:25,tb:75,vdd:5,limit:32000});
 assert.equal(calc.ok,true);
 assert.equal(calc.hasPhysical,true,'Valid DSP pressure endpoints must be invertible within the ADC range');
 assert.ok(Math.abs(calc.rows[0].endpoints[0].adcDigits-(-2771.6928))<0.02);
 assert.ok(Math.abs(calc.rows[0].endpoints[1].adcDigits-22196.6317)<0.02);
 assert.ok(calc.rows[0].endpoints[0].sNorm < -1,'Intermediate normalized S may fall below -1');
 assert.ok(Math.abs(calc.rows[0].zero-0.2242793)<0.001);
 assert.ok(Math.abs(calc.rows[0].span-(-2.0203824))<0.001);
 assert.equal(calc.tk0,null);assert.equal(calc.tkr,null);
 const s=calc.settings.sF*(-271/32768)+calc.settings.sO;
 const dsp=Math.round((calc.settings.scoeff[0]+calc.settings.scoeff[4]*s)*32768);
 assert.ok(Math.abs(dsp-(-25563))<40,'Expected DSP_S from observed live ADC_S should be within latency / filter variation');
 assert.equal(recon.missingExplanations(calc).some(x=>x.name==='Druck-Rohwerte (ADC_S)'),false);
 assert.equal(recon.missingExplanations(calc).some(x=>x.name==='Nullpunkt / Spanne in mV/V'),false);
});
test('Temperature polynomial inverse uses T_F and T_O mapped raw ADC limits',()=>{
 const w=image();w[31]=0xD000;w[32]=0x6000;
 // DSP_T = 0.2 * T: T for 25/75 C is outside ±1, but ADC_T remains valid.
 w[51]=0;w[52]=Math.round(0.2*32768);
 const r=recon.calculate(w,{limit:24000});
 assert.equal(r.ok,true);
 assert.ok(r.rows.every(row=>Number.isFinite(row.adcT)));
 assert.ok(r.rows.some(row=>row.tempNorm>1||row.tempNorm< -1));
});
