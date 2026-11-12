'use strict';
/* Guided beta UI. It moves the EXISTING calibrated controls rather than creating
 * a second hardware implementation. All original NVM safety guards remain active.
 * No direct sensor/register operations are performed in this module.
 */
const ELMOS_GUIDED=(()=>{
 const $=id=>document.getElementById(id);
 const steps=[
  ['Aufgabe','Was möchtest du machen?','Wähle dein Ziel. Danach stelle ich nur die dafür benötigten Fragen.'],
  ['Abgleich planen','Wie genau möchtest du abgleichen?','Lege zuerst fest, wie viele Druckpunkte und Temperaturstufen du benötigst.'],
  ['Sensor vorbereiten','Sensor und Referenzen definieren','Druckbereich, Temperaturbedingungen und DSP-Endwert für den Abgleich festlegen.'],
  ['Frontend einstellen','AFE optimal einstellen','PGA1, Offset und PGA2 einstellen. Änderungen gehen nur ins RAM und werden rückgelesen.'],
  ['Messpunkte','Jetzt die Referenzen messen','Stelle die angezeigte Temperatur und den Druck ein. Nimm jeden Punkt erst nach dem Stabilisieren auf.'],
  ['Koeffizienten','Kalibrierung berechnen','Die Messwerte ergeben die DSP-Kennlinie. Zuerst berechnen, dann ins Chip-RAM übertragen.'],
  ['DSP verifizieren','Ergebnis unabhängig prüfen','Prüfe echte Druck- und Temperaturbedingungen. Erst erfolgreiche Prüfungen geben NVM frei.'],
  ['Ausgang','Ausgang und Skalierung','Kontrolliere AODO-Ausgangsart, Versorgungsspannung und Zielspannungen.'],
  ['NVM','Sicher im Sensor speichern','Lies das komplette Original-NVM, prüfe die Änderungsliste und bestätige die Chip-UID.'],
  ['Fertig','Sensor abgeschlossen','Der Schreibvorgang wurde bestätigt. Für die Freigabe unbedingt einen echten Kaltstarttest durchführen.']
 ];
 let stage=0,task='calibration',root=null,original=[],mode=false,plan=null,signature=null;
 let selectedPoint=0,visited=new Set([0]),poll=null,pendingCapture=null,afeStatsStart=0,afeGainSignature='';
 const subscriptions=[];
 const subscribe=(el,type,handler)=>{el.addEventListener(type,handler);subscriptions.push({el,type,handler})};
 const defaults={pCount:2,tCount:1,temps:[25],pmin:0,pmax:10,samples:12,outputLimit:25000,orderS:1,orderT:0};
 const state=()=>window.ELMOS_GUIDED_API?.state?.()||{chip:false,points:[],mode:'offline'};
 const msg=(text,kind='')=>{const x=$('gwMessage');if(!x)return;x.hidden=!text;x.className='gw-alert'+(kind?' '+kind:'');x.textContent=text||''};
 const setText=(id,text)=>{if($(id))$(id).textContent=String(text)};
 const labelNode=id=>{const el=$(id),node=el?.closest('label');if(!node)throw Error('Originales Eingabefeld nicht gefunden: '+id);return node};
 function move(node,target){
  if(typeof node==='string')node=$(node);
  if(typeof target==='string')target=$(target);
  if(!node||!target||!node.parentNode)throw Error('Element für den geführten Modus fehlt.');
  const marker=document.createComment('guided-original');
  node.parentNode.replaceChild(marker,node);target.appendChild(node);original.push({node,marker});
  return node;
 }
 const moveId=(id,dest)=>move($(id),dest);
 const moveLabel=(id,dest)=>move(labelNode(id),dest);
 function restore(){
  for(const x of original)if(x.marker.parentNode)x.marker.parentNode.replaceChild(x.node,x.marker);
  original=[];document.querySelectorAll('.gw-point-active').forEach(el=>el.classList.remove('gw-point-active'));
 }
 function UI(){
  const sides=steps.map((v,i)=>'<button type="button" class="gw-sideitem" data-gw-side="'+i+'"><span class="gw-no">'+(i+1)+'</span><span>'+v[0]+'</span></button>').join('');
  return '<div class="gw-shell"><aside class="gw-sidebar"><div class="gw-backlogo"><span>◆</span> E703.11 · Geführter Abgleich</div><nav class="gw-sideitems">'+sides+'</nav><div class="gw-sidebar-footer">Die Originalsoftware bleibt jederzeit über «Klassisch» erreichbar.<div style="margin-top:9px">Laborversion · keine Hardwarefreigabe für NVM</div></div></aside><main class="gw-main"><div class="gw-topline"><span id="gwKicker" class="gw-kicker">Schritt 1</span><span id="gwChipStatus" class="gw-chipstatus"></span></div><div class="gw-progressbar"><span id="gwProgress"></span></div><h2 class="gw-title" id="gwTitle"></h2><p class="gw-desc" id="gwDesc"></p>'+
   '<div id="gwPage0" class="gw-page"><div class="gw-columns gw-three">'+
    '<button class="gw-choice" data-gw-task="calibration"><span class="gw-choice-icon">◉</span><strong>Sensor neu abgleichen</strong><small>Von der Messung über die DSP-Prüfung bis zur sicheren NVM-Programmierung.</small></button>'+
    '<button class="gw-choice" data-gw-task="output"><span class="gw-choice-icon">↗</span><strong>Nur Ausgang ändern</strong><small>Bereits kalibrierten Sensor prüfen und AODO-Ausgang neu konfigurieren.</small></button>'+
    '<button class="gw-choice" data-gw-task="inspect"><span class="gw-choice-icon">▤</span><strong>EEPROM / Diagnose</strong><small>Die bestehende Register- und EEPROM-Ansicht ohne geführten Abgleich öffnen.</small></button></div>'+
    '<div class="gw-alert">Der Chip muss zuerst über USB erkannt werden. Der geführte Modus verändert keine Register, bevor du eine entsprechende Aktion bestätigst.</div></div>'+
   '<div id="gwPage1" class="gw-page" hidden><div class="gw-preset-grid">'+
    '<button class="gw-preset" data-gw-preset="quick"><strong>Schnell</strong><small>2 Druckpunkte, ohne Temperaturkorrektur.</small></button>'+
    '<button class="gw-preset" data-gw-preset="temperature"><strong>Mit Temperatur</strong><small>2 Druckpunkte × 3 Temperaturstufen.</small></button>'+
    '<button class="gw-preset" data-gw-preset="custom"><strong>Individuell</strong><small>3 Druckpunkte × 2 Temperaturstufen; anpassbar.</small></button></div>'+
    '<div class="gw-tile is-soft"><h3>Deinen Messablauf festlegen</h3><div class="gw-fields gw-3">'+
     '<label>Druckpunkte<select id="gwPressureCount"><option>2</option><option>3</option><option>4</option><option>5</option></select></label>'+
     '<label>Temperaturbedingungen<select id="gwTemperatureCount"><option value="1">1 · keine Temperaturkorrektur</option><option value="2">2 · lineare Temperaturkorrektur</option><option value="3">3 · quadratische Temperaturkorrektur</option></select></label>'+
     '<label>Abgleichart<select id="gwComplexity"><option value="simple">Automatisch · empfohlen</option><option value="advanced">Experte · Polynomordnung selber wählen</option></select></label>'+
    '</div><div class="gw-fields gw-3 gw-advanced" id="gwOrderFields" hidden><label>Druckpolynomordnung<select id="gwSOrder"><option value="1">1 · Linear</option><option value="2">2 · Quadratisch</option><option value="3">3 · Kubisch</option></select></label><label>Temperaturordnung<select id="gwTOrder"><option value="0">0 · Keine</option><option value="1">1 · Linear</option><option value="2">2 · Quadratisch</option></select></label></div>'+
    '<div class="gw-fieldnote">Jede Kombination wird an allen gewählten Temperaturbedingungen gemessen. Maximal 10 Kalibrierpunkte unterstützt die bestehende Engine.</div></div>'+
    '<div id="gwPlanPreview" class="gw-summary"></div></div>'+
   `<div id="gwPage2" class="gw-page gw-setup-page" hidden>
    <div class="gw-columns gw-setup-grid">
     <section class="gw-tile gw-setup-tile">
      <div class="gw-section-head"><div><h3>Druckbereich und Messung</h3><p>Referenzwerte und Anzahl der Samples</p></div></div>
      <div class="gw-fields gw-setup-pressure" id="gwSensorFields"></div>
     </section>
     <section class="gw-tile gw-setup-tile">
      <div class="gw-section-head"><div><h3>Temperatur und DSP</h3><p>Temperaturstufen und digitaler Zielbereich</p></div></div>
      <div class="gw-fields gw-setup-temps" id="gwTemperatures"></div>
      <div class="gw-subheading">Zielbereich der Kalibrierung</div>
      <div class="gw-fields gw-dsp-fields" id="gwDspFields"></div>
     </section>
    </div>`+
    '<details class="gw-tile gw-config-details" id="gwConfigDetails"><summary><strong>Config-Vorlage übernehmen</strong> <span>Optional · Einstellungen eines ähnlichen Sensors</span></summary><p>Die Vorlage übernimmt nur Einstellungen. Messpunkte, Chip-UID, Werksdaten und EEPROM werden niemals importiert.</p><div class="gw-fields gw-3" id="gwConfigFields"></div><div id="gwConfigGroups"></div><div class="gw-panel-actions" id="gwConfigActions"></div><div id="gwConfigEffect"></div><div id="gwConfigStatus"></div></details><div id="gwSetupPreview" class="gw-summary gw-setup-summary"></div></div>'+
   '<div id="gwPage3" class="gw-page gw-afe-page" hidden><div class="gw-columns gw-afe-layout">'+
    '<section class="gw-tile gw-control gw-afe-controls"><div class="gw-section-head"><span class="gw-section-no">01</span><div><h3>Verstärkung und Offset</h3><p>Änderungen werden direkt ins Chip-RAM übernommen</p></div></div><div id="gwAFEPanel"></div><div id="gwGain"></div><div id="gwAFEMsg"></div><div id="gwConfigAFE"></div><div class="gw-afe-guide"><strong>AFE richtig einstellen</strong><ol><li>Minimalen und maximalen Referenzdruck anlegen.</li><li>PGA1, Offset und PGA2 anpassen. Ziel: grosser Hub ohne Übersteuerung.</li><li>Die rote Grenze bei ±25’000 Digits nicht überschreiten.</li></ol><small>Änderst du die AFE nach einer Messung, müssen bereits erfasste Messpunkte neu aufgenommen werden.</small></div></section>'+
    '<section class="gw-tile gw-afe-monitor"><div class="gw-monitor-head"><div><h3>ADC_S · Live-Verlauf</h3><p>Rohsignal der Druckmesskette · letzte 60 Sekunden</p></div><span id="gwAfeLiveBadge" class="gw-live-badge">Warte auf Werte</span></div><div class="gw-afe-current"><strong id="gwAfeAdcValue" aria-live="off">—</strong><span>Digits</span></div><div class="gw-afe-chart" id="gwAfeChartHost"></div><div class="gw-chart-legend"><span class="gw-legend-limit">Grenzen ±25’000</span><span class="gw-legend-zero">Nulllinie</span><span class="gw-legend-line">ADC_S live</span></div>'+
    '<div class="gw-afe-kpis"><div><span>Minimum</span><strong id="gwAfeMin">—</strong></div><div><span>Maximum</span><strong id="gwAfeMax">—</strong></div><div><span>Hub (Max − Min)</span><strong id="gwAfeHub">—</strong></div></div>'+
    '<div class="gw-monitor-actions"><div id="gwAfeLiveActions"></div><button type="button" id="gwAfeReset" class="gw-secondary-btn">Min/Max zurücksetzen</button></div><div id="gwAfeQuality" class="gw-afe-quality" role="status">Min/Max werden ab dem Start dieses AFE-Schritts erfasst.</div><div id="gwAfeMessage"></div></section></div></div>'+
   '<div id="gwPage4" class="gw-page" hidden><div class="gw-points-layout"><div class="gw-point-nav" id="gwPointNav"></div><div class="gw-tile gw-control"><div id="gwCurrentSetpoint" class="gw-summary"></div><div id="gwPointHost"></div><div id="gwSampleStatus"></div><div id="gwPointMessages"></div></div></div><div class="gw-alert">Der angezeigte Druck und die Temperatur sind <b>Referenz-Sollwerte</b>. Sie werden nicht automatisch erzeugt. Wähle den tatsächlichen Sollwert am Druckkalibrator und stelle die Temperaturkammer stabil ein, bevor du auf «aufnehmen» klickst.</div></div>'+
   '<div id="gwPage5" class="gw-page" hidden><div class="gw-columns"><div class="gw-tile gw-control"><h3>Polynom und DSP-Ziel</h3><div class="gw-fields gw-3" id="gwFitFields"></div><div class="gw-panel-actions" id="gwFitActions"></div><div id="gwFitStatuses"></div><div id="gwFitDetails"></div></div><div class="gw-tile is-soft"><h3>Sicherer Ablauf</h3><p>1. Koeffizienten aus den gemessenen Punkten berechnen.</p><p>2. Zahlenbereich und Fehler kontrollieren.</p><p>3. Berechnete Werte nur ins RAM übertragen und rücklesen.</p><div class="gw-alert">Der berechnete Fit ist noch keine Hardware-Verifikation. Im nächsten Schritt wird DSP_S an unabhängigen Punkten geprüft.</div></div></div></div>'+
   '<div id="gwPage6" class="gw-page" hidden><div class="gw-columns"><div class="gw-tile gw-control"><h3>Unabhängige Prüfpunkte</h3><div class="gw-fields gw-3" id="gwVerifyFields"></div><div class="gw-panel-actions" id="gwVerifyActions"></div><div id="gwVerifyStatuses"></div><details><summary>Prüfprotokoll</summary><div id="gwVerifyDetails"></div></details></div><div class="gw-tile is-soft"><h3>Was prüfe ich hier?</h3><p>Stelle einen neuen Druck ein, der nicht bloss eine Wiederholung der Kalibrierpunkte ist. Bei Temperaturkompensation sind zusätzliche Prüftemperaturen wichtig.</p><div class="gw-alert warn">Die Live-Anzeige allein zählt nicht als Prüfung. Verwende «Prüfwert aus DSP_S lesen» und kontrolliere die tatsächliche Abweichung.</div></div></div></div>'+
   `<div id="gwPage7" class="gw-page" hidden>
    <div class="gw-columns gw-output-layout">
     <section class="gw-tile gw-control">
      <div class="gw-section-head"><div><h3>Ausgang konfigurieren</h3><p>AODO-Ausgangsart und Zielwerte</p></div></div>
      <div class="gw-fields" id="gwOutputFields"></div>
      <div id="gwOutputVoltage">
       <div class="gw-subheading">Versorgung und Zielspannungen</div>
       <div class="gw-fields gw-output-voltage-fields">
        <div id="gwVddHolder"></div>
        <div class="gw-voltage-endpoint"><span class="gw-voltage-label">S0 · untere Spannung</span><div id="gwS0Holder"></div></div>
        <div class="gw-voltage-endpoint"><span class="gw-voltage-label">S1 · obere Spannung</span><div id="gwS1Holder"></div></div>
       </div>
       <p class="gw-setup-hint">Für ratiometrischen Betrieb liegen die Zielspannungen bei 10–90 % von VDD. Bei 5 V entspricht das 0,5–4,5 V.</p>
       <div class="gw-panel-actions" id="gwScalingActions"></div>
      </div>
      <div class="gw-advanced" id="gwAdvancedOutput" hidden><details><summary>Expertenparameter · AODO Gain/Offset</summary><div class="gw-fields" id="gwExpertOutputFields"></div></details></div>
      <div class="gw-panel-actions" id="gwOutputActions"></div>
     </section>
     <section class="gw-tile is-soft gw-output-review">
      <div class="gw-section-head"><div><h3>Vorschau und Status</h3><p>Ausgelesene Werte, Skalierung und Startschutz</p></div></div>
      <div id="gwOutputStatuses"></div>
      <details><summary>Ausgelesene Chip-Register</summary><div id="gwOutputRegisters"></div></details>
     </section>
    </div>
   </div>`+
   '<div id="gwPage8" class="gw-page" hidden><div class="gw-columns"><div class="gw-tile gw-control"><h3>Änderungen prüfen und bestätigen</h3><div id="gwNvmBackup"></div><div class="gw-panel-actions" id="gwNvmPrepare"></div><div id="gwNvmMessages"></div><div class="gw-fields" id="gwNvmUID"></div><div class="gw-panel-actions" id="gwNvmWrite"></div><div id="gwNvmDetails"></div></div><div class="gw-tile is-warning"><h3>Wichtig vor dem NVM-Schreiben</h3><p>Ein Stromunterbruch während der Programmierung kann den Sensor unbrauchbar machen.</p><p>Prüfe Chip-UID und die Änderungsübersicht. Zuerst an einem entbehrlichen Testchip validieren.</p><p>Der Button ist nur freigegeben, wenn die bestehende Sicherheitslogik alle Voraussetzungen bestätigt.</p></div></div></div>'+
   '<div id="gwPage9" class="gw-page gw-finish-page" hidden><section class="gw-finish-signal"><div class="gw-finish-top"><div><span class="gw-kicker">Live-Sensorsignal</span><h3>Aktueller Sensorausgang</h3></div><span id="gwFinishStatus" class="gw-live-badge">Warte auf Chipwerte</span></div><div class="gw-finish-number" aria-live="off"><strong id="gwFinishSignalValue">—</strong><span id="gwFinishSignalUnit">—</span></div><div id="gwFinishSource" class="gw-finish-caption">DSP_S wird vom Chip gelesen und auf den eingestellten Anzeigebereich bezogen.</div><div class="gw-finish-bar"><span id="gwFinishBar"></span></div><div class="gw-finish-limits"><span id="gwFinishRangeMin">—</span><span id="gwFinishRangeMax">—</span></div><div class="gw-finish-kpis"><div><span>DSP_S</span><strong id="gwFinishDsp">—</strong><small>Digits</small></div><div><span>ADC_S</span><strong id="gwFinishAdc">—</strong><small>Digits</small></div><div><span>ADC_T</span><strong id="gwFinishTemp">—</strong><small>Digits</small></div><div><span>Letzte Messung</span><strong id="gwFinishTime">—</strong></div></div></section>'+
    '<div class="gw-columns gw-finish-bottom"><section class="gw-tile"><div class="gw-section-head"><div><h3>Signalverlauf</h3><p>ADC_S im Zeitverlauf · letzte 60 Sekunden</p></div></div><div id="gwFinishChartHost" class="gw-finish-chart"></div></section><section class="gw-tile gw-finish-checklist"><h3>Abgleich und Freigabe</h3><div id="gwFinishCompletion" class="gw-alert">NVM-Status prüfen.</div><p id="gwFinishConfig">Gewünschte Ausgangseinstellungen werden hier als Sollwerte dargestellt.</p><p class="gw-finish-warning">Vor der Freigabe den Sensor stromlos machen und den Ausgang nach dem Neustart mit einem Messgerät prüfen. Die Anzeige ersetzt keinen Hardwaretest.</p><div class="gw-panel-actions" id="gwPostBoot"></div><button class="gw-secondary-link" id="gwBackClassic" type="button">Zur vollständigen Expertenansicht wechseln</button></section></div></div>'+
   '<div id="gwMessage" class="gw-alert" hidden></div><footer class="gw-footer"><small id="gwFooterHint">E703.11 · Kalibrierassistent</small><div class="gw-actions"><button id="gwClassic" type="button">Klassische Ansicht</button><button id="gwPrevious" type="button">Zurück</button><button id="gwNext" class="primary" type="button">Weiter</button></div></footer></main></div>';
 }
 function build(){
  root=$('guidedWorkspace');
  root.innerHTML=UI();
  for(const id of ['pmin','pmax','calUnit','calSampleCount','calUnitOther'])moveLabel(id,'gwSensorFields');
  moveLabel('calDspLimit','gwDspFields');
  for(const id of ['configLabel','configFile'])moveLabel(id,'gwConfigFields');
  moveId('configGroups','gwConfigGroups');moveId('configImportEffect','gwConfigEffect');
  for(const id of ['configApply','configSave'])moveId(id,'gwConfigActions');
  moveId('configPreview','gwConfigStatus');
  const stepper=document.querySelector('.afe-step-panel');move(stepper,'gwAFEPanel');
  moveId('gainInfo','gwGain');moveId('writeMsg','gwAFEMsg');moveId('configAfePending','gwConfigAFE');
  moveId('chart','gwAfeChartHost');
  for(const id of ['readNow','live','srcLabel'])moveId(id,'gwAfeLiveActions');
  moveId('adcMsg','gwAfeMessage');
  const pointRows=[...document.querySelectorAll('.panel[data-panel="2"] .cal-point-row')];
  if(pointRows.length!==10)throw Error('Messpunktkarten der Originalansicht haben sich geändert');
  pointRows.forEach(el=>move(el,'gwPointHost'));
  moveId('calSampleProgress','gwSampleStatus');
  moveId('calMsg','gwPointMessages');
  moveLabel('calSOrder','gwFitFields');moveLabel('calTOrder','gwFitFields');
  for(const id of ['calCalculate','calApplyRam'])moveId(id,'gwFitActions');
  for(const id of ['calFitMsg','calRamPrereq','calRamStageMsg'])moveId(id,'gwFitStatuses');
  move($('calCoeffList').closest('details'),'gwFitDetails');
  for(const id of ['calVerifyCount','calVerifyPressure','calVerifyTolerance','calVerifyTemperature'])moveLabel(id,'gwVerifyFields');
  moveId('calVerifyRam','gwVerifyActions');
  for(const id of ['calVerifyCoverage','calVerifyProgress','calRamMsg'])moveId(id,'gwVerifyStatuses');
  moveId('calVerifyList','gwVerifyDetails');
  moveLabel('expertOutputMode','gwOutputFields');moveId('expertPwmPeriodField','gwOutputFields');
  moveLabel('expertScaleEnable','gwOutputFields');
  moveLabel('psscVdd','gwVddHolder');
  moveLabel('psscS0','gwS0Holder');moveLabel('psscS1','gwS1Holder');
  moveId('psscDefaultScaling','gwScalingActions');
  for(const id of ['expertScaleGain','expertScaleOffset'])moveLabel(id,'gwExpertOutputFields');
  for(const id of ['expertOutputPreset','expertOutputStage','outputNvmRead'])moveId(id,'gwOutputActions');
  for(const id of ['outputModeHint','psscScalingPreview','expertOutputMsg','outputOneWireStatus','psscOneWireOnlyStatus'])moveId(id,'gwOutputStatuses');
  moveId('psscCurrentOutputStatus','gwOutputRegisters');
  moveLabel('nvmAutoBackup','gwNvmBackup');
  moveId('nvmPrepare','gwNvmPrepare');moveId('nvmProgress','gwNvmPrepare');
  for(const id of ['nvmMsg','nvmUidHint','nvmWritePrereq'])moveId(id,'gwNvmMessages');
  moveLabel('nvmConfirmId','gwNvmUID');moveId('nvmProgram','gwNvmWrite');
  moveId('nvmDiffDetails','gwNvmDetails');
  moveId('nvmRestartControls','gwPostBoot');
  document.querySelectorAll('[data-gw-task]').forEach(button=>button.addEventListener('click',()=>{task=button.dataset.gwTask;render()}));
  document.querySelectorAll('[data-gw-preset]').forEach(button=>button.addEventListener('click',()=>preset(button.dataset.gwPreset)));
  for(const id of ['gwPressureCount','gwTemperatureCount','gwSOrder','gwTOrder'])$(id).addEventListener('change',renderPlan);
  $('gwComplexity').addEventListener('change',()=>{
   if($('gwComplexity').value==='advanced'){
    $('gwSOrder').value=String(Math.min(3,Number($('gwPressureCount').value)-1));
    $('gwTOrder').value=String(Number($('gwTemperatureCount').value)-1);
   }
   renderPlan();
  });
  $('gwNext').addEventListener('click',next);$('gwPrevious').addEventListener('click',previous);
  $('gwAfeReset').addEventListener('click',()=>{
   afeStatsStart=Date.now();afeGainSignature='';
   updateUI();
  });
  $('gwClassic').addEventListener('click',close);$('gwBackClassic').addEventListener('click',close);
  document.querySelectorAll('[data-gw-side]').forEach(button=>button.addEventListener('click',()=>{const index=Number(button.dataset.gwSide);if(visited.has(index)){stage=index;render()}}));
  subscribe(document,'elmos-config-applied',syncImportedConfig);
  subscribe($('expertMode'),'change',renderOutputOptions);
  subscribe($('expertOutputMode'),'change',renderOutputOptions);
  for(const id of ['pmin','pmax','calUnit','calSampleCount','calDspLimit'])subscribe($(id),'change',renderPlan);
  for(const id of ['capLo','capHi',...Array.from({length:8},(_,k)=>'calExtra'+(k+1)+'Capture')]){
   subscribe($(id),'click',()=>observeCapture());
  }
  $('gwPressureCount').value='2';$('gwTemperatureCount').value='1';$('gwComplexity').value='simple';
  renderPlan();
 }
 function preset(name){
  const p=ELMOS_GUIDED_PLAN.presets[name];if(!p)return;
  $('gwPressureCount').value=String(p.pCount);$('gwTemperatureCount').value=String(p.tCount);
  $('gwComplexity').value=p.complex?'advanced':'simple';
  $('gwSOrder').value=String(Math.min(3,p.pCount-1));
  $('gwTOrder').value=String(p.tCount-1);
  setTemperatureInputs(p.tCount);
  renderPlan();
 }
 function defaultTemperatures(n){return n===1?[25]:n===2?[10,60]:[-10,25,65]}
 function setTemperatureInputs(n,values){
  const parent=$('gwTemperatures'),existing=[...parent.querySelectorAll('input')].map(el=>Number(el.value));
  const target=values||existing.length===n?existing:defaultTemperatures(n);
  parent.replaceChildren();
  for(let i=0;i<n;i++){
   const label=document.createElement('label');
   label.textContent='Temperaturstufe '+(i+1)+' (°C)';
   const input=document.createElement('input');input.type='number';input.step='any';input.min='-40';input.max='125';input.dataset.gwTemperature=String(i);input.value=String(target[i]);
   input.addEventListener('change',renderPlan);label.appendChild(input);parent.appendChild(label);
  }
 }
 function tempValues(n){
  const fields=[...$('gwTemperatures').querySelectorAll('input')];
  if(fields.length!==n)setTemperatureInputs(n);
  return [...$('gwTemperatures').querySelectorAll('input')].map(x=>x.value);
 }
 function makePlan(){
  const pCount=Number($('gwPressureCount').value),tCount=Number($('gwTemperatureCount').value);
  const complex=$('gwComplexity').value==='advanced';
  return ELMOS_GUIDED_PLAN.create({
   pCount,tCount,pmin:$('pmin').value,pmax:$('pmax').value,unit:$('calUnit').value,
   temperatures:tempValues(tCount),samples:$('calSampleCount').value,outputLimit:$('calDspLimit').value,
   orderS:complex?$('gwSOrder').value:undefined,orderT:complex?$('gwTOrder').value:undefined
  });
 }
 function renderPlan(){
  const pCount=Number($('gwPressureCount').value),tCount=Number($('gwTemperatureCount').value);
  const advanced=$('gwComplexity').value==='advanced';
  $('gwOrderFields').hidden=!advanced;
  const maxOrder=Math.min(3,pCount-1);
  for(const opt of $('gwSOrder').options)opt.disabled=Number(opt.value)>maxOrder;
  for(const opt of $('gwTOrder').options)opt.disabled=Number(opt.value)>=tCount;
  if(Number($('gwSOrder').value)>maxOrder)$('gwSOrder').value=String(maxOrder);
  if(Number($('gwTOrder').value)>=tCount)$('gwTOrder').value=String(tCount-1);
  try{
   const candidate=makePlan();plan=candidate;
   const tags=candidate.points.map(p=>'<span><b>'+p.label+'</b>'+p.pressure+' '+candidate.unit+' · '+p.temperature+' °C</span>').join('');
   $('gwPlanPreview').innerHTML='<strong>'+candidate.pCount+' Druckpunkte × '+candidate.tCount+' Temperaturstufen = '+candidate.total+' echte Messungen</strong><p>Druckpolynom '+candidate.orderS+'. Ordnung · Temperaturpolynom '+candidate.orderT+'. Ordnung · '+candidate.samples+' Samples je Messung</p><div class="gw-matrix">'+tags+'</div>';
   $('gwPlanPreview').className='gw-summary';
   const setup=$('gwSetupPreview');
   if(setup)setup.textContent='Geplant: '+candidate.total+' Messungen · '+candidate.pmin+'–'+candidate.pmax+' '+candidate.unit+' · Temperatur '+candidate.temperatures.join(' / ')+' °C';
   msg('');
  }catch(e){
   plan=null;$('gwPlanPreview').textContent=e.message;$('gwPlanPreview').className='gw-alert error';
  }
  document.querySelectorAll('[data-gw-preset]').forEach(btn=>{
   const p=ELMOS_GUIDED_PLAN.presets[btn.dataset.gwPreset];
   btn.setAttribute('aria-pressed',String(p.pCount===pCount&&p.tCount===tCount&&p.complex===advanced));
  });
 }
 function fieldValue(id,value,event='change'){
  const el=$(id);if(!el)return;
  const next=String(value);
  if(String(el.value)!==next){el.value=next;el.dispatchEvent(new Event(event,{bubbles:true}))}
 }
 function applyPlan(){
  const p=makePlan();
  const nextSignature=JSON.stringify(p);
  if(signature===nextSignature)return p;
  if(signature!==null&&(state().points||[]).length){
   if(!window.confirm('Die Messmatrix wurde geändert. Bereits erfasste Messpunkte werden verworfen. Neue Messung beginnen?'))
    throw Error('Änderung abgebrochen. Bisherige Messpunkte bleiben erhalten.');
   $('calPointClear').click(); // Originaler, sicherer Löschpfad; keine Hardwareaktion.
  }
  // Setting point-count first invokes the ORIGINAL safe invalidation of old points.
  fieldValue('calPointCount',p.total);
  fieldValue('pmin',p.pmin);fieldValue('pmax',p.pmax);
  fieldValue('calUnit',p.unit);
  fieldValue('calSampleCount',p.samples);
  fieldValue('calSOrder',p.orderS);
  fieldValue('calTOrder',p.orderT);
  fieldValue('calDspLimit',p.outputLimit);
  for(const point of p.points){
   const name=point.label+' · '+point.pressure+' '+p.unit;
   if(point.slot==='lo'){
    $('pointLoName').value=name;$('pointLoName').dataset.userEdited='1';
    fieldValue('calLoTemp',point.temperature);
   }else if(point.slot==='hi'){
    $('pointHiName').value=name;$('pointHiName').dataset.userEdited='1';
    fieldValue('calHiTemp',point.temperature);
   }else{
    const k=point.index;
    const nameEl=$('calExtra'+k+'Name');nameEl.value=name;nameEl.dataset.userEdited='1';
    const pressure=$('calExtra'+k+'Pressure');pressure.dataset.userEdited='1';
    fieldValue('calExtra'+k+'Pressure',point.pressure);
    fieldValue('calExtra'+k+'Temp',point.temperature);
   }
  }
  fieldValue('calVerifyCount',1);
  signature=nextSignature;selectedPoint=0;plan=p;
  return p;
 }
 function syncImportedConfig(event){
  const included=event?.detail?.included||[];
  if(!included.some(g=>['reference','measurement','dsp'].includes(g))){
   msg('Config übernommen. Die Messmatrix bleibt unverändert.','success');
   return;
  }
  const s=Number($('calSOrder').value),t=Number($('calTOrder').value),
   total=Number($('calPointCount').value);
  if(included.includes('measurement')||included.includes('dsp')){
   const candidates=[];
   for(let p=2;p<=5;p++)for(let temp=1;temp<=3;temp++){
    if(p*temp===total&&p>s&&temp>t)candidates.push({p,temp});
   }
   if(!candidates.length){
    msg('Die importierten DSP- und Messparameter können nicht automatisch als Wizard-Matrix dargestellt werden. Bitte Druck-/Temperaturpunkte im Plan kontrollieren.','warn');
    return;
   }
   const oldP=Number($('gwPressureCount').value),oldT=Number($('gwTemperatureCount').value);
   candidates.sort((a,b)=>
    (Math.abs(a.p-oldP)*2+Math.abs(a.temp-oldT))-
    (Math.abs(b.p-oldP)*2+Math.abs(b.temp-oldT)));
   const selected=candidates[0];
   $('gwPressureCount').value=String(selected.p);
   $('gwTemperatureCount').value=String(selected.temp);
   // Even for measurement-only files, never silently overwrite an unchanged DSP order.
   $('gwComplexity').value='advanced';
   $('gwSOrder').value=String(s);$('gwTOrder').value=String(t);
   setTemperatureInputs(selected.temp);
  }
  signature=null;renderPlan();
  msg('Config übernommen. Prüfe die Messmatrix und Temperatur-Sollwerte, bevor du Referenzmessungen aufnimmst.','success');
 }
 function pointRecord(point){
  const values=state().points||[];
  return values.find(p=>point.slot==='lo'?p.kind==='lo':point.slot==='hi'?p.kind==='hi':p.kind==='extra'&&p.slot===point.index);
 }
 function pointRow(point){
  if(point.slot==='lo')return $('gwPointHost').querySelector('.cal-point-row:not([data-cal-extra])');
  if(point.slot==='hi')return [...$('gwPointHost').querySelectorAll('.cal-point-row:not([data-cal-extra])')].at(-1);
  return $('calExtra'+point.index+'Row');
 }
 function renderOutputOptions(){
  if(!mode)return;
  $('gwAdvancedOutput').hidden=!$('expertMode').checked;
  const analog=['keep','1','2','3'].includes($('expertOutputMode').value);
  $('gwOutputVoltage').hidden=!analog;
 }
 function renderCapture(){
  if(!plan)return;
  const nav=$('gwPointNav');nav.replaceChildren();
  plan.points.forEach((point,index)=>{
   const record=pointRecord(point);
   const btn=document.createElement('button');btn.type='button';
   btn.textContent=(index+1)+'. '+point.pressure+' '+plan.unit+' · '+point.temperature+' °C';
   btn.className=(index===selectedPoint?'gw-selected ':'')+(record?'gw-done':'');
   btn.addEventListener('click',()=>{selectedPoint=index;renderCapture()});nav.appendChild(btn);
   const row=pointRow(point);
   if(row)row.classList.toggle('gw-point-active',index===selectedPoint);
  });
  const current=plan.points[selectedPoint],record=pointRecord(current),done=plan.points.filter(p=>pointRecord(p)).length;
  $('gwCurrentSetpoint').textContent='Punkt '+(selectedPoint+1)+' / '+plan.total+' · Stelle '+current.pressure+' '+plan.unit+' und '+current.temperature+' °C ein. '+(record?'✓ Bereits aufgenommen; bei Bedarf wiederholen.':'Noch nicht gemessen.');
  setText('gwFooterHint',done+' / '+plan.total+' Messpunkte erfolgreich aufgenommen');
 }
 function observeCapture(){
  if(stage!==4||!plan)return;
  const target=plan.points[selectedPoint];
  const old=pointRecord(target)?.at||null;
  if(pendingCapture)window.clearInterval(pendingCapture);
  let ticks=0;
  pendingCapture=window.setInterval(()=>{
   if(!mode||stage!==4||ticks++>200){window.clearInterval(pendingCapture);pendingCapture=null;return}
   const record=pointRecord(target);
   if(!record||record.at===old)return;
   window.clearInterval(pendingCapture);pendingCapture=null;
   renderCapture();
   const nextIndex=plan.points.findIndex((p,i)=>i>target.index&&!pointRecord(p));
   if(nextIndex>=0&&selectedPoint===target.index){selectedPoint=nextIndex;renderCapture()}
   else if(plan.points.every(p=>pointRecord(p)))msg('Alle Messpunkte sind aufgenommen. Weiter zur Koeffizientenberechnung.','success');
  },320);
 }
 function statusText(){
  const s=state();
  if(!s.chip)return 'Kein E703.11 erkannt';
  return 'E703.11 verbunden · '+(s.uid||'Chip gelesen');
 }

 const measurementNumber=(value,decimals=0)=>{
  if(!Number.isFinite(value))return '—';
  return Number(value).toLocaleString('de-CH',{minimumFractionDigits:decimals,maximumFractionDigits:decimals})
 };
 function startAfeWindow(){
  afeStatsStart=Date.now();
  afeGainSignature=JSON.stringify(window.ELMOS_GUIDED_API?.telemetry?.()?.gains||{});
 }
 function updateAfeTelemetry(){
  const api=window.ELMOS_GUIDED_API;
  const t=api?.telemetry?.();
  if(!t)return;
  const signature=JSON.stringify(t.gains||{});
  if(signature!==afeGainSignature){afeStatsStart=Date.now();afeGainSignature=signature}
  const stats=api.afeStats?.(afeStatsStart)||{count:0};
  setText('gwAfeAdcValue',measurementNumber(t.adcS));
  setText('gwAfeMin',measurementNumber(stats.min));
  setText('gwAfeMax',measurementNumber(stats.max));
  setText('gwAfeHub',measurementNumber(stats.hub));
  const badge=$('gwAfeLiveBadge');
  badge.textContent=!t.online?'Nicht verbunden':t.adcS===null?'Warte auf ADC':t.live?'Live':'Messung pausiert';
  badge.className='gw-live-badge'+(t.adcS!==null?' is-live':'');
  const quality=$('gwAfeQuality');
  quality.className='gw-afe-quality';
  if(!stats.count){
   quality.textContent='Noch keine Messungen. Min-/Max-Druck anlegen; die Grafik markiert ±25’000 Digits.';
  }else if(stats.limitExceeded||Math.abs(t.adcS??0)>25000){
   quality.classList.add('is-warning');
   quality.textContent='Grenze ±25’000 Digits überschritten. PGA/Offset anpassen und den Messbereich erneut abfahren.';
  }else if(stats.hub<4000){
   quality.classList.add('is-neutral');
   quality.textContent='Beobachteter Hub: '+measurementNumber(stats.hub)+' Digits. Für den Kalibrier-Fit sind mindestens 4’000 Digits über die aufgenommenen Referenzpunkte erforderlich.';
  }else{
   quality.classList.add('is-good');
   quality.textContent='Im beobachteten Zeitraum innerhalb ±25’000 Digits. Hub '+measurementNumber(stats.hub)+' Digits bei '+stats.count+' Messwerten. Gesamten Druckbereich prüfen.';
  }
 }
 function updateFinishTelemetry(){
  const api=window.ELMOS_GUIDED_API,t=api?.telemetry?.(),s=state();
  if(!t)return;
  const good=Number.isFinite(t.sensorValue)&&t.dspRaw!==null;
  const primary=good?t.sensorValue:t.dspRaw;
  const range=t.range;
  let digits=2;
  if(range&&Number.isFinite(range.max-range.min)&&range.max-range.min<=2)digits=3;
  setText('gwFinishSignalValue',measurementNumber(primary,good?digits:0));
  setText('gwFinishSignalUnit',good?(t.unit||'—'):t.dspRaw!==null?'Digits':'—');
  setText('gwFinishDsp',measurementNumber(t.dspRaw));
  setText('gwFinishAdc',measurementNumber(t.adcS));
  setText('gwFinishTemp',measurementNumber(t.adcT));
  setText('gwFinishTime',t.dspTime?new Date(t.dspTime).toLocaleTimeString('de-CH',{hour12:false}):'—');
  const badge=$('gwFinishStatus');
  badge.textContent=!t.online?'Nicht verbunden':t.dspRaw===null?'Warte auf DSP':t.live?'Live':'Letzter Messwert';
  badge.className='gw-live-badge'+(t.dspRaw!==null?' is-live':'');
  const source=$('gwFinishSource');
  source.textContent=t.dspRaw===null?'Kein aktueller DSP_S-Wert verfügbar. Bitte Verbindung und Live-Messung prüfen.':
   !range?'DSP_S direkt aus Register 0x30. Druckwert erst mit korrekt bekanntem Anzeigebereich möglich.':
   range.kind==='display'?'Manuelle Zuordnung des DSP_S auf einen Anzeigebereich; keine unabhängig bestätigte Kalibrierung.':
   'Live-Wert aus DSP_S (Register 0x30) und dem aktuellen Kalibrierbereich.';
  const bar=$('gwFinishBar');
  const percent=good&&range&&range.max>range.min?
   Math.max(0,Math.min(100,100*(t.sensorValue-range.min)/(range.max-range.min))):0;
  bar.style.width=percent.toFixed(2)+'%';
  setText('gwFinishRangeMin',good&&range?measurementNumber(range.min,2)+' '+(t.unit||''):'—');
  setText('gwFinishRangeMax',good&&range?measurementNumber(range.max,2)+' '+(t.unit||''):'—');
  const v=t.voltageTargets;
  setText('gwFinishConfig',v?
   'Ausgangs-Sollwerte: S0 '+measurementNumber(v.s0,3)+' V · S1 '+measurementNumber(v.s1,3)+' V · VDD '+measurementNumber(v.vdd,2)+' V. Diese Spannungen wurden nicht am Pin gemessen.':
   'Ausgangs-Sollwerte nicht verfügbar.');
  const completion=$('gwFinishCompletion');
  completion.className='gw-alert '+(s.nvmDone?'success':'warn');
  completion.textContent=s.nvmDone?'NVM-Schreibvorgang bestätigt. Kaltstart und Ausgangsmessung stehen noch aus.':
   'NVM-Schreibbestätigung fehlt. Keine Hardwarefreigabe.';
 }

 function updateUI(){
  if(!mode)return;
  const s=state();
  $('gwChipStatus').textContent=statusText();
  $('gwChipStatus').classList.toggle('is-offline',!s.chip);
  const completed=s.points?.length||0;
  if(stage===4&&plan){renderCapture();if(completed===plan.total)$('gwNext').disabled=false}
  if(stage===5||stage===6||stage===8){
   // Reflect the same guarded source-of-truth as the classic buttons.
   const text=stage===5?s.calStaged?'Koeffizienten im RAM bestätigt':'Noch keine bestätigte RAM-Übernahme':stage===6?s.calVerified?'DSP-Prüfung abgeschlossen':'DSP-Prüfung ausstehend':s.nvmDone?'NVM-Schreiben bestätigt':'NVM-Schreiben noch nicht bestätigt';
   setText('gwFooterHint',text);
  }
  const ready=stage===4?!!plan&&plan.points.every(p=>pointRecord(p)):stage===5?!!s.calStaged:stage===6?!!s.calVerified:stage===8?!!s.nvmDone:true;
  $('gwNext').disabled=!ready||stage===9;
  if(stage===3)updateAfeTelemetry();
  if(stage===9)updateFinishTelemetry();
  if(stage===3||stage===9)apiRedraw();
 }
 function apiRedraw(){
  window.ELMOS_GUIDED_API?.redraw?.();
 }
 function render(){
  if(!mode)return;
  for(let i=0;i<steps.length;i++){
   $('gwPage'+i).hidden=i!==stage;
   const side=document.querySelector('[data-gw-side="'+i+'"]');
   side.classList.toggle('is-active',i===stage);
   side.classList.toggle('is-done',visited.has(i)&&i!==stage);
   side.setAttribute('aria-current',i===stage?'step':'false');
  }
  $('gwKicker').textContent='Schritt '+(stage+1)+' von '+steps.length;
  $('gwTitle').textContent=steps[stage][1];$('gwDesc').textContent=steps[stage][2];
  $('gwProgress').style.width=((stage+1)/steps.length*100).toFixed(1)+'%';
  $('gwPrevious').disabled=stage===0;
  $('gwNext').textContent=stage===8?'Abschluss prüfen':stage===9?'Fertig':'Weiter';
  if(stage===0)document.querySelectorAll('[data-gw-task]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.gwTask===task)));
  if(stage===1)renderPlan();
  if(stage===2)renderPlan()
  if(stage===3){$('gwAfeChartHost').appendChild($('chart'));startAfeWindow()}
  if(stage===9){$('gwFinishChartHost').appendChild($('chart'))}
  if(stage===4)renderCapture();
  if(stage===7)renderOutputOptions()
  msg('');
  updateUI();
 }
 function goto(n){
  stage=Math.max(0,Math.min(9,n));visited.add(stage);render();
  root.scrollIntoView({behavior:'smooth',block:'start'});
 }
 function next(){
  const s=state();
  if(!s.chip){msg('Zuerst den E703.11 über USB verbinden. Eine reine USB-CDC-Verbindung ohne Chipzugriff genügt nicht.','warn');return}
  if(stage===0){
   if(task==='inspect'){close();window.ELMOS_GUIDED_API?.navigate?.(7);return}
   if(task==='output'){goto(7);return}
   goto(1);return;
  }
  if(stage===1){try{makePlan();goto(2)}catch(e){msg(e.message,'error')}return}
  if(stage===2){
   try{plan=applyPlan();goto(3)}catch(e){msg(e.message,'error')}
   return;
  }
  if(stage===3){goto(4);return}
  if(stage===4){
   if(!plan||!plan.points.every(p=>pointRecord(p))){msg('Bitte zuerst alle '+(plan?.total||0)+' Messpunkte erfolgreich aufnehmen.','warn');return}
   goto(5);return;
  }
  if(stage===5){if(!s.calStaged){msg('Bitte die Koeffizienten zuerst berechnen und ins RAM übertragen.','warn');return}goto(6);return}
  if(stage===6){if(!s.calVerified){msg('Die unabhängige DSP-Prüfung muss erfolgreich abgeschlossen sein.','warn');return}goto(7);return}
  if(stage===7){goto(8);return}
  if(stage===8){if(!s.nvmDone){msg('Noch kein erfolgreicher NVM-Schreibvorgang bestätigt.','warn');return}goto(9);return}
 }
 function previous(){
  if(stage===0)return;
  if(task==='output'&&stage===7){goto(0);return}
  goto(stage-1);
 }
 function open(){
  if(mode)return;
  const s=state();
  if(!s.chip){const panel=$('connMsg');if(panel){panel.textContent='Bitte zuerst den Programmieradapter mit dem E703.11 verbinden.';panel.className='callout warn'};return}
  if(typeof ELMOS_COMPACT!=='undefined')ELMOS_COMPACT.set(false);
  if($('compactMode'))$('compactMode').checked=false;
  mode=true;stage=0;task='calibration';visited=new Set([0]);selectedPoint=0;
  try{build()}catch(e){
   console.error(e);
   for(const {el,type,handler} of subscriptions)el.removeEventListener(type,handler);
   subscriptions.length=0;restore();mode=false;if(root)root.replaceChildren();
   if($('connMsg')){$('connMsg').textContent='Geführte Ansicht konnte nicht gestartet werden: '+e.message;$('connMsg').className='callout error'}
   return;
  }
  document.documentElement.classList.add('guided-active');
  root.hidden=false;render();
  poll=window.setInterval(updateUI,750);
  window.scrollTo({top:0,behavior:'auto'});
 }
 function close(){
  if(!mode)return;
  mode=false;
  if(poll){window.clearInterval(poll);poll=null}
  if(pendingCapture){window.clearInterval(pendingCapture);pendingCapture=null}
  for(const {el,type,handler} of subscriptions)el.removeEventListener(type,handler);
  subscriptions.length=0;
  restore();root.hidden=true;root.replaceChildren();document.documentElement.classList.remove('guided-active');
  window.ELMOS_GUIDED_API?.refresh?.();
 }
 function onConnected(){
  // Only on beta branch. Normal/main has no guided module.
  const preference=$('workflowMode')?.value||'guided';
  if(preference==='guided')window.setTimeout(()=>{if(state().chip)open()},0);
 }
 function init(){
  const select=$('workflowMode');
  if(select){
   const storage=()=>new URLSearchParams(location.search).get('demo')==='1'?sessionStorage:localStorage;
   try{select.value=storage().getItem('elmos-workflow-mode-v1')||'guided'}catch(_){select.value='guided'}
   select.addEventListener('change',()=>{
    try{storage().setItem('elmos-workflow-mode-v1',select.value)}catch(_){}
    if(select.value==='guided'&&state().chip)open();
    else if(mode)close();
   });
  }
  $('guidedLaunch')?.addEventListener('click',open);
  $('guidedLaunchTop')?.addEventListener('click',open);
  // A previously saved recipe is intentionally not applied to chip automatically.
 }
 function appliedPlanForConfig(){
  // Only report a matrix that was actually applied, never an editable draft.
  if(!plan||!signature||signature!==JSON.stringify(plan))return null;
  if(Number($('calPointCount').value)!==plan.total||
     Number($('calSOrder').value)!==plan.orderS||
     Number($('calTOrder').value)!==plan.orderT||
     Number($('calSampleCount').value)!==plan.samples||
     Number($('pmin').value)!==plan.pmin||
     Number($('pmax').value)!==plan.pmax||
     $('calUnit').value!==plan.unit)return null;
  return {pCount:plan.pCount,tCount:plan.tCount};
 }
 return {init,open,close,onConnected,makePlan,isOpen:()=>mode,appliedPlanForConfig};
})();
if(typeof window!=='undefined')window.ELMOS_GUIDED=ELMOS_GUIDED;
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ELMOS_GUIDED.init);
 else ELMOS_GUIDED.init();
}
