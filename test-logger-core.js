'use strict';
/* Pure, hardware-independent sensor test logger rules. */
const ELMOS_TEST_LOGGER_CORE=(()=>{
 const FIELDS=['adcS','adcT','adcTC','dspS','dspT','statusSync','chipStatus'];
 const NUMERIC_CHANNELS=['adcS','adcT','adcTC','dspS','dspT'];
 const MODES=['none','mean','median'];
 function durationMs(value,unit='s'){
  const factors={s:1000,min:60000,h:3600000};
  if(!Object.prototype.hasOwnProperty.call(factors,unit))throw Error('Ungültige Einheit für Testdauer.');
  if(value===null||value===undefined||String(value).trim()==='')throw Error('Testdauer fehlt.');
  const amount=Number(value);
  if(!Number.isFinite(amount)||amount<0)throw Error('Testdauer muss eine positive Zahl oder 0 für unbegrenzt sein.');
  if(amount===0)return null;
  const ms=Math.round(amount*factors[unit]);
  if(!Number.isSafeInteger(ms)||ms<100||ms>30*24*3600*1000)
   throw Error('Testdauer muss zwischen 0.1 Sekunden und 30 Tagen liegen.');
  return ms;
 }
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
   // Status words are bitfields: never average or median arbitrary bit patterns.
   if(mode==='none'||!NUMERIC_CHANNELS.includes(k)){values[k]=null;continue}
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
 function csvRows(points,metadata={}){
  const cols=['kind','pointIndex','sampleIndex','sampleAt','scheduledAt','startedAt','endedAt',
   'durationMs','lagMs','skippedIntervals','sampleCount','aggregation',
   ...FIELDS,'configuredVdd','measuredVdd','testName','dutName','chipUID'];
  const quote=x=>{
   let s=x==null?'':typeof x==='object'?JSON.stringify(x):String(x);
   // Prevent formula execution if CSV data are opened in a spreadsheet.
   if(/^[\s]*[=+\-@]/.test(s)&&!/^-\d+(\.\d+)?(?:e[+-]?\d+)?$/i.test(s))s="'"+s;
   return '"'+s.replace(/"/g,'""')+'"';
  };
  const rows=[cols.map(quote).join(',')];
  for(const p of points){
   const common=[p.index,null,null,p.scheduledAt,p.startedAt,p.endedAt,p.durationMs,
    p.lagMs,p.skippedIntervals,p.samples?.length,p.aggregation];
   const voltage=[p.supply?.externalVdd?.configuredV??null,p.supply?.externalVdd?.measuredV??null];
   const identity=[metadata.name||null,metadata.dutName||null,metadata.chipUID||null];
   if(p.aggregation!=='none'){
    rows.push(['aggregate',p.index,null,null,...common.slice(3),
     ...FIELDS.map(k=>p.aggregated?.channels?.[k]??null),...voltage,...identity].map(quote).join(','));
   }
   for(let i=0;i<(p.samples?.length||0);i++){
    const sample=p.samples[i];
    rows.push(['raw',p.index,i+1,sample.at,...common.slice(3),
     ...FIELDS.map(k=>sample[k]??null),...voltage,...identity].map(quote).join(','));
   }
  }
  return rows.join('\n');
 }

 return {FIELDS,settings,aggregate,scheduleNext,csvRows,durationMs};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_TEST_LOGGER_CORE;
if(typeof window!=='undefined')window.ELMOS_TEST_LOGGER_CORE=ELMOS_TEST_LOGGER_CORE;
