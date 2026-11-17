'use strict';
/* Read-only E703.11 configuration overview. Values are sourced from a verified
   64-word EEPROM image, an explicitly requested RAM snapshot or a staged image.
   No sensor communication, register writes or local storage occur here. */
const ELMOS_EEPROM_OVERVIEW=(()=>{
 const isWord=x=>Number.isInteger(x)&&x>=0&&x<=65535;
 const validWords=x=>Array.isArray(x)&&x.length===64&&x.every(isWord);
 const raw=x=>'0x'+Number(x).toString(16).toUpperCase().padStart(4,'0');
 const signed=x=>(x&0x8000)?x-65536:x;
 const formatNumber=x=>Number(x).toLocaleString('de-CH',{maximumFractionDigits:6});
 const modeNames=['High-Z','Analog, DAC 0','Analog, DAC 1','Analog, DAC 2','PWM','FM','Alarm','SDA'];
 const pga1=[3.5,6,8.5,11],pga2=[2,2.22,2.5,2.86,3.33,4,5,6.67,10];
 const q12=x=>formatNumber(signed(x)/4096)+' (Q3.12)';
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
  {group:'Analog-Frontend (AFE)',label:'Brückenspannung SVDD',index:27,decode:x=>['2,4 V','1,6 V','2,0 V','Reservierter Code'][(x&3)]},
  {group:'Analog-Frontend (AFE)',label:'PGA1',index:28,decode:x=>formatNumber(pga1[x&3])+'×'},
  {group:'Analog-Frontend (AFE)',label:'Offset-DAC',index:28,decode:offset},
  {group:'Analog-Frontend (AFE)',label:'PGA2',index:28,decode:x=>pga2[(x>>>7)&15]===undefined?'Undokumentierter Code':formatNumber(pga2[(x>>>7)&15])+'×'},
  {group:'Analog-Frontend (AFE)',label:'Temperaturpfad CFG_AFE2',index:29,decode:raw},
  {group:'Analog-Frontend (AFE)',label:'ADC-Konfiguration',index:24,decode:raw},
  {group:'Analog-Frontend (AFE)',label:'Filter CFG_LP0 / LP1',indices:[25,26],decode:xs=>xs.map(raw).join(' / ')},
  {group:'DSP & Kalibrierung',label:'Druck-Normierung Offset S_O',index:33,decode:q12},
  {group:'DSP & Kalibrierung',label:'Druck-Normierung Faktor S_F',index:34,decode:q12},
  {group:'DSP & Kalibrierung',label:'Temperatur-Offset T_O',index:31,decode:q12},
  {group:'DSP & Kalibrierung',label:'Temperatur-Faktor T_F',index:32,decode:q12},
  {group:'DSP & Kalibrierung',label:'Druckkoeffizienten S0–S15',indices:Array.from({length:16},(_,i)=>35+i),decode:xs=>xs.filter(x=>x!==0).length+' / 16 ungleich 0'},
  {group:'DSP & Kalibrierung',label:'Temperaturkoeffizienten T0–T3',indices:[51,52,53,54],decode:xs=>xs.filter(x=>x!==0).length+' / 4 ungleich 0'},
  {group:'Ausgang & Grenzwerte',label:'Ausgangs-Offset AODO_O',index:57,decode:q12},
  {group:'Ausgang & Grenzwerte',label:'Ausgangs-Faktor AODO_F',index:58,decode:q12},
  {group:'Ausgang & Grenzwerte',label:'Begrenzung unten / oben',indices:[59,60],decode:xs=>xs.map(x=>formatNumber(signed(x))).join(' / ')+' Digits'},
  {group:'Ausgang & Grenzwerte',label:'Alarmgrenze unten / oben',indices:[55,56],decode:xs=>xs.map(x=>formatNumber(signed(x))).join(' / ')+' Digits'},
  {group:'Ausgang & Grenzwerte',label:'Fehlermaske',index:61,decode:raw},
  {group:'Ausgang & Grenzwerte',label:'Benutzerwort',index:30,decode:raw}
 ];
 const groups=[...new Set(entries.map(x=>x.group))];
 const getValue=(source,item)=>{
  const indexes=item.indices||[item.index];
  if(!source)return null;
  const values=indexes.map(i=>Array.isArray(source)?source[i]:source[i]);
  if(!values.every(isWord))return null;
  return {values,text:item.decode(item.indices?values:values[0]),
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
     differs:!!active&&active.raw!==saved.raw,
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
  const hasRam=!!ram,hasPlan=validWords(staged);
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
     const td=elem('td',changed?'eeprom-overview-changed':'',source?source.text:'—');
     td.title=source?kind.toUpperCase()+' · '+row.register+' · Rohwert '+source.raw:
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
   if(i===51||i>=35&&i<=50){
    const row=elem('tr');
    row.appendChild(elem('th','',i<=50?'S'+(i-35):'T'+(i-51)));
    for(const source of [words,ram,...(hasPlan?[staged]:[])]){
     const v=source?.[i];
     const cell=elem('td','',isWord(v)?q15(v):'—');
     if(isWord(v))cell.title=raw(v);
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
   '. Werte ohne gesicherte Bitfeldzuordnung bleiben als Hexwert sichtbar. Kein automatischer Schreibvorgang.'));
 }
 return {summarize,render,validWords};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_EEPROM_OVERVIEW;
