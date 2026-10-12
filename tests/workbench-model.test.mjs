import test from 'node:test';import assert from 'node:assert/strict';
import {validateWorkbench,mergeWorkbench} from '../site/workbench-model.js';
const blank=()=>({version:1,inventory:{version:1,artifacts:[],sets:[]},loadouts:[],sessions:[]});
test('backup restore adds missing artifacts without overwriting current pieces',()=>{const live=blank(),backup=blank();live.inventory.artifacts.push({id:'a',slot:'weapon',flat:{atk:100}});backup.inventory.artifacts.push({id:'a',slot:'weapon',flat:{atk:1}},{id:'b',slot:'boots',flat:{spd:20}});const merged=mergeWorkbench(live,backup);assert.equal(merged.state.inventory.artifacts[0].flat.atk,100);assert.equal(merged.added.artifacts,1);assert.equal(mergeWorkbench(merged.state,backup).added.artifacts,0)});
test('malformed sessions and duplicate plans reject the complete backup',()=>{const backup=blank();backup.sessions.push({id:'bad',name:'Bad',results:[]});assert.throws(()=>validateWorkbench(backup))});
import {reconcileWorkbench,resolveWorkbenchConflicts} from '../site/workbench-model.js';
test('three-way sync keeps independent changes and flags conflicting artifact edits',()=>{
 const base=blank();base.inventory.artifacts=[{id:'a',slot:'weapon',flat:{atk:10}}];
 const local=structuredClone(base),remote=structuredClone(base);local.inventory.artifacts[0].flat.atk=20;remote.inventory.artifacts.push({id:'b',slot:'boots',flat:{spd:10}});
 const merge=reconcileWorkbench(base,local,remote);assert.equal(merge.conflicts.length,0);assert.equal(merge.state.inventory.artifacts.length,2);assert.equal(merge.state.inventory.artifacts[0].flat.atk,20);
 remote.inventory.artifacts[0].flat.atk=30;const conflict=reconcileWorkbench(base,local,remote);assert.equal(conflict.conflicts.length,1);assert.equal(resolveWorkbenchConflicts(conflict,'cloud').inventory.artifacts.find(a=>a.id==='a').flat.atk,30);
});
