'use strict';
/* Optional one-page workspace. Moves ORIGINAL controls; never duplicates calibration
   handlers or bypasses NVM/UID/CRC gates. Normal UI is restored exactly on exit. */
const ELMOS_COMPACT=(()=>{
 const STORAGE_KEY='elmos-compact-mode-v1';
 const storage=()=>new URLSearchParams(location.search).get('demo')==='1'?sessionStorage:localStorage;
 const $=id=>document.getElementById(id);
 let active=false;
 let original=[];
 const activeListeners=[];
 let pointSelection='lo';
 let lastPointCount=null,lastOutputMode=null,compactTimer=null;
 function makeCard(title,id,content){
  return '<section class="cp-card cp-'+id+'"><div class="cp-card-heading"><strong>'+title+'</strong></div>'+content+'</section>';
 }
 const layout=()=>[
  '<div class="cp-heading"><strong>Kompakt-Abgleich <small>· Alle Hauptschritte auf einer Seite</small></strong><div class="cp-heading-right"><span>Originale Chipfunktionen · Sicherheitsprüfungen unverändert</span><button id="cpExit" type="button">Normalansicht</button></div></div>',
  '<div class="cp-board">',
  makeCard('1 · USB & Chip','connection','<div class="cp-fields cp-cols-2" id="cpUsbFields"></div><div class="cp-actions" id="cpUsbActions"></div><div class="cp-status" id="cpUsbStatus"></div><details class="cp-fold"><summary>Diagnose / Startfenster</summary><div id="cpUsbExtra" class="cp-fold-body"></div></details>'),
  makeCard('2 · AFE / RAM','afe','<div id="cpAfeSteps"></div><div class="cp-actions" id="cpAfeActions"></div><div id="cpAfeGain" class="cp-caption"></div><div class="cp-status" id="cpAfeStatus"></div><div id="cpAfeTemplate"></div>'),
  makeCard('Config-Vorlagen','config','<div class="cp-fields cp-cols-2" id="cpCfgFields"></div><div id="cpCfgGroups"></div><div class="cp-actions" id="cpCfgActions"></div><div id="cpCfgEffect"></div><div class="cp-status" id="cpCfgStatus"></div>'),
  makeCard('3 · Messpunkte','points','<div class="cp-fields cp-points-setup" id="cpPointsSetup"></div><div class="cp-point-toolbar"><label>Messpunkt bearbeiten <select id="cpPointSelect" aria-label="Messpunkt auswählen"></select></label><div id="cpPointProgress"></div></div><div class="cp-point-edit" id="cpPointRows"></div><div class="cp-actions" id="cpPointsActions"></div><div class="cp-status" id="cpPointsStatus"></div>'),
  makeCard('4 · Berechnen / RAM','fit','<div class="cp-fields cp-cols-3" id="cpFitFields"></div><div class="cp-actions" id="cpFitActions"></div><div class="cp-status" id="cpFitStatus"></div><div id="cpFitDetails"></div>'),
  makeCard('5 · DSP prüfen','verify','<div class="cp-fields cp-cols-2" id="cpVerifyFields"></div><div class="cp-actions" id="cpVerifyActions"></div><div class="cp-caption" id="cpVerifyProgress"></div><div class="cp-status" id="cpVerifyStatus"></div><div id="cpVerifyDetails"></div>'),
  makeCard('6 · Ausgang konfigurieren','output','<div class="cp-output-grid"><div class="cp-fields cp-output-controls" id="cpOutputFields"></div><div class="cp-fields cp-output-analog" id="cpOutputAnalog"></div><div class="cp-fields cp-output-advanced" id="cpOutputExpert" hidden></div></div><div class="cp-actions" id="cpOutputActions"></div><div class="cp-status cp-output-status" id="cpOutputStatus"></div>'),
  makeCard('7 · NVM programmieren','nvm','<div class="cp-nvm-top" id="cpNvmTop"></div><div class="cp-actions" id="cpNvmPrepare"></div><div class="cp-fields cp-nvm-uid" id="cpNvmUid"></div><div class="cp-actions cp-nvm-program" id="cpNvmProgram"></div><div class="cp-status" id="cpNvmStatus"></div><div id="cpNvmDetails"></div><div class="cp-nvm-warning">NVM erst nach CRC-/UID-Prüfung und DSP-Verifikation dauerhaft schreiben. Testchip verwenden.</div>'),
  '</div>'
 ].join('');
 function move(node,target){
  if(typeof node==='string')node=$(node);
  if(!node||!target)throw Error('Kompaktmodus: Bedienelement oder Ziel fehlt');
  const placeholder=document.createComment('compact-original');
  node.parentNode.replaceChild(placeholder,node);
  target.appendChild(node);
  original.push({node,placeholder});
  return node;
 }
 function moveId(id,target){return move(id,$(target))}
 function label(id,target){
  const input=$(id);
  if(!input||!input.closest('label'))throw Error('Kompaktmodus: Label fehlt '+id);
  return move(input.closest('label'),$(target));
 }
 function moveSelector(selector,target){
  const node=document.querySelector(selector);
  if(!node)throw Error('Kompaktmodus: Element fehlt '+selector);
  return move(node,$(target));
 }
 function actions(ids,target){for(const id of ids)moveId(id,target)}
 function build(){
  const root=$('compactWorkspace');
  root.innerHTML=layout();
  // All controls remain the same DOM nodes, with their original handlers.
  for(const id of ['adapterType','iface'])label(id,'cpUsbFields');
  moveId('plcOptions','cpUsbFields');
  label('baud','cpUsbExtra');
  actions(['choose','auto','disconnect'],'cpUsbActions');
  moveId('connMsg','cpUsbStatus');
  actions(['readBoot','readRegs','exportDiag'],'cpUsbExtra');
  moveId('bootMsg','cpUsbExtra');
  moveSelector('.afe-step-panel','cpAfeSteps');
  actions(['readNow','live'],'cpAfeActions');
  moveId('gainInfo','cpAfeGain');
  moveId('writeMsg','cpAfeStatus');
  moveId('configAfePending','cpAfeTemplate');

  for(const id of ['configLabel','configPreset','configFile'])label(id,'cpCfgFields');
  moveId('configGroups','cpCfgGroups');moveId('configImportEffect','cpCfgEffect');
  actions(['configPresetSave','configPresetDelete','configSave','configApply'],'cpCfgActions');
  moveId('configPreview','cpCfgStatus');

  for(const id of ['calPointCount','calSampleCount','calUnit','calUnitOther','pmin','pmax'])label(id,'cpPointsSetup');
  // "customUnitLabel" is also the wrapper of calUnitOther.
  // Point labels stay inside their original measurement cards.
  moveSelector('.panel[data-panel="2"] .cal-point-row:not([data-cal-extra])','cpPointRows');
  for(let i=1;i<=8;i++)moveId('calExtra'+i+'Row','cpPointRows');
  // The high-endpoint row is the remaining row not assigned a data-cal-extra.
  moveSelector('.panel[data-panel="2"] .cal-point-row','cpPointRows');
  actions(['calPointClear','exportJSON','exportCSV'],'cpPointsActions');
  moveId('calSampleProgress','cpPointProgress');
  moveId('calMsg','cpPointsStatus');
  moveId('calPointPlanMsg','cpPointsStatus');

  for(const id of ['calSOrder','calTOrder','calDspLimit'])label(id,'cpFitFields');
  actions(['calCalculate','calApplyRam'],'cpFitActions');
  for(const id of ['calFitMsg','calRamStageMsg','calRamPrereq'])moveId(id,'cpFitStatus');
  move($('calCoeffList').closest('details'),$('cpFitDetails'));

  for(const id of ['calVerifyCount','calVerifyPressure','calVerifyTolerance','calVerifyTemperature'])label(id,'cpVerifyFields');
  actions(['calVerifyRam'],'cpVerifyActions');
  moveId('calVerifyProgress','cpVerifyProgress');
  for(const id of ['calRamMsg','calVerifyCoverage'])moveId(id,'cpVerifyStatus');
  const verified= document.createElement('details');verified.className='cp-fold';
  const labelText=document.createElement('summary');labelText.textContent='Prüfpunkte / Ergebnisdetails';
  verified.appendChild(labelText);moveId('calVerifyList', 'cpVerifyDetails');
  verified.appendChild($('calVerifyList'));$('cpVerifyDetails').appendChild(verified);

  label('expertOutputMode','cpOutputFields');
  moveId('expertPwmPeriodField','cpOutputFields');
  label('expertScaleEnable','cpOutputFields');
  label('psscVdd','cpOutputAnalog');
  label('psscS0','cpOutputAnalog').classList.add('cp-s0');
  label('psscS1','cpOutputAnalog').classList.add('cp-s1');
  for(const id of ['expertScaleGain','expertScaleOffset'])label(id,'cpOutputExpert');
  actions(['psscDefaultScaling','expertOutputPreset','expertOutputStage','expertOutputDiscard','outputNvmRead'],'cpOutputActions');
  for(const id of ['outputOneWireStatus','psscScalingPreview','expertOutputMsg','psscOneWireOnlyStatus'])moveId(id,'cpOutputStatus');

  label('nvmAutoBackup','cpNvmTop');
  actions(['nvmPrepare'],'cpNvmPrepare');
  moveId('nvmProgress','cpNvmPrepare');
  moveId('nvmUserIdField','cpNvmUid');
  actions(['nvmProgram'],'cpNvmProgram');
  for(const id of ['nvmWritePrereq','nvmMsg','nvmUidHint'])moveId(id,'cpNvmStatus');
  moveId('nvmDiffDetails','cpNvmDetails');
  const backup=document.createElement('details');backup.className='cp-fold';backup.innerHTML='<summary>Backup / Kontrolle nach Neustart</summary><div class="cp-fold-body" id="cpNvmMore"></div>';
  $('cpNvmDetails').appendChild(backup);
  actions(['nvmBackupRead','nvmBackupDownload'],'cpNvmMore');
  moveId('nvmRestartControls','cpNvmMore');

  $('cpExit').addEventListener('click',() => { $('compactMode').checked=false;set(false) });
  $('cpPointSelect').addEventListener('change',e=>{pointSelection=e.target.value;updatePoint()});
  listen($('calPointCount'),'change',()=>{pointSelection='lo';updatePoint()});
  listen($('configApply'),'click',()=>{pointSelection='lo';updatePoint();updateOutput()});
  listen($('expertOutputMode'),'change',updateOutput);
  listen($('expertMode'),'change',updateOutput);
  updatePoint();
  updateOutput();
 }
 function listen(element,event,callback){
  element.addEventListener(event,callback);
  activeListeners.push({element,event,callback});
 }
 function updatePoint(){
  if(!active)return;
  const count=Number($('calPointCount').value)||2;
  lastPointCount=count;
  const input=$('cpPointSelect'),old=pointSelection;
  input.replaceChildren();
  const add=(value,label)=>{const option=document.createElement('option');option.value=value;option.textContent=label;input.appendChild(option)};
  add('lo','1 · Unterer Endpunkt');
  for(let k=1;k<=Math.max(0,Math.min(8,count-2));k++)add('extra'+k,(k+1)+' · Zwischenpunkt');
  add('hi',count+' · Oberer Endpunkt');
  if(![...input.options].some(o=>o.value===old))pointSelection='lo';
  input.value=pointSelection;
  for(const [index,row] of [...$('cpPointRows').children].entries()){
   row.classList.toggle('cp-point-active',pointSelection==='lo'?index===0:pointSelection==='hi'?index===9:index===Number(pointSelection.slice(5)));
  }
 }
 function updateOutput(){
  if(!active)return;
  const mode=$('expertOutputMode').value;
  lastOutputMode=mode;
  const analog=['1','2','3','keep'].includes(mode);
  $('cpOutputAnalog').hidden=!analog;
  $('cpOutputExpert').hidden=!$('expertMode').checked;
  $('expertScaleEnable').closest('label').classList.toggle('cp-hide-scaling',mode==='onewire');
  $('psscDefaultScaling').classList.toggle('cp-hide-scaling',!analog);
 }
 function fitScreen(){
  if(!active)return;
  const root=$('compactWorkspace');
  const available=window.innerHeight-root.getBoundingClientRect().top-7;
  root.style.height=Math.max(390,available)+'px';
 }
 function set(on){
  if(on&&window.ELMOS_TEST_LOGGER?.isBusy()){
   const message='Eine Testaufzeichnung läuft. Bitte zuerst im Reiter «Test / Logging» beenden.';
   if($('compactMode'))$('compactMode').checked=false;
   if($('settingsMsg'))$('settingsMsg').textContent=message;
   return;
  }
  // Never relocate the same original controls from two workspaces simultaneously.
  if(on&&window.ELMOS_GUIDED?.isOpen?.())window.ELMOS_GUIDED.close();
  if(on===active)return;
  const root=$('compactWorkspace');
  if(on){
   active=true;
   try{build()}catch(e){
    console.error(e);set(false);$('compactMode').checked=false;$('settingsMsg').textContent='Kompaktmodus konnte nicht geladen werden: '+e.message;return;
   }
   document.documentElement.classList.add('compact-mode');
   root.hidden=false;
   fitScreen();
   // Chip detection and imported configs can set .value without firing 'change'.
   // Reconcile only these two inexpensive UI selectors while compact mode is active.
   compactTimer=window.setInterval(()=>{
    if(!active)return;
    if(Number($('calPointCount').value)!==lastPointCount){pointSelection='lo';updatePoint()}
    if($('expertOutputMode').value!==lastOutputMode)updateOutput();
    // Responsive header can change the available height.
    fitScreen();
   },500);
  }else{
   active=false;
   if(compactTimer!==null){window.clearInterval(compactTimer);compactTimer=null}
   for(const {element,event,callback} of activeListeners)element.removeEventListener(event,callback);
   activeListeners.length=0;
   for(const {node,placeholder} of original){
    if(placeholder.parentNode)placeholder.parentNode.replaceChild(node,placeholder);
   }
   original=[];
   root.replaceChildren();root.hidden=true;root.style.height='';
   document.documentElement.classList.remove('compact-mode');
  }
  try{storage().setItem(STORAGE_KEY,on?'1':'0')}catch(_){}
 }
 function init(){
  const checkbox=$('compactMode'),root=$('compactWorkspace');
  if(!checkbox||!root)return;
  checkbox.addEventListener('change',()=>set(checkbox.checked));
  window.addEventListener('resize',fitScreen);
  try{checkbox.checked=storage().getItem(STORAGE_KEY)==='1'}catch(_){}
  if(checkbox.checked)set(true);
 }
 return {init,set};
})();
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ELMOS_COMPACT.init);
 else ELMOS_COMPACT.init();
}
