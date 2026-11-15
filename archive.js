'use strict';
/* Local-only E703.11 archive and freely configurable post-calibration inspection. */
const ELMOS_ARCHIVE=(()=>{
 const C=ELMOS_ARCHIVE_CORE,ANALYSIS=ELMOS_ARCHIVE_ANALYSIS;
 const $=id=>document.getElementById(id);
 const S={dir:null,record:null,records:[],filename:null,writeQueue:Promise.resolve(),selection:[],step:0,
  measuring:false,finishing:false,finishedReview:null,showDetails:null,lastError:'',folderName:'',draft:null,view:'archive',detailsToken:0,resultsCache:new Map(),debugLines:[],debugDropped:0,lastStreamMetaFlush:0,pressureEntryBefore:'percent',pressureUnitBefore:'bar',autoRangeUid:null};
 const iso=()=>new Date().toISOString();
 const text=(id,value)=>{if($(id))$(id).textContent=String(value)};
 const note=(value,bad=false)=>{S.lastError=bad?String(value):'';text('archiveStatus',value);if($('archiveStatus'))$('archiveStatus').style.color=bad?'var(--red)':'var(--muted)'};
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
  text('archiveFolder',dir.name+' · '+ui('lokaler Ordner','local folder'));

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
  S.step=0;S.finishedReview=null;S.debugLines=[];S.debugDropped=0;S.lastStreamMetaFlush=0;
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
 async function finalise(status='incomplete',{snapshot}={}){
  if(!S.record)return;
  if(S.measuring)throw Error('Messung läuft');
  if(snapshot!==undefined)S.record.final=snapshot;
  else if(bridge()?.final)try{S.record.final=await bridge().final()}catch(e){
   S.record.events.push({at:iso(),kind:'error',data:{stage:'final_snapshot',message:e.message}});
  }
  if(status==='completed'&&S.record.type==='testlog'&&!(S.record.telemetry?.groups>0))
   status='incomplete';
  // A read-only verification can pass without NVM snapshots; calibration/output writes still require them.
  if(status==='completed'&&['calibration','output'].includes(S.record.type)&&(!Array.isArray(S.record.initial?.nvm?.words)||
   S.record.initial.nvm.words.length!==64||!Array.isArray(S.record.final?.nvm?.words)||
   S.record.final.nvm.words.length!==64))status='incomplete';
  if(status==='completed'&&S.record.type==='verification'){
   const summary=C.outcomes(S.record);
   const results=S.record.plan.steps.map(s=>C.lastAttempt(S.record,s.index));
   if(results.some(x=>x?.pass===false))status='failed';
   else if(summary.measured!==summary.planned||results.some(x=>x?.pass!==true))status='incomplete';
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
    data=window.ELMOS_TEST_LOGGER_CORE.csvRows(rows,{
     name:record.testConfiguration?.name,dutName:record.testConfiguration?.dutName,chipUID:record.chipUID
    });mime='text/csv;charset=utf-8';
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
   note(all.length+' '+(all.length===1?ui('gültiges Prüfprotokoll','valid test report'):ui('gültige Prüfprotokolle','valid test reports'))+
    ' '+ui('geladen','loaded')+
    (corrupt?' · '+corrupt+' '+ui('ungültige ELMOS-Dateien prüfen','invalid ELMOS files to review'):'')+'.');
  }catch(e){note('Archiv nicht lesbar: '+e.message,true)}
 }
 function readable(r){
  return [r.verificationMetadata?.operator,r.verificationMetadata?.project,
   r.verificationMetadata?.location,r.verificationMetadata?.externalInstruments,
   r.calibrationTool?.communicationAdapter,r.chipUID,r.customUID,r.initial?.configuredUserId,r.final?.configuredUserId,
   r.type,r.status,r.startedAt,r.equipment?.adapter,r.equipment?.adapterFirmware,
   r.equipment?.firmware,
   r.software?.version,r.testConfiguration?.name,r.testConfiguration?.dutName,
   r.testConfiguration?.description,
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
   ...(summary.dutName?[['Produkt / DUT',summary.dutName]]:[]),
   ['Chip-UID',summary.chipUID],['USER-ID',summary.userID],
   ['Adapter / Board',summary.board],['Adapter-Firmware',summary.adapterFirmware],
   ['E703.11 Chip-Version (Reg. 0x38)',summary.chipVersionRegister],
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
   summary.type==='verification'?kpi('Ausser Toleranz',num(summary.failedAttempts,0),
    'Fehlgeschlagene Prüfversuche'):kpi('Rohmessungen',num(summary.rawSamples,0),'Einzelne Sensorwerte'),
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
  const listScroll=root.scrollTop;
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
    ...(info.dutName?[el('span','DUT: '+info.dutName)]:[]),
    el('span',info.board||'Board unbekannt'),el('span','Web '+(info.appVersion||'?')));
   const quick=el('div',null,'ar-file-quick');
   quick.append(el('span',info.measurementPoints+' Punkte'),
    el('span',info.errors+' Fehler'),
    el('span',info.failedAttempts?info.failedAttempts+' ausser Toleranz':time(info.durationMs)));
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
  root.scrollTop=listScroll;
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
   el('h2',info.title));
  if(info.dutName)heading.append(el('p','Produkt / DUT: '+info.dutName,'ar-dut-line'));
  heading.append(el('p',info.description||info.chipUID||'–','ar-muted'));
  top.append(heading,el('span',info.statusLabel,'ar-pill'+
   (info.status==='completed'?' ar-good':info.status==='failed'?' ar-bad':'')));
  if(r.type==='verification'){
   const pdfBtn=el('button',ui('Prüfprotokoll als PDF speichern','Save verification report as PDF'),'ar-pdf-export');
   pdfBtn.type='button';
   pdfBtn.addEventListener('click',()=>exportVerificationPdf(r));
   top.append(pdfBtn);
  }
  root.append(top,outcome(info),section('Geräte- und Aufzeichnungsdaten'),facts(info));
  if(r.type==='verification'){
   const meta=r.verificationMetadata||{},tool=r.calibrationTool||
    calibrationToolFromMeta({equipment:r.equipment,software:r.software});
   const details=[
    [ui('Kalibrierwerkzeug (automatisch erkannt)','Calibration tool (automatically detected)'),formatCalibrationTool(tool)],
    [ui('Prüfer','Examiner'),meta.operator],
    [ui('Auftrag / Projekt','Order / Project'),meta.project],
    [ui('Prüfort / Prüfstand','Test location / Bench'),meta.location],
    [ui('Externe Messmittel','External instruments'),meta.externalInstruments],
    [ui('Zertifikat / Referenz','Certificate / Reference'),meta.instrumentCertificate],
    [ui('Zusätzliche Informationen','Additional information'),meta.notes]
   ].filter(([,v])=>v);
   const sectionBox=el('div',null,'ar-finished-metadata');
   for(const [key,value] of details){
    const item=el('div',null,'ar-finished-meta-item');
    item.append(el('small',key),el('strong',value));
    sectionBox.append(item);
   }
   root.append(section(ui('Prüfdokumentation','Verification documentation')),sectionBox);
  }
  // Reuse the live verification plot for stored results; this is read-only.
  // Keep it above hysteresis and event logs so results are visible at a glance.
  if(r.type==='verification'){
   root.append(section('Prüfergebnisse im Diagramm',
    'Messwerte, Toleranzgrenzen und Status aus dem gespeicherten Prüfprotokoll.'));
   const historicalChart=el('div',null,'ar-archive-verification-graph');
   root.append(historicalChart);
   if(window.ELMOS_VERIFICATION_GRAPH?.renderArchive){
    window.ELMOS_VERIFICATION_GRAPH.renderArchive(historicalChart,r);
   }else{
    historicalChart.append(el('p','Das Diagramm konnte nicht geladen werden. Bitte die Seite neu laden.','ar-warning'));
   }
  }
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
   col.append(el('h3',side.title),
    ...(side.dutName?[el('p','DUT: '+side.dutName,'ar-dut-line')]:[]),
    el('p',when(side.startedAt)+' · '+side.statusLabel,'ar-muted'),
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

 const UNIT_TO_BAR={bar:1,mbar:0.001,kPa:0.01,MPa:10,psi:0.0689475729318};
 const pFmt=n=>String(Number(Number(n).toPrecision(11)));
 function calRange(){
  const min=Number($('arCalMin').value),max=Number($('arCalMax').value),unit=$('arPressureUnit').value;
  if(!UNIT_TO_BAR[unit]||!$('arCalMin').value.trim()||!$('arCalMax').value.trim()||
    !Number.isFinite(min)||!Number.isFinite(max)||max<=min)
   throw Error('Bitte einen gültigen kalibrierten Druckbereich und die Druckeinheit angeben.');
  return {min,max,unit,span:max-min};
 }
 function dspRangeMatches(cfg){
  const live=bridge()?.digitalRange?.();
  if(live?.kind!=='ram'||!UNIT_TO_BAR[live.unit]||!UNIT_TO_BAR[cfg.pressureUnit]||
    !Number.isFinite(live.min)||!Number.isFinite(live.max)||!Number.isFinite(live.limit))return false;
  const source=UNIT_TO_BAR[live.unit],target=UNIT_TO_BAR[cfg.pressureUnit],eps=Math.max(1e-9,Math.abs(cfg.pressureSpan*target)*1e-7);
  return Math.abs(live.min*source-cfg.calibrationMin*target)<eps&&
   Math.abs(live.max*source-cfg.calibrationMax*target)<eps&&live.limit===cfg.dspLimit;
 }
 function addPressureUI(){
  const group=$('arPressurePathLabel').closest('.ar-grid');
  const range=el('div',null,'ar-grid');
  range.innerHTML='<label>Kalibrierter Druckbereich von<input id="arCalMin" type="number" step="any" value="0"></label>'+
   '<label>Kalibrierter Druckbereich bis<input id="arCalMax" type="number" step="any" value="10"></label>';
  group.before(range);
  const unit=$('arPressureUnit'),label=unit.closest('label');label.firstChild.textContent='Druckeinheit';
  unit.querySelector('option[value="%"]')?.remove();
  const mpa=el('option','MPa');mpa.value='MPa';unit.append(mpa);range.append(label);
  const row=el('div',null,'ar-grid');
  row.innerHTML='<label>Prüfpunkte eingeben als<select id="arPressureEntryMode"><option value="percent">% der Messspanne</option>'+
   '<option value="pressure">Druck</option></select></label>'+
   '<label>Digitaler DSP-Endwert (± Digits)<input id="arDspLimit" type="number" min="1000" max="32000" step="1" value="32000"></label>';
  group.before(row);
  const hint=el('p',null,'ar-inline-tip');hint.id='arDigitalRangeHint';row.after(hint);
  const details=el('details',null,'ar-optional-documentation');
  details.innerHTML='<summary>Ursprünglicher Sensorabgleich (optionale Dokumentation)</summary>'+
   '<p class="ar-inline-tip">Abgleichverfahren und Druck-/Temperaturpunkte dokumentieren, falls sie bekannt sind.</p>'+
   '<div class="ar-grid"><label>Abgleichverfahren<select id="arCalibrationMethod">'+
   '<option value="">Nicht angegeben</option><option value="2P">2-Punkt</option>'+
   '<option value="3P">3-Punkt</option><option value="multi">Mehrpunkt</option></select></label>'+
   '<label>Abgleichtemperaturen (°C, kommagetrennt)<input id="arCalibrationTemperatures" placeholder="z. B. 25, 75"></label></div>'+
   '<label>Ursprüngliche Abgleichpunkte (Druck / Temperatur)'+
   '<textarea id="arCalibrationPointNotes" rows="2" maxlength="2000" placeholder="z. B. 0 bar bei 25 °C; 6 bar bei 25 °C; 0 bar bei 75 °C"></textarea></label>';
  range.after(details);
  $('arPressurePathLabel').firstChild.textContent='Druckreihe (hin und zurück, % der Messspanne, kommagetrennt)';
  $('arPressurePath').value='0, 25, 50, 75, 100, 75, 50, 25, 0';
  $('arPressureSpan').readOnly=true;
  $('arPressureSpan').closest('label').firstChild.textContent='Druck-Messspanne (aus Kalibrierbereich)';
  $('arFixedPressure').closest('label').firstChild.textContent='Konstanter Prüfdruck (gewählte Einheit)';
  $('arPressureScaleConfirmed').closest('label').lastChild.textContent=' Digitalen DSP-Endwert und kalibrierten Druckbereich unabhängig geprüft (falls keine passende RAM-Skalierung erkannt wird).';
 }
 function scaleHint(){
  try{
   const c=calRange();
   const ok=dspRangeMatches({calibrationMin:c.min,calibrationMax:c.max,pressureUnit:c.unit,pressureSpan:c.span,dspLimit:Number($('arDspLimit').value)});
   text('arDigitalRangeHint',ok?'Digitale DSP_S-Skalierung entspricht dem aktuellen RAM-Abgleich.':
    'DSP_S wird digital gelesen und anhand von Druckbereich und DSP-Endwert umgerechnet. Ohne passenden RAM-Abgleich ist eine manuelle Bestätigung vor der Toleranzbewertung notwendig.');
  }catch(e){text('arDigitalRangeHint',e.message)}
 }
 function autoCalibrationRange(){
  const meta=bridge()?.meta?.();
  if(!meta?.online||!meta.uid||S.autoRangeUid===meta.uid)return;
  S.autoRangeUid=meta.uid;
  const range=bridge()?.digitalRange?.();
  if(range&&UNIT_TO_BAR[range.unit]&&Number.isFinite(range.min)&&Number.isFinite(range.max)&&range.max>range.min){
   $('arCalMin').value=pFmt(range.min);$('arCalMax').value=pFmt(range.max);
   $('arPressureUnit').value=range.unit;S.pressureUnitBefore=range.unit;
  }
  if(range&&Number.isInteger(range.limit)&&range.limit>=1000&&range.limit<=32000)$('arDspLimit').value=String(range.limit);
  $('arPressureScaleConfirmed').checked=false;
  modeUI();preview();
 }
 function onUnitChange(){
  const old=S.pressureUnitBefore,next=$('arPressureUnit').value;
  S.pressureUnitBefore=next;const factor=UNIT_TO_BAR[old]/UNIT_TO_BAR[next];
  if(Number.isFinite(factor)){
   for(const id of ['arCalMin','arCalMax','arFixedPressure','arAmbientPressure']){
    const field=$(id);if(field?.value.trim()&&Number.isFinite(Number(field.value)))field.value=pFmt(Number(field.value)*factor);
   }
   if($('arPressureEntryMode').value==='pressure'){
    try{$('arPressurePath').value=C.points($('arPressurePath').value,'Druckreihe').map(v=>pFmt(v*factor)).join(', ')}catch(_){}
   }
  }
  modeUI();preview();
 }
 function onEntryChange(){
  const old=S.pressureEntryBefore;S.pressureEntryBefore=$('arPressureEntryMode').value;
  try{
   const range=calRange();
   $('arPressurePath').value=C.points($('arPressurePath').value,'Druckreihe').map(v=>
    pFmt(old==='percent'?range.min+range.span*v/100:(v-range.min)/range.span*100)).join(', ');
  }catch(_){}
  preview();
 }
 function modeUI(){
  const mode=$('arMode').value;
  const hasPressure=mode!=='temperature';
  $('arPressurePathLabel').hidden=!hasPressure;
  $('arTempPathLabel').hidden=mode==='pressure';
  $('arFixedPressureLabel').hidden=mode!=='temperature';
  $('arFixedTempLabel').hidden=mode!=='pressure';
  $('arPressureReferenceSettings').hidden=!hasPressure;
  $('arPressurePath').disabled=!hasPressure;
  $('arTempPath').disabled=mode==='pressure';
  $('arFixedPressure').disabled=mode!=='temperature';
  $('arFixedTemp').disabled=mode!=='pressure';
  const correction=hasPressure&&$('arSensorType').value!==$('arReferenceKind').value;
  $('arAmbientPressureLabel').hidden=!correction;
  const unit=$('arPressureUnit')?.value||'bar';
  const supported=unit!=='%';
  $('arPressureFormula').textContent=!hasPressure?'':correction?
    (supported?ui('Für diese Kombination wird der gemessene Umgebungsdruck bei der Druckauswertung '+($('arSensorType').value==='absolute'?'addiert.':'subtrahiert.'),'The measured ambient pressure is '+($('arSensorType').value==='absolute'?'added':'subtracted')+' when evaluating this pressure reference.'):
    ui('Absolutdruckkorrektur ist mit Prozent als Druckeinheit nicht möglich. Bitte eine Druckeinheit wählen.','Absolute-pressure correction cannot use % as a pressure unit. Select a pressure unit.')):
    ui('Sensortyp und Kalibrator verwenden dieselbe Druckreferenz: keine Umgebungsdruck-Korrektur erforderlich.','Sensor and calibrator use the same pressure reference: no ambient-pressure correction is required.');
 }
 function effectivePressure(reference,mode){
  const sensorType=$('arSensorType')?.value||'gauge',referenceKind=$('arReferenceKind')?.value||'gauge';
  const pressureUnit=$('arPressureUnit')?.value||'bar';
  const needAmbient=mode!=='temperature'&&sensorType!==referenceKind;
  const ambient=Number($('arAmbientPressure')?.value);
  if(needAmbient&&(!Number.isFinite(ambient)||ambient<=0||pressureUnit==='%'))throw Error(ui('Für diesen Sensortyp ist ein gültiger gemessener Umgebungsdruck in derselben Druckeinheit erforderlich.','A valid measured ambient pressure in the same pressure unit is required for this sensor type.'));
  const delta=needAmbient?(sensorType==='absolute'?ambient:-ambient):0;
  return {value:reference+delta,ambientPressure:needAmbient?ambient:null,pressureUnit,
   sensorType,referenceKind,correctionApplied:needAmbient,correction:delta};
 }
 function config(){
  return {mode:$('arMode').value,
   pressure:$('arMode').value==='temperature'?[]:($('arPressureEntryMode').value==='percent'?
    C.points($('arPressurePath').value,'Druckreihe').map(v=>{const range=calRange();return range.min+range.span*v/100}):
    C.points($('arPressurePath').value,'Druckreihe')),temperature:$('arTempPath').value,
   fixedPressure:$('arFixedPressure').value,fixedTemperature:$('arFixedTemp').value,
   cycles:$('arCycles').value};
 }
 function preview(){
  try{
   const p=C.makePlan(config());S.draft=p;
   const range=calRange();
   p.calibrationRange={min:range.min,max:range.max,unit:range.unit};
   p.pressureEntryMode=$('arPressureEntryMode').value;
   p.originalPressurePath=$('arPressurePath').value;
   $('arPressureSpan').value=pFmt(range.span);
   $('arPressurePathLabel').firstChild.textContent='Druckreihe (hin und zurück, '+(p.pressureEntryMode==='percent'?'% der Messspanne':range.unit)+', kommagetrennt)';
   text('arPlanStatus',p.steps.length+' '+ui('Prüfpunkte','verification points')+' · '+p.cycles+
    ' '+ui('Zyklen','cycles')+
    (p.mode==='temperature'?'':' · '+p.pressure.length+' '+ui('Druckstufen','pressure levels'))+
    (p.mode==='pressure'?'':' · '+p.temperature.length+' '+ui('Temperaturstufen','temperature levels'))+'.');
   const nodes=p.steps.map(s=>(s.index+1)+'. '+
    (p.mode==='temperature'?'':ui('Druck ','Pressure ')+pFmt(s.pressure)+' '+range.unit+
     (p.pressureEntryMode==='percent'?' ('+pFmt((s.pressure-range.min)/range.span*100)+' %)':'')+' · ')+
    (s.temperature===null?'':ui('Temperatur ','Temperature ')+s.temperature+' °C')+
    (p.mode==='pressure'?'': ' · '+ui('Temperatur-Richtung ','Temperature direction ')+s.temperatureDirection));
   text('arPlanPreview',nodes.join('\n'));

  }catch(e){S.draft=null;text('arPlanStatus',e.message);text('arPlanPreview','')}
  scaleHint();
 }
 const ui=(de,en)=>document.documentElement.lang==='en'?en:de;
 function spanFromPlan(plan){
  if(!plan?.steps?.length)return 0;
  const values=plan.steps.map(p=>Number(p.pressure)).filter(Number.isFinite);
  return values.length?Math.max(...values)-Math.min(...values):0;
 }
 function chartSummary(record){
  return window.ELMOS_VERIFICATION_GRAPH?.summary?.(record)||{total:0,measured:0,passed:0,failed:0,unknown:0,pending:0,data:[]};
 }
 function renderStepStrip(info){
  const strip=$('arStepStrip');
  if(!strip)return;
  strip.replaceChildren();
  const record=S.record;
  if(!record?.plan)return;
  // For very long test plans show a focused window, with navigation through Next/Previous.
  const windowSize=36;
  const start=info.data.length<=windowSize?0:Math.min(info.data.length-windowSize,Math.max(0,S.step-Math.floor(windowSize/2)));
  const visible=info.data.slice(start,start+windowSize);
  if(info.data.length>windowSize)strip.append(el('small',ui('Punkte ','Points ')+(start+1)+'–'+(start+visible.length)+' / '+info.data.length));
  for(const item of visible){
   const button=el('button',String(item.index+1),'ar-step-chip '+item.status+(S.step===item.index?' current':''));
   button.type='button';
   const meaning=item.status==='pass'?ui('Bestanden','Passed'):item.status==='fail'?ui('Ausser Toleranz','Out of tolerance'):
    item.status==='unknown'?ui('Nicht bewertet','Not assessed'):ui('Noch offen','Pending');
   button.title=ui('Prüfpunkt ','Verification point ')+(item.index+1)+' · '+meaning;
   button.setAttribute('aria-current',S.step===item.index?'step':'false');
   button.addEventListener('click',()=>{if(S.measuring)return;S.step=item.index;renderStep()});
   strip.append(button);
  }
 }

 const shownNumber=(value,places=4)=>Number.isFinite(value)?
  value.toLocaleString(document.documentElement.lang==='en'?'en-US':'de-CH',{maximumFractionDigits:places}):'–';
 const testStatus=(state)=>state==='pass'?ui('Bestanden','Passed'):state==='fail'?
  ui('Ausser Toleranz','Out of tolerance'):state==='unknown'?
  ui('Nicht bewertet','Not assessed'):ui('Offen','Pending');
 function capturedValue(item,mode){
  const sample=item?.sample;
  if(!sample)return ui('Noch keine Messung','No measurement yet');
  if(mode==='temperature'){
   if(Number.isFinite(sample.sensorTempC))return shownNumber(sample.sensorTempC,3)+' °C';
   return Number.isFinite(sample.dspT)?'DSP_T '+shownNumber(sample.dspT,0)+' Digits':'–';
  }
  if(Number.isFinite(sample.sensorPressure))
   return shownNumber(sample.sensorPressure,5)+' '+(sample.pressureUnit||'');
  return Number.isFinite(sample.dspS)?'DSP_S '+shownNumber(sample.dspS,0)+' Digits':'–';
 }
 function renderMeasuredValue(last,mode){
  const card=$('arMeasuredValue');if(!card)return;
  const entry=last?.item||null;
  const status=last?.status||'pending';
  card.className='ar-measured-value '+status;
  text('arMeasuredNumber',capturedValue(entry,mode));
  if(!entry){
   text('arMeasuredContext',ui('Der letzte Messwert erscheint direkt nach der Aufnahme.','The latest recorded reading appears here immediately after capture.'));
   return;
  }
  const sample=entry.sample||{};
  const raw=Number.isFinite(sample.dspS)?'DSP_S '+shownNumber(sample.dspS,0)+' Digits':'';
  const at=sample.at?new Date(sample.at):null;
  const capturedAt=at&&!Number.isNaN(at.getTime())?
   ui(' · aufgenommen ',' · captured ')+at.toLocaleTimeString(document.documentElement.lang==='en'?'en-US':'de-CH'):'';
  const comparison=(entry.pass===true?ui('Bestanden','Passed'):entry.pass===false?
   ui('Ausser Toleranz','Out of tolerance'):ui('Nicht bewertet','Not assessed'));
  text('arMeasuredContext',comparison+(raw?' · '+raw:'')+capturedAt);
 }

 // Software and USB calibration/programming adapter are detected from the active
 // connection. External pressure calibrators / climate chambers cannot be
 // identified via this interface and remain optional user-entered instruments.
 function calibrationToolFromMeta(meta){
  const equipment=meta?.equipment||{};
  const software=meta?.software||{};
  const adapter=String(equipment.adapter||'').trim()||null;
  const version=String(software.version||document.body?.dataset?.appVersion||'').trim()||null;
  return {
   application:'ELMOS E703.11 Calibration Assistant',
   applicationVersion:version,
   communicationAdapter:adapter,
   adapterKind:String(equipment.adapterKind||'').trim()||null,
   interface:String(equipment.interface||'').trim()||null,
   adapterFirmware:String(equipment.adapterFirmware||equipment.firmware||'').trim()||null,
   serialPort:String(equipment.serialPort||'').trim()||null,
   detectedAutomatically:!!adapter,
   detectedAt:iso()
  };
 }
 function formatCalibrationTool(tool){
  if(!tool)return ui('Kein Adapter erkannt','No adapter detected');
  const app=(tool.application||'ELMOS E703.11 Calibration Assistant')+
   (tool.applicationVersion?' v'+tool.applicationVersion:'');
  const adapter=tool.communicationAdapter||ui('Kein Adapter erkannt','No adapter detected');
  return app+' · '+adapter;
 }
 function refreshDetectedCalibrationTool(){
  const tool=calibrationToolFromMeta(bridge()?.meta?.());
  text('arDetectedCalibrationTool',formatCalibrationTool(tool));
  text('arDetectedCalibrationToolDetails',[
   tool.interface?ui('Schnittstelle: ','Interface: ')+tool.interface:null,
   tool.adapterFirmware?ui('Adapter-Firmware: ','Adapter firmware: ')+tool.adapterFirmware:null,
   ui('Externe Messmittel sind nicht automatisch erkennbar und können optional ergänzt werden.',
    'External measurement instruments cannot be detected automatically and may be entered below.')
  ].filter(Boolean).join(' · '));
 }
 const trimInput=(id,max)=>{
  const value=String($(id)?.value||'').trim();
  return value?value.slice(0,max):null;
 };
 function optionalVerificationMetadata(){
  return {
   operator:trimInput('arVerificationOperator',120),
   project:trimInput('arVerificationProject',150),
   location:trimInput('arVerificationLocation',160),
   instrumentCertificate:trimInput('arVerificationCertificate',200),
   externalInstruments:trimInput('arVerificationInstruments',3000),
   notes:trimInput('arVerificationNotes',4000)
  };
 }
 function exportVerificationPdf(record){
  if(!record||record.type!=='verification'){
   note(ui('Kein gespeichertes Prüfprotokoll für den PDF-Export ausgewählt.',
    'No saved verification report selected for PDF export.'),true);
   return;
  }
  if(!window.ELMOS_VERIFICATION_REPORT?.print){
   note(ui('PDF-Bericht nicht geladen. Bitte Seite neu laden.',
    'PDF report module is not loaded. Please refresh the page.'),true);
   return;
  }
  try{
   const ok=window.ELMOS_VERIFICATION_REPORT.print(record);
   if(!ok)note(ui('Der Browser hat das PDF-Fenster blockiert. Bitte Pop-ups für diese Webseite erlauben.',
    'The browser blocked the PDF report window. Please allow pop-ups for this site.'),true);
  }catch(e){
   note(ui('PDF-Export fehlgeschlagen: ','PDF export failed: ')+e.message,true);
  }
 }
 function renderFinishedReview(record){
  if(!record?.plan)return;
  const summary=chartSummary(record);
  const mode=record.plan.mode;
  const unit=record.verificationConfig?.pressureUnit||'';
  const status=record.status;
  text('arFinishedTitle',ui('Nachmessung gespeichert','Verification saved'));
  text('arFinishedSubtitle',ui('Prüfung am ','Test for ')+(record.chipUID||'–')+
   ' · '+ui('Archivstatus: ','Archive status: ')+(statusWords[status]||status)+
   ' · '+summary.measured+' / '+summary.total+' '+ui('Prüfpunkte gemessen','points measured'));
  const stats=$('arFinishedStats');stats.replaceChildren();
  for(const [count,label,css] of [
   [summary.total,ui('Geplante Prüfpunkte','Planned points'),'total'],
   [summary.passed,ui('Bestanden','Passed'),'pass'],
   [summary.failed,ui('Ausser Toleranz','Out of tolerance'),'fail'],
   [summary.unknown,ui('Nicht bewertet','Not assessed'),'unknown'],
   [summary.pending,ui('Ohne Messung','Not measured'),'pending']
  ]){
   const tile=el('div',null,'ar-finished-stat '+css);
   tile.append(el('strong',count),el('span',label));
   stats.append(tile);
  }

  const metaHost=$('arFinishedMetadata');metaHost.replaceChildren();
  const tool=record.calibrationTool||calibrationToolFromMeta({software:record.software,equipment:record.equipment});
  const operator=record.verificationMetadata||{};
  const entries=[
   [ui('Kalibrierwerkzeug (automatisch erkannt)','Calibration tool (automatically detected)'),formatCalibrationTool(tool)],
   [ui('Adapter-Firmware','Adapter firmware'),tool.adapterFirmware],
   [ui('Abgleichbereich','Calibrated pressure range'),Number.isFinite(record.verificationConfig?.calibrationMin)?shownNumber(record.verificationConfig.calibrationMin)+' – '+shownNumber(record.verificationConfig.calibrationMax)+' '+unit:null],
   [ui('Prüfpunkt-Eingabe','Point input unit'),record.verificationConfig?.pressureEntryMode==='percent'?'%':unit],
   [ui('DSP-Endwert','DSP limit'),Number.isFinite(record.verificationConfig?.dspLimit)?'±'+record.verificationConfig.dspLimit+' Digits':null],
   [ui('Ursprüngliches Abgleichverfahren','Original calibration method'),record.verificationConfig?.calibrationMethod],
   [ui('Abgleichtemperaturen','Calibration temperatures'),record.verificationConfig?.calibrationTemperatures],
   [ui('Abgleichpunkte','Calibration points'),record.verificationConfig?.originalCalibrationPoints],
   [ui('Prüfer','Examiner'),operator.operator],
   [ui('Auftrag / Projekt','Order / Project'),operator.project],
   [ui('Prüfort','Test location'),operator.location],
   [ui('Messmittel / Prüfmittel','Measurement instruments'),operator.externalInstruments],
   [ui('Zertifikat / Referenz','Certificate / Reference'),operator.instrumentCertificate],
   [ui('Bemerkungen','Notes'),operator.notes]
  ].filter(([key,val])=>val);
  for(const [name,value] of entries){
   const item=el('div',null,'ar-finished-meta-item');
   item.append(el('small',name),el('strong',value));
   metaHost.append(item);
  }
  const chartHost=$('arFinishedChart');
  const rows=$('arFinishedRows');rows.replaceChildren();
  const selectPoint=index=>{
   window.ELMOS_VERIFICATION_GRAPH?.render?.(chartHost,record,index,selectPoint);
   for(const row of rows.querySelectorAll('tr'))row.classList.toggle('selected',Number(row.dataset.point)===index);
  };
  for(const data of summary.data){
   const row=el('tr',null,'ar-finished-row '+data.status);
   row.dataset.point=String(data.index);
   const step=data.step,attempt=data.item;
   const refParts=[];
   if(mode!=='temperature')refParts.push(shownNumber(step.pressure,5)+' '+unit);
   if(mode!=='pressure'&&step.temperature!==null)refParts.push(shownNumber(step.temperature,2)+' °C');
   const actual=capturedValue(attempt,mode);
   let deviation=ui('Nicht bewertet','Not assessed');
   if(mode==='temperature'&&Number.isFinite(data.tempError))
    deviation=(data.tempError>0?'+':'')+shownNumber(data.tempError,4)+' °C';
   else if(mode!=='temperature'&&Number.isFinite(data.pressurePct))
    deviation=(data.pressurePct>0?'+':'')+shownNumber(data.pressurePct,4)+' % FS';
   else if(mode!=='temperature'&&Number.isFinite(data.previewPercent))
    deviation=ui('Ungeprüft: ','Unverified: ')+(data.previewPercent>0?'+':'')+shownNumber(data.previewPercent,4)+' % FS';
   for(const val of [String(data.index+1),refParts.join(' · ')||'–',actual,deviation,testStatus(data.status)]){
    row.append(el('td',val));
   }
   row.tabIndex=0;
   row.setAttribute('aria-label',ui('Ergebnis zu Prüfpunkt ','Result for verification point ')+(data.index+1));
   row.addEventListener('click',()=>selectPoint(data.index));
   row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectPoint(data.index)}});
   rows.append(row);
  }
  selectPoint(0);
  text('arFinishedFootnote',ui(
   'Das Prüfprotokoll wurde im ausgewählten lokalen Archiv gespeichert. Nicht bewertete oder fehlgeschlagene Prüfpunkte bleiben im Bericht sichtbar. Die Grafik und die Messwerte können hier nur angesehen werden.',
   'The verification report was saved to the selected local archive. Unassessed and failed points remain visible. This overview is read-only.'));
 }
 function renderActive(){
  const r=S.record;
  const visible=!!r&&(S.view!=='archive'||r.type!=='verification');
  $('arActive').hidden=!visible;
  const finished=S.view==='verification'&&!!S.finishedReview&&!r;
  $('arFinishedSummary').hidden=!finished;
  $('arPlanner').hidden=!!r||finished||S.finishing||S.view!=='verification';
  if(finished)renderFinishedReview(S.finishedReview);
  $('arResults').hidden=S.view!=='archive';
  $('archiveStartCalibration').hidden=S.view!=='archive';
  $('arEndCalibration').hidden=!r||r.type==='verification';
  $('arEndVerification').hidden=!r||r.type!=='verification';
  $('arResultChart').parentElement.hidden=!r||r.type!=='verification';
  $('arStepStrip').hidden=!r||r.type!=='verification';
  $('arGuideProgress').hidden=!r||r.type!=='verification';
  if(r){
   text('arActiveState',r.type==='verification'?
    ui('Prüfung · ','Verification · ')+(r.chipUID||'?'):
    S.view==='verification'?ui('Es läuft noch ein Kalibrierprotokoll. Bitte zuerst abschliessen oder archivieren.','A calibration log is still active. Finish or archive it before starting verification.'):
    (typeWords[r.type]||r.type)+' · '+(r.chipUID||'?')+' · '+(statusWords[r.status]||r.status));
  }
  if(r?.plan&&r.type==='verification')renderStep();
  else $('arMeasureControls').hidden=true;
 }
 function renderStep(){
  const r=S.record;
  if(!r?.plan||r.type!=='verification')return;
  const total=r.plan.steps.length;
  S.step=Math.max(0,Math.min(S.step,total));
  const done=S.step>=total;
  const point=done?null:r.plan.steps[S.step];
  const overview=chartSummary(r);
  $('arMeasureControls').hidden=done;
  $('arEndVerification').hidden=!done;
  const progress=(overview.total>0?overview.measured/overview.total:0)*100;
  text('arOverallProgress',ui('Prüfablauf: ','Test progress: ')+overview.measured+' / '+overview.total);
  $('arProgressFill').style.width=progress.toFixed(1)+'%';
  text('arOverallVerdict',overview.passed+' '+ui('bestanden','passed')+' · '+overview.failed+' '+ui('ausser Toleranz','out of tolerance')+
   (overview.unknown?' · '+overview.unknown+' '+ui('nicht bewertet','not assessed'):''));
  renderStepStrip(overview);
  if(!done){
   text('arStepHeading',ui('Prüfpunkt ','Point ')+(S.step+1)+' / '+total);
   const d1=point.pressureDirection==='up'?ui('steigend','increasing'):point.pressureDirection==='down'?ui('fallend','decreasing'):ui('konstant','constant');
   const d2=point.temperatureDirection==='up'?ui('steigend','increasing'):point.temperatureDirection==='down'?ui('fallend','decreasing'):ui('konstant','constant');
   const mode=r.plan.mode;
   const temperatureShown=mode!=='pressure'&&point.temperature!==null;
   $('arRefTempLabel').hidden=!temperatureShown;
   $('arRefPressureLabel').hidden=mode==='temperature';
   const unit=r.verificationConfig?.pressureUnit||$('arPressureUnit').value||'bar';
   const targetPressure=(r.verificationConfig?.correctionApplied?
    point.pressure+(r.verificationConfig?.sensorType==='absolute'?1:-1)*(r.verificationConfig?.ambientPressure||0):
    point.pressure);
   text('arStepDescription',ui('Soll: ','Target: ')+
    (mode==='temperature'?'':ui('Druck ','Pressure ')+point.pressure+' '+unit+' · ')+
    (temperatureShown?ui('Temperatur ','Temperature ')+point.temperature+' °C · ':'')+
    (r.verificationConfig?.correctionApplied&&mode!=='temperature'?ui('Korrigierter Sensor-Sollwert: ','Corrected sensor target: ')+Number(targetPressure.toFixed(5))+' '+unit+' · ':'')+
    (mode==='temperature'?'':ui('Druckrichtung ','Pressure direction ')+d1)+
    (mode==='pressure'?'':(mode==='temperature'?'':' · ')+ui('Temperaturrichtung ','Temperature direction ')+d2));
   if($('arPointKey').value!==String(S.step)){
    $('arRefPressure').value=String(point.pressure);
    $('arRefTemp').value=point.temperature===null?'':String(point.temperature);
    $('arPointKey').value=String(S.step);
   }
   const last=overview.data[S.step]||null;
   const attempts=last?.tries||0;
   const status=last?.status||'pending';
   renderMeasuredValue(last,mode);
   text('arAttemptNote',attempts?
     attempts+' '+ui('Versuch(e) gespeichert. Du kannst wiederholen oder weitergehen.','attempt(s) saved. You can repeat or continue.'):
     ui('Noch keine Messung. Stelle die Sollwerte ein und starte die Aufnahme.','No measurement yet. Set the target values and start capture.'));
   text('arEvaluationHint',status==='fail'?
    ui('Ausserhalb der Toleranz: Bedingungen prüfen und bei Bedarf erneut messen.','Out of tolerance: check conditions and repeat if needed.'):
    status==='pass'?ui('Prüfpunkt bestanden. Du kannst mit dem nächsten Punkt fortfahren.','Point passed. You can continue to the next point.'):
    status==='unknown'?ui('Die Auswertung ist offen. Kontrolliere die bestätigte Druck-/Temperaturumrechnung unter «Weitere Einstellungen».','Assessment pending. Check the verified pressure/temperature conversion under Additional settings.'):
    ui('Hinweis: Maximal 0,2 % FS Druckabweichung als Standard. Unter «Weitere Einstellungen» anpassbar.','Note: default maximum pressure deviation is 0.2% FS. Change under Additional settings.'));
   $('arPrevious').disabled=S.measuring||S.finishing||S.step===0;
   $('arNext').disabled=S.measuring||S.finishing;
   $('arNext').textContent=S.step===total-1?
    (S.finishing?ui('Speichern …','Saving …'):ui('Prüfung abschliessen und speichern','Finish verification and save')):
    ui('Nächster Punkt →','Next point →');
   $('arNext').classList.toggle('primary',S.step===total-1);
   $('arMeasure').disabled=S.measuring||S.finishing;
   $('arMeasure').textContent=S.measuring?ui('Messung läuft …','Measuring …'):
    attempts?ui('Messung wiederholen','Repeat measurement'):ui('Messpunkt aufnehmen','Capture point');
  }else{
   text('arStepHeading',ui('Alle Punkte bearbeitet','All points processed'));
   text('arStepDescription',ui('Prüfe die Übersicht und schliesse die Nachmessung ab. Rot markierte oder nicht bewertete Punkte bleiben im Protokoll sichtbar.','Review the overview and finish verification. Failed and unassessed points remain visible in the log.'));
  }
  window.ELMOS_VERIFICATION_GRAPH?.render?.($('arResultChart'),r,S.step,(index)=>{
   if(!S.measuring){S.step=index;renderStep()}
  });
 }
 async function measure(){
  const r=S.record;
  if(!r||r.type!=='verification'||S.measuring||!r.plan)return;
  const step=r.plan.steps[S.step];if(!step)return;
  const p=Number($('arRefPressure').value);
  const tValue=$('arRefTemp').value.trim();
  const t=tValue===''?null:Number(tValue);
  const tolerancePercent=Number($('arToleranceP').value),toleranceT=Number($('arToleranceT').value),
   pressureSpan=Number(r.verificationConfig?.pressureSpan),count=Number($('arSamples').value);
  const mode=r.plan.mode;
  // Pressure tolerance is expressed in % FS; a zero-pressure reference is valid.
  const toleranceP=mode==='temperature'?null:pressureSpan*tolerancePercent/100;
  let pressureReference;
  try{pressureReference=effectivePressure(p,mode)}
  catch(error){return note(error.message,true)}
  if(!Number.isFinite(p)||(mode!=='pressure'&&!Number.isFinite(t))||
   !Number.isFinite(tolerancePercent)||tolerancePercent<0||
   (mode!=='temperature'&&(!Number.isFinite(pressureSpan)||pressureSpan<=0))||
   !Number.isFinite(toleranceT)||toleranceT<0||!Number.isInteger(count)||count<1||count>100)
   return note(ui('Referenzen, Toleranz oder Messspanne ungültig. Bitte «Weitere Einstellungen» prüfen.','Invalid reference, tolerance or pressure span. Check Additional settings.'),true);
  const attempts=r.events.filter(e=>e.kind==='measurement'&&(e.data?.stepIndex??e.stepIndex)===S.step).length;
  S.measuring=true;$('arMeasure').disabled=true;
  note('Messung '+(attempts+1)+' läuft …');
  try{
   if(bridge()?.meta?.()?.uid!==r.chipUID)throw Error('Anderer Sensor verbunden: Die Chip-UID stimmt nicht mit dem gestarteten Prüfprotokoll überein.');
   const sample=await bridge().measure(count);
   const cfg=r.verificationConfig||{},limit=cfg.dspLimit;
   if(!Number.isFinite(sample.dspS)||!Number.isFinite(limit)||limit<=0)
    throw Error('Digitaler DSP_S-Messwert oder DSP-Endwert fehlt.');
   // Digital measurement only: no voltage / current or ratiometric conversion.
   sample.sensorPressure=cfg.calibrationMin+(sample.dspS+limit)/(2*limit)*cfg.pressureSpan;
   sample.pressureUnit=cfg.pressureUnit;
   const matched=dspRangeMatches(cfg),confirmed=matched||$('arPressureScaleConfirmed').checked;
   sample.pressureConversionKind=matched?'matched-ram':confirmed?'operator-confirmed':'unverified';
   sample.pressureConversion=matched?'Übereinstimmende RAM-Skalierung':
     confirmed?'DSP-Endwert und Druckbereich vom Prüfer bestätigt':'Digitaler Abgleichbereich noch nicht bestätigt';
   sample.digitalMapping={min:cfg.calibrationMin,max:cfg.calibrationMax,
    unit:cfg.pressureUnit,limit,source:sample.pressureConversionKind};
   const expectedUnit=pressureReference.pressureUnit;
   const matchingUnit=sample.pressureUnit===expectedUnit;
   const pressureConfirmed=confirmed&&matchingUnit;
   sample.pressureConfidence=pressureConfirmed?'confirmed':'unverified';
   sample.pressureReferenceMismatch=!matchingUnit;
   sample.expectedPressureUnit=pressureReference.pressureUnit;
   sample.pressureTarget=pressureReference.value;
   const errP=mode!=='temperature'&&pressureConfirmed&&Number.isFinite(sample.sensorPressure)?
    sample.sensorPressure-pressureReference.value:null;
   // °C conversions require an operator-verified model. Always preserve DSP_T raw.
   const tempConfirmed=mode!=='pressure'&&$('arTempConversionConfirmed').checked;
   const tempScale=Number($('arTempScale').value),tempOffset=Number($('arTempOffset').value);
   if(tempConfirmed&&(!Number.isFinite(tempScale)||tempScale===0||!Number.isFinite(tempOffset)))
    throw Error('Temperatur-Umrechnung benötigt gültige Skalierung und Offset');
   sample.sensorTempC=tempConfirmed&&Number.isFinite(sample.dspT)?(sample.dspT-tempOffset)/tempScale:null;
   sample.temperatureConfidence=tempConfirmed?'confirmed':'unverified';
   sample.temperatureConversion=tempConfirmed?{operatorConfirmed:true,dspTScaleDigitsPerC:tempScale,
    dspTOffsetDigits:tempOffset,source:'Manuelle Bestätigung, nicht vom System validiert'}:
    {operatorConfirmed:false,source:'Rohdaten ohne kalibrierte °C-Umrechnung'};
   const errT=mode!=='pressure'&&Number.isFinite(sample.sensorTempC)&&Number.isFinite(t)?sample.sensorTempC-t:null;
   const pPass=errP===null?null:Math.abs(errP)<=toleranceP+1e-12;
   const tPass=errT===null?null:Math.abs(errT)<=toleranceT+1e-12;
   const pass=mode==='pressure'?pPass:mode==='temperature'?tPass:
    (pPass===false||tPass===false)?false:(pPass===null||tPass===null)?null:true;
   await event('measurement',{stepIndex:S.step,attempt:attempts+1,
    referencePressure:pressureReference.value,referencePressureInput:p,referenceTemperature:t,
    referenceSource:$('arReferenceSource').value||'Manuelle Eingabe',setpoint:step,
    pressureSensorType:pressureReference.sensorType,pressureReferenceKind:pressureReference.referenceKind,
    atmosphericPressure:pressureReference.ambientPressure,
    pressureUnit:pressureReference.pressureUnit,pressureCorrection:pressureReference.correction,
    pressureTolerance:toleranceP,pressureTolerancePercent:tolerancePercent,
    pressureFullScaleSpan:mode==='temperature'?null:pressureSpan,
    temperatureTolerance:toleranceT,
    pressureError:errP,temperatureError:errT,pressureVerdict:pPass,temperatureVerdict:tPass,
    pass,sample});
   const errPercent=Number.isFinite(errP)&&pressureSpan>0?errP/pressureSpan*100:null;
   note(ui('Prüfpunkt ','Point ')+(S.step+1)+' · '+
    (pass===true?ui('Bestanden','Passed'):pass===false?ui('Ausser Toleranz','Out of tolerance'):ui('Nicht bewertet','Not assessed'))+
    (mode==='temperature'?' · '+ui('Temperaturabweichung ','Temperature deviation ')+(errT===null?'–':errT.toFixed(3)+' °C'):
    ' · '+ui('Druckabweichung ','Pressure deviation ')+(errPercent===null?'–':errPercent.toFixed(4)+' % FS')+' / '+tolerancePercent+' % FS')+
    (!matchingUnit&&mode!=='temperature'?' · '+ui('Einheiten nicht identisch: ','Units differ: ')+(sample.pressureUnit||'–')+' / '+expectedUnit:''),
    pass===false);
  }catch(e){
   try{await event('error',{stage:'verification_measurement',stepIndex:S.step,attempt:attempts+1,message:e.message,rawSamples:e.rawSamples||null,partialReadErrors:e.partialReadErrors||null})}
   catch(_){}
   note('Messung fehlgeschlagen: '+e.message,true);
  }finally{S.measuring=false;renderStep()}
 }
 async function advance(){
  if(!S.record?.plan||S.measuring||S.finishing)return;
  const current=S.step,total=S.record.plan.steps.length;
  const hasAttempt=S.record.events.some(e=>e.kind==='measurement'&&(e.data?.stepIndex??e.stepIndex)===current);
  if(current<total&&!hasAttempt){
   const prompt=current===total-1?
    ui('Den letzten Prüfpunkt ohne Messung abschliessen und als unvollständig speichern?','Finish without measuring the last point and save as incomplete?'):
    ui('Diesen Prüfpunkt ohne Messung überspringen? Er wird im Protokoll als offen markiert.','Skip this point without measuring? It will remain unassessed in the log.');
   if(!window.confirm(prompt))return;
   await event('point_skipped',{stepIndex:current,reason:'Manuell übersprungen'});
  }
  if(current>=total-1){
   await endVerification();
   return;
  }
  S.step=current+1;
  renderStep();
 }
 function previous(){if(!S.record?.plan||S.measuring)return;S.step=Math.max(0,S.step-1);renderStep()}
 async function startVerification(){
  // Revalidate the draft and full-scale configuration before creating an archive record.
  preview();
  if(!S.draft)throw Error(ui('Bitte den Prüfplan korrigieren.','Please correct the test plan.'));
  const calibrated=calRange(),span=calibrated.span;
  const dspLimit=Number($('arDspLimit').value);
  if(!Number.isInteger(dspLimit)||dspLimit<1000||dspLimit>32000)
   throw Error('Der digitale DSP-Endwert muss zwischen 1000 und 32000 Digits liegen.');
  if(S.draft.mode!=='temperature')effectivePressure(0,S.draft.mode);
  if(S.draft.mode!=='temperature'&&(!Number.isFinite(span)||span<=0))
   throw Error(ui('Eine positive Druck-Messspanne ist für die Prozenttoleranz erforderlich.','A positive full-scale pressure span is required for the percentage tolerance.'));
  refreshDetectedCalibrationTool();
  const percent=Number($('arToleranceP').value);
  if(!Number.isFinite(percent)||percent<0)throw Error(ui('Ungültige Drucktoleranz.','Invalid pressure tolerance.'));
  await begin('verification',S.draft);
  if(!S.record)return;
  const correction=effectivePressure(0,S.draft.mode);
  S.record.verificationMetadata=optionalVerificationMetadata();
  S.record.calibrationTool=calibrationToolFromMeta(bridge()?.meta?.());
  S.record.verificationConfig={pressureTolerancePercent:percent,pressureSpan:span,
   calibrationMin:calibrated.min,calibrationMax:calibrated.max,dspLimit,
   pressureEntryMode:S.draft.pressureEntryMode,inputPressurePath:S.draft.originalPressurePath,
   calibrationMethod:$('arCalibrationMethod').value||null,
   calibrationTemperatures:$('arCalibrationTemperatures').value.trim()||null,
   originalCalibrationPoints:$('arCalibrationPointNotes').value.trim()||null,
   digitalReadout:'DSP_S',digitalRangeAutoVerified:dspRangeMatches({calibrationMin:calibrated.min,
    calibrationMax:calibrated.max,pressureSpan:span,pressureUnit:calibrated.unit,dspLimit}),
   toleranceBasis:'percent_full_scale',temperatureTolerance:Number($('arToleranceT').value),
   pressureUnit:correction.pressureUnit,sensorType:correction.sensorType,
   referenceKind:correction.referenceKind,ambientPressure:correction.ambientPressure,
   correctionApplied:correction.correctionApplied,ambientTemperature:S.draft.mode==='pressure'?(S.draft.temperature[0]??null):null};
  await flush();
  renderActive();
  note(ui('Nachmessung gestartet. Referenzwerte manuell am Prüfstand einstellen.','Verification started. Apply the reference values manually at the test bench.'));
 }
 async function endVerification(){
  if(!S.record?.plan||S.record.type!=='verification'||S.finishing||S.measuring)return;
  S.finishing=true;
  $('arNext').disabled=true;
  $('arEndVerification').disabled=true;
  note(ui('Prüfung wird gespeichert …','Saving verification …'));
  try{
   const saved=await finalise('completed');
   if(!saved||!saved.id)throw Error(ui('Das Protokoll konnte nicht bestätigt werden.','The saved report could not be confirmed.'));
   S.finishedReview=saved;
   renderActive();
   note(ui('Prüfung im lokalen Archiv gespeichert. Du kannst alle Ergebnisse prüfen und danach zur Hauptseite zurückkehren.',
    'Verification saved to the local archive. Review all results, then return to the main page.'));
  }finally{
   S.finishing=false;
   $('arEndVerification').disabled=false;
   if(S.record?.type==='verification')renderStep();
  }
 }
 function UI(){
  return '<div class="ar-top"><div><h2 id="arViewTitle">Kalibrierarchiv</h2><p id="arViewSubtitle">Vollständig lokal · archivierte Abgleiche, Tests und Prüfprotokolle durchsuchen</p></div><button id="archiveClose">Zur Webseite zurück</button></div>'+
  '<div class="ar-bar"><button id="archiveChoose" class="primary">Archivordner auswählen</button><span id="archiveFolder">Noch kein Archivordner gewählt</span><button id="archiveRefresh">Ordner einlesen</button><button id="archiveStartCalibration">Abgleich protokollieren</button></div>'+
  '<p id="archiveStatus" role="status">Bitte einen lokalen Ordner auswählen. Fremde Dateien im Ordner werden ignoriert.</p>'+
  "\n<div class=\"ar-active\" id=\"arActive\" hidden>\n  <div class=\"ar-guide-progress\" id=\"arGuideProgress\" aria-live=\"polite\">\n    <strong id=\"arOverallProgress\">Prüffortschritt</strong><div class=\"ar-progress-track\"><span id=\"arProgressFill\"></span></div><span id=\"arOverallVerdict\">–</span>\n  </div>\n  <div class=\"ar-step-strip\" id=\"arStepStrip\" aria-label=\"Prüfpunkte direkt auswählen\"></div>\n  <div class=\"ar-workspace-grid\">\n    <section class=\"ar-wizard-card\">\n      <h3 id=\"arActiveState\"></h3>\n      <div id=\"arMeasureControls\" hidden>\n        <div class=\"ar-wizard-head\"><div><div class=\"ar-wizard-title\"><span class=\"ar-number-pill\">2</span><span id=\"arStepHeading\">Prüfpunkt</span></div>\n        <p class=\"ar-wizard-subtitle\" id=\"arStepDescription\"></p></div></div>\n        <input id=\"arPointKey\" type=\"hidden\" value=\"-1\">\n        <p class=\"ar-measure-intro\">Stelle den Prüfdruck am Kalibrator ein und starte die Messung, sobald die Bedingungen stabil sind.</p>\n        <div class=\"ar-ref-inputs\">\n          <label id=\"arRefPressureLabel\">Referenzdruck<input id=\"arRefPressure\" type=\"number\" step=\"any\"></label>\n          <label id=\"arRefTempLabel\">Referenztemperatur (°C)<input id=\"arRefTemp\" type=\"number\" step=\"any\"></label>\n        </div>\n        <div id=\"arMeasuredValue\" class=\"ar-measured-value pending\" role=\"status\" aria-live=\"polite\">\n          <span class=\"ar-measured-label\">Gemessener Sensorwert</span>\n          <strong id=\"arMeasuredNumber\">Noch keine Messung</strong>\n          <small id=\"arMeasuredContext\">Der letzte Messwert erscheint direkt nach der Aufnahme.</small>\n        </div>\n        <button id=\"arMeasure\" class=\"primary ar-action-primary\" type=\"button\">Messpunkt aufnehmen</button>\n        <p id=\"arAttemptNote\"></p>\n        <p id=\"arEvaluationHint\" class=\"ar-inline-tip\"></p>\n        <div class=\"ar-point-actionbar\"><button id=\"arPrevious\" type=\"button\">← Vorheriger Punkt</button><button id=\"arNext\" type=\"button\">Nächster Punkt →</button></div>\n        <details class=\"ar-more\" id=\"arEvaluationSettings\"><summary>Weitere Einstellungen · Toleranz und Auswertung</summary>\n          <p class=\"ar-inline-tip\">Die Drucktoleranz wird als Prozent der gesamten Druck-Messspanne (Full Scale) bewertet. Ohne bestätigte Umrechnung erscheint ein grauer Punkt statt eines grünen Ergebnisses.</p>\n          <div class=\"ar-grid\">\n            <label>Maximale Druckabweichung (% FS)<input id=\"arToleranceP\" type=\"number\" min=\"0\" step=\"0.01\" value=\"0.2\"></label>\n            <label>Druck-Messspanne (Full Scale)<input id=\"arPressureSpan\" type=\"number\" min=\"0\" step=\"any\" value=\"10\"></label><label>Einheit der Druckreferenz<select id=\"arPressureUnit\"><option value=\"bar\">bar</option><option value=\"mbar\">mbar</option><option value=\"kPa\">kPa</option><option value=\"psi\">psi</option><option value=\"%\">%</option></select></label>\n            <label>Temperaturtoleranz (°C)<input id=\"arToleranceT\" type=\"number\" min=\"0\" step=\"any\" value=\"1\"></label>\n            <label>Samples pro Versuch<input id=\"arSamples\" type=\"number\" min=\"1\" max=\"100\" value=\"12\"></label>\n            <label>Referenzquelle<input id=\"arReferenceSource\" placeholder=\"z. B. Druckkalibrator oder Klimakammer\"></label>\n          </div>\n          <label class=\"ar-check\"><input id=\"arPressureScaleConfirmed\" type=\"checkbox\"> Druckskalierung wurde unabhängig überprüft und ist für diese Messung gültig.</label>\n          <label class=\"ar-check\"><input id=\"arTempConversionConfirmed\" type=\"checkbox\"> Temperaturumrechnung DSP_T → °C wurde unabhängig überprüft.</label>\n          <div class=\"ar-grid\">\n            <label>DSP_T-Skalierung (Digits / °C)<input id=\"arTempScale\" type=\"number\" step=\"any\" value=\"387.88\"></label>\n            <label>DSP_T-Offset (Digits)<input id=\"arTempOffset\" type=\"number\" step=\"any\" value=\"-16485\"></label>\n          </div>\n          <p class=\"ar-muted-explain\">Temperaturkoeffizienten sind Prüfstandsvorgaben und müssen vor einer Toleranzbewertung unabhängig validiert werden. Rohwerte werden immer gespeichert.</p>\n        </details>\n      </div>\n      <div class=\"ar-bottom-actions ar-buttons\">\n        <button id=\"arEndVerification\" hidden>Prüfung abschliessen und speichern</button>\n        <button id=\"arEndCalibration\">Vorgang abschliessen</button>\n        <button id=\"arAbort\">Abbrechen und archivieren</button>\n        <button id=\"arSaveCurrent\">Zwischenstand speichern</button>\n      </div>\n    </section>\n    <section class=\"ar-wizard-card\"><div id=\"arResultChart\"></div></section>\n  </div>\n</div>\n<section class=\"ar-finished-summary\" id=\"arFinishedSummary\" hidden>\n  <div class=\"ar-wizard-card\">\n    <div class=\"ar-finished-heading\"><div><span class=\"ar-finished-kicker\">PRÜFPROTOKOLL GESPEICHERT</span>\n    <h2 id=\"arFinishedTitle\">Zusammenfassung der Nachmessung</h2>\n    <p id=\"arFinishedSubtitle\"></p></div>\n    <div class=\"ar-finish-toolbar\">\n  <button type=\"button\" class=\"primary\" id=\"arExportPdf\">Prüfprotokoll als PDF speichern</button>\n  <button type=\"button\" id=\"arReturnHome\">Zur Hauptseite</button>\n</div></div>\n    <div id=\"arFinishedStats\" class=\"ar-finished-stats\"></div>\n<div id=\"arFinishedMetadata\" class=\"ar-finished-metadata\"></div>\n    <div id=\"arFinishedChart\" class=\"ar-finished-chart\"></div>\n    <h3>Alle Prüfpunkte und Ergebnisse</h3>\n    <div class=\"ar-finished-table-scroll\"><table class=\"ar-finished-table\">\n      <thead><tr><th>Punkt</th><th>Referenz</th><th>Gemessen</th><th>Abweichung</th><th>Ergebnis</th></tr></thead>\n      <tbody id=\"arFinishedRows\"></tbody></table></div>\n    <p id=\"arFinishedFootnote\" class=\"ar-muted-explain\"></p>\n    <div class=\"ar-finished-actions\">\n  <button id=\"arExportPdfBottom\" type=\"button\" class=\"primary\">Prüfprotokoll als PDF speichern</button>\n  <button id=\"arReturnHomeBottom\" type=\"button\">Zur Hauptseite</button>\n</div>\n  </div>\n</section>\n<div class=\"ar-planner\" id=\"arPlanner\">\n  <div class=\"ar-wizard-head\"><div><div class=\"ar-wizard-title\"><span class=\"ar-number-pill\">1</span>Prüfablauf festlegen</div>\n  <p class=\"ar-plan-lead\">Wähle eine Prüfart. Du kannst die vorgegebenen Messpunkte übernehmen oder individuell anpassen.</p></div></div>\n  <div class=\"ar-plan-setup\">\n    <section class=\"ar-wizard-card ar-plan-main\">\n      <label>Was möchtest du prüfen?\n        <select id=\"arMode\"><option value=\"combined\">Druck und Temperatur</option><option value=\"pressure\">Nur Druck</option><option value=\"temperature\">Nur Temperatur</option></select>\n      </label>\n      <div class=\"ar-grid\">\n        <label id=\"arPressurePathLabel\">Druckreihe (hin und zurück, kommagetrennt)<input id=\"arPressurePath\" value=\"0, 2.5, 5, 7.5, 10, 7.5, 5, 2.5, 0\"></label>\n        <label id=\"arTempPathLabel\">Temperaturreihe (°C)<input id=\"arTempPath\" value=\"10, 40, 90, 40, 10\"></label>\n        <label>Wiederholungen (Zyklen)<input id=\"arCycles\" type=\"number\" min=\"1\" max=\"30\" value=\"1\"></label>\n      </div>\n      <div class=\"ar-grid ar-fixed-meta\">\n  <label id=\"arFixedPressureLabel\">Konstanter Prüfdruck<input id=\"arFixedPressure\" type=\"number\" step=\"any\" value=\"5\"></label>\n  <label id=\"arFixedTempLabel\">Umgebungstemperatur (optional, °C)<input id=\"arFixedTemp\" type=\"number\" step=\"any\" placeholder=\"optional\"></label>\n</div>\n<div class=\"ar-grid\" id=\"arPressureReferenceSettings\">\n  <label>Sensortyp<select id=\"arSensorType\"><option value=\"gauge\">Relativdrucksensor (Überdruck)</option><option value=\"absolute\">Absolutdrucksensor</option></select></label>\n  <label>Referenzdruck vom Kalibrator<select id=\"arReferenceKind\"><option value=\"gauge\">Relativdruck (gegen Umgebung)</option><option value=\"absolute\">Absolutdruck</option></select></label>\n</div>\n<label id=\"arAmbientPressureLabel\" class=\"ar-ambient-field\" hidden>Gemessener Umgebungsdruck (gleiche Einheit wie Prüfdruck)\n  <input id=\"arAmbientPressure\" type=\"number\" min=\"0.00001\" step=\"any\" value=\"1.01325\">\n  <small>Wird verwendet, wenn der Kalibrator Relativdruck und der Sensor Absolutdruck angibt (oder umgekehrt). 1,01325 bar ist nur ein Beispiel – den tatsächlichen Umgebungsdruck eingeben.</small>\n</label>\n<p id=\"arPressureFormula\" class=\"ar-inline-tip\"></p>\n      <div class=\"ar-plan-preview\"><p id=\"arPlanStatus\"></p><div class=\"ar-plan-always-visible\"><strong>Alle geplanten Prüfpunkte</strong><pre class=\"ar-plan\" id=\"arPlanPreview\"></pre></div></div>\n      \n    </section>\n    <section class=\"ar-wizard-card\">\n      <h3>So funktioniert die Nachmessung</h3>\n      <p class=\"ar-inline-tip\">1. Stelle Druck und Temperatur am Prüfstand ein.</p>\n      <p class=\"ar-inline-tip\">2. Wenn die Bedingungen stabil sind, nimm den Prüfpunkt auf.</p>\n      <p class=\"ar-inline-tip\">3. Prüfe das Ergebnis sofort im Diagramm. Grün ist innerhalb der Toleranz, Rot ausserhalb. Wiederhole bei Bedarf.</p>\n      <p class=\"ar-inline-tip\">Danach führt dich die Anwendung zum nächsten Punkt. Alle Versuche werden im lokalen Archiv gespeichert.</p>\n      <button id=\"arStart\" class=\"primary ar-action-primary\">Nachmessung starten</button>\n      <div class=\"ar-calibration-tool\">\n        <span class=\"ar-calibration-tool-kicker\">Kalibrierwerkzeug · automatisch erkannt</span>\n        <strong id=\"arDetectedCalibrationTool\">Wird beim Verbinden erkannt</strong>\n        <small id=\"arDetectedCalibrationToolDetails\">Web-App und angeschlossener Kommunikationsadapter werden automatisch protokolliert. Externe Druck- und Temperaturmessmittel bitte bei Bedarf unten ergänzen.</small>\n      </div>\n      <details class=\"ar-optional-documentation\" id=\"arVerificationDocumentation\">\n        <summary>Weitere Protokollangaben (optional)</summary>\n        <p>Alle Angaben sind freiwillig und werden zusammen mit den Messungen archiviert.</p>\n        <div class=\"ar-grid\">\n          <label>Prüfer<input id=\"arVerificationOperator\" maxlength=\"120\" placeholder=\"Name oder Kürzel\"></label>\n          <label>Auftrag / Projekt<input id=\"arVerificationProject\" maxlength=\"150\" placeholder=\"z. B. Prüfauftrag\"></label>\n          <label>Prüfort / Prüfstand<input id=\"arVerificationLocation\" maxlength=\"160\" placeholder=\"z. B. Labor 1\"></label>\n          <label>Prüfmittel / Zertifikatsreferenz<input id=\"arVerificationCertificate\" maxlength=\"200\" placeholder=\"z. B. Zertifikat-ID\"></label>\n        </div>\n        <label>Verwendete externe Messmittel (ein Eintrag pro Zeile)\n          <textarea id=\"arVerificationInstruments\" rows=\"3\" maxlength=\"3000\" placeholder=\"Gerät, Hersteller, Modell, Seriennummer ...\"></textarea>\n        </label>\n        <label>Zusätzliche Informationen / Bemerkungen\n          <textarea id=\"arVerificationNotes\" rows=\"3\" maxlength=\"4000\" placeholder=\"Prüfaufbau, besondere Bedingungen, Abweichungen ...\"></textarea>\n        </label>\n      </details>\n      <p class=\"ar-muted-explain\">Druckkalibrator und Klimakammer werden nicht automatisch gesteuert. Die Sollwerte müssen manuell eingestellt werden.</p>\n    </section>\n  </div>\n</div>\n"+
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
  addPressureUI();
  $('archiveOpen').addEventListener('click',()=>open('archive'));
  $('verificationOpen').addEventListener('click',()=>open('verification'));
  $('classicArchiveOpen')?.addEventListener('click',()=>open('archive'));
  $('classicVerificationOpen')?.addEventListener('click',()=>open('verification'));
  $('archiveClose').addEventListener('click',close);
  $('archiveChoose').addEventListener('click',()=>chooseFolder().catch(e=>note(e.message,true)));
  $('archiveRefresh').addEventListener('click',()=>refresh());
  $('archiveStartCalibration').addEventListener('click',()=>ensureCalibration().then(()=>note('Kalibrierprotokoll gestartet. Jetzt wie gewohnt abgleichen.')).catch(e=>note(e.message,true)));
  $('arStart').addEventListener('click',()=>startVerification().catch(e=>note(e.message,true)));
  $('arReturnHome').addEventListener('click',close);
  $('arReturnHomeBottom').addEventListener('click',close);
  $('arExportPdf').addEventListener('click',()=>exportVerificationPdf(S.finishedReview));
  $('arExportPdfBottom').addEventListener('click',()=>exportVerificationPdf(S.finishedReview));
  $('arMeasure').addEventListener('click',()=>measure());

  // Span always follows the calibration endpoints.
  $('arToleranceP').addEventListener('input',()=>{if(S.record?.type==='verification')renderStep()});
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
  for(const id of ['arSensorType','arReferenceKind'])
   $(id).addEventListener('change',()=>{modeUI();preview()});
  $('arPressureUnit').addEventListener('change',onUnitChange);
  $('arPressureEntryMode').addEventListener('change',onEntryChange);
  for(const id of ['arCalMin','arCalMax','arDspLimit'])$(id).addEventListener('input',preview);
  $('arAmbientPressure').addEventListener('input',modeUI);
  for(const id of ['arPressurePath','arTempPath','arCycles','arFixedPressure','arFixedTemp'])
   $(id).addEventListener('input',preview);

  $('archiveSearch').addEventListener('input',renderList);
  for(const id of ['archiveFilterType','archiveFilterStatus'])$(id).addEventListener('change',renderList);
  $('archiveCompare').addEventListener('click',compare);
  modeUI();preview();renderActive();renderList();refreshDetectedCalibrationTool();
  remembered('read').then(async dir=>{
   if(!dir)return;S.dir=dir;S.folderName=dir.name;
   text('archiveFolder',dir.name+' · '+ui('Ordner vorgemerkt','folder remembered'));
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
  $('archiveWorkspace').classList.toggle('ar-guided-verification',S.view==='verification');
  if(S.view==='verification'){refreshDetectedCalibrationTool();autoCalibrationRange();}
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
  S.finishedReview=null;
 }
 return {init,open,openVerification:()=>open('verification'),close,begin,ensureCalibration,event,trace,appendTelemetry,streamRows,download,flush,finalise,interrupted,
  get active(){return !!S.record},get current(){return S.record},get view(){return S.view},refresh};
})();
if(typeof window!=='undefined'){
 window.ELMOS_ARCHIVE=ELMOS_ARCHIVE;
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ELMOS_ARCHIVE.init);
 else ELMOS_ARCHIVE.init();
}
