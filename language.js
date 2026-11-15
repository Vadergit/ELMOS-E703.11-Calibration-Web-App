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
 Object.assign(translations,window.ELMOS_TRANSLATIONS_EN||{});
 const originalTexts=new WeakMap(), originalAttrs=new WeakMap();
 const phrases=Object.entries(translations).filter(([key])=>key.length>=8&&key.length<130&&/[äöüÄÖÜ]|\b(?:Kalibrier|Mess|prüf|Sensor|Temperatur|Druck|Speicher|Sicherheit|Konfigurier|Einstellung|starten|verbinden|schreiben|lesen|Aufzeichnung|weiter|zurück|Archiv|Nachmessung|Abgleich|Verbindung|Verfahren)/i.test(key))
  .sort((a,b)=>b[0].length-a[0].length);
 const escapedRegex=(value)=>Array.from(value).map(ch=>'.*+?^$[](){}|\\'.includes(ch)?'\\'+ch:ch).join('');
 const templates=Object.entries(translations).filter(([de,en])=>de.includes('$'+'{')&&en.includes('$'+'{')).map(([de,en])=>{
  const source=de.split(/\$\{[^}]*\}/g),target=en.split(/\$\{[^}]*\}/g);
  if(source.length!==target.length)return null;
  try{return {regexp:new RegExp('^'+source.map(escapedRegex).join('([\\s\\S]*?)')+'$'),target};}
  catch(_){return null;}
 }).filter(Boolean);
 const translateString=(original)=>{
  if(language!=='en'||!original)return original;
  const exact=translations[original];
  if(exact!==undefined)return exact;
  // Guided status includes a dynamic chip UID, so translate its stable prefix.
  if(original.startsWith('E703.11 verbunden ·'))return original.replace(/^E703\.11 verbunden\s*·/,'E703.11 connected ·');
  // Common numeric progress text is built at runtime, not present as a literal in source files.
  const progress=original.match(/^Schritt\s+(\d+)\s+von\s+(\d+)$/);
  if(progress)return 'Step '+progress[1]+' of '+progress[2];
  const point=original.match(/^(Messpunkt|Prüfpunkt)\s+(\d+)(.*)$/);
  if(point)return (point[1]==='Messpunkt'?'Measurement point ':'Verification point ')+point[2]+(point[3]?translateString(point[3]):'');
  // Preserve live readings in interpolated status and error templates.
  for(const entry of templates){
   const match=original.match(entry.regexp);
   if(!match)continue;
   let result=entry.target[0];
   for(let i=1;i<entry.target.length;i++)result+=translateString(match[i])+entry.target[i];
   return result;
  }
  // Compose status texts that contain live values without modifying the numerical values.
  if(!/[äöüÄÖÜ]|\b(?:Schritt|Punkt|Messung|Wert|Sensor|Verbindung|Druck|Temperatur|Abgleich|Kalibrier|Archiv|NVM|RAM|keine|nicht|Bitte|erfolgreich|fehlgeschlagen|Verifizieren|Übernehmen|Aufnahme|Bereit|Aufzeichnung|Geführt|Klassisch)/i.test(original))return original;
  let result=original;
  for(const [de,en] of phrases){
   if(de===result)return en;
   if(result.includes(de))result=result.split(de).join(en);
  }
  return result;
 };

 let language='de',observer=null,queued=false;
 const translateText=(node)=>{
  if(node.nodeType!==Node.TEXT_NODE||!node.parentElement)return;
  if(node.parentElement.closest('script,style,textarea,code,pre,[data-no-translate]'))return;
  let entry=originalTexts.get(node);
  if(!entry||(node.nodeValue!==entry.rendered&&node.nodeValue!==entry.original)){
   entry={original:node.nodeValue,rendered:node.nodeValue};
   originalTexts.set(node,entry);
  }
  const original=entry.original,trimmed=original.trim();
  const translated=translateString(trimmed);
  const next=original.replace(trimmed,translated);
  entry.rendered=next;
  if(node.nodeValue!==next)node.nodeValue=next;
 };
 const translateAttrs=(el)=>{
  if(el.closest('script,style,[data-no-translate]'))return;
  for(const attr of ['title','aria-label','placeholder','aria-description']){
   if(!el.hasAttribute(attr))continue;
   let previous=originalAttrs.get(el);
   if(!previous){previous={};originalAttrs.set(el,previous);}
   let item=previous[attr];
   if(!item||(el.getAttribute(attr)!==item.rendered&&el.getAttribute(attr)!==item.original)){
    item={original:el.getAttribute(attr),rendered:el.getAttribute(attr)};
    previous[attr]=item;
   }
   const next=translateString(item.original);
   item.rendered=next;
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
  document.title=language==='en'?'ELMOS E703.11 – Calibration Assistant':'ELMOS E703.11 – Kalibrierassistent';
  try{localStorage.setItem(KEY,language)}catch(_){}
  if(observer)observer.disconnect();
  walk(document.body);
  const select=document.getElementById('uiLanguage');
  if(select)select.value=language;
  if(observer)observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder','aria-description']});
 };
 const init=()=>{
  const sel=document.getElementById('uiLanguage');
  if(!sel)return;
  try{language=localStorage.getItem(KEY)==='en'?'en':'de'}catch(_){}
  // Translate only new DOM nodes; repeatedly scanning the whole UI slows down live telemetry.
  const pendingNodes=new Set();
  observer=new MutationObserver((mutations)=>{
   for(const mutation of mutations){
    if(mutation.type==='characterData'||mutation.type==='attributes')pendingNodes.add(mutation.target);
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
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder','aria-description']});
   });
  });
  sel.addEventListener('change',()=>setLanguage(sel.value));
  setLanguage(language);
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();