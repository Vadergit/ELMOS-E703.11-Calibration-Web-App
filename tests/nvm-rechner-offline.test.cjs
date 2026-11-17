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
 assert.match(html,/id="nvmCalculatorOpen" data-open-nvm/);
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
 assert.match(calculator,/chooseSource\(state\.live,state\.offline\)/);
 assert.doesNotMatch(calculator,/\b(?:nvmWriteWord|writeReg|ramWrite|serial\.requestPort|exchange)\s*\(/);
});
