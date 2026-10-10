import {test} from 'node:test';
import assert from 'node:assert/strict';
import {numberOrNull,statsFor,filterChampions,compareStats,targetProgress,resolveChampion,runSummary,sessionEstimate} from '../site/companion-model.js';
test('missing stats stay unknown and formatted CSV numbers parse',()=>{
 assert.equal(numberOrNull('19,011'),19011);assert.equal(numberOrNull('71%'),71);assert.equal(numberOrNull(''),null);assert.equal(numberOrNull('-1'),null);
 assert.equal(statsFor({name:'Kael'}).hp,null);assert.equal(statsFor({name:'Cheshire Cat'}).hp,19222);
 assert.equal(statsFor({name:'Cheshire Cat',import_data:{values:{'Total SPD':'200'}}}).hp,null);
});
test('filters combine metadata and leveling; missing stats sort last',()=>{
 const rows=[{name:'A',rank:5,level:40,import_data:{values:{Rarity:'Rare',Affinity:'Magic',Faction:'Elves','Total SPD':'100'}}},{name:'B',rank:5,level:50,import_data:{values:{Rarity:'Rare','Total SPD':'200'}}},{name:'C',rank:3,level:20}];
 assert.deepEqual(filterChampions(rows,{rarity:'Rare',affinity:'Magic',rank:'5',leveling:true}).map(r=>r.name),['A']);
 assert.deepEqual(filterChampions(rows,{sort:'spd'}).map(r=>r.name),['B','A','C']);
});
test('comparisons and target gaps never treat an unknown stat as zero',()=>{
 const stats=statsFor({name:'A',import_data:{values:{'Total SPD':'100'}}});
 assert.equal(compareStats(stats,statsFor({name:'B'})).find(r=>r.key==='spd').delta,null);
 assert.deepEqual(targetProgress(stats,{spd:150,hp:20000}).map(r=>[r.key,r.gap,r.met]),[['hp',null,false],['spd',50,false]]);
});
test('saved references restore individual imported copies without conflating duplicates',()=>{
 const rows=[{id:'new1',name:'Incubus',import_key:'copy1'},{id:'new2',name:'Incubus',import_key:'copy2'}];
 assert.equal(resolveChampion({id:'old',importKey:'copy2',name:'Incubus'},rows).id,'new2');
 assert.equal(resolveChampion({name:'Incubus'},rows),null);
});
test('battle metrics use victories for times and all battles for win rate and energy',()=>{
 assert.deepEqual(runSummary([{result:'Victory',seconds:100,energy:16},{result:'Victory',seconds:140,energy:16},{result:'Defeat',seconds:20,energy:16}]),{count:3,wins:2,winRate:200/3,average:120,best:100,energy:48});
 assert.equal(runSummary([]).winRate,null);assert.deepEqual(sessionEstimate(20,16,60),{energy:320,seconds:1200});assert.throws(()=>sessionEstimate(1.5,16,60));
});
