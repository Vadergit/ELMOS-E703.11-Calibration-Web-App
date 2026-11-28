'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const guide=read('guided.js'),app=read('app.js'),html=read('index.html'),css=read('guided.css');
const code=guide.slice(guide.indexOf(' let calculatorOrigin=null'),guide.indexOf(' function goto(n){'));
function harness(stage,connectionOpen=false){
 const original={replaceChild(n,o){assert.equal(o.parentNode,this);o.parentNode=null;n.parentNode=this;this.child=n;}};
 const host={appendChild(n){n.parentNode=this;this.child=n;}};
 const node={parentNode:original};original.child=node;const workspace={hidden:true},back={textContent:'',focus(){}};
 const classes=new Set(['guided-active']);const calls={refresh:0,update:0,redraw:0,scroll:[]};
 const els={guidedNvmWorkspace:workspace,nvmReconstruction:node,guidedNvmHost:host,guidedNvmBack:back};
 const document={title:'Original',createComment:()=>({}),documentElement:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}}};
 const window={scrollY:77,scrollTo:o=>calls.scroll.push(o.top),ELMOS_GUIDED_API:{refreshNvmCalculator:()=>calls.refresh++}};
 const F=new Function('$','document','window','location','history','mode','nextSensorPending','stage','connectionOpen','msg','updateUI','apiRedraw',code+'return {openNvmCalculator,closeNvmCalculator};')(id=>els[id],document,window,{hash:''},{},true,null,stage,connectionOpen,()=>{},()=>calls.update++,()=>calls.redraw++);
 return {F,node,original,host,workspace,back,classes,calls,document};
}
let n=0;const eq=(a,b)=>{assert.equal(a,b);n++};
for(const [stage,connection,backText] of [[0,false,'← Zurück zur Aufgabenauswahl'],[3,false,'← Zurück zum Assistenten'],[0,true,'← Zurück zum Assistenten']]){
 const h=harness(stage,connection);
 eq(h.F.openNvmCalculator(),true);eq(h.node.parentNode,h.host);eq(h.workspace.hidden,false);eq(h.classes.has('guided-active'),true);eq(h.classes.has('guided-nvm-active'),true);eq(h.back.textContent,backText);eq(h.calls.refresh,1);eq(h.F.openNvmCalculator(),true);eq(h.calls.refresh,1);
 eq(h.F.closeNvmCalculator(),true);eq(h.node.parentNode,h.original);eq(h.workspace.hidden,true);eq(h.classes.has('guided-active'),true);eq(h.classes.has('guided-nvm-active'),false);eq(h.document.title,'Original');eq(h.calls.scroll.at(-1),77);eq(h.F.closeNvmCalculator(),false);
}
assert.match(guide,/if\(stage===0&&task==='nvm'\)\{openNvmCalculator\(\);return\}/);n++;
assert.match(app,/window\.ELMOS_GUIDED\.openNvmCalculator\(\);/);n++;
assert.match(html,/id="guidedNvmBack"/);n++;
assert.match(css,/html\.guided-nvm-active #guidedWorkspace/);n++;
console.log(n+' calculator navigation checks passed');
