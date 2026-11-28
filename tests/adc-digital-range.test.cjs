'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const G=require('../guided-plan.js');const spec={pCount:2,tCount:1,pmin:0,pmax:100,unit:'%',temperatures:[25],samples:12};
for(const [input,expected] of [[undefined,32000],[25000,25000],[32000,32000],[20000,20000]])assert.equal(G.create({...spec,outputLimit:input}).outputLimit,expected);
const app=read('app.js');const boundary=new Function('v','return '+app.match(/const highADC=!!activeADC&&\(([^;]+)\);/)[1].replaceAll('st.adc.s','v'));
for(const [v,expected] of [[-32768,true],[-32767,false],[-30000,false],[-25001,false],[25000,false],[25001,false],[32000,false],[32766,false],[32767,true]])assert.equal(boundary(v),expected);
for(const p of ['app.js','guided.js','guided-plan.js','index.html','temperature-beta/ptc-profile.js','temperature-beta/ptc-dev-integrated.js','language-pack.js'])for(const line of read(p).split('\n').filter(l=>/25[’' .]?000|25,000|25000/.test(l)))assert.match(line,/plcBaud|normal-25|recovery-25|rate:25000|preferred===100000/,p);
console.log('DSP selection, ADC boundaries and source audit passed');
