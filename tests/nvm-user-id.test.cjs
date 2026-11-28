const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
function setup(){
 const elements={};
 for(const id of ['nvmUserId','nvmUserIdLabel','nvmUserIdError','nvmUserIdFormat','nvmUserIdPreviewLabel','nvmUserIdPreview','nvmUserIdSwitch'])elements[id]={value:'',dataset:{format:'decimal'},disabled:false,setAttribute(k,v){this[k]=v}};
 const start=source.indexOf(' function validNvmUserIdInput('),end=source.indexOf(' async function readNvmBridgeSupply(',start);
 assert.ok(start>=0&&end>start);
 const api=vm.runInNewContext(source.slice(start,end)+'\n;({validNvmUserIdInput,guardNvmUserIdBeforeInput,acceptNvmUserIdInput,parseNvmUserId,formatNvmUserId,requestedNvmUserId,refreshNvmUserIdPreview,switchNvmUserIdFormat,resetNvmUserId})',{$:id=>elements[id]});
 return {api,elements};
}
test('all 65536 USER-ID values round trip in both formats',()=>{
 const {api:a}=setup();
 for(let i=0;i<=65535;i++)for(const format of ['decimal','hex'])assert.equal(a.parseNvmUserId(a.formatNvmUserId(i,format),format),i);
});
test('empty, zero, invalid and prefixed values',()=>{
 const {api:a}=setup();
 for(const format of ['decimal','hex']){assert.equal(a.parseNvmUserId('  ',format),undefined);assert.equal(a.parseNvmUserId('0',format),0)}
 assert.equal(a.parseNvmUserId('0x00af','hex'),175);
 for(const [s,f] of [['65536','decimal'],['-1','decimal'],['1.5','decimal'],['1e2','decimal'],['0xA','decimal'],['10000','hex'],['0x','hex'],['GG','hex']])assert.throws(()=>a.parseNvmUserId(s,f));
});
test('format switch preserves numerical ID, preview, empty input and reset',()=>{
 const {api:a,elements:e}=setup(),input=e.nvmUserId;
 input.value='175';a.refreshNvmUserIdPreview();assert.equal(e.nvmUserIdPreview.textContent,'0x00AF');
 a.switchNvmUserIdFormat();assert.equal(input.value,'00AF');assert.equal(a.requestedNvmUserId(),175);assert.equal(e.nvmUserIdPreview.textContent,'175');
 a.switchNvmUserIdFormat();assert.equal(input.value,'175');
 a.resetNvmUserId();assert.equal(input.dataset.format,'decimal');assert.equal(a.requestedNvmUserId(),undefined);
 a.switchNvmUserIdFormat();assert.equal(input.value,'');input.value='FFFF';a.switchNvmUserIdFormat();assert.equal(input.value,'65535');
 input.value='65536';a.refreshNvmUserIdPreview();assert.equal(e.nvmUserIdSwitch.disabled,true);a.switchNvmUserIdFormat();assert.equal(input.value,'65536');
 a.resetNvmUserId();input.value='0';input.disabled=true;a.switchNvmUserIdFormat();assert.equal(input.dataset.format,'decimal');
});

test('invalid typing and paste are rejected without changing the last accepted ID',()=>{
 const {api:a,elements:e}=setup(),input=e.nvmUserId;
 a.resetNvmUserId();input.value='6553';assert.equal(a.acceptNvmUserIdInput(),true);
 input.selectionStart=input.selectionEnd=4;
 let prevented=false;
 a.guardNvmUserIdBeforeInput({cancelable:true,inputType:'insertText',data:'6',preventDefault(){prevented=true}});
 assert.equal(prevented,true);assert.equal(input.value,'6553');assert.equal(e.nvmUserIdError.hidden,false);
 for(const bad of ['65536','-1','1.5','1e2','0xAF','123456','12 3',' 12','000000']){
  input.value=bad;assert.equal(a.acceptNvmUserIdInput(),false);assert.equal(input.value,'6553');
 }
 input.value='65535';assert.equal(a.acceptNvmUserIdInput(),true);assert.equal(e.nvmUserIdError.hidden,true);
 a.switchNvmUserIdFormat();assert.equal(input.value,'FFFF');assert.equal(input.dataset.accepted,'FFFF');
 for(const bad of ['10000','GG','-1','0x','FF FF']){
  input.value=bad;assert.equal(a.acceptNvmUserIdInput(),false);assert.equal(input.value,'FFFF');
 }
 input.value='0x00af';assert.equal(a.acceptNvmUserIdInput(),true);assert.equal(a.requestedNvmUserId(),175);
 input.value='00AF';assert.equal(a.acceptNvmUserIdInput(),false);
 input.value='';assert.equal(a.acceptNvmUserIdInput(),true);assert.equal(a.requestedNvmUserId(),undefined);
 a.resetNvmUserId();assert.equal(e.nvmUserIdLabel.textContent,'Sensor-ID – Dezimal (optional)');
});
