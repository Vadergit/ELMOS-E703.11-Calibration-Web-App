'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const guided=read('guided.js'),app=read('app.js'),css=read('guided.css'),theme=read('theme.css');

function element(id=''){
 const item={
  id,children:[],attributes:{},events:{},className:'',hidden:false,replacements:0,_text:'',
  set textContent(v){this._text=String(v);this.children=[]},
  get textContent(){return this._text+this.children.map(c=>c.textContent??'').join('')},
  replaceChildren(...a){this._text='';this.children=a;this.replacements++},
  append(...a){this.children.push(...a)},
  appendChild(a){this.children.push(a)},
  setAttribute(k,v){this.attributes[k]=v},
  addEventListener(k,fn){this.events[k]=fn},
  classList:{current:new Set(),toggle(k,yes){if(yes)this.current.add(k);else this.current.delete(k)}}
 };
 return item;
}
function setup(){
 const ids=new Map();
 const $=id=>{if(!ids.has(id))ids.set(id,element(id));return ids.get(id)};
 const points=[{index:0,slot:'lo',pressure:0,temperature:25},
  {index:1,slot:'hi',pressure:10,temperature:25}];
 const plan={total:2,unit:'bar',points};
 const records=[];
 const rows=points.map(()=>element('original-cal-row'));
 let interval=null;
 const window={setInterval:fn=>{interval=fn;return 1},clearInterval:()=>{interval=null}};
 const document={createElement:tag=>element(tag)};
 const state=()=>({points:records});
 const pointRecord=point=>records.find(p=>point.slot==='lo'?p.kind==='lo':p.kind==='hi');
 const pointRow=point=>rows[point.index];
 const setText=(id,value)=>{$(id).textContent=value};
 const messages=[];
 const start=guided.indexOf(' function renderCapture(){');
 const end=guided.indexOf(' function statusText(){',start);
 assert.ok(start>0&&end>start);
 const source='let stage=4,mode=true,selectedPoint=0,latestCapture=null,'+
  'lastCaptureRenderKey=null,pendingCapture=null,signature="test-plan";'+
  guided.slice(start,end)+
  ';return {renderCapture,observeCapture,getSelected:()=>selectedPoint};';
 const fn=new Function('$','document','window','plan','state','pointRecord','pointRow','setText','msg',source);
 const logic=fn($,document,window,plan,state,pointRecord,pointRow,setText,
  (message,kind)=>messages.push({message,kind}));
 return {logic,$,rows,messages,records,
  store:r=>records.push(r),
  tick:()=>interval?.(),
  select:i=>$('gwPointNav').children[i].events.click()};
}
test('first captured point stays visible with ADC values while second point becomes active',()=>{
 const h=setup();h.logic.renderCapture();
 assert.equal(h.$('gwCapturedSummary').hidden,true);
 h.logic.observeCapture();
 h.store({kind:'lo',at:'2026-11-13T18:00:00.000Z',
  pressure:0.2,temperature:26,adc_s:1234,adc_t:456,sampleCount:5});
 h.tick();
 assert.equal(h.logic.getSelected(),1);
 assert.equal(h.$('gwPointConfirmation').hidden,false);
 assert.match(h.$('gwPointConfirmation').textContent,/Messpunkt 1 erfolgreich übernommen/);
 assert.match(h.$('gwPointConfirmation').textContent,/Als Nächstes folgt Messpunkt 2/);
 assert.equal(h.$('gwCapturedSummary').hidden,false);
 assert.match(h.$('gwCapturedList').textContent,/✓ Messpunkt 1 aufgenommen/);
 assert.match(h.$('gwCapturedList').textContent,/0.2 bar · 26 °C/);
 assert.match(h.$('gwCapturedList').textContent,/ADC_S.*234 Digits/);
 assert.match(h.$('gwCapturedList').textContent,/ADC_T 456 Digits/);
 assert.match(h.$('gwCapturedList').textContent,/5 Einzelmessungen/);
 assert.match(h.$('gwCurrentSetpoint').textContent,/Als Nächstes: Messpunkt 2 messen/);
 assert.match(h.$('gwCurrentSetpoint').textContent,/10 bar und 25 °C/);
 assert.match(h.$('gwPointNav').children[0].textContent,/Aufgenommen/);
 assert.match(h.$('gwPointNav').children[1].textContent,/Jetzt messen/);
 assert.equal(h.rows[0].classList.current.has('gw-point-active'),false);
 assert.equal(h.rows[1].classList.current.has('gw-point-active'),true);
});
test('failed or pending reads never get a success confirmation',()=>{
 const h=setup();h.logic.renderCapture();h.logic.observeCapture();h.tick();
 assert.equal(h.logic.getSelected(),0);
 assert.equal(h.$('gwPointConfirmation').hidden,true);
 assert.equal(h.$('gwCapturedSummary').hidden,true);
});
test('returning to first point preserves captured summary and allows remeasurement',()=>{
 const h=setup();h.logic.renderCapture();h.logic.observeCapture();
 h.store({kind:'lo',at:'2026-11-13T18:00:00Z',adc_s:51,adc_t:22});
 h.tick();
 h.select(0);
 assert.equal(h.logic.getSelected(),0);
 assert.equal(h.$('gwCapturedSummary').hidden,false);
 assert.match(h.$('gwCurrentSetpoint').textContent,/bereits aufgenommen/);
 assert.match(h.$('gwCapturedList').textContent,/Messpunkt 1 aufgenommen/);
});
test('completion and next target render together without redundant live refresh rebuilds',()=>{
 const h=setup();h.logic.renderCapture();h.logic.observeCapture();
 h.store({kind:'lo',at:'2026-11-13T18:00:00Z',adc_s:51});
 h.tick();
 const rebuilds=h.$('gwPointNav').replacements;
 h.logic.renderCapture();h.logic.renderCapture();
 assert.equal(h.$('gwPointNav').replacements,rebuilds);
 assert.equal(rebuilds,2);
});
test('completion of all points remains prominently visible',()=>{
 const h=setup();h.logic.renderCapture();h.logic.observeCapture();
 h.store({kind:'lo',at:'2026-11-13T18:00:00Z',adc_s:51});h.tick();
 h.logic.observeCapture();
 h.store({kind:'hi',at:'2026-11-13T18:00:02Z',adc_s:105});
 h.tick();
 assert.match(h.$('gwPointConfirmation').textContent,/Alle 2 Messpunkte sind gespeichert/);
 assert.match(h.$('gwCurrentSetpoint').textContent,/Alle Messpunkte aufgenommen/);
 assert.equal(h.$('gwCapturedList').children.length,2);
 assert.equal(h.$('gwCapturedCount').textContent,'2 / 2');
});
test('guided read-only interface uses actual captured values, not synthetic placeholders',()=>{
 assert.match(app,/adc_s:x\.adc_s,adc_t:x\.adc_t,adc_tc:x\.adc_tc,sampleCount:x\.sampleCount/);
 assert.match(guided,/if\(Number\.isFinite\(record\.adc_s\)\)/);
 assert.match(guided,/if\(Number\.isFinite\(record\.adc_t\)\)/);
 assert.match(guided,/record\.at===old/);
 assert.match(guided,/latestCapture=\{index:target\.index,at:record\.at\}/);
});
test('completed, next-step and success styles have dark mode variants',()=>{
 for(const part of ['.gw-point-confirmation','.gw-captured-summary',
  '.gw-captured-item','.gw-next-point','.gw-point-nav-state'])
  assert.ok(css.includes(part),'Missing style '+part);
 for(const part of ['.gw-point-confirmation','.gw-captured-item','.gw-next-point',
  '.gw-point-nav button.gw-done'])
  assert.ok(theme.includes(part),'Missing dark-theme style '+part);
});
