'use strict';
/* Browser-native, offline printable calibration report. No NVM writes, serial
 * access, external services or PDF library. Graphs are the SAME read-only SVGs
 * rendered in the archive. The complete original data stays in JSON/CSV. */
const ELMOS_CALIBRATION_REPORT=(()=>{
 const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const en=()=>typeof document!=='undefined'&&document.documentElement?.lang==='en';
 const tr=(de,english)=>en()?english:de;
 const n=(x,d=4)=>typeof x==='number'&&Number.isFinite(x)?
  x.toLocaleString(en()?'en-US':'de-CH',{maximumFractionDigits:d}):'–';
 const date=x=>{if(!x)return '–';const d=new Date(x);return Number.isNaN(d.getTime())?'–':
  d.toLocaleString(en()?'en-US':'de-CH',{dateStyle:'medium',timeStyle:'short'})};
 const val=x=>x===null||x===undefined||String(x).trim()===''?'–':String(x);
 const field=(label,value)=>'<div class="datum"><small>'+escape(label)+'</small><strong>'+escape(val(value))+'</strong></div>';
 const eventData=e=>e?.data&&typeof e.data==='object'?e.data:e;
 const status=value=>({
  completed:tr('Abgeschlossen','Completed'),incomplete:tr('Unvollständig','Incomplete'),
  failed:tr('Fehlerhaft','Failed'),interrupted:tr('Unterbrochen','Interrupted'),
  aborted:tr('Abgebrochen','Aborted'),running:tr('Unvollständig','Incomplete')
 })[value]||val(value);
 const result=x=>x===true?tr('Bestanden','Passed'):
  x===false?tr('Ausser Toleranz','Out of tolerance'):tr('Nicht bewertet','Not assessed');
 const badge=x=>'<span class="tag '+(x===true?'pass':x===false?'fail':'unrated')+'">'+escape(result(x))+'</span>';
 const totalSamples=points=>points.reduce((total,p)=>total+
  (Array.isArray(p.rawSamples)?p.rawSamples.length:
   Number.isInteger(p.sampleCount)&&p.sampleCount>0?p.sampleCount:0),0);
 const latest=record=>(record?.events||[]).filter(e=>e?.kind==='coefficient_fit').at(-1);
 const latestMeta=record=>{
  const fit=eventData(latest(record))?.solution;
  return fit&&typeof fit==='object'?fit:null;
 };
 function graphics(record){
  if(typeof document==='undefined'||!window?.ELMOS_CALIBRATION_GRAPH?.renderArchive)return '';
  const host=document.createElement('div');
  window.ELMOS_CALIBRATION_GRAPH.renderArchive(host,record);
  // DOM serialization escapes arbitrary labels and preserves the exact archive
  // diagrams including recorded tolerance intervals.
  return host.innerHTML;
 }
 function makeReport(record,{graphMarkup}={}){
  if(!record||record.type!=='calibration')
   throw Error(tr('Ein Kalibrierarchiv ist erforderlich.','A calibration archive is required.'));
  const events=Array.isArray(record.events)?record.events:[];
  const pointEvents=events.filter(e=>e?.kind==='calibration_point');
  const captures=pointEvents.map(e=>({at:e.at,point:eventData(e).point||{}}));
  const verifyEvents=events.filter(e=>e?.kind==='verification_attempt');
  const verifications=verifyEvents.map(e=>({at:e.at,data:eventData(e)}));
  const errors=events.filter(e=>e.kind==='error');
  const beforeNvm=events.filter(e=>e.kind==='nvm_before');
  const afterNvm=events.filter(e=>e.kind==='nvm_after');
  const graph=typeof graphMarkup==='string'?graphMarkup:graphics(record);
  const graphSummary=typeof window!=='undefined'?
   window.ELMOS_CALIBRATION_GRAPH?.summary?.(record):null;
  const units=[...new Set(captures.map(x=>x.point.unit).filter(Boolean))];
  const unit=units.length===1?units[0]:'';
  const range=captures.map(x=>x.point.pressure).filter(Number.isFinite);
  const rangeText=range.length>=2?
   n(Math.min(...range))+' – '+n(Math.max(...range))+(unit?' '+unit:''):
   tr('Nicht vollständig im Archiv gespeichert','Not fully recorded');
  const fit=latestMeta(record);
  const finalNvm=eventData(afterNvm.at(-1))||{};
  const lastError=errors.at(-1);
  const nvmText=afterNvm.length?
   finalNvm.verified===true?tr('NVM geschrieben und verifiziert','NVM programmed and verified'):
    tr('NVM-Schreibereignis vorhanden; Verifikation nicht bestätigt','NVM write recorded; verification not confirmed'):
   beforeNvm.length?tr('NVM-Vorbereitung vorhanden, kein bestätigter Abschluss','NVM preparation recorded, no confirmed completion'):
   tr('Kein NVM-Schreibabschluss aufgezeichnet','No NVM write completion recorded');
  const equipment=record.equipment||{},software=record.software||{};
  const state=typeof window!=='undefined'&&window.ELMOS_ARCHIVE_CORE?.displayStatus?
   window.ELMOS_ARCHIVE_CORE.displayStatus(record):record.status;
  const deviceFields=[
   [tr('Sensor UID','Sensor UID'),record.chipUID],
   [tr('Benutzer-ID','User ID'),record.customUID||record.initial?.configuredUserId],
   [tr('Adapter / Board','Adapter / board'),equipment.adapter],
   [tr('Adapter-Firmware','Adapter firmware'),equipment.adapterFirmware||equipment.firmware],
   [tr('Web-App-Version','Web app version'),software.version],
   [tr('Protokoll-ID','Report ID'),record.id],
   [tr('Druckbereich','Pressure range'),rangeText],
   [tr('Kalibrierart','Calibration status'),status(state)],
   [tr('Beginn','Start'),date(record.startedAt)],
   [tr('Ende','End'),date(record.endedAt)],
   [tr('Kalibrierpunkte / Aufnahmen','Calibration captures'),captures.length],
   [tr('Erfasste ADC-Samples','Recorded ADC samples'),totalSamples(captures.map(x=>x.point))]
  ];
  const fitFields=[
   [tr('DSP-Koeffizienten berechnet','DSP coefficients fitted'),fit?tr('Ja','Yes'):tr('Nicht protokolliert','Not recorded')],
   [tr('DSP-Zielgrenze','DSP target limit'),fit&&Number.isFinite(fit.outputLimit)?'±'+n(fit.outputLimit,0)+' Digits':null],
   [tr('Druckpolynom / Temperaturpolynom','Pressure / temperature polynomial'),fit?
    String(fit.orderS??'–')+' / '+String(fit.orderT??'–'):null],
   [tr('NVM-Status','NVM status'),nvmText],
   [tr('NVM-Prüfung','NVM verification'),finalNvm.verified===true?tr('Bestätigt','Confirmed'):null]
  ];
  const captureRows=captures.length?captures.map(({point:p,at},i)=>
   '<tr><td>'+escape(i+1)+'</td><td>'+escape(date(at||p.at))+'</td><td>'+escape(p.name||p.kind||'–')+
   '</td><td>'+escape(n(p.pressure,5)+(p.unit?' '+p.unit:''))+'</td><td>'+escape(n(p.temperature,2))+
   '</td><td>'+escape(n(p.adc_s,0))+'</td><td>'+escape(n(p.adc_t,0))+'</td><td>'+
   escape(Array.isArray(p.rawSamples)?p.rawSamples.length:p.sampleCount??'–')+'</td></tr>').join(''):
   '<tr><td colspan="8">'+escape(tr('Keine vollständigen Kalibrierpunkte im Archiv.','No completed calibration points in this archive.'))+'</td></tr>';
  const verificationRows=verifications.length?verifications.map(({data:p,at},i)=>{
   const actual=Number.isFinite(p.pressure)&&Number.isFinite(p.pressureDeviation)?
    p.pressure+p.pressureDeviation:null;
   const span=graphSummary?.span;
   const errorPercent=typeof span==='number'&&span>0&&Number.isFinite(p.pressureDeviation)?
    100*p.pressureDeviation/span:null;
   return '<tr><td>'+escape(i+1)+'</td><td>'+escape(date(at))+'</td><td>'+
    escape(n(p.pressure,5)+(unit?' '+unit:''))+'</td><td>'+escape(n(actual,5))+'</td><td>'+
    escape(n(p.pressureDeviation,5)+(unit?' '+unit:''))+'</td><td>'+
    escape(n(errorPercent,3))+'</td><td>'+escape(Number.isFinite(p.tolerance)?
     '±'+n(p.tolerance,5)+(unit?' '+unit:''):'–')+'</td><td>'+badge(p.pass)+'</td></tr>';
  }).join(''):'<tr><td colspan="8">'+escape(tr('Keine unabhängigen DSP-Prüfungen gespeichert.','No independent DSP verification attempts recorded.'))+'</td></tr>';
  const failureRows=errors.map((e,i)=>
   '<tr><td>'+escape(i+1)+'</td><td>'+escape(date(e.at))+'</td><td>'+
   escape(eventData(e)?.stage||'–')+'</td><td>'+
   escape(eventData(e)?.message||'–')+'</td></tr>').join('');
  const graphicNotice=tr(
   'Die Diagramme verwenden nur archivierte Messwerte. Sie sind keine erneute Prüfung. Falls Toleranz oder Messspanne fehlen, wird kein Grenzwert erfunden.',
   'The charts use only archived measurements. They are not a new test. Missing tolerances or full-scale range are never assumed.');
  // Inline print styles: SVG markup is generated from the SAME archive charts.
  // The print styles keep both graphs visible rather than relying on the parent page.
  const css=`*{box-sizing:border-box}body{margin:0;background:#edf2f6;color:#17374e;font:11px/1.48 Arial,sans-serif}
  .toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px 20px;background:#124a6a;color:white}
  .toolbar button{background:white;color:#124a6a;border:0;border-radius:7px;padding:10px 16px;font-weight:bold;cursor:pointer}
  main{background:#fff;max-width:1030px;margin:18px auto;padding:29px 38px;box-shadow:0 7px 24px #36536829}
  header{border-bottom:3px solid #23729b;padding-bottom:16px;display:flex;justify-content:space-between;gap:12px}
  h1{font-size:25px;margin:5px 0}h2{font-size:15px;color:#175472;margin:20px 0 8px}h3{font-size:13px;margin:8px 0}
  .muted,.cg-muted,.cg-caption{color:#667e90;font-size:10px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px 13px}
  .datum{padding:6px 2px;border-bottom:1px solid #e5edf2;overflow-wrap:anywhere;min-width:0}
  .datum small{display:block;color:#6b8496;font-size:9px}.datum strong{font-size:11px;white-space:pre-wrap}
  .metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:15px 0}
  .metric{border:1px solid #d8e5ec;border-radius:8px;background:#f7fafc;padding:9px}
  .metric strong{font-size:19px;display:block;color:#155e82}.metric small{font-size:9px;color:#688092}
  table{width:100%;border-collapse:collapse;font-size:9px;table-layout:auto}
  th{text-align:left;background:#eaf2f8;color:#285674;padding:7px 5px}td{padding:6px 5px;border-bottom:1px solid #e1eaf0;vertical-align:top;overflow-wrap:anywhere}
  tbody tr:nth-child(even){background:#f9fbfd}.tag{white-space:nowrap;padding:3px 5px;border-radius:4px;font-size:9px}
  .tag.pass{color:#166b4e;background:#e7f8ef}.tag.fail{color:#a72f39;background:#ffe9e9}.tag.unrated{color:#936b19;background:#fff4da}
  .notice{border-left:3px solid #d6aa47;background:#fff9e9;padding:9px 11px;color:#725c2a;font-size:10px;margin:12px 0}
  .footer{border-top:1px solid #dce6ed;margin-top:24px;padding-top:10px;font-size:9px;color:#677e8f;display:flex;justify-content:space-between;gap:12px}
  #archiveWorkspace .cg-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:6px 0 12px}
  #archiveWorkspace .cg-head h3{font-size:14px;margin:0;color:#174d6d}
  #archiveWorkspace .cg-legend{display:flex;flex-wrap:wrap;gap:9px;font-size:10px;margin:6px 0}
  #archiveWorkspace .cg-legend-item{display:inline-flex;align-items:center;gap:5px}
  #archiveWorkspace .cg-swatch{display:inline-block;background:#d3a342;width:9px;height:9px;border-radius:50%}
  #archiveWorkspace .cg-swatch.pass{background:#2d9872}#archiveWorkspace .cg-swatch.fail{background:#c64d53}
  #archiveWorkspace .cg-swatch.tolerance{background:#9ad3c2;border-radius:2px}
  #archiveWorkspace .cg-panel{border:1px solid #dbe6ed;border-radius:10px;margin:10px 0 15px;padding:10px;break-inside:avoid;page-break-inside:avoid}
  #archiveWorkspace .cg-title{color:#1b5273;font-size:13px;margin:0 0 7px}
  #archiveWorkspace .cg-scroll{overflow:visible}#archiveWorkspace .cg-scroll svg{display:block;width:100%;height:auto;max-width:100%;border:0}
  #archiveWorkspace .cg-grid{stroke:#dce5ec;stroke-width:1}#archiveWorkspace .cg-zero{stroke:#83a5b8;stroke-width:1.5}
  #archiveWorkspace .cg-ideal{stroke:#286f9e;stroke-width:2;stroke-dasharray:6 4}
  #archiveWorkspace .cg-tolerance{stroke:#9ad3c2;opacity:.52;stroke-width:15;stroke-linecap:round}
  #archiveWorkspace .cg-tolerance-cap{stroke:#449f82;stroke-width:1.5}
  #archiveWorkspace .cg-marker{stroke:#fff;stroke-width:1.8}#archiveWorkspace .cg-marker.pass{fill:#2d9872}
  #archiveWorkspace .cg-marker.fail{fill:#c64d53}#archiveWorkspace .cg-marker.unrated{fill:#ce9d37}
  #archiveWorkspace .cg-tick{font-size:11px;fill:#5c7185}
  #archiveWorkspace .cg-axis-title{font-size:11px;fill:#184963;font-weight:bold}
  #archiveWorkspace .cg-value{font-size:12px;fill:#17374e;font-weight:bold;paint-order:stroke;stroke:white;stroke-width:3px}
  #archiveWorkspace .cg-caption,#archiveWorkspace .cg-notice{color:#617a8d;font-size:10px}
  #archiveWorkspace .cg-notice{background:#f6f9fc;border:1px solid #dce6ef;padding:8px;border-radius:7px}
  .graphs{break-before:page} .graphs .cg-panel{break-inside:avoid;page-break-inside:avoid}
  @page{size:A4;margin:13mm 12mm}
  @media print{body{background:white;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .toolbar{display:none}main{max-width:none;margin:0;padding:0;box-shadow:none}
  .grid,.metrics,.datum{break-inside:avoid;page-break-inside:avoid}h2{break-after:avoid}
  table thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}
  .graphs{page-break-before:always}}`;
  const summaryCards=[
   [tr('Kalibrierpunkte','Calibration points'),captures.length],
   [tr('DSP-Prüfversuche','DSP verification attempts'),verifications.length],
   [tr('Ausser Toleranz','Out of tolerance'),verifications.filter(x=>x.data.pass===false).length],
   [tr('Fehlermeldungen','Errors'),errors.length]
  ].map(([label,value])=>'<div class="metric"><strong>'+escape(value)+'</strong><small>'+escape(label)+'</small></div>').join('');
  return '<!doctype html><html lang="'+(en()?'en':'de-CH')+'"><head><meta charset="UTF-8"><title>'+
   escape('E70311_Calibration_'+(record.chipUID||'Unknown')+'_'+(record.id||''))+
   '</title><style>'+css+'</style></head><body>'+
   '<div class="toolbar"><span>'+escape(tr('Im Druckdialog «Als PDF speichern» wählen.','Choose Save as PDF in the print dialog.'))+
   '</span><button onclick="window.print()">'+escape(tr('Als PDF speichern / Drucken','Save as PDF / Print'))+'</button></div>'+
   '<main><header><div><div class="muted">ELMOS E703.11 · '+escape(software.name||'Calibration Assistant')+
   (software.version?' v'+escape(software.version):'')+'</div>'+
   '<h1>'+escape(tr('Kalibrierung – Prüfprotokoll','Calibration report'))+'</h1>'+
   '<div class="muted">'+escape(date(record.startedAt))+' – '+escape(date(record.endedAt))+'</div></div>'+
   '<strong>'+escape(status(state))+'</strong></header>'+
   '<div class="metrics">'+summaryCards+'</div>'+
   '<h2>'+escape(tr('Sensor, Werkzeug und Aufzeichnung','Sensor, tool and recording'))+'</h2><div class="grid">'+
   deviceFields.map(([a,b])=>field(a,b)).join('')+'</div>'+
   '<h2>'+escape(tr('Kalibrierung, DSP und NVM','Calibration, DSP and NVM'))+'</h2><div class="grid">'+
   fitFields.map(([a,b])=>field(a,b)).join('')+'</div>'+
   '<h2>'+escape(tr('Aufgenommene Kalibrierpunkte','Recorded calibration points'))+'</h2>'+
   '<table><thead><tr><th>#</th><th>'+escape(tr('Zeit','Time'))+'</th><th>'+
   escape(tr('Punkt','Point'))+'</th><th>'+escape(tr('Referenz','Reference'))+'</th><th>'+
   escape(tr('Temperatur °C','Temperature °C'))+'</th><th>ADC_S</th><th>ADC_T</th><th>'+
   escape(tr('Samples','Samples'))+'</th></tr></thead><tbody>'+captureRows+'</tbody></table>'+
   '<section class="graphs"><h2>'+escape(tr('Grafische Auswertung','Graphical evaluation'))+'</h2>'+
   '<p class="muted">'+escape(graphicNotice)+'</p><div id="archiveWorkspace">'+
   (graph||'<p class="notice">'+escape(tr('Keine grafisch darstellbaren Werte gespeichert.','No chartable data was recorded.'))+'</p>')+
   '</div></section>'+
   '<h2>'+escape(tr('Unabhängige DSP-Prüfpunkte','Independent DSP verification points'))+'</h2>'+
   '<table><thead><tr><th>#</th><th>'+escape(tr('Zeit','Time'))+'</th><th>'+
   escape(tr('Soll','Target'))+'</th><th>'+escape(tr('Ist','Actual'))+'</th><th>'+
   escape(tr('Abweichung','Deviation'))+'</th><th>% FS</th><th>'+
   escape(tr('Toleranz','Tolerance'))+'</th><th>'+escape(tr('Ergebnis','Result'))+
   '</th></tr></thead><tbody>'+verificationRows+'</tbody></table>'+
   (errors.length?'<h2>'+escape(tr('Fehlermeldungen und Auffälligkeiten','Errors and observations'))+
   '</h2><table><thead><tr><th>#</th><th>'+escape(tr('Zeit','Time'))+'</th><th>'+
   escape(tr('Schritt','Stage'))+'</th><th>'+escape(tr('Meldung','Message'))+
   '</th></tr></thead><tbody>'+failureRows+'</tbody></table>':'')+
   '<p class="notice">'+escape(tr('Dieses Dokument gibt die gespeicherten Kalibrier- und Prüfergebnisse wieder. Ein abgeschlossener Archivstatus allein bestätigt keine vollständig bestandene unabhängige DSP- oder NVM-Verifikation. Technische Originaldaten und vollständige Ereignisse sind weiterhin als JSON verfügbar.',
    'This document reproduces recorded calibration and verification data. A completed archive status alone does not establish a fully passed independent DSP or NVM verification. Technical source data and complete events remain available in JSON.'))+'</p>'+
   '<div class="footer"><span>ELMOS E703.11 · '+escape(tr('Lokaler Kalibrierbericht','Local calibration report'))+
   '</span><span>'+escape(record.id||'')+' · '+escape(tr('Erstellt','Generated'))+' '+escape(date(new Date().toISOString()))+'</span></div></main></body></html>';
 }
 function print(record){
  if(!record||record.type!=='calibration')return false;
  // Window creation stays synchronous with the real button click.
  const popup=window.open('','_blank');
  if(!popup)return false;
  try{
   const markup=makeReport(record);
   popup.document.open();popup.document.write(markup);popup.document.close();popup.focus();
   return true;
  }catch(error){
   popup.close();
   throw error;
  }
 }
 return {makeReport,print};
})();
if(typeof window!=='undefined')window.ELMOS_CALIBRATION_REPORT=ELMOS_CALIBRATION_REPORT;
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_CALIBRATION_REPORT;
