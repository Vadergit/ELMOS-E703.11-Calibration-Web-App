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
const script=source.slice(start,end)+'\n({folderBusy,refreshFolderSettings,chooseFolder,grantFolderAccess,saveFolderPathLabel,loadFolderPathLabel})';
function harness(options={}){
 const nodes=Object.fromEntries(['settingsArchiveFolder','settingsArchiveAccess',
  'settingsArchiveChoose','settingsArchiveGrant','archiveFolder','settingsMsg',
  'settingsArchivePathInput','settingsArchivePathSave','settingsArchivePathStatus',
  'settingsArchivePathDetails','settingsArchivePathSummary'].map(id=>[
   id,{textContent:'',value:'',hidden:id==='settingsArchiveGrant',disabled:false,dataset:{}}
 ]));
 const calls=[],storage={...(options.storage||{})},state={
  dir:options.dir||null,record:options.record||null,records:[{id:'previous-folder'}],
  selection:['previous-folder'],showDetails:'previous-folder',
  resultsCache:{clear:()=>calls.push('clear')},folderName:'',pathLabel:options.pathLabel||''
 };
 let currentPick=options.picker||null;
 const window={
  isSecureContext:true,
  ELMOS_TEST_LOGGER:{isBusy:()=>options.busy||false},
  showDirectoryPicker:async args=>{calls.push('picker:'+args.id);if(currentPick instanceof Error)throw currentPick;return currentPick}
 };
 const context={
  S:state,window,folderSelectionRevision:0,$:id=>nodes[id],ui:de=>de,
  text:(id,message)=>{if(nodes[id])nodes[id].textContent=message},
  note:message=>calls.push('note:'+message),
  renderList:()=>calls.push('list'),
  refresh:async()=>calls.push('refresh'),
  remembered:async(action,value,key='folder')=>{
   calls.push('storage:'+action+':'+key);
   if(action==='write')storage[key]=value;
   else return storage[key];
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
 assert.match(html,/id="settingsArchivePathInput"/);
 assert.match(html,/id="settingsArchivePathSave"/);
 assert.match(html,/id="settingsArchivePathStatus"/);
 assert.doesNotMatch(html,/settings-panel-shortcut"[^>]*>Esc</);
 assert.match(read('app.js'),/event\.key==='Escape'/);
 assert.match(html,/Speicherort für Messungen &amp; Kalibrierungen/);
 assert.match(html,/data-app-version="0\.7\.94"/);
 assert.match(html,/archive\.js\?v=0\.7\.87/);
 assert.match(html,/app\.js\?v=0\.7\.94/);
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
 assert.ok(a.calls.includes('storage:write:folder'));
 assert.deepEqual(JSON.parse(JSON.stringify(a.storage['folder-display-path'])),
  {folderName:'Labor-Messungen',path:''});
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
 assert.equal(a.calls.some(x=>x.startsWith('storage:write:')),false);
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

test('Browser names are displayed without inventing an absolute path',async()=>{
 const a=harness({dir:folder('Zeichungen')});
 await a.api.refreshFolderSettings();
 assert.equal(a.nodes.settingsArchiveFolder.textContent,'Zeichungen');
 assert.equal(a.nodes.settingsArchivePathStatus.textContent,'');
 assert.equal(a.nodes.settingsArchivePathStatus.hidden,true);
 assert.equal(a.nodes.settingsArchivePathSummary.textContent,'Pfad hinterlegen');
 assert.equal(a.nodes.settingsArchivePathDetails.hidden,false);
 assert.equal(a.nodes.settingsArchiveChoose.textContent,'Ändern');
 assert.equal(a.nodes.settingsArchivePathStatus.dataset.saved,'false');
 assert.equal(a.nodes.settingsArchivePathInput.disabled,false);
});
test('Manual full-path annotation is stored and shown, but cannot change the actual folder handle',async()=>{
 const dir=folder('Zeichungen'),a=harness({dir});
 const label='C:\\Projekte\\Messungen\\Zeichungen';
 a.nodes.settingsArchivePathInput.value=label;
 assert.equal(await a.api.saveFolderPathLabel(),true);
 assert.equal(a.state.dir,dir);
 assert.equal(a.storage.folder,undefined,'No directory writes are triggered by a label change');
 assert.deepEqual(JSON.parse(JSON.stringify(a.storage['folder-display-path'])),
  {folderName:'Zeichungen',path:label});
 assert.equal(a.state.pathLabel,label);
 assert.match(a.nodes.settingsArchivePathStatus.textContent,/Pfad \(manuell\):/);
 assert.equal(a.nodes.settingsArchivePathStatus.hidden,false);
 assert.equal(a.nodes.settingsArchivePathSummary.textContent,'Pfad bearbeiten');
 assert.equal(a.nodes.settingsArchivePathDetails.open,false);
 assert.ok(a.nodes.settingsArchivePathStatus.textContent.includes(label));
 assert.equal(a.nodes.settingsArchivePathStatus.dataset.saved,'true');
});
test('Saved manual display paths are restored only for the matching folder name',async()=>{
 const stored={folderName:'Zeichungen',path:'D:\\Labor\\Zeichungen'};
 const same=harness({dir:folder('Zeichungen'),storage:{'folder-display-path':stored}});
 await same.api.loadFolderPathLabel(same.state.dir,0);
 assert.equal(same.state.pathLabel,stored.path);
 assert.equal(same.nodes.settingsArchivePathInput.value,stored.path);
 const different=harness({dir:folder('Kalibrierung'),storage:{'folder-display-path':stored}});
 await different.api.loadFolderPathLabel(different.state.dir,0);
 assert.equal(different.state.pathLabel,'');
 assert.doesNotMatch(different.nodes.settingsArchivePathStatus.textContent,/D:\\Labor/);
});
test('Switching folders clears stale path labels and discards their old persisted annotation',async()=>{
 const old=folder('Zeichungen'),a=harness({dir:old,pathLabel:'C:\\Alt\\Zeichungen'});
 a.setPicker(folder('Prüfwerte'));
 await a.api.chooseFolder();
 assert.equal(a.state.pathLabel,'');
 assert.equal(a.nodes.settingsArchivePathInput.value,'');
 assert.deepEqual(JSON.parse(JSON.stringify(a.storage['folder-display-path'])),
  {folderName:'Prüfwerte',path:''});
 assert.equal(a.nodes.settingsArchiveFolder.textContent,'Prüfwerte');
});
test('Cancelling an archive picker never deletes an existing manually entered path',async()=>{
 const a=harness({dir:folder('Zeichungen'),pathLabel:'C:\\Alt\\Zeichungen'});
 const abort=new Error('cancelled');abort.name='AbortError';a.setPicker(abort);
 await assert.rejects(()=>a.api.chooseFolder(),e=>e.name==='AbortError');
 assert.equal(a.state.pathLabel,'C:\\Alt\\Zeichungen');
});
test('Saving a display path without a selected folder is prevented',async()=>{
 const a=harness();
 a.nodes.settingsArchivePathInput.value='C:\\NoRealPermission';
 await assert.rejects(()=>a.api.saveFolderPathLabel(),/Archivordner auswählen/);
 assert.equal(a.state.pathLabel,'');
 assert.equal(a.storage['folder-display-path'],undefined);
});

test('Compact directory settings hide the manual path editor until requested and show a saved full path outside it',async()=>{
 const html=read('index.html');
 assert.match(html,/<details id="settingsArchivePathDetails"/);
 assert.match(html,/<summary id="settingsArchivePathSummary">Pfad hinterlegen<\/summary>/);
 assert.match(html,/<small id="settingsArchivePathStatus"[^>]*hidden>/);
 assert.doesNotMatch(html,/Vollständiger Pfad \(optional, nur zur Anzeige\)<\/label>/);
 assert.doesNotMatch(html,/Der ausgewählte Ordner ist der tatsächliche Speicherort\. Ein manuell eingetragener Pfad/);
 const saved='C:\\Messungen\\Zeichungen';
 const a=harness({dir:folder('Zeichungen'),pathLabel:saved});
 await a.api.refreshFolderSettings();
 assert.equal(a.nodes.settingsArchiveFolder.textContent,'Zeichungen');
 assert.equal(a.nodes.settingsArchivePathStatus.hidden,false);
 assert.equal(a.nodes.settingsArchivePathStatus.title,saved);
 assert.equal(a.nodes.settingsArchivePathDetails.open,undefined);
 assert.equal(a.nodes.settingsArchiveChoose.textContent,'Ändern');
 assert.match(a.nodes.settingsArchivePathStatus.textContent,/Pfad \(manuell\):/);
});
