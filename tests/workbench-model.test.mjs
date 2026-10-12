import test from 'node:test';import assert from 'node:assert/strict';
import {validateWorkbench,mergeWorkbench} from '../site/workbench-model.js';
const blank=()=>({version:1,inventory:{version:1,artifacts:[],sets:[]},loadouts:[],sessions:[]});
test('backup restore adds missing artifacts without overwriting current pieces',()=>{const live=blank(),backup=blank();live.inventory.artifacts.push({id:'a',slot:'weapon',flat:{atk:100}});backup.inventory.artifacts.push({id:'a',slot:'weapon',flat:{atk:1}},{id:'b',slot:'boots',flat:{spd:20}});const merged=mergeWorkbench(live,backup);assert.equal(merged.state.inventory.artifacts[0].flat.atk,100);assert.equal(merged.added.artifacts,1);assert.equal(mergeWorkbench(merged.state,backup).added.artifacts,0)});
test('malformed sessions and duplicate plans reject the complete backup',()=>{const backup=blank();backup.sessions.push({id:'bad',name:'Bad',results:[]});assert.throws(()=>validateWorkbench(backup))});
