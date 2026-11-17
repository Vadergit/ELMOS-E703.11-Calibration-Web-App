'use strict';
/* E703.11 alarm/EOC/error configuration, strictly from 25DS0170E.04
 * §§6.3.2.4, 6.3.2.5, 6.3.2.9, 6.4.2, 6.5.1.1/2 and 6.5.7.2.
 * No IO: produces a validated, reviewable 64-word NVM image.
 * STATUS_SYNC flags are not pin-level measurements.
 */
const ELMOS_ALARM_CONFIG=(()=>{
 const assert=(ok,msg)=>{if(!ok)throw Error('Alarmkonfiguration: '+msg)};
 const isWord=x=>Number.isInteger(x)&&x>=0&&x<=65535;
 const validWords=words=>Array.isArray(words)&&words.length===64&&words.every(isWord);
 const statusBits=[0,1,2,3,4,5,6,7,8,9,12,13];
 const statusLabels={
  0:'Sensor bereit (Idle)',
  1:'ADC_S: Neue Druckmessung',2:'ADC_T: Neue Temperaturmessung',
  3:'DSP_S: Neuer kalibrierter Druckwert',4:'DSP_T: Neuer Temperaturwert',
  5:'Druck unter Alarmgrenze',6:'Druck über Alarmgrenze',
  7:'Brückenspannung fehlerhaft (BS)',8:'Brückenprüfung fehlerhaft (BC)',
  9:'Sensorerfassung fehlerhaft (ACD)',12:'Ausgang unter Grenzwert',13:'Ausgang über Grenzwert'
 };
 // ERR_MASK is a six-times-two-bit selector, index 0 = bits 1:0.
 const errors=['Ausgang unten begrenzt','Ausgang oben begrenzt','DSP-Überlauf / Sättigung',
  'Brückenprüfung fehlerhaft (BC)','Sensorerfassung fehlerhaft (ACD)',
  'Brückenspannung fehlerhaft (BS)'];
 const actions=['Keine Änderung','Unterer Ersatzwert','Oberer Ersatzwert','Ausgang hochohmig'];
 const selIndex=bit=>bit>=12?bit-2:bit;
 const signed14=x=>{const v=x>>>2;return v&0x2000?v-0x4000:v};
 const signed8=x=>x&0x80?x-256:x;
 const number=(value,label,min,max)=>{
  const x=Number(value);
  assert(value!==''&&value!==null&&value!==undefined&&Number.isFinite(x)&&x>=min&&x<=max,
   label+' muss zwischen '+min+' und '+max+' liegen.');
  return x;
 };
 const int=(x,label,min,max)=>{const v=number(x,label,min,max);assert(Number.isInteger(v),label+' muss ganzzahlig sein.');return v};
 function read(words,limit=32000){
  assert(validWords(words),'Es muss ein vollständiges 64-Wort-EEPROM vorliegen.');
  const norm=int(limit,'DSP-Endbereich',1000,32000);
  const rawLo=signed14(words[55])*4,rawHi=signed14(words[56])*4;
  const sel=((words[56]&3)<<2)|(words[55]&3);
  const rawError=words[62];
  return {
   postScaling:!!(words[16]&(1<<14)),
   alarmEnabled:!!(words[16]&(1<<5)),
   lowerPct:((rawLo/norm+1)/2)*100,upperPct:((rawHi/norm+1)/2)*100,
   hysteresis:sel, selectedStatusBits:statusBits.filter(bit=>words[18]&(1<<selIndex(bit))),
   errorEnabled:!!(words[16]&(1<<8)),
   errorActions:errors.map((_,i)=>(words[61]>>(i*2))&3),
   errorLowPct:signed8(rawError&255)/128*100,
   errorHighPct:signed8((rawError>>8)&255)/128*100,
   limit:norm
  };
 }
 // Independent dependency check. The UI shows these rules live, but prepare()
 // enforces the same hard errors so they cannot be bypassed by editing the DOM.
 function checkDependencies(words,selection){
  const errors=[],warnings=[],facts=[];
  if(!validWords(words))return {ok:false,errors:['Aktuelles 64-Wort-EEPROM fehlt.'],warnings,facts};
  if(!selection||typeof selection!=='object')return {ok:false,errors:['Konfiguration fehlt.'],warnings,facts};
  const mode=(words[16]>>9)&7,postScaling=!!(words[16]&(1<<14));
  const plcPermanent=!!(words[17]&4),pin=['EOC','NCS/SA0','MOSI','AODO'][(words[20]>>7)&3];
  const tempSource=words[29]&3,selSda=(words[20]>>9)&3;
  facts.push('EOC-Pinzuordnung: '+pin+' (bleibt unverändert).');
  facts.push('Ausgang: '+(['High-Z','Analog (DAC 0)','Analog (DAC 1)','Analog (DAC 2)','PWM','FM','Alarm','I²C SDA'][mode])+'.');
  facts.push('One-Wire dauerhaft: '+(plcPermanent?'Ein':'Aus')+'; Startfenster wird nicht verändert.');
  if(postScaling)errors.push('DSP-Post-Scaling aktiv: ALARM_LO/HI enthalten Koeffizienten statt Alarmgrenzen.');
  const limit=Number(selection.limit),lo=Number(selection.lowerPct),hi=Number(selection.upperPct);
  const hyst=Number(selection.hysteresis);
  if(!Number.isInteger(limit)||limit<1000||limit>32000)
   errors.push('Gültigen DSP-Endbereich (1’000–32’000 Digits) angeben.');
  if(selection.lowerPct===''||selection.upperPct===''||!Number.isFinite(lo)||!Number.isFinite(hi)||lo<0||hi>100||lo>=hi)
   errors.push('Untere und obere Grenze müssen innerhalb 0–100 % liegen und klar aufsteigend sein.');
  if(selection.hysteresis===''||!Number.isInteger(hyst)||hyst<0||hyst>15)
   errors.push('Hysterese-Code muss zwischen 0 und 15 liegen.');
  if(Number.isFinite(lo)&&Number.isFinite(hi)&&Number.isFinite(limit)&&
     Number.isInteger(hyst)&&hyst>=0&&hyst<=15&&hi>lo&&limit>0){
   const h=hyst===0?0:2**(hyst-1);
   const span=(hi-lo)*2*limit/100;
   if(2*h>=span)
    errors.push('Hysterese zu gross: Die beiden Grenzbereiche überlappen. Grenzen weiter auseinanderlegen oder Hysterese verkleinern.');
   facts.push('Hysterese: '+h+' DSP-Digits; Abstand der Grenzwerte: '+Math.round(span)+' DSP-Digits.');
   facts.push('Alarm-Schwellen: '+Math.round((2*lo/100-1)*limit/4)*4+
    ' / '+Math.round((2*hi/100-1)*limit/4)*4+' DSP_S-Digits (nach Registerrundung).');
  }
  const bits=Array.isArray(selection.selectedStatusBits)?selection.selectedStatusBits:[];
  if(bits.length!==new Set(bits).size||bits.some(bit=>!statusBits.includes(bit)))
   errors.push('EOC-ODER-Maske enthält ungültige oder doppelte Statussignale.');
  const alarmRouted=bits.some(bit=>bit===5||bit===6);
  const alarmEnabled=selection.alarmEnabled===true,errorEnabled=selection.errorEnabled===true;
  if(alarmEnabled&&!alarmRouted)
   warnings.push('Druckalarm ist aktiv, aber weder Unter- noch Überdruck ist mit dem EOC-Ausgang verknüpft. Die internen STATUS-Bits bleiben dennoch nutzbar.');
  if(!alarmEnabled&&alarmRouted)
   warnings.push('EOC hat Druckalarm-Bits ausgewählt, die Alarmberechnung ist jedoch ausgeschaltet.');
  if(bits.some(bit=>bit===12||bit===13)&&!(words[16]&(1<<7)))
   warnings.push('Ausgangsbegrenzungs-Status ausgewählt, obwohl LIMIT_EN deaktiviert ist.');
  if(bits.length){
   if(pin==='AODO'&&plcPermanent)
    errors.push('EOC auf AODO kollidiert mit dauerhaftem One-Wire. Pinrouting zuerst in Original-PSSC prüfen; hier keine Änderung zulässig.');
   if(pin==='EOC'&&tempSource===3)
    errors.push('EOC-Pin wird für einen externen Temperatursensor verwendet.');
   if(pin==='EOC'&&selSda===2)
    errors.push('EOC-Pin ist gleichzeitig als I²C-SDA ausgewählt.');
   if(pin==='MOSI'&&selSda===1)
    errors.push('MOSI-Pin ist gleichzeitig als I²C-SDA ausgewählt.');
  }
  const acts=Array.isArray(selection.errorActions)?selection.errorActions.map(Number):[];
  if(acts.length!==6||acts.some(a=>!Number.isInteger(a)||a<0||a>3))
   errors.push('Alle sechs Fehlerreaktionen müssen gültig (0–3) sein.');
  const usesReplacement=acts.some(a=>a===1||a===2),usesHighZ=acts.some(a=>a===3);
  for(const [field,name] of [['errorLowPct','Unterer Fehler-Ersatzwert'],['errorHighPct','Oberer Fehler-Ersatzwert']]){
   const raw=selection[field],value=Number(raw);
   if(raw===''||raw===null||raw===undefined||!Number.isFinite(value)||
      value< -100||value>99.21875)
    errors.push(name+' muss zwischen −100 und +99,21875 % liegen.');
  }
  if(hyst>0&&!alarmEnabled)
   warnings.push('Hysterese ist eingestellt, aber der Druckalarm ist ausgeschaltet.');
  if(bits.length===0)
   warnings.push('Kein EOC-Status ausgewählt: Der konfigurierte EOC-Ausgang signalisiert damit keine dieser Bedingungen.');
  if(errorEnabled&&acts.every(a=>a===0))
   warnings.push('Fehlersignalisierung eingeschaltet, aber alle Fehleraktionen stehen auf «Keine Änderung».');
  if(!errorEnabled&&acts.some(a=>a!==0))
   warnings.push('Fehleraktionen sind vorbereitet, aber ERR_EN ist deaktiviert. Sie wirken noch nicht.');
  if((usesReplacement||usesHighZ)&&![1,2,3,4,5,6].includes(mode))
   warnings.push('Fehlerreaktionen ändern DSP_AODO beziehungsweise den AODO-Pin. Der aktuelle Ausgangsmodus ist dafür nicht sinnvoll.');
  if(errorEnabled&&usesHighZ)
   warnings.push('High-Z kann den Analogausgang absichtlich deaktivieren. Nachgeschaltete Elektronik und Failsafe testen.');
  if(plcPermanent&&errorEnabled&&(usesHighZ||usesReplacement))
   warnings.push('One-Wire ist dauerhaft auf AODO aktiv: Analoge Fehlerreaktionen auf AODO sind in diesem Betrieb nicht direkt als Spannungsausgang nutzbar.');
  if((errorEnabled&&usesReplacement)&&
      (!Number.isFinite(Number(selection.errorLowPct))||!Number.isFinite(Number(selection.errorHighPct))))
   errors.push('Fehler-Ersatzwerte sind keine gültigen Zahlen.');
  if(words[16]&(1<<13))
   facts.push('ACD-Diagnose ist freigegeben.');
  else if(bits.includes(9)||acts[4]!==0)
   warnings.push('Sensorerfassungsfehler ausgewählt, aber CFG_EN.s_acd_en ist aus. Dieses Statussignal kann inaktiv bleiben.');
  return {ok:errors.length===0,errors,warnings,facts,
   hasEocMask:bits.length>0,postScaling,mode,pin,plcPermanent};
 }
 function prepare(original,selection,crc16){
  assert(validWords(original),'Keine gültige 64-Wort-EEPROM-Sicherung.');
  assert(typeof crc16==='function'&&crc16(original)===original[63],
    'Original-EEPROM-CRC16 stimmt nicht.');
  assert(selection&&typeof selection==='object'&&!Array.isArray(selection),'Einstellungen fehlen.');
  const dependencies=checkDependencies(original,selection);
  assert(dependencies.ok,dependencies.errors.join(' '));
  const limit=int(selection.limit,'DSP-Endbereich',1000,32000);
  const low=number(selection.lowerPct,'Untere Druckgrenze',0,100);
  const hi=number(selection.upperPct,'Obere Druckgrenze',0,100);
  assert(low<hi,'Die obere Grenze muss grösser sein als die untere.');
  const hyst=int(selection.hysteresis,'Hysterese-Auswahl',0,15);
  assert(typeof selection.alarmEnabled==='boolean'&&typeof selection.errorEnabled==='boolean',
   'Alarm- und Fehlerfreigabe müssen bewusst gesetzt werden.');
  const bits=selection.selectedStatusBits;
  assert(Array.isArray(bits)&&bits.every(x=>Number.isInteger(x)&&statusBits.includes(x))&&
   new Set(bits).size===bits.length,'EOC-Statusauswahl enthält ungültige oder doppelte Bits.');
  const err=selection.errorActions;
  assert(Array.isArray(err)&&err.length===6,'Für jede der sechs Fehlerbedingungen eine Reaktion auswählen.');
  const acts=err.map((x,i)=>int(x,'Fehlerreaktion '+errors[i],0,3));
  const errorLow=number(selection.errorLowPct,'Unterer Fehler-Ersatzwert',-100,99.21875);
  const errorHigh=number(selection.errorHighPct,'Oberer Fehler-Ersatzwert',-100,99.21875);
  // Q0.13 comparator is a SIGNED 14-bit number encoded at [15:2].
  // Absolute DSP thresholds = signed14 * 4.
  const encodePct=pct=>{
   const dsp=(2*pct/100-1)*limit;
   const code=Math.round(dsp/4);
   assert(code>=-8192&&code<=8191,'Alarmgrenze ausserhalb des 14-Bit-Bereichs.');
   return (code&0x3FFF)<<2;
  };
  const next=original.slice();
  next[16]=(original[16]&~((1<<5)|(1<<8)))|
   (selection.alarmEnabled?(1<<5):0)|(selection.errorEnabled?(1<<8):0);
  // preserve entire high nibble incl startup_plc: NEVER modify One-Wire window
  const mask=bits.reduce((m,bit)=>m|(1<<selIndex(bit)),0);
  next[18]=(original[18]&0xF000)|mask;
  next[55]=encodePct(low)|(hyst&3);
  next[56]=encodePct(hi)|((hyst>>2)&3);
  next[61]=acts.reduce((m,a,i)=>m|(a<<(2*i)),original[61]&0xF000);
  const q7=pct=>{const code=Math.round(pct*128/100);
   assert(code>=-128&&code<=127,'Fehler-Ersatzwert passt nicht in Q0.7.');
   return code&255;
  };
  next[62]=q7(errorLow)|(q7(errorHigh)<<8);
  next[63]=crc16(next);
  validateDiff(original,next,crc16);
  const changes=next.map((to,index)=>to!==original[index]?
   {index,address:index*2,from:original[index],to}:null).filter(Boolean);
  return {before:original.slice(),after:next,changes,
   settings:{...selection,selectedStatusBits:bits.slice(),errorActions:acts.slice(),limit}};
 }
 function validateDiff(before,after,crc16){
  assert(validWords(before)&&validWords(after),'Abbild muss 64 vollständige Wörter enthalten.');
  assert(typeof crc16==='function'&&crc16(before)===before[63]&&crc16(after)===after[63],
   'EEPROM-CRC16 ist ungültig.');
  const allow=new Set([16,18,55,56,61,62,63]);
  assert(before.every((word,i)=>before[i]===after[i]||allow.has(i)),
   'Änderung ausserhalb der freigegebenen Alarmregister.');
  assert(((before[16]^after[16])&~((1<<5)|(1<<8)))===0,
   'CFG_EN enthält eine andere Änderung als alarm_en / err_en.');
  assert(((before[18]^after[18])&0xF000)===0,
   'One-Wire-Startfenster oder Schnittstellenstart verändert.');
  assert(((before[61]^after[61])&0xF000)===0,
   'Reservierte ERR_MASK-Bits verändert.');
  assert(!(before[16]&(1<<14))&&!(after[16]&(1<<14)),
   'DSP-Post-Scaling nicht gleichzeitig mit Alarm editieren.');
  return true;
 }
 return Object.freeze({statusBits,statusLabels,errors,actions,read,checkDependencies,prepare,validateDiff});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_ALARM_CONFIG;
