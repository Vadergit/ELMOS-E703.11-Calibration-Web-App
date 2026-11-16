'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const source=read('archive.js');
const start=source.indexOf(' const folderBusy=');
const end=source.indexOf(' async function ensureFolder(){',start);
assert.ok(start>0&&end>start,'Shared archive directory logic must be present');
const script=source.slice(start,end)+'\n({folderBusy,refreshFolderSettings,chooseFolder,grantFolderAccess})';
function harness(options={}){
 const nodes=Object.fromEntries(['settingsArchiveFolder','settingsArchiveAccess',
  'settingsArchiveChoose','settingsArchiveGrant','archiveFolder','settingsMsg'].map(id=>[
   id,{textContent:'',hidden:id==='settingsArchiveGrant',disabled:false,dataset:{}}
 ]));
 const calls=[],storage={},state={
  dir:options.dir||null,record:options.record||null,records:[{id:'previous-folder'}],
  selection:['previous-folder'],showDetails:'previous-folder',
  resultsCache:{clear:()=>calls.push('clear')},folderName:''
 };
 let currentPick=options.picker||null;
 const window={
  isSecureContext:true,
  ELMOS_TEST_LOGGER:{isBusy:()=>options.busy||false},
  showDirectoryPicker:async args=>{calls.push('picker:'+args.id);if(currentPick instanceof Error)throw currentPick;return currentPick}
 };
 const context={
  S:state,window,$:id=>nodes[id],ui:de=>de,
  text:(id,message)=>{if(nodes[id])nodes[id].textContent=message},
  note:message=>calls.push('note:'+message),
  renderList:()=>calls.push('list'),
  refresh:async()=>calls.push('refresh'),
  remembered:async(action,value)=>{
   calls.push('storage:'+action);
   if(action==='write')storage.folder=value;
   else return storage.folder;
  }
 };
 const api=vm.runInNewContext(script,context);
 return {api,nodes,calls,storage,state,window,setPicker:x=>{currentPick=x}};
}
const folder=(name,access='granted')=>{
 let permission=access;
 return {name,queryPermission:async()=>permission,requestPermission:async()=>{
  permission='granted';return permission;
 }};
};
test('Application settings contain the shared archive picker, permission and privacy text',()=>{
 const html=read('index.html'),app=read('app.js'),archive=read('archive.js');
 assert.match(html,/id="settingsArchiveFolder"/);
 assert.match(html,/id="settingsArchiveAccess"/);
 assert.match(html,/id="settingsArchiveChoose"/);
 assert.match(html,/id="settingsArchiveGrant"/);
 assert.match(html,/Speicherort für Messungen &amp; Kalibrierungen/);
 assert.match(html,/data-app-version="0\.7\.85"/);
 assert.match(html,/archive\.js\?v=0\.7\.85/);
 assert.match(html,/app\.js\?v=0\.7\.85/);
 assert.match(app,/ELMOS_ARCHIVE\?\.refreshFolderSettings\?\.\(\)/);
 assert.match(archive,/settingsArchiveChoose'\)\?\.addEventListener\('click'/);
 assert.match(archive,/settingsArchiveGrant'\)\?\.addEventListener\('click'/);
 assert.match(archive,/chooseFolder,grantFolderAccess,refreshFolderSettings/);
});
test('Choosing a new directory stores one shared handle and refreshes archive and settings',async()=>{
 const a=harness(),newFolder=folder('Labor-Messungen');
 a.setPicker(newFolder);
 const result=await a.api.chooseFolder();
 assert.equal(result,newFolder);
 assert.equal(a.state.dir,newFolder);
 assert.equal(a.state.folderName,'Labor-Messungen');
 assert.equal(a.storage.folder,newFolder);
 assert.equal(a.nodes.settingsArchiveFolder.textContent,'Labor-Messungen');
 assert.equal(a.nodes.settingsArchiveAccess.dataset.state,'granted');
 assert.equal(a.nodes.settingsArchiveGrant.hidden,true);
 assert.equal(a.nodes.archiveFolder.textContent,'Labor-Messungen · lokaler Ordner');
 assert.equal(a.state.records.length,0);
 assert.equal(a.state.selection.length,0);
 assert.ok(a.calls.includes('picker:elmos-archive'));
 assert.ok(a.calls.includes('storage:write'));
 assert.ok(a.calls.includes('refresh'));
});
test('Changing directory during calibration or logging is blocked before the picker opens',async()=>{
 for(const options of [{record:{id:'active'}},{busy:true}]){
  const old=folder('Bestehend'),a=harness({...options,dir:old});
  a.setPicker(folder('Verbotener Wechsel'));
  await assert.rejects(()=>a.api.chooseFolder(),/Aufzeichnung läuft/);
  assert.equal(a.state.dir,old);
  assert.equal(a.calls.filter(x=>x.startsWith('picker:')).length,0);
  await a.api.refreshFolderSettings();
  assert.equal(a.nodes.settingsArchiveChoose.disabled,true);
  assert.equal(a.nodes.settingsArchiveGrant.disabled,!!options.busy||!!options.record);
 }
});
test('Cancelled directory selection leaves existing directory and stored records untouched',async()=>{
 const old=folder('Bestehend'),a=harness({dir:old});
 const cancel=new Error('User canceled');cancel.name='AbortError';a.setPicker(cancel);
 await assert.rejects(()=>a.api.chooseFolder(),e=>e.name==='AbortError');
 assert.equal(a.state.dir,old);
 assert.equal(a.state.records.length,1);
 assert.equal(a.state.selection.length,1);
 assert.equal(a.calls.includes('storage:write'),false);
});
test('Restored directory displays missing permission and can be explicitly reauthorized',async()=>{
 const existing=folder('Kalibrierarchiv','prompt'),a=harness({dir:existing});
 await a.api.refreshFolderSettings();
 assert.equal(a.nodes.settingsArchiveFolder.textContent,'Kalibrierarchiv');
 assert.equal(a.nodes.settingsArchiveAccess.dataset.state,'prompt');
 assert.equal(a.nodes.settingsArchiveGrant.hidden,false);
 assert.equal(await a.api.grantFolderAccess(),true);
 assert.equal(a.nodes.settingsArchiveAccess.dataset.state,'granted');
 assert.equal(a.nodes.settingsArchiveGrant.hidden,true);
 assert.ok(a.calls.includes('refresh'));
});
test('Picker is not invoked when unsupported and archive remains unchanged',async()=>{
 const a=harness({dir:folder('Alt')}),original=a.state.dir;
 a.window.isSecureContext=false;
 a.setPicker(folder('Neu'));
 await assert.rejects(()=>a.api.chooseFolder(),/HTTPS/);
 assert.equal(a.state.dir,original);
 assert.equal(a.calls.some(x=>x.startsWith('picker:')),false);
});
