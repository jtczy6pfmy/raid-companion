import test from 'node:test';
import assert from 'node:assert/strict';
import {levelCap,foodRequirements,planProgression,sortFoodCandidates} from '../progression-engine.js';
test('rank caps and invalid ranks',()=>{
 assert.equal(levelCap(6),60);
 assert.throws(()=>levelCap(7),RangeError);
});
test('food recursion builds lower rank ingredients correctly',()=>{
 assert.deepEqual(foodRequirements(2,3),{1:2,2:2});
 assert.deepEqual(foodRequirements(3,4),{1:6,2:6,3:3});
 assert.deepEqual(foodRequirements(5,6),{1:120,2:120,3:60,4:20,5:5});
 assert.deepEqual(foodRequirements(6,6),{});
});
test('progression produces ordered rank-ups and ascension',()=>{
 const result=planProgression({id:'a',name:'Example',rank:4,level:30,ascension:2},{targetRank:6,targetLevel:60,targetAscension:6});
 assert.deepEqual(result.steps.map(s=>s.type),['level','promote','level','promote','level','ascend']);
 assert.equal(result.steps[0].to,40);
 assert.equal(result.steps[1].foodCount,4);
 assert.equal(result.steps[3].foodCount,5);
});
test('food candidates protect marked champions and sort ascending',()=>{
 const rows=[{id:'a',name:'A',score:8},{id:'b',name:'B',score:1,locked:true},{id:'c',name:'C',score:3},{id:'d',name:'D',score:0,inFusion:true}];
 assert.deepEqual(sortFoodCandidates(rows,c=>c.score).map(x=>x.champion.id),['c','a']);
});
