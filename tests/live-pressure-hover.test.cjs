const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('pressure card is the tooltip trigger without a question-mark button',()=>{
 const html=read('index.html'),app=read('app.js'),css=read('interface.css');
 const card=html.match(/<div class="live-kpi live-kpi-primary" id="livePressureCard"[^>]*>.*?<\/div>/s)?.[0];
 assert.ok(card);assert.doesNotMatch(card,/<button|livePressureInfo/);
 assert.match(card,/aria-describedby="livePressureTooltip"/);
 assert.match(card,/id="livePressureTooltip"[^>]*role="tooltip" hidden/);
 assert.match(html,/#livePressureCard\.has-pressure-details:hover > \.live-pressure-tooltip/);
 assert.match(html,/#livePressureCard\.has-pressure-details:focus-visible > \.live-pressure-tooltip/);
 assert.match(css,/#livePressureTooltip\{position:absolute;pointer-events:none\}/);
 assert.doesNotMatch(css,/\.live-pressure-meta|\.live-pressure-info/);
 assert.doesNotMatch(app,/livePressureInfo/);
 assert.match(app,/pressureCard\.classList\.toggle\('has-pressure-details',connected\)/);
 assert.match(app,/tooltip\.hidden=!connected/);
 assert.match(app,/pressureCard\.setAttribute\('tabindex','0'\)/);
 assert.match(app,/pressureCard\.removeAttribute\('tabindex'\)/);
 assert.match(app,/AODO-Endwert: /);assert.match(app,/Verwendeter DSP-Endwert: /);
});
