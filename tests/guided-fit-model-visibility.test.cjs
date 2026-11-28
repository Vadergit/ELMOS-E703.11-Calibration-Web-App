'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const guide=fs.readFileSync(path.join(__dirname,'../guided.js'),'utf8');
const model=guide.slice(guide.indexOf(' function syncFitModelVisibility(){'),guide.indexOf(' function updateUI(){'));
const label={hidden:false},classes=new Set(),order={value:'0'};
const fields={calFitMode:{closest:()=>label},calTOrder:order,gwFitFields:{classList:{toggle:(k,v)=>v?classes.add(k):classes.delete(k)}}};
const sync=new Function('$',model+'return syncFitModelVisibility;')(id=>fields[id]);
let checks=0;const eq=(a,b)=>{assert.equal(a,b);checks++;};
for(const n of [0,1,2,3,0]){order.value=String(n);sync();eq(label.hidden,n===0);eq(classes.has('gw-fit-without-temperature'),n===0);}
const fitSource=guide.slice(guide.indexOf(' function applyFitPlan(p){'),guide.indexOf(' function applyPlan(){'));
for(const [previous,p] of [['tk0',{orderS:1,orderT:0,fitMode:'full'}],['full',{orderS:1,orderT:1,fitMode:'tk0'}],['tk0',{orderS:2,orderT:1,fitMode:'full'}],['full',{orderS:1,orderT:1,fitMode:'full'}]]){
 const state={calFitMode:previous,calSOrder:1,calTOrder:1};
 const fieldValue=(id,v)=>{if(state[id]===v)return;state[id]=v;if(id==='calFitMode'&&v==='tk0'){state.calSOrder=1;state.calTOrder=1;}};
 const apply=new Function('fieldValue',fitSource+'return applyFitPlan;')(fieldValue);apply(p);eq(state.calFitMode,p.fitMode);eq(state.calSOrder,p.orderS);eq(state.calTOrder,p.orderT);
}
assert.match(guide,/if\(stage===5\)syncFitModelVisibility\(\)/);checks++;
assert.match(guide,/fitLabel\.hidden=false/);checks++;
console.log(checks+' fit model visibility and plan transition checks passed');
