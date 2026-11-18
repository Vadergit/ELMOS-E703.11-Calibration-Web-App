'use strict';
/* One clear route back to the guided task chooser. No USB disconnect, RAM/NVM
 * write or hard cancellation of an in-flight serial request is allowed here. */
const ELMOS_HOME_NAVIGATION=(()=>{
 const $=id=>document.getElementById(id);
 let navigating=false;
 const api=()=>window.ELMOS_GUIDED_API;
 const archive=()=>window.ELMOS_ARCHIVE;
 const logger=()=>window.ELMOS_TEST_LOGGER;
 const guided=()=>window.ELMOS_GUIDED;
 function situation(){
  const safety=api()?.navigationSafety?.()||{};
  const recording=!!logger()?.isBusy?.();
  const measuring=!!safety.measuring||!!archive()?.isMeasuring;
  const critical=!!safety.critical||!!archive()?.isFinishing||!!guided()?.hasPendingOperation?.();
  const unfinished=!!archive()?.active||!!guided()?.hasUnfinishedTask?.()||recording||measuring;
  return {critical,recording,measuring,unfinished,archiveType:archive()?.current?.type||null};
 }
 function displayProblem(message){
  const e=$('guidedHomeConfirmMessage');
  if(e)e.textContent=message;
  const status=$('guidedHomeConfirmStatus');
  if(status){status.textContent='';status.hidden=true}
 }
 function closeDialog(){
  const dialog=$('guidedHomeConfirm');
  if(dialog?.open)dialog.close();
 }
 function homeNow(){
  api()?.closeSettings?.();
  archive()?.close?.();
  const g=guided();
  if(!g?.open||!g?.resetForHome)throw Error('Geführte Hauptseite nicht verfügbar. Bitte Webseite aktualisieren.');
  if(!g.isOpen?.())g.open();
  if(!g.isOpen?.()||!g.resetForHome())throw Error('Geführte Hauptseite konnte nicht geöffnet werden.');
  if(location.hash==='#nvm-rechner')history.replaceState(history.state,'',location.pathname+location.search);
  document.title='ELMOS E703.11 – Kalibrierassistent';
  window.scrollTo({top:0,behavior:'auto'});
  closeDialog();
  return true;
 }
 function requestHome(){
  if(navigating)return false;
  const s=situation(),dialog=$('guidedHomeConfirm');
  if(!s.critical&&!s.unfinished)return homeNow();
  if(!dialog)return false;
  const abort=$('guidedHomeAbort'),stay=$('guidedHomeStay');
  if(stay)stay.textContent='Vorgang fertig machen';
  if(abort){
   abort.hidden=s.critical;
   abort.disabled=s.critical;
  }
  if(s.critical){
   displayProblem('Ein Sensor- oder Schreibvorgang ist noch aktiv. Dieser darf zum Schutz der NVM-/RAM-Daten und des USB-Protokolls nicht unterbrochen werden. Bitte den Vorgang fertig machen und danach zur Hauptseite wechseln.');
  }else{
   const kind=s.recording?'Testaufzeichnung':s.archiveType==='verification'?'Nachmessung':
    s.archiveType==='calibration'?'Kalibrierung':s.archiveType==='output'?'Ausgangskonfiguration':
    s.measuring?'Messung':'angefangener Vorgang';
   displayProblem('Aktive Aufgabe: '+kind+'. Möchtest du den Vorgang abbrechen und zur geführten Hauptseite zurückkehren? Bereits gespeicherte Messwerte bleiben im Archiv. Eine laufende Leseantwort wird sicher beendet; der Sensor wird nicht getrennt. Bereits geänderte RAM-Einstellungen werden nicht zurückgesetzt und es erfolgt kein neues NVM-Schreiben.'+(api()?.navigationSafety?.()?.nvmDone?' Bereits programmierte NVM-Daten im Sensor bleiben unverändert.':''));
  }
  if(!dialog.open)dialog.showModal();
  return false;
 }
 async function waitForMeasurement(){
  // Abort between read operations, never terminate a Web Serial command mid-frame.
  for(let i=0;i<1200;i++){
   const s=situation();
   if(s.critical)throw Error('Ein geschützter Chipvorgang ist gestartet. Navigation abgebrochen.');
   if(!s.measuring&&!archive()?.isMeasuring)return;
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('Die aktuelle Leseoperation ist noch nicht beendet. Bitte die Messung prüfen und erneut versuchen.');
 }
 async function abortAndGoHome(){
  if(navigating)return false;
  if(situation().critical)return requestHome();
  const abort=$('guidedHomeAbort'),stay=$('guidedHomeStay'),status=$('guidedHomeConfirmStatus');
  navigating=true;
  if(abort)abort.disabled=true;
  if(stay)stay.disabled=true;
  if(status){status.hidden=false;status.textContent='Vorgang wird sicher beendet und archiviert …'}
  try{
   if(logger()?.isBusy?.()){
    if(!logger()?.active)throw Error('Testaufzeichnung wird gerade gestartet oder gespeichert. Bitte den Vorgang zuerst abschliessen.');
    await logger().abortForHome();
   }else if(situation().measuring){
    api()?.abortActiveMeasurementForHome?.();
    await waitForMeasurement();
   }
   if(situation().critical||situation().measuring||logger()?.isBusy?.())
    throw Error('Ein Vorgang ist noch aktiv. Es wurde nichts verworfen.');
   const abortedType=archive()?.active?archive().current?.type:null;
   if(archive()?.active)await archive().finalise('aborted',{snapshot:null});
   // Also clear classic-mode calibration points: the guided view may have
   // been closed while the same sensor's archive session stayed active.
   if(guided()?.hasUnfinishedTask?.()||abortedType==='calibration'||abortedType==='output')
    api()?.clearHomeDraft?.();
   return homeNow();
  }catch(error){
   if(status){status.hidden=false;status.textContent='Rückkehr nicht möglich: '+String(error.message||error)}
   return false;
  }finally{
   api()?.clearHomeMeasurementAbort?.();
   navigating=false;
   if(abort)abort.disabled=false;
   if(stay)stay.disabled=false;
  }
 }
 function init(){
  $('guidedHomeTop')?.addEventListener('click',()=>requestHome());
  document.querySelectorAll('[data-guided-home]').forEach(button=>
   button.addEventListener('click',()=>requestHome()));
  $('guidedHomeStay')?.addEventListener('click',closeDialog);
  $('guidedHomeAbort')?.addEventListener('click',()=>{void abortAndGoHome()});
  $('guidedHomeConfirm')?.addEventListener('cancel',event=>{
   if(navigating)event.preventDefault();
  });
 }
 return {init,requestHome,situation,abortAndGoHome};
})();
if(typeof window!=='undefined')window.ELMOS_HOME_NAVIGATION=ELMOS_HOME_NAVIGATION;
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ELMOS_HOME_NAVIGATION.init);
 else ELMOS_HOME_NAVIGATION.init();
}
