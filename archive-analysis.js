'use strict';
/* Read-only, hardware-independent visual archive summaries and comparisons. */
const ELMOS_ARCHIVE_ANALYSIS=(()=>{
 const channels=['dspS','adcS','adcT','adcTC','dspT'];
 const descriptors={calibration:'Kalibrierung',verification:'Nachmessung',testlog:'Test / Logging',output:'Ausgang'};
 const statuses={completed:'Abgeschlossen',failed:'Fehlerhaft',incomplete:'Unvollständig',
  aborted:'Abgebrochen',interrupted:'Unterbrochen',running:'Offen'};
 const number=x=>typeof x==='number'&&Number.isFinite(x);
 function stats(samples,key){
  let count=0,mean=0,m2=0,min=Infinity,max=-Infinity;
  for(const obj of samples){
   const value=obj?.[key];
   if(!number(value))continue;
   count++;const delta=value-mean;mean+=delta/count;m2+=delta*(value-mean);
   min=Math.min(min,value);max=Math.max(max,value);
  }
  return {count,min:count?min:null,max:count?max:null,mean:count?mean:null,
   stddev:count>1?Math.sqrt(m2/(count-1)):count===1?0:null};
 }
 function rowSamples(rows){
  const result=[];
  for(const row of rows||[])for(const sample of row.samples||[])result.push(sample);
  return result;
 }
 function trend(rows,key='dspS',maxPoints=140){
  const valid=(rows||[]).map((p,i)=>{
   const from=p.aggregated?.channels?.[key];
   const fallback=p.sensorSnapshot?.[key]??p.samples?.at(-1)?.[key];
   const val=number(from)?from:fallback;
   return {index:i,value:val,time:p.endedAt||p.startedAt};
  }).filter(p=>number(p.value));
  if(valid.length<=maxPoints)return valid;
  const sampled=[];
  for(let i=0;i<maxPoints;i++)sampled.push(valid[Math.round(i*(valid.length-1)/(maxPoints-1))]);
  return sampled;
 }
 function overview(record,rows=null){
  if(!record)return null;
  const events=record.events||[];
  const durationMs=record.endedAt?Date.parse(record.endedAt)-Date.parse(record.startedAt):null;
  const errors=events.filter(e=>e.kind==='error').length+(record.type==='testlog'?(record.telemetry?.readErrors||0):0);
  const attempts=events.filter(e=>e.kind==='measurement'||e.kind==='verification_attempt');
  const failedAttempts=attempts.filter(e=>(e.data?.pass??e.pass)===false).length;
  const telemetry=record.telemetry||{};
  const isLog=record.type==='testlog';
  const chipRegister=record.initial?.ram?.words?.['0x38']??record.final?.ram?.words?.['0x38'];
  const chipVersionRegister=Number.isInteger(chipRegister)&&chipRegister>=0&&chipRegister<=65535?
   '0x'+chipRegister.toString(16).padStart(4,'0').toUpperCase():null;
  const summary={
   id:record.id,type:record.type,title:isLog?(record.testConfiguration?.name||'Unbenannter Sensortest'):
    (descriptors[record.type]||record.type),
   status:record.status||'running',startedAt:record.startedAt,endedAt:record.endedAt,
   chipUID:record.chipUID||null,userID:record.customUID||record.initial?.configuredUserId||null,
   board:record.equipment?.adapter||null,
   // Legacy equipment.firmware is the SSP3/USB bridge firmware from the adapter .VERSION handshake.
   // It is NOT an E703.11 sensor firmware version.
   adapterFirmware:record.equipment?.adapterFirmware||record.equipment?.firmware||null,
   chipVersionRegister,
   appVersion:record.software?.version||null,description:record.testConfiguration?.description||null,
   category:record.testConfiguration?.category||null,operator:record.testConfiguration?.operator||null,
   dutName:record.testConfiguration?.dutName||record.dutName||null,
   durationMs:number(durationMs)&&durationMs>=0?durationMs:null,
   measurementPoints:isLog?telemetry.groups||0:attempts.length,
   rawSamples:isLog?telemetry.individualSamples||0:events.reduce((n,e)=>n+
    (e.kind==='calibration_point'?(e.data?.point?.rawSamples?.length||0):0),0),
   errors,failedAttempts,missedSlots:telemetry.missedSlots||0,
   intervalMs:record.testConfiguration?.intervalMs??null,
   groupSize:record.testConfiguration?.samplesPerPoint??null,
   aggregation:record.testConfiguration?.aggregation??null,
   targetDurationMs:record.testConfiguration?.durationMs??null,
   statusLabel:statuses[record.status]||record.status||'Offen',
   typeLabel:descriptors[record.type]||record.type
  };
  if(isLog&&Array.isArray(rows)){
   const samples=rowSamples(rows);
   summary.metrics=Object.fromEntries(channels.map(k=>[k,stats(samples,k)]));
   summary.trend=trend(rows);
   summary.measurementPoints=rows.length;
   summary.rawSamples=samples.length;
  }else summary.metrics=null;
  return summary;
 }
 function nvmDifferences(left,right){
  const a=left?.final?.nvm?.words||left?.initial?.nvm?.words;
  const b=right?.final?.nvm?.words||right?.initial?.nvm?.words;
  if(!Array.isArray(a)||a.length!==64||!Array.isArray(b)||b.length!==64)return null;
  return a.map((before,index)=>({index,before,after:b[index]})).filter(p=>p.before!==p.after);
 }
 function compare(a,b,aRows=null,bRows=null){
  if(!a||!b)throw Error('Zwei Archivdateien erforderlich');
  const left=overview(a,aRows),right=overview(b,bRows);
  const difference=nvmDifferences(a,b);
  const metrics=left.metrics&&right.metrics?
   channels.map(key=>({key,left:left.metrics[key],right:right.metrics[key],
    delta:number(left.metrics[key]?.mean)&&number(right.metrics[key]?.mean)?
      right.metrics[key].mean-left.metrics[key].mean:null})):null;
  return {left,right,metrics,nvmChanges:difference,identicalUID:!!left.chipUID&&left.chipUID===right.chipUID};
 }
 return {channels,descriptors,statuses,stats,rowSamples,trend,overview,nvmDifferences,compare};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_ARCHIVE_ANALYSIS;
if(typeof window!=='undefined')window.ELMOS_ARCHIVE_ANALYSIS=ELMOS_ARCHIVE_ANALYSIS;
