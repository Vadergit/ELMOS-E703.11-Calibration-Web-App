'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const X=require('../archive-export.js');
const lines=s=>s.replace(/^\uFEFF/,'').trimEnd().split('\r\n');
function fixture(){
 const steps=[0,5,10,5,10].map((pressure,index)=>({
  index,cycle:1,pressure,temperature:25,
  pressureDirection:index===3?'down':'up',temperatureDirection:'constant'
 }));
 const values=[-0.001953125,3.485234375,10.11984375,2.896875,0.00421875];
 return {type:'verification',id:'v-123',chipUID:'0020011DBBE7',
  startedAt:'2026-11-15T20:13:42Z',endedAt:'2026-11-15T20:14:32Z',
  status:'incomplete',verificationMetadata:{operator:'wef',project:'Testauftrag'},
  equipment:{interface:'plc',adapter:'ESP32-USB-Bridge'},
  verificationConfig:{calibrationMin:0,calibrationMax:10,pressureSpan:10,
   pressureUnit:'bar',pressureEntryMode:'percent',toleranceEnabled:false},
  plan:{mode:'pressure',steps},
  events:[
   ...Array.from({length:100},(_,i)=>({kind:'transport',data:{line:'RX #PLC '+i}})),
   ...values.map((value,i)=>({kind:'measurement',at:'2026-11-15T20:13:51Z',
    data:{stepIndex:i,attempt:1,referencePressure:steps[i].pressure,
     referenceTemperature:25,toleranceApplied:false,
     sample:{at:'2026-11-15T20:13:51Z',sensorPressure:value,pressureUnit:'bar',
      count:12,samples:[{adcS:-1520,dspS:-32012},{adcS:-1510,dspS:-32010}]}}}))
  ]
 };
}
test('summary verification CSV has five measurement rows despite transport logging',()=>{
 const csv=X.csvVerification(fixture()),all=lines(csv);
 const pointRows=all.filter(x=>/^"[1-9][0-9]*";/.test(x));
 assert.equal(pointRows.length,5);
 assert.ok(all.length<30,'Too many CSV rows: '+all.length);
 for(const txt of ['Sensor-UID','Kalibrierter Druckbereich','Prüfer',
  '"Soll [bar]"','"Abweichung [% FS]"','"Kommunikation";"One-Wire (AODO)"',
  '"-1.5147656"','"-15.147656"','"Toleranzbewertung";"Nicht aktiviert"'])
  assert.ok(csv.includes(txt),'Missing '+txt);
 assert.ok(!csv.includes('RX #PLC'));
 assert.ok(!csv.includes('$.sample.samples['));
 assert.ok(!csv.includes('"Bewertung"'));
});
test('repeated attempts and missing planned points are retained',()=>{
 const r=fixture();
 r.plan.steps=r.plan.steps.slice(0,3);
 r.events=r.events.filter(e=>e.kind==='measurement'&&e.data.stepIndex===0);
 r.events.push({kind:'measurement',at:'2026-11-15T20:13:58Z',
  data:{...r.events[0].data,attempt:2,sample:{sensorPressure:0.04,pressureUnit:'bar',count:3}}});
 const csv=X.csvVerification(r);
 const points=lines(csv).filter(x=>/^"[1-9][0-9]*";/.test(x));
 assert.equal(points.length,4);
 assert.ok(csv.includes('"2";"1";"Steigend";"";'));
 assert.ok(csv.includes('"1";"1";"Steigend";"2";'));
});
test('combined pressure-temperature verification keeps directions and temperature values',()=>{
 const r=fixture();r.plan.mode='combined';
 r.plan.steps=[{index:0,cycle:2,pressure:5,temperature:65,
  pressureDirection:'down',temperatureDirection:'up'}];
 r.events=[{kind:'measurement',at:'2026-11-15T20:20:00Z',
  data:{stepIndex:0,attempt:1,referencePressure:5,referenceTemperature:65,
   sample:{sensorPressure:5.1,pressureUnit:'bar',sensorTempC:65.3,count:2}}}];
 const csv=X.csvVerification(r);
 assert.ok(csv.includes('"Temp.-Richtung"'));
 assert.ok(csv.includes('"Sensortemp. [°C]"'));
 assert.ok(csv.includes('"Fallend";"Steigend"'));
 assert.ok(csv.includes('"0.3"'));
});
test('CSV protects against formulas but keeps negative decimal numbers',()=>{
 const r=fixture();r.verificationMetadata.operator='=HYPERLINK("unsafe")';
 const csv=X.csvVerification(r);
 assert.ok(csv.includes("'=HYPERLINK"));
 assert.ok(csv.includes('"-0.0019531"'));
 assert.ok(!csv.includes(String.fromCharCode(34,39,45)+'0.0019531'));
 assert.throws(()=>X.csvVerification({type:'testlog'}),/Nachmessungsprotokoll/);
});
