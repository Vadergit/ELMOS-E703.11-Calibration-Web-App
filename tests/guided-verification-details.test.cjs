'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const g=fs.readFileSync(path.join(__dirname,'../guided.js'),'utf8');
function harness(){
 const details={appendChild:n=>n.parentNode=details,insertBefore:n=>n.parentNode=details},alerts={hidden:false,appendChild:n=>n.parentNode=alerts};
 const message={parentNode:details,classList:{contains:k=>k==='error'&&message.error}},nodes={calRamMsg:message,gwVerifyDetails:details,gwVerifyStatuses:alerts,calVerifyList:{}};
 const start=g.indexOf(' function syncVerificationMessages(){'),end=g.indexOf(' function renderVerificationPlot(){',start);
 const sync=new Function('$',g.slice(start,end)+';return syncVerificationMessages;')(id=>nodes[id]);return {details,alerts,message,sync};
}
test('normal messages stay collapsed, actual errors appear directly and clear on recovery',()=>{const h=harness();h.sync();assert.equal(h.message.parentNode,h.details);assert.equal(h.alerts.hidden,true);h.message.error=true;h.sync();assert.equal(h.message.parentNode,h.alerts);assert.equal(h.alerts.hidden,false);h.message.error=false;h.sync();assert.equal(h.message.parentNode,h.details);assert.equal(h.alerts.hidden,true);});
test('original coverage, progress and status moved into closed details, original node restoration preserved',()=>{assert.match(g,/<details class="gw-verify-details"><summary>Prüfprotokoll und Hinweise/);assert.match(g,/\['calVerifyCoverage','calVerifyProgress','calRamMsg'\]\)moveId\(id,'gwVerifyDetails'\)/);assert.match(g,/if\(stage===6\)\{syncVerificationMessages\(\);renderVerificationPlot\(\);\}/);});
