'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const complete=require('../calibration-complete.js');
const profiles=require('../nvm-reference-profile.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const uid='00200109F7DB';
function fixture(){
 const before=Array(64).fill(0),after=Array(64).fill(0);
 before[0]=after[0]=0xF7DB;before[1]=after[1]=0x0109;
 before[63]=0x2233;after[63]=0x6E91;
 after[35]=0x4BA1;after[39]=0x48E9;after[34]=0x4800;
 const points=[
  {name:'0 bar',pressure:0,temperature:25,unit:'bar',adc_s:-2000,adc_t:1000,rawSamples:[1,2,3]},
  {name:'6 bar',pressure:6,temperature:25,unit:'bar',adc_s:20000,adc_t:1004,rawSamples:[4,5,6]},
  {name:'0 bar bei 75°C',pressure:0,temperature:75,unit:'bar',adc_s:-2100,adc_t:5000}
 ];
 const solution={outputLimit:28000,orderS:1,orderT:1,fitMode:'tk0',
  registers:{sf:0x4800,so:0xDA10,coeffs:[0x4BA1,0,0,0,0x48E9],tcoeffs:[0x1111,0x2222]},
  stats:{maxDigits:0.8,rmsDigits:0.4}};
 const events=[
  ...points.map((p,i)=>({at:'2026-11-18T08:00:0'+i+'Z',kind:'calibration_point',data:{point:p,AFE:{pga1:3,pga2:4},supply:{vdd:5}}})),
  {at:'2026-11-18T08:03:00Z',kind:'coefficient_fit',data:{solution,AFE:{pga1:3,pga2:4}}},
  {at:'2026-11-18T08:04:00Z',kind:'calibration_ram_written',data:{verified:true,registerChanges:[{address:0x6E,value:0x4800}]}},
  {at:'2026-11-18T08:05:00Z',kind:'verification_attempt',data:{pressure:3,dspTarget:0,dspS:2,pass:true}},
  {at:'2026-11-18T08:06:00Z',kind:'nvm_before',data:{uid,words:before,plannedWords:after,
   operation:'calibration',changes:[{index:35,from:0,to:0x4BA1}],
   calibrationReport:{calibrationPoints:points,coefficientFit:solution,unit:'bar',requestedDSPOutputLimit:28000}}},
  {at:'2026-11-18T08:07:00Z',kind:'nvm_after',data:{uid,words:after,crc16:after[63],verified:true,operation:'calibration'}}
 ];
 return {format:'ELMOS_ARCHIVE_RECORD',type:'calibration',chipUID:uid,
  id:'aaa-bbb-ccc-1234',status:'running',startedAt:'2026-11-18T08:00:00.000Z',endedAt:null,
  initial:{nvm:{words:before},ram:{words:{'0x42':42}},configuredUserId:'0x0000'},
  final:null,software:{version:'0.7.0'},equipment:{adapter:'SSP3'},events};
}
test('Full file contains all recorded calibration inputs, DSP, AFE, both 64-word NVM images and full archive',()=>{
 const r=fixture();assert.equal(complete.eligible(r),true);
 const b=complete.build(r);
 assert.equal(b.format,complete.FORMAT);
 assert.equal(b.type,'calibration');
 assert.equal(b.chipUID,uid);
 assert.deepEqual(b.nvm.original.words,r.events.at(-2).data.words);
 assert.deepEqual(b.nvm.programmed.words,r.events.at(-1).data.words);
 assert.equal(b.nvm.programmed.verified,true);
 assert.equal(b.nvm.original.words.length,64);
 assert.equal(b.nvm.programmed.words.length,64);
 assert.equal(b.nvm.programmed.crc16,0x6E91);
 assert.equal(b.dsp.outputLimit,28000);
 assert.equal(b.dsp.temperatureOrder,1);
 assert.equal(b.dsp.registers.sf,0x4800);
 assert.equal(b.dsp.solution.stats.maxDigits,0.8);
 assert.equal(b.reference.unit,'bar');
 assert.deepEqual(b.reference.temperatures,[25,75]);
 assert.equal(b.calibrationPoints.length,3);
 assert.deepEqual(b.calibrationPoints[0].rawSamples,[1,2,3]);
 assert.equal(b.verification.dspAttempts.length,1);
 assert.ok(b.afe.before.words['0x42']===42);
 assert.equal(b.archiveRecord.events.length,r.events.length);
 assert.equal(b.state,'nvm-programmed-verified');
 assert.equal(b.postBootVerified,false);
 assert.match(complete.filename(r),/^ELMOS_Abgleich_Komplett_20261118_080000_00200109F7DB_aaa-bbb-ccc-1234\.json$/);
});
test('Post-boot and finalisation update the SAME complete file and include post-boot proof',()=>{
 const r=fixture(),name=complete.filename(r);
 r.events.push({at:'2026-11-18T08:10:00Z',kind:'post_boot_verified',
  data:{uid,nvm:r.events.at(-1).data.words,boot:{'0x4':1}}});
 r.status='completed';r.endedAt='2026-11-18T08:11:00Z';
 r.final={nvm:{words:r.events.find(e=>e.kind==='nvm_after').data.words},ram:{words:{'0x42':84}}};
 const b=complete.build(r);
 assert.equal(complete.filename(r),name);
 assert.equal(b.state,'completed');
 assert.equal(b.postBootVerified,true);
 assert.equal(b.nvm.postBoot.uid,uid);
 assert.equal(b.finalSnapshot.ram.words['0x42'],84);
});
test('Restore/output/alarm and unverified writes must never create successful calibration file',()=>{
 const r=fixture();
 for(const op of ['restore','output','alarm']){
  const clone=structuredClone(r);
  clone.events.find(e=>e.kind==='nvm_before').data.operation=op;
  clone.events.find(e=>e.kind==='nvm_after').data.operation=op;
  assert.equal(complete.eligible(clone),false);
  assert.throws(()=>complete.build(clone),/bestätigten Kalibrier/);
 }
 const bad=structuredClone(r);
 bad.events.at(-1).data.verified=false;
 assert.equal(complete.eligible(bad),false);
 const missing=structuredClone(r);missing.events.at(-1).data.words=[];
 assert.equal(complete.eligible(missing),false);
 const badCrc=structuredClone(r);badCrc.events.at(-1).data.crc16=0;
 assert.equal(complete.eligible(badCrc),false);
 const foreign=structuredClone(r);foreign.events.at(-1).data.uid='OTHER';
 assert.equal(complete.eligible(foreign),false);
});
test('Late-started archive still exports measurements, fit and settings from session report',()=>{
 const r=fixture();
 r.events=r.events.filter(e=>['nvm_before','nvm_after'].includes(e.kind));
 assert.equal(complete.eligible(r),true);
 const b=complete.build(r);
 assert.equal(b.calibrationPoints.length,3);
 assert.equal(b.dsp.outputLimit,28000);
 assert.equal(b.calibrationSessionReport.requestedDSPOutputLimit,28000);
 assert.deepEqual(b.calibrationPoints[1].rawSamples,[4,5,6]);
});
test('Portable file imports as NVM calculator reference with correct UID, CRC, pressure and raw ADC_T',()=>{
 const b=complete.build(fixture());
 const profile=profiles.fromFile(JSON.parse(JSON.stringify(b)),'Mein-Abgleich.json');
 assert.equal(profile.uid,uid);
 assert.equal(profile.crc,0x6E91);
 assert.equal(profile.fields.pmin,0);
 assert.equal(profile.fields.pmax,6);
 assert.equal(profile.fields.limit,28000);
 assert.equal(profile.fields.pressureUnit,'bar');
 assert.equal(profile.fields.ta,25);
 assert.equal(profile.fields.tb,75);
 assert.equal(profile.fields.adcT1,1002);
 assert.equal(profile.fields.adcT2,5000);
 assert.equal(profiles.match(profile,b.nvm.programmed.words,uid).ok,true);
 const changed=b.nvm.programmed.words.slice();changed[63]^=1;
 assert.equal(profiles.match(profile,changed,uid).ok,false);
});
test('Web app saves complete bundle automatically after verified NVM and provides archive download',()=>{
 const archive=read('archive.js'),app=read('app.js'),ui=read('nvm-reconstruction.js'),html=read('index.html');
 assert.match(archive,/async function saveCalibrationComplete\(record\)/);
 assert.match(archive,/ELMOS_CALIBRATION_COMPLETE\.build\(record\)/);
 assert.match(archive,/ELMOS_CALIBRATION_COMPLETE\.filename\(record\)/);
 assert.match(archive,/if\(kind==='nvm_after'\|\|kind==='post_boot_verified'\)/);
 assert.match(archive,/if\(S\.record\.type==='calibration'\)await saveCalibrationComplete\(S\.record\)/);
 assert.match(archive,/Kompletten Abgleich als JSON herunterladen/);
 assert.match(app,/operation:restoring\?'restore':outputOnly\?'output':alarmOnly\?'alarm':'calibration'/);
 assert.match(app,/calibrationReport:!outputOnly&&!alarmOnly\?report\(\):null/);
 assert.match(ui,/NVM \/ Komplettabgleich laden/);
 assert.match(ui,/E70311-CALIBRATION-COMPLETE-v1/);
 assert.match(html,/calibration-complete\.js\?v=/);
});
