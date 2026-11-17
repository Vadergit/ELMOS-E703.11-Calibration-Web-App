'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../classic-compact.css'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');

test('AFE ADC cards are visually removed but retained for live measurement updates',()=>{
 assert.match(html,/<h2>AFE einstellen<\/h2><div class="triple" hidden aria-hidden="true">/);
 for(const id of ['adc','adct','adctc'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(css,/\.panel\[data-panel="1"\] > \.triple:first-of-type\s*\{ display: none !important; \}/);
});
test('classic expandable technical details require expert checkbox',()=>{
 assert.match(css,/body:not\(:has\(#expertMode:checked\)\) \.panel details/);
 assert.match(css,/body:not\(:has\(#expertMode:checked\)\) \.settings-panel details/);
 assert.match(html,/<details><summary>Geschützte Register & Diagnose<\/summary>/);
 assert.match(html,/<details><summary>Aufgenommene Messwerte im Detail<\/summary>/);
 assert.match(html,/<details><summary>Optionale lineare Rohwert-Vorprüfung \(kein DSP-Test\)<\/summary>/);
 assert.match(html,/<details id="nvmDiffDetails"/); // details exist for expert review
 assert.doesNotMatch(css,/details:not\(#nvmDiffDetails\)/);
 assert.match(css,/body:not\(:has\(#expertMode:checked\)\) \.panel details:not\(#settingsArchivePathDetails\)/);
 assert.match(app,/document\.querySelectorAll\('\[data-expert-area\]'\)/);
});
test('temperature source has inline help and follows the compact measurement grid',()=>{
 assert.match(html,/<label class="cal-temp-source">Temperaturmessquelle/);
 assert.match(html,/id="calTempSource"/);
 assert.match(html,/<div class="fieldrow cal-setup-grid">/);
 assert.match(css,/@media \(min-width: 1121px\)/);
 assert.match(css,/grid-template-columns: minmax\(145px,1\.35fr\)/);
});

test('AFE DSP summary is not displayed before calibration, without breaking live updates',()=>{
 const afe=html.match(/<section class="card panel" data-panel="1"[\s\S]*?<section class="card panel" data-panel="2"/)?.[0]||'';
 assert.match(afe,/<div class="dsp-live" hidden aria-hidden="true">/);
 for(const id of ['afeDspMode','afeDspValue','afeDspUnit','afeDspRaw','afeDspSeen']){
  assert.match(afe,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/<div class="dsp-live" aria-live="off">/); // later DSP check remains visible
});
test('calibration exports require expert mode while deleting points remains accessible',()=>{
 assert.match(html,/<div class="flex cal-tools"><button id="calPointClear">Alle Messpunkte löschen<\/button><div class="flex" data-expert-area hidden><button id="exportJSON">Protokoll JSON<\/button><button id="exportCSV">Messwerte CSV<\/button><\/div><\/div>/);
 assert.match(app,/document\.querySelectorAll\('\[data-expert-area\]'\)/);
});
test('header and footer reflect the new deployed version',()=>{
 assert.match(html,/E703\.11 · PSSC · v0\.7\.99/);
 assert.match(html,/data-app-version="0\\.7\\.\\d+"/);
 assert.match(html,/Version v0\.7\.99/);
});

test('temperature help has one source and never produces an empty tooltip',()=>{
 const label=html.match(/<label class="cal-temp-source">[\s\S]*?<\/label>/)?.[0]||'';
 assert.match(label,/<span class="help" data-help="tempsource"/);
 assert.doesNotMatch(label,/\btitle=/);
 assert.match(app,/tempsource:'Die aktive Chipquelle CFG_AFE2\.t_adc_src/);
 assert.match(app,/const message=HELP\[el\.dataset\.help\];if\(!message\)\{tip\.classList\.remove\('visible'\);return\}/);
 assert.match(app,/rect\.top-height-9/);
});
test('calibration setup uses short labels that do not wrap on desktop',()=>{
 assert.match(html,/<label>Kalibrierpunkte\s*<select id="calPointCount" aria-label="Anzahl Kalibrier-Messpunkte">/);
 assert.match(html,/<label>Samples \/ Punkt\s*<input type="number" id="calSampleCount" aria-label="Samples pro Messpunkt"/);
});
