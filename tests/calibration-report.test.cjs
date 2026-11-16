'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const REPORT=require('../calibration-report.js');
const GRAPH=require('../calibration-graph.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const capture=(p,adc)=>({kind:'calibration_point',at:'2026-11-16T08:00:00Z',data:{point:{
 pressure:p,unit:'%',temperature:25,adc_s:adc,adc_t:20,sampleCount:6,name:'P'+p
}}});
const verify=(pressure,deviation,tolerance,pass)=>({kind:'verification_attempt',at:'2026-11-16T08:01:00Z',data:{
 pressure,pressureDeviation:deviation,tolerance,pass,dspS:12345,dspTarget:12333
}});
const example=()=>({type:'calibration',id:'calibration-example',chipUID:'0020011DBBE7',
 startedAt:'2026-11-16T08:00:00Z',endedAt:'2026-11-16T08:10:00Z',status:'completed',
 equipment:{adapter:'ESP32-C3 SuperMini',firmware:'0.10'},
 software:{name:'ELMOS E703.11 Calibration Assistant',version:'0.7.83'},
 events:[capture(0,-15000),capture(100,17000),verify(50,1.2,.2,false),
  verify(25,-.03,.2,true),
  {kind:'coefficient_fit',data:{solution:{orderS:1,orderT:0,outputLimit:25000}}},
  {kind:'nvm_before',data:{changes:12}},
  {kind:'nvm_after',data:{verified:true}},
  {kind:'error',at:'2026-11-16T08:02:00Z',data:{stage:'dsp_verification',message:'Outside tolerance'}}
 ]});
test('Calibration PDF contains all real calibration and DSP checks, status, graph, NVM information',()=>{
 const record=example(),previous=JSON.stringify(record);
 const markup=REPORT.makeReport(record,{graphMarkup:'<div class="cg-panel"><svg viewBox="0 0 850 340"><circle class="cg-marker fail"/></svg></div>'});
 assert.match(markup,/Kalibrierung – Prüfprotokoll/);
 assert.match(markup,/0020011DBBE7/);
 assert.match(markup,/ESP32-C3 SuperMini/);
 assert.match(markup,/2<\/strong><small>Kalibrierpunkte/);
 assert.match(markup,/Ausser Toleranz/);
 assert.match(markup,/NVM geschrieben und verifiziert/);
 assert.match(markup,/Unabhängige DSP-Prüfpunkte/);
 assert.match(markup,/1\.2/);
 assert.match(markup,/0\.2/);
 assert.match(markup,/<svg viewBox="0 0 850 340">/);
 assert.match(markup,/Outside tolerance/);
 assert.match(markup,/@page\{size:A4/);
 assert.match(markup,/window\.print\(\)/);
 assert.equal(JSON.stringify(record),previous,'PDF must not mutate archived values');
});
test('PDF uses the same graphical module as the calibration archive, not an independent calculation',()=>{
 const previousDoc=global.document,previousWindow=global.window;
 let received=null;
 global.document={
  documentElement:{lang:'de-CH'},
  createElement:()=>({innerHTML:''})
 };
 global.window={ELMOS_CALIBRATION_GRAPH:{
  summary:GRAPH.summary,
  renderArchive:(host,record)=>{
   received=record;
   host.innerHTML='<div id="charts"><svg id="deviation"/><svg id="comparison"/></div>';
  }
 }};
 const record=example();
 try{
  const markup=REPORT.makeReport(record);
  assert.equal(received,record);
  assert.match(markup,/<svg id="deviation"\/>/);
  assert.match(markup,/<svg id="comparison"\/>/);
 }finally{global.document=previousDoc;global.window=previousWindow}
});
test('Calibration only old record still exports a report with missing-verification notice',()=>{
 const record={...example(),events:[capture(0,-15000),capture(100,17000)],status:'incomplete'};
 const html=REPORT.makeReport(record,{graphMarkup:'<p>Nur Kalibrierpunkte gespeichert.</p>'});
 assert.match(html,/Nur Kalibrierpunkte gespeichert/);
 assert.match(html,/Keine unabhängigen DSP-Prüfungen gespeichert/);
 assert.match(html,/Unvollständig/);
 assert.doesNotMatch(html,/NVM geschrieben und verifiziert/);
});
test('No unsafe archive labels get interpreted as HTML in the PDF',()=>{
 const record=example();
 record.equipment.adapter='<img src=x onerror=alert(1)>';
 record.events[0].data.point.name='<script>alert(1)</script>';
 const html=REPORT.makeReport(record,{graphMarkup:''});
 assert.doesNotMatch(html,/<img src=x/);
 assert.doesNotMatch(html,/<script>alert/);
 assert.match(html,/&lt;img src=x/);
 assert.match(html,/&lt;script&gt;alert/);
});
test('Pop-up PDF export is synchronous and limited to calibration records',()=>{
 const previousWindow=global.window,previousDocument=global.document;
 const calls=[],popup={document:{open(){calls.push('open')},write(html){calls.push('write:'+html.length)},close(){calls.push('close')}},focus(){calls.push('focus')},close(){calls.push('popup-close')}};
 global.document={documentElement:{lang:'de-CH'}};
 global.window={open:()=>popup};
 try{
  assert.equal(REPORT.print({...example(),type:'verification'}),false);
  assert.equal(calls.length,0);
  assert.equal(REPORT.print(example()),true);
  assert.deepEqual(calls.map(x=>x.split(':')[0]),['open','write','close','focus']);
 }finally{global.window=previousWindow;global.document=previousDocument}
});
test('Archive buttons, print styles and versioned scripts are integrated',()=>{
 const archive=read('archive.js'),html=read('index.html');
 assert.match(archive,/record\.type==='calibration'\)\{\s*const pdf=el\('button','PDF'/);
 assert.match(archive,/function exportCalibrationPdf\(record\)/);
 assert.match(archive,/ELMOS_CALIBRATION_REPORT\.print\(record\)/);
 assert.match(html,/calibration-report\.js\?v=0\.7\.88/);
 assert.match(html,/archive\.js\?v=0\.7\.87/);
 assert.match(html,/data-app-version="0\.7\.92"/);
});
