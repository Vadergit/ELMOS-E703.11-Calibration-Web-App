'use strict';
/* E703.11 documented filter catalog and read-only configuration decoding.
 * Source: E703.11 25DS0170E.04 tables 7.5-1, 6.5.1.2, 6.5.7.2.
 * No hardware writes. Unknown/custom combinations are never guessed.
 */
const ELMOS_SETTINGS=(()=>{
 const filterProfiles=[
  ['Butterworth · 10,94 kHz · 50 kS/s · 5 Bit', [0x48D3,0x2A9E,0x0412]],
  ['Butterworth · 12,56 kHz · 50 kS/s · 7 Bit', [0x4AA3,0x2AD6,0x0511]],
  ['Butterworth · 10,98 kHz · 50 kS/s · 7 Bit', [0x49E3,0x2AD3,0x0512]],
  ['Butterworth · 6,44 kHz · 50 kS/s · 8 Bit', [0x49A3,0x2E9B,0x0112]],
  ['Butterworth · 4 kHz · 50 kS/s · 10 Bit', [0xCA13,0x2E1A,0x0536]],
  ['Butterworth · 500 Hz · 50 kS/s · 13 Bit', [0xEB23,0x369F,0x0132]],
  ['Butterworth · 2,1 kHz · 50 kS/s · 12 Bit', [0xCB22,0x3A1E,0x0136]],
  ['Butterworth · 1,04 kHz · 50 kS/s · 13 Bit', [0xEA12,0x3A9F,0x0532]],
  ['Butterworth · 7,21 kHz · 31 kS/s · 9 Bit', [0x48A3,0x0B56,0x0451]],
  ['Butterworth · 1 kHz · 31 kS/s · 13 Bit', [0x49A2,0x1B9B,0x0076]],
  ['Butterworth · 4,37 kHz · 20 kS/s · 7 Bit', [0x48D1,0x2A9E,0x0493]],
  ['Butterworth · 3,39 kHz · 20 kS/s · 11 Bit', [0x4BE0,0x2E9B,0x0093]],
  ['Butterworth · 1,97 kHz · 20 kS/s · 12 Bit', [0x48D0,0x2E53,0x01B4]],
  ['Butterworth · 960 Hz · 20 kS/s · 13 Bit', [0x49E0,0x2E56,0x05B4]],
  ['Butterworth · 490 Hz · 20 kS/s · 14 Bit', [0x68D0,0x32D7,0x01B0]],
  ['Butterworth · 250 Hz · 8 kS/s · 14 Bit', [0x59A3,0x319B,0x00F7]],
  ['Butterworth · 115 Hz · 2 kS/s · 14 Bit', [0x5A94,0x0C5F,0x04BE]],
  ['Butterworth · 50 Hz · 2 kS/s · 14 Bit', [0x78D4,0x10D7,0x01B9]],
  ['Butterworth · 20 Hz · 2 kS/s · 15 Bit', [0x7BA4,0x1497,0x01BA]],
  ['Butterworth · 10 Hz · 2 kS/s · 15 Bit', [0x7894,0x1452,0x029E]],
  ['Bessel · 7,89 kHz · 50 kS/s · 7 Bit', [0x4BE3,0x2E9F,0x0112]],
  ['Bessel · 7,17 kHz · 50 kS/s · 8 Bit', [0x4BE3,0x2E9B,0x0111]],
  ['Bessel · 6,33 kHz · 50 kS/s · 8 Bit', [0x49E3,0x2E9F,0x0012]],
  ['Bessel · 5,15 kHz · 50 kS/s · 9 Bit', [0x4B93,0x2ED6,0x0115]],
  ['Bessel · 3,11 kHz · 50 kS/s · 10 Bit', [0xC853,0x2E1F,0x0435]],
  ['Bessel · 370 Hz · 50 kS/s · 14 Bit', [0xEB63,0x369F,0x0131]],
  ['Bessel · 1,53 kHz · 50 kS/s · 12 Bit', [0xCB62,0x3A1B,0x0036]],
  ['Bessel · 860 Hz · 50 kS/s · 12 Bit', [0xEA52,0x3A9F,0x0432]],
  ['Bessel · 3,95 kHz · 31 kS/s · 10 Bit', [0x49E3,0x0F1F,0x0052]],
  ['Bessel · 870 Hz · 31 kS/s · 13 Bit', [0x49A2,0x1B9B,0x0175]],
  ['Bessel · 3,15 kHz · 20 kS/s · 11 Bit', [0x4BE1,0x2E9F,0x0193]],
  ['Bessel · 2,13 kHz · 20 kS/s · 11 Bit', [0x49E0,0x2E9B,0x0090]],
  ['Bessel · 1,51 kHz · 20 kS/s · 12 Bit', [0x4AD0,0x2E1F,0x05B4]],
  ['Bessel · 790 Hz · 20 kS/s · 13 Bit', [0x48A0,0x2E56,0x04B4]],
  ['Bessel · 410 Hz · 20 kS/s · 14 Bit', [0x6990,0x3257,0x00B0]],
  ['Bessel · 190 Hz · 8 kS/s · 14 Bit', [0x59A3,0x319A,0x01F4]],
  ['Bessel · 90 Hz · 2 kS/s · 14 Bit', [0x5AA4,0x0C56,0x05BD]],
  ['Bessel · 40 Hz · 2 kS/s · 14 Bit', [0x7994,0x1057,0x00B9]],
  ['Bessel · 15 Hz · 2 kS/s · 15 Bit', [0x7BE4,0x1497,0x01B9]],
  ['Bessel · 10 Hz · 2 kS/s · 15 Bit', [0x78D4,0x1452,0x029D]],
 ];
 const signed=x=>x&0x8000?x-65536:x;
 const one=(x)=>Number(x).toLocaleString('de-CH',{maximumFractionDigits:3});
 const validate=words=>Array.isArray(words)&&words.length===64&&words.every(w=>Number.isInteger(w)&&w>=0&&w<=65535);
 const filter=values=>{
  if(!Array.isArray(values)||values.length!==3||!values.every(x=>Number.isInteger(x)&&x>=0&&x<=65535))return 'Nicht gelesen';
  const match=filterProfiles.find(([,w])=>w.every((x,i)=>values[i]===x));
  return match?match[0]:'Individuelle Filterkonfiguration · Frequenz aus EEPROM allein nicht sicher bestimmt';
 };
 const statusNames={
  0:'Ruhezustand',1:'ADC-Druckwert aktualisiert',2:'ADC-Temperaturwert aktualisiert',
  3:'DSP-Druckwert aktualisiert',4:'DSP-Temperaturwert aktualisiert',
  5:'Druck unter Alarmgrenze',6:'Druck über Alarmgrenze',7:'Brückenversorgung fehlerhaft',
  8:'Brückenprüfung fehlgeschlagen',9:'Signalerfassung fehlerhaft',
  12:'Analogausgang unten begrenzt',13:'Analogausgang oben begrenzt'
 };
 const eocMask=cfgP0=>{
  if(!Number.isInteger(cfgP0))return 'Nicht gelesen';
  const selected=Object.entries(statusNames).filter(([bit])=>((cfgP0>>(Number(bit)>=12?Number(bit)-2:Number(bit)))&1)).map(([,name])=>name);
  return selected.length?selected.join(' ODER '):'Keine Statussignale ausgewählt';
 };
 const eocPin=cfgP2=>['EOC-Pin','NCS/SA0-Pin','MOSI-Pin','AODO-Pin'][(cfgP2>>7)&3];
 const alarmValues=words=>{
  if(!validate(words))return null;
  const scale=!!(words[16]&(1<<14)),flag=!!(words[16]&(1<<5));
  if(scale){
   const denominator=flag?32768:4096;
   return {type:'postscale',enable:true,mode:flag?'Feinkorrektur':'Grobrechnung',
    offset:signed(words[55])/denominator,gain:signed(words[56])/denominator,
    description:flag?'DSP-Nachskalierung · fein':'DSP-Nachskalierung · grob'};
  }
  const toThreshold=x=>(signed(x)>>2)*4;
  const hystSel=((words[56]&3)<<2)|(words[55]&3);
  const hyst=hystSel===0?0:Math.pow(2,hystSel-1);
  return {type:'alarm',enable:flag,lowerDigits:toThreshold(words[55]),upperDigits:toThreshold(words[56]),
   hysteresisDigits:hyst,selection:hystSel};
 };
 const dspPercentage=digits=>one(digits/32768*100)+' % des DSP-Vollausschlags';
 const alarmText=(words,side)=>{
  const x=alarmValues(words);
  if(!x)return 'Nicht gelesen';
  if(x.type==='postscale')
   return side==='lower'?'DSP-Nachskalierung Offset '+one(x.offset)+' ('+x.mode+')':
    'DSP-Nachskalierung Faktor '+one(x.gain)+' ('+x.mode+')';
  const threshold=side==='lower'?x.lowerDigits:x.upperDigits;
  return (x.enable?'Aktiv · ':'Nicht aktiv · ')+dspPercentage(threshold)+
   (x.selection?' · Hysterese '+dspPercentage(x.hysteresisDigits):' · ohne Hysterese');
 };
 const errorMask=word=>{
  if(!Number.isInteger(word))return 'Nicht gelesen';
  const conditions=['Ausgang unten begrenzt','Ausgang oben begrenzt','DSP-Sättigung',
   'Brückenprüfung fehlgeschlagen','Signalerfassung fehlgeschlagen','Brückenversorgung fehlerhaft'];
  const actions=['Keine Änderung','Unterer Fehlerwert','Oberer Fehlerwert','Hochohmig (High-Z)'];
  const selected=conditions.map((name,i)=>[name,actions[(word>>(2*i))&3]]).filter(([,action])=>action!=='Keine Änderung');
  return selected.length?selected.map(([name,action])=>name+' → '+action).join('; '):
    'Keine Fehlerreaktion eingerichtet';
 };
 const errorValues=word=>{
  if(!Number.isInteger(word))return 'Nicht gelesen';
  // ERR_VAL_HI_LO is Q0.7. Values are DSP_AODO ratios, NOT measured volts.
  const sign8=x=>x&0x80?x-256:x;
  return 'Unterer Ersatzwert '+one(sign8(word&255)/128*100)+' %, oberer Ersatzwert '+
   one(sign8((word>>>8)&255)/128*100)+' % (signiertes DSP_AODO, keine gemessene Spannung)';
 };
 const limitText=words=>{
  if(!validate(words))return 'Nicht gelesen';
  if(!(words[16]&(1<<7)))return 'Ausgangsbegrenzung deaktiviert';
  const low=(signed(words[59])>>2)*4,hi=(signed(words[60])>>2)*4;
  const sel=((words[60]&3)<<2)|(words[59]&3);
  const hyst=sel===0?0:Math.pow(2,sel-1);
  return 'Unten '+dspPercentage(low)+' · oben '+dspPercentage(hi)+
   (sel?' · Hysterese '+dspPercentage(hyst):' · ohne Hysterese');
 };
 const tempSource=word=>['Interne Chiptemperatur','Reservierte Temperaturquelle',
  'Brückenwiderstand (ADC_T/ADC_TC)','Externer Sensor am EOC-Pin'][word&3];
 return Object.freeze({filterProfiles,filter,statusNames,eocMask,eocPin,alarmValues,alarmText,errorMask,errorValues,limitText,tempSource});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_SETTINGS;
