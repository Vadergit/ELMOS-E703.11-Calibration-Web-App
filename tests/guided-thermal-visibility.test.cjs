'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../guided-plan.js');
test('quick ignores a previous thermal source and disables thermal compensation',()=>{assert.equal(P.temperatureCompensationEnabled(1,'simple',0),false);assert.equal(P.create({...P.presets.quick,temperatures:[25]}).tempComp,false)});
test('thermal visibility follows actual fit order, including expert plans',()=>{assert.equal(P.temperatureCompensationEnabled(2,'simple',1),true);assert.equal(P.temperatureCompensationEnabled(3,'advanced',0),false);assert.equal(P.temperatureCompensationEnabled(3,'advanced',2),true)});
