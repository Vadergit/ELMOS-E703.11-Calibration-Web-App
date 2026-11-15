'use strict';
/* Lossless, schema-independent CSV export for every local E703.11 archive record.
   The long-form layout preserves every JSON leaf, including NVM arrays, events,
   telemetry aggregates, individual raw samples, errors and debug lines.
   It does not assume that different archive record types share column names. */
const ELMOS_ARCHIVE_EXPORT=(()=>{
 const columns=['Bereich','Datensatz','Protokoll-ID','Chip-UID','Messpunkt-Nr',
  'Einzelmessung-Nr','Zeitstempel','Feld','Wert'];
 function quote(value){
  let str=value===null?'null':value===undefined?'':String(value);
  // Protect Excel/LibreOffice from CSV formula injection, without changing typed numbers.
  if(typeof value==='string'&&/^[\s\uFEFF]*[=+\-@\t\r]/.test(str)&&
   !/^-\d+(?:\.\d+)?(?:e[+\-]?\d+)?$/i.test(str))str="'"+str;
  return '"'+str.replace(/"/g,'""')+'"';
 }
 function csvAll(record,telemetryRows=[]){
  if(!record||typeof record!=='object')throw Error('Archivprotokoll fehlt');
  if(record.type==='testlog'&&!Array.isArray(telemetryRows))
   throw Error('Telemetrie-Daten fehlen');
  const lines=[columns.map(quote).join(',')];
  const id=record.id||'',uid=record.chipUID||'';
  const put=(area,kind,point,sample,at,path,value)=>{
   lines.push([area,kind,id,uid,point??'',sample??'',at||'',path,value].map(quote).join(','));
  };
  const flatten=(value,path,area,kind,point,sample,at)=>{
   if(value===null||typeof value!=='object'){
    put(area,kind,point,sample,at,path,value);
    return;
   }
   const array=Array.isArray(value);
   const keys=Object.keys(value);
   if(!keys.length){
    put(area,kind,point,sample,at,path,array?'[]':'{}');
    return;
   }
   for(const key of keys){
    if(!array&&key==='__proto__')continue;
    const next=array?path+'['+key+']':path+'.'+key;
    flatten(value[key],next,area,kind,point,sample,at);
   }
  };
  const metadata={};
  for(const [key,value] of Object.entries(record)){
   // This property is an in-memory file picker attribute, not original metadata.
   if(['events','_archiveName'].includes(key))continue;
   metadata[key]=value;
  }
  flatten(metadata,'$','Protokoll','Metadaten',null,null,record.startedAt||'');
  for(let i=0;i<(record.events||[]).length;i++){
   const entry=record.events[i];
   flatten(entry,'$','Ereignis',entry?.kind||'Ereignis',i+1,null,entry?.at||'');
  }
  for(let i=0;i<telemetryRows.length;i++){
   const row=telemetryRows[i],point=row?.index??(i+1);
   if(!row||typeof row!=='object')throw Error('Ungültiger Telemetrie-Datensatz '+(i+1));
   const groupTime=row.endedAt||row.startedAt||row.scheduledAt||'';
   const group={};
   for(const [key,value] of Object.entries(row)){
    if(key==='samples'||key==='transport')continue;
    group[key]=value;
   }
   flatten(group,'$','Messpunkt','Telemetrie',point,null,groupTime);
   for(let j=0;j<(row.samples||[]).length;j++){
    const sample=row.samples[j];
    flatten(sample,'$','Einzelmessung','Rohsample',point,j+1,sample?.at||groupTime);
   }
   for(let j=0;j<(row.transport||[]).length;j++){
    const line=row.transport[j];
    flatten(line,'$','Kommunikation','TX/RX',point,j+1,line?.at||groupTime);
   }
  }
  return '\uFEFF'+lines.join('\r\n')+'\r\n';
 }

 // Human-readable verification CSV: a short metadata block, then one row per
 // measurement attempt (or one empty row for each missing planned point).
 // This is deliberately distinct from the lossless JSON/CSV audit export.
 const pressureUnits={Pa:0.00001,kPa:0.01,MPa:10,mbar:0.001,bar:1,psi:0.0689475729318};
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const format=(x,digits=7)=>finite(x)?String(Number(x.toFixed(digits))):'';
 const localTime=value=>{
  if(!value)return '';
  const d=new Date(value);
  return Number.isNaN(d.getTime())?String(value):d.toLocaleString('de-CH');
 };
 const typeLabel={pressure:'Druck',temperature:'Temperatur',combined:'Druck und Temperatur'};
 const direction=value=>({up:'Steigend',down:'Fallend',constant:'Konstant'})[value]||value||'';
 const stateLabel=value=>({
  completed:'Abgeschlossen',failed:'Fehlgeschlagen',incomplete:'Unvollständig',
  interrupted:'Unterbrochen',aborted:'Abgebrochen',running:'Laufend'
 })[value]||value||'';
 const interfaceLabel=value=>{
  const k=String(value||'').toLowerCase();
  return ['plc','onewire','one-wire','one_wire'].includes(k)?'One-Wire (AODO)':
   ['i2c','i²c'].includes(k)?'I²C':value||'';
 };
 function csvVerification(record){
  if(record?.type!=='verification')throw Error('Nachmessungsprotokoll erforderlich');
  const cfg=record.verificationConfig||{},meta=record.verificationMetadata||{};
  const steps=Array.isArray(record.plan?.steps)?record.plan.steps:[];
  const attempts=(record.events||[]).filter(e=>e.kind==='measurement').map(e=>({
   event:e,data:e.data||{}
  }));
  const fullScale=finite(cfg.pressureSpan)&&cfg.pressureSpan>0?cfg.pressureSpan:
   finite(cfg.calibrationMin)&&finite(cfg.calibrationMax)&&cfg.calibrationMax>cfg.calibrationMin?
   cfg.calibrationMax-cfg.calibrationMin:null;
  const unit=cfg.pressureUnit||attempts.find(a=>a.data.pressureUnit)?.data.pressureUnit||'';
  const isPressure=(record.plan?.mode||'pressure')!=='temperature';
  const isTemperature=(record.plan?.mode||'pressure')!=='pressure';
  const isCombined=isPressure&&isTemperature;
  const hasTemperature=steps.some(s=>finite(s.temperature))||attempts.some(a=>finite(a.data.referenceTemperature));
  const hasAssessment=cfg.toleranceEnabled===true||attempts.some(a=>a.data.toleranceApplied===true);
  const emit=a=>a.map(quote).join(';');
  const lines=[emit(['Nachmessung – Prüfprotokoll'])];
  const metadata=[
   ['Sensor-UID',record.chipUID],['Protokoll-ID',record.id],
   ['Prüfart',typeLabel[record.plan?.mode]||record.plan?.mode],
   ['Prüfer',meta.operator],['Auftrag / Projekt',meta.project],
   ['Prüfstand',meta.location],['Prüfmittel / Zertifikatsreferenz',meta.instrumentCertificate],
   ['Beginn',localTime(record.startedAt)],['Ende',localTime(record.endedAt)],
   ['Archivstatus',stateLabel(record.status)],
   ['Kalibrierter Druckbereich',isPressure&&finite(cfg.calibrationMin)&&finite(cfg.calibrationMax)?
    format(cfg.calibrationMin)+' bis '+format(cfg.calibrationMax)+' '+unit:null],
   ['Prüfpunkte eingegeben als',isPressure?(cfg.pressureEntryMode==='percent'?'% der Messspanne':unit):null],
   ['Sensor-/Referenzdruckart',isPressure&&cfg.sensorType&&cfg.referenceKind&&
    (cfg.sensorType!=='gauge'||cfg.referenceKind!=='gauge')?
    (cfg.sensorType==='absolute'?'Absolutdruck':'Relativdruck')+' / '+
    (cfg.referenceKind==='absolute'?'Absolutdruck':'Relativdruck'):null],
   ['Umgebungsdruck',cfg.correctionApplied&&finite(cfg.ambientPressure)?
    format(cfg.ambientPressure)+' '+unit:null],
   ['Toleranzbewertung',hasAssessment?
    (finite(cfg.pressureTolerancePercent)?'±'+format(cfg.pressureTolerancePercent,4)+' % FS':'Aktiv'):'Nicht aktiviert'],
   ['Kalibrierwerkzeug',record.calibrationTool?.application],
   ['Adapter',record.calibrationTool?.communicationAdapter||record.equipment?.adapter],
   ['Kommunikation',interfaceLabel(record.calibrationTool?.interface||record.equipment?.interface)],
   ['Bemerkungen',meta.notes]
  ];
  for(const [name,value] of metadata){
   if(value!==null&&value!==undefined&&String(value).trim()!=='')
    lines.push(emit([name,value]));
  }
  lines.push('');
  const cols=['Punkt','Zyklus','Richtung','Versuch','Zeitpunkt'];
  if(isCombined)cols.splice(3,0,'Temp.-Richtung');
  if(isPressure)cols.push('Soll ['+unit+']','Referenz ['+unit+']',
    'Sensorwert ['+unit+']','Abweichung ['+unit+']','Abweichung [% FS]');
  if(isTemperature)cols.push('Solltemp. [°C]','Ref.temp. [°C]',
    'Sensortemp. [°C]','Abweichung [°C]');
  else if(hasTemperature)cols.push('Prüftemp. [°C]');
  cols.push('Samples');
  if(hasAssessment)cols.push('Bewertung');
  lines.push(emit(cols));
  function pressureValue(sample,data){
   if(!finite(sample?.sensorPressure))return null;
   const source=sample.pressureUnit||data.pressureUnit||unit;
   if(source===unit)return sample.sensorPressure;
   if(pressureUnits[source]&&pressureUnits[unit])
    return sample.sensorPressure*pressureUnits[source]/pressureUnits[unit];
   return null;
  }
  function writePoint(step,index,entry){
   const data=entry?.data||{},sample=data.sample||{};
   const actual=pressureValue(sample,data);
   const reference=finite(data.referencePressure)?data.referencePressure:
    finite(step?.pressure)?step.pressure:null;
   const target=finite(step?.pressure)?step.pressure:reference;
   // An available saved discrepancy takes priority over the display-value
   // fallback. Missing calibration confidence does not create a pass verdict.
   const diff=finite(data.pressureError)?data.pressureError:
    finite(actual)&&finite(reference)?actual-reference:null;
   const deviation=finite(diff)&&fullScale>0?diff/fullScale*100:null;
   const dt=finite(data.referenceTemperature)?data.referenceTemperature:
    finite(step?.temperature)?step.temperature:null;
   const row=[index+1,step?.cycle??data.setpoint?.cycle??'',
    direction(isTemperature&&!isPressure?step?.temperatureDirection:step?.pressureDirection)];
   if(isCombined)row.push(direction(step?.temperatureDirection));
   row.push(data.attempt??'',localTime(sample.at||entry?.event?.at));
   if(isPressure)row.push(format(target),format(reference),format(actual),
     format(diff),format(deviation,6));
   if(isTemperature){
    const temp=finite(sample.sensorTempC)?sample.sensorTempC:null;
    const tempErr=finite(data.temperatureError)?data.temperatureError:
     finite(temp)&&finite(dt)?temp-dt:null;
    row.push(format(step?.temperature),format(dt),format(temp),format(tempErr));
   }else if(hasTemperature)row.push(format(dt));
   row.push(sample.count??sample.samples?.length??'');
   if(hasAssessment)row.push(!entry?'Nicht gemessen':
    data.toleranceApplied===false?'Ohne Bewertung':
    data.pass===true?'Bestanden':data.pass===false?'Ausser Toleranz':'Nicht bewertet');
   lines.push(emit(row));
  }
  const consumed=new Set(),byStep=new Map();
  for(let i=0;i<attempts.length;i++){
   const index=attempts[i].data.stepIndex;
   if(!Number.isInteger(index)||index<0)continue;
   if(!byStep.has(index))byStep.set(index,[]);
   byStep.get(index).push(i);
  }
  for(let i=0;i<steps.length;i++){
   const indices=byStep.get(i)||[];
   if(!indices.length)writePoint(steps[i],i,null);
   for(const index of indices){
    consumed.add(index);writePoint(steps[i],i,attempts[index]);
   }
  }
  for(let i=0;i<attempts.length;i++){
   if(consumed.has(i))continue;
   const x=attempts[i],index=Number.isInteger(x.data.stepIndex)&&x.data.stepIndex>=0?
    x.data.stepIndex:steps.length+i;
   writePoint(x.data.setpoint||null,index,x);
  }
  return '\uFEFF'+lines.join('\r\n')+'\r\n';
 }
 return {columns,csvAll,csvVerification};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_ARCHIVE_EXPORT;
if(typeof window!=='undefined')window.ELMOS_ARCHIVE_EXPORT=ELMOS_ARCHIVE_EXPORT;
