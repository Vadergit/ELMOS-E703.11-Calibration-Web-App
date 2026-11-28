const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
function setup(){
 const elements={};
 for(const id of ['nvmUserId','nvmUserIdError','nvmUserIdFormat','nvmUserIdPreviewLabel','nvmUserIdPreview','nvmUserIdSwitch'])elements[id]={value:'',dataset:{format:'decimal'},disabled:false,setAttribute(k,v){this[k]=v}};
 const start=source.indexOf(' function parseNvmUserId('),end=source.indexOf(' async function readNvmBridgeSupply(',start);
 assert.ok(start>=0&&end>start);
 const api=vm.runInNewContext(source.slice(start,end)+'\n;({parseNvmUserId,formatNvmUserId,requestedNvmUserId,refreshNvmUserIdPreview,switchNvmUserIdFormat,resetNvmUserId})',{$:id=>elements[id]});
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
