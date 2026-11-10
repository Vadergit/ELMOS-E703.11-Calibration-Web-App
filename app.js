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
 const lsGet=k=>{try{return localStorage.getItem(k)}catch{return null}},lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
 const GAINS1=[3.5,6,8.5,11],GAINS2=[2,2.22,2.5,2.86,3.33,4,5,6.67,10];
 const LOCKED=[4,6,8,10,12,16],R_AFE=0x1C;
 const CAL=ELMOS_CAL; const CAL_REGS=[0x6C,0x6E,0x70,0x72,...Array.from({length:16},(_,i)=>0x74+2*i),0x94,0x96,0x98,0x9A];
 const REG_NAMES={4:'CFG_EN',6:'CFG_SPI_I2C',8:'CFG_PADS0',10:'CFG_PADS1',12:'CFG_PADS2',16:'CFG_AODO',0x14:'CFG_ADC',0x16:'CFG_LP0',0x18:'CFG_LP1',0x1A:'CFG_AFE0',0x1C:'CFG_AFE1',0x1E:'CFG_AFE2',0x26:'ADC_TC',0x28:'ADC_T',0x2A:'ADC_S'};
 const st={mode:'offline',port:null,reader:null,readerPromise:null,cmdQueue:Promise.resolve(),replyBuffer:'',responseWait:null,iface:'plc',firmware:'',chip:false,boot:null,afe:null,staged:{pga1:0,pga2:0,offset:0},adc:null,trend:[],history:[],log:[],regs:{},points:{lo:null,hi:null},verify:null,live:false,timeout:null,consecutiveErrors:0,writing:false,pressure:5,calpoints:[],calfit:null,calImage:null,nvmBackup:null,nvmBackupVerified:false,calStaged:false,calVerified:false,calValidation:[],calTask:false,nvmWorking:false,nvmDone:false};
 let currentStep=0,pendingGain=null,writeTimer=null;let tipEnabled=true;
 const HELP={interface:'Schnittstelle zwischen SSP3-Board und Sensorchip. 1-Wire nutzt AODO (VDD, GND und AODO). Die Einstellung IF_CFG ändert die Programmer-Pins, nicht die NVM-Konfiguration des Sensors.',baud:'Baudrate des USB-UART zwischen Chrome und dem SSP3. Die Herstellersoftware verwendet 115200 Baud als Standard.',adcs:'ADC_S ist der unkompensierte 16-Bit-Druck-ADC. ±25000 Digits ist ein vorsichtiges Ziel für den manuellen Abgleich, keine garantierte Hardwaregrenze.',pga1:'Erste Druckverstärkungsstufe: 3.5×, 6×, 8.5× oder 11× (typische Werte laut Datenblatt 2023). Für gutes SNR möglichst hoch ohne Übersteuerung.',pga2:'Zweite Verstärkungsstufe: typische Faktoren 2× bis 10×. Der Gesamtfaktor ist PGA1 × PGA2.',offset:'17 DAC-Stufen von −400 bis +400 mV/V bezogen auf die Brückenspannung. Die Verschiebung liegt zwischen PGA1 und PGA2.',ram:'Schreibt nach manueller Freigabe ausschliesslich die Gain-/Offset-Bits in CFG_AFE1 0x1C im RAM. Kein NVM-/EEPROM-Schreiben. Vorher und nachher liest die App sämtliche Boot-/Kommunikationsregister.',};
 const h=P.hx;
 const fmt=n=>n===null||n===undefined||!Number.isFinite(n)?'—':Math.round(n).toLocaleString('de-CH');
 const now=()=>new Date().toLocaleTimeString('de-CH',{hour12:false});
 const show=(id,text,type='')=>{const e=$(id);if(!e)return;e.textContent=text;e.className='callout'+(type?' '+type:'')};
 const logging=t=>{st.log.push(now()+'  '+t);if(st.log.length>500)st.log.shift();$('usbLog').textContent=st.log.slice(-90).join('\n')};
 const hexWords=arr=>arr.map(x=>P.hx(x,2)).join(' ');
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const sameBoot=(a,b)=>!!a&&!!b&&LOCKED.every(k=>a[k]===b[k]);
 function renderStatus(){let connected=!!st.port, demo=st.mode==='demo';$('status').textContent=demo?'DEMO · simuliert':st.chip?'Chip-Leseantwort plausibel':connected?'USB verbunden · Chipprüfung offen':'Nicht verbunden';$('statusDot').className='dot'+(demo?' demo':st.chip?' active':'');$('fw').textContent=st.firmware?st.firmware.slice(0,19):'—';$('chip').textContent=st.chip?'Antwort erhalten':'—';$('ifaceLabel').textContent=st.iface==='plc'?'1-Wire':st.iface==='i2c'?'I²C':'SPI';$('srcLabel').textContent=demo?'DEMO':st.adc?.source==='usb'?'USB / Chip':'Keine Messdaten';$('choose').disabled=connected;$('auto').disabled=connected;$('disconnect').disabled=!connected;$('readNow').disabled=!connected&&!demo;$('live').disabled=!connected&&!demo;$('live').textContent=st.live?'Live-Messung stoppen':'Live-Messung starten';$('readBoot').disabled=!st.chip;$('readRegs').disabled=!st.chip;$('allowRam').disabled=!st.chip||demo;if(!st.chip)$('allowRam').checked=false;$('afeWord').textContent=st.afe===null?'CFG_AFE1: —':'CFG_AFE1: 0x'+h(st.afe,2)};
 function gainSummary(){for(let k of ['pga1','pga2','offset']){$(k).value=st.staged[k];$(k+'val').textContent=(st.staged[k]>0&&k==='offset'?'+':'')+st.staged[k]}let g=st.staged;$('gainInfo').textContent=`PGA1 ${GAINS1[g.pga1]}× · PGA2 ${GAINS2[g.pga2]}× · Gesamt ${(GAINS1[g.pga1]*GAINS2[g.pga2]).toFixed(2)}× · Offset-DAC ${g.offset*50} mV/V`;renderStatus()}
 function step(n){currentStep=Math.max(0,Math.min(5,Number(n)));document.querySelectorAll('.panel').forEach(x=>x.hidden=Number(x.dataset.panel)!==currentStep);document.querySelectorAll('[data-step]').forEach(x=>x.classList.toggle('active',Number(x.dataset.step)===currentStep));draw()}
 const erasePoints=()=>{st.points={lo:null,hi:null};st.verify=null;st.calpoints=[];st.calfit=null;st.calImage=null;st.calStaged=false;st.calVerified=false;st.calValidation=[];renderCalPoints();$('lowVal').textContent='Noch nicht erfasst';$('highVal').textContent='Noch nicht erfasst';$('hub').textContent='—';$('middle').textContent='—';$('usage').textContent='—';show('calMsg','Beide Messpunkte müssen nach einer Gain-Änderung neu aufgenommen werden.')};
 const rawLine=s=>{st.log.push(now()+'  '+s);if(st.log.length>500)st.log.shift();$('usbLog').textContent=st.log.slice(-90).join('\n')};
 async function readerLoop(port){try{let r=port.readable.getReader();st.reader=r;try{while(st.port===port){const{value,done}=await r.read();if(done)break;if(!value)continue;let txt=new TextDecoder().decode(value);rawLine('RX '+txt.replace(/\r/g,'\\r').replace(/\n/g,'\\n'));if(st.responseWait){st.replyBuffer+=txt;const colon=st.replyBuffer.match(/(?:^|[\r\n])\s*:\s*(?:\r|\n|$)/);if(colon){const waiter=st.responseWait;st.responseWait=null;clearTimeout(waiter.timer);const out=st.replyBuffer;st.replyBuffer='';waiter.resolve(out)}else if(st.replyBuffer.length>16000){const waiter=st.responseWait;st.responseWait=null;clearTimeout(waiter.timer);waiter.reject(Error('SSP3-Antwort zu lang'))}}}}finally{r.releaseLock();if(st.reader===r)st.reader=null}}catch(e){if(st.port===port){logging('USB-Lesefehler: '+e.message);st.chip=false;stopLive();renderStatus();show('connMsg','USB-Lesefehler: '+e.message,'error')}}}
 function serialize(fn){const run=st.cmdQueue.then(fn,fn);st.cmdQueue=run.catch(()=>{});return run}
 async function exchange(text,timeout=2500){return serialize(async()=>{if(!st.port?.writable)throw Error('USB-Verbindung nicht geöffnet');if(st.responseWait)throw Error('Interner Befehlskonflikt');st.replyBuffer='';let resolver,rejecter;const future=new Promise((res,rej)=>{resolver=res;rejecter=rej});const ticket={resolve:resolver,reject:rejecter,timer:setTimeout(()=>{if(st.responseWait===ticket){st.responseWait=null;ticket.reject(Error('SSP3 Timeout für '+text.slice(0,18))) }},timeout)};st.responseWait=ticket;const writer=st.port.writable.getWriter();try{logging('TX '+text);await writer.write(new TextEncoder().encode(text+'\r'))}catch(e){if(st.responseWait===ticket){st.responseWait=null;clearTimeout(ticket.timer);rejecter(e)}throw e}finally{writer.releaseLock()}const ans=await future;if(ans.split(/[\r\n]+/).some(l=>l.trim().startsWith('!')))throw Error('SSP3 meldet Fehler: '+ans.slice(0,140));return ans})}
 async function firmware(){let a=await exchange('.VERSION',1600);let lines=a.split(/[\r\n]+/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')&&x!==':'&&!x.startsWith('@'));st.firmware=lines.join(' ').replace(/^\.VERSION/i,'').trim().slice(0,80)||'Antwort erhalten';renderStatus()}
 const ifcfg={plc:'IF_CFG 7 0 0',i2c:'IF_CFG 2 1 0',spi:'IF_CFG 1 1 0'};
 async function selectChipInterface(){await exchange(ifcfg[st.iface]);logging('SSP3-Schnittstellenmodus '+st.iface+' gesetzt (nicht NVM).')}
 async function readReg(addr){if(st.mode==='demo')return demoRead(addr);if(!st.port)throw Error('SSP3-Port nicht verbunden');if(!Number.isInteger(addr)||addr<0||addr>0xFE||addr%2)throw Error('Ungültige Registeradresse');let result;
   if(st.iface==='plc'){const cmd=P.plcRead(addr,1);let ans=await exchange(cmd);let vals=P.readData(ans,3);result=vals[0]*256+vals[1];logging(`1-Wire 0x${h(addr)} → 0x${h(result,2)} (CRC8-Antwortbyte vorhanden, noch nicht unabhängig verifiziert)`)}
   else if(st.iface==='i2c'){const cmd=P.i2cRead(addr);let ans=await exchange(cmd);let vals=P.readData(ans,2);result=vals[0]|(vals[1]<<8)}
   else {let ans=await exchange(P.spiRead(addr));let vals=P.readData(ans,4);result=(vals[2]<<8)|vals[3]}
   st.regs[addr]=result;return result;
 }
 function decodeSafeAFE(w){if(!(w&0x800))throw Error('CFG_AFE1 Bit 11 unerwartet 0; keine Schreibfreigabe');const g=P.decAFE(w);if(!P.goodG(g))throw Error('AFE-Codes unbekannt: 0x'+h(w,2));return g}
 async function detect(){const w=await readReg(R_AFE);const g=decodeSafeAFE(w);const a=await readReg(0x2A);st.afe=w;st.staged={...g};st.chip=true;gainSummary();logging(`Chip-Leseantwort: AFE=0x${h(w,2)} ADC_S=${P.sign16(a)}`);await readADC();renderStatus();show('connMsg','Chip-Register über '+(st.iface==='plc'?'1-Wire':st.iface.toUpperCase())+' lesbar. Antworten sind plausibel; ein physischer Hardware-Abnahmetest steht noch aus.','success');step(1);startLive()}
 async function connect(port){if(st.port)throw Error('Es ist bereits ein Port offen');if(st.mode==='demo')exitDemo();if(!navigator.serial||!window.isSecureContext)throw Error('Chrome benötigt Web Serial über HTTPS oder localhost');await port.open({baudRate:Number($('baud').value),dataBits:8,stopBits:1,parity:'none',flowControl:'none'});st.port=port;st.mode='usb';st.firmware='';st.chip=false;st.afe=null;st.boot=null;st.regs={};$('allowRam').checked=false;st.iface=$('iface').value;st.readerPromise=readerLoop(port);renderStatus();show('connMsg','USB offen. Firmware und Chip werden geprüft …');try{await firmware();await selectChipInterface();try{await detect()}catch(e){st.chip=false;logging('Chiptest: '+e.message);show('connMsg','SSP3 erreichbar, aber kein Chipzugriff bestätigt: '+e.message+'. Prüfe Startfenster, Verdrahtung und Schnittstellenwahl.','warn');renderStatus()}}catch(e){logging('Handshake: '+e.message);show('connMsg','USB offen, aber SSP3 antwortet noch nicht korrekt: '+e.message,'warn')};renderStatus()}
 async function disconnect(){if(st.nvmWorking||st.calTask||st.writing){show('connMsg','USB-Trennung während laufender RAM-/NVM-Arbeit gesperrt. Bitte Vorgang beenden.','error');return}stopLive();const p=st.port;if(!p){if(st.mode==='demo')exitDemo();return}st.port=null;st.chip=false;st.mode='offline';st.boot=null;st.afe=null;st.nvmBackup=null;st.nvmBackupVerified=false;st.calImage=null;st.calVerified=false;st.calStaged=false;$('allowRam').checked=false;if(st.responseWait){clearTimeout(st.responseWait.timer);st.responseWait.reject(Error('Port getrennt'));st.responseWait=null}try{await st.reader?.cancel();await st.readerPromise?.catch(()=>{});await p.close()}catch(e){logging('Trennen: '+e.message)}renderStatus()}
 async function choose(){try{let p=await navigator.serial.requestPort();await connect(p)}catch(e){show('connMsg','USB-Portauswahl fehlgeschlagen: '+e.message,'error')}}
 async function auto(){try{const list=await navigator.serial.getPorts();if(!list.length)return show('connMsg','Noch kein Port freigegeben. Klicke zuerst auf «USB-Port auswählen».','warn');let ports=list.filter(x=>x.getInfo?.().usbVendorId===0x0403);let p=ports.length===1?ports[0]:list.length===1?list[0]:null;if(!p)return show('connMsg','Mehrere freigegebene Ports erkannt. Bitte USB-Port manuell auswählen.','warn');await connect(p)}catch(e){show('connMsg','Automatische Verbindung: '+e.message,'error')}}
 function updateADC(a,source){st.adc={...a,source,time:Date.now()};st.trend.push({x:Date.now(),y:a.s});st.trend=st.trend.filter(v=>Date.now()-v.x<60000);st.history.push({time:new Date().toISOString(),adc_s:a.s,adc_t:a.t,adc_tc:a.tc,source,gains:{...st.staged}});if(st.history.length>5000)st.history.shift();$('adc').textContent=fmt(a.s);$('adct').textContent=fmt(a.t);$('adctc').textContent=fmt(a.tc);show('adcMsg',Math.abs(a.s)>25000?'ADC_S liegt ausserhalb des vorsichtigen ±25’000-Arbeitsbereichs. Gain reduzieren oder Offset kontrollieren.':`ADC_S ${fmt(a.s)} Digits · ${source==='demo'?'DEMO / simuliert':'USB / E703.11'} · ${new Date().toLocaleTimeString('de-CH')}`,Math.abs(a.s)>25000?'warn':'success');renderStatus();draw();return a.s}
 async function readADC(){if(st.mode==='demo')return updateADC({s:demoADC(),t:10755,tc:9902},'demo').s;if(!st.chip)throw Error('Chip-Lesezugriff noch nicht bestätigt');let tc=P.sign16(await readReg(0x26)),t=P.sign16(await readReg(0x28)),s=P.sign16(await readReg(0x2A));return updateADC({s,t,tc},'usb').s}
 function startLive(){if(st.live||st.calTask||!(st.chip||st.mode==='demo'))return;st.live=true;st.consecutiveErrors=0;renderStatus();(async function loop(){if(!st.live)return;try{if(!st.writing)await readADC();st.consecutiveErrors=0}catch(e){st.consecutiveErrors++;logging('ADC-Fehler: '+e.message);if(st.consecutiveErrors>=3){stopLive();show('adcMsg','Live-Messung gestoppt: '+e.message,'error');return}}finally{if(st.live)st.timeout=setTimeout(loop,650)}})()}
 function stopLive(){st.live=false;clearTimeout(st.timeout);st.timeout=null;renderStatus()}
 function demoADC(){const g=st.staged;return Math.max(-32768,Math.min(32767,Math.round((st.pressure-5)*750*(GAINS1[g.pga1]/3.5)*(GAINS2[g.pga2]/2)+g.offset*950+(Math.random()-.5)*28)))}
 function demoRead(addr){if(addr===0x1C)return P.encAFE(0x0800,st.staged);if(addr===0x2A)return demoADC()&65535;if(addr===0x28)return 10755;if(addr===0x26)return 9902;const fixed={4:0x0200,6:0x0006,8:0x0100,10:0x0980,12:0,16:0};return fixed[addr]??0}
 function exitDemo(){stopLive();st.mode='offline';st.chip=false;st.afe=null;st.boot=null;st.regs={};$('allowRam').checked=false;st.points={lo:null,hi:null};st.calpoints=[];st.calfit=null;st.calImage=null;st.nvmBackup=null;$('demo').textContent='Demo starten';$('demoPressurePanel').hidden=true;renderStatus()}
 function demo(){if(st.port)return show('connMsg','USB zuerst trennen, um die Demo zu starten.','warn');if(st.mode==='demo'){exitDemo();return}st.mode='demo';st.firmware='DEMO';st.chip=false;st.staged={pga1:1,pga2:3,offset:0};st.pressure=5;st.points={lo:null,hi:null};st.calpoints=[];st.calfit=null;st.calImage=null;st.nvmBackup=null;gainSummary();$('demo').textContent='Demo beenden';$('demoPressurePanel').hidden=false;show('connMsg','DEMO aktiv: alle ADC-Werte sind simuliert. Es werden keine Hardwarebefehle gesendet.','warn');step(1);startLive();renderStatus()}
 async function bootSnapshot(){if(!(st.chip||st.mode==='demo'))throw Error('Chip nicht verbunden');const out={};for(const a of LOCKED)out[a]=await readReg(a);return out}
 function bootString(b){return LOCKED.map(a=>`${REG_NAMES[a]} 0x${h(a)} = 0x${h(b[a],2)} · gesperrt`).join('\n')}
 async function readBoot(){try{const a=await bootSnapshot(),b=await bootSnapshot();if(!sameBoot(a,b))throw Error('Bootregister nicht stabil');st.boot=a;$('regdump').textContent=bootString(a);show('bootMsg','Bootregister zweifach gelesen. Boot-/Schnittstellenregister schreibgeschützt; NVM-Bereich nur im gesicherten Kalibrierablauf programmierbar.','success');return a}catch(e){st.boot=null;$('allowRam').checked=false;show('bootMsg','Bootregister-Prüfung fehlgeschlagen: '+e.message,'error');throw e}finally{renderStatus()}}
 async function registerDump(){try{if(!st.chip)throw Error('Chip-Lesezugriff nicht bestätigt');const regs=[...LOCKED,0x14,0x16,0x18,0x1A,0x1C,0x1E,0x26,0x28,0x2A];for(const a of regs)st.regs[a]=await readReg(a);$('regdump').textContent=regs.map(a=>`0x${h(a)}  ${REG_NAMES[a]||'Register'}  0x${h(st.regs[a],2)} ${LOCKED.includes(a)?'GESCHÜTZT':''}`).join('\n');show('bootMsg','Diagnoseregister gelesen. Bootregister bleiben schreibgeschützt.','success')}catch(e){show('bootMsg','Registerlesen: '+e.message,'error')}}
 async function unlockRAM(){if(st.iface==='plc'){await exchange('PLC P',3500);await exchange('PLC T',3500)}else {for(const w of [0xF75A,0x0CC7,0xD21E])await lowLevelWrite(0x22,w,true)}}
 async function lowLevelWrite(addr,word,forUnlock=false){if(!st.port||!$('allowRam').checked||!st.chip)throw Error('RAM-Schreibzugriff gesperrt');if(addr!==R_AFE&&!(forUnlock&&addr===0x22))throw Error('Nur CFG_AFE1 und dokumentierte RAM-Freigabecookies zulässig');if(addr===0x22&&!([0xF75A,0x0CC7,0xD21E].includes(word)))throw Error('Nicht erlaubtes CMD-Cookie');let cmd;if(st.iface==='plc'){if(addr!==R_AFE)throw Error('PLC nutzt PLC P / PLC T für RAM-Freigabe');cmd=P.plcWrite(addr,word)}else if(st.iface==='i2c'){cmd=P.i2cWrite(addr,word)}else{cmd=P.spiWrite(addr,word)}await exchange(cmd,2300)}
 async function commitGain(target){if(st.writing){pendingGain=target;return}st.writing=true;try{if(!st.port||!st.chip||!$('allowRam').checked)throw Error('Chip nicht bereit oder RAM nicht freigegeben');if(!P.goodG(target))throw Error('Unzulässige Gain-Werte');const baseline=st.boot??await bootSnapshot();const beforeBoot=await bootSnapshot();if(!sameBoot(baseline,beforeBoot))throw Error('Bootregister seit der ersten Prüfung geändert');const w=await readReg(R_AFE);const old=decodeSafeAFE(w);const next=P.encAFE(w,target);if(st.iface!=='plc'&&(beforeBoot[6]&0x8000))throw Error('Chip verlangt CRC-geschützte I²C/SPI-Kommunikation; ungeschützte RAM-Änderung gesperrt');if(next===w){show('writeMsg','AFE-Einstellungen sind bereits identisch. Kein Schreibbefehl gesendet.','success');return}const adcBefore=await readReg(0x2A);await unlockRAM();await lowLevelWrite(R_AFE,next);const reread=await readReg(R_AFE);if(reread!==next)throw Error('AFE-Rücklesefehler: Soll 0x'+h(next,2)+' Ist 0x'+h(reread,2));const afterBoot=await bootSnapshot();if(!sameBoot(beforeBoot,afterBoot))throw Error('Bootregister nach AFE-Schreiben verändert – sofortige Sperre');const adcAfter=await readReg(0x2A);st.afe=reread;st.staged={...target};erasePoints();show('writeMsg',`RAM bestätigt: 0x${h(w,2)} → 0x${h(next,2)}, Rücklesen korrekt. ADC_S am aktuellen Druck: ${fmt(P.sign16(adcBefore))} → ${fmt(P.sign16(adcAfter))} Digits. Für die Hubbewertung beide Druckpunkte neu aufnehmen.`,'success');logging('AFE-RAM schreiben und rücklesen OK. Keine NVM-Änderung.');gainSummary()}catch(e){st.boot=null;$('allowRam').checked=false;show('writeMsg','AFE-Schreiben abgebrochen: '+e.message+'. Schreibfreigabe wurde deaktiviert.','error');logging('AFE-Schreibfehler: '+e.message);try{if(st.port&&st.chip){let r=await readReg(R_AFE);st.afe=r;st.staged=decodeSafeAFE(r);gainSummary()}}catch{} }finally{st.writing=false;renderStatus();if(pendingGain&&st.port&&st.chip&&$('allowRam').checked){const nextTarget=pendingGain;pendingGain=null;writeTimer=setTimeout(()=>commitGain(nextTarget),125)}}}
 async function gainChange(){if(st.calTask||st.nvmWorking){gainSummary();show('writeMsg','Während NVM-/Kalibrier-Wartung sind Gain-Änderungen gesperrt.','warn');return}let target={pga1:+$('pga1').value,pga2:+$('pga2').value,offset:+$('offset').value};st.staged={...target};gainSummary();erasePoints();if(st.mode==='demo'){updateADC({s:demoADC(),t:10755,tc:9902},'demo');show('writeMsg','DEMO: Gain-Änderung ist nur simuliert.','warn');return}if(!st.port||!st.chip||!$('allowRam').checked){show('writeMsg','Vorschau geändert. Für eine echte RAM-Änderung zuerst die bewusste Freigabe aktivieren.','warn');return}pendingGain=target;clearTimeout(writeTimer);writeTimer=setTimeout(()=>{const v=pendingGain;pendingGain=null;commitGain(v)},340)}
 async function sample(){if(st.mode==='demo'){const v=demoADC();return v}if(!st.chip)throw Error('Keine bestätigte Chip-Leseverbindung');return P.sign16(await readReg(0x2A))}
 async function capture(which){try{if(st.calTask||st.writing)throw Error('Wartungsvorgang läuft');const pmin=Number($('pmin').value),pmax=Number($('pmax').value);if(!(pmax>pmin))throw Error('Maximaldruck muss grösser sein als Minimaldruck');const vals=[];for(let i=0;i<8;i++){vals.push(await sample());await sleep(75)}vals.sort((a,b)=>a-b);const med=(vals[3]+vals[4])/2;const obj={v:med,min:vals[0],max:vals[7],pressure:which==='lo'?pmin:pmax,gains:{...st.staged},at:new Date().toISOString()};st.points[which]=obj;addCalPoint({pressure:obj.pressure,temperature:Number($('calTemp').value),adc_s:med,adc_t:st.adc?.t,adc_tc:st.adc?.tc,at:obj.at,gains:obj.gains});$(which==='lo'?'lowVal':'highVal').textContent=`ADC_S ${fmt(med)} Digits · Streuung ${fmt(vals[7]-vals[0])}`;refreshPoints()}catch(e){show('calMsg','Messung nicht möglich: '+e.message,'error')}}
 function refreshPoints(){const a=st.points.lo,b=st.points.hi;if(!a||!b)return;if(JSON.stringify(a.gains)!==JSON.stringify(b.gains))return show('calMsg','AFE-Einstellungen der Punkte sind verschieden. Beide Punkte erneut aufnehmen.','error');let span=Math.abs(b.v-a.v),mid=(a.v+b.v)/2,max=Math.max(Math.abs(a.v),Math.abs(b.v)),use=max/25000;$('hub').textContent=fmt(span);$('middle').textContent=fmt(mid);$('usage').textContent=(use*100).toFixed(1)+' %';show('calMsg',`Beide Messpunkte erfasst. Signalhub ${fmt(span)} Digits, Extremwert ${fmt(max)} Digits.`,`success`);let advise;if(max>25000){advise='Aussteuerung zu hoch: zunächst PGA2 reduzieren und beide Punkte wiederholen.'}else if(span<18000){advise='Signalhub noch klein: PGA1 schrittweise erhöhen (wenn Vorverstärker nicht übersteuert), danach PGA2 anpassen. Zwischen jeder Änderung beide Punkte neu messen.'}else if(Math.abs(mid)>7000){advise='Signalmitte deutlich verschoben: Offset-DAC um eine Stufe ausprobieren und beide Endpunkte erneut aufnehmen.'}else{advise='Signalbereich grundsätzlich gut genutzt. Kein Gain-Schritt ohne weiteren Gewinn nötig. Rauschen und Verifikation prüfen.'}show('recommendation',advise,'success')}
 async function verify(){try{const a=st.points.lo,b=st.points.hi;if(!a||!b)throw Error('Zuerst beide Messpunkte aufnehmen');if(JSON.stringify(a.gains)!==JSON.stringify(b.gains)||JSON.stringify(a.gains)!==JSON.stringify(st.staged))throw Error('Gain-Einstellung seit der Messung verändert');if(Math.abs(b.v-a.v)<10)throw Error('Signalhub zu klein');const val=await sample(),pred=a.pressure+(val-a.v)*(b.pressure-a.pressure)/(b.v-a.v),set=Number($('ptest').value),tol=Number($('tol').value),err=pred-set;if(!Number.isFinite(tol)||tol<0)throw Error('Toleranz ungültig');st.verify={adc:val,calculated:pred,expected:set,error:err,tolerance:tol,pass:Math.abs(err)<=tol};show('verifyMsg',`ADC_S ${fmt(val)} · berechnet ${pred.toFixed(4)} bar · Referenz ${set.toFixed(4)} bar · Abweichung ${err>=0?'+':''}${err.toFixed(4)} bar · ${st.verify.pass?'innerhalb Toleranz':'ausserhalb Toleranz'}. (Nur lineare Rohwertprüfung, kein DSP/NVM-Abgleich.)`,st.verify.pass?'success':'warn')}catch(e){show('verifyMsg','Verifikation nicht möglich: '+e.message,'error')}}
 function draw(){const c=$('chart');if(!c||c.closest('[hidden]'))return;const d=window.devicePixelRatio||1,w=Math.round(c.clientWidth*d),h=Math.round(c.clientHeight*d);if(w<20)return;if(c.width!==w||c.height!==h){c.width=w;c.height=h}const g=c.getContext('2d');g.clearRect(0,0,w,h);const x0=55*d,y0=10*d,yh=h-20*d,y=v=>y0+(32768-v)/65536*(yh-y0);g.font=`${11*d}px sans-serif`;for(const v of [25000,0,-25000]){g.beginPath();g.strokeStyle=v?'#e3c9aa':'#d7e4ef';g.setLineDash(v?[5*d,4*d]:[]);g.moveTo(x0,y(v));g.lineTo(w-8*d,y(v));g.stroke();g.setLineDash([]);g.fillStyle='#74849a';g.fillText((v>0?'+':'')+v,5*d,y(v)+4*d)}if(st.trend.length<1)return;const left=Date.now()-60000,x=t=>x0+(w-x0-10*d)*Math.max(0,Math.min(1,(t-left)/60000));g.beginPath();g.strokeStyle='#2867a6';g.lineWidth=2*d;st.trend.forEach((p,i)=>i?g.lineTo(x(p.x),y(p.y)):g.moveTo(x(p.x),y(p.y)));g.stroke()}
 function download(name,txt,mime='application/json'){let b=new Blob([txt],{type:mime}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}
 const report=()=>({tool:'ELMOS E703.11 Chrome v8 / SSP3 Zelos Protocol',created:new Date().toISOString(),connection:st.port?'USB':'offline/demo',hardwareValidated:false,interface:st.iface,firmware:st.firmware,bootProtection:'Boot-/Werks-NVM-Schreiben gesperrt; kalibrierungsbezogenes User-NVM mit Bestätigung freigegeben',ramUnlocked:$('allowRam').checked,registers:st.regs,bootSnapshot:st.boot,AFE:st.afe,gains:st.staged,low:st.points.lo,high:st.points.hi,verification:st.verify,calibrationPoints:st.calpoints,coefficientFit:st.calfit,calRamVerified:st.calVerified,nvmState:{backupVerified:st.nvmBackupVerified,programmed:st.nvmDone},samples:st.history.slice(-1500),trace:st.log});

 // ============ Kalibrierung + NVM (AN0203 / AN0204 / Datasheet 2023) ============
 const ca=(id,msg,type='')=>show(id,msg,type);
 function renderCalPoints(){const out=$('calPointsList');if(!out)return;out.textContent=st.calpoints.length?st.calpoints.map((x,i)=>`${i+1}. ${x.pressure.toFixed(3)} bar · ${Number(x.temperature).toFixed(1)} °C · ADC_S ${fmt(x.adc_s)} · ADC_T ${fmt(x.adc_t)}`).join('\n'):'Noch keine Messpunkte. Erfasse mindestens zwei verschiedene Drücke.';}
 function addCalPoint(x){if(!Number.isFinite(x.adc_s)||!Number.isFinite(x.adc_t)||!Number.isFinite(x.pressure)||!Number.isFinite(x.temperature))return;st.calpoints.push(x);st.calfit=null;st.calImage=null;st.calVerified=false;st.calValidation=[];st.calStaged=false;renderCalPoints();}
 async function captureCalPoint(){try{if(st.calTask||st.writing)throw Error('Wartungsvorgang läuft');
  const pr=Number($('calPressure').value),t=Number($('calTemp').value);
  if(!Number.isFinite(pr)||!Number.isFinite(t)||t< -40||t>125)throw Error('Druck / Temperatur ungültig');
  if(st.mode!=='demo'&&!st.chip)throw Error('Kein Chip verbunden');
  const samples=[];for(let i=0;i<12;i++){if(st.mode==='demo')samples.push({s:demoADC(),t:10755,tc:9902});else samples.push({s:P.sign16(await readReg(0x2A)),t:P.sign16(await readReg(0x28)),tc:P.sign16(await readReg(0x26))});await sleep(60)}
  const median=k=>samples.map(x=>x[k]).sort((a,b)=>a-b)[5];
  const spread=k=>Math.max(...samples.map(x=>x[k]))-Math.min(...samples.map(x=>x[k]));
  if(spread('s')>350)throw Error('ADC_S streut über 350 Digits – Druck stabilisieren');
  const a={pressure:pr,temperature:t,adc_s:median('s'),adc_t:median('t'),adc_tc:median('tc'),at:new Date().toISOString(),gains:{...st.staged},spread:spread('s')};
  addCalPoint(a);ca('calPointsMsg',`Messpunkt ${st.calpoints.length} gespeichert (Streuung ${a.spread} Digits).`,'success');
 }catch(e){ca('calPointsMsg',e.message,'error')}}
 function calcCoefficients(){try{if(st.calTask||st.writing)throw Error('Wartungsvorgang läuft');
  const pmin=Number($('pmin').value),pmax=Number($('pmax').value);
  if(st.calpoints.some(p=>JSON.stringify(p.gains)!==JSON.stringify(st.staged)))throw Error('Gain wurde geändert. Alte Messpunkte löschen und neu aufnehmen.');
  const solution=CAL.fit(st.calpoints,{pmin,pmax,orderS:Number($('calSOrder').value),orderT:Number($('calTOrder').value)});
  st.calfit=solution;st.calImage=null;st.calStaged=false;st.calVerified=false;st.calValidation=[];
  const r=solution.registers;
  $('calCoeffList').textContent=`S_O 0x${h(r.so,2)} (Q3.12)  S_F 0x${h(r.sf,2)} (Q3.12)\n`+r.coeffs.map((x,i)=>`S${i.toString().padEnd(2)} 0x${h(x,2)}    ${(CAL.fromQ(x,15)).toFixed(7)}`).join('\n')+(r.tcoeffs?'\nT_O '+h(r.to,2)+'  T_F '+h(r.tf,2)+'\n'+r.tcoeffs.map((x,i)=>`T${i}: 0x${h(x,2)}`).join('\n'):'\nTemperaturpfad bleibt unverändert (keine Temperaturkorrektur berechnet).');
  const tail=`Max. Fitfehler ${solution.stats.maxDigits.toFixed(2)} Digits; RMS ${solution.stats.rmsDigits.toFixed(2)} Digits; normierter ADC-Höchstwert ${(solution.stats.maxNormalized*100).toFixed(2)} %. `;
  ca('calFitMsg',`Koeffizienten berechnet: ${tail}JavaScript-Fit, nicht identisch mit der Hersteller-DLL. Zuerst im RAM verifizieren.`,solution.stats.maxDigits>100?'warn':'success');
 }catch(e){st.calfit=null;ca('calFitMsg','Berechnung fehlgeschlagen: '+e.message,'error')}}
 async function maintWrite(addr,word){
  // Restricted, never public raw-register interface. Only for controlled calibration/NVM transaction.
  if(!st.calTask||!st.port||!st.chip||!$('allowRam').checked)throw Error('Technischer Wartungszugriff gesperrt');
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
  if(st.iface==='plc'){await exchange('PLC P',3500);await exchange('PLC T',3500)}
  else for(const w of [0xF75A,0x0CC7,0xD21E])await maintWrite(0x22,w);
 }
 async function ramLock(){
  if(st.iface==='plc')return; // No documented PLC relock shortcut; power cycle restores authorization
  try{await maintWrite(0x22,0x62A2)}catch(e){logging('RAM-Sperre: '+e.message)}
 }
 async function nvmWaitIdle(max=12000){
  const start=Date.now();await sleep(25);let stable=0;while(Date.now()-start<max){const flags=await readReg(0x46);if((flags&7)===0){if(++stable>=2)return flags}else stable=0;await sleep(80)}throw Error('NVM-Controller reagiert nicht / Timeout');
 }
 async function nvmReadWord(addr){
  await maintWrite(0x4E,0x4C00|addr);await nvmWaitIdle();return await readReg(0x48);
 }
 async function nvmScan(){
  if(!st.chip||st.mode==='demo'||!$('allowRam').checked||st.writing)throw Error('Echter Chip + RAM-Freigabe nötig');
  st.calTask=true;st.writing=true;stopLive();ca('nvmMsg','NVM wird vollständig gelesen …','warn');
  try{
   const before=await bootSnapshot();await ramGrant();const words=[];
   for(let i=0;i<64;i++){words.push(await nvmReadWord(i*2));$('nvmProgress').textContent=`NVM Backup ${i+1}/64`}
   const crc=CAL.crc16(words);
   if(crc!==words[63])throw Error(`CRC16 im bestehenden NVM ungültig: berechnet 0x${h(crc,2)}, gelesen 0x${h(words[63],2)}. Programmierung nicht zulässig.`);
   const factoryCRC=CAL.crc8(words),factoryHigh=(words[15]>>>8);
   if(factoryCRC!==factoryHigh)throw Error(`Werks-CRC8 stimmt nicht: 0x${h(factoryCRC)} statt 0x${h(factoryHigh)}. Programmierung gesperrt.`);
   for(const index of [0,1,15,16,17,18,19,20,22,27,28,63])if(await nvmReadWord(index*2)!==words[index])throw Error('NVM bei Wiederholungslesung unstabil (Wort '+index+')');
   const after=await bootSnapshot();if(!sameBoot(before,after))throw Error('Bootregister haben sich beim NVM-Lesen verändert');
   st.nvmBackup=words;st.nvmBackupVerified=true;st.calImage=null;st.calVerified=false;
   ca('nvmMsg',`Vollständiges 64-Wort-Backup gelesen, CRC8 und CRC16 bestätigt. Chipkennung SER0/SER1: ${h(words[1],2)}${h(words[0],2)}. Backup jetzt herunterladen.`,'success');
  }catch(e){st.nvmBackup=null;st.nvmBackupVerified=false;ca('nvmMsg','NVM-Backup fehlgeschlagen: '+e.message,'error')}
  finally{await ramLock();st.calTask=false;st.writing=false;renderStatus();}
 }
 async function applyCalRam(){
  try{
   if(!st.calfit||!st.chip||!$('allowRam').checked||st.writing)throw Error('Berechnung, USB-Verbindung und manuelle RAM-Freigabe nötig');
   if(!st.nvmBackupVerified)throw Error('Vorher vollständiges NVM-Backup im letzten Schritt lesen.');
   st.calTask=true;st.writing=true;stopLive();const before=await bootSnapshot();await ramGrant();
   const r=st.calfit.registers;
   const changes=[[0x70,r.so],[0x72,r.sf],...r.coeffs.map((v,i)=>[0x74+2*i,v])];
   if(r.tcoeffs)changes.push([0x6C,r.to],[0x6E,r.tf],...r.tcoeffs.map((v,i)=>[0x94+2*i,v]));
   for(const [addr,value] of changes){await maintWrite(addr,value);const actual=await readReg(addr);if(actual!==value)throw Error(`DSP-RAM Rücklesefehler 0x${h(addr)}: 0x${h(actual,2)} statt 0x${h(value,2)}`)}
   if(!sameBoot(before,await bootSnapshot()))throw Error('Bootregister nach Kalibrier-RAM-Schreiben verändert');
   st.calStaged=true;st.calVerified=false;st.calValidation=[];ca('calRamMsg',`${changes.length} DSP-Koeffizienten/Rohwert-Skalierungen in RAM geschrieben und rückgelesen. Jetzt mit einem unabhängigen Druckpunkt die echte DSP_S-Ausgabe prüfen.`,'success');
  }catch(e){st.calStaged=false;st.calVerified=false;ca('calRamMsg','RAM-Übernahme fehlgeschlagen: '+e.message,'error')}
  finally{await ramLock();st.calTask=false;st.writing=false;renderStatus()}
 }
 async function verifyCalRam(){try{
   if(!st.calStaged||!st.calfit||!st.chip||st.calTask)throw Error('Koeffizienten zuerst im RAM übernehmen / anderer Vorgang läuft');
   const p=Number($('calVerifyPressure').value),pmin=Number($('pmin').value),pmax=Number($('pmax').value),tol=Number($('calVerifyTolerance').value);
   if(!Number.isFinite(p)||!(p>pmin&&p<pmax)||!Number.isFinite(tol)||tol<=0)throw Error('Unabhängigen Prüfdruck innerhalb des Bereichs eingeben');
   const got=P.sign16(await readReg(0x30)),target=64000*(p-pmin)/(pmax-pmin)-32000;
   const stat=await readReg(0x32),delta=got-target,errorBar=delta/64000*(pmax-pmin);
   if(stat&(1<<10))throw Error('DSP-Sättigung erkannt (STATUS_SYNC.dsp_sat). Programmierung gesperrt.');
   if(Math.abs(errorBar)>tol){st.calValidation=[];st.calVerified=false;throw Error(`DSP_S ${got}: Abweichung ${errorBar.toFixed(4)} bar über Toleranz ${tol} bar`)}
   st.calValidation=st.calValidation.filter(x=>Math.abs(x.pressure-p)>(pmax-pmin)*0.10);
   st.calValidation.push({pressure:p,actual:got,expected:target,errorBar,temperature:Number($('calVerifyTemperature').value),measuredTemp:P.sign16(await readReg(0x2E))});
   const distinct=st.calValidation.length>=2;
   const temperatureValidation=st.calfit.orderT===0||((Math.max(...st.calValidation.map(x=>x.temperature))-Math.min(...st.calValidation.map(x=>x.temperature)))>=10 && st.calValidation.every(x=>Number.isFinite(x.temperature)&&Math.abs(x.measuredTemp-(387.88*x.temperature-16485))<=Math.max(100,tol*64000/(pmax-pmin))));
   st.calVerified=distinct&&temperatureValidation;
   ca('calRamMsg',`DSP_S ${got} · Soll ${target.toFixed(1)} Digits · Fehler ${errorBar.toFixed(5)} bar · ${st.calValidation.length} unabhängige Prüfpunkte. ${st.calVerified?'RAM-Verifikation bestanden':'Weitere unabhängige Prüfpunkte erforderlich'}`,st.calVerified?'success':'warn');
  }catch(e){st.calVerified=false;ca('calRamMsg','DSP-Verifikation: '+e.message,'error')}
 }
 function prepareNvm(){try{if(st.calTask||st.writing)throw Error('Wartungsvorgang läuft');
  if(!st.nvmBackupVerified||!st.calfit||!st.calVerified||!st.calStaged)throw Error('NVM-Backup, berechnete Koeffizienten und bestandene echte DSP-RAM-Verifikation nötig');
  const image=CAL.configFrom(st.nvmBackup,st.calfit,st.afe??0x800);
  if(image.changes.some(c=>c.index<28||c.index===29||c.index===30))throw Error('Unerlaubtes NVM-Register im Änderungsplan');
  if(image.changes.length===0)throw Error('Keine NVM-Änderungen nötig');
  st.calImage=image;$('nvmDiff').textContent=image.changes.map(c=>`NVM 0x${h(c.address)} [${c.index}] 0x${h(c.from,2)} → 0x${h(c.to,2)}`).join('\n');
  ca('nvmMsg',`${image.changes.length} von 64 Wörtern werden geändert (CRC16 zuletzt). Werksbereich 0x00–0x1E und alle Boot-/Kommunikationsregister bleiben exakt erhalten.`,`warn`);
 }catch(e){st.calImage=null;ca('nvmMsg','Vorbereitung: '+e.message,'error')}
 }
 async function nvmProgram(){
  if(st.nvmWorking||st.writing)return;
  let chipProgrammingStarted=false;
  try{
   if(st.mode!=='usb'||!st.chip||!st.port||!$('allowRam').checked||!st.nvmBackupVerified||!st.calImage||!st.calVerified)throw Error('Hardware, Sicherungen oder Kalibrierverifikation fehlen');
   if(!$('nvmConfirm').checked)throw Error('Risikohinweis muss ausdrücklich bestätigt sein');
   const id=h(st.nvmBackup[1],2)+h(st.nvmBackup[0],2);
   if($('nvmConfirmId').value.trim().toUpperCase()!==id)throw Error('Chipkennung stimmt nicht');
   if($('nvmConfirmWord').value.trim()!=='PROGRAMMIEREN')throw Error('Bestätigungswort fehlt');
   const initial=st.calImage.before,modified=st.calImage.after;
   if(CAL.crc16(initial)!==initial[63]||CAL.crc16(modified)!==modified[63])throw Error('CRC16-Prüfung fehlgeschlagen');
   if(st.calfit.stats.maxDigits>100)throw Error('Fitfehler zu gross (>100 Digits)');
   if(st.calImage.changes.some(c=>c.index<28||![28,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,31,32,51,52,53,54,63].includes(c.index)))throw Error('Unzulässige NVM-Änderung');
   st.nvmWorking=true;st.calTask=true;st.writing=true;stopLive();lsSet('elmos8-prewrite-backup',JSON.stringify({id,words:initial,ts:new Date().toISOString()}));
   ca('nvmMsg','NVM wird programmiert. USB-Verbindung nicht trennen, Versorgung stabil halten.','warn');
   const beforeBoot=await bootSnapshot();await ramGrant();
   for(const i of [0,1,16,17,18,19,20,21,22,23,27,28,63]){const check=await nvmReadWord(i*2);if(check!==initial[i])throw Error(`Chip-NVM hat sich seit dem Backup verändert (Index ${i})`)}
   for(let i=0;i<28;i++)if(modified[i]!==initial[i])throw Error('Boot-/Werksbereich verändert');
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
   st.nvmDone=true;st.nvmBackup=after;st.nvmBackupVerified=true;st.calImage=null;lsSet('elmos8-last-program',JSON.stringify({id,words:after,ts:new Date().toISOString()}));
   ca('nvmMsg',`NVM-Programmierung, vollständiges Rücklesen und CRC16 erfolgreich. Jetzt Versorgung kontrolliert neu starten und Schnittstellen erneut prüfen.`,`success`);
  }catch(e){ca('nvmMsg',`NVM-Vorgang fehlgeschlagen: ${e.message}.${chipProgrammingStarted?' NVM-Schreibversuch wurde bereits begonnen: Chip nicht unkontrolliert neu starten, Backup und Diagnose sichern!':' Es wurden keine NVM-Schreibbefehle gestartet.'}`,'error');logging('NVM FEHLER: '+e.message)}
  finally{if(st.calTask){try{await maintWrite(0x4E,0x0000)}catch(e){logging('NVM-Zugriffssperre: '+e.message)}await ramLock()};st.nvmWorking=false;st.calTask=false;st.writing=false;$('nvmConfirm').checked=false;$('nvmConfirmWord').value='';renderStatus()}
 }
 async function postBootCheck(){try{
   if(!$('nvmRebootConfirm').checked)throw Error('Zuerst bestätigen, dass der Chip tatsächlich neu gestartet wurde');
   if(!st.chip||st.mode==='demo'||!$('allowRam').checked)throw Error('Erneut verbinden und RAM-Freigabe aktivieren');
   const saved=lsGet('elmos8-last-program');if(!saved)throw Error('Kein erfolgreiches früheres NVM-Programmierprotokoll im Browser');
   const expected=JSON.parse(saved);if(!expected.words||expected.words.length!==64)throw Error('Vorheriges NVM-Backup ungültig');
   await nvmScan();if(!st.nvmBackupVerified)throw Error('NVM nach Neustart nicht lesbar');
   const nowId=h(st.nvmBackup[1],2)+h(st.nvmBackup[0],2);
   if(nowId!==expected.id)throw Error('Anderer Chip angeschlossen');
   if(st.nvmBackup.some((v,i)=>expected.words[i]!==v))throw Error('NVM nach Neustart weicht vom programmierten Abbild ab');
   const boot=await bootSnapshot();for(const [index,addr] of [[16,4],[17,6],[18,8],[19,10],[20,12],[22,16]])if(boot[addr]!==st.nvmBackup[index])throw Error('RAM-Bootregister 0x'+h(addr)+' weicht vom NVM-Backup ab');
   await readADC();ca('nvmMsg','NVM nach Neustart vollständig rückgelesen: CRC8, CRC16, Bootregister und ADC erfolgreich geprüft.','success');
 }catch(e){ca('nvmMsg','Neustart-Verifikation: '+e.message,'error')}
 }
 // controls
 $('calPointCapture').addEventListener('click',captureCalPoint);
 $('calPointClear').addEventListener('click',()=>{st.calpoints=[];st.calfit=null;st.calImage=null;st.calVerified=false;st.calValidation=[];renderCalPoints();ca('calPointsMsg','Alle Kalibriermesspunkte verworfen.');});
 $('calCalculate').addEventListener('click',calcCoefficients);
 $('calApplyRam').addEventListener('click',applyCalRam);
 $('calVerifyRam').addEventListener('click',verifyCalRam);
 $('nvmBackupRead').addEventListener('click',nvmScan);
 $('nvmBackupSave').addEventListener('click',()=>{if(!st.nvmBackupVerified)return ca('nvmMsg','Zuerst NVM lesen','warn');download('ELMOS_NVM_Backup_'+Date.now()+'.json',JSON.stringify({chipId:h(st.nvmBackup[1],2)+h(st.nvmBackup[0],2),version:st.firmware,words:st.nvmBackup,checksum:st.nvmBackup[63],created:new Date().toISOString()},null,2))});
 $('nvmPrepare').addEventListener('click',prepareNvm);
 $('nvmProgram').addEventListener('click',nvmProgram);
 $('nvmPostBoot').addEventListener('click',postBootCheck);
 renderCalPoints();
 // ============ Ende Kalibrierung + NVM ============

 // wiring
 document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>step(b.dataset.step)));document.querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>step(b.dataset.next)));
 $('iface').value=lsGet('elmos8-iface')||'plc';if(!ifcfg[$('iface').value])$('iface').value='plc';st.iface=$('iface').value;
 $('tooltips').checked=(lsGet('elmos7-tooltips')??'1')==='1';tipEnabled=$('tooltips').checked;
 $('tooltips').addEventListener('change',()=>{tipEnabled=$('tooltips').checked;lsSet('elmos7-tooltips',tipEnabled?'1':'0');tip.classList.remove('visible')});
 $('iface').addEventListener('change',()=>{if(st.port){$('iface').value=st.iface;show('connMsg','Zur Schnittstellenänderung zuerst USB trennen.','warn');return}st.iface=$('iface').value;lsSet('elmos8-iface',st.iface);renderStatus()});
 $('choose').addEventListener('click',()=>choose());$('auto').addEventListener('click',()=>auto());$('disconnect').addEventListener('click',()=>disconnect());$('demo').addEventListener('click',()=>demo());
 $('readNow').addEventListener('click',()=>readADC().catch(e=>show('adcMsg','ADC: '+e.message,'error')));$('live').addEventListener('click',()=>st.live?stopLive():startLive());
 for(let k of ['pga1','pga2','offset'])$(k).addEventListener('input',()=>gainChange());
 $('allowRam').addEventListener('change',async()=>{if($('allowRam').checked){try{if(!st.port||!st.chip)throw Error('Nur bei echter Chipverbindung freischaltbar');await readBoot();show('writeMsg','RAM-Gain-Änderungen freigeschaltet. Jede Regleränderung wird mit 340 ms Entprellung übertragen, rückgelesen und mit ADC_S verglichen.','warn')}catch(e){$('allowRam').checked=false;show('writeMsg','Schreibfreigabe verweigert: '+e.message,'error')}}else{pendingGain=null;clearTimeout(writeTimer);show('writeMsg','RAM-Schreibfreigabe ausgeschaltet.')};renderStatus()});
 $('readBoot').addEventListener('click',()=>readBoot().catch(e=>logging('Boot-Prüfung: '+e.message)));$('readRegs').addEventListener('click',()=>registerDump());
 $('demoPressure').addEventListener('input',()=>{st.pressure=Number($('demoPressure').value);$('demoPressureVal').textContent=st.pressure.toFixed(1);if(st.mode==='demo')updateADC({s:demoADC(),t:10755,tc:9902},'demo')});$('capLo').addEventListener('click',()=>capture('lo'));$('capHi').addEventListener('click',()=>capture('hi'));$('verify').addEventListener('click',()=>verify());
 $('exportJSON').addEventListener('click',()=>download('ELMOS_Kalibrierprotokoll_'+Date.now()+'.json',JSON.stringify(report(),null,2)));
 $('exportDiag').addEventListener('click',()=>download('ELMOS_USB_Diagnose_'+Date.now()+'.json',JSON.stringify(report(),null,2)));
 $('exportCSV').addEventListener('click',()=>download('ELMOS_ADC_'+Date.now()+'.csv','\uFEFFZeit;ADC_S;ADC_T;ADC_TC;Quelle;PGA1;PGA2;Offset\n'+st.history.map(v=>[v.time,v.adc_s,v.adc_t,v.adc_tc,v.source,v.gains.pga1,v.gains.pga2,v.gains.offset].join(';')).join('\n'),'text/csv;charset=utf-8'));
 Object.assign(HELP,{sorder:'Polynomgrad für die Druck-Kennlinie. Höhere Grade brauchen mehr unabhängige Messpunkte und bergen ein erhöhtes Überanpassungsrisiko.',torder:'Temperaturkompensation. Bei Ordnung 0 wird der bestehende Temperaturpfad im Chip beibehalten. Für Ordnung 1–3 sind Messpunkte bei verschiedenen Temperaturen nötig.',nvm:'Permanenter NVM-Speicher. Ein Stromausfall während der Programmierung kann trotz Schutz der Schnittstellenregister einen CRC-Fehler erzeugen. Vorher Backup und RAM-Test durchführen.'});
 window.addEventListener('beforeunload',e=>{if(st.nvmWorking){e.preventDefault();e.returnValue=''} });
 const tip=$('tip');document.querySelectorAll('.help').forEach(el=>{el.setAttribute('tabindex','0');el.addEventListener('mouseenter',e=>tooltip(e,el));el.addEventListener('mousemove',e=>placeTip(e));el.addEventListener('mouseleave',()=>tip.classList.remove('visible'));el.addEventListener('focus',e=>tooltip(e,el));el.addEventListener('blur',()=>tip.classList.remove('visible'))});function tooltip(e,el){if(!tipEnabled)return;tip.textContent=HELP[el.dataset.help]||'';tip.classList.add('visible');placeTip(e)}function placeTip(e){const rect=e.target?.getBoundingClientRect?.()||{left:25,bottom:25};let x=e.clientX||rect.left,y=e.clientY||rect.bottom;tip.style.left=Math.max(10,Math.min(window.innerWidth-330,x+15))+'px';tip.style.top=Math.max(10,Math.min(window.innerHeight-150,y+16))+'px'}
 if(!navigator.serial||!window.isSecureContext){show('connMsg','Für echte USB-Kommunikation Chrome Desktop über HTTPS oder localhost nutzen. Der Demo-Modus funktioniert auch ohne USB.','warn');$('choose').disabled=true;$('auto').disabled=true;}else{setTimeout(()=>auto().catch(()=>{}),350)}
 gainSummary();renderStatus();step(0);window.addEventListener('resize',draw);
})();
