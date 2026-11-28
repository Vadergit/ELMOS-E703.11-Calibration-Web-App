'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','archive.js'),'utf8');
const a=source.indexOf(' const PROFILE_FILE='),b=source.indexOf(' let profile=null',a);
const normalize=new Function(source.slice(a,b)+';return normalizePersonalProfile;')();
const wrap=defaults=>({schema:1,kind:'elmos-personal-profile',defaults});
test('profile whitelists metadata and ignores sensor configuration',()=>{
 assert.deepEqual(normalize(wrap({operator:' Prüfer ',location:'Labor',uid:'sensor',calibration:{nvm:true}})),wrap({operator:'Prüfer',location:'Labor',project:'',instrumentCertificate:''}));
});
test('invalid or unrelated JSON is rejected',()=>{
 assert.throws(()=>normalize({schema:1,defaults:{operator:'A'}}));
 assert.throws(()=>normalize(wrap({operator:123})));
});
test('optional values and size limits',()=>{
 assert.equal(normalize(wrap({operator:'x'.repeat(200)})).defaults.operator.length,120);
 assert.equal(normalize(wrap({})).defaults.location,'');
});