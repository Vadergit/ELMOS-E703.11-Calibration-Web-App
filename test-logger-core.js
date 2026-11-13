'use strict';
/* Pure, hardware-independent sensor test logger rules. */
const ELMOS_TEST_LOGGER_CORE=(()=>{
 const FIELDS=['adcS','adcT','adcTC','dspS','dspT','statusSync'];
 const MODES=['none','mean','median'];
 function settings(input){
  const intervalMs=Number(input.intervalMs),samplesPerPoint=Number(input.samplesPerPoint),
   sampleSpacingMs=Number(input.sampleSpacingMs??0),aggregation=String(input.aggregation||'none');
  if(!Number.isInteger(intervalMs)||intervalMs<1||intervalMs>3600000)
   throw Error('Messintervall muss eine ganze Zahl zwischen 1 und 3’600’000 ms sein.');
  if(!Number.isInteger(samplesPerPoint)||samplesPerPoint<1||samplesPerPoint>100)
   throw Error('Einzelmessungen pro Messpunkt: 1 bis 100.');
  if(!Number.isInteger(sampleSpacingMs)||sampleSpacingMs<0||sampleSpacingMs>60000)
   throw Error('Abstand zwischen Einzelmessungen: 0 bis 60’000 ms.');
  if(!MODES.includes(aggregation))throw Error('Unbekannte Mittelwertbildung.');
  return {intervalMs,samplesPerPoint,sampleSpacingMs,aggregation,
   debug:input.debug===true};
 }
 function aggregate(samples,mode='none'){
  if(!MODES.includes(mode))throw Error('Unbekannte Mittelwertbildung.');
  const values={};
  for(const k of FIELDS){
   const numeric=samples.map(x=>x?.[k]).filter(x=>typeof x==='number'&&Number.isFinite(x));
   if(!numeric.length){values[k]=null;continue}
   if(mode==='none'){values[k]=null;continue}
   if(mode==='mean')values[k]=numeric.reduce((a,b)=>a+b,0)/numeric.length;
   else{
    numeric.sort((a,b)=>a-b);const i=Math.floor(numeric.length/2);
    values[k]=numeric.length%2?numeric[i]:(numeric[i-1]+numeric[i])/2;
   }
  }
  return {mode,count:samples.length,channels:values,fieldCounts:Object.fromEntries(FIELDS.map(k=>[
   k,samples.filter(x=>typeof x?.[k]==='number'&&Number.isFinite(x[k])).length
  ]))};
 }
 // Maintain a monotonic target grid without a queue of missed USB transactions.
 function scheduleNext(expectedAt,now,intervalMs){
  if(!Number.isFinite(expectedAt)||!Number.isFinite(now)||!Number.isFinite(intervalMs)||intervalMs<1)
   throw Error('Ungültiger Messzeitplan');
  const skipped=Math.max(0,Math.floor((now-expectedAt)/intervalMs));
  const nextAt=expectedAt+(skipped+1)*intervalMs;
  return {nextAt,skipped,waitMs:Math.max(0,nextAt-now)};
 }
 function csvRows(points){
  const cols=['index','scheduledAt','startedAt','endedAt','durationMs','lagMs','skippedIntervals',
   'samplesCount','aggregation','adcS','adcT','adcTC','dspS','dspT','statusSync',
   'configuredVdd','measuredVdd','note'];
  const quote=x=>{
   let s=x==null?'':typeof x==='object'?JSON.stringify(x):String(x);
   // prevent spreadsheet formula interpretation in exported user text
   if(/^[\s]*[=+\-@]/.test(s)&&!/^-\d+(\.\d+)?$/.test(s))s="'"+s;
   return '"'+s.replace(/"/g,'""')+'"';
  };
  const arr=points.map(p=>{
   const sample=p.aggregated?.channels||{};
   const plain=p.aggregation==='none'&&p.samples?.length===1?p.samples[0]:sample;
   return [p.index,p.scheduledAt,p.startedAt,p.endedAt,p.durationMs,p.lagMs,
    p.skippedIntervals,p.samples?.length,p.aggregation,
    ...FIELDS.map(k=>plain?.[k]??null),
    p.supply?.externalVdd?.configuredV??null,p.supply?.externalVdd?.measuredV??null,p.note??null];
  });
  return [cols.map(quote).join(','),...arr.map(row=>row.map(quote).join(','))].join('\n');
 }
 return {FIELDS,settings,aggregate,scheduleNext,csvRows};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_TEST_LOGGER_CORE;
if(typeof window!=='undefined')window.ELMOS_TEST_LOGGER_CORE=ELMOS_TEST_LOGGER_CORE;
