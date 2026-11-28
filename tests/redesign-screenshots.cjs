'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 fs.mkdirSync('screenshots',{recursive:true});
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const records=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
 // Preview-only hook in served JS; no source or hardware protections changed.
 await page.route('**/guided.js?*',async route=>{
  const res=await route.fetch();
  const source=await res.text();
  const marker=' function goto(n){';
  if(!source.includes(marker))throw Error('Preview hook missing');
  await route.fulfill({response:res,body:source.replace(marker,`
   window.__screenPreview={go(n){if(n>=3&&!plan){plan=makePlan();}goto(n);},select(n){selectedPoint=n;renderCapture();},connection(){openConnectionPanel();}};
   `+marker)});
 });
 const shot=async(name,note,fn)=>{
  try{await fn();await page.waitForTimeout(250);await page.screenshot({path:'screenshots/'+name+'.png',fullPage:true,animations:'disabled',timeout:8000});records.push({name,note});}
  catch(e){records.push({name,error:String(e)});}
 };
 const go=n=>page.evaluate(n=>window.__screenPreview.go(n),n);
 const reset=async()=>{await page.goto('http://127.0.0.1:8765/?demo=1');await page.waitForFunction(()=>window.ELMOS_GUIDED_API?.state()?.chip&&window.ELMOS_GUIDED?.isOpen?.(),{},{timeout:20000});};
 try{
  await reset();
  await shot('01-Aufgabenauswahl','Demo sensor connected',async()=>{});
  await shot('02-Verbindung-Diagnose','Connection preview',()=>page.evaluate(()=>window.__screenPreview.connection()));
  await reset();
  await shot('03-Abgleich-planen','Layout preview',()=>go(1));
  await shot('04-Sensor-vorbereiten','Layout preview',()=>go(2));
  await shot('05-AFE','Layout preview',()=>go(3));
  await shot('06-Messpunkte','Layout preview before capture',()=>go(4));
  await shot('07-Koeffizienten','Layout preview before calculation',()=>go(5));
  await shot('08-DSP-Pruefung','Layout preview, not verified',()=>go(6));
  await shot('09-Ausgang','Layout preview',()=>go(7));
  await shot('10-Alarme','Optional alarm step',()=>go(8));
  await shot('11-NVM','Layout preview, not programmed',()=>go(9));
  await shot('12-Abschlusspruefung','Layout preview, not verified',()=>go(10));
  await shot('13-Test-Logging','Layout preview',()=>go(11));
  await reset();
  await shot('14-Einstellungen','Actual settings',async()=>{await page.locator('#settingsOpen').click();});
  await shot('15-Persoenliches-Profil','Actual profile fields, expanded',async()=>{
   await page.evaluate(()=>{const p=document.getElementById('settingsPanel');p.hidden=false;const e=document.getElementById('settingsProfileOperator');e.closest('details').open=true;e.scrollIntoView({block:'center'});});
  });
  await reset();
  await shot('16-Nachmessung','Actual verification planner',()=>page.evaluate(()=>window.ELMOS_ARCHIVE.open('verification')));
  await shot('17-Archiv','Actual empty local archive',()=>page.evaluate(()=>window.ELMOS_ARCHIVE.open('archive')));
  await reset();
  await shot('18-Sensorbrueckenrechner','Actual tool',()=>page.evaluate(()=>window.ELMOS_GUIDED.openNvmCalculator()));
  await reset();
  await shot('19-PTC-Auslegung','Temperature setup preview',async()=>{
   await go(2);
   await page.evaluate(()=>{const el=document.getElementById('calTempSource');const opt=[...el.options].find(x=>/bridge|ptc/i.test(x.value));if(!opt)throw Error('PTC option missing');el.value=opt.value;window.ELMOS_PTC_DEV_UI.refresh();});
  });
  await shot('20-PTC-Formeln','Actual temperature help dialog',async()=>{await page.locator('#gwPtcSetup [data-ptc-help="method"]').click({timeout:4000});});
  await reset();
  await shot('21-Externe-Temperatur','External sensor preview',async()=>{
   await go(2);
   await page.evaluate(()=>{const el=document.getElementById('calTempSource');const opt=[...el.options].find(x=>/external|eoc/i.test(x.value));if(!opt)throw Error('EOC option missing');el.value=opt.value;window.ELMOS_PTC_DEV_UI.refresh();});
  });
  await shot('22-EOC-Formeln','Actual temperature help dialog',async()=>{await page.locator('#gwPtcSetup [data-ptc-help="method"]').click({timeout:4000});});
  await reset();
  await shot('23-Dunkelmodus','Actual theme',async()=>{await page.evaluate(()=>{const e=document.getElementById('settingsTheme');e.value='dark';e.dispatchEvent(new Event('change',{bubbles:true}));});await go(3);});
  // Actual demo captures, if the existing prerequisites allow them.
  await reset();
  await shot('24-Demo-Messpunkte-Hub','Real demo capture if successful',async()=>{
   await page.locator('[data-gw-task="calibration"]').click();
   await page.locator('#gwPage1').waitFor({state:'visible',timeout:10000});
   await page.locator('#gwNext').click();
   await page.locator('#gwPage2').waitFor({state:'visible',timeout:6000});
   await page.locator('#calDspLimit').fill('25000');await page.locator('#calDspLimit').dispatchEvent('change');
   await page.locator('#gwNext').click();await page.locator('#gwPage3').waitFor({state:'visible',timeout:6000});
   await page.locator('#gwNext').click();await page.locator('#gwPage4').waitFor({state:'visible',timeout:10000});
   await page.locator('#capLo').click();await page.waitForFunction(()=>window.ELMOS_GUIDED_API.state().points.length===1,{},{timeout:10000});
   await page.locator('#capHi').click();await page.waitForFunction(()=>window.ELMOS_GUIDED_API.state().points.length===2,{},{timeout:10000});
  });
  await shot('25-Demo-Automatik','Actual automatic fit and RAM check if successful',async()=>{await page.locator('#gwNext').click({timeout:4000});await page.locator('#gwPage6').waitFor({state:'visible',timeout:12000});});
 }finally{
  fs.writeFileSync('screenshots/manifest.json',JSON.stringify({records,errors},null,2));
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  fs.writeFileSync('screenshots/index.html','<!doctype html><html lang="de"><meta charset="utf-8"><title>ELMOS UIUX Screenshots</title><style>body{font:16px system-ui;max-width:1500px;margin:24px auto;padding:0 20px;color:#24374b}img{max-width:100%;border:1px solid #c9d2da;border-radius:6px}section{margin:25px 0}small{color:#58697b}</style><h1>ELMOS v0.7.204 – UI/UX</h1><p>Demo und Layoutvorschau. Erzwungene Navigation dient nur der Ansicht, nicht als Kalibrierungsnachweis.</p>'+records.map(r=>'<section><h2>'+esc(r.name)+'</h2>'+ (r.error?'<p>'+esc(r.error)+'</p>':'<small>'+esc(r.note)+'</small><p><a href="'+r.name+'.png"><img loading="lazy" src="'+r.name+'.png"></a></p>')+'</section>').join(''));
  console.log(JSON.stringify({records,errors},null,2));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
