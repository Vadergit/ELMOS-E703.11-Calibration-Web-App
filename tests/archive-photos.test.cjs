'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../archive-photos.js');

const jpeg='data:image/jpeg;base64,'+Buffer.from([255,216,255,224,0,16,74,70,73,70,0,255,217]).toString('base64');
const entry=(caption='Prüfaufbau')=>({dataUrl:jpeg,caption,width:8,height:8});
test('archive photos accept up to two small JPEGs and keep optional descriptions',()=>{
 const images=P.validate([entry(),entry('DUT Rückseite')]);
 assert.equal(images.length,2);
 assert.equal(images[0].caption,'Prüfaufbau');
 assert.equal(images[1].caption,'DUT Rückseite');
 assert.ok(images.every(x=>x.bytes<300*1024));
 assert.equal(P.MAX_COUNT,2);
 assert.equal(P.MAX_BYTES,300*1024);
});
test('excess image count, oversized JPEG and unsupported MIME are refused',()=>{
 assert.throws(()=>P.validate([entry(),entry(),entry()]),/Maximal 2 Bilder/);
 const large='data:image/jpeg;base64,'+'A'.repeat(450000);
 assert.throws(()=>P.validate([{dataUrl:large}]),/300 KB/);
 assert.throws(()=>P.validate([{dataUrl:'data:image/png;base64,AAAA'}]),/ungültiges Format/);
 assert.throws(()=>P.validate([{dataUrl:'javascript:alert(1)'}]),/ungültiges Format/);
});
test('print gallery embeds images but escapes potentially malicious captions',()=>{
 const html=P.reportPhotos([entry('Aufbau <script>alert(1)</script>'),entry('Sensor 1')]);
 assert.ok(html.includes('Fotos zum Prüfprotokoll'));
 assert.equal((html.match(/<img /g)||[]).length,2);
 assert.ok(html.includes('data:image/jpeg;base64,'));
 assert.ok(html.includes('Aufbau &lt;script&gt;alert(1)&lt;/script&gt;'));
 assert.ok(!html.includes('<script>'));
 assert.equal(P.reportPhotos([]),'');
 assert.equal(P.reportPhotos([{dataUrl:'file:///etc/passwd'}]),'');
});
test('both verification and logging HTML-PDF reports include the same stored photos',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const root=path.resolve(__dirname,'..');
 const verifySrc=fs.readFileSync(path.join(root,'verification-report.js'),'utf8');
 const logSrc=fs.readFileSync(path.join(root,'logging-report.js'),'utf8');
 const document={documentElement:{lang:'de-CH'}};
 const verify=new Function('window','document','ELMOS_ARCHIVE_PHOTOS',
  verifySrc+';return ELMOS_VERIFICATION_REPORT;')(
   {ELMOS_VERIFICATION_GRAPH:{summary:()=>({total:0,measured:0,data:[]})}},document,P);
 const log=new Function('window','document','ELMOS_ARCHIVE_PHOTOS',
  logSrc+';return ELMOS_LOGGING_REPORT;')({},document,P);
 const photos=[entry('Prüfaufbau'),entry('Sensor vorne')];
 const verification=verify.makeReport({type:'verification',id:'123',chipUID:'026D1C0C',
  startedAt:'2026-11-15T11:00:00Z',endedAt:'2026-11-15T11:10:00Z',
  verificationConfig:{pressureUnit:'bar',calibrationMin:0,calibrationMax:10},events:[],photos,
  plan:{mode:'pressure',steps:[]}});
 const logging=log.makeReport({type:'testlog',id:'123',chipUID:'026D1C0C',
  startedAt:'2026-11-15T11:00:00Z',endedAt:'2026-11-15T11:10:00Z',
  testConfiguration:{name:'Testlauf'},events:[],photos},[]);
 for(const report of [verification,logging]){
  assert.ok(report.includes('Fotos zum Prüfprotokoll'));
  assert.equal((report.match(/class="elmos-report-photo"/g)||[]).length,2);
  assert.ok(report.includes('Prüfaufbau'));
  assert.ok(report.includes('Sensor vorne'));
  assert.ok(report.includes('max-height:310px'));
 }
});
