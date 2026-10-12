import {validateInventory,calculateBuild,STAT_KEYS} from './artifact-engine.js';
import {planSession,recordSessionRun} from './session-engine.js';
export function validateWorkbench(raw){
 if(!raw||raw.version!==1||!Array.isArray(raw.loadouts)||!Array.isArray(raw.sessions)||raw.loadouts.length>10000||raw.sessions.length>10000)throw Error('Invalid workbench backup.');
 const inventory=validateInventory(raw.inventory),ids=new Set();
 function id(record){if(!record||typeof record.id!=='string'||!record.id||ids.has(record.id))throw Error('Invalid or duplicate plan ID.');ids.add(record.id)}
 const loadouts=raw.loadouts.map(p=>{
  id(p);if(typeof p.championId!=='string'||typeof p.championName!=='string'||!p.build||!Array.isArray(p.build.artifactIds)||p.build.artifactIds.length!==6||new Set(p.build.artifactIds).size!==6||p.build.artifactIds.some(x=>typeof x!=='string'))throw Error('Invalid saved loadout.');
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
