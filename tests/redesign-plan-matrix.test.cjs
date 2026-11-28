'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const plan=require('../guided-plan.js');
test('all selectable pressure counts, temperature counts, polynomial orders, units and fit models',()=>{
 let accepted=0,rejected=0;
 for(let p=2;p<=5;p++)for(let t=1;t<=3;t++)for(let s=1;s<=Math.min(3,p-1);s++)for(let o=0;o<t;o++)
 for(const unit of ['%','bar','mbar','kPa','psi','custom'])for(const fitMode of ['full','tk0']){
  const spec={pCount:p,tCount:t,orderS:s,orderT:o,unit,fitMode,temperatures:[-40,25,125].slice(0,t),pmin:-1,pmax:4,samples:12,outputLimit:25000};
  const allowed=p*t<=10&&(fitMode==='full'||p===2&&t===2&&s===1&&o===1);
  if(!allowed){assert.throws(()=>plan.create(spec));rejected++;continue;}
  const v=plan.create(spec);
  assert.equal(v.total,fitMode==='tk0'?3:p*t);
  assert.equal(v.tempComp,o>0);
  assert.equal(v.pressureValues[0],-1);assert.equal(v.pressureValues.at(-1),4);
  assert.equal(new Set(v.points.map(x=>x.slot)).size,v.total);
  assert.equal(plan.temperatureCompensationEnabled(t,'advanced',o),v.tempComp);
  accepted++;
 }
 assert.equal(accepted,222);assert.equal(rejected,426);
});
test('boundary values and every offered preset',()=>{
 for(const preset of Object.values(plan.presets)){
  const a=plan.create({...preset,temperatures:preset.temperatures||[-10,25,65].slice(0,preset.tCount)});
  assert.equal(a.total,preset.fitMode==='tk0'?3:preset.pCount*preset.tCount);
  assert.equal(a.tempComp,preset.tempComp);
 }
 for(const samples of [1,12,100])for(const outputLimit of [1000,25000,25001,31999,32000])
  assert.equal(plan.create({samples,outputLimit}).outputLimit,outputLimit);
 for(const spec of [{samples:0},{samples:101},{outputLimit:999},{outputLimit:32001},{pmin:1,pmax:1},{pmin:2,pmax:1},{unit:'wrong'},{pCount:6},{tCount:4},{tCount:2,temperatures:[25,25]},{tCount:2,temperatures:[75,25]},{temperatures:[-41]},{temperatures:[126]}])
  assert.throws(()=>plan.create(spec));
});
