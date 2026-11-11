/* E703.11 DSP / CM calculation module, browser-only, based on AN0203 & 25DS0170E.04.
 * This numerical fitter is an independent JS implementation, not the vendor PSSC calibration DLL.
 * Its fixed-point results MUST be verified on the target before NVM programming.
 */
'use strict';
const ELMOS_CAL = (() => {
 const q = (x,f)=> { if(!Number.isFinite(x))throw Error('Ungültiger Koeffizient');const n=Math.round(x*2**f);if(n<-32768||n>32767)throw Error(`Koeffizient ausserhalb Q${15-f}.${f}: ${x}`);return n&65535;};
 const signed = w => (w&32768)?w-65536:w;
 const fromQ=(w,f)=>signed(w)/2**f;
 function nvmCrc(words,bits=63*16,width=16,init=0xFFFF,poly=0x8005){
  let crc=init;for(let i=0;i<bits;i++){
   const b=(words[i>>4] >> (((15-(i%16))+16-width)%16))&1;
   const c=(crc>>(width-1))&1;
   crc=((crc<<1)^((b!==c)?poly:0))&((1<<width)-1);
  }return crc;
 }
 const crc16=words=>nvmCrc(words,63*16);
 const crc8=words=>nvmCrc(words,15*16+8,8,0xFF,0x07);
 const asSigned=v=>Number(v);
 function solveFit(rows,ys){ // reorthogonalized modified Gram-Schmidt QR
  const n=rows.length,k=rows[0]?.length||0;if(n<k||!k)throw Error(`Zu wenig Messpunkte: ${n} für ${k} Koeffizienten`);
  const qs=[],r=Array.from({length:k},()=>Array(k).fill(0));
  for(let j=0;j<k;j++){
   const col=rows.map(row=>row[j]),u=col.slice();
   for(let repeat=0;repeat<2;repeat++) for(let i=0;i<j;i++){
    const d=qs[i].reduce((v,x,t)=>v+x*u[t],0);r[i][j]+=d;for(let t=0;t<n;t++)u[t]-=d*qs[i][t];
   }
   const norm=Math.hypot(...u);if(norm<1e-9*Math.max(1,Math.hypot(...col)))throw Error('Messpunkte sind für den gewählten Polynomgrad nicht unabhängig. Weitere Drücke/Temperaturen aufnehmen.');
   r[j][j]=norm;qs.push(u.map(x=>x/norm));
  }
  const b=qs.map(x=>x.reduce((sum,a,i)=>sum+a*ys[i],0)),x=Array(k).fill(0);
  for(let i=k-1;i>=0;i--){let v=b[i];for(let j=i+1;j<k;j++)v-=r[i][j]*x[j];x[i]=v/r[i][i]}
  return x;
 }
 const poly=(coeffs,s,t)=>coeffs.reduce((sum,c,i)=>sum+c*(s**Math.floor(i/4))*(t**(i%4)),0);
 function fit(points, opts={}){
  const orderS=Number(opts.orderS??1),orderT=Number(opts.orderT??0);
  const pmin=Number(opts.pmin),pmax=Number(opts.pmax),outputLimit=Number(opts.outputLimit??32000);
  if(!Number.isFinite(pmin)||!Number.isFinite(pmax)||pmax<=pmin)throw Error('Druckbereich ungültig');
  if(!Number.isInteger(outputLimit)||outputLimit<1000||outputLimit>32000)throw Error('DSP-Endwert muss zwischen 1’000 und 32’000 Digits liegen');
  if(!Number.isInteger(orderS)||orderS<1||orderS>3||!Number.isInteger(orderT)||orderT<0||orderT>3)throw Error('Polynomordnung ungültig');
  const ps=points.map(r=>({...r,s:Number(r.adc_s),t:Number(r.adc_t),p:Number(r.pressure),temp:Number(r.temperature)}));
  for(const p of ps){if(!Number.isFinite(p.s)||Math.abs(p.s)>32767||!Number.isFinite(p.p)||p.p<pmin-1e-8||p.p>pmax+1e-8)throw Error('Ungültiger Messpunkt');if(orderT>0&&(!Number.isFinite(p.t)||!Number.isFinite(p.temp)||p.temp< -40||p.temp>125))throw Error('Temperaturwerte fehlen oder sind ausserhalb -40..125 °C')}
  if(ps.length<(orderS+1)*(orderT+1))throw Error(`Mindestens ${(orderS+1)*(orderT+1)} unabhängige Messpunkte nötig.`);
  const smin=Math.min(...ps.map(p=>p.s)),smax=Math.max(...ps.map(p=>p.s));
  if(smax-smin<4000)throw Error('ADC-Signalhub zu klein für eine numerisch stabile Kalibrierung. AFE anpassen.');
  // AN0203 and 25DS0170E.04 §6.3: ADC_S and DSP_S are Q0.15; S_F / S_O are Q3.12.
  // S pre-scaling uses ±0.99 at the observed end points (beware of limited headroom).
  const sf=q(1.98*32768/(smax-smin),12);
  const so=q(-fromQ(sf,12)*((smax+smin)/2)/32768,12);
  const normS=raw=>fromQ(sf,12)*raw/32768+fromQ(so,12);
  if(ps.some(p=>Math.abs(normS(p.s))>0.999))throw Error('S-Normalisierung nach Quantisierung übersteuert.');
  let tf=null,to=null;
  if(orderT>0){
   const lo=Math.min(...ps.map(p=>p.t)),hi=Math.max(...ps.map(p=>p.t));
   if(hi-lo<500)throw Error('ADC_T-Signalhub zu klein für Temperaturkompensation.');
   tf=q(1.70*32768/(hi-lo),12);
   to=q(-fromQ(tf,12)*(hi+lo)/(2*32768),12);
  }
  // When no temperature order is requested the existing chip T_O/T_F, T0..T3 are preserved.
  const normT=raw=>orderT>0?fromQ(tf,12)*raw/32768+fromQ(to,12):0;
  const keys=[];for(let i=0;i<=orderS;i++)for(let j=0;j<=orderT;j++)keys.push(i*4+j);
  const rows=ps.map(p=>keys.map(k=>normS(p.s)**Math.floor(k/4)*normT(p.t)**(k%4)));
  const y=ps.map(p=>(2*outputLimit*(p.p-pmin)/(pmax-pmin)-outputLimit)/32768);
  const fitted=solveFit(rows,y);const regs=Array(16).fill(0);fitted.forEach((v,i)=>regs[keys[i]]=q(v,15));
  const decoded=regs.map(v=>fromQ(v,15));
  const errors=ps.map((p,i)=>(poly(decoded,normS(p.s),normT(p.t))*32768-y[i]*32768));
  const rms=Math.hypot(...errors)/Math.sqrt(errors.length),max=Math.max(...errors.map(Math.abs));
  const maxOutput=Math.max(...ps.map(p=>Math.abs(poly(decoded,normS(p.s),normT(p.t)))));
  if(maxOutput>=1)throw Error('DSP-Ausgang würde übersteuern. Andere Koeffizienten/Skalierung nötig.');
  let tRegs=null,tErrors=[];
  if(orderT>0){
   const trows=ps.map(p=>Array.from({length:orderT+1},(_,i)=>normT(p.t)**i));
   const ty=ps.map(p=>(387.88*p.temp-16485)/32768);
   const fittedT=solveFit(trows,ty);tRegs=Array(4).fill(0);fittedT.forEach((v,i)=>tRegs[i]=q(v,15));
   tErrors=ps.map((p,i)=>32768*(tRegs.reduce((s,v,k)=>s+fromQ(v,15)*normT(p.t)**k,0)-ty[i]));
  }
  return {method:'browser-independent-polynomial-fit',points:ps.length,orderS,orderT,outputLimit,registers:{so,sf,coeffs:regs,to,tf,tcoeffs:tRegs},stats:{maxDigits:max,rmsDigits:rms,maxTemperatureDigits:tErrors.length?Math.max(...tErrors.map(Math.abs)):null,rangeDigits:smax-smin,maxNormalized:Math.max(...ps.map(p=>Math.abs(normS(p.s)))),maxOutput},errors,coefficients:decoded,note:'Q3.12/Q0.15 nach Datenblatt; numerischer JavaScript-Fit, nicht identisch mit der Elmos-Kalibrier-DLL. Vor Programmierung RAM/DSP-Verifikation notwendig.'};
 }
 function prepareOutputConfig(original,settings,outputLimit=32000){
  if(!Array.isArray(original)||original.length!==64)throw Error('Vollständiges NVM-Abbild erforderlich');
  const out=original.slice();
  if(!settings||settings.mode==='keep')return out;
  const mode=Number(settings.mode),scaleEnabled=settings.scaleEnabled===true,period=Number(settings.pwmPeriod);
  if(!Number.isInteger(mode)||mode<0||mode>6)throw Error('Ungültiger oder nicht unterstützter AODO-Ausgangsmodus');
  if(mode===4&&(!Number.isInteger(period)||period<2||period>65535))throw Error('PWM-Periode muss 2–65’535 Takte betragen');
  const gain=Number(settings.gain),offset=Number(settings.offset);
  if(scaleEnabled&&(!Number.isFinite(gain)||!Number.isFinite(offset)))throw Error('AODO-Gain/Offset sind ungültig');
  const effectiveLimit=Number(outputLimit);
  if(!Number.isFinite(effectiveLimit)||effectiveLimit<=0||effectiveLimit>32767)throw Error('DSP-Zielbereich ungültig');
  if(mode>=1&&mode<=5){
   if((mode===4||mode===5)&&!scaleEnabled)throw Error('PWM/FM benötigt positive DSP_AODO-Werte: AODO-Skalierung einschalten und sicher einstellen');
   const values=scaleEnabled?[
    offset*32768-gain*effectiveLimit,offset*32768+gain*effectiveLimit
   ]:[-effectiveLimit,effectiveLimit];
   const min=Math.min(...values),max=Math.max(...values);
   if(mode<=3&&(min< -26214||max>26214))throw Error('Analogausgang: für 10–90 % VDD muss DSP_AODO innerhalb von ±26’214 Digits liegen. AODO-Skalierung anpassen.');
   if(mode===4&&(min<period*0.10||max>period*0.90))throw Error('PWM: DSP_AODO muss für den ganzen Druckbereich innerhalb 10–90 % der PWM-Periode liegen.');
   if(mode===5&&(min<2||max>32767))throw Error('FM: DSP_AODO muss über den ganzen Bereich zwischen 2 und 32’767 Digits liegen.');
  }
  // Only documented AODO mode bits and output-scaling bit may change in CFG_EN.
  out[16]=(out[16]&~((7<<9)|(1<<6)))|(mode<<9)|(scaleEnabled?(1<<6):0);
  if(mode>=1&&mode<=3)out[22]=0x0880;
  if(mode===4)out[22]=period;
  if(mode===5)out[22]=0x4200;
  if(scaleEnabled){out[57]=q(offset,12);out[58]=q(gain,12);}
  if(original.slice(0,16).some((v,i)=>v!==out[i]))throw Error('Factory-Bereich darf nicht verändert werden');
  for(let i=17;i<28;i++)if(i!==22&&out[i]!==original[i])throw Error('Geschützte Kommunikation verändert');
  return out;
 }
  function configFrom(original,solution,afeWord,opts={}){
  if(!Array.isArray(original)||original.length!==64||original.some(v=>!Number.isInteger(v)||v<0||v>65535))throw Error('NVM-Abbild muss exakt 64 gültige 16-Bit-Wörter enthalten');
  const cfg=prepareOutputConfig(original,opts.output,solution.outputLimit??32000),r=solution.registers;
  // Reserved/factory and ALL boot/interface words 0..27 are carried over bit-for-bit.
  cfg[28]=(cfg[28]&~0x7FF)|(afeWord&0x7FF); // only AFE gain/offset bits
  cfg[33]=r.so;cfg[34]=r.sf;for(let i=0;i<16;i++)cfg[35+i]=r.coeffs[i];
  if(r.tcoeffs){cfg[31]=r.to;cfg[32]=r.tf;for(let i=0;i<4;i++)cfg[51+i]=r.tcoeffs[i]}
  cfg[63]=crc16(cfg);
  for(let i=0;i<=27;i++)if(cfg[i]!==original[i]&&![16,22].includes(i))throw Error('Sicherheitsfehler: schreibgeschützter NVM-Bereich verändert');
  if(cfg[16]!==original[16]&&(((cfg[16]^original[16])&~((7<<9)|(1<<6)))!==0))throw Error('CFG_EN: fremde Bits dürfen nicht verändert werden');
  if(cfg.slice(0,16).some((v,i)=>v!==original[i]))throw Error('Werkskalibrierung verändert');
  return {before:original.slice(),after:cfg,changes:cfg.map((v,i)=>v!==original[i]?{index:i,address:i*2,from:original[i],to:v}:null).filter(Boolean)};
 }
 return {fit,solveFit,crc16,crc8,configFrom,prepareOutputConfig,fromQ,q,signed};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_CAL;
