// Deterministic numeric test inputs; no hardware writes.
const C=require('../calibration.js'), A=require('../temperature-afe.js');
const fixture=require('./fixtures/temperature-afe-dll.json');
const grid=(n,a,b)=>Array.from({length:n},(_,i)=>n===1?(a+b)/2:a+(b-a)*i/(n-1));
const mask=(s,t)=>Array.from({length:s+1},(_,i)=>Array.from({length:t+1},(_,j)=>1<<(4*i+j))).flat().reduce((a,b)=>a|b,0);
const signed=w=>w>=32768?w-65536:w;
const indices=[31,32,33,34,...Array.from({length:16},(_,i)=>35+i),51,52,53,54];
function regWords(r){const w={33:r.so,34:r.sf};r.coeffs.forEach((v,i)=>w[35+i]=v);if(r.tcoeffs){w[31]=r.to;w[32]=r.tf;r.tcoeffs.forEach((v,i)=>w[51+i]=v);}return w;}
function predict(p,r,fac,orderT){
 const s=signed(r.sf)/4096*p.adc_s/32768+signed(r.so)/4096;
 const raw=p.temperatureSource==='bridge'?A.correctedBridgeTemperature(p.adc_t,p.adc_tc,fac.g01,fac.g2off):p.adc_t;
 const t=orderT?signed(r.tf)/4096*raw/32768+signed(r.to)/4096:0;
 return {s:r.coeffs.reduce((v,x,k)=>v+signed(x)*s**Math.floor(k/4)*t**(k%4),0),t:r.tcoeffs?r.tcoeffs.reduce((v,x,k)=>v+signed(x)*t**k,0):null};
}
const cases=[];
function add(name,source,orderS,orderT,limit,points,verify,fitMode='full',facOverride=null){
 const factory=facOverride||{afe2:source==='bridge'?0x114a:source==='external'?0x1153:0x1154,cfgEn:source==='bridge'?0x12da:0x12d6,g01:0x1020,g2off:0x2008};
 const opts={pmin:0,pmax:100,orderS,orderT,outputLimit:limit,fitMode};
 const target=p=>({...p,targetS:2*limit*p.pressure/100-limit,targetT:387.88*p.temperature-16485});
 const row={name,source,opts,factory,sMask:fitMode==='tk0'?0x13:mask(orderS,orderT),points:points.map(target),verify:verify.map(target),uiPointLimitExceeded:points.length>10,uiTemperatureOrderUnsupported:source!=='internal'&&orderT===0};
 try{
  const result=source==='bridge'&&orderT?A.fitBridgeOffline(points,opts,factory,C.fit):C.fit(points,opts);
  row.js={ok:true,words:regWords(result.registers),stats:result.stats,predictions:[...points,...verify].map(p=>predict(p,result.registers,factory,orderT))};
 }catch(e){row.js={ok:false,error:e.message};}
 cases.push(row);
}
function point(source,p,t,variant='nominal'){
 const x=(p-50)/50,u=(t-25)/85;
 let adc_s=16500*x+600*u+750*x*u+400*x*x+150*u*u;
 let adc_t=source==='bridge'?9000-12000*u+200*u*u:source==='external'?1000-18000*u+300*u*u:1000-14500*u+400*u*u;
 if(variant==='linear')adc_s=15000*x;
 if(variant==='tk0')adc_s=15000*x+1000*u;
 if(variant==='reverse')adc_s=-adc_s;
 if(variant==='small')adc_s=1500*x;
 if(variant==='noise'){adc_s+=Math.sin(p*13+t)*30;adc_t+=Math.cos(p+t*17)*20;}
 return {pressure:p,temperature:t,adc_s:Math.round(adc_s),adc_t:Math.round(adc_t),adc_tc:Math.round(-9000*u),temperatureSource:source};
}
for(const source of ['internal','bridge','external'])for(const limit of [25000,32000]){
 for(let s=1;s<=3;s++)for(let t=0;t<=3;t++){
  const temps=t?grid(t+1,-40,125):[25];
  const points=temps.flatMap(z=>grid(s+1,0,100).map(p=>point(source,p,z)));
  const verify=(t?grid(6,-35,120):[25]).flatMap(z=>grid(7,5,95).map(p=>point(source,p,z)));
  add(source+'-S'+s+'-T'+t+'-'+limit,source,s,t,limit,points,verify);
 }
 add(source+'-TK0-'+limit,source,1,1,limit,[[0,25],[100,25],[0,85]].map(([p,t])=>point(source,p,t,'tk0')),grid(5,-30,120).flatMap(t=>grid(5,5,95).map(p=>point(source,p,t,'tk0'))),'tk0');
}
for(const source of ['internal','bridge','external'])for(const variant of ['linear','reverse','small','noise']){
 const pts=grid(3,-40,125).flatMap(t=>grid(3,0,100).map(p=>point(source,p,t,variant)));
 const ver=grid(6,-35,120).flatMap(t=>grid(7,5,95).map(p=>point(source,p,t,variant)));
 add(source+'-'+variant,source,1,1,25000,pts,ver);
}
for(const source of ['internal','bridge','external']){
 const p=point(source,0,25);add(source+'-rank-deficient',source,1,1,25000,[p,p,p,p],[]);
}
const v=fixture.calVerify;
add('historical-DLL-v3.20','bridge',1,1,25600,v.adc_s.map((adc_s,i)=>({adc_s,adc_t:v.adc_t[i],adc_tc:v.adc_tc[i],temperature:(v.targetT[i]+16485)/387.88,pressure:(v.targetS[i]+25600)/512,temperatureSource:'bridge'})),[],'full',fixture.calWords);
const last=cases.at(-1);last.historical={words:fixture.calFit.coeff,dspS:v.dspS,dspT:v.dspT};
console.log(JSON.stringify({schema:1,coefficientIndices:indices,cases}));
