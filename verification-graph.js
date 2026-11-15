'use strict';
/* Read-only visualisation of archived verification attempts.
   Never communicates with the sensor or changes calibration/NVM permissions. */
const ELMOS_VERIFICATION_GRAPH=(()=>{
 const NS='http://www.w3.org/2000/svg';
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const decimal=(v,d=3)=>finite(v)?v.toLocaleString(document.documentElement.lang==='en'?'en-US':'de-CH',{maximumFractionDigits:d}):'–';
 const local=(de,en)=>document.documentElement.lang==='en'?en:de;
 const node=(tag,txt,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=String(txt);return n};
 const svg=(tag,attrs={},content)=>{const n=document.createElementNS(NS,tag);for(const [key,value] of Object.entries(attrs))n.setAttribute(key,String(value));if(content!=null)n.textContent=String(content);return n};
 function summary(record){
  const plan=record?.plan;
  const steps=plan?.steps||[];
  const rawSpan=steps.length?Math.max(...steps.map(s=>s.pressure))-Math.min(...steps.map(s=>s.pressure)):0;
  const configured=Number(record?.verificationConfig?.pressureSpan);
  const span=Number.isFinite(configured)&&configured>0?configured:rawSpan;
  const mode=plan?.mode||'combined';
  const data=steps.map((step,i)=>{
   // The latest attempt is authoritative; a later failed retest must not be hidden by an older pass.
   const tries=(record.events||[]).filter(x=>x.kind==='measurement'&&x.stepIndex===i);
   const item=tries.at(-1)||null;
   const itemSpan=finite(item?.pressureFullScaleSpan)&&item.pressureFullScaleSpan>0?item.pressureFullScaleSpan:span;
   const pressurePct=item&&finite(item.pressureError)&&itemSpan>0?100*item.pressureError/itemSpan:null;
   const tempError=item&&finite(item.temperatureError)?item.temperatureError:null;
   const value=mode==='temperature'?tempError:pressurePct;
   const tolerance=mode==='temperature'?
    (finite(item?.temperatureTolerance)?item.temperatureTolerance:1):
    (finite(item?.pressureTolerancePercent)?item.pressureTolerancePercent:
     finite(item?.pressureTolerance)&&itemSpan>0?100*item.pressureTolerance/itemSpan:
     Number.isFinite(record?.verificationConfig?.pressureTolerancePercent)?record.verificationConfig.pressureTolerancePercent:0.2);
   return {index:i,step,item,tries:tries.length,value,tolerance,pressurePct,tempError,
    status:!item?'pending':item.pass===true?'pass':item.pass===false?'fail':'unknown'};
  });
  return {data,span,mode,passed:data.filter(x=>x.status==='pass').length,failed:data.filter(x=>x.status==='fail').length,
   unknown:data.filter(x=>x.status==='unknown').length,measured:data.filter(x=>x.item).length,
   pending:data.filter(x=>x.status==='pending').length,total:data.length};
 }
 function render(host,record,active=0,onSelect){
  if(!host)return;
  host.replaceChildren();
  const result=summary(record);
  const {data,mode}=result;
  if(!data.length){host.append(node('p',local('Lege einen Prüfplan fest, um die Ergebnisübersicht zu sehen.','Set up a test plan to see the results.'),'vg-placeholder'));return result;}
  const head=node('div',null,'vg-head');
  const title=node('div');
  title.append(node('h3',local('Ergebnisse auf einen Blick','Results at a glance')));
  title.append(node('p',local('Jeder Punkt wird direkt nach der Messung eingezeichnet.','Each point is plotted immediately after measurement.'),'vg-muted'));
  head.append(title);
  const tally=node('div',null,'vg-tally');
  for(const [label,amount,cls] of [
   [local('Bestanden','Passed'),result.passed,'pass'],
   [local('Ausser Toleranz','Out of tolerance'),result.failed,'fail'],
   [local('Offen','Pending'),result.pending+result.unknown,'pending']]){
   const chip=node('span',null,'vg-count '+cls);
   chip.append(node('strong',amount),document.createTextNode(' '+label));tally.append(chip);
  }
  head.append(tally);host.append(head);
  const axisUnits=mode==='temperature'?'°C':'% FS';
  if(mode!=='temperature'&&!(result.span>0)){
   host.append(node('p',local('Für die Prozentbewertung fehlt eine gültige Druck-Messspanne. Gib diese unter «Weitere Einstellungen» ein.','A valid pressure full-scale span is required for percentage evaluation. Enter it under Additional settings.'),'vg-warning'));
  }
  const lastAttempts=data.filter(x=>x.item);
  const displayValue=data.some(x=>finite(x.value)&&finite(x.tolerance));
  const spanMax=Math.max(0.3,...data.map(x=>Math.max(Math.abs(x.value||0),Math.abs(x.tolerance||0))),0.2)*1.25;
  const max=Math.ceil(spanMax*20)/20;
  const windowSize=48;
  const first=data.length<=windowSize?0:Math.min(data.length-windowSize,Math.max(0,active-Math.floor(windowSize/2)));
  const visible=data.slice(first,first+windowSize);
  const width=Math.max(740,visible.length*30+90),height=272,left=65,right=25,top=20,bottom=50,plotW=width-left-right,plotH=height-top-bottom;
  const y=v=>top+(max-v)*plotH/(2*max);
  const x=i=>left+(i-first+.5)*plotW/visible.length;
  const chart=node('div',null,'vg-chartscroll');
  const canvas=svg('svg',{viewBox:'0 0 '+width+' '+height,width,height,role:'img',
   'aria-label':local('Messabweichungen und Toleranzgrenzen für alle Prüfpunkte','Measurement deviations and tolerance limits for all verification points')});
  for(const tick of [-max,-max/2,0,max/2,max]){
   const yy=y(tick);canvas.append(svg('line',{x1:left,x2:width-right,y1:yy,y2:yy,class:tick===0?'vg-zero':'vg-grid'}));
   const lab=svg('text',{x:left-12,y:yy+4,'text-anchor':'end',class:'vg-axis'},decimal(tick,2));canvas.append(lab);
  }
  canvas.append(svg('text',{x:12,y:12,class:'vg-axis-title'},axisUnits));
  const maxLabels=Math.min(visible.length,16),labelEvery=Math.max(1,Math.ceil(visible.length/maxLabels));
  for(const p of visible){
   const xx=x(p.index);
   const tol=finite(p.tolerance)?p.tolerance:0.2;
   canvas.append(svg('line',{x1:xx,y1:y(-tol),x2:xx,y2:y(tol),class:'vg-tolerance', 'stroke-width':data.length>40?8:14}));
   if((p.index-first)%labelEvery===0||p.index===data.length-1)
    canvas.append(svg('text',{x:xx,y:height-bottom+23,'text-anchor':'middle',class:'vg-axis'},String(p.index+1)));
   const center=finite(p.value)?p.value:0;
   const marker=svg('circle',{cx:xx,cy:y(center),r:data.length>60?5:7.2,
    class:'vg-marker '+p.status+(p.index===active?' selected':''),
    tabindex:0,role:'button','aria-label':local('Prüfpunkt ','Verification point ')+(p.index+1)});
   const tt=local('Punkt ','Point ')+(p.index+1)+' · '+local('Soll','Target')+': '+decimal(p.step.pressure,3)+' / '+decimal(p.step.temperature,2)+' °C · '+
    (p.item?local('Abweichung','Deviation')+': '+(finite(p.value)?decimal(p.value,4)+' '+axisUnits:local('nicht bewertet','not evaluated'))+
      ' · '+(p.status==='pass'?local('Bestanden','Passed'):p.status==='fail'?local('Ausser Toleranz','Out of tolerance'):local('Nicht bewertet','Not evaluated')):local('Noch offen','Pending'));
   marker.append(svg('title',{},tt));
   marker.addEventListener('click',()=>onSelect?.(p.index));
   marker.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect?.(p.index)}});
   canvas.append(marker);
  }
  canvas.append(svg('text',{x:width-right,y:height-10,'text-anchor':'end',class:'vg-axis'},local('Prüfpunkt','Point')));
  chart.append(canvas);host.append(chart);
  if(data.length>visible.length)host.append(node('p',local('Angezeigte Prüfpunkte: ','Visible points: ')+(first+1)+'–'+(first+visible.length)+' / '+data.length,'vg-muted'));
  const foot=node('p',mode==='temperature'?
   local('Diagramm: Temperaturabweichung in °C. Die Balken zeigen die zulässige Toleranz je Punkt.','Chart: temperature deviation in °C. Bars show the permitted tolerance for each point.'):
   local('Diagramm: Druckabweichung in % der Messspanne. Die Balken zeigen die zulässige Toleranz je Punkt. Rot bedeutet, dass mindestens eine bewertete Bedingung nicht bestanden wurde.','Chart: pressure deviation as % of full scale. Bars show the permitted tolerance per point. Red means at least one assessed criterion failed.'),'vg-caption');
  host.append(foot);
  const current=data[Math.min(data.length-1,Math.max(0,active))];
  const resultCard=node('div',null,'vg-current '+(current.status==='pass'?'pass':current.status==='fail'?'fail':'pending'));
  const label=current.status==='pass'?local('✓ Prüfpunkt bestanden','✓ Point passed'):
   current.status==='fail'?local('✕ Ausser Toleranz','✕ Out of tolerance'):
   current.status==='unknown'?local('! Nicht bewertet','! Not assessed'):local('○ Noch nicht gemessen','○ Not measured yet');
  resultCard.append(node('strong',local('Punkt ','Point ')+(current.index+1)+' · '+label));
  if(current.item){
   const parts=[
    local('Soll','Target')+' '+decimal(current.item.referencePressure,3)+' · '+decimal(current.item.referenceTemperature,2)+' °C',
    finite(current.item.sample?.sensorPressure)?local('Ist-Druck','Measured pressure')+' '+decimal(current.item.sample.sensorPressure,5):'DSP_S '+String(current.item.sample?.dspS??'–'),
    finite(current.pressurePct)?local('Druckfehler','Pressure error')+' '+decimal(current.pressurePct,4)+' % FS':local('Druck nicht bewertet','Pressure not assessed'),
    finite(current.tempError)?local('Temperaturfehler','Temperature error')+' '+decimal(current.tempError,3)+' °C':local('Temperatur nicht bewertet','Temperature not assessed')
   ];
   resultCard.append(node('p',parts.join(' · ')));
   resultCard.append(node('small',local('Versuche an diesem Punkt: ','Attempts at this point: ')+current.tries));
  }else{
   resultCard.append(node('p',local('Stelle die Referenzbedingungen ein und starte die Messung.','Set the reference conditions and start the measurement.')));
  }
  host.append(resultCard);
  return result;
 }
 return {summary,render};
})();
if(typeof window!=='undefined')window.ELMOS_VERIFICATION_GRAPH=ELMOS_VERIFICATION_GRAPH;
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_VERIFICATION_GRAPH;
