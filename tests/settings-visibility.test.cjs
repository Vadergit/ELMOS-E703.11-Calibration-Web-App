'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

const html=read('index.html'),app=read('app.js'),archive=read('archive.js');
function loadPreference({stored=null,activeType=null,view='archive'}={}){
 const start=app.indexOf(" const verificationPreferenceKey='elmos-show-verification-v1';");
 const end=app.indexOf(" function toggleSettings(open){",start);
 assert.ok(start>=0&&end>start);
 const code=app.slice(start,end);
 const controls=new Map();
 const get=id=>{
  if(!controls.has(id))controls.set(id,{
   checked:false,hidden:false,textContent:'',attributes:{},callbacks:{},
   setAttribute(key,value){this.attributes[key]=value},
   addEventListener(event,handler){this.callbacks[event]=handler}
  });
  return controls.get(id);
 };
 const saved=new Map();
 if(stored!=null)saved.set('elmos-show-verification-v1',stored);
 const activeArchive={current:activeType?{type:activeType}:null,view,closed:false,
  close(){this.closed=true}};
 const root={ELMOS_ARCHIVE:activeArchive};
 new Function('$','lsGet','lsSet','window',code)(
  get,key=>saved.get(key)??null,(key,value)=>saved.set(key,value),root
 );
 return {
  controls,saved,activeArchive,
  change(checked){
   get('settingsVerificationEnabled').checked=checked;
   get('settingsVerificationEnabled').callbacks.change();
  },
  get
 };
}
test('offline banner is removed, help link exists exclusively in the settings pane',()=>{
 assert.doesNotMatch(html,/class="offline-guide-banner"/);
 const settingsStart=html.indexOf('id="settingsPanel"'),settingsEnd=html.indexOf('</section>',settingsStart);
 assert.ok(settingsStart>0&&settingsEnd>settingsStart);
 const pane=html.slice(settingsStart,settingsEnd);
 assert.match(pane,/href="offline-anleitung\.html"/);
 assert.match(pane,/Web-App offline verwenden/);
 assert.equal((html.match(/href="offline-anleitung\.html"/g)||[]).length,1);
});
test('post-measurement navigation is off by default and hidden before JavaScript loads',()=>{
 assert.match(html,/id="verificationOpen"[^>]*\bhidden/);
 const ui=loadPreference();
 assert.equal(ui.get('verificationOpen').hidden,true);
 assert.equal(ui.get('settingsVerificationEnabled').checked,false);
 assert.equal(ui.saved.size,0);
 assert.equal(ui.get('verificationOpen').attributes['aria-hidden'],'true');
});
test('saved preference restores and changes are persisted immediately',()=>{
 const ui=loadPreference({stored:'1'});
 assert.equal(ui.get('verificationOpen').hidden,false);
 assert.equal(ui.get('settingsVerificationEnabled').checked,true);
 ui.change(false);
 assert.equal(ui.get('verificationOpen').hidden,true);
 assert.equal(ui.saved.get('elmos-show-verification-v1'),'0');
 ui.change(true);
 assert.equal(ui.saved.get('elmos-show-verification-v1'),'1');
 assert.equal(ui.get('verificationOpen').hidden,false);
});
test('active verification cannot be hidden or interrupted by a settings change',()=>{
 const ui=loadPreference({stored:'1',activeType:'verification',view:'verification'});
 ui.change(false);
 assert.equal(ui.get('settingsVerificationEnabled').checked,true);
 assert.equal(ui.get('verificationOpen').hidden,false);
 assert.equal(ui.saved.get('elmos-show-verification-v1'),'1');
 assert.equal(ui.activeArchive.closed,false);
 assert.match(ui.get('settingsMsg').textContent,/Nachmessung läuft/);
});
test('disabling verification closes an idle verification view, but not the archive',()=>{
 const verification=loadPreference({stored:'1',view:'verification'});
 verification.change(false);
 assert.equal(verification.activeArchive.closed,true);
 const list=loadPreference({stored:'1',view:'archive'});
 list.change(false);
 assert.equal(list.activeArchive.closed,false);
 assert.match(archive,/get view\(\)\{return S\.view\}/);
});
test('cache keys identify new app.js and archive.js on the v0.7.5 page',()=>{
 assert.match(html,/data-app-version="0\.7\.15"/);
 assert.match(html,/app\.js\?v=0\.7\.15/);
 assert.match(html,/archive\.js\?v=0\.7\.13/);
});
