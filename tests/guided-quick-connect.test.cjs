'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const guide=fs.readFileSync(path.join(__dirname,'../guided.js'),'utf8');
const src=guide.slice(guide.indexOf(' function quickConnectVisible('),guide.indexOf(' function updateConnectionChoices(){'));
const checks=[];
async function run(){
 for(const [demo,usb,chip,visible] of [[false,false,false,true],[false,true,false,false],[false,true,true,false],[true,false,false,false],[false,false,true,false]]){
  const f=new Function(src+'return quickConnectVisible;')();assert.equal(f({demo,usbConnected:usb,chip}),visible);checks.push('visible');
 }
 for(const [board,expected,iface,success] of [['ssp3','ssp3','plc',true],['esp32','bridge','i2c',true],['promicro','bridge','plc',true],['ssp3','ssp3','i2c',false]]){
  let state={demo:false,usbConnected:false,chip:false};const els={gwQuickBoard:{value:board},gwQuickInterface:{value:iface},gwConnectionAdapter:{},gwConnectionInterface:{}};
  let opened=0,closed=0,calls=0;
  const f=new Function('$','state','mode','connectionBusy','taskOpening','openConnectionPanel','updateConnectionChoices','connectGuidedSensor','closeConnectionPanel','msg',src+'return quickConnect;')(id=>els[id],()=>state,true,false,false,()=>opened++,()=>{},async pick=>{calls++;assert.equal(pick,true);assert.equal(els.gwConnectionAdapter.value,expected);assert.equal(els.gwConnectionInterface.value,iface);state={...state,chip:success};return success;},()=>closed++,()=>{});
  await f();assert.equal(opened,1);assert.equal(calls,1);assert.equal(closed,success?1:0);checks.push('connect');
 }
 assert.match(guide,/id="gwQuickConnectButton"/);assert.match(guide,/renderQuickConnect\(s\);/);assert.match(guide,/const connected=await connectGuidedSensor\(true\)/);
 console.log('9 quick-connect scenarios and 3 source checks passed');
}
run().catch(e=>{console.error(e);process.exitCode=1});
