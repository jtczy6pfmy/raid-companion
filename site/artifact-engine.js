// Deterministic optimisation of user-supplied artifact bonuses. No game writes.
export const STAT_KEYS=['hp','atk','def','spd','critRate','critDamage','res','acc'];
export const SLOTS=['weapon','helmet','shield','gloves','chest','boots'];
export const ACCESSORY_SLOTS=['ring','amulet','banner'];
export const ALL_SLOTS=[...SLOTS,...ACCESSORY_SLOTS];
const PERCENT_KEYS=['hp','atk','def','spd'];
function values(raw,keys,label){
 if(raw===undefined)return {};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error(label+' must be a stat object.');
 const result={};
 for(const [key,value] of Object.entries(raw)){
  if(!keys.includes(key)||typeof value!=='number'||!Number.isFinite(value)||value<0||value>10000000)throw Error('Invalid '+label+' stat: '+key);
  result[key]=value;
 }
 return result;
}
export function validateInventory(data){
 if(!data||data.version!==1||!Array.isArray(data.artifacts)||data.artifacts.length>5000)throw Error('Use a version 1 artifact inventory with at most 5,000 artifacts.');
 const ids=new Set();
 const artifacts=data.artifacts.map((a,i)=>{
  if(!a||typeof a.id!=='string'||!a.id.trim()||ids.has(a.id)||!ALL_SLOTS.includes(a.slot))throw Error('Invalid or duplicate artifact at row '+(i+1));
  ids.add(a.id);
  if(a.equippedTo!=null&&typeof a.equippedTo!=='string')throw Error('equippedTo must be a champion copy ID.');
  return {id:a.id,name:typeof a.name==='string'?a.name.slice(0,120):a.id,slot:a.slot,set:typeof a.set==='string'?a.set.slice(0,80):'',faction:typeof a.faction==='string'?a.faction.trim().slice(0,100):'',locked:a.locked===true,equippedTo:a.equippedTo||null,flat:values(a.flat,STAT_KEYS,'flat'),percent:values(a.percent,PERCENT_KEYS,'percent')};
 });
 if(data.sets!==undefined&&(!Array.isArray(data.sets)||data.sets.length>1000))throw Error('Set definitions must be an array of at most 1,000 entries.');
 const setIds=new Set();
 const sets=(data.sets||[]).map(s=>{
  if(!s||typeof s.name!=='string'||!s.name||setIds.has(s.name)||!Number.isInteger(s.pieces)||s.pieces<1||s.pieces>9)throw Error('Invalid or duplicate set definition.');
  setIds.add(s.name);return {name:s.name,pieces:s.pieces,flat:values(s.flat,STAT_KEYS,'set flat'),percent:values(s.percent,PERCENT_KEYS,'set percent')};
 });
 return {version:1,artifacts,sets};
}
export function calculateBuild(base,artifacts,sets=[]){
 const stats={...base},flat={},percent={},counts={};
 function add(source){for(const k of STAT_KEYS)flat[k]=(flat[k]||0)+(source.flat?.[k]||0);for(const k of PERCENT_KEYS)percent[k]=(percent[k]||0)+(source.percent?.[k]||0)}
 for(const artifact of artifacts){add(artifact);if(artifact.set)counts[artifact.set]=(counts[artifact.set]||0)+1}
 const activeSets=[];
 for(const set of sets){const n=Math.floor((counts[set.name]||0)/set.pieces);if(n){activeSets.push({name:set.name,count:n});for(let i=0;i<n;i++)add(set)}}
 for(const k of STAT_KEYS){if(!Number.isFinite(base[k])||base[k]<0)throw Error('Enter every unequipped stat before optimising.');stats[k]=Math.round((base[k]*(1+(percent[k]||0)/100)+(flat[k]||0))*100)/100}
 return {stats,activeSets};
}
export function optimiseArtifacts({inventory,base,targets={},maxTargets={},weights={},requiredSets={},pinnedIds=[],championId='',championFaction='',includeAccessories=false,allowEquipped=false,maxCombinations=200000,limit=10,beamWidth=256}){
 calculateBuild(base,[],[]);
 for(const group of [targets,maxTargets,weights])values(group,STAT_KEYS,'search');
 for(const [name,n] of Object.entries(requiredSets))if(!inventory.sets.some(s=>s.name===name)||!Number.isInteger(n)||n<1||n>9)throw Error('Required sets must have defined bonuses and positive counts.');
 for(const k of STAT_KEYS)if(Number.isFinite(targets[k])&&Number.isFinite(maxTargets[k])&&targets[k]>maxTargets[k])throw Error('Minimum exceeds maximum for '+k);
 const slots=includeAccessories?ALL_SLOTS:SLOTS,pinned=new Map();
 for(const id of pinnedIds){const a=inventory.artifacts.find(a=>a.id===id);if(!a||!slots.includes(a.slot)||pinned.has(a.slot))throw Error('Pin one existing artifact per selected slot.');pinned.set(a.slot,id)}
 const missing=[],groups=slots.map(slot=>{
  const group=inventory.artifacts.filter(a=>a.slot===slot&&!a.locked&&(!a.faction||a.faction===championFaction)&&(!pinned.has(slot)||pinned.get(slot)===a.id)&&(allowEquipped||!a.equippedTo||a.equippedTo===championId));
  if(!group.length)missing.push(slot);return group;
 });
 if(missing.length)return {results:[],examined:0,total:0,truncated:false,approximate:false,missing};
 const total=groups.reduce((n,g)=>n*g.length,1);
 let examined=0;const results=[];
 function candidate(path){
  const build=calculateBuild(base,path,inventory.sets);
  const gaps=[];
  for(const k of STAT_KEYS){if(Number.isFinite(targets[k])&&build.stats[k]<targets[k])gaps.push({stat:k,gap:targets[k]-build.stats[k],target:targets[k],direction:'below'});if(Number.isFinite(maxTargets[k])&&build.stats[k]>maxTargets[k])gaps.push({stat:k,gap:build.stats[k]-maxTargets[k],target:maxTargets[k],direction:'above'})}
  for(const [name,n] of Object.entries(requiredSets)){const count=build.activeSets.find(s=>s.name===name)?.count||0;if(count<n)gaps.push({stat:'set:'+name,gap:n-count,target:n,direction:'missing'})}
  const score=STAT_KEYS.reduce((n,k)=>n+build.stats[k]*(weights[k]||0),0);
  return {artifactIds:path.map(a=>a.id),...build,gaps,score,meetsTargets:gaps.length===0};
 }
 const gapScore=c=>c.gaps.reduce((n,g)=>n+g.gap/Math.max(1,g.target),0);
 const compare=(a,b)=>Number(b.meetsTargets)-Number(a.meetsTargets)||gapScore(a)-gapScore(b)||b.score-a.score||a.artifactIds.join('|').localeCompare(b.artifactIds.join('|'));
 function retain(path){examined++;const c=candidate(path);results.push(c);results.sort(compare);if(results.length>limit)results.pop()}
 if(total<=maxCombinations){const path=[];function visit(slot){if(slot===groups.length){retain(path);return}for(const a of groups[slot]){path.push(a);visit(slot+1);path.pop()}}visit(0);return {results,examined,total,truncated:false,approximate:false,missing}}
 // Large inventories use a bounded beam. Results are explicitly approximate.
 // Per-slot shortlists retain objective leaders and representatives of each set.
 const singleRank=a=>{
  const b=calculateBuild(base,[a],[]).stats;
  return STAT_KEYS.reduce((n,k)=>n+(b[k]-base[k])*((weights[k]||0)+(targets[k]?1/Math.max(1,targets[k]):0)-(maxTargets[k]?1/Math.max(1,maxTargets[k]):0)),0);
 };
 const shortlist=groups.map(group=>{
  const ranked=[...group].sort((a,b)=>singleRank(b)-singleRank(a)||a.id.localeCompare(b.id));
  const selected=ranked.slice(0,32),sets=new Set(selected.map(a=>a.set));
  for(const a of ranked)if(a.set&&!sets.has(a.set)&&selected.length<64){selected.push(a);sets.add(a.set)}
  return selected;
 });
 let beam=[[]];
 for(const group of shortlist){const next=[];for(const path of beam)for(const a of group){const artifacts=[...path,a];next.push({artifacts,build:candidate(artifacts)})}next.sort((a,b)=>compare(a.build,b.build));beam=next.slice(0,beamWidth).map(x=>x.artifacts)}
 for(const path of beam)retain(path);
 return {results,examined,total,truncated:true,approximate:true,missing,shortlisted:shortlist.map(g=>g.length),beamWidth};
}
