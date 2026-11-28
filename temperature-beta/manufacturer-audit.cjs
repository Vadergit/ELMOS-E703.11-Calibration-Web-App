'use strict';
// Run: node manufacturer-audit.cjs. Recorded native DLL fixture, not a fresh DLL invocation.
const A=require('./temperature-afe.js'),C=require('./calibration.js'),D=require('./manufacturer-dll-reference.json');
let checks=0;
const ok=(condition,label)=>{checks++;if(!condition)throw Error(label);};
const near=(a,b,e,label)=>ok(Number.isFinite(a)&&Math.abs(a-b)<=e,label+': '+a+' vs '+b);
const eq=(a,b,label)=>ok(a===b,label+': '+a+' vs '+b);
for(const x of D.i2u)near(A.rpga(x.code).i2u,x.i2u,1e-6,'RPGA '+x.code);
for(const x of D.calSimulation){eq(x.rc,0,'DLL simulation result');for(let i=0;i<x.t.length;i++)near(A.correctedBridgeTemperature(x.t[i],x.tc[i],x.g01,x.g2off)*32767/32768,x.dspT[i],1e-6,'DLL shunt');}
const p=D.calVerify;
const pts=p.adc_t.map((adc_t,i)=>({adc_t,adc_tc:p.adc_tc[i],adc_s:p.adc_s[i],pressure:(p.targetS[i]+32000)/640,temperature:(p.targetT[i]+16485)/387.88,temperatureSource:'bridge'}));
const f=A.fitBridgeOffline(pts,{pmin:0,pmax:100,orderS:1,orderT:1,outputLimit:32000},D.calWords,C.fit),r=f.registers;
let maxS=0,maxT=0;
const rows=pts.map((pt,i)=>{
 const s=C.fromQ(r.sf,12)*pt.adc_s/32768+C.fromQ(r.so,12),t=C.fromQ(r.tf,12)*f.correctedTemperatureDigits[i]/32768+C.fromQ(r.to,12);
 const S=32768*r.coeffs.reduce((v,c,k)=>v+C.fromQ(c,15)*s**Math.floor(k/4)*t**(k%4),0),T=32768*r.tcoeffs.reduce((v,c,k)=>v+C.fromQ(c,15)*t**k,0);
 const deltaS=S-p.dspS[i],deltaT=T-p.dspT[i];
 maxS=Math.max(maxS,Math.abs(deltaS));maxT=Math.max(maxT,Math.abs(deltaT));
 // Regression thresholds for this fixture only, not a universal chip accuracy limit.
 near(S,p.dspS[i],1,'recorded DLL pressure point '+i);near(T,p.dspT[i],3,'recorded DLL temperature point '+i);
 return {point:i+1,deltaS,deltaT};
});
const base={source:'external',afe0:0x0c42,afe2:0x1143,cfgEn:0x1214,pads0:0xc000,pads1:8,pads2:0x80,spiI2c:0,biasMode:0,vdd:5};
const valid=o=>A.validateProfile({...base,...o}).errors.length===0;
ok(valid({}),'EOC, free NCS, zero status mask');
ok(valid({pads2:0x100}),'EOC, free MOSI');
ok(!valid({pads2:0}),'EOC output route collides even with zero mask');
ok(!valid({pads2:0,pads0:0xc080}),'EOC output route with status mask');
ok(!valid({pads2:0x480,spiI2c:2}),'EOC I2C SDA');
ok(!valid({spiI2c:1}),'NCS used as SA0');
ok(!valid({spiI2c:3}),'NCS used as SPI');
ok(!valid({pads2:0x300,spiI2c:2}),'MOSI used as SDA');
ok(!valid({pads2:0x100,spiI2c:3}),'MOSI used as SPI');
ok(!valid({pads2:0x180}),'AODO analog output conflict');
ok(!valid({pads2:0x180,cfgEn:0x1014,spiI2c:4}),'AODO One-Wire conflict');
ok(valid({pads2:0x180,cfgEn:0x1014}),'AODO free, high-Z');
ok(!valid({afe2:0x1141}),'reserved temperature source');
ok(!valid({afe2:0x1043}),'invalid ADC_TC gain');
ok(!valid({afe2:0x1943}),'external bias mismatch');
ok(valid({afe2:0x1943,biasMode:1}),'external diode bias');
ok(!valid({afe0:0x0c43}),'reserved SVDD');
ok(!valid({afe0:0x0c40,vdd:2.9}),'2.4 V SVDD minimum VDD');
for(let g=0;g<16;g++){
 const w=A.merge({afe0:0x0d42,afe2:0x1154,cfgEn:0x0212,code:g,svddCode:2});
 eq(w.afe0,0x0d02|(g<<4),'PTC RPGA mask');eq(w.afe2,0x114a,'PTC factory gains');eq(w.cfgEn&0x100c,0x1008,'PTC correction');
 ok(valid({...w,source:'bridge'}),'PTC valid profile '+g);
}
console.log(JSON.stringify({checks,reference:'recorded native DLL',maxS,maxT,rows},null,2));
