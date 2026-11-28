"use strict";
function buildPtcProfile(A){
 const defaults=Object.freeze({bridgeOhm:10000,bridgeTolerance:10,parallelOhm:10000,parallelTolerance:40,bridgeCold:120,bridgeHot:180,ptcTcr:2000,ptcTcrTolerance:20,minTemp:-40,maxTemp:125,svddCode:2,fullSupplyTolerance:true});
 const check=(b,m)=>{if(!b)throw new RangeError(m)};
 const pos=(v,m)=>{check(Number.isFinite(v)&&v>0,m);return v};
 const limits=(v,t)=>[v*(1-t/100),v*(1+t/100)];
 const unique=a=>[...new Set(a)];
 function validate(p){
  for(const k of ['bridgeOhm','parallelOhm'])pos(p[k],k+' muss positiv sein.');
  for(const k of ['bridgeTolerance','parallelTolerance','ptcTcrTolerance'])check(Number.isFinite(p[k])&&p[k]>=0&&p[k]<100,k+' muss zwischen 0 und unter 100 % liegen.');
  for(const k of ['bridgeCold','bridgeHot','ptcTcr'])check(Number.isFinite(p[k])&&p[k]>=0,k+' muss nichtnegativ sein (PTC-Modell).');
  check(Number.isFinite(p.minTemp)&&Number.isFinite(p.maxTemp)&&p.minTemp<p.maxTemp,'Ungültiger Temperaturbereich.');
  check([0,1,2].includes(p.svddCode),'Ungültiger SVDD-Code.');
 }
 function factor(t,cold,hot=cold){return pos(1+(t-25)*(t<25?cold:hot)/1e6,'Widerstandsmodell ergibt keinen positiven Widerstand.');}
 function resistance(t,b,p,cold,hot,pt){return A.equivalent(b*factor(t,cold,hot),p*factor(t,pt))}
 function range(input={},anchor=null){
  const p={...defaults,...input};validate(p);
  const bs=unique(limits(p.bridgeOhm,p.bridgeTolerance)),ps=unique(limits(p.parallelOhm,p.parallelTolerance)),ts=unique(limits(p.ptcTcr,p.ptcTcrTolerance));
  const scenarios=[];let inferred=null;
  if(anchor!==null){
   pos(anchor.ohm,'Gemessener Gesamtwiderstand muss positiv sein.');
   check(Number.isFinite(anchor.temp)&&anchor.temp>=p.minTemp&&anchor.temp<=p.maxTemp,'Referenzmessung ausserhalb des Temperaturbereichs.');
   check(Number.isFinite(anchor.uncertainty)&&anchor.uncertainty>=0&&anchor.uncertainty<100,'Messunsicherheit muss zwischen 0 und unter 100 % liegen.');
   const rs=unique(limits(anchor.ohm,anchor.uncertainty));
   for(const b of bs)for(const r of rs)for(const pt of ts){
    const bAt=b*factor(anchor.temp,p.bridgeCold,p.bridgeHot);
    check(r<bAt,'Messwert und Brückenprofil erlauben keine sichere Rückrechnung des Parallelwiderstands.');
    const inferredP=1/(1/r-1/bAt)/factor(anchor.temp,pt);
    scenarios.push({b,p:inferredP,pt});
   }
   inferred={min:Math.min(...scenarios.map(s=>s.p)),max:Math.max(...scenarios.map(s=>s.p))};
  }else for(const b of bs)for(const parallel of ps)for(const pt of ts)scenarios.push({b,p:parallel,pt});
  const nominalB=p.bridgeOhm;
  const nominalP=anchor?1/(1/anchor.ohm-1/(nominalB*factor(anchor.temp,p.bridgeCold,p.bridgeHot)))/factor(anchor.temp,p.ptcTcr):p.parallelOhm;
  pos(nominalP,'Nominaler PTC-Widerstand nicht bestimmbar.');
  const endpoints=scenarios.flatMap(s=>[p.minTemp,p.maxTemp].map(t=>resistance(t,s.b,s.p,p.bridgeCold,p.bridgeHot,s.pt)));
  const nominalAt=t=>resistance(t,nominalB,nominalP,p.bridgeCold,p.bridgeHot,p.ptcTcr);
  const tcr=bT=>(nominalP*bT+nominalB*p.ptcTcr)/(nominalB+nominalP);
  const samples=Array.from({length:33},(_,i)=>{const temp=p.minTemp+(p.maxTemp-p.minTemp)*i/32;const values=scenarios.map(s=>resistance(temp,s.b,s.p,p.bridgeCold,p.bridgeHot,s.pt));return {temp,min:Math.min(...values),max:Math.max(...values),nominal:nominalAt(temp)}});
  return {minOhm:Math.min(...endpoints),maxOhm:Math.max(...endpoints),nominalOhm:nominalAt(25),nominalPtcOhm:nominalP,effectiveCold:tcr(p.bridgeCold),effectiveHot:tcr(p.bridgeHot),inferred,profileMismatch:!!inferred&&(inferred.min<ps[0]||inferred.max>ps[ps.length-1]),samples};
 }
 function plan(input={},anchor=null){
  const p={...defaults,...input};const r=range(p,anchor);return {...r,selection:A.plan({minOhm:r.minOhm,maxOhm:r.maxOhm,svddCode:p.svddCode,fullSupplyTolerance:p.fullSupplyTolerance})};
 }
 function checkPoint({adc,adcTC,adcS,svdd,afe0,afe2}){
  for(const v of [adc,adcTC,adcS])check(Number.isInteger(v)&&v>=-32768&&v<=32767,'Alle drei ADC-Rohwerte müssen signed 16-Bit-Ganzzahlen sein.');
  const result=A.estimate({adc,svdd,afe0,afe2});
  const saturated=[adc,adcTC,adcS].some(v=>v===-32768||v===32767);
  return {...result,valid:result.valid&&!saturated,pressureHeadroom:25000-Math.abs(adcS),saturated};
 }
 return Object.freeze({defaults,range,plan,checkPoint});
}
const PTC_PROFILE=buildPtcProfile(typeof module!=="undefined"&&module.exports?require("./temperature-afe.js"):window.ELMOS_TEMPERATURE_AFE);
if(typeof module!=="undefined"&&module.exports)module.exports=PTC_PROFILE;
if(typeof window!=="undefined")window.PTC_PROFILE=PTC_PROFILE;
