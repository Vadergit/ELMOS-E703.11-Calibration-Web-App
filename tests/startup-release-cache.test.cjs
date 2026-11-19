'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const app=read('app.js'),html=read('index.html'),expert=read('expert.js'),alarm=read('alarm-editor.js');
test('All local scripts share the HTML release cache key; removed DSP fields are not read',()=>{
 const release=html.match(/data-app-version="([^"]+)"/)[1];
 const scripts=[...html.matchAll(/<script\s+src="([^"]+\.js(?:\?[^"]*)?)"/g)].map(m=>m[1]);
 assert.ok(scripts.length>15&&scripts.every(s=>s.includes('release='+release)));
 assert.ok(!html.includes('id="dspDisplayLimit"'));
 for(const source of [app,expert,alarm])assert.ok(!source.includes("$('dspDisplayLimit')"));
});
test('Automatic USB start is deferred until Expert and Alarm initialization completes',()=>{
 const scheduled=app.lastIndexOf('setTimeout(()=>auto().catch');
 assert.ok(scheduled>app.indexOf('expert=ELMOS_EXPERT.init'));
 assert.ok(scheduled>app.indexOf('ELMOS_ALARM_EDITOR.init'));
 assert.ok(scheduled>app.lastIndexOf('uiReady=true'));
});
test('Connection cannot open a port before UI init completes',async()=>{
 const from=app.indexOf('async function connect(port)'),to=app.indexOf(' async function connectOperation',from);
 const simulate=new Function('ready','record','return (async()=>{let uiReady=ready;const connectOperation=async()=>record();const withProgress=async(_,f)=>f();'+app.slice(from,to)+'\nreturn connect({});})();');
 let opened=0;
 await assert.rejects(simulate(false,()=>opened++),/Softwareinitialisierung/);
 assert.equal(opened,0);
 await simulate(true,()=>opened++);
 assert.equal(opened,1);
});
