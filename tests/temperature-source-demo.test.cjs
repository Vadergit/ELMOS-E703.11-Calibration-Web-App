'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const P=require('../app.js'),C=require('../calibration.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const A=new Function(read('temperature-beta/temperature-afe.js')+'\nreturn {bridge:ELMOS_TEMPERATURE_AFE,external:ELMOS_EXTERNAL_AFE};')();
const Old=new Function(read('tests/fixtures/standard-demo-v07202.js')+'\nreturn ELMOS_DEMO')(),New=new Function('window','ELMOS_TEMPERATURE_AFE','ELMOS_EXTERNAL_AFE',read('demo.js')+'\nreturn ELMOS_DEMO')({ELMOS_PTC_DEV:true},A.bridge,A.external);
async function run(){
 const stimulus=()=>({lower:0,upper:100,limit:32000}),x=Old.create(P,C,stimulus),y=New.create(P,C,stimulus);await x.open();await y.open();
 let checks=0;const eq=(a,b)=>{assert.equal(a,b);checks++;};const cmd=addr=>'PLC 026D'+P.hx(addr)+'02.';
 const regs=[4,6,8,10,12,16,26,28,30,0x26,0x28,0x2a,0x2e,0x30,0x38,0x50,0x52,0x6c,0x6e,0x70,0x72];
 for(const p of [0,50,100])for(const t of [0,25,80]){x.setReference(p,t);y.setReference(p,t);for(const addr of regs)eq(x.exchange(cmd(addr)),y.exchange(cmd(addr)));}
 const before=regs.map(addr=>y.exchange(cmd(addr))),profile={source:'bridge',bridgeOhm:10000,parallelOhm:7000,ptcTcr:2000,tk0:25,tke:300,svddCode:0};
 const code=A.bridge.probeOrder({svddCode:0,resistanceOhm:10000*7000/17000})[0];y.setPtcProfile(profile,code);eq(y.ptcConfigured('bridge'),true);eq(y.ptcWords().afe2,0x114a);eq(y.exchange(cmd(0x28))!==before[10],true);y.clearPtcProfile();for(let i=0;i<regs.length;i++)eq(y.exchange(cmd(regs[i])),before[i]);
 const ep={...profile,source:'external',eocMv:650,eocSlope:-1.8,eocTolerance:10,minTemp:-40,maxTemp:125,eocBias:0},best=A.external.plan(ep).best;eq(!!best,true);y.setExternalProfile(ep,best);eq(y.ptcConfigured('external'),true);eq(y.ptcWords().afe2&3,3);y.clearPtcProfile();for(let i=0;i<regs.length;i++)eq(y.exchange(cmd(regs[i])),before[i]);
 console.log(checks+' simulator checks passed');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
