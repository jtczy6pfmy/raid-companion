import test from 'node:test';
import assert from 'node:assert/strict';
import {xpBetween,productionPlan,campaignEstimate,foodCandidates,foodRunEstimate} from '../site/leveling-engine.js';
const dorothy={id:'dorothy',name:'Dorothy',rank:5,level:50,ascension:0};
const target={targetRank:6,targetLevel:60,targetAscension:0};
const food=(rank,n,level=1)=>Array.from({length:n},(_,i)=>({id:rank+'-'+i,name:'Food '+i,rank,level}));
test('rank-specific XP totals match published reference for all six ranks',()=>{
 assert.deepEqual([1,2,3,4,5,6].map(r=>xpBetween(r,1,r*10)),[22761,81326,200681,449082,963806,2010669]);
 assert.equal(xpBetween(1,1,2,100),797);assert.equal(xpBetween(6,59,60),148828);
 assert.throws(()=>xpBetween(1,1,2,897),RangeError);assert.throws(()=>xpBetween(6,60,60,1),RangeError);
});
test('Dorothy roadmap counts bases and sacrifices separately at every rank',()=>{
 const p=productionPlan(dorothy,target);assert.equal(p.acquireCount,600);
 assert.deepEqual(p.steps.map(s=>[s.baseCount,s.fromRank,s.sacrificeCount,s.outputCount,s.toRank]),[[300,1,300,300,2],[100,2,200,100,3],[25,3,75,25,4],[5,4,20,5,5]]);
 assert.equal(p.mainXp,2010669);assert.equal(p.allocation[5].sacrifices,5);
});
test('starting with two-star champions skips one-star production',()=>{
 const p=productionPlan(dorothy,target,{startingRank:2});assert.equal(p.acquireCount,300);assert.equal(p.steps[0].fromRank,2);
 const first=productionPlan({id:'one',name:'One',rank:1,level:10,ascension:0},{targetRank:2,targetLevel:20,targetAscension:0},{startingRank:2});assert.equal(first.acquireCount,1);assert.equal(first.startingRank,1);
});
test('five ready five-star copies eliminate all food-building XP',()=>{
 const p=productionPlan(dorothy,target,{food:food(5,5)});assert.equal(p.acquireCount,0);assert.equal(p.steps.length,0);assert.equal(p.foodXp,0);assert.equal(p.usedCount,5);
});
test('mixed existing ranks are deducted once without reusing a copy',()=>{
 const p=productionPlan(dorothy,target,{food:[...food(5,2),...food(4,15,40)]});
 assert.equal(p.acquireCount,0);assert.deepEqual(p.steps.map(s=>[s.outputCount,s.toRank]),[[3,5]]);assert.equal(p.foodXp,0);assert.equal(p.usedCount,17);
});
test('chickens replace sacrifices but never promotion bases',()=>{
 const p=productionPlan(dorothy,target,{chickens:{1:9999,2:9999,3:9999,4:9999}});
 assert.equal(p.acquireCount,5);assert.equal(p.steps[0].baseCount,5);assert.equal(p.allocation[1].chickensUsed,5);
 const done=productionPlan(dorothy,target,{chickens:{5:5}});assert.equal(done.acquireCount,0);assert.equal(done.steps.length,0);
});
test('already-leveled bases reduce food XP and duplicate copy IDs reject',()=>{
 const p=productionPlan(dorothy,target,{food:food(4,25,40)});assert.equal(p.foodXp,0);
 assert.throws(()=>productionPlan(dorothy,target,{food:[food(4,1)[0],food(4,1)[0]]}),/twice/);
});
test('same-rank targets need no food and respect partial XP',()=>{
 const p=productionPlan({...dorothy,rank:6,level:59},{...target,xpIntoLevel:100});assert.equal(p.mainXp,148728);assert.equal(p.acquireCount,0);
});
test('campaign estimates round up runs and down affordable runs',()=>{
 const p=campaignEstimate(8653,{xpPerChampion:8652,energyPerRun:8,secondsPerRun:10,energyBudget:15});assert.equal(p.runs,2);assert.equal(p.energy,16);assert.equal(p.affordableRuns,1);assert.equal(p.energyShortfall,1);
 assert.equal(campaignEstimate(0).runs,0);assert.throws(()=>campaignEstimate(100,{xpPerChampion:0}),RangeError);
});
test('food estimates batch multiple bases and preserve rank boundaries',()=>{
 const p=productionPlan(dorothy,target,{food:food(4,25)});
 const x=foodRunEstimate(p,{xpPerChampion:8652,energyPerRun:8,secondsPerRun:20,energyBudget:0},3);
 assert.equal(x.runs,104);assert.equal(x.energy,832);
});
test('lowest rarity and rank are suggested first; all protections are honored',()=>{
 const rows=[{id:'a',name:'A',rank:2,level:1,rarity:'Common'},{id:'b',name:'B',rank:1,level:1,rarity:'Common'},{id:'c',name:'C',rank:1,level:1,rarity:'Uncommon'},...['locked','isFavorite','protected','inFusion','factionGuardian'].map((flag,i)=>({id:'p'+i,name:'P'+i,rank:1,level:1,rarity:'Common',[flag]:true})),{id:'epic',name:'Epic',rank:1,level:1,rarity:'Epic'},{id:'team',name:'Team',rank:1,level:1,rarity:'Common'},{id:'fusion',name:'Fusion',rank:1,level:1,rarity:'Common'}];
 assert.deepEqual(foodCandidates(rows,{teamIds:['team'],reservedNames:['Fusion']}).map(c=>c.id),['b','a','c']);
 assert.equal(foodCandidates([{id:'ref',name:'Militia',rank:2,level:1}],{reference:{militia:{rarity:'Uncommon'}}}).length,1);
});
