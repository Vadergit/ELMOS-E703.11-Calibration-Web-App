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
 assert.match(html,/guided\.js\?v=0\.7\.126/);
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

test('chip loss preserves the active guided page; physical COM loss opens connection diagnostics',()=>{
 const from=guided.indexOf(' function onSensorReset(');
 const to=guided.indexOf(' function init(){',from);
 assert.ok(from>0&&to>from);
 const source=guided.slice(from,to);
 const simulate=portDisconnected=>{
  const js=`
   let mode=true,nextSensorPending=null,pendingCapture=null,chipResetPending=false,
    connectionOpen=false,plan={points:[]},signature='old',seriesPointFields=null,
    selectedPoint=2,latestCapture='old',lastCaptureRenderKey='old',
    stage=7,visited=new Set([0,7]);
   let rendered=0,updated=0,notices=[];
   const render=()=>rendered++,updateUI=()=>updated++,msg=message=>notices.push(message),
    renderConnectionStatus=()=>{};
   ${source}
   onSensorReset({portDisconnected:${portDisconnected}});
   return {connectionOpen,stage,rendered,updated,chipResetPending,notices,hasPlan:!!plan};
  `;
  return new Function('window',js)({clearInterval(){}});
 };
 const loss=simulate(false);
 assert.equal(loss.connectionOpen,false);
 assert.equal(loss.stage,7);
 assert.equal(loss.updated,1);
 assert.equal(loss.rendered,0);
 assert.equal(loss.chipResetPending,true);
 const unplug=simulate(true);
 assert.equal(unplug.connectionOpen,true);
 assert.equal(unplug.stage,0);
 assert.equal(unplug.rendered,1);
 assert.equal(unplug.hasPlan,false);
});
test('auto reconnect is opt-in, uses authorised ports, and never auto-programs the NVM',()=>{
 assert.match(html,/id="settingsAutoReconnect" type="checkbox"/);
 assert.doesNotMatch(html,/id="settingsAutoReconnect"[^>]+checked/);
 assert.match(app,/const autoReconnectKey='elmos-auto-reconnect-v1'/);
 assert.match(app,/autoReconnectEnabled=lsGet\(autoReconnectKey\)==='1'/);
 assert.match(app,/autoReconnectSuppressed=true;cancelAutoReconnect\(\)/);
 assert.match(app,/navigator\.serial\.addEventListener\('disconnect'/);
 assert.match(app,/onSensorReset\?\.\(\{portDisconnected:true\}\)/);
 assert.match(app,/onSensorReset\?\.\(\{portDisconnected:false\}\)/);
 const start=app.indexOf(' async function attemptAutoReconnect(){');
 const end=app.indexOf(' const HELP=',start);
 const source=app.slice(start,end);
 assert.ok(start>0&&end>start);
 assert.match(source,/await detect\(\{requireUid:true\}\)/);
 assert.match(source,/navigator\.serial\.getPorts\(\)/);
 assert.match(source,/await connect\(matches\[0\]\)/);
 assert.doesNotMatch(source,/nvmProgram\(|writeReg\(|testPlcMagicCookie\(|startSsp3WithBoundedRetry\(/);
});

test('auto-connect uses ESP32-C3 bridge ACCESS for a newly connected chip',async()=>{
 const start=app.indexOf(' async function attemptAutoReconnect(){');
 const end=app.indexOf(' const HELP=',start);
 assert.ok(start>0&&end>start);
 const code=app.slice(start,end);
 const simulate=adapter=>{
  const calls=[],st={port:{},readerAlive:true,chip:false,uid:null,adapterKind:adapter};
  const deps={st,mayAutoReconnect:()=>true,autoReconnectBlocked:()=>false,renderStatus:()=>calls.push('render'),
   bridgeHello:async()=>{calls.push('hello');return true},
   connectBridgeChip:async opts=>{assert.deepEqual(opts,{autoProbe:true});calls.push('access');st.chip=true;st.uid={hex:'0020011DBBE7'}},
   detect:async opts=>{assert.deepEqual(opts,{requireUid:true});calls.push('read');st.chip=true;st.uid={hex:'0020011DBBE7'}},
   logging:()=>{},scheduleAutoReconnect:()=>calls.push('retry'),
   navigator:{serial:{getPorts:async()=>[]}},connect:async()=>{},autoReconnectBusy:false,autoReconnectAttempts:0,autoReconnectLastAt:0,autoReconnectLastError:''};
  const fn=new Function(...Object.keys(deps),code+';return attemptAutoReconnect;')(...Object.values(deps));
  return {fn,calls,st};
 };
 const bridge=simulate('bridge');
 await bridge.fn();
 assert.deepEqual(bridge.calls,['render','hello','access','render']);
 const ssp3=simulate('ssp3');
 await ssp3.fn();
 assert.deepEqual(ssp3.calls,['render','read','render']);
});
test('automatic ESP32-C3 access honours selected VDD control without implicit RAM recovery',()=>{
 const from=app.indexOf(' async function connectBridgeChip(');
 const to=app.indexOf(' // CRC8 verification follows DS',from);
 assert.ok(from>0&&to>from);
 const implementation=app.slice(from,to);
 assert.match(implementation,/power=!!st\.sensorPowerEnabled&&\(!autoProbe\|\|st\.iface==='plc'\)/);
 assert.match(implementation,/if\(autoProbe\|\|!st\.bridgePsscRam/);
 assert.match(implementation,/detect\(\{requireUid:autoProbe\}\)/);
 assert.match(app,/if\(st\.port===port&&!st\.closing&&\(!st\.chip\|\|!st\.uid\?\.hex\)\)scheduleAutoReconnect\(2800\)/);
});

test('failed bridge auto-connect remains retryable without triggering write operations',async()=>{
 const from=app.indexOf(' async function attemptAutoReconnect(){');
 const to=app.indexOf(' const HELP=',from);
 assert.ok(from>0&&to>from);
 const calls=[],st={port:{},readerAlive:true,chip:false,uid:null,adapterKind:'bridge'};
 const deps={st,mayAutoReconnect:()=>true,autoReconnectBlocked:()=>false,renderStatus:()=>calls.push('render'),
  bridgeHello:async()=>{calls.push('hello');return true},
  connectBridgeChip:async()=>{calls.push('access');throw Error('PLC_NO_VALID_FRAME')},
  detect:async()=>{throw Error('Should not read chip registers before ACCESS')},
  logging:()=>calls.push('log'),scheduleAutoReconnect:()=>calls.push('retry'),
  navigator:{serial:{getPorts:async()=>[]}},connect:async()=>{},autoReconnectBusy:false,autoReconnectAttempts:0,autoReconnectLastAt:0,autoReconnectLastError:''};
 const attempt=new Function(...Object.keys(deps),app.slice(from,to)+';return attemptAutoReconnect;')(...Object.values(deps));
 await attempt();
 assert.equal(st.chip,false);
 assert.deepEqual(calls,['render','hello','access','log','render','render','retry']);
});

test('auto PLC reconnect honours configured VDD switch to reopen short startup windows',()=>{
 const first=app.indexOf(' async function connectBridgeChip(');
 const end=app.indexOf(' if(st.iface===\'i2c\'){',first);
 assert.ok(first>0&&end>first);
 const snippet=app.slice(first,end);
 assert.match(snippet,/power=!!st\.sensorPowerEnabled&&\(!autoProbe\|\|st\.iface==='plc'\)/);
 assert.match(app,/await bridgeAccess\(\{power\}\)/);
 assert.match(app,/if\(autoProbe\|\|!st\.bridgePsscRam/);
});
test('sensor banner shows auto-connect enabled state, attempts and last error',()=>{
 assert.match(html,/id="sensorAutoReconnectStatus"/);
 assert.match(app,/Auto-Connect: Aus/);
 assert.match(app,/Auto-Connect: Sensorprüfung läuft/);
 assert.match(app,/autoReconnectAttempts\+\+/);
 assert.match(app,/autoReconnectLastError=String\(error\.message\|\|error\)/);
 assert.match(html,/data-app-version="0\.7\.130"/);
});

test('manual reinitialization retains bridge recovery and is independent of auto-probe',()=>{
 const start=app.indexOf(' async function reinitializeSensorOperation(){');
 const end=app.indexOf(' // Reopen the SAME previously authorised Web Serial port',start);
 assert.ok(start>0&&end>start);
 const manual=app.slice(start,end);
 assert.match(manual,/await bridgeHello\(\)/);
 assert.match(manual,/await connectBridgeChip\(\)/);
 assert.doesNotMatch(manual,/connectBridgeChip\(\{autoProbe:true\}\)/);
 const bridgeStart=app.indexOf(' async function connectBridgeChip(');
 const bridgeEnd=app.indexOf(' // CRC8 verification follows DS',bridgeStart);
 const bridge=app.slice(bridgeStart,bridgeEnd);
 assert.match(bridge,/if\(autoProbe\|\|!st\.bridgePsscRam/);
 assert.match(bridge,/await bridgeAccess\(\{power,recover:true\}\)/);
 assert.match(html,/data-app-version="0\.7\.130"/);
});

test('manual reconnect is not disabled by an in-flight auto probe and cancels future retries',()=>{
 const begin=app.indexOf(' async function reinitializeSensorOperation(){');
 const end=app.indexOf(' // Reopen the SAME previously authorised Web Serial port',begin);
 const code=app.slice(begin,end);
 assert.match(code,/cancelAutoReconnect\(\)/);
 assert.match(code,/if\(autoReconnectPromise\)await Promise\.race/);
 assert.match(code,/await connectBridgeChip\(\)/);
 assert.match(app,/const working=st\.reinitRunning\|\|st\.powerCycleRunning/);
 assert.match(app,/autoReconnectPromise=task/);
});
test('the damaged auto-connect state is reset once on upgrading to v0.7.130',()=>{
 assert.match(app,/elmos-auto-reconnect-v130-safety-reset/);
 assert.match(app,/lsSet\(autoReconnectKey,'0'\)/);
 assert.match(app,/let autoReconnectEnabled=lsGet\(autoReconnectKey\)==='1'/);
});
