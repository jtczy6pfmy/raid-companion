import test from 'node:test';import assert from 'node:assert/strict';
import {createWorkbenchSync} from '../site/workbench-sync.js';
const blank=()=>({version:1,inventory:{version:1,artifacts:[],sets:[]},loadouts:[],sessions:[]});
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)}};
test('successful cloud save clears pending only for the saved snapshot',async()=>{
 let state=blank(),remote=null,revision=0,status='';state.inventory.artifacts.push({id:'a',slot:'weapon',flat:{atk:10}});
 const sync=createWorkbenchSync({getState:()=>state,applyState:s=>{state=s;return true},status:s=>status=s,onConflict:()=>{},storage:storage(),loadCloud:async()=>({loaded:true,state:remote,revision,ownerId:'owner'}),saveCloud:async(s,expected)=>{assert.equal(expected,revision);remote=structuredClone(s);return {saved:true,revision:++revision}}});
 await sync.connect();assert.equal(remote.inventory.artifacts.length,1);assert.match(status,/synced/);await sync.sync();assert.equal(revision,1);sync.disconnect();
});
test('failed writes retain device records and report pending, not synced',async()=>{
 let state=blank(),status='';state.inventory.artifacts.push({id:'a',slot:'weapon',flat:{atk:10}});
 const sync=createWorkbenchSync({getState:()=>state,applyState:s=>{state=s;return true},status:s=>status=s,onConflict:()=>{},storage:storage(),loadCloud:async()=>({loaded:true,state:null,revision:0}),saveCloud:async()=>({saved:false,reason:'Offline'})});
 await sync.connect();assert.match(status,/Offline/);assert.equal(state.inventory.artifacts.length,1);sync.disconnect();
});
test('conflicts stop cloud writes until an explicit choice',async()=>{
 const base=blank();base.inventory.artifacts.push({id:'a',slot:'weapon',flat:{atk:10}});let state=structuredClone(base),remote=structuredClone(base),conflicts=null,saves=0;
 state.inventory.artifacts[0].flat.atk=20;remote.inventory.artifacts[0].flat.atk=30;
 const st=storage();st.setItem('raid-companion-workbench-cloud-v1',JSON.stringify({baseline:base,revision:1,pending:true}));
 const sync=createWorkbenchSync({getState:()=>state,applyState:s=>{state=s;return true},status:()=>{},onConflict:c=>conflicts=c,storage:st,loadCloud:async()=>({loaded:true,state:remote,revision:2}),saveCloud:async(s)=>{remote=s;saves++;return {saved:true,revision:3}}});
 await sync.connect();assert.equal(conflicts.length,1);assert.equal(saves,0);await sync.resolve('device');assert.equal(saves,1);assert.equal(remote.inventory.artifacts[0].flat.atk,20);sync.disconnect();
});
