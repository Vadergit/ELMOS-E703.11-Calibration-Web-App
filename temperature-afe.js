"use strict";
// E703.11 Rev 04 tables 4.4-1, 4.5.2-1, 6.5.1.3 and section 6.2.2.4.
// Nominal engineering model; DLL and hardware parity not yet established.
function buildTemperatureAFE(){
 const SUPPLIES=[2.4,1.6,2.0],SUPPLY_LIMITS=[[2.2,2.6],[1.4,1.8],[1.8,2.2]];
 const G2=[28,19,13,9,6,4,3,2],I_MIN=[1.119,.759,.520,.360,.240,.160,.120,.089],I_MAX=[2.74,2.066,1.414,.979,.652,.435,.326,.217];
 const MUX_MIN=.425,MUX_MAX=1.0,REF=.65,ADC_SCALE=32768;
 const assert=(ok,msg)=>{if(!ok)throw new RangeError(msg)};
 const pos=(x,name)=>{assert(Number.isFinite(x)&&x>0,name+' muss positiv und endlich sein.');return x};
 const finite=(x,name)=>{assert(Number.isFinite(x),name+' muss endlich sein.');return x};
 function rpga(code){
  assert(Number.isInteger(code)&&code>=0&&code<16,'Ungültiger br_gain-Code.');
  const i=code>>1,g1=code&1?9/11:1,g2=G2[i];
  return {code,g1,g2,i2u:9000/(g1*g2),minCurrent:I_MIN[i],maxCurrent:I_MAX[i]};
 }
 function equivalent(b,p){pos(b,'Brücke');if(p==null)return b;pos(p,'Parallelwiderstand');return 1/(1/b+1/p)}
 function linearRange({bridgeOhm,parallelOhm=null,bridgeTcr=0,parallelTcr=0,reference=25,minTemp,maxTemp,bridgeTolerance=0,parallelTolerance=0}){
  pos(bridgeOhm,'Brücke');if(parallelOhm!=null)pos(parallelOhm,'Parallelwiderstand');
  [bridgeTcr,parallelTcr,reference,minTemp,maxTemp,bridgeTolerance,parallelTolerance].forEach((v,i)=>finite(v,'Parameter '+i));
  assert(minTemp<=maxTemp,'Temperaturbereich ungültig.');assert(bridgeTolerance>=0&&bridgeTolerance<100&&parallelTolerance>=0&&parallelTolerance<100,'Toleranz ausserhalb 0–100 %.');
  const b0=bridgeOhm,b1=b0*bridgeTcr/1e6,p0=parallelOhm,p1=p0==null?0:p0*parallelTcr/1e6;
  const ends=[minTemp-reference,maxTemp-reference],values=[];
  for(const bf of [1-bridgeTolerance/100,1+bridgeTolerance/100])for(const pf of [1-parallelTolerance/100,1+parallelTolerance/100]){
   const B0=b0*bf,B1=b1*bf,P0=p0==null?null:p0*pf,P1=p1*pf;
   const ts=ends.slice();
   if(P0!=null&&B1*P1<0){
    const ratio=Math.sqrt(-P1/B1),den=P1-ratio*B1;
    if(den!==0){const t=(ratio*B0-P0)/den;if(t>ends[0]&&t<ends[1])ts.push(t)}
   }
   for(const t of ts){const b=B0+B1*t,p=P0==null?null:P0+P1*t;values.push(equivalent(b,p))}
  }
  return {minOhm:Math.min(...values),maxOhm:Math.max(...values),nominalOhm:equivalent(b0,p0),
   effectiveTcr:p0==null?bridgeTcr:(p0*bridgeTcr+b0*parallelTcr)/(b0+p0)};
 }
 function signal({resistanceOhm,svdd,code}){
  pos(resistanceOhm,'Gesamtwiderstand');pos(svdd,'SVDD');const gain=rpga(code),current=svdd/resistanceOhm*1000,mux=current*gain.i2u/1000;
  const adcVoltage=(mux-REF)*2,adcIdeal=adcVoltage*ADC_SCALE;
  return {current,mux,adcVoltage,adcIdeal,adc:Math.round(adcIdeal),valid:mux>=MUX_MIN&&mux<=MUX_MAX&&current>=gain.minCurrent&&current<=gain.maxCurrent};
 }
 function estimate({adc,svdd,afe0,afe2}){
  assert(Number.isInteger(adc)&&adc>=-32768&&adc<=32767,'ADC_T muss ein signed 16-Bit-Wert sein.');
  pos(svdd,'SVDD');assert(Number.isInteger(afe0)&&afe0>=0&&afe0<=65535&&Number.isInteger(afe2)&&afe2>=0&&afe2<=65535,'Gültige AFE-Register erforderlich.');
  assert((afe2&0xff)===0x4a,'Brückentemperatur benötigt t_adc_src=2, TPGA1=2, TPGA2=1 sowie ADC_TC-Standardgains.');
  const code=(afe0>>4)&15,g=rpga(code),mux=REF+adc/(ADC_SCALE*2),current=mux*1000/g.i2u;
  return {mux,current,resistanceOhm:current>0?svdd/current*1000:null,valid:mux>=MUX_MIN&&mux<=MUX_MAX&&current>=g.minCurrent&&current<=g.maxCurrent,code};
 }
 function plan({minOhm,maxOhm,svddCode,fullSupplyTolerance=true}){
  pos(minOhm,'R min');pos(maxOhm,'R max');assert(minOhm<=maxOhm,'R min muss kleiner oder gleich R max sein.');
  assert(Number.isInteger(svddCode)&&svddCode>=0&&svddCode<=2,'Ungültiger SVDD-Code.');
  const v=SUPPLIES[svddCode],[vMin,vMax]=fullSupplyTolerance?SUPPLY_LIMITS[svddCode]:[v,v];
  const iMin=vMin/maxOhm*1000,iMax=vMax/minOhm*1000;
  const candidates=Array.from({length:16},(_,code)=>{
   const g=rpga(code),muxMin=iMin*g.i2u/1000,muxMax=iMax*g.i2u/1000;
   const headroom=Math.min(muxMin-MUX_MIN,MUX_MAX-muxMax),currentOK=iMin>=g.minCurrent&&iMax<=g.maxCurrent;
   const valid=currentOK&&headroom>=0;
   return {...g,iMin,iMax,muxMin,muxMax,adcMin:Math.round((muxMin-REF)*2*ADC_SCALE),adcMax:Math.round((muxMax-REF)*2*ADC_SCALE),headroom,currentOK,valid,
    afe0Bits:(code<<4)|svddCode,afe2Bits:0x004a,correctionBits:0x0008};
  });
  const eligible=candidates.filter(x=>x.valid).sort((a,b)=>b.headroom-a.headroom||(b.adcMax-b.adcMin)-(a.adcMax-a.adcMin)||a.code-b.code);
  return {svdd:v,vMin,vMax,iMin,iMax,best:eligible[0]||null,candidates};
 }
 function merge({afe0,afe2,cfgEn,code,svddCode}){
  [afe0,afe2,cfgEn].forEach(v=>assert(Number.isInteger(v)&&v>=0&&v<=65535,'Register ungültig.'));
  rpga(code);assert([0,1,2].includes(svddCode),'Ungültiger SVDD-Code.');
  return {afe0:(afe0&~0x00f3)|(code<<4)|svddCode,afe2:(afe2&~0x08ff)|0x004a,cfgEn:(cfgEn&~0x000c)|0x0008};
 }
 function correctedBridgeTemperature(adcT,adcTC,g01,g2off){
 if(![adcT,adcTC].every(v=>Number.isFinite(v)&&v>=-32768&&v<=32767))throw RangeError("ADC_T und ADC_TC als gültige signed 16-Bit-Rohwerte erforderlich.");
 if(![g01,g2off].every(v=>Number.isInteger(v)&&v>=0&&v<=65535))throw RangeError("Originale G01/G2OFF-Wörter erforderlich.");
 const s8=v=>v&128?v-256:v;
 const g0=s8(g01&255)/2048,g1=s8((g01>>8)&255)/1024,g2=s8(g2off&255)/2048,goff=s8((g2off>>8)&255)/32;
 const tc=adcTC/32768,k=g0+g1*tc+g2*tc*tc;
 return adcT+(adcT+goff*32768)*k;
}
function fitBridgeOffline(points,opts={},factory,fit){
 if(!factory||!Number.isInteger(factory.afe2)||(factory.afe2&255)!==0x4a||
    !Number.isInteger(factory.cfgEn)||(factory.cfgEn&12)!==8)
  throw Error("Brückenquelle, werkseitige TPGA/ADC_TC-Gains und Shunt-Kompensation erforderlich.");
 if(typeof fit!=="function")throw Error("Druck-/Temperatur-Fitfunktion fehlt.");
 const adjusted=points.map(p=>{
  if(p.temperatureSource!=="bridge")throw Error("Messpunkt gehört nicht zur Brückentemperaturquelle.");
  const value=correctedBridgeTemperature(p.adc_t,p.adc_tc,factory.g01,factory.g2off);
  if(value< -32768||value>32767)throw Error("Korrigierter Temperaturrohwert ausserhalb 16-Bit-Bereich.");
  return {...p,adc_t:value,rawAdcT:p.adc_t};
 });
 const result=fit(adjusted,opts);
 return {...result,temperatureSource:"bridge",temperatureCorrection:"dll-reference-float-model",correctedTemperatureDigits:adjusted.map(x=>x.adc_t),rawTemperatureDigits:adjusted.map(x=>x.rawAdcT),factoryWords:{g01:factory.g01,g2off:factory.g2off},offlineOnly:true};
}
 return Object.freeze({SUPPLIES,SUPPLY_LIMITS,rpga,equivalent,linearRange,signal,estimate,plan,merge,correctedBridgeTemperature,fitBridgeOffline});
}
const ELMOS_TEMPERATURE_AFE=buildTemperatureAFE();
if(typeof module!=="undefined"&&module.exports)module.exports=ELMOS_TEMPERATURE_AFE;
if(typeof window!=="undefined")window.ELMOS_TEMPERATURE_AFE=ELMOS_TEMPERATURE_AFE;
