'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=filename=>fs.readFileSync(path.join(__dirname,'..',filename),'utf8');
const PLAN=require('../guided-plan.js');

test('Guided calibration and each preset use the requested 0–100 % range by default',()=>{
 const defaultPlan=PLAN.create();
 assert.equal(defaultPlan.unit,'%');
 assert.equal(defaultPlan.pmin,0);
 assert.equal(defaultPlan.pmax,100);
 assert.equal(defaultPlan.pressureValues[0],0);
 assert.equal(defaultPlan.pressureValues.at(-1),100);
 for(const [key,preset] of Object.entries(PLAN.presets)){
  assert.equal(preset.unit,'%',key);
  assert.equal(preset.pmin,0,key);
  assert.equal(preset.pmax,100,key);
  const temperatures=preset.tCount===1?[25]:preset.tCount===2?[10,60]:[-10,25,65];
  const plan=PLAN.create({...preset,temperatures,
   orderS:Math.min(3,preset.pCount-1),orderT:preset.tCount-1});
  assert.equal(plan.pressureValues[0],0,key);
  assert.equal(plan.pressureValues.at(-1),100,key);
 }
});
test('Classic calibration starts at 0–100 %, including default verification reference',()=>{
 const html=read('index.html');
 assert.match(html,/<select id="calUnit"><option value="bar">bar<\/option><option value="%" selected>%<\/option>/);
 assert.match(html,/id="pmin" value="0"/);
 assert.match(html,/id="pmax" value="100"/);
 assert.match(html,/id="ptest" type="number" step="any" value="50"/);
 assert.match(html,/id="calVerifyPressure" step="any" value="50"/);
 assert.match(html,/id="calVerifyTolerance" step="any" min="0.000001" value="0.2"/);
 assert.match(html,/data-app-version="0.7.85"/);
});
test('Explicit 0–10 bar calibration still remains possible',()=>{
 const plan=PLAN.create({pmin:0,pmax:10,unit:'bar'});
 assert.equal(plan.unit,'bar');
 assert.deepEqual(plan.pressureValues,[0,10]);
});
test('Selecting a guided preset resets changed range to 0–100 percent',()=>{
 const guided=read('guided.js');
 const start=guided.indexOf(' function preset(name){');
 const end=guided.indexOf(' function defaultTemperatures(',start);
 assert.ok(start!==-1&&end>start);
 const src=guided.slice(start,end);
 const fields=Object.fromEntries(['pmin','pmax','calUnit','gwPressureCount','gwTemperatureCount',
  'gwComplexity','gwSOrder','gwTOrder'].map(key=>[key,{value:''}]));
 Object.assign(fields,{pmin:{value:'0'},pmax:{value:'10'},calUnit:{value:'bar'}});
 let planRenders=0,confirms=0;
 const context={
  $:id=>fields[id],
  ELMOS_GUIDED_PLAN:PLAN,
  fieldValue:(id,value)=>fields[id].value=String(value),
  state:()=>({points:[]}),
  window:{confirm:()=>{confirms++;return true}},
  setTemperatureInputs(){},
  renderPlan(){planRenders++}
 };
 vm.runInNewContext(src+'\npreset("quick")',context);
 assert.equal(fields.calUnit.value,'%');
 assert.equal(fields.pmin.value,'0');
 assert.equal(fields.pmax.value,'100');
 assert.equal(fields.gwPressureCount.value,'2');
 assert.equal(planRenders,1);
 assert.equal(confirms,0);
});
test('Preset change requests confirmation before clearing real captured points',()=>{
 const guided=read('guided.js');
 const src=guided.slice(guided.indexOf(' function preset(name){'),
  guided.indexOf(' function defaultTemperatures('));
 const fields={pmin:{value:'0'},pmax:{value:'10'},calUnit:{value:'bar'}};
 let confirms=0,mutations=0;
 const context={
  $:id=>fields[id]||{value:''},
  ELMOS_GUIDED_PLAN:PLAN,
  fieldValue(){mutations++},
  state:()=>({points:[{pressure:0,adc_s:123}]}),
  window:{confirm:()=>{confirms++;return false}},
  setTemperatureInputs(){},
  renderPlan(){}
 };
 vm.runInNewContext(src+'\npreset("quick")',context);
 assert.equal(confirms,1);
 assert.equal(mutations,0);
});
