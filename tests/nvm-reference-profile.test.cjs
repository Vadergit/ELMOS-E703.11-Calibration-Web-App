'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const P=require('../nvm-reference-profile.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

const uid='00200109F7DB';
const points=[
 {pressure:0,temperature:25,adc_s:-700,adc_t:1000,sampleCount:8},
 {pressure:6,temperature:25,adc_s:9000,adc_t:1003,sampleCount:8},
 {pressure:0,temperature:75,adc_s:-820,adc_t:5000,sampleCount:8},
 {pressure:6,temperature:75,adc_s:8900,adc_t:5000,sampleCount:8}
];
function nvm(){
 const w=Array(64).fill(0);w[0]=0xF7DB;w[1]=0x0109;w[63]=0x6E91;return w;
}
test('Profile saved after NVM programming preserves all original measured points',()=>{
 const saved={uid,crc:0x6E91,min:0,max:6,unit:'bar',selected:'bar',limit:28000,
  reference:{pmin:0,pmax:6,pressureUnit:'bar',vdd:5,limit:28000,tempModel:'an0203'},
  points,savedAt:'2026-11-18T09:00:00'};
 const profile=P.fromSaved(saved,uid,0x6E91);
 assert.equal(profile.verified,true);
 assert.equal(profile.points.length,4);
 assert.deepEqual(Object.keys(profile.fields).sort(),
  ['adcT1','adcT2','limit','pmax','pmin','pressureUnit','ta','tb','tempModel','vdd'].sort());
 assert.equal(profile.fields.adcT1,1001.5); // mean of two recorded median ADC samples
 assert.equal(profile.fields.adcT2,5000);
 assert.equal(profile.fields.ta,25);
 assert.equal(profile.fields.tb,75);
 assert.equal(P.fromSaved(saved,uid,0x1111),null);
 assert.equal(P.fromSaved(saved,'00200109FFFF',0x6E91),null);
});
test('Real calibration report JSON supplies pressure/temperature targets and measured ADC values',()=>{
 const report={
  tool:'ELMOS E703.11 Kalibrierassistent v0.7.0',
  chipUID:uid,unit:'bar',created:'2026-11-18T09:00:00',
  displayRange:{min:0,max:6,unit:'bar'},
  coefficientFit:{outputLimit:28000,orderT:1},
  calibrationPoints:points
 };
 const profile=P.fromFile(report,'Kalibrierprotokoll.json');
 assert.equal(profile.verified,false,'Imported report is not proven to be the sensor NVM');
 assert.equal(profile.points.length,4);
 assert.equal(profile.fields.pmin,0);
 assert.equal(profile.fields.pmax,6);
 assert.equal(profile.fields.limit,28000);
 assert.equal(profile.fields.tempModel,'an0203');
 assert.equal(profile.fields.adcT1,1001.5);
 assert.equal(P.match(profile,nvm(),uid).ok,true);
 assert.equal(P.match(profile,nvm(),'00200109F7DC').ok,false);
 const other=nvm();other[0]=0x1111;
 assert.equal(P.match(profile,other,null).ok,false);
});
test('Applied Config template has locked target endpoints but no fabricated ADC measurements',()=>{
 const config={version:2,reference:{min:0,max:100,unit:'%'},dsp:{dspLimit:30000,matrix:{temperatures:[25,75]}},output:{vdd:5}};
 const p=P.fromFile(config,'Kalibrier-Preset');
 assert.deepEqual(p.fields,{pmin:0,pmax:100,ta:25,tb:75,vdd:5,limit:30000,pressureUnit:'%'});
 assert.deepEqual(p.points,[]);
 assert.equal(p.verified,false);
 const customized=P.fromFile({...config,reference:{min:0,max:10,unit:'custom'}});
 assert.equal(Object.hasOwn(customized.fields,'pmin'),false);
 assert.equal(Object.hasOwn(customized.fields,'pmax'),false);
 assert.equal(customized.fields.limit,30000);
});
test('No values are invented for missing pressure or temperature points',()=>{
 const p=P.fromFile({version:2,reference:{min:0,max:6,unit:'bar'},dsp:{dspLimit:29000}});
 assert.equal(p.fields.ta,undefined);
 assert.equal(p.fields.tb,undefined);
 assert.equal(p.fields.vdd,undefined);
 assert.equal(p.fields.adcT1,undefined);
 assert.equal(p.fields.adcT2,undefined);
 const inProgress=P.fromCalibration({uid,pmin:0,pmax:6,unit:'bar',limit:29000,points:points.slice(0,2)});
 assert.equal(inProgress.verified,false);
 assert.equal(inProgress.fields.ta,25);
 assert.equal(inProgress.fields.tb,undefined);
 assert.equal(inProgress.points.length,2);
});
test('Stored chip UID/CRC and recorded ADC samples are not silently bound to another chip',()=>{
 const profile=P.fromFile({format:'E70311-Reference-Profile-v1',uid,crc:0x6E91,
  fields:{pmin:0,pmax:6,pressureUnit:'bar'},points});
 assert.equal(P.match(profile,nvm(),uid).ok,true);
 const changedCRC=nvm();changedCRC[63]=0x7AE0;
 assert.equal(P.match(profile,changedCRC,uid).ok,false);
 const changedSerial=nvm();changedSerial[1]=0x010A;
 assert.equal(P.match(profile,changedSerial,null).ok,false);
});
test('Odd and even sample medians, half-digit resolution, and inconsistent temperature readings',()=>{
 const one=P.readings([{pressure:0,temperature:25,adcT:1000}]);
 assert.equal(one.adcT1,1000);
 const half=P.readings([{pressure:0,temperature:25,adcT:1000},{pressure:6,temperature:25,adcT:1003}]);
 assert.equal(half.adcT1,1001.5);
 const different=P.readings([{pressure:0,temperature:25,adcT:1000},{pressure:6,temperature:25,adcT:2000}]);
 assert.equal(different.adcT1,undefined);
 assert.equal(P.normalizeFields({adcT1:1001.5,adcT2:4000}).adcT1,1001.5);
 assert.equal(P.normalizeFields({adcT1:1001.25}).adcT1,undefined);
});
test('Pure parser rejects unrecognised backup and invalid sensor identity',()=>{
 assert.throws(()=>P.fromFile({words:Array(64).fill(0)}),/kein reines NVM-Backup/);
 assert.throws(()=>P.fromFile({format:'E70311-Reference-Profile-v1',uid:'bad',fields:{pmin:0,pmax:6}}),/Chip-UID/);
 assert.equal(P.match(null,nvm(),uid).ok,false);
});
test('Browser wiring retains measured calibration data, locks known fields and provides an override',()=>{
 const app=read('app.js'),expert=read('expert.js'),ui=read('nvm-reconstruction.js'),html=read('index.html'),css=read('nvm-reconstruction.css');
 assert.match(html,/nvm-reference-profile\.js\?v=/);
 assert.match(app,/const points=ELMOS_NVM_PROFILE\.cleanPoints\(st\.calpoints\)/);
 assert.match(app,/const temperatures=ELMOS_NVM_PROFILE\.readings\(points\)/);
 assert.match(app,/reference,points,/);
 assert.match(app,/st\.referenceTemplate=ELMOS_NVM_PROFILE\.fromFile/);
 assert.match(expert,/ELMOS_NVM_PROFILE\.fromCalibration/);
 assert.match(expert,/sessionProfile/);
 assert.match(ui,/Kalibrierprofil laden/);
 assert.match(ui,/state\.profileLocked=\{\.\.\.profile\.fields\}/);
 assert.match(ui,/control\.disabled=!!locked/);
 assert.match(ui,/state\.profileOverride=!st\.profileOverride|st\.profileOverride=!st\.profileOverride/);
 assert.match(ui,/Druck min\./);
 assert.match(css,/nvmrecon-profile-fixed input:disabled/);
 assert.match(ui,/nvmrecon-profile-table/);
 assert.match(ui,/st\.sessionProfile\)/);
});


test('Live NVM profile matching uses the entire stored image when available',()=>{
 const savedWords=nvm();
 const saved={
  uid,crc:savedWords[63],nvmWords:savedWords.slice(),
  min:0,max:6,selected:'bar',unit:'bar',limit:28000,
  reference:{pressureUnit:'bar',pmin:0,pmax:6,limit:28000},points
 };
 const getter=key=>key==='elmos-dsp-display-by-uid-v1-'+uid?JSON.stringify(saved):null;
 // Use the actual browser module environment, where the profile parser is loaded
 // before the calculator. This also covers the existing localStorage key.
 const vm=require('node:vm');
 const context=vm.createContext({module:{exports:{}},console});
 vm.runInContext(read('nvm-reference-profile.js'),context);
 vm.runInContext(read('nvm-reconstruction.js'),context);
 const recon=context.module.exports;
 const exact=recon.referenceMetadata(savedWords,uid,getter);
 assert.equal(exact.savedProfile?.fields.pmin,0);
 assert.equal(exact.savedProfile?.fields.pmax,6);
 assert.equal(exact.savedProfile?.fields.limit,28000);
 const changed=savedWords.slice();changed[43]^=1; // simulates same CRC word but different calibration
 const stale=recon.referenceMetadata(changed,uid,getter);
 assert.equal(stale.savedProfile,undefined);
 assert.equal(stale.limitSource,'default');
});
test('Custom saved display units never lock pressure values as bar',()=>{
 const saved={uid,crc:0x6E91,min:0,max:100,selected:'custom',unit:'N',
  limit:31000,reference:{pmin:0,pmax:100,pressureUnit:undefined},points};
 const profile=P.fromSaved(saved,uid,0x6E91);
 assert.ok(profile);
 assert.equal(profile.fields.pmin,undefined);
 assert.equal(profile.fields.pmax,undefined);
 assert.equal(profile.fields.limit,31000);
});
test('Matrix temperatures from applied template are retained even without DSP details',()=>{
 const loaded=P.fromFile({version:2,measurement:{matrix:{temperatures:[25,85]}},reference:{min:0,max:6,unit:'bar'}});
 assert.equal(loaded.fields.ta,25);
 assert.equal(loaded.fields.tb,85);
 assert.equal(loaded.fields.limit,undefined);
});
