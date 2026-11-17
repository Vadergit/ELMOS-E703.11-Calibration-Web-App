'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const esp=source('firmware/esp32c3_supermini/esp32c3_supermini.ino');
const avr=source('firmware/pro_micro/pro_micro.ino');
const app=source('app.js'),alarm=source('alarm-editor.js');
for(const [board,fw] of [['ESP32-C3',esp],['Pro Micro',avr]]){
 test(board+' reports the same protocol-level capabilities',()=>{
  assert.match(fw,/BRIDGE_GENERIC_RAM_V1,BRIDGE_USER_NVM_V1/);
  assert.match(fw,/NVM ARM HOST/);
  assert.match(fw,/# NVM HOST ARMED/);
  assert.match(fw,/NVM_COLD_START_REQUIRED/);
  assert.match(fw,/NVM DISARM/);
 });
 test(board+' requires cold-start and chip probe before generic User-NVM',()=>{
  assert.match(fw,/if \(!coldStartVerified \|\| probe\(activeSlave\)\)/);
  assert.match(fw,/nvmHostMode = true/);
  assert.match(fw,/20[0]+(?:u|UL)/i);
  assert.match(fw,/180000(?:u|UL)/i);
  assert.match(fw,/nvmSessionActive\(\)/);
 });
 test(board+' allows generic RAM words but protects NVM command/data and factory area',()=>{
  assert.match(fw,/nvmIndex >= 16 && nvmIndex <= 63|index >= 16 && index <= 63/);
  assert.match(fw,/address == 0x4A|reg == 0x4A/);
  assert.match(fw,/address == 0x4E|reg == 0x4E/);
  assert.match(fw,/readNvm|0x4C00/);
  assert.match(fw,/0xA300/);
  assert.match(fw,/return true; \/\/ Any other aligned 16-bit RAM register|Any aligned RAM word/);
 });
}
test('webapp grants generic NVM only to boards advertising both capabilities',()=>{
 assert.match(app,/st\.bridgeGenericRam=caps\.includes\('BRIDGE_GENERIC_RAM_V1'\)/);
 assert.match(app,/st\.bridgeUserNvm=st\.bridgeGenericRam&&caps\.includes\('BRIDGE_USER_NVM_V1'\)/);
 assert.match(app,/st\.bridgeUserNvm\?'NVM ARM HOST'/);
 assert.match(app,/const armReply=await exchange\(armCommand\)/);
 assert.match(app,/NVM-Freigabe durch die USB-Bridge nicht bestätigt/);
});
test('webapp keeps chip identity, boot protection, backup and full post-write CRC check',()=>{
 for(const term of [
  "st.uid.ser0!==st.nvmBackup[0]",'CAL.protectStartupCommunication(initial,modified',
  'const verifyWords=(st.psscRamRecovery||alarmOnly||st.bridgeUserNvm)?Array.from({length:64}',
  "if(!$('nvmAutoBackup').checked)",'NVM wird rückgelesen','CAL.crc16(after)!==after[63]',
  "if(c.index<16||c.index>63)",'await exchange(\'NVM DISARM\')'
 ])assert.ok(app.includes(term),term);
});
test('DIY boards can follow alarm and combined calibration NVM path without SSP3-only block',()=>{
 assert.match(app,/st\.adapterKind==='ssp3'\|\|\(st\.adapterKind==='bridge'&&st\.bridgeGenericRam\)/);
 assert.match(app,/st\.adapterKind==='ssp3'\|\|st\.bridgeUserNvm/);
 assert.match(alarm,/st\.adapterKind==='ssp3'\|\|\(st\.adapterKind==='bridge'&&st\.bridgeGenericRam&&st\.bridgeUserNvm\)/);
 assert.match(app,/alarmIntegrated=!restoring&&!alarmOnly&&!outputOnly/);
});
test('release workflow compiles ESP32-C3 and both Pro Micro frequencies and publishes only on main',()=>{
 const yml=source('.github/workflows/esp32-c3-release.yml');
 for(const needle of ['firmware/esp32c3_supermini','firmware/pro_micro','arduino-cli compile',
  '16MHzatmega32U4','8MHzatmega32U4','github.ref == \'refs/heads/main\'',
  'firmware/releases/esp32-c3/v0.12','firmware/releases/pro-micro/v0.28']){
  assert.ok(yml.includes(needle),needle);
 }
});
