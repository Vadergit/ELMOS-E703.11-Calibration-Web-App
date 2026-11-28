async function test(V){
 const words=Array(64).fill(0);words[16]=0x1214;words[21]=1;words[27]=0xc80;words[29]=0x1154;
 const cal={crc8:()=>0,crc16:()=>0},A={SUPPLIES:[2.4,1.6,2],assessProbe:()=>({valid:true,current:.48,resistanceOhm:5000,adc:1}),resistanceBounds:()=>({minOhm:4000,maxOhm:6000})};
 const check=(v,msg)=>{if(!v)throw Error(msg);};
 const fake=(fail=false)=>{let ram=new Map(V.map.map(([a,i])=>[a,words[i]])),writes=0,restarts=0;return {uid:async()=> "uid",nvm:async a=>words[a/2],read:async a=>ram.get(a),grant:async()=>{},write:async(a,w)=>{writes++;ram.set(a,w);},pause:async()=>{},fresh:async()=>0,restart:async()=>{restarts++;if(fail)throw Error("USB");ram=new Map(V.map.map(([a,i])=>[a,words[i]]));},unconfirmed:async()=>{},stats:()=>({writes,restarts})};};
 let io=fake(),r=await V.analyze(io,cal,A);check(!r.measurement&&io.stats().writes===0,"read only");
 io=fake();r=await V.analyze(io,cal,A,{measure:true});check(!r.measurement&&io.stats().writes===0,"blocked");
 io=fake();r=await V.analyze(io,cal,A,{measure:true,allowRestart:true});check(r.restored===true&&io.stats().restarts===1,"restore");
 io=fake(true);r=await V.analyze(io,cal,A,{measure:true,allowRestart:true});check(r.restored===false&&!r.measurement,"fail closed");
 return "4 mock scenarios passed";
}
test(require("../bridge-rechner-v2.js")).then(console.log).catch(e=>{console.error(e);process.exitCode=1;});
