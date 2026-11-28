'use strict';
// Real DOM visibility test without sensor writes. Preview navigation only; no calibration proof.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.route('**/guided.js?*',async route=>{
   const response=await route.fetch(),src=await response.text();
   const marker=' function goto(n){';
   assert.ok(src.includes(marker));
   await route.fulfill({response,body:src.replace(marker,' window.__testGuided={go:goto,preset};\n'+marker)});
  });
  await page.goto('http://127.0.0.1:8765/');
  await page.waitForFunction(()=>window.ELMOS_GUIDED?.isOpen?.()&&window.__testGuided);
  const usePreset=name=>page.evaluate(name=>{window.__testGuided.preset(name);window.__testGuided.go(2)},name);
  const source=value=>page.evaluate(value=>{document.getElementById('calTempSource').value=value;window.ELMOS_GUIDED.temperatureSourceChanged();},value);
  const go=n=>page.evaluate(n=>window.__testGuided.go(n),n);
  const standalone=page.locator('.ptc-offline-diagnostic');
  assert.equal(await standalone.count(),1);
  const verifyStandaloneHidden=async()=>{
   assert.equal(await standalone.evaluate(el=>!!el.closest('#guidedWorkspace')),true);
   // Expert mode may reveal classic controls; guided CSS must still hide this row.
   assert.equal(await standalone.evaluate(el=>{const old=el.hidden;el.hidden=false;try{return getComputedStyle(el).display}finally{el.hidden=old}}),'none');
   assert.equal(await standalone.isVisible(),false);
  };
  await usePreset('tke');await source('internal');await go(3);
  await verifyStandaloneHidden();
  assert.equal(await page.locator('#gwPtcControls').isVisible(),false);
  assert.equal(await page.locator('#gwPtcPlot').isVisible(),false);
  for(const type of ['bridge','external']){
   await usePreset('tke');await source(type);
   assert.equal(await page.locator('#gwPtcSetup').isVisible(),true);
   await go(3);
   await verifyStandaloneHidden();
   assert.equal(await page.locator('#gwPtcControls').isVisible(),true);
   assert.equal(await page.locator('#gwPtcPlot').isVisible(),true);
   await page.locator('#gwPtcControls [data-ptc-help="method"]').click();
   const dialog=page.locator('#ptcHelpDialog');
   assert.equal(await dialog.isVisible(),true);
   assert.equal(await dialog.getAttribute('class'),'nvmrecon-formula-dialog');
   assert.ok(await dialog.locator('.nvmrecon-formula-equation sub').count()>0);
   const cols=await dialog.locator('.ptc-help-comparison').first().evaluate(e=>Array.from(e.children).map(c=>({label:c.querySelector('strong').textContent,x:c.getBoundingClientRect().left})));
   assert.equal(cols[0].label,'Formel');assert.equal(cols[1].label,'Rechenbeispiel');assert.ok(cols[0].x<cols[1].x);
   await dialog.locator('.nvmrecon-formula-close').click();
   await usePreset('quick');
   assert.equal(await page.locator('#gwPtcSetup').isVisible(),false);
   assert.equal(await page.locator('#calTempSource').isVisible(),false);
   await go(3);
   await verifyStandaloneHidden();
   assert.equal(await page.locator('#gwPtcControls').isVisible(),false);
   assert.equal(await page.locator('#gwPtcPlot').isVisible(),false);
   assert.equal(await page.evaluate(()=>window.ELMOS_PTC_DEV_UI.active()),false);
   await go(5);
   assert.equal(await page.locator('#calTOrder').isVisible(),false);
   assert.equal(await page.locator('#calFitMode').isVisible(),false);
  }
  console.log('PTC and EOC thermal-to-quick visibility and shared formula dialog verified in Chromium.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
