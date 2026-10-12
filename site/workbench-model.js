import {validateInventory,calculateBuild,STAT_KEYS} from './artifact-engine.js?v=20261012-3';
import {planSession,recordSessionRun} from './session-engine.js?v=20261012-3';
export function validateWorkbench(raw){
 if(!raw||raw.version!==1||!Array.isArray(raw.loadouts)||!Array.isArray(raw.sessions)||raw.loadouts.length>10000||raw.sessions.length>10000)throw Error('Invalid workbench backup.');
 const inventory=validateInventory(raw.inventory),ids=new Set();
 function id(record){if(!record||typeof record.id!=='string'||!record.id||ids.has(record.id))throw Error('Invalid or duplicate plan ID.');ids.add(record.id)}
 const loadouts=raw.loadouts.map(p=>{
  id(p);if(typeof p.championId!=='string'||typeof p.championName!=='string'||!p.build||!Array.isArray(p.build.artifactIds)||![6,9].includes(p.build.artifactIds.length)||new Set(p.build.artifactIds).size!==p.build.artifactIds.length||p.build.artifactIds.some(x=>typeof x!=='string'))throw Error('Invalid saved loadout.');
  calculateBuild(p.base,[],[]);calculateBuild(p.build.stats,[],[]);
  for(const field of ['targets','weights'])if(!p[field]||Object.entries(p[field]).some(([k,n])=>!STAT_KEYS.includes(k)||!Number.isFinite(n)||n<0||n>10000000))throw Error('Invalid loadout targets.');
  return structuredClone(p);
 });
 const sessions=raw.sessions.map(s=>{
  id(s);if(typeof s.name!=='string'||typeof s.dungeon!=='string'||!Number.isInteger(s.stage)||s.stage<1||s.stage>100||!Array.isArray(s.results)||!s.plan)throw Error('Invalid session.');
  // Stored plan duration and expenditure must match the original inputs.
  const plan=planSession({runs:s.plan.requestedRuns,energyPerRun:s.energyPerRun,secondsPerRun:s.secondsPerRun,energyBudget:s.plan.energy});
  if(plan.runs!==s.plan.runs||plan.seconds!==s.plan.seconds)throw Error('Invalid session totals.');
  let result={...structuredClone(s),results:[]};for(const r of s.results)result=recordSessionRun(result,r);return result;
 });
 return {version:1,inventory,loadouts,sessions};
}
export function mergeWorkbench(current,incoming){
 const live=validateWorkbench(current),backup=validateWorkbench(incoming);
 function missing(a,b,key){const existing=new Set(a.map(r=>r[key]));return b.filter(r=>!existing.has(r[key]))}
 const artifacts=missing(live.inventory.artifacts,backup.inventory.artifacts,'id'),sets=missing(live.inventory.sets,backup.inventory.sets,'name'),loadouts=missing(live.loadouts,backup.loadouts,'id'),sessions=missing(live.sessions,backup.sessions,'id');
 const state=validateWorkbench({version:1,inventory:{version:1,artifacts:[...live.inventory.artifacts,...artifacts],sets:[...live.inventory.sets,...sets]},loadouts:[...live.loadouts,...loadouts],sessions:[...live.sessions,...sessions]});
 return {state,added:{artifacts:artifacts.length,sets:sets.length,loadouts:loadouts.length,sessions:sessions.length}};
}

export function reconcileWorkbench(baseline,local,remote){
 const base=validateWorkbench(baseline),device=validateWorkbench(local),cloud=validateWorkbench(remote),conflicts=[];
 const canonical=value=>JSON.stringify(normalize(value));
 function normalize(value){if(Array.isArray(value))return value.map(normalize);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,normalize(value[k])]));return value}
 function merge(kind,b,l,r,key){
  const bm=new Map(b.map(x=>[x[key],x])),lm=new Map(l.map(x=>[x[key],x])),rm=new Map(r.map(x=>[x[key],x])),merged=[];
  for(const id of new Set([...bm.keys(),...lm.keys(),...rm.keys()])){
   const old=bm.get(id),device=lm.get(id),cloud=rm.get(id);
   let selected;
   if(canonical(device)===canonical(old))selected=cloud;
   else if(canonical(cloud)===canonical(old)||canonical(device)===canonical(cloud))selected=device;
   else{conflicts.push({kind,id,device,cloud});selected=device}
   if(selected)merged.push(structuredClone(selected));
  }
  return merged;
 }
 const state={version:1,inventory:{version:1,artifacts:merge('artifacts',base.inventory.artifacts,device.inventory.artifacts,cloud.inventory.artifacts,'id'),sets:merge('sets',base.inventory.sets,device.inventory.sets,cloud.inventory.sets,'name')},loadouts:merge('loadouts',base.loadouts,device.loadouts,cloud.loadouts,'id'),sessions:merge('sessions',base.sessions,device.sessions,cloud.sessions,'id')};
 return {state:validateWorkbench(state),conflicts};
}
export function resolveWorkbenchConflicts(merged,choice){
 if(!['device','cloud'].includes(choice))throw Error('Choose device or cloud records.');
 const state=structuredClone(merged.state);
 for(const conflict of merged.conflicts){const rows=['artifacts','sets'].includes(conflict.kind)?state.inventory[conflict.kind]:state[conflict.kind],key=conflict.kind==='sets'?'name':'id',index=rows.findIndex(r=>r[key]===conflict.id);if(index>=0)rows.splice(index,1);const record=conflict[choice];if(record)rows.push(structuredClone(record))}
 return validateWorkbench(state);
}
