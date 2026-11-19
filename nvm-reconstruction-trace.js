'use strict';
/* Read-only calculation trace for E703.11 NVM reconstruction.
 * Reuses the calculator's already-computed roots and outputs. Never reads or
 * writes a device. Numerical substitutions here are for presentation only.
 */
const ELMOS_NVM_TRACE=(()=>{
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const f=(n,d=7)=>finite(n)?n.toLocaleString('de-CH',{maximumFractionDigits:d,minimumFractionDigits:Math.min(2,d)}):'—';
 const raw=w=>'0x'+(w>>>0).toString(16).toUpperCase().padStart(4,'0');
 const keys=['zero','span','tk0','tk0bar','tkr','adcspan','adcT','adcS0','adcS1','bridge','analog'];
 const info={
  zero:['Nullpunkt · Rückrechnung','nullpunkt'],
  span:['Spanne · Rückrechnung','spanne'],
  tk0:['TK0 · Nullpunkt-Temperaturgang','tk0'],
  tk0bar:['TK0 · druckbezogen','tk0bar'],
  tkr:['TKR · relativer Temperaturgang','tkr'],
  adcspan:['ADC-Spanne · Rohwertdifferenz','adcspan'],
  adcT:['ADC_T · Temperatur-Rohwerte','temperatur'],
  adcS0:['ADC_S · Nullpunkt','druck'],
  adcS1:['ADC_S · Endpunkt','druck'],
  bridge:['Brückensignal · mV/V','bruecke'],
  analog:['Analogausgang · idealisiert','analog']
 };
 const step=(title,formula,substitution,description='')=>({title,formula,substitution,description});
 const qSteps=(w,s)=>[
  step('NVM-Register interpretieren','Q3.12 = int16(Rohwort) / 4096',
   'S_F [34] '+raw(w[34])+' → '+f(s.sF,8)+'; S_O [33] '+raw(w[33])+' → '+f(s.sO,8),
   'Vorzeichenbehaftete 16-Bit-Wörter. S0–S15 sind dagegen im Format Q0.15 gespeichert.'),
  step('AFE-Einstellungen lesen','SVDD, PGA1, PGA2 und Offset-DAC aus CFG_AFE0 / CFG_AFE1',
   'CFG_AFE0 [27] '+raw(w[27])+'; CFG_AFE1 [28] '+raw(w[28])+' → SVDD '+f(s.supply,3)+' V, PGA1 '+f(s.pga1,3)+'×, PGA2 '+f(s.pga2,3)+'×, Brückenpolarität '+(s.sign1<0?'invertiert':'normal')+', DAC '+f(s.offsetStage,3)+' mV/V')
 ];
 function pressureEndpoint(r,w,rowIndex,endpointIndex){
  const s=r.settings,row=r.rows[rowIndex],ep=row.endpoints[endpointIndex],label=rowIndex===0?'T1':'T2';
  const result=[];
  const temp=finite(row.tempNorm)?row.tempNorm:s.pressureTempIndependent?0:null;
  result.push(step('DSP-Zielwert · '+label+' · '+(endpointIndex?'Endpunkt':'Nullpunkt'),
   'DSP_S,Ziel = '+(endpointIndex?'+':'−')+' DSP-Endwert / 32768',
   (endpointIndex?'+':'−')+f(s.limit,0)+' / 32768 = '+f(ep.dsp,9),
   'Der DSP-Endwert stammt aus den Eingaben und ist keine separat gespeicherte Messung.'));
  result.push(step('Optionale DSP-Nachskalierung zurückrechnen',
   'DSP_S,vor = (DSP_S,Ziel − Post-Offset) / Post-Gain',
   '('+f(ep.dsp,9)+' − '+f(s.postOffset,8)+') / '+f(s.postGain,8)+' = '+
    f(finite(s.postGain)&&s.postGain!==0?(ep.dsp-s.postOffset)/s.postGain:null,9),
   s.post?'Nachskalierung ist laut NVM aktiv.':'Nachskalierung nicht aktiv: Faktor 1, Offset 0.'));
  const active=s.scoeff.map((v,i)=>({v,i})).filter(p=>p.v!==0);
  result.push(step('Gespeicherte Druck-Koeffizienten',
   'S_i = int16(NVM[35+i]) / 32768',
   active.length?active.map(p=>'S'+p.i+' ['+(35+p.i)+'] '+raw(w[35+p.i])+' = '+f(p.v,9)).join(' · '):
    'Alle S-Koeffizienten sind null.',
   'Es werden nur die von null verschiedenen Koeffizienten aufgelistet.'));
  const k=temp===null?null:Array.from({length:4},(_,i)=>{
   const c=s.scoeff.slice(i*4,i*4+4);
   return ((c[3]*temp+c[2])*temp+c[1])*temp+c[0];
  });
  result.push(step('Temperaturabhängige Druckkoeffizienten bestimmen',
   'Ki = S(4i) + S(4i+1) × T + S(4i+2) × T² + S(4i+3) × T³',
   temp===null?'Kein eindeutiger normierter Temperaturwert.':
    'T = '+f(temp,8)+'; K0 = '+f(k[0],9)+', K1 = '+f(k[1],9)+', K2 = '+f(k[2],9)+', K3 = '+f(k[3],9),
   s.pressureTempIndependent?'Alle druckbezogenen Temperaturterme sind null; T = 0 dient nur als neutrale Einsetzung.':
   'Die 16 Druckkoeffizienten aus NVM-Wort 35–50 bestimmen die Kennlinie.'));
  result.push(step('Druckpolynom umkehren',
   'DSP_S,vor = K0 + K1 × S + K2 × S² + K3 × S³',
   'Eindeutige Lösung S = '+f(ep.sNorm,9),
   finite(ep.sNorm)?'Es wird nur eine eindeutige Lösung akzeptiert, die zu einem gültigen 16-Bit-ADC_S-Rohwert führt. Der Zwischenwert S darf wegen S_F/S_O ausserhalb ±1 liegen.':
    'Keine eindeutige Lösung: der Rechner zeigt dafür bewusst keinen Zahlenwert.'));
  result.push(step('Normiertes ADC_S zurückrechnen',
   'ADC_S = (S − S_O) / S_F ; ADC_S [Digits] = ADC_S × 32768',
   '('+f(ep.sNorm,9)+' − '+f(s.sO,9)+') / '+f(s.sF,9)+' = '+f(ep.adcS,9)+
    ' → '+f(ep.adcDigits,3)+' Digits',
   'S_F und S_O stehen in den NVM-Wörtern 34 und 33.'));
  result.push(step('Brückensignal näherungsweise ableiten',
   'B [mV/V] = (ADC_S × 700 / (PGA2 × SVDD) × sign2 × signADC − Offset-DAC) / (PGA1 × sign1)',
   '('+f(ep.adcS,9)+' × 700 / ('+f(s.pga2,3)+' × '+f(s.supply,3)+') × '+f(s.sign2,0)+' × '+
   f(s.signAdc,0)+' − '+f(s.offsetStage,2)+') / ('+f(s.pga1,3)+' × '+f(s.sign1,0)+') = '+f(ep.bridge,8)+' mV/V',
   'Nominale AFE-Werte; kein gemessener originaler Brückenausgang.'));
  return result;
 }
 const ending=(value,unit)=>finite(value)?f(value,5)+' '+unit:'Nicht eindeutig berechenbar';
 function trace(key,r,w){
  if(!info[key]||!r?.ok||!Array.isArray(w)||w.length!==64)return null;
  const s=r.settings,a=r.rows[0],b=r.rows[1],dt=s.tb-s.ta;
  const [title,section]=info[key],out={key,title,section,steps:[],summary:'',result:'',note:'Zwischenwerte sind zur Lesbarkeit gerundet. Das Ergebnis stammt direkt aus dem NVM-Rechenmodell.'};
  if(key==='zero'){
   out.summary='Vom DSP-Sollwert über das Druckpolynom und den ADC bis zum nominellen Brückennullpunkt.';
   out.steps=[...qSteps(w,s),...pressureEndpoint(r,w,0,0)];
   out.result=ending(a.zero,'mV/V');
  }else if(key==='span'){
   out.summary='Differenz des rückgerechneten Brückensignals am oberen und unteren Druckpunkt.';
   out.steps=[
    step('Referenzpunkte festlegen','DSP_S,min = −L/32768; DSP_S,max = +L/32768',
     'L = '+f(s.limit,0)+' → '+f(a.endpoints[0].dsp,9)+' und '+f(a.endpoints[1].dsp,9)),
    step('Beide Druckpunkte einzeln umkehren','P(S,T) = DSP_S,vor; ADC_S = (S − S_O) / S_F',
     'ADC_S,min = '+f(a.endpoints[0].adcDigits,3)+', ADC_S,max = '+f(a.endpoints[1].adcDigits,3)+' Digits',
     'Bei nichtlinearen Kennlinien wird jeder Druckpunkt separat invertiert.'),
    step('Brückensignale bilden','B = (ADC_S × 700/(PGA2 × SVDD) × sign2 × signADC − DAC)/(PGA1 × sign1)',
     'B,min = '+f(a.zero,8)+' mV/V; B,max = '+f(a.full,8)+' mV/V'),
    step('Spanne bestimmen','Spanne = B,max − B,min',
     f(a.full,8)+' − ('+f(a.zero,8)+') = '+f(a.span,8)+' mV/V')
   ];out.result=ending(a.span,'mV/V');
  }else if(key==='tk0'){
   out.summary='Nullpunktverschiebung zwischen zwei Temperaturen, bezogen auf 100 K.';
   out.steps=[
    step('Beide Nullpunkte rückrechnen','B0(T1) und B0(T2) aus der DSP-Druckkennlinie',
     f(s.ta,1)+' °C → '+f(a.zero,8)+' mV/V; '+f(s.tb,1)+' °C → '+f(b.zero,8)+' mV/V'),
    step('Temperaturdifferenz bestimmen','ΔT = T2 − T1',f(s.tb,2)+' − '+f(s.ta,2)+' = '+f(dt,2)+' K'),
    step('TK0 auf 100 K normieren','TK0 [mV/V / 100 K] = (B0(T2) − B0(T1)) / ΔT × 100',
     '('+f(b.zero,8)+' − '+f(a.zero,8)+') / '+f(dt,2)+' × 100 = '+f(finite(r.tk0)?r.tk0*100:null,7))
   ];out.result=ending(finite(r.tk0)?r.tk0*100:null,'mV/V / 100 K');
  }else if(key==='tk0bar'){
   out.summary='Temperaturbedingte Nullpunktänderung als äquivalenter Fehler in der eingestellten Druckeinheit.';
   out.steps=[
    step('Druckspanne festlegen','Δp = pmax − pmin',f(s.pmax,4)+' − '+f(s.pmin,4)+' = '+f(s.pmax-s.pmin,4)+' '+(s.pressureUnit||'bar')),
    step('Nullpunktgang und Referenzspanne einsetzen','TK0,p = TK0 / Spanne(T1) × Δp',
     f(r.tk0,8)+' / '+f(a.span,8)+' × '+f(s.pmax-s.pmin,5)+' = '+f(r.tk0Bar,8)+' '+(s.pressureUnit||'bar')+'/K'),
    step('Auf 100 K beziehen','TK0,p,100K = TK0,p × 100',
     f(r.tk0Bar,8)+' × 100 = '+f(finite(r.tk0Bar)?r.tk0Bar*100:null,6)+' '+(s.pressureUnit||'bar')+' / 100 K',
     'Der Druckbereich in bar ist eine Benutzereingabe; er wird nicht automatisch aus dem NVM erkannt.')
   ];out.result=ending(finite(r.tk0Bar)?r.tk0Bar*100:null,(s.pressureUnit||'bar')+' / 100 K');
  }else if(key==='tkr'){
   out.summary='Relative Änderung der Druckspanne zwischen zwei Temperaturen.';
   out.steps=[
    step('Druckspannen vergleichen','Span(T) = B,max(T) − B,min(T)',
     'Span(T1) = '+f(a.span,8)+' mV/V; Span(T2) = '+f(b.span,8)+' mV/V'),
    step('Auf Prozent pro 100 K normieren','TKR [% / 100 K] = (Span(T2) / Span(T1) − 1) / (T2 − T1) × 10’000',
     '('+f(b.span,8)+' / '+f(a.span,8)+' − 1) / '+f(dt,2)+' × 10’000 = '+f(finite(r.tkr)?r.tkr*10000:null,7))
   ];out.result=ending(finite(r.tkr)?r.tkr*10000:null,'% / 100 K');
  }else if(key==='adcspan'){
   out.summary='Differenz der rückgerechneten Druck-ADC-Rohwerte bei Temperatur 1.';
   out.steps=[
    step('Normierte Sensorwerte umkehren','ADC_S = (S − S_O) / S_F',
     'S_F = '+f(s.sF,8)+'; S_O = '+f(s.sO,8)),
    step('In Digits umrechnen','ADC_S,Digits = ADC_S × 32768',
     'Unten: '+f(a.endpoints[0].adcDigits,4)+' · Oben: '+f(a.endpoints[1].adcDigits,4)+' Digits'),
    step('Differenz bilden','ADC-Spanne = ADC_S,oben − ADC_S,unten',
     f(a.endpoints[1].adcDigits,4)+' − ('+f(a.endpoints[0].adcDigits,4)+') = '+f(r.adcSpan,4)+' Digits',
     'Eine negative Zahl zeigt die Richtung der hinterlegten Druckkennlinie.')
   ];out.result=ending(r.adcSpan,'Digits');
  }else if(key==='adcT'){
   out.summary='Der normierte Temperaturwert wird aus dem Temperaturpolynom oder direkt aus gemessenen ADC_T-Daten gewonnen.';
   out.steps=[
    step('Temperaturmodell','DSP_T,Ziel [Digits] = '+(s.temperatureModel==='factory'?'100 × °C':'387,88 × °C − 16’485'),
     'Modell: '+(s.temperatureModel==='factory'?'Werksprofil':'AN0203')),
    step('Temperatur-Koeffizienten aus dem NVM','DSP_T = T0 + T1 × T + T2 × T² + T3 × T³',
     s.tcoeff.map((v,i)=>'T'+i+'='+f(v,8)+' ['+raw(w[51+i])+']').join(' · ')),
    ...r.rows.map((row,i)=>{
     const measured=s.manualTemperatureInputs[i];
     return step('Temperatur '+(i+1)+' · '+f(row.tempC,1)+' °C',
      measured!==null?'T = T_F × ADC_T,gemessen/32768 + T_O':
       'Temperaturpolynom umkehren; ADC_T,Digits = (T − T_O) / T_F × 32768',
      'T = '+f(row.tempNorm,9)+'; T_F = '+f(s.tF,8)+'; T_O = '+f(s.tO,8)+
      ' → ADC_T = '+f(finite(row.adcT)?row.adcT*32768:null,3)+' Digits',
      !finite(row.adcT)?'Ohne invertierbare Temperaturkennlinie oder Messwert nicht bestimmbar.':
      measured!==null?'Dieser Rohwert wurde vom Benutzer eingegeben, nicht aus dem NVM rekonstruiert.':'Modellbasierte Umkehr, keine Originalmessung.');
    })
   ];out.result=r.rows.map((row,i)=>'T'+(i+1)+': '+ending(finite(row.adcT)?row.adcT*32768:null,'Digits')).join(' · ');
  }else if(key==='adcS0'||key==='adcS1'){
   const n=key==='adcS1'?1:0;
   out.summary='Das DSP-Druckpolynom wird für beide gewählten Temperaturen umgekehrt.';
   out.steps=[...qSteps(w,s),...pressureEndpoint(r,w,0,n),...pressureEndpoint(r,w,1,n)];
   out.result=r.rows.map((row,i)=>'T'+(i+1)+': '+ending(row.endpoints[n].adcDigits,'Digits')).join(' · ');
  }else if(key==='bridge'){
   out.summary='Nominale AFE-Rückrechnung mit den aus dem Polynom gewonnenen ADC_S-Werten.';
   out.steps=[...qSteps(w,s),...r.rows.flatMap((row,i)=>row.endpoints.map((ep,j)=>
    step('T'+(i+1)+' · '+(j?'oberer':'unterer')+' Druckpunkt',
     'B = (ADC_S × 700/(PGA2 × SVDD) × sign2 × signADC − DAC)/(PGA1 × sign1)',
     'ADC_S = '+f(ep.adcS,9)+' → '+f(ep.bridge,8)+' mV/V',
     'SVDD = '+f(s.supply,3)+' V, PGA1 = '+f(s.pga1,3)+', PGA2 = '+f(s.pga2,3))))];
   out.result='T1 Null: '+ending(a.zero,'mV/V')+' · T1 Spanne: '+ending(a.span,'mV/V');
  }else if(key==='analog'){
   out.summary='Ideale ratiometrische Ausgangsspannung aus dem DSP-Druckziel; kein echter Spannungsmesswert.';
   const v=r.analog;
   out.steps=[
    step('Ausgangskoeffizienten auslesen','AODO_F = int16(NVM[58])/4096; AODO_O = int16(NVM[57])/4096',
     'AODO_F ['+raw(w[58])+'] = '+f(v?.aoF,8)+'; AODO_O ['+raw(w[57])+'] = '+f(v?.aoO,8)),
    step('Digitale Ausgangsskalierung','DSP_AODO = '+(v?.scaleEnabled?'AODO_F × DSP_S + AODO_O':'DSP_S (Skalierung aus)'),
     'DSP_S,min = '+f(a.endpoints[0].dsp,9)+'; DSP_S,max = '+f(a.endpoints[1].dsp,9)),
    step('Ratiometrischen Ausgang umrechnen','Vout,ideal = VDD × (DSP_AODO + 1) / 2',
     'VDD = '+f(s.vdd,3)+' V → '+f(v?.low?.volts,6)+' V (min) und '+f(v?.high?.volts,6)+' V (max)',
     'Ohne Begrenzung, Fehlerersatz, DAC-Temperaturdrift und Lastfehler.')
   ];out.result=v?f(v.low.volts,5)+' V bis '+f(v.high.volts,5)+' V':'Kein Analogausgang konfiguriert';
  }
  if(out.result.includes('Nicht eindeutig berechenbar')||out.result.includes('—'))
   out.note+=' Fehlende Werte sind nicht durch angenommene Rohmessungen ersetzt.';
  return out;
 }
 return Object.freeze({trace,keys});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_NVM_TRACE;
