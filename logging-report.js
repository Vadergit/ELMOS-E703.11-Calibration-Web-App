'use strict';
/* Printable local test-logging PDF report. Raw samples remain in JSONL/CSV; the
   PDF contains the complete grouped measurement table, metadata and events. */
const ELMOS_LOGGING_REPORT=(()=>{
 const esc=x=>String(x===null||x===undefined?'–':x)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
 const num=(x,d=4)=>typeof x==='number'&&Number.isFinite(x)?
  x.toLocaleString('de-CH',{maximumFractionDigits:d}):'–';
 const date=x=>{if(!x)return '–';const d=new Date(x);return Number.isNaN(d.getTime())?String(x):d.toLocaleString('de-CH');};
 const age=(a,b)=>{const duration=Date.parse(b||'')-Date.parse(a||'');
  return Number.isFinite(duration)&&duration>=0?num(duration/1000,1)+' s':'–';};
 const flat=(object,prefix='')=>{
  const output=[];
  function walk(value,path){
   if(value===null||typeof value!=='object'){
    output.push([path,value===null?'–':value]);return;
   }
   const keys=Object.keys(value);
   if(!keys.length){output.push([path,Array.isArray(value)?'[]':'{}']);return}
   for(const key of keys)walk(value[key],path?path+'.'+key:key);
  }
  walk(object,prefix);
  return output;
 };
 const details=(obj)=>flat(obj).map(([key,val])=>
  '<div class="datum"><small>'+esc(key)+'</small><strong>'+esc(val)+'</strong></div>').join('');
 const pointValue=(point,key)=>{
  const a=point.aggregated?.channels?.[key];
  if(typeof a==='number'&&Number.isFinite(a))return a;
  const snap=point.sensorSnapshot?.[key];
  if(typeof snap==='number'&&Number.isFinite(snap))return snap;
  const last=point.samples?.at(-1)?.[key];
  return typeof last==='number'&&Number.isFinite(last)?last:null;
 };
 const communication=v=>{
  const k=String(v||'').trim().toLowerCase();
  return ['plc','onewire','one-wire'].includes(k)?'One-Wire (AODO)':
   ['i2c','i²c'].includes(k)?'I²C':v||'–';
 };
 function chart(rows){
  const series=[{key:'adcS',color:'#166d98'},{key:'dspS',color:'#cd7d27'}];
  // Downsample visually only; the entire recorded dataset is printed in the table.
  const length=Math.min(rows.length,400);
  const picks=Array.from({length},(_,i)=>rows[Math.round(i*(rows.length-1)/Math.max(1,length-1))]);
  const all=picks.flatMap(p=>series.map(s=>pointValue(p,s.key)).filter(Number.isFinite));
  if(!all.length)return '<p>Keine darstellbaren ADC_S-/DSP_S-Messwerte.</p>';
  const low=Math.min(...all),high=Math.max(...all),pad=Math.max(1,(high-low)*0.08);
  const min=low-pad,max=high+pad,W=890,H=235,L=75,R=18,T=22,B=39;
  const x=i=>L+(W-L-R)*i/Math.max(1,length-1);
  const y=v=>T+(max-v)/(max-min)*(H-T-B);
  const lines=['<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;display:block" role="img" aria-label="ADC_S und DSP_S im Zeitverlauf">'];
  for(const val of [min,(min+max)/2,max]){
   const yy=y(val);
   lines.push('<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'" stroke="#dae6ee"/>');
   lines.push('<text x="'+(L-8)+'" y="'+(yy+4)+'" text-anchor="end" font-size="11" fill="#40647b">'+esc(num(val,1))+'</text>');
  }
  for(const s of series){
   let points=[];
   const flush=()=>{
    if(points.length>1)lines.push('<polyline points="'+points.join(' ')+'" fill="none" stroke="'+s.color+'" stroke-width="2.2"/>');
    else if(points.length===1){const [cx,cy]=points[0].split(',');lines.push('<circle cx="'+cx+'" cy="'+cy+'" r="3" fill="'+s.color+'"/>')}
    points=[];
   };
   for(let i=0;i<picks.length;i++){
    const val=pointValue(picks[i],s.key);
    if(val===null){flush();continue;}
    points.push(x(i).toFixed(2)+','+y(val).toFixed(2));
   }
   flush();
  }
  lines.push('<text x="'+L+'" y="'+(H-10)+'" font-size="11" fill="#41627b">'+esc(date(rows[0]?.startedAt||rows[0]?.endedAt))+'</text>');
  lines.push('<text x="'+(W-R)+'" y="'+(H-10)+'" font-size="11" fill="#41627b" text-anchor="end">'+esc(date(rows.at(-1)?.endedAt||rows.at(-1)?.startedAt))+'</text>');
  lines.push('</svg>');
  return lines.join('')+
   '<p class="caption"><b style="color:#166d98">ADC_S</b> · <b style="color:#cd7d27">DSP_S</b> · Digits'+
    (rows.length>400?' · Grafik auf 400 Punkte reduziert (Tabelle vollständig)':'')+'</p>';
 }
 function makeReport(record,rows=[]){
  if(!record||record.type!=='testlog')throw Error('Test/Logging-Protokoll erforderlich');
  if(!Array.isArray(rows))throw Error('Telemetrie-Daten fehlen');
  const meta=record.testConfiguration||{},telemetry=record.telemetry||{};
  const info={
   'Testname':meta.name||null,'Produkt / DUT':meta.dutName||null,
   'Beschreibung':meta.description||null,'Prüfer':meta.operator||null,'Kategorie':meta.category||null,
   'Chip-UID':record.chipUID||null,'USER-ID':record.customUID||null,
   'Protokoll-ID':record.id||null,'Status':record.status||null,
   'Beginn':date(record.startedAt),'Ende':date(record.endedAt),
   'Dauer':age(record.startedAt,record.endedAt),
   'Adapter':record.equipment?.adapter||null,
   'Kommunikation':communication(record.equipment?.interface),
   'Web-App':record.software?.version||null
  };
  const settings={
   'Aufnahmeart':meta.manual?'Manuelle Aufnahme':'Automatisches Intervall',
   'Intervall [ms]':meta.intervalMs??null,'Einzelmessungen pro Punkt':meta.samplesPerPoint??null,
   'Abstand Einzelmessungen [ms]':meta.sampleSpacingMs??null,
   'Mittelung':meta.aggregation??null,'Gewünschte Dauer [ms]':meta.durationMs??null,
   'Debug-Protokoll':meta.debug===true?'Aktiv':'Inaktiv'
  };
  const events=record.events||[];
  const countSamples=rows.reduce((n,p)=>n+(p.samples?.length||0),0);
  const errors=rows.reduce((n,p)=>n+(p.errors?.length||0),0)+
   events.filter(e=>e.kind==='error').length;
  const omittedConfig=new Set(['name','dutName','description','operator','category','manual','intervalMs','samplesPerPoint','sampleSpacingMs','aggregation','durationMs','debug']);
  const otherSettings=Object.fromEntries(Object.entries(meta).filter(([key])=>!omittedConfig.has(key)));
  const tableRows=rows.map((p,i)=>{
   const adcS=pointValue(p,'adcS'),adcT=pointValue(p,'adcT'),
    dspS=pointValue(p,'dspS'),dspT=pointValue(p,'dspT');
   return '<tr><td>'+esc(p.index??(i+1))+'</td><td>'+esc(date(p.endedAt||p.startedAt))+
    '</td><td>'+esc(p.samples?.length||0)+'</td><td>'+esc(num(adcS,2))+'</td><td>'+
    esc(num(adcT,2))+'</td><td>'+esc(num(dspS,2))+'</td><td>'+esc(num(dspT,2))+
    '</td><td>'+esc(num(p.lagMs,1))+'</td><td>'+esc(p.skippedIntervals??0)+'</td>'+
    '<td>'+esc(p.reference?.pressure??'–')+'</td><td>'+esc(p.reference?.temperature??'–')+'</td></tr>';
  }).join('');
  const eventRows=events.map((e,i)=>
   '<tr><td>'+esc(i+1)+'</td><td>'+esc(date(e.at))+'</td><td>'+esc(e.kind||'')+
    '</td><td class="data">'+esc(JSON.stringify(e.data??{}))+'</td></tr>').join('');
  const photosHtml=typeof ELMOS_ARCHIVE_PHOTOS!=='undefined'?
   ELMOS_ARCHIVE_PHOTOS.reportPhotos(record.photos):'';
  const photosCss=typeof ELMOS_ARCHIVE_PHOTOS!=='undefined'?ELMOS_ARCHIVE_PHOTOS.pdfCss:'';
  const css=`*{box-sizing:border-box}body{margin:0;background:#edf3f6;color:#15334a;font:11px/1.45 Arial,sans-serif}
   .toolbar{display:flex;align-items:center;justify-content:space-between;padding:12px 24px;background:#155272;color:#fff;gap:20px}
   button{cursor:pointer;background:white;color:#155272;font-weight:bold;border:0;border-radius:7px;padding:10px 16px}
   main{max-width:1050px;background:#fff;margin:19px auto;padding:28px 34px;box-shadow:0 4px 20px #405a6a22}
   header{display:flex;justify-content:space-between;gap:18px;padding-bottom:15px;border-bottom:3px solid #27708c}
   h1{font-size:25px;margin:5px 0}h2{font-size:15px;color:#155474;margin:24px 0 10px}
   .muted,.caption{color:#56768c;font-size:10px}.meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 14px}
   .datum{min-width:0;padding:6px;border-bottom:1px solid #e2e9ef;overflow-wrap:anywhere;white-space:pre-wrap}
   .datum small{display:block;color:#627c8f;font-size:9px}.datum strong{font-size:11px;font-weight:600}
   .metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:14px 0}
   .metric{padding:10px;border:1px solid #d4e2eb;border-radius:7px}.metric b{display:block;font-size:18px;color:#1e6182}
   table{border-collapse:collapse;width:100%;font-size:9px;text-align:left;table-layout:auto}
   th{background:#eaf2f7;color:#28526c;white-space:nowrap}th,td{padding:6px 5px;border-bottom:1px solid #e5edf2;vertical-align:top}
   tbody tr:nth-child(even){background:#f8fbfd}td.data{overflow-wrap:anywhere;max-width:550px}
   .plot{border:1px solid #dce7ee;padding:10px;border-radius:8px}
   .footer{margin-top:20px;padding-top:12px;border-top:1px solid #e0e9ef;color:#677e8d;font-size:9px}
   @page{size:A4 landscape;margin:12mm}
   @media print{body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .toolbar{display:none}main{margin:0;padding:0;max-width:none;box-shadow:none}
    table thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}
    .meta,.metrics,.plot{break-inside:avoid;page-break-inside:avoid}h2{break-after:avoid}}`;
  return '<!doctype html><html lang="de-CH"><head><meta charset="UTF-8"><title>'+
   esc(typeof ELMOS_ARCHIVE_CORE!=='undefined'?ELMOS_ARCHIVE_CORE.filename(record).replace(/\.json$/i,''):'E70311_Logging_'+(meta.name||record.chipUID||record.id||'Test'))+
   '</title><style>'+css+photosCss+'</style></head><body>'+ 
   '<div class="toolbar"><span>PDF-Bericht: Im Druckdialog «Als PDF speichern» auswählen.</span>'+
   '<button onclick="window.print()">Als PDF speichern / Drucken</button></div>'+
   '<main><header><div><div class="muted">ELMOS E703.11 · Kalibrierassistent</div>'+
   '<h1>Test / Logging – Prüfprotokoll</h1><div class="muted">'+esc(meta.name||'Sensorprotokoll')+
   '</div></div><strong>'+esc(record.status||'–')+'</strong></header>'+
   '<div class="metrics">'+
    [['Messpunkte',rows.length],['Rohsamples',countSamples],['Fehler',errors],['Ausgefallene Intervalle',telemetry.missedSlots??0]]
    .map(([name,count])=>'<div class="metric"><b>'+esc(count)+'</b>'+esc(name)+'</div>').join('')+
   '</div><h2>Gerät, Test und Zuordnung</h2><div class="meta">'+details(info)+'</div>'+
   '<h2>Aufnahmeeinstellungen</h2><div class="meta">'+details(settings)+details(otherSettings)+'</div>'+
   '<h2>Verlauf ADC_S / DSP_S</h2><div class="plot">'+chart(rows)+'</div>'+
   '<h2>Alle aufgenommenen Messpunkte ('+rows.length+')</h2>'+
   '<p class="caption">Kanäle in Digits. Bei aktiver Mittelung wird der Mittelwert/Median angezeigt, ansonsten der letzte Einzelwert. Alle Rohsamples, Register, Fehlerdetails und Metadaten sind im vollständigen CSV-Export enthalten.</p>'+
   '<table><thead><tr><th>#</th><th>Zeitpunkt</th><th>Samples</th><th>ADC_S</th>'+
   '<th>ADC_T</th><th>DSP_S</th><th>DSP_T</th><th>Versatz ms</th><th>Ausfälle</th>'+
   '<th>Ref. Druck</th><th>Ref. Temp.</th></tr></thead><tbody>'+tableRows+'</tbody></table>'+
   '<h2>Ereignisse und Marker ('+events.length+')</h2>'+
   '<table><thead><tr><th>#</th><th>Zeit</th><th>Ereignis</th><th>Details</th></tr></thead><tbody>'+
   eventRows+'</tbody></table>'+photosHtml+'<div class="footer">Lokales Prüfprotokoll · '+esc(record.id||'')+
   ' · '+esc(date(new Date().toISOString()))+'</div></main></body></html>';
 }
 function openReport(record,loadRows){
  if(!record||record.type!=='testlog')throw Error('Test/Logging-Protokoll erforderlich');
  const popup=window.open('','_blank');
  if(!popup)return false;
  popup.document.open();
  popup.document.write('<!doctype html><html lang="de-CH"><meta charset="UTF-8"><title>Logging PDF</title>'+
   '<body style="font:16px Arial,sans-serif;padding:28px"><p>Messdaten werden für den PDF-Bericht geladen …</p></body></html>');
  popup.document.close();
  Promise.resolve().then(()=>loadRows()).then(rows=>{
   if(popup.closed)return;
   const html=makeReport(record,rows);
   popup.document.open();popup.document.write(html);popup.document.close();
  }).catch(error=>{
   if(popup.closed)return;
   popup.document.open();
   popup.document.write('<!doctype html><html lang="de-CH"><meta charset="UTF-8"><body style="font:16px Arial,sans-serif;padding:28px">'+
    '<h2>PDF-Bericht konnte nicht erstellt werden</h2><pre>'+esc(error.message||error)+'</pre></body></html>');
   popup.document.close();
  });
  return true;
 }
 return {makeReport,openReport};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_LOGGING_REPORT;
if(typeof window!=='undefined')window.ELMOS_LOGGING_REPORT=ELMOS_LOGGING_REPORT;
