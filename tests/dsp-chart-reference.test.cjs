'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');const source=app.slice(app.indexOf(' function selectedDspChartReference()'),app.indexOf(' function draw(){const dspReference'));
let value='32000';const els={gwAfeDspTarget:{textContent:''},classicAfeDspTarget:{textContent:''}};const f=new Function('$','fmt',source+'return updateDspChartReference;')(id=>id==='calDspLimit'?{value}:els[id],String);
for(const [v,expected] of [['32000',32000],['25000',25000],['20000',20000],['1000',1000],['32001',null],['',null],['1200.5',null]]){value=v;assert.equal(f(),expected);for(const el of Object.values(els))assert.equal(el.textContent,expected===null?'—':'±'+expected+' Digits');}
assert.match(app,/for\(const v of \[32767,0,-32768\]\)/);assert.match(app,/for\(const v of \[dspReference,-dspReference\]\)/);console.log('23 DSP reference display checks passed');
