'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),P=require('../guided-plan.js');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('unique fixed models only',()=>{for(const [p,t,mode,yes] of [[2,1,'full',true],[2,2,'tk0',true],[2,2,'full',true],[2,3,'full',false],[3,1,'full',false],[4,1,'full',false],[3,2,'full',false]]){const plan=P.create({pCount:p,tCount:t,temperatures:[25,50,75].slice(0,t),fitMode:mode});assert.equal(P.fixedFitModel(plan),yes);}});
test('explicit pressure-only multi-temperature or alternative model stays manual',()=>{assert.equal(P.fixedFitModel(P.create({pCount:2,tCount:2,temperatures:[25,75],orderT:0})),false);assert.equal(P.fixedFitModel(null),false);});
function harness(opts={}){
 const plan=P.create({pCount:2,tCount:1,temperatures:[25],outputLimit:30000}),fields={calSOrder:{value:'1'},calTOrder:{value:'0'},calFitMode:{value:'full'},calDspLimit:{value:'30000'},calFitMsg:{classList:{contains:k=>k===(opts.warning?'warn':'success')}},calTempFallback:{hidden:true},calDspProposal:{hidden:true},calApplyRam:{disabled:!!opts.disabled},calRamStageMsg:{classList:{contains:k=>k===(opts.ramWarning?'warn':'success')}},dspRiskDialog:{open:false}};
 const st={port:{},sessionIndex:1,uid:{hex:'x'},chip:true,calpoints:[{p:0},{p:100}],calfit:null};let calculations=0,writes=0,visible=true;
 const app=read('app.js'),start=app.indexOf(' async function runGuidedFixedFit('),end=app.indexOf(' window.ELMOS_GUIDED_API=Object.freeze',start);
 let archive=null;const calc=()=>{calculations++;st.calfit={outputLimit:30000,stats:{maxDigits:1},ignoredTemperaturePoints:0};if(opts.archiveFail)archive=Promise.resolve(false);if(opts.switchSensor)archive=Promise.resolve().then(()=>{st.sessionIndex++;return true});if(opts.leave)archive=Promise.resolve().then(()=>{visible=false;return true});};
 const code='let guidedFitArchivePromise=null;function calcCoefficients(){calc();guidedFitArchivePromise=getArchive();}'+app.slice(start,end)+';return runGuidedFixedFit;';
 const run=new Function('st','$','ELMOS_GUIDED_PLAN','calEndpointsReady','coefficientSettingsCurrent','calibrationReferenceSnapshot','calc','getArchive','applyCalRam',code)(st,id=>fields[id],P,()=>true,()=>!!st.calfit,()=>({}),calc,()=>archive,async()=>{writes++;st.calStaged=!opts.ramFail});
 return {run:()=>run(plan,()=>visible),counts:()=>[calculations,writes]};
}
test('successful fit writes RAM once and advances only on readback',async()=>{const h=harness();assert.equal((await h.run()).state,'ready');assert.deepEqual(h.counts(),[1,1]);});
for(const key of ['warning','archiveFail','switchSensor','leave','disabled'])test('no RAM write on '+key,async()=>{const h=harness({[key]:true});assert.equal((await h.run()).state,'stopped');assert.deepEqual(h.counts(),[1,0]);});
for(const key of ['ramWarning','ramFail'])test('no automatic advance on '+key,async()=>{const h=harness({[key]:true});assert.equal((await h.run()).state,'stopped');assert.deepEqual(h.counts(),[1,1]);});
