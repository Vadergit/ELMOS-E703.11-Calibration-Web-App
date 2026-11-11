'use strict';
/* Pure, tested guide-planning utilities. No hardware I/O and no NVM writes.
 * A temperature level is a physical reference condition, NOT merely a new DSP order.
 */
const ELMOS_GUIDED_PLAN=(()=>{
 const number=(value,label)=>{const n=Number(value);if(!Number.isFinite(n))throw Error(label+' muss eine gültige Zahl sein');return n};
 const rounded=x=>Number(x.toFixed(6));
 const presets=Object.freeze({
  quick:{label:'Schnellabgleich',pCount:2,tCount:1,complex:false,tempComp:false},
  temperature:{label:'Mit Temperatur',pCount:2,tCount:3,complex:false,tempComp:true},
  custom:{label:'Individuell',pCount:3,tCount:2,complex:true,tempComp:true}
 });
 function create(spec={}){
  const pCount=Number(spec.pCount??2),tCount=Number(spec.tCount??1),pmin=number(spec.pmin??0,'Unterer Druck'),pmax=number(spec.pmax??10,'Oberer Druck');
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
   const position=points.length;
   const slot=position===0?'lo':position===pCount*tCount-1?'hi':'extra'+position;
   points.push({index:position,slot,pressureIndex:i,temperatureIndex:j,
    pressure:pressureValues[i],temperature:temperatures[j],
    label:'T'+(j+1)+' / P'+(i+1),title:'Temperatur '+(j+1)+' · Druck '+(i+1)});
  }
  const requestedS=spec.orderS===undefined?Math.min(3,pCount-1):Number(spec.orderS);
  const requestedT=spec.orderT===undefined?tCount-1:Number(spec.orderT);
  if(!Number.isInteger(requestedS)||requestedS<1||requestedS>Math.min(3,pCount-1))throw Error('Druckpolynomordnung muss zwischen 1 und '+Math.min(3,pCount-1)+' liegen');
  if(!Number.isInteger(requestedT)||requestedT<0||requestedT>Math.min(3,tCount-1))throw Error('Temperaturpolynomordnung muss zwischen 0 und '+(tCount-1)+' liegen');
  if((requestedS+1)*(requestedT+1)>points.length)throw Error('Zu wenig Messpunkte für die gewählte Polynomordnung');
  const n=Number(spec.samples??12);
  if(!Number.isInteger(n)||n<1||n>100)throw Error('Pro Messpunkt 1 bis 100 Samples zulässig');
  const outputLimit=Number(spec.outputLimit??25000);
  if(!Number.isInteger(outputLimit)||outputLimit<1000||outputLimit>32000)throw Error('DSP-Zielbereich zwischen ±1’000 und ±32’000 Digits wählen');
  const unit=String(spec.unit??'bar');
  if(!['bar','mbar','kPa','psi','%','custom'].includes(unit))throw Error('Ungültige Druckeinheit');
  return Object.freeze({pCount,tCount,total:points.length,pmin,pmax,unit,
   tempComp:requestedT>0,temperatures,pressureValues,orderS:requestedS,orderT:requestedT,
   samples:n,outputLimit,points:Object.freeze(points)});
 }
 return {create,presets};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_GUIDED_PLAN;
