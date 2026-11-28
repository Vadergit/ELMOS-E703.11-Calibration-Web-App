'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const source=app.slice(app.indexOf(' function internalTemperatureRestorePlan('),app.indexOf(' async function ensureInternalTemperatureProfile('));
const regs=[0x6c,0x6e,0x70,0x72,...Array.from({length:16},(_,i)=>0x74+2*i),0x94,0x96,0x98,0x9a];
const build=new Function('CAL','CAL_REGS','temperatureSourceLabels',source+'return internalTemperatureRestorePlan;')(require('../calibration.js'),regs,{internal:'Intern',bridge:'PTC',external:'EOC',reserved:'Reserviert'});
const original=Array(64).fill(0);original[16]=0x0214;original[27]=0x0c40;original[29]=0x1154;for(let i=0;i<24;i++)original[31+i]=i+1;
assert.equal(build(original,{30:0x1154}),null);
for(const a of [0x114a,0x1143]){const ram={4:0x124a,26:0x0cc2,30:a},out=build(original,ram);assert.equal(out[30]&3,0);assert.equal((out[4]^ram[4])&~0x100c,0);assert.equal((out[26]^ram[26])&~0xf0,0);assert.equal((out[30]^ram[30])&~0xfff,0);for(let i=0;i<24;i++)assert.equal(out[regs[i]],original[31+i]);}
for(const [o,ram] of [[original,{30:0x1155}],[Object.assign(original.slice(),{29:0x114a}),{30:0x114a}],[original,{4:0,26:NaN,30:0x114a}]])assert.throws(()=>build(o,ram));
console.log('60 internal-temperature restore plan checks passed');
