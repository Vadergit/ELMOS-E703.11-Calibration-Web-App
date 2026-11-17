'use strict';
/* E703.11 alarm/status diagnostics (read-only).
 * Ref. E703.11 25DS0170E.04 §§6.3.2.4–5, 6.4.2 and 6.5.7.2.
 */
const ELMOS_ALARM_VIEW=(()=>{
 const S=typeof ELMOS_SETTINGS!=='undefined'?ELMOS_SETTINGS:require('./elmos-settings.js');
 const v=x=>Number(x).toLocaleString('de-CH',{maximumFractionDigits:3});
 const text=(tag,content,cls)=>{const e=document.createElement(tag);if(cls)e.className=cls;e.textContent=content;return e};
 function summary(words,statusWord=null){
  if(!Array.isArray(words)||words.length!==64||words.some(w=>!Number.isInteger(w)||w<0||w>65535))return null;
  const alarm=S.alarmValues(words),pin=S.eocPin(words[20]),mask=words[18]&0x0FFF;
  const routing=S.eocMask(words[18]),selected=Object.keys(S.statusNames).map(Number).filter(bit=>((mask>>(bit>=12?bit-2:bit))&1)===1);
  const live=Number.isInteger(statusWord)&&statusWord>=0&&statusWord<=65535?
   selected.filter(bit=>statusWord&(1<<bit)).map(bit=>S.statusNames[bit]):null;
  const errors=S.errorMask(words[61]),errorEnabled=!!(words[16]&(1<<8));
  const i2cSda=(words[20]>>9)&3,conflicts=[];
  if((words[17]&4)&&pin==='AODO-Pin')conflicts.push('Dauerhaftes One-Wire überlagert die AODO-Funktion.');
  if(pin==='EOC-Pin'&&(words[29]&3)===3)conflicts.push('EOC-Pin gleichzeitig als externe Temperaturquelle ausgewählt.');
  if(pin==='EOC-Pin'&&i2cSda===2)conflicts.push('EOC-Pin gleichzeitig als I²C-SDA ausgewählt.');
  if(pin==='MOSI-Pin'&&i2cSda===1)conflicts.push('MOSI-Pin gleichzeitig als I²C-SDA ausgewählt.');
  return {
   alarm,selected,routing,pin,
   output:alarm.type==='postscale'?
    'DSP-Nachskalierung: '+alarm.mode+'; Offset '+v(alarm.offset)+', Faktor '+v(alarm.gain):
    (alarm.enable?'Druckalarm aktiviert':'Druckalarm deaktiviert')+
     ' · Untere Schwelle: '+S.alarmText(words,'lower')+
     ' · Obere Schwelle: '+S.alarmText(words,'upper'),
   status:live===null?'STATUS_SYNC noch nicht gelesen':live.length?
    'Ausgewählte aktive Signale: '+live.join(' ODER '):
    'Keines der ausgewählten Statussignale ist aktuell aktiv',
   error:(errorEnabled?'Fehlersignalisierung aktiviert: ':'Fehlersignalisierung deaktiviert: ')+errors,
   replacements:S.errorValues(words[62]),conflicts
  };
 }
 function render(target,words,statusWord=null){
  if(!target)return;target.replaceChildren();
  const info=summary(words,statusWord);
  if(!info){target.appendChild(text('p','Bitte zuerst die 64 EEPROM-Wörter mit gültiger CRC und Chip-UID lesen.','muted'));return;}
  const rows=[['Alarm / DSP-Nachskalierung',info.output],['EOC-/Alarm-Signale (ODER)',info.routing],
   ['Ausgabe-Pin für EOC',info.pin],['Fehlerreaktion',info.error],
   ['Fehler-Ersatzwerte',info.replacements],['Aktueller Status',info.status]];
  const table=document.createElement('table');table.className='eeprom-overview-table';
  const body=document.createElement('tbody');
  for(const [name,value] of rows){
   const tr=document.createElement('tr'),th=text('th',name),td=text('td',value);
   th.scope='row';tr.append(th,td);body.appendChild(tr);
  }
  table.appendChild(body);target.appendChild(table);
  for(const issue of info.conflicts)target.appendChild(text('p','Hinweis: '+issue,'callout warn'));
  target.appendChild(text('p','Nur Diagnose. Statusmaske und Alarmfunktionen werden hier nicht programmiert. Alarm und DSP-Nachskalierung verwenden dieselben NVM-Wörter.','muted small'));
 }
 return {summary,render};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_ALARM_VIEW;
