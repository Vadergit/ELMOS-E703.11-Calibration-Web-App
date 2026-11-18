'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../archive-core.js');
const ANALYSIS=require('../archive-analysis.js');
const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
const base={id:'a1b2c3d4-e5f6-4729-aabb-ccddeeff0011',chipUID:'00200109F7DB',
 startedAt:'2026-11-18T08:43:00.123Z',status:'completed',
 format:C.FORMAT,schemaVersion:C.VERSION,events:[]};
test('New archive JSON/CSV filenames clearly identify calibration, verification, logging and output',()=>{
 const expected={
  calibration:'Abgleich',verification:'Nachmessung',testlog:'Logging',output:'Ausgang'
 };
 for(const [type,label] of Object.entries(expected)){
  const record={...base,type};
  const name=C.filename(record);
  assert.equal(C.valid(record),true);
  assert.ok(name.startsWith('ELMOS_'+label+'_20261118_084300_00200109F7DB_'),name);
  assert.match(name,/a1b2c3d4-e5f6-4729-aabb-ccddeeff0011\.json$/);
  assert.equal(name.replace(/\.json$/,'.csv').includes(label),true);
 }
});
test('Optional names become short safe filename segments, record IDs keep names distinct',()=>{
 const name=C.filename({...base,type:'verification',label:'Endprüfung / Charge 104 – Zürich: 5 bar'});
 assert.match(name,/Endpruefung_Charge_104_Zuerich_5_bar_/);
 assert.doesNotMatch(name,/[\\/<>:"|?*]/);
 assert.ok(name.length<190);
 const noName=C.filename({...base,type:'verification',label:'   '});
 assert.match(noName,/F7DB_a1b2c3d4/);
 assert.doesNotMatch(noName,/Zuerich/);
 assert.notEqual(C.filename({...base,type:'verification',label:'Los 7',id:'id-first-01'}),
  C.filename({...base,type:'verification',label:'Los 7',id:'id-second-02'}));
 const malicious=C.safeFilenameLabel('../=HYPERLINK("bad") : * <>');
 assert.doesNotMatch(malicious,/[\\/<>:"|?*]/);
 assert.ok(malicious.length<=45);
});
test('Archive results expose the name while legacy records still work without new field',()=>{
 const named=ANALYSIS.overview({...base,type:'verification',label:'Klimakammer 75 Grad'});
 assert.match(named.title,/Nachmessung · Klimakammer 75 Grad/);
 const logging=ANALYSIS.overview({...base,type:'testlog',label:'Drucktest 6 bar'});
 assert.match(logging.title,/Test \/ Logging · Drucktest 6 bar/);
 const old=ANALYSIS.overview({...base,type:'verification'});
 assert.equal(old.title,'Nachmessung');
 const oldLog=ANALYSIS.overview({...base,type:'testlog',testConfiguration:{name:'Alter Test'}});
 assert.match(oldLog.title,/Alter Test/);
});
test('Name is an optional field on the verification planner and on the logger',()=>{
 const archive=read('archive.js'),logger=read('test-logger.js');
 assert.match(archive,/id=\\"arVerificationName\\" maxlength=\\"120\\"/);
 assert.match(archive,/begin\('verification',S\.draft,\{label:trimInput\('arVerificationName',120\)\}\)/);
 assert.match(logger,/Testname \(optional\)/);
 assert.doesNotMatch(logger,/if\(!name\|\|name\.length>120\)/);
 assert.match(logger,/name:name\|\|null/);
 assert.match(logger,/begin\('testlog',null,\{label:opts\.name\}\)/);
 assert.match(archive,/label,chipUID:meta\.uid/);
 assert.match(archive,/r\.label,r\._archiveName/);
});
test('Old archive files keep original disk filename for photos and JSON/CSV exports',()=>{
 const archive=read('archive.js');
 assert.match(archive,/parsed\._archiveName=name/);
 assert.match(archive,/record\._archiveName\|\|C\.filename\(record\)/);
 assert.match(archive,/const filename=record\._archiveName\|\|C\.filename\(record\)/);
 assert.match(archive,/const base=record\._archiveName\|\|C\.filename\(record\)/);
});
test('PDF print titles use descriptive category and name when the archive core is available',()=>{
 const v=read('verification-report.js'),l=read('logging-report.js'),c=read('calibration-report.js');
 for(const source of [v,l,c]){
  assert.match(source,/ELMOS_ARCHIVE_CORE\.filename\(record\)\.replace/);
 }
 assert.match(v,/Name der Nachmessung/);
 const ex=read('expert.js');
 assert.match(ex,/ELMOS_NVM_/);
 assert.match(ex,/ELMOS_NVM_.*stamp/);
});
