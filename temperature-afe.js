"use strict";
// E703.11 Rev 04 tables 4.4-1, 4.5.2-1, 6.5.1.3 and section 6.2.2.4.
// Nominal engineering model; DLL and hardware parity not yet established.
function buildTemperatureAFE(){
 const SUPPLIES=[2.4,1.6,2.0],SUPPLY_LIMITS=[[2.2,2.6],[1.4,1.8],[1.8,2.2]];
 const G2=[28,19,13,9,6,4,3,2],I_MIN=[1.119,.759,.520,.360,.240,.160,.120,.089],I_MAX=[2.74,2.066,1.414,.979,.652,.435,.326,.217];
 const MUX_MIN=.425,MUX_MAX=1.0,REF=.65,ADC_SCALE=32768;
 const assert=(ok,msg)=>{if(!ok)throw new RangeError(msg)};
 const pos=(x,name)=>{assert(Number.isFinite(x)&&x>0,name+' muss positiv und endlich sein.');return x};
 const finite=(x,name)=>{assert(Number.isFinite(x),name+' muss endlich sein.');return x};
 function rpga(code){
  assert(Number.isInteger(code)&&code>=0&&code<16,'Ungültiger br_gain-Code.');
  const i=code>>1,g1=code&1?9/11:1,g2=G2[i];
  return {code,g1,g2,i2u:9000/(g1*g2),minCurrent:I_MIN[i],maxCurrent:I_MAX[i]};
 }
 function equivalent(b,p){pos(b,'Brücke');if(p==null)return b;pos(p,'Parallelwiderstand');return 1/(1/b+1/p)}
 function linearRange({bridgeOhm,parallelOhm=null,bridgeTcr=0,parallelTcr=0,reference=25,minTemp,maxTemp,bridgeTolerance=0,parallelTolerance=0}){
  pos(bridgeOhm,'Brücke');if(parallelOhm!=null)pos(parallelOhm,'Parallelwiderstand');
  [bridgeTcr,parallelTcr,reference,minTemp,maxTemp,bridgeTolerance,parallelTolerance].forEach((v,i)=>finite(v,'Parameter '+i));
  assert(minTemp<=maxTemp,'Temperaturbereich ungültig.');assert(bridgeTolerance>=0&&bridgeTolerance<100&&parallelTolerance>=0&&parallelTolerance<100,'Toleranz ausserhalb 0–100 %.');
  const b0=bridgeOhm,b1=b0*bridgeTcr/1e6,p0=parallelOhm,p1=p0==null?0:p0*parallelTcr/1e6;
  const ends=[minTemp-reference,maxTemp-reference],values=[];
  for(const bf of [1-bridgeTolerance/100,1+bridgeTolerance/100])for(const pf of [1-parallelTolerance/100,1+parallelTolerance/100]){
   const B0=b0*bf,B1=b1*bf,P0=p0==null?null:p0*pf,P1=p1*pf;
   const ts=ends.slice();
   if(P0!=null&&B1*P1<0){
    const ratio=Math.sqrt(-P1/B1),den=P1-ratio*B1;
    if(den!==0){const t=(ratio*B0-P0)/den;if(t>ends[0]&&t<ends[1])ts.push(t)}
   }
   for(const t of ts){const b=B0+B1*t,p=P0==null?null:P0+P1*t;values.push(equivalent(b,p))}
  }
  return {minOhm:Math.min(...values),maxOhm:Math.max(...values),nominalOhm:equivalent(b0,p0),
   effectiveTcr:p0==null?bridgeTcr:(p0*bridgeTcr+b0*parallelTcr)/(b0+p0)};
 }
 function signal({resistanceOhm,svdd,code}){
  pos(resistanceOhm,'Gesamtwiderstand');pos(svdd,'SVDD');const gain=rpga(code),current=svdd/resistanceOhm*1000,mux=current*gain.i2u/1000;
  const adcVoltage=(mux-REF)*2,adcIdeal=adcVoltage*ADC_SCALE;
  return {current,mux,adcVoltage,adcIdeal,adc:Math.round(adcIdeal),valid:mux>=MUX_MIN&&mux<=MUX_MAX&&current>=gain.minCurrent&&current<=gain.maxCurrent};
 }
 function estimate({adc,svdd,afe0,afe2}){
  assert(Number.isInteger(adc)&&adc>=-32768&&adc<=32767,'ADC_T muss ein signed 16-Bit-Wert sein.');
  pos(svdd,'SVDD');assert(Number.isInteger(afe0)&&afe0>=0&&afe0<=65535&&Number.isInteger(afe2)&&afe2>=0&&afe2<=65535,'Gültige AFE-Register erforderlich.');
  assert((afe2&0x0fff)===0x014a,'Brückentemperatur benötigt t_adc_src=2, TPGA1=2, TPGA2=1 sowie ADC_TC-Standardgains.');
  const code=(afe0>>4)&15,g=rpga(code),mux=REF+adc/(ADC_SCALE*2),current=mux*1000/g.i2u;
  return {mux,current,resistanceOhm:current>0?svdd/current*1000:null,valid:adc!==-32768&&adc!==32767&&mux>=MUX_MIN&&mux<=MUX_MAX&&current>=g.minCurrent&&current<=g.maxCurrent,code};
 }
 // Automatic probing uses raw ADC_T, not DSP_T or a simulated model value.
 // Independent datasheet limits, not a statistical confidence interval.
 function resistanceBounds({adc,svddCode,afe0,afe2}){
  const nominal=estimate({adc,svdd:SUPPLIES[svddCode],afe0,afe2});
  assert(nominal.valid,'Nur gültiger ADC_T für Widerstandsgrenzen.');
  const [vMin,vMax]=SUPPLY_LIMITS[svddCode],g=rpga(nominal.code),d=adc/65536;
  const voltages=[.6,.7].flatMap(ref=>[.96*.96,1.04*1.04].map(gain=>ref+d/gain));
  const lo=Math.min(...voltages),hi=Math.max(...voltages);
  return {minOhm:vMin*g.i2u*(8/9)/hi,maxOhm:vMax*g.i2u*(10/9)/lo,nominalOhm:nominal.resistanceOhm};
 }
 function probeOrder({svddCode,resistanceOhm}){
  assert([0,1,2].includes(svddCode),'Ungültiger SVDD-Code.');
  const candidates=Array.from({length:16},(_,i)=>rpga(i));
  if(Number.isFinite(resistanceOhm)&&resistanceOhm>0){
   const score=g=>Math.abs(SUPPLIES[svddCode]/resistanceOhm*g.i2u-.65);
   return candidates.sort((a,b)=>score(a)-score(b)||a.i2u-b.i2u).map(g=>g.code);
  }
  return candidates.sort((a,b)=>a.i2u-b.i2u).map(g=>g.code);
 }
 function assessProbe({samples,svdd,afe0,afe2,maxSpread=350}){
  assert(Array.isArray(samples)&&samples.length>=5&&samples.every(v=>Number.isInteger(v)&&v>=-32768&&v<=32767),'Mindestens fünf gültige ADC_T-Rohwerte erforderlich.');
  const ordered=samples.slice().sort((a,b)=>a-b),adc=ordered[Math.floor(ordered.length/2)],spread=ordered.at(-1)-ordered[0];
  const saturated=ordered.some(v=>v===-32768||v===32767);
  const estimates=ordered.map(v=>estimate({adc:v,svdd,afe0,afe2}));
  const value=estimate({adc,svdd,afe0,afe2});
  return {...value,adc,spread,saturated,valid:!saturated&&spread<=maxSpread&&estimates.every(v=>v.valid),samples:samples.slice()};
 }
 function plan({minOhm,maxOhm,svddCode,fullSupplyTolerance=true}){
  pos(minOhm,'R min');pos(maxOhm,'R max');assert(minOhm<=maxOhm,'R min muss kleiner oder gleich R max sein.');
  assert(Number.isInteger(svddCode)&&svddCode>=0&&svddCode<=2,'Ungültiger SVDD-Code.');
  const v=SUPPLIES[svddCode],[vMin,vMax]=fullSupplyTolerance?SUPPLY_LIMITS[svddCode]:[v,v];
  const iMin=vMin/maxOhm*1000,iMax=vMax/minOhm*1000;
  const candidates=Array.from({length:16},(_,code)=>{
   const g=rpga(code),muxMin=iMin*g.i2u/1000,muxMax=iMax*g.i2u/1000;
   const headroom=Math.min(muxMin-MUX_MIN,MUX_MAX-muxMax),currentOK=iMin>=g.minCurrent&&iMax<=g.maxCurrent;
   const valid=currentOK&&headroom>=0;
   return {...g,iMin,iMax,muxMin,muxMax,adcMin:Math.round((muxMin-REF)*2*ADC_SCALE),adcMax:Math.round((muxMax-REF)*2*ADC_SCALE),headroom,currentOK,valid,
    afe0Bits:(code<<4)|svddCode,afe2Bits:0x014a,correctionBits:0x1008};
  });
  const eligible=candidates.filter(x=>x.valid).sort((a,b)=>b.headroom-a.headroom||(b.adcMax-b.adcMin)-(a.adcMax-a.adcMin)||a.code-b.code);
  return {svdd:v,vMin,vMax,iMin,iMax,best:eligible[0]||null,candidates};
 }
 function merge({afe0,afe2,cfgEn,code,svddCode}){
  [afe0,afe2,cfgEn].forEach(v=>assert(Number.isInteger(v)&&v>=0&&v<=65535,'Register ungültig.'));
  rpga(code);assert([0,1,2].includes(svddCode),'Ungültiger SVDD-Code.');
  return {afe0:(afe0&~0x00f3)|(code<<4)|svddCode,afe2:(afe2&~0x0fff)|0x014a,cfgEn:(cfgEn&~0x100c)|0x1008};
 }
 // DS rev.04 pp.53–64: only known incompatibilities are errors;
 // electrical recommendations and startup routing uncertainty are warnings.
 function validateProfile({source,afe0,afe2,cfgEn,pads0,pads1,pads2,spiI2c,biasMode,vdd}){
  const errors=[],warnings=[],check=(ok,msg)=>{if(!ok)errors.push(msg)};
  const word=x=>Number.isInteger(x)&&x>=0&&x<=65535;
  if(![afe0,afe2,cfgEn,pads0,pads1,pads2,spiI2c].every(word))return {errors:['Vollständige 16-Bit-Konfigurationswörter erforderlich.'],warnings};
  check(['bridge','external'].includes(source),'Unbekannte DEV-Temperaturquelle.');
  check((afe0&0xfe0c)===0x0c00,'CFG_AFE0: Pflicht-/reservierte Bits entsprechen nicht dem Datenblatt.');
  check((afe0&3)!==3,'CFG_AFE0.br_supply=3 ist reserviert.');
  check((afe2&0xf000)===0x1000,'CFG_AFE2[15:12] muss 0b0001 sein.');
  check((cfgEn&0x8010)===0x0010,'CFG_EN: Bit 15 muss 0, Bit 4 muss 1 sein.');
  check((cfgEn&3)===0||(cfgEn&3)===2,'CFG_EN.s_cor_en ist reserviert.');
  check((afe2&0x03c0)===0x0140,'ADC_TC benötigt die vorgeschriebenen Standardgains.');
  check((cfgEn&0x100c)===(source==='bridge'?0x1008:0x1004),'Temperaturkorrektur/absolute Temperatur passt nicht zur Quelle.');
  if(source==='bridge')check((afe2&0x0fff)===0x014a,'PTC benötigt werkstrimm-kompatible Gains, keine Invertierung oder EOC-Bias.');
  if(source==='external'){
   check((afe2&3)===3,'EOC-Temperaturquelle fehlt.');
   check((afe2&0x0400)===0,'DEV-EOC-Modell setzt nicht invertierten ADC_T voraus.');
   if(biasMode!==undefined)check([0,1].includes(biasMode)&&!!(afe2&0x0800)===!!biasMode,'EOC-Diodenstrom passt nicht zur gewählten Beschaltung.');
   const bus=spiI2c&3,sda=(pads2>>9)&3,route=(pads2>>7)&3,start=(pads0>>14)&3;
   check(!(sda===2&&(bus===1||bus===2)),'EOC ist gleichzeitig I²C-SDA.');
   // Inactive routing with zero status mask is reported, not treated as
   // proven electrical contention. Active conflicts are blocked.
   if(route===0){if(pads0&0x0fff)errors.push('Aktive EoC-Statusausgabe kollidiert mit externem Temperatureingang.');else warnings.push('EoC-Ausgang ist auf EOC geroutet, aber Statusmaske ist 0. Datenblatt empfiehlt anderen freien Pin; keine aktive Statusausgabe nachgewiesen.');}
   check(!(route===1&&(pads0&0x0fff)&&(bus===1||bus===3)),'EoC-Ausgang NCS/SA0 kollidiert mit I²C/SPI.');
   check(!(route===2&&(pads0&0x0fff)&&(bus===3||((bus===1||bus===2)&&sda===1))),'EoC-Ausgang MOSI kollidiert mit I²C/SPI.');
   check(!(route===3&&((cfgEn>>9)&7)!==0),'EoC-Ausgang AODO kollidiert mit konfiguriertem AODO-Ausgang.');
   if(start===0)warnings.push('EOC dient beim Start auch der I²C/SPI-Auswahl. Beschaltung beim Neustart prüfen.');
   if((pads1&8)===0)warnings.push('EOC-Bus-Holder ist aktiv. Einfluss auf externe Temperaturspannung prüfen.');
  }
  if((afe0&3)===0&&Number.isFinite(vdd)&&vdd<3)errors.push('SVDD 2.4 V erfordert VDD ≥ 3.0 V.');
  return {errors,warnings};
 }
 function correctedBridgeTemperature(adcT,adcTC,g01,g2off){
 if(![adcT,adcTC].every(v=>Number.isFinite(v)&&v>=-32768&&v<=32767))throw RangeError("ADC_T und ADC_TC als gültige signed 16-Bit-Rohwerte erforderlich.");
 if(![g01,g2off].every(v=>Number.isInteger(v)&&v>=0&&v<=65535))throw RangeError("Originale G01/G2OFF-Wörter erforderlich.");
 const s8=v=>v&128?v-256:v;
 const g0=s8(g01&255)/2048,g1=s8((g01>>8)&255)/1024,g2=s8(g2off&255)/2048,goff=s8((g2off>>8)&255)/32;
 const tc=adcTC/32768,k=g0+g1*tc+g2*tc*tc;
 return adcT+(adcT+goff*32768)*k;
}
function fitBridgeOffline(points,opts={},factory,fit){
 if(!factory||!Number.isInteger(factory.afe2)||(factory.afe2&0x0fff)!==0x014a||
    !Number.isInteger(factory.cfgEn)||(factory.cfgEn&12)!==8)
  throw Error("Brückenquelle, werkseitige TPGA/ADC_TC-Gains und Shunt-Kompensation erforderlich.");
 if(typeof fit!=="function")throw Error("Druck-/Temperatur-Fitfunktion fehlt.");
 const adjusted=points.map(p=>{
  if(p.temperatureSource!=="bridge")throw Error("Messpunkt gehört nicht zur Brückentemperaturquelle.");
  const value=correctedBridgeTemperature(p.adc_t,p.adc_tc,factory.g01,factory.g2off);
  if(value< -32768||value>32767)throw Error("Korrigierter Temperaturrohwert ausserhalb 16-Bit-Bereich.");
  return {...p,adc_t:value,rawAdcT:p.adc_t};
 });
 const result=fit(adjusted,opts);
 return {...result,temperatureSource:"bridge",temperatureCorrection:"dll-reference-float-model",correctedTemperatureDigits:adjusted.map(x=>x.adc_t),rawTemperatureDigits:adjusted.map(x=>x.rawAdcT),factoryWords:{g01:factory.g01,g2off:factory.g2off},offlineOnly:true};
}
 return Object.freeze({SUPPLIES,SUPPLY_LIMITS,rpga,equivalent,linearRange,signal,estimate,validateProfile,resistanceBounds,probeOrder,assessProbe,plan,merge,correctedBridgeTemperature,fitBridgeOffline});
}
const ELMOS_TEMPERATURE_AFE=buildTemperatureAFE();
if(typeof module!=="undefined"&&module.exports)module.exports=ELMOS_TEMPERATURE_AFE;
if(typeof window!=="undefined")window.ELMOS_TEMPERATURE_AFE=ELMOS_TEMPERATURE_AFE;

// EOC source: DS 25DS0170E.04 sections 3.3, 4.5.2, 6.2.2.3–7 and 7.2.1.
// Nominal voltage-to-ADC model with conservative reference/gain bounds for selection.
const ELMOS_EXTERNAL_AFE=(()=>{
 const g1=[1,1.5,2,3],g2=[1,2,3,5];
 const voltage=(p,t)=>(p.eocMv+(t-25)*p.eocSlope)/1000;
 function signal(v,i,j){return Math.round((v-.65)*g1[i]*g2[j]*32768);}
 function plan(p){
  if(![p.eocMv,p.eocSlope,p.eocTolerance,p.minTemp,p.maxTemp].every(Number.isFinite)||p.eocSlope===0||p.eocTolerance<0||p.minTemp>=p.maxTemp)throw Error('EOC: gültige Spannung, Steigung, Toleranz und Temperaturgrenzen eingeben.');
  const endpoints=[voltage(p,p.minTemp),voltage(p,p.maxTemp)],min=Math.min(...endpoints)-p.eocTolerance/1000,max=Math.max(...endpoints)+p.eocTolerance/1000;
  const candidates=[];for(let i=0;i<4;i++)for(let j=0;j<4;j++){const a=g1[i]*1.04,b=g2[j]*1.04,low=Math.max(.2,.7-.45/a,.7-.7/(a*b)),high=Math.min(1.2,.6+.75/a,.6+.7/(a*b));candidates.push({i,j,g1:g1[i],g2:g2[j],low,high,valid:min>=low&&max<=high,reserve:Math.min(min-low,high-max)});}
  const best=candidates.filter(c=>c.valid).sort((a,b)=>b.g1*b.g2-a.g1*a.g2||b.g1-a.g1||b.reserve-a.reserve)[0]||null;
  const samples=Array.from({length:33},(_,i)=>{const temp=p.minTemp+(p.maxTemp-p.minTemp)*i/32;return {temp,voltage:voltage(p,temp)}});
  return {min,max,best,candidates,samples};
 }
 function envelope(p,v,g){const values=[];for(const vref of [.6,.7])for(const u of [v-p.eocTolerance/1000,v+p.eocTolerance/1000])for(const a of [.96,1.04])for(const b of [.96,1.04])values.push(Math.round((u-vref)*g.g1*a*g.g2*b*32768));return {lo:Math.min(...values),hi:Math.max(...values),nom:signal(v,g.i,g.j)};}
 function merge(afe2,p,g){if(!Number.isInteger(afe2)||afe2<0||afe2>65535||![0,1].includes(p.eocBias)||!Number.isInteger(g?.i)||!Number.isInteger(g?.j)||g.i<0||g.i>3||g.j<0||g.j>3)throw Error('Ungültige EOC-Verstärkung oder Beschaltung.');return (afe2&~0x0fff)|0x0140|(p.eocBias?0x0800:0)|(g.j<<4)|(g.i<<2)|3;}
 function assessSamples(samples){
  if(!Array.isArray(samples)||samples.length<5||samples.some(v=>!Number.isInteger(v)||v< -32768||v>32767))throw Error('Gültige ADC_T-Messreihe erforderlich.');
  const sorted=samples.slice().sort((a,b)=>a-b),adc=sorted[Math.floor(sorted.length/2)],spread=sorted.at(-1)-sorted[0];
  return {adc,spread,samples:samples.slice(),saturated:samples.some(v=>v===-32768||v===32767),outsideRecommended:samples.some(v=>Math.abs(v)>23593),unstable:spread>350};
 }
 return {plan,voltage,signal,envelope,merge,assessSamples};
})();
if(typeof window!=='undefined')window.ELMOS_EXTERNAL_AFE=ELMOS_EXTERNAL_AFE;
