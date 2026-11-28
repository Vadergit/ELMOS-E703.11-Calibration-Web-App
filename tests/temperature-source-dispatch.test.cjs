'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const normal=require('../calibration.js'),extended=require('../temperature-beta/calibration.js'),dispatch=require('../temperature-source-dispatch.js')(normal,extended);
const fixtures=require('../temperature-beta/manufacturer-dll-reference.json');
let n=0;const eq=(a,b)=>{assert.deepEqual(a,b);n++;};
for(const orderT of [0,1,2])for(const orderS of [1,2,3])for(const limit of [25000,32000]){const points=[];for(let j=0;j<=orderT;j++)for(let i=0;i<=orderS;i++){const p=i/orderS*100,t=orderT?25+j*30:25;points.push({adc_s:Math.round(-18000+36000*p/100+(t-25)*8),adc_t:-6000+(t-25)*200,pressure:p,temperature:t,temperatureSource:'internal'});}const opts={pmin:0,pmax:100,orderS,orderT,outputLimit:limit};let ref;try{ref={fit:normal.fit(points,opts)}}catch(e){ref={error:e.message}}let actual;try{actual={fit:dispatch.fit(points,opts)}}catch(e){actual={error:e.message}}eq(actual,ref);}
const p=fixtures.calVerify,pts=p.adc_t.map((adc_t,i)=>({adc_t,adc_tc:p.adc_tc[i],adc_s:p.adc_s[i],pressure:(p.targetS[i]+32000)/640,temperature:(p.targetT[i]+16485)/387.88,temperatureSource:'bridge'}));const opts={pmin:0,pmax:100,orderS:1,orderT:1,outputLimit:32000};eq(dispatch.fit(pts,opts),extended.fit(pts,opts));const ext=pts.map(x=>({...x,temperatureSource:'external'}));eq(dispatch.fit(ext,opts),extended.fit(ext,opts));
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.ok(!html.includes('temperature-beta-router.js'));n++;assert.ok(!html.includes('temperature-beta.html'));n++;assert.ok(html.includes('value="internal" selected'));n++;
console.log(n+' dispatch / same-page checks passed');
