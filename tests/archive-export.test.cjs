'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const X=require('../archive-export.js');
function rows(s){return s.replace(/^\uFEFF/,'').trimEnd().split('\r\n');}

test('every archive type emits complete metadata in long-form CSV',()=>{
 for(const type of ['calibration','verification','testlog','output']){
  const record={type,id:'audit-1',chipUID:'ABC',startedAt:'2026-11-15T20:00:00Z',
   initial:{ram:{afe:[1,2]},nvm:{words:[0,65535]}},
   final:{ram:{gain:3}},events:[{kind:'marker',at:'2026-11-15T20:05:00Z',data:{message:'5 bar'}}]};
  const csv=X.csvAll(record,[]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv,/\$\.initial\.nvm\.words\[1\]/);
  assert.match(csv,/\$\.final\.ram\.gain/);
  assert.ok(csv.includes('"Ereignis","marker"'));
  assert.ok(csv.includes('"ABC"'));
 }
});

test('logger export includes every raw sample, debug response and event',()=>{
 const r={type:'testlog',id:'id-123',chipUID:'ZZ',startedAt:'2026-11-15T12:00:00Z',
  testConfiguration:{name:'Test',description:'Mehrzeilig\nText',aggregation:'mean'},
  events:[{kind:'marker',at:'2026-11-15T12:01:00Z',data:{message:'Referenz geändert'}}]};
 const points=[{index:1,kind:'telemetry_point',startedAt:'2026-11-15T12:00:10Z',
  samples:[{at:'2026-11-15T12:00:10Z',dspS:-31954,adcS:-1519},
   {at:'2026-11-15T12:00:11Z',dspS:-31920}],
  aggregated:{channels:{dspS:-31937}},transport:[{at:'2026-11-15T12:00:11Z',line:'#READ OK'}],
  errors:[{code:'timeout'}]}];
 const csv=X.csvAll(r,points);
 assert.ok(csv.includes('"Einzelmessung","Rohsample"'));
 assert.ok(csv.includes('"$.dspS","-31954"'));
 assert.ok(csv.includes('"$.dspS","-31920"'));
 assert.ok(csv.includes('"$.aggregated.channels.dspS","-31937"'));
 assert.ok(csv.includes('"Kommunikation","TX/RX"'));
 assert.ok(csv.includes('"timeout"'));
 assert.ok(csv.includes('Referenz geändert'));
 assert.ok(csv.includes('"Mehrzeilig\nText"'));
});

test('spreadsheet formula strings are escaped, numbers remain numeric',()=>{
 const csv=X.csvAll({id:'id',type:'output',description:'=HYPERLINK("x")',
   initial:{values:[-20,25]},events:[{kind:'marker',data:{message:'+cmd'}}]});
 assert.ok(csv.includes("'=HYPERLINK"));
 assert.ok(csv.includes("'+cmd"));
 assert.ok(csv.includes('"$.initial.values[0]","-20"'));
});
