'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const get=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=get('index.html'),app=get('app.js'),guided=get('guided.js'),css=get('settings-refresh.css');

test('settings are short, grouped, and expose just one clear CSV-free help links area',()=>{
 for(const text of ['Darstellung','Messung','Erweiterte Optionen','Hilfen &amp; Tools',
  'settings-resource-link','settingsTheme','settingsSampleCount','settingsLiveInterval'])
  assert.ok(html.includes(text),'Missing '+text);
 assert.doesNotMatch(html,/id="settingsClose"/);
 assert.doesNotMatch(html,/id="workflowMode"/);
 assert.match(html,/<select id="settingsLiveInterval">[\s\S]*?<option value="250" selected>/);
 const links=['firmware-update.html','feedback.html','offline-anleitung.html'];
 for(const url of links)assert.match(html,new RegExp('<a href="'+url+'"[^>]*class="settings-resource-link"'));
});

test('demo is nested in an expert-only region and expert control is separate',()=>{
 const start=html.indexOf('<div id="settingsDemoSection"');
 const end=html.indexOf('</div>',start);
 assert.ok(start>0);
 const region=html.slice(start,end);
 assert.match(region,/id="settingsDemoSection" class="settings-expert-options" hidden/);
 assert.match(region,/id="demoMode"/);
 assert.match(html,/id="expertMode"/);
 assert.match(app,/const syncDemoExpertVisibility=\(\)=>\{\$\('settingsDemoSection'\)\.hidden=!\$\('expertMode'\)\.checked\}/);
 assert.match(app,/\$\('expertMode'\)\.addEventListener\('change',syncDemoExpertVisibility\)/);
 assert.match(app,/\$\('demoExit'\)\.addEventListener/);
});

test('clicking outside settings dismisses the panel without blocking navigation',()=>{
 const start=app.indexOf(' function toggleSettings(open){');
 const end=app.indexOf(" $('homeButton').addEventListener('click'",start);
 assert.ok(start>=0&&end>start);
 const listeners=new Map();
 const panel={hidden:true,contains:node=>node==='within'};
 const gear={attrs:{},contains:node=>node==='gear',focusCount:0,
  setAttribute(k,v){this.attrs[k]=v},
  focus(){this.focusCount++},
  addEventListener(type,fn){this[type]=fn}};
 const count={value:'12'},sampleCount={value:'12'};
 const nodes={settingsPanel:panel,settingsOpen:gear,
  settingsSampleCount:count,calSampleCount:sampleCount};
 const $=id=>{if(!(id in nodes))throw Error('Missing node '+id);return nodes[id]};
 const doc={addEventListener:(type,fn,capture)=>listeners.set(type,{fn,capture})};
 const {toggleSettings}=new Function('$','document',app.slice(start,end)+';return {toggleSettings};')($,doc);
 gear.click();
 assert.equal(panel.hidden,false);
 assert.equal(gear.attrs['aria-expanded'],'true');
 listeners.get('click').fn({target:'within'});
 assert.equal(panel.hidden,false);
 listeners.get('click').fn({target:'gear'});
 assert.equal(panel.hidden,false);
 listeners.get('click').fn({target:'main-navigation'});
 assert.equal(panel.hidden,true);
 assert.equal(gear.attrs['aria-expanded'],'false');
 assert.equal(listeners.get('click').capture,true);
 toggleSettings(true);
 let prevented=false;
 listeners.get('keydown').fn({key:'Escape',preventDefault:()=>{prevented=true}});
 assert.equal(panel.hidden,true);
 assert.equal(prevented,true);
 assert.equal(gear.focusCount,1);
});

test('guided workflow is still available but no longer auto launches from settings',()=>{
 assert.doesNotMatch(guided,/workflowMode/);
 assert.doesNotMatch(guided,/elmos-workflow-mode-v1/);
 assert.match(guided,/\$\('guidedLaunchTop'\)\?\.addEventListener\('click',toggleTopView\)/);
 assert.match(guided,/function onConnected\(\)\{/);
 assert.match(guided,/The guided workflow remains available through its navigation button/);
});

test('compact settings stylesheet includes visible link affordances and dark contrast',()=>{
 assert.match(html,/settings-refresh\.css\?v=0\.7\.77/);
 assert.match(css,/\.settings-panel \.settings-resource-link:hover/);
 assert.match(css,/\.settings-panel \.settings-resource-link:focus-visible/);
 assert.match(css,/html\[data-theme=dark\] \.settings-panel \.settings-resource-link/);
 assert.match(css,/\.settings-panel\[hidden\]/);
 assert.match(css,/@media\(max-width:620px\)/);
});
