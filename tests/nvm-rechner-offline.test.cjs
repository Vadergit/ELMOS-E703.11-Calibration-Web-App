'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('Offline NVM calculator can be opened without the main app or a sensor',()=>{
 const html=read('nvm-rechner.html');
 assert.match(html,/id="nvmReconstruction"/);
 assert.match(html,/nvm-reconstruction\.js\?v=/);
 assert.match(html,/ELMOS_NVM_RECON\.render\(root,null\)/);
 assert.match(html,/Kein Sensor und kein SSP3 nötig/);
 assert.doesNotMatch(html,/<script src="(?:app|expert|guided)\.js/);
 assert.doesNotMatch(html,/navigator\.serial|requestPort|st\.chip|st\.port/);
});
test('Visible entry points lead to the standalone offline calculator',()=>{
 const html=read('index.html'),guided=read('guided.js');
 assert.match(html,/id="nvmCalculatorOpen"/);
 assert.match(html,/href="nvm-rechner\.html"/);
 assert.match(html,/NVM-Rechner · Offline/);
 assert.match(guided,/href="nvm-rechner\.html"/);
 assert.match(guided,/NVM-Rückrechner · Offline/);
});
test('Standalone calculator supports local JSON backup input and no writes',()=>{
 const calculator=read('nvm-reconstruction.js');
 assert.match(calculator,/file\.addEventListener\('change'/);
 assert.match(calculator,/JSON\.parse\(await f\.text\(\)\)/);
 assert.match(calculator,/chooseSource\(state\.live,state\.offline\)/);
 assert.doesNotMatch(calculator,/\b(?:nvmWriteWord|writeReg|ramWrite|serial\.requestPort|exchange)\s*\(/);
});
