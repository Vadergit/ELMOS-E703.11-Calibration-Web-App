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
  if(typeof value==='string'&&/^[\s\uFEFF]*[=+\-@\t\r]/.test(str))str="'"+str;
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
 return {columns,csvAll};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_ARCHIVE_EXPORT;
if(typeof window!=='undefined')window.ELMOS_ARCHIVE_EXPORT=ELMOS_ARCHIVE_EXPORT;
