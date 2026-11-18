'use strict';
/* E703.11 alarm editor: preview -> verified RAM -> existing protected NVM workflow. */
const ELMOS_ALARM_EDITOR=(()=>{
 const A=ELMOS_ALARM_CONFIG;let api=null;
 function init({st,CAL,hasCurrentNvmBackup,applyAlarmRam,renderFlowState,show,nvmTransportSupported=()=>st.iface==='plc'}){
  const $=id=>document.getElementById(id);
  for(const bit of A.statusBits){
   const label=document.createElement('label'),input=document.createElement('input');
   input.type='checkbox';input.id='alarmStatusBit'+bit;label.append(input,document.createTextNode(' '+A.statusLabels[bit]));
   $('alarmEocOptions').appendChild(label);
  }
  A.errors.forEach((name,i)=>{
   const label=document.createElement('label'),select=document.createElement('select');
   label.textContent=name+' ';select.id='alarmErrAction'+i;
   A.actions.forEach((name,v)=>{const o=document.createElement('option');o.value=String(v);o.textContent=name;select.appendChild(o)});
   label.appendChild(select);$('alarmErrorOptions').appendChild(label);
  });
  for(let i=1;i<=15;i++){const o=document.createElement('option');o.value=String(i);o.textContent=(2**(i-1))+' Digits';
   $('alarmHysteresis').appendChild(o)}
  let key='',dirty=false,loading=false,profilePending=null,exportMode='skip';
  const calibrationActive=()=>!!(st.calStaged&&st.calVerified&&!st.nvmDone);
  function skipForCalibration(){
   // A skip is not an instruction to clear any existing sensor alarms.
   if(st.alarmOnlyPlan?.duringCalibration)clearPlan();
   exportMode='skip';profilePending={mode:'skip'};st.alarmCalibrationSkipped=true;
   status('Ohne Alarmänderung fortfahren. Bereits gespeicherte Alarmwerte werden nicht heimlich verändert.','success');
   renderFlowState();
  }
  function profileFromUi(){
   if(exportMode!=='edit')return {mode:'skip'};
   const s=selection();
   return {mode:'edit',settings:{
    limit:Number(s.limit),lowerPct:Number(s.lowerPct),upperPct:Number(s.upperPct),
    hysteresis:Number(s.hysteresis),alarmEnabled:s.alarmEnabled,
    errorEnabled:s.errorEnabled,selectedStatusBits:s.selectedStatusBits.slice(),
    errorActions:s.errorActions.map(Number),
    errorLowPct:Number(s.errorLowPct),errorHighPct:Number(s.errorHighPct)}};

  }
  function applyProfile(profile){
   if(!profile||profile.mode==='skip'){
    profilePending={mode:'skip'};skipForCalibration();return;
   }
   if(profile.mode!=='edit'||!profile.settings)throw Error('Alarmprofil ist ungültig');
   profilePending=structuredClone(profile);exportMode='edit';
   const cur=A.checkDependencies(st.nvmBackup||Array(64).fill(0),profile.settings);
   if(!cur.ok&&st.nvmBackupVerified)throw Error(cur.errors.join(' '));
   fill(profile.settings);
   if(st.alarmOnlyPlan)clearPlan();
   st.alarmCalibrationSkipped=false;
   status('Alarme aus Config übernommen. Noch keine Register geschrieben. Bitte mit Sensor/EEPROM prüfen und im RAM bestätigen.','warn');
   renderFlowState();
  }
  function updateRules(){
   const valid=proven(),busy=st.writing||st.calTask||st.nvmWorking;
   const check=valid?A.checkDependencies(st.nvmBackup,selection()):
    {ok:false,errors:['Unterstützten Programmieradapter verbinden und EEPROM des aktuellen Chips auslesen.'],warnings:[],facts:[]};
   const list=$('alarmRuleList');
   list.replaceChildren();
   const append=(label,message,kind)=>{
    const el=document.createElement('div');
    el.className='callout '+kind;el.style.margin='6px 0';
    const strong=document.createElement('b');strong.textContent=label;
    el.append(strong,document.createTextNode(' '+message));
    list.appendChild(el);
   };
   check.errors.forEach(t=>append('Nicht zulässig:',t,'warn'));
   check.warnings.forEach(t=>append('Hinweis:',t,''));
   check.facts.forEach(t=>append('Aktueller Sensor:',t,''));
   const confirmed=$('alarmDspConfirm').checked;
   $('alarmRuleSummary').textContent=!valid?'Zuerst den aktuellen Sensor und sein EEPROM verifizieren.':
    !check.ok?check.errors.length+' Konflikt(e): Die Änderungen sind gesperrt.':
    !confirmed?'Einstellungen grundsätzlich zulässig. Bitte DSP-Endbereich ausdrücklich bestätigen.':
    check.warnings.length?'Zulässig, mit '+check.warnings.length+' Hinweis(en). Vor RAM-Schreiben überprüfen.':
    'Keine unzulässigen Kombinationen erkannt. RAM-Prüfung kann vorbereitet werden.';
   $('alarmRuleSummary').className='callout '+(!check.ok?'warn':confirmed?'success':'');
   $('alarmEditorPreview').disabled=!valid||busy||!check.ok||!confirmed;
   $('alarmEditorRam').disabled=!valid||busy||!check.ok||!confirmed||!st.alarmOnlyPlan;
   if($('alarmGoNvm'))$('alarmGoNvm').disabled=!(ready()||pendingForCalibration());
   return check;
  }
  const status=(s,type='warn')=>show('alarmEditorMessage',s,type);
  function clearPlan(){
   if(st.alarmOnlyPlan&&(st.calImage===st.alarmOnlyPlan||st.calImage?.alarmIntegrated))st.calImage=null;
   st.alarmOnlyPlan=null;$('alarmEditorRam').disabled=true;
   $('alarmEditorDiff').textContent='Kein gültiger Alarmänderungsplan.';
   if($('nvmDiff')&&$('nvmDiff').dataset.scope==='alarm'){
    $('nvmDiff').textContent='Kein vorgemerkter Alarmänderungsplan.';delete $('nvmDiff').dataset.scope;
   }
  }
  const proven=()=>!!(hasCurrentNvmBackup()&&st.mode==='usb'&&nvmTransportSupported()&&
   (st.adapterKind==='ssp3'||(st.adapterKind==='bridge'&&st.bridgeGenericRam&&st.bridgeUserNvm)));
  function fill(config){
   loading=true;
   for(const [id,value] of [['alarmDspLimit',config.limit],['alarmLowerPct',config.lowerPct],
    ['alarmUpperPct',config.upperPct],['alarmHysteresis',config.hysteresis],
    ['alarmErrorLowPct',config.errorLowPct],['alarmErrorHighPct',config.errorHighPct]])
    $(id).value=String(Number(value.toFixed?.(5)??value));
   $('alarmEnable').checked=config.alarmEnabled;$('alarmErrorEnable').checked=config.errorEnabled;
   A.statusBits.forEach(b=>$('alarmStatusBit'+b).checked=config.selectedStatusBits.includes(b));
   A.errors.forEach((_,i)=>$('alarmErrAction'+i).value=String(config.errorActions[i]));
   $('alarmDspConfirm').checked=false;dirty=false;loading=false;
  }
  const selection=()=>({
   limit:$('alarmDspLimit').value,lowerPct:$('alarmLowerPct').value,
   upperPct:$('alarmUpperPct').value,hysteresis:$('alarmHysteresis').value,
   alarmEnabled:$('alarmEnable').checked,errorEnabled:$('alarmErrorEnable').checked,
   selectedStatusBits:A.statusBits.filter(b=>$('alarmStatusBit'+b).checked),
   errorActions:A.errors.map((_,i)=>$('alarmErrAction'+i).value),
   errorLowPct:$('alarmErrorLowPct').value,errorHighPct:$('alarmErrorHighPct').value
  });
  function refresh(){
   const valid=proven(),identity=valid?st.uid.hex+'|'+st.sessionIndex+'|'+st.nvmBackup[63]:'';
   const postScaling=valid&&!!(st.nvmBackup[16]&(1<<14));
   const busy=st.writing||st.calTask||st.nvmWorking;
   $('alarmEditorFields').disabled=!valid||postScaling||busy;
   if(identity!==key){
    key=identity;clearPlan();
    if(!profilePending)exportMode='skip'; // New sensor: no automatic alarm activation
    if(valid){
     if(profilePending?.mode==='edit'){
      fill(profilePending.settings);
      status('Alarmprofil geladen. Mit der aktuellen Chipkonfiguration und DSP-Spanne überprüfen.');
     }else if(profilePending?.mode==='skip'){
      // Do not use old EEPROM alarm flags as an implicit instruction to enable alarms.
      fill(A.read(st.nvmBackup,(st.calfit?.outputLimit ?? Number($('dspDisplayLimit').value)) || 32000));
      status('Keine Alarmänderungen aus dem Profil gewünscht. Chip-Alarme bleiben unverändert.','warn');
     }else{
      const limit=(st.calfit?.outputLimit ?? Number($('dspDisplayLimit').value)) || 32000;
      fill(A.read(st.nvmBackup,Math.max(1000,Math.min(32000,limit))));
      status('Alarmwerte aus dem aktuellen EEPROM gelesen. DSP-Skala prüfen und bestätigen.');
     }
    }
   }
   updateRules();
   $('alarmEditorStatus').textContent=!valid?
    'Sensor über einen unterstützten Programmieradapter verbinden und das EEPROM auslesen.':
    postScaling?'DSP-Post-Scaling ist aktiv und belegt die Alarmregister. Alarmänderung gesperrt.':
    'Startfenster und physische Pinbelegung bleiben unverändert. Zuerst RAM prüfen; NVM ausschliesslich nach expliziter Bestätigung.';
  }
  function pendingForCalibration(){
   const p=st.alarmOnlyPlan;
   return !!(p?.duringCalibration&&p.ramVerified&&p.session===st.sessionIndex&&
    p.uid===st.uid?.hex&&p.before.every((v,i)=>v===st.nvmBackup?.[i])&&
    proven()&&!dirty);
  }
  function ready(){
   const p=st.alarmOnlyPlan;
   return !!(p?.ramVerified&&p.session===st.sessionIndex&&p.uid===st.uid?.hex&&
    !p.duringCalibration&&st.calImage===p&&p.before.every((v,i)=>v===st.nvmBackup?.[i])&&proven()&&!dirty);
  }
  function preview(){
   try{
    if(!proven())throw Error('Zuerst das aktuelle EEPROM mit SSP3 oder einer unterstützten generischen USB-Bridge lesen.');
    if(st.writing||st.calTask||st.nvmWorking)throw Error('Ein anderer Vorgang läuft.');
    if(st.calStaged&&!st.nvmDone&&!calibrationActive())
     throw Error('Laufenden DSP-Abgleich zuerst erfolgreich über DSP_S prüfen.');
    if(st.calImage&&!st.alarmOnlyPlan)
     throw Error('Anderer NVM-Plan vorhanden. Erst abschliessen.');
    if(!$('alarmDspConfirm').checked)throw Error('DSP-Endbereich ausdrücklich bestätigen.');
    const rules=A.checkDependencies(st.nvmBackup,selection());
    if(!rules.ok)throw Error(rules.errors.join(' '));
    const img=A.prepare(st.nvmBackup,selection(),CAL.crc16);
    CAL.protectStartupCommunication(img.before,img.after,{allowAlarmMask:true});
    if(!img.changes.length)throw Error('Keine Änderungen notwendig.');
    const duringCalibration=calibrationActive();
    const p={...img,uid:st.uid.hex,session:st.sessionIndex,
     alarmOnly:true,duringCalibration,ramVerified:false};
    st.alarmOnlyPlan=p;
    if(!duringCalibration){
     st.calImage=p;st.restorePlan=null;st.outputOnlyPlan=null;st.expertOutputPlan=null;
    }else st.calImage=null;
    st.alarmCalibrationSkipped=false;profilePending=null;
    const labels={16:'Alarm-/Fehlerfreigabe',18:'EOC-ODER-Maske',55:'Untere Grenze',56:'Obere Grenze/Hysterese',
     61:'Fehleraktionen',62:'Fehler-Ersatzwerte',63:'CRC16'};
    $('alarmEditorDiff').textContent=img.changes.map(c=>
     (labels[c.index]||'Register')+' (CM '+c.index+'): 0x'+c.from.toString(16).toUpperCase().padStart(4,'0')+
     ' → 0x'+c.to.toString(16).toUpperCase().padStart(4,'0')).join('\n');
    if($('nvmDiff')){$('nvmDiff').textContent=$('alarmEditorDiff').textContent;$('nvmDiff').dataset.scope='alarm';}
    status(duringCalibration?
     'Alarmänderungen für den laufenden Druckabgleich vorgemerkt. RAM prüfen; später mit DSP/AODO zusammen im NVM speichern.':
     'Änderungen für den bereits abgeglichenen Sensor vorbereitet. RAM prüfen; kein neuer Druckabgleich nötig.');
    dirty=false;refresh();renderFlowState();
   }catch(e){clearPlan();status('Keine Alarmänderung vorgemerkt: '+e.message,'error');renderFlowState()}
  }
  async function testRam(){
   const p=st.alarmOnlyPlan;
   if(!p||!proven()||!$('alarmDspConfirm').checked)return;
   try{
    status('Alarmwerte werden ins RAM geschrieben und rückgelesen …');
    await applyAlarmRam(p);
    if(st.alarmOnlyPlan!==p)throw Error('Vormerkung inzwischen ungültig.');
    p.ramVerified=true;
    status('Alarmwerte im RAM bestätigt. Im NVM-Schritt kann die dauerhafte Übernahme separat bestätigt werden.','success');
   }catch(e){p.ramVerified=false;status('RAM-Prüfung fehlgeschlagen: '+e.message,'error')}
   finally{refresh();renderFlowState()}
  }
  for(const event of ['input','change'])$('alarmEditorFields').addEventListener(event,()=>{
   if(loading)return;dirty=true;profilePending=null;exportMode='edit';
   if(st.alarmOnlyPlan){clearPlan();status('Einstellungen verändert: Vorschau und RAM-Prüfung erneut durchführen. Frühere RAM-Werte bleiben bis zum Neustart aktiv.');renderFlowState()}
   updateRules();
  });
  $('alarmReadEeprom').addEventListener('click',()=>{
   const btn=$('eepromRead');if(!btn||btn.disabled){status('Zuerst einen Sensor verbinden.','warn');return}
   btn.click();
  });
  $('alarmSkipNvm').addEventListener('click',()=>{
   skipForCalibration();const btn=document.querySelector('.stepBtn[data-step="6"]');if(btn)btn.click();
  });
  $('alarmGoNvm').addEventListener('click',()=>{
   if(!ready()&&!pendingForCalibration())return;
   const btn=document.querySelector('.stepBtn[data-step="6"]');if(btn)btn.click();
  });
  $('alarmDisableAll').addEventListener('click',()=>{
   if($('alarmEditorFields').disabled)return;
   if(st.alarmOnlyPlan)clearPlan();
   profilePending=null;exportMode='edit';dirty=true;
   $('alarmEnable').checked=false;$('alarmErrorEnable').checked=false;
   A.statusBits.forEach(bit=>$('alarmStatusBit'+bit).checked=false);
   A.errors.forEach((_,i)=>$('alarmErrAction'+i).value='0');
   $('alarmLowerPct').value='10';$('alarmUpperPct').value='90';
   $('alarmHysteresis').value='0';
   status('Alle Alarm- und Fehlerfreigaben ausgeschaltet. Die Änderung ist erst nach Vorschau, RAM-Rücklesung und NVM-Bestätigung dauerhaft.','warn');
   updateRules();renderFlowState();
  });
  $('alarmEditorPreview').addEventListener('click',preview);
  $('alarmEditorRam').addEventListener('click',testRam);
  $('alarmEditorDiscard').addEventListener('click',()=>{
   const changedRam=!!st.alarmOnlyPlan?.ramVerified;
   clearPlan();if(key&&st.nvmBackup)fill(A.read(st.nvmBackup,Number($('alarmDspLimit').value)||32000));
   status(changedRam?'NVM-Plan verworfen. RAM bleibt bis zum echten Neustart geändert.':'NVM-Plan verworfen. Sensor-EEPROM bleibt unverändert.');
   refresh();renderFlowState();
  });
  api={refresh,ready,pendingForCalibration,skipForCalibration,applyProfile,profileFromUi};refresh();return api;
 }
 return {init,refresh:()=>api?.refresh(),ready:()=>api?.ready()??false,
  pendingForCalibration:()=>api?.pendingForCalibration()??false,
  skipForCalibration:()=>api?.skipForCalibration(),
  applyProfile:profile=>api?.applyProfile(profile),
  profileFromUi:()=>api?.profileFromUi()||{mode:'skip'}};

})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_ALARM_EDITOR;
