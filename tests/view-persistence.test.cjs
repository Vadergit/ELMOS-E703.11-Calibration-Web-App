'use strict';
// Regression tests for restoring the selected interface after F5 / Ctrl+R.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const guided=read('guided.js');

function section(start,end){
 const first=guided.indexOf(start),last=guided.indexOf(end,first+start.length);
 assert.ok(first>=0&&last>first,'Could not find guided module section');
 return guided.slice(first,last);
}
test('View preference helpers persist guided/classic selection and survive unavailable storage',()=>{
 const values=new Map();
 const storage={
  getItem:key=>values.has(key)?values.get(key):null,
  setItem:(key,value)=>values.set(key,value)
 };
 const helper=section(' const VIEW_PREFERENCE_KEY=', ' const msg=');
 const p=vm.runInNewContext(helper+'\n({rememberedView,saveView,VIEW_PREFERENCE_KEY})',{localStorage:storage});
 assert.equal(p.rememberedView(),null);
 p.saveView('guided');
 assert.equal(p.rememberedView(),'guided');
 p.saveView('classic');
 assert.equal(p.rememberedView(),'classic');
 assert.equal(p.VIEW_PREFERENCE_KEY,'elmos-ui-last-view-v1');
 const blocked=vm.runInNewContext(helper+'\n({rememberedView,saveView})',{
  localStorage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}}
 });
 assert.equal(blocked.rememberedView(),null);
 assert.doesNotThrow(()=>blocked.saveView('guided'));
});
test('Guided is default; an explicit classic choice survives reload and load callback',()=>{
 const src=section(' function init(){',' function appliedPlanForConfig(){');
 for(const preference of ['guided','classic',null]){
  const calls=[],node={addEventListener:type=>calls.push('listen:'+type)};
  let loadCallback=null;
  const context={
   mode:false,location:{hash:''},
   $:()=>node,
   rememberedView:()=>preference,
   open:()=>{calls.push('open');context.mode=true},
   toggleTopView:()=>calls.push('toggle'),
   syncTopMode:()=>calls.push('sync'),
   window:{addEventListener:(event,cb)=>{assert.equal(event,'load');loadCallback=cb}},
   document:{documentElement:{classList:{remove:key=>calls.push('remove:'+key)}}}
  };
  vm.runInNewContext(src+'\ninit()',context);
  assert.equal(calls.includes('open'),preference!=='classic');
  assert.equal(calls.includes('sync'),preference==='classic');
  assert.ok(calls.includes('remove:guided-restore-pending'));
  assert.equal(calls.filter(x=>x==='listen:click').length,2);
  assert.equal(typeof loadCallback,'function');
  loadCallback();
  assert.equal(calls.filter(x=>x==='open').length,preference==='classic'?0:1);
 }
});
test('Late script load retries a failed guided mounting, but never overrides chosen classic',()=>{
 const src=section(' function init(){',' function appliedPlanForConfig(){');
 let preference='guided',loadCallback,tries=0;
 const el={addEventListener(){}};
 const context={
  mode:false,location:{hash:''},$:()=>el,rememberedView:()=>preference,
  toggleTopView(){},syncTopMode(){},
  open(){tries++;if(tries===2)context.mode=true},
  window:{addEventListener:(_,fn)=>loadCallback=fn},
  document:{documentElement:{classList:{remove(){}}}}
 };
 vm.runInNewContext(src+'\ninit()',context);
 assert.equal(tries,1);
 assert.equal(context.mode,false);
 loadCallback();
 assert.equal(tries,2);
 assert.equal(context.mode,true);
 context.mode=false;
 preference='classic';
 loadCallback();
 assert.equal(tries,2);
});
test('A successful guided opening and explicit classic switch update the saved view',()=>{
 const src=section(' function open(){',' function onSensorReset(');
 const saved=[],classes=new Set();
 let busy=false;
 const root={hidden:true,replaceChildren(){}};
 const context={
  mode:false,nextSensorPending:null,fitAutomationBusy:false,setupBusy:false,
  stage:0,task:'calibration',visited:new Set([0]),plan:null,signature:null,
  seriesPointFields:null,selectedPoint:0,latestCapture:null,lastCaptureRenderKey:null,
  subscriptions:[],poll:null,pendingCapture:null,root,
  $:()=>({checked:false,closest:()=>null}),
  build(){},render(){},restore(){},updateUI(){},syncTopMode(){},msg(){},closeNvmCalculator(){},
  saveView:value=>saved.push(value),
  console:{error(){}},
  document:{documentElement:{classList:{
   add:x=>classes.add(x),remove:x=>classes.delete(x)
  }}},
  window:{
   ELMOS_TEST_LOGGER:{isBusy:()=>busy,unmount(){}},
   ELMOS_GUIDED_API:{refresh(){}},
   setInterval:()=>17,clearInterval(){},scrollTo(){}
  }
 };
 const run=vm.runInNewContext(src+'\n({open,close})',context);
 run.open();
 assert.equal(context.mode,true);
 assert.equal(root.hidden,false);
 assert.ok(classes.has('guided-active'));
 assert.deepEqual(saved,['guided']);
 run.close();
 assert.equal(context.mode,false);
 assert.equal(root.hidden,true);
 assert.ok(!classes.has('guided-active'));
 assert.deepEqual(saved,['guided','classic']);
 run.open();
 busy=true;
 run.close(); // Switching is blocked while logging, so do not forget guided preference.
 assert.equal(context.mode,true);
 assert.deepEqual(saved,['guided','classic','guided']);
 busy=false;
 run.close({preservePreference:true}); // Opening EEPROM is not a view preference.
 assert.equal(context.mode,false);
 assert.deepEqual(saved,['guided','classic','guided']);
 run.open(); // Explicitly return to the guided view.
 assert.deepEqual(saved,['guided','classic','guided','guided']);
});
test('HTML suppresses first-paint classic flash and uses the same persisted key',()=>{
 const html=read('index.html');
 assert.match(html,/localStorage\.getItem\('elmos-ui-last-view-v1'\)/);
 assert.match(html,/guided-restore-pending \.content\{visibility:hidden\}/);
 assert.match(html,/guided\.js\?v=0\.7\.\d+/);
 assert.match(html,/data-app-version="0\.7\.\d+"/);
});

test('sensor reconnect never changes the visible tool or opens another view',()=>{
 const src=section(' function onConnected(){',' function init(){');
 function simulate({mode=false,reset=false,connectionOpen=false}={}){
  const events=[],ctx={
   mode,chipResetPending:reset,connectionOpen,
   render:()=>events.push('render'),
   renderConnectionStatus:()=>events.push('connection'),
   stage:7,plan:null,signature:null,seriesPointFields:null,selectedPoint:0,
   latestCapture:null,lastCaptureRenderKey:null,visited:new Set([0,7])
  };
  vm.runInNewContext(src+'\nonConnected()',ctx);
  return {events,stage:ctx.stage,mode:ctx.mode};
 }
 // EEPROM Viewer and Sensorbrücken-Rechner both use classic panels (mode=false).
 assert.deepEqual(simulate().events,[]);
 assert.deepEqual(simulate({reset:true}).events,[]);
 assert.deepEqual(simulate({mode:true}).events,[]);
 // An actually interrupted guided calibration may reset its invalid points.
 const interrupted=simulate({mode:true,reset:true});
 assert.deepEqual(interrupted.events,['render']);
 assert.equal(interrupted.stage,0);
});

test('successful chip detection does not jump from EEPROM Viewer to classic AFE',()=>{
 const app=read('app.js');
 const detect=app.slice(app.indexOf(' async function detect({'),app.indexOf(' async function recoverOneWireStartup()'));
 assert.ok(detect.length>1000);
 assert.doesNotMatch(detect,/\bstep\(\s*1\s*\)/,'A chip handshake must not navigate to AFE');
 assert.match(detect,/window\.ELMOS_GUIDED\?\.onConnected\?\.\(\)/);
});
