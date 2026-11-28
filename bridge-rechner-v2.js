"use strict";
// Independent beta diagnostic. Never program NVM or change SVDD. RPGA only with independently confirmed load and verified restart.
const ELMOS_BRIDGE_V2=(()=>{
 const map=[...Array.from({length:13},(_,i)=>[0x50+2*i,i]),[0,13],[2,14],...Array.from({length:14},(_,i)=>[4+2*i,16+i]),...Array.from({length:33},(_,i)=>[0x6a+2*i,30+i])];
 const eq=(a,b)=>a.length===b.length&&a.every((w,i)=>w===b[i]);
 function plan(afe,cfg){
  if((afe&0xf000)!==0x1000||(cfg&0x8010)!==0x10||(cfg&12)===12)throw Error("Nicht unterstütztes AFE-/CFG-Profil.");
  const t=(afe&~0xfff)|0x14a,c=(cfg&12)?cfg:cfg|4;
  if((afe&0x800)&&t!==afe)throw Error("Externe Diodenstromquelle aktiv; Umschaltung nicht freigegeben.");
  return {afe:t,cfg:c,changed:t!==afe||c!==cfg};
 }
 function rangeSelection(A,svddCode,expectedOhm,verified){
  if(expectedOhm==null)return null;
  if(!Number.isFinite(expectedOhm)||expectedOhm<=0)throw Error("Erwarteten Gesamtwiderstand positiv eingeben.");
  const lo=expectedOhm*.9,hi=expectedOhm*1.1;
  const p=A.plan({minOhm:lo,maxOhm:hi,svddCode,fullSupplyTolerance:true});
  return {lo,hi,expectedOhm,verified:verified===true,best:p.best?.code??null,validCodes:p.candidates.filter(x=>x.valid).map(x=>x.code)};
 }
 async function analyze(io,cal,A,{measure=false,allowRestart=false,expectedOhm=null,verified=false,progress=()=>{}}={}){
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
  const originalCode=(afe0>>4)&15,range=rangeSelection(A,svddCode,expectedOhm,verified);
  let code=originalCode;
  r.diagnostic={originalCode,svddCode,afe0,afe2:get(0x1e),cfg:get(4),range};
  if(range&&range.verified&&!range.validCodes.includes(code)){
   if(range.best===null){r.notice="Keine RPGA-Stufe deckt den bestätigten Widerstandsbereich inklusive SVDD-Toleranz ab.";return r;}
   code=range.best;
  }
  const targetAfe0=(afe0&~0xf0)|(code<<4),changed=p.changed||targetAfe0!==afe0;
  r.diagnostic.targetCode=code;
  if(changed&&(!allowRestart||!map.every(([,i],j)=>ram[j]===words[i]))){r.notice="Umschaltung nicht freigegeben: bestätigter DIY-Kaltstart (One-Wire oder I²C) und NVM-identisches RAM erforderlich.";return r;}
  if((await io.read(0x34))&0x8000){r.notice="Brückenversorgung meldet einen Fehler (HW_DIAG.bs_fil). Keine Umstellung.";return r;}
  let dirty=false,err=null;
  try{
   if(changed){await guard();await io.grant();for(const [a,w] of [[0x1a,targetAfe0],[0x1e,p.afe],[4,p.cfg]])if(w!==get(a)){await guard();dirty=true;await io.write(a,w);if(await io.read(a)!==w)throw Error("RAM-Rücklesen fehlgeschlagen.");}}
   progress("Brückenstrom wird gemessen …");await io.pause(300);await io.read(0x28);
   const samples=[];for(let i=0;i<7;i++){await guard();samples.push(await io.fresh());}
   const actual0=await io.read(0x1a),actual2=await io.read(0x1e),actualCfg=await io.read(4);
   const diag=await io.read(0x34),status=await io.read(0x32),adcTc=await io.read(0x26);
   Object.assign(r.diagnostic,{actual0,actual2,actualCfg,diag,status,adcTc:adcTc>=32768?adcTc-65536:adcTc,samples});
   if(actual0!==targetAfe0||actual2!==p.afe||actualCfg!==p.cfg)throw Error("Messkonfiguration nicht bestätigt.");
   if(diag&0x8000)throw Error("Brückenversorgung meldet Fehler; Widerstand nicht gültig.");
   const m=A.assessProbe({samples,svdd:A.SUPPLIES[svddCode],afe0:actual0,afe2:actual2});
   if(!m.valid)throw Error("ADC_T instabil oder ausserhalb des zulässigen Messbereichs.");
   const bounds=A.resistanceBounds({adc:m.adc,svddCode,afe0:actual0,afe2:actual2});
   const plausible=!range||(range.validCodes.includes(code)&&bounds.minOhm<=range.hi&&bounds.maxOhm>=range.lo);
   r.measurement={...m,bounds,svdd:A.SUPPLIES[svddCode],powerMw:A.SUPPLIES[svddCode]*m.current,plausible,referenceProvided:!!range};
   if(!plausible)err="Widerstandsschätzung passt nicht zum erwarteten Gesamtwiderstand oder RPGA-Messbereich. Nicht als gültigen Messwert verwenden. Unabhängige Widerstandsmessung und Beschaltung prüfen.";
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
  const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
  const f=(v,d=2)=>Number.isFinite(v)?v.toLocaleString("de-CH",{minimumFractionDigits:d,maximumFractionDigits:d}):"—";
  const hex=v=>Number.isInteger(v)?"0x"+v.toString(16).toUpperCase().padStart(4,"0"):"—";
  const result=$("bridgeV2Result"),expected=$("bridgeV2Expected"),verified=$("bridgeV2Verified");
  document.querySelectorAll("[data-open-bridge-v2]").forEach(b=>b.addEventListener("click",()=>{if(!d.open)d.showModal();}));
  expected.addEventListener("input",()=>{verified.checked=false;});
  let busy=false;d.addEventListener("cancel",e=>{if(busy)e.preventDefault();});$("bridgeV2Close").onclick=()=>{if(!busy)d.close();};
  function group(title,items){
   const section=node("section",null,"bv2-section");section.append(node("h3",title));
   const grid=node("div",null,"bv2-grid");
   for(const [label,value,unit] of items){const card=node("div",null,"bv2-metric");card.append(node("span",label),node("strong",value),node("small",unit));grid.append(card);}
   section.append(grid);result.append(section);
  }
  function details(title,body){
   const el=node("details",null,"bv2-details");el.append(node("summary",title),node("pre",body));result.append(el);
  }
  for(const [id,measure] of [["bridgeV2Read",false],["bridgeV2Measure",true]])$(id).onclick=async()=>{
   if(busy)return;const value=expected.value.trim(),expectedOhm=value?Number(value)*1000:null,confirmed=measure&&verified.checked;
   if(measure&&value&&(!Number.isFinite(expectedOhm)||expectedOhm<=0)){ $("bridgeV2Status").textContent="Erwarteten Gesamtwiderstand positiv eingeben.";return;}
   if(confirmed&&!expectedOhm){$("bridgeV2Status").textContent="Zuerst unabhängig gemessenen Gesamtwiderstand eingeben.";return;}
   busy=true;const controls=["bridgeV2Read","bridgeV2Measure","bridgeV2Close","bridgeV2Expected","bridgeV2Verified"];controls.forEach(id=>$(id).disabled=true);
   const status=m=>{$("bridgeV2Status").textContent=m;};status("Prüfung startet …");result.replaceChildren();
   try{const r=await run(measure,status,{expectedOhm,verified:confirmed});if(!r){status("Abgebrochen.");return;}status(r.notice);
    const model=ELMOS_NVM_RECON.calculate(r.words,{pmin:0,pmax:100,pressureUnit:"%"}),row=model.rows?.[0],m=r.measurement;
    const meta=node("p","Chip-UID: "+r.uid+" · NVM CRC8/CRC16 gültig","bv2-meta");result.append(meta);
    if(m){
     if(!m.plausible)result.append(node("p","Unplausible Schätzung – kein bestätigter Widerstandsmesswert.","bv2-warning"));
     group("Elektrische Brückenmessung",[
      ["Gesamtwiderstand",m.plausible?f(m.resistanceOhm/1000,3):"Nicht plausibel",m.plausible?"kΩ · nominale Schätzung":"Rohschätzung: "+f(m.resistanceOhm/1000,3)+" kΩ"],
      ["Brückenstrom",f(m.current*1000,1),"µA · Rückrechnung"],["Brückenspannung",f(m.svdd,2),"V · nominal"],["Verlustleistung",f(m.powerMw,3),"mW · Rückrechnung"]]);
     result.append(node("p","Rechnerisches Toleranzband: "+f(m.bounds.minOhm/1000,3)+"–"+f(m.bounds.maxOhm/1000,3)+" kΩ. Keine garantierte absolute Genauigkeit.","bv2-meta"));
    }
    group("NVM-Rückrechnung · 25 °C",[
     ["Brückennullpunkt",f(row?.zero,3),"mV/V · Modell"],["Brückenhub",f(row?.span,3),"mV/V · Modell"]]);
    if(r.restored!==null)result.append(node("p",r.restored?"Originalkonfiguration bestätigt.":"ACHTUNG: Originalkonfiguration nicht bestätigt.",r.restored?"bv2-meta":"bv2-warning"));
    if(r.diagnostic){
     const x=r.diagnostic,range=x.range;
     const lines=["CFG_AFE0: "+hex(x.afe0)+" → "+hex(x.actual0),"CFG_AFE2: "+hex(x.afe2)+" → "+hex(x.actual2),"CFG_EN: "+hex(x.cfg)+" → "+hex(x.actualCfg),"RPGA: "+x.originalCode+" → "+(x.targetCode??"—"),"ADC_T: "+(x.samples?.join(", ")??"—"),"ADC_TC: "+(x.adcTc??"—"),"HW_DIAG: "+hex(x.diag),"STATUS_SYNC: "+hex(x.status)];
     if(range)lines.push("Erwartet: "+f(range.expectedOhm/1000,3)+" kΩ","Unabhängig bestätigt: "+(range.verified?"Ja":"Nein"),"Geeignete RPGA-Codes: "+(range.validCodes.join(", ")||"keine"));
     details("Messdetails und Register",lines.join("\n"));
    }
    if(model.warnings?.length)details("Hinweise zur NVM-Rückrechnung",model.warnings.join("\n\n"));
   }catch(e){status(e.message);}finally{busy=false;controls.forEach(id=>$(id).disabled=false);}
  };
 }
 function restartSupported({adapter,iface,power,genericRam,plcRam,i2cNvm,cold}){
  return adapter==='bridge'&&power===true&&genericRam===true&&cold===true&&((iface==='plc'&&plcRam===true)||(iface==='i2c'&&i2cNvm===true));
 }
 return Object.freeze({map,plan,analyze,mount,restartSupported,rangeSelection});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=ELMOS_BRIDGE_V2;
