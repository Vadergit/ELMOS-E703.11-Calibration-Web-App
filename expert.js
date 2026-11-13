'use strict';
/* E703.11 Expert tools: read-only factory/boot inspection and chip-bound backups.
   No unrestricted raw writes. Permanent changes remain in the main NVM transaction. */
const ELMOS_EXPERT=(()=>{
 function init({st,CAL,readReg,nvmScan,download,show,stopLive,startLive,lsGet,lsSet,renderFlowState,verificationComplete,withProgress}){
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
    const en=await readReg(0x04),chipMode=(en>>>9)&7,ao=await readReg(0x10);
    // Initial type follows the chip only when the operator has not already selected
    // an output; target S0/S1 and proposed scaling are NEVER loaded from chip RAM.
    if(!modeChoiceEdited&&!st.expertOutputPlan&&!st.outputOnlyPlan&&chipMode>=1&&chipMode<=5)
     $('expertOutputMode').value=String(chipMode);
    const enabled=!!(en&(1<<6));
    const gainRaw=enabled?await readReg(0xA2):null,offsetRaw=enabled?await readReg(0xA0):null;
    const gain=enabled?CAL.fromQ(gainRaw,12):1,offset=enabled?CAL.fromQ(offsetRaw,12):0;
    const modeLabel={0:'High-Z',1:'Analog Ratiometric · DAC 0',2:'Analog Ratiometric · DAC 1',3:'Analog Ratiometric · DAC 2',4:'PWM',5:'FM',6:'Alarm',7:'SDA'};
    const status=$('psscCurrentOutputStatus');
    if(status){
     const lim=currentLimit(),vdd=Number($('psscVdd').value);
     const voltage=chipMode>=1&&chipMode<=3&&Number.isFinite(vdd)&&Number.isFinite(lim)?
      ' · Bei angenommenem DSP-Bereich ±'+lim+' und VDD '+vdd+' V: etwa '+((offset*32768-gain*lim)/32768*vdd/2+vdd/2).toFixed(5)+'–'+((offset*32768+gain*lim)/32768*vdd/2+vdd/2).toFixed(5)+' V':'';
     status.textContent='Aus dem Chip gelesen (RAM, nur Information): '+(modeLabel[chipMode]||'Unbekannt')+
      ' · scale_en '+(enabled?'ein':'aus')+' · AODO_F '+(enabled?gain.toFixed(6):'nicht aktiv')+
      ' · AODO_O '+(enabled?offset.toFixed(6):'nicht aktiv')+
      ' · CFG_EN=0x'+hx(en)+' · CFG_AODO=0x'+hx(ao)+voltage+
      '. Die gewünschten S0/S1-Werte werden dadurch nicht überschrieben.';
     status.className='callout'+(chipMode<1||chipMode>5?' warn':'');
    }
    // Reading the existing chip must NEVER overwrite proposed S0/S1 values,
    // their automatically calculated Gain/Offset, or an already staged proposal.
    // E703.11 DS 6.3.2.6 / 6.4.1.1.
    if(!st.expertOutputPlan&&!st.outputOnlyPlan&&!manualScaling&&isAnalog($('expertOutputMode').value)){
     try{calculateAnalogScaling()}catch(e){show('expertOutputMsg','Ziel-Skalierung ungültig: '+e.message,'warn')}
    }
    refreshOutputReadOnly();
    renderOutputMode();
    show('expertOutputMsg','Chip-Ausgangsregister gelesen, gewünschte S0/S1-Zielspannungen unverändert. Neue Einstellungen erst mit «Ausgangskonfiguration prüfen und vormerken» übernehmen.','success');
   }catch(e){show('expertOutputMsg','Chip-UID erkannt. Ausgangsregister konnten noch nicht vollständig gelesen werden: '+e.message,'warn')}
   return st.uid
  }
  async function onDetect(){try{await identify()}catch(e){st.uid=null;renderBackups();show('expertUidStatus','Chipkennung konnte nicht gelesen werden: '+e.message,'warn')}}
  function save(words,source='NVM gelesen'){
   if(!st.uid||st.uid.ser0!==words[0]||st.uid.ser1!==words[1]||!valid({uid:st.uid.hex,words}))return false;
   const entry={format:'E70311-CM64-v2',uid:st.uid.hex,created:new Date().toISOString(),source,words:words.slice()};
   const old=all(),identical=old.find(b=>b.uid===entry.uid&&b.words.every((w,i)=>w===words[i]));
   lsSet('elmos-backups-v2',JSON.stringify([entry,...old.filter(x=>x!==identical)].slice(0,50)));
   renderBackups();
   // A successful call must mean the data actually survived the browser storage write.
   return all().some(x=>x.uid===entry.uid&&x.words.every((w,i)=>w===entry.words[i]))
  }
  function nvmName(i){
   const factory={5:'ABS_V_DAC01',6:'ABS_V_DAC23',7:'ABS_V_DAC45',8:'ABS_I_DAC01',9:'ABS_I_DAC23',10:'ABS_I_DAC45',11:'G01',12:'G2OFF',13:'CFG_CAL0',14:'CFG_CAL1'};
   return names[i]||factory[i]||(i>=35&&i<=50?'S'+(i-35):i>=51&&i<=54?'T'+(i-51):'CM_W'+i);
  }
  // UI-only expansion state. It is cleared whenever the verified chip identity changes.
  const expandedEEPROM=new Set();
  let eepromViewerUid=null;
  function refreshEEPROMViewer(){
   // Keep the existing verified-NVM/UID gate. No reads and no writes from expanding a row.
   const valid=!!(st.mode==='usb'&&st.port&&st.chip&&st.uid&&st.nvmBackupVerified&&
    Array.isArray(st.nvmBackup)&&st.nvmBackup.length===64&&
    st.uid.ser0===st.nvmBackup[0]&&st.uid.ser1===st.nvmBackup[1]);
   const rows=$('eepromRows'),filter=($('eepromSearch').value||'').trim().toLowerCase();
   rows.replaceChildren();
   $('eepromExport').disabled=!valid||!st.uid;
   if(!valid){
    expandedEEPROM.clear();eepromViewerUid=null;
    const tr=document.createElement('tr'),td=document.createElement('td');
    td.colSpan=6;td.textContent='Noch keine gültigen EEPROM-Daten. «EEPROM lesen» starten.';
    tr.appendChild(td);rows.appendChild(tr);
    $('eepromStatus').textContent='Noch kein vollständiges 64-Wort-EEPROM mit gültiger CRC vorhanden. Lesezugriff benötigt einen verbundenen Chip.';
    $('eepromStatus').className='callout';
    $('expertNvmDump').textContent='Noch kein komplettes EEPROM-Abbild gelesen.';
    return;
   }
   if(eepromViewerUid!==st.uid.hex){expandedEEPROM.clear();eepromViewerUid=st.uid.hex}
   const fragment=document.createDocumentFragment(),expertDetails=$('expertMode').checked;
   let matched=0;
   const elem=(tag,className,content)=>{
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(content!==undefined)el.textContent=String(content);
    return el;
   };
   for(let i=0;i<64;i++){
    const value=st.nvmBackup[i],word=ELMOS_EEPROM_HELP.describe(i,value),
     name=word.name,address=word.wordHex.slice(2),signed=word.signed,protection=word.protection;
    if(filter&&!word.search.includes(filter))continue;
    matched++;
    const row=document.createElement('tr');
    row.className=(i<16?'nvm-factory':i<28?'nvm-boot':i===63?'nvm-crc':'')+' eeprom-data-row';
    const addressCell=elem('td');
    const open=expandedEEPROM.has(i);
    const toggle=elem('button','eeprom-expand',(open?'▾':'▸')+' '+address);
    toggle.type='button';toggle.setAttribute('aria-expanded',String(open));
    toggle.setAttribute('aria-label',(open?'Details schliessen: ':'Details öffnen: ')+name+', EEPROM-Wort '+address);
    toggle.addEventListener('click',()=>{
     if(expandedEEPROM.has(i))expandedEEPROM.delete(i);else expandedEEPROM.add(i);
     const scroll=$('eepromTableScroll'),top=scroll.scrollTop;
     refreshEEPROMViewer();
     scroll.scrollTop=top;
    });
    addressCell.appendChild(toggle);row.appendChild(addressCell);
    for(const [text,className] of [[name,'eeprom-register'],[word.rawHex,'eeprom-raw'],[String(signed),'eeprom-number'],[word.short,'eeprom-function'],[protection,'eeprom-protection']]){
     row.appendChild(elem('td',className,text));
    }
    fragment.appendChild(row);
    if(open){
     const detailRow=elem('tr','eeprom-detail-row'),detailCell=elem('td');
     detailCell.colSpan=6;
     const detail=elem('div','eeprom-detail');
     detail.appendChild(elem('h3','',word.name+' – '+word.short));
     detail.appendChild(elem('p','eeprom-detail-description',word.description));
     const meta=elem('dl','eeprom-meta');
     const entries=[
      ['EEPROM-Wortindex',word.wordHex+' ('+word.index+')'],
      ['EEPROM-Byteadresse',word.byteHex+' (Index × 2)'],
      ['RAM-Register',word.ramHex||'Nicht sicher zugeordnet'],
      ['Rohwert',word.rawHex+' / '+word.unsigned+' unsigned'],
      ['Signed 16 Bit',String(word.signed)],
      ['Format',word.format]
     ];
     if(word.interpreted!==null)entries.push(['Umrechnungswert',word.interpreted+' ('+word.format+')']);
     for(const [label,value] of entries){
      const item=elem('div','eeprom-meta-item');
      item.appendChild(elem('dt','',label));item.appendChild(elem('dd','',value));
      meta.appendChild(item);
     }
     detail.appendChild(meta);
     if(word.formula){
      const formula=elem('p','eeprom-formula');
      formula.appendChild(elem('strong','', 'Zusammenhang: '));
      formula.appendChild(document.createTextNode(word.formula));
      detail.appendChild(formula);
     }
     if(word.interpreted!==null)detail.appendChild(elem('p','eeprom-small','Festkommawert = vorzeichenbehafteter 16-Bit-Rohwert / '+(word.format==='Q3.12'?'4096':'32768')+'. Nicht mit einer gemessenen Spannung gleichsetzen.'));
     if(expertDetails){
      const advanced=elem('section','eeprom-bit-detail');
      advanced.appendChild(elem('h4','', 'Expertenansicht · Rohbits und bekannte Bitfelder'));
      advanced.appendChild(elem('div','eeprom-binary',word.binary));
      if(word.fields.length){
       const bitTable=elem('table','eeprom-bit-table');
       const thead=elem('thead'),header=elem('tr');
       for(const field of ['Bits','Bezeichnung','Code','Bedeutung'])header.appendChild(elem('th','',field));
       thead.appendChild(header);bitTable.appendChild(thead);
       const body=elem('tbody');
       for(const field of word.fields){
        const tr=elem('tr');
        for(const text of [field.bits,field.name,field.raw,field.meaning])tr.appendChild(elem('td','',text));
        body.appendChild(tr);
       }
       bitTable.appendChild(body);advanced.appendChild(bitTable);
      }else advanced.appendChild(elem('p','eeprom-small','Keine verifizierte Bitfeld-Aufschlüsselung vorhanden; die Binärdarstellung ist nur eine Rohwertansicht.'));
      detail.appendChild(advanced);
     }else if(word.fields.length)detail.appendChild(elem('p','eeprom-small','Für Bitpositionen und Einzelcodes den Expertenmodus in den Einstellungen aktivieren.'));
     detail.appendChild(elem('p','eeprom-small','Alle Angaben sind Diagnoseinformationen aus dem geprüften EEPROM-Abbild. Hier werden keine Register verändert.'));
     detailCell.appendChild(detail);detailRow.appendChild(detailCell);fragment.appendChild(detailRow);
    }
   }
   if(!matched){const tr=elem('tr'),td=elem('td');td.colSpan=6;td.textContent='Keine EEPROM-Wörter für diese Suche.';tr.appendChild(td);fragment.appendChild(tr)}
   rows.appendChild(fragment);
   const status=CAL.oneWireStartupStatus(st.nvmBackup);
   $('eepromStatus').textContent='EEPROM: 64 Wörter gelesen, CRC8/CRC16 bestätigt. '+matched+' sichtbar. Chip-ID: '+(st.uid?.hex||'noch nicht bestätigt')+
    '. 1-Wire-Startbedingungen: '+(status.ok?'softwareseitig plausibel':'nicht erfüllt – NVM-Schreiben wird gesperrt')+'. Alle Wörter bleiben hier nur lesbar.';
   $('eepromStatus').className='callout '+(status.ok?'success':'warn');
   $('expertNvmDump').textContent=st.nvmBackup.map((v,i)=>'CM '+(i*2).toString(16).toUpperCase().padStart(2,'0')+'  0x'+hx(v)+'  '+
    (i<16?'FACTORY · NUR LESEN':i<28?'BOOT/KONFIG · GESCHÜTZT':i===63?'CRC16':'USER')+'  '+nvmName(i)).join('\n');
  }
  const dump=refreshEEPROMViewer;
  function archiveCurrentNvm(source='Vor NVM-Programmierung'){
   return !!(st.nvmBackupVerified&&st.nvmBackup&&save(st.nvmBackup,source))
  }
  function afterNvmScan(){
   const ok=!!st.nvmBackupVerified&&!!st.nvmBackup;
   if(ok){
    const saved=save(st.nvmBackup,'SSP3-EEPROM-Lesung');
    dump();refreshOutputReadOnly();
    if(!saved)show('expertUidStatus','NVM gelesen, aber 48-Bit-UID nicht bestätigt. Backup nur manuell exportieren, nicht automatisch einem Chip zuordnen.','warn')
   }else dump()
  }
  async function readNvm(){
   if(st.calTask||st.writing||st.nvmWorking){show('eepromStatus','Ein anderer Chipvorgang läuft. EEPROM kann gerade nicht gelesen werden.','warn');return}
   try{
    if(!st.uid)await identify();
    $('eepromRead').disabled=true;
    show('eepromStatus','EEPROM wird vollständig gelesen und mit CRC8/CRC16 geprüft …','warn');
    const ok=await nvmScan({expertRead:true});
    refreshEEPROMViewer();
    if(!ok)show('eepromStatus','EEPROM-Lesen fehlgeschlagen. Bitte Chipverbindung und Diagnoselog kontrollieren.','error');
   }catch(e){show('eepromStatus','EEPROM-Lesen fehlgeschlagen: '+e.message,'error');show('expertRestoreMsg','EEPROM-Lesen fehlgeschlagen: '+e.message,'error')}
   finally{$('eepromRead').disabled=!st.port||!st.chip||st.calTask||st.writing||st.nvmWorking;}
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
   gain:Number($('expertScaleGain').value),offset:Number($('expertScaleOffset').value),pwmPeriod:Number($('expertPwmPeriod').value),
   clipping:isAnalog($('expertOutputMode').value)?{mode:$('outputClippingMode').value,
    low:$('outputClipLow').valueAsNumber,high:$('outputClipHigh').valueAsNumber,
    vdd:Number($('psscVdd').value)}:undefined});

  let manualScaling=false,modeChoiceEdited=false;
  const isAnalog=mode=>['1','2','3'].includes(String(mode));
  function currentLimit(){
   // A new calibration owns its DSP endpoint range; an already-calibrated sensor
   // without captured points uses its explicit read-only display range instead.
   // Never confuse ADC_S's recommended ±25k window with the DSP_S range.
   const selected=Number($('calDspLimit').value);
   if(st.calfit)return st.calfit.outputLimit;
   if(st.calpoints?.length||$('calDspLimit').dataset.userEdited==='1')return selected;
   return Number($('dspDisplayLimit').value);
  }
  function invalidateOutputPlan(){
   // Any output edit invalidates ALL previously prepared NVM images, including normal calibration and restore plans.
   st.calImage=null;st.restorePlan=null;st.outputOnlyPlan=null;st.expertOutputPlan=null;
   show('expertOutputMsg','Ausgangseinstellungen geändert. Bitte erneut prüfen und vormerken. Am Chip wurde nichts geändert.','warn');
   renderFlowState();
  }
  function refreshOutputReadOnly(){
   $('psscDigitalType').value=!st.chip?'SSP3-Verbindung noch nicht bestätigt':st.iface==='plc'?'1-Wire über AODO (SSP3)':st.iface==='i2c'?'I²C (SSP3)':st.iface==='spi'?'SPI (SSP3)':'Nicht erkannt';
   const words=st.nvmBackupVerified&&st.nvmBackup?.length===64?st.nvmBackup:null;
   $('psscLimitLow').value=words?String(CAL.signed(words[59]))+' · Rohwert':'';
   $('psscLimitHigh').value=words?String(CAL.signed(words[60]))+' · Rohwert':'';
   $('psscErrorRaw').value=words?'0x'+hx(words[61])+' / 0x'+hx(words[62]):'NVM zuerst lesen';
   const status=$('psscOneWireOnlyStatus'),selected=$('expertOutputMode').value==='onewire';
   status.hidden=!selected;
   if(selected){
    const check=words?CAL.oneWireOnlyStatus(words):null;
    status.textContent=!check?
     'One Wire only prüfen: Zuerst das vollständige Original-NVM (64 Wörter) lesen und die Chip-UID bestätigen. Es werden keine Kommunikationsregister automatisch geändert.':
     check.ok?
      'One Wire only bereits im Original-NVM aktiv: permanentes 1-Wire (plc_en=1), AODO-Modus '+check.mode+
      ', Downstream/Upstream und persistenter Registerzugriff vorhanden. Die analoge/PWM/FM-Ausgabe wird von 1-Wire überlagert. Die Auswahl erfordert KEINE Änderung der Bootregister.':
      'One Wire only kann nicht sicher vorgemerkt werden: '+check.errors.join('; ')+'. Keine automatische Bootregister-Umstellung.';
    status.className='callout '+(check?.ok?'success':'warn');
   }
  }
  function renderOutputPreview(){
   const mode=$('expertOutputMode').value,limit=currentLimit();
   $('psscOutputLimit').value=Number.isInteger(limit)?'±'+limit.toLocaleString('de-CH'):'Ungültig';
   const label=$('psscScalingSource');
   if(label){
    const fresh=!!st.calfit||!!st.calpoints?.length||$('calDspLimit').dataset.userEdited==='1';
    label.textContent=fresh?'DSP-Bereich automatisch aus «Berechnen & RAM» übernommen. ADC_S ±25’000 ist davon unabhängig.':'Bestehender Sensor: DSP-Bereich aus der Anzeigeeinstellung übernommen. Bereich bei Bedarf dort korrigieren.';
   }
   $('psscDspS0').textContent=Number.isInteger(limit)?'−'+limit.toLocaleString('de-CH'):'—';
   $('psscDspS1').textContent=Number.isInteger(limit)?'+'+limit.toLocaleString('de-CH'):'—';
   if(!isAnalog(mode))return;
   const vdd=Number($('psscVdd').value);
   const gain=$('expertScaleEnable').checked?Number($('expertScaleGain').value):1;
   const offset=$('expertScaleEnable').checked?Number($('expertScaleOffset').value):0;
   let msg,invalid=false;
   if(!Number.isFinite(vdd)||vdd<2.7||vdd>5.5||!Number.isInteger(limit)||limit<1000||limit>32000||!Number.isFinite(gain)||!Number.isFinite(offset)){
    msg='VDD oder DSP-Endwert ungültig.';invalid=true;
   }else{
    const lo=offset*32768-gain*limit,hi=offset*32768+gain*limit;
    const v0=(lo/32768+1)*vdd/2,v1=(hi/32768+1)*vdd/2;
    invalid=lo< -26214||hi>26214||lo>=hi;
    msg='Berechnet nach Q3.12: S0 = '+v0.toFixed(5)+' V ('+(100*v0/vdd).toFixed(3)+' % VDD) · S1 = '+v1.toFixed(5)+' V ('+(100*v1/vdd).toFixed(3)+' % VDD). '+(invalid?'Ausserhalb des linearen 10–90-%-Bereichs; nicht freigegeben.':'Nur Vorschau, keine Chipprogrammierung.');
   }
   $('psscScalingPreview').textContent=msg;$('psscScalingPreview').classList.toggle('invalid',invalid);
  }
  function calculateAnalogScaling(){
   if(!isAnalog($('expertOutputMode').value))throw Error('S0/S1 in Volt nur für Analog Ratiometric verfügbar');
   for(const id of ['psscVdd','psscS0','psscS1'])if($(id).value.trim()==='')throw Error('Bitte S0, S1 und VDD vollständig eingeben');
   const result=CAL.analogScaling(Number($('psscS0').value),Number($('psscS1').value),Number($('psscVdd').value),currentLimit());
   $('expertScaleEnable').checked=true;
   $('expertScaleGain').value=String(result.gain);$('expertScaleOffset').value=String(result.offset);
   manualScaling=false;renderOutputPreview();return result;
  }
  function preset(){
   try{
    const mode=Number($('expertOutputMode').value),lim=currentLimit(),period=Number($('expertPwmPeriod').value);
    if(isAnalog(mode)){
     const result=calculateAnalogScaling();invalidateOutputPlan();
     show('expertOutputMsg','Scaling: S0 = '+result.actualVolts[0].toFixed(5)+' V, S1 = '+result.actualVolts[1].toFixed(5)+' V. Bitte prüfen und vormerken.','success');return;
    }
    let gain,offset;
    if(mode===4){if(!Number.isInteger(period)||period<2||period>32767)throw Error('PWM-Periode für Vorschlag zwischen 2 und 32’767 wählen');gain=0.32*period/lim;offset=period*0.5/32768;}
    else if(mode===5){gain=11000/lim;offset=14500/32768}
    else throw Error('Scaling nur für Analog Ratiometric, PWM oder FM');
    $('expertScaleEnable').checked=true;$('expertScaleGain').value=String(Number(gain.toFixed(6)));$('expertScaleOffset').value=String(Number(offset.toFixed(6)));
    manualScaling=false;invalidateOutputPlan();show('expertOutputMsg','Scaling für '+(mode===4?'PWM':'FM')+' vorgeschlagen. Bitte prüfen und vormerken.','warn');
   }catch(e){show('expertOutputMsg',e.message,'error');if(isAnalog($('expertOutputMode').value)){$('psscScalingPreview').textContent=e.message;$('psscScalingPreview').classList.add('invalid')}}
  }
  function propose(){
   try{
    // Ausgangskonfiguration ist für alle Benutzer zugänglich.
    if(isAnalog($('expertOutputMode').value)&&!manualScaling)calculateAnalogScaling();
   const values=outputValues();
    if(values.mode==='keep'){
     if(st.outputOnlyPlan&&st.calImage===st.outputOnlyPlan)st.calImage=null;
     st.outputOnlyPlan=null;st.expertOutputPlan=null;
     show('expertOutputMsg','Ausgangskonfiguration bleibt unverändert.','success');return
    }
    if(values.mode==='onewire'){
     if(!st.nvmBackupVerified||!st.nvmBackup||!st.uid)
      throw Error('One Wire only: Erst vollständiges Original-NVM lesen und Chip-UID bestätigen. Es werden keine Bootregister geändert.');
     const chk=CAL.oneWireOnlyStatus(st.nvmBackup);
     if(!chk.ok)throw Error('One Wire only: '+chk.errors.join('; ')+'. Umstellung der geschützten Kommunikationsregister ist gesperrt.');
     st.outputOnlyPlan=null;st.restorePlan=null;st.calImage=null;
     if(verificationComplete()){
      st.expertOutputPlan={mode:'onewire'};
      show('expertOutputMsg','One Wire only ist im NVM bereits dauerhaft aktiv. Bei der späteren Kalibrier-NVM-Programmierung bleiben sämtliche Ausgangs- und Kommunikationsregister unverändert.','success');
     }else{
      st.expertOutputPlan=null;
      show('expertOutputMsg','One Wire only ist bereits dauerhaft aktiv und wurde aus dem Original-NVM bestätigt. Keine separate NVM-Änderung nötig.','success');
     }
     renderFlowState();return;
    }
    const limit=currentLimit();
    if(!Number.isInteger(limit)||limit<1000||limit>32000)throw Error('DSP-Zielbereich für diesen Sensor zuerst korrekt einstellen');
    const normalCalibration=verificationComplete();
    if(!normalCalibration&&(!st.nvmBackupVerified||!st.nvmBackup||!st.uid))throw Error('Für Ausgangsänderungen an bereits kalibrierten Sensoren zuerst die aktuelle 64-Wort-NVM-Sicherung mit bestätigter UID lesen');
    const before=st.nvmBackupVerified&&st.nvmBackup?st.nvmBackup:Array(64).fill(0);
    const after=CAL.prepareOutputConfig(before,values,limit);
    if(!normalCalibration){
     after[63]=CAL.crc16(after);
     const changes=after.map((v,i)=>v!==before[i]?{index:i,address:i*2,from:before[i],to:v}:null).filter(Boolean);
     if(!changes.length)throw Error('Ausgang ist bereits entsprechend konfiguriert');
     if(changes.some(c=>![16,22,57,58,59,60,63].includes(c.index)))throw Error('Nicht erlaubtes Ausgangsregister im Änderungsplan');
     const plan={uid:st.uid.hex,outputOnly:true,limit,before:before.slice(),after,changes};
     st.outputOnlyPlan=plan;st.restorePlan=null;st.calImage=plan;
     st.expertOutputPlan=values;
     show('expertOutputMsg','Ausgangsänderung ohne neuen Druckabgleich vorbereitet: '+changes.length+' NVM-Wörter. Im NVM-Schritt die automatisch übernommene Chip-UID prüfen und danach den Schreibknopf betätigen. Noch nichts am Sensor geändert.','warn')
    }else{
     st.outputOnlyPlan=null;st.restorePlan=null;st.calImage=null;st.expertOutputPlan=values;
     show('expertOutputMsg','Ausgangseinstellung geprüft und in den normalen finalen Kalibrier-NVM-Plan vorgemerkt. Noch nichts am Sensor geändert.','success')
    }
   }catch(e){st.outputOnlyPlan=null;st.expertOutputPlan=null;if(st.calImage?.outputOnly)st.calImage=null;show('expertOutputMsg','Ausgangsvorschlag abgelehnt: '+e.message,'error')}
   renderFlowState()
  }
  function outputReady(){
   return !!(st.outputOnlyPlan&&st.calImage===st.outputOnlyPlan&&st.nvmBackupVerified&&st.nvmBackup&&st.uid&&
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
    show('expertRestoreMsg',changes.length+' User-NVM-Wörter aus Backup '+new Date(chosen.created).toLocaleString('de-CH')+' zur Wiederherstellung vorgemerkt. Noch nichts geschrieben. Zum NVM-Schritt wechseln, Chip-UID prüfen und die Wiederherstellung starten.','warn')
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
  // Expert switch is contextual: reveal controls in their own tabs, no modal.
  $('expertMode').addEventListener('change',()=>{
   const enabled=$('expertMode').checked;
   $('expertPanel').hidden=!enabled;
   document.querySelectorAll('[data-expert-area]').forEach(section=>{section.hidden=!enabled});
   $('settingsOpen').classList.toggle('is-expert',enabled);
   $('settingsMsg').textContent=enabled?
    'Expertenmodus aktiv: Zusatzfelder befinden sich in den Reitern AFE, Ausgang und EEPROM Viewer. Es werden keine Chipwerte verändert.':
    'Expertenmodus deaktiviert: Die erweiterten Felder sind ausgeblendet; Chipwerte bleiben unverändert.';
   refreshEEPROMViewer();
   if(enabled)renderBackups();
   else {if(st.restorePlan&&st.calImage===st.restorePlan)st.calImage=null;st.restorePlan=null;}
   renderFlowState();
  });
  function applyOutputProfile(cfg){
   if(!cfg||typeof cfg!=='object')throw Error('Ausgangsprofil fehlt');
   const mode=String(cfg.mode);
   if(!['keep','1','2','3','4','5','onewire'].includes(mode))throw Error('Nicht erlaubter Ausgangsmodus im Profil');
   $('expertOutputMode').value=mode;
   $('psscVdd').value=String(cfg.vdd);
   $('psscS0').value=String(cfg.s0);
   $('psscS1').value=String(cfg.s1);
   $('expertPwmPeriod').value=String(cfg.pwmPeriod);
   $('expertScaleEnable').checked=!!cfg.scaleEnabled;
   $('expertScaleGain').value=String(cfg.gain);
   $('expertScaleOffset').value=String(cfg.offset);
   modeChoiceEdited=true;
   manualScaling=!isAnalog(mode);
   if(isAnalog(mode))calculateAnalogScaling();
   renderOutputMode();invalidateOutputPlan();
  }
  function renderOutputMode(){
   const mode=$('expertOutputMode').value;
   $('outputClippingFields').hidden=!isAnalog(mode);
   $('outputClipLow').disabled=$('outputClipHigh').disabled=$('outputClippingMode').value!=='on';
   $('expertPwmPeriodField').hidden=mode!=='4';
   $('psscAnalogFields').hidden=!isAnalog(mode);
   $('psscScalingSection').hidden=mode==='onewire';
   $('expertOutputPreset').disabled=mode==='onewire';
   const hints={keep:'Bisherigen AODO-Modus und Scaling unverändert lassen.',0:'Disabled (HighZ): AODO ausgeschaltet. Kein nachgewiesener One-Wire-only-Startmodus.',1:'Analog Ratiometric 0..5 V · linear 10–90 % VDD.',2:'Analog Ratiometric 0..5 V · DAC Correction 1.',3:'Analog Ratiometric 0..5 V · DAC Correction 2.',4:'PWM · Periode und positive DSP_AODO-Werte beachten.',5:'FM · positive DSP_AODO-Werte beachten.',6:'ALARM / End of Conversion · Fehler- und Grenzwerte bleiben unverändert.',onewire:'One Wire only: Permanenter PLC-Betrieb übernimmt den AODO-Pin. Diese Wahl ist nur zulässig, wenn plc_en bereits im Original-NVM aktiv ist; Bootregister bleiben geschützt.'};
   $('outputModeHint').textContent=(hints[mode]||'Unbekannter oder nicht freigegebener Modus')+' Nur verifizierte AODO-Werte werden für NVM vorgemerkt.';
   refreshOutputReadOnly();renderOutputPreview();
  }
  $('expertOutputMode').addEventListener('change',()=>{
   modeChoiceEdited=true;
   manualScaling=false;
   if(isAnalog($('expertOutputMode').value)){
    try{calculateAnalogScaling()}catch(e){$('psscScalingPreview').textContent=e.message;$('psscScalingPreview').classList.add('invalid')}
   }
   renderOutputMode();invalidateOutputPlan();
  });
  $('psscDefaultScaling').addEventListener('click',()=>{
   const vdd=Number($('psscVdd').value);
   if(!Number.isFinite(vdd)||vdd<2.7||vdd>5.5){
    show('expertOutputMsg','Bitte zuerst VDD zwischen 2.7 und 5.5 V eingeben.','error');return;
   }
   $('psscS0').value=String(Number((vdd*0.1).toFixed(5)));
   $('psscS1').value=String(Number((vdd*0.9).toFixed(5)));
   manualScaling=false;
   try{
    const result=calculateAnalogScaling();
    invalidateOutputPlan();
    show('expertOutputMsg','Standard 10–90 % VDD eingesetzt: S0 '+(vdd*0.1).toFixed(3)+' V, S1 '+(vdd*0.9).toFixed(3)+' V. Keine Änderung am Chip.','success');
   }catch(e){show('expertOutputMsg',e.message,'error');invalidateOutputPlan()}
  });
  for(const id of ['psscVdd','psscS0','psscS1']){
   $(id).addEventListener('input',()=>{
    manualScaling=false;
    try{calculateAnalogScaling()}catch(e){$('psscScalingPreview').textContent=e.message;$('psscScalingPreview').classList.add('invalid')}
    invalidateOutputPlan();
   });
  }
  $('expertScaleEnable').addEventListener('change',()=>{manualScaling=true;renderOutputPreview();invalidateOutputPlan()});
  for(const id of ['expertScaleGain','expertScaleOffset'])$(id).addEventListener('change',()=>{manualScaling=true;renderOutputPreview();invalidateOutputPlan()});
  for(const id of ['outputClippingMode','outputClipLow','outputClipHigh'])
   $(id).addEventListener('input',()=>{renderOutputMode();invalidateOutputPlan()});
  $('expertPwmPeriod').addEventListener('change',invalidateOutputPlan);
  renderOutputMode();
  // Initialise the editable TARGET independently from existing chip values.
  // 5 V -> S0 0.5 V (10% VDD), S1 4.5 V (90% VDD).
  if(isAnalog($('expertOutputMode').value)){
   try{calculateAnalogScaling()}catch(e){$('psscScalingPreview').textContent=e.message;$('psscScalingPreview').classList.add('invalid')}
  }
  $('expertBackupSelect').addEventListener('change',()=>{
   if(st.restorePlan){
    if(st.calImage===st.restorePlan)st.calImage=null;
    st.restorePlan=null;show('expertRestoreMsg','Backup-Auswahl geändert. Vor einer Wiederherstellung den neuen Stand erneut vergleichen.','warn');renderFlowState()
   }
  });
  $('expertIdentify').addEventListener('click',()=>withProgress('Chip-UID wird gelesen',identify).catch(e=>show('expertUidStatus',e.message,'error')));
  $('expertNvmRead').addEventListener('click',readNvm);
  $('eepromRead').addEventListener('click',readNvm);
  $('eepromExport').addEventListener('click',exportCurrent);
  $('eepromSearch').addEventListener('input',refreshEEPROMViewer);
  $('expertNvmExport').addEventListener('click',exportCurrent);
  $('expertRegistersRead').addEventListener('click',()=>withProgress('Chipregister werden gelesen',readRegisters));
  $('expertOutputPreset').addEventListener('click',preset);
  $('expertOutputStage').addEventListener('click',propose);
  $('expertOutputDiscard').addEventListener('click',()=>{st.expertOutputPlan=null;st.outputOnlyPlan=null;st.calImage=null;show('expertOutputMsg','Ausgangsänderungen verworfen.','success');renderFlowState()});
  $('expertRestorePreview').addEventListener('click',prepareRestore);
  $('expertBackupImport').addEventListener('change',()=>withProgress('Backup-Datei wird geladen',importFile));
  renderBackups();refreshEEPROMViewer();
  return {onDetect,identify,afterNvmScan,refreshEEPROMViewer,applyOutputProfile,refreshOutputReadOnly,refreshOutputPreview:renderOutputPreview,archiveCurrentNvm,restoreReady,outputReady,prepareRestore,exportCurrent,renderBackups,validBackup:valid}
 }
 return {init}
})();
