'use strict';
/* Pure, tested guide-planning utilities. No hardware I/O and no NVM writes.
 * A temperature level is a physical reference condition, NOT merely a new DSP order.
 */
const ELMOS_GUIDED_PLAN=(()=>{
 const number=(value,label)=>{const n=Number(value);if(!Number.isFinite(n))throw Error(label+' muss eine gültige Zahl sein');return n};
 const rounded=x=>Number(x.toFixed(6));
 const presets=Object.freeze({
  quick:{label:'Schnellabgleich',pCount:2,tCount:1,pmin:0,pmax:100,unit:'%',complex:false,tempComp:false},
  temperature:{label:'Mit Temperatur',pCount:2,tCount:3,pmin:0,pmax:100,unit:'%',complex:false,tempComp:true},
   tk0:{label:'TK0 · 3 Punkte',pCount:2,tCount:2,pmin:0,pmax:100,unit:'%',complex:false,tempComp:true,fitMode:'tk0',temperatures:[25,75]},
   tke:{label:'TK0 + TKE · 4 Punkte',pCount:2,tCount:2,pmin:0,pmax:100,unit:'%',complex:false,tempComp:true,fitMode:'full',temperatures:[25,75]},
  custom:{label:'Individuell',pCount:3,tCount:2,pmin:0,pmax:100,unit:'%',complex:true,tempComp:true}
 });
 function create(spec={}){
  const pCount=Number(spec.pCount??2),tCount=Number(spec.tCount??1),pmin=number(spec.pmin??0,'Unterer Druck'),pmax=number(spec.pmax??100,'Oberer Druck');
   const fitMode=spec.fitMode??'full';
   if(!['full','tk0'].includes(fitMode))throw Error('Unbekanntes Temperaturmodell');
   if(fitMode==='tk0'&&(pCount!==2||tCount!==2))throw Error('TK0 mit 3 Punkten benötigt 2 Drücke und 2 Temperaturen');
  if(!Number.isInteger(pCount)||pCount<2||pCount>5)throw Error('2 bis 5 Druckpunkte wählen');
  if(!Number.isInteger(tCount)||tCount<1||tCount>3)throw Error('1 bis 3 Temperaturstufen wählen');
  if(pCount*tCount>10)throw Error('Diese Kombination ergibt '+pCount*tCount+' Messpunkte. Der bestehende Assistent unterstützt höchstens 10. Druck-/Temperaturstufen reduzieren.');
  if(!(pmax>pmin))throw Error('Der obere Druck muss grösser als der untere Druck sein');
  const tInput=Array.isArray(spec.temperatures)?spec.temperatures:[25];
  if(tInput.length!==tCount)throw Error('Für '+tCount+' Temperaturstufen genau '+tCount+' Solltemperaturen angeben');
  const temperatures=tInput.map(t=>number(t,'Referenztemperatur'));
  if(temperatures.some(t=>t< -40||t>125))throw Error('Temperaturen müssen zwischen −40 und 125 °C liegen');
  if(tCount>1&&temperatures.some((t,i)=>i>0&&t<=temperatures[i-1]))throw Error('Temperaturstufen müssen streng aufsteigend sein');
  const pressureValues=Array.from({length:pCount},(_,i)=>rounded(pmin+(pmax-pmin)*i/(pCount-1)));
  const points=[];
  for(let j=0;j<tCount;j++)for(let i=0;i<pCount;i++){
   // TK0 intentionally omits the upper-pressure / upper-temperature corner.
   if(fitMode==='tk0'&&j===1&&i===1)continue;
   const position=points.length;
   const slot=fitMode==='tk0'?(position===0?'lo':position===1?'hi':'extra1'):
    position===0?'lo':position===pCount*tCount-1?'hi':'extra'+position;
   points.push({index:position,slot,extraSlot:fitMode==='tk0'&&position===2?1:null,pressureIndex:i,temperatureIndex:j,
    pressure:pressureValues[i],temperature:temperatures[j],
    label:(tCount===1?'P'+(i+1):'T'+(j+1)+' / P'+(i+1)),title:(tCount===1?'Druck '+(i+1):'Temperatur '+(j+1)+' · Druck '+(i+1))});
  }
  const requestedS=spec.orderS===undefined?Math.min(3,pCount-1):Number(spec.orderS);
  const requestedT=spec.orderT===undefined?tCount-1:Number(spec.orderT);
  if(!Number.isInteger(requestedS)||requestedS<1||requestedS>Math.min(3,pCount-1))throw Error('Druckpolynomordnung muss zwischen 1 und '+Math.min(3,pCount-1)+' liegen');
  if(!Number.isInteger(requestedT)||requestedT<0||requestedT>Math.min(3,tCount-1))throw Error('Temperaturpolynomordnung muss zwischen 0 und '+(tCount-1)+' liegen');
  if(fitMode==='tk0'&&(requestedS!==1||requestedT!==1))
    throw Error('TK0 mit 3 Punkten benötigt Druck linear und Temperatur linear');
   if((fitMode==='tk0'?3:(requestedS+1)*(requestedT+1))>points.length)
    throw Error('Zu wenig Messpunkte für die gewählte Polynomordnung');
  const n=Number(spec.samples??12);
  if(!Number.isInteger(n)||n<1||n>100)throw Error('Pro Messpunkt 1 bis 100 Samples zulässig');
  const outputLimit=Number(spec.outputLimit??32000);
  if(!Number.isInteger(outputLimit)||outputLimit<1000||outputLimit>32000)throw Error('DSP-Zielbereich zwischen ±1’000 und ±32’000 Digits wählen');
  const unit=String(spec.unit??'%');
  if(!['bar','mbar','kPa','psi','%','custom'].includes(unit))throw Error('Ungültige Druckeinheit');
  return Object.freeze({pCount,tCount,total:points.length,pmin,pmax,unit,
   tempComp:requestedT>0,fitMode,temperatures,pressureValues,orderS:requestedS,orderT:requestedT,
   samples:n,outputLimit,points:Object.freeze(points)});
 }
 /** Classic cards and guided measurements use the same physical capture order:
  * all pressure points at one temperature, then the next temperature level.
  * Keep slot identity unchanged; this function only sorts display references. */
 function sortReferences(items){
  if(!Array.isArray(items))throw Error('Messpunktliste fehlt');
  const cmp=(a,b)=>{
   const av=Number.isFinite(Number(a))?Number(a):Infinity;
   const bv=Number.isFinite(Number(b))?Number(b):Infinity;
   return av===bv?0:av<bv?-1:1;
  };
  return items.slice().sort((a,b)=>cmp(a.temperature,b.temperature)||cmp(a.pressure,b.pressure)||(a.originalIndex??0)-(b.originalIndex??0));
 }
 /** Compare two actually recorded references. Never confuse a temperature
  * drift at fixed pressure with the pressure span at fixed temperature. */
 function captureDelta(entries,index){
  const entry=entries[index],value=Number(entry?.record?.adc_s);
  if(!entry?.record||!Number.isFinite(value))return null;
  const sameTemperature=(a,b)=>Math.abs(Number(a.temperature)-Number(b.temperature))<=0.5;
  const samePressure=(a,b)=>Math.abs(Number(a.pressure)-Number(b.pressure))<=1e-6;
  for(const kind of ['pressure','temperature']){
   for(let j=index-1;j>=0;j--){
    const previous=entries[j];
    if(!previous?.record||!Number.isFinite(previous.record.adc_s))continue;
    const valid=kind==='pressure'?
     sameTemperature(entry.point,previous.point)&&!samePressure(entry.point,previous.point):
     samePressure(entry.point,previous.point)&&!sameTemperature(entry.point,previous.point);
    if(!valid)continue;
    return {kind,fromIndex:j,toIndex:index,
     digits:value-previous.record.adc_s,
     adcTDelta:Number.isFinite(entry.record.adc_t)&&Number.isFinite(previous.record.adc_t)?
      entry.record.adc_t-previous.record.adc_t:null,
     fromPressure:previous.point.pressure,toPressure:entry.point.pressure,
     fromTemperature:previous.point.temperature,toTemperature:entry.point.temperature};
   }
  }
  return null;
 }
 // Calculate end-to-end raw ADC spans from measured references only.
 function captureSpans(entries){
  const valid=entries.map((e,index)=>({index,record:e.record}))
   .filter(e=>e.record&&Number.isFinite(e.record.pressure)&&Number.isFinite(e.record.temperature));
  const out=[];
  for(const kind of ['pressure','temperature']){
   const fixed=kind==='pressure'?'temperature':'pressure',vary=kind==='pressure'?'pressure':'temperature';
   const channel=kind==='pressure'?'adc_s':'adc_t',tolerance=kind==='pressure'?0.5:1e-6;
   const groups=[];
   for(const e of valid){
    if(!Number.isFinite(e.record[channel]))continue;
    let group=groups.find(g=>g.every(x=>Math.abs(x.record[fixed]-e.record[fixed])<=tolerance));
    if(!group){group=[];groups.push(group)}
    group.push(e);
   }
   for(const group of groups){
    group.sort((a,b)=>a.record[vary]-b.record[vary]||a.index-b.index);
    const lo=group[0],hi=group[group.length-1];
    if(hi.record[vary]-lo.record[vary]<=(kind==='pressure'?1e-6:0.5))continue;
    const delta=hi.record[channel]-lo.record[channel];
    out.push({kind,channel,fixed:lo.record[fixed],from:lo.record[vary],to:hi.record[vary],fromIndex:lo.index,toIndex:hi.index,delta,span:Math.abs(delta),rawMin:Math.min(lo.record[channel],hi.record[channel]),rawMax:Math.max(lo.record[channel],hi.record[channel])});
   }
  }
  return out;
 }
 // Compare spans only over equal physical intervals, not incomplete ranges.
 function summarizeSpans(spans){
  const groups=[];
  for(const s of spans){
   const tolerance=s.kind==='pressure'?1e-6:0.5;
   let group=groups.find(g=>g.kind===s.kind&&g.items.every(x=>Math.abs(x.from-s.from)<=tolerance&&Math.abs(x.to-s.to)<=tolerance));
   if(!group){group={kind:s.kind,from:s.from,to:s.to,items:[]};groups.push(group)}
   group.items.push(s);
  }
  return groups.filter(g=>g.items.length>1).map(g=>{
   const values=g.items.map(x=>x.span),min=Math.min(...values),max=Math.max(...values);
   return {kind:g.kind,from:g.from,to:g.to,count:values.length,min,max,delta:max-min};
  });
 }
 return {create,presets,captureDelta,captureSpans,summarizeSpans,sortReferences};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_GUIDED_PLAN;
