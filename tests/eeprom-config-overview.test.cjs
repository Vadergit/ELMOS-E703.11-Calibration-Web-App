'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const overview=require('../eeprom-config-overview.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const image=()=>{
 const words=Array(64).fill(0);
 words[16]=(1<<9)|(1<<6); // analog output, scale enabled
 words[17]=1<<2;words[18]=2<<12; // One-Wire + 200 ms
 words[27]=0x0C81; // bridge 1.6 V
 words[28]=0x0800 | 3 | (20<<2) | (4<<7); // PGA1 11, offset -4, PGA2 3.33
 words[33]=4096;words[34]=8192;
 words[35]=16384;words[51]=32768;
 words[57]=4096;words[58]=2048;
 return words;
};
test('Only complete unsigned 16-bit images can be summarised',()=>{
 assert.equal(overview.summarize([],null,null),null);
 assert.equal(overview.validWords(image()),true);
 const bad=image();bad[28]=65536;assert.equal(overview.summarize(bad),null);
});
test('Overview shows real EEPROM settings in understandable categories',()=>{
 const groups=overview.summarize(image());
 assert.deepEqual(groups.map(x=>x.name),[
  'Betrieb & Kommunikation','Analog-Frontend (AFE)','DSP & Kalibrierung','Ausgang & Grenzwerte'
 ]);
 const all=groups.flatMap(g=>g.rows);
 const get=label=>all.find(r=>r.label===label);
 assert.equal(get('1-Wire dauerhaft').saved.text,'Ein');
 assert.equal(get('1-Wire-Startfenster').saved.text,'200 ms');
 assert.equal(get('Brückenspannung SVDD').saved.text,'1,6 V');
 assert.equal(get('PGA1').saved.text,'11×');
 assert.equal(get('Offset-DAC').saved.text,'-4 Stufen (Code 20)');
 assert.equal(get('DSP-Ausgangsskalierung').saved.text,'Ein');
 assert.equal(get('Druckkoeffizienten S0–S15').saved.text,'1 / 16 ungleich 0');
 assert.equal(get('Temperaturkoeffizienten T0–T3').saved.text,'1 / 4 ungleich 0');
 assert.equal(get('Ausgangs-Faktor AODO_F').saved.text,'0.5 (dimensionslos)');
 assert.equal(get('PGA1').active,null);
});
test('RAM and staged values never overwrite or masquerade as EEPROM',()=>{
 const stored=image(),active={28:0x0800,16:stored[16]},staged=stored.slice();
 staged[28]=0x0800;staged[58]=8192;
 const data=overview.summarize(stored,active,staged).flatMap(g=>g.rows);
 const by=name=>data.find(r=>r.label===name);
 assert.equal(by('PGA1').saved.text,'11×');
 assert.equal(by('PGA1').active.text,'3.5×');
 assert.equal(by('PGA1').differs,true);
 assert.equal(by('PGA1').pending,true);
 assert.equal(by('Ausgangs-Faktor AODO_F').pending,true);
 assert.equal(by('1-Wire dauerhaft').differs,false);
});
test('Overview is read-only and behind the CRC-verified chip gate',()=>{
 const expert=read('expert.js'),html=read('index.html'),mod=read('eeprom-config-overview.js');
 assert.match(expert,/st\.nvmBackupVerified/);
 assert.match(expert,/readOverviewRam/);
 assert.match(expert,/st\.sessionIndex!==session/);
 assert.match(expert,/readReg\(addr\)/);
 assert.doesNotMatch(mod,/\b(?:nvmWriteWord|writeReg|ramGrant|ramWrite|localStorage|exchange)\s*\(/);
 assert.match(html,/id="eepromOverviewRows"/);
 assert.match(html,/<div id="eepromRawDetails" class="eeprom-raw-details">/);
 assert.doesNotMatch(html,/<details id="eepromRawDetails"/);
 assert.match(html,/<h3>EEPROM-Rohdaten · 64 Wörter<\/h3>/);
 assert.ok(html.indexOf('id="eepromOverviewRows"')<html.indexOf('id="eepromRawDetails"'));
 assert.ok(html.indexOf('id="eepromRawDetails"')<html.indexOf('id="eepromRows"'));
 assert.match(html,/eeprom-config-overview\.js/);
});

test('Known Elmos ADC filter, EOC OR logic and alarm threshold are shown in plain text',()=>{
 const words=image();
 words[24]=0x7BA4;words[25]=0x1497;words[26]=0x01BA;
 words[18]|=(1<<5)|(1<<6); // leave PLC window bits intact
 words[16]|=(1<<5); // alarm enable, no post scaling
 words[55]=0xE002;words[56]=0x2002;
 words[61]=1<<(2*5); // bridge supply fail -> lower replacement
 const all=overview.summarize(words).flatMap(g=>g.rows);
 const by=name=>all.find(r=>r.label===name).saved.text;
 assert.match(by('ADC-Filter, Grenzfrequenz & Abtastrate'),/20 Hz · 2 kS\/s · 15 Bit/);
 assert.match(by('Status-Verknüpfung für EOC (ODER)'),/Druck unter Alarmgrenze ODER Druck über Alarmgrenze/);
 assert.match(by('Temperaturquelle'),/Interne Chiptemperatur/);
 assert.match(by('Alarm unten \/ DSP-Nachskalierung Offset'),/Aktiv/);
 assert.match(by('Fehlerreaktionen'),/Brückenversorgung fehlerhaft.*Unterer Fehlerwert/);
});


test('Only visibly different individual settings are marked; multi-word DSP changes remain detectable',()=>{
 const saved=image(),active={16:saved[16]^(1<<6),28:saved[28]^(1<<0),35:0,51:saved[51]};
 const rows=overview.summarize(saved,active).flatMap(group=>group.rows);
 const by=label=>rows.find(row=>row.label===label);
 assert.equal(by('Ausgangsmodus').differs,false,'Unrelated bit in shared CFG_EN must not mark output mode');
 assert.equal(by('DSP-Ausgangsskalierung').differs,true);
 assert.equal(by('PGA1').differs,true);
 assert.equal(by('Offset-DAC').differs,false,'Same offset must not be highlighted');
 assert.equal(by('Druckkoeffizienten S0–S15').differs,false,'Incomplete RAM group has no comparison');
 const complete={...active};
 for(let i=35;i<=50;i++)complete[i]=saved[i];
 complete[35]=0; // One coefficient differs even if the summary still reports only counts.
 const changed=overview.summarize(saved,complete).flatMap(group=>group.rows);
 assert.equal(changed.find(x=>x.label==='Druckkoeffizienten S0–S15').differs,true);
 assert.equal(overview.summarize(saved,null).flatMap(g=>g.rows).some(r=>r.differs),false);
});
test('Rendered RAM differences are marked yellow on values, without marking unread or equal RAM entries',()=>{
 const css=read('eeprom-config-overview.css'),code=read('eeprom-config-overview.js');
 assert.match(css,/\.eeprom-overview-table \.eeprom-overview-value-diff\{background:#ffe59a/);
 assert.match(code,/kind==='ram'&&changed&&!!source/);
 const previous=global.document;
 const make=tag=>({
  tagName:tag,children:[],textContent:'',className:'',title:'',
  appendChild(child){this.children.push(child);return child},
  replaceChildren(...nodes){this.children=[...nodes]}
 });
 try{
  global.document={createElement:make};
  const root=make('main'),saved=image(),ram={16:saved[16],28:(saved[28]&~3)|0,33:saved[33]};
  ram[35]=0;
  overview.render(root,saved,ram);
  const descendants=node=>[node,...(node.children||[]).flatMap(descendants)];
  const marked=descendants(root).filter(n=>n.className==='eeprom-overview-value-diff');
  assert.ok(marked.some(n=>n.textContent==='3.5×'),'Changed PGA1 RAM value should have yellow background');
  assert.ok(marked.some(n=>n.textContent==='0 (Q0.15)'),'Changed single coefficient should also be yellow');
  assert.ok(!marked.some(n=>n.textContent==='1 (dimensionslos)'),'Unchanged value must not be yellow');
  assert.equal(marked.length,2,'Changed PGA1 and the individually read S0 coefficient must both be marked');
  const root2=make('main'),ram2={...ram};
  for(let i=35;i<=54;i++)ram2[i]=saved[i];
  ram2[35]=0;
  overview.render(root2,saved,ram2);
  const marked2=descendants(root2).filter(n=>n.className==='eeprom-overview-value-diff');
  assert.ok(marked2.some(n=>n.textContent==='0 (Q0.15)'),'Changed coefficient is marked in expanded table');
 }finally{if(previous===undefined)delete global.document;else global.document=previous}
});

test('EEPROM overview decodes the two RAM alarms and output limiting from sparse snapshot',()=>{
 const words=image();words[16]|=(1<<5)|(1<<7);
 words[55]=0xE000;words[56]=0x2000;words[59]=0;words[60]=0;
 const ram={16:words[16],55:words[55],56:words[56],59:words[59],60:words[60]};
 const row=(groups,label)=>groups.flatMap(g=>g.rows).find(r=>r.label===label);
 const result=overview.summarize(words,ram);
 for(const label of ['Alarm unten / DSP-Nachskalierung Offset','Alarm oben / DSP-Nachskalierung Faktor']){
  assert.ok(row(result,label).active);
  assert.notEqual(row(result,label).active.text,'Nicht gelesen');
  assert.equal(row(result,label).differs,false);
 }
 assert.match(row(result,'Ausgangsbegrenzung').active.text,/Unten 0 %/);
 assert.equal(row(result,'Ausgangsbegrenzung').differs,false);
 const changed=overview.summarize(words,{...ram,55:0xD000});
 assert.equal(row(changed,'Alarm unten / DSP-Nachskalierung Offset').differs,true);
 assert.equal(row(changed,'Ausgangsbegrenzung').differs,false);
 const missing=overview.summarize(words,{16:words[16],55:words[55],59:0});
 assert.equal(row(missing,'Alarm unten / DSP-Nachskalierung Offset').active,null);
 assert.equal(row(missing,'Ausgangsbegrenzung').active,null);
});
