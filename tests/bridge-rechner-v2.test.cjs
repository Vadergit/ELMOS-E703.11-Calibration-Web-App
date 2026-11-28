async function test(V){
 const words=Array(64).fill(0);words[16]=0x1214;words[21]=1;words[27]=0xc80;words[29]=0x1154;
 const cal={crc8:()=>0,crc16:()=>0},A={SUPPLIES:[2.4,1.6,2],assessProbe:()=>({valid:true,current:.48,resistanceOhm:5000,adc:1}),resistanceBounds:()=>({minOhm:4000,maxOhm:6000})};
 const check=(v,msg)=>{if(!v)throw Error(msg);};
 const ready={adapter:"bridge",power:true,genericRam:true,cold:true};
 check(V.restartSupported({...ready,iface:"i2c",i2cNvm:true}),"I2C supported");
 check(!V.restartSupported({...ready,iface:"i2c",i2cNvm:false}),"I2C capability required");
 check(!V.restartSupported({...ready,iface:"i2c",i2cNvm:true,cold:false}),"cold proof required");
 check(V.restartSupported({...ready,iface:"plc",plcRam:true}),"PLC unchanged");
 check(!V.restartSupported({...ready,iface:"plc",plcRam:true,power:false}),"power switch required");
 const fake=(fail=false)=>{let ram=new Map(V.map.map(([a,i])=>[a,words[i]])),writes=0,restarts=0;return {uid:async()=> "uid",nvm:async a=>words[a/2],read:async a=>ram.get(a)??0,grant:async()=>{},write:async(a,w)=>{writes++;ram.set(a,w);},pause:async()=>{},fresh:async()=>0,restart:async()=>{restarts++;if(fail)throw Error("USB");ram=new Map(V.map.map(([a,i])=>[a,words[i]]));},unconfirmed:async()=>{},stats:()=>({writes,restarts})};};
 let io=fake(),r=await V.analyze(io,cal,A);check(!r.measurement&&io.stats().writes===0,"read only");
 io=fake();r=await V.analyze(io,cal,A,{measure:true});check(!r.measurement&&io.stats().writes===0,"blocked");
 io=fake();r=await V.analyze(io,cal,A,{measure:true,allowRestart:true});check(r.restored===true&&io.stats().restarts===1,"restore");
 io=fake(true);r=await V.analyze(io,cal,A,{measure:true,allowRestart:true});check(r.restored===false&&!r.measurement,"fail closed");
 const AReal=typeof actualAFE!=="undefined"?actualAFE:require("../temperature-beta/temperature-afe.js");
 const range=V.rangeSelection(AReal,0,10000,true);check(!range.validCodes.includes(3)&&range.validCodes.includes(11),"10k RPGA range");
 const user=AReal.estimate({adc:4471,svdd:2.4,afe0:0xc30,afe2:0x114a});check(Math.abs(user.resistanceOhm-1935)<5,"reported ADC regression");
 const signal=AReal.signal({resistanceOhm:10000,svdd:2.4,code:11});check(signal.valid,"10k signal");
 const recovered=AReal.estimate({adc:signal.adc,svdd:2.4,afe0:0xcb0,afe2:0x114a});check(Math.abs(recovered.resistanceOhm-10000)<2,"10k inverse");
 const makeReal=()=>{const original=words.slice();original[27]=0xc30;original[29]=0x114a;let ram=new Map(V.map.map(([a,i])=>[a,original[i]])),writes=[],restarts=0;
 return {uid:async()=> "uid",nvm:async a=>original[a/2],read:async a=>ram.get(a)??0,grant:async()=>{},write:async(a,w)=>{writes.push([a,w]);ram.set(a,w);},pause:async()=>{},fresh:async()=>((ram.get(0x1a)>>4)&15)===3?4471:AReal.signal({resistanceOhm:10000,svdd:2.4,code:(ram.get(0x1a)>>4)&15}).adc,restart:async()=>{restarts++;ram=new Map(V.map.map(([a,i])=>[a,original[i]]));},unconfirmed:async()=>{},stats:()=>({writes,restarts})};};
 io=makeReal();r=await V.analyze(io,cal,AReal,{measure:true,allowRestart:true,expectedOhm:10000});check(r.measurement&&!r.measurement.plausible&&io.stats().writes.length===0,"unverified mismatch no writes");
 io=makeReal();r=await V.analyze(io,cal,AReal,{measure:true,allowRestart:true,expectedOhm:10000,verified:true});check(r.restored&&r.measurement?.plausible&&Math.abs(r.measurement.resistanceOhm-10000)<5&&io.stats().restarts===1,"verified range and restore");
 io=makeReal();r=await V.analyze(io,cal,AReal,{measure:true,allowRestart:false,expectedOhm:10000,verified:true});check(!r.measurement&&io.stats().writes.length===0,"restart required");
 return "4 mock scenarios, 5 transport checks and 7 range/measurement checks passed";
}
test(require("../bridge-rechner-v2.js")).then(console.log).catch(e=>{console.error(e);process.exitCode=1;});
