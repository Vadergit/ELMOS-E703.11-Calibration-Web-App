'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const page=read('index.html'),app=read('app.js'),theme=read('theme.css');

function initialTheme(value,shouldThrow=false){
 const head=page.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(head,'theme script must run in head before styles');
 const root={documentElement:{dataset:{}}};
 const storage={getItem(key){
  assert.equal(key,'elmos-ui-theme-v1');
  if(shouldThrow)throw Error('Local storage is restricted');
  return value;
 }};
 new Function('document','localStorage',head)(root,storage);
 return root.documentElement.dataset.theme;
}
test('theme is applied synchronously in head before styles paint',()=>{
 assert.ok(page.indexOf("localStorage.getItem('elmos-ui-theme-v1')")<page.indexOf('<style>'));
 assert.equal(initialTheme('dark'),'dark');
 assert.equal(initialTheme('light'),'light');
 assert.equal(initialTheme(null),'light');
 assert.equal(initialTheme('something-invalid'),'light');
 assert.equal(initialTheme(null,true),'light');
});
test('theme selector in Settings applies immediately, stores preference and redraws ADC',()=>{
 const a=app.indexOf(" const themeControl=$('settingsTheme');");
 const b=app.indexOf(" // Optional post-measurement UI:",a);
 assert.ok(a>0&&b>a);
 const snippet=app.slice(a,b);
 const controls=new Map();
 function get(id){
  if(!controls.has(id))controls.set(id,{value:'',textContent:'',
   listeners:{},addEventListener(type,handler){this.listeners[type]=handler}});
  return controls.get(id);
 }
 const root={documentElement:{dataset:{theme:'dark'}}};
 const stored={},draws=[];
 new Function('$','document','localStorage','draw',snippet)(get,root,{
  setItem:(key,value)=>{stored[key]=value}
 },()=>draws.push(root.documentElement.dataset.theme));
 assert.equal(get('settingsTheme').value,'dark');
 get('settingsTheme').value='light';
 get('settingsTheme').listeners.change();
 assert.equal(root.documentElement.dataset.theme,'light');
 assert.equal(stored['elmos-ui-theme-v1'],'light');
 get('settingsTheme').value='dark';
 get('settingsTheme').listeners.change();
 assert.equal(root.documentElement.dataset.theme,'dark');
 assert.equal(stored['elmos-ui-theme-v1'],'dark');
 assert.deepEqual(draws,['light','dark']);
});
test('theme CSS overrides app styles as the last linked stylesheet',()=>{
 const links=[...page.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(links.at(-1),'theme.css?v=0.7.9');
 assert.ok(links.some(x=>x.startsWith('interface.css?')));
 assert.ok(links.some(x=>x.startsWith('guided.css?')));
 assert.match(page,/id="settingsTheme"/);
 assert.match(page,/data-app-version="0\.7\.26"/);
 assert.match(page,/<b>Version v0\.7\.26<\/b>/);
});
test('dark theme covers guided, classic, compact, archive, logger and warning UI',()=>{
 for(const part of [
  '#guidedWorkspace','#archiveWorkspace','#classicLoggerHost','.gw-choice',
  '.eeprom-table','.cal-measure-cell','.cp-card',
  '.tl-box','.ar-data-pair','.callout.warn','.gw-alert.error',
  '.gw-finish-number strong','canvas','.settings-panel'
 ]) assert.ok(theme.includes(part),'Missing dark-theme area '+part);
 assert.match(theme,/:root\[data-theme="dark"\]/);
 assert.match(theme,/color-scheme:dark/);
 assert.match(theme,/html\[data-theme="dark"\] #guidedWorkspace/);
 assert.match(theme,/html\[data-theme="dark"\] #archiveWorkspace/);
 assert.doesNotMatch(theme,/linear-gradient|radial-gradient/i);
});
function lum(color){
 const hex=color.length===4?'#'+[...color.slice(1)].map(x=>x+x).join(''):color;
 const numbers=hex.slice(1).match(/.{2}/g).map(x=>parseInt(x,16)/255);
 return numbers.reduce((acc,v,i)=>acc+[0.2126,0.7152,0.0722][i]*
 (v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4),0);
}
function contrast(fg,bg){const l1=lum(fg),l2=lum(bg);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)}
test('light/dark core body text and muted text meet WCAG AA (4.5:1)',()=>{
 const pairs=[
  ['#15283d','#eaf0f5'],['#40566d','#fff'],['#075a7e','#fff'],
  ['#eff5fb','#111a24'],['#c0cddb','#1b2a39'],['#eaf2fa','#172532'],
  ['#86d1ff','#1b2a39'],['#fff','#166a97'],['#ffe0a2','#413522'],
  ['#ffd4d9','#4b2731'],['#d9ffe9','#1a4839']
 ];
 for(const [fg,bg] of pairs)assert.ok(contrast(fg,bg)>=4.5,
  fg+' on '+bg+' insufficient contrast: '+contrast(fg,bg).toFixed(2));
});
test('canvas renders light/dark axis colours without changing sensor values',()=>{
 assert.match(app,/const dark=document\.documentElement\.dataset\.theme==='dark'/);
 assert.match(app,/dark\?'#9bddff':'#2867a6'/);
 assert.match(app,/dark\?'#d7e5f0':'#74849a'/);
 assert.match(theme,/html\[data-theme="dark"\] canvas/);
});
