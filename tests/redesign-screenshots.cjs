'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 fs.mkdirSync('screenshots',{recursive:true});
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const records=[],errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
 // Preview-only hook in served JS; no source or hardware protections changed.
 await page.route('**/guided.js?*',async route=>{
  const res=await route.fetch();
  const source=await res.text();
  const marker=' function goto(n){';
  if(!source.includes(marker))throw Error('Preview hook missing');
  await route.fulfill({response:res,body:source.replace(marker,`
   window.__screenPreview={preset,go(n){if(n>=3&&!plan){plan=makePlan();}goto(n);},select(n){selectedPoint=n;renderCapture();},connection(){openConnectionPanel();}};
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
   await page.evaluate(()=>window.__screenPreview.preset('tke'));await go(2);
   await page.evaluate(()=>{const el=document.getElementById('calTempSource');const opt=[...el.options].find(x=>/bridge|ptc/i.test(x.value));if(!opt)throw Error('PTC option missing');el.value=opt.value;window.ELMOS_PTC_DEV_UI.refresh();});
  });
  await shot('20-PTC-Formeln','Actual temperature help dialog',async()=>{await page.locator('#gwPtcSetup [data-ptc-help="method"]').click({timeout:4000});});
  await reset();
  await shot('21-Externe-Temperatur','External sensor preview',async()=>{
   await page.evaluate(()=>window.__screenPreview.preset('tke'));await go(2);
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
   await page.locator('[data-gw-preset="quick"]').click();
   await page.locator('#gwNext').click();
   await page.locator('#gwPage2').waitFor({state:'visible',timeout:6000});
   await page.locator('#calDspLimit').fill('25000');await page.locator('#calDspLimit').dispatchEvent('change');
   await page.locator('#gwNext').click();await page.locator('#gwPage3').waitFor({state:'visible',timeout:6000});
   await page.locator('#gwNext').click();await page.locator('#gwPage4').waitFor({state:'visible',timeout:10000});
   await page.locator('#capLo').click();await page.waitForFunction(()=>window.ELMOS_GUIDED_API.state().points.length===1,{},{timeout:10000});
   await page.locator('#capHi').click();await page.waitForFunction(()=>window.ELMOS_GUIDED_API.state().points.length===2,{},{timeout:10000});
  });
  await shot('25-Demo-Automatik','Actual automatic fit and RAM check if successful',async()=>{await page.locator('#gwNext').click({timeout:4000});await page.locator('#gwPage6').waitFor({state:'visible',timeout:12000});});

  // Visual matrix: all offered presets and applicable thermal sources. These
  // are explicitly layout previews; no safety gate is relaxed in production.
  const matrix=[{preset:'quick',source:'internal',thermal:false},
   ...['tk0','tke','temperature','custom'].flatMap(preset=>['internal','bridge','external'].map(source=>({preset,source,thermal:true}))),
   {preset:'custom',source:'internal',thermal:false,zeroOrder:true}];
  for(const view of [{width:1440,height:900,theme:'light'},{width:1024,height:768,theme:'light'},{width:768,height:1024,theme:'light'},{width:390,height:844,theme:'light'},{width:1440,height:900,theme:'dark'},{width:390,height:844,theme:'dark'}]){
   await page.setViewportSize({width:view.width,height:view.height});
   for(const v of matrix){
    const key='matrix-'+view.width+'-'+view.theme+'-'+v.preset+'-'+v.source+(v.zeroOrder?'-T0':'');
    const external=v.thermal&&v.source!=='internal';
    const show=async(id,expected)=>{const actual=await page.locator('#'+id).isVisible();if(actual!==expected)throw Error(id+' visibility '+actual+'; expected '+expected);};
    const inspect=async(stage)=>{
     const result=await page.evaluate(()=>{
      const visible=e=>e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden';
      const buttons=[...document.querySelectorAll('#guidedWorkspace button')].filter(visible);
      const issues=[];
      for(const b of buttons){
       const r=b.getBoundingClientRect(),s=getComputedStyle(b);
       if(r.width<1||r.height<1)issues.push({id:b.id,text:b.textContent.trim(),issue:'zero size'});
       if(b.scrollWidth>b.clientWidth+2||b.scrollHeight>b.clientHeight+2)issues.push({id:b.id,text:b.textContent.trim(),issue:'text overflow'});
       // Horizontal scrolling in the step/point navigation is intentional.
       if(!b.closest('.gw-sideitems,.gw-point-nav')&&(r.right>innerWidth+2||r.left<-2))issues.push({id:b.id,text:b.textContent.trim(),issue:'outside viewport'});
      }
      return {buttons:buttons.map(b=>({id:b.id,text:b.textContent.trim(),disabled:b.disabled})),issues,documentOverflow:document.documentElement.scrollWidth>innerWidth+2};
     });
     checks.push({key,stage,...result});
     if(result.issues.length||result.documentOverflow)throw Error('Layout: '+JSON.stringify({issues:result.issues,documentOverflow:result.documentOverflow}));
    };
    await shot(key+'-01-plan','Preset selection via actual button; layout and button inventory',async()=>{
     await reset();await page.evaluate(theme=>{const e=document.getElementById('settingsTheme');e.value=theme;e.dispatchEvent(new Event('change',{bubbles:true}));},view.theme);await go(1);
     await page.locator('[data-gw-preset="'+v.preset+'"]').click();
     if(v.zeroOrder)await page.locator('#gwTOrder').selectOption('0');
     await show('gwNext',true);await show('gwPrevious',true);await inspect(1);
    });
    await shot(key+'-02-setup','Source-specific setup preview',async()=>{
     await go(2);
     await show('calTempSource',v.thermal);
     if(v.thermal)await page.evaluate(source=>{document.getElementById('calTempSource').value=source;window.ELMOS_GUIDED.temperatureSourceChanged();},v.source);
     await show('gwPtcSetup',external);await inspect(2);
    });
    await shot(key+'-03-afe','Source-specific AFE preview',async()=>{
     await go(3);await show('gwPtcControls',external);await show('gwPtcPlot',external);await inspect(3);
    });
    await shot(key+'-04-capture','Measurement matrix preview (no fake completed captures)',async()=>{await go(4);await inspect(4);});
    await shot(key+'-05-fit','Coefficient configuration preview',async()=>{
     await go(5);if(!v.thermal){await show('calTOrder',false);await show('calFitMode',false);}await inspect(5);
    });
    if(external&&v.preset==='tke')await shot(key+'-06-help','Actual source-specific formula dialog',async()=>{
     await go(3);await page.locator('#gwPtcControls [data-ptc-help="method"]').click();
     await show('ptcHelpDialog',true);await page.locator('#ptcHelpDialog .nvmrecon-formula-close').waitFor({state:'visible'});
     try{await inspect('help');}finally{await page.locator('#ptcHelpDialog .nvmrecon-formula-close').click();}
    });
   }
  }
 }finally{
  fs.writeFileSync('screenshots/button-audit.json',JSON.stringify(checks,null,2));
  fs.writeFileSync('screenshots/manifest.json',JSON.stringify({records,errors},null,2));
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  fs.writeFileSync('screenshots/index.html','<!doctype html><html lang="de"><meta charset="utf-8"><title>ELMOS UIUX Screenshots</title><style>body{font:16px system-ui;max-width:1500px;margin:24px auto;padding:0 20px;color:#24374b}img{max-width:100%;border:1px solid #c9d2da;border-radius:6px}section{margin:25px 0}small{color:#58697b}</style><h1>ELMOS v0.7.205 – UI/UX</h1><p>Demo und Layoutvorschau. Erzwungene Navigation dient nur der Ansicht, nicht als Kalibrierungsnachweis.</p>'+records.map(r=>'<section><h2>'+esc(r.name)+'</h2>'+ (r.error?'<p>'+esc(r.error)+'</p>':'<small>'+esc(r.note)+'</small><p><a href="'+r.name+'.png"><img loading="lazy" src="'+r.name+'.png"></a></p>')+'</section>').join(''));
  console.log(JSON.stringify({records,errors},null,2));await browser.close();
  if(records.some(r=>r.error)||errors.length)process.exitCode=1;
 }
})().catch(e=>{console.error(e);process.exitCode=1});
