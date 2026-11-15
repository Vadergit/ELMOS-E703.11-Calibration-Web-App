'use strict';
/* Pure pacing logic: only the optional 250 ms live-poll mode is adaptive.
   It changes idle time between finished register reads, never the serial
   read commands, read timeouts, USB queue or sensor configuration. */
const ELMOS_LIVE_POLLING=(()=>{
 const FAST=250,NORMAL=400,SAFE=650;
 const CHOICES=[FAST,NORMAL,SAFE,1000,1500,2000];
 function create(){
  let level=0,slow=0,stable=0,lastDurationMs=null;
  const levels=[FAST,NORMAL,SAFE];
  function reset(){level=0;slow=0;stable=0;lastDurationMs=null}
  function observe(success,durationMs){
   if(typeof durationMs==='number'&&Number.isFinite(durationMs))lastDurationMs=durationMs;
   if(!success){level=2;slow=0;stable=0;return}
   if(!Number.isFinite(durationMs))return;
   if(durationMs>=1200){level=2;slow=0;stable=0;return}
   if(durationMs>=600){
    slow++;stable=0;
    if(slow>=2){level=Math.min(2,level+1);slow=0}
    return;
   }
   slow=0;
   if(level){
    stable++;
    if(stable>=10){level--;stable=0}
   }else stable=0;
  }
  function delay(selection){
   if(selection===FAST)return levels[level];
   return CHOICES.includes(selection)?selection:SAFE;
  }
  function snapshot(selection){
   return {selected:selection,effectiveDelayMs:delay(selection),
    adaptive:selection===FAST,backoffLevel:level,lastReadMs:lastDurationMs};
  }
  return {reset,observe,delay,snapshot};
 }
 return {create,FAST,NORMAL,SAFE,CHOICES};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_LIVE_POLLING;
if(typeof window!=='undefined')window.ELMOS_LIVE_POLLING=ELMOS_LIVE_POLLING;
