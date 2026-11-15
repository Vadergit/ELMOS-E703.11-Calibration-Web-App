'use strict';
/* One human-readable CSV per archive record. No RAM/NVM dumps, transport traces
   or cryptic JSON paths; full audit evidence stays in the original JSON/JSONL. */
const ELMOS_READABLE_CSV=(()=>{
 const factor={Pa:0.00001,mbar:0.001,bar:1,kPa:0.01,MPa:10,psi:0.0689475729318};
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const number=(x,n=6)=>finite(x)?String(Number(x.toFixed(n))):'';
 const clean=x=>String(x??'').replace(/[\r\n]+/g,' | ').trim();
 const cell=x=>{
  const numeric=typeof x==='number'&&Number.isFinite(x);
  let t=clean(x);
  if(!numeric&&/^[\s\uFEFF]*[=+\-@]/.test(t)&&
    !/^-\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(t))t="'"+t;
  return '"'+t.replace(/"/g,'""')+'"';
 };
 const line=arr=>arr.map(cell).join(';');
 const date=value=>{
  if(!value)return '';
  const d=new Date(value);
  return Number.isNaN(d.getTime())?clean(value):d.toLocaleString('de-CH');
 };
 const clock=value=>{
  if(!value)return '';
  const d=new Date(value);
  return Number.isNaN(d.getTime())?'':d.toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
 };
 const direction=x=>({up:'Steigend',down:'Fallend',constant:'Konstant'})[x]||x||'';
 const status=x=>({
  completed:'Abgeschlossen',failed:'Fehlgeschlagen',incomplete:'Unvollständig',
  running:'Laufend',interrupted:'Unterbrochen',aborted:'Abgebrochen'
 })[x]||x||'';
 const protocol=x=>{
  const v=String(x||'').toLowerCase();
  return ['plc','onewire','one-wire','one_wire'].includes(v)?'One-Wire (AODO)':
   ['i2c','i²c'].includes(v)?'I²C':x||'';
 };
 const scalar=(obj,keys)=>keys.map(k=>obj?.[k]).find(v=>v!==undefined&&v!==null&&v!=='')??'';
 const meta=(record)=>{
  const config=record.verificationConfig||{},test=record.testConfiguration||{},ver=record.verificationMetadata||{};
  return [
   ['Sensor-UID',record.chipUID],['Produkt / DUT',test.dutName],
   ['Prüfer',ver.operator||test.operator],['Projekt / Auftrag',ver.project],
   ['Prüfstand',ver.location],['Prüfmittel / Zertifikat',ver.instrumentCertificate],
   ['Testname',test.name],['Testbeschreibung',test.description],
   ['Beginn',date(record.startedAt)],['Ende',date(record.endedAt)],
   ['Archivstatus',status(record.status)],
   ['Protokoll-ID',record.id],
   ['Kalibrierwerkzeug',record.calibrationTool?.application],
   ['Adapter',record.calibrationTool?.communicationAdapter||record.equipment?.adapter],
   ['Kommunikation',protocol(record.calibrationTool?.interface||record.equipment?.interface)],
   ['Bemerkungen',ver.notes]
  ];
 };
 function sections(title,headers,data,information){
  const out=[line([title]),'',line(['MESSWERTE']),line(headers)];
  out.push(...data.map(line));
  out.push('',line(['PRÜFANGABEN']));
  for(const [k,v] of information){
   if(v!==undefined&&v!==null&&String(v).trim()!=='')out.push(line([k,v]));
  }
  return '\uFEFF'+out.join('\r\n')+'\r\n';
 }
 function physical(sample,unit){
  if(!sample)return null;
  const value=finite(sample.sensorPressure)?sample.sensorPressure:
   finite(sample.sensorValue)?sample.sensorValue:null;
  if(!finite(value))return null;
  const src=sample.pressureUnit||sample.sensorUnit||unit;
  if(src===unit)return value;
  if(factor[src]&&factor[unit])return value*factor[src]/factor[unit];
  if(src==='%'&&finite(sample.sensorValue))return null; // Unknown origin/range; never guess.
  return null;
 }
 function verification(record){
  if(record?.type!=='verification')throw Error('Nachmessungsprotokoll erforderlich');
  const cfg=record.verificationConfig||{},steps=record.plan?.steps||[];
  const events=(record.events||[]).filter(e=>e.kind==='measurement');
  const mode=record.plan?.mode||'pressure',pMode=mode!=='temperature',tMode=mode!=='pressure';
  const unit=cfg.pressureUnit||events.find(e=>e.data?.pressureUnit)?.data.pressureUnit||'bar';
  const span=finite(cfg.pressureSpan)&&cfg.pressureSpan>0?cfg.pressureSpan:
   finite(cfg.calibrationMin)&&finite(cfg.calibrationMax)?cfg.calibrationMax-cfg.calibrationMin:null;
  const indexed=new Map();
  for(const e of events){
   const index=e.data?.stepIndex;
   if(Number.isInteger(index)&&index>=0){
    if(!indexed.has(index))indexed.set(index,[]);
    indexed.get(index).push(e);
   }
  }
  const all=[...steps.map((step,i)=>({step,index:i,events:indexed.get(i)||[]}))];
  for(const e of events){
   if(Number.isInteger(e.data?.stepIndex)&&e.data.stepIndex>=0&&e.data.stepIndex<steps.length)continue;
   all.push({step:e.data?.setpoint||{},index:Math.max(steps.length,e.data?.stepIndex??steps.length),events:[e]});
  }
  const entries=all.flatMap(({step,index,events:group})=>group.length?
   group.map((event,attempt)=>({step,index,event,attempt:attempt+1})):
   [{step,index,event:null,attempt:null}]);
  const pressureTarget=x=>finite(x.event?.data?.referencePressure)?x.event.data.referencePressure:
   finite(x.step?.pressure)?x.step.pressure:null;
  const hasDifferentTargets=pMode&&entries.some(x=>finite(x.step?.pressure)&&
   finite(x.event?.data?.referencePressure)&&
   Math.abs(x.step.pressure-x.event.data.referencePressure)>1e-9);
  const multipleCycles=entries.some(x=>Number(x.step?.cycle||x.event?.data?.setpoint?.cycle||1)>1);
  const multipleAttempts=entries.some(x=>x.attempt>1||x.event?.data?.attempt>1);
  const pressureDirections=new Set(entries.map(x=>x.step?.pressureDirection).filter(Boolean));
  const tempDirections=new Set(entries.map(x=>x.step?.temperatureDirection).filter(Boolean));
  const showDirection=pMode&&pressureDirections.size>1;
  const showTempDirection=tMode&&tempDirections.size>1;
  const hasTemp=entries.some(x=>finite(x.event?.data?.referenceTemperature)||finite(x.step?.temperature));
  const sampleCounts=[...new Set(entries.filter(x=>x.event).map(x=>
   x.event.data?.sample?.count||x.event.data?.sample?.samples?.length||0).filter(x=>x>0))];
  const showSamples=sampleCounts.length>1;
  const showReview=cfg.toleranceEnabled===true||entries.some(x=>x.event?.data?.toleranceApplied===true);
  const showPending=entries.some(x=>!x.event);
  const headers=['Nr.'];
  if(pMode){
   headers.push(hasDifferentTargets?'Soll ['+unit+']':'Referenz ['+unit+']');
   if(hasDifferentTargets)headers.push('Referenz ['+unit+']');
   headers.push('Sensor ['+unit+']','Abw. ['+unit+']','Abw. [% FS]');
  }
  if(tMode)headers.push('Ref. Temp. [°C]','Sensor Temp. [°C]','Abw. Temp. [°C]');
  else if(hasTemp)headers.push('Temperatur [°C]');
  if(showDirection)headers.push('Druckrichtung');
  if(showTempDirection)headers.push('Temperaturrichtung');
  if(multipleCycles)headers.push('Zyklus');
  if(multipleAttempts)headers.push('Versuch');
  if(showSamples)headers.push('Samples');
  headers.push('Zeit');
  if(showReview)headers.push('Bewertung');
  else if(showPending)headers.push('Hinweis');
  const data=entries.map(x=>{
   const e=x.event,d=e?.data||{},s=d.sample||{};
   const ref=pressureTarget(x);
   const observed=physical(s,unit);
   const saved=finite(d.pressureError)?d.pressureError:null;
   const diff=saved!==null?saved:finite(ref)&&finite(observed)?observed-ref:null;
   const fs=finite(diff)&&finite(span)&&span>0?diff/span*100:null;
   const row=[x.index+1];
   if(pMode){
    row.push(number(hasDifferentTargets&&finite(x.step?.pressure)?x.step.pressure:ref));
    if(hasDifferentTargets)row.push(number(ref));
    row.push(number(observed),number(diff),number(fs,5));
   }
   const temp=finite(d.referenceTemperature)?d.referenceTemperature:x.step?.temperature;
   if(tMode){
    const sensorTemp=finite(s.sensorTempC)?s.sensorTempC:null;
    const tempErr=finite(d.temperatureError)?d.temperatureError:
     finite(sensorTemp)&&finite(temp)?sensorTemp-temp:null;
    row.push(number(temp,3),number(sensorTemp,3),number(tempErr,3));
   }else if(hasTemp)row.push(number(temp,3));
   if(showDirection)row.push(direction(x.step?.pressureDirection));
   if(showTempDirection)row.push(direction(x.step?.temperatureDirection));
   if(multipleCycles)row.push(x.step?.cycle||d.setpoint?.cycle||1);
   if(multipleAttempts)row.push(e?(d.attempt||x.attempt):'');
   if(showSamples)row.push(e?(s.count||s.samples?.length||''):'');
   row.push(clock(s.at||e?.at));
   if(showReview)row.push(!e?'Nicht gemessen':d.toleranceApplied===false?
    'Ohne Bewertung':d.pass===true?'Bestanden':d.pass===false?'Ausser Toleranz':'Nicht bewertet');
   else if(showPending)row.push(e?'':'Nicht gemessen');
   return row;
  });
  const info=[
   ['Prüfart',({pressure:'Druck',temperature:'Temperatur',combined:'Druck und Temperatur'})[mode]||mode],
   ['Druckbereich',pMode&&finite(cfg.calibrationMin)&&finite(cfg.calibrationMax)?
    number(cfg.calibrationMin)+' bis '+number(cfg.calibrationMax)+' '+unit:null],
   ['Prüfpunkte',cfg.pressureEntryMode==='percent'?'% der Messspanne':pMode?unit:null],
   ['Druckart',cfg.sensorType==='absolute'?'Absolutdruck':cfg.sensorType==='gauge'?'Relativdruck':null],
   ['Prüfmittel-Druckart',cfg.referenceKind==='absolute'?'Absolutdruck':cfg.referenceKind==='gauge'?'Relativdruck':null],
   ['Umgebungsdruck',cfg.correctionApplied&&finite(cfg.ambientPressure)?number(cfg.ambientPressure)+' '+unit:null],
   ['Toleranz',showReview?
    (finite(cfg.pressureTolerancePercent)?'±'+number(cfg.pressureTolerancePercent,3)+' % FS':'Aktiv'):
    'Keine Toleranzbewertung'],
   ['Samples pro Messpunkt',sampleCounts.length===1?sampleCounts[0]:null],
   ...meta(record)
  ];
  return sections('NACHMESSUNG – PRÜFPROTOKOLL',headers,data,info);
 }
 function pointChannel(point,key){
  const value=point?.aggregated?.channels?.[key];
  if(finite(value))return value;
  if(finite(point?.sensorSnapshot?.[key]))return point.sensorSnapshot[key];
  const last=point?.samples?.at(-1)?.[key];
  return finite(last)?last:null;
 }
 function logging(record,groups){
  const rows=Array.isArray(groups)?groups:[];
  const channels=['adcS','adcT','adcTC','dspS','dspT'];
  const selected=channels.filter(key=>rows.some(row=>finite(pointChannel(row,key))||
   row.samples?.some(s=>finite(s[key]))));
  const hasPressure=rows.some(p=>finite(p.sensorSnapshot?.sensorPressure));
  const hasReference=rows.some(p=>finite(p.reference?.pressure));
  const unit=rows.find(p=>p.sensorSnapshot?.pressureUnit)?.sensorSnapshot?.pressureUnit||'';
  const headings=['Nr.','Zeit','Samples',...selected.map(key=>key.toUpperCase()+' [Digits]')];
  if(hasPressure)headings.push('Sensordruck'+(unit?' ['+unit+']':''));
  if(hasReference)headings.push('Referenzdruck'+(unit?' ['+unit+']':''));
  const data=rows.map((p,i)=>{
   const row=[p.index??i+1,clock(p.endedAt||p.startedAt),p.samples?.length||0,
    ...selected.map(key=>number(pointChannel(p,key),3))];
   if(hasPressure)row.push(number(p.sensorSnapshot?.sensorPressure));
   if(hasReference)row.push(number(p.reference?.pressure));
   return row;
  });
  const settings=record.testConfiguration||{};
  const info=[...meta(record),['Aufnahmeart',settings.manual?'Manuell':'Automatisch'],
   ['Intervall',finite(settings.intervalMs)?settings.intervalMs+' ms':null],
   ['Mittelung',settings.aggregation],['Samples pro Punkt',settings.samplesPerPoint],
   ['Messpunkte',rows.length],['Einzelmessungen',rows.reduce((n,p)=>n+(p.samples?.length||0),0)]
  ];
  const events=(record.events||[]).filter(e=>['marker','error','reference_changed'].includes(e.kind));
  let csv=sections('TEST / LOGGING – MESSPROTOKOLL',headings,data,info);
  if(events.length){
   csv=csv.trimEnd()+'\r\n\r\n'+line(['BEMERKUNGEN UND FEHLER'])+'\r\n'+
    line(['Zeit','Art','Details'])+'\r\n'+events.map(e=>line([
     clock(e.at),e.kind==='marker'?'Marker':e.kind==='error'?'Fehler':'Referenz geändert',
     e.data?.message||e.data?.reason||''
    ])).join('\r\n')+'\r\n';
  }
  return csv;
 }
 function calibration(record){
  const points=(record.events||[]).filter(e=>e.kind==='calibration_point');
  const unit=points.find(p=>p.data?.point?.unit)?.data.point.unit||'';
  const rows=points.map((e,i)=>{
   const p=e.data?.point||{};
   return [i+1,p.name||p.kind||'',number(p.pressure),number(p.temperature,3),
    number(p.adc_s,2),number(p.adc_t,2),p.sampleCount||'',clock(p.at||e.at)];
  });
  const info=[...meta(record),['Anzahl Abgleichpunkte',points.length],
   ['NVM geschrieben',record.events?.some(e=>e.kind==='nvm_after')?'Ja':'Nein']];
  return sections('KALIBRIERUNG – PROTOKOLL',
   ['Nr.','Abgleichpunkt','Druck'+(unit?' ['+unit+']':''),'Temperatur [°C]',
    'ADC_S [Digits]','ADC_T [Digits]','Samples','Zeit'],rows,info);
 }
 function output(record){
  const interesting=(record.events||[]).filter(e=>
   ['nvm_after','nvm_before','post_boot_verified','error','calibration_ram_written'].includes(e.kind));
  const labels={nvm_after:'NVM geschrieben',nvm_before:'Vor dem NVM-Schreiben',
   post_boot_verified:'Neustart geprüft',error:'Fehler',
   calibration_ram_written:'Kalibrierung in RAM geschrieben'};
  const rows=interesting.map((e,i)=>[i+1,clock(e.at),labels[e.kind]||e.kind,e.data?.message||'']);
  return sections('AUSGANG – PROTOKOLL',['Nr.','Zeit','Ereignis','Bemerkung'],
   rows,meta(record));
 }
 function csvReport(record,rows=[]){
  if(!record||typeof record!=='object')throw Error('Archivprotokoll fehlt');
  if(record.type==='verification')return verification(record);
  if(record.type==='testlog')return logging(record,rows);
  if(record.type==='calibration')return calibration(record);
  if(record.type==='output')return output(record);
  throw Error('Unbekannter Protokolltyp: '+clean(record.type));
 }
 return {csvReport};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_READABLE_CSV;
if(typeof window!=='undefined')window.ELMOS_READABLE_CSV=ELMOS_READABLE_CSV;
