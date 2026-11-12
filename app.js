/* E703.11 browser / SSP3 laboratory prototype. NVM writes require explicit gated workflow; boot and factory NVM locked. */
'use strict';
const PROTOCOL = (() => {
 const hx = (n,bytes=1)=>Number(n).toString(16).toUpperCase().padStart(bytes*2,'0');
 const crc = (data,bits,width,seed,poly)=>{let c=seed;for(let k=0;k<bits;k++){let a=(c>>(width-1))&1,b=(data[Math.floor(k/8)]>>(7-k%8))&1;c=(c<<1)^((a^b)?poly:0)}return c&((1<<width)-1)};
 const crc4=(data,bits)=>crc(data,bits,4,0xF,0x03);
 const crc8PLC=data=>crc(data,data.length*8,8,0xF3,0x07);
 const plcRead=(addr,count=1,slave=0x6C)=>{if(!Number.isInteger(addr)||addr<0||addr>0xFE||addr%2||count<1||count>16||addr+2*(count-1)>0xFE)throw Error('Ungültige PLC-Leseadresse/Anzahl'); const a=slave|1,h=(count-1)<<4,c=crc4([a,addr,h],20);return `PLC 02${hx(a)}${hx(addr)}${hx(h|c)}.`};
 const plcWrite=(addr,word,slave=0x6C)=>{if(!Number.isInteger(addr)||addr<0||addr>0xFE||addr%2||!Number.isInteger(word)||word<0||word>65535)throw Error('Ungültiger PLC-Schreibwert');let head=crc4([slave|1,addr,0],20),h=(word>>8)&255,l=word&255;return `PLC 02${hx(slave&~1)}${hx(addr)}${hx(head)}${hx(h)}${hx(l)}${hx(crc8PLC([addr,head,h,l]))}`};
 const i2cRead=(addr,slave=0xD8)=>`I2C #1 S${hx(slave&~1)}${hx(addr)}R${hx(slave|1)}..P`;
 const i2cWrite=(addr,word,slave=0xD8)=>`I2C #1 S${hx(slave&~1)}${hx(addr)}${hx(word&255)}${hx(word>>8)}P`;
 const spiRead=addr=>`SPI ${hx(addr|1)}000000`;
 const spiWrite=(addr,word)=>`SPI ${hx(addr)}00${hx(word,2)}`;
 const lines=data=>data.replace(/\x00/g,'').split(/[\r\n]+/).map(s=>s.trim()).filter(Boolean);
 const readData=(reply,expectedBytes)=>{const clean=lines(reply);if(clean.some(l=>l.startsWith('!')))throw Error(clean.filter(l=>l.startsWith('!')).join('; '));const candidates=clean.filter(s=>!s.startsWith('#')&&!s.startsWith('@')&&s!==':'&&/^(?:[0-9a-fA-F]{2}(?:\s+|$))+$/.test(s)).map(s=>s.match(/[0-9a-fA-F]{2}/g).map(x=>parseInt(x,16))).filter(a=>a.length===expectedBytes);if(candidates.length!==1)throw Error(`Ungültige oder mehrdeutige SSP3-Antwort: ${reply.slice(0,190).replace(/\r/g,'\\r')}`);return candidates[0]};
 const sign16=n=>(n&0x8000)?n-65536:n;
 const offsetEncode=o=>o<0?0x10-o:o;
 const offsetDecode=v=>v===0?0:v>=1&&v<=8?v:v>=17&&v<=24?16-v:null;
 const decAFE=w=>({pga1:w&3,pga2:(w>>7)&15,offset:offsetDecode((w>>2)&31)});
 const goodG=g=>Number.isInteger(g.pga1)&&g.pga1>=0&&g.pga1<=3&&Number.isInteger(g.pga2)&&g.pga2>=0&&g.pga2<=8&&Number.isInteger(g.offset)&&g.offset>=-8&&g.offset<=8;
 const AFE_BITS=0x7FF;
 const encAFE=(old,g)=>{if(!goodG(g))throw Error('Ungültiger Gain/Offset');if(!(old&0x800))throw Error('Pflichtbit 11 fehlt. Schreiben gesperrt.');let n=((old&(~AFE_BITS))|(g.pga1&3)|(offsetEncode(g.offset)<<2)|((g.pga2&15)<<7))&0xffff;if(((n^old)&~AFE_BITS)!==0)throw Error('Fremde AFE-Bits betroffen');return n};
 return {hx,crc,crc4,crc8PLC,plcRead,plcWrite,i2cRead,i2cWrite,spiRead,spiWrite,readData,sign16,decAFE,encAFE,goodG};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=PROTOCOL;
if(typeof document!=='undefined') (function UI(){
 const $=id=>document.getElementById(id),P=PROTOCOL;
 const demoEnabled=new URLSearchParams(location.search).get('demo')==='1';
 const lsGet=k=>{try{return demoEnabled?sessionStorage.getItem('demo-'+k):localStorage.getItem(k)}catch{return null}};
 const lsSet=(k,v)=>{try{if(demoEnabled)sessionStorage.setItem('demo-'+k,v);else localStorage.setItem(k,v)}catch{}};
 const GAINS1=[3.5,6,8.5,11],GAINS2=[2,2.22,2.5,2.86,3.33,4,5,6.67,10];
 const LOCKED=[4,6,8,10,12,16],R_AFE=0x1C;
 const CAL=ELMOS_CAL; const CAL_REGS=[0x6C,0x6E,0x70,0x72,...Array.from({length:16},(_,i)=>0x74+2*i),0x94,0x96,0x98,0x9A];
 const demoPort=demoEnabled?ELMOS_DEMO.create(P,CAL,()=>({
  lower:Number($('pmin').value),upper:Number($('pmax').value),limit:getActiveDSPRange()?.limit??32000
 })):null;
 const REG_NAMES={4:'CFG_EN',6:'CFG_SPI_I2C',8:'CFG_PADS0',10:'CFG_PADS1',12:'CFG_PADS2',16:'CFG_AODO',0x14:'CFG_ADC',0x16:'CFG_LP0',0x18:'CFG_LP1',0x1A:'CFG_AFE0',0x1C:'CFG_AFE1',0x1E:'CFG_AFE2',0x26:'ADC_TC',0x28:'ADC_T',0x2A:'ADC_S'};
 const st={chipDiag:null,diagRunning:false,lastPlcReply:null,mode:'offline',port:null,closing:false,reader:null,readerPromise:null,cmdQueue:Promise.resolve(),replyBuffer:'',responseWait:null,iface:'plc',adapterKind:'ssp3',sensorPowerEnabled:false,startupRunning:false,startupAbort:false,startupAttempts:0,firmware:'',chip:false,boot:null,afe:null,staged:{pga1:0,pga2:0,offset:0},adc:null,dsp:null,dspError:null,liveReadPromise:null,trend:[],history:[],log:[],regs:{},points:{lo:null,hi:null},verify:null,live:false,manualLivePause:false,timeout:null,consecutiveErrors:0,writing:false,pressure:5,calpoints:[],calfit:null,calImage:null,nvmBackup:null,nvmBackupVerified:false,calStaged:false,calVerified:false,calValidation:[],calTask:false,nvmWorking:false,nvmDone:false,afeWriteActive:false,ramWriteScope:null,uid:null,expertOutputPlan:null,restorePlan:null,outputOnlyPlan:null,uidShownForInput:null,profilePendingAFE:null};
 let currentStep=0,pendingGain=null,writeTimer=null;let tipEnabled=true,liveIntervalMs=650;
 const HELP={interface:'Schnittstelle zwischen SSP3-Board und Sensorchip. 1-Wire nutzt AODO (VDD, GND und AODO). Die Einstellung IF_CFG ändert die Programmer-Pins, nicht die NVM-Konfiguration des Sensors.',baud:'Baudrate des USB-UART zwischen Chrome und dem SSP3. Die Herstellersoftware verwendet 115200 Baud als Standard.',adcs:'ADC_S ist der unkompensierte 16-Bit-Druck-ADC. ±25000 Digits ist ein vorsichtiges Ziel für den manuellen Abgleich, keine garantierte Hardwaregrenze.',dsp_live:'DSP_S (Register 0x30) ist der skalierte DSP-Sensorausgang. Die Anzeige liest den Chipwert wiederholt und rechnet ihn mit dem konfigurierten DSP-Endwert (standardmässig ±32’000 Digits) in den gewählten Anzeigebereich um. Ein DSP-Wert allein belegt keine gültige Kalibrierung.',pga1:'Erste Druckverstärkungsstufe: 3.5×, 6×, 8.5× oder 11× (typische Werte laut Datenblatt 2023). Für gutes SNR möglichst hoch ohne Übersteuerung.',pga2:'Zweite Verstärkungsstufe: typische Faktoren 2× bis 10×. Der Gesamtfaktor ist PGA1 × PGA2.',offset:'17 DAC-Stufen von −400 bis +400 mV/V bezogen auf die Brückenspannung. Die Verschiebung liegt zwischen PGA1 und PGA2.',pressureunit:'Einheit für die Referenz- und Prüfdruckwerte. Für relative Kalibrierungen kann beispielsweise % mit 0 bis 100 gewählt werden. Referenzwerte müssen zum tatsächlichen Prüfstand passen. Einheitenwechsel erfordert neue Messpunkte.',dsp_limit:'Symmetrischer DSP-Endwert für die neue Kalibrierung. Standard ±32’000 Digits. ±30’000 lässt zusätzlich Reserve. Der Wert verändert die berechneten Koeffizienten sowie DSP-Soll und Fehlerumrechnung; er ist keine Hardware-Clipping-Grenze.',ram:'PGA1, Offset und PGA2 werden mit jeder Pfeiltaste sofort ausschliesslich in CFG_AFE1 0x1C im RAM geändert und rückgelesen. Kein NVM-/EEPROM-Schreiben. Boot-/Kommunikationsregister werden kontrolliert.',};
 const h=P.hx;
 const fmt=n=>n===null||n===undefined||!Number.isFinite(n)?'—':Math.round(n).toLocaleString('de-CH');
 const now=()=>new Date().toLocaleTimeString('de-CH',{hour12:false});
 const show=(id,text,type='')=>{const e=$(id);if(!e)return;e.textContent=text;e.className='callout'+(type?' '+type:'')};
 const logging=t=>{st.log.push(now()+'  '+t);if(st.log.length>500)st.log.shift();$('usbLog').textContent=st.log.slice(-90).join('\n')};
 const hexWords=arr=>arr.map(x=>P.hx(x,2)).join(' ');
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const sameBoot=(a,b)=>!!a&&!!b&&LOCKED.every(k=>a[k]===b[k]);
 function renderStatus(){let connected=!!st.port;$('status').textContent=demoEnabled?'Demo · Simulation':st.chip?'Chip-Leseantwort plausibel':connected?'USB verbunden · Chipprüfung offen':'Nicht verbunden';$('statusDot').className='dot'+(st.chip?' active':'');$('fw').textContent=st.firmware?st.firmware.slice(0,19):'—';$('chip').textContent=st.chip?'Antwort erhalten':'—';$('ifaceLabel').textContent=st.iface==='plc'?'1-Wire':st.iface==='i2c'?'I²C':'SPI';$('srcLabel').textContent=st.adc?.source==='usb'?'USB / Chip':'Keine Messdaten';$('choose').disabled=connected||demoEnabled;$('auto').hidden=demoEnabled;$('disconnect').hidden=demoEnabled;$('adapterType').disabled=demoEnabled;$('iface').disabled=demoEnabled;$('guidedLaunch').disabled=!st.chip||st.closing;$('guidedLaunch').classList.toggle('primary',st.chip&&!st.closing);$('auto').disabled=connected;$('disconnect').disabled=!connected||st.closing;$('readNow').disabled=!connected;$('live').disabled=!connected;$('live').textContent=st.live?'Live-Messung stoppen':'Live-Messung starten';$('readBoot').disabled=!st.chip;$('readRegs').disabled=!st.chip;$('afeWord').textContent=st.afe===null?'CFG_AFE1: —':'CFG_AFE1: 0x'+h(st.afe,2);const startupTools=$('plcStartupTools');if(startupTools)startupTools.hidden=demoEnabled||st.adapterKind!=='ssp3'||st.iface!=='plc';
 if($('plcStartupProbe'))$('plcStartupProbe').disabled=!connected||st.chip||st.startupRunning||st.closing||st.writing||st.nvmWorking||st.calTask;
 if($('plcStartupStop'))$('plcStartupStop').disabled=!st.startupRunning;
 renderAFEStepperState();renderFlowState();renderDSPLive()};
 function gainSummary(){
  const g=st.staged;
  for(const k of ['pga1','pga2','offset'])$(k).value=String(g[k]);
  $('pga1val').textContent=GAINS1[g.pga1]+'×';
  $('offsetval').textContent=(g.offset*50>0?'+':'')+(g.offset*50)+' mV/V';
  $('pga2val').textContent=GAINS2[g.pga2]+'×';
  $('gainInfo').textContent=`PGA1 ${GAINS1[g.pga1]}× · Offset ${g.offset*50} mV/V · PGA2 ${GAINS2[g.pga2]}× · Gesamt ${(GAINS1[g.pga1]*GAINS2[g.pga2]).toFixed(2)}×`;
  renderStatus()
 }
 function renderAFEStepperState(){
  const busy=st.calTask||st.writing||st.nvmWorking;
  for(const [k,min,max] of [['pga1',0,3],['pga2',0,8],['offset',-8,8]]){
   $(k+'Down').disabled=busy||st.staged[k]<=min;
   $(k+'Up').disabled=busy||st.staged[k]>=max
  }
 }
 function stepAFE(k,increment){
  if(st.calTask||st.writing||st.nvmWorking){
   show('writeMsg','Ein Kalibrier-, AFE- oder NVM-Vorgang läuft. Bitte zuerst abschliessen.','warn');
   return
  }
  const limits={pga1:[0,3],pga2:[0,8],offset:[-8,8]};
  const [min,max]=limits[k];
  const next=Math.max(min,Math.min(max,st.staged[k]+increment));
  if(next===st.staged[k])return;
  const target={...st.staged,[k]:next};
  if(!st.port||!st.chip){
   show('writeMsg','Für die direkte RAM-Übernahme zuerst den Sensor verbinden.','warn');
   return
  }
  // Jede Pfeiltaste schreibt sofort genau eine gültige Stufe ins Chip-RAM.
  // Weitere Pfeiltasten bleiben bis zum bestätigten Rücklesen gesperrt.
  return commitGain(target)
 }
 

 function getManualDSPRange(){
  const min=Number($('dspDisplayMin').value),max=Number($('dspDisplayMax').value),limit=Number($('dspDisplayLimit').value);
  const unit=$('dspDisplayUnit').value;
  return Number.isFinite(min)&&Number.isFinite(max)&&max>min&&Number.isInteger(limit)&&limit>=1000&&limit<=32000&&['%','bar','mbar','kPa','psi'].includes(unit)?{min,max,unit,limit,kind:'display'}:null
 }
 function getActiveDSPRange(){
  if(st.calStaged&&st.calfit){
   const min=Number($('pmin').value),max=Number($('pmax').value);
   if(Number.isFinite(min)&&Number.isFinite(max)&&max>min&&Number.isInteger(st.calfit.outputLimit))return {min,max,unit:pressureUnit(),limit:st.calfit.outputLimit,kind:'ram'}
  }
  return getManualDSPRange()
 }
 function dspNumber(n){return Number.isFinite(n)?n.toLocaleString('de-CH',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}
 function renderLiveOverview(){
  const connected=!!st.port&&st.chip;
  const activeADC=connected&&st.adc&&Number.isFinite(st.adc.s);
  const activeDSP=connected&&st.dsp&&Number.isInteger(st.dsp.raw)&&!st.dspError;
  const range=getActiveDSPRange();
  const converted=activeDSP&&range?range.min+(st.dsp.raw+range.limit)/(2*range.limit)*(range.max-range.min):NaN;
  $('liveAdcS').textContent=activeADC?fmt(st.adc.s):'—';
  $('liveAdcT').textContent=activeADC&&Number.isFinite(st.adc.t)?fmt(st.adc.t):'—';
  $('liveDspS').textContent=activeDSP?fmt(st.dsp.raw):'—';
  $('livePressure').textContent=Number.isFinite(converted)?dspNumber(converted):'—';
  $('livePressureUnit').textContent=range?.unit||'—';
  const highADC=!!activeADC&&Math.abs(st.adc.s)>25000;
  $('liveAdcAlert').hidden=!highADC;
  $('liveAdcS').parentElement?.classList.toggle('live-warning',highADC);
  const ongoing=st.writing||st.calTask||st.nvmWorking;
  const mode=!connected?'Offline':ongoing?'Chipvorgang läuft':st.live?'Live':st.dspError?'DSP-Lesefehler':st.manualLivePause?'Manuell pausiert':'Pausiert';
  $('liveState').textContent=mode;
  $('liveStateDot').className='live-meta-dot'+(ongoing?' is-working':st.live?' is-live':'');
  const measured=activeADC?st.adc.time:activeDSP?st.dsp.time:null;
  $('liveLastRead').textContent=measured?new Date(measured).toLocaleTimeString('de-CH'):'Keine Messwerte';
  $('livePressure').parentElement?.setAttribute('title',range?
   (range.kind==='ram'?'Neue RAM-Kalibrierung: ':'Manuell eingestellter Anzeigebereich: ')+range.min+'–'+range.max+' '+range.unit+'; DSP-Endwert ±'+range.limit+'. Kein Ersatz für die Prüfpunkt-Verifikation.':
   'Kein gültiger Anzeigebereich');
 }
 function renderDSPLive(){
  const connected=!!st.port&&st.chip;
  const fresh=connected&&st.dsp&&Number.isInteger(st.dsp.raw);
  const range=getActiveDSPRange();
  const val=fresh&&range?range.min+(st.dsp.raw+range.limit)/(2*range.limit)*(range.max-range.min):NaN;
  const source=st.dspError?'DSP_S-Lesefehler':st.nvmDone?'Neue Kennlinie in NVM, Neustart noch prüfen':st.calStaged?'Neue Koeffizienten im RAM':st.chip?'DSP-Ausgabe des Chips – Kalibrierung nicht automatisch bestätigt':'Kein Chip verbunden';
  const time=st.dspError?'DSP_S (0x30) konnte nicht gelesen werden':fresh?new Date(st.dsp.time).toLocaleTimeString('de-CH'):'Noch keine DSP-Messung';
  for(const prefix of ['afe','verify']){
   $(prefix+'DspValue').textContent=dspNumber(val);
   $(prefix+'DspUnit').textContent=range?.unit||'—';
   $(prefix+'DspRaw').textContent=fresh?'DSP_S: '+fmt(st.dsp.raw)+' Digits':'DSP_S: — Digits';
   $(prefix+'DspSeen').textContent=!range?'Anzeigebereich ungültig':st.dspError?time:'Letzte Messung: '+time;
   $(prefix+'DspMode').textContent=source;
  }
  renderLiveOverview();
  const note=$('dspDisplayHint');
  note.textContent=range?.kind==='ram'?
   'Die aktuelle RAM-Kalibrierung verwendet ±'+fmt(range.limit)+' DSP-Digits für den Bereich '+range.min+' bis '+range.max+' '+range.unit+'. Die manuellen Werte gelten nur ohne neue RAM-Kalibrierung.':
   range?'Manuelle Zuordnung: DSP_S −'+fmt(range.limit)+' bis +'+fmt(range.limit)+' Digits entspricht '+range.min+' bis '+range.max+' '+range.unit+'. Nur Anzeige; keine Sensorregister verändert.':
   'Ungültiger Anzeigebereich: Maximum muss grösser als Minimum sein.'
 }
 function updateDSP(raw,source){
  if(!Number.isInteger(raw)||raw<-32768||raw>32767)throw Error('Ungültiger DSP_S-Wert');
  st.dsp={raw,source,time:Date.now()};st.dspError=null;renderDSPLive()
 }
 function loadDSPDisplay(){
  const saved=lsGet('elmos-dsp-output-range-v1');if(!saved)return;
  try{
   const x=JSON.parse(saved);
   if(!Number.isFinite(x.min)||!Number.isFinite(x.max)||x.max<=x.min||!['%','bar','mbar','kPa','psi'].includes(x.unit))return;
   $('dspDisplayMin').value=String(x.min);$('dspDisplayMax').value=String(x.max);$('dspDisplayUnit').value=x.unit;
   if(Number.isInteger(x.limit)&&x.limit>=1000&&x.limit<=32000)$('dspDisplayLimit').value=String(x.limit);
  }catch(_){}
 }
 function saveDSPDisplay(){
  const range=getManualDSPRange();
  if(range)lsSet('elmos-dsp-output-range-v1',JSON.stringify({min:range.min,max:range.max,unit:range.unit,limit:range.limit}));
  renderDSPLive()
 }
  function pressureUnit(){const opt=$('calUnit').value;return opt==='custom'?($('calUnitOther').value.trim()||'Einheit'):opt}
 function pointName(which){return ($((which==='lo'?'pointLoName':'pointHiName')).value.trim()||('Messpunkt '+(which==='lo'?'1':'2')))}
 function calibrationPointCount(){const count=Number($('calPointCount').value);return Number.isInteger(count)&&count>=2&&count<=10?count:Infinity}
 function calEndpointsReady(){
  const count=calibrationPointCount(),lo=st.points.lo,hi=st.points.hi;
  if(!Number.isFinite(count)||!lo||!hi||!Number.isFinite(lo.v)||!Number.isFinite(hi.v)||Math.abs(lo.v-hi.v)<10)return false;
  const gains=JSON.stringify(st.staged);
  if(JSON.stringify(lo.gains)!==gains||JSON.stringify(hi.gains)!==gains)return false;
  if(st.calpoints.length!==count||st.calpoints.some(x=>JSON.stringify(x.gains)!==gains||!Number.isFinite(x.adc_s)))return false;
  const pmin=Number($('pmin').value),pmax=Number($('pmax').value);
  if(!(pmax>pmin)||lo.pressure!==pmin||hi.pressure!==pmax)return false;
  if(st.calpoints.filter(x=>x.kind==='lo').length!==1||st.calpoints.filter(x=>x.kind==='hi').length!==1)return false;
  return Array.from({length:count-2},(_,i)=>i+1).every(slot=>st.calpoints.filter(x=>x.kind==='extra'&&x.slot===slot).length===1)
 }
 function chosenCalibrationSamples(){
  const n=Number($('calSampleCount').value);
  if(!Number.isInteger(n)||n<1||n>100)throw Error('Anzahl Samples muss eine ganze Zahl zwischen 1 und 100 sein');
  return n
 }
 function renderCapturedPoint(statusId,resultId,record){
  const status=$(statusId),box=$(resultId);
  status.classList.toggle('is-captured',!!record);
  status.textContent=record?'✓ Aufgenommen':'Noch nicht aufgenommen';
  box.replaceChildren();
  box.hidden=!record;
  if(!record)return;
  const title=document.createElement('div');
  title.className='cal-measure-heading';
  title.textContent='✓ Messpunkt erfolgreich übernommen · '+record.name;
  box.appendChild(title);
  const grid=document.createElement('div');grid.className='cal-measure-grid';
  const measuredCount=Number.isInteger(record.sampleCount)?record.sampleCount:null;
  const precision=n=>Number(n).toLocaleString('de-CH',{maximumFractionDigits:1});
  const entries=[
   ['ADC_S · Median',precision(record.adc_s)+' Digits'],
   ['ADC_T · Median',precision(record.adc_t)+' Digits'],
   ['Streuung ADC_S',measuredCount===1?'Nicht messbar':precision(record.spread)+' Digits'],
   ['Samples',measuredCount===null?'—':String(measuredCount)]
  ];
  for(const [label,value] of entries){
   const item=document.createElement('div');item.className='cal-measure-cell';
   const caption=document.createElement('span');caption.className='cal-measure-label';caption.textContent=label;
   const reading=document.createElement('strong');reading.className='cal-measure-value';reading.textContent=value;
   item.appendChild(caption);item.appendChild(reading);grid.appendChild(item)
  }
  box.appendChild(grid);
  const note=document.createElement('div');note.className='cal-measure-note';
  note.textContent='Referenz: '+record.pressure+' '+(record.unit||pressureUnit())+
   ' · Temperatur: '+record.temperature+' °C'+
   (measuredCount===1?' · Achtung: Nur ein Sample – keine Stabilitätskontrolle möglich.':' · Median aller aufgenommenen Samples');
  box.appendChild(note)
 }
 async function measureCalibrationSamples(label){
  const required=chosenCalibrationSamples();
  if(st.calTask||st.writing||st.nvmWorking)throw Error('Ein Mess- oder Wartungsvorgang läuft');
  const resumeLive=st.live;
  st.calTask=true;stopLive();
  const progress=$('calSampleProgress');
  progress.hidden=false;progress.textContent=label+': Messung wird vorbereitet …';
  renderFlowState();
  try{
   if(st.liveReadPromise)await st.liveReadPromise.catch(()=>{});
   const values=[];
   for(let i=0;i<required;i++){
    const value={s:P.sign16(await readReg(0x2A)),t:P.sign16(await readReg(0x28)),tc:P.sign16(await readReg(0x26))};
    values.push(value);
    progress.textContent=label+': '+(i+1)+' / '+required+' Samples aufgenommen';
    if(i<required-1)await sleep(60)
   }
   const ordered=k=>values.map(x=>x[k]).sort((a,b)=>a-b);
   const median=x=>required%2?x[Math.floor(required/2)]:(x[required/2-1]+x[required/2])/2;
   const pressure=ordered('s'),temperature=ordered('t'),compensated=ordered('tc');
   const spread=pressure[required-1]-pressure[0];
   if(required>1&&spread>350)throw Error('ADC_S streut zu stark ('+spread+' Digits). Druck stabilisieren und erneut messen');
   return {adc_s:median(pressure),adc_t:median(temperature),adc_tc:median(compensated),spread,sampleCount:required}
  }finally{
   progress.hidden=true;st.calTask=false;
   if(resumeLive&&st.chip)startLive();
   else renderStatus()
  }
 }
 function renderCalibrationPlan(){
  const count=calibrationPointCount();
  if(!Number.isFinite(count))return show('calPointPlanMsg','Anzahl muss zwischen 2 und 10 liegen.','error');
  $('pointHiHeading').textContent='Messpunkt '+count+' · Oberer Endpunkt';
  if(!$('pointHiName').dataset.userEdited)$('pointHiName').value='Messpunkt '+count;
  renderCapturedPoint('lowVal','calLoResult',st.calpoints.find(x=>x.kind==='lo'));
  renderCapturedPoint('highVal','calHiResult',st.calpoints.find(x=>x.kind==='hi'));
  for(let k=1;k<=8;k++){
   $('calExtra'+k+'Row').hidden=k>count-2;
   $('calExtra'+k+'Heading').textContent='Messpunkt '+(k+1)+' · Zwischenpunkt';
   $('calExtra'+k+'Capture').textContent='Messpunkt '+(k+1)+' aufnehmen';
   if(!$('calExtra'+k+'Name').dataset.userEdited)$('calExtra'+k+'Name').value='Messpunkt '+(k+1);
   renderCapturedPoint('calExtra'+k+'State','calExtra'+k+'Value',st.calpoints.find(x=>x.kind==='extra'&&x.slot===k));
  }
  const done=st.calpoints.length,complete=calEndpointsReady();
  $('calPointPlanMsg').textContent=complete?'Alle '+count+' Kalibrierpunkte aufgenommen. Weiter zur Berechnung.':count+' Kalibrierpunkte gewählt · '+done+' von '+count+' aufgenommen.';
  $('calPointPlanMsg').className='callout'+(complete?' success':'')
 }
 function fillIntermediateReferences(){
  const count=calibrationPointCount(),lo=Number($('pmin').value),hi=Number($('pmax').value);
  if(!Number.isFinite(count)||!(hi>lo))return;
  for(let k=1;k<=8;k++){
   const field=$('calExtra'+k+'Pressure');
   if(!field.dataset.userEdited)field.value=String(Number((lo+(hi-lo)*k/(count-1)).toFixed(5)))
  }
  renderCalibrationPlan()
 }
 function verificationRequiredCount(){
  const n=Number($('calVerifyCount').value);
  return Number.isInteger(n)&&n>=1&&n<=10?n:Infinity;
 }
 function coefficientSettingsCurrent(){
  return !!st.calfit&&Number($('calDspLimit').value)===st.calfit.outputLimit&&
   Number($('calSOrder').value)===st.calfit.orderS&&Number($('calTOrder').value)===st.calfit.orderT
 }
 function verificationComplete(){
  const count=verificationRequiredCount();
  return !!st.calVerified&&coefficientSettingsCurrent()&&!!st.calStaged&&calEndpointsReady()&&Number.isFinite(count)&&st.calValidation.length>=count
 }
 function updateVerificationProgress(){
  const required=verificationRequiredCount(),done=st.calValidation.length;
  if(!Number.isFinite(required)){
   $('calVerifyProgress').textContent='Bitte eine ganze Zahl zwischen 1 und 10 eingeben.';
   $('calVerifyCoverage').textContent='Ungültige Anzahl: Die NVM-Freigabe bleibt gesperrt.';
   return
  }
  $('calVerifyProgress').textContent=done+' von '+required+' Prüfpunkten erfolgreich.';
  $('calVerifyCoverage').textContent=required===1?
   'Ein Prüfpunkt (Standard): Die DSP-Kalibrierung wird nur an einer Stelle geprüft. Das ist keine Verifikation des gesamten Druckbereichs. Bei Temperaturkompensation sind zusätzliche Temperaturprüfungen nötig.':
   required+' Prüfpunkte: Jeder Prüfwert muss innerhalb der Toleranz liegen und ausreichend Abstand zu den anderen Punkten haben. Bei Temperaturkompensation müssen zusätzlich verschiedene Temperaturen geprüft werden.'
 }
 function workflowGate(n){
  if(n===7)return ''; // EEPROM Viewer unabhängig vom Kalibrierablauf: nur lesen.
  if(n===5)return ''; // Eigener Ausgangsschritt ist auch bei bestehenden Sensoren erreichbar.
  if(n===6&&(expert.restoreReady()||expert.outputReady()))return '';
  if(n>=3&&!calEndpointsReady())return 'Zuerst alle '+calibrationPointCount()+' gewählten Kalibrierpunkte bei gleicher AFE-Einstellung aufnehmen.';
  if(n>=4&&(!coefficientSettingsCurrent()||!st.calStaged))return 'Zuerst die Koeffizienten für den eingestellten DSP-Endwert berechnen und ins RAM übertragen.';
  if(n>=6&&!verificationComplete()&&!expert.restoreReady())return 'NVM bleibt gesperrt: Zuerst '+(Number.isFinite(verificationRequiredCount())?verificationRequiredCount()+' Prüfpunkte':'eine gültige Anzahl Prüfpunkte')+' über DSP_S im RAM erfolgreich verifizieren.';
  return ''
 }
 function renderFlowState(){
  updateVerificationProgress();
  const ready=coefficientSettingsCurrent()&&calEndpointsReady();
  const enabled=ready&&!!st.port&&!!st.chip&&st.mode==='usb'&&!st.writing&&!st.calTask&&!st.nvmWorking;
  $('calRamPrereq').textContent=!ready?
   'Zuerst alle Kalibrierpunkte erfassen und die Koeffizienten berechnen.':
   !st.chip||!st.port?'Echte Chipverbindung erforderlich.':
   st.calStaged?'DSP-Koeffizienten ins RAM übertragen und rückgelesen. Weiter zur DSP-Prüfung.':
   'Bereit: Koeffizienten können ohne vorheriges NVM-Backup ins RAM geschrieben werden.';
  $('calRamPrereq').className='callout'+(enabled?' success':'');
  $('calApplyRam').disabled=!enabled;
  const verified=(verificationComplete()||expert.restoreReady()||expert.outputReady())&&!!st.port&&!!st.chip&&!st.nvmWorking&&!st.writing&&!st.calTask;
  $('nvmBackupRead').disabled=!verificationComplete()||!st.port||!st.chip||st.nvmWorking||st.writing||st.calTask;
  $('nvmBackupDownload').disabled=!st.nvmBackupVerified||!st.nvmBackup;
  $('nvmAutoBackup').disabled=st.nvmWorking||st.writing||st.calTask;
  $('nvmPrepare').disabled=!verificationComplete()||!st.port||!st.chip||st.writing||st.calTask||st.nvmWorking||!!st.restorePlan||!!st.outputOnlyPlan;
  const restoring=expert.restoreReady(),outputOnly=expert.outputReady();
  $('nvmProgram').textContent=demoEnabled?'NVM-Programmierung simulieren':restoring?'Backup auf diesem Chip wiederherstellen':outputOnly?'AODO-Ausgangseinstellungen im NVM speichern':'Kalibrierung dauerhaft ins NVM schreiben';
  const recognizedUid=st.uid?.hex||'';
  if(st.uidShownForInput!==recognizedUid){
   $('nvmConfirmId').value=recognizedUid;
   st.uidShownForInput=recognizedUid;
  }
  $('nvmUidHint').textContent=recognizedUid?
   'Aus dem Chip gelesen: '+recognizedUid+' · Feld automatisch ausgefüllt; eine Änderung wird vor dem Schreiben mit dem Sensor abgeglichen.':
   'Chip-UID wird nach erfolgreicher Sensorverbindung automatisch eingetragen.';
  let nvmReason='';
  if(st.iface!=='plc')nvmReason='1-Wire-Startschutz: Dauerhaftes NVM-Schreiben ausschliesslich über 1-Wire möglich. Bitte per 1-Wire verbinden.';
  else if(!verified||st.mode!=='usb')nvmReason='Zuerst die DSP-Prüfung abschliessen und sicherstellen, dass der echte Chip verbunden ist.';
  else if(!st.nvmBackupVerified||!st.nvmBackup)nvmReason='Zuerst Original-NVM vollständig lesen und prüfen.';
  else if(!st.calImage)nvmReason='Zuerst «NVM lesen & Änderungen prüfen» drücken. Anschliessend kann gespeichert werden.';
  else if(!recognizedUid||st.uid.ser0!==st.nvmBackup[0]||st.uid.ser1!==st.nvmBackup[1])nvmReason='Chip-UID wurde nicht vollständig mit dem NVM-Backup abgeglichen.';
  else if(!/^[0-9A-Fa-f]{12}$/.test($('nvmConfirmId').value.trim()))nvmReason='Chip-UID muss genau 12 Hex-Ziffern enthalten.';
  else if($('nvmConfirmId').value.trim().toUpperCase()!==recognizedUid)nvmReason='Die editierte UID stimmt nicht mit dem aktuell verbundenen Chip überein. Programmierung gesperrt.';
  const outputStatus=$('outputOneWireStatus');
  if(outputStatus){
   const connected=st.mode==='usb'&&st.iface==='plc'&&st.chip;
   const saved=st.nvmBackupVerified&&st.nvmBackup?.length===64?CAL.oneWireStartupStatus(st.nvmBackup):null;
   const safeSaved=!!saved?.ok;
   outputStatus.textContent=!connected?
    '1-Wire-Verbindung zum Chip nicht bestätigt. Dauerhaftes NVM-Schreiben gesperrt.':
    saved?
     safeSaved?'1-Wire aktuell verbunden. NVM-Startup geprüft: AODO-Modus '+saved.mode+
      ', PLC-Zeitfenster '+saved.windowLabel+', Downstream/Upstream und persistenter Registerzugriff aktiv. Nach NVM-Schreiben trotzdem Kaltstart am Testchip prüfen.':
      '1-Wire aktuell verbunden, aber das gesicherte NVM erfüllt den Datenblatt-Startschutz nicht: '+saved.errors.join('; ')+'. NVM-Schreiben gesperrt.':
     '1-Wire aktuell verbunden. Für die Startschutz-Prüfung zuerst das Original-NVM vollständig auslesen. Das momentane Erreichen des Chips garantiert keinen Zugriff nach Neustart.';
   outputStatus.className='callout '+(connected&&safeSaved?'success':'warn');
   if(saved&&!safeSaved&&!nvmReason)nvmReason='1-Wire-Startschutz: '+saved.errors.join('; ')+'. NVM-Schreiben gesperrt.';
  }
  const eepromReadBtn=$('eepromRead');
  if(eepromReadBtn)eepromReadBtn.disabled=!st.port||!st.chip||st.calTask||st.writing||st.nvmWorking;
  const outputNvmRead=$('outputNvmRead');if(outputNvmRead)outputNvmRead.disabled=!st.port||!st.chip||st.writing||st.calTask||st.nvmWorking;
  const approvalGranted=nvmReason==='';
  $('nvmProgram').disabled=!approvalGranted;
  const bootCheckBusy=st.closing||st.nvmWorking||st.writing||st.calTask;
  $('nvmRestart').hidden=!st.nvmDone||!(st.sensorPowerEnabled||demoEnabled);
  $('nvmRestart').disabled=bootCheckBusy||!st.chip||!st.port;
  $('nvmPostBoot').disabled=bootCheckBusy||!st.chip||!st.port;
  $('nvmWritePrereq').textContent=approvalGranted?
   'Bereit: Chip-UID stimmt, NVM-Änderungsplan und CRC sind geprüft. Beim Klick wird '+($('nvmAutoBackup').checked?'das alte NVM vor dem Schreiben automatisch gesichert und danach':'ohne zusätzliches Backup')+' programmiert.':
   nvmReason;
  $('nvmWritePrereq').className='callout '+(approvalGranted?'success':'warn');
  const unlocked=[true,true,true,calEndpointsReady(),ready&&st.calStaged,true,!workflowGate(6),true];
  document.querySelectorAll('[data-step]').forEach(b=>{
   const index=Number(b.dataset.step);b.classList.toggle('locked',!unlocked[index]);
   b.setAttribute('aria-disabled',String(!unlocked[index]));
   b.title=unlocked[index]?'':workflowGate(index)
  });
  for(const btn of document.querySelectorAll('[data-next]')){
   const index=Number(btn.dataset.next);
   if(index>2){btn.disabled=!unlocked[index];btn.title=unlocked[index]?'':workflowGate(index)}
   else btn.disabled=false
  }
 }
 function refreshUnitLabels(){
  const unit=pressureUnit(),lo=Number($('pmin').value),hi=Number($('pmax').value);
  document.querySelectorAll('[data-cal-unit]').forEach(el=>{el.textContent=unit});
  $('pointLoDisplay').textContent=Number.isFinite(lo)?lo+' '+unit:'—';
  $('pointHiDisplay').textContent=Number.isFinite(hi)?hi+' '+unit:'—';
  $('customUnitLabel').hidden=$('calUnit').value!=='custom';
  renderCalPoints();renderCalibrationPlan();renderLiveOverview();
 }
 function step(n){
  const next=Math.max(0,Math.min(7,Number(n)));
  const blocked=workflowGate(next);
  if(blocked){show('flowMsg',blocked,'warn');$('flowMsg').hidden=false;renderFlowState();return}
  currentStep=next;$('flowMsg').hidden=true;
  document.querySelectorAll('.panel').forEach(x=>x.hidden=Number(x.dataset.panel)!==next);
  document.querySelectorAll('[data-step]').forEach(button=>{
   const active=Number(button.dataset.step)===next;
   button.classList.toggle('active',active);
   if(active)button.setAttribute('aria-current','step');
   else button.removeAttribute('aria-current');
  });
  renderFlowState();if(next===5)expert.refreshOutputPreview();if(next===7)expert.refreshEEPROMViewer();draw();if(!st.manualLivePause&&st.chip)startLive()
 }
 function invalidateCalculation(reason){
  st.calfit=null;st.calImage=null;st.calStaged=false;st.calVerified=false;st.calValidation=[];st.nvmBackup=null;st.nvmBackupVerified=false;
  $('calCoeffList').textContent='Noch nicht berechnet.';
  $('calVerifyList').textContent='Noch keine unabhängigen Prüfpunkte.';
  show('calFitMsg',reason||'Koeffizienten müssen neu berechnet werden.','warn');
  show('calRamMsg','Keine gültige RAM-Verifikation. Zuerst neu rechnen und ins RAM übertragen.','warn');
  show('calRamStageMsg','Keine aktuellen DSP-Koeffizienten im RAM bestätigt. Nach einer neuen Berechnung erneut übertragen.','warn');
  renderFlowState()
 }
 function handleReferenceChange(){
  if(st.points.lo||st.points.hi||st.calpoints.length)erasePoints();
  invalidateCalculation('Referenzbereich oder Einheit geändert. Bitte die Messpunkte neu aufnehmen.');
  const pmin=Number($('pmin').value),pmax=Number($('pmax').value);
  if(Number.isFinite(pmin)&&Number.isFinite(pmax)&&pmax>pmin){
   const m=(pmin+pmax)/2;
   for(const id of ['ptest','calVerifyPressure'])$(id).value=m;
  }
  for(let k=1;k<=8;k++)$('calExtra'+k+'Pressure').dataset.userEdited='';
  fillIntermediateReferences();refreshUnitLabels()
 }

 
 const erasePoints=()=>{
  st.points={lo:null,hi:null};st.verify=null;st.calpoints=[];st.calfit=null;st.calImage=null;st.calStaged=false;st.calVerified=false;st.calValidation=[];
  renderCalPoints();$('lowVal').textContent='Noch nicht erfasst';$('highVal').textContent='Noch nicht erfasst';$('hub').textContent='—';$('middle').textContent='—';$('usage').textContent='—';
  $('calCoeffList').textContent='Noch nicht berechnet.';$('calVerifyList').textContent='Noch keine unabhängigen Prüfpunkte.';
  show('calMsg','Messpunkte nach einer Änderung erneut aufnehmen.');renderCalPoints();renderFlowState()
 };

 const rawLine=s=>{st.log.push(now()+'  '+s);if(st.log.length>500)st.log.shift();$('usbLog').textContent=st.log.slice(-90).join('\n')};
 async function readerLoop(port){try{let r=port.readable.getReader();st.reader=r;try{while(st.port===port&&!st.closing){const{value,done}=await r.read();if(done)break;if(!value)continue;let txt=new TextDecoder().decode(value);rawLine('RX '+txt.replace(/\r/g,'\\r').replace(/\n/g,'\\n'));if(st.responseWait){st.replyBuffer+=txt;const colon=st.replyBuffer.match(/(?:^|[\r\n])\s*:\s*(?:\r|\n|$)/);if(colon){const waiter=st.responseWait;st.responseWait=null;clearTimeout(waiter.timer);const out=st.replyBuffer;st.replyBuffer='';waiter.resolve(out)}else if(st.replyBuffer.length>16000){const waiter=st.responseWait;st.responseWait=null;clearTimeout(waiter.timer);waiter.reject(Error('SSP3-Antwort zu lang'))}}}}finally{r.releaseLock();if(st.reader===r)st.reader=null}}catch(e){if(st.port===port){logging('USB-Lesefehler: '+e.message);st.chip=false;stopLive();renderStatus();show('connMsg','USB-Lesefehler: '+e.message,'error')}}}
 function serialize(fn){const run=st.cmdQueue.then(fn,fn);st.cmdQueue=run.catch(()=>{});return run}
 async function exchange(text,timeout=2500){return serialize(async()=>{if(!st.closing&&demoPort&&st.port===demoPort)return demoPort.exchange(text);if(st.closing||!st.port?.writable)throw Error('USB-Verbindung nicht geöffnet');if(st.responseWait)throw Error('Interner Befehlskonflikt');st.replyBuffer='';let resolver,rejecter;const future=new Promise((res,rej)=>{resolver=res;rejecter=rej});const ticket={resolve:resolver,reject:rejecter,timer:setTimeout(()=>{if(st.responseWait===ticket){st.responseWait=null;ticket.reject(Error((st.adapterKind==='bridge'?'ESP32':'SSP3')+' antwortet nicht auf '+text.slice(0,18))) }},timeout)};st.responseWait=ticket;future.catch(()=>{});const writer=st.port.writable.getWriter();try{logging('TX '+text);await writer.write(new TextEncoder().encode(text+'\r'))}catch(e){if(st.responseWait===ticket){st.responseWait=null;clearTimeout(ticket.timer);rejecter(e)}throw e}finally{writer.releaseLock()}const ans=await future;if(ans.split(/[\r\n]+/).some(l=>l.trim().startsWith('!')))throw Error((st.adapterKind==='bridge'?'ESP32':'SSP3')+' meldet Fehler: '+ans.slice(0,140));return ans})}
 async function firmware(){let a=await exchange('.VERSION',1600);let lines=a.split(/[\r\n]+/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')&&x!==':'&&!x.startsWith('@'));st.firmware=lines.join(' ').replace(/^\.VERSION/i,'').trim().slice(0,80)||'Antwort erhalten';renderStatus()}
 const ifcfg={plc:'IF_CFG 7 0 0',i2c:'IF_CFG 2 1 0',spi:'IF_CFG 1 1 0'};
 async function selectChipInterface(){await exchange(ifcfg[st.iface]);logging('Programmieradapter-Schnittstellenmodus '+st.iface+' gesetzt (nicht NVM).')}
 async function bridgeHello(){
  const response=await exchange('BRIDGE_INFO',1600);
  const match=response.match(/E70311-BRIDGE\s+V1\s+CAPS=([A-Z0-9_,]+)/);
  if(!match)throw Error('Kein kompatibler E703.11 USB-CDC-Bridge-Handshake. Bitte Bridge-Firmware prüfen.');
  const caps=match[1].split(',');
  st.firmware='USB-CDC Bridge v1 · '+caps.join('/');
  renderStatus();logging('USB-Bridge CAPS: '+caps.join(','));
  const ready=['PLC_READ','PLC_WRITE','NVM'].every(cap=>caps.includes(cap));
  const powerPin=caps.find(cap=>/^POWER_GPIO_\d+$/.test(cap))?.slice('POWER_GPIO_'.length);
  $('sensorPowerPin').textContent=ready?' (GPIO'+(powerPin??'7')+')':'';
  if(!ready){
   show('connMsg','USB-Bridge erkannt. Für Chipzugriff ist die ESP32-C3 PLC-Firmware erforderlich.','warn');
  }
  return ready;
 }


 // Diagnostic only. CRC8 is displayed, never treated as independently valid
 // until the SSP3 packet framing is verified against an Elmos reference trace.
 const afeBits=w=>({
  bit11:(w>>>11)&1,binary:w.toString(2).padStart(16,'0'),pga1:w&3,
  offset:(w>>>2)&31,pga2:(w>>>7)&15,reservedHigh:(w>>>12)&15
 });
 async function readReg(addr,timeoutMs=2500){
  if(!st.port)throw Error('SSP3-Port nicht verbunden');
  if(!Number.isInteger(addr)||addr<0||addr>0xFE||addr%2)throw Error('Ungültige Registeradresse');
  let result;
  if(st.iface==='plc'){
   const command=P.plcRead(addr,1),reply=await exchange(command,timeoutMs);
   const frame={at:new Date().toISOString(),address:addr,command,rawReply:reply.slice(0,1000),status:'parsing'};
   st.lastPlcReply=frame;
   try{
    const bytes=P.readData(reply,3);
    result=(bytes[0]<<8)|bytes[1];
    Object.assign(frame,{status:'parsed',word:result,bytes:bytes.slice(),
      crc8Rx:bytes[2],crc8IndependentCheck:'not-validated'});
    if(addr===R_AFE||st.diagRunning)
     logging('1-Wire 0x'+h(addr)+': Daten '+bytes.map(v=>h(v)).join(' ') +
      ', Wort=0x'+h(result,2)+', CRC8-Byte=0x'+h(bytes[2])+' (noch nicht unabhängig geprüft)');
   }catch(e){
    Object.assign(frame,{status:'malformed',error:e.message});
    logging('1-Wire 0x'+h(addr)+': ungültiges Antwortformat: '+e.message);
    throw e
   }
  }else if(st.iface==='i2c'){
   const bytes=P.readData(await exchange(P.i2cRead(addr)),2);
   result=bytes[0]|(bytes[1]<<8)
  }else{
   const bytes=P.readData(await exchange(P.spiRead(addr)),4);
   result=(bytes[2]<<8)|bytes[3]
  }
  st.regs[addr]=result;return result
 }
 function decodeSafeAFE(w){
  if(!(w&0x0800))throw Error('CFG_AFE1=0x'+h(w,2)+': Pflichtbit 11 ist 0; keine Schreibfreigabe');
  const g=P.decAFE(w);
  if(!P.goodG(g))throw Error('AFE-Codes in CFG_AFE1=0x'+h(w,2)+' nicht für Schreibfreigabe bestätigt');
  return g
 }
 function formatChipDiag(d){
  if(!d)return 'Noch keine Chipdiagnose.';
  const lines=[
   'E703.11 – lesende Chipdiagnose / '+d.reason,
   'Zeit: '+d.at+' · Schnittstelle: '+d.interface,
   'Kein Register wurde durch die Diagnose beschrieben.',
   'CRC8: empfangenes Byte wird protokolliert, aber die unabhängige Prüfung der SSP3-Antwort ist noch offen.',
   ''
  ];
  for(const p of d.probes){
   const frame=p.frame;
   if(p.error){lines.push('0x'+h(p.addr)+' '+p.name+': LESEFEHLER: '+p.error);
    if(frame?.rawReply)lines.push('  Rohantwort: '+frame.rawReply.replace(/[\r\n]+/g,' / '));continue}
   lines.push('0x'+h(p.addr)+' '+p.name+': 0x'+h(p.value,2)+
    (frame?.bytes?' · RX-Bytes '+frame.bytes.map(v=>h(v)).join(' ')+' · CRC8-Byte 0x'+h(frame.crc8Rx):''));
   if(p.addr===R_AFE){
    const a=afeBits(p.value),g=P.decAFE(p.value);
    lines.push('  Binär: '+a.binary+' · Bit11='+a.bit11+' · PGA1-Code='+a.pga1+
      ' · Offset-Code='+a.offset+' · PGA2-Code='+a.pga2+
      (a.pga2>=8?' (10×-Codierungsfamilie)':'')+' · Bits15:12='+a.reservedHigh);
    lines.push('  UI-Decodierung: PGA1='+g.pga1+', PGA2='+g.pga2+', Offset='+g.offset);
   }
   if(frame?.rawReply)lines.push('  Rohantwort: '+frame.rawReply.replace(/[\r\n]+/g,' / ').slice(0,240))
  }
  const reads=d.probes.filter(p=>p.addr===R_AFE&&!p.error).map(p=>p.value);
  const distinct=[...new Set(reads)];
  lines.push('');
  if(!reads.length)lines.push('ERGEBNIS: CFG_AFE1 konnte nicht gelesen werden.');
  else if(distinct.length!==1)lines.push('ERGEBNIS: CFG_AFE1 wechselt zwischen Leseversuchen. Kommunikationsproblem möglich.');
  else if(!(distinct[0]&0x0800))lines.push('ERGEBNIS: CFG_AFE1 wiederholt mit Bit11=0 gelesen. Keine Schreibfreigabe; mit Elmos-PSSC vergleichen.');
  else lines.push('ERGEBNIS: CFG_AFE1 '+reads.length+'× gleich mit Bit11=1 gelesen.');
  lines.push('Gleiche Bytes allein beweisen ohne geprüfte CRC8-Berechnung noch keine fehlerfreie Übertragung.');
  return lines.join('\n')
 }
 async function runChipDiagnostics(reason='Manuelle Diagnose'){
  if(!st.port||st.closing)throw Error('Zuerst den SSP3-USB-Port verbinden');
  if(st.diagRunning||st.startupRunning||st.writing||st.nvmWorking||st.calTask||st.afeWriteActive)
   throw Error('Diagnose nicht während eines Schreib- oder Wartungsvorgangs durchführen');
  st.diagRunning=true;
  const previousLive=st.live;
  if(previousLive){stopLive();if(st.liveReadPromise)await st.liveReadPromise.catch(()=>{})}
  const d={at:new Date().toISOString(),interface:st.iface,reason,probes:[]};
  st.chipDiag=d;
  $('chipDiagDetails').open=true;
  $('chipDiagRead').disabled=true;
  $('chipDiagResult').textContent='Nur lesende Registerdiagnose läuft …';
  try{
   for(const [addr,name] of [[R_AFE,'CFG_AFE1'],[R_AFE,'CFG_AFE1'],[R_AFE,'CFG_AFE1'],
    [0x1A,'CFG_AFE0'],[0x1E,'CFG_AFE2'],[0x2A,'ADC_S']]){
    const p={addr,name},previousFrame=st.lastPlcReply;
    try{p.value=await readReg(addr)}catch(e){p.error=e.message}
    if(st.iface==='plc'&&st.lastPlcReply!==previousFrame)p.frame={...st.lastPlcReply};
    d.probes.push(p);
    $('chipDiagResult').textContent=formatChipDiag(d)
   }
   logging('Chipdiagnose: '+d.probes.filter(p=>!p.error).length+'/'+d.probes.length+' Leseversuche erfolgreich.');
   return d
  }finally{
   st.diagRunning=false;
   $('chipDiagRead').disabled=false;
   $('chipDiagResult').textContent=formatChipDiag(d);
   if(previousLive&&!st.manualLivePause&&st.chip&&st.port&&!st.closing)startLive()
  }
 }
 async function detect(){const w=await readReg(R_AFE);const g=decodeSafeAFE(w);const a=await readReg(0x2A);st.afe=w;st.staged={...g};st.chip=true;gainSummary();logging(`Chip-Leseantwort: AFE=0x${h(w,2)} ADC_S=${P.sign16(a)}`);await readADC();await expert.onDetect();renderStatus();show('connMsg',demoEnabled?'Demo-Sensor verbunden. Messwerte und Schreibvorgänge sind simuliert.':'Chip-Register über '+(st.iface==='plc'?'1-Wire':st.iface.toUpperCase())+' lesbar. Antworten sind plausibel; ein physischer Hardware-Abnahmetest steht noch aus.','success');step(1);startLive();window.ELMOS_GUIDED?.onConnected?.()}

 // Repeated, bounded READ-only PLC probes on an ALREADY configured SSP3.
 // No undocumented SSP3 power commands: the user must power-cycle VDD externally.
 // The serial timeout controls the RESPONSE wait, not the E703.11 NVM startup window.
 async function recoverOneWireStartup(){
  if(demoEnabled||st.adapterKind!=='ssp3'||st.iface!=='plc'||!st.port||st.closing)
   throw Error('Startfenster-Test benötigt einen verbundenen SSP3 im 1-Wire-Modus');
  if(st.chip)throw Error('Chip bereits erkannt – kein erneuter Starttest erforderlich');
  if(st.startupRunning||st.diagRunning||st.writing||st.nvmWorking||st.calTask||st.afeWriteActive)
   throw Error('Startfenster-Test ist während eines anderen Vorgangs gesperrt');
  const port=st.port,started=Date.now(),maxDurationMs=12000,maxAttempts=75;
  st.startupRunning=true;st.startupAbort=false;st.startupAttempts=0;
  let success=false,lastError='Keine Antwort';
  $('plcStartupState').textContent='Diagnose läuft. Wiederholte PLC-Leseversuche bei offenem SSP3. Ohne neue Sensorinitialisierung bleibt ein abgelaufenes Startfenster geschlossen.';
  show('connMsg','PLC-Lesediagnose läuft. Diese Funktion startet den Sensor NICHT automatisch neu. Die Originalsoftware verwendet möglicherweise zusätzliche SSP3-Befehle oder eine andere Schnittstelle.','warn');
  renderStatus();
  logging('PLC-Starttest gestartet: SSP3 bleibt offen, maximal 12 s / 75 Versuche, keine Schreibbefehle.');
  try{
   while(st.port===port&&!st.closing&&!st.startupAbort&&Date.now()-started<maxDurationMs&&st.startupAttempts<maxAttempts){
    st.startupAttempts++;
    try{
     // A short serial response timeout permits several attempts during a 200 ms boot window.
     // 4 ms cannot be guaranteed from browser timing without a verified hardware power trigger.
     const word=await readReg(R_AFE,240);
     decodeSafeAFE(word); // Plausibility only: not an independent CRC8 proof.
     if(st.startupAbort||st.closing||st.port!==port)break;
     await detect(); // Retain all existing readback and write-access safety gates.
     success=true;
     logging('PLC-Starttest erfolgreich bei Versuch '+st.startupAttempts+' nach '+(Date.now()-started)+' ms.');
     $('plcStartupState').textContent='Chip erkannt nach '+st.startupAttempts+' Leseversuchen. Keine NVM-Änderung.';
     break;
    }catch(e){
     lastError=String(e.message||e);
     if(st.startupAttempts===1||st.startupAttempts%10===0)
      logging('PLC-Starttest '+st.startupAttempts+': '+lastError);
     if(st.startupAttempts%5===0)
      $('plcStartupState').textContent=st.startupAttempts+' PLC-Leseversuche, bisher kein bestätigter Sensor. Für den automatischen Start fehlt noch die verifizierte PSSC-Initialisierung.';
    }
    if(!st.startupAbort&&!st.closing&&st.port===port)await sleep(20);
   }
   if(!success){
    if(st.startupAbort) $('plcStartupState').textContent='Startfenster-Test manuell abgebrochen; keine Änderung am Sensor.';
    else $('plcStartupState').textContent='Kein Sensor erkannt ('+st.startupAttempts+' Versuche). Letzter Fehler: '+lastError+'. SSP3-Port bleibt offen.';
    if(!st.closing&&st.port===port)
     show('connMsg','SSP3 nimmt den PLC-Befehl an, aber E703.11 antwortet nicht. Da Elmos PSSC ohne manuelle Trennung verbinden kann, fehlt vermutlich eine Initialisierung / Freigabe / automatische Sensorsteuerung. Das wiederholte Lesen allein öffnet kein abgelaufenes Startfenster. Original-SSP3-Befehlsfolge muss verglichen werden.','warn');
    logging('PLC-Starttest beendet ohne Chiperkennung: '+lastError);
   }
  }finally{
   st.startupRunning=false;st.startupAbort=false;renderStatus();
  }
 }
 async function connect(port){
  if(st.port)throw Error('Es ist bereits ein Port offen');
  if(demoEnabled&&port!==demoPort)throw Error('Demo verwendet ausschliesslich den simulierten Adapter');
  if(!demoEnabled&&(!navigator.serial||!window.isSecureContext))throw Error('Chrome benötigt Web Serial über HTTPS oder localhost');
  await port.open({baudRate:Number($('baud').value)});
  st.port=port;st.mode='usb';st.firmware='';st.chip=false;st.afe=null;st.boot=null;st.regs={};st.dsp=null;st.dspError=null;st.calStaged=false;st.calVerified=false;st.nvmDone=false;st.adc=null;st.manualLivePause=false;st.afeWriteActive=false;st.ramWriteScope=null;st.uid=null;st.uidShownForInput=null;st.restorePlan=null;st.expertOutputPlan=null;st.outputOnlyPlan=null;st.iface=$('iface').value;st.adapterKind=$('adapterType').value;
  st.sensorPowerEnabled=st.adapterKind==='bridge'&&!demoEnabled&&$('plcPowerCycle').checked;
  $('sensorPowerPin').textContent='';
  $('nvmRestartStatus').hidden=true;
  $('nvmRebootConfirm').checked=false;
  if(demoEnabled){st.iface='plc';st.adapterKind='ssp3'}
  else st.readerPromise=readerLoop(port);
  renderStatus();
  show('connMsg','USB offen. Firmware und Chip werden geprüft …');
  try{
   if(st.adapterKind==='bridge'){
    st.iface='plc';
    $('iface').value='plc';
    const bridgeReady=await bridgeHello();
    if(!bridgeReady)return;
   }
   await firmware();
   await selectChipInterface();
   try{
    if(st.adapterKind==='bridge'){
     await exchange('PLC_BAUD '+$('plcBaud').value);
     await exchange(st.sensorPowerEnabled?'PLC START':'PLC ACCESS');
    }
    await detect();
   }catch(e){
    if(st.closing||st.port!==port)return;
    st.chip=false;
    logging('Chiptest: '+e.message);
    if(st.adapterKind==='ssp3'&&st.iface==='plc'){
     logging('SSP3 und IF_CFG bereit, Chipzugriff fehlgeschlagen. USB bleibt offen. Startfenster-Test manuell aktivierbar.');
     $('plcStartupState').textContent='SSP3 bereit; PLC-Lesezugriff noch ohne Sensorantwort. Elmos PSSC kann bei gleicher Verkabelung verbinden. Wahrscheinlich fehlt dessen Initialisierungssequenz. Original-SSP3-Befehlsfolge vergleichen. Erster Fehler: '+e.message;
     show('connMsg','SSP3 erreichbar, aber keine E703.11-PLC-Antwort. Kein manueller USB-/VDD-Neustart erforderlich, solange die Originalsoftware den Sensor ohne diesen erreicht. Für die gleiche Funktion benötigen wir ihre SSP3-Initialisierung. USB-Protokoll bitte exportieren.','warn');
     renderStatus();
     return;
    }
    if(st.adapterKind==='bridge'){
     const message=e.message.includes('PLC_NO_VALID_FRAME')
      ?'ESP32 verbunden. Warte auf E703.11. Prüfe Versorgung und AODO-Verkabelung und verbinde den Adapter erneut.'
      :'ESP32 erreichbar. E703.11-Zugriff fehlgeschlagen: '+e.message;
     show('connMsg',message,'warn');
     renderStatus();
     return;
    }
    try{await runChipDiagnostics('Automatisch nach zweiter fehlgeschlagener Chiperkennung: '+e.message)}
    catch(diagError){logging('Lesende Zusatzdiagnose fehlgeschlagen: '+diagError.message)}
    show('connMsg','SSP3 erreichbar, aber Chiperkennung nicht bestätigt: '+e.message+'. Die lesende Zusatzdiagnose ist unten geöffnet. Keine weiteren automatischen USB-Neuverbindungen. Keine Schreibfreigabe.','warn');
    renderStatus();
   }
  }catch(e){
   if(st.closing||st.port!==port)return;
   logging('Handshake: '+e.message);
   show('connMsg','USB offen, aber SSP3 antwortet noch nicht korrekt: '+e.message,'warn');
  }
  renderStatus();
 }
 async function disconnect(){
  const port=st.port;
  if(!port||st.closing)return false;
  if(st.nvmWorking||st.calTask||st.writing){
   show('connMsg','Bitte den laufenden RAM-/NVM-Vorgang vor dem Trennen abschliessen.','error');
   return false;
  }
  st.startupAbort=true;
  st.closing=true;
  stopLive();
  show('connMsg','USB-Verbindung wird getrennt …');
  if(st.responseWait){
   const waiter=st.responseWait;
   st.responseWait=null;
   clearTimeout(waiter.timer);
   waiter.reject(Error('Port wird getrennt'));
  }
  try{
   const reader=st.reader;
   const readerDone=st.readerPromise;
   await reader?.cancel().catch(()=>{});
   await readerDone;
   await st.cmdQueue;
   await port.close();
   Object.assign(st,{
    port:null,readerPromise:null,chip:false,sensorPowerEnabled:false,mode:'offline',firmware:'',boot:null,afe:null,
    nvmBackup:null,nvmBackupVerified:false,calImage:null,calVerified:false,calStaged:false,nvmDone:false,
    dsp:null,adc:null,dspError:null,manualLivePause:false,afeWriteActive:false,ramWriteScope:null,
    uid:null,uidShownForInput:null,restorePlan:null,expertOutputPlan:null,outputOnlyPlan:null
   });
   $('nvmRestartStatus').hidden=true;
   show('connMsg','USB-Verbindung getrennt.','success');
   return true;
  }catch(e){
   logging('Trennen: '+e.message);
   show('connMsg','USB-Port konnte nicht geschlossen werden: '+e.message,'error');
   return false;
  }finally{
   st.closing=false;
   if(st.port===port&&port.readable&&!st.reader)st.readerPromise=readerLoop(port);
   renderStatus();
  }
 }
 function serialPortInfo(port){
  let i={};try{i=port?.getInfo?.()||{}}catch(_){}
  const hex=n=>Number(n).toString(16).padStart(4,'0').toUpperCase();
  return i.usbVendorId!=null?`USB VID:${hex(i.usbVendorId)} PID:${hex(i.usbProductId??0)}`:'serieller Port';
 }
 function serialOpenError(error,port){
  const original=String(error?.message||error||'Unbekannter Fehler');
  if(error?.name==='NotFoundError')return 'Die Portauswahl wurde abgebrochen. Es wurde keine Verbindung hergestellt.';
  if(/Failed to open serial port|access denied|permission denied|busy|resource busy|already open|cannot open/i.test(original)||error?.name==='NetworkError'||error?.name==='InvalidStateError'){
   return `USB-Port ausgewählt (${serialPortInfo(port)}), aber Windows konnte ihn nicht öffnen. Das liegt meist an einem belegten COM-Port oder am FTDI-VCP-Treiber. 1. Originale PSSC-GUI, Terminalprogramme und andere Chrome-Tabs mit serieller Verbindung schliessen. 2. Windows-Gerätemanager → Anschlüsse (COM & LPT): Das SSP3 muss als USB Serial Port (COMx) ohne Warnsymbol erscheinen. 3. Board kurz aus- und wieder einstecken und «Bekannten Port verbinden» erneut versuchen. Falls kein COM-Port vorhanden ist, FTDI-VCP-Treiber prüfen. Technischer Fehler: ${original}`;
  }
  return `USB-Verbindung nicht hergestellt (${serialPortInfo(port)}): ${original}`;
 }
 async function choose(){
  if(demoEnabled)return;
  let port;
  try{port=await navigator.serial.requestPort()}
  catch(e){show('connMsg',serialOpenError(e,null),e?.name==='NotFoundError'?'warn':'error');return}
  try{await connect(port)}catch(e){logging('USB öffnen: '+String(e));show('connMsg',serialOpenError(e,port),'error')}
 }
 async function auto(){
  if(demoEnabled)return;
  let port;
  try{
   const list=await navigator.serial.getPorts();
   if(!list.length)return show('connMsg','Noch kein Port freigegeben. Klicke zuerst auf «USB-Port auswählen».','warn');
   const ports=st.adapterKind==='ssp3'?list.filter(x=>x.getInfo?.().usbVendorId===0x0403):[];
   port=ports.length===1?ports[0]:list.length===1?list[0]:null;
   if(!port)return show('connMsg','Mehrere freigegebene Ports erkannt. Bitte USB-Port manuell auswählen.','warn');
   await connect(port)
  }catch(e){logging('Bekannten USB-Port öffnen: '+String(e));show('connMsg',serialOpenError(e,port),'error')}
 }
 function updateADC(a,source){st.adc={...a,source,time:Date.now()};st.trend.push({x:Date.now(),y:a.s});st.trend=st.trend.filter(v=>Date.now()-v.x<60000);st.history.push({time:new Date().toISOString(),adc_s:a.s,adc_t:a.t,adc_tc:a.tc,source:demoEnabled?'Demo':source,gains:{...st.staged}});if(st.history.length>5000)st.history.shift();$('adc').textContent=fmt(a.s);$('adct').textContent=fmt(a.t);$('adctc').textContent=fmt(a.tc);show('adcMsg',Math.abs(a.s)>25000?'ADC_S liegt ausserhalb des vorsichtigen ±25’000-Arbeitsbereichs. Gain reduzieren oder Offset kontrollieren.':`ADC_S ${fmt(a.s)} Digits · USB / E703.11 · ${new Date().toLocaleTimeString('de-CH')}`,Math.abs(a.s)>25000?'warn':'success');renderStatus();draw();return a.s}
 async function readADC(){
  if(!st.chip)throw Error('Chip-Lesezugriff noch nicht bestätigt');
  const tc=P.sign16(await readReg(0x26)),t=P.sign16(await readReg(0x28)),s=P.sign16(await readReg(0x2A));
  try{
   const dsp=P.sign16(await readReg(0x30));
   updateDSP(dsp,'usb');
  }catch(e){
   st.dsp=null;st.dspError=e.message;renderDSPLive();
   if(!st.lastDspError||Date.now()-st.lastDspError>12000){
    logging('DSP_S kann nicht gelesen werden: '+e.message);st.lastDspError=Date.now()
   }
  }
  return updateADC({s,t,tc},'usb').s
 }
 function startLive(){
  if(st.live||st.calTask||!st.chip)return;
  st.live=true;st.consecutiveErrors=0;renderStatus();
  (async function loop(){
   if(!st.live)return;
   try{
    if(!st.writing&&!st.calTask){
     const p=readADC();st.liveReadPromise=p;
     try{await p}finally{if(st.liveReadPromise===p)st.liveReadPromise=null}
    }
    st.consecutiveErrors=0
   }catch(e){
    st.consecutiveErrors++;logging('ADC-/DSP-Livefehler: '+e.message);
    if(st.consecutiveErrors>=3){stopLive();show('adcMsg','Live-Messung gestoppt: '+e.message,'error');return}
   }finally{if(st.live)st.timeout=setTimeout(loop,liveIntervalMs)}
  })()
 }
 function stopLive(){st.live=false;clearTimeout(st.timeout);st.timeout=null;renderStatus()}
 async function bootSnapshot(){if(!st.chip)throw Error('Chip nicht verbunden');const out={};for(const a of LOCKED)out[a]=await readReg(a);return out}
 function bootString(b){return LOCKED.map(a=>`${REG_NAMES[a]} 0x${h(a)} = 0x${h(b[a],2)} · gesperrt`).join('\n')}
 async function readBoot(){try{const a=await bootSnapshot(),b=await bootSnapshot();if(!sameBoot(a,b))throw Error('Bootregister nicht stabil');st.boot=a;$('regdump').textContent=bootString(a);show('bootMsg','Bootregister zweifach gelesen. Boot-/Schnittstellenregister schreibgeschützt; NVM-Bereich nur im gesicherten Kalibrierablauf programmierbar.','success');return a}catch(e){st.boot=null;show('bootMsg','Bootregister-Prüfung fehlgeschlagen: '+e.message,'error');throw e}finally{renderStatus()}}
 async function registerDump(){try{if(!st.chip)throw Error('Chip-Lesezugriff nicht bestätigt');const regs=[...LOCKED,0x14,0x16,0x18,0x1A,0x1C,0x1E,0x26,0x28,0x2A];for(const a of regs)st.regs[a]=await readReg(a);$('regdump').textContent=regs.map(a=>`0x${h(a)}  ${REG_NAMES[a]||'Register'}  0x${h(st.regs[a],2)} ${LOCKED.includes(a)?'GESCHÜTZT':''}`).join('\n');show('bootMsg','Diagnoseregister gelesen. Bootregister bleiben schreibgeschützt.','success')}catch(e){show('bootMsg','Registerlesen: '+e.message,'error')}}
 async function unlockRAM(){if(st.adapterKind==='bridge'){await exchange('PLC ACCESS',3500)}else if(st.iface==='plc'){await exchange('PLC P',3500);await exchange('PLC T',3500)}else {for(const w of [0xF75A,0x0CC7,0xD21E])await lowLevelWrite(0x22,w,true)}}
 async function lowLevelWrite(addr,word,forUnlock=false){if(!st.port||!st.afeWriteActive||!st.chip)throw Error('AFE-Schreibzugriff nur während expliziter RAM-Übernahme zulässig');if(addr!==R_AFE&&!(forUnlock&&addr===0x22))throw Error('Nur CFG_AFE1 und dokumentierte RAM-Freigabecookies zulässig');if(addr===0x22&&!([0xF75A,0x0CC7,0xD21E].includes(word)))throw Error('Nicht erlaubtes CMD-Cookie');let cmd;if(st.iface==='plc'){if(addr!==R_AFE)throw Error('PLC nutzt PLC P / PLC T für RAM-Freigabe');cmd=P.plcWrite(addr,word)}else if(st.iface==='i2c'){cmd=P.i2cWrite(addr,word)}else{cmd=P.spiWrite(addr,word)}await exchange(cmd,2300)}
 async function commitGain(target){
  if(st.writing||st.calTask||st.nvmWorking){
   show('writeMsg','Ein anderer Schreib- oder Kalibriervorgang läuft.','warn');
   return false
  }
  if(!st.port||!st.chip||st.mode!=='usb'){
   show('writeMsg','Keine bestätigte Chipverbindung – AFE-Einstellung nicht verändert.','error');
   return false
  }
  if(!P.goodG(target)){
   show('writeMsg','Ungültiger AFE-Stufencode.','error');
   return false
  }
  const resumeLive=st.live&&!st.manualLivePause;
  let writeAttempted=false;
  st.writing=true;
  st.afeWriteActive=true;
  stopLive();
  renderStatus();
  show('writeMsg','AFE wird direkt ins Sensor-RAM übertragen und rückgelesen …','warn');
  try{
   // Keine gleichzeitigen SSP3-Kommandos mit einer noch laufenden Live-Messung.
   if(st.liveReadPromise)await st.liveReadPromise.catch(()=>{});
   const beforeBoot=await bootSnapshot();
   if(st.boot&&!sameBoot(st.boot,beforeBoot))throw Error('Bootregister seit der letzten Prüfung verändert');
   const originalWord=await readReg(R_AFE);
   const original=decodeSafeAFE(originalWord);
   const next=P.encAFE(originalWord,target);
   if(st.iface!=='plc'&&(beforeBoot[6]&0x8000))throw Error('CRC-geschützte I²C/SPI-Verbindung: RAM-Schreiben gesperrt');
   if(next===originalWord){
    st.afe=originalWord;
    st.staged={...original};
    gainSummary();
    show('writeMsg','AFE-Einstellung ist im Chip-RAM bereits aktiv.','success');
    return true
   }
   const adcBefore=P.sign16(await readReg(0x2A));
   await unlockRAM();
   writeAttempted=true;
   await lowLevelWrite(R_AFE,next);
   const actual=await readReg(R_AFE);
   if(actual!==next)throw Error('AFE-Rücklesefehler: Soll 0x'+h(next,2)+' Ist 0x'+h(actual,2));
   if(!sameBoot(beforeBoot,await bootSnapshot()))throw Error('Bootregister nach AFE-Übernahme verändert');
   st.afe=actual;
   st.staged={...target};
   erasePoints();
   gainSummary();
   let adcAfter=null;
   try{adcAfter=await readADC()}catch(e){logging('ADC-Lesung nach AFE-RAM-Änderung: '+e.message)}
   show('writeMsg','AFE automatisch ins RAM geschrieben und bestätigt. '+
    (Number.isFinite(adcAfter)?'ADC_S: '+fmt(adcBefore)+' → '+fmt(adcAfter)+' Digits. ':'')+
    'Weitere Stufen können direkt eingestellt werden. Bereits aufgenommene Kalibrierpunkte wurden zurückgesetzt.','success');
   return true
  }catch(e){
   st.boot=null;
   logging('AFE-RAM-Schreibfehler: '+e.message);
   if(writeAttempted)erasePoints(); // Unklarer Zustand: alte Kalibrierpunkte niemals weiterverwenden.
   try{
    if(st.port&&st.chip){
     const actual=await readReg(R_AFE);
     st.afe=actual;
     st.staged=decodeSafeAFE(actual);
     gainSummary()
    }
   }catch(readError){
    st.afe=null;
    logging('AFE-Rücklesung nach Fehler: '+readError.message)
   }
   show('writeMsg','AFE-RAM-Übernahme fehlgeschlagen: '+e.message+
    '. '+(writeAttempted?'Messpunkte vorsorglich verworfen.':'Keine AFE-Schreibbestätigung.')+
    ' Bitte Chipzustand kontrollieren.','error');
   return false
  }finally{
   st.afeWriteActive=false;
   st.writing=false;
   renderStatus();
   if(resumeLive&&st.port&&st.chip)startLive()
  }
 }
 async function sample(){if(!st.chip)throw Error('Keine bestätigte Chip-Leseverbindung');return P.sign16(await readReg(0x2A))}
 
 async function capture(which){
  try{
   if(st.calTask||st.writing||st.nvmWorking)throw Error('Ein Mess- oder Wartungsvorgang läuft');
   const pmin=Number($('pmin').value),pmax=Number($('pmax').value);
   if(!Number.isFinite(pmin)||!Number.isFinite(pmax)||!(pmax>pmin))throw Error('Unterer und oberer Referenzwert sind ungültig');
   if(!st.chip)throw Error('Keine aktive Chipverbindung');
   const p=which==='lo'?pmin:pmax,name=pointName(which),at=new Date().toISOString(),temperature=Number($(which==='lo'?'calLoTemp':'calHiTemp').value);
   if(!Number.isFinite(temperature)||temperature< -40||temperature>125)throw Error('Referenztemperatur ausserhalb −40 bis 125 °C');
   demoPort?.setReference(p,temperature);
   const samples=await measureCalibrationSamples(name);
   const record={kind:which,name,pressure:p,temperature,...samples,at,gains:{...st.staged},unit:pressureUnit()};
   st.points[which]={v:record.adc_s,pressure:p,unit:record.unit,name,gains:{...st.staged},at};
   addCalPoint(record);
   refreshPoints()
  }catch(e){show('calMsg','Messung fehlgeschlagen: '+e.message,'error')}
 }
 
 function refreshPoints(){
  const a=st.points.lo,b=st.points.hi;
  renderCalPoints();renderFlowState();
  if(!a||!b)return show('calMsg','Unteren und oberen Referenzpunkt aufnehmen. Weitere Punkte dazwischen ebenfalls erfassen.');
  const span=Math.abs(b.v-a.v),mid=(a.v+b.v)/2,max=Math.max(Math.abs(a.v),Math.abs(b.v));
  $('hub').textContent=fmt(span);$('middle').textContent=fmt(mid);$('usage').textContent=(max/25000*100).toFixed(1)+' %';
  if(!calEndpointsReady())show('calMsg',st.calpoints.length+' von '+calibrationPointCount()+' Punkten erfasst. Noch fehlende Punkte aufnehmen; alle müssen mit den gleichen AFE-Gains gemessen werden.','warn');
  else show('calMsg','Alle '+calibrationPointCount()+' Kalibrierpunkte aufgenommen. Berechnung ist freigegeben.','success');
  const advise=max>25000?'Übersteuerung möglich: Gain reduzieren und alle Punkte erneut aufnehmen.':span<18000?'Signalhub klein: PGA1/PGA2 optimieren und alle Punkte erneut aufnehmen.':Math.abs(mid)>7000?'Signalmitte verschoben: Offset prüfen und Messpunkte erneut aufnehmen.':'AFE-Hub grundsätzlich geeignet. Nach vollständiger Messung Koeffizienten berechnen.';
  show('recommendation',advise,'success')
 }
 async function verify(){
  try{
   if(!calEndpointsReady())throw Error('Zuerst beide Referenzpunkte aufnehmen');
   demoPort?.setReference(Number($('ptest').value));
   const a=st.points.lo,b=st.points.hi,val=await sample();
   const pred=a.pressure+(val-a.v)*(b.pressure-a.pressure)/(b.v-a.v);
   const set=Number($('ptest').value),tol=Number($('tol').value),err=pred-set;
   if(!Number.isFinite(set)||!Number.isFinite(tol)||tol<=0)throw Error('Prüfwert oder Toleranz ungültig');
   st.verify={adc:val,calculated:pred,expected:set,error:err,tolerance:tol,unit:pressureUnit(),pass:Math.abs(err)<=tol,kind:'optional-raw-only'};
   show('verifyMsg','Optionale Rohwert-Vorprüfung: ADC_S '+fmt(val)+' · berechnet '+pred.toFixed(4)+' '+pressureUnit()+' · Referenz '+set.toFixed(4)+' '+pressureUnit()+' · Abweichung '+err.toFixed(4)+' '+pressureUnit()+'. KEINE DSP- oder NVM-Verifikation.',st.verify.pass?'success':'warn')
  }catch(e){show('verifyMsg','Optionale Rohwert-Prüfung fehlgeschlagen: '+e.message,'error')}
 }

 function draw(){const c=$('chart');if(!c||c.closest('[hidden]'))return;const d=window.devicePixelRatio||1,w=Math.round(c.clientWidth*d),h=Math.round(c.clientHeight*d);if(w<20)return;if(c.width!==w||c.height!==h){c.width=w;c.height=h}const g=c.getContext('2d');g.clearRect(0,0,w,h);const x0=55*d,y0=10*d,yh=h-20*d,y=v=>y0+(32768-v)/65536*(yh-y0);g.font=`${11*d}px sans-serif`;for(const v of [25000,0,-25000]){g.beginPath();g.strokeStyle=v?'#e3c9aa':'#d7e4ef';g.setLineDash(v?[5*d,4*d]:[]);g.moveTo(x0,y(v));g.lineTo(w-8*d,y(v));g.stroke();g.setLineDash([]);g.fillStyle='#74849a';g.fillText((v>0?'+':'')+v,5*d,y(v)+4*d)}if(st.trend.length<1)return;const left=Date.now()-60000,x=t=>x0+(w-x0-10*d)*Math.max(0,Math.min(1,(t-left)/60000));g.beginPath();g.strokeStyle='#2867a6';g.lineWidth=2*d;st.trend.forEach((p,i)=>i?g.lineTo(x(p.x),y(p.y)):g.moveTo(x(p.x),y(p.y)));g.stroke()}
 function download(name,txt,mime='application/json'){let b=new Blob([txt],{type:mime}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=(demoEnabled?'DEMO_':'')+name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}
 const report=()=>({tool:'ELMOS E703.11 Kalibrierassistent v0.6.13',created:new Date().toISOString(),connection:demoEnabled?'Demo':st.port?'USB':'offline',hardwareValidated:false,unit:pressureUnit(),pointNames:{lower:pointName('lo'),upper:pointName('hi')},interface:st.iface,firmware:st.firmware,bootProtection:'Boot-/Werks-NVM-Schreiben gesperrt; kalibrierungsbezogenes User-NVM mit Bestätigung freigegeben',ramWriteActive:!!st.ramWriteScope,registers:st.regs,bootSnapshot:st.boot,chipUID:st.uid?.hex||null,expertOutput:st.expertOutputPlan,AFE:st.afe,gains:st.staged,low:st.points.lo,high:st.points.hi,verification:st.verify,calibrationPoints:st.calpoints,plannedCalibrationPointCount:calibrationPointCount(),requestedSamplesPerPoint:Number($('calSampleCount').value),requestedDSPOutputLimit:Number($('calDspLimit').value),coefficientFit:st.calfit,calRamVerified:st.calVerified,lastDSP:st.dsp,chipDiagnostic:st.chipDiag,lastPlcReply:st.lastPlcReply,displayRange:getActiveDSPRange(),nvmState:{backupVerified:st.nvmBackupVerified,programmed:st.nvmDone},samples:st.history.slice(-1500),trace:st.log});

 // ============ Kalibrierung + NVM (AN0203 / AN0204 / Datasheet 2023) ============
 const ca=(id,msg,type='')=>show(id,msg,type);
 
 function renderCalPoints(){
  const out=$('calPointsList');if(!out)return;
  const count=calibrationPointCount();
  const slot=x=>x.kind==='lo'?0:x.kind==='hi'?count-1:x.slot;
  out.textContent=st.calpoints.length?st.calpoints.slice().sort((a,b)=>slot(a)-slot(b)).map(x=>
   'Messpunkt '+(slot(x)+1)+' · '+x.name+' · '+Number(x.pressure).toFixed(3)+' '+pressureUnit()+' · '+Number(x.temperature).toFixed(1)+' °C · ADC_S '+fmt(x.adc_s)+' · ADC_T '+fmt(x.adc_t)
  ).join('\n'):'Noch keine Messpunkte.';
  renderCalibrationPlan()
 }
 function addCalPoint(x){
  if(!Number.isFinite(x.adc_s)||!Number.isFinite(x.adc_t)||!Number.isFinite(x.pressure)||!Number.isFinite(x.temperature))throw Error('ADC_S/ADC_T oder Referenz fehlt');
  if(x.kind==='lo'||x.kind==='hi')st.calpoints=st.calpoints.filter(p=>p.kind!==x.kind);
  else st.calpoints=st.calpoints.filter(p=>!(p.kind==='extra'&&p.slot===x.slot));
  st.calpoints.push(x);invalidateCalculation('Messpunkte geändert. DSP-Koeffizienten erneut berechnen.');
  renderCalPoints()
 }
 async function captureCalPoint(slot){
  try{
   const count=calibrationPointCount();
   if(!Number.isFinite(count)||!Number.isInteger(slot)||slot<1||slot>count-2)throw Error('Messpunkt für die gewählte Anzahl nicht aktiv');
   if(st.calTask||st.writing||st.nvmWorking)throw Error('Ein Mess- oder Wartungsvorgang läuft');
   const pr=Number($('calExtra'+slot+'Pressure').value),t=Number($('calExtra'+slot+'Temp').value),lo=Number($('pmin').value),hi=Number($('pmax').value);
   if(!Number.isFinite(pr)||pr<lo||pr>hi||!Number.isFinite(t)||t< -40||t>125)throw Error('Referenzwert oder Temperatur ungültig');
   if(!st.chip)throw Error('Kein Chip verbunden');
   const name=$('calExtra'+slot+'Name').value.trim()||'Messpunkt '+(slot+1);
   demoPort?.setReference(pr,t);
   const samples=await measureCalibrationSamples(name);
   addCalPoint({kind:'extra',slot,name,pressure:pr,unit:pressureUnit(),temperature:t,...samples,at:new Date().toISOString(),gains:{...st.staged}});
   ca('calPointsMsg','Messpunkt '+(slot+1)+' mit '+samples.sampleCount+' Samples aufgenommen.','success');
   refreshPoints()
  }catch(e){ca('calPointsMsg','Messpunkt '+(slot+1)+': '+e.message,'error')}
 }
 
 function calcCoefficients(){
  try{
   if(st.calTask||st.writing||st.nvmWorking)throw Error('Es läuft ein anderer Vorgang');
   if(!calEndpointsReady())throw Error('Zuerst alle '+calibrationPointCount()+' gewählten Kalibrierpunkte mit gleicher AFE-Einstellung aufnehmen');
   const pmin=Number($('pmin').value),pmax=Number($('pmax').value);
   if(st.calpoints.some(p=>JSON.stringify(p.gains)!==JSON.stringify(st.staged)))throw Error('Gain wurde nach der Aufnahme geändert. Messpunkte erneut erfassen');
   const orderS=Number($('calSOrder').value),orderT=Number($('calTOrder').value),outputLimit=Number($('calDspLimit').value);
   if(!Number.isInteger(outputLimit)||outputLimit<1000||outputLimit>32000)throw Error('DSP-Endwert muss zwischen 1’000 und 32’000 Digits liegen');
   if(st.calpoints.length<(orderS+1)*(orderT+1))throw Error('Für diese Polynom- und Temperaturordnung sind mindestens '+((orderS+1)*(orderT+1))+' unabhängige Messpunkte nötig. Anzahl in Schritt 3 erhöhen.');
   const solution=CAL.fit(st.calpoints,{pmin,pmax,orderS,orderT,outputLimit});
    st.calfit=solution;st.calImage=null;st.calStaged=false;st.calVerified=false;st.calValidation=[];st.nvmBackup=null;st.nvmBackupVerified=false;renderDSPLive();
   const r=solution.registers;
   $('calCoeffList').textContent='S_O 0x'+h(r.so,2)+' (Q3.12)  S_F 0x'+h(r.sf,2)+' (Q3.12)\n'+r.coeffs.map((x,i)=>'S'+String(i).padEnd(2)+' 0x'+h(x,2)+'    '+CAL.fromQ(x,15).toFixed(7)).join('\n')+(r.tcoeffs?'\nT_O '+h(r.to,2)+' T_F '+h(r.tf,2)+'\n'+r.tcoeffs.map((x,i)=>'T'+i+': 0x'+h(x,2)).join('\n'):'\nTemperaturpfad bleibt unverändert.');
   const note='DSP-Ziel ±'+fmt(solution.outputLimit)+' Digits (Reserve bis +32’767: '+fmt(32767-solution.outputLimit)+' Digits). Max. Fitfehler '+solution.stats.maxDigits.toFixed(2)+' Digits · RMS '+solution.stats.rmsDigits.toFixed(2)+' Digits.';
   show('calFitMsg','Berechnung erfolgreich ('+st.calpoints.length+' Punkte). '+note+' Jetzt RAM-Schreibfreigabe aktivieren, Original-NVM prüfen und dann die berechneten Koeffizienten ins RAM übertragen. Die JavaScript-Berechnung ist noch nicht als identisch mit der Hersteller-DLL bestätigt.',solution.stats.maxDigits>100?'warn':'success');
   show('calRamStageMsg','Koeffizienten berechnet, aber noch nicht ins Chip-RAM übertragen.','warn');
   renderFlowState()
  }catch(e){invalidateCalculation('Berechnung fehlgeschlagen: '+e.message);show('calFitMsg','Berechnung fehlgeschlagen: '+e.message,'error')}
 }

 async function maintWrite(addr,word){
  // Restricted, never public raw-register interface. Only for controlled calibration/NVM transaction.
  if(!st.calTask||!st.port||!st.chip||!st.ramWriteScope)throw Error('Technischer Wartungszugriff nur während gewählter Schreib-/Backup-Aktion erlaubt');
  if(!Number.isInteger(word)||word<0||word>65535||!Number.isInteger(addr)||addr%2)throw Error('Ungültige Registerdaten');
  const permitted=CAL_REGS.includes(addr)||addr===0x4A||addr===0x4E||addr===0x22;
  if(!permitted)throw Error(`Schreibzugriff 0x${h(addr)} ist gesperrt`);
  if(addr===0x22&&!([0xF75A,0x0CC7,0xD21E,0x62A2].includes(word)))throw Error('Nicht freigegebener RAM-Befehl');
  if(addr===0x4E){let ok=[0x98BD,0x25BF,0x36D8,0x0000,0x8800].includes(word)|| ((word&0xFF00)===0x4C00&&(word&1)===0) || ((word&0xFF00)===0xA300&&(word&1)===0&&(word&255)>=0x20&&(word&255)<=0x7E);
   if(!ok)throw Error('CM_CMD nicht zugelassen');
   if((word&0xFF00)===0xA300&&!st.nvmWorking)throw Error('NVM-Programmierung nicht freigegeben');
  }
  if(addr===0x4A&&!st.nvmWorking)throw Error('CM_WDATA nur während des NVM-Programmierens');
  const cmd=st.iface==='plc'?P.plcWrite(addr,word):st.iface==='i2c'?P.i2cWrite(addr,word):P.spiWrite(addr,word);
  await exchange(cmd,4000);
 }
 async function ramGrant(){
  if(st.iface!=='plc'&&(Number(st.boot?.[6]||0)&0x8000))throw Error('I²C/SPI benötigt CRC-geschützte Frames – Wartung gesperrt');
  if(st.adapterKind==='bridge'){await exchange('PLC ACCESS',3500)}else if(st.iface==='plc'){await exchange('PLC P',3500);await exchange('PLC T',3500)}
  else for(const w of [0xF75A,0x0CC7,0xD21E])await maintWrite(0x22,w);
 }
 async function ramLock(){
  if(st.iface==='plc')return; // No documented PLC relock shortcut; power cycle restores authorization
  try{await maintWrite(0x22,0x62A2)}catch(e){logging('RAM-Sperre: '+e.message)}
 }
 async function nvmWaitIdle(max=12000,initialDelay=25,pollDelay=80){
  const start=Date.now();await sleep(initialDelay);let stable=0;
  while(Date.now()-start<max){
   const flags=await readReg(0x46);
   if((flags&7)===0){if(++stable>=2)return flags}else stable=0;
   await sleep(pollDelay)
  }
  throw Error('NVM-Controller reagiert nicht / Timeout')
 }
 async function nvmReadWord(addr){
  await maintWrite(0x4E,0x4C00|addr);await nvmWaitIdle(12000,12,15);return await readReg(0x48);
 }
 async function nvmScan(options={}){
  let started=false;
  const postBoot=options?.postBoot===true,expertRead=options?.expertRead===true,preview=options?.preview===true;
  const backupStarted=Date.now();
  try{
   if(!postBoot&&!expertRead&&!verificationComplete())throw Error('Zuerst DSP-Kalibrierung im RAM erfolgreich prüfen (oder im Expertenmodus nur auslesen)');
   if(!st.port||!st.chip)throw Error('Ein echter Chip muss verbunden sein');
   if(st.writing||st.calTask||st.nvmWorking)throw Error('Ein anderer Vorgang läuft');
   st.calTask=true;st.writing=true;st.ramWriteScope='backup';started=true;stopLive();
   ca('backupMsg',preview?'NVM wird für die Änderungsvorschau gelesen und mit CRC geprüft …':'Original-NVM wird gelesen und geprüft …','warn');
   ca('nvmMsg','NVM wird vollständig gelesen …','warn');
   const before=await bootSnapshot();await ramGrant();const words=[];
   for(let i=0;i<64;i++){words.push(await nvmReadWord(i*2));$('nvmProgress').textContent=`NVM lesen: ${i+1}/64`;$('backupProgress').textContent=`NVM: ${i+1} / 64 Wörter`}
   const crc=CAL.crc16(words);
   if(crc!==words[63])throw Error(`CRC16 im bestehenden NVM ungültig: berechnet 0x${h(crc,2)}, gelesen 0x${h(words[63],2)}. Programmierung nicht zulässig.`);
   const factoryCRC=CAL.crc8(words),factoryHigh=(words[15]>>>8);
   if(factoryCRC!==factoryHigh)throw Error(`Werks-CRC8 stimmt nicht: 0x${h(factoryCRC)} statt 0x${h(factoryHigh)}. Programmierung gesperrt.`);
   for(const index of [0,1,15,16,17,18,19,20,22,27,28,63])if(await nvmReadWord(index*2)!==words[index])throw Error('NVM bei Wiederholungslesung unstabil (Wort '+index+')');
   const after=await bootSnapshot();if(!sameBoot(before,after))throw Error('Bootregister haben sich beim NVM-Lesen verändert');
   st.nvmBackup=words;st.nvmBackupVerified=true;st.calImage=null;expert.refreshOutputReadOnly();expert.refreshEEPROMViewer();
   const shouldArchive=expertRead||(!preview&&$('nvmAutoBackup').checked);
   if(shouldArchive)expert.afterNvmScan();
   ca('backupMsg','NVM vollständig gelesen: 64 Wörter, CRC8 und CRC16 geprüft.'+
    (preview?' Noch kein dauerhaftes Backup angelegt; das geschieht bei der endgültigen Programmierung nur auf Wunsch.':
     shouldArchive?' Chipbezogene Backup-Historie aktualisiert.':' Kein dauerhaftes Backup angelegt.'),'success');
   $('backupProgress').textContent='64 / 64 Wörter – Prüfung erfolgreich in '+((Date.now()-backupStarted)/1000).toFixed(1)+' s.';
   ca('nvmMsg',`Aktuelles NVM gelesen und CRC8/CRC16 geprüft. Chipkennung SER1/SER0: ${h(words[1],2)}${h(words[0],2)}. ${preview?'Änderungsplan wird berechnet.':'NVM-Lesung erfolgreich.'}`,'success');
  }catch(e){
   logging('NVM-Backup: '+e.message);
   st.nvmBackup=null;st.nvmBackupVerified=false;expert.refreshEEPROMViewer();
   ca('nvmMsg','NVM-Backup fehlgeschlagen: '+e.message,'error');
   ca('backupMsg','NVM-Backup fehlgeschlagen: '+e.message,'error');
  }
  finally{if(started){await ramLock();st.ramWriteScope=null;st.calTask=false;st.writing=false}renderStatus();if(started&&!postBoot&&!st.manualLivePause&&st.chip&&!st.nvmWorking)startLive()}
  return !!st.nvmBackupVerified
 }
 async function applyCalRam(){
  try{
   if(!coefficientSettingsCurrent())throw Error('Zuerst Koeffizienten für den aktuellen DSP-Endwert berechnen');
   if(!st.port||!st.chip)throw Error('USB-Verbindung zum Chip fehlt');
   if(st.writing||st.calTask||st.nvmWorking)throw Error('Ein anderer Vorgang läuft');
   st.calTask=true;st.writing=true;st.ramWriteScope='calibration';stopLive();
   ca('calRamStageMsg','Berechnete DSP-Koeffizienten werden ins RAM übertragen und rückgelesen …','warn');
   const before=await bootSnapshot();await ramGrant();
   const r=st.calfit.registers;
   const changes=[[0x70,r.so],[0x72,r.sf],...r.coeffs.map((v,i)=>[0x74+2*i,v])];
   if(r.tcoeffs)changes.push([0x6C,r.to],[0x6E,r.tf],...r.tcoeffs.map((v,i)=>[0x94+2*i,v]));
   for(const [addr,value] of changes){await maintWrite(addr,value);const actual=await readReg(addr);if(actual!==value)throw Error(`DSP-RAM Rücklesefehler 0x${h(addr)}: 0x${h(actual,2)} statt 0x${h(value,2)}`)}
   if(!sameBoot(before,await bootSnapshot()))throw Error('Bootregister nach Kalibrier-RAM-Schreiben verändert');
   st.calStaged=true;st.calVerified=false;st.calValidation=[];st.calImage=null;st.nvmBackup=null;st.nvmBackupVerified=false;st.dsp=null;renderDSPLive();
   ca('calRamStageMsg',`${changes.length} DSP-Wörter ins RAM geschrieben und einzeln erfolgreich rückgelesen. Jetzt im nächsten Schritt DSP_S unabhängig prüfen.`,'success');
   ca('calRamMsg','DSP-Koeffizienten ins RAM übertragen. Bitte Prüfdruck einstellen und DSP_S kontrollieren.','warn');
  }catch(e){
   st.calStaged=false;st.calVerified=false;st.calImage=null;
   logging('DSP-RAM-Übernahme: '+e.message);
   ca('calRamStageMsg','RAM-Übernahme fehlgeschlagen: '+e.message,'error');
  }
  finally{if(st.calTask){await ramLock();st.ramWriteScope=null;st.calTask=false;st.writing=false}renderStatus();if(!st.manualLivePause&&st.chip&&!st.nvmWorking)startLive()}
 }
 async function verifyCalRam(){
  let isChecking=false;
  try{
   if(!st.calStaged||!coefficientSettingsCurrent()||!st.chip||st.calTask||st.writing)throw Error('Koeffizienten zuerst im RAM übernehmen / anderer Vorgang läuft');
   const required=verificationRequiredCount();
   if(!Number.isFinite(required))throw Error('Anzahl Prüfpunkte: Bitte eine ganze Zahl zwischen 1 und 10 eingeben');
   const p=Number($('calVerifyPressure').value),pmin=Number($('pmin').value),pmax=Number($('pmax').value),tol=Number($('calVerifyTolerance').value);
   if(!Number.isFinite(p)||!(p>pmin&&p<pmax)||!Number.isFinite(tol)||tol<=0)throw Error('Prüfdruck innerhalb des Kalibrierbereichs und positive Toleranz eingeben');
   st.calTask=true;isChecking=true;
   if(st.liveReadPromise)await st.liveReadPromise.catch(()=>{});
   const outputLimit=st.calfit.outputLimit??32000;
   demoPort?.setReference(p,Number($('calVerifyTemperature').value));
   const got=P.sign16(await readReg(0x30)),target=2*outputLimit*(p-pmin)/(pmax-pmin)-outputLimit;
   updateDSP(got,'usb');
   const stat=await readReg(0x32),delta=got-target,errorBar=delta/(2*outputLimit)*(pmax-pmin);
   if(stat&(1<<10))throw Error('DSP-Sättigung erkannt (STATUS_SYNC.dsp_sat). Programmierung gesperrt.');
   if(Math.abs(errorBar)>tol){
    st.calValidation=[];st.calVerified=false;st.calImage=null;
    $('calVerifyList').textContent='Prüfung fehlgeschlagen. Bisherige Prüfpunkte verworfen; alle erneut prüfen.';
    throw Error(`DSP_S ${got}: Abweichung ${errorBar.toFixed(4)} ${pressureUnit()} über Toleranz ${tol} ${pressureUnit()}`)
   }
   st.calValidation=st.calValidation.filter(x=>Math.abs(x.pressure-p)>(pmax-pmin)*0.10);
   st.calValidation.push({pressure:p,actual:got,expected:target,errorBar,temperature:Number($('calVerifyTemperature').value),measuredTemp:P.sign16(await readReg(0x2E))});
   const pointsReady=st.calValidation.length>=required;
   const temperatureValidation=st.calfit.orderT===0||(
    st.calValidation.length>=2
    &&(Math.max(...st.calValidation.map(x=>x.temperature))-Math.min(...st.calValidation.map(x=>x.temperature)))>=10
    &&st.calValidation.every(x=>Number.isFinite(x.temperature)&&Math.abs(x.measuredTemp-(387.88*x.temperature-16485))<=Math.max(100,tol*2*outputLimit/(pmax-pmin)))
   );
   st.calVerified=pointsReady&&temperatureValidation;
   st.calImage=null; // Nach jeder neuen Prüfung muss der NVM-Plan neu erstellt werden.
   $('calVerifyList').textContent=st.calValidation.map((v,i)=>(i+1)+'. '+v.pressure+' '+pressureUnit()+' · DSP_S '+v.actual+' · Abweichung '+v.errorBar.toFixed(5)+' '+pressureUnit()).join('\n');
   const remaining=Math.max(0,required-st.calValidation.length);
   const info=st.calVerified?
    (required===1?'Ein Prüfpunkt bestanden. NVM-Schritt freigegeben; der übrige Druckbereich wurde nicht verifiziert.':'Alle '+required+' Prüfpunkte bestanden. NVM-Schritt freigegeben.'):
    (remaining>0?'Noch '+remaining+' unabhängige Prüfpunkte erforderlich.':'Die Prüfpunkte sind erfasst, aber die Temperaturverifikation ist noch nicht vollständig.');
   ca('calRamMsg',`DSP_S ${got} · Soll ${target.toFixed(1)} Digits · Fehler ${errorBar.toFixed(5)} ${pressureUnit()} · ${st.calValidation.length}/${required} Prüfpunkte. ${info}`,st.calVerified&&required>1?'success':'warn');
  }catch(e){st.calVerified=false;st.calImage=null;ca('calRamMsg','DSP-Verifikation: '+e.message,'error')}
  finally{if(isChecking)st.calTask=false;renderFlowState()}
 }
 async function prepareNvm(){
  try{
   if(st.calTask||st.writing||st.nvmWorking)throw Error('Anderer Chipvorgang läuft');
   if(!coefficientSettingsCurrent()||!verificationComplete()||!st.calStaged)throw Error('Zuerst DSP-RAM-Kalibrierung mit allen gewählten Prüfpunkten erfolgreich abschliessen');
   // Lesen ist für den Vergleich immer erforderlich. Ein dauerhaftes Backup wird hier NICHT gespeichert.
   const readOK=await nvmScan({preview:true});
   if(!readOK||!st.nvmBackupVerified||!st.nvmBackup)throw Error('NVM konnte nicht vollständig und CRC-geprüft gelesen werden');
   if(!st.uid||st.uid.ser0!==st.nvmBackup[0]||st.uid.ser1!==st.nvmBackup[1])throw Error('Chip-UID kann dem aktuellen NVM nicht eindeutig zugeordnet werden');
   const image=CAL.configFrom(st.nvmBackup,st.calfit,st.afe??0x800,{output:st.expertOutputPlan});
   if(image.changes.some(c=>(c.index<28&&![16,22].includes(c.index))||c.index===29||c.index===30))throw Error('Unzulässiges NVM-Register im Änderungsplan');
   if(!image.changes.length)throw Error('Keine NVM-Änderungen nötig');
   st.calImage=image;
   $('nvmDiff').textContent=image.changes.map(c=>`NVM 0x${h(c.address)} [${c.index}] 0x${h(c.from,2)} → 0x${h(c.to,2)}`).join('\n');
   ca('nvmMsg',image.changes.length+' von 64 NVM-Wörtern werden verändert (CRC16 zuletzt). Factory-/Bootschutz geprüft.'+
     (verificationRequiredCount()===1?' Nur ein unabhängiger DSP-Prüfpunkt wurde verifiziert.':''),'warn');
   $('nvmProgress').textContent='NVM gelesen · Änderungsliste bereit';
  }catch(e){
   st.calImage=null;
   ca('nvmMsg','Vorbereitung fehlgeschlagen: '+e.message,'error');
  }finally{renderFlowState()}
 }
 async function nvmProgram(){
  if(st.nvmWorking||st.writing)return;
  let chipProgrammingStarted=false;
  try{
   const restoring=!!(expert.restoreReady()&&st.calImage===st.restorePlan),outputOnly=!!(expert.outputReady()&&st.calImage===st.outputOnlyPlan);
   if(st.iface!=='plc')throw Error('1-Wire-Startschutz: NVM darf ausschliesslich über eine bestätigte 1-Wire-Verbindung programmiert werden. Neu über 1-Wire verbinden.');
   if(st.mode!=='usb'||!st.chip||!st.port||!st.nvmBackupVerified||!st.calImage||(!restoring&&!outputOnly&&!verificationComplete()))throw Error('Hardware, Sicherungen oder Kalibrierverifikation fehlen');
   const id=st.uid?.hex;
   if(!id||st.uid.ser0!==st.nvmBackup[0]||st.uid.ser1!==st.nvmBackup[1])throw Error('48-Bit-Chip-UID muss vor dem Schreiben verifiziert werden');
   if($('nvmConfirmId').value.trim().toUpperCase()!==id)throw Error('48-Bit-Chip-UID stimmt nicht');
   const initial=st.calImage.before,modified=st.calImage.after;
   CAL.protectStartupCommunication(initial,modified);
   if(CAL.crc16(initial)!==initial[63]||CAL.crc16(modified)!==modified[63])throw Error('CRC16-Prüfung fehlgeschlagen');
   if(!restoring&&!outputOnly&&st.calfit.stats.maxDigits>100)throw Error('Fitfehler zu gross (>100 Digits)');
   const allowedNormal=new Set([16,22,28,31,32,33,34,...Array.from({length:16},(_,i)=>35+i),51,52,53,54,57,58,63]);
   if(st.calImage.changes.some(c=>restoring?(c.index<28||c.index>63):outputOnly?![16,22,57,58,63].includes(c.index):!allowedNormal.has(c.index)))throw Error('Unzulässige NVM-Änderung');
   if(restoring){
    for(let i=0;i<28;i++)if(modified[i]!==initial[i])throw Error('Factory-/Bootbereich weicht beim Restore ab');
   }else if(outputOnly||st.calImage.changes.some(c=>c.index===16||c.index===22||c.index===57||c.index===58)){
    if(!st.expertOutputPlan)throw Error('AODO-NVM-Änderung ohne geprüften Expertenvorschlag');
    const expected=CAL.prepareOutputConfig(initial,st.expertOutputPlan,outputOnly?st.outputOnlyPlan.limit:st.calfit.outputLimit);
    for(const i of [16,22,57,58])if(modified[i]!==expected[i])throw Error('Ausgangsregister entspricht nicht dem geprüften Vorschlag');
   }
   const saveOldNvm=$('nvmAutoBackup').checked;
   // Backup and export belong to this final explicitly confirmed action, not to the preview.
   // Without backup selection the original NVM remains in RAM only for readback/CRC safety.
   if(saveOldNvm){
    if(!expert.archiveCurrentNvm('Unmittelbar vor NVM-Programmierung'))throw Error('Backup konnte nicht lokal gespeichert werden. Kein NVM-Schreiben gestartet');
    expert.exportCurrent();
    ca('backupMsg','Altes NVM mit UID '+id+' lokal archiviert. JSON-Download gestartet.','success');
   }else{
    ca('backupMsg','Ohne Backup ausgewählt. Das alte NVM wurde zum sicheren Vergleich gelesen, aber nicht dauerhaft gesichert.','warn');
   }
   st.nvmDone=false;
   $('nvmRestartStatus').hidden=true;
   $('nvmRebootConfirm').checked=false;
   st.nvmWorking=true;st.calTask=true;st.writing=true;st.ramWriteScope='nvm';stopLive();
   ca('nvmMsg','NVM wird programmiert. USB-Verbindung nicht trennen, Versorgung stabil halten.','warn');
   // Never start NVM commands while a previous ADC/DSP live read is still in flight.
   if(st.liveReadPromise)await st.liveReadPromise.catch(()=>{});
   const beforeBoot=await bootSnapshot();await ramGrant();
   for(const i of [0,1,16,17,18,19,20,21,22,23,27,28,63]){const check=await nvmReadWord(i*2);if(check!==initial[i])throw Error(`Chip-NVM hat sich seit dem Backup verändert (Index ${i})`)}
   CAL.protectStartupCommunication(initial,modified);
   for(let i=0;i<28;i++)if(modified[i]!==initial[i]&&(restoring||![16,22].includes(i)))throw Error('Boot-/Werksbereich verändert');
   // Only USER region access is authorized; NEVER unlock factory calibration area.
   for(const x of [0x98BD,0x25BF,0x36D8])await maintWrite(0x4E,x);
   const status=await readReg(0x46);if(!(status&8))throw Error('NVM User-Bereich nicht freigegeben (CM_STATUS.ep_en=0)');
   const changes=st.calImage.changes.slice().sort((a,b)=>a.index===63?1:b.index===63?-1:a.index-b.index);
   let done=0;for(const c of changes){
    if(c.index<16||c.index>63)throw Error('Werksbereich gesperrt');
    await maintWrite(0x4A,c.to);chipProgrammingStarted=true;await maintWrite(0x4E,0xA300|c.address);
    const flags=await nvmWaitIdle(18000);if(flags&(1<<6))throw Error('CM_STATUS.crc_error während NVM-Programmierung');
    const chk=await nvmReadWord(c.address);if(chk!==c.to)throw Error(`NVM-Verify 0x${h(c.address)}: Ist 0x${h(chk,2)} Soll 0x${h(c.to,2)}`);
    done++;$('nvmProgress').textContent=`Geschrieben und verifiziert ${done}/${changes.length}`;
   }
   await maintWrite(0x4E,0x0000);
   await maintWrite(0x4E,0x8800);await nvmWaitIdle(15000);
   const after=[];for(let i=0;i<64;i++)after.push(await nvmReadWord(i*2));
   if(after.some((x,i)=>x!==modified[i]))throw Error('Abschliessender 64-Wort-NVM-Vergleich fehlgeschlagen');
   if(CAL.crc16(after)!==after[63])throw Error('Abschliessende NVM-CRC16-Prüfung fehlgeschlagen');
   const cm=await readReg(0x46);if(cm&(1<<6))throw Error('Chip meldet CM CRC Fehler');
   if(!sameBoot(beforeBoot,await bootSnapshot()))throw Error('Bootregister nach Programmierung abweichend');
   st.nvmDone=true;st.nvmBackup=after;st.nvmBackupVerified=true;st.calImage=null;st.restorePlan=null;st.outputOnlyPlan=null;if(saveOldNvm)expert.afterNvmScan();lsSet('elmos8-last-program',JSON.stringify({id,words:after,ts:new Date().toISOString(),restore:restoring}));
   ca('nvmMsg',restoring?'Backup-Wiederherstellung abgeschlossen, NVM rückgelesen und CRC16 bestätigt. Sensor neu starten und erneut prüfen.':outputOnly?'AODO-Ausgangseinstellungen dauerhaft gespeichert, NVM rückgelesen und CRC16 bestätigt. Sensor neu starten und Ausgabefunktion prüfen.':'NVM-Programmierung und vollständiges Rücklesen/CRC16 erfolgreich. Sensor neu starten und Schnittstelle erneut prüfen.','success');
  }catch(e){ca('nvmMsg',`NVM-Vorgang fehlgeschlagen: ${e.message}.${chipProgrammingStarted?' NVM-Schreibversuch wurde bereits begonnen: Chip nicht unkontrolliert neu starten, Backup und Diagnose sichern!':' Es wurden keine NVM-Schreibbefehle gestartet.'}`,'error');logging('NVM FEHLER: '+e.message)}
  finally{
   // A failed RAM-lock command must not leave the UI permanently in "busy" state.
   try{
    if(st.calTask){
     try{await maintWrite(0x4E,0x0000)}catch(e){logging('NVM-Zugriffssperre: '+e.message)}
     await ramLock()
    }
   }finally{
    st.ramWriteScope=null;st.nvmWorking=false;st.calTask=false;st.writing=false;
    renderStatus();
    // NVM programming intentionally pauses live measurement. Restart only AFTER
    // every maintenance flag was cleared; respect an explicit user pause.
    if(!st.manualLivePause&&st.port&&st.chip&&!st.closing){
     startLive();
     logging('Live-Messung nach NVM-Vorgang automatisch wieder gestartet');
    }
   }
  }
 }
 async function postBootCheck(automatic=false){
  if(st.closing||st.calTask||st.writing||st.nvmWorking)return;
  let checkingBoot=false;
  const reportBootCheck=(text,type)=>{
   $('nvmRestartStatus').hidden=false;
   show('nvmRestartStatus',text,type);
  };
  try{
   if(!st.chip||!st.port)throw Error('Erneut mit dem Sensor verbinden');
   if(automatic){
    if(!st.nvmDone||!(st.sensorPowerEnabled||demoEnabled))throw Error('Lastschaltersteuerung und erfolgreiches NVM-Schreiben erforderlich');
   }else if(!$('nvmRebootConfirm').checked){
    throw Error('Bitte den manuellen Neustart bestätigen');
   }
   const saved=lsGet('elmos8-last-program');
   if(!saved)throw Error('Kein erfolgreiches früheres NVM-Programmierprotokoll im Browser');
   const expected=JSON.parse(saved);
   if(!expected.words||expected.words.length!==64)throw Error('Vorheriges NVM-Backup ungültig');

   checkingBoot=true;
   st.calTask=true;
   stopLive();
   reportBootCheck(automatic?'Sensor wird neu gestartet und NVM wird geprüft …':'NVM nach Neustart wird geprüft …','warn');
   try{
    if(st.liveReadPromise)await st.liveReadPromise.catch(()=>{});
    if(automatic){
     await expert.identify();
     if(st.uid?.hex!==expected.id)throw Error('Anderer Chip angeschlossen');
     if(demoEnabled)demoPort.reboot();
     else await exchange('PLC START',3500);
    }else if(demoEnabled)demoPort.reboot();
    await expert.identify();
    if(st.uid?.hex!==expected.id)throw Error('Anderer Chip angeschlossen');
   }finally{st.calTask=false}

   const readOK=await nvmScan({postBoot:true});
   st.calTask=true;
   renderStatus();
   if(!readOK)throw Error('NVM nach Neustart nicht lesbar oder CRC-Prüfung fehlgeschlagen');
   if(st.nvmBackup.some((word,index)=>expected.words[index]!==word))throw Error('NVM nach Neustart weicht vom programmierten Abbild ab');
   const boot=await bootSnapshot();
   for(const [index,addr] of [[16,4],[17,6],[18,8],[19,10],[20,12],[22,16]]){
    if(boot[addr]!==st.nvmBackup[index])throw Error('RAM-Bootregister 0x'+h(addr)+' weicht vom NVM-Backup ab');
   }
   await readADC();
   const success='NVM nach Neustart vollständig rückgelesen. Chip-ID, CRC8, CRC16 und Bootregister stimmen.';
   reportBootCheck(success,'success');
   ca('nvmMsg',success,'success');
  }catch(e){
   reportBootCheck('Neustartprüfung fehlgeschlagen. '+e.message,'error');
  }finally{
   if(checkingBoot){
    st.calTask=false;
    renderStatus();
    if(st.chip&&!st.manualLivePause)startLive();
   }
  }
 }

 function syncPointNames(){
  for(const kind of ['lo','hi']){
   if(st.points[kind])st.points[kind].name=pointName(kind);
   const stored=st.calpoints.find(p=>p.kind===kind);
   if(stored)stored.name=pointName(kind)
  }
  refreshUnitLabels()
 }
 $('calUnit').addEventListener('change',()=>{
  const next=$('calUnit').value;
  if(next==='%'&&!st.points.lo&&!st.points.hi&&Number($('pmin').value)===0&&Number($('pmax').value)===10){$('pmax').value='100';$('pointLoName').value='0 %';$('pointHiName').value='100 %'}
  handleReferenceChange()
 });
 $('calUnitOther').addEventListener('change',handleReferenceChange);
 for(const id of ['pmin','pmax'])$(id).addEventListener('change',handleReferenceChange);
 for(const id of ['pointLoName','pointHiName'])$(id).addEventListener('change',()=>{$(id).dataset.userEdited='1';syncPointNames()});
 for(const id of ['calSOrder','calTOrder'])$(id).addEventListener('change',()=>invalidateCalculation('Polynomordnung verändert. Neu berechnen und anschliessend neu ins RAM übertragen.'));
 function updateDSPOutputLimit(){
  const limit=Number($('calDspLimit').value);
  $('calDspLimitHint').textContent=Number.isInteger(limit)&&limit>=1000&&limit<=32000?
   'DSP-Ziel: −'+fmt(limit)+' bis +'+fmt(limit)+' Digits. Bis zur positiven 16-Bit-Grenze bleiben '+fmt(32767-limit)+' Digits Reserve. Die Skalierung gilt für Berechnung, Live-Anzeige und DSP-Prüfung.':
   'DSP-Endwert ungültig. Ganze Zahl zwischen 1’000 und 32’000 Digits eingeben.';
 }
 $('calDspLimit').addEventListener('change',()=>{
  if(st.calfit)invalidateCalculation('DSP-Endwert geändert. Koeffizienten neu berechnen und erneut ins RAM übertragen.');
  updateDSPOutputLimit();renderDSPLive()
 });
 $('calDspLimit').addEventListener('input',()=>{$('calDspLimit').dataset.userEdited='1';updateDSPOutputLimit();});
 updateDSPOutputLimit();
 fillIntermediateReferences();refreshUnitLabels();
 // Anzeigeeinstellungen sind rein lokal und schreiben keine Sensorregister.
 loadDSPDisplay();
 for(const id of ['dspDisplayMin','dspDisplayMax','dspDisplayUnit','dspDisplayLimit']){
  $(id).addEventListener('change',saveDSPDisplay);
  $(id).addEventListener('input',renderDSPLive);
 }
 renderDSPLive();
 // Config-Vorlagen: strikt auf chipunabhängige Zielwerte begrenzt, niemals NVM/Bootdaten.
 let selectedConfig=null;
 function profileSummary(){
  const proposed=st.profilePendingAFE,box=$('configAfePending');
  box.hidden=!proposed;
  if(proposed){
   $('configAfeSummary').textContent='PGA1 '+GAINS1[proposed.pga1]+'× · Offset '+(proposed.offset*50)+' mV/V · PGA2 '+
    GAINS2[proposed.pga2]+'×. Aktuell im Chip: PGA1 '+GAINS1[st.staged.pga1]+'×, Offset '+(st.staged.offset*50)+
    ' mV/V, PGA2 '+GAINS2[st.staged.pga2]+'×. Erst nach einem bestätigten RAM-Schreibvorgang werden die Vorgaben aktiv.';
  }
 }
 function configFromUi(include){
  // Save the actual currently confirmed AFE settings, never a pending failed import.
  const p=st.staged;
  const cf=ELMOS_CONFIG.createSelective({
   label:$('configLabel').value.trim()||'Standardprofil',
   afe:{pga1:p.pga1,pga2:p.pga2,offset:p.offset},
   calibration:{
    sOrder:Number($('calSOrder').value),tOrder:Number($('calTOrder').value),
    dspLimit:Number($('calDspLimit').value),pointCount:Number($('calPointCount').value),
    samples:Number($('calSampleCount').value),
    reference:{min:Number($('pmin').value),max:Number($('pmax').value),
     unit:$('calUnit').value,customUnit:$('calUnitOther').value.trim()}
   },
   output:{mode:$('expertOutputMode').value,scaleEnabled:$('expertScaleEnable').checked,
    vdd:Number($('psscVdd').value),s0:Number($('psscS0').value),s1:Number($('psscS1').value),
    gain:Number($('expertScaleGain').value),offset:Number($('expertScaleOffset').value),
    pwmPeriod:Number($('expertPwmPeriod').value)}
  },include,CAL);
  return cf;
 }
 const CONFIG_GROUP_CONTROLS={
  afe:'configIncludeAfe',reference:'configIncludeReference',
  measurement:'configIncludeMeasurement',dsp:'configIncludeDsp',output:'configIncludeOutput'
 };
 function configSelectedGroups(){
  return Object.entries(CONFIG_GROUP_CONTROLS).filter(([,id])=>$(id).checked).map(([group])=>group);
 }
 function configIncluded(profile){
  return profile.version===2?profile.include.slice():ELMOS_CONFIG.GROUPS.slice();
 }
 function configGroupValues(profile){
  if(profile.version===2)return profile;
  const c=profile.calibration;
  return {...profile,include:ELMOS_CONFIG.GROUPS.slice(),
   reference:c.reference,measurement:{pointCount:c.pointCount,samples:c.samples},
   dsp:{sOrder:c.sOrder,tOrder:c.tOrder,dspLimit:c.dspLimit}};
 }
 function showConfigImportEffect(profile){
  const selected=profile?configSelectedGroups():[];
  const hasAfe=selected.includes('afe');
  $('configApply').disabled=!profile||!selected.length;
  $('configApply').textContent=hasAfe?'Config übernehmen + AFE direkt ins RAM':'Ausgewählte Vorgaben übernehmen';
  $('configImportEffect').textContent=!profile?
   'Datei auswählen, danach die zu übernehmenden Einstellungsgruppen bestimmen.':
   !selected.length?'Bitte mindestens eine Einstellungsgruppe für den Import auswählen.':
   hasAfe?'AFE ausgewählt: Mit «Übernehmen» werden PGA1, Offset und PGA2 direkt ins Chip-RAM geschrieben und rückgelesen. Keine EEPROM-Programmierung.':
   'AFE nicht ausgewählt: Nur die angehakten Gruppen werden als Vorgaben übernommen. Kein AFE-RAM- oder EEPROM-Schreibvorgang.';
 }
 function resetConfigImportSelection(profile){
  const available=new Set(profile?configIncluded(profile):[]);
  for(const [group,id] of Object.entries(CONFIG_GROUP_CONTROLS)){
   const checkbox=$(id);
   checkbox.checked=available.has(group);
   checkbox.disabled=!available.has(group);
  }
  $('configGroups').hidden=!profile;
  showConfigImportEffect(profile);
 }
 for(const id of Object.values(CONFIG_GROUP_CONTROLS))
  $(id).addEventListener('change',()=>showConfigImportEffect(selectedConfig));
 resetConfigImportSelection(null);
 $('configSave').addEventListener('click',()=>{
  try{
   const profile=configFromUi(ELMOS_CONFIG.GROUPS);
   const fileName=ELMOS_CONFIG.fileName(profile,window.ELMOS_GUIDED?.appliedPlanForConfig?.());
   download(fileName,JSON.stringify(profile,null,2));
   show('configPreview','Config «'+profile.label+'» vollständig gespeichert als '+fileName+'. Alle fünf wiederverwendbaren Gruppen enthalten. Beim Import wählst du aus, welche übernommen werden. Keine UID, EEPROM-Daten, Messwerte oder DSP-Koeffizienten.','success');
  }catch(e){show('configPreview','Config konnte nicht gespeichert werden: '+e.message,'error')}
 });
 $('configFile').addEventListener('change',async()=>{
  selectedConfig=null;resetConfigImportSelection(null);
  const file=$('configFile').files?.[0];if(!file)return;
  try{
   if(file.size>65536)throw Error('Config-Datei ist zu gross (max. 64 kB)');
   const profile=ELMOS_CONFIG.validate(JSON.parse(await file.text()),CAL);
   selectedConfig=profile;
   resetConfigImportSelection(profile);
   show('configPreview','Datei geprüft – noch NICHT übernommen.\n'+ELMOS_CONFIG.describe(profile)+
    '\nEs werden keine Messpunkte, Kalibrierkoeffizienten, EEPROM- oder Boot-/Kommunikationsdaten importiert.','success');
  }catch(e){selectedConfig=null;resetConfigImportSelection(null);show('configPreview','Config-Laden abgelehnt: '+e.message,'error')}
 });
 $('configApply').addEventListener('click',async()=>{
  const button=$('configApply'),fileInput=$('configFile');
  try{
   if(!selectedConfig)throw Error('Zuerst eine gültige Config-Datei wählen');
   if(st.writing||st.nvmWorking||st.calTask||st.afeWriteActive)throw Error('Chipvorgang läuft. Config erst danach übernehmen.');
   const profile=selectedConfig,values=configGroupValues(profile),included=configSelectedGroups();
   if(!included.length)throw Error('Bitte mindestens eine Einstellungsgruppe auswählen');
   if(included.some(group=>!values.include.includes(group)))
    throw Error('Die Auswahl enthält eine Gruppe, die in der Config-Datei fehlt');
   const has=(group)=>included.includes(group);
   const target=has('afe')?{...values.afe}:null;
   if(target&&(!st.port||!st.chip||st.mode!=='usb'))
    throw Error('AFE wurde für den Import ausgewählt. Für das direkte RAM-Laden zuerst einen echten Sensor verbinden oder AFE beim Import abwählen.');
   button.disabled=true;fileInput.disabled=true;
   for(const id of Object.values(CONFIG_GROUP_CONTROLS))$(id).disabled=true;
   // The click itself explicitly authorises the immediate AFE RAM transfer.
   // Existing commitGain checks the boot state and reads the written register back.
   if(target){
    show('configPreview','AFE-Übernahme läuft: PGA1/Offset/PGA2 werden in das Sensor-RAM geschrieben und rückgelesen. Noch kein EEPROM-Schreiben.','warn');
    const ok=await commitGain(target);
    if(!ok||!st.chip||!['pga1','pga2','offset'].every(k=>st.staged[k]===target[k])){
     st.profilePendingAFE={...target};profileSummary();
     throw Error('AFE-RAM-Übernahme nicht bestätigt. Chip prüfen und Config erneut übernehmen. Die anderen Einstellungen wurden nicht verändert.');
    }
    st.profilePendingAFE=null;profileSummary();
   }
   // Groups absent from the imported file must remain untouched.
   const affectsCalibration=has('afe')||has('measurement')||has('reference')||has('dsp');
   if(affectsCalibration){
    erasePoints();
    invalidateCalculation('Config übernommen. Messpunkte und DSP-Koeffizienten für diesen Sensor neu erfassen.');
    st.restorePlan=null;st.outputOnlyPlan=null;st.expertOutputPlan=null;
   }
   if(has('measurement')){
    $('calPointCount').value=String(values.measurement.pointCount);
    $('calSampleCount').value=String(values.measurement.samples);
    $('settingsSampleCount').value=String(values.measurement.samples);
    lsSet('elmos-cal-sample-count-v1',String(values.measurement.samples));
   }
   if(has('reference')){
    $('calUnit').value=values.reference.unit;
    $('calUnitOther').value=values.reference.customUnit;
    $('pmin').value=String(values.reference.min);$('pmax').value=String(values.reference.max);
   }
   if(has('dsp')){
    $('calSOrder').value=String(values.dsp.sOrder);$('calTOrder').value=String(values.dsp.tOrder);
    $('calDspLimit').value=String(values.dsp.dspLimit);$('calDspLimit').dataset.userEdited='1';
   }
   if(has('measurement')||has('reference')||has('dsp')){
    fillIntermediateReferences();refreshUnitLabels();updateDSPOutputLimit();renderDSPLive();
   }
   if(has('output'))expert.applyOutputProfile(values.output);
   if(!target){st.profilePendingAFE=null;profileSummary()}
   $('configLabel').value=profile.label;
   renderFlowState();
   show('configPreview','Config «'+profile.label+'» übernommen. Gruppen: '+included.join(', ')+'.\n'+
    (target?'AFE: Im Chip-RAM geschrieben und rückgelesen – Werte aktiv. ':'Keine AFE-Änderung am Chip. ')+
    'Keine EEPROM-Programmierung. '+(affectsCalibration?
     'Messpunkte und DSP-Koeffizienten für diesen Sensor neu aufnehmen.':
     'Bestehende Messpunkte und DSP-Koeffizienten wurden durch diesen reinen Ausgangsimport nicht verändert.'),'success');
   document.dispatchEvent(new CustomEvent('elmos-config-applied',{detail:{included:included.slice(),version:profile.version}}));
  }catch(e){
   show('configPreview','Config-Übernahme fehlgeschlagen: '+e.message,'error');
  }finally{
   fileInput.disabled=false;
   const available=new Set(selectedConfig?configIncluded(selectedConfig):[]);
   for(const [group,id] of Object.entries(CONFIG_GROUP_CONTROLS))
    $(id).disabled=!available.has(group);
   button.disabled=!selectedConfig||!configSelectedGroups().length;
  }
 });
 $('plcStartupLogExport').addEventListener('click',()=>{
  const log={
   tool:'ELMOS E703.11 – SSP3 Startdiagnose',version:'v0.6.13',at:new Date().toISOString(),
   source:'Web-App (NICHT PSSC Originalsoftware)',interface:st.iface,adapter:st.adapterKind,
   firmware:st.firmware,port:serialPortInfo(st.port),chipDetected:!!st.chip,
   startupAttempts:st.startupAttempts,lastPlcReply:st.lastPlcReply,
   chipDiag:st.chipDiag,log:st.log.slice(-500),
   note:'Der Export enthält nur die Web-App-Befehle. Für einen Vergleich wird zusätzlich ein originaler PSSC-SSP3-Trace benötigt. Keine Sensorregister werden durch den Export verändert.'
  };
  download('E70311_SSP3_Web_Log_'+Date.now()+'.json',JSON.stringify(log,null,2));
  $('plcStartupState').textContent='Web-App-Protokoll gespeichert. Für die fehlende Initialisierung wird auch die Befehlsfolge der Originalsoftware benötigt.';
 });
 $('plcStartupProbe').addEventListener('click',()=>recoverOneWireStartup().catch(e=>{
  logging('PLC-Starttest konnte nicht gestartet werden: '+e.message);
  show('connMsg',e.message,'error');
 }));
 $('plcStartupStop').addEventListener('click',()=>{
  st.startupAbort=true;
  $('plcStartupState').textContent='Abbruch angefordert – laufende Leseantwort wird noch abgeschlossen.';
 });
 // controls
 const savedSampleCount=Number(lsGet('elmos-cal-sample-count-v1'));
 if(Number.isInteger(savedSampleCount)&&savedSampleCount>=1&&savedSampleCount<=100)$('calSampleCount').value=String(savedSampleCount);
 $('settingsSampleCount').value=$('calSampleCount').value;
 $('calSampleCount').addEventListener('change',()=>{
  try{
   const count=chosenCalibrationSamples();
   $('settingsSampleCount').value=String(count);
   lsSet('elmos-cal-sample-count-v1',String(count));
   ca('calPointsMsg','Ab der nächsten Aufnahme werden '+count+' Samples pro Messpunkt erfasst. Bereits aufgenommene Messpunkte bleiben unverändert.','success')
  }catch(e){
   ca('calPointsMsg',e.message,'error')
  }
 });
 $('calPointCount').addEventListener('change',()=>{
  if(st.calTask||st.writing||st.nvmWorking){show('calPointPlanMsg','Anzahl während laufender Wartung nicht ändern.','error');return}
  erasePoints();
  $('pointHiName').dataset.userEdited='';
  for(let k=1;k<=8;k++){$('calExtra'+k+'Name').dataset.userEdited='';$('calExtra'+k+'Pressure').dataset.userEdited=''}
  fillIntermediateReferences();refreshUnitLabels();
  show('calPointsMsg','Anzahl geändert. Die vorherigen Messwerte wurden verworfen, damit sie nicht versehentlich für den neuen Abgleich verwendet werden.','warn')
 });
 for(let k=1;k<=8;k++){
  $('calExtra'+k+'Capture').addEventListener('click',()=>captureCalPoint(k));
  $('calExtra'+k+'Pressure').addEventListener('change',()=>{
   $('calExtra'+k+'Pressure').dataset.userEdited='1';
   if(st.calpoints.some(x=>x.kind==='extra'&&x.slot===k)){
    st.calpoints=st.calpoints.filter(x=>!(x.kind==='extra'&&x.slot===k));
    invalidateCalculation('Referenzwert geändert. Messpunkt '+(k+1)+' neu aufnehmen.');
    refreshPoints()
   }
  });
  $('calExtra'+k+'Temp').addEventListener('change',()=>{
   if(st.calpoints.some(x=>x.kind==='extra'&&x.slot===k)){
    st.calpoints=st.calpoints.filter(x=>!(x.kind==='extra'&&x.slot===k));
    invalidateCalculation('Temperatur geändert. Messpunkt '+(k+1)+' neu aufnehmen.');
    refreshPoints()
   }
  });
  $('calExtra'+k+'Name').addEventListener('change',()=>{
   $('calExtra'+k+'Name').dataset.userEdited='1';
   const x=st.calpoints.find(x=>x.kind==='extra'&&x.slot===k);
   if(x)x.name=$('calExtra'+k+'Name').value.trim()||'Messpunkt '+(k+1);
   renderCalPoints()
  })
 }
 for(const id of ['calLoTemp','calHiTemp'])$(id).addEventListener('change',()=>{
  erasePoints();show('calPointsMsg','Referenztemperatur eines Endpunkts geändert. Die Messpunkte neu aufnehmen.','warn')
 });
 $('calPointClear').addEventListener('click',()=>{erasePoints();ca('calPointsMsg','Alle Kalibriermesspunkte verworfen.');});
 $('calCalculate').addEventListener('click',calcCoefficients);
 $('calApplyRam').addEventListener('click',applyCalRam);
 $('calVerifyRam').addEventListener('click',verifyCalRam);
 $('calVerifyCount').addEventListener('change',()=>{
  st.calValidation=[];st.calVerified=false;st.calImage=null;
  $('calVerifyList').textContent='Noch kein Prüfpunkt aufgenommen.';
  ca('calRamMsg','Anzahl Prüfpunkte geändert. Prüfungen zurückgesetzt; DSP_S erneut messen.','warn');
  renderFlowState()
 });
 $('nvmBackupRead').addEventListener('click',nvmScan);
  $('outputNvmRead').addEventListener('click',()=>nvmScan({expertRead:true}));
 function downloadNvmBackup(){
  if(!st.nvmBackupVerified||!st.nvmBackup)return ca('backupMsg','Zuerst vollständiges Original-NVM lesen und prüfen.','error');
  if(!st.uid)return ca('backupMsg','48-Bit-Chip-UID nicht verfügbar. Erst «Chip-UID lesen» im Expertenmodus ausführen.','error');
  expert.exportCurrent();
  ca('backupMsg','Backup-Export für UID '+st.uid.hex+' ausgelöst. Sichere die JSON-Datei für eine spätere Wiederherstellung.','success')
 }
  $('nvmBackupDownload').addEventListener('click',downloadNvmBackup);
 $('nvmPrepare').addEventListener('click',prepareNvm);
 // Backup ist aus Sicherheitsgründen bei jedem neuen Browserdurchlauf standardmässig aktiviert.
 $('nvmAutoBackup').checked=true;
 $('nvmAutoBackup').addEventListener('change',renderFlowState);
 $('nvmConfirmId').addEventListener('input',renderFlowState);
 $('nvmProgram').addEventListener('click',nvmProgram);
 $('nvmPostBoot').addEventListener('click',()=>postBootCheck());
 $('nvmRestart').addEventListener('click',()=>postBootCheck(true));
 renderCalPoints();
 // ============ Ende Kalibrierung + NVM ============

 // wiring
 document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>step(b.dataset.step)));document.querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>step(b.dataset.next)));
 $('iface').value=lsGet('elmos8-iface')||'plc';if(!ifcfg[$('iface').value])$('iface').value='plc';st.iface=$('iface').value;
 $('adapterType').value=demoEnabled?'ssp3':lsGet('elmos-adapter-type-v1')||'ssp3';
 if(demoEnabled)$('iface').value='plc';
 if(!['ssp3','bridge'].includes($('adapterType').value))$('adapterType').value='ssp3';
 st.adapterKind=$('adapterType').value;
 $('plcOptions').hidden=st.adapterKind!=='bridge';
 $('tooltips').checked=(lsGet('elmos7-tooltips')??'1')==='1';tipEnabled=$('tooltips').checked;
 $('tooltips').addEventListener('change',()=>{tipEnabled=$('tooltips').checked;lsSet('elmos7-tooltips',tipEnabled?'1':'0');tip.classList.remove('visible')});
 function toggleSettings(open){
  $('settingsPanel').hidden=!open;
  $('settingsOpen').setAttribute('aria-expanded',String(open));
  if(open)$('settingsSampleCount').value=$('calSampleCount').value;
 }
 $('settingsOpen').addEventListener('click',()=>toggleSettings($('settingsPanel').hidden));
 $('settingsClose').addEventListener('click',()=>toggleSettings(false));
 const demoMode=$('demoMode');
 demoMode.checked=demoEnabled;
 async function changeDemoMode(enabled){
  demoMode.disabled=true;
  try{
   if(st.closing||(st.port&&!await disconnect())){
    demoMode.checked=demoEnabled;
    $('settingsMsg').textContent='Demo-Modus konnte nicht gewechselt werden. Prüfe die USB-Verbindung oder warte auf den laufenden Vorgang.';
    return;
   }
   const url=new URL(location.href);
   url.searchParams.set('v','0.6.7');
   if(enabled)url.searchParams.set('demo','1');
   else url.searchParams.delete('demo');
   location.assign(url);
  }finally{demoMode.disabled=false}
 }
 demoMode.addEventListener('change',()=>changeDemoMode(demoMode.checked));
 $('demoExit').addEventListener('click',()=>changeDemoMode(false));

 $('settingsSampleCount').addEventListener('change',()=>{
  const n=Number($('settingsSampleCount').value);
  if(!Number.isInteger(n)||n<1||n>100){
   $('settingsMsg').textContent='Sample-Anzahl muss zwischen 1 und 100 liegen.';
   return
  }
  $('calSampleCount').value=String(n);
  lsSet('elmos-cal-sample-count-v1',String(n));
  $('settingsMsg').textContent='Standard-Sample-Anzahl: '+n+'. Gilt für neue Messpunkte.';
 });
 const intervalStored=Number(lsGet('elmos-live-interval-v1'));
 if([400,650,1000,1500,2000].includes(intervalStored))liveIntervalMs=intervalStored;
 $('settingsLiveInterval').value=String(liveIntervalMs);
 $('settingsLiveInterval').addEventListener('change',()=>{
  const n=Number($('settingsLiveInterval').value);
  if(![400,650,1000,1500,2000].includes(n))return;
  liveIntervalMs=n;
  lsSet('elmos-live-interval-v1',String(n));
  $('settingsMsg').textContent='Live-Abfrageintervall auf '+n+' ms eingestellt. Der nächste Lesezyklus verwendet diesen Wert.';
 });
 $('iface').addEventListener('change',()=>{if(st.port){$('iface').value=st.iface;show('connMsg','Zur Schnittstellenänderung zuerst USB trennen.','warn');return}st.iface=$('iface').value;lsSet('elmos8-iface',st.iface);renderStatus()});
 $('adapterType').addEventListener('change',()=>{
  if(st.port){$('adapterType').value=st.adapterKind;show('connMsg','Zur Adapteränderung zuerst die USB-Verbindung trennen.','warn');return}
  st.adapterKind=$('adapterType').value;
  $('plcOptions').hidden=st.adapterKind!=='bridge';
  lsSet('elmos-adapter-type-v1',st.adapterKind);
  show('connMsg',st.adapterKind==='bridge'?'ESP32-C3-Bridge ausgewählt. PLC-Baudrate und Sensorversorgung prüfen.':'SSP3 Evaluation Board ausgewählt. Die originale Kommunikation bleibt unverändert.','warn');
  renderStatus();
 });
 $('choose').addEventListener('click',()=>choose());$('auto').addEventListener('click',()=>auto());$('disconnect').addEventListener('click',()=>disconnect());
 $('readNow').addEventListener('click',()=>readADC().catch(e=>show('adcMsg','ADC: '+e.message,'error')));$('live').addEventListener('click',()=>{if(st.live){st.manualLivePause=true;stopLive()}else{st.manualLivePause=false;startLive()}});
 for(const k of ['pga1','pga2','offset']){
  $(k+'Down').addEventListener('click',()=>stepAFE(k,-1));
  $(k+'Up').addEventListener('click',()=>stepAFE(k,1))
 }
  $('chipDiagRead').addEventListener('click',()=>runChipDiagnostics('Manuelle Diagnose').catch(e=>show('connMsg','Chipdiagnose: '+e.message,'warn')));
 $('chipDiagExport').addEventListener('click',()=>{
  if(!st.chipDiag)return show('connMsg','Zuerst eine Chipdiagnose durchführen.','warn');
  download('ELMOS_E70311_Chipdiagnose_'+Date.now()+'.json',JSON.stringify({
   ...st.chipDiag,interpretation:formatChipDiag(st.chipDiag),lastPlcReply:st.lastPlcReply,
   usbLog:st.log.slice(-120),crc8Note:'Byte aufgezeichnet; unabhängige Validierung ausstehend'
  },null,2))
 });
 $('readBoot').addEventListener('click',()=>readBoot().catch(e=>logging('Boot-Prüfung: '+e.message)));$('readRegs').addEventListener('click',()=>registerDump());
 $('capLo').addEventListener('click',()=>capture('lo'));$('capHi').addEventListener('click',()=>capture('hi'));$('verify').addEventListener('click',()=>verify());
 $('exportJSON').addEventListener('click',()=>download('ELMOS_Kalibrierprotokoll_'+Date.now()+'.json',JSON.stringify(report(),null,2)));
 $('exportDiag').addEventListener('click',()=>download('ELMOS_USB_Diagnose_'+Date.now()+'.json',JSON.stringify(report(),null,2)));
 $('exportCSV').addEventListener('click',()=>download('ELMOS_ADC_'+Date.now()+'.csv','\uFEFFZeit;ADC_S;ADC_T;ADC_TC;Quelle;PGA1;PGA2;Offset\n'+st.history.map(v=>[v.time,v.adc_s,v.adc_t,v.adc_tc,v.source,v.gains.pga1,v.gains.pga2,v.gains.offset].join(';')).join('\n'),'text/csv;charset=utf-8'));
 Object.assign(HELP,{sorder:'Polynomgrad für die Druck-Kennlinie. Höhere Grade brauchen mehr unabhängige Messpunkte und bergen ein erhöhtes Überanpassungsrisiko.',torder:'Temperaturkompensation. Bei Ordnung 0 wird der bestehende Temperaturpfad im Chip beibehalten. Für Ordnung 1–3 sind Messpunkte bei verschiedenen Temperaturen nötig.',nvm:'Permanenter NVM-Speicher. Ein Stromausfall während der Programmierung kann trotz Schutz der Schnittstellenregister einen CRC-Fehler erzeugen. Vorher Backup und RAM-Test durchführen.'});
 window.addEventListener('beforeunload',e=>{if(st.nvmWorking){e.preventDefault();e.returnValue=''} });
 const tip=$('tip');document.querySelectorAll('.help').forEach(el=>{el.setAttribute('tabindex','0');el.addEventListener('mouseenter',e=>tooltip(e,el));el.addEventListener('mousemove',e=>placeTip(e));el.addEventListener('mouseleave',()=>tip.classList.remove('visible'));el.addEventListener('focus',e=>tooltip(e,el));el.addEventListener('blur',()=>tip.classList.remove('visible'))});function tooltip(e,el){if(!tipEnabled)return;tip.textContent=HELP[el.dataset.help]||'';tip.classList.add('visible');placeTip(e)}function placeTip(e){const rect=e.target?.getBoundingClientRect?.()||{left:25,bottom:25};let x=e.clientX||rect.left,y=e.clientY||rect.bottom;tip.style.left=Math.max(10,Math.min(window.innerWidth-330,x+15))+'px';tip.style.top=Math.max(10,Math.min(window.innerHeight-150,y+16))+'px'}
 if(demoEnabled){
  $('demoNotice').hidden=false;
  $('adapterType').options[0].textContent='Simulierter E703.11';
  window.addEventListener('DOMContentLoaded',()=>{
   setTimeout(()=>connect(demoPort,false).catch(e=>show('connMsg','Demo konnte nicht starten: '+e.message,'error')),0);
  },{once:true});
 }else if(!navigator.serial||!window.isSecureContext){show('connMsg','Für echte USB-Kommunikation Chrome Desktop über HTTPS oder localhost nutzen. Ohne USB-Verbindung ist kein Sensorzugriff möglich.','warn');$('choose').disabled=true;$('auto').disabled=true;}else{setTimeout(()=>auto().catch(()=>{}),350)}
 const expert=ELMOS_EXPERT.init({st,CAL,readReg,nvmScan,download,show,stopLive,startLive,lsGet,lsSet,renderFlowState,verificationComplete});
 // Read-only guide bridge: uses the same ADC/DSP samples as the classic UI.
 function guidedTelemetry(){
  const online=!!(st.port&&st.chip);
  const nowMs=Date.now();
  const adc=online&&st.adc&&nowMs-st.adc.time<5000?st.adc:null;
  const dsp=online&&st.dsp&&nowMs-st.dsp.time<5000&&!st.dspError?st.dsp:null;
  const configured=getActiveDSPRange();
  const range=configured;
  const sensor=dsp&&range?range.min+(dsp.raw+range.limit)/(2*range.limit)*(range.max-range.min):null;
  return {
   online,live:!!st.live,mode:st.mode,adcS:adc?.s??null,adcT:adc?.t??null,adcTC:adc?.tc??null,
   adcTime:adc?.time??null,dspRaw:dsp?.raw??null,dspTime:dsp?.time??null,
   sensorValue:Number.isFinite(sensor)?sensor:null,unit:range?.unit??null,
   range:range?{min:range.min,max:range.max,kind:range.kind}:null,
   gains:{...st.staged},nvmConfirmed:!!st.nvmDone,
   // These are editable desired values, NOT voltages measured on AODO.
   voltageTargets:{vdd:Number($('psscVdd').value),s0:Number($('psscS0').value),s1:Number($('psscS1').value)}
  };
 }
 function guidedAfeStats(since){
  const start=Number.isFinite(since)?since:Date.now();
  const selected=st.history.filter(item=>Date.parse(item.time)>=start&&
   item.source==='usb'&&Number.isFinite(item.adc_s)&&
   item.gains?.pga1===st.staged.pga1&&item.gains?.pga2===st.staged.pga2&&item.gains?.offset===st.staged.offset);
  if(!selected.length)return {count:0,min:null,max:null,hub:null,limitExceeded:false};
  const readings=selected.map(item=>item.adc_s);
  const min=Math.min(...readings),max=Math.max(...readings);
  return {count:readings.length,min,max,hub:max-min,limitExceeded:readings.some(v=>Math.abs(v)>25000)};
 }
 window.ELMOS_GUIDED_API=Object.freeze({
  state:()=>({
   chip:!!st.chip,mode:st.mode,adapter:st.adapterKind,uid:st.uid?.hex||null,
   points:st.calpoints.map(x=>({kind:x.kind,slot:x.slot,at:x.at,pressure:x.pressure,temperature:x.temperature})),
   calStaged:!!st.calStaged,calVerified:verificationComplete(),nvmDone:!!st.nvmDone,
   nvmBackupVerified:!!st.nvmBackupVerified,outputReady:expert.outputReady()
  }),
  navigate:n=>step(n),
  refresh:()=>{renderFlowState();renderStatus()},
  telemetry:()=>guidedTelemetry(),
  afeStats:since=>guidedAfeStats(since),
  redraw:()=>draw(),

 });
 gainSummary();renderStatus();step(0);window.addEventListener('resize',draw);
})();
