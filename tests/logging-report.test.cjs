'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Report=require('../logging-report.js');
const record={
 type:'testlog',id:'TST-123',chipUID:'026D1C0C',status:'completed',
 startedAt:'2026-11-15T20:00:00Z',endedAt:'2026-11-15T20:01:00Z',
 testConfiguration:{name:'Drucktest',dutName:'Sensor A',operator:'ND',intervalMs:1000,
  samplesPerPoint:2,aggregation:'mean',description:'5 bar und zurück'},
 equipment:{interface:'plc',adapter:'SSP3'},software:{version:'0.7.70'},
 events:[{at:'2026-11-15T20:00:03Z',kind:'marker',data:{message:'Referenz: 5 bar'}}],
 telemetry:{missedSlots:1}
};
const points=[
 {kind:'telemetry_point',index:1,startedAt:'2026-11-15T20:00:01Z',
  endedAt:'2026-11-15T20:00:02Z',lagMs:1,skippedIntervals:0,
  aggregated:{channels:{adcS:-1519,dspS:-31954}},
  samples:[{adcS:-1518,dspS:-31950},{adcS:-1520,dspS:-31958}],
  reference:{pressure:5,temperature:25}},
 {kind:'telemetry_point',index:2,endedAt:'2026-11-15T20:00:03Z',
  aggregated:{channels:{adcS:-1521,dspS:-31920}},samples:[{dspS:-31920}],
  reference:{pressure:0,temperature:25}}
];
test('logging PDF includes header, identity, chart, all groups, markers and metrics',()=>{
 const pdf=Report.makeReport(record,points);
 assert.ok(pdf.includes('Test / Logging – Prüfprotokoll'));
 assert.ok(pdf.includes('Sensor A'));
 assert.ok(pdf.includes('One-Wire (AODO)'));
 assert.ok(pdf.includes('Referenz: 5 bar'));
 assert.ok(pdf.includes('Rohsamples'));
 assert.ok(pdf.includes('Alle aufgenommenen Messpunkte (2)'));
 assert.ok(pdf.includes('<polyline'));
 assert.ok(pdf.includes('TST-123'));
 assert.ok(pdf.includes('Aufnahmeeinstellungen'));
});

test('i2c shown as I²C, strings escaped and empty logs can still print',()=>{
 const malicious={...record,events:[],equipment:{interface:'i2c'},
  testConfiguration:{...record.testConfiguration,name:'<script>alert(1)</script>'}};
 const html=Report.makeReport(malicious,[]);
 assert.ok(html.includes('I²C'));
 assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
 assert.ok(!html.includes('<script>alert(1)</script>'));
 assert.ok(html.includes('Alle aufgenommenen Messpunkte (0)'));
});

test('report cannot use unverified record type or absent telemetry',()=>{
 assert.throws(()=>Report.makeReport({type:'verification'},[]),/Logging/);
 assert.throws(()=>Report.makeReport(record,null),/Telemetrie/);
});
