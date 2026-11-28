'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
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
  Object.defineProperty(window,'showDirectoryPicker',{configurable:true,writable:true,value:async()=>dir});
 });
}
(async()=>{
 fs.mkdirSync('screenshots',{recursive:true});
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 await installFolder(page.context());
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
  catch(e){records.push({name,error:String(e)});try{await page.screenshot({path:'screenshots/'+name+'-FAILED.png',fullPage:true,animations:'disabled',timeout:5000});}catch(_){}}
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
   const details=page.locator('#settingsPanel details').filter({has:page.locator('#settingsProfileOperator')});
   if(!await details.evaluate(e=>e.open))await details.locator('summary').click();
   await page.locator('#settingsProfileOperator').waitFor({state:'visible'});
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

   // Common pages and modes do not depend on the calibration preset.
   const prefix='common-'+view.width+'-'+view.theme;
   await shot(prefix+'-offline','Actual disconnected start, no serial hardware',async()=>{
    await page.goto('http://127.0.0.1:8765/');
    await page.waitForFunction(()=>window.ELMOS_GUIDED?.isOpen?.());
    await page.evaluate(theme=>{const e=document.getElementById('settingsTheme');e.value=theme;e.dispatchEvent(new Event('change',{bubbles:true}));},view.theme);
    if(!await page.locator('#gwQuickConnectButton').isVisible())throw Error('Offline connect button missing');
    if(await page.locator('#gwPrevious').isVisible()||await page.locator('#gwNext').isVisible())throw Error('Inert start navigation visible');
   });
   for(const board of ['ssp3','esp32','promicro'])for(const iface of ['plc','i2c']){
    await shot(prefix+'-connect-'+board+'-'+iface,'Actual board/interface selection; no USB picker invoked',async()=>{
     await page.locator('#gwQuickBoard').selectOption(board);await page.locator('#gwQuickInterface').selectOption(iface);
     await page.locator('#gwQuickConnectButton').waitFor({state:'visible'});
    });
   }
   await shot(prefix+'-diagnostics','Actual offline diagnostics',async()=>{
    await page.locator('#gwConnectionToggle').click();await page.locator('#gwConnectionPage').waitFor({state:'visible'});
    if(!await page.locator('#gwConnectionLog').isVisible())throw Error('USB log export missing');
   });
   for(const expert of [false,true])for(const adapter of ['ssp3','bridge']){
    await shot(prefix+'-diagnostics-'+adapter+'-'+(expert?'expert':'normal'),'Adapter-specific diagnostic controls',async()=>{
     await page.evaluate(expert=>{const e=document.getElementById('expertMode');e.checked=expert;e.dispatchEvent(new Event('change',{bubbles:true}));},expert);
     await page.locator('#gwConnectionAdapter').selectOption(adapter);await page.waitForTimeout(800);
     const spi=await page.locator('#gwConnectionInterface option[value="spi"]').isDisabled();
     if(spi!==(adapter==='bridge'||!expert))throw Error('SPI availability mismatch');
     if(await page.locator('#gwConnectionAdvanced').isVisible()!==expert)throw Error('Expert diagnostics visibility mismatch');
    });
   }
   await reset();
   await shot(prefix+'-demo-home','Actual demo home',async()=>{await go(0);});
   for(const stage of [6,7,8,9,10,11]){
    await shot(prefix+'-step-'+stage,'Layout preview only; no fabricated success flags',async()=>{await go(stage);});
   }
   for(const expert of [false,true])for(const output of ['keep','1','2','3','4','5','onewire']){
    await shot(prefix+'-output-'+output+'-'+(expert?'expert':'normal'),'Output layout preview; no apply or NVM action',async()=>{
     await go(7);await page.evaluate(({expert,output})=>{
      const e=document.getElementById('expertMode');e.checked=expert;e.dispatchEvent(new Event('change',{bubbles:true}));
      const mode=document.getElementById('expertOutputMode');mode.value=output;mode.dispatchEvent(new Event('change',{bubbles:true}));
     },{expert,output});
     if(await page.locator('#gwOutputVoltage').isVisible()!==['keep','1','2','3'].includes(output))throw Error('Analog scaling visibility mismatch');
     if(await page.locator('#gwAdvancedOutput').isVisible()!==expert)throw Error('Expert output visibility mismatch');
    });
   }
   for(const enabled of [false,true]){
    await shot(prefix+'-alarms-'+(enabled?'edit':'skip'),'Optional alarm controls',async()=>{
     await go(8);await page.locator('#gwUseAlarms').setChecked(enabled);
     if(await page.locator('#gwAlarmConfigArea').isVisible()!==enabled)throw Error('Alarm control visibility mismatch');
    });
   }
   await reset();
   await shot(prefix+'-settings','Actual settings dialog',async()=>{await page.locator('#settingsOpen').click();});
   await reset();
   await shot(prefix+'-verification','Actual verification view',()=>page.evaluate(()=>window.ELMOS_ARCHIVE.open('verification')));
   await reset();
   await shot(prefix+'-archive','Actual archive view',()=>page.evaluate(()=>window.ELMOS_ARCHIVE.open('archive')));
   await reset();
   await shot(prefix+'-calculator','Actual sensor bridge calculator',()=>page.evaluate(()=>window.ELMOS_GUIDED.openNvmCalculator()));
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
  fs.writeFileSync('screenshots/index.html','<!doctype html><html lang="de"><meta charset="utf-8"><title>ELMOS UIUX Screenshots</title><style>body{font:16px system-ui;max-width:1500px;margin:24px auto;padding:0 20px;color:#24374b}img{max-width:100%;border:1px solid #c9d2da;border-radius:6px}section{margin:25px 0}small{color:#58697b}</style><h1>ELMOS v0.7.206 – UI/UX</h1><p>Demo und Layoutvorschau. Erzwungene Navigation dient nur der Ansicht, nicht als Kalibrierungsnachweis.</p>'+records.map(r=>'<section><h2>'+esc(r.name)+'</h2>'+ (r.error?'<p>'+esc(r.error)+'</p>':'<small>'+esc(r.note)+'</small><p><a href="'+r.name+'.png"><img loading="lazy" src="'+r.name+'.png"></a></p>')+'</section>').join(''));
  console.log(JSON.stringify({records,errors},null,2));await browser.close();
  if(records.some(r=>r.error)||errors.length)process.exitCode=1;
 }
})().catch(e=>{console.error(e);process.exitCode=1});
