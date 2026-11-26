/* E703.11 DSP / CM calculation module, browser-only, based on AN0203 & 25DS0170E.04.
 * This numerical fitter is an independent JS implementation, not the vendor PSSC calibration DLL.
 * Its fixed-point results MUST be verified on the target before NVM programming.
 */
'use strict';
const ELMOS_CAL = (() => {
 const q = (x,f,name='Koeffizient')=> {
  if(!Number.isFinite(x))throw Error('Ungültiger Koeffizient: '+name);
  const n=Math.round(x*2**f);
  if(n<-32768||n>32767){
   const min=-32768/2**f,max=32767/2**f,format='Q'+(15-f)+'.'+f;
   const error=Error(name+' ausserhalb '+format+': '+x+' (zulässig '+min+' bis '+max+')');
   error.code='COEFFICIENT_OUT_OF_RANGE';
   error.coefficient={name,value:x,format,min,max};
   throw error;
  }
  return n&65535;
 };
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
 // E703.11 datasheet: CFG_AFE2 (0x1E), bits [1:0] select temperature source.
 // AN0203: DSP_T target = 387.88 * temperature(°C) - 16485.
 // Raw ADC_T alone is not an absolute Celsius reading.
 const dspTemperatureCelsius=raw=>{
  if(!Number.isInteger(raw)||raw< -32768||raw>32767)return null;
  return (raw+16485)/387.88;
 };
 // Factory E703.11 example profile, datasheet 25DS0170E.04 (Nov 2023),
 // NVM example T0..T3; DSP_T is then expressed in units of 0.01 °C.
 // Not production-trimmed or accuracy-guaranteed by Elmos.
 const factoryTemperatureRegisters=Object.freeze({0x6C:0x0000,0x6E:0x1000,0x94:0x0F4D,0x96:0xBC8E,0x98:0xFC54,0x9A:0x0000});
 const factoryTemperatureAddresses=Object.keys(factoryTemperatureRegisters).map(Number);
 // NVM word indices map to the *working RAM register addresses*, not NVM
 // byte addresses. Only the temperature calibration fingerprint is compared.
 const programmedTemperatureWordMap=Object.freeze([
  [31,0x6C],[32,0x6E],[51,0x94],[52,0x96],[53,0x98],[54,0x9A]
 ]);
 const programmedTemperatureAddresses=programmedTemperatureWordMap.map(pair=>pair[1]);
 const programmedTemperatureProfileMatches=(snapshot,uid,registers)=>{
  if(!snapshot||typeof uid!=='string'||!(/^[0-9A-Fa-f]{12}$/).test(uid)||String(snapshot.id||'').toUpperCase()!==uid.toUpperCase())return false;
  if(snapshot.restore===true||!Array.isArray(snapshot.words)||snapshot.words.length!==64)return false;
  if(!snapshot.words.every(word=>Number.isInteger(word)&&word>=0&&word<=0xFFFF))return false;
  if(snapshot.temperatureBasis!==undefined&&snapshot.temperatureBasis!=='an0203-celsius-v1')return false;
  if(snapshot.words[63]!==crc16(snapshot.words))return false;
  const serial=uid.toUpperCase();
  if(snapshot.words[0].toString(16).toUpperCase().padStart(4,'0')!==serial.slice(8))return false;
  if(snapshot.words[1].toString(16).toUpperCase().padStart(4,'0')!==serial.slice(4,8))return false;
  if(!(snapshot.words[16]&0x1000)||(snapshot.words[29]&3)!==0)return false;
  // Never call an empty/constant factory profile an AN0203 calibration.
  if(![52,53,54].some(index=>snapshot.words[index]!==0))return false;
  if(isFactoryTemperatureProfile(registers))return false;
  return programmedTemperatureWordMap.every(([word,address])=>
   Number.isInteger(registers?.[address])&&registers[address]===snapshot.words[word]);
 };
 const isFactoryTemperatureProfile=registers=>!!registers&&factoryTemperatureAddresses.every(address=>
  Number.isInteger(registers[address])&&registers[address]===factoryTemperatureRegisters[address]);
 const factoryInternalTemperatureCelsius=(adcT,registers)=>{
  if(!Number.isInteger(adcT)||adcT< -32768||adcT>32767||!isFactoryTemperatureProfile(registers))return null;
  const x=adcT/32768;
  const raw=fromQ(registers[0x94],15)*32768+
   fromQ(registers[0x96],15)*32768*x+
   fromQ(registers[0x98],15)*32768*x*x+
   fromQ(registers[0x9A],15)*32768*x*x*x;
  return raw/100;
 };
 const temperatureSourceFromAfe2=word=>{
  if(!Number.isInteger(word)||word<0||word>0xFFFF)throw Error('CFG_AFE2 ist kein gültiges 16-Bit-Register');
  return ['internal','reserved','bridge','external'][word&3];
 };
 const poly=(coeffs,s,t)=>coeffs.reduce((sum,c,i)=>sum+c*(s**Math.floor(i/4))*(t**(i%4)),0);
 // AN0203 §2.2: d_DSP_S = 640*P[%] - 32000.
 // Preserve an explicitly chosen smaller DSP range, but never conflate DSP_S
 // limits with the ADC_S headroom. P is always normalized to full-scale %.
 function elmosDspTarget(pressure,pmin=0,pmax=100,limit=32000){
  if(![pressure,pmin,pmax,limit].every(Number.isFinite)||pmax<=pmin||
     !Number.isInteger(limit)||limit<1000||limit>32000||
     pressure<pmin-1e-9||pressure>pmax+1e-9)
   throw Error('AN0203: Ungültiger Referenzdruck oder DSP-Endwert');
  return 2*limit*(pressure-pmin)/(pmax-pmin)-limit;
 }
 const elmosTemperatureTarget=degreesC=>{
  if(!Number.isFinite(degreesC)||degreesC< -40||degreesC>125)
   throw Error('AN0203: Temperaturreferenz ausserhalb -40..125 °C');
  return 387.88*degreesC-16485;
 };
 function fit(points, opts={}){
  const orderS=Number(opts.orderS??1),orderT=Number(opts.orderT??0);
   // Three-point TK0 uses no pressure-temperature interaction (S*T).
   // The complete linear 2x2 model also compensates TKE.
   const fitMode=opts.fitMode??'full';
   if(!['full','tk0'].includes(fitMode))throw Error('Unbekanntes Temperaturmodell');
   if(fitMode==='tk0'&&(orderS!==1||orderT!==1))
    throw Error('TK0 benötigt Druckordnung 1 und Temperaturordnung 1 (linear). Ohne Temperaturkorrektur darf kein TK0-Abgleich berechnet werden.');
  const pmin=Number(opts.pmin),pmax=Number(opts.pmax),outputLimit=Number(opts.outputLimit??32000);
  if(!Number.isFinite(pmin)||!Number.isFinite(pmax)||pmax<=pmin)throw Error('Druckbereich ungültig');
  if(!Number.isInteger(outputLimit)||outputLimit<1000||outputLimit>32000)throw Error('DSP-Endwert muss zwischen 1’000 und 32’000 Digits liegen');
  if(!Number.isInteger(orderS)||orderS<1||orderS>3||!Number.isInteger(orderT)||orderT<0||orderT>3)throw Error('Polynomordnung ungültig');
  const allPoints=points.map(r=>({...r,s:r.adc_s,t:r.adc_t,p:r.pressure,temp:r.temperature}));
  for(const p of allPoints){if(!Number.isFinite(p.s)||(p.s< -32768||p.s>32767)||!Number.isFinite(p.p)||p.p<pmin-1e-8||p.p>pmax+1e-8)throw Error('Ungültiger Messpunkt');if(orderT>0&&(!Number.isFinite(p.t)||p.t< -32768||p.t>32767||!Number.isFinite(p.temp)||p.temp< -40||p.temp>125))throw Error('Temperaturwerte fehlen oder sind ausserhalb -40..125 °C')}
  // A pressure-only fit must not silently use hot/cold pressure readings together.
  // Keep all measured references, but fit only a full pressure series at one temperature.
  let ps=allPoints;
  if(orderT===0&&allPoints.every(p=>Number.isFinite(p.temp))&&allPoints.some(p=>Math.abs(p.temp-allPoints[0].temp)>0.5)){
   const levels=[...new Set(allPoints.map(p=>p.temp))];
   const candidate=levels.map(temp=>allPoints.filter(p=>Math.abs(p.temp-temp)<=0.5))
    .find(group=>new Set(group.map(p=>p.p.toFixed(6))).size>=orderS+1&&
     group.some(p=>Math.abs(p.p-pmin)<1e-6)&&group.some(p=>Math.abs(p.p-pmax)<1e-6));
   if(!candidate)throw Error('Ohne Temperaturkompensation wird eine vollständige Druckmessreihe bei einer Referenztemperatur benötigt (unterer und oberer Druckpunkt).');
   ps=candidate;
  }
  const keys=fitMode==='tk0'?[0,1,4]:
    Array.from({length:(orderS+1)*(orderT+1)},(_,index)=>
     Math.floor(index/(orderT+1))*4+index%(orderT+1));
   if(ps.length<keys.length)throw Error(`Mindestens ${keys.length} unabhängige Messpunkte nötig.`);
  const smin=Math.min(...ps.map(p=>p.s)),smax=Math.max(...ps.map(p=>p.s));
  if(smax-smin<4000)throw Error('ADC-Signalhub zu klein für eine numerisch stabile Kalibrierung. AFE anpassen.');
  // AN0203 and 25DS0170E.04 §6.3: ADC_S and DSP_S are Q0.15; S_F / S_O are Q3.12.
  // Use ±0.99 where representable. For smaller spans let the coefficient
  // range and fit error checks determine whether the requested target fits.
  const maxQ3Gain=32767/4096;
  const sf=q(Math.min(1.98*32768/(smax-smin),maxQ3Gain),12,'S_F');
  const so=q(-fromQ(sf,12)*((smax+smin)/2)/32768,12,'S_O');
  const normS=raw=>fromQ(sf,12)*raw/32768+fromQ(so,12);
  if(ps.some(p=>Math.abs(normS(p.s))>0.999))throw Error('S-Normalisierung nach Quantisierung übersteuert.');
  let tf=null,to=null;
  if(orderT>0){
   const lo=Math.min(...ps.map(p=>p.t)),hi=Math.max(...ps.map(p=>p.t));
   if(!(hi>lo))throw Error('ADC_T ist bei den Temperaturreferenzen nicht unterscheidbar. Temperaturkompensation nicht zuverlässig berechenbar.');
   // Avoid an arbitrary 500-digit gate: constrain the actual Q3.12 gain and
   // let the coefficient quantization and numerical rank checks determine validity.
   tf=q(Math.min(1.70*32768/(hi-lo),32767/4096),12,'T_F');
   to=q(-fromQ(tf,12)*(hi+lo)/(2*32768),12,'T_O');
  }
  // When no temperature order is requested the existing chip T_O/T_F, T0..T3 are preserved.
  const normT=raw=>orderT>0?fromQ(tf,12)*raw/32768+fromQ(to,12):0;
  
  const rows=ps.map(p=>keys.map(k=>normS(p.s)**Math.floor(k/4)*normT(p.t)**(k%4)));
  const y=ps.map(p=>elmosDspTarget(p.p,pmin,pmax,outputLimit)/32768);
  const fitted=solveFit(rows,y);const regs=Array(16).fill(0);fitted.forEach((v,i)=>regs[keys[i]]=q(v,15,'S'+keys[i]));
  const decoded=regs.map(v=>fromQ(v,15));
  const errors=ps.map((p,i)=>(poly(decoded,normS(p.s),normT(p.t))*32768-y[i]*32768));
  const rms=Math.hypot(...errors)/Math.sqrt(errors.length),max=Math.max(...errors.map(Math.abs));
  const maxOutput=Math.max(...ps.map(p=>Math.abs(poly(decoded,normS(p.s),normT(p.t)))));
  if(maxOutput>=1)throw Error('DSP-Ausgang würde übersteuern. Andere Koeffizienten/Skalierung nötig.');
  let tRegs=null,tErrors=[];
  if(orderT>0){
   const trows=ps.map(p=>Array.from({length:orderT+1},(_,i)=>normT(p.t)**i));
   const ty=ps.map(p=>elmosTemperatureTarget(p.temp)/32768);
   const fittedT=solveFit(trows,ty);tRegs=Array(4).fill(0);fittedT.forEach((v,i)=>tRegs[i]=q(v,15,'T'+i));
   tErrors=ps.map((p,i)=>32768*(tRegs.reduce((s,v,k)=>s+fromQ(v,15)*normT(p.t)**k,0)-ty[i]));
  }
  return {method:'browser-independent-polynomial-fit',points:ps.length,recordedPoints:allPoints.length,ignoredTemperaturePoints:allPoints.length-ps.length,pressureOnly:orderT===0,referenceTemperature:orderT===0?ps[0]?.temp:null,orderS,orderT,fitMode,outputLimit,registers:{so,sf,coeffs:regs,to,tf,tcoeffs:tRegs},stats:{maxDigits:max,rmsDigits:rms,maxTemperatureDigits:tErrors.length?Math.max(...tErrors.map(Math.abs)):null,rangeDigits:smax-smin,maxNormalized:Math.max(...ps.map(p=>Math.abs(normS(p.s)))),maxOutput},errors,coefficients:decoded,note:'Q3.12/Q0.15 nach Datenblatt; numerischer JavaScript-Fit, nicht identisch mit der Elmos-Kalibrier-DLL. '+(orderT===0?'Ohne TK-Kompensation: nur Druckmessungen einer Referenztemperatur werden verwendet; bestehende Temperaturregister bleiben unverändert. ':'')+'Vor Programmierung RAM/DSP-Verifikation notwendig.'};
 }
 /** Propose a conservative, verified DSP target without changing the caller's settings or writing the chip.
  * A lower DSP target can fix a saturated DSP S-coefficient, but not an AFE or temperature-path fault.
  * Try 500-digit steps and require 2% coefficient headroom; every candidate runs the full fit gates.
  */
 function suggestDspLimit(points,opts={}){
  const initial=Number(opts.outputLimit??32000);
  if(!Number.isInteger(initial)||initial<1000||initial>32000)return null;
  try{fit(points,opts);return null}
  catch(error){
   if(error.code!=='COEFFICIENT_OUT_OF_RANGE'||!/^S\d+$/.test(error.coefficient?.name||''))return null;
  }
  for(let target=Math.floor((initial-1)/500)*500;target>=1000;target-=500){
   try{
    const proposed=fit(points,{...opts,outputLimit:target});
    const maxCoefficient=Math.max(...proposed.coefficients.map(Math.abs));
    if(maxCoefficient<=0.98)return {outputLimit:target,maxCoefficient,originalLimit:initial};
   }catch(_){/* Keep the full numerical and fixed-point checks for every candidate. */}
  }
  return null;
 }
 /** Verifies documented 1-Wire boot prerequisites (Elmos DS 25DS0170E.04, 6.4.5.7).
  * A software check never replaces a physical power-cycle check.
  */
 function oneWireStartupStatus(words){
  if(!Array.isArray(words)||words.length!==64||words.some(v=>!Number.isInteger(v)||v<0||v>65535))
   return {ok:false,errors:['Ungültiges 64-Wort-NVM-Abbild']};
  const mode=(words[16]>>>9)&7,permanent=!!(words[17]&4),startupWindow=(words[18]>>>12)&3;
  const downstream=!!(words[19]&(1<<11)),upstream=!!(words[19]&(1<<7)),registerAccess=!!(words[19]&(1<<8));
  const errors=[];
  if(mode<1||mode>5)errors.push('CFG_EN.aodo_en muss 1–5 sein (Analog/PWM/FM, nicht High-Z/Alarm)');
  if(!permanent&&startupWindow===3)errors.push('Weder PLC dauerhaft noch Startup-1-Wire-Zeitfenster aktiv');
  if(!downstream)errors.push('CFG_PADS1.plc_downsel deaktiviert');
  // DS 6.4.5.7–8: with a finite startup window, PLC P/T can use the
  // magic cookie even when upstream / R/W are disabled in the original NVM.
  const requiresCookie=!upstream||!registerAccess;
  if(permanent&&requiresCookie)errors.push('Permanentes PLC benötigt Upstream und Registerfreigabe');
  const windowLabel=permanent?'dauerhaft':startupWindow===0?'4 ms':startupWindow===1?'10 ms':startupWindow===2?'200 ms':'aus';
  return {ok:errors.length===0,errors,mode,permanent,startupWindow,
   windowLabel,downstream,upstream,registerAccess,requiresCookie,startupAvailable:permanent||startupWindow<3};
 }
 /** Pure check for the PSSC-style "One Wire only" choice.
  * On the E703.11 it is not a CFG_EN.aodo_en value. With permanent PLC=1
  * a documented AODO mode 1..5 is retained, and 1-Wire owns the AODO pin.
  * Never program protected interface/boot bits as part of this preset.
  */
 function oneWireOnlyStatus(words){
  const startup=oneWireStartupStatus(words);
  const errors=[...startup.errors];
  if(startup.ok&&!startup.permanent)
   errors.push('One Wire only benötigt CFG_SPI_I2C.plc_en = 1 im Original-NVM (permanenter 1-Wire-Betrieb); ein kurzes Startup-Zeitfenster allein genügt nicht');
  return {...startup,ok:errors.length===0,errors};
 }
 const SVDD_INDEX=0x36/2, SVDD_MASK=0x0003;
 // CFG_PADS0.startup_com selects EOC or NCS/SA0, or keeps the stored mode.
 function i2cBootRegisterMatches(words,actual){
  const stored=words[17],selection=words[18]>>>14;
  if(selection<2)return actual===((stored&~3)|1);
  return selection===3&&(stored&3)>=1&&(stored&3)<=2&&actual===stored;
 }

 // The startup cookie can enable PLC, upstream and register access in RAM.
 // The PSSC recovery broadcast may also replace the low interface-mode bits.
 function timedPlcRamMatches(words,actual){
  if(!Array.isArray(words)||words.length!==64||!Number.isInteger(actual))return false;
  const stored=words[17];
  if(actual===stored)return true;
  if(stored===0x6C06&&actual===0x6C04)return true;
  // CFG_PADS0.startup_com selects the RAM SPI/I2C interface mode.
  // Verified field trace: NVM 0x6C06, startup_com=1, RAM 0x6C05.
  // Only the two mode bits may differ; permanent PLC and address stay intact.
  return stored===0x6C06&&actual===0x6C05&&(words[18]>>>14)===1;
 }
 function oneWireBootRegisterMatches(words,actual,register,{startupAccess=false,psscRecovery=false}={}){
  const stored=words[register===6?17:19];
  if(actual===stored)return true;
  if(!startupAccess)return false;
  // The same startup mode selection may be observed after re-opening PLC
  // following the verified 4-ms NVM conversion (0x6C02 -> 0x6C05).
  if(register===6&&(words[18]>>>14)===1&&
     ((stored===0x6C06||stored===0x6C02)&&actual===0x6C05))return true;
  if(aodoPinBlocked(words))return false;
  if(register===10)return actual===(stored|0x0180);
  return actual===(stored|4)||(psscRecovery&&(stored&0xFFFC)===0x6C00&&actual===0x6C04);
 }

 // The profile is an explicitly confirmed target, not a hardware write permission.
 const PROFILE_REGS=Object.freeze([[0x00,13],[0x02,14],[0x04,16],[0x0E,21],[0x14,24],[0x16,25],[0x18,26],[0x1A,27],[0x1C,28],[0x1E,29]].map(Object.freeze));
 const PROFILE_WORDS=Object.freeze([21,24,25,26]);
 const word16=x=>Number.isInteger(x)&&x>=0&&x<=65535;
 const sameNvmImage=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===64&&b.length===64&&a.every((v,k)=>word16(v)&&v===b[k]);
 const hasPressureTemperatureCompensation=a=>Array.isArray(a)&&Array.from({length:16},(_,k)=>k).some(k=>k%4!==0&&a[35+k]!==0);
 // DS 25DS0170E.04 §§6.5.1.3,6.6.1: a pressure-blank profile may have factory temperature coefficients.
 // The reported device has CFG_AFE1=0 both in RAM and CM despite valid CRCs.
 // Only this narrow, inactive pressure profile may receive mandatory bit 11.
 function uncalibratedPressureBlank(words){
  return sameNvmImage(words,words)&&(words[28]===0||!!(words[28]&0x0800))&&(words[16]&3)===0&&[0,4].includes(words[16]&12)&&words[21]===0&&
   words.slice(33,51).every(v=>v===0)&&words[57]===0&&words[58]===0&&
   words[31]===0&&words[32]===0x1000&&words[51]===0x0F4D&&words[52]===0xBC8E&&words[53]===0xFC54&&words[54]===0&&
   crc16(words)===words[63]&&crc8(words)===(words[15]>>>8);
 }
 function uncalibratedAfeBlank(words){
  return uncalibratedPressureBlank(words)&&words[28]===0;
 }
 function afeRepairAllowed(before,after,profile){
  return profile?.afeMandatoryRepair===true&&uncalibratedAfeBlank(before)&&!!(after[28]&0x0800)&&((before[28]^after[28])&0xe000)===0;
 }
 function planCalibrationProfile(original,ram,{orderT=0,recovery=false,allowOperatingChanges=false,allowSingleMeasurement=false,allowBridgeSupplyChange=!recovery,filterCatalog=[]}={}){
  if(!sameNvmImage(original,original))throw Error('NVM-Vorabprüfung benötigt 64 gültige Wörter');
  for(const [addr] of PROFILE_REGS)if(!word16(ram[addr]))throw Error('Messregister 0x'+addr.toString(16)+' fehlt');
  if(![0,1,2,3].includes(orderT))throw Error('Ungültige Temperaturordnung');
  if(![0,2].includes(original[16]&3)||![0,2].includes(ram[4]&3))throw Error('CFG_EN.s_cor_en reserviert');
  if(!allowOperatingChanges&&((original[16]&3)!==2||(ram[4]&3)!==2))throw Error('Druckkorrektur deaktiviert; Programmer unterstützt die Aktivierung nicht');
  if((ram[0x1e]&3)!==0)throw Error('Nur interne Temperaturquelle ist für den Abgleich validiert');
  const temperatureEnable=orderT>0&&(original[16]&12)===0;
  const temperatureTarget=temperatureEnable?4:(original[16]&12);
  if(orderT>0&&temperatureTarget!==4)throw Error('Temperaturkorrektur für interne Quelle nicht validiert');
  if(temperatureEnable&&!allowOperatingChanges)throw Error('Temperaturaktivierung mit diesem Programmer nicht unterstützt');
  const ramTemp=ram[4]&12;
  const temperatureRamChange=ramTemp!==temperatureTarget;
  if(temperatureRamChange&&(!allowOperatingChanges||![0,4].includes(ramTemp)||![0,4].includes(temperatureTarget)))throw Error('CFG_EN.t_cor_en im RAM weicht ab');
  const afeMandatoryRepair=allowOperatingChanges&&recovery&&uncalibratedAfeBlank(original)&&!!(ram[0x1c]&0x0800);
  // DS 6.5.1.1: s_cor_en controls the ADC as well as the DSP.
  const firstPressure=allowOperatingChanges&&recovery&&uncalibratedPressureBlank(original);
  if(firstPressure&&(ram[4]&3)!==2)throw Error('Erstabgleich: Druck-ADC im RAM nicht aktiviert (CFG_EN.s_cor_en).');
  const pressureActivation=(original[16]&3)===0&&(ram[4]&3)===2;
  for(const [addr,index] of PROFILE_REGS){
   if(PROFILE_WORDS.includes(index))continue;
   let mask=0xffff;
   if(index===16)mask=0xff30;
   if(index===SVDD_INDEX)mask=allowBridgeSupplyChange?0xffff&~SVDD_MASK:0xffff;
   if(index===28)mask=afeMandatoryRepair?0xe000:0xe800;
   if(((original[index]^ram[addr])&mask)!==0){
    const hex=value=>'0x'+value.toString(16).toUpperCase().padStart(4,'0');
    const register=index===SVDD_INDEX?'CFG_AFE0 (0x1A)':'Register 0x'+addr.toString(16);
    throw Error('Messprofil: '+register+' weicht vom Original-NVM ab (RAM '+hex(ram[addr])+', NVM '+hex(original[index])+')');
   }
  }
  if(ram[0x0e]===0)throw Error('CFG_PERIOD: keine aktive Messung');
  if(ram[0x0e]===2&&(!allowSingleMeasurement||original[21]!==2))throw Error('CFG_PERIOD: Einzelmessungsprofil vor Abgleich auf unterstützten kontinuierlichen Betrieb einstellen');
  const values=PROFILE_WORDS.map(index=>ram[PROFILE_REGS.find(x=>x[1]===index)[0]]);
  const changed=PROFILE_WORDS.flatMap((index,k)=>original[index]===values[k]?[]:[{index,from:original[index],to:values[k]}]);
  if(changed.length){
   if(!allowOperatingChanges)throw Error('Messzyklus/Filter im RAM weichen vom NVM ab; Programmer unterstützt Übernahme nicht');
   if(values[0]!==1)throw Error('Geändertes Messprofil benötigt bestätigten kontinuierlichen CFG_PERIOD=1');
   if(values.slice(1).some((v,k)=>v!==original[k+24])&&!filterCatalog.some(f=>f.length===3&&f.every((v,k)=>v===values[k+1])))throw Error('Abweichende Filter sind kein dokumentiertes Profil');
  }
  const svdd=ram[0x1a]&SVDD_MASK;
  if(svdd===SVDD_MASK)throw Error('CFG_AFE0: Brückenspannungsstufe 3 ist reserviert.');
  if((original[SVDD_INDEX]&SVDD_MASK)!==svdd)
   changed.push({index:SVDD_INDEX,from:original[SVDD_INDEX],to:ram[0x1a]});
  if(temperatureEnable||pressureActivation){
   let target=original[16];
   if(temperatureEnable)target=(target&~12)|4;
   if(pressureActivation)target=(target&~3)|2;
   changed.push({index:16,from:original[16],to:target});
  }
  if(afeMandatoryRepair)changed.push({index:28,from:original[28],to:ram[0x1c]});
  return {values,temperatureEnable,temperatureTarget,temperatureRamChange,afeMandatoryRepair,changed,replaceTemperature:orderT===0&&hasPressureTemperatureCompensation(original)};
 }
 function operatingWordAllowed(i,after,profile){
  const k=PROFILE_WORDS.indexOf(i);
  return k>=0&&Array.isArray(profile?.values)&&profile.values.length===4&&profile.values.every(word16)&&after[i]===profile.values[k]&&(i!==21||after[i]===1);
 }
 function temperatureActivationMask(before,after,profile){return profile?.temperatureEnable===true&&(before&12)===0&&(after&12)===4?12:0;}
 function sameMeasurementProfile(a,b,enableMask=0){
  return !!a&&!!b&&PROFILE_REGS.every(([addr])=>word16(a[addr])&&word16(b[addr])&&((a[addr]^b[addr])&(addr===4?0xffff&~enableMask:0xffff))===0);
 }
 function checkpointMatches(d,{uid,words,ram,gains,reference}){
  return !!d&&d.version===1&&d.uid===uid&&sameNvmImage(d.words,words)&&sameMeasurementProfile(d.ram,ram)&&JSON.stringify(d.gains)===JSON.stringify(gains)&&JSON.stringify(d.reference)===JSON.stringify(reference)&&Array.isArray(d.points)&&d.points.length>0&&d.points.length<=10&&d.points.every(p=>p&&['lo','hi','extra'].includes(p.kind)&&Number.isFinite(p.adc_s)&&Number.isFinite(p.adc_t)&&Number.isFinite(p.pressure)&&Number.isFinite(p.temperature));
 }


 // Dedicated lab reproduction: no calibration coefficients or factory data are copied.
 function planOneWireReconnectTest(before){
  if(!Array.isArray(before)||before.length!==64||before.some(v=>!Number.isInteger(v)||v<0||v>65535)||
     crc16(before)!==before[63]||crc8(before)!==(before[15]>>>8))
   throw Error('Original-NVM fehlt oder CRC-Prüfung fehlgeschlagen.');
  const start=oneWireStartupStatus(before);
  if(!start.ok||!start.permanent||!start.downstream||!start.upstream||!start.registerAccess||start.mode<1||start.mode>3)
   throw Error('Testsensor benötigt permanentes PLC, Registerzugriff und analogen AODO-Modus.');
  const after=before.slice();
  after[17]&=~4;after[18]&=~0x3000;after[63]=crc16(after);
  protectStartupCommunication(before,after,{allowTimedOneWire:true,interfaceMode:'plc'});
  const changes=after.flatMap((to,index)=>to===before[index]?[]:[{index,address:index*2,from:before[index],to}]);
  if(!changes.some(x=>x.index===17)||changes.some(x=>![17,18,63].includes(x.index)))throw Error('Ungültiger Labor-NVM-Plan.');
  return {before:before.slice(),after,changes};
 }
 function validPressureActivation(before,after){return (before&3)===0&&(after&3)===2;}
 function aodoPinBlocked(words){
  return !!(words[17]&4);
 }
 const AODO_PLC_CONFLICT='Dauerhaftes One-Wire belegt AODO. Für Analogbetrieb im Schritt «Ausgang» das 4-ms-Startfenster im NVM vormerken. Die RAM-Verbindung bleibt erhalten. Beim SSP3 genügt der bestätigte Direktzugriff mit passendem Original-NVM; DIY- und Recovery-Schutz bleiben aktiv.';
 function protectStartupCommunication(before,after,{allowTimedOneWire=false,allowSvdd=false,allowAlarmMask=false,allowPressureCorrection=false,operatingProfile=null,interfaceMode='plc'}={}){
  if(!Array.isArray(before)||!Array.isArray(after)||before.length!==64||after.length!==64||
   [...before,...after].some(v=>!Number.isInteger(v)||v<0||v>65535))
   throw Error('1-Wire-Startschutz: Ungültiges 64-Wort-NVM-Abbild');
  if(allowTimedOneWire){
   const mode=(after[16]>>9)&7;
   if(interfaceMode!=='plc'||!oneWireStartupStatus(before).ok||!aodoPinBlocked(before)||mode<1||mode>3||
      after[17]!==(before[17]&~4)||after[18]!==(before[18]&~0x3000)||
      !oneWireStartupStatus(after).ok)
    throw Error('1-Wire-Startschutz: Nur die geprüfte One-Wire-Umstellung auf 4 ms für den Analogausgang ist zulässig.');
  }
  for(let i=0;i<28;i++){
   if(allowTimedOneWire&&(i===17||i===18))continue;
   if(i===16){
    const pressureMask=(allowPressureCorrection&&validPressureActivation(before[i],after[i])?3:0)|temperatureActivationMask(before[i],after[i],operatingProfile);
     const allowed=((7<<9)|(1<<6)|(1<<7))|(allowAlarmMask?((1<<5)|(1<<8)):0)|pressureMask;
    if(((before[i]^after[i])&~allowed)!==0)throw Error('1-Wire-Startschutz: Nicht erlaubte CFG_EN-Bits verändert');
   }else if(i===18&&allowAlarmMask&&before[i]!==after[i]){
    if(((before[i]^after[i])&0xF000)!==0)
     throw Error('1-Wire-Startschutz: CFG_PADS0.startup_plc oder startup_com verändert');
   }else if(i===SVDD_INDEX&&allowSvdd&&before[i]!==after[i]){
    if(((before[i]^after[i])&~SVDD_MASK)!==0||(after[i]&SVDD_MASK)===SVDD_MASK)
     throw Error('CFG_AFE0: Nur dokumentierte SVDD-Bits dürfen geändert werden');
   }else if(i!==22&&before[i]!==after[i]&&!operatingWordAllowed(i,after,operatingProfile)){
    throw Error('1-Wire-Startschutz: Kommunikations-, Boot- oder Factory-Wort '+i+' verändert');
   }
  }
  if(((before[28]^after[28])&0x0800)!==0&&!afeRepairAllowed(before,after,operatingProfile))
   throw Error('1-Wire-Startschutz: CFG_AFE1 Pflichtbit nur beim bestätigten Erstabgleich aktivierbar');
  const initial=oneWireStartupStatus(before),final=oneWireStartupStatus(after);
  if(interfaceMode!=='i2c'&&!initial.ok)throw Error('1-Wire-Startschutz: Original-NVM erfüllt die Voraussetzungen für den 1-Wire-Start nicht: '+initial.errors.join('; ')+'. NVM-Schreiben gesperrt.');
  if((interfaceMode!=='i2c'||initial.ok)&&!final.ok)throw Error('1-Wire-Startschutz: Geplantes NVM würde den 1-Wire-Start gefährden: '+final.errors.join('; '));
  // The opt-in conversion above checks every bit of words 17 and 18.
  for(const index of [17,...(allowAlarmMask?[]:[18]),19])if(before[index]!==after[index]&&!(allowTimedOneWire&&index!==19))
   throw Error('1-Wire-Startschutz: Geschützte PLC-Startkonfiguration NVM '+index+' verändert');
  return true;
 }
 /** Convert PSSC-style analog endpoints to validated E703.11 Q3.12 AODO scaling.
  * This calculates a proposal only; it does not write RAM or NVM.
  * A small inward trim avoids the DAC's 10..90% linearity boundary after quantization.
  */
 function analogScaling(s0Volts,s1Volts,vddVolts=5,outputLimit=32000){
  const [v0,v1,vdd,limit]=[s0Volts,s1Volts,vddVolts,outputLimit].map(Number);
  if(![v0,v1,vdd,limit].every(Number.isFinite))throw Error('Scaling: Ungültige Eingabewerte');
  if(vdd<2.7||vdd>5.5)throw Error('VDD zur Vorschau muss zwischen 2.7 und 5.5 V liegen');
  if(!Number.isInteger(limit)||limit<1000||limit>32000)throw Error('DSP-Endwert muss 1’000 bis 32’000 Digits betragen');
  if(!(v0>=vdd*0.1-1e-9&&v1<=vdd*0.9+1e-9&&v1>v0))throw Error('Analog Ratiometric 0..5 V: S0/S1 müssen aufsteigend im linearen Bereich 10–90 % VDD liegen');
  const target0=32768*(2*v0/vdd-1),target1=32768*(2*v1/vdd-1);
  const midpoint=(target0+target1)/2;
  const offsetQ=Math.round(midpoint/8); // AODO_O is Q3.12: offset*32768 = Q-code*8
  const off=offsetQ/4096,base=off*32768;
  const maxRange=Math.min(26214-base,26214+base);
  if(maxRange<=0)throw Error('Scaling: Offset ausserhalb des zulässigen Ausgangsbereichs');
  let gainQ=Math.floor(Math.min((target1-target0)/2,maxRange)/limit*4096);
  if(gainQ<1)throw Error('Scaling: Ausgabespanne zu klein');
  while(gainQ>0&&Math.max(Math.abs(base-gainQ*limit/4096),Math.abs(base+gainQ*limit/4096))>26214)gainQ--;
  if(gainQ<1)throw Error('Scaling: Kein gültiger Gain für den gewünschten Bereich');
  const gain=gainQ/4096,offset=off;
  const actual0=base-gain*limit,actual1=base+gain*limit;
  return {gain,offset,scaleEnabled:true,requested:[v0,v1],actualVolts:[(actual0/32768+1)*vdd/2,(actual1/32768+1)*vdd/2],
   outputDigits:[actual0,actual1],vdd,limit};
 }
 // E703.11 DS §6.3.2.6 and §6.4.1.1: DSP_AODO = AODO_F*DSP_S+AODO_O,
 // with Q3.12 AODO coefficients and nominal VDD/2*(1 + DSP_AODO/32768).
 // Check the COMPLETE post-NVM image, not just the on-screen calculation.
 // This independent check prevents a valid DSP fit being saved together with
 // stale AODO settings. Actual physical voltage still requires a DMM check.
 function analogOutputStatus(words,s0,s1,vdd=5,outputLimit=32000,toleranceV=0.025){
  if(!Array.isArray(words)||words.length!==64||
     words.some(w=>!Number.isInteger(w)||w<0||w>65535))
   throw Error('AODO-Prüfung: vollständiges 64-Wort-NVM-Abbild erforderlich');
  if(![s0,s1,vdd,toleranceV].every(Number.isFinite)||vdd<2.7||vdd>5.5||
     toleranceV<=0||toleranceV>0.1||!Number.isInteger(outputLimit)||
     outputLimit<1000||outputLimit>32000)
   throw Error('AODO-Prüfung: ungültige Sollwerte/VDD/DSP-Spanne');
  if(!(s1>s0&&s0>=vdd*0.1-1e-9&&s1<=vdd*0.9+1e-9))
   throw Error('AODO-Prüfung: S0/S1 müssen zwischen 10 und 90 % VDD liegen');
  const mode=(words[16]>>9)&7,scaled=!!(words[16]&(1<<6)),limited=!!(words[16]&(1<<7));
  if(mode<1||mode>3)return {checked:false,ok:true,mode,reason:'Kein ratiometrischer Analogausgang'};
  if(aodoPinBlocked(words))return {checked:true,ok:false,mode,reason:AODO_PLC_CONFLICT};
  if(!scaled)return {checked:true,ok:false,mode,reason:'CFG_EN.scale_en ist aus: S0/S1 können nach Neustart nicht stimmen'};
  const gain=fromQ(words[58],12),offset=fromQ(words[57],12);
  const raw=[-outputLimit,outputLimit].map(dsp=>gain*dsp+offset*32768);
  if(!Number.isFinite(gain)||gain<=0||raw.some(v=>Math.abs(v)>32767))
   return {checked:true,ok:false,mode,reason:'AODO_F ungültig oder DSP_AODO ausserhalb 16-Bit-Bereich'};
  if(limited){
   if((words[59]&3)||(words[60]&3))
    return {checked:true,ok:false,mode,reason:'AODO-Limit-Hysterese nicht null; manuelle Prüfung erforderlich'};
   const lo=(signed(words[59])>>2)*4,hi=(signed(words[60])>>2)*4;
   if(lo>=hi)return {checked:true,ok:false,mode,reason:'AODO-Limiting-Untergrenze >= Obergrenze'};
   raw[0]=Math.max(lo,Math.min(hi,raw[0]));
   raw[1]=Math.max(lo,Math.min(hi,raw[1]));
  }
  const actual=raw.map(dsp=>vdd/2*(1+dsp/32768));
  const unClippedVolts=[-outputLimit,outputLimit]
   .map(dsp=>vdd/2*(1+(gain*dsp+offset*32768)/32768));
  const errors=[actual[0]-s0,actual[1]-s1];
  const unClippedErrors=[unClippedVolts[0]-s0,unClippedVolts[1]-s1];
  // Limiting does NOT replace scaling. A 0.25..4.75 V gain must fail,
  // even if clipped to 0.5..4.5 V at the end.
  const ok=errors.every(e=>Math.abs(e)<=toleranceV)&&
   unClippedErrors.every(e=>Math.abs(e)<=toleranceV);
  return {checked:true,ok,mode,scaled,limited,actualVolts:actual,
   unClippedVolts,requestedVolts:[s0,s1],errorsVolts:errors,gain,offset,outputLimit,
   reason:ok?'AODO-NVM-Skalierung entspricht dem Spannungsziel':
    'AODO-NVM-Rohskalierung ergibt '+unClippedVolts.map(v=>v.toFixed(4)+' V').join(' / ')+
    ' statt '+s0.toFixed(4)+' / '+s1.toFixed(4)+' V (Clipping ersetzt keine Skalierung)'};
 }
 // Shared validation for saved profiles, sensor series and actual NVM encoding.
 function clippingThresholds(low,high,vdd){
  // LIMIT_LO/HI are signed 14-bit Q0.13 thresholds independent of the
  // 10–90 % VDD range where the analog output's linearity is guaranteed.
  if(![low,high,vdd].every(Number.isFinite)||vdd<2.7||vdd>5.5||
     low<0||high>vdd||low>=high)
   throw Error('Clipping: Unter- und Obergrenze müssen aufsteigend zwischen 0 und VDD liegen');
  const lo=Math.ceil(8192*(2*low/vdd-1)-1e-9);
  const hi=Math.floor(8192*(2*high/vdd-1)+1e-9);
  if(lo< -8192||hi>8191||lo>8191||hi< -8192)
   throw Error('Clipping-Grenzen ausserhalb des 14-Bit-Q0.13-Registerbereichs. Die obere Grenze muss knapp unter VDD liegen.');
  if(lo>=hi)throw Error('Abstand zwischen den Clipping-Grenzen zu klein');
  return {lo,hi};
 }
 function prepareOutputConfig(original,settings,outputLimit=32000,{interfaceMode}={}){
  if(!Array.isArray(original)||original.length!==64)throw Error('Vollständiges NVM-Abbild erforderlich');
  const out=original.slice();
  if(!settings||settings.mode==='keep')return out;
  if(settings.mode==='onewire'){
   const status=oneWireOnlyStatus(original);
   if(!status.ok)throw Error('One Wire only nicht verfügbar: '+status.errors.join('; ')+'. Boot-/Kommunikationsregister werden nicht automatisch verändert.');
   // Already permanently enabled in the exact NVM that was read. No mode
   // change, no scaling writes, and no communication register updates.
   return out;
  }
  const mode=Number(settings.mode),scaleEnabled=settings.scaleEnabled===true,period=Number(settings.pwmPeriod);
  if(!Number.isInteger(mode)||mode<1||mode>5)throw Error('1-Wire-Startschutz: Nur AODO-Modi 1–5 dürfen dauerhaft gespeichert werden. High-Z und Alarm deaktivieren 1-Wire gemäss Datenblatt.');
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
  const clipping=settings.clipping;
  if(clipping&&clipping.mode!=='keep'){
   if(mode>3)throw Error('Spannungs-Clipping ist nur für den ratiometrischen Analogausgang verfügbar');
   if(clipping.mode==='off')out[16]&=~(1<<7);
   else if(clipping.mode==='on'){
    const {low,high,vdd}=clipping;
    const {lo,hi}=clippingThresholds(low,high,vdd);
    if((out[16]&(1<<8))&&(original[61]&0xF))
     throw Error('Aktive Fehlerreaktionen für AODO-Grenzen können das Clipping übersteuern');
    // Bits 15:2 contain the signed Q0.13 threshold. Bits 1:0 = 0 disable hysteresis.
    out[59]=(lo<<2)&0xFFFF;
    out[60]=(hi<<2)&0xFFFF;
    out[16]|=1<<7;
   }else throw Error('Ungültige Clipping-Einstellung');
  }
  const allowTimedOneWire=settings.timedOneWire===true;
  if(allowTimedOneWire){
   out[17]&=~4;
   out[18]&=~0x3000;
  }
  if(mode<=3&&aodoPinBlocked(out))throw Error(AODO_PLC_CONFLICT);
  if(original.slice(0,16).some((v,i)=>v!==out[i]))throw Error('Factory-Bereich darf nicht verändert werden');
  for(let i=17;i<28;i++)if(i!==22&&!(allowTimedOneWire&&(i===17||i===18))&&out[i]!==original[i])throw Error('Geschützte Kommunikation verändert');
  protectStartupCommunication(original,out,{interfaceMode,allowTimedOneWire});
  return out;
 }
  /**
   * Allowed NVM changes after a temporary PSSC/1-Wire RAM recovery.
   * Default remains calibration-only. Analogue scaling/clipping may be added
   * only when the UI has separately verified the programming prerequisites,
   * the original AODO mode, and a user-approved output plan.
   * This helper is pure: it cannot grant a hardware writing permission.
   */
  function validateRecoveryCalibrationDiff(before,after,{allowAnalogScaling=false,allowPressureCorrection=false,allowTimedOneWire=false,operatingProfile=null}={}){
   if(!Array.isArray(before)||!Array.isArray(after)||before.length!==64||after.length!==64||
      [...before,...after].some(w=>!Number.isInteger(w)||w<0||w>0xFFFF))
    throw Error('Recovery-NVM: ungültiges 64-Wort-Abbild');
   const calibrationWords=new Set([SVDD_INDEX,28,30,31,32,33,34,...Array.from({length:16},(_,i)=>35+i),51,52,53,54,63]);
   if(allowTimedOneWire&&!allowAnalogScaling)throw Error('Recovery-NVM: 4-ms-Umstellung benötigt bestätigte Analogskalierung.');
   const outputWords=new Set([16,57,58,59,60,...(allowTimedOneWire?[17,18]:[])]);
   const changed=after.map((word,index)=>word===before[index]?null:index).filter(index=>index!==null);
   const pressureMask=(allowPressureCorrection&&validPressureActivation(before[16],after[16])?3:0)|temperatureActivationMask(before[16],after[16],operatingProfile);
    for(const index of PROFILE_WORDS)if(operatingWordAllowed(index,after,operatingProfile))calibrationWords.add(index);
    if(pressureMask)calibrationWords.add(16);
    const outputChanged=changed.some(index=>outputWords.has(index)&&(index!==16||!!((before[16]^after[16])&~pressureMask)));
   if(outputChanged&&!allowAnalogScaling)
    throw Error('Nach PSSC-RAM-Freigabe ist AODO nur mit NVM-Freigabe und ausdrücklich vorgemerkter Ausgangsskalierung erlaubt.');
   if(changed.some(index=>!calibrationWords.has(index)&&!(allowAnalogScaling&&outputWords.has(index))))
    throw Error('Nach PSSC-RAM-Freigabe sind nur Kalibrierdaten sowie ausdrücklich freigegebene AODO-Skalierung/Clipping erlaubt.');
   if((allowAnalogScaling||pressureMask)&&
       (before[22]!==after[22]||((before[16]^after[16])&~((allowAnalogScaling?((1<<6)|(1<<7)):0)|pressureMask))!==0))
    throw Error('Recovery-NVM: AODO-Modus und CFG_AODO müssen unverändert bleiben. Nur freigegebene scale_en/limit_en und s_cor_en dürfen in CFG_EN wechseln.');
   protectStartupCommunication(before,after,{allowSvdd:true,allowPressureCorrection,allowTimedOneWire,operatingProfile});
   return {outputChanged,changes:changed.length};
  }
  function configFrom(original,solution,afeWord,opts={}){
  // Second line of defence: never persist an old/incomplete TK0 pressure-only fit.
  if(solution?.fitMode==='tk0'&&(solution.orderS!==1||solution.orderT!==1||solution.pressureOnly||
     solution.points<3||solution.ignoredTemperaturePoints!==0||!Array.isArray(solution.registers?.tcoeffs)))
   throw Error('NVM gesperrt: TK0 wurde nicht vollständig aus allen Temperaturmesspunkten berechnet. TK0 mit Temperaturordnung 1 neu berechnen.');
  if(!Array.isArray(original)||original.length!==64||original.some(v=>!Number.isInteger(v)||v<0||v>65535))throw Error('NVM-Abbild muss exakt 64 gültige 16-Bit-Wörter enthalten');
  const cfg=prepareOutputConfig(original,opts.output,solution.outputLimit??32000,{interfaceMode:opts.interfaceMode}),r=solution.registers;
  if(opts.bridgeSupply!==undefined){
   if(![0,1,2].includes(opts.bridgeSupply))throw Error('Ungültige SVDD-Einstellung');
   cfg[SVDD_INDEX]=(cfg[SVDD_INDEX]&~SVDD_MASK)|opts.bridgeSupply;
  }
  // Targeted opt-in after verified live SSP3 pressure calibration.
   if(opts.activatePressureCorrection===true){
    if((original[16]&3)!==0)throw Error('DSP-Druckkorrektur: nur Übergang 00 -> 10 zulässig');
    cfg[16]=(cfg[16]&~3)|2;
   }
   // The live profile was explicitly confirmed before collection.
   const operatingProfile=opts.operatingProfile??null;
   if(operatingProfile){
    if(!Array.isArray(operatingProfile.values)||operatingProfile.values.length!==4||!operatingProfile.values.every(word16))throw Error('Ungültiges Messprofil');
    for(const [k,index] of PROFILE_WORDS.entries())if(cfg[index]!==operatingProfile.values[k]){
     if(index===21&&operatingProfile.values[k]!==1)throw Error('Geändertes Messprofil: CFG_PERIOD muss 1 sein');
     cfg[index]=operatingProfile.values[k];
    }
    if(operatingProfile.temperatureEnable){
     if((original[16]&12)!==0||!(solution.orderT>0)||!Array.isArray(r.tcoeffs)||r.tcoeffs.length!==4)throw Error('Temperaturaktivierung ohne vollständigen Temperaturabgleich');
     cfg[16]=(cfg[16]&~12)|4;
    }
   }
   // Preserve factory and communication settings outside validated fields.
  cfg[28]=(cfg[28]&~0x17FF)|(afeWord&0x17FF); // preserve bits 11,13–15 normally
  if(uncalibratedAfeBlank(original)&&!operatingProfile?.afeMandatoryRepair)
   throw Error('AFE-Erstinitialisierung benötigt bestätigte Vorabprüfung');
  if(operatingProfile?.afeMandatoryRepair){
   if(!uncalibratedAfeBlank(original)||!(afeWord&0x0800)||(afeWord&0xe000)!==(original[28]&0xe000)||opts.activatePressureCorrection!==true)throw Error('AFE-Erstinitialisierung nicht vollständig bestätigt (Druck-ADC und AFE)');
   cfg[28]|=0x0800;
  }
  cfg[33]=r.so;cfg[34]=r.sf;for(let i=0;i<16;i++)cfg[35+i]=r.coeffs[i];
  if(r.tcoeffs){cfg[31]=r.to;cfg[32]=r.tf;for(let i=0;i<4;i++)cfg[51+i]=r.tcoeffs[i]}
  if(opts.userId!==undefined){
   if(!Number.isInteger(opts.userId)||opts.userId<0||opts.userId>0xFFFF)throw Error('USER-ID muss ein 16-Bit-Wert sein');
   cfg[30]=opts.userId;
  }
  cfg[63]=crc16(cfg);
  const allowTimedOneWire=opts.output?.timedOneWire===true;
  const permittedWords=[16,22,SVDD_INDEX,...(allowTimedOneWire?[17,18]:[])];
  for(let i=0;i<=27;i++)if(cfg[i]!==original[i]&&!permittedWords.includes(i)&&!operatingWordAllowed(i,cfg,operatingProfile))throw Error('Sicherheitsfehler: schreibgeschützter NVM-Bereich verändert');
  if(cfg[16]!==original[16]&&(((cfg[16]^original[16])&~((7<<9)|(1<<6)|(1<<7)|(opts.activatePressureCorrection===true?3:0)|temperatureActivationMask(original[16],cfg[16],operatingProfile)))!==0))throw Error('CFG_EN: fremde Bits dürfen nicht verändert werden');
  if(cfg.slice(0,16).some((v,i)=>v!==original[i]))throw Error('Werkskalibrierung verändert');
  protectStartupCommunication(original,cfg,{allowTimedOneWire,allowSvdd:opts.bridgeSupply!==undefined,allowPressureCorrection:opts.activatePressureCorrection===true,operatingProfile,interfaceMode:opts.interfaceMode});
  return {before:original.slice(),after:cfg,changes:cfg.map((v,i)=>v!==original[i]?{index:i,address:i*2,from:original[i],to:v}:null).filter(Boolean)};
 }
 // A temperature-compensated verification may repeat a reference pressure at a
 // different temperature. Only reject duplicates in BOTH dimensions. Preserve
 // the 10%-of-span pressure rule and require >=10 C separation at equal pressure.
 function independentVerificationPoint(confirmed,candidate,span){
  if(!Array.isArray(confirmed)||!Number.isFinite(span)||span<=0||
     !Number.isFinite(candidate?.pressure)||!Number.isFinite(candidate?.temperature))
   throw Error('Ungültige DSP-Prüfpunktreferenz');
  return confirmed.every(point=>
   Math.abs(point.pressure-candidate.pressure)>span*0.10||
   Math.abs(point.temperature-candidate.temperature)>=10
  );
 }
 // Independent DSP verification requires only the user-selected number of
 // confirmed, unique slots. No second temperature is a prerequisite for
 // testing one DSP operating point; TK coverage is a separate quality claim.
 const verificationPointsSufficient=(records,required)=>
  Number.isInteger(required)&&required>=1&&required<=10&&Array.isArray(records)&&
  Array.from({length:required},(_,slot)=>records.some(point=>
   point?.slot===slot&&Number.isFinite(point.errorBar))).every(Boolean);
 return {planOneWireReconnectTest,PROFILE_REGS,PROFILE_WORDS,uncalibratedPressureBlank,uncalibratedAfeBlank,planCalibrationProfile,sameMeasurementProfile,sameNvmImage,checkpointMatches,hasPressureTemperatureCompensation,SVDD_INDEX,SVDD_MASK,fit,suggestDspLimit,solveFit,crc16,crc8,configFrom,clippingThresholds,prepareOutputConfig,validateRecoveryCalibrationDiff,protectStartupCommunication,aodoPinBlocked,AODO_PLC_CONFLICT,i2cBootRegisterMatches,timedPlcRamMatches,oneWireBootRegisterMatches,oneWireStartupStatus,oneWireOnlyStatus,analogScaling,analogOutputStatus,elmosDspTarget,elmosTemperatureTarget,fromQ,q,signed,independentVerificationPoint,verificationPointsSufficient,temperatureSourceFromAfe2,dspTemperatureCelsius,isFactoryTemperatureProfile,factoryInternalTemperatureCelsius,factoryTemperatureAddresses,programmedTemperatureAddresses,programmedTemperatureProfileMatches};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_CAL;
