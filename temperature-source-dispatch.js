'use strict';
// Standard algorithms remain the original v0.7.202 module. Extended math
// is used only for homogeneous bridge/external points or a confirmed profile.
function createTemperatureDispatch(standard,extended){
 const betaPoints=points=>Array.isArray(points)&&points.length>0&&['bridge','external'].includes(points[0].temperatureSource)&&points.every(p=>p.temperatureSource===points[0].temperatureSource);
 return Object.freeze({...standard,
  fit:(points,opts)=> (Number(opts?.orderT??0)>0&&betaPoints(points)?extended:standard).fit(points,opts),
  suggestDspLimit:(points,opts)=>(Number(opts?.orderT??0)>0&&betaPoints(points)?extended:standard).suggestDspLimit(points,opts),
  planCalibrationProfile:(original,ram,opts={})=>{
   if(opts.devTemperature)return extended.planCalibrationProfile(original,ram,opts);
   const {devTemperature,...normal}=opts;return standard.planCalibrationProfile(original,ram,normal);
  }
 });
}
if(typeof module!=='undefined'&&module.exports)module.exports=createTemperatureDispatch;
if(typeof window!=='undefined')window.ELMOS_CAL_DISPATCH=createTemperatureDispatch(ELMOS_CAL,ELMOS_CAL_TEMPERATURE);
