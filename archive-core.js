'use strict';
/* Pure, hardware-independent archive/verification utilities. */
const ELMOS_ARCHIVE_CORE=(()=>{
 const FORMAT='elmos-e70311-record', VERSION=1;
 const asNumber=v=>v===''||v==null?NaN:Number(v);
 function points(text,field){
  const list=Array.isArray(text)?text:String(text??'').trim().split(/[;,\s]+/);
  const arr=list.map(asNumber);
  if(!arr.length||arr.some(n=>!Number.isFinite(n)))throw Error(field+': Bitte Zahlen mit Punkt als Dezimaltrennzeichen eingeben.');
  if(arr.length>100)throw Error(field+': maximal 100 Werte pro Rampe.');
  return arr;
 }
 function direction(values,i){
  if(values.length<2)return 'constant';
  for(let k=i;k>0;k--){const delta=values[k]-values[k-1];if(delta)return delta>0?'up':'down'}
  for(let k=i+1;k<values.length;k++){const delta=values[k]-values[k-1];if(delta)return delta>0?'up':'down'}
  return 'constant';
 }
 function makePlan(input){
  const mode=input.mode||'combined';
  if(!['pressure','temperature','combined'].includes(mode))throw Error('Unbekannte Prüfart');
  const cycles=Number(input.cycles??1);
  if(!Number.isInteger(cycles)||cycles<1||cycles>30)throw Error('Zyklen: ganze Zahl von 1 bis 30');
  const pressure=mode==='temperature'?[asNumber(input.fixedPressure)]:points(input.pressure,'Druckrampe');
  const temperature=mode==='pressure'?[asNumber(input.fixedTemperature)]:points(input.temperature,'Temperaturrampe');
  if(pressure.some(x=>!Number.isFinite(x))||temperature.some(x=>!Number.isFinite(x)))throw Error('Fixe Referenz ungültig');
  const steps=[];
  for(let cycle=0;cycle<cycles;cycle++){
   for(let ti=0;ti<temperature.length;ti++){
    for(let pi=0;pi<pressure.length;pi++){
     steps.push({index:steps.length,cycle:cycle+1,pressure:pressure[pi],temperature:temperature[ti],
      pressureDirection:mode==='temperature'?'constant':direction(pressure,pi),
      temperatureDirection:mode==='pressure'?'constant':direction(temperature,ti),
      temperatureIndex:ti,pressureIndex:pi});
    }
   }
  }
  if(steps.length>3000)throw Error('Maximal 3000 Messpunkte pro Prüfplan');
  return {mode,cycles,pressure,temperature,steps};
 }
 function valid(record){
  return !!record&&record.format===FORMAT&&record.schemaVersion===VERSION&&
   typeof record.id==='string'&&record.id.length>=8&&
   ['calibration','verification','output'].includes(record.type)&&
   Array.isArray(record.events)&&typeof record.startedAt==='string';
 }
 function filename(record){
  const stamp=(record.startedAt||'').replace(/[-:]/g,'').replace(/[.Z]/g,'').replace('T','_').slice(0,15);
  const uid=String(record.chipUID||'UNKNOWN').replace(/[^a-z0-9]/gi,'').slice(0,24)||'UNKNOWN';
  const id=String(record.id||'').replace(/[^a-z0-9-]/gi,'').slice(0,36);
  return 'ELMOS_'+stamp+'_'+uid+'_'+id+'.json';
 }
 function lastAttempt(record,stepIndex){
  const attempts=(record.events||[]).filter(e=>e.kind==='measurement'&&e.stepIndex===stepIndex);
  return attempts.filter(e=>e.pass===true).at(-1)||attempts.at(-1)||null;
 }
 function hysteresis(record){
  const plan=record.plan,steps=plan?.steps||[];
  const pairs=[],attempts=steps.map(s=>({step:s,result:lastAttempt(record,s.index)})).filter(x=>x.result?.sample);
  for(const axis of ['pressure','temperature']){
   const map=new Map();
   for(const {step,result} of attempts){
    const dir=axis==='pressure'?step.pressureDirection:step.temperatureDirection;
    if(dir!=='up'&&dir!=='down')continue;
    const other=axis==='pressure'?step.temperature:step.pressure;
    const value=axis==='pressure'?step.pressure:step.temperature;
    const key=String(step.cycle)+'|'+String(other)+'|'+String(value)+'|'+
     (axis==='pressure'?String(step.temperatureIndex):'all');
    const data=map.get(key)||{axis,cycle:step.cycle,temperatureStage:step.temperatureIndex,
     reference:value,other,up:[],down:[]};
    const sample=result.sample;
    const signal=axis==='pressure'?
       (sample.pressureConfidence==='confirmed'&&Number.isFinite(sample.sensorPressure)?{value:sample.sensorPressure,unit:sample.pressureUnit||'bar'}:
        Number.isFinite(sample.dspS)?{value:sample.dspS,unit:'DSP_S Digits'}:null):
       (sample.temperatureConfidence==='confirmed'&&Number.isFinite(sample.sensorTempC)?
         {value:sample.sensorTempC,unit:'°C'}:
        Number.isFinite(sample.dspT)?{value:sample.dspT,unit:'DSP_T Digits'}:
        Number.isFinite(sample.adcT)?{value:sample.adcT,unit:'ADC_T Digits'}:null);
    if(signal)data[dir].push(signal);
    map.set(key,data);
   }
   for(const item of map.values()){
    if(!item.up.length||!item.down.length)continue;
    const up=item.up.at(-1),down=item.down.at(-1);
    if(up.unit!==down.unit)continue;
    const delta=down.value-up.value;
    const span=axis==='pressure'?Math.max(...plan.pressure)-Math.min(...plan.pressure):null;
    const percentTestSpan=axis==='pressure'&&up.unit!=='DSP_S Digits'&&span>0?
      Math.abs(delta)/span*100:null;
    pairs.push({axis,cycle:item.cycle,temperatureStage:item.temperatureStage,
      reference:item.reference,other:item.other,ascending:up.value,descending:down.value,
      delta,absolute:Math.abs(delta),unit:up.unit,percentTestSpan});
   }
  }
  return {pairs,maxPressure:pairs.filter(x=>x.axis==='pressure').reduce((m,p)=>Math.max(m,p.absolute),0),
   maxTemperature:pairs.filter(x=>x.axis==='temperature').reduce((m,p)=>Math.max(m,p.absolute),0)};
 }
 function outcomes(record){
  const all=(record.events||[]).filter(e=>e.kind==='measurement');
  const failed=all.filter(e=>e.pass===false), errors=(record.events||[]).filter(e=>e.kind==='error');
  const latest=(record.plan?.steps||[]).map(s=>lastAttempt(record,s.index));
  return {total:all.length,failed:failed.length,errors:errors.length,repeated:Math.max(0,all.length-latest.filter(Boolean).length),
   measured:latest.filter(Boolean).length,planned:latest.length,
   status:record.status||'running'};
 }
 return {FORMAT,VERSION,points,direction,makePlan,valid,filename,lastAttempt,hysteresis,outcomes};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_ARCHIVE_CORE;
if(typeof window!=='undefined')window.ELMOS_ARCHIVE_CORE=ELMOS_ARCHIVE_CORE;
