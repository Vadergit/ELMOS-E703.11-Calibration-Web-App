'use strict';
// Real Chromium DOM and demo sensor; directory picker is a memory-backed test double.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.dismiss());
  await page.addInitScript(()=>{
   const files=new Map();
   window.__profileTestFiles=files;
   const handle=name=>({kind:'file',name,
    async getFile(){if(!files.has(name))throw new DOMException('Missing','NotFoundError');return new File([files.get(name)],name)},
    async createWritable(){let data=files.get(name)||'';return {async write(v){data=String(v)},async close(){files.set(name,data)},async abort(){}}}
   });
   const dir={name:'Demo test archive',kind:'directory',async queryPermission(){return 'granted'},async requestPermission(){return 'granted'},
    async getFileHandle(name,{create=false}={}){if(!files.has(name)){if(!create)throw new DOMException('Missing','NotFoundError');files.set(name,'')}return handle(name)},
    async *entries(){for(const name of files.keys())yield [name,handle(name)]}
   };
   window.showDirectoryPicker=async()=>dir;
  });
  await page.goto('http://127.0.0.1:8765/?demo=1');
  await page.waitForFunction(()=>window.ELMOS_GUIDED_API?.state()?.chip&&window.ELMOS_GUIDED?.isOpen?.(),{},{timeout:30000});
  const openProfile=async()=>{
   if(!await page.locator('#settingsPanel').isVisible())await page.locator('#settingsOpen').click();
   await page.locator('#settingsPanel').waitFor({state:'visible'});
   const details=page.locator('#settingsPanel details').filter({has:page.locator('#settingsProfileOperator')});
   if(!await details.evaluate(e=>e.open))await details.locator('summary').click();
   await page.locator('#settingsProfileOperator').waitFor({state:'visible'});
  };
  await openProfile();
  await page.locator('#settingsProfileOperator').fill('Browser test operator');
  await page.locator('#settingsProfileLocation').fill('Demo laboratory');
  await page.locator('#settingsProfileMode').selectOption('pressure');
  await page.locator('#settingsProfileCycles').fill('2');
  await page.locator('#settingsProfileSamples').fill('8');
  await page.locator('#settingsProfileSave').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('elmos-personal-profile-v1')||'{}').defaults?.operator==='Browser test operator');
  await page.reload();
  await page.waitForFunction(()=>window.ELMOS_GUIDED_API?.state()?.chip&&window.ELMOS_GUIDED?.isOpen?.(),{},{timeout:30000});
  await openProfile();
  assert.equal(await page.locator('#settingsProfileOperator').inputValue(),'Browser test operator');
  await page.locator('#settingsArchiveChoose').click();
  await page.waitForFunction(()=>document.querySelector('#settingsArchiveFolder').textContent.includes('Demo test archive'));
  await page.locator('#settingsProfileSave').click();
  await page.waitForFunction(()=>window.__profileTestFiles.has('user-settings.json'));
  const stored=await page.evaluate(()=>JSON.parse(window.__profileTestFiles.get('user-settings.json')));
  assert.equal(stored.defaults.location,'Demo laboratory');
  assert.equal(stored.preferences.verificationSamples,8);
  assert.equal(stored.preferences.verificationCycles,2);
  await page.locator('#settingsOpen').click();
  await page.locator('[data-gw-task="verification"]').click();
  await page.locator('#arPlanner').waitFor({state:'visible'});
  assert.equal(await page.locator('#arVerificationOperator').inputValue(),'Browser test operator');
  assert.equal(await page.locator('#arMode').inputValue(),'pressure');
  assert.equal(await page.locator('#arCycles').inputValue(),'2');
  await page.locator('#archiveClose').click();
  // The demo port automatically sets the reference for each captured point.
  await page.locator('[data-gw-task="calibration"]').click();
  await page.locator('#gwPage1').waitFor({state:'visible',timeout:30000});
  await page.locator('[data-gw-preset="quick"]').first().click();
  await page.locator('#gwNext').click();
  await page.locator('#gwPage2').waitFor({state:'visible'});
  await page.locator('#calDspLimit').fill('25000');
  await page.locator('#calDspLimit').dispatchEvent('change');
  await page.locator('#gwNext').click();
  await page.locator('#gwPage3').waitFor({state:'visible'});
  await page.locator('#gwNext').click();
  await page.locator('#gwPage4').waitFor({state:'visible'});
  await page.locator('#capLo').click();
  await page.waitForFunction(()=>window.ELMOS_GUIDED_API.state().points.length===1,{},{timeout:30000});
  await page.locator('#capHi').click();
  await page.waitForFunction(()=>window.ELMOS_GUIDED_API.state().points.length===2,{},{timeout:30000});
  assert.match(await page.locator('#gwCurrentSetpoint').innerText(),/Druckhub/);
  await page.locator('#gwNext').click();
  await page.locator('#gwPage6').waitFor({state:'visible',timeout:30000});
  const state=await page.evaluate(()=>window.ELMOS_GUIDED_API.state());
  assert.equal(state.calStaged,true);
  assert.equal(state.calVerified,false);
  assert.equal(state.nvmDone,false);
  assert.deepEqual(errors,[]);
  console.log('Chromium profile/reload, mocked folder persistence, demo capture and automatic fit/RAM transition passed.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
