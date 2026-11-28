const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
function setup(){
 const port={},st={port,chip:true,uid:{hex:'abc'},sessionIndex:1},els={liveUserIdCard:{hidden:true,parentElement:{classList:{toggle(k,v){this[k]=v}}}},liveUserId:{textContent:'—'},liveUserIdHex:{textContent:'—'}};
 let backup=false,raw=175,readUid='abc',reads=0;
 const ctx={st,$:id=>els[id],hasCurrentNvmBackup:()=>backup,readReg:async addr=>{assert.equal(addr,0x6A);reads++;return raw},readCalibrationUid:async()=>readUid,logging:()=>{}};
 const start=source.indexOf(' function liveUserIdContextMatches('),end=source.indexOf(' function renderLiveOverview(',start);assert.ok(start>=0&&end>start);
 const api=vm.runInNewContext(source.slice(start,end)+'\n;({currentLiveUserId,renderLiveUserId,readLiveUserId})',ctx);
 return {st,els,api,setBackup:value=>{backup=true;st.nvmBackup=Array(64).fill(0);st.nvmBackup[30]=value},setRaw:x=>raw=x,setReadUid:x=>readUid=x,reads:()=>reads};
}
test('show confirmed RAM ID, hide on disconnect and chip/session change',async()=>{const {st,els,api,reads}=setup();await api.readLiveUserId();assert.equal(reads(),1);assert.equal(els.liveUserIdCard.hidden,false);assert.equal(els.liveUserId.textContent,'175');assert.equal(els.liveUserIdHex.textContent,'0x00AF');st.uid={hex:'def'};api.renderLiveUserId();assert.equal(els.liveUserIdCard.hidden,true);st.uid={hex:'abc'};st.sessionIndex++;assert.equal(api.currentLiveUserId(),null);st.chip=false;api.renderLiveUserId();assert.equal(els.liveUserId.textContent,'—');});
test('verified NVM takes precedence including zero and maximum ID',async()=>{const {api,els,setBackup}=setup();await api.readLiveUserId();setBackup(0);api.renderLiveUserId();assert.equal(els.liveUserIdCard.hidden,true);setBackup(65535);api.renderLiveUserId();assert.equal(els.liveUserIdCard.hidden,false);assert.equal(els.liveUserIdHex.textContent,'0xFFFF');});
test('zero, failed UID proof and invalid data remain hidden',async()=>{const {api,els,setRaw,setReadUid}=setup();for(const raw of [0,-1,65536]){setRaw(raw);await api.readLiveUserId();assert.equal(els.liveUserIdCard.hidden,true)}setRaw(175);setReadUid('different');await api.readLiveUserId();assert.equal(els.liveUserIdCard.hidden,true)});
