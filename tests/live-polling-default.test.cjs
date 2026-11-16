'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
test('new users default to adaptive 250 ms when module is available',()=>{
 assert.match(app,/liveIntervalMs=250;/);
 assert.match(app,/if\(!livePacing\)liveIntervalMs=400;/);
 const options=html.match(/<select id="settingsLiveInterval">([\s\S]*?)<\/select>/)?.[1]||'';
 assert.match(options,/<option value="250" selected>250 ms · Standard \(adaptiv\)<\/option>/);
 assert.equal((options.match(/\sselected(?:>|\s)/g)||[]).length,1);
 assert.doesNotMatch(options,/<option value="650" selected>/);
});
test('saved user-selected values override default; missing and invalid values do not',()=>{
 const begin=app.indexOf("const intervalStored=Number(lsGet('elmos-live-interval-v1'));");
 const end=app.indexOf("$('settingsLiveInterval').addEventListener('change'",begin);
 assert.ok(begin>0&&end>begin);
 const read=new Function('stored','pacing','initial',
  "let liveIntervalMs=initial;const livePacing=pacing;const lsGet=()=>stored;const $=()=>({set value(v){}});"+
  app.slice(begin,end)+'return liveIntervalMs;');
 assert.equal(read(null,{},250),250);
 assert.equal(read('',{},250),250);
 assert.equal(read('999',{},250),250);
 for(const saved of [250,400,650,1000,1500,2000])
  assert.equal(read(String(saved),{},250),saved);
 assert.equal(read('250',null,400),400);
});
test('existing adaptive fallback and serial guard are unchanged',()=>{
 assert.match(app,/liveIntervalMs===250\?\(livePacing\?\.delay\(250\)\?\?400\):liveIntervalMs/);
 assert.match(app,/st\.consecutiveErrors\?2000:/);
 assert.match(app,/await p;st\.liveReadSuccesses\+\+/);
});
