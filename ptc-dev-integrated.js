'use strict';
(function(){
 if(window.ELMOS_PTC_DEV!==true)return;
 const A=ELMOS_TEMPERATURE_AFE,P=PTC_PROFILE,$=id=>document.getElementById(id),fmt=v=>Number.isFinite(v)?Math.round(v).toLocaleString('de-CH'):'—';
 let configured=null,latest=null,observed=null,settings={bridgeOhm:10000,parallelOhm:7000,ptcTcr:2000,minTemp:-40,maxTemp:125,bridgeTolerance:10,parallelTolerance:20,ptcTcrTolerance:20,tk0:25,tke:300};
 const active=()=>$('calTempSource')?.value==='bridge';
 const field=(key,label)=>'<label>'+label+'<input type="number" step="any" data-ptc-key="'+key+'" value="'+settings[key]+'"></label>';
 function model(){return {...settings,svddCode:2};}
 function mount(){
  $('gwPtcSetup').innerHTML='<div class="gw-subheading">PTC · Auslegung</div><div class="gw-fields gw-3">'+field('bridgeOhm','Messbrücke bei 25 °C (Ω)')+field('parallelOhm','PTC bei 25 °C (Ω)')+field('ptcTcr','PTC TKR (ppm/K)')+field('minTemp','Betrieb min. (°C)')+field('maxTemp','Betrieb max. (°C)')+'</div><details><summary>Erweiterte Einstellungen</summary><div class="gw-fields gw-3">'+field('bridgeTolerance','Brücke ± %')+field('parallelTolerance','PTC ± %')+field('ptcTcrTolerance','TKR ± %')+field('tk0','Demo TK0 (Digits/K)')+field('tke','Demo TKE (ppm/K)')+'</div></details><p id="gwPtcPreview" class="gw-fieldnote"></p>';
  $('gwPtcControls').innerHTML='<div class="gw-subheading">Temperatur-AFE · PTC</div><p id="gwPtcStatus" class="gw-fieldnote"></p><div class="gw-panel-actions"><button type="button" id="gwPtcConfigure" class="primary">Gesamtwiderstand messen &amp; AFE einstellen</button></div><p class="gw-fieldnote">Demo-Sensor · Referenzdruck anlegen:</p><div class="gw-panel-actions"><button type="button" id="gwPtcLow">P min</button><button type="button" id="gwPtcHigh">P max</button></div><p id="gwPtcMessage" class="gw-fieldnote" role="status"></p>';
  $('gwPtcPlot').innerHTML='<div class="gw-subheading">ADC_T · erwarteter Temperaturhub</div><div id="gwPtcSvg"></div><p class="gw-fieldnote" id="gwPtcStats"></p><div class="gw-chart-legend"><span style="color:#d0a331">■ Modellprognose / Reserve</span><span style="color:#398aca">● Aufgenommener ADC_T</span></div>';
  $('gwPtcSetup').addEventListener('input',e=>{const k=e.target.dataset.ptcKey;if(!k)return;settings[k]=e.target.value===''?NaN:Number(e.target.value);configured=null;observed=null;refresh();});
  $('calTempSource').addEventListener('change',()=>{configured=null;observed=null;if(!active())window.ELMOS_GUIDED_API?.clearPtcDev?.();refresh();});
  $('gwPtcConfigure').onclick=async()=>{const b=$('gwPtcConfigure');b.disabled=true;try{
    const p=model(),nom=P.range(p),anchor={ohm:nom.nominalOhm,temp:25,uncertainty:1};
    const plan=P.plan(p,anchor);if(!plan.selection.best)throw Error('Kein gemeinsamer RPGA-Bereich für die Einzelmessung. Toleranzen/Betrieb prüfen.');
    await window.ELMOS_GUIDED_API.configurePtcDev(p,plan.selection.best.code,25);configured={p,anchor,code:plan.selection.best.code,plan};observed=null;message('Simuliertes RAM bestätigt · R gesamt '+fmt(anchor.ohm)+' Ω · RPGA '+configured.code);
   }catch(e){configured=null;message(e.message);}finally{b.disabled=false;refresh();}
  };
  const set=async(id)=>{try{if(!configured)throw Error('Zuerst Temperatur-AFE einstellen.');await window.ELMOS_GUIDED_API.setPtcDevReference(Number($(id).value),25);}catch(e){message(e.message)}};
  $('gwPtcLow').onclick=()=>set('pmin');$('gwPtcHigh').onclick=()=>set('pmax');refresh();
 }
 function message(t){if($('gwPtcMessage'))$('gwPtcMessage').textContent=t}
 function refresh(){
  for(const id of ['gwPtcSetup','gwPtcControls','gwPtcPlot'])if($(id))$(id).hidden=!active();
  if(!active())return;
  try{const r=P.range(model());if($('gwPtcPreview'))$('gwPtcPreview').textContent='PTC nominal '+fmt(r.ptcMinOhm)+'–'+fmt(r.ptcMaxOhm)+' Ω · R gesamt bei 25 °C '+fmt(r.nominalOhm)+' Ω';if($('gwPtcStatus'))$('gwPtcStatus').textContent=configured?'RPGA '+configured.code+' · '+fmt(configured.plan.selection.best.i2u)+' mV/mA · Einzelmessung '+fmt(configured.anchor.ohm)+' Ω':'Auslegung '+fmt(r.minOhm)+'–'+fmt(r.maxOhm)+' Ω · Einzelmessung vor AFE-Auswahl empfohlen.';}catch(e){if($('gwPtcPreview'))$('gwPtcPreview').textContent=e.message}
  renderPlot();
 }
 function validate(plan){if(!active())return;P.range(model());if(settings.minTemp>25||settings.maxTemp<25||settings.minTemp< -40||settings.maxTemp>125)throw Error('Betriebsbereich muss 25 °C einschliessen und innerhalb −40…125 °C liegen.');if(plan.tCount<2||plan.orderT<1)throw Error('Für den PTC-Abgleich mindestens zwei Temperaturstufen wählen.');if(plan.temperatures.some(t=>t<settings.minTemp||t>settings.maxTemp))throw Error('Kalibriertemperaturen liegen ausserhalb des Betriebsbereichs.');}
 function requireAfe(){if(active()&&!configured)throw Error('Zuerst Gesamtwiderstand messen und Temperatur-AFE einstellen.');if(active()&&(!observed||observed.hub<4000))throw Error('Zuerst P min und P max im AFE-Monitor aufnehmen.');const band=pressureBand();if(band&&(band.min< -25000||band.max>25000))throw Error('Erwarteter ADC_S über Temperatur überschreitet ±25’000 Digits. Druck-AFE anpassen.');}
 function pressureBand(){if(!active()||!configured||!observed||observed.hub<4000)return null;const mid=(observed.min+observed.max)/2,half=observed.hub/2,vals=[settings.minTemp,25,settings.maxTemp].flatMap(t=>[-1,1].map(sign=>mid+(t-25)*settings.tk0+sign*half*(1+(t-25)*settings.tke/1e6)));return {min:Math.min(...vals),max:Math.max(...vals)};}
 function update(t,stats){latest=t;if(active()&&configured){observed=stats?.count?stats:null;renderPlot();}}
 function renderPlot(){
  const el=$('gwPtcSvg'),label=$('gwPtcStats');if(!el||!active())return;
  if(!configured){el.textContent='Noch keine RPGA-Auswahl.';label.textContent='';return;}
  const {plan,code,p}=configured,sv=A.SUPPLY_LIMITS[p.svddCode],nom=A.SUPPLIES[p.svddCode],x=t=>55+(t-p.minTemp)/(p.maxTemp-p.minTemp)*420,y=d=>12+(32768-Math.max(-32768,Math.min(32768,d)))/65536*124;
  const samples=plan.samples.map(r=>({t:r.temp,lo:A.signal({resistanceOhm:r.max,svdd:sv[0],code}).adc,hi:A.signal({resistanceOhm:r.min,svdd:sv[1],code}).adc,nom:A.signal({resistanceOhm:r.nominal,svdd:nom,code}).adc}));
  const xy=(r,k)=>x(r.t)+','+y(r[k]),band=samples.map(r=>xy(r,'hi')).concat([...samples].reverse().map(r=>xy(r,'lo'))).join(' '),line=samples.map(r=>xy(r,'nom')).join(' '),g=A.rpga(code),limits=[Math.max(.425,g.minCurrent*g.i2u/1000),Math.min(1,g.maxCurrent*g.i2u/1000)].map(v=>(v-.65)*65536);
  el.innerHTML='<svg viewBox="0 0 490 160" width="100%" role="img" aria-label="ADC_T Modellprognose"><polygon points="'+band+'" fill="#d6a62a" opacity=".24"/>'+[-32768,0,32767].map(v=>'<line x1="55" x2="475" y1="'+y(v)+'" y2="'+y(v)+'" stroke="currentColor" opacity=".15"/><text x="50" y="'+(y(v)+3)+'" text-anchor="end" font-size="10" fill="currentColor">'+fmt(v)+'</text>').join('')+limits.map(v=>'<line x1="55" x2="475" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#d66a55" stroke-dasharray="4 3"/>').join('')+'<polyline points="'+line+'" stroke="#d6a62a" stroke-width="2" fill="none"/>'+(Number.isFinite(latest?.adcT)?'<circle cx="'+x(25)+'" cy="'+y(latest.adcT)+'" r="4.5" fill="#398aca"/>':'')+[p.minTemp,25,p.maxTemp].map(t=>'<text x="'+x(t)+'" y="153" font-size="10" fill="currentColor" text-anchor="middle">'+t+' °C</text>').join('')+'</svg>';
  const all=samples.flatMap(r=>[r.lo,r.hi]),pb=pressureBand();label.textContent='ADC_T prognostiziert: '+fmt(Math.min(...all))+' … '+fmt(Math.max(...all))+' Digits'+(pb?' · ADC_S mit TK0/TKE-Annahme: '+fmt(pb.min)+' … '+fmt(pb.max)+' Digits':' · Druckprognose nach Min/Max-Aufnahme');
 }
 window.ELMOS_PTC_DEV_UI={mount,active,refresh,validate,requireAfe,update,pressureBand};
})();