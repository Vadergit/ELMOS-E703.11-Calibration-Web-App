'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const live=require('../live-polling.js');

test('existing polling intervals remain unchanged',()=>{
 const pace=live.create();
 for(const ms of [400,650,1000,1500,2000]){
  assert.equal(pace.delay(ms),ms);
  pace.observe(false,1700);
  assert.equal(pace.delay(ms),ms);
 }
 assert.equal(pace.delay(9999),650);
});

test('opt-in 250 ms mode starts fast and backs off on repeated slow reads',()=>{
 const pace=live.create();
 assert.equal(pace.delay(250),250);
 pace.observe(true,680);
 assert.equal(pace.delay(250),250);
 pace.observe(true,720);
 assert.equal(pace.delay(250),400);
 pace.observe(true,800);
 pace.observe(true,710);
 assert.equal(pace.delay(250),650);
});

test('single extremely slow read activates safer 650 ms interval',()=>{
 const pace=live.create();
 pace.observe(true,1250);
 assert.equal(pace.delay(250),650);
 assert.equal(pace.snapshot(250).backoffLevel,2);
 assert.equal(pace.snapshot(250).lastReadMs,1250);
});

test('errors trigger longer pause and healthy responses restore speed gradually',()=>{
 const pace=live.create();
 pace.observe(false,1600);
 assert.equal(pace.delay(250),650);
 for(let i=0;i<10;i++)pace.observe(true,210);
 assert.equal(pace.delay(250),400);
 for(let i=0;i<10;i++)pace.observe(true,200);
 assert.equal(pace.delay(250),250);
});

test('reset restores fast mode without disturbing other settings',()=>{
 const pace=live.create();
 pace.observe(false,1600);
 assert.equal(pace.delay(250),650);
 pace.reset();
 assert.equal(pace.delay(250),250);
 assert.equal(pace.delay(400),400);
 assert.equal(pace.snapshot(250).lastReadMs,null);
});

test('a read that is not measured does not alter selected delay',()=>{
 const pace=live.create();
 pace.observe(true,null);
 assert.equal(pace.delay(250),250);
 pace.observe(true,NaN);
 assert.equal(pace.delay(250),250);
});
