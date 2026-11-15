'use strict';
/* Guided, read-only long-duration E703.11 test logging. */
const ELMOS_TEST_LOGGER=(()=>{
 const C=ELMOS_TEST_LOGGER_CORE,$=id=>document.getElementById(id);
 const S={root:null,recordId:null,starting:false,stopping:false,stopRequested:false,
  paused:false,busy:false,timer:null,pending:null,settings:null,startedMono:0,nextDueMono:0,
  startedWall:0,groups:0,samples:0,missed:0,errors:0,consecutiveErrors:0,last:null,
  recent:[],markers:[],lastRecord:null,interrupted:false,clock:null,durationTimer:null,
  activeAccumulatedMs:0,activeStartedMono:0,stopAfterCapture:null,
  reference:{pressure:null,temperature:null,source:null}};
 const now=()=>new Date().toISOString();
 const bridge=()=>window.ELMOS_ARCHIVE_BRIDGE,archive=()=>window.ELMOS_ARCHIVE;
 const text=(id,v)=>{if($(id))$(id).textContent=String(v)};
 const announce=(msg,bad=false)=>{text('tlMessage',msg);if($('tlMessage'))$('tlMessage').className='tl-message'+(bad?' tl-error':'')};
 const value=id=>$(id)?.value??'';
 const number=v=>typeof v==='number'&&Number.isFinite(v)?Number(v).toLocaleString('de-CH',{maximumFractionDigits:3}):'—';
 const duration=ms=>{const t=Math.floor(ms/1000);return String(Math.floor(t/3600)).padStart(2,'0')+':'+String(Math.floor(t%3600/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0')};
 const setDisabled=(id,v)=>{if($(id))$(id).disabled=!!v};
 const activeElapsed=()=>S.activeAccumulatedMs+
  (S.recordId&&!S.paused&&!S.stopping?Math.max(0,performance.now()-S.activeStartedMono):0);
 const remaining=()=>S.settings?.durationMs==null?null:Math.max(0,S.settings.durationMs-activeElapsed());
 const clearDurationTimer=()=>{
  if(S.durationTimer!==null){clearTimeout(S.durationTimer);S.durationTimer=null}
 };
 function armDurationTimer(){
  clearDurationTimer();
  const ms=remaining();
  if(ms==null||S.paused||!S.recordId||S.stopRequested)return;
  if(ms<=0){void stop('completed','duration');return}
  // Browser timers are capped at 2^31-1 ms; re-arm instead of overflowing.
  S.durationTimer=setTimeout(()=>{
   S.durationTimer=null;
   if(remaining()!=null&&remaining()>0){armDurationTimer();return}
   void stop('completed','duration');
  },Math.min(Math.ceil(ms),2147483647));
 }
 const plotChannels=[
  {key:'adcS',color:'#2867a6'},
  {key:'dspS',color:'#087d61'}
 ];
 function renderChartMarkers(){
  const lane=$('tlChartMarkers');
  const first=S.recent[0]?.index??0;
  const last=S.recent.at(-1)?.index??0;
  const visible=S.markers.filter(marker=>marker.afterGroup>=Math.max(0,first-1));
  const key=first+':'+last+':'+S.markers.length;
  if(lane.dataset.rendered===key)return;
  lane.dataset.rendered=key;
  lane.replaceChildren();
  $('tlChartNote').hidden=true;
  lane.hidden=!visible.length;
  const groups=new Map();
  for(const marker of visible){
   const position=Math.max(first,marker.afterGroup);
   if(!groups.has(position))groups.set(position,[]);
   groups.get(position).push(marker);
  }
  for(const [afterGroup,markers] of groups){
   const button=document.createElement('button');
   button.type='button';
   button.className='tl-chart-marker';
   button.style.left=(last>first?100*Math.max(0,afterGroup-first)/(last-first):50)+'%';
   button.textContent=markers.length>1?String(markers.length):'●';
   const note=markers.map(marker=>new Date(marker.at).toLocaleTimeString('de-CH')+' · '+marker.message).join('\n');
   button.setAttribute('aria-label',note);
   const showNote=()=>{
    const panel=$('tlChartNote');
    panel.textContent=note;
    panel.hidden=false;
   };
   button.addEventListener('pointerenter',showNote);
   button.addEventListener('focus',showNote);
   button.addEventListener('click',showNote);
   lane.appendChild(button);
  }
 }
 function drawRecentPoints(){
  const figure=$('tlChartFigure');
  const points=S.recent.map(item=>plotChannels.map(({key})=>
   item.aggregated?.channels?.[key]??item.samples?.at(-1)?.[key]));
  const values=points.flat().filter(Number.isFinite);
  figure.hidden=!values.length&&!S.markers.length;
  renderChartMarkers();
  $('tlChart').hidden=!values.length;
  if(!values.length)return;
  const canvas=$('tlChart'),width=canvas.clientWidth,height=canvas.clientHeight;
  if(!width||!height)return;
  const scale=window.devicePixelRatio||1;
  if(canvas.width!==Math.round(width*scale)||canvas.height!==Math.round(height*scale)){
   canvas.width=Math.round(width*scale);
   canvas.height=Math.round(height*scale);
  }
  const ctx=canvas.getContext('2d');
  ctx.setTransform(scale,0,0,scale,0,0);
  ctx.clearRect(0,0,width,height);
  const low=Math.min(...values),high=Math.max(...values);
  const margin=Math.max(1,(high-low)*0.08);
  const left=54,right=width-12,top=14,bottom=height-24;
  const x=index=>points.length===1?(left+right)/2:left+index*(right-left)/(points.length-1);
  const y=value=>bottom-(value-low+margin)*(bottom-top)/(high-low+2*margin);
  const style=getComputedStyle(canvas);
  ctx.font='11px '+style.fontFamily;
  ctx.fillStyle=style.color;
  ctx.strokeStyle=style.borderColor;
  ctx.textBaseline='middle';
  for(const tick of new Set([high,low])){
   const row=y(tick);
   ctx.fillText(number(tick),5,row);
   ctx.beginPath();ctx.moveTo(left,row);ctx.lineTo(right,row);ctx.stroke();
  }
  ctx.fillText('#'+S.recent[0].index,left,bottom+13);
  if(points.length>1){
   const last='#'+S.recent.at(-1).index;
   ctx.fillText(last,right-ctx.measureText(last).width,bottom+13);
  }
  for(const [channel,{color}] of plotChannels.entries()){
   ctx.strokeStyle=ctx.fillStyle=color;
   ctx.lineWidth=2;
   ctx.beginPath();
   let connected=false;
   points.forEach((point,index)=>{
    const value=point[channel];
    if(!Number.isFinite(value)){connected=false;return}
    if(connected)ctx.lineTo(x(index),y(value));
    else ctx.moveTo(x(index),y(value));
    connected=true;
   });
   ctx.stroke();
   points.forEach((point,index)=>{
    if(!Number.isFinite(point[channel]))return;
    ctx.beginPath();ctx.arc(x(index),y(point[channel]),3,0,2*Math.PI);ctx.fill();
   });
  }
 }
 const render=()=>{
  if(!S.root)return;
  const active=!!S.recordId;
  const manual=$('tlManual').checked;
  $('tlIntervalField').hidden=manual;
  $('tlMissed').parentElement.hidden=active&&S.settings?.manual===true;
  $('tlConfig').hidden=active;
  $('tlControls').hidden=!active;
  $('tlExports').hidden=active||!S.lastRecord;
  setDisabled('tlStart',S.starting);
  setDisabled('tlStop',S.stopping);
  setDisabled('tlSnapshot',S.starting||S.busy||S.stopping||S.stopRequested||(S.paused&&S.settings?.manual===true));
  text('tlSnapshot',S.settings?.manual?'Messpunkt aufnehmen':'Einzelaufnahme');
  $('tlSnapshot').classList.toggle('primary',S.settings?.manual===true);
  setDisabled('tlPause',S.stopping);
  setDisabled('tlMarkerAdd',S.stopping);
  text('tlStatus',S.starting?'Archiv wird vorbereitet …':S.stopping?'Wird abgeschlossen …':
   active?S.paused?'Pausiert':S.busy?'Messung läuft':S.settings?.manual?'Bereit für Messpunkt':'Aufzeichnung aktiv':S.lastRecord?'Letzter Test gespeichert':'Bereit');
  text('tlCount',S.groups);
  text('tlSamples',S.samples);
  text('tlMissed',S.missed);
  text('tlErrors',S.errors);
  text('tlElapsed',active?duration(performance.now()-S.startedMono):S.lastRecord?.endedAt?
   duration(new Date(S.lastRecord.endedAt)-new Date(S.lastRecord.startedAt)):'00:00:00');
  text('tlRemaining',active?(remaining()==null?'Ohne Limit':duration(Math.ceil(remaining()/1000)*1000)):
   S.lastRecord?.testConfiguration?.durationMs!=null?'Abgeschlossen':'Ohne Limit');
  const last=S.last;
  text('tlLatest',last?
   'ADC_S '+number(last.aggregated?.channels?.adcS??last.samples?.at(-1)?.adcS)+
    ' · ADC_T '+number(last.aggregated?.channels?.adcT??last.samples?.at(-1)?.adcT)+
    ' · DSP_S '+number(last.aggregated?.channels?.dspS??last.samples?.at(-1)?.dspS)+
    ' · '+Math.round(last.durationMs)+' ms Messdauer':'Noch kein Messpunkt aufgenommen');
  text('tlPause',S.paused?'Aufzeichnung fortsetzen':'Pausieren');
  drawRecentPoints();
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
  const name=value('tlName').trim(),description=value('tlDescription').trim(),
   dutName=value('tlDutName').trim();
  if(!name||name.length>120)throw Error('Bitte einen Testnamen mit maximal 120 Zeichen eingeben.');
  if(description.length>4000)throw Error('Beschreibung darf maximal 4000 Zeichen lang sein.');
  if(dutName.length>160)throw Error('DUT-Bezeichnung darf maximal 160 Zeichen lang sein.');
  const fields=C.settings({
   manual:$('tlManual').checked,intervalMs:value('tlInterval'),samplesPerPoint:value('tlSamplesPerPoint'),
   sampleSpacingMs:value('tlSpacing'),aggregation:value('tlAggregation'),
   debug:$('tlDebug').checked
  });
  const meta=bridge()?.meta?.();
  if(!meta?.online)throw Error('Sensor nicht verbunden');
  const measuredText=value('tlVdd').trim(),measuredVdd=measuredText===''?null:Number(measuredText);
  if(measuredVdd!==null&&(!Number.isFinite(measuredVdd)||measuredVdd<0||measuredVdd>30))
   throw Error('VDD-Istspannung ist ungültig.');
  return {...fields,durationMs:C.durationMs(value('tlDuration'),value('tlDurationUnit')),
   durationInput:value('tlDuration'),durationUnit:value('tlDurationUnit'),
   name,dutName,description,category:value('tlCategory'),
   operator:value('tlOperator').trim().slice(0,100),
   measuredVdd,measuredVddSource:value('tlVddSource').trim().slice(0,200)};
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
   S.activeAccumulatedMs=0;S.activeStartedMono=S.startedMono;S.stopAfterCapture=null;
   S.groups=0;S.samples=0;S.missed=0;S.errors=0;S.consecutiveErrors=0;S.recent=[];S.markers=[];$('tlChartMarkers').dataset.rendered='';
   S.last=null;S.paused=false;S.stopRequested=false;S.lastRecord=null;
   S.reference={pressure:null,temperature:null,source:null};
   for(const id of ['tlRefPressure','tlRefTemperature','tlRefSource'])if($(id))$(id).value='';
   if(S.clock!==null)clearInterval(S.clock);
   S.clock=setInterval(render,1000);
   armDurationTimer();
   announce(S.settings.manual?'Test gestartet. Klicke auf «Messpunkt aufnehmen», sobald der Messpunkt bereit ist.':'Test gestartet. Rohdaten werden laufend im gewählten lokalen Archivordner gespeichert.');
   schedule(0);
  }catch(e){
   clearDurationTimer();if(S.clock!==null){clearInterval(S.clock);S.clock=null}
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
  if(!S.recordId||S.stopRequested||S.paused||S.settings.manual)return;
  if(remaining()!=null&&remaining()<=0){void stop('completed','duration');return}
  S.timer=setTimeout(()=>{
   S.timer=null;
   if(remaining()!=null&&remaining()<=0){void stop('completed','duration');return}
   S.pending=capture(false);void S.pending;
  },Math.max(0,Math.round(waitMs)));
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
   if(manual)await archive().event('manual_snapshot_requested',{at:startedAt});
   const raw=await bridge().measure(S.settings.samplesPerPoint,{
    testLogger:true,sampleSpacingMs:S.settings.sampleSpacingMs
   });
   const ended=performance.now();
   if(S.interrupted||archive()?.current?.id!==S.recordId)throw Error('Aufzeichnung durch Sensorverlust unterbrochen');
   const next=manual?null:C.scheduleNext(due,ended,S.settings.intervalMs);
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
    supply:raw.supply,reference:{...S.reference}};
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
    S.nextDueMono=performance.now()+S.settings.intervalMs;
    try{await archive()?.event('error',{stage:'test_measurement',message:e.message,
     partialSamples:e.rawSamples||null,partialReadErrors:e.partialReadErrors||null})}catch(_){}
    announce('Messfehler: '+e.message+(S.consecutiveErrors<3?(S.settings.manual?' · Messpunkt erneut aufnehmen.':' · Nächster Versuch folgt.'):' · Aufzeichnung wird beendet.'),true);
    if(S.consecutiveErrors>=3){S.stopRequested=true;S.stopAfterCapture='failed'}
   }
  }finally{
   S.busy=false;render();
   if(S.stopAfterCapture){
    const finalStatus=S.stopAfterCapture;S.stopAfterCapture=null;
    // The failed capture promise must resolve before stop() awaits S.pending.
    setTimeout(()=>{void stop(finalStatus,'read_error')},0);
   }
   if(!S.stopRequested&&!S.paused&&S.recordId){
    if(manual) schedule(S.settings.intervalMs);
    else schedule(Math.max(0,S.nextDueMono-performance.now()));
   }
  }
 }
 async function snapshot(){
  if(!S.recordId||S.starting||S.stopping||S.busy||S.stopRequested||(S.paused&&S.settings.manual))return;
  if(remaining()!=null&&remaining()<=0){void stop('completed','duration');return}
  clearTimer();
  S.pending=capture(true);
  await S.pending;
 }
 async function marker(){
  if(!S.recordId)return;
  const message=value('tlMarkerText').trim();
  if(!message)return announce('Bitte eine kurze Bemerkung eingeben.',true);
  if(message.length>1000)return announce('Bemerkung ist zu lang (maximal 1000 Zeichen).',true);
  try{
   const recordId=S.recordId;
   const entry={at:now(),message,afterGroup:S.groups};
   await archive().event('marker',entry);
   if(S.recordId!==recordId)return;
   S.markers.push(entry);
   render();
   $('tlMarkerText').value='';
   announce('Marker mit Zeitstempel gespeichert.');
  }catch(e){announce('Marker konnte nicht gespeichert werden: '+e.message,true)}
 }
 async function pause(){
  if(!S.recordId||S.stopping)return;
  if(!S.paused){
   S.activeAccumulatedMs+=Math.max(0,performance.now()-S.activeStartedMono);
   S.paused=true;clearTimer();clearDurationTimer();
  }else{
   S.paused=false;S.activeStartedMono=performance.now();
   S.nextDueMono=S.activeStartedMono;
   armDurationTimer();schedule(0);
  }
  try{await archive().event(S.paused?'paused':'resumed',{
   at:now(),afterGroup:S.groups,activeElapsedMs:Math.round(activeElapsed()),
   remainingMs:remaining()})}
  catch(e){announce(e.message,true)}
  render();
 }
 async function stop(status='completed',reason='manual'){
  if(S.stopping||!S.recordId)return;
  S.activeAccumulatedMs=activeElapsed();
  S.stopping=true;S.stopRequested=true;clearTimer();clearDurationTimer();render();
  try{
   if(S.pending)await S.pending.catch(()=>{});
   bridge()?.stopTelemetry?.();
   if(archive()?.current?.id===S.recordId){
    await archive().event('test_summary',{groups:S.groups,individualSamples:S.samples,
     missedIntervals:S.missed,readErrors:S.errors,elapsedMs:performance.now()-S.startedMono,
     activeElapsedMs:S.activeAccumulatedMs,targetDurationMs:S.settings?.durationMs??null,
     completionReason:reason,status});
    S.lastRecord=await archive().finalise(status);
    announce(reason==='duration'?'Eingestellte Testdauer erreicht. Aufzeichnung automatisch beendet und gespeichert.':
     'Test abgeschlossen und im lokalen Archiv gespeichert.');
   }else announce('Archivprotokoll wurde unterbrochen. Bitte Ordner und Sensorverbindung prüfen.',true);
  }catch(e){
   announce('Abschluss fehlgeschlagen: '+e.message+' · Archivdateien nicht löschen.',true);
   // Keep the active record so the operator can retry a safe stop.
   S.stopping=false;render();return;
  }
  S.recordId=null;S.settings=null;S.paused=false;S.stopRequested=false;
  if(S.clock!==null){clearInterval(S.clock);S.clock=null}
  S.stopping=false;render();
 }
 function onInterrupted(e){
  if(!S.recordId)return;
  S.interrupted=true;S.stopRequested=true;clearTimer();clearDurationTimer();
  bridge()?.stopTelemetry?.();
  S.recordId=null;S.stopping=false;S.paused=false;
  if(S.clock!==null){clearInterval(S.clock);S.clock=null}
  announce('Sensorverbindung unterbrochen: '+(e?.detail?.reason||'unbekannt')+
   '. Die bereits gespeicherten Rohdaten bleiben im Archiv.',true);
  render();
 }
 async function updateReference(){
  if(!S.recordId||S.stopping)return;
  const pr=value('tlRefPressure').trim(),temp=value('tlRefTemperature').trim();
  const pressure=pr===''?null:Number(pr),temperature=temp===''?null:Number(temp);
  if((pressure!==null&&!Number.isFinite(pressure))||(temperature!==null&&!Number.isFinite(temperature)))
   return announce('Referenzwerte müssen gültige Zahlen sein.',true);
  S.reference={pressure,temperature,source:value('tlRefSource').trim().slice(0,200)||null};
  try{
   await archive().event('reference_changed',{...S.reference,afterGroup:S.groups});
   announce('Externe Referenzwerte mit Zeitstempel gespeichert.');
  }catch(e){announce(e.message,true)}
 }
 async function exportLast(format){
  if(!S.lastRecord)return;
  try{
   if(format==='pdf'){
    archive().exportLoggingPdf(S.lastRecord);
    return;
   }
   await archive().download(S.lastRecord,format);
  }catch(e){announce('Export fehlgeschlagen: '+e.message,true)}
 }
 function UI(){
  return '<div class="tl-lead"><strong id="tlStatus">Bereit</strong><span>Sensor-Tests und Telemetrie ohne NVM-Schreibvorgänge</span></div>'+
  '<section id="tlConfig" class="tl-box"><h3>Test beschreiben</h3><div class="tl-grid">'+
   '<label>Testname *<input id="tlName" maxlength="120" placeholder="z. B. Drucksprung 0 auf 10 bar"></label>'+
   '<label>Produkt / DUT-Bezeichnung<input id="tlDutName" maxlength="160" placeholder="z. B. Drucksensor Typ 560 oder Prototyp A"></label>'+
   '<label>Kategorie<select id="tlCategory"><option value="general">Allgemein</option><option value="pressure">Drucktest</option><option value="temperature">Temperaturtest</option><option value="longterm">Langzeitmessung</option><option value="communication">Kommunikation</option><option value="electrical">Elektrik / Versorgung</option><option value="other">Andere</option></select></label>'+
   '<label>Operator / Kürzel (optional)<input id="tlOperator" maxlength="100" placeholder="z. B. DN"></label>'+
   '<label>VDD-Istspannung (V, manuell gemessen)<input id="tlVdd" type="number" min="0" max="30" step="any" placeholder="z. B. 5.01"></label>'+
   '<label>Quelle der VDD-Messung<input id="tlVddSource" maxlength="200" placeholder="z. B. Multimeter am Prüfling"></label></div>'+
   '<label>Beschreibung der Messung / Testaufbau<textarea id="tlDescription" rows="3" maxlength="4000" placeholder="Was wird geprüft? Referenzgeräte, Aufbau, Temperatur- oder Druckbedingungen, Auffälligkeiten …"></textarea></label>'+
   '<h3>Aufzeichnung konfigurieren</h3>'+
   '<label class="tl-check"><input id="tlManual" type="checkbox"> Messpunkte manuell auslösen</label>'+
   '<div class="tl-grid">'+
   '<label id="tlIntervalField">Messintervall zwischen Messpunkten (ms)<input id="tlInterval" type="number" min="1" max="3600000" step="1" value="1000"></label>'+
   '<label>Einzelmessungen pro Messpunkt<input id="tlSamplesPerPoint" type="number" min="1" max="100" step="1" value="1"></label>'+
   '<label>Abstand zwischen Einzelmessungen (ms)<input id="tlSpacing" type="number" min="0" max="60000" step="1" value="0"></label>'+
   '<label>Werte zusammenfassen<select id="tlAggregation"><option value="none">Keine Mittelung · Rohwerte</option><option value="mean">Arithmetischer Mittelwert</option><option value="median">Median</option></select></label>'+
   '<label>Testdauer (0 = unbegrenzt)<div class="tl-duration"><input id="tlDuration" type="number" min="0" max="2592000" step="any" value="0"><select id="tlDurationUnit"><option value="s">Sekunden</option><option value="min">Minuten</option><option value="h">Stunden</option></select></div></label></div>'+
   '<label class="tl-check"><input id="tlDebug" type="checkbox"> Zusätzlich TX/RX-Kommunikation aufzeichnen (Debug, grössere Dateien)</label>'+
   '<p class="tl-note">Die Testdauer beendet die Aufzeichnung automatisch; 0 bedeutet manuelles Stoppen. Pausen halten die Testdauer an. Der zuletzt gestartete Messpunkt wird vollständig gespeichert. Jede einzelne Rohmessung bleibt erhalten, auch wenn du den Mittelwert oder Median aktivierst. Bei automatischer Aufzeichnung werden tatsächliche Zeiten und übersprungene Intervalle gespeichert.</p>'+
   '<button class="primary" type="button" id="tlStart">Aufzeichnung starten</button></section>'+
  '<section id="tlControls" class="tl-box" hidden><div class="tl-kpis">'+
   '<div><small>Messpunkte</small><strong id="tlCount">0</strong></div>'+
   '<div><small>Einzelwerte</small><strong id="tlSamples">0</strong></div>'+
   '<div><small>Ausgelassene Intervalle</small><strong id="tlMissed">0</strong></div>'+
   '<div><small>Fehler</small><strong id="tlErrors">0</strong></div>'+
   '<div><small>Dauer</small><strong id="tlElapsed">00:00:00</strong></div>'+
   '<div><small>Restzeit</small><strong id="tlRemaining">Ohne Limit</strong></div></div>'+
   '<p class="tl-current" id="tlLatest">Noch keine Messung</p>'+
   '<details class="tl-references"><summary>Optionale externe Referenzwerte</summary><div class="tl-grid">'+
   '<label>Referenzdruck<input id="tlRefPressure" type="number" step="any" placeholder="z. B. 5"></label>'+
   '<label>Referenztemperatur (°C)<input id="tlRefTemperature" type="number" step="any" placeholder="z. B. 25"></label>'+
   '<label>Referenzgerät / Quelle<input id="tlRefSource" placeholder="z. B. Klimakammer"></label></div>'+
   '<button id="tlRefApply" type="button">Referenzen übernehmen & markieren</button></details>'+
   '<div class="tl-actions"><button id="tlPause" type="button">Pausieren</button>'+
   '<button id="tlSnapshot" type="button">Einzelaufnahme</button>'+
   '<button id="tlStop" type="button" class="primary">Aufzeichnung beenden & speichern</button></div>'+
   '<label>Marker / Notiz während der Messung<textarea id="tlMarkerText" maxlength="1000" rows="2" placeholder="z. B. Referenzdruck auf 5 bar erhöht"></textarea></label>'+
   '<button id="tlMarkerAdd" type="button">Marker mit Zeitstempel speichern</button>'+
   '<figure id="tlChartFigure" class="tl-chart" hidden>'+
   '<figcaption>Verlauf der letzten 20 Messpunkte · Digits <span class="tl-chart-adc">ADC_S</span> <span class="tl-chart-dsp">DSP_S</span></figcaption>'+
   '<canvas id="tlChart" role="img" aria-label="ADC_S und DSP_S nach Messpunktnummer"></canvas>'+
   '<div id="tlChartMarkers" aria-label="Notizen zum Messverlauf" hidden></div>'+
   '<p id="tlChartNote" role="status" hidden></p></figure>'+
   '<h3>Letzte Messpunkte</h3><div id="tlRecent" class="tl-recent"></div></section>'+
  '<section id="tlExports" class="tl-box" hidden><strong>Letzte Aufzeichnung</strong>'+
   '<p>Im Archiv sind die Beschreibung, Marker, Geräteinformationen und vollständigen Rohwerte gespeichert.</p>'+
   '<div class="tl-actions"><button id="tlExportJSON" type="button">JSON inkl. Rohwerte</button>'+
   '<button id="tlExportCSV" type="button">CSV herunterladen</button>'+
    '<button id="tlExportPDF" type="button">Prüfprotokoll als PDF speichern</button></div></section>'+
  '<div class="tl-message" id="tlMessage" role="status">Verbinde zuerst einen Sensor und wähle einen Archivordner. Beim Start wird die Ausgangskonfiguration dokumentiert.</div>';
 }
 function mount(host){
  const target=typeof host==='string'?$(host):host;
  if(!target)throw Error('Logger-Ansicht fehlt');
  if(S.root===target){render();return}
  if(S.root){
   // Move the *existing* form and event handlers; never reset an active test.
   target.replaceChildren(...Array.from(S.root.childNodes));
   S.root=target;render();return;
  }
  S.root=target;
  S.root.innerHTML=UI();
  $('tlManual').addEventListener('change',render);
  $('tlStart').addEventListener('click',()=>{void start()});
  $('tlStop').addEventListener('click',()=>{void stop()});
  $('tlPause').addEventListener('click',()=>{void pause()});
  $('tlSnapshot').addEventListener('click',()=>{void snapshot().catch(e=>announce(e.message,true))});
  $('tlMarkerAdd').addEventListener('click',()=>{void marker()});
  $('tlRefApply').addEventListener('click',()=>{void updateReference()});
  $('tlExportJSON').addEventListener('click',()=>{void exportLast('json')});
  $('tlExportCSV').addEventListener('click',()=>{void exportLast('csv')});
  $('tlExportPDF').addEventListener('click',()=>{void exportLast('pdf')});
  S.lastRecord=null;render();
 }
 function unmount(){
  if(S.recordId||S.starting||S.stopping)return false;
  if($('classicLoggerHost'))mount($('classicLoggerHost'));
  return true;
 }
 function isBusy(){return !!(S.recordId||S.starting||S.stopping)}
 window.addEventListener('elmos-archive-interrupted',onInterrupted);
 return {mount,unmount,isBusy,warn:message=>announce(message,true),get active(){return !!S.recordId}};

})();
if(typeof window!=='undefined')window.ELMOS_TEST_LOGGER=ELMOS_TEST_LOGGER;
if(typeof document!=='undefined'){
 const init=()=>{if(document.getElementById('classicLoggerHost'))ELMOS_TEST_LOGGER.mount('classicLoggerHost')};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
 else init();
}
