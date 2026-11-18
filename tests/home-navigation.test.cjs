'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const script=read('home-navigation.js');
const html=read('index.html');
const app=read('app.js');

function harness({critical=false,measuring=false,archiveActive=false,logging=false,unfinished=false}={}){
 const events=[],elements={};
 for(const id of ['guidedHomeConfirm','guidedHomeConfirmMessage','guidedHomeConfirmStatus',
  'guidedHomeAbort','guidedHomeStay','guidedHomeTop']){
  elements[id]={hidden:false,disabled:false,textContent:'',open:false,
   addEventListener(){},showModal(){this.open=true;events.push('dialog-open')},
   close(){this.open=false;events.push('dialog-close')}};
 }
 const archive={active:archiveActive,current:archiveActive?{type:'calibration'}:null,
  isMeasuring:false,isFinishing:false,
  close(){events.push('archive-close')},
  async finalise(status,options){events.push('finalise-'+status);
   assert.equal(options.snapshot,null);archive.active=false;}};
 const logger={active:logging,isBusy:()=>logging};
 const guided={active:false,isOpen(){return this.active},open(){events.push('open-guided');this.active=true},
  resetForHome(){events.push('reset-home');return true},
  hasUnfinishedTask(){return unfinished}};
 const state={critical,measuring};
 const api={
  navigationSafety:()=>({...state}),
  abortActiveMeasurementForHome(){events.push('abort-capture');state.measuring=false},
  clearHomeMeasurementAbort(){events.push('clear-abort')},
  clearHomeDraft(){events.push('clear-draft')}
 };
 const window={ELMOS_GUIDED_API:api,ELMOS_ARCHIVE:archive,ELMOS_TEST_LOGGER:logger,
  ELMOS_GUIDED:guided,scrollTo(){events.push('scroll-home')}};
 const document={readyState:'loading',addEventListener(){},title:'Before',
  getElementById:id=>elements[id]||null,querySelectorAll:()=>[]};
 const context={window,document,location:{hash:'',pathname:'/index.html',search:''},
  history:{state:null,replaceState(){}},setTimeout};
 const code=vm.runInNewContext(script+'\nELMOS_HOME_NAVIGATION',context);
 return {events,elements,archive,guided,api,code,window,document};
}
test('global home links and confirmation dialog are present on every classic tool',()=>{
 assert.match(html,/id="guidedHomeTop"[^>]*>⌂ Hauptseite<\/button>/);
 assert.match(html,/id="homeButton" aria-label="Zur geführten Hauptseite"/);
 assert.match(html,/<h2>Sensorbrücken-Rechner<\/h2>/);
 assert.match(html,/<button type="button" data-guided-home>Zur Hauptseite<\/button>/);
 assert.doesNotMatch(html,/Zum USB-Start/);
 for(const id of ['guidedHomeConfirm','guidedHomeAbort','guidedHomeStay','guidedHomeConfirmStatus'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/home-navigation\.js\?v=0\.7\.132/);
 assert.match(app,/window\.ELMOS_HOME_NAVIGATION\?\.requestHome\?\.\(\)/);
});
test('idle Home opens the guided task chooser without disconnecting or clearing the sensor',()=>{
 const m=harness();
 assert.equal(m.code.requestHome(),true);
 assert.deepEqual(m.events.filter(x=>x==='open-guided'||x==='reset-home'),
  ['open-guided','reset-home']);
 assert.equal(m.document.title,'ELMOS E703.11 – Kalibrierassistent');
});
test('unfinished calibration requires a choice, and continuing keeps the current task',()=>{
 const m=harness({archiveActive:true,unfinished:true});
 assert.equal(m.code.requestHome(),false);
 assert.equal(m.elements.guidedHomeConfirm.open,true);
 assert.equal(m.elements.guidedHomeAbort.hidden,false);
 assert.match(m.elements.guidedHomeConfirmMessage.textContent,/Kalibrierung/);
 assert.equal(m.events.includes('finalise-aborted'),false);
});
test('protected NVM and RAM operations cannot be aborted from the Home dialog',()=>{
 const m=harness({critical:true,archiveActive:true});
 m.code.requestHome();
 assert.equal(m.elements.guidedHomeAbort.hidden,true);
 assert.match(m.elements.guidedHomeConfirmMessage.textContent,/nicht unterbrochen/);
 assert.equal(m.events.includes('open-guided'),false);
});
test('confirmed calibration abort archives the session before resetting and going home',async()=>{
 const m=harness({archiveActive:true,unfinished:true,measuring:true});
 m.code.requestHome();
 assert.equal(await m.code.abortAndGoHome(),true);
 assert.deepEqual(m.events.filter(x=>['abort-capture','finalise-aborted','clear-draft','open-guided','reset-home'].includes(x)),
  ['abort-capture','finalise-aborted','clear-draft','open-guided','reset-home']);
 assert.equal(m.archive.active,false);
});
test('aborting a classic calibration clears its captured points before opening guided home',async()=>{
 const m=harness({archiveActive:true,unfinished:false});
 m.code.requestHome();
 assert.equal(await m.code.abortAndGoHome(),true);
 assert.ok(m.events.indexOf('finalise-aborted')<m.events.indexOf('clear-draft'));
 assert.ok(m.events.indexOf('clear-draft')<m.events.indexOf('reset-home'));
});
test('long-running test logging must finish and archive its last sample before returning',async()=>{
 const m=harness({archiveActive:true,logging:true});
 m.window.ELMOS_TEST_LOGGER.abortForHome=async()=>{
  m.events.push('stop-logging');m.window.ELMOS_TEST_LOGGER.active=false;
  m.window.ELMOS_TEST_LOGGER.isBusy=()=>false;
  m.archive.active=false;
 };
 m.code.requestHome();
 assert.equal(await m.code.abortAndGoHome(),true);
 assert.ok(m.events.indexOf('stop-logging')<m.events.indexOf('open-guided'));
 assert.ok(!m.events.includes('finalise-aborted'));
});
test('navigation never disconnects USB or calls protected sensor commands',()=>{
 assert.doesNotMatch(script,/disconnect\(|send\(|writeReg\(|maintWrite\(|nvmProgram\(/);
 assert.match(app,/if\(homeNavigationAbortRequested\)/);
 assert.match(read('test-logger.js'),/async function abortForHome\(\)/);
 assert.match(read('archive.js'),/get isMeasuring\(\)/);
 assert.match(read('guided.js'),/function resetForHome\(\)/);
});
