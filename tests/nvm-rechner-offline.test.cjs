'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('NVM calculator is an in-app, independent panel, without a sensor gate',()=>{
 const html=read('index.html'),app=read('app.js');
 assert.match(html,/data-panel="10" hidden/);
 assert.match(html,/id="nvmReconstruction"/);
 assert.match(html,/data-step="10"/);
 assert.doesNotMatch(html,/id="nvmCalculatorOpen"/);
 assert.match(html,/<button type="button" class="stepBtn viewer-nav" data-step="10">/);
 assert.match(html,/<button type="button" data-open-nvm class="settings-resource-link">/);
 assert.doesNotMatch(html,/NVM-Rechner · Offline/);
 assert.match(html,/nvm-reconstruction\.js\?v=/);
 assert.match(app,/if\(n===7\|\|n===10\)return ''/);
 assert.match(app,/Math\.min\(10,Number\(n\)\)/);
 assert.match(app,/step\(10\)/);
 assert.match(app,/querySelectorAll\('\[data-open-nvm\]'\)/);
});
test('Guided task opens same panel without chip requirement',()=>{
 const guided=read('guided.js');
 assert.match(guided,/data-gw-task="nvm"/);
 assert.match(guided,/task==='nvm'.*navigate\?\.\(10\)/);
 const nextStart=guided.indexOf('async function next(');
 assert.ok(nextStart>0);
 assert.ok(guided.indexOf("task==='nvm'",nextStart)<guided.indexOf("if(!s.chip)",nextStart));
 assert.doesNotMatch(guided,/href="nvm-rechner\.html"/);
});
test('Legacy link redirects to embedded calculator',()=>{
 const legacy=read('nvm-rechner.html');
 assert.match(legacy,/index\.html#nvm-rechner/);
 assert.doesNotMatch(legacy,/ELMOS_NVM_RECON\.render/);
});
test('Calculator supports local JSON and remains read-only',()=>{
 const calculator=read('nvm-reconstruction.js');
 assert.match(calculator,/file\.addEventListener\('change'/);
 assert.match(calculator,/JSON\.parse\(await f\.text\(\)\)/);
 assert.match(calculator,/chooseSource\(state\.live,state\.offline,state\.preferred\)/);
 assert.doesNotMatch(calculator,/\b(?:nvmWriteWord|writeReg|ramWrite|serial\.requestPort|exchange)\s*\(/);
});

test('NVM calculator visual polish is scoped, responsive and keeps all inputs working',()=>{
 const html=read('index.html'),source=read('nvm-reconstruction.js'),styles=read('nvm-reconstruction.css');
 assert.match(html,/nvm-reconstruction\.css\?v=/);
 assert.match(html,/nvm-reconstruction\.js\?v=[0-9.]+/);
 assert.match(styles,/#nvmReconstruction \.nvmrecon-metrics/);
 assert.match(styles,/@container\(max-width:940px\)/);
 assert.match(styles,/data-panel="10"/);
 assert.match(styles,/var\(--theme-input/);
 assert.match(source,/file\.addEventListener\('change'/);
 assert.match(source,/root\._nvmState\.opts\[key\]=Number\(input\.value\)/);
 assert.match(source,/root\._nvmState\.opts\.tempModel=modelSelect\.value/);
 assert.match(source,/root\.append\(setup,status,result,explain,missing,dialog\)/);
 assert.match(source,/nvmrecon-analog-alert/);
 assert.match(source,/nvmrecon-source-hint/);
 assert.match(source,/nvmrecon-metric-unit/);
 assert.match(source,/Grenzen der Rückrechnung/);
});


test('NVM calculator reads fresh 64-word sensor image with existing UID/CRC verified path',()=>{
 const html=read('index.html'),app=read('app.js'),expert=read('expert.js'),calc=read('nvm-reconstruction.js');
 assert.doesNotMatch(html,/id="nvmCalculatorOpen"/);
 assert.match(html,/Sensorbrücken-Rechner<\/span><\/button>/);
 assert.match(calc,/id='nvmReconReadSensor'/);
 assert.match(calc,/state\.preference|state\.preferred='eeprom'/);
 assert.match(calc,/AKTUELLER SENSOR · NVM/);
 assert.match(calc,/LOKALE DATEI · NICHT LIVE/);
 assert.match(calc,/CRC8 \/ CRC16 geprüft/);
 assert.match(app,/await expert\.readNvm\(\)/);
 assert.match(app,/ELMOS_NVM_RECON\.preferLive\(root\)/);
 assert.match(app,/st\.nvmBackupProof=\{session,uid,words,readAt:new Date\(\)\.toISOString\(\)\}/);
 assert.match(expert,/nvmScan\(\{expertRead:true\}\)/);
 assert.match(expert,/return \{onDetect,identify,readNvm,afterNvmScan/);
 assert.match(expert,/proof\.session===st\.sessionIndex&&proof\.uid===st\.uid\.hex&&proof\.words===st\.nvmBackup/);
 assert.match(calc,/setup\.append\(heading,detail,actions,feedback,grid,origin,profileDetails,advanced\)/);
});
test('File and live sensor can both be present, explicitly selecting sensor overrides file',()=>{
 const calc=require('../nvm-reconstruction.js'),live=Array(64).fill(0),file=Array(64).fill(1);
 assert.equal(calc.chooseSource(live,file).kind,'file');
 assert.equal(calc.chooseSource(live,file,'eeprom').kind,'eeprom');
 assert.equal(calc.chooseSource(null,file,'eeprom').kind,'file');
 assert.equal(calc.chooseSource(live,null,'file').kind,'eeprom');
 assert.equal(calc.chooseSource(null,null,'eeprom').kind,'none');
});

test('DSP target source and temperature model are explicitly distinguished from NVM registers',()=>{
 const app=read('nvm-reconstruction.js'),html=read('index.html');
 assert.match(app,/DSP-Endwert: Standard ±32’000 · nicht im NVM gespeichert/);
 assert.match(app,/DSP-Endwert: aus lokalem UID-\/NVM-gebundenem Kalibrierprofil/);
 assert.match(app,/Temperaturmodell: nicht eindeutig im NVM · AN0203 wird angenommen/);
 assert.match(app,/nvmrecon-reference-hint/);
 assert.match(html,/href="nvm-reconstruction\.css\?v=\d+\.\d+\.\d+"/);
});

test('Sensorbrücken-Rechner is named consistently in navigation, tool and page titles',()=>{
 const html=read('index.html'),app=read('app.js'),guided=read('guided.js');
 const legacy=read('nvm-rechner.html'),formula=read('nvm-formeln.html');
 const lang=read('language-pack.js');
 assert.match(html,/data-step="10"[^>]*><span class="num">▣<\/span><span>Sensorbrücken-Rechner<\/span>/);
 assert.match(html,/data-open-nvm[^>]*><span>Sensorbrücken-Rechner<\/span>/);
 assert.match(html,/<h2>Sensorbrücken-Rechner<\/h2>/);
 assert.match(html,/aria-label="Sensorbrücken-Rechner direkt in der App"/);
 assert.match(html,/data-next="10">Sensorbrücken-Rechner öffnen/);
 assert.match(guided,/data-gw-task="nvm"[^>]*>.*?<strong>Sensorbrücken-Rechner<\/strong>/);
 assert.match(guided,/Für den Sensorbrücken-Rechner und das Archiv/);
 assert.match(legacy,/<title>Sensorbrücken-Rechner/);
 assert.match(formula,/<title>Formeln verstehen · ELMOS E703\.11 Sensorbrücken-Rechner<\/title>/);
 assert.match(app,/document\.title=next===10\?'Sensorbrücken-Rechner · ELMOS E703\.11'/);
 assert.match(lang,/"Sensorbrücken-Rechner": "Sensor Bridge Calculator"/);
 assert.doesNotMatch(html,/NVM-Rückrechner|NVM-Rechner<\/span>/);
 assert.doesNotMatch(guided,/NVM-Rückrechner/);
 assert.match(legacy,/index\.html#nvm-rechner/,'Existing bookmarks continue to work');
});
