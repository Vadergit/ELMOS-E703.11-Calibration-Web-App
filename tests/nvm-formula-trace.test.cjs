'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const calculator=require('../nvm-reconstruction.js');
const traces=require('../nvm-reconstruction-trace.js');
const q=v=>Math.round(v*32768)&65535;
function sample(){
 const w=Array(64).fill(0);
 w[16]=0x125D;w[27]=0;w[28]=0x0800;w[31]=0;w[32]=0x1000;w[33]=0;w[34]=0x1000;
 w[35]=0;w[36]=q(0.02);w[39]=q(0.8);w[40]=q(0.06);
 w[52]=q(0.7);w[58]=q(0.8);w[57]=q(0.02);
 return w;
}
const opts={pmin:0,pmax:6,ta:25,tb:75,vdd:5,limit:24000};
test('Every visible NVM metric and ADC column has a formula with actual intermediate steps',()=>{
 const w=sample(),r=calculator.calculate(w,opts);
 assert.equal(r.ok,true);assert.equal(r.hasPhysical,true);
 const html=read('nvm-formeln.html');
 for(const key of traces.keys){
  const entry=traces.trace(key,r,w);
  assert.ok(entry, 'Missing formula for '+key);
  assert.ok(entry.steps.length>=2,'Missing detailed steps for '+key);
  assert.ok(entry.steps.every(s=>s.title&&s.formula&&s.substitution));
  assert.ok(html.includes('id="'+entry.section+'"'), 'No guide anchor for '+key);
  assert.ok(entry.result.length>3);
  assert.equal(/NaN|undefined|null/.test(entry.result),false,key);
 }
});
test('Expanded calculation matches model, not stale hard-coded sample figures',()=>{
 const w=sample(),r=calculator.calculate(w,opts);
 const zero=traces.trace('zero',r,w);
 const span=traces.trace('span',r,w);
 const tk0=traces.trace('tk0',r,w);
 const tk0bar=traces.trace('tk0bar',r,w);
 const tkr=traces.trace('tkr',r,w);
 const adcspan=traces.trace('adcspan',r,w);
 assert.match(zero.result,/mV\/V/);
 assert.match(span.result,/mV\/V/);
 assert.match(tk0.result,/100 K/);
 assert.match(tk0bar.result,/bar/);
 assert.match(tkr.result,/%/);
 assert.match(adcspan.result,/Digits/);
 assert.match(zero.steps.map(x=>x.substitution).join(' '),/S_F \[34\]/);
 assert.match(zero.steps.map(x=>x.substitution).join(' '),/K0/);
 assert.match(tkr.steps[1].substitution,/10’000/);
 const change=calculator.calculate(w,{...opts,pmax:10});
 assert.notEqual(traces.trace('tk0bar',change,w).result,tk0bar.result);
});
test('Non-invertible fixed temperature does not fabricate ADC_T or TK values',()=>{
 const w=sample();w[52]=0;w[51]=q(-0.2);w[36]=0;w[40]=0;
 const r=calculator.calculate(w,opts);
 assert.ok(r.ok);
 assert.equal(r.rows[0].adcT,null);
 const adct=traces.trace('adcT',r,w),tk=traces.trace('tk0',r,w);
 assert.match(adct.result,/Nicht eindeutig berechenbar/);
 assert.match(adct.steps.map(v=>v.description).join(' '),/nicht bestimmbar/);
 assert.match(tk.result,/Nicht eindeutig berechenbar/);
 assert.equal(traces.trace('missing',r,w),null);
 assert.equal(traces.trace('tk0',null,w),null);
 assert.equal(traces.trace('tk0',r,[]),null);
});
test('Manual ADC_T inputs and cubic curves are traced without extra sensor writes',()=>{
 const w=sample();w[52]=0;w[51]=q(-0.2);
 const manual=calculator.calculate(w,{...opts,adcT1:-4000,adcT2:5000});
 assert.equal(manual.hasPhysical,true);
 const temp=traces.trace('adcT',manual,w);
 assert.match(temp.steps.map(x=>x.description).join(' '),/Benutzer eingegeben/);
 const pressure=traces.trace('adcS0',manual,w);
 assert.ok(pressure.steps.length>=10);
 assert.ok(pressure.steps.some(x=>x.formula.includes('K3 × S³')));
 assert.doesNotMatch(read('nvm-reconstruction-trace.js'),/\b(?:serial\.requestPort|nvmWriteWord|writeReg|ramWrite|exchange)\s*\(/);
});
test('Compact calculator exposes accessible info buttons, closable dialog and complete guide',()=>{
 const ui=read('nvm-reconstruction.js'),html=read('index.html'),css=read('nvm-reconstruction.css'),guide=read('nvm-formeln.html');
 assert.match(html,/nvm-reconstruction-trace\.js\?v=/);
 assert.match(html,/nvm-reconstruction\.js\?v=0\.4\.0/);
 assert.ok(ui.includes("btn.setAttribute('aria-label','Berechnung für '"));
 assert.match(ui,/formulaButton\(root,traceKey,name\)/);
 assert.match(ui,/formulaButton\(root,'analog'/);
 assert.match(ui,/nvmrecon-formula-dialog/);
 assert.match(ui,/dialog\.showModal\(\)/);
 assert.match(ui,/dialog\.close\(\)/);
 assert.match(ui,/nvm-formeln\.html#/);
 assert.match(css,/nvmrecon-formula-trigger/);
 assert.match(css,/nvmrecon-formula-dialog::backdrop/);
 assert.match(css,/focus-visible/);
 assert.match(guide,/25DS0170E\.04/);
 assert.match(guide,/AN0203/);
 assert.match(guide,/index\.html#nvm-rechner/);
});
