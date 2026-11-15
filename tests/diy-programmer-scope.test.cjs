'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('DIY connection option lists only ESP32-C3 SuperMini and Pro Micro, with SSP3 separate',()=>{
 const html=read('index.html');
 const choices=html.match(/<select id="adapterType">([\s\S]*?)<\/select>/)?.[1]||'';
 assert.match(choices,/value="ssp3"/);
 assert.match(choices,/value="bridge">DIY: ESP32-C3 SuperMini \/ Arduino Pro Micro/);
 assert.equal((choices.match(/<option /g)||[]).length,2);
 assert.doesNotMatch(choices,/(?:XIAO|RP2040|ESP8266|ESP32-S3|STM32|UNO|Nano)/);
});

test('installer contains exactly two firmware sections and actual release files',()=>{
 const installer=read('firmware-update.html');
 const boards=[...installer.matchAll(/<section class="board" aria-labelledby="([^"]+)"/g)].map(x=>x[1]);
 assert.deepEqual(boards,['esp32','pro-micro']);
 assert.match(installer,/esp32-c3\/v0\.10\/manifest\.json/);
 assert.match(installer,/pro-micro\/v0\.27\/pro-micro-16mhz\.hex/);
 assert.match(installer,/pro-micro\/v0\.27\/pro-micro-8mhz\.hex/);
});

test('firmware capability signatures identify exactly the two allowed DIY boards',()=>{
 const app=read('app.js');
 const esp=read('firmware/esp32c3_supermini/esp32c3_supermini.ino');
 const pro=read('firmware/pro_micro/pro_micro.ino');
 assert.match(esp,/PLC_GPIO4_IO/);
 assert.match(esp,/POWER_GPIO_10/);
 assert.match(pro,/PLC_D4_IO/);
 assert.match(pro,/PRO_MICRO_NVM/);
 assert.match(app,/const isProMicro=caps\.includes\('PLC_D4_IO'\)\&\&caps\.includes\('PRO_MICRO_NVM'\)/);
 assert.match(app,/const isEsp32C3=caps\.includes\('PLC_GPIO4_IO'\)\&\&caps\.includes\('POWER_GPIO_10'\)/);
 assert.match(app,/if\(isProMicro===isEsp32C3\)/);
 assert.match(app,/st\.bridgeBoard=isProMicro\?'Arduino Pro Micro':'ESP32-C3 SuperMini'/);
});

test('both public DIY guides contain only the two supported board families',()=>{
 for(const p of ['docs/ESP_BOARD_OPTIONS.md','docs/USB_BRIDGE_GUIDE.md']){
  const doc=read(p);
  assert.match(doc,/ESP32-C3 SuperMini/);
  assert.match(doc,/Pro Micro/);
  assert.doesNotMatch(doc,/(?:ESP8266|RP2040|Pico 2|XIAO|STM32|Teensy|Arduino UNO|Nano 33|ESP32-S3)/);
 }
});
