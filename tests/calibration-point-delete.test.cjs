const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
function setup(){
 const a={kind:'lo',at:'a'},b={kind:'hi',at:'b'},c={kind:'extra',slot:1,at:'c'},d={kind:'extra',slot:2,at:'d'};
 const st={calpoints:[a,b,c,d],points:{lo:a,hi:b},verify:{},uid:{hex:'123'},calfit:{},calImage:{},calStaged:true,calVerified:true,calValidation:[1],postBootProof:{}};
 const calls=[];const ctx={st,demoEnabled:false,window:{},lsSet:(...x)=>calls.push(['lsSet',...x]),checkpointKey:uid=>uid,saveCalibrationCheckpoint:()=>calls.push(['save',st.calpoints.length]),invalidateCalculation:()=>{st.calfit=null;st.calImage=null;st.calStaged=false;st.calVerified=false;st.calValidation=[];},refreshPoints:()=>calls.push(['refresh']),show:()=>{},renderFlowState:()=>{}};
 const start=source.indexOf(' function calibrationPointEditBusy('),end=source.indexOf(' function renderCapturedPoint(',start);assert.ok(start>=0&&end>start);
 const api=vm.runInNewContext(source.slice(start,end)+'\n;({removeCalibrationPoint,calibrationPointEditBusy})',ctx);
 return {st,calls,api,a,b,c,d};
}
test('delete only selected endpoint and invalidate derived approvals',()=>{const {st,calls,api,a,b,c,d}=setup();assert.equal(api.removeCalibrationPoint('lo',undefined,'a'),true);assert.deepEqual(Array.from(st.calpoints),[b,c,d]);assert.equal(st.points.lo,null);assert.equal(st.points.hi,b);assert.equal(st.calImage,null);assert.equal(st.calfit,null);assert.equal(st.calVerified,false);assert.equal(st.verify,null);assert.equal(st.postBootProof,null);assert.ok(calls.some(x=>x[0]==='save'&&x[1]===3));});
test('delete exact extra slot without disturbing endpoints or other extras',()=>{const {st,api,a,b,c,d}=setup();assert.equal(api.removeCalibrationPoint('extra',1,'stale'),false);assert.equal(api.removeCalibrationPoint('extra',1,'c'),true);assert.deepEqual(Array.from(st.calpoints),[a,b,d]);assert.equal(st.points.lo,a);assert.equal(st.points.hi,b);});
test('busy and already programmed sessions refuse deletion',()=>{for(const key of ['calCapturePending','calTask','writing','nvmWorking','nvmAttempting','nvmRechecking','closing','nvmDone']){const {st,api}=setup();st[key]=true;assert.equal(api.removeCalibrationPoint('lo',undefined,'a'),false);assert.equal(st.calpoints.length,4);}});
test('last point clears old checkpoint without saving empty draft',()=>{const {st,api,calls,a}=setup();st.calpoints=[a];assert.equal(api.removeCalibrationPoint('lo',undefined,'a'),true);assert.equal(st.calpoints.length,0);assert.ok(calls.some(x=>x[0]==='lsSet'));assert.ok(!calls.some(x=>x[0]==='save'));});
