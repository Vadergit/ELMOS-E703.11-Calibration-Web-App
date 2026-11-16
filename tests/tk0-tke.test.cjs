'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const CAL=require('../calibration.js');
const PLAN=require('../guided-plan.js');
const CONFIG=require('../config.js');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

const reference=[
 {pressure:0,temperature:25,adc_s:-9000,adc_t:-4000},
 {pressure:6,temperature:25,adc_s:9000,adc_t:-4000},
 {pressure:0,temperature:75,adc_s:-8800,adc_t:5000},
 {pressure:6,temperature:75,adc_s:9600,adc_t:5000}
];
const opts={pmin:0,pmax:6,orderS:1,orderT:1,outputLimit:25000};

test('TK0 guide uses three physical references without the high-temperature span point',()=>{
 const plan=PLAN.create({pCount:2,tCount:2,temperatures:[25,75],fitMode:'tk0',pmin:0,pmax:6,unit:'bar'});
 assert.equal(plan.total,3);
 assert.deepEqual(plan.points.map(({pressure,temperature})=>[pressure,temperature]),
  [[0,25],[6,25],[0,75]]);
 assert.deepEqual(plan.points.map(({slot,extraSlot})=>[slot,extraSlot]),
  [['lo',null],['hi',null],['extra1',1]]);
 assert.equal(plan.fitMode,'tk0');
});

test('Full TK0 + TKE guide demands four points including 6 bar at 75 C',()=>{
 const plan=PLAN.create({pCount:2,tCount:2,temperatures:[25,75],fitMode:'full',pmin:0,pmax:6,unit:'bar'});
 assert.equal(plan.total,4);
 assert.deepEqual(plan.points.map(({pressure,temperature})=>[pressure,temperature]),
  [[0,25],[6,25],[0,75],[6,75]]);
 assert.equal(plan.points.at(-1).slot,'hi');
});

test('TK0 fits zero-temperature coefficient, leaves interaction S*T zero',()=>{
 const result=CAL.fit(reference.slice(0,3),{...opts,fitMode:'tk0'});
 assert.equal(result.points,3);
 assert.equal(result.fitMode,'tk0');
 assert.equal(result.registers.coeffs[5],0); // S1*temperature term = TKE
 assert.ok(result.stats.maxDigits<10);
 assert.ok(Number.isFinite(result.stats.rmsDigits));
});

test('TKE fits S*T independently with fourth physical reference',()=>{
 const result=CAL.fit(reference,{...opts,fitMode:'full'});
 assert.equal(result.points,4);
 assert.notEqual(result.registers.coeffs[5],0);
 assert.ok(result.stats.maxDigits<10);
});

test('An incomplete four-point TKE calibration cannot calculate coefficients',()=>{
 assert.throws(()=>CAL.fit(reference.slice(0,3),{...opts,fitMode:'full'}),/4 unabhängige Messpunkte/);
 const pressureOnly=CAL.fit(reference.slice(0,3),{...opts,fitMode:'tk0',orderT:0});
 assert.equal(pressureOnly.orderT,0);
 assert.equal(pressureOnly.registers.tcoeffs,null);
 assert.equal(pressureOnly.points,2);
 assert.equal(pressureOnly.ignoredTemperaturePoints,1);
 assert.throws(()=>PLAN.create({pCount:3,tCount:2,temperatures:[25,75],fitMode:'tk0'}),/2 Drücke/);
});

test('Three-point calibration mode survives portable profile export and import',()=>{
 const fields={label:'TK0 Test',calibration:{
  sOrder:1,tOrder:1,fitMode:'tk0',dspLimit:25000,pointCount:3,samples:12,
  matrix:{p:2,temp:2,temperatures:[25,75],fitMode:'tk0'},
  reference:{min:0,max:6,unit:'bar',customUnit:''}
 }};
 const output=CONFIG.createSelective(fields,['measurement','dsp','reference']);
 assert.equal(output.measurement.pointCount,3);
 assert.equal(output.measurement.matrix.fitMode,'tk0');
 assert.equal(output.dsp.fitMode,'tk0');
 assert.throws(()=>CONFIG.createSelective({...fields,calibration:{...fields.calibration,fitMode:'full'}},['measurement','dsp','reference']),/stimmen nicht überein/);
});

test('TK0 mode reuses existing hardware write gates and is visible in both UIs',()=>{
 const app=read('app.js'),guided=read('guided.js'),html=read('index.html');
 assert.ok(app.includes("CAL.fit(st.calpoints,{pmin,pmax,orderS,orderT,fitMode,outputLimit})"));
 assert.ok(app.includes("const required=fitMode==='tk0'?(orderT===0?2:3):(orderS+1)*(orderT+1)"));
 assert.ok(app.includes("st.calfit.fitMode||'full'"));
 assert.ok(app.includes("if(!calEndpointsReady())throw Error"));
 assert.ok(guided.includes("moveLabel('calFitMode','gwFitFields')"));
 assert.ok(guided.includes("point.extraSlot??point.index"));
 assert.ok(html.includes('id="calFitMode"'));
 assert.ok(html.includes('id="calFitMode"')&&guided.includes('data-gw-preset="tk0"'));
});

test('Real three-point TK0 data identify S4 overflow and propose a safe DSP limit',()=>{
 const measured=[
  {pressure:0,temperature:24,adc_s:-10188,adc_t:2112},
  {pressure:0,temperature:74,adc_s:-10574,adc_t:-6158},
  {pressure:6,temperature:24,adc_s:17667.5,adc_t:2155}
 ];
 const settings={pmin:0,pmax:6,orderS:1,orderT:1,fitMode:'tk0',outputLimit:32000};
 assert.throws(()=>CAL.fit(measured,settings),error=>
  error.code==='COEFFICIENT_OUT_OF_RANGE'&&error.coefficient.name==='S4'&&
  Math.abs(error.coefficient.value-1.0001626507916577)<1e-10);
 const copy=structuredClone(measured);
 const suggestion=CAL.suggestDspLimit(measured,settings);
 assert.equal(suggestion.outputLimit,31000);
 assert.ok(suggestion.maxCoefficient<=0.98);
 assert.deepEqual(measured,copy,'Proposals must not mutate captured measurement points');
 const result=CAL.fit(measured,{...settings,outputLimit:suggestion.outputLimit});
 assert.equal(result.outputLimit,31000);
 assert.equal(result.registers.coeffs[5],0,'TK0 must leave TKE zero');
 assert.ok(result.stats.maxDigits<10);
});

test('Only fixable DSP coefficient overflow offers a reduced target',()=>{
 assert.equal(CAL.suggestDspLimit(reference.slice(0,3),{...opts,fitMode:'tk0'}),null);
 assert.equal(CAL.suggestDspLimit(reference.slice(0,3),{...opts,fitMode:'tk0',outputLimit:1000}),null);
 const app=read('app.js'),html=read('index.html');
 assert.ok(app.includes("CAL.suggestDspLimit(st.calpoints,fitRequest)"));
 assert.ok(app.includes("calcCoefficients();"));
 assert.ok(html.includes('id="calDspProposalApply"'));
});

test('DSP verification accepts equal pressure at sufficiently different temperature, not repeated conditions',()=>{
 const confirmed=[{pressure:0,temperature:25},{pressure:6,temperature:25}];
 const check=(pressure,temperature,reference=confirmed)=>CAL.independentVerificationPoint(reference,{pressure,temperature},6);
 assert.equal(check(0,75),true,'Third TK0 point at 0 bar / 75 C is independent');
 assert.equal(check(0,35),true,'10 C difference satisfies the minimum');
 assert.equal(check(0,34.9),false,'Temperature separation below 10 C is not enough');
 assert.equal(check(0,25),false,'Same pressure and temperature are duplicates');
 assert.equal(check(0.5,25),false,'Pressure separation below 10% of span at same temperature is too small');
 assert.equal(check(3,25),true,'Distant pressure is independent');
 assert.equal(check(6,75,[...confirmed,{pressure:0,temperature:75}]),true,
  'Fourth TKE point is independent of three confirmed references');
 assert.throws(()=>CAL.independentVerificationPoint(confirmed,{pressure:0,temperature:75},0),/Ungültige/);
 const app=read('app.js');
 assert.ok(app.includes('CAL.independentVerificationPoint(st.calValidation.filter('));
 assert.ok(!app.includes('Prüfdruck muss mehr als 10 % der Messspanne von bestätigten Prüfpunkten entfernt sein'));
});

test('ADC_T spans below 500 digits are judged by actual coefficient limits',()=>{
 const small=[
  {pressure:0,temperature:25,adc_s:-1546,adc_t:2196},
  {pressure:100,temperature:25,adc_s:-15310.5,adc_t:2207},
  {pressure:0,temperature:26,adc_s:-1520.5,adc_t:1722}
 ];
 const result=CAL.fit(small,{pmin:0,pmax:100,orderS:1,orderT:1,fitMode:'tk0',outputLimit:3200});
 assert.equal(result.orderT,1);
 assert.ok(result.registers.tcoeffs);
});
test('Pressure-only fallback retains observations and excludes differing temperatures',()=>{
 const points=[
  {pressure:0,temperature:25,adc_s:-1546,adc_t:2196},
  {pressure:0,temperature:75,adc_s:-1520.5,adc_t:1722},
  {pressure:100,temperature:25,adc_s:-15310.5,adc_t:2207}
 ];
 assert.throws(()=>CAL.fit(points,{pmin:0,pmax:100,orderS:1,orderT:1,fitMode:'tk0',outputLimit:3200}),/T1/);
 const fit=CAL.fit(points,{pmin:0,pmax:100,orderS:1,orderT:0,fitMode:'tk0',outputLimit:3200});
 assert.equal(fit.points,2);
 assert.equal(fit.recordedPoints,3);
 assert.equal(fit.ignoredTemperaturePoints,1);
 assert.equal(fit.referenceTemperature,25);
 assert.equal(fit.registers.tcoeffs,null);
 assert.equal(fit.registers.coeffs[1],0);
 assert.ok(fit.stats.maxDigits<10);
 assert.throws(()=>CAL.fit([
  {pressure:0,temperature:25,adc_s:-1546,adc_t:2196},
  {pressure:100,temperature:75,adc_s:-15310.5,adc_t:1722}
 ],{pmin:0,pmax:100,orderS:1,orderT:0,fitMode:'full',outputLimit:3200}),/Referenztemperatur/);
});
test('Portable settings accept explicit pressure-only selection in a three-point matrix',()=>{
 const profile={
  format:'ELMOS-E70311-CONFIG',version:2,label:'Nur Druck',createdAt:'2026-11-16T00:00:00Z',
  include:['measurement','dsp','reference'],
  measurement:{pointCount:3,samples:12,matrix:{p:2,temp:2,temperatures:[25,75],fitMode:'tk0'}},
  dsp:{sOrder:1,tOrder:0,dspLimit:3200,fitMode:'tk0'},
  reference:{min:0,max:100,unit:'%',customUnit:''}
 };
 assert.deepEqual(CONFIG.validate(profile,CAL).dsp,profile.dsp);
});
test('Temperature fallback UI remains guarded and is present in classic and guided views',()=>{
 const app=read('app.js'),html=read('index.html'),guided=read('guided.js');
 assert.ok(html.includes('id="calTempFallback"'));
 assert.ok(html.includes('id="calTempFallbackApply"'));
 assert.ok(app.includes("$('calTOrder').value='0'"));
 assert.ok(guided.includes("'calTempFallback'"));
});

test('Temperature source is decoded from CFG_AFE2 bits 1:0',()=>{
 assert.equal(CAL.temperatureSourceFromAfe2(0x0000),'internal');
 assert.equal(CAL.temperatureSourceFromAfe2(0x0401),'reserved');
 assert.equal(CAL.temperatureSourceFromAfe2(0x0032),'bridge');
 assert.equal(CAL.temperatureSourceFromAfe2(0x0F03),'external');
 assert.throws(()=>CAL.temperatureSourceFromAfe2(-1),/CFG_AFE2/);
});
test('Temperature source selection is present but cannot silently activate unverified bridge compensation',()=>{
 const app=read('app.js'),guided=read('guided.js'),html=read('index.html');
 assert.ok(html.includes('id="calTempSource"'));
 assert.ok(html.includes('value="internal" selected'));
 assert.ok(html.includes('value="bridge" disabled'));
 assert.ok(html.includes('value="external" disabled'));
 assert.ok(guided.includes("moveLabel('calTempSource','gwDspFields')"));
 assert.ok(app.includes('async function checkCalibrationTemperatureSource()'));
 assert.ok(app.includes('const afe2=await readReg(0x1E)'));
 assert.ok(app.includes('temperatureSource:sourceInfo.temperatureSource'));
 assert.ok(app.includes('RAM-Schreiben gesperrt'));
 assert.ok(!app.includes('maintWrite(0x1E'));
});


test('Guided labels use acquisition indices instead of classic extra-slot numbers',()=>{
 const gui=read('guided.js'),html=read('index.html');
 assert.ok(gui.includes("setCaptureLabel(row.querySelector('.between h3'),'Messpunkt '+(index+1)"));
 assert.ok(gui.includes("setCaptureLabel(button,'Messpunkt '+(index+1)+' aufnehmen')"));
 assert.ok(gui.includes('originalCaptureLabels.clear()'));
 assert.ok(html.includes('guided.css?v=0.7.92'));
});
test('Capture history separates pressure hub from temperature shift',()=>{
 const plan=PLAN.create({pCount:2,tCount:2,temperatures:[25,75],fitMode:'tk0',pmin:0,pmax:100,orderS:1,orderT:1});
 const values=[
  {at:'2026-11-16T12:00:00Z',adc_s:-1500,adc_t:2000,spread:30,sampleCount:12},
  {at:'2026-11-16T12:01:00Z',adc_s:-15400,adc_t:2002,spread:33,sampleCount:12},
  {at:'2026-11-16T12:02:00Z',adc_s:-1480,adc_t:1400,spread:28,sampleCount:12}
 ];
 const samples=plan.points.map((point,index)=>({point,index,record:values[index]}));
 assert.equal(PLAN.captureDelta(samples,0),null);
 const pressure=PLAN.captureDelta(samples,1),temp=PLAN.captureDelta(samples,2);
 assert.equal(pressure.kind,'pressure');
 assert.equal(pressure.digits,-13900);
 assert.equal(pressure.fromTemperature,25);
 assert.equal(temp.kind,'temperature');
 assert.equal(temp.digits,20);
 assert.equal(temp.adcTDelta,-600);
 assert.equal(temp.fromPressure,0);
 const guide=read('guided.js'),app=read('app.js');
 for(const needle of ['gw-point-nav-data','gw-point-nav-delta','gw-point-nav-meta','captureTime(record)','ELMOS_GUIDED_PLAN.captureDelta(points,index)'])
  assert.ok(guide.includes(needle),needle);
 assert.ok(app.includes('spread:x.spread,sampleCount:x.sampleCount'));
});
test('Internal SSC Celsius converts calibrated DSP_T only, with source and freshness guards',()=>{
 assert.equal(CAL.dspTemperatureCelsius(Math.round(387.88*25-16485)).toFixed(2),'25.00');
 assert.equal(CAL.dspTemperatureCelsius(Math.round(387.88*75-16485)).toFixed(2),'75.00');
 assert.equal(CAL.dspTemperatureCelsius(null),null);
 assert.equal(CAL.dspTemperatureCelsius(40000),null);
 const app=read('app.js'),html=read('index.html');
 assert.ok(html.includes('id="liveTempC"'));
 assert.ok(html.includes('id="liveTempUnit"'));
 assert.ok(app.includes("CAL.temperatureSourceFromAfe2(st.regs[0x1E])==='internal'"));
 assert.ok(app.includes('readReg(0x2E,1100)'));
 assert.ok(app.includes('const channel=liveSecondaryIndex++%5'));
 assert.ok(app.includes("if(name==='DSP_T')"));
 assert.ok(app.includes('Date.now()-st.dspT.time<10000'));
 assert.ok(!app.includes('maintWrite(0x2E'));
});
test('Too-small real pressure span is diagnosed separately from AFE and missing references',()=>{
 const app=read('app.js');
 assert.ok(app.includes("function calibrationReadinessReason()"));
 assert.ok(app.includes("Druckhub zwischen unterem und oberem Druckpunkt"));
 assert.ok(app.includes("const span=Math.abs(lo.v-hi.v)"));
 assert.ok(app.includes("if(!calEndpointsReady())throw Error(calibrationReadinessReason())"));
});

test('Factory example Celsius varies with actual internal ADC_T and rejects unknown coefficients',()=>{
 const factory={0x6C:0,0x6E:0x1000,0x94:0x0F4D,0x96:0xBC8E,0x98:0xFC54,0x9A:0};
 assert.ok(CAL.isFactoryTemperatureProfile(factory));
 const room=CAL.factoryInternalTemperatureCelsius(2741,factory);
 const warm=CAL.factoryInternalTemperatureCelsius(2000,factory);
 assert.ok(room>24&&room<26,'room temperature plausible');
 assert.ok(warm>room+3,'rising temperature as diode ADC_T falls');
 assert.equal(CAL.factoryInternalTemperatureCelsius(2741,{...factory,0x94:0x1234}),null);
 assert.equal(CAL.factoryInternalTemperatureCelsius(2741,{}),null);
 assert.equal(CAL.factoryInternalTemperatureCelsius(35000,factory),null);
});
test('Header separates Elmos example temperature from AN0203 fit and checks absolute temperature enable',()=>{
 const app=read('app.js'),html=read('index.html'),style=read('interface.css');
 assert.ok(app.includes("const absoluteEnabled=Number.isInteger(st.regs[0x04])&&!!(st.regs[0x04]&0x1000)"));
 assert.ok(app.includes("CAL.isFactoryTemperatureProfile(st.regs)"));
 assert.ok(app.includes("CAL.factoryInternalTemperatureCelsius(st.adc.t,st.regs)"));
 assert.ok(app.includes("st.calStaged&&st.calfit?.orderT>0"));
 assert.ok(app.includes("const required=[0x1E,0x04,...CAL.factoryTemperatureAddresses,...CAL.programmedTemperatureAddresses]"));
 assert.ok(app.includes("tempMode==='factory'"));
 assert.ok(html.includes('id="liveTempUnit"'));
 assert.ok(style.includes('grid-template-columns:repeat(5,minmax(0,1fr))'));
 assert.ok(style.includes('.top .live-kpi{padding:4px 7px;min-height:46px}'));
});

test('One DSP verification point is sufficient at TK0/TKE; temperature coverage is optional',()=>{
 const valid=[{slot:0,errorBar:0.4703,pressure:0,temperature:25}];
 assert.equal(CAL.verificationPointsSufficient(valid,1),true);
 assert.equal(CAL.verificationPointsSufficient(valid,2),false);
 assert.equal(CAL.verificationPointsSufficient([{slot:1,errorBar:0.01}],1),false);
 assert.equal(CAL.verificationPointsSufficient([{slot:0,errorBar:Number.NaN}],1),false);
 assert.equal(CAL.verificationPointsSufficient([],1),false);
 assert.equal(CAL.verificationPointsSufficient(valid,0),false);
 assert.equal(CAL.verificationPointsSufficient(valid,11),false);
 assert.equal(CAL.verificationPointsSufficient([
  {slot:0,errorBar:0.2,temperature:25},{slot:1,errorBar:0.3,temperature:25}
 ],2),true);
 const app=read('app.js'),html=read('index.html'),guided=read('guided.js');
 assert.ok(app.includes('st.calVerified=CAL.verificationPointsSufficient(st.calValidation,required)'));
 assert.ok(app.includes('CAL.verificationPointsSufficient(st.calValidation,count)'));
 assert.ok(!app.includes('const temperatureValidation='));
 assert.ok(app.includes('let measuredTemp=null;'));
 assert.ok(html.includes('Ein Prüfpunkt genügt auch bei TK0/TKE'));
 assert.ok(guided.includes('Bereits ein bestandener Prüfpunkt genügt'));
 assert.ok(html.includes('id="calVerifyCount" min="1" max="10" step="1" value="1"'));
 assert.ok(html.includes('guided.js?v=0.7.93'));
 assert.ok(html.includes('app.js?v=0.7.98'));
});

test('Classic and guided calibration point ordering agree at each reference temperature',()=>{
 const three=PLAN.sortReferences([
  {key:'lo',pressure:0,temperature:25,originalIndex:0},
  {key:'extra1',pressure:0,temperature:75,originalIndex:1},
  {key:'hi',pressure:100,temperature:25,originalIndex:2}
 ]);
 assert.deepEqual(three.map(p=>p.key),['lo','hi','extra1']);
 assert.deepEqual(three.map(p=>[p.pressure,p.temperature]),[[0,25],[100,25],[0,75]]);
 const four=PLAN.sortReferences([
  {key:'lo',pressure:0,temperature:25,originalIndex:0},
  {key:'extra1',pressure:100,temperature:25,originalIndex:1},
  {key:'extra2',pressure:0,temperature:75,originalIndex:2},
  {key:'hi',pressure:100,temperature:75,originalIndex:3}
 ]);
 assert.deepEqual(four.map(p=>p.key),['lo','extra1','extra2','hi']);
 const two=PLAN.sortReferences([
  {key:'hi',pressure:100,temperature:25,originalIndex:1},
  {key:'lo',pressure:0,temperature:25,originalIndex:0}
 ]);
 assert.deepEqual(two.map(p=>p.key),['lo','hi']);
 assert.notEqual(three[1].key,'extra1','TK0 temperature point must not interrupt the pressure sweep');
});
test('Classic point sorting changes visual order but never overwrites sensor capture slots',()=>{
 const app=read('app.js'),html=read('index.html'),guide=read('guided.js');
 assert.ok(html.includes('<div id="calPointRows" class="cal-point-rows">'));
 assert.ok(html.includes('#calPointRows{display:flex;flex-direction:column}'));
 assert.ok(app.includes("const classicMode=$('calPointRows').contains($('capLo'))"));
 assert.ok(app.includes('ELMOS_GUIDED_PLAN.sortReferences(specs)'));
 assert.ok(app.includes('x.row.style.order=String(index)'));
 assert.ok(app.includes("x.row.querySelector('.between h3').textContent='Messpunkt '+number+' · '+role"));
 assert.ok(app.includes("action.textContent='Messpunkt '+number+' aufnehmen'"));
 assert.ok(app.includes("const displayOrder=calibrationDisplayReferences(count)"));
 assert.ok(app.includes('refresh:()=>{renderCalPoints();renderFlowState();renderStatus()}'));
 assert.ok(guide.includes("const pointRows=[...document.querySelectorAll('.panel[data-panel=\"2\"] .cal-point-row')]"));
 assert.ok(html.includes('guided-plan.js?v=0.7.94'));
});

test('Saved E703.11 NVM profile is recovered by UID and read-back temperature words',()=>{
 const words='BBE7 011D 0AE2 E100 00FC 0501 4028 150D 7FE0 7C1F 0000 D411 2900 0EC3 029E 7300 13D6 6C00 C000 083F 100F 0001 0880 0000 59A3 319A 01F4 0C80 1C53 1154 0001 0641 5AF0 1399 4F6E FDEF 0270 0000 0000 81BD 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0B5A D36D 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 5CE8'.split(' ').map(x=>Number.parseInt(x,16));
 assert.equal(words.length,64);
 assert.equal(CAL.crc16(words),0x5CE8);
 assert.equal(CAL.crc8(words),0x73);
 const uid='0020011DBBE7';
 const regs=Object.fromEntries([[31,0x6C],[32,0x6E],[51,0x94],[52,0x96],[53,0x98],[54,0x9A]]
  .map(([word,address])=>[address,words[word]]));
 const legacy={id:uid,words,ts:'2026-11-16T12:00:00.000Z',restore:false};
 assert.equal(CAL.programmedTemperatureProfileMatches(legacy,uid,regs),true);
 assert.equal(CAL.programmedTemperatureProfileMatches({...legacy,temperatureBasis:'an0203-celsius-v1'},uid,regs),true);
 assert.equal(CAL.programmedTemperatureProfileMatches({...legacy,temperatureBasis:null},uid,regs),false);
 assert.equal(CAL.programmedTemperatureProfileMatches({...legacy,restore:true},uid,regs),false);
 assert.equal(CAL.programmedTemperatureProfileMatches(legacy,uid,{
  0x6C:0x0000,0x6E:0x1000,0x94:0x0F4D,0x96:0xBC8E,0x98:0xFC54,0x9A:0x0000
 }),false,'Factory example must never be interpreted as AN0203');
 assert.equal(CAL.programmedTemperatureProfileMatches(legacy,'0020011DBBE8',regs),false);
 assert.equal(CAL.programmedTemperatureProfileMatches(legacy,uid,{...regs,0x96:0}),false);
 assert.equal(CAL.programmedTemperatureProfileMatches(legacy,uid,{...regs,0x9A:undefined}),false);
 assert.equal(CAL.programmedTemperatureProfileMatches({...legacy,words:words.map((v,i)=>i===31?v+1:v)},uid,regs),false);
 assert.equal(CAL.programmedTemperatureProfileMatches({...legacy,words:words.map((v,i)=>i===63?0:v)},uid,regs),false);
 assert.equal(CAL.temperatureSourceFromAfe2(words[29]),'internal');
 assert.ok(words[16]&0x1000);
 const norm=(CAL.fromQ(words[32],12)*2653+CAL.fromQ(words[31],12)*32768)/32768;
 const dspT=Math.round(words[51]+CAL.signed(words[52])*norm);
 const temp=CAL.dspTemperatureCelsius(dspT);
 assert.ok(Math.abs(temp-24.96)<0.02);
});
test('Temperature display survives restart without any current wizard state',()=>{
 const app=read('app.js'),html=read('index.html');
 assert.ok(app.includes('CAL.programmedTemperatureProfileMatches(storedProgrammedNvm(),st.uid.hex,st.regs)'));
 assert.ok(app.includes('((st.calStaged&&st.calfit?.orderT>0)||nvmProfile)'));
 assert.ok(app.includes("'°C · NVM-Abgleich'"));
 assert.ok(app.includes('const temperatureBasis=!restoring&&!outputOnly&&st.calfit?.orderT>0'));
 assert.ok(app.includes('st.regs[pending]=await readReg(pending,1100)'));
 assert.ok(html.includes('calibration.js?v=0.7.95'));
 assert.ok(html.includes('app.js?v=0.7.98'));
});
