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
  ['Frontend einstellen','AFE optimal einstellen','Brückenpolarität, PGA1, Offset und PGA2 einstellen. Änderungen gehen nur ins RAM und werden rückgelesen.'],
  ['Messpunkte','Jetzt die Referenzen messen','Stelle die angezeigte Temperatur und den Druck ein. Nimm jeden Punkt erst nach dem Stabilisieren auf.'],
  ['Koeffizienten','Kalibrierung berechnen','Die Messwerte ergeben die DSP-Kennlinie. Zuerst berechnen, dann ins Chip-RAM übertragen.'],
  ['DSP verifizieren','Ergebnis unabhängig prüfen','Prüfe echte Druck- und Temperaturbedingungen. Erst erfolgreiche Prüfungen geben NVM frei.'],
  ['Ausgang','Ausgang und Skalierung','Kontrolliere AODO-Ausgangsart, Versorgungsspannung und Zielspannungen.'],
  ['Alarme','Alarme & Fehler (optional)','Ohne Änderungen weitergehen oder Alarme für diesen Sensor konfigurieren, anschliessend im RAM bestätigen.'],
  ['NVM','Sicher im Sensor speichern','Prüfe die Änderungsliste. Die App gleicht die Chip-UID vor dem Schreiben automatisch ab.'],
  ['Fertig','Sensor abgeschlossen','Der Schreibvorgang wurde bestätigt. Für die Freigabe unbedingt einen echten Kaltstarttest durchführen.']
 ];
 let stage=0,task='calibration',root=null,original=[],mode=false,plan=null,signature=null,taskOpening=false;
 let selectedPoint=0,visited=new Set([0]),poll=null,pendingCapture=null,afeStatsStart=0,afeGainSignature='';
 let latestCapture=null,lastCaptureRenderKey=null,nextSensorBusy=false,nextSensorPending=null,seriesPointFields=null;
 let connectionOpen=false,connectionBusy=false,chipResetPending=false;
 const originalCaptureLabels=new Map();
 const subscriptions=[];
 const subscribe=(el,type,handler)=>{el.addEventListener(type,handler);subscriptions.push({el,type,handler})};
 const defaults={pCount:2,tCount:1,temps:[25],pmin:0,pmax:100,unit:'%',samples:12,outputLimit:25000,orderS:1,orderT:0};
 const state=()=>window.ELMOS_GUIDED_API?.state?.()||{chip:false,points:[],mode:'offline'};
 const VIEW_PREFERENCE_KEY='elmos-ui-last-view-v1';
 const rememberedView=()=>{
  try{return localStorage.getItem(VIEW_PREFERENCE_KEY)}catch(_){return null}
 };
 const saveView=view=>{
  // Only the interface choice persists. Never restore a running measurement,
  // a calibration step or hardware write after a browser reload.
  try{localStorage.setItem(VIEW_PREFERENCE_KEY,view)}catch(_){}
 };
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
  for(const [node,text] of originalCaptureLabels)node.textContent=text;
  originalCaptureLabels.clear();
  for(const x of original)if(x.marker.parentNode)x.marker.parentNode.replaceChild(x.node,x.marker);
  original=[];document.querySelectorAll('.gw-point-active').forEach(el=>el.classList.remove('gw-point-active'));
 }
 function UI(){
  const sides=steps.map((v,i)=>'<button type="button" class="gw-sideitem" data-gw-side="'+i+'"><span class="gw-no">'+(i+1)+'</span><span>'+v[0]+'</span></button>').join('');
  return '<div class="gw-shell"><aside class="gw-sidebar"><div class="gw-backlogo"><span>◆</span> E703.11 · Geführter Abgleich</div><nav class="gw-sideitems">'+sides+'</nav><div class="gw-sidebar-footer">Die Originalsoftware bleibt jederzeit über «Klassisch» erreichbar.<div style="margin-top:9px">Laborversion · keine Hardwarefreigabe für NVM</div></div></aside><main class="gw-main"><div class="gw-topline"><span id="gwKicker" class="gw-kicker">Schritt 1</span><div class="gw-connection-top-actions"><span id="gwChipStatus" class="gw-chipstatus"></span><button type="button" id="gwConnectionToggle" class="gw-connection-link">Verbindung &amp; Diagnose</button></div></div><div class="gw-progressbar"><span id="gwProgress"></span></div><div class="gw-heading-row"><div><h2 class="gw-title" id="gwTitle"></h2><p class="gw-desc" id="gwDesc"></p></div><button class="gw-preset gw-preset-launch" id="gwPresetLaunch" type="button" aria-haspopup="dialog" aria-controls="gwPresetDialog" hidden><strong>Preset laden</strong></button></div>'+
   '<div id="gwPage0" class="gw-page"><div class="gw-columns gw-six">'+
    '<button class="gw-choice" data-gw-task="calibration"><span class="gw-choice-icon">◉</span><strong>Sensor neu abgleichen</strong><small>Von der Messung über die DSP-Prüfung bis zur sicheren NVM-Programmierung.</small></button>'+
    '<button class="gw-choice" data-gw-task="alarms"><span class="gw-choice-icon">⚑</span><strong>Alarme und Fehler ändern</strong><small>Bestehenden Sensor auslesen, Fehlerreaktionen einzeln anpassen und separat speichern.</small></button>'+
    '<button class="gw-choice" data-gw-task="output"><span class="gw-choice-icon">↗</span><strong>Nur Ausgang ändern</strong><small>Bereits kalibrierten Sensor prüfen und AODO-Ausgang neu konfigurieren.</small></button>'+
    '<button type="button" class="gw-choice" data-gw-task="nvm"><span class="gw-choice-icon">▣</span><strong>Sensorbrücken-Rechner</strong><small>NVM-Daten importieren und Brückennullpunkt, Spanne, TK0 und TKR analysieren.</small></button>'+
    '<button class="gw-choice" data-gw-task="inspect"><span class="gw-choice-icon">▤</span><strong>EEPROM / Diagnose</strong><small>Die bestehende Register- und EEPROM-Ansicht ohne geführten Abgleich öffnen.</small></button>'+
    '<button class="gw-choice" data-gw-task="testlog"><span class="gw-choice-icon">◷</span><strong>Test / Logging</strong><small>Beliebige Sensortests durchführen, alle Telemetriedaten samt Notizen speichern.</small></button>'+
    '<button class="gw-choice" data-gw-task="verification"><span class="gw-choice-icon">↕</span><strong>Nachmessung</strong><small>Druck- und Temperaturprüfungen mit Hysterese und frei wählbaren Prüfpunkten.</small></button>'+
    '<button class="gw-choice" data-gw-task="archive"><span class="gw-choice-icon">▥</span><strong>Archiv</strong><small>Frühere Abgleiche und Tests suchen, Ergebnisse prüfen und vergleichen.</small></button></div>'+
    '<div class="gw-alert">Für den Sensorbrücken-Rechner und das Archiv ist keine Sensorverbindung erforderlich. Für den geführten Sensorabgleich muss zuerst der Chip über USB erkannt werden.</div></div>'+
   '<div id="gwPage1" class="gw-page" hidden><div class="gw-preset-grid">'+
    '<button class="gw-preset" data-gw-preset="quick"><strong>Schnell</strong><small>0–100 % · 2 Druckpunkte, ohne Temperaturkorrektur.</small></button>'+
    '<button class="gw-preset" data-gw-preset="tk0"><strong>TK0 · 3 Punkte</strong><small>Nullpunkt-Temperaturgang und Druckspanne · ohne TKE.</small></button>'+
     '<button class="gw-preset" data-gw-preset="tke"><strong>TK0 + TKE · 4 Punkte</strong><small>Nullpunkt und Empfindlichkeit temperaturabhängig kalibrieren.</small></button>'+
     '<button class="gw-preset" data-gw-preset="temperature"><strong>Mit Temperatur</strong><small>0–100 % · 2 Druckpunkte × 3 Temperaturstufen.</small></button>'+
    '<button class="gw-preset" data-gw-preset="custom"><strong>Individuell</strong><small>0–100 % · 3 Druckpunkte × 2 Temperaturstufen; anpassbar.</small></button></div>'+
    '<div class="gw-tile is-soft"><h3>Deinen Messablauf festlegen</h3><div class="gw-fields gw-3">'+
     '<label>Druckpunkte<select id="gwPressureCount"><option>2</option><option>3</option><option>4</option><option>5</option></select></label>'+
     '<label>Temperaturbedingungen<select id="gwTemperatureCount"><option value="1">1 · keine Temperaturkorrektur</option><option value="2">2 · lineare Temperaturkorrektur</option><option value="3">3 · quadratische Temperaturkorrektur</option></select></label>'+
     '<label>Abgleichart<select id="gwComplexity"><option value="simple">Automatisch · empfohlen</option><option value="advanced">Experte · Polynomordnung selber wählen</option></select></label>'+
    '</div><div class="gw-fields gw-3" id="gwThermalFitRow" hidden><label>Temperaturmodell<select id="gwThermalFit"><option value="full">TK0 + TKE · 4 Messpunkte</option><option value="tk0">Nur TK0 · 3 Messpunkte</option></select></label></div><div class="gw-fields gw-3 gw-advanced" id="gwOrderFields" hidden><label>Druckpolynomordnung<select id="gwSOrder"><option value="1">1 · Linear</option><option value="2">2 · Quadratisch</option><option value="3">3 · Kubisch</option></select></label><label>Temperaturordnung<select id="gwTOrder"><option value="0">0 · Keine</option><option value="1">1 · Linear</option><option value="2">2 · Quadratisch</option></select></label></div>'+
    '<div class="gw-fieldnote">Standard: vollständige Druck-Temperatur-Matrix. Bei 2 Druckpunkten und 2 Temperaturstufen kann TK0 allein mit 3 Messungen abgeglichen werden (ohne TKE).</div></div>'+
    '<div id="gwPlanPreview" class="gw-summary"></div></div>'+
   `<div id="gwPage2" class="gw-page gw-setup-page" hidden>
    <div class="gw-columns gw-setup-grid">
     <section class="gw-tile gw-setup-tile">
      <div class="gw-section-head"><div><h3>Druckbereich und Messung</h3><p>Standardpreset 0–100 % · anpassbar</p></div></div>
      <div class="gw-fields gw-setup-pressure" id="gwSensorFields"></div>
     </section>
     <section class="gw-tile gw-setup-tile">
      <div class="gw-section-head"><div><h3>Temperatur und DSP</h3><p>Temperaturstufen und digitaler Zielbereich</p></div></div>
      <div class="gw-fields gw-setup-temps" id="gwTemperatures"></div>
      <div class="gw-subheading">Zielbereich der Kalibrierung</div>
      <div class="gw-fields gw-dsp-fields" id="gwDspFields"></div>
     </section>
    </div>`+
    '<div id="gwSetupPreview" class="gw-summary gw-setup-summary"></div></div>'+
   '<div id="gwPage3" class="gw-page gw-afe-page" hidden><div class="gw-columns gw-afe-layout">'+
    '<section class="gw-tile gw-control gw-afe-controls"><div class="gw-section-head"><span class="gw-section-no">01</span><div><h3>Verstärkung und Offset</h3><p>Änderungen werden direkt ins Chip-RAM übernommen</p></div></div><div id="gwAFEPanel"></div><div id="gwGain"></div><div id="gwAFEMsg"></div><div id="gwConfigAFE"></div><div class="gw-afe-guide"><strong>AFE richtig einstellen</strong><ol><li>Minimalen und maximalen Referenzdruck anlegen.</li><li>PGA1, Offset und PGA2 anpassen. Ziel: grosser Hub ohne Übersteuerung.</li><li>Die rote Grenze bei ±25’000 Digits nicht überschreiten.</li></ol><small>Änderst du die AFE nach einer Messung, müssen bereits erfasste Messpunkte neu aufgenommen werden.</small></div></section>'+
    '<section class="gw-tile gw-afe-monitor"><div class="gw-monitor-head"><div><h3>ADC_S · Live-Verlauf</h3><p>Rohsignal der Druckmesskette · letzte 60 Sekunden</p></div><span id="gwAfeLiveBadge" class="gw-live-badge">Warte auf Werte</span></div><div class="gw-afe-current"><strong id="gwAfeAdcValue" aria-live="off">—</strong><span>Digits</span></div><div class="gw-afe-chart" id="gwAfeChartHost"></div><div class="gw-chart-legend"><span class="gw-legend-limit">Grenzen ±25’000</span><span class="gw-legend-zero">Nulllinie</span><span class="gw-legend-line">ADC_S live</span></div>'+
    '<div class="gw-afe-kpis"><div><span>Minimum</span><strong id="gwAfeMin">—</strong></div><div><span>Maximum</span><strong id="gwAfeMax">—</strong></div><div><span>Hub (Max − Min)</span><strong id="gwAfeHub">—</strong></div></div>'+
    '<div class="gw-monitor-actions"><div id="gwAfeLiveActions"></div><button type="button" id="gwAfeReset" class="gw-secondary-btn">Min/Max zurücksetzen</button></div><div id="gwAfeQuality" class="gw-afe-quality" role="status">Min/Max werden ab dem Start dieses AFE-Schritts erfasst.</div><div id="gwAfeMessage"></div></section></div></div>'+
   '<div id="gwPage4" class="gw-page" hidden><div class="gw-points-layout"><div class="gw-point-nav" id="gwPointNav"></div><div class="gw-tile gw-control"><div id="gwPointConfirmation" class="gw-point-confirmation" hidden role="status" aria-live="polite"></div><div id="gwCurrentSetpoint" class="gw-summary gw-next-point"></div><div id="gwPointHost"></div><div id="gwSampleStatus"></div><div id="gwPointMessages"></div></div></div><div class="gw-alert">Der angezeigte Druck und die Temperatur sind <b>Referenz-Sollwerte</b>. Sie werden nicht automatisch erzeugt. Wähle den tatsächlichen Sollwert am Druckkalibrator und stelle die Temperaturkammer stabil ein, bevor du auf «aufnehmen» klickst.</div></div>'+
   '<div id="gwPage5" class="gw-page" hidden><div class="gw-columns"><div class="gw-tile gw-control"><h3>Polynom und DSP-Ziel</h3><div class="gw-fields gw-3" id="gwFitFields"></div><div class="gw-panel-actions" id="gwFitActions"></div><div id="gwFitStatuses"></div><div id="gwFitDetails"></div></div><div class="gw-tile is-soft"><h3>Sicherer Ablauf</h3><p>1. Koeffizienten aus den gemessenen Punkten berechnen.</p><p>2. Zahlenbereich und Fehler kontrollieren.</p><p>3. Berechnete Werte nur ins RAM übertragen und rücklesen.</p><div class="gw-alert">Der berechnete Fit ist noch keine Hardware-Verifikation. Im nächsten Schritt wird DSP_S an unabhängigen Punkten geprüft.</div></div></div></div>'+
   '<div id="gwPage6" class="gw-page" hidden><div class="gw-columns"><div class="gw-tile gw-control"><h3>Unabhängige Prüfpunkte</h3><div class="gw-fields gw-3" id="gwVerifyFields"></div><div class="gw-panel-actions" id="gwVerifyActions"></div><div id="gwVerifyStatuses"></div><details><summary>Prüfprotokoll</summary><div id="gwVerifyDetails"></div></details></div><div class="gw-tile is-soft"><h3>Was prüfe ich hier?</h3><p>Prüfe die gewünschte Anzahl Punkte neu, auch an den Druckendpunkten. Bereits ein bestandener Prüfpunkt genügt für diesen Nachprüfschritt – auch bei TK0/TKE. Weitere Druck- und Temperaturpunkte sind freiwillig und erhöhen die Aussagekraft.</p><div class="gw-alert warn">Die Live-Anzeige allein zählt nicht als Prüfung. Verwende «Prüfwert aus DSP_S lesen» und kontrolliere die tatsächliche Abweichung.</div></div></div></div>'+
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
      <div id="gwOutputClipping"></div><div class="gw-panel-actions" id="gwOutputActions"></div><div class="gw-panel-actions"><button id="gwOutputSkipAlarm" type="button">Ohne Alarmänderung weiter zur NVM-Programmierung</button></div>
     </section>
     <section class="gw-tile is-soft gw-output-review">
      <div class="gw-section-head"><div><h3>Vorschau und Status</h3><p>Ausgelesene Werte, Skalierung und Startschutz</p></div></div>
      <div id="gwOutputStatuses"></div>
      <details><summary>Ausgelesene Chip-Register</summary><div id="gwOutputRegisters"></div></details>
     </section>
    </div>
   </div>`+
   '<div id="gwPage8" class="gw-page" hidden><div class="gw-tile gw-control">'+
    '<h3>Alarme &amp; Fehler (optional)</h3><p>Standardmässig keine Alarmänderung. Bei Bedarf gezielt ändern; nach erfolgreicher RAM-Prüfung werden Alarme zusammen mit den DSP-/Ausgangseinstellungen im NVM gespeichert.</p>'+
    '<label><input id="gwUseAlarms" type="checkbox"> Alarme für diesen Sensor einstellen</label>'+
    '<div id="gwAlarmConfigArea" hidden><div class="gw-panel-actions" id="gwAlarmRead"></div><div id="gwAlarmDiagnostic"></div><div id="gwAlarmHost"></div></div>'+
    '<div class="gw-panel-actions"><button id="gwSkipAlarm" type="button">Ohne Alarmänderung zur NVM-Programmierung</button></div>'+
    '<p class="muted small">Beim Überspringen bleiben bereits vorhandene Alarmregister unverändert. Alarme deaktivieren erfordert eine ausdrücklich vorgemerkte Einstellung.</p></div></div>'+
   '<div id="gwPage9" class="gw-page" hidden><div class="gw-columns"><div class="gw-tile gw-control"><h3>Änderungen prüfen und bestätigen</h3><div id="gwNvmBackup"></div><div class="gw-panel-actions" id="gwNvmPrepare"></div><div id="gwNvmMessages"></div><div class="gw-panel-actions" id="gwNvmWrite"></div><div id="gwNvmDetails"></div></div><div class="gw-tile is-warning"><h3>Wichtig vor dem NVM-Schreiben</h3><p>Ein Stromunterbruch während der Programmierung kann den Sensor unbrauchbar machen.</p><p>Prüfe Chip-UID und die Änderungsübersicht. Zuerst an einem entbehrlichen Testchip validieren.</p><p>Der Button ist nur freigegeben, wenn die bestehende Sicherheitslogik alle Voraussetzungen bestätigt.</p></div></div></div>'+
   '<div id="gwPage10" class="gw-page gw-finish-page" hidden><section class="gw-finish-signal"><div class="gw-finish-top"><div><span class="gw-kicker">Live-Sensorsignal</span><h3>Aktueller Sensorausgang</h3></div><span id="gwFinishStatus" class="gw-live-badge">Warte auf Chipwerte</span></div><div class="gw-finish-number" aria-live="off"><strong id="gwFinishSignalValue">—</strong><span id="gwFinishSignalUnit">—</span></div><div id="gwFinishSource" class="gw-finish-caption">DSP_S wird vom Chip gelesen und auf den eingestellten Anzeigebereich bezogen.</div><div class="gw-finish-bar"><span id="gwFinishBar"></span></div><div class="gw-finish-limits"><span id="gwFinishRangeMin">—</span><span id="gwFinishRangeMax">—</span></div><div class="gw-finish-kpis"><div><span>DSP_S</span><strong id="gwFinishDsp">—</strong><small>Digits</small></div><div><span>ADC_S</span><strong id="gwFinishAdc">—</strong><small>Digits</small></div><div><span>ADC_T</span><strong id="gwFinishTemp">—</strong><small>Digits</small></div><div><span>Letzte Messung</span><strong id="gwFinishTime">—</strong></div></div></section>'+
    '<div class="gw-columns gw-finish-bottom"><section class="gw-tile"><div class="gw-section-head"><div><h3>Signalverlauf</h3><p>ADC_S im Zeitverlauf · letzte 60 Sekunden</p></div></div><div id="gwFinishChartHost" class="gw-finish-chart"></div></section><section class="gw-tile gw-finish-checklist"><h3>Abgleich und Freigabe</h3><div id="gwFinishCompletion" class="gw-alert">NVM-Status prüfen.</div><p id="gwFinishConfig">Gewünschte Ausgangseinstellungen werden hier als Sollwerte dargestellt.</p><p class="gw-finish-warning">Vor der Freigabe den Sensor stromlos machen und den Ausgang nach dem Neustart mit einem Messgerät prüfen. Die Anzeige ersetzt keinen Hardwaretest.</p><div class="gw-panel-actions" id="gwPostBoot"></div><button class="gw-secondary-link" id="gwBackClassic" type="button">Zur vollständigen Expertenansicht wechseln</button></section></div></div>'+
   '<section id="gwSwapPage" class="gw-tile" hidden><ol><li>Stecke den fertig abgeglichenen Sensor ab.</li><li>Schliesse den nächsten Sensor am Programmieradapter an.</li><li>Klicke auf «Neuen Sensor verbinden».</li></ol><p>Der Assistent übernimmt den Messplan und die Ausgangsvorgaben. Er schreibt die Frontend-Einstellungen ins RAM des neuen Sensors. Für ihn nimmst du danach neue Messwerte auf.</p><div class="gw-panel-actions"><button id="gwSwapConnect" class="primary" type="button">Neuen Sensor verbinden</button><button id="gwSwapChoose" type="button" hidden>USB-Port auswählen</button><button id="gwSwapCancel" type="button">Serie abbrechen</button></div></section>'+
   '<section id="gwConnectionPage" class="gw-page gw-connection-page" hidden><div class="gw-panel-actions gw-connection-backbar"><button id="gwConnectionBackTop" type="button">← Zurück zum Assistenten</button></div><div class="gw-columns">'+
    '<section class="gw-tile"><h3>USB-Adapter und Chip-Protokoll</h3><p>Bei einem anderen Sensor kannst du 1-Wire, I²C oder SPI auswählen, ohne in die klassische Ansicht zu wechseln. Der bisherige USB-Port wird sicher geschlossen und mit dem neuen Protokoll neu initialisiert.</p>'+
    '<div class="gw-fields"><label>Programmieradapter<select id="gwConnectionAdapter"><option value="ssp3">Original ELMOS SSP3</option><option value="bridge">ESP32-C3 / Pro Micro</option></select></label><label>Chip-Schnittstelle<select id="gwConnectionInterface"><option value="plc">1-Wire · AODO</option><option value="i2c">I²C · SCL/SDA</option><option value="spi">SPI · Testmodus (SSP3)</option></select></label></div>'+
    '<div class="gw-panel-actions"><button id="gwConnectionApply" class="primary" type="button">Protokoll übernehmen &amp; verbinden</button><button id="gwConnectionChoose" type="button">Anderen USB-Port auswählen</button></div><p class="gw-connection-hint">Ein neuer Sensor erhält eine neue Chip-UID-Prüfung. Ein bisheriger Abgleich wird vor dem Wechsel separat abgeschlossen oder als unvollständig archiviert. Keine NVM-Programmierung.</p>'+
    '<div class="gw-alert" id="gwConnectionStatus" role="status">Verbindungsstatus wird abgefragt.</div></section>'+
    '<section class="gw-tile"><h3>Verbindung beheben</h3><p>Falls der Adapter verbunden ist, aber der Sensor nicht antwortet, kannst du die Register nur lesend prüfen und das USB-Protokoll zur Fehlersuche speichern.</p>'+
    '<div class="gw-panel-actions"><button id="gwConnectionReinit" type="button">Sensor erneut erkennen</button><button id="gwConnectionLog" type="button">USB-Protokoll herunterladen</button><button id="gwConnectionDiagnose" data-gw-expert hidden type="button">Registerdiagnose (nur lesen)</button><button id="gwConnectionStartup" data-gw-expert hidden type="button">1-Wire-Lesetest (12 s)</button></div>'+
    '<p class="gw-connection-hint">Der 12-Sekunden-Test führt keine Power-Cycle- oder NVM-Befehle aus. Für ein abgelaufenes 1-Wire-Startfenster zuerst die normale Neuinitialisierung verwenden. SPI wird bei DIY-Bridges nicht unterstützt.</p>'+
    '<details id="gwConnectionAdvanced" class="gw-connection-advanced" data-gw-expert hidden><summary>Erweitert · 1-Wire-Magic-Cookie (nur RAM)</summary><p>Nur bei nicht erkanntem Sensor am SSP3 und ausschliesslich am Prüfplatz: Die zwei dokumentierten PLC-Frames schalten 1-Wire eventuell vorübergehend im RAM frei. Dadurch kann der Analogausgang AODO bis zum Sensor-Neustart überlagert werden. Keine NVM-Programmierung.</p><label class="gw-connection-consent"><input type="checkbox" id="gwConnectionMagicConfirm"> Ich akzeptiere die temporäre Umschaltung von AODO/1-Wire am Testchip.</label><div class="gw-panel-actions"><button type="button" id="gwConnectionMagic" disabled>Magic Cookie testen (nur RAM)</button></div></details>'+
    '<pre id="gwConnectionDiagnosticResult" class="gw-connection-diagnostic" role="status" hidden></pre><div class="gw-panel-actions"><button id="gwConnectionClose" type="button">Zurück zum Assistenten</button><a href="usb-diagnose.html" target="_blank" rel="noopener noreferrer">Separater USB-Test</a></div></section>'+
    '</div></section>'+
   '<div id="gwLogPage" class="gw-page gw-logger-page" hidden></div>'+
   '<dialog id="gwPresetDialog" aria-labelledby="gwPresetTitle"><div class="gw-preset-dialog-heading"><h3 id="gwPresetTitle">Sensor-Presets</h3><button id="gwPresetClose" type="button">Schliessen</button></div><div class="gw-fields gw-3" id="gwConfigFields"></div><div id="gwConfigSource"></div><div id="gwConfigGroups"></div><div class="gw-panel-actions" id="gwConfigActions"></div><div id="gwConfigEffect"></div><div id="gwConfigStatus"></div></dialog>'+
   '<div id="gwMessage" class="gw-alert" hidden></div><footer class="gw-footer"><small id="gwFooterHint">E703.11 · Kalibrierassistent</small><div class="gw-actions"><button id="gwTasks" type="button" hidden>Zur Aufgabenübersicht</button><button id="gwPrevious" type="button">Zurück</button><button id="gwNext" class="primary" type="button">Weiter</button></div></footer></main></div>';
 }
 function build(){
  root=$('guidedWorkspace');
  root.innerHTML=UI();
  lastCaptureRenderKey=null;
  window.ELMOS_TEST_LOGGER?.mount($('gwLogPage'));
  for(const id of ['pmin','pmax','calUnit','calSampleCount','calUnitOther'])moveLabel(id,'gwSensorFields');
  moveLabel('calDspLimit','gwDspFields');
  if($('calDspExplanation'))moveId('calDspExplanation','gwDspFields');
  moveLabel('calTempSource','gwDspFields');
  for(const id of ['configLabel','configPreset','configFile'])moveLabel(id,'gwConfigFields');
  moveId('configPresetSource','gwConfigSource');
  moveId('configGroups','gwConfigGroups');moveId('configImportEffect','gwConfigEffect');
  for(const id of ['configApply','configPresetEdit','configPresetSave','configPresetCancel','configPresetDelete','configSave'])moveId(id,'gwConfigActions');
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
  moveLabel('calSOrder','gwFitFields');moveLabel('calTOrder','gwFitFields');moveLabel('calFitMode','gwFitFields');
  for(const id of ['calCalculate','calApplyRam'])moveId(id,'gwFitActions');
  for(const id of ['calFitMsg','calTempFallback','calDspProposal','calRamPrereq','calRamStageMsg'])moveId(id,'gwFitStatuses');
  move($('calCoeffList').closest('details'),'gwFitDetails');
  for(const id of ['calVerifyCount','calVerifyTolerance'])moveLabel(id,'gwVerifyFields');
  moveId('calVerifyRows','gwVerifyActions');
  for(const id of ['calVerifyCoverage','calVerifyProgress','calRamMsg'])moveId(id,'gwVerifyStatuses');
  moveId('calVerifyList','gwVerifyDetails');
  moveLabel('expertOutputMode','gwOutputFields');moveId('expertPwmPeriodField','gwOutputFields');
  moveLabel('expertScaleEnable','gwOutputFields');
  moveLabel('psscVdd','gwVddHolder');
  moveLabel('psscS0','gwS0Holder');moveLabel('psscS1','gwS1Holder');
  moveId('psscDefaultScaling','gwScalingActions');
  for(const id of ['expertScaleGain','expertScaleOffset'])moveLabel(id,'gwExpertOutputFields');
  for(const id of ['expertOutputPreset','expertOutputStage','outputNvmRead'])moveId(id,'gwOutputActions');
  moveId('outputClippingFields','gwOutputClipping');
  for(const id of ['outputModeHint','psscScalingPreview','expertOutputMsg','outputOneWireStatus','outputScalingAdvisory','psscOneWireOnlyStatus'])moveId(id,'gwOutputStatuses');
  moveId('psscCurrentOutputStatus','gwOutputRegisters');
  moveId('alarmEditorSection','gwAlarmHost');
  move($('alarmSummaryHeading').closest('section'),'gwAlarmDiagnostic');
  moveId('alarmReadEeprom','gwAlarmRead');
  moveLabel('nvmAutoBackup','gwNvmBackup');
  moveId('nvmPrepare','gwNvmPrepare');moveId('nvmProgress','gwNvmPrepare');
  for(const id of ['nvmRecheckActions','nvmRecheckHint','nvmRecheckMsg'])moveId(id,'gwNvmPrepare');
  for(const id of ['nvmMsg','nvmOutputAdvisory','nvmUidHint','nvmWritePrereq'])moveId(id,'gwNvmMessages');
  moveId('nvmUserIdField','gwNvmBackup');
  moveId('nvmProgram','gwNvmWrite');
  moveId('nvmWriteStatus','gwNvmWrite');
  moveId('nvmDiffDetails','gwNvmDetails');
  moveId('nvmRestartControls','gwPostBoot');
  document.querySelectorAll('[data-gw-task]').forEach(button=>button.addEventListener('click',async()=>{
   if(taskOpening)return;
   taskOpening=true;
   task=button.dataset.gwTask;
   render();
   try{await next()}finally{taskOpening=false}
  }));
  $('gwPresetLaunch').addEventListener('click',()=>$('gwPresetDialog').showModal());
  $('gwPresetClose').addEventListener('click',()=>$('gwPresetDialog').close());
  document.querySelectorAll('[data-gw-preset]').forEach(button=>button.addEventListener('click',()=>preset(button.dataset.gwPreset)));
  for(const id of ['gwPressureCount','gwTemperatureCount','gwSOrder','gwTOrder','gwThermalFit'])$(id).addEventListener('change',renderPlan);
  $('gwComplexity').addEventListener('change',()=>{
   if($('gwComplexity').value==='advanced'){
    $('gwSOrder').value=String(Math.min(3,Number($('gwPressureCount').value)-1));
    $('gwTOrder').value=String(Number($('gwTemperatureCount').value)-1);
   }
   renderPlan();
  });
  $('gwNext').addEventListener('click',()=>stage===10?prepareNextSensor():next());$('gwPrevious').addEventListener('click',previous);
  $('gwSwapConnect').addEventListener('click',()=>connectNextSensor(false));
  $('gwSwapChoose').addEventListener('click',()=>connectNextSensor(true));
  $('gwSwapCancel').addEventListener('click',returnToTasks);
  $('gwConnectionToggle').addEventListener('click',()=>connectionOpen?closeConnectionPanel():openConnectionPanel());
  $('gwConnectionClose').addEventListener('click',closeConnectionPanel);
  $('gwConnectionBackTop').addEventListener('click',closeConnectionPanel);
  $('gwConnectionAdapter').addEventListener('change',updateConnectionChoices);
  subscribe($('expertMode'),'change',()=>{updateConnectionChoices();renderConnectionStatus()});
  $('gwConnectionApply').addEventListener('click',()=>connectGuidedSensor(false));
  $('gwConnectionChoose').addEventListener('click',()=>connectGuidedSensor(true));
  $('gwConnectionReinit').addEventListener('click',()=>connectGuidedSensor(false));
  $('gwConnectionDiagnose').addEventListener('click',()=>guidedConnectionDiagnostic('diagnose'));
  $('gwConnectionStartup').addEventListener('click',()=>guidedConnectionDiagnostic('startup'));
  $('gwConnectionLog').addEventListener('click',()=>guidedConnectionDiagnostic('export'));
  $('gwConnectionMagicConfirm').addEventListener('change',renderConnectionStatus);
  $('gwConnectionMagic').addEventListener('click',()=>guidedConnectionDiagnostic('magic'));
  $('gwTasks').addEventListener('click',returnToTasks);
  $('gwAfeReset').addEventListener('click',()=>{
   afeStatsStart=Date.now();afeGainSignature='';
   updateUI();
  });
  $('gwBackClassic').addEventListener('click',close);
  $('gwUseAlarms').addEventListener('change',()=>{
   $('gwAlarmConfigArea').hidden=!$('gwUseAlarms').checked;
   if(!$('gwUseAlarms').checked)window.ELMOS_GUIDED_API?.skipAlarms?.();
   updateUI();
  });
  $('gwOutputSkipAlarm').addEventListener('click',()=>{
   window.ELMOS_GUIDED_API?.skipAlarms?.();goto(9);
  });
  $('gwSkipAlarm').addEventListener('click',()=>{
   $('gwUseAlarms').checked=false;$('gwAlarmConfigArea').hidden=true;
   window.ELMOS_GUIDED_API?.skipAlarms?.();goto(9);
  });
  document.querySelectorAll('[data-gw-side]').forEach(button=>button.addEventListener('click',()=>{const index=Number(button.dataset.gwSide);if(visited.has(index)){stage=index;render()}}));
  subscribe(document,'elmos-config-applied',syncImportedConfig);
  subscribe($('expertMode'),'change',renderOutputOptions);
  subscribe($('expertOutputMode'),'change',renderOutputOptions);
  for(const id of ['pmin','pmax','calUnit','calSampleCount','calDspLimit'])subscribe($(id),'change',renderPlan);
  for(const id of ['capLo','capHi',...Array.from({length:8},(_,k)=>'calExtra'+(k+1)+'Capture')]){
   subscribe($(id),'click',()=>observeCapture());
  }
  $('gwPressureCount').value='2';$('gwTemperatureCount').value='1';$('gwThermalFit').value='full';$('gwComplexity').value='simple';
  renderPlan();
 }
 function preset(name){
  const p=ELMOS_GUIDED_PLAN.presets[name];if(!p)return;
  // Presets use normalized percent of the pressure span. Ask before losing
  // real measured calibration points when switching from a physical unit.
  const rangeChanged=String($('pmin').value)!==String(p.pmin)||
   String($('pmax').value)!==String(p.pmax)||$('calUnit').value!==p.unit;
  if(rangeChanged&&(state().points||[]).length){
   if(!window.confirm('Das Preset stellt den Druckbereich auf 0–100 % um. Bereits erfasste Messpunkte werden verworfen. Fortfahren?'))return;
  }
  if(rangeChanged){
   fieldValue('calUnit',p.unit);
   fieldValue('pmin',p.pmin);
   fieldValue('pmax',p.pmax);
  }
  $('gwPressureCount').value=String(p.pCount);$('gwTemperatureCount').value=String(p.tCount);
  $('gwComplexity').value=p.complex?'advanced':'simple';
  $('gwSOrder').value=String(Math.min(3,p.pCount-1));
  $('gwTOrder').value=String(p.tCount-1);
  $('gwThermalFit').value=p.fitMode||'full';
  setTemperatureInputs(p.tCount,p.temperatures);
  renderPlan();
 }
 function defaultTemperatures(n){return n===1?[25]:n===2?[10,60]:[-10,25,65]}
 function setTemperatureInputs(n,values){
  const parent=$('gwTemperatures'),existing=[...parent.querySelectorAll('input')].map(el=>Number(el.value));
  const target=values||(existing.length===n?existing:defaultTemperatures(n));
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
   orderS:complex?$('gwSOrder').value:undefined,orderT:complex?$('gwTOrder').value:undefined,
    fitMode:pCount===2&&tCount===2?$('gwThermalFit').value:'full'
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
   const thermalEligible=pCount===2&&tCount===2&&(!advanced||Number($('gwTOrder').value)===1);
   $('gwThermalFitRow').hidden=!thermalEligible;
   if(!thermalEligible)$('gwThermalFit').value='full';
  try{
   const candidate=makePlan();plan=candidate;
   const tags=candidate.points.map(p=>'<span><b>'+p.label+'</b>'+p.pressure+' '+candidate.unit+' · '+p.temperature+' °C</span>').join('');
   $('gwPlanPreview').innerHTML='<strong>'+candidate.pCount+' Druckpunkte / '+candidate.tCount+' Temperaturstufen = '+candidate.total+' echte Messungen</strong><p>'+(candidate.fitMode==='tk0'?'TK0 ohne TKE · 3 Koeffizienten':'Druckpolynom '+candidate.orderS+'. Ordnung · Temperaturpolynom '+candidate.orderT+'. Ordnung')+' · '+candidate.samples+' Samples je Messung</p><div class="gw-matrix">'+tags+'</div>';
   $('gwPlanPreview').className='gw-summary';
   const setup=$('gwSetupPreview');
   if(setup)setup.textContent='Geplant: '+candidate.total+' Messungen · '+candidate.pmin+'–'+candidate.pmax+' '+candidate.unit+' · Temperatur '+candidate.temperatures.join(' / ')+' °C';
   msg('');
  }catch(e){
   plan=null;$('gwPlanPreview').textContent=e.message;$('gwPlanPreview').className='gw-alert error';
  }
  document.querySelectorAll('[data-gw-preset]').forEach(btn=>{
   const p=ELMOS_GUIDED_PLAN.presets[btn.dataset.gwPreset];
   btn.setAttribute('aria-pressed',String(p.pCount===pCount&&p.tCount===tCount&&p.complex===advanced&&(p.fitMode||'full')===(plan?.fitMode||'full')));
  });
 }
 function fieldValue(id,value,event='change'){
  const el=$(id);if(!el)return;
  const next=String(value);
  if(String(el.value)!==next){el.value=next;el.dispatchEvent(new Event(event,{bubbles:true}))}
 }
 function pointSettingIds(point){
  if(point.slot==='lo')return ['pointLoName','calLoTemp'];
  if(point.slot==='hi')return ['pointHiName','calHiTemp'];
  const k=point.extraSlot??point.index;return ['calExtra'+k+'Name','calExtra'+k+'Pressure','calExtra'+k+'Temp'];
 }
 function readPointSettings(matrix){
  const fields=matrix.points.flatMap(pointSettingIds).map(id=>[id,$(id).value]);
  return {signature:JSON.stringify(matrix),fields};
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
   fieldValue('calFitMode',p.fitMode);
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
    const k=point.extraSlot??point.index;
    const nameEl=$('calExtra'+k+'Name');nameEl.value=name;nameEl.dataset.userEdited='1';
    const pressure=$('calExtra'+k+'Pressure');pressure.dataset.userEdited='1';
    fieldValue('calExtra'+k+'Pressure',point.pressure);
    fieldValue('calExtra'+k+'Temp',point.temperature);
   }
  }
  if(seriesPointFields?.signature===nextSignature){
   for(const [id,value] of seriesPointFields.fields)fieldValue(id,value);
  }
  seriesPointFields=null;
  fieldValue('calVerifyCount',1);
  signature=nextSignature;selectedPoint=0;plan=p;latestCapture=null;lastCaptureRenderKey=null;
  return p;
 }
 function syncImportedConfig(event){
  if($('gwPresetDialog')?.open)$('gwPresetDialog').close();
  const included=event?.detail?.included||[];
  if(!included.some(g=>['reference','measurement','dsp'].includes(g))){
   msg('Config übernommen. Die Messmatrix bleibt unverändert.','success');
   return;
  }
  const s=Number($('calSOrder').value),t=Number($('calTOrder').value),
   total=Number($('calPointCount').value);
  if(included.includes('measurement')||included.includes('dsp')){
   const matrix=event.detail.matrix;
   const candidates=[];
   for(let p=2;p<=5;p++)for(let temp=1;temp<=3;temp++){
    if((p*temp===total||(p===2&&temp===2&&total===3&&$('calFitMode').value==='tk0'))&&p>s&&temp>t)candidates.push({p,temp,fitMode:$('calFitMode').value});
   }
   if(!candidates.length&&!matrix){
    msg('Die importierten DSP- und Messparameter können nicht automatisch als Wizard-Matrix dargestellt werden. Bitte Druck-/Temperaturpunkte im Plan kontrollieren.','warn');
    return;
   }
   const oldP=Number($('gwPressureCount').value),oldT=Number($('gwTemperatureCount').value);
   candidates.sort((a,b)=>
    (Math.abs(a.p-oldP)*2+Math.abs(a.temp-oldT))-
    (Math.abs(b.p-oldP)*2+Math.abs(b.temp-oldT)));
   const selected=matrix||candidates[0];
   $('gwPressureCount').value=String(selected.p);
   $('gwTemperatureCount').value=String(selected.temp);
   // Even for measurement-only files, never silently overwrite an unchanged DSP order.
   $('gwComplexity').value='advanced';
   $('gwSOrder').value=String(s);$('gwTOrder').value=String(t);
    $('gwThermalFit').value=selected.fitMode||$('calFitMode').value||'full';
   setTemperatureInputs(selected.temp, matrix?.temperatures);
  }
  signature=null;renderPlan();
  msg('Config übernommen. Prüfe die Messmatrix und Temperatur-Sollwerte, bevor du Referenzmessungen aufnimmst.','success');
 }
 function pointRecord(point){
  const values=state().points||[];
  return values.find(p=>point.slot==='lo'?p.kind==='lo':point.slot==='hi'?p.kind==='hi':p.kind==='extra'&&p.slot===(point.extraSlot??point.index));
 }
 function pointRow(point){
  if(point.slot==='lo')return $('gwPointHost').querySelector('.cal-point-row:not([data-cal-extra])');
  if(point.slot==='hi')return [...$('gwPointHost').querySelectorAll('.cal-point-row:not([data-cal-extra])')].at(-1);
  return $('calExtra'+(point.extraSlot??point.index)+'Row');
 }
 function renderOutputOptions(){
  if(!mode)return;
  $('gwAdvancedOutput').hidden=!$('expertMode').checked;
  const analog=['keep','1','2','3'].includes($('expertOutputMode').value);
  $('gwOutputVoltage').hidden=!analog;
 }
 function captureNumber(value){
  return Number.isFinite(value)?Number(value).toLocaleString('de-CH',{maximumFractionDigits:1}):'—';
 }
 function setCaptureLabel(node,text){
  if(!node)return;
  if(!originalCaptureLabels.has(node))originalCaptureLabels.set(node,node.textContent);
  node.textContent=text;
 }
 function captureRole(point){
  if(point.slot==='lo')return 'Unterer Druckpunkt';
  if(point.slot==='hi')return 'Oberer Druckpunkt';
  return point.temperatureIndex>0&&point.pressureIndex===0?'TK0-Temperaturpunkt':'Zusätzlicher Kalibrierpunkt';
 }
 function captureTime(record){
  const at=new Date(record.at);
  return Number.isNaN(at.getTime())?'Zeit unbekannt':at.toLocaleTimeString('de-CH',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
 }
 function renderCapture(){
  if(!plan)return;
  const points=plan.points.map((point,index)=>({point,index,record:pointRecord(point)}));
  const key=JSON.stringify({
   plan:signature,selectedPoint,
   captured:points.map(({record})=>record?[record.at,record.adc_s,record.adc_t,record.spread,record.sampleCount]:null),
   latest:latestCapture
  });
  // The live refresh loop runs frequently; do not rebuild cards on every poll.
  const nav=$('gwPointNav');
  if(lastCaptureRenderKey===key&&nav.children.length===points.length)return;
  nav.replaceChildren();
  for(const {point,index,record} of points){
   const btn=document.createElement('button');
   btn.type='button';
   btn.className=(index===selectedPoint?'gw-selected ':'')+(record?'gw-done':'gw-pending');
   btn.setAttribute('aria-current',index===selectedPoint?'step':'false');
   const label=document.createElement('span');label.className='gw-point-nav-label';
   label.textContent=(record?'✓  ':'')+(index+1)+'. '+point.pressure+' '+plan.unit+' · '+point.temperature+' °C';
   const status=document.createElement('span');status.className='gw-point-nav-state';
   status.textContent=record?'Aufgenommen · '+captureTime(record):index===selectedPoint?'Jetzt messen':'Noch offen';
   btn.append(label,status);
   if(record){
    const values=document.createElement('span');values.className='gw-point-nav-data';
    values.textContent='ADC_S '+captureNumber(record.adc_s)+' · ADC_T '+captureNumber(record.adc_t);
    btn.appendChild(values);
    const delta=ELMOS_GUIDED_PLAN.captureDelta(points,index);
    if(delta){
     const diff=document.createElement('span');diff.className='gw-point-nav-delta';
     const sign=delta.digits>=0?'+':'−';
     const label=delta.kind==='pressure'?'Druckhub ΔADC_S':'Temperatur-ΔADC_S';
     diff.textContent=label+' '+sign+captureNumber(Math.abs(delta.digits))+' Digits'+
      (delta.kind==='temperature'&&Number.isFinite(delta.adcTDelta)?' · ΔADC_T '+(delta.adcTDelta>=0?'+':'−')+captureNumber(Math.abs(delta.adcTDelta)):'');
     btn.appendChild(diff);
    }
    const stats=document.createElement('span');stats.className='gw-point-nav-meta';
    stats.textContent=(Number.isFinite(record.spread)?'Streuung '+captureNumber(record.spread)+' Digits · ':'')+
     (record.sampleCount||'—')+' Samples';
    btn.appendChild(stats);
   }
   btn.addEventListener('click',()=>{selectedPoint=index;latestCapture=null;renderCapture()});
   nav.appendChild(btn);
   const row=pointRow(point);
   if(row){
    row.classList.toggle('gw-point-active',index===selectedPoint);
    setCaptureLabel(row.querySelector('.between h3'),'Messpunkt '+(index+1)+' · '+captureRole(point));
    const button=point.slot==='lo'?$('capLo'):point.slot==='hi'?$('capHi'):$('calExtra'+(point.extraSlot??point.index)+'Capture');
    setCaptureLabel(button,'Messpunkt '+(index+1)+' aufnehmen');
   }
  }
  const captured=points.filter(({record})=>!!record);
  const allDone=captured.length===plan.total;
  const success=$('gwPointConfirmation');
  const confirmed=latestCapture&&points[latestCapture.index]?.record?.at===latestCapture.at;
  // No duplicate results table: completed points are already marked on the left.
  // A single concise success line precedes the next point, then the completion state.
  success.hidden=!confirmed||allDone;
  if(!success.hidden)success.textContent='✓ Messpunkt '+(latestCapture.index+1)+' aufgenommen';
  const {point:currentPoint,record}=points[selectedPoint];
  const current=$('gwCurrentSetpoint');current.replaceChildren();
  current.classList.toggle('gw-next-complete',allDone);
  const heading=document.createElement('strong');
  heading.className='gw-next-heading';
  heading.textContent=allDone?'✓ Alle Messpunkte aufgenommen':
   record?'Messpunkt '+(selectedPoint+1)+' ist bereits aufgenommen':
   'Als Nächstes: Messpunkt '+(selectedPoint+1)+' messen';
  const text=document.createElement('span');
  text.className='gw-next-detail';
  text.textContent=allDone?'Alle '+plan.total+' Referenzen wurden gespeichert. Weiter zur Koeffizientenberechnung.':
   record?'Wähle einen noch offenen Punkt, um die Messreihe fortzusetzen.':
   'Stelle '+currentPoint.pressure+' '+plan.unit+' und '+currentPoint.temperature+
    ' °C ein, warte auf stabile Bedingungen und klicke dann auf «aufnehmen».';
  if(allDone){
   // A pressure span is meaningful only when pressure differs while the
   // recorded temperature is the same. Temperature drift is a separate delta.
   const delta=points.map((_,index)=>ELMOS_GUIDED_PLAN.captureDelta(points,index)).find(d=>d?.kind==='pressure');
   if(delta){
    const difference=document.createElement('span');
    difference.className='gw-point-hub';
    difference.textContent='Druckhub: '+captureNumber(Math.abs(delta.digits))+' Digits ADC_S (Punkt '+(delta.fromIndex+1)+' → '+(delta.toIndex+1)+')';
    heading.append(difference);
   }
  }
  current.append(heading,text);
  setText('gwFooterHint',captured.length+' / '+plan.total+' Messpunkte erfolgreich aufgenommen');
  lastCaptureRenderKey=key;
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
   // Acknowledge only measurements confirmed by the existing capture workflow.
   latestCapture={index:target.index,at:record.at};
   const nextIndex=plan.points.findIndex((p,i)=>i>target.index&&!pointRecord(p));
   if(nextIndex>=0&&selectedPoint===target.index)selectedPoint=nextIndex;
   // A single update confirms the new sample and highlights the next action.
   renderCapture();
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
  }else if(stats.count>=2&&stats.hub<4000){
   quality.classList.add('is-warning');
   quality.textContent='Signalhub zu klein: '+measurementNumber(stats.hub)+' von mindestens 4’000 Digits. Minimalen und maximalen Druck anlegen. Bleibt der Hub zu klein, PGA-Verstärkung erhöhen und erneut prüfen.';
  }else if(stats.count<2){
   quality.textContent='Warte auf weitere Messwerte für die Hubprüfung.';
  }else{
   quality.classList.add('is-good');
   quality.textContent='Im beobachteten Zeitraum innerhalb ±25’000 Digits. Hub '+measurementNumber(stats.hub)+' Digits bei '+stats.count+' Messwerten. Gesamten Druckbereich prüfen.';
  }
 }
 function updateFinishTelemetry(){
  const api=window.ELMOS_GUIDED_API,t=api?.telemetry?.(),s=state();
  if(!t)return;
  const scaled=Number.isFinite(t.sensorValue);
  setText('gwFinishSignalValue',measurementNumber(scaled?t.sensorValue:t.dspRaw,scaled?2:0));
  setText('gwFinishSignalUnit',scaled?t.unit:t.dspRaw!==null?'Digits':'—');
  setText('gwFinishDsp',measurementNumber(t.dspRaw));
  setText('gwFinishAdc',measurementNumber(t.adcS));
  setText('gwFinishTemp',measurementNumber(t.adcT));
  setText('gwFinishTime',t.dspTime?new Date(t.dspTime).toLocaleTimeString('de-CH',{hour12:false}):'—');
  const badge=$('gwFinishStatus');
  badge.textContent=!t.online?'Nicht verbunden':t.dspRaw===null?'Warte auf DSP':t.live?'Live':'Letzter Messwert';
  badge.className='gw-live-badge'+(t.dspRaw!==null?' is-live':'');
  const source=$('gwFinishSource');
  source.textContent=t.dspRaw===null?'Kein aktueller DSP_S-Wert verfügbar. Bitte Verbindung und Live-Messung prüfen.':
   !scaled?'DSP_S direkt aus Register 0x30. Es fehlt ein bestätigtes Abgleichprofil.':
   t.range?.kind==='standard'?'DSP_S in % mit rekonstruiertem DSP-Endwert (10–90 % VDD angenommen).':'DSP_S in % mit bestätigtem DSP-Endwert.';
  const {min,max}=t.range||{};
  const progress=scaled&&max>min?100*(t.sensorValue-min)/(max-min):0;
  $('gwFinishBar').style.width=Math.max(0,Math.min(100,progress)).toFixed(2)+'%';
  setText('gwFinishRangeMin',scaled?measurementNumber(min,2)+' '+t.unit:'—');
  setText('gwFinishRangeMax',scaled?measurementNumber(max,2)+' '+t.unit:'—');
  const v=t.voltageTargets;
  setText('gwFinishConfig',v?
   'Ausgangs-Sollwerte: S0 '+measurementNumber(v.s0,3)+' V · S1 '+measurementNumber(v.s1,3)+' V · VDD '+measurementNumber(v.vdd,2)+' V. Diese Spannungen wurden nicht am Pin gemessen.':
   'Ausgangs-Sollwerte nicht verfügbar.');
  const completion=$('gwFinishCompletion');
  completion.className='gw-alert '+(s.nvmDone?'success':'warn');
  completion.textContent=s.nvmDone?'NVM-Schreibvorgang bestätigt. Kaltstart und Ausgangsmessung stehen noch aus.':
   'NVM-Schreibbestätigung fehlt. Keine Hardwarefreigabe.';
 }

 function updateConnectionChoices(){
  const adapter=$('gwConnectionAdapter').value,iface=$('gwConnectionInterface');
  const spi=iface.querySelector('option[value="spi"]');
  spi.disabled=adapter==='bridge'||!$('expertMode').checked;
  if(spi.disabled&&iface.value==='spi')iface.value='plc';
 }
 function openConnectionPanel(){
  if(!mode)return;
  const s=state();
  connectionOpen=true;
  $('gwConnectionAdapter').value=s.adapter||'ssp3';
  $('gwConnectionInterface').value=s.iface||'plc';
  updateConnectionChoices();
  $('gwConnectionMagicConfirm').checked=false;
  msg('');
  render();
 }
 function closeConnectionPanel(){
  // Leaving the panel only changes navigation. It never interrupts a sensor operation.
  // Hardware actions stay guarded by the existing chip/USB state machine.
  connectionOpen=false;
  render();
 }
 function renderConnectionStatus(){
  if(!connectionOpen)return;
  const expert=$('expertMode').checked;
  for(const id of ['gwConnectionAdvanced','gwConnectionDiagnose','gwConnectionStartup'])$(id).hidden=!expert;
  if(!expert){
   $('gwConnectionAdvanced').open=false;
   $('gwConnectionMagicConfirm').checked=false;
  }
  const s=state(),working=connectionBusy||s.connectionBusy;
  const connected=!!s.chip,usb=!!s.usbConnected;
  const current=s.iface==='plc'?'1-Wire':s.iface==='i2c'?'I²C':s.iface==='spi'?'SPI':'unbekannt';
  const status=$('gwConnectionStatus');
  status.className='gw-alert '+(connected?'success':usb?'warn':'');
  status.textContent=(connected?'Sensor erkannt, UID '+(s.uid||'nicht bekannt')+'. ':usb?'USB-Adapter verbunden, Sensor nicht erkannt. ':'Noch kein USB-Adapter verbunden. ')+
   'Aktives Protokoll: '+current+'.'+(s.connectionMessage?' '+s.connectionMessage:'');
  for(const id of ['gwConnectionApply','gwConnectionChoose','gwConnectionReinit','gwConnectionDiagnose','gwConnectionStartup','gwConnectionLog','gwConnectionMagic'])
   $(id).disabled=working;
  $('gwConnectionReinit').disabled=working||!usb;
  $('gwConnectionDiagnose').disabled=working||!usb;
  $('gwConnectionStartup').disabled=!expert||working||!usb||connected||s.iface!=='plc'||s.adapter!=='ssp3';
  $('gwConnectionLog').disabled=working||!usb;
  $('gwConnectionMagic').disabled=!expert||working||!usb||connected||s.iface!=='plc'||s.adapter!=='ssp3'||!$('gwConnectionMagicConfirm').checked;
 }
 async function connectGuidedSensor(selectPort){
  if(connectionBusy)return;
  const api=window.ELMOS_GUIDED_API,s=state();
  if(!api?.connectGuided) return msg('Verbindungssteuerung nicht verfügbar. Bitte die App neu laden.','error');
  if((s.chip||s.activeArchive)&&!window.confirm('Der bisherige Sensorabgleich wird abgeschlossen oder als unvollständig archiviert. Alte Messpunkte und Schreibfreigaben werden verworfen. Sensor neu verbinden?'))return;
  connectionBusy=true;renderConnectionStatus();
  msg('Sensor und Adapter werden mit den gewählten Einstellungen geprüft …','warn');
  try{
   const result=await api.connectGuided({
    adapter:$('gwConnectionAdapter').value,iface:$('gwConnectionInterface').value,
    choosePort:!!selectPort
   });
   $('gwConnectionDiagnosticResult').hidden=true;
   msg('Sensor '+result.uid+' über '+(result.iface==='plc'?'1-Wire':result.iface==='i2c'?'I²C':'SPI')+' erkannt. Du kannst einen neuen Abgleich starten.','success');
  }catch(error){msg('Verbindung fehlgeschlagen: '+String(error.message||error),'error')}
  finally{connectionBusy=false;renderConnectionStatus()}
 }
 async function guidedConnectionDiagnostic(action){
  if(connectionBusy)return;
  if(action!=='export'&&!$('expertMode').checked)
   return msg('Diese Diagnose ist nur mit aktivierten Expertenparametern verfügbar.','warn');
  const api=window.ELMOS_GUIDED_API;
  if(!api?.guidedDiagnostic)return msg('Diagnosefunktion nicht verfügbar. Bitte die App neu laden.','error');
  connectionBusy=true;renderConnectionStatus();
  const report=$('gwConnectionDiagnosticResult');
  if(action!=='export'){report.hidden=false;report.textContent='Lesende Diagnose läuft …'}
  try{
   const result=await api.guidedDiagnostic(action,{magicConfirmed:action==='magic'&&$('gwConnectionMagicConfirm').checked});
   if(action==='export')msg('USB-Protokoll wurde als JSON zum Herunterladen bereitgestellt.','success');
   else{
    if(action==='magic')$('gwConnectionMagicConfirm').checked=false;
    report.hidden=false;report.textContent=String(result||'Diagnose beendet. Kein gültiger Sensor erkannt.');
    msg(action==='startup'?'1-Wire-Lesetest abgeschlossen.':'Registerdiagnose abgeschlossen.','success');
   }
  }catch(error){
   report.hidden=false;report.textContent=String(error.message||error);
   msg('Diagnose fehlgeschlagen: '+String(error.message||error),'error');
  }finally{connectionBusy=false;renderConnectionStatus()}
 }
 function updateUI(){
  if(!mode)return;
  const s=state();
  if(connectionOpen){renderConnectionStatus();return}
  if(nextSensorPending){void refreshSwapPort();return}
  $('gwChipStatus').textContent=statusText();
  $('gwChipStatus').classList.toggle('is-offline',!s.chip);
  const completed=s.points?.length||0;
  if(stage===4&&plan){renderCapture();if(completed===plan.total)$('gwNext').disabled=false}
  if(stage===5||stage===6||stage===7||stage===9){
   // Reflect the same guarded source-of-truth as the classic buttons.
   const text=stage===5?s.calStaged?'Koeffizienten im RAM bestätigt':'Noch keine bestätigte RAM-Übernahme':stage===6?s.calVerified?'DSP-Prüfung abgeschlossen':'DSP-Prüfung ausstehend':stage===7?s.outputScalingRequired?'Ausgangsskalierung für den aktuellen DSP-Bereich bestätigen':'Ausgangskonfiguration bereit zur Prüfung':s.nvmDone?'NVM-Schreiben bestätigt':'NVM-Schreiben noch nicht bestätigt';
   setText('gwFooterHint',text);
  }
  const ready=stage===4?!!plan&&plan.points.every(p=>pointRecord(p)):stage===5?!!s.calStaged:stage===6?!!s.calVerified:stage===9?!!s.nvmDone:true;
  $('gwNext').disabled=!s.chip||(stage===10?nextSensorBusy||!s.nvmDone:!ready);
  if(stage===3)updateAfeTelemetry();
  if(stage===10)updateFinishTelemetry();
  if(stage===3||stage===10)apiRedraw();
 }
 function apiRedraw(){
  window.ELMOS_GUIDED_API?.redraw?.();
 }
 function render(){
  if(!mode)return;
  const swapping=!!nextSensorPending;
  // The guided task chooser is the only home screen. Classic panels use
  // their permanent sidebar instead of showing a second home button.
  document.documentElement.classList.toggle('guided-task-open',stage!==0||connectionOpen||swapping);
  const loggerPage=stage===11&&!swapping;
  $('gwConnectionPage').hidden=!connectionOpen;
  $('gwSwapPage').hidden=!swapping||connectionOpen;
  $('gwConnectionToggle').setAttribute('aria-expanded',String(connectionOpen));
  $('gwConnectionToggle').textContent=connectionOpen?'← Zurück zum Assistenten':'Verbindung & Diagnose';
  $('gwPresetLaunch').hidden=connectionOpen||swapping||stage!==1;
  if($('gwPresetLaunch').hidden&&$('gwPresetDialog').open)$('gwPresetDialog').close();
  root.querySelector('.gw-footer').hidden=swapping||connectionOpen;
  root.classList.toggle('gw-logger-mode',loggerPage&&!connectionOpen);
  $('gwLogPage').hidden=connectionOpen||!loggerPage;
  for(let i=0;i<steps.length;i++){
   $('gwPage'+i).hidden=connectionOpen||swapping||i!==stage;
   const side=document.querySelector('[data-gw-side="'+i+'"]');
   side.disabled=swapping||connectionOpen;
   side.classList.toggle('is-active',i===stage);
   side.classList.toggle('is-done',visited.has(i)&&i!==stage);
   side.setAttribute('aria-current',i===stage?'step':'false');
  }
  $('gwKicker').textContent=connectionOpen?'Verbindung / Diagnose':loggerPage?'Sensor-Testprotokoll':'Schritt '+(stage+1)+' von '+steps.length;
  $('gwTitle').textContent=connectionOpen?'Sensor verbinden und Protokoll prüfen':swapping?'Nächsten Sensor anschliessen':loggerPage?'Test / Logging':steps[stage][1];
  $('gwDesc').textContent=connectionOpen?'USB-Adapter, Chip-Schnittstelle und Diagnose direkt im geführten Modus bedienen.':swapping?'Wechsle den Sensor, um den Serienabgleich fortzusetzen.':loggerPage?
   'Sensorwerte in frei wählbaren Intervallen aufzeichnen, mitteln und mit Notizen archivieren.':
   steps[stage][2];
  $('gwProgress').style.width=(loggerPage?100:(stage+1)/steps.length*100).toFixed(1)+'%';
  $('gwPrevious').disabled=stage===0;
  $('gwTasks').hidden=stage!==10;
  $('gwNext').hidden=loggerPage||stage===0||(stage===10&&state().demo); // A card click now enters the chosen task immediately.
  $('gwNext').textContent=stage===8?'Weiter zum NVM':stage===9?'Abschluss prüfen':stage===10?'Nächsten Sensor abgleichen':'Weiter';
  if(connectionOpen){renderConnectionStatus();return;}
  if(swapping){
   $('gwChipStatus').textContent='Sensorwechsel';
   $('gwChipStatus').classList.add('is-offline');
   msg('');
   void refreshSwapPort();
   return;
  }
  if(stage===0)document.querySelectorAll('[data-gw-task]').forEach(x=>{
   x.setAttribute('aria-pressed',String(x.dataset.gwTask===task));
  });
  if(stage===1)renderPlan();
  if(stage===2)renderPlan()
  if(stage===3){$('gwAfeChartHost').appendChild($('chart'));startAfeWindow()}
  if(stage===10){$('gwFinishChartHost').appendChild($('chart'))}
  if(stage===4)renderCapture();
  if(stage===7)renderOutputOptions();
  if(stage===8){
   const imported=window.ELMOS_GUIDED_API?.alarmProfile?.();
   $('gwUseAlarms').checked=task==='alarms'||imported?.mode==='edit'||!!window.ELMOS_GUIDED_API?.alarmPending?.();
   $('gwAlarmConfigArea').hidden=!$('gwUseAlarms').checked;
  }
  msg('');
  updateUI();
 }
 function goto(n){
  if(stage===11&&window.ELMOS_TEST_LOGGER?.isBusy()){
   msg('Bitte zuerst die laufende Testaufzeichnung beenden.','warn');return;
  }
  stage=Math.max(0,Math.min(11,n));visited.add(stage);render();
  root.scrollIntoView({behavior:'smooth',block:'start'});
 }
 async function next(seriesSettings=null){
  if(stage===0&&(task==='archive'||task==='verification')){
   if(window.ELMOS_TEST_LOGGER?.isBusy()){
    msg('Bitte zuerst eine laufende Testaufzeichnung beenden.','warn');return;
   }
   if(!window.ELMOS_ARCHIVE){
    msg('Archiv und Nachmessung konnten nicht geladen werden. Bitte die Webseite neu laden.','error');return;
   }
   // Browsing stored records does not require a connected sensor.
   // Keep the guided start view mounted so the archive's back button returns here.
   window.ELMOS_ARCHIVE.open(task==='verification'?'verification':'archive');
   return;
  }
  if(stage===0&&task==='nvm'){close({preservePreference:true});if(mode)return;window.ELMOS_GUIDED_API?.navigate?.(10);return}
  const s=state();
  if(!s.chip){msg('Zuerst den E703.11 über USB verbinden. Eine reine USB-CDC-Verbindung ohne Chipzugriff genügt nicht.','warn');return}
  if(stage===0){
   if(task==='inspect'){close({preservePreference:true});if(mode)return;window.ELMOS_GUIDED_API?.navigate?.(7);return}
   if(task==='testlog'){goto(11);return}
   if(task==='calibration'&&!seriesSettings){
    try{await window.ELMOS_GUIDED_API?.offerSeriesPreset?.()}
    catch(e){msg('Vorlage konnte nicht übernommen werden. '+e.message,'error');return}
   }
   msg('Ausgangskonfiguration wird gesichert: RAM und alle 64 NVM-Wörter lesen. Das kann einen Moment dauern.','warn');
   try{
    if(task==='output'||task==='alarms'){
     if(!window.ELMOS_ARCHIVE?.active)await window.ELMOS_ARCHIVE?.begin('output');
     else if(window.ELMOS_ARCHIVE.current?.type!=='output')throw Error('Ein anderes Prüfprotokoll läuft. Bitte zuerst abschliessen.');
    }else await window.ELMOS_ARCHIVE?.ensureCalibration();
   }catch(e){msg('Archivierung vor dem Abgleich erforderlich: '+e.message,'error');return}
   if(seriesSettings){
    const current=state();
    if(!current.chip||current.uid!==s.uid)throw Error('Sensorverbindung hat sich geändert.');
    await window.ELMOS_GUIDED_API.applySeriesSettings(seriesSettings);
   }
   msg('');
   if(task==='alarms'){goto(8);return}
   if(task==='output'){goto(7);return}
   goto(1);return;
  }
  if(stage===1){try{makePlan();goto(2)}catch(e){msg(e.message,'error')}return}
  if(stage===2){
   try{plan=applyPlan();goto(3)}catch(e){msg(e.message,'error')}
   return;
  }
  if(stage===3){
   try{if(!plan)plan=applyPlan();goto(4)}catch(e){msg(e.message,'error')}
   return;
  }
  if(stage===4){
   if(!plan||!plan.points.every(p=>pointRecord(p))){msg('Bitte zuerst alle '+(plan?.total||0)+' Messpunkte erfolgreich aufnehmen.','warn');return}
   goto(5);return;
  }
  if(stage===5){if(!s.calStaged){msg('Bitte die Koeffizienten zuerst berechnen und ins RAM übertragen.','warn');return}goto(6);return}
  if(stage===6){if(!s.calVerified){msg('Die unabhängige DSP-Prüfung muss erfolgreich abgeschlossen sein.','warn');return}goto(7);return}
  if(stage===7){
   if(task==='calibration'&&s.outputScalingRequired){
    msg('Die alte Ausgangsskalierung passt nicht zum aktuellen DSP-Zielbereich. Bitte «Scaling berechnen und aktivieren» und danach «Ausgangskonfiguration prüfen und vormerken» anklicken. Die Messpunkte und RAM-Kalibrierung bleiben erhalten.','warn');return;
   }
   goto(8);return
  }
  if(stage===8){
   if(task!=='alarms'&&!$('gwUseAlarms').checked){window.ELMOS_GUIDED_API?.skipAlarms?.();goto(9);return}
   if(!window.ELMOS_GUIDED_API?.alarmPending?.()&&!window.ELMOS_GUIDED_API?.alarmStandaloneReady?.()){
    msg('Alarmkonfiguration zuerst im RAM rücklesen oder den optionalen Schritt überspringen. Bei bereits vorgemerktem Ausgang zuerst diesen speichern und den Alarm anschliessend separat bearbeiten.','warn');return;
   }
   goto(9);return;
  }
  if(stage===9){if(!s.nvmDone){msg('Noch kein erfolgreicher NVM-Schreibvorgang bestätigt.','warn');return}goto(10);return}
 }
 async function returnToTasks(){
  if(nextSensorBusy)return;
  nextSensorBusy=true;
  const pending=nextSensorPending;
  try{
   await window.ELMOS_GUIDED_API.returnToTasks(pending?.previousUid);
   nextSensorPending=null;
   task='calibration';visited=new Set([0]);
   plan=null;signature=null;seriesPointFields=null;latestCapture=null;lastCaptureRenderKey=null;
   goto(0);
   if(pending)msg(state().chip?'Serie beendet.':'Serie beendet. Aktuell wurde kein Sensor erkannt.',state().chip?'success':'warn');
  }catch(error){
   msg('Abgleich konnte nicht abgeschlossen werden: '+error.message,'error');
  }finally{nextSensorBusy=false;updateUI()}
 }
 async function prepareNextSensor(){
  const s=state(),api=window.ELMOS_GUIDED_API;
  if(stage!==10||nextSensorBusy||!s.chip||!s.nvmDone||s.demo||!api?.prepareNextSensor)return;
  nextSensorBusy=true;updateUI();
  try{
   const matrix=task==='calibration'?plan:null;
   const fields=matrix?readPointSettings(matrix):null;
   const settings=await api.prepareNextSensor(matrix);
   nextSensorPending={previousUid:s.uid,settings,fields};
   render();
   root.scrollIntoView({behavior:'smooth',block:'start'});
   $('gwSwapConnect').focus();
  }catch(e){msg('Sensorwechsel fehlgeschlagen: '+e.message,'error')}
  finally{nextSensorBusy=false;updateUI()}
 }
 async function refreshSwapPort(){
  const pending=nextSensorPending;
  const choose=$('gwSwapChoose');
  if(!pending||!choose)return;
  let known=false;
  try{known=await window.ELMOS_GUIDED_API.hasKnownSwapPort()}catch(_){}
  if(nextSensorPending===pending)choose.hidden=known&&!pending.offerPortPicker;
 }
 async function connectNextSensor(selectPort){
  if(!nextSensorPending||nextSensorBusy)return;
  const pending=nextSensorPending,api=window.ELMOS_GUIDED_API;
  nextSensorBusy=true;
  const controls=['gwSwapConnect','gwSwapChoose','gwSwapCancel'].map($);
  controls.forEach(button=>button.disabled=true);
  msg('Sensor wird verbunden …');
  try{
   await api.connectNextSensor(selectPort);
   pending.offerPortPicker=false;
   const {uid}=state();
   if(!uid)throw Error('Die Chip-ID konnte nicht gelesen werden. Bitte erneut verbinden.');
   if(uid===pending.previousUid&&!pending.repeatConfirmed){
    if(!window.confirm('Dieser Sensor wurde bereits abgeglichen. Möchtest du ihn nochmals abgleichen?')){
     msg('Stecke den Sensor ab und schliesse den nächsten an.','warn');
     return;
    }
    pending.repeatConfirmed=true;
   }
   const record=window.ELMOS_ARCHIVE?.current;
   if(record&&record.chipUID!==uid)
    throw Error('Für einen anderen Sensor ist bereits ein Protokoll offen. Bitte zuerst die Serie abbrechen und das Protokoll abschliessen.');
   task='calibration';stage=0;visited=new Set([0]);
   await next(pending.settings);
   if(stage!==1)return;
   nextSensorPending=null;
   seriesPointFields=pending.fields;
   render();
   msg('Einstellungen übernommen. Frontend im Sensor-RAM bestätigt.','success');
  }catch(e){
   pending.offerPortPicker=!state().usbReady;
   msg(e.message,'error');
  }
  finally{
   nextSensorBusy=false;
   void refreshSwapPort();
   controls.forEach(button=>button.disabled=false);
  }
 }
 function previous(){
  if(stage===0)return;
  if(stage===11){goto(0);return}
  if((task==='output'&&stage===7)||(task==='alarms'&&stage===8)){goto(0);return}
  goto(stage-1);
 }
 function syncTopMode(){
  const button=$('guidedLaunchTop');
  if(!button)return;
  const guided=mode;
  button.textContent=guided?'▦ Klassisch':'◇ Geführt';
  button.title=guided?'Zur klassischen Ansicht wechseln':'Zur geführten Ansicht wechseln';
  button.setAttribute('aria-label',button.title);
  button.setAttribute('aria-pressed',String(guided));
  button.classList.toggle('is-guided-mode',guided);
  document.documentElement.classList.toggle('top-guided-active',guided);
 }
 function toggleTopView(){
  // The left sidebar already navigates all classic pages. View switching must
  // use the same archival confirmation as the guided task-chooser shortcut.
  if(mode){
   window.ELMOS_HOME_NAVIGATION?.requestClassic?.();
  }else{
   window.ELMOS_HOME_NAVIGATION?.requestHome?.();
  }
 }
 function open(){
  if(mode)return;
  // The guided workspace can be opened without a connected chip.
  // Measurement and write actions remain guarded by the existing chip checks.
  if(typeof ELMOS_COMPACT!=='undefined')ELMOS_COMPACT.set(false);
  if($('compactMode'))$('compactMode').checked=false;
  mode=true;connectionOpen=false;connectionBusy=false;chipResetPending=false;
  const loggingActive=!!window.ELMOS_TEST_LOGGER?.isBusy();
  stage=loggingActive?11:0;
  task=loggingActive?'testlog':'calibration';
  visited=loggingActive?new Set([0,11]):new Set([0]);
  plan=null;signature=null;seriesPointFields=null;selectedPoint=0;latestCapture=null;lastCaptureRenderKey=null;
  try{build()}catch(e){
   console.error(e);
   for(const {el,type,handler} of subscriptions)el.removeEventListener(type,handler);
   subscriptions.length=0;restore();mode=false;if(root)root.replaceChildren();
   if($('connMsg')){$('connMsg').textContent='Geführte Ansicht konnte nicht gestartet werden: '+e.message;$('connMsg').className='callout error'}
   return;
  }
  document.documentElement.classList.add('guided-active');
  root.hidden=false;render();
  syncTopMode();
  poll=window.setInterval(updateUI,750);
  saveView('guided');
  window.scrollTo({top:0,behavior:'auto'});
 }
 function close({preservePreference=false}={}){
  if(!mode||nextSensorPending)return;
  if(window.ELMOS_TEST_LOGGER?.isBusy()){
   msg('Bitte die Testaufzeichnung zuerst beenden, bevor du die Ansicht wechselst.','warn');return;
  }
  window.ELMOS_TEST_LOGGER?.unmount();
  mode=false;connectionOpen=false;
  if(poll){window.clearInterval(poll);poll=null}
  if(pendingCapture){window.clearInterval(pendingCapture);pendingCapture=null}
  for(const {el,type,handler} of subscriptions)el.removeEventListener(type,handler);
  subscriptions.length=0;
  restore();root.hidden=true;root.replaceChildren();
  document.documentElement.classList.remove('guided-active','guided-task-open');
  syncTopMode();
  if(!preservePreference)saveView('classic');
  window.ELMOS_GUIDED_API?.refresh?.();
 }
 // Only called after the central home navigation has safely stopped and archived
 // an unfinished task. Pure navigation: no sensor writes or USB changes.
 function resetForHome(){
  if(!mode)return false;
  if(pendingCapture){window.clearInterval(pendingCapture);pendingCapture=null}
  nextSensorPending=null;nextSensorBusy=false;connectionOpen=false;connectionBusy=false;
  task='calibration';stage=0;visited=new Set([0]);
  plan=null;signature=null;seriesPointFields=null;selectedPoint=0;
  latestCapture=null;lastCaptureRenderKey=null;chipResetPending=false;
  render();
  window.scrollTo({top:0,behavior:'auto'});
  return true;
 }
 function hasUnfinishedTask(){return !!(mode&&((stage>0&&stage!==10)||nextSensorPending))}
 function hasPendingOperation(){return !!(mode&&(taskOpening||nextSensorBusy||connectionBusy))}
 function onSensorReset({portDisconnected=false}={}){
  if(!mode||nextSensorPending)return;
  if(pendingCapture){window.clearInterval(pendingCapture);pendingCapture=null}
  chipResetPending=true;
  if(!portDisconnected){
   // Keep guided view at its current stage while the USB adapter is reachable.
   // All sensor measurements/NVM approvals were invalidated by app.js.
   updateUI();
   msg('Sensor nicht erreichbar. Oben «Sensor neu initialisieren» wählen. Nach der UID-Prüfung startet ein neuer Abgleich.','warn');
   return;
  }
  // Only an actual COM/USB removal opens the connection and diagnostic tab.
  plan=null;signature=null;seriesPointFields=null;selectedPoint=0;
  latestCapture=null;lastCaptureRenderKey=null;stage=0;visited=new Set([0]);
  connectionOpen=true;render();
  msg('USB-/COM-Port getrennt. Adapter erneut anschliessen oder USB-Port auswählen.','warn');
 }
 function onConnected(){
  // Reconnecting a sensor is not a navigation command. When a classic
  // EEPROM/NVM tool was opened from guided, leave that tool visible.
  // The separate "Geführte Startseite" action returns to the task chooser.
  if(!mode||!chipResetPending)return;
  chipResetPending=false;
  plan=null;signature=null;seriesPointFields=null;selectedPoint=0;
  latestCapture=null;lastCaptureRenderKey=null;stage=0;visited=new Set([0]);
  if(!connectionOpen)render();
  else renderConnectionStatus();
 }
 function init(){
  $('guidedLaunch')?.addEventListener('click',open);
  $('guidedLaunchTop')?.addEventListener('click',toggleTopView);
  const restorePreferredView=()=>{
   if(location.hash==='#nvm-rechner'){if(mode)close({preservePreference:true});else syncTopMode();return}
   // No saved choice: use the guided start screen. An explicit classic choice
   // always wins, including after a reload and reconnect.
   if(rememberedView()==='classic'){
    if(!mode)syncTopMode();
    return;
   }
   if(!mode)open();
  };
  try{
   restorePreferredView();
   // A second chance after all page scripts finish loading if a DOM dependency
   // prevented the guide from mounting at DOMContentLoaded. No automatic chip
   // command or calibration workflow is started.
   window.addEventListener('load',restorePreferredView,{once:true});
  }finally{
   document.documentElement.classList.remove('guided-restore-pending');
  }
 }
 function appliedPlanForConfig(){
  // Only report a matrix that was actually applied, never an editable draft.
  if(!plan||!signature||signature!==JSON.stringify(plan))return null;
  if(Number($('calPointCount').value)!==plan.total||
     Number($('calSOrder').value)!==plan.orderS||
     Number($('calTOrder').value)!==plan.orderT||
      $('calFitMode').value!==plan.fitMode||
     Number($('calSampleCount').value)!==plan.samples||
     Number($('pmin').value)!==plan.pmin||
     Number($('pmax').value)!==plan.pmax||
     $('calUnit').value!==plan.unit)return null;
  return {pCount:plan.pCount,tCount:plan.tCount,fitMode:plan.fitMode};
 }
 return {init,open,close,preferredView:()=>rememberedView()==='classic'?'classic':'guided',goToStart:()=>{if(mode&&!nextSensorPending)goto(0)},goToCoefficients:()=>{if(mode&&task==='calibration'&&!nextSensorPending)goto(5)},resetForHome,hasUnfinishedTask,hasPendingOperation,onConnected,onSensorReset,makePlan,planForPreset:()=>mode&&stage>=1&&stage<=2?makePlan():plan,isOpen:()=>mode,appliedPlanForConfig};
})();
if(typeof window!=='undefined')window.ELMOS_GUIDED=ELMOS_GUIDED;
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ELMOS_GUIDED.init);
 else ELMOS_GUIDED.init();
}
