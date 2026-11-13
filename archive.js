'use strict';
/* Local-only E703.11 archive and freely configurable post-calibration inspection. */
const ELMOS_ARCHIVE=(()=>{
 const C=ELMOS_ARCHIVE_CORE,ANALYSIS=ELMOS_ARCHIVE_ANALYSIS;
 const $=id=>document.getElementById(id);
 const S={dir:null,record:null,records:[],filename:null,writeQueue:Promise.resolve(),selection:[],step:0,
  measuring:false,showDetails:null,lastError:'',folderName:'',draft:null,view:'archive',detailsToken:0,resultsCache:new Map(),debugLines:[],debugDropped:0,lastStreamMetaFlush:0};
 const iso=()=>new Date().toISOString();
 const text=(id,value)=>{if($(id))$(id).textContent=String(value)};
 const note=(value,bad=false)=>{S.lastError=bad?String(value):'';text('archiveStatus',value);if($('archiveStatus'))$('archiveStatus').style.color=bad?'#a13b39':'#526982'};
 const el=(tag,content,css)=>{const e=document.createElement(tag);if(content!=null)e.textContent=String(content);if(css)e.className=css;return e};
 const bridge=()=>window.ELMOS_ARCHIVE_BRIDGE;
 const statusWords={running:'Offen / eventuell unterbrochen',completed:'Abgeschlossen',failed:'Fehlerhaft',
  interrupted:'Unterbrochen',aborted:'Abgebrochen',incomplete:'Unvollständig'};
 const typeWords={calibration:'Kalibrierung',verification:'Nachmessung',output:'Ausgang',testlog:'Test / Logging'};
 const clone=x=>JSON.parse(JSON.stringify(x));
 const makeId=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'id-'+Date.now()+'-'+Math.random().toString(36).slice(2);
 const safe=x=>x&&typeof x==='object'?clone(x):x;
 async function db(){
  return new Promise((resolve,reject)=>{
   if(!window.indexedDB)return reject(Error('IndexedDB nicht verfügbar'));
   const req=indexedDB.open('elmos-archive-settings',1);
   req.onupgradeneeded=()=>req.result.createObjectStore('settings');
   req.onerror=()=>reject(req.error||Error('Archiv-Einstellungen nicht lesbar'));
   req.onsuccess=()=>resolve(req.result);
  });
 }
 async function remembered(action,value){
  const d=await db();
  return new Promise((resolve,reject)=>{
   const t=d.transaction('settings',action==='read'?'readonly':'readwrite');
   const store=t.objectStore('settings');
   const r=action==='read'?store.get('folder'):store.put(value,'folder');
   r.onsuccess=()=>resolve(r.result);
   r.onerror=()=>reject(r.error);
   t.oncomplete=()=>d.close();
   t.onerror=()=>{d.close();reject(t.error)};
  });
 }
 async function permitted(ask=false){
  if(!S.dir)return false;
  try{
   if(await S.dir.queryPermission({mode:'readwrite'})==='granted')return true;
   if(ask&&await S.dir.requestPermission({mode:'readwrite'})==='granted')return true;
  }catch(_){}
  return false;
 }
 async function chooseFolder(){
  if(!window.isSecureContext||typeof window.showDirectoryPicker!=='function'){
   note('Ordnerzugriff benötigt Chrome auf HTTPS oder localhost. Bei direktem file://-Start bitte die lokale Startanleitung verwenden.',true);
   throw Error('File System Access nicht verfügbar');
  }
  const dir=await window.showDirectoryPicker({id:'elmos-archive',mode:'readwrite'});
  S.dir=dir;S.folderName=dir.name;
  try{await remembered('write',dir)}catch(_){/* Only persistence of permission is optional. */}
  text('archiveFolder',dir.name+' · lokaler Ordner');
  note('Archivordner ausgewählt. Andere Dateien im Ordner bleiben unverändert.');
  await refresh();
  return dir;
 }
 async function ensureFolder(){
  if(!S.dir)await chooseFolder();
  if(!await permitted(true))throw Error('Bitte Schreibberechtigung für den Archivordner erteilen.');
 }
 async function flush(){
  if(!S.record)return;
  const snapshot=clone(S.record),name=S.filename;
  S.writeQueue=S.writeQueue.catch(()=>{}).then(async()=>{
   if(!await permitted(false))throw Error('Archivordner ist nicht beschreibbar. Bitte erneut freigeben.');
   const file=await S.dir.getFileHandle(name,{create:true});
   const writer=await file.createWritable();
   try{await writer.write(JSON.stringify(snapshot,null,2));await writer.close()}
   catch(error){try{await writer.abort()}catch(_){}throw error}
  });
  try{await S.writeQueue}
  catch(e){note('Speichern fehlgeschlagen: '+e.message+'. Messvorgang nicht fortsetzen.',true);throw e}
 }
 async function begin(type,plan=null){
  if(S.record)throw Error('Zuerst den laufenden Vorgang abschliessen.');
  await ensureFolder();
  if(!bridge()?.meta)throw Error('Sensordaten-Schnittstelle nicht bereit');
  const meta=bridge().meta();
  if(!meta.online)throw Error('Zuerst Sensor verbinden');
  const id=makeId();
  const nearest=S.records.filter(r=>r.chipUID===meta.uid&&r.type==='calibration')
   .sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0];
  S.record={format:C.FORMAT,schemaVersion:C.VERSION,id,type,startedAt:iso(),endedAt:null,
   status:'running',chipUID:meta.uid||null,customUID:meta.customUID||null,
   linkedCalibrationId:type==='verification'?(nearest?.id||null):null,
   equipment:safe(meta.equipment),software:safe(meta.software),initial:null,final:null,plan:plan?clone(plan):null,
   events:[{at:iso(),kind:'started',data:{type,plan:plan?{mode:plan.mode,cycles:plan.cycles,steps:plan.steps.length}:null}}]};
  S.filename=C.filename(S.record);
  if(type==='testlog'){
   S.record.telemetryFiles=[];
   S.record.telemetry={groups:0,individualSamples:0,durationMs:0,missedSlots:0,readErrors:0,lastSampleAt:null,
    storage:'append-only JSONL; ein Datensatz pro Messpunkt'};
  }
  S.step=0;S.debugLines=[];S.debugDropped=0;S.lastStreamMetaFlush=0;
  try{
   await flush(); // The record exists before any sensor operations.
   if(bridge()?.initial){
    try{
     S.record.initial=await bridge().initial();
     S.record.events.push({at:iso(),kind:'initial_snapshot',data:{
      ramWords:Object.keys(S.record.initial?.ram?.words||{}).length,
      nvmWords:S.record.initial?.nvm?.words?.length||0,
      errors:S.record.initial?.errors||[]},});
    }catch(error){
     S.record.initial={errors:[String(error.message||error)],ram:{},nvm:{}};
     S.record.events.push({at:iso(),kind:'error',data:{stage:'initial_snapshot',message:String(error.message||error)}});
    }
    if(S.record.initial?.configuredUserId)S.record.customUID=S.record.initial.configuredUserId;
    await flush();
   }
  }catch(e){
   if(S.record){S.record.status='incomplete';S.record.events.push({at:iso(),kind:'error',data:{stage:'archive_write',message:e.message}})}
   throw e;
  }
  renderActive();
  return S.record;
 }
 async function ensureCalibration(){
  if(S.record){
   if(S.record.type!=='calibration')throw Error('Eine Nachmessung läuft. Zuerst abschliessen.');
   return S.record;
  }
  return begin('calibration');
 }
 async function event(kind,data={}){
  if(!S.record)return false;
  S.record.events.push({at:iso(),kind,data:safe(data)});
  if(kind==='test_configuration'&&S.record.type==='testlog')
   S.record.testConfiguration=safe(data);
  if(kind==='nvm_before')S.record.status='running';
  if(kind==='error'&&data.stage==='nvm_program')S.record.status='failed';
  if(kind==='nvm_after')S.record.status='running';
  if(kind==='nvm_after'&&Array.isArray(data.words)&&Number.isInteger(data.words[30]))
   S.record.customUID='0x'+data.words[30].toString(16).padStart(4,'0').toUpperCase();
  await flush();
  renderActive();
  return true;
 }
 function trace(line){
  if(!S.record)return;
  if(S.record.type==='testlog'){
   if(!S.record.testConfiguration?.debug)return;
   if(S.debugLines.length<4000)S.debugLines.push({at:iso(),line:String(line).slice(0,6000)});
   else S.debugDropped++;
   return;
  }
  S.record.events.push({at:iso(),kind:'transport',data:{line:String(line).slice(0,6000)}});
 }
 async function appendTelemetry(entry){
  const record=S.record;
  if(!record||record.type!=='testlog')throw Error('Kein aktives Testprotokoll');
  const payload=safe(entry);
  if(!payload||payload.kind!=='telemetry_point')throw Error('Ungültiger Telemetriedatensatz');
  if(record.testConfiguration?.debug){
   payload.transport=S.debugLines.splice(0);
   if(S.debugDropped)payload.transportDropped=S.debugDropped;
   S.debugDropped=0;
  }
  // Rotate the append-only stream after 100 points; this avoids copying
  // an ever-growing single file each time createWritable() is opened.
  const part=Math.floor(record.telemetry.groups/100)+1;
  const name=S.filename.replace(/\.json$/i,'.part-'+String(part).padStart(4,'0')+'.samples.jsonl');
  if(!record.telemetryFiles.includes(name)){
   record.telemetryFiles.push(name);
   await flush(); // Save the new part reference before writing it.
  }
  const folder=S.dir;
  S.writeQueue=S.writeQueue.catch(()=>{}).then(async()=>{
   if(!await permitted(false))throw Error('Keine Schreibberechtigung für Telemetrie-Datei');
   const handle=await folder.getFileHandle(name,{create:true});
   const existing=await handle.getFile();
   const writer=await handle.createWritable({keepExistingData:true});
   try{
    await writer.seek(existing.size);
    await writer.write(JSON.stringify(payload)+'\n');
    await writer.close();
   }catch(e){try{await writer.abort()}catch(_){}throw e}
  });
  try{await S.writeQueue}
  catch(e){
   note('Rohdaten konnten nicht gespeichert werden: '+e.message,true);
   if(payload.transport?.length)S.debugLines.unshift(...payload.transport);
   throw e;
  }
  record.telemetry.groups++;
  record.telemetry.individualSamples+=(payload.samples?.length||0);
  record.telemetry.missedSlots+=(payload.skippedIntervals||0);
  record.telemetry.durationMs+=payload.durationMs||0;
  record.telemetry.readErrors+=(payload.errors?.length||0);
  record.telemetry.lastSampleAt=payload.endedAt||iso();
  if(record.telemetry.groups===1||record.telemetry.groups%10===0||Date.now()-S.lastStreamMetaFlush>5000){
   await flush();S.lastStreamMetaFlush=Date.now();
  }
  return record.telemetry.groups;
 }
 async function streamRows(record){
  if(!record.telemetryFiles?.length&&!record.telemetryFile)return [];
  if(!S.dir)throw Error('Kein lokaler Telemetrieordner verbunden');
  if(!await permitted(false))throw Error('Archivordner erneut freigeben');
  const result=[];
  for(const name of record.telemetryFiles?.length?record.telemetryFiles:[record.telemetryFile]){
   const handle=await S.dir.getFileHandle(name);
   const file=await handle.getFile();
   for(const line of (await file.text()).split(/\r?\n/)){
    if(!line.trim())continue;
    const row=JSON.parse(line);
    if(row.kind==='telemetry_point')result.push(row);
   }
  }
  return result;
 }
 async function finalise(status='incomplete'){
  if(!S.record)return;
  if(S.measuring)throw Error('Messung läuft');
  if(bridge()?.final)try{S.record.final=await bridge().final()}catch(e){
   S.record.events.push({at:iso(),kind:'error',data:{stage:'final_snapshot',message:e.message}});
  }
  if(status==='completed'&&S.record.type==='testlog'&&!(S.record.telemetry?.groups>0))
   status='incomplete';
  if(status==='completed'&&S.record.type!=='testlog'&&(!Array.isArray(S.record.initial?.nvm?.words)||
   S.record.initial.nvm.words.length!==64||!Array.isArray(S.record.final?.nvm?.words)||
   S.record.final.nvm.words.length!==64))status='incomplete';
  if(status==='completed'&&S.record.type==='verification'){
   const summary=C.outcomes(S.record);
   const results=S.record.plan.steps.map(s=>C.lastAttempt(S.record,s.index));
   if(summary.measured!==summary.planned||results.some(x=>x?.pass===false))status='failed';
   else if(results.some(x=>x?.pass!==true))status='incomplete';
  }
  S.record.status=status;S.record.endedAt=iso();
  S.record.events.push({at:iso(),kind:'finished',data:{status}});
  if(S.record.type==='testlog'&&S.debugLines.length)
   S.record.events.push({at:iso(),kind:'debug_tail',data:{lines:S.debugLines.splice(0),dropped:S.debugDropped}});
  await flush();
  const finished=clone(S.record);
  S.record=null;S.filename=null;S.step=0;
  renderActive();await refresh();return finished;
 }
 function interrupted(reason){
  if(!S.record)return;
  S.record.status='interrupted';S.record.endedAt=iso();
  S.record.events.push({at:iso(),kind:'error',data:{stage:'sensor_connection',message:reason}});
  if(S.record.type==='testlog'&&S.debugLines.length)
   S.record.events.push({at:iso(),kind:'debug_tail',data:{lines:S.debugLines.splice(0),dropped:S.debugDropped}});
  window.dispatchEvent(new CustomEvent('elmos-archive-interrupted',{detail:{reason}}));
  const interruptedRecord=S.record;
  void flush().then(()=>{if(S.record!==interruptedRecord)return;S.record=null;S.filename=null;renderActive();return refresh()}).catch(()=>{});
 }
 async function download(record,format='json'){
  let data,mime,name;
  if(record.type==='testlog'){
   const rows=await streamRows(record);
   if(format==='csv'){
    data=window.ELMOS_TEST_LOGGER_CORE.csvRows(rows);mime='text/csv;charset=utf-8';
    name=C.filename(record).replace(/\.json$/i,'.csv');
   }else{
    data=JSON.stringify({...record,telemetryPoints:rows},null,2);
    mime='application/json';name=C.filename(record);
   }
  }else{data=JSON.stringify(record,null,2);mime='application/json';name=C.filename(record)}
  const url=URL.createObjectURL(new Blob([data],{type:mime}));
  const a=el('a');a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
 }
 async function refresh(){
  if(!S.dir){renderList();return}
  try{
   if(!await permitted(false)){note('Archivordner erneut freigeben, um Dateien einzulesen.',true);return}
   const all=[];
   let corrupt=0;
   for await(const [name,handle] of S.dir.entries()){
    if(handle.kind!=='file'||!name.toLowerCase().endsWith('.json'))continue;
    try{
     const file=await handle.getFile();
     if(file.size>12*1024*1024)continue;
     const parsed=JSON.parse(await file.text());
     if(C.valid(parsed)){parsed._archiveName=name;all.push(parsed)}
     else if(/^ELMOS_\d{8}_\d{6}_[A-Z0-9]+_[a-f0-9-]{8,}\.json$/i.test(name))corrupt++;
    }catch(_){if(/^ELMOS_\d{8}_\d{6}_[A-Z0-9]+_[a-f0-9-]{8,}\.json$/i.test(name))corrupt++}
   }
   S.records=all.sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
   S.resultsCache.clear();
   S.selection=S.selection.filter(id=>S.records.some(r=>r.id===id));
   renderList();
   note(all.length+' gültige Prüfprotokolle geladen'+(corrupt?' · '+corrupt+' ungültige ELMOS-Dateien prüfen':'')+'.');
  }catch(e){note('Archiv nicht lesbar: '+e.message,true)}
 }
 function readable(r){
  return [r.chipUID,r.customUID,r.initial?.configuredUserId,r.final?.configuredUserId,
   r.type,r.status,r.startedAt,r.equipment?.adapter,r.equipment?.firmware,
   r.software?.version,r.testConfiguration?.name,r.testConfiguration?.description,
   r.testConfiguration?.category,r.testConfiguration?.operator,r.id].filter(Boolean).join(' ').toLowerCase();
 }
 const num=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('de-CH',{maximumFractionDigits:d}):'–';
 const when=v=>v?new Date(v).toLocaleString('de-CH'):'–';
 const time=ms=>!Number.isFinite(ms)||ms<0?'–':ms>=3600000?
  Math.floor(ms/3600000)+' h '+Math.floor(ms%3600000/60000)+' min':
  ms>=60000?Math.floor(ms/60000)+' min '+Math.floor(ms%60000/1000)+' s':
  (ms/1000).toFixed(ms<1000?2:0)+' s';
 function section(title,subtitle){
  const root=el('div',null,'ar-section-title');
  root.append(el('h3',title));
  if(subtitle)root.append(el('p',subtitle,'ar-muted'));
  return root;
 }
 function kpi(label,value,hint){
  const root=el('div',null,'ar-kpi');
  root.append(el('small',label),el('strong',value),el('span',hint||''));
  return root;
 }
 function facts(summary){
  const box=el('div',null,'ar-data-grid');
  const info=[
   ['Chip-UID',summary.chipUID],['USER-ID',summary.userID],
   ['Board',summary.board],['Firmware',summary.firmware],
   ['Web-App',summary.appVersion],['Start',when(summary.startedAt)],
   ['Ende',when(summary.endedAt)],['Dauer',time(summary.durationMs)]];
  for(const [key,val] of info){
   const item=el('div',null,'ar-data-pair');
   item.append(el('small',key),el('strong',val||'–'));box.append(item);
  }
  return box;
 }
 function outcome(summary){
  const box=el('div',null,'ar-kpi-grid');
  box.append(kpi('Messpunkte',num(summary.measurementPoints,0),'Aufgezeichnete Gruppen / Versuche'),
   kpi('Rohmessungen',num(summary.rawSamples,0),'Einzelne Sensorwerte'),
   kpi('Fehler',num(summary.errors,0),'Gemeldete Auffälligkeiten'),
   kpi('Dauer',time(summary.durationMs),summary.statusLabel));
  return box;
 }
 function filtered(){
  const term=($('archiveSearch')?.value||'').toLowerCase().trim();
  const type=$('archiveFilterType')?.value||'all';
  const status=$('archiveFilterStatus')?.value||'all';
  return S.records.filter(r=>(type==='all'||r.type===type)&&
   (status==='all'||r.status===status)&&readable(r).includes(term));
 }
 function renderList(){
  const root=$('archiveRows');if(!root)return;
  root.replaceChildren();
  const list=filtered();
  text('archiveCount',list.length+' / '+S.records.length+' Dateien');
  const summary=$('archiveOverview');
  if(summary){
   summary.replaceChildren(
    kpi('Protokolle',num(S.records.length,0),'Im gewählten Ordner'),
    kpi('Abgleiche',num(S.records.filter(r=>r.type==='calibration').length,0),'Kalibrierungen'),
    kpi('Messungen',num(S.records.filter(r=>['testlog','verification'].includes(r.type)).length,0),'Tests / Nachmessungen'),
    kpi('Auffälligkeiten',num(S.records.filter(r=>{
     const x=ANALYSIS.overview(r);return x.errors||x.failedAttempts||
      ['failed','interrupted','incomplete'].includes(r.status);
    }).length,0),'Fehler oder unvollständig')
   );
  }
  for(const record of list){
   const info=ANALYSIS.overview(record);
   const card=el('div',null,'ar-file'+(S.showDetails===record.id?' is-active':''));
   const title=el('div',null,'ar-file-title');
   const checkbox=el('input');checkbox.type='checkbox';
   checkbox.checked=S.selection.includes(record.id);
   checkbox.title='Für direkten Vergleich auswählen';
   checkbox.setAttribute('aria-label','Datei für Vergleich auswählen: '+info.title);
   checkbox.addEventListener('change',()=>{
    S.selection=checkbox.checked?[...S.selection.filter(id=>id!==record.id),record.id].slice(-2):
     S.selection.filter(id=>id!==record.id);
    renderList();
   });
   const main=el('div',null,'ar-file-name');
   main.append(el('strong',info.title),el('small',when(info.startedAt)));
   const status=el('span',info.statusLabel,'ar-pill'+
    (info.status==='completed'?' ar-good':info.status==='failed'?' ar-bad':''));
   title.append(checkbox,main,status);
   const detail=el('div',null,'ar-file-meta');
   detail.append(el('span',info.chipUID||'UID nicht verfügbar'),
    el('span',info.board||'Board unbekannt'),el('span','Web '+(info.appVersion||'?')));
   const quick=el('div',null,'ar-file-quick');
   quick.append(el('span',info.measurementPoints+' Punkte'),
    el('span',info.errors+' Fehler'),el('span',time(info.durationMs)));
   const actions=el('div',null,'ar-file-actions');
   const view=el('button','Ergebnisse prüfen','ar-small ar-view-button');
   view.addEventListener('click',()=>{void renderDetails(record)});
   const exportJSON=el('button','JSON','ar-small');
   exportJSON.addEventListener('click',()=>download(record).catch(e=>note(e.message,true)));
   actions.append(view,exportJSON);
   if(record.type==='testlog'){
    const csv=el('button','CSV','ar-small');
    csv.addEventListener('click',()=>download(record,'csv').catch(e=>note(e.message,true)));
    actions.append(csv);
   }
   card.append(title,detail,quick,actions);root.append(card);
  }
  if(!list.length){
   const blank=el('div',null,'ar-empty');
   blank.append(el('strong','Keine passenden Dateien'),
    el('p','Andere Filter wählen oder den Archivordner erneut einlesen.'));
   root.append(blank);
  }
  $('archiveCompare').disabled=S.selection.length!==2;
  text('archiveCompare',S.selection.length===2?'2 Dateien vergleichen':
   S.selection.length+' von 2 Dateien markiert');
 }
 async function rowsFor(r){
  if(r.type!=='testlog')return null;
  if(S.resultsCache.has(r.id))return S.resultsCache.get(r.id);
  const rows=await streamRows(r);
  S.resultsCache.set(r.id,rows);
  while(S.resultsCache.size>2)S.resultsCache.delete(S.resultsCache.keys().next().value);
  return rows;
 }
 function chart(points){
  const root=el('div',null,'ar-graph');
  if(!points?.length){root.append(el('p','Keine DSP_S-Messwerte verfügbar.','ar-muted'));return root}
  const values=points.map(p=>p.value),lo=Math.min(...values),hi=Math.max(...values);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 800 160');
  svg.setAttribute('role','img');
  svg.setAttribute('aria-label','Verlauf von DSP_S');
  const poly=document.createElementNS('http://www.w3.org/2000/svg','polyline');
  const coords=points.map((p,i)=>{
   const x=12+i*776/Math.max(1,points.length-1);
   const y=148-(p.value-lo)/Math.max(1,hi-lo)*136;
   return x.toFixed(1)+','+y.toFixed(1);
  }).join(' ');
  poly.setAttribute('points',coords);poly.setAttribute('class','ar-trend');
  svg.append(poly);root.append(svg);
  const labels=el('div',null,'ar-graph-labels');
  labels.append(el('span','Min '+num(lo,3)+' Digits'),
   el('span','Max '+num(hi,3)+' Digits'));root.append(labels);
  return root;
 }
 function metrics(info){
  const box=el('div',null,'ar-metrics');
  if(!info.metrics)return box;
  for(const key of ['dspS','adcS','adcT','dspT']){
   const v=info.metrics[key];
   if(!v?.count)continue;
   const row=el('div',null,'ar-metric');
   row.append(el('strong',key),el('span','Ø '+num(v.mean,3)),
    el('span','Min '+num(v.min,3)),el('span','Max '+num(v.max,3)),
    el('span','σ '+num(v.stddev,3)));box.append(row);
  }
  return box;
 }
 function eventsView(r){
  const out=el('div',null,'ar-events');
  const events=(r.events||[]).filter(e=>e.kind!=='transport');
  const notable=events.filter(e=>e.kind==='error'||e.kind==='marker'||
   (e.kind==='measurement'&&e.data?.pass===false));
  out.append(section('Ereignisse & Notizen',
   notable.length?'Auffälligkeiten und manuelle Kommentare':'Letzte aufgezeichnete Ereignisse'));
  for(const event of (notable.length?notable:events.slice(-6)).slice(-20)){
   const item=el('details',null,'ar-event');
   item.append(el('summary',when(event.at)+' · '+event.kind),
    el('pre',JSON.stringify(event.data||{},null,2)));
   out.append(item);
  }
  const all=el('details',null,'ar-event');
  all.append(el('summary','Gesamtes Ereignisprotokoll ('+events.length+')'),
   el('pre',JSON.stringify(events,null,2)));out.append(all);
  return out;
 }
 async function renderDetails(r){
  S.showDetails=r.id;const token=++S.detailsToken;
  renderList();
  const root=$('archiveDetails');root.replaceChildren(section('Ergebnisse werden geladen …'));
  let rows;
  try{rows=await rowsFor(r)}
  catch(e){
   if(token===S.detailsToken)root.replaceChildren(section('Rohdaten fehlen',e.message));
   return;
  }
  if(token!==S.detailsToken)return;
  const info=ANALYSIS.overview(r,rows);
  root.replaceChildren();
  const top=el('div',null,'ar-detail-title');
  const heading=el('div');heading.append(el('small',info.typeLabel,'ar-overline'),
   el('h2',info.title),el('p',info.description||info.chipUID||'–','ar-muted'));
  top.append(heading,el('span',info.statusLabel,'ar-pill'+
   (info.status==='completed'?' ar-good':info.status==='failed'?' ar-bad':'')));
  root.append(top,outcome(info),section('Geräte- und Aufzeichnungsdaten'),facts(info));
  if(r.type==='testlog'){
   root.append(section('Messresultate','Alle Rohsamples für Statistik und Verlauf ausgewertet.'),
    metrics(info),section('Signalverlauf · DSP_S'),chart(info.trend));
   root.append(el('p','Intervall: '+(info.intervalMs??'–')+' ms · '+
    (info.groupSize||1)+' Einzelmessungen / Messpunkt · '+
    (info.aggregation||'keine Mittelung'),'ar-muted'));
  }
  if(r.type==='verification'&&r.plan){
   const h=C.hysteresis(r);
   root.append(section('Hysterese','Vergleich identischer Prüfpunkte bei steigender und fallender Richtung.'));
   if(!h.pairs.length)root.append(el('p','Keine vollständigen Hysterese-Messpaare.','ar-muted'));
   for(const point of h.pairs.slice(0,40))
    root.append(el('div',point.axis+' · Zyklus '+point.cycle+' · Referenz '+point.reference+
     ' · Δ '+num(point.delta,4)+' '+point.unit,'ar-difference'));
  }
  root.append(eventsView(r));
  const btn=el('button','Protokoll als JSON herunterladen','ar-small ar-export');
  btn.addEventListener('click',()=>download(r).catch(e=>note(e.message,true)));root.append(btn);
 }
 async function compare(){
  if(S.selection.length!==2)return;
  const [a,b]=S.selection.map(id=>S.records.find(x=>x.id===id));
  if(!a||!b)return;
  S.showDetails=null;const token=++S.detailsToken;renderList();
  const root=$('archiveDetails');root.replaceChildren(section('Vergleich wird geladen …'));
  let ar,br;
  try{[ar,br]=await Promise.all([rowsFor(a),rowsFor(b)])}
  catch(e){if(token===S.detailsToken)root.replaceChildren(section('Vergleich nicht möglich',e.message));return}
  if(token!==S.detailsToken)return;
  const info=ANALYSIS.compare(a,b,ar,br);
  root.replaceChildren(section('Direktvergleich','Zwei Protokolle nebeneinander prüfen.'));
  if(!info.identicalUID)root.append(el('p',
   'Unterschiedliche Chip-UIDs: Messergebnisse nur bei vergleichbaren Bedingungen beurteilen.','ar-warning'));
  const cols=el('div',null,'ar-compare-cols');
  for(const [record,side] of [[a,info.left],[b,info.right]]){
   const col=el('div',null,'ar-compare-col');
   col.append(el('h3',side.title),el('p',when(side.startedAt)+' · '+side.statusLabel,'ar-muted'),
    outcome(side),facts(side));
   if(side.trend)col.append(section('DSP_S-Verlauf'),chart(side.trend));
   cols.append(col);
  }
  root.append(cols);
  root.append(section('Ergebnisunterschiede','Differenz: rechter Mittelwert minus linker Mittelwert.'));
  if(info.metrics){
   const diff=el('div',null,'ar-diff-table');
   diff.append(el('div','Kanal                 Datei A       Datei B       Differenz','ar-diff-header'));
   for(const metric of info.metrics){
    const row=el('div',null,'ar-diff-row');
    row.append(el('strong',metric.key),el('span',num(metric.left?.mean,3)),
     el('span',num(metric.right?.mean,3)),
     el('strong',metric.delta==null?'Nicht vergleichbar':
      (metric.delta>=0?'+':'')+num(metric.delta,3)+' Digits'));
    diff.append(row);
   }
   root.append(diff);
  }else{
   const diff=el('div',null,'ar-diff-row');
   for(const k of ['measurementPoints','errors','rawSamples','durationMs']){
    const val=k==='durationMs'?time(info.left[k])+' / '+time(info.right[k]):
     num(info.left[k],0)+' / '+num(info.right[k],0);
    diff.append(el('span',k+' · '+val));
   }
   root.append(diff);
  }
  root.append(section('NVM-Differenzen'));
  const changes=info.nvmChanges;
  if(changes===null)root.append(el('p','Mindestens ein vollständiges NVM-Abbild fehlt.','ar-muted'));
  else if(!changes.length)root.append(el('p','Keine Änderungen in den 64 NVM-Wörtern.','ar-muted'));
  else{
   root.append(el('p',changes.length+' NVM-Wörter unterscheiden sich.','ar-warning'));
   const list=el('div',null,'ar-nvm-diff');
   for(const p of changes)list.append(el('div','Wort '+p.index+' · 0x'+
    p.before.toString(16).padStart(4,'0')+' → 0x'+p.after.toString(16).padStart(4,'0'),
    'ar-difference'));root.append(list);
  }
 }
 function modeUI(){
  const mode=$('arMode').value;
  $('arPressurePath').disabled=mode==='temperature';
  $('arTempPath').disabled=mode==='pressure';
  $('arFixedPressure').disabled=mode!=='temperature';
  $('arFixedTemp').disabled=mode!=='pressure';
 }
 function config(){
  return {mode:$('arMode').value,
   pressure:$('arPressurePath').value,temperature:$('arTempPath').value,
   fixedPressure:$('arFixedPressure').value,fixedTemperature:$('arFixedTemp').value,
   cycles:$('arCycles').value};
 }
 function preview(){
  try{
   const p=C.makePlan(config());S.draft=p;
   text('arPlanStatus',p.steps.length+' Prüfschritte · '+p.cycles+' Zyklen · '+p.pressure.length+
    ' Druckpunkte · '+p.temperature.length+' Temperaturpunkte. Die Reihenfolge bleibt erhalten.');
   const nodes=p.steps.slice(0,30).map(s=>(s.index+1)+'. '+s.pressure+' / '+s.temperature+
    ' °C · Druck '+s.pressureDirection+' · Temperatur '+s.temperatureDirection);
   text('arPlanPreview',nodes.join('\n')+(p.steps.length>30?'\n… weitere Punkte im Ablauf':''));
  }catch(e){S.draft=null;text('arPlanStatus',e.message);text('arPlanPreview','')}
 }
 function renderActive(){
  const r=S.record;
  $('arActive').hidden=!r||(S.view==='archive'&&r.type==='verification');
  $('arPlanner').hidden=!!r||S.view!=='verification';
  $('arResults').hidden=S.view!=='archive';
  $('archiveStartCalibration').hidden=S.view!=='archive';
  text('arActiveState',r?(typeWords[r.type]||r.type)+' · '+(r.chipUID||'?')+' · '+(statusWords[r.status]||r.status):
   'Kein aktiver Prüfvorgang.');
  if(r?.plan)renderStep();
 }
 function renderStep(){
  const r=S.record;
  if(!r?.plan)return;
  const point=r.plan.steps[S.step],done=S.step>=r.plan.steps.length;
  text('arStepHeading',done?'Alle Prüfschritte bearbeitet':'Prüfschritt '+(S.step+1)+' / '+r.plan.steps.length);
  text('arStepDescription',done?'Jetzt den Vorgang abschliessen. Fehlerhafte Versuche bleiben gespeichert.':
   'Druck '+point.pressure+' · Temperatur '+point.temperature+' °C · Druckrichtung '+point.pressureDirection+
    ' · Temperaturrichtung '+point.temperatureDirection+'. Referenzen zuerst am Prüfstand stabilisieren.');
  $('arMeasureControls').hidden=done;
  $('arEndVerification').hidden=!done;
  if(!done){
   if($('arPointKey').value!==String(S.step)){
    $('arRefPressure').value=String(point.pressure);
    $('arRefTemp').value=String(point.temperature);
    $('arPointKey').value=String(S.step);
    $('arStable').checked=false;
   }
   const attempts=r.events.filter(e=>e.kind==='measurement'&&e.stepIndex===S.step);
   text('arAttemptNote',attempts.length?'Bereits '+attempts.length+' Versuch(e) erfasst. Wiederholen ist jederzeit möglich.':
    'Noch keine Messung an diesem Prüfpunkt.');
  }
 }
 async function measure(){
  const r=S.record;
  if(!r||r.type!=='verification'||S.measuring||!r.plan)return;
  const step=r.plan.steps[S.step];if(!step)return;
  const p=Number($('arRefPressure').value),t=Number($('arRefTemp').value),
   toleranceP=Number($('arToleranceP').value),toleranceT=Number($('arToleranceT').value),
   count=Number($('arSamples').value);
  if(!$('arStable').checked)return note('Bitte die Stabilisierung bestätigen.',true);
  if(!Number.isFinite(p)||!Number.isFinite(t)||!Number.isFinite(toleranceP)||toleranceP<0||
   !Number.isFinite(toleranceT)||toleranceT<0||!Number.isInteger(count)||count<1||count>100)
   return note('Referenzen, Toleranzen oder Sample-Anzahl ungültig.',true);
  const attempts=r.events.filter(e=>e.kind==='measurement'&&e.stepIndex===S.step).length;
  S.measuring=true;$('arMeasure').disabled=true;
  note('Messung '+(attempts+1)+' läuft …');
  try{
   const sample=await bridge().measure(count);
   const pressureConfirmed=$('arPressureScaleConfirmed').checked||sample.pressureConversionKind==='ram';
   sample.pressureConfidence=pressureConfirmed?'confirmed':'unverified';
   const errP=pressureConfirmed&&Number.isFinite(sample.sensorPressure)?sample.sensorPressure-p:null;
   // °C conversions require an operator-verified model. Always preserve DSP_T raw.
   const tempConfirmed=$('arTempConversionConfirmed').checked;
   const tempScale=Number($('arTempScale').value),tempOffset=Number($('arTempOffset').value);
   if(tempConfirmed&&(!Number.isFinite(tempScale)||tempScale===0||!Number.isFinite(tempOffset)))
    throw Error('Temperatur-Umrechnung benötigt gültige Skalierung und Offset');
   sample.sensorTempC=tempConfirmed&&Number.isFinite(sample.dspT)?(sample.dspT-tempOffset)/tempScale:null;
   sample.temperatureConfidence=tempConfirmed?'confirmed':'unverified';
   sample.temperatureConversion=tempConfirmed?{operatorConfirmed:true,dspTScaleDigitsPerC:tempScale,
    dspTOffsetDigits:tempOffset,source:'Manuelle Bestätigung, nicht vom System validiert'}:
    {operatorConfirmed:false,source:'Rohdaten ohne kalibrierte °C-Umrechnung'};
   const errT=Number.isFinite(sample.sensorTempC)?sample.sensorTempC-t:null;
   const pPass=errP===null?null:Math.abs(errP)<=toleranceP;
   const tPass=errT===null?null:Math.abs(errT)<=toleranceT;
   const mode=r.plan.mode;
   const pass=mode==='pressure'?pPass:mode==='temperature'?tPass:
    (pPass===false||tPass===false)?false:(pPass===null||tPass===null)?null:true;
   await event('measurement',{stepIndex:S.step,attempt:attempts+1,referencePressure:p,referenceTemperature:t,
    referenceSource:$('arReferenceSource').value||'Manuelle Eingabe',setpoint:step,
    pressureTolerance:toleranceP,temperatureTolerance:toleranceT,
    pressureError:errP,temperatureError:errT,pressureVerdict:pPass,temperatureVerdict:tPass,
    pass,sample});
   note('Versuch '+(attempts+1)+': DSP_S '+sample.dspS+' · DSP_T '+sample.dspT+
    ' · Druckfehler '+(errP===null?'nicht bewertet':errP.toFixed(5))+
    ' · Temperaturfehler '+(errT===null?'nicht bewertet':errT.toFixed(3)+' °C')+
    ' · '+(pass===false?'ausser Toleranz':pass===null?'Bewertung teilweise offen':'innerhalb Toleranz')+'.',pass===false);
  }catch(e){
   try{await event('error',{stage:'verification_measurement',stepIndex:S.step,attempt:attempts+1,message:e.message,rawSamples:e.rawSamples||null,partialReadErrors:e.partialReadErrors||null})}
   catch(_){}
   note('Messung fehlgeschlagen: '+e.message,true);
  }finally{S.measuring=false;$('arMeasure').disabled=false;renderStep()}
 }
 async function advance(){
  if(!S.record?.plan||S.measuring)return;
  const current=S.step;
  if(current<S.record.plan.steps.length&&!C.lastAttempt(S.record,current))
   await event('point_skipped',{stepIndex:current,reason:'Manuell übersprungen'});
  S.step=Math.min(S.record.plan.steps.length,current+1);
  renderStep();
 }
 function previous(){if(!S.record?.plan||S.measuring)return;S.step=Math.max(0,S.step-1);renderStep()}
 async function startVerification(){
  if(!S.draft)preview();
  if(!S.draft)throw Error('Prüfplan zuerst korrigieren');
  await begin('verification',S.draft);
  note('Nachmessung gestartet. Referenzen stammen aus deiner Eingabe, nicht von der Klimakammer.');
 }
 async function endVerification(){await finalise('completed');note('Nachmessung mit allen Versuchen archiviert.')}
 function UI(){
  return '<div class="ar-top"><div><h2 id="arViewTitle">Kalibrierarchiv</h2><p id="arViewSubtitle">Vollständig lokal · archivierte Abgleiche, Tests und Prüfprotokolle durchsuchen</p></div><button id="archiveClose">Zur Webseite zurück</button></div>'+
  '<div class="ar-bar"><button id="archiveChoose" class="primary">Archivordner auswählen</button><span id="archiveFolder">Noch kein Archivordner gewählt</span><button id="archiveRefresh">Ordner einlesen</button><button id="archiveStartCalibration">Abgleich protokollieren</button>'+
  '<label>VDD-Istspannung (V, optional, manuell gemessen)<input id="archiveMeasuredVdd" type="number" min="0" step="any" placeholder="z. B. 5.01"></label>'+
  '<label>Quelle der VDD-Messung<input id="archiveMeasuredVddSource" placeholder="z. B. Multimeter"></label></div>'+
  '<p id="archiveStatus" role="status">Bitte einen lokalen Ordner auswählen. Fremde Dateien im Ordner werden ignoriert.</p>'+
  '<div class="ar-active" id="arActive" hidden><h3 id="arActiveState"></h3><div id="arMeasureControls" hidden><h3 id="arStepHeading"></h3><p id="arStepDescription"></p><input id="arPointKey" type="hidden" value="-1"><div class="ar-grid">'+
  '<label>Referenzdruck<input id="arRefPressure" type="number" step="any"></label><label>Referenztemperatur (°C)<input id="arRefTemp" type="number" step="any"></label>'+
  '<label>Referenzquelle<input id="arReferenceSource" value="Klimakammer / Druckkalibrator"></label>'+
  '<label>Drucktoleranz (Einheit des Sensors)<input id="arToleranceP" type="number" min="0" step="any" value="0.1"></label>'+
  '<label>Temperaturtoleranz (°C, vorerst nur protokolliert)<input id="arToleranceT" type="number" min="0" step="any" value="1"></label>'+
  '<label>Samples pro Versuch<input id="arSamples" type="number" min="1" max="100" value="12"></label></div>'+
  '<label class="ar-check"><input id="arPressureScaleConfirmed" type="checkbox"> Druck-Anzeigebereich und DSP-Skalierung für diesen Sensor geprüft (erst dann Drucktoleranz bewerten)</label>'+
  '<label class="ar-check"><input id="arTempConversionConfirmed" type="checkbox"> Temperaturumrechnung DSP_T → °C extern geprüft und freigeben</label>'+
  '<div class="ar-grid"><label>DSP_T-Skalierung (Digits / °C)<input id="arTempScale" type="number" step="any" value="387.88"></label><label>DSP_T-Offset (Digits)<input id="arTempOffset" type="number" step="any" value="-16485"></label></div>'+
  '<label class="ar-check"><input id="arStable" type="checkbox"> Druck und Temperatur stabil – Messung freigeben</label>'+
  '<div class="ar-buttons"><button id="arMeasure" class="primary">Messung aufnehmen / wiederholen</button><button id="arPrevious">Vorheriger Punkt</button><button id="arNext">Nächster Punkt</button></div>'+
  '<p id="arAttemptNote"></p><p class="ar-muted">ADC_T, ADC_TC und DSP_T werden immer als Rohwerte erfasst. Die voreingestellten Temperaturkoeffizienten sind nur Vorschlagswerte aus bisherigen Tests und müssen vor einer Toleranzbewertung unabhängig geprüft werden.</p></div>'+
  '<div class="ar-buttons"><button id="arEndVerification" hidden>Nachmessung abschliessen</button><button id="arEndCalibration">Vorgang abschliessen</button><button id="arAbort">Abbrechen und archivieren</button><button id="arSaveCurrent">Zwischenstand speichern</button></div></div>'+
  '<div id="arPlanner" class="ar-planner"><h3>Neuen Prüfablauf planen</h3><div class="ar-grid">'+
  '<label>Prüfart<select id="arMode"><option value="combined">Druck × Temperatur</option><option value="pressure">Druckrampe</option><option value="temperature">Temperaturrampe</option></select></label>'+
  '<label>Druckrampe (frei, hin und zurück)<input id="arPressurePath" value="0, 2.5, 5, 7.5, 10, 7.5, 5, 2.5, 0"></label>'+
  '<label>Temperaturrampe (frei, hin und zurück)<input id="arTempPath" value="10, 40, 90, 40, 10"></label>'+
  '<label>Fixer Druck bei Temperaturprüfung<input id="arFixedPressure" type="number" step="any" value="5"></label>'+
  '<label>Fixe Temperatur bei Druckprüfung<input id="arFixedTemp" type="number" step="any" value="25"></label>'+
  '<label>Zyklen<input id="arCycles" type="number" min="1" max="30" value="1"></label></div>'+
  '<p id="arPlanStatus"></p><pre class="ar-plan" id="arPlanPreview"></pre><div class="ar-buttons">'+
  '<button id="arPreview">Prüfplan berechnen</button><button id="arStart" class="primary">Nachmessung starten</button></div>'+
  '<p class="ar-muted">Die Web-App steuert Druckkalibrator und Klimakammer nicht automatisch. Jeder Sollwert wird manuell eingestellt und bestätigt. Druck- und Temperaturhysterese werden aus passenden Messpaaren berechnet.</p></div>'+
  '<div class="ar-results" id="arResults"><div class="ar-overview" id="archiveOverview"></div><div class="ar-files-panel"><div class="ar-files-head"><h3>Messdateien</h3><small id="archiveCount"></small></div><div class="ar-grid">'+
  '<input id="archiveSearch" placeholder="UID, Datum, Board oder Softwareversion suchen">'+
  '<select id="archiveFilterType"><option value="all">Alle Protokolltypen</option><option value="testlog">Test / Logging</option><option value="calibration">Kalibrierung</option><option value="verification">Nachmessung</option><option value="output">Ausgang</option></select>'+
  '<select id="archiveFilterStatus"><option value="all">Alle Ergebnisse</option><option value="running">Offen / eventuell unterbrochen</option><option value="completed">Abgeschlossen</option><option value="failed">Fehlerhaft</option><option value="incomplete">Unvollständig</option><option value="interrupted">Unterbrochen</option><option value="aborted">Abgebrochen</option></select></div>'+
  '<p class="ar-file-hint">Zwei Messdateien mit den Auswahlfeldern markieren und direkt vergleichen.</p><div class="ar-buttons"><button id="archiveCompare" disabled>0 von 2 Dateien markiert</button></div>'+
  '<div id="archiveRows" class="ar-rows"></div></div><div id="archiveDetails" class="ar-details"><div class="ar-details-placeholder"><h3>Messdatei auswählen</h3><p>Rechts erscheinen Messresultate, Gerätedaten, Signalverlauf und wichtige Ereignisse. Für den Direktvergleich links zwei Dateien markieren.</p></div></div></div>';
 }
 function init(){
  if(!$('archiveWorkspace'))return;
  $('archiveWorkspace').innerHTML=UI();
  $('archiveOpen').addEventListener('click',()=>open('archive'));
  $('verificationOpen').addEventListener('click',()=>open('verification'));
  $('archiveClose').addEventListener('click',close);
  $('archiveChoose').addEventListener('click',()=>chooseFolder().catch(e=>note(e.message,true)));
  $('archiveRefresh').addEventListener('click',()=>refresh());
  $('archiveStartCalibration').addEventListener('click',()=>ensureCalibration().then(()=>note('Kalibrierprotokoll gestartet. Jetzt wie gewohnt abgleichen.')).catch(e=>note(e.message,true)));
  $('arStart').addEventListener('click',()=>startVerification().catch(e=>note(e.message,true)));
  $('arMeasure').addEventListener('click',()=>measure());
  $('arNext').addEventListener('click',()=>advance().catch(e=>note(e.message,true)));
  $('arPrevious').addEventListener('click',previous);
  $('arEndVerification').addEventListener('click',()=>endVerification().catch(e=>note(e.message,true)));
  $('arEndCalibration').addEventListener('click',()=>{
   const m=bridge()?.meta?.(),complete=!!(m?.nvmDone&&(S.record?.type==='output'||m?.calVerified));
   finalise(complete?'completed':'incomplete').then(()=>note('Kalibrierprotokoll archiviert: '+(complete?'NVM geschrieben':'unvollständig')+'.')).catch(e=>note(e.message,true));
  });
  $('arAbort').addEventListener('click',()=>finalise('aborted').catch(e=>note(e.message,true)));
  $('arSaveCurrent').addEventListener('click',()=>flush().then(()=>note('Zwischenstand gespeichert.')).catch(e=>note(e.message,true)));
  for(const id of ['archiveMeasuredVdd','archiveMeasuredVddSource'])$(id).addEventListener('change',()=>{
   if(S.record)void event('supply_reference_changed',{actualVdd:$('archiveMeasuredVdd').value||null,
    source:$('archiveMeasuredVddSource').value||null}).catch(e=>note(e.message,true));
  });
  $('arMode').addEventListener('change',()=>{modeUI();preview()});
  for(const id of ['arPressurePath','arTempPath','arCycles','arFixedPressure','arFixedTemp'])$(id).addEventListener('change',preview);
  $('arPreview').addEventListener('click',preview);
  $('archiveSearch').addEventListener('input',renderList);
  for(const id of ['archiveFilterType','archiveFilterStatus'])$(id).addEventListener('change',renderList);
  $('archiveCompare').addEventListener('click',compare);
  modeUI();preview();renderActive();renderList();
  remembered('read').then(async dir=>{
   if(!dir)return;S.dir=dir;S.folderName=dir.name;
   text('archiveFolder',dir.name+' · Ordner vormerkt');
   if(await permitted(false))await refresh();
   else note('Archivordner bekannt. Falls nötig erneut auf «Archivordner auswählen» klicken, um den Zugriff freizugeben.');
  }).catch(()=>{});
 }
 function open(view='archive'){
  if(window.ELMOS_TEST_LOGGER?.isBusy()){
   window.ELMOS_TEST_LOGGER.warn('Testaufzeichnung läuft. Bitte zuerst beenden, bevor du die Ansicht wechselst.');
   return;
  }
  S.view=view==='verification'?'verification':'archive';
  text('arViewTitle',S.view==='verification'?'Nachmessung':'Kalibrierarchiv');
  text('arViewSubtitle',S.view==='verification'?
   'Druck- und Temperaturprüfpläne mit Hysterese und vollständigem lokalen Protokoll':
   'Abgleiche, Tests und Prüfergebnisse lokal durchsuchen, vergleichen und exportieren');
  document.documentElement.classList.add('archive-active');
  $('archiveWorkspace').hidden=false;
  renderActive();
 }
 function close(){
  document.documentElement.classList.remove('archive-active');
  $('archiveWorkspace').hidden=true;
 }
 return {init,open,openVerification:()=>open('verification'),close,begin,ensureCalibration,event,trace,appendTelemetry,streamRows,download,flush,finalise,interrupted,
  get active(){return !!S.record},get current(){return S.record},refresh};
})();
if(typeof window!=='undefined'){
 window.ELMOS_ARCHIVE=ELMOS_ARCHIVE;
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ELMOS_ARCHIVE.init);
 else ELMOS_ARCHIVE.init();
}
