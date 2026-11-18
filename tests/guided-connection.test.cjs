'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const app=read('app.js'),guided=read('guided.js'),css=read('guided.css'),html=read('index.html');

function makeGuidedConnect(overrides={}){
 const first=app.indexOf(' async function connectGuided(');
 const last=app.indexOf(' async function guidedDiagnostic(',first);
 assert.ok(first>=0&&last>first);
 const source=app.slice(first,last);
 const events=[],fields={adapterType:{value:'ssp3'},iface:{value:'plc'},connMsg:{textContent:'E703.11 antwortet nicht'}};
 const st={port:{label:'original'},chip:false,adapterKind:'ssp3',iface:'plc',uid:{hex:'AABBCCDDEEFF'},...overrides.state};
 const archive=overrides.archive||{active:false};
 const window={ELMOS_ARCHIVE:archive,ELMOS_TEST_LOGGER:{isBusy:()=>false},ELMOS_GUIDED:{onSensorReset:()=>events.push('guided-reset')}};
 const navigator={serial:{requestPort:()=>{events.push('port-picker');return Promise.resolve({label:'selected'})}}};
 const disconnect=async()=>{events.push('disconnect');st.port=null;return true};
 const connect=async port=>{events.push('connect-'+port.label);st.port=port;st.chip=true;st.uid={hex:'111122223333'}};
 const auto=async()=>{events.push('auto')};
 const names=['st','window','navigator','demoEnabled','webSerialAvailable','webSerialMessage','finishSensorArchive','disconnect','erasePoints','lsSet','renderStatus','connect','auto','$'];
 const args=[st,window,navigator,false,()=>true,()=>'',async()=>events.push('finish-archive'),disconnect,()=>events.push('erase-points'),(key,value)=>events.push('save-'+key+'='+value),()=>{},connect,auto,id=>fields[id]];
 const fn=new Function(...names,source+';return connectGuided;')(...args);
 return {fn,st,fields,events,window};
}
test('guided connection is available on any step, including sensor-swap and communication recovery',()=>{
 for(const id of ['gwConnectionToggle','gwConnectionPage','gwConnectionAdapter','gwConnectionInterface',
  'gwConnectionApply','gwConnectionChoose','gwConnectionReinit','gwConnectionDiagnose',
  'gwConnectionStartup','gwConnectionLog','gwConnectionMagic','gwConnectionMagicConfirm','gwConnectionClose']){
  assert.match(guided,new RegExp('id="'+id+'"'));
 }
 assert.match(guided,/if\(connectionOpen\)\{renderConnectionStatus\(\);return;/);
 assert.match(guided,/connectionOpen=true;render\(\);/);
 assert.match(guided,/if\(swapping\)/);
 assert.match(css,/gw-connection-page/);
 assert.match(html,/guided\.js\?v=0\.7\.124/);
});
test('switching protocol on same authorised USB port closes old session and rereads a new UID',async()=>{
 const m=makeGuidedConnect();
 const result=await m.fn({adapter:'ssp3',iface:'i2c'});
 assert.equal(result.iface,'i2c');
 assert.equal(result.uid,'111122223333');
 assert.deepEqual(m.events.slice(0,3),['disconnect','erase-points','guided-reset']);
 assert.ok(m.events.includes('save-elmos8-iface=i2c'));
 assert.ok(m.events.includes('connect-original'));
 assert.equal(m.fields.iface.value,'i2c');
});
test('adapter changes require explicit port selection; chooser runs before disconnect',async()=>{
 const m=makeGuidedConnect();
 await assert.rejects(m.fn({adapter:'bridge',iface:'plc'}),/Anderen USB-Port/);
 assert.equal(m.events.length,0);
 const result=await m.fn({adapter:'bridge',iface:'i2c',choosePort:true});
 assert.equal(result.adapter,'bridge');
 assert.deepEqual(m.events.slice(0,3),['port-picker','disconnect','erase-points']);
 assert.ok(m.events.includes('connect-selected'));
});
test('unfinished archive is persisted as incomplete before changing sensor, never reused for new UID',async()=>{
 const archive={active:true,current:{chipUID:'AABBCCDDEEFF',type:'calibration'},finalise:async(status,options)=>{archive.closed={status,options};archive.active=false}};
 const m=makeGuidedConnect({archive});
 await m.fn({adapter:'ssp3',iface:'plc'});
 assert.deepEqual(archive.closed,{status:'incomplete',options:{snapshot:null}});
});
test('busy hardware operations prevent reconnection before modifying port or sensor settings',async()=>{
 for(const flag of ['nvmWorking','writing','calTask','powerCycleRunning','diagRunning']){
  const m=makeGuidedConnect({state:{[flag]:true}});
  await assert.rejects(m.fn({adapter:'ssp3',iface:'i2c'}),/laufenden Sensor-/);
  assert.deepEqual(m.events,[]);
 }
 const m=makeGuidedConnect();
 await assert.rejects(m.fn({adapter:'bridge',iface:'spi'}),/Ungültige Kombination/);
 assert.deepEqual(m.events,[]);
});
test('connection helpers reuse read-only diagnostic and protected 1-wire start-test operations',()=>{
 const start=app.indexOf(' async function guidedDiagnostic(');
 const end=app.indexOf(' window.ELMOS_GUIDED_API=Object.freeze(',start);
 const body=app.slice(start,end);
 assert.match(body,/runChipDiagnostics/);
 assert.match(body,/recoverOneWireStartup/);
 assert.match(body,/testPlcMagicCookie/);
 assert.match(body,/if\(!magicConfirmed\)throw Error/);
 assert.match(body,/plcStartupLogExport/);
 assert.doesNotMatch(body,/nvmWriteWord|nvmProgram\(/);
 assert.match(app,/connectGuided,guidedDiagnostic/);
 assert.match(guided,/gwConnectionMagic'\)\.disabled=!expert\|\|working\|\|!usb\|\|connected/);
});

test('connection navigation is always available, including during USB recovery',()=>{
 const from=guided.indexOf(' function closeConnectionPanel(){');
 const end=guided.indexOf(' function renderConnectionStatus(){',from);
 assert.ok(from>0&&end>from);
 const fn=new Function('render','connectionBusy','connectionOpen',guided.slice(from,end)+';return closeConnectionPanel;');
 let renderCount=0;
 const close=fn(()=>renderCount++,true,true);
 close();
 assert.equal(renderCount,1,'Returning to the assistant must not depend on USB activity');
 assert.match(guided,/id="gwConnectionBackTop"/);
 assert.match(guided,/gwConnectionBackTop'\)\.addEventListener\('click',closeConnectionPanel\)/);
 assert.match(guided,/connectionOpen\?'← Zurück zum Assistenten'/);
 assert.doesNotMatch(guided,/gwConnectionLog','gwConnectionMagic','gwConnectionClose'\]/);
});
test('expert-only diagnostics and SPI are hidden and guarded without enabling expert settings',()=>{
 for(const id of ['gwConnectionAdvanced','gwConnectionDiagnose','gwConnectionStartup'])
  assert.match(guided,new RegExp('id="'+id+'"[^>]*data-gw-expert hidden'));
 assert.match(guided,/spi\.disabled=adapter==='bridge'\|\|!\$\('expertMode'\)\.checked/);
 assert.match(guided,/\$\('gwConnectionMagic'\)\.disabled=!expert\|\|working/);
 assert.match(guided,/\$\('gwConnectionAdvanced'\)\.open=false/);
 assert.match(app,/if\(action!=='export'&&!\$\('expertMode'\)\.checked\)/);
 assert.match(app,/if\(iface==='spi'&&!\$\('expertMode'\)\.checked\)/);
});
