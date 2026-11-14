/* E703.11 browser / SSP3 laboratory prototype. NVM writes require explicit gated workflow; boot and factory NVM locked. */
'use strict';
const PROTOCOL = (() => {
 const hx = (n,bytes=1)=>Number(n).toString(16).toUpperCase().padStart(bytes*2,'0');
 const crc = (data,bits,width,seed,poly)=>{let c=seed;for(let k=0;k<bits;k++){let a=(c>>(width-1))&1,b=(data[Math.floor(k/8)]>>(7-k%8))&1;c=(c<<1)^((a^b)?poly:0)}return c&((1<<width)-1)};
 const crc4=(data,bits)=>crc(data,bits,4,0xF,0x03);
 const crc8PLC=data=>crc(data,data.length*8,8,0xF3,0x07);
 const plcRead=(addr,count=1,slave=0x6C)=>{if(!Number.isInteger(slave)||slave<0||slave>0xFE||(slave&1))throw Error('Ungültige PLC-Slave-Adresse');if(!Number.isInteger(addr)||addr<0||addr>0xFE||addr%2||count<1||count>16||addr+2*(count-1)>0xFE)throw Error('Ungültige PLC-Leseadresse/Anzahl'); const a=slave|1,h=(count-1)<<4,c=crc4([a,addr,h],20);return `PLC 02${hx(a)}${hx(addr)}${hx(h|c)}.`};
 const plcWrite=(addr,word,slave=0x6C)=>{if(!Number.isInteger(slave)||slave<0||slave>0xFE||(slave&1))throw Error('Ungültige PLC-Slave-Adresse');if(!Number.isInteger(addr)||addr<0||addr>0xFE||addr%2||!Number.isInteger(word)||word<0||word>65535)throw Error('Ungültiger PLC-Schreibwert');let head=crc4([slave|1,addr,0],20),h=(word>>8)&255,l=word&255;return `PLC 02${hx(slave&~1)}${hx(addr)}${hx(head)}${hx(h)}${hx(l)}${hx(crc8PLC([addr,head,h,l]))}`};
 // Firmware variant seen on SSP3 v02.08.02.04: 'PLC <slave_id> <data>'.
 // Only split the two-character host slave-id token; leave the CRC-protected
 // E703.11 frame data unchanged. Preserve bare PLC P / PLC T control commands.
 const plcHostCommand=(command,format='legacy')=>{
  if(format==='legacy')return command;
  if(format!=='separate')throw Error('Unbekanntes SSP3-PLC-Hostformat');
  const match=/^PLC ([0-9A-F]{2})([0-9A-F.]+)$/i.exec(command);
  if(!match)throw Error('PLC-Telegramm nicht für getrennte Slave-ID geeignet');
  return 'PLC '+match[1]+' '+match[2];
 };
 // PLC [7:1] = CFG_PADS1.plc_upper_addr : CFG_SPI_I2C.i2c_address[5:0].
 const plcAddressFromConfig=(cfg,pads)=>{
  if(!Number.isInteger(cfg)||!Number.isInteger(pads))throw Error('Ungültige PLC-Konfiguration');
  return (((pads>>12)&1)<<7)|(((cfg>>9)&0x3F)<<1);
 };
 const plcProbeOrder=(preferred=0x6C)=>[...new Set([preferred,0x6C,0x7C])].filter(
  a=>Number.isInteger(a)&&a>=0&&a<=0xFE&&!(a&1));
 const i2cRead=(addr,slave=0xD8)=>`I2C #1 S${hx(slave&~1)}${hx(addr)}R${hx(slave|1)}..P`;
 const i2cWrite=(addr,word,slave=0xD8)=>`I2C #1 S${hx(slave&~1)}${hx(addr)}${hx(word&255)}${hx(word>>8)}P`;
 const spiRead=addr=>`SPI ${hx(addr|1)}000000`;
 const spiWrite=(addr,word)=>`SPI ${hx(addr)}00${hx(word,2)}`;
 const lines=data=>data.replace(/\x00/g,'').split(/[\r\n]+/).map(s=>s.trim()).filter(Boolean);
 const readData=(reply,expectedBytes)=>{const clean=lines(reply);if(clean.some(l=>l.startsWith('!')))throw Error(clean.filter(l=>l.startsWith('!')).join('; '));const candidates=clean.filter(s=>!s.startsWith('#')&&!s.startsWith('@')&&s!==':'&&/^(?:[0-9a-fA-F]{2}(?:\s+|$))+$/.test(s)).map(s=>s.match(/[0-9a-fA-F]{2}/g).map(x=>parseInt(x,16))).filter(a=>a.length===expectedBytes);if(candidates.length!==1)throw Error(`Ungültige oder mehrdeutige SSP3-Antwort: ${reply.slice(0,190).replace(/\r/g,'\\r')}`);return candidates[0]};
 // Real SSP3 firmware 02.08.02.04 can concatenate responses directly:
 // '#PWR_ON ... :#PLC T :' without an intervening CR after the first ':'.
 // A prompt is a ':' followed only by whitespace and the next echo or EOT.
 const ssp3PromptCount=reply=>(reply.match(/:\s*(?=#|$)/g)||[]).length;
 const ssp3StartupAcks=reply=>({
  power:/(?:^|[:\r\n])\s*#PWR_ON\b/i.test(reply),
  plc:/(?:^|[:\r\n])\s*#PLC T\b/i.test(reply)
 });
 const periodMode=v=>v==null?'unknown':v===0?'disabled':v===1?'continuous':v===2?'single':'periodic';
 const sign16=n=>(n&0x8000)?n-65536:n;
 const offsetEncode=o=>o<0?0x10-o:o;
 const offsetDecode=v=>v===0?0:v>=1&&v<=8?v:v>=17&&v<=24?16-v:null;
 const decAFE=w=>({pga1:w&3,pga2:(w>>7)&15,offset:offsetDecode((w>>2)&31)});
 const goodG=g=>Number.isInteger(g.pga1)&&g.pga1>=0&&g.pga1<=3&&Number.isInteger(g.pga2)&&g.pga2>=0&&g.pga2<=8&&Number.isInteger(g.offset)&&g.offset>=-8&&g.offset<=8;
 const AFE_BITS=0x7FF;
 const encAFE=(old,g)=>{if(!goodG(g))throw Error('Ungültiger Gain/Offset');if(!(old&0x800))throw Error('Pflichtbit 11 fehlt. Schreiben gesperrt.');let n=((old&(~AFE_BITS))|(g.pga1&3)|(offsetEncode(g.offset)<<2)|((g.pga2&15)<<7))&0xffff;if(((n^old)&~AFE_BITS)!==0)throw Error('Fremde AFE-Bits betroffen');return n};
 return {hx,crc,crc4,crc8PLC,plcRead,plcWrite,plcAddressFromConfig,plcProbeOrder,plcHostCommand,ssp3PromptCount,ssp3StartupAcks,periodMode,i2cRead,i2cWrite,spiRead,spiWrite,readData,sign16,decAFE,encAFE,goodG};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=PROTOCOL;
if(typeof document!=='undefined') (function UI(){
 const $=id=>document.getElementById(id),P=PROTOCOL;
 const demoEnabled=new URLSearchParams(location.search).get('demo')==='1';
 const lsGet=k=>{try{return demoEnabled?sessionStorage.getItem('demo-'+k):localStorage.getItem(k)}catch{return null}};
 const lsSet=(k,v)=>{try{if(demoEnabled)sessionStorage.setItem('demo-'+k,v);else localStorage.setItem(k,v)}catch{}};
 const GAINS1=[3.5,6,8.5,11],GAINS2=[2,2.22,2.5,2.86,3.33,4,5,6.67,10];
 const LOCKED=[4,6,8,10,12,16],R_AFE=0x1C,R_BRIDGE=0x1A;
 const BRIDGE_VOLTAGES=[2.4,1.6,2.0];
 const CAL=ELMOS_CAL; const CAL_REGS=[0x6C,0x6E,0x70,0x72,...Array.from({length:16},(_,i)=>0x74+2*i),0x94,0x96,0x98,0x9A];
 const demoPort=demoEnabled?ELMOS_DEMO.create(P,CAL,()=>({
  lower:Number($('pmin').value),upper:Number($('pmax').value),limit:getActiveDSPRange()?.limit??32000
 })):null;
 const REG_NAMES={4:'CFG_EN',6:'CFG_SPI_I2C',8:'CFG_PADS0',10:'CFG_PADS1',12:'CFG_PADS2',16:'CFG_AODO',0x14:'CFG_ADC',0x16:'CFG_LP0',0x18:'CFG_LP1',0x1A:'CFG_AFE0',0x1C:'CFG_AFE1',0x1E:'CFG_AFE2',0x26:'ADC_TC',0x28:'ADC_T',0x2A:'ADC_S'};
 const st={chipDiag:null,diagRunning:false,lastPlcReply:null,mode:'offline',port:null,closing:false,reader:null,readerPromise:null,readerAlive:false,adapterNoReply:false,sessionStartedAt:null,sessionIndex:0,cmdQueue:Promise.resolve(),replyBuffer:'',responseWait:null,iface:'plc',adapterKind:'ssp3',sensorPowerEnabled:false,startupRunning:false,startupAbort:false,startupAttempts:0,magicRunning:false,magicResult:null,powerCycleRunning:false,powerCycleResult:null,startupTrials:[],powerHelp:null,plcHostFormat:'legacy',plcAddress:0x6C,plcAddressVerified:false,plcAddressSource:'',plcAddressProbes:[],firmware:'',chip:false,readOnlySensor:null,sensorLost:false,reinitRunning:false,boot:null,afe:null,afe0:null,bridgeWriteAllowed:false,bridgeReadBusy:false,staged:{pga1:0,pga2:0,offset:0},adc:null,dsp:null,dspError:null,liveReadPromise:null,trend:[],history:[],log:[],regs:{},points:{lo:null,hi:null},verify:null,live:false,manualLivePause:false,timeout:null,consecutiveErrors:0,liveReadAttempts:0,liveReadSuccesses:0,liveLastError:null,liveLastAttemptAt:null,measurementPeriod:null,measurementStatus:null,measurementError:null,measurementStarts:0,measurementFreshCount:0,measurementLastChangedAt:null,writing:false,pressure:5,calpoints:[],calfit:null,calImage:null,nvmBackup:null,nvmBackupVerified:false,calStaged:false,calVerified:false,calValidation:[],calTask:false,testLogging:false,nvmWorking:false,nvmDone:false,afeWriteActive:false,ramWriteScope:null,uid:null,expertOutputPlan:null,restorePlan:null,outputOnlyPlan:null,uidShownForInput:null,profilePendingAFE:null};
 let currentStep=0,pendingGain=null,writeTimer=null;let tipEnabled=true,liveIntervalMs=650;
 let liveSecondaryIndex=0;
 let reconnectSsp3OnUsb=true;
 const HELP={interface:'Schnittstelle zwischen SSP3-Board und Sensorchip. 1-Wire nutzt AODO (VDD, GND und AODO). Die Einstellung IF_CFG ändert die Programmer-Pins, nicht die NVM-Konfiguration des Sensors.',baud:'Baudrate des USB-UART zwischen Chrome und dem SSP3. Die Herstellersoftware verwendet 115200 Baud als Standard.',adcs:'ADC_S ist der unkompensierte 16-Bit-Druck-ADC. ±25000 Digits ist ein vorsichtiges Ziel für den manuellen Abgleich, keine garantierte Hardwaregrenze.',dsp_live:'DSP_S (Register 0x30) ist der skalierte DSP-Sensorausgang. Die Anzeige liest den Chipwert wiederholt und rechnet ihn mit dem konfigurierten DSP-Endwert (standardmässig ±32’000 Digits) in den gewählten Anzeigebereich um. Ein DSP-Wert allein belegt keine gültige Kalibrierung.',pga1:'Erste Druckverstärkungsstufe: 3.5×, 6×, 8.5× oder 11× (typische Werte laut Datenblatt 2023). Für gutes SNR möglichst hoch ohne Übersteuerung.',pga2:'Zweite Verstärkungsstufe: typische Faktoren 2× bis 10×. Der Gesamtfaktor ist PGA1 × PGA2.',offset:'17 DAC-Stufen von −400 bis +400 mV/V bezogen auf die Brückenspannung. Die Verschiebung liegt zwischen PGA1 und PGA2.',bridgeSupply:'Interne Brückenversorgung SVDD gemäss E703.11 CFG_AFE0 (0x1A), Bits 1:0: 2,4 V (Standard), 1,6 V oder 2,0 V. Die externe Sensorversorgung VDD muss bei 2,4 V mindestens 3,0 V, sonst mindestens 2,7 V betragen. Beim Wechsel bleiben die übrigen AFE0-Bits inklusive Brückengain unverändert. Nur nach Klick wird ins RAM geschrieben; EEPROM bleibt unverändert.',pressureunit:'Einheit für die Referenz- und Prüfdruckwerte. Für relative Kalibrierungen kann beispielsweise % mit 0 bis 100 gewählt werden. Referenzwerte müssen zum tatsächlichen Prüfstand passen. Einheitenwechsel erfordert neue Messpunkte.',dsp_limit:'Symmetrischer DSP-Endwert für die neue Kalibrierung. Standard ±32’000 Digits. ±30’000 lässt zusätzlich Reserve. Der Wert verändert die berechneten Koeffizienten sowie DSP-Soll und Fehlerumrechnung; er ist keine Hardware-Clipping-Grenze.',ram:'PGA1, Offset und PGA2 werden mit jeder Pfeiltaste sofort ausschliesslich in CFG_AFE1 0x1C im RAM geändert und rückgelesen. Kein NVM-/EEPROM-Schreiben. Boot-/Kommunikationsregister werden kontrolliert.',};
 const h=P.hx;
 const fmt=n=>n===null||n===undefined||!Number.isFinite(n)?'—':Math.round(n).toLocaleString('de-CH');
 const now=()=>new Date().toLocaleTimeString('de-CH',{hour12:false});
 const show=(id,text,type='')=>{const e=$(id);if(!e)return;if(id==='configPreview')e.hidden=false;e.textContent=text;e.className='callout'+(type?' '+type:'')};
 const logging=t=>{if(window.ELMOS_ARCHIVE?.active&&(st.calTask||st.writing||st.nvmWorking))window.ELMOS_ARCHIVE.trace(t);st.log.push(now()+'  '+t);if(st.log.length>500)st.log.shift();$('usbLog').textContent=st.log.slice(-90).join('\n')};
 const hexWords=arr=>arr.map(x=>P.hx(x,2)).join(' ');
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const sameBoot=(a,b)=>!!a&&!!b&&LOCKED.every(k=>a[k]===b[k]);
 function renderSensorReconnect(){
  const banner=$('sensorReconnectBanner'),button=$('sensorReconnectButton'),message=$('sensorReconnectMessage');
  if(!banner||!button||!message)return;
  const visible=!demoEnabled&&!!st.port&&!st.chip&&!st.readOnlySensor&&!st.closing;
  banner.hidden=!visible;
  if(!visible)return;
  const working=st.reinitRunning||st.powerCycleRunning||st.magicRunning||st.startupRunning||st.diagRunning;
  const adapter=st.adapterKind==='bridge'?'ESP32':'SSP3';
  message.textContent=working?'Verbindung wird geprüft und initialisiert …':
   st.adapterNoReply?`Der ${adapter} antwortet nicht auf USB-Befehle. USB-Port neu öffnen und prüfen, ob ein anderes Programm den Port verwendet.`:
   st.adapterKind==='bridge'&&st.bridgeRxNote?st.bridgeRxNote:
   st.sensorLost?`Kommunikation zum Sensor fehlgeschlagen. Der ${adapter} antwortet weiterhin über USB.`:
   st.plcAddressProbes.length&&st.iface==='plc'
     ? 'Keine bestätigte Chipantwort. Adressen 0x6C und 0x7C wurden geprüft. Details mit «Diagnose exportieren» sichern.'
     : 'Keine gültige Sensorantwort. Sensoranschluss prüfen und erneut initialisieren.';
  button.disabled=working||st.writing||st.nvmWorking||st.calTask||st.afeWriteActive;
  button.textContent=working?'Initialisierung läuft …':
   st.adapterNoReply?'USB-Port neu öffnen':'Sensor neu initialisieren';
 }
 const runningOperations=[];
 function renderOperationProgress(){
  const blocking=runningOperations.filter(item=>item.blocking).at(-1);
  const operation=blocking||runningOperations.at(-1);
  const panel=$('operationProgress'),bar=$('operationProgressBar');
  const dialog=$('operationProgressDialog');
  const dock=$('operationProgressDock');
  if(blocking&&!dialog.open){
   dialog.append(panel);
   panel.hidden=false;
   dialog.showModal();
  }else if(!blocking&&dialog.open){
   dialog.close();
   dock.append(panel);
  }
  panel.hidden=!operation;
  if(!operation)return;
  const {label,done,total}=operation;
  $('operationProgressText').textContent=total?label+' · '+done+' / '+total:label+' …';
  if(total){bar.max=total;bar.value=done;}
  else bar.removeAttribute('value');
 }
 function beginOperation(label,blocking=false){
  const operation={label,blocking};
  runningOperations.push(operation);
  renderOperationProgress();
  return {
   update(label,done,total){Object.assign(operation,{label,done,total});renderOperationProgress()},
   finish(){runningOperations.splice(runningOperations.indexOf(operation),1);renderOperationProgress()}
  };
 }
 async function withProgress(label,action,blocking=false){
  const operation=beginOperation(label,blocking);
  try{return await action(operation)}finally{operation.finish()}
 }
 function renderStatus(){let connected=!!st.port;
  const addrRow=$('plcAddressRow');
  if(addrRow)addrRow.hidden=st.iface!=='plc'||!$('expertMode').checked;
  if($('plcAddressLabel'))$('plcAddressLabel').textContent=(st.chip||st.readOnlySensor)&&st.plcAddressVerified?
   '0x'+h(st.plcAddress)+' (Sensorregister bestätigt)':
   connected?'Suche: 0x6C / 0x7C':'—';$('status').textContent=demoEnabled?'Demo · Simulation':st.chip?'Sensor verbunden':st.readOnlySensor?'Sensor verbunden · Diagnose':st.reinitRunning||st.powerCycleRunning?'Sensor wird initialisiert':connected?(st.adapterNoReply?'SSP3 antwortet nicht':st.sensorLost?'Sensor nicht verbunden':'USB verbunden · Sensor nicht erkannt'):'Nicht verbunden';$('statusDot').className='dot'+(st.chip||st.readOnlySensor?' active':connected?' missing':'');$('fw').textContent=st.firmware?st.firmware.slice(0,19):'—';$('chip').textContent=st.readOnlySensor|| (st.chip?'Antwort erhalten':'—');$('ifaceLabel').textContent=st.iface==='plc'?'1-Wire':st.iface==='i2c'?'I²C':'SPI';$('srcLabel').textContent=st.adc?.source==='usb'?'USB / Chip':'Keine Messdaten';$('choose').disabled=connected||demoEnabled;$('auto').hidden=demoEnabled;$('disconnect').hidden=demoEnabled;$('adapterType').disabled=demoEnabled;$('iface').disabled=demoEnabled;$('guidedLaunch').disabled=!st.chip||st.closing;$('guidedLaunch').classList.toggle('primary',st.chip&&!st.closing);$('auto').disabled=connected;$('disconnect').disabled=!connected||st.closing;$('readNow').disabled=!st.chip||st.magicRunning||st.powerCycleRunning;$('live').disabled=!connected||st.magicRunning||st.powerCycleRunning;$('live').textContent=st.live?'Live-Messung stoppen':'Live-Messung starten';$('readBoot').disabled=!st.chip;$('readRegs').disabled=!st.chip&&!st.readOnlySensor;$('afeWord').textContent=st.afe===null?'CFG_AFE1: —':'CFG_AFE1: 0x'+h(st.afe,2);const startupTools=$('plcStartupTools');if(startupTools)startupTools.hidden=demoEnabled||st.adapterKind!=='ssp3'||st.iface!=='plc'||!$('expertMode').checked;
 if($('chipDiagDetails'))$('chipDiagDetails').hidden=!$('expertMode').checked;
 if($('usbAdvancedDetails'))$('usbAdvancedDetails').hidden=!$('expertMode').checked;
 if($('wiringStartDetails'))$('wiringStartDetails').hidden=!$('expertMode').checked;
 if($('plcStartupProbe'))$('plcStartupProbe').disabled=!connected||st.chip||st.startupRunning||st.magicRunning||st.powerCycleRunning||st.closing||st.writing||st.nvmWorking||st.calTask;
 if($('plcStartupStop'))$('plcStartupStop').disabled=!st.startupRunning;
  if($('plcMagicRun'))$('plcMagicRun').disabled=!connected||st.chip||st.magicRunning||st.startupRunning||st.powerCycleRunning||st.diagRunning||st.closing||st.writing||st.nvmWorking||st.calTask||!$('plcMagicConfirm').checked;
 if($('plcHostFormat'))$('plcHostFormat').disabled=st.chip||st.powerCycleRunning||st.startupRunning||st.magicRunning||st.nvmWorking||st.writing||st.calTask;
 if($('plcPowerHelpRead'))$('plcPowerHelpRead').disabled=!connected||st.adapterKind!=='ssp3'||st.closing||st.powerCycleRunning||st.magicRunning||st.startupRunning||st.diagRunning||st.writing||st.nvmWorking||st.calTask;
 if($('plcPowerRun'))$('plcPowerRun').disabled=!connected||st.chip||st.powerCycleRunning||st.startupRunning||st.magicRunning||st.diagRunning||st.closing||st.writing||st.nvmWorking||st.calTask||!$('plcPowerConfirm').checked;
 const ramStart=$('startRamMeasurement');
 if(ramStart){
  ramStart.hidden=!st.readOnlySensor;
  ramStart.disabled=st.ramMeasurementStarting||st.closing;
 }
 renderSensorReconnect();renderAFEStepperState();renderBridgeSupplyState();renderFlowState();renderDSPLive()};

 // SVDD is the internally regulated sensor bridge supply, NOT the SSP3 DUT VDD
 // and NOT the ratiometric AODO output voltage. DS 25DS0170E.04, CFG_AFE0
 // (0x1A) bits 1:0: 00=2.4 V, 01=1.6 V, 10=2.0 V; 11 is reserved.
 const BRIDGE_SUPPLY_ORDER=[1,2,0]; // 1.6 V, 2.0 V, 2.4 V
 function bridgeSupplyCode(word){return Number.isInteger(word)?word&CAL.SVDD_MASK:null}
 function renderBridgeSupplyState(){
  const read=$('brSupplyRead'),status=$('brSupplyStatus');
  const active=!!st.port&&st.chip&&!st.closing&&st.mode==='usb';
  const busy=st.calTask||st.writing||st.nvmWorking||st.afeWriteActive||
   st.powerCycleRunning||st.reinitRunning||st.bridgeReadBusy;
  const code=bridgeSupplyCode(st.afe0);
  const index=BRIDGE_SUPPLY_ORDER.indexOf(code);
  const valid=index>=0;
  read.disabled=!active||busy;
  $('brSupplyValue').textContent=active&&valid?BRIDGE_VOLTAGES[code].toFixed(1).replace('.',',')+' V':'—';
  $('brSupplyDown').disabled=!active||busy||index<=0;
  $('brSupplyUp').disabled=!active||busy||!valid||index===BRIDGE_SUPPLY_ORDER.length-1;
  $('brSupplyActions').hidden=!active||valid;
  status.textContent=st.afe0==null?'Brückenspannung erneut aus dem Sensor lesen.':
   'Die gelesene Spannungsstufe ist reserviert.';
 }
 async function loadBridgeSupply(){
  return withProgress('Brückenspannung wird gelesen',()=>loadBridgeSupplyOperation());
 }
 async function loadBridgeSupplyOperation(){
  const word=await readReg(R_BRIDGE,1800);
  // CFG_AFE0 bits 11:10 must both be 1 (data sheet reserved bits).
  if((word&0x0C00)!==0x0C00)
   throw Error('CFG_AFE0=0x'+h(word,2)+': reservierte Pflichtbits 11:10 sind nicht 11');
  st.afe0=word;
  const code=bridgeSupplyCode(word);
  logging('Brückenversorgung aus CFG_AFE0: '+(code<3?BRIDGE_VOLTAGES[code]+' V':'reservierter Code')+
   ' (RAM 0x'+h(word,2)+').');
  renderBridgeSupplyState();
  return word;
 }
 async function refreshBridgeSupply(){
  if(!st.chip||!st.port||st.bridgeReadBusy||st.writing||st.calTask||st.nvmWorking||st.powerCycleRunning)return;
  st.bridgeReadBusy=true;renderBridgeSupplyState();
  try{
   if(st.liveReadPromise)await st.liveReadPromise.catch(()=>{});
   await loadBridgeSupply();
  }catch(e){
   st.afe0=null;
   logging('Brückenspannung lesen fehlgeschlagen: '+String(e.message||e));
   show('writeMsg','Brückenspannung konnte nicht gelesen werden: '+e.message,'warn');
  }finally{st.bridgeReadBusy=false;renderBridgeSupplyState()}
 }
 async function commitBridgeSupply(targetCode){
  return withProgress('Brückenspannung wird geschrieben',()=>commitBridgeSupplyOperation(targetCode));
 }
 async function commitBridgeSupplyOperation(targetCode){
  if(!Number.isInteger(targetCode)||targetCode<0||targetCode>2)
   throw Error('Ungültige Brückenspannung – Code 3 ist reserviert.');
  if(!st.port||!st.chip||st.mode!=='usb'||st.writing||st.nvmWorking||st.calTask||
     st.powerCycleRunning||st.afeWriteActive||st.bridgeReadBusy||st.reinitRunning){
   show('writeMsg','Brückenspannung kann nur bei bestätigter, freier Chipverbindung geändert werden.','warn');
   return false;
  }
  const resumeLive=st.live&&!st.manualLivePause;
  let wrote=false;
  st.writing=true;st.afeWriteActive=true;st.bridgeWriteAllowed=true;
  stopLive();renderStatus();
  show('writeMsg','Brückenspannung wird nur in CFG_AFE0 im RAM geändert und rückgelesen …','warn');
  try{
   if(st.liveReadPromise)await st.liveReadPromise.catch(()=>{});
   const beforeBoot=await bootSnapshot();
   if(st.boot&&!sameBoot(st.boot,beforeBoot))throw Error('Bootregister seit der letzten Prüfung verändert.');
   const before=await readReg(R_BRIDGE);
   if((before&0x0C00)!==0x0C00)throw Error('CFG_AFE0: reservierte Pflichtbits 11:10 sind nicht 11.');
   if(st.afe0!==before)throw Error('CFG_AFE0 hat sich seit der letzten Anzeige verändert. Bitte Wert erneut lesen.');
   const next=(before&0xFFFC)|targetCode; // preserve br_gain, bridge checks and all other bits
   if(st.iface!=='plc'&&(beforeBoot[6]&0x8000))
    throw Error('CRC-geschützte I²C/SPI-Verbindung: RAM-Schreiben gesperrt.');
   if(next!==before){
    await unlockRAM();
    wrote=true;
    await lowLevelWrite(R_BRIDGE,next);
    const actual=await readReg(R_BRIDGE);
    if(actual!==next)throw Error('CFG_AFE0-Rücklesefehler: Soll 0x'+h(next,2)+
     ', gelesen 0x'+h(actual,2));
    if(!sameBoot(beforeBoot,await bootSnapshot()))
     throw Error('Boot-/Kommunikationsregister nach Brückenspannungsänderung verändert.');
    st.afe0=actual;
    await window.ELMOS_ARCHIVE?.event('bridge_ram_changed',{before,after:actual,supply:archiveVoltages()});
    erasePoints();
   }
   await loadBridgeSupply();
   show('writeMsg','Brückenspannung '+BRIDGE_VOLTAGES[targetCode].toFixed(1)+
    ' V im Sensor-RAM bestätigt. Andere CFG_AFE0-Bits und EEPROM unverändert. '+
    (wrote?'Bisherige Kalibrierpunkte wurden zurückgesetzt.':'Wert war bereits aktiv.'),'success');
   logging('Brückenspannung im RAM bestätigt: '+BRIDGE_VOLTAGES[targetCode].toFixed(1)+' V; kein NVM-Schreiben.');
   return true;
  }catch(e){
   logging('Brückenspannung-RAM-Schreibfehler: '+e.message);
   if(wrote)erasePoints();
   st.afe0=null;
   try{await loadBridgeSupply()}catch(_){/* Leave the voltage unknown until a valid read. */}
   show('writeMsg','Brückenspannung nicht bestätigt: '+e.message+
    (wrote?' Messpunkte vorsorglich zurückgesetzt.':' RAM wurde nicht verändert.'),'error');
   return false;
  }finally{
   st.bridgeWriteAllowed=false;st.afeWriteActive=false;st.writing=false;
   renderStatus();
   if(resumeLive&&st.port&&st.chip)startLive();
  }
 }
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
  const staleLive=connected&&st.live&&(!st.adc||Date.now()-st.adc.time>5000);
  const plcNotLatched=connected&&st.iface==='plc'&&st.powerCycleResult?.plcEnabledInRam===false;
  const periodMode=P.periodMode(st.measurementPeriod);
  const mode=!connected?(st.port?(st.reinitRunning?'Sensor wird initialisiert':'Sensor nicht verbunden'):'Offline'):ongoing?'Chipvorgang läuft':st.live?
   plcNotLatched?'One Wire im RAM nicht dauerhaft aktiv':
   periodMode==='disabled'?'Messzyklus deaktiviert (CFG_PERIOD=0)':
   staleLive?'Live · keine neue ADC-Antwort':
   periodMode==='single'?'Live · Einzelmessungen per CMD start':'Live':
   st.dspError?'DSP-Lesefehler':st.manualLivePause?'Manuell pausiert':'Live nicht gestartet';
  $('liveState').textContent=mode;
  $('liveState').title='Live ADC_S: '+st.liveReadSuccesses+'/'+st.liveReadAttempts+
   ' erfolgreiche Abfragen'+(st.liveLastError?' · Letzter Fehler: '+st.liveLastError:'')+
   (plcNotLatched?' · CFG_SPI_I2C.plc_en im RAM ist 0':'');
  if($('liveDiagnostic'))$('liveDiagnostic').textContent=connected?
   'ADC '+st.liveReadSuccesses+'/'+st.liveReadAttempts+
   ' · CFG_PERIOD '+(st.measurementPeriod==null?'?':'0x'+P.hx(st.measurementPeriod,2))+
   (st.powerCycleResult?.livePeriodAdjustedInRam?' (RAM-Live-Modus)':'')+
   (periodMode==='single'?' (Einzelmessung)':'')+
   (periodMode==='disabled'?' (deaktiviert)':'')+
   (st.measurementStatus!=null?' · STATUS '+(st.measurementStatus&1?'idle':'run'):'')+
   '':'';
  
  $('liveStateDot').className='live-meta-dot'+(ongoing?' is-working':st.live&&!staleLive?' is-live':'');
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
  box.closest('.cal-point-row')?.classList.toggle('cal-point-recorded',!!record);
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
  const operation=beginOperation(label+' wird aufgenommen',true);
  const progress=$('calSampleProgress');
  progress.hidden=false;progress.textContent=label+': Messung wird vorbereitet …';
  renderFlowState();
  try{
   if(st.liveReadPromise)await st.liveReadPromise.catch(()=>{});
   const values=[];
   for(let i=0;i<required;i++){
    const value={at:new Date().toISOString(),s:null,t:null,tc:null};
    try{
     value.s=P.sign16(await readReg(0x2A));
     value.t=P.sign16(await readReg(0x28));
     value.tc=P.sign16(await readReg(0x26));
    }catch(e){values.push(value);e.rawSamples=values.slice();throw e}
    values.push(value);
    operation.update(label+' wird aufgenommen',i+1,required);
    progress.textContent=label+': '+(i+1)+' / '+required+' Samples aufgenommen';
    if(i<required-1)await sleep(60)
   }
   const ordered=k=>values.map(x=>x[k]).sort((a,b)=>a-b);
   const median=x=>required%2?x[Math.floor(required/2)]:(x[required/2-1]+x[required/2])/2;
   const pressure=ordered('s'),temperature=ordered('t'),compensated=ordered('tc');
   const spread=pressure[required-1]-pressure[0];
   if(required>1&&spread>350){
    const e=Error('ADC_S streut zu stark ('+spread+' Digits). Druck stabilisieren und erneut messen');
    e.rawSamples=values.slice();e.spread=spread;throw e;
   }
   return {adc_s:median(pressure),adc_t:median(temperature),adc_tc:median(compensated),spread,sampleCount:required,rawSamples:values}
  }finally{
   operation.finish();progress.hidden=true;st.calTask=false;
   if(resumeLive&&st.chip)startLive();
   else renderStatus()
  }
 }
 function renderCalibrationPlan(){
  const count=calibrationPointCount();
  if(!Number.isFinite(count))return show('calPointPlanMsg','Anzahl muss zwischen 2 und 10 liegen.','error');
  $('pointHiHeading').textContent='Messpunkt '+count+' · Oberer Endpunkt';
  if(!$('pointHiName').dataset.userEdited)$('pointHiName').value='Messpunkt '+count;
  $('capLo').hidden=st.calpoints.some(x=>x.kind==='lo');
  $('capHi').hidden=st.calpoints.some(x=>x.kind==='hi');
  renderCapturedPoint('lowVal','calLoResult',st.calpoints.find(x=>x.kind==='lo'));
  renderCapturedPoint('highVal','calHiResult',st.calpoints.find(x=>x.kind==='hi'));
  for(let k=1;k<=8;k++){
   $('calExtra'+k+'Row').hidden=k>count-2;
   $('calExtra'+k+'Heading').textContent='Messpunkt '+(k+1)+' · Zwischenpunkt';
   $('calExtra'+k+'Capture').textContent='Messpunkt '+(k+1)+' aufnehmen';
   if(!$('calExtra'+k+'Name').dataset.userEdited)$('calExtra'+k+'Name').value='Messpunkt '+(k+1);
   const record=st.calpoints.find(x=>x.kind==='extra'&&x.slot===k);
   $('calExtra'+k+'Capture').hidden=!!record;
   renderCapturedPoint('calExtra'+k+'State','calExtra'+k+'Value',record);
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
 function verificationRows(){return Array.from($('calVerifyRows').children)}
 function renderVerificationRows(required){
  verificationRows().forEach((row,slot)=>{
   row.hidden=slot>=required||!Number.isFinite(required);
   const result=st.calValidation.find(point=>point.slot===slot);
   row.querySelector('.verify-point-status').textContent=result?
    'Bestätigt · Δ '+result.errorBar.toFixed(4)+' '+pressureUnit():'Offen';
   const busy=!!st.calTask||!!st.writing||!!st.nvmWorking;
   row.querySelectorAll('button,input').forEach(control=>{control.disabled=busy});
  });
 }
 function updateVerificationProgress(){
  const required=verificationRequiredCount(),done=st.calValidation.length;
  renderVerificationRows(required);
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
  if(n===8)return ''; // Test / Logging is independent of calibration, even without chip connection.
  if(n===7)return ''; // EEPROM Viewer unabhängig vom Kalibrierablauf: nur lesen.
  if(n===5)return ''; // Eigener Ausgangsschritt ist auch bei bestehenden Sensoren erreichbar.
  if(n===6&&(expert.restoreReady()||expert.outputReady()))return '';
  if(n>=3&&!calEndpointsReady())return 'Zuerst alle '+calibrationPointCount()+' gewählten Kalibrierpunkte bei gleicher AFE-Einstellung aufnehmen.';
  if(n>=4&&(!coefficientSettingsCurrent()||!st.calStaged))return 'Zuerst die Koeffizienten für den eingestellten DSP-Endwert berechnen und ins RAM übertragen.';
  if(n>=6&&!verificationComplete()&&!expert.restoreReady())return 'NVM bleibt gesperrt: Zuerst '+(Number.isFinite(verificationRequiredCount())?verificationRequiredCount()+' Prüfpunkte':'eine gültige Anzahl Prüfpunkte')+' über DSP_S im RAM erfolgreich verifizieren.';
  return ''
 }
 // The recovery changes a RAM address, so require a fresh cold-start proof
 // and keep every factory, boot and output word identical to the original NVM.
 function psscRecoveryProven(){
  return !!st.uid?.hex&&st.plcAddressVerified&&st.plcAddress===0x6C&&
   st.startupTrials.some(trial=>trial.stage==='PSSC-RAM-Start'&&
    trial.powerRestored&&trial.readVerified&&trial.verifiedUid===st.uid.hex);
 }
 function psscNvmBlock(initial,modified,restoring=false,outputOnly=false){
  const recovered=st.psscRamRecovery||(st.regs[0x06]===0x6C04&&initial?.[17]!==0x6C04);
  if(st.coldStartAfeRestored)return 'NVM-Schreiben nach AFE-Wiederanlauf gesperrt. Kalibrierung im RAM ist verfügbar.';
  if(!recovered)return '';
  if(st.adapterKind==='bridge')
   return 'Nach temporärer ESP32-RAM-Freigabe ist NVM-Schreiben gesperrt. Live-Messung, RAM-Kalibrierung und NVM-Lesen sind verfügbar.';
  if(!psscRecoveryProven())
   return 'Für die PSSC-RAM-Verbindung fehlt der bestätigte Neustart dieses Chips. Sensor neu initialisieren und erneut prüfen.';
  if(!initial||!modified)return '';
  const calibrationWords=new Set([CAL.SVDD_INDEX,28,30,31,32,33,34,...Array.from({length:16},(_,i)=>35+i),51,52,53,54,63]);
  if(restoring||outputOnly||modified.some((word,index)=>word!==initial[index]&&!calibrationWords.has(index)))
   return 'Nach PSSC-RAM-Freigabe lassen sich nur Kalibrierdaten speichern. Ausgangs- und Starteinstellungen müssen unverändert bleiben.';
  return '';
 }
 function hasCurrentNvmBackup(){
  const proof=st.nvmBackupProof;
  return !!(st.port&&st.chip&&st.uid?.hex&&proof?.session===st.sessionIndex&&
   proof.uid===st.uid.hex&&proof.words===st.nvmBackup&&st.nvmBackupVerified&&
   st.nvmBackup.length===64&&st.uid.ser0===st.nvmBackup[0]&&st.uid.ser1===st.nvmBackup[1]);
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
  $('nvmPrepare').textContent=hasCurrentNvmBackup()?'Änderungen prüfen':'NVM lesen & Änderungen prüfen';
  $('nvmUidHint').textContent=recognizedUid?'Chip-UID: '+recognizedUid:'Chip-UID wird beim Verbinden gelesen.';
  let nvmReason='';
  if(st.iface!=='plc')nvmReason='1-Wire-Startschutz: Dauerhaftes NVM-Schreiben ausschliesslich über 1-Wire möglich. Bitte per 1-Wire verbinden.';
  else if(!verified||st.mode!=='usb')nvmReason='Zuerst die DSP-Prüfung abschliessen und sicherstellen, dass der echte Chip verbunden ist.';
  else if(!st.nvmBackupVerified||!st.nvmBackup)nvmReason='Zuerst Original-NVM vollständig lesen und prüfen.';
  else if(!st.calImage)nvmReason='Zuerst die Änderungsliste vorbereiten. Anschliessend kann gespeichert werden.';
  else if(!recognizedUid||st.uid.ser0!==st.nvmBackup[0]||st.uid.ser1!==st.nvmBackup[1])nvmReason='Chip-UID wurde nicht vollständig mit dem NVM-Backup abgeglichen.';
  const outputStatus=$('outputOneWireStatus');
  const startup=st.nvmBackupVerified&&st.nvmBackup?.length===64?CAL.oneWireStartupStatus(st.nvmBackup):null;
  const cookieVerified=!!(st.powerCycleResult?.readVerified&&st.powerCycleResult.verifiedUid&&
   st.powerCycleResult.verifiedUid===st.uid?.hex&&st.iface==='plc'&&st.port&&st.chip)||psscRecoveryProven();
  if(outputStatus){
   const connected=st.mode==='usb'&&st.iface==='plc'&&st.chip;
   const saved=startup;
   const safeSaved=!!(saved?.ok&&(!saved.requiresCookie||cookieVerified));
   outputStatus.textContent=!connected?
    '1-Wire-Verbindung zum Chip nicht bestätigt. Dauerhaftes NVM-Schreiben gesperrt.':
    saved?
     safeSaved?'One-Wire-Startfenster '+saved.windowLabel+' bleibt im NVM erhalten (AODO-Modus '+saved.mode+'). '+
       (saved.requiresCookie?'Magic-Cookie-Start am aktuellen Chip bestätigt.':'Direkter Registerzugriff aktiv.')+
       ' Boot-/Interface-Register bleiben unverändert. Nach dem Schreiben Kaltstart prüfen.':
      saved.ok&&saved.requiresCookie?
       'One Wire ist bei jedem Einschalten '+saved.windowLabel+' aktiv. Danach ist für RAM-Zugriff die Magic Cookie erforderlich. NVM-Schreiben nur nach erfolgreichem SSP3-Starttest am aktuellen Chip freigegeben.':
       '1-Wire-Startschutz: '+saved.errors.join('; ')+'. NVM-Schreiben gesperrt.':
     '1-Wire aktuell verbunden. Für die Startschutz-Prüfung zuerst das Original-NVM vollständig auslesen. Das momentane Erreichen des Chips garantiert keinen Zugriff nach Neustart.';
   outputStatus.className='callout '+(connected&&safeSaved?'success':'warn');
   if(saved&&!safeSaved&&!nvmReason)nvmReason=saved.ok&&saved.requiresCookie?
    '1-Wire-Startschutz: Das '+saved.windowLabel+'-Startfenster bleibt erhalten; vor dem NVM-Schreiben Magic-Cookie-Zugriff über SSP3-Power-Start am aktuellen Chip nachweisen.':
    '1-Wire-Startschutz: '+saved.errors.join('; ')+'. NVM-Schreiben gesperrt.';
  }
  const eepromReadBtn=$('eepromRead');
  if(eepromReadBtn)eepromReadBtn.disabled=!st.port||!st.chip||st.calTask||st.writing||st.nvmWorking;
  const outputNvmRead=$('outputNvmRead');if(outputNvmRead)outputNvmRead.disabled=!st.port||!st.chip||st.writing||st.calTask||st.nvmWorking;
  if(!nvmReason)nvmReason=psscNvmBlock(st.calImage?.before,st.calImage?.after,restoring,outputOnly);
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
  const unlocked=[true,true,true,calEndpointsReady(),ready&&st.calStaged,true,!workflowGate(6),true,true];
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
  const next=Math.max(0,Math.min(8,Number(n)));
  if(next!==8&&window.ELMOS_TEST_LOGGER?.isBusy()){
   show('flowMsg','Die Testaufzeichnung läuft. Bitte im Reiter «Test / Logging» zuerst beenden.','warn');
   $('flowMsg').hidden=false;return;
  }
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
  renderFlowState();if(next===5)expert.refreshOutputPreview();if(next===7)expert.refreshEEPROMViewer();draw();
  if(!st.manualLivePause&&st.chip&&!window.ELMOS_TEST_LOGGER?.isBusy())startLive()
 }
 function invalidateCalculation(reason){
  st.calfit=null;st.calImage=null;st.calStaged=false;st.calVerified=false;st.calValidation=[];
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

 const rawLine=s=>{if(window.ELMOS_ARCHIVE?.active&&(st.calTask||st.writing||st.nvmWorking))window.ELMOS_ARCHIVE.trace(s);st.log.push(now()+'  '+s);if(st.log.length>500)st.log.shift();$('usbLog').textContent=st.log.slice(-90).join('\n')};
 async function readerLoop(port){try{let r=port.readable.getReader();st.readerAlive=true;st.reader=r;try{while(st.port===port&&!st.closing){const{value,done}=await r.read();if(done)break;if(!value)continue;let txt=new TextDecoder().decode(value);rawLine('RX '+txt.replace(/\r/g,'\\r').replace(/\n/g,'\\n'));if(st.responseWait){st.replyBuffer+=txt;const complete=P.ssp3PromptCount(st.replyBuffer)>=(st.responseWait.prompts||1);if(complete){const waiter=st.responseWait;st.responseWait=null;clearTimeout(waiter.timer);const out=st.replyBuffer;st.replyBuffer='';waiter.resolve(out)}else if(st.replyBuffer.length>16000){const waiter=st.responseWait;st.responseWait=null;clearTimeout(waiter.timer);waiter.reject(Error('SSP3-Antwort zu lang'))}}} }finally{r.releaseLock();if(st.reader===r)st.reader=null}}catch(e){
   if(st.port===port&&!st.closing)logging('USB-Lesefehler: '+e.message);
  }finally{
   if(st.port===port&&!st.closing){
    st.readerAlive=false;st.adapterNoReply=true;st.chip=false;stopLive();renderStatus();
    show('connMsg','USB-Lesekanal zum SSP3 ist beendet. Kein zuverlässiger Adapterzugriff mehr. «SSP3-Port neu öffnen» verwenden.','warn');
   }
  }}
 function serialize(fn){const run=st.cmdQueue.then(fn,fn);st.cmdQueue=run.catch(()=>{});return run}
 async function exchange(text,timeout=2500){return serialize(async()=>{if(!st.closing&&demoPort&&st.port===demoPort)return demoPort.exchange(text);if(st.closing||!st.port?.writable)throw Error('USB-Verbindung nicht geöffnet');if(st.responseWait)throw Error('Interner Befehlskonflikt');st.replyBuffer='';let resolver,rejecter;const future=new Promise((res,rej)=>{resolver=res;rejecter=rej});const ticket={resolve:resolver,reject:rejecter,timer:setTimeout(()=>{if(st.responseWait===ticket){st.responseWait=null;ticket.reject(Error((st.adapterKind==='bridge'?'ESP32':'SSP3')+' antwortet nicht auf '+text.slice(0,18))) }},timeout)};st.responseWait=ticket;future.catch(()=>{});const writer=st.port.writable.getWriter();try{logging('TX '+text);await writer.write(new TextEncoder().encode(text+'\r'))}catch(e){if(st.responseWait===ticket){st.responseWait=null;clearTimeout(ticket.timer);rejecter(e)}throw e}finally{writer.releaseLock()}const ans=await future;if(ans.split(/[\r\n]+/).some(l=>l.trim().startsWith('!')))throw Error((st.adapterKind==='bridge'?'ESP32':'SSP3')+' meldet Fehler: '+ans.slice(0,140));return ans})}

 // Two fast serial writes, not two commands in one write. The actual SSP3
 // firmware may accept only one CR-terminated command per UART/USB packet.
 // Do not WAIT for PWR_ON's firmware response before sending PLC T.
 // Command and chip timing is experimental; no claims about 4-ms guarantee.
 async function exchangeSsp3StartupBurst(mode='combined',pssc=false){
  if(!['combined','split'].includes(mode))throw Error('Unbekannter SSP3-Starttransport');
  const commands=[pssc?'PWR_ON FFFF 0 0':'PWR_ON 0C80 00C8 0','PLC T'];
  return serialize(async()=>{
   if(st.closing||!st.port?.writable||st.adapterKind!=='ssp3'||st.iface!=='plc')
    throw Error('SSP3 PLC-Start benötigt einen verbundenen SSP3 im One-Wire-Modus.');
   if(st.responseWait)throw Error('Interner SSP3-Befehlskonflikt');
   st.replyBuffer='';
   let resolver,rejecter;
   const future=new Promise((resolve,reject)=>{resolver=resolve;rejecter=reject});
   const ticket={resolve:resolver,reject:rejecter,prompts:2,timer:null};
   ticket.timer=setTimeout(()=>{
    if(st.responseWait===ticket){
     const partial=st.replyBuffer.slice(0,1300);
     const received=P.ssp3PromptCount(partial);
     st.responseWait=null;
     if(st.powerCycleResult){
      st.powerCycleResult.burstPartialReply=partial;
      st.powerCycleResult.burstPromptCount=received;
     }
     rejecter(Error('SSP3 bestätigte '+received+'/2 Startbefehle. Teilantwort: '+(partial||'(keine)')));
    }
   },6000);
   st.responseWait=ticket;
   future.catch(()=>{});
   const writer=st.port.writable.getWriter();
   let secondQueued=false;
   const firstAt=Date.now();
   try{
    if(mode==='combined'){
     // Both CR-terminated SSP3 commands in ONE USB write. Reduces the risk
     // that a 4-ms E703.11 startup window is missed by a second USB packet.
     // The SSP3 parser still executes PWR_ON before PLC T.
     const payload=commands.join('\r')+'\r';
     logging('TX COMBINED USB: PWR_ON 0C80 00C8 0\\rPLC T\\r');
     secondQueued=true;
     await writer.write(new TextEncoder().encode(payload));
    }else{
     logging('TX PWR_ON 0C80 00C8 0 (getrennte USB-Ausgabe)');
     await writer.write(new TextEncoder().encode(commands[0]+'\r'));
     secondQueued=true;
     logging('TX PLC T (sofortige zweite USB-Ausgabe, ohne Antwort abzuwarten)');
     await writer.write(new TextEncoder().encode(commands[1]+'\r'));
    }
    const sendDuration=Date.now()-firstAt;
    if(st.powerCycleResult){
     st.powerCycleResult.burstSendDurationMs=sendDuration;
     st.powerCycleResult.usbWriteMode=mode;
    }
    logging('SSP3 PWR_ON/PLC T: '+(mode==='combined'?'ein gemeinsamer':'zwei getrennte')+
     ' USB-Schreibvorgang/-vorgänge in '+sendDuration+' ms; warte auf 2 SSP3-Antworten.');
   }catch(e){
    if(st.powerCycleResult){
     st.powerCycleResult.burstWriteError=String(e.message||e);
     st.powerCycleResult.burstSecondQueued=secondQueued;
     st.powerCycleResult.burstPartialReply=st.replyBuffer.slice(0,1300);
    }
    if(st.responseWait===ticket){
     st.responseWait=null;clearTimeout(ticket.timer);rejecter(e);
    }
    throw e;
   }finally{writer.releaseLock()}
   const response=await future;
   if(P.ssp3PromptCount(response)<2)
    throw Error('SSP3-Start: beide Firmwareantworten fehlen.');
   const lines=response.split(/[\r\n]+/).map(line=>line.trim());
   if(lines.some(line=>line.startsWith('!')))
    throw Error('SSP3-Start meldet Fehler: '+response.slice(0,300));
   const acks=P.ssp3StartupAcks(response);
   if(!acks.power||!acks.plc)
    throw Error('SSP3-Start: Bestätigung für PWR_ON und PLC T fehlt. RX: '+response.slice(0,300));
   return response;
  });
 }
 async function firmware(){
  let reply;
  try{
   try{
    reply=await exchange('.VERSION',1600);
   }catch(error){
    if(st.adapterKind!=='ssp3'||!/Unknown command/i.test(error.message)||st.closing)throw error;
    logging('SSP3-Eingabepuffer verwirft den ersten Versionsbefehl. Wiederhole .VERSION einmal.');
    reply=await exchange('.VERSION',1600);
   }
   st.adapterNoReply=false;
  }catch(error){
   st.adapterNoReply=true;st.chip=false;stopLive();
   logging('SSP3-Handshake fehlgeschlagen: '+String(error.message||error));
   renderStatus();
   show('connMsg','SSP3 antwortet nicht auf .VERSION. Das ist ein USB-/Programmieradapterproblem, noch kein Nachweis für einen Sensorfehler. «SSP3-Port neu öffnen» wählen oder andere Programme am COM-Port schliessen.','warn');
   throw error;
  }
  // SSP3 firmware replies as @02 08 02 04; retain the actual firmware version.
  const match=reply.match(/(?:^|[\r\n])\s*@([0-9A-F]{2})\s+([0-9A-F]{2})\s+([0-9A-F]{2})\s+([0-9A-F]{2})(?=[\s\r\n:]|$)/i);
  st.firmware=match?match.slice(1,5).join('.'):'Antwort erhalten';
  if(match&&st.adapterKind==='ssp3'&&!demoEnabled)lsSet('ssp3-confirmed-baud',$('baud').value);
  if(st.adapterKind==='ssp3'&&st.iface==='plc'&&match&&match.slice(1,5).join(' ').toUpperCase()==='02 08 02 04'){
   // Actual SSP3 RX proves that the separated ASCII form
   // "PLC 02 6D1C0C." is INVALID ("frame contains invalid data ( )").
   // Use the verified single-argument command, despite the ambiguous '?' help.
   st.plcHostFormat='legacy';
   $('plcHostFormat').value='legacy';
   logging('SSP3 '+st.firmware+': PLC-Telegramm ohne Leerzeichen im Datenframe (PLC 026D1C0C.) aktiviert; getrennte Form ist ungueltig.');
  }else if(st.adapterKind==='ssp3'&&st.iface==='plc'){
   logging('SSP3 Firmware '+st.firmware+': Hostformat '+st.plcHostFormat+'. Für unbekannte Firmware keine automatische Umstellung.');
  }
  renderStatus();
 }
 const ifcfg={plc:'IF_CFG 7 0 0',i2c:'IF_CFG 2 1 0',spi:'IF_CFG 1 1 0'};
 async function selectChipInterface(){
  await exchange(ifcfg[st.iface]);
  if(st.adapterKind==='ssp3'&&st.iface==='plc'&&st.firmware==='02.08.02.04'){
   // Match ssp3_plc_init in the Elmos PSSC 3.2.1 library. These commands
   // clear the SSP3 transmit buffer and configure the SSP3 transceiver.
   await exchange('PLC R');
   await exchange('PLC_CFG 020A 0');
   await exchange('PLC_CFG 1 0007');
  }
  logging('Programmieradapter-Schnittstellenmodus '+st.iface+' gesetzt (nicht NVM).');
 }
 async function bridgeHello(){
  const response=await exchange('BRIDGE_INFO',1600);
  const match=response.match(/E70311-BRIDGE\s+V1\s+CAPS=([A-Z0-9_,]+)/);
  if(!match)throw Error('Kein kompatibler E703.11 USB-CDC-Bridge-Handshake. Bitte Bridge-Firmware prüfen.');
  const caps=match[1].split(',');
  st.bridgePsscRam=caps.includes('PSSC_RAM');
  st.bridgeRxDiag=caps.includes('PLC_RX_DIAG');
  st.bridgeGpio4Io=caps.includes('PLC_GPIO4_IO');
  $('plcGpio4Mode').disabled=!st.bridgeGpio4Io;
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


 async function bridgeAccess({power=false,recover=false}={}){
  const response=await exchange(recover?'PLC RECOVER'+(power?' START':''):power?'PLC START':'PLC ACCESS',3500);
  if(!st.bridgePsscRam)return;
  const status=response.match(/PLC ACCESS ADDR=(6C|7C) RAM_RECOVERY=([01])/);
  if(!status)throw Error('ESP32 hat die One-Wire-Adresse nicht bestätigt');
  st.plcAddress=parseInt(status[1],16);
  if(status[2]==='1')st.psscRamRecovery=true;
 }
 async function noteBridgeRx(){
  if(!st.bridgeRxDiag||!st.port||st.closing)return;
  try{
   const reply=await exchange('PLC RX DIAG');
   for(const row of reply.split(/\r?\n/).filter(l=>l.includes('# RX ')))logging(row);
   const readings=[...reply.matchAll(/ECHO=(BOTH|LOW|HIGH) EDGES=(\d+)/g)];
   if(readings.length!==2)return;
   if(st.bridgeSinglePin&&readings.every(m=>Number(m[2])===0))
    st.bridgeRxNote='ESP32 per USB erreichbar. Nach dem Senden auf GPIO4 wurde keine Sensorantwort erkannt.';
   else if(readings.every(m=>m[1]!=='BOTH'&&Number(m[2])===0))
    st.bridgeRxNote='ESP32 per USB erreichbar. GPIO6 sieht weder das eigene Sendesignal noch eine Sensorantwort. AODO-Treiber und RX-Anschluss prüfen.';
   else if(readings.every(m=>Number(m[2])===0))
    st.bridgeRxNote='ESP32 empfängt sein eigenes Sendesignal, aber keine Sensorantwort auf AODO. Startfenster und Sensorversorgung prüfen.';
   else st.bridgeRxNote='ESP32 erkennt Signalwechsel am AODO-Empfänger, aber keine bestätigte Chipantwort. Details im USB-Protokoll.';
  }catch(e){logging('ESP32 RX-Diagnose: '+e.message)}
 }
 async function connectBridgeChip(){
  st.bridgeRxNote='';
  st.bridgeSinglePin=$('plcGpio4Mode').checked;
  if(st.bridgeSinglePin&&!st.bridgeGpio4Io)throw Error('GPIO4 Senden/Empfangen benötigt ESP32-Firmware ab v0.6');
  if(st.bridgeGpio4Io)await exchange(st.bridgeSinglePin?'PLC IO GPIO4':'PLC IO SPLIT');
  await exchange('PLC_BAUD '+$('plcBaud').value);
  try{await bridgeAccess({power:st.sensorPowerEnabled})}
  catch(e){
   if(!st.bridgePsscRam||!e.message.includes('PLC_NO_VALID_FRAME')||st.closing||!st.port)throw e;
   st.psscRamRecovery=true;
   logging('ESP32: normale PLC-Adressen ohne Antwort; PSSC-Freigabe im Sensor-RAM.');
   try{await bridgeAccess({power:st.sensorPowerEnabled,recover:true})}
   catch(recoveryError){
    if(recoveryError.message.includes('PLC_NO_VALID_FRAME'))await noteBridgeRx();
    throw recoveryError;
   }
  }
  if(st.bridgePsscRam){
   // The bridge has already verified address and CRC on AFE, ADC and CFG.
   st.plcAddressVerified=true;st.plcAddressSource='ESP32: CFG_SPI_I2C + CFG_PADS1 / CRC8';
   try{st.measurementPeriod=await readReg(0x0E,1600)}
   catch(e){logging('ESP32: CFG_PERIOD nicht lesbar: '+e.message)}
  }
  await detect();
  if(st.psscRamRecovery)show('connMsg','Sensor über temporäre One-Wire-Freigabe verbunden. Live-Messung und RAM-Kalibrierung sind bereit; NVM bleibt schreibgeschützt.','success');
 }

 // CRC8 verification follows DS 25DS0170E.04, chapter 6.4.5.6.1:
 // CRC8 over read address, header/CRC4, slave preamble 0x02 and data.
 // Confirmed against the datasheet 0x6A/0x1234 => 0x65 example and
 // Jürg's 0x1C/0x0000 => 0x35 frame. CRC valid != plausible register.
 const afeBits=w=>({
  bit11:(w>>>11)&1,binary:w.toString(2).padStart(16,'0'),pga1:w&3,
  offset:(w>>>2)&31,pga2:(w>>>7)&15,reservedHigh:(w>>>12)&15
 });
 async function readReg(addr,timeoutMs=2500){
  if(!st.port)throw Error('SSP3-Port nicht verbunden');
  if(!Number.isInteger(addr)||addr<0||addr>0xFE||addr%2)throw Error('Ungültige Registeradresse');
  let result;
  if(st.iface==='plc'){
   const command=P.plcHostCommand(P.plcRead(addr,1,st.plcAddress),st.plcHostFormat),reply=await exchange(command,timeoutMs);
   const frame={at:new Date().toISOString(),address:addr,command,rawReply:reply.slice(0,1000),status:'parsing'};
   st.lastPlcReply=frame;
   try{
    const bytes=P.readData(reply,3);
    result=(bytes[0]<<8)|bytes[1];
    const readHeader=P.crc4([st.plcAddress|1,addr,0],20);
    const crc8Expected=P.crc8PLC([addr,readHeader,0x02,bytes[0],bytes[1]]);
    const crc8Valid=bytes[2]===crc8Expected;
    Object.assign(frame,{status:'parsed',word:result,bytes:bytes.slice(),
      crc8Rx:bytes[2],crc8Expected,crc8IndependentCheck:crc8Valid?'valid':'invalid'});
    if(addr===R_AFE||st.diagRunning)
     logging('1-Wire 0x'+h(addr)+': Daten '+bytes.map(v=>h(v)).join(' ') +
      ', Wort=0x'+h(result,2)+', CRC8 '+(crc8Valid?'OK':'FEHLER')+
      ' (erwartet 0x'+h(crc8Expected)+')');
    if(!crc8Valid)throw Error('CRC8-Prüfung fehlgeschlagen bei Register 0x'+h(addr)+
      ': empfangen 0x'+h(bytes[2])+', erwartet 0x'+h(crc8Expected));
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
  if(w===0){
   // SSP3 may return a parsed 00 00 35 despite no usable E703.11 access.
   // Treat exactly this AFE readback as missing chip access, NOT a valid AFE.
   const missing=Error('CFG_AFE1 antwortet mit 0x0000; Pflichtbit 11 fehlt. Keine Schreibfreigabe.');
   missing.code='AFE_ZERO_READBACK';
   throw missing;
  }
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
   'CRC8: wird anhand der dokumentierten 1-Wire-Leseantwort unabhängig geprüft; gültige CRC8 allein garantiert keine plausible Chipkonfiguration.',
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
   if(frame?.crc8IndependentCheck)lines.push('  CRC8: '+frame.crc8IndependentCheck+' · erwartet 0x'+h(frame.crc8Expected??0));
   if(frame?.rawReply)lines.push('  Rohantwort: '+frame.rawReply.replace(/[\r\n]+/g,' / ').slice(0,240))
  }
  const reads=d.probes.filter(p=>p.addr===R_AFE&&!p.error).map(p=>p.value);
  const distinct=[...new Set(reads)];
  lines.push('');
  if(!reads.length)lines.push('ERGEBNIS: CFG_AFE1 konnte nicht gelesen werden.');
  else if(distinct.length!==1)lines.push('ERGEBNIS: CFG_AFE1 wechselt zwischen Leseversuchen. Kommunikationsproblem möglich.');
  else if(!(distinct[0]&0x0800))lines.push('ERGEBNIS: CFG_AFE1 wiederholt mit Bit11=0 gelesen. Keine Schreibfreigabe; mit Elmos-PSSC vergleichen.');
  else lines.push('ERGEBNIS: CFG_AFE1 '+reads.length+'× gleich mit Bit11=1 gelesen.');
  lines.push('Gültige CRC8 bestätigt nur die Datenintegrität des Frames. Die Register-Plausibilität muss separat geprüft werden.');
  return lines.join('\n')
 }
 async function runChipDiagnostics(reason='Manuelle Diagnose'){
  return withProgress('Chipdiagnose läuft',()=>runChipDiagnosticsOperation(reason));
 }
 async function runChipDiagnosticsOperation(reason){
  if(!st.port||st.closing)throw Error('Zuerst den SSP3-USB-Port verbinden');
  if(st.diagRunning||st.startupRunning||st.magicRunning||st.powerCycleRunning||st.writing||st.nvmWorking||st.calTask||st.afeWriteActive)
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
 // A cold-started chip can answer PLC while its AFE working register is zero.
 // Recover from this chip's own verified EEPROM, never from a template.
 async function restoreColdStartAfe(port){
  const assertConnection=()=>{
   if(st.port!==port||st.closing||st.plcAddress!==0x6C)
    throw Error('USB-Verbindung während AFE-Wiederanlauf beendet');
  };
  const send=async(addr,word)=>{
   assertConnection();
   return exchange(P.plcWrite(addr,word,st.plcAddress));
  };
  if(await readReg(R_AFE)!==0)return false;
  if(await readReg(0x06)!==0x6C04||P.plcAddressFromConfig(0x6C04,await readReg(0x0A))!==0x6C)
   return false;
  const version=await readReg(0x38);
  const ser0=await readReg(0x50),ser1=await readReg(0x52);
  if((version&0xFFF8)!==0x0020||!(ser0||ser1))throw Error('E703.11-Kennung für AFE-Wiederanlauf nicht bestätigt');
  const words=[];
  for(let i=0;i<64;i++){
   await send(0x4E,0x4C00|i*2);
   await nvmWaitIdle(1200,12,15);
   words.push(await readReg(0x48));
  }
  if(words[0]!==ser0||words[1]!==ser1||CAL.crc16(words)!==words[63]||CAL.crc8(words)!==(words[15]>>>8))
   throw Error('Chipkennung oder EEPROM-Prüfsumme beim AFE-Wiederanlauf ungültig');
  const afe=words[0x38/2];
  try{decodeSafeAFE(afe)}catch(e){
   // A CRC-valid image can still contain an unusable AFE setting.
   // Let the next cold-start delay try to initialize the chip naturally.
   logging('SSP3-Kaltstart: EEPROM-CFG_AFE1=0x'+h(afe,2)+' nicht für RAM-Übernahme geeignet: '+e.message);
   return false;
  }
  if(await readReg(R_AFE)!==0)throw Error('CFG_AFE1 hat sich während der Diagnose geändert');
  st.coldStartAfeRestored=true;
  await send(R_AFE,afe);
  if(await readReg(R_AFE)!==afe)throw Error('CFG_AFE1 konnte im RAM nicht bestätigt werden');
  logging('SSP3-Kaltstart: CFG_AFE1 aus CRC-geprüftem EEPROM ins RAM übernommen: 0x'+h(afe,2));
  return true;
 }

 function showReadOnlySensor(){
  show('connMsg','E703.11 '+st.readOnlySensor+' verbunden. Register sind lesbar. CFG_AFE1 = 0x0000: Das Analog-Frontend ist nicht kalibrierbereit.','warn');
  show('adcMsg','Live-Messung erst mit gültiger AFE-Konfiguration verfügbar.','warn');
 }

 // Elmos 70311_gui_default.xml: measurement enable, default AFE and continuous period.
 // Match the observed inactive profile before applying those three RAM values.
 async function startRamMeasurement(remember=false){
  return withProgress('Live-Messung wird vorbereitet',()=>startRamMeasurementOperation(remember),true);
 }
 async function startRamMeasurementOperation(remember){
  if(!st.port||!st.readOnlySensor||st.chip||st.closing||st.ramMeasurementStarting)return;
  const port=st.port,address=st.plcAddress,uid=st.readOnlySensor;
  const profile=[
   {address:0x04,before:0x1214,after:0x12D6},
   {address:R_AFE,before:0,after:0x0800},
   {address:0x0E,before:0,after:1}
  ];
  const send=(register,value)=>{
   if(st.port!==port||st.closing||st.plcAddress!==address)
    throw Error('Sensorverbindung unterbrochen');
   return exchange(P.plcHostCommand(P.plcWrite(register,value,st.plcAddress),st.plcHostFormat));
  };
  const changed=[];
  st.ramMeasurementStarting=true;
  renderStatus();
  try{
   const version=await readReg(0x38),ser0=await readReg(0x50),ser1=await readReg(0x52);
   if(h(version,2)+h(ser1,2)+h(ser0,2)!==uid)throw Error('Chipkennung hat sich geändert');
   for(const entry of profile){
    if(await readReg(entry.address)!==entry.before)
     throw Error('RAM-Profil weicht ab bei Register 0x'+h(entry.address));
   }
   for(const entry of profile){
    changed.push(entry);
    await send(entry.address,entry.after);
    if(await readReg(entry.address)!==entry.after)
     throw Error('RAM-Rücklesen fehlgeschlagen bei Register 0x'+h(entry.address));
   }
   await send(0x22,0x8B93);
   const deadline=Date.now()+1600;
   let status;
   do{
    await sleep(30);
    status=await readReg(0x36,500);
   }while(!(status&2)&&Date.now()<deadline);
   if(!(status&2))throw Error('Der Sensor meldet keine neue ADC_S-Messung');
   st.measurementPeriod=1;
   st.measurementStatus=status;
   st.coldStartAfeRestored=true;
   await detect();
   st.readOnlySensor=null;
   if(remember)lsSet('ssp3-auto-ram-uid',uid);
   show('connMsg','Live-Messung im RAM gestartet. NVM-Schreiben ist in dieser Sitzung gesperrt.','success');
  }catch(error){
   st.chip=false;
   stopLive();
   let restoreError=false;
   for(const entry of changed.reverse()){
    try{
     await send(entry.address,entry.before);
     if(await readReg(entry.address)!==entry.before)restoreError=true;
    }catch(_){restoreError=true;}
   }
   st.measurementPeriod=null;
   st.measurementStatus=null;
   show('connMsg','RAM-Messstart fehlgeschlagen: '+error.message+
    (restoreError?' Die ursprünglichen RAM-Werte konnten nicht vollständig bestätigt werden.':''),
    'warn');
  }finally{
   st.ramMeasurementStarting=false;
   renderStatus();
  }
 }

 // Confirm the PLC address before deciding whether calibration is available.
 async function probePlcAddresses(stage,verifyPsscStartup=false,allowReadOnly=true){
  const previous=st.plcAddress;
  for(const candidate of P.plcProbeOrder(previous)){
   if(!st.port||st.closing)throw Error('USB-Verbindung während PLC-Adresserkennung beendet');
   st.plcAddress=candidate;
   const record={at:new Date().toISOString(),stage,address:'0x'+h(candidate),verified:false};
   try{
    const afe=await readReg(R_AFE,1350);
    const diagnosticOnly=afe===0&&st.adapterKind==='ssp3'&&!demoEnabled;
    if(!diagnosticOnly||!allowReadOnly)decodeSafeAFE(afe);
    const adc=await readReg(0x2A,1350);
    const cfg=await readReg(0x06,1350);
    const pads=await readReg(0x0A,1350);
    const configured=P.plcAddressFromConfig(cfg,pads);
    record.configuredAddress='0x'+h(configured);
    if(verifyPsscStartup&&st.adapterKind==='ssp3'&&st.firmware==='02.08.02.04'&&cfg===0x6C04){
     st.plcAddress=previous;
     logging('PSSC-RAM-Adresse bereits aktiv. Neustart wird vor der Kalibrierung geprüft.');
     return false;
    }
    record.cfgSpiI2c='0x'+h(cfg,2);record.cfgPads1='0x'+h(pads,2);
    if(diagnosticOnly&&configured!==candidate)decodeSafeAFE(afe);
    if(configured!==candidate)throw Error('PLC-Adresskonflikt: gelesen über 0x'+h(candidate)+
     ', Sensorregister nennen 0x'+h(configured)+'. Keine Schreibfreigabe.');
    if(diagnosticOnly){
     const version=await readReg(0x38,1350);
     const ser0=await readReg(0x50,1350),ser1=await readReg(0x52,1350);
     if((version&0xFFF8)!==0x0020||!(ser0||ser1)||(ser0===0xFFFF&&ser1===0xFFFF)){
      decodeSafeAFE(afe);
     }
     st.readOnlySensor=h(version,2)+h(ser1,2)+h(ser0,2);
     st.afe=afe;
     showReadOnlySensor();
    }else{
     st.readOnlySensor=null;
     await detect();
    }
    st.plcAddressVerified=true;st.plcAddressSource='CFG_SPI_I2C + CFG_PADS1 / CRC8';
    record.verified=true;record.afe='0x'+h(afe,2);record.adcS=P.sign16(adc);
    st.plcAddressProbes.push(record);
    logging('PLC-Adresse 0x'+h(candidate)+' durch Sensor-Rücklesung bestätigt ('+stage+').');
    renderStatus();return true;
   }catch(error){
    record.error=String(error.message||error);
    st.plcAddressProbes.push(record);
    logging('PLC-Adresse 0x'+h(candidate)+' bei '+stage+' nicht bestätigt: '+record.error);
    st.chip=false;st.readOnlySensor=null;st.plcAddressVerified=false;st.uid=null;st.boot=null;
    // Do not continue into RAM cookie/power recovery after CRC, plausibility,
    // programming or other errors that are not an absent chip response.
    if(!/\bPLC nothing received\b/i.test(record.error)&&
       error?.code!=='AFE_ZERO_READBACK'){
     st.plcAddress=previous;throw error;
    }
   }
  }
  st.plcAddress=previous;renderStatus();return false;
 }
 async function detect(){
  // AFE and ADC_S form the minimum real chip-presence proof.
  // Do not make the entire live display dependent on less reliable temperature
  // or DSP registers. A full calibration capture remains strict and separate.
  const w=await readReg(R_AFE),g=decodeSafeAFE(w);
  const rawS=await readReg(0x2A),s=P.sign16(rawS);
  st.afe=w;st.staged={...g};st.chip=true;st.sensorLost=false;
  gainSummary();
  // Optional AFE0 read must not invalidate the already proven pressure channel.
  try{await loadBridgeSupply()}
  catch(e){st.afe0=null;
   logging('CFG_AFE0-Brückenspannung noch nicht verfügbar: '+String(e.message||e));
   renderBridgeSupplyState()}
  logging('Chip-Leseantwort: AFE=0x'+h(w,2)+' ADC_S='+s);
  // Publish the already confirmed ADC_S value immediately, even if subsequent
  // ADC_T / ADC_TC requests are temporarily unavailable.
  updateADC({s,t:null,tc:null},'usb');
  try{
   await readADC({allowPartial:true});
  }catch(e){
   logging('Erster Live-Messzyklus teilweise fehlgeschlagen: '+e.message);
   show('adcMsg','ADC_S erkannt; weitere Live-Register sind noch nicht verfügbar: '+e.message,'warn');
  }
  await expert.onDetect();
  renderStatus();
  show('connMsg',demoEnabled?'Demo-Sensor verbunden. Messwerte und Schreibvorgänge sind simuliert.':
   'Chip-Register über '+(st.iface==='plc'?'1-Wire':st.iface.toUpperCase())+' lesbar. ADC_S bestätigt; Live-Werte werden separat aktualisiert.','success');
  step(1);
  // During power-start and Magic-Cookie recovery, defer the continuous loop
  // until the entire startup process has completed.
  if(!st.powerCycleRunning&&!st.manualLivePause)startLive();
  window.ELMOS_GUIDED?.onConnected?.();
 }

 // Repeated, bounded READ-only PLC probes on an ALREADY configured SSP3.
 // No undocumented SSP3 power commands: the user must power-cycle VDD externally.
 // The serial timeout controls the RESPONSE wait, not the E703.11 NVM startup window.
 async function recoverOneWireStartup(){
  if(demoEnabled||st.adapterKind!=='ssp3'||st.iface!=='plc'||!st.port||st.closing)
   throw Error('Startfenster-Test benötigt einen verbundenen SSP3 im 1-Wire-Modus');
  if(st.chip)throw Error('Chip bereits erkannt – kein erneuter Starttest erforderlich');
  if(st.startupRunning||st.magicRunning||st.powerCycleRunning||st.diagRunning||st.writing||st.nvmWorking||st.calTask||st.afeWriteActive)
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

 // E703.11 datasheet: CFG_PADS1.plc_rw_en magic cookie. Explicit bench-only opt-in.
 // Writes are special 1-Wire frames, not CM/NVM programming; no extra frame between them.
 async function testPlcMagicCookie(){
  if(demoEnabled||st.adapterKind!=='ssp3'||st.iface!=='plc'||!st.port||st.closing)
   throw Error('Magic Cookie benötigt einen verbundenen SSP3 im 1-Wire-Modus.');
  if(st.chip)throw Error('Sensor bereits erkannt; Magic Cookie ist nicht nötig.');
  if(!$('plcMagicConfirm').checked)throw Error('Bitte den RAM-Test zuerst ausdrücklich freigeben.');
  if(st.magicRunning||st.powerCycleRunning||st.startupRunning||st.diagRunning||st.writing||st.nvmWorking||st.calTask||st.afeWriteActive)
   throw Error('Ein anderer Chipvorgang läuft bereits.');
  const port=st.port;
  const commands=[P.plcHostCommand(P.plcWrite(0xAC,0x2B42,st.plcAddress),st.plcHostFormat),P.plcHostCommand(P.plcWrite(0x0E,0x5CFD,st.plcAddress),st.plcHostFormat)];
  st.magicRunning=true;
  st.magicResult={at:new Date().toISOString(),stage:'start',commands:commands.slice(),responses:[],readVerified:false};
  $('plcMagicState').textContent='Magic Cookie wird gesendet: 2 spezielle PLC-Schreibtelegramme, nur flüchtiger RAM-Zustand.';
  logging('PLC Magic Cookie (Test, nur RAM) gestartet: genau zwei dokumentierte Frames, keine NVM-Befehle.');
  renderStatus();
  try{
   for(let i=0;i<commands.length;i++){
    if(st.closing||st.port!==port)throw Error('SSP3 wurde während der Sequenz getrennt.');
    st.magicResult.stage='write-'+(i+1);
    const reply=await exchange(commands[i],2000);
    st.magicResult.responses.push({command:commands[i],rawReply:reply.slice(0,1000)});
    logging('PLC Magic Cookie '+(i+1)+'/2: '+commands[i]+'; SSP3-Prompt ist keine Sensorbestätigung.');
   }
   if(st.closing||st.port!==port)throw Error('SSP3 wurde nach der Sequenz getrennt.');
   st.magicResult.stage='readback';
   $('plcMagicState').textContent='Beide Frames gesendet; jetzt echten Register-Lesezugriff prüfen.';
   if(!await probePlcAddresses('Manueller Magic-Cookie-Test'))
    throw Error('PLC nothing received: 0x6C und 0x7C nicht bestätigt');
   if(st.readOnlySensor){
    $('plcMagicState').textContent='Chipkennung bestätigt. AFE-Konfiguration prüfen.';
    showReadOnlySensor();
    return;
   }
   st.magicResult.stage='verified';
   st.magicResult.readVerified=true;
   $('plcMagicState').textContent='Magic Cookie bestätigt: E703.11 konnte anschliessend gelesen werden. One Wire vorübergehend im RAM aktiv, AODO-Analogsignal eventuell überlagert.';
   show('connMsg','Magic-Cookie-Test erfolgreich: Chipregister lesbar; keine NVM-Programmierung. Der analoge AODO-Ausgang kann vorübergehend ausfallen.','success');
   logging('PLC Magic Cookie: Chip-Lesezugriff nach Sequenz erfolgreich.');
  }catch(e){
   st.magicResult.stage='failed';
   st.magicResult.error=String(e.message||e);
   const msg='Magic Cookie nicht bestätigt: '+st.magicResult.error+'. Der SSP3-Prompt beweist keine Sensorübernahme. Bei abgelaufenem 1-Wire-Startfenster bleibt der Chip unerreichbar.';
   $('plcMagicState').textContent=msg;
   if(!st.closing&&st.port===port)show('connMsg',msg,'warn');
   logging(msg);
  }finally{st.magicRunning=false;renderStatus()}
 }

 // The user SSP3 firmware rejects "Power_OFF 03E8" (Unknown command POWER_OFF).
 // Ask actual SSP3 firmware for its read-only '?' help before any further power operation.
 // Only use the alternate PWR_OFF spelling if this specific firmware advertises it.
 async function readSsp3PowerHelp(){
  if(demoEnabled||st.adapterKind!=='ssp3'||!st.port||st.closing)
   throw Error('SSP3-Firmwarehilfe benötigt einen verbundenen echten SSP3.');
  if(st.magicRunning||st.startupRunning||st.diagRunning||st.writing||st.nvmWorking||st.calTask||st.afeWriteActive)
   throw Error('SSP3-Befehlshilfe ist während eines anderen Vorgangs gesperrt.');
  const raw=await exchange('?',5500);
  const supported=/(?:^|[^A-Z0-9_])PWR_OFF(?:[^A-Z0-9_]|$)/i.test(raw);
  st.powerHelp={at:new Date().toISOString(),reply:raw.slice(0,14000),pwrOffListed:supported};
  $('plcPowerHelpOutput').textContent=raw.slice(0,14000);
  logging('SSP3 Firmwarehilfe gelesen; PWR_OFF '+(supported?'in Liste gefunden':'NICHT bestätigt')+'.');
  return st.powerHelp;
 }
 // Elmos AN0204: PLC P / PLC T and Power_OFF / PWR_ON. Test uses PWR_OFF only
 // if advertised by the running SSP3 firmware, because Power_OFF was rejected.
 // Only a separately approved bench test on DUT powered through switchable SSP3 VSUPPLY.
 async function testSsp3PowerStartup(burstMode='combined',speedProfile=null){
  if(!['combined','split'].includes(burstMode))throw Error('Ungültiger SSP3-Startmodus');
  if(speedProfile!==null&&(![100,50].includes(speedProfile.khz)||
       ![7,14].includes(speedProfile.delay)|| (speedProfile.khz===100)!==(speedProfile.delay===7)))
   throw Error('Ungültiges SSP3-PLC-Testprofil');
  if(demoEnabled||st.adapterKind!=='ssp3'||st.iface!=='plc'||!st.port||st.closing)throw Error('SSP3-Starttest benötigt offenen SSP3 im PLC-Modus.');
  if(st.chip)throw Error('Chip bereits erkannt; kein Power-Cycle erforderlich.');
  if(!$('plcPowerConfirm').checked)throw Error('SSP3-VSUPPLY-Versorgung des isolierten Testchips zuerst bestätigen.');
  if(st.powerCycleRunning||st.magicRunning||st.startupRunning||st.diagRunning||st.writing||st.nvmWorking||st.calTask||st.afeWriteActive)throw Error('Ein anderer Vorgang ist aktiv.');
  const port=st.port;
  // On this SSP3 firmware the separate-form PLC frame is rejected outright.
  // Do not allow the expert diagnostic selector to override this proven rule.
  if(st.firmware==='02.08.02.04'){
   st.plcHostFormat='legacy';
   $('plcHostFormat').value='legacy';
  }else{
   st.plcHostFormat=$('plcHostFormat').value;
  }
  if(!['legacy','separate'].includes(st.plcHostFormat))throw Error('Ungültiger SSP3-PLC-Hostformatwert');
  logging('SSP3 PLC-Hostformat beim automatischen Power-Start: '+st.plcHostFormat);
  st.powerCycleRunning=true;
  st.powerCycleResult={at:new Date().toISOString(),stage:'start',burstMode,
   plcTestSpeedKhz:speedProfile?.khz??null,plcTestDelay:speedProfile?.delay??null,
   plcHostFormat:st.plcHostFormat,steps:[],readVerified:false,powerRestored:false};
  let powerOffAttempted=false,powerOnAcknowledged=false;
  logging('AN0204: Versuch mit geprüftem SSP3-PWR_OFF -> PLC P -> PWR_ON -> PLC T; Firmwarehilfe wird zuerst abgefragt.');
  $('plcPowerState').textContent='SSP3-Sensorversorgung und PLC-Startsequenz laufen.';
  renderStatus();
  async function send(command,ms){
   if(st.port!==port||st.closing)throw Error('SSP3-Verbindung unterbrochen.');
   st.powerCycleResult.stage=command;
   const start=Date.now();
   try{
    const reply=await exchange(command,ms);
    st.powerCycleResult.steps.push({command,elapsedMs:Date.now()-start,reply:reply.slice(0,800),ok:true});
    logging('AN0204: '+command+' erfolgreich nach '+(Date.now()-start)+' ms.');
   }catch(e){
    st.powerCycleResult.steps.push({command,elapsedMs:Date.now()-start,error:String(e.message||e),ok:false});
    throw e;
   }
  }
  try{
   // The user's SSP3 explicitly rejected the AN0204 "Power_OFF" spelling.
   // Do not try unverified alternative power commands unless firmware itself lists one.
   $('plcPowerState').textContent='Lese SSP3-Befehlshilfe (?) – vorerst keine Änderung der Sensorversorgung.';
   const help=await readSsp3PowerHelp();
   st.powerCycleResult.steps.push({command:'?',reply:help.reply,ok:true,pwrOffListed:help.pwrOffListed});
   if(!help.pwrOffListed)
    throw Error('Firmwarehilfe nennt kein PWR_OFF. Power-Cycle aus Sicherheitsgründen abgebrochen; es wurden keine Ausschaltbefehle gesendet. Bitte Hilfe- und TX/RX-Protokoll exportieren.');
   // PSSC's original ssp3_lib.dll initializes the PLC host via
   // "PLC_CFG 1 %04X". The current board firmware 02.08.02.04 follows
   // the newer calibrated delay formula; vendor presets map 100 kHz->0007
   // and 50 kHz->000E. This changes ONLY the SSP3 line clock, never NVM.
   // A failed command is recorded and falls back to the previous host speed.
   if(speedProfile&&st.firmware==='02.08.02.04'){
    const command='PLC_CFG 1 '+P.hx(speedProfile.delay,2);
    try{
     const raw=await exchange(command,1900);
     if(/(?:^|[\r\n])\s*!/m.test(raw)||!/\#PLC_CFG\b/i.test(raw))
      throw Error('SSP3 hat PLC_CFG nicht plausibel bestätigt: '+raw.slice(0,180));
     st.powerCycleResult.plcSpeedApplied=true;
     st.powerCycleResult.steps.push({command,reply:raw.slice(0,500),ok:true,kind:'ssp3-host-plc-speed'});
     logging('SSP3 PLC_CFG bestätigt: '+speedProfile.khz+' kHz, Delay=0x'+P.hx(speedProfile.delay,2)+
      ' (nur SSP3-Kommunikation, kein Sensorregister).');
    }catch(configError){
     st.powerCycleResult.plcSpeedApplied=false;
     st.powerCycleResult.plcSpeedError=String(configError.message||configError);
     logging('SSP3 PLC_CFG-Preset nicht bestätigt; behalte bisherigen Host-Takt bei: '+
      st.powerCycleResult.plcSpeedError);
    }
   }
   // 03E8 = 1000 mV; the documented OFF threshold is applied to the detected alias.
   $('plcPowerState').textContent='PWR_OFF in Firmwarehilfe gefunden. SSP3-VSUPPLY wird einmalig am Prüfplatz geschaltet.';
   powerOffAttempted=true;
   await send('PWR_OFF 03E8',5500);
   await sleep(30); // off-state settling; no delay after the subsequent power-on
   await send('PLC P',2500);
   $('plcPowerState').textContent='PLC-Puffer vorbereitet; SSP3 startet VSUPPLY und sendet PLC T.';
   // E703.11 startup window can be only 4 ms. The default keeps both
   // serial commands within ONE USB packet. If needed, the outer bounded
   // recovery tries the previously used split-write variant once.
   st.powerCycleResult.stage='PWR_ON + PLC T ('+burstMode+')';
   const burstStarted=Date.now();
   const burstResponse=await exchangeSsp3StartupBurst(burstMode);
   st.powerCycleResult.steps.push({
    command:'PWR_ON 0C80 00C8 0 -> PLC T',
    mode:burstMode==='combined'?'single-combined-usb-write':'two-fast-serial-writes',
    elapsedMs:Date.now()-burstStarted,reply:burstResponse.slice(0,1000),ok:true
   });
   logging('AN0204: SSP3 quittierte beide Startbefehle mit Transport '+burstMode+
    ' ('+(Date.now()-burstStarted)+' ms).');
   powerOnAcknowledged=true;
   st.powerCycleResult.powerRestored=true;
   st.powerCycleResult.stage='readback';
   logging('AN0204: erste Chip-Leseabfrage im Host-Format '+st.plcHostFormat+' (nur Register-READ).');
   try{
    if(!await probePlcAddresses('Nach SSP3 PLC P/T'))
     throw Error('PLC nothing received: E703.11 antwortet weder mit 0x6C noch mit 0x7C nach PLC P/T.');
   }catch(firstReadError){
    // The SSP3 may report either "!PLC nothing received" or an apparently
    // parsed 00 00 35 frame for a missing/locked chip. Jürg's 2026-11-12
    // trace demonstrates the latter: AFE1=0x0000 with no fallback.
    // Only the exact typed zero-AFE case or explicit "nothing received" may
    // trigger the previously bench-tested one-time RAM cookie fallback.
    // Never bypass arbitrary invalid AFE codes, malformed frames or UID checks.
    const missingReply=/\bPLC nothing received\b/i.test(String(firstReadError.message||firstReadError));
    const zeroAFE=firstReadError?.code==='AFE_ZERO_READBACK'&&
     st.lastPlcReply?.address===R_AFE&&st.lastPlcReply?.status==='parsed'&&st.lastPlcReply?.word===0;
    if(!missingReply&&!zeroAFE)throw firstReadError;
    if(st.closing||st.port!==port)throw firstReadError;
    st.powerCycleResult.firstReadError=String(firstReadError.message||firstReadError);
    st.powerCycleResult.fallbackReason=zeroAFE?'afe-zero-readback':'plc-nothing-received';
    st.powerCycleResult.stage='magic-cookie-fallback';
    $('plcPowerState').textContent='Kein plausibler E703.11-Registerwert. Einmaliger RAM-Magic-Cookie-Versuch läuft.';
    logging('AN0204: '+(zeroAFE?'AFE1=0x0000 trotz formal lesbarer PLC-Antwort':'Keine PLC-Antwort')+
     '; versuche einmal die dokumentierte Magic Cookie (nur RAM).');
    st.magicResult={at:new Date().toISOString(),stage:'automatic-after-power-start',
     commands:[],responses:[],attempts:[],readVerified:false,automatic:true};
    let lastCookieError=null;
    // Only two known addresses, two consecutive cookie frames per address.
    // No arbitrary register writes; no NVM programming.
    for(const address of P.plcProbeOrder(st.plcAddress)){
     if(st.port!==port||st.closing)throw Error('SSP3 während der Magic-Cookie-Sequenz getrennt.');
     st.plcAddress=address;
     const cookieFrames=[
      P.plcHostCommand(P.plcWrite(0xAC,0x2B42,st.plcAddress),st.plcHostFormat),
      P.plcHostCommand(P.plcWrite(0x0E,0x5CFD,st.plcAddress),st.plcHostFormat)
     ];
     const trial={address:'0x'+h(address),commands:cookieFrames.slice(),readVerified:false};
     st.magicResult.attempts.push(trial);
     st.magicResult.commands.push(...cookieFrames);
     try{
      for(const frame of cookieFrames){
       if(st.closing||st.port!==port)throw Error('SSP3 während Magic Cookie getrennt.');
       const started=Date.now();
       const reply=await exchange(frame,2000);
       st.magicResult.responses.push({address:trial.address,command:frame,rawReply:reply.slice(0,1000)});
       st.powerCycleResult.steps.push({command:frame,elapsedMs:Date.now()-started,
        reply:reply.slice(0,800),ok:true,kind:'magic-cookie-ram',address:trial.address});
      }
      st.powerCycleResult.stage='magic-cookie-readback';
      $('plcPowerState').textContent='Magic Cookie bei '+trial.address+' übertragen – Sensor-Rücklesung läuft.';
      if(!await probePlcAddresses('Nach Magic Cookie '+trial.address))
       throw Error('PLC nothing received nach Magic Cookie '+trial.address);
      trial.readVerified=true;
      st.magicResult.stage='verified';
      st.magicResult.readVerified=true;
      st.magicResult.verifiedUid=st.uid?.hex||null;
      st.powerCycleResult.magicCookieUsed=true;
      logging('AN0204: Magic Cookie bei '+trial.address+
       ' erfolgreich, PLC-Adresse 0x'+h(st.plcAddress)+' durch Register bestätigt.');
      break;
     }catch(cookieError){
      lastCookieError=cookieError;
      trial.error=String(cookieError.message||cookieError);
      logging('Magic Cookie bei '+trial.address+' nicht bestätigt: '+trial.error);
      if(!/\bPLC nothing received\b/i.test(trial.error)&&
         cookieError?.code!=='AFE_ZERO_READBACK')throw cookieError;
     }
    }
    if(!st.magicResult.readVerified){
     st.magicResult.stage='failed';
     st.magicResult.error=String(lastCookieError?.message||lastCookieError||'Keine Sensorantwort');
     throw lastCookieError||Error('PLC nothing received nach Adresssuche');
    }
   }
   if(st.readOnlySensor){
    st.powerCycleResult.stage='diagnostic-only';
    $('plcPowerState').textContent='Chipkennung bestätigt. AFE-Konfiguration prüfen.';
    showReadOnlySensor();
    return;
   }
   st.powerCycleResult.plcAddress='0x'+h(st.plcAddress);
   st.powerCycleResult.readVerified=true;
   st.powerCycleResult.verifiedUid=st.uid?.hex||null;
   // DS 6.4.5.8: a recognised magic cookie must set CFG_SPI_I2C.plc_en
   // in volatile RAM, which keeps the AODO One-Wire window open until reset.
   // A one-off ADC value does not prove that PLC was permanently latched.
   try{
    const cfg=await readReg(0x06,1800);
    st.powerCycleResult.plcConfigRam=cfg;
    st.powerCycleResult.plcEnabledInRam=!!(cfg&0x0004);
    logging('E703.11 CFG_SPI_I2C RAM=0x'+h(cfg,2)+', plc_en='+
     (st.powerCycleResult.plcEnabledInRam?'1 (One Wire aktiv bis Reset)':'0 (nur Startfenster, Live möglicherweise nicht verfügbar)'));
   }catch(e){
    st.powerCycleResult.plcEnabledInRam=null;
    st.powerCycleResult.plcConfigReadError=String(e.message||e);
    logging('One-Wire-RAM-Freigabe plc_en konnte nicht unabhängig gelesen werden: '+st.powerCycleResult.plcConfigReadError);
   }
   // Read-only diagnosis: a single power-on conversion leaves readable,
   // but static ADC results, unless CMD start is re-issued.
   try{
    st.measurementPeriod=await readReg(0x0E,1800);
    st.measurementStatus=await readReg(0x36,1800);
    st.powerCycleResult.measurementPeriod=st.measurementPeriod;
    st.powerCycleResult.measurementStatus=st.measurementStatus;
    logging('CFG_PERIOD=0x'+h(st.measurementPeriod,2)+' ('+P.periodMode(st.measurementPeriod)+
     '), STATUS=0x'+h(st.measurementStatus,2)+' idle='+(st.measurementStatus&1));
   }catch(e){
    st.measurementError=String(e.message||e);
    logging('CFG_PERIOD/STATUS Diagnose: '+st.measurementError);
   }
   // Magic Cookie writes its second frame to 0x0E with 0x5CFD, which is
   // CFG_PERIOD. Restore a known, temporary continuous RUN configuration
   // only after verifying the cookie caused this exact RAM register value.
   if(st.adapterKind==='ssp3'&&st.iface==='plc'&&
      st.powerCycleResult.magicCookieUsed===true&&st.measurementPeriod===0x5CFD){
    st.powerCycleResult.livePeriodBefore=st.measurementPeriod;
    st.powerCycleResult.stage='restore-live-conversion-after-cookie';
    logging('Magic Cookie hinterliess CFG_PERIOD=0x5CFD. Setze nur RAM-CFG_PERIOD=0x0001 und CMD.start fuer kontinuierliche Kalibrierung.');
    try{
     if(st.closing||st.port!==port||!st.chip)throw Error('Sensor beim RAM-Messstart nicht verbunden.');
     const command=P.plcHostCommand(P.plcWrite(0x0E,0x0001,st.plcAddress),st.plcHostFormat);
     const reply=await exchange(command,2500);
     st.powerCycleResult.steps.push({command,reply:reply.slice(0,800),ok:true,kind:'ram-live-period-only'});
     const check=await readReg(0x0E,1800);
     if(check!==0x0001)throw Error('CFG_PERIOD RAM-Ruecklesung 0x'+h(check,2)+' statt 0x0001.');
     st.measurementPeriod=check;
     const start=P.plcHostCommand(P.plcWrite(0x22,0x8B93,st.plcAddress),st.plcHostFormat);
     const startReply=await exchange(start,2500);
     st.powerCycleResult.steps.push({command:start,reply:startReply.slice(0,800),ok:true,kind:'ram-cmd-start-only'});
     st.measurementStarts++;
     await sleep(65);
     st.measurementStatus=await readReg(0x36,1800);
     st.powerCycleResult.measurementPeriod=check;
     st.powerCycleResult.measurementStatus=st.measurementStatus;
     st.powerCycleResult.livePeriodAdjustedInRam=true;
     logging('RAM-Live-Konversion aktiviert: CFG_PERIOD=0x0001, STATUS=0x'+h(st.measurementStatus,2)+'. NVM bleibt unveraendert.');
    }catch(err){
     st.measurementError='RAM-Live-Konversion konnte nicht gestartet werden: '+String(err.message||err);
     st.powerCycleResult.livePeriodAdjustmentError=st.measurementError;
     logging(st.measurementError);
     show('adcMsg',st.measurementError+' · Chip weiterhin verbunden, kein NVM-Schreiben.','warn');
     try{st.measurementPeriod=await readReg(0x0E,1800)}catch(_){st.measurementPeriod=null}
    }
   }
   st.powerCycleResult.stage='verified';
   const usedCookie=!!st.powerCycleResult.magicCookieUsed;
   $('plcPowerState').textContent=usedCookie?
    'One Wire erkannt: Automatischer Magic-Cookie-Fallback im RAM erfolgreich. NVM unverändert.':
    'One Wire nach SSP3-Power-Cycle direkt erkannt. NVM unverändert.';
   const plcRamState=st.powerCycleResult.plcEnabledInRam;
   const statusText=plcRamState===false?
    'E703.11 konnte einmalig gelesen werden, aber CFG_SPI_I2C.plc_en ist im RAM 0. Die dauerhafte One-Wire-Freigabe wurde nicht übernommen; wiederholte Live-Abfragen können scheitern. Bitte SSP3-Log exportieren.':
    usedCookie?
     'One Wire verbunden: Magic Cookie nach automatischem SSP3-Start erfolgreich. '+(plcRamState===true?'Dauerhafte PLC-RAM-Freigabe bestätigt.':'PLC-RAM-Freigabe noch nicht unabhängig bestätigt.')+' Keine NVM-Programmierung.':
     'AN0204-Starttest: E703.11 antwortet nach SSP3-gesteuertem Neustart. '+(plcRamState===true?'PLC-RAM-Freigabe bestätigt.':'PLC-RAM-Freigabe nicht unabhängig bestätigt.')+' Keine NVM-Programmierung.';
   show('connMsg',statusText,plcRamState===false?'warn':'success');
  }catch(e){
   st.powerCycleResult.stage='failed';
   st.powerCycleResult.error=String(e.message||e);
   if(st.magicResult?.automatic&&!st.magicResult.readVerified&&st.magicResult.stage!=='failed'){
    st.magicResult.stage='failed';
    st.magicResult.error=st.powerCycleResult.error;
   }
   // PWR_OFF may take effect even if the acknowledgment times out.
   // A failed burst may still have turned power ON; explicit PWR_ON is idempotent.
   // Recover VSUPPLY when the combined acknowledgement is missing.
   if(powerOffAttempted&&!powerOnAcknowledged&&st.port===port&&!st.closing){
    try{await send('PWR_ON 0 0 0',4000);st.powerCycleResult.powerRestored=true;logging('AN0204: DUT-Versorgung mit PWR_ON 0 0 0 wieder aktiviert.')}
    catch(restore){st.powerCycleResult.restoreError=String(restore.message||restore);logging('WARNUNG: DUT-Versorgung konnte nicht bestätigt wiederhergestellt werden: '+st.powerCycleResult.restoreError);}
   }
   // After BOTH the buffered start and guarded Cookie have failed,
   // probe a few distinct register addresses READ-ONLY. This never
   // delays the time-critical power-on window or modifies sensor RAM/NVM.
   // Distinguishes all-register 0000 from a single invalid CFG_AFE1.
   if(st.port===port&&!st.closing&&st.adapterKind==='ssp3'&&st.iface==='plc'&&
      !st.chip&&powerOnAcknowledged){
    const diagnostic={at:new Date().toISOString(),interface:st.iface,
     reason:'Automatisch nach fehlgeschlagenem SSP3-Start (nur lesen)',probes:[]};
    st.chipDiag=diagnostic;
    st.powerCycleResult.failureProbes=diagnostic.probes;
    for(const [addr,name] of [[0x04,'CFG_EN'],[0x08,'CFG_PADS0'],[0x0A,'CFG_PADS1'],
                                [0x1C,'CFG_AFE1'],[0x2A,'ADC_S']]){
     if(st.port!==port||st.closing)break;
     const entry={addr,name},previousFrame=st.lastPlcReply;
     try{entry.value=await readReg(addr,1250)}
     catch(probeErr){entry.error=String(probeErr.message||probeErr)}
     if(st.lastPlcReply!==previousFrame)entry.frame={...st.lastPlcReply};
     diagnostic.probes.push(entry);
     logging('SSP3 Read-only-Probe '+name+' (0x'+h(addr)+'): '+
      (entry.error?'Fehler '+entry.error:'0x'+h(entry.value,2)+
       ', CRC8 '+(entry.frame?.crc8IndependentCheck||'unbekannt')));
    }
    $('chipDiagDetails').open=true;
    $('chipDiagResult').textContent=formatChipDiag(diagnostic);
   }
   const power=!powerOffAttempted?'Kein Ausschaltbefehl gesendet.':st.powerCycleResult.powerRestored?'DUT-Versorgung laut SSP3 wieder eingeschaltet.':'ACHTUNG: DUT-Versorgung nicht als eingeschaltet bestätigt!';
   const msg='AN0204-Starttest ohne Chipantwort: '+st.powerCycleResult.error+'. '+power+' Bitte TX/RX-Log exportieren.';
   $('plcPowerState').textContent=msg;
   if(st.port===port&&!st.closing)show('connMsg',
    'Kommunikation fehlgeschlagen: Der E703.11 wurde nicht zuverlässig erkannt. Der SSP3 ist über USB erreichbar. Sensoranschluss und Versorgung prüfen und anschliessend «Sensor neu initialisieren» wählen. Technische Details stehen im TX/RX-Protokoll.','warn');
   logging(msg);
  }finally{
   st.powerCycleRunning=false;renderStatus();
   // Never poll ADC while SSP3 power/cookie setup still owns the interface.
   // Start live acquisition only once a genuine readback was verified.
   // READ-ONLY polling may start after confirmed ADC_S, even if the full
   // power-start proof is incomplete. NVM writing retains its existing gates.
   if(st.port===port&&!st.closing&&st.chip&&Number.isFinite(st.adc?.s)&&!st.manualLivePause){
    logging('Live-Start nach SSP3-Initialisierung: ADC_S bestätigt, NVM-Startprüfung '+(st.powerCycleResult?.readVerified?'vollständig':'noch offen')+'.');
    startLive();
   }else if(st.port===port&&!st.closing){
    logging('Live-Start noch nicht möglich: Chip '+!!st.chip+', ADC_S '+String(st.adc?.s)+', Pause '+!!st.manualLivePause);
   }
  }
 }

 // PSSC 3.2.1 single-socket E703.11 startup, verified on SSP3 firmware 2824.
 // Channel #0 is the adapter's internal bus. The identifier read verifies
 // the extension before using its GPIO routing or the RAM-only broadcast.
 async function tryPsscRamStartup(){
  if(st.firmware!=='02.08.02.04'||st.adapterKind!=='ssp3'||st.iface!=='plc')return false;
  let boardId;
  try{
   await exchange('I2C_CFG 3 01 01');
   boardId=P.readData(await exchange('I2C #0 SA200RA3....P'),4);
  }catch(e){
   logging('PSSC-Start: SSP3-Erweiterung konnte nicht bestätigt werden: '+e.message);
   return false;
  }
  if(boardId.join(',')!=='17,0,7,1')return false;
  const port=st.port;
  const trial={stage:'PSSC-RAM-Start',readVerified:false,powerRestored:false,steps:[]};
  st.startupTrials.push(trial);
  st.powerCycleRunning=true;
  renderStatus();
  try{
   const run=async command=>{
    if(st.port!==port||st.closing)throw Error('SSP3-Verbindung während Kaltstart beendet');
    const reply=await exchange(command);
    trial.steps.push({command,reply});
    return reply;
   };
   for(const command of ['GPIO_SET 00C0','GPIO_CFG B81E','IF_CFG 7 0 0','PLC_CFG 0404 0'])
    await run(command);
   // PSSC retries with adapter delays 0, 0x08 and 0x10. The first PLC
   // read may time out; the following broadcast is the RAM-only enable.
   let ready=false;
   for(const delay of ['0','8','10']){
    trial.powerRestored=false;
    await run('PWR_OFF 0');
    for(const command of ['IF_CFG 7 0 0','PLC R','PLC_CFG 020A 0','PLC_CFG 1 0007','PLC P'])
     await run(command);
    await run('PWR_ON FFFF '+delay+' 0');
    trial.powerRestored=true;
    await run('PLC T');
    const startupRead=delay==='0'?'PLC 0201000A.':'PLC 026D000A.';
    try{await run(startupRead)}catch(e){
     if(!/PLC nothing received/i.test(e.message))throw e;
     trial.steps.push({command:startupRead,error:e.message});
    }
    st.psscRamRecovery=true;
    await run('PLC 02FE06076C044E');
    await run('GPIO_GET');
    st.plcAddress=0x6C;
    try{await readReg(0x6A,1350)}catch(e){
     if(!/PLC nothing received/i.test(e.message))throw e;
     continue;
    }
    ready=await probePlcAddresses('PSSC-RAM-Freigabe (Delay '+delay+')',false,false);
    if(!ready&&await restoreColdStartAfe(port))
     ready=await probePlcAddresses('PSSC-RAM-Freigabe nach AFE-Wiederanlauf',false,false);
    if(!ready&&delay==='10')
     ready=await probePlcAddresses('PSSC-RAM-Freigabe für Diagnose');
    if(ready)break;
    trial.steps.push({delay,error:'Keine bestätigte AFE-Konfiguration; nächstes Startprofil prüfen'});
   }
   if(st.readOnlySensor){showReadOnlySensor();return true;}
   if(!ready)throw Error('PSSC-RAM-Freigabe ohne bestätigte Kalibrierbereitschaft');
   trial.readVerified=true;
   trial.verifiedUid=st.uid?.hex||null;
   show('connMsg',st.coldStartAfeRestored?'Sensor nach AFE-Wiederanlauf verbunden. NVM-Schreiben bleibt gesperrt.':'Sensor über PSSC-RAM-Freigabe verbunden. NVM-Schreiben ist auf geprüfte Kalibrierdaten begrenzt.','success');
   return true;
  }catch(e){
   trial.error=String(e.message||e);
   logging('PSSC-Start: '+trial.error);
   if(!trial.powerRestored&&st.port===port&&!st.closing){
    try{await exchange('PWR_ON 0 0 0');trial.powerRestored=true}
    catch(restoreError){throw Error('SSP3-Versorgung konnte nicht wiederhergestellt werden: '+restoreError.message)}
   }
   return false;
  }finally{
   st.powerCycleRunning=false;
   renderStatus();
   if(st.port===port&&!st.closing&&st.chip&&!st.manualLivePause)startLive();
  }
 }

 // One explicit connection/recovery action can exercise both documented
 // CR-separated USB transports without making Jürg perform two manual tests.
 // Exactly two full controlled DUT power cycles at most; stop after success
 // or any failure where the DUT supply was not positively restored.
 async function startSsp3WithBoundedRetry(){
  const port=st.port;
  if(!port||st.closing)throw Error('SSP3-Port nicht offen');
  st.startupTrials=[];
  st.magicResult=null;
  if(await tryPsscRamStartup())return true;
  const knownFirmware=st.firmware==='02.08.02.04';
  const profiles=knownFirmware?[
   {mode:'combined',speed:{khz:100,delay:7}},
   {mode:'split',speed:{khz:50,delay:14}}
  ]:[
   {mode:'combined',speed:null},{mode:'split',speed:null}
  ];
  const firstAddress=st.plcAddress;
  for(const [i,profile] of profiles.entries()){
   if(st.port!==port||st.closing||st.chip)break;
   st.magicResult=null;
   logging('SSP3-Startversuch '+(i+1)+'/2: '+profile.mode+
    (profile.speed?' / PSSC-PLC-Testprofil '+profile.speed.khz+' kHz':' / unveränderter PLC-Takt')+
    '. Keine EEPROM-Programmierung.');
   if(i===1)st.plcAddress=firstAddress===0x6C?0x7C:0x6C;
    await testSsp3PowerStartup(profile.mode,profile.speed);
   st.startupTrials.push({...st.powerCycleResult,
    magicCookie:st.magicResult?{...st.magicResult}:null});
   if(st.chip||st.readOnlySensor)return true;
   const prev=st.powerCycleResult;
   if(i===0&&prev?.powerRestored===true&&st.port===port&&!st.closing){
    logging('Erster SSP3-Start ohne Chipantwort. Zweiter und letzter Versuch mit '+
     (knownFirmware?'PSSC-PLC 50 kHz und ':'')+'getrenntem USB-Transport.');
    $('plcPowerState').textContent='Erster Startversuch ohne Chipantwort. Zweiter, letzter Versuch läuft …';
   }else break;
  }
  logging('SSP3-Start beendet: '+st.startupTrials.length+' Versuch(e), Chip erkannt='+!!st.chip+'.');
  return !!st.chip;
 }
 // A serial port can remain open while the DUT disappears. Never keep stale
 // ADC readings, chip approvals or calibration results associated with it.
 function markSensorUnavailable(reason){
  if(!st.port||st.closing||!st.chip)return;
  logging('Sensor-Kommunikation abgebrochen: '+reason);
  st.sensorLost=true;st.chip=false;st.plcAddressVerified=false;
  archiveStopTelemetry();st.mode='usb';st.afe0=null;
  stopLive();
  st.adc=null;st.dsp=null;st.dspError=null;st.afe=null;st.afe0=null;st.boot=null;st.regs={};
  st.uid=null;st.uidShownForInput=null;
  st.powerCycleResult=null;st.measurementPeriod=null;st.measurementStatus=null;
  st.calStaged=false;st.calVerified=false;st.calImage=null;st.calfit=null;st.nvmDone=false;
  st.nvmBackup=null;st.nvmBackupVerified=false;st.restorePlan=null;
  st.expertOutputPlan=null;st.outputOnlyPlan=null;st.profilePendingAFE=null;
  st.trend=[];erasePoints();
  seriesOfferKey=null;
  window.ELMOS_GUIDED?.onSensorReset?.();
  window.ELMOS_ARCHIVE?.interrupted('Sensor-Kommunikation abgebrochen: '+reason);
  show('connMsg','Kommunikation zum E703.11 fehlgeschlagen. Der Sensor ist nicht mehr erreichbar. SSP3 bleibt über USB verbunden. Nach dem Anschliessen «Sensor neu initialisieren» wählen. Frühere Messpunkte und Schreibfreigaben wurden aus Sicherheitsgründen zurückgesetzt.','warn');
  show('adcMsg','Sensor nicht verbunden. Keine aktuellen Messwerte.','warn');
  renderStatus();
 }
 async function reinitializeSensor(){
  return withProgress('Sensor wird initialisiert',()=>reinitializeSensorOperation(),true);
 }
 async function reinitializeSensorOperation(){
  const port=st.port;
  if(!port||st.closing||st.reinitRunning)return;
  if(st.calTask||st.writing||st.nvmWorking||st.powerCycleRunning||st.magicRunning||st.startupRunning||st.diagRunning||st.afeWriteActive){
   show('connMsg','Neuinitialisierung erst nach Abschluss des laufenden Chipvorgangs möglich.','warn');return;
  }
  st.reinitRunning=true;
  st.psscRamRecovery=false;st.coldStartAfeRestored=false;
  st.startupTrials=[];
  st.chip=false;st.readOnlySensor=null;st.plcAddressVerified=false;st.plcAddressProbes=[];stopLive();
  if(st.liveReadPromise)await st.liveReadPromise.catch(()=>{});
  st.adc=null;st.dsp=null;st.dspError=null;st.afe=null;st.afe0=null;st.boot=null;st.regs={};
  st.uid=null;st.uidShownForInput=null;st.powerCycleResult=null;
  st.measurementPeriod=null;st.measurementStatus=null;
  st.calStaged=false;st.calVerified=false;st.nvmDone=false;
  st.nvmBackup=null;st.nvmBackupVerified=false;st.restorePlan=null;
  st.expertOutputPlan=null;st.outputOnlyPlan=null;st.profilePendingAFE=null;
  st.trend=[];erasePoints();renderStatus();
  show('connMsg','E703.11 wird am bestehenden USB-Anschluss neu initialisiert …','warn');
  try{
   await firmware();
   await selectChipInterface();
   if(st.port!==port||st.closing)throw Error('USB-Verbindung unterbrochen');
   if(st.adapterKind==='ssp3'&&st.iface==='plc'){
    // Same guarded VSUPPLY / PLC P/T / Magic-Cookie sequence used at first connect.
    // Only volatile RAM configuration is touched; no automatic NVM writes.
    $('plcPowerConfirm').checked=true;
    if(!await probePlcAddresses('Neuinitialisierung ohne Power-Cycle',true))
     await startSsp3WithBoundedRetry();
   }else{
    if(st.adapterKind==='bridge'){
     const ready=await bridgeHello();
     if(!ready)throw Error('USB-Bridge nicht bereit');
     await connectBridgeChip();
    }else await detect();
   }
   if(st.readOnlySensor){
    showReadOnlySensor();
    if(st.readOnlySensor===lsGet('ssp3-auto-ram-uid'))await startRamMeasurement();
    return;
   }
   if(!st.chip)throw Error('Keine gültige Registerantwort vom E703.11 erhalten');
   st.sensorLost=false;
   show('connMsg','Sensor erfolgreich neu initialisiert. Die Verbindung und Live-Messung sind wieder bereit. Keine NVM-Programmierung durchgeführt.','success');
   logging('E703.11 ohne Seitenneuladen erneut erkannt.');
  }catch(e){
   st.chip=false;st.sensorLost=!st.adapterNoReply;stopLive();
   logging('Sensor-Neuinitialisierung fehlgeschlagen: '+String(e.message||e));
   show('connMsg',st.adapterNoReply?
    'SSP3 meldet keine Antwort auf .VERSION. Dies betrifft bereits den USB-Programmieradapter. Bitte «SSP3-Port neu öffnen» wählen; bei erneutem Fehlschlag FTDI/COM-Port prüfen.':
    'Sensor-Kommunikation fehlgeschlagen. Sensor und Verkabelung prüfen und «Sensor neu initialisieren» erneut wählen. Technische Details im USB-Protokoll.','warn');
  }finally{
   st.reinitRunning=false;renderStatus();
  }
 }
 // Reopen the SAME previously authorised Web Serial port, without F5
 // or requesting fresh permissions. Only invoked by a deliberate click.
 async function reopenSsp3Port(){
  const port=st.port;
  if(!port||!st.adapterNoReply||st.closing)return;
  if(st.writing||st.calTask||st.nvmWorking||st.powerCycleRunning||st.magicRunning||st.afeWriteActive){
   show('connMsg','USB-Port erst nach Abschluss laufender Chipvorgänge neu öffnen.','warn');return;
  }
  logging('SSP3-Port wird nach fehlendem .VERSION-Handshake neu geöffnet.');
  const closed=await disconnect();
  if(!closed)return;
  try{await connect(port)}catch(e){
   logging('SSP3-Port konnte nicht erneut geöffnet werden: '+String(e.message||e));
   show('connMsg',serialOpenError(e,port),'error');
  }
 }
 async function connect(port){
  return withProgress('Verbindung wird aufgebaut',()=>connectOperation(port),true);
 }
 async function connectOperation(port){
  if(st.port)throw Error('Es ist bereits ein Port offen');
  if(demoEnabled&&port!==demoPort)throw Error('Demo verwendet ausschliesslich den simulierten Adapter');
  if(!demoEnabled&&(!navigator.serial||!window.isSecureContext))throw Error('Chrome benötigt Web Serial über HTTPS oder localhost');
  await port.open({baudRate:Number($('baud').value)});
  liveSecondaryIndex=0;
  reconnectSsp3OnUsb=true;
  st.port=port;st.mode='usb';st.sensorLost=false;st.adapterNoReply=false;
  st.sessionIndex++;st.sessionStartedAt=new Date().toISOString();
  st.psscRamRecovery=false;st.coldStartAfeRestored=false;
  st.startupTrials=[];st.chipDiag=null;st.lastPlcReply=null;st.readerAlive=false;
  st.plcAddress=0x6C;st.plcAddressVerified=false;st.plcAddressSource='';st.plcAddressProbes=[];
  st.reinitRunning=false;st.firmware='';st.readOnlySensor=null;st.powerHelp=null;st.powerCycleResult=null;st.magicResult=null;st.liveReadAttempts=0;st.liveReadSuccesses=0;st.liveLastError=null;st.liveLastAttemptAt=null;st.measurementPeriod=null;st.measurementStatus=null;st.measurementError=null;st.measurementStarts=0;st.measurementFreshCount=0;st.measurementLastChangedAt=null;st.plcHostFormat=$('plcHostFormat').value;st.chip=false;st.afe=null;st.afe0=null;st.boot=null;st.regs={};st.dsp=null;st.dspError=null;st.calStaged=false;st.calVerified=false;st.nvmDone=false;st.adc=null;st.manualLivePause=false;st.afeWriteActive=false;st.ramWriteScope=null;st.uid=null;st.uidShownForInput=null;st.restorePlan=null;st.expertOutputPlan=null;st.outputOnlyPlan=null;st.iface=$('iface').value;st.adapterKind=$('adapterType').value;
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
    st.plcHostFormat='legacy';
    st.iface='plc';
    $('iface').value='plc';
    const bridgeReady=await bridgeHello();
    if(!bridgeReady)return;
   }
   await firmware();
   await selectChipInterface();
   try{
    if(st.adapterKind==='bridge'&&!demoEnabled){await connectBridgeChip();return;}
    if(!demoEnabled&&st.adapterKind==='ssp3'&&st.iface==='plc'){
     // The user confirmed that this lab's DUT is powered from SSP3 VSUPPLY.
     // A fresh power-up opens the NVM-configured 4/10/200-ms PLC window.
     // Run the already protected Power / PLC P / PLC T sequence for EVERY
     // SSP3+One-Wire connection. Never run for I2C, SPI or an ESP32 bridge.
     // The permission flag is internal to the hardware-tested startup routine;
     // there is no stale user setting or checkbox.
     $('plcPowerConfirm').checked=true;
     logging('SSP3 + One Wire: automatischer Sensorstart über VSUPPLY; PLC-Format '+st.plcHostFormat+'.');
     if(!await probePlcAddresses('Erstverbindung ohne Power-Cycle',true))
      await startSsp3WithBoundedRetry();
     if(st.readOnlySensor&&st.readOnlySensor===lsGet('ssp3-auto-ram-uid'))await startRamMeasurement();
     return;
    }
    await detect();
   }catch(e){
    if(st.closing||st.port!==port)return;
    st.chip=false;
    logging('Chiptest: '+e.message);
    if(st.adapterKind==='ssp3'&&st.iface==='plc'){
     logging('SSP3 und IF_CFG bereit, Chipzugriff fehlgeschlagen. USB bleibt offen. Startfenster-Test manuell aktivierbar.');
     $('plcStartupState').textContent='SSP3 bereit; PLC-Lesezugriff noch ohne Sensorantwort. Elmos PSSC kann bei gleicher Verkabelung verbinden. Wahrscheinlich fehlt dessen Initialisierungssequenz. Original-SSP3-Befehlsfolge vergleichen. Erster Fehler: '+e.message;
     const msg=st.chipDiag?.probes?.some(p=>p.addr===R_AFE&&p.value===0)?'Sensor antwortet, aber CFG_AFE1 ist 0x0000. Der AFE-Wiederanlauf konnte nicht bestätigt werden. Details im Diagnoseexport.':'SSP3 erreichbar, E703.11 meldet aber keine gültige Antwort. Der automatische SSP3-Power-Start ist für One Wire standardmässig aktiv und verwendet die gültige PLC-Frameform. Bei weiterem Fehler steht das Diagnoseprotokoll im Expertenmodus zur Verfügung.';
     show('connMsg',msg,'warn');
     renderStatus();
     return;
    }
    if(st.adapterKind==='bridge'){
     const message=st.bridgeRxNote||(e.message.includes('PLC_NO_VALID_FRAME')
      ?'ESP32 verbunden. Warte auf E703.11. Prüfe Versorgung und AODO-Verkabelung und verbinde den Adapter erneut.'
      :'ESP32 erreichbar. E703.11-Zugriff fehlgeschlagen: '+e.message);
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
  if(st.nvmWorking||st.calTask||st.writing||st.powerCycleRunning||st.ramMeasurementStarting){
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
   window.ELMOS_ARCHIVE?.interrupted('USB-Verbindung getrennt');
   Object.assign(st,{
    port:null,readerPromise:null,readerAlive:false,chip:false,readOnlySensor:null,sensorLost:false,adapterNoReply:false,reinitRunning:false,afe0:null,sensorPowerEnabled:false,mode:'offline',firmware:'',boot:null,afe:null,
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
 async function readADC({allowPartial=false}={}){
  if(!st.chip)throw Error('Chip-Lesezugriff noch nicht bestätigt');
  // ADC_S first: a missing temperature reply must never hide a valid pressure
  // live value. Strict callers (calibration/verification) still require both
  // temperature registers; the live loop uses allowPartial:true only.
  const s=P.sign16(await readReg(0x2A));
  let t=null,tc=null,temperatureError=null;
  if(allowPartial){
   try{t=P.sign16(await readReg(0x28))}
   catch(e){temperatureError='ADC_T: '+e.message}
   try{tc=P.sign16(await readReg(0x26))}
   catch(e){temperatureError=(temperatureError?temperatureError+'; ':'')+'ADC_TC: '+e.message}
  }else{
   t=P.sign16(await readReg(0x28));
   tc=P.sign16(await readReg(0x26));
  }
  try{
   const dsp=P.sign16(await readReg(0x30));
   updateDSP(dsp,'usb');
  }catch(e){
   st.dsp=null;st.dspError=e.message;renderDSPLive();
   if(!st.lastDspError||Date.now()-st.lastDspError>12000){
    logging('DSP_S kann nicht gelesen werden: '+e.message);st.lastDspError=Date.now()
   }
  }
  const value=updateADC({s,t,tc},'usb').s;
  if(temperatureError){
   if(!st.lastTempError||Date.now()-st.lastTempError>12000){
    logging('Live-ADC_S verfügbar, Temperaturregister teilweise nicht lesbar: '+temperatureError);
    st.lastTempError=Date.now();
   }
   show('adcMsg','ADC_S live: '+fmt(s)+' Digits. Temperatur noch nicht vollständig lesbar: '+temperatureError,'warn');
  }
  return value;
 }
 // Live acquisition is deliberately independent from strict three-channel
 // calibration sampling. Each cycle publishes a NEW ADC_S immediately. One
 // secondary channel is sampled per cycle; missing ADC_T/ADC_TC/DSP_S cannot
 // suppress subsequent pressure readings. No RAM/NVM writes or power cycles.
 async function readLiveSample(){
  if(!st.chip||!st.port)throw Error('Kein bestätigter Chip für Live-Messung');
  const previous=st.adc;
  // Only for confirmed SSP3 single-measurement mode. This is CMD (RAM)
  // and NOT a CFG_PERIOD, interface or NVM write.
  if((st.adapterKind==='ssp3'||(st.adapterKind==='bridge'&&st.bridgePsscRam))&&st.iface==='plc'&&st.measurementPeriod===2){
   if(st.writing||st.calTask||st.nvmWorking||st.afeWriteActive||st.powerCycleRunning||st.closing)
    throw Error('CMD start während eines anderen Chipvorgangs gesperrt.');
   const command=P.plcHostCommand(P.plcWrite(0x22,0x8B93,st.plcAddress),st.plcHostFormat);
   await exchange(command,1600);
   st.measurementStarts++;
   let fresh=false;
   for(let k=0;k<12;k++){
    await sleep(25);
    const flags=await readReg(0x36,1600);
    st.measurementStatus=flags;
    if(flags&0x0002){fresh=true;break}
   }
   if(!fresh)throw Error('CMD start gesendet, aber STATUS.adc_s_up blieb 0: keine neue ADC-Konversion bestätigt.');
  }
  const s=P.sign16(await readReg(0x2A,1600)); // primary: every cycle
  if(previous&&Number.isFinite(previous.s)&&previous.s!==s){
   st.measurementFreshCount++;
   st.measurementLastChangedAt=Date.now();
  }
  const channel=liveSecondaryIndex++%4;
  if(channel===3&&st.coldStartAfeRestored&&st.adapterKind==='ssp3'&&st.iface==='plc'){
   if(await readReg(R_AFE,1350)===0){
    const error=Error('Sensorneustart erkannt: CFG_AFE1 ist wieder 0x0000');
    error.code='RAM_PROFILE_LOST';
    throw error;
   }
  }
  updateADC({s,t:previous?.t??null,tc:previous?.tc??null},'usb');
  try{
   if(channel===0){
    const t=P.sign16(await readReg(0x28,1100));
    if(st.adc){st.adc.t=t;renderStatus()}
   }else if(channel===1){
    const tc=P.sign16(await readReg(0x26,1100));
    if(st.adc){st.adc.tc=tc;renderStatus()}
   }else if(channel===2){
    updateDSP(P.sign16(await readReg(0x30,1100)),'usb');
   }
   // channel 3: ADC_S only, to guarantee a short polling cycle.
  }catch(e){
   const name=channel===0?'ADC_T':channel===1?'ADC_TC':'DSP_S';
   if(name==='DSP_S'){st.dsp=null;st.dspError=e.message;renderDSPLive()}
   if(!st.lastSecondaryError||Date.now()-st.lastSecondaryError>12000){
    logging('Live '+name+' separat nicht lesbar: '+e.message+'; ADC_S wird weiterhin aktualisiert.');
    st.lastSecondaryError=Date.now();
   }
  }
  return s;
 }
 function startLive(){
  if(st.live||st.calTask||!st.chip||st.powerCycleRunning||st.closing||!st.port)return;
  st.live=true;st.consecutiveErrors=0;
  logging('Live-Messung gestartet: ADC_S zyklisch, ADC_T/ADC_TC/DSP_S verteilt; kein NVM-Schreiben.');
  renderStatus();
  (async function loop(){
   if(!st.live)return;
   try{
    if(!st.writing&&!st.calTask&&!st.nvmWorking){
     st.liveReadAttempts++;
     st.liveLastAttemptAt=Date.now();
     const p=readLiveSample();st.liveReadPromise=p;
     try{
      await p;st.liveReadSuccesses++;st.liveLastError=null;
     }finally{if(st.liveReadPromise===p)st.liveReadPromise=null}
    }
    st.consecutiveErrors=0;
   }catch(e){
    st.consecutiveErrors++;st.liveLastError=String(e.message||e);
    logging('ADC_S-Livefehler ('+st.consecutiveErrors+', Versuch '+st.liveReadAttempts+'): '+st.liveLastError);
    // One failure may be transient; two consecutive missing primary ADC replies
    // invalidate chip presence. Keep the SSP3 USB port open for manual recovery.
    if((st.consecutiveErrors>=2||e.code==='RAM_PROFILE_LOST')&&!st.writing&&!st.calTask&&!st.nvmWorking&&!st.powerCycleRunning){
     const resume=st.adapterKind==='ssp3'&&st.iface==='plc'&&st.uid?.hex&&
      st.uid.hex===lsGet('ssp3-auto-ram-uid')&&!st.manualLivePause;
     markSensorUnavailable(st.liveLastError);
     if(resume&&st.readerAlive)void reinitializeSensor();
    }else{
     show('adcMsg','Kommunikation zum Sensor wird überprüft. Erneuter Leseversuch läuft …','warn');
     renderStatus();
    }
   }finally{
    if(st.live&&st.port&&!st.closing){
     const interval=st.consecutiveErrors?2000:liveIntervalMs;
     st.timeout=setTimeout(loop,interval);
    }
    renderLiveOverview();
   }
  })()
 }
 function stopLive(){st.live=false;clearTimeout(st.timeout);st.timeout=null;renderStatus()}
 async function bootSnapshot(){if(!st.chip)throw Error('Chip nicht verbunden');const out={};for(const a of LOCKED)out[a]=await readReg(a);return out}
 function bootString(b){return LOCKED.map(a=>`${REG_NAMES[a]} 0x${h(a)} = 0x${h(b[a],2)} · gesperrt`).join('\n')}
 async function readBoot(){
  return withProgress('Bootregister werden gelesen',()=>readBootOperation());
 }
 async function readBootOperation(){try{const a=await bootSnapshot(),b=await bootSnapshot();if(!sameBoot(a,b))throw Error('Bootregister nicht stabil');st.boot=a;$('regdump').textContent=bootString(a);show('bootMsg','Bootregister zweifach gelesen. Boot-/Schnittstellenregister schreibgeschützt; NVM-Bereich nur im gesicherten Kalibrierablauf programmierbar.','success');return a}catch(e){st.boot=null;show('bootMsg','Bootregister-Prüfung fehlgeschlagen: '+e.message,'error');throw e}finally{renderStatus()}}
 async function registerDump(){
  return withProgress('Chipregister werden gelesen',()=>registerDumpOperation());
 }
 async function registerDumpOperation(){try{if(!st.chip&&!st.readOnlySensor)throw Error('Chip-Lesezugriff nicht bestätigt');const regs=[...LOCKED,0x14,0x16,0x18,0x1A,0x1C,0x1E,0x26,0x28,0x2A];for(const a of regs)st.regs[a]=await readReg(a);$('regdump').textContent=regs.map(a=>`0x${h(a)}  ${REG_NAMES[a]||'Register'}  0x${h(st.regs[a],2)} ${LOCKED.includes(a)?'GESCHÜTZT':''}`).join('\n');show('bootMsg','Diagnoseregister gelesen. Bootregister bleiben schreibgeschützt.','success')}catch(e){show('bootMsg','Registerlesen: '+e.message,'error')}}
 async function unlockRAM(){if(st.adapterKind==='bridge'){await exchange('PLC ACCESS',3500)}else if(st.iface==='plc'){await exchange('PLC P',3500);await exchange('PLC T',3500)}else {for(const w of [0xF75A,0x0CC7,0xD21E])await lowLevelWrite(0x22,w,true)}}
 async function lowLevelWrite(addr,word,forUnlock=false){if(!st.port||!st.afeWriteActive||!st.chip)throw Error('AFE-Schreibzugriff nur während expliziter RAM-Übernahme zulässig');if(addr!==R_AFE&&!(addr===R_BRIDGE&&st.bridgeWriteAllowed)&&!(forUnlock&&addr===0x22))throw Error('Nur freigegebene AFE0/AFE1-RAM-Bits und RAM-Freigabecookies zulässig');if(addr===0x22&&!([0xF75A,0x0CC7,0xD21E].includes(word)))throw Error('Nicht erlaubtes CMD-Cookie');let cmd;if(st.iface==='plc'){if(addr!==R_AFE&&addr!==R_BRIDGE)throw Error('PLC nutzt PLC P / PLC T für RAM-Freigabe');cmd=P.plcWrite(addr,word,st.plcAddress)}else if(st.iface==='i2c'){cmd=P.i2cWrite(addr,word)}else{cmd=P.spiWrite(addr,word)}await exchange(cmd,2300)}
 async function commitGain(target){
  return withProgress('AFE-Einstellung wird geschrieben',()=>commitGainOperation(target));
 }
 async function commitGainOperation(target){
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
   await window.ELMOS_ARCHIVE?.event('afe_ram_changed',{before:originalWord,after:actual,AFE:{...target},supply:archiveVoltages()});
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
   await window.ELMOS_ARCHIVE?.ensureCalibration();
   demoPort?.setReference(p,temperature);
   const samples=await measureCalibrationSamples(name);
   const record={kind:which,name,pressure:p,temperature,...samples,at,gains:{...st.staged},unit:pressureUnit()};
   st.points[which]={v:record.adc_s,pressure:p,unit:record.unit,name,gains:{...st.staged},at};
   addCalPoint(record);
   await window.ELMOS_ARCHIVE?.event('calibration_point',{point:record,AFE:{...st.staged},supply:archiveVoltages()});
   refreshPoints()
  }catch(e){try{await window.ELMOS_ARCHIVE?.event('error',{stage:'calibration_point',which,message:e.message,rawSamples:e.rawSamples||null,spread:e.spread??null})}catch(_){}show('calMsg','Messung fehlgeschlagen: '+e.message,'error')}
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

 function draw(){const c=$('chart');if(!c||c.closest('[hidden]'))return;const d=window.devicePixelRatio||1,w=Math.round(c.clientWidth*d),h=Math.round(c.clientHeight*d);if(w<20)return;if(c.width!==w||c.height!==h){c.width=w;c.height=h}const g=c.getContext('2d');g.clearRect(0,0,w,h);
 const dark=document.documentElement.dataset.theme==='dark';const x0=55*d,y0=10*d,yh=h-20*d,y=v=>y0+(32768-v)/65536*(yh-y0);g.font=`${11*d}px sans-serif`;for(const v of [25000,0,-25000]){g.beginPath();g.strokeStyle=v?(dark?'#d9ab71':'#e3c9aa'):(dark?'#536e84':'#d7e4ef');g.setLineDash(v?[5*d,4*d]:[]);g.moveTo(x0,y(v));g.lineTo(w-8*d,y(v));g.stroke();g.setLineDash([]);g.fillStyle=dark?'#d7e5f0':'#74849a';g.fillText((v>0?'+':'')+v,5*d,y(v)+4*d)}if(st.trend.length<1)return;const left=Date.now()-60000,x=t=>x0+(w-x0-10*d)*Math.max(0,Math.min(1,(t-left)/60000));g.beginPath();g.strokeStyle=dark?'#9bddff':'#2867a6';g.lineWidth=2*d;st.trend.forEach((p,i)=>i?g.lineTo(x(p.x),y(p.y)):g.moveTo(x(p.x),y(p.y)));g.stroke()}
 function download(name,txt,mime='application/json'){let b=new Blob([txt],{type:mime}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=(demoEnabled?'DEMO_':'')+name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}
 const report=()=>({tool:'ELMOS E703.11 Kalibrierassistent v0.7.0',created:new Date().toISOString(),connection:demoEnabled?'Demo':st.port?'USB':'offline',hardwareValidated:false,unit:pressureUnit(),pointNames:{lower:pointName('lo'),upper:pointName('hi')},interface:st.iface,firmware:st.firmware,bootProtection:'Boot-/Werks-NVM-Schreiben gesperrt; kalibrierungsbezogenes User-NVM mit Bestätigung freigegeben',ramWriteActive:!!st.ramWriteScope,registers:st.regs,bootSnapshot:st.boot,chipUID:st.uid?.hex||null,expertOutput:st.expertOutputPlan,AFE:st.afe,gains:st.staged,low:st.points.lo,high:st.points.hi,verification:st.verify,calibrationPoints:st.calpoints,plannedCalibrationPointCount:calibrationPointCount(),requestedSamplesPerPoint:Number($('calSampleCount').value),requestedDSPOutputLimit:Number($('calDspLimit').value),coefficientFit:st.calfit,calRamVerified:st.calVerified,lastDSP:st.dsp,chipDiagnostic:st.chipDiag,lastPlcReply:st.lastPlcReply,displayRange:getActiveDSPRange(),nvmState:{backupVerified:st.nvmBackupVerified,programmed:st.nvmDone},samples:st.history.slice(-1500),trace:st.log});

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
   await window.ELMOS_ARCHIVE?.ensureCalibration();
   demoPort?.setReference(pr,t);
   const samples=await measureCalibrationSamples(name);
   const record={kind:'extra',slot,name,pressure:pr,unit:pressureUnit(),temperature:t,...samples,at:new Date().toISOString(),gains:{...st.staged}};
   addCalPoint(record);
   await window.ELMOS_ARCHIVE?.event('calibration_point',{point:record,AFE:{...st.staged},supply:archiveVoltages()});
   ca('calPointsMsg','Messpunkt '+(slot+1)+' mit '+samples.sampleCount+' Samples aufgenommen.','success');
   refreshPoints()
  }catch(e){try{await window.ELMOS_ARCHIVE?.event('error',{stage:'calibration_extra_point',slot,message:e.message,rawSamples:e.rawSamples||null,spread:e.spread??null})}catch(_){}ca('calPointsMsg','Messpunkt '+(slot+1)+': '+e.message,'error')}
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
    st.calfit=solution;st.calImage=null;st.calStaged=false;st.calVerified=false;st.calValidation=[];renderDSPLive();
    if(window.ELMOS_ARCHIVE?.active)void window.ELMOS_ARCHIVE.event('coefficient_fit',{solution,AFE:{...st.staged}}).catch(e=>show('calFitMsg','Archivfehler: '+e.message,'error'));
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
  const cmd=st.iface==='plc'?P.plcHostCommand(P.plcWrite(addr,word,st.plcAddress),st.plcHostFormat):st.iface==='i2c'?P.i2cWrite(addr,word):P.spiWrite(addr,word);
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
  return withProgress('NVM wird gelesen',progress=>nvmScanOperation(options, progress),true);
 }
 async function nvmScanOperation(options, progress){
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
   const session=st.sessionIndex,uid=st.uid?.hex;
   const before=await bootSnapshot();await ramGrant();const words=[];
   for(let i=0;i<64;i++){words.push(await nvmReadWord(i*2));progress.update('NVM wird gelesen',i+1,64);$('nvmProgress').textContent=`NVM lesen: ${i+1}/64`;$('backupProgress').textContent=`NVM: ${i+1} / 64 Wörter`}
   const crc=CAL.crc16(words);
   if(crc!==words[63])throw Error(`CRC16 im bestehenden NVM ungültig: berechnet 0x${h(crc,2)}, gelesen 0x${h(words[63],2)}. Programmierung nicht zulässig.`);
   const factoryCRC=CAL.crc8(words),factoryHigh=(words[15]>>>8);
   if(factoryCRC!==factoryHigh)throw Error(`Werks-CRC8 stimmt nicht: 0x${h(factoryCRC)} statt 0x${h(factoryHigh)}. Programmierung gesperrt.`);
   for(const index of [0,1,15,16,17,18,19,20,22,CAL.SVDD_INDEX,28,63])if(await nvmReadWord(index*2)!==words[index])throw Error('NVM bei Wiederholungslesung unstabil (Wort '+index+')');
   const after=await bootSnapshot();if(!sameBoot(before,after))throw Error('Bootregister haben sich beim NVM-Lesen verändert');
   st.nvmBackup=words;st.nvmBackupVerified=true;st.nvmBackupProof={session,uid,words};st.calImage=null;expert.refreshOutputReadOnly();expert.refreshEEPROMViewer();
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
  return withProgress('Koeffizienten werden ins RAM geschrieben',()=>applyCalRamOperation(),true);
 }
 async function applyCalRamOperation(){
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
   st.calStaged=true;st.calVerified=false;st.calValidation=[];st.calImage=null;st.dsp=null;renderDSPLive();
   await window.ELMOS_ARCHIVE?.event('calibration_ram_written',{registerChanges:changes,verified:true,supply:archiveVoltages()});
   ca('calRamStageMsg',`${changes.length} DSP-Wörter ins RAM geschrieben und einzeln erfolgreich rückgelesen. Jetzt im nächsten Schritt DSP_S unabhängig prüfen.`,'success');
   ca('calRamMsg','DSP-Koeffizienten ins RAM übertragen. Bitte Prüfdruck einstellen und DSP_S kontrollieren.','warn');
  }catch(e){
   st.calStaged=false;st.calVerified=false;st.calImage=null;
   logging('DSP-RAM-Übernahme: '+e.message);
   ca('calRamStageMsg','RAM-Übernahme fehlgeschlagen: '+e.message,'error');
  }
  finally{if(st.calTask){await ramLock();st.ramWriteScope=null;st.calTask=false;st.writing=false}renderStatus();if(!st.manualLivePause&&st.chip&&!st.nvmWorking)startLive()}
 }
 async function verifyCalRam(slot=0){
  return withProgress('DSP-Prüfwert wird gelesen',()=>verifyCalRamOperation(slot));
 }
 async function verifyCalRamOperation(slot){
  let isChecking=false;
  try{
   if(!st.calStaged||!coefficientSettingsCurrent()||!st.chip||st.calTask||st.writing)throw Error('Koeffizienten zuerst im RAM übernehmen / anderer Vorgang läuft');
   const required=verificationRequiredCount();
   if(!Number.isFinite(required))throw Error('Anzahl Prüfpunkte: Bitte eine ganze Zahl zwischen 1 und 10 eingeben');
   if(slot>=required)throw Error('Prüfpunkt ist nicht ausgewählt');
   const [pressure,temperature]=verificationRows()[slot].querySelectorAll('input');
   const p=pressure.valueAsNumber,temp=temperature.valueAsNumber,pmin=Number($('pmin').value),pmax=Number($('pmax').value),tol=Number($('calVerifyTolerance').value);
   if(!Number.isFinite(p)||!(p>pmin&&p<pmax)||!Number.isFinite(tol)||tol<=0)throw Error('Prüfdruck innerhalb des Kalibrierbereichs und positive Toleranz eingeben');
   if(!Number.isFinite(temp)||temp< -40||temp>125)throw Error('Prüftemperatur zwischen −40 und 125 °C eingeben');
   if(st.calValidation.some(point=>point.slot!==slot&&Math.abs(point.pressure-p)<=(pmax-pmin)*0.10))
    throw Error('Prüfdruck muss mehr als 10 % der Messspanne von bestätigten Prüfpunkten entfernt sein');
   st.calTask=true;isChecking=true;
   renderVerificationRows(required);
   if(st.liveReadPromise)await st.liveReadPromise.catch(()=>{});
   const outputLimit=st.calfit.outputLimit??32000;
   demoPort?.setReference(p,temp);
   const got=P.sign16(await readReg(0x30)),target=2*outputLimit*(p-pmin)/(pmax-pmin)-outputLimit;
   updateDSP(got,'usb');
   const stat=await readReg(0x32),delta=got-target,errorBar=delta/(2*outputLimit)*(pmax-pmin);
   if(stat&(1<<10))throw Error('DSP-Sättigung erkannt (STATUS_SYNC.dsp_sat). Programmierung gesperrt.');
   await window.ELMOS_ARCHIVE?.event('verification_attempt',{slot,pressure:p,temperature:temp,dspS:got,dspTarget:target,statusSync:stat,pressureDeviation:errorBar,tolerance:tol,pass:Math.abs(errorBar)<=tol,supply:archiveVoltages()});
   if(Math.abs(errorBar)>tol){
    st.calValidation=[];st.calVerified=false;st.calImage=null;
    $('calVerifyList').textContent='Prüfung fehlgeschlagen. Bisherige Prüfpunkte verworfen; alle erneut prüfen.';
    throw Error(`DSP_S ${got}: Abweichung ${errorBar.toFixed(4)} ${pressureUnit()} über Toleranz ${tol} ${pressureUnit()}`)
   }
   const measuredTemp=P.sign16(await readReg(0x2E));
   if(required!==verificationRequiredCount()||tol!==Number($('calVerifyTolerance').value))
    throw Error('Prüfeinstellungen wurden während der Messung geändert');
   st.calValidation=st.calValidation.filter(point=>point.slot!==slot);
   st.calValidation.push({slot,pressure:p,actual:got,expected:target,errorBar,temperature:temp,measuredTemp});
   st.calValidation.sort((a,b)=>a.slot-b.slot);
   const pointsReady=st.calValidation.length>=required;
   const temperatureValidation=st.calfit.orderT===0||(
    st.calValidation.length>=2
    &&(Math.max(...st.calValidation.map(x=>x.temperature))-Math.min(...st.calValidation.map(x=>x.temperature)))>=10
    &&st.calValidation.every(x=>Number.isFinite(x.temperature)&&Math.abs(x.measuredTemp-(387.88*x.temperature-16485))<=Math.max(100,tol*2*outputLimit/(pmax-pmin)))
   );
   st.calVerified=pointsReady&&temperatureValidation;
   st.calImage=null; // Nach jeder neuen Prüfung muss der NVM-Plan neu erstellt werden.
   $('calVerifyList').textContent=st.calValidation.map(v=>(v.slot+1)+'. '+v.pressure+' '+pressureUnit()+' · DSP_S '+v.actual+' · Abweichung '+v.errorBar.toFixed(5)+' '+pressureUnit()).join('\n');
   const remaining=Math.max(0,required-st.calValidation.length);
   const info=st.calVerified?
    (required===1?'Ein Prüfpunkt bestanden. NVM-Schritt freigegeben; der übrige Druckbereich wurde nicht verifiziert.':'Alle '+required+' Prüfpunkte bestanden. NVM-Schritt freigegeben.'):
    (remaining>0?'Noch '+remaining+' unabhängige Prüfpunkte erforderlich.':'Die Prüfpunkte sind erfasst, aber die Temperaturverifikation ist noch nicht vollständig.');
   ca('calRamMsg',`DSP_S ${got} · Soll ${target.toFixed(1)} Digits · Fehler ${errorBar.toFixed(5)} ${pressureUnit()} · ${st.calValidation.length}/${required} Prüfpunkte. ${info}`,st.calVerified&&required>1?'success':'warn');
  }catch(e){st.calVerified=false;st.calImage=null;try{await window.ELMOS_ARCHIVE?.event('error',{stage:'dsp_verification',slot,message:e.message})}catch(_){}ca('calRamMsg','DSP-Verifikation: '+e.message,'error')}
  finally{if(isChecking)st.calTask=false;renderFlowState()}
 }
 function requestedNvmUserId(){
  const value=$('nvmUserId').value.trim();
  if(!value)return undefined;
  if(!/^(?:0x)?[0-9a-f]{1,4}$/i.test(value))throw Error('USER-ID: 1 bis 4 Hex-Ziffern eingeben, z. B. 00AF');
  return Number.parseInt(value,16);
 }
 async function readNvmBridgeSupply(expectedWord){
  const ram=await readReg(R_BRIDGE);
  const code=bridgeSupplyCode(ram);
  if(!BRIDGE_SUPPLY_ORDER.includes(code)||code!==bridgeSupplyCode(expectedWord))
   throw Error('Brückenspannung im RAM nicht bestätigt. AFE erneut lesen und Kalibrierung prüfen.');
  return code;
 }
 async function prepareNvm(){
  return withProgress('NVM-Änderungsliste wird vorbereitet',()=>prepareNvmOperation());
 }
 async function prepareNvmOperation(){
  try{
   if(st.calTask||st.writing||st.nvmWorking)throw Error('Anderer Chipvorgang läuft');
   if(!coefficientSettingsCurrent()||!verificationComplete()||!st.calStaged)throw Error('Zuerst DSP-RAM-Kalibrierung mit allen gewählten Prüfpunkten erfolgreich abschliessen');
   if(!hasCurrentNvmBackup())await nvmScan({preview:true});
   if(!hasCurrentNvmBackup())throw Error('Kein vollständig geprüftes NVM für die aktuell verbundene Chip-UID verfügbar');
   const startup=CAL.oneWireStartupStatus(st.nvmBackup);
   if(!startup.ok)throw Error('1-Wire-Startfenster nicht sicher: '+startup.errors.join('; '));
   if(startup.requiresCookie&&!(st.powerCycleResult?.readVerified&&st.powerCycleResult.verifiedUid===st.uid.hex)&&!psscRecoveryProven())
    throw Error('One-Wire-Startfenster '+startup.windowLabel+' vorhanden, Magic-Cookie-Start am aktuellen Chip nicht bestätigt. Kein NVM-Schreiben.');
   const recovery=st.psscRamRecovery||(st.regs[0x06]===0x6C04&&st.nvmBackup[17]!==0x6C04);
   if(recovery&&['on','off'].includes(st.expertOutputPlan?.clipping?.mode))
    throw Error('Clipping kann in einer One-Wire-RAM-Recovery-Sitzung nicht gespeichert werden');
   const bridgeSupply=await readNvmBridgeSupply(st.afe0);
   const image=CAL.configFrom(st.nvmBackup,st.calfit,st.afe??0x800,{
    output:recovery?null:st.expertOutputPlan,bridgeSupply,userId:requestedNvmUserId()
   });
   if(st.adapterKind==='bridge'&&image.changes.some(c=>c.index===CAL.SVDD_INDEX))
    throw Error('Brückenspannung dauerhaft speichern wird derzeit nur mit SSP3 unterstützt.');
   const recoveryBlock=psscNvmBlock(image.before,image.after);
   if(recoveryBlock)throw Error(recoveryBlock);
   if(image.changes.some(c=>(c.index<28&&![16,22,CAL.SVDD_INDEX].includes(c.index))||c.index===29))throw Error('Unzulässiges NVM-Register im Änderungsplan');
   if(!image.changes.length)throw Error('Keine NVM-Änderungen nötig');
   st.calImage=image;
   $('nvmDiff').textContent=image.changes.map(c=>{
    const raw=`NVM 0x${h(c.address)} [${c.index}] 0x${h(c.from,2)} → 0x${h(c.to,2)}`;
    if(c.index===30)return 'USER-ID · '+raw;
    if(c.index!==CAL.SVDD_INDEX)return raw;
    const voltages=['2,4 V','1,6 V','2,0 V','reserviert'];
    return 'Brückenspannung: '+voltages[bridgeSupplyCode(c.from)]+' → '+voltages[bridgeSupplyCode(c.to)]+' · '+raw;
   }).join('\n');
   ca('nvmMsg',image.changes.length+' von 64 NVM-Wörtern werden verändert (CRC16 zuletzt). Factory-/Bootschutz geprüft.'+
     (verificationRequiredCount()===1?' Nur ein unabhängiger DSP-Prüfpunkt wurde verifiziert.':'')+
     (recovery?' Nur Kalibrierdaten werden gespeichert. Ausgangs- und One-Wire-Einstellungen bleiben erhalten.':''),'warn');
   $('nvmProgress').textContent='NVM gelesen · Änderungsliste bereit';
  }catch(e){
   st.calImage=null;
   ca('nvmMsg','Vorbereitung fehlgeschlagen: '+e.message,'error');
  }finally{renderFlowState()}
 }
 async function nvmProgram(){
  return withProgress('NVM wird programmiert',progress=>nvmProgramOperation(progress),true);
 }
 async function nvmProgramOperation(progress){
  if(st.nvmWorking||st.writing)return;
  let chipProgrammingStarted=false;
  try{
   const restoring=!!(expert.restoreReady()&&st.calImage===st.restorePlan),outputOnly=!!(expert.outputReady()&&st.calImage===st.outputOnlyPlan);
   if(st.iface!=='plc')throw Error('1-Wire-Startschutz: NVM darf ausschliesslich über eine bestätigte 1-Wire-Verbindung programmiert werden. Neu über 1-Wire verbinden.');
   if(st.mode!=='usb'||!st.chip||!st.port||!st.nvmBackupVerified||!st.calImage||(!restoring&&!outputOnly&&!verificationComplete()))throw Error('Hardware, Sicherungen oder Kalibrierverifikation fehlen');
   const id=st.uid?.hex;
   if(!id||st.uid.ser0!==st.nvmBackup[0]||st.uid.ser1!==st.nvmBackup[1])throw Error('48-Bit-Chip-UID muss vor dem Schreiben verifiziert werden');
   const initial=st.calImage.before,modified=st.calImage.after;
   const recoveryBlock=psscNvmBlock(initial,modified,restoring,outputOnly);
   if(recoveryBlock)throw Error(recoveryBlock);
   const allowSvdd=!restoring&&!outputOnly;
   if(st.adapterKind==='bridge'&&modified[CAL.SVDD_INDEX]!==initial[CAL.SVDD_INDEX])
    throw Error('Brückenspannung dauerhaft speichern wird derzeit nur mit SSP3 unterstützt.');
   CAL.protectStartupCommunication(initial,modified,{allowSvdd});
   const startup=CAL.oneWireStartupStatus(initial);
   if(startup.requiresCookie&&!(st.powerCycleResult?.readVerified&&st.powerCycleResult.verifiedUid===id)&&!psscRecoveryProven())
    throw Error('1-Wire-Startschutz: Cookie-Start für die aktuelle Chip-UID nicht verifiziert. NVM-Schreiben gesperrt.');
   if(CAL.crc16(initial)!==initial[63]||CAL.crc16(modified)!==modified[63])throw Error('CRC16-Prüfung fehlgeschlagen');
   if(!restoring&&!outputOnly&&st.calfit.stats.maxDigits>100)throw Error('Fitfehler zu gross (>100 Digits)');
   if(!restoring&&!outputOnly&&modified[30]!==(requestedNvmUserId()??initial[30]))
    throw Error('USER-ID wurde geändert. Änderungsliste erneut vorbereiten.');
   const allowedNormal=new Set([16,22,CAL.SVDD_INDEX,28,30,31,32,33,34,...Array.from({length:16},(_,i)=>35+i),51,52,53,54,57,58,59,60,63]);
   if(st.calImage.changes.some(c=>restoring?(c.index<28||c.index>63):outputOnly?![16,22,57,58,59,60,63].includes(c.index):!allowedNormal.has(c.index)))throw Error('Unzulässige NVM-Änderung');
   if(restoring){
    for(let i=0;i<28;i++)if(modified[i]!==initial[i])throw Error('Factory-/Bootbereich weicht beim Restore ab');
   }else if(outputOnly||st.calImage.changes.some(c=>[16,22,57,58,59,60].includes(c.index))){
    if(!st.expertOutputPlan)throw Error('AODO-NVM-Änderung ohne geprüften Expertenvorschlag');
    const expected=CAL.prepareOutputConfig(initial,st.expertOutputPlan,outputOnly?st.outputOnlyPlan.limit:st.calfit.outputLimit);
    for(const i of [16,22,57,58,59,60])if(modified[i]!==expected[i])throw Error('Ausgangsregister entspricht nicht dem geprüften Vorschlag');
   }
   if(!window.ELMOS_ARCHIVE?.active||!['calibration','output'].includes(window.ELMOS_ARCHIVE.current?.type))
    throw Error('Für das NVM-Schreiben zuerst ein Kalibrier- oder Ausgangsprotokoll im Archiv starten. Danach die NVM-Änderungsliste erneut vorbereiten.');
   await window.ELMOS_ARCHIVE?.event('nvm_before',{uid:id,words:initial,plannedWords:modified,changes:st.calImage.changes,supply:archiveVoltages()});
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
   const version=await readReg(0x38),ser0=await readReg(0x50),ser1=await readReg(0x52);
   if(h(version,2)+h(ser1,2)+h(ser0,2)!==id)throw Error('Chip-UID hat sich seit der Vorschau geändert');
   const beforeBoot=await bootSnapshot();
   if(allowSvdd)await readNvmBridgeSupply(modified[CAL.SVDD_INDEX]);
   await ramGrant();
   const verifyWords=st.psscRamRecovery?Array.from({length:64},(_,i)=>i):[0,1,16,17,18,19,20,21,22,23,CAL.SVDD_INDEX,28,63];
   for(const i of verifyWords){
    const check=await nvmReadWord(i*2);
    if(check!==initial[i]){
     st.nvmBackup=null;st.nvmBackupVerified=false;st.calImage=null;
     throw Error(`Chip-NVM hat sich seit dem Backup verändert (Index ${i}). Änderungsliste erneut vorbereiten.`);
    }
   }
   const finalRecoveryBlock=psscNvmBlock(initial,modified,restoring,outputOnly);
   if(finalRecoveryBlock)throw Error(finalRecoveryBlock);
   CAL.protectStartupCommunication(initial,modified,{allowSvdd});
   for(let i=0;i<28;i++)if(modified[i]!==initial[i]&&(restoring||![16,22,...(allowSvdd?[CAL.SVDD_INDEX]:[])].includes(i)))throw Error('Boot-/Werksbereich verändert');
   // Only USER region access is authorized; NEVER unlock factory calibration area.
   for(const x of [0x98BD,0x25BF,0x36D8])await maintWrite(0x4E,x);
   const status=await readReg(0x46);if(!(status&8))throw Error('NVM User-Bereich nicht freigegeben (CM_STATUS.ep_en=0)');
   const changes=st.calImage.changes.slice().sort((a,b)=>a.index===63?1:b.index===63?-1:a.index-b.index);
   let done=0;for(const c of changes){
    if(c.index<16||c.index>63)throw Error('Werksbereich gesperrt');
    await maintWrite(0x4A,c.to);chipProgrammingStarted=true;await maintWrite(0x4E,0xA300|c.address);
    const flags=await nvmWaitIdle(18000);if(flags&(1<<6))throw Error('CM_STATUS.crc_error während NVM-Programmierung');
    const chk=await nvmReadWord(c.address);if(chk!==c.to)throw Error(`NVM-Verify 0x${h(c.address)}: Ist 0x${h(chk,2)} Soll 0x${h(c.to,2)}`);
    done++;progress.update('NVM wird geschrieben und geprüft',done,changes.length);$('nvmProgress').textContent=`Geschrieben und verifiziert ${done}/${changes.length}`;
   }
   await maintWrite(0x4E,0x0000);
   await maintWrite(0x4E,0x8800);await nvmWaitIdle(15000);
   const after=[];
   for(let i=0;i<64;i++){after.push(await nvmReadWord(i*2));progress.update('NVM wird rückgelesen',i+1,64);}
   if(after.some((x,i)=>x!==modified[i]))throw Error('Abschliessender 64-Wort-NVM-Vergleich fehlgeschlagen');
   if(CAL.crc16(after)!==after[63])throw Error('Abschliessende NVM-CRC16-Prüfung fehlgeschlagen');
   const cm=await readReg(0x46);if(cm&(1<<6))throw Error('Chip meldet CM CRC Fehler');
   if(!sameBoot(beforeBoot,await bootSnapshot()))throw Error('Bootregister nach Programmierung abweichend');
   st.nvmDone=true;st.nvmBackup=after;st.nvmBackupVerified=true;
   try{await window.ELMOS_ARCHIVE?.event('nvm_after',{uid:id,words:after,crc16:after[63],verified:true})}
   catch(archiveError){logging('KRITISCH: NVM erfolgreich geschrieben, Archiv-Export fehlgeschlagen: '+archiveError.message);ca('backupMsg','NVM erfolgreich verifiziert, aber der Archivordner ist nicht beschreibbar! Bitte unmittelbar NVM-Backup exportieren.','error')}st.calImage=null;st.restorePlan=null;st.outputOnlyPlan=null;if(saveOldNvm)expert.afterNvmScan();lsSet('elmos8-last-program',JSON.stringify({id,words:after,ts:new Date().toISOString(),restore:restoring}));
   ca('nvmMsg',restoring?'Backup-Wiederherstellung abgeschlossen, NVM rückgelesen und CRC16 bestätigt. Sensor neu starten und erneut prüfen.':outputOnly?'AODO-Ausgangseinstellungen dauerhaft gespeichert, NVM rückgelesen und CRC16 bestätigt. Sensor neu starten und Ausgabefunktion prüfen.':'NVM-Programmierung und vollständiges Rücklesen/CRC16 erfolgreich. Sensor neu starten und Schnittstelle erneut prüfen.','success');
  }catch(e){try{await window.ELMOS_ARCHIVE?.event('error',{stage:'nvm_program',programmingStarted:chipProgrammingStarted,message:e.message})}catch(_){}ca('nvmMsg',`NVM-Vorgang fehlgeschlagen: ${e.message}.${chipProgrammingStarted?' NVM-Schreibversuch wurde bereits begonnen: Chip nicht unkontrolliert neu starten, Backup und Diagnose sichern!':' Es wurden keine NVM-Schreibbefehle gestartet.'}`,'error');logging('NVM FEHLER: '+e.message)}
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
  return withProgress('NVM nach Neustart wird geprüft',()=>postBootCheckOperation(automatic),true);
 }
 async function postBootCheckOperation(automatic){
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
     else await bridgeAccess({power:true});
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
   const actualSvdd=bridgeSupplyCode(await readReg(R_BRIDGE));
   if(actualSvdd!==bridgeSupplyCode(expected.words[CAL.SVDD_INDEX]))
    throw Error('Brückenspannung im RAM stimmt nach dem Neustart nicht mit dem NVM überein');
   await readADC();
   const success='NVM nach Neustart vollständig rückgelesen. Chip-ID, CRC8, CRC16, Bootregister und Brückenspannung stimmen.';
   await window.ELMOS_ARCHIVE?.event('post_boot_verified',{uid:st.uid?.hex,nvm:st.nvmBackup?.slice(),boot,svddCode:actualSvdd});
   reportBootCheck(success,'success');
   ca('nvmMsg',success,'success');
  }catch(e){try{await window.ELMOS_ARCHIVE?.event('error',{stage:'post_boot_check',message:e.message})}catch(_){}
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
    ' mV/V, PGA2 '+GAINS2[st.staged.pga2]+'×.'+
    (Number.isInteger(proposed.bridgeSupply)?' Brückenspannung SVDD '+BRIDGE_VOLTAGES[proposed.bridgeSupply].toFixed(1)+' V.':'')+
    ' Erst nach bestätigter RAM-Rücklesung werden die Vorgaben aktiv.';
  }
 }
 function configFromUi(include,matrix=null){
  // Save the actual currently confirmed AFE settings, never a pending failed import.
  const p=st.staged;
  const cf=ELMOS_CONFIG.createSelective({
   label:$('configLabel').value.trim()||'Standardprofil',
   afe:{pga1:p.pga1,pga2:p.pga2,offset:p.offset,
    ...(Number.isInteger(st.afe0)&&bridgeSupplyCode(st.afe0)<3?
      {bridgeSupply:bridgeSupplyCode(st.afe0)}:{})},
   calibration:{
    sOrder:matrix?.orderS??Number($('calSOrder').value),tOrder:matrix?.orderT??Number($('calTOrder').value),
    dspLimit:Number($('calDspLimit').value),pointCount:matrix?.total??Number($('calPointCount').value),
    ...(matrix?{matrix:{p:matrix.pCount,temp:matrix.tCount,temperatures:matrix.temperatures}}:{}),
    samples:Number($('calSampleCount').value),
    reference:{min:Number($('pmin').value),max:Number($('pmax').value),
     unit:$('calUnit').value,customUnit:$('calUnitOther').value.trim()}
   },
   output:{mode:$('expertOutputMode').value,scaleEnabled:$('expertScaleEnable').checked,
    vdd:Number($('psscVdd').value),s0:Number($('psscS0').value),s1:Number($('psscS1').value),
    gain:Number($('expertScaleGain').value),offset:Number($('expertScaleOffset').value),
    pwmPeriod:Number($('expertPwmPeriod').value),
    clipping:{mode:['1','2','3'].includes($('expertOutputMode').value)?$('outputClippingMode').value:'keep',
     low:$('outputClipLow').valueAsNumber,high:$('outputClipHigh').valueAsNumber}}
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
   '':
   !selected.length?'Bitte mindestens eine Einstellungsgruppe für den Import auswählen.':
   hasAfe?'AFE wird beim Übernehmen ins Sensor-RAM geschrieben.':'';
 }
 function resetConfigImportSelection(profile,editing=false){
  const available=new Set(profile?configIncluded(profile):[]);
  for(const [group,id] of Object.entries(CONFIG_GROUP_CONTROLS)){
   const checkbox=$(id);
   const present=available.has(group);
   checkbox.checked=profile?present:editing;
   checkbox.disabled=!present&&!editing;
   checkbox.closest('label').hidden=!present&&!editing;
  }
  $('configGroups').hidden=!editing;
  $('configLabel').closest('label').hidden=!editing;
  $('configSave').hidden=!editing;
  $('configPresetDelete').hidden=!editing;
  $('configImportEffect').hidden=editing||!profile;
  $('configGroupsLegend').textContent=editing?'Gruppen für das Preset':'Im Preset oder in der Datei enthalten';
  $('configPresetSave').hidden=!editing;
  $('configPresetCancel').hidden=!editing;
  $('configPresetEdit').hidden=editing;
  $('configApply').hidden=editing||!profile;
  showConfigImportEffect(profile);
 }
 for(const id of Object.values(CONFIG_GROUP_CONTROLS))
  $(id).addEventListener('change',()=>showConfigImportEffect(selectedConfig));
 resetConfigImportSelection(null);
 const presetKey='elmos-sensor-presets-v1';
 const presetSelect=$('configPreset');
 function readPresets(){
  const raw=lsGet(presetKey);
  const entries=raw?JSON.parse(raw):[];
  if(!Array.isArray(entries))throw Error('Gespeicherte Presets sind ungültig');
  return entries;
 }
 function renderPresets(entries,selected=''){
  presetSelect.replaceChildren(new Option('Preset auswählen …',''));
  entries.forEach(profile=>presetSelect.add(new Option(profile.label,profile.label)));
  presetSelect.value=selected;
  $('configPresetDelete').disabled=!presetSelect.value;
 }
 function savePresets(entries){
  const data=JSON.stringify(entries);
  lsSet(presetKey,data);
  if(lsGet(presetKey)!==data)throw Error('Browserspeicher konnte nicht aktualisiert werden');
 }
 function previewPreset(profile){
  selectedConfig=profile;
  $('configLabel').value=profile.label;
  resetConfigImportSelection(profile);
  $('configPreview').hidden=true;
 }
 try{renderPresets(readPresets())}catch(e){show('configPreview',e.message,'error')}
 $('configPresetCancel').addEventListener('click',()=>resetConfigImportSelection(selectedConfig));
 $('configPresetEdit').addEventListener('click',()=>{
  const checked=configSelectedGroups();
  resetConfigImportSelection(selectedConfig,true);
  if(selectedConfig)for(const [group,id] of Object.entries(CONFIG_GROUP_CONTROLS))$(id).checked=checked.includes(group);
  $('configLabel').focus();
 });
 $('configPresetSave').addEventListener('click',()=>{
  try{
   const groups=configSelectedGroups();
   if(groups.includes('afe')&&(!st.chip||!Number.isInteger(st.afe)))
    throw Error('Für AFE zuerst den Sensor verbinden und auslesen oder AFE abwählen.');
   const profile=configFromUi(groups,window.ELMOS_GUIDED?.planForPreset?.()),entries=readPresets();
   const index=entries.findIndex(item=>item.label===profile.label);
   if(index>=0){
    if(!window.confirm('Preset «'+profile.label+'» mit den aktuellen Einstellungen ersetzen?'))return;
    entries[index]=profile;
   }else entries.push(profile);
   savePresets(entries);
   $('configFile').value='';
   renderPresets(entries,profile.label);
   previewPreset(profile);
   show('configPreview','Preset «'+profile.label+'» gespeichert.','success');
  }catch(e){show('configPreview','Preset konnte nicht gespeichert werden. '+e.message,'error')}
 });
 presetSelect.addEventListener('change',()=>{
  $('configPresetDelete').disabled=!presetSelect.value;
  selectedConfig=null;resetConfigImportSelection(null);
  if(!presetSelect.value){show('configPreview','Preset oder Config-Datei auswählen.');return;}
  try{
   const profile=readPresets().find(item=>item.label===presetSelect.value);
   $('configFile').value='';
   previewPreset(ELMOS_CONFIG.validate(profile,CAL));
  }catch(e){show('configPreview','Preset konnte nicht geladen werden. '+e.message,'error')}
 });
 $('configPresetDelete').addEventListener('click',()=>{
  const name=presetSelect.value;
  if(!name||!window.confirm('Preset «'+name+'» löschen?'))return;
  try{
   const entries=readPresets().filter(profile=>profile.label!==name);
   savePresets(entries);renderPresets(entries);
   selectedConfig=null;resetConfigImportSelection(null);
   show('configPreview','Preset «'+name+'» gelöscht.','success');
  }catch(e){show('configPreview',e.message,'error')}
 });
 $('configSave').addEventListener('click',()=>{
  try{
   const profile=configFromUi(ELMOS_CONFIG.GROUPS,window.ELMOS_GUIDED?.planForPreset?.());
   const fileName=ELMOS_CONFIG.fileName(profile,window.ELMOS_GUIDED?.appliedPlanForConfig?.());
   download(fileName,JSON.stringify(profile,null,2));
   show('configPreview','Config «'+profile.label+'» vollständig gespeichert als '+fileName+'. Alle fünf wiederverwendbaren Gruppen enthalten. Beim Import wählst du aus, welche übernommen werden. Keine UID, EEPROM-Daten, Messwerte oder DSP-Koeffizienten.','success');
  }catch(e){show('configPreview','Config konnte nicht gespeichert werden: '+e.message,'error')}
 });
 $('configFile').addEventListener('change',async()=>{
  selectedConfig=null;resetConfigImportSelection(null);
  const file=$('configFile').files?.[0];if(!file)return;
  const operation=beginOperation('Config-Datei wird geladen');
  try{
   if(file.size>65536)throw Error('Config-Datei ist zu gross (max. 64 kB)');
   const source=await file.text();
   const elmos=/\.(xml|hex)$/i.test(file.name);
   const profile=elmos?ELMOS_CONFIG.importElmos(source,file.name,CAL,P):
    ELMOS_CONFIG.validate(JSON.parse(source),CAL);
   presetSelect.value='';$('configPresetDelete').disabled=true;
   selectedConfig=profile;
   resetConfigImportSelection(profile);
   show('configPreview',(elmos?'Elmos-Datei geprüft. AFE und SVDD stehen zur Übernahme bereit.':'Datei geprüft – noch NICHT übernommen.')+'\n'+ELMOS_CONFIG.describe(profile)+
    '\nEs werden keine Messpunkte, Kalibrierkoeffizienten, EEPROM- oder Boot-/Kommunikationsdaten importiert.','success');
  }catch(e){selectedConfig=null;resetConfigImportSelection(null);show('configPreview','Config-Laden abgelehnt: '+e.message,'error')}
  finally{operation.finish()}
 });
 $('configApply').addEventListener('click',()=>applySelectedConfig());
 async function applySelectedConfig({rememberForSeries=true}={}){
  const button=$('configApply'),fileInput=$('configFile');
  const operation=beginOperation('Config wird übernommen',true);
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
   presetSelect.disabled=true;$('configPresetSave').disabled=true;$('configPresetDelete').disabled=true;
   for(const id of Object.values(CONFIG_GROUP_CONTROLS))$(id).disabled=true;
   // The click itself explicitly authorises the immediate AFE RAM transfer.
   // Existing commitGain checks the boot state and reads the written register back.
   if(target){
    show('configPreview','AFE-Übernahme läuft: PGA1/Offset/PGA2 und gegebenenfalls SVDD werden im RAM rückgelesen. Kein EEPROM-Schreiben.','warn');
    const gains={pga1:target.pga1,pga2:target.pga2,offset:target.offset};
    const ok=await commitGain(gains);
    if(!ok||!st.chip||!['pga1','pga2','offset'].every(k=>st.staged[k]===target[k])){
     st.profilePendingAFE={...target};profileSummary();
     throw Error('AFE-RAM-Übernahme nicht bestätigt. Chip prüfen und Config erneut übernehmen. Die anderen Einstellungen wurden nicht verändert.');
    }
    if(Number.isInteger(target.bridgeSupply)&&bridgeSupplyCode(st.afe0)!==target.bridgeSupply){
     const bridgeOk=await commitBridgeSupply(target.bridgeSupply);
     if(!bridgeOk||bridgeSupplyCode(st.afe0)!==target.bridgeSupply){
      st.profilePendingAFE={...target};profileSummary();
      throw Error('Brückenspannung aus dem Profil wurde nicht bestätigt. Chipzustand prüfen. Bereits übernommene PGA-Werte können im RAM aktiv sein; Messpunkte vorsorglich neu erfassen.');
     }
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
   show('configPreview','Config «'+profile.label+'» übernommen. '+
    (target?'AFE: Im Chip-RAM geschrieben und rückgelesen – Werte aktiv. ':'Keine AFE-Änderung am Chip. ')+
    'Keine EEPROM-Programmierung. '+(affectsCalibration?
     'Messpunkte und DSP-Koeffizienten für diesen Sensor neu aufnehmen.':
     'Bestehende Messpunkte und DSP-Koeffizienten wurden durch diesen reinen Ausgangsimport nicht verändert.'),'success');
   if(rememberForSeries)lsSet('elmos-series-preset-v1',JSON.stringify({profile,groups:included}));
   if(st.chip&&st.uid?.hex)seriesOfferKey=st.sessionIndex+':'+st.uid.hex;
   await window.ELMOS_ARCHIVE?.event('configuration_imported',{label:profile.label,include:included,version:profile.version,AFE:{...st.staged},supply:archiveVoltages()});
   document.dispatchEvent(new CustomEvent('elmos-config-applied',{detail:{included:included.slice(),version:profile.version,matrix:has('measurement')?values.measurement.matrix:null}}));
   return true;
  }catch(e){
   show('configPreview','Config-Übernahme fehlgeschlagen: '+e.message,'error');
   return false;
  }finally{
   operation.finish();
   fileInput.disabled=false;
   presetSelect.disabled=false;$('configPresetSave').disabled=false;$('configPresetDelete').disabled=!presetSelect.value;
   const available=new Set(selectedConfig?configIncluded(selectedConfig):[]);
   for(const [group,id] of Object.entries(CONFIG_GROUP_CONTROLS))
    $(id).disabled=!available.has(group);
   button.disabled=!selectedConfig||!configSelectedGroups().length;
  }
 }
 let seriesOfferKey=null;
 function stopSeriesPreset(){
  lsSet('elmos-series-preset-v1','');
  seriesOfferKey=null;
 }
 async function applySeriesConfig(profile,groups){
  renderPresets(readPresets(),profile.label);
  $('configFile').value='';
  previewPreset(profile);
  for(const [group,id] of Object.entries(CONFIG_GROUP_CONTROLS))$(id).checked=groups.includes(group);
  if(!await applySelectedConfig({rememberForSeries:false})){
   seriesOfferKey=null;
   throw Error($('configPreview').textContent);
  }
 }
 async function offerSeriesPreset(){
  if(demoEnabled||!st.chip||!st.uid?.hex)return;
  const port=st.port,uid=st.uid.hex,session=st.sessionIndex;
  const key=session+':'+uid;
  if(seriesOfferKey===key)return;
  const raw=lsGet('elmos-series-preset-v1');
  if(!raw)return;
  const saved=JSON.parse(raw);
  if(!Array.isArray(saved.groups))return;
  const profile=ELMOS_CONFIG.validate(saved.profile,CAL);
  const groups=configIncluded(profile).filter(group=>saved.groups.includes(group));
  if(!groups.length)return;
  seriesOfferKey=key;
  if(!window.confirm('Vorlage «'+profile.label+'» für diesen Sensor übernehmen?'+
     (groups.includes('afe')?' AFE wird ins Sensor-RAM geschrieben.':'')+
     ' Mit «Abbrechen» endet die automatische Vorlagenabfrage.')){
   stopSeriesPreset();
   return;
  }
  if(st.port!==port||!st.chip||st.closing||st.uid?.hex!==uid||st.sessionIndex!==session)
   throw Error('Sensorverbindung hat sich geändert.');
  await applySeriesConfig(profile,groups);
 }

 $('plcStartupLogExport').addEventListener('click',()=>{
  const log={
   tool:'ELMOS E703.11 – SSP3 Startdiagnose',version:'v0.7.13',at:new Date().toISOString(),
   source:'Web-App (NICHT PSSC Originalsoftware)',interface:st.iface,adapter:st.adapterKind,
    plcAddress:'0x'+h(st.plcAddress),plcAddressVerified:st.plcAddressVerified,
    plcAddressSource:st.plcAddressSource,plcAddressProbes:st.plcAddressProbes,psscRamRecovery:!!st.psscRamRecovery,
   firmware:st.firmware,port:serialPortInfo(st.port),chipDetected:!!st.chip,
   startupTrials:st.startupTrials,sessionStartedAt:st.sessionStartedAt,sessionIndex:st.sessionIndex,adapterNoReply:st.adapterNoReply,readerAlive:st.readerAlive,startupAttempts:st.startupAttempts,lastPlcReply:st.lastPlcReply,
   chipDiag:st.chipDiag,magicCookie:st.magicResult,powerCycle:st.powerCycleResult,powerHelp:st.powerHelp,plcHostFormat:st.plcHostFormat,
    liveDiagnostic:{active:st.live,attempts:st.liveReadAttempts,successes:st.liveReadSuccesses,
     failures:st.consecutiveErrors,lastError:st.liveLastError,lastAttemptAt:st.liveLastAttemptAt,
     lastADC:st.adc?.s??null,lastADCTime:st.adc?.time??null,plcEnabledInRam:st.powerCycleResult?.plcEnabledInRam??null,
     cfgPeriod:st.measurementPeriod,cfgPeriodMode:P.periodMode(st.measurementPeriod),status:st.measurementStatus,
     startCommandsSent:st.measurementStarts,adcChanges:st.measurementFreshCount,
     cookiePeriodAdjusted:st.powerCycleResult?.livePeriodAdjustedInRam??false,
     cookiePeriodBefore:st.powerCycleResult?.livePeriodBefore??null,
     lastADCChangedAt:st.measurementLastChangedAt,measurementError:st.measurementError},
    log:st.log.slice(-500),
   note:'Der Export enthält nur die Web-App-Befehle. Für einen Vergleich wird zusätzlich ein originaler PSSC-SSP3-Trace benötigt. Keine Sensorregister werden durch den Export verändert.'
  };
  download('E70311_SSP3_Web_Log_'+Date.now()+'.json',JSON.stringify(log,null,2));
  $('plcStartupState').textContent='Web-App-Protokoll gespeichert. Für die fehlende Initialisierung wird auch die Befehlsfolge der Originalsoftware benötigt.';
 });
 $('expertMode').addEventListener('change',renderStatus);
 $('plcMagicConfirm').addEventListener('change',renderStatus);

  $('plcPowerConfirm').addEventListener('change',renderStatus);
  $('plcHostFormat').addEventListener('change',()=>{
   if(st.chip||st.powerCycleRunning||st.startupRunning||st.magicRunning||st.nvmWorking||st.writing||st.calTask){
    $('plcHostFormat').value=st.plcHostFormat;
    return;
   }
   st.plcHostFormat=$('plcHostFormat').value;
   logging('PLC Host-Telegrammformat für nächsten Lese-/Power-Test: '+st.plcHostFormat);
  });

  $('plcPowerRun').addEventListener('click',()=>startSsp3WithBoundedRetry().catch(e=>{$('plcPowerState').textContent=e.message;logging(e.message);show('connMsg',e.message,'warn');}));
  $('plcPowerHelpRead').addEventListener('click',()=>readSsp3PowerHelp().catch(e=>{
   $('plcPowerHelpOutput').textContent='SSP3-Hilfe konnte nicht gelesen werden: '+e.message;
   logging('SSP3-Hilfe: '+e.message);
   show('connMsg','Firmwarehilfe fehlgeschlagen: '+e.message,'warn');
  }));
  $('plcMagicRun').addEventListener('click',()=>testPlcMagicCookie().catch(e=>{
   logging('Magic Cookie Test nicht gestartet: '+e.message);
   $('plcMagicState').textContent=e.message;
   show('connMsg',e.message,'warn');
  }));
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
 const firstVerifyRow=$('calVerifyRows').firstElementChild;
 for(let slot=1;slot<10;slot++){
  const row=firstVerifyRow.cloneNode(true);
  row.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
  const unit=row.querySelector('[data-cal-unit]');
  unit.previousSibling.textContent='Prüfpunkt '+(slot+1)+' (';
  row.querySelector('input').value='';
  row.querySelector('button').textContent='Punkt '+(slot+1)+' prüfen';
  $('calVerifyRows').append(row);
 }
 verificationRows().forEach((row,slot)=>{
  row.querySelector('button').addEventListener('click',()=>verifyCalRam(slot));
  row.querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>{
   if(!st.calValidation.some(point=>point.slot===slot))return;
   st.calValidation=st.calValidation.filter(point=>point.slot!==slot);
   st.calVerified=false;st.calImage=null;
   $('calVerifyList').textContent=st.calValidation.map(v=>(v.slot+1)+'. '+v.pressure+' '+pressureUnit()+' · DSP_S '+v.actual).join('\n')||'Noch kein Prüfpunkt aufgenommen.';
   renderFlowState();
  }));
 });
 for(const id of ['calVerifyCount','calVerifyTolerance'])$(id).addEventListener('input',()=>{
  st.calValidation=[];st.calVerified=false;st.calImage=null;
  $('calVerifyList').textContent='Noch kein Prüfpunkt aufgenommen.';
  ca('calRamMsg','Prüfeinstellungen geändert. Punkte erneut prüfen.','warn');
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
 $('nvmUserId').addEventListener('input',()=>{
  if(st.calImage&&st.calImage!==st.restorePlan&&st.calImage!==st.outputOnlyPlan){
   st.calImage=null;
   $('nvmDiff').textContent='USER-ID geändert. Änderungsliste erneut vorbereiten.';
   ca('nvmMsg','USER-ID geändert. NVM lesen und Änderungen erneut prüfen.','warn');
  }
  renderFlowState();
 });
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
 // Visual theme affects only presentation. Use persistent localStorage even in demo mode.
 const themeControl=$('settingsTheme');
 themeControl.value=document.documentElement.dataset.theme==='dark'?'dark':'light';
 themeControl.addEventListener('change',()=>{
  const selected=themeControl.value==='dark'?'dark':'light';
  document.documentElement.dataset.theme=selected;
  try{localStorage.setItem('elmos-ui-theme-v1',selected)}catch(_){}
  draw(); // Repaint ADC chart axes/trace for the chosen palette.
  $('settingsMsg').textContent=selected==='dark'?
   'Darkmode aktiviert. Die Auswahl bleibt lokal gespeichert.':
   'Heller Modus mit höherem Kontrast aktiviert. Die Auswahl bleibt lokal gespeichert.';
 });
 // Optional post-measurement UI: default OFF, locally remembered per browser.
 const verificationPreferenceKey='elmos-show-verification-v1';
 const verificationSetting=$('settingsVerificationEnabled');
 function applyVerificationVisibility(enabled){
  const visible=enabled===true;
  verificationSetting.checked=visible;
  $('verificationOpen').hidden=!visible;
  $('verificationOpen').setAttribute('aria-hidden',String(!visible));
 }
 applyVerificationVisibility(lsGet(verificationPreferenceKey)==='1');
 verificationSetting.addEventListener('change',()=>{
  const enabled=verificationSetting.checked;
  if(!enabled&&window.ELMOS_ARCHIVE?.current?.type==='verification'){
   applyVerificationVisibility(true);
   $('settingsMsg').textContent='Die Nachmessung läuft noch. Bitte den Prüfablauf zuerst abschliessen oder abbrechen.';
   return;
  }
  applyVerificationVisibility(enabled);
  lsSet(verificationPreferenceKey,enabled?'1':'0');
  if(!enabled&&window.ELMOS_ARCHIVE?.view==='verification')window.ELMOS_ARCHIVE.close();
  $('settingsMsg').textContent=enabled?
   'Nachmessung aktiviert: Der Button ist in der oberen Navigation sichtbar.':
   'Nachmessung deaktiviert: Der Button ist ausgeblendet.';
 });
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
 const confirmedSsp3Baud=lsGet('ssp3-confirmed-baud');
 if(!demoEnabled&&$('adapterType').value==='ssp3'&&
    Array.from($('baud').options).some(option=>option.value===confirmedSsp3Baud))
  $('baud').value=confirmedSsp3Baud;
 $('startRamMeasurement').addEventListener('click',()=>startRamMeasurement(true));
 $('choose').addEventListener('click',()=>choose());$('auto').addEventListener('click',()=>auto());$('disconnect').addEventListener('click',()=>{reconnectSsp3OnUsb=false;return disconnect()});$('sensorReconnectButton').addEventListener('click',()=>st.adapterNoReply?reopenSsp3Port():reinitializeSensor());
 $('sensorReconnectExport').addEventListener('click',()=>$('plcStartupLogExport').click());
 for(const [id,step] of [['brSupplyDown',-1],['brSupplyUp',1]]){
  $(id).addEventListener('click',()=>{
   const index=BRIDGE_SUPPLY_ORDER.indexOf(bridgeSupplyCode(st.afe0));
   const next=BRIDGE_SUPPLY_ORDER[index+step];
   if(index<0||next===undefined||$(id).disabled)return;
   commitBridgeSupply(next).catch(e=>show('writeMsg',e.message,'error'));
  });
 }
 $('brSupplyRead').addEventListener('click',()=>refreshBridgeSupply());
 $('readNow').addEventListener('click',()=>withProgress('ADC-Werte werden gelesen',()=>readADC()).catch(e=>show('adcMsg','ADC: '+e.message,'error')));$('live').addEventListener('click',()=>{if(st.live){st.manualLivePause=true;stopLive()}else{st.manualLivePause=false;startLive()}});
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
 }else if(!navigator.serial||!window.isSecureContext){show('connMsg','Für echte USB-Kommunikation Chrome Desktop über HTTPS oder localhost nutzen. Ohne USB-Verbindung ist kein Sensorzugriff möglich.','warn');$('choose').disabled=true;$('auto').disabled=true;}else{
  navigator.serial.addEventListener('connect',async event=>{
   if(!reconnectSsp3OnUsb||$('adapterType').value!=='ssp3'||event.target.getInfo?.().usbVendorId!==0x0403)return;
   if(st.port){
    if(st.readerAlive||st.closing||!st.adapterNoReply)return;
    if(!await disconnect())return;
   }
   if(!st.port&&reconnectSsp3OnUsb)await auto();
  });
  setTimeout(()=>auto().catch(()=>{}),350);
 }
 const expert=ELMOS_EXPERT.init({st,CAL,readReg,nvmScan,download,show,stopLive,startLive,lsGet,lsSet,renderFlowState,verificationComplete,withProgress});
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

 // The logger reserves the read-only measurement path for its entire session.
 let logResumeLive=false;
 async function archiveStartTelemetry(){
  if(!st.port||!st.chip||st.calTask||st.writing||st.nvmWorking||st.testLogging)
   throw Error('Sensor ist nicht frei für eine Log-Aufzeichnung.');
  logResumeLive=!!st.live&&!st.manualLivePause;
  stopLive();
  if(st.liveReadPromise)await st.liveReadPromise.catch(()=>{});
  if(!st.port||!st.chip)throw Error('Sensor während Startvorbereitung getrennt');
  st.testLogging=true;st.calTask=true;
  renderFlowState();
 }
 function archiveStopTelemetry(){
  const resume=logResumeLive;
  logResumeLive=false;
  if(!st.testLogging)return;
  st.testLogging=false;st.calTask=false;
  renderFlowState();
  if(resume&&st.port&&st.chip&&!st.manualLivePause)startLive();
  else renderStatus();
 }
 // Archive bridge: read-only data acquisition; the original NVM write gates stay unchanged.
 function archiveVoltages(){
  const chosenVdd=Number($('psscVdd').value),s0=Number($('psscS0').value),s1=Number($('psscS1').value);
  const code=bridgeSupplyCode(st.afe0);
  const measuredInput=$('archiveMeasuredVdd')?.value?.trim()||'';
  const measuredV=measuredInput!==''&&Number.isFinite(Number(measuredInput))?Number(measuredInput):null;
  const measuredSource=$('archiveMeasuredVddSource')?.value?.trim()||null;
  return {
   externalVdd:{measuredV,configuredV:Number.isFinite(chosenVdd)?chosenVdd:null,
    measuredSource:measuredV===null?null:'Manuell erfasst: '+(measuredSource||'Quelle nicht angegeben'),
    source:'Eingestellter Sollwert ist keine VDD-Messung; Istwert nur bei manueller Eingabe'},
   bridgeSvdd:{measuredV:null,derivedNominalV:Number.isInteger(code)&&code<3?BRIDGE_VOLTAGES[code]:null,
    rawRegister:st.afe0,source:'CFG_AFE0 Bits 1:0, abgeleitet und nicht elektrisch gemessen'},
   analogOutput:{measuredV:null,s0TargetV:Number.isFinite(s0)?s0:null,
    s1TargetV:Number.isFinite(s1)?s1:null,source:'Ausgangs-Sollwerte, keine AODO-Messung'},
   ssp3PowerThreshold:{measuredV:null,source:'PWR_ON-Schwelle ist keine Versorgungsspannung'}
  };
 }
 function archiveMeta(){
  let userId=null;
  const word=st.nvmBackup?.[30];
  if(Number.isInteger(word))userId='0x'+h(word,2);
  const input=$('nvmUserId')?.value?.trim();
  if(!userId&&input&&/^(?:0x)?[0-9a-f]{1,4}$/i.test(input))
   userId='0x'+parseInt(input,16).toString(16).padStart(4,'0').toUpperCase();
  return {
   online:!!st.chip,uid:st.uid?.hex||null,customUID:userId,nvmDone:!!st.nvmDone,calVerified:!!st.calVerified,
   software:{version:document.body.dataset.appVersion||'nicht angegeben',url:location.href,
    userAgent:navigator.userAgent,local:location.protocol==='file:',demo:demoEnabled},
   equipment:{adapter:demoEnabled?'Demo':st.adapterKind==='ssp3'?'ELMOS SSP3':st.adapterKind==='bridge'?'ESP32-USB-Bridge':st.adapterKind,
    adapterKind:st.adapterKind,
    // SSP3 .VERSION or USB bridge firmware: not a version of the E703.11 sensor.
    firmware:st.firmware,adapterFirmware:st.firmware,serialPort:serialPortInfo(st.port),
    interface:st.iface,plcAddress:'0x'+h(st.plcAddress),plcAddressVerified:st.plcAddressVerified,
    supply:archiveVoltages()}
  };
 }
 async function archiveCaptureConfig(){
  if(!st.port||!st.chip||st.calTask||st.writing||st.nvmWorking)
   throw Error('Konfiguration nur bei freiem, verbundenem Sensor lesbar');
  const wasLive=st.live&&!st.manualLivePause;
  stopLive();
  if(st.liveReadPromise)await st.liveReadPromise.catch(()=>{});
  const errors=[],words={};
  try{
   // All documented configuration, calibration and diagnostic RAM locations.
   const addresses=[...new Set([...LOCKED,0x0E,0x14,0x16,0x18,0x1A,0x1C,0x1E,
    0x26,0x28,0x2A,0x2E,0x30,0x32,0x36,0x38,0x50,0x52,...CAL_REGS])];
   for(const address of addresses){
    try{words['0x'+h(address)]=await readReg(address)}
    catch(e){errors.push({register:'0x'+h(address),error:e.message})}
   }
   // The existing guarded NVM read helper checks all 64 words plus CRC8/CRC16.
   const readOK=await nvmScan({expertRead:true});
   const nvm=readOK&&st.nvmBackupVerified&&st.nvmBackup?.length===64?
    {words:st.nvmBackup.slice(),crc8Validated:true,crc16Validated:true}: {words:null,crc8Validated:false,crc16Validated:false};
   if(!readOK)errors.push({stage:'nvm_scan',error:'Vollständiges NVM nicht bestätigt'});
   return {at:new Date().toISOString(),ram:{words},nvm,errors,
    uid:st.uid?.hex||null,configuredUserId:nvm.words?'0x'+h(nvm.words[30],2):null,
    supply:archiveVoltages()};
  }finally{if(wasLive&&st.port&&st.chip&&!st.manualLivePause)startLive()}
 }
 async function archiveMeasure(count,options={}){
  const loggerOwner=options.testLogger===true&&st.testLogging;
  if(!st.chip||!st.port||(st.calTask&&!loggerOwner)||st.writing||st.nvmWorking||
   (st.testLogging&&!loggerOwner))throw Error('Sensor nicht messbereit');
  if(!Number.isInteger(count)||count<1||count>100)throw Error('Ungültige Anzahl Samples');
  const spacingMs=options.sampleSpacingMs==null?40:Number(options.sampleSpacingMs);
  if(!Number.isInteger(spacingMs)||spacingMs<0||spacingMs>60000)
   throw Error('Ungültiger Abstand der Einzelmessungen');
  const wasLive=!loggerOwner&&st.live&&!st.manualLivePause;
  if(!loggerOwner){st.calTask=true;stopLive()}
  if(st.liveReadPromise)await st.liveReadPromise.catch(()=>{});
  const samples=[],errors=[];
  const readOptional=async(address)=>{
   try{return P.sign16(await readReg(address))}
   catch(e){errors.push({at:new Date().toISOString(),register:'0x'+h(address),message:e.message});return null}
  };
  try{
   for(let i=0;i<count;i++){
    // Every actual sample is retained; no averaging before archiving.
    const one={at:new Date().toISOString(),
     adcS:await readOptional(0x2A),adcT:await readOptional(0x28),adcTC:await readOptional(0x26),
     dspS:await readOptional(0x30),dspT:await readOptional(0x2E),
     statusSync:await readOptional(0x32),chipStatus:await readOptional(0x36)};
    samples.push(one);
    if(i<count-1&&spacingMs>0)await sleep(spacingMs);
   }
   const median=key=>{
    const arr=samples.map(x=>x[key]).filter(Number.isFinite).sort((a,b)=>a-b);
    if(!arr.length)return null;
    return arr.length%2?arr[(arr.length-1)/2]:(arr[arr.length/2-1]+arr[arr.length/2])/2;
   };
   const adcS=median('adcS'),adcT=median('adcT'),adcTC=median('adcTC'),
    dspS=median('dspS'),dspT=median('dspT');
   if(loggerOwner?[adcS,adcT,adcTC,dspS,dspT].every(v=>!Number.isFinite(v)):!Number.isFinite(adcS)||!Number.isFinite(dspS)){
    const error=Error('Druck-ADC oder DSP_S nicht lesbar');
    error.rawSamples=samples.slice();error.partialReadErrors=errors.slice();throw error;
   }
   const range=getActiveDSPRange();
   const sensorPressure=range?range.min+(dspS+range.limit)/(2*range.limit)*(range.max-range.min):null;
   return {at:new Date().toISOString(),samples,errors,count,
    adcS,adcT,adcTC,dspS,dspT,sensorPressure,
    pressureUnit:Number.isFinite(sensorPressure)?range.unit:null,pressureConversionKind:range?.kind||null,
    pressureConversion:range?.kind==='ram'?'Aktuelle RAM-Zuordnung (DSP-Verifikation separat beachten)':
     'Manuelle Anzeigezuordnung; nur nach ausdrücklicher Bestätigung zur Toleranzbewertung verwenden',
    temperatureConversion:'Keine validierte Umrechnung von DSP_T auf °C',
    supply:archiveVoltages(),AFE:{...st.staged},ramAFE0:st.afe0,ramAFE1:st.afe,
    currentNvmCrc:st.nvmBackup?.[63]??null};
  }finally{
   if(!loggerOwner)st.calTask=false;
   renderStatus();
   if(wasLive&&st.chip&&st.port&&!st.manualLivePause)startLive();
  }
 }
 window.ELMOS_ARCHIVE_BRIDGE=Object.freeze({
  meta:archiveMeta,initial:archiveCaptureConfig,final:archiveCaptureConfig,measure:archiveMeasure,
  startTelemetry:archiveStartTelemetry,stopTelemetry:archiveStopTelemetry
 });

 async function prepareNextSensor(matrix){
  if(demoEnabled||!st.port||!st.chip||!st.nvmDone||st.closing||
     st.calTask||st.nvmWorking||st.writing||st.powerCycleRunning||st.ramMeasurementStarting)
   throw Error('Bitte zuerst die laufenden Sensorvorgänge abschliessen.');
  return withProgress('Abgleich wird abgeschlossen',async()=>{
   const port=st.port,uid=st.uid?.hex;
   if(!uid)throw Error('Chipkennung fehlt.');
   if(!Number.isInteger(st.afe))throw Error('Frontend-Einstellungen konnten nicht bestätigt werden.');
   const settings=configFromUi(ELMOS_CONFIG.GROUPS,matrix);
   const archive=window.ELMOS_ARCHIVE;
   if(archive?.active){
    if(!['calibration','output'].includes(archive.current.type)||archive.current.chipUID!==uid)
     throw Error('Das offene Archivprotokoll gehört nicht zu diesem Sensorabgleich.');
    await archive.finalise('completed');
   }
   if(st.port!==port||!st.chip||st.uid?.hex!==uid)
    throw Error('Sensorverbindung hat sich geändert.');
   if(!await disconnect())throw Error('USB-Verbindung konnte nicht getrennt werden.');
   reconnectSsp3OnUsb=false;
   erasePoints();st.trend=[];st.profilePendingAFE=null;
   $('nvmUserId').value='';
   stopSeriesPreset();
   show('connMsg','USB-Verbindung getrennt.','success');
   return settings;
  },true);
 }

 window.ELMOS_GUIDED_API=Object.freeze({
  state:()=>({
   chip:!!st.chip,demo:demoEnabled,mode:st.mode,adapter:st.adapterKind,uid:st.uid?.hex||null,
   // Read-only summary for the guided completion cards; measurements remain owned by the classic workflow.
   points:st.calpoints.map(x=>({kind:x.kind,slot:x.slot,at:x.at,pressure:x.pressure,temperature:x.temperature,
    adc_s:x.adc_s,adc_t:x.adc_t,adc_tc:x.adc_tc,sampleCount:x.sampleCount})),
   calStaged:!!st.calStaged,calVerified:verificationComplete(),nvmDone:!!st.nvmDone,
   nvmBackupVerified:!!st.nvmBackupVerified,outputReady:expert.outputReady()
  }),
  navigate:n=>step(n),
  offerSeriesPreset,
  prepareNextSensor,
  stopSeriesPreset,
  applySeriesSettings:profile=>applySeriesConfig(profile,configIncluded(profile)),
  releaseSwapPort:async()=>{
   if(st.port&&!await disconnect())throw Error('USB-Verbindung konnte nicht getrennt werden.');
  },
  connectNextSensor:async(selectPort)=>{
   if(st.port&&!st.chip&&!await disconnect())throw Error('USB-Verbindung konnte nicht getrennt werden.');
   if(st.chip)return;
   try{await (selectPort?choose():auto())}
   finally{reconnectSsp3OnUsb=false}
   if(!st.chip)throw Error($('connMsg').textContent);
  },
  refresh:()=>{renderFlowState();renderStatus()},
  telemetry:()=>guidedTelemetry(),
  afeStats:since=>guidedAfeStats(since),
  redraw:()=>draw(),

 });
 $('operationProgressDialog').addEventListener('cancel',event=>event.preventDefault());
 gainSummary();renderStatus();step(0);window.addEventListener('resize',draw);
})();
