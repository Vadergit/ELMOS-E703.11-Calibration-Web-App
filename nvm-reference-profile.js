'use strict';
/* E703.11 calibration reference metadata. This module never reads/writes hardware.
   A calibration setup is NOT an NVM value. Always distinguish a trusted UID/CRC
   attached profile from an unverified imported template or report. */
const ELMOS_NVM_PROFILE=(()=>{
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const number=n=>n===null||n===undefined||n===''?null:Number(n);
 const allowedUnits=['bar','mbar','kPa','psi','%'];
 const pressureUnit=v=>allowedUnits.includes(v)?v:null;
 const cleanPoints=(points)=>{
  if(!Array.isArray(points))return [];
  return points.slice(0,100).map(p=>{
   if(!p||typeof p!=='object')return null;
   const pressure=number(p.pressure),temperature=number(p.temperature);
   if(!finite(pressure)||!finite(temperature)||temperature < -40||temperature>125)return null;
   const adcS=number(p.adc_s??p.adcS),adcT=number(p.adc_t??p.adcT);
   return {pressure,temperature,
    adcS:finite(adcS)&&Math.abs(adcS)<=32768?adcS:null,
    adcT:finite(adcT)&&Math.abs(adcT)<=32768?adcT:null,
    samples:Number.isInteger(p.sampleCount)?p.sampleCount:null};
  }).filter(Boolean);
 };
 const readings=(points)=>{
  const temperatures=[...new Set(points.map(p=>p.temperature))].sort((a,b)=>a-b);
  const readingsAt=t=>{
   const p=points.filter(p=>p.temperature===t&&finite(p.adcT));
   if(!p.length)return null;
   const values=p.map(x=>x.adcT).sort((a,b)=>a-b);
   if(values[values.length-1]-values[0]>250)return null;
   const middle=values.length>>1;
   return values.length%2?values[middle]:(values[middle-1]+values[middle])/2;
  };
  return {
   ...(temperatures.length?{ta:temperatures[0]}:{}),
   ...(temperatures.length>1?{tb:temperatures[temperatures.length-1]}:{}),
   ...(temperatures.length&&finite(readingsAt(temperatures[0]))&&Number.isFinite(readingsAt(temperatures[0]))?
    {adcT1:readingsAt(temperatures[0])}:{}),
   ...(temperatures.length>1&&finite(readingsAt(temperatures[temperatures.length-1]))&&Number.isFinite(readingsAt(temperatures[temperatures.length-1]))?
    {adcT2:readingsAt(temperatures[temperatures.length-1])}:{}),
  };
 };
 const normalizeFields=(data)=>{
  const d=data&&typeof data==='object'?data:{};
  const fields={},numeric=['pmin','pmax','ta','tb','vdd','limit','adcT1','adcT2'];
  for(const key of numeric){
   const n=number(d[key]);
   if(!finite(n))continue;
   if((key==='pmin'||key==='pmax')&&Math.abs(n)>1e7)continue;
   if((key==='ta'||key==='tb')&&(n < -40||n>125))continue;
   if(key==='vdd'&&(n<2.7||n>5.5))continue;
   if(key==='limit'&&(!Number.isInteger(n)||n<1000||n>32000))continue;
   if((key==='adcT1'||key==='adcT2')&&(!Number.isInteger(n*2)||n< -32768||n>32767))continue;
   fields[key]=n;
  }
  if(finite(fields.pmin)&&finite(fields.pmax)&&fields.pmax<=fields.pmin){
   delete fields.pmin;delete fields.pmax;
  }
  if(finite(fields.ta)&&finite(fields.tb)&&fields.tb<=fields.ta)delete fields.tb;
  const specifiedUnit=d.pressureUnit??d.unit;
  const unit=pressureUnit(specifiedUnit);
  if(unit)fields.pressureUnit=unit;
  else if(specifiedUnit!==undefined&&specifiedUnit!==null){
   // Never silently present a custom pressure unit as bar.
   delete fields.pmin;delete fields.pmax;
  }
  if(['factory','an0203'].includes(d.tempModel))fields.tempModel=d.tempModel;
  return fields;
 };
 const fromSaved=(saved,uid,crc)=>{
  if(!saved||typeof saved!=='object'||typeof uid!=='string'||!Number.isInteger(crc)||saved.uid!==uid||saved.crc!==crc)return null;
  const points=cleanPoints(saved.points);
  const fields=normalizeFields({
   pmin:saved.min,pmax:saved.max,
   limit:saved.limit,pressureUnit:saved.selected==='custom'?'custom':(saved.unit||saved.selected),
   ...saved.reference,
   ...readings(points)
  });
  if(saved.selected==='custom'){
   // Unknown custom display units must never be silently re-labelled as bar.
   delete fields.pmin;delete fields.pmax;delete fields.pressureUnit;
  }
  if(!Object.keys(fields).length)return null;
  return {kind:'saved',name:'Bestätigter Abgleich aus diesem Browser',uid,crc,
   fields,points,recordedAt:saved.savedAt||null,verified:true};
 };
 const fromCalibration=(c)=>{
  if(!c||typeof c!=='object')return null;
  const points=cleanPoints(c.points||c.calibrationPoints);
  const fields=normalizeFields({
   pmin:c.pmin,pmax:c.pmax,pressureUnit:c.pressureUnit||c.unit,
   vdd:c.vdd,limit:c.limit??c.outputLimit,
   tempModel:c.tempModel,
   ...readings(points)
  });
  return {kind:'session',name:'Aktueller Kalibrierablauf',uid:c.uid||null,crc:c.crc??null,
   fields,points,recordedAt:c.recordedAt||null,verified:!!c.verified};
 };
 const fromFile=(data,filename='Kalibrierprofil.json')=>{
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Kalibrierprofil muss ein JSON-Objekt sein.');
  let profile=null;
  if(data.format==='E70311-CALIBRATION-COMPLETE-v1'){
   const nvm=data.nvm?.programmed;
   if(data.type!=='calibration'||data.verifiedNvm!==true||
      !Array.isArray(nvm?.words)||nvm.words.length!==64||
      nvm.words.some(w=>!Number.isInteger(w)||w<0||w>65535)||
      nvm.crc16!==nvm.words[63]||nvm.uid!==data.chipUID)
    throw Error('Komplettabgleich enthält kein bestätigtes 64-Wort-NVM.');
   const points=cleanPoints(data.calibrationPoints);
   const temperatures=Array.isArray(data.reference?.temperatures)?
    data.reference.temperatures.map(number).filter(finite).sort((a,b)=>a-b):[];
   const fields=normalizeFields({
    pmin:data.reference?.min,pmax:data.reference?.max,
    pressureUnit:data.reference?.unit,limit:data.dsp?.outputLimit,
    ...(temperatures.length?{ta:temperatures[0]}:{}),
    ...(temperatures.length>1?{tb:temperatures[temperatures.length-1]}:{}),
    vdd:data.calibrationSessionReport?.expertOutput?.vdd,
    ...(data.dsp?.temperatureOrder>0?{tempModel:'an0203'}:{}),
    ...readings(points)
   });
   profile={kind:'file',name:filename,uid:data.chipUID,crc:nvm.crc16,
    fields,points,recordedAt:data.endedAt||data.nvmProgrammedAt,verified:false};
  }else if(data.format==='E70311-Reference-Profile-v1'){
   profile={kind:'file',name:filename,uid:data.uid||null,crc:data.crc??null,
    fields:normalizeFields(data.fields),points:cleanPoints(data.points),
    recordedAt:data.savedAt||null,verified:false};
  }else if(Array.isArray(data.calibrationPoints)){
   const points=cleanPoints(data.calibrationPoints);
   const min=number(data.displayRange?.min??data.low?.pressure);
   const max=number(data.displayRange?.max??data.high?.pressure);
   const fields=normalizeFields({pmin:min,pmax:max,
    pressureUnit:data.displayRange?.unit??data.unit,
    limit:data.coefficientFit?.outputLimit??data.requestedDSPOutputLimit,
    vdd:data.expertOutput?.vdd??data.displayRange?.vdd,
    tempModel:data.coefficientFit?.orderT>0?'an0203':undefined,...readings(points)});
   profile={kind:'file',name:filename,uid:data.chipUID||null,crc:null,fields,points,
    recordedAt:data.created||null,verified:false};
  }else if(data.calibration||data.dsp||data.reference||data.measurement||data.output){
   const c=data.calibration||{},ref=data.reference||c.reference||{},dsp=data.dsp||c;
   const matrix=dsp.matrix||data.measurement?.matrix||c.matrix;
   const temps=Array.isArray(matrix?.temperatures)?matrix.temperatures.map(number).filter(finite).sort((a,b)=>a-b):[];
   const fields=normalizeFields({
    pmin:ref.min,pmax:ref.max,pressureUnit:ref.unit,
    limit:dsp.dspLimit??dsp.outputLimit,vdd:data.output?.vdd,
    ...(temps.length?{ta:temps[0]}:{}),...(temps.length>1?{tb:temps[temps.length-1]}:{})
   });
   profile={kind:'file',name:filename,uid:null,crc:null,fields,points:[],
    recordedAt:null,verified:false};
  }else throw Error('Nicht erkannt: Bitte ein Kalibrierprotokoll oder eine Config-Vorlage auswählen, kein reines NVM-Backup.');
  if(!Object.keys(profile.fields).length&&!profile.points.length)
   throw Error('Das Profil enthält keine nutzbaren Druck-, Temperatur- oder DSP-Referenzwerte.');
  if(profile.uid!==null&&!/^[0-9a-f]{12}$/i.test(profile.uid))
   throw Error('Ungültige Chip-UID im Kalibrierprofil.');
  return profile;
 };
 const match=(profile,words,uid)=>{
  if(!profile)return {ok:false,reason:''};
  if(profile.uid&&uid&&profile.uid.toUpperCase()!==uid.toUpperCase())
   return {ok:false,reason:'Das Kalibrierprofil gehört zu einer anderen Chip-UID.'};
  if(profile.uid&&Array.isArray(words)&&words.length===64){
   const serial=words.slice(0,2).reverse().map(w=>Number(w).toString(16).toUpperCase().padStart(4,'0')).join('');
   if(profile.uid.slice(-8).toUpperCase()!==serial)
    return {ok:false,reason:'Die Seriennummer im NVM stimmt nicht mit dem Kalibrierprofil überein.'};
  }
  if(profile.crc!==null&&Array.isArray(words)&&words.length===64&&profile.crc!==words[63])
   return {ok:false,reason:'Die NVM-Prüfsumme stimmt nicht zum gespeicherten Kalibrierprofil.'};
  return {ok:true,verified:!!profile.verified||
   !!(profile.uid&&profile.crc!==null&&uid&&Array.isArray(words)&&profile.uid.toUpperCase()===uid.toUpperCase()&&profile.crc===words[63])};
 };
 return Object.freeze({cleanPoints,readings,normalizeFields,fromSaved,fromCalibration,fromFile,match});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_NVM_PROFILE;
