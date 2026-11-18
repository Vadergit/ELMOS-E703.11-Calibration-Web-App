'use strict';
/* Offline PDF-ready verification report via native browser print / Save as PDF.
   No external service, third-party library or sensor command is used. */
const ELMOS_VERIFICATION_REPORT=(()=>{
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const en=()=>document.documentElement.lang==='en';
 const tr=(de,english)=>en()?english:de;
 const n=(x,d=4)=>Number.isFinite(x)?x.toLocaleString(en()?'en-US':'de-CH',{maximumFractionDigits:d}):'–';
 const dt=x=>{const v=new Date(x);return !x||Number.isNaN(v.getTime())?'–':v.toLocaleString(en()?'en-US':'de-CH',{dateStyle:'medium',timeStyle:'short'})};
 const val=x=>x==null||String(x).trim()===''?'–':String(x);
 const fld=(label,value)=>'<div class="datum"><small>'+esc(label)+'</small><strong>'+esc(val(value))+'</strong></div>';
 const status=v=>({completed:tr('Abgeschlossen','Completed'),failed:tr('Fehlerhaft','Failed'),incomplete:tr('Unvollständig','Incomplete'),interrupted:tr('Unterbrochen','Interrupted'),aborted:tr('Abgebrochen','Aborted')})[v]||val(v);
 const badge=k=>'<span class="tag '+esc(k||'pending')+'">'+esc(({pass:tr('Bestanden','Passed'),fail:tr('Ausser Toleranz','Out of tolerance'),unknown:tr('Nicht bewertet','Not assessed'),recorded:tr('Erfasst','Recorded'),pending:tr('Offen','Pending')})[k]||tr('Offen','Pending'))+'</span>';
 const communicationLabel=value=>{
  const k=String(value||'').trim().toLowerCase();
  return ['plc','onewire','one-wire','one_wire'].includes(k)?'One-Wire (AODO)':
   ['i2c','i²c'].includes(k)?'I²C':k==='spi'?'SPI':value||null;
 };
 const modeName=m=>m==='pressure'?tr('Druck','Pressure'):m==='temperature'?tr('Temperatur','Temperature'):tr('Druck und Temperatur','Pressure and temperature');
 const measured=(item,mode)=>{
  const x=item?.sample;
  if(!x)return '–';
  if(mode==='temperature'){
   return Number.isFinite(x.sensorTempC)?n(x.sensorTempC,4)+' °C':
    Number.isFinite(x.dspT)?'DSP_T '+n(x.dspT,0)+' Digits':'–';
  }
  return Number.isFinite(x.sensorPressure)?n(x.sensorPressure,5)+' '+(x.pressureUnit||''):
   Number.isFinite(x.dspS)?'DSP_S '+n(x.dspS,0)+' Digits':'–';
 };
 const diff=(item,mode)=>{
  if(mode==='temperature'&&Number.isFinite(item.tempError))return n(item.tempError,4)+' °C';
  if(mode!=='temperature'&&Number.isFinite(item.pressurePct)){
   const absolute=Number.isFinite(item.item?.pressureError)?
    n(item.item.pressureError,5)+' '+(item.item.pressureUnit||item.item.sample?.pressureUnit||'')+' / ':'';
   return absolute+(item.pressurePct>0?'+':'')+n(item.pressurePct,4)+' % FS';
  }
  if(mode!=='temperature'&&Number.isFinite(item.previewPercent))return (item.previewPercent>0?'+':'')+n(item.previewPercent,4)+' % FS';
  return '–';
 };
 function chartSegment(items,mode){
  const W=740,H=215,L=52,R=18,T=20,B=32,fw=W-L-R,fh=H-T-B;
  const max=Math.max(.3,...items.map(e=>Math.max(Math.abs(e.plotValue||0),Math.abs(e.tolerance||0))))*1.18;
  const bound=Math.ceil(max*20)/20;
  const px=i=>L+(i+.5)*fw/items.length;
  const py=v=>T+(bound-v)/(2*bound)*fh;
  const lines=['<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;display:block" aria-label="'+esc(tr('Messabweichungen','Measured deviations'))+'">'];
  for(const t of [-bound,-bound/2,0,bound/2,bound]){
   const y=py(t);
   lines.push('<line x1="'+L+'" y1="'+y+'" x2="'+(W-R)+'" y2="'+y+'" stroke="'+(t===0?'#7298af':'#dfeaf1')+'" stroke-width="'+(t===0?1.6:1)+'"/>');
   lines.push('<text x="'+(L-7)+'" y="'+(y+4)+'" text-anchor="end" font-size="10" fill="#496b80">'+esc(n(t,2))+'</text>');
  }
  for(let i=0;i<items.length;i++){
   const x=items[i],cx=px(i),tol=Number.isFinite(x.tolerance)?x.tolerance:0;
   if(Number.isFinite(x.tolerance))lines.push('<line x1="'+cx+'" x2="'+cx+'" y1="'+py(tol)+'" y2="'+py(-tol)+'" stroke="#d6e5ed" stroke-width="12" stroke-linecap="round"/>');
   if(Number.isFinite(x.plotValue)){
    const color=x.status==='pass'?'#218056':x.status==='fail'?'#c6454f':x.status==='recorded'?'#4b7893':'#c59436';
    lines.push('<circle cx="'+cx+'" cy="'+py(x.plotValue)+'" r="6" fill="'+color+'" stroke="#fff" stroke-width="2"/>');
    lines.push('<text x="'+cx+'" y="'+Math.max(12,Math.min(H-B-5,py(x.plotValue)+(x.plotValue>=0?-12:18)))+'" text-anchor="middle" font-size="10" font-weight="bold" fill="'+color+'">'+esc(n(x.plotValue,2))+'</text>');
   }
   lines.push('<text x="'+cx+'" y="'+(H-9)+'" text-anchor="middle" font-size="10" fill="#507189">'+(x.index+1)+'</text>');
  }
  lines.push('<text x="4" y="13" font-size="11" fill="#1e4e70">'+(mode==='temperature'?'°C':'% FS')+'</text></svg>');
  return lines.join('');
 }
 function makeReport(record){
  if(!record||record.type!=='verification')throw Error('Verification report required');
  const mode=record.plan?.mode||'pressure',config=record.verificationConfig||{},meta=record.verificationMetadata||{};
  const tool=record.calibrationTool||{};
  const application=tool.application||'ELMOS E703.11 Calibration Assistant';
  const version=tool.applicationVersion||record.software?.version||null;
  const adapter=tool.communicationAdapter||record.equipment?.adapter||null;
  const archiveStatus=window.ELMOS_ARCHIVE_CORE?.displayStatus?.(record)||record.status;
  const correctedLegacyStatus=archiveStatus!==record.status;
  const summ=window.ELMOS_VERIFICATION_GRAPH?.summary?.(record)||{total:0,passed:0,failed:0,unknown:0,pending:0,data:[]};
  const series=summ.data.length?summ.data:(record.events||[]).filter(x=>x.kind==='measurement').map((raw,index)=>{
   const item=raw.data||raw;
   return {index,step:{pressure:item.referencePressure,temperature:item.referenceTemperature},item,
    status:item.pass===true?'pass':item.pass===false?'fail':'unknown',pressurePct:null,tempError:item.temperatureError,previewPercent:null,plotValue:null,tolerance:0};
  });
  const info=[
   fld(tr('Chip-UID','Chip UID'),record.chipUID),
   fld(tr('USER-ID','User ID'),record.customUID),
   fld(tr('Kalibrierwerkzeug (automatisch)','Calibration tool (automatic)'),application+(version?' v'+version:'')),
   fld(tr('Verwendeter Adapter (automatisch)','Adapter used (automatic)'),adapter),
      fld(tr('Kommunikation','Interface'),communicationLabel(tool.interface||record.equipment?.interface)),
   fld(tr('Protokoll-ID','Report ID'),record.id),
   fld(tr('Beginn','Started'),dt(record.startedAt)),
   fld(tr('Ende','Ended'),dt(record.endedAt))
  ].join('');
  const extras=[
   [tr('Prüfer','Examiner'),meta.operator],
   [tr('Auftrag / Projekt','Order / Project'),meta.project],
   [tr('Prüfort / Prüfstand','Test location / bench'),meta.location],
      [tr('Kalibrierzertifikat / Referenz','Calibration certificate / reference'),meta.instrumentCertificate],
   [tr('Zusätzliche Informationen','Additional information'),meta.notes]
  ].filter(x=>x[1]).map(x=>fld(x[0],x[1])).join('');
  const settings=[
   fld(tr('Prüfart','Test type'),modeName(mode)),
   fld(tr('Kalibrierter Druckbereich','Calibrated pressure range'),
    Number.isFinite(config.calibrationMin)&&Number.isFinite(config.calibrationMax)?
     n(config.calibrationMin)+' bis '+n(config.calibrationMax)+' '+(config.pressureUnit||''):null),
   fld(tr('Messspanne','Full scale'),Number.isFinite(config.pressureSpan)?n(config.pressureSpan)+' '+(config.pressureUnit||''):null),
   fld(tr('Prüfpunkte eingegeben als','Verification points entered as'),
    config.pressureEntryMode==='percent'?'% der Messspanne':config.pressureEntryMode==='pressure'?config.pressureUnit:null),
   fld(tr('Ursprüngliche Prüfreihe','Original setpoint series'),config.inputPressurePath),
   fld(tr('Digitale Messwertquelle','Digital measurement source'),config.digitalReadout||null),
               fld(tr('Max. Druckabweichung','Max. pressure deviation'),Number.isFinite(config.pressureTolerancePercent)?n(config.pressureTolerancePercent)+' % FS':null),
   fld(tr('Temperaturtoleranz','Temperature tolerance'),Number.isFinite(config.temperatureTolerance)?n(config.temperatureTolerance)+' °C':null),
   fld(tr('Drucksensortyp','Pressure sensor type'),config.sensorType==='absolute'?tr('Absolut','Absolute'):config.sensorType==='gauge'?tr('Relativ','Gauge'):null),
   fld(tr('Referenzdruckart','Pressure reference type'),config.referenceKind==='absolute'?tr('Absolut','Absolute'):config.referenceKind==='gauge'?tr('Relativ','Gauge'):null),
   fld(tr('Umgebungsdruck','Ambient pressure'),Number.isFinite(config.ambientPressure)?n(config.ambientPressure,5)+' '+(config.pressureUnit||''):null),
   fld(tr('Umgebungstemperatur','Ambient temperature'),Number.isFinite(config.ambientTemperature)?n(config.ambientTemperature,2)+' °C':null)
  ].join('');
  const graphics=[];
  for(let i=0;i<series.length;i+=20){
   const slice=series.slice(i,i+20);
   graphics.push('<div class="plot"><div class="plot-label">'+esc(tr('Prüfpunkte','Points'))+' '+(i+1)+'-'+(i+slice.length)+'</div>'+chartSegment(slice,mode)+'</div>');
  }
  const tableRows=series.map(x=>{
   const reference=[],unit=config.pressureUnit||'';
   if(mode!=='temperature'){
    // The setpoint is the plan; the entered calibrator pressure is the measured reference.
    const entered=Number.isFinite(x.item?.referencePressureInput)?x.item.referencePressureInput:
     Number.isFinite(x.item?.referencePressure)?x.item.referencePressure:x.step.pressure;
    const changed=x.item&&Number.isFinite(entered)&&Number.isFinite(x.step.pressure)&&
     Math.abs(entered-x.step.pressure)>1e-9;
    reference.push(n(entered,4)+' '+unit+
     (changed?' ('+tr('Soll','Target')+' '+n(x.step.pressure,4)+' '+unit+')':
      !x.item?' ('+tr('geplant','planned')+')':''));
    if(x.item&&config.correctionApplied&&Number.isFinite(x.item.referencePressure)&&
      Number.isFinite(entered)&&Math.abs(x.item.referencePressure-entered)>1e-9)
     reference.push(tr('Sensorbezug','Sensor reference')+': '+n(x.item.referencePressure,4)+' '+unit);
   }
   if(mode!=='pressure'&&x.step.temperature!=null){
    const enteredTemp=Number.isFinite(x.item?.referenceTemperature)?x.item.referenceTemperature:x.step.temperature;
    const changed=x.item&&Number.isFinite(enteredTemp)&&Math.abs(enteredTemp-x.step.temperature)>1e-9;
    reference.push(n(enteredTemp,2)+' °C'+
     (changed?' ('+tr('Soll','Target')+' '+n(x.step.temperature,2)+' °C)':''));
   }
   return '<tr><td>'+esc(x.index+1)+'</td><td>'+esc(reference.join(' / ')||'–')+'</td><td>'+
    esc(measured(x.item,mode))+'</td><td>'+esc(diff(x,mode))+'</td><td>'+badge(x.status)+'</td><td>'+
    esc(x.item?.attempt??'–')+'</td></tr>';
  }).join('');
  const progress=tr('Messpunkte erfasst: ','Measurement points recorded: ')+summ.measured+' / '+summ.total;
  const hasUnconfirmedScaling=series.some(x=>x.valueSource==='unverified-percent');
  const reportNotice=(config.toleranceEnabled===false?
   tr('Es wurde keine Toleranzbewertung durchgeführt. Die Abweichungen dienen der Dokumentation.',
      'No tolerance assessment was performed. Deviations are displayed for documentation.'):
   tr('Eine Toleranzbewertung gilt nur für Messpunkte mit bestätigter Skalierung.',
      'A tolerance assessment is valid only for points with confirmed scaling.'))+
   (hasUnconfirmedScaling?' '+tr(
     'Bei einzelnen Punkten ist die Zuordnung des digitalen Sensorwerts zum Druckbereich nicht bestätigt. Deren angezeigte Abweichung ist ein rechnerischer Vergleich.',
     'For some points, the digital sensor-to-pressure scaling is unconfirmed. Their displayed deviation is a calculated comparison.'):'');
  const photosHtml=typeof ELMOS_ARCHIVE_PHOTOS!=='undefined'?
   ELMOS_ARCHIVE_PHOTOS.reportPhotos(record.photos):'';
  const photosCss=typeof ELMOS_ARCHIVE_PHOTOS!=='undefined'?ELMOS_ARCHIVE_PHOTOS.pdfCss:'';
  const css='*{box-sizing:border-box}body{margin:0;background:#edf2f6;color:#15344b;font-family:Arial,sans-serif;font-size:11px;line-height:1.48}.toolbar{background:#124260;color:#fff;padding:11px 18px;display:flex;align-items:center;justify-content:space-between;gap:20px}.toolbar button{background:white;color:#124260;border:0;border-radius:7px;padding:10px 16px;font-weight:bold;cursor:pointer}.sheet{background:white;max-width:990px;margin:18px auto;padding:34px 42px;box-shadow:0 8px 28px #314e642a}header{display:flex;justify-content:space-between;gap:14px;border-bottom:3px solid #176487;padding-bottom:18px}h1{font-size:26px;margin:4px 0}h2{color:#1a4d6d;font-size:15px;margin:23px 0 10px}.muted{color:#6a8292;font-size:10px}.kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin:18px 0}.kpi{border:1px solid #d8e6ef;background:#f6f9fb;border-radius:8px;padding:9px}.kpi b{display:block;font-size:20px;color:#174c6d}.kpi span{font-size:9px;color:#587286}.kpi.green b{color:#177953}.kpi.red b{color:#ab373c}.kpi.yellow b{color:#936923}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 13px}.datum{min-width:0;border-bottom:1px solid #e4ebf1;padding:6px 3px;overflow-wrap:anywhere;white-space:pre-wrap}.datum small{color:#6d8191;font-size:9px;display:block}.datum strong{font-size:11px;color:#2b4c62}.plot{border:1px solid #dae6ef;border-radius:8px;padding:8px;margin:12px 0;break-inside:avoid;page-break-inside:avoid}.plot-label{font-size:10px;font-weight:bold;color:#2d5d7d}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#edf4f9;text-align:left;color:#365d77;padding:8px 6px}td{border-top:1px solid #e3ebf1;padding:7px 6px;vertical-align:top}.tag{font-size:9px;padding:3px 5px;border-radius:4px;white-space:nowrap}.tag.pass{background:#e7f7ed;color:#167450}.tag.fail{background:#ffe9eb;color:#a6323e}.tag.unknown{background:#fff2d7;color:#8d661b}.tag.pending{background:#e9f0f5;color:#63798a}.warning{background:#fff8e6;border-left:3px solid #cfa341;padding:10px;margin:17px 0;color:#725c2b}.footer{border-top:1px solid #dce7ef;margin-top:25px;padding-top:12px;color:#6a8292;font-size:9px;display:flex;justify-content:space-between;gap:10px}@page{size:A4;margin:15mm 13mm}@media print{body{background:white;-webkit-print-color-adjust:exact;print-color-adjust:exact}.toolbar{display:none}.sheet{max-width:none;padding:0;margin:0;box-shadow:none}h2{page-break-after:avoid;break-after:avoid}.grid,.kpis{break-inside:avoid;page-break-inside:avoid}tr{break-inside:avoid}}';
  return '<!doctype html><html lang="'+(en()?'en':'de-CH')+'"><head><meta charset="UTF-8"><title>'+
   esc(typeof ELMOS_ARCHIVE_CORE!=='undefined'?ELMOS_ARCHIVE_CORE.filename(record).replace(/\.json$/i,''):'E70311_Verification_'+(record.chipUID||'Unknown'))+'</title><style>'+css+photosCss+'</style></head><body>'+ 
   '<div class="toolbar"><span>'+esc(tr('PDF-Bericht: «Als PDF speichern» im Druckdialog auswählen.','PDF report: Choose Save as PDF in the print dialog.'))+
   '</span><button onclick="window.print()">'+esc(tr('Als PDF speichern / Drucken','Save as PDF / Print'))+'</button></div>'+
   '<main class="sheet"><header><div><div class="muted">ELMOS E703.11 · '+esc(application+(version?' v'+version:''))+'</div>'+
   '<h1>'+esc(tr('Nachmessung – Prüfprotokoll','Verification test report'))+'</h1>'+
   '<div class="muted">'+esc(dt(record.startedAt))+' – '+esc(dt(record.endedAt))+'</div></div>'+
   '<b>'+esc(status(archiveStatus))+'</b></header>'+
   '<p class="muted">'+esc(progress)+'</p>'+
   (correctedLegacyStatus?'<p class="muted">'+esc(tr(
    'Statushinweis: In diesem älteren Archiv wurde «Unvollständig» gespeichert, obwohl alle Prüfpunkte erfasst wurden. Die Anzeige wurde korrigiert; die ursprüngliche Archivdatei bleibt unverändert.',
    'Status note: This older archive stored Incomplete even though every point was recorded. The display was corrected; the original archive file was not changed.'))+'</p>':'')+
   '<h2>'+esc(tr('Kalibrierwerkzeug, Adapter und Sensor','Calibration tool, adapter and sensor'))+'</h2><div class="grid">'+info+'</div>'+
   (extras?'<h2>'+esc(tr('Weitere Protokollangaben','Additional report details'))+'</h2><div class="grid">'+extras+'</div>':'')+
   '<h2>'+esc(tr('Prüfbedingungen','Test conditions'))+'</h2><div class="grid">'+settings+'</div>'+
   '<h2>'+esc(tr('Grafische Auswertung','Graphical evaluation'))+'</h2>'+
   (graphics.join('')||'<p>'+esc(tr('Keine auswertbaren Daten gespeichert.','No evaluable data stored.'))+'</p>')+
   '<h2>'+esc(tr('Alle Prüfpunkte und Ergebnisse','All verification points and results'))+'</h2>'+
   '<table><thead><tr><th>#</th><th>'+esc(tr('Referenz (tatsächlich)','Reference (actual)'))+'</th><th>'+esc(tr('Ist','Measured'))+'</th><th>'+
   esc(tr('Abweichung','Deviation'))+'</th><th>'+esc(tr('Ergebnis','Result'))+'</th><th>'+
   esc(tr('Versuch','Attempt'))+'</th></tr></thead><tbody>'+tableRows+'</tbody></table>'+
   photosHtml+'<div class="warning">'+esc(reportNotice)+'</div>'+ 
   '<div class="footer"><span>ELMOS E703.11 · '+esc(tr('Lokales Prüfprotokoll','Local verification report'))+'</span>'+
   '<span>'+esc(record.id)+' · '+esc(tr('Erstellt','Generated'))+' '+esc(dt(new Date().toISOString()))+'</span></div></main></body></html>';
 }
 function print(record){
  if(!record||record.type!=='verification')return false;
  const markup=makeReport(record);
  const popup=window.open('','_blank');
  if(!popup)return false;
  popup.document.open();popup.document.write(markup);popup.document.close();popup.focus();
  return true;
 }
 return {makeReport,print};
})();
if(typeof window!=='undefined')window.ELMOS_VERIFICATION_REPORT=ELMOS_VERIFICATION_REPORT;
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_VERIFICATION_REPORT;
