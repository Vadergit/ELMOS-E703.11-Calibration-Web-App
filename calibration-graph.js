'use strict';
/* Read-only calibration archive charts. No sensor access, no recalibration and
 * no writes to the original archive. All values are derived from recorded events. */
const ELMOS_CALIBRATION_GRAPH=(()=>{
 const NS='http://www.w3.org/2000/svg';
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const en=()=>typeof document!=='undefined'&&document.documentElement?.lang==='en';
 const local=(de,english)=>en()?english:de;
 const fmt=(n,places=3)=>finite(n)?n.toLocaleString(en()?'en-US':'de-CH',{maximumFractionDigits:places}):'–';
 const signed=(n,places=3)=>(finite(n)&&n>0?'+':'')+fmt(n,places);
 const node=(tag,content,className)=>{
  const x=document.createElement(tag);
  if(content!=null)x.textContent=String(content);
  if(className)x.className=className;
  return x;
 };
 const svg=(tag,attrs={},textValue)=>{
  const x=document.createElementNS(NS,tag);
  for(const [key,value]of Object.entries(attrs))x.setAttribute(key,String(value));
  if(textValue!=null)x.textContent=String(textValue);
  return x;
 };
 const payload=e=>e?.data&&typeof e.data==='object'?e.data:e;
 function summary(record){
  const events=Array.isArray(record?.events)?record.events:[];
  const captures=events.filter(e=>e?.kind==='calibration_point'&&!events.some(d=>d?.kind==='calibration_point_deleted'&&d.data?.point?.at!=null&&d.data.point.at===e.data?.point?.at&&d.data.point.kind===e.data?.point?.kind&&d.data.point.slot===e.data?.point?.slot)).map(payload)
   .map(e=>e?.point).filter(p=>p&&finite(p.pressure));
  const calibratedUnits=[...new Set(captures.map(p=>p.unit).filter(Boolean))];
  const unit=calibratedUnits.length===1?calibratedUnits[0]:'';
  const pressures=captures.map(p=>p.pressure);
  const lo=pressures.length?Math.min(...pressures):null;
  const hi=pressures.length?Math.max(...pressures):null;
  const span=finite(lo)&&finite(hi)&&hi>lo?hi-lo:null;
  // Store all attempts rather than silently discarding failed and repeated checks.
  const checks=events.filter(e=>e?.kind==='verification_attempt').map((e,index)=>{
   const d=payload(e);
   const reference=finite(d.pressure)?d.pressure:null;
   const deviation=finite(d.pressureDeviation)?d.pressureDeviation:null;
   const tolerance=finite(d.tolerance)&&d.tolerance>0?d.tolerance:null;
   const within=d.pass===true?'pass':d.pass===false?'fail':'unrated';
   const measured=finite(reference)&&finite(deviation)?reference+deviation:null;
   return {index,at:e.at||null,slot:d.slot,reference,measured,deviation,tolerance,
    deviationPercent:finite(span)&&finite(deviation)?100*deviation/span:null,
    tolerancePercent:finite(span)&&finite(tolerance)?100*tolerance/span:null,
    temperature:finite(d.temperature)?d.temperature:null,
    dspS:finite(d.dspS)?d.dspS:null,dspTarget:finite(d.dspTarget)?d.dspTarget:null,
    status:within};
  });
  const raw=captures.map((p,index)=>({index,pressure:p.pressure,
   adcS:finite(p.adc_s)?p.adc_s:null,temperature:finite(p.temperature)?p.temperature:null}));
  return {unit,span,rangeMin:lo,rangeMax:hi,captures:raw,checks,
   failed:checks.filter(p=>p.status==='fail').length,
   passed:checks.filter(p=>p.status==='pass').length,
   unrated:checks.filter(p=>p.status==='unrated').length,
   measured:checks.filter(p=>finite(p.deviation)&&finite(p.reference)).length};
 }
 function axes(plot,width,height,{minY,maxY,yLabel,xLabel,minX,maxX,xLabels}){
  const left=75,right=25,top=27,bottom=49;
  const innerW=width-left-right,innerH=height-top-bottom;
  const safeY=maxY>minY?maxY-minY:1;
  const yy=v=>top+(maxY-v)*innerH/safeY;
  const xx=v=>left+(v-minX)*innerW/Math.max(1e-12,maxX-minX);
  for(let i=0;i<=4;i++){
   const tick=minY+(maxY-minY)*i/4,y=yy(tick);
   plot.append(svg('line',{x1:left,y1:y,x2:width-right,y2:y,class:'cg-grid'}));
   plot.append(svg('text',{x:left-11,y:y+4,'text-anchor':'end',class:'cg-tick'},fmt(tick,2)));
  }
  plot.append(svg('text',{x:13,y:16,class:'cg-axis-title'},yLabel));
  if(Array.isArray(xLabels)){
   const step=Math.max(1,Math.ceil(xLabels.length/14));
   for(let i=0;i<xLabels.length;i++){
    if(i%step!==0&&i!==xLabels.length-1)continue;
    plot.append(svg('text',{x:xx(i+1),y:height-16,'text-anchor':'middle',class:'cg-tick'},xLabels[i]));
   }
  }else{
   for(let i=0;i<=4;i++){
    const value=minX+(maxX-minX)*i/4;
    plot.append(svg('text',{x:xx(value),y:height-16,'text-anchor':'middle',class:'cg-tick'},fmt(value,2)));
   }
  }
  plot.append(svg('text',{x:width-right,y:height-3,'text-anchor':'end',class:'cg-tick'},xLabel));
  return {x:xx,y:yy,left,right,top,bottom};
 }
 function point(plot,x,y,status,tooltip,label){
  const cls=status==='fail'?'fail':status==='pass'?'pass':'unrated';
  const dot=svg('circle',{cx:x,cy:y,r:7,class:'cg-marker '+cls,
   role:'img','aria-label':label});
  dot.append(svg('title',{},tooltip));
  plot.append(dot);
 }
 function frame(host,heading,caption){
  const box=node('section',null,'cg-panel');
  box.append(node('h4',heading,'cg-title'));
  const scroll=node('div',null,'cg-scroll');
  box.append(scroll);
  if(caption)box.append(node('p',caption,'cg-caption'));
  host.append(box);
  return scroll;
 }
 function deviationPlot(host,s){
  const rows=s.checks.filter(p=>finite(p.deviation));
  if(!rows.length)return;
  const scaled=finite(s.span)&&s.span>0;
  const value=p=>scaled?p.deviationPercent:p.deviation;
  const tolerance=p=>scaled?p.tolerancePercent:p.tolerance;
  const unit=scaled?'% FS':(s.unit||local('Kalibriereinheit','calibration unit'));
  const width=Math.max(800,s.checks.length*60+130),height=304;
  const maxMagnitude=Math.max(0.001,...rows.flatMap(p=>[Math.abs(value(p)),Math.abs(tolerance(p)||0)]));
  const extent=Math.max(scaled?0.25:0.001,maxMagnitude*1.23);
  const scroll=frame(host,local('Abweichungen und Toleranz','Deviations and tolerance'),
   scaled?local('Druckabweichung in % der kalibrierten Messspanne. Alle gespeicherten Prüfversuche werden angezeigt.','Pressure deviation as % of calibrated full scale. Every stored verification attempt is shown.'):
    local('Der vollständige Kalibrierbereich ist nicht gespeichert. Abweichungen werden in der gespeicherten Kalibriereinheit statt in % FS dargestellt.','The full calibration range is unavailable; deviations are shown in the recorded calibration unit instead of % FS.'));
  const plot=svg('svg',{viewBox:'0 0 '+width+' '+height,width,height,role:'img',
   'aria-label':local('Prüfabweichungen mit Toleranzband','Verification deviations with tolerance limits')});
  const coords=axes(plot,width,height,{minY:-extent,maxY:extent,yLabel:unit,
   xLabel:local('Prüfversuch','Verification attempt'),minX:.5,maxX:s.checks.length+.5,
   xLabels:s.checks.map((_,i)=>String(i+1))});
  // A tolerance is only valid at the event that recorded it. A vertical interval
  // is more honest than a global band if limits vary between verification points.
  for(const p of s.checks){
   const x=coords.x(p.index+1),tol=tolerance(p);
   if(!finite(tol))continue;
   const top=coords.y(tol),bottom=coords.y(-tol);
   plot.append(svg('line',{x1:x,x2:x,y1:top,y2:bottom,class:'cg-tolerance'}));
   plot.append(svg('line',{x1:x-6,x2:x+6,y1:top,y2:top,class:'cg-tolerance-cap'}));
   plot.append(svg('line',{x1:x-6,x2:x+6,y1:bottom,y2:bottom,class:'cg-tolerance-cap'}));
  }
  const zero=coords.y(0);
  plot.append(svg('line',{x1:coords.left,x2:width-coords.right,y1:zero,y2:zero,class:'cg-zero'}));
  for(const p of rows){
   const x=coords.x(p.index+1),y=coords.y(value(p));
   const label=local('Versuch ','Attempt ')+(p.index+1)+': '+signed(value(p),3)+' '+unit;
   const tooltip=label+' · '+local('Referenz ','Reference ')+fmt(p.reference,4)+' '+s.unit+
    (finite(tolerance(p))?' · '+local('Toleranz ±','Tolerance ±')+fmt(tolerance(p),3)+' '+unit:'')+
    ' · '+(p.status==='pass'?local('Bestanden','Passed'):p.status==='fail'?local('Ausser Toleranz','Out of tolerance'):local('Nicht bewertet','Not assessed'));
   point(plot,x,y,p.status,tooltip,label);
   const textY=y<coords.top+18?y+22:y-13;
   plot.append(svg('text',{x,y:textY,'text-anchor':'middle',class:'cg-value'},signed(value(p),2)+(scaled?'%':' '+s.unit)));
  }
  scroll.append(plot);
 }
 function comparisonPlot(host,s){
  const rows=s.checks.filter(p=>finite(p.reference)&&finite(p.measured));
  if(!rows.length)return;
  const refMin=finite(s.rangeMin)?s.rangeMin:Math.min(...rows.map(p=>p.reference));
  const refMax=finite(s.rangeMax)?s.rangeMax:Math.max(...rows.map(p=>p.reference));
  const span=refMax-refMin;
  const spread=span>0?span:Math.max(1,Math.abs(refMax)*.1);
  const minX=refMin-spread*.075,maxX=refMax+spread*.075;
  const ys=rows.flatMap(p=>[p.measured,p.reference,
   finite(p.tolerance)?p.reference-p.tolerance:p.reference,
   finite(p.tolerance)?p.reference+p.tolerance:p.reference]);
  const low=Math.min(minX,...ys),high=Math.max(maxX,...ys),margin=Math.max(.001,(high-low)*.07);
  const minY=low-margin,maxY=high+margin,width=850,height=340;
  const scroll=frame(host,local('Soll-/Ist-Druck mit Toleranz','Target versus actual pressure with tolerance'),
   local('Ist-Druck = gespeicherter Referenzdruck + gemessene DSP-Druckabweichung. Die blauen Striche zeigen den Sollwert, die senkrechten Bereiche die je Versuch gespeicherte Toleranz.',
   'Actual pressure = stored reference pressure + measured DSP pressure deviation. Blue marks indicate targets; vertical ranges show the tolerance saved for each attempt.'));
  const plot=svg('svg',{viewBox:'0 0 '+width+' '+height,width,height,role:'img',
   'aria-label':local('Vergleich von Referenzdruck, berechnetem Ist-Druck und Toleranz','Reference versus computed pressure and tolerance')});
  const co=axes(plot,width,height,{minY,maxY,yLabel:s.unit||'Druck',xLabel:local('Referenzdruck','Reference pressure')+' '+s.unit,minX,maxX});
  plot.append(svg('line',{x1:co.x(minX),y1:co.y(minX),x2:co.x(maxX),y2:co.y(maxX),class:'cg-ideal'}));
  for(const p of rows){
   const x=co.x(p.reference);
   if(finite(p.tolerance)){
    plot.append(svg('line',{x1:x,y1:co.y(p.reference-p.tolerance),
     x2:x,y2:co.y(p.reference+p.tolerance),class:'cg-tolerance'}));
   }
   const label=local('Versuch ','Attempt ')+(p.index+1);
   const tt=label+' · '+local('Soll ','Target ')+fmt(p.reference,4)+' '+s.unit+
    ' · '+local('Ist ','Actual ')+fmt(p.measured,4)+' '+s.unit+
    ' · Δ '+signed(p.deviation,4)+' '+s.unit+
    (finite(p.tolerance)?' · ±'+fmt(p.tolerance,4)+' '+s.unit:'');
   point(plot,x,co.y(p.measured),p.status,tt,tt);
  }
  scroll.append(plot);
 }
 function calibrationOnly(host,s){
  const captured=s.captures.filter(p=>finite(p.pressure)&&finite(p.adcS));
  if(!captured.length){
   host.append(node('p',local('Keine unabhängigen DSP-Prüfpunkte oder auswertbaren Kalibriermesswerte gespeichert.','No independent DSP verification points or usable calibration samples were stored.'),'cg-placeholder'));
   return;
  }
  host.append(node('p',local('Nur Kalibrierpunkte gespeichert. Für ein Toleranzband müssen zuerst unabhängige DSP-Prüfpunkte aufgenommen werden.','Only calibration points are stored. An independent DSP verification is required for a tolerance band.'),'cg-notice'));
  const xVals=captured.map(p=>p.pressure),yVals=captured.map(p=>p.adcS);
  const lowX=Math.min(...xVals),highX=Math.max(...xVals),dx=Math.max(1,highX-lowX);
  const lowY=Math.min(...yVals),highY=Math.max(...yVals),dy=Math.max(100,highY-lowY);
  const width=850,height=290;
  const scroll=frame(host,local('Kalibrierpunkte · ADC_S','Calibration points · ADC_S'),
   local('Rohsignal aus den aufgenommenen Kalibrierpunkten; keine Toleranzbewertung.','Raw signal from the calibration points; no tolerance assessment.'));
  const plot=svg('svg',{viewBox:'0 0 '+width+' '+height,width,height,role:'img','aria-label':local('ADC-S-Kalibrierpunkte','ADC-S calibration points')});
  const co=axes(plot,width,height,{minX:lowX-dx*.08,maxX:highX+dx*.08,
   minY:lowY-dy*.16,maxY:highY+dy*.16,yLabel:'ADC_S',xLabel:local('Referenzdruck ','Reference pressure ')+s.unit});
  for(const p of captured){
   const label=local('Kalibrierpunkt ','Calibration point ')+(p.index+1)+' · '+fmt(p.pressure,3)+' '+s.unit+' · ADC_S '+fmt(p.adcS,0);
   point(plot,co.x(p.pressure),co.y(p.adcS),'unrated',label,label);
  }
  scroll.append(plot);
 }
 function renderArchive(host,record){
  if(!host)return null;
  host.replaceChildren();
  const s=summary(record);
  const head=node('div',null,'cg-head');
  const title=node('div');
  title.append(node('h3',local('Ergebnisse auf einen Blick','Results at a glance')));
  title.append(node('p',local('Gespeicherte DSP-Prüfungen aus der Kalibrierung','Stored DSP verification results from calibration'),'cg-muted'));
  head.append(title,node('span',s.checks.length+' '+local('Prüfversuche erfasst','verification attempts recorded'),'cg-muted'));
  host.append(head);
  if(s.checks.length){
   const tally=node('div',null,'cg-legend');
   for(const [status,label] of [['pass',local('Innerhalb Toleranz','Within tolerance')],
    ['fail',local('Ausser Toleranz','Out of tolerance')],
    ['unrated',local('Nicht bewertet','Not assessed')]]){
    if(!s.checks.some(p=>p.status===status))continue;
    const item=node('span',null,'cg-legend-item');
    item.append(node('i',null,'cg-swatch '+status),node('span',label));
    tally.append(item);
   }
   if(s.checks.some(p=>finite(p.tolerance))){
    const item=node('span',null,'cg-legend-item');
    item.append(node('i',null,'cg-swatch tolerance'),node('span',local('Toleranzbereich','Tolerance interval')));
    tally.append(item);
   }
   host.append(tally);
   if(!s.unit)host.append(node('p',local('Die Druckeinheit ist im Archiv nicht eindeutig gespeichert. Keine physikalische Einheit wird angenommen.','The pressure unit is not unambiguously recorded in this archive. No physical unit has been assumed.'),'cg-notice'));
   deviationPlot(host,s);
   comparisonPlot(host,s);
   if(s.checks.some(p=>!finite(p.tolerance)))
    host.append(node('p',local('Bei einzelnen Prüfpunkten fehlt die gespeicherte Toleranz. Für diese Punkte wird kein Toleranzband erfunden.','Some checks lack a recorded tolerance. No tolerance limit is invented for these points.'),'cg-notice'));
  }else calibrationOnly(host,s);
  return s;
 }
 return {summary,renderArchive};
})();
if(typeof window!=='undefined')window.ELMOS_CALIBRATION_GRAPH=ELMOS_CALIBRATION_GRAPH;
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_CALIBRATION_GRAPH;
