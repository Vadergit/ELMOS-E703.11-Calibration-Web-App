'use strict';
// node tests/temperature-beta-router.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const router=fs.readFileSync(path.join(root,'temperature-beta-router.js'),'utf8');
const beta=fs.readFileSync(path.join(root,'temperature-beta.html'),'utf8'),standard=fs.readFileSync(path.join(root,'index.html'),'utf8');
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++};
function harness({isBeta=false,source=isBeta?'bridge':'internal',demo=false,connected=false,busy=false,accept=true,points=0}={}){
 const sel={value:source,options:['internal','bridge','external'].map(value=>({value,disabled:value!=='internal',textContent:value})),addEventListener(n,cb){this.cb=cb}};
 let alerts=[],confirms=[],links=[],buttons=[];
 const doc={documentElement:{dataset:isBeta?{temperatureBeta:'true'}:{}},getElementById:()=>sel,createElement(){return {style:{},setAttribute(){},append(el){buttons.push(el)},addEventListener(n,cb){this.click=cb}}},querySelector:()=>({after(){}})};
 const loc={href:'http://localhost:8000/'+(isBeta?'temperature-beta.html?source='+source:'index.html')+(demo?(isBeta?'&':'?')+'demo=1':''),assign:u=>links.push(u)};
 const win={ELMOS_GUIDED_API:{state:()=>({usbConnected:connected,demo,connectionBusy:busy,points:Array(points).fill({})}),navigationSafety:()=>({critical:busy,measuring:false,points})},confirm:m=>{confirms.push(m);return accept}};
 new Function('document','window','location','alert','URL',router)(doc,win,loc,m=>alerts.push(m),URL);
 return {sel,alerts,confirms,links,buttons,change(value){sel.value=value;let stopped=false;sel.cb({stopImmediatePropagation(){stopped=true},preventDefault(){}});return stopped}};
}
let h=harness();
check(h.sel.options.filter(o=>o.value!=='internal').every(o=>!o.disabled),'options enabled');
check(h.change('bridge')&&h.sel.value==='internal','standard source restored');
check(h.links[0].endsWith('temperature-beta.html?source=bridge'),'PTC destination');
h=harness({demo:true,connected:true});check(h.change('external')&&h.links[0].includes('demo=1&source=external'),'demo preserved');
h=harness({connected:true});check(h.change('bridge')&&h.alerts.length===1&&!h.links.length,'connected guard');
h=harness({busy:true});check(h.change('external')&&!h.links.length,'busy guard');
h=harness({accept:false});check(h.change('bridge')&&!h.links.length&&h.sel.value==='internal','cancel');
h=harness({isBeta:true,source:'external'});check(h.change('internal')&&h.links[0].endsWith('index.html'),'return to standard');
h=harness({isBeta:true,source:'bridge'});check(!h.change('external')&&!h.links.length&&h.sel.value==='external','beta source switching');
h=harness({points:2});h.change('bridge');check(h.confirms[0].includes('nicht gespeicherte'),'draft warning');
check(!standard.includes('temperature-beta/app.js'),'standard does not load beta');
check(beta.includes('temperature-beta/app.js'),'beta app loaded');
check(beta.includes("s==='external'?'external':'bridge'"),'source preset');
for(const [,src] of beta.matchAll(/<script[^>]+src="([^"?]+)(?:\?[^"]*)?"/g))check(fs.existsSync(path.join(root,src)),'missing script '+src);
console.log(checks+' router / dependency checks passed');
