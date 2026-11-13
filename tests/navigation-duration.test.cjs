'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../test-logger-core.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('test duration supports seconds minutes hours and unlimited mode',()=>{
 assert.equal(C.durationMs('0','s'),null);
 assert.equal(C.durationMs('0','h'),null);
 assert.equal(C.durationMs('2.5','min'),150000);
 assert.equal(C.durationMs('1.25','h'),4500000);
 assert.equal(C.durationMs('0.1','s'),100);
 assert.equal(C.durationMs('30','h'),108000000);
});
test('invalid, unrealistic or overflowing durations cannot start',()=>{
 for(const value of ['',null,undefined,-1,'abc',Infinity,'NaN'])
  assert.throws(()=>C.durationMs(value,'s'));
 assert.throws(()=>C.durationMs('1','unknown'));
 assert.throws(()=>C.durationMs('0.01','s'));
 assert.throws(()=>C.durationMs('31','day'));
 assert.throws(()=>C.durationMs('100000','h'));
});
test('archive and verification have separate top-level buttons and archive-only results view',()=>{
 const html=read('index.html'),archive=read('archive.js');
 assert.match(html,/id="archiveOpen"[^>]+>▤ Archiv<\/button>/);
 assert.match(html,/id="verificationOpen"[^>]+>↕ Nachmessung<\/button>/);
 assert.match(archive,/S\.view=view==='verification'\?'verification':'archive'/);
 assert.match(archive,/arResults.*hidden=S\.view!=='archive'/);
 assert.match(archive,/arPlanner.*hidden=.*S\.view!=='verification'/);
 assert.match(archive,/verificationOpen.*addEventListener/);
 assert.match(archive,/text\('arViewTitle',S\.view==='verification'/);
});
test('classic logger accessible after EEPROM Viewer and never blocked by calibration step gate',()=>{
 const html=read('index.html'),app=read('app.js'),guided=read('guided.js');
 const viewer=html.indexOf('<span>EEPROM Viewer</span></button>');
 const logger=html.indexOf('<span>Test / Logging</span></button>',viewer);
 assert.ok(viewer>0&&logger>viewer);
 assert.match(html,/data-step="8"/);
 assert.match(html,/data-panel="8" hidden/);
 assert.match(html,/id="classicLoggerHost"/);
 assert.match(app,/if\(n===8\)return ''/);
 assert.match(app,/Math\.min\(8,Number\(n\)\)/);
 assert.match(app,/window\.ELMOS_TEST_LOGGER\?\.isBusy\(\)/);
 assert.match(guided,/stage=loggingActive\?10:0/);
});
test('guided and classic share same logger instance, retaining inputs and active run',()=>{
 const logger=read('test-logger.js'),guided=read('guided.js'),compact=read('compact.js');
 assert.match(logger,/const target=typeof host==='string'\?\$\(host\):host/);
 assert.match(logger,/target\.replaceChildren\(\.\.\.Array\.from\(S\.root\.childNodes\)\)/);
 assert.match(logger,/mount\(\$\('classicLoggerHost'\)\)/);
 assert.match(guided,/ELMOS_TEST_LOGGER\?\.mount\(\$\('gwLogPage'\)\)/);
 assert.match(compact,/ELMOS_TEST_LOGGER\?\.isBusy/);
});
test('timer auto-stop is monotonic, pause-aware and preserves current capture',()=>{
 const logger=read('test-logger.js');
 assert.match(logger,/activeAccumulatedMs/);
 assert.match(logger,/activeStartedMono/);
 assert.match(logger,/function armDurationTimer\(\)/);
 assert.match(logger,/Math\.min\(Math\.ceil\(ms\),2147483647\)/);
 assert.match(logger,/void stop\('completed','duration'\)/);
 assert.match(logger,/clearDurationTimer\(\)/);
 assert.match(logger,/if\(S\.pending\)await S\.pending/);
 assert.match(logger,/completionReason:reason/);
 assert.match(logger,/id="tlDuration"/);
 assert.match(logger,/id="tlDurationUnit"/);
 assert.match(logger,/id="tlRemaining"/);
 assert.match(read('index.html'),/data-app-version="0\.7\.6"/);
});
