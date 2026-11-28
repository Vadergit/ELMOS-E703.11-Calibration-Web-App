'use strict';
// Only the explicit source choice can open the alternate runtime. No normal module is replaced.
(function(){
 const beta=document.documentElement.dataset.temperatureBeta==='true';
 const select=document.getElementById('calTempSource');
 if(!select)return;
 let switching=false;
 let current=beta?(select.value==='external'?'external':'bridge'):'internal';
 function target(source,href){
  const from=new URL(href),to=new URL(source==='internal'?'index.html':'temperature-beta.html',from);
  if(from.searchParams.get('demo')==='1')to.searchParams.set('demo','1');
  if(source!=='internal')to.searchParams.set('source',source);
  return to;
 }
 function switchMode(source){
  if(switching||!['internal','bridge','external'].includes(source))return;
  const api=window.ELMOS_GUIDED_API;
  if(!api){alert('Kalibrierassistent noch nicht bereit. Bitte Seite neu laden.');return;}
  let state,safety;
  try{state=api.state();safety=api.navigationSafety();}catch(e){alert('Sensorstatus nicht eindeutig. Wechsel nicht ausgeführt.');return;}
  if(safety.critical||safety.measuring||state.connectionBusy){alert('Aktiven Mess- oder Schreibvorgang zuerst abschliessen.');return;}
  if(state.usbConnected&&!state.demo){alert('Bitte Sensor über «Trennen» vom USB-Port abmelden. Beim Wechsel zurück zur Standardversion den Sensor stromlos machen und neu starten; das RAM kann noch das Beta-Profil enthalten.');return;}
  const pending=(state.points?.length||safety.points||0)>0||state.calStaged||state.activeArchive;
  const msg=(source==='internal'?'Zur unveränderten Standardversion wechseln? Bei realem Sensor zuerst einen Neustart durchführen.':'Beta-Temperaturabgleich öffnen? Experimentell; separater Speicherbereich und neue USB-Verbindung.')+(pending?' Laufende oder nicht gespeicherte Messungen bleiben in der bisherigen Umgebung; vor dem Wechsel bitte sichern.':'');
  if(!window.confirm(msg))return;
  switching=true;location.assign(target(source,location.href).href);
 }
 // Capture before the classic application's target listener: it must never
 // invalidate an ordinary calibration just because the user considered Beta.
 select.addEventListener('change',event=>{
  const wanted=select.value;
  if((!beta&&wanted!=='internal')||(beta&&wanted==='internal')){
   event.stopImmediatePropagation();event.preventDefault();select.value=current;switchMode(wanted);
  }else if(beta){current=wanted;}
 },true);
 if(!beta){
  for(const option of select.options){
   if(option.value==='bridge'){option.disabled=false;option.textContent='Brückenwiderstand / PTC · Beta';}
   if(option.value==='external'){option.disabled=false;option.textContent='Externer Temperaturfühler · Beta';}
  }
 }
 const nav=document.createElement('div');
 nav.setAttribute('aria-label','Temperatur-Beta');
 nav.style.cssText='display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin:0 0 12px';
 for(const [source,label] of (beta?[['internal','Zur Standardversion']]:[['bridge','PTC / Brücke · Beta'],['external','Externer Temperaturfühler · Beta']])){
  const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',()=>switchMode(source));nav.append(button);
 }
 const header=document.querySelector('.wrap > header');if(header)header.after(nav);
})();
