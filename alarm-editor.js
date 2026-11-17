'use strict';
/* E703.11 alarm editor: preview -> verified RAM -> existing protected NVM workflow. */
const ELMOS_ALARM_EDITOR=(()=>{
 const A=ELMOS_ALARM_CONFIG;let api=null;
 function init({st,CAL,hasCurrentNvmBackup,applyAlarmRam,renderFlowState,show}){
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
  let key='',dirty=false,loading=false;
  const status=(s,type='warn')=>show('alarmEditorMessage',s,type);
  function clearPlan(){
   if(st.alarmOnlyPlan&&st.calImage===st.alarmOnlyPlan)st.calImage=null;
   st.alarmOnlyPlan=null;$('alarmEditorRam').disabled=true;
   $('alarmEditorDiff').textContent='Kein gültiger Alarmänderungsplan.';
   if($('nvmDiff')&&(!$('nvmDiff').dataset.scope||$('nvmDiff').dataset.scope==='alarm')){
    $('nvmDiff').textContent='Kein vorgemerkter Alarmänderungsplan.';delete $('nvmDiff').dataset.scope;
   }
  }
  const proven=()=>!!(hasCurrentNvmBackup()&&st.mode==='usb'&&st.iface==='plc'&&st.adapterKind==='ssp3');
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
    if(valid){
     const limit=(st.calfit?.outputLimit ?? Number($('dspDisplayLimit').value)) || 32000;
     fill(A.read(st.nvmBackup,Math.max(1000,Math.min(32000,limit))));
     status('Alarmwerte aus dem aktuellen EEPROM gelesen. DSP-Skala prüfen und bestätigen.');
    }
   }
   $('alarmEditorPreview').disabled=!valid||busy||postScaling;
   $('alarmEditorRam').disabled=!valid||busy||postScaling||!st.alarmOnlyPlan||!$('alarmDspConfirm').checked;
   $('alarmEditorStatus').textContent=!valid?
    'Vorbereitung: Original-SSP3 über One-Wire verbinden und vollständig geprüftes EEPROM lesen. DIY-Bridge bleibt nur lesend.':
    postScaling?'DSP-Post-Scaling ist aktiv und belegt die Alarmregister. Alarmänderung gesperrt.':
    'Startfenster und physische Pinbelegung bleiben unverändert. Zuerst RAM prüfen; NVM ausschliesslich nach expliziter Bestätigung.';
  }
  function ready(){
   const p=st.alarmOnlyPlan;
   return !!(p?.ramVerified&&p.session===st.sessionIndex&&p.uid===st.uid?.hex&&
    st.calImage===p&&p.before.every((v,i)=>v===st.nvmBackup?.[i])&&proven()&&!dirty);
  }
  function preview(){
   try{
    if(!proven())throw Error('Zuerst das aktuelle EEPROM mit Original-SSP3 lesen.');
    if(st.writing||st.calTask||st.nvmWorking)throw Error('Ein anderer Vorgang läuft.');
    if(st.calStaged&&!st.nvmDone)throw Error('Laufenden DSP-Abgleich zuerst abschliessen.');
    if(st.calImage&&!st.alarmOnlyPlan)throw Error('Anderer NVM-Plan vorhanden. Erst abschliessen.');
    if(!$('alarmDspConfirm').checked)throw Error('DSP-Endbereich ausdrücklich bestätigen.');
    const img=A.prepare(st.nvmBackup,selection(),CAL.crc16);
    CAL.protectStartupCommunication(img.before,img.after,{allowAlarmMask:true});
    if(!img.changes.length)throw Error('Keine Änderungen notwendig.');
    const p={...img,uid:st.uid.hex,session:st.sessionIndex,alarmOnly:true,ramVerified:false};
    st.alarmOnlyPlan=p;st.calImage=p;st.restorePlan=null;st.outputOnlyPlan=null;st.expertOutputPlan=null;
    const labels={16:'Alarm-/Fehlerfreigabe',18:'EOC-ODER-Maske',55:'Untere Grenze',56:'Obere Grenze/Hysterese',
     61:'Fehleraktionen',62:'Fehler-Ersatzwerte',63:'CRC16'};
    $('alarmEditorDiff').textContent=img.changes.map(c=>
     (labels[c.index]||'Register')+' (CM '+c.index+'): 0x'+c.from.toString(16).toUpperCase().padStart(4,'0')+
     ' → 0x'+c.to.toString(16).toUpperCase().padStart(4,'0')).join('\n');
    if($('nvmDiff')){$('nvmDiff').textContent=$('alarmEditorDiff').textContent;$('nvmDiff').dataset.scope='alarm';}
    status('Änderungen vorbereitet. RAM-Prüfung starten. Am EEPROM wurde nichts geändert.');
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
   if(loading)return;dirty=true;
   if(st.alarmOnlyPlan){clearPlan();status('Einstellungen verändert: Vorschau und RAM-Prüfung erneut durchführen. Frühere RAM-Werte bleiben bis zum Neustart aktiv.');renderFlowState()}
  });
  $('alarmEditorPreview').addEventListener('click',preview);
  $('alarmEditorRam').addEventListener('click',testRam);
  $('alarmEditorDiscard').addEventListener('click',()=>{
   const changedRam=!!st.alarmOnlyPlan?.ramVerified;
   clearPlan();if(key&&st.nvmBackup)fill(A.read(st.nvmBackup,Number($('alarmDspLimit').value)||32000));
   status(changedRam?'NVM-Plan verworfen. RAM bleibt bis zum echten Neustart geändert.':'NVM-Plan verworfen. Sensor-EEPROM bleibt unverändert.');
   refresh();renderFlowState();
  });
  api={refresh,ready};refresh();return api;
 }
 return {init,refresh:()=>api?.refresh(),ready:()=>api?.ready()??false};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_ALARM_EDITOR;
