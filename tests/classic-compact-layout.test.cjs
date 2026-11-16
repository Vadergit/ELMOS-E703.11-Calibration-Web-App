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
 assert.match(html,/<details id="nvmDiffDetails"/); // mandatory safety review remains accessible
 assert.match(app,/document\.querySelectorAll\('\[data-expert-area\]'\)/);
});
test('temperature source has inline help and follows the compact measurement grid',()=>{
 assert.match(html,/<label class="cal-temp-source">Temperaturmessquelle/);
 assert.match(html,/id="calTempSource"/);
 assert.match(html,/<div class="fieldrow cal-setup-grid">/);
 assert.match(css,/@media \(min-width: 1121px\)/);
 assert.match(css,/grid-template-columns: minmax\(145px,1\.35fr\)/);
});
