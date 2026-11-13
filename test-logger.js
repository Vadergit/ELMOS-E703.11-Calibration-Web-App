'use strict';
/* Guided, read-only long-duration E703.11 test logging. */
const ELMOS_TEST_LOGGER=(()=>{
 const C=ELMOS_TEST_LOGGER_CORE,$=id=>document.getElementById(id);
 const S={root:null,recordId:null,starting:false,stopping:false,stopRequested:false,
  paused:false,busy:false,timer:null,pending:null,settings:null,startedMono:0,nextDueMono:0,
  startedWall:0,groups:0,samples:0,missed:0,errors:0,consecutiveErrors:0,last:null,
  recent:[],lastRecord:null,interrupted:false};
 const now=()=>new Date().toISOString();
 const bridge=()=>window.ELMOS_ARCHIVE_BRIDGE,archive=()=>window.ELMOS_ARCHIVE;
 const text=(id,v)=>{if($(id))$(id).textContent=String(v)};
 const announce=(msg,bad=false)=>{text('tlMessage',msg);if($('tlMessage'))$('tlMessage').className='tl-message'+(bad?' tl-error':'')};
 const value=id=>$(id)?.value??'';
 const number=v=>typeof v==='number'&&Number.isFinite(v)?Number(v).toLocaleString('de-CH',{maximumFractionDigits:3}):'—';
 const duration=ms=>{const t=Math.floor(ms/1000);return String(Math.floor(t/3600)).padStart(2,'0')+':'+String(Math.floor(t%3600/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0')};
 const setDisabled=(id,v)=>{if($(id))$(id).disabled=!!v};
 const render=()=>{
  if(!S.root)return;
  const active=!!S.recordId;
  $('tlConfig').hidden=active;
  $('tlControls').hidden=!active;
  $('tlExports').hidden=active||!S.lastRecord;
  setDisabled('tlStart',S.starting);
  setDisabled('tlStop',S.stopping);
  setDisabled('tlSnapshot',S.busy||S.stopping);
  setDisabled('tlPause',S.stopping);
  setDisabled('tlMarkerAdd',S.stopping);
  text('tlStatus',S.starting?'Archiv wird vorbereitet …':S.stopping?'Wird abgeschlossen …':
   active?S.paused?'Pausiert':S.busy?'Messung läuft':'Aufzeichnung aktiv':S.lastRecord?'Letzter Test gespeichert':'Bereit');
  text('tlCount',S.groups);
  text('tlSamples',S.samples);
  text('tlMissed',S.missed);
  text('tlErrors',S.errors);
  text('tlElapsed',active?duration(performance.now()-S.startedMono):S.lastRecord?.endedAt?
   duration(new Date(S.lastRecord.endedAt)-new Date(S.lastRecord.startedAt)):'00:00:00');
  const last=S.last;
  text('tlLatest',last?
   'ADC_S '+number(last.aggregated?.channels?.adcS??last.samples?.at(-1)?.adcS)+
    ' · ADC_T '+number(last.aggregated?.channels?.adcT??last.samples?.at(-1)?.adcT)+
    ' · DSP_S '+number(last.aggregated?.channels?.dspS??last.samples?.at(-1)?.dspS)+
    ' · '+Math.round(last.durationMs)+' ms Messdauer':'Noch kein Messpunkt aufgenommen');
  text('tlPause',S.paused?'Aufzeichnung fortsetzen':'Pausieren');
  const list=$('tlRecent');list?.replaceChildren();
  for(const item of S.recent.slice(-9).reverse()){
   const row=document.createElement('div');row.className='tl-reading';
   const time=new Date(item.startedAt).toLocaleTimeString('de-CH');
   const point=item.aggregated?.channels||{};
   const raw=item.samples?.at(-1)||{};
   row.textContent='#'+item.index+' · '+time+' · ADC_S '+number(point.adcS??raw.adcS)+
    ' · DSP_S '+number(point.dspS??raw.dspS)+' · '+Math.round(item.durationMs)+' ms'+
    (item.skippedIntervals?' · '+item.skippedIntervals+' Intervalle übersprungen':'')+
    (item.errors?.length?' · '+item.errors.length+' Lesefehler':'');
   list.appendChild(row);
  }
 };
 const config=()=>{
  const name=value('tlName').trim(),description=value('tlDescription').trim();
  if(!name||name.length>120)throw Error('Bitte einen Testnamen mit maximal 120 Zeichen eingeben.');
  if(description.length>4000)throw Error('Beschreibung darf maximal 4000 Zeichen lang sein.');
  const fields=C.settings({
   intervalMs:value('tlInterval'),samplesPerPoint:value('tlSamplesPerPoint'),
   sampleSpacingMs:value('tlSpacing'),aggregation:value('tlAggregation'),
   debug:$('tlDebug').checked
  });
  const meta=bridge()?.meta?.();
  if(!meta?.online)throw Error('Sensor nicht verbunden');
  return {...fields,name,description,category:value('tlCategory'),
   operator:value('tlOperator').trim().slice(0,100)};
 };
 const clearTimer=()=>{if(S.timer!==null){clearTimeout(S.timer);S.timer=null}};
 async function start(){
  if(S.recordId||S.starting||S.stopping)return;
  let opts;
  try{opts=config()}catch(e){announce(e.message,true);return}
  if(archive()?.active){announce('Es läuft bereits ein Archivprotokoll. Bitte dieses zuerst abschliessen.',true);return}
  S.starting=true;S.interrupted=false;render();
  try{
   const record=await archive().begin('testlog');
   S.recordId=record.id;
   await archive().event('test_configuration',opts);
   await bridge().startTelemetry();
   S.settings=opts;
   S.startedMono=performance.now();S.startedWall=Date.now();S.nextDueMono=S.startedMono;
   S.groups=0;S.samples=0;S.missed=0;S.errors=0;S.consecutiveErrors=0;S.recent=[];
   S.last=null;S.paused=false;S.stopRequested=false;S.lastRecord=null;
   announce('Test gestartet. Rohdaten werden laufend im gewählten lokalen Archivordner gespeichert.');
   schedule(0);
  }catch(e){
   bridge()?.stopTelemetry?.();
   announce('Aufzeichnung konnte nicht starten: '+e.message,true);
   if(S.recordId&&archive()?.current?.id===S.recordId){
    try{await archive().event('error',{stage:'test_start',message:e.message});
     await archive().finalise('incomplete')}catch(_){}
   }
   S.recordId=null;
  }finally{S.starting=false;render()}
 }
 function schedule(waitMs){
  clearTimer();
  if(!S.recordId||S.stopRequested||S.paused)return;
  S.timer=setTimeout(()=>{S.timer=null;S.pending=capture(false);void S.pending},Math.max(0,Math.round(waitMs)));
 }
 async function capture(manual){
  if(!S.recordId||S.busy||S.stopRequested)return;
  S.busy=true;
  const due=manual?performance.now():S.nextDueMono;
  const started=performance.now();
  const startedAt=now();
  const scheduledAt=new Date(S.startedWall+(due-S.startedMono)).toISOString();
  const lagMs=Math.max(0,started-due);
  render();
  try{
   const raw=await bridge().measure(S.settings.samplesPerPoint,{
    testLogger:true,sampleSpacingMs:S.settings.sampleSpacingMs
   });
   const ended=performance.now();
   if(S.interrupted||archive()?.current?.id!==S.recordId)throw Error('Aufzeichnung durch Sensorverlust unterbrochen');
   const next=C.scheduleNext(due,ended,S.settings.intervalMs);
   const point={kind:'telemetry_point',index:S.groups+1,manual:!!manual,
    scheduledAt,startedAt,endedAt:now(),durationMs:Math.round((ended-started)*10)/10,
    lagMs:Math.round(lagMs*10)/10,skippedIntervals:manual?0:next.skipped,
    intervalMs:S.settings.intervalMs,sampleSpacingMs:S.settings.sampleSpacingMs,
    aggregation:S.settings.aggregation,
    samples:raw.samples,errors:raw.errors,
    aggregated:C.aggregate(raw.samples,S.settings.aggregation),
    // Raw readout and provenance from the bridge are preserved alongside the individual samples.
    sensorSnapshot:{adcS:raw.adcS,adcT:raw.adcT,adcTC:raw.adcTC,dspS:raw.dspS,dspT:raw.dspT,
     statusSync:raw.statusSync,sensorPressure:raw.sensorPressure,
     pressureUnit:raw.pressureUnit,pressureConversion:raw.pressureConversion,
     temperatureConversion:raw.temperatureConversion,
     AFE:raw.AFE,ramAFE0:raw.ramAFE0,ramAFE1:raw.ramAFE1,nvmCrc:raw.currentNvmCrc},
    supply:raw.supply};
   await archive().appendTelemetry(point); // Only count a measurement after durable file append.
   S.groups++;S.samples+=raw.samples?.length||0;S.missed+=point.skippedIntervals;
   S.errors+=raw.errors?.length||0;S.consecutiveErrors=0;
   S.last=point;S.recent.push(point);if(S.recent.length>20)S.recent.shift();
   if(S.groups%20===0)announce('Rohdaten gespeichert: '+S.groups+' Messpunkte, '+S.samples+' Einzelmessungen.');
   if(!manual)S.nextDueMono=next.nextAt;
   else S.nextDueMono=performance.now()+S.settings.intervalMs;
  }catch(e){
   if(!S.interrupted){
    S.errors++;S.consecutiveErrors++;
    try{await archive()?.event('error',{stage:'test_measurement',message:e.message,
     partialSamples:e.rawSamples||null,partialReadErrors:e.partialReadErrors||null})}catch(_){}
    announce('Messfehler: '+e.message+(S.consecutiveErrors<3?' · Nächster Versuch folgt.':' · Aufzeichnung wird beendet.'),true);
    if(S.consecutiveErrors>=3){S.stopRequested=true;void stop('failed')}
   }
  }finally{
   S.busy=false;render();
   if(!S.stopRequested&&!S.paused&&S.recordId){
    if(manual) schedule(S.settings.intervalMs);
    else schedule(Math.max(0,S.nextDueMono-performance.now()));
   }
  }
 }
 async function snapshot(){
  if(!S.recordId||S.stopping||S.busy)return;
  clearTimer();
  await archive().event('manual_snapshot_requested',{at:now()});
  S.pending=capture(true);
  await S.pending;
 }
 async function marker(){
  if(!S.recordId)return;
  const message=value('tlMarkerText').trim();
  if(!message)return announce('Bitte eine kurze Bemerkung eingeben.',true);
  if(message.length>1000)return announce('Bemerkung ist zu lang (maximal 1000 Zeichen).',true);
  try{
   await archive().event('marker',{at:now(),message,afterGroup:S.groups});
   $('tlMarkerText').value='';
   announce('Marker mit Zeitstempel gespeichert.');
  }catch(e){announce('Marker konnte nicht gespeichert werden: '+e.message,true)}
 }
 async function pause(){
  if(!S.recordId||S.stopping)return;
  S.paused=!S.paused;
  clearTimer();
  try{await archive().event(S.paused?'paused':'resumed',{at:now(),afterGroup:S.groups})}
  catch(e){announce(e.message,true)}
  if(!S.paused){S.nextDueMono=performance.now();schedule(0)}
  render();
 }
 async function stop(status='completed'){
  if(S.stopping||!S.recordId)return;
  S.stopping=true;S.stopRequested=true;clearTimer();render();
  try{
   if(S.pending)await S.pending.catch(()=>{});
   bridge()?.stopTelemetry?.();
   if(archive()?.current?.id===S.recordId){
    await archive().event('test_summary',{groups:S.groups,individualSamples:S.samples,
     missedIntervals:S.missed,readErrors:S.errors,elapsedMs:performance.now()-S.startedMono,
     status});
    S.lastRecord=await archive().finalise(status);
    announce('Test abgeschlossen und im lokalen Archiv gespeichert.');
   }else announce('Archivprotokoll wurde unterbrochen. Bitte Ordner und Sensorverbindung prüfen.',true);
  }catch(e){
   announce('Abschluss fehlgeschlagen: '+e.message+' · Archivdateien nicht löschen.',true);
   // Keep the active record so the operator can retry a safe stop.
   S.stopping=false;render();return;
  }
  S.recordId=null;S.settings=null;S.paused=false;S.stopRequested=false;
  S.stopping=false;render();
 }
 function onInterrupted(e){
  if(!S.recordId)return;
  S.interrupted=true;S.stopRequested=true;clearTimer();
  bridge()?.stopTelemetry?.();
  S.recordId=null;S.stopping=false;S.paused=false;
  announce('Sensorverbindung unterbrochen: '+(e?.detail?.reason||'unbekannt')+
   '. Die bereits gespeicherten Rohdaten bleiben im Archiv.',true);
  render();
 }
 async function exportLast(format){
  if(!S.lastRecord)return;
  try{await archive().download(S.lastRecord,format)}
  catch(e){announce('Export fehlgeschlagen: '+e.message,true)}
 }
 function UI(){
  return '<div class="tl-lead"><strong id="tlStatus">Bereit</strong><span>Sensor-Tests und Telemetrie ohne NVM-Schreibvorgänge</span></div>'+
  '<section id="tlConfig" class="tl-box"><h3>Test beschreiben</h3><div class="tl-grid">'+
   '<label>Testname *<input id="tlName" maxlength="120" placeholder="z. B. Drucksprung 0 auf 10 bar"></label>'+
   '<label>Kategorie<select id="tlCategory"><option value="general">Allgemein</option><option value="pressure">Drucktest</option><option value="temperature">Temperaturtest</option><option value="longterm">Langzeitmessung</option><option value="communication">Kommunikation</option><option value="electrical">Elektrik / Versorgung</option><option value="other">Andere</option></select></label>'+
   '<label>Operator / Kürzel (optional)<input id="tlOperator" maxlength="100" placeholder="z. B. DN"></label></div>'+
   '<label>Beschreibung der Messung / Testaufbau<textarea id="tlDescription" rows="3" maxlength="4000" placeholder="Was wird geprüft? Referenzgeräte, Aufbau, Temperatur- oder Druckbedingungen, Auffälligkeiten …"></textarea></label>'+
   '<h3>Aufzeichnung konfigurieren</h3><div class="tl-grid">'+
   '<label>Messintervall zwischen Messpunkten (ms)<input id="tlInterval" type="number" min="1" max="3600000" step="1" value="1000"></label>'+
   '<label>Einzelmessungen pro Messpunkt<input id="tlSamplesPerPoint" type="number" min="1" max="100" step="1" value="1"></label>'+
   '<label>Abstand zwischen Einzelmessungen (ms)<input id="tlSpacing" type="number" min="0" max="60000" step="1" value="0"></label>'+
   '<label>Werte zusammenfassen<select id="tlAggregation"><option value="none">Keine Mittelung · Rohwerte</option><option value="mean">Arithmetischer Mittelwert</option><option value="median">Median</option></select></label></div>'+
   '<label class="tl-check"><input id="tlDebug" type="checkbox"> Zusätzlich TX/RX-Kommunikation aufzeichnen (Debug, grössere Dateien)</label>'+
   '<p class="tl-note">Jede einzelne Rohmessung bleibt erhalten, auch wenn du den Mittelwert oder Median aktivierst. Das Intervall ist eine Vorgabe, kein garantierter Hardwaretakt. Wenn die Abfrage länger dauert, werden tatsächliche Zeiten und übersprungene Intervalle geloggt.</p>'+
   '<button class="primary" type="button" id="tlStart">Aufzeichnung starten</button></section>'+
  '<section id="tlControls" class="tl-box" hidden><div class="tl-kpis">'+
   '<div><small>Messpunkte</small><strong id="tlCount">0</strong></div>'+
   '<div><small>Einzelwerte</small><strong id="tlSamples">0</strong></div>'+
   '<div><small>Ausgelassene Intervalle</small><strong id="tlMissed">0</strong></div>'+
   '<div><small>Fehler</small><strong id="tlErrors">0</strong></div>'+
   '<div><small>Dauer</small><strong id="tlElapsed">00:00:00</strong></div></div>'+
   '<p class="tl-current" id="tlLatest">Noch keine Messung</p>'+
   '<div class="tl-actions"><button id="tlPause" type="button">Pausieren</button>'+
   '<button id="tlSnapshot" type="button">Einzelaufnahme</button>'+
   '<button id="tlStop" type="button" class="primary">Aufzeichnung beenden & speichern</button></div>'+
   '<label>Marker / Notiz während der Messung<textarea id="tlMarkerText" maxlength="1000" rows="2" placeholder="z. B. Referenzdruck auf 5 bar erhöht"></textarea></label>'+
   '<button id="tlMarkerAdd" type="button">Marker mit Zeitstempel speichern</button>'+
   '<h3>Letzte Messpunkte</h3><div id="tlRecent" class="tl-recent"></div></section>'+
  '<section id="tlExports" class="tl-box" hidden><strong>Letzte Aufzeichnung</strong>'+
   '<p>Im Archiv sind die Beschreibung, Marker, Geräteinformationen und vollständigen Rohwerte gespeichert.</p>'+
   '<div class="tl-actions"><button id="tlExportJSON" type="button">JSON inkl. Rohwerte</button>'+
   '<button id="tlExportCSV" type="button">CSV mit Messpunkten</button></div></section>'+
  '<div class="tl-message" id="tlMessage" role="status">Verbinde zuerst einen Sensor und wähle einen Archivordner. Beim Start wird die Ausgangskonfiguration dokumentiert.</div>';
 }
 function mount(host){
  if(S.recordId)throw Error('Aktiver Logger darf nicht neu initialisiert werden.');
  S.root=typeof host==='string'?$(host):host;
  if(!S.root)throw Error('Logger-Ansicht fehlt');
  S.root.innerHTML=UI();
  $('tlStart').addEventListener('click',()=>{void start()});
  $('tlStop').addEventListener('click',()=>{void stop()});
  $('tlPause').addEventListener('click',()=>{void pause()});
  $('tlSnapshot').addEventListener('click',()=>{void snapshot().catch(e=>announce(e.message,true))});
  $('tlMarkerAdd').addEventListener('click',()=>{void marker()});
  $('tlExportJSON').addEventListener('click',()=>{void exportLast('json')});
  $('tlExportCSV').addEventListener('click',()=>{void exportLast('csv')});
  S.lastRecord=null;render();
 }
 function unmount(){if(S.recordId||S.starting||S.stopping)return false;clearTimer();S.root=null;return true}
 function isBusy(){return !!(S.recordId||S.starting||S.stopping)}
 window.addEventListener('elmos-archive-interrupted',onInterrupted);
 return {mount,unmount,isBusy,get active(){return !!S.recordId}};
})();
if(typeof window!=='undefined')window.ELMOS_TEST_LOGGER=ELMOS_TEST_LOGGER;
