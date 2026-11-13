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
  if(obj?.version===2)return validateSelective(obj,cal);
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

 const GROUPS=['afe','reference','measurement','dsp','output'];
 function validateSelective(obj,cal){
  exact(obj,['format','version','label','createdAt','include',...GROUPS],'Config v2');
  if(obj.format!==FORMAT||obj.version!==2)throw Error('Nur E703.11 Config v2 erlaubt');
  const label=text(obj.label,80,'Profilname');
  if(typeof obj.createdAt!=='string'||obj.createdAt.length>40||!Number.isFinite(Date.parse(obj.createdAt)))throw Error('Erstellungsdatum fehlt');
  if(!Array.isArray(obj.include)||!obj.include.length||obj.include.length>GROUPS.length||
     new Set(obj.include).size!==obj.include.length||obj.include.some(g=>!GROUPS.includes(g)))
   throw Error('Config v2: Mindestens eine gültige Einstellungsgruppe auswählen');
  for(const g of GROUPS)if(Object.hasOwn(obj,g)!==obj.include.includes(g))
   throw Error('Config v2: Feld '+g+' stimmt nicht mit der Gruppenauswahl überein');
  const out={format:FORMAT,version:2,label,createdAt:obj.createdAt,include:obj.include.slice()};
  if(obj.include.includes('afe')){
   const a=obj.afe;exact(a,['pga1','pga2','offset','bridgeSupply'],'AFE');
   out.afe={pga1:integer(a.pga1,0,3,'PGA1'),pga2:integer(a.pga2,0,8,'PGA2'),
    offset:integer(a.offset,-8,8,'AFE-Offset')};
   // Optional field: old v2 files remain valid. Code 3 is reserved.
   if(Object.hasOwn(a,'bridgeSupply'))
    out.afe.bridgeSupply=integer(a.bridgeSupply,0,2,'Brückenspannung SVDD');
  }
  if(obj.include.includes('reference')){
   const r=obj.reference;exact(r,['min','max','unit','customUnit'],'Referenz');
   const unit=options(r.unit,['bar','%','mbar','kPa','psi','custom'],'Einheit');
   out.reference={min:number(r.min,-1e9,1e9,'Referenz Min'),max:number(r.max,-1e9,1e9,'Referenz Max'),
    unit,customUnit:r.customUnit===''?'':text(r.customUnit,14,'Eigene Einheit')};
   if(!(out.reference.min<out.reference.max))throw Error('Referenz Max muss grösser als Min sein');
   if(unit==='custom'&&!out.reference.customUnit)throw Error('Eigene Einheit fehlt');
  }
  if(obj.include.includes('measurement')){
   const m=obj.measurement;exact(m,['pointCount','samples','matrix'],'Messparameter');
   out.measurement={pointCount:integer(m.pointCount,2,10,'Messpunkte'),samples:integer(m.samples,1,100,'Samples')};
  }
  if(out.measurement&&obj.measurement.matrix!==undefined){
   const matrix=obj.measurement.matrix;
   exact(matrix,['p','temp','temperatures'],'Messmatrix');
   const p=integer(matrix.p,2,5,'Druckpunkte');
   const temp=integer(matrix.temp,1,3,'Temperaturstufen');
   if(p*temp!==out.measurement.pointCount||!Array.isArray(matrix.temperatures)||matrix.temperatures.length!==temp)
    throw Error('Messmatrix passt nicht zur Anzahl Messpunkte');
   const temperatures=matrix.temperatures.map(value=>number(value,-40,125,'Temperaturstufe'));
   if(temperatures.some((value,index)=>index>0&&value<=temperatures[index-1]))
    throw Error('Temperaturstufen müssen aufsteigend sein');
   out.measurement.matrix={p,temp,temperatures};
  }
  if(obj.include.includes('dsp')){
   const d=obj.dsp;exact(d,['sOrder','tOrder','dspLimit'],'DSP-Einstellungen');
   out.dsp={sOrder:integer(d.sOrder,1,3,'Druck-Polynomgrad'),
    tOrder:integer(d.tOrder,0,3,'Temperatur-Polynomgrad'),dspLimit:integer(d.dspLimit,1000,32000,'DSP-Endwert')};
  }
  if(out.measurement&&out.dsp&&out.measurement.pointCount<=out.dsp.sOrder)
   throw Error('Für die Polynomordnung fehlen Messpunkte');
  if(out.measurement?.matrix&&out.dsp&&(out.dsp.sOrder>=out.measurement.matrix.p||out.dsp.tOrder>=out.measurement.matrix.temp))
   throw Error('Polynomordnung passt nicht zur Messmatrix');
  if(obj.include.includes('output')){
   const o=obj.output;exact(o,['mode','scaleEnabled','vdd','s0','s1','gain','offset','pwmPeriod','clipping'],'Ausgang');
   const mode=options(String(o.mode),['keep','1','2','3','4','5','onewire'],'Ausgangstyp');
   if(typeof o.scaleEnabled!=='boolean')throw Error('Ausgang: scaleEnabled muss true/false sein');
   out.output={mode,scaleEnabled:o.scaleEnabled,vdd:number(o.vdd,2.7,5.5,'VDD'),
    s0:number(o.s0,0,5.5,'S0'),s1:number(o.s1,0,5.5,'S1'),
    gain:number(o.gain,-7.9,7.9,'AODO_F'),offset:number(o.offset,-7.9,7.9,'AODO_O'),
    pwmPeriod:integer(o.pwmPeriod,2,65535,'PWM-Periode')};
   if(o.clipping!==undefined){
    exact(o.clipping,['mode','low','high'],'Clipping');
    const clippingMode=options(o.clipping.mode,['keep','on','off'],'Clipping-Modus');
    if(!['1','2','3'].includes(mode)&&clippingMode!=='keep')throw Error('Clipping benötigt einen Analogausgang');
    out.output.clipping={mode:clippingMode};
    if(clippingMode==='on'){
     const low=number(o.clipping.low,0,out.output.vdd,'Clipping-Untergrenze');
     const high=number(o.clipping.high,0,out.output.vdd,'Clipping-Obergrenze');
     if(low<out.output.vdd*0.1-1e-9||high>out.output.vdd*0.9+1e-9||low>=high)
      throw Error('Clipping-Grenzen müssen aufsteigend und innerhalb 10–90 % VDD liegen');
     Object.assign(out.output.clipping,{low,high});
    }
   }
   if(['1','2','3'].includes(mode)){
    if(!cal||typeof cal.analogScaling!=='function')throw Error('Skalierungsprüfung nicht verfügbar');
    // For output-only profiles, the active sensor DSP limit is resolved on application.
    // Validate voltage endpoints against a safe full-scale limit without writing registers.
    const derived=cal.analogScaling(out.output.s0,out.output.s1,out.output.vdd,
     out.dsp?.dspLimit??32000);
    out.output.gain=derived.gain;out.output.offset=derived.offset;out.output.scaleEnabled=true;
   }
   if(['4','5'].includes(mode)&&(!out.output.scaleEnabled||out.output.gain<=0))
    throw Error('PWM/FM benötigt aktivierte Skalierung und positiven Gain');
  }
  return out;
 }
 function createSelective(fields,include,cal){
  if(!Array.isArray(include)||!include.length)throw Error('Mindestens eine Einstellungsgruppe auswählen');
  const input={format:FORMAT,version:2,label:fields.label,createdAt:new Date().toISOString(),include:include.slice()};
  const c=fields.calibration;
  if(include.includes('afe'))input.afe=fields.afe;
  if(include.includes('reference'))input.reference=c.reference;
  if(include.includes('measurement'))input.measurement={pointCount:c.pointCount,samples:c.samples,...(c.matrix?{matrix:c.matrix}:{})};
  if(include.includes('dsp'))input.dsp={sOrder:c.sOrder,tOrder:c.tOrder,dspLimit:c.dspLimit};
  if(include.includes('output'))input.output=fields.output;
  return validateSelective(input,cal);
 }

 // Display-only, deterministic download filename. Never used to infer or change calibration.
 // If the precise guided matrix is unknown, use an honest measurement-count label.
 function fileName(profile,appliedPlan=null){
  const source=profile.version===2?profile:{
   label:profile.label,include:GROUPS,
   measurement:{pointCount:profile.calibration.pointCount,samples:profile.calibration.samples},
   dsp:{sOrder:profile.calibration.sOrder,tOrder:profile.calibration.tOrder,dspLimit:profile.calibration.dspLimit},
   reference:profile.calibration.reference,output:profile.output
  };
  const has=g=>source.include.includes(g);
  const clean=value=>String(value).replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue')
   .replace(/Ä/g,'Ae').replace(/Ö/g,'Oe').replace(/Ü/g,'Ue')
   .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
   .replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');
  const num=value=>{
   const n=Number(value);
   if(!Number.isFinite(n))return null;
   // File-system safe: −10.5 -> m10p5, 0.5 -> 0p5.
   return (n<0?'m':'')+String(Math.abs(n)).replace(/\./g,'p');
  };
  const prefix=[];
  if(has('measurement')){
   const m=source.measurement,ref=source.reference,dsp=source.dsp;
   const plan=appliedPlan&&typeof appliedPlan==='object'?appliedPlan:null;
   const exactPlan=plan&&Number.isInteger(plan.pCount)&&Number.isInteger(plan.tCount)&&
    plan.pCount>=2&&plan.pCount<=5&&plan.tCount>=1&&plan.tCount<=3&&
    plan.pCount*plan.tCount===m.pointCount&&
    (!has('dsp')||(dsp.sOrder<plan.pCount&&dsp.tOrder<plan.tCount));
   if(exactPlan)prefix.push(plan.pCount+'P_Druck',plan.tCount+'T_Temp');
   else if(has('dsp')&&dsp.tOrder===0&&m.pointCount===2)prefix.push('2P_Druck');
   else prefix.push(m.pointCount+'Messpunkte');
  }
  if(has('reference')){
   const r=source.reference,unit=r.unit==='custom'?r.customUnit:r.unit;
   prefix.push(clean(num(r.min)+'-'+num(r.max)+unit));
  }
  if(has('output')&&['1','2','3'].includes(source.output.mode)){
   const o=source.output;
   prefix.push(num(o.s0)+'-'+num(o.s1)+'V');
  }
  const label=clean(source.label)||'Standardprofil';
  // Semantic terms first, user-provided name last; safe on Windows/macOS/Linux.
  return [...prefix,'ELMOS_E70311',label].filter(Boolean).join('_').slice(0,164)+'.json';
 }
 function create(fields,cal){return validate({format:FORMAT,version:VERSION,label:fields.label,
  createdAt:new Date().toISOString(),afe:fields.afe,calibration:fields.calibration,output:fields.output},cal);}
 function describe(p){
  if(p.version===2){
   const names={afe:'AFE (PGA1 / Offset / PGA2 / Brückenspannung)',reference:'Druckbereich / Einheit',
    measurement:'Messpunkte / Samples',dsp:'DSP-Ordnung / Endwert',output:'Ausgang / S0 / S1'};
   return p.include.map(g=>names[g]+(g==='afe'?': '+p.afe.pga1+' / '+p.afe.offset*50+' mV/V / '+p.afe.pga2+
     (Number.isInteger(p.afe.bridgeSupply)?' / SVDD '+[2.4,1.6,2.0][p.afe.bridgeSupply]+' V':''):
    g==='reference'?': '+p.reference.min+'–'+p.reference.max+' '+p.reference.unit:
    g==='measurement'?': '+p.measurement.pointCount+' Punkte, '+p.measurement.samples+' Samples':
    g==='dsp'?': ±'+p.dsp.dspLimit+' Digits':g==='output'?': '+p.output.mode:'' )).join('\n');
  }
  const c=p.calibration,o=p.output;return [
  'AFE: PGA1 Stufe '+p.afe.pga1+', Offset '+(p.afe.offset*50)+' mV/V, PGA2 Stufe '+p.afe.pga2,
  'DSP: ±'+c.dspLimit+' Digits; Druckgrad '+c.sOrder+', Temperaturgrad '+c.tOrder,
  'Referenz: '+c.reference.min+' bis '+c.reference.max+' '+(c.reference.unit==='custom'?c.reference.customUnit:c.reference.unit),
  'Messpunkte: '+c.pointCount+', Samples: '+c.samples,
  'Ausgang: '+(o.mode==='onewire'?'One Wire only (nur bei bestehendem PLC)':o.mode==='keep'?'Unverändert':o.mode)+
   (['1','2','3'].includes(o.mode)?', S0 '+o.s0+' V / S1 '+o.s1+' V bei VDD '+o.vdd+' V':'')
 ].join('\n');}
 function importElmos(source,fileName,cal,protocol){
  const input=source.trim();
  let rawWords;
  if(/\.hex$/i.test(fileName)){
   rawWords=input.split(/\r?\n/).map(line=>line.split('//')[0].trim()).filter(Boolean);
  }else{
   if(/<!DOCTYPE|<!ENTITY/i.test(input))throw Error('XML mit DTD oder Entitäten wird nicht unterstützt');
   const doc=new DOMParser().parseFromString(input,'application/xml');
   if(doc.documentElement.localName!=='globalValues'||doc.querySelector('parsererror'))
    throw Error('Ungültige Elmos-PSSC-XML-Datei');
   const images=doc.querySelectorAll('chipCollection > cfgTable > MultiCfgTableEntry memFile');
   if(images.length!==1)throw Error('Die XML muss genau ein Sensor-Abbild enthalten. Den gewünschten Sensor im Elmos-GUI einzeln exportieren.');
   rawWords=Array.from(images[0].children,el=>el.localName==='hex'?el.textContent.trim():'');
  }
  if(![64,65].includes(rawWords.length)||rawWords.some(word=>!/^(?:0x)?[0-9a-f]{4}$/i.test(word)))
   throw Error('E703.11-Abbild mit 64 Hex-Wörtern und optionaler Versionskennung erwartet');
  const words=rawWords.map(word=>Number.parseInt(word,16));
  if(words.length===65&&(words[64]&0xFFF8)!==0x0020)throw Error('Das Abbild gehört nicht zum E703.11');
  if(cal.crc16(words)!==words[63]||cal.crc8(words)!==(words[15]>>>8))
   throw Error('Elmos-Abbild hat eine ungültige CRC8 oder CRC16');
  const afe=protocol.decAFE(words[28]);
  const bridgeSupply=words[27]&cal.SVDD_MASK;
  if(!protocol.goodG(afe)||bridgeSupply>2)throw Error('Das Elmos-Abbild enthält keine unterstützten AFE-Einstellungen');
  return createSelective({label:fileName.replace(/\.(xml|hex)$/i,'').trim().slice(0,80)||'Elmos-Vorlage',
   afe:{...afe,bridgeSupply}},['afe'],cal);
 }
 return {FORMAT,VERSION,GROUPS,validate,create,createSelective,describe,fileName,importElmos};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_CONFIG;
