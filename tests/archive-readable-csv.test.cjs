'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const X=require('../archive-readable-csv.js');

const record=()=>{
 const steps=[0,5,10,5,0].map((pressure,index)=>({
  index,pressure,temperature:25,cycle:1,
  pressureDirection:index<3?'up':'down'
 }));
 const readings=[-0.001953125,3.485234375,10.11984375,2.896875,0.00421875];
 return {
  type:'verification',id:'v-1',chipUID:'0020011DBBE7',
  startedAt:'2026-11-15T20:13:42Z',endedAt:'2026-11-15T20:14:32Z',status:'completed',
  verificationMetadata:{operator:'Prüfer A',project:'Prüfauftrag 2'},
  equipment:{interface:'plc',adapter:'SSP3'},
  verificationConfig:{pressureUnit:'bar',calibrationMin:0,calibrationMax:10,
   pressureSpan:10,toleranceEnabled:false,pressureEntryMode:'percent'},
  plan:{mode:'pressure',steps},
  events:[
   ...Array.from({length:250},(_,i)=>({kind:'transport',data:{line:'TX #PLC '+i}})),
   ...readings.map((reading,i)=>({kind:'measurement',at:'2026-11-15T20:13:51Z',
    data:{stepIndex:i,attempt:1,referencePressure:steps[i].pressure,
     referenceTemperature:25,sample:{at:'2026-11-15T20:13:51Z',
      pressureUnit:'bar',sensorPressure:reading,count:12,
      dspS:-32000,samples:[{adcS:-1500},{adcS:-1510}]}}}))
  ]
 };
};
const csvRows=s=>s.replace(/^\uFEFF/,'').trim().split(/\r\n/);
test('one concise verification CSV puts a short measurement table before metadata',()=>{
 const csv=X.csvReport(record()),rows=csvRows(csv);
 assert.ok(csv.startsWith('\uFEFF'));
 assert.equal(rows[0],'"NACHMESSUNG – PRÜFPROTOKOLL"');
 const table=rows.findIndex(x=>x.includes('"Nr.";"Referenz [bar]"'));
 const metadata=rows.findIndex(x=>x.includes('"PRÜFANGABEN"'));
 assert.ok(table>0&&metadata>table);
 assert.equal(rows.filter(x=>/^"[1-9]\d*";/.test(x)).length,5);
 assert.ok(rows.length<30,'unexpected rows: '+rows.length);
 assert.ok(csv.includes('"Abw. [bar]"'));
 assert.ok(csv.includes('"Abw. [% FS]"'));
 assert.ok(csv.includes('"-1.514766"'));
 assert.ok(csv.includes('"Samples pro Messpunkt";"12"'));
 assert.ok(csv.includes('"Kommunikation";"One-Wire (AODO)"'));
 assert.ok(!csv.includes('TX #PLC'));
 assert.ok(!csv.includes('$.'));
 assert.ok(!csv.includes('"Soll [bar]"')); // duplicate Soll / reference removed
 assert.ok(!csv.includes('"Samples";')); // same value for every measurement
});
test('repeated attempts retain explicit Versuch and incomplete points stay visible',()=>{
 const r=record();r.plan.steps=r.plan.steps.slice(0,3);
 r.events=r.events.filter(e=>e.kind==='measurement'&&e.data.stepIndex===0);
 r.events.push({kind:'measurement',data:{...r.events[0].data,
  attempt:2,sample:{sensorPressure:0.02,pressureUnit:'bar',count:3}}});
 const csv=X.csvReport(r);
 assert.ok(csv.includes('"Versuch"'));
 assert.ok(csv.includes('"Nicht gemessen"'));
 assert.ok(csv.includes('"2"'));
 assert.equal(csvRows(csv).filter(x=>/^"[1-9]\d*";/.test(x)).length,4);
});
test('combined pressure and temperature includes calibrated temperature and ramp direction',()=>{
 const r=record();r.plan.mode='combined';
 r.plan.steps=[{index:0,pressure:5,temperature:65,cycle:2,pressureDirection:'up',temperatureDirection:'down'},
  {index:1,pressure:5,temperature:25,cycle:2,pressureDirection:'down',temperatureDirection:'up'}];
 r.events=[{kind:'measurement',at:'2026-11-15T20:14:00Z',data:{
  stepIndex:0,referencePressure:5,referenceTemperature:65,
  sample:{sensorPressure:5.01,pressureUnit:'bar',sensorTempC:65.2}}}];
 const csv=X.csvReport(r);
 assert.ok(csv.includes('Ref. Temp. [°C]'));
 assert.ok(csv.includes('Abw. Temp. [°C]'));
 assert.ok(csv.includes('Temperaturrichtung'));
 assert.ok(csv.includes('Druckrichtung'));
 assert.ok(csv.includes('"0.2"'));
});
test('logging CSV has only measured values and essential events, never full raw audit paths',()=>{
 const r={type:'testlog',id:'t-1',chipUID:'ABC',
  testConfiguration:{name:'Messung 1',operator:'A',aggregation:'mean'},
  events:[{kind:'marker',data:{message:'5 bar angefahren'}},
   {kind:'debug_tail',data:{lines:['#PLC','TX','RX']}}]};
 const groups=[{index:1,startedAt:'2026-11-15T20:15:00Z',
  aggregated:{channels:{adcS:-1500,dspS:-32000}},
  samples:[{adcS:-1501,dspS:-32001},{adcS:-1499,dspS:-31999}],
  sensorSnapshot:{sensorPressure:5,pressureUnit:'bar'},reference:{pressure:5}}];
 const csv=X.csvReport(r,groups);
 assert.ok(csv.includes('"ADC_S [Digits]"'));
 assert.ok(csv.includes('"DSP_S [Digits]"'));
 assert.ok(csv.includes('"Messung 1"'));
 assert.ok(csv.includes('5 bar angefahren'));
 assert.ok(!csv.includes('#PLC'));
 assert.ok(!csv.includes('$.'));
});
test('calibration and output exports are short tables with no JSON event dumps',()=>{
 const cal={type:'calibration',chipUID:'A',events:[
  {kind:'calibration_point',data:{point:{name:'P1',pressure:1,unit:'bar',temperature:25,adc_s:-1512,adc_t:15000,sampleCount:12}}},
  {kind:'nvm_after',data:{raw:[1,2,3]}},
  {kind:'transport',data:{line:'#PLC'}}]};
 const csv=X.csvReport(cal);
 assert.ok(csv.includes('"P1"'));
 assert.ok(csv.includes('"ADC_S [Digits]"'));
 assert.ok(!csv.includes('#PLC'));
 assert.ok(!csv.includes('$.'));
 const out=X.csvReport({type:'output',events:[{kind:'nvm_after',at:'2026-11-15T20:00:00Z'},
  {kind:'error',data:{message:'Keine Rückantwort'}}]});
 assert.ok(out.includes('NVM geschrieben'));
 assert.ok(out.includes('Keine Rückantwort'));
});
test('malicious cell text is not evaluated in spreadsheets; JSON remains separate',()=>{
 const r=record();r.verificationMetadata.operator='=HYPERLINK("https://evil.example")';
 const csv=X.csvReport(r);
 assert.ok(csv.includes("'=HYPERLINK"));
 assert.ok(csv.includes('"-0.001953"'));
 assert.throws(()=>X.csvReport({type:'other'}),/Protokolltyp/);
});
