'use strict';
/* E703.11 Expert tools: read-only factory/boot inspection and chip-bound backups.
   No unrestricted raw writes. Permanent changes remain in the main NVM transaction. */
const ELMOS_EXPERT=(()=>{
 function init({st,CAL,readReg,nvmScan,download,show,stopLive,startLive,lsGet,lsSet,renderFlowState,verificationComplete}){
  const $=id=>document.getElementById(id),hx=v=>Number(v).toString(16).toUpperCase().padStart(4,'0');
  const names={0:'SER0',1:'SER1',2:'RATIO_DAC01',3:'RATIO_DAC23',4:'RATIO_DAC45',15:'CRC8 factory',
   16:'CFG_EN',17:'CFG_SPI_I2C',18:'CFG_PADS0',19:'CFG_PADS1',20:'CFG_PADS2',21:'CFG_PERIOD',22:'CFG_AODO',
   27:'CFG_AFE0',28:'CFG_AFE1',29:'CFG_AFE2',30:'USER',31:'T_O',32:'T_F',33:'S_O',34:'S_F',
   55:'ALARM_LO',56:'ALARM_HI',57:'AODO_O',58:'AODO_F',59:'LIMIT_LO',60:'LIMIT_HI',61:'ERR_MASK',62:'ERR_VAL_HI_LO',63:'CRC16'};
  const uidHex=(v,s1,s0)=>[v,s1,s0].every(x=>Number.isInteger(x)&&x>=0&&x<=65535)?[v,s1,s0].map(hx).join(''):null;
  function valid(x){
   if(!x||!Array.isArray(x.words)||x.words.length!==64||!x.words.every(w=>Number.isInteger(w)&&w>=0&&w<=65535))return false;
   if(!/^[0-9A-F]{12}$/.test(x.uid||''))return false;
   return x.uid.slice(4)===hx(x.words[1])+hx(x.words[0])&&CAL.crc16(x.words)===x.words[63]&&CAL.crc8(x.words)===(x.words[15]>>>8);
  }
  function all(){
   try{const list=JSON.parse(lsGet('elmos-backups-v2')||'[]');return Array.isArray(list)?list.filter(valid).slice(0,50):[]}catch(_){return []}
  }
  const forChip=()=>st.uid?all().filter(b=>b.uid===st.uid.hex):[];
  function renderBackups(){
   const s=$('expertBackupSelect'),backups=forChip(),was=s.value;s.replaceChildren();
   const o=document.createElement('option');o.value='';o.textContent=backups.length?'Letztes abweichendes Backup automatisch wählen':'Kein Backup zu diesem Chip';s.appendChild(o);
   backups.forEach((b,i)=>{const x=document.createElement('option');x.value=String(i);x.textContent=new Date(b.created).toLocaleString('de-CH')+' · '+b.uid+' · '+(b.source||'NVM');s.appendChild(x)});
   if(backups.some((_,i)=>String(i)===was))s.value=was;
   $('expertUidStatus').textContent=st.uid?'Chip-UID: '+st.uid.hex+' · VERSION 0x'+hx(st.uid.version)+' · '+backups.length+' Backup(s) lokal vorhanden':'48-Bit-Chipkennung noch nicht gelesen.';
  }
  async function identify(){
   if(!st.chip||!st.port)throw Error('Kein echter Chip verbunden');
   const version=await readReg(0x38),ser0=await readReg(0x50),ser1=await readReg(0x52),hex=uidHex(version,ser1,ser0);
   if(!hex)throw Error('Chip-ID nicht plausibel');
   st.uid={version,ser0,ser1,hex};renderBackups();
   try{
    const en=await readReg(0x04),mode=(en>>>9)&7,ao=await readReg(0x10);
    if(mode<=6)$('expertOutputMode').value=String(mode);
    if(mode===4)$('expertPwmPeriod').value=String(ao);
    const scale=!!(en&(1<<6));$('expertScaleEnable').checked=scale;
    if(scale){
     $('expertScaleGain').value=String(Number(CAL.fromQ(await readReg(0xA2),12).toFixed(6)));
     $('expertScaleOffset').value=String(Number(CAL.fromQ(await readReg(0xA0),12).toFixed(6)))
    }
    show('expertOutputMsg','Aktueller Chip-Ausgang: '+(mode===1||mode===2||mode===3?'ratiometrisch analog':mode===4?'PWM':mode===5?'FM':mode===6?'Alarm':mode===0?'High-Z':'SDA / Sondermodus')+'. CFG_EN=0x'+hx(en)+', CFG_AODO=0x'+hx(ao)+'. Anzeige wurde nur gelesen, nicht verändert.','success')
   }catch(e){show('expertOutputMsg','Chip-UID erkannt. Ausgangsregister konnten noch nicht vollständig gelesen werden: '+e.message,'warn')}
   return st.uid
  }
  async function onDetect(){try{await identify()}catch(e){st.uid=null;renderBackups();show('expertUidStatus','Chipkennung konnte nicht gelesen werden: '+e.message,'warn')}}
  function save(words,source='NVM gelesen'){
   if(!st.uid||st.uid.ser0!==words[0]||st.uid.ser1!==words[1]||!valid({uid:st.uid.hex,words}))return false;
   const entry={format:'E70311-CM64-v2',uid:st.uid.hex,created:new Date().toISOString(),source,words:words.slice()};
   const old=all(),identical=old.find(b=>b.uid===entry.uid&&b.words.every((w,i)=>w===words[i]));
   lsSet('elmos-backups-v2',JSON.stringify([entry,...old.filter(x=>x!==identical)].slice(0,50)));
   renderBackups();return true
  }
  function dump(){
   $('expertNvmDump').textContent=st.nvmBackupVerified&&st.nvmBackup?
    st.nvmBackup.map((v,i)=>'CM 0x'+hx(2*i)+'  0x'+hx(v)+'  '+(i<16?'FACTORY · NUR LESEN':i<28?'BOOT/KONFIG · GESCHÜTZT':i===63?'CRC16':'USER · DOKUMENTIERTE FUNKTIONEN')+'  '+(names[i]||(i>=35&&i<=50?'S'+(i-35):i>=51&&i<=54?'T'+(i-51):''))).join('\n'):
    'Noch kein vollständiges NVM-Abbild vorhanden.';
  }
  function afterNvmScan(){
   const ok=!!st.nvmBackupVerified&&!!st.nvmBackup;
   if(ok){
    const saved=save(st.nvmBackup,'SSP3-EEPROM-Lesung');
    dump();
    if(!saved)show('expertUidStatus','NVM gelesen, aber 48-Bit-UID nicht bestätigt. Backup nur manuell exportieren, nicht automatisch einem Chip zuordnen.','warn')
   }else dump()
  }
  async function readNvm(){
   try{if(!st.uid)await identify();await nvmScan({expertRead:true});dump()}
   catch(e){show('expertRestoreMsg','EEPROM-Lesen fehlgeschlagen: '+e.message,'error')}
  }
  async function readRegisters(){
   const addrs=[0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,0x26,0x28,0x2A,0x2C,0x30,0x32,0x38,0x46,0x50,0x52,0x6A,0x6C,0x6E,0x70,0x72,0x9C,0x9E,0xA0,0xA2,0xA4,0xA6,0xA8,0xAA];
   const live=st.live;
   try{if(!st.chip)throw Error('Chip nicht verbunden');stopLive();const rows=[];
    for(const addr of [...new Set(addrs)]){
     try{rows.push('0x'+hx(addr)+' = 0x'+hx(await readReg(addr))+' '+(addr===0||addr===2?'FACTORY · NICHT ÄNDERN':addr<=16?'BOOT/KONFIG · GESCHÜTZT':'NUR LESEN'))}
     catch(e){rows.push('0x'+hx(addr)+' · Lesefehler: '+e.message)}
    }
    $('expertRegisterDump').textContent=rows.join('\n')
   }catch(e){$('expertRegisterDump').textContent=e.message}finally{if(live&&st.chip)startLive()}
  }
  const outputValues=()=>({mode:$('expertOutputMode').value,scaleEnabled:$('expertScaleEnable').checked,
   gain:Number($('expertScaleGain').value),offset:Number($('expertScaleOffset').value),pwmPeriod:Number($('expertPwmPeriod').value)});
  function preset(){
   try{
    const mode=Number($('expertOutputMode').value),lim=(st.calfit?.outputLimit??Number($('dspDisplayLimit').value))||30000,period=Number($('expertPwmPeriod').value);
    let gain,offset;
    if(mode>=1&&mode<=3){gain=0.94*26214/lim;offset=0}
    else if(mode===4){if(period<2||period>32767)throw Error('PWM-Periode für Preset zwischen 2 und 32’767 wählen');gain=0.32*period/lim;offset=period*0.5/32768}
    else if(mode===5){gain=11000/lim;offset=14500/32768}
    else throw Error('Preset für ratiometrisch, PWM oder FM wählen');
    $('expertScaleEnable').checked=true;$('expertScaleGain').value=String(Number(gain.toFixed(6)));$('expertScaleOffset').value=String(Number(offset.toFixed(6)));
    show('expertOutputMsg','Sichere Skalierung vorgeschlagen. Bitte kontrollieren und vormerken.','warn')
   }catch(e){show('expertOutputMsg',e.message,'error')}
  }
  function propose(){
   try{
    if(!$('expertMode').checked)throw Error('Expertenmodus ist ausgeschaltet');
    const values=outputValues();
    if(values.mode==='keep'){
     if(st.outputOnlyPlan&&st.calImage===st.outputOnlyPlan)st.calImage=null;
     st.outputOnlyPlan=null;st.expertOutputPlan=null;
     show('expertOutputMsg','Ausgangskonfiguration bleibt unverändert.','success');return
    }
    const limit=st.calfit?.outputLimit??Number($('dspDisplayLimit').value);
    if(!Number.isInteger(limit)||limit<1000||limit>32000)throw Error('DSP-Zielbereich für diesen Sensor zuerst korrekt einstellen');
    const normalCalibration=verificationComplete();
    if(!normalCalibration&&(!st.nvmBackupVerified||!st.nvmBackup||!st.uid))throw Error('Für Ausgangsänderungen an bereits kalibrierten Sensoren zuerst die aktuelle 64-Wort-NVM-Sicherung mit bestätigter UID lesen');
    const before=st.nvmBackupVerified&&st.nvmBackup?st.nvmBackup:Array(64).fill(0);
    const after=CAL.prepareOutputConfig(before,values,limit);
    if(!normalCalibration){
     after[63]=CAL.crc16(after);
     const changes=after.map((v,i)=>v!==before[i]?{index:i,address:i*2,from:before[i],to:v}:null).filter(Boolean);
     if(!changes.length)throw Error('Ausgang ist bereits entsprechend konfiguriert');
     if(changes.some(c=>![16,22,57,58,63].includes(c.index)))throw Error('Nicht erlaubtes Ausgangsregister im Änderungsplan');
     const plan={uid:st.uid.hex,outputOnly:true,limit,before:before.slice(),after,changes};
     st.outputOnlyPlan=plan;st.restorePlan=null;st.calImage=plan;
     st.expertOutputPlan=values;
     show('expertOutputMsg','Ausgangsänderung ohne neuen Druckabgleich vorbereitet: '+changes.length+' NVM-Wörter. Im letzten Schritt UID und AUSGANG SPEICHERN eingeben. Noch nichts am Sensor geändert.','warn')
    }else{
     st.outputOnlyPlan=null;st.restorePlan=null;st.calImage=null;st.expertOutputPlan=values;
     show('expertOutputMsg','Ausgangseinstellung geprüft und in den normalen finalen Kalibrier-NVM-Plan vorgemerkt. Noch nichts am Sensor geändert.','success')
    }
   }catch(e){st.outputOnlyPlan=null;st.expertOutputPlan=null;if(st.calImage?.outputOnly)st.calImage=null;show('expertOutputMsg','Ausgangsvorschlag abgelehnt: '+e.message,'error')}
   renderFlowState()
  }
  function outputReady(){
   return !!($('expertMode').checked&&st.outputOnlyPlan&&st.calImage===st.outputOnlyPlan&&st.nvmBackupVerified&&st.nvmBackup&&st.uid&&
    st.outputOnlyPlan.uid===st.uid.hex&&st.outputOnlyPlan.before.every((v,i)=>v===st.nvmBackup[i]))
  }
  function restoreReady(){
   return !!($('expertMode').checked&&st.restorePlan&&st.nvmBackupVerified&&st.nvmBackup&&st.uid&&st.restorePlan.uid===st.uid.hex&&
    st.restorePlan.before.every((v,i)=>v===st.nvmBackup[i]))
  }
  function prepareRestore(){
   try{
    if(!st.uid||!st.nvmBackupVerified||!st.nvmBackup)throw Error('Zuerst den aktuellen Chip vollständig auslesen und sichern');
    const backups=forChip(),selection=$('expertBackupSelect').value,chosen=selection===''?backups.find(x=>!st.nvmBackup||x.words.some((v,i)=>v!==st.nvmBackup[i])):backups[Number(selection)];
    if(!chosen||!valid(chosen)||chosen.uid!==st.uid.hex)throw Error('Kein gültiges Backup dieser UID');
    const before=st.nvmBackup;
    for(let i=0;i<28;i++)if(before[i]!==chosen.words[i])throw Error('Factory-/Boot-Einstellung 0x'+hx(i*2)+' weicht ab – Wiederherstellung gesperrt');
    const after=before.slice();for(let i=28;i<63;i++)after[i]=chosen.words[i];
    after[63]=CAL.crc16(after);
    if(after[63]!==chosen.words[63])throw Error('CRC stimmt nach Wiederherstellung nicht überein');
    const changes=after.map((v,i)=>v!==before[i]?{index:i,address:i*2,from:before[i],to:v}:null).filter(Boolean);
    if(!changes.length)throw Error('Dieses Backup ist bereits auf dem Chip vorhanden');
    const plan={uid:st.uid.hex,restore:true,before:before.slice(),after,changes,created:chosen.created};
    st.restorePlan=plan;st.outputOnlyPlan=null;st.expertOutputPlan=null;st.calImage=plan;
    $('expertRestoreDiff').textContent=changes.map(x=>'CM 0x'+hx(x.address)+' 0x'+hx(x.from)+' → 0x'+hx(x.to)).join('\n');
    show('expertRestoreMsg',changes.length+' User-NVM-Wörter aus Backup '+new Date(chosen.created).toLocaleString('de-CH')+' zur Wiederherstellung vorgemerkt. Noch nichts geschrieben. Zum NVM-Schritt wechseln, UID + WIEDERHERSTELLEN eingeben.','warn')
   }catch(e){st.restorePlan=null;if(st.calImage?.restore)st.calImage=null;show('expertRestoreMsg','Wiederherstellung abgelehnt: '+e.message,'error')}
   renderFlowState()
  }
  async function importFile(){
   try{
    const file=$('expertBackupImport').files?.[0];if(!file) return;
    const entry=JSON.parse(await file.text());if(!valid(entry))throw Error('Datei ist kein gültiges E703.11-Backup mit UID und CRC');
    if(!st.uid||entry.uid!==st.uid.hex)throw Error('Die Datei gehört nicht zur UID des verbundenen Chips');
    const old=all();lsSet('elmos-backups-v2',JSON.stringify([{...entry,source:'Import '+file.name},...old].slice(0,50)));
    renderBackups();show('expertRestoreMsg','Backup für UID '+entry.uid+' importiert. Keine Änderung am Chip.','success')
   }catch(e){show('expertRestoreMsg','Import abgelehnt: '+e.message,'error')}
  }
  function exportCurrent(){
   if(!st.nvmBackupVerified||!st.nvmBackup||!st.uid||st.uid.ser0!==st.nvmBackup[0]||st.uid.ser1!==st.nvmBackup[1]){
    show('expertRestoreMsg','Vor dem Export komplettes NVM und die UID lesen.','error');return
   }
   const created=new Date().toISOString();
   const entry={format:'E70311-CM64-v2',uid:st.uid.hex,created,source:'Manueller Export',words:st.nvmBackup.slice(),version:st.uid.version};
   download('ELMOS_E70311_UID_'+st.uid.hex+'_'+created.replace(/[:.]/g,'-')+'.json',JSON.stringify(entry,null,2));
  }
  $('expertMode').addEventListener('change',()=>{
   $('expertPanel').hidden=!$('expertMode').checked;
   if($('expertMode').checked)renderBackups();
   else {if((st.restorePlan&&st.calImage===st.restorePlan)||(st.outputOnlyPlan&&st.calImage===st.outputOnlyPlan))st.calImage=null;st.restorePlan=null;st.outputOnlyPlan=null;}
   renderFlowState()
  });
  $('expertIdentify').addEventListener('click',()=>identify().catch(e=>show('expertUidStatus',e.message,'error')));
  $('expertNvmRead').addEventListener('click',readNvm);
  $('expertNvmExport').addEventListener('click',exportCurrent);
  $('expertRegistersRead').addEventListener('click',readRegisters);
  $('expertOutputPreset').addEventListener('click',preset);
  $('expertOutputStage').addEventListener('click',propose);
  $('expertOutputDiscard').addEventListener('click',()=>{st.expertOutputPlan=null;st.outputOnlyPlan=null;st.calImage=null;show('expertOutputMsg','Ausgangsänderungen verworfen.','success');renderFlowState()});
  $('expertRestorePreview').addEventListener('click',prepareRestore);
  $('expertBackupImport').addEventListener('change',importFile);
  renderBackups();
  return {onDetect,identify,afterNvmScan,restoreReady,outputReady,prepareRestore,exportCurrent,renderBackups,validBackup:valid}
 }
 return {init}
})();
