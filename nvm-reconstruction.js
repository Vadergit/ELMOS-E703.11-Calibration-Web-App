'use strict';
/* E703.11 NVM-Rueckrechnung: ausschliesslich lesend.
   Sources: 25DS0170E.04 §§6.2.1, 6.3, 6.4.1.1, 6.5 and AN0203 §2.2.
   Physikalische Brueckensignale sind NOMINALE AFE-Rueckrechnungen, keine
   rekonstruierten Originalmessungen. Kein NVM/RAM-Zugriff und kein Schreiben. */
const ELMOS_NVM_RECON = (() => {
 const validWords = a => Array.isArray(a) && a.length === 64 &&
   a.every(v => Number.isInteger(v) && v >= 0 && v <= 65535);
 const i16 = v => v & 0x8000 ? v - 65536 : v;
 const q12 = v => i16(v) / 4096;
 const q15 = v => i16(v) / 32768;
 const finite = v => typeof v === 'number' && Number.isFinite(v);
 const chooseSource = (live,offline,preferred='file') =>
  preferred==='eeprom'&&validWords(live)?{kind:'eeprom',words:live}:
  validWords(offline)?{kind:'file',words:offline}:
  validWords(live)?{kind:'eeprom',words:live}:{kind:'none',words:null};
 const hex = v => '0x'+Number(v).toString(16).toUpperCase().padStart(4,'0');
  // The DSP target limit and physical °C assignment are not independent NVM
  // registers. Reuse a locally stored profile only after binding it to the
  // exact chip UID and NVM CRC; otherwise make the assumed defaults explicit.
  function referenceMetadata(words,uid,readLocal){
   if(!validWords(words))return null;
   const factoryTemp=words[31]===0&&words[32]===0x1000&&
    words[51]===0x0F4D&&words[52]===0xBC8E&&words[53]===0xFC54&&words[54]===0;
   const constantTemp=words.slice(52,55).every(w=>w===0);
   const result={limit:32000,limitSource:'default',temperatureSource:factoryTemp?'factory':'assumed',
    factoryTemp,constantTemp};
   const serial=hex(words[1]).slice(2)+hex(words[0]).slice(2);
   if(typeof uid!=='string'||!/^[0-9a-f]{12}$/i.test(uid)||uid.slice(-8).toUpperCase()!==serial||
      typeof readLocal!=='function')return result;
   const chipUid=uid.toUpperCase();
   const safeJSON=key=>{try{const raw=readLocal(key);return raw?JSON.parse(raw):null}catch{return null}};
   const saved=safeJSON('elmos-dsp-display-by-uid-v1-'+chipUid);
   if(saved?.uid===chipUid&&saved.crc===words[63]&&
      Number.isInteger(saved.limit)&&saved.limit>=1000&&saved.limit<=32000){
    result.limit=saved.limit;
    result.limitSource='local';
   }
   const last=safeJSON('elmos8-last-program');
   const exact=last&&String(last.id||'').toUpperCase()===chipUid&&last.restore!==true&&
    Array.isArray(last.words)&&last.words.length===64&&
    last.words.every((w,i)=>w===words[i]);
   if(exact){
    if(result.limitSource==='default'&&Number.isInteger(last.outputTarget?.limit)&&
       last.outputTarget.limit>=1000&&last.outputTarget.limit<=32000){
     result.limit=last.outputTarget.limit;
     result.limitSource='local';
    }
    if(!factoryTemp&&!constantTemp&&last.temperatureBasis==='an0203-celsius-v1')
     result.temperatureSource='local';
   }
   return result;
  }

 const fmt = (v, digits = 4) => finite(v)
   ? v.toLocaleString('de-CH', {maximumFractionDigits:digits, minimumFractionDigits:Math.min(2,digits)})
   : '—';
 const pg1 = [3.5, 6, 8.5, 11];
 const pg2 = [2, 2.22, 2.5, 2.86, 3.33, 4, 5, 6.67, 10];
 // Polynomial root isolation by derivative extrema, not a sampling grid.
 // Supports first, second and third order curves, including tangential roots.
 // A non-monotonic curve is rejected whenever more than one inverse exists.
 function polynomialRoots(coefficients,target,bounds=[-1,32767/32768]) {
  const c=coefficients.slice(0,4);
  while(c.length<4)c.push(0);
  c[0]-=target;
  const [lo,hi]=bounds,epsilon=1e-12;
  if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo>=hi)return [];
  const f=x=>((c[3]*x+c[2])*x+c[1])*x+c[0];
  const candidates=[lo,hi];
  const A=3*c[3],B=2*c[2],C=c[1];
  if(Math.abs(A)>epsilon){
   const disc=B*B-4*A*C;
   if(disc>=-epsilon){
    const sqrt=Math.sqrt(Math.max(0,disc));
    for(const x of [(-B-sqrt)/(2*A),(-B+sqrt)/(2*A)])
     if(x>lo&&x<hi)candidates.push(x);
   }
  }else if(Math.abs(B)>epsilon){
   const x=-C/B;if(x>lo&&x<hi)candidates.push(x);
  }
  candidates.sort((a,b)=>a-b);
  const cuts=candidates.filter((x,i)=>i===0||Math.abs(x-candidates[i-1])>1e-12);
  const found=[];
  const add=x=>{if(Number.isFinite(x)&&!found.some(y=>Math.abs(x-y)<1e-8))found.push(x)};
  for(const x of cuts)if(Math.abs(f(x))<epsilon)add(x);
  for(let i=1;i<cuts.length;i++){
   let a=cuts[i-1],b=cuts[i],fa=f(a),fb=f(b);
   if(fa*fb>=0)continue;
   for(let n=0;n<64;n++){
    const mid=(a+b)/2,fm=f(mid);
    if(fa*fm<=0){b=mid;fb=fm}else{a=mid;fa=fm}
   }
   add((a+b)/2);
  }
  return found.sort((a,b)=>a-b);
 }
 const uniquePoly=(coefficients,target,label,warnings,bounds)=>{
  const r=polynomialRoots(coefficients,target,bounds);
  if(r.length!==1){
   const constant=coefficients.slice(1).every(c=>Math.abs(c)<1e-12);
   warnings.push(label+': '+(constant?'keine invertierbare Kennlinie (konstantes Polynom)':
    r.length?'mehrdeutige Polynomumkehr ('+r.length+' Lösungen)':
    'kein Umkehrwert im gültigen ADC-Rohwertbereich')+'.');
   return null;
  }
  return r[0];
 };
 function calculate(words, opts={}) {
  if(!validWords(words))return {ok:false, error:'Es werden 64 vollständige NVM-Wörter benötigt.'};
  const pmin=Number(opts.pmin??0),pmax=Number(opts.pmax??6),
   ta=Number(opts.ta??25),tb=Number(opts.tb??75),
   vdd=Number(opts.vdd??5),limit=Number(opts.limit??32000);
  const rawInputs=[opts.adcT1,opts.adcT2].map(v=>v===null||v===undefined||v===''?null:Number(v));
  if(rawInputs.some(v=>v!==null&&(!Number.isInteger(v)||v< -32768||v>32767)))
   return {ok:false,error:'Optionale ADC_T-Rohwerte müssen ganze Digits zwischen −32’768 und 32’767 sein.'};
  if(![pmin,pmax,ta,tb,vdd,limit].every(Number.isFinite)||!(pmin<pmax)||
     !(ta<tb)||ta< -40||tb>125||vdd<2.7||vdd>5.5||
     !Number.isInteger(limit)||limit<1000||limit>32000)
   return {ok:false,error:'Bereich prüfen: Druck max > min, Temperatur −40…125 °C mit T2 > T1, VDD 2,7…5,5 V und DSP-Endwert 1’000…32’000.'};
  const w=words, warnings=[], cfg=w[16], afe=w[28],
   factoryTemp=(w[31]===0&&w[32]===0x1000&&w[51]===0x0F4D&&w[52]===0xBC8E&&w[53]===0xFC54&&w[54]===0),
   requestedModel=opts.tempModel??'auto',
   tempModel=requestedModel==='auto'?(factoryTemp?'factory':'an0203'):requestedModel,
   pga1=pg1[afe&3],pga2=pg2[(afe>>>7)&15]??null,
   supply=[2.4,1.6,2.0,null][w[27]&3],
   offsetCode=(afe>>>2)&31,
   offsetSteps=offsetCode===0?0:offsetCode>=1&&offsetCode<=8?offsetCode:
    offsetCode>=17&&offsetCode<=24?16-offsetCode:null,
   offsetStage=offsetSteps===null?null:offsetSteps*50,
   sign1=(afe&0x1000)?-1:1,
   sign2=(afe&0x4000)?-1:1,
   signAdc=(afe&0x8000)?-1:1,
   sF=q12(w[34]),sO=q12(w[33]),
   tF=q12(w[32]),tO=q12(w[31]),
   scoeff=w.slice(35,51).map(q15),tcoeff=w.slice(51,55).map(q15);
  if(!['factory','an0203'].includes(tempModel))return {ok:false,error:'Unbekanntes Temperaturmodell'};
  const scaledTemp=at=>tcoeff[0]+at*(tcoeff[1]+at*(tcoeff[2]+at*tcoeff[3]));
  const tempCorrectionConstant=tcoeff.slice(1).every(c=>c===0);
  const pressureTempIndependent=scoeff.every((c,i)=>i%4===0||c===0);
  const temperatureAvailable=!tempCorrectionConstant;
  const manualBoth=rawInputs.every(v=>v!==null);
  // A fixed DSP_T can still identify the encoded reference temperature;
  // it does NOT indicate actual chip temperature or physical TK.
  const fixedTemperatureC=tempCorrectionConstant?(tempModel==='factory'?
   tcoeff[0]*32768/100:(tcoeff[0]*32768+16485)/387.88):null;
  // The pressure path uses normalized T, not DSP_T. If every pressure coefficient
  // with a temperature power is zero, T is mathematically irrelevant and
  // pressure can be reconstructed even with a fixed or missing DSP_T calibration.
  const pressureCoeffs=t=>Array.from({length:4},(_,i)=>{
   const j=i*4;return scoeff[j]+t*(scoeff[j+1]+t*(scoeff[j+2]+t*scoeff[j+3]));
  });
  const post=!!(cfg&0x4000),postFine=!!(cfg&0x20),
   postGain=post?(postFine?1+q15(w[56]):q12(w[56])):1,
   postOffset=post?(postFine?q15(w[55]):q12(w[55])):0;
  const physical=adc=>{
   if(!supply||pga2===null||offsetStage===null)return null;
   const stage=(adc*700/(pga2*supply))*(sign2*signAdc);
   return (stage-offsetStage)/(pga1*sign1);
  };
  // The normalized intermediate S (or T) can be outside ±1 even when the
  // originating 16-bit ADC sample is valid. Derive inverse bounds from the
  // real ADC domain via the NVM Q3.12 gain and offset (e.g. S_O = -2.371).
  const adcBounds=[-1,32767/32768];
  const scaledBounds=(gain,offset)=>{
   if(!gain)return null;
   const pair=adcBounds.map(adc=>gain*adc+offset);
   return [Math.min(...pair),Math.max(...pair)];
  };
  const pressureBounds=scaledBounds(sF,sO),temperatureBounds=scaledBounds(tF,tO);
  const rows=[];
  if(!sF)warnings.push('S_F (NVM-Wort 34 / RAM 0x72) ist 0x0000: Die Druck-Normierung ist nicht invertierbar. Das ist der dokumentierte Werks-Standardwert; für eine gültige Sensorrückrechnung muss ein Druckabgleich im NVM vorhanden sein.');
  if(scoeff.every(c=>c===0))warnings.push('S0–S15 sind alle 0: Im gespeicherten Datensatz sind keine nutzbaren Druck-Korrekturkoeffizienten vorhanden.');
  if(tcoeff.every(c=>c===0))warnings.push('T0–T3 sind alle 0: Keine nutzbare absolute Temperaturkennlinie.');
  if(!(cfg&0x1000))warnings.push('Absolute Temperaturkorrektur (t_abs_en) ist nicht eingeschaltet. Die Temperaturrückrechnung beruht nur auf gespeicherten Koeffizienten.');
  if(!(cfg&0x000C))warnings.push('Temperaturmesspfad (t_cor_en) ist nicht aktiv: TK0/TKR beschreiben möglicherweise nicht das Laufzeitverhalten.');
  if(factoryTemp)warnings.push('Elmos-Werk-Temperaturprofil erkannt: ungetrimmtes Temperaturmodell mit 100 Digits/°C. Keine garantierte absolute Genauigkeit.');
  if(requestedModel!=='auto')warnings.push('Temperaturmodell manuell gewählt: prüfen, ob dieses zum Abgleich gehört.');
  if((cfg&3)===0)warnings.push('Druckkorrektur ist in CFG_EN nicht aktiv; die abgelegten Koeffizienten beschreiben möglicherweise nicht den aktiven Ausgang.');
  if(!supply)warnings.push('Reservierter Code für Brückenspeisung: mV/V nicht berechenbar.');
  if(pga2===null)warnings.push('CFG_AFE1 enthält einen reservierten PGA2-Code: keine mV/V-Rückrechnung.');
  if(offsetStage===null)warnings.push('CFG_AFE1 enthält einen nicht dokumentierten Offset-DAC-Code: keine mV/V-Rückrechnung.');
  if(Math.abs(sF)<1e-12)warnings.push('S_F ist null: ADC_S kann nicht rückgerechnet werden.');
  if(Math.abs(tF)<1e-12)warnings.push('T_F ist null: ADC_T kann nicht rückgerechnet werden.');
  if(Math.abs(postGain)<1e-12)warnings.push('DSP-Nachskalierung mit Nullverstärkung verhindert die eindeutige Umkehr.');
  if(!(cfg&0x1000)&&tcoeff.slice(1).every(x=>Math.abs(x)<1e-12))warnings.push('Keine verwertbare Temperaturkennlinie: TK0/TKR sind aus diesem NVM nicht bestimmbar.');
  if(pressureTempIndependent && !temperatureAvailable)
   warnings.push('Druckpolynom enthält keine temperaturabhängigen S-Koeffizienten: Druckwerte sind trotz konstantem DSP_T rückrechenbar. Die beiden Temperaturzeilen zeigen dasselbe Modell, keine gemessene Temperaturdrift.');
  if(rawInputs.some(v=>v!==null))warnings.push('Gemessene ADC_T-Rohwerte benutzt: Temperaturbezug 1/2 muss zur zugehörigen Messung gehören. TK0/TKR bleiben Modellwerte, keine unabhängig gemessenen Kennwerte.');
  for(const [rowIndex,tempC] of [ta,tb].entries()){
   const dspTemp=(tempModel==='factory'?100*tempC:387.88*tempC-16485)/32768;
   // A constant DSP_T polynomial cannot be inverted. Do not generate 800
   // spurious roots and do not let an irrelevant temperature block pressure.
   const measured=rawInputs[rowIndex];
   const tempNorm=measured!==null?tF*measured/32768+tO:
    temperatureAvailable&&temperatureBounds?
      uniquePoly(tcoeff,dspTemp,'Temperatur '+fmt(tempC,1)+' °C',warnings,temperatureBounds):null;
   const adcT=measured!==null?measured/32768:
    tempNorm===null||!tF?null:(tempNorm-tO)/tF;
   const pressureTemp=pressureTempIndependent?0:tempNorm;
   const row={tempC,tempNorm,adcT,pressureTempIndependent, endpoints:[]};
   for(const [name,dsp] of [['Nullpunkt',-limit/32768],['Endpunkt',limit/32768]]){
    const beforePost=postGain?(dsp-postOffset)/postGain:null;
    const sNorm=pressureTemp!==null&&beforePost!==null&&pressureBounds?
      uniquePoly(pressureCoeffs(pressureTemp),beforePost,name+' bei '+fmt(tempC,1)+' °C',warnings,pressureBounds):null;
    const adcS=sNorm===null||!sF?null:(sNorm-sO)/sF;
    const bridge=adcS===null?null:physical(adcS);
    if(adcS!==null&&Math.abs(adcS)>1)warnings.push('Berechneter ADC_S ausserhalb ±32768 bei '+name+', '+fmt(tempC,1)+' °C.');
    row.endpoints.push({name,dsp,sNorm,adcS,adcDigits:adcS===null?null:adcS*32768,bridge});
   }
   row.zero=row.endpoints[0].bridge;
   row.full=row.endpoints[1].bridge;
   row.span=finite(row.zero)&&finite(row.full)?row.full-row.zero:null;
   rows.push(row);
   if(adcT!==null&&Math.abs(adcT)>1)warnings.push('Berechneter ADC_T ausserhalb ±32768 bei '+fmt(tempC,1)+' °C.');
  }
  const a=rows[0],b=rows[1],dt=tb-ta,spanBar=pmax-pmin;
  const hasPhysical=[a.zero,a.span,b.zero,b.span].every(finite)&&Math.abs(a.span)>1e-12;
  const canReportTK=hasPhysical&&!pressureTempIndependent&&(
   (manualBoth&&tF!==0)||
   (temperatureAvailable&&tF!==0));
  const tk0=canReportTK?(b.zero-a.zero)/dt:null;
  const tk0Bar=canReportTK?(tk0/a.span*spanBar):null;
  const tkr=canReportTK?(b.span/a.span-1)/dt:null;
  const adc0=a.endpoints[0].adcDigits,adc1=a.endpoints[1].adcDigits;
  const adcSpan=finite(adc0)&&finite(adc1)?adc1-adc0:null;
  const ain=!!((cfg>>>9)&7&&((cfg>>>9)&7)<=3), scaleEnabled=!!(cfg&0x40);
  const aoF=q12(w[58]),aoO=q12(w[57]);
  const out=(target)=>{
   const q=scaleEnabled?target*aoF+aoO:target;
   return {digital:q*32768, volts:vdd*(q+1)/2, percent:(q+1)*50};
  };
  const analog=ain ? {low:out(-limit/32768),high:out(limit/32768),mode:(cfg>>>9)&7,scaleEnabled,aoF,aoO}:null;
  if(ain&&scaleEnabled&&Math.abs(aoF)<1e-12)
   warnings.push('AODO: scale_en ist aktiv, aber AODO_F=0x0000. Der ideale Analogausgang bleibt bei jedem Druck konstant auf '+fmt(analog.low.volts,4)+' V. Sensorstart, Fehlerreaktionen und tatsächliche Spannung separat prüfen.');
  if(post)warnings.push('DSP-Post-Scaling aktiv: ALARM_LO/HI werden vor der inversen Druckrechnung berücksichtigt.');
  if(ain&&((analog.low.percent<10||analog.high.percent>90)))warnings.push('Analogausgang teilweise ausserhalb des spezifizierten linearen 10–90-%-VDD-Bereichs (ohne Clippingbetrachtung).');
  if(cfg&0x80)warnings.push('AODO-Limitierung aktiv: berechnete Ausgangsspannungen zeigen den idealen Wert vor der Limitierung.');
  if(cfg&0x100)warnings.push('AODO-Fehlerersatz aktiv: Fehlerzustände können einen anderen Ausgangswert erzwingen.');
  if(scoeff.slice(8).some(v=>v!==0))warnings.push('Druck-Nichtlinearitätsanteile 2./3. Ordnung vorhanden: Angaben gelten für die eingestellten Endpunkte.');
  if(tempCorrectionConstant)warnings.push('DSP_T enthält nur T0 (konstante Temperatur). Absolute Temperaturen lassen sich daraus nicht zurückrechnen.'+
   (manualBoth?' Die manuell angegebenen ADC_T-Werte werden stattdessen für den Druckvergleich verwendet.':' TK0/TKR sind ohne zwei gemessene ADC_T-Werte nicht bestimmbar.'));
  return {ok:true,settings:{pmin,pmax,ta,tb,vdd,limit,pga1,pga2,supply,offsetSteps,offsetStage,
    sign1,sign2,signAdc,sF,sO,tF,tO,post,postGain,postOffset,
    temperatureActive:!!(cfg&0x1000),temperatureModel:tempModel,factoryTemp,scoeff,tcoeff,
    pressureTempIndependent,tempCorrectionConstant,fixedTemperatureC,manualTemperatureInputs:rawInputs,manualBoth},
   rows,hasPhysical,tk0,tk0Bar,tkr,adcSpan,analog,warnings:[...new Set(warnings)]};
 }

 // Explain unavailable readings without inventing original measurements.
 function missingExplanations(r){
  if(!r?.ok)return [];
  const items=[],cfg=r.settings,rows=r.rows;
  const missingT=rows.some(row=>!finite(row.adcT));
  const missingS=rows.some(row=>row.endpoints.some(p=>!finite(p.adcDigits)));
  const missingBridge=rows.some(row=>!finite(row.zero)||!finite(row.span));
  if(missingT){
   const reason=cfg.tempCorrectionConstant?
    'Im NVM ist nur ein fester Temperaturwert hinterlegt. Es fehlen gemessene ADC_T-Werte bei den eingestellten Temperaturen.':
    !cfg.tF?'Die Temperaturskalierung fehlt. Benötigt werden passende gemessene ADC_T-Werte.':
    'Die Temperaturkennlinie liefert keinen eindeutigen Rohwert. Benötigt werden die damals gemessenen ADC_T-Werte.';
   items.push({name:'Temperatur-Rohwerte (ADC_T)',reason});
  }
  if(missingS){
   const reason=(!cfg.sF||cfg.scoeff.every(c=>c===0))?
    'Im NVM fehlt eine nutzbare Druckkalibrierung.':
    !cfg.pressureTempIndependent&&rows.some(row=>!finite(row.tempNorm))?
    'Für diese Temperaturpunkte fehlen passende ADC_T-Messwerte.':
    'Die Druckkennlinie ist nicht eindeutig umkehrbar. Hilfreich wären die ursprünglichen Druck- und ADC_S-Messwerte.';
   items.push({name:'Druck-Rohwerte (ADC_S)',reason});
  }
  if(missingBridge&&!missingS)
   items.push({name:'Nullpunkt / Spanne in mV/V',
    reason:'Die Verstärker- oder Brückeneinstellungen im NVM reichen für eine eindeutige Rückrechnung nicht aus.'});
  if(!finite(r.tk0)||!finite(r.tkr)){
   const reason=cfg.pressureTempIndependent?
    'Im Druckabgleich ist keine Temperaturabhängigkeit hinterlegt. Für echte Temperaturabweichungen wären Druckmessungen bei zwei Temperaturen nötig.':
    missingT?'Es fehlen verwertbare Temperaturwerte für beide Bezugstemperaturen.':
    'Die Druckwerte lassen sich nicht bei beiden Temperaturen vollständig zurückrechnen.';
   items.push({name:'Temperaturgang (TK0 / TKR)',reason});
  }
  items.push({name:'Ursprünglicher Druckbereich / Prüfpunkte',
   reason:'Nicht eindeutig im NVM gespeichert. Der Rechner verwendet deinen eingegebenen Druckbereich; die Originalwerte stehen im Kalibrierprotokoll.'});
  return items;
 }
 function dom(tag,text,cls) {
  const n=document.createElement(tag);
  if(cls)n.className=cls;
  if(text!==undefined)n.textContent=text;
  return n;
 }

 function formulaButton(root,key,label){
  const btn=dom('button','ⓘ','nvmrecon-formula-trigger');
  btn.type='button';btn.title='Berechnung und Formel anzeigen';
  btn.setAttribute('aria-label','Berechnung für '+label+' anzeigen');
  btn.addEventListener('click',()=>openFormula(root,key));
  return btn;
 }
 function openFormula(root,key){
  const dialog=root.querySelector('.nvmrecon-formula-dialog');
  const content=dialog?.querySelector('.nvmrecon-formula-content');
  if(!dialog||!content)return;
  content.replaceChildren();
  const state=root._nvmState,selected=chooseSource(state.live,state.offline,state.preferred);
  const trace=(typeof ELMOS_NVM_TRACE!=='undefined'&&state.last?.ok&&selected.words)?
   ELMOS_NVM_TRACE.trace(key,state.last,selected.words):null;
  if(!trace){
   content.appendChild(dom('p','Keine Berechnung verfügbar. Bitte zuerst ein gültiges NVM-Backup laden.','nvmrecon-muted'));
   if(!dialog.open)dialog.showModal();
   return;
  }
  content.appendChild(dom('div','SO WIRD DER WERT BERECHNET','nvmrecon-formula-eyebrow'));
  content.appendChild(dom('h2',trace.title,'nvmrecon-formula-title'));
  content.appendChild(dom('p',trace.summary,'nvmrecon-formula-summary'));
  content.appendChild(dom('div',trace.result,'nvmrecon-formula-final'));
  const steps=dom('ol',undefined,'nvmrecon-formula-steps');
  for(const item of trace.steps){
   const li=dom('li');
   li.append(dom('h3',item.title),dom('code',item.formula,'nvmrecon-formula-equation'));
   li.appendChild(dom('div',item.substitution,'nvmrecon-formula-values'));
   if(item.description)li.appendChild(dom('p',item.description,'nvmrecon-formula-description'));
   steps.appendChild(li);
  }
  content.appendChild(steps);
  content.appendChild(dom('p',trace.note,'nvmrecon-formula-disclaimer'));
  const link=dom('a','Alle Formeln und Begriffe ausführlich erklärt ↗','nvmrecon-formula-guide');
  link.href='nvm-formeln.html#'+trace.section;link.target='_blank';link.rel='noopener noreferrer';
  content.appendChild(link);
  if(!dialog.open)dialog.showModal();
 }
 const css = [
 '.nvmrecon-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:9px;margin:12px 0}',
 '.nvmrecon-grid label{display:flex;flex-direction:column;gap:3px;font-size:12px}',
 '.nvmrecon-grid input{width:100%;min-width:0;padding:8px;box-sizing:border-box}',
 '.nvmrecon-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:9px;margin:10px 0}',
 '.nvmrecon-metric{border:1px solid var(--border,#cbd5e1);border-radius:9px;padding:10px;background:rgba(125,125,125,.045)}',
 '.nvmrecon-metric small{display:block;color:var(--muted,#666);margin:2px 0 5px}',
 '.nvmrecon-metric strong{font-size:18px;overflow-wrap:anywhere}',
 '.nvmrecon-table{width:100%;border-collapse:collapse;font-size:12px}',
 '.nvmrecon-table td,.nvmrecon-table th{padding:7px 9px;border-bottom:1px solid var(--border,#ccd);text-align:left}',
 '.nvmrecon-table th{font-weight:600}',
 '.nvmrecon-warnings{font-size:12px;line-height:1.55;margin:8px 0}',
 '.nvmrecon-muted{font-size:12px;opacity:.8;line-height:1.5}',
 '.nvmrecon-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
 '.nvmrecon-actions input[type=file]{max-width:230px;font-size:12px}',
 '.nvmrecon-error{border:1px solid #b65c3a;border-radius:8px;padding:10px;margin:8px 0;background:rgba(185,78,45,.07);font-size:13px;line-height:1.5}',
 '.nvmrecon-error p{margin:6px 0 0}',
 '.nvmrecon-error ul{margin:6px 0;padding-left:20px}',
 '.nvmrecon-warnings summary{cursor:pointer}'
 ].join('\n');
 let styleAdded=false;
 function render(root,verifiedWords,liveInfo={}){
  if(!root)return;
  if(!styleAdded){const style=dom('style');style.textContent=css;document.head.appendChild(style);styleAdded=true}
  if(!root._nvmInit){
   root._nvmInit=true;
   root._nvmState={live:null,offline:null,preferred:'file',connected:false,busy:false,liveMeta:null,sourceKey:null,fileUid:null,limitEdited:false,reference:null,readNotice:'',readError:false,reading:false,fileName:null,fileError:null,opts:{pmin:0,pmax:6,ta:25,tb:75,vdd:5,limit:32000,tempModel:'auto'},last:null};
   const heading=dom('h3','Datenquelle & Referenzen','nvmrecon-section-title');
   const detail=dom('p','NVM-Backup laden und Referenzbedingungen festlegen. Die Rückrechnung erfolgt lokal, ohne Sensorzugriff.','nvmrecon-muted nvmrecon-intro');
   const actions=dom('div',undefined,'nvmrecon-actions');
   const file=dom('input');file.type='file';file.accept='.json,application/json';
   file.id='nvmReconFile';file.setAttribute('aria-label','NVM-Backup JSON lokal öffnen');
   const read=dom('button','↻ Sensor-NVM auslesen','nvmrecon-read-sensor');
   read.id='nvmReconReadSensor';read.type='button';
   read.title='Aktuelle 64 NVM-Wörter direkt vom angeschlossenen Sensor lesen und prüfen';
   const upload=dom('label','NVM-Backup importieren','nvmrecon-upload');upload.htmlFor=file.id;
   const clear=dom('button','Datei entfernen','nvmrecon-clear');clear.type='button';clear.disabled=true;
   clear.addEventListener('click',()=>{
    const state=root._nvmState;state.offline=null;state.fileUid=null;state.fileName=null;state.fileError=null;
    state.preferred='eeprom';file.value='';draw(root);
   });
   actions.append(read,upload,file,clear,dom('span','64 Wörter · Sensor-NVM oder lokale JSON-Datei','nvmrecon-actions-hint'));
   const feedback=dom('p',undefined,'nvmrecon-read-feedback');
   feedback.setAttribute('role','status');feedback.hidden=true;

   file.addEventListener('change',async()=>{
    const f=file.files?.[0];if(!f)return;
    try{
     if(f.size>512000)throw Error('Datei zu gross');
     const data=JSON.parse(await f.text());
     const words=Array.isArray(data)?data:data.words;
     if(!validWords(words))throw Error('Kein gültiges 64-Wort-Backup');
     root._nvmState.offline=words.slice();
     root._nvmState.fileUid=typeof data?.uid==='string'?data.uid.toUpperCase():null;
     root._nvmState.limitEdited=false;
     root._nvmState.preferred='file';
     root._nvmState.readNotice='';
     root._nvmState.fileName=f.name;
     root._nvmState.fileError=null;
     draw(root);
    }catch(e){root._nvmState.offline=null;root._nvmState.fileName=null;root._nvmState.fileError='Dateiimport fehlgeschlagen: '+String(e.message);draw(root)}
   });
   const grid=dom('div',undefined,'nvmrecon-grid');
   const fields=[['pmin','Druck min. [bar]','0'],['pmax','Druck max. [bar]','6'],
    ['ta','Temperatur 1 [°C]','25'],['tb','Temperatur 2 [°C]','75'],
    ['vdd','VDD [V]','5'],['limit','DSP-Endwert','32000']];
   for(const [key,title,value] of fields){
    const label=dom('label',title),input=dom('input');input.type='number';input.step=key==='limit'?'1':'any';
    input.value=value;input.dataset.key=key;
    input.addEventListener('input',()=>{root._nvmState.opts[key]=Number(input.value);if(key==='limit')root._nvmState.limitEdited=true;draw(root)});
    label.appendChild(input);grid.appendChild(label);
   }
   const modelLabel=dom('label','Temperaturmodell'),modelSelect=dom('select');
   for(const [value,name] of [['auto','Automatisch'],['an0203','AN0203-Abgleich'],['factory','Werkprofil 0,01 °C']]){
    const option=dom('option',name);option.value=value;modelSelect.appendChild(option);
   }
   modelSelect.addEventListener('change',()=>{root._nvmState.opts.tempModel=modelSelect.value;draw(root)});
   modelLabel.appendChild(modelSelect);grid.appendChild(modelLabel);
   const origin=dom('p',undefined,'nvmrecon-reference-hint');
   origin.hidden=true;
   const advanced=dom('details',undefined,'nvmrecon-warnings nvmrecon-advanced');
   advanced.appendChild(dom('summary','Erweitert: Gemessene Temperatur-ADC-Werte eingeben (optional)'));
   advanced.appendChild(dom('p','Wenn T0–T3 keine umkehrbare Temperaturkennlinie bilden, lassen sich die normierten Temperaturwerte direkt aus gemessenen ADC_T-Rohwerten berechnen. Für TK0/TKR sind zwei echte ADC_T-Messungen bei den eingetragenen Temperaturen erforderlich.','nvmrecon-muted'));
   const advancedGrid=dom('div',undefined,'nvmrecon-grid');
   for(const [key,labelText] of [['adcT1','ADC_T bei Temperatur 1 [Digits]'],['adcT2','ADC_T bei Temperatur 2 [Digits]']]){
    const label=dom('label',labelText),input=dom('input');input.type='number';input.step='1';
    input.min='-32768';input.max='32767';input.placeholder='Optional, leer = aus NVM';
    input.addEventListener('input',()=>{root._nvmState.opts[key]=input.value.trim()===''?null:Number(input.value);draw(root)});
    label.appendChild(input);advancedGrid.appendChild(label);
   }
   advanced.appendChild(advancedGrid);
   const status=dom('div','Noch keine Datenquelle gewählt','nvmrecon-status nvmrecon-source-empty');
   status.setAttribute('role','status');status.setAttribute('aria-live','polite');
   const result=dom('div');result.className='nvmrecon-result';
   const explain=dom('details',undefined,'nvmrecon-explain');
   explain.append(dom('summary','Grenzen der Rückrechnung'),
    dom('p','Der ursprüngliche Druckbereich in bar, die Prüfpunkte und echte unkalibrierte Messwerte werden durch das NVM allein nicht eindeutig gespeichert. TK0/TKR sind modellbasierte Rückrechnungen, keine unabhängige Sensormessung.','nvmrecon-muted'));
   const setup=dom('section',undefined,'nvmrecon-setup');
   setup.append(heading,detail,actions,feedback,grid,origin,advanced);
   const missing=dom('section',undefined,'nvmrecon-missing');
   missing.hidden=true;
   const dialog=dom('dialog',undefined,'nvmrecon-formula-dialog');
   dialog.setAttribute('aria-label','Rechenweg und Formel');
   const close=dom('button','Schliessen ×','nvmrecon-formula-close');
   close.type='button';close.setAttribute('aria-label','Berechnungsdetails schliessen');
   close.addEventListener('click',()=>dialog.close());
   dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
   dialog.append(close,dom('div',undefined,'nvmrecon-formula-content'));
   root.append(setup,status,result,explain,missing,dialog);
  }
  const state=root._nvmState;
  state.live=validWords(verifiedWords)?verifiedWords.slice():null;
  state.connected=!!liveInfo?.connected;
  state.busy=!!liveInfo?.busy;
  state.liveMeta=state.live&&liveInfo?.uid?{uid:liveInfo.uid,readAt:liveInfo.readAt??null}:null;
  draw(root);
 }
 function draw(root){
  const state=root._nvmState,status=root.querySelector('.nvmrecon-status'),
   box=root.querySelector('.nvmrecon-result'),missing=root.querySelector('.nvmrecon-missing');
  box.replaceChildren();
  if(missing){missing.replaceChildren();missing.hidden=true;}
  const selected=chooseSource(state.live,state.offline,state.preferred),words=selected.words;
  const sourceUid=selected.kind==='eeprom'?state.liveMeta?.uid:state.fileUid;
  const readLocal=key=>{try{return localStorage.getItem(key)}catch{return null}};
  const reference=words?referenceMetadata(words,sourceUid,readLocal):null;
  const sourceKey=words?[selected.kind,sourceUid||'',words[0],words[1],words[63],selected.kind==='file'?state.fileName||'':''].join('|'):null;
  if(sourceKey!==state.sourceKey){
   state.sourceKey=sourceKey;
   if(reference&&!state.limitEdited){
    state.opts.limit=reference.limit;
    const limitInput=root.querySelector('[data-key="limit"]');
    if(limitInput)limitInput.value=String(reference.limit);
   }
  }
  state.reference=reference;
  const clear=root.querySelector('.nvmrecon-clear');
  if(clear)clear.disabled=!validWords(state.offline);
  const read=root.querySelector('#nvmReconReadSensor');
  if(read){
   read.disabled=!state.connected||state.busy||state.reading;
   read.textContent=state.reading?'NVM wird gelesen …':'↻ Sensor-NVM auslesen';
   read.title=state.connected?'Aktuelle NVM-Wörter erneut mit UID, CRC8 und CRC16 prüfen':'Zum direkten Lesen zuerst einen Sensor verbinden';
  }
  const feedback=root.querySelector('.nvmrecon-read-feedback');
  if(feedback){
   feedback.hidden=!state.readNotice;
   feedback.textContent=state.readNotice||'';
   feedback.className='nvmrecon-read-feedback'+(state.readError?' is-error':'');
  }
  if(state.fileError){
   const err=dom('p',state.fileError,'nvmrecon-error');
   box.appendChild(err);
  }
  const origin=root.querySelector('.nvmrecon-reference-hint');
  if(origin&&reference){
   const limitText=state.limitEdited?'DSP-Endwert: manuell gewählt':
    reference.limitSource==='local'?'DSP-Endwert: aus lokalem UID-/NVM-gebundenem Kalibrierprofil':
    'DSP-Endwert: Standard ±32’000 · nicht im NVM gespeichert';
   const tempText=state.opts.tempModel!=='auto'?'Temperaturmodell: manuell gewählt':
    reference.temperatureSource==='factory'?'Temperaturmodell: Werkprofil anhand der Koeffizienten erkannt':
    reference.temperatureSource==='local'?'Temperaturmodell: AN0203 aus passender lokaler Kalibrierhistorie':
    'Temperaturmodell: nicht eindeutig im NVM · AN0203 wird angenommen';
   origin.textContent=limitText+' · '+tempText;
   origin.hidden=false;
  }else if(origin)origin.hidden=true;
  if(!words){
   status.className='nvmrecon-status nvmrecon-source-empty';
   status.textContent='Keine NVM-Daten · JSON-Backup importieren oder EEPROM eines Sensors lesen.';
   state.last=null;return;
  }
  status.className='nvmrecon-status nvmrecon-source-active';
  if(selected.kind==='eeprom'){
   status.classList.add('nvmrecon-live-current');
   const meta=state.liveMeta;
   const dt=meta?.readAt?new Date(meta.readAt):null;
   const time=dt&&!Number.isNaN(dt.getTime())?dt.toLocaleString('de-CH',{dateStyle:'short',timeStyle:'medium'}):'Lesezeitpunkt nicht dokumentiert';
   const badge=dom('span','● AKTUELLER SENSOR · NVM','nvmrecon-source-tag');
   const name=dom('strong','Direkt vom verbundenen Sensor · '+(meta?.uid?'UID '+meta.uid:'Chip-UID geprüft'),'nvmrecon-source-name');
   const hint=dom('span','64/64 Wörter · UID / CRC8 / CRC16 geprüft · zuletzt gelesen: '+time+
    (validWords(state.offline)?' · importierte Datei nicht aktiv':''),'nvmrecon-source-hint');
   status.replaceChildren(badge,name,hint);
  }else{
   status.classList.add('nvmrecon-file-current');
   const badge=dom('span','LOKALE DATEI · NICHT LIVE','nvmrecon-source-tag');
   const name=dom('strong',state.fileName||'NVM-Backup','nvmrecon-source-name');
   const hint=dom('span','64 Wörter · aus JSON importiert · Datei-CRC/UID nicht separat geprüft'+
    (state.connected?' · «Sensor-NVM auslesen» lädt den aktuellen Chipstand':' · ohne Sensorverbindung'),'nvmrecon-source-hint');
   status.replaceChildren(badge,name,hint);
  }
  const r=calculate(words,state.opts);state.last=r;
  if(!r.ok){box.appendChild(dom('p',r.error,'nvmrecon-error'));return}
  const unavailable=[];
  if(!r.settings.sF)unavailable.push('S_F ist 0x0000. Ohne gültigen Druck-Normierungsfaktor lassen sich ADC_S, Nullpunkt, Spanne, TK0 und TKR nicht rekonstruieren.');
  if(r.settings.scoeff.every(c=>c===0))unavailable.push('Alle S0–S15 stehen auf 0x0000. Die Druck-Kennlinie fehlt im ausgewählten Datensatz.');
  if(!r.settings.tF&&!r.settings.pressureTempIndependent)unavailable.push('T_F ist 0x0000. ADC_T ist nicht eindeutig rekonstruierbar.');
  if(r.settings.tcoeff.every(c=>c===0)&&!r.settings.manualBoth&&!r.settings.pressureTempIndependent)
   unavailable.push('Alle T0–T3 stehen auf 0x0000. Für temperaturabhängige Druckkoeffizienten werden zwei gemessene ADC_T-Werte benötigt.');
  if(!unavailable.length && !r.hasPhysical)unavailable.push('Die Polynomumkehr ist mit diesen Koeffizienten und Bezugspunkten nicht eindeutig möglich. Siehe Diagnosehinweise.');
  if(r.settings.tempCorrectionConstant && r.hasPhysical && !r.settings.manualBoth){
   const tempInfo=finite(r.settings.fixedTemperatureC)?' Der fest programmierte DSP_T entspricht nominell '+fmt(r.settings.fixedTemperatureC,2)+' °C; das ist keine aktuelle Temperaturmessung.':'';
   const note=dom('p','Druck-Rückrechnung erfolgreich: Der gespeicherte Druckabgleich ist temperaturunabhängig.'+tempInfo+' ADC_T, TK0 und TKR sind nicht rückrechenbar; «—» bedeutet nicht bestimmbar.','nvmrecon-note');
   box.appendChild(note);
  }
  if(unavailable.length){
   const notice=dom('section',undefined,'nvmrecon-error');
   notice.appendChild(dom('strong','Rückrechnung nicht vollständig möglich'));
   const ul=dom('ul');
   for(const item of unavailable)ul.appendChild(dom('li',item));
   notice.appendChild(ul);
   const origin=selected.kind==='file'?'Importdatei':'LIVE-EEPROM';
   notice.appendChild(dom('p','Geprüfte Datenquelle: '+origin+'. Kontrolliere die NVM-Werte und gegebenenfalls, ob der Sensor wirklich kalibriert und ins NVM programmiert wurde.'));
   box.appendChild(notice);
  }
  const metricsTitle=dom('div',undefined,'nvmrecon-results-head');
  const formulaIndex=dom('a','Formeln & Erklärung ↗','nvmrecon-formula-index');
  formulaIndex.href='nvm-formeln.html';formulaIndex.target='_blank';formulaIndex.rel='noopener noreferrer';
  metricsTitle.append(dom('h3','Berechnete Kennwerte'),formulaIndex);
  box.appendChild(metricsTitle);
  const metrics=dom('div',undefined,'nvmrecon-metrics');
  for(const [name,value,unit,sub,traceKey] of [
   ['Nullpunkt bei '+fmt(r.settings.ta,1)+' °C',r.rows[0].zero,'mV/V','Nominales Brückensignal','zero'],
   ['Spanne bei '+fmt(r.settings.ta,1)+' °C',r.rows[0].span,'mV/V','Zwischen Druck min/max','span'],
   ['TK0',finite(r.tk0)?r.tk0*100:null,'mV/V / 100 K','Nullpunktänderung','tk0'],
   ['TK0, druckbezogen',finite(r.tk0Bar)?r.tk0Bar*100:null,'bar / 100 K','Äquivalenter Druckoffset','tk0bar'],
   ['TKR',finite(r.tkr)?r.tkr*10000:null,'% / 100 K','Relative Spannenänderung','tkr'],
   ['ADC-Spanne',r.adcSpan,'Digits','Bei Temperatur 1','adcspan']
  ]){
   const isPrimary=metrics.childElementCount<2;
   const card=dom('div',undefined,'nvmrecon-metric'+(isPrimary?' nvmrecon-metric-primary':'')+(!finite(value)?' nvmrecon-metric-unavailable':''));
   if(!finite(value))card.title='Aus den vorhandenen NVM-Daten nicht bestimmbar';
   const output=dom('div',undefined,'nvmrecon-metric-reading');
   output.append(dom('strong',fmt(value,name==='ADC-Spanne'?0:4)),dom('span',unit,'nvmrecon-metric-unit'));
   const heading=dom('div',undefined,'nvmrecon-metric-heading');
   heading.append(dom('small',name),formulaButton(root,traceKey,name));
   card.append(heading,output,dom('small',sub));metrics.appendChild(card);
  }
  box.appendChild(metrics);
  const tableHead=dom('div',undefined,'nvmrecon-results-head nvmrecon-table-head');
  tableHead.append(dom('h3','ADC- und Brückenwerte'),dom('span','Referenzpunkte · keine Live-Messung','nvmrecon-mini-label'));
  box.appendChild(tableHead);
  const table=dom('table',undefined,'nvmrecon-table');
  const head=dom('tr');
  for(const [text,key] of [['Temperatur',null],['ADC_T [Digits]','adcT'],
   ['ADC_S Null','adcS0'],['ADC_S End','adcS1'],['Null [mV/V]','bridge'],['Spanne [mV/V]','span']]){
   const th=dom('th');th.appendChild(dom('span',text));
   if(key)th.appendChild(formulaButton(root,key,text));
   head.appendChild(th);
  }
  const thead=dom('thead');thead.appendChild(head);table.appendChild(thead);
  const body=dom('tbody');
  for(const r0 of r.rows){
   const row=dom('tr');
   [fmt(r0.tempC,1)+' °C',fmt(finite(r0.adcT)?r0.adcT*32768:null,0),
    fmt(r0.endpoints[0].adcDigits,0),fmt(r0.endpoints[1].adcDigits,0),fmt(r0.zero,5),fmt(r0.span,5)]
     .forEach(s=>row.appendChild(dom('td',s)));
   body.appendChild(row);
  }
  table.appendChild(body);const wrap=dom('div',undefined,'nvmrecon-table-scroll');wrap.style.overflowX='auto';wrap.appendChild(table);box.appendChild(wrap);
  const e=dom('p','Temperaturmodell: '+(r.settings.temperatureModel==='factory'?'Werkprofil (100 Digits/°C)':'AN0203 (387,88 × °C − 16’485)')+' · AFE: SVDD '+fmt(r.settings.supply,2)+' V · PGA1 '+fmt(r.settings.pga1,2)+'× · PGA2 '+fmt(r.settings.pga2,2)+'× · Offset-DAC '+r.settings.offsetSteps+' Stufen · S_F '+fmt(r.settings.sF,5)+' · S_O '+fmt(r.settings.sO,5),'nvmrecon-muted');
  const technical=dom('details',undefined,'nvmrecon-technical');
  technical.appendChild(dom('summary','AFE- und Registerdetails'));
  technical.appendChild(e);
  const raw=dom('details',undefined,'nvmrecon-warnings');
  const coeffCount=r.settings.scoeff.filter(c=>c!==0).length;
  const tempCount=r.settings.tcoeff.filter(c=>c!==0).length;
  raw.appendChild(dom('summary','Registerdiagnose: NVM-Rohwerte und Kalibrierkoeffizienten ('+coeffCount+'/16 S, '+tempCount+'/4 T aktiv)'));
  const rawText=dom('p',
   'S_F [34] '+hex(words[34])+' = '+fmt(r.settings.sF,6)+' · S_O [33] '+hex(words[33])+' = '+fmt(r.settings.sO,6)+
   ' · T_F [32] '+hex(words[32])+' = '+fmt(r.settings.tF,6)+' · T_O [31] '+hex(words[31])+' = '+fmt(r.settings.tO,6)+
   ' · CFG_EN [16] '+hex(words[16])+' · CFG_AFE0 [27] '+hex(words[27])+' · CFG_AFE1 [28] '+hex(words[28]),'nvmrecon-muted');
  raw.appendChild(rawText);
  raw.appendChild(dom('p','Druck-Koeffizienten: '+words.slice(35,51).map((w,i)=>'S'+i+'='+hex(w)).join(' · '),'nvmrecon-muted'));
  raw.appendChild(dom('p','Temperatur-Koeffizienten: '+words.slice(51,55).map((w,i)=>'T'+i+'='+hex(w)).join(' · '),'nvmrecon-muted'));
  technical.appendChild(raw);
  box.appendChild(technical);
  if(r.analog){
   const ao=r.analog, section=dom('section',undefined,'nvmrecon-analog');
   const info=dom('div',undefined,'nvmrecon-analog-main');
   info.append(dom('span','Analogausgang · ideal, bei '+fmt(r.settings.vdd,2)+' V Versorgung','nvmrecon-analog-label'),
    dom('strong',fmt(ao.low.volts,3)+' → '+fmt(ao.high.volts,3)+' V','nvmrecon-analog-value'));
   const other=dom('span',ao.scaleEnabled?'AODO_F '+fmt(ao.aoF,5)+' · AODO_O '+fmt(ao.aoO,5):'Ausgangsskalierung nicht aktiv','nvmrecon-analog-meta');
   section.append(info,other,formulaButton(root,'analog','Analogausgang'));
   if(ao.scaleEnabled && Math.abs(ao.aoF)<1e-12)
    section.appendChild(dom('span','Faktor 0 · Ausgang rechnerisch konstant','nvmrecon-analog-alert'));
   box.appendChild(section);
  }
  const warnings=dom('details',undefined,'nvmrecon-warnings nvmrecon-diagnostics');
  warnings.open=!r.hasPhysical;
  warnings.appendChild(dom('summary',r.warnings.length+' Hinweise / Gültigkeitsgrenzen'));
  const ul=dom('ul');
  for(const message of r.warnings)ul.appendChild(dom('li',message));
  ul.appendChild(dom('li','Nominale AFE-Verstärkungen, ADC-Fullscale ±700 mV und Offset-DAC-Stufe 50 mV/V verwendet. Fabriktrim, reale Brückenspannung und Temperaturdrift der Elektronik sind nicht rückgerechnet.'));
  warnings.appendChild(ul);box.appendChild(warnings);
  if(missing){
   missing.appendChild(dom('h3','Nicht berechenbare Werte'));
   missing.appendChild(dom('p','Welche Angaben fehlen und warum?','nvmrecon-missing-intro'));
   const entries=dom('ul');
   for(const item of missingExplanations(r)){
    const li=dom('li');
    li.append(dom('strong',item.name+': '),document.createTextNode(item.reason));
    entries.appendChild(li);
   }
   missing.appendChild(entries);
   missing.hidden=false;
  }
 }
 function setReadFeedback(root,message='',options={}){
  if(!root?._nvmState)return;
  const state=root._nvmState;
  state.readNotice=String(message||'');
  state.readError=!!options.error;
  state.reading=!!options.reading;
  draw(root);
 }
 function preferLive(root){
  if(!root?._nvmState?.live)return false;
  root._nvmState.preferred='eeprom';
  root._nvmState.limitEdited=false;
  root._nvmState.readNotice='';
  root._nvmState.readError=false;
  root._nvmState.reading=false;
  draw(root);
  return true;
 }
 return {calculate,render,validWords,chooseSource,referenceMetadata,missingExplanations,setReadFeedback,preferLive};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_NVM_RECON;
