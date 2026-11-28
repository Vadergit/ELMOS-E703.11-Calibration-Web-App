"use strict";
// Independent beta diagnostic. Never program NVM, never change bridge excitation/RPGA.
const ELMOS_BRIDGE_V2=(()=>{
 const map=[...Array.from({length:13},(_,i)=>[0x50+2*i,i]),[0,13],[2,14],...Array.from({length:14},(_,i)=>[4+2*i,16+i]),...Array.from({length:33},(_,i)=>[0x6a+2*i,30+i])];
 const eq=(a,b)=>a.length===b.length&&a.every((w,i)=>w===b[i]);
 function plan(afe,cfg){
  if((afe&0xf000)!==0x1000||(cfg&0x8010)!==0x10||(cfg&12)===12)throw Error("Nicht unterstütztes AFE-/CFG-Profil.");
  const t=(afe&~0xfff)|0x14a,c=(cfg&12)?cfg:cfg|4;
  if((afe&0x800)&&t!==afe)throw Error("Externe Diodenstromquelle aktiv; Umschaltung nicht freigegeben.");
  return {afe:t,cfg:c,changed:t!==afe||c!==cfg};
 }
 async function analyze(io,cal,A,{measure=false,allowRestart=false,progress=()=>{}}={}){
  const uid=await io.uid(),guard=async()=>{if(await io.uid()!==uid)throw Error("Sensor-UID geändert.");};
  const nvm=async()=>{await guard();const w=[];for(let i=0;i<64;i++)w.push(await io.nvm(i*2));await guard();
   if(w.some(x=>!Number.isInteger(x)||x<0||x>65535)||cal.crc8(w)!==(w[15]>>>8)||cal.crc16(w)!==w[63])throw Error("NVM CRC8/CRC16 ungültig.");return w;};
  const snap=async()=>{const out=[];for(const [a] of map)out.push(await io.read(a));await guard();return out;};
  progress("64 NVM-Wörter werden gelesen …");const words=await nvm();
  const r={uid,words,measurement:null,restored:null,notice:"NVM vollständig geprüft; keine Kalibrierregister verändert."};
  if(!measure)return r;
  const ram=await snap(),get=a=>ram[map.findIndex(x=>x[0]===a)],afe0=get(0x1a),svddCode=afe0&3;
  if(svddCode===3||get(0x0e)!==1){r.notice="Kein unterstützter kontinuierlicher Messmodus / SVDD.";return r;}
  let p;try{p=plan(get(0x1e),get(4));}catch(e){r.notice=e.message;return r;}
  if(p.changed&&(!allowRestart||!map.every(([,i],j)=>ram[j]===words[i]))){r.notice="Umschaltung nicht freigegeben: bestätigter DIY-Kaltstart und NVM-identisches RAM erforderlich.";return r;}
  let dirty=false,err=null;
  try{
   if(p.changed){await guard();await io.grant();for(const [a,w] of [[0x1e,p.afe],[4,p.cfg]])if(w!==get(a)){await guard();dirty=true;await io.write(a,w);if(await io.read(a)!==w)throw Error("RAM-Rücklesen fehlgeschlagen.");}}
   progress("Brückenstrom wird gemessen …");await io.pause(300);await io.read(0x28);
   const samples=[];for(let i=0;i<7;i++){await guard();samples.push(await io.fresh());}
   const m=A.assessProbe({samples,svdd:A.SUPPLIES[svddCode],afe0,afe2:p.afe});
   if(!m.valid)throw Error("ADC_T instabil oder ausserhalb Messbereich. RPGA bleibt bewusst unverändert.");
   r.measurement={...m,bounds:A.resistanceBounds({adc:m.adc,svddCode,afe0,afe2:p.afe}),svdd:A.SUPPLIES[svddCode],powerMw:A.SUPPLIES[svddCode]*m.current};
  }catch(e){err=e.message;}
  finally{
   if(dirty){progress("Kaltstart und vollständige Rückprüfung …");try{await guard();await io.restart();await guard();await io.grant();if(!eq(words,await nvm())||!eq(ram,await snap()))throw Error("NVM oder RAM weicht ab.");r.restored=true;}
    catch(e){r.restored=false;r.measurement=null;r.notice="Wiederherstellung NICHT bestätigt: "+e.message+" – Sensor stromlos machen und neu verbinden.";await io.unconfirmed(r.notice);return r;}}
   else{await guard();if(!eq(ram,await snap()))throw Error("RAM hat sich während Messung verändert.");r.restored=true;}
  }
  r.notice=err||(dirty?"NVM und Konfigurations-RAM nach Kaltstart identisch.":"Messung ohne Änderung des Konfigurations-RAM.");return r;
 }
 function mount(run){
  const d=document.getElementById("bridgeV2Dialog"),$=id=>document.getElementById(id);if(!d)return;
  document.querySelectorAll("[data-open-bridge-v2]").forEach(b=>b.addEventListener("click",()=>{if(!d.open)d.showModal();}));
  let busy=false;d.addEventListener("cancel",e=>{if(busy)e.preventDefault();});$("bridgeV2Close").onclick=()=>{if(!busy)d.close();};
  for(const [id,measure] of [["bridgeV2Read",false],["bridgeV2Measure",true]])$(id).onclick=async()=>{
   if(busy)return;busy=true;const controls=["bridgeV2Read","bridgeV2Measure","bridgeV2Close"];controls.forEach(id=>$(id).disabled=true);
   const status=m=>{$("bridgeV2Status").textContent=m;};status("Prüfung startet …");$("bridgeV2Result").textContent="";
   try{const r=await run(measure,status);if(!r){status("Abgebrochen.");return;}status(r.notice);
    const f=(v,d=2)=>Number.isFinite(v)?v.toFixed(d):"nicht bestimmbar";
    const model=ELMOS_NVM_RECON.calculate(r.words,{pmin:0,pmax:100,pressureUnit:"%"}),row=model.rows?.[0];
    const lines=["Chip-UID: "+r.uid,"64 NVM-Wörter · CRC8/CRC16 gültig","Brückenoffset (NVM-Modell, 25 °C): "+f(row?.zero,3)+" mV/V","Brückenhub (NVM-Modell, 25 °C): "+f(row?.span,3)+" mV/V"];
    if(r.measurement){const m=r.measurement;lines.push("Gesamtwiderstand ≈ "+f(m.resistanceOhm/1000,3)+" kΩ","Nominales Toleranzband: "+f(m.bounds.minOhm/1000,3)+"–"+f(m.bounds.maxOhm/1000,3)+" kΩ","Brückenstrom ≈ "+f(m.current*1000,1)+" µA","SVDD nominal: "+f(m.svdd,1)+" V","Verlustleistung ≈ "+f(m.powerMw,3)+" mW","ADC_T: "+m.adc+" · RPGA: "+m.code+" · Streuung: "+m.spread+" Digits");}
    if(r.restored===true)lines.push("Originalkonfiguration bestätigt.");if(r.restored===false)lines.push("ACHTUNG: Originalkonfiguration nicht bestätigt.");
    if(model.warnings?.length)lines.push("Modellhinweise: "+model.warnings.join(" · "));$("bridgeV2Result").textContent=lines.join("\n");
   }catch(e){status(e.message);}finally{busy=false;controls.forEach(id=>$(id).disabled=false);}
  };
 }
 return Object.freeze({map,plan,analyze,mount});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=ELMOS_BRIDGE_V2;
