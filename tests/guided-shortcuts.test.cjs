'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const guided=read('guided.js'),html=read('index.html'),css=read('guided.css'),
 help=read('offline-anleitung.html'),usb=read('usb-diagnose.html');

test('guided task chooser contains six distinct one-click cards',()=>{
 const choice=guided.slice(guided.indexOf("'<div id=\"gwPage0\""),guided.indexOf("'<div id=\"gwPage1\""));
 const cards=[...choice.matchAll(/data-gw-task="([^"]+)"/g)].map(x=>x[1]);
 assert.deepEqual(cards,['calibration','output','inspect','testlog','verification','archive']);
 assert.match(choice,/Archiv<\/strong>/);
 assert.match(choice,/Nachmessung<\/strong>/);
 assert.match(guided,/try\{await next\(\)\}finally\{taskOpening=false\}/);
 assert.match(guided,/gwNext'\)\.hidden=loggerPage\|\|stage===0/);
});
test('six choices use responsive 3x2 grid and stack gracefully on mobile',()=>{
 assert.match(guided,/gw-columns gw-six/);
 assert.match(css,/\.gw-columns\.gw-six\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:1000px\)\{\.gw-columns\.gw-six\{grid-template-columns:repeat\(2/);
 assert.match(css,/@media\(max-width:520px\)\{\.gw-columns\.gw-six\{grid-template-columns:1fr/);
});
function runShortcut(task,{logging=false,archiveAvailable=true}={}){
 const first=guided.indexOf(' async function next(){'),last=guided.indexOf(' function previous(){',first);
 assert.ok(first>0&&last>first);
 const fn=guided.slice(first,last);
 const opened=[],messages=[];
 const win={ELMOS_TEST_LOGGER:{isBusy:()=>logging}};
 if(archiveAvailable)win.ELMOS_ARCHIVE={open:mode=>opened.push(mode)};
 const proceed=new Function('window','stage','task','msg','state',fn+';return next();');
 return Promise.resolve(proceed(win,0,task,(message,kind)=>messages.push([message,kind]),
  ()=>{throw Error('Should not check sensor for Archive/Verification shortcut')}))
  .then(()=>({opened,messages}));
}
test('archive tile opens saved records without requiring an active sensor',async()=>{
 const result=await runShortcut('archive');
 assert.deepEqual(result.opened,['archive']);
 assert.deepEqual(result.messages,[]);
});
test('verification tile opens its own editor regardless of header preference',async()=>{
 const result=await runShortcut('verification');
 assert.deepEqual(result.opened,['verification']);
 assert.deepEqual(result.messages,[]);
 assert.match(html,/id="verificationOpen"[^>]*hidden/);
 assert.match(html,/id="settingsVerificationEnabled"/);
});
test('shortcuts respect running logging guard and missing archive module',async()=>{
 const busy=await runShortcut('archive',{logging:true});
 assert.equal(busy.opened.length,0);
 assert.match(busy.messages[0][0],/Testaufzeichnung/);
 const missing=await runShortcut('verification',{archiveAvailable:false});
 assert.equal(missing.opened.length,0);
 assert.match(missing.messages[0][0],/nicht geladen/);
});
test('every navigational link from the app opens a new tab safely',()=>{
 const anchors=[...html.matchAll(/<a\b[^>]*href="[^"]+"[^>]*>/gi)].map(x=>x[0]);
 assert.ok(anchors.length>=4);
 for(const anchor of anchors){
  assert.match(anchor,/target="_blank"/);
  assert.match(anchor,/rel="noopener noreferrer"/);
 }
 assert.match(html,/href="offline-anleitung\.html" target="_blank" rel="noopener noreferrer"/);
});
test('help and USB diagnostic links open separate tabs, ZIP stays a direct download',()=>{
 for(const page of [help,usb]){
  const anchors=[...page.matchAll(/<a\b[^>]*href="[^"]+"[^>]*>/gi)].map(x=>x[0]);
  assert.ok(anchors.length>=1);
  for(const anchor of anchors){
   if(anchor.includes('main.zip'))continue;
   assert.match(anchor,/target="_blank"/);
   assert.match(anchor,/rel="noopener noreferrer"/);
  }
 }
 const zip=[...help.matchAll(/<a\b[^>]*href="[^"]*main\.zip[^"]*"[^>]*>/gi)][0]?.[0];
 assert.ok(zip);
 assert.doesNotMatch(zip,/target="_blank"/);
});
test('v0.7.6 script and stylesheet cache-busting are updated together',()=>{
 assert.match(html,/data-app-version="0\.7\.21"/);
 assert.match(html,/guided\.js\?v=0\.7\.21/);
 assert.match(html,/guided\.css\?v=0\.7\.9/);
});
