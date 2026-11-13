'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const C=require('../test-logger-core.js');
const ArchiveCore=require('../archive-core.js');
const ArchiveAnalysis=require('../archive-analysis.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('arbitrary positive whole-millisecond sampling intervals and sampling groups',()=>{
 assert.deepEqual(C.settings({intervalMs:1,samplesPerPoint:1,sampleSpacingMs:0,aggregation:'none'}),
  {intervalMs:1,samplesPerPoint:1,sampleSpacingMs:0,aggregation:'none',debug:false});
 assert.deepEqual(C.settings({intervalMs:1457,samplesPerPoint:24,sampleSpacingMs:37,aggregation:'mean',debug:true}),
  {intervalMs:1457,samplesPerPoint:24,sampleSpacingMs:37,aggregation:'mean',debug:true});
 for(const invalid of [
  {intervalMs:0,samplesPerPoint:2,sampleSpacingMs:0,aggregation:'mean'},
  {intervalMs:10.5,samplesPerPoint:2,sampleSpacingMs:0,aggregation:'mean'},
  {intervalMs:100,samplesPerPoint:0,sampleSpacingMs:0,aggregation:'median'},
  {intervalMs:100,samplesPerPoint:101,sampleSpacingMs:0,aggregation:'median'},
  {intervalMs:100,samplesPerPoint:3,sampleSpacingMs:-1,aggregation:'median'},
  {intervalMs:100,samplesPerPoint:3,sampleSpacingMs:0,aggregation:'invented'}
 ])assert.throws(()=>C.settings(invalid));
});
test('mean and median are additional results; every original raw sample remains',()=>{
 const raw=[{at:'t1',adcS:100,adcT:10,dspS:1000,dspT:null},
  {at:'t2',adcS:110,adcT:20,dspS:1010,dspT:345},
  {at:'t3',adcS:300,adcT:30,dspS:null,dspT:345}];
 const backup=JSON.stringify(raw);
 const mean=C.aggregate(raw,'mean');
 assert.equal(mean.channels.adcS,170);
 assert.equal(mean.channels.dspS,1005);
 assert.equal(mean.channels.dspT,345);
 assert.equal(mean.fieldCounts.dspS,2);
 assert.equal(C.aggregate(raw,'median').channels.adcS,110);
 assert.equal(C.aggregate(raw,'none').channels.adcS,null);
 assert.equal(JSON.stringify(raw),backup);
 assert.equal(C.aggregate([{adcS:null},{adcS:null}],'mean').channels.adcS,null);
});
test('USB lag skips schedule slots instead of claiming impossible sample rates',()=>{
 const v=C.scheduleNext(1000,1751,250);
 assert.equal(v.skipped,3);
 assert.equal(v.nextAt,2000);
 assert.equal(v.waitMs,249);
 assert.deepEqual(C.scheduleNext(1000,1010,250),{nextAt:1250,skipped:0,waitMs:240});
});
test('CSV exports each raw sample and an optional aggregate row separately',()=>{
 const p={index:1,scheduledAt:'2026-11-13T12:00:00Z',startedAt:'2026-11-13T12:00:00Z',
  endedAt:'2026-11-13T12:00:01Z',durationMs:1000,lagMs:0,skippedIntervals:0,
  aggregation:'mean',aggregated:C.aggregate([{adcS:10},{adcS:12}],'mean'),
  samples:[{at:'t1',adcS:10},{at:'t2',adcS:12}],supply:{externalVdd:{configuredVdd:5,measuredV:5.01}}};
 const rows=C.csvRows([p]).split('\n');
 assert.equal(rows.length,4);
 assert.ok(rows[1].includes('"aggregate"'));
 assert.ok(rows[2].includes('"raw"'));
 assert.ok(rows[3].includes('"12"'));
 assert.ok(rows[1].includes('"11"'));
 assert.equal(C.csvRows([{...p,aggregation:'none'}]).split('\n').length,3);
});
test('guided workflow exposes the fourth logging choice and protects existing wizard',()=>{
 const guided=read('guided.js'),html=read('index.html'),app=read('app.js'),archive=read('archive.js');
 assert.match(guided,/data-gw-task="testlog"/);
 assert.match(guided,/if\(task==='testlog'\)\{goto\(10\);return\}/);
 assert.match(guided,/ELMOS_TEST_LOGGER\?\.mount/);
 assert.match(guided,/ELMOS_TEST_LOGGER\?\.isBusy/);
 assert.match(html,/test-logger-core\.js\?v=0\.7\.3/);
 assert.match(html,/test-logger\.js\?v=0\.7\.4/);
 assert.match(app,/startTelemetry:archiveStartTelemetry,stopTelemetry:archiveStopTelemetry/);
 assert.match(app,/st\.testLogging&&/);
 assert.match(app,/readOptional\(0x2A\)/);
 assert.match(app,/readOptional\(0x28\)/);
 assert.match(app,/readOptional\(0x26\)/);
 assert.match(app,/readOptional\(0x30\)/);
 assert.match(app,/readOptional\(0x2E\)/);
 assert.match(archive,/appendTelemetry/);
 assert.match(archive,/createWritable\(\{keepExistingData:true\}\)/);
 assert.match(archive,/telemetryFiles/);
 assert.match(read('calibration.js'),/protectStartupCommunication/);
});
test('append-only test log rotates, retains third-party files and exports complete telemetry',async()=>{
 const stored=new Map([['other.json','{"hello":"untouched"}']]);
 const dom=new Map();
 function node(id){
  return {id,style:{},children:[],value:'',hidden:false,disabled:false,checked:false,
   className:'',append(...ns){this.children.push(...ns)},appendChild(n){this.children.push(n)},
   replaceChildren(...ns){this.children=ns},addEventListener(){},click(){},set textContent(v){this._text=v},get textContent(){return this._text}};
 }
 const doc={readyState:'loading',getElementById(id){if(!dom.has(id))dom.set(id,node(id));return dom.get(id)},
  createElement(tag){return node(tag)},addEventListener(){}};
 for(const [k,v] of [['archiveSearch',''],['archiveFilterType','all'],['archiveFilterStatus','all']])doc.getElementById(k).value=v;
 const dir={name:'Local archive',queryPermission:async()=> 'granted',requestPermission:async()=> 'granted',
  async *entries(){for(const [name] of stored)yield [name,{kind:'file',getFile:async()=>({size:Buffer.byteLength(stored.get(name)),text:async()=>stored.get(name)})}]},
  getFileHandle:async name=>({
   getFile:async()=>({size:Buffer.byteLength(stored.get(name)||''),text:async()=>stored.get(name)||''}),
   createWritable:async({keepExistingData=false}={})=>{
    let data=keepExistingData?(stored.get(name)||''):'',cursor=0;
    return {seek:async pos=>{cursor=pos},write:async value=>{
      const raw=String(value);data=data.slice(0,cursor)+raw+data.slice(cursor+raw.length);
      cursor+=raw.length;},
     close:async()=>{stored.set(name,data)},abort:async()=>{}};
   }
  })
 };
 const win={isSecureContext:true,showDirectoryPicker:async()=>dir,indexedDB:null,ELMOS_TEST_LOGGER_CORE:C,
  ELMOS_ARCHIVE_BRIDGE:{
   meta:()=>({online:true,uid:'0123456789AB',software:{version:'0.7.1'},equipment:{adapter:'SSP3'}}),
   initial:async()=>({ram:{words:{'0x1C':2048}},nvm:{words:Array(64).fill(0)}}),
   final:async()=>({ram:{words:{'0x1C':2048}},nvm:{words:Array(64).fill(0)}})
  },
  addEventListener(){},dispatchEvent(){}};
 const sandbox=vm.createContext({document:doc,window:win,ELMOS_ARCHIVE_CORE:ArchiveCore,ELMOS_ARCHIVE_ANALYSIS:ArchiveAnalysis,
  Blob,Date,JSON,Number,Object,Promise,String,Math,RegExp,Array,Map,Set,setTimeout,clearTimeout,
  CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail}}});
 vm.runInContext(read('archive.js'),sandbox);
 const archive=vm.runInContext('ELMOS_ARCHIVE',sandbox);
 const rec=await archive.begin('testlog');
 await archive.event('test_configuration',{name:'Drift Test',intervalMs:33,aggregation:'mean',samplesPerPoint:2,debug:false});
 for(let i=0;i<103;i++){
  const samples=[{at:'t1',adcS:i,dspS:i*2},{at:'t2',adcS:i+2,dspS:i*2+2}];
  await archive.appendTelemetry({kind:'telemetry_point',index:i+1,aggregation:'mean',
   samples,aggregated:C.aggregate(samples,'mean'),durationMs:11,skippedIntervals:i===50?1:0});
 }
 assert.equal(rec.telemetryFiles.length,2);
 assert.equal(rec.telemetry.groups,103);
 assert.equal(rec.telemetry.individualSamples,206);
 assert.equal(rec.telemetry.missedSlots,1);
 const rows=await archive.streamRows(rec);
 assert.equal(rows.length,103);
 assert.equal(rows[0].samples[0].adcS,0);
 assert.equal(rows[102].samples[1].adcS,104);
 const end=await archive.finalise('completed');
 assert.equal(end.status,'completed');
 assert.equal(stored.get('other.json'),'{"hello":"untouched"}');
 assert.ok(ArchiveCore.valid(JSON.parse(stored.get(ArchiveCore.filename(end)))));
 const csv=C.csvRows(rows).split('\n');
 assert.equal(csv.length,1+103*3);
});

test('DUT product name is captured and included in a full CSV export',()=>{
 const ui=read('test-logger.js'),archive=read('archive.js');
 assert.match(ui,/id="tlDutName"/);
 assert.match(ui,/name,dutName,description/);
 assert.match(archive,/dutName:record\.testConfiguration\?\.dutName/);
 const data=C.csvRows([{
  index:1,aggregation:'none',samples:[{at:'2026-11-13T17:00:00Z',adcS:123}]
 }],{name:'Drucktest',dutName:'560/RevB',chipUID:'0020011DBBE7'});
 assert.match(data,/dutName/);
 assert.match(data,/560\/RevB/);
 assert.match(data,/0020011DBBE7/);
});
