'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const app=read('app.js'),g=read('guided.js');
function setup(){
 const st={port:{},sessionIndex:1,uid:{hex:'ABC'},chip:true,calpoints:[{pressure:0},{pressure:6}]};
 const fields={calDspLimit:{value:'32000'}};
 const section=app.slice(app.indexOf(' function dspRiskContext(){'),app.indexOf(' function guidedDspRetryAvailable(){'));
 const api=new Function('st','$','calibrationReferenceSnapshot',section+';return {dspRiskContext,dspRiskContextMatches}')(st,id=>fields[id],()=>({pmax:6}));
 return {st,fields,api};
}
test('DSP proposal rejects changed sensor, reference samples or limit',()=>{for(const change of [h=>h.st.sessionIndex++,h=>h.st.uid.hex='DEF',h=>h.st.calpoints.pop(),h=>h.fields.calDspLimit.value='30000',h=>h.st.port={}]){const h=setup(),saved=h.api.dspRiskContext();assert.equal(h.api.dspRiskContextMatches(saved),true);change(h);assert.equal(h.api.dspRiskContextMatches(saved),false);}});
test('guided retry preserves existing reference matrix and uses guarded RAM path',()=>{assert.match(g,/plan=Object.freeze\(\{\.\.\.previous,outputLimit:limit\}\)/);assert.match(g,/await runFixedFit\(expected,true\)/);assert.match(g,/result.state==='ready'&&state\(\).calStaged/);assert.match(app,/!explicitRetry&&!ELMOS_GUIDED_PLAN.fixedFitModel/);assert.match(app,/await applyCalRam\(\)/);});
