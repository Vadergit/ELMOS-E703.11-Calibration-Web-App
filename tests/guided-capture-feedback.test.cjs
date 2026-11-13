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

test('captured point is confirmed in one line, next point becomes active',()=>{
 const h=setup();h.logic.renderCapture();h.logic.observeCapture();
 h.store({kind:'lo',at:'2026-11-13T18:00:00Z',adc_s:1234,adc_t:456});
 h.tick();
 assert.equal(h.logic.getSelected(),1);
 assert.equal(h.$('gwPointConfirmation').hidden,false);
 assert.equal(h.$('gwPointConfirmation').textContent,'✓ Messpunkt 1 aufgenommen');
 assert.match(h.$('gwCurrentSetpoint').textContent,/Als Nächstes: Messpunkt 2 messen/);
 assert.match(h.$('gwCurrentSetpoint').textContent,/10 bar und 25 °C/);
 assert.match(h.$('gwPointNav').children[0].textContent,/Aufgenommen/);
 assert.match(h.$('gwPointNav').children[1].textContent,/Jetzt messen/);
 assert.equal(h.rows[1].classList.current.has('gw-point-active'),true);
});
test('no duplicate captured-results panel or telemetry table is created',()=>{
 const htmlSection=guided.slice(guided.indexOf('id="gwPage4"'),guided.indexOf('id="gwPage5"'));
 assert.doesNotMatch(htmlSection,/gwCapturedSummary|gwCapturedList|gwCapturedCount|Bereits aufgenommen/);
 const h=setup();h.logic.renderCapture();
 assert.equal(h.$('gwPointNav').children.length,2);
 assert.equal(h.$('gwCapturedList').children.length,0);
 assert.doesNotMatch(guided,/className='gw-captured-item'/);
});
test('unsuccessful sample is never marked as completed',()=>{
 const h=setup();h.logic.renderCapture();h.logic.observeCapture();h.tick();
 assert.equal(h.logic.getSelected(),0);
 assert.equal(h.$('gwPointConfirmation').hidden,true);
 assert.match(h.$('gwPointNav').children[0].textContent,/Jetzt messen/);
});
test('manual navigation hides stale capture toast and keeps remeasure option',()=>{
 const h=setup();h.logic.renderCapture();h.logic.observeCapture();
 h.store({kind:'lo',at:'2026-11-13T18:00:00Z'});h.tick();
 h.select(0);
 assert.equal(h.logic.getSelected(),0);
 assert.equal(h.$('gwPointConfirmation').hidden,true);
 assert.match(h.$('gwCurrentSetpoint').textContent,/bereits aufgenommen/);
 assert.match(h.$('gwPointNav').children[0].textContent,/Aufgenommen/);
});
test('final capture shows single completion state, without redundant success line',()=>{
 const h=setup();h.logic.renderCapture();h.logic.observeCapture();
 h.store({kind:'lo',at:'2026-11-13T18:00:00Z'});h.tick();
 h.logic.observeCapture();h.store({kind:'hi',at:'2026-11-13T18:00:02Z'});h.tick();
 assert.equal(h.$('gwPointConfirmation').hidden,true);
 assert.match(h.$('gwCurrentSetpoint').textContent,/Alle Messpunkte aufgenommen/);
 assert.equal(h.$('gwPointNav').children.filter(x=>x.textContent.includes('Aufgenommen')).length,2);
 assert.equal(h.$('gwFooterHint').textContent,'2 / 2 Messpunkte erfolgreich aufgenommen');
});
test('single transition render and unchanged live polls do not rebuild point list',()=>{
 const h=setup();h.logic.renderCapture();h.logic.observeCapture();
 h.store({kind:'lo',at:'2026-11-13T18:00:00Z'});h.tick();
 const count=h.$('gwPointNav').replacements;
 h.logic.renderCapture();h.logic.renderCapture();
 assert.equal(h.$('gwPointNav').replacements,count);
 assert.equal(count,2);
});
test('success is grounded in original records and styled in both themes',()=>{
 assert.match(guided,/record\.at===old/);
 assert.match(guided,/latestCapture=\{index:target\.index,at:record\.at\}/);
 assert.match(guided,/success\.hidden=!confirmed\|\|allDone/);
 assert.match(css,/#guidedWorkspace \.gw-point-confirmation/);
 assert.match(theme,/html\[data-theme="dark"\] #guidedWorkspace \.gw-point-confirmation/);
 assert.match(css,/#guidedWorkspace \.gw-point-nav button\.gw-done/);
});
