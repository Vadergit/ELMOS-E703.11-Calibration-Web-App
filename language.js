/* UI language layer: DOM-only, never changes device commands, numeric values or calibration logic. */
(()=>{
 'use strict';
 const KEY='elmos-ui-language-v1';
 const translations={
  'USB & Chip':'USB & chip','Setup':'Setup','AFE':'AFE','Messpunkte':'Measurement points',
  'Ausgang':'Output','NVM programmieren':'Program NVM','EEPROM Viewer':'EEPROM viewer',
  'Test / Logging':'Test / logging','Archiv':'Archive','Nachmessung':'Verification',
  'Nachmessung öffnen':'Open verification','Geführt':'Guided','Einstellungen':'Settings',
  'Geführter Assistent · empfohlen':'Guided assistant · recommended',
  'Klassische Ansicht':'Classic view','Arbeitsansicht nach dem Verbinden':'View after connection',
  'Kompaktmodus · One-Pager':'Compact mode · single page',
  'Expertenparameter freischalten':'Enable expert parameters',
  'Hover-Erklärungen aktivieren':'Enable hover explanations',
  'Demo-Modus':'Demo mode','Sprache / Language':'Language',
  'Programmieradapter verbinden':'Connect programming adapter',
  'Programmieradapter':'Programming adapter','Verbinden':'Connect','Trennen':'Disconnect',
  'Neu initialisieren':'Reinitialise','Chip erkennen':'Detect chip',
  'Kalibrierung':'Calibration','Geführter Abgleich':'Guided calibration',
  'Geführten Abgleich starten':'Start guided calibration',
  'App-Einstellungen öffnen':'Open app settings',
  'Lokales Kalibrierarchiv durchsuchen':'Browse local calibration archive',
  'Druck- und Temperatur-Nachmessung durchführen':'Perform pressure and temperature verification',
  'Schliessen':'Close','Abbrechen':'Cancel','Zurück':'Back','Weiter':'Next',
  'Speichern':'Save','Laden':'Load','Starten':'Start','Stoppen':'Stop',
  'Aktualisieren':'Refresh','Übernehmen':'Apply','Öffnen':'Open',
  'Messung starten':'Start measurement','Messpunkt':'Measurement point',
  'Temperatur':'Temperature','Druck':'Pressure','Messwerte':'Measurements',
  'Mittelwert':'Average','Anzahl Messungen':'Number of measurements',
  'Ergebnis':'Result','Ergebnisse':'Results','Status':'Status',
  'Verbindung':'Connection','Verbunden':'Connected','Nicht verbunden':'Disconnected',
  'Test und Logging':'Test and logging','Test / Logging':'Test / logging',
  'Dunkles Design':'Dark theme','Helles Design':'Light theme',
  'Hilfe':'Help','Anleitung':'Instructions','Erweitert':'Advanced',
  'Kalibrierarchiv':'Calibration archive','Neuer Abgleich':'New calibration',
  'Nächster Schritt':'Next step','Vorheriger Schritt':'Previous step',
  'Einstellungen öffnen':'Open settings','Einstellungen schliessen':'Close settings',
  'Schritt 1 · Verbindung':'Step 1 · Connection',
  'DIAGNOSE · Jederzeit erreichbar':'DIAGNOSTICS · Always available',
  'Sensorwert':'Sensor value','Live-Werte':'Live values',
  'Prüfung':'Verification','Nachprüfen':'Verify',
  'Zur Hauptansicht':'Back to main view','In der klassischen Ansicht öffnen':'Open in classic view',
  'Datei auswählen':'Choose file','Datei exportieren':'Export file',
  'Deutsch':'German','English':'English',
 };
 const originalTexts=new WeakMap(), originalAttrs=new WeakMap();
 let language='de',observer=null,queued=false;
 const translateText=(node)=>{
  if(node.nodeType!==Node.TEXT_NODE||!node.parentElement)return;
  if(node.parentElement.closest('script,style,textarea,code,pre,[data-no-translate]'))return;
  const initial=originalTexts.has(node)?originalTexts.get(node):node.nodeValue;
  if(!originalTexts.has(node))originalTexts.set(node,initial);
  const trimmed=initial.trim(), result=language==='en'&&translations[trimmed];
  const next=result?initial.replace(trimmed,result):initial;
  if(node.nodeValue!==next)node.nodeValue=next;
 };
 const translateAttrs=(el)=>{
  if(el.closest('script,style,[data-no-translate]'))return;
  for(const attr of ['title','aria-label','placeholder']){
   if(!el.hasAttribute(attr))continue;
   let old=originalAttrs.get(el);
   if(!old){old={};originalAttrs.set(el,old);}
   if(!(attr in old))old[attr]=el.getAttribute(attr);
   const next=language==='en'?(translations[old[attr]]||old[attr]):old[attr];
   if(el.getAttribute(attr)!==next)el.setAttribute(attr,next);
  }
 };
 const walk=(root)=>{
  if(root.nodeType===Node.TEXT_NODE){translateText(root);return;}
  if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_NODE)return;
  if(root.nodeType===Node.ELEMENT_NODE)translateAttrs(root);
  const it=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
  while(it.nextNode()){
   const n=it.currentNode;
   if(n.nodeType===Node.TEXT_NODE)translateText(n);else translateAttrs(n);
  }
 };
 const setLanguage=(lang)=>{
  language=lang==='en'?'en':'de';
  document.documentElement.lang=language==='en'?'en':'de-CH';
  try{localStorage.setItem(KEY,language)}catch(_){}
  if(observer)observer.disconnect();
  walk(document.body);
  const select=document.getElementById('uiLanguage');
  if(select)select.value=language;
  if(observer)observer.observe(document.body,{subtree:true,childList:true});
 };
 const init=()=>{
  const sel=document.getElementById('uiLanguage');
  if(!sel)return;
  try{language=localStorage.getItem(KEY)==='en'?'en':'de'}catch(_){}
  // Translate only new DOM nodes; repeatedly scanning the whole UI slows down live telemetry.
  const pendingNodes=new Set();
  observer=new MutationObserver((mutations)=>{
   for(const mutation of mutations){
    for(const node of mutation.addedNodes){
     if(node.nodeType===Node.ELEMENT_NODE||node.nodeType===Node.TEXT_NODE)pendingNodes.add(node);
    }
   }
   if(queued||!pendingNodes.size)return;
   queued=true;
   queueMicrotask(()=>{
    queued=false;
    observer.disconnect();
    for(const node of pendingNodes){if(node.isConnected)walk(node);}
    pendingNodes.clear();
    observer.observe(document.body,{subtree:true,childList:true});
   });
  });
  sel.addEventListener('change',()=>setLanguage(sel.value));
  setLanguage(language);
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();