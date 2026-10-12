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
test('large searches return clearly labeled approximate builds',()=>{
 const inv=validateInventory({version:1,artifacts:SLOTS.flatMap(slot=>Array.from({length:10},(_,i)=>({id:slot+i,slot,flat:{}})))});
 const r=optimiseArtifacts({inventory:inv,base});assert.equal(r.truncated,true);assert.equal(r.approximate,true);assert.ok(r.examined>0);assert.ok(r.results.length>0);
});

test('accessories require faction compatibility and all nine slots',()=>{
 const items=[...artifacts,...['ring','amulet','banner'].map(slot=>({id:slot,slot,faction:'High Elves',flat:{hp:10}}))];
 const inv=validateInventory({version:1,artifacts:items});
 assert.deepEqual(optimiseArtifacts({inventory:inv,base,includeAccessories:true,championFaction:'Dark Elves'}).missing,['ring','amulet','banner']);
 const r=optimiseArtifacts({inventory:inv,base,includeAccessories:true,championFaction:'High Elves'});assert.equal(r.results[0].artifactIds.length,9);assert.equal(r.results[0].stats.hp,130);
});
test('pins, maximum targets and required sets constrain searches',()=>{
 const inv=validateInventory({version:1,artifacts:[...artifacts,{id:'fast',slot:'boots',flat:{spd:100}}],sets:[{name:'Speed',pieces:2,percent:{spd:12}}]});
 const r=optimiseArtifacts({inventory:inv,base,maxTargets:{spd:150},requiredSets:{Speed:3}});assert.equal(r.results[0].artifactIds[5],'boots');assert.equal(r.results[0].meetsTargets,true);
 const pinned=optimiseArtifacts({inventory:inv,base,pinnedIds:['fast'],maxTargets:{spd:150}});assert.equal(pinned.results[0].meetsTargets,false);assert.equal(pinned.results[0].artifactIds[5],'fast');
 assert.throws(()=>optimiseArtifacts({inventory:inv,base,pinnedIds:['fast','boots']}));
});
