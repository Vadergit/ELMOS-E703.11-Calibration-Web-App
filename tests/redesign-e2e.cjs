'use strict';
// Actual browser interaction against the demo only. No production hooks, forced
// clicks, fake calibration flags or bypasses of safety gates. Only OS folder
// access is replaced with a memory-backed test double.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const plan=require('../guided-plan.js');
const out=process.env.E2E_OUTPUT||'e2e-report';
const width=Number(process.env.E2E_WIDTH||1440);
const height=Number(process.env.E2E_HEIGHT||900);
const theme=process.env.E2E_THEME||'light';
const expert=process.env.E2E_EXPERT==='true';
const base='http://127.0.0.1:8765/';
const scenarios=[
 {preset:'quick',source:'internal',total:2,thermal:false},
 ...Object.entries({tk0:3,tke:4,temperature:6,custom:6}).flatMap(([preset,total])=>
  ['internal','bridge','external'].map(source=>({preset,source,total,thermal:true}))),
 {preset:'custom',source:'internal',total:6,thermal:false,zeroOrder:true}
];
assert.deepEqual([...new Set(scenarios.map(x=>x.preset))].sort(),Object.keys(plan.presets).sort(),
 'A new preset requires an explicit end-to-end contract');
fs.mkdirSync(out,{recursive:true});
const results=[];
const check=(p,id)=>p.locator('#'+id);
async function visible(p,id,expected=true){
 const el=check(p,id);
 await el.waitFor({state:expected?'visible':'hidden',timeout:8000});
 assert.equal(await el.isVisible(),expected,id+' visibility');
}
async function ready(p,id,expected=true){
 await visible(p,id);
 const el=check(p,id);
 await p.waitForFunction(({id,expected})=>{
  const e=document.getElementById(id);return e&&(!e.disabled)===expected;
 },{id,expected},{timeout:15000});
 assert.equal(await el.isEnabled(),expected,id+' enabled');
 if(expected)await el.click({trial:true,timeout:8000});
}
async function click(p,id){await ready(p,id);await check(p,id).click();}
async function stage(p,n){await visible(p,'gwPage'+n);}
async function state(p,expr,timeout=30000){
 await p.waitForFunction(expr,{}, {timeout});
}
async function installFolder(context){
 await context.addInitScript(()=>{
  const files=new Map();
  const handle=name=>({kind:'file',name,
   async getFile(){if(!files.has(name))throw new DOMException('Missing','NotFoundError');return new File([files.get(name)],name)},
   async createWritable(){let data=files.get(name)||'';return {async write(v){data=String(v)},async close(){files.set(name,data)},async abort(){}}}
  });
  const dir={name:'E2E simulated archive',kind:'directory',
   async queryPermission(){return 'granted'},async requestPermission(){return 'granted'},
   async getFileHandle(name,{create=false}={}){if(!files.has(name)){if(!create)throw new DOMException('Missing','NotFoundError');files.set(name,'')}return handle(name)},
   async *entries(){for(const name of files.keys())yield [name,handle(name)]}
  };
  window.showDirectoryPicker=async()=>dir;
 });
}
async function snapshot(p,dir,name,record){
 // A visible control inventory is evidence, not a substitute for assertions.
 const inventory=await p.evaluate(()=>{
  const root=document.querySelector('#guidedWorkspace');
  const visible=e=>e.getClientRects().length>0&&getComputedStyle(e).visibility==='visible';
  return [...root.querySelectorAll('button,input,select,summary,a')].filter(visible).map(e=>{
   const r=e.getBoundingClientRect();
   return {id:e.id||null,tag:e.tagName,text:(e.innerText||e.getAttribute('aria-label')||'').trim(),disabled:!!e.disabled,
    width:r.width,height:r.height,overflow:e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2};
  });
 });
 record.stages.push({name,inventory});
 await p.screenshot({path:path.join(dir,name+'.png'),fullPage:true,animations:'disabled',timeout:12000});
}
async function settings(p){
 // Use the actual settings controls, not direct changes to application state.
 await click(p,'settingsOpen');
 await visible(p,'settingsPanel');
 await check(p,'settingsTheme').selectOption(theme);
 await check(p,'expertMode').setChecked(expert);
 await click(p,'settingsArchiveChoose');
 await state(p,()=>document.querySelector('#settingsArchiveFolder').textContent.includes('E2E simulated archive'));
 if(await check(p,'settingsPanel').isVisible())await click(p,'settingsOpen');
 await visible(p,'settingsPanel',false);
}
async function runFlow(p,v,dir,record){
 await p.goto(base+'?demo=1');
 await state(p,()=>window.ELMOS_GUIDED_API?.state()?.chip&&window.ELMOS_GUIDED_API.state().demo&&window.ELMOS_GUIDED?.isOpen?.());
 await settings(p);
 await stage(p,0);
 await visible(p,'gwNext',false);await visible(p,'gwPrevious',false);
 await snapshot(p,dir,'00-home',record);
 const task=p.locator('[data-gw-task="calibration"]');
 await task.click();
 await stage(p,1);
 const presets=await p.locator('#gwPage1 [data-gw-preset]').evaluateAll(es=>es.map(e=>e.dataset.gwPreset).sort());
 assert.deepEqual(presets,Object.keys(plan.presets).sort());
 await p.locator('#gwPage1 [data-gw-preset="'+v.preset+'"]').click();
 if(v.zeroOrder)await check(p,'gwTOrder').selectOption('0');
 await snapshot(p,dir,'01-plan',record);
 await click(p,'gwNext');await stage(p,2);
 await visible(p,'calTempSource',v.thermal);
 if(v.thermal){
  const options=await check(p,'calTempSource').locator('option').evaluateAll(es=>es.map(e=>e.value).sort());
  assert.deepEqual(options,['bridge','external','internal'],'New temperature source requires test coverage');
  await check(p,'calTempSource').selectOption(v.source);
  await state(p,()=>!window.ELMOS_GUIDED_API.temperatureSourceBusy?.());
 }
 const external=v.thermal&&v.source!=='internal';
 await visible(p,'gwPtcSetup',external);
 if(external){
  await visible(p,'gwPtcFields',v.source==='bridge');await visible(p,'gwEocFields',v.source==='external');
 }
 await check(p,'calDspLimit').fill('25000');await check(p,'calDspLimit').dispatchEvent('change');
 await snapshot(p,dir,'02-setup',record);
 // Back/forward must retain the selected plan.
 await click(p,'gwPrevious');await stage(p,1);await click(p,'gwNext');await stage(p,2);
 if(v.thermal)assert.equal(await check(p,'calTempSource').inputValue(),v.source);
 await click(p,'gwNext');await stage(p,3);
 await visible(p,'gwPtcControls',external);await visible(p,'gwPtcPlot',external);
 assert.equal(await p.locator('.ptc-offline-diagnostic').isVisible(),false,'Duplicate temperature calculator visible');
 await ready(p,'gwAfeReset');
 if(external){
  await click(p,'gwPtcConfigure');
  await state(p,()=>document.querySelector('#gwPtcMessage').textContent.includes('RAM bestätigt'));
  await click(p,'gwPtcLow');await p.waitForTimeout(1000);
  await click(p,'gwPtcHigh');await p.waitForTimeout(1000);
 }
 await snapshot(p,dir,'03-afe',record);
 await click(p,'gwNext');await stage(p,4);
 const nav=p.locator('#gwPointNav button');
 assert.equal(await nav.count(),v.total,'Measurement matrix has wrong point count');
 await ready(p,'gwNext',false);
 for(let i=0;i<v.total;i++){
  await nav.nth(i).click();
  const capture=p.locator('#gwPointHost button[id="capLo"],#gwPointHost button[id="capHi"],#gwPointHost button[id$="Capture"]').filter({visible:true});
  assert.equal(await capture.count(),1,'Exactly one active capture action for point '+(i+1));
  await capture.click();
  await state(p,()=>window.ELMOS_GUIDED_API.state().points.length>0);
  await p.waitForFunction(n=>window.ELMOS_GUIDED_API.state().points.length===n,i+1,{timeout:30000});
  await snapshot(p,dir,'04-point-'+(i+1),record);
  await ready(p,'gwNext',i===v.total-1);
 }
 await click(p,'gwNext');await stage(p,6);
 const s=await p.evaluate(()=>window.ELMOS_GUIDED_API.state());
 assert.equal(s.calStaged,true);assert.equal(s.calVerified,false);assert.equal(s.nvmDone,false);
 await ready(p,'gwNext',false);
 await snapshot(p,dir,'06-dsp-before',record);
 await click(p,'calVerifyRam');
 await state(p,()=>window.ELMOS_GUIDED_API.state().calVerified===true);
 await snapshot(p,dir,'06-dsp-verified',record);
 await click(p,'gwNext');await stage(p,7);
 await visible(p,'gwAdvancedOutput',expert);
 await click(p,'expertOutputPreset');await click(p,'expertOutputStage');
 await state(p,()=>!window.ELMOS_GUIDED_API.state().outputScalingRequired);
 await snapshot(p,dir,'07-output',record);
 await click(p,'gwNext');await stage(p,8);
 assert.equal(await check(p,'gwUseAlarms').isChecked(),false);
 await visible(p,'gwAlarmConfigArea',false);
 await check(p,'gwUseAlarms').check();await visible(p,'gwAlarmConfigArea');
 await check(p,'gwUseAlarms').uncheck();await visible(p,'gwAlarmConfigArea',false);
 await snapshot(p,dir,'08-alarms',record);
 await click(p,'gwSkipAlarm');await stage(p,9);
 await ready(p,'gwNext',false);await ready(p,'nvmProgram',false);
 await click(p,'nvmPrepare');await ready(p,'nvmProgram');
 await snapshot(p,dir,'09-nvm-ready',record);
 await click(p,'nvmProgram');
 await state(p,()=>window.ELMOS_GUIDED_API.state().nvmDone===true,60000);
 await stage(p,10);
 await ready(p,'gwTasks');await visible(p,'gwNext',false);
 await snapshot(p,dir,'10-finish',record);
 await click(p,'gwTasks');await stage(p,0);
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const v of scenarios){
   const id=v.preset+'-'+v.source+(v.zeroOrder?'-T0':'');
   const dir=path.join(out,id);fs.mkdirSync(dir,{recursive:true});
   const record={id,configuration:{...v,width,height,theme,expert},stages:[],dialogs:[],errors:[],status:'failed'};
   results.push(record);
   const context=await browser.newContext({viewport:{width,height}});
   await installFolder(context);
   await context.tracing.start({screenshots:true,snapshots:true});
   const p=await context.newPage();
   p.setDefaultTimeout(12000);
   p.on('pageerror',e=>record.errors.push(e.message));
   // Confirmations are only accepted in this dedicated demo context; all are logged.
   p.on('dialog',async d=>{record.dialogs.push({type:d.type(),message:d.message()});if(d.type()==='confirm'||d.type()==='alert')await d.accept();else await d.dismiss();});
   try{
    await runFlow(p,v,dir,record);assert.deepEqual(record.errors,[]);record.status='passed';
   }catch(e){
    record.failure=String(e.stack||e);
    record.message=await p.locator('#gwMessage').innerText({timeout:1000}).catch(()=>null);
    await p.screenshot({path:path.join(dir,'FAILED.png'),fullPage:true,timeout:5000}).catch(()=>{});
   }finally{
    await context.tracing.stop({path:path.join(dir,'trace.zip')}).catch(()=>{});
    await context.close();
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
    console.log(id+': '+record.status+(record.failure?' '+record.failure.split('\n')[0]:''));
   }
  }
 }finally{await browser.close()}
 assert.equal(results.length,scenarios.length,'Missing scenario results');
 if(results.some(r=>r.status!=='passed'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
