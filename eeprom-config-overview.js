'use strict';
/* Read-only E703.11 configuration overview. Values are sourced from a verified
   64-word EEPROM image, an explicitly requested RAM snapshot or a staged image.
   No sensor communication, register writes or local storage occur here. */
const ELMOS_EEPROM_OVERVIEW=(()=>{
 const SETTINGS=typeof ELMOS_SETTINGS!=='undefined'?ELMOS_SETTINGS:require('./elmos-settings.js');
 const isWord=x=>Number.isInteger(x)&&x>=0&&x<=65535;
 const validWords=x=>Array.isArray(x)&&x.length===64&&x.every(isWord);
 const raw=x=>'0x'+Number(x).toString(16).toUpperCase().padStart(4,'0');
 const signed=x=>(x&0x8000)?x-65536:x;
 const formatNumber=x=>Number(x).toLocaleString('de-CH',{maximumFractionDigits:6});
 const modeNames=['High-Z','Analog, DAC 0','Analog, DAC 1','Analog, DAC 2','PWM','FM','Alarm','SDA'];
 const pga1=[3.5,6,8.5,11],pga2=[2,2.22,2.5,2.86,3.33,4,5,6.67,10];
 const q12=x=>formatNumber(signed(x)/4096)+' (dimensionslos)';
 const q15=x=>formatNumber(signed(x)/32768)+' (Q0.15)';
 const bit=x=>x?'Ein':'Aus';
 const offset=x=>{
  const code=(x>>>2)&31;
  const stage=code===0?0:code>=1&&code<=8?code:code>=17&&code<=24?16-code:null;
  return stage===null?'Nicht dokumentierter Offset-Code '+code:
   (stage>0?'+':'')+stage+' Stufen (Code '+code+')';
 };
 const entries=[
  {group:'Betrieb & Kommunikation',label:'Ausgangsmodus',index:16,decode:x=>modeNames[(x>>>9)&7]},
  {group:'Betrieb & Kommunikation',label:'DSP-Ausgangsskalierung',index:16,decode:x=>bit((x>>>6)&1)},
  {group:'Betrieb & Kommunikation',label:'1-Wire dauerhaft',index:17,decode:x=>bit((x>>>2)&1)},
  {group:'Betrieb & Kommunikation',label:'1-Wire-Startfenster',index:18,decode:x=>['4 ms','10 ms','200 ms','Deaktiviert'][(x>>>12)&3]},
  {group:'Betrieb & Kommunikation',label:'Registerzugriff dauerhaft',index:19,decode:x=>bit((x>>>8)&1)},
  {group:'Betrieb & Kommunikation',label:'Status-Verknüpfung für EOC (ODER)',index:18,decode:x=>SETTINGS.eocMask(x)},
  {group:'Betrieb & Kommunikation',label:'EOC-Signal auf Pin',index:20,decode:x=>SETTINGS.eocPin(x)},
  {group:'Betrieb & Kommunikation',label:'I²C-Signalfilter',index:20,decode:x=>((x>>12)&1)?'Deaktiviert':'Aktiv (Störimpulse unterdrücken)'},
  {group:'Analog-Frontend (AFE)',label:'Brückenspannung SVDD',index:27,decode:x=>['2,4 V','1,6 V','2,0 V','Reservierter Code'][(x&3)]},
  {group:'Analog-Frontend (AFE)',label:'PGA1',index:28,decode:x=>formatNumber(pga1[x&3])+'×'},
  {group:'Analog-Frontend (AFE)',label:'Offset-DAC',index:28,decode:offset},
  {group:'Analog-Frontend (AFE)',label:'PGA2',index:28,decode:x=>pga2[(x>>>7)&15]===undefined?'Undokumentierter Code':formatNumber(pga2[(x>>>7)&15])+'×'},
  {group:'Analog-Frontend (AFE)',label:'Temperaturquelle',index:29,decode:x=>SETTINGS.tempSource(x)},
  {group:'Analog-Frontend (AFE)',label:'ADC-Filter, Grenzfrequenz & Abtastrate',indices:[24,25,26],decode:xs=>SETTINGS.filter(xs)},
  {group:'DSP & Kalibrierung',label:'Druck-Normierung Offset S_O',index:33,decode:q12},
  {group:'DSP & Kalibrierung',label:'Druck-Normierung Faktor S_F',index:34,decode:q12},
  {group:'DSP & Kalibrierung',label:'Temperatur-Offset T_O',index:31,decode:q12},
  {group:'DSP & Kalibrierung',label:'Temperatur-Faktor T_F',index:32,decode:q12},
  {group:'DSP & Kalibrierung',label:'Druckkoeffizienten S0–S15',indices:Array.from({length:16},(_,i)=>35+i),decode:xs=>xs.filter(x=>x!==0).length+' / 16 ungleich 0'},
  {group:'DSP & Kalibrierung',label:'Temperaturkoeffizienten T0–T3',indices:[51,52,53,54],decode:xs=>xs.filter(x=>x!==0).length+' / 4 ungleich 0'},
  {group:'Ausgang & Grenzwerte',label:'Ausgangs-Offset AODO_O',index:57,decode:q12},
  {group:'Ausgang & Grenzwerte',label:'Ausgangs-Faktor AODO_F',index:58,decode:q12},
  {group:'Ausgang & Grenzwerte',label:'Ausgangsbegrenzung',indices:[16,59,60],decode:(xs,all)=>SETTINGS.limitText(all)},
  {group:'Ausgang & Grenzwerte',label:'Alarm unten / DSP-Nachskalierung Offset',index:55,decode:(x,all)=>SETTINGS.alarmText(all,'lower')},
  {group:'Ausgang & Grenzwerte',label:'Alarm oben / DSP-Nachskalierung Faktor',index:56,decode:(x,all)=>SETTINGS.alarmText(all,'upper')},
  {group:'Ausgang & Grenzwerte',label:'Fehlerreaktionen',index:61,decode:x=>SETTINGS.errorMask(x)},
  {group:'Ausgang & Grenzwerte',label:'Fehler-Ersatzwerte',index:62,decode:x=>SETTINGS.errorValues(x)},
  {group:'Ausgang & Grenzwerte',label:'Benutzerkennung',index:30,decode:x=>String(x)+' (dezimal)'}
 ];
 const groups=[...new Set(entries.map(x=>x.group))];
 const getValue=(source,item)=>{
  const indexes=item.indices||[item.index];
  if(!source)return null;
  const values=indexes.map(i=>Array.isArray(source)?source[i]:source[i]);
  if(!values.every(isWord))return null;
  return {values,text:item.decode(item.indices?values:values[0],source),
   raw:values.map(raw).join(' / ')};
 };
 function summarize(words,ram,staged){
  if(!validWords(words))return null;
  const acceptedRam=ram&&typeof ram==='object'&&!Array.isArray(ram)?ram:null;
  const acceptedStaged=validWords(staged)?staged:null;
  return groups.map(name=>({
   name,rows:entries.filter(x=>x.group===name).map(item=>{
    const saved=getValue(words,item),active=getValue(acceptedRam,item),planned=getValue(acceptedStaged,item);
    return {label:item.label,register:(item.indices||[item.index]).map(i=>'CM '+i.toString(16).toUpperCase().padStart(2,'0')).join(', '),
     saved,active,planned,
     // For individual decoded fields, compare the displayed setting rather than unrelated bits in a shared register.
     // Multi-word rows represent an entire group: any changed constituent word is relevant.
     differs:!!active&&(item.indices?active.raw!==saved.raw:active.text!==saved.text),
     pending:!!planned&&planned.raw!==saved.raw};
   })
  }));
 }
 const elem=(tag,className,text)=>{
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(text!==undefined)el.textContent=text;
  return el;
 };
 function render(container,words,ram,staged){
  if(!container)return;
  container.replaceChildren();
  const sections=summarize(words,ram,staged);
  if(!sections){
   container.appendChild(elem('p','muted small','Noch keine verifizierten EEPROM-Daten. Bitte zuerst «EEPROM lesen» drücken.'));
   return;
  }
  const hasPlan=validWords(staged);
  const grid=elem('div','eeprom-overview-grid');
  for(const section of sections){
   const card=elem('section','eeprom-overview-card');
   card.appendChild(elem('h4','',section.name));
   const table=elem('table','eeprom-overview-table'),head=elem('thead'),tr=elem('tr');
   ['Einstellung','EEPROM','RAM'].concat(hasPlan?['Vorgemerkt']:[]).forEach(t=>tr.appendChild(elem('th','',t)));
   head.appendChild(tr);table.appendChild(head);
   const body=elem('tbody');
   for(const row of section.rows){
    const line=elem('tr');
    const name=elem('th','eeprom-overview-name',row.label);
    name.title=row.register;name.scope='row';line.appendChild(name);
    for(const [source,kind,changed] of [[row.saved,'saved',false],[row.active,'ram',row.differs],...(hasPlan?[[row.planned,'planned',row.pending]]:[])]){
     const ramDifferent=kind==='ram'&&changed&&!!source;
     const td=elem('td',ramDifferent?'eeprom-overview-ram-different':changed?'eeprom-overview-changed':'');
     if(ramDifferent)td.appendChild(elem('span','eeprom-overview-value-diff',source.text));
     else td.textContent=source?source.text:'—';
     td.title=source?kind.toUpperCase()+' · '+row.register+' · Rohwert '+source.raw+
      (ramDifferent?' · Abweichung zum EEPROM: '+row.saved.raw:''):
      (kind==='ram'?'RAM noch nicht gelesen':'Keine Werte');
     line.appendChild(td);
    }
    body.appendChild(line);
   }
   table.appendChild(body);card.appendChild(table);grid.appendChild(card);
  }
  container.appendChild(grid);
  const extra=elem('details','eeprom-overview-coeffs'),summary=elem('summary','','Alle DSP-Koeffizienten (S0–S15 und T0–T3) anzeigen');
  extra.appendChild(summary);
  const coefficients=elem('table','eeprom-overview-table eeprom-overview-coeff-table');
  const hrow=elem('tr');
  ['Koeffizient','EEPROM (Q0.15)','RAM (Q0.15)'].concat(hasPlan?['Vorgemerkt (Q0.15)']:[]).forEach(t=>hrow.appendChild(elem('th','',t)));
  const hd=elem('thead');hd.appendChild(hrow);coefficients.appendChild(hd);
  const tb=elem('tbody');
  for(let i=35;i<=54;i++){
   if(i>=35&&i<=54){
    const row=elem('tr');
    row.appendChild(elem('th','',i<=50?'S'+(i-35):'T'+(i-51)));
    for(const [kind,source] of [['saved',words],['ram',ram],...(hasPlan?[['planned',staged]]:[])]){
     const v=source?.[i],known=isWord(v);
     const changed=known&&v!==words[i];
     const ramDifferent=kind==='ram'&&changed;
     const cell=elem('td',ramDifferent?'eeprom-overview-ram-different':kind==='planned'&&changed?'eeprom-overview-changed':'');
     if(ramDifferent)cell.appendChild(elem('span','eeprom-overview-value-diff',q15(v)));
     else cell.textContent=known?q15(v):'—';
     if(known)cell.title=raw(v)+(ramDifferent?' · EEPROM '+raw(words[i]):'');
     row.appendChild(cell);
    }
    tb.appendChild(row);
   }
  }
  coefficients.appendChild(tb);extra.appendChild(coefficients);
  container.appendChild(extra);
  container.appendChild(elem('p','muted small',
   'EEPROM = gespeicherter, CRC-geprüfter Stand · RAM = einmalig gelesener Arbeitsstand'+
   (hasPlan?' · Vorgemerkt = noch nicht in EEPROM programmiert':'')+
   '. Gelb hinterlegt = RAM weicht vom EEPROM ab. Nur eindeutig dokumentierte Werte werden in Klartext aufgelöst; unbekannte Werte werden nicht geschätzt. Kein Schreibvorgang.'));
 }
 return {summarize,render,validWords};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_EEPROM_OVERVIEW;
