'use strict';
/* Portable, chip-independent settings profiles for E703.11.
 * NEVER include UID, serial numbers, factory words, raw NVM, CRC, or fitted coefficients.
 * Parsing/validation is side-effect free; no register writes anywhere in this module.
 */
const ELMOS_CONFIG=(()=>{
 const FORMAT='ELMOS-E70311-CONFIG',VERSION=1;
 const own=(x)=>x&&typeof x==='object'&&!Array.isArray(x);
 const exact=(x,keys,label)=>{
  if(!own(x)||Object.keys(x).some(k=>!keys.includes(k)))throw Error(label+': unbekanntes oder unerlaubtes Feld');
 };
 const integer=(v,a,b,label)=>{if(!Number.isInteger(v)||v<a||v>b)throw Error(label+': ungültiger Wert ('+a+' bis '+b+')');return v};
 const number=(v,a,b,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<a||v>b)throw Error(label+': ungültiger Wert');return v};
 const options=(v,allowed,label)=>{if(!allowed.includes(v))throw Error(label+': nicht unterstützt');return v};
 const text=(v,max,label)=>{if(typeof v!=='string'||v.length>max||!v.trim())throw Error(label+': Text fehlt oder ist zu lang');return v.trim()};
 function validate(obj,cal){
  exact(obj,['format','version','label','createdAt','afe','calibration','output'],'Config');
  if(obj.format!==FORMAT||obj.version!==VERSION)throw Error('Nur E703.11 Config-Dateien im Format '+FORMAT+' v1 werden akzeptiert (keine EEPROM-Backups)');
  const label=text(obj.label,80,'Profilname');
  if(typeof obj.createdAt!=='string'||obj.createdAt.length>40||!Number.isFinite(Date.parse(obj.createdAt)))throw Error('Erstellungsdatum fehlt');
  exact(obj.afe,['pga1','pga2','offset'],'AFE');
  const afe={pga1:integer(obj.afe.pga1,0,3,'PGA1'),pga2:integer(obj.afe.pga2,0,8,'PGA2'),offset:integer(obj.afe.offset,-8,8,'AFE-Offset')};
  exact(obj.calibration,['sOrder','tOrder','dspLimit','pointCount','samples','reference'],'Kalibriereinstellungen');
  const c=obj.calibration;
  const calSettings={sOrder:integer(c.sOrder,1,3,'Druck-Polynomgrad'),tOrder:integer(c.tOrder,0,3,'Temperatur-Polynomgrad'),
   dspLimit:integer(c.dspLimit,1000,32000,'DSP-Endwert'),pointCount:integer(c.pointCount,2,10,'Messpunkte'),
   samples:integer(c.samples,1,100,'Samples')};
  if(calSettings.pointCount<=calSettings.sOrder)throw Error('Für die Polynomordnung fehlen Messpunkte');
  exact(c.reference,['min','max','unit','customUnit'],'Referenz');
  const ref=c.reference,unit=options(ref.unit,['bar','%','mbar','kPa','psi','custom'],'Einheit');
  calSettings.reference={min:number(ref.min,-1e9,1e9,'Referenz Min'),max:number(ref.max,-1e9,1e9,'Referenz Max'),unit,
   customUnit:ref.customUnit===''?'':text(ref.customUnit,14,'Eigene Einheit')};
  if(!(calSettings.reference.min<calSettings.reference.max))throw Error('Referenz Max muss grösser als Min sein');
  if(unit==='custom'&&!calSettings.reference.customUnit)throw Error('Eigene Einheit fehlt');
  exact(obj.output,['mode','scaleEnabled','vdd','s0','s1','gain','offset','pwmPeriod'],'Ausgang');
  const o=obj.output;
  const mode=options(String(o.mode),['keep','1','2','3','4','5','onewire'],'Ausgangstyp');
  if(typeof o.scaleEnabled!=='boolean')throw Error('Ausgang: scaleEnabled muss true/false sein');
  const output={mode,scaleEnabled:o.scaleEnabled,vdd:number(o.vdd,2.7,5.5,'VDD'),
   s0:number(o.s0,0,5.5,'S0'),s1:number(o.s1,0,5.5,'S1'),
   gain:number(o.gain,-7.9,7.9,'AODO_F'),offset:number(o.offset,-7.9,7.9,'AODO_O'),
   pwmPeriod:integer(o.pwmPeriod,2,65535,'PWM-Periode')};
  if(['1','2','3'].includes(mode)){
   if(!cal||typeof cal.analogScaling!=='function')throw Error('Skalierungsprüfung nicht verfügbar');
   // Analog input endpoints are the source of truth, never raw imported registers.
   const derived=cal.analogScaling(output.s0,output.s1,output.vdd,calSettings.dspLimit);
   output.gain=derived.gain;output.offset=derived.offset;output.scaleEnabled=true;
  }
  if(['4','5'].includes(mode)){
   if(!output.scaleEnabled)throw Error('PWM/FM benötigt die Ausgangsskalierung');
   if(output.gain<=0)throw Error('PWM/FM-Gain muss positiv sein');
  }
  return {format:FORMAT,version:VERSION,label,createdAt:obj.createdAt,afe,calibration:calSettings,output};
 }
 function create(fields,cal){return validate({format:FORMAT,version:VERSION,label:fields.label,
  createdAt:new Date().toISOString(),afe:fields.afe,calibration:fields.calibration,output:fields.output},cal);}
 function describe(p){const c=p.calibration,o=p.output;return [
  'AFE: PGA1 Stufe '+p.afe.pga1+', Offset '+(p.afe.offset*50)+' mV/V, PGA2 Stufe '+p.afe.pga2,
  'DSP: ±'+c.dspLimit+' Digits; Druckgrad '+c.sOrder+', Temperaturgrad '+c.tOrder,
  'Referenz: '+c.reference.min+' bis '+c.reference.max+' '+(c.reference.unit==='custom'?c.reference.customUnit:c.reference.unit),
  'Messpunkte: '+c.pointCount+', Samples: '+c.samples,
  'Ausgang: '+(o.mode==='onewire'?'One Wire only (nur bei bestehendem PLC)':o.mode==='keep'?'Unverändert':o.mode)+
   (['1','2','3'].includes(o.mode)?', S0 '+o.s0+' V / S1 '+o.s1+' V bei VDD '+o.vdd+' V':'')
 ].join('\n');}
 return {FORMAT,VERSION,validate,create,describe};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_CONFIG;
