import test from 'node:test';
import assert from 'node:assert/strict';
import {validateInventory,calculateBuild,optimiseArtifacts,SLOTS,STAT_KEYS} from '../site/artifact-engine.js';
const base=Object.fromEntries(STAT_KEYS.map(k=>[k,100]));
const artifacts=SLOTS.map(slot=>({id:slot,slot,flat:{spd:1},set:'Speed'}));
test('inventory rejects duplicate IDs and invalid bonus values',()=>{
 assert.throws(()=>validateInventory({version:1,artifacts:[artifacts[0],artifacts[0]]}));
 assert.throws(()=>validateInventory({version:1,artifacts:[{...artifacts[0],flat:{spd:NaN}}]}));
});
test('base percentage bonuses and repeated set bonuses are calculated once',()=>{
 const inv=validateInventory({version:1,artifacts,sets:[{name:'Speed',pieces:2,percent:{spd:12}}]});
 assert.equal(calculateBuild(base,inv.artifacts,inv.sets).stats.spd,142);
});
test('optimizer selects feasible targets and excludes locked and occupied gear',()=>{
 const inv=validateInventory({version:1,artifacts:[...artifacts,{id:'better',slot:'boots',flat:{spd:30}},{id:'locked',slot:'boots',flat:{spd:100},locked:true},{id:'taken',slot:'boots',flat:{spd:200},equippedTo:'someone'}]});
 const r=optimiseArtifacts({inventory:inv,base,targets:{spd:120},weights:{spd:1}});
 assert.equal(r.examined,2);assert.equal(r.results[0].meetsTargets,true);assert.equal(r.results[0].stats.spd,135);assert.equal(r.results[0].artifactIds[5],'better');
});
test('large searches are rejected rather than silently returning partial best builds',()=>{
 const inv=validateInventory({version:1,artifacts:SLOTS.flatMap(slot=>Array.from({length:10},(_,i)=>({id:slot+i,slot,flat:{}})))});
 const r=optimiseArtifacts({inventory:inv,base});assert.equal(r.truncated,true);assert.equal(r.examined,0);
});
