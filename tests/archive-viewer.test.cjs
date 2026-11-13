'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const A=require('../archive-analysis.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

function record(type='testlog',id='log-00001'){
 return {format:'elmos-e70311-record',schemaVersion:1,id,type,status:'completed',
  chipUID:'0A1122334455',customUID:'0x0102',
  startedAt:'2026-11-13T12:00:00.000Z',endedAt:'2026-11-13T12:02:00.000Z',
  equipment:{adapter:'ELMOS SSP3',firmware:'2.1'},
  software:{version:'0.7.3'},testConfiguration:{name:'Prüfdruck 10 bar',description:'Drift bei 40 °C',
   intervalMs:1000,samplesPerPoint:2,aggregation:'mean',durationMs:120000},
  telemetry:{groups:2,individualSamples:4,missedSlots:1,readErrors:0},
  initial:{nvm:{words:Array(64).fill(0)},configuredUserId:'0x0102'},events:[
   {kind:'started',at:'2026-11-13T12:00:00Z',data:{}},
   {kind:'marker',at:'2026-11-13T12:00:10Z',data:{message:'Druck 10 bar'}}]};
}
const row=(index,values)=>({kind:'telemetry_point',index,startedAt:'2026-11-13T12:00:00Z',
 endedAt:'2026-11-13T12:00:01Z',aggregation:'mean',
 samples:values.map(v=>({adcS:v,dspS:v*2,adcT:100+dspSFor(v)})),
 aggregated:{channels:{dspS:values.reduce((a,b)=>a+b*2,0)/values.length}}});
function dspSFor(x){return x}

test('summaries calculate actual min/max/mean/deviation using individual raw samples',()=>{
 const r=record();
 const info=A.overview(r,[row(1,[1,3]),row(2,[5,7])]);
 assert.equal(info.title,'Prüfdruck 10 bar');
 assert.equal(info.description,'Drift bei 40 °C');
 assert.equal(info.rawSamples,4);
 assert.equal(info.measurementPoints,2);
 assert.equal(info.metrics.adcS.mean,4);
 assert.equal(info.metrics.adcS.min,1);
 assert.equal(info.metrics.adcS.max,7);
 assert.equal(info.metrics.dspS.mean,8);
 assert.equal(info.durationMs,120000);
 assert.equal(info.missedSlots,1);
 assert.equal(info.trend.length,2);
});
test('missing channels are unavailable, not zero, and invalid values are ignored',()=>{
 const stat=A.stats([{adcS:null},{adcS:undefined},{adcS:0},{adcS:4},{adcS:NaN},{adcS:'7'}],'adcS');
 assert.equal(stat.count,2);
 assert.equal(stat.mean,2);
 assert.equal(stat.min,0);
 assert.equal(stat.max,4);
 assert.equal(A.stats([{}],'dspT').mean,null);
});
test('trend sampling does not exceed display budget and preserves endpoints',()=>{
 const rows=Array.from({length:550},(_,i)=>row(i,[i,i+1]));
 const points=A.trend(rows,'dspS',140);
 assert.equal(points.length,140);
 assert.equal(points[0].index,0);
 assert.equal(points.at(-1).index,549);
});
test('two-file comparison shows differences on actual samples and NVM words',()=>{
 const a=record(),b=record('testlog','log-00002');
 b.initial.nvm.words[30]=25;
 const cmp=A.compare(a,b,[row(1,[10,20])],[row(1,[30,40])]);
 assert.equal(cmp.identicalUID,true);
 assert.equal(cmp.metrics.find(x=>x.key==='adcS').delta,20);
 assert.deepEqual(cmp.nvmChanges,[{index:30,before:0,after:25}]);
 b.chipUID='different';assert.equal(A.compare(a,b).identicalUID,false);
 b.initial.nvm.words=null;assert.equal(A.compare(a,b).nvmChanges,null);
});
test('the two views and visual comparison remain separate from physical measurement changes',()=>{
 const archive=read('archive.js'),html=read('index.html'),guided=read('guided.js');
 assert.match(html,/archive-analysis\.js\?v=0\.7\.4/);
 assert.match(archive,/id="archiveOverview"/);
 assert.match(archive,/ar-compare-cols/);
 assert.match(archive,/async function renderDetails/);
 assert.match(archive,/async function compare/);
 assert.match(archive,/ANALYSIS\.compare\(a,b,ar,br\)/);
 assert.match(html,/data-app-version="0\.7\.13"/);
 assert.match(guided,/data-gw-task="testlog"/);
 assert.match(guided,/await next\(\)/);
 assert.match(guided,/if\(taskOpening\)return/);
 assert.match(guided,/if\(task==='inspect'\)/);
});

test('DUT name is visible and legacy SSP3 firmware is never labelled as sensor firmware',()=>{
 const r=record();
 r.testConfiguration.dutName='Huba 560 · Versuchsaufbau 2';
 r.equipment.firmware='02.08.02.04';
 r.initial.ram={words:{'0x38':0x0020}};
 const a=A.overview(r);
 assert.equal(a.dutName,'Huba 560 · Versuchsaufbau 2');
 assert.equal(a.adapterFirmware,'02.08.02.04');
 assert.equal(a.chipVersionRegister,'0x0020');
 assert.equal(a.firmware,undefined);
 const old=record();
 old.initial.ram={words:{}};
 assert.equal(A.overview(old).chipVersionRegister,null);
 assert.equal(A.overview(old).dutName,null);
 const archive=read('archive.js'),html=read('index.html');
 assert.match(archive,/Produkt \/ DUT/);
 assert.match(archive,/Adapter-Firmware/);
 assert.match(archive,/id="archiveMeasuredVdd"/);
 assert.match(html,/\.ar-data-grid\{grid-template-columns:repeat\(4/);
});
