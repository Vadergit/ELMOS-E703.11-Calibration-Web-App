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
 assert.equal(get('Ausgangs-Faktor AODO_F').saved.text,'0.5 (Q3.12)');
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
