'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const GRAPH=require('../calibration-graph.js');
const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const capture=(pressure,unit='%')=>({kind:'calibration_point',data:{point:{
 pressure,unit,adc_s:pressure*100,temperature:25}}});
const check=(pressure,deviation,tolerance,pass,slot=0)=>({
 at:'2026-11-16T07:10:00Z',kind:'verification_attempt',data:{
  pressure,pressureDeviation:deviation,tolerance,pass,slot,temperature:25,
  dspS:1600,dspTarget:1400
 }});
const example=()=>({type:'calibration',events:[
 capture(0),capture(100),check(50,1.2,.2,false,0),
 check(0,.02,.2,true,1),check(50,.03,.2,true,0)]});

function dom(){
 class FakeNode {
  constructor(tag){this.tag=tag;this.children=[];this.textContent='';this.attrs={};}
  setAttribute(key,value){this.attrs[key]=String(value);}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
  get className(){return this.attrs.class||this._className||''}
  set className(x){this._className=x}
 }
 const doc={
  documentElement:{lang:'de-CH'},
  createElement:tag=>new FakeNode(tag),
  createElementNS:(_,tag)=>new FakeNode(tag)
 };
 const flattened=root=>[root,...root.children.flatMap(flattened)];
 return {document:doc,FakeNode,flattened};
}
test('Reads every independent calibration verification attempt, including failures and repeats',()=>{
 const s=GRAPH.summary(example());
 assert.equal(s.unit,'%');
 assert.equal(s.span,100);
 assert.equal(s.checks.length,3);
 assert.equal(s.passed,2);
 assert.equal(s.failed,1);
 assert.equal(s.measured,3);
 assert.equal(s.checks[0].reference,50);
 assert.equal(s.checks[0].measured,51.2);
 assert.equal(s.checks[0].deviationPercent,1.2);
 assert.equal(s.checks[0].tolerancePercent,.2);
 assert.equal(s.checks[0].status,'fail');
 assert.equal(s.checks[2].status,'pass');
 assert.equal(s.checks[0].dspTarget,1400);
});
test('Physical units are retained; reference + deviation is the recorded actual result',()=>{
 const record={type:'calibration',events:[
  capture(0,'bar'),capture(10,'bar'),check(8,-.1,.2,true)]};
 const s=GRAPH.summary(record);
 assert.equal(s.unit,'bar');
 assert.equal(s.span,10);
 assert.equal(s.checks[0].measured,7.9);
 assert.equal(s.checks[0].deviationPercent,-1);
 assert.equal(s.checks[0].tolerancePercent,2);
});
test('Unknown span/tolerance remain unknown; no invented percentage or pass status',()=>{
 const r={type:'calibration',events:[
  capture(0,'bar'),check(8,-.1,null,null)]};
 const s=GRAPH.summary(r);
 assert.equal(s.span,null);
 assert.equal(s.checks[0].deviationPercent,null);
 assert.equal(s.checks[0].tolerance,null);
 assert.equal(s.checks[0].tolerancePercent,null);
 assert.equal(s.checks[0].status,'unrated');
});
test('Read-only archive renders two plots, saved tolerance intervals and plot labels',()=>{
 const {document,FakeNode,flattened}=dom();
 const previous=global.document;global.document=document;
 try{
  const host=new FakeNode('div'),record=example();
  const frozen=JSON.stringify(record);
  const res=GRAPH.renderArchive(host,record);
  assert.equal(res.checks.length,3);
  assert.equal(JSON.stringify(record),frozen,'render must not mutate record');
  const all=flattened(host);
  const svgs=all.filter(x=>x.tag==='svg');
  assert.equal(svgs.length,2);
  assert.ok(all.some(x=>x.textContent==='Abweichungen und Toleranz'));
  assert.ok(all.some(x=>x.textContent==='Soll-/Ist-Druck mit Toleranz'));
  assert.ok(all.some(x=>x.attrs.class==='cg-tolerance'));
  assert.equal(all.filter(x=>x.tag==='circle').length,6);
  assert.ok(all.some(x=>x.tag==='circle'&&x.attrs.class.includes('fail')));
 }finally{global.document=previous}
});
test('Calibration-only old archive shows raw ADC points and explicitly no tolerance judgement',()=>{
 const {document,FakeNode,flattened}=dom(),previous=global.document;
 global.document=document;
 try{
  const host=new FakeNode('div');
  const rec={type:'calibration',events:[capture(0),capture(100)]};
  const s=GRAPH.renderArchive(host,rec);
  const all=flattened(host);
  assert.equal(s.checks.length,0);
  assert.equal(all.filter(x=>x.tag==='svg').length,1);
  assert.ok(all.some(x=>x.textContent.includes('Nur Kalibrierpunkte gespeichert')));
  assert.ok(all.some(x=>x.textContent==='Kalibrierpunkte · ADC_S'));
 }finally{global.document=previous}
});
test('Archives without calibration and independent verification samples show a helpful notice',()=>{
 const {document,FakeNode,flattened}=dom(),previous=global.document;
 global.document=document;
 try{
  const host=new FakeNode('div');
  GRAPH.renderArchive(host,{type:'calibration',events:[{kind:'started',data:{}}]});
  assert.equal(flattened(host).filter(x=>x.tag==='svg').length,0);
  assert.ok(flattened(host).some(x=>x.textContent.includes('Keine unabhängigen DSP-Prüfpunkte')));
 }finally{global.document=previous}
});
test('Archive and site load the new graph and versioned assets',()=>{
 const archive=source('archive.js'),html=source('index.html'),css=source('calibration-graph.css');
 assert.match(archive,/if\(r\.type==='calibration'\)\{\s*const historicalChart/);
 assert.match(archive,/ELMOS_CALIBRATION_GRAPH\.renderArchive\(historicalChart,r\)/);
 assert.match(html,/calibration-graph\.js\?v=0\.7\.83/);
 assert.match(html,/calibration-graph\.css\?v=0\.7\.83/);
 assert.match(html,/data-app-version="0\.7\.92"/);
 assert.match(css,/\.cg-marker\.fail/);
});
