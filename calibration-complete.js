'use strict';
/* Portable full calibration bundle. Pure data-only module: no device I/O.
 * The sensor NVM never stores original calibration pressure/temperature targets,
 * so the historic measurements and full archive are retained alongside it.
 */
const ELMOS_CALIBRATION_COMPLETE=(()=>{
 const FORMAT='E70311-CALIBRATION-COMPLETE-v1';
 const words=x=>Array.isArray(x)&&x.length===64&&x.every(n=>Number.isInteger(n)&&n>=0&&n<=65535);
 const clone=x=>JSON.parse(JSON.stringify(x));
 const eventData=e=>e?.data||e?.payload||{};
 const events=(record,kind)=>Array.isArray(record?.events)?record.events.filter(e=>e?.kind===kind):[];
 const last=(record,kind)=>events(record,kind).at(-1)||null;
 function eligible(record){
  if(!record||record.type!=='calibration'||!record.chipUID)return false;
  const before=eventData(last(record,'nvm_before')),after=eventData(last(record,'nvm_after'));
  return before.operation==='calibration'&&after.operation==='calibration'&&
   words(before.words)&&words(after.words)&&after.verified===true&&
   after.uid===record.chipUID&&before.uid===record.chipUID&&
   after.words[0]===before.words[0]&&after.words[1]===before.words[1]&&
   after.words[63]===after.crc16;
 }
 const str=s=>String(s??'').replace(/[^A-Za-z0-9-]/g,'').slice(0,50);
 function filename(record){
  const stamp=String(record?.startedAt||'').replace(/[-:]/g,'').replace(/[.Z]/g,'').replace('T','_').slice(0,15)||'UNKNOWN';
  return 'ELMOS_Abgleich_Komplett_'+stamp+'_'+str(record?.chipUID||'UNKNOWN')+'_'+str(record?.id||'NOID')+'.json';
 }
 function build(record){
  if(!eligible(record))throw Error('Nur ein bestätigter Kalibrier-NVM-Schreibvorgang erhält eine Komplettdatei.');
  const before=eventData(last(record,'nvm_before')),after=eventData(last(record,'nvm_after'));
  const fit=eventData(last(record,'coefficient_fit'));
  const baseline=eventData(last(record,'nvm_before')).calibrationReport||null;
  const fitSolution=fit.solution||baseline?.coefficientFit||null;
  const originalCaptures=events(record,'calibration_point').map(e=>({...clone(eventData(e).point||{}),recordedAt:e.at}));
  // A direct NVM write may have started the archive after the original
  // measurements. Preserve the current session's full report as fallback.
  const captures=originalCaptures.length?originalCaptures:clone(baseline?.calibrationPoints||[]);
  const verifications=events(record,'verification_attempt').map(e=>({...clone(eventData(e)),recordedAt:e.at}));
  const ramWritten=events(record,'calibration_ram_written').map(e=>({...clone(eventData(e)),recordedAt:e.at}));
  const postBoot=last(record,'post_boot_verified');
  const referencePressures=captures.map(x=>x.pressure).filter(Number.isFinite);
  const temperatures=captures.map(x=>x.temperature).filter(Number.isFinite);
  const units=[...new Set(captures.map(x=>x.unit).filter(Boolean))];
  const checksum=after.words[63];
  const final=record.final?.nvm&&words(record.final.nvm.words)?clone(record.final):null;
  const nvmAfter=clone(after.words);
  const result={
   format:FORMAT,version:1,type:'calibration',chipUID:record.chipUID,
   recordId:record.id,startedAt:record.startedAt,endedAt:record.endedAt||null,
   nvmProgrammedAt:last(record,'nvm_after')?.at||null,
   state:record.status==='completed'?'completed':'nvm-programmed-verified',
   verifiedNvm:true,postBootVerified:!!postBoot,
   reference:{
    ...(referencePressures.length?{min:Math.min(...referencePressures),max:Math.max(...referencePressures)}:{}),
    ...(units.length===1?{unit:units[0]}:{}),
    temperatures:[...new Set(temperatures)].sort((a,b)=>a-b),
    source:'Aufgenommene Kalibriermesspunkte (nicht aus NVM rekonstruiert)'
   },
   identification:{chipUID:record.chipUID,configuredUserId:record.customUID??final?.configuredUserId??null,
    equipment:clone(record.equipment||{}),software:clone(record.software||{})},
   calibrationPoints:captures,
   dsp:{
    outputLimit:Number.isInteger(fitSolution?.outputLimit)?fitSolution.outputLimit:null,
    pressureOrder:Number.isInteger(fitSolution?.orderS)?fitSolution.orderS:null,
    temperatureOrder:Number.isInteger(fitSolution?.orderT)?fitSolution.orderT:null,
    fitMode:fitSolution?.fitMode||null,
    solution:fitSolution?clone(fitSolution):null,
    registers:fitSolution?.registers?clone(fitSolution.registers):null
   },
   afe:{before:clone(record.initial?.ram||{}),calibrationAtPoints:captures.map(p=>({at:p.recordedAt,gains:p.gains??null,afe:p.AFE??null})),
    fit:fit.AFE?clone(fit.AFE):null,ramChanges:ramWritten,after:clone(final?.ram||{})},
   nvm:{
    original:{words:clone(before.words),uid:before.uid,crc16:before.words[63],supply:clone(before.supply??null)},
    programmed:{words:nvmAfter,uid:after.uid,crc16:checksum,verified:true},
    planned:{words:words(before.plannedWords)?clone(before.plannedWords):null,changes:clone(before.changes||[])},
    postBoot:postBoot?clone(eventData(postBoot)):null
   },
   verification:{dspAttempts:verifications,postBootVerified:!!postBoot,
    errors:events(record,'error').map(e=>({at:e.at,data:clone(eventData(e))}))},
   calibrationSessionReport:clone(baseline),
   initialSnapshot:clone(record.initial??null),finalSnapshot:clone(record.final??null),
   // Full original archive is included so no recorded detail is silently lost.
   archiveRecord:clone(record)
  };
  return result;
 }
 return Object.freeze({FORMAT,filename,eligible,build});
})();
if(typeof window!=='undefined')window.ELMOS_CALIBRATION_COMPLETE=ELMOS_CALIBRATION_COMPLETE;
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_CALIBRATION_COMPLETE;
